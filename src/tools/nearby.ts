import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { geoSearchEvents, formatEvent } from "../services/algolia.js";
import { geocode } from "../services/geocode.js";

export function registerNearbyTool(server: McpServer) {
  server.registerTool(
    "find_nearby_shows",
    {
      title: "Find Nearby Shows",
      description:
        "Find CineConcerts shows near a location (city name, address, or landmark)",
      inputSchema: {
        location: z
          .string()
          .describe("City name, address, or landmark to search near"),
        radius_km: z
          .number()
          .optional()
          .default(500)
          .describe("Search radius in kilometers (default 500)"),
      },
      annotations: {
        title: "Find Nearby Shows",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
    },
    async ({ location, radius_km }) => {
      const geo = await geocode(location);

      if (!geo) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Could not geocode "${location}". Try a more specific city name or address.`,
            },
          ],
        };
      }

      const radiusMeters = (radius_km ?? 500) * 1000;
      const hits = await geoSearchEvents(geo.lat, geo.lng, radiusMeters);

      if (!hits.length) {
        return {
          content: [
            {
              type: "text" as const,
              text: `No CineConcerts shows found within ${radius_km ?? 500}km of ${geo.displayName}.`,
            },
          ],
        };
      }

      const text = hits.map(formatEvent).join("\n\n---\n\n");
      return {
        content: [
          {
            type: "text" as const,
            text: `Found ${hits.length} show(s) within ${radius_km ?? 500}km of ${geo.displayName}:\n\n${text}`,
          },
        ],
      };
    }
  );
}
