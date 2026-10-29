/* games/dino.js - Dino Runner (gravity, jump, obstacles, rising speed) */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const U = App.games.util;

  const W = 480, H = 220, GROUND = 176, DINO_X = 54;
  const GRAVITY = 0.0021, JUMP = -0.62;
  const LEVELS = {
    easy: { v0: 0.26, acc: 0.000010, gap: 400 },
    medium: { v0: 0.33, acc: 0.000018, gap: 350 },
    hard: { v0: 0.42, acc: 0.000030, gap: 310 }
  };

  App.games.register({
    id: "dino", name: "Dino Runner", emoji: "🦖", tint: ["#fdba74", "#f97316"], tag: "Arcade · Endless runner",
    blurb: "Run, jump over the cacti and go as far as you can.",
    how: "The dino runs by itself and gets faster the longer you survive. Jump over every cactus. Your score is the distance you run. One hit and the turn is over.",
    controls: "Tap / click the board, Space or ↑ to jump.",
    type: "solo", arcade: true, difficulty: true, players: { min: 1, max: 4, def: 1 }, rounds: { min: 1, max: 5, def: 2 },
    mount: function (host, ctx) {
      const levelInfo = U.levelForRound(ctx.round, ctx.rounds, ctx.difficulty, 100);
      const level = levelInfo.level;
      const L0 = LEVELS[ctx.difficulty] || LEVELS.medium;
      const levelScale = U.levelMeta(level, ctx.difficulty, 100).scale;
      const L = { ...L0, v0: L0.v0 * levelScale, gap: Math.max(180, L0.gap / levelScale) };
      const hud = U.hud(host);
      const cv = U.canvas(host, W, H);
      const g = cv.ctx;
      let y = GROUND, vy = 0, speed = L.v0, dist = 0, sinceObs = 0, nextGap = L.gap, obs = [], alive = true, ended = false, doneTimer = null, scroll = 0, lastShown = -1;
      const DW = 30, DH = 38;

      const score = () => Math.floor(dist / 10);
      function showHud() { const s = score(); if (s !== lastShown) { lastShown = s; hud.set([["Distance", s], ["Level", level + "/100"], ["Best", Math.max(ctx.best, s)]]); } }
      function jump() { if (alive && y >= GROUND) vy = JUMP; }
      function finish() { if (ended) return; ended = true; ctx.finish(score()); }
      function die() { alive = false; doneTimer = setTimeout(finish, 800); }

      function spawn() {
        const n = 1 + (Math.random() < 0.3 ? 1 : 0) + (Math.random() < 0.12 ? 1 : 0);
        const h = 30 + U.rand(18);
        obs.push({ x: W + 20, w: 18 * n, h: h, n: n });
        sinceObs = 0;
        nextGap = L.gap + U.rand(160) + speed * 220;
      }

      function update(dt) {
        scroll = (scroll + (alive ? speed : 0) * dt) % 40;
        if (!alive) { vy += GRAVITY * dt; y = Math.min(GROUND, y + vy * dt); return; }
        speed = Math.min(0.78, speed + L.acc * dt * U.levelMeta(level, ctx.difficulty, 100).scale);
        dist += speed * dt;
        vy += GRAVITY * dt;
        y += vy * dt;
        if (y >= GROUND) { y = GROUND; vy = 0; }
        sinceObs += speed * dt;
        if (sinceObs >= nextGap) spawn();
        obs.forEach((o) => { o.x -= speed * dt; });
        obs = obs.filter((o) => o.x + o.w > -20);
        const dx0 = DINO_X + 5, dx1 = DINO_X + DW - 4, dy0 = y - DH + 4, dy1 = y;
        for (const o of obs) {
          if (dx1 > o.x + 3 && dx0 < o.x + o.w - 3 && dy1 > GROUND - o.h + 4 && dy0 < GROUND) { die(); break; }
        }
        showHud();
      }

      function draw() {
        g.fillStyle = "#fff7ed"; g.fillRect(0, 0, W, H);
        g.fillStyle = "rgba(0,0,0,.07)";
        [[80, 40, 46], [260, 30, 56], [400, 56, 40]].forEach((c) => { g.beginPath(); g.ellipse(c[0] - (scroll * 0.3), c[1], c[2], 12, 0, 0, Math.PI * 2); g.fill(); });
        g.fillStyle = "#c2a679"; g.fillRect(0, GROUND, W, 3);
        g.fillStyle = "#e3d3b2";
        for (let x = -scroll; x < W; x += 40) g.fillRect(x, GROUND + 14, 14, 3);
        // cacti
        g.fillStyle = "#2f8f4e";
        obs.forEach((o) => {
          for (let i = 0; i < o.n; i++) {
            const cx = o.x + i * 18 + 3;
            U.round(g, cx + 3, GROUND - o.h, 8, o.h, 4); g.fill();
            U.round(g, cx - 3, GROUND - o.h * 0.62, 6, 10, 3); g.fill();
            U.round(g, cx + 11, GROUND - o.h * 0.5, 6, 10, 3); g.fill();
          }
        });
        // dino (drawn with shapes so it looks the same everywhere)
        const dy = y;
        g.fillStyle = alive ? "#374151" : "#9ca3af";
        U.round(g, DINO_X + 6, dy - 28, 22, 22, 6); g.fill();                 // body
        U.round(g, DINO_X + 16, dy - 40, 18, 16, 5); g.fill();                // head
        g.fillRect(DINO_X, dy - 20, 10, 6);                                    // tail
        const step = Math.floor(scroll / 6) % 2;
        g.fillRect(DINO_X + 10, dy - 8, 5, 8 - (y < GROUND ? 0 : step * 3));   // legs
        g.fillRect(DINO_X + 20, dy - 8, 5, 8 - (y < GROUND ? 0 : (1 - step) * 3));
        g.fillStyle = "#fff"; g.fillRect(DINO_X + 27, dy - 36, 4, 4);
        g.fillStyle = "#111"; g.fillRect(DINO_X + 29, dy - 35, 2, 2);
        g.fillStyle = "#111"; g.font = "bold 18px system-ui, sans-serif"; g.textAlign = "right";
        g.fillText(String(score()).padStart(5, "0"), W - 12, 28);
        if (!alive) { g.fillStyle = "rgba(0,0,0,.6)"; g.font = "bold 22px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("Game over", W / 2, 90); }
      }

      const loop = U.loop((dt) => { update(dt); draw(); });
      cv.canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); jump(); });
      const keys = U.keys({ " ": jump, ArrowUp: jump, w: jump });
      showHud();
      return {
        destroy: function () { loop.stop(); keys.off(); clearTimeout(doneTimer); },
        end: function () { alive = false; finish(); }
      };
    }
  });
})();
