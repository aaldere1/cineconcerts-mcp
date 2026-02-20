import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { browseAllEvents, formatEvent } from "../services/algolia.js";

export function registerListTool(server: McpServer) {
  server.registerTool(
    "list_upcoming_shows",
    {
      title: "List Upcoming Shows",
      description: "Browse all upcoming CineConcerts film-concert events",
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

      if (!hits.length) {
        return {
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
