import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { findByShowCode, toStructuredShow } from "../services/algolia.js";

export function registerDetailsTool(server: McpServer) {
  server.registerTool(
    "get_show_details",
    {
      title: "Get Show Details",
      description:
        "Use this when the user asks for complete details about a specific CineConcerts show code.",
      inputSchema: {
        show_code: z
          .string()
          .describe("The show code identifier (e.g. HP3, HP4)"),
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
          structuredContent: {
            showCode: show_code,
            show: null,
            rawFields: null,
          },
          content: [
            {
              type: "text" as const,
              text: `No CineConcerts show found with code "${show_code}".`,
            },
          ],
        };
      }

      const rawFields = Object.fromEntries(
        Object.entries(hit).filter(([k]) => !k.startsWith("_") && k !== "objectID")
      );

      // Return all available fields for the detail view
      const allFields = Object.entries(rawFields)
        .map(([k, v]) => `**${k}**: ${v}`)
        .join("\n");

      return {
        structuredContent: {
          showCode: show_code,
          show: toStructuredShow(hit),
          rawFields,
        },
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
