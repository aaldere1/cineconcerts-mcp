import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerSearchTool } from "./tools/search.js";
import { registerNearbyTool } from "./tools/nearby.js";
import { registerListTool } from "./tools/list.js";
import { registerDetailsTool } from "./tools/details.js";
import { registerRenderUpcomingShowsWidgetTool } from "./tools/renderWidget.js";
import { SHOWS_WIDGET_URI, showsWidgetHtml } from "./ui/showsWidget.js";

const PORT = parseInt(process.env.PORT || "8421", 10);
const HOST = process.env.HOST || "127.0.0.1";
const MAX_SESSIONS = 500;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Every path this server answers MCP on. `/` is what nginx forwards to today;
// `/mcp` and `/mcp/` are handled directly so that a proxy which forwards the
// path unchanged (or a future misconfiguration) cannot break every client.
const MCP_PATHS = ["/", "/mcp", "/mcp/"];

// --- Session management ---

interface SessionEntry {
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
}

const sessions: Record<string, SessionEntry> = {};

function touchSession(sid: string) {
  if (sessions[sid]) sessions[sid].lastActivity = Date.now();
}

// Purge idle sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const sid of Object.keys(sessions)) {
    if (now - sessions[sid].lastActivity > SESSION_TTL_MS) {
      console.log(`Purging idle session ${sid}`);
      sessions[sid].transport.close().catch(() => {});
      delete sessions[sid];
    }
  }
}, 5 * 60 * 1000);

// --- Client compatibility layer ---
//
// The MCP SDK is strict about two request headers and rejects anything that is
// not an exact match:
//   * POST without BOTH `application/json` and `text/event-stream` in Accept -> 406
//   * POST without `application/json` in Content-Type                        -> 415
// `Accept: */*` — the default for fetch(), curl, python-requests and most thin
// HTTP wrappers — fails that check, so plenty of otherwise-correct clients never
// complete a handshake and just report "failed to load / 0 tools".
//
// This is a public, unauthenticated server whose whole value is that any client
// can point at one URL and have it work, so we normalise the headers instead of
// asking every third party to change. We still record what the client actually
// sent, and answer in the format it asked for (see `enableJsonResponse` below).
//
// IMPORTANT: SDK >= 1.26 wraps the web-standard transport and rebuilds the
// request headers from `req.rawHeaders` via @hono/node-server — NOT from
// `req.headers`. Mutating `req.headers` alone looks right and silently does
// nothing. Both have to be rewritten.

const REQUIRED_ACCEPT = "application/json, text/event-stream";
const JSON_CONTENT_TYPE = "application/json";

declare module "express-serve-static-core" {
  interface Request {
    /** The Accept header exactly as the client sent it, before normalisation. */
    clientAccept?: string;
  }
}

function acceptsSse(accept: string | undefined): boolean {
  return !!accept && accept.toLowerCase().includes("text/event-stream");
}

function setRawHeader(req: Request, name: string, value: string) {
  const raw = req.rawHeaders;
  const lower = name.toLowerCase();
  for (let i = raw.length - 2; i >= 0; i -= 2) {
    if (raw[i].toLowerCase() === lower) raw.splice(i, 2);
  }
  raw.push(name, value);
}

function normalizeMcpHeaders(req: Request, _res: Response, next: NextFunction) {
  const accept = req.headers.accept;
  req.clientAccept = accept;

  const lower = (accept || "").toLowerCase();
  if (!lower.includes("application/json") || !lower.includes("text/event-stream")) {
    req.headers.accept = REQUIRED_ACCEPT;
    setRawHeader(req, "Accept", REQUIRED_ACCEPT);
  }

  const contentType = req.headers["content-type"];
  if (req.method === "POST" && !(contentType || "").toLowerCase().includes("application/json")) {
    req.headers["content-type"] = JSON_CONTENT_TYPE;
    setRawHeader(req, "Content-Type", JSON_CONTENT_TYPE);
  }

  next();
}

// --- Rate limiting ---
//
// Hosted clients (Cursor, ChatGPT and Claude connectors) proxy through a small
// pool of shared egress IPs, so every user of that product lands on one bucket
// here. The limit has to leave room for that while still stopping a scraper.
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    jsonrpc: "2.0",
    error: { code: -32000, message: "Rate limit exceeded. Try again shortly." },
    id: null,
  },
});

// --- MCP server factory ---

function createServer(): McpServer {
  const server = new McpServer({
    name: "cineconcerts",
    version: "1.0.0",
  });

  server.registerResource(
    "shows-widget",
    SHOWS_WIDGET_URI,
    {
      title: "Shows Widget",
      description: "Renders upcoming CineConcerts events in an embeddable widget.",
    },
    async () => ({
      contents: [
        {
          uri: SHOWS_WIDGET_URI,
          mimeType: "text/html;profile=mcp-app",
          text: showsWidgetHtml,
          _meta: {
            ui: {
              prefersBorder: true,
            },
          },
        },
      ],
    })
  );

  registerSearchTool(server);
  registerNearbyTool(server);
  registerListTool(server);
  registerDetailsTool(server);
  registerRenderUpcomingShowsWidgetTool(server);

  return server;
}

// --- Express app ---

const app = express();
// One trusted hop: nginx on 127.0.0.1. Makes req.ip the address nginx appended
// to X-Forwarded-For rather than anything the client put there itself.
app.set("trust proxy", 1);
app.disable("x-powered-by");

// CORS first, so browser preflights are answered before anything else can
// reject them. `Mcp-Session-Id` must be exposed or a browser-based client can
// never read the session id and every follow-up request is sessionless.
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS", "HEAD"],
    exposedHeaders: ["Mcp-Session-Id", "mcp-session-id", "Mcp-Protocol-Version"],
    allowedHeaders: [
      "Content-Type",
      "Accept",
      "Authorization",
      "Mcp-Session-Id",
      "mcp-session-id",
      "Mcp-Protocol-Version",
      "Last-Event-ID",
    ],
    maxAge: 86400,
  })
);

app.use(normalizeMcpHeaders);

// Parse any body as JSON. This endpoint only ever speaks JSON-RPC, and clients
// that omit or misdeclare Content-Type would otherwise arrive with an empty
// body and be rejected as "no valid session" with nothing to explain why.
app.use(express.json({ type: () => true, limit: "4mb" }));

app.use((req, res, next) => {
  if (req.path === "/health" || req.path === "/mcp/health") return next();
  limiter(req, res, next);
});

// --- Diagnostics ---
//
// First-contact failures are invisible from the outside: the client just says
// "failed to load". Log every rejection with the request shape that caused it
// so the next one can be diagnosed from the server logs alone.
app.use((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode < 400) return;
    const body: any = req.body;
    const rpcMethod = Array.isArray(body)
      ? body.map((m) => m?.method).join("+")
      : body?.method;
    console.warn(
      `[reject] ${res.statusCode} ${req.method} ${req.originalUrl} ` +
        `rpc=${JSON.stringify(rpcMethod ?? null)} ` +
        `accept=${JSON.stringify(req.clientAccept ?? null)} ` +
        `content-type=${JSON.stringify(req.headers["content-type"] ?? null)} ` +
        `session=${JSON.stringify(req.headers["mcp-session-id"] ?? null)} ` +
        `ua=${JSON.stringify(req.headers["user-agent"] ?? null)}`
    );
  });
  next();
});

// Health check (no rate limit). Reachable publicly at /mcp/health.
const health = (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    server: "cineconcerts-mcp",
    version: "1.0.0",
    activeSessions: Object.keys(sessions).length,
    tools: [
      "search_shows",
      "find_nearby_shows",
      "list_upcoming_shows",
      "get_show_details",
      "render_upcoming_shows_widget",
    ],
  });
};
app.get("/health", health);
app.get("/mcp/health", health);

function jsonRpcError(res: Response, status: number, code: number, message: string, id: unknown = null) {
  res.status(status).json({ jsonrpc: "2.0", error: { code, message }, id: id ?? null });
}

// A JSON-RPC payload may be a single message or a batch array. The SDK checks
// batches with `.some(isInitializeRequest)`; anything that only looks at the
// top-level object misses `[initialize]` and turns a valid handshake into
// "no valid session".
function isInitializePayload(body: unknown): boolean {
  if (Array.isArray(body)) return body.some((m) => isInitializeRequest(m));
  return isInitializeRequest(body);
}

// MCP Streamable HTTP — POST (JSON-RPC messages)
app.post(MCP_PATHS, async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  const requestId = (req.body && !Array.isArray(req.body) ? req.body.id : undefined) ?? null;

  try {
    // Known session — reuse its transport.
    if (sessionId && sessions[sessionId]) {
      touchSession(sessionId);
      await sessions[sessionId].transport.handleRequest(req, res, req.body);
      return;
    }

    // Initialize — start a new session. Accepted even when the client sent a
    // stale Mcp-Session-Id (after a restart or an idle purge its cached id is
    // meaningless, and refusing it strands the client permanently).
    if (isInitializePayload(req.body)) {
      if (Object.keys(sessions).length >= MAX_SESSIONS) {
        jsonRpcError(res, 503, -32000, "Server at capacity. Try again later.", requestId);
        return;
      }

      // Answer in the format the client actually asked for. Clients that list
      // text/event-stream get SSE; clients that sent `*/*`, `application/json`
      // or no Accept at all get a plain JSON body they can parse.
      const useJsonResponse = !acceptsSse(req.clientAccept);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        enableJsonResponse: useJsonResponse,
        onsessioninitialized: (sid: string) => {
          sessions[sid] = { transport, lastActivity: Date.now() };
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions[sid]) delete sessions[sid];
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    // Unknown session on a non-initialize request. The spec says 404 here, and
    // that is what tells a client to throw away its cached id and re-initialize.
    // A 400 makes it give up instead, which is a permanent failure after every
    // server restart or idle-session purge.
    if (sessionId) {
      jsonRpcError(
        res,
        404,
        -32001,
        "Session not found. Send an initialize request to start a new session.",
        requestId
      );
      return;
    }

    jsonRpcError(
      res,
      400,
      -32000,
      "Bad Request: send an initialize request first, or include the Mcp-Session-Id header.",
      requestId
    );
  } catch (error) {
    console.error("MCP POST error:", error);
    if (!res.headersSent) {
      jsonRpcError(res, 500, -32603, "Internal server error", requestId);
    }
  }
});

// MCP Streamable HTTP — HEAD (liveness probes and connector validators)
app.head(MCP_PATHS, (_req: Request, res: Response) => {
  res.status(200).end();
});

// MCP Streamable HTTP — GET (server-initiated SSE notifications)
//
// This stream is optional. When we cannot serve it we must answer 405: the
// official client treats 405 as "no stream offered" and carries on, but throws
// a connection error on any other failure status — so a 400 here can kill an
// otherwise healthy session over a stream nobody needed.
app.get(MCP_PATHS, async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions[sessionId]) {
    res
      .status(405)
      .set("Allow", "GET, POST, DELETE")
      .json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "No SSE stream available without an initialized session." },
        id: null,
      });
    return;
  }
  touchSession(sessionId);
  await sessions[sessionId].transport.handleRequest(req, res);
});

// MCP Streamable HTTP — DELETE (session termination, idempotent)
app.delete(MCP_PATHS, async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions[sessionId]) {
    res.status(200).json({ status: "ok" });
    return;
  }
  await sessions[sessionId].transport.handleRequest(req, res);
});

// Anything else under this origin is not part of the MCP endpoint.
app.use((req: Request, res: Response) => {
  jsonRpcError(res, 404, -32601, `Not found: ${req.method} ${req.originalUrl}`);
});

// Turn body-parser and unexpected route errors into JSON-RPC, never HTML.
app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
  if (res.headersSent) return;
  if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    jsonRpcError(res, 400, -32700, "Parse error: request body must be valid JSON-RPC.");
    return;
  }
  if (err?.type === "entity.too.large") {
    jsonRpcError(res, 413, -32600, "Request body too large.");
    return;
  }
  console.error("Unhandled error:", err);
  jsonRpcError(res, 500, -32603, "Internal server error");
});

app.listen(PORT, HOST, () => {
  console.log(`CineConcerts MCP server listening on ${HOST}:${PORT}`);
  console.log(`Health: http://${HOST}:${PORT}/health`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/ (also /mcp and /mcp/)`);
  console.log(
    `Rate limit: 240 req/min per IP | Max sessions: ${MAX_SESSIONS} | Session TTL: ${SESSION_TTL_MS / 60000}min`
  );
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  for (const sid of Object.keys(sessions)) {
    await sessions[sid].transport.close();
    delete sessions[sid];
  }
  process.exit(0);
});
