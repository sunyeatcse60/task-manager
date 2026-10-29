/* games/match3.js - Sweet Match (match-3 puzzle): swap, match, cascade, special candies */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const U = App.games.util;

  const N = 8;
  const MAX_LEVEL = 100;
  const LEVELS = {
    easy: { types: 4, moves: 25 },
    medium: { types: 5, moves: 20 },
    hard: { types: 6, moves: 18 }
  };
  const CANDY = ["🍬", "🍭", "🍩", "🍓", "🍪", "🍇"];

  function levelMeta(level, difficulty) {
    const base = LEVELS[difficulty] || LEVELS.medium;
    const lvl = Math.max(1, Math.min(MAX_LEVEL, Number(level) || 1));
    const typeStep = difficulty === "hard" ? 2 : 3;
    const moveStep = difficulty === "hard" ? 2 : 3;
    const types = Math.min(8, base.types + Math.floor((lvl - 1) / typeStep));
    const moves = Math.max(6, base.moves - Math.floor((lvl - 1) / moveStep));
    const target = 420 + (lvl - 1) * 180 + (difficulty === "hard" ? (lvl - 1) * 40 : 0);
    return { level: lvl, types: types, moves: moves, target: target };
  }
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const mk = (t) => ({ t: t, s: "", fall: 0 });

  /* ---------- pure board logic ---------- */
  function newGrid(T) {
    const g = [];
    for (let r = 0; r < N; r++) {
      g.push([]);
      for (let c = 0; c < N; c++) {
        let t;
        do { t = U.rand(T); }
        while ((c >= 2 && g[r][c - 1].t === t && g[r][c - 2].t === t) || (r >= 2 && g[r - 1][c].t === t && g[r - 2][c].t === t));
        g[r].push(mk(t));
      }
    }
    return g;
  }

  /* every horizontal / vertical run of 3 or more equal candies */
  function findRuns(g) {
    const runs = [];
    for (let r = 0; r < N; r++) {
      let c = 0;
      while (c < N) {
        const t = g[r][c].t; let e = c;
        if (t >= 0) while (e + 1 < N && g[r][e + 1].t === t) e++;
        if (t >= 0 && e - c >= 2) { const cells = []; for (let k = c; k <= e; k++) cells.push([r, k]); runs.push({ cells: cells, dir: "h" }); }
        c = e + 1;
      }
    }
    for (let c = 0; c < N; c++) {
      let r = 0;
      while (r < N) {
        const t = g[r][c].t; let e = r;
        if (t >= 0) while (e + 1 < N && g[e + 1][c].t === t) e++;
        if (t >= 0 && e - r >= 2) { const cells = []; for (let k = r; k <= e; k++) cells.push([k, c]); runs.push({ cells: cells, dir: "v" }); }
        r = e + 1;
      }
    }
    return runs;
  }

  function neighbors(r, c) {
    return [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].filter(([rr, cc]) => rr >= 0 && rr < N && cc >= 0 && cc < N);
  }

  function collectLinkedCluster(g, seedCells) {
    const seen = new Set();
    const queue = seedCells.slice();
    while (queue.length) {
      const [r, c] = queue.pop();
      const key = r + "," + c;
      if (seen.has(key)) continue;
      seen.add(key);
      const t = g[r][c].t;
      if (t < 0) continue;
      neighbors(r, c).forEach(([rr, cc]) => {
        const kk = rr + "," + cc;
        if (!seen.has(kk) && g[rr][cc].t === t) queue.push([rr, cc]);
      });
    }
    return [...seen].map((k) => { const p = k.split(","); return [+p[0], +p[1]]; });
  }

  /* striped candies clear their line, a rainbow caught in a blast clears one colour */
  function expand(g, clear) {
    const done = new Set();
    let changed = true;
    while (changed) {
      changed = false;
      Array.from(clear).forEach((k) => {
        if (done.has(k)) return;
        done.add(k);
        const p = k.split(","), r = +p[0], c = +p[1], s = g[r][c].s;
        const add = (rr, cc) => { const kk = rr + "," + cc; if (!clear.has(kk)) { clear.add(kk); changed = true; } };
        if (s === "h") for (let x = 0; x < N; x++) add(r, x);
        else if (s === "v") for (let y = 0; y < N; y++) add(y, c);
        else if (s === "b") {
          const present = [];
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x].t >= 0 && present.indexOf(g[y][x].t) < 0) present.push(g[y][x].t);
          const t = present.length ? present[U.rand(present.length)] : -1;
          for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (g[y][x].t === t) add(y, x);
        }
      });
    }
  }

  /* what disappears now and which special candies are born */
  function plan(g, hint) {
    const runs = findRuns(g), clear = new Set(), create = [];
    runs.forEach((run) => {
      const cluster = collectLinkedCluster(g, run.cells);
      cluster.forEach((p) => clear.add(p[0] + "," + p[1]));
      if (run.cells.length >= 4) {
        let pos = null;
        if (hint) for (let i = 0; i < hint.length && !pos; i++) if (run.cells.some((p) => p[0] === hint[i][0] && p[1] === hint[i][1])) pos = hint[i];
        if (!pos) pos = run.cells[Math.floor(run.cells.length / 2)];
        create.push({ r: pos[0], c: pos[1], len: run.cells.length, dir: run.dir, t: g[pos[0]][pos[1]].t });
      }
    });
    expand(g, clear);
    create.forEach((x) => clear.delete(x.r + "," + x.c));
    return { clear: clear, create: create };
  }

  /* drop candies down and fill the top with new ones */
  function gravity(g, T) {
    for (let c = 0; c < N; c++) {
      const col = [];
      for (let r = N - 1; r >= 0; r--) if (g[r][c]) col.push({ cell: g[r][c], from: r });
      let row = N - 1;
      col.forEach((x) => { x.cell.fall = row - x.from; g[row][c] = x.cell; row--; });
      for (; row >= 0; row--) { const n = mk(U.rand(T)); n.fall = row + 1; g[row][c] = n; }
    }
  }

  function hasMoves(g) {
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (g[r][c].s === "b") return true;
    const swapC = (a, b) => { const t = g[a[0]][a[1]]; g[a[0]][a[1]] = g[b[0]][b[1]]; g[b[0]][b[1]] = t; };
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const nb = [[r, c + 1], [r + 1, c]];
      for (let i = 0; i < nb.length; i++) {
        if (nb[i][0] >= N || nb[i][1] >= N) continue;
        swapC([r, c], nb[i]);
        const ok = findRuns(g).length > 0;
        swapC([r, c], nb[i]);
        if (ok) return true;
      }
    }
    return false;
  }

  App.games.register({
    id: "match3", name: "Sweet Match", emoji: "🍬", tint: ["#f9a8d4", "#db2777"], tag: "Puzzle · Match-3",
    blurb: "Swap sweets, make matches and chain big combos.",
    how: "Swap two neighbouring sweets to line up 3 or more of the same kind. Match 4 to make a striped sweet that clears a whole row or column. Match 5 to make a rainbow that clears every sweet of one colour. Chain reactions multiply your points. You only have a limited number of moves.",
    controls: "Tap a sweet and then a neighbour, or swipe a sweet.",
    type: "solo", difficulty: true, players: { min: 1, max: 4, def: 1 }, rounds: { min: 1, max: 5, def: 2 },
    mount: function (host, ctx) {
      const hud = U.hud(host);
      const msg = document.createElement("div"); msg.className = "m3-msg"; host.appendChild(msg);
      const board = document.createElement("div"); board.className = "m3-board"; host.appendChild(board);

      let level = 1;
      let T = levelMeta(level, ctx.difficulty).types;
      let targetScore = levelMeta(level, ctx.difficulty).target;
      let grid = newGrid(T);
      while (!hasMoves(grid)) grid = newGrid(T);
      let score = 0, moves = levelMeta(level, ctx.difficulty).moves, busy = false, over = false, dead = false, ended = false, sel = null, doneTimer = null, msgTimer = null;

      const showHud = () => hud.set([["Score", score], ["Moves", moves], ["Level", level + "/" + MAX_LEVEL]]);
      function say(t) { msg.textContent = t; clearTimeout(msgTimer); msgTimer = setTimeout(() => { msg.textContent = ""; }, 1500); }

      function nextLevel() {
        if (level >= MAX_LEVEL) {
          say("Max level reached! ⚡");
          over = true;
          setTimeout(finish, 900);
          return;
        }
        level += 1;
        const meta = levelMeta(level, ctx.difficulty);
        T = meta.types;
        targetScore = meta.target;
        moves = meta.moves;
        grid = newGrid(T);
        while (!hasMoves(grid)) grid = newGrid(T);
        render(); showHud();
        say("Level " + level + "! Electric surge!");
      }

      function render() {
        let h = "";
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const x = grid[r][c];
          const cls = "m3-cell" + (x.t >= 0 ? " t" + x.t : " bomb") + (x.s ? " s-" + x.s : "") + (x.fall ? " drop" : "") + (sel && sel[0] === r && sel[1] === c ? " sel" : "");
          h += '<div class="' + cls + '" data-r="' + r + '" data-c="' + c + '"' + (x.fall ? ' style="--d:' + x.fall + '"' : "") + "><span>" + (x.t >= 0 ? CANDY[x.t] : "🌈") + "</span></div>";
          x.fall = 0;
        }
        board.innerHTML = h;
      }
      function cell(r, c) { return board.querySelector('[data-r="' + r + '"][data-c="' + c + '"]'); }
      function swapCells(a, b) { const t = grid[a[0]][a[1]]; grid[a[0]][a[1]] = grid[b[0]][b[1]]; grid[b[0]][b[1]] = t; }
      function finish() { if (ended) return; ended = true; ctx.finish(score); }

      function sparkCells(cells) {
        cells.forEach((k) => {
          const q = k.split(",");
          const el = cell(+q[0], +q[1]);
          if (!el) return;
          el.classList.remove("spark", "boom");
          void el.offsetWidth;
          el.classList.add(cells.length > 5 ? "boom" : "spark");
        });
      }

      /* clear -> fall -> refill, repeated until the board is calm */
      async function settle(hint, forced) {
        let combo = 1, first = true;
        for (;;) {
          const p = first && forced ? forced : plan(grid, hint);
          first = false; hint = null;
          if (!p.clear.size) break;
          sparkCells([...p.clear]);
          p.clear.forEach((k) => { const q = k.split(","); const el = cell(+q[0], +q[1]); if (el) el.classList.add("clear"); });
          await sleep(260); if (dead) return;
          score += p.clear.size * 10 * combo + (p.create.length ? 20 : 0);
          if (combo > 1) say("Combo x" + combo + "!");
          else if (p.clear.size >= 9) say("Sweet! 🍬");
          p.clear.forEach((k) => { const q = k.split(","); grid[+q[0]][+q[1]] = null; });
          p.create.forEach((x) => { grid[x.r][x.c] = x.len >= 5 ? { t: -1, s: "b", fall: 0 } : { t: x.t, s: x.dir === "h" ? "v" : "h", fall: 0 }; });
          gravity(grid, T);
          render(); showHud();
          await sleep(340); if (dead) return;
          combo++;
        }
      }

      async function attempt(a, b) {
        if (busy || over) return;
        busy = true; sel = null;
        const A = grid[a[0]][a[1]], B = grid[b[0]][b[1]];
        swapCells(a, b); render();
        const bomb = A.s === "b" || B.s === "b";
        if (!bomb && findRuns(grid).length === 0) {
          await sleep(200); if (dead) return;
          swapCells(a, b); render();
          board.classList.add("shake"); setTimeout(() => board.classList.remove("shake"), 320);
          busy = false; return;
        }
        moves--; showHud();
        let forced = null;
        if (bomb) {
          const clear = new Set(), both = A.s === "b" && B.s === "b", target = A.s === "b" ? B : A;
          for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { const x = grid[r][c]; if (both || x === A || x === B || (x.t >= 0 && x.t === target.t)) clear.add(r + "," + c); }
          expand(grid, clear);
          forced = { clear: clear, create: [] };
        }
        await sleep(120); if (dead) return;
        await settle([a, b], forced); if (dead) return;
        if (moves <= 0) {
          if (score >= targetScore && level < MAX_LEVEL) {
            nextLevel();
            busy = false;
            return;
          }
          over = true; say("Out of moves!"); doneTimer = setTimeout(finish, 1000); busy = false; return;
        }
        if (score >= targetScore && level < MAX_LEVEL) {
          nextLevel();
          busy = false;
          return;
        }
        if (!hasMoves(grid)) {
          say("No moves left, shuffling...");
          do { grid = newGrid(T); } while (!hasMoves(grid));
          render();
        }
        busy = false;
      }

      function tap(r, c) {
        if (!sel) sel = [r, c];
        else if (sel[0] === r && sel[1] === c) sel = null;
        else if (Math.abs(sel[0] - r) + Math.abs(sel[1] - c) === 1) { attempt(sel, [r, c]); return; }
        else sel = [r, c];
        render();
      }

      let down = null;
      board.addEventListener("pointerdown", (e) => {
        const el = e.target.closest(".m3-cell"); if (!el) return;
        down = { r: +el.dataset.r, c: +el.dataset.c, x: e.clientX, y: e.clientY };
      });
      board.addEventListener("pointerup", (e) => {
        const d = down; down = null;
        if (!d || busy || over) return;
        const dx = e.clientX - d.x, dy = e.clientY - d.y;
        if (Math.max(Math.abs(dx), Math.abs(dy)) > 16) {
          const dr = Math.abs(dy) > Math.abs(dx) ? Math.sign(dy) : 0, dc = dr ? 0 : Math.sign(dx);
          const nr = d.r + dr, nc = d.c + dc;
          if (nr >= 0 && nr < N && nc >= 0 && nc < N) attempt([d.r, d.c], [nr, nc]);
          return;
        }
        tap(d.r, d.c);
      });
      board.addEventListener("pointercancel", () => { down = null; });

      render(); showHud();
      // exposed for automated tests
      host.__m3 = { grid: () => grid, setGrid: (g) => { grid = g; render(); }, attempt: attempt, moves: () => moves, score: () => score, busy: () => busy, N: N };
      return {
        destroy: function () { dead = true; clearTimeout(doneTimer); clearTimeout(msgTimer); },
        end: function () { over = true; finish(); }
      };
    }
  });
})();
