"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { BookletPicker } from "@/components/admin/booklet-picker";
import { KeyEditor } from "@/components/admin/key-editor";
import { BookletFrame } from "@/components/booklet-frame";
import { Alert, Modal, PageLoader, ProgressBar, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { uploadBooklet } from "@/lib/admin-upload";
import { errorText } from "@/lib/api";
import type { BookletReport } from "@/lib/booklet";
import { OPTION_LETTERS, taskNumbers } from "@/lib/formats";
import { cx, fmtBytes, fmtDateTime } from "@/lib/format-utils";
import type { AnswerKey } from "@/lib/grading";
import { buildSheet, validateKey } from "@/lib/sheet";
import { MODE_LABEL, type Material, type MaterialStructure } from "@/lib/types";

function cleanKey(k: AnswerKey): AnswerKey {
  const out: AnswerKey = {};
  for (const [n, it] of Object.entries(k)) {
    if (it.type === "Y1" && !it.correct) continue;
    if (it.type === "O1" || it.type === "O") out[n] = { ...it, accepted: it.accepted.map((a) => a.trim()).filter(Boolean) };
    else out[n] = it;
  }
  return out;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <EditMaterial />
    </Suspense>
  );
}

function EditMaterial() {
  const { id } = useParams<{ id: string }>();
  const isNew = useSearchParams().has("yangi");
  const [m, setM] = useState<Material | null>(null);
  const [key, setKey] = useState<AnswerKey>({});
  const [structure, setStructure] = useState<MaterialStructure | null>(null);
  const [meta, setMeta] = useState({ title: "", description: "", revealAnswers: true, attemptLimit: "" });
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replaceReport, setReplaceReport] = useState<BookletReport | null>(null);
  const [replaceProgress, setReplaceProgress] = useState<number | null>(null);

  const apply = useCallback((r: { material: Material; key: AnswerKey }) => {
    setM(r.material);
    setKey(r.key);
    setStructure(r.material.structure);
    setMeta({
      title: r.material.title,
      description: r.material.description,
      revealAnswers: r.material.revealAnswers,
      attemptLimit: r.material.attemptLimit ? String(r.material.attemptLimit) : "",
    });
    setDirty(false);
  }, []);

  useEffect(() => {
    adminApi<{ material: Material; key: AnswerKey }>(`/api/admin/materials/${id}`)
      .then(apply)
      .catch((e) => setLoadErr(errorText(e)));
  }, [id, apply]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const sheet = useMemo(() => (m && structure ? buildSheet(m.format, structure) : []), [m, structure]);
  const problems = useMemo(() => (m && structure ? validateKey(m.format, structure, cleanKey(key)) : []), [m, structure, key]);
  const expected = useMemo(() => (m ? taskNumbers(m.format) : []), [m]);
  const onReplaceReady = useCallback((r: BookletReport | null) => setReplaceReport(r), []);

  if (loadErr) return <Alert tone="error" title="Material ochilmadi">{loadErr}</Alert>;
  if (!m || !structure) return <PageLoader />;
  const locked = (m.attemptsCount ?? 0) > 0;

  const patch = async (label: string, body: Record<string, unknown>, okText: string) => {
    setSaving(label);
    setMsg(null);
    try {
      const r = await adminApi<{ material: Material; key: AnswerKey }>(`/api/admin/materials/${id}`, { method: "PATCH", body });
      apply(r);
      setMsg({ tone: "ok", text: okText });
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setSaving(null);
    }
  };

  const saveAll = () =>
    patch(
      "all",
      {
        meta: { title: meta.title, description: meta.description, revealAnswers: meta.revealAnswers, attemptLimit: meta.attemptLimit ? Number(meta.attemptLimit) : null },
        key: cleanKey(key),
        ...(locked ? {} : { structure }),
      },
      "Barcha o‘zgarishlar saqlandi.",
    );

  const setStatus = async (status: Material["status"]) => {
    if (dirty) {
      setMsg({ tone: "error", text: "Avval o‘zgarishlarni saqlang." });
      return;
    }
    await patch("status", { status }, status === "published" ? "Material e’lon qilindi — nomzodlarga ko‘rinadi." : "Holat yangilandi.");
  };

  const replaceHtml = async () => {
    if (!replaceReport) return;
    setReplaceProgress(0);
    setMsg(null);
    try {
      const up = await uploadBooklet(replaceReport.html, setReplaceProgress);
      await patch("html", { html: { path: up.path, fileName: up.fileName, inlinedImages: replaceReport.stats.inlinedImages, warnings: replaceReport.warnings.slice(0, 50) } }, "HTML fayl almashtirildi.");
      setReplaceOpen(false);
    } catch (e) {
      setMsg({ tone: "error", text: errorText(e) });
    } finally {
      setReplaceProgress(null);
    }
  };

  const statusChip = { draft: "chip-warn", published: "chip-ok", archived: "chip-ink" }[m.status];

  return (
    <div className="mx-auto max-w-6xl pb-28">
      <nav className="font-mono text-xs text-muted">
        <Link href="/admin/materiallar" className="hover:text-ink">
          Materiallar
        </Link>{" "}
        / tahrirlash
      </nav>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex flex-wrap items-center gap-2">
            <span className={`chip ${statusChip}`}>{{ draft: "Qoralama", published: "E’lon qilingan", archived: "Arxiv" }[m.status]}</span>
            <span className="chip chip-ink">{m.subjectName}</span>
            <span className="chip chip-ink">{MODE_LABEL[m.mode]}</span>
            {m.timed ? <span className="chip chip-ink">{m.format.totalMinutes} daq.</span> : <span className="chip chip-ink">vaqtsiz</span>}
          </p>
          <h1 className="display mt-3 text-4xl">{m.title}</h1>
          <p className="mt-1 font-mono text-xs text-muted">
            {m.format.label} · yaratilgan {fmtDateTime(m.createdAt)} · urinishlar: {m.attemptsCount ?? 0}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {m.status !== "published" && (
            <button type="button" className="btn btn-primary" disabled={!!saving || problems.length > 0 || dirty} onClick={() => setStatus("published")} title={problems.length ? "Kalitdagi muammolarni tuzating" : ""}>
              E’lon qilish
            </button>
          )}
          {m.status === "published" && (
            <button type="button" className="btn" disabled={!!saving} onClick={() => setStatus("draft")}>
              Qoralamaga qaytarish
            </button>
          )}
          {m.status !== "archived" && locked && (
            <button type="button" className="btn btn-ghost" disabled={!!saving} onClick={() => setStatus("archived")}>
              Arxivlash
            </button>
          )}
        </div>
      </div>

      {isNew && (
        <Alert tone="ok" className="mt-5" title="HTML fayl bulutga yuklandi">
          Endi javoblar kalitini kiriting. Kalit to‘liq bo‘lgach, “E’lon qilish” tugmasi faollashadi.
        </Alert>
      )}
      {msg && (
        <Alert tone={msg.tone} className="mt-5">
          {msg.text}
        </Alert>
      )}
      {locked && (
        <Alert tone="info" className="mt-5">
          Bu material bo‘yicha {m.attemptsCount} ta urinish bor: javoblar varaqasi tuzilishi qulflangan. Kalitni o‘zgartirish faqat keyingi tekshiruvlarga ta’sir qiladi —
          yakunlangan natijalar o‘zgarmaydi.
        </Alert>
      )}

      {/* meta + booklet */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <section className="sheet space-y-4 p-5">
          <h2 className="display text-2xl">Asosiy ma’lumotlar</h2>
          <div>
            <label className="label" htmlFor="t">
              Sarlavha
            </label>
            <input
              id="t"
              className="field"
              value={meta.title}
              maxLength={160}
              onChange={(e) => {
                setMeta({ ...meta, title: e.target.value });
                setDirty(true);
              }}
            />
          </div>
          <div>
            <label className="label" htmlFor="d">
              Tavsif
            </label>
            <textarea
              id="d"
              className="field min-h-20"
              maxLength={1000}
              value={meta.description}
              onChange={(e) => {
                setMeta({ ...meta, description: e.target.value });
                setDirty(true);
              }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 accent-[var(--color-accent)]"
                checked={meta.revealAnswers}
                onChange={(e) => {
                  setMeta({ ...meta, revealAnswers: e.target.checked });
                  setDirty(true);
                }}
              />
              E’londan keyin to‘g‘ri javoblarni ko‘rsatish
            </label>
            <div>
              <label className="label" htmlFor="l">
                Urinishlar chegarasi
              </label>
              <input
                id="l"
                type="number"
                min={1}
                max={50}
                placeholder="cheklanmagan"
                className="field num"
                value={meta.attemptLimit}
                onChange={(e) => {
                  setMeta({ ...meta, attemptLimit: e.target.value });
                  setDirty(true);
                }}
              />
            </div>
          </div>
        </section>
        <section className="sheet p-5">
          <h2 className="display text-2xl">Test kitobchasi</h2>
          {m.html ? (
            <ul className="num mt-3 space-y-1 text-sm">
              <li>Fayl: {m.html.fileName}</li>
              <li>Hajm: {fmtBytes(m.html.size)}</li>
              <li>Joylangan rasmlar: {m.html.inlinedImages}</li>
              <li>Yuklangan: {fmtDateTime(m.html.uploadedAt)}</li>
            </ul>
          ) : (
            <Alert tone="warn" className="mt-3">
              HTML fayl yo‘q.
            </Alert>
          )}
          {m.html && m.html.warnings.length > 0 && (
            <details className="mt-3 text-xs text-ink-2">
              <summary className="cursor-pointer font-semibold">Yuklashdagi ogohlantirishlar ({m.html.warnings.length})</summary>
              <ul className="mt-1 list-disc pl-4">
                {m.html.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </details>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm"
              onClick={async () => {
                try {
                  const r = await adminApi<{ url: string }>(`/api/admin/materials/${id}/preview`);
                  setPreview(r.url);
                } catch (e) {
                  setMsg({ tone: "error", text: errorText(e) });
                }
              }}
            >
              Oldindan ko‘rish
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setReplaceOpen(true)}>
              Faylni almashtirish
            </button>
          </div>
        </section>
      </div>

      {/* structure */}
      <section className="sheet mt-6 p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-2xl">Javoblar varaqasi tuzilishi</h2>
          {locked && <span className="chip chip-ink">qulflangan</span>}
        </div>
        <p className="mt-1 text-xs text-muted">Kitobchadagi variantlar soniga moslang. Y2 uchun chap ustundagi elementlar va o‘ng ustundagi variantlar sonini kiriting.</p>
        <div className="mt-4 flex flex-wrap items-end gap-4">
          <label>
            <span className="label">Y1 variantlari</span>
            <select
              className="field num w-28"
              disabled={locked}
              value={structure.y1Options}
              onChange={(e) => {
                setStructure({ ...structure, y1Options: Number(e.target.value) });
                setDirty(true);
              }}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {OPTION_LETTERS.slice(0, n).join("")}
                </option>
              ))}
            </select>
          </label>
          {Object.entries(structure.y2).map(([n, y]) => (
            <fieldset key={n} className="flex items-end gap-2 border-l-[3px] border-hair pl-3">
              <legend className="label">Y2 · {n}</legend>
              <label className="text-xs">
                elementlar
                <input
                  type="number"
                  min={1}
                  max={10}
                  disabled={locked}
                  className="field num !min-h-9 w-20 !py-1"
                  value={y.left}
                  onChange={(e) => {
                    setStructure({ ...structure, y2: { ...structure.y2, [n]: { ...y, left: Math.max(1, Math.min(10, Number(e.target.value) || 1)) } } });
                    setDirty(true);
                  }}
                />
              </label>
              <label className="text-xs">
                variantlar
                <input
                  type="number"
                  min={2}
                  max={8}
                  disabled={locked}
                  className="field num !min-h-9 w-20 !py-1"
                  value={y.right}
                  onChange={(e) => {
                    setStructure({ ...structure, y2: { ...structure.y2, [n]: { ...y, right: Math.max(2, Math.min(8, Number(e.target.value) || 2)) } } });
                    setDirty(true);
                  }}
                />
              </label>
            </fieldset>
          ))}
        </div>
      </section>

      {/* key */}
      <section className="mt-8">
        <h2 className="display text-3xl">Javoblar kaliti</h2>
        <p className="mt-1 text-sm text-muted">Kalit faqat serverda saqlanadi va nomzodlarga hech qachon yuborilmaydi.</p>
        <div className="mt-4">
          <KeyEditor
            format={m.format}
            sheet={sheet}
            value={key}
            caseSensitiveDefault={m.subjectCode === "kimyo"}
            onChange={(k) => {
              setKey(k);
              setDirty(true);
            }}
          />
        </div>
      </section>

      {/* sticky save bar */}
      <div className="sheet-hard fixed inset-x-4 bottom-4 z-30 flex flex-wrap items-center gap-3 p-3 lg:left-72">
        <div className="min-w-0 flex-1 text-sm">
          {problems.length === 0 ? (
            <span className="text-ok">✓ Kalit to‘liq va formatga mos.</span>
          ) : (
            <details>
              <summary className="cursor-pointer text-accent-ink">
                {problems.length} ta muammo — e’lon qilish uchun tuzating
              </summary>
              <ul className="mt-1 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-ink-2">
                {problems.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
        <span className={cx("font-mono text-xs", dirty ? "text-warn" : "text-muted")}>{dirty ? "Saqlanmagan o‘zgarishlar" : "Saqlangan"}</span>
        <button type="button" className="btn btn-ink" disabled={!!saving || !dirty} onClick={saveAll}>
          {saving === "all" && <Spinner />} Saqlash
        </button>
      </div>

      <Modal open={!!preview} onClose={() => setPreview(null)} title="Kitobcha" wide>
        {preview && (
          <div className="h-[65vh] w-full border border-ink">
            <BookletFrame url={preview} title="Kitobcha" />
          </div>
        )}
      </Modal>
      <Modal
        open={replaceOpen}
        onClose={() => replaceProgress === null && setReplaceOpen(false)}
        dismissable={replaceProgress === null}
        title="HTML faylni almashtirish"
        wide
        footer={
          <>
            <button type="button" className="btn" disabled={replaceProgress !== null} onClick={() => setReplaceOpen(false)}>
              Bekor qilish
            </button>
            <button type="button" className="btn btn-primary" disabled={!replaceReport || replaceProgress !== null} onClick={replaceHtml}>
              {replaceProgress !== null && <Spinner />} Yuklash va almashtirish
            </button>
          </>
        }
      >
        {locked && (
          <Alert tone="warn" className="mb-3">
            Boshlangan urinishlar eski faylni ko‘rishda davom etadi; yangi urinishlar yangi faylni oladi.
          </Alert>
        )}
        <BookletPicker expectedNumbers={expected} onReady={onReplaceReady} />
        {replaceProgress !== null && (
          <div className="mt-3">
            <ProgressBar value={replaceProgress} tone="accent" label="Yuklash" />
          </div>
        )}
      </Modal>
    </div>
  );
}
