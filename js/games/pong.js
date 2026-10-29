/* games/pong.js - Pong (canvas drawing, ball movement, CPU opponent). Versus game. */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const U = App.games.util;

  const W = 320, H = 440, PW = 72, PH = 10, MARGIN = 14, BR = 7, WIN = 5;
  const LEVELS = {
    easy: { ball: 0.25, cpu: 0.15, err: 26 },
    medium: { ball: 0.31, cpu: 0.23, err: 12 },
    hard: { ball: 0.38, cpu: 0.34, err: 4 }
  };

  App.games.register({
    id: "pong", name: "Pong", emoji: "🏓", tint: ["#5eead4", "#0d9488"], tag: "Arcade · Versus",
    blurb: "Classic paddle duel. First to 5 points wins the match.",
    how: "Move your paddle to bounce the ball back. If the ball passes your paddle, your opponent scores. The first side to 5 points wins the round. Play against the computer or with a friend on the same screen.",
    controls: "Drag on the board or use ← → (and A D for player 2).",
    type: "versus", arcade: true, difficulty: true, players: { min: 1, max: 2, def: 1 }, rounds: { min: 1, max: 7, def: 3 },
    mount: function (host, ctx) {
      const levelInfo = U.levelForRound(ctx.round, ctx.rounds, ctx.difficulty, 100);
      const level = levelInfo.level;
      const L0 = LEVELS[ctx.difficulty] || LEVELS.medium;
      const L = { ...L0, ball: L0.ball * U.levelMeta(level, ctx.difficulty, 100).scale };
      const cpu = ctx.sides[1].isCpu;
      const hud = U.hud(host);
      const cv = U.canvas(host, W, H);
      const g = cv.ctx;
      // side 0 = bottom paddle, side 1 = top paddle
      const px = [W / 2, W / 2];
      const score = [0, 0];
      let ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 }, speed = L.ball, pause = 700, over = false, doneTimer = null, aim = 0, msg = "", held = {};
      let serveDir = ctx.first === 0 ? 1 : -1;       // +1 = towards bottom paddle (side 0)

      const showHud = () => hud.set([[ctx.sides[0].name, score[0]], ["Level", level + "/100"], [ctx.sides[1].name, score[1]]]);

      function serve() {
        const a = (Math.random() * 0.8 - 0.4);
        speed = L.ball;
        ball = { x: W / 2, y: H / 2, vx: Math.sin(a) * speed, vy: Math.cos(a) * speed * serveDir };
        aim = (Math.random() * 2 - 1) * L.err;
      }
      function point(side) {
        score[side]++;
        showHud();
        msg = ctx.sides[side].name + " scores!";
        if (score[side] >= WIN) { finish(side); return; }
        serveDir = side === 0 ? -1 : 1;              // the side that lost the point receives the serve
        ball = { x: W / 2, y: H / 2, vx: 0, vy: 0 };
        pause = 900;
      }
      function finish(winner) {
        if (over) return;
        over = true;
        msg = ctx.sides[winner === null ? 0 : winner].name + (winner === null ? " & " + ctx.sides[1].name + " draw" : " wins the match!");
        doneTimer = setTimeout(() => ctx.finish({ winner: winner, scores: score.slice() }), 1200);
      }

      function bounce(side, p) {
        const t = U.clamp((ball.x - p) / (PW / 2), -1, 1);
        speed = Math.min(L.ball * 1.8, speed * 1.045);
        const ang = t * 1.0;                           // radians off vertical
        ball.vx = Math.sin(ang) * speed;
        ball.vy = (side === 0 ? -1 : 1) * Math.cos(ang) * speed;
        aim = (Math.random() * 2 - 1) * L.err;
      }

      function update(dt) {
        // paddle movement from keys
        const k = 0.34 * dt;
        if (held.ArrowLeft) px[0] -= k;
        if (held.ArrowRight) px[0] += k;
        if (!cpu) { if (held.a) px[1] -= k; if (held.d) px[1] += k; }
        if (cpu && !over) {
          const toward = ball.vy < 0 || ctx.difficulty === "hard";
          const target = (toward && ball.vy !== 0 ? ball.x : W / 2) + aim;
          const d = target - px[1], m = L.cpu * dt;
          px[1] += Math.abs(d) < m ? d : Math.sign(d) * m;
        }
        px[0] = U.clamp(px[0], PW / 2, W - PW / 2);
        px[1] = U.clamp(px[1], PW / 2, W - PW / 2);

        if (over) return;
        if (pause > 0) { pause -= dt; if (pause <= 0) { msg = ""; serve(); } return; }

        ball.x += ball.vx * dt; ball.y += ball.vy * dt;
        if (ball.x < BR) { ball.x = BR; ball.vx = Math.abs(ball.vx); }
        if (ball.x > W - BR) { ball.x = W - BR; ball.vx = -Math.abs(ball.vx); }
        const yb = H - MARGIN - PH, yt = MARGIN + PH;
        if (ball.vy > 0 && ball.y + BR >= yb && ball.y - BR <= yb + PH && Math.abs(ball.x - px[0]) <= PW / 2 + BR) { ball.y = yb - BR; bounce(0, px[0]); }
        else if (ball.vy < 0 && ball.y - BR <= yt && ball.y + BR >= yt - PH && Math.abs(ball.x - px[1]) <= PW / 2 + BR) { ball.y = yt + BR; bounce(1, px[1]); }
        if (ball.y > H + 10) point(1);
        else if (ball.y < -10) point(0);
      }

      function draw() {
        g.fillStyle = "#0f3d3a"; g.fillRect(0, 0, W, H);
        g.strokeStyle = "rgba(255,255,255,.25)"; g.lineWidth = 2; g.setLineDash([10, 10]);
        g.beginPath(); g.moveTo(0, H / 2); g.lineTo(W, H / 2); g.stroke(); g.setLineDash([]);
        g.fillStyle = "rgba(255,255,255,.14)"; g.font = "bold 72px system-ui, sans-serif"; g.textAlign = "center";
        g.fillText(String(score[1]), W / 2, H / 2 - 40); g.fillText(String(score[0]), W / 2, H / 2 + 96);
        g.fillStyle = "#fb923c"; U.round(g, px[1] - PW / 2, MARGIN, PW, PH, 5); g.fill();
        g.fillStyle = "#4ade80"; U.round(g, px[0] - PW / 2, H - MARGIN - PH, PW, PH, 5); g.fill();
        g.fillStyle = "#fff"; g.beginPath(); g.arc(ball.x, ball.y, BR, 0, Math.PI * 2); g.fill();
        if (msg) { g.fillStyle = "rgba(0,0,0,.55)"; U.round(g, 30, H / 2 - 22, W - 60, 44, 12); g.fill(); g.fillStyle = "#fff"; g.font = "bold 16px system-ui, sans-serif"; g.fillText(msg, W / 2, H / 2 + 6); }
      }

      // pointer control: in 2-player mode the top half moves the top paddle and the bottom half the bottom one
      function move(e) {
        const p = cv.toLocal(e);
        if (cpu) px[0] = p.x; else if (p.y < H / 2) px[1] = p.x; else px[0] = p.x;
      }
      cv.canvas.addEventListener("pointerdown", (e) => { e.preventDefault(); move(e); });
      cv.canvas.addEventListener("pointermove", (e) => { if (e.pressed || e.buttons || e.pointerType === "touch") move(e); });
      const down = {}, up = {};
      ["ArrowLeft", "ArrowRight", "a", "d"].forEach((kn) => { down[kn] = () => { held[kn] = true; }; up[kn] = () => { held[kn] = false; }; });
      const keys = U.keys(down, up);

      const loop = U.loop((dt) => { update(dt); draw(); });
      showHud();
      return {
        destroy: function () { loop.stop(); keys.off(); clearTimeout(doneTimer); },
        end: function () { finish(score[0] === score[1] ? null : (score[0] > score[1] ? 0 : 1)); }
      };
    }
  });
})();
