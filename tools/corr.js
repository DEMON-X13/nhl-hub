/* THE SAME-GAME TABLE: how the legs of one game move together, measured on the hub's own box scores of the finished
   seasons, for the copula tools/sgp.js prices a same-game parlay with. The owner's call, 15 October 2026 ("go for it":
   player props in the Parlay Builder, more than one leg a game). Never measured on the season in play (the owner's
   rule on all his hubs: nothing is tuned on the season in progress), and never written by hand.

    node tools/corr.js            measure, validate, write data/corr.json (about six minutes, most of it the validation)
    node tools/corr.js --check    measure again on the seasons the file names (about forty seconds) and fail (exit 1)
                                  unless data/corr.json's table and hold are exactly what this measures: the table is
                                  source, never typed. A refit of players.js or of the props model moves the chances it
                                  stands on, so it fails then too: run it again and commit the new table with the refit

   WHAT IS MEASURED. A leg is a binary event: a skater's goals, assists, points, shots on goal or blocked shots over a
   line, a starting goalie's saves over a line, a club winning (overtime and the shootout included), the favourite
   covering -1.5, the game's total going over. The copula reads each as a latent standard normal crossing a threshold,
   so what it needs for a pair is the TETRACHORIC correlation of the two outcomes at the lines that matter: the latent
   correlation that gives the pair's joint chance from its two chances. It is measured with each player's and each
   game's expectation taken out: every leg's chance is the hub's own pre-game view of that game (the props model's
   distribution of the player's stat, tools/props.js walk/skMean/gkMean on its registered constants; the goals layer of
   tools/elo.js on players.js's expected goals each side for the win, the -1.5 and the total), and the correlation is
   the rho that solves, over every pair of a kind,
       sum (y1 - p1)(y2 - p2)  =  sum ( Phi2(Phi^-1(p1), Phi^-1(p2); rho) - p1 p2 )
   the residuals' cross moment against the copula's (a method of moments: it uses only the pairs' co-movement beyond
   their own chances, so a leg's own miscalibration enters only as a product of two small errors). Pairs of different
   players are summed with the tetrachoric series, Phi2 - p1 p2 = sum_n rho^n phi(h1) phi(h2) He_{n-1}(h1) He_{n-1}(h2)
   / n! (NT terms, within 1e-9 of Genz's BVND for |rho| <= RSER, held at every run), whose terms factor across a club's
   players (no pair of players measured comes near RSER: the largest is 0.37), so every pair of
   every game is counted without being visited; one player's two stats are solved exactly (Genz's BVND, sgp.js).

   THE LINES. Goals, assists and points at 0.5 (the anytime goal; DraftKings' main lines for points and assists);
   shots, blocked shots and saves at the half point nearest an even chance on the model's distribution (where
   DraftKings sets them: 1.5 to 3.5 shots, 1.5 blocks, 20.5 to 29.5 saves in its record); the total at the half point
   nearest an even chance on the goals layer (5.5 or 6.5); the favourite (the side the pre-game view favours, the one
   DraftKings lays -1.5) covering -1.5. Every skater who played and each side's starting goalie (the box files' mark).
   One kind a pair: a player's kind is his group and stat (F forwards, D defencemen, G the goalie: `F:pts`, `D:bs`,
   `G:sv`), and a pair's relation self (one player's two stats), team (teammates; a player and his own club's win or
   -1.5 cover), opp (opponents; a player and the other club's -1.5 cover), game (a player and the total), fav and dog
   (the favourite's win or the -1.5 side with the total). A player and his club's loss is minus his club's win, a +1.5
   is the -1.5 failing, an Under is its Over read from the other end: sgp.js turns every leg into one of these.

   SHRUNK, SYMMETRIC, POSITIVE DEFINITE IN USE. Each rho's standard error is the cluster-robust one (games resampled in
   the linearisation: a game's pairs share its players), and the table carries rho * rho^2 / (rho^2 + se^2), so a kind
   measured on few pairs is pulled toward 0 by its own noise and one measured on hundreds of thousands is left as it
   is. Keys are sorted, so the table is symmetric. A matrix of pairs measured one at a time need not be positive
   definite: sgp.js's psd() shrinks it toward independence by the least lambda that makes it so, and this file reports
   how often that is needed on real tickets.

   VALIDATED on games the table never saw: a table measured on 2022-23 to 2024-25 alone (the props model's walk-forward
   constants for 2025-26, searched only on those seasons) predicts the joint hit rate of every pair of legs in every
   2025-26 game (regular season and playoffs) at the model's chances, and of every pair of DraftKings' real closing
   lines in the 2025-26 games ESPN kept (its 2026 playoffs) at DraftKings' own fair chances, against how often both
   legs landed, beside the plain product (independence); then the table this file writes, on 2026-27's DraftKings lines
   so far (nothing chosen on them), with DraftKings' game lines from the state for the win, the -1.5 and the total;
   then two-, three- and four-leg tickets of real lines through sgp.js's own parlay(), each against how many landed, with
   the standard errors clustered by game (a game's pairs and tickets share its players).

   THE HOLD. No DraftKings same-game price for hockey has been recorded anywhere this hub can read (ESPN's feed
   carries none), so the price's same-game hold is the NFL site's SGP_HOLD (props/build/part3.js: 0.896, fitted to two
   real DraftKings tickets on Detroit at Buffalo, 17 September 2026), applied as it applies it: the legs' IMPLIED
   chances joined by the copula, times the hold, never above the product. Untested on hockey; this file reports only
   what it implies on real tickets (the hold over the fair joint chance, and how often the product cap binds).

   The child process. The table is measured in a child run on a scratch folder holding only the finished seasons'
   files (history.json, model.json, season_*.json and their box files; no state), so this season's games cannot reach
   it even through the league averages players.js takes over every boxed game; the parent then reads the real files for
   2026-27's check. NHL_DATA moves the real data folder. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
const S = require('./sgp');

const ROOT = path.join(__dirname, '..');
const PART = process.env.CORR_PART || null;                            // 'finished' in the child
const REAL = process.env.CORR_REAL || process.env.NHL_DATA || path.join(ROOT, 'data');
const OUT_F = path.join(REAL, 'corr.json');
const CHECK = process.argv.includes('--check');
const WARM = 2022;                                                     // 2021-22 warms the walk up, as props.js's fit
const STATS = ['g', 'a', 'pts', 's', 'bs'];
const KINDS = ['F:g', 'F:a', 'F:pts', 'F:s', 'F:bs', 'D:g', 'D:a', 'D:pts', 'D:s', 'D:bs', 'G:sv'];
const NT = 40, RSER = 0.6, RMAX = 0.95, CLIP = 0.005;
const HOLD = {
  sgp: 0.896,
  rule: 'a game\'s legs: min( the product of their decimal prices, sgp / the copula\'s joint chance of their IMPLIED chances (DraftKings\' prices, margin left in) ); games multiplied',
  basis: 'the NFL site\'s SGP_HOLD (nfl-hub props/build/part3.js), fitted there to two real DraftKings same-game tickets on Detroit at Buffalo (2026-09-17): 7.33 and 5.36 by the copula where DraftKings offered 6.25 and 5.05, cuts of 0.852 and 0.942, 0.896 their geometric mean',
  tested: false,
  why_untested: 'no DraftKings same-game price for hockey has been recorded: ESPN\'s feed carries none, and neither does anything else this hub reads. Every same-game price drawn from it is an estimate and says so',
};
const log = m => console.log(new Date().toISOString().slice(11, 19), m);
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const clip = p => Math.min(1 - CLIP, Math.max(CLIP, p));
const r3 = x => Math.round(x * 1000) / 1000, r4 = x => Math.round(x * 10000) / 10000, r6 = x => Math.round(x * 1e6) / 1e6;
const keyOf = S.keyOf;

/* ---------- the tetrachoric series ---------- */
/* a(h)[n-1] = phi(h) He_{n-1}(h) / sqrt(n!), so Phi2(h1, h2; rho) - Phi(h1) Phi(h2) = sum_n rho^n a(h1)[n-1] a(h2)[n-1] */
function aVec(h) {
  const v = new Float64Array(NT), f = S.phi(h);
  let hm1 = 0, hn = 1;                                                 // normalised Hermite He_n / sqrt(n!), n = 0
  for (let n = 1; n <= NT; n++) {
    v[n - 1] = f * hn / Math.sqrt(n);
    const next = (h * hn - Math.sqrt(n - 1) * hm1) / Math.sqrt(n);
    hm1 = hn; hn = next;
  }
  return v;
}
const series = (C, rho) => { let s = 0, pw = 1; for (let n = 0; n < NT; n++) { pw *= rho; s += C[n] * pw; } return s; };
const seriesD = (C, rho) => { let s = 0, pw = 1; for (let n = 0; n < NT; n++) { s += (n + 1) * C[n] * pw; pw *= rho; } return s; };
/* the series against Genz's BVND where it is used: every |h| up to the clip's, |rho| up to RSER */
function seriesSelfTest() {
  let worst = 0; const hmax = -S.invNorm(CLIP);
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) for (let k = -6; k <= 6; k++) {
    const h1 = -hmax + 2 * hmax * i / 12, h2 = -hmax + 2 * hmax * j / 12, rho = RSER * k / 6;
    const a = aVec(h1), b = aVec(h2), C = a.map((x, n) => x * b[n]);
    const exact = S.bvnu(-h1, -h2, rho) - S.Phi(h1) * S.Phi(h2);
    worst = Math.max(worst, Math.abs(series(C, rho) - exact));
  }
  if (worst > 1e-9) throw new Error(`the tetrachoric series is off Genz's BVND by ${worst} where it is used: more terms`);
  return worst;
}

/* ---------- the legs of every game ---------- */
/* a skater's legs: the main line (0.5 for goals, assists, points; the half point nearest an even chance for shots and
   blocks) and the rung above it (validation only), P(X > L) on the props model's distribution */
function skLegs(PR, k, mu, r, y) {
  const K = 40, pm = PR.pmf(mu, r, K), up = new Float64Array(K + 2);
  let c = 0; for (let m = 0; m <= K + 1; m++) { up[m] = Math.max(0, 1 - c); if (m <= K) c += pm[m]; }      // up[m] = P(X >= m)
  let m = 1;
  if (k === 's' || k === 'bs') { for (let j = 2; j <= K; j++) if (Math.abs(up[j] - 0.5) < Math.abs(up[m] - 0.5)) m = j; }
  return { main: { L: m - 0.5, p: clip(up[m]), y: y >= m ? 1 : 0 }, rung: { L: m + 0.5, p: clip(up[m + 1]), y: y >= m + 1 ? 1 : 0 } };
}
/* a goalie's: saves a normal rounded to whole saves (props.js dist), P(X >= m) = 1 - Phi((m - 0.5 - mu) / sd); the main
   line at the half point nearest his mean, the rung three saves above (DraftKings' ladders step by two) */
function gkLegs(mu, sd, y) {
  const m = Math.round(mu + 0.5), pAt = k => clip(1 - S.Phi((k - 0.5 - mu) / sd));
  return { main: { L: m - 0.5, p: pAt(m), y: y >= m ? 1 : 0 }, rung: { L: m + 2.5, p: pAt(m + 3), y: y >= m + 3 ? 1 : 0 } };
}
/* every boxed game with its legs: the skaters', the starting goalies', the win (each club), the favourite's -1.5 (and the
   underdog's, a diagnostic), the total; chances from the hub's pre-game view of each game, outcomes from the box */
function buildLegs(D, C) {
  const { PR, ELO, games, view, elo, model } = D;
  const out = [], byId = new Map();
  for (const b of games) {
    const v = view.get(String(b.id)), e = elo[b.id];
    const g = { id: String(b.id), season: b.season, type: b.type, date: b.date, home: b.home, away: b.away, box: b, sk: new Map(), gk: {}, team: null };
    if (v && e && b.hs !== undefined && b.hs !== null) {
      const Gs = ELO.goals(v.lh + v.la, v.lh - v.la, e.diff, model.pull);
      const pH = v.pHome, favHome = pH >= 0.5, fav = favHome ? b.home : b.away, dog = favHome ? b.away : b.home;
      const cH = ELO.coverProbs(Gs, -1.5).cover, cA = ELO.coverProbs(Gs, 1.5).lose, margin = b.hs - b.as, tot = b.hs + b.as;
      let L = null, pL = null;
      for (const x of [3.5, 4.5, 5.5, 6.5, 7.5, 8.5]) { const p = ELO.totalProbs(Gs, x).over; if (pL === null || Math.abs(p - 0.5) < Math.abs(pL - 0.5)) { L = x; pL = p; } }
      g.team = { fav, dog, L,
        ml: { [b.home]: { p: clip(pH), y: margin > 0 ? 1 : 0 }, [b.away]: { p: clip(1 - pH), y: margin < 0 ? 1 : 0 } },
        pl: { p: clip(favHome ? cH : cA), y: (favHome ? margin : -margin) >= 2 ? 1 : 0 },
        pld: { p: clip(favHome ? cA : cH), y: (favHome ? -margin : margin) >= 2 ? 1 : 0 },
        tot: { p: clip(pL), y: tot > L ? 1 : 0 } };
    }
    out.push(g); byId.set(g.id, g);
  }
  const tracks = new Map();
  for (const k of STATS) { const t = C.sk[k].H + '|' + C.sk[k].carry; if (!tracks.has(t)) tracks.set(t, []); tracks.get(t).push(k); }
  for (const [t, ks] of tracks) {
    const [H, carry] = t.split('|').map(Number);
    PR.walk(games, view, { H, carry }, ({ b, s, x, prior, etoi, ctx }) => {
      const g = byId.get(String(b.id)); let p = g.sk.get(s.id);
      if (!p) { p = { pid: s.id, team: s.team, grp: s.pos === 'D' ? 'D' : 'F', st: {} }; g.sk.set(s.id, p); }
      for (const k of ks) {
        const y = k === 'pts' ? (s.g || 0) + (s.a || 0) : k === 'g' ? (s.g || 0) : k === 'a' ? (s.a || 0) : s[k];
        if (y === undefined || y === null) continue;
        p.st[k] = skLegs(PR, k, PR.skMean(k, x, prior, etoi, ctx, C.sk[k]), C.sk[k].r, y);
      }
    }, null);
  }
  PR.walk(games, view, { H: C.gk.H, carry: C.gk.carry }, null, ({ b, gl, start, x, lgsv, ctx }) => {
    if (!start) return;
    const g = byId.get(String(b.id));
    g.gk[gl.team] = { pid: gl.id, team: gl.team, grp: 'G', st: { sv: gkLegs(PR.gkMean(x, lgsv, ctx, C.gk, C.lgShotsHalf), C.gk.sd, gl.sa - gl.ga) } };
  });
  return out;
}
/* a game's legs as items, each with the latent sgp.js reads it on (and the rung variant of a player's, for validation) */
function itemsOf(g, rung = false) {
  const items = [];
  const pl = (p, k) => { const L = p.st[k][rung ? 'rung' : 'main']; return { k: p.grp + ':' + k, pid: p.pid, team: p.team, p: L.p, y: L.y, L: L.L,
    lat: S.latent({ game: g.id, team: p.team, pid: p.pid, grp: p.grp, stat: k, side: 'over' }) }; };
  for (const p of g.sk.values()) for (const k of STATS) if (p.st[k]) items.push(pl(p, k));
  for (const side of ['home', 'away']) { const x = g.gk[g[side]]; if (x) items.push(pl(x, 'sv')); }
  return items;
}
function teamItems(g) {
  const T = g.team; if (!T) return [];
  const opp = t => t === g.home ? g.away : g.home;
  return [
    ...[g.home, g.away].map(t => ({ k: 'ml', team: t, p: T.ml[t].p, y: T.ml[t].y, lat: S.latent({ game: g.id, team: t, opp: opp(t), kind: 'ml', fav: t === T.fav }) })),
    { k: 'pl', team: T.fav, p: T.pl.p, y: T.pl.y, lat: S.latent({ game: g.id, team: T.fav, opp: T.dog, kind: 'pl', line: -1.5, fav: true }) },
    { k: 'tot', p: T.tot.p, y: T.tot.y, L: T.L, lat: S.latent({ game: g.id, kind: 'tot', side: 'over' }) },
  ];
}

/* ---------- measuring ---------- */
/* one game's sums for every relation and pair of kinds: C[n] (the series' coefficients over its pairs), R (the
   residuals' cross moment), n (pairs); and the self pairs' observations for the exact path */
function contrib(g, selfObs) {
  const out = new Map();
  const at = key => { let o = out.get(key); if (!o) out.set(key, o = { C: new Float64Array(NT), R: 0, n: 0 }); return o; };
  const add = (key, a, b, R, n) => { if (!n) return; const o = at(key); for (let i = 0; i < NT; i++) o.C[i] += a[i] * b[i]; o.R += R; o.n += n; };
  const addSame = (key, A) => { const n = A.n * (A.n - 1) / 2; if (!n) return; const o = at(key); for (let i = 0; i < NT; i++) o.C[i] += (A.a[i] * A.a[i] - A.sq[i]) / 2; o.R += (A.r * A.r - A.rr) / 2; o.n += n; };
  const sub = (key, a, b, R, n) => { const o = out.get(key); for (let i = 0; i < NT; i++) o.C[i] -= a[i] * b[i]; o.R -= R; o.n -= n; };
  const items = itemsOf(g);
  for (const it of items) { it.h = S.invNorm(it.p); it.a = aVec(it.h); it.r = it.y - it.p; }
  const sets = {};                                                     // team -> kind -> { a: sum, sq: sum of squares, r, rr, n }
  for (const it of items) {
    const T = sets[it.team] = sets[it.team] || {}, s = T[it.k] = T[it.k] || { a: new Float64Array(NT), sq: new Float64Array(NT), r: 0, rr: 0, n: 0 };
    for (let i = 0; i < NT; i++) { s.a[i] += it.a[i]; s.sq[i] += it.a[i] * it.a[i]; } s.r += it.r; s.rr += it.r * it.r; s.n++;
  }
  const teams = [g.home, g.away];
  const E = { a: new Float64Array(NT), sq: new Float64Array(NT), r: 0, rr: 0, n: 0 };
  const set = (t, k) => (sets[t] && sets[t][k]) || E;
  for (let i = 0; i < KINDS.length; i++) for (let j = i; j < KINDS.length; j++) {
    const k1 = KINDS[i], k2 = KINDS[j], key = keyOf('team', k1, k2);
    for (const t of teams) {
      const A = set(t, k1), B = set(t, k2);
      if (i === j) addSame(key, A);
      else add(key, A.a, B.a, A.r * B.r, A.n * B.n);
    }
    const ko = keyOf('opp', k1, k2), [H, A_] = teams;
    if (i === j) add(ko, set(H, k1).a, set(A_, k1).a, set(H, k1).r * set(A_, k1).r, set(H, k1).n * set(A_, k1).n);
    else {
      add(ko, set(H, k1).a, set(A_, k2).a, set(H, k1).r * set(A_, k2).r, set(H, k1).n * set(A_, k2).n);
      add(ko, set(A_, k1).a, set(H, k2).a, set(A_, k1).r * set(H, k2).r, set(A_, k1).n * set(H, k2).n);
    }
  }
  /* one player's two stats are not teammates: taken out of `team`, kept for the exact path */
  const byPid = new Map(); for (const it of items) { if (!byPid.has(it.pid)) byPid.set(it.pid, []); byPid.get(it.pid).push(it); }
  for (const list of byPid.values()) for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const x = list[i], y = list[j];
    sub(keyOf('team', x.k, y.k), x.a, y.a, x.r * y.r, 1);
    if (selfObs) { const key = keyOf('self', x.k, y.k), [u, w] = x.k <= y.k ? [x, y] : [y, x]; (selfObs[key] = selfObs[key] || []).push(u.h, w.h, u.p * w.p, u.r * w.r); }
  }
  for (const [key, o] of out) if (!o.n) out.delete(key);
  /* the club legs: the win with each club's players, the favourite's -1.5 with both clubs', the total with everyone's */
  const T = g.team;
  if (T) {
    const lg = x => { const h = S.invNorm(x.p); return { a: aVec(h), r: x.y - x.p }; };
    const ml = { [g.home]: lg(T.ml[g.home]), [g.away]: lg(T.ml[g.away]) }, pl = lg(T.pl), pld = lg(T.pld), tot = lg(T.tot);
    for (const k of KINDS) {
      for (const t of teams) { const A = set(t, k); add(keyOf('team', k, 'ml'), ml[t].a, A.a, ml[t].r * A.r, A.n); add(`diag|${k}|ml|${t === T.fav ? 'fav' : 'dog'}`, ml[t].a, A.a, ml[t].r * A.r, A.n); }
      const F = set(T.fav, k), Dg = set(T.dog, k);
      add(keyOf('team', k, 'pl'), pl.a, F.a, pl.r * F.r, F.n); add(keyOf('opp', k, 'pl'), pl.a, Dg.a, pl.r * Dg.r, Dg.n);
      add(`diag|${k}|pld|team`, pld.a, Dg.a, pld.r * Dg.r, Dg.n); add(`diag|${k}|pld|opp`, pld.a, F.a, pld.r * F.r, F.n);
      const all = set(g.home, k), all2 = set(g.away, k);
      add(keyOf('game', k, 'tot'), tot.a, all.a, tot.r * all.r, all.n); add(keyOf('game', k, 'tot'), tot.a, all2.a, tot.r * all2.r, all2.n);
    }
    add('fav|ml|tot', ml[T.fav].a, tot.a, ml[T.fav].r * tot.r, 1);
    add('fav|pl|tot', pl.a, tot.a, pl.r * tot.r, 1);
    add('dog|pl|tot', pld.a, tot.a, pld.r * tot.r, 1);
  }
  return out;
}
/* solve sum C_n rho^n = R on [-RSER, RSER] (monotone there: its derivative is a sum of bivariate densities) */
function solveSeries(C, R) {
  if (R >= series(C, RSER)) return { rho: RSER, bound: true };
  if (R <= series(C, -RSER)) return { rho: -RSER, bound: true };
  let lo = -RSER, hi = RSER;
  for (let i = 0; i < 64; i++) { const m = (lo + hi) / 2; if (series(C, m) < R) lo = m; else hi = m; }
  return { rho: (lo + hi) / 2, bound: false };
}
/* one player's two stats, exactly: sum (BVND(-h1, -h2, rho) - p1 p2) = sum r1 r2 on [-RMAX, RMAX], Newton's steps (the
   slope is the sum of the bivariate densities) kept inside a bisection's bracket, to 1e-10 */
function solveSelf(obs) {
  const n = obs.length / 4; let target = 0; for (let i = 0; i < n; i++) target += obs[4 * i + 3];
  const f = rho => { let s = 0, d = 0; for (let i = 0; i < n; i++) { s += S.bvnu(-obs[4 * i], -obs[4 * i + 1], rho) - obs[4 * i + 2]; d += bvd(obs[4 * i], obs[4 * i + 1], rho); } return [s - target, d]; };
  if (f(RMAX)[0] <= 0) return { rho: RMAX, bound: true };
  if (f(-RMAX)[0] >= 0) return { rho: -RMAX, bound: true };
  let lo = -RMAX, hi = RMAX, x = 0;
  for (let it = 0; it < 60; it++) {
    const [v, d] = f(x);
    if (v < 0) lo = x; else hi = x;
    let nx = x - v / d;
    if (!(nx > lo && nx < hi)) nx = (lo + hi) / 2;
    if (Math.abs(nx - x) < 1e-10) { x = nx; break; }
    x = nx;
  }
  return { rho: x, bound: false };
}
const bvd = (h1, h2, r) => Math.exp(-(h1 * h1 - 2 * r * h1 * h2 + h2 * h2) / (2 * (1 - r * r))) / (2 * Math.PI * Math.sqrt(1 - r * r));
/* the table on the games `use` picks: every relation and pair of kinds, its raw rho, its cluster-robust se, the shrunk rho */
function measure(games, use) {
  const picked = games.filter(g => use(g.season)), tot = new Map(), selfObs = {}, selfGame = {};
  for (let gi = 0; gi < picked.length; gi++) {
    const so = {}, c = contrib(picked[gi], so);
    for (const [key, o] of c) { let t = tot.get(key); if (!t) tot.set(key, t = { C: new Float64Array(NT), R: 0, n: 0, games: 0 }); for (let i = 0; i < NT; i++) t.C[i] += o.C[i]; t.R += o.R; t.n += o.n; t.games++; }
    for (const [key, arr] of Object.entries(so)) { (selfObs[key] = selfObs[key] || []).push(...arr); (selfGame[key] = selfGame[key] || []).push(...new Array(arr.length / 4).fill(gi)); }
  }
  const entries = {};
  for (const [key, t] of tot) { const s = solveSeries(t.C, t.R); if (s.bound && !key.startsWith('diag')) throw new Error(`${key}: rho at the series' bound ${RSER}: solve it exactly`); entries[key] = { raw: s.rho, pairs: t.n, games: t.games, d: seriesD(t.C, s.rho), bound: s.bound }; }
  for (const [key, obs] of Object.entries(selfObs)) { const s = solveSelf(obs); entries[key] = { raw: s.rho, pairs: obs.length / 4, games: new Set(selfGame[key]).size, bound: s.bound }; }
  /* the cluster-robust se: each game's share of the moment equation over its slope, squared and summed */
  const psi = {}; for (const key of Object.keys(entries)) psi[key] = 0;
  for (let gi = 0; gi < picked.length; gi++) {
    const c = contrib(picked[gi], null);
    for (const [key, o] of c) { const e = entries[key]; if (!e || e.d === undefined) continue; const v = (o.R - series(o.C, e.raw)) / e.d; psi[key] += v * v; }
  }
  for (const [key, obs] of Object.entries(selfObs)) {
    const e = entries[key], n = obs.length / 4, gs = selfGame[key], byG = new Map(); let d = 0;
    for (let i = 0; i < n; i++) { const r = Math.min(e.raw, 0.999); d += bvd(obs[4 * i], obs[4 * i + 1], r); byG.set(gs[i], (byG.get(gs[i]) || 0) + obs[4 * i + 3] - (S.bvnu(-obs[4 * i], -obs[4 * i + 1], e.raw) - obs[4 * i + 2])); }
    for (const v of byG.values()) psi[key] += (v / d) ** 2;
  }
  for (const [key, e] of Object.entries(entries)) {
    e.se = Math.sqrt(psi[key]);
    const shrunk = e.bound ? e.raw : e.raw * e.raw * e.raw / (e.raw * e.raw + e.se * e.se);
    e.rho = r3(Math.max(-RMAX, Math.min(RMAX, shrunk)));
    e.raw = r4(e.raw); e.se = r4(e.se); delete e.d;
  }
  return { games: picked.length, seasons: [...new Set(picked.map(g => g.season))].sort(), entries };
}
const tableOf = M => Object.fromEntries(Object.entries(M.entries).filter(([k]) => !k.startsWith('diag')).sort(([a], [b]) => a < b ? -1 : 1).map(([k, e]) => [k, e.rho]));

/* ---------- validation ---------- */
/* the table key a pair of latents reads (mirrors sgp.js's rhoLat; held to it pair by pair) */
function keyLat(a, b) {
  const P = x => x.lat === 'p';
  if (P(a) && P(b)) return a.pid === b.pid ? keyOf('self', a.k, b.k) : keyOf(a.team === b.team ? 'team' : 'opp', a.k, b.k);
  if (P(a) || P(b)) { const p = P(a) ? a : b, o = P(a) ? b : a; return o.lat === 'ml' ? keyOf('team', p.k, 'ml') : o.lat === 'pl' ? keyOf(p.team === o.team ? 'team' : 'opp', p.k, 'pl') : keyOf('game', p.k, 'tot'); }
  return [a.lat, b.lat].sort().join('|') === 'ml|tot' ? 'fav|ml|tot' : ((a.lat === 'pl' ? a : b).fav ? 'fav' : 'dog') + '|pl|tot';
}
/* the sign the latents put on the table's entry: a player and the OTHER club's win, the underdog's win with the total */
function signLat(a, b) {
  const p = a.lat === 'p' ? a : b.lat === 'p' ? b : null, o = p === a ? b : a;
  if (p && o.lat === 'ml') return p.team === o.team ? 1 : -1;
  if (!p && (a.lat === 'ml' || b.lat === 'ml')) return (a.lat === 'ml' ? a : b).fav ? 1 : -1;
  return 1;
}
const NESTED = new Set(['self|F:a|F:pts', 'self|F:g|F:pts', 'self|D:a|D:pts', 'self|D:g|D:pts']);
/* a mirror pair: a player and the OTHER club's win, the underdog's win with the total. The copula reads it as exactly the
   negative of the pair it mirrors (the other club's win is this club's loss), so the checks count each pair once */
function mirror(a, b) {
  const p = a.lat === 'p' ? a : b.lat === 'p' ? b : null, o = p === a ? b : a;
  if (p && o.lat === 'ml') return p.team !== o.team;
  if (!p && (a.lat === 'ml' || b.lat === 'ml')) return !(a.lat === 'ml' ? a : b).fav;
  return false;
}
function groupOf(a, b, key) {
  const P = x => x.lat === 'p', G = x => x.k === 'G:sv';
  if (P(a) && P(b)) {
    if (a.pid === b.pid) return NESTED.has(key) ? 'one player: points with his own goals or assists (nested)' : 'one player: two stats';
    if (G(a) && G(b)) return 'the two goalies';
    if (G(a) || G(b)) return a.team === b.team ? 'a goalie and his own skaters' : 'a goalie and the other side\'s skaters';
    return a.team === b.team ? 'teammates' : 'opponents';
  }
  if (P(a) || P(b)) {
    const p = P(a) ? a : b, o = P(a) ? b : a, who = G(p) ? 'a goalie' : 'a skater';
    if (o.lat === 'ml') return `${who} and his club's win`;
    if (o.lat === 'pl') return `${who} and ${p.team === o.team ? 'his club' : 'the other club'} covering -1.5`;
    return `${who} and the total`;
  }
  return [a.lat, b.lat].sort().join('|') === 'ml|tot' ? 'the favourite\'s win and the total' : 'the -1.5 and the total';
}
/* a group of pairs: how often both landed against the copula's chance and the product's, the co-movement beyond the two
   chances (sum (y1 - p1)(y2 - p2), against the copula's Phi2 - p1 p2) with its standard error and that of the actual
   minus the copula's, clustered by game, and the log loss of "both land" */
function acc() { return { pairs: 0, both: 0, cop: 0, ind: 0, resid: 0, copCov: 0, llCop: 0, llInd: 0, games: new Map() }; }
const cl9 = q => Math.min(1 - 1e-9, Math.max(1e-9, q));
function addPair(A, a, b, rho, gid) {
  const p1 = a.p, p2 = b.p, y1 = a.y, y2 = b.y;
  const ind = p1 * p2, cop = rho ? S.bvnu(-a.h, -b.h, rho) : ind, y = y1 * y2, res = (y1 - p1) * (y2 - p2);
  A.pairs++; A.both += y; A.cop += cop; A.ind += ind; A.resid += res; A.copCov += cop - ind;
  A.llCop -= y ? Math.log(cl9(cop)) : Math.log(1 - cl9(cop)); A.llInd -= y ? Math.log(cl9(ind)) : Math.log(1 - cl9(ind));
  let x = A.games.get(gid); if (!x) A.games.set(gid, x = [0, 0, 0]); x[0] += res; x[1] += res - (cop - ind); x[2]++;
}
function done(A) {
  const n = A.pairs; if (!n) return null;
  const mA = A.resid / n, mD = (A.resid - A.copCov) / n; let sA = 0, sD = 0;
  for (const [ra, rd, k] of A.games.values()) { sA += (ra - k * mA) ** 2; sD += (rd - k * mD) ** 2; }
  return { pairs: n, games: A.games.size, both_landed: r4(A.both / n), copula: r4(A.cop / n), independence: r4(A.ind / n),
    co_movement: { actual: r6(mA), copula: r6(A.copCov / n), actual_se: r6(Math.sqrt(sA) / n), actual_minus_copula_se: r6(Math.sqrt(sD) / n) },
    logloss: { copula: r6(A.llCop / n), independence: r6(A.llInd / n) } };
}
const doneAll = M => Object.fromEntries(Object.entries(M).sort(([a], [b]) => a < b ? -1 : 1).map(([k, A]) => [k, done(A)]));
/* every pair of legs in every game of `games`: the model's chances, the table's rho, both legs' outcomes */
function validateBox(games, T, withRungs) {
  const groups = {}, keys = {}, all = acc(), rungs = acc(); let checked = 0;
  const G = name => groups[name] = groups[name] || acc(), K = name => keys[name] = keys[name] || acc();
  for (const g of games) {
    const main = itemsOf(g).concat(teamItems(g));
    for (const it of main) it.h = S.invNorm(it.p);
    for (let i = 0; i < main.length; i++) for (let j = i + 1; j < main.length; j++) {
      const a = main[i], b = main[j], r = S.rhoLat(T, a.lat, b.lat);
      if (r === null) continue;
      const key = keyLat(a.lat, b.lat);
      if ((typeof T.rho[key] === 'number' ? T.rho[key] : 0) * signLat(a.lat, b.lat) !== r) throw new Error(`keyLat and sgp.js's rhoLat disagree on ${key}`);
      checked++;
      if (mirror(a.lat, b.lat)) continue;
      addPair(all, a, b, r, g.id); addPair(G(groupOf(a.lat, b.lat, key)), a, b, r, g.id); addPair(K(key), a, b, r, g.id);
    }
    if (withRungs) {
      const rg = itemsOf(g, true);
      for (const it of rg) it.h = S.invNorm(it.p);
      for (const a of rg) for (const b of main) {
        if (b.lat.lat === 'p' && b.pid === a.pid && b.k === a.k) continue;
        const r = S.rhoLat(T, a.lat, b.lat); if (r === null || mirror(a.lat, b.lat)) continue;
        addPair(rungs, a, b, r, g.id);
      }
    }
  }
  return { all: done(all), groups: doneAll(groups), rungs: withRungs ? done(rungs) : undefined, keys: doneAll(keys), lookups_held_to_sgp: checked };
}
/* DraftKings' real closing lines on a game (the record, tools/props.js), each at DraftKings' fair chance: a main line's
   Over (all of the margin on the Over: 1 - the Under's implied) and every Yes rung that is not a main line's Over
   (implied over the stat's measured margin, fair.yes), on a player who played; with the state's game lines for the
   club legs where it has them (each side's share of the two prices) */
function dkLegs(rec, g, yes, line) {
  const b = g.box, sk = new Map(b.skaters.filter(x => x.toi > 0).map(x => [x.id, x])), gk = new Map(b.goalies.filter(x => x.toi > 0).map(x => [x.id, x]));
  const actual = (aid, stat) => { if (stat === 'sv') { const x = gk.get(aid); return x ? x.sa - x.ga : undefined; } const x = sk.get(aid); if (!x) return undefined; return stat === 'pts' ? (x.g || 0) + (x.a || 0) : stat === 'g' ? (x.g || 0) : stat === 'a' ? (x.a || 0) : x[stat]; };
  const grpOf = (aid, stat) => stat === 'sv' ? (gk.has(aid) ? 'G' : null) : sk.has(aid) ? (sk.get(aid).pos === 'D' ? 'D' : 'F') : null;
  const legs = [], mainOver = new Set();
  const push = (aid, stat, L, pf, dec, kind) => {
    const x = actual(aid, stat), grp = grpOf(aid, stat); if (x === undefined || x === null || !grp) return;
    const team = stat === 'sv' ? gk.get(aid).team : sk.get(aid).team;
    legs.push({ k: grp + ':' + stat, pid: aid, team, stat, L, p: clip(pf), y: x > L ? 1 : 0, dec, kind, lat: S.latent({ game: g.id, team, pid: aid, grp, stat, side: 'over' }) });
  };
  for (const [aid, stat, L, po, pu] of rec.main || []) { if (Number.isInteger(L)) continue; mainOver.add(aid + '|' + stat + '|' + (L + 0.5)); push(aid, stat, L, 1 - S.implied(pu), S.decOf(po), 'main'); }
  for (const [aid, stat, k, price] of rec.yes || []) {
    if (mainOver.has(aid + '|' + stat + '|' + k)) continue;
    const m = stat === 'g' ? (k === 1 ? yes.g : yes['g2+']) : yes[stat]; if (!m) continue;
    push(aid, stat, k - 0.5, S.implied(price) / m, S.decOf(price), stat === 'g' && k === 1 ? 'anytime goal' : 'rung');
  }
  if (line && line.homeML && line.awayML && g.box.hs !== undefined) {
    const margin = b.hs - b.as, tot = b.hs + b.as, fair2 = (x, o) => S.implied(x) / (S.implied(x) + S.implied(o));
    const favHome = S.implied(line.homeML) >= S.implied(line.awayML), fav = favHome ? g.home : g.away;
    for (const [t, o, x, ox, y] of [[g.home, g.away, line.homeML, line.awayML, margin > 0], [g.away, g.home, line.awayML, line.homeML, margin < 0]])
      legs.push({ k: 'ml', team: t, p: clip(fair2(x, ox)), y: y ? 1 : 0, dec: S.decOf(x), kind: 'win', lat: S.latent({ game: g.id, team: t, opp: o, kind: 'ml', fav: t === fav }) });
    if (Math.abs(line.homeLine) === 1.5 && line.homeSpreadOdds && line.awaySpreadOdds) {
      const minusHome = line.homeLine < 0, S1 = minusHome ? g.home : g.away, x = minusHome ? line.homeSpreadOdds : line.awaySpreadOdds, ox = minusHome ? line.awaySpreadOdds : line.homeSpreadOdds;
      legs.push({ k: 'pl', team: S1, p: clip(fair2(x, ox)), y: (minusHome ? margin : -margin) >= 2 ? 1 : 0, dec: S.decOf(x), kind: '-1.5', lat: S.latent({ game: g.id, team: S1, opp: S1 === g.home ? g.away : g.home, kind: 'pl', line: -1.5, fav: S1 === fav }) });
    }
    if (line.total && !Number.isInteger(line.total) && line.overOdds && line.underOdds)
      legs.push({ k: 'tot', p: clip(fair2(line.overOdds, line.underOdds)), y: tot > line.total ? 1 : 0, dec: S.decOf(line.overOdds), kind: 'over', lat: S.latent({ game: g.id, kind: 'tot', side: 'over' }) });
  }
  return legs;
}
/* deterministic sampling for the tickets */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* DraftKings' real lines: every pair in every game; then two-, three- and four-leg tickets through sgp.js's parlay() (one
   leg a player and stat, one side bet; half drawn from one club and the total, half from the whole game; on main lines
   and club legs alone, DraftKings' two-sided prices, and on every line), each ticket's matrix made positive definite as
   the page will, against how many landed, with what the hold makes of each ticket's price; and whether the game's whole
   matrix (one leg a player and stat, the favourite's win and the total) is positive definite as measured */
function validateDK(games, recs, T, yes, lines, seed) {
  const groups = {}, all = acc(), kinds = {}; const G = n => groups[n] = groups[n] || acc();
  const tk = {}, R = rng(seed), psdGames = { games: 0, legs: 0, needed: 0, maxLam: 0, neededNoNest: 0, maxLamNoNest: 0 };
  let nGames = 0;
  for (const g of games) {
    const rec = recs.get(g.id); if (!rec || rec.status !== 200) continue;
    const legs = dkLegs(rec, g, yes, lines ? lines.get(g.id) : null); if (legs.length < 2) continue;
    nGames++;
    for (const l of legs) l.h = S.invNorm(l.p);
    for (let i = 0; i < legs.length; i++) for (let j = i + 1; j < legs.length; j++) {
      const a = legs[i], b = legs[j];
      if (a.lat.lat === 'p' && b.lat.lat === 'p' && a.pid === b.pid && a.stat === b.stat) continue;   // one leg a player and stat
      const r = S.rhoLat(T, a.lat, b.lat); if (r === null || mirror(a.lat, b.lat)) continue;
      const key = keyLat(a.lat, b.lat);
      addPair(all, a, b, r, g.id); addPair(G(groupOf(a.lat, b.lat, key)), a, b, r, g.id);
      const kk = [a.kind, b.kind].sort().join(' + '); addPair(kinds[kk] = kinds[kk] || acc(), a, b, r, g.id);
    }
    const one = new Map();
    for (const l of legs) { if (l.k === 'pl' || (l.k === 'ml' && !l.lat.fav)) continue; const id = l.lat.lat === 'p' ? l.pid + '|' + l.stat : l.k; const o = one.get(id); if (!o || (o.kind !== 'main' && (l.kind === 'main' || l.L < o.L))) one.set(id, l); }
    const full = [...one.values()], M = S.corrMatrix(T, full.map(l => legOf(l, g)));
    if (!M.R) throw new Error(`the whole-game matrix of ${g.id} was refused`);
    const P = S.psd(M.R); psdGames.games++; psdGames.legs += full.length; if (P.lam > 0) psdGames.needed++; psdGames.maxLam = Math.max(psdGames.maxLam, P.lam);
    const nest = new Set(full.filter(l => l.stat === 'g' || l.stat === 'a').map(l => l.pid)), lean = full.filter(l => !(l.stat === 'pts' && nest.has(l.pid)));
    const P2 = S.psd(S.corrMatrix(T, lean.map(l => legOf(l, g))).R); if (P2.lam > 0) psdGames.neededNoNest++; psdGames.maxLamNoNest = Math.max(psdGames.maxLamNoNest, P2.lam);
    for (const n of [2, 3, 4]) for (const kind of ['main lines and club legs', 'every line']) for (let t = 0; t < 30; t++) {
      const base = kind === 'every line' ? legs : legs.filter(l => l.kind !== 'rung' && l.kind !== 'anytime goal');
      const club = R() < 0.5 ? g.home : g.away, pool = t % 2 ? base : base.filter(l => l.team === club || l.k === 'tot');
      const pick = [], seen = new Set(); let tries = 0;
      while (pick.length < n && tries++ < 60) { const l = pool[Math.floor(R() * pool.length)]; if (!l) break; const id = l.lat.lat === 'p' ? l.pid + '|' + l.stat : l.k === 'tot' ? 'tot' : 'side'; if (seen.has(id)) continue; seen.add(id); pick.push(l); }
      if (pick.length < n) continue;
      const res = S.parlay(T, pick.map(l => legOf(l, g)));
      if (!res || res.refused) throw new Error('a sampled ticket was refused');
      const ind = pick.reduce((a, l) => a * l.p, 1), y = pick.every(l => l.y) ? 1 : 0, gm = res.games[0];
      const x = tk[n + ' legs, ' + kind] = tk[n + ' legs, ' + kind] || { n: 0, all: 0, cop: 0, ind: 0, llCop: 0, llInd: 0, lam: 0, holds: [], ratios: [], capped: 0, byGame: new Map() };
      x.n++; x.all += y; x.cop += res.fair; x.ind += ind;
      x.llCop -= y ? Math.log(cl9(res.fair)) : Math.log(1 - cl9(res.fair)); x.llInd -= y ? Math.log(cl9(ind)) : Math.log(1 - cl9(ind));
      const d = x.byGame.get(g.id) || [0, 0]; d[0] += y - res.fair; d[1] += y - ind; x.byGame.set(g.id, d);
      if (res.lam > 0) x.lam++; x.holds.push(1 - res.dec * res.fair); x.ratios.push(res.dec / gm.product); if (gm.dec >= gm.product - 1e-12) x.capped++;
    }
  }
  const med = a => { const s = a.slice().sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  /* the sd of landed minus expected is clustered by game (a game's tickets share its legs) */
  const csd = (x, i) => r3(Math.sqrt([...x.byGame.values()].reduce((a, d) => a + d[i] * d[i], 0)));
  const tickets = Object.fromEntries(Object.entries(tk).map(([k, x]) => [k, { tickets: x.n, landed: x.all, copula_expects: r3(x.cop), independence_expects: r3(x.ind),
    landed_minus_copula: { by: r3(x.all - x.cop), sd: csd(x, 0) }, landed_minus_independence: { by: r3(x.all - x.ind), sd: csd(x, 1) },
    logloss: { copula: r6(x.llCop / x.n), independence: r6(x.llInd / x.n) }, shrunk_to_positive_definite: x.lam,
    estimated_price: { of_the_plain_product_median: r4(med(x.ratios)), hold_over_the_fair_chance_median: r4(med(x.holds)), capped_at_the_product: x.capped } }]));
  return { games: nGames, all: done(all), groups: doneAll(groups), by_line: doneAll(kinds), tickets,
    whole_game_matrix: { games: psdGames.games, legs_a_game: psdGames.games ? Math.round(psdGames.legs / psdGames.games) : 0, shrunk: psdGames.needed, largest_lambda: psdGames.maxLam,
      without_nested_points: { shrunk: psdGames.neededNoNest, largest_lambda: psdGames.maxLamNoNest } } };
}
/* a validation leg as sgp.js's builder leg */
function legOf(l, g) {
  const base = { game: g.id, p: l.p, dec: l.dec };
  if (l.lat.lat === 'p') return Object.assign(base, { team: l.team, pid: l.pid, grp: l.k[0], stat: l.stat, side: 'over' });
  const opp = l.team === g.home ? g.away : g.home;
  if (l.k === 'ml') return Object.assign(base, { team: l.team, opp, kind: 'ml', fav: l.lat.fav });
  if (l.k === 'pl') return Object.assign(base, { team: l.team, opp, kind: 'pl', line: -1.5, fav: l.lat.fav });
  return Object.assign(base, { kind: 'tot', side: 'over' });
}

/* ---------- the parts ---------- */
function loadData(real) {
  const PJ = require('./players'), PR = require('./props'), ELO = require('./elo');
  const data = process.env.NHL_DATA || real;
  const model = readJSON(path.join(data, 'model.json'));
  const PJson = readJSON(path.join(real, 'players.json')), M = readJSON(path.join(real, 'props_model.json'));
  const L = PJ.loadGames();
  const viewsFor = params => new Map(PJ.replay(params, L.games, L.elo, 'projected', true).recs.map(x => [String(x.id), x]));
  return { PJ, PR, ELO, PJson, M, model, games: L.games, elo: L.elo, viewsFor };
}
/* the child: the finished seasons alone */
function finishedPart() {
  seriesSelfTest();
  const D = loadData(REAL);
  const seasons = [...new Set(D.games.map(g => g.season))].sort((a, b) => a - b), last = seasons[seasons.length - 1];
  log(`finished seasons boxed: ${seasons.join(', ')} (${D.games.length} games); ${WARM - 1}-${String(WARM).slice(2)} warms the walk up`);
  D.view = D.viewsFor(D.PJson.params);
  const legs = buildLegs(D, D.M.params);
  log(`legs built on the props model's registered constants (${D.M.sha})`);
  const M = measure(legs, s => s > WARM && s <= last);
  const table = tableOf(M);
  log(`table: ${Object.keys(table).length} entries on ${M.games} games (${M.seasons.join(', ')})`);
  const out = { table, measured: M };
  if (CHECK) return out;
  /* the validation table: 2022-23 to 2024-25 alone, on the props model's walk-forward constants for 2025-26 and
     players.js's for 2025-26 (each searched only on the seasons before it) */
  const wf = D.M.report && D.M.report.walk && D.M.report.walk[last], pjw = D.PJson.report && D.PJson.report.walk && D.PJson.report.walk[last];
  if (!wf) throw new Error(`no walk-forward constants for ${last} in props_model.json`);
  const sameViews = !pjw || JSON.stringify(pjw.params || pjw) === JSON.stringify(D.PJson.params);
  const V = Object.assign({}, D, { view: sameViews ? D.view : D.viewsFor(pjw.params || pjw) });
  const vlegs = buildLegs(V, wf.constants);
  const VM = measure(vlegs, s => s > WARM && s < last), VT = { rho: tableOf(VM), hold: HOLD };
  log(`validation table: ${Object.keys(VT.rho).length} entries on ${VM.games} games (${VM.seasons.join(', ')}); ${last} held out`);
  const hold = vlegs.filter(g => g.season === last);
  const box = validateBox(hold, VT, true);
  log(`box scores ${last}: ${box.all.pairs} pairs, both landed ${box.all.both_landed}, copula ${box.all.copula}, independence ${box.all.independence}`);
  const PR = D.PR, recs = PR.allRecords();
  const fairYes = D.M.report.fair.yes;
  const dk = validateDK(hold, recs, VT, fairYes, null, 1);
  log(`DraftKings' lines ${last}: ${dk.games} games, ${dk.all ? dk.all.pairs : 0} pairs`);
  /* the validation table's entries beside the table's, for the report */
  const diffs = Object.keys(table).map(k => [k, r3((VT.rho[k] || 0) - table[k])]).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
  out.validation = { table: { seasons: VM.seasons, games: VM.games, constants: `props_model.json report.walk[${last}] (searched on ${VM.seasons.join(', ')})`,
    against_the_table: { largest_differences: diffs.slice(0, 8).map(([k, d]) => `${k} ${VT.rho[k]} (table ${table[k]})`), mean_abs_difference: r4(diffs.reduce((a, [, d]) => a + Math.abs(d), 0) / diffs.length) } },
    box: Object.assign({ season: last, games: hold.length, chances: 'the model\'s (the walk-forward constants above)' }, box), dk: Object.assign({ season: last, chances: 'DraftKings\' fair chances at its closing prices (the record, tools/props.js)' }, dk) };
  return out;
}
/* the parent: the child on a scratch folder of the finished seasons, then this season's DraftKings lines on the real files */
function main() {
  const Hist = require('./hist');
  const finished = new Set(Hist.seasons(REAL));
  /* --check reads the seasons the file was measured on, and no later one (a season finished since would move the league's
     averages players.js takes over every boxed game), so the check holds after a rollover; a new table is a deliberate run */
  const F0 = CHECK && fs.existsSync(OUT_F) ? readJSON(OUT_F) : null;
  const upto = F0 && F0.measured ? Math.max(...F0.measured.seasons) : Infinity, inScope = y => finished.has(y) && y <= upto;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nhl-corr-'));
  try {
    for (const f of fs.readdirSync(REAL)) {
      const m = /^box_(\d{4})\.jsonl$/.exec(f);
      const pm = /^props_(\d{4})\.jsonl$/.exec(f), sm = /^season_(\d{4})\.json$/.exec(f);
      if (f === 'history.json' || f === 'model.json' || (sm && inScope(+sm[1])) || (m && inScope(+m[1])) || (pm && inScope(+pm[1]))) fs.symlinkSync(path.join(REAL, f), path.join(tmp, f));
    }
    const outF = path.join(tmp, 'out.json');
    const r = cp.spawnSync(process.execPath, [__filename, ...process.argv.slice(2)], { stdio: 'inherit', env: Object.assign({}, process.env, { CORR_PART: 'finished', CORR_REAL: REAL, CORR_OUT: outF, NHL_DATA: tmp, NHL_STATE: path.join(tmp, 'no-state.json') }) });
    if (r.status !== 0) throw new Error('the measuring child failed');
    const child = readJSON(outF);
    if (CHECK) {
      if (!fs.existsSync(OUT_F)) { console.log('corr check: no data/corr.json'); process.exit(1); }
      const F = readJSON(OUT_F); const bad = [];
      for (const k of new Set([...Object.keys(F.rho || {}), ...Object.keys(child.table)])) if (F.rho[k] !== child.table[k]) bad.push(`${k}: file ${F.rho[k]}, measured ${child.table[k]}`);
      if (JSON.stringify(F.hold) !== JSON.stringify(HOLD)) bad.push('the hold is not tools/corr.js\'s');
      for (const b of bad.slice(0, 20)) console.log('  ' + b);
      console.log(`corr check: ${Object.keys(child.table).length} entries measured, ${bad.length} differ from data/corr.json; ${bad.length ? 'FAIL' : '0 failures'}`);
      process.exit(bad.length ? 1 : 0);
    }
    /* this season so far: the table this file writes, on DraftKings' lines (the record) with its game lines (the state) */
    const D = loadData(REAL);
    const st = fs.existsSync(path.join(ROOT, 'state.json')) ? readJSON(process.env.NHL_STATE || path.join(ROOT, 'state.json')) : null;
    const current = st ? st.season : null;
    let now = null;
    if (current && !finished.has(current)) {
      D.view = D.viewsFor(D.PJson.params);
      const legs = buildLegs(D, D.M.params).filter(g => g.season === current);
      const lines = new Map(st.games.filter(g => g.state === 'final' && g.line).map(g => [String(g.id), g.line]));
      now = Object.assign({ season: current, chances: 'DraftKings\' fair chances at its closing prices; the win, the -1.5 and the total from the line the state froze at puck drop (each side\'s share of the two prices); nothing is chosen on these games' },
        validateDK(legs, D.PR.allRecords(), { rho: child.table, hold: HOLD }, D.M.report.fair.yes, lines, 2));
      log(`DraftKings' lines ${current} so far: ${now.games} games, ${now.all ? now.all.pairs : 0} pairs`);
    }
    const M = child.measured;
    const file = {
      what: ('The same-game table (tools/corr.js; tools/sgp.js is the rule that reads it): the tetrachoric correlation of two legs of one game at the lines '
        + 'DraftKings posts, each leg\'s expectation taken out, measured on the hub\'s own box scores of the finished seasons and never the season in play, '
        + 'shrunk toward 0 by its own standard error; and the same-game hold. Written by node tools/corr.js, never by hand (--check holds it).'),
      measured: { seasons: M.seasons, games: M.games, warm: WARM, constants: 'data/props_model.json params (the props model\'s registered constants) and data/players.json params', on: new Date().toISOString().slice(0, 10) },
      lines: { g: 0.5, a: 0.5, pts: 0.5, s: 'the half point nearest an even chance on the props model\'s distribution', bs: 'the same', sv: 'the half point nearest the goalie\'s mean (saves a normal rounded to whole saves)', tot: 'the half point nearest an even chance on the goals layer', pl: 'the favourite (the pre-game view\'s) covering -1.5', ml: 'the club wins, overtime and the shootout included' },
      keys: 'rel|k1|k2, k1 <= k2 by string order; kinds F:<stat>, D:<stat> (g a pts s bs), G:sv, ml, pl, tot; rel self, team, opp, game, fav, dog (tools/sgp.js rhoLat reads them)',
      rho: child.table,
      hold: HOLD,
      report: {
        method: ('rho solves sum (y1 - p1)(y2 - p2) = sum (Phi2(Phi^-1(p1), Phi^-1(p2); rho) - p1 p2) over every pair of the kind in every game of the seasons '
          + 'measured, p the hub\'s pre-game chance (the props model\'s distribution, the goals layer); pairs of players by the tetrachoric series, one player\'s '
          + 'two stats exactly; se cluster-robust by game; rho = raw * raw^2 / (raw^2 + se^2); |rho| <= ' + RMAX + '. "bound" marks a raw rho at that cap '
          + '(a player\'s points with his own goals or assists are nested: every goal and assist is a point, so at 0.5 the pair is one event and its rho is 1)'),
        entries: Object.fromEntries(Object.entries(M.entries).sort(([a], [b]) => a < b ? -1 : 1)),
        validation: Object.assign({}, child.validation, { this_season: now }),
      },
    };
    writeFile(file);
    log(`wrote ${path.relative(ROOT, OUT_F)}: ${Object.keys(file.rho).length} entries`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}
/* the file: the header's fields one a line, the table one entry a line, the report one key a line */
function writeFile(F) {
  const lines = ['{'];
  const keys = Object.keys(F);
  keys.forEach((k, i) => {
    const comma = i < keys.length - 1 ? ',' : '';
    if (k === 'rho') lines.push(' "rho": {\n' + Object.entries(F.rho).map(([kk, v]) => `  ${JSON.stringify(kk)}: ${v}`).join(',\n') + '\n }' + comma);
    else if (k === 'report') lines.push(' "report": {\n' + Object.entries(F.report).map(([kk, v]) => kk === 'entries'
      ? '  "entries": {\n' + Object.entries(v).map(([e, x]) => `   ${JSON.stringify(e)}: ${JSON.stringify(x)}`).join(',\n') + '\n  }'
      : `  ${JSON.stringify(kk)}: ${JSON.stringify(v)}`).join(',\n') + '\n }' + comma);
    else lines.push(` ${JSON.stringify(k)}: ${JSON.stringify(F[k])}${comma}`);
  });
  lines.push('}');
  const tmp = OUT_F + '.part'; fs.writeFileSync(tmp, lines.join('\n') + '\n'); fs.renameSync(tmp, OUT_F);
}

if (require.main === module) {
  try {
    if (PART === 'finished') { const out = finishedPart(); fs.writeFileSync(process.env.CORR_OUT, JSON.stringify(out)); }
    else main();
  } catch (e) { console.error(e); process.exit(1); }
}
module.exports = { aVec, series, solveSeries, solveSelf, skLegs, gkLegs, keyLat, HOLD, NT, RSER, RMAX };
