/**
 * POST /api/search
 *
 * What the site itself calls. The public, documented entry point is GET
 * /check/v1; this one exists so the app can post a body and is not versioned.
 */

import { NextResponse } from "next/server";

import { persistSearch } from "@/lib/persist";
import { runSearch } from "@/lib/search-service";
import type { SearchScope } from "@/lib/types";
import type { DepthKey } from "@/lib/search-key";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const outcome = await runSearch({
    name: String(payload.name ?? ""),
    number: String(payload.number ?? ""),
    scope:
      payload.scope === "ET-BUSINESS" || payload.scope === "ET-COMPANY"
        ? (payload.scope as SearchScope)
        : "all",
    depth:
      payload.depth === "quick" || payload.depth === "deep"
        ? (payload.depth as DepthKey)
        : "standard",
  });

  if (!outcome.ok) {
    return NextResponse.json({ error: outcome.error }, { status: outcome.status });
  }

  persistSearch(request, outcome.response, "user");

  return NextResponse.json(outcome.response, {
    headers: { "Cache-Control": "no-store" },
  });
}
