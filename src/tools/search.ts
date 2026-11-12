import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readSchedule, scheduleFilterSchema } from "./scheduleRead.js";

export function registerSearchTool(server: McpServer) {
  server.registerTool(
    "search_shows",
    {
      title: "Search Shows",
      description:
        "Use this when the user wants to search currently published CineConcerts events by keyword (film title, venue, any text). " +
        "Use the explicit city and country fields for exact location filters and dateFrom/dateTo (ISO dates) for date ranges. " +
        "Searches the complete published schedule; total is the full matched count and results are paged with page/pageSize — use hasMore to fetch further pages.",
      inputSchema: {
        query: z
          .string()
          .max(200)
          .optional()
          .default("")
          .describe(
            "Search keyword — film title, city, venue name, or any text (optional)"
          ),
        ...scheduleFilterSchema,
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .default(20)
          .describe("Shows per page (default 20, max 60)"),
      },
      annotations: {
        title: "Search Shows",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ query, city, country, dateFrom, dateTo, page, pageSize }) => {
      const q = query ?? "";
      return readSchedule(
        { query: q },
        { query: q, city, country, dateFrom, dateTo, page: page ?? 0, pageSize: pageSize ?? 20 },
        q ? `"${q}"` : "the given filters"
      );
    }
  );
}
