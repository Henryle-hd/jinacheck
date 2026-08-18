import { probeSet } from "./name";
import type { SearchScope } from "./types";

export type DepthKey = "quick" | "standard" | "deep";

/**
 * The cache key for a search.
 *
 * Shared so that metadata generation can look up a result the search route has
 * already fetched, instead of guessing at the key or hitting BRELA a second
 * time just to put a number in a link preview.
 */
export function searchCacheKey(opts: {
  name: string;
  number?: string;
  scope: SearchScope;
  depth: DepthKey;
}): { key: string; terms: string[] } {
  const isNumberLookup = !opts.name && !!opts.number;
  const terms = isNumberLookup ? [opts.number as string] : probeSet(opts.name);
  return {
    key: `search:${opts.scope}:${opts.depth}:${terms.join("+")}:${isNumberLookup ? "num" : "name"}`,
    terms,
  };
}
