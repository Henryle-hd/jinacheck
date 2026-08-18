"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { ScoredEntity, SearchResponse, SearchScope } from "@/lib/types";
import {
  DEFAULT_STATE,
  readAppState,
  writeAppState,
  type Depth,
  type Sort,
} from "@/lib/url-state";
import { applyFilters, EMPTY_FILTERS, FilterBar, type FilterState } from "./filters";
import { useCopy } from "./lang";
import { ResultRow } from "./result-row";
import { VerdictLine } from "./verdict";

export function SearchApp() {
  const { t } = useCopy();
  const [name, setName] = useState(DEFAULT_STATE.name);
  const [scope, setScope] = useState<SearchScope>(DEFAULT_STATE.scope);
  const [depth, setDepth] = useState<Depth>(DEFAULT_STATE.depth);

  const [data, setData] = useState<SearchResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<Sort>(DEFAULT_STATE.sort);
  const [limit, setLimit] = useState(25);

  const abortRef = useRef<AbortController | null>(null);
  const restoredRef = useRef(false);
  const hasResults = Boolean(data) || loading || Boolean(error);

  useEffect(() => {
    if (!loading) return;
    const started = Date.now();
    const id = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 500);
    return () => clearInterval(id);
  }, [loading]);

  const run = useCallback(
    /**
     * `overrides` exists so the type and depth controls can re-run immediately on
     * change. Calling run() straight after setObjectType would read the previous
     * value out of the closure, and the user would see stale rule flags.
     */
    async (overrides?: {
      name?: string;
      scope?: SearchScope;
      depth?: Depth;
      /** Set when restoring a shared link, whose filters must survive the run. */
      keepFilters?: boolean;
    }) => {
      const payload = {
        name: overrides?.name ?? name,
        scope: overrides?.scope ?? scope,
        depth: overrides?.depth ?? depth,
      };
      if (!payload.name.trim()) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setElapsed(0);
      setLoading(true);
      setError(null);
      if (!overrides?.keepFilters) setFilters(EMPTY_FILTERS);
      setLimit(25);

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error ?? t.searchFailed);
          setData(null);
        } else {
          setData(body as SearchResponse);
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : t.searchFailed);
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [name, scope, depth, t],
  );

  /**
   * Restore a shared link, once, on mount.
   *
   * This has to happen after hydration rather than during render: the page is
   * prerendered without a query string, so seeding state from the URL while
   * rendering would produce markup that doesn't match the server's.
   */
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;

    const s = readAppState(window.location.search);
    if (!s.name.trim()) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time restore of shared-link state; cannot run during render without a hydration mismatch
    setName(s.name);
    setScope(s.scope);
    setDepth(s.depth);
    setSort(s.sort);
    setFilters(s.filters);
    void run({
      name: s.name,
      scope: s.scope,
      depth: s.depth,
      keepFilters: true,
    });
  }, [run]);

  /**
   * Keep the URL in step with every control, so the address bar is always a
   * shareable, reopenable snapshot. `replaceState` rather than `push` — filter
   * fiddling shouldn't fill up the back button.
   */
  useEffect(() => {
    const query = writeAppState({ name, scope, depth, sort, filters });
    const next = `${window.location.pathname}${query}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", next);
    }
  }, [name, scope, depth, sort, filters]);

  const filtered = useMemo(() => {
    if (!data) return [] as ScoredEntity[];
    const pool = applyFilters(data.results, filters);
    const sorted = [...pool];
    switch (sort) {
      case "name":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "newest":
        sorted.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || b.score - a.score);
        break;
      case "oldest":
        sorted.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999) || b.score - a.score);
        break;
      default:
        sorted.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    }
    return sorted;
  }, [data, filters, sort]);

  const searchField = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void run();
      }}
      className="w-full"
    >
      {/* Focus lifts the pill with a softer shadow instead of hardening its
          border — the border darkening read as a heavy double outline. */}
      <div className="flex items-center gap-2 rounded-full border border-line bg-surface py-2 pr-2 pl-4 shadow-(--shadow-sm) transition-shadow hover:shadow-(--shadow-md) focus-within:border-transparent focus-within:shadow-(--shadow-md)">
        <svg viewBox="0 0 16 16" className="size-4 shrink-0 text-faint" aria-hidden>
          <circle cx="6.5" cy="6.5" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
          <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={
            scope === "ET-BUSINESS" ? t.namePlaceholderBusiness : t.namePlaceholderCompany
          }
          autoComplete="off"
          spellCheck={false}
          aria-label={t.nameAriaLabel}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-faint"
        />
        {name && (
          <button
            type="button"
            onClick={() => setName("")}
            aria-label={t.clear}
            className="shrink-0 px-1 text-faint hover:text-ink"
          >
            ×
          </button>
        )}
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:text-[#04231f]"
        >
          {loading ? t.checking : t.check}
        </button>
      </div>
    </form>
  );

  /**
   * Which register to search. "All" is the default so a conflict in the other
   * register is never hidden; picking one narrows the results and applies that
   * register's naming rules (a company needs "Limited", a business name must
   * not use it).
   */
  const typeToggle = (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[13px]">
      <span className="text-faint">{t.searchLabel}</span>
      {(
        [
          { v: "all" as SearchScope, label: t.scopeAll },
          { v: "ET-COMPANY" as SearchScope, label: t.scopeCompany },
          { v: "ET-BUSINESS" as SearchScope, label: t.scopeBusiness },
        ] as const
      ).map((opt) => (
        <button
          key={opt.v}
          type="button"
          onClick={() => {
            if (opt.v === scope) return;
            setScope(opt.v);
            if (data || error) void run({ scope: opt.v });
          }}
          className={
            scope === opt.v
              ? "font-medium text-ink underline decoration-accent decoration-2 underline-offset-4"
              : "text-muted hover:text-ink"
          }
        >
          {opt.label}
        </button>
      ))}
      <span className="text-faint">·</span>
      <select
        value={depth}
        onChange={(e) => {
          const next = e.target.value as Depth;
          setDepth(next);
          if (data || error) void run({ depth: next });
        }}
        aria-label={t.depthLabel}
        className="bg-transparent text-muted outline-none hover:text-ink"
      >
        <option value="quick">{t.depthQuick}</option>
        <option value="standard">{t.depthStandard}</option>
        <option value="deep">{t.depthDeep}</option>
      </select>
    </div>
  );

  // ── landing ────────────────────────────────────────────────────────────
  if (!hasResults) {
    return (
      // Vertically centred in the available space, with a slight upward bias so
      // the block sits on the optical centre rather than the mathematical one.
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center px-4 py-12 pb-24">
        <h1 className="text-[34px] leading-none font-semibold tracking-tight text-ink">
          Jina<span className="text-accent">Check</span>
        </h1>
        <p className="mt-2 text-center text-[14px] text-muted">
          {t.tagline}
        </p>

        <div className="mt-7 w-full">{searchField}</div>
        <div className="mt-4">{typeToggle}</div>
      </div>
    );
  }

  // ── results ────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24">
      <div className="sticky top-0 z-20 -mx-4 bg-canvas/92 px-4 pt-4 pb-3 backdrop-blur-md">
        {searchField}
        <div className="mt-2.5">{typeToggle}</div>
      </div>

      {loading && (
        <div className="pt-8">
          <p className="text-[13px] text-muted">
            {t.searchingRegister}{" "}
            <span className="tnum text-faint">{elapsed}s</span>
          </p>
          <p className="mt-1 text-[12px] text-faint">
            {t.slowNote}
          </p>
          <ul className="mt-6 space-y-5">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} className="space-y-1.5">
                <div className="skeleton h-3.5 w-2/3 rounded" />
                <div className="skeleton h-3 w-5/6 rounded" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && !loading && (
        <div className="pt-8">
          <p className="text-[14px] font-medium text-critical">{t.searchFailed}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted">{error}</p>
          <button
            onClick={() => void run()}
            className="mt-2 text-[13px] text-accent hover:underline"
          >
            {t.tryAgain}
          </button>
        </div>
      )}

      {data && !loading && (
        <div className="pt-3">
          <VerdictLine data={data} />

          <div className="pt-3">
            <FilterBar
              data={data}
              filters={filters}
              onChange={setFilters}
              visibleCount={filtered.length}
              sort={sort}
              onSortChange={setSort}
            />
          </div>

          {filtered.length === 0 ? (
            <p className="pt-8 text-[13px] text-muted">
              {data.results.length === 0
                ? t.noResemble
                : t.noFilterMatch}
            </p>
          ) : (
            <>
              {/* Explains the number leading each row, once, rather than
                  repeating a label down the whole list. */}
              <p className="mt-3 text-[11px] text-faint">{t.scoreLegend}</p>

              <ul className="mt-1 divide-y divide-line">
                {filtered.slice(0, limit).map((r) => (
                  <ResultRow key={r.uid} entity={r} terms={data.query.tokens} />
                ))}
              </ul>
            </>
          )}

          {filtered.length > limit && (
            <button
              onClick={() => setLimit((l) => l + 50)}
              className="mt-5 text-[13px] text-accent hover:underline"
            >
              {t.showMore}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
