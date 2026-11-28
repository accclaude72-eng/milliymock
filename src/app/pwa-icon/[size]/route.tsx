import { ImageResponse } from "next/og";

const SIZES = { "192": 192, "512": 512, "maskable-512": 512, "apple-180": 180 } as const;

/**
 * App icons for the web manifest / home screen, drawn from the logo (paper, ink "M", accent dot).
 * "maskable" keeps the mark inside the 80% safe zone so launchers can crop it to any shape.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const key = (await params).size as keyof typeof SIZES;
  const px = SIZES[key];
  if (!px) return new Response("not found", { status: 404 });
  const maskable = key.startsWith("maskable");
  const mark = Math.round(px * (maskable ? 0.5 : 0.62));
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f0e8" }}>
      <div
        style={{
          width: mark,
          height: mark,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `${Math.max(3, Math.round(px / 48))}px solid #141412`,
          background: "#fbfaf6",
          position: "relative",
        }}
      >
        <span style={{ fontSize: Math.round(mark * 0.62), fontWeight: 800, color: "#141412", lineHeight: 1, fontFamily: "monospace" }}>M</span>
        <span
          style={{
            position: "absolute",
            right: Math.round(mark * 0.1),
            bottom: Math.round(mark * 0.1),
            width: Math.round(mark * 0.2),
            height: Math.round(mark * 0.2),
            borderRadius: "50%",
            background: "#b8321a",
            border: `${Math.max(2, Math.round(px / 96))}px solid #141412`,
          }}
        />
      </div>
    </div>,
    { width: px, height: px, headers: { "Cache-Control": "public, max-age=604800, immutable" } },
  );
}
