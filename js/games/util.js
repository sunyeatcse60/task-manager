/* games/util.js - helpers shared by the games (canvas, loop, keys, swipe, d-pad, hud) */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const U = (App.games.util = {});

  U.rand = App.rand;
  U.shuffle = App.shuffle;
  U.clamp = App.clamp;

  U.levelMeta = function (level, difficulty, maxLevel) {
    const max = Number(maxLevel) || 100;
    const safe = Math.max(1, Math.min(max, Number(level) || 1));
    const t = (safe - 1) / (max - 1);
    const bias = difficulty === "hard" ? 1.28 : difficulty === "easy" ? 0.82 : 1;
    const scale = 1 + t * (difficulty === "hard" ? 1.8 : 1.4);
    return { level: safe, t: t, bias: bias, scale: scale, maxLevel: max };
  };

  U.levelForRound = function (round, totalRounds, difficulty, maxLevel) {
    const max = Number(maxLevel) || 100;
    const rounds = Math.max(1, Number(totalRounds) || 1);
    const safeRound = Math.max(1, Number(round) || 1);
    const t = (safeRound - 1) / Math.max(1, rounds - 1);
    const level = Math.max(1, Math.min(max, Math.round(1 + t * (max - 1))));
    return { ...U.levelMeta(level, difficulty, max), round: safeRound, totalRounds: rounds, t: t };
  };

  /* canvas that keeps a fixed logical size (W x H) and scales with the screen */
  U.canvas = function (host, W, H) {
    const wrap = document.createElement("div");
    wrap.className = "canvas-wrap";
    const c = document.createElement("canvas");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    c.className = "game-canvas";
    c.style.maxWidth = W + "px";
    c.style.aspectRatio = W + " / " + H;
    const ctx = c.getContext("2d");
    ctx.scale(dpr, dpr);
    wrap.appendChild(c);
    host.appendChild(wrap);
    return {
      canvas: c, ctx: ctx, W: W, H: H, wrap: wrap,
      toLocal: function (e) {
        const r = c.getBoundingClientRect();
        return { x: (e.clientX - r.left) * W / r.width, y: (e.clientY - r.top) * H / r.height };
      }
    };
  };

  /* requestAnimationFrame loop, step(dt in ms) */
  U.loop = function (step) {
    let id = 0, run = true, last = performance.now();
    function frame(t) {
      if (!run) return;
      const dt = Math.min(50, t - last);
      last = t;
      step(dt);
      id = requestAnimationFrame(frame);
    }
    id = requestAnimationFrame(frame);
    return { stop: function () { run = false; cancelAnimationFrame(id); } };
  };

  /* keyboard: map of key name -> handler. Ignores typing in inputs. */
  U.keys = function (map, onUp) {
    const norm = (e) => (e.key && e.key.length === 1 ? e.key.toLowerCase() : e.key);
    const typing = (t) => t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
    function down(e) {
      if (typing(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      const fn = map[norm(e)];
      if (fn) { e.preventDefault(); fn(e); }
    }
    function up(e) { if (onUp) { const fn = onUp[norm(e)]; if (fn) fn(e); } }
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return { off: function () { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); } };
  };

  /* swipe (touch or mouse drag) -> cb("left"|"right"|"up"|"down") */
  U.swipe = function (el, cb, min) {
    const need = min || 24;
    let sx = 0, sy = 0, active = false;
    el.style.touchAction = "none";
    function dn(e) { active = true; sx = e.clientX; sy = e.clientY; }
    function upf(e) {
      if (!active) return;
      active = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < need) return;
      if (Math.abs(dx) > Math.abs(dy)) cb(dx > 0 ? "right" : "left"); else cb(dy > 0 ? "down" : "up");
    }
    el.addEventListener("pointerdown", dn);
    el.addEventListener("pointerup", upf);
    el.addEventListener("pointercancel", () => { active = false; });
    return { off: function () { el.removeEventListener("pointerdown", dn); el.removeEventListener("pointerup", upf); } };
  };

  /* on-screen arrow pad */
  U.dpad = function (host, cb) {
    const d = document.createElement("div");
    d.className = "dpad";
    d.innerHTML = '<button type="button" data-d="up" aria-label="Up">' + App.icon("down", 22) + '</button>' +
      '<button type="button" data-d="left" aria-label="Left">' + App.icon("down", 22) + '</button>' +
      '<button type="button" data-d="down" aria-label="Down">' + App.icon("down", 22) + '</button>' +
      '<button type="button" data-d="right" aria-label="Right">' + App.icon("down", 22) + "</button>";
    d.addEventListener("pointerdown", (e) => { const b = e.target.closest("button"); if (b) { e.preventDefault(); cb(b.dataset.d); } });
    host.appendChild(d);
    return d;
  };

  /* small stats bar above the game: set([["Score", 10], ["Best", 40]]) */
  U.hud = function (host) {
    const el = document.createElement("div");
    el.className = "hud";
    host.appendChild(el);
    return {
      el: el,
      set: function (items) { el.innerHTML = items.map((it) => "<div><small>" + App.esc(it[0]) + "</small><b>" + App.esc(it[1]) + "</b></div>").join(""); }
    };
  };

  /* little rounded-rect path helper for canvas drawing */
  U.round = function (ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
})();
