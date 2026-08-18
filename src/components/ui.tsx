"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import type { ObjectType, RiskBand } from "@/lib/types";

/** How each register is described to the user. */
export const REGISTER_LABEL: Record<ObjectType, string> = {
  "ET-COMPANY": "Company",
  "ET-BUSINESS": "Business name",
};

/** Per-band text colour. The wording lives in the copy table, for translation. */
export const BAND_META: Record<RiskBand, { fg: string }> = {
  critical: { fg: "text-critical" },
  high: { fg: "text-high" },
  medium: { fg: "text-medium" },
  low: { fg: "text-low" },
  clear: { fg: "text-clear" },
};

/**
 * Copy to clipboard, with a fallback.
 *
 * `navigator.clipboard` only exists in a secure context, so a deployment served
 * over plain http would silently have a dead button. The textarea route is the
 * old execCommand trick, kept for exactly that case.
 */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Copy button with a choice of what to copy.
 *
 * A register entry is useful two ways: the bare name, to paste into a form, and
 * the whole record, to keep alongside it. Rather than guess, the button opens a
 * short menu. It stays visible while that menu is open, otherwise it would
 * vanish the moment the pointer left the row.
 */
export function CopyMenu({
  options,
  label = "Copy",
  doneLabel = "Copied",
}: {
  options: Array<{ label: string; value: string }>;
  label?: string;
  doneLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
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

  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => setDone(false), 1600);
    return () => clearTimeout(id);
  }, [done]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((s) => !s);
        }}
        title={done ? doneLabel : label}
        aria-label={label}
        aria-expanded={open}
        className={`shrink-0 rounded p-1 transition-opacity hover:bg-raised focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${
          done ? "text-clear sm:opacity-100" : "text-faint hover:text-ink"
        } ${open ? "bg-raised text-ink sm:opacity-100" : ""}`}
      >
        {done ? (
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
            <path
              d="M3.5 8.5l3 3 6-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : (
          <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
            <rect
              x="5.5"
              y="5.5"
              width="8"
              height="8"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M10.5 3.5v-1a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-1 w-max min-w-32 overflow-hidden rounded-lg border border-line bg-surface py-1 shadow-(--shadow-md)">
          {options.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={async (e) => {
                e.stopPropagation();
                setOpen(false);
                setDone(await copyText(o.value));
              }}
              className="block w-full px-3 py-1.5 text-left text-[13px] text-ink-soft hover:bg-raised hover:text-ink"
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The conflict score, doing the job the coloured dot used to.
 *
 * Set in a fixed-width column so the names beside it stay in a straight line
 * whether the score is 7 or 100, and in tabular figures so the digits do not
 * shift about between rows.
 */
export function Score({
  score,
  band,
  title,
}: {
  score: number;
  band: RiskBand;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`tnum w-9 shrink-0 text-right text-[19px] leading-none font-semibold tracking-tight ${BAND_META[band].fg}`}
    >
      {score}
    </span>
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
