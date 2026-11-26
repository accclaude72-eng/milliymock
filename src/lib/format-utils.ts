/** Display helpers. All timestamps are stored in UTC (ms) and shown in Asia/Tashkent. */

const TZ = "Asia/Tashkent";

function parts(ms: number) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const g = (t: string) => p.find((x) => x.type === t)?.value ?? "";
  return { d: g("day"), m: g("month"), y: g("year"), h: g("hour") === "24" ? "00" : g("hour"), min: g("minute") };
}

/** DD.MM.YYYY */
export function fmtDate(ms: number | null | undefined): string {
  if (!ms) return "—";
  const p = parts(ms);
  return `${p.d}.${p.m}.${p.y}`;
}

/** DD.MM.YYYY HH:mm (24h, Tashkent) */
export function fmtDateTime(ms: number | null | undefined): string {
  if (!ms) return "—";
  const p = parts(ms);
  return `${p.d}.${p.m}.${p.y} ${p.h}:${p.min}`;
}

/** H:MM:SS or MM:SS countdown text. Never negative. */
export function fmtClock(ms: number): string {
  const t = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "2 soat 14 daqiqa" style duration. */
export function fmtDuration(ms: number): string {
  const totalMin = Math.round(Math.max(0, ms) / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h} soat ${m} daqiqa`;
  if (h) return `${h} soat`;
  return `${m} daqiqa`;
}

export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

/** 72.5 → "72,5" (Uzbek decimal comma). */
export function fmtNum(n: number, digits = 1): string {
  const r = Math.round(n * 10 ** digits) / 10 ** digits;
  return String(r).replace(".", ",");
}

export function cx(...c: (string | false | null | undefined)[]): string {
  return c.filter(Boolean).join(" ");
}
