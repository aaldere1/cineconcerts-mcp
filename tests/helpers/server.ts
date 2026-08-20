import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";

/**
 * Boots the built server for a test run.
 *
 * A spawned process over real HTTP rather than the Express app in-process: the
 * outage this server actually had was a routing and header problem, which an
 * in-process app does not exercise.
 */

export interface TestServer {
  baseUrl: string;
  stop(): void;
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      const port = typeof address === "object" && address ? address.port : 0;
      probe.close(() => (port ? resolve(port) : reject(new Error("no free port"))));
    });
  });
}

export async function startServer(): Promise<TestServer> {
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child: ChildProcess = spawn("node", ["dist/index.js"], {
    env: { ...process.env, PORT: String(port), HOST: "127.0.0.1" },
    stdio: "ignore",
  });

  const deadline = Date.now() + 30_000;
  for (;;) {
    if (Date.now() > deadline) {
      child.kill();
      throw new Error("server did not become healthy within 30s");
    }
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) break;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return { baseUrl, stop: () => child.kill() };
}

/** Minimal MCP client over plain fetch, so header shapes stay controllable. */
export class McpSession {
  private sessionId: string | null = null;
  constructor(private baseUrl: string, private path = "/mcp") {}

  async rpc(method: string, params?: unknown, notify = false): Promise<Record<string, unknown>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
    };
    if (this.sessionId) headers["Mcp-Session-Id"] = this.sessionId;
    const body: Record<string, unknown> = { jsonrpc: "2.0", method };
    if (params !== undefined) body.params = params;
    if (!notify) body.id = 1;

    const res = await fetch(`${this.baseUrl}${this.path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    if (!this.sessionId) this.sessionId = res.headers.get("mcp-session-id");
    const raw = await res.text();
    for (const line of raw.split("\n")) {
      const t = line.startsWith("data: ") ? line.slice(6).trim() : line.trim();
      if (t.startsWith("{")) return JSON.parse(t) as Record<string, unknown>;
    }
    return {};
  }

  async open(): Promise<void> {
    await this.rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "test", version: "1" },
    });
    await this.rpc("notifications/initialized", undefined, true);
  }

  async listTools(): Promise<string[]> {
    const r = await this.rpc("tools/list");
    const result = r.result as { tools?: Array<{ name: string }> } | undefined;
    return (result?.tools ?? []).map((t) => t.name);
  }

  async call(name: string, args: Record<string, unknown>): Promise<{ text: string; isError: boolean }> {
    const r = await this.rpc("tools/call", { name, arguments: args });
    const result = (r.result ?? {}) as { content?: Array<{ text?: string }>; isError?: boolean };
    return {
      text: (result.content ?? []).map((c) => c.text ?? "").join("\n"),
      isError: Boolean(result.isError) || "error" in r,
    };
  }
}
