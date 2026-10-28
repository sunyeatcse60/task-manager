/* notebook.js - notes with colours, pinning, search and auto-save */
(function () {
  "use strict";
  const App = window.App; if (!App) return;
  const $ = App.$, store = App.store, esc = App.esc;

  const notesKey = (email) => "todo_notes_v1_" + email;
  const COLORS = 6;
  let notes = [];
  let query = "";
  let mounted = false;

  function load() { notes = App.user ? store.read(notesKey(App.user.email), []) : []; }
  function save() {
    if (!App.user) return true;
    const ok = store.write(notesKey(App.user.email), notes);
    if (!ok) App.toast("Could not save (storage full)");
    return ok;
  }
  App.notesCount = () => (App.user ? store.read(notesKey(App.user.email), []).length : 0);
  App.on("auth", load);

  function when(ts) {
    const d = new Date(ts), now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    return sameDay
      ? "Today " + d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
      : d.toLocaleDateString([], { month: "short", day: "numeric" });
  }
  const words = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

  /* ---------- list ---------- */
  function visible() {
    const q = query.toLowerCase();
    return notes
      .filter((n) => !q || n.title.toLowerCase().indexOf(q) !== -1 || n.body.toLowerCase().indexOf(q) !== -1)
      .sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
  }

  function renderList() {
    if (!mounted) return;
    const grid = $("nbGrid");
    $("nbCount").textContent = App.user ? notes.length + (notes.length === 1 ? " note" : " notes") : "Sign in to use";
    grid.innerHTML = "";
    if (!App.user) {
      grid.innerHTML = '<div class="state-card">' + App.icon("book", 40) + "<h4>Sign in to use your notebook</h4><p>Notes are saved to your account on this device.</p>" +
        '<button class="btn primary" id="nbSignin" type="button">Sign in / Sign up</button></div>';
      $("nbSignin").addEventListener("click", () => App.auth.open("signin"));
      $("nbNew").hidden = true;
      return;
    }
    $("nbNew").hidden = false;
    const list = visible();
    if (!list.length) {
      grid.innerHTML = '<div class="state-card plain">' + App.icon(query ? "search" : "book", 36) + "<p>" +
        (query ? 'No notes match "' + esc(query) + '"' : "Your notebook is empty.<br>Tap <b>New note</b> to write your first one.") + "</p></div>";
      return;
    }
    list.forEach((n) => {
      const c = document.createElement("button");
      c.type = "button";
      c.className = "note";
      c.dataset.c = String(n.color || 0);
      c.innerHTML =
        (n.pinned ? '<span class="pinned">' + App.icon("pin", 14) + "</span>" : "") +
        "<h4></h4><p></p><small></small>";
      c.querySelector("h4").textContent = n.title || "Untitled";
      c.querySelector("p").textContent = n.body.slice(0, 160) || "No text";
      c.querySelector("small").textContent = when(n.updated);
      c.addEventListener("click", () => openEditor(n));
      grid.appendChild(c);
    });
  }

  /* ---------- editor ---------- */
  function openEditor(existing) {
    const isNew = !existing;
    const n = existing || { id: App.uid(), title: "", body: "", color: 0, pinned: false, created: Date.now(), updated: Date.now() };
    let inserted = !isNew, deleted = false, t = null;

    const body = document.createElement("div");
    body.className = "note-editor";
    body.innerHTML =
      '<input class="note-title" type="text" maxlength="80" placeholder="Title" autocomplete="off">' +
      '<textarea class="note-body" placeholder="Start writing..."></textarea>' +
      '<div class="note-tools">' +
      '<div class="swatches">' + Array.from({ length: COLORS }, (_, i) => '<button type="button" class="sw" data-c="' + i + '" aria-label="Colour ' + (i + 1) + '"></button>').join("") + "</div>" +
      '<button type="button" class="mini pin-btn" title="Pin note">' + App.icon("pin", 18) + "</button>" +
      (isNew ? "" : '<button type="button" class="mini del-btn" title="Delete note">' + App.icon("trash", 18) + "</button>") +
      "</div>" +
      '<div class="note-meta"><span class="wc"></span><span class="ed"></span></div>';

    const m = App.modal({ title: isNew ? "New note" : "Edit note", body: body, cls: "note-pop", actions: [{ label: "Done", cls: "primary", value: "done" }] });
    const titleEl = body.querySelector(".note-title"), bodyEl = body.querySelector(".note-body");
    titleEl.value = n.title; bodyEl.value = n.body;
    m.el.dataset.c = String(n.color || 0);

    function refreshMeta() {
      body.querySelector(".wc").textContent = words(bodyEl.value) + " words · " + bodyEl.value.length + " chars";
      body.querySelector(".ed").textContent = isNew && !inserted ? "Not saved yet" : "Edited " + when(n.updated);
      body.querySelector(".pin-btn").classList.toggle("on", !!n.pinned);
      body.querySelectorAll(".sw").forEach((s) => s.classList.toggle("on", Number(s.dataset.c) === (n.color || 0)));
    }
    function persist() {
      if (deleted) return;
      n.title = titleEl.value; n.body = bodyEl.value; n.updated = Date.now();
      const empty = !n.title.trim() && !n.body.trim();
      if (empty) {
        if (inserted) { notes = notes.filter((x) => x.id !== n.id); inserted = false; save(); }
        return;
      }
      if (!inserted) { notes.push(n); inserted = true; }
      save();
    }
    function later() { clearTimeout(t); t = setTimeout(() => { persist(); refreshMeta(); }, 350); }

    titleEl.addEventListener("input", later);
    bodyEl.addEventListener("input", () => { later(); refreshMeta(); });
    body.querySelectorAll(".sw").forEach((s) => s.addEventListener("click", () => { n.color = Number(s.dataset.c); m.el.dataset.c = String(n.color); persist(); refreshMeta(); }));
    body.querySelector(".pin-btn").addEventListener("click", () => { n.pinned = !n.pinned; persist(); refreshMeta(); });
    const del = body.querySelector(".del-btn");
    if (del) del.addEventListener("click", async () => {
      const ok = await App.confirm({ title: "Delete this note?", text: "This can't be undone.", ok: "Delete", danger: true });
      if (!ok) return;
      deleted = true;
      notes = notes.filter((x) => x.id !== n.id);
      save(); m.close("deleted"); App.toast("Note deleted");
    });

    refreshMeta();
    setTimeout(() => (isNew ? titleEl : bodyEl).focus(), 60);
    m.result.then(() => { clearTimeout(t); persist(); renderList(); });
  }

  /* ---------- view ---------- */
  function mount(host) {
    load();
    mounted = true;
    host.innerHTML =
      '<section class="page wide page-notes">' +
      '<div class="page-head"><div><h2>Notebook</h2><p class="muted" id="nbCount"></p></div>' +
      '<button class="btn primary" id="nbNew" type="button">' + App.icon("plus", 18) + "<span>New note</span></button></div>" +
      '<div class="search" id="nbSearchBox"><span class="s-ic">' + App.icon("search", 18) + '</span><input id="nbSearch" type="text" placeholder="Search notes..." autocomplete="off">' +
      '<button id="nbSearchClear" type="button" aria-label="Clear search">' + App.icon("x", 16) + "</button></div>" +
      '<div class="note-grid" id="nbGrid"></div>' +
      "</section>";
    $("nbSearch").value = query;
    $("nbSearchBox").classList.toggle("has-text", !!query);
    $("nbNew").addEventListener("click", () => openEditor(null));
    $("nbSearch").addEventListener("input", (e) => { query = e.target.value.trim(); $("nbSearchBox").classList.toggle("has-text", !!e.target.value); renderList(); });
    $("nbSearchClear").addEventListener("click", () => { $("nbSearch").value = ""; query = ""; $("nbSearchBox").classList.remove("has-text"); renderList(); });
    renderList();
    return { destroy() { mounted = false; } };
  }

  App.views.notebook = { title: "Notebook", mount: mount };
})();
