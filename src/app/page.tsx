import { SearchApp } from "@/components/search-app";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <>
      <div className="flex shrink-0 justify-end px-4 pt-3 sm:px-6">
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
            href="https://ors.brela.go.tz/"
            target="_blank"
            rel="noreferrer noopener"
            className="hover:text-accent hover:underline"
          >
            BRELA public register
          </a>
          . Risk scores are guidance based on the Companies Act (Cap. 212) and the Business Names
          (Registration) Act (Cap. 213). They are not a legal determination, and checking a name
          here does not reserve it. The Registrar decides.
        </p>
      </footer>
    </>
  );
}
