import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { registerSearchTool } from "./tools/search.js";
import { registerNearbyTool } from "./tools/nearby.js";
import { registerListTool } from "./tools/list.js";
import { registerDetailsTool } from "./tools/details.js";

const PORT = parseInt(process.env.PORT || "8421", 10);
const HOST = process.env.HOST || "127.0.0.1";

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

const app = express();
app.use(express.json());
app.use(cors({ exposedHeaders: ["Mcp-Session-Id"], origin: "*" }));

const transports: Record<string, StreamableHTTPServerTransport> = {};

// Health check
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    server: "cineconcerts-mcp",
    version: "1.0.0",
    tools: [
      "search_shows",
      "find_nearby_shows",
      "list_upcoming_shows",
      "get_show_details",
    ],
  });
});

// MCP Streamable HTTP — POST (JSON-RPC messages)
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid: string) => {
          transports[sid] = transport;
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports[sid]) {
          delete transports[sid];
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
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

// MCP Streamable HTTP — DELETE (session termination)
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  await transports[sessionId].handleRequest(req, res);
});

app.listen(PORT, HOST, () => {
  console.log(`CineConcerts MCP server listening on ${HOST}:${PORT}`);
  console.log(`Health: http://${HOST}:${PORT}/health`);
  console.log(`MCP endpoint: http://${HOST}:${PORT}/mcp`);
});

process.on("SIGINT", async () => {
  console.log("Shutting down...");
  for (const sid of Object.keys(transports)) {
    await transports[sid].close();
    delete transports[sid];
  }
  process.exit(0);
});
