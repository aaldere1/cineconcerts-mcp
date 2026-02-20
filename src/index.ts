import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerSearchTool } from "./tools/search.js";
import { registerNearbyTool } from "./tools/nearby.js";
import { registerListTool } from "./tools/list.js";
import { registerDetailsTool } from "./tools/details.js";

const PORT = parseInt(process.env.PORT || "8421", 10);
const HOST = process.env.HOST || "127.0.0.1";
const MAX_SESSIONS = 100;
const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

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

// --- Rate limiting ---

// Per-IP: 60 requests per minute (generous for normal use, blocks scripts)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  keyGenerator: (req) =>
    req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
    req.ip ||
    "unknown",
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

  registerSearchTool(server);
  registerNearbyTool(server);
  registerListTool(server);
  registerDetailsTool(server);

  return server;
}

// --- Express app ---

const app = express();
app.use(express.json());
app.use(cors({ exposedHeaders: ["Mcp-Session-Id"], origin: "*" }));

// Apply rate limiting to MCP endpoint only (not health check)
app.use("/", (req, res, next) => {
  if (req.path === "/health") return next();
  limiter(req, res, next);
});

// Health check (no rate limit)
app.get("/health", (_req, res) => {
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
    ],
  });
});

// MCP Streamable HTTP — POST (JSON-RPC messages)
app.post("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && sessions[sessionId]) {
      touchSession(sessionId);
      transport = sessions[sessionId].transport;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // Enforce session cap
      if (Object.keys(sessions).length >= MAX_SESSIONS) {
        res.status(503).json({
          jsonrpc: "2.0",
          error: {
            code: -32000,
            message: "Server at capacity. Try again later.",
          },
          id: null,
        });
        return;
      }

      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid: string) => {
          sessions[sid] = { transport, lastActivity: Date.now() };
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && sessions[sid]) {
          delete sessions[sid];
        }
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    } else {
      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: No valid session" },
        id: null,
      });
      return;
    }

    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("MCP POST error:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// MCP Streamable HTTP — GET (SSE notifications)
app.get("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  touchSession(sessionId);
  await sessions[sessionId].transport.handleRequest(req, res);
});

// MCP Streamable HTTP — DELETE (session termination)
app.delete("/", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !sessions[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await sessions[sessionId].transport.handleRequest(req, res);
});

app.listen(PORT, HOST, () => {
  console.log(`CineConcerts MCP server listening on ${HOST}:${PORT}`);
  console.log(`Health: http://${HOST}:${PORT}/health`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/`);
  console.log(
    `Rate limit: 60 req/min per IP | Max sessions: ${MAX_SESSIONS} | Session TTL: ${SESSION_TTL_MS / 60000}min`
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
