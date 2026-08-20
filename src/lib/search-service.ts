/**
 * The search pipeline.
 *
 * Pipeline:
 *   1. Parse the proposed name into legal / generic / distinctive parts.
 *   2. Run the statutory naming checks on the name itself.
 *   3. Probe the public register on the *distinctive* tokens, in parallel,
 *      pulling a deliberately large pool so the facets and filters are computed
 *      over real data rather than the first page.
 *   4. Score every candidate for conflict risk and sort by it.
 *   5. Build facets + an overall verdict.
 *
 * Filtering and sorting deliberately happen client-side over this pool, so
 * changing a filter is instant instead of re-paying the register's ~15s cost.
 */

import { probeMany } from "@/lib/brela";
import { withCache } from "@/lib/cache";
import { parseName, probeSet, probeTerms } from "@/lib/name";
import { searchCacheKey, type DepthKey } from "@/lib/search-key";
import { checkName } from "@/lib/rules";
import { buildProposal, buildVerdict, scoreEntity } from "@/lib/score";
import type { Entity, ObjectType, ScoredEntity, SearchResponse, SearchScope } from "@/lib/types";

/** Depth presets, in records per probe term. */
const DEPTH = { quick: 250, standard: 750, deep: 2000 } as const;

/**
 * Upstream request budget per depth. The register is slow and fragile, so the
 * budget is spread across however many terms we probe rather than multiplied
 * by them.
 */
const REQUEST_BUDGET: Record<DepthKey, number> = { quick: 5, standard: 10, deep: 18 };
const PAGE_SIZE = 250;

function countFacet<T extends string | number>(
  items: Array<T | null | undefined>,
): Array<{ value: T; count: number }> {
  const counts = new Map<T, number>();
  for (const item of items) {
    if (item === null || item === undefined || item === "") continue;
    counts.set(item, (counts.get(item) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || String(a.value).localeCompare(String(b.value)));
}

/** Either a finished answer, or a reason it could not be produced. */
export type SearchOutcome =
  | { ok: true; response: SearchResponse }
  | { ok: false; status: number; error: string };

export interface SearchInput {
  name: string;
  number?: string;
  scope: SearchScope;
  depth: DepthKey;
}

/**
 * The whole pipeline, independent of how it was called.
 *
 * Both the app and the public API run this exact function, so a developer
 * hitting /check/v1 gets the same cores, the same homophone probes and the same
 * scores as somebody typing into the site.
 */
export async function runSearch(input: SearchInput): Promise<SearchOutcome> {
  const started = Date.now();

  const name = input.name.trim();
  const number = (input.number ?? "").trim();
  const scope = input.scope;
  const depthKey = input.depth;

  if (!name && !number) {
    return { ok: false, status: 400, error: "Enter a name to check, or a registration number to look up." };
  }

  const parts = parseName(name);
  // A bare number lookup isn't a registrability question, so the naming rules
  // don't apply to it.
  const flags = name ? checkName(name, scope) : [];

  // A number lookup is an exact query; a name check needs the token probes.
  const isNumberLookup = !name && !!number;
  const primaryTerms = isNumberLookup ? [number] : probeTerms(name, 3);
  const terms = isNumberLookup ? [number] : probeSet(name);
  const variants = terms.filter((t) => !primaryTerms.includes(t));

  if (!terms.length) {
    return {
      ok: false,
      status: 422,
      error:
        "That name has no searchable term of 3 or more characters. The public register cannot be queried on shorter fragments.",
    };
  }

  // Share the request budget across the terms we're probing.
  const pagesPerTerm = Math.max(1, Math.floor(REQUEST_BUDGET[depthKey] / terms.length));
  const perTermLimit = Math.min(DEPTH[depthKey], pagesPerTerm * PAGE_SIZE);

  // BRELA splits the register in two and its own public search makes you pick
  // one, which is how a live business name like "QUICKLEE DIGITAL EXPERIENCES"
  // stays invisible to anyone checking as a company. So "all" is the default and
  // covers both; narrowing is an explicit choice.
  const REGISTERS: ObjectType[] =
    scope === "all" ? ["ET-COMPANY", "ET-BUSINESS"] : [scope];
  const { key: cacheKey } = searchCacheKey({ name, number, scope, depth: depthKey });

  let pool: Entity[];
  let reports: SearchResponse["meta"]["probes"];
  let cached: boolean;

  try {
    const result = await withCache(cacheKey, async () => {
      const perRegister = await Promise.all(
        REGISTERS.map((register) => probeMany(terms, register, perTermLimit, isNumberLookup)),
      );
      return {
        entities: perRegister.flatMap((r) => r.entities),
        reports: perRegister.flatMap((r, i) =>
          r.reports.map((rep) => ({ ...rep, register: REGISTERS[i] })),
        ),
      };
    });
    pool = result.value.entities;
    reports = result.value.reports;
    cached = result.cached;
  } catch (err) {
    return {
      ok: false,
      status: 502,
      error: err instanceof Error ? err.message : "The register could not be reached.",
    };
  }

  // If every probe failed, surface that rather than an empty "looks available".
  const allFailed = reports.length > 0 && reports.every((r) => r.error);
  if (allFailed && !pool.length) {
    return {
      ok: false,
      status: 502,
      error: reports[0].error ?? "The register could not be searched right now.",
    };
  }

  const proposal = buildProposal(name || number);
  const results: ScoredEntity[] = isNumberLookup
    ? pool.map((e) => ({
        ...e,
        score: 0,
        band: "clear" as const,
        kind: "weak" as const,
        reasons: ["Matched by registration number"],
        core: parseName(e.name).core,
      }))
    : pool
        .map((e) => scoreEntity(e, proposal))
        .sort(
          (a, b) =>
            b.score - a.score ||
            a.name.length - b.name.length ||
            a.name.localeCompare(b.name),
        );

  const hasBlocker = flags.some((f) => f.severity === "blocker");
  const verdict = isNumberLookup
    ? {
        band: "clear" as const,
        headline: results.length ? "Record found" : "No record",
        summary: results.length
          ? `Registration number ${number} matches ${results.length} entr${results.length === 1 ? "y" : "ies"}.`
          : `Nothing on the register matches number ${number}.`,
        topScore: 0,
        identicalCount: 0,
        highRiskCount: 0,
      }
    : buildVerdict(results, proposal, hasBlocker);

  const districtCounts = new Map<string, { count: number; region: string | null }>();
  for (const r of results) {
    const d = r.location.district;
    if (!d) continue;
    const existing = districtCounts.get(d);
    if (existing) existing.count++;
    else districtCounts.set(d, { count: 1, region: r.location.region });
  }

  const response: SearchResponse = {
    query: {
      name,
      number: number || undefined,
      scope,
      core: parts.core,
      tokens: terms,
      variants,
      ignored: parts.legal,
      lightweight: parts.generic,
    },
    verdict,
    flags,
    results,
    facets: {
      regions: countFacet(results.map((r) => r.location.region)),
      districts: [...districtCounts.entries()]
        .map(([value, meta]) => ({ value, count: meta.count, region: meta.region }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value)),
      statuses: countFacet(results.map((r) => r.status)),
      subtypes: countFacet(results.map((r) => r.subtype)),
      years: countFacet(results.map((r) => r.year)).sort(
        (a, b) => Number(b.value) - Number(a.value),
      ),
      registers: countFacet(results.map((r) => r.objectType)),
    },
    meta: {
      pool: results.length,
      probes: reports,
      truncated: reports.some((r) => r.truncated),
      ms: Date.now() - started,
      cached,
      fetchedAt: new Date().toISOString(),
    },
  };

  return { ok: true, response };
}
