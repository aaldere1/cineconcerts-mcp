import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filterSchedule, parseEventDates, type EventHit } from '../src/services/schedule.js';
import { scheduleDigest } from '../src/services/algolia.js';

const pad = (n: number): string => String(n).padStart(2, '0');

const SPECIFIC: EventHit[] = [
  { objectID: 'p1', Title: 'A Night in Paris', City: 'San Francisco', State: 'CA', Country: 'USA', 'Event Date': '03/01/2025' },
  { objectID: 'p2', Title: 'Azkaban', City: 'Paris', Country: 'France', 'Event Date': '04/10/2025' },
  { objectID: 'l1', Title: 'Show', City: 'London', Country: 'United Kingdom', 'Event Date': '05/01/2025' },
  { objectID: 's1', Title: 'Show', City: 'Sydney', Country: 'Australia', 'Event Date': '06/01/2025' },
  { objectID: 'sp', Title: 'Show', City: 'São Paulo', Country: 'Brasil', 'Event Date': '07/01/2025 to 07/03/2025' },
  { objectID: 'd1', Title: 'Leap', City: 'Davenport (IA)', Country: 'United States', 'Event Date': '02/29/2024' },
  { objectID: 'r1', Title: 'NYE', City: 'Austin', Country: 'US', Venue: 'Hall', 'Show Code': 'NYE-24', 'Event Date': '12/30/2024 to 01/02/2025' },
  { objectID: 'u1', Title: 'TBD', City: 'Austin', Country: 'US' },
  { objectID: 'u2', Title: 'Bad', City: 'Austin', Country: 'US', 'Event Date': '02/30/2025' },
  { objectID: 'u3', Title: 'NotLeap', City: 'Austin', Country: 'US', 'Event Date': '02/29/2023' },
];
const GENERATED: EventHit[] = Array.from({ length: 61 }, (_, i) => ({
  objectID: `g${pad(i)}`,
  Title: 'Tour',
  City: 'Springfield',
  Country: 'US',
  'Event Date': `${pad((i % 12) + 1)}/${pad((i % 28) + 1)}/2026`,
}));
const HITS: EventHit[] = [...GENERATED, ...SPECIFIC];
const ids = (opts: Parameters<typeof filterSchedule>[1]): string[] =>
  filterSchedule(HITS, opts).hits.map((h) => h.objectID);

const REGION: EventHit[] = [
  { objectID: 'au', City: 'Sydney (NSW)', Country: 'AU' },
  { objectID: 'ca', City: 'Toronto (ON)', Country: 'Canada' },
  { objectID: 'fr', City: 'Paris (TX)', Country: 'FR' },
  { objectID: 'frs', City: 'Paris (TX)', Country: 'France', State: 'TX' },
  { objectID: 'gb', City: 'Sydney (NSW)', Country: 'GB' },
  { objectID: 'gb2', City: 'Sydney', Country: 'United Kingdom' },
  { objectID: 'lon', City: 'London (ON)', Country: 'GB' },
];
const IDF: EventHit[] = [
  { objectID: 'idf', City: 'Paris (IDF)', Country: 'France', State: 'IDF' },
  { objectID: 'par', City: 'Paris', Country: 'France' },
  { objectID: 'tx', City: 'Paris (TX)', Country: 'US', State: 'TX' },
];

/** All matching IDs across every page. */
const allIds = (rows: readonly EventHit[], opts: Parameters<typeof filterSchedule>[1]): string[] => {
  const out: string[] = [];
  for (let page = 0; ; page++) {
    const r = filterSchedule(rows, { ...opts, page, pageSize: 60 });
    out.push(...r.hits.map((h) => h.objectID));
    if (!r.hasMore) return out;
  }
};

test('parseEventDates handles singles, ranges, leap years and impossible dates', () => {
  assert.deepEqual(parseEventDates('03/01/2025'), { startDate: '2025-03-01', endDate: '2025-03-01' });
  assert.deepEqual(parseEventDates('12/30/2024 to 01/02/2025'), { startDate: '2024-12-30', endDate: '2025-01-02' });
  assert.deepEqual(parseEventDates('02/29/2024'), { startDate: '2024-02-29', endDate: '2024-02-29' });
  assert.deepEqual(parseEventDates('12/31/0099'), { startDate: '0099-12-31', endDate: '0099-12-31' });
  assert.deepEqual(parseEventDates('02/29/0000'), { startDate: '0000-02-29', endDate: '0000-02-29' });
  for (const bad of ['02/29/2023', '02/30/2025', '13/01/2025', '00/10/2025', '01/05/2025 to 01/01/2025', '2025-01-01', 'TBD', '', undefined]) {
    assert.deepEqual(parseEventDates(bad), { startDate: null, endDate: null }, String(bad));
  }
});

test('parseEventDates keeps single-digit US dates and hyphen ranges', () => {
  assert.deepEqual(parseEventDates('3/1/2025'), { startDate: '2025-03-01', endDate: '2025-03-01' });
  for (const range of ['3/1/2025-3/2/2025', '3/1/2025 - 3/2/2025', '3/1/2025 – 3/2/2025']) {
    assert.deepEqual(parseEventDates(range), { startDate: '2025-03-01', endDate: '2025-03-02' }, range);
  }
  assert.deepEqual(parseEventDates('12/30/2024 - 1/2/2025'), { startDate: '2024-12-30', endDate: '2025-01-02' });
});

test('city region suffix is stripped only for the country (or matching State), never inferred', () => {
  const snapshot = structuredClone(REGION);
  const rids = (opts: Parameters<typeof filterSchedule>[1]): string[] =>
    filterSchedule(REGION, opts).hits.map((h) => h.objectID);
  assert.deepEqual(rids({ city: 'Sydney', country: 'AU' }), ['au']);
  assert.deepEqual(rids({ city: 'Sydney (NSW)', country: 'Australia' }), ['au']);
  assert.deepEqual(rids({ city: 'Sydney', country: 'GB' }), ['gb2']);
  assert.deepEqual(rids({ city: 'Sydney (NSW)', country: 'GB' }), ['gb']);
  // Exact full City across an unrecognized foreign suffix still matches its own row, never a bare one.
  assert.deepEqual(rids({ city: 'Sydney (NSW)' }), ['au', 'gb']);
  assert.deepEqual(rids({ city: 'London (ON)' }), ['lon']);
  assert.deepEqual(rids({ city: 'Toronto', country: 'CA' }), ['ca']);
  assert.deepEqual(rids({ city: 'Toronto (ON)', country: 'Canada' }), ['ca']);
  assert.deepEqual(rids({ city: 'Toronto' }), ['ca']);
  assert.deepEqual(rids({ city: 'Paris', country: 'FR' }), ['frs']);
  assert.deepEqual(rids({ city: 'Paris (TX)', country: 'FR' }), ['fr', 'frs']);
  assert.deepEqual(rids({ city: 'Paris (TX)' }), ['fr', 'frs']);
  assert.deepEqual(rids({ city: 'London', country: 'GB' }), []);
  assert.deepEqual(rids({ city: 'London (ON)', country: 'GB' }), ['lon']);
  // A region code of another country must not broaden to the bare city.
  assert.deepEqual(rids({ city: 'Sydney (ON)' }), []);
  assert.deepEqual(rids({ city: 'Toronto (NSW)' }), []);
  assert.deepEqual(REGION, snapshot);
  assert.deepEqual(ids({ city: 'Davenport', country: 'US' }), ['d1']);
  assert.deepEqual(ids({ city: 'Davenport (IA)', country: 'United States' }), ['d1']);
  assert.deepEqual(ids({ city: 'Davenport (IA)', country: 'Australia' }), []);
  assert.deepEqual(ids({ city: 'Paris (TX)' }), []);
});

test('State fallback applies to the query city too: exact full City and base city both match', () => {
  const iids = (opts: Parameters<typeof filterSchedule>[1]): string[] =>
    filterSchedule(IDF, opts).hits.map((h) => h.objectID);
  assert.deepEqual(iids({ city: 'Paris (IDF)', country: 'FR' }), ['idf']);
  assert.deepEqual(iids({ city: 'Paris (IDF)', country: 'France' }), ['idf']);
  assert.deepEqual(iids({ city: 'Paris (IDF)' }), ['idf']);
  assert.deepEqual(iids({ city: 'Paris', country: 'FR' }), ['idf', 'par']);
  assert.deepEqual(iids({ city: 'Paris' }), ['idf', 'par', 'tx']);
  assert.deepEqual(iids({ city: 'Paris (TX)' }), ['tx']);
  // Invalid cross-country region: no State/country rule strips it, so nothing broadens.
  assert.deepEqual(iids({ city: 'Paris (TX)', country: 'FR' }), []);
  assert.deepEqual(iids({ city: 'Paris (IDF)', country: 'US' }), []);
});

test('every fixture row is found by its own City and Country', () => {
  for (const rows of [HITS, REGION, IDF]) {
    for (const h of rows) {
      assert.ok(allIds(rows, { city: h.City, country: h.Country }).includes(h.objectID), h.objectID);
    }
  }
});

test('scheduleDigest is order-independent, tracks public data and does not mutate input', () => {
  const rows = SPECIFIC.slice(0, 5);
  const snapshot = structuredClone(rows);
  const digest = scheduleDigest(rows);
  assert.match(digest, /^[0-9a-f]{64}$/);
  assert.equal(scheduleDigest([...rows].reverse()), digest);
  assert.equal(scheduleDigest(structuredClone(rows)), digest);
  assert.deepEqual(rows, snapshot);
  const moved = rows.map((h, i) => (i === 0 ? { ...h, 'Event Date': '03/02/2025' } : h));
  assert.notEqual(scheduleDigest(moved), digest);
  assert.notEqual(scheduleDigest(rows.slice(1)), digest);
});

test('city filter is exact on City only, never Title', () => {
  assert.deepEqual(ids({ city: 'Paris' }), ['p2']);
  assert.deepEqual(ids({ city: '  paris ' }), ['p2']);
  assert.deepEqual(ids({ city: 'Azkaban' }), []);
  assert.deepEqual(ids({ city: 'Par' }), []);
  assert.deepEqual(ids({ city: 'Davenport' }), ['d1']);
  assert.deepEqual(ids({ city: 'Davenport (IA)' }), ['d1']);
});

test('country aliases and ISO codes resolve to the same country', () => {
  for (const c of ['UK', 'GB', 'United Kingdom', 'u.k.']) assert.deepEqual(ids({ country: c }), ['l1'], c);
  for (const c of ['AU', 'Australia']) assert.deepEqual(ids({ city: 'Sydney', country: c }), ['s1'], c);
  for (const c of ['FR', 'France']) assert.deepEqual(ids({ country: c }), ['p2'], c);
  assert.deepEqual(ids({ country: 'United States of America', city: 'San Francisco' }), ['p1']);
  assert.equal(filterSchedule(HITS, { country: 'US' }).total, 61 + 6);
  assert.equal(filterSchedule(HITS, { country: 'USA' }).total, 61 + 6);
});

test('accents, case and whitespace are normalized', () => {
  for (const c of ['Sao Paulo', 'SÃO   PAULO', 'são paulo']) assert.deepEqual(ids({ city: c, country: 'BR' }), ['sp'], c);
  assert.deepEqual(ids({ query: 'sao' }), ['sp']);
});

test('query is a literal normalized substring across public fields', () => {
  assert.deepEqual(ids({ query: 'paris' }), ['p1', 'p2']);
  assert.deepEqual(ids({ query: 'nye-24' }), ['r1']);
  assert.deepEqual(ids({ query: 'hall' }), ['r1']);
  assert.deepEqual(ids({ query: 'pariss' }), []);
});

test('unknown dates kept last without date filters, excluded with them; ranges overlap inclusively', () => {
  const all = filterSchedule(HITS, { pageSize: 60, page: 1 });
  assert.deepEqual(all.hits.map((h) => h.objectID).slice(-3), ['u1', 'u2', 'u3']);
  assert.equal(all.unknownDateCount, 3);
  const austin = { city: 'Austin' };
  assert.deepEqual(ids({ ...austin, dateFrom: '2025-01-01', dateTo: '2025-01-01' }), ['r1']);
  assert.deepEqual(ids({ ...austin, dateTo: '2024-12-30' }), ['r1']);
  assert.equal(filterSchedule(HITS, { ...austin, dateFrom: '2000-01-01' }).unknownDateCount, 0);
  assert.deepEqual(ids({ dateFrom: '2025-07-03', dateTo: '2025-07-03' }), ['sp']);
  assert.deepEqual(ids({ dateFrom: '2024-02-29', dateTo: '2024-02-29' }), ['d1']);
  assert.deepEqual(ids({ dateFrom: '2025-07-04', dateTo: '2025-12-31' }), []);
});

test('ISO date filters accept years 0000..0099 without 19xx remapping', () => {
  const early: EventHit[] = [
    { objectID: 'y99', Title: 'Early', City: 'Rome', Country: 'Italy', 'Event Date': '12/31/0099' },
    { objectID: 'y00', Title: 'Leap', City: 'Rome', Country: 'Italy', 'Event Date': '02/29/0000' },
  ];
  const earlyIds = (opts: Parameters<typeof filterSchedule>[1]): string[] =>
    filterSchedule(early, opts).hits.map((h) => h.objectID);
  assert.deepEqual(earlyIds({ dateFrom: '0099-12-31', dateTo: '0099-12-31' }), ['y99']);
  assert.deepEqual(earlyIds({ dateFrom: '0000-02-29', dateTo: '0000-02-29' }), ['y00']);
  assert.throws(() => filterSchedule(early, { dateFrom: '0099-02-29' }));
});

test('71 fixture rows: pages cover all in sorted order without mutation', () => {
  assert.equal(HITS.length, 71);
  const snapshot = structuredClone(HITS);
  const seen: EventHit[] = [];
  for (let page = 0; ; page++) {
    const r = filterSchedule(HITS, { page, pageSize: 7 });
    assert.equal(r.total, 71);
    seen.push(...r.hits);
    if (!r.hasMore) break;
  }
  assert.equal(seen.length, 71);
  assert.equal(new Set(seen).size, 71);
  for (const h of seen) assert.ok(HITS.includes(h), 'returns original objects');
  assert.deepEqual(seen.slice(0, 7).map((h) => h.objectID), ['d1', 'r1', 'p1', 'p2', 'l1', 's1', 'sp']);
  // January 2026 rows: days 1, 5, 9, 13, 21, 25
  assert.deepEqual(seen.slice(7, 13).map((h) => h.objectID), ['g00', 'g60', 'g36', 'g12', 'g48', 'g24']);
  assert.deepEqual(HITS, snapshot);
  assert.equal(filterSchedule(HITS, {}).hits.length, 20);
  assert.deepEqual(filterSchedule(HITS, { page: 99 }), { hits: [], total: 71, page: 99, pageSize: 20, hasMore: false, unknownDateCount: 3 });
});

test('invalid options throw', () => {
  const bad: unknown[] = [
    { page: -1 }, { page: 1.5 }, { page: NaN }, { page: Infinity }, { page: '1' },
    { pageSize: 0 }, { pageSize: 61 }, { pageSize: 2.5 }, { pageSize: NaN }, { pageSize: -5 },
    { dateFrom: '2025-02-30' }, { dateFrom: '2023-02-29' }, { dateTo: '2025-1-01' }, { dateTo: '01/01/2025' },
    { dateFrom: '2025-02-01', dateTo: '2025-01-01' }, { query: 5 }, { city: null }, { country: {} },
  ];
  for (const opts of bad) assert.throws(() => filterSchedule(HITS, opts as never), JSON.stringify(opts));
  assert.doesNotThrow(() => filterSchedule(HITS, { page: 0, pageSize: 60, dateFrom: '2024-02-29', dateTo: '2024-02-29' }));
});
