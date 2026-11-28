"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx, fmtDateTime } from "@/lib/format-utils";
import { THEMES, THEME_PREVIEW_KEY, type ThemeId, type ThemeInfo, themeInfo } from "@/lib/themes";

interface State {
  theme: ThemeId;
  changedAt: string | null;
}

/** Per-theme look of the mini mock-up on each card (fonts, corners, card style). */
const MOCK: Record<ThemeId, { font: string; head: string; radius: number; btnRadius: number; card: string; extra?: React.CSSProperties }> = {
  default: { font: "var(--font-plex-sans)", head: "var(--font-newsreader)", radius: 3, btnRadius: 3, card: "1.5px solid #141412", extra: { boxShadow: "3px 3px 0 #141412" } },
  aurora: { font: "var(--font-sora)", head: "var(--font-sora)", radius: 14, btnRadius: 999, card: "1px solid rgba(255,255,255,.14)", extra: { boxShadow: "0 10px 30px -10px rgba(139,92,246,.8)" } },
  samarqand: { font: "var(--font-manrope)", head: "var(--font-playfair)", radius: 10, btnRadius: 999, card: "1px solid #e0a526" },
  minimal: { font: "var(--font-manrope)", head: "var(--font-manrope)", radius: 16, btnRadius: 10, card: "0" },
  terminal: { font: "var(--font-jet)", head: "var(--font-jet)", radius: 0, btnRadius: 0, card: "1px dashed #39ff14" },
  konfet: { font: "var(--font-nunito)", head: "var(--font-baloo)", radius: 20, btnRadius: 999, card: "2px solid #fbe2e8", extra: { boxShadow: "0 10px 24px -12px rgba(255,79,139,.5)" } },
  okean: { font: "var(--font-outfit)", head: "var(--font-outfit)", radius: 18, btnRadius: 999, card: "1px solid rgba(46,230,197,.35)", extra: { boxShadow: "0 12px 30px -12px rgba(46,230,197,.55)" } },
  brutal: { font: "var(--font-grotesk)", head: "var(--font-grotesk)", radius: 6, btnRadius: 6, card: "3px solid #000", extra: { boxShadow: "5px 5px 0 #000" } },
  sahro: { font: "var(--font-outfit)", head: "var(--font-fraunces)", radius: 4, btnRadius: 999, card: "1px solid #d9b98f", extra: { boxShadow: "0 10px 24px -14px rgba(194,86,43,.5)" } },
  kiber: { font: "var(--font-grotesk)", head: "var(--font-grotesk)", radius: 0, btnRadius: 0, card: "1px solid #ff2bd6", extra: { boxShadow: "4px 4px 0 #f9f002" } },
  bahor: { font: "var(--font-outfit)", head: "var(--font-dmserif)", radius: 22, btnRadius: 999, card: "1px solid #cdebd8", extra: { boxShadow: "0 12px 28px -16px rgba(31,157,97,.45)" } },
};

function Mock({ t }: { t: ThemeInfo }) {
  const [bg, surface, text, accent, second] = t.swatch;
  const m = MOCK[t.id];
  const bgImage =
    t.id === "aurora"
      ? `radial-gradient(circle at 15% 0%, ${accent}66, transparent 55%), radial-gradient(circle at 100% 30%, ${second}44, transparent 50%)`
      : t.id === "konfet"
        ? `radial-gradient(circle at 0% 0%, #ffd9e6, transparent 60%), radial-gradient(circle at 100% 0%, #e6dcff, transparent 60%)`
        : t.id === "terminal"
          ? "repeating-linear-gradient(0deg, rgba(0,0,0,.25) 0 1px, transparent 1px 3px)"
          : t.id === "samarqand"
            ? "radial-gradient(circle at 50% -20%, #3fb6c655, transparent 60%)"
            : t.id === "okean"
              ? `radial-gradient(circle at 20% 0%, ${second}55, transparent 55%), linear-gradient(180deg, transparent 70%, ${accent}33)`
              : t.id === "brutal"
                ? "radial-gradient(#0000001a 1.2px, transparent 1.4px)"
                : t.id === "sahro"
                  ? `radial-gradient(circle at 80% -10%, ${second}55, transparent 55%)`
                  : t.id === "kiber"
                    ? `linear-gradient(120deg, ${accent}33, transparent 45%), repeating-linear-gradient(0deg, rgba(255,255,255,.05) 0 1px, transparent 1px 4px)`
                    : t.id === "bahor"
                      ? `radial-gradient(circle at 0% 0%, #c9f0d8, transparent 60%), radial-gradient(circle at 100% 100%, ${second}44, transparent 55%)`
                      : t.id === "default"
              ? "linear-gradient(rgba(20,20,18,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(20,20,18,.06) 1px, transparent 1px)"
              : undefined;
  return (
    <div
      aria-hidden
      className="relative h-44 overflow-hidden"
      style={{ background: bg, backgroundImage: bgImage, backgroundSize: t.id === "default" ? "14px 14px" : t.id === "brutal" ? "12px 12px" : undefined, color: text, fontFamily: m.font }}
    >
      <div className="flex items-center justify-between px-3 py-2 text-[0.6rem]" style={{ borderBottom: t.id === "minimal" ? "1px solid #e6e8ee" : `1px solid ${t.dark ? "rgba(255,255,255,.14)" : text + "33"}` }}>
        <b style={{ fontFamily: m.head }}>Milliy Mock</b>
        <span className="flex gap-2 opacity-70">
          <span>Fanlar</span>
          <span>Imtihonlar</span>
        </span>
      </div>
      <div className="grid grid-cols-[1.3fr_1fr] gap-3 p-3">
        <div>
          <p className="text-[0.5rem] uppercase tracking-widest" style={{ color: t.id === "samarqand" ? accent : undefined, opacity: 0.75 }}>
            {t.id === "terminal" ? "> " : ""}Mock imtihon
          </p>
          <p
            className="mt-1 text-[1.05rem] leading-[1.05]"
            style={{
              fontFamily: m.head,
              fontWeight: t.id === "default" || t.id === "samarqand" ? 500 : 800,
              textTransform: t.id === "terminal" ? "uppercase" : undefined,
              background: t.id === "aurora" ? `linear-gradient(90deg, #fff, ${second})` : undefined,
              WebkitBackgroundClip: t.id === "aurora" ? "text" : undefined,
              color: t.id === "aurora" ? "transparent" : undefined,
            }}
          >
            Haqiqiy <span style={{ color: t.id === "aurora" ? undefined : accent, fontStyle: t.id === "default" || t.id === "samarqand" ? "italic" : undefined }}>format</span>da tayyorlaning
          </p>
          <span
            className="mt-3 inline-block px-3 py-1 text-[0.6rem] font-bold"
            style={{
              borderRadius: m.btnRadius,
              background: t.id === "aurora" ? `linear-gradient(90deg, ${accent}, ${second})` : t.id === "terminal" ? "transparent" : accent,
              color: t.id === "terminal" ? accent : t.id === "samarqand" ? bg : "#fff",
              border: t.id === "terminal" ? `1px solid ${accent}` : t.id === "default" ? `1.5px solid ${text}` : 0,
              boxShadow: t.id === "default" ? `2px 2px 0 ${text}` : t.id === "konfet" ? "0 4px 0 #c21f5a" : undefined,
            }}
          >
            {t.id === "terminal" ? "[ BOSHLASH ]" : "Boshlash →"}
          </span>
        </div>
        <div className="p-2" style={{ background: surface, border: m.card, borderRadius: m.radius, ...m.extra }}>
          {[0, 1, 2].map((r) => (
            <div key={r} className="mb-1.5 flex items-center gap-1">
              <span className="text-[0.5rem] opacity-60">{r + 1}</span>
              {["A", "B", "C", "D"].map((L, i) => (
                <span
                  key={L}
                  className="grid h-3.5 w-3.5 place-items-center text-[0.4rem]"
                  style={{
                    borderRadius: t.id === "terminal" ? 0 : 99,
                    border: `1px solid ${accent}`,
                    background: i === (r + 1) % 4 ? (t.id === "default" ? text : accent) : "transparent",
                    color: i === (r + 1) % 4 ? (t.id === "terminal" || t.id === "samarqand" ? bg : "#fff") : accent,
                  }}
                >
                  {L}
                </span>
              ))}
            </div>
          ))}
          <div className="mt-2 h-1.5 overflow-hidden" style={{ background: t.dark ? "rgba(255,255,255,.1)" : "#0000000f", borderRadius: m.radius ? 9 : 0 }}>
            <div className="h-full w-2/3" style={{ background: t.id === "aurora" || t.id === "konfet" ? `linear-gradient(90deg, ${accent}, ${second})` : accent }} />
          </div>
        </div>
      </div>
      <div className="absolute bottom-2 left-3 flex gap-1">
        {t.swatch.map((c, i) => (
          <span key={i} className="h-3 w-3 rounded-full" style={{ background: c, boxShadow: "0 0 0 1px rgba(127,127,127,.4)" }} />
        ))}
      </div>
    </div>
  );
}

function readPreview(): ThemeId | null {
  try {
    const v = localStorage.getItem(THEME_PREVIEW_KEY);
    return THEMES.some((t) => t.id === v) ? (v as ThemeId) : null;
  } catch {
    return null;
  }
}

/** Switches the document theme with a short cross-fade. */
function paint(id: ThemeId, preview: boolean) {
  const d = document.documentElement;
  d.classList.add("theme-anim");
  d.setAttribute("data-theme", id);
  d.toggleAttribute("data-theme-preview", preview);
  window.setTimeout(() => d.classList.remove("theme-anim"), 600);
}

export default function DesignPage() {
  const router = useRouter();
  const [state, setState] = useState<State | null>(null);
  // Only read after the data arrives (a loader renders first), so SSR and client markup still match.
  const [preview, setPreview] = useState<ThemeId | null>(() => (typeof window === "undefined" ? null : readPreview()));
  const [busy, setBusy] = useState<ThemeId | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    adminApi<State>("/api/admin/site-theme")
      .then(setState)
      .catch((e) => setErr(errorText(e)));
  }, []);

  const tryOn = (id: ThemeId) => {
    try {
      localStorage.setItem(THEME_PREVIEW_KEY, id);
    } catch {}
    setPreview(id);
    paint(id, true);
    setDone(null);
  };
  const stopPreview = () => {
    try {
      localStorage.removeItem(THEME_PREVIEW_KEY);
    } catch {}
    setPreview(null);
    if (state) paint(state.theme, false);
  };
  const apply = async (id: ThemeId) => {
    setBusy(id);
    setErr(null);
    setDone(null);
    try {
      const s = await adminApi<State>("/api/admin/site-theme", { method: "PUT", body: { theme: id } });
      try {
        localStorage.removeItem(THEME_PREVIEW_KEY);
      } catch {}
      setPreview(null);
      setState(s);
      paint(s.theme, false);
      setDone(`“${themeInfo(s.theme).name}” dizayni butun saytga qo‘llandi. Barcha tashrif buyuruvchilar endi shu ko‘rinishni ko‘radi.`);
      router.refresh();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (err && !state) return <Alert tone="error">{err}</Alert>;
  if (!state) return <PageLoader />;
  const active = themeInfo(state.theme);

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">Ko‘rinish</p>
      <h1 className="display mt-1 text-5xl">Sayt dizayni</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Butun sayt (bosh sahifa, imtihon oynasi, kabinet va admin panel) uchun dizaynni tanlang. “Sinab ko‘rish” faqat sizning brauzeringizda o‘zgartiradi; “Butun saytga qo‘llash” esa
        hamma uchun darhol o‘zgartiradi. Asl dizaynga istalgan vaqtda qaytishingiz mumkin.
      </p>

      <div className="sheet mt-6 flex flex-wrap items-center justify-between gap-4 p-4">
        <div>
          <p className="eyebrow">Hozir saytda</p>
          <p className="mt-1 text-xl font-semibold">{active.name}</p>
          <p className="text-xs text-muted">{state.changedAt ? `Oxirgi o‘zgarish: ${fmtDateTime(Date.parse(state.changedAt))}` : "Hali o‘zgartirilmagan — asl dizayn"}</p>
        </div>
        {state.theme !== "default" && (
          <button type="button" className="btn btn-ink" disabled={!!busy} onClick={() => apply("default")}>
            {busy === "default" && <Spinner />} ↺ Asl dizaynga qaytarish
          </button>
        )}
      </div>

      {preview && (
        <Alert tone="warn" className="mt-4" title={`Sinov rejimi: “${themeInfo(preview).name}” faqat sizda ko‘rinmoqda`}>
          <span className="flex flex-wrap items-center gap-2">
            Saytni aylanib ko‘ring — boshqa foydalanuvchilar hali ham “{active.name}” dizaynini ko‘radi.
            <button type="button" className="btn btn-sm" onClick={stopPreview}>
              Sinovni to‘xtatish
            </button>
            <a href="/" target="_blank" rel="noreferrer" className="btn btn-sm">
              Bosh sahifada ko‘rish ↗
            </a>
          </span>
        </Alert>
      )}
      {done && (
        <Alert tone="ok" className="mt-4">
          {done}
        </Alert>
      )}
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}

      <ul className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {THEMES.map((t) => {
          const isActive = state.theme === t.id;
          const isPreview = preview === t.id;
          return (
            <li key={t.id} className={cx("sheet lift flex flex-col overflow-hidden", isActive && "!border-accent")} style={isActive ? { boxShadow: "0 0 0 3px var(--color-accent)" } : undefined}>
              <Mock t={t} />
              <div className="flex flex-1 flex-col gap-2 border-t border-hair p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{t.name}</h2>
                  {isActive && <span className="chip chip-ok">Faol</span>}
                  {isPreview && <span className="chip chip-warn">Sinovda</span>}
                  {t.dark && <span className="chip chip-ink">To‘q</span>}
                </div>
                <p className="text-sm font-medium text-ink-2">{t.tagline}</p>
                <p className="text-sm text-muted">{t.description}</p>
                <p className="font-mono text-[0.68rem] text-muted">Shriftlar: {t.fonts}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <button type="button" className="btn btn-primary btn-sm" disabled={isActive || !!busy} onClick={() => apply(t.id)}>
                    {busy === t.id && <Spinner />}
                    {isActive ? "Qo‘llangan" : t.id === "default" ? "Aslga qaytarish" : "Butun saytga qo‘llash"}
                  </button>
                  {!isActive && (
                    <button type="button" className="btn btn-sm" onClick={() => (isPreview ? stopPreview() : tryOn(t.id))}>
                      {isPreview ? "Sinovni to‘xtatish" : "Sinab ko‘rish"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
