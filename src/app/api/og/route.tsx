import { ImageResponse } from "next/og";

export const runtime = "nodejs";

/** Brand ground for the card. Matches --accent in the light palette. */
const ACCENT = "#0a6b5d";

/**
 * Fit the name to the card.
 *
 * A two-letter name and a nine-word one both have to look deliberate, so the
 * size steps down as the name grows rather than letting long names overflow or
 * short ones look lost.
 */
function fontSizeFor(name: string): number {
  const n = name.length;
  if (n <= 8) return 148;
  if (n <= 14) return 116;
  if (n <= 22) return 88;
  if (n <= 34) return 68;
  return 52;
}

/**
 * The share card for a specific search: GET /api/og?name=AZAM&count=186
 *
 * Rendered per request rather than baked at build time, so a shared link shows
 * the name that was actually checked.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const raw = (searchParams.get("name") ?? "").trim().slice(0, 60);
  const name = raw.toUpperCase() || "YOUR NAME";
  const count = searchParams.get("count");
  const label = searchParams.get("label") ?? "Search for";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: ACCENT,
          padding: "76px 80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              letterSpacing: 6,
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.66)",
            }}
          >
            {label}
          </div>
          <div
            style={{
              display: "flex",
              marginTop: 22,
              fontSize: fontSizeFor(name),
              lineHeight: 1.02,
              fontWeight: 700,
              letterSpacing: -2,
              color: "#ffffff",
            }}
          >
            {name}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 27,
            color: "rgba(255,255,255,0.82)",
          }}
        >
          <div style={{ display: "flex" }}>JinaCheck</div>
          <div style={{ display: "flex" }}>
            {count ? `${count} similar on the BRELA register` : "BRELA name check"}
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
