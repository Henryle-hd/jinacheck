"use client";

import { GITHUB_URL } from "@/lib/links";
import { useCopy } from "./lang";

/**
 * Link to the repository, with the ask spelled out.
 *
 * The bare octocat told you where the source was but not what to do there, so
 * the word rides alongside it. It points at the repo rather than GitHub's
 * one-click star endpoint, which only works if you are already signed in.
 */
export function GitHubStar() {
  const { t } = useCopy();

  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noreferrer noopener"
      title={t.sourceOnGitHub}
      className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1.5 pr-3 pl-2.5 text-muted transition-colors hover:border-line-strong hover:text-ink"
    >
      <svg viewBox="0 0 16 16" className="size-4 shrink-0" fill="currentColor" aria-hidden>
        <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38l-.01-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-2.92-.88-2.92-2.84 0-.63.22-1.15.59-1.55-.04-.2-.26-.98.06-2.03 0 0 .61-.2 2.01.75a6.9 6.9 0 0 1 3.66 0c1.4-.95 2.01-.75 2.01-.75.32 1.05.1 1.83.06 2.03.37.4.59.92.59 1.55 0 1.97-1.15 2.64-2.93 2.83.3.26.56.76.56 1.53l-.01 2.27c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
      </svg>
      <span className="text-[12px] font-medium">{t.star}</span>
    </a>
  );
}
