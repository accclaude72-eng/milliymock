"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx, fmtDateTime } from "@/lib/format-utils";
import type { XpRules } from "@/lib/gamify";
import type { SubjectWithFormat } from "@/lib/types";

interface Ch {
  id: string;
  day: string;
  subject_code: string;
  title: string;
  difficulty: number | null;
  questions: number;
  time_limit_sec: number;
  one_attempt: boolean;
  xp_base: number;
  status: "published" | "archived" | "draft";
  source: "auto" | "admin";
  participants: number;
  avgPercent: number | null;
  flagged: number;
}
interface Flag {
  id: string;
  name: string;
  title: string;
  percent: number;
  duration_ms: number;
  total: number;
  submitted_at: string;
}
interface Top {
  id: string;
  rank: number;
  xp: number;
  xp24h: number;
  name: string;
  candidateId: string;
  isPublic: boolean;
  displayName: string | null;
  hidden: boolean;
}

const tomorrow = () => new Date(Date.now() + 5 * 3600_000 + 86_400_000).toISOString().slice(0, 10);
const RULE_LABEL: Record<keyof XpRules, string> = {
  challengeBase: "Challenge (standart)",
  bonus70: "≥ 70% bonus",
  bonus90: "≥ 90% bonus",
  streak7: "Har 7 kunlik streak",
  mockPublished: "E’lon qilingan mock",
};

export default function ChallengeAdmin() {
  const [data, setData] = useState<{ challenges: Ch[]; flagged: Flag[] } | null>(null);
  const [game, setGame] = useState<{ rules: XpRules; defaults: XpRules; top: Top[] } | null>(null);
  const [subjects, setSubjects] = useState<SubjectWithFormat[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // The default day is set after data loads (reading the clock during prerender is not allowed).
  const [form, setForm] = useState({ day: "", subjectCode: "mixed", title: "Kunlik challenge", count: 10, difficulty: "", timeLimitSec: 600, oneAttempt: true, xp: 20, replace: false });
  const [rules, setRules] = useState<XpRules | null>(null);

  const load = useCallback(() => {
    Promise.all([adminApi<{ challenges: Ch[]; flagged: Flag[] }>("/api/admin/challenges"), adminApi<{ rules: XpRules; defaults: XpRules; top: Top[] }>("/api/admin/gamification"), adminApi<SubjectWithFormat[]>("/api/subjects")])
      .then(([c, g, s]) => {
        setData(c);
        setGame(g);
        setRules(g.rules);
        setSubjects(s);
        setForm((f) => (f.day ? f : { ...f, day: tomorrow() }));
      })
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setErr(null);
    setMsg(null);
    try {
      await fn();
      setMsg(ok);
      load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (!data || !game || !rules) return err ? <Alert tone="error">{err}</Alert> : <PageLoader />;
  const subjName = (c: string) => (c === "mixed" ? "Aralash" : (subjects.find((s) => s.code === c)?.name ?? c));

  return (
    <div className="mx-auto max-w-6xl">
      <p className="eyebrow">O‘yinlashtirish</p>
      <h1 className="display mt-1 text-5xl">Challenge va reyting</h1>
      <p className="mt-2 max-w-3xl text-sm text-muted">Har kuni aralash challenge avtomatik yaratiladi. Bu yerda oldindan fan bo‘yicha challenge rejalashtirish, ishtirokni kuzatish, XP qoidalarini o‘zgartirish va reytingni moderatsiya qilish mumkin.</p>
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}
      {msg && (
        <Alert tone="ok" className="mt-4">
          {msg}
        </Alert>
      )}

      <section className="sheet mt-6 p-5">
        <h2 className="display text-2xl">Challenge rejalashtirish</h2>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            run("create", () => adminApi("/api/admin/challenges", { method: "POST", body: { ...form, difficulty: form.difficulty ? Number(form.difficulty) : null } }), "Challenge saqlandi — savollar bazadan tanlandi.");
          }}
        >
          <label className="block">
            <span className="label">Sana</span>
            <input type="date" className="field num" required value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Fan</span>
            <select className="field" value={form.subjectCode} onChange={(e) => setForm({ ...form, subjectCode: e.target.value })}>
              <option value="mixed">Aralash fanlar</option>
              {subjects
                .filter((s) => s.code !== "multilevel")
                .map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Sarlavha</span>
            <input className="field" required minLength={3} maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </label>
          <label className="block">
            <span className="label">Savollar soni</span>
            <input type="number" min={3} max={50} className="field num" value={form.count} onChange={(e) => setForm({ ...form, count: Number(e.target.value) })} />
          </label>
          <label className="block">
            <span className="label">Vaqt (daqiqa)</span>
            <input type="number" min={1} max={120} className="field num" value={form.timeLimitSec / 60} onChange={(e) => setForm({ ...form, timeLimitSec: Math.round(Number(e.target.value) * 60) })} />
          </label>
          <label className="block">
            <span className="label">Qiyinlik (ixtiyoriy)</span>
            <select className="field" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
              <option value="">Istalgan</option>
              {[1, 2, 3, 4, 5].map((d) => (
                <option key={d} value={d}>
                  {d}/5
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="label">XP</span>
            <input type="number" min={0} max={500} className="field num" value={form.xp} onChange={(e) => setForm({ ...form, xp: Number(e.target.value) })} />
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.oneAttempt} onChange={(e) => setForm({ ...form, oneAttempt: e.target.checked })} /> Faqat 1 urinish
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.replace} onChange={(e) => setForm({ ...form, replace: e.target.checked })} /> Shu kungi challenge’ni almashtirish
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn btn-primary" disabled={busy === "create"}>
              {busy === "create" && <Spinner />} Saqlash
            </button>
          </div>
        </form>
        <p className="mt-2 text-xs text-muted">Savollar faqat javoblari ochiq, e’lon qilingan testlardan tasodifiy tanlanadi. Qiyinlik bo‘yicha filtr savollarga qiyinlik belgilanganida ishlaydi.</p>
      </section>

      <section className="sheet mt-6 overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Sana</th>
              <th>Challenge</th>
              <th className="text-right">Savol</th>
              <th className="text-right">Ishtirok</th>
              <th className="text-right">O‘rtacha</th>
              <th className="text-right">Shubhali</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.challenges.map((c) => (
              <tr key={c.id} className={cx(c.status === "archived" && "opacity-50")}>
                <td className="num whitespace-nowrap">{c.day}</td>
                <td>
                  <span className="font-medium">{c.title}</span>
                  <span className="block text-xs text-muted">
                    {subjName(c.subject_code)} · {Math.round(c.time_limit_sec / 60)} daq · {c.xp_base} XP · {c.source === "auto" ? "avtomatik" : "admin"}
                    {c.one_attempt ? " · 1 urinish" : ""}
                  </span>
                </td>
                <td className="num text-right">{c.questions}</td>
                <td className="num text-right">{c.participants}</td>
                <td className="num text-right">{c.avgPercent != null ? `${c.avgPercent}%` : "—"}</td>
                <td className={cx("num text-right", c.flagged > 0 && "font-semibold text-accent")}>{c.flagged}</td>
                <td className="text-right">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    disabled={!!busy}
                    onClick={() => run(c.id, () => adminApi(`/api/admin/challenges/${c.id}`, { method: "PATCH", body: { status: c.status === "archived" ? "published" : "archived" } }), "Holat o‘zgartirildi.")}
                  >
                    {c.status === "archived" ? "Qaytarish" : "Yashirish"}
                  </button>
                </td>
              </tr>
            ))}
            {data.challenges.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center text-muted">
                  Hali challenge yo‘q.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      {data.flagged.length > 0 && (
        <section className="sheet mt-6 p-5">
          <h2 className="display text-2xl">Shubhali urinishlar</h2>
          <p className="text-sm text-muted">Har bir savolga 3 soniyadan kam vaqt sarflangan urinishlar. XP avtomatik bekor qilinmaydi — tekshirib, kerak bo‘lsa nomzodni reytingdan yashiring.</p>
          <ul className="mt-3 divide-y divide-hair text-sm">
            {data.flagged.map((f) => (
              <li key={f.id} className="flex flex-wrap justify-between gap-2 py-2">
                <span>
                  <b>{f.name}</b> · {f.title}
                </span>
                <span className="num text-muted">
                  {f.percent}% · {Math.round(f.duration_ms / 1000)} s / {f.total} savol · {fmtDateTime(Date.parse(f.submitted_at))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <section className="sheet h-fit p-5">
          <h2 className="display text-2xl">XP qoidalari</h2>
          <div className="mt-4 space-y-3">
            {(Object.keys(RULE_LABEL) as (keyof XpRules)[]).map((k) => (
              <label key={k} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  {RULE_LABEL[k]} <span className="text-xs text-muted">(standart {game.defaults[k]})</span>
                </span>
                <input type="number" min={0} max={1000} className="field num !min-h-9 w-24 !py-1" value={rules[k]} onChange={(e) => setRules({ ...rules, [k]: Number(e.target.value) })} />
              </label>
            ))}
          </div>
          <button type="button" className="btn btn-primary mt-4" disabled={busy === "rules"} onClick={() => run("rules", () => adminApi("/api/admin/gamification", { method: "POST", body: { action: "rules", rules } }), "XP qoidalari saqlandi (yangi mukofotlarga qo‘llanadi).")}>
            {busy === "rules" && <Spinner />} Saqlash
          </button>
          <p className="mt-2 text-xs text-muted">Oldin berilgan XP o‘zgarmaydi. “Challenge (standart)” avtomatik challenge’larga qo‘llanadi.</p>
        </section>

        <section className="sheet overflow-x-auto p-5">
          <h2 className="display text-2xl">Reyting moderatsiyasi</h2>
          <p className="text-sm text-muted">Umumiy XP bo‘yicha top-100 (yashirin nomzodlar ham). 24 soatda keskin o‘sgan XP qizil bilan belgilanadi.</p>
          <table className="table mt-3">
            <thead>
              <tr>
                <th>#</th>
                <th>Nomzod</th>
                <th className="text-right">XP</th>
                <th className="text-right">24 soat</th>
                <th>Ko‘rinish</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {game.top.map((t) => (
                <tr key={t.id}>
                  <td className="num">{t.rank}</td>
                  <td>
                    {t.name} <span className="num text-xs text-muted">{t.candidateId}</span>
                    {t.displayName && <span className="block text-xs text-muted">reytingda: “{t.displayName}”</span>}
                  </td>
                  <td className="num text-right">{t.xp}</td>
                  <td className={cx("num text-right", t.xp24h >= 300 && "font-semibold text-accent")}>+{t.xp24h}</td>
                  <td>{t.hidden ? <span className="chip chip-accent">Yashirilgan</span> : t.isPublic ? <span className="chip chip-ok">Ochiq</span> : <span className="chip chip-ink">Shaxsiy</span>}</td>
                  <td className="text-right">
                    <button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => run(`v${t.id}`, () => adminApi("/api/admin/gamification", { method: "POST", body: { action: "visibility", userId: t.id, hidden: !t.hidden } }), t.hidden ? "Reytingga qaytarildi." : "Reytingdan yashirildi.")}>
                      {t.hidden ? "Qaytarish" : "Yashirish"}
                    </button>
                  </td>
                </tr>
              ))}
              {game.top.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted">
                    Hali XP yo‘q.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
