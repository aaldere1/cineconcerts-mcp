/**
 * Complete, bounded read of the public event index via ordinary search
 * pagination (not the privileged browse endpoint).
 *
 * Every page is checked against the first page's metadata; anything that
 * could mean a partial read is rejected rather than returned, so callers can
 * treat a successful result as the whole published inventory.
 */

export const INVENTORY_PAGE_SIZE = 100;
export const INVENTORY_MAX_PAGES = 10;
export const INVENTORY_MAX_ROWS = INVENTORY_PAGE_SIZE * INVENTORY_MAX_PAGES;

export interface InventoryPage<T> {
  hits: T[];
  nbHits?: number;
  nbPages?: number;
  page?: number;
  hitsPerPage?: number;
  exhaustiveNbHits?: boolean;
  exhaustive?: { nbHits?: boolean };
}

export interface CompleteInventory<T> {
  hits: T[];
  fetchedAt: string;
  sourceTotal: number;
  coverage: "complete";
}

export class InventoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryError";
  }
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function checkPage<T>(res: InventoryPage<T>, requested: number): void {
  if (!res || typeof res !== "object" || !Array.isArray(res.hits)) {
    throw new InventoryError(`Page ${requested}: missing hits.`);
  }
  if (!isCount(res.nbHits) || !isCount(res.nbPages) || !isCount(res.page) || !isCount(res.hitsPerPage)) {
    throw new InventoryError(`Page ${requested}: missing or malformed pagination metadata.`);
  }
  if (res.page !== requested) {
    throw new InventoryError(`Page ${requested}: response reported page ${res.page}.`);
  }
  if (res.hitsPerPage !== INVENTORY_PAGE_SIZE) {
    throw new InventoryError(`Page ${requested}: hitsPerPage ${res.hitsPerPage} != ${INVENTORY_PAGE_SIZE}.`);
  }
  const flags = [res.exhaustive?.nbHits, res.exhaustiveNbHits].filter((f) => f !== undefined);
  if (!flags.length || flags.some((f) => f !== true)) {
    throw new InventoryError(`Page ${requested}: hit count is not exhaustive.`);
  }
}

export async function loadCompleteInventory<T extends { objectID: string }>(
  fetchPage: (page: number) => Promise<InventoryPage<T>>
): Promise<CompleteInventory<T>> {
  const first = await fetchPage(0);
  checkPage(first, 0);
  const nbHits = first.nbHits as number;
  const nbPages = first.nbPages as number;

  if (nbHits > INVENTORY_MAX_ROWS) {
    throw new InventoryError(`Inventory of ${nbHits} rows exceeds cap of ${INVENTORY_MAX_ROWS}.`);
  }
  const expectedPages = Math.ceil(nbHits / INVENTORY_PAGE_SIZE);
  if (nbPages !== expectedPages && !(nbHits === 0 && nbPages <= 1)) {
    throw new InventoryError(`nbPages ${nbPages} inconsistent with nbHits ${nbHits}.`);
  }

  const hits: T[] = [];
  const seen = new Set<string>();
  const pageCount = Math.max(expectedPages, 1);

  for (let page = 0; page < pageCount; page++) {
    const res = page === 0 ? first : await fetchPage(page);
    if (page > 0) checkPage(res, page);
    if (res.nbHits !== nbHits || res.nbPages !== nbPages) {
      throw new InventoryError(`Page ${page}: total or page count changed during read.`);
    }
    const expectedRows = Math.min(INVENTORY_PAGE_SIZE, nbHits - page * INVENTORY_PAGE_SIZE);
    if (res.hits.length !== expectedRows) {
      throw new InventoryError(`Page ${page}: got ${res.hits.length} rows, expected ${expectedRows}.`);
    }
    for (const hit of res.hits) {
      const id = (hit as { objectID?: unknown } | null)?.objectID;
      if (typeof id !== "string" || !id.trim()) {
        throw new InventoryError(`Page ${page}: malformed objectID.`);
      }
      if (seen.has(id)) {
        throw new InventoryError(`Page ${page}: duplicate objectID ${id}.`);
      }
      seen.add(id);
      hits.push(hit);
    }
  }

  if (hits.length !== nbHits) {
    throw new InventoryError(`Read ${hits.length} rows, expected ${nbHits}.`);
  }

  return {
    hits,
    fetchedAt: new Date().toISOString(),
    sourceTotal: hits.length,
    coverage: "complete",
  };
}
