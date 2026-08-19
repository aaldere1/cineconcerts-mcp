import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  searchEvents,
  formatEvent,
  toStructuredShows,
} from "../services/algolia.js";

export function registerSearchTool(server: McpServer) {
  server.registerTool(
    "search_shows",
    {
      title: "Search Shows",
      description:
        "Use this when the user wants to search upcoming CineConcerts events by keyword such as film title, city, or venue.",
      inputSchema: {
        query: z
          .string()
          .describe(
            "Search keyword — film title, city, venue name, or any text"
          ),
      },
      annotations: {
        title: "Search Shows",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ query }) => {
      const hits = await searchEvents(query);
      const shows = toStructuredShows(hits);

      if (!hits.length) {
        return {
          structuredContent: {
            query,
            total: 0,
            shows: [],
          },
          content: [
            {
              type: "text" as const,
              text: `No CineConcerts shows found matching "${query}".`,
            },
          ],
        };
      }

      const text = hits.map(formatEvent).join("\n\n---\n\n");
      return {
        structuredContent: {
          query,
          total: shows.length,
          shows,
        },
        content: [
          {
            type: "text" as const,
            text: `Found ${hits.length} show(s) matching "${query}":\n\n${text}`,
          },
        ],
      };
    }
  );
}
