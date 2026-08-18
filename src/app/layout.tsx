import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SITE_NAME, siteUrl } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const description =
  "Check whether a company or business name is already taken at BRELA before you file. " +
  "Searches both Tanzanian registers at once, catches names that only sound alike, and " +
  "filters by region, status and year.";

/**
 * Metadata for search engines and link previews.
 *
 * The description says what the tool does and who it is for rather than
 * stuffing keywords: the phrases people actually type ("business name search
 * Tanzania", "is my company name taken BRELA") appear because they describe the
 * thing honestly, not because they were bolted on.
 */
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {
    default: `${SITE_NAME} — check a business name against the BRELA register`,
    template: `%s · ${SITE_NAME}`,
  },
  description,
  applicationName: SITE_NAME,
  keywords: [
    "BRELA name search",
    "business name search Tanzania",
    "company name availability Tanzania",
    "BRELA ORS",
    "usajili wa jina la biashara",
    "kutafuta jina la kampuni Tanzania",
    "company registration Tanzania",
  ],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  // og:image and twitter:image come from opengraph-image.png / twitter-image.png
  // in this directory, with their alt text from the matching .alt.txt files.
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME} — is your business name already taken?`,
    description,
    url: "/",
    locale: "en_TZ",
    alternateLocale: ["sw_TZ"],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} — is your business name already taken?`,
    description,
  },
  category: "business",
};

const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');
if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
