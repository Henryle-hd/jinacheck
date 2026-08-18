/**
 * GET /check/v1 — the public API.
 *
 * Read only and keyed off the query string, so a check is a plain URL you can
 * paste into a browser, a shell or a cron job. It runs the same pipeline as the
 * site: same distinctive-core extraction, same homophone probes, same scores.
 *
 * Open to any origin. The data is BRELA's public register, and there is nothing
 * here worth protecting behind a key.
 */

import { NextResponse } from "next/server";

import { cacheGet } from "@/lib/cache";
import { persistSearch } from "@/lib/persist";
import { checkRate } from "@/lib/rate-limit";
import { readRequestMeta } from "@/lib/request-meta";
import { searchCacheKey } from "@/lib/search-key";
import { runSearch } from "@/lib/search-service";
import type { DepthKey } from "@/lib/search-key";
import type { SearchScope } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

/** `company` / `business` read better in a URL than the register's own codes. */
function readScope(raw: string | null): SearchScope {
  if (raw === "company" || raw === "ET-COMPANY") return "ET-COMPANY";
  if (raw === "business" || raw === "ET-BUSINESS") return "ET-BUSINESS";
  return "all";
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const depth = params.get("depth");

  const input = {
    name: params.get("name") ?? params.get("q") ?? "",
    number: params.get("number") ?? "",
    scope: readScope(params.get("scope")),
    depth: (depth === "quick" || depth === "deep" ? depth : "standard") as DepthKey,
  };

  // Only throttle searches that would actually reach BRELA. Cached ones are
  // free to serve and are what a well behaved integration mostly hits.
  const { key } = searchCacheKey(input);
  if (cacheGet(key) === undefined) {
    const meta = readRequestMeta(request.headers);
    const who =
      meta.visitorHash ??
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
      "anonymous";
    const rate = await checkRate(`api:${who}`);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Rate limit reached. Try again shortly." },
        {
          status: 429,
          headers: { ...CORS, "Retry-After": String(rate.retryAfterSec) },
        },
      );
    }
  }

  const outcome = await runSearch(input);

  if (!outcome.ok) {
    return NextResponse.json(
      { error: outcome.error },
      { status: outcome.status, headers: CORS },
    );
  }

  persistSearch(request.headers, outcome.response, "api");

  const { response } = outcome;
  return NextResponse.json(
    {
      query: response.query,
      verdict: response.verdict,
      flags: response.flags,
      results: response.results,
      facets: response.facets,
      meta: {
        pool: response.meta.pool,
        truncated: response.meta.truncated,
        fetchedAt: response.meta.fetchedAt,
      },
    },
    {
      headers: {
        ...CORS,
        // Short shared cache: the register changes by the day, not the second.
        "Cache-Control": "public, max-age=0, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
