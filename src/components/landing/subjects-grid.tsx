"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SubjectArt } from "../art/subject-art";
import { DEFAULT_FORMATS, DEFAULT_SUBJECTS, type ExamFormat, type TaskType } from "@/lib/formats";
import type { SubjectWithFormat } from "@/lib/types";

const TYPE_STYLE: Record<TaskType, string> = {
  Y1: "bg-ink",
  Y2: "bg-ink-2/60",
  O1: "bg-accent",
  O: "bg-accent",
  O2: "bg-[repeating-linear-gradient(135deg,var(--color-accent)_0_3px,transparent_3px_6px)] border-l border-accent",
};

export function TaskBar({ format }: { format: ExamFormat }) {
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-[2px] border border-ink bg-card" aria-hidden>
        {format.taskGroups.map((g) => (
          <span key={g.type + g.from} className={TYPE_STYLE[g.type]} style={{ width: `${((g.to - g.from + 1) / format.totalTasks) * 100}%` }} />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[0.68rem] text-ink-2">
        {format.taskGroups.map((g) => (
          <li key={g.type + g.from}>
            <span className="font-semibold">{g.type}</span> {g.from}–{g.to}
          </li>
        ))}
      </ul>
    </div>
  );
}

function fallback(): SubjectWithFormat[] {
  return DEFAULT_SUBJECTS.map((s) => ({ ...s, format: DEFAULT_FORMATS.find((f) => f.id === s.activeFormatId) ?? null, publishedMaterials: 0 }));
}

export function useSubjects() {
  const [data, setData] = useState<SubjectWithFormat[] | null>(null);
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    let alive = true;
    api<SubjectWithFormat[]>("/api/subjects", { auth: false })
      .then((d) => alive && setData(d))
      .catch(() => {
        if (!alive) return;
        setOffline(true);
        setData(fallback());
      });
    return () => {
      alive = false;
    };
  }, []);
  return { subjects: data, offline };
}

export function SubjectsGrid({ showCounts = true }: { showCounts?: boolean }) {
  const { subjects, offline } = useSubjects();
  if (!subjects)
    return (
      <div className="grid gap-5 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-64" />
        ))}
      </div>
    );
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {subjects.map((s, i) => (
        <Link
          key={s.code}
          href={`/fanlar/${s.code}`}
          className="group sheet relative flex flex-col p-6 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard animate-rise"
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow">
                {String(i + 1).padStart(2, "0")} · {s.format ? `Spetsifikatsiya ${s.format.version}` : "Format kiritilmagan"}
              </p>
              <h3 className="display mt-2 break-words text-3xl group-hover:italic sm:text-4xl">{s.name}</h3>
              <span aria-hidden className="mt-3 inline-grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-ink text-lg transition-all group-hover:translate-x-1 group-hover:bg-ink group-hover:text-paper">
                →
              </span>
            </div>
            <div aria-hidden className="w-24 shrink-0 overflow-hidden rounded-[2px] border border-hair bg-paper transition-transform duration-500 group-hover:-rotate-2 group-hover:scale-105 sm:w-40">
              <SubjectArt code={s.code} className="block h-auto w-full" />
            </div>
          </div>
          <p className="mt-3 text-sm text-ink-2">{s.description}</p>
          {s.format && (
            <>
              <div className="mt-5 grid grid-cols-3 border-y border-hair py-3 text-center">
                <div>
                  <p className="num text-2xl font-semibold">{s.format.totalTasks}</p>
                  <p className="eyebrow !text-[0.6rem]">topshiriq</p>
                </div>
                <div className="border-x border-hair">
                  <p className="num text-2xl font-semibold">{s.format.totalMinutes}</p>
                  <p className="eyebrow !text-[0.6rem]">daqiqa</p>
                </div>
                <div>
                  <p className="num text-2xl font-semibold">{s.format.sections.length > 1 ? s.format.sections.map((x) => x.minutes).join("+") : "1"}</p>
                  <p className="eyebrow !text-[0.6rem]">{s.format.sections.length > 1 ? "bosqichlar" : "bosqich"}</p>
                </div>
              </div>
              <div className="mt-4">
                <TaskBar format={s.format} />
              </div>
            </>
          )}
          {showCounts && !offline && (
            <p className="mt-4 font-mono text-xs text-muted">
              {s.publishedMaterials > 0 ? `${s.publishedMaterials} ta mock variant mavjud` : "Mock variantlar tez orada qo‘shiladi"}
            </p>
          )}
        </Link>
      ))}
    </div>
  );
}
