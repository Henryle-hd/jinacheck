/**
 * The full app state, encoded in the query string.
 *
 * Everything the user chooses — the name, the register they intend to file in,
 * depth, sort and every filter — lives in the URL so a check can be shared or
 * reopened exactly as it was left. Only non-default values are written, so a
 * simple search stays a short link.
 */

import type { FilterState } from "@/components/filters";
import { EMPTY_FILTERS } from "@/components/filters";
import type { MatchKind, ObjectType } from "./types";

export type Depth = "quick" | "standard" | "deep";
export type Sort = "relevance" | "name" | "newest" | "oldest";

export interface AppState {
  name: string;
  objectType: ObjectType;
  depth: Depth;
  sort: Sort;
  filters: FilterState;
}

export const DEFAULT_STATE: AppState = {
  name: "",
  objectType: "ET-COMPANY",
  depth: "standard",
  sort: "relevance",
  filters: EMPTY_FILTERS,
};

const DEPTHS: Depth[] = ["quick", "standard", "deep"];
const SORTS: Sort[] = ["relevance", "name", "newest", "oldest"];
const KINDS: MatchKind[] = [
  "identical",
  "phonetic",
  "contains-core",
  "starts-with",
  "token-overlap",
  "fuzzy",
  "weak",
];

/** Short, readable aliases for the register in the URL. */
const REGISTER_TO_PARAM: Record<ObjectType, string> = {
  "ET-COMPANY": "company",
  "ET-BUSINESS": "business",
};
const PARAM_TO_REGISTER: Record<string, ObjectType> = {
  company: "ET-COMPANY",
  business: "ET-BUSINESS",
};

function splitList(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function intOrNull(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Parse a query string (with or without the leading "?") into app state. */
export function readAppState(search: string): AppState {
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);

  const depth = p.get("depth") as Depth | null;
  const sort = p.get("sort") as Sort | null;
  const as = p.get("as");
  const min = intOrNull(p.get("min"));

  return {
    name: p.get("q") ?? "",
    objectType: (as && PARAM_TO_REGISTER[as]) || DEFAULT_STATE.objectType,
    depth: depth && DEPTHS.includes(depth) ? depth : DEFAULT_STATE.depth,
    sort: sort && SORTS.includes(sort) ? sort : DEFAULT_STATE.sort,
    filters: {
      text: p.get("find") ?? "",
      regions: splitList(p.get("region")),
      districts: splitList(p.get("district")),
      statuses: splitList(p.get("status")),
      subtypes: splitList(p.get("form")),
      kinds: splitList(p.get("match")).filter((k): k is MatchKind =>
        KINDS.includes(k as MatchKind),
      ),
      registers: splitList(p.get("reg"))
        .map((r) => PARAM_TO_REGISTER[r])
        .filter(Boolean),
      minScore: min !== null && min >= 0 && min <= 100 ? min : 0,
      yearFrom: intOrNull(p.get("from")),
      yearTo: intOrNull(p.get("to")),
    },
  };
}

/** Serialise app state back to a query string, omitting defaults. */
export function writeAppState(s: AppState): string {
  const p = new URLSearchParams();
  const { filters: f } = s;

  if (s.name.trim()) p.set("q", s.name.trim());
  if (s.objectType !== DEFAULT_STATE.objectType) p.set("as", REGISTER_TO_PARAM[s.objectType]);
  if (s.depth !== DEFAULT_STATE.depth) p.set("depth", s.depth);
  if (s.sort !== DEFAULT_STATE.sort) p.set("sort", s.sort);

  if (f.regions.length) p.set("region", f.regions.join(","));
  if (f.districts.length) p.set("district", f.districts.join(","));
  if (f.statuses.length) p.set("status", f.statuses.join(","));
  if (f.subtypes.length) p.set("form", f.subtypes.join(","));
  if (f.kinds.length) p.set("match", f.kinds.join(","));
  if (f.registers.length) p.set("reg", f.registers.map((r) => REGISTER_TO_PARAM[r]).join(","));
  if (f.minScore > 0) p.set("min", String(f.minScore));
  if (f.yearFrom !== null) p.set("from", String(f.yearFrom));
  if (f.yearTo !== null) p.set("to", String(f.yearTo));
  if (f.text.trim()) p.set("find", f.text.trim());

  const query = p.toString();
  return query ? `?${query}` : "";
}
