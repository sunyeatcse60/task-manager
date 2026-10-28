/* shell.js - top bar, side menu (drawer), theme button, brand title */
(function () {
  "use strict";
  const App = window.App; if (!App) return;
  const $ = App.$;

  const NAV = [
    { id: "tasks", icon: "tasks", label: "Task Manager" },
    { id: "notebook", icon: "book", label: "Notebook" },
    { id: "games", icon: "gamepad", label: "Games" },
    { sep: true },
    { id: "support", icon: "life", label: "Support" },
    { id: "about", icon: "info", label: "About Us" },
    { id: "contact", icon: "mail", label: "Contact" }
  ];

  function renderNav(active) {
    $("nav").innerHTML = NAV.map((n) => n.sep
      ? '<div class="nav-sep"></div>'
      : '<button class="nav-item' + (n.id === active ? " active" : "") + '" data-id="' + n.id + '" type="button">' + App.icon(n.icon, 20) + "<span>" + n.label + "</span></button>"
    ).join("");
  }

  function renderDrawerUser() {
    const box = $("drawerUser");
    const u = App.user;
    if (u) {
      box.innerHTML = '<button class="du-avatar avatar-btn" id="duAvatar" type="button" aria-label="Open profile"></button>' +
        '<div class="du-text"><b>' + App.esc(App.displayName()) + "</b><small>" + App.esc(u.email) + "</small></div>";
      App.paintAvatar($("duAvatar"), u.name, u.photo);
      $("duAvatar").addEventListener("click", () => { closeDrawer(); App.auth.openProfile(); });
    } else {
      box.innerHTML = '<div class="du-avatar avatar-btn guest">' + App.icon("user", 22) + "</div>" +
        '<div class="du-text"><b>Welcome, Guest</b><small>Sign in to save your data</small></div>' +
        '<button class="btn primary sm du-signin" id="duSignin" type="button">Sign in</button>';
      $("duSignin").addEventListener("click", () => { closeDrawer(); App.auth.open("signin"); });
    }
    const lo = $("drawerLogout");
    lo.hidden = !u;
    lo.innerHTML = App.icon("logout", 20) + "<span>Log out</span>";
    $("drawerVer").textContent = isNaN(App.version) ? "Dev build" : "Version " + App.version;
  }

  function updateBrand() {
    const title = App.user ? App.displayName() + " Tasks" : (App.cfg.appName || "My Tasks");
    $("brandTitle").textContent = title;
    document.title = title;
  }

  function updateAvatar() {
    const b = $("profileBtn");
    if (App.user) {
      b.classList.remove("guest");
      App.paintAvatar(b, App.user.name, App.user.photo);
    } else {
      b.classList.add("guest");
      b.classList.remove("has-photo");
      b.style.backgroundImage = "";
      b.innerHTML = App.icon("user", 22);
    }
  }

  function updateThemeBtn() { $("themeBtn").innerHTML = App.icon(App.theme.get() === "dark" ? "sun" : "moon", 20); }

  function openDrawer() { $("drawer").classList.add("open"); $("scrim").classList.add("show"); }
  function closeDrawer() { $("drawer").classList.remove("open"); $("scrim").classList.remove("show"); }

  function renderAll() { updateBrand(); updateAvatar(); renderDrawerUser(); updateThemeBtn(); }

  $("menuBtn").innerHTML = App.icon("menu", 22);
  document.querySelectorAll(".close-x").forEach((b) => { b.innerHTML = App.icon("x", 18); });
  $("menuBtn").addEventListener("click", openDrawer);
  $("scrim").addEventListener("click", closeDrawer);
  $("themeBtn").addEventListener("click", () => App.theme.toggle());
  $("profileBtn").addEventListener("click", () => App.auth.openProfile());
  $("drawerLogout").addEventListener("click", () => { closeDrawer(); App.auth.logout(); });
  $("nav").addEventListener("click", (e) => {
    const b = e.target.closest(".nav-item");
    if (!b) return;
    closeDrawer();
    App.go(b.dataset.id);
  });

  App.on("route", (r) => { renderNav(r.name); App.setSub(r.def.title || ""); closeDrawer(); });
  App.on("auth", () => { renderAll(); App.refresh(); });
  App.on("profile", renderAll);
  App.on("theme", updateThemeBtn);

  App.shell = { render: renderAll, openDrawer: openDrawer, closeDrawer: closeDrawer };
})();
