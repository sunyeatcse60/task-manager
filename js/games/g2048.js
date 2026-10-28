/* games/g2048.js - 2048 (grid logic, array manipulation, swipe + keyboard) */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const U = App.games.util;

  const LEVELS = {
    easy: { n: 5, four: 0.10 },
    medium: { n: 4, four: 0.10 },
    hard: { n: 4, four: 0.35 }
  };

  /* slide one line to the start and merge equal neighbours once; returns the new line and the points gained */
  function slide(line) {
    const tiles = line.filter(Boolean);
    const out = [];
    let gained = 0;
    for (let i = 0; i < tiles.length; i++) {
      if (tiles[i] === tiles[i + 1]) { out.push(tiles[i] * 2); gained += tiles[i] * 2; i++; }
      else out.push(tiles[i]);
    }
    while (out.length < line.length) out.push(0);
    return { line: out, gained: gained };
  }

  App.games.register({
    id: "g2048", name: "2048", emoji: "🔢", tint: ["#fcd34d", "#d97706"], tag: "Puzzle · Numbers",
    blurb: "Slide and merge the tiles to build bigger numbers.",
    how: "Slide all tiles in one direction. When two tiles with the same number touch they merge into one with double the value. Every merge adds to your score. The turn ends when no more moves are possible (or when you press End turn).",
    controls: "Arrow keys / WASD, swipe on the board, or the arrow pad.",
    type: "solo", difficulty: true, players: { min: 1, max: 4, def: 1 }, rounds: { min: 1, max: 5, def: 2 },
    mount: function (host, ctx) {
      const L = LEVELS[ctx.difficulty] || LEVELS.medium;
      const N = L.n;
      const hud = U.hud(host);
      const boardEl = document.createElement("div");
      boardEl.className = "g2048-board";
      boardEl.style.setProperty("--n", N);
      host.appendChild(boardEl);

      let grid = Array.from({ length: N }, () => Array(N).fill(0));
      let score = 0, moves = 0, over = false, ended = false, doneTimer = null, fresh = null;

      function spawn() {
        const empty = [];
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (!grid[r][c]) empty.push([r, c]);
        if (!empty.length) return;
        const p = empty[U.rand(empty.length)];
        grid[p[0]][p[1]] = Math.random() < L.four ? 4 : 2;
        fresh = p[0] + "," + p[1];
      }
      const maxTile = () => Math.max.apply(null, grid.map((r) => Math.max.apply(null, r)));
      function showHud() { hud.set([["Score", score], ["Best tile", maxTile()], ["Moves", moves]]); }

      function render() {
        let html = "";
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const v = grid[r][c];
          html += '<div class="t2048 v' + (v > 2048 ? "big" : v) + (fresh === r + "," + c ? " pop" : "") + '" data-v="' + v + '">' + (v || "") + "</div>";
        }
        boardEl.innerHTML = html;
      }

      function canMove() {
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          if (!grid[r][c]) return true;
          if (c + 1 < N && grid[r][c] === grid[r][c + 1]) return true;
          if (r + 1 < N && grid[r][c] === grid[r + 1][c]) return true;
        }
        return false;
      }

      function move(dir) {
        if (over) return;
        let moved = false, gained = 0;
        const next = grid.map((row) => row.slice());
        for (let i = 0; i < N; i++) {
          let line = [];
          for (let j = 0; j < N; j++) {
            if (dir === "left") line.push(grid[i][j]);
            else if (dir === "right") line.push(grid[i][N - 1 - j]);
            else if (dir === "up") line.push(grid[j][i]);
            else line.push(grid[N - 1 - j][i]);
          }
          const res = slide(line);
          gained += res.gained;
          for (let j = 0; j < N; j++) {
            if (dir === "left") next[i][j] = res.line[j];
            else if (dir === "right") next[i][N - 1 - j] = res.line[j];
            else if (dir === "up") next[j][i] = res.line[j];
            else next[N - 1 - j][i] = res.line[j];
          }
        }
        for (let r = 0; r < N && !moved; r++) for (let c = 0; c < N; c++) if (next[r][c] !== grid[r][c]) { moved = true; break; }
        if (!moved) return;
        grid = next; score += gained; moves++;
        spawn(); render(); showHud();
        if (!canMove()) {
          over = true;
          boardEl.classList.add("over");
          doneTimer = setTimeout(finish, 900);
        }
      }
      function finish() { if (ended) return; ended = true; ctx.finish(score); }

      const keys = U.keys({
        ArrowLeft: () => move("left"), ArrowRight: () => move("right"), ArrowUp: () => move("up"), ArrowDown: () => move("down"),
        a: () => move("left"), d: () => move("right"), w: () => move("up"), s: () => move("down")
      });
      const sw = U.swipe(boardEl, move, 20);
      U.dpad(host, move);

      spawn(); spawn(); render(); showHud();
      // expose the grid for automated tests
      host.__grid = () => grid.map((r) => r.slice());
      return {
        destroy: function () { keys.off(); sw.off(); clearTimeout(doneTimer); },
        end: function () { over = true; finish(); }
      };
    }
  });
})();
