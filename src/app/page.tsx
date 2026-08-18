import { SearchApp } from "@/components/search-app";
import { LangProvider, LangToggle } from "@/components/lang";
import { ThemeToggle } from "@/components/theme-toggle";
import { Footer } from "@/components/footer";
import { GitHubStar } from "@/components/github-star";

export default function Home() {
  return (
    <LangProvider>
      <div className="flex shrink-0 items-center justify-end gap-2 px-4 pt-3 sm:px-6">
        <LangToggle />
        <GitHubStar />
        <ThemeToggle />
      </div>

      {/* flex column so the landing state can centre itself in the space left
          over above the footer */}
      <main className="flex flex-1 flex-col">
        <SearchApp />
      </main>

      <Footer />
    </LangProvider>
  );
}
