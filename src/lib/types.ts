/**
 * Shared types for the BRELA smart-search layer.
 *
 * The upstream ORS endpoint returns a columnar payload:
 *   { Map: string[], Records: unknown[][], Result: "OK", TotalRecordCount: number }
 * Everything below is the normalised shape we expose to the UI instead.
 */

export type ObjectType = "ET-COMPANY" | "ET-BUSINESS";

export type RegStatus = "Registered" | "Closed" | string;

/** Raw upstream response (success case). */
export interface BrelaRawResponse {
  Map: string[];
  Records: unknown[][];
  Result: string;
  TotalRecordCount: number;
}

/** Upstream error shape, e.g. a SQL timeout on too-short a query. */
export interface BrelaErrorResponse {
  error: string;
  sign?: string;
}

/** A single register entry, normalised out of the columnar payload. */
export interface Entity {
  id: number;
  /**
   * Stable key across both registers. The company and business-name registers
   * number their rows independently, so `id` alone collides once results from
   * the two are merged.
   */
  uid: string;
  trackingNo: string | null;
  certNumber: string | null;
  regDate: string | null;
  incorporationDate: string | null;
  name: string;
  subtype: string | null;
  subtypeCode: string | null;
  objectType: ObjectType;
  baCategory: string | null;
  statusCode: string | null;
  status: RegStatus | null;
  /** Raw comma-delimited address string from upstream. */
  address: string | null;
  cessDate: string | null;
  updateDate: string | null;
  hasCharges: boolean;
  /** Parsed out of `address`. */
  location: Location;
  /** Registration year, derived from regDate/incorporationDate. */
  year: number | null;
}

export interface Location {
  region: string | null;
  district: string | null;
  ward: string | null;
  postcode: string | null;
  street: string | null;
}

/** How a candidate's name relates to the proposed name. */
export type MatchKind =
  | "identical"
  | "phonetic"
  | "contains-core"
  | "starts-with"
  | "token-overlap"
  | "fuzzy"
  | "weak";

export type RiskBand = "critical" | "high" | "medium" | "low" | "clear";

/** A register entry scored against the proposed name. */
export interface ScoredEntity extends Entity {
  /** 0-100 conflict score: how likely this entry blocks the proposed name. */
  score: number;
  band: RiskBand;
  kind: MatchKind;
  /** Human-readable reasons, shown as chips in the UI. */
  reasons: string[];
  /** Distinctive core of this entry's name, after stripping suffixes/generics. */
  core: string;
}

/** A statutory flag raised against the proposed name itself. */
export interface NameFlag {
  id: string;
  severity: "blocker" | "warning" | "info";
  title: string;
  detail: string;
  /** Statutory or procedural hook, e.g. "Companies Act, Cap. 212 s.14(1)". */
  authority?: string;
}

export interface Verdict {
  band: RiskBand;
  headline: string;
  summary: string;
  /** Best (highest) conflict score found in the register. */
  topScore: number;
  identicalCount: number;
  highRiskCount: number;
}

export interface SearchRequest {
  /** The name the user is thinking of registering. */
  name: string;
  /**
   * What the user intends to register. This drives the naming-rule checks only —
   * the search itself always covers both registers, because a company name and
   * a business name conflict with each other in practice.
   */
  objectType: ObjectType;
  /** Registration/certificate number lookup (optional, exact-ish). */
  number?: string;
  /** How many candidate records to pull from upstream. */
  depth?: number;
}

export interface ProbeReport {
  term: string;
  /** Which register this probe hit. Added when results are merged. */
  register?: ObjectType;
  matched: number;
  total: number;
  pages: number;
  ms: number;
  truncated: boolean;
  error?: string;
}

export interface SearchResponse {
  query: {
    name: string;
    objectType: ObjectType;
    number?: string;
    /** The distinctive core we derived and actually searched on. */
    core: string;
    /** Every term sent upstream. */
    tokens: string[];
    /** Homophone spellings we probed in addition to the literal tokens. */
    variants: string[];
    /** Words ignored as legal-form or purely descriptive. */
    ignored: string[];
  };
  verdict: Verdict;
  flags: NameFlag[];
  results: ScoredEntity[];
  facets: {
    regions: Array<{ value: string; count: number }>;
    districts: Array<{ value: string; count: number; region: string | null }>;
    statuses: Array<{ value: string; count: number }>;
    subtypes: Array<{ value: string; count: number }>;
    years: Array<{ value: number; count: number }>;
    /** Which register each hit came from. */
    registers: Array<{ value: ObjectType; count: number }>;
  };
  meta: {
    /** Total candidates in the scored pool. */
    pool: number;
    /** Upstream-reported totals per probe. */
    probes: ProbeReport[];
    /** True when upstream had more records than we pulled. */
    truncated: boolean;
    ms: number;
    cached: boolean;
    fetchedAt: string;
  };
}
