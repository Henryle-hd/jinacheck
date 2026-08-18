/**
 * POST /api/search — the smart-search orchestrator.
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

import { NextResponse } from "next/server";

import { probeMany } from "@/lib/brela";
import { withCache } from "@/lib/cache";
import { parseName, probeSet, probeTerms } from "@/lib/name";
import { checkName } from "@/lib/rules";
import { buildProposal, buildVerdict, scoreEntity } from "@/lib/score";
import type { Entity, ObjectType, ScoredEntity, SearchResponse, SearchScope } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Depth presets, in records per probe term. */
const DEPTH = { quick: 250, standard: 750, deep: 2000 } as const;
type DepthKey = keyof typeof DEPTH;

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

export async function POST(request: Request) {
  const started = Date.now();

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(payload.name ?? "").trim();
  const number = String(payload.number ?? "").trim();
  const scope: SearchScope =
    payload.scope === "ET-BUSINESS" || payload.scope === "ET-COMPANY" ? payload.scope : "all";
  const depthKey: DepthKey =
    payload.depth === "quick" || payload.depth === "deep" ? payload.depth : "standard";

  if (!name && !number) {
    return NextResponse.json(
      { error: "Enter a name to check, or a registration number to look up." },
      { status: 400 },
    );
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
    return NextResponse.json(
      {
        error:
          "That name has no searchable term of 3 or more characters. The public register cannot be queried on shorter fragments.",
      },
      { status: 422 },
    );
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
  const cacheKey = `search:${scope}:${depthKey}:${terms.join("+")}:${isNumberLookup ? "num" : "name"}`;

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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "The register could not be reached." },
      { status: 502 },
    );
  }

  // If every probe failed, surface that rather than an empty "looks available".
  const allFailed = reports.length > 0 && reports.every((r) => r.error);
  if (allFailed && !pool.length) {
    return NextResponse.json(
      {
        error: reports[0].error ?? "The register could not be searched right now.",
        probes: reports,
      },
      { status: 502 },
    );
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
      ignored: [...parts.legal, ...parts.generic],
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

  return NextResponse.json(response, {
    headers: { "Cache-Control": "no-store" },
  });
}
