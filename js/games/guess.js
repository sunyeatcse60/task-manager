/* games/guess.js - Number Guessing (input handling, simple logic, hints) */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const U = App.games.util;

  const LEVELS = {
    easy: { max: 50, tries: 8, warm: true },
    medium: { max: 100, tries: 7, warm: true },
    hard: { max: 500, tries: 9, warm: false }
  };

  App.games.register({
    id: "guess", name: "Number Guess", emoji: "🎯", tint: ["#fde68a", "#f59e0b"], tag: "Logic · Numbers",
    blurb: "Find the secret number in as few tries as you can.",
    how: "The computer thinks of a secret number. After every guess you are told if the secret is higher or lower. Find it before you run out of tries. The earlier you find it, the more points you win (tries left + 1, times 100).",
    controls: "Type a number and press Enter.",
    type: "solo", difficulty: true, players: { min: 1, max: 4, def: 1 }, rounds: { min: 1, max: 5, def: 2 },
    mount: function (host, ctx) {
      const L = LEVELS[ctx.difficulty] || LEVELS.medium;
      const secret = 1 + U.rand(L.max);
      let left = L.tries, over = false, doneTimer = null;

      host.innerHTML =
        '<div class="guess">' +
        '<p class="guess-info">I am thinking of a number between <b>1</b> and <b>' + L.max + '</b>.<br>You have <b>' + L.tries + "</b> tries.</p>" +
        '<div class="tries" id="gTries"></div>' +
        '<form class="guess-form" id="gForm"><input id="gInput" type="number" inputmode="numeric" min="1" max="' + L.max + '" placeholder="Your guess" autocomplete="off"><button class="btn primary" type="submit">Guess</button></form>' +
        '<div class="guess-msg" id="gMsg">Make your first guess!</div>' +
        '<ul class="guess-log" id="gLog"></ul></div>';
      const $ = (id) => host.querySelector("#" + id);

      function drawTries() { $("gTries").innerHTML = Array.from({ length: L.tries }, (_, i) => '<span class="try' + (i < left ? " on" : "") + '"></span>').join(""); }
      function finish(pts) { if (over) return; over = true; $("gInput").disabled = true; doneTimer = setTimeout(() => ctx.finish(pts), 1500); }

      $("gForm").addEventListener("submit", (e) => {
        e.preventDefault();
        if (over) return;
        const v = Number($("gInput").value);
        if (!$("gInput").value || !Number.isInteger(v) || v < 1 || v > L.max) { $("gMsg").textContent = "Enter a whole number from 1 to " + L.max + "."; return; }
        left--; drawTries();
        const li = document.createElement("li");
        if (v === secret) {
          const pts = (left + 1) * 100;
          li.innerHTML = "<b>" + v + "</b><span>🎉 Correct!</span>"; li.className = "ok";
          $("gMsg").textContent = "You found it! +" + pts + " points";
          $("gLog").prepend(li);
          finish(pts);
          return;
        }
        const diff = Math.abs(v - secret);
        const dirText = v < secret ? "Too low ⬆" : "Too high ⬇";
        let hint = "";
        if (L.warm) hint = diff <= L.max * 0.05 ? " · 🔥 Very close" : diff <= L.max * 0.15 ? " · Warm" : " · Cold";
        li.innerHTML = "<b>" + v + "</b><span>" + dirText + hint + "</span>";
        $("gLog").prepend(li);
        $("gInput").value = "";
        if (left <= 0) {
          $("gMsg").textContent = "Out of tries! The number was " + secret + ".";
          finish(0);
        } else $("gMsg").textContent = dirText + hint + " · " + left + (left === 1 ? " try" : " tries") + " left";
        $("gInput").focus();
      });

      drawTries();
      setTimeout(() => { const i = $("gInput"); if (i) i.focus(); }, 80);
      return {
        destroy: function () { clearTimeout(doneTimer); },
        end: function () { $("gMsg").textContent = "You gave up. The number was " + secret + "."; finish(0); }
      };
    }
  });
})();
