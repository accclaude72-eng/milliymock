"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, PageLoader } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { cx } from "@/lib/format-utils";
import { parseVideoUrl } from "@/lib/sm2";
import type { SubjectWithFormat } from "@/lib/types";

interface Video {
  id: string;
  subjectCode: string;
  topic: string | null;
  title: string;
  description: string | null;
  provider: "youtube" | "vimeo";
  ref: string;
  durationSec: number | null;
  position: number;
  status: "draft" | "published" | "archived";
  completedBy: number;
}
const EMPTY = { subjectCode: "", topic: "", title: "", description: "", url: "", durationMin: "", position: "0" };
const STATUS = { draft: "qoralama", published: "e’lon qilingan", archived: "arxiv" } as const;

export default function VideosAdmin() {
  const [list, setList] = useState<Video[] | null>(null);
  const [subjects, setSubjects] = useState<SubjectWithFormat[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [f, setF] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() => {
    adminApi<{ videos: Video[] }>("/api/admin/videos")
      .then((d) => setList(d.videos))
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(() => {
    load();
    adminApi<SubjectWithFormat[]>("/api/subjects")
      .then((s) => {
        setSubjects(s);
        setF((cur) => (cur.subjectCode ? cur : { ...cur, subjectCode: s[0]?.code ?? "" }));
      })
      .catch(() => undefined);
  }, [load]);

  const body = () => ({
    subjectCode: f.subjectCode,
    topic: f.topic.trim() || null,
    title: f.title.trim(),
    description: f.description.trim() || null,
    url: f.url.trim(),
    durationMin: f.durationMin ? Number(f.durationMin) : null,
    position: Number(f.position) || 0,
  });
  const save = async () => {
    setErr(null);
    setNote(null);
    try {
      if (editing) await adminApi(`/api/admin/videos/${editing}`, { method: "POST", body: { action: "update", ...body() } });
      else await adminApi("/api/admin/videos", { method: "POST", body: body() });
      setNote(editing ? "Video yangilandi." : "Video qoralama sifatida qo‘shildi. E’lon qilish uchun ro‘yxatdan tanlang.");
      setF({ ...EMPTY, subjectCode: f.subjectCode });
      setEditing(null);
      load();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  const status = async (id: string, s: Video["status"]) => {
    setErr(null);
    try {
      await adminApi(`/api/admin/videos/${id}`, { method: "POST", body: { action: "status", status: s } });
      load();
    } catch (e) {
      setErr(errorText(e));
    }
  };
  const parsed = f.url ? parseVideoUrl(f.url) : null;
  const name = (c: string) => subjects.find((s) => s.code === c)?.name ?? c;

  if (!list && !err) return <PageLoader />;
  return (
    <div>
      <p className="eyebrow">13 · Kontent</p>
      <h1 className="display mt-1 text-4xl">Video darslar</h1>
      <p className="mt-1 text-sm text-muted">Videolar saytga yuklanmaydi — YouTube yoki Vimeo havolasi qo‘shiladi (YouTube’da “Ro‘yxatga kiritilmagan / Unlisted” rejimi ham ishlaydi).</p>
      {err && (
        <Alert tone="error" className="mt-4">
          {err}
        </Alert>
      )}
      {note && (
        <Alert tone="ok" className="mt-4">
          {note}
        </Alert>
      )}

      <form
        className="sheet-hard mt-6 grid gap-3 p-5 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="md:col-span-2">
          <label className="label" htmlFor="v-url">
            YouTube / Vimeo havolasi
          </label>
          <input id="v-url" className="field" required value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://youtu.be/…" aria-invalid={!!f.url && !parsed} />
          {f.url && <p className={cx("mt-1 text-xs", parsed ? "text-ok" : "text-accent")}>{parsed ? `✓ ${parsed.provider} · ${parsed.ref}` : "Havola tanilmadi"}</p>}
        </div>
        <div>
          <label className="label" htmlFor="v-title">
            Sarlavha
          </label>
          <input id="v-title" className="field" required minLength={3} maxLength={120} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="v-subj">
              Fan
            </label>
            <select id="v-subj" className="field" value={f.subjectCode} onChange={(e) => setF({ ...f, subjectCode: e.target.value })}>
              {subjects.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="v-topic">
              Mavzu
            </label>
            <input id="v-topic" className="field" maxLength={120} value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} placeholder="Masalan: Genetika" />
          </div>
        </div>
        <div className="md:col-span-2">
          <label className="label" htmlFor="v-desc">
            Tavsif
          </label>
          <textarea id="v-desc" className="field" rows={2} maxLength={2000} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="v-dur">
              Davomiyligi (daq)
            </label>
            <input id="v-dur" type="number" min={0} max={600} className="field num" value={f.durationMin} onChange={(e) => setF({ ...f, durationMin: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="v-pos">
              Tartib raqami
            </label>
            <input id="v-pos" type="number" min={0} className="field num" value={f.position} onChange={(e) => setF({ ...f, position: e.target.value })} />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <button className="btn btn-primary" disabled={!parsed || f.title.trim().length < 3}>
            {editing ? "Saqlash" : "Qo‘shish"}
          </button>
          {editing && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setEditing(null);
                setF({ ...EMPTY, subjectCode: f.subjectCode });
              }}
            >
              Bekor
            </button>
          )}
        </div>
      </form>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="text-left text-xs text-muted">
            <tr>
              <th className="py-2">#</th>
              <th>Sarlavha</th>
              <th>Fan · mavzu</th>
              <th>Holati</th>
              <th>Ko‘rganlar</th>
              <th />
            </tr>
          </thead>
          <tbody className="divide-y divide-hair border-y border-hair">
            {list?.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-muted">
                  Hali video yo‘q.
                </td>
              </tr>
            )}
            {list?.map((v) => (
              <tr key={v.id} className={cx(v.status === "archived" && "opacity-60")}>
                <td className="num py-2">{v.position}</td>
                <td className="font-medium">{v.title}</td>
                <td className="text-muted">
                  {name(v.subjectCode)}
                  {v.topic ? ` · ${v.topic}` : ""}
                </td>
                <td>
                  <span className={cx("chip", v.status === "published" ? "chip-ok" : v.status === "draft" ? "chip-warn" : "")}>{STATUS[v.status]}</span>
                </td>
                <td className="num">{v.completedBy}</td>
                <td className="space-x-1 whitespace-nowrap text-right">
                  <button
                    type="button"
                    className="btn btn-sm btn-ghost"
                    onClick={() => {
                      setEditing(v.id);
                      setF({
                        subjectCode: v.subjectCode,
                        topic: v.topic ?? "",
                        title: v.title,
                        description: v.description ?? "",
                        url: v.provider === "youtube" ? `https://youtu.be/${v.ref}` : `https://vimeo.com/${v.ref}`,
                        durationMin: v.durationSec ? String(Math.round(v.durationSec / 60)) : "",
                        position: String(v.position),
                      });
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Tahrirlash
                  </button>
                  {v.status !== "published" ? (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => status(v.id, "published")}>
                      E’lon qilish
                    </button>
                  ) : (
                    <button type="button" className="btn btn-sm" onClick={() => status(v.id, "archived")}>
                      Arxivlash
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
