/* THE SAME-GAME PRICE: how legs of one game move together, and what DraftKings would pay for them on one
   ticket. The owner's call, 15 October 2026 ("go for it": player props in the Parlay Builder, more than one leg a
   game). This file is the rule; data/corr.json is the table it reads (written by tools/corr.js from the hub's own
   box scores, never by hand); the page copies the functions below word for word, as it copies tools/espn.js's.

   A leg is a binary event with a chance p of landing. Legs in different games are independent: their joint chance
   is the product, and DraftKings pays the product of their decimal prices. Legs in one game are not: a skater's
   points ride with his club's win and with the game's total, his shots with the other goalie's saves. Each leg is
   read as a latent standard normal crossing a threshold (it lands when the latent is above Phi^-1(1 - p)), and the
   latents of one game are joined by a gaussian copula whose correlations are the table's: the tetrachoric
   correlation of the two outcomes at the lines DraftKings posts, with each player's and each game's expectation
   taken out (tools/corr.js says how it was measured and how well it held on games it never saw).

   The latents: a player's stat (`F:pts`, `D:bs`, `G:sv`...: F a forward, D a defenceman, G the goalie; stats g
   goals, a assists, pts points, s shots on goal, bs blocked shots, sv saves), a club's win (`ml`, overtime and the
   shootout included), the cover of the side DraftKings lays -1.5 (`pl`) and the game's total going over (`tot`).
   The Over and the Under of one line are the same latent read from either end (the Under is `dir` -1), a club's +1.5
   is the -1.5 side failing to cover, and a club's win is the other club's loss, so one table serves every side.

   The table's keys are `rel|k1|k2` with k1 <= k2 by string order: rel `self` (one player's two stats), `team`
   (teammates; a player and his own club's win or -1.5 cover), `opp` (opponents; a player and the other club's -1.5
   cover), `game` (a player and the total), `fav`/`dog` (the favourite's win or the -1.5 side, favourite or not, with
   the total). Pairs this rule refuses (null from rho()): two legs on one latent (one player's stat twice, the total
   twice) and two side bets of one game (the moneyline and the puck line, or either on both clubs): one side bet a
   game. What DraftKings itself refuses on one ticket is the builder's to say; this file only prices what it is given.

   The price (the NFL site's rule, props/build/part3.js parlayDec and SGP_HOLD, carried over): a game's legs priced
   together from their IMPLIED chances (DraftKings' own prices, margin left in) joined by the copula, then cut by the
   same-game hold, and never paid above the plain product of the legs' prices:
       dec(game) = min( product of the legs' decimal prices,  hold / joint chance of their implied chances )
   The hold is 0.896, NFL's: fitted there to two real DraftKings same-game tickets (Detroit at Buffalo, 17 September
   2026). No DraftKings same-game price for hockey has ever been recorded here (ESPN's feed carries none), so on this
   site it is UNTESTED, an estimate, and every same-game price drawn from it is marked est. The fair chance of a
   parlay is the same copula on the legs' fair chances (DraftKings' prices with the margin taken out).

   Numbers: Phi is West's (2005) double-precision form of Hart's; invNorm Acklam's with one Halley step; a pair's
   joint chance is Genz's BVND (exact to about 1e-15); three legs or more are Genz's separation of variables on a
   fixed Richtmyer lattice (LATTICE points, each with its antithetic), so every machine gets the same number, to
   about 1e-4. A correlation matrix that is not positive definite (the table's pairs are measured one at a time) is
   shrunk toward independence by the least lambda that makes it so (psd()), and the lambda is reported. */
'use strict';

const TWOPI = 2 * Math.PI;
/* the standard normal's CDF to double precision (West 2005, Hart 1968's algorithm 5666) */
function Phi(x) {
  const z = Math.abs(x); let c;
  if (z > 37) c = 0;
  else {
    const e = Math.exp(-z * z / 2);
    if (z < 7.07106781186547) {
      let b = 3.52624965998911e-02 * z + 0.700383064443688; b = b * z + 6.37396220353165; b = b * z + 33.912866078383; b = b * z + 112.079291497871; b = b * z + 221.213596169931; b = b * z + 220.206867912376;
      c = e * b;
      b = 8.83883476483184e-02 * z + 1.75566716318264; b = b * z + 16.064177579207; b = b * z + 86.7807322029461; b = b * z + 296.564248779674; b = b * z + 637.333633378831; b = b * z + 793.826512519948; b = b * z + 440.413735824752;
      c = c / b;
    } else { let b = z + 0.65; b = z + 4 / b; b = z + 3 / b; b = z + 2 / b; b = z + 1 / b; c = e / b / 2.506628274631; }
  }
  return x > 0 ? 1 - c : c;
}
const phi = x => Math.exp(-x * x / 2) / Math.sqrt(TWOPI);
/* the standard normal's quantile: Acklam's rational form, then one Halley step on Phi */
function invNorm(p) {
  if (!(p > 0)) return -Infinity; if (!(p < 1)) return Infinity;
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00];
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01];
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00];
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00];
  const pl = 0.02425; let x, q, r;
  if (p < pl) { q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p > 1 - pl) { q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else { q = p - 0.5; r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  const e = Phi(x) - p, u = e * Math.sqrt(TWOPI) * Math.exp(x * x / 2);
  return x - u / (1 + x * u / 2);
}

/* P(X > dh, Y > dk) for standard normals with correlation r: Genz's BVND (2004), Gauss-Legendre on Drezner and
   Wesolowsky's integral, with the asymptotic form for |r| >= 0.925 */
const GL = [
  { w: [0.1713244923791705, 0.3607615730481384, 0.4679139345726904], x: [-0.9324695142031522, -0.6612093864662647, -0.2386191860831970] },
  { w: [0.04717533638651177, 0.1069393259953183, 0.1600783285433464, 0.2031674267230659, 0.2334925365383547, 0.2491470458134029],
    x: [-0.9815606342467191, -0.9041172563704750, -0.7699026741943050, -0.5873179542866171, -0.3678314989981802, -0.1252334085114692] },
  { w: [0.01761400713915212, 0.04060142980038694, 0.06267204833410906, 0.08327674157670475, 0.1019301198172404, 0.1181945319615184, 0.1316886384491766, 0.1420961093183821, 0.1491729864726037, 0.1527533871307259],
    x: [-0.9931285991850949, -0.9639719272779138, -0.9122344282513259, -0.8391169718222188, -0.7463319064601508, -0.6360536807265150, -0.5108670019508271, -0.3737060887154196, -0.2277858511416451, -0.07652652113349733] },
];
function bvnu(dh, dk, r) {
  if (dh === -Infinity) return dk === -Infinity ? 1 : 1 - Phi(dk);
  if (dk === -Infinity) return 1 - Phi(dh);
  if (dh === Infinity || dk === Infinity) return 0;
  const ar = Math.abs(r), G = ar < 0.3 ? GL[0] : ar < 0.75 ? GL[1] : GL[2], lg = G.x.length;
  let h = dh, k = dk, hk = h * k, bvn = 0;
  if (ar < 0.925) {
    const hs = (h * h + k * k) / 2, asr = Math.asin(r);
    for (let i = 0; i < lg; i++) {
      let sn = Math.sin(asr * (G.x[i] + 1) / 2); bvn += G.w[i] * Math.exp((sn * hk - hs) / (1 - sn * sn));
      sn = Math.sin(asr * (-G.x[i] + 1) / 2); bvn += G.w[i] * Math.exp((sn * hk - hs) / (1 - sn * sn));
    }
    return bvn * asr / (2 * TWOPI) + Phi(-h) * Phi(-k);
  }
  if (r < 0) { k = -k; hk = -hk; }
  if (ar < 1) {
    const as = (1 - r) * (1 + r); let a = Math.sqrt(as);
    const bs = (h - k) * (h - k), c = (4 - hk) / 8, d = (12 - hk) / 16;
    bvn = a * Math.exp(-(bs / as + hk) / 2) * (1 - c * (bs - as) * (1 - d * bs / 5) / 3 + c * d * as * as / 5);
    if (hk > -160) { const b = Math.sqrt(bs); bvn -= Math.exp(-hk / 2) * Math.sqrt(TWOPI) * Phi(-b / a) * b * (1 - c * bs * (1 - d * bs / 5) / 3); }
    a = a / 2;
    for (let i = 0; i < lg; i++) {
      let xs = (a * (G.x[i] + 1)) ** 2, rs = Math.sqrt(1 - xs);
      bvn += a * G.w[i] * (Math.exp(-bs / (2 * xs) - hk / (1 + rs)) / rs - Math.exp(-(bs / xs + hk) / 2) * (1 + c * xs * (1 + d * xs)));
      xs = as * (-G.x[i] + 1) ** 2 / 4; rs = Math.sqrt(1 - xs);
      bvn += a * G.w[i] * Math.exp(-(bs / xs + hk) / 2) * (Math.exp(-hk * (1 - rs) / (2 * (1 + rs))) / rs - (1 + c * xs * (1 + d * xs)));
    }
    bvn = -bvn / TWOPI;
  }
  if (r > 0) return bvn + Phi(-Math.max(h, k));
  return -bvn + Math.max(0, Phi(-h) - Phi(-k));
}
/* the chance both land, for chances p1, p2 joined with correlation r: P(Z1 <= Phi^-1(p1), Z2 <= Phi^-1(p2)) */
const both = (p1, p2, r) => bvnu(-invNorm(p1), -invNorm(p2), r);

/* the Cholesky factor of R, or null when a pivot is not above `tol` */
function cholesky(R, tol = 1e-10) {
  const n = R.length, L = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = R[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
    if (i === j) { if (!(s > tol)) return null; L[i][i] = Math.sqrt(s); } else L[i][j] = s / L[j][j];
  }
  return L;
}
/* positive definite in use: R itself where it is, else its off-diagonals shrunk toward independence by the least
   lambda (to 1e-4, bisection) that leaves every Cholesky pivot above 1e-6 */
const PD_TOL = 1e-6;
function psd(R) {
  const at = lam => R.map((row, i) => row.map((v, j) => i === j ? 1 : v * (1 - lam)));
  if (cholesky(R, PD_TOL)) return { R, lam: 0 };
  let lo = 0, hi = 1;
  for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (cholesky(at(m), PD_TOL)) hi = m; else lo = m; }
  return { R: at(hi), lam: Math.round(hi * 1e4) / 1e4 };
}

/* P(every leg lands) for chances ps joined by correlation matrix R (positive definite): one leg its chance, two
   Genz's BVND, three or more Genz's separation of variables on a fixed Richtmyer lattice (the legs taken likeliest
   to miss first, LATTICE points and their antithetics) */
const LATTICE = 4096;
const RICHTMYER = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71].map(Math.sqrt);
function joint(ps, R) {
  const n = ps.length;
  if (!n) return 1;
  if (ps.some(p => !(p > 0))) return 0;
  if (n === 1) return ps[0];
  if (n === 2) return both(ps[0], ps[1], R[0][1]);
  const order = ps.map((p, i) => i).sort((i, j) => ps[i] - ps[j] || i - j);
  const h = order.map(i => invNorm(ps[i])), Rp = order.map(i => order.map(j => R[i][j]));
  const L = cholesky(Rp, 0); if (!L) return null;
  if (n - 1 > RICHTMYER.length) return null;
  const y = new Array(n), e0 = Phi(h[0] / L[0][0]);
  let sum = 0;
  for (let k = 1; k <= LATTICE; k++) for (let anti = 0; anti < 2; anti++) {
    let f = e0, e = e0;
    for (let i = 1; i < n; i++) {
      let w = (k * RICHTMYER[i - 1]) % 1; if (anti) w = 1 - w;
      y[i - 1] = invNorm(Math.min(1 - 1e-16, Math.max(1e-300, w * e)));
      let s = 0; for (let j = 0; j < i; j++) s += L[i][j] * y[j];
      e = Phi((h[i] - s) / L[i][i]); f *= e;
      if (!(f > 0)) break;
    }
    sum += f;
  }
  return sum / (2 * LATTICE);
}

/* ---------- the legs ---------- */
/* A leg, as the builder hands it over:
     player:  { game, team, pid, grp: 'F'|'D'|'G', stat: 'g'|'a'|'pts'|'s'|'bs'|'sv', side: 'over'|'under' (a Yes is 'over') }
     club:    { game, team, opp, kind: 'ml' }                                  the club's win
              { game, team, opp, kind: 'pl', line: -1.5 | 1.5 }                 its puck line
              { game, kind: 'tot', side: 'over'|'under' }                     the total
   with `fav` on a moneyline or puck-line leg (true when its club is DraftKings' moneyline favourite), and, for the
   price, `p` (its fair chance; null when there is none) and `dec` (DraftKings' decimal price). latent() reads it as
   the latent it is on and the end of it the leg lands at. */
function latent(l) {
  if (l.kind === 'ml') return { game: l.game, lat: 'ml', team: l.team, fav: !!l.fav, dir: 1 };
  if (l.kind === 'pl') { const minus = l.line < 0; return { game: l.game, lat: 'pl', team: minus ? l.team : l.opp, fav: minus ? !!l.fav : !l.fav, dir: minus ? 1 : -1 }; }
  if (l.kind === 'tot') return { game: l.game, lat: 'tot', dir: l.side === 'under' ? -1 : 1 };
  return { game: l.game, lat: 'p', team: l.team, pid: String(l.pid), k: l.grp + ':' + l.stat, dir: l.side === 'under' ? -1 : 1 };
}
const keyOf = (rel, a, b) => a <= b ? `${rel}|${a}|${b}` : `${rel}|${b}|${a}`;
const val = (T, key) => { const v = T.rho[key]; return typeof v === 'number' ? v : 0; };
/* the correlation of two latents of one game from the table T (data/corr.json), or null when the rule refuses the pair */
function rhoLat(T, a, b) {
  if (a.game !== b.game) return 0;
  const P = x => x.lat === 'p';
  if (P(a) && P(b)) {
    if (a.pid === b.pid) return a.k === b.k ? null : keyOf('self', a.k, b.k) in T.rho ? val(T, keyOf('self', a.k, b.k)) : null;
    return val(T, keyOf(a.team === b.team ? 'team' : 'opp', a.k, b.k));
  }
  if (P(a) || P(b)) {
    const p = P(a) ? a : b, o = P(a) ? b : a;
    if (o.lat === 'ml') return val(T, keyOf('team', p.k, 'ml')) * (p.team === o.team ? 1 : -1);
    if (o.lat === 'pl') return val(T, keyOf(p.team === o.team ? 'team' : 'opp', p.k, 'pl'));
    return val(T, keyOf('game', p.k, 'tot'));
  }
  const lats = [a.lat, b.lat].sort().join('|');
  if (lats === 'ml|tot') { const m = a.lat === 'ml' ? a : b; return val(T, 'fav|ml|tot') * (m.fav ? 1 : -1); }
  if (lats === 'pl|tot') { const m = a.lat === 'pl' ? a : b; return val(T, (m.fav ? 'fav' : 'dog') + '|pl|tot'); }
  return null;                                  // two side bets of one game, or one latent twice: one side bet a game, one total
}
/* the two legs' correlation as the copula reads it, each latent read from the end its leg lands at */
function rho(T, a, b) {
  const la = latent(a), lb = latent(b), r = rhoLat(T, la, lb);
  return r === null ? null : r * la.dir * lb.dir;
}
/* the legs' correlation matrix, or null (with the first pair refused) when the rule refuses a pair */
function corrMatrix(T, legs) {
  const n = legs.length, R = Array.from({ length: n }, (_, i) => new Array(n).fill(0).map((_, j) => i === j ? 1 : 0));
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const r = rho(T, legs[i], legs[j]);
    if (r === null) return { R: null, refused: [i, j] };
    R[i][j] = R[j][i] = r;
  }
  return { R, refused: null };
}

/* ---------- the parlay ---------- */
const implied = am => am > 0 ? 100 / (am + 100) : -am / (-am + 100);
const decOf = am => am > 0 ? 1 + am / 100 : 1 + 100 / -am;
/* a parlay's fair chance and DraftKings' price: legs of different games multiplied, legs of one game joined by the
   copula (their fair chances for the fair chance, their implied chances for the price, cut by the hold and never
   above the product). `est` is true when any game carries two legs or more: the price is then this file's estimate,
   not DraftKings' own. Returns null with `refused` when the rule refuses a pair. */
function parlay(T, legs, hold = T.hold.sgp) {
  const byGame = new Map();
  for (const l of legs) { if (!byGame.has(l.game)) byGame.set(l.game, []); byGame.get(l.game).push(l); }
  let fair = 1, dec = 1, est = false, lam = 0;
  const games = [];
  for (const [game, ls] of byGame) {
    const mult = ls.reduce((a, l) => a * l.dec, 1);
    const fp = ls.map(l => l.p), ip = ls.map(l => 1 / l.dec);
    if (ls.length === 1) { fair = fair === null || fp[0] === null || fp[0] === undefined ? null : fair * fp[0]; dec *= mult; games.push({ game, legs: 1, dec: mult, fair: fp[0] === undefined ? null : fp[0] }); continue; }
    const M = corrMatrix(T, ls);
    if (!M.R) return { refused: { game, legs: M.refused.map(i => ls[i]) } };
    const P = psd(M.R); lam = Math.max(lam, P.lam);
    const fj = fp.some(p => p === null || p === undefined) ? null : joint(fp, P.R), ij = joint(ip, P.R);
    const d = ij > 0 ? Math.min(mult, hold / ij) : mult;
    fair = fair === null || fj === null ? null : fair * fj; dec *= d; est = true;
    games.push({ game, legs: ls.length, dec: d, product: mult, fair: fj, implied: ij, lam: P.lam });
  }
  return { fair, dec, est, lam, games };
}

module.exports = { Phi, phi, invNorm, bvnu, both, cholesky, psd, joint, LATTICE, latent, keyOf, rhoLat, rho, corrMatrix, parlay, implied, decOf, PD_TOL };
