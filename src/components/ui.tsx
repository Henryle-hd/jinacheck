"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import type { MatchKind, ObjectType, RiskBand } from "@/lib/types";

/** How each register is described to the user. */
export const REGISTER_LABEL: Record<ObjectType, string> = {
  "ET-COMPANY": "Company",
  "ET-BUSINESS": "Business name",
};

/** Per-band colour + copy, kept in one place so the whole app agrees. */
export const BAND_META: Record<RiskBand, { label: string; fg: string; dot: string }> = {
  critical: { label: "Likely refused", fg: "text-critical", dot: "bg-critical" },
  high: { label: "Expect a query", fg: "text-high", dot: "bg-high" },
  medium: { label: "Worth tightening", fg: "text-medium", dot: "bg-medium" },
  low: { label: "Looks available", fg: "text-low", dot: "bg-low" },
  clear: { label: "Nothing found", fg: "text-clear", dot: "bg-clear" },
};

export const KIND_LABEL: Record<MatchKind, string> = {
  identical: "Identical",
  phonetic: "Sounds alike",
  "contains-core": "Contains core",
  "starts-with": "Same opening",
  "token-overlap": "Shared word",
  fuzzy: "Similar spelling",
  weak: "Loose",
};

/** Small status dot. Carries the risk colour without shouting. */
export function Dot({ band }: { band: RiskBand }) {
  return (
    <span
      className={`inline-block size-1.5 shrink-0 rounded-full ${BAND_META[band].dot}`}
      aria-hidden
    />
  );
}

export function Chip({ children, tone = "quiet" }: { children: ReactNode; tone?: "quiet" | "accent" }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[11px] leading-4 ${
        tone === "accent" ? "bg-accent-soft text-accent-ink" : "bg-raised text-muted"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * Lightweight popover used for the filter row. Closes on outside click and on
 * Escape, so the filter bar stays out of the way when it is not in use.
 */
export function Popover({
  label,
  active = 0,
  children,
  align = "left",
}: {
  label: string;
  active?: number;
  children: ReactNode;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        aria-expanded={open}
        className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
          active > 0
            ? "border-accent/40 bg-accent-soft text-accent-ink"
            : "border-line text-ink-soft hover:bg-raised"
        }`}
      >
        {label}
        {active > 0 && <span className="tnum text-[11px] font-semibold">{active}</span>}
        <svg viewBox="0 0 10 6" className="size-2 opacity-50" aria-hidden>
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open && (
        <div
          className={`absolute z-30 mt-1.5 max-h-[min(60vh,380px)] w-64 overflow-y-auto rounded-lg border border-line bg-surface p-2 shadow-(--shadow-md) scroll-slim ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
}
