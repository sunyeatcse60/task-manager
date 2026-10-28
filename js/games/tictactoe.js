/* games/tictactoe.js - Tic Tac Toe (arrays, loops, win check, minimax CPU) */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const U = App.games.util, esc = App.esc;

  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  function winnerOf(b) {
    for (let i = 0; i < LINES.length; i++) {
      const l = LINES[i];
      if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { mark: b[l[0]], line: l };
    }
    return null;
  }
  const isFull = (b) => b.every(Boolean);
  const other = (m) => (m === "X" ? "O" : "X");

  function minimax(b, turn, me, depth) {
    const w = winnerOf(b);
    if (w) return w.mark === me ? 10 - depth : depth - 10;
    if (isFull(b)) return 0;
    let best = turn === me ? -Infinity : Infinity;
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = turn;
      const sc = minimax(b, other(turn), me, depth + 1);
      b[i] = null;
      best = turn === me ? Math.max(best, sc) : Math.min(best, sc);
    }
    return best;
  }

  function cpuPick(b, mark, diff) {
    const empty = []; for (let i = 0; i < 9; i++) if (!b[i]) empty.push(i);
    const rnd = () => empty[U.rand(empty.length)];
    if (diff === "easy") return rnd();
    const tryWin = (m) => { for (const i of empty) { b[i] = m; const w = winnerOf(b); b[i] = null; if (w) return i; } return -1; };
    if (diff === "medium") {
      let m = tryWin(mark); if (m >= 0) return m;
      m = tryWin(other(mark)); if (m >= 0) return m;
      if (!b[4]) return 4;
      const corners = [0, 2, 6, 8].filter((i) => !b[i]);
      return corners.length ? corners[U.rand(corners.length)] : rnd();
    }
    let bestScore = -Infinity, picks = [];
    for (const i of empty) {
      b[i] = mark;
      const sc = minimax(b, other(mark), mark, 1);
      b[i] = null;
      if (sc > bestScore) { bestScore = sc; picks = [i]; } else if (sc === bestScore) picks.push(i);
    }
    return picks[U.rand(picks.length)];
  }

  App.games.register({
    id: "tictactoe", name: "Tic Tac Toe", emoji: "❌", tint: ["#a78bfa", "#6366f1"], tag: "Classic · Strategy",
    blurb: "Line up three in a row before your opponent does.",
    how: "Take turns placing X and O on the 3×3 board. The first to get three marks in a row, column or diagonal wins the round. A win earns 3 points, a draw 1 point.",
    controls: "Tap or click a square.",
    type: "versus", difficulty: true, players: { min: 1, max: 2, def: 1 }, rounds: { min: 1, max: 9, def: 3 },
    mount: function (host, ctx) {
      const marks = ["X", "O"];
      const board = Array(9).fill(null);
      let turn = ctx.first, over = false, timer = null;

      host.innerHTML =
        '<div class="ttt"><div class="ttt-status" id="tttStatus"></div><div class="ttt-board" id="tttBoard">' +
        Array.from({ length: 9 }, (_, i) => '<button type="button" class="ttt-cell" data-i="' + i + '" aria-label="Square ' + (i + 1) + '"></button>').join("") +
        '</div><div class="ttt-legend"><span class="x">X</span> ' + esc(ctx.sides[0].name) + ' &nbsp;·&nbsp; <span class="o">O</span> ' + esc(ctx.sides[1].name) + "</div></div>";
      const status = host.querySelector("#tttStatus");
      const cells = host.querySelectorAll(".ttt-cell");

      function say() { status.innerHTML = '<b class="' + marks[turn].toLowerCase() + '">' + marks[turn] + "</b> " + esc(ctx.sides[turn].name) + (ctx.sides[turn].isCpu ? " is thinking…" : "'s turn"); }
      function paint() { cells.forEach((c, i) => { c.textContent = board[i] || ""; c.className = "ttt-cell" + (board[i] ? " " + board[i].toLowerCase() : ""); }); }

      function finish(w) {
        over = true;
        if (w) w.line.forEach((i) => cells[i].classList.add("win"));
        const idx = w ? marks.indexOf(w.mark) : null;
        status.innerHTML = w ? "🏆 <b>" + esc(ctx.sides[idx].name) + "</b> wins!" : "🤝 It's a draw";
        timer = setTimeout(() => ctx.finish({ winner: idx, scores: idx === null ? [0, 0] : (idx === 0 ? [1, 0] : [0, 1]) }), 1400);
      }
      function place(i) {
        board[i] = marks[turn];
        paint();
        const w = winnerOf(board);
        if (w || isFull(board)) { finish(w); return; }
        turn = 1 - turn;
        say();
        if (ctx.sides[turn].isCpu) timer = setTimeout(cpu, 520);
      }
      function cpu() { if (over) return; place(cpuPick(board, marks[turn], ctx.difficulty)); }

      host.querySelector("#tttBoard").addEventListener("click", (e) => {
        const c = e.target.closest(".ttt-cell");
        if (!c || over || ctx.sides[turn].isCpu) return;
        const i = Number(c.dataset.i);
        if (!board[i]) place(i);
      });

      say(); paint();
      if (ctx.sides[turn].isCpu) timer = setTimeout(cpu, 600);
      return { destroy: function () { clearTimeout(timer); } };
    }
  });
})();
