/**
 * Conflict scoring: how likely is this existing entry to block the name you want?
 *
 * The test being approximated: the Registrar must refuse a name "identical with
 * or similar to" one already registered under the Business Names (Registration)
 * Act, the Companies Act (Cap. 212) or the Co-operative Societies Act (Cap. 211)
 * where that would be likely to mislead the public (Cap. 213 s. 9(1)(d)). Note
 * it spans registers, which is why both are searched. That is a judgement call
 * about similarity, so we score
 * it as one — on the distinctive core, not the decorated full name — and show
 * the reasoning rather than just a number.
 */

import { parseName, type NameParts } from "./name";
import {
  editRatio,
  jaroWinkler,
  phoneticPhrase,
  tokenContainment,
  tokenSetRatio,
} from "./similarity";
import type { Entity, MatchKind, RiskBand, ScoredEntity, Verdict } from "./types";

export interface Proposal {
  raw: string;
  parts: NameParts;
  phonetic: string;
  coreSet: Set<string>;
}

export function buildProposal(raw: string): Proposal {
  const parts = parseName(raw);
  return {
    raw,
    parts,
    phonetic: phoneticPhrase(parts.core),
    coreSet: new Set(parts.distinctive.length ? parts.distinctive : parts.withoutLegal),
  };
}

export function bandFor(score: number): RiskBand {
  if (score >= 92) return "critical";
  if (score >= 78) return "high";
  if (score >= 60) return "medium";
  if (score >= 38) return "low";
  return "clear";
}

/** Whole-word containment: does `hay` contain `needle` as a word boundary run? */
function containsPhrase(hay: string, needle: string): boolean {
  if (!needle) return false;
  return new RegExp(`(^|\\s)${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`).test(hay);
}

/**
 * Score one register entry against the proposal.
 * Returns the 0-100 score, the dominant match kind, and the reasons behind it.
 */
export function scoreEntity(entity: Entity, p: Proposal): ScoredEntity {
  const cand = parseName(entity.name);
  const reasons: string[] = [];
  let score = 0;
  let kind: MatchKind = "weak";

  const pCore = p.parts.core;
  const cCore = cand.core;
  const pTokens = p.parts.distinctive.length ? p.parts.distinctive : p.parts.withoutLegal;
  const cTokens = cand.distinctive.length ? cand.distinctive : cand.withoutLegal;

  const sameFull = p.parts.withoutLegal.join(" ") === cand.withoutLegal.join(" ");
  const sameCore = pCore.length > 0 && pCore === cCore;
  const candPhonetic = phoneticPhrase(cCore);

  const jw = pCore && cCore ? jaroWinkler(pCore, cCore) : 0;
  const ed = pCore && cCore ? editRatio(pCore, cCore) : 0;

  // The phonetic key intentionally discards vowels, which makes it a strong net
  // but a loose one: NYIKA and NIKAYA reduce to the same key without really
  // sounding alike. Requiring the spellings to be close too keeps the
  // "sounds the same" claim honest — looser pairs still get caught below as
  // similar spellings, just without the stronger label.
  const samePhonetic =
    p.phonetic.length > 1 && p.phonetic === candPhonetic && ed >= 0.7;
  const tset = tokenSetRatio(pTokens, cTokens);
  const contain = tokenContainment(pTokens, cTokens);

  if (sameFull) {
    score = 100;
    kind = "identical";
    reasons.push("Identical name already on the register");
  } else if (sameCore) {
    score = 96;
    kind = "identical";
    reasons.push("Same distinctive core, with only legal or descriptive words differing");
  } else if (samePhonetic) {
    score = 90;
    kind = "phonetic";
    reasons.push("Sounds the same when spoken (idem sonans)");
  } else if (containsPhrase(cCore, pCore) || containsPhrase(pCore, cCore)) {
    // Scale by how much unrelated material surrounds the shared core: "NIKA
    // MOTORS" swallowing "NIKA" is a far closer call than a five-word name that
    // happens to include it.
    const ratio = Math.min(pCore.length, cCore.length) / Math.max(pCore.length, cCore.length);
    score = Math.round(70 + 26 * ratio);
    kind = "contains-core";
    reasons.push(
      cCore.length > pCore.length
        ? "Existing name contains your whole distinctive core"
        : "Your name contains this entry’s whole distinctive core",
    );
  } else if (cCore.startsWith(pCore) || pCore.startsWith(cCore)) {
    // Same idea for prefixes: NIKA→NIKAR is near-identical, NIKA→NIKALINE much
    // less so, and a flat score would rank them together.
    const ratio = Math.min(pCore.length, cCore.length) / Math.max(pCore.length, cCore.length);
    score = Math.round(60 + 32 * ratio);
    kind = "starts-with";
    reasons.push(
      ratio >= 0.75
        ? "Nearly the same word, a character or two apart"
        : "Shares an opening element, the part customers recognise first",
    );
  } else if (contain >= 0.6 || tset >= 0.6) {
    score = 58 + Math.round(Math.max(contain, tset) * 25);
    kind = "token-overlap";
    reasons.push("Shares its distinctive word(s) with your name");
  } else {
    // Fall back to graded fuzzy similarity on the core.
    const blended = jw * 0.65 + ed * 0.35;
    score = Math.round(blended * 82);
    kind = blended >= 0.7 ? "fuzzy" : "weak";
    if (blended >= 0.82) reasons.push("Very close spelling, likely to be read as the same name");
    else if (blended >= 0.7) reasons.push("Similar spelling");
    else if (blended >= 0.55) reasons.push("Loosely similar");
    else reasons.push("Contains your search term");
  }

  // A substring hit that shares no word and no real similarity is noise: the
  // upstream search matches "nika" inside "KUZIGANIKA". Keep it findable but
  // stop it competing with genuine conflicts.
  if (kind === "weak" && jw < 0.62) {
    score = Math.min(score, 30);
  }

  // Phonetic agreement is corroborating evidence even when it is not the
  // dominant signal — it is what turns "similar spelling" into a real risk.
  if (!samePhonetic && kind !== "identical" && candPhonetic && p.phonetic) {
    const pk = jaroWinkler(p.phonetic, candPhonetic);
    if (pk >= 0.9) {
      score = Math.min(100, score + 6);
      reasons.push("Near-identical pronunciation");
    }
  }

  // Closed entries still sit on the register and still get cited by examiners,
  // but they are a materially weaker obstacle than a live registration.
  if (entity.status === "Closed") {
    score = Math.round(score * 0.78);
    reasons.push("Entry is closed, which is a weaker obstacle but still on the register");
  }

  if (entity.hasCharges) reasons.push("Has registered charges");

  score = Math.max(0, Math.min(100, score));

  return {
    ...entity,
    score,
    band: bandFor(score),
    kind,
    reasons,
    core: cCore,
  };
}

/** Roll the scored pool up into a single answer to "can I register this?". */
export function buildVerdict(results: ScoredEntity[], proposal: Proposal, hasBlocker: boolean): Verdict {
  const topScore = results.length ? results[0].score : 0;
  const identicalCount = results.filter((r) => r.kind === "identical" && r.score >= 92).length;
  const highRiskCount = results.filter((r) => r.score >= 78).length;

  let band: RiskBand;
  let headline: string;
  let summary: string;

  if (identicalCount > 0) {
    band = "critical";
    headline = "Almost certainly refused";
    summary =
      `${identicalCount === 1 ? "An entry" : `${identicalCount} entries`} on the register ` +
      "already carr" + (identicalCount === 1 ? "ies" : "y") +
      " this name once legal and descriptive words are set aside. Choose a different distinctive element.";
  } else if (topScore >= 88) {
    band = "critical";
    headline = "High chance of refusal";
    summary =
      "There is an existing name close enough that an examiner is likely to treat yours as calculated to deceive.";
  } else if (topScore >= 78) {
    band = "high";
    headline = "Expect a query";
    summary =
      `${highRiskCount} close match${highRiskCount === 1 ? "" : "es"} found. You may be asked to justify the difference or amend the name.`;
  } else if (topScore >= 60) {
    band = "medium";
    headline = "Worth tightening";
    summary =
      "Nothing squarely blocking, but there are names near enough to cause market confusion and possible objection.";
  } else if (results.length) {
    band = "low";
    headline = "Looks available";
    summary =
      "No close conflicts surfaced. The similar-sounding entries below share only common trade words.";
  } else {
    band = "clear";
    headline = "Nothing found";
    summary =
      `No entry on the public register matches “${proposal.parts.core || proposal.raw}”. That is a good sign.`;
  }

  if (hasBlocker && band !== "critical") {
    band = band === "clear" || band === "low" ? "medium" : band;
    summary += " Note the naming-rule issues flagged above. They apply whatever the similarity score says.";
  }

  return { band, headline, summary, topScore, identicalCount, highRiskCount };
}
