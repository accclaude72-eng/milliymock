import type { Metadata } from "next";
import Link from "next/link";
import { SubjectArt } from "@/components/art/subject-art";
import { ConfettiLink, DemoSheet, LetterTitle, Parallax, Ring, ScrollProgress, Tilt, Typewriter } from "@/components/intro/interactive";
import { CapArt, DeskScene, OrbitBadge, RocketScene, TrophyScene } from "@/components/intro/scenes";
import { CountUp, Reveal } from "@/components/reveal";
import "./intro.css";

export const metadata: Metadata = {
  title: "Tanishuv",
  description: "Milliy Mock bilan tanishing: Milliy sertifikat va Multilevel (CEFR) imtihonlariga real formatda tayyorlanish platformasi.",
};

const SUBJECTS = [
  { code: "biologiya", name: "Biologiya", line: "Hujayradan biosferagacha", meta: "40 topshiriq · 100 daqiqa" },
  { code: "kimyo", name: "Kimyo", line: "Atomlar, reaksiyalar, masalalar", meta: "40 topshiriq · 100 daqiqa" },
  { code: "matematika", name: "Matematika", line: "Algebra, geometriya, analiz", meta: "45 topshiriq · 150 daqiqa" },
  { code: "fizika", name: "Fizika", line: "Mexanikadan kvantgacha", meta: "45 topshiriq · 150 daqiqa" },
  { code: "multilevel", name: "Multilevel English", line: "Reading + Writing, CEFR", meta: "35 + 3 topshiriq · 120 daqiqa" },
];

const STEPS = [
  ["01", "Ro‘yxatdan o‘ting", "Bir daqiqada hisob oching va shaxsiy Candidate ID oling.", "✎"],
  ["02", "Fanni tanlang", "To‘liq mock, mavzu bo‘yicha mashq yoki tezkor diagnostika.", "◎"],
  ["03", "Imtihon topshiring", "Chapda kitobcha, o‘ngda javoblar varaqasi. Javobni kitobchaning o‘zida ham belgilash mumkin.", "⏱"],
  ["04", "Natijani oling", "Test darhol tekshiriladi, Writing va yozma ishlarni ekspert baholaydi.", "✓"],
  ["05", "O‘sishni kuzating", "Mavzular bo‘yicha tahlil, zaif joylar va oldingi urinishlar bilan solishtirish.", "↗"],
] as const;

const FEATURES = [
  ["Server vaqti", "Sahifani yangilash taymerni to‘xtatmaydi — vaqt serverda hisoblanadi.", "⏱"],
  ["Avtosaqlash", "Har bir javob darhol saqlanadi, internet uzilsa navbatga yoziladi.", "☁"],
  ["Kitobchada belgilash", "Variantni kitobchaning o‘zida bosing — varaqaga o‘zi tushadi.", "✍"],
  ["Ekspert baholash", "Writing va yozma ishlar mezonlar bo‘yicha, izoh bilan baholanadi.", "★"],
  ["Telefonda ham", "Imtihon oynasi telefon va planshetga to‘liq moslashtirilgan.", "📱"],
  ["Rasmiy format", "Har bir variant fanning rasmiy format versiyasiga bog‘langan.", "◆"],
] as const;

const SPARKS = Array.from({ length: 18 }, (_, i) => ({
  left: `${(i * 37) % 100}%`,
  top: `${(i * 53) % 100}%`,
  d: `${2.2 + (i % 5) * 0.6}s`,
  delay: `${(i % 7) * 0.4}s`,
}));

export default function IntroPage() {
  return (
    <div className="overflow-x-clip">
      {/* ════════════════════════════════ HERO */}
      <section className="relative isolate flex min-h-[calc(100dvh-4rem)] items-center overflow-hidden border-b-[1.5px] border-ink">
        <Parallax className="pointer-events-none absolute inset-0 -z-10">
          <div data-depth="-30" className="absolute inset-0 transition-transform duration-300 ease-out">
            <div className="intro-blob left-[-8%] top-[-10%] h-[28rem] w-[28rem] bg-accent" />
            <div className="intro-blob right-[-10%] top-[20%] h-[24rem] w-[24rem] bg-info" style={{ animationDelay: "-6s" }} />
            <div className="intro-blob bottom-[-15%] left-[30%] h-[22rem] w-[22rem] bg-ok" style={{ animationDelay: "-11s", opacity: 0.3 }} />
          </div>
          <div data-depth="18" className="absolute inset-0 transition-transform duration-300 ease-out">
            {SPARKS.map((s, i) => (
              <span key={i} className="intro-spark" style={{ left: s.left, top: s.top, "--d": s.d, "--delay": s.delay } as React.CSSProperties} />
            ))}
          </div>
        </Parallax>
        <div className="graph-paper pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" aria-hidden />

        <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <p className="eyebrow inline-flex items-center gap-2 animate-rise">
              <span className="relative inline-flex h-2.5 w-2.5">
                <span className="absolute inset-0 rounded-full bg-accent" style={{ animation: "pulse-ring 1.8s ease-out infinite" }} />
                <span className="relative h-2.5 w-2.5 rounded-full bg-accent" />
              </span>
              Xush kelibsiz · Platforma bilan tanishuv
            </p>
            <h1 className="display mt-5 text-[3.2rem] leading-[0.95] sm:text-7xl xl:text-[6.2rem]">
              <LetterTitle text="Milliy Mock" />
            </h1>
            <p className="mt-5 text-2xl font-medium leading-snug text-ink-2 sm:text-3xl">
              <Typewriter words={["Biologiya", "Kimyo", "Matematika", "Fizika", "Multilevel English"]} className="font-semibold text-accent" />
              <br />
              fanidan haqiqiy imtihon formatida tayyorlaning.
            </p>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted animate-rise [animation-delay:600ms]">
              Server taymeri, avtomatik tekshiruv, ekspert baholashi va chiroyli tahlil — bularning barchasi bitta qulay platformada.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 animate-rise [animation-delay:800ms]">
              <ConfettiLink href="/imtihonlar" className="btn btn-primary intro-glow !min-h-13 !px-7 !text-base">
                Imtihonni boshlash 🚀
              </ConfettiLink>
              <Link href="#sayohat" className="btn !min-h-13 !px-7 !text-base">
                Sayohatni boshlash ↓
              </Link>
            </div>
          </div>

          {/* orbit system */}
          <Parallax className="relative mx-auto aspect-square w-full max-w-[30rem]">
            <div data-depth="24" className="absolute inset-0 transition-transform duration-300 ease-out">
              <div className="intro-orbit" style={{ "--dur": "36s" } as React.CSSProperties}>
                {[
                  ["∑", "Matematika", 0],
                  ["⚛", "Fizika", 72],
                  ["H₂O", "Kimyo", 144],
                  ["Aa", "English", 216],
                  ["🧬", "Biologiya", 288],
                ].map(([g, l, a], i) => (
                  <div key={l} className="intro-planet" style={{ "--a": `${a}deg`, "--r": "min(15rem, 46vw)", "--dur": "36s" } as React.CSSProperties}>
                    <OrbitBadge glyph={String(g)} label={String(l)} tone={i % 2 ? "accent" : "ink"} />
                  </div>
                ))}
              </div>
              <div className="intro-orbit reverse inset-[18%]" style={{ "--dur": "22s" } as React.CSSProperties}>
                {[
                  ["π", 30],
                  ["✎", 150],
                  ["⏱", 270],
                ].map(([g, a]) => (
                  <div key={String(a)} className="intro-planet" style={{ "--a": `${a}deg`, "--r": "min(9.6rem, 29vw)", "--dur": "22s" } as React.CSSProperties}>
                    <span className="-ml-5 -mt-5 grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-ink bg-paper text-base">{g}</span>
                  </div>
                ))}
              </div>
            </div>
            <div data-depth="-14" className="absolute inset-[28%] transition-transform duration-300 ease-out">
              <CapArt className="h-full w-full drop-shadow-xl" />
            </div>
          </Parallax>
        </div>

        <a href="#sayohat" className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-muted sm:flex" aria-label="Pastga">
          <span className="intro-mouse" />
          <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em]">pastga</span>
        </a>
      </section>

      {/* ════════════════════════════════ MARQUEE */}
      <div className="border-b-[1.5px] border-ink bg-ink py-4 text-paper">
        {[false, true].map((rev) => (
          <div key={String(rev)} className="overflow-hidden py-1.5">
            <div className={`intro-marquee ${rev ? "rev" : ""}`} style={{ "--dur": rev ? "46s" : "38s" } as React.CSSProperties}>
              {[0, 1].map((copy) => (
                <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-6 pr-6">
                  {(rev
                    ? ["Reading", "Writing", "CEFR", "Server vaqti", "Avtosaqlash", "Ekspert baholash", "Mavzu tahlili", "Telefonda ham"]
                    : ["🧬 Biologiya", "⚗️ Kimyo", "∑ Matematika", "⚛ Fizika", "🇬🇧 Multilevel", "🏆 Natijalar", "📈 O‘sish", "🎯 Rasmiy format"]
                  ).map((t) => (
                    <span key={t} className={`shrink-0 whitespace-nowrap ${rev ? "font-mono text-xs uppercase tracking-[0.2em] opacity-70" : "display text-3xl sm:text-4xl"}`}>
                      {t} <span className="mx-3 text-accent">✦</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ════════════════════════════════ SUBJECTS */}
      <section id="sayohat" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-20 sm:px-6">
        <Reveal>
          <p className="eyebrow">01 · Fanlar</p>
          <h2 className="display mt-2 max-w-3xl text-4xl sm:text-6xl">
            Beshta fan — <em className="text-accent">bitta</em> platforma
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {SUBJECTS.map((s, i) => (
            <Reveal key={s.code} delay={i * 110} variant="scale" className={i === 4 ? "sm:col-span-2 lg:col-span-1" : undefined}>
              <Tilt className="sheet-hard h-full overflow-hidden">
                <Link href={`/fanlar/${s.code}`} className="flex h-full flex-col">
                  <div className="border-b border-hair bg-paper-2/60 p-3">
                    <SubjectArt code={s.code} className="h-36 w-full" />
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    <p className="num text-xs text-muted">0{i + 1}</p>
                    <h3 className="mt-1 text-xl font-semibold">{s.name}</h3>
                    <p className="mt-1 text-sm text-muted">{s.line}</p>
                    <p className="mt-auto pt-4 font-mono text-[0.68rem] uppercase tracking-wider text-accent">{s.meta} →</p>
                  </div>
                </Link>
              </Tilt>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════ DESK SCENE + DEMO */}
      <section className="border-y-[1.5px] border-ink bg-paper-2/50">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2">
          <Reveal variant="left">
            <p className="eyebrow">02 · Imtihon oynasi</p>
            <h2 className="display mt-2 text-4xl sm:text-5xl">
              Uyda o‘tirib — <em className="text-accent">haqiqiy</em> imtihon hissi
            </h2>
            <p className="mt-4 max-w-lg text-lg text-muted">Taymer yuradi, javoblar o‘zi saqlanadi, oxirida esa har bir savol rangli belgi bilan tekshirib beriladi.</p>
            <DeskScene className="mt-8 w-full max-w-xl" />
          </Reveal>
          <Reveal delay={150} variant="scale">
            <Tilt className="mx-auto max-w-md">
              <DemoSheet />
            </Tilt>
            <p className="mt-4 text-center font-mono text-xs text-muted">↑ jonli namoyish: javoblar belgilanadi va tekshiriladi</p>
          </Reveal>
        </div>
      </section>

      {/* ════════════════════════════════ TIMELINE */}
      <section className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <Reveal className="text-center">
          <p className="eyebrow">03 · Qanday ishlaydi</p>
          <h2 className="display mt-2 text-4xl sm:text-6xl">Besh qadam — natijagacha</h2>
        </Reveal>
        <ScrollProgress className="relative mt-14">
          <div className="absolute bottom-0 left-6 top-0 w-[3px] bg-hair sm:left-1/2 sm:-ml-[1.5px]" aria-hidden />
          <div className="intro-line absolute bottom-0 left-6 top-0 w-[3px] bg-accent sm:left-1/2 sm:-ml-[1.5px]" aria-hidden />
          <ol className="space-y-10">
            {STEPS.map(([n, t, d, g], i) => (
              <Reveal as="li" key={n} delay={60} className="relative grid grid-cols-[3rem_1fr] gap-5 sm:grid-cols-2 sm:gap-16">
                <span className="intro-pop relative z-10 grid h-12 w-12 place-items-center rounded-full border-[1.5px] border-ink bg-card text-xl shadow-lg sm:absolute sm:left-1/2 sm:-ml-6">
                  {g}
                </span>
                <div className={`sheet lift p-5 ${i % 2 ? "sm:col-start-2" : "sm:col-start-1 sm:text-right"}`}>
                  <p className="num text-sm text-accent">{n}</p>
                  <h3 className="mt-1 text-xl font-semibold">{t}</h3>
                  <p className="mt-1 text-sm text-muted">{d}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </ScrollProgress>
      </section>

      {/* ════════════════════════════════ FEATURES */}
      <section className="border-y-[1.5px] border-ink bg-paper-2/50">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <Reveal>
            <p className="eyebrow">04 · Imkoniyatlar</p>
            <h2 className="display mt-2 text-4xl sm:text-5xl">Kichik detallar — katta farq</h2>
          </Reveal>
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([t, d, g], i) => (
              <Reveal as="li" key={t} delay={i * 90}>
                <Tilt className="sheet h-full p-6">
                  <span className="intro-bob inline-grid h-14 w-14 place-items-center rounded-2xl bg-accent text-2xl text-white shadow-lg" style={{ "--dur": `${4 + i * 0.4}s`, "--delay": `${-i * 0.7}s` } as React.CSSProperties}>
                    {g}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{t}</h3>
                  <p className="mt-1 text-sm text-muted">{d}</p>
                </Tilt>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* ════════════════════════════════ NUMBERS */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.4fr]">
          <Reveal variant="scale" className="relative mx-auto w-full max-w-sm">
            <RocketScene className="w-full" />
            <TrophyScene className="absolute -bottom-10 -right-6 w-40 sm:w-48" />
          </Reveal>
          <div>
            <Reveal>
              <p className="eyebrow">05 · Raqamlarda</p>
              <h2 className="display mt-2 text-4xl sm:text-5xl">Natijangiz yuqoriga uchsin</h2>
            </Reveal>
            <div className="mt-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
              <Ring value={100} label="5" sub="fan" />
              <Ring value={80} label="4" sub="topshiriq turi" delay={150} />
              <Ring value={92} label="24/7" sub="istalgan vaqtda" delay={300} />
              <Ring value={66} label="6" sub="dizayn uslubi" delay={450} />
            </div>
            <dl className="mt-10 grid grid-cols-3 border-t-[1.5px] border-ink pt-6">
              {[
                [150, "daqiqa — eng uzun mock"],
                [45, "topshiriq — matematika"],
                [38, "savol — Multilevel"],
              ].map(([n, l]) => (
                <div key={String(l)}>
                  <dt className="sr-only">{l}</dt>
                  <dd>
                    <CountUp to={Number(n)} className="num text-4xl font-semibold" />
                    <span className="mt-1 block text-xs text-muted">{l}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════ FINAL CTA */}
      <section className="relative isolate overflow-hidden border-t-[1.5px] border-ink bg-ink text-paper">
        <div className="intro-blob left-[10%] top-[-30%] -z-10 h-80 w-80 bg-accent" style={{ opacity: 0.45 }} />
        <div className="intro-blob bottom-[-40%] right-[5%] -z-10 h-96 w-96 bg-info" style={{ opacity: 0.35, animationDelay: "-7s" }} />
        <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
          <Reveal variant="scale">
            <p className="text-5xl">🎓</p>
            <h2 className="display mt-4 text-4xl text-paper sm:text-6xl">Tayyormisiz? Birinchi mock sizni kutmoqda.</h2>
            <p className="mx-auto mt-4 max-w-xl opacity-80">Ro‘yxatdan o‘tish bepul va bir daqiqa oladi. Tugmaga sichqonchani olib keling — kichik bayram boshlanadi 🎉</p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <ConfettiLink href="/royxatdan-otish" className="btn btn-primary intro-glow !min-h-14 !px-8 !text-lg">
                Ro‘yxatdan o‘tish ✨
              </ConfettiLink>
              <Link href="/" className="btn !min-h-14 !px-8 !text-lg">
                Bosh sahifaga
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}
