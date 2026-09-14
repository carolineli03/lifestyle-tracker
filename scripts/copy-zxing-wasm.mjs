// Copies the barcode decoder's WebAssembly into public/zxing/ so it's served
// from this app instead of a CDN. Runs before every build (npm "prebuild").
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const source = require.resolve("zxing-wasm/reader/zxing_reader.wasm");
const target = path.join(process.cwd(), "public", "zxing", "zxing_reader.wasm");

await mkdir(path.dirname(target), { recursive: true });
await copyFile(source, target);
console.log("copied zxing_reader.wasm → public/zxing/");
