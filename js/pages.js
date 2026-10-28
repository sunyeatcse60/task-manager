/* pages.js - Support (FAQ), About Us, Contact */
(function () {
  "use strict";
  const App = window.App; if (!App) return;
  const esc = App.esc, cfg = App.cfg;

  const FAQ = [
    ["How do I add a task?", "Open Task Manager, type in the box at the bottom and tap +. Tap the clock button to also choose a priority and a due date. Tap a task to mark it done, the pencil to edit it."],
    ["Why do I need to sign in?", "Your tasks, notes and profile are saved to your account on this device. If you try to add something while signed out, the sign in window opens and your item is added right after you sign in."],
    ["How do I change my nickname or photo?", "Tap your avatar at the top right. Tap the camera icon to upload a photo straight away, or choose Edit profile to change your name, nickname and password. The nickname appears in the title, for example “Emon Tasks”."],
    ["How do the games work?", "Open Games, pick a card, then choose the difficulty, number of players, team names and rounds. Press Start game to play. Each team plays its turn in every round and the team with the most points wins. Use Exit at any time to leave."],
    ["How do I score a cricket match?", "Open Games → Cricket → New match. Enter team names, overs and players, choose the toss result, and start. Tap the run buttons for every ball, use Wd / Nb / Bye / LB for extras and Wicket for dismissals. Undo fixes a mistake and the Scorecard tab shows full batting and bowling figures."],
    ["How do I get a new version of the app?", "When a new version is published, an Update available window appears. Tap Update now and the new features load immediately. You can also check any time from Profile → Check for updates."],
    ["Can I use my account on another phone?", "Not yet. Accounts and data are stored only on the device you use. Cloud sync is a planned feature."],
    ["I forgot my password. What can I do?", "Because accounts live only on this device there is no email reset yet. You can create a new account with a different email, or contact support below."]
  ];

  /* ---------- Support ---------- */
  function mountSupport(host) {
    host.innerHTML =
      '<section class="page page-support">' +
      '<div class="hero-card"><div class="hero-ic">' + App.icon("life", 30) + "</div><div><h2>How can we help?</h2><p>Find quick answers below, or send us a message.</p></div></div>" +
      '<div class="search"><span class="s-ic">' + App.icon("search", 18) + '</span><input id="faqSearch" type="text" placeholder="Search help topics..." autocomplete="off"></div>' +
      '<div class="faq" id="faqList"></div>' +
      '<div class="panel center-panel"><h4>Still need help?</h4><p class="muted">Our team is happy to help with any question or problem.</p>' +
      '<button class="btn primary" id="supToContact" type="button">' + App.icon("mail", 18) + "<span>Contact us</span></button></div>" +
      "</section>";
    const list = document.getElementById("faqList");
    function render(q) {
      q = (q || "").toLowerCase();
      const items = FAQ.filter((f) => !q || f[0].toLowerCase().indexOf(q) !== -1 || f[1].toLowerCase().indexOf(q) !== -1);
      list.innerHTML = items.length ? items.map((f, i) =>
        '<div class="faq-item"><button class="faq-q" type="button" aria-expanded="false"><span>' + esc(f[0]) + "</span>" + App.icon("down", 18) + '</button><div class="faq-a"><p>' + esc(f[1]) + "</p></div></div>"
      ).join("") : '<div class="state-card plain">' + App.icon("search", 36) + "<p>No topics match your search.</p></div>";
    }
    list.addEventListener("click", (e) => {
      const q = e.target.closest(".faq-q");
      if (!q) return;
      const item = q.parentElement, open = !item.classList.contains("open");
      item.classList.toggle("open", open);
      q.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.getElementById("faqSearch").addEventListener("input", (e) => render(e.target.value));
    document.getElementById("supToContact").addEventListener("click", () => App.go("contact"));
    render("");
    return {};
  }

  /* ---------- About ---------- */
  function mountAbout(host) {
    const ver = isNaN(App.version) ? "dev" : "v" + App.version;
    const feats = [
      ["tasks", "Task Manager", "Priorities, due dates, overdue alerts, search and filters."],
      ["book", "Notebook", "Colour notes with pinning, search and auto-save."],
      ["gamepad", "Games", "Nine classic games with difficulty levels, teams and rounds."],
      ["trophy", "Cricket Scorer", "Ball-by-ball scoring with scorecard and commentary."]
    ];
    host.innerHTML =
      '<section class="page page-about">' +
      '<div class="about-hero"><div class="logo-badge">' + App.icon("check", 34) + "</div><h2>" + esc(cfg.appName || "My Tasks") + "</h2><p>" + esc(cfg.tagline || "") + '</p><span class="pill">Version ' + esc(ver) + "</span></div>" +
      '<div class="panel"><h4>About this app</h4><p>This app brings your daily planning, quick notes and fun together in one clean place. It runs fully on your device, works offline and updates itself when new features are published.</p></div>' +
      '<div class="feature-grid">' + feats.map((f) => '<div class="feature"><div class="f-ic">' + App.icon(f[0], 22) + "</div><b>" + f[1] + "</b><p>" + f[2] + "</p></div>").join("") + "</div>" +
      '<div class="panel dev-card"><div class="dev-ic">' + App.icon("user", 26) + "</div><div><small>Developed by</small><b>" + esc(cfg.developer || "Sunyeat Islam Emon") + "</b><p class=\"muted\">" + esc(cfg.developerRole || "Software Engineer") + "</p></div></div>" +
      '<p class="made-by">Developed by <b>' + esc(cfg.developer || "Sunyeat Islam Emon") + "</b>, " + esc(cfg.developerRole || "Software Engineer") + " · built with HTML, CSS and JavaScript</p>" +
      "</section>";
    return {};
  }

  /* ---------- Contact ---------- */
  function mountContact(host) {
    const rows = [
      ["mail", "Email", cfg.contactEmail, "mailto:" + cfg.contactEmail],
      ["phone", "Phone", cfg.contactPhone, "tel:" + String(cfg.contactPhone || "").replace(/[^+\d]/g, "")],
      ["globe", "Website", cfg.website, cfg.website],
      ["mapPin", "Address", cfg.address, ""]
    ];
    host.innerHTML =
      '<section class="page page-contact">' +
      '<div class="page-head"><div><h2>Contact us</h2><p class="muted">We usually reply within one or two days.</p></div></div>' +
      '<div class="contact-grid">' + rows.map((r) =>
        (r[3] ? '<a class="contact-card" href="' + esc(r[3]) + '" target="_blank" rel="noopener">' : '<div class="contact-card">') +
        '<div class="c-ic">' + App.icon(r[0], 20) + "</div><div><small>" + r[1] + "</small><b>" + esc(r[2] || "") + "</b></div>" + (r[3] ? "</a>" : "</div>")
      ).join("") + "</div>" +
      '<form class="panel" id="contactForm" novalidate><h4>Send a message</h4>' +
      '<div class="field"><label for="cName">Your name</label><input id="cName" type="text" autocomplete="name"></div>' +
      '<div class="field"><label for="cEmail">Your email</label><input id="cEmail" type="email" autocomplete="email"></div>' +
      '<div class="field"><label for="cTopic">Topic</label><select id="cTopic"><option>General question</option><option>Bug report</option><option>Feature request</option><option>Other</option></select></div>' +
      '<div class="field"><label for="cMsg">Message</label><textarea id="cMsg" rows="5" placeholder="Tell us how we can help..."></textarea></div>' +
      '<div class="err" id="cErr"></div><button class="btn primary block" type="submit">' + App.icon("mail", 18) + "<span>Send message</span></button>" +
      '<p class="muted small">This opens your email app with the message ready to send.</p></form>' +
      "</section>";
    const $ = (id) => document.getElementById(id);
    if (App.user) { $("cName").value = App.user.name; $("cEmail").value = App.user.email; }
    $("contactForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const name = $("cName").value.trim(), email = $("cEmail").value.trim(), msg = $("cMsg").value.trim();
      if (!name) { $("cErr").textContent = "Please enter your name."; return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { $("cErr").textContent = "Please enter a valid email address."; return; }
      if (msg.length < 5) { $("cErr").textContent = "Please write a short message."; return; }
      $("cErr").textContent = "";
      const subject = "[" + $("cTopic").value + "] " + (cfg.appName || "My Tasks");
      const body = msg + "\n\n— " + name + " (" + email + ")";
      window.location.href = "mailto:" + cfg.contactEmail + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
      App.toast("Opening your email app…");
    });
    return {};
  }

  App.views.support = { title: "Support", mount: mountSupport };
  App.views.about = { title: "About Us", mount: mountAbout };
  App.views.contact = { title: "Contact", mount: mountContact };
})();
