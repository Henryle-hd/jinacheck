# JinaCheck

Smart name-clearance search over Tanzania's BRELA public business register.

BRELA's official public search works, but it is a plain substring match with no
ranking. Type the name you actually want to register, say `NIKA GROUP LIMITED`,
and it returns nothing, because no entry contains that exact run of characters. Type
`nika` and it returns 33 entries in registration order, with a company literally
called `NIKA COMPANY LIMITED` sitting somewhere in the middle.

This app searches the register the way an examiner reads it.

## What it does differently

**Searches the distinctive core, not the whole string.** `NIKA GROUP LIMITED` is
split into legal-form words (`LIMITED`), non-distinctive trade words (`GROUP`),
and the part that actually has to be distinctive (`NIKA`). Only the last one is
worth searching, so that is what gets sent upstream.

**Searches both registers at once.** BRELA keeps companies and business names in
separate silos and its public search makes you pick one, so a live business name
like `QUICKLEE DIGITAL EXPERIENCES` is invisible to anyone checking as a company.
It returns zero results. Here the default searches both, and each hit is
labelled with the register it came from. You can narrow to Companies or Business
names when you want to, and that choice also applies that register's naming
rules: a company needs "Limited", a business name must not use it.

**Catches names that only sound the same.** The upstream search is substring-only,
so `NYIKA` can never surface `NIKA COMPANY LIMITED`, yet those two collide
squarely under the "calculated to deceive" test. Homophone spellings are probed
alongside the literal tokens (`NYIKA` → `NIKA`, `NYICA`, …), and matches are
scored with a phonetic key tuned for Swahili orthography.

**Scores conflict risk from 0 to 100.** Identical cores rank above homophones, which rank
above shared openings, which rank above loose substring noise. `TANGANYIKA
ESTATE AGENTS` contains "nyika" but scores 30, not 90.

**Filters on what the register buries.** Region, district, status, legal form and
year are parsed out of the free-text `address` column and computed over a large
candidate pool, so narrowing by location reflects the whole result set rather
than the first page of ten.

**Flags the naming rules.** Reserved words (`BANK`, `INSURANCE`, `UNIVERSITY`),
missing `Limited`, `Limited` on a business name, wholly descriptive names, and
Government-implying wording are each flagged with the statute behind them.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

No API keys and no database. The register is queried live.

## Layout

```
src/
  app/
    page.tsx              landing + results shell
    api/search/route.ts   orchestrates: parse → flag → probe → score → facet
  lib/
    brela.ts              upstream client, columnar decode, parallel paging
    name.ts               core extraction, generic/legal wordlists, homophones
    similarity.ts         Jaro-Winkler, Levenshtein, Swahili phonetic key
    score.ts              conflict scoring + overall verdict
    rules.ts              statutory naming checks
    cache.ts              TTL cache + single-flight
  components/             search UI, filter bar, result rows
```

## Checking a result yourself

Every result comes from BRELA's own public register, which you can search
directly at [ors.brela.go.tz/orsreg/searchbusinesspublic][brela]. Pick the
Company or Business name tab there to look up an entry and compare.

Worth knowing before trusting a clear result: that search only covers records
held in the Online Registration System, or ones that have since been migrated
into it through a data update or annual return filing. Anything still only on
paper will not appear, in this app or on BRELA's own page. BRELA directs you to
its "Request for a custom search result" e-service, or to a BRELA office, for
the rest.

[brela]: https://ors.brela.go.tz/orsreg/searchbusinesspublic

## Upstream behaviour worth knowing

Observed against the live register, and the reason the client is built the way
it is:

- Responses are columnar: one list of column names, then rows as plain arrays.
  Fields are mapped by name, so a column re-order upstream can't shift data.
- Latency scales with how many rows match, not with page size. A narrow
  distinctive term returns in well under a second, while `group` (5,794 matches)
  takes 15 to 30 seconds. This is the main reason searching the distinctive core
  is both more accurate *and* much faster.
- Paging is stable and non-overlapping, so pages are fetched in parallel under a
  bounded request budget.
- Terms under 3 characters make the upstream query time out, and the failure
  comes back with **HTTP 200** and an error in the body. Errors have to be
  detected by reading the body, not the status code.
- Results are cached in-process for 30 minutes, so filtering and sorting after a
  search never re-pay upstream latency.

## Scope

Risk scores and naming flags are our own reading of the Companies Act (Cap. 212)
and the Business Names (Registration) Act (Cap. 213). They were **not**
transcribed from BRELA's published guidance, and they carry no section numbers
because those were not verified against the statute text. Where the register
could settle a question it was checked, and one rule did not survive: business
names using "Limited" are unusual but demonstrably accepted (around 37 sit on the
register), so that is a note rather than a bar.

They are not a legal determination, and they do not reserve a name. The Registrar
has discretion and the final say. Entries may also be absent from the public
search.
