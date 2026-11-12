import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadCompleteInventory,
  InventoryError,
  type InventoryPage,
} from "../src/services/inventory.js";

type Hit = { objectID: string; Title?: string };

function rows(n: number, prefix = "e"): Hit[] {
  return Array.from({ length: n }, (_, i) => ({ objectID: `${prefix}${i}`, Title: `Show ${i}` }));
}

/** Slices `all` into well-formed 100-row pages; `tweak` may corrupt a page. */
function fakePages(
  all: Hit[],
  tweak: (page: number, res: InventoryPage<Hit>) => InventoryPage<Hit> = (_, r) => r
) {
  const calls: number[] = [];
  const fetchPage = async (page: number) => {
    calls.push(page);
    const res: InventoryPage<Hit> = {
      hits: all.slice(page * 100, page * 100 + 100),
      nbHits: all.length,
      nbPages: Math.ceil(all.length / 100),
      page,
      hitsPerPage: 100,
      exhaustiveNbHits: true,
      exhaustive: { nbHits: true },
    };
    return tweak(page, res);
  };
  return { fetchPage, calls };
}

test("reads 135 rows across two pages as complete", async () => {
  const { fetchPage, calls } = fakePages(rows(135));
  const result = await loadCompleteInventory(fetchPage);
  assert.equal(result.hits.length, 135);
  assert.equal(result.sourceTotal, 135);
  assert.equal(result.coverage, "complete");
  assert.deepEqual(calls, [0, 1]);
  assert.ok(!Number.isNaN(Date.parse(result.fetchedAt)));
});

test("empty index with nbPages 0 or 1 is complete with zero rows", async () => {
  for (const nbPages of [0, 1]) {
    const { fetchPage } = fakePages([], (_, r) => ({ ...r, nbPages }));
    const result = await loadCompleteInventory(fetchPage);
    assert.equal(result.sourceTotal, 0);
    assert.equal(result.coverage, "complete");
  }
});

test("exactly 1000 rows is allowed", async () => {
  const { fetchPage, calls } = fakePages(rows(1000));
  const result = await loadCompleteInventory(fetchPage);
  assert.equal(result.sourceTotal, 1000);
  assert.equal(calls.length, 10);
});

const rejects: Array<[string, Hit[], Parameters<typeof fakePages>[1]]> = [
  ["duplicate objectID across pages", rows(135), (p, r) =>
    p === 1 ? { ...r, hits: [{ objectID: "e0" }, ...r.hits.slice(1)] } : r],
  ["malformed objectID", rows(5), (_, r) =>
    ({ ...r, hits: [{ objectID: "" }, ...r.hits.slice(1)] })],
  ["non-string objectID", rows(5), (_, r) =>
    ({ ...r, hits: [{ objectID: 7 as unknown as string }, ...r.hits.slice(1)] })],
  ["exhaustive.nbHits false", rows(135), (_, r) => ({ ...r, exhaustive: { nbHits: false } })],
  ["exhaustiveNbHits false", rows(135), (p, r) => (p === 1 ? { ...r, exhaustiveNbHits: false } : r)],
  ["no exhaustive flags", rows(5), (_, r) => ({ ...r, exhaustive: undefined, exhaustiveNbHits: undefined })],
  ["oversized inventory", rows(1001), (_, r) => r],
  ["nbHits changes between pages", rows(135), (p, r) => (p === 1 ? { ...r, nbHits: 136 } : r)],
  ["nbPages inconsistent with nbHits", rows(135), (_, r) => ({ ...r, nbPages: 1 })],
  ["sparse middle page", rows(250), (p, r) => (p === 1 ? { ...r, hits: r.hits.slice(0, 99) } : r)],
  ["short last page", rows(135), (p, r) => (p === 1 ? { ...r, hits: r.hits.slice(0, 30) } : r)],
  ["extra rows on empty index", [], (_, r) => ({ ...r, hits: rows(1) })],
  ["page index mismatch", rows(135), (p, r) => (p === 1 ? { ...r, page: 0 } : r)],
  ["hitsPerPage mismatch", rows(135), (_, r) => ({ ...r, hitsPerPage: 20 })],
  ["missing nbHits", rows(5), (_, r) => ({ ...r, nbHits: undefined })],
  ["non-integer nbPages", rows(5), (_, r) => ({ ...r, nbPages: 1.5 })],
  ["missing hits array", rows(5), (_, r) => ({ ...r, hits: undefined as unknown as Hit[] })],
];

for (const [name, all, tweak] of rejects) {
  test(`rejects: ${name}`, async () => {
    const { fetchPage } = fakePages(all, tweak);
    await assert.rejects(loadCompleteInventory(fetchPage), InventoryError);
  });
}

test("propagates fetch failures instead of returning partial results", async () => {
  const { fetchPage } = fakePages(rows(135), (p, r) => {
    if (p === 1) throw new Error("network");
    return r;
  });
  await assert.rejects(loadCompleteInventory(fetchPage), /network/);
});
