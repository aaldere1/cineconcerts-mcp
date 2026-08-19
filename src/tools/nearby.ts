import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  geoSearchEvents,
  formatEvent,
  toStructuredShows,
} from "../services/algolia.js";
import { geocode } from "../services/geocode.js";

export function registerNearbyTool(server: McpServer) {
  server.registerTool(
    "find_nearby_shows",
    {
      title: "Find Nearby Shows",
      description:
        "Use this when the user asks for CineConcerts events near a location such as a city, address, or landmark.",
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
      const radiusKm = radius_km ?? 500;

      if (!geo) {
        return {
          structuredContent: {
            locationQuery: location,
            radiusKm,
            resolvedLocation: null,
            total: 0,
            shows: [],
          },
          content: [
            {
              type: "text" as const,
              text: `Could not geocode "${location}". Try a more specific city name or address.`,
            },
          ],
        };
      }

      const radiusMeters = radiusKm * 1000;
      const hits = await geoSearchEvents(geo.lat, geo.lng, radiusMeters);
      const shows = toStructuredShows(hits);

      if (!hits.length) {
        return {
          structuredContent: {
            locationQuery: location,
            radiusKm,
            resolvedLocation: geo.displayName,
            resolvedCoordinates: { lat: geo.lat, lng: geo.lng },
            total: 0,
            shows: [],
          },
          content: [
            {
              type: "text" as const,
              text: `No CineConcerts shows found within ${radiusKm}km of ${geo.displayName}.`,
            },
          ],
        };
      }

      const text = hits.map(formatEvent).join("\n\n---\n\n");
      return {
        structuredContent: {
          locationQuery: location,
          radiusKm,
          resolvedLocation: geo.displayName,
          resolvedCoordinates: { lat: geo.lat, lng: geo.lng },
          total: shows.length,
          shows,
        },
        content: [
          {
            type: "text" as const,
            text: `Found ${hits.length} show(s) within ${radiusKm}km of ${geo.displayName}:\n\n${text}`,
          },
        ],
      };
    }
  );
}
