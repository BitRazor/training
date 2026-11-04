/* build-apk.mjs: one command from the app files to an installable Android APK.
     node tools/build-apk.mjs [--debug] [--copy-to <folder>]        (or: npm run apk -- --copy-to <folder>)
   1. checks that version.json matches the files (if not: node tools/make-version.mjs, and commit it)
   2. fills www/ (build-www.mjs) and copies it into the Android project (npx cap sync android)
   3. Gradle: assembleRelease, signed through android/keystore.properties (never committed; see
      android/app/build.gradle), or with --debug a debug build (debuggable WebView, plain-http test
      servers allowed; for testing only)
   4. prints the APK's path; --copy-to also copies it there as training-v2-<version>[-debug].apk
   Needs a JDK 21 (JAVA_HOME, else Android Studio's own at its default place) and the Android SDK
   (android/local.properties sdk.dir=..., or ANDROID_HOME). A new APK for phones that already have the
   app must carry a higher version than theirs: bump version.json first (make-version.mjs). */
import { spawnSync } from "child_process";
import { existsSync, copyFileSync, mkdirSync, statSync } from "fs";
import { join, resolve } from "path";
import { ROOT, readVersionJson } from "./app-files.mjs";
import { buildWww } from "./build-www.mjs";

const args = process.argv.slice(2);
const debug = args.includes("--debug");
const copyTo = args.includes("--copy-to") ? args[args.indexOf("--copy-to") + 1] : null;
const fail = (m) => { console.error(m); process.exit(1); };
/* one command line (the arguments here are fixed words): Windows needs a shell for npx and .bat files */
const run = (cmd, cmdArgs, cwd) => {
  const line = cmd + " " + cmdArgs.join(" ");
  console.log("> " + line);
  const r = process.platform === "win32" ? spawnSync(line, { cwd, stdio: "inherit", shell: true, env }) : spawnSync(cmd, cmdArgs, { cwd, stdio: "inherit", env });
  if (r.status !== 0) fail(cmd + " failed (exit " + r.status + ")");
};

const env = { ...process.env };
if (!env.JAVA_HOME) {
  const studio = "C:/Program Files/Android/Android Studio/jbr";
  if (existsSync(studio)) env.JAVA_HOME = studio;
}
if (!debug && !existsSync(join(ROOT, "android/keystore.properties"))) {
  fail("release signing is not set up: android/keystore.properties is missing (see android/app/build.gradle)");
}

try {
  const w = buildWww();
  console.log("www/ ready: version " + w.version + ", " + w.count + " files");
} catch (e) { fail(e.message); }
run("npx", ["cap", "sync", "android"], ROOT);
/* full path: Windows may be set not to run programs from the current folder by bare name */
const gradlew = join(ROOT, "android", process.platform === "win32" ? "gradlew.bat" : "gradlew");
run(process.platform === "win32" ? '"' + gradlew + '"' : gradlew, [debug ? "assembleDebug" : "assembleRelease", "--console=plain"], join(ROOT, "android"));

const version = readVersionJson().version;
const apk = join(ROOT, "android/app/build/outputs/apk", debug ? "debug/app-debug.apk" : "release/app-release.apk");
if (!existsSync(apk)) fail("no APK at " + apk + (debug ? "" : " (an unsigned build means the signing details were not found)"));
console.log("APK: " + apk + " (" + (statSync(apk).size / 1048576).toFixed(1) + " MB, version " + version + ")");
if (copyTo) {
  mkdirSync(copyTo, { recursive: true });
  const dest = resolve(copyTo, "training-v2-" + version + (debug ? "-debug" : "") + ".apk");
  copyFileSync(apk, dest);
  console.log("copied to " + dest);
}
