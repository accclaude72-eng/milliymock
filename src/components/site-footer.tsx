import Link from "next/link";
import { Logo } from "./ui";

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t-[1.5px] border-ink bg-ink text-paper no-print">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="text-lg [&_*]:!text-paper [&_.ring-ink]:ring-paper">
            <Logo />
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-paper/70">
            Milliy sertifikat imtihonlariga tayyorgarlik uchun mustaqil mock-imtihon platformasi. Davlat sertifikatini bermaydi va Bilim va
            malakalarni baholash agentligi bilan bog‘liq emas.
          </p>
        </div>
        <FooterCol
          title="Platforma"
          links={[
            ["/imtihonlar", "Imtihonlar"],
            ["/fanlar", "Fanlar"],
            ["/#jarayon", "Qanday ishlaydi"],
            ["/kabinet", "Shaxsiy kabinet"],
          ]}
        />
        <FooterCol
          title="Rasmiy manbalar"
          links={[
            ["https://uzbmb.uz/page/milliytest", "BMBA — Milliy test tizimi"],
            ["https://uzbmb.uz/page/fanlar", "Fan spetsifikatsiyalari"],
            ["https://www.uzbmb.uz/page/namuna_m", "Namunaviy topshiriqlar"],
            ["https://lex.uz/acts/-5044726", "VM 646-son qarori"],
          ]}
          external
        />
        <FooterCol
          title="Huquqiy"
          links={[
            ["/maxfiylik", "Maxfiylik siyosati"],
            ["/shartlar", "Foydalanish shartlari"],
            ["/#savollar", "Ko‘p beriladigan savollar"],
          ]}
        />
      </div>
      <div className="border-t border-paper/15">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 font-mono text-xs text-paper/60 sm:px-6">
          <span>© Milliy Mock — mustaqil ta’lim loyihasi</span>
          <span>Vaqt mintaqasi: Asia/Tashkent · UTC+5</span>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({ title, links, external }: { title: string; links: [string, string][]; external?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.14em] text-paper/50">{title}</p>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map(([href, label]) => (
          <li key={href}>
            {external ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-paper/85 underline-offset-4 hover:text-paper hover:underline">
                {label} ↗
              </a>
            ) : (
              <Link href={href} className="text-paper/85 underline-offset-4 hover:text-paper hover:underline">
                {label}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
