/* games/memory.js - Memory Card Match (DOM, timer, pair matching) */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const U = App.games.util;

  const SYMBOLS = ["🍎", "🍌", "🍇", "🍒", "🍋", "🥝", "🍉", "🍍", "🥥", "🍑", "🥭", "🍓", "🍐", "🍊"];
  const LEVELS = {
    easy: { cols: 4, pairs: 6, secPerPair: 8 },
    medium: { cols: 4, pairs: 8, secPerPair: 7 },
    hard: { cols: 6, pairs: 12, secPerPair: 6 }
  };

  App.games.register({
    id: "memory", name: "Memory Match", emoji: "🧠", tint: ["#f9a8d4", "#ec4899"], tag: "Puzzle · Memory",
    blurb: "Flip the cards and find every matching pair.",
    how: "Flip two cards at a time. If they match they stay face up. Clear the whole board with as few moves and as little time as you can. Fewer moves and faster time give a higher score.",
    controls: "Tap or click a card.",
    type: "solo", difficulty: true, players: { min: 1, max: 4, def: 1 }, rounds: { min: 1, max: 5, def: 2 },
    mount: function (host, ctx) {
      const L = LEVELS[ctx.difficulty] || LEVELS.medium;
      const hud = U.hud(host);
      const deck = U.shuffle(SYMBOLS.slice(0, L.pairs).concat(SYMBOLS.slice(0, L.pairs)));
      const board = document.createElement("div");
      board.className = "mem-board";
      board.style.setProperty("--cols", L.cols);
      board.innerHTML = deck.map((s, i) =>
        '<button type="button" class="mem-card" data-i="' + i + '" data-sym="' + s + '" aria-label="Card ' + (i + 1) + '"><span class="face back">?</span><span class="face front">' + s + "</span></button>"
      ).join("");
      host.appendChild(board);

      let first = null, lock = false, moves = 0, matched = 0, seconds = 0, timer = null, finished = false, doneTimer = null;
      const showHud = () => hud.set([["Moves", moves], ["Time", seconds + "s"], ["Pairs", matched + "/" + L.pairs]]);

      function score() {
        const bonus = Math.max(0, L.pairs * L.secPerPair - seconds) * 5;
        const penalty = Math.max(0, moves - L.pairs) * 5;
        return Math.max(10, L.pairs * 100 + bonus - penalty);
      }
      function finish(pts) { if (finished) return; finished = true; clearInterval(timer); doneTimer = setTimeout(() => ctx.finish(pts), 900); }

      board.addEventListener("click", (e) => {
        const c = e.target.closest(".mem-card");
        if (!c || lock || finished || c.classList.contains("flip") || c.classList.contains("match")) return;
        if (!timer) timer = setInterval(() => { seconds++; showHud(); }, 1000);
        c.classList.add("flip");
        if (!first) { first = c; return; }
        moves++;
        const a = first; first = null;
        if (a.dataset.sym === c.dataset.sym) {
          a.classList.add("match"); c.classList.add("match");
          matched++;
          showHud();
          if (matched === L.pairs) { clearInterval(timer); hud.set([["Moves", moves], ["Time", seconds + "s"], ["Score", score()]]); finish(score()); }
        } else {
          lock = true;
          setTimeout(() => { a.classList.remove("flip"); c.classList.remove("flip"); lock = false; }, 700);
          showHud();
        }
      });

      showHud();
      return {
        destroy: function () { clearInterval(timer); clearTimeout(doneTimer); },
        end: function () { finish(matched * 50); }
      };
    }
  });
})();
