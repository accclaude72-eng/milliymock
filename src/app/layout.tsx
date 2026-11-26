import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Newsreader } from "next/font/google";
import { AuthProvider } from "@/components/auth-provider";
import "./globals.css";

const serif = Newsreader({ variable: "--font-newsreader", subsets: ["latin", "latin-ext"], style: ["normal", "italic"], display: "swap" });
const sans = IBM_Plex_Sans({ variable: "--font-plex-sans", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], display: "swap" });
const mono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "Milliy Mock — Milliy sertifikat imtihoniga real formatda tayyorlaning", template: "%s · Milliy Mock" },
  description:
    "Biologiya, kimyo, matematika va fizika bo‘yicha Milliy sertifikat formatidagi mock-imtihonlar: Y1, Y2, O1 va O2 topshiriqlari, server vaqti, natijalar tahlili va yozma ishlarni ekspert baholashi.",
  applicationName: "Milliy Mock",
};

export const viewport: Viewport = {
  themeColor: "#f3f0e8",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${serif.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#asosiy" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 btn btn-ink">
          Asosiy mazmunga o‘tish
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
