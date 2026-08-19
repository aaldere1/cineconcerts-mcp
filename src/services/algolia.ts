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

export interface StructuredShow {
  id: string;
  title: string;
  eventDate: string | null;
  showCode: string | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  countryFlag: string | null;
  location: string | null;
  posterUrl: string | null;
  ticketUrl: string | null;
  preSale: string | null;
  comingSoon: string | null;
  property: string | null;
  latitude: number | null;
  longitude: number | null;
}

function toNullableString(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function toStructuredShow(hit: EventHit): StructuredShow {
  const venue = toNullableString(hit.Venue);
  const city = toNullableString(hit.City);
  const state = toNullableString(hit.State);
  const country = toNullableString(hit.Country);
  const locationParts = [venue, city, state, country].filter(
    (part): part is string => Boolean(part)
  );

  return {
    id: hit.objectID,
    title: toNullableString(hit.Title) || "CineConcerts Event",
    eventDate: toNullableString(hit["Event Date"]),
    showCode: toNullableString(hit["Show Code"]),
    venue,
    city,
    state,
    country,
    countryFlag: toNullableString(hit["Country Flag"]),
    location: locationParts.length ? locationParts.join(", ") : null,
    posterUrl: toNullableString(hit.Poster),
    ticketUrl: toNullableString(hit["Buy Tickets"]),
    preSale: toNullableString(hit["Pre-Sale"]),
    comingSoon: toNullableString(hit["Coming Soon"]),
    property: toNullableString(hit.Property),
    latitude: hit._geoloc?.lat ?? null,
    longitude: hit._geoloc?.lng ?? null,
  };
}

export function toStructuredShows(hits: EventHit[]): StructuredShow[] {
  return hits.map(toStructuredShow);
}

export function formatEvent(hit: EventHit): string {
  const show = toStructuredShow(hit);

  const lines = [
    `**${show.title}**`,
    `Date: ${show.eventDate || "TBA"}`,
    show.location ? `Location: ${show.location}` : null,
    show.showCode ? `Show Code: ${show.showCode}` : null,
    show.posterUrl ? `Poster: ${show.posterUrl}` : null,
    show.ticketUrl ? `Tickets: ${show.ticketUrl}` : null,
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
