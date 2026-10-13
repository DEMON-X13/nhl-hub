/* Choose the model's parameters on the history and write data/model.json.

    node tools/fit.js

   A coordinate search over K, the preseason carry, home ice, the back-to-back penalty, the
   rest bonus, the weight of a result past regulation and the margin multiplier, replaying every
   game since 2011-12 in date order and scoring the home win chance by log loss from 2013-14 on
   (the first two seasons are the warm-up). The margin's goals-per-Elo and standard deviation
   are then least-squares fits under the chosen parameters, on the same seasons less the last,
   and the last season is reported as a holdout so the numbers in model.json mean something
   outside the fit. The goals layer's total is the league's average over the fit seasons;
   its calibration on the holdout (how often the home side beats the model's margin, how
   often a game lands over its expected total) is reported beside it. */
'use strict';
const fs = require('fs'), path = require('path');
const { Elo, DEFAULTS, fitSpread, spreadOf, goals, homeByGoals } = require('./elo');
const Hist = require('./hist');
const DATA = path.join(__dirname, '..', 'data');

/* every finished season: history.json and the season_<year>.json files the job closed */
const games = Hist.rows(DATA);
const seasons = [...new Set(games.map(g => g.season))].sort();
const WARM = seasons.slice(0, 2), HOLD = seasons[seasons.length - 1];
console.log(`${games.length} games, seasons ${seasons[0]}-${HOLD}; warm-up ${WARM.join(',')}; holdout ${HOLD}`);

function replay(params) {
  const m = new Elo(params); const out = [];
  for (const g of games) {
    m.newSeason(g.season);
    const pre = m.play(g);
    out.push({ season: g.season, diff: pre.diff, margin: pre.margin, pHome: pre.pHome, win: g.hs > g.as ? 1 : 0, total: g.hs + g.as, periods: g.periods });
  }
  return out;
}
const scoreOf = (rows, pick) => {
  const r = rows.filter(pick); let ll = 0, acc = 0;
  for (const x of r) { const p = Math.min(0.999, Math.max(0.001, x.pHome)); ll -= x.win * Math.log(p) + (1 - x.win) * Math.log(1 - p); acc += (x.pHome >= 0.5) === (x.win === 1) ? 1 : 0; }
  return { ll: ll / r.length, acc: acc / r.length, n: r.length };
};
const inFit = x => !WARM.includes(x.season) && x.season !== HOLD;

const GRID = {
  K: [4, 6, 8, 10, 12, 16, 20],
  carry: [0.5, 0.6, 0.7, 0.8, 0.9],
  hfa: [20, 30, 40, 50, 60, 80],
  b2b: [0, 10, 20, 30, 40, 60],
  rest: [0, 5, 10, 15, 20, 30],
  ot: [0.2, 0.4, 0.6, 0.8, 1.0],
  mov: [true, false],
};
let P = Object.assign({}, DEFAULTS);
let best = scoreOf(replay(P), inFit).ll, moved = true, pass = 0;
while (moved && pass < 8) {
  moved = false; pass++;
  for (const k of Object.keys(GRID)) for (const v of GRID[k]) {
    if (v === P[k]) continue;
    const q = Object.assign({}, P, { [k]: v }); const l = scoreOf(replay(q), inFit).ll;
    if (l < best - 1e-7) { best = l; P = q; moved = true; }
  }
  console.log(`pass ${pass}: log loss ${best.toFixed(5)} ${JSON.stringify(P)}`);
}
const rows = replay(P);
const s = scoreOf(rows, inFit), hold = scoreOf(rows, x => x.season === HOLD);
console.log(`best ${JSON.stringify(P)}: log loss ${s.ll.toFixed(4)}, accuracy ${(s.acc * 100).toFixed(1)}% on ${s.n} games`);
console.log(`holdout ${HOLD}: log loss ${hold.ll.toFixed(4)}, accuracy ${(hold.acc * 100).toFixed(1)}% on ${hold.n} games`);

const fitRows = rows.filter(inFit), holdRows = rows.filter(x => x.season === HOLD);
const sp = fitSpread(fitRows.map(x => [x.diff, x.margin]));
const mae = rs => rs.reduce((a, x) => a + Math.abs(x.margin - spreadOf(x.diff, sp)), 0) / rs.length;
console.log(`margin: ${sp.gpe.toFixed(1)} Elo per goal, intercept ${sp.b.toFixed(3)}, sd ${sp.sd.toFixed(2)}; MAE ${mae(fitRows).toFixed(2)} fit, ${mae(holdRows).toFixed(2)} holdout`);
const leagueTotal = fitRows.reduce((a, x) => a + x.total, 0) / fitRows.length;
const otRate = fitRows.filter(x => x.periods > 3).length / fitRows.length;
/* the pull: the share of one-goal games tied instead, chosen so the layer's overtime rate on the fit seasons is the real one */
const tieRate = pull => fitRows.reduce((a, x) => a + goals(leagueTotal, spreadOf(x.diff, sp), x.diff, pull).tie, 0) / fitRows.length;
let pull = 0;
for (let q = 0; q <= 0.6; q += 0.01) { pull = q; if (tieRate(q) >= otRate) break; }
console.log(`overtime: ${(otRate * 100).toFixed(1)}% of fit games; the layer reaches it with ${(pull * 100).toFixed(0)}% of one-goal games pulled into a tie`);
/* the goals layer on the holdout, at the league total: its own home chance against the Elo's, the tie rate against the real one */
let llG = 0, tieG = 0, over = 0, beat = 0;
for (const x of holdRows) {
  const G = goals(leagueTotal, spreadOf(x.diff, sp), x.diff, pull);
  const p = Math.min(0.999, Math.max(0.001, homeByGoals(G)));
  llG -= x.win * Math.log(p) + (1 - x.win) * Math.log(1 - p); tieG += G.tie;
  if (x.total > leagueTotal) over++;
  if (x.margin > spreadOf(x.diff, sp)) beat++;
}
console.log(`goals layer on the holdout: log loss ${(llG / holdRows.length).toFixed(4)} (Elo ${hold.ll.toFixed(4)}), overtime expected ${(tieG / holdRows.length * 100).toFixed(1)}% vs ${(holdRows.filter(x => x.periods > 3).length / holdRows.length * 100).toFixed(1)}% seen; home beats the model margin ${(beat / holdRows.length * 100).toFixed(1)}%, over the league total ${(over / holdRows.length * 100).toFixed(1)}%`);

fs.writeFileSync(path.join(DATA, 'model.json'), JSON.stringify({
  params: P, gpe: sp.gpe, b: sp.b, sd: sp.sd, leagueTotal: +leagueTotal.toFixed(3), otRate: +otRate.toFixed(4), pull: +pull.toFixed(2),
  fitted: { seasons: seasons.filter(q => !WARM.includes(q) && q !== HOLD), warmup: WARM, holdout: HOLD, on: new Date().toISOString().slice(0, 10),
    logloss: +s.ll.toFixed(4), accuracy: +s.acc.toFixed(4), games: s.n,
    holdoutLogloss: +hold.ll.toFixed(4), holdoutAccuracy: +hold.acc.toFixed(4), holdoutGames: hold.n,
    marginMae: +mae(fitRows).toFixed(3), holdoutMarginMae: +mae(holdRows).toFixed(3), holdoutHomeBeatsMargin: +(beat / holdRows.length).toFixed(3),
    goalsLogloss: +(llG / holdRows.length).toFixed(4), holdoutOtRate: +(holdRows.filter(x => x.periods > 3).length / holdRows.length).toFixed(4), goalsOtRate: +(tieG / holdRows.length).toFixed(4) },
}, null, 1));
console.log('wrote data/model.json');
