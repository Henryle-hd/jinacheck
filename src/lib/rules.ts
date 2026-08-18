/**
 * Registrability checks applied to the *proposed* name itself.
 *
 * PROVENANCE. The business-name rules below are taken from the text of the
 * Business Names (Registration) Act (Cap. 213), s. 9, as published by TanzLII
 * (legislation as at 31 July 2002; amendments 3/2012, 5/2021 and 5/2022 are not
 * yet applied to that consolidation). Those carry pinpoint citations.
 *
 * s. 9(1) requires the Registrar to refuse a business name which:
 *   (a) contains a word likely to mislead the public as to the nationality,
 *       race or religion of the owners. NOT auto-detected here: the test turns
 *       on whether the name misleads about who owns the business, which cannot
 *       be judged from the string alone, and guessing would flag ordinary names.
 *   (b) includes "Imperial", "Royal", "Empire", "Commonwealth", "Government" or
 *       "Municipal", or any word suggesting royal patronage or a Government
 *       connection.
 *   (c) includes "building society" or "co-operative", any equivalent in another
 *       language, or an abbreviation of either.
 *   (d) is identical with or similar to a name already registered under that
 *       Act, the Companies Act (Cap. 212) or the Co-operative Societies Act
 *       (Cap. 211), where the Registrar considers it likely to mislead.
 *       Paragraph (d) is why this app searches both registers by default.
 *
 * s. 9(2)-(3) also let you ask the Registrar to rule on a proposed name in
 * advance; once cleared you are entitled to it for 28 days.
 *
 * Everything NOT carrying a pinpoint citation is weaker: sector rules are
 * attributed to the Act that regulates the activity but were not read from the
 * statute text, and the Companies Act itself has not been checked, so
 * company-side rules name the Act only. Where the register could settle a
 * question it was consulted:
 *   - A company name carrying a Limited/PLC form: 300/300 in a sample.
 *   - "A business name may not use Limited": FALSE. Cap. 213 s. 9 contains no
 *     such bar and the register holds ~37 (e.g. "WEJISA COMPANY LIMITED"), so
 *     it is an advisory note, not a blocker.
 *   - Standalone "BANK" in the company register is almost exclusively licensed
 *     banks, consistent with the word being restricted.
 *   - "Tanzania" is described as needing consent by some practice guides, but
 *     the register is full of accepted names using it, so no flag is raised.
 *
 * The Registrar decides; this module is decision support.
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
      "The Registrar shall refuse a business name including “Government” or “Municipal”, or any word importing a connection with, or recognition by, the Government or a local authority.",
    authority: "Business Names (Registration) Act (Cap. 213) s. 9(1)(b)",
    severity: "warning",
  },
  {
    id: "sovereign",
    // "Imperial", "Royal", "Empire" and "Commonwealth" are named in the statute
    // itself. CROWN and KINGDOM are not: they ride on the same paragraph's
    // catch-all for "any other word" suggesting royal patronage.
    words: ["IMPERIAL", "ROYAL", "EMPIRE", "COMMONWEALTH", "CROWN", "KINGDOM"],
    title: "Implies royal patronage",
    detail:
      "The Registrar shall refuse a business name including “Imperial”, “Royal”, “Empire” or “Commonwealth”, or any word suggesting the business enjoys royal patronage.",
    authority: "Business Names (Registration) Act (Cap. 213) s. 9(1)(b)",
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
    // The statute names "building society" and "co-operative" (and equivalents
    // in any language, and abbreviations). CHAMBER / FEDERATION / UNION /
    // SOCIETY were my own additions and are not restricted, so they are gone.
    words: ["COOPERATIVE", "CO-OPERATIVE", "COOPERATIVES", "USHIRIKA"],
    title: "“Co-operative” is a restricted word",
    detail:
      "The Registrar shall refuse a business name including “building society” or “co-operative”, their equivalent in any other language, or any abbreviation of them. Co-operatives register under their own statute.",
    authority: "Business Names (Registration) Act (Cap. 213) s. 9(1)(c); Co-operative Societies Act (Cap. 211)",
    severity: "warning",
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

  // "building society" is a two-word phrase, so the token-based loop above
  // cannot see it.
  if (/\bBUILDING\s+SOCIET(Y|IES)\b/.test(parts.full)) {
    flags.push({
      id: "building-society",
      severity: "warning",
      title: "“Building society” is a restricted phrase",
      detail:
        "The Registrar shall refuse a business name that includes “building society”, its equivalent in any other language, or an abbreviation of it.",
      authority: "Business Names (Registration) Act (Cap. 213) s. 9(1)(c)",
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
