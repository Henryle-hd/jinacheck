"use client";

/**
 * Light / dark switch.
 *
 * Deliberately holds no React state. The current theme lives on the `data-theme`
 * attribute of <html>, set before first paint by the inline script in the layout,
 * and which icon shows is decided in CSS by the `dark:` variant. That keeps the
 * button correct on the very first render, with no hydration mismatch and no
 * flash of the wrong icon.
 */
export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private browsing can refuse storage; the toggle still works for this visit.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title="Switch between light and dark"
      aria-label="Switch between light and dark"
      className="rounded-full border border-line bg-surface p-2 text-muted transition-colors hover:text-ink"
    >
      {/* moon while light: click for dark */}
      <svg viewBox="0 0 16 16" className="size-4 dark:hidden" aria-hidden>
        <path
          d="M13.5 10.2A6 6 0 0 1 5.8 2.5a6 6 0 1 0 7.7 7.7Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      {/* sun while dark: click for light */}
      <svg viewBox="0 0 16 16" className="hidden size-4 dark:block" aria-hidden>
        <circle cx="8" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.4" />
        <g stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
          <path d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3.1 3.1l1.3 1.3M11.6 11.6l1.3 1.3M12.9 3.1l-1.3 1.3M4.4 11.6l-1.3 1.3" />
        </g>
      </svg>
    </button>
  );
}
