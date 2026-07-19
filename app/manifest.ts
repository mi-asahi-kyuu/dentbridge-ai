import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "DentBridge AI",
    short_name: "DentBridge",
    description: "歯科診療所向けの自動分句・独立検査付きハンズフリー音声通訳テストツール",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f7",
    theme_color: "#f4f7f7",
    orientation: "any",
    lang: "ja",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
