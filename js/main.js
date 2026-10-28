/* main.js - boot the app */
(function () {
  "use strict";
  if (window.__OTA_SKIP) return;
  const App = window.App; if (!App) return;
  App.theme.init();
  App.auth.restore();
  App.shell.render();
  App.start();
  // the app started fine, so a just-installed update is good
  try {
    localStorage.removeItem("ota_pending");
    const v = localStorage.getItem("ota_toast");
    if (v) { localStorage.removeItem("ota_toast"); setTimeout(() => App.toast("Updated to version " + v + " ✨"), 400); }
  } catch (e) {}
  setTimeout(() => { if (App.updater) App.updater.check(false); }, 2000);
})();
