"use client";

import { useMemo } from "react";

import type { MatchKind, ObjectType, SearchResponse } from "@/lib/types";
import type { Sort } from "@/lib/url-state";
import { useCopy } from "./lang";
import { Popover, REGISTER_LABEL } from "./ui";

export interface FilterState {
  text: string;
  regions: string[];
  districts: string[];
  statuses: string[];
  subtypes: string[];
  kinds: MatchKind[];
  registers: ObjectType[];
  minScore: number;
  yearFrom: number | null;
  yearTo: number | null;
}

export const EMPTY_FILTERS: FilterState = {
  text: "",
  regions: [],
  districts: [],
  statuses: [],
  subtypes: [],
  kinds: [],
  registers: [],
  minScore: 0,
  yearFrom: null,
  yearTo: null,
};

export function countActive(f: FilterState): number {
  return (
    (f.text ? 1 : 0) +
    f.regions.length +
    f.districts.length +
    f.statuses.length +
    f.subtypes.length +
    f.kinds.length +
    f.registers.length +
    (f.minScore > 0 ? 1 : 0) +
    (f.yearFrom ? 1 : 0) +
    (f.yearTo ? 1 : 0)
  );
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Checkbox list inside a popover. */
function CheckList({
  options,
  selected,
  onToggle,
  labelFor,
}: {
  options: Array<{ value: string; count: number }>;
  selected: string[];
  onToggle: (value: string) => void;
  labelFor?: (value: string) => string;
}) {
  const { t } = useCopy();
  if (!options.length) {
    return <p className="px-2 py-1.5 text-[12px] text-faint">{t.nothingToFilter}</p>;
  }
  return (
    <ul>
      {options.map((o) => (
        <li key={o.value}>
          <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink-soft hover:bg-raised">
            <input
              type="checkbox"
              checked={selected.includes(o.value)}
              onChange={() => onToggle(o.value)}
              className="size-3.5 shrink-0 accent-[var(--accent)]"
            />
            <span className="min-w-0 flex-1 truncate" title={o.value}>
              {labelFor ? labelFor(o.value) : o.value}
            </span>
            <span className="tnum shrink-0 text-[11px] text-faint">{o.count}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

/**
 * One quiet row of filter controls, in the spirit of a search engine's tools
 * strip rather than a permanent sidebar. Everything is optional and collapsed
 * by default, so the results stay the focus.
 */
export function FilterBar({
  data,
  filters,
  onChange,
  visibleCount,
  sort,
  onSortChange,
}: {
  data: SearchResponse;
  filters: FilterState;
  onChange: (next: FilterState) => void;
  visibleCount: number;
  sort: Sort;
  onSortChange: (sort: Sort) => void;
}) {
  const { t } = useCopy();
  const set = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });
  const active = countActive(filters);

  // Districts are scoped to the chosen regions, otherwise the list is enormous.
  const districts = useMemo(() => {
    const source = filters.regions.length
      ? data.facets.districts.filter((d) => d.region && filters.regions.includes(d.region))
      : data.facets.districts;
    return source.slice(0, 60).map(({ value, count }) => ({ value, count }));
  }, [data.facets.districts, filters.regions]);

  const kinds = useMemo(() => {
    const counts = new Map<MatchKind, number>();
    for (const r of data.results) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1);
    const order: MatchKind[] = [
      "identical",
      "phonetic",
      "contains-core",
      "starts-with",
      "token-overlap",
      "fuzzy",
      "weak",
    ];
    return order.filter((k) => counts.has(k)).map((k) => ({ value: k, count: counts.get(k)! }));
  }, [data.results]);

  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      {/* Spell out that both registers are covered. Otherwise switching the
          Company / Business name toggle looks like it does nothing. */}
      <span className="tnum mr-1 text-muted">
        {t.results(visibleCount)}
        <span className="text-faint">
          {data.facets.registers.length > 1
            ? ` ${t.inBothRegisters}`
            : data.facets.registers.length === 1
              ? ` ${data.facets.registers[0].value === "ET-COMPANY" ? t.inCompanyRegister : t.inBusinessRegister}`
              : ""}
        </span>
      </span>

      <Popover label={t.location} active={filters.regions.length + filters.districts.length}>
        <div className="space-y-2">
          <div>
            <p className="px-2 pb-1 text-[11px] tracking-wide text-faint uppercase">{t.region}</p>
            <CheckList
              options={data.facets.regions}
              selected={filters.regions}
              onToggle={(v) => set({ regions: toggle(filters.regions, v), districts: [] })}
            />
          </div>
          {districts.length > 0 && (
            <div className="border-t border-line pt-2">
              <p className="px-2 pb-1 text-[11px] tracking-wide text-faint uppercase">{t.district}</p>
              <CheckList
                options={districts}
                selected={filters.districts}
                onToggle={(v) => set({ districts: toggle(filters.districts, v) })}
              />
            </div>
          )}
        </div>
      </Popover>

      <Popover label={t.match} active={filters.kinds.length + (filters.minScore > 0 ? 1 : 0)}>
        <div className="space-y-2">
          <CheckList
            options={kinds.map((k) => ({ value: k.value, count: k.count }))}
            selected={filters.kinds}
            onToggle={(v) => set({ kinds: toggle(filters.kinds, v as MatchKind) })}
            labelFor={(v) => t.kinds[v]}
          />
          <div className="border-t border-line px-2 pt-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-muted">{t.minimumRisk}</span>
              <span className="tnum text-[12px] font-semibold text-ink">{filters.minScore}</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={filters.minScore}
              onChange={(e) => set({ minScore: Number(e.target.value) })}
              className="mt-1.5 w-full accent-[var(--accent)]"
            />
          </div>
        </div>
      </Popover>

      {/* Only shown when the search covered both registers. A business name and
          a company are different obstacles, so separating them is worth a filter. */}
      {data.facets.registers.length > 1 && (
        <Popover label={t.register} active={filters.registers.length}>
          <CheckList
            options={data.facets.registers.map((r) => ({ value: r.value, count: r.count }))}
            selected={filters.registers}
            onToggle={(v) => set({ registers: toggle(filters.registers, v as ObjectType) })}
            labelFor={(v) => REGISTER_LABEL[v as ObjectType]}
          />
        </Popover>
      )}

      <Popover
        label={t.status}
        active={filters.statuses.length + filters.subtypes.length}
      >
        <div className="space-y-2">
          <CheckList
            options={data.facets.statuses}
            selected={filters.statuses}
            onToggle={(v) => set({ statuses: toggle(filters.statuses, v) })}
          />
          {data.facets.subtypes.length > 1 && (
            <div className="border-t border-line pt-2">
              <p className="px-2 pb-1 text-[11px] tracking-wide text-faint uppercase">
                {t.legalForm}
              </p>
              <CheckList
                options={data.facets.subtypes}
                selected={filters.subtypes}
                onToggle={(v) => set({ subtypes: toggle(filters.subtypes, v) })}
              />
            </div>
          )}
        </div>
      </Popover>

      <Popover label={t.year} active={(filters.yearFrom ? 1 : 0) + (filters.yearTo ? 1 : 0)}>
        <div className="flex items-center gap-2 p-1">
          <input
            type="number"
            inputMode="numeric"
            placeholder={t.from}
            value={filters.yearFrom ?? ""}
            onChange={(e) => set({ yearFrom: e.target.value ? Number(e.target.value) : null })}
            className="tnum w-full rounded border border-line bg-canvas px-2 py-1 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
          <span className="text-[12px] text-faint">{t.to}</span>
          <input
            type="number"
            inputMode="numeric"
            placeholder={t.to}
            value={filters.yearTo ?? ""}
            onChange={(e) => set({ yearTo: e.target.value ? Number(e.target.value) : null })}
            className="tnum w-full rounded border border-line bg-canvas px-2 py-1 text-[13px] text-ink placeholder:text-faint focus:border-accent focus:outline-none"
          />
        </div>
      </Popover>

      <div className="ml-auto flex items-center gap-2">
        <input
          value={filters.text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder={t.findInResults}
          className="w-36 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink placeholder:text-faint focus:w-48 focus:border-accent focus:outline-none sm:w-44"
        />
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as Sort)}
          className="rounded-full border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink-soft focus:border-accent focus:outline-none"
          aria-label={t.sortAria}
        >
          <option value="relevance">{t.sortRelevance}</option>
          <option value="name">{t.sortName}</option>
          <option value="newest">{t.sortNewest}</option>
          <option value="oldest">{t.sortOldest}</option>
        </select>
        {active > 0 && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-[13px] text-accent hover:underline"
          >
            {t.clear}
          </button>
        )}
      </div>
    </div>
  );
}

/** Apply the filter state to a result pool. */
export function applyFilters<
  T extends {
    name: string;
    certNumber: string | null;
    trackingNo: string | null;
    address: string | null;
    status: string | null;
    subtype: string | null;
    kind: MatchKind;
    objectType: ObjectType;
    score: number;
    year: number | null;
    location: { region: string | null; district: string | null };
  },
>(results: T[], f: FilterState): T[] {
  const text = f.text.trim().toLowerCase();

  return results.filter((r) => {
    if (r.score < f.minScore) return false;
    if (f.kinds.length && !f.kinds.includes(r.kind)) return false;
    if (f.registers.length && !f.registers.includes(r.objectType)) return false;
    if (f.statuses.length && (!r.status || !f.statuses.includes(r.status))) return false;
    if (f.subtypes.length && (!r.subtype || !f.subtypes.includes(r.subtype))) return false;
    if (f.regions.length && (!r.location.region || !f.regions.includes(r.location.region)))
      return false;
    if (f.districts.length && (!r.location.district || !f.districts.includes(r.location.district)))
      return false;
    if (f.yearFrom && (r.year === null || r.year < f.yearFrom)) return false;
    if (f.yearTo && (r.year === null || r.year > f.yearTo)) return false;

    if (text) {
      const haystack = [r.name, r.certNumber, r.trackingNo, r.address]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(text)) return false;
    }
    return true;
  });
}
