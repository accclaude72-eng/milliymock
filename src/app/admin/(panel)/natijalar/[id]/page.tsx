"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx, fmtBytes, fmtDateTime, fmtDuration, fmtNum } from "@/lib/format-utils";
import type { AnswerKey, AnswerValue, KeyO2 } from "@/lib/grading";
import { ATTEMPT_STATUS_LABEL, type Attempt, type PublicFileMeta, type QuestionSheetItem } from "@/lib/types";

type AttemptView = Omit<Attempt, "client" | "o2Files"> & { o2Files: Record<string, PublicFileMeta[]> };
interface Data {
  attempt: AttemptView;
  sheet: QuestionSheetItem[];
  key: AnswerKey;
  timeSpentMs: number;
}
interface O2Draft {
  m: string;
  a: string;
  criteria: Record<string, { score: string; comment: string }>;
  comment: string;
  errorTags: string[];
}

const ERROR_TAGS = ["Yechim usuli noto‘g‘ri", "Hisoblashda xato", "Birlik xatosi", "Formula xatosi", "Javob to‘liq emas", "Shart noto‘g‘ri talqin qilingan", "Asoslash yetarli emas"];

function show(a: AnswerValue | undefined): string {
  if (a == null) return "—";
  if (Array.isArray(a)) return a.map((x, i) => `${i + 1}–${x || "·"}`).join(" ");
  if (typeof a === "object") return a.text ? `${a.text.slice(0, 60)}${a.text.length > 60 ? "…" : ""}` : "—";
  return a;
}
function keyShow(k: AnswerKey[string] | undefined): string {
  if (!k) return "—";
  if (k.type === "Y1") return k.correct;
  if (k.type === "Y2") return k.pairs.map((p, i) => `${i + 1}–${p}`).join(" ");
  if (k.type === "O1" || k.type === "O") return k.accepted.join(" | ") + (k.tolerance ? ` (±${k.tolerance})` : "");
  return "rubrika";
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ReviewPage />
    </Suspense>
  );
}

function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [o1, setO1] = useState<Record<string, "correct" | "incorrect">>({});
  const [o2, setO2] = useState<Record<string, O2Draft>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const hydrate = useCallback((r: Data) => {
    {
      setD(r);
      const drafts: Record<string, O2Draft> = {};
      for (const s of r.sheet.filter((x) => x.type === "O2")) {
        const rev = r.attempt.o2Reviews?.[String(s.n)];
        const k = r.key[String(s.n)] as KeyO2 | undefined;
        const crit: O2Draft["criteria"] = {};
        for (const c of k?.criteria ?? []) {
          const sc = rev?.criteria.find((x) => x.id === c.id);
          crit[c.id] = { score: sc ? String(sc.score) : "", comment: sc?.comment ?? "" };
        }
        drafts[String(s.n)] = { m: rev ? String(rev.m) : "", a: rev ? String(rev.a) : "", criteria: crit, comment: rev?.comment ?? "", errorTags: rev?.errorTags ?? [] };
      }
      setO2(drafts);
      setO1({});
    }
  }, []);
  const load = useCallback(async () => {
    hydrate(await adminApi<Data>(`/api/admin/attempts/${id}`));
  }, [id, hydrate]);
  useEffect(() => {
    adminApi<Data>(`/api/admin/attempts/${id}`)
      .then(hydrate)
      .catch((e) => setErr(errorText(e)));
  }, [id, hydrate]);

  const qmap = useMemo(() => new Map((d?.attempt.grading?.questions ?? []).map((q) => [q.n, q])), [d]);

  if (err) return <Alert tone="error" title="Urinish ochilmadi">{err}</Alert>;
  if (!d) return <PageLoader />;
  const a = d.attempt;
  const s = a.grading?.summary;
  const reviewable = a.status === "pending_review" || a.status === "graded";
  const needs = (a.grading?.questions ?? []).filter((q) => (q.type === "O1" || q.type === "O") && (q.status === "needs_review" || q.resolvedBy === "reviewer"));
  const o2Items = d.sheet.filter((x) => x.type === "O2");

  const totalFor = (n: number): number => {
    const dr = o2[String(n)];
    const k = d.key[String(n)] as KeyO2 | undefined;
    if (!dr) return 0;
    if (k?.criteria?.length) return k.criteria.reduce((sum, c) => sum + (Number(dr.criteria[c.id]?.score) || 0), 0);
    return (Number(dr.m) || 0) + (Number(dr.a) || 0);
  };

  const save = async () => {
    setBusy("save");
    setMsg(null);
    try {
      const o2Body: Record<string, unknown> = {};
      for (const it of o2Items) {
        const dr = o2[String(it.n)];
        const k = d.key[String(it.n)] as KeyO2 | undefined;
        const hasCriteria = !!k?.criteria?.length;
        const filled = hasCriteria ? k!.criteria.every((c) => dr?.criteria[c.id]?.score !== "" && dr?.criteria[c.id]?.score !== undefined) : dr && dr.m !== "" && dr.a !== "";
        if (!filled) continue; // only submit fully scored tasks
        o2Body[String(it.n)] = {
          m: Number(dr.m) || 0,
          a: Number(dr.a) || 0,
          criteria: hasCriteria ? k!.criteria.map((c) => ({ id: c.id, score: Number(dr.criteria[c.id].score) || 0, comment: dr.criteria[c.id].comment || undefined })) : [],
          comment: dr.comment,
          errorTags: dr.errorTags,
        };
      }
      const r = await adminApi<{ status: string }>(`/api/admin/attempts/${id}/review`, { method: "POST", body: { o1, o2: o2Body } });
      await load();
      setMsg({ tone: "ok", text: r.status === "graded" ? "Saqlandi. Barcha qismlar baholandi — natijani e’lon qilish mumkin." : "Saqlandi. Hali baholanmagan qismlar bor." });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  const publish = async (action: "publish" | "unpublish") => {
    setBusy(action);
    setMsg(null);
    try {
      await adminApi(`/api/admin/attempts/${id}/publish`, { method: "POST", body: { action } });
      await load();
      setMsg({ tone: "ok", text: action === "publish" ? "Natija e’lon qilindi — nomzod batafsil natijani ko‘ra oladi." : "E’lon bekor qilindi — qayta tekshirish mumkin." });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setBusy(null);
    }
  };

  const openFile = async (fileId: string) => {
    const w = window.open("about:blank", "_blank");
    try {
      const r = await adminApi<{ url: string }>(`/api/admin/attempts/${id}/files/${fileId}`);
      if (w) {
        w.opener = null;
        w.location.href = r.url;
      }
    } catch (e) {
      w?.close();
      setMsg({ tone: "error", text: errorText(e) });
    }
  };

  return (
    <div className="mx-auto max-w-6xl pb-24">
      <nav className="font-mono text-xs text-muted">
        <Link href="/admin/natijalar" className="hover:text-ink">
          Natijalar
        </Link>{" "}
        / tekshiruv
      </nav>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow">
            {a.subjectName} · {a.format.label}
          </p>
          <h1 className="display mt-1 text-4xl">{a.materialTitle}</h1>
          <p className="mt-2 text-sm">
            {a.candidateName} · <span className="num">{a.candidateId}</span> · topshirilgan {fmtDateTime(a.submittedAt)} · {fmtDuration(d.timeSpentMs)}
            {a.finalizeReason === "timeout" && <span className="chip chip-warn ml-2">vaqt tugashi bilan</span>}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="chip chip-ink">{ATTEMPT_STATUS_LABEL[a.status]}</span>
          {a.status === "graded" && (
            <button type="button" className="btn btn-primary" disabled={!!busy} onClick={() => publish("publish")}>
              {busy === "publish" && <Spinner />} Natijani e’lon qilish
            </button>
          )}
          {a.status === "published" && (
            <button type="button" className="btn" disabled={!!busy} onClick={() => publish("unpublish")}>
              {busy === "unpublish" && <Spinner />} E’lonni bekor qilish (qayta tekshirish)
            </button>
          )}
        </div>
      </div>
      {msg && (
        <Alert tone={msg.tone} className="mt-4">
          {msg.text}
        </Alert>
      )}

      {s && (
        <section className="sheet mt-6 grid grid-cols-2 gap-4 p-5 sm:grid-cols-5">
          {[
            ["Xom ball", `${fmtNum(s.score, 2)} / ${s.max}`],
            ["Foiz", `${fmtNum(s.percent)}%`],
            ["To‘g‘ri", s.correct],
            ["Noto‘g‘ri", s.incorrect],
            ["Tekshiruvda", s.needsReview],
          ].map(([k, v]) => (
            <div key={k as string}>
              <p className="eyebrow">{k}</p>
              <p className="num mt-1 text-2xl font-semibold">{v}</p>
            </div>
          ))}
        </section>
      )}

      {/* O1 ambiguous */}
      {needs.length > 0 && (
        <section className="mt-8">
          <h2 className="display text-2xl">Shubhali qisqa javoblar</h2>
          <p className="mt-1 text-sm text-muted">Avtomatik tizim ilmiy ekvivalentlikni tasdiqlay olmagan javoblar. Har birini qo‘lda baholang.</p>
          <div className="sheet mt-3 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Nomzod javobi</th>
                  <th>Kalit</th>
                  <th>Sabab</th>
                  <th className="text-right">Qaror</th>
                </tr>
              </thead>
              <tbody>
                {needs.map((q) => {
                  const cur = o1[String(q.n)] ?? (q.resolvedBy === "reviewer" ? (q.status as "correct" | "incorrect") : undefined);
                  return (
                    <tr key={q.n}>
                      <td className="num font-semibold">{q.n}</td>
                      <td className="num">{show(a.answers[String(q.n)])}</td>
                      <td className="num">{keyShow(d.key[String(q.n)])}</td>
                      <td className="text-xs text-muted">{q.reviewReason ?? (q.resolvedBy ? "qo‘lda baholangan" : "")}</td>
                      <td>
                        <div className="flex justify-end gap-1" role="group" aria-label={`${q.n}-topshiriq qarori`}>
                          {(["correct", "incorrect"] as const).map((v) => (
                            <button
                              key={v}
                              type="button"
                              disabled={!reviewable}
                              aria-pressed={cur === v}
                              className={cx("btn btn-sm", cur === v ? (v === "correct" ? "!bg-ok !text-white" : "!bg-accent !text-white") : "btn-ghost")}
                              onClick={() => setO1((o) => ({ ...o, [String(q.n)]: v }))}
                            >
                              {v === "correct" ? "✓ To‘g‘ri" : "✕ Noto‘g‘ri"}
                            </button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* O2 */}
      {o2Items.length > 0 && (
        <section className="mt-8 space-y-5">
          <h2 className="display text-2xl">Yozma ishlar (O2)</h2>
          {o2Items.map((it) => {
            const n = String(it.n);
            const ans = a.answers[n];
            const text = ans && typeof ans === "object" && !Array.isArray(ans) ? ans.text : "";
            const files = a.o2Files?.[n] ?? [];
            const k = d.key[n] as KeyO2 | undefined;
            const dr = o2[n];
            const crit = k?.criteria ?? [];
            const total = totalFor(it.n);
            const over = total > (it.o2Max ?? 0);
            const upd = (p: Partial<O2Draft>) => setO2((o) => ({ ...o, [n]: { ...o[n], ...p } }));
            return (
              <article key={n} className="sheet-hard p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold">
                    <span className="num mr-2">{n}</span>topshiriq · maks. {it.o2Max}
                  </h3>
                  <span className={cx("num text-xl font-semibold", over && "text-accent")}>
                    {fmtNum(total)} / {it.o2Max}
                  </span>
                </div>
                <div className="mt-4 grid gap-5 lg:grid-cols-[1.1fr_1fr]">
                  <div>
                    <p className="eyebrow">Nomzod yechimi</p>
                    <pre className="mt-1 max-h-96 overflow-auto whitespace-pre-wrap break-words border border-hair bg-paper p-3 font-sans text-sm">{text || "Matn kiritilmagan."}</pre>
                    <p className="eyebrow mt-3">Asl fayllar ({files.length})</p>
                    {files.length ? (
                      <ul className="mt-1 space-y-1 text-sm">
                        {files.map((f) => (
                          <li key={f.id} className="flex items-center gap-2">
                            <button type="button" className="link truncate" onClick={() => openFile(f.id)}>
                              📎 {f.name}
                            </button>
                            <span className="num text-xs text-muted">
                              {fmtBytes(f.size)} · {fmtDateTime(f.uploadedAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-sm text-muted">Fayl yuklanmagan.</p>
                    )}
                  </div>
                  <div>
                    {crit.length > 0 ? (
                      <div className="space-y-2">
                        <p className="eyebrow">Rubrika mezonlari</p>
                        {crit.map((c) => (
                          <div key={c.id} className="border border-hair p-2">
                            <div className="flex items-center gap-2">
                              <span className={cx("chip", c.component === "M" ? "chip-ink" : "chip-accent")}>{c.component}</span>
                              <span className="flex-1 text-sm">{c.label || "(nomsiz mezon)"}</span>
                              <input
                                aria-label={`${c.label} balli`}
                                type="number"
                                min={0}
                                max={c.max}
                                step="0.5"
                                disabled={!reviewable}
                                className="field num !min-h-8 w-20 !py-1"
                                value={dr?.criteria[c.id]?.score ?? ""}
                                onChange={(e) => upd({ criteria: { ...dr.criteria, [c.id]: { ...dr.criteria[c.id], score: e.target.value } } })}
                              />
                              <span className="num text-xs text-muted">/ {c.max}</span>
                            </div>
                            <input
                              aria-label="Mezon izohi"
                              className="field mt-1 !min-h-8 !py-1 text-xs"
                              placeholder="Izoh (ixtiyoriy)"
                              disabled={!reviewable}
                              value={dr?.criteria[c.id]?.comment ?? ""}
                              onChange={(e) => upd({ criteria: { ...dr.criteria, [c.id]: { ...dr.criteria[c.id], comment: e.target.value } } })}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div>
                        <p className="eyebrow">Rubrika kiritilmagan — M va A ni bevosita baholang</p>
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <label>
                            <span className="label">M · yechim usuli</span>
                            <input type="number" min={0} step="0.5" disabled={!reviewable} className="field num" value={dr?.m ?? ""} onChange={(e) => upd({ m: e.target.value })} />
                          </label>
                          <label>
                            <span className="label">A · hisob-kitob</span>
                            <input type="number" min={0} step="0.5" disabled={!reviewable} className="field num" value={dr?.a ?? ""} onChange={(e) => upd({ a: e.target.value })} />
                          </label>
                        </div>
                      </div>
                    )}
                    {over && <p className="mt-2 text-xs text-accent-ink">Jami ball maksimaldan oshib ketdi.</p>}
                    <label className="mt-3 block">
                      <span className="label">Umumiy izoh nomzodga</span>
                      <textarea className="field min-h-20 text-sm" disabled={!reviewable} maxLength={4000} value={dr?.comment ?? ""} onChange={(e) => upd({ comment: e.target.value })} />
                    </label>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ERROR_TAGS.map((t) => {
                        const on = dr?.errorTags.includes(t);
                        return (
                          <button
                            key={t}
                            type="button"
                            disabled={!reviewable}
                            aria-pressed={on}
                            className={cx("chip cursor-pointer", on ? "chip-warn" : "chip-ink opacity-60")}
                            onClick={() => upd({ errorTags: on ? dr.errorTags.filter((x) => x !== t) : [...(dr?.errorTags ?? []), t] })}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                    {a.o2Reviews?.[n] && <p className="mt-2 font-mono text-[0.65rem] text-muted">Oxirgi baholash: {fmtDateTime(a.o2Reviews[n].reviewedAt)}</p>}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* full answer table */}
      <section className="mt-8">
        <details>
          <summary className="cursor-pointer font-semibold">Barcha javoblar va kalit bilan solishtirish</summary>
          <div className="sheet mt-3 overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>№</th>
                  <th>Tur</th>
                  <th>Javob</th>
                  <th>Kalit</th>
                  <th>Holat</th>
                  <th className="text-right">Ball</th>
                </tr>
              </thead>
              <tbody>
                {d.sheet
                  .filter((x) => x.type !== "O2")
                  .map((x) => {
                    const q = qmap.get(x.n);
                    return (
                      <tr key={x.n}>
                        <td className="num">{x.n}</td>
                        <td className="num">{x.type}</td>
                        <td className="num">{show(a.answers[String(x.n)])}</td>
                        <td className="num">{keyShow(d.key[String(x.n)])}</td>
                        <td className="text-xs">{q?.status ?? "—"}</td>
                        <td className="num text-right">
                          {q ? `${q.score}/${q.max}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {reviewable && (needs.length > 0 || o2Items.length > 0) && (
        <div className="sheet-hard fixed inset-x-4 bottom-4 z-30 flex items-center justify-between gap-3 p-3 lg:left-72">
          <p className="text-sm text-muted">Ballar faqat “Saqlash” bosilganda yoziladi. Har bir o‘zgarish audit jurnaliga tushadi.</p>
          <button type="button" className="btn btn-ink" disabled={!!busy} onClick={save}>
            {busy === "save" && <Spinner />} Saqlash
          </button>
        </div>
      )}
    </div>
  );
}
