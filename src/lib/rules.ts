/**
 * Registrability checks applied to the *proposed* name itself.
 *
 * PROVENANCE, because it matters: these rules were written from general
 * knowledge of Tanzanian company law, NOT transcribed from BRELA's published
 * guidance or checked against the statute text. `authority` names the Act a rule
 * derives from so a user can go and read it; it is a pointer, not a verified
 * pinpoint citation, which is why no section numbers are given.
 *
 * Where the register itself could settle a question, it was consulted:
 *   - "A company name must include Limited/PLC" holds in a 300-name sample of
 *     the company register (300/300 carry a Limited or PLC form).
 *   - "A business name may not use Limited" turned out to be FALSE. The business
 *     register holds ~37 such names (e.g. "WEJISA COMPANY LIMITED"), so that
 *     check is an advisory note rather than a blocker.
 *   - Standalone "BANK" in the company register is used almost exclusively by
 *     licensed banks, which is consistent with the word being restricted.
 *
 * Anything not listed above is unverified. Treat the whole module as
 * decision support; the Registrar decides.
 */

import type { NameFlag, SearchScope } from "./types";
import { GENERIC_WORDS, parseName } from "./name";

interface RestrictedRule {
  id: string;
  /** Matched against individual tokens of the proposed name. */
  words: string[];
  title: string;
  detail: string;
  authority: string;
  severity: NameFlag["severity"];
}

/**
 * Words that are not forbidden outright, but cannot be registered without
 * consent from the relevant authority or sector regulator.
 */
const RESTRICTED: RestrictedRule[] = [
  {
    id: "banking",
    words: ["BANK", "BANKING", "BANC", "BANKERS"],
    title: "“Bank” is a reserved word",
    detail:
      "Only an institution licensed by the Bank of Tanzania may use “bank” or a derivative in its name. Expect the application to be rejected without a BOT licence or written no-objection.",
    authority: "Banking and Financial Institutions Act, 2006",
    severity: "blocker",
  },
  {
    id: "insurance",
    words: ["INSURANCE", "ASSURANCE", "REINSURANCE", "INSURERS", "UNDERWRITERS"],
    title: "Insurance wording needs TIRA clearance",
    detail:
      "Names implying insurance business require approval from the Tanzania Insurance Regulatory Authority. Brokers and agents are licensed separately from insurers.",
    authority: "Insurance Act, 2009",
    severity: "blocker",
  },
  {
    id: "finance",
    words: ["MICROFINANCE", "SACCOS", "SACCOS", "FOREX", "BUREAU", "SECURITIES", "PENSION", "PENSIONS"],
    title: "Financial-services wording is regulated",
    detail:
      "Microfinance, forex bureau, securities dealing and pension wording each require a licence from BOT, CMSA or the sector regulator before BRELA will clear the name.",
    authority: "Microfinance Act, 2018; Capital Markets and Securities Act (Cap. 79)",
    severity: "warning",
  },
  {
    id: "state",
    words: [
      "NATIONAL", "GOVERNMENT", "STATE", "MINISTRY", "PRESIDENT", "PRESIDENTIAL",
      "PARLIAMENT", "MUNICIPAL", "AUTHORITY", "COMMISSION", "BOARD", "COUNCIL",
      "SERIKALI", "TAIFA", "WIZARA",
    ],
    title: "Suggests a connection with Government",
    detail:
      "A name that implies State patronage or official status is treated as undesirable unless that connection genuinely exists and is consented to in writing.",
    authority: "Companies Act (Cap. 212)",
    severity: "warning",
  },
  {
    id: "sovereign",
    words: ["ROYAL", "IMPERIAL", "CROWN", "KINGDOM"],
    title: "Implies royal or sovereign patronage",
    detail:
      "Words suggesting royal endorsement are routinely queried by the Registrar and usually require evidence of entitlement.",
    authority: "Companies Act (Cap. 212)",
    severity: "warning",
  },
  {
    id: "education",
    words: ["UNIVERSITY", "COLLEGE", "INSTITUTE", "ACADEMY", "SCHOOL", "CHUO"],
    title: "Education wording needs regulator approval",
    detail:
      "“University” and “college” are controlled by the Tanzania Commission for Universities / NACTVET. Schools require clearance from the education authorities.",
    authority: "Universities Act, 2005; NACTVET Act",
    severity: "warning",
  },
  {
    id: "health",
    words: ["HOSPITAL", "CLINIC", "PHARMACY", "PHARMACEUTICAL", "MEDICAL", "DISPENSARY"],
    title: "Health wording needs regulator approval",
    detail:
      "Health-facility and pharmacy naming requires clearance from the Ministry of Health, TMDA or the Pharmacy Council depending on the activity.",
    authority: "Pharmacy Act, 2011; Tanzania Medicines and Medical Devices Act",
    severity: "info",
  },
  {
    id: "international-bodies",
    words: ["UNITED", "NATIONS", "REDCROSS", "OLYMPIC", "OLYMPICS", "INTERPOL", "UNESCO", "UNICEF"],
    title: "Protected international name",
    detail:
      "Names of intergovernmental bodies, the Red Cross emblem and Olympic marks are protected and cannot be appropriated.",
    authority: "Companies Act (Cap. 212); international obligations",
    severity: "warning",
  },
  {
    id: "cooperative",
    words: ["COOPERATIVE", "COOPERATIVES", "CHAMBER", "FEDERATION", "UNION", "SOCIETY", "USHIRIKA"],
    title: "Society / cooperative wording is reserved",
    detail:
      "Cooperative societies and unions register under their own statute with the Registrar of Cooperatives, not as ordinary companies.",
    authority: "Cooperative Societies Act, 2013",
    severity: "info",
  },
  {
    id: "trust",
    words: ["TRUST", "TRUSTEE", "TRUSTEES", "FOUNDATION", "CHARITY", "NGO"],
    title: "Trust / charity wording may not fit this vehicle",
    detail:
      "Trusts, NGOs and charities are registered under separate regimes (Trustees’ Incorporation Ordinance, NGO Act) rather than as trading companies.",
    authority: "Trustees’ Incorporation Act (Cap. 318); NGO Act, 2002",
    severity: "info",
  },
];

/** Terms that are effectively never accepted as a distinctive element. */
const OFFENSIVE_HINTS = ["FUCK", "SHIT", "ASS", "BITCH", "NAZI", "HITLER", "ISIS"];

/**
 * Run every registrability check against the proposed name.
 *
 * `scope` matters for the legal-form rules only. "Limited" is required on a
 * company and forbidden on a business name, so when the scope is "all" we
 * cannot know which applies and both are skipped. Every other check is about
 * the words themselves and runs regardless.
 */
export function checkName(raw: string, scope: SearchScope): NameFlag[] {
  const flags: NameFlag[] = [];
  const parts = parseName(raw);
  const tokenSet = new Set(parts.tokens);
  const flat = parts.tokens.join("");

  // --- Structural: length and content -------------------------------------
  if (!parts.tokens.length) {
    return [
      {
        id: "empty",
        severity: "blocker",
        title: "No name entered",
        detail: "Type the name you are considering to run the check.",
      },
    ];
  }

  if (flat.length < 3) {
    flags.push({
      id: "too-short",
      severity: "blocker",
      title: "Name is too short",
      detail:
        "A one- or two-character name will not be accepted as distinctive, and the public register cannot even be searched on it.",
      authority: "Companies Act (Cap. 212)",
    });
  }

  if (/^\d+$/.test(flat)) {
    flags.push({
      id: "numeric-only",
      severity: "blocker",
      title: "Numbers alone are not a name",
      detail: "A name made only of digits carries no distinctive character.",
      authority: "Companies Act (Cap. 212)",
    });
  }

  // --- Wholly descriptive --------------------------------------------------
  if (!parts.distinctive.length && parts.withoutLegal.length) {
    flags.push({
      id: "wholly-generic",
      severity: "warning",
      title: "Name is entirely descriptive",
      detail:
        `Every word here (${parts.generic.join(", ")}) is a common trade term used across thousands of entries. ` +
        "Add something distinctive, like a coined word or a family name, or expect a “too general” query.",
      authority: "Companies Act (Cap. 212)",
    });
  } else if (parts.distinctive.length === 1 && parts.distinctive[0].length <= 3) {
    flags.push({
      id: "thin-distinctive",
      severity: "info",
      title: "Thin distinctive element",
      detail:
        `“${parts.distinctive[0]}” is doing all the work of distinguishing this name. Short cores collide easily with existing entries.`,
    });
  }

  // --- Legal form suffix ---------------------------------------------------
  const hasLimited = tokenSet.has("LIMITED") || tokenSet.has("LTD");
  const hasPlc = tokenSet.has("PLC");

  if (scope === "ET-COMPANY" && !hasLimited && !hasPlc) {
    flags.push({
      id: "missing-limited",
      severity: "warning",
      title: "Company name must end in “Limited”",
      detail:
        "A company limited by shares must have “Limited” (or “Public Limited Company”/PLC if public) as the last word of its name. Add it before filing.",
      authority: "Companies Act (Cap. 212)",
    });
  }

  if (scope === "ET-BUSINESS" && (hasLimited || hasPlc)) {
    flags.push({
      id: "business-with-limited",
      severity: "info",
      title: "“Limited” on a business name is unusual",
      detail:
        "A registered business name is not an incorporated company, so “Limited” implies limited liability it does not carry. BRELA has accepted such names before (the register holds several), so treat this as a caution rather than a bar. If you want limited liability, incorporate a company instead.",
      authority: "Business Names (Registration) Act (Cap. 213)",
    });
  }

  // --- Reserved / restricted words ----------------------------------------
  for (const rule of RESTRICTED) {
    const hit = rule.words.find((w) => tokenSet.has(w));
    if (!hit) continue;
    // "NATIONAL"/"UNITED" are also in our generic list; only flag as state-
    // connected when they lead the name, which is where the implication bites.
    if ((rule.id === "state" || rule.id === "international-bodies") && parts.tokens[0] !== hit) {
      continue;
    }
    flags.push({
      id: rule.id,
      severity: rule.severity,
      title: rule.title,
      detail: `“${hit}”: ${rule.detail}`,
      authority: rule.authority,
    });
  }

  // --- Obvious undesirables ------------------------------------------------
  const offensive = OFFENSIVE_HINTS.find((w) => flat.includes(w) && flat.length > w.length - 1);
  if (offensive && parts.tokens.some((t) => t === offensive)) {
    flags.push({
      id: "undesirable",
      severity: "blocker",
      title: "Likely to be refused as undesirable",
      detail:
        "The Registrar may refuse any name considered offensive or undesirable. This one will not survive examination.",
      authority: "Companies Act (Cap. 212)",
    });
  }

  // --- Practical hygiene ---------------------------------------------------
  if (/[^A-Za-z0-9\s.,&'()-]/.test(raw)) {
    flags.push({
      id: "odd-characters",
      severity: "info",
      title: "Unusual characters in the name",
      detail:
        "Stick to letters, numbers and ordinary punctuation. Symbols are commonly stripped or queried at the counter.",
    });
  }

  const order: Record<NameFlag["severity"], number> = { blocker: 0, warning: 1, info: 2 };
  return flags.sort((a, b) => order[a.severity] - order[b.severity]);
}

/** True when a word is non-distinctive — used by the UI to grey out chips. */
export function isGeneric(token: string): boolean {
  return GENERIC_WORDS.has(token.toUpperCase());
}
