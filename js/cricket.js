/* cricket.js - Cricket match scorer: ball-by-ball scoring, extras, wickets, innings, target, scorecard, commentary */
(function () {
  "use strict";
  const App = window.App; if (!App || !App.games) return;
  const esc = App.esc, store = App.store;
  const LIVE_KEY = "cricket_match_v1", HIST_KEY = "cricket_history_v1";

  /* =====================================================================
     ENGINE (pure functions on a match object)
     ===================================================================== */
  const oversStr = (b) => Math.floor(b / 6) + "." + (b % 6);
  const fix2 = (n) => (isFinite(n) ? n.toFixed(2) : "0.00");
  const strikeRate = (r, b) => (b ? (r * 100 / b).toFixed(1) : "0.0");
  const economy = (r, b) => (b ? fix2(r * 6 / b) : "0.00");
  const runRate = (r, b) => (b ? fix2(r * 6 / b) : "0.00");
  const plural = (n, w) => n + " " + w + (n === 1 ? "" : "s");

  function mkBatter(team, p) { return { p: p, name: team.players[p], runs: 0, balls: 0, fours: 0, sixes: 0, out: false, how: "", bowler: "" }; }

  function newInnings(m, bat) {
    const t = m.teams[bat];
    return {
      bat: bat, bowl: 1 - bat, runs: 0, wkts: 0, balls: 0, extras: { wd: 0, nb: 0, b: 0, lb: 0 },
      batters: [mkBatter(t, 0), mkBatter(t, 1)], striker: 0, non: 1, nextP: 2,
      bowlers: [], curBowler: null, lastBowlerP: null,
      overLegal: 0, overRuns: 0, overTotal: 0, overBalls: [], lastOverBalls: [], freeHit: false,
      fow: [], part: { runs: 0, balls: 0 }, log: [], done: false, endReason: ""
    };
  }

  function newMatch(o) {
    const bat = o.toss.choice === "bat" ? o.toss.winner : 1 - o.toss.winner;
    const m = { id: App.uid(), created: Date.now(), status: "live", teams: o.teams, overs: o.overs, toss: o.toss, innings: [], cur: 0, target: null, result: "" };
    m.innings.push(newInnings(m, bat));
    return m;
  }

  function selectBowler(m, p) {
    const inn = m.innings[m.cur];
    let i = -1;
    for (let k = 0; k < inn.bowlers.length; k++) if (inn.bowlers[k].p === p) i = k;
    if (i < 0) { inn.bowlers.push({ p: p, name: m.teams[inn.bowl].players[p], balls: 0, runs: 0, wkts: 0, maidens: 0 }); i = inn.bowlers.length - 1; }
    inn.curBowler = i;
  }

  function dismissalText(how, bowler) {
    return ({ bowled: "b " + bowler, caught: "c & b " + bowler, lbw: "lbw b " + bowler, stumped: "st b " + bowler, hitwicket: "hit wicket b " + bowler, runout: "run out" })[how] || how;
  }
  const HOW_LABEL = { bowled: "Bowled", caught: "Caught", lbw: "LBW", stumped: "Stumped", runout: "Run out", hitwicket: "Hit wicket" };

  /* apply one delivery. ev: run | wide | noball | bye | legbye | wicket. Returns false if rejected. */
  function applyBall(m, ev) {
    const inn = m.innings[m.cur];
    if (!inn || inn.done || inn.curBowler === null) return false;
    const bowler = inn.bowlers[inn.curBowler];
    const striker = inn.batters[inn.striker];
    const ballsBefore = inn.balls;
    const wasFree = inn.freeHit;
    let team = 0, bat = 0, bowl = 0, legal = true, faced = true, nextFree = false, wk = null, token = "", odd = 0;

    switch (ev.type) {
      case "run": bat = team = bowl = ev.runs; odd = ev.runs; token = String(ev.runs); break;
      case "wide": { const r = ev.extra || 0; team = bowl = 1 + r; legal = false; faced = false; odd = r; token = r ? "Wd+" + r : "Wd"; break; }
      case "noball": { const r = ev.bat || 0; bat = r; team = bowl = 1 + r; legal = false; nextFree = true; odd = r; token = r ? "Nb+" + r : "Nb"; break; }
      case "bye": team = ev.runs; odd = ev.runs; token = "B" + ev.runs; break;
      case "legbye": team = ev.runs; odd = ev.runs; token = "Lb" + ev.runs; break;
      case "wicket": {
        const del = ev.delivery || "legal", r = ev.runs || 0;
        if (wasFree && ev.how !== "runout") return false;
        if (del === "noball" && ev.how !== "runout") return false;
        if (del === "wide" && ["stumped", "hitwicket", "runout"].indexOf(ev.how) < 0) return false;
        if (del === "wide") { team = bowl = 1 + r; legal = false; faced = false; }
        else if (del === "noball") { bat = r; team = bowl = 1 + r; legal = false; nextFree = true; }
        else { bat = team = bowl = r; }
        odd = r;
        wk = { how: ev.how, out: ev.out === "non" ? "non" : "striker", del: del };
        token = (del === "wide" ? "Wd" : del === "noball" ? "Nb" : "") + (r ? r : "") + "W";
        break;
      }
      default: return false;
    }
    if (ev.type === "wide" || (wk && wk.del === "wide")) inn.extras.wd += team;
    if (ev.type === "noball" || (wk && wk.del === "noball")) inn.extras.nb += 1;
    if (ev.type === "bye") inn.extras.b += team;
    if (ev.type === "legbye") inn.extras.lb += team;

    // figures
    if (faced) striker.balls++;
    striker.runs += bat;
    if (ev.type === "run" || ev.type === "noball") { if (bat === 4) striker.fours++; else if (bat === 6) striker.sixes++; }
    inn.runs += team;
    bowler.runs += bowl;
    if (legal) { bowler.balls++; inn.balls++; inn.overLegal++; }
    inn.overRuns += bowl; inn.overTotal += team;
    inn.part.runs += team; if (legal) inn.part.balls++;

    // commentary text
    const bn = bowler.name, sn = striker.name;
    const label = Math.floor(ballsBefore / 6) + "." + (ballsBefore % 6 + 1);
    let text, kind = "run";
    if (wk) {
      kind = "wicket";
      text = bn + " to " + sn + ", OUT! ";
    } else if (ev.type === "run") {
      if (ev.runs === 0) { text = bn + " to " + sn + ", no run"; kind = "dot"; }
      else if (ev.runs === 4) { text = bn + " to " + sn + ", FOUR runs"; kind = "four"; }
      else if (ev.runs === 6) { text = bn + " to " + sn + ", SIX runs"; kind = "six"; }
      else text = bn + " to " + sn + ", " + plural(ev.runs, "run");
    } else if (ev.type === "wide") { text = bn + " to " + sn + ", wide" + (ev.extra ? " + " + plural(ev.extra, "run") : ""); kind = "extra"; }
    else if (ev.type === "noball") { text = bn + " to " + sn + ", no ball" + (ev.bat ? ", " + plural(ev.bat, "run") + " off the bat" : "") + ". FREE HIT next!"; kind = "extra"; }
    else if (ev.type === "bye") { text = bn + " to " + sn + ", " + plural(ev.runs, "bye"); kind = "extra"; }
    else { text = bn + " to " + sn + ", " + plural(ev.runs, "leg bye"); kind = "extra"; }

    // strike changes (batters cross on odd runs), then wicket
    let outIdx = -1;
    if (wk) outIdx = wk.out === "non" ? inn.non : inn.striker;
    if (odd % 2 === 1) { const t = inn.striker; inn.striker = inn.non; inn.non = t; }
    if (wk) {
      const ob = inn.batters[outIdx];
      ob.out = true; ob.how = dismissalText(wk.how, bowler.name); ob.bowler = bowler.name;
      inn.wkts++;
      if (wk.how !== "runout") bowler.wkts++;
      inn.fow.push({ runs: inn.runs, wkt: inn.wkts, name: ob.name, over: oversStr(inn.balls) });
      inn.part = { runs: 0, balls: 0 };
      text += ob.name + " " + (wk.how === "runout" ? "run out" : ob.how.replace(/^c & b/, "caught &amp; bowled by").replace(/^b /, "bowled by ").replace(/^lbw b/, "lbw b")) + (team ? " (" + team + " run" + (team === 1 ? "" : "s") + ")" : "");
      text = text.replace("&amp;", "&");
      if (inn.wkts < m.teams[inn.bat].players.length - 1) {
        inn.batters.push(mkBatter(m.teams[inn.bat], inn.nextP++));
        const ni = inn.batters.length - 1;
        if (outIdx === inn.striker) inn.striker = ni; else inn.non = ni;
      }
    }
    inn.freeHit = nextFree || (wasFree && !legal);
    inn.overBalls.push(token);
    inn.log.push({ label: label, bowler: bn, batter: sn, token: token, runs: team, kind: kind, text: text });

    // end of over
    if (legal && inn.overLegal === 6) {
      if (inn.overRuns === 0) bowler.maidens++;
      inn.log.push({ kind: "over", over: Math.floor(inn.balls / 6), runs: inn.overTotal, score: inn.runs + "/" + inn.wkts, bowler: bn });
      const t = inn.striker; inn.striker = inn.non; inn.non = t;
      inn.lastBowlerP = bowler.p; inn.curBowler = null;
      inn.lastOverBalls = inn.overBalls.slice();
      inn.overLegal = 0; inn.overRuns = 0; inn.overTotal = 0; inn.overBalls = [];
    }

    // end of innings?
    const players = m.teams[inn.bat].players.length;
    if (inn.wkts >= players - 1) { inn.done = true; inn.endReason = "All out"; }
    else if (inn.balls >= m.overs * 6) { inn.done = true; inn.endReason = "Overs completed"; }
    else if (m.cur === 1 && inn.runs >= m.target) { inn.done = true; inn.endReason = "Target reached"; }
    return true;
  }

  function matchResult(m) {
    const a = m.innings[0], b = m.innings[1], t = m.teams;
    if (!b) return "Match not completed";
    if (b.runs >= m.target) {
      const wk = t[b.bat].players.length - 1 - b.wkts, left = m.overs * 6 - b.balls;
      return t[b.bat].name + " won by " + plural(wk, "wicket") + (left > 0 ? " (" + plural(left, "ball") + " left)" : "");
    }
    if (b.runs === a.runs) return "Match tied";
    return t[a.bat].name + " won by " + plural(a.runs - b.runs, "run");
  }

  App.cricket = { engine: { newMatch: newMatch, applyBall: applyBall, selectBowler: selectBowler, matchResult: matchResult, newInnings: newInnings } };

  /* =====================================================================
     UI
     ===================================================================== */
  const $ = (root, sel) => root.querySelector(sel);
  const loadLive = () => store.read(LIVE_KEY, null);
  const history = () => store.read(HIST_KEY, []);
  function scoreLine(m) {
    return m.innings.map((i) => esc(m.teams[i.bat].name) + " " + i.runs + "/" + i.wkts + " (" + oversStr(i.balls) + ")").join(" · ");
  }
  function dateStr(ts) { try { return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" }); } catch (e) { return ""; } }

  /* ---------- match centre (home) ---------- */
  function renderHome(host) {
    App.setSub("Games · Cricket");
    const live = loadLive();
    const hist = history();
    host.innerHTML =
      '<section class="page wide page-cricket">' +
      '<div class="cr-home">' +
      '<button class="back-link" id="crBack" type="button">' + App.icon("left", 18) + "<span>All games</span></button>" +
      '<div class="cr-panel cr-hero" style="--g1:#98e7b1;--g2:#2ca66a">' +
      '<div class="cr-hero-icon">🏏</div>' +
      '<div class="cr-hero-copy"><h2>Cricket Scorer</h2><p>Score a match ball by ball with live score, scorecard and commentary, just like a live cricket app.</p></div>' +
      '</div>' +
      (live
        ? '<div class="cr-panel live-card"><div class="lc-head"><span class="live-dot"></span><b>Match in progress</b></div><h4>' + esc(live.teams[0].name) + " vs " + esc(live.teams[1].name) + "</h4><p class=\"muted\">" + scoreLine(live) + " · " + live.overs + " overs</p>" +
          '<div class="actions"><button class="btn primary grow" id="crResume" type="button">' + App.icon("play", 18) + "<span>Resume scoring</span></button><button class=\"btn ghost danger grow\" id=\"crDiscard\" type=\"button\">Discard</button></div></div>"
        : '<div class="cr-panel cr-start-panel"><h4>Start a new match</h4><p>Set the teams, overs and toss, then start scoring.</p><button class="btn primary cr-new-btn" id="crNew" type="button">' + App.icon("plus", 18) + "<span>New match</span></button></div>") +
      (live ? '<div class="center-btn"><button class="btn ghost" id="crNew2" type="button">Start a different match</button></div>' : "") +
      '<div class="cr-history-head">Recent matches</div>' +
      (hist.length ? '<div class="hist-list">' + hist.map((h) =>
        '<div class="hist-card" data-id="' + h.id + '"><button class="hist-main" type="button"><div class="hc-top"><b>' + esc(h.teams[0].name) + " vs " + esc(h.teams[1].name) + "</b><small>" + dateStr(h.created) + "</small></div>" +
        '<div class="hc-score">' + scoreLine(h) + '</div><div class="hc-result">' + esc(h.result) + '</div></button><button class="mini del" type="button" aria-label="Delete match">' + App.icon("trash", 17) + "</button></div>"
      ).join("") + "</div>" : '<div class="state-card plain">' + App.icon("trophy", 36) + "<p>No finished matches yet.</p></div>") +
      '</div>' +
      "</section>";

    $(host, "#crBack").addEventListener("click", () => App.go("games"));
    const goNew = () => App.go("games/cricket/new");
    ["#crNew", "#crNew2"].forEach((s) => { const b = $(host, s); if (b) b.addEventListener("click", async () => {
      if (live) { const ok = await App.confirm({ title: "Replace the current match?", text: "The match in progress will be discarded.", ok: "Start new", danger: true }); if (!ok) return; store.remove(LIVE_KEY); }
      goNew();
    }); });
    const rs = $(host, "#crResume"); if (rs) rs.addEventListener("click", () => App.go("games/cricket/live"));
    const dc = $(host, "#crDiscard"); if (dc) dc.addEventListener("click", async () => {
      const ok = await App.confirm({ title: "Discard this match?", text: "The live match will be deleted.", ok: "Discard", danger: true });
      if (ok) { store.remove(LIVE_KEY); renderHome(host); }
    });
    host.querySelectorAll(".hist-card").forEach((c) => {
      c.querySelector(".hist-main").addEventListener("click", () => App.go("games/cricket/match/" + c.dataset.id));
      c.querySelector(".del").addEventListener("click", async () => {
        const ok = await App.confirm({ title: "Delete this match?", text: "This can't be undone.", ok: "Delete", danger: true });
        if (ok) { store.write(HIST_KEY, history().filter((x) => x.id !== c.dataset.id)); renderHome(host); }
      });
    });
    return {};
  }

  /* ---------- setup ---------- */
  function renderSetup(host) {
    App.setSub("Games · Cricket · New match");
    const st = { a: "Team A", b: "Team B", overs: 10, players: 11, tossWinner: 0, choice: "bat" };
    host.innerHTML =
      '<section class="page page-setup">' +
      '<button class="back-link" id="csBack" type="button">' + App.icon("left", 18) + "<span>Cricket</span></button>" +
      '<form class="panel" id="csForm" novalidate><h4>New match</h4>' +
      '<div class="two-col"><div class="field"><label for="csA">Team A</label><input id="csA" type="text" maxlength="18" value="Team A"></div>' +
      '<div class="field"><label for="csB">Team B</label><input id="csB" type="text" maxlength="18" value="Team B"></div></div>' +
      '<div class="field"><label>Overs per innings</label><div class="chips" id="csOvers">' + [2, 5, 10, 20, 50].map((o) => '<button type="button" data-o="' + o + '"' + (o === 10 ? ' class="active"' : "") + ">" + o + "</button>").join("") + "</div>" +
      '<input id="csOversCustom" type="number" min="1" max="50" placeholder="Or type a custom number (1-50)"></div>' +
      '<div class="field"><label>Players per team</label><div class="stepper" id="csPlayers"></div></div>' +
      '<details class="names-edit"><summary>Edit player names (optional)</summary><div class="two-col">' +
      '<div class="field"><label for="csPA">Team A players (one per line)</label><textarea id="csPA" rows="6" placeholder="Player 1&#10;Player 2&#10;..."></textarea></div>' +
      '<div class="field"><label for="csPB">Team B players (one per line)</label><textarea id="csPB" rows="6" placeholder="Player 1&#10;Player 2&#10;..."></textarea></div></div></details>' +
      '<div class="field"><label>Toss won by</label><div class="seg" id="csToss"></div></div>' +
      '<div class="field"><label>Elected to</label><div class="seg" id="csChoice"><button type="button" data-c="bat" class="on">Bat first</button><button type="button" data-c="bowl">Bowl first</button></div></div>' +
      '<div class="err" id="csErr"></div>' +
      '<div class="actions"><button class="btn primary grow" type="submit">' + App.icon("play", 18) + "<span>Start match</span></button><button class=\"btn ghost grow\" type=\"button\" id=\"csCancel\">Cancel</button></div></form></section>";

    const drawToss = () => { $(host, "#csToss").innerHTML = ["a", "b"].map((k, i) => '<button type="button" data-t="' + i + '" class="' + (st.tossWinner === i ? "on" : "") + '">' + esc(st[k].trim() || ("Team " + (i ? "B" : "A"))) + "</button>").join(""); };
    const drawPlayers = () => { $(host, "#csPlayers").innerHTML = '<button type="button" data-s="-1"' + (st.players <= 2 ? " disabled" : "") + ' aria-label="Fewer">' + App.icon("minus", 18) + "</button><b>" + st.players + '</b><button type="button" data-s="1"' + (st.players >= 11 ? " disabled" : "") + ' aria-label="More">' + App.icon("plus", 18) + "</button>"; };
    drawToss(); drawPlayers();

    $(host, "#csA").addEventListener("input", (e) => { st.a = e.target.value; drawToss(); });
    $(host, "#csB").addEventListener("input", (e) => { st.b = e.target.value; drawToss(); });
    $(host, "#csOvers").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      st.overs = Number(b.dataset.o); $(host, "#csOversCustom").value = "";
      host.querySelectorAll("#csOvers button").forEach((x) => x.classList.toggle("active", x === b));
    });
    $(host, "#csOversCustom").addEventListener("input", (e) => {
      const v = Number(e.target.value);
      if (v >= 1 && v <= 50) { st.overs = Math.floor(v); host.querySelectorAll("#csOvers button").forEach((x) => x.classList.remove("active")); }
    });
    $(host, "#csPlayers").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b || b.disabled) return; st.players = App.clamp(st.players + Number(b.dataset.s), 2, 11); drawPlayers(); });
    $(host, "#csToss").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; st.tossWinner = Number(b.dataset.t); drawToss(); });
    $(host, "#csChoice").addEventListener("click", (e) => { const b = e.target.closest("button"); if (!b) return; st.choice = b.dataset.c; host.querySelectorAll("#csChoice button").forEach((x) => x.classList.toggle("on", x === b)); });
    $(host, "#csBack").addEventListener("click", () => App.go("games/cricket"));
    $(host, "#csCancel").addEventListener("click", () => App.go("games/cricket"));

    $(host, "#csForm").addEventListener("submit", (e) => {
      e.preventDefault();
      const a = st.a.trim(), b = st.b.trim();
      if (!a || !b) { $(host, "#csErr").textContent = "Please enter both team names."; return; }
      if (a.toLowerCase() === b.toLowerCase()) { $(host, "#csErr").textContent = "The two teams need different names."; return; }
      const names = (id) => $(host, id).value.split("\n").map((s) => s.trim()).filter(Boolean);
      const mk = (list) => Array.from({ length: st.players }, (_, i) => list[i] || "Player " + (i + 1));
      const m = newMatch({
        teams: [{ name: a, players: mk(names("#csPA")) }, { name: b, players: mk(names("#csPB")) }],
        overs: st.overs, toss: { winner: st.tossWinner, choice: st.choice }
      });
      store.write(LIVE_KEY, m);
      App.go("games/cricket/live");
    });
    return {};
  }

  /* ---------- scorecard / commentary / info (shared by live and finished views) ---------- */
  function battingTable(m, inn) {
    const t = m.teams[inn.bat];
    const rows = inn.batters.map((b, i) => {
      const batting = !inn.done && !b.out && (i === inn.striker || i === inn.non);
      const how = b.out ? b.how : (inn.done ? "not out" : (batting ? "batting" : ""));
      return "<tr><td class=\"nm\"><b>" + esc(b.name) + (batting && i === inn.striker ? "*" : "") + "</b><small>" + esc(how) + "</small></td><td><b>" + b.runs + "</b></td><td>" + b.balls + "</td><td>" + b.fours + "</td><td>" + b.sixes + "</td><td>" + strikeRate(b.runs, b.balls) + "</td></tr>";
    }).join("");
    const dnb = t.players.slice(inn.nextP).map((n) => esc(n));
    const e = inn.extras, ex = e.wd + e.nb + e.b + e.lb;
    return '<div class="table-wrap"><table class="table cr-table"><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
      '<div class="sc-line"><span>Extras</span><b>' + ex + "</b><small>(b " + e.b + ", lb " + e.lb + ", w " + e.wd + ", nb " + e.nb + ")</small></div>" +
      '<div class="sc-line total"><span>Total</span><b>' + inn.runs + "/" + inn.wkts + "</b><small>(" + oversStr(inn.balls) + " ov, RR " + runRate(inn.runs, inn.balls) + ")</small></div>" +
      (dnb.length ? '<div class="sc-note"><b>Did not bat:</b> ' + dnb.join(", ") + "</div>" : "") +
      (inn.fow.length ? '<div class="sc-note"><b>Fall of wickets:</b> ' + inn.fow.map((f) => f.wkt + "-" + f.runs + " (" + esc(f.name) + ", " + f.over + " ov)").join(", ") + "</div>" : "");
  }
  function bowlingTable(inn) {
    if (!inn.bowlers.length) return "";
    return '<div class="table-wrap"><table class="table cr-table"><thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead><tbody>' +
      inn.bowlers.map((b) => "<tr><td class=\"nm\"><b>" + esc(b.name) + "</b></td><td>" + oversStr(b.balls) + "</td><td>" + b.maidens + "</td><td>" + b.runs + "</td><td><b>" + b.wkts + "</b></td><td>" + economy(b.runs, b.balls) + "</td></tr>").join("") + "</tbody></table></div>";
  }
  function scorecardHtml(m) {
    return m.innings.map((inn, idx) =>
      '<div class="panel sc-card"><div class="sc-head"><h4>' + esc(m.teams[inn.bat].name) + " · " + (idx === 0 ? "1st" : "2nd") + ' innings</h4><b class="sc-total">' + inn.runs + "/" + inn.wkts + " <small>(" + oversStr(inn.balls) + ")</small></b></div>" +
      battingTable(m, inn) + bowlingTable(inn) + "</div>"
    ).join("");
  }
  function commentaryHtml(m, idx) {
    const inn = m.innings[idx] || m.innings[0];
    const seg = m.innings.length > 1 ? '<div class="seg" id="crInnSeg">' + m.innings.map((i, k) => '<button type="button" data-i="' + k + '" class="' + (k === idx ? "on" : "") + '">' + esc(m.teams[i.bat].name) + "</button>").join("") + "</div>" : "";
    const items = inn.log.slice().reverse().map((l) => {
      if (l.kind === "over") return '<div class="cm-over"><b>End of over ' + l.over + '</b><span>' + l.runs + " runs · " + esc(l.score) + " · " + esc(l.bowler) + "</span></div>";
      return '<div class="cm-row ' + l.kind + '"><span class="cm-ball">' + l.label + '</span><span class="cm-tok ' + l.kind + '">' + esc(l.token) + '</span><p>' + esc(l.text) + "</p></div>";
    }).join("");
    return seg + '<div class="cm-list">' + (items || '<div class="state-card plain"><p>No balls bowled yet.</p></div>') + "</div>";
  }
  function infoHtml(m) {
    const tw = m.teams[m.toss.winner].name;
    return '<div class="panel"><h4>Match info</h4><div class="info-list">' +
      '<div class="info-row"><span>Match</span><span>' + esc(m.teams[0].name) + " vs " + esc(m.teams[1].name) + "</span></div>" +
      '<div class="info-row"><span>Format</span><span>' + m.overs + " overs</span></div>" +
      '<div class="info-row"><span>Toss</span><span>' + esc(tw) + " chose to " + m.toss.choice + "</span></div>" +
      '<div class="info-row"><span>Status</span><span>' + (m.status === "done" ? esc(m.result) : "In progress") + "</span></div></div></div>" +
      m.teams.map((t) => '<div class="panel"><h4>' + esc(t.name) + '</h4><p class="muted">' + t.players.map(esc).join(", ") + "</p></div>").join("");
  }

  /* ---------- live scoring + viewer ---------- */
  function renderMatch(host, m, opts) {
    opts = opts || {};
    const readOnly = !!opts.readOnly;
    let tab = opts.tab || (readOnly ? "scorecard" : "live");
    let cmIdx = m.cur;
    let undo = [];
    let modalBusy = false;
    App.setSub("Games · Cricket");

    const curInn = () => m.innings[m.cur];
    const persist = () => { if (!readOnly) store.write(LIVE_KEY, m); };
    const snap = () => { undo.push(JSON.stringify(m)); if (undo.length > 300) undo.shift(); };

    host.innerHTML =
      '<section class="page wide page-cricket live">' +
      '<div class="play-top"><button class="btn sm soft" id="mExit" type="button">' + App.icon("left", 16) + "<span>" + (readOnly ? "Back" : "Exit") + '</span></button>' +
      '<div class="pt-title"><b id="mTitle"></b><small id="mSub"></small></div>' +
      (readOnly ? "" : '<button class="btn sm soft" id="mEndInn" type="button">End innings</button>') + "</div>" +
      '<div id="mHead"></div>' +
      '<div class="tabs cr-tabs" id="mTabs">' + [["live", "Live"], ["scorecard", "Scorecard"], ["commentary", "Commentary"], ["info", "Info"]].filter((t) => !(readOnly && t[0] === "live")).map((t) => '<button type="button" data-tab="' + t[0] + '" class="' + (t[0] === tab ? "active" : "") + '">' + t[1] + "</button>").join("") + "</div>" +
      '<div id="mBody"></div></section>';

    function head() {
      const inn = curInn();
      $(host, "#mTitle").textContent = m.teams[0].name + " vs " + m.teams[1].name;
      $(host, "#mSub").textContent = m.overs + " overs · " + (m.status === "done" ? "Match ended" : (m.cur === 0 ? "1st" : "2nd") + " innings");
      const balls = inn.balls, left = m.overs * 6 - balls;
      let line2 = "CRR " + runRate(inn.runs, balls);
      let target = "";
      if (m.cur === 1 && m.target) {
        const need = m.target - inn.runs;
        if (m.status === "done") target = '<div class="cr-target result">' + esc(m.result) + "</div>";
        else if (need > 0) target = '<div class="cr-target">Target ' + m.target + " · Need <b>" + need + "</b> from <b>" + left + "</b> balls · RRR " + fix2(need * 6 / Math.max(1, left)) + "</div>";
      } else if (m.status === "done") target = '<div class="cr-target result">' + esc(m.result) + "</div>";
      const first = m.cur === 1 ? '<div class="cr-first">' + esc(m.teams[m.innings[0].bat].name) + " " + m.innings[0].runs + "/" + m.innings[0].wkts + " (" + oversStr(m.innings[0].balls) + ")</div>" : "";
      $(host, "#mHead").innerHTML =
        '<div class="cr-card"><div class="cr-top"><span class="cr-team">' + esc(m.teams[inn.bat].name) + '</span>' + (inn.freeHit && !inn.done ? '<span class="free-hit">FREE HIT</span>' : '<span class="cr-status">' + (inn.done ? esc(inn.endReason) : "Batting") + "</span>") + "</div>" +
        '<div class="cr-score"><b>' + inn.runs + "/" + inn.wkts + "</b><span>(" + oversStr(balls) + " ov)</span></div>" +
        '<div class="cr-line">' + line2 + (m.cur === 0 ? " · " + left + " balls left" : "") + "</div>" + first + target + "</div>";
    }

    function liveBody() {
      const inn = curInn();
      const bat = (i) => inn.batters[i];
      const row = (b, star) => "<tr><td class=\"nm\"><b>" + esc(b.name) + (star ? "*" : "") + "</b></td><td><b>" + b.runs + "</b></td><td>" + b.balls + "</td><td>" + b.fours + "</td><td>" + b.sixes + "</td><td>" + strikeRate(b.runs, b.balls) + "</td></tr>";
      const bw = inn.curBowler !== null ? inn.bowlers[inn.curBowler] : inn.bowlers.filter((b) => b.p === inn.lastBowlerP)[0];
      const balls = inn.overBalls.length ? inn.overBalls : inn.lastOverBalls;
      const chip = (t) => '<span class="ob ' + (t === "W" || /W$/.test(t) ? "w" : t === "4" ? "f" : t === "6" ? "s" : /^(Wd|Nb|B|Lb)/.test(t) ? "x" : "") + '">' + esc(t) + "</span>";
      let html = '<div class="panel tight">' +
        (inn.done ? "" : '<div class="table-wrap"><table class="table cr-table"><thead><tr><th>Batter</th><th>R</th><th>B</th><th>4s</th><th>6s</th><th>SR</th></tr></thead><tbody>' +
          row(bat(inn.striker), true) + row(bat(inn.non), false) + "</tbody></table></div>" +
          '<div class="sc-note">Partnership: <b>' + inn.part.runs + "</b> (" + inn.part.balls + ")" + (inn.fow.length ? " · Last wicket: " + esc(inn.fow[inn.fow.length - 1].name) + " " + inn.fow[inn.fow.length - 1].runs + "/" + inn.fow[inn.fow.length - 1].wkt : "") + "</div>") +
        (bw ? '<div class="table-wrap"><table class="table cr-table"><thead><tr><th>Bowler</th><th>O</th><th>M</th><th>R</th><th>W</th><th>Econ</th></tr></thead><tbody><tr><td class="nm"><b>' + esc(bw.name) + "</b></td><td>" + oversStr(bw.balls) + "</td><td>" + bw.maidens + "</td><td>" + bw.runs + "</td><td><b>" + bw.wkts + "</b></td><td>" + economy(bw.runs, bw.balls) + "</td></tr></tbody></table></div>" : "") +
        '<div class="this-over"><small>' + (inn.overBalls.length ? "This over" : "Last over") + "</small><div class=\"obs\">" + (balls.length ? balls.map(chip).join("") : "<em>—</em>") + "</div></div></div>";

      if (m.status === "done") {
        html += '<div class="panel result-panel"><div class="trophy">🏆</div><h3>' + esc(m.result) + '</h3><div class="actions"><button class="btn primary grow" id="mCard" type="button">Full scorecard</button><button class="btn ghost grow" id="mHome" type="button">Done</button></div></div>';
      } else if (inn.done) {
        html += '<div class="panel center-panel"><h4>Innings complete</h4><p class="muted">' + esc(inn.endReason) + "</p><button class=\"btn primary\" id=\"mNextInn\" type=\"button\">" + (m.cur === 0 ? "Start 2nd innings" : "Finish match") + "</button></div>";
      } else if (inn.curBowler === null) {
        html += '<div class="panel center-panel"><h4>New over</h4><p class="muted">Choose who is bowling.</p><button class="btn primary" id="mPickBowler" type="button">Select bowler</button></div>';
      } else {
        html += '<div class="pad" id="mPad">' +
          [0, 1, 2, 3].map((r) => '<button type="button" class="pb run" data-k="r' + r + '">' + r + "</button>").join("") +
          '<button type="button" class="pb four" data-k="r4">4</button><button type="button" class="pb six" data-k="r6">6</button>' +
          '<button type="button" class="pb ex" data-k="wd">Wd</button><button type="button" class="pb ex" data-k="nb">Nb</button>' +
          '<button type="button" class="pb ex" data-k="bye">Bye</button><button type="button" class="pb ex" data-k="lb">LB</button>' +
          '<button type="button" class="pb wkt" data-k="wkt">Wicket</button><button type="button" class="pb undo" data-k="undo">' + App.icon("undo", 18) + " Undo</button></div>" +
          '<div class="pad-more"><button class="btn sm soft" id="mSwap" type="button">' + App.icon("swap", 16) + "<span>Swap strike</span></button></div>";
      }
      return html;
    }

    function body() {
      const b = $(host, "#mBody");
      if (tab === "live") b.innerHTML = liveBody();
      else if (tab === "scorecard") b.innerHTML = scorecardHtml(m);
      else if (tab === "commentary") b.innerHTML = commentaryHtml(m, cmIdx);
      else b.innerHTML = infoHtml(m);
      wire();
    }
    function draw() { head(); body(); host.querySelectorAll("#mTabs button").forEach((x) => x.classList.toggle("active", x.dataset.tab === tab)); }

    /* ----- actions ----- */
    async function pickBowler() {
      if (modalBusy) return; modalBusy = true;
      const inn = curInn();
      const team = m.teams[inn.bowl];
      let eligible = team.players.map((n, i) => i).filter((i) => i !== inn.lastBowlerP);
      if (!eligible.length) eligible = team.players.map((n, i) => i);
      const opts = eligible.map((i) => {
        const b = inn.bowlers.filter((x) => x.p === i)[0];
        return { label: team.players[i], value: i, sub: b ? oversStr(b.balls) + "-" + b.maidens + "-" + b.runs + "-" + b.wkts : "" };
      });
      const v = await App.pick({ title: inn.bowlers.length ? "Next bowler" : "Opening bowler", sub: esc(team.name) + " · choose who bowls this over", options: opts, cols: 2, noCancel: true });
      modalBusy = false;
      if (v === null || v === undefined) return;
      selectBowler(m, v); persist(); draw();
    }

    async function wicketDialog() {
      const inn = curInn();
      const st = { how: "bowled", del: "legal", runs: 0, out: "striker" };
      const body = document.createElement("div");
      body.className = "wk-body";
      const sName = inn.batters[inn.striker].name, nName = inn.batters[inn.non].name;
      function allowed(how) {
        if (inn.freeHit) return how === "runout";
        if (st.del === "noball") return how === "runout";
        if (st.del === "wide") return ["stumped", "hitwicket", "runout"].indexOf(how) >= 0;
        return true;
      }
      function paint() {
        if (!allowed(st.how)) st.how = "runout";
        body.innerHTML =
          '<div class="field"><label>How out?</label><div class="chips wrap" data-g="how">' + Object.keys(HOW_LABEL).map((k) => '<button type="button" data-v="' + k + '" class="' + (st.how === k ? "active" : "") + '"' + (allowed(k) ? "" : " disabled") + ">" + HOW_LABEL[k] + "</button>").join("") + "</div></div>" +
          (inn.freeHit ? '<p class="muted small">Free hit: only a run out is possible.</p>' : "") +
          '<div class="field"><label>Delivery</label><div class="chips" data-g="del">' + [["legal", "Legal ball"], ["wide", "Wide"], ["noball", "No ball"]].map((d) => '<button type="button" data-v="' + d[0] + '" class="' + (st.del === d[0] ? "active" : "") + '"' + (inn.freeHit && d[0] === "legal" ? "" : "") + ">" + d[1] + "</button>").join("") + "</div></div>" +
          (st.how === "runout" ? '<div class="field"><label>Runs completed before the run out</label><div class="chips" data-g="runs">' + [0, 1, 2, 3].map((r) => '<button type="button" data-v="' + r + '" class="' + (st.runs === r ? "active" : "") + '">' + r + "</button>").join("") + "</div></div>" +
            '<div class="field"><label>Who is out?</label><div class="chips" data-g="out"><button type="button" data-v="striker" class="' + (st.out === "striker" ? "active" : "") + '">' + esc(sName) + '</button><button type="button" data-v="non" class="' + (st.out === "non" ? "active" : "") + '">' + esc(nName) + "</button></div></div>" : "");
      }
      paint();
      body.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b || b.disabled) return;
        const g = b.parentElement.dataset.g;
        if (g === "runs") st.runs = Number(b.dataset.v); else st[g] = b.dataset.v;
        paint();
      });
      const res = await App.modal({ title: "Wicket", sub: "Who is out and how?", body: body, cls: "wk-pop", actions: [{ label: "Confirm wicket", cls: "primary danger-fill", value: "ok" }, { label: "Cancel", cls: "ghost", value: null }] }).result;
      if (res !== "ok") return null;
      return { type: "wicket", how: st.how, delivery: st.del, runs: st.how === "runout" ? st.runs : 0, out: st.how === "runout" ? st.out : "striker" };
    }

    function after() {
      persist(); draw();
      const inn = curInn();
      if (inn.done) return;
      if (inn.curBowler === null) pickBowler();
    }

    async function act(ev) {
      const inn = curInn();
      if (inn.done) return;
      if (inn.curBowler === null) { pickBowler(); return; }
      snap();
      if (!applyBall(m, ev)) { undo.pop(); App.toast("That isn't allowed right now"); return; }
      after();
    }

    async function nextInnings() {
      const inn = curInn();
      if (m.cur === 0) {
        m.target = inn.runs + 1;
        m.cur = 1;
        m.innings.push(newInnings(m, 1 - inn.bat));
        undo = [];
        persist(); draw();
        await App.modal({ title: "Innings break", sub: esc(m.teams[inn.bat].name) + " scored " + inn.runs + "/" + inn.wkts + " in " + oversStr(inn.balls) + " overs.", body: '<p class="center-text"><b>' + esc(m.teams[1 - inn.bat].name) + "</b> need <b>" + m.target + "</b> runs to win from " + m.overs + " overs.</p>", actions: [{ label: "Start 2nd innings", cls: "primary", value: true }], dismissable: false }).result;
        pickBowler();
      } else {
        m.status = "done";
        m.result = matchResult(m);
        const h = history().filter((x) => x.id !== m.id);
        h.unshift(m);
        store.write(HIST_KEY, h.slice(0, 15));
        store.remove(LIVE_KEY);
        draw();
      }
    }

    function wire() {
      const b = $(host, "#mBody");
      const pad = $(b, "#mPad");
      if (pad) pad.addEventListener("click", async (e) => {
        const btn = e.target.closest("button"); if (!btn) return;
        const k = btn.dataset.k;
        if (/^r\d$/.test(k)) return act({ type: "run", runs: Number(k[1]) });
        if (k === "undo") {
          if (!undo.length) { App.toast("Nothing to undo"); return; }
          m = JSON.parse(undo.pop()); persist(); draw();
          const inn = curInn(); if (!inn.done && inn.curBowler === null) pickBowler();
          return;
        }
        if (k === "wd") { const v = await App.pick({ title: "Wide", sub: "Extra runs run on the wide (besides the 1 penalty run)", options: [0, 1, 2, 3, 4].map((n) => ({ label: n === 0 ? "Wide only" : "Wide + " + n, value: n })), cols: 3 }); if (v !== null) act({ type: "wide", extra: v }); return; }
        if (k === "nb") { const v = await App.pick({ title: "No ball", sub: "Runs hit off the bat (besides the 1 penalty run)", options: [0, 1, 2, 3, 4, 6].map((n) => ({ label: n === 0 ? "No runs" : String(n), value: n })), cols: 3 }); if (v !== null) act({ type: "noball", bat: v }); return; }
        if (k === "bye" || k === "lb") { const v = await App.pick({ title: k === "bye" ? "Byes" : "Leg byes", sub: "How many runs?", options: [1, 2, 3, 4].map((n) => ({ label: String(n), value: n })), cols: 4 }); if (v !== null) act({ type: k === "bye" ? "bye" : "legbye", runs: v }); return; }
        if (k === "wkt") { const ev = await wicketDialog(); if (ev) act(ev); }
      });
      const sw = $(b, "#mSwap");
      if (sw) sw.addEventListener("click", () => { snap(); const inn = curInn(); const t = inn.striker; inn.striker = inn.non; inn.non = t; persist(); draw(); });
      const pb = $(b, "#mPickBowler"); if (pb) pb.addEventListener("click", pickBowler);
      const ni = $(b, "#mNextInn"); if (ni) ni.addEventListener("click", nextInnings);
      const mc = $(b, "#mCard"); if (mc) mc.addEventListener("click", () => { tab = "scorecard"; draw(); });
      const mh = $(b, "#mHome"); if (mh) mh.addEventListener("click", () => App.go("games/cricket"));
      const seg = $(b, "#crInnSeg"); if (seg) seg.addEventListener("click", (e) => { const x = e.target.closest("button"); if (x) { cmIdx = Number(x.dataset.i); draw(); } });
    }

    $(host, "#mTabs").addEventListener("click", (e) => { const t = e.target.closest("button"); if (t) { tab = t.dataset.tab; draw(); } });
    $(host, "#mExit").addEventListener("click", () => App.go("games/cricket"));
    const endBtn = $(host, "#mEndInn");
    if (endBtn) endBtn.addEventListener("click", async () => {
      const inn = curInn();
      if (m.status === "done" || inn.done) return;
      const ok = await App.confirm({ title: "End this innings now?", text: "The innings will be closed with the current score.", ok: "End innings", danger: true });
      if (!ok) return;
      snap(); inn.done = true; inn.endReason = "Innings closed"; persist(); draw();
    });

    draw();
    if (!readOnly && m.status === "live") { const inn = curInn(); if (!inn.done && inn.curBowler === null) setTimeout(pickBowler, 120); }
    return { destroy: function () {} };
  }

  /* ---------- route entry ---------- */
  function mount(host, params) {
    const sub = params[0];
    if (sub === "new") return renderSetup(host);
    if (sub === "live") {
      const m = loadLive();
      if (!m) { App.go("games/cricket"); return {}; }
      return renderMatch(host, m, { readOnly: false });
    }
    if (sub === "match") {
      const m = history().filter((x) => x.id === params[1])[0];
      if (!m) { App.go("games/cricket"); return {}; }
      return renderMatch(host, m, { readOnly: true });
    }
    return renderHome(host);
  }

  App.games.register({
    id: "cricket", name: "Cricket Scorer", emoji: "🏏", tint: ["#86efac", "#15803d"], tag: "Live match scoring",
    featured: true, custom: true,
    blurb: "Ball-by-ball cricket scoring with scorecard and commentary.",
    mount: mount
  });
})();
