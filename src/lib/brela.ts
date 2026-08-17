/**
 * Client for the BRELA ORS public register search.
 *
 * Upstream quirks this module absorbs, all confirmed against the live endpoint:
 *
 *  - The payload is columnar: `Map` holds column names, `Records` holds arrays.
 *    We map it to objects by name, so a column re-ordering upstream can't
 *    silently shift our fields.
 *  - There is a fixed ~15s cost per call, largely independent of page size
 *    (50 rows ≈ 15.6s, 200 rows ≈ 20.8s). So the winning strategy is *few, big,
 *    parallel* pages — not many small ones.
 *  - Paging is stable and non-overlapping, so parallel page fetches are safe.
 *  - Terms shorter than 3 characters make the upstream SQL time out and return
 *    `{ error: "Execution Timeout Expired...", sign: "JsonErrorHandler" }`
 *    with HTTP 200, so errors must be detected in the body, not the status.
 *  - `address` is a comma-delimited string, region first:
 *    "Dar Es Salaam, Kinondoni, Msasani, 14111, <street detail>".
 */

import type {
  BrelaErrorResponse,
  BrelaRawResponse,
  Entity,
  Location,
  ObjectType,
  ProbeReport,
} from "./types";

const ENDPOINT = "https://ors.brela.go.tz/orsreg/list/search/businesspublic.json";

/** Rows per upstream page. Big, because the cost is per-call, not per-row. */
export const PAGE_SIZE = 250;
/** Hard ceiling on pages fetched per probe term, to bound worst-case latency. */
const MAX_PAGES = 8;
/** How many page requests we allow in flight at once. */
const CONCURRENCY = 4;
const REQUEST_TIMEOUT_MS = 75_000;

class BrelaError extends Error {
  constructor(message: string, readonly upstream = true) {
    super(message);
    this.name = "BrelaError";
  }
}

function isErrorPayload(body: unknown): body is BrelaErrorResponse {
  return !!body && typeof body === "object" && "error" in body;
}

function buildBody(
  term: string,
  objectType: ObjectType,
  page: number,
  pageSize: number,
  isNumber: boolean,
) {
  const base = { object_type: objectType, PageSize: pageSize, PageNumber: page };
  if (objectType === "ET-COMPANY") {
    return isNumber ? { ...base, cm_number: term } : { ...base, cm_name: term };
  }
  return isNumber ? { ...base, bn_number: term } : { ...base, bn_name: term };
}

async function postOnce(
  term: string,
  objectType: ObjectType,
  page: number,
  pageSize: number,
  isNumber: boolean,
): Promise<BrelaRawResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Referer: "https://ors.brela.go.tz/",
        Origin: "https://ors.brela.go.tz",
      },
      body: JSON.stringify(buildBody(term, objectType, page, pageSize, isNumber)),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      throw new BrelaError(`Register responded with HTTP ${res.status}`);
    }

    const body: unknown = await res.json();

    // Upstream reports failure with HTTP 200 and an { error } body.
    if (isErrorPayload(body)) {
      const msg = String(body.error);
      if (/timeout/i.test(msg)) {
        throw new BrelaError(
          "The register timed out on that term. Very short or very common terms overload it — try a longer, more distinctive word.",
        );
      }
      throw new BrelaError(msg);
    }

    const raw = body as BrelaRawResponse;
    if (!raw || !Array.isArray(raw.Map) || !Array.isArray(raw.Records)) {
      throw new BrelaError("Unexpected response shape from the register");
    }
    return raw;
  } catch (err) {
    if (err instanceof BrelaError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new BrelaError("The register did not respond in time. It is often slow — try again.");
    }
    throw new BrelaError(
      err instanceof Error ? err.message : "Could not reach the register",
      false,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** One retry, because the upstream drops requests under load fairly often. */
async function post(
  term: string,
  objectType: ObjectType,
  page: number,
  pageSize: number,
  isNumber: boolean,
): Promise<BrelaRawResponse> {
  try {
    return await postOnce(term, objectType, page, pageSize, isNumber);
  } catch (err) {
    if (err instanceof BrelaError && /timed out on that term|overload/i.test(err.message)) throw err;
    return postOnce(term, objectType, page, pageSize, isNumber);
  }
}

/** Split "Region, District, Ward, 12345, street detail" into parts. */
export function parseAddress(address: string | null): Location {
  const empty: Location = {
    region: null,
    district: null,
    ward: null,
    postcode: null,
    street: null,
  };
  if (!address) return empty;

  const segments = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (!segments.length) return empty;

  const postcodeIndex = segments.findIndex((s) => /^\d{4,5}$/.test(s));
  const [region, district, ward] = segments;

  return {
    region: region ?? null,
    district: district ?? null,
    // Only treat segment 3 as a ward when a postcode follows it; business-name
    // addresses are free text and often have no structure at all.
    ward: postcodeIndex === 3 ? (ward ?? null) : (postcodeIndex > 0 ? (ward ?? null) : null),
    postcode: postcodeIndex >= 0 ? segments[postcodeIndex] : null,
    street:
      postcodeIndex >= 0
        ? segments.slice(postcodeIndex + 1).join(", ") || null
        : segments.slice(1).join(", ") || null,
  };
}

function yearOf(...dates: Array<string | null>): number | null {
  for (const d of dates) {
    if (!d) continue;
    const y = Number(String(d).slice(0, 4));
    if (Number.isFinite(y) && y > 1900 && y < 2200) return y;
  }
  return null;
}

/** Map the columnar payload into typed entities, keyed by column name. */
export function normalizeRecords(raw: BrelaRawResponse): Entity[] {
  const idx: Record<string, number> = {};
  raw.Map.forEach((col, i) => {
    idx[col] = i;
  });

  const get = (row: unknown[], col: string): unknown =>
    idx[col] === undefined ? null : row[idx[col]];
  const str = (row: unknown[], col: string): string | null => {
    const v = get(row, col);
    return v === null || v === undefined ? null : String(v);
  };

  const out: Entity[] = [];
  for (const row of raw.Records) {
    const name = str(row, "legal_name");
    if (!name) continue;

    const address = str(row, "address");
    const regDate = str(row, "reg_date");
    const incorporationDate = str(row, "incorporation_date");
    const rawId = Number(get(row, "id"));
    const id = Number.isFinite(rawId) ? rawId : out.length;
    const objectType = (str(row, "object_type") as ObjectType) ?? "ET-COMPANY";

    out.push({
      id,
      uid: `${objectType}:${id}`,
      trackingNo: str(row, "last_change_tracking_no"),
      certNumber: str(row, "cert_number"),
      regDate,
      incorporationDate,
      name: name.trim().replace(/\s+/g, " "),
      subtype: str(row, "subtype_name")?.trim() ?? null,
      subtypeCode: str(row, "company_subtype"),
      objectType,
      baCategory: str(row, "ba_category"),
      statusCode: str(row, "reg_status"),
      status: str(row, "reg_status_name"),
      address,
      cessDate: str(row, "cess_date"),
      updateDate: str(row, "update_date"),
      hasCharges: Number(get(row, "has_charges")) > 0,
      location: parseAddress(address),
      year: yearOf(regDate, incorporationDate),
    });
  }
  return out;
}

export interface ProbeResult {
  entities: Entity[];
  report: ProbeReport;
}

/**
 * Fetch up to `limit` records for one search term.
 *
 * Page 1 tells us the true total; the remaining pages are then fanned out in
 * parallel (bounded by CONCURRENCY) rather than walked one at a time, which is
 * the difference between ~20s and over a minute for a deep pull.
 */
export async function probe(
  term: string,
  objectType: ObjectType,
  limit: number,
  isNumber = false,
): Promise<ProbeResult> {
  const started = Date.now();
  const pageSize = Math.min(PAGE_SIZE, Math.max(25, limit));

  try {
    const first = await post(term, objectType, 1, pageSize, isNumber);
    const total = Number(first.TotalRecordCount) || 0;
    const entities = normalizeRecords(first);

    const wanted = Math.min(limit, total);
    const pagesNeeded = Math.min(MAX_PAGES, Math.ceil(wanted / pageSize));

    if (pagesNeeded > 1) {
      const pages: number[] = [];
      for (let p = 2; p <= pagesNeeded; p++) pages.push(p);

      // bounded-concurrency worker pool over the remaining page numbers
      const collected: Entity[][] = [];
      let cursor = 0;
      const workers = Array.from({ length: Math.min(CONCURRENCY, pages.length) }, async () => {
        while (cursor < pages.length) {
          const page = pages[cursor++];
          try {
            collected.push(normalizeRecords(await post(term, objectType, page, pageSize, isNumber)));
          } catch {
            // A single dropped page shouldn't sink the whole search; we report
            // the shortfall via `truncated` instead.
          }
        }
      });
      await Promise.all(workers);
      for (const chunk of collected) entities.push(...chunk);
    }

    return {
      entities,
      report: {
        term,
        matched: entities.length,
        total,
        pages: pagesNeeded,
        ms: Date.now() - started,
        truncated: total > entities.length,
      },
    };
  } catch (err) {
    return {
      entities: [],
      report: {
        term,
        matched: 0,
        total: 0,
        pages: 0,
        ms: Date.now() - started,
        truncated: false,
        error: err instanceof Error ? err.message : "Search failed",
      },
    };
  }
}

/**
 * Probe several terms at once and merge them into one de-duplicated pool.
 *
 * Probing multiple distinctive tokens is the core trick: the public search only
 * does substring matching, so "NIKA GROUP LIMITED" as a single query finds
 * nothing, while probing NIKA (and GROUP's siblings) finds the real conflicts.
 */
export async function probeMany(
  terms: string[],
  objectType: ObjectType,
  limitPerTerm: number,
  isNumber = false,
): Promise<{ entities: Entity[]; reports: ProbeReport[] }> {
  const results = await Promise.all(
    terms.map((t) => probe(t, objectType, limitPerTerm, isNumber)),
  );

  // Keyed on uid, not id: the two registers number their rows independently, so
  // an id-only key would drop business-name entries that happen to share an id
  // with a company.
  const byUid = new Map<string, Entity>();
  const seenNames = new Set<string>();
  for (const r of results) {
    for (const e of r.entities) {
      if (byUid.has(e.uid)) continue;
      // Guard against the same record arriving under different ids.
      const nameKey = `${e.objectType}|${e.name.toUpperCase()}|${e.certNumber ?? ""}`;
      if (seenNames.has(nameKey)) continue;
      seenNames.add(nameKey);
      byUid.set(e.uid, e);
    }
  }

  return { entities: [...byUid.values()], reports: results.map((r) => r.report) };
}

export { BrelaError };
