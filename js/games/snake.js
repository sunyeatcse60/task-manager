/* games/snake.js - Snake (game loop, keyboard + swipe input, collision) */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const U = App.games.util;

  const COLS = 18, ROWS = 18, CELL = 20;
  const LEVELS = {
    easy: { ms: 150, wrap: true, speedup: false },
    medium: { ms: 112, wrap: false, speedup: false },
    hard: { ms: 85, wrap: false, speedup: true }
  };
  const DIRS = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

  App.games.register({
    id: "snake", name: "Snake", emoji: "🐍", tint: ["#4ade80", "#16a34a"], tag: "Arcade · Reflex",
    blurb: "Eat the apples, grow longer and don't crash.",
    how: "Steer the snake to eat apples. Every apple gives 10 points and makes the snake longer. The turn ends when you hit yourself. On Easy the snake wraps around the edges; on Medium and Hard the walls are deadly and Hard speeds up as you grow.",
    controls: "Arrow keys / WASD, swipe on the board, or the arrow pad.",
    type: "solo", arcade: true, difficulty: true, players: { min: 1, max: 4, def: 1 }, rounds: { min: 1, max: 5, def: 2 },
    mount: function (host, ctx) {
      const levelInfo = U.levelForRound(ctx.round, ctx.rounds, ctx.difficulty, 100);
      const level = levelInfo.level;
      const L0 = LEVELS[ctx.difficulty] || LEVELS.medium;
      const levelScale = U.levelMeta(level, ctx.difficulty, 100).scale;
      const L = { ...L0, ms: Math.max(48, L0.ms / levelScale) };
      const hud = U.hud(host);
      const cv = U.canvas(host, COLS * CELL, ROWS * CELL);
      const g = cv.ctx;
      let snake = [{ x: 9, y: 9 }, { x: 8, y: 9 }, { x: 7, y: 9 }];
      let dir = DIRS.right, queue = [], food = null, score = 0, acc = 0, ms = L.ms, alive = true, doneTimer = null, ended = false;

      function placeFood() {
        let p;
        do { p = { x: U.rand(COLS), y: U.rand(ROWS) }; } while (snake.some((s) => s.x === p.x && s.y === p.y));
        food = p;
      }
      function showHud() { hud.set([["Score", score], ["Level", level + "/100"], ["Best", Math.max(ctx.best, score)]]); }
      function turn(name) {
        const d = DIRS[name]; if (!d || !alive) return;
        const ref = queue.length ? queue[queue.length - 1] : dir;
        if (d.x + ref.x === 0 && d.y + ref.y === 0) return;   // no reversing
        if (d.x === ref.x && d.y === ref.y) return;
        if (queue.length < 2) queue.push(d);
      }
      function die() {
        alive = false;
        doneTimer = setTimeout(() => finish(), 800);
      }
      function finish() { if (ended) return; ended = true; ctx.finish(score); }

      function tick() {
        if (queue.length) dir = queue.shift();
        let hx = snake[0].x + dir.x, hy = snake[0].y + dir.y;
        if (L.wrap) { hx = (hx + COLS) % COLS; hy = (hy + ROWS) % ROWS; }
        else if (hx < 0 || hy < 0 || hx >= COLS || hy >= ROWS) { die(); return; }
        for (let i = 0; i < snake.length - 1; i++) if (snake[i].x === hx && snake[i].y === hy) { die(); return; }
        snake.unshift({ x: hx, y: hy });
        if (hx === food.x && hy === food.y) {
          score += 10 + level * 2;
          if (L.speedup) ms = Math.max(48, ms - 2.5);
          placeFood();
          showHud();
        } else snake.pop();
      }

      function draw() {
        for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
          g.fillStyle = (x + y) % 2 ? "#a7e8b9" : "#b9efc8";
          g.fillRect(x * CELL, y * CELL, CELL, CELL);
        }
        // apple
        g.fillStyle = "#ef4444";
        g.beginPath(); g.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2 + 1, CELL * 0.38, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#16a34a"; g.fillRect(food.x * CELL + CELL / 2 - 1, food.y * CELL + 2, 2, 5);
        // snake
        snake.forEach((s, i) => {
          g.fillStyle = alive ? (i === 0 ? "#0f5132" : (i % 2 ? "#1f7a46" : "#25905a")) : "#7a7a7a";
          U.round(g, s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2, i === 0 ? 7 : 5);
          g.fill();
        });
        const h = snake[0], cx = h.x * CELL + CELL / 2, cy = h.y * CELL + CELL / 2;
        g.fillStyle = "#fff";
        [-1, 1].forEach((k) => {
          g.beginPath();
          g.arc(cx + dir.x * 4 - dir.y * 4 * k, cy + dir.y * 4 + dir.x * 4 * k, 2.4, 0, Math.PI * 2);
          g.fill();
        });
      }

      const loop = U.loop((dt) => {
        if (alive) { acc += dt; while (acc >= ms && alive) { acc -= ms; tick(); } }
        draw();
      });
      const keys = U.keys({
        ArrowUp: () => turn("up"), ArrowDown: () => turn("down"), ArrowLeft: () => turn("left"), ArrowRight: () => turn("right"),
        w: () => turn("up"), s: () => turn("down"), a: () => turn("left"), d: () => turn("right")
      });
      const sw = U.swipe(cv.canvas, turn, 18);
      U.dpad(host, turn);

      placeFood(); showHud();
      return {
        destroy: function () { loop.stop(); keys.off(); sw.off(); clearTimeout(doneTimer); },
        end: function () { alive = false; finish(); }
      };
    }
  });
})();
