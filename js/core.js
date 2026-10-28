/* core.js - shared helpers: storage, events, icons, toast, modals, theme, router */
(function () {
  "use strict";
  if (window.__OTA_SKIP) return;   // a newer downloaded version is taking over

  const App = (window.App = {
    cfg: window.APP_CONFIG || {},
    views: {},
    user: null,
    version: Number("__APP_VERSION__"),          // NaN when opened as a plain file (dev)
    updateBase: "__UPDATE_BASE__"
  });

  const $ = (id) => document.getElementById(id);
  App.$ = $;
  App.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  App.html = (str) => { const t = document.createElement("template"); t.innerHTML = str.trim(); return t.content.firstElementChild; };
  App.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  App.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  App.rand = (n) => Math.floor(Math.random() * n);
  App.shuffle = (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = App.rand(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; };
  App.pad = (n) => String(n).padStart(2, "0");

  /* ---------- storage (never throws) ---------- */
  App.store = {
    read(key, fallback) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; } },
    write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; } },
    remove(key) { try { localStorage.removeItem(key); } catch (e) {} }
  };

  /* ---------- tiny event bus ---------- */
  const handlers = {};
  App.on = (name, fn) => { (handlers[name] = handlers[name] || []).push(fn); };
  App.emit = (name, data) => { (handlers[name] || []).slice().forEach((fn) => { try { fn(data); } catch (e) { if (window.console) console.error(e); } }); };

  /* ---------- icons ---------- */
  const ICONS = {
    menu: '<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>',
    tasks: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    gamepad: '<line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="15" cy="13" r="1"/><circle cx="18" cy="11" r="1"/><rect x="2" y="6" width="20" height="12" rx="4"/>',
    life: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/>',
    info: '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>',
    mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    sun: '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>',
    moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
    minus: '<line x1="5" y1="12" x2="19" y2="12"/>',
    search: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
    trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>',
    left: '<polyline points="15 18 9 12 15 6"/>',
    right: '<polyline points="9 18 15 12 9 6"/>',
    down: '<polyline points="6 9 12 15 18 9"/>',
    pin: '<path d="M12 17v5"/><path d="M5 17h14l-2-8V4H7v5z"/>',
    play: '<polygon points="5 3 19 12 5 21 5 3"/>',
    undo: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    mapPin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
    swap: '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/>',
    users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'
  };
  App.icon = (name, size) => {
    const s = size || 20;
    return '<svg class="ic" width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  };
  App.fillIcons = (root) => {
    (root || document).querySelectorAll("[data-icon]").forEach((el) => { el.innerHTML = App.icon(el.getAttribute("data-icon"), Number(el.getAttribute("data-size")) || 20); });
  };

  /* ---------- toast ---------- */
  let toastTimer;
  App.toast = (msg) => {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2300);
  };

  /* ---------- static overlays ---------- */
  App.openOverlay = (id) => { $(id).classList.add("open"); };
  App.closeOverlay = (id) => {
    const el = $(id);
    if (!el || !el.classList.contains("open")) return;
    el.classList.remove("open");
    App.emit("overlay:close", id);
  };
  const STATIC_OVERLAYS = ["taskOverlay", "authOverlay", "profileOverlay"];
  STATIC_OVERLAYS.forEach((id) => {
    $(id).addEventListener("click", (e) => { if (e.target === $(id)) App.closeOverlay(id); });
  });

  /* ---------- dynamic modals ---------- */
  const modalStack = [];
  App.modal = (opts) => {
    opts = opts || {};
    const ov = document.createElement("div");
    ov.className = "overlay open dyn";
    const pop = document.createElement("div");
    pop.className = "popup " + (opts.cls || "");
    pop.setAttribute("role", "dialog");
    pop.setAttribute("aria-modal", "true");
    pop.innerHTML =
      (opts.dismissable === false ? "" : '<button class="close-x" type="button" aria-label="Close">' + App.icon("x", 18) + "</button>") +
      (opts.title ? "<h3>" + App.esc(opts.title) + "</h3>" : "") +
      (opts.sub ? '<p class="sub">' + App.esc(opts.sub) + "</p>" : "") +
      '<div class="modal-body"></div>' +
      (opts.actions && opts.actions.length ? '<div class="modal-actions"></div>' : "");
    ov.appendChild(pop);
    document.body.appendChild(ov);
    const body = pop.querySelector(".modal-body");
    if (typeof opts.body === "string") body.innerHTML = opts.body; else if (opts.body) body.appendChild(opts.body);
    let done = false, resolveFn;
    const ctrl = { el: pop, body: body, result: new Promise((r) => { resolveFn = r; }) };
    ctrl.close = (value) => {
      if (done) return;
      done = true;
      const i = modalStack.indexOf(ctrl); if (i >= 0) modalStack.splice(i, 1);
      ov.remove();
      resolveFn(value);
    };
    ctrl.dismissable = opts.dismissable !== false;
    (opts.actions || []).forEach((a) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn block " + (a.cls || "ghost");
      b.textContent = a.label;
      b.addEventListener("click", () => { if (a.onClick) a.onClick(ctrl); if (!a.keep) ctrl.close(a.value); });
      pop.querySelector(".modal-actions").appendChild(b);
    });
    const x = pop.querySelector(".close-x");
    if (x) x.addEventListener("click", () => ctrl.close(null));
    ov.addEventListener("click", (e) => { if (e.target === ov && ctrl.dismissable) ctrl.close(null); });
    modalStack.push(ctrl);
    return ctrl;
  };

  App.confirm = (o) => App.modal({
    title: o.title, sub: o.text, cls: "confirm-pop", dismissable: o.dismissable,
    actions: [
      { label: o.ok || "OK", cls: o.danger ? "primary danger-fill" : "primary", value: true },
      { label: o.cancel || "Cancel", cls: "ghost", value: false }
    ]
  }).result.then((v) => v === true);

  App.pick = (o) => {
    const grid = document.createElement("div");
    grid.className = "pick-grid cols-" + (o.cols || 2);
    const m = App.modal({ title: o.title, sub: o.sub, body: grid, cls: "pick-pop", actions: o.noCancel ? [] : [{ label: o.cancel || "Cancel", cls: "ghost", value: null }], dismissable: !o.noCancel });
    (o.options || []).forEach((opt) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pick-btn" + (opt.cls ? " " + opt.cls : "");
      b.innerHTML = "<span>" + App.esc(opt.label) + "</span>" + (opt.sub ? "<small>" + App.esc(opt.sub) + "</small>" : "");
      if (opt.disabled) b.disabled = true;
      b.addEventListener("click", () => m.close(opt.value));
      grid.appendChild(b);
    });
    return m.result;
  };

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (modalStack.length) { const top = modalStack[modalStack.length - 1]; if (top.dismissable) top.close(null); return; }
    STATIC_OVERLAYS.forEach((id) => App.closeOverlay(id));
  });

  /* ---------- theme ---------- */
  const THEME_KEY = "todo_theme_v1";
  App.theme = {
    get() { return document.documentElement.dataset.theme === "dark" ? "dark" : "light"; },
    set(t) { document.documentElement.dataset.theme = t; App.store.write(THEME_KEY, t); App.emit("theme", t); },
    toggle() { App.theme.set(App.theme.get() === "dark" ? "light" : "dark"); },
    init() { document.documentElement.dataset.theme = App.store.read(THEME_KEY, "light"); }
  };
  App.theme.init();

  /* ---------- router (#/view/param/param) ---------- */
  const viewEl = $("view");
  let current = null;
  function parts() { return location.hash.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodeURIComponent); }
  function handle() {
    const p = parts();
    let name = p[0];
    if (!App.views[name]) name = "tasks";
    const params = p[0] === name ? p.slice(1) : [];
    if (current && current.inst && current.inst.destroy) { try { current.inst.destroy(); } catch (e) {} }
    viewEl.innerHTML = "";
    viewEl.scrollTop = 0;
    const def = App.views[name];
    current = { name: name, params: params, def: def, inst: null };
    App.emit("route", current);                 // highlights the menu + sets the default subtitle
    current.inst = def.mount(viewEl, params) || {};   // views may then refine the subtitle
  }
  App.go = (path) => {
    const target = "#/" + path;
    if (location.hash === target) handle(); else location.hash = target;
  };
  App.refresh = () => handle();
  App.current = () => current;
  App.start = () => { window.addEventListener("hashchange", handle); handle(); };
  App.setSub = (text) => { const el = $("brandSub"); if (el) el.textContent = text; };
})();
