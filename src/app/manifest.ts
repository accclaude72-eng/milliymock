import type { MetadataRoute } from "next";

/** Web app manifest: installable on phones ("Bosh ekranga qo‘shish") and desktops. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Milliy Mock — Milliy sertifikatga tayyorgarlik",
    short_name: "Milliy Mock",
    description: "Milliy sertifikat formatidagi mock imtihonlar, kunlik challenge, flashcards va o‘quv reja.",
    lang: "uz",
    start_url: "/kabinet?manba=pwa",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#f3f0e8",
    theme_color: "#f3f0e8",
    categories: ["education"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Kunlik challenge", url: "/challenge", icons: [{ src: "/pwa-icon/192", sizes: "192x192" }] },
      { name: "Flashcards", url: "/kartalar", icons: [{ src: "/pwa-icon/192", sizes: "192x192" }] },
      { name: "Xatolar daftari", url: "/kabinet/xatolar", icons: [{ src: "/pwa-icon/192", sizes: "192x192" }] },
    ],
  };
}
