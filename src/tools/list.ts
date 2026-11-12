import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readSchedule, scheduleFilterSchema } from "./scheduleRead.js";

export function registerListTool(server: McpServer) {
  server.registerTool(
    "list_upcoming_shows",
    {
      title: "List Upcoming Shows",
      description:
        "Use this when the user wants a broad list of currently published CineConcerts events without a keyword. " +
        "Use the explicit city and country fields for exact location filters and dateFrom/dateTo (ISO dates) for date ranges. " +
        "Reads the complete published schedule; total is the full matched count and results are paged with page/pageSize (or limit) — use hasMore to fetch further pages.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .default(20)
          .describe("Number of shows to return (default 20, max 60)"),
        ...scheduleFilterSchema,
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(60)
          .optional()
          .describe("Shows per page (1–60); overrides limit when given"),
      },
      annotations: {
        title: "List Upcoming Shows",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ limit, city, country, dateFrom, dateTo, page, pageSize }) => {
      const size = pageSize ?? limit ?? 20;
      return readSchedule(
        { limit: size },
        { city, country, dateFrom, dateTo, page: page ?? 0, pageSize: size },
        "the given filters"
      );
    }
  );
}
