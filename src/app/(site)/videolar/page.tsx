"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { CabinetNav } from "@/components/cabinet-nav";
import { RequireCandidate } from "@/components/guards";
import { useSubjects } from "@/components/landing/subjects-grid";
import { Alert, EmptyState, PageLoader, ProgressBar } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { cx } from "@/lib/format-utils";
import { embedUrl } from "@/lib/sm2";

interface Video {
  id: string;
  subjectCode: string;
  topic: string | null;
  title: string;
  description: string | null;
  provider: "youtube" | "vimeo";
  ref: string;
  durationSec: number | null;
  completed: boolean;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Videos />}</RequireCandidate>
    </Suspense>
  );
}

function Videos() {
  const { subjects } = useSubjects();
  const [list, setList] = useState<Video[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [subject, setSubject] = useState("all");
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    api<{ videos: Video[] }>("/api/videos")
      .then((d) => setList(d.videos))
      .catch((e) => setErr(errorText(e)));
  }, []);

  const toggle = async (v: Video) => {
    setList((l) => l?.map((x) => (x.id === v.id ? { ...x, completed: !v.completed } : x)) ?? l);
    try {
      await api(`/api/videos/${v.id}`, { method: "POST", body: { completed: !v.completed } });
    } catch (e) {
      setErr(errorText(e));
      setList((l) => l?.map((x) => (x.id === v.id ? { ...x, completed: v.completed } : x)) ?? l);
    }
  };

  const subjectName = (c: string) => subjects?.find((s) => s.code === c)?.name ?? c;
  const present = useMemo(() => [...new Set((list ?? []).map((v) => v.subjectCode))], [list]);
  const shown = (list ?? []).filter((v) => subject === "all" || v.subjectCode === subject);
  // Group by topic, keeping the admin's order.
  const groups = shown.reduce<{ topic: string; items: Video[] }[]>((acc, v) => {
    const t = v.topic || "Boshqa mavzular";
    const g = acc.find((x) => x.topic === t);
    if (g) g.items.push(v);
    else acc.push({ topic: t, items: [v] });
    return acc;
  }, []);
  const done = shown.filter((v) => v.completed).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <CabinetNav />
      <p className="eyebrow">Mavzular bo‘yicha</p>
      <h1 className="display mt-1 text-4xl sm:text-5xl">Video darslar</h1>
      {err && (
        <Alert tone="error" className="mt-6">
          {err}
        </Alert>
      )}
      {!list && !err && <PageLoader />}
      {list && list.length === 0 && (
        <div className="mt-6">
          <EmptyState title="Hali video darslar yo‘q">Administrator darslarni qo‘shgach, ular shu yerda chiqadi.</EmptyState>
        </div>
      )}
      {list && list.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            {["all", ...present].map((c) => (
              <button key={c} type="button" onClick={() => setSubject(c)} className={cx("chip !text-sm", subject === c ? "chip-ink" : "")}>
                {c === "all" ? "Barchasi" : subjectName(c)}
              </button>
            ))}
            <span className="ml-auto w-full max-w-xs text-sm sm:w-64">
              <span className="num mb-1 block text-xs text-muted">
                {done}/{shown.length} ko‘rildi
              </span>
              <ProgressBar value={done} max={Math.max(1, shown.length)} label={`${done}/${shown.length} ko‘rildi`} tone="ok" />
            </span>
          </div>
          {groups.map((g) => (
            <section key={g.topic} className="mt-8">
              <h2 className="display text-2xl">{g.topic}</h2>
              <ul className="mt-3 grid gap-4 md:grid-cols-2">
                {g.items.map((v) => (
                  <li key={v.id} className="sheet-hard overflow-hidden">
                    {open === v.id ? (
                      <div className="relative aspect-video bg-ink">
                        <iframe
                          src={embedUrl(v.provider, v.ref)}
                          title={v.title}
                          className="absolute inset-0 h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <button type="button" onClick={() => setOpen(v.id)} className="group relative block aspect-video w-full bg-ink" aria-label={`${v.title} — ko‘rish`}>
                        {v.provider === "youtube" && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`https://i.ytimg.com/vi/${v.ref}/hqdefault.jpg`}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover opacity-80 transition-opacity group-hover:opacity-100"
                            loading="lazy"
                          />
                        )}
                        <span className="absolute inset-0 grid place-items-center">
                          <span className="grid h-14 w-14 place-items-center rounded-full bg-accent text-2xl text-white shadow-lg">▶</span>
                        </span>
                      </button>
                    )}
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-semibold">{v.title}</h3>
                        {v.durationSec && <span className="num shrink-0 text-xs text-muted">{Math.round(v.durationSec / 60)} daq</span>}
                      </div>
                      <p className="text-xs text-muted">{subjectName(v.subjectCode)}</p>
                      {v.description && <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{v.description}</p>}
                      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" checked={v.completed} onChange={() => toggle(v)} className="h-4 w-4 accent-[var(--color-ok)]" />
                        Ko‘rdim
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
