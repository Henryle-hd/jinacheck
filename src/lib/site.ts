/** Canonical site identity, used for metadata and share previews. */

export const SITE_NAME = "JinaCheck";

/**
 * Absolute base URL. Open Graph images and canonical links must be absolute, so
 * this resolves from the explicit env var first, then whatever the host injects,
 * and finally localhost so previews still work in development.
 */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
