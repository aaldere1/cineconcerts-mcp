// Connects with the real MCP SDK client — the same one Claude Code, Cursor and
// most other clients use — and proves the handshake, tool list and a tool call
// all work end to end.
//
//   node scripts/verify-client.mjs http://127.0.0.1:8899
//   node scripts/verify-client.mjs https://cineconcerts.digital/mcp
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.argv[2] || "http://127.0.0.1:8899";
const transport = new StreamableHTTPClientTransport(new URL(url));
const client = new Client({ name: "verify-client", version: "1.0.0" });

await client.connect(transport);
const { tools } = await client.listTools();
console.log(`OK  ${url}  ->  ${tools.length} tools: ${tools.map((t) => t.name).join(", ")}`);

const result = await client.callTool({ name: "search_shows", arguments: { query: "Harry Potter" } });
const text = String(result.content?.[0]?.text || "").replace(/\n/g, " ").slice(0, 70);
console.log(`    tool call ok: ${text}...`);

await client.close();
process.exit(tools.length === 5 ? 0 : 1);
