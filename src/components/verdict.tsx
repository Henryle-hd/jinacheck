"use client";

import { useState } from "react";

import type { SearchResponse } from "@/lib/types";
import { BAND_META, Dot } from "./ui";

/**
 * The answer, in one line.
 *
 * Everything that supports it — the statutory flags, the terms we probed, the
 * words we ignored — is folded away behind a single "why" toggle, so the page
 * leads with the conclusion rather than the evidence.
 */
export function VerdictLine({ data }: { data: SearchResponse }) {
  const [open, setOpen] = useState(false);
  const { verdict, flags, query } = data;
  const band = BAND_META[verdict.band];

  const blockers = flags.filter((f) => f.severity === "blocker");
  const hasDetail = flags.length > 0 || query.variants.length > 0 || query.ignored.length > 0;

  return (
    <section className="border-b border-line pb-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="flex items-center gap-2">
          <Dot band={verdict.band} />
          <span className={`text-[14px] font-semibold ${band.fg}`}>{verdict.headline}</span>
        </span>
        <span className="text-[14px] text-ink-soft">{verdict.summary}</span>
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
          {open ? "Hide detail" : "Why"}
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
            Searched the distinctive core{" "}
            <span className="font-mono text-muted">{query.core || "—"}</span>
            {query.variants.length > 0 && (
              <>
                {" "}
                plus homophone spellings{" "}
                <span className="font-mono text-muted">{query.variants.join(", ")}</span>
              </>
            )}
            {query.ignored.length > 0 && (
              <>
                . Ignored{" "}
                <span className="font-mono text-muted">
                  {query.ignored.slice(0, 8).join(", ")}
                </span>{" "}
                as legal-form or descriptive wording
              </>
            )}
            .{" "}
            {query.scope === "all"
              ? "Both the company and business-name registers were searched."
              : query.scope === "ET-COMPANY"
                ? "Only the company register was searched. Switch to All to include business names, which can conflict too."
                : "Only the business-name register was searched. Switch to All to include companies, which can conflict too."}{" "}
            {data.meta.pool.toLocaleString()} entries examined
            {data.meta.cached ? " (cached)" : ` in ${(data.meta.ms / 1000).toFixed(1)}s`}
            {data.meta.truncated && "; the register held more, so try a deeper search"}.
          </p>
        </div>
      )}
    </section>
  );
}
