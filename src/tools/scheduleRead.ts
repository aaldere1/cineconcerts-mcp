import { z } from "zod";
import {
  fetchCompleteEvents,
  formatEvent,
  toStructuredShows,
  type EventHit,
} from "../services/algolia.js";
import { filterSchedule } from "../services/schedule.js";

const SOURCE_URL = "https://cineconcerts.digital/mcp/";
const SOURCE = "CineConcerts published schedule";

/** Input fields shared by the search and list tools. */
export const scheduleFilterSchema = {
  city: z
    .string()
    .max(100)
    .optional()
    .describe("Exact city name match (case-insensitive), e.g. \"Chicago\""),
  country: z
    .string()
    .max(100)
    .optional()
    .describe("Exact country name match (case-insensitive), e.g. \"United States\""),
  dateFrom: z
    .string()
    .optional()
    .describe("ISO date (YYYY-MM-DD); only shows on or after this date"),
  dateTo: z
    .string()
    .optional()
    .describe("ISO date (YYYY-MM-DD); only shows on or before this date"),
  page: z
    .number()
    .int()
    .min(0)
    .max(100000)
    .optional()
    .default(0)
    .describe("Zero-based page of matched results (default 0)"),
};

export interface ScheduleReadInput {
  query?: string;
  city?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

/**
 * Filters the complete published inventory and pages the matches. On any
 * failure it reports the read as unavailable — never as an empty schedule.
 */
export async function readSchedule(
  echo: { query: string } | { limit: number },
  input: ScheduleReadInput,
  label: string
) {
  try {
    const inventory = await fetchCompleteEvents();
    const result = filterSchedule(inventory.hits, input);
    const pageHits = result.hits as EventHit[];
    const { city, country, dateFrom, dateTo } = input;

    const structuredContent = {
      ...echo,
      filters: { city: city ?? null, country: country ?? null, dateFrom: dateFrom ?? null, dateTo: dateTo ?? null },
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      hasMore: result.hasMore,
      unknownDateCount: result.unknownDateCount,
      sourceTotal: inventory.sourceTotal,
      coverage: inventory.coverage,
      fetchedAt: inventory.fetchedAt,
      sourceDigest: inventory.sourceDigest,
      sourceURL: SOURCE_URL,
      source: SOURCE,
      shows: toStructuredShows(pageHits),
    };

    let text: string;
    if (!result.total) {
      text = `No currently published CineConcerts shows match ${label} (checked all ${inventory.sourceTotal} published listings).`;
    } else if (!pageHits.length) {
      text = `${result.total} currently published CineConcerts show(s) match ${label}, but page ${result.page} is past the end.`;
    } else {
      const start = result.page * result.pageSize + 1;
      const end = start + pageHits.length - 1;
      text =
        `${result.total} currently published CineConcerts show(s) match ${label}. ` +
        `Showing ${start}–${end} (page ${result.page})${result.hasMore ? "; more pages available" : ""}:\n\n` +
        pageHits.map(formatEvent).join("\n\n---\n\n");
    }

    return { structuredContent, content: [{ type: "text" as const, text }] };
  } catch {
    return {
      isError: true,
      structuredContent: { coverage: "unavailable" as const, sourceURL: SOURCE_URL },
      content: [
        {
          type: "text" as const,
          text: "The complete CineConcerts schedule could not be verified right now, so no results are shown. Please try again shortly.",
        },
      ],
    };
  }
}
