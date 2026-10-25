/* The pick'em models' own test (tools/models.js, tools/gbdt.js, data/models.json, data/models_backtest.json): the trees, the
   ELO Model's rule, the fit and the backtest made again from the committed data and compared with the committed files, and
   update.js's call on a game to come. Must end "0 failures". About half a minute. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');
const GB = require('./gbdt'), Mo = require('./models');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data');
let checks = 0; const fails = [];
const chk = (ok, msg) => { checks++; if (!ok) fails.push(msg); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;

console.log('THE TREES');
{
  /* a step the trees must find: y is 1 above 0.5 and 0 below, on one input of two */
  const X = [], y = []; for (let i = 0; i < 400; i++) { const a = (i % 100) / 100, b = ((i * 37) % 100) / 100; X.push([b, a]); y.push(a > 0.5 ? 1 : 0); }
  const M = GB.fit(X, y, { depth: 1, rounds: 20, lr: 0.3, minLeaf: 5 });
  chk(M.trees.length === 20 && M.trees.every(t => t.length === 3 && t[0][0] === 1 && near(t[0][1], 0.505, 1e-9)), `a step on the second input: every tree splits it at 0.505 (${JSON.stringify(M.trees[0])})`);
  chk(GB.predict(M, [0.3, 0.9]) > 0.9 && GB.predict(M, [0.3, 0.1]) < 0.1, 'and calls each side of it');
  chk(JSON.stringify(GB.fit(X, y, { depth: 1, rounds: 20, lr: 0.3, minLeaf: 5 })) === JSON.stringify(M), 'a fit is the same file twice');
  chk(GB.predict(M, [null, 0.9]) === GB.predict(M, [M.med[0], 0.9]), 'a missing input is the training median');
  /* boosted from a base: no round leaves the base's chance; the rows' own log-odds come back */
  const B = GB.fit(X, y, { depth: 2, rounds: 0, lr: 0.1, minLeaf: 5 }, X.map(() => 0.4));
  chk(B.f0 === 0 && near(GB.predict(B, [0.1, 0.1], 0.4), 1 / (1 + Math.exp(-0.4))), 'boosted from a base, no round: the base\'s own chance');
  /* a leaf never smaller than minLeaf rows */
  const L = GB.fit(X, y, { depth: 3, rounds: 3, lr: 0.1, minLeaf: 150 });
  const counts = t => { const c = new Map(); for (const x of X) { let i = 0; while (t[i].length > 1) i = x[t[i][0]] <= t[i][1] ? t[i][2] : t[i][3]; c.set(i, (c.get(i) || 0) + 1); } return [...c.values()]; };
  chk(L.trees.every(t => counts(t).every(n => n >= 150)), `every leaf holds 150 rows or more (${L.trees.map(t => counts(t).join('/')).join(' ')})`);
}

console.log("THE ELO MODEL'S RULE");
{
  chk(Mo.hold(0) === 0.01 && Mo.hold(1) === 0.99 && Mo.hold(0.37) === 0.37, 'the Joker held to 1-99%');
  chk(near(Mo.eloP(0.1, 0.62, 0), 0.62, 1e-12) && near(Mo.eloP(0.1, 0.999, 0), 0.99, 1e-12), 'no lineup gap: the Joker\'s chance (held)');
  chk(Mo.eloP(0.1, 0.5, 1) > 0.5 && Mo.eloP(0.1, 0.5, -1) < 0.5 && near(Mo.eloP(0.1, 0.5, 1) + Mo.eloP(0.1, 0.5, -1), 1, 1e-12), 'a gap moves it toward the stronger lineup, evenly');
  const mk = Mo.marketOf({ homeML: -150, awayML: 130, total: 6.5 });
  chk(near(mk.mk, (150 / 250) / (150 / 250 + 100 / 230), 1e-12) && mk.total === 6.5, 'the market: the moneyline with its margin out');
  chk(Mo.marketOf(null).mk === null && Mo.marketOf({ homeML: null, awayML: 120 }).mk === null, 'no line, no market');
}

console.log('THE FIT AND THE BACKTEST, MADE AGAIN');
const M = JSON.parse(fs.readFileSync(path.join(DATA, 'models.json'), 'utf8'));
{
  /* in a scratch copy of data/ (every file linked, nothing written to the real one), on the state the backtest was made on */
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nhl-models-'));
  for (const f of fs.readdirSync(DATA)) if (!/^models(_backtest)?\.json$/.test(f)) fs.symlinkSync(path.join(DATA, f), path.join(tmp, f));
  const env = Object.assign({}, process.env, { NHL_DATA: tmp, NHL_STATE: path.join(ROOT, 'state.json') });
  execFileSync(process.execPath, [path.join(__dirname, 'models.js'), 'fit'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
  const N = JSON.parse(fs.readFileSync(path.join(tmp, 'models.json'), 'utf8'));
  const strip = o => { const c = JSON.parse(JSON.stringify(o)); delete c.fitted.on; delete c.report.season; return c; };
  chk(JSON.stringify(strip(N)) === JSON.stringify(strip(M)), `the fit made again is data/models.json, constants, trees and walk-forward table (${N.v} against ${M.v})`);
  chk(N.v === M.v && M.v === Mo.sha({ alpha: (({ feats, ...a }) => a)(M.alpha), joker: M.joker, elo: M.elo }), `its sha is its constants' (${M.v})`);
  const W = M.report.walk;
  console.log('  walk-forward log loss, each season by constants fitted on the seasons before it:');
  for (const [s, w] of Object.entries(W)) console.log(`    ${s - 1}-${String(s).slice(2)}: Alpha ${w.alpha.logloss}, the Joker ${w.joker.logloss}, ELO Model ${w.elo ? w.elo.logloss : '-'}, the market ${w.market.logloss}, team Elo ${w.teamElo.logloss}, player model ${w.players ? w.players.logloss : '-'}`);
  /* the backtest: made again from the committed state on the finals it holds */
  const BK = path.join(DATA, 'models_backtest.json');
  if (fs.existsSync(BK)) {
    const B = JSON.parse(fs.readFileSync(BK, 'utf8'));
    fs.rmSync(path.join(tmp, 'models.json'), { force: true }); fs.symlinkSync(path.join(DATA, 'models.json'), path.join(tmp, 'models.json'));      // the committed constants, not the fit just made
    execFileSync(process.execPath, [path.join(__dirname, 'models.js'), '--backtest'], { env, stdio: ['ignore', 'ignore', 'inherit'] });
    const B2 = JSON.parse(fs.readFileSync(path.join(tmp, 'models_backtest.json'), 'utf8'));
    const ids = Object.keys(B.games), diff = ids.filter(id => JSON.stringify(B2.games[id]) !== JSON.stringify(B.games[id]));
    chk(B.v === M.v && ids.length > 0 && !diff.length, `the backtest made again on the committed state: ${ids.length} finals, the same calls (${diff.slice(0, 3).join(', ')})`);
  } else console.log('  no backtest file: its check skipped');
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log("THE JOB'S CALL");
{
  const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const PM = fs.existsSync(path.join(DATA, 'players.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'players.json'), 'utf8')) : null;
  const MD = Mo.prepare(DATA, S.season, S.games, S.model.params, PM);
  const g = S.games.find(x => x.state === 'pre' && x.line && PM && PM.upcoming && PM.upcoming[x.id]);
  if (g) {
    const c = MD.call(g, g.line, PM.upcoming[g.id]);
    chk(c.v === M.v && c.alpha.pHome > 0 && c.alpha.pHome < 1 && c.joker.pHome > 0 && c.joker.pHome < 1 && !!c.elo, `${g.away}@${g.home}: Alpha ${c.alpha.pHome}, the Joker ${c.joker.pHome}, ELO Model ${c.elo && c.elo.pHome}`);
    chk(c.elo && near(c.elo.pHome, +Mo.eloP(M.elo.beta, c.joker.pHome, c.elo.m).toFixed(4), 1e-9) && near(c.elo.m, +(PM.upcoming[g.id].mu - (g.neutral ? 0 : PM.params.hfa)).toFixed(2), 1e-9), 'the ELO Model is the Joker moved by the player model\'s gap, home ice out');
    chk(Math.abs(c.alpha.pHome - 1 / (1 + Math.exp(-M.alpha.k * c.alpha.mu))) < 0.002, 'Alpha\'s chance is the logistic of its margin');
    const noPM = MD.call(g, g.line, null);
    chk(!noPM.elo && noPM.joker.pHome > 0, 'no player model view: no ELO Model, the others called');
    const noLine = MD.call(g, null, PM.upcoming[g.id]);
    chk(noLine.joker.pHome > 0 && noLine.joker.pHome < 1, 'no line: the Joker boosts from the team Elo\'s chance');
  } else console.log('  no game to come with a line and a player model view: the call checks skipped');
}

console.log(`${checks} checks, ${fails.length} failures`);
for (const f of fails) console.log('  FAIL ' + f);
process.exit(fails.length ? 1 : 0);
