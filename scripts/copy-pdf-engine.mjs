import { cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const packageRoot = new URL("../node_modules/pdfjs-dist/", import.meta.url);
const target = new URL("../public/pdf-engine/", import.meta.url);
await mkdir(target, { recursive: true });
for (const file of ["pdf.mjs", "pdf.worker.mjs"]) {
  await cp(new URL("legacy/build/" + file, packageRoot), new URL(file, target));
}
for (const directory of ["cmaps", "standard_fonts", "wasm"]) {
  await cp(new URL(directory, packageRoot), new URL(directory, target), { recursive: true });
}
await cp(fileURLToPath(new URL("LICENSE", packageRoot)), new URL("LICENSE.txt", target));
