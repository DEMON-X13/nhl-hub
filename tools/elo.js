/* The rating model: an Elo over the 32 clubs with home ice, a back-to-back penalty, a rest
   bonus, a goal-margin multiplier, a weight for a game decided past regulation, and a
   preseason regression toward 1500. Its win chance (the moneyline's, overtime and the
   shootout included) is the logistic of the rating gap; its expected goal margin is the gap
   divided by a fitted goals-per-Elo. A goals layer sits on top for the puck line and the
   total: each side's goals are Poisson, the two means placed so they add to the game's
   expected total (each club's scoring and conceding rates this season, shrunk to the league's)
   and differ by the expected margin; a game tied after sixty minutes goes to the side the
   ratings favour with the chance an overtime deserves, one goal to the winner, and a fitted share of the
   one-goal games is tied instead, since a trailing side pulls its goalie. fit.js chooses
   the parameters on 2011-12 to last season; update.js replays the history and this season
   with them, and this file is the whole model in both places.

   Conventions: `diff` is home minus away plus home ice and the rest terms, so a positive diff
   favours the home side; `homeLine` is the market's home puck line, -1.5 when the home side is
   favoured; `mu` is the model's expected home margin in goals; `periods` is 3 for a regulation
   result, 4 for overtime, 5 for a shootout. */
'use strict';

const DEFAULTS = { K: 8, carry: 0.7, hfa: 40, b2b: 20, rest: 10, ot: 0.6, mov: true };
const MEAN = 1500;
const MAXG = 14;                                    // goals a side is allowed in the Poisson grid

const expected = diff => 1 / (1 + Math.pow(10, -diff / 400));
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);

class Elo {
  constructor(params = {}) {
    this.p = Object.assign({}, DEFAULTS, params);
    this.r = {};            // club -> rating
    this.last = {};         // club -> the date it last played
    this.season = null;
  }
  rating(id) { if (this.r[id] === undefined) this.r[id] = MEAN; return this.r[id]; }
  /* between seasons every rating moves part of the way back to the mean and the calendar clears */
  newSeason(season) {
    if (this.season !== null && season !== this.season) {
      for (const id of Object.keys(this.r)) this.r[id] = MEAN + (this.r[id] - MEAN) * this.p.carry;
      this.last = {};
    }
    this.season = season;
  }
  /* what the calendar is worth to one side: a penalty for playing yesterday, a bonus for three or more days off */
  rest(id, date) {
    const l = this.last[id]; if (!l) return 0;
    const d = daysBetween(l, date);
    if (d === 1) return -this.p.b2b;
    if (d >= 3 && d <= 10) return this.p.rest;         // longer than that is the All-Star break or the season's start: no edge either way
    return 0;
  }
  /* the model's view of a game before it is played */
  predict(g) {
    const rh = this.rating(g.home), ra = this.rating(g.away);
    const diff = rh - ra + (g.neutral ? 0 : this.p.hfa) + this.rest(g.home, g.date) - this.rest(g.away, g.date);
    return { rh, ra, diff, pHome: expected(diff) };
  }
  /* rate a finished game; returns the pre-game view so a replay can keep it */
  play(g) {
    const pre = this.predict(g);
    const margin = g.hs - g.as;                          // the final margin: one goal when decided past regulation
    const pastReg = g.periods > 3 || Math.abs(margin) === 0;
    /* a regulation win is a win; past regulation the winner gets part of one, the rest a tie */
    let s = margin > 0 ? 1 : 0;
    if (pastReg) s = margin > 0 ? 0.5 + this.p.ot / 2 : 0.5 - this.p.ot / 2;
    let mult = 1;
    if (this.p.mov) {
      const winnerDiff = margin >= 0 ? pre.diff : -pre.diff;
      mult = Math.log(Math.max(1, Math.abs(margin)) + 1) * (2.2 / (winnerDiff * 0.001 + 2.2));
    }
    const delta = this.p.K * mult * (s - pre.pHome);
    this.r[g.home] = pre.rh + delta; this.r[g.away] = pre.ra - delta;
    this.last[g.home] = g.date; this.last[g.away] = g.date;
    return Object.assign(pre, { margin, delta });
  }
}

/* the margin side: margin = diff / gpe + b, least squares on (diff, margin) pairs, plus the
   standard deviation of what is left, reported for the record */
function fitSpread(pairs) {
  const n = pairs.length; let sx = 0, sy = 0;
  for (const [d, m] of pairs) { sx += d; sy += m; }
  const mx = sx / n, my = sy / n; let sxx = 0, sxy = 0;
  for (const [d, m] of pairs) { sxx += (d - mx) * (d - mx); sxy += (d - mx) * (m - my); }
  const slope = sxy / sxx, b = my - slope * mx;
  let se = 0;
  for (const [d, m] of pairs) { const e = m - (slope * d + b); se += e * e; }
  return { gpe: 1 / slope, b, sd: Math.sqrt(se / Math.max(1, n - 2)) };
}
const spreadOf = (diff, model) => diff / model.gpe + (model.b || 0);

/* ---------- the goals layer ---------- */
function poisson(lambda) {
  const out = new Array(MAXG + 1); let p = Math.exp(-lambda), sum = 0;
  for (let k = 0; k <= MAXG; k++) { out[k] = p; sum += p; p *= lambda / (k + 1); }
  for (let k = 0; k <= MAXG; k++) out[k] /= sum;         // the tail beyond MAXG folded back in
  return out;
}
/* the chance the side the ratings favour takes an overtime: half the ratings' edge, since
   three-on-three and the shootout are closer to a coin than sixty minutes are */
const otChance = diff => 0.5 + (expected(diff) - 0.5) * 0.5;

/* the distribution of the final margin and the final total, given the expected total and margin.
   Returns pmfs keyed by margin (-MAXG..MAXG, never 0) and by total, plus the regulation tie chance */
function goals(total, mu, diff, pull = 0) {
  const lh = Math.max(0.3, (total + mu) / 2), la = Math.max(0.3, (total - mu) / 2);
  const ph = poisson(lh), pa = poisson(la), pOT = otChance(diff);
  const margin = {}, tot = {}; let tie = 0;
  const tied = (h, a, p) => { tie += p; margin[1] = (margin[1] || 0) + p * pOT; margin[-1] = (margin[-1] || 0) + p * (1 - pOT); tot[h + a + 1] = (tot[h + a + 1] || 0) + p; };
  for (let h = 0; h <= MAXG; h++) for (let a = 0; a <= MAXG; a++) {
    const p = ph[h] * pa[a]; if (!p) continue;
    if (h === a) tied(h, a, p);
    else {
      /* two independent Poissons tie far less often than sixty minutes of hockey do, with the
         trailing side pulling its goalie: a fitted share of the one-goal games is tied instead,
         the goal that would have decided it taken away from the leader */
      const q = Math.abs(h - a) === 1 ? p * pull : 0;
      if (q) tied(Math.min(h, a), Math.min(h, a), q);
      margin[h - a] = (margin[h - a] || 0) + p - q; tot[h + a] = (tot[h + a] || 0) + p - q;
    }
  }
  return { margin, total: tot, tie, pOT, lh, la };
}
/* the home side's cover, push and lose chances against its puck line */
function coverProbs(G, homeLine) {
  if (homeLine === null || homeLine === undefined || !isFinite(homeLine)) return null;
  let cover = 0, push = 0;
  for (const [k, p] of Object.entries(G.margin)) { const m = +k; if (m + homeLine > 1e-9) cover += p; else if (Math.abs(m + homeLine) < 1e-9) push += p; }
  return { cover, push, lose: Math.max(0, 1 - cover - push) };
}
/* over, push and under chances against a total */
function totalProbs(G, line) {
  if (line === null || line === undefined || !isFinite(line)) return null;
  let over = 0, push = 0;
  for (const [k, p] of Object.entries(G.total)) { const t = +k; if (t > line + 1e-9) over += p; else if (Math.abs(t - line) < 1e-9) push += p; }
  return { over, push, under: Math.max(0, 1 - over - push) };
}
/* the chance the home side wins by the goals layer's own reckoning, reported beside the Elo's */
const homeByGoals = G => Object.entries(G.margin).reduce((a, [k, p]) => a + (+k > 0 ? p : 0), 0);

module.exports = { Elo, DEFAULTS, expected, fitSpread, spreadOf, goals, coverProbs, totalProbs, homeByGoals, daysBetween };
