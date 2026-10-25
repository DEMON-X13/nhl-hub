/* THE PROPS MODEL: every expected skater's goals, assists, points, shots on goal and blocked shots, and every
   expected goalie's saves, as a mean and a full distribution, for each game still to come through tomorrow
   (Eastern); the record of DraftKings' closing props; and the shadow ledger that puts the model on trial against
   them. On the page it is ON TRIAL: shown beside DraftKings' line with DraftKings' own fair chance, never put in a
   parlay, a pick or a level, and never called "model says" or an edge, until the ledger's pre-registered bar is
   passed (and then only by a change of its own).

   A skater's rate of each stat per hour on the ice is his decayed history (half-life H games, carried part way
   between seasons) shrunk toward his position's (forwards apart from defencemen) by M pseudo-hours; his mean for a
   game is that rate times his expected minutes (the mean of his last eight games, as players.js projects them)
   times a context factor from players.js's own view of the game, (x / its average)^e: his side's expected goals for
   goals, assists and points, his side's expected shots for shots, the other side's for blocked shots. Each count
   is negative binomial with a dispersion r for the stat (Poisson where r is null). A goalie's saves are the shots
   players.js expects against his side, to the power e over its average, times his save rate (decayed, shrunk to
   the league's by M shots) times a share (the starts that end early), a normal with a fitted sd, rounded to whole
   saves; it is fitted and scored on each side's starter (the box files' mark, read from ESPN's plays), pulled or not,
   as the page projects him and the ledger grades him, and a goalie's history is his starts. Every constant is chosen
   by a grid search on the log-likelihood of finished seasons only (2022-23 on, 2021-22 warming up); `node
   tools/props.js fit` searches them again and writes data/props_model.json, which is SOURCE: the job reads it and
   never refits, so nothing is ever tuned on the season in play.

   The fit also scores the model honestly and writes the numbers beside the constants: walk-forward (each season
   from 2023-24 scored by constants searched only on the seasons before it, and the context from players.js's
   parameters searched only on those seasons too) against a naive own-average (a player's own goals, shots... a
   game over all his earlier games, Poisson; a goalie's own saves a start), and against DraftKings' archived
   closing prices (the record below: the 2026 playoffs by the model fitted through 2024-25, 2026-27 so far by the
   model the job runs): log loss and Brier against DraftKings' fair chance, the bias, and flat bets at a few edge
   bars with Overs and Unders apart. It also measures how DraftKings' margin is best taken out of a main line
   (proportional, all of it on the Over, the power method) on the finished seasons' record (this season's beside it),
   and the margin on its Yes-only prices on every price recorded (the market's, in sample, shown only marked est.).

   The record (data/props_<season>.jsonl, written by this tool only): once a game is final the job reads its
   closing props once (one request, free; ESPN keeps a finished game's items at their last price before the puck
   drop) and appends DraftKings' main lines (athlete, stat, line, Over price, Under price) and its Yes-only ladders
   (athlete, stat, k, price), parsed by tools/espn.js's propsOf (the first item of a pair is the Over, checked with
   the ladder). A 404 ("No propBets found") is written as none and not asked again; a request that fails is asked
   again next run. `--backfill` reads every final ESPN still serves (from 16 April 2026) once.

   The shadow ledger (data/props_ledger.json, written by this tool only): for every game it projects, one call: the
   model's mean for each player and stat as the page shows it (the distribution is a function of the mean and the
   registered constants), rewritten by a run before the puck drop whenever it changes and frozen by the first run
   at or after it, never changed after. Once the game is final, boxed and its closing props recorded, every
   DraftKings main line on a projected player who played is graded: the model's chance of the Over, DraftKings'
   fair chance (all of the margin on the Over: 1 - the Under's implied chance), and the result from the box score.
   The bar (BAR below, its words and its numbers) was written into the ledger before its first call, and the verdict is
   judged by the ledger's own copy of its numbers; props_check.js fails the run if a frozen call moved, a grade is
   wrong, the bar changed or the verdict does not follow.

    node tools/props.js              the job's step: record new finals' closing props, grade, freeze and make calls,
                                     project every game to come through tomorrow -> data/props.json
    node tools/props.js fit          search the constants on the finished seasons, walk-forward and the market test
                                     -> data/props_model.json (a deliberate refit, committed with it)
    node tools/props.js --backfill   every final since 16 April 2026 that the record lacks, read once

   NHL_DATA, NHL_STATE, NHL_NOW and NHL_TODAY move the files and the clock; NHL_FIXTURES reads saved answers
   (simulate.js); NHL_PROPS_ASK caps how many finals one run asks for (40). */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const E = require('./espn');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.NHL_DATA || path.join(ROOT, 'data');
const STATE_F = process.env.NHL_STATE || path.join(ROOT, 'state.json');
const MODEL_F = path.join(DATA, 'props_model.json'), OUT_F = path.join(DATA, 'props.json'), LEDGER_F = path.join(DATA, 'props_ledger.json');
const NOW = process.env.NHL_NOW || (process.env.NHL_TODAY ? process.env.NHL_TODAY + 'T12:00Z' : new Date().toISOString().slice(0, 16) + 'Z');
const TODAY = process.env.NHL_TODAY || E.etDate(NOW);
const ASK = +(process.env.NHL_PROPS_ASK || 40);
const ARCHIVE_FROM = '2026-04-16';                 // the earliest final ESPN still served props for on 15 October 2026
const WARM = 2022, FIRST_TEST = 2024;              // 2021-22 warms up; walk-forward scores 2023-24 on
const STATS = ['g', 'a', 'pts', 's', 'bs'];
const SHOT_STATS = new Set(['s', 'bs']);           // need the box files' shots and blocks (kept from 15 October 2026, every season read again)
const CTX = { g: 'xg', a: 'xg', pts: 'xg', s: 'xs', bs: 'oxs' };
const TOI = { recent: 8, F: 12, D: 17 };           // expected minutes: the last eight games; a player with none, 12 a forward, 17 a defenceman
const log = m => console.log(new Date().toISOString().slice(11, 19), m);
const warn = m => { log(m); if (process.env.GITHUB_ACTIONS) console.log(`::warning title=nhl props::${m}`); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const r3 = x => Math.round(x * 1000) / 1000, r4 = x => Math.round(x * 10000) / 10000, r6 = x => Math.round(x * 1e6) / 1e6;
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const grp = pos => pos === 'D' ? 'D' : 'F';

/* ---------- the distributions ---------- */
/* P(X = k) for k = 0..K: negative binomial with mean mu and dispersion r (r null: Poisson) */
function pmf(mu, r, K) {
  mu = Math.max(mu, 1e-9); const out = new Array(K + 1);
  if (r === null || r === undefined) { out[0] = Math.exp(-mu); for (let k = 1; k <= K; k++) out[k] = out[k - 1] * mu / k; }
  else { const q = mu / (r + mu); out[0] = Math.exp(r * Math.log(r / (r + mu))); for (let k = 1; k <= K; k++) out[k] = out[k - 1] * (k - 1 + r) / k * q; }
  return out;
}
/* the standard normal's upper tail, to 1e-7 (Numerical Recipes' erfc) */
function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
  const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? r : 2 - r; }
const Phi = x => 1 - 0.5 * erfc(x / Math.SQRT2);
/* real numbers to whole parts of 10,000 that sum to exactly 10,000 (largest remainder; ties to the lower index) */
function toBasis(ps) {
  const tot = ps.reduce((a, b) => a + b, 0), raw = ps.map(p => p / tot * 10000), fl = raw.map(Math.floor);
  let left = 10000 - fl.reduce((a, b) => a + b, 0);
  const order = raw.map((x, i) => [x - fl[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let i = 0; left > 0; i++, left--) fl[order[i % order.length][1]]++;
  return fl;
}
/* a stat's full distribution for a mean, as the page and the ledger read it: { lo, d }, d in parts of 10,000 summing
   to exactly 10,000; d[0] is P(X <= lo), d[i] is P(X = lo + i), and the last is P(X >= its value). A skater's from 0 to
   the first count whose tail is under 0.05%; a goalie's saves from four sds below the mean to four above */
function dist(stat, mu, C) {
  if (stat === 'sv') {
    const sd = C.gk.sd, lo = Math.max(0, Math.floor(mu - 4 * sd)), hi = Math.ceil(mu + 4 * sd), ps = [];
    for (let k = lo; k <= hi; k++) ps.push(k === lo ? Phi((k + 0.5 - mu) / sd) : k === hi ? 1 - Phi((k - 0.5 - mu) / sd) : Phi((k + 0.5 - mu) / sd) - Phi((k - 0.5 - mu) / sd));
    return { lo, d: toBasis(ps) };
  }
  const r = C.sk[stat].r; let K = 2;
  for (;;) { const p = pmf(mu, r, K), tail = 1 - p.reduce((a, b) => a + b, 0); if (tail < 0.0005 || K >= 40) { p.push(Math.max(0, tail)); return { lo: 0, d: toBasis(p) }; } K++; }
}
/* the chance of the Over at line L from a distribution: P(X >= floor(L) + 1), a share of 10,000 summed */
function pOver(D, L) {
  const k = Math.floor(L) + 1, top = D.lo + D.d.length - 1;
  if (k > top) return 0;
  let s = 0; for (let i = 0; i < D.d.length; i++) { const v = D.lo + i; if (v >= k || (i === 0 && k <= D.lo)) s += D.d[i]; }
  return s / 10000;
}
const implied = am => am > 0 ? 100 / (am + 100) : -am / (-am + 100);
const payout = am => am > 0 ? am / 100 : 100 / -am;
/* DraftKings' fair chance of the Over on a main line: all of the margin on the Over, 1 - the Under's implied (it scored
   best on the finished seasons' record; data/props_model.json's report.fair has the comparison) */
const fairOver = (po, pu) => 1 - implied(pu);

/* ---------- the data ---------- */
/* every boxed game in date order, with players.js's pre-game view of it (each side's expected shots and goals)
   from a replay on the parameters given; the views are causal (each game's from the ratings before it) */
function gamesWithViews(PJ, params) {
  const L = PJ.loadGames();
  const r = PJ.replay(params, L.games, L.elo, 'projected', true);
  const view = new Map(r.recs.map(x => [String(x.id), x]));
  return { games: L.games, view, league: Object.assign({}, PJ.LEAGUE), state: L.state, model: r.m };
}
/* a side's starting goalie: the one the box file marks (`st`, read from ESPN's plays by fetch_box.js: the first of its goalies
   to make a save), else the one who played most. The goalie who played most is the reliever when a starter is pulled before
   half the game (425 of the 899 sides that used two goalies, 2021-22 to 15 October 2026), and the model is fitted on, and the
   ledger grades, the starter, pulled or not */
const starterOf = (b, team) => {
  const gs = b.goalies.filter(x => x.team === team && x.toi > 0);
  return gs.find(x => x.st) || gs.sort((x, y) => y.toi - x.toi)[0] || null;
};

/* the walk: every game in date order, each player's decayed sums before the game (one decay track, H and carry), the
   league's by position, and each row's naive own-average. Calls `onSkater` for every skater game and `onGoalie` for every
   goalie who played (`start` says whether he started: the fit and the walk-forward score the starters, the market test
   every goalie DraftKings priced who played, as the ledger grades him) with what was known before it, then updates: a
   goalie's history from his starts alone. Returns the final state, for tonight */
function walk(games, view, track, onSkater, onGoalie) {
  const d = Math.pow(0.5, 1 / track.H), carry = track.carry, LD = Math.pow(0.5, 1 / 500);
  const P = new Map(), G = new Map();
  const lg = { F: { g: 0, a: 0, pts: 0, s: 0, bs: 0, h: 0, hs: 0, n: 0, ns: 0, cnt: { g: 0, a: 0, pts: 0, s: 0, bs: 0 } }, D: { g: 0, a: 0, pts: 0, s: 0, bs: 0, h: 0, hs: 0, n: 0, ns: 0, cnt: { g: 0, a: 0, pts: 0, s: 0, bs: 0 } } };
  const lgG = { sv: 0, sa: 0, n: 0, svTot: 0 };
  let season = null;
  for (const b of games) {
    if (b.season !== season) {
      if (season !== null) { for (const x of P.values()) { for (const k of STATS) x[k] *= carry; x.h *= carry; x.hs *= carry; } for (const x of G.values()) { x.sv *= carry; x.sa *= carry; } }
      season = b.season;
    }
    const v = view.get(String(b.id));
    const shotsKnown = b.skaters.some(s => s.s !== undefined);
    for (const side of ['home', 'away']) {
      const team = b[side];
      const ctx = v ? { xg: side === 'home' ? v.lh : v.la, xs: side === 'home' ? v.sh : v.sa, oxs: side === 'home' ? v.sa : v.sh } : null;
      if (onSkater) for (const s of b.skaters) {
        if (s.team !== team || !(s.toi > 0)) continue;
        const x = P.get(s.id), g = grp(s.pos), L = lg[g];
        const prior = {}; for (const k of STATS) prior[k] = SHOT_STATS.has(k) ? (L.hs ? L[k] / L.hs : 0) : (L.h ? L[k] / L.h : 0);
        const naive = {}; for (const k of STATS) naive[k] = x && (SHOT_STATS.has(k) ? x.cs : x.c) ? x.raw[k] / (SHOT_STATS.has(k) ? x.cs : x.c) : (SHOT_STATS.has(k) ? (L.ns ? L.cnt[k] / L.ns : 0) : (L.n ? L.cnt[k] / L.n : 0));
        const etoi = x && x.toi.length ? x.toi.reduce((a, t) => a + t, 0) / x.toi.length / 60 : TOI[g];
        onSkater({ b, s, x, g, prior, naive, etoi, ctx, shotsKnown });
      }
      if (onGoalie) {
        const st = starterOf(b, team);
        for (const gl of b.goalies) {
          if (gl.team !== team || !(gl.toi > 0)) continue;
          const x = G.get(gl.id);
          const lgsv = lgG.sa ? lgG.sv / lgG.sa : 0.9;
          const naive = x && x.c ? x.rawSv / x.c : (lgG.n ? lgG.svTot / lgG.n : 25);
          onGoalie({ b, gl, start: gl === st, x, lgsv, naive, ctx: v ? { oxs: side === 'home' ? v.sa : v.sh } : null });
        }
      }
    }
    /* the game moves the state */
    for (const s of b.skaters) {
      if (!(s.toi > 0)) continue;
      let x = P.get(s.id);
      if (!x) { x = { g: 0, a: 0, pts: 0, s: 0, bs: 0, h: 0, hs: 0, toi: [], raw: { g: 0, a: 0, pts: 0, s: 0, bs: 0 }, c: 0, cs: 0, pos: s.pos, team: s.team, name: s.name }; P.set(s.id, x); }
      const L = lg[grp(s.pos)], hrs = s.toi / 3600;
      for (const k of ['g', 'a', 'pts']) x[k] *= d;
      x.h *= d;
      const val = { g: s.g || 0, a: s.a || 0, pts: (s.g || 0) + (s.a || 0), s: s.s, bs: s.bs };
      x.g += val.g; x.a += val.a; x.pts += val.pts; x.h += hrs;
      x.raw.g += val.g; x.raw.a += val.a; x.raw.pts += val.pts; x.c++;
      if (shotsKnown) { x.s = x.s * d + (val.s || 0); x.bs = x.bs * d + (val.bs || 0); x.hs = x.hs * d + hrs; x.raw.s += val.s || 0; x.raw.bs += val.bs || 0; x.cs++; }
      x.toi.push(s.toi); if (x.toi.length > TOI.recent) x.toi.shift();
      x.pos = s.pos; x.team = s.team; x.name = s.name;
      for (const k of ['g', 'a', 'pts']) { L[k] = L[k] * LD + val[k]; L.cnt[k] += val[k]; }
      L.h = L.h * LD + hrs; L.n++;
      if (shotsKnown) { for (const k of ['s', 'bs']) { L[k] = L[k] * LD + (val[k] || 0); L.cnt[k] += val[k] || 0; } L.hs = L.hs * LD + hrs; L.ns++; }
    }
    for (const side of ['home', 'away']) {
      const st = starterOf(b, b[side]); if (!st) continue;
      let x = G.get(st.id); if (!x) { x = { sv: 0, sa: 0, rawSv: 0, c: 0, name: st.name, team: st.team }; G.set(st.id, x); }
      const sv = st.sa - st.ga;
      x.sv = x.sv * d + sv; x.sa = x.sa * d + st.sa; x.rawSv += sv; x.c++; x.name = st.name; x.team = st.team;
      lgG.sv = lgG.sv * LD + sv; lgG.sa = lgG.sa * LD + st.sa; lgG.svTot += sv; lgG.n++;
    }
  }
  return { P, G, lg, lgG };
}

/* a skater's mean for one stat, before the game */
function skMean(k, x, prior, etoi, ctx, c) {
  const sum = x ? x[k] : 0, hrs = x ? (SHOT_STATS.has(k) ? x.hs : x.h) : 0;
  const rate = (sum + prior[k] * c.M) / (hrs + c.M);
  const cx = ctx && ctx[CTX[k]] > 0 && c.ctx ? Math.pow(ctx[CTX[k]] / c.ctx, c.e) : 1;
  return rate * etoi / 60 * cx;                 // a rate an hour, expected minutes
}
/* a goalie's saves mean, before the game */
function gkMean(x, lgsv, ctx, c, lgShotsHalf) {
  const svp = ((x ? x.sv : 0) + lgsv * c.M) / ((x ? x.sa : 0) + c.M);
  const xs = ctx && ctx.oxs > 0 ? ctx.oxs : lgShotsHalf;
  return lgShotsHalf * Math.pow(xs / lgShotsHalf, c.e) * svp * c.share;
}

/* ---------- log-likelihoods ---------- */
/* log Gamma (Lanczos, g = 7), cached by its argument */
const lgam = (() => { const c = new Map(); return x0 => {
  if (c.has(x0)) return c.get(x0);
  let v;
  if (x0 < 0.5) v = Math.log(Math.PI / Math.sin(Math.PI * x0)) - lgam(1 - x0);
  else { const g = 7, p = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    const x = x0 - 1; let a = p[0]; const t = x + g + 0.5; for (let i = 1; i < 9; i++) a += p[i] / (x + i); v = 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a); }
  if (c.size < 100000) c.set(x0, v);
  return v; }; })();
function nbLog(k, mu, r) {
  mu = Math.max(mu, 1e-6);
  if (r === null || r === undefined) return k * Math.log(mu) - mu - lgam(k + 1);
  return lgam(k + r) - lgam(r) - lgam(k + 1) + r * Math.log(r / (r + mu)) + k * Math.log(mu / (r + mu));
}
const normLog = (k, mu, sd) => Math.log(Math.max(1e-12, Phi((k + 0.5 - mu) / sd) - Phi((k - 0.5 - mu) / sd)));

/* ---------- the fit ---------- */
const GRID = {
  tracks: [20, 50, 100, 200].flatMap(H => [0.5, 0.75, 1].map(carry => ({ H, carry }))),
  /* the ranges cover what the counts can be: r from nearly Poisson (100) to geometric (1), the goalies' shrinkage from a quarter
     season of shots to several seasons' (a save rate is mostly noise); test_props.js holds the log-likelihoods to sum to one */
  M: { g: [2, 5, 10, 20, 40], a: [1, 2, 5, 10, 20, 40], pts: [0.5, 1, 2, 5, 10, 20, 40], s: [0.5, 1, 2, 5, 10], bs: [0.5, 1, 2, 5, 10] },
  e: [0, 0.5, 1, 1.5],
  r: [null, 100, 30, 10, 5, 3, 2, 1.5, 1],
  gM: [250, 500, 1000, 2000, 4000, 8000, 16000, 32000], ge: [0.25, 0.5, 0.75, 1, 1.25],
};
/* one stat's rows for a track: { mean pieces, actual, season } */
function skaterRows(games, view, track) {
  const rows = [];
  walk(games, view, track, ({ b, s, x, g, prior, naive, etoi, ctx, shotsKnown }) => {
    rows.push({ season: b.season, date: b.date, id: b.id, pid: s.id, g, x: x ? { g: x.g, a: x.a, pts: x.pts, s: x.s, bs: x.bs, h: x.h, hs: x.hs } : null, prior, naive, etoi, ctx, shotsKnown,
      y: { g: s.g || 0, a: s.a || 0, pts: (s.g || 0) + (s.a || 0), s: s.s, bs: s.bs } });
  }, null);
  return rows;
}
function goalieRows(games, view, track) {
  const rows = [];
  walk(games, view, track, null, ({ b, gl, start, x, lgsv, naive, ctx }) => {
    if (!start) return;                                // the starters, pulled or not: the goalie the page projects and the ledger grades
    rows.push({ season: b.season, date: b.date, id: b.id, pid: gl.id, x: x ? { sv: x.sv, sa: x.sa } : null, lgsv, naive, ctx, y: gl.sa - gl.ga });
  });
  return rows;
}
const usable = (k, r) => !SHOT_STATS.has(k) || (r.shotsKnown && r.y[k] !== undefined);
/* search each stat's constants on the rows of the train seasons; return them with the test season's scores */
function fitSkaters(games, view, inTrain, inTest) {
  const best = {};
  for (const track of GRID.tracks) {
    const rows = skaterRows(games, view, track);
    for (const k of STATS) {
      const tr = rows.filter(r => inTrain(r.season) && usable(k, r)), te = rows.filter(r => inTest(r.season) && usable(k, r));
      if (!tr.length) continue;
      const ctxMean = tr.reduce((a, r) => a + (r.ctx ? r.ctx[CTX[k]] : 0), 0) / tr.filter(r => r.ctx).length;
      for (const M of GRID.M[k]) for (const e of GRID.e) {
        const c = { M, e, ctx: ctxMean };
        const mu = tr.map(r => Math.max(1e-6, skMean(k, r.x, r.prior, r.etoi, r.ctx, c))), lmu = mu.map(Math.log), y = tr.map(r => r.y[k]);
        for (const rr of GRID.r) {
          /* nbLog, its terms that do not depend on the mean worked once for each count */
          const T = []; for (let j = 0; j <= 60; j++) T.push(rr === null ? -lgam(j + 1) : lgam(j + rr) - lgam(rr) - lgam(j + 1) + rr * Math.log(rr));
          let ll = 0;
          if (rr === null) for (let i = 0; i < tr.length; i++) ll += T[Math.min(60, y[i])] + y[i] * lmu[i] - mu[i];
          else for (let i = 0; i < tr.length; i++) ll += T[Math.min(60, y[i])] - (rr + y[i]) * Math.log(rr + mu[i]) + y[i] * lmu[i];
          ll /= tr.length;
          if (!best[k] || ll > best[k].ll) best[k] = { ll, c: { H: track.H, carry: track.carry, M, e, r: rr, ctx: r6(ctxMean) }, track };
        }
      }
    }
  }
  return best;
}
function fitGoalies(games, view, inTrain, lgShotsHalf) {
  let best = null;
  for (const track of GRID.tracks) {
    const rows = goalieRows(games, view, track).filter(r => inTrain(r.season));
    for (const M of GRID.gM) for (const e of GRID.ge) {
      const c0 = { M, e, share: 1 };
      const raw = rows.map(r => gkMean(r.x, r.lgsv, r.ctx, c0, lgShotsHalf));
      const share = rows.reduce((a, r) => a + r.y, 0) / raw.reduce((a, b) => a + b, 0);
      const mu = raw.map(m => m * share);
      const sd = Math.sqrt(rows.reduce((a, r, i) => a + (r.y - mu[i]) ** 2, 0) / rows.length);
      let ll = 0; for (let i = 0; i < rows.length; i++) ll += normLog(rows[i].y, mu[i], sd);
      ll /= rows.length;
      if (!best || ll > best.ll) best = { ll, c: { H: track.H, carry: track.carry, M, e, share: r6(share), sd: r6(sd) } };
    }
  }
  return best;
}
/* score constants on a season: the model and the naive own-average, mean log-likelihood a player-game */
function scoreSeason(games, view, C, inTest, lgShotsHalf) {
  const out = {};
  const tracks = new Map(); for (const k of STATS) { const t = C.sk[k].H + '|' + C.sk[k].carry; (tracks.get(t) || tracks.set(t, []).get(t)).push(k); }
  for (const [t, ks] of tracks) {
    const [H, carry] = t.split('|').map(Number);
    const rows = skaterRows(games, view, { H, carry }).filter(r => inTest(r.season));
    for (const k of ks) {
      const rs = rows.filter(r => usable(k, r)); let lm = 0, ln = 0, sm = 0, sn = 0, sy = 0;
      for (const r of rs) { const m = skMean(k, r.x, r.prior, r.etoi, r.ctx, C.sk[k]); lm += nbLog(r.y[k], m, C.sk[k].r); ln += nbLog(r.y[k], Math.max(r.naive[k], 1e-3), null); sm += m; sn += r.naive[k]; sy += r.y[k]; }
      out[k] = { n: rs.length, model: r4(lm / rs.length), naive: r4(ln / rs.length), meanModel: r3(sm / rs.length), meanNaive: r3(sn / rs.length), meanActual: r3(sy / rs.length) };
    }
  }
  const gr = goalieRows(games, view, { H: C.gk.H, carry: C.gk.carry });
  const train = gr.filter(r => !inTest(r.season) && r.season < Math.min(...gr.filter(x => inTest(x.season)).map(x => x.season)));
  const nsd = Math.sqrt(train.reduce((a, r) => a + (r.y - r.naive) ** 2, 0) / Math.max(1, train.length)) || 7;
  const te = gr.filter(r => inTest(r.season)); let lm = 0, ln = 0, sm = 0, sy = 0;
  for (const r of te) { const m = gkMean(r.x, r.lgsv, r.ctx, C.gk, lgShotsHalf); lm += normLog(r.y, m, C.gk.sd); ln += normLog(r.y, r.naive, nsd); sm += m; sy += r.y; }
  out.sv = { n: te.length, model: r4(lm / te.length), naive: r4(ln / te.length), meanModel: r3(sm / te.length), meanActual: r3(sy / te.length), naiveSd: r3(nsd) };
  return out;
}
/* the constants for a season to come: searched on every finished season before it (WARM warms up) */
function fitFor(games, view, season, lgShotsHalf) {
  const inTrain = s => s > WARM && s < season;
  const sk = fitSkaters(games, view, inTrain, s => s === season);
  const gk = fitGoalies(games, view, inTrain, lgShotsHalf);
  const C = { sk: {}, gk: gk.c, lgShotsHalf: r6(lgShotsHalf), toi: TOI };
  for (const k of STATS) C.sk[k] = sk[k].c;
  return C;
}
const shaOf = params => crypto.createHash('sha256').update(JSON.stringify(params)).digest('hex').slice(0, 12);

/* ---------- the record: DraftKings' closing props, one line a final ---------- */
const recordFile = season => path.join(DATA, `props_${season}.jsonl`);
function readRecord(season) {
  const f = recordFile(season); const m = new Map();
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').split('\n')) { if (!l) continue; const r = JSON.parse(l); m.set(String(r.id), r); }
  return m;
}
function allRecords() {
  const m = new Map();
  for (const f of fs.readdirSync(DATA).filter(f => /^props_\d{4}\.jsonl$/.test(f)).sort()) for (const [id, r] of readRecord(+f.slice(6, 10))) m.set(id, r);
  return m;
}
/* the finals the record lacks, oldest first: this season's from the state, and (backfill) the finished seasons' since ARCHIVE_FROM */
function finalsToRecord(S, backfill) {
  const have = allRecords(), out = [];
  if (backfill) {
    const Hist = require('./hist');
    for (const r of Hist.rows(DATA)) if (r.date >= ARCHIVE_FROM && !have.has(String(r.id))) out.push({ id: String(r.id), season: r.season, type: r.type, date: r.date, home: r.home, away: r.away });
  }
  if (S) for (const g of S.games) if (g.state === 'final' && g.hs !== null && g.date >= ARCHIVE_FROM && !have.has(String(g.id))) out.push({ id: String(g.id), season: S.season, type: g.type, date: g.date, home: g.home, away: g.away });
  return out.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1);
}
async function record(S, backfill) {
  const todo = finalsToRecord(S, backfill), limit = backfill ? Infinity : ASK, take = todo.slice(0, limit);
  const stats = { asked: 0, read: 0, none: 0, failed: 0, waiting: Math.max(0, todo.length - take.length), why: null };
  const bySeason = {};
  for (let i = 0; i < take.length; i += 4) {
    const res = await Promise.all(take.slice(i, i + 4).map(async g => { stats.asked++; return [g, await E.propBets(g.id)]; }));
    for (const [g, r] of res) {
      if (r.status === 'failed') { stats.failed++; stats.why = r.why; log(`props ${g.away}@${g.home} ${g.date}: ${r.why}; asked again next run`); continue; }
      const line = Object.assign({}, g, { read: NOW, status: r.status });
      if (r.status === 404) { stats.none++; }
      else { const p = E.propsOf(r.items); Object.assign(line, { pages: r.pages, items: r.items.length, main: p.main, yes: p.yes, skipped: p.skipped }); stats.read++; }
      (bySeason[g.season] = bySeason[g.season] || []).push(JSON.stringify(line));
    }
    if (!process.env.NHL_FIXTURES) await new Promise(r => setTimeout(r, 150));
  }
  for (const [season, lines] of Object.entries(bySeason)) fs.appendFileSync(recordFile(season), lines.join('\n') + '\n');
  if (stats.asked) log(`closing props: ${stats.asked} finals asked, ${stats.read} read, ${stats.none} with none at ESPN (404), ${stats.failed} failed${stats.waiting ? `, ${stats.waiting} more next run` : ''}`);
  return stats;
}

/* ---------- the shadow ledger ---------- */
/* The pre-registered bar. Written into the ledger before its first call (15 October 2026); props_check.js fails a
   ledger whose bar is not this one, or not the last commit's, or registered after a call */
const BAR = {
  lines: 12000,
  /* the rule's numbers, read from the ledger's own copy by decide(), scores() and betOf(), so the code cannot judge by numbers
     other than the ones registered: the flat-bet edge, the bootstrap's resamples, seed and percentiles, the log loss's clip */
  edge: 0.05, resamples: 10000, seed: 0, ci: [0.05, 0.95], clip: 1e-6,
  sample: ('the first 12,000 DraftKings main lines graded over or under (a push on a whole-number line drops out) on calls made with the '
    + 'registered constants, in the order they were graded (then the puck drop, the game id, the line\'s place in the record); about 170 '
    + 'games at some 70 graded lines a game, three to four weeks of the regular season'),
  pass_if: [
    'log loss (chances clipped to 1e-6): the model\'s minus DraftKings\' fair chance\'s (all of the margin on the Over: 1 - the Under\'s implied), '
      + 'its paired bootstrap 90% interval (10,000 resamples of the GAMES in the sample, seed 0, 5th to 95th percentile) wholly below 0',
    'Brier score: the same, its interval wholly below 0',
    'flat bets are up: one unit at DraftKings\' closing price on the Over wherever the model\'s chance beats the Over price\'s implied chance '
      + '(margin left in) by 5 points or more, else on the Under where its chance beats the Under price\'s by 5 points; the units on the sample more than 0 (no bets is not up)',
  ],
  otherwise: 'FAIL: the tracking stops (no new calls; calls already frozen are still graded), and the page never calls the model\'s chance an edge or "model says"',
  if_pass: 'PASS makes it a candidate to be shown as more than on trial, by a change of its own; nothing on the page moves by itself',
  before: 'no verdict before 12,000: until then the summary gives the running numbers and how many of the 12,000 are in, never a verdict or a word of passing',
};
/* the market test's report uses the same bootstrap as the bar */
const REPORT_BOOT = { resamples: BAR.resamples, seed: BAR.seed, ci: BAR.ci };
/* a seeded generator for the bootstrap (mulberry32), so a verdict is the same number on every machine */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const llOf = (p, y, c = BAR.clip) => { const q = Math.min(1 - c, Math.max(c, p)); return -(y ? Math.log(q) : Math.log(1 - q)); };
/* paired cluster bootstrap interval of the mean of per-line differences, resampling games: `opt.resamples` resamples from
   the seed `opt.seed`, the `opt.ci` percentiles of the sorted means (the bar's: 10,000, 0, the 5th and 95th) */
function bootCI(byGame, opt = REPORT_BOOT) {
  const N = opt.resamples, keys = [...byGame.keys()], R = rng(opt.seed), means = new Float64Array(N);
  const sums = keys.map(k => byGame.get(k).reduce((a, b) => a + b, 0)), ns = keys.map(k => byGame.get(k).length);
  for (let b = 0; b < N; b++) { let s = 0, n = 0; for (let i = 0; i < keys.length; i++) { const j = Math.floor(R() * keys.length); s += sums[j]; n += ns[j]; } means[b] = s / n; }
  const sorted = Array.from(means).sort((a, b) => a - b);
  return [r6(sorted[Math.floor(opt.ci[0] * N)]), r6(sorted[Math.floor(opt.ci[1] * N)])];
}
/* a graded line: [player, stat, line, over price, under price, model chance, fair chance, the stat in the box score]; a bet
   where the model's chance beats the price's implied chance by the bar's edge or more, the Over first */
const betOf = ([, , L, po, pu, pm, , x], edge) => {
  const over = x > L;
  if (pm - implied(po) >= edge) return { side: 'over', units: over ? payout(po) : -1 };
  if ((1 - pm) - implied(pu) >= edge) return { side: 'under', units: over ? -1 : payout(pu) };
  return null;
};
/* every graded line the bar counts, in the bar's order: [gid, line] */
function compared(L) {
  const out = [];
  const calls = Object.entries(L.calls).filter(([, c]) => c.final && c.v === L.model.sha)
    .sort(([ga, a], [gb, b]) => a.final.graded_at < b.final.graded_at ? -1 : a.final.graded_at > b.final.graded_at ? 1 : a.start < b.start ? -1 : a.start > b.start ? 1 : ga < gb ? -1 : 1);
  for (const [gid, c] of calls) for (const l of c.final.lines) if (l[7] !== l[2]) out.push([gid, l]);
  return out;
}
function scores(rows, bar) {
  const byLL = new Map(), byBr = new Map(); let lm = 0, lf = 0, bm = 0, bf = 0, over = 0, sm = 0, sf = 0;
  const bets = { n: 0, won: 0, units: 0, over: { n: 0, won: 0, units: 0 }, under: { n: 0, won: 0, units: 0 } };
  for (const [gid, l] of rows) {
    const y = l[7] > l[2] ? 1 : 0, pm = l[5], pf = l[6];
    const dl = llOf(pm, y, bar.clip) - llOf(pf, y, bar.clip), db = (pm - y) ** 2 - (pf - y) ** 2;
    lm += llOf(pm, y, bar.clip); lf += llOf(pf, y, bar.clip); bm += (pm - y) ** 2; bf += (pf - y) ** 2; over += y; sm += pm; sf += pf;
    (byLL.get(gid) || byLL.set(gid, []).get(gid)).push(dl); (byBr.get(gid) || byBr.set(gid, []).get(gid)).push(db);
    const b = betOf(l, bar.edge); if (b) { bets.n++; bets[b.side].n++; bets.units += b.units; bets[b.side].units += b.units; if (b.units > 0) { bets.won++; bets[b.side].won++; } }
  }
  const n = rows.length;
  bets.units = r4(bets.units); bets.over.units = r4(bets.over.units); bets.under.units = r4(bets.under.units);
  return { lines: n, games: byLL.size, over: r4(over / n), model: { logloss: r6(lm / n), brier: r6(bm / n), mean: r4(sm / n) }, market: { logloss: r6(lf / n), brier: r6(bf / n), mean: r4(sf / n) },
    logloss_diff: r6((lm - lf) / n), logloss_diff_ci90: bootCI(byLL, bar), brier_diff: r6((bm - bf) / n), brier_diff_ci90: bootCI(byBr, bar), bets };
}
/* the bar's three legs on a sample's scores: both intervals wholly below 0 (their upper percentile under 0) and the flat bets up */
const passes = sc => sc.logloss_diff_ci90[1] < 0 && sc.brier_diff_ci90[1] < 0 && sc.bets.n > 0 && sc.bets.units > 0;
/* the verdict, by the numbers of the ledger's own registered bar (L.bar), never the code's */
function decide(L, at) {
  const bar = L.bar, rows = compared(L);
  if (rows.length < bar.lines) return null;
  const sample = rows.slice(0, bar.lines), sc = scores(sample, bar);
  return { verdict: passes(sc) ? 'PASS' : 'FAIL', decided_at: at, lines: bar.lines, scores: sc, last: sample[sample.length - 1][0] };
}
function summarize(L) {
  const bar = L.bar, vals = Object.values(L.calls), rows = compared(L);
  const graded = vals.filter(c => c.final);
  return {
    calls: vals.length, to_come: vals.filter(c => !c.frozen).length, frozen_awaiting_final: vals.filter(c => c.frozen && !c.final).length,
    graded_games: graded.length, graded_lines: graded.reduce((a, c) => a + c.final.lines.length, 0), other_model_lines: graded.filter(c => c.v !== L.model.sha).reduce((a, c) => a + c.final.lines.length, 0),
    compared: rows.length, scores: rows.length ? scores(rows, bar) : null,
    standing: L.decision ? `decided at ${L.decision.lines} graded lines on ${L.decision.decided_at}: ${L.decision.verdict}` : `${Math.min(rows.length, bar.lines)} of ${bar.lines} graded lines toward the verdict; the bar is judged at ${bar.lines}, not before`,
  };
}
const CALL_FIELDS = ['start', 'home', 'away', 'called_at', 'v', 'sk', 'gk'];
const sameCall = (a, b) => CALL_FIELDS.filter(k => k !== 'called_at').every(k => JSON.stringify(a[k]) === JSON.stringify(b[k]));
/* the ledger as a file: the header's fields indented, one call a line, so a run's change is a few lines */
function writeLedger(L, file = LEDGER_F) {
  const head = Object.assign({}, L); delete head.calls;
  const keys = Object.keys(head);
  const body = '{\n' + keys.map(k => ` ${JSON.stringify(k)}: ${JSON.stringify(head[k])},`).join('\n') + '\n "calls": {\n'
    + Object.entries(L.calls).map(([g, c]) => `  ${JSON.stringify(g)}: ${JSON.stringify(c)}`).join(',\n') + (Object.keys(L.calls).length ? '\n' : '') + ' }\n}\n';
  const tmp = file + '.part'; fs.writeFileSync(tmp, body); fs.renameSync(tmp, file);
}
function newLedger(C, sha) {
  return {
    what: ('The props shadow ledger (tools/props.js, CLAUDE.md "The props model"): the model\'s mean for every expected player and stat as the '
      + 'page showed it before each puck drop, frozen then, and every DraftKings main line on those players graded after the final against the model\'s '
      + 'chance and DraftKings\' fair chance. The page shows the model as on trial until this bar is passed.'),
    bar: BAR, bar_registered: NOW,
    model: { sha, params: C, dist: 'skaters: negative binomial (mean, r of the stat; r null is Poisson); saves: normal (mean, sd) rounded to whole saves; tools/props.js dist()' },
    run_at: NOW, decision: null, summary: null, calls: {},
  };
}
/* grade one frozen call: every main line of the record on a player the call projects for that stat and who played */
function gradeCall(c, rec, box, C) {
  const lines = []; let voided = 0, unprojected = 0, whole = 0;
  const sk = new Map(box.skaters.filter(s => s.toi > 0).map(s => [s.id, s])), gk = new Map(box.goalies.filter(x => x.toi > 0).map(x => [x.id, x]));
  for (const [aid, stat, L, po, pu] of rec.main || []) {
    const mu = stat === 'sv' ? (c.gk || {})[aid] : ((c.sk || {})[aid] || null) && c.sk[aid][STATS.indexOf(stat)];
    if (mu === undefined || mu === null) { unprojected++; continue; }
    let x;
    if (stat === 'sv') { const g = gk.get(aid); if (!g) { voided++; continue; } x = g.sa - g.ga; }
    else { const s = sk.get(aid); if (!s) { voided++; continue; } x = stat === 'pts' ? (s.g || 0) + (s.a || 0) : s[stat]; if (x === undefined) { voided++; continue; } }
    if (Number.isInteger(L)) whole++;
    lines.push([aid, stat, L, po, pu, r4(pOver(dist(stat, mu, C), L)), r4(fairOver(po, pu)), x]);
  }
  return { lines, voided, unprojected, whole };
}

/* started, by the job's own rule (update.js's started()): under way or over in the feed, its puck drop passed by the clock,
   or a delay: the puck drop its call was made before has passed and the feed has moved the start less than half a day later
   (the job keeps that call, so the props model's is frozen with it) */
const startedJob = g => g.state !== 'pre' || !g.start || Date.parse(g.start) <= Date.parse(NOW)
  || !!(g.frozen && g.before && Date.parse(g.before) <= Date.parse(NOW) && Date.parse(g.start) - Date.parse(g.before) < 12 * 3600000);

/* ---------- tonight: the projections ---------- */
function project(C, PJson, S, games, view) {
  const tracks = new Map();
  for (const k of STATS) { const t = C.sk[k].H + '|' + C.sk[k].carry; if (!tracks.has(t)) tracks.set(t, null); }
  const gt = C.gk.H + '|' + C.gk.carry; if (!tracks.has(gt)) tracks.set(gt, null);
  for (const t of tracks.keys()) { const [H, carry] = t.split('|').map(Number); tracks.set(t, walk(games, view, { H, carry }, null, null)); }
  const stOf = k => tracks.get(C.sk[k].H + '|' + C.sk[k].carry), G = tracks.get(gt);
  const lgsv = G.lgG.sa ? G.lgG.sv / G.lgG.sa : 0.9;
  const tomorrow = addDays(TODAY, 1);
  const toCome = S.games.filter(g => !startedJob(g) && g.date <= tomorrow).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  const out = {}; let skipped = 0;
  for (const g of toCome) {
    const u = PJson.upcoming && PJson.upcoming[g.id];
    if (!u || u.sh === undefined) { skipped++; continue; }
    const row = { start: g.start, date: g.date, home: g.home, away: g.away, inj: u.inj || null };
    for (const side of ['home', 'away']) {
      const team = g[side], T = PJson.teams[team];
      const ctx = { xg: side === 'home' ? u.lh : u.la, xs: side === 'home' ? u.sh : u.sa, oxs: side === 'home' ? u.sa : u.sh };
      const skaters = [];
      for (const p of (T && T.lineup) || []) {
        const base = stOf('g').P.get(p.id);
        if (!base) continue;
        const etoi = base.toi.length ? base.toi.reduce((a, t) => a + t, 0) / base.toi.length / 60 : TOI[grp(base.pos)];
        const o = { id: p.id, name: base.name, pos: base.pos, toi: +etoi.toFixed(1) };
        for (const k of STATS) {
          const W = stOf(k), x = W.P.get(p.id), Lk = W.lg[grp(base.pos)];
          const prior = {}; prior[k] = SHOT_STATS.has(k) ? (Lk.hs ? Lk[k] / Lk.hs : 0) : (Lk.h ? Lk[k] / Lk.h : 0);
          const mu = r3(skMean(k, x, prior, etoi, ctx, C.sk[k]));
          o[k] = Object.assign({ mu }, dist(k, mu, C));
          delete o[k].lo;
        }
        skaters.push(o);
      }
      skaters.sort((a, b) => b.pts.mu - a.pts.mu || (a.id < b.id ? -1 : 1));
      const gl = u[side] && u[side].goalie;
      let goalie = null;
      if (gl && gl.id) {
        const x = G.G.get(gl.id);
        const mu = r3(gkMean(x, lgsv, { oxs: ctx.oxs }, C.gk, C.lgShotsHalf));
        goalie = Object.assign({ id: gl.id, name: gl.name, how: gl.how || null }, x ? {} : { debut: true }, { sv: Object.assign({ mu, sd: C.gk.sd }, dist('sv', mu, C)) });
      }
      row[side + 'P'] = { goalie, skaters };
    }
    out[g.id] = row;
  }
  return { games: out, skipped };
}

/* ---------- the job's step ---------- */
async function main() {
  const backfill = process.argv.includes('--backfill');
  const S = fs.existsSync(STATE_F) ? readJSON(STATE_F) : null;
  /* 1. the record: new finals' closing props, once each */
  let rec = { asked: 0, read: 0, none: 0, failed: 0, waiting: 0, why: null };
  try { rec = await record(S, backfill); } catch (e) { warn(`closing props: ${e.message}`); rec.failed++; rec.why = e.message; }
  if (backfill) return;
  if (!fs.existsSync(MODEL_F)) { warn('no data/props_model.json: run node tools/props.js fit; no projections this run'); return; }
  const M = readJSON(MODEL_F), C = M.params, sha = M.sha;
  if (shaOf(C) !== sha) throw new Error(`data/props_model.json's params are not the ones its sha names (${shaOf(C)} vs ${sha}): refit or restore it`);
  const PJ = require('./players');
  const PJson = fs.existsSync(path.join(DATA, 'players.json')) ? readJSON(path.join(DATA, 'players.json')) : null;
  if (!S || !PJson) { warn('no state or players.json: no projections this run'); return; }
  /* 2. the boxed games, walked for each player's history (the context of a game played is read only when fitting; tonight's
     is players.json's upcoming: each side's expected shots and goals from players.js's own run) */
  const games = PJ.loadGames().games;
  const P = project(C, PJson, S, games, new Map());
  /* 3. the ledger: freeze what has started, grade what is final, a call for every game projected */
  const prevL = fs.existsSync(LEDGER_F) ? readJSON(LEDGER_F) : null;
  if (prevL && JSON.stringify(prevL.bar) !== JSON.stringify(BAR)) throw new Error('the bar in data/props_ledger.json is not the one registered (BAR in props.js): nothing written');
  const L = prevL ? JSON.parse(JSON.stringify(prevL)) : newLedger(C, sha);
  const byId = new Map(S.games.map(g => [String(g.id), g]));
  const boxes = new Map(games.map(b => [String(b.id), b]));
  const records = allRecords();
  const n = { made: 0, rewritten: 0, frozen: 0, graded: 0, dropped: 0 };
  for (const [gid, c] of Object.entries(L.calls)) {
    const g = byId.get(gid);
    if (!c.frozen) {
      const startedNow = Date.parse(NOW) >= Date.parse(c.start) || (g && startedJob(g));
      if (startedNow) { c.frozen = true; c.frozen_at = NOW; n.frozen++; }
      else if (!g) { delete L.calls[gid]; n.dropped++; continue; }           // off the schedule before its puck drop: no call stands
    }
    if (c.frozen && !c.final && g && g.state === 'final' && boxes.has(gid)) {
      const r = records.get(gid);
      if (r && r.status === 200) { const gr = gradeCall(c, r, boxes.get(gid), L.model.sha === c.v ? L.model.params : C); c.final = { graded_at: NOW, lines: gr.lines, voided: gr.voided, unprojected: gr.unprojected }; n.graded++; }
      else if (r && r.status === 404) { c.final = { graded_at: NOW, lines: [], voided: 0, unprojected: 0, none: true }; n.graded++; }
    }
  }
  if (!L.decision) L.decision = decide(L, NOW);
  const stopped = !!(L.decision && L.decision.verdict === 'FAIL');
  const registered = L.model.sha === sha;
  if (!registered) warn(`the props model's constants (${sha}) are not the ones the ledger registered (${L.model.sha}): the ledger makes no new calls`);
  if (stopped) { for (const [gid, c] of Object.entries(L.calls)) if (!c.frozen) { delete L.calls[gid]; n.dropped++; } }
  else if (registered) for (const [gid, row] of Object.entries(P.games)) {
    const old = L.calls[gid];
    if (old && old.frozen) continue;
    const sk = {}, gk = {};
    for (const side of ['homeP', 'awayP']) { for (const p of row[side].skaters) sk[p.id] = STATS.map(k => p[k].mu); if (row[side].goalie) gk[row[side].goalie.id] = row[side].goalie.sv.mu; }
    const c = { start: row.start, home: row.home, away: row.away, called_at: NOW, v: sha, sk, gk, frozen: false, frozen_at: null, final: null };
    if (!old) { L.calls[gid] = c; n.made++; } else if (!sameCall(old, c)) { L.calls[gid] = c; n.rewritten++; }
  }
  L.calls = Object.fromEntries(Object.entries(L.calls).sort(([ga, a], [gb, b]) => a.start < b.start ? -1 : a.start > b.start ? 1 : ga < gb ? -1 : 1));
  L.summary = summarize(L);
  const body = x => JSON.stringify(Object.assign({}, x, { run_at: null }));
  const changed = !prevL || body(prevL) !== body(L);
  if (changed) { L.run_at = NOW; writeLedger(L); }
  const s = L.summary;
  log(`ledger: ${s.calls} calls (${s.to_come} to come, ${s.frozen_awaiting_final} frozen awaiting a final, ${s.graded_games} graded games, ${s.graded_lines} lines) | this run: ${n.made} made, ${n.rewritten} rewritten, ${n.frozen} frozen, ${n.graded} graded, ${n.dropped} dropped | ${changed ? 'written' : 'unchanged'}`);
  log(`where it stands: ${s.standing}${s.scores ? ` | log loss model ${s.scores.model.logloss.toFixed(4)} vs DraftKings ${s.scores.market.logloss.toFixed(4)}, Brier ${s.scores.model.brier.toFixed(4)} vs ${s.scores.market.brier.toFixed(4)}, flat bets ${s.scores.bets.won}-${s.scores.bets.n - s.scores.bets.won} ${s.scores.bets.units >= 0 ? '+' : ''}${s.scores.bets.units} units` : ''}`);
  /* 4. data/props.json: what update.js puts in the state for the page */
  const sc = s.scores;
  const out = {
    v: 1, label: 'on trial', generated: NOW, model: { sha, fitted: M.fitted, through: M.through, warm: M.warm },
    params: { r: Object.fromEntries(STATS.map(k => [k, C.sk[k].r])), svSd: C.gk.sd },
    fair: { main: 'over', yes: M.report && M.report.fair ? M.report.fair.yes : null, yesFrom: M.report && M.report.fair ? M.report.fair.from : null },
    ledger: { of: L.bar.lines, compared: s.compared, graded_games: s.graded_games, standing: s.standing, decision: L.decision ? L.decision.verdict : null,
      model: sc ? sc.model : null, market: sc ? sc.market : null, bets: sc ? { n: sc.bets.n, won: sc.bets.won, units: sc.bets.units } : null, registered: L.bar_registered },
    record: rec, games: P.games, skipped: P.skipped,
  };
  const prevOut = fs.existsSync(OUT_F) ? readJSON(OUT_F) : null;
  /* 5. DraftKings' player lines on every game projected (today and tomorrow, Eastern), read every run from ESPN's propBets, as
     tools/espn.js's propsOf parses them: the page draws them on load, and since the owner's call of 25 October 2026 ("use player
     lines now") its Top 30 and suggested parlays rank them on this model; a Refresh odds press reads them again, live. A 404, or an
     answer with nothing the parse reads, is none posted yet (DraftKings posts on game day); a read that fails keeps the last one read,
     with its own `at`, else says it failed. `dk` on each game: { status: 200, at, main, yes } | { status: 404, at } | { status:
     'failed', at, why } */
  const dkQ = { asked: 0, read: 0, none: 0, failed: 0, kept: 0, lines: 0 }, AT = new Date(Date.parse(NOW)).toISOString();
  const ids = Object.keys(out.games);
  for (let i = 0; i < ids.length; i += 4) await Promise.all(ids.slice(i, i + 4).map(async gid => {
    dkQ.asked++;
    let r; try { r = await E.propBets(gid); } catch (e) { r = { status: 'failed', why: e.message }; }
    let pr = null; if (r.status === 200) { try { pr = E.propsOf(r.items); } catch (e) { pr = null; } }
    if (pr && (pr.main.length || pr.yes.length)) { out.games[gid].dk = { status: 200, at: AT, main: pr.main, yes: pr.yes }; dkQ.read++; dkQ.lines += pr.main.length; return; }
    if (r.status === 404 || pr) { out.games[gid].dk = { status: 404, at: AT }; dkQ.none++; return; }
    dkQ.failed++;
    const was = prevOut && prevOut.games && prevOut.games[gid] && prevOut.games[gid].dk;
    if (was && was.status === 200) { out.games[gid].dk = was; dkQ.kept++; }
    else out.games[gid].dk = { status: 'failed', at: AT, why: r.why || 'an answer that could not be read' };
  }));
  out.dk = dkQ;
  log(`DraftKings' player lines: ${dkQ.asked} games asked, ${dkQ.read} read (${dkQ.lines} main lines), ${dkQ.none} with none posted yet, ${dkQ.failed} failed${dkQ.kept ? ` (${dkQ.kept} earlier reads kept)` : ''}`);
  const same = prevOut && JSON.stringify(Object.assign({}, prevOut, { generated: null })) === JSON.stringify(Object.assign({}, out, { generated: null }));
  if (same) out.generated = prevOut.generated;
  if (!same) fs.writeFileSync(OUT_F, JSON.stringify(out));
  const nP = Object.values(P.games).reduce((a, r) => a + r.homeP.skaters.length + r.awayP.skaters.length, 0);
  log(`props.json: ${Object.keys(P.games).length} games through ${addDays(TODAY, 1)} projected (${nP} skaters)${P.skipped ? `, ${P.skipped} with no lineup from players.js` : ''}; ${same ? 'unchanged' : 'written'}`);
}

/* ---------- the fit: constants, walk-forward and the market test ---------- */
async function fitMain() {
  const PJ = require('./players');
  const PJson = readJSON(path.join(DATA, 'players.json'));
  const walkParams = (PJson.report && PJson.report.walk) || {};
  const cache = new Map();
  const viewsFor = params => { const k = JSON.stringify(params); if (!cache.has(k)) cache.set(k, gamesWithViews(PJ, params)); return cache.get(k); };
  const base = viewsFor(PJson.params);
  const seasons = [...new Set(base.games.map(g => g.season))].sort();
  const S = fs.existsSync(STATE_F) ? readJSON(STATE_F) : null;
  const current = S ? S.season : seasons[seasons.length - 1];
  const finished = seasons.filter(s => s < current);
  const lgHalf = base.league.shots / 2;
  log(`fit: ${base.games.length} boxed games, seasons ${seasons[0]}-${seasons[seasons.length - 1]}; finished ${finished.join(', ')}; this season (${current}) is never fitted on`);
  /* walk-forward: each finished season from FIRST_TEST scored by constants searched on the seasons before it, the context from
     players.js's walk-forward parameters for that season (searched on the seasons before it too) */
  const walkRep = {}, wfC = {};
  for (const s of finished.filter(s => s >= FIRST_TEST)) {
    const params = walkParams[s] ? walkParams[s].params : PJson.params;
    const V = viewsFor(params);
    const C = fitFor(V.games, V.view, s, lgHalf);
    wfC[s] = C;
    walkRep[s] = { constants: C, scores: scoreSeason(V.games, V.view, C, x => x === s, lgHalf), players: walkParams[s] ? `players.js walk-forward parameters for ${s}` : 'players.js parameters' };
    log(`walk-forward ${s}: ` + Object.entries(walkRep[s].scores).map(([k, v]) => `${k} ${v.model} vs naive ${v.naive}`).join(', '));
  }
  /* the constants the job runs: searched on every finished season */
  const C = fitFor(base.games, base.view, current, lgHalf);
  const sha = shaOf(C);
  log(`constants for ${current} (searched on ${WARM + 1}-${current - 1}): ` + JSON.stringify(C));
  /* the market test: DraftKings' archived closing prices, each game scored by the model of its own season's walk-forward */
  const records = allRecords();
  const market = marketTest(records, viewsFor, walkParams, PJson, wfC, C, current);
  const M = { fitted: TODAY, through: current - 1, warm: WARM, params: C, sha, grid: GRID,
    report: { walk: walkRep, market: market.report, fair: market.fair } };
  fs.writeFileSync(MODEL_F, JSON.stringify(M, null, 1) + '\n');
  log(`wrote ${path.relative(ROOT, MODEL_F)} (constants ${sha})`);
}
/* the model's chance and the market's on every archived main line whose player played, and the Yes-only margins */
function marketTest(records, viewsFor, walkParams, PJson, wfC, Cprod, current) {
  const bySeason = {};
  for (const r of records.values()) if (r.status === 200) (bySeason[r.season] = bySeason[r.season] || []).push(r);
  const rows = [], yesRows = [];
  for (const [season, recs] of Object.entries(bySeason)) {
    const s = +season;
    const C = s === current ? Cprod : wfC[s];
    if (!C) { log(`market test: no walk-forward constants for ${s}; its ${recs.length} games are not scored`); continue; }
    const params = s === current ? PJson.params : walkParams[s] ? walkParams[s].params : PJson.params;
    const V = viewsFor(params);
    const want = new Set(recs.map(r => String(r.id)));
    const mu = new Map();      // gid|pid|stat -> mean before the game
    const tracks = new Map(); for (const k of STATS) { const t = C.sk[k].H + '|' + C.sk[k].carry; (tracks.get(t) || tracks.set(t, []).get(t)).push(k); }
    for (const [t, ks] of tracks) {
      const [H, carry] = t.split('|').map(Number);
      walk(V.games, V.view, { H, carry }, ({ b, s: sk, x, prior, etoi, ctx }) => { if (!want.has(String(b.id))) return; for (const k of ks) mu.set(b.id + '|' + sk.id + '|' + k, skMean(k, x, prior, etoi, ctx, C.sk[k])); }, null);
    }
    /* every goalie who played, starter or not: DraftKings' saves line stands on a goalie who plays, and the ledger grades it so
       (scoring only the goalie who played most dropped the lines on a starter pulled early, every one of them an Under) */
    walk(V.games, V.view, { H: C.gk.H, carry: C.gk.carry }, null, ({ b, gl, x, lgsv, ctx }) => { if (want.has(String(b.id))) mu.set(b.id + '|' + gl.id + '|sv', gkMean(x, lgsv, ctx, C.gk, C.lgShotsHalf)); });
    const boxes = new Map(V.games.filter(b => want.has(String(b.id))).map(b => [String(b.id), b]));
    for (const r of recs) {
      const b = boxes.get(String(r.id)); if (!b) continue;
      const sk = new Map(b.skaters.filter(x => x.toi > 0).map(x => [x.id, x])), gk = new Map(b.goalies.filter(x => x.toi > 0).map(x => [x.id, x]));
      const actual = (aid, stat) => { if (stat === 'sv') { const g = gk.get(aid); return g ? g.sa - g.ga : undefined; } const x = sk.get(aid); if (!x) return undefined; return stat === 'pts' ? (x.g || 0) + (x.a || 0) : stat === 'g' ? (x.g || 0) : x[stat]; };
      for (const [aid, stat, L, po, pu] of r.main || []) {
        const x = actual(aid, stat), m = mu.get(r.id + '|' + aid + '|' + stat);
        if (x === undefined || m === undefined || Number.isInteger(L)) continue;
        rows.push({ gid: String(r.id), season: s, type: r.type, stat, L, po, pu, pm: pOver(dist(stat, m, C), L), y: x > L ? 1 : 0, mu: m });
      }
      for (const [aid, stat, k, price] of r.yes || []) {
        const x = actual(aid, stat), m = mu.get(r.id + '|' + aid + '|' + stat);
        if (x === undefined) continue;
        yesRows.push({ gid: String(r.id), season: s, stat, k, price, y: x >= k ? 1 : 0, pm: m === undefined ? null : pOver(dist(stat, m, C), k - 0.5) });
      }
    }
  }
  /* how to take the margin out of a main line, on the finished seasons' record alone */
  const power = (io, iu) => { let lo = 1, hi = 3, k = 2; for (let i = 0; i < 60; i++) { k = (lo + hi) / 2; if (io ** k + iu ** k > 1) lo = k; else hi = k; } return io ** k; };
  const methods = { proportional: x => implied(x.po) / (implied(x.po) + implied(x.pu)), over: x => 1 - implied(x.pu), power: x => power(implied(x.po), implied(x.pu)) };
  const fairRep = {};
  for (const [name, pick] of [['finished', x => x.season < current], ['this season', x => x.season === current]]) {
    const rs = rows.filter(pick); if (!rs.length) continue;
    fairRep[name] = { lines: rs.length, over: r4(rs.reduce((a, x) => a + x.y, 0) / rs.length) };
    for (const [m, f] of Object.entries(methods)) fairRep[name][m] = { said: r4(rs.reduce((a, x) => a + f(x), 0) / rs.length), logloss: r6(rs.reduce((a, x) => a + llOf(f(x), x.y), 0) / rs.length) };
  }
  /* the Yes-only margin by stat (implied chance over the hit rate), on the finished seasons; this season's beside it */
  const yesKey = x => x.stat === 'g' ? (x.k === 1 ? 'g' : 'g2+') : x.stat;
  const yesOf = pick => { const by = {}; for (const x of yesRows.filter(pick)) { const k = yesKey(x); const o = by[k] = by[k] || { n: 0, imp: 0, hit: 0 }; o.n++; o.imp += implied(x.price); o.hit += x.y; } for (const o of Object.values(by)) { o.ratio = o.hit ? r4(o.imp / o.hit) : null; o.imp = r4(o.imp / o.n); o.hit = r4(o.hit / o.n); } return by; };
  /* DraftKings' margin on its Yes prices is the market's, not the model's: measured on every price recorded at the fit (in sample),
     stats with 30 or more, and only ever shown marked est.; the finished seasons' and this season's apart beside it */
  const yesFin = yesOf(x => x.season < current), yesNow = yesOf(x => x.season === current), yesAll = yesOf(() => true);
  const yes = {}; for (const [k, o] of Object.entries(yesAll)) if (o.ratio && o.n >= 30) yes[k] = o.ratio;
  /* the model against DraftKings' fair chance (all of the margin on the Over), by stat and by phase; flat bets at a few bars */
  const report = { note: 'each archived game scored by its own season\'s model: the 2026 playoffs by constants searched through 2024-25 (and players.js\'s walk-forward parameters for 2026), 2026-27 by the constants the job runs; a player who did not play is left out (DraftKings voids him); every goalie who played is scored, a starter pulled early among them', groups: {} };
  const group = (name, rs) => {
    if (!rs.length) return;
    const by = new Map(); for (const x of rs) (by.get(x.gid) || by.set(x.gid, []).get(x.gid)).push(x);
    const dLL = new Map([...by].map(([g, xs]) => [g, xs.map(x => llOf(x.pm, x.y) - llOf(1 - implied(x.pu), x.y))]));
    const dBr = new Map([...by].map(([g, xs]) => [g, xs.map(x => (x.pm - x.y) ** 2 - ((1 - implied(x.pu)) - x.y) ** 2)]));
    const o = { lines: rs.length, games: by.size, over: r4(rs.reduce((a, x) => a + x.y, 0) / rs.length),
      model: { said: r4(rs.reduce((a, x) => a + x.pm, 0) / rs.length), logloss: r6(rs.reduce((a, x) => a + llOf(x.pm, x.y), 0) / rs.length), brier: r6(rs.reduce((a, x) => a + (x.pm - x.y) ** 2, 0) / rs.length) },
      market: { said: r4(rs.reduce((a, x) => a + 1 - implied(x.pu), 0) / rs.length), logloss: r6(rs.reduce((a, x) => a + llOf(1 - implied(x.pu), x.y), 0) / rs.length), brier: r6(rs.reduce((a, x) => a + ((1 - implied(x.pu)) - x.y) ** 2, 0) / rs.length) },
      logloss_diff_ci90: bootCI(dLL), brier_diff_ci90: bootCI(dBr), bets: {} };
    for (const bar of [0.03, 0.05, 0.08, 0.12]) {
      const b = { over: { n: 0, won: 0, units: 0 }, under: { n: 0, won: 0, units: 0 } };
      for (const x of rs) {
        if (x.pm - implied(x.po) >= bar) { b.over.n++; if (x.y) { b.over.won++; b.over.units += payout(x.po); } else b.over.units -= 1; }
        if ((1 - x.pm) - implied(x.pu) >= bar) { b.under.n++; if (!x.y) { b.under.won++; b.under.units += payout(x.pu); } else b.under.units -= 1; }
      }
      for (const side of ['over', 'under']) { b[side].units = r4(b[side].units); b[side].roi = b[side].n ? r4(b[side].units / b[side].n) : null; }
      o.bets[bar] = b;
    }
    report.groups[name] = o;
  };
  group('all', rows);
  for (const k of ['pts', 'a', 's', 'bs', 'sv']) group(k, rows.filter(x => x.stat === k));
  group('2026 playoffs', rows.filter(x => x.season < current && x.type === 3));
  group('finished seasons', rows.filter(x => x.season < current));
  group('this season', rows.filter(x => x.season === current));
  /* anytime goalscorer: the model's goals 1+ against DraftKings' Yes price over its measured margin (in-sample on the finished seasons) */
  const ag = yesRows.filter(x => x.stat === 'g' && x.k === 1 && x.pm !== null);
  if (ag.length && yes.g) report.anytime = { lines: ag.length, hit: r4(ag.reduce((a, x) => a + x.y, 0) / ag.length), model: { said: r4(ag.reduce((a, x) => a + x.pm, 0) / ag.length), logloss: r6(ag.reduce((a, x) => a + llOf(x.pm, x.y), 0) / ag.length) },
    market: { said: r4(ag.reduce((a, x) => a + implied(x.price) / yes.g, 0) / ag.length), logloss: r6(ag.reduce((a, x) => a + llOf(implied(x.price) / yes.g, x.y), 0) / ag.length) } };
  const all = report.groups.all;
  if (all) log(`market test: ${all.lines} main lines in ${all.games} games: log loss model ${all.model.logloss} vs DraftKings ${all.market.logloss} [${all.logloss_diff_ci90}], Brier ${all.model.brier} vs ${all.market.brier}`);
  return { report, fair: { main: fairRep, yes, from: `implied chance over the hit rate, on every Yes price recorded at the fit (${TODAY}; in sample, the market's margin and not the model), stats with 30 or more; g is anytime goalscorer, g2+ two goals or more`, yesAll, yesFinished: yesFin, yesThisSeason: yesNow } };
}

if (require.main === module) (process.argv[2] === 'fit' ? fitMain() : main()).catch(e => { console.error(e); process.exit(1); });
module.exports = { lgam, nbLog, normLog, STATS, BAR, CALL_FIELDS, pmf, dist, pOver, toBasis, Phi, implied, payout, fairOver, gradeCall, compared, scores, decide, passes, summarize, bootCI, betOf, llOf, rng, shaOf, writeLedger, sameCall, walk, skMean, gkMean, starterOf, marketTest, allRecords, gamesWithViews };
