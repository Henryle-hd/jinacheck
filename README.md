# JinaCheck

Smart name-clearance search over Tanzania's BRELA public business register.

BRELA's official public search works, but it is a plain substring match with no
ranking. Type the name you actually want to register — `NIKA GROUP LIMITED` — and
it returns nothing, because no entry contains that exact run of characters. Type
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
like `QUICKLEE DIGITAL EXPERIENCES` is invisible to anyone checking as a company —
it returns zero results. Both registers are always searched, and each hit is
labelled with the register it came from. The Company / Business name toggle only
decides which naming rules apply to *your* name.

**Catches names that only sound the same.** The upstream search is substring-only,
so `NYIKA` can never surface `NIKA COMPANY LIMITED` — yet those two collide
squarely under the "calculated to deceive" test. Homophone spellings are probed
alongside the literal tokens (`NYIKA` → `NIKA`, `NYICA`, …), and matches are
scored with a phonetic key tuned for Swahili orthography.

**Scores conflict risk 0–100.** Identical cores rank above homophones, which rank
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

No API keys and no database — the register is queried live.

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

## Upstream behaviour worth knowing

All confirmed against the live endpoint
(`POST https://ors.brela.go.tz/orsreg/list/search/businesspublic.json`):

- The response is columnar: `Map` holds column names, `Records` holds arrays.
  Fields are mapped by name so an upstream column re-order can't shift data.
- Latency scales with how many rows match, not page size. A narrow distinctive
  term returns in well under a second; `group` (5,794 matches) takes ~15–30s.
  This is the main reason searching the distinctive core is both more accurate
  *and* much faster.
- Paging is stable and non-overlapping, so pages are fetched in parallel with a
  bounded request budget.
- Terms under 3 characters make the upstream SQL time out and return
  `{"error": "Execution Timeout Expired..."}` with **HTTP 200** — errors have to
  be detected in the body, not the status code.
- Results are cached in-process for 30 minutes, so filtering and sorting after a
  search never re-pay upstream latency.

## Scope

Risk scores and rule flags are decision-support heuristics modelled on the tests
in the Companies Act (Cap. 212) and the Business Names (Registration) Act
(Cap. 213). They are not a legal determination and not a name reservation — the
Registrar has discretion and the final say. Entries may also be absent from the
public search.
