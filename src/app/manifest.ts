import type { MetadataRoute } from "next";

/** Served at /manifest.webmanifest, which the proxy lets through signed out. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Lifestyle Tracker",
    short_name: "Lifestyle",
    description: "What's in the kitchen, what you ate, and what to cook next.",
    start_url: "/today",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#F3F5F0",
    theme_color: "#F3F5F0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
