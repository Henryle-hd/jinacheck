"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { COPY, isLang, LANGS, type Copy, type Lang } from "@/lib/i18n";

const LangContext = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: Copy }>({
  lang: "en",
  setLang: () => {},
  t: COPY.en,
});

export function useCopy() {
  return useContext(LangContext);
}

/**
 * Holds the chosen language and keeps <html lang> honest for screen readers and
 * search engines. The preference is remembered, and a first-time Swahili
 * speaker gets Swahili automatically from their browser settings.
 */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    let next: Lang | null = null;
    try {
      const stored = localStorage.getItem("lang");
      if (isLang(stored)) next = stored;
    } catch {
      // storage unavailable; fall through to the browser preference
    }
    if (!next && typeof navigator !== "undefined") {
      if (navigator.languages?.some((l) => l.toLowerCase().startsWith("sw"))) next = "sw";
    }
    if (!next || next === "en") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads a stored/browser preference that is only available after hydration
    setLangState(next);
    document.documentElement.lang = next;
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.documentElement.lang = l;
    try {
      localStorage.setItem("lang", l);
    } catch {
      // nothing to do; the choice still applies for this visit
    }
  }, []);

  return (
    <LangContext.Provider value={{ lang, setLang, t: COPY[lang] }}>{children}</LangContext.Provider>
  );
}

/** EN / SW switch, sitting alongside the theme and GitHub buttons. */
export function LangToggle() {
  const { lang, setLang } = useCopy();

  return (
    <div
      className="flex items-center overflow-hidden rounded-full border border-line bg-surface"
      role="group"
      aria-label="Language"
    >
      {LANGS.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => setLang(l.value)}
          title={l.title}
          aria-pressed={lang === l.value}
          className={`px-2.5 py-1 text-[11px] font-semibold transition-colors ${
            lang === l.value ? "bg-accent text-white dark:text-[#04231f]" : "text-muted hover:text-ink"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}
