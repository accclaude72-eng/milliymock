"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, PageLoader, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { errorText } from "@/lib/api";
import { DEFAULT_GRADE_BOUNDARIES, type ExamFormat, type TaskType, validateFormat } from "@/lib/formats";
import { cx, fmtDateTime } from "@/lib/format-utils";
import type { SubjectWithFormat } from "@/lib/types";

type Fmt = ExamFormat & { materialsUsing: number };

export default function FormatsAdmin() {
  const [data, setData] = useState<{ formats: Fmt[]; subjects: SubjectWithFormat[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [edit, setEdit] = useState<Fmt | null>(null);
  const [dup, setDup] = useState<Fmt | null>(null);
  const [newSub, setNewSub] = useState(false);

  const load = useCallback(() => {
    adminApi<{ formats: Fmt[]; subjects: SubjectWithFormat[] }>("/api/admin/formats")
      .then(setData)
      .catch((e) => setErr(errorText(e)));
  }, []);
  useEffect(load, [load]);

  if (!data) return err ? <Alert tone="error">{err}</Alert> : <PageLoader />;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Fanlar reestri</p>
          <h1 className="display mt-1 text-5xl">Fanlar va formatlar</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">
            Har bir material va urinish o‘z format nusxasini saqlaydi — formatni tahrirlash yoki yangi versiya yaratish oldingi natijalarni o‘zgartirmaydi.
          </p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setNewSub(true)}>
          ＋ Yangi fan
        </button>
      </div>
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

      <section className="mt-8 space-y-4">
        {data.subjects.map((s) => (
          <SubjectCard key={s.code} s={s} formats={data.formats.filter((f) => f.subjectCode === s.code)} onEdit={setEdit} onDup={setDup} onSaved={(t) => { setMsg(t); load(); }} onError={setErr} />
        ))}
      </section>

      <section className="sheet mt-10 p-5">
        <h2 className="display text-2xl">Sertifikat darajalari (ma’lumot uchun)</h2>
        <p className="mt-1 text-xs text-muted">{DEFAULT_GRADE_BOUNDARIES.source}. Platforma bu darajalarni avtomatik tatbiq etmaydi.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {DEFAULT_GRADE_BOUNDARIES.levels.map((l) => (
            <span key={l.level} className="chip chip-ink">
              {l.level}: {l.rule}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-warn">{DEFAULT_GRADE_BOUNDARIES.note}</p>
      </section>

      {edit && <FormatEditor f={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); setMsg("Format saqlandi."); load(); }} />}
      {dup && <DuplicateModal f={dup} onClose={() => setDup(null)} onSaved={(id) => { setDup(null); setMsg(`Yangi versiya yaratildi: ${id}. Uni tahrirlab, fan uchun faol qiling.`); load(); }} />}
      {newSub && <NewSubjectModal formats={data.formats} onClose={() => setNewSub(false)} onSaved={() => { setNewSub(false); setMsg("Fan qo‘shildi. Endi uning formatini tahrirlang."); load(); }} />}
    </div>
  );
}

function SubjectCard({ s, formats, onEdit, onDup, onSaved, onError }: { s: SubjectWithFormat; formats: Fmt[]; onEdit: (f: Fmt) => void; onDup: (f: Fmt) => void; onSaved: (t: string) => void; onError: (e: string) => void }) {
  const [v, setV] = useState({ name: s.name, description: s.description, order: s.order, activeFormatId: s.activeFormatId, archived: s.archived });
  const [busy, setBusy] = useState(false);
  const dirty = v.name !== s.name || v.description !== s.description || v.order !== s.order || v.activeFormatId !== s.activeFormatId || v.archived !== s.archived;
  return (
    <article className={cx("sheet p-5", s.archived && "opacity-70")}>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input aria-label="Fan nomi" className="field display !min-h-10 text-2xl" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
            <span className="num text-xs text-muted">{s.code}</span>
          </div>
          <textarea aria-label="Tavsif" className="field min-h-16 text-sm" value={v.description} maxLength={300} onChange={(e) => setV({ ...v, description: e.target.value })} />
          <div className="flex flex-wrap items-end gap-3">
            <label>
              <span className="label">Faol format</span>
              <select className="field" value={v.activeFormatId} onChange={(e) => setV({ ...v, activeFormatId: e.target.value })}>
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label} {f.status === "archived" ? "(arxiv)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="label">Tartib</span>
              <input type="number" className="field num w-20" value={v.order} onChange={(e) => setV({ ...v, order: Number(e.target.value) || 0 })} />
            </label>
            <label className="flex items-center gap-2 pb-3 text-sm">
              <input type="checkbox" className="accent-[var(--color-accent)]" checked={v.archived} onChange={(e) => setV({ ...v, archived: e.target.checked })} /> Arxivlangan
            </label>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ink"
            disabled={!dirty || busy}
            onClick={async () => {
              setBusy(true);
              try {
                await adminApi(`/api/admin/subjects/${s.code}`, { method: "PATCH", body: v });
                onSaved(`“${v.name}” saqlandi.`);
              } catch (e) {
                onError(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Fanni saqlash
          </button>
        </div>
        <div>
          <p className="eyebrow">Format versiyalari</p>
          <ul className="mt-2 divide-y divide-hair border-y border-hair">
            {formats.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {f.label} {f.id === s.activeFormatId && <span className="chip chip-ok ml-1">faol</span>} {f.status === "archived" && <span className="chip chip-ink ml-1">arxiv</span>}
                  </p>
                  <p className="num text-xs text-muted">
                    {f.id} · {f.totalTasks} topshiriq · {f.totalMinutes} daq. · {f.materialsUsing} material · yangilangan {fmtDateTime(f.updatedAt)}
                  </p>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => onEdit(f)}>
                  Tahrirlash
                </button>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => onDup(f)}>
                  Nusxa → yangi versiya
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

const TYPES: TaskType[] = ["Y1", "Y2", "O1", "O", "O2"];

function FormatEditor({ f, onClose, onSaved }: { f: Fmt; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState<ExamFormat>(() => structuredClone(f));
  const [topics, setTopics] = useState(f.topics.join("\n"));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const next: ExamFormat = { ...v, topics: topics.split("\n").map((t) => t.trim()).filter(Boolean) };
  const problems = validateFormat(next);
  const upd = (p: Partial<ExamFormat>) => setV((o) => ({ ...o, ...p }));

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Formatni tahrirlash · ${f.id}`}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Bekor qilish
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || problems.length > 0}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                const { id: _id, subjectCode: _sc, subjectName: _sn, raschParameterSetId: _r, autoAdvanceSections: _a, createdAt: _c, updatedAt: _u, ...rest } = next;
                void [_id, _sc, _sn, _r, _a, _c, _u];
                await adminApi(`/api/admin/formats/${f.id}`, { method: "PATCH", body: rest });
                onSaved();
              } catch (e) {
                setErr(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Saqlash
          </button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        {f.materialsUsing > 0 && <Alert tone="info">Bu formatdan {f.materialsUsing} ta material foydalanadi. Ular o‘z nusxasini saqlagan — o‘zgarish faqat yangi materiallarga ta’sir qiladi.</Alert>}
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="sm:col-span-2">
            <span className="label">Nomi</span>
            <input className="field" value={v.label} onChange={(e) => upd({ label: e.target.value })} />
          </label>
          <label>
            <span className="label">Versiya</span>
            <input className="field num" value={v.version} onChange={(e) => upd({ version: e.target.value })} />
          </label>
          <label>
            <span className="label">Kuchga kirgan sana</span>
            <input type="date" className="field num" value={v.effectiveDate} onChange={(e) => upd({ effectiveDate: e.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className="label">Rasmiy manba URL</span>
            <input className="field" value={v.sourceUrl} onChange={(e) => upd({ sourceUrl: e.target.value })} />
          </label>
          <label className="sm:col-span-3">
            <span className="label">Manba nomi</span>
            <input className="field" value={v.sourceTitle} onChange={(e) => upd({ sourceTitle: e.target.value })} />
          </label>
          <label>
            <span className="label">Topshiriqlar soni</span>
            <input type="number" className="field num" value={v.totalTasks} onChange={(e) => upd({ totalTasks: Number(e.target.value) || 0 })} />
          </label>
          <label>
            <span className="label">Umumiy vaqt (daq.)</span>
            <input type="number" className="field num" value={v.totalMinutes} onChange={(e) => upd({ totalMinutes: Number(e.target.value) || 0 })} />
          </label>
          <label>
            <span className="label">Y1 variantlari</span>
            <input type="number" min={2} max={10} className="field num" value={v.y1OptionCount} onChange={(e) => upd({ y1OptionCount: Number(e.target.value) || 4 })} />
          </label>
        </div>

        <fieldset>
          <legend className="label">Bosqichlar (vaqt)</legend>
          {v.sections.map((s, i) => (
            <div key={i} className="mb-1 grid grid-cols-[6rem_1fr_4rem_4rem_5rem_auto] items-center gap-1.5">
              <input aria-label="ID" className="field num !min-h-8 !py-1 text-xs" value={s.id} onChange={(e) => upd({ sections: v.sections.map((x, j) => (j === i ? { ...x, id: e.target.value } : x)) })} />
              <input aria-label="Nomi" className="field !min-h-8 !py-1" value={s.title} onChange={(e) => upd({ sections: v.sections.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
              <input aria-label="Dan" type="number" className="field num !min-h-8 !py-1" value={s.from} onChange={(e) => upd({ sections: v.sections.map((x, j) => (j === i ? { ...x, from: Number(e.target.value) } : x)) })} />
              <input aria-label="Gacha" type="number" className="field num !min-h-8 !py-1" value={s.to} onChange={(e) => upd({ sections: v.sections.map((x, j) => (j === i ? { ...x, to: Number(e.target.value) } : x)) })} />
              <input aria-label="Daqiqa" type="number" className="field num !min-h-8 !py-1" value={s.minutes} onChange={(e) => upd({ sections: v.sections.map((x, j) => (j === i ? { ...x, minutes: Number(e.target.value) } : x)) })} />
              <button type="button" className="btn btn-ghost btn-sm !min-h-0 !px-2" aria-label="O‘chirish" onClick={() => upd({ sections: v.sections.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm mt-1" onClick={() => upd({ sections: [...v.sections, { id: `b${v.sections.length + 1}`, title: "Yangi bosqich", from: 1, to: 1, minutes: 10 }] })}>
            ＋ Bosqich
          </button>
        </fieldset>

        <fieldset>
          <legend className="label">Topshiriq turlari</legend>
          {v.taskGroups.map((g, i) => (
            <div key={i} className="mb-1 grid grid-cols-[6rem_5rem_5rem_auto] items-center gap-1.5">
              <select aria-label="Tur" className="field num !min-h-8 !py-1" value={g.type} onChange={(e) => upd({ taskGroups: v.taskGroups.map((x, j) => (j === i ? { ...x, type: e.target.value as TaskType } : x)) })}>
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <input aria-label="Dan" type="number" className="field num !min-h-8 !py-1" value={g.from} onChange={(e) => upd({ taskGroups: v.taskGroups.map((x, j) => (j === i ? { ...x, from: Number(e.target.value) } : x)) })} />
              <input aria-label="Gacha" type="number" className="field num !min-h-8 !py-1" value={g.to} onChange={(e) => upd({ taskGroups: v.taskGroups.map((x, j) => (j === i ? { ...x, to: Number(e.target.value) } : x)) })} />
              <button type="button" className="btn btn-ghost btn-sm !min-h-0 justify-self-start !px-2" aria-label="O‘chirish" onClick={() => upd({ taskGroups: v.taskGroups.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm mt-1" onClick={() => upd({ taskGroups: [...v.taskGroups, { type: "Y1", from: 1, to: 1 }] })}>
            ＋ Guruh
          </button>
        </fieldset>

        <fieldset>
          <legend className="label">O2 maksimal ballari</legend>
          {v.o2Tasks.map((t, i) => (
            <div key={i} className="mb-1 grid grid-cols-[5rem_5rem_auto] items-center gap-1.5">
              <input aria-label="Topshiriq raqami" type="number" className="field num !min-h-8 !py-1" value={t.number} onChange={(e) => upd({ o2Tasks: v.o2Tasks.map((x, j) => (j === i ? { ...x, number: Number(e.target.value) } : x)) })} />
              <input aria-label="Maksimal ball" type="number" className="field num !min-h-8 !py-1" value={t.maxScore} onChange={(e) => upd({ o2Tasks: v.o2Tasks.map((x, j) => (j === i ? { ...x, maxScore: Number(e.target.value) } : x)) })} />
              <button type="button" className="btn btn-ghost btn-sm !min-h-0 justify-self-start !px-2" aria-label="O‘chirish" onClick={() => upd({ o2Tasks: v.o2Tasks.filter((_, j) => j !== i) })}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-sm mt-1" onClick={() => upd({ o2Tasks: [...v.o2Tasks, { number: v.totalTasks, maxScore: 10 }] })}>
            ＋ O2 topshiriq
          </button>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="label">Y2 baholash qoidasi</span>
            <select className="field" value={v.y2Scoring} onChange={(e) => upd({ y2Scoring: e.target.value as ExamFormat["y2Scoring"] })}>
              <option value="per_pair">Har bir juftlik alohida</option>
              <option value="all_or_nothing">Faqat hammasi to‘g‘ri bo‘lsa</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pt-5 text-sm">
            <input type="checkbox" className="accent-[var(--color-accent)]" checked={v.y2ScoringConfirmed} onChange={(e) => upd({ y2ScoringConfirmed: e.target.checked })} />
            Qoida rasmiy manba bilan tasdiqlangan
          </label>
          <label>
            <span className="label">Holat</span>
            <select className="field" value={v.status} onChange={(e) => upd({ status: e.target.value as ExamFormat["status"] })}>
              <option value="active">Faol</option>
              <option value="archived">Arxiv</option>
            </select>
          </label>
        </div>
        <label className="block">
          <span className="label">Mavzular / bo‘limlar (har biri yangi qatorda)</span>
          <textarea className="field min-h-28" value={topics} onChange={(e) => setTopics(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Baholash izohi (natija sahifasida ko‘rinadi)</span>
          <textarea className="field min-h-20" maxLength={1000} value={v.assessmentNote} onChange={(e) => upd({ assessmentNote: e.target.value })} />
        </label>
        {problems.length > 0 && (
          <Alert tone="warn" title="Format ichki ziddiyatlarga ega">
            <ul className="list-disc pl-4">
              {problems.slice(0, 8).map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </Alert>
        )}
        {err && <Alert tone="error">{err}</Alert>}
      </div>
    </Modal>
  );
}

function DuplicateModal({ f, onClose, onSaved }: { f: Fmt; onClose: () => void; onSaved: (id: string) => void }) {
  const [version, setVersion] = useState(String(new Date().getFullYear()));
  const [newId, setNewId] = useState(`${f.subjectCode}-${new Date().getFullYear()}`);
  const [label, setLabel] = useState(`${f.subjectName} · ${new Date().getFullYear()} spetsifikatsiyasi`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title="Yangi format versiyasi"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Bekor qilish
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await adminApi("/api/admin/formats", { method: "POST", body: { fromId: f.id, newId, version, label } });
                onSaved(newId);
              } catch (e) {
                setErr(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Yaratish
          </button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p className="text-ink-2">
          <b>{f.label}</b> nusxalanadi. Yangi versiyani tahrirlab, fan uchun faol qilib belgilang.
        </p>
        <label className="block">
          <span className="label">Yangi ID</span>
          <input className="field num" value={newId} onChange={(e) => setNewId(e.target.value.toLowerCase())} />
        </label>
        <label className="block">
          <span className="label">Versiya</span>
          <input className="field num" value={version} onChange={(e) => setVersion(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Nomi</span>
          <input className="field" value={label} onChange={(e) => setLabel(e.target.value)} />
        </label>
        {err && <Alert tone="error">{err}</Alert>}
      </div>
    </Modal>
  );
}

function NewSubjectModal({ formats, onClose, onSaved }: { formats: Fmt[]; onClose: () => void; onSaved: () => void }) {
  const [v, setV] = useState({ code: "", name: "", description: "", order: 50, templateFormatId: formats[0]?.id ?? "", version: String(new Date().getFullYear()) });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <Modal
      open
      onClose={onClose}
      title="Yangi fan qo‘shish"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Bekor qilish
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || !v.code || !v.name}
            onClick={async () => {
              setBusy(true);
              setErr(null);
              try {
                await adminApi("/api/admin/subjects", { method: "POST", body: v });
                onSaved();
              } catch (e) {
                setErr(errorText(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy && <Spinner />} Qo‘shish
          </button>
        </>
      }
    >
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <label>
          <span className="label">Kod (URL uchun)</span>
          <input className="field num" placeholder="masalan: tarix" value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} />
        </label>
        <label>
          <span className="label">Nomi</span>
          <input className="field" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        </label>
        <label className="sm:col-span-2">
          <span className="label">Tavsif</span>
          <input className="field" value={v.description} onChange={(e) => setV({ ...v, description: e.target.value })} />
        </label>
        <label>
          <span className="label">Shablon format</span>
          <select className="field" value={v.templateFormatId} onChange={(e) => setV({ ...v, templateFormatId: e.target.value })}>
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="label">Versiya</span>
          <input className="field num" value={v.version} onChange={(e) => setV({ ...v, version: e.target.value })} />
        </label>
        <p className="text-xs text-muted sm:col-span-2">Shablon tuzilishi nusxalanadi — keyin rasmiy spetsifikatsiya asosida tahrirlang (topshiriqlar, vaqt, mavzular).</p>
        {err && (
          <div className="sm:col-span-2">
            <Alert tone="error">{err}</Alert>
          </div>
        )}
      </div>
    </Modal>
  );
}
