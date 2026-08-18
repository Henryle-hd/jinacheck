/**
 * Tiny in-process TTL cache with single-flight de-duplication.
 *
 * The upstream ORS search costs ~15-30s per call regardless of page size, so
 * caching is not an optimisation here, it is what makes the product usable:
 * every filter change would otherwise re-pay that. Single-flight also stops a
 * double-clicked search from doubling the load we put on BRELA.
 */

interface Entry<T> {
  value: T;
  expires: number;
}

/**
 * Held on globalThis, not in module scope.
 *
 * Next bundles route handlers and page rendering separately, so a plain
 * module-level Map gives each its own copy: the search route would fill one
 * cache while metadata generation read an empty one. Anchoring to the global
 * gives every bundle the same store, and it survives HMR in development too.
 */
const globalCache = globalThis as typeof globalThis & {
  __jinacheckStore?: Map<string, Entry<unknown>>;
  __jinacheckInflight?: Map<string, Promise<unknown>>;
};

const store = (globalCache.__jinacheckStore ??= new Map<string, Entry<unknown>>());
const inflight = (globalCache.__jinacheckInflight ??= new Map<string, Promise<unknown>>());

const DEFAULT_TTL = 1000 * 60 * 30; // 30 minutes
const MAX_ENTRIES = 300;

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (hit.expires < Date.now()) {
    store.delete(key);
    return undefined;
  }
  // refresh recency for the crude LRU below
  store.delete(key);
  store.set(key, hit);
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttl = DEFAULT_TTL): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next();
    if (!oldest.done) store.delete(oldest.value);
  }
  store.set(key, { value, expires: Date.now() + ttl });
}

/**
 * Run `fn` under `key`, sharing the result with any caller that arrives while
 * it is still running, and caching the outcome on success.
 */
export async function withCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl = DEFAULT_TTL,
): Promise<{ value: T; cached: boolean }> {
  const hit = cacheGet<T>(key);
  if (hit !== undefined) return { value: hit, cached: true };

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return { value: await pending, cached: true };

  const promise = fn()
    .then((value) => {
      cacheSet(key, value, ttl);
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return { value: await promise, cached: false };
}
