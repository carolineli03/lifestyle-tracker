// Renders the PWA icons into public/icons/ from one inline SVG.
// Run once after changing the artwork:  node scripts/make-icons.mjs
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { ImageResponse } from "next/dist/compiled/@vercel/og/index.node.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, "..", "public", "icons");

const PINE = "#245C41";
const PAPER = "#F3F5F0";
const MARIGOLD = "#EBB43A";

/**
 * A bowl with a rising line over it: food, and progress. `inset` is the share
 * of the canvas the glyph may use — maskable icons keep it inside the 80%
 * safe zone so a circular mask never clips it.
 */
function svg({ rounded, inset }) {
  const s = 512;
  const g = s * inset;
  const o = (s - g) / 2;
  const u = g / 100; // glyph units
  const x = (n) => (o + n * u).toFixed(1);
  const y = (n) => (o + n * u).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${rounded ? 112 : 0}" fill="${PINE}"/>
  <path d="M ${x(10)} ${y(56)} H ${x(90)} C ${x(90)} ${y(78)} ${x(72)} ${y(92)} ${x(50)} ${y(92)} C ${x(28)} ${y(92)} ${x(10)} ${y(78)} ${x(10)} ${y(56)} Z" fill="${PAPER}"/>
  <polyline points="${x(22)},${y(40)} ${x(40)},${y(26)} ${x(56)},${y(34)} ${x(78)},${y(12)}" fill="none" stroke="${MARIGOLD}" stroke-width="${(7 * u).toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="${x(78)}" cy="${y(12)}" r="${(6.5 * u).toFixed(1)}" fill="${MARIGOLD}"/>
</svg>`;
}

async function render(file, size, opts) {
  const dataUri = `data:image/svg+xml;base64,${Buffer.from(svg(opts)).toString("base64")}`;
  const img = new ImageResponse(
    h("img", { src: dataUri, width: size, height: size, style: { width: size, height: size } }),
    { width: size, height: size },
  );
  await writeFile(path.join(out, file), Buffer.from(await img.arrayBuffer()));
  console.log("wrote", file);
}

await mkdir(out, { recursive: true });
await writeFile(path.join(out, "icon.svg"), svg({ rounded: true, inset: 0.72 }));
await render("icon-192.png", 192, { rounded: true, inset: 0.72 });
await render("icon-512.png", 512, { rounded: true, inset: 0.72 });
await render("maskable-512.png", 512, { rounded: false, inset: 0.6 });
// iOS applies its own corner mask and ignores transparency, so full-bleed.
await render("apple-touch-icon.png", 180, { rounded: false, inset: 0.66 });
