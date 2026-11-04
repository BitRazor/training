/* app-files.mjs: the one place that knows which files make up the app. Used by make-version.mjs
   (writes version.json) and build-www.mjs (fills www/ for the Android app).

   - Text files: index.html plus every file index.html names in a data-app-src / data-app-href tag
     (the loading convention is described at the top of boot.js). These are what the Android app's
     updater downloads from GitHub.
   - Assets: every file under the asset folders plus the root icons. The updater never downloads
     them; a new or changed one is shown straight from GitHub instead.

   Text files are hashed in their canonical form: UTF-8, no byte-order mark, LF line ends. That is
   exactly what GitHub serves (git stores LF), whatever this PC's checkout uses (Windows checks
   files out with CRLF), so a hash made here matches a download from raw.githubusercontent.com. */
import { readFileSync, readdirSync, statSync, existsSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";
import { fileURLToPath } from "url";

export const ROOT = fileURLToPath(new URL("..", import.meta.url));
export const ASSET_DIRS = ["gifs"];
export const ROOT_ASSETS = ["icon-192.png", "icon-512.png", "apple-touch-icon.png"];
/* shipped in the APK but not part of the update manifest */
export const EXTRA_FILES = ["boot.js", "manifest.webmanifest"];

export function canonicalText(buf) {
  return Buffer.from(buf.toString("utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n"), "utf8");
}
export function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

/* index.html first, then every stylesheet and script in tag order */
export function appTextFiles(root = ROOT) {
  const html = readFileSync(join(root, "index.html"), "utf8");
  const named = [...html.matchAll(/\bdata-app-(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  if (!named.length) throw new Error("index.html names no data-app-src / data-app-href files");
  return ["index.html", ...new Set(named)];
}

export function appAssets(root = ROOT) {
  const out = [];
  const walk = (rel) => {
    for (const name of readdirSync(join(root, rel)).sort()) {
      const r = rel + "/" + name;
      if (statSync(join(root, r)).isDirectory()) walk(r);
      else out.push(r);
    }
  };
  for (const dir of ASSET_DIRS) if (existsSync(join(root, dir))) walk(dir);
  for (const f of ROOT_ASSETS) if (existsSync(join(root, f))) out.push(f);
  return out;
}

/* the hashes version.json must carry for the files as they are now */
export function currentHashes(root = ROOT) {
  const files = {}, assets = {};
  for (const f of appTextFiles(root)) {
    if (!existsSync(join(root, f))) throw new Error("index.html names " + f + " but the file does not exist");
    files[f] = sha256(canonicalText(readFileSync(join(root, f))));
  }
  for (const f of appAssets(root)) assets[f] = sha256(readFileSync(join(root, f)));
  return { files, assets };
}

export function sameHashes(a, b) {
  const norm = (o) => JSON.stringify(Object.keys(o || {}).sort().map((k) => [k, o[k]]));
  return !!a && !!b && norm(a.files) === norm(b.files) && norm(a.assets) === norm(b.assets);
}

export function readVersionJson(root = ROOT) {
  const p = join(root, "version.json");
  return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null;
}
