/**
 * English / Swahili copy.
 *
 * Swahili is the working language of business registration in Tanzania, and
 * BRELA's own guidance pages are published in it, so the app should not be
 * English-only. Strings live in one table rather than scattered through the
 * components, and both languages are typed against the same keys so a missing
 * translation is a compile error rather than a blank label.
 *
 * Terms of art are left in the form people actually use on the forms: BRELA,
 * ORS, "Limited", and the Act names stay as they are.
 */

export type Lang = "en" | "sw";

export const LANGS: Array<{ value: Lang; label: string; title: string }> = [
  { value: "en", label: "EN", title: "English" },
  { value: "sw", label: "SW", title: "Kiswahili" },
];

export interface Copy {
  // shell
  tagline: string;
  namePlaceholderCompany: string;
  namePlaceholderBusiness: string;
  nameAriaLabel: string;
  check: string;
  checking: string;
  clear: string;
  searchLabel: string;
  scopeAll: string;
  scopeCompany: string;
  scopeBusiness: string;
  depthLabel: string;
  depthQuick: string;
  depthStandard: string;
  depthDeep: string;
  themeToggle: string;
  sourceOnGitHub: string;
  star: string;

  // states
  searchingRegister: string;
  slowNote: string;
  searchFailed: string;
  tryAgain: string;
  noResemble: string;
  noFilterMatch: string;
  showingCount: (shown: number, total: number) => string;

  // verdict
  why: string;
  hideDetail: string;
  searchedCore: string;
  plusHomophones: string;
  ignoredWords: string;
  bothRegisters: string;
  onlyCompanyRegister: string;
  onlyBusinessRegister: string;
  entriesExamined: string;
  heldMore: string;

  // filters
  results: (n: number) => string;
  inBothRegisters: string;
  inCompanyRegister: string;
  inBusinessRegister: string;
  location: string;
  region: string;
  district: string;
  match: string;
  minimumRisk: string;
  register: string;
  status: string;
  legalForm: string;
  year: string;
  from: string;
  to: string;
  findInResults: string;
  nothingToFilter: string;
  sortAria: string;
  sortRelevance: string;
  sortName: string;
  sortNewest: string;
  sortOldest: string;

  // result row
  titleDefault: string;
  titleFound: (name: string, n: number) => string;
  titlePlain: (name: string) => string;
  scoreLegend: string;
  scoreTitle: (n: number) => string;
  copy: string;
  copyName: string;
  copyAll: string;
  copied: string;
  couldNotCopy: string;
  matchType: string;
  distinctiveCore: string;
  registeredOn: string;
  certificateNo: string;
  trackingNo: string;
  ceased: string;
  charges: string;
  chargesRegistered: string;
  address: string;
  allSignals: string;
  company: string;
  businessName: string;

  // verdict, rendered client-side from the structured counts so both
  // languages read naturally instead of being stitched from fragments
  bands: Record<string, string>;
  kinds: Record<string, string>;
  headline: Record<string, string>;
  reasons: Record<string, string>;
  closedNote: string;
  chargesNote: string;
  summaryIdentical: (n: number) => string;
  summaryNearIdentical: string;
  summaryQuery: (n: number) => string;
  summaryTighten: string;
  summaryAvailable: string;
  summaryNothing: (core: string) => string;
  summaryRuleNote: string;

  // footer
  howToRegister: string;
  official: string;
  furtherReading: string;
  primarySource: string;
  footerShort: string;
  details: string;
  hide: string;
  registerOnOrs: string;
  officialSearch: string;
  footerProcess: string;
  footerDisclaimer: string;
}

const en: Copy = {
  tagline: "Is the name you want already taken at BRELA?",
  namePlaceholderCompany: "Company name",
  namePlaceholderBusiness: "Business name",
  nameAriaLabel: "Name you want to register",
  check: "Check",
  checking: "…",
  clear: "Clear",
  searchLabel: "Search",
  scopeAll: "All",
  scopeCompany: "Companies",
  scopeBusiness: "Business names",
  depthLabel: "Search depth",
  depthQuick: "Quick",
  depthStandard: "Standard",
  depthDeep: "Deep",
  themeToggle: "Switch between light and dark",
  sourceOnGitHub: "Star this project on GitHub",
  // "Star" is GitHub's own term and is not translated in its Swahili-facing UI.
  star: "Star",

  searchingRegister: "Searching the register…",
  slowNote: "BRELA can take 15 to 30 seconds on common words. Filtering afterwards is instant.",
  searchFailed: "Search could not complete",
  tryAgain: "Try again",
  noResemble: "No entry on the register resembles this name.",
  noFilterMatch: "Nothing matches these filters.",
  showingCount: (shown, total) => `Showing ${shown} of ${total}`,

  why: "Why",
  hideDetail: "Hide detail",
  searchedCore: "Searched the distinctive core",
  plusHomophones: "plus homophone spellings",
  ignoredWords: "as legal-form or descriptive wording",
  bothRegisters: "Both the company and business-name registers were searched.",
  onlyCompanyRegister:
    "Only the company register was searched. Switch to All to include business names, which can conflict too.",
  onlyBusinessRegister:
    "Only the business-name register was searched. Switch to All to include companies, which can conflict too.",
  entriesExamined: "entries examined",
  heldMore: "the register held more, so try a deeper search",

  results: (n) => `${n.toLocaleString()} result${n === 1 ? "" : "s"}`,
  inBothRegisters: "in both registers",
  inCompanyRegister: "in the company register",
  inBusinessRegister: "in the business name register",
  location: "Location",
  region: "Region",
  district: "District",
  match: "Match",
  minimumRisk: "Minimum risk",
  register: "Register",
  status: "Status",
  legalForm: "Legal form",
  year: "Year",
  from: "from",
  to: "to",
  findInResults: "Find in results",
  nothingToFilter: "Nothing to filter",
  sortAria: "Sort results",
  sortRelevance: "Closest first",
  sortName: "Name A-Z",
  sortNewest: "Newest",
  sortOldest: "Oldest",

  titleDefault: "JinaCheck | Check a business name against the BRELA register",
  titleFound: (name, n) => `${name} | ${n} similar names at BRELA`,
  titlePlain: (name) => `${name} | Is this name taken at BRELA?`,
  scoreLegend: "Score 0 to 100: how likely each name is to block yours.",
  scoreTitle: (n) => `Conflict risk ${n} out of 100`,
  copy: "Copy",
  copyName: "Name only",
  copyAll: "All details",
  copied: "Copied",
  couldNotCopy: "Could not copy",
  matchType: "Match type",
  distinctiveCore: "Distinctive core",
  registeredOn: "Registered",
  certificateNo: "Certificate no.",
  trackingNo: "Tracking no.",
  ceased: "Ceased",
  charges: "Charges",
  chargesRegistered: "Registered",
  address: "Address",
  allSignals: "All signals",
  company: "Company",
  businessName: "Business name",

  bands: {
    critical: "Likely refused",
    high: "Expect a query",
    medium: "Worth tightening",
    low: "Looks available",
    clear: "Nothing found",
  },
  kinds: {
    identical: "Identical",
    phonetic: "Sounds alike",
    "contains-core": "Contains core",
    "starts-with": "Same opening",
    "token-overlap": "Shared word",
    fuzzy: "Similar spelling",
    weak: "Loose",
  },
  reasons: {
    identical: "Same distinctive core, with only legal or descriptive words differing",
    phonetic: "Sounds the same when spoken (idem sonans)",
    "contains-core": "Contains your whole distinctive core",
    "starts-with": "Shares an opening element, the part customers recognise first",
    "token-overlap": "Shares its distinctive word with your name",
    fuzzy: "Very close spelling, likely to be read as the same name",
    weak: "Contains your search term",
  },
  closedNote: "entry is closed, a weaker obstacle but still on the register",
  chargesNote: "has registered charges",
  headline: {
    critical: "Almost certainly refused",
    high: "Expect a query",
    medium: "Worth tightening",
    low: "Looks available",
    clear: "Nothing found",
  },
  summaryIdentical: (n) =>
    `${n === 1 ? "An entry" : `${n} entries`} on the register already ${n === 1 ? "carries" : "carry"} this name once legal and descriptive words are set aside. Choose a different distinctive element.`,
  summaryNearIdentical:
    "There is an existing name close enough that an examiner is likely to treat yours as calculated to deceive.",
  summaryQuery: (n) =>
    `${n} close match${n === 1 ? "" : "es"} found. You may be asked to justify the difference or amend the name.`,
  summaryTighten:
    "Nothing squarely blocking, but there are names near enough to cause market confusion and possible objection.",
  summaryAvailable:
    "No close conflicts surfaced. The similar-sounding entries below share only common trade words.",
  summaryNothing: (core) => `No entry on the public register matches “${core}”. That is a good sign.`,
  summaryRuleNote: "Note the naming-rule issues flagged above. They apply whatever the similarity score says.",

  official: "Official",
  furtherReading: "How registration works",
  primarySource: "the law",
  footerShort:
    "Live data from BRELA's public register. Guidance only, not a legal determination: the Registrar decides.",
  details: "Details",
  hide: "Hide",
  howToRegister: "How to register",
  registerOnOrs: "Register on ORS",
  officialSearch: "Official BRELA search",
  footerProcess:
    "A business name must be registered within 28 days of starting business, and you can ask the Registrar to rule on a name in advance: once cleared, it is held for you for 28 days (Business Names (Registration) Act, Cap. 213, s. 8 and s. 9). Registration is done through BRELA’s Online Registration System, which needs a NIDA number, a registered phone, an email address, and business and residential addresses.",
  footerDisclaimer:
    "Live data from BRELA’s public register, which only covers entries held in the Online Registration System, so older registrations may not appear here at all. Naming flags citing Cap. 213 s. 9 come from the Act itself; everything else is our own reading and not BRELA’s published policy. Nothing here is a legal determination, and checking a name does not reserve it. The Registrar decides.",
};

const sw: Copy = {
  tagline: "Je, jina unalotaka tayari limechukuliwa BRELA?",
  namePlaceholderCompany: "Jina la kampuni",
  namePlaceholderBusiness: "Jina la biashara",
  nameAriaLabel: "Jina unalotaka kusajili",
  check: "Angalia",
  checking: "…",
  clear: "Futa",
  searchLabel: "Tafuta",
  scopeAll: "Zote",
  scopeCompany: "Makampuni",
  scopeBusiness: "Majina ya biashara",
  depthLabel: "Kina cha utafutaji",
  depthQuick: "Haraka",
  depthStandard: "Kawaida",
  depthDeep: "Kwa kina",
  themeToggle: "Badilisha mwanga na giza",
  sourceOnGitHub: "Ipe nyota mradi huu GitHub",
  star: "Star",

  searchingRegister: "Inatafuta katika daftari…",
  slowNote:
    "BRELA inaweza kuchukua sekunde 15 hadi 30 kwa maneno yanayotumika sana. Kuchuja baadaye ni papo hapo.",
  searchFailed: "Utafutaji haukukamilika",
  tryAgain: "Jaribu tena",
  noResemble: "Hakuna jina katika daftari linalofanana na hili.",
  noFilterMatch: "Hakuna kinacholingana na vichujio hivi.",
  showingCount: (shown, total) => `Inaonyesha ${shown} kati ya ${total}`,

  why: "Kwa nini",
  hideDetail: "Ficha maelezo",
  searchedCore: "Imetafuta kiini cha jina",
  plusHomophones: "pamoja na tahajia zinazosikika sawa",
  ignoredWords: "kama maneno ya kisheria au ya maelezo",
  bothRegisters: "Daftari zote mbili, la makampuni na la majina ya biashara, zimetafutwa.",
  onlyCompanyRegister:
    "Ni daftari la makampuni pekee lililotafutwa. Chagua Zote ili kujumuisha majina ya biashara, ambayo pia yanaweza kugongana.",
  onlyBusinessRegister:
    "Ni daftari la majina ya biashara pekee lililotafutwa. Chagua Zote ili kujumuisha makampuni, ambayo pia yanaweza kugongana.",
  entriesExamined: "majina yamechunguzwa",
  heldMore: "daftari lilikuwa na mengi zaidi, jaribu utafutaji wa kina",

  results: (n) => `Matokeo ${n.toLocaleString()}`,
  inBothRegisters: "katika daftari zote mbili",
  inCompanyRegister: "katika daftari la makampuni",
  inBusinessRegister: "katika daftari la majina ya biashara",
  location: "Mahali",
  region: "Mkoa",
  district: "Wilaya",
  match: "Ulinganifu",
  minimumRisk: "Kiwango cha chini cha hatari",
  register: "Daftari",
  status: "Hali",
  legalForm: "Aina ya kisheria",
  year: "Mwaka",
  from: "kuanzia",
  to: "hadi",
  findInResults: "Tafuta ndani ya matokeo",
  nothingToFilter: "Hakuna cha kuchuja",
  sortAria: "Panga matokeo",
  sortRelevance: "Yanayokaribiana zaidi",
  sortName: "Jina A-Z",
  sortNewest: "Mapya zaidi",
  sortOldest: "Ya zamani zaidi",

  titleDefault: "JinaCheck | Angalia jina la biashara katika daftari la BRELA",
  titleFound: (name, n) => `${name} | Majina ${n} yanayofanana BRELA`,
  titlePlain: (name) => `${name} | Je, jina hili limechukuliwa BRELA?`,
  scoreLegend: "Alama 0 hadi 100: uwezekano wa jina hili kuzuia lako.",
  scoreTitle: (n) => `Hatari ya mgongano ${n} kati ya 100`,
  copy: "Nakili",
  copyName: "Jina pekee",
  copyAll: "Maelezo yote",
  copied: "Limenakiliwa",
  couldNotCopy: "Imeshindikana kunakili",
  matchType: "Aina ya ulinganifu",
  distinctiveCore: "Kiini cha jina",
  registeredOn: "Ilisajiliwa",
  certificateNo: "Namba ya cheti",
  trackingNo: "Namba ya ufuatiliaji",
  ceased: "Ilikoma",
  charges: "Dhamana",
  chargesRegistered: "Zimesajiliwa",
  address: "Anuani",
  allSignals: "Viashiria vyote",
  company: "Kampuni",
  businessName: "Jina la biashara",

  bands: {
    critical: "Yawezekana kukataliwa",
    high: "Tarajia maswali",
    medium: "Inafaa kuboresha",
    low: "Linaonekana wazi",
    clear: "Hakuna lililopatikana",
  },
  kinds: {
    identical: "Linafanana kabisa",
    phonetic: "Linasikika sawa",
    "contains-core": "Lina kiini chako",
    "starts-with": "Mwanzo unafanana",
    "token-overlap": "Neno linalofanana",
    fuzzy: "Tahajia inafanana",
    weak: "Ulinganifu hafifu",
  },
  reasons: {
    identical: "Kiini cha jina ni kile kile, yanatofautiana kwa maneno ya kisheria au ya maelezo tu",
    phonetic: "Linasikika sawa likitamkwa (idem sonans)",
    "contains-core": "Lina kiini chako chote cha jina",
    "starts-with": "Linaanza kwa namna moja, sehemu ambayo wateja huikumbuka kwanza",
    "token-overlap": "Linashiriki neno la kipekee na jina lako",
    fuzzy: "Tahajia inakaribiana sana, linaweza kusomeka kama jina lile lile",
    weak: "Lina neno ulilotafuta",
  },
  closedNote: "usajili umefungwa, kizuizi hafifu lakini bado lipo katika daftari",
  chargesNote: "lina dhamana zilizosajiliwa",
  headline: {
    critical: "Kwa hakika litakataliwa",
    high: "Tarajia maswali",
    medium: "Inafaa kuboresha",
    low: "Linaonekana wazi",
    clear: "Hakuna lililopatikana",
  },
  summaryIdentical: (n) =>
    `Tayari kuna ${n === 1 ? "jina moja" : `majina ${n}`} katika daftari yenye jina hili ukiondoa maneno ya kisheria na ya maelezo. Chagua kiini tofauti.`,
  summaryNearIdentical:
    "Kuna jina lililopo linalokaribiana kiasi kwamba mkaguzi anaweza kuona lako linaweza kupotosha umma.",
  summaryQuery: (n) =>
    `Kumepatikana majina ${n} yanayokaribiana. Unaweza kuulizwa kueleza tofauti au kubadilisha jina.`,
  summaryTighten:
    "Hakuna kinachozuia moja kwa moja, lakini kuna majina yanayokaribiana yanayoweza kuleta mkanganyiko sokoni na pingamizi.",
  summaryAvailable:
    "Hakuna mgongano wa karibu. Majina yanayosikika sawa hapa chini yanashiriki maneno ya kawaida ya biashara tu.",
  summaryNothing: (core) => `Hakuna jina katika daftari la umma linalolingana na “${core}”. Hiyo ni dalili nzuri.`,
  summaryRuleNote: "Zingatia masuala ya kanuni za majina yaliyoonyeshwa hapo juu. Yanahusika bila kujali alama ya ulinganifu.",

  official: "Rasmi",
  furtherReading: "Jinsi usajili unavyofanyika",
  primarySource: "sheria",
  footerShort:
    "Taarifa moja kwa moja kutoka daftari la umma la BRELA. Ni mwongozo tu, si uamuzi wa kisheria: Msajili ndiye mwenye kauli ya mwisho.",
  details: "Maelezo zaidi",
  hide: "Ficha",
  howToRegister: "Jinsi ya kusajili",
  registerOnOrs: "Sajili kupitia ORS",
  officialSearch: "Utafutaji rasmi wa BRELA",
  footerProcess:
    "Jina la biashara linapaswa kusajiliwa ndani ya siku 28 tangu kuanza biashara, na unaweza kumwomba Msajili atoe uamuzi kuhusu jina kabla: likikubaliwa, unashikiliwa kwa siku 28 (Sheria ya Usajili wa Majina ya Biashara, Sura ya 213, kifungu cha 8 na 9). Usajili hufanyika kupitia Mfumo wa Usajili kwa Njia ya Mtandao (ORS), unaohitaji namba ya NIDA, simu iliyosajiliwa, anuani ya baruapepe, na anuani za biashara na makazi.",
  footerDisclaimer:
    "Taarifa moja kwa moja kutoka daftari la umma la BRELA, ambalo lina majina yaliyo katika Mfumo wa Usajili kwa Njia ya Mtandao pekee, hivyo usajili wa zamani unaweza usionekane hapa. Vialamisho vinavyotaja Sura ya 213 kifungu cha 9 vinatoka kwenye Sheria yenyewe; mengine ni tafsiri yetu, si sera iliyochapishwa na BRELA. Hakuna kilicho hapa ni uamuzi wa kisheria, na kuangalia jina hakulihifadhi. Msajili ndiye mwenye uamuzi wa mwisho.",
};

export const COPY: Record<Lang, Copy> = { en, sw };

export function isLang(v: unknown): v is Lang {
  return v === "en" || v === "sw";
}
