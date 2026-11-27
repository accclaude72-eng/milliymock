"use client";

import { useRef, useState } from "react";
import { OPTION_LETTERS } from "@/lib/formats";
import { cx, fmtBytes, fmtDateTime } from "@/lib/format-utils";
import type { AnswerValue } from "@/lib/grading";
import type { PublicFileMeta, QuestionSheetItem } from "@/lib/types";
import { Spinner } from "../ui";

interface RowProps {
  item: QuestionSheetItem;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue | null) => void;
  disabled: boolean;
  current: boolean;
  flagged: boolean;
  onFocusRow: () => void;
}

function RowShell({ item, current, flagged, onFocusRow, children, answered }: Omit<RowProps, "value" | "onChange" | "disabled"> & { children: React.ReactNode; answered: boolean }) {
  return (
    <div
      id={`q-${item.n}`}
      data-q={item.n}
      onClick={onFocusRow}
      onFocusCapture={onFocusRow}
      className={cx(
        "relative flex scroll-mt-24 items-center gap-3 border-l-[3px] py-1.5 pl-2 pr-1 transition-colors",
        current ? "border-accent bg-accent-soft/50" : "border-transparent",
      )}
    >
      <span className={cx("num w-8 shrink-0 text-right text-sm font-semibold", answered ? "text-ink" : "text-muted")}>
        {item.n}
        <span className="sr-only">{answered ? " — javob berilgan" : " — javob berilmagan"}</span>
      </span>
      {children}
      {flagged && (
        <span className="ml-auto shrink-0 font-mono text-sm text-accent" title="Qayta ko‘rib chiqish uchun belgilangan" aria-label="belgilangan">
          ⚑
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Y1 */

export function Y1Row(p: RowProps) {
  const v = typeof p.value === "string" ? p.value : "";
  const letters = OPTION_LETTERS.slice(0, p.item.options ?? 4);
  return (
    <RowShell {...p} answered={!!v}>
      <div role="radiogroup" aria-label={`${p.item.n}-topshiriq javobi`} className="flex flex-wrap gap-2">
        {letters.map((l) => (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={v === l}
            aria-label={`${p.item.n}-savol, ${l} variant`}
            disabled={p.disabled}
            className="bubble"
            onClick={(e) => {
              e.stopPropagation();
              p.onFocusRow();
              p.onChange(v === l ? null : l);
            }}
          >
            {l}
          </button>
        ))}
      </div>
    </RowShell>
  );
}

/* ------------------------------------------------------------------ Y2 */

export function Y2Block(p: RowProps) {
  const left = p.item.left ?? 4;
  const letters = OPTION_LETTERS.slice(0, p.item.right ?? 6);
  const arr = Array.isArray(p.value) ? p.value : [];
  const vals = Array.from({ length: left }, (_, i) => arr[i] ?? "");
  const [over, setOver] = useState<number | null>(null);
  const set = (i: number, l: string) => {
    const next = vals.map((x, j) => (j === i ? l : x));
    p.onChange(next.every((x) => !x) ? null : next);
  };
  const answered = vals.some(Boolean);
  return (
    <div
      id={`q-${p.item.n}`}
      data-q={p.item.n}
      onClick={p.onFocusRow}
      onFocusCapture={p.onFocusRow}
      className={cx("scroll-mt-24 border-l-[3px] py-2 pl-2 pr-1", p.current ? "border-accent bg-accent-soft/50" : "border-transparent")}
    >
      <div className="flex items-center gap-3">
        <span className={cx("num w-8 text-right text-sm font-semibold", answered ? "text-ink" : "text-muted")}>{p.item.n}</span>
        <span className="eyebrow">Moslashtirish · {vals.filter(Boolean).length}/{left}</span>
        {p.flagged && <span className="ml-auto font-mono text-sm text-accent">⚑</span>}
      </div>
      {/* draggable options (desktop) */}
      <div className="ml-11 mt-2 hidden flex-wrap gap-1.5 md:flex" aria-hidden>
        {letters.map((l) => (
          <span
            key={l}
            draggable={!p.disabled}
            onDragStart={(e) => {
              e.dataTransfer.setData("text/plain", l);
              e.dataTransfer.effectAllowed = "copy";
            }}
            className={cx("num grid h-7 w-7 cursor-grab place-items-center rounded-[2px] border-[1.5px] border-ink bg-card text-xs font-semibold active:cursor-grabbing", p.disabled && "opacity-40")}
            title="Sudrab mos qatorga tashlang"
          >
            {l}
          </span>
        ))}
        <span className="self-center font-mono text-[0.65rem] text-muted">← sudrab tashlang yoki ro‘yxatdan tanlang</span>
      </div>
      <div className="ml-11 mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {vals.map((val, i) => (
          <label
            key={i}
            onDragOver={(e) => {
              if (p.disabled) return;
              e.preventDefault();
              setOver(i);
            }}
            onDragLeave={() => setOver(null)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(null);
              const l = e.dataTransfer.getData("text/plain");
              if (!p.disabled && letters.includes(l)) set(i, l);
            }}
            className={cx("flex items-center gap-1.5 rounded-[2px] border border-ink bg-white px-1.5 py-1", over === i && "ring-2 ring-accent", val && "border-[1.5px]")}
          >
            <span className="num text-xs text-muted">{i + 1}</span>
            <select
              aria-label={`${p.item.n}-topshiriq, ${i + 1}-element`}
              disabled={p.disabled}
              value={val}
              onChange={(e) => set(i, e.target.value)}
              className="num w-full min-w-0 bg-transparent text-sm font-semibold focus:outline-none"
            >
              <option value="">—</option>
              {letters.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ O1 */

const SYMBOLS = ["²", "³", "√", "π", "°", "·", "−", "±", "→", "⁻"];

export function O1Row(p: RowProps & { decimalHint?: boolean }) {
  const v = typeof p.value === "string" ? p.value : "";
  const ref = useRef<HTMLInputElement>(null);
  const insert = (s: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? v.length;
    const end = el.selectionEnd ?? v.length;
    const next = (v.slice(0, start) + s + v.slice(end)).slice(0, 200);
    p.onChange(next || null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + s.length, start + s.length);
    });
  };
  return (
    <RowShell {...p} answered={!!v.trim()}>
      <div className="min-w-0 flex-1">
        <input
          ref={ref}
          aria-label={`${p.item.n}-topshiriq javobi`}
          className="field num !min-h-9 !py-1.5 text-[0.95rem]"
          value={v}
          maxLength={200}
          disabled={p.disabled}
          autoComplete="off"
          spellCheck={false}
          placeholder="Javob"
          onChange={(e) => p.onChange(e.target.value === "" ? null : e.target.value)}
        />
        {p.current && !p.disabled && (
          <div className="mt-1 flex flex-wrap gap-1" aria-label="Maxsus belgilar">
            {SYMBOLS.map((s) => (
              <button key={s} type="button" className="num h-6 min-w-6 rounded-[2px] border border-hair bg-card px-1 text-xs hover:border-ink" onMouseDown={(e) => e.preventDefault()} onClick={() => insert(s)}>
                {s}
              </button>
            ))}
            <span className="self-center pl-1 text-[0.65rem] text-muted">kasr: 0,5 yoki 0.5</span>
          </div>
        )}
      </div>
    </RowShell>
  );
}

/* ------------------------------------------------------------------ O2 */

export function O2Block(
  p: RowProps & {
    files: PublicFileMeta[];
    onUpload: (f: File) => Promise<void>;
    onRemove: (fileId: string) => Promise<void>;
    onOpen: (fileId: string) => Promise<void>;
  },
) {
  const text = p.value && typeof p.value === "object" && !Array.isArray(p.value) ? p.value.text : "";
  const ref = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const insert = (s: string) => {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    const next = (text.slice(0, start) + s + text.slice(end)).slice(0, 20000);
    p.onChange(next ? { text: next } : null);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + s.length, start + s.length);
    });
  };

  const upload = async (list: FileList | null) => {
    if (!list?.length) return;
    setErr(null);
    for (const f of Array.from(list)) {
      if (!["image/jpeg", "image/png", "application/pdf"].includes(f.type)) {
        setErr(`"${f.name}": faqat JPG, PNG yoki PDF qabul qilinadi.`);
        continue;
      }
      if (f.size > 10 * 1024 * 1024) {
        setErr(`"${f.name}": fayl 10 MB dan katta.`);
        continue;
      }
      if (p.files.length >= 5) {
        setErr("Har bir topshiriqqa ko‘pi bilan 5 ta fayl.");
        break;
      }
      setBusy(`“${f.name}” yuklanmoqda…`);
      try {
        await p.onUpload(f);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Yuklashda xatolik.");
      }
    }
    setBusy(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const answered = !!text.trim() || p.files.length > 0;

  return (
    <section
      id={`q-${p.item.n}`}
      data-q={p.item.n}
      onClick={p.onFocusRow}
      onFocusCapture={p.onFocusRow}
      aria-label={`${p.item.n}-topshiriq, yozma ish`}
      className={cx("scroll-mt-24 border-[1.5px] bg-card p-3", p.current ? "border-accent" : "border-ink")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-semibold">
          <span className="num mr-2">{p.item.n}</span>Yozma ish
          {p.flagged && <span className="ml-2 font-mono text-accent">⚑</span>}
        </p>
        <span className="chip chip-ink">maks. {p.item.o2Max} ball</span>
      </div>
      <p className="mt-1 text-xs text-muted">Yechim usuli (M) va hisob-kitoblar (A) alohida baholanadi — barcha bosqichlarni yozing.</p>
      <div className="mt-2 flex flex-wrap gap-1" aria-label="Formulalar uchun belgilar">
        {["²", "³", "√", "π", "Δ", "·", "×", "÷", "→", "⇌", "≈", "≤", "≥", "°C", "₂", "₃", "⁺", "⁻"].map((s) => (
          <button
            key={s}
            type="button"
            disabled={p.disabled}
            className="num h-7 min-w-7 rounded-[2px] border border-hair bg-paper px-1.5 text-xs hover:border-ink disabled:opacity-40"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insert(s)}
          >
            {s}
          </button>
        ))}
      </div>
      <textarea
        ref={ref}
        aria-label={`${p.item.n}-topshiriq yechimi`}
        className="field mt-2 min-h-48 resize-y font-[var(--font-sans)] leading-relaxed"
        value={text}
        disabled={p.disabled}
        maxLength={20000}
        placeholder="Berilgan: …&#10;Yechish: …&#10;Javob: …"
        onChange={(e) => p.onChange(e.target.value ? { text: e.target.value } : null)}
      />
      <div className="mt-1 flex justify-between font-mono text-[0.65rem] text-muted">
        <span>Matn avtomatik saqlanadi</span>
        <span>{text.length} / 20 000</span>
      </div>

      <div className="mt-3 border-t border-hair pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="eyebrow">Qo‘lda yozilgan yechim (JPG, PNG, PDF · 10 MB · 5 tagacha)</p>
          <label className={cx("btn btn-sm", (p.disabled || !!busy || p.files.length >= 5) && "pointer-events-none opacity-45")}>
            {busy ? <Spinner /> : "＋"} Fayl biriktirish
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              capture="environment"
              multiple
              className="sr-only"
              disabled={p.disabled || !!busy}
              onChange={(e) => upload(e.target.files)}
            />
          </label>
        </div>
        {busy && <p className="mt-2 text-xs text-muted">{busy}</p>}
        {err && (
          <p role="alert" className="mt-2 text-xs text-accent-ink">
            {err}
          </p>
        )}
        {p.files.length > 0 && (
          <ul className="mt-2 space-y-1">
            {p.files.map((f) => (
              <li key={f.id} className="flex items-center gap-2 border border-hair bg-paper/60 px-2 py-1.5 text-sm">
                <span className="chip chip-ink !text-[0.6rem]">{f.contentType === "application/pdf" ? "PDF" : "RASM"}</span>
                <button type="button" className="link min-w-0 flex-1 truncate text-left" onClick={() => p.onOpen(f.id)}>
                  {f.name}
                </button>
                <span className="num hidden text-xs text-muted sm:inline">
                  {fmtBytes(f.size)} · {fmtDateTime(f.uploadedAt)}
                </span>
                <button type="button" className="btn btn-ghost btn-sm !min-h-0 !px-2 text-accent-ink" disabled={p.disabled} onClick={() => p.onRemove(f.id)} aria-label={`${f.name} faylini o‘chirish`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {!answered && <p className="mt-2 text-xs text-warn">Bu topshiriq uchun hali javob yoki fayl yo‘q.</p>}
    </section>
  );
}
