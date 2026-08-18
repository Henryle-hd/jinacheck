"use server";

import { headers } from "next/headers";

import { cacheGet } from "@/lib/cache";
import { isSameOrigin, verifyToken } from "@/lib/guard";
import { persistSearch } from "@/lib/persist";
import { checkRate } from "@/lib/rate-limit";
import { readRequestMeta } from "@/lib/request-meta";
import { searchCacheKey, type DepthKey } from "@/lib/search-key";
import { runSearch } from "@/lib/search-service";
import type { SearchResponse, SearchScope } from "@/lib/types";

/**
 * The app's search path.
 *
 * A Server Action rather than a route handler: there is no stable public URL to
 * point a script at, the action id changes with every build, and Next enforces
 * same origin on the POST itself. That removes the documented JSON endpoint
 * that used to sit at /api/search.
 *
 * Guards, cheapest first:
 *   1. same origin, so another site's page cannot call it;
 *   2. a signed token minted when the page rendered, which expires;
 *   3. a rate limit, but only on searches that would actually reach BRELA.
 */

export interface ActionInput {
  name: string;
  scope: SearchScope;
  depth: DepthKey;
  token: string;
}

export type ActionResult =
  | { ok: true; response: SearchResponse }
  | { ok: false; error: string; retryAfterSec?: number };

export async function searchAction(input: ActionInput): Promise<ActionResult> {
  const h = await headers();

  if (!isSameOrigin(h)) {
    return { ok: false, error: "This search can only be run from the site itself." };
  }

  if (!verifyToken(input.token)) {
    return { ok: false, error: "This page has been open a while. Reload it and try again." };
  }

  const name = input.name.trim();
  const scope: SearchScope =
    input.scope === "ET-COMPANY" || input.scope === "ET-BUSINESS" ? input.scope : "all";
  const depth: DepthKey =
    input.depth === "quick" || input.depth === "deep" ? input.depth : "standard";

  /**
   * Cached searches skip the limiter entirely. They cost nothing upstream, so
   * counting them would throttle ordinary browsing while leaving the expensive
   * path just as open.
   */
  const { key } = searchCacheKey({ name, scope, depth });
  const alreadyHave = cacheGet(key) !== undefined;

  if (!alreadyHave) {
    const meta = readRequestMeta(h);
    const who =
      meta.visitorHash ?? h.get("x-forwarded-for")?.split(",")[0].trim() ?? "anonymous";
    const rate = await checkRate(`search:${who}`);
    if (!rate.allowed) {
      return {
        ok: false,
        error: "That is a lot of searches at once. Give it a minute and try again.",
        retryAfterSec: rate.retryAfterSec,
      };
    }
  }

  const outcome = await runSearch({ name, scope, depth });
  if (!outcome.ok) return { ok: false, error: outcome.error };

  persistSearch(h, outcome.response, "user");

  return { ok: true, response: outcome.response };
}
