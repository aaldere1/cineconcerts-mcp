export interface EventHit {
  objectID: string;
  Title?: string;
  'Event Date'?: string;
  City?: string;
  Country?: string;
  State?: string;
  Venue?: string;
  'Show Code'?: string;
}

export interface EventDates {
  startDate: string | null;
  endDate: string | null;
}

export interface ScheduleOptions {
  query?: string;
  city?: string;
  country?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
}

export interface ScheduleResult {
  hits: EventHit[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  unknownDateCount: number;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 60;
const QUERY_FIELDS = ['Title', 'City', 'Country', 'State', 'Venue', 'Show Code'] as const;

const US_STATES = new Set(
  ('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH ' +
    'NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY').split(' '),
);
const AU_STATES = new Set('ACT NSW NT QLD SA TAS VIC WA'.split(' '));
const CA_PROVINCES = new Set('AB BC MB NB NL NS NT NU ON PE QC SK YT'.split(' '));
const ANY_REGION_CODES = new Set([...US_STATES, ...AU_STATES, ...CA_PROVINCES]);

/**
 * Common country aliases (normalized) -> ISO 3166-1 alpha-2. Any two-letter value is treated as an
 * alpha-2 code; codes resolve to their English name via Intl.DisplayNames, e.g. US/USA/United States/
 * United States of America -> "united states", GB/UK/United Kingdom -> "united kingdom".
 */
const COUNTRY_ALIASES = new Map<string, string>([
  ['usa', 'US'], ['u.s.', 'US'], ['u.s.a.', 'US'], ['united states of america', 'US'], ['america', 'US'],
  ['uk', 'GB'], ['u.k.', 'GB'], ['great britain', 'GB'], ['britain', 'GB'],
  ['brasil', 'BR'], ['deutschland', 'DE'], ['espana', 'ES'], ['italia', 'IT'],
  ['holland', 'NL'], ['the netherlands', 'NL'], ['korea', 'KR'], ['south korea', 'KR'],
]);

const regionNames = new Intl.DisplayNames(['en'], { type: 'region', fallback: 'none' });

const DATE = String.raw`(\d{1,2})/(\d{1,2})/(\d{4})`;
const EVENT_DATE_RE = new RegExp(String.raw`^${DATE}(?:\s*(?:-|–|to)\s*${DATE})?$`, 'i');
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Lowercase, strip accents, collapse whitespace. */
export function normalizeText(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Normalized city with a trailing "(XX)" region suffix removed only when XX is a state/province of the
 * given country (any US/AU/CA region when no country is given), or exactly equals the given State field.
 * The country is never inferred from the city; any other suffix is kept.
 */
function cityKey(city: string, country?: string, state?: string): string {
  const m = /^(.*?\S)\s*\(([A-Za-z]{2,3})\)\s*$/.exec(city);
  if (!m) return normalizeText(city);
  const code = m[2]!;
  const codes = country?.trim() ? REGION_CODES.get(countryKey(country)) : ANY_REGION_CODES;
  const strip = codes?.has(code.toUpperCase()) || (/^[A-Z]{2,3}$/.test(code) && state?.trim() === code);
  return normalizeText(strip ? m[1]! : city);
}

function countryKey(country: string): string {
  const n = normalizeText(country);
  const code = COUNTRY_ALIASES.get(n) ?? (/^[a-z]{2}$/.test(n) ? n.toUpperCase() : undefined);
  if (code === undefined) return n;
  let name: string | undefined;
  try {
    name = regionNames.of(code);
  } catch {
    name = undefined;
  }
  return name ? normalizeText(name) : n;
}

/** Recognized region codes by countryKey, e.g. "australia" -> AU_STATES. */
const REGION_CODES = new Map<string, ReadonlySet<string>>([
  [countryKey('US'), US_STATES],
  [countryKey('AU'), AU_STATES],
  [countryKey('CA'), CA_PROVINCES],
]);

/** Returns YYYY-MM-DD if y/m/d is a real calendar date (UTC round trip), else null. */
function isoDate(y: number, m: number, d: number): string | null {
  // setUTCFullYear avoids Date.UTC's 0..99 → 1900..1999 year mapping.
  const t = new Date(0);
  t.setUTCFullYear(y, m - 1, d);
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
}

/** Parses "MM/DD/YYYY" or "MM/DD/YYYY to MM/DD/YYYY"; unknown or impossible dates yield both null. */
export function parseEventDates(value: unknown): EventDates {
  const m = EVENT_DATE_RE.exec(text(value).trim());
  if (!m) return { startDate: null, endDate: null };
  const startDate = isoDate(Number(m[3]), Number(m[1]), Number(m[2]));
  const endDate = m[4] ? isoDate(Number(m[6]), Number(m[4]), Number(m[5])) : startDate;
  if (!startDate || !endDate || endDate < startDate) return { startDate: null, endDate: null };
  return { startDate, endDate };
}

function intOption(name: string, value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
}

function isoOption(name: string, value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) throw new RangeError(`${name} must be YYYY-MM-DD`);
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  if (isoDate(y, m, d) !== value) throw new RangeError(`${name} is not a real date`);
  return value;
}

/** Returns the trimmed string, or undefined when absent/blank (no filter). */
function textOption(name: string, value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  return value.trim() || undefined;
}

/**
 * Filters, sorts (startDate asc, unknown last, then objectID) and paginates hits. Returns the original
 * hit objects. unknownDateCount counts unknown-date hits in the full matched set.
 */
export function filterSchedule(hits: readonly EventHit[], options: ScheduleOptions = {}): ScheduleResult {
  if (!Array.isArray(hits)) throw new TypeError('hits must be an array');
  if (typeof options !== 'object' || options === null) throw new TypeError('options must be an object');
  const page = intOption('page', options.page, 0, 0, Number.MAX_SAFE_INTEGER);
  const pageSize = intOption('pageSize', options.pageSize, DEFAULT_PAGE_SIZE, 1, MAX_PAGE_SIZE);
  const dateFrom = isoOption('dateFrom', options.dateFrom);
  const dateTo = isoOption('dateTo', options.dateTo);
  if (dateFrom && dateTo && dateFrom > dateTo) throw new RangeError('dateFrom must be <= dateTo');
  const rawQuery = textOption('query', options.query);
  const rawCity = textOption('city', options.city);
  const rawCountry = textOption('country', options.country);
  const query = rawQuery === undefined ? undefined : normalizeText(rawQuery);
  const city = rawCity === undefined ? undefined : cityKey(rawCity, rawCountry);
  const country = rawCountry === undefined ? undefined : countryKey(rawCountry);
  const hasDateFilter = dateFrom !== undefined || dateTo !== undefined;

  const matched: { hit: EventHit; id: string; start: string | null }[] = [];
  let unknownDateCount = 0;
  for (const hit of hits) {
    if (city !== undefined && cityKey(text(hit.City), text(hit.Country), text(hit.State)) !== city) continue;
    if (country !== undefined && countryKey(text(hit.Country)) !== country) continue;
    if (query !== undefined && !QUERY_FIELDS.some((f) => normalizeText(text(hit[f])).includes(query))) continue;
    const { startDate, endDate } = parseEventDates(hit['Event Date']);
    if (startDate === null || endDate === null) {
      if (hasDateFilter) continue;
      unknownDateCount++;
    } else if ((dateFrom && endDate < dateFrom) || (dateTo && startDate > dateTo)) {
      continue;
    }
    matched.push({ hit, id: String(hit.objectID), start: startDate });
  }

  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
  matched.sort((a, b) => {
    if (a.start !== b.start) {
      if (a.start === null) return 1;
      if (b.start === null) return -1;
      return cmp(a.start, b.start);
    }
    return cmp(a.id, b.id);
  });

  const offset = page * pageSize;
  return {
    hits: matched.slice(offset, offset + pageSize).map((m) => m.hit),
    total: matched.length,
    page,
    pageSize,
    hasMore: offset + pageSize < matched.length,
    unknownDateCount,
  };
}
