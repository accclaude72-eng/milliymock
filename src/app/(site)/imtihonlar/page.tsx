"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { MaterialCard } from "@/components/material-card";
import { Alert, EmptyState } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { cx } from "@/lib/format-utils";
import type { PublicMaterial } from "@/lib/types";

export default function ExamsPage() {
  const [items, setItems] = useState<PublicMaterial[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [subject, setSubject] = useState<string>("all");
  const [mode, setMode] = useState<"all" | "full" | "practice" | "diagnostic">("all");

  useEffect(() => {
    api<PublicMaterial[]>("/api/materials", { auth: false })
      .then(setItems)
      .catch((e) => setErr(errorText(e)));
  }, []);

  const subjects = useMemo(() => {
    const m = new Map<string, string>();
    for (const x of items ?? []) m.set(x.subjectCode, x.subjectName);
    return Array.from(m.entries());
  }, [items]);

  const shown = (items ?? []).filter((m) => (subject === "all" || m.subjectCode === subject) && (mode === "all" || m.mode === mode));

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <p className="eyebrow">Katalog</p>
      <h1 className="display mt-2 text-5xl sm:text-6xl">Mock imtihonlar</h1>
      <p className="mt-3 max-w-2xl text-ink-2">Administrator tomonidan tayyorlangan va e’lon qilingan variantlar. Har biri fanning rasmiy format versiyasiga bog‘langan.</p>

      <div className="mt-8 flex flex-wrap items-center gap-2 border-y-[1.5px] border-ink py-3" role="toolbar" aria-label="Filtrlar">
        <span className="eyebrow mr-1">Fan</span>
        {[["all", "Barchasi"] as [string, string], ...subjects].map(([c, n]) => (
          <button key={c} type="button" aria-pressed={subject === c} onClick={() => setSubject(c)} className={cx("btn btn-sm", subject === c ? "btn-ink" : "btn-ghost")}>
            {n}
          </button>
        ))}
        <span className="eyebrow ml-auto mr-1 hidden sm:inline">Tur</span>
        {(
          [
            ["all", "Hammasi"],
            ["full", "To‘liq mock"],
            ["practice", "Mashq"],
            ["diagnostic", "Diagnostika"],
          ] as const
        ).map(([c, n]) => (
          <button key={c} type="button" aria-pressed={mode === c} onClick={() => setMode(c)} className={cx("btn btn-sm", mode === c ? "btn-ink" : "btn-ghost")}>
            {n}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {err ? (
          <Alert tone="error" title="Ro‘yxatni yuklab bo‘lmadi">
            {err}
          </Alert>
        ) : !items ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-56" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState title={items.length === 0 ? "Hozircha e’lon qilingan imtihon yo‘q" : "Bu filtr bo‘yicha imtihon topilmadi"}>
            {items.length === 0 ? (
              <>
                Administrator yangi variantlarni yuklagach, ular shu yerda paydo bo‘ladi. Hozircha{" "}
                <Link href="/fanlar" className="link">
                  fanlar formatlari
                </Link>{" "}
                bilan tanishing.
              </>
            ) : (
              "Boshqa fan yoki turni tanlang."
            )}
          </EmptyState>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((m, i) => (
              <MaterialCard key={m.id} m={m} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
