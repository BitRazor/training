/* build-www.mjs: fills www/, the folder Capacitor packs into the Android app (webDir in
   capacitor.config.json). Run: node tools/build-www.mjs   (npm run www)

   Ships index.html, boot.js, every data-app-src / data-app-href file, version.json, the manifest,
   the icons and gifs/; nothing else (the legacy app.js, data.js, style.css and calibration.html
   stay out). Text files are written in canonical form (UTF-8, LF), the same bytes GitHub serves.
   Stops if version.json does not match the files: run  node tools/make-version.mjs  first, so the
   built-in copy always knows its own true version. */
import { mkdirSync, rmSync, writeFileSync, readFileSync, copyFileSync, statSync } from "fs";
import { join, dirname } from "path";
import { ROOT, EXTRA_FILES, appTextFiles, appAssets, canonicalText, currentHashes, sameHashes, readVersionJson } from "./app-files.mjs";

export function buildWww() {
  const manifest = readVersionJson();
  if (!sameHashes(manifest, currentHashes())) {
    throw new Error("version.json does not match the app files: run  node tools/make-version.mjs  first");
  }
  const out = join(ROOT, "www");
  rmSync(out, { recursive: true, force: true });
  let count = 0, bytes = 0;
  const put = (rel, buf) => { const p = join(out, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, buf); count++; bytes += buf.length; };
  for (const f of [...appTextFiles(), ...EXTRA_FILES]) put(f, canonicalText(readFileSync(join(ROOT, f))));
  for (const f of appAssets()) { const p = join(out, f); mkdirSync(dirname(p), { recursive: true }); copyFileSync(join(ROOT, f), p); count++; bytes += statSync(p).size; }
  put("version.json", canonicalText(readFileSync(join(ROOT, "version.json"))));
  return { version: manifest.version, count, bytes };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("tools/build-www.mjs")) {
  try {
    const r = buildWww();
    console.log("www/ ready: version " + r.version + ", " + r.count + " files, " + (r.bytes / 1048576).toFixed(1) + " MB");
  } catch (e) { console.error(e.message); process.exit(1); }
}
