/* The NFL hub's three pick'em models in hockey's terms (nhl v20, the owner's ask of 25 October 2026: "mimic the models for
   Alpha, The Joker, and ELO model found in the nfl"). Each is a straight-up call on every game, made while the game is to
   come and frozen at its puck drop with the site's own call (update.js carries it in the call as `models`, one of the CALL
   fields), and graded on the Pick'em tab beside the call, the team Elo and DraftKings.

   ALPHA. The NFL's Alpha is a margin model: an Elo with the week's stats beside it (moving averages of EPA, turnovers and the
   like), least squares on the margin, the win chance a logistic of it. Hockey's: the home margin in goals =
   w0 + w1 x the team Elo's gap (tools/elo.js with data/model.json, home ice and rest in it) + w2 x net shots + w3 x net goals
   + w4 x the goalies' gap, and the win chance logistic(k x margin). Net shots: each club's moving average (weight `a` on the
   newest game) of its shots on goal for less against, from the box scores, the home club's less the away club's; net goals
   the same on regulation goals; the goalie: each starter's goals saved above the league's save rate in a 30-shot game,
   shrunk by `gM` shots of the league's (the goalie players.js names for a game to come, the box score's starter for one
   played). Between seasons a club's averages keep `carry` of their distance from the league's, a goalie's record `gcarry`.

   THE JOKER. The NFL's is boosted trees on every pre-game input, the market among them. Its own recipe here (trees from the
   training mean, depth 4, 25 rounds, rate 0.1, five rows a leaf) fit 69-77% of the seasons it saw and walked forward at log
   loss 0.6742, behind both the market (0.6644) and the team Elo (0.6714): the NFL's own finding, a tree on the market alone
   cannot rebuild the market's number. So the Joker boosts from the market's chance (DraftKings' moneyline with the margin out,
   on the line frozen with the call; for the seasons it is fitted on, ESPN BET's or DraftKings' closing line in data/lines.json;
   the team Elo's chance where a game has no line) with trees on 21 inputs: the market's log-odds and total, Alpha's inputs,
   each club's shots and goals for and against, both goalies, rest, points per game and the playoffs; depth 3, 25 rounds,
   rate 0.03, a hundred rows a leaf (tools/gbdt.js). As the NFL's, it ends up mostly the market: it takes the favourite's side
   on nine games in ten.

   THE ELO MODEL. The NFL's is its player-Elo game model put on the Joker's baseline: logit(the Joker's chance held to 1-99%)
   + beta x the player model's gap. Hockey's player ratings are tools/players.js (every skater's offence and defence and every
   goalie's save rating, a lineup weighted by ice time, injuries and the announced goalies), and its gap is its expected goal
   margin with home ice taken out (players.js's `mu` less its `hfa`): logit(Joker) + beta x that. beta by log loss on the
   Joker's walk-forward chances and the player model's walk-forward margins.

   Fitted once, on the finished seasons only (2022-23 to the last; 2021-22 warms the averages): `node tools/models.js fit`
   writes data/models.json (source: the constants, the trees, the walk-forward table, about a minute) and the job never
   refits. Each season from 2023-24 is scored walk-forward, by constants fitted on the seasons before it. `node tools/models.js
   --backtest` calls every final of this season played before the models existed, on what was known before its puck drop
   (the ratings and averages to the day before, the line and the player model's view frozen with the call, its goalies),
   into data/models_backtest.json (source, written once), which the Pick'em counts and says so. */
'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const Hist = require('./hist');
const { Elo } = require('./elo');
const GB = require('./gbdt');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.NHL_DATA || path.join(ROOT, 'data');
const STATE_F = process.env.NHL_STATE || path.join(ROOT, 'state.json');
const OUTF = path.join(DATA, 'models.json'), BACKF = path.join(DATA, 'models_backtest.json');

const FIRST = 2023;                                   // the first season fitted on (2022-23); 2021-22 warms the averages
const GRID = { a: [0.08, 0.12, 0.16], carry: [0.3, 0.6] };
const FIXED = { gcarry: 0.7, gM: 1000 };
const JOKER_OPT = { depth: 3, rounds: 25, lr: 0.03, minLeaf: 100 };
const A_FEATS = ['eloDiff', 'netS', 'netG', 'gk'];
const J_FEATS = ['mkl', 'total', 'eloDiff', 'netS', 'netG', 'gk', 'gkH', 'gkA', 'sfH', 'saH', 'sfA', 'saA', 'gfH', 'gaH', 'gfA', 'gaA', 'restH', 'restA', 'ptsH', 'ptsA', 'playoff'];
const LEAGUE = { sv: 0.905, shots: 30, goals: 3 };
const HOLD = [0.01, 0.99];

const sig = GB.sig, logit = p => Math.log(p / (1 - p));
const r4 = v => +v.toFixed(4);
const implied = o => o < 0 ? -o / (100 - o) : 100 / (100 + o);
const priced = v => v !== null && v !== undefined && v !== '' && isFinite(v) && +v !== 0;
/* the market's chance of the home side and its total, from a line: the moneyline with the margin taken out */
function marketOf(line) {
  if (!line || !priced(line.homeML) || !priced(line.awayML)) return { mk: null, total: line && isFinite(line.total) && line.total !== null ? +line.total : null };
  const h = implied(+line.homeML), a = implied(+line.awayML);
  return { mk: h / (h + a), total: line.total !== null && line.total !== undefined && isFinite(line.total) ? +line.total : null };
}
const days = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
/* a side's starter in a box score: the plays' mark (st), else the goalie who played most */
const starterOf = (b, team) => { const gs = b.goalies.filter(x => x.team === team); const m = gs.find(x => x.st); return (m || gs.slice().sort((x, y) => y.toi - x.toi)[0] || {}).id || null; };

/* ---------- the running inputs: every final replayed in date order ---------- */
class Feats {
  constructor(P, eloParams) { this.P = P; this.elo = new Elo(eloParams); this.T = {}; this.G = {}; this.season = null; }
  newSeason(s) {
    if (this.season !== null && s !== this.season) {
      const P = this.P;
      for (const t of Object.values(this.T)) {
        for (const [k, m] of [['sf', LEAGUE.shots], ['sa', LEAGUE.shots], ['gf', LEAGUE.goals], ['ga', LEAGUE.goals]]) t[k] = m + (t[k] - m) * P.carry;
        t.pts = 0; t.gp = 0;
      }
      for (const x of Object.values(this.G)) { x.sx *= P.gcarry; x.n *= P.gcarry; }
    }
    if (s !== this.season) this.elo.newSeason(s);
    this.season = s;
  }
  team(id) { return this.T[id] || (this.T[id] = { sf: LEAGUE.shots, sa: LEAGUE.shots, gf: LEAGUE.goals, ga: LEAGUE.goals, pts: 0, gp: 0 }); }
  /* a goalie's goals saved above the league in a 30-shot game, shrunk by gM shots; 0 for one with no record (or none named) */
  goalie(id) { const x = id && this.G[id]; return x ? x.sx / (x.n + this.P.gM) * 30 : 0; }
  /* a game's inputs before it is played: the goalies' ids and the line given */
  pre(g, gh, ga, line) {
    const pre = this.elo.predict(g), H = this.team(g.home), A = this.team(g.away);
    const rest = id => this.elo.last[id] ? Math.min(4, Math.max(0, days(this.elo.last[id], g.date))) : 4;
    const { mk, total } = marketOf(line);
    const f = { eloDiff: pre.diff, pElo: pre.pHome, netS: (H.sf - H.sa) - (A.sf - A.sa), netG: (H.gf - H.ga) - (A.gf - A.ga),
      sfH: H.sf, saH: H.sa, sfA: A.sf, saA: A.sa, gfH: H.gf, gaH: H.ga, gfA: A.gf, gaA: A.ga,
      gkH: this.goalie(gh), gkA: this.goalie(ga), restH: rest(g.home), restA: rest(g.away),
      ptsH: H.gp ? H.pts / (2 * H.gp) : 0.5, ptsA: A.gp ? A.pts / (2 * A.gp) : 0.5, mk, mkl: mk === null ? null : logit(mk), total, playoff: g.type === 3 ? 1 : 0 };
    f.gk = f.gkH - f.gkA;
    return f;
  }
  /* a final: the Elo, the points, and from its box score the clubs' averages and the goalies' records */
  play(g, b) {
    this.elo.play(g);
    const H = this.team(g.home), A = this.team(g.away), w = g.hs > g.as, ot = g.periods > 3;
    H.gp++; A.gp++; H.pts += w ? 2 : ot ? 1 : 0; A.pts += !w ? 2 : ot ? 1 : 0;
    if (!b) return;
    const shotsFor = side => b.goalies.filter(x => x.team === b[side === 'home' ? 'away' : 'home']).reduce((s, x) => s + (x.sa || 0), 0);
    const sh = shotsFor('home'), sa = shotsFor('away'), a = this.P.a;
    if (sh > 5 && sa > 5) {
      const rh = ot && w ? g.hs - 1 : g.hs, ra = ot && !w ? g.as - 1 : g.as;          // regulation goals: the winner's deciding goal past sixty minutes taken off
      H.sf += a * (sh - H.sf); H.sa += a * (sa - H.sa); A.sf += a * (sa - A.sf); A.sa += a * (sh - A.sa);
      H.gf += a * (rh - H.gf); H.ga += a * (ra - H.ga); A.gf += a * (ra - A.gf); A.ga += a * (rh - A.ga);
    }
    for (const x of b.goalies) { if (!(x.sa > 0)) continue; const y = this.G[x.id] || (this.G[x.id] = { sx: 0, n: 0 }); y.sx += x.sa * (1 - LEAGUE.sv) - x.ga; y.n += x.sa; }
  }
}

/* ---------- the data ---------- */
function readBox(dataDir) {
  const box = {};
  for (const f of fs.readdirSync(dataDir).filter(f => /^box_\d+\.jsonl$/.test(f))) for (const l of fs.readFileSync(path.join(dataDir, f), 'utf8').split('\n')) { if (!l) continue; const b = JSON.parse(l); box[b.id] = b; }
  return box;
}
function readLines(dataDir) {
  const f = path.join(dataDir, 'lines.json'); if (!fs.existsSync(f)) return {};
  const L = JSON.parse(fs.readFileSync(f, 'utf8')), ix = Object.fromEntries(L.cols.map((c, i) => [c, i])), out = {};
  for (const r of L.rows) out[r[ix.id]] = { homeML: r[ix.homeML], awayML: r[ix.awayML], total: r[ix.total] };
  return out;
}
/* every final in date order: the finished seasons, then this season's from the games given (each with its frozen line and player view) */
function finalsOf(dataDir, season, games) {
  const rows = Hist.rows(dataDir).map(r => Object.assign({}, r)), seen = new Set(rows.map(r => String(r.id)));
  for (const g of games || []) if (g.state === 'final' && g.hs !== null && g.hs !== undefined && !seen.has(String(g.id))) {
    rows.push({ id: g.id, season, type: g.type, date: g.date, home: g.home, away: g.away, hs: g.hs, as: g.as, periods: g.periods, neutral: g.neutral, line: g.line || null, pm: g.pm || null });
    seen.add(String(g.id));
  }
  return rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0);
}
/* the replay: each final's inputs before it (from FIRST - 1 on, where the box scores begin) and the running state after the last */
function replay(P, eloParams, finals, box, lines) {
  const F = new Feats(P, eloParams), rows = [];
  for (const g of finals) {
    F.newSeason(g.season);
    const b = box[g.id];
    let gh = null, ga = null;
    if (g.pm && g.pm.home && g.pm.home.goalie && g.pm.away && g.pm.away.goalie) { gh = g.pm.home.goalie.id; ga = g.pm.away.goalie.id; }
    else if (b) { gh = starterOf(b, g.home); ga = starterOf(b, g.away); }
    if (g.season >= FIRST - 1) rows.push(Object.assign(F.pre(g, gh, ga, lines[g.id] || g.line || null), { id: g.id, season: g.season, type: g.type, win: g.hs > g.as ? 1 : 0, margin: g.hs - g.as, neutral: !!g.neutral, pm: g.pm || null }));
    F.play(g, b);
  }
  return { F, rows };
}

/* ---------- the three models on a row of inputs ---------- */
const alphaMu = (A, f) => A.w[0] + A_FEATS.reduce((s, k, i) => s + A.w[i + 1] * f[k], 0);
const alphaP = (A, f) => sig(A.k * alphaMu(A, f));
const jokerBase = f => f.mk !== null ? f.mkl : logit(f.pElo);
const jokerP = (J, f) => GB.predict(J, J_FEATS.map(k => f[k]), jokerBase(f));
const hold = p => Math.min(HOLD[1], Math.max(HOLD[0], p));
const eloP = (beta, pj, m) => sig(logit(hold(pj)) + beta * m);

/* ---------- fitting ---------- */
function ols(X, y) {
  const k = X[0].length, M = Array.from({ length: k }, () => new Array(k + 1).fill(0));
  for (let i = 0; i < X.length; i++) for (let p = 0; p < k; p++) { M[p][k] += X[i][p] * y[i]; for (let q = 0; q < k; q++) M[p][q] += X[i][p] * X[i][q]; }
  for (let c = 0; c < k; c++) {
    let piv = c; for (let r = c + 1; r < k; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < k; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let q = c; q <= k; q++) M[r][q] -= f * M[c][q]; }
  }
  return M.map((r, i) => r[k] / r[i]);
}
const logloss = (ps, ys) => { let s = 0; for (let i = 0; i < ps.length; i++) { const p = Math.min(0.999, Math.max(0.001, ps[i])); s -= ys[i] * Math.log(p) + (1 - ys[i]) * Math.log(1 - p); } return s / ps.length; };
const score = (ps, ys) => ({ n: ps.length, logloss: r4(logloss(ps, ys)), acc: r4(ps.reduce((a, p, i) => a + ((p >= 0.5) === (ys[i] === 1) ? 1 : 0), 0) / ps.length) });
/* a one-dimensional search for the least log loss, to three places, from lo to hi */
function line1(lo, hi, lossOf) { let best = null; for (let i = 0; lo + i * 0.001 <= hi + 1e-9; i++) { const v = +(lo + i * 0.001).toFixed(3), l = lossOf(v); if (!best || l < best.l - 1e-12) best = { v, l }; } return best.v; }
function fitAlpha(rows) {
  const X = rows.map(f => [1].concat(A_FEATS.map(k => f[k]))), w = ols(X, rows.map(f => f.margin)).map(v => +v.toFixed(6));
  const mus = X.map(x => x.reduce((s, v, i) => s + v * w[i], 0)), ys = rows.map(f => f.win);
  const k = line1(0.05, 1.5, k => logloss(mus.map(m => sig(k * m)), ys));
  return { w, k };
}
function fitJoker(rows) { return GB.fit(rows.map(f => J_FEATS.map(k => f[k])), rows.map(f => f.win), JOKER_OPT, rows.map(jokerBase)); }
const sha = o => crypto.createHash('sha256').update(JSON.stringify(o)).digest('hex').slice(0, 12);

async function fit() {
  const log = m => console.log(new Date().toISOString().slice(11, 19), m);
  const model = JSON.parse(fs.readFileSync(path.join(DATA, 'model.json'), 'utf8'));
  const S = fs.existsSync(STATE_F) ? JSON.parse(fs.readFileSync(STATE_F, 'utf8')) : null;
  const box = readBox(DATA), lines = readLines(DATA);
  const finals = finalsOf(DATA, S && S.season, S && S.games);
  const done = [...new Set(Hist.rows(DATA).map(r => r.season))].sort((a, b) => a - b), LAST = done[done.length - 1];
  const WALK = done.filter(s => s > FIRST);
  log(`${finals.length} finals; fitted on ${FIRST}-${LAST}, walked forward on ${WALK.join(', ')}, ${Object.keys(lines).length} closing lines`);
  /* Alpha's averages: the grid, each scored by Alpha's walk-forward log loss */
  let best = null; const tables = {};
  for (const a of GRID.a) for (const carry of GRID.carry) {
    const P = Object.assign({ a, carry }, FIXED), { rows } = replay(P, model.params, finals, box, lines); tables[JSON.stringify(P)] = rows;
    const ps = [], ys = [];
    for (const s of WALK) { const A = fitAlpha(rows.filter(f => f.season >= FIRST && f.season < s)); for (const f of rows.filter(f => f.season === s)) { ps.push(alphaP(A, f)); ys.push(f.win); } }
    const l = logloss(ps, ys); log(`averages ${JSON.stringify(P)}: Alpha walks forward at ${l.toFixed(5)}`);
    if (!best || l < best.l - 1e-12) best = { P, l };
  }
  const P = best.P, rows = tables[JSON.stringify(P)];
  /* the player model's margin, home ice out: each finished season by the parameters players.js searched on the seasons before it
     (its own walk-forward), this season's from the view frozen with each call */
  const PJ = JSON.parse(fs.readFileSync(path.join(DATA, 'players.json'), 'utf8')), PL = require('./players');
  const pg = PL.loadGames(), mOf = {};
  /* players.js sets the league's shots and goals per shot from every box score it reads, this season's among them; for the fit to be
     the same file all season, they are worked again here on the finished seasons alone, players.js's own sums */
  { let shots = 0, gl = 0, n = 0; for (const g of pg.games) { if (g.season > LAST) continue; const sa = g.goalies.reduce((a, x) => a + x.sa, 0); if (sa > 20) { shots += sa; gl += PL.regGoals(g, 'home') + PL.regGoals(g, 'away'); n++; } } PL.LEAGUE.shots = shots / n; PL.LEAGUE.conv = gl / shots; }
  for (const s of WALK) {
    const Ps = PJ.report.walk[s] && PJ.report.walk[s].params; if (!Ps) continue;
    const byId = new Map(pg.games.map(g => [g.id, g]));
    for (const x of PL.replay(Ps, pg.games.filter(g => g.season <= s), pg.elo, 'projected', true).recs) if (x.season === s) mOf[x.id] = { m: x.mu - (byId.get(x.id).neutral ? 0 : Ps.hfa), p: x.pHome };
    log(`the player model replayed on ${s}`);
  }
  for (const f of rows) if (f.pm && isFinite(f.pm.mu)) mOf[f.id] = { m: f.pm.mu - (f.neutral ? 0 : PJ.params.hfa), p: f.pm.pHome };
  /* walk-forward: each season by constants fitted on the seasons before it */
  const walk = {}, jwf = {};
  for (const s of WALK) {
    const tr = rows.filter(f => f.season >= FIRST && f.season < s), te = rows.filter(f => f.season === s), ys = te.map(f => f.win);
    const A = fitAlpha(tr), J = fitJoker(tr);
    te.forEach(f => { jwf[f.id] = jokerP(J, f); });
    const wm = te.filter(f => f.mk !== null), wp = te.filter(f => mOf[f.id]);
    walk[s] = { alpha: score(te.map(f => alphaP(A, f)), ys), joker: score(te.map(f => jwf[f.id]), ys), market: score(wm.map(f => f.mk), wm.map(f => f.win)), teamElo: score(te.map(f => f.pElo), ys),
      players: wp.length ? score(wp.map(f => mOf[f.id].p), wp.map(f => f.win)) : null, sameSide: r4(wm.filter(f => (jwf[f.id] >= 0.5) === (f.mk >= 0.5)).length / wm.length) };
    log(`walk-forward ${s}: Alpha ${walk[s].alpha.logloss}, Joker ${walk[s].joker.logloss}, market ${walk[s].market.logloss}, team Elo ${walk[s].teamElo.logloss}`);
  }
  /* the ELO Model's beta: each season's by the seasons before it (for its own walk-forward), and the one kept by all of them */
  const fitBeta = rs => line1(-0.5, 1, b => logloss(rs.map(f => eloP(b, jwf[f.id], mOf[f.id].m)), rs.map(f => f.win)));
  const withM = rows.filter(f => jwf[f.id] !== undefined && mOf[f.id] && f.season <= LAST);
  for (const s of WALK) {
    const tr = withM.filter(f => f.season < s), te = withM.filter(f => f.season === s);
    const b = tr.length ? fitBeta(tr) : null;
    walk[s].elo = b === null ? null : Object.assign(score(te.map(f => eloP(b, jwf[f.id], mOf[f.id].m)), te.map(f => f.win)), { beta: b });
  }
  const beta = fitBeta(withM);
  /* the constants, on every finished season */
  const fin = rows.filter(f => f.season >= FIRST && f.season <= LAST);
  const alpha = Object.assign({ P }, fitAlpha(fin)), joker = Object.assign({ opt: JOKER_OPT, feats: J_FEATS }, fitJoker(fin)), elo = { beta, hfa: PJ.params.hfa };
  const v = sha({ alpha, joker, elo });
  /* this season so far, by those constants (out of sample: never fitted on), as it stood at the fit */
  const now = rows.filter(f => f.season > LAST), ys = now.map(f => f.win), nm = now.filter(f => f.mk !== null), np = now.filter(f => mOf[f.id]);
  const season = now.length ? { season: now[0].season, through: S && S.published, alpha: score(now.map(f => alphaP(alpha, f)), ys), joker: score(now.map(f => jokerP(joker, f)), ys),
    elo: np.length ? score(np.map(f => eloP(beta, jokerP(joker, f), mOf[f.id].m)), np.map(f => f.win)) : null, market: nm.length ? score(nm.map(f => f.mk), nm.map(f => f.win)) : null,
    teamElo: score(now.map(f => f.pElo), ys), players: np.length ? score(np.map(f => mOf[f.id].p), np.map(f => f.win)) : null } : null;
  const out = { v, fitted: { on: new Date().toISOString().slice(0, 10), seasons: [FIRST, LAST], walk: WALK, games: fin.length, lines: fin.filter(f => f.mk !== null).length }, alpha: Object.assign({ feats: A_FEATS }, alpha), joker, elo, report: { walk, season } };
  fs.writeFileSync(OUTF, JSON.stringify(out));
  log(`wrote data/models.json (${v}): Alpha ${JSON.stringify(alpha.w)} k ${alpha.k}; the Joker's ${joker.trees.length} trees; the ELO Model's beta ${beta}`);
}

/* ---------- the backtest: this season's finals before the models existed ---------- */
function backtest() {
  const M = JSON.parse(fs.readFileSync(OUTF, 'utf8')), S = JSON.parse(fs.readFileSync(STATE_F, 'utf8'));
  const model = JSON.parse(fs.readFileSync(path.join(DATA, 'model.json'), 'utf8')), PJ = JSON.parse(fs.readFileSync(path.join(DATA, 'players.json'), 'utf8'));
  const { rows } = replay(M.alpha.P, model.params, finalsOf(DATA, S.season, S.games), readBox(DATA), readLines(DATA));
  const games = {};
  for (const f of rows.filter(f => f.season === S.season)) games[f.id] = callOf(M, f, f.pm ? { mu: f.pm.mu } : null, PJ.params.hfa);
  fs.writeFileSync(BACKF, JSON.stringify({ v: M.v, made: S.published, why: 'the finals of this season played before the models existed, each called on what was known before its puck drop: the ratings and averages to the day before, the line and the player model\'s view frozen with the call', games }));
  console.log(`wrote data/models_backtest.json: ${Object.keys(games).length} finals of ${S.season}, through ${S.published}`);
}

/* ---------- the job: the three calls on a game to come ---------- */
function callOf(M, f, pm, hfa) {
  const a = alphaP(M.alpha, f), j = jokerP(M.joker, f), out = { v: M.v, alpha: { pHome: r4(a), mu: +alphaMu(M.alpha, f).toFixed(2) }, joker: { pHome: r4(j) } };
  if (pm && isFinite(pm.mu)) { const m = +(pm.mu - (f.neutral ? 0 : hfa)).toFixed(2); out.elo = { pHome: r4(eloP(M.elo.beta, out.joker.pHome, m)), m }; }
  return out;
}
/* the running state after every final (this season's from `games`), for update.js: call(g, line, upcoming) gives a game to come its three
   calls, or null when data/models.json is not there */
function prepare(dataDir, season, games, eloParams, PM) {
  const f = path.join(dataDir, 'models.json'); if (!fs.existsSync(f)) return null;
  const M = JSON.parse(fs.readFileSync(f, 'utf8'));
  const { F } = replay(M.alpha.P, eloParams, finalsOf(dataDir, season, games), readBox(dataDir), {});
  F.newSeason(season);
  const hfa = PM && PM.params ? PM.params.hfa : M.elo.hfa;
  return {
    M,
    call(g, line, u) {
      const gh = u && u.home && u.home.goalie ? u.home.goalie.id : null, ga = u && u.away && u.away.goalie ? u.away.goalie.id : null;
      return callOf(M, Object.assign(F.pre(g, gh, ga, line), { neutral: !!g.neutral }), u, hfa);
    },
  };
}

module.exports = { prepare, callOf, marketOf, eloP, hold, alphaP, alphaMu, jokerP, Feats, replay, finalsOf, readBox, readLines, A_FEATS, J_FEATS, FIRST, sha };
if (require.main === module) {
  const arg = process.argv[2];
  if (arg === 'fit') fit().catch(e => { console.error(e); process.exit(1); });
  else if (arg === '--backtest') backtest();
  else { console.log('node tools/models.js fit | --backtest'); process.exit(2); }
}
