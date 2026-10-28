/* updater.js - over-the-air updates: check version.json, download the new bundle, show the "Update now" popup */
(function () {
  "use strict";
  if (window.__OTA_SKIP) return;
  const App = window.App; if (!App) return;
  const $ = (id) => document.getElementById(id);
  const APP_VERSION = App.version, BASE = App.updateBase;
  const ON = !isNaN(APP_VERSION) && BASE.indexOf("http") === 0;
  let latest = null, dismissed = 0, checking = false;

  function show(info) {
    $("updateVer").textContent = "Version " + info.version;
    $("updateNotes").textContent = info.notes || "A new version of the app is ready.";
    $("updateErr").textContent = "";
    $("updateNow").disabled = false;
    $("updateNow").textContent = "Update now";
    App.openOverlay("updateOverlay");
  }

  async function check(manual) {
    if (!ON) { if (manual) App.toast("Updates work in the installed app"); return; }
    if (checking) return;
    checking = true;
    try {
      const res = await fetch(BASE + "version.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const info = await res.json();
      const v = Number(info.version);
      if (!(v > APP_VERSION)) { if (manual) App.toast("You're up to date ✅"); return; }
      latest = info;
      if (manual) App.closeOverlay("profileOverlay");
      if (manual || v > dismissed) show(info);
    } catch (e) {
      if (manual) App.toast("Couldn't check for updates");
    } finally { checking = false; }
  }

  async function apply() {
    if (!latest) return;
    const v = Number(latest.version);
    $("updateNow").disabled = true;
    $("updateNow").textContent = "Updating…";
    $("updateErr").textContent = "";
    try {
      const res = await fetch(BASE + "index.html?v=" + v + "&t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const html = await res.text();
      if (html.indexOf('Number("' + v + '")') === -1 || html.indexOf("</html>") === -1) {
        throw new Error("The new version isn't ready yet. Please try again in a minute.");
      }
      localStorage.setItem("ota_bundle", JSON.stringify({ version: v, html: html }));
      localStorage.removeItem("ota_pending");
      localStorage.setItem("ota_toast", String(v));
      location.reload();
    } catch (e) {
      $("updateErr").textContent = e && e.message && e.message.indexOf("isn't ready") !== -1 ? e.message : "Update failed. Check your internet and try again.";
      $("updateNow").disabled = false;
      $("updateNow").textContent = "Update now";
    }
  }

  $("updateNow").addEventListener("click", apply);
  $("updateLater").addEventListener("click", () => { if (latest) dismissed = Number(latest.version); App.closeOverlay("updateOverlay"); });
  $("checkUpdateBtn").addEventListener("click", () => check(true));
  document.addEventListener("visibilitychange", () => { if (!document.hidden) check(false); });
  App.updater = { check: check };
})();
