import { after } from "next/server";

import { dbEnabled, recordSearch, setSearchContribution, upsertEntities } from "./db";
import { readRequestMeta } from "./request-meta";
import type { SearchResponse } from "./types";

/**
 * Write a finished search to Postgres, after the response has gone out.
 *
 * Everything needed is already on the response, so callers hand over the answer
 * they just produced rather than re-deriving anything. `kind` separates traffic
 * from the site and traffic from the public API.
 */
export function persistSearch(
  headers: Headers,
  response: SearchResponse,
  kind: "user" | "api",
): void {
  if (!dbEnabled()) return;

  const meta = readRequestMeta(headers);
  const lang = headers.get("accept-language")?.slice(0, 12) ?? null;

  after(async () => {
    try {
      const searchId = await recordSearch({
        queryName: response.query.name,
        queryCore: response.query.core,
        terms: response.query.tokens,
        scope: response.query.scope,
        depth: "standard",
        resultCount: response.results.length,
        topScore: response.verdict.topScore,
        verdictBand: response.verdict.band,
        flagIds: response.flags.map((f) => f.id),
        durationMs: response.meta.ms,
        fromCache: response.meta.cached,
        truncated: response.meta.truncated,
        lang,
        kind,
        meta,
      });

      const cores = new Map(response.results.map((r) => [r.uid, r.core]));
      const added = await upsertEntities(response.results, cores);
      if (searchId !== null) await setSearchContribution(searchId, added);
    } catch (err) {
      // Never surfaced: the search already succeeded and the answer is gone.
      console.warn("[jinacheck] persistence skipped", err);
    }
  });
}
