/**
 * Name normalisation for the Tanzanian register.
 *
 * BRELA examiners do not compare two names character-for-character. They compare
 * what makes each name *distinctive*: legal suffixes ("LIMITED"), and purely
 * descriptive trade words ("GENERAL SUPPLIES", "INVESTMENT", "GROUP") carry
 * little or no weight, because every third entry on the register uses them.
 *
 * So "NIKA GROUP LIMITED" and "NIKA INVESTMENT CO. LTD" collide on their real
 * distinctive core: NIKA. This module extracts that core.
 */

/** Words that only signal legal form. Stripped entirely. */
export const LEGAL_SUFFIXES = new Set([
  "LIMITED", "LTD", "PLC", "COMPANY", "CO", "CORPORATION", "CORP",
  "INCORPORATED", "INC", "KAMPUNI",
]);

/**
 * Descriptive / trade words that are too common on the register to make a name
 * distinctive on their own. Includes the Swahili equivalents that show up a lot.
 */
export const GENERIC_WORDS = new Set([
  // digital / professional trades, the gap that let "X SOFTWARE" score as high
  // as a shared distinctive word
  "SOFTWARE", "HARDWARE", "APP", "APPS", "WEB", "ONLINE", "CLOUD", "DATA",
  "NETWORK", "NETWORKS", "COMPUTER", "COMPUTERS", "IT", "ICT", "AI", "STUDIO",
  "STUDIOS", "LABS", "LAB", "WORKS", "COMPANY", "FIRM", "SHOP",
  // structure / scale
  "GROUP", "HOLDINGS", "HOLDING", "ENTERPRISES", "ENTERPRISE", "VENTURES",
  "VENTURE", "PARTNERS", "ASSOCIATES", "BROTHERS", "BROS", "SONS", "FAMILY",
  "INDUSTRIES", "INDUSTRY", "INTERNATIONAL", "GLOBAL", "WORLDWIDE", "AFRICA",
  "AFRICAN", "TANZANIA", "TANZANIAN", "TZ", "EAST", "WEST", "NORTH", "SOUTH",
  "CENTRAL", "UNITED", "MODERN", "NEW", "SUPER", "PRIME", "PREMIER", "ROYAL",
  // trade / activity
  "INVESTMENT", "INVESTMENTS", "TRADING", "TRADERS", "TRADE", "GENERAL",
  "SUPPLIES", "SUPPLY", "SUPPLIERS", "SERVICES", "SERVICE", "AGENCY",
  "AGENCIES", "CONTRACTORS", "CONTRACTOR", "CONSTRUCTION", "BUILDERS",
  "ENGINEERING", "CONSULTING", "CONSULTANTS", "CONSULTANCY", "SOLUTIONS",
  "SYSTEMS", "TECHNOLOGIES", "TECHNOLOGY", "TECH", "DIGITAL", "LOGISTICS",
  "TRANSPORT", "TRANSPORTATION", "TOURS", "TRAVEL", "SAFARIS", "SAFARI",
  "HARDWARE", "PHARMACY", "STATIONERY", "ELECTRONICS", "MINING", "MINERALS",
  "FARM", "FARMING", "FARMS", "AGRO", "AGRIBUSINESS", "AGRICULTURE", "MEDIA",
  "PRODUCTIONS", "PRODUCTION", "DESIGNS", "DESIGN", "SHOP", "STORE", "STORES",
  "CENTRE", "CENTER", "MART", "SUPERMARKET", "DEALERS", "MERCHANTS",
  "SUPPLIERS", "DISTRIBUTORS", "SUPPLY", "SUPPLYING", "WORKS", "SUPPLIER",
  "SUPPLIES", "SUPPLIED", "COMMERCIAL", "BUSINESS", "ENTERPRENEURS",
  // swahili generics
  "BIASHARA", "DUKA", "HUDUMA", "MAENDELEO", "UMOJA", "JUMLA", "REJAREJA",
  // connectives
  "AND", "OF", "FOR", "THE", "NA", "YA", "WA", "LA",
  // sector words — descriptive of the activity, not of the business. These are
  // separately *restricted* (see rules.ts), but for distinctiveness they carry
  // no weight: the question raised by "MKUZA BANK" is whether MKUZA is taken,
  // not whether other banks exist.
  "BANK", "BANKING", "BANKERS", "INSURANCE", "ASSURANCE", "MICROFINANCE",
  "SACCOS", "FINANCE", "FINANCIAL", "CREDIT", "CAPITAL", "FUND", "FUNDS",
  "HOSPITAL", "CLINIC", "MEDICAL", "PHARMACY", "PHARMACEUTICALS", "HEALTH",
  "UNIVERSITY", "COLLEGE", "SCHOOL", "ACADEMY", "EDUCATION", "INSTITUTE",
  "HOTEL", "LODGE", "RESTAURANT", "BAR", "SECURITY", "PROPERTIES", "PROPERTY",
  "ESTATE", "ESTATES", "REAL", "MOTORS", "AUTO", "GARAGE", "PETROLEUM", "OIL",
  "GAS", "ENERGY", "WATER", "FOODS", "FOOD", "BEVERAGES", "TEXTILES", "SACCO",
  // very common non-distinctive qualifiers
  "NATIONAL", "STATE", "PUBLIC", "PRIVATE", "GENUINE", "QUALITY", "BEST",
  "FIRST", "GOLDEN", "GREAT", "BIG", "SMALL", "SMART", "SUCCESS", "SUCCESSFUL",
]);

/**
 * How much a word says about *which* business this is.
 *
 * The old model deleted descriptive words outright, which broke two ways at
 * once: "AGRIBUSINESS SOFTWARE TECHNOLOGIES" lost everything but one word, and
 * any word missing from the list counted as fully distinctive. Nothing is
 * deleted now. Words are weighed, so a name built from common trade words has
 * to match on more of them to score, while sharing one rare word still counts
 * for a lot.
 */
export const DESCRIPTIVE_WEIGHT = 0.15;

export function tokenWeight(token: string): number {
  if (LEGAL_SUFFIXES.has(token)) return 0;
  if (GENERIC_WORDS.has(token) || /^\d+$/.test(token)) return DESCRIPTIVE_WEIGHT;
  // Two-letter fragments carry little on their own.
  if (token.length <= 2) return 0.4;
  return 1;
}

/** Total weight of a token list. */
export function totalWeight(tokens: string[]): number {
  return tokens.reduce((sum, t) => sum + tokenWeight(t), 0);
}

/**
 * Consecutive runs of a token list, joined.
 *
 * This is what lets "EASY ONE" meet "EASYONE": the register writes the same
 * name both ways, and a reader sees no difference, so the comparison should
 * not either.
 */
export function mergedRuns(tokens: string[], maxSpan = 3): Array<{ text: string; span: number[] }> {
  const out: Array<{ text: string; span: number[] }> = [];
  for (let i = 0; i < tokens.length; i++) {
    for (let n = 2; n <= maxSpan && i + n <= tokens.length; n++) {
      const span = Array.from({ length: n }, (_, k) => i + k);
      out.push({ text: span.map((k) => tokens[k]).join(""), span });
    }
  }
  return out;
}

/** Tokenise a raw register name into uppercase alphanumeric words. */
export function tokenize(raw: string): string[] {
  return (raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Full name with punctuation/case/spacing flattened, suffixes intact. */
export function normalizeFull(raw: string): string {
  return tokenize(raw).join(" ");
}

export interface NameParts {
  /** Uppercased, punctuation-stripped, whitespace-collapsed. */
  full: string;
  /** All tokens. */
  tokens: string[];
  /** Tokens with legal suffixes removed. */
  withoutLegal: string[];
  /** Tokens that actually carry distinctiveness. */
  distinctive: string[];
  /** The distinctive core, space-joined. Falls back gracefully. */
  core: string;
  /** Legal-form words found. */
  legal: string[];
  /** Generic words found. */
  generic: string[];
}

/**
 * Split a name into its legal, generic and distinctive parts.
 *
 * If a name is *entirely* generic ("GENERAL SUPPLIES LIMITED") we keep the
 * generic tokens as the core, since there is nothing else to compare on — and
 * a wholly descriptive name is itself a registrability problem we flag later.
 */
export function parseName(raw: string): NameParts {
  const tokens = tokenize(raw);
  const legal: string[] = [];
  const generic: string[] = [];
  const withoutLegal: string[] = [];
  const distinctive: string[] = [];

  for (const t of tokens) {
    if (LEGAL_SUFFIXES.has(t)) {
      legal.push(t);
      continue;
    }
    withoutLegal.push(t);
    if (GENERIC_WORDS.has(t) || /^\d+$/.test(t)) {
      generic.push(t);
    } else {
      distinctive.push(t);
    }
  }

  // Every non-legal word stays. Dropping the descriptive ones is what let a
  // three-word name collapse into a single common word.
  const core = withoutLegal.join(" ");

  return {
    full: tokens.join(" "),
    tokens,
    withoutLegal,
    distinctive,
    core,
    legal,
    generic,
  };
}

/**
 * Pick the terms to send upstream.
 *
 * The public BRELA search is a plain substring match, so searching the whole
 * proposed name ("NIKA GROUP LIMITED") finds nothing. We instead probe on the
 * distinctive tokens — which is what surfaces the real conflicts.
 *
 * Upstream times out on very short terms, so anything under 3 characters is
 * dropped; if that leaves nothing, we fall back to a 3-char prefix of the core.
 */
export function probeTerms(raw: string, limit = 3): string[] {
  const { withoutLegal } = parseName(raw);
  // Rarest first: probing NYIKA finds the names that matter, probing SOFTWARE
  // mostly finds everyone else in the trade.
  const pool = withoutLegal
    .slice()
    .sort((a, b) => tokenWeight(b) - tokenWeight(a) || b.length - a.length);

  const terms: string[] = [];
  for (const t of pool) {
    if (t.length >= 3 && !terms.includes(t)) terms.push(t);
    if (terms.length >= limit) break;
  }

  if (!terms.length) {
    const flat = tokenize(raw).join("");
    if (flat.length >= 3) terms.push(flat.slice(0, Math.max(3, Math.min(6, flat.length))));
  }
  return terms;
}

/**
 * Alternate spellings of a term that would sound the same to a Tanzanian ear.
 *
 * This closes a real hole in the upstream search: it only does substring
 * matching, so a search for NYIKA can never surface "NIKA COMPANY LIMITED" —
 * yet those two names collide squarely under the "calculated to deceive" test.
 * By probing the variants as well, near-homophones actually show up.
 */
export function spellingVariants(term: string): string[] {
  const t = term.toUpperCase();
  const out = new Set<string>();

  // Ordered by how often each actually shows up as a respelling of the same
  // name, because callers take only the first few.
  const swaps: Array<[RegExp, string]> = [
    [/(.)\1/g, "$1"], // doubled letter: NIKKA -> NIKA, QUICKLEE -> QUICKLE
    [/^NY/, "N"], // Swahili nasal onset: NYIKA -> NIKA
    [/^N(?!Y)/, "NY"], // and the reverse
    [/PH/g, "F"],
    [/F/g, "PH"],
    [/C/g, "K"],
    [/K/g, "C"],
    [/Z/g, "S"],
    [/S/g, "Z"],
    [/Y/g, "I"],
    [/I/g, "Y"],
  ];

  for (const [pattern, replacement] of swaps) {
    const v = t.replace(pattern, replacement);
    if (v !== t && v.length >= 3) out.add(v);
  }

  return [...out];
}

/**
 * The full probe set: distinctive tokens plus a couple of homophone variants of
 * the strongest token.
 *
 * Tightly capped. Every term is a separate upstream call, and each is issued
 * against both registers, so the request count is `terms × 2`. Variants are
 * limited to the two most plausible respellings rather than every permutation —
 * chains like C→K applied twice produce nonsense (QUICKLEE → QUIKKLEE) that
 * costs a round trip and can never match.
 */
export function probeSet(raw: string, maxVariants = 2): string[] {
  const base = probeTerms(raw, 3);
  if (!base.length) return base;

  const { withoutLegal } = parseName(raw);
  const terms = [...base];

  if (withoutLegal.length > 1) {
    // The phrase exactly as typed, first and above the single words.
    //
    // The register matches contiguous text, so this is the one query that finds
    // a verbatim "NYIKA SOFTWARE ..." entry. Probing the words separately only
    // finds it if it happens to fall inside the depth cap for whichever word
    // was searched, which for a common word it may not. It is also cheap: a
    // phrase matches few entries, so it comes back fast.
    const phrase = withoutLegal.join(" ");
    if (phrase.length >= 3 && phrase.length <= 60) terms.unshift(phrase);

    // And the same phrase with the spaces closed up, since the register holds
    // names written both ways.
    const squashed = withoutLegal.join("");
    if (squashed.length >= 3 && squashed.length <= 40 && !terms.includes(squashed)) {
      terms.push(squashed);
    }
  }

  let added = 0;
  for (const variant of spellingVariants(base[0])) {
    if (added >= maxVariants) break;
    if (terms.includes(variant)) continue;
    terms.push(variant);
    added++;
  }
  return terms;
}

/** Strip a leading/trailing legal suffix for display purposes. */
export function displayCore(raw: string): string {
  return parseName(raw).core || normalizeFull(raw);
}
