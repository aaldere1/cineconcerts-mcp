import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findByShowCode, formatEvent } from "../services/algolia.js";

export function registerDetailsTool(server: McpServer) {
  server.registerTool(
    "get_show_details",
    {
      title: "Get Show Details",
      description:
        "Get full details for a specific CineConcerts show by its show code",
      inputSchema: {
        show_code: z
          .string()
          .describe("The show code identifier (e.g. HP4-NYC-2026)"),
      },
      annotations: {
        title: "Get Show Details",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ show_code }) => {
      const hit = await findByShowCode(show_code);

      if (!hit) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No CineConcerts show found with code "${show_code}".`,
            },
          ],
        };
      }

      // Return all available fields for the detail view
      const allFields = Object.entries(hit)
        .filter(
          ([k]) =>
            !k.startsWith("_") && k !== "objectID"
        )
        .map(([k, v]) => `**${k}**: ${v}`)
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Show details for "${hit.Title || show_code}":\n\n${allFields}`,
          },
        ],
      };
    }
  );
}
