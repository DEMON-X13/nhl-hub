/* The same-game price's own test: tools/sgp.js's numbers (Phi, its quantile, Genz's BVND against a brute-force
   integral, the lattice's joint chance against BVND and a long Monte Carlo, the shrink to positive definite), its
   reading of legs (an Under, a +1.5, the other club's win, the refusals, symmetry), data/corr.json against the keys
   sgp.js can ask for, and the price rule (games multiplied, one game's legs joined, the hold, never above the
   product; 21 legs of one game priced, a 22nd refused). About ten seconds.

    node tools/test_sgp.js        must end "0 failures" */
'use strict';
const fs = require('fs'), path = require('path');
const S = require('./sgp');
const T = JSON.parse(fs.readFileSync(path.join(process.env.NHL_DATA || path.join(__dirname, '..', 'data'), 'corr.json'), 'utf8'));
let n = 0, fails = 0;
const ok = (c, m) => { n++; if (!c) { fails++; console.log('FAIL ' + m); } };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b} (tolerance ${tol})`);

/* the normal */
near(S.Phi(1), 0.8413447460685429, 1e-15, 'Phi(1)'); near(S.Phi(-2), 0.022750131948179195, 1e-16, 'Phi(-2)'); near(S.Phi(3), 0.9986501019683699, 1e-15, 'Phi(3)');
for (const p of [1e-6, 0.001, 0.02, 0.2, 0.5, 0.77, 0.999]) near(S.Phi(S.invNorm(p)), p, 1e-14, `invNorm(${p})`);
/* BVND: at 0 it is 1/4 + asin(r)/2pi; against a brute-force integral of phi(x) (1 - Phi((k - r x) / sqrt(1 - r^2))) */
for (const r of [-0.99, -0.9, -0.5, 0, 0.3, 0.8, 0.93, 0.99]) near(S.bvnu(0, 0, r), 0.25 + Math.asin(r) / (2 * Math.PI), 1e-14, `BVND(0, 0, ${r})`);
const brute = (h, k, r) => { let s = 0; const N = 40000, hi = 9, dx = (hi - h) / N; for (let i = 0; i < N; i++) { const x = h + (i + 0.5) * dx; s += S.phi(x) * (1 - S.Phi((k - r * x) / Math.sqrt(1 - r * r))) * dx; } return s; };
for (const h of [-2.1, -0.4, 1.3]) for (const k of [-1.7, 0.6, 2.2]) for (const r of [-0.95, -0.4, 0.15, 0.6, 0.94]) {
  near(S.bvnu(h, k, r), brute(h, k, r), 1e-8, `BVND(${h}, ${k}, ${r})`);
  near(S.bvnu(h, k, r), S.bvnu(k, h, r), 1e-14, `BVND symmetric (${h}, ${k}, ${r})`);
}
near(S.both(0.3, 0.6, 0), 0.18, 1e-14, 'both() independent');
/* the joint chance: one leg, two (BVND), independent legs (the product), a pair beside an independent leg, a long Monte Carlo */
near(S.joint([0.37], [[1]]), 0.37, 0, 'joint of one leg');
near(S.joint([0.3, 0.6], [[1, 0.4], [0.4, 1]]), S.both(0.3, 0.6, 0.4), 1e-15, 'joint of two legs is BVND');
near(S.joint([0.4, 0.6, 0.3, 0.55], [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]]), 0.4 * 0.6 * 0.3 * 0.55, 1e-12, 'independent legs multiply');
near(S.joint([0.4, 0.6, 0.3], [[1, 0.35, 0], [0.35, 1, 0], [0, 0, 1]]), S.both(0.4, 0.6, 0.35) * 0.3, 2e-4, 'a pair beside an independent leg');
function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function mc(ps, R, N) { const L = S.cholesky(R), h = ps.map(S.invNorm), rnd = mulberry(7); let hit = 0;
  for (let s = 0; s < N; s++) { const g = []; for (let i = 0; i < ps.length; i += 2) { const u1 = rnd() || 1e-12, u2 = rnd(), m = Math.sqrt(-2 * Math.log(u1)); g.push(m * Math.cos(2 * Math.PI * u2), m * Math.sin(2 * Math.PI * u2)); }
    let all = true; for (let i = 0; i < ps.length && all; i++) { let v = 0; for (let k = 0; k <= i; k++) v += L[i][k] * g[k]; if (v > h[i]) all = false; } if (all) hit++; }
  return hit / N; }
{ const R5 = [[1, 0.3, 0.1, 0.2, 0], [0.3, 1, 0.4, 0.1, 0.2], [0.1, 0.4, 1, 0.3, 0.1], [0.2, 0.1, 0.3, 1, 0.25], [0, 0.2, 0.1, 0.25, 1]], ps = [0.5, 0.45, 0.6, 0.35, 0.7];
  const j = S.joint(ps, R5), m = mc(ps, R5, 1000000), se = Math.sqrt(m * (1 - m) / 1000000);
  ok(Math.abs(j - m) < 4 * se, `five legs: the lattice ${j} against a million draws ${m} (se ${se})`);
  ok(S.joint(ps, R5) === j, 'the joint chance is the same number every time'); }
/* positive definite in use */
{ const R = [[1, 0.2], [0.2, 1]]; ok(S.psd(R).lam === 0 && S.psd(R).R === R, 'a positive definite matrix is left alone');
  const B = [[1, 0.95, 0.9], [0.95, 1, 0.2], [0.9, 0.2, 1]], P = S.psd(B);
  ok(P.lam > 0 && S.cholesky(P.R, S.PD_TOL) !== null, `a matrix that is not positive definite is shrunk until it is (lambda ${P.lam})`);
  ok(S.cholesky(B.map((row, i) => row.map((v, j) => i === j ? 1 : v * (1 - (P.lam - 0.001)))), S.PD_TOL) === null, 'by the least lambda (to 1e-3)'); }

/* the legs: every side and kind on the latent it is on */
const g = 'G1', sk = (pid, team, grp, stat, side = 'over') => ({ game: g, team, pid, grp, stat, side });
const A1 = sk('1', 'TOR', 'F', 'pts'), A1u = sk('1', 'TOR', 'F', 'pts', 'under'), A1g = sk('1', 'TOR', 'F', 'g'), A1s = sk('1', 'TOR', 'F', 's');
const B2 = sk('2', 'TOR', 'D', 'a'), C3 = sk('3', 'BUF', 'F', 's'), GB = sk('9', 'BUF', 'G', 'sv'), GT = sk('8', 'TOR', 'G', 'sv');
const mlT = { game: g, team: 'TOR', opp: 'BUF', kind: 'ml', fav: true }, mlB = { game: g, team: 'BUF', opp: 'TOR', kind: 'ml', fav: false };
const plT = { game: g, team: 'TOR', opp: 'BUF', kind: 'pl', line: -1.5, fav: true }, plB = { game: g, team: 'BUF', opp: 'TOR', kind: 'pl', line: 1.5, fav: false };
const ov = { game: g, kind: 'tot', side: 'over' }, un = { game: g, kind: 'tot', side: 'under' };
const r = (k) => T.rho[k];
near(S.rho(T, A1, B2), r('team|D:a|F:pts'), 0, 'teammates'); near(S.rho(T, A1, C3), r('opp|F:pts|F:s'), 0, 'opponents');
near(S.rho(T, A1, A1s), r('self|F:pts|F:s'), 0, 'one player\'s two stats');
near(S.rho(T, A1u, B2), -r('team|D:a|F:pts'), 0, 'an Under is its Over read from the other end');
near(S.rho(T, A1, mlT), r('team|F:pts|ml'), 0, 'a player and his club\'s win'); near(S.rho(T, A1, mlB), -r('team|F:pts|ml'), 0, 'a player and the other club\'s win');
near(S.rho(T, A1, plT), r('team|F:pts|pl'), 0, 'a player and his club laying -1.5'); near(S.rho(T, C3, plT), r('opp|F:s|pl'), 0, 'a player and the other club laying -1.5');
near(S.rho(T, C3, plB), -r('opp|F:s|pl'), 0, 'a +1.5 is the -1.5 failing'); near(S.rho(T, A1, ov), r('game|F:pts|tot'), 0, 'a player and the over'); near(S.rho(T, A1, un), -r('game|F:pts|tot'), 0, 'a player and the under');
near(S.rho(T, GB, C3), r('team|F:s|G:sv'), 0, 'a goalie and his own skater'); near(S.rho(T, GB, A1), r('opp|F:pts|G:sv'), 0, 'a goalie and the other side\'s skater');
near(S.rho(T, GB, GT), r('opp|G:sv|G:sv'), 0, 'the two goalies');
near(S.rho(T, mlT, ov), r('fav|ml|tot'), 0, 'the favourite\'s win and the over'); near(S.rho(T, mlB, ov), -r('fav|ml|tot'), 0, 'the underdog\'s win and the over');
near(S.rho(T, plT, ov), r('fav|pl|tot'), 0, 'the favourite\'s -1.5 and the over'); near(S.rho(T, plB, un), r('fav|pl|tot'), 0, 'the underdog\'s +1.5 and the under');
for (const [a, b, m] of [[mlT, plT, 'the moneyline and the puck line'], [mlT, mlB, 'both clubs\' wins'], [plT, plB, 'both puck lines'], [ov, un, 'the over and the under'], [A1, A1u, 'one player\'s stat twice'], [A1, { ...A1, side: 'over' }, 'one player\'s stat twice, one side']])
  ok(S.rho(T, a, b) === null, `refused: ${m}`);
ok(S.rho(T, A1, { ...C3, game: 'G2' }) === 0, 'legs of different games are independent');
const all = [A1, A1u, A1g, A1s, B2, C3, GB, GT, mlT, mlB, plT, plB, ov, un];
for (const a of all) for (const b of all) if (a !== b) ok(S.rho(T, a, b) === S.rho(T, b, a), `symmetric: ${JSON.stringify(a)} ${JSON.stringify(b)}`);

/* data/corr.json: every key sgp.js can ask for, a number at most 0.95 either way, keys in order */
const KINDS = ['F:g', 'F:a', 'F:pts', 'F:s', 'F:bs', 'D:g', 'D:a', 'D:pts', 'D:s', 'D:bs', 'G:sv'];
const need = ['fav|ml|tot', 'fav|pl|tot', 'dog|pl|tot'];
for (let i = 0; i < KINDS.length; i++) {
  const a = KINDS[i];
  need.push(S.keyOf('team', a, 'ml'), S.keyOf('team', a, 'pl'), S.keyOf('opp', a, 'pl'), S.keyOf('game', a, 'tot'));
  for (let j = i; j < KINDS.length; j++) { const b = KINDS[j]; need.push(S.keyOf('opp', a, b)); if (!(a === 'G:sv' && b === 'G:sv')) need.push(S.keyOf('team', a, b)); if (j > i && a[0] === b[0] && a[0] !== 'G') need.push(S.keyOf('self', a, b)); }
}
for (const k of need) ok(typeof T.rho[k] === 'number' && Math.abs(T.rho[k]) <= 0.95, `corr.json has ${k}`);
ok(Object.keys(T.rho).length === need.length, `corr.json has exactly the ${need.length} keys sgp.js reads (${Object.keys(T.rho).length})`);
for (const k of Object.keys(T.rho)) { const [, a, b] = k.split('|'); ok(a <= b, `${k}: its kinds in order`); }
ok(T.hold && T.hold.sgp === 0.896 && T.hold.tested === false, 'the hold is the NFL site\'s 0.896, marked untested');

/* the price */
const d = am => S.decOf(am), L = (leg, p, am) => Object.assign({}, leg, { p, dec: d(am) });
{ const x = S.parlay(T, [L(A1, 0.6, -170), L({ ...C3, game: 'G2' }, 0.45, 110)]);
  near(x.fair, 0.6 * 0.45, 1e-15, 'two games: the fair chances multiply'); near(x.dec, d(-170) * d(110), 1e-12, 'two games: the prices multiply'); ok(x.est === false, 'two games: DraftKings\' own price, not an estimate'); }
{ const legs = [L(A1, 0.6, -170), L(mlT, 0.55, -135)], x = S.parlay(T, legs), rr = S.rho(T, A1, mlT);
  near(x.fair, S.both(0.6, 0.55, rr), 1e-15, 'one game: the fair chance is the copula\'s');
  ok(x.fair > 0.6 * 0.55, 'one game, legs that move together: more likely than the product');
  const want = Math.min(d(-170) * d(-135), T.hold.sgp / S.both(1 / d(-170), 1 / d(-135), rr));
  near(x.dec, want, 1e-12, 'one game: the price is the hold over the joint implied chance, never above the product'); ok(x.est === true, 'one game: an estimate');
  ok(x.dec < d(-170) * d(-135), 'one game: shorter than the product'); }
{ const x = S.parlay(T, [L(A1, 0.6, -170), L(mlB, 0.45, 115)]);
  near(x.dec, d(-170) * d(115), 1e-12, 'legs that move against each other: capped at the product'); ok(x.fair < 0.6 * 0.45, 'legs that move against each other: less likely than the product'); }
{ const x = S.parlay(T, [L(mlT, 0.55, -135), L(plT, 0.3, 160)]); ok(x.refused && x.refused.legs.length === 2, 'the moneyline and the puck line of one game: refused'); }
{ const x = S.parlay(T, [L(A1, 0.6, -170), L(B2, 0.35, 150), L(C3, 0.5, -110), L({ ...A1, game: 'G2', pid: '5' }, 0.3, 200)]);
  ok(x.games.length === 2 && x.games[0].legs === 3 && x.est, 'three legs of one game and one of another');
  near(x.fair, S.joint([0.6, 0.35, 0.5], S.corrMatrix(T, [A1, B2, C3]).R) * 0.3, 1e-12, 'its fair chance: the game\'s joint times the other leg'); }
{ const x = S.parlay(T, [L(A1, null, -170), L(mlT, 0.55, -135)]); ok(x.fair === null && x.dec > 1, 'a leg with no fair chance: the parlay has none, the price stands'); }
/* the most legs of one game: the lattice has a root a leg after the first, so 21 legs are priced (and the lattice holds against a
   Monte Carlo there) and a 22nd is refused, never paid at the legs' prices multiplied (which once jumped the price 534 times over) */
{ ok(S.MAX_GAME_LEGS === 21, `the most legs of one game is 21 (${S.MAX_GAME_LEGS})`);
  const many = n => Array.from({ length: n }, (_, i) => L(sk(String(100 + i), i % 2 ? 'BUF' : 'TOR', i % 3 ? 'F' : 'D', i % 4 < 2 ? 'pts' : 's', i % 5 ? 'over' : 'under'), 0.84 + (i % 5) * 0.025, -400 - (i % 4) * 50));
  const at = many(21), x = S.parlay(T, at), prod = at.reduce((a, l) => a * l.dec, 1);
  ok(!x.refused && x.est && x.dec > 1 && x.dec <= prod && typeof x.fair === 'number' && x.fair > 0, `21 legs of one game: priced, an estimate, never above the product, with a fair chance (${x.dec && x.dec.toFixed(2)} vs ${prod.toFixed(2)}, fair ${x.fair})`);
  const M = S.corrMatrix(T, at), P = S.psd(M.R), ps = at.map(l => l.p), jl = S.joint(ps, P.R), mm = mc(ps, P.R, 300000), se = Math.sqrt(mm * (1 - mm) / 300000);
  ok(Math.abs(jl - mm) < 4 * se + 1e-5, `21 legs: the lattice ${jl} against 300,000 draws ${mm} (se ${se})`);
  const past = many(22), y = S.parlay(T, past);
  ok(!!y.refused && y.refused.max === 21 && y.refused.legs.length === 22 && y.dec === undefined, `22 legs of one game: refused, no price (${JSON.stringify(y.refused && { max: y.refused.max, legs: y.refused.legs.length })})`);
  ok(S.joint(past.map(l => l.p), S.psd(S.corrMatrix(T, past).R).R) === null, 'the joint chance of 22 legs is not worked out (null), and parlay() reads that as a refusal');
  const mixed = S.parlay(T, many(21).concat(many(5).map(l => Object.assign({}, l, { game: 'G2' }))));
  ok(!mixed.refused && mixed.games.length === 2, 'the most is a game\'s: 21 legs of one game beside 5 of another are priced'); }

console.log(`test_sgp: ${n} checks, ${fails} failures`);
process.exit(fails ? 1 : 0);
