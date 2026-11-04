"use strict";
/* native.js: the small bridge between the app and the Android shell (Capacitor 8). It runs first,
   before the tracker scripts, and every part has a browser fallback, so the same files work on
   GitHub Pages and in the jsdom tests. Capacitor injects its plugins as window.Capacitor.Plugins.

   Native.isApp            true inside the Android app
   Native.haptic(kind)     a short buzz: "light" (default) | "medium" | "heavy" | "success" | "warning" | "error"
                           (browsers: navigator.vibrate where it exists)
   Native.keepAwake(on)    keep the screen on (@capacitor-community/keep-awake; browsers: Screen Wake Lock)
   Native.backHandlers     the Android back button asks these in order; the first that returns true has
                           handled the press. Defaults: close the open modal, else go to Today, else leave
                           the app. A new overlay can add its own:  Native.backHandlers.unshift(fn)
   Export   the app's doExport() shares a File through navigator.share. An Android WebView has no Web
            Share, so inside the app this file supplies navigator.share/canShare backed by
            @capacitor/filesystem (writes the file to the app's cache) + @capacitor/share (opens the
            Android share sheet: Drive, Files, mail...). Browsers keep their own share and download.
   Import   the app's <input type="file"> opens Android's file picker through Capacitor. Inside the app
            the type filter is removed, so a backup that arrived as "text" or "binary" can still be
            picked; the app itself checks that the file is a training export.
   Status bar  light icons on the app's background colour (--bg, else <meta name="theme-color">). On
            Android 15+ the colour behind the bars comes from the APK theme (android/.../colors.xml). */
(function () {
  var W = window, D = document, cap = W.Capacitor;
  var isApp = !!(cap && typeof cap.isNativePlatform === "function" && cap.isNativePlatform());
  var P = (isApp && cap.Plugins) || {};
  function noop() {}
  function has(name) { return isApp && !!P[name] && (typeof cap.isPluginAvailable !== "function" || cap.isPluginAvailable(name)); }
  function define(obj, key, value) { try { Object.defineProperty(obj, key, { configurable: true, writable: true, value: value }); } catch (e) {} }
  function whenLoaded(fn) { if (D.readyState === "complete") setTimeout(fn, 0); else W.addEventListener("load", fn); }

  var lock = null, wantAwake = false;
  var Native = {
    isApp: isApp,
    haptic: function (kind) {
      kind = kind || "light";
      if (has("Haptics")) {
        var n = { success: "SUCCESS", warning: "WARNING", error: "ERROR" }[kind];
        return (n ? P.Haptics.notification({ type: n }) : P.Haptics.impact({ style: { medium: "MEDIUM", heavy: "HEAVY" }[kind] || "LIGHT" })).catch(noop);
      }
      try { if (navigator.vibrate) navigator.vibrate({ heavy: 30, medium: 20 }[kind] || 10); } catch (e) {}
      return Promise.resolve();
    },
    keepAwake: function (on) {
      wantAwake = !!on;
      if (has("KeepAwake")) return (on ? P.KeepAwake.keepAwake() : P.KeepAwake.allowSleep()).catch(noop);
      if (!on) { if (lock) { lock.release().catch(noop); lock = null; } return Promise.resolve(); }
      if (navigator.wakeLock && navigator.wakeLock.request) return navigator.wakeLock.request("screen").then(function (l) { lock = l; }).catch(noop);
      return Promise.resolve();
    },
    backHandlers: [
      function () { if (D.querySelector("#modal.open") && typeof W.closeModal === "function") { W.closeModal(); return true; } return false; },
      function () { if (W.ui && W.ui.view && W.ui.view !== "today" && typeof W.showView === "function") { W.showView("today"); return true; } return false; }
    ]
  };
  W.Native = Native;

  /* a browser drops the wake lock whenever the page is hidden: take it again on return */
  D.addEventListener("visibilitychange", function () { if (wantAwake && !has("KeepAwake") && D.visibilityState === "visible") Native.keepAwake(true); });

  if (!isApp) return;

  /* ---- Android back button ---- */
  if (has("App")) {
    P.App.addListener("backButton", function () {
      for (var i = 0; i < Native.backHandlers.length; i++) { try { if (Native.backHandlers[i]()) return; } catch (e) {} }
      P.App.exitApp();
    });
  }

  /* ---- export: Web Share for files, backed by Filesystem + Share ---- */
  if (has("Filesystem") && has("Share")) {
    define(navigator, "canShare", function (data) { return !!data && (!data.files || data.files.length > 0); });
    define(navigator, "share", function (data) {
      data = data || {};
      var f = data.files && data.files[0];
      if (!f) return P.Share.share({ title: data.title, text: data.text, url: data.url });
      var name = String(f.name || "training-export.json").replace(/[^\w.\-]+/g, "_");
      return f.text().then(function (text) {
        return P.Filesystem.writeFile({ path: name, data: text, directory: "CACHE", encoding: "utf8" });
      }).then(function (res) {
        return P.Share.share({ title: data.title || name, files: [res.uri], dialogTitle: data.title || "Save the backup" });
      }).catch(function (e) {
        var msg = String((e && e.message) || e);
        if (!/cancel/i.test(msg) && typeof W.toast === "function") W.toast("Could not share the file: " + msg);
        throw e;
      });
    });
  }

  /* ---- import: let the picker offer every file; the app checks the contents ---- */
  var picker = D.getElementById("importFile");
  if (picker) picker.removeAttribute("accept");

  /* ---- status bar: light icons on the app background ---- */
  function appBackground() {
    var c = "";
    try { c = getComputedStyle(D.documentElement).getPropertyValue("--bg").trim(); } catch (e) {}
    if (!/^#[0-9a-fA-F]{6}$/.test(c)) { var m = D.querySelector('meta[name="theme-color"]'); c = (m && m.getAttribute("content")) || ""; }
    return /^#[0-9a-fA-F]{6}$/.test(c) ? c : "#0c0f12";
  }
  whenLoaded(function () {
    if (!has("StatusBar")) return;
    P.StatusBar.setStyle({ style: "DARK" }).catch(noop);
    P.StatusBar.setBackgroundColor({ color: appBackground() }).catch(noop);   /* Android 14 and older */
  });
})();
