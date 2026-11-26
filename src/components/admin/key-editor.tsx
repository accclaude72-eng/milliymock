"use client";

import { useState } from "react";
import { type ExamFormat, OPTION_LETTERS } from "@/lib/formats";
import { cx } from "@/lib/format-utils";
import type { AnswerKey, KeyItem, KeyO1, KeyO2, KeyY2, RubricCriterion } from "@/lib/grading";
import { parseKeyPaste } from "@/lib/key-paste";
import type { QuestionSheetItem } from "@/lib/types";
import { Alert } from "../ui";

interface Props {
  format: ExamFormat;
  sheet: QuestionSheetItem[];
  value: AnswerKey;
  onChange: (k: AnswerKey) => void;
  caseSensitiveDefault: boolean;
}

function TopicSelect({ topics, value, onChange, n }: { topics: string[]; value?: string; onChange: (t: string | undefined) => void; n: number }) {
  if (!topics.length) return null;
  return (
    <select aria-label={`${n}-topshiriq mavzusi`} className="field !min-h-8 max-w-[14rem] !py-1 text-xs" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)}>
      <option value="">Mavzu —</option>
      {topics.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
    </select>
  );
}

export function KeyEditor({ format, sheet, value, onChange, caseSensitiveDefault }: Props) {
  const [paste, setPaste] = useState("");
  const [pasteMsg, setPasteMsg] = useState<{ tone: "ok" | "warn"; text: string } | null>(null);

  const set = (n: number, item: KeyItem) => onChange({ ...value, [String(n)]: item });

  const y1 = sheet.filter((s) => s.type === "Y1");
  const y2 = sheet.filter((s) => s.type === "Y2");
  const o1 = sheet.filter((s) => s.type === "O1" || s.type === "O");
  const o2 = sheet.filter((s) => s.type === "O2");

  return (
    <div className="space-y-8">
      {/* bulk paste */}
      <section className="sheet p-4">
        <h3 className="font-semibold">Kalitni matndan joylash</h3>
        <p className="mt-1 text-xs text-muted">
          Qo‘llab-quvvatlanadi: <span className="num">ABCDA…</span> (ketma-ket Y1) · <span className="num">1A 2B 3-C</span> · <span className="num">33: ACBD</span> (Y2) ·{" "}
          <span className="num">36: 0,25 | 1/4</span> (O1, “|” — muqobil javoblar). Har bir Y2/O1 qatori alohida satrda.
        </p>
        <textarea className="field num mt-2 min-h-24 text-sm" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={"1A 2C 3B 4D …\n33: ACBD\n36: 0,25"} />
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button
            type="button"
            className="btn btn-sm btn-ink"
            disabled={!paste.trim()}
            onClick={() => {
              const r = parseKeyPaste(paste, sheet, value);
              onChange(r.key);
              setPasteMsg({
                tone: r.skipped.length ? "warn" : "ok",
                text: `${r.applied.length} ta topshiriq to‘ldirildi.${r.skipped.length ? ` Tushunilmadi: ${r.skipped.slice(0, 5).join("; ")}${r.skipped.length > 5 ? "…" : ""}` : ""}`,
              });
            }}
          >
            Qo‘llash
          </button>
          {pasteMsg && <span className={cx("text-xs", pasteMsg.tone === "ok" ? "text-ok" : "text-warn")}>{pasteMsg.text}</span>}
        </div>
      </section>

      {/* Y1 */}
      {y1.length > 0 && (
        <section>
          <h3 className="display text-2xl">
            Y1 · yopiq test <span className="num text-base text-muted">({y1.filter((s) => value[String(s.n)]?.type === "Y1").length}/{y1.length})</span>
          </h3>
          <div className="mt-3 grid gap-x-6 gap-y-1 xl:grid-cols-2">
            {y1.map((s) => {
              const k = value[String(s.n)];
              const correct = k?.type === "Y1" ? k.correct : "";
              return (
                <div key={s.n} className="flex flex-wrap items-center gap-2 border-b border-hair py-1.5">
                  <span className={cx("num w-8 text-right text-sm font-semibold", correct ? "text-ink" : "text-accent")}>{s.n}</span>
                  <div role="radiogroup" aria-label={`${s.n}-topshiriq to‘g‘ri javobi`} className="flex gap-1.5">
                    {OPTION_LETTERS.slice(0, s.options).map((l) => (
                      <button key={l} type="button" role="radio" aria-checked={correct === l} className="bubble bubble-sm !h-7 !w-7" onClick={() => set(s.n, { type: "Y1", correct: l, topic: k?.topic })}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <span className="ml-auto">
                    {correct ? (
                      <TopicSelect topics={format.topics} value={k?.topic} n={s.n} onChange={(t) => set(s.n, { type: "Y1", correct, topic: t })} />
                    ) : (
                      <span className="font-mono text-[0.65rem] text-accent">javob tanlanmagan</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Y2 */}
      {y2.length > 0 && (
        <section>
          <h3 className="display text-2xl">Y2 · moslashtirish</h3>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {y2.map((s) => {
              const k = value[String(s.n)];
              const cur: KeyY2 = k?.type === "Y2" && k.left === s.left && k.right === s.right ? k : { type: "Y2", left: s.left ?? 4, right: s.right ?? 6, pairs: Array(s.left ?? 4).fill(""), topic: k?.topic };
              return (
                <div key={s.n} className="sheet p-3">
                  <p className="font-semibold">
                    <span className="num mr-2">{s.n}</span>
                    <span className="text-xs font-normal text-muted">
                      {s.left} ta element · {OPTION_LETTERS.slice(0, s.right).join("")}
                    </span>
                  </p>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {Array.from({ length: cur.left }, (_, i) => (
                      <label key={i} className="flex items-center gap-1.5 text-sm">
                        <span className="num w-5 text-right text-xs text-muted">{i + 1}</span>
                        <select
                          aria-label={`${s.n}-topshiriq ${i + 1}-element javobi`}
                          className={cx("field num !min-h-8 !py-1", !cur.pairs[i] && "!border-accent")}
                          value={cur.pairs[i] ?? ""}
                          onChange={(e) => set(s.n, { ...cur, pairs: Array.from({ length: cur.left }, (_, j) => (j === i ? e.target.value : (cur.pairs[j] ?? ""))) })}
                        >
                          <option value="">—</option>
                          {OPTION_LETTERS.slice(0, cur.right).map((l) => (
                            <option key={l}>{l}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <div className="mt-2">
                    <TopicSelect topics={format.topics} value={cur.topic} n={s.n} onChange={(t) => set(s.n, { ...cur, topic: t })} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">Y2 tuzilishini (elementlar va variantlar soni) “Javoblar varaqasi tuzilishi” bo‘limida o‘zgartiring.</p>
        </section>
      )}

      {/* O1 */}
      {o1.length > 0 && (
        <section>
          <h3 className="display text-2xl">{o1[0].type} · qisqa javob</h3>
          <p className="mt-1 text-xs text-muted">
            Har bir qatorga bitta qabul qilinadigan javob. Sonlar <span className="num">0,5 = 0.5 = 1/2</span> sifatida solishtiriladi. Tolerantlik — mutlaq farq (masalan{" "}
            <span className="num">0.01</span>). Shubhali javoblar ekspert tekshiruviga yuboriladi.
          </p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {o1.map((s) => {
              const k = value[String(s.n)];
              const cur: KeyO1 = k && (k.type === "O1" || k.type === "O") ? k : { type: s.type as "O1" | "O", accepted: [], caseSensitive: caseSensitiveDefault };
              return (
                <div key={s.n} className="sheet p-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={cx("num font-semibold", cur.accepted.some((a) => a.trim()) ? "" : "text-accent")}>{s.n}</span>
                    <TopicSelect topics={format.topics} value={cur.topic} n={s.n} onChange={(t) => set(s.n, { ...cur, topic: t })} />
                  </div>
                  <textarea
                    aria-label={`${s.n}-topshiriq qabul qilinadigan javoblari`}
                    className="field num mt-2 min-h-16 text-sm"
                    value={cur.accepted.join("\n")}
                    placeholder={"0,25\n1/4"}
                    onChange={(e) => set(s.n, { ...cur, accepted: e.target.value.split("\n").map((x) => x.trimStart()).slice(0, 20) })}
                  />
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <label>
                      <span className="label !text-[0.6rem]">Tolerantlik</span>
                      <input
                        type="number"
                        step="any"
                        min={0}
                        className="field num !min-h-8 !py-1"
                        value={cur.tolerance ?? ""}
                        onChange={(e) => set(s.n, { ...cur, tolerance: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
                      />
                    </label>
                    <label>
                      <span className="label !text-[0.6rem]">Birlik</span>
                      <input className="field !min-h-8 !py-1" value={cur.unit ?? ""} maxLength={30} onChange={(e) => set(s.n, { ...cur, unit: e.target.value || undefined })} />
                    </label>
                    <label className="flex items-end gap-1.5 pb-2">
                      <input type="checkbox" className="accent-[var(--color-accent)]" checked={!!cur.caseSensitive} onChange={(e) => set(s.n, { ...cur, caseSensitive: e.target.checked })} />
                      Aa farqi
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* O2 */}
      {o2.length > 0 && (
        <section>
          <h3 className="display text-2xl">O2 · yozma ish rubrikasi</h3>
          <p className="mt-1 text-xs text-muted">
            Mezonlarni rasmiy spetsifikatsiya jadvallari asosida kiriting. M — yechim usuli, A — hisob-kitob. Mezonlar kiritilmasa, ekspert M va A ballarini
            bevosita qo‘yadi (jami topshiriq maksimalidan oshmaydi).
          </p>
          <div className="mt-3 space-y-3">
            {o2.map((s) => {
              const k = value[String(s.n)];
              const cur: KeyO2 = k?.type === "O2" ? k : { type: "O2", criteria: [] };
              const sum = cur.criteria.reduce((a, c) => a + (Number(c.max) || 0), 0);
              const updC = (i: number, patch: Partial<RubricCriterion>) => set(s.n, { ...cur, criteria: cur.criteria.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
              return (
                <div key={s.n} className="sheet p-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold">
                      <span className="num mr-2">{s.n}</span>maks. {s.o2Max} ball
                    </p>
                    <span className={cx("num text-sm", cur.criteria.length && sum !== s.o2Max ? "text-accent" : "text-muted")}>
                      {cur.criteria.length ? `mezonlar yig‘indisi: ${sum} / ${s.o2Max}` : "rubrikasiz (M + A)"}
                    </span>
                  </div>
                  {cur.criteria.length > 0 && (
                    <div className="mt-3 space-y-1.5">
                      {cur.criteria.map((c, i) => (
                        <div key={c.id} className="grid grid-cols-[1fr_5rem_5rem_auto] items-center gap-2">
                          <input aria-label="Mezon nomi" className="field !min-h-8 !py-1 text-sm" value={c.label} maxLength={200} onChange={(e) => updC(i, { label: e.target.value })} placeholder="Mezon tavsifi" />
                          <select aria-label="Komponent" className="field num !min-h-8 !py-1" value={c.component} onChange={(e) => updC(i, { component: e.target.value as "M" | "A" })}>
                            <option value="M">M</option>
                            <option value="A">A</option>
                          </select>
                          <input aria-label="Maksimal ball" type="number" min={0} step="0.5" className="field num !min-h-8 !py-1" value={c.max} onChange={(e) => updC(i, { max: Number(e.target.value) })} />
                          <button type="button" className="btn btn-ghost btn-sm !min-h-0 !px-2" aria-label="Mezonni o‘chirish" onClick={() => set(s.n, { ...cur, criteria: cur.criteria.filter((_, j) => j !== i) })}>
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        set(s.n, {
                          ...cur,
                          criteria: [...cur.criteria, { id: `c${Date.now().toString(36)}${cur.criteria.length}`, label: "", component: cur.criteria.filter((c) => c.component === "M").length > cur.criteria.filter((c) => c.component === "A").length ? "A" : "M", max: 1 }],
                        })
                      }
                    >
                      ＋ Mezon
                    </button>
                    <TopicSelect topics={format.topics} value={cur.topic} n={s.n} onChange={(t) => set(s.n, { ...cur, topic: t })} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      {sheet.length === 0 && <Alert tone="warn">Bu formatda topshiriqlar yo‘q.</Alert>}
    </div>
  );
}
