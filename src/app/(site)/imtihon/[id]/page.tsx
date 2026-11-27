"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { RequireCandidate } from "@/components/guards";
import { type PaymentInfo, PaymentPanel } from "@/components/payment-panel";
import { Alert, PageLoader, Spinner } from "@/components/ui";
import { api, errorText } from "@/lib/api";
import { TASK_TYPE_LABEL } from "@/lib/formats";
import { MODE_LABEL, type PublicMaterial } from "@/lib/types";

interface Info {
  material: PublicMaterial;
  ready: boolean;
  candidateId: string;
  candidateName: string;
  inProgressAttemptId: string | null;
  finishedAttempts: number;
  payment: PaymentInfo | null;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <RequireCandidate>{() => <Instructions />}</RequireCandidate>
    </Suspense>
  );
}

function Instructions() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startErr, setStartErr] = useState<string | null>(null);

  useEffect(() => {
    api<Info>(`/api/materials/${encodeURIComponent(id)}`)
      .then(setInfo)
      .catch((e) => setErr(errorText(e)));
  }, [id]);

  if (err)
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert tone="error" title="Imtihon ochilmadi">
          {err} <Link href="/imtihonlar">Katalogga qaytish</Link>
        </Alert>
      </div>
    );
  if (!info) return <PageLoader />;
  const { material: m } = info;
  const f = m.format;
  const limitReached = m.attemptLimit != null && info.finishedAttempts >= m.attemptLimit && !info.inProgressAttemptId;
  const mustPay = !!info.payment && info.payment.status !== "approved" && !info.inProgressAttemptId;

  const start = async () => {
    setStarting(true);
    setStartErr(null);
    try {
      const r = await api<{ attemptId: string }>(`/api/materials/${encodeURIComponent(id)}/start`, { method: "POST" });
      router.push(`/urinish/${r.attemptId}`);
    } catch (e) {
      setStartErr(errorText(e));
      setStarting(false);
    }
  };

  const rules = [
    m.timed
      ? f.sections.length > 1
        ? `Imtihon ${f.sections.length} bosqichdan iborat. Har bir bosqich vaqti alohida hisoblanadi va tugagach keyingi bosqich avtomatik boshlanadi.`
        : `Imtihon uchun ${f.totalMinutes} daqiqa ajratilgan. Vaqt tugaganda javoblar avtomatik topshiriladi.`
      : "Bu mashq vaqt bilan cheklanmagan. Tayyor bo‘lganingizda “Yakunlash” tugmasini bosing.",
    "Vaqt server soati bo‘yicha hisoblanadi: sahifani yangilash yoki brauzerni yopish taymerni to‘xtatmaydi.",
    "Javoblar har o‘zgarishda avtomatik saqlanadi. Internet uzilsa, ular brauzerda navbatga yoziladi va aloqa tiklanganda yuboriladi.",
    "Bosqich yopilgach, undagi javoblarni o‘zgartirib bo‘lmaydi.",
    "Imtihonni bir vaqtda faqat bitta oynada oching — aks holda tizim ogohlantiradi.",
    "To‘g‘ri javoblar imtihon yakunlanmaguncha hech qachon ko‘rsatilmaydi.",
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <nav aria-label="Yo‘l" className="font-mono text-xs text-muted">
        <Link href="/imtihonlar" className="hover:text-ink">
          Imtihonlar
        </Link>{" "}
        /{" "}
        <Link href={`/fanlar/${m.subjectCode}`} className="hover:text-ink">
          {m.subjectName}
        </Link>
      </nav>
      <div className="crop sheet-hard mt-4 overflow-hidden">
        <div className="border-b-[1.5px] border-ink bg-ink px-6 py-5 text-paper sm:px-8">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-paper/60">Imtihon oldidan yo‘riqnoma · {MODE_LABEL[m.mode]}</p>
          <h1 className="display mt-2 text-4xl sm:text-5xl">{m.title}</h1>
        </div>

        <dl className="grid grid-cols-2 border-b-[1.5px] border-ink sm:grid-cols-4">
          {[
            ["Fan", m.subjectName],
            ["Format", `${f.label}`],
            ["Topshiriqlar", `${f.totalTasks} ta`],
            ["Vaqt", m.timed ? `${f.totalMinutes} daqiqa` : "cheklanmagan"],
          ].map(([k, v], i) => (
            <div key={k} className={`p-4 sm:p-5 ${i % 2 === 0 ? "border-r border-hair" : ""} ${i < 2 ? "border-b border-hair sm:border-b-0" : ""} sm:border-r sm:last:border-r-0`}>
              <dt className="eyebrow">{k}</dt>
              <dd className="mt-1 font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="display text-2xl">Tuzilish</h2>
            <table className="table mt-3">
              <thead>
                <tr>
                  <th>Bosqich</th>
                  <th>Topshiriqlar</th>
                  <th className="text-right">Vaqt</th>
                </tr>
              </thead>
              <tbody>
                {f.sections.map((s) => (
                  <tr key={s.id}>
                    <td>{s.title}</td>
                    <td className="num">
                      {s.from}–{s.to}
                    </td>
                    <td className="num text-right">{m.timed ? `${s.minutes} daq.` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="mt-5 space-y-1.5 text-sm">
              {f.taskGroups.map((g) => (
                <li key={g.type + g.from} className="flex gap-3">
                  <span className="num w-8 font-semibold text-accent">{g.type}</span>
                  <span className="flex-1">{TASK_TYPE_LABEL[g.type]}</span>
                  <span className="num text-muted">
                    {g.from}–{g.to}
                  </span>
                </li>
              ))}
            </ul>
            {f.o2Tasks.length > 0 && (
              <p className="mt-4 text-sm text-ink-2">
                Yozma ishlar (O2) ekspert tomonidan rubrika asosida baholanadi. Yechimni matn sifatida yozishingiz yoki qo‘lda yozilgan varaqni JPG, PNG yoki PDF
                (har biri 10 MB gacha) shaklida yuklashingiz mumkin.
              </p>
            )}
            {m.description && <p className="mt-4 border-l-[3px] border-accent pl-3 text-sm text-ink-2">{m.description}</p>}
          </div>

          <div>
            <div className="sheet p-4">
              <p className="eyebrow">Nomzod</p>
              <p className="mt-1 font-semibold">{info.candidateName}</p>
              <p className="eyebrow mt-3">Candidate ID</p>
              <p className="num mt-1 text-2xl font-semibold tracking-[0.12em]">{info.candidateId}</p>
            </div>
            <h2 className="display mt-6 text-2xl">Qoidalar</h2>
            <ol className="mt-3 space-y-2 text-sm text-ink-2">
              {rules.map((r, i) => (
                <li key={i} className="flex gap-3">
                  <span className="num text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
                  <span>{r}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="border-t-[1.5px] border-ink bg-paper px-6 py-5 sm:px-8">
          {!info.ready && <Alert tone="warn">Bu variant hozircha to‘liq tayyor emas. Birozdan so‘ng qayta urinib ko‘ring.</Alert>}
          {limitReached && <Alert tone="warn">Bu variant uchun urinishlar chegarasi ({m.attemptLimit}) tugagan.</Alert>}
          {startErr && (
            <Alert tone="error" className="mb-4">
              {startErr}
            </Alert>
          )}
          {info.inProgressAttemptId ? (
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm">Bu variant bo‘yicha tugallanmagan urinishingiz bor. Vaqt hisoblanishda davom etmoqda.</p>
              <Link href={`/urinish/${info.inProgressAttemptId}`} className="btn btn-primary">
                Imtihonni davom ettirish →
              </Link>
            </div>
          ) : mustPay && info.ready && !limitReached ? (
            <PaymentPanel materialId={m.id} info={info.payment!} candidateId={info.candidateId} onChange={(payment) => setInfo({ ...info, payment })} />
          ) : (
            info.ready &&
            !limitReached && (
              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="flex max-w-xl items-start gap-3 text-sm">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[var(--color-accent)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
                  Yo‘riqnoma bilan tanishdim. “Imtihonni boshlash” tugmasini bosganimdan so‘ng vaqt hisoblanishi boshlanishini tushunaman.
                </label>
                <button type="button" className="btn btn-primary !min-h-12 !px-6" disabled={!agree || starting} onClick={start}>
                  {starting && <Spinner />} Imtihonni boshlash
                </button>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
