import { algoliasearch } from "algoliasearch";

const client = algoliasearch(
  process.env.ALGOLIA_APP_ID!,
  process.env.ALGOLIA_API_KEY!
);

const INDEX = "knack_events";

export interface EventHit {
  objectID: string;
  Title?: string;
  "Event Date"?: string;
  "Show Code"?: string;
  City?: string;
  Country?: string;
  "Country Flag"?: string;
  State?: string;
  Venue?: string;
  Poster?: string;
  "Buy Tickets"?: string;
  "Pre-Sale"?: string;
  "Coming Soon"?: string;
  Property?: string;
  _geoloc?: { lat: number; lng: number };
}

export function formatEvent(hit: EventHit): string {
  const title = hit.Title || "CineConcerts Event";
  const date = hit["Event Date"] || "TBA";
  const venue = hit.Venue || "";
  const city = hit.City || "";
  const country = hit.Country || "";
  const flag = hit["Country Flag"] || "";
  const tickets = hit["Buy Tickets"] || "";
  const showCode = hit["Show Code"] || "";
  const poster = hit.Poster || "";

  const state = hit.State || "";
  const locationParts = [venue, city, state, country].filter(Boolean);
  const location = locationParts.join(", ");

  const lines = [
    `**${title}**`,
    `Date: ${date}`,
    location ? `Location: ${location}` : null,
    showCode ? `Show Code: ${showCode}` : null,
    poster ? `Poster: ${poster}` : null,
    tickets ? `Tickets: ${tickets}` : null,
  ];

  return lines.filter(Boolean).join("\n");
}

export async function searchEvents(query: string): Promise<EventHit[]> {
  const { hits } = await client.searchSingleIndex<EventHit>({
    indexName: INDEX,
    searchParams: { query, hitsPerPage: 20 },
  });
  return hits;
}

export async function geoSearchEvents(
  lat: number,
  lng: number,
  radiusMeters: number
): Promise<EventHit[]> {
  const { hits } = await client.searchSingleIndex<EventHit>({
    indexName: INDEX,
    searchParams: {
      query: "",
      aroundLatLng: `${lat},${lng}`,
      aroundRadius: radiusMeters,
      hitsPerPage: 20,
    },
  });
  return hits;
}

export async function browseAllEvents(limit: number): Promise<EventHit[]> {
  const { hits } = await client.searchSingleIndex<EventHit>({
    indexName: INDEX,
    searchParams: { query: "", hitsPerPage: limit },
  });
  return hits;
}

export async function findByShowCode(
  showCode: string
): Promise<EventHit | null> {
  const { hits } = await client.searchSingleIndex<EventHit>({
    indexName: INDEX,
    searchParams: {
      query: showCode,
      hitsPerPage: 5,
    },
  });
  const match = hits.find(
    (h) =>
      h["Show Code"]?.toLowerCase() === showCode.toLowerCase() ||
      h.objectID === showCode
  );
  return match || hits[0] || null;
}
