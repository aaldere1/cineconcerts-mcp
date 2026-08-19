import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SHOWS_WIDGET_URI } from "../ui/showsWidget.js";

const showInputSchema = z.object({
  id: z.string().describe("Unique event identifier."),
  title: z.string().describe("Event title."),
  eventDate: z
    .string()
    .nullable()
    .optional()
    .describe("Event date text, if available."),
  showCode: z
    .string()
    .nullable()
    .optional()
    .describe("Show code if available."),
  venue: z.string().nullable().optional().describe("Venue name."),
  city: z.string().nullable().optional().describe("City."),
  state: z.string().nullable().optional().describe("State or region."),
  country: z.string().nullable().optional().describe("Country."),
  countryFlag: z.string().nullable().optional().describe("Country flag image URL."),
  location: z
    .string()
    .nullable()
    .optional()
    .describe("Preformatted location string."),
  posterUrl: z.string().nullable().optional().describe("Poster URL."),
  ticketUrl: z.string().nullable().optional().describe("Ticket purchase URL."),
  preSale: z.string().nullable().optional().describe("Pre-sale status."),
  comingSoon: z.string().nullable().optional().describe("Coming soon status."),
  property: z.string().nullable().optional().describe("Source property/category."),
  latitude: z.number().nullable().optional().describe("Latitude."),
  longitude: z.number().nullable().optional().describe("Longitude."),
});

export function registerRenderUpcomingShowsWidgetTool(server: McpServer) {
  server.registerTool(
    "render_upcoming_shows_widget",
    {
      title: "Render Upcoming Shows Widget",
      description:
        "Use this when you want to render an interactive widget from shows returned by search_shows, list_upcoming_shows, or find_nearby_shows.",
      inputSchema: {
        shows: z
          .array(showInputSchema)
          .min(0)
          .max(20)
          .describe(
            "Pass structuredContent.shows from a data tool. This render tool does not fetch data by itself."
          ),
        title: z
          .string()
          .optional()
          .default("Upcoming CineConcerts Shows")
          .describe("Widget heading text."),
        source: z
          .string()
          .optional()
          .describe("Optional label for the source query, e.g. 'search: harry potter'."),
      },
      annotations: {
        title: "Render Upcoming Shows Widget",
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
      },
      _meta: {
        ui: { resourceUri: SHOWS_WIDGET_URI },
        "openai/outputTemplate": SHOWS_WIDGET_URI,
        "openai/toolInvocation/invoking": "Loading upcoming shows...",
        "openai/toolInvocation/invoked": "Upcoming shows loaded.",
      },
    },
    async ({ shows, title, source }) => {
      const normalizedShows = shows.slice(0, 20);
      const normalizedTitle = title.trim() || "Upcoming CineConcerts Shows";
      const normalizedSource = source?.trim() || null;

      return {
        structuredContent: {
          title: normalizedTitle,
          source: normalizedSource,
          total: normalizedShows.length,
          shows: normalizedShows,
        },
        content: [
          {
            type: "text" as const,
            text:
              normalizedShows.length > 0
                ? `Rendered widget with ${normalizedShows.length} show(s)${normalizedSource ? ` from ${normalizedSource}` : ""}.`
                : "Rendered widget with no shows to display.",
          },
        ],
      };
    }
  );
}
