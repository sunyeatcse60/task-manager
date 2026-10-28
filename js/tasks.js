/* tasks.js - Task Manager (priority, due date, overdue, search, filters, edit) */
(function () {
  "use strict";
  const App = window.App; if (!App) return;
  const $ = App.$, store = App.store, esc = App.esc;

  const PRIOS = { high: "High", med: "Medium", low: "Low" };
  const tasksKey = (email) => "todo_tasks_v1_" + email;

  let todos = [];
  let filter = "all";
  let query = "";
  let mounted = false;
  let editingId = null;
  let sheetPrio = "med";
  let timer = null;

  /* ---------- data ---------- */
  function normalize(t) {
    return {
      id: t.id,
      text: String(t.text || ""),
      done: !!t.done,
      priority: PRIOS[t.priority] ? t.priority : "med",
      due: typeof t.due === "string" ? t.due : ""
    };
  }
  function load() { todos = App.user ? store.read(tasksKey(App.user.email), []).map(normalize) : []; }
  function save() {
    if (!App.user) return true;
    const ok = store.write(tasksKey(App.user.email), todos);
    if (!ok) App.toast("Could not save (storage full)");
    return ok;
  }
  const dueDate = (t) => { if (!t.due) return null; const d = new Date(t.due); return isNaN(d.getTime()) ? null : d; };
  const isOverdue = (t) => { const d = dueDate(t); return !t.done && !!d && d.getTime() < Date.now(); };

  function dueInfo(t) {
    const d = dueDate(t);
    if (!d) return null;
    const now = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const dayDiff = Math.round((startOf(d) - startOf(now)) / 86400000);
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    let text;
    if (dayDiff === 0) text = "Today, " + time;
    else if (dayDiff === 1) text = "Tomorrow, " + time;
    else if (dayDiff === -1) text = "Yesterday, " + time;
    else text = d.toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + time;
    const overdue = isOverdue(t);
    return { text: text, overdue: overdue, soon: !t.done && !overdue && dayDiff === 0 };
  }

  App.tasksStats = () => ({ total: todos.length, done: todos.filter((t) => t.done).length, overdue: todos.filter(isOverdue).length });
  App.on("auth", load);

  function matches(t) {
    if (query && t.text.toLowerCase().indexOf(query.toLowerCase()) === -1) return false;
    if (filter === "active") return !t.done;
    if (filter === "done") return t.done;
    if (filter === "overdue") return isOverdue(t);
    return true;
  }

  function badge(text, cls) {
    const s = document.createElement("span");
    s.className = "badge " + cls;
    s.textContent = text;
    return s;
  }

  /* ---------- render ---------- */
  function render() {
    if (!mounted) return;
    const list = $("tList");
    list.innerHTML = "";

    if (!App.user) {
      list.innerHTML = '<li class="state-card">' + App.icon("tasks", 40) + "<h4>Sign in to manage your tasks</h4><p>Your tasks are saved to your account on this device.</p>" +
        '<button class="btn primary" id="tSignin" type="button">Sign in / Sign up</button></li>';
      $("tSignin").addEventListener("click", () => App.auth.open("signin"));
    } else {
      const shown = todos.filter(matches);
      if (!shown.length) {
        let msg;
        if (query) msg = 'No tasks match "' + esc(query) + '"';
        else if (!todos.length) msg = "No tasks yet.<br>Add your first one below!";
        else if (filter === "overdue") msg = "Nothing overdue. Nice! 🎉";
        else msg = "Nothing in this tab";
        list.innerHTML = '<li class="state-card plain">' + App.icon(query ? "search" : "check", 36) + "<p>" + msg + "</p></li>";
      }
      shown.forEach((t) => {
        const li = document.createElement("li");
        li.className = "task" + (t.done ? " done" : "");
        li.dataset.p = t.priority;
        li.innerHTML =
          '<span class="check">' + App.icon("check", 14) + "</span>" +
          '<div class="body"><div class="label"></div><div class="meta"></div></div>' +
          '<button class="mini edit" title="Edit" aria-label="Edit task">' + App.icon("edit", 17) + "</button>" +
          '<button class="mini del" title="Delete" aria-label="Delete task">' + App.icon("trash", 17) + "</button>";
        li.querySelector(".label").textContent = t.text;
        const meta = li.querySelector(".meta");
        meta.appendChild(badge(PRIOS[t.priority], t.priority));
        const info = dueInfo(t);
        if (info) {
          if (info.overdue) meta.appendChild(badge("Overdue · " + info.text, "overdue"));
          else meta.appendChild(badge("⏰ " + info.text, info.soon ? "soon" : ""));
        }
        li.addEventListener("click", () => { t.done = !t.done; save(); render(); });
        li.querySelector(".edit").addEventListener("click", (e) => { e.stopPropagation(); openSheet(t); });
        li.querySelector(".del").addEventListener("click", (e) => {
          e.stopPropagation();
          todos = todos.filter((x) => x.id !== t.id);
          save(); render();
        });
        list.appendChild(li);
      });
    }

    const done = todos.filter((t) => t.done).length;
    const overdue = todos.filter(isOverdue).length;
    const pct = todos.length ? Math.round(done / todos.length * 100) : 0;
    $("tCount").textContent = done + " of " + todos.length + " completed";
    $("tPercent").textContent = pct + "%" + (overdue ? " · " + overdue + " overdue" : "");
    $("tFill").style.width = pct + "%";
  }

  function addTask(task) {
    todos.unshift(task);
    save(); render();
    App.toast("Task added");
  }

  /* ---------- add / edit popup ---------- */
  function setPrio(p) {
    sheetPrio = p;
    document.querySelectorAll("#prioChips button").forEach((b) => b.classList.toggle("active", b.dataset.p === p));
  }
  const setSheetErr = (m) => { $("taskErr").textContent = m; };
  function toLocalInput(d) {
    const p = App.pad;
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function openSheet(task) {
    editingId = task ? task.id : null;
    $("taskTitle").textContent = task ? "Edit task" : "New task";
    $("taskSave").textContent = task ? "Save changes" : "Add task";
    const inp = $("tInput");
    $("tText").value = task ? task.text : (inp ? inp.value.trim() : "");
    $("tDue").value = task ? task.due : "";
    setPrio(task ? task.priority : "med");
    setSheetErr("");
    App.openOverlay("taskOverlay");
    setTimeout(() => $("tText").focus(), 60);
  }

  $("prioChips").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) setPrio(b.dataset.p); });
  $("taskClose").addEventListener("click", () => App.closeOverlay("taskOverlay"));
  $("quickDue").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    const q = b.dataset.q, d = new Date();
    if (q === "clear") { $("tDue").value = ""; return; }
    if (q === "today") { if (d.getHours() < 18) d.setHours(18, 0, 0, 0); else d.setHours(23, 59, 0, 0); }
    else { d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); }
    $("tDue").value = toLocalInput(d);
    setSheetErr("");
  });
  $("taskForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("tText").value.trim();
    const due = $("tDue").value;
    if (!text) return setSheetErr("Please enter a task.");
    if (due && isNaN(new Date(due).getTime())) return setSheetErr("Please enter a valid date and time.");

    if (editingId !== null) {
      const t = todos.find((x) => x.id === editingId);
      if (t) { t.text = text; t.priority = sheetPrio; t.due = due; save(); render(); App.toast("Task updated"); }
      editingId = null;
      App.closeOverlay("taskOverlay");
      return;
    }
    const task = { id: App.uid(), text: text, done: false, priority: sheetPrio, due: due };
    App.closeOverlay("taskOverlay");
    App.auth.require(() => { addTask(task); const i = $("tInput"); if (i) i.value = ""; }, "Your task will be added after you sign in.");
  });

  /* ---------- view ---------- */
  function mount(host) {
    load();
    mounted = true;
    host.innerHTML =
      '<section class="page page-tasks">' +
      '<div class="page-head"><div><h2>Task Manager</h2><p class="muted">Plan your day and track what is done.</p></div></div>' +
      '<div class="progress-card"><h2 id="tCount">0 of 0 completed</h2><div class="bar"><span id="tFill"></span></div><small id="tPercent">0%</small></div>' +
      '<div class="search" id="tSearchBox"><span class="s-ic">' + App.icon("search", 18) + '</span><input id="tSearch" type="text" placeholder="Search tasks..." autocomplete="off">' +
      '<button id="tSearchClear" type="button" aria-label="Clear search">' + App.icon("x", 16) + "</button></div>" +
      '<div class="filters" id="tFilters"><button data-f="all">All</button><button data-f="active">Active</button><button data-f="done">Done</button><button data-f="overdue">Overdue</button></div>' +
      '<ul class="task-list" id="tList"></ul>' +
      '<form class="add-bar" id="tAddForm"><input id="tInput" type="text" placeholder="Add a new task..." autocomplete="off" maxlength="120">' +
      '<button type="button" class="opt" id="tMore" title="Priority and due date" aria-label="Priority and due date">' + App.icon("clock", 22) + "</button>" +
      '<button type="submit" class="go" aria-label="Add task">' + App.icon("plus", 24) + "</button></form>" +
      "</section>";

    document.querySelectorAll("#tFilters button").forEach((b) => b.classList.toggle("active", b.dataset.f === filter));
    $("tSearch").value = query;
    $("tSearchBox").classList.toggle("has-text", !!query);

    $("tAddForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const text = $("tInput").value.trim();
      if (!text) { $("tInput").focus(); return; }
      const task = { id: App.uid(), text: text, done: false, priority: "med", due: "" };
      App.auth.require(() => { addTask(task); const i = $("tInput"); if (i) i.value = ""; }, "Your task will be added after you sign in.");
    });
    $("tMore").addEventListener("click", () => openSheet(null));
    $("tSearch").addEventListener("input", (e) => { query = e.target.value.trim(); $("tSearchBox").classList.toggle("has-text", !!e.target.value); render(); });
    $("tSearchClear").addEventListener("click", () => { $("tSearch").value = ""; query = ""; $("tSearchBox").classList.remove("has-text"); render(); $("tSearch").focus(); });
    $("tFilters").addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b) return;
      filter = b.dataset.f;
      document.querySelectorAll("#tFilters button").forEach((x) => x.classList.toggle("active", x === b));
      render();
    });

    render();
    timer = setInterval(render, 60000);
    return { destroy() { mounted = false; clearInterval(timer); } };
  }

  App.views.tasks = { title: "Task Manager", mount: mount };
})();
