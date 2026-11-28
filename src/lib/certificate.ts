// Certificate helpers (pure, unit tested).

/** Platform estimate from the raw percent. Deliberately NOT the official MS grade scale. */
export function levelOf(percent: number): { code: string; label: string } {
  if (percent >= 85) return { code: "A", label: "A’lo" };
  if (percent >= 70) return { code: "B", label: "Yaxshi" };
  if (percent >= 50) return { code: "C", label: "Qoniqarli" };
  return { code: "D", label: "Boshlang‘ich" };
}

/** "Shohrux Muminov" → "Shohrux M." — public verification shows only this. */
export function maskName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "—";
  const [first, ...rest] = parts;
  return rest.length ? `${first} ${rest[rest.length - 1][0].toUpperCase()}.` : first;
}

const SERIAL_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TOKEN_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Picks characters with a CSPRNG-supplied byte source (tests pass a fake one). */
function pick(chars: string, len: number, bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < len; i++) s += chars[bytes[i] % chars.length];
  return s;
}

export function makeSerial(year: number, bytes: Uint8Array): string {
  return `MM-${year}-${pick(SERIAL_CHARS, 6, bytes)}`;
}

export function makeToken(len: number, bytes: Uint8Array): string {
  return pick(TOKEN_CHARS, len, bytes);
}

/**
 * The built-in PDF fonts only cover WinAnsi. Uzbek apostrophes (o‘, g‘, ’, ʼ) and dashes are
 * mapped to plain ASCII so the text never breaks the PDF.
 */
export function pdfSafe(s: string): string {
  return s
    .normalize("NFC")
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/·/g, "-")
    .replace(/…/g, "...")
    .replace(/№\s?/g, "No. ")
    .replace(/[^\x20-\x7E -ÿ]/g, "");
}

/** Uzbekistan date "28.11.2026". */
export function uzDate(ms: number): string {
  const d = new Date(ms + 5 * 3600_000);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

/** Uzbekistan hour 0–23 — for quiet hours. */
export function uzHour(ms: number): number {
  return new Date(ms + 5 * 3600_000).getUTCHours();
}

/** Quiet window [from, to) in Uzbekistan hours; wraps past midnight (22 → 7). */
export function inQuietHours(hour: number, from: number | null, to: number | null): boolean {
  if (from == null || to == null || from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}
