import { neon } from "@neondatabase/serverless";

import type { Entity, RiskBand, SearchScope } from "./types";
import type { RequestMeta } from "./request-meta";

/**
 * Postgres persistence.
 *
 * Two jobs, kept apart on purpose:
 *
 *   `register_entities` accumulates the register itself, in the shape BRELA
 *   publishes, so the corpus grows every time somebody searches. BRELA stays the
 *   source of truth for anything new; this is a mirror that fills in behind it.
 *
 *   `searches` records what was asked and how it went, with coarse context. It
 *   holds no IP, no raw User-Agent and no city. See request-meta.ts.
 *
 * Every entity in a result set is written, however many that is, in chunks so a
 * six-figure result never becomes one enormous statement. All of it runs after
 * the response has gone out, and a database failure is logged and swallowed:
 * the register search must not break because persistence did.
 */

const url = process.env.DATABASE_URL;
const sql = url ? neon(url) : null;

export function dbEnabled(): boolean {
  return Boolean(sql);
}

/** Schema is created on demand once per process, not on every write. */
const globalDb = globalThis as typeof globalThis & { __jinacheckSchema?: Promise<void> };

async function ensureSchema(): Promise<void> {
  if (!sql) return;
  globalDb.__jinacheckSchema ??= (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS register_entities (
        uid              text PRIMARY KEY,
        entity_id        bigint,
        object_type      text NOT NULL,
        legal_name       text NOT NULL,
        distinctive_core text,
        subtype_name     text,
        company_subtype  text,
        cert_number      text,
        tracking_no      text,
        reg_date         text,
        incorporation_date text,
        reg_status       text,
        reg_status_name  text,
        ba_category      text,
        address          text,
        region           text,
        district         text,
        ward             text,
        postcode         text,
        street           text,
        cess_date        text,
        update_date      text,
        has_charges      boolean DEFAULT false,
        reg_year         int,
        first_seen_at    timestamptz NOT NULL DEFAULT now(),
        last_seen_at     timestamptz NOT NULL DEFAULT now()
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS register_entities_name_idx ON register_entities (legal_name)`;
    await sql`CREATE INDEX IF NOT EXISTS register_entities_core_idx ON register_entities (distinctive_core)`;
    await sql`CREATE INDEX IF NOT EXISTS register_entities_region_idx ON register_entities (region)`;

    await sql`
      CREATE TABLE IF NOT EXISTS searches (
        id            bigserial PRIMARY KEY,
        created_at    timestamptz NOT NULL DEFAULT now(),
        query_name    text,
        query_core    text,
        terms         text[],
        scope         text,
        depth         text,
        result_count  int,
        top_score     int,
        verdict_band  text,
        flag_ids      text[],
        duration_ms   int,
        from_cache    boolean,
        truncated     boolean,
        lang          text,
        country       text,
        region        text,
        device_type   text,
        os            text,
        browser       text,
        visitor_hash  text
      )
    `;
    await sql`CREATE INDEX IF NOT EXISTS searches_created_idx ON searches (created_at DESC)`;
    await sql`CREATE INDEX IF NOT EXISTS searches_core_idx ON searches (query_core)`;

    // How many entries each search was the first to turn up. This is the
    // corpus-growth signal: when it trends to zero for a term, our copy of that
    // slice of the register is complete.
    //
    // Deliberately not stored per entity. Which query surfaced a row first is a
    // fact about who searched what and in which order, not about the register,
    // and nothing reads it.
    await sql`ALTER TABLE searches ADD COLUMN IF NOT EXISTS new_entities int`;
  })();

  return globalDb.__jinacheckSchema;
}

/** Rows per INSERT. Keeps statements well inside Postgres parameter limits. */
const CHUNK = 250;

/**
 * Run `fn`, retrying once after a short pause.
 *
 * Persistence is best-effort by design: nothing here is on the path of anything
 * the user sees, and the next search over the same ground will write whatever
 * this attempt missed. So a second failure is swallowed rather than escalated.
 */
async function attempt(fn: () => Promise<void>, label: string): Promise<void> {
  for (let i = 0; i < 2; i++) {
    try {
      await fn();
      return;
    } catch (err) {
      if (i === 1) {
        console.warn(`[jinacheck] ${label} gave up after 2 tries`, err);
        return;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }
}

/**
 * Mirror a result set into the register table.
 *
 * Rows already held are left alone: the ON CONFLICT clause only writes when a
 * field actually differs, so a repeat search over 100,000 known entries costs
 * one no-op statement per chunk instead of 100,000 rewrites. New entries are
 * the only ones that turn into work, which is what makes the corpus cheap to
 * keep growing.
 *
 * The guard is on real fields rather than DO NOTHING because a company can
 * close or move: those changes still need to land, and only those do.
 */
export async function upsertEntities(
  entities: Entity[],
  cores: Map<string, string>,
): Promise<number> {
  if (!sql || !entities.length) return 0;
  await ensureSchema();

  let inserted = 0;
  for (let i = 0; i < entities.length; i += CHUNK) {
    const chunk = entities.slice(i, i + CHUNK);
    await attempt(async () => {
    const rows = chunk.map((e) => [
      e.uid,
      e.id,
      e.objectType,
      e.name,
      cores.get(e.uid) ?? null,
      e.subtype,
      e.subtypeCode,
      e.certNumber,
      e.trackingNo,
      e.regDate,
      e.incorporationDate,
      e.statusCode,
      e.status,
      e.baCategory,
      e.address,
      e.location.region,
      e.location.district,
      e.location.ward,
      e.location.postcode,
      e.location.street,
      e.cessDate,
      e.updateDate,
      e.hasCharges,
      e.year,
    ]);

    const returned = (await sql`
      INSERT INTO register_entities (
        uid, entity_id, object_type, legal_name, distinctive_core, subtype_name,
        company_subtype, cert_number, tracking_no, reg_date, incorporation_date,
        reg_status, reg_status_name, ba_category, address, region, district,
        ward, postcode, street, cess_date, update_date, has_charges, reg_year
      )
      SELECT * FROM unnest(
        ${rows.map((r) => r[0])}::text[],
        ${rows.map((r) => r[1])}::bigint[],
        ${rows.map((r) => r[2])}::text[],
        ${rows.map((r) => r[3])}::text[],
        ${rows.map((r) => r[4])}::text[],
        ${rows.map((r) => r[5])}::text[],
        ${rows.map((r) => r[6])}::text[],
        ${rows.map((r) => r[7])}::text[],
        ${rows.map((r) => r[8])}::text[],
        ${rows.map((r) => r[9])}::text[],
        ${rows.map((r) => r[10])}::text[],
        ${rows.map((r) => r[11])}::text[],
        ${rows.map((r) => r[12])}::text[],
        ${rows.map((r) => r[13])}::text[],
        ${rows.map((r) => r[14])}::text[],
        ${rows.map((r) => r[15])}::text[],
        ${rows.map((r) => r[16])}::text[],
        ${rows.map((r) => r[17])}::text[],
        ${rows.map((r) => r[18])}::text[],
        ${rows.map((r) => r[19])}::text[],
        ${rows.map((r) => r[20])}::text[],
        ${rows.map((r) => r[21])}::text[],
        ${rows.map((r) => r[22])}::boolean[],
        ${rows.map((r) => r[23])}::int[]
      )
      ON CONFLICT (uid) DO UPDATE SET
        legal_name       = EXCLUDED.legal_name,
        distinctive_core = EXCLUDED.distinctive_core,
        reg_status       = EXCLUDED.reg_status,
        reg_status_name  = EXCLUDED.reg_status_name,
        address          = EXCLUDED.address,
        region           = EXCLUDED.region,
        district         = EXCLUDED.district,
        cess_date        = EXCLUDED.cess_date,
        update_date      = EXCLUDED.update_date,
        has_charges      = EXCLUDED.has_charges,
        last_seen_at     = now()
      WHERE
        register_entities.legal_name      IS DISTINCT FROM EXCLUDED.legal_name
        OR register_entities.reg_status   IS DISTINCT FROM EXCLUDED.reg_status
        OR register_entities.address      IS DISTINCT FROM EXCLUDED.address
        OR register_entities.cess_date    IS DISTINCT FROM EXCLUDED.cess_date
        OR register_entities.has_charges  IS DISTINCT FROM EXCLUDED.has_charges
      RETURNING (xmax = 0) AS is_new
    `) as Array<{ is_new: boolean }>;
      inserted += returned.filter((r) => r.is_new).length;
    }, `upsert chunk ${i / CHUNK}`);
  }
  return inserted;
}

export interface SearchLog {
  queryName: string;
  queryCore: string;
  terms: string[];
  scope: SearchScope;
  depth: string;
  resultCount: number;
  topScore: number;
  verdictBand: RiskBand;
  flagIds: string[];
  durationMs: number;
  fromCache: boolean;
  truncated: boolean;
  lang: string | null;
  meta: RequestMeta;
}

/** Record one search event. */
export async function recordSearch(log: SearchLog): Promise<number | null> {
  if (!sql) return null;
  await ensureSchema();

  let id: number | null = null;
  await attempt(async () => {
    const rows = (await sql`
    INSERT INTO searches (
      query_name, query_core, terms, scope, depth, result_count, top_score,
      verdict_band, flag_ids, duration_ms, from_cache, truncated, lang,
      country, region, device_type, os, browser, visitor_hash
    ) VALUES (
      ${log.queryName}, ${log.queryCore}, ${log.terms}, ${log.scope}, ${log.depth},
      ${log.resultCount}, ${log.topScore}, ${log.verdictBand}, ${log.flagIds},
      ${log.durationMs}, ${log.fromCache}, ${log.truncated}, ${log.lang},
      ${log.meta.country}, ${log.meta.region}, ${log.meta.deviceType},
      ${log.meta.os}, ${log.meta.browser}, ${log.meta.visitorHash}
    )
    RETURNING id
    `) as Array<{ id: number }>;
    id = rows[0]?.id ?? null;
  }, "record search");
  return id;
}

/** Note how many entries this search was the first to turn up. */
export async function setSearchContribution(searchId: number, added: number): Promise<void> {
  if (!sql) return;
  await attempt(async () => {
    await sql`UPDATE searches SET new_entities = ${added} WHERE id = ${searchId}`;
  }, "search contribution");
}

/** How much of the register we have mirrored so far. */
export async function registerSize(): Promise<number | null> {
  if (!sql) return null;
  await ensureSchema();
  const rows = (await sql`SELECT count(*)::int AS n FROM register_entities`) as Array<{ n: number }>;
  return rows[0]?.n ?? 0;
}
