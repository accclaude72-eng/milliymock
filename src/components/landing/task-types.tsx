"use client";

import { useState } from "react";
import { gradeO1 } from "@/lib/grading";
import { cx } from "@/lib/format-utils";

function Card({ code, title, children, desc }: { code: string; title: string; desc: string; children: React.ReactNode }) {
  return (
    <article className="sheet flex flex-col p-5">
      <div className="flex items-baseline justify-between">
        <span className="display text-5xl text-accent">{code}</span>
        <span className="eyebrow">Topshiriq turi</span>
      </div>
      <h3 className="mt-3 text-lg font-semibold">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-2">{desc}</p>
      <div className="mt-5 flex-1 rounded-[3px] border border-dashed border-ink/40 bg-paper/60 p-3">{children}</div>
    </article>
  );
}

function Y1Demo() {
  const [v, setV] = useState<string | null>(null);
  return (
    <div>
      <p className="eyebrow mb-2">Sinab ko‘ring</p>
      <div role="radiogroup" aria-label="Y1 namuna" className="flex gap-2">
        {["A", "B", "C", "D"].map((l) => (
          <button key={l} type="button" role="radio" aria-checked={v === l} className="bubble" onClick={() => setV(v === l ? null : l)}>
            {l}
          </button>
        ))}
      </div>
      <p className="mt-2 font-mono text-xs text-muted">{v ? `Belgilandi: ${v} · qayta bosib bekor qilish mumkin` : "Javob belgilanmagan"}</p>
    </div>
  );
}

function Y2Demo() {
  const [m, setM] = useState<string[]>(["", "", ""]);
  return (
    <div className="space-y-1.5">
      {["Mitoxondriya", "Ribosoma", "Xloroplast"].map((item, i) => (
        <label key={item} className="flex items-center justify-between gap-2 text-sm">
          <span>
            <span className="num mr-1.5 text-xs text-muted">{i + 1}.</span>
            {item}
          </span>
          <select
            aria-label={`${item} uchun javob`}
            value={m[i]}
            onChange={(e) => setM((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
            className="field !min-h-0 w-16 !py-1 font-mono text-sm"
          >
            <option value="">—</option>
            {["A", "B", "C", "D"].map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
      ))}
      <p className="pt-1 font-mono text-[0.68rem] text-muted">A fotosintez · B oqsil sintezi · C ATF hosil bo‘lishi · D hazm</p>
    </div>
  );
}

function O1Demo() {
  const [v, setV] = useState("0,5");
  const r = gradeO1(v, { type: "O1", accepted: ["1/2"] });
  const label = { correct: "To‘g‘ri — 1/2 ga teng", incorrect: "Noto‘g‘ri", unanswered: "Javob yo‘q", needs_review: "Ekspert tekshiruviga yuboriladi", partial: "" }[r.status];
  return (
    <div>
      <label className="eyebrow mb-2 block" htmlFor="o1demo">
        Kalit: 1/2 · javobingiz
      </label>
      <input id="o1demo" value={v} onChange={(e) => setV(e.target.value)} className="field num !min-h-0 !py-1.5" maxLength={20} />
      <p className={cx("mt-2 font-mono text-xs", r.status === "correct" ? "text-ok" : r.status === "needs_review" ? "text-warn" : "text-accent-ink")}>
        {r.status === "correct" ? "✓ " : r.status === "needs_review" ? "? " : "✕ "}
        {label}
      </p>
      <p className="mt-1 text-[0.68rem] text-muted">0.5 · 0,5 · 1/2 · 5e-1 — barchasi bir xil son sifatida tekshiriladi.</p>
    </div>
  );
}

function O2Demo() {
  return (
    <div className="space-y-2 text-sm">
      {[
        ["M", "Yechim usuli", 18, 20],
        ["A", "Hisob-kitob", 7, 10],
      ].map(([c, l, s, m]) => (
        <div key={c as string}>
          <div className="flex justify-between font-mono text-xs">
            <span>
              <b>{c}</b> · {l}
            </span>
            <span>
              {s}/{m}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-[1px] border border-ink bg-card">
            <div className={cx("h-full", c === "M" ? "bg-ink" : "bg-accent")} style={{ width: `${((s as number) / (m as number)) * 100}%` }} />
          </div>
        </div>
      ))}
      <p className="font-mono text-[0.68rem] text-muted">Namuna rubrika · M va A hech qachon bitta “to‘g‘ri/noto‘g‘ri” ga birlashtirilmaydi</p>
    </div>
  );
}

export function TaskTypes() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      <Card code="Y1" title="Yopiq test" desc="To‘rtta variantdan aniq bitta to‘g‘ri javob. Imtihon tugaguncha javobni o‘zgartirish mumkin.">
        <Y1Demo />
      </Card>
      <Card code="Y2" title="Moslashtirish" desc="Chap ustundagi har bir element o‘ng ustun bilan juftlanadi. Har bir juftlik alohida saqlanadi.">
        <Y2Demo />
      </Card>
      <Card code="O1" title="Qisqa ochiq javob" desc="Son, formula yoki atama. O‘nlik vergul, kasr va Unicode belgilar me’yorlashtiriladi.">
        <O1Demo />
      </Card>
      <Card code="O2" title="Yozma ish" desc="Biologiya va kimyoda. Yechim usuli (M) va hisob-kitob (A) rubrika bo‘yicha alohida baholanadi.">
        <O2Demo />
      </Card>
    </div>
  );
}
