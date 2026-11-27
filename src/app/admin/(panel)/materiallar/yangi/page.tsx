"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookletPicker } from "@/components/admin/booklet-picker";
import { Alert, PageLoader, ProgressBar, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { uploadBooklet } from "@/lib/admin-upload";
import { errorText } from "@/lib/api";
import type { BookletReport } from "@/lib/booklet";
import { clientConfigured } from "@/lib/supabase/client";
import { range, taskNumbers } from "@/lib/formats";
import { cx } from "@/lib/format-utils";
import { MODE_LABEL, type MaterialMode, type SubjectWithFormat } from "@/lib/types";

export default function NewMaterial() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<SubjectWithFormat[] | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [subjectCode, setSubjectCode] = useState("");
  const [mode, setMode] = useState<MaterialMode>("full");
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(10);
  const [timed, setTimed] = useState(true);
  const [minutes, setMinutes] = useState(30);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [revealAnswers, setRevealAnswers] = useState(true);
  const [limit, setLimit] = useState("");
  const [report, setReport] = useState<BookletReport | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "saving">("idle");
  const [progress, setProgress] = useState(0);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adminApi<{ subjects: SubjectWithFormat[] }>("/api/admin/formats")
      .then((r) => {
        const active = r.subjects.filter((s) => !s.archived && s.format);
        setSubjects(active);
        if (active[0]) {
          setSubjectCode(active[0].code);
          setTo(Math.min(10, active[0].format?.totalTasks ?? 10));
        }
      })
      .catch((e) => setLoadErr(errorText(e)));
  }, []);

  const subject = subjects?.find((s) => s.code === subjectCode) ?? null;
  const format = subject?.format ?? null;
  const allNumbers = useMemo(() => (format ? taskNumbers(format) : []), [format]);

  const expected = useMemo(() => {
    if (!format) return [];
    if (mode === "full") return allNumbers;
    const a = Math.max(1, Math.min(from, to));
    const b = Math.min(format.totalTasks, Math.max(from, to));
    return range(a, b);
  }, [format, mode, from, to, allNumbers]);

  const onReady = useCallback((r: BookletReport | null) => {
    setReport(r);
    if (r) setTitle((t) => t || r.title);
  }, []);

  if (loadErr) return <Alert tone="error" title="Ma’lumotlarni yuklab bo‘lmadi">{loadErr}</Alert>;
  if (!subjects) return <PageLoader />;
  if (!clientConfigured) return <Alert tone="warn" title="Supabase sozlanmagan">NEXT_PUBLIC_SUPABASE_URL va ochiq kalitni kiriting — fayllar Supabase Storage’ga yuklanadi.</Alert>;

  const rangeErr = mode !== "full" && format && (from < 1 || to > format.totalTasks || from > to) ? `Oraliq 1–${format.totalTasks} ichida va “dan” ≤ “gacha” bo‘lishi kerak.` : null;
  const canSubmit = !!report && !!format && title.trim().length >= 3 && !rangeErr && (mode === "full" || !timed || minutes >= 1) && stage === "idle";

  const submit = async () => {
    if (!report || !format) return;
    setErr(null);
    setStage("uploading");
    setProgress(0);
    try {
      const up = await uploadBooklet(report.html, setProgress);
      setStage("saving");
      const res = await adminApi<{ id: string }>("/api/admin/materials", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          subjectCode,
          mode,
          timed: mode === "full" ? true : timed,
          range: mode === "full" ? null : { from, to },
          minutes: mode === "full" || !timed ? null : minutes,
          revealAnswers,
          attemptLimit: limit ? Number(limit) : null,
          html: { path: up.path, fileName: up.fileName, inlinedImages: report.stats.inlinedImages, warnings: report.warnings.slice(0, 50) },
        },
      });
      router.push(`/admin/materiallar/${res.id}?yangi=1`);
    } catch (e) {
      setErr(errorText(e));
      setStage("idle");
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <p className="eyebrow">Material yaratish · 1-qadam</p>
      <h1 className="display mt-1 text-5xl">HTML testni yuklash</h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-2">
        Yuklash jarayoni: <span className="num">Fayl → Tahlil → Oldindan ko‘rish → Bulutga yuklash → Javoblar kaliti → E’lon qilish</span>. Material avval{" "}
        <b>qoralama</b> sifatida saqlanadi — kalit to‘liq kiritilmaguncha nomzodlarga ko‘rinmaydi.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <section className="sheet space-y-5 p-5">
          <div>
            <label className="label" htmlFor="subject">
              Fan
            </label>
            <select
              id="subject"
              className="field"
              value={subjectCode}
              onChange={(e) => {
                setSubjectCode(e.target.value);
                const f = subjects.find((s) => s.code === e.target.value)?.format;
                setFrom(1);
                setTo(Math.min(10, f?.totalTasks ?? 10));
              }}
            >
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            {format && (
              <p className="mt-1 font-mono text-xs text-muted">
                Format: {format.label} · {format.totalTasks} topshiriq · {format.totalMinutes} daq.
              </p>
            )}
          </div>

          <fieldset>
            <legend className="label">Turi</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {(["full", "practice", "diagnostic"] as const).map((m) => (
                <label key={m} className={cx("cursor-pointer border-[1.5px] p-3 text-sm", mode === m ? "border-ink bg-paper-2" : "border-hair")}>
                  <input
                    type="radio"
                    name="mode"
                    className="sr-only"
                    checked={mode === m}
                    onChange={() => {
                      setMode(m);
                      setTimed(m !== "practice");
                    }}
                  />
                  <span className="font-semibold">{MODE_LABEL[m]}</span>
                  <span className="mt-1 block text-xs text-muted">{m === "full" ? "Rasmiy vaqt va barcha topshiriqlar" : m === "practice" ? "Topshiriqlar oralig‘i, vaqt ixtiyoriy" : "Qisqa, vaqtli tekshiruv"}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {mode !== "full" && format && (
            <div className="grid grid-cols-2 gap-3 border-l-[3px] border-accent pl-3 sm:grid-cols-4">
              <div>
                <label className="label" htmlFor="from">
                  Dan (№)
                </label>
                <input id="from" type="number" min={1} max={format.totalTasks} className="field num" value={from} onChange={(e) => setFrom(Number(e.target.value))} />
              </div>
              <div>
                <label className="label" htmlFor="to">
                  Gacha (№)
                </label>
                <input id="to" type="number" min={1} max={format.totalTasks} className="field num" value={to} onChange={(e) => setTo(Number(e.target.value))} />
              </div>
              <label className="col-span-2 flex items-center gap-2 self-end pb-3 text-sm">
                <input type="checkbox" className="accent-[var(--color-accent)]" checked={timed} onChange={(e) => setTimed(e.target.checked)} /> Vaqt bilan
                {timed && (
                  <>
                    <input aria-label="Daqiqalar" type="number" min={1} max={600} className="field num !min-h-9 w-20 !py-1" value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /> daq.
                  </>
                )}
              </label>
              {rangeErr && <p className="col-span-full text-xs text-accent-ink">{rangeErr}</p>}
              <p className="col-span-full text-xs text-muted">Topshiriqlar rasmiy raqamlash bo‘yicha qoladi (kitobchadagi raqamlar bilan bir xil bo‘lishi kerak).</p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="title">
              Sarlavha
            </label>
            <input id="title" className="field" value={title} maxLength={160} onChange={(e) => setTitle(e.target.value)} placeholder="Masalan: Biologiya · Mock №3 · noyabr" />
          </div>
          <div>
            <label className="label" htmlFor="desc">
              Tavsif (ixtiyoriy)
            </label>
            <textarea id="desc" className="field min-h-20" value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-[var(--color-accent)]" checked={revealAnswers} onChange={(e) => setRevealAnswers(e.target.checked)} />
              Natija e’lon qilingach to‘g‘ri javoblarni ko‘rsatish
            </label>
            <div>
              <label className="label" htmlFor="limit">
                Urinishlar chegarasi
              </label>
              <input id="limit" type="number" min={1} max={50} placeholder="cheklanmagan" className="field num" value={limit} onChange={(e) => setLimit(e.target.value)} />
            </div>
          </div>
        </section>

        <section>
          <BookletPicker expectedNumbers={expected} onReady={onReady} />
        </section>
      </div>

      <div className="sheet-hard sticky bottom-4 mt-8 flex flex-wrap items-center gap-4 p-4">
        <div className="min-w-48 flex-1">
          {stage === "uploading" ? (
            <>
              <p className="mb-1 text-sm">Supabase Storage’ga yuklanmoqda… {progress}%</p>
              <ProgressBar value={progress} tone="accent" label="Yuklash jarayoni" />
            </>
          ) : stage === "saving" ? (
            <p className="flex items-center gap-2 text-sm">
              <Spinner /> Material saqlanmoqda…
            </p>
          ) : err ? (
            <p className="text-sm text-accent-ink">{err}</p>
          ) : (
            <p className="text-sm text-muted">{!report ? "HTML faylni tanlang va tekshiruvdan o‘tkazing." : title.trim().length < 3 ? "Sarlavha kiriting." : "Tayyor. Keyingi qadam — javoblar kaliti."}</p>
          )}
        </div>
        <button type="button" className="btn btn-primary" disabled={!canSubmit} onClick={submit}>
          {stage !== "idle" && <Spinner />} Bulutga yuklash va davom etish →
        </button>
      </div>
    </div>
  );
}
