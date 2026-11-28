"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookletFrame } from "@/components/booklet-frame";
import { Alert, EmptyState, Modal, PageLoader, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx, fmtBytes, fmtDateTime } from "@/lib/format-utils";
import { MODE_LABEL, type MaterialMode } from "@/lib/types";

interface Row {
  id: string;
  title: string;
  subjectCode: string;
  subjectName: string;
  formatLabel: string;
  mode: MaterialMode;
  timed: boolean;
  status: "draft" | "published" | "archived";
  keyComplete: boolean;
  problems: number;
  attemptsCount: number;
  fileName: string | null;
  size: number;
  createdAt: number;
  updatedAt: number;
  publishedAt: number | null;
}

const STATUS = {
  draft: { l: "Qoralama", c: "chip-warn" },
  published: { l: "E’lon qilingan", c: "chip-ok" },
  archived: { l: "Arxiv", c: "chip-ink" },
};

export default function MaterialsAdmin() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Row["status"]>("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);
  const [del, setDel] = useState<Row | null>(null);

  const load = useCallback(() => {
    adminApi<Row[]>("/api/admin/materials")
      .then(setRows)
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(load, [load]);

  const setStatus = async (r: Row, status: Row["status"]) => {
    setBusy(r.id);
    setErr(null);
    try {
      await adminApi(`/api/admin/materials/${r.id}`, { method: "PATCH", body: { status } });
      load();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  const openPreview = async (r: Row) => {
    setBusy(r.id);
    try {
      const { url } = await adminApi<{ url: string }>(`/api/admin/materials/${r.id}/preview`);
      setPreview({ title: r.title, url });
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(null);
    }
  };

  if (!rows && !err) return <PageLoader />;
  const shown = (rows ?? []).filter((r) => filter === "all" || r.status === filter);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Test materiallari</p>
          <h1 className="display mt-1 text-5xl">Materiallar</h1>
          <p className="mt-2 text-sm text-muted">Kitobchalar yopiq Supabase Storage’da, kalitlar faqat serverda saqlanadi.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BankSync />
          <Link href="/admin/materiallar/yangi" className="btn btn-primary">
            ＋ HTML test yuklash
          </Link>
        </div>
      </div>
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}
      <div className="mt-6 flex flex-wrap gap-1">
        {(["all", "draft", "published", "archived"] as const).map((f) => (
          <button key={f} type="button" aria-pressed={filter === f} className={cx("btn btn-sm", filter === f ? "btn-ink" : "btn-ghost")} onClick={() => setFilter(f)}>
            {f === "all" ? "Barchasi" : STATUS[f].l} <span className="num text-xs opacity-70">{(rows ?? []).filter((r) => f === "all" || r.status === f).length}</span>
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="mt-6">
          <EmptyState title="Material yo‘q" action={<Link href="/admin/materiallar/yangi" className="btn btn-primary">Birinchi testni yuklash</Link>}>
            HTML test faylini yuklang, javoblar kalitini kiriting va e’lon qiling.
          </EmptyState>
        </div>
      ) : (
        <div className="sheet mt-4 overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Material</th>
                <th>Holat</th>
                <th>Kalit</th>
                <th className="text-right">Urinish</th>
                <th>Yangilangan</th>
                <th className="text-right">Amallar</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td className="min-w-64">
                    <Link href={`/admin/materiallar/${r.id}`} className="font-semibold hover:underline">
                      {r.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.subjectName} · {MODE_LABEL[r.mode]} · {r.formatLabel}
                    </p>
                    <p className="num text-[0.7rem] text-muted">
                      {r.fileName ?? "—"} · {fmtBytes(r.size)}
                    </p>
                  </td>
                  <td>
                    <span className={`chip ${STATUS[r.status].c}`}>{STATUS[r.status].l}</span>
                  </td>
                  <td>{r.keyComplete ? <span className="chip chip-ok">✓ to‘liq</span> : <span className="chip chip-accent">{r.problems} ta muammo</span>}</td>
                  <td className="num text-right">{r.attemptsCount}</td>
                  <td className="num whitespace-nowrap text-xs">{fmtDateTime(r.updatedAt)}</td>
                  <td>
                    <div className="flex justify-end gap-1">
                      {busy === r.id && <Spinner className="self-center" />}
                      <button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => openPreview(r)}>
                        Ko‘rish
                      </button>
                      <Link href={`/admin/materiallar/${r.id}`} className="btn btn-sm">
                        Tahrirlash
                      </Link>
                      {r.status === "published" ? (
                        <button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => setStatus(r, "draft")}>
                          Yashirish
                        </button>
                      ) : r.status === "draft" ? (
                        <button type="button" className="btn btn-sm btn-ink" disabled={!!busy || !r.keyComplete} title={r.keyComplete ? "" : "Avval javoblar kalitini to‘ldiring"} onClick={() => setStatus(r, "published")}>
                          E’lon qilish
                        </button>
                      ) : (
                        <button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => setStatus(r, "draft")}>
                          Tiklash
                        </button>
                      )}
                      {r.attemptsCount > 0 ? (
                        r.status !== "archived" && (
                          <button type="button" className="btn btn-sm btn-ghost" disabled={!!busy} onClick={() => setStatus(r, "archived")}>
                            Arxivlash
                          </button>
                        )
                      ) : (
                        <button type="button" className="btn btn-sm btn-ghost btn-danger" disabled={!!busy} onClick={() => setDel(r)}>
                          O‘chirish
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={!!preview} onClose={() => setPreview(null)} title={preview?.title ?? ""} wide>
        {preview && (
          <div className="h-[65vh] w-full border border-ink">
            <BookletFrame url={preview.url} title="Kitobcha" />
          </div>
        )}
      </Modal>
      <Modal
        open={!!del}
        onClose={() => setDel(null)}
        title="Materialni o‘chirish"
        footer={
          <>
            <button type="button" className="btn" onClick={() => setDel(null)}>
              Bekor qilish
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!!busy}
              onClick={async () => {
                if (!del) return;
                setBusy(del.id);
                try {
                  await adminApi(`/api/admin/materials/${del.id}`, { method: "DELETE" });
                  setDel(null);
                  load();
                } catch (e) {
                  setErr(errorText(e));
                  setDel(null);
                } finally {
                  setBusy(null);
                }
              }}
            >
              Butunlay o‘chirish
            </button>
          </>
        }
      >
        <p className="text-sm">
          <b>{del?.title}</b> materiali, uning javoblar kaliti va HTML fayli bulutdan butunlay o‘chiriladi. Bu amalni qaytarib bo‘lmaydi.
        </p>
      </Modal>
    </div>
  );
}

/** Rebuilds the question bank (mistake notebook, practice) from all published booklets. */
function BankSync() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await adminApi<{ materials: number; questions: number }>("/api/admin/question-bank", { method: "POST" });
      setMsg(`✓ ${r.materials} ta testdan ${r.questions} ta savol`);
    } catch (e) {
      setMsg(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="flex items-center gap-2">
      {msg && <span className="text-xs text-muted">{msg}</span>}
      <button type="button" className="btn" disabled={busy} onClick={run} title="E’lon qilingan kitobchalardan savollar bazasini qayta tuzadi">
        {busy && <Spinner />} ↻ Savollar bazasi
      </button>
    </span>
  );
}
