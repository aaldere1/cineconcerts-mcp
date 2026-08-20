import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { startServer, McpSession, type TestServer } from "./helpers/server.js";

/**
 * The HTTP surface and every tool, against the built server.
 *
 * This server is unauthenticated and reachable by anyone, so a regression here
 * is visible to the whole internet immediately.
 */

const HAVE_ALGOLIA = Boolean(process.env.ALGOLIA_APP_ID && process.env.ALGOLIA_API_KEY);

let server: TestServer;

before(async () => {
  server = await startServer();
});
after(() => server?.stop());

describe("routing", () => {
  // A trailing slash once 301'd, which turned a client's POST into a GET and
  // presented as "failed_to_load, 0 tools". All three forms must work.
  for (const path of ["/", "/mcp", "/mcp/"]) {
    test(`accepts POST at ${path}`, async () => {
      const res = await fetch(`${server.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "initialize",
          id: 1,
          params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
        }),
      });
      assert.equal(res.status, 200, `${path} returned ${res.status}`);
    });
  }

  test("serves health", async () => {
    assert.equal((await (await fetch(`${server.baseUrl}/health`)).json()).status, "ok");
  });
});

describe("client quirks", () => {
  const INIT = {
    jsonrpc: "2.0",
    method: "initialize",
    id: 1,
    params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } },
  };
  const CASES: Array<[string, Record<string, string>]> = [
    ["well-formed", { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }],
    ["text/plain body", { "Content-Type": "text/plain", Accept: "application/json, text/event-stream" }],
    ["no content-type", { Accept: "application/json, text/event-stream" }],
    ["accept: application/json only", { "Content-Type": "application/json", Accept: "application/json" }],
    ["accept: */*", { "Content-Type": "application/json", Accept: "*/*" }],
    ["no accept header", { "Content-Type": "application/json" }],
  ];
  for (const [label, headers] of CASES) {
    test(`accepts ${label}`, async () => {
      const res = await fetch(`${server.baseUrl}/mcp`, {
        method: "POST",
        headers,
        body: JSON.stringify(INIT),
      });
      assert.equal(res.status, 200, `${label} returned ${res.status}`);
    });
  }
});

describe("tools", { skip: HAVE_ALGOLIA ? false : "no ALGOLIA credentials" }, () => {
  const EXPECTED = [
    "search_shows",
    "find_nearby_shows",
    "list_upcoming_shows",
    "get_show_details",
    "render_upcoming_shows_widget",
  ];
  const CASES: Record<string, Record<string, unknown>> = {
    search_shows: { query: "Harry Potter" },
    find_nearby_shows: { location: "Dallas, TX" },
    list_upcoming_shows: {},
    get_show_details: { show_code: "HP1" },
  };

  let mcp: McpSession;
  let tools: string[];

  before(async () => {
    mcp = new McpSession(server.baseUrl);
    await mcp.open();
    tools = await mcp.listTools();
  });

  test("registers exactly the expected tools", () => {
    assert.deepEqual([...tools].sort(), [...EXPECTED].sort());
  });

  test("exposes no write tool", () => {
    // Public and unauthenticated by design. Anything that mutates would be
    // reachable by the entire internet.
    const writes = tools.filter((n) => /create|update|delete|write|set_|add_|remove/i.test(n));
    assert.deepEqual(writes, []);
  });

  for (const name of Object.keys(CASES)) {
    test(`${name} returns real data`, { timeout: 60_000 }, async () => {
      const { text, isError } = await mcp.call(name, CASES[name]!);
      assert.equal(isError, false, `${name} errored: ${text.slice(0, 200)}`);
      assert.ok(text.trim().length > 0, `${name} returned nothing`);
      // A tool that answers "no shows" for a query the catalogue plainly
      // satisfies is broken, not empty.
      assert.doesNotMatch(text.toLowerCase(), /no shows found|no results|nothing found/, `${name} found nothing`);
    });
  }

  test("the README documents every registered tool", () => {
    const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
    const missing = tools.filter((n) => !readme.includes(n));
    assert.deepEqual(missing, [], `undocumented: ${missing.join(", ")}`);
  });
});
