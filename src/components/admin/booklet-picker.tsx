"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { type BookletReport, processBooklet } from "@/lib/booklet";
import { cx, fmtBytes } from "@/lib/format-utils";
import { Alert, Modal, Spinner } from "../ui";

/**
 * Drop zone for an HTML booklet + its images/CSS. Processes everything locally,
 * shows a validation report and a sandboxed preview. Nothing is uploaded here.
 */
export function BookletPicker({ expectedNumbers, onReady }: { expectedNumbers: number[]; onReady: (r: BookletReport | null) => void }) {
  const [htmlFile, setHtmlFile] = useState<File | null>(null);
  const [assets, setAssets] = useState<File[]>([]);
  const [removeScripts, setRemoveScripts] = useState(false);
  const [report, setReport] = useState<BookletReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const expectedKey = expectedNumbers.join(",");
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  const accept = (list: FileList | File[]) => {
    const files = Array.from(list);
    const html = files.filter((f) => /\.html?$/i.test(f.name));
    const rest = files.filter((f) => !/\.html?$/i.test(f.name) && (/^image\//.test(f.type) || /\.(css|png|jpe?g|gif|svg|webp|bmp|emz|wmz)$/i.test(f.name)));
    setErr(null);
    if (html.length > 1) {
      setErr("Bir vaqtda faqat bitta HTML fayl tanlang (rasmlar soni cheklanmagan).");
      return;
    }
    if (html.length === 1) setHtmlFile(html[0]);
    else if (!htmlFile) {
      setErr("HTML fayl tanlanmadi. .html yoki .htm faylini qo‘shing.");
    }
    if (rest.length) {
      setAssets((prev) => {
        const m = new Map(prev.map((f) => [f.name.toLowerCase(), f]));
        for (const f of rest) m.set(f.name.toLowerCase(), f);
        return Array.from(m.values());
      });
    }
    const ignored = files.length - html.length - rest.length;
    if (ignored > 0) setErr(`${ignored} ta fayl e’tiborsiz qoldirildi (faqat HTML, rasm va CSS qabul qilinadi).`);
  };

  const run = useCallback(async () => {
    if (!htmlFile) {
      setReport(null);
      onReadyRef.current(null);
      return;
    }
    setBusy(true);
    try {
      const r = await processBooklet(htmlFile, assets, expectedKey ? expectedKey.split(",").map(Number) : [], { removeScripts });
      setReport(r);
      onReadyRef.current(r.errors.length ? null : r);
    } catch (e) {
      setReport(null);
      onReadyRef.current(null);
      setErr(`Faylni o‘qib bo‘lmadi: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }, [htmlFile, assets, removeScripts, expectedKey]);

  // Re-process whenever inputs change; the short delay also debounces range edits.
  useEffect(() => {
    const t = setTimeout(() => void run(), 200);
    return () => clearTimeout(t);
  }, [run]);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          accept(e.dataTransfer.files);
        }}
        className={cx("crop graph-paper flex flex-col items-center justify-center gap-3 rounded-[3px] border-[1.5px] border-dashed px-6 py-10 text-center transition-colors", drag ? "border-accent bg-accent-soft" : "border-ink/60")}
      >
        <p className="display text-2xl">HTML test faylini shu yerga tashlang</p>
        <p className="max-w-md text-sm text-ink-2">
          Bitta <b>.html</b> fayl + undagi rasmlar (PNG, JPG, GIF, SVG) va CSS. Word’dan “Veb-sahifa” sifatida saqlangan bo‘lsa, “…_files” papkasidagi barcha
          fayllarni ham tanlang — ular avtomatik ichiga joylanadi.
        </p>
        <button type="button" className="btn btn-ink btn-sm" onClick={() => inputRef.current?.click()}>
          Fayllarni tanlash
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".html,.htm,text/html,image/*,.css"
          className="sr-only"
          onChange={(e) => {
            if (e.target.files) accept(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {err && (
        <Alert tone="warn" className="mt-3">
          {err}
        </Alert>
      )}

      {(htmlFile || assets.length > 0) && (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr]">
          <div className="sheet p-4 text-sm">
            <p className="eyebrow">Tanlangan fayllar</p>
            <p className="mt-2 flex items-center justify-between gap-2">
              <span className="truncate font-semibold">{htmlFile ? htmlFile.name : "HTML tanlanmagan"}</span>
              <span className="num text-xs text-muted">{htmlFile && fmtBytes(htmlFile.size)}</span>
            </p>
            {assets.length > 0 && (
              <p className="mt-1 text-xs text-muted">
                + {assets.length} ta qo‘shimcha fayl ({fmtBytes(assets.reduce((s, f) => s + f.size, 0))}){" "}
                <button type="button" className="link" onClick={() => setAssets([])}>
                  tozalash
                </button>
              </p>
            )}
            <label className="mt-3 flex items-start gap-2 text-xs">
              <input type="checkbox" className="mt-0.5 accent-[var(--color-accent)]" checked={removeScripts} onChange={(e) => setRemoveScripts(e.target.checked)} />
              <span>JavaScript’ni olib tashlash (formulalar MathJax/KaTeX bilan chizilgan bo‘lsa, belgilamang)</span>
            </label>
          </div>
          <div className="sheet p-4 text-sm">
            <p className="eyebrow">Tekshiruv</p>
            {busy ? (
              <p className="mt-2 flex items-center gap-2 text-muted">
                <Spinner /> Fayl tahlil qilinmoqda…
              </p>
            ) : report ? (
              <ul className="num mt-2 space-y-0.5 text-xs">
                <li>Kodlash: {report.charset.toUpperCase()} → UTF-8</li>
                <li>
                  Rasmlar: {report.stats.images} (joylandi: {report.stats.inlinedImages}, tashqi: {report.stats.externalImages}, topilmadi: {report.stats.missingImages.length})
                </li>
                <li>Skriptlar: {report.stats.scripts}{report.stats.removedScripts && report.stats.scripts ? " (olib tashlandi)" : ""}</li>
                <li>Matn hajmi: {report.stats.textLength.toLocaleString("en-US").replace(/,/g, " ")} belgi</li>
                <li>Yakuniy hajm: {fmtBytes(report.bytes)}</li>
              </ul>
            ) : (
              <p className="mt-2 text-muted">HTML fayl kutilmoqda.</p>
            )}
            {report && (
              <button type="button" className="btn btn-sm mt-3" onClick={() => setPreview(true)}>
                Oldindan ko‘rish
              </button>
            )}
          </div>
        </div>
      )}

      {report && report.errors.length > 0 && (
        <Alert tone="error" className="mt-3" title="Yuklashdan oldin tuzatilishi kerak">
          <ul className="list-disc pl-4">
            {report.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}
      {report && report.warnings.length > 0 && (
        <Alert tone="warn" className="mt-3" title="E’tibor bering">
          <ul className="list-disc pl-4">
            {report.warnings.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </Alert>
      )}
      {report && report.errors.length === 0 && (
        <Alert tone="ok" className="mt-3">
          Fayl yuklashga tayyor. Oldindan ko‘rishda matn, formulalar va rasmlar to‘g‘ri chiqqanini tekshiring.
        </Alert>
      )}

      <Modal open={preview} onClose={() => setPreview(false)} title="Kitobcha — oldindan ko‘rish" wide>
        {report && (
          <iframe title="Kitobcha oldindan ko‘rish" sandbox="allow-scripts" srcDoc={report.html} className="h-[65vh] w-full border border-ink bg-white" />
        )}
      </Modal>
    </div>
  );
}
