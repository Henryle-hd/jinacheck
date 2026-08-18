import type { Metadata } from "next";

import { cacheGet } from "@/lib/cache";
import { searchCacheKey, type DepthKey } from "@/lib/search-key";
import type { Entity, SearchScope } from "@/lib/types";
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

/** Query string values the metadata cares about, normalised. */
function readQuery(params: Record<string, string | string[] | undefined>) {
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
  const as = one(params.as);
  const depth = one(params.depth);
  return {
    name: one(params.q).trim().slice(0, 80),
    scope: (as === "company" ? "ET-COMPANY" : as === "business" ? "ET-BUSINESS" : "all") as SearchScope,
    depth: (depth === "quick" || depth === "deep" ? depth : "standard") as DepthKey,
  };
}

/**
 * Per-search metadata, so a shared link says what was checked.
 *
 * The result count is taken from the cache only. Running the search here would
 * mean a link preview waiting on BRELA, which can take half a minute on a
 * common word, so a count appears when one is already to hand and is left out
 * when it is not.
 */
export async function generateMetadata({ searchParams }: PageProps<"/">): Promise<Metadata> {
  const { name, scope, depth } = readQuery(await searchParams);
  if (!name) return {};

  const { key } = searchCacheKey({ name, scope, depth });
  const hit = cacheGet<{ entities: Entity[] }>(key);
  const count = hit?.entities.length;

  const title = count
    ? `${name} | ${count} similar names at BRELA`
    : `${name} | Is this name taken at BRELA?`;

  const description = count
    ? `${count} names on the BRELA register resemble ${name}. See the closest matches, ranked by how likely each is to block it.`
    : `Check whether ${name} is free to register as a company or business name in Tanzania, against both BRELA registers.`;

  const card = new URLSearchParams({ name });
  if (count) card.set("count", String(count));
  const image = `/api/og?${card.toString()}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: `Search for ${name}` }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [{ url: image, alt: `Search for ${name}` }],
    },
  };
}
