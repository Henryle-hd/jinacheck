/** Outbound links, kept in one place so they can't drift apart. */

/**
 * BRELA's own public search page, for anyone who wants to verify a result
 * against the source. This is the human-facing page, not the JSON endpoint the
 * server talks to.
 */
export const BRELA_SEARCH_URL = "https://ors.brela.go.tz/orsreg/searchbusinesspublic";

/** BRELA's guidance on registering a business name: who can, and the steps. */
export const BRELA_HOWTO_URL = "https://www.brela.go.tz/services/registration-of-business-names";

/** The Online Registration System itself, where an application is actually filed. */
export const BRELA_ORS_URL = "https://ors.brela.go.tz/ors/start?returnUrl=%2fbrela%2fprod%2fors";

export const GITHUB_URL = "https://github.com/Henryle-hd/jinacheck";

/**
 * Further reading, in the order of how much weight it carries.
 *
 * The Act is the primary source and the one the naming flags cite. The rest are
 * practitioner write-ups: useful for procedure, fees and timelines, but they are
 * commentary, not law, and they do disagree with each other on detail (for
 * example on how long a name reservation lasts).
 */
export interface Reading {
  href: string;
  label: string;
  note: string;
  noteSw: string;
  primary?: boolean;
}

export const FURTHER_READING: Reading[] = [
  {
    href: "https://media.tanzlii.org/media/legislation/316257/source_file/e3f3cc9686195347/1930-1.pdf",
    label: "Business Names (Registration) Act, Cap. 213",
    note: "The Act itself. Section 9 is the naming rules this app cites.",
    noteSw: "Sheria yenyewe. Kifungu cha 9 ndicho chenye kanuni za majina zinazotajwa hapa.",
    primary: true,
  },
  {
    href: "https://www.tanzaniainvest.com/economy/trade/company-registration-guide",
    label: "Company registration guide (TanzaniaInvest)",
    note: "Steps and fees for incorporating, including name reservation.",
    noteSw: "Hatua na ada za usajili wa kampuni, pamoja na kuhifadhi jina.",
  },
  {
    href: "https://www.expanship.com/tz/blog/incorporation-requirements-in-tanzania",
    label: "Incorporation requirements in Tanzania (Expanship)",
    note: "What BRELA checks a company name against before incorporation.",
    noteSw: "Mambo ambayo BRELA huyapima kwenye jina la kampuni kabla ya usajili.",
  },
  {
    href: "https://www.bieastafrica.com/tanzania-company-registration.html",
    label: "Tanzania company registration (BI East Africa)",
    note: "Walkthrough of filing on ORS, step by step.",
    noteSw: "Mwongozo wa kuwasilisha maombi kupitia ORS, hatua kwa hatua.",
  },
];
