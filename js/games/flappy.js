/* games/flappy.js - Flappy Bird (gravity, jump, moving obstacles) */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const U = App.games.util;

  const W = 320, H = 480, GROUND = 60, BIRD_X = 90, R = 12, PIPE_W = 54, SPACING = 200;
  const GRAVITY = 0.0016, FLAP = -0.43;
  const LEVELS = {
    easy: { gap: 175, speed: 0.10 },
    medium: { gap: 145, speed: 0.13 },
    hard: { gap: 122, speed: 0.17 }
  };

  App.games.register({
    id: "flappy", name: "Flappy Bird", emoji: "🐦", tint: ["#7dd3fc", "#0ea5e9"], tag: "Arcade · Timing",
    blurb: "Tap to flap through the gaps between the pipes.",
    how: "The bird falls with gravity. Tap to flap and fly through the gap in every pipe. Each pipe passed gives 10 points. Touching a pipe or the ground ends the turn.",
    controls: "Tap / click the board, Space or ↑ to flap.",
    type: "solo", arcade: true, difficulty: true, players: { min: 1, max: 4, def: 1 }, rounds: { min: 1, max: 5, def: 2 },
    mount: function (host, ctx) {
      const L = LEVELS[ctx.difficulty] || LEVELS.medium;
      const hud = U.hud(host);
      const cv = U.canvas(host, W, H);
      const g = cv.ctx;
      let y = H / 2 - 40, vy = 0, pipes = [], passed = 0, started = false, alive = true, t = 0, ground = 0, ended = false, doneTimer = null;

      const score = () => passed * 10;
      const showHud = () => hud.set([["Score", score()], ["Pipes", passed], ["Best", Math.max(ctx.best, score())]]);
      function addPipe(x) {
        const min = L.gap / 2 + 50, max = H - GROUND - L.gap / 2 - 50;
        pipes.push({ x: x, gapY: min + Math.random() * (max - min), passed: false });
      }
      function flap() {
        if (!alive) return;
        started = true;
        vy = FLAP;
      }
      function die() { if (!alive) return; alive = false; doneTimer = setTimeout(finish, 900); }
      function finish() { if (ended) return; ended = true; ctx.finish(score()); }

      function hits(p) {
        const topH = p.gapY - L.gap / 2, botY = p.gapY + L.gap / 2;
        const rect = (rx, ry, rw, rh) => {
          const cx = U.clamp(BIRD_X, rx, rx + rw), cy = U.clamp(y, ry, ry + rh);
          const dx = BIRD_X - cx, dy = y - cy;
          return dx * dx + dy * dy < R * R;
        };
        return rect(p.x, 0, PIPE_W, topH) || rect(p.x, botY, PIPE_W, H);
      }

      function update(dt) {
        t += dt;
        ground = (ground + (alive ? L.speed : 0) * dt) % 24;
        if (!started) { y = H / 2 - 40 + Math.sin(t / 220) * 6; return; }
        vy += GRAVITY * dt;
        y += vy * dt;
        if (y - R < 0) { y = R; vy = 0; }
        if (alive) {
          pipes.forEach((p) => { p.x -= L.speed * dt; });
          if (!pipes.length || pipes[pipes.length - 1].x < W - SPACING) addPipe(W + 30);
          pipes = pipes.filter((p) => p.x + PIPE_W > -10);
          pipes.forEach((p) => {
            if (!p.passed && p.x + PIPE_W < BIRD_X - R) { p.passed = true; passed++; showHud(); }
            if (hits(p)) die();
          });
        }
        if (y + R >= H - GROUND) { y = H - GROUND - R; die(); }
      }

      function draw() {
        const sky = g.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, "#7dd3fc"); sky.addColorStop(1, "#e0f2fe");
        g.fillStyle = sky; g.fillRect(0, 0, W, H);
        g.fillStyle = "rgba(255,255,255,.85)";
        [[50, 90, 22], [90, 96, 28], [130, 90, 20], [230, 160, 20], [262, 166, 26], [296, 160, 18]].forEach((c) => { g.beginPath(); g.arc(c[0], c[1], c[2], 0, Math.PI * 2); g.fill(); });
        pipes.forEach((p) => {
          const topH = p.gapY - L.gap / 2, botY = p.gapY + L.gap / 2;
          g.fillStyle = "#4ade80"; g.fillRect(p.x, 0, PIPE_W, topH); g.fillRect(p.x, botY, PIPE_W, H - botY);
          g.fillStyle = "#16a34a"; g.fillRect(p.x - 3, topH - 18, PIPE_W + 6, 18); g.fillRect(p.x - 3, botY, PIPE_W + 6, 18);
          g.fillStyle = "rgba(255,255,255,.28)"; g.fillRect(p.x + 6, 0, 6, topH - 18); g.fillRect(p.x + 6, botY + 18, 6, H);
        });
        g.fillStyle = "#d6b87a"; g.fillRect(0, H - GROUND, W, GROUND);
        g.fillStyle = "#86c15a"; g.fillRect(0, H - GROUND, W, 10);
        g.fillStyle = "#b99a5e";
        for (let x = -ground; x < W; x += 24) g.fillRect(x, H - GROUND + 22, 12, 6);
        // bird
        g.save();
        g.translate(BIRD_X, y);
        g.rotate(U.clamp(vy * 1.6, -0.5, 1.1));
        g.fillStyle = "#facc15"; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#f59e0b"; g.beginPath(); g.ellipse(-3, 3, 7, 4.5, -0.4, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(5, -4, 4.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#111"; g.beginPath(); g.arc(6.5, -4, 2, 0, Math.PI * 2); g.fill();
        g.fillStyle = "#ef4444"; g.beginPath(); g.moveTo(10, 0); g.lineTo(20, 3); g.lineTo(10, 6); g.closePath(); g.fill();
        g.restore();
        if (!started) {
          g.fillStyle = "rgba(0,0,0,.55)"; U.round(g, W / 2 - 90, 130, 180, 40, 12); g.fill();
          g.fillStyle = "#fff"; g.font = "bold 16px system-ui, sans-serif"; g.textAlign = "center"; g.fillText("Tap to flap!", W / 2, 156);
        }
        g.fillStyle = "#fff"; g.strokeStyle = "rgba(0,0,0,.45)"; g.lineWidth = 4;
        g.font = "bold 38px system-ui, sans-serif"; g.textAlign = "center";
        g.strokeText(String(score()), W / 2, 70); g.fillText(String(score()), W / 2, 70);
      }

      const loop = U.loop((dt) => { update(dt); draw(); });
      cv.canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); flap(); });
      const keys = U.keys({ " ": flap, ArrowUp: flap, w: flap });
      showHud();
      return {
        destroy: function () { loop.stop(); keys.off(); clearTimeout(doneTimer); },
        end: function () { alive = false; finish(); }
      };
    }
  });
})();
