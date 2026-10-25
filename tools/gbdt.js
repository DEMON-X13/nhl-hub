/* Gradient-boosted trees on the logistic loss: the NFL hub's Joker is scikit-learn's GradientBoostingClassifier, and this is
   its algorithm in Node, so the NHL job stays Node-only and the smoke can score a call again. Each round fits a regression
   tree to the residuals (y less the chance so far) by least squares, exact splits on sorted values (a split between two
   distinct values, at their midpoint, each side keeping at least `minLeaf` rows), grown to `depth`; each leaf is one Newton
   step (the residuals' sum over the sum of p(1 - p)) times the learning rate. A missing value is filled with the training
   median before it reaches a tree. `base` boosts from a given log-odds a row (the Joker's: the market's chance) in place of
   the training mean's. A model is plain JSON: { f0, med, trees }, a tree a list of nodes, [value] a leaf and
   [feature, threshold, left, right] a split, every number rounded to 8 places so a fit is the same file on every machine. */
'use strict';
const sig = x => 1 / (1 + Math.exp(-x));
const R8 = v => +v.toFixed(8);
const missing = v => v === null || v === undefined || !isFinite(v);
function median(a) { const b = a.filter(v => !missing(v)).sort((x, y) => x - y); return b.length ? (b.length % 2 ? b[(b.length - 1) / 2] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2) : 0; }
const leafOf = (tree, x) => { let i = 0; for (;;) { const nd = tree[i]; if (nd.length === 1) return nd[0]; i = x[nd[0]] <= nd[1] ? nd[2] : nd[3]; } };

function fit(Xraw, y, opt = {}, base = null) {
  const O = Object.assign({ depth: 3, rounds: 25, lr: 0.1, minLeaf: 5 }, opt);
  const n = Xraw.length, k = Xraw[0].length;
  const med = Array.from({ length: k }, (_, j) => R8(median(Xraw.map(r => r[j]))));
  const X = Xraw.map(r => r.map((v, j) => missing(v) ? med[j] : v));
  const mean = y.reduce((a, b) => a + b, 0) / n, f0 = base ? 0 : R8(Math.log(mean / (1 - mean)));
  const F = base ? base.slice() : new Array(n).fill(f0), trees = [];
  const order = Array.from({ length: k }, (_, j) => Array.from({ length: n }, (_, i) => i).sort((a, b) => X[a][j] - X[b][j] || a - b));
  const inSet = new Uint8Array(n);
  for (let t = 0; t < O.rounds; t++) {
    const g = new Float64Array(n), h = new Float64Array(n);
    for (let i = 0; i < n; i++) { const p = sig(F[i]); g[i] = y[i] - p; h[i] = p * (1 - p); }
    const nodes = [];
    const grow = (rows, depth) => {
      const id = nodes.length; nodes.push(null);
      let G = 0, H = 0; for (const i of rows) { G += g[i]; H += h[i]; }
      const leaf = () => { nodes[id] = [R8(O.lr * (H > 1e-12 ? G / H : 0))]; return id; };
      if (depth >= O.depth || rows.length < 2 * O.minLeaf) return leaf();
      for (const i of rows) inSet[i] = 1;
      let best = null; const N = rows.length;
      for (let j = 0; j < k; j++) {
        let gl = 0, nl = 0, prev = null;
        for (const i of order[j]) {
          if (!inSet[i]) continue;
          const x = X[i][j];
          if (prev !== null && x > prev && nl >= O.minLeaf && N - nl >= O.minLeaf) {
            const gr = G - gl, gain = gl * gl / nl + gr * gr / (N - nl) - G * G / N;
            if (!best || gain > best.gain + 1e-12) best = { gain, j, thr: R8((prev + x) / 2) };
          }
          gl += g[i]; nl++; prev = x;
        }
      }
      for (const i of rows) inSet[i] = 0;
      if (!best || best.gain <= 1e-12) return leaf();
      const L = [], Rr = []; for (const i of rows) (X[i][best.j] <= best.thr ? L : Rr).push(i);
      if (!L.length || !Rr.length) return leaf();
      const l = grow(L, depth + 1), r = grow(Rr, depth + 1);
      nodes[id] = [best.j, best.thr, l, r]; return id;
    };
    grow(Array.from({ length: n }, (_, i) => i), 0);
    trees.push(nodes);
    for (let i = 0; i < n; i++) F[i] += leafOf(nodes, X[i]);
  }
  return { f0, med, trees };
}
/* the chance for one row of inputs, boosted from `base` (log-odds; 0 where the model was fitted on the mean) */
function predict(M, xraw, base = 0) {
  const x = xraw.map((v, j) => missing(v) ? M.med[j] : v);
  let f = M.f0 + base; for (const t of M.trees) f += leafOf(t, x);
  return sig(f);
}
module.exports = { fit, predict, leafOf, sig };
