/* games/hub.js - game cards, setup (difficulty, players, team names, rounds), play loop, results */
(function () {
  "use strict";
  const App = window.App; if (!App) return;
  const $ = App.$, esc = App.esc, store = App.store;

  const list = [];
  const G = (App.games = { list: list, session: null, register: function (def) { list.push(def); } });
  const BEST_KEY = "games_best_v1", NAMES_KEY = "games_names_v1", LAST_KEY = "games_last_v1";
  const DIFFS = [["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]];
  const POINTS = { win: 3, draw: 1, loss: 0 };

  const bestAll = () => store.read(BEST_KEY, {});
  const bestFor = (id, d) => (bestAll()[id] || {})[d] || 0;
  const bestOverall = (id) => Math.max(0, ...Object.keys(bestAll()[id] || {}).map((k) => bestAll()[id][k]));
  function setBest(id, d, score) {
    const b = bestAll();
    b[id] = b[id] || {};
    if (score > (b[id][d] || 0)) { b[id][d] = score; store.write(BEST_KEY, b); return true; }
    return false;
  }
  const find = (id) => list.filter((g) => g.id === id)[0];
  const range = (g) => g.players ? g.players.min + "–" + g.players.max : "";
  const grad = (g) => "--g1:" + g.tint[0] + ";--g2:" + g.tint[1];
  const cover = (g) => '<img class="cover-art" src="assets/' + g.id + '.png" alt="' + esc(g.name) + '" loading="lazy" decoding="async">';

  /* ---------- 1. cards ---------- */
  function renderCards(host) {
    App.setSub("Games");
    const sorted = list.slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    host.innerHTML =
      '<section class="page wide page-games">' +
      '<div class="page-head"><div><h2>Games</h2><p class="muted">Pick a game, choose the difficulty and play with your teams.</p></div>' +
      '<span class="pill big">' + App.icon("trophy", 16) + " " + list.length + " games</span></div>" +
      '<div class="game-grid">' + sorted.map((g) => {
        const best = bestOverall(g.id);
        return '<button type="button" class="game-card' + (g.featured ? " featured" : "") + '" data-id="' + g.id + '" style="' + grad(g) + '">' +
          '<div class="art">' + cover(g) + (g.featured ? '<span class="ribbon">Featured</span>' : "") + "</div>" +
          '<div class="info"><h3>' + esc(g.name) + "</h3><p>" + esc(g.tag) + "</p>" +
          '<div class="meta"><span class="pill">' + (g.custom ? "Live scorer" : (g.players.max > 1 ? range(g) + " players" : "Solo")) + "</span>" +
          (best ? '<span class="pill best">★ ' + best + "</span>" : "") + "</div></div></button>";
      }).join("") + "</div></section>";
    host.querySelector(".game-grid").addEventListener("click", (e) => {
      const c = e.target.closest(".game-card");
      if (c) App.go("games/" + c.dataset.id);
    });
    return {};
  }

  /* ---------- 2. setup page ---------- */
  function renderSetup(host, game) {
    App.setSub("Games · " + game.name);
    G.session = null;
    const versus = game.type === "versus";
    const last = store.read(LAST_KEY, {})[game.id] || {};
    const saved = store.read(NAMES_KEY, []);
    const me = App.user ? App.displayName() : "";
    let diff = last.difficulty || "medium";
    let players = App.clamp(last.players || game.players.def, game.players.min, game.players.max);
    let rounds = App.clamp(last.rounds || game.rounds.def, game.rounds.min, game.rounds.max);
    const names = [];
    for (let i = 0; i < 8; i++) names[i] = saved[i] || (i === 0 && me ? me : "Team " + (i + 1));

    host.innerHTML =
      '<section class="page page-setup">' +
      '<button class="back-link" id="gBack" type="button">' + App.icon("left", 18) + "<span>All games</span></button>" +
      '<div class="setup-hero" style="' + grad(game) + '"><div class="sh-art">' + cover(game) + "</div><div><h2>" + esc(game.name) + "</h2><p>" + esc(game.blurb) + "</p></div></div>" +
      '<div class="setup-grid">' +
      '<div class="panel"><h4>How to play</h4><p>' + esc(game.how) + '</p><p class="controls">' + App.icon("gamepad", 16) + " <span>" + esc(game.controls) + "</span></p>" +
      '<div class="best-line" id="bestLine"></div></div>' +
      '<form class="panel" id="setupForm" novalidate>' +
      (game.difficulty ? '<div class="field"><label>Difficulty</label><div class="seg" id="segDiff"></div></div>' : "") +
      '<div class="field"><label id="playersLabel"></label><div id="playersCtl"></div></div>' +
      '<div class="field"><label>' + (versus ? "Player / team names" : "Team names") + '</label><div class="names" id="names"></div></div>' +
      '<div class="field"><label>' + (versus ? "Number of matches" : "Rounds") + '</label><div class="stepper" id="roundsCtl"></div>' +
      '<small class="hint">' + (versus ? "One match is played in every round." : "Every team plays once in each round.") + "</small></div>" +
      '<div class="actions"><button class="btn primary grow" type="submit">' + App.icon("play", 18) + "<span>Start game</span></button>" +
      '<button class="btn ghost grow" type="button" id="gCancel">Cancel</button></div>' +
      "</form></div></section>";

    function drawBest() {
      const b = game.difficulty ? bestFor(game.id, diff) : bestOverall(game.id);
      $("bestLine").innerHTML = !versus && b ? App.icon("trophy", 16) + " Best" + (game.difficulty ? " on " + diff : "") + ": <b>" + b + "</b>" : "";
    }
    function drawDiff() {
      const seg = $("segDiff"); if (!seg) return;
      seg.innerHTML = DIFFS.map((d) => '<button type="button" data-d="' + d[0] + '" class="' + (d[0] === diff ? "on" : "") + '">' + d[1] + "</button>").join("");
    }
    function drawPlayers() {
      const ctl = $("playersCtl");
      if (versus) {
        $("playersLabel").textContent = "Mode";
        ctl.innerHTML = '<div class="seg" id="segPlayers"><button type="button" data-n="1" class="' + (players === 1 ? "on" : "") + '">1 Player vs Computer</button>' +
          '<button type="button" data-n="2" class="' + (players === 2 ? "on" : "") + '">2 Players</button></div>';
      } else {
        $("playersLabel").textContent = "Players / teams (take turns)";
        ctl.innerHTML = '<div class="stepper"><button type="button" data-s="-1" ' + (players <= game.players.min ? "disabled" : "") + ' aria-label="Fewer">' + App.icon("minus", 18) + "</button>" +
          "<b>" + players + '</b><button type="button" data-s="1" ' + (players >= game.players.max ? "disabled" : "") + ' aria-label="More">' + App.icon("plus", 18) + "</button></div>";
      }
    }
    function drawNames() {
      const box = $("names");
      let html = "";
      for (let i = 0; i < players; i++) {
        html += '<label class="name-row"><span class="dot c' + i + '"></span><input type="text" maxlength="16" data-i="' + i + '" value="' + esc(names[i]) + '" placeholder="Team ' + (i + 1) + '" aria-label="Team ' + (i + 1) + ' name"></label>';
      }
      if (versus && players === 1) html += '<label class="name-row"><span class="dot c1"></span><input type="text" value="Computer" disabled aria-label="Computer"></label>';
      box.innerHTML = html;
    }
    function drawRounds() {
      $("roundsCtl").innerHTML = '<button type="button" data-s="-1" ' + (rounds <= game.rounds.min ? "disabled" : "") + ' aria-label="Fewer rounds">' + App.icon("minus", 18) + "</button><b>" + rounds + '</b><button type="button" data-s="1" ' + (rounds >= game.rounds.max ? "disabled" : "") + ' aria-label="More rounds">' + App.icon("plus", 18) + "</button>";
    }
    drawDiff(); drawPlayers(); drawNames(); drawRounds(); drawBest();

    $("gBack").addEventListener("click", () => App.go("games"));
    $("gCancel").addEventListener("click", () => App.go("games"));
    const seg = $("segDiff");
    if (seg) seg.addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { diff = b.dataset.d; drawDiff(); drawBest(); } });
    $("playersCtl").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      if (b.dataset.n) players = Number(b.dataset.n); else players = App.clamp(players + Number(b.dataset.s), game.players.min, game.players.max);
      drawPlayers(); drawNames();
    });
    $("roundsCtl").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      rounds = App.clamp(rounds + Number(b.dataset.s), game.rounds.min, game.rounds.max); drawRounds();
    });
    $("names").addEventListener("input", (e) => { const i = e.target.dataset.i; if (i !== undefined) names[Number(i)] = e.target.value; });

    $("setupForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const final = [];
      for (let i = 0; i < players; i++) {
        let n = (names[i] || "").trim() || "Team " + (i + 1);
        while (final.some((x) => x.toLowerCase() === n.toLowerCase())) n += " 2";
        final.push(n);
      }
      store.write(NAMES_KEY, final.concat(names.slice(final.length)));
      const l = store.read(LAST_KEY, {}); l[game.id] = { difficulty: diff, players: players, rounds: rounds }; store.write(LAST_KEY, l);
      startSession(game, { difficulty: diff, rounds: rounds, names: final, vsCpu: versus && players === 1 });
    });
    return {};
  }

  /* ---------- session ---------- */
  function startSession(game, o) {
    const versus = game.type === "versus";
    const sides = versus ? [o.names[0], o.vsCpu ? "Computer" : o.names[1]] : null;
    const turns = [];
    if (versus) { for (let r = 1; r <= o.rounds; r++) turns.push({ round: r }); }
    else { for (let r = 1; r <= o.rounds; r++) for (let p = 0; p < o.names.length; p++) turns.push({ round: r, p: p }); }
    G.session = {
      game: game, difficulty: o.difficulty, rounds: o.rounds, names: versus ? sides : o.names, vsCpu: !!o.vsCpu, versus: versus,
      turns: turns, ti: 0,
      scores: versus ? null : o.names.map(() => []),          // solo: per team, per round
      points: versus ? [0, 0] : null, goals: versus ? [0, 0] : null, matches: [],
      newBest: false
    };
    App.go("games/" + game.id + "/play");
  }

  const totals = (s) => s.versus ? s.points.slice() : s.scores.map((a) => a.reduce((x, y) => x + y, 0));

  /* ---------- 3. play ---------- */
  function renderPlay(host, game) {
    let s = G.session;
    if (!s || s.game !== game) { App.go("games/" + game.id); return {}; }
    App.setSub("Games · " + game.name);
    const timers = [];
    let live = null, ctxDone = false, gone = false;
    const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };

    host.innerHTML =
      '<section class="page page-play">' +
      '<div class="play-top"><button class="btn sm soft danger" id="pExit" type="button">' + App.icon("x", 16) + "<span>Exit</span></button>" +
      '<div class="pt-title"><b>' + esc(game.name) + '</b><small id="pSub"></small></div>' +
      '<button class="btn sm soft" id="pEnd" type="button" hidden>End turn</button></div>' +
      '<div class="scoreboard" id="pBoard"></div>' +
      '<div class="stage" id="pStage" style="' + grad(game) + '"></div></section>';
    const stage = $("pStage");

    function stopLive() { if (live && live.destroy) { try { live.destroy(); } catch (e) {} } live = null; $("pEnd").hidden = true; }
    function drawBoard(active) {
      const t = totals(s);
      $("pBoard").innerHTML = s.names.map((n, i) =>
        '<div class="sb-chip' + (i === active ? " active" : "") + '"><span class="dot c' + i + '"></span><div><b>' + esc(n) + "</b><small>" + (s.versus ? "Points" : "Total") + '</small></div><strong>' + t[i] + "</strong></div>"
      ).join("");
    }

    function showReady() {
      const turn = s.turns[s.ti];
      stopLive(); ctxDone = false;
      const who = s.versus ? s.names[0] + " vs " + s.names[1] : s.names[turn.p];
      $("pSub").textContent = "Round " + turn.round + " of " + s.rounds + (game.difficulty ? " · " + s.difficulty : "");
      drawBoard(s.versus ? -1 : turn.p);
      stage.innerHTML = '<div class="ready-card"><div class="rc-emoji">' + game.emoji + '</div><small>Round ' + turn.round + " of " + s.rounds + "</small><h3>" + esc(who) + "</h3>" +
        "<p>" + (s.versus ? "Get ready for the match!" : "It's your turn. Get ready!") + '</p><p class="controls">' + esc(game.controls) + '</p>' +
        '<button class="btn primary big" id="pStart" type="button">' + App.icon("play", 20) + "<span>Start</span></button></div>";
      $("pStart").addEventListener("click", () => countdown(turn));
    }

    function countdown(turn) {
      if (!game.arcade) { begin(turn); return; }
      let n = 3;
      const tick = () => {
        if (gone) return;
        stage.innerHTML = '<div class="countdown">' + (n || "Go!") + "</div>";
        if (n === 0) { later(() => begin(turn), 450); return; }
        n--; later(tick, 600);
      };
      tick();
    }

    function begin(turn) {
      if (gone) return;
      stage.innerHTML = "";
      const inner = document.createElement("div");
      inner.className = "stage-inner g-" + game.id;
      stage.appendChild(inner);
      const ctx = {
        difficulty: s.difficulty, round: turn.round, rounds: s.rounds, versus: s.versus,
        best: bestFor(game.id, s.difficulty),
        finish: (a, b) => { if (ctxDone || gone) return; ctxDone = true; later(() => onFinish(turn, a, b), 0); }
      };
      if (s.versus) {
        ctx.sides = [{ name: s.names[0], isCpu: false }, { name: s.names[1], isCpu: s.vsCpu }];
        ctx.first = (turn.round - 1) % 2;
      } else {
        ctx.player = { idx: turn.p, name: s.names[turn.p] };
        ctx.players = s.names;
      }
      drawBoard(s.versus ? -1 : turn.p);
      live = game.mount(inner, ctx) || {};
      $("pEnd").hidden = !live.end;
    }

    function onFinish(turn, a, info) {
      stopLive();
      let html, nextLabel;
      const last = s.ti >= s.turns.length - 1;
      if (s.versus) {
        const winner = a && a.winner !== undefined ? a.winner : null;
        const sc = (a && a.scores) || [0, 0];
        if (winner === null) { s.points[0] += POINTS.draw; s.points[1] += POINTS.draw; }
        else { s.points[winner] += POINTS.win; s.points[1 - winner] += POINTS.loss; }
        s.goals[0] += sc[0]; s.goals[1] += sc[1];
        s.matches.push({ round: turn.round, winner: winner, scores: sc });
        html = '<div class="rc-emoji">' + (winner === null ? "🤝" : "🏆") + "</div><small>Round " + turn.round + " result</small><h3>" +
          (winner === null ? "It's a draw!" : esc(s.names[winner]) + " wins!") + '</h3><div class="big-score">' + sc[0] + " – " + sc[1] + "</div>" +
          '<p class="muted">' + esc(s.names[0]) + " vs " + esc(s.names[1]) + "</p>";
      } else {
        const score = Math.max(0, Math.round(Number(a) || 0));
        s.scores[turn.p][turn.round - 1] = score;
        const nb = setBest(game.id, s.difficulty, score);
        if (nb) s.newBest = true;
        html = '<div class="rc-emoji">' + (nb ? "🌟" : "🏁") + "</div><small>" + esc(s.names[turn.p]) + " · Round " + turn.round + "</small><h3>" +
          esc(s.names[turn.p]) + " scored</h3>" + '<div class="big-score">' + score + "</div>" +
          (nb ? '<p class="new-best">New best score!</p>' : '<p class="muted">Best on ' + s.difficulty + ": " + bestFor(game.id, s.difficulty) + "</p>");
      }
      drawBoard(-1);
      if (last) nextLabel = "See results";
      else {
        const nt = s.turns[s.ti + 1];
        nextLabel = s.versus ? "Next match" : "Next: " + s.names[nt.p];
      }
      stage.innerHTML = '<div class="ready-card result">' + html + '<button class="btn primary big" id="pNext" type="button"><span>' + esc(nextLabel) + "</span>" + App.icon("right", 20) + "</button></div>";
      $("pNext").addEventListener("click", () => { if (last) renderResults(host, game); else { s.ti++; showReady(); } });
    }

    $("pExit").addEventListener("click", async () => {
      const ok = await App.confirm({ title: "Exit game?", text: "Your progress in this game will be lost.", ok: "Exit", cancel: "Keep playing", danger: true });
      if (ok) App.go("games");
    });
    $("pEnd").addEventListener("click", () => { if (live && live.end) live.end(); });

    showReady();
    return {
      destroy() {
        gone = true; timers.forEach(clearTimeout); stopLive();
        if (G.session === s) G.session = null;     // a restarted session (Play again) must survive
      }
    };
  }

  /* ---------- 4. results ---------- */
  function renderResults(host, game) {
    const s = G.session; if (!s) return;
    const t = totals(s);
    const order = t.map((v, i) => i).sort((a, b) => (t[b] - t[a]) || (s.versus ? (s.goals[b] - s.goals[a]) : 0));
    const topScore = t[order[0]];
    const leaders = order.filter((i) => t[i] === topScore && (!s.versus || s.goals[i] === s.goals[order[0]]));
    let banner;
    if (!s.versus && s.names.length === 1) banner = "Game complete! You scored " + t[0];
    else if (leaders.length > 1) banner = "It's a draw between " + leaders.map((i) => s.names[i]).join(" & ");
    else banner = s.names[leaders[0]] + " wins!";

    let table;
    if (s.versus) {
      table = '<table class="table"><thead><tr><th>Round</th><th>Result</th><th>Score</th></tr></thead><tbody>' +
        s.matches.map((m) => "<tr><td>" + m.round + "</td><td>" + (m.winner === null ? "Draw" : esc(s.names[m.winner])) + "</td><td>" + m.scores[0] + " – " + m.scores[1] + "</td></tr>").join("") + "</tbody></table>";
    } else {
      table = '<div class="table-wrap"><table class="table"><thead><tr><th>Team</th>' + Array.from({ length: s.rounds }, (_, i) => "<th>R" + (i + 1) + "</th>").join("") + "<th>Total</th></tr></thead><tbody>" +
        order.map((i) => "<tr" + (leaders.indexOf(i) >= 0 ? ' class="win"' : "") + '><td><span class="dot c' + i + '"></span> ' + esc(s.names[i]) + "</td>" +
          s.scores[i].map((v) => "<td>" + v + "</td>").join("") + "<td><b>" + t[i] + "</b></td></tr>").join("") + "</tbody></table></div>";
    }
    const podium = order.map((i, rank) =>
      '<div class="rank-row' + (leaders.indexOf(i) >= 0 ? " first" : "") + '"><span class="rk">' + (rank + 1) + '</span><span class="dot c' + i + '"></span><b>' + esc(s.names[i]) + "</b><strong>" + t[i] + (s.versus ? " pts" : "") + "</strong></div>").join("");

    $("pEnd").hidden = true;
    $("pBoard").innerHTML = "";
    $("pSub").textContent = "Final results";
    $("pStage").removeAttribute("style");
    $("pStage").className = "stage results";
    $("pStage").innerHTML =
      '<div class="result-card"><div class="trophy">' + (leaders.length > 1 ? "🤝" : "🏆") + "</div><h2>" + esc(banner) + "</h2>" +
      (s.newBest ? '<p class="new-best">🌟 A new best score was set!</p>' : "") +
      '<div class="ranks">' + podium + "</div>" + table +
      '<div class="actions"><button class="btn primary grow" id="rAgain" type="button">' + App.icon("refresh", 18) + "<span>Play again</span></button>" +
      '<button class="btn ghost grow" id="rBack" type="button">All games</button></div></div>';
    $("pExit").hidden = true;
    $("rAgain").addEventListener("click", () => startSession(game, { difficulty: s.difficulty, rounds: s.rounds, names: s.versus ? (s.vsCpu ? [s.names[0]] : s.names.slice()) : s.names.slice(), vsCpu: s.vsCpu }));
    $("rBack").addEventListener("click", () => App.go("games"));
  }

  /* ---------- router entry ---------- */
  App.views.games = {
    title: "Games",
    mount: function (host, params) {
      const game = params[0] ? find(params[0]) : null;
      if (!game) return renderCards(host);
      if (game.custom) return game.mount(host, params.slice(1)) || {};
      if (params[1] === "play") return renderPlay(host, game);
      return renderSetup(host, game);
    }
  };
})();
