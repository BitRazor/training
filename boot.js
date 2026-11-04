/* boot.js: starts the Training app. It loads the app's stylesheets and scripts, and inside the
   Android app it keeps them up to date from GitHub.

   THE CONVENTION (follow it when adding, renaming or reordering files)
   - index.html loads no app code by itself. It lists every stylesheet as an inert tag in <head>,
     before boot.js:        <link data-app-href="tracker.css">
     and every script as an inert tag at the end of <body>, in the order they must run:
                            <script type="text/plain" data-app-src="tracker.js"></script>
     boot.js is the only real <script src> and sits at the end of <head>.
   - A new file = a new tag in the right place, then  node tools/make-version.mjs  (it reads these
     tags) and an entry in sw.js CORE (the web version's offline copy).
   - No inline <script> in index.html: a downloaded index.html's inline scripts are never run.
   - Images live in gifs/ (or the root icons) and are referenced with relative URLs.
   - <meta name="app-health" content="#view-today">: the element that must have content once the
     app has started; keep it pointing at the first screen.
   - boot.js itself is never replaced over the air: a change here needs a new APK.

   IN A BROWSER (GitHub Pages, the jsdom tests): loads the files next to index.html, and registers
   the service worker on http(s).
   IN THE ANDROID APP (Capacitor) it runs the newest verified copy of the web files, built into the
   APK or downloaded:
   - Once the app is up it fetches version.json from the update base (GitHub raw, branch v2). If
     that is newer it downloads the changed text files, checks every sha256, stores the bundle in
     IndexedDB and shows "Update ready" with a Restart button; otherwise it applies next launch.
   - A downloaded bundle is marked as trying before it runs and confirmed once the app has rendered
     (the app-health element has content and no script failed). If it fails it is marked bad (never
     downloaded or run again), dropped, and the built-in files load instead.
   - Images that are not in the built-in copy (new or changed) are shown from the update base.
   - If version.json names a newer APK build, a banner offers its download link in the browser.
   Testing: localStorage "tt-update-base" overrides the update base; window.__boot shows the state. */
(function () {
  "use strict";
  var W = window, D = document;
  var BASE_DEFAULT = "https://raw.githubusercontent.com/BitRazor/training/v2/";
  var K_STATE = "tt-update:state", K_BASE = "tt-update-base", K_LOG = "tt-update:log";
  var IDB_NAME = "tt-update", IDB_STORE = "bundles";
  var CONFIRM_AFTER_MS = 500;      /* a downloaded bundle must still be healthy this long after its scripts ran */
  var READ_TIMEOUT_MS = 6000;      /* give up reading a stored bundle after this and start the built-in files */
  var NATIVE_EDGE_TO_EDGE = false; /* false: inside the app the page sits between the status bar and the
                                      navigation bar (viewport-fit=cover is dropped), on the theme's background */
  var cap = W.Capacitor;
  var native = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  var errors = [];
  var info = { native: native, source: "built-in", version: null };

  function noop() {}
  function slice(x) { return Array.prototype.slice.call(x || []); }
  function msgOf(e) { return String((e && (e.message || e.why)) || e); }
  function whenParsed(fn) { if (D.readyState === "loading") D.addEventListener("DOMContentLoaded", fn); else fn(); }
  function inertStyles() { return slice(D.querySelectorAll("link[data-app-href]")); }
  function inertScripts() { return slice(D.querySelectorAll("script[data-app-src]")); }

  /* ---------- loading the files next to index.html (browser, or the copy inside the APK) ---------- */
  function loadLocalStyles() {
    inertStyles().forEach(function (tag) {
      var l = D.createElement("link");
      l.rel = "stylesheet";
      l.href = tag.getAttribute("data-app-href");
      l.setAttribute("blocking", "render");   /* inserted from <head>: no unstyled flash */
      tag.parentNode.insertBefore(l, tag.nextSibling);
    });
  }
  function loadLocalScripts(done) {
    var tags = inertScripts(), left = tags.length;
    if (!left) { done(); return; }
    tags.forEach(function (tag) {
      var s = D.createElement("script");
      s.src = tag.getAttribute("data-app-src");
      s.async = false;                          /* dynamic scripts still run in insertion order */
      s.onload = s.onerror = function () { if (--left === 0) done(); };
      tag.parentNode.insertBefore(s, tag.nextSibling);
    });
  }

  if (!native) {
    loadLocalStyles();
    whenParsed(function () { loadLocalScripts(noop); });
    if (("serviceWorker" in navigator) && location.protocol.indexOf("http") === 0) {
      W.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(noop); });
    }
    W.__boot = info;
    return;
  }

  /* ================= everything below runs only inside the Android app ================= */
  W.addEventListener("error", function (e) {   /* script failures during start-up decide the rollback */
    var t = e && e.target;
    if (t === W || (t && t.tagName === "SCRIPT")) errors.push(e.message || ("could not load " + (t && t.src)));
  }, true);

  function log(msg) {
    try { console.log("[boot] " + msg); } catch (e) {}
    try {
      var a = JSON.parse(localStorage.getItem(K_LOG) || "[]");
      a.push(new Date().toISOString() + " " + msg);
      localStorage.setItem(K_LOG, JSON.stringify(a.slice(-40)));
    } catch (e) {}
  }
  function getState() {
    try { var s = JSON.parse(localStorage.getItem(K_STATE)); return (s && typeof s === "object") ? s : {}; } catch (e) { return {}; }
  }
  function setState(s) { try { localStorage.setItem(K_STATE, JSON.stringify(s)); } catch (e) {} }
  function isBad(s, v) { return (s.bad || []).indexOf(v) >= 0; }
  function markBad(s, v) { if (!isBad(s, v)) s.bad = (s.bad || []).concat([v]).slice(-20); }
  function updateBase() {
    var b = null;
    try { b = localStorage.getItem(K_BASE); } catch (e) {}
    b = (b && /^https?:\/\//.test(b)) ? b : BASE_DEFAULT;
    return b.charAt(b.length - 1) === "/" ? b : b + "/";
  }
  function cmpVer(a, b) {
    var x = String(a || "0").split("."), y = String(b || "0").split(".");
    for (var i = 0; i < Math.max(x.length, y.length); i++) {
      var d = (parseInt(x[i], 10) || 0) - (parseInt(y[i], 10) || 0);
      if (d) return d < 0 ? -1 : 1;
    }
    return 0;
  }
  function toInt(v) { var n = parseInt(v, 10); return isFinite(n) ? n : 0; }
  function canonical(text) { return String(text).replace(/^﻿/, "").replace(/\r\n/g, "\n"); }
  function sha256Text(text) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then(function (buf) {
      return Array.prototype.map.call(new Uint8Array(buf), function (b) { return (b < 16 ? "0" : "") + b.toString(16); }).join("");
    });
  }
  function getText(url, fresh) {
    return fetch(url, fresh ? { cache: "no-store" } : {}).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + " for " + url);
      return r.arrayBuffer();
    }).then(function (b) { return canonical(new TextDecoder("utf-8").decode(b)); });
  }
  function getJSON(url, fresh) { return getText(url, fresh).then(JSON.parse); }
  function validManifest(m) {
    return !!m && typeof m.version === "string" && /^\d+(\.\d+)*$/.test(m.version) && !!m.files &&
      typeof m.files["index.html"] === "string" &&
      Object.keys(m.files).every(function (p) { return /^[\w.\-\/]+$/.test(p) && p.indexOf("..") < 0 && /^[0-9a-f]{64}$/.test(m.files[p]); });
  }
  function appInfo() {
    try {
      if (cap.Plugins && cap.Plugins.App) return cap.Plugins.App.getInfo().then(function (i) { return i || {}; }, function () { return {}; });
    } catch (e) {}
    return Promise.resolve({});
  }

  /* ---------- IndexedDB: one record per downloaded version {version, manifest, files} ---------- */
  function idb(mode, fn) {
    return new Promise(function (resolve, reject) {
      var open = indexedDB.open(IDB_NAME, 1);
      open.onupgradeneeded = function () { open.result.createObjectStore(IDB_STORE); };
      open.onerror = function () { reject(open.error); };
      open.onsuccess = function () {
        var db = open.result, tx = db.transaction(IDB_STORE, mode), req = fn(tx.objectStore(IDB_STORE));
        tx.oncomplete = function () { db.close(); resolve(req ? req.result : undefined); };
        tx.onerror = tx.onabort = function () { db.close(); reject(tx.error); };
      };
    });
  }
  function idbGet(k) { return idb("readonly", function (s) { return s.get(k); }); }
  function idbPut(k, v) { return idb("readwrite", function (s) { return s.put(v, k); }); }
  function idbDel(k) { return idb("readwrite", function (s) { return s.delete(k); }); }
  function idbKeepOnly(keep) {
    return idb("readwrite", function (s) {
      var r = s.getAllKeys();
      r.onsuccess = function () { r.result.forEach(function (k) { if (keep.indexOf(k) < 0) s.delete(k); }); };
      return r;
    });
  }

  /* ---------- page furniture: veil, viewport, notices ---------- */
  function themeColor() {
    var m = D.querySelector('meta[name="theme-color"]'), c = m && m.getAttribute("content");
    return /^#[0-9a-fA-F]{3,8}$/.test(c || "") ? c : "#0c0f12";
  }
  function veil(on) {
    var v = D.getElementById("tt-veil");
    if (on && !v) {
      v = D.createElement("style");
      v.id = "tt-veil";
      v.textContent = "html{background:" + themeColor() + "}body{visibility:hidden}";
      (D.head || D.documentElement).appendChild(v);
    } else if (!on && v) v.parentNode.removeChild(v);
  }
  function fixViewport() {
    if (NATIVE_EDGE_TO_EDGE) return;
    slice(D.querySelectorAll('meta[name="viewport"]')).forEach(function (m) {
      var c = m.getAttribute("content") || "";
      var n = c.split(",").map(function (p) { return p.trim(); }).filter(function (p) { return p && !/^viewport-fit\s*=/.test(p); }).join(", ");
      if (n !== c) m.setAttribute("content", n);
    });
  }
  function showNotice(id, text, label, onGo) {
    var box = D.getElementById("tt-notices");
    if (!box) {
      box = D.createElement("div");
      box.id = "tt-notices";
      box.style.cssText = "position:fixed;left:10px;right:10px;top:calc(env(safe-area-inset-top,0px) + 62px);z-index:200;" +
        "display:flex;flex-direction:column;gap:8px;max-width:560px;margin:0 auto;pointer-events:none";
      D.body.appendChild(box);
    }
    var old = D.getElementById(id);
    if (old) old.parentNode.removeChild(old);
    var el = D.createElement("div"), t = D.createElement("span"), go = D.createElement("button"), later = D.createElement("button");
    el.id = id;
    el.className = "tt-notice";
    el.setAttribute("role", "status");
    el.style.cssText = "pointer-events:auto;display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:12px;" +
      "background:var(--card2,#1b232c);color:var(--tx,#e6edf3);border:1px solid var(--acc,#34d399);" +
      "font:600 14px/1.3 system-ui,sans-serif;box-shadow:0 8px 30px rgba(0,0,0,.45)";
    t.textContent = text;
    t.style.flex = "1";
    go.type = later.type = "button";
    go.className = "tt-notice-go";
    go.textContent = label;
    go.style.cssText = "border:0;border-radius:9px;padding:8px 12px;font:700 14px system-ui,sans-serif;background:var(--acc,#34d399);color:#06281c";
    later.className = "tt-notice-later";
    later.textContent = "Later";
    later.style.cssText = "border:0;background:none;color:inherit;opacity:.7;font:600 13px system-ui,sans-serif;padding:8px 4px";
    go.addEventListener("click", function (e) { e.stopPropagation(); onGo(); });
    later.addEventListener("click", function (e) { e.stopPropagation(); if (el.parentNode) el.parentNode.removeChild(el); });
    el.appendChild(t); el.appendChild(go); el.appendChild(later);
    box.appendChild(el);
  }

  /* ---------- running a downloaded bundle ---------- */
  function verifyBundle(b) {
    if (!b || !validManifest(b.manifest) || !b.files) return Promise.reject(new Error("the stored copy is incomplete"));
    return Promise.all(Object.keys(b.manifest.files).map(function (p) {
      if (typeof b.files[p] !== "string") throw new Error(p + " is missing from the stored copy");
      return sha256Text(b.files[p]).then(function (h) { if (h !== b.manifest.files[p]) throw new Error(p + " does not match its checksum"); });
    }));
  }
  /* images whose bytes differ from the APK's copy (or that it lacks) come from the update base */
  function remoteAssets(manifest, builtin) {
    var out = {}, mine = (builtin && builtin.assets) || {}, theirs = manifest.assets || {}, base = updateBase();
    Object.keys(theirs).forEach(function (p) { if (mine[p] !== theirs[p]) out[p] = base + p + "?v=" + String(theirs[p]).slice(0, 16); });
    return out;
  }
  function localKey(src) {
    if (!src || /^[a-z][a-z0-9+.\-]*:/i.test(src) || src.charAt(0) === "/") return null;
    return src.replace(/^\.\//, "").split(/[?#]/)[0];
  }
  function rewriteCss(css, remote) {
    return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, function (all, q, u) {
      var k = localKey(u.trim());
      return (k && remote[k]) ? "url(" + q + remote[k] + q + ")" : all;
    });
  }
  function watchImages(remote) {
    var fix = function (img) { var k = localKey(img.getAttribute("src")); if (k && remote[k]) img.setAttribute("src", remote[k]); };
    var scan = function (n) { if (n.tagName === "IMG") fix(n); if (n.querySelectorAll) slice(n.querySelectorAll("img[src]")).forEach(fix); };
    scan(D.body);
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        if (m.type === "attributes") { if (m.target.tagName === "IMG") fix(m.target); }
        else slice(m.addedNodes).forEach(function (n) { if (n.nodeType === 1) scan(n); });
      });
    }).observe(D.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
    /* safety net: an image this copy names but the APK lacks is tried once from the update base */
    W.addEventListener("error", function (e) {
      var img = e.target;
      if (!img || img.tagName !== "IMG" || img.getAttribute("data-tt-remote")) return;
      var k = localKey(img.getAttribute("src"));
      if (!k) return;
      img.setAttribute("data-tt-remote", "1");
      e.stopPropagation();   /* keeps the page's own onerror (which hides the picture) for a real miss */
      img.setAttribute("src", updateBase() + k);
    }, true);
  }
  function applyBundle(b, builtin) {
    var files = b.files, doc = new DOMParser().parseFromString(files["index.html"], "text/html");
    var remote = remoteAssets(b.manifest, builtin);
    var runnable = function (n) { return n.nodeName !== "SCRIPT" || n.hasAttribute("data-app-src"); };
    slice(doc.querySelectorAll("script")).forEach(function (s) { if (!runnable(s)) s.parentNode.removeChild(s); });
    slice(doc.documentElement.attributes).forEach(function (a) { D.documentElement.setAttribute(a.name, a.value); });
    slice(D.head.childNodes).forEach(function (n) { if (n.nodeName !== "SCRIPT" && n.id !== "tt-veil") D.head.removeChild(n); });
    slice(doc.head.childNodes).forEach(function (n) { D.head.appendChild(D.importNode(n, true)); });
    slice(doc.body.attributes).forEach(function (a) { D.body.setAttribute(a.name, a.value); });
    while (D.body.firstChild) D.body.removeChild(D.body.firstChild);
    slice(doc.body.childNodes).forEach(function (n) { D.body.appendChild(D.importNode(n, true)); });
    fixViewport();
    inertStyles().forEach(function (tag) {
      var p = tag.getAttribute("data-app-href");
      if (typeof files[p] !== "string") { errors.push("stylesheet " + p + " is not in the update"); return; }
      var st = D.createElement("style");
      st.setAttribute("data-app-style", p);
      st.textContent = rewriteCss(files[p], remote);
      tag.parentNode.insertBefore(st, tag.nextSibling);
    });
    watchImages(remote);
    inertScripts().forEach(function (tag) {
      var p = tag.getAttribute("data-app-src");
      if (typeof files[p] !== "string") { errors.push("script " + p + " is not in the update"); return; }
      var s = D.createElement("script");
      s.text = files[p] + "\n//# sourceURL=" + p;
      tag.parentNode.insertBefore(s, tag.nextSibling);   /* inline: runs right here, in order */
    });
    veil(false);
  }

  /* ---------- start-up check, rollback, update check ---------- */
  function healthy() {
    var m = D.querySelector('meta[name="app-health"]'), sel = (m && m.getAttribute("content")) || "#view-today", el = null;
    try { el = D.querySelector(sel); } catch (e) {}
    var rendered = !!(el && (el.children.length || el.textContent.trim()));
    return { ok: rendered && !errors.length, why: errors.length ? errors[0] : (rendered ? "" : sel + " stayed empty") };
  }
  function rollback(version, why) {
    var s = getState();
    markBad(s, version);
    if (s.active === version) { s.active = null; s.trying = false; s.confirmed = false; }
    if (s.next === version) s.next = null;
    setState(s);
    log("update " + version + " failed (" + why + "): marked bad, going back to the built-in files");
    idbDel(version).catch(noop).then(function () { W.location.reload(); });
  }
  function settle(version, builtinP) {
    setTimeout(function () {
      var h = healthy();
      if (version) {
        if (!h.ok) { rollback(version, h.why); return; }
        var s = getState();
        s.trying = false; s.confirmed = true;
        setState(s);
        log("update " + version + " started and rendered: confirmed");
      } else if (!h.ok) log("built-in start problem: " + h.why);
      builtinP.then(function (builtin) {
        var s = getState();
        idbKeepOnly([s.active, s.next].filter(Boolean)).catch(noop);
        return checkForUpdates(version || (builtin && builtin.version) || "0", builtin);
      }).catch(function (e) { log("update check failed: " + msgOf(e)); });
    }, CONFIRM_AFTER_MS);
  }
  function offerApk(remote, app) {
    var a = remote.apk;
    if (!a || !/^https:\/\//.test(a.url || "") || !app.build) return;
    if (toInt(a.build) > toInt(app.build)) {
      log("APK build " + a.build + " is available (installed: " + app.build + ")");
      showNotice("tt-apk", "A new version of the app is available.", "Download", function () { W.location.href = a.url; });
    }
  }
  function checkForUpdates(running, builtin) {
    var base = updateBase(), remote, current, s;
    return getJSON(base + "version.json?t=" + Date.now(), true).then(function (m) {
      if (!validManifest(m)) throw new Error("version.json at " + base + " is not valid");
      remote = m;
      return appInfo();
    }).then(function (app) {
      offerApk(remote, app);
      s = getState();
      var have = (s.next && cmpVer(s.next, running) > 0) ? s.next : running;
      if (cmpVer(remote.version, have) <= 0) { log("up to date: have " + have + ", " + base + " has " + remote.version); return; }
      if (isBad(s, remote.version)) { log("not taking " + remote.version + ": it failed before"); return; }
      if (remote.minApk && toInt(app.build) < toInt(remote.minApk)) { log(remote.version + " needs app build " + remote.minApk + " or newer"); return; }
      log("downloading " + remote.version + " from " + base);
      return (s.active ? idbGet(s.active).catch(noop) : Promise.resolve(null)).then(function (c) {
        current = (c && c.manifest && c.files) ? c : null;
        var files = {}, paths = Object.keys(remote.files), fetched = 0;
        var step = function (i) {
          if (i >= paths.length) return files;
          var p = paths[i], want = remote.files[p], text;
          if (current && current.manifest.files[p] === want) text = Promise.resolve(current.files[p]);
          else if (builtin && builtin.files && builtin.files[p] === want) text = getText(p);
          else { fetched++; text = getText(base + p + "?v=" + want.slice(0, 16), true); }
          return text.then(function (t) {
            t = canonical(t);
            return sha256Text(t).then(function (h) {
              if (h !== want) throw new Error(p + " does not match its checksum (got " + h.slice(0, 12) + ", want " + want.slice(0, 12) + ")");
              files[p] = t;
              return step(i + 1);
            });
          });
        };
        return Promise.resolve(step(0)).then(function (files) {
          return idbPut(remote.version, { version: remote.version, manifest: remote, files: files, savedAt: new Date().toISOString() }).then(function () {
            var s2 = getState();
            if (s2.next && s2.next !== remote.version && s2.next !== s2.active) idbDel(s2.next).catch(noop);
            s2.next = remote.version;
            setState(s2);
            log("update " + remote.version + " downloaded and checked (" + fetched + " changed files): applies at the next start");
            showNotice("tt-update", "Update ready.", "Restart", function () { W.location.reload(); });
          });
        });
      });
    });
  }

  /* ---------- launch ---------- */
  fixViewport();
  try { if (navigator.serviceWorker) navigator.serviceWorker.getRegistrations().then(function (rs) { rs.forEach(function (r) { r.unregister(); }); }).catch(noop); } catch (e) {}
  var st = getState();
  if (st.next) {   /* a downloaded update is waiting: it becomes the one to run */
    if (!isBad(st, st.next) && st.next !== st.active) {
      if (st.active) idbDel(st.active).catch(noop);
      log("applying update " + st.next);
      st.active = st.next; st.trying = false; st.confirmed = false;
    }
    st.next = null;
  }
  if (st.active && st.trying) {   /* it started last time and never got confirmed: it crashed or hung */
    log("update " + st.active + " did not finish starting last time: marked bad");
    markBad(st, st.active);
    idbDel(st.active).catch(noop);
    st.active = null; st.trying = false; st.confirmed = false;
  }
  setState(st);
  var builtinP = getJSON("version.json").catch(function () { return null; });
  W.__boot = info;
  info.state = getState;
  info.log = function () { try { return JSON.parse(localStorage.getItem(K_LOG) || "[]"); } catch (e) { return []; } };
  info.checkNow = function () { return builtinP.then(function (b) { return checkForUpdates(info.version || (b && b.version) || "0", b); }); };

  function startBuiltin() {
    info.source = "built-in";
    loadLocalStyles();
    builtinP.then(function (b) { info.version = b && b.version; });
    whenParsed(function () { loadLocalScripts(function () { settle(null, builtinP); }); });
  }

  if (!st.active) { startBuiltin(); return; }

  var version = st.active, decided = false;
  veil(true);
  var giveUp = function (why, how) {   /* how: "bad" = never again, "drop" = forget it, "retry" = try next launch */
    if (decided) return;
    decided = true;
    var s = getState();
    if (how === "bad") markBad(s, version);
    if (how !== "retry" && s.active === version) { s.active = null; s.confirmed = false; }
    s.trying = false;
    setState(s);
    if (how !== "retry") idbDel(version).catch(noop);
    log("not running update " + version + " (" + why + ")" + (how === "bad" ? ": marked bad" : ""));
    veil(false);
    startBuiltin();
  };
  var timer = setTimeout(function () { giveUp("reading it took too long", "retry"); }, READ_TIMEOUT_MS);
  Promise.all([idbGet(version), builtinP, new Promise(whenParsed)]).then(function (r) {
    var b = r[0], builtin = r[1];
    if (builtin && cmpVer(builtin.version, version) >= 0) throw { why: "the app's own copy " + builtin.version + " is as new", how: "drop" };
    if (!b) throw { why: "it is no longer stored", how: "drop" };
    return verifyBundle(b).then(function () { return [b, builtin]; }, function (e) { throw { why: msgOf(e), how: "bad" }; });
  }).then(function (r) {
    if (decided) return;
    decided = true;
    clearTimeout(timer);
    var s = getState();
    s.trying = true;   /* marked BEFORE it runs: if it crashes, the next launch knows */
    setState(s);
    info.source = "downloaded";
    info.version = version;
    try { applyBundle(r[0], r[1]); } catch (e) { rollback(version, "could not apply it: " + msgOf(e)); return; }
    settle(version, builtinP);
  }).catch(function (e) {
    clearTimeout(timer);
    giveUp(msgOf(e), (e && e.how) || "retry");
  });
})();
