/* make-version.mjs: writes version.json, the manifest the Android app's updater reads from GitHub
   (https://raw.githubusercontent.com/BitRazor/training/v2/version.json).

   Run it after changing any app file and commit version.json together with the change:
     node tools/make-version.mjs                 new version only if a file changed
     node tools/make-version.mjs --check         exit 1 if version.json no longer matches the files
   Native block, only when a new APK is published (the app then shows a "new app version" banner):
     node tools/make-version.mjs --apk-build 26110501 --apk-version 2026.11.05.1 --apk-url https://...
     node tools/make-version.mjs --no-apk        drop the block
     node tools/make-version.mjs --min-apk 26110501
                                 web files that need at least this APK build (older apps keep their files)

   version.json = { version, files: {path: sha256}, assets: {path: sha256}, apk?, minApk? }
   The version is YYYY.MM.DD.N (local date; N counts up within a day); it changes only when a file
   or an image changed, or with --set-version. */
import { writeFileSync } from "fs";
import { join } from "path";
import { ROOT, currentHashes, sameHashes, readVersionJson } from "./app-files.mjs";

const args = process.argv.slice(2);
const flag = (name) => args.includes("--" + name);
const opt = (name) => { const i = args.indexOf("--" + name); return i >= 0 ? args[i + 1] : undefined; };

function today() {
  const d = new Date(), p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "." + p(d.getMonth() + 1) + "." + p(d.getDate());
}
function nextVersion(prev) {
  const t = today(), m = /^(\d{4}\.\d{2}\.\d{2})\.(\d+)$/.exec(prev || "");
  if (m && m[1] === t) return t + "." + (Number(m[2]) + 1);
  return t + ".1";
}

const prev = readVersionJson();
const now = currentHashes();
const same = sameHashes(prev, now);

if (flag("check")) {
  if (!same) { console.error("version.json is out of date: run  node tools/make-version.mjs"); process.exit(1); }
  console.log("version.json is up to date: " + prev.version);
  process.exit(0);
}

const out = { version: opt("set-version") || (same ? prev.version : nextVersion(prev && prev.version)), files: now.files, assets: now.assets };

let apk = prev && prev.apk;
if (flag("no-apk")) apk = undefined;
if (opt("apk-build") || opt("apk-url") || opt("apk-version")) {
  const build = Number(opt("apk-build")), url = opt("apk-url");
  if (!Number.isInteger(build) || build <= 0 || !/^https:\/\//.test(url || "")) {
    console.error("--apk-build needs a whole number and --apk-url an https:// link");
    process.exit(1);
  }
  apk = { build, version: opt("apk-version") || String(build), url };
}
if (apk) out.apk = apk;

let minApk = prev && prev.minApk;
if (opt("min-apk") !== undefined) minApk = Number(opt("min-apk")) || undefined;
if (minApk) out.minApk = minApk;

writeFileSync(join(ROOT, "version.json"), JSON.stringify(out, null, 2) + "\n");
console.log((prev && out.version === prev.version ? "unchanged " : "wrote ") + "version.json " + out.version +
  " (" + Object.keys(out.files).length + " text files, " + Object.keys(out.assets).length + " images" + (out.apk ? ", apk build " + out.apk.build : "") + ")");
