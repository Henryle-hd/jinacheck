import { SearchApp } from "@/components/search-app";
import { ThemeToggle } from "@/components/theme-toggle";
import { BRELA_SEARCH_URL, GITHUB_URL } from "@/lib/links";

export default function Home() {
  return (
    <>
      <div className="flex shrink-0 items-center justify-end gap-2 px-4 pt-3 sm:px-6">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer noopener"
          title="Source on GitHub"
          aria-label="Source on GitHub"
          className="rounded-full border border-line bg-surface p-2 text-muted transition-colors hover:text-ink"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="currentColor" aria-hidden>
            <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-2.92-.88-2.92-2.84 0-.63.22-1.15.59-1.55-.04-.2-.26-.98.06-2.03 0 0 .61-.2 2.01.75a6.9 6.9 0 0 1 3.66 0c1.4-.95 2.01-.75 2.01-.75.32 1.05.1 1.83.06 2.03.37.4.59.92.59 1.55 0 1.97-1.15 2.64-2.93 2.83.3.26.56.76.56 1.53l-.01 2.27c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
          </svg>
        </a>
        <ThemeToggle />
      </div>

      {/* flex column so the landing state can centre itself in the space left
          over above the footer */}
      <main className="flex flex-1 flex-col">
        <SearchApp />
      </main>

      <footer className="mx-auto w-full max-w-3xl px-4 py-5">
        <p className="text-[11px] leading-relaxed text-faint">
          Live data from the{" "}
          <a
            href={BRELA_SEARCH_URL}
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-accent hover:underline"
          >
            BRELA public register
          </a>
          , which you can also search directly. That register only covers entries held in BRELA’s
          Online Registration System, so older registrations may not appear here at all. Risk
          scores and naming flags are our own reading of the Companies Act (Cap. 212) and the
          Business Names (Registration) Act (Cap. 213), not BRELA’s published policy, so treat
          them as a prompt to check rather than an answer. They are not a legal determination,
          and checking a name here does not reserve it. The Registrar decides.
        </p>
      </footer>
    </>
  );
}
