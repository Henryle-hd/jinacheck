"use client";

import { useState } from "react";

import { BRELA_HOWTO_URL, BRELA_ORS_URL, BRELA_SEARCH_URL, FURTHER_READING } from "@/lib/links";
import { useCopy } from "./lang";

/**
 * A thin strip at the bottom of the page.
 *
 * Everything is one wrapped row of links plus a single line of small print. The
 * long statutory notes are real but they are not what someone came here for, so
 * they sit behind a toggle rather than pushing the search box up the screen.
 */
export function Footer() {
  const { t, lang } = useCopy();
  const [open, setOpen] = useState(false);

  const official = [
    { href: BRELA_HOWTO_URL, label: t.howToRegister },
    { href: BRELA_ORS_URL, label: t.registerOnOrs },
    { href: BRELA_SEARCH_URL, label: t.officialSearch },
  ];

  const linkClass = "text-muted transition-colors hover:text-accent hover:underline";

  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
        <nav className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12px]">
          {official.map((l) => (
            <a key={l.href} href={l.href} target="_blank" rel="noreferrer noopener" className={linkClass}>
              {l.label}
            </a>
          ))}

          <span className="text-line-strong" aria-hidden>
            |
          </span>

          {FURTHER_READING.map((r) => (
            <a
              key={r.href}
              href={r.href}
              target="_blank"
              rel="noreferrer noopener"
              title={lang === "sw" ? r.noteSw : r.note}
              className={`${linkClass} ${r.primary ? "font-medium text-ink-soft" : ""}`}
            >
              {r.primary ? `${r.label} (${t.primarySource})` : r.label.replace(/\s*\(.*\)$/, "")}
            </a>
          ))}
        </nav>

        <p className="mt-2.5 text-[11px] leading-relaxed text-faint">
          {t.footerShort}{" "}
          <button
            onClick={() => setOpen((s) => !s)}
            aria-expanded={open}
            className="text-accent hover:underline"
          >
            {open ? t.hide : t.details}
          </button>
        </p>

        {open && (
          <div className="mt-2 space-y-2 border-t border-line pt-2.5">
            <p className="text-[11px] leading-relaxed text-faint">{t.footerProcess}</p>
            <p className="text-[11px] leading-relaxed text-faint">{t.footerDisclaimer}</p>
          </div>
        )}
      </div>
    </footer>
  );
}
