import type { Metadata, Viewport } from "next";
import { Baloo_2, DM_Serif_Display, Fraunces, IBM_Plex_Mono, IBM_Plex_Sans, JetBrains_Mono, Manrope, Newsreader, Nunito, Outfit, Playfair_Display, Sora, Space_Grotesk } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import { OfflineBanner, PwaRegister } from "@/components/pwa";
import { getSiteTheme } from "@/lib/server/site-settings";
import { THEME_IDS, THEME_PREVIEW_KEY, themeInfo } from "@/lib/themes";
import "./globals.css";
import "./themes.css";
import "./themes-2.css";

const serif = Newsreader({ variable: "--font-newsreader", subsets: ["latin", "latin-ext"], style: ["normal", "italic"], display: "swap" });
const sans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap" });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], display: "swap" });
// Theme fonts: not preloaded — the browser only downloads the ones the active theme uses.
const sora = Sora({ variable: "--font-sora", subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const jet = JetBrains_Mono({ variable: "--font-jet", subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const playfair = Playfair_Display({ variable: "--font-playfair", subsets: ["latin", "latin-ext"], style: ["normal", "italic"], display: "swap", preload: false });
const manrope = Manrope({ variable: "--font-manrope", subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const baloo = Baloo_2({ variable: "--font-baloo", subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin", "latin-ext"], display: "swap", preload: false });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin", "latin-ext"], style: ["normal", "italic"], display: "swap", preload: false });
const dmSerif = DM_Serif_Display({ variable: "--font-dmserif", subsets: ["latin", "latin-ext"], weight: "400", style: ["normal", "italic"], display: "swap", preload: false });
const FONT_VARS = [serif, sans, mono, sora, jet, playfair, manrope, baloo, nunito, outfit, grotesk, fraunces, dmSerif].map((f) => f.variable).join(" ");

export const metadata: Metadata = {
  title: { default: "Milliy Mock — Milliy sertifikat imtihoniga real formatda tayyorlaning", template: "%s · Milliy Mock" },
  description:
    "Biologiya, kimyo, matematika va fizika bo‘yicha Milliy sertifikat formatidagi mock-imtihonlar: Y1, Y2, O1 va O2 topshiriqlari, server vaqti, natijalar tahlili va yozma ishlarni ekspert baholashi.",
  applicationName: "Milliy Mock",
  appleWebApp: { capable: true, title: "Milliy Mock", statusBarStyle: "default" },
  icons: { apple: "/pwa-icon/apple-180" },
};

export async function generateViewport(): Promise<Viewport> {
  const t = themeInfo(await getSiteTheme());
  return { themeColor: t.themeColor, colorScheme: t.dark ? "dark" : "light" };
}

// Runs before first paint: enables scroll-reveal styles, and applies an admin's
// "preview on this device only" theme (stored locally, never affects other visitors).
const BOOT = `(function(){var d=document.documentElement;d.classList.add('js');try{var p=localStorage.getItem(${JSON.stringify(THEME_PREVIEW_KEY)});if(p&&${JSON.stringify(THEME_IDS)}.indexOf(p)>=0){d.setAttribute('data-theme',p);d.setAttribute('data-theme-preview','')}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await getSiteTheme();
  return (
    <html lang="uz" data-theme={theme} className={`${FONT_VARS} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
        <a href="#asosiy" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-ink">
          Asosiy mazmunga o‘tish
        </a>
        <PwaRegister />
        <OfflineBanner />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
