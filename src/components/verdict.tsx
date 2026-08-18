"use client";

import { useState } from "react";

import type { SearchResponse } from "@/lib/types";
import { useCopy } from "./lang";
import { BAND_META, Dot } from "./ui";

/**
 * The answer, in one line.
 *
 * Everything that supports it — the statutory flags, the terms we probed, the
 * words we ignored — is folded away behind a single "why" toggle, so the page
 * leads with the conclusion rather than the evidence.
 */
export function VerdictLine({ data }: { data: SearchResponse }) {
  const { t } = useCopy();
  const [open, setOpen] = useState(false);
  const { verdict, flags, query } = data;
  const band = BAND_META[verdict.band];

  /**
   * Rendered here rather than taken from the API response: the server sends the
   * counts, so both languages can phrase the sentence naturally instead of
   * translating a fixed English string.
   */
  const headline = t.headline[verdict.band] ?? verdict.headline;
  const summary =
    verdict.identicalCount > 0
      ? t.summaryIdentical(verdict.identicalCount)
      : verdict.topScore >= 88
        ? t.summaryNearIdentical
        : verdict.topScore >= 78
          ? t.summaryQuery(verdict.highRiskCount)
          : verdict.topScore >= 60
            ? t.summaryTighten
            : data.results.length
              ? t.summaryAvailable
              : t.summaryNothing(query.core || query.name);

  const blockers = flags.filter((f) => f.severity === "blocker");
  const hasDetail = flags.length > 0 || query.variants.length > 0 || query.ignored.length > 0;

  return (
    <section className="border-b border-line pb-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="flex items-center gap-2">
          <Dot band={verdict.band} />
          <span className={`text-[14px] font-semibold ${band.fg}`}>{headline}</span>
        </span>
        <span className="text-[14px] text-ink-soft">
          {summary}
          {flags.length > 0 && verdict.band !== "critical" ? ` ${t.summaryRuleNote}` : ""}
        </span>
      </div>

      {blockers.length > 0 && !open && (
        <p className="mt-1 text-[13px] text-muted">
          {blockers[0].title}
          {blockers.length > 1 && ` (+${blockers.length - 1} more rule issue${blockers.length > 2 ? "s" : ""})`}
        </p>
      )}

      {hasDetail && (
        <button
          onClick={() => setOpen((s) => !s)}
          className="mt-1 text-[13px] text-accent hover:underline"
          aria-expanded={open}
        >
          {open ? t.hideDetail : t.why}
        </button>
      )}

      {open && (
        <div className="mt-3 space-y-3 text-[13px]">
          {flags.length > 0 && (
            <ul className="space-y-2">
              {flags.map((f) => (
                <li key={f.id + f.title} className="flex gap-2">
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                      f.severity === "blocker"
                        ? "bg-critical"
                        : f.severity === "warning"
                          ? "bg-high"
                          : "bg-low"
                    }`}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="font-medium text-ink">{f.title}.</span>{" "}
                    <span className="text-muted">{f.detail}</span>
                    {f.authority && <span className="text-faint"> See {f.authority}.</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <p className="text-[12px] leading-relaxed text-faint">
            {t.searchedCore}{" "}
            <span className="font-mono text-muted">{query.core || "—"}</span>
            {query.variants.length > 0 && (
              <>
                {" "}
                {t.plusHomophones}{" "}
                <span className="font-mono text-muted">{query.variants.join(", ")}</span>
              </>
            )}
            {query.ignored.length > 0 && (
              <>
                . Ignored{" "}
                <span className="font-mono text-muted">
                  {query.ignored.slice(0, 8).join(", ")}
                </span>{" "}
                {t.ignoredWords}
              </>
            )}
            .{" "}
            {query.scope === "all"
              ? t.bothRegisters
              : query.scope === "ET-COMPANY"
                ? t.onlyCompanyRegister
                : t.onlyBusinessRegister}{" "}
            {data.meta.pool.toLocaleString()} {t.entriesExamined}
            {data.meta.cached ? ` ${t.cached}` : ` in ${(data.meta.ms / 1000).toFixed(1)}s`}
            {data.meta.truncated && `; ${t.heldMore}`}.
          </p>
        </div>
      )}
    </section>
  );
}
