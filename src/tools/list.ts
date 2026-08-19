import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  browseAllEvents,
  formatEvent,
  toStructuredShows,
} from "../services/algolia.js";

export function registerListTool(server: McpServer) {
  server.registerTool(
    "list_upcoming_shows",
    {
      title: "List Upcoming Shows",
      description:
        "Use this when the user wants a broad list of upcoming CineConcerts events without a specific query.",
      inputSchema: {
        limit: z
          .number()
          .optional()
          .default(20)
          .describe("Number of shows to return (default 20, max 60)"),
      },
      annotations: {
        title: "List Upcoming Shows",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ limit }) => {
      const cap = Math.min(limit ?? 20, 60);
      const hits = await browseAllEvents(cap);
      const shows = toStructuredShows(hits);

      if (!hits.length) {
        return {
          structuredContent: {
            limit: cap,
            total: 0,
            shows: [],
          },
          content: [
            {
              type: "text" as const,
              text: "No upcoming CineConcerts shows found.",
            },
          ],
        };
      }

      const text = hits.map(formatEvent).join("\n\n---\n\n");
      return {
        structuredContent: {
          limit: cap,
          total: shows.length,
          shows,
        },
        content: [
          {
            type: "text" as const,
            text: `Showing ${hits.length} upcoming CineConcerts event(s):\n\n${text}`,
          },
        ],
      };
    }
  );
}
