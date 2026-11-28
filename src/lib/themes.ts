/**
 * Site-wide design themes. The admin picks one in /admin/dizayn; it is applied as
 * <html data-theme="…"> and styled in src/app/themes.css. "default" is the original paper design.
 */
export const THEME_IDS = ["default", "aurora", "samarqand", "minimal", "terminal", "konfet", "okean", "brutal", "sahro", "kiber", "bahor"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeInfo {
  id: ThemeId;
  name: string;
  tagline: string;
  description: string;
  dark: boolean;
  /** Preview colours: background, surface, text, accent, second accent. */
  swatch: [string, string, string, string, string];
  /** Browser UI colour (mobile address bar). */
  themeColor: string;
  fonts: string;
}

export const THEMES: ThemeInfo[] = [
  {
    id: "default",
    name: "Qog‘oz (asl)",
    tagline: "Rasmiy javoblar varaqasi",
    description: "Iliq qog‘oz fon, qora siyoh chiziqlari va bitta qizil urg‘u — saytning asl dizayni.",
    dark: false,
    swatch: ["#f3f0e8", "#fbfaf6", "#141412", "#b8321a", "#cdc8ba"],
    themeColor: "#f3f0e8",
    fonts: "Newsreader · IBM Plex",
  },
  {
    id: "aurora",
    name: "Aurora",
    tagline: "Tungi neon va shisha",
    description: "To‘q kosmik fon, shaffof shisha kartalar, binafsha–moviy gradiyentlar va yumshoq yorug‘lik.",
    dark: true,
    swatch: ["#0b0f2a", "#161b44", "#eef0ff", "#8b5cf6", "#22d3ee"],
    themeColor: "#0b0f2a",
    fonts: "Sora · JetBrains Mono",
  },
  {
    id: "samarqand",
    name: "Samarqand",
    tagline: "Moviy koshin va oltin",
    description: "Registon koshinlaridan ilhomlangan: lojuvard fon, girih naqshlari, oltin hoshiya va nafis serif harflar.",
    dark: true,
    swatch: ["#0d2b4e", "#123a66", "#fdf6e3", "#e0a526", "#3fb6c6"],
    themeColor: "#0d2b4e",
    fonts: "Playfair Display · Manrope",
  },
  {
    id: "minimal",
    name: "Minimal",
    tagline: "Toza oq, shveytsarcha uslub",
    description: "Oppoq fon, chegarasiz yumshoq kartalar, katta tipografiya va elektr-ko‘k urg‘u.",
    dark: false,
    swatch: ["#ffffff", "#f5f6f8", "#0a0a0a", "#2347ff", "#e6e8ee"],
    themeColor: "#ffffff",
    fonts: "Manrope · JetBrains Mono",
  },
  {
    id: "terminal",
    name: "Terminal",
    tagline: "Yashil fosfor, retro kompyuter",
    description: "Qop-qora ekran, yashil yonib turgan harflar, skan chiziqlari va to‘liq monospace shrift.",
    dark: true,
    swatch: ["#050805", "#0b130b", "#b6ffb0", "#39ff14", "#ffb000"],
    themeColor: "#050805",
    fonts: "JetBrains Mono",
  },
  {
    id: "konfet",
    name: "Konfet",
    tagline: "Pastel, yumaloq va quvnoq",
    description: "Pushti–shaftoli gradiyentlar, katta yumaloq tugmalar, yumshoq soyalar va o‘ynoqi harflar.",
    dark: false,
    swatch: ["#fff4f0", "#ffffff", "#3b1d4a", "#ff4f8b", "#7c5cff"],
    themeColor: "#fff4f0",
    fonts: "Baloo 2 · Nunito",
  },
  {
    id: "okean",
    name: "Okean",
    tagline: "Chuqur dengiz va to‘lqinlar",
    description: "To‘q moviy chuqurlik, pastda harakatlanuvchi to‘lqinlar, ko‘tarilayotgan pufakchalar va akvamarin urg‘u.",
    dark: true,
    swatch: ["#04223a", "#0a3352", "#e6f7ff", "#2ee6c5", "#4aa8ff"],
    themeColor: "#04223a",
    fonts: "Outfit · JetBrains Mono",
  },
  {
    id: "brutal",
    name: "Brutal",
    tagline: "Neo-brutalizm: qalin va jasur",
    description: "Sariq fon, qalin qora chiziqlar, qattiq soyalar, yorqin rang bloklari va bosilganda “cho‘kadigan” tugmalar.",
    dark: false,
    swatch: ["#ffe94d", "#ffffff", "#000000", "#ff4ecd", "#2f6bff"],
    themeColor: "#ffe94d",
    fonts: "Space Grotesk",
  },
  {
    id: "sahro",
    name: "Sahro",
    tagline: "Buxoro qumi va terrakota",
    description: "Iliq qum ranglari, terrakota va oxra urg‘ular, gumbaz–ravoq naqshlari va nafis Fraunces serif harflar.",
    dark: false,
    swatch: ["#f4e7d3", "#fbf4ea", "#3b2518", "#c2562b", "#d99a2b"],
    themeColor: "#f4e7d3",
    fonts: "Fraunces · Outfit",
  },
  {
    id: "kiber",
    name: "Kiber",
    tagline: "Kiberpank: neon pushti va sariq",
    description: "Qora fon, neon pushti va sariq, qiya kesilgan tugmalar, “glitch” sarlavhalar va skaner chizig‘i.",
    dark: true,
    swatch: ["#0a0710", "#14101f", "#f5f3ff", "#ff2bd6", "#f9f002"],
    themeColor: "#0a0710",
    fonts: "Space Grotesk · JetBrains Mono",
  },
  {
    id: "bahor",
    name: "Bahor",
    tagline: "Yashil bog‘ va gul barglari",
    description: "Yalpiz–yashil ranglar, barg naqshi, sekin uchib tushayotgan gul barglari va nafis DM Serif sarlavhalar.",
    dark: false,
    swatch: ["#effaf3", "#ffffff", "#123524", "#1f9d61", "#ff8fab"],
    themeColor: "#effaf3",
    fonts: "DM Serif Display · Outfit",
  },
];

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === "string" && (THEME_IDS as readonly string[]).includes(v);
}

export function themeInfo(id: ThemeId): ThemeInfo {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}

/** localStorage key for an admin's own "preview only on this device" override. */
export const THEME_PREVIEW_KEY = "mm-theme-preview";
