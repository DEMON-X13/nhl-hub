/* The player and goalie model: every skater carries an offence and a defence rating in shots on
   goal per game for a player on the ice all game, every goalie a save rating in goals per game.
   Goals are too rare to rate a skater on (a first try on goal surprises was worse than the team
   Elo at every step size), so the skaters are rated on the shots their side takes and allows,
   which come thirty a game a side, and the goalie on the goals he concedes against the shots he
   faces. A club's attack for a game is its skaters' offence weighted by their share of the ice
   time (five shares in all, five men on the ice), its defence their defence the same way, so a
   club is exactly the sum of who dressed and how much they played. Each side's expected shots is
   half the league's plus its attack less the other side's defence; its expected goals is those
   shots at the league's conversion, less the other goalie's saves, plus home ice for the home
   side; the goals layer in elo.js turns the two means into a win chance, a puck line and a total,
   and a fitted share of the team Elo's chance is blended in.

   After a final, each side's shots against what was expected is the surprise: it moves the
   offence of the skaters who took them and the defence of the skaters who allowed them, each by
   his share of the ice time to a fitted power (so a fourth-liner moves relatively more than his
   minutes say). The goalie moves on his own surprise, the goals he conceded against the shots he
   faced at the league's conversion. A player's first rating is a rookie's, below average; ratings
   carry part way toward zero between seasons.

   Fit on 2022-23 to 2024-25 by coordinate search on log loss with the lineup known and minutes
   projected from each player's last eight games; 2021-22 warms up; 2025-26 is held out and scored
   three ways (last game's lineup, lineup known, actual minutes). Each season from 2024 on is also
   scored cold, its parameters searched on the seasons before it: that walk-forward is the honest
   number, and it decides `use`, whether the site's call is this model's or the team Elo's.

    node tools/players.js          replay with the parameters in data/players.json, write it
    node tools/players.js fit      search the parameters again first

   Tonight (WHO PLAYS): each club's lineup is who dressed in its last game, less anyone the injury
   report has Out, on injured reserve or suspended, and less anyone listed on another club's report
   or whose latest game was for another club. The report is matched by ESPN id (read from the
   player's link by fetch_box.js), else by the club and the name, else by a name only one rated
   player has. Day-to-day players stay in and are flagged. The goalie is chosen game by game: the
   one DailyFaceoff names for that game and that date (Confirmed, Likely or Unconfirmed, said as
   such; a confirmed starter stands even when ESPN's report still lists him), else the club's goalie
   with the most starts in its last ten games this season (ties: last season's starts for the club,
   then the latest start), never one the report has out; on the second night of a back to back
   (the club's previous game, played or not, the day before) the other goalie from the one who
   started that game (its box score), or is expected to (the same choice, while it is to come,
   under way or over and not yet boxed). The schedule is the state update.js's first pass wrote,
   which reads every day, so the lineups stand on the games the second pass calls; the team Elo's
   gap blended in is this file's own replay of every final, never a row's `diff` (the first pass
   copies the last run's calls). NHL_DATA, NHL_STATE and NHL_TODAY move the files and the day, for
   simulate.js. */
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./espn');
const Hist = require('./hist');
const { Elo, expected, goals, homeByGoals, spreadOf, daysBetween } = require('./elo');

const ROOT = path.join(__dirname, '..'), DATA = process.env.NHL_DATA || path.join(ROOT, 'data');
const STATE_F = process.env.NHL_STATE || path.join(ROOT, 'state.json');
const OUTF = path.join(DATA, 'players.json');
const WARM = 2022, FIT_TO = 2025;
const DEFAULT = { K: 0.3, Kg: 0.03, pow: 0.5, carry: 0.8, rookie: -0.5, rookieG: -0.05, hfa: 0.12, blend: 0.3, clip: 12, clipG: 3, recent: 8 };
const GRID = {
  K: [0.05, 0.1, 0.2, 0.3, 0.5, 0.8],
  Kg: [0, 0.01, 0.02, 0.03, 0.05, 0.08],
  pow: [0.5, 0.75, 1],
  carry: [0.5, 0.6, 0.7, 0.8, 0.9, 1],
  rookie: [0, -0.25, -0.5, -1],
  rookieG: [0, -0.03, -0.06, -0.1],
  hfa: [0.06, 0.09, 0.12, 0.15, 0.18],
  blend: [0, 0.1, 0.2, 0.3, 0.5, 0.7, 1],
  clip: [8, 12, 20],
};
const log = m => console.log(new Date().toISOString().slice(11, 19), m);
const model = JSON.parse(fs.readFileSync(path.join(DATA, 'model.json'), 'utf8'));
const LEAGUE = { shots: 60, conv: 0.095 };

/* ---------- the data: every game with a box score, in date order, with its score and the team Elo's view ---------- */
function loadGames() {
  /* the finished seasons (history.json and the job's season_<year>.json files), then this season's
     finals from the state; a box line carries its own score too, for a final the state lacks */
  const hist = Hist.rows(DATA);
  const res = {};
  for (const r of hist) res[r.id] = { hs: r.hs, as: r.as, periods: r.periods, neutral: r.neutral, season: r.season };
  let S = null;
  if (fs.existsSync(STATE_F)) { S = JSON.parse(fs.readFileSync(STATE_F, 'utf8')); for (const g of S.games) if (g.state === 'final' && g.hs !== null) res[g.id] = { hs: g.hs, as: g.as, periods: g.periods, neutral: g.neutral, season: S.season }; }
  const games = [];
  for (const f of fs.readdirSync(DATA).filter(f => /^box_\d+\.jsonl$/.test(f)).sort()) for (const l of fs.readFileSync(path.join(DATA, f), 'utf8').split('\n')) {
    if (!l) continue; const b = JSON.parse(l);
    const r = res[b.id] || (b.hs !== undefined && b.hs !== null ? { hs: b.hs, as: b.as, periods: b.periods, neutral: !!b.neutral, season: b.season } : null);
    if (!r) continue;
    if (!res[b.id]) res[b.id] = r;
    games.push(Object.assign(b, r));
  }
  games.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1);
  /* the league's shots a game (both sides) and goals per shot, from the box scores: the goalies' shots against */
  let shots = 0, gl = 0, n = 0;
  for (const g of games) { const sa = g.goalies.reduce((a, x) => a + x.sa, 0); if (sa > 20) { shots += sa; gl += regGoals(g, 'home') + regGoals(g, 'away'); n++; } }
  LEAGUE.shots = shots / n; LEAGUE.conv = gl / shots;
  /* the team Elo's chance on every game, replayed over the whole history, for the blend */
  const m = new Elo(model.params); const elo = {};
  const all = hist.map(r => Object.assign({}, r)); const inAll = new Set(all.map(r => String(r.id)));
  if (S) for (const g of S.games) if (g.state === 'final' && g.hs !== null && !inAll.has(String(g.id))) { all.push({ id: g.id, season: S.season, date: g.date, home: g.home, away: g.away, hs: g.hs, as: g.as, periods: g.periods, neutral: g.neutral }); inAll.add(String(g.id)); }
  for (const g of games) if (!inAll.has(String(g.id))) { all.push({ id: g.id, season: g.season, date: g.date, home: g.home, away: g.away, hs: g.hs, as: g.as, periods: g.periods, neutral: g.neutral }); inAll.add(String(g.id)); }
  all.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  for (const g of all) { m.newSeason(g.season); elo[g.id] = m.play(g); }
  return { games, elo, eloModel: m, state: S };
}

/* ---------- the replay ---------- */
const regGoals = (g, side) => { const w = g.hs > g.as ? 'home' : 'away'; const n = side === 'home' ? g.hs : g.as; return g.periods > 3 && side === w ? n - 1 : n; };
/* a side's shots on goal: what the other side's goalies faced */
const shotsFor = (g, side) => g.goalies.filter(x => x.team === g[side === 'home' ? 'away' : 'home']).reduce((a, x) => a + x.sa, 0);

class Model {
  constructor(P) { this.p = P; this.r = {}; this.season = null; this.hist = {}; this.last = {}; }
  player(id, name, pos, team) {
    let x = this.r[id];
    if (!x) x = this.r[id] = { name, pos, team, o: pos === 'G' ? 0 : this.p.rookie, d: pos === 'G' ? 0 : this.p.rookie, gk: pos === 'G' ? this.p.rookieG : 0, gp: 0, toi: [], seasons: {} };
    x.name = name; x.pos = pos; x.team = team; return x;
  }
  newSeason(season) {
    if (this.season !== null && season !== this.season) {
      for (const [id, x] of Object.entries(this.r)) { x.seasons[this.season] = +(x.pos === 'G' ? x.gk : (x.o + x.d) * LEAGUE.conv).toFixed(3); x.o *= this.p.carry; x.d *= this.p.carry; x.gk *= this.p.carry; }
    }
    this.season = season;
  }
  /* a side's attack, defence and goalie from a lineup of {id, share} and a goalie id */
  strength(lineup, goalieId) {
    let o = 0, d = 0;
    for (const l of lineup) { const x = this.r[l.id]; if (x) { o += x.o * l.share; d += x.d * l.share; } }
    const g = this.r[goalieId]; return { o, d, gk: g ? g.gk : 0 };
  }
  /* shares from the box (actual minutes): five shares across the skaters who dressed */
  static actualShares(box, team) {
    const sk = box.skaters.filter(s => s.team === team); const tot = sk.reduce((a, s) => a + s.toi, 0) || 1;
    return sk.map(s => ({ id: s.id, share: 5 * s.toi / tot }));
  }
  /* shares from each player's recent games: the lineup that dressed, minutes projected */
  projectedShares(box, team) {
    const sk = box.skaters.filter(s => s.team === team);
    const est = sk.map(s => { const x = this.r[s.id]; const t = x && x.toi.length ? x.toi.reduce((a, b) => a + b, 0) / x.toi.length : 600; return { id: s.id, t }; });
    const tot = est.reduce((a, s) => a + s.t, 0) || 1;
    return est.map(s => ({ id: s.id, share: 5 * s.t / tot }));
  }
  /* the goalie who played most of the game */
  static goalieOf(box, team) { const gs = box.goalies.filter(g => g.team === team).sort((a, b) => b.toi - a.toi); return gs[0] ? gs[0].id : null; }
  /* expected goals each side, from strengths */
  means(H, A, neutral) {
    const sh = Math.max(10, LEAGUE.shots / 2 + H.o - A.d), sa = Math.max(10, LEAGUE.shots / 2 + A.o - H.d);
    return { sh, sa, lh: Math.max(0.5, sh * LEAGUE.conv - A.gk + (neutral ? 0 : this.p.hfa)), la: Math.max(0.5, sa * LEAGUE.conv - H.gk) };
  }
  /* the view of a game before it is played, on the shares given */
  predict(g, hs, as, hg, ag, eloDiff) {
    const H = this.strength(hs, hg), A = this.strength(as, ag);
    const { lh, la, sh, sa } = this.means(H, A, g.neutral);
    const G = goals(lh + la, lh - la, eloDiff, model.pull);
    const pG = homeByGoals(G), pE = expected(eloDiff);
    return { lh, la, sh, sa, pHome: (1 - this.p.blend) * pG + this.p.blend * pE, pGoals: pG, mu: lh - la, total: lh + la, tie: G.tie };
  }
  /* rate a finished game: the surprise on each side moves who was on the ice */
  play(box, view) {
    const P = this.p;
    for (const side of ['home', 'away']) {
      const team = box[side], other = side === 'home' ? 'away' : 'home';
      const shots = shotsFor(box, side);
      if (shots > 5) {
        const surprise = Math.max(-P.clip, Math.min(P.clip, shots - (side === 'home' ? view.sh : view.sa)));
        const own = Model.actualShares(box, team), opp = Model.actualShares(box, box[other]);
        const w = l => Math.pow(l.share / 5, P.pow);
        const wo = own.reduce((a, l) => a + w(l), 0) || 1, wd = opp.reduce((a, l) => a + w(l), 0) || 1;
        for (const l of own) { const x = this.r[l.id]; if (x) x.o += P.K * surprise * w(l) / wo * 5; }
        for (const l of opp) { const x = this.r[l.id]; if (x) x.d -= P.K * surprise * w(l) / wd * 5; }
      }
      /* the goalies who played, each on the shots he faced: a save above the league's rate is his */
      for (const gl of box.goalies.filter(x => x.team === box[other] && x.toi > 0)) {
        const x = this.r[gl.id]; if (!x) continue;
        const surprise = Math.max(-P.clipG, Math.min(P.clipG, gl.ga - (gl.sa * LEAGUE.conv - x.gk * gl.toi / 3600)));
        x.gk -= P.Kg * surprise;
      }
    }
    for (const s of box.skaters) { const x = this.player(s.id, s.name, s.pos, s.team); x.gp++; x.toi.push(s.toi); if (x.toi.length > P.recent) x.toi.shift(); }
    for (const gl of box.goalies) { const x = this.player(gl.id, gl.name, 'G', gl.team); if (gl.toi > 1200) x.gp++; }
    for (const side of ['home', 'away']) this.last[box[side]] = box;
  }
}

/* replay in date order; `mode` is how the pre-game lineup is known: 'projected' (dressed, minutes
   from recent games), 'actual' (the box's minutes) or 'last' (the club's previous game, nothing
   known tonight). Returns per-game records for scoring, and the model after the last game */
function replay(P, games, elo, mode, collect) {
  const m = new Model(P); const recs = [];
  for (const g of games) {
    m.newSeason(g.season);
    for (const s of g.skaters) m.player(s.id, s.name, s.pos, s.team);
    for (const gl of g.goalies) m.player(gl.id, gl.name, 'G', gl.team);
    let hs, as, hg, ag;
    if (mode === 'actual') { hs = Model.actualShares(g, g.home); as = Model.actualShares(g, g.away); hg = Model.goalieOf(g, g.home); ag = Model.goalieOf(g, g.away); }
    else if (mode === 'last') { const lh = m.last[g.home], la = m.last[g.away]; hs = lh ? m.projectedShares(lh, g.home) : m.projectedShares(g, g.home); as = la ? m.projectedShares(la, g.away) : m.projectedShares(g, g.away); hg = lh ? Model.goalieOf(lh, g.home) : Model.goalieOf(g, g.home); ag = la ? Model.goalieOf(la, g.away) : Model.goalieOf(g, g.away); }
    else { hs = m.projectedShares(g, g.home); as = m.projectedShares(g, g.away); hg = Model.goalieOf(g, g.home); ag = Model.goalieOf(g, g.away); }
    const e = elo[g.id]; const view = m.predict(g, hs, as, hg, ag, e ? e.diff : 0);
    /* id, sh, sa, lh, la: the pre-game view's expected shots and goals each side, which props.js reads (never the score's) */
    if (collect) recs.push({ id: g.id, season: g.season, pHome: view.pHome, pElo: e ? e.pHome : 0.5, mu: view.mu, total: view.total, margin: g.hs - g.as, tot: g.hs + g.as, win: g.hs > g.as ? 1 : 0, sh: view.sh, sa: view.sa, lh: view.lh, la: view.la });
    /* the update always uses what actually happened */
    const real = mode === 'actual' ? view : m.predict(g, Model.actualShares(g, g.home), Model.actualShares(g, g.away), Model.goalieOf(g, g.home), Model.goalieOf(g, g.away), e ? e.diff : 0);
    m.play(g, real);
  }
  return { m, recs };
}
function score(recs, pick, key = 'pHome') {
  const r = recs.filter(pick); let ll = 0, acc = 0, mae = 0, tmae = 0;
  for (const x of r) { const p = Math.min(0.999, Math.max(0.001, x[key])); ll -= x.win * Math.log(p) + (1 - x.win) * Math.log(1 - p); acc += (p >= 0.5) === (x.win === 1) ? 1 : 0; mae += Math.abs(x.margin - x.mu); tmae += Math.abs(x.tot - x.total); }
  return { n: r.length, logloss: +(ll / r.length).toFixed(4), acc: +(acc / r.length).toFixed(4), marginMae: +(mae / r.length).toFixed(3), totalMae: +(tmae / r.length).toFixed(3) };
}
function fit(games, elo, fitFrom, fitTo, start) {
  let P = Object.assign({}, start);
  const inFit = x => x.season > fitFrom && x.season <= fitTo;
  const lossOf = p => score(replay(p, games, elo, 'projected', true).recs, inFit).logloss;
  let best = lossOf(P), moved = true, pass = 0;
  while (moved && pass < 5) {
    moved = false; pass++;
    for (const k of Object.keys(GRID)) for (const v of GRID[k]) { if (v === P[k]) continue; const q = Object.assign({}, P, { [k]: v }); const l = lossOf(q); if (l < best - 1e-6) { best = l; P = q; moved = true; } }
    log(`fit ${fitFrom + 1}-${fitTo} pass ${pass}: log loss ${best.toFixed(5)} ${JSON.stringify(P)}`);
  }
  return P;
}

/* ---------- tonight: WHO PLAYS ---------- */
/* Out, injured reserve (long-term too) and suspensions keep a player out; day-to-day does not */
const OUT_RE = /\bout\b|injured reserve|\bir\b|\bltir\b|suspen/i;
const DTD_RE = /day.to.day|questionable/i;
const STATUS_RANK = { Confirmed: 3, Likely: 2, Unconfirmed: 1 };
const HOW = { Confirmed: 'confirmed by DailyFaceoff', Likely: 'likely, says DailyFaceoff', Unconfirmed: "DailyFaceoff's projection, unconfirmed" };

/* the injury report against the rated players: each row to an id by ESPN id, else by the club and
   the name, else by a name only one rated player has */
function readInjuries(m, injuries) {
  const byTeamName = new Map(), byName = new Map();
  const push = (map, k, v) => { if (!map.has(k)) map.set(k, []); map.get(k).push(v); };
  for (const [id, x] of Object.entries(m.r)) { const n = E.normName(x.name); if (n) { push(byTeamName, x.team + '|' + n, id); push(byName, n, id); } }
  const resolve = (code, row) => {
    if (row.id && /^\d+$/.test(String(row.id))) return m.r[row.id] ? String(row.id) : null;   // an id is the player's: no name guess past it
    const n = E.normName(row.name); if (!n) return null;
    const t = byTeamName.get(code + '|' + n); if (t && t.length === 1) return t[0];
    const a = byName.get(n); return a && a.length === 1 ? a[0] : null;
  };
  const byClub = {}, outIds = new Set(), listedAt = new Map(); let rows = 0, withId = 0, matched = 0;
  for (const [code, list] of Object.entries((injuries && injuries.teams) || {})) {
    byClub[code] = [];
    for (const row of list || []) {
      rows++; if (row.id && /^\d+$/.test(String(row.id))) withId++;
      const id = resolve(code, row); if (id) matched++;
      const out = OUT_RE.test(row.status || ''), dtd = !out && DTD_RE.test(row.status || '');
      byClub[code].push({ id, name: row.name, pos: row.pos, status: row.status, returns: row.returns || null, out, dtd });
      if (id) { if (out) outIds.add(id); listedAt.set(id, code); }
    }
  }
  return { byClub, outIds, listedAt, stats: { rows, withId, matched, out: outIds.size } };
}

/* each club's goalies ranked: this season's starts in its last ten games, then appearances this
   season, then last season's starts for the club, then the latest start, then games and rating.
   Only a goalie who played for the club this season or last (or is on its report and not out):
   never one who is out, now elsewhere, or long gone */
function goalieRanks(m, games, season, inj) {
  const ranks = {}, startOf = {};
  const byClub = {}; for (const g of games) for (const t of [g.home, g.away]) (byClub[t] = byClub[t] || []).push(g);
  for (const code of E.TEAMS) {
    const boxes = byClub[code] || [];
    const now = boxes.filter(g => g.season === season).slice(-10), before = boxes.filter(g => g.season === season - 1);
    const starts = {}, apps = {}, lastSeason = {}, latest = {}, recent = new Set();
    for (const b of now) { const id = Model.goalieOf(b, code); if (id) starts[id] = (starts[id] || 0) + 1; }
    for (const b of boxes.filter(g => g.season === season)) for (const x of b.goalies) if (x.team === code && x.toi > 0) apps[x.id] = (apps[x.id] || 0) + 1;
    for (const b of before) { const id = Model.goalieOf(b, code); if (id) lastSeason[id] = (lastSeason[id] || 0) + 1; }
    for (const b of boxes) { const id = Model.goalieOf(b, code); if (id) { latest[id] = b.date; startOf[b.id + '|' + code] = id; } if (b.season >= season - 1) for (const x of b.goalies) if (x.team === code && x.toi > 0) recent.add(x.id); }
    const ids = new Set(Object.entries(m.r).filter(([id, x]) => x.pos === 'G' && x.team === code && recent.has(id)).map(([id]) => id));
    for (const [id, c] of inj.listedAt) if (c === code && m.r[id] && m.r[id].pos === 'G') ids.add(id);     // on this club's report and not out: his
    ranks[code] = [...ids].filter(id => !inj.outIds.has(id) && !(inj.listedAt.has(id) && inj.listedAt.get(id) !== code))
      .map(id => ({ id, starts: starts[id] || 0, of: now.length, apps: apps[id] || 0, lastSeason: lastSeason[id] || 0, latest: latest[id] || '', gp: m.r[id].gp, gk: m.r[id].gk }))
      .sort((a, b) => b.starts - a.starts || b.apps - a.apps || b.lastSeason - a.lastSeason || (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0) || b.gp - a.gp || b.gk - a.gk);
  }
  return { ranks, startOf };
}

/* DailyFaceoff's goalie for a club in one game: the entry for that game's date (and id, when it
   carries one), the strongest status if there are two */
function announcedFor(starters, code, g) {
  let best = null;
  for (const e of (starters && starters.games) || []) {
    if (e.date !== g.date || (e.id && String(e.id) !== String(g.id))) continue;
    const side = e.home === code ? e.homeGoalie : e.away === code ? e.awayGoalie : null;
    if (!side || !side.name) continue;
    if (!best || (STATUS_RANK[side.status] || 0) > (STATUS_RANK[best.status] || 0)) best = side;
  }
  return best;
}

function lineups(m, games, S, injuries, starters) {
  const inj = readInjuries(m, injuries);
  const { ranks, startOf } = goalieRanks(m, games, S.season, inj);
  const goalieIds = new Map(); for (const [id, x] of Object.entries(m.r)) if (x.pos === 'G') { const n = E.normName(x.name); if (!goalieIds.has(n)) goalieIds.set(n, []); goalieIds.get(n).push(id); }
  const nameToGoalie = (code, name) => { const c = goalieIds.get(E.normName(name)) || []; const own = c.filter(id => m.r[id].team === code); return own.length === 1 ? own[0] : c.length === 1 ? c[0] : null; };
  const avgToi = x => x && x.toi && x.toi.length ? x.toi.reduce((a, b) => a + b, 0) / x.toi.length : 600;
  const sched = {}; for (const g of S.games.slice().sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0)) for (const t of [g.home, g.away]) (sched[t] = sched[t] || []).push(g);
  const boxed = new Set(games.map(g => String(g.id)));
  const lastFinal = {}; for (const g of S.games) if (g.state === 'final') for (const t of [g.home, g.away]) if (!lastFinal[t] || g.date > lastFinal[t]) lastFinal[t] = g.date;
  const teams = {}, perGame = {}; let announcedUsed = 0;
  const startsText = r => r.starts ? `most starts, ${r.starts} of the last ${r.of}` : r.lastSeason ? "last season's starter for the club" : "the club's goalie";
  for (const code of E.TEAMS) {
    const last = m.last[code];
    const elsewhere = id => (inj.listedAt.has(id) && inj.listedAt.get(id) !== code) || (m.r[id] && m.r[id].team !== code);
    const dressed = last ? last.skaters.filter(s => s.team === code && !inj.outIds.has(s.id) && !elsewhere(s.id)) : [];
    const est = dressed.map(s => ({ id: s.id, t: avgToi(m.r[s.id]) }));
    const tot = est.reduce((a, s) => a + s.t, 0) || 1;
    const shares = est.map(s => ({ id: s.id, share: 5 * s.t / tot }));
    const rep = inj.byClub[code] || [];
    const out = rep.filter(r => r.out).map(r => { const x = r.id && m.r[r.id]; return { id: r.id, name: r.name, pos: r.pos || (x && x.pos) || null, status: r.status, returns: r.returns, cost: x && x.pos !== 'G' ? +((x.o + x.d) * LEAGUE.conv * 5 * avgToi(x) / tot).toFixed(2) : null }; });
    const dtd = rep.filter(r => r.dtd).map(r => ({ id: r.id, name: r.name, pos: r.pos }));
    const R = ranks[code];
    /* the goalie, game by game in date order, each back to back read off the game before it */
    const expectedBy = {};
    const choose = g => {
      const ann = announcedFor(starters, code, g);
      if (ann) {
        let id = nameToGoalie(code, ann.name);
        /* a first NHL start: a rookie's rating. He is no rated player, so the report's rows never resolve to him (an id row is
           its own player's alone): one his club's report has out by his name is refused as a rated goalie out is, unless confirmed */
        const outHere = !id && rep.some(r => r.out && E.normName(r.name) === E.normName(ann.name));
        if (!id && (ann.status === 'Confirmed' || (ann.status === 'Likely' && !outHere))) {
          id = 'new:' + E.normName(ann.name).replace(/ /g, '-');
          if (!m.r[id]) m.r[id] = { name: ann.name, pos: 'G', team: code, o: 0, d: 0, gk: m.p.rookieG, gp: 0, toi: [], seasons: {}, debut: true };
        }
        if (id && (!inj.outIds.has(id) || ann.status === 'Confirmed')) { announcedUsed++; return { id, how: HOW[ann.status] || `named by DailyFaceoff (${ann.status || 'no status'})`, announced: ann.status || 'named' }; }
      }
      if (!R.length) return null;
      const list = sched[code] || []; const i = list.findIndex(x => x.id === g.id);
      const prev = i > 0 && daysBetween(list[i - 1].date, g.date) === 1 ? list[i - 1] : null;
      /* that night's goalie: the box score's starter once it is boxed, else the one expected for it (the
         same choice, DailyFaceoff's for that game first), whether it is to come, under way or over */
      const yesterday = prev ? (expectedBy[prev.id] || R[0].id) : null;
      if (prev && yesterday === R[0].id && R.length > 1) return { id: R[1].id, how: 'back to back: the other goalie', b2b: true };
      return { id: R[0].id, how: startsText(R[0]) };
    };
    let next = null;
    for (const g of sched[code] || []) {
      if (boxed.has(String(g.id))) { expectedBy[g.id] = startOf[g.id + '|' + code] || null; continue; }   // played and boxed: who started it
      const c = choose(g); expectedBy[g.id] = c ? c.id : null;
      if (g.state === 'final') continue;                       // over and not yet boxed: only the night after reads it
      perGame[g.id + '|' + code] = c;
      if (!next) next = c;
    }
    if (!next && R.length) next = { id: R[0].id, how: startsText(R[0]) };
    const gOf = c => c ? Object.assign({ id: c.id, name: m.r[c.id].name, gk: +m.r[c.id].gk.toFixed(3), how: c.how }, c.announced ? { announced: c.announced } : {}, m.r[c.id].debut ? { debut: true } : {}) : null;
    const S1 = m.strength(shares, next ? next.id : null);
    teams[code] = { offence: +(S1.o * LEAGUE.conv).toFixed(3), defence: +(S1.d * LEAGUE.conv).toFixed(3), goalie: gOf(next), strength: +((S1.o + S1.d) * LEAGUE.conv + S1.gk).toFixed(3), out, dtd,
      lastBox: last ? last.date : null, lastFinal: lastFinal[code] || null,
      lineup: shares.map(s => ({ id: s.id, name: m.r[s.id].name, pos: m.r[s.id].pos, share: +s.share.toFixed(2), v: +((m.r[s.id].o + m.r[s.id].d) * LEAGUE.conv * s.share).toFixed(3) })).sort((a, b) => b.share - a.share),
      _shares: shares,
      _side: c => { const s = m.strength(shares, c ? c.id : null); return { goalie: gOf(c), out, dtd, strength: +((s.o + s.d) * LEAGUE.conv + s.gk).toFixed(3), lastBox: last ? last.date : null, lastFinal: lastFinal[code] || null }; } };
  }
  return { teams, perGame, inj, announcedUsed };
}

function main() {
  const { games, elo, eloModel, state: S } = loadGames();
  const seasons = [...new Set(games.map(g => g.season))].sort();
  const last = seasons[seasons.length - 1];
  const prev = fs.existsSync(OUTF) ? JSON.parse(fs.readFileSync(OUTF, 'utf8')) : null;
  log(`${games.length} games with box scores, seasons ${seasons[0]}-${last}`);
  const refit = process.argv[2] === 'fit' || !prev;
  const HOLD = last > FIT_TO ? FIT_TO + 1 : last;                    // the newest complete season is held out; this season is scored as it goes
  let P = prev && !refit ? prev.params : fit(games, elo, WARM, HOLD - 1, DEFAULT);
  /* the report: fit seasons, the holdout three ways, and the team Elo on the same games */
  const proj = replay(P, games, elo, 'projected', true);
  const inFit = x => x.season > WARM && x.season < HOLD, inHold = x => x.season === HOLD;
  const report = { fitSeasons: `${WARM + 1}-${HOLD - 1}`, holdout: HOLD, fit: score(proj.recs, inFit), holdoutKnown: score(proj.recs, inHold), holdoutTeam: score(proj.recs, inHold, 'pElo'),
    holdoutLast: score(replay(P, games, elo, 'last', true).recs, inHold), holdoutActual: score(replay(P, games, elo, 'actual', true).recs, inHold) };
  /* walk-forward: each season from 2024 called by parameters searched on the seasons before it */
  const walk = prev && !refit && prev.report && prev.report.walk ? prev.report.walk : {};
  if (refit) for (const s of seasons.filter(s => s >= 2024 && s <= HOLD)) {
    const Ps = fit(games.filter(g => g.season < s), elo, WARM, s - 1, P);
    const r = replay(Ps, games.filter(g => g.season <= s), elo, 'projected', true).recs;
    walk[s] = { player: score(r, x => x.season === s), team: score(r, x => x.season === s, 'pElo'), params: Ps };
  }
  report.walk = walk;
  const ws = Object.values(walk);
  report.use = ws.length >= 2 && ws.every(w => w.player.logloss <= w.team.logloss + 0.002) && ws.reduce((a, w) => a + w.player.logloss, 0) < ws.reduce((a, w) => a + w.team.logloss, 0);
  log(`fit ${report.fit.n} games: log loss ${report.fit.logloss}, ${(report.fit.acc * 100).toFixed(1)}% | holdout ${HOLD}: known ${report.holdoutKnown.logloss}/${(report.holdoutKnown.acc * 100).toFixed(1)}%, last game ${report.holdoutLast.logloss}, actual ${report.holdoutActual.logloss}, team Elo ${report.holdoutTeam.logloss}/${(report.holdoutTeam.acc * 100).toFixed(1)}%`);
  for (const [s, w] of Object.entries(walk)) log(`walk-forward ${s}: player ${w.player.logloss}/${(w.player.acc * 100).toFixed(1)}% vs team ${w.team.logloss}/${(w.team.acc * 100).toFixed(1)}%`);
  log(`the site's call is the ${report.use ? 'player model' : 'team Elo'}`);

  /* tonight: the model after the last final, this season's injuries and starters */
  const m = proj.m;
  const injuries = fs.existsSync(path.join(DATA, 'injuries.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'injuries.json'), 'utf8')) : { teams: {} };
  const starters = fs.existsSync(path.join(DATA, 'starters.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'starters.json'), 'utf8')) : null;
  const today = process.env.NHL_TODAY || E.etDate(new Date());
  const upcoming = {}; let teams = {}; let injMeta = null, stMeta = null;
  if (S) {
    const L = lineups(m, games, S, injuries, starters); teams = L.teams;
    /* the team Elo's gap on each game, from this file's own replay of every final (update.js's first
       pass copies the last state's calls, so a row's `diff` is the last run's, or none on a new game) */
    eloModel.newSeason(S.season);
    for (const g of S.games) {
      if (g.state === 'final') continue;
      const th = teams[g.home], ta = teams[g.away];
      const ch = L.perGame[g.id + '|' + g.home], ca = L.perGame[g.id + '|' + g.away];
      const diff = eloModel.predict(g).diff;
      const v = m.predict(g, th._shares, ta._shares, ch ? ch.id : null, ca ? ca.id : null, diff);
      /* `inj`: the injury report this lineup was built on, so the page and the smoke can hold it to that report */
      /* sh, sa, lh, la: each side's expected shots on goal and goals, which props.js reads for its projections */
      upcoming[g.id] = { pHome: +v.pHome.toFixed(4), pGoals: +v.pGoals.toFixed(4), mu: +v.mu.toFixed(2), total: +v.total.toFixed(2), tie: +v.tie.toFixed(3), diff: +diff.toFixed(2),
        sh: +v.sh.toFixed(2), sa: +v.sa.toFixed(2), lh: +v.lh.toFixed(3), la: +v.la.toFixed(3),
        home: th._side(ch), away: ta._side(ca), inj: injuries.pulled || null };
    }
    for (const t of Object.values(teams)) { delete t._shares; delete t._side; }
    injMeta = Object.assign({ pulled: injuries.pulled || null }, L.inj.stats);
    stMeta = { pulled: (starters && starters.pulled) || null, ok: starters ? starters.ok !== false : null, why: (starters && starters.why) || null,
      games: ((starters && starters.games) || []).filter(e => e.date >= today).length, used: L.announcedUsed };
    log(`injury report ${injMeta.pulled || 'none'}: ${injMeta.rows} rows, ${injMeta.withId} with an ESPN id, ${injMeta.matched} matched to a rated player, ${injMeta.out} out; DailyFaceoff: ${stMeta.games} games from today named, ${stMeta.used} goalies taken from it${stMeta.ok === false ? ` (${stMeta.why})` : ''}`);
  }
  const players = {};
  for (const [id, x] of Object.entries(m.r)) {
    if (x.debut || (x.gp < 5 && Object.keys(x.seasons).length === 0)) continue;
    players[id] = { name: x.name, pos: x.pos, team: x.team, o: +(x.o * LEAGUE.conv).toFixed(3), d: +(x.d * LEAGUE.conv).toFixed(3), gk: +x.gk.toFixed(3), v: +(x.pos === 'G' ? x.gk : (x.o + x.d) * LEAGUE.conv).toFixed(3), gp: x.gp, toi: x.toi.length ? Math.round(x.toi.reduce((a, b) => a + b, 0) / x.toi.length) : 0, seasons: x.seasons };
  }
  const out = { params: P, league: { shots: +LEAGUE.shots.toFixed(2), conv: +LEAGUE.conv.toFixed(4) }, report, asOf: games[games.length - 1].date, season: last, games: games.length, players, teams, upcoming,
    injuries: injMeta, starters: stMeta, generated: prev ? prev.generated : null };
  const same = prev && JSON.stringify(Object.assign({}, prev, { generated: null })) === JSON.stringify(Object.assign({}, out, { generated: null }));
  out.generated = same ? prev.generated : new Date().toISOString().slice(0, 16) + 'Z';
  if (!same) fs.writeFileSync(OUTF, JSON.stringify(out));
  const top = Object.values(players).filter(p => p.pos !== 'G' && p.gp >= 20).sort((a, b) => b.v - a.v).slice(0, 5).map(p => `${p.name} ${p.v}`).join(', ');
  const topG = Object.values(players).filter(p => p.pos === 'G' && p.gp >= 10).sort((a, b) => b.v - a.v).slice(0, 3).map(p => `${p.name} ${p.v}`).join(', ');
  log(`players.json: ${Object.keys(players).length} players, ${Object.keys(upcoming).length} upcoming, ${same ? 'unchanged' : 'written'}. Top skaters: ${top}. Top goalies: ${topG}`);
}
if (require.main === module) main();
module.exports = { loadGames, replay, Model, LEAGUE, regGoals, shotsFor };
