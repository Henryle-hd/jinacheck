/**
 * Conflict scoring: how likely is this existing entry to block the name you want?
 *
 * The test being approximated: the Registrar must refuse a name "identical with
 * or similar to" one already registered under the Business Names (Registration)
 * Act, the Companies Act (Cap. 212) or the Co-operative Societies Act (Cap. 211)
 * where that would be likely to mislead the public (Cap. 213 s. 9(1)(d)).
 *
 * How it is measured, and why:
 *
 *   Every word is weighed rather than kept or deleted. Sharing a rare word like
 *   NYIKA says the two names would be confused; sharing SOFTWARE says only that
 *   both are in the same trade. The old binary split got this wrong in both
 *   directions, scoring "J Software" as a near-clone of "AGRIBUSINESS SOFTWARE
 *   TECHNOLOGIES" while ranking real NYIKA collisions below it.
 *
 *   Coverage is measured both ways. A candidate blocks you when it accounts for
 *   most of your name AND your name accounts for most of it. One direction alone
 *   lets a long name swallow a short one and call it a match.
 *
 *   Words are matched across spaces. "EASY ONE" and "EASYONE" are the same name
 *   to a reader and to an examiner, so consecutive words are also compared
 *   joined together.
 */

import {
  mergedRuns,
  parseName,
  tokenWeight,
  totalWeight,
  type NameParts,
} from "./name";
import { editRatio, phoneticKey, phoneticPhrase } from "./similarity";
import type { Entity, MatchKind, RiskBand, ScoredEntity, Verdict } from "./types";

export interface Proposal {
  raw: string;
  parts: NameParts;
  phonetic: string;
  /** All non-legal words run together, for spacing-blind comparison. */
  squashed: string;
  units: Unit[];
  weight: number;
}

/** A word, or a run of consecutive words treated as one. */
interface Unit {
  text: string;
  idx: number[];
  weight: number;
}

function buildUnits(tokens: string[]): Unit[] {
  const singles: Unit[] = tokens.map((t, i) => ({
    text: t,
    idx: [i],
    weight: tokenWeight(t),
  }));
  const merged: Unit[] = mergedRuns(tokens).map((m) => ({
    text: m.text,
    idx: m.span,
    weight: m.span.reduce((sum, k) => sum + tokenWeight(tokens[k]), 0),
  }));
  return [...singles, ...merged];
}

export function buildProposal(raw: string): Proposal {
  const parts = parseName(raw);
  return {
    raw,
    parts,
    phonetic: phoneticPhrase(parts.core),
    squashed: parts.withoutLegal.join(""),
    units: buildUnits(parts.withoutLegal),
    weight: totalWeight(parts.withoutLegal),
  };
}

export function bandFor(score: number): RiskBand {
  if (score >= 92) return "critical";
  if (score >= 78) return "high";
  if (score >= 60) return "medium";
  if (score >= 38) return "low";
  return "clear";
}

/** How alike two words are, spelling and sound together. 0 means unrelated. */
function unitMatch(a: string, b: string): { score: number; phonetic: boolean } {
  if (a === b) return { score: 1, phonetic: false };

  const ed = editRatio(a, b);
  const sameSound = a.length > 2 && b.length > 2 && phoneticKey(a) === phoneticKey(b);

  if (sameSound && ed >= 0.7) return { score: 0.92, phonetic: true };
  if (ed >= 0.88) return { score: 0.85, phonetic: false };
  if (ed >= 0.78) return { score: 0.62, phonetic: false };
  if (sameSound) return { score: 0.55, phonetic: true };
  return { score: 0, phonetic: false };
}

interface Alignment {
  covP: number;
  covC: number;
  shared: string[];
  usedPhonetic: boolean;
}

/**
 * Pair up the two names' words, best matches first.
 *
 * Greedy rather than optimal: each word can only be spent once, and the
 * strongest pairing wins it. An exact assignment would cost more to compute and
 * would not change the ordering of anything a person is going to read.
 */
function align(p: Proposal, cTokens: string[], cUnits: Unit[], cWeight: number): Alignment {
  const pairs: Array<{ p: Unit; c: Unit; m: number; gain: number; phonetic: boolean }> = [];

  for (const pu of p.units) {
    if (pu.weight <= 0) continue;
    for (const cu of cUnits) {
      if (cu.weight <= 0) continue;
      const { score, phonetic } = unitMatch(pu.text, cu.text);
      if (score > 0) {
        pairs.push({ p: pu, c: cu, m: score, gain: score * Math.min(pu.weight, cu.weight), phonetic });
      }
    }
  }
  // Exact word matches claim their words before anything approximate does.
  // Sorting on weight alone let a phonetic match against a longer run outrank
  // the exact match sitting inside it, which scored the same but described
  // itself wrongly.
  pairs.sort((a, b) => b.m - a.m || b.gain - a.gain);

  const usedP = new Set<number>();
  const usedC = new Set<number>();
  const shared: string[] = [];
  let matchedP = 0;
  let matchedC = 0;
  let usedPhonetic = false;
  let first = true;

  for (const pair of pairs) {
    if (pair.p.idx.some((i) => usedP.has(i))) continue;
    if (pair.c.idx.some((i) => usedC.has(i))) continue;
    pair.p.idx.forEach((i) => usedP.add(i));
    pair.c.idx.forEach((i) => usedC.add(i));
    matchedP += pair.m * pair.p.weight;
    matchedC += pair.m * pair.c.weight;
    // Only the pairing that carries the match decides the label. A minor word
    // happening to rhyme should not make an exact match read as "sounds alike".
    if (first) {
      usedPhonetic = pair.phonetic;
      first = false;
    }
    if (pair.p.weight >= 0.5) shared.push(pair.c.text);
  }

  return {
    covP: p.weight > 0 ? matchedP / p.weight : 0,
    covC: cWeight > 0 ? matchedC / cWeight : 0,
    shared,
    usedPhonetic,
  };
}

/** Both directions have to hold, so the mean punishes a lopsided match. */
function harmonic(a: number, b: number): number {
  if (a <= 0 || b <= 0) return 0;
  return (2 * a * b) / (a + b);
}

export function scoreEntity(entity: Entity, p: Proposal): ScoredEntity {
  const cand = parseName(entity.name);
  const cTokens = cand.withoutLegal;
  const cWeight = totalWeight(cTokens);
  const cSquashed = cTokens.join("");

  const reasons: string[] = [];
  let kind: MatchKind = "weak";
  let score: number;

  const { covP, covC, shared, usedPhonetic } = align(p, cTokens, buildUnits(cTokens), cWeight);
  const base = harmonic(covP, covC);

  if (p.squashed && p.squashed === cSquashed) {
    score = 100;
    kind = "identical";
    reasons.push("Identical name once legal wording is set aside");
  } else if (base >= 0.965) {
    score = 97;
    kind = "identical";
    reasons.push("Same name in substance, differing only in wording");
  } else {
    score = Math.round(base * 96);

    if (usedPhonetic && base >= 0.6) {
      kind = "phonetic";
      reasons.push("Sounds the same when spoken (idem sonans)");
    } else if (covP >= 0.9 && covC < 0.85) {
      kind = "contains-core";
      reasons.push("Existing name contains all of yours, plus more");
    } else if (covC >= 0.9 && covP < 0.85) {
      kind = "contains-core";
      reasons.push("Your name contains all of this one");
    } else if (base >= 0.55) {
      kind = "token-overlap";
      reasons.push(
        shared.length
          ? `Shares ${shared.slice(0, 3).join(", ")} with your name`
          : "Shares its distinctive wording with your name",
      );
    } else if (base >= 0.3) {
      kind = "fuzzy";
      reasons.push("Some wording in common, mostly common trade words");
    } else {
      kind = "weak";
      reasons.push("Contains your search term");
      score = Math.min(score, 30);
    }
  }

  // Closed entries still sit on the register and still get cited, but they are
  // a materially weaker obstacle than a live registration.
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
    core: cand.core,
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
    summary += " Note the naming-rule issues flagged above.";
  }

  return { band, headline, summary, topScore, identicalCount, highRiskCount };
}
