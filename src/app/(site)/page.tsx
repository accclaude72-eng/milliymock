import Link from "next/link";
import { SheetPreview } from "@/components/landing/sheet-preview";
import { SubjectsGrid } from "@/components/landing/subjects-grid";
import { TaskTypes } from "@/components/landing/task-types";
import { FloatingGlyphs } from "@/components/art/floating-glyphs";
import { SubjectArt } from "@/components/art/subject-art";
import { CountUp, Reveal } from "@/components/reveal";
import { SectionHead } from "@/components/ui";
import { DEFAULT_GRADE_BOUNDARIES } from "@/lib/formats";

const STEPS = [
  ["Ro‘yxatdan o‘ting", "Email orqali hisob oching. Tizim sizga noyob Candidate ID beradi — u har bir javoblar varaqasida ko‘rinadi."],
  ["Fan va variantni tanlang", "To‘liq mock, mavzu bo‘yicha mashq yoki qisqa diagnostika. Har bir variant fanning rasmiy format versiyasiga bog‘langan."],
  ["Kitobcha + javoblar varaqasi", "Chapda test kitobchasi, o‘ngda raqamli javoblar varaqasi. Vaqt serverda hisoblanadi, javoblar avtomatik saqlanadi."],
  ["Tekshiruv", "Y1, Y2, O1 darhol avtomatik tekshiriladi. Shubhali qisqa javoblar va O2 yozma ishlar ekspertga yuboriladi."],
  ["Tahlil", "Mavzular, topshiriq turlari va vaqt bo‘yicha natija. Zaif mavzularni qayta mashq qiling, oldingi urinishlar bilan solishtiring."],
];

const FAQ: [string, React.ReactNode][] = [
  [
    "Platforma rasmiy sertifikat beradimi?",
    "Yo‘q. Milliy Mock — mustaqil tayyorgarlik platformasi. U davlat sertifikatini bermaydi va Bilim va malakalarni baholash agentligi nomidan ish yuritmaydi. Rasmiy imtihonga ro‘yxatdan o‘tish faqat agentlikning rasmiy kanallari orqali amalga oshiriladi.",
  ],
  [
    "Nega natijam “Rasch balli” yoki “A+ daraja” sifatida ko‘rsatilmaydi?",
    "Rasmiy spetsifikatsiyaga ko‘ra Y1, Y2 va O1 topshiriqlari Rasch modeli bilan baholanadi. Bu model har bir topshiriqning kalibrlangan qiyinlik parametrlariga tayanadi. Bunday parametrlar mavjud bo‘lmaguncha biz faqat xom natijani (to‘g‘ri, noto‘g‘ri, javobsiz, foiz) ko‘rsatamiz. Oddiy foizni rasmiy ball deb atash noto‘g‘ri bo‘lardi.",
  ],
  [
    "Internet uzilib qolsa nima bo‘ladi?",
    "Javoblaringiz brauzerda navbatga yoziladi va aloqa tiklanishi bilan serverga yuboriladi. Vaqt server soati bo‘yicha hisoblanadi, shuning uchun sahifani yangilash yoki kompyuterni qayta yoqish taymerni to‘xtatmaydi va qayta boshlamaydi.",
  ],
  [
    "O2 yozma ishlari qanday baholanadi?",
    "Ekspert rubrika asosida yechim usuli (M) va hisob-kitob (A) ni alohida baholaydi, izoh qoldiradi. Matn muharririda yozishingiz yoki qo‘lda yozilgan yechimni JPG, PNG yoki PDF sifatida yuklashingiz mumkin. Ekspert tasdiqlamaguncha natija “yakuniy” deb belgilanmaydi.",
  ],
  [
    "Format o‘zgarsa, eski natijalarim nima bo‘ladi?",
    "Har bir urinish o‘sha paytdagi format versiyasining nusxasini saqlaydi. Administrator yangi spetsifikatsiyani kiritganda oldingi natijalaringiz o‘zgarmaydi.",
  ],
  ["Telefonda topshirsa bo‘ladimi?", "Ha. Imtihon oynasi telefon va planshetga moslashtirilgan: savollar navigatori pastki panelda ochiladi, moslashtirish topshiriqlari ochiladigan ro‘yxat orqali bajariladi."],
];

export default function Home() {
  return (
    <>
      {/* ------------------------------------------------------------ HERO */}
      <section className="relative overflow-hidden border-b-[1.5px] border-ink">
        <div className="graph-paper pointer-events-none absolute inset-0 opacity-60 [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" aria-hidden />
        <FloatingGlyphs />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[1.08fr_1fr] lg:gap-14 lg:pb-24 lg:pt-20">
          <div className="animate-rise">
            <p className="eyebrow flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-accent">
                <span className="h-2 w-2 rounded-full bg-accent" /> Mustaqil mock-imtihon platformasi
              </span>
              <span>Biologiya · Kimyo · Matematika · Fizika</span>
            </p>
            <h1 className="display mt-6 text-[2.9rem] sm:text-6xl xl:text-[5.1rem]">
              Milliy sertifikatga <em className="text-accent">haqiqiy</em> imtihon formatida tayyorlaning
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
              Rasmiy spetsifikatsiyaga mos topshiriqlar tuzilishi, server vaqti bilan ishlaydigan taymer, avtomatik tekshiruv va yozma ishlarni ekspert
              baholashi — bitta jiddiy platformada.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/imtihonlar" className="btn btn-primary !min-h-12 !px-6 !text-base">
                Mock imtihonni boshlash →
              </Link>
              <Link href="/fanlar" className="btn !min-h-12 !px-6 !text-base">
                Fanlarni ko‘rish
              </Link>
            </div>
            <dl className="mt-12 grid max-w-xl grid-cols-2 border-t-[1.5px] border-ink sm:grid-cols-4">
              {(
                [
                  [[43], "topshiriq", "Biologiya, kimyo"],
                  [[100, 80], "daqiqa", "ikki bosqich"],
                  [[45], "topshiriq", "Matematika, fizika"],
                  [[150], "daqiqa", "bitta bosqich"],
                ] as [number[], string, string][]
              ).map(([v, u, s]) => (
                <div key={s} className="border-b border-hair py-4 pr-3 sm:border-b-0">
                  <dt className="sr-only">{s}</dt>
                  <dd>
                    <span className="num text-2xl font-semibold">
                      {v.map((n, i) => (
                        <span key={i}>
                          {i > 0 && "+"}
                          <CountUp to={n} />
                        </span>
                      ))}
                    </span>{" "}
                    <span className="text-sm text-muted">{u}</span>
                    <span className="mt-0.5 block font-mono text-[0.68rem] uppercase tracking-wider text-muted">{s}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="animate-rise [animation-delay:120ms] lg:pt-6">
            <div className="float-y" style={{ animationDuration: "8s" }}>
              <SheetPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ RIBBON */}
      <div className="border-b-[1.5px] border-ink bg-ink text-paper">
        <div className="overflow-hidden py-3 font-mono text-xs uppercase tracking-[0.16em]">
          {/* Two identical halves scroll seamlessly; second half hidden from screen readers. */}
          <div className="marquee-track">
            {[0, 1].map((copy) => (
              <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-8 pr-8">
                {["Y1 yopiq test", "Y2 moslashtirish", "O1 qisqa javob", "O2 yozma ish", "Server vaqti", "Avtosaqlash", "M / A rubrika", "Versiyalangan format", "Biologiya", "Kimyo", "Matematika", "Fizika"].map((t) => (
                  <span key={t} className="flex shrink-0 items-center gap-8">
                    <span className="text-accent">◉</span>
                    {t}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ SUBJECTS */}
      <section id="fanlar" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <Reveal>
          <SectionHead index="01" eyebrow="Fanlar" title={<>Har bir fan — <em>o‘z</em> formati bilan</>}>
            Biz barcha fanlarni bitta universal shablonga majburlamaymiz. Har bir fan alohida, versiyalangan konfiguratsiyaga ega: topshiriqlar soni,
            turlari, bosqichlar va vaqt chegaralari rasmiy hujjatlardan olingan.
          </SectionHead>
        </Reveal>
        <div className="mt-10">
          <SubjectsGrid />
        </div>
      </section>

      {/* ------------------------------------------------------------ TASK TYPES */}
      <section className="border-y-[1.5px] border-ink bg-paper-2/60">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Reveal>
            <SectionHead index="02" eyebrow="Topshiriq turlari" title="To‘rt xil topshiriq, to‘rt xil mantiq">
              Moslashtirish topshirig‘i oddiy test emas, qisqa javob esa satrlarni solishtirish emas. Har bir tur o‘z interfeysi va tekshirish qoidalariga
              ega — quyida ularni sinab ko‘ring.
            </SectionHead>
          </Reveal>
          <Reveal className="mt-10" delay={120}>
            <TaskTypes />
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ PROCESS */}
      <section id="jarayon" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <Reveal>
          <SectionHead index="03" eyebrow="Jarayon" title="Imtihon qanday o‘tadi">
            Haqiqiy imtihondagi kabi: avval yo‘riqnoma, keyin vaqt. Taymer siz “Imtihonni boshlash” tugmasini bosgandan keyingina ishga tushadi.
          </SectionHead>
        </Reveal>
        <ol className="mt-12 border-t-[1.5px] border-ink">
          {STEPS.map(([t, d], i) => (
            <Reveal
              as="li"
              key={t}
              variant="left"
              delay={i * 110}
              className="group relative grid gap-2 border-b border-hair py-6 transition-colors hover:bg-card md:grid-cols-[6rem_minmax(0,22rem)_minmax(0,1fr)] md:gap-8"
            >
              <span className="flex items-center gap-3">
                <span className="relative grid h-9 w-9 place-items-center rounded-full border-[1.5px] border-accent font-mono text-sm font-semibold text-accent transition-colors group-hover:bg-ink group-hover:text-paper group-hover:border-ink">
                  {i + 1}
                </span>
              </span>
              <h3 className="display text-3xl transition-all group-hover:translate-x-1 group-hover:italic">{t}</h3>
              <p className="max-w-2xl text-ink-2">{d}</p>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* ------------------------------------------------------------ RESULTS (DEMO) */}
      <section className="border-y-[1.5px] border-ink bg-ink text-paper">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow !text-paper/60">
              <span className="text-accent">§ 04</span> &nbsp;Natijalar
            </p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">Halol natija: nima o‘lchangan bo‘lsa, shu ko‘rsatiladi</h2>
            <p className="mt-5 max-w-lg text-paper/75">Natijalar sahifasida beshta ko‘rsatkich hech qachon aralashtirilmaydi:</p>
            <ol className="mt-6 space-y-3">
              {[
                ["Xom test natijasi", "to‘g‘ri / noto‘g‘ri / javobsiz va foiz", true],
                ["Rasch balli", "faqat kalibrlangan parametrlar mavjud bo‘lsa", false],
                ["O2 yozma ish ballari", "ekspert rubrikasi asosida, M va A alohida", true],
                ["Taxminiy ko‘rsatkich", "faqat hisoblash modeli ochiq ko‘rsatilsa", false],
                ["Rasmiy daraja", "faqat rasmiy shkala bo‘yicha ishonchli hisoblansa", false],
              ].map(([t, d, on], i) => (
                <li key={t as string} className="flex gap-4 border-t border-paper/15 pt-3">
                  <span className="num text-xs text-paper/50">{i + 1}</span>
                  <div className="flex-1">
                    <p className="font-semibold">{t}</p>
                    <p className="text-sm text-paper/60">{d}</p>
                  </div>
                  <span className={`chip self-start ${on ? "!border-paper/40 !bg-paper/10 !text-paper" : "!border-paper/25 !text-paper/50"}`}>
                    {on ? "har doim" : "shartli"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <Reveal variant="scale" className="relative">
            <span className="absolute -top-3 left-5 z-10 -rotate-2 border-[1.5px] border-accent bg-ink px-2 py-0.5 font-mono text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-accent">
              Demo ma’lumot
            </span>
            <div className="rounded-[3px] border-[1.5px] border-paper/80 bg-card p-6 text-ink shadow-[6px_6px_0_0_var(--color-accent)]">
              <div className="flex flex-wrap items-end justify-between gap-4 border-b-[1.5px] border-ink pb-4">
                <div>
                  <p className="eyebrow">Biologiya · MS-2025 · namuna</p>
                  <p className="display mt-1 text-3xl">Xom test natijasi</p>
                </div>
                <p className="num text-5xl font-semibold">
                  68,4<span className="text-2xl text-muted">%</span>
                </p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  ["27", "to‘g‘ri", "text-ok"],
                  ["9", "noto‘g‘ri", "text-accent"],
                  ["4", "javobsiz", "text-muted"],
                ].map(([v, l, c]) => (
                  <div key={l} className="border border-hair py-2">
                    <p className={`num text-2xl font-semibold ${c}`}>{v}</p>
                    <p className="eyebrow !text-[0.6rem]">{l}</p>
                  </div>
                ))}
              </div>
              <p className="eyebrow mt-6 mb-2">Mavzular bo‘yicha</p>
              {[
                ["Hujayra, molekula va to‘qima darajasi", 82],
                ["Organ va organizm darajasi", 71],
                ["Tur va populyatsiya darajasi", 54],
                ["Ekotizim, biosfera va filogenez", 38],
              ].map(([t, v], i) => (
                <div key={t as string} className="mb-2">
                  <div className="flex justify-between gap-3 text-xs">
                    <span className="truncate">{t}</span>
                    <span className="num">{v}%</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-[1px] border border-ink bg-paper">
                    <div
                      className={`grow-bar h-full ${(v as number) < 50 ? "bg-accent" : "bg-ink"}`}
                      style={{ width: `${v}%`, "--reveal-delay": `${300 + i * 150}ms` } as React.CSSProperties}
                    />
                  </div>
                </div>
              ))}
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <div className="border-[1.5px] border-dashed border-ink/50 p-3">
                  <p className="eyebrow !text-[0.6rem]">Rasch balli</p>
                  <p className="mt-1 text-sm text-muted">Kalibratsiya ma’lumotlari mavjud emas — ko‘rsatilmaydi</p>
                </div>
                <div className="border-[1.5px] border-dashed border-ink/50 p-3">
                  <p className="eyebrow !text-[0.6rem]">O2 yozma ish</p>
                  <p className="mt-1 text-sm text-muted">Ekspert tekshiruvida — natija hali yakuniy emas</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ------------------------------------------------------------ LEVELS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <Reveal>
          <SectionHead index="05" eyebrow="Ma’lumot uchun" title="Milliy sertifikat darajalari">
            {DEFAULT_GRADE_BOUNDARIES.source} bo‘yicha. Platforma bu darajalarni mock natijangizga avtomatik tatbiq etmaydi — buning uchun rasmiy standart
            shkala kerak.
          </SectionHead>
        </Reveal>
        {/* Staircase: higher levels stand taller */}
        <div className="mt-10 grid grid-cols-2 items-end gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {DEFAULT_GRADE_BOUNDARIES.levels.map((l, i, arr) => (
            <Reveal key={l.level} delay={(arr.length - 1 - i) * 90}>
              <div
                className="sheet lift flex flex-col justify-between p-4"
                style={{ minHeight: `${7 + (arr.length - i) * 1.4}rem`, background: i === 0 ? "var(--color-ink)" : undefined, color: i === 0 ? "var(--color-paper)" : undefined }}
              >
                <p className={`display text-5xl ${i === 0 ? "text-accent" : ""}`}>{l.level}</p>
                <p className={`num mt-3 text-xs ${i === 0 ? "text-paper/70" : "text-ink-2"}`}>{l.rule}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 flex items-start gap-2 text-sm text-muted">
          <span className="chip chip-warn">Diqqat</span>
          <span>
            {DEFAULT_GRADE_BOUNDARIES.note}{" "}
            <a href={DEFAULT_GRADE_BOUNDARIES.sourceUrl} className="link" target="_blank" rel="noopener noreferrer">
              Manba ↗
            </a>
          </span>
        </p>
      </section>

      {/* ------------------------------------------------------------ FAQ */}
      <section id="savollar" className="scroll-mt-20 border-t-[1.5px] border-ink bg-paper-2/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.6fr]">
          <div>
            <p className="eyebrow">
              <span className="text-accent">§ 06</span> &nbsp;Savollar
            </p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">Ko‘p beriladigan savollar</h2>
            <p className="mt-4 text-ink-2">Javob topilmasa — platforma administratoriga murojaat qiling.</p>
            <div className="mt-8 hidden grid-cols-2 gap-3 lg:grid" aria-hidden>
              {["biologiya", "kimyo", "matematika", "fizika"].map((c, i) => (
                <Reveal key={c} variant="scale" delay={i * 120}>
                  <div className="sheet overflow-hidden">
                    <SubjectArt code={c} className="block h-auto w-full" />
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
          <div className="border-t-[1.5px] border-ink">
            {FAQ.map(([q, a]) => (
              <details key={q} className="group border-b border-hair">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-semibold [&::-webkit-details-marker]:hidden">
                  {q}
                  <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-[1.5px] border-ink font-mono text-sm transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <div className="pb-6 pr-10 leading-relaxed text-ink-2">{a}</div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ DISCLAIMER + CTA */}
      <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6">
        <div className="crop sheet-hard grid gap-8 p-8 md:grid-cols-[1.4fr_1fr] md:p-12">
          <div>
            <h2 className="display text-4xl sm:text-5xl">
              Imtihon kuni <em>yangilik</em> bo‘lmasin.
            </h2>
            <p className="mt-4 max-w-xl text-ink-2">
              Platforma mustaqil mock-imtihon tizimi bo‘lib, Bilim va malakalarni baholash agentligining rasmiy imtihoni emas. Formatlar agentlik saytida
              e’lon qilingan spetsifikatsiyalar asosida tuzilgan; ishonch hosil qilish uchun har doim rasmiy manbani tekshiring.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              <a className="link" href="https://uzbmb.uz/page/fanlar" target="_blank" rel="noopener noreferrer">
                Fan spetsifikatsiyalari ↗
              </a>
              <a className="link" href="https://www.uzbmb.uz/page/namuna_m" target="_blank" rel="noopener noreferrer">
                Namunaviy topshiriqlar ↗
              </a>
            </div>
          </div>
          <div className="flex flex-col justify-center gap-3">
            <Link href="/royxatdan-otish" className="btn btn-primary !min-h-12 !text-base">
              Bepul hisob ochish
            </Link>
            <Link href="/imtihonlar" className="btn !min-h-12 !text-base">
              Mavjud imtihonlar
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
