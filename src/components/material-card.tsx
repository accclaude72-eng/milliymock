import Link from "next/link";
import { fmtDate } from "@/lib/format-utils";
import { MODE_LABEL, type PublicMaterial } from "@/lib/types";

export function MaterialCard({ m, index }: { m: PublicMaterial; index?: number }) {
  const types = Array.from(new Set(m.format.taskGroups.map((g) => g.type)));
  return (
    <Link
      href={`/imtihon/${m.id}`}
      className="group sheet flex flex-col p-5 transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-hard animate-rise"
      style={index !== undefined ? { animationDelay: `${index * 50}ms` } : undefined}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className={`chip ${m.mode === "full" ? "chip-accent" : "chip-info"}`}>{MODE_LABEL[m.mode]}</span>
        <span className="chip chip-ink">{m.subjectName}</span>
        {!m.timed && <span className="chip chip-ink">Vaqtsiz</span>}
      </div>
      <h3 className="display mt-4 text-2xl leading-tight group-hover:italic">{m.title}</h3>
      {m.description && <p className="mt-2 line-clamp-2 text-sm text-ink-2">{m.description}</p>}
      <div className="mt-auto pt-5">
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-hair pt-3 font-mono text-xs text-ink-2">
          <span>{m.format.totalTasks} topshiriq</span>
          <span>{m.timed ? `${m.format.totalMinutes} daqiqa` : "vaqt cheklanmagan"}</span>
          <span>{types.join(" · ")}</span>
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[0.68rem] text-muted">
          <span>{m.format.label}</span>
          <span>{fmtDate(m.publishedAt)}</span>
        </div>
      </div>
    </Link>
  );
}
