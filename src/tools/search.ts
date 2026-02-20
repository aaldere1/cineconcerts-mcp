import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchEvents, formatEvent } from "../services/algolia.js";

export function registerSearchTool(server: McpServer) {
  server.registerTool(
    "search_shows",
    {
      title: "Search Shows",
      description:
        "Search for upcoming CineConcerts film-concert events by keyword (film title, city, venue, etc.)",
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

      if (!hits.length) {
        return {
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
