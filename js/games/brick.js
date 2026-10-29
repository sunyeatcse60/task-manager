/* games/brick.js - Brick Breaker (canvas, ball physics, collisions, lives) */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const U = App.games.util;

  const W = 320, H = 440, COLS = 8, BH = 16, GAP = 4, TOP = 54, MARGIN = 8, PH = 10, BR = 6;
  const LEVELS = {
    easy: { rows: 4, paddle: 88, speed: 0.30, lives: 5 },
    medium: { rows: 5, paddle: 72, speed: 0.36, lives: 3 },
    hard: { rows: 6, paddle: 58, speed: 0.43, lives: 2 }
  };
  const ROW_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#8b5cf6"];

  App.games.register({
    id: "brick", name: "Brick Breaker", emoji: "🧱", tint: ["#fca5a5", "#ef4444"], tag: "Arcade · Canvas",
    blurb: "Bounce the ball and smash every brick.",
    how: "Move the paddle to keep the ball in play and break all the bricks. Each brick scores points, higher rows are worth more. You lose a life every time the ball falls. Clear the board to earn a bonus for lives left.",
    controls: "Drag on the board or use ← →. Tap / Space to launch.",
    type: "solo", arcade: true, difficulty: true, players: { min: 1, max: 4, def: 1 }, rounds: { min: 1, max: 5, def: 2 },
    mount: function (host, ctx) {
      const level = U.levelForRound(ctx.round, ctx.rounds, ctx.difficulty, 100).level;
      const L0 = LEVELS[ctx.difficulty] || LEVELS.medium;
      const L = { ...L0, rows: L0.rows + Math.min(6, Math.floor((level - 1) / 6)) };
      const hud = U.hud(host);
      const cv = U.canvas(host, W, H);
      const g = cv.ctx;
      const bw = (W - MARGIN * 2 - GAP * (COLS - 1)) / COLS;
      const bricks = [];
      for (let r = 0; r < L.rows; r++) for (let c = 0; c < COLS; c++) bricks.push({ x: MARGIN + c * (bw + GAP), y: TOP + r * (BH + GAP), r: r, alive: true });
      let alive = bricks.length, px = W / 2, lives = L.lives, score = 0, speed = L.speed, launched = false, ended = false, doneTimer = null, held = {};
      let ball = { x: W / 2, y: H - 40, vx: 0, vy: 0 };
      const py = H - 26;

      const showHud = () => hud.set([["Score", score], ["Level", level + "/100"], ["Best", Math.max(ctx.best, score)]]);
      function reset() { launched = false; speed = L.speed; ball = { x: px, y: py - BR - 1, vx: 0, vy: 0 }; }
      function launch() {
        if (launched || ended) return;
        launched = true;
        const a = (Math.random() * 0.9 - 0.45);
        ball.vx = Math.sin(a) * speed; ball.vy = -Math.cos(a) * speed;
      }
      function finish(pts) { if (ended) return; ended = true; doneTimer = setTimeout(() => ctx.finish(pts), 900); }

      function update(dt) {
        const k = 0.4 * dt;
        if (held.ArrowLeft || held.a) px -= k;
        if (held.ArrowRight || held.d) px += k;
        px = U.clamp(px, L.paddle / 2, W - L.paddle / 2);
        if (ended) return;
        if (!launched) { ball.x = px; ball.y = py - BR - 1; return; }

        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); }
        if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx); }
        if (ball.y < BR) { ball.y = BR; ball.vy = Math.abs(ball.vy); }

        if (ball.vy > 0 && ball.y + BR >= py && ball.y - BR <= py + PH && Math.abs(ball.x - px) <= L.paddle / 2 + BR) {
          const t = U.clamp((ball.x - px) / (L.paddle / 2), -1, 1);
          const sp = Math.hypot(ball.vx, ball.vy);
          ball.vx = Math.sin(t * 1.0) * sp; ball.vy = -Math.cos(t * 1.0) * sp;
          ball.y = py - BR;
        }
        for (const b of bricks) {
          if (!b.alive) continue;
          if (ball.x + BR > b.x && ball.x - BR < b.x + bw && ball.y + BR > b.y && ball.y - BR < b.y + BH) {
            b.alive = false; alive--;
            score += 10 + (L.rows - b.r) * 2;
            const ox = Math.min(ball.x + BR - b.x, b.x + bw - (ball.x - BR));
            const oy = Math.min(ball.y + BR - b.y, b.y + BH - (ball.y - BR));
            if (ox < oy) ball.vx = -ball.vx; else ball.vy = -ball.vy;
            const sp = Math.hypot(ball.vx, ball.vy) * 1.012;
            const n = Math.hypot(ball.vx, ball.vy) || 1;
            ball.vx = ball.vx / n * Math.min(sp, L.speed * 1.7); ball.vy = ball.vy / n * Math.min(sp, L.speed * 1.7);
            showHud();
            break;
          }
        }
        if (alive === 0) { score += lives * 50 + level * 20; showHud(); finish(score); return; }
        if (ball.y > H + 10) {
          lives--; showHud();
          if (lives <= 0) { finish(score); return; }
          reset();
        }
      }

      function draw() {
        g.fillStyle = "#1e1b3a"; g.fillRect(0, 0, W, H);
        bricks.forEach((b) => {
          if (!b.alive) return;
          g.fillStyle = ROW_COLORS[b.r % ROW_COLORS.length]; U.round(g, b.x, b.y, bw, BH, 4); g.fill();
          g.fillStyle = "rgba(255,255,255,.22)"; g.fillRect(b.x + 3, b.y + 2, bw - 6, 3);
        });
        g.fillStyle = "#4ade80"; U.round(g, px - L.paddle / 2, py, L.paddle, PH, 5); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(ball.x, ball.y, BR, 0, Math.PI * 2); g.fill();
        if (!launched && !ended) {
          g.fillStyle = "rgba(255,255,255,.85)"; g.font = "bold 14px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("Tap to launch", W / 2, py - 40);
        }
        if (ended) { g.fillStyle = "rgba(0,0,0,.55)"; U.round(g, 50, H / 2 - 24, W - 100, 48, 12); g.fill(); g.fillStyle = "#fff"; g.font = "bold 18px system-ui, sans-serif"; g.textAlign = "center"; g.fillText(alive === 0 ? "Board cleared!" : "Game over", W / 2, H / 2 + 6); }
      }

      function move(e) { px = cv.toLocal(e).x; }
      cv.canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); move(e); launch(); });
      cv.canvas.addEventListener("pointermove", (e) => { if (e.buttons || e.pointerType === "touch") move(e); });
      const down = {}, up = {};
      ["ArrowLeft", "ArrowRight", "a", "d"].forEach((kn) => { down[kn] = () => { held[kn] = true; }; up[kn] = () => { held[kn] = false; }; });
      down[" "] = launch; down.ArrowUp = launch;
      const keys = U.keys(down, up);

      const loop = U.loop((dt) => { update(dt); draw(); });
      reset(); showHud();
      return {
        destroy: function () { loop.stop(); keys.off(); clearTimeout(doneTimer); },
        end: function () { finish(score); }
      };
    }
  });
})();
