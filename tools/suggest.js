/* The record of the suggested parlays: the Suggested Parlays tab's three levels (Safe, Medium, Aggressive), kept by the job.
   The owner's ask, 25 October 2026: "I also want records of the model for suggested parlays like listed in nfl hub". The NFL
   hub's is props/build/suggest_ledger.js; this is its rule on hockey's unit, the Eastern day:

   - A day's set is the panel's default on that day (every bet type and every game ticked: `pbDayLevels` in index.html), read
     from the page itself, booted in jsdom on the state the job has just made at the run's clock, so the record is exactly what
     the page showed. Never worked out again here.
   - It is taken at every second pass (calls made) while the day's first puck drop is still to come, rewritten while it changes,
     and locked by the first run at or after that puck drop: the record is the last run's before it. A day no run reached with a
     fresh line before its first puck drop has no entry; one whose lines all went before its lock is dropped. `taken` is the run
     that took it (its `published`).
   - The rule (nhl v31, the NFL hub's prices and any-size rule): each level the likeliest parlay by the site's model of 2 to 12 legs,
     one leg a game, paying its own least price (Safe +110, Medium +300, Aggressive +700), and each level taken from then carries the
     rule that chose it ({ pick: 'likeliest-any', minDec, chance }). Before it (nhl v15 to v30) Safe was the likeliest pair, Medium and
     Aggressive the best return of 3 and 4 legs landing 25% and 12% by the model, else the likeliest of that size (TIERS_V30); those
     days stand as taken, words and all. The first run of the new page rewrites the ledger's header itself (tiers, tiersBefore, how and
     `changed`, its publish) and never a day; `v` stays 1, since any other is no ledger. The check holds each level to its own rule, no
     entry mixing the two and no job's entry going back; the summary sums every era and keeps each apart (`eras`).
   - Each leg is graded on its own number, as the page grades a saved leg (`gradeLeg`): the final score, the shootout goal in it.
     A leg settles once and holds: a game postponed, cancelled, moved to another day or gone from the schedule is void.
     A level: any leg lost, lost (pays 0); every leg pushed or void, a push (the stake back); else won, paying the legs won
     multiplied (the level's price when every leg won); any leg not settled, pending.
   - The record (`summary`, the state's `suggest`, with `sets`, the entries from the day before the run's on, which the Suggested
     Parlays tab draws once a day has locked): each level over the season's days, won and lost, pushes and pending apart,
     units on 1 a day (a win the payout less 1, a loss -1), and the wins expected by the model's chance and by DraftKings' fair
     chance, as the NFL's titles say them.
   - `--replay` (by hand, never by the job): the days before the record began, each from the last state the site published on
     main's first-parent line before the day's first puck drop (a second pass's, its lines fresh), rebuilt by today's page at
     that state's clock, `src: 'replay'` with `from: { commit, published }`; then graded as above. A day the record holds is
     never replaced.
   - `check` (the smoke's, and `--check`): an entry locked in the last commit's ledger has not moved but for its grades, a
     settled grade has not moved, an entry was taken before its lock, every grade is its legs', the summary is the entries'.

   The ledger is data/suggest_ledger.json: written by the job only (update.js's second pass), never by hand. */
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
/* the levels (nhl v31): [id, label, the least legs, no floor, the least decimal], each the likeliest parlay of 2 to CAP legs paying
   the least decimal; TIERS_V30 the rule before, [id, label, legs, the floor] */
const TIERS = [['safe', 'Safe', 2, 0, 2.1], ['med', 'Medium', 2, 0, 4], ['aggr', 'Aggressive', 2, 0, 8]];
const TIERS_V30 = [['safe', 'Safe', 2, 0], ['med', 'Medium', 3, 0.25], ['aggr', 'Aggressive', 4, 0.12]];
const IDS = TIERS.map(t => t[0]), PICK = 'likeliest-any', CHANCES = ['model', 'fair'], CAP = 12, TIE = 1e-9;
/* the rule a level was taken by: its pick, its least decimal and its chance from nhl v31, 'v30' before */
const ruleKey = t => t.pick ? [t.pick, t.minDec, t.chance].join(' ') : 'v30';
/* an entry's rule: 'new' where every level carries a pick, 'v30' where none does, 'mixed' else, null with no level */
function ruleOfEntry(e) { const ts = IDS.map(id => e.tiers && e.tiers[id]).filter(x => x); if (!ts.length) return null; const n = ts.filter(x => x.pick !== undefined).length; return !n ? 'v30' : n === ts.length ? 'new' : 'mixed'; }
/* a leg's id: a team bet "gid|side|kind", or (nhl v18) a player's line "gid|p|pid|stat|over0.5" and the anytime goal "gid|p|pid|g|k1" */
const LEG = /^\d{4,12}\|((home|away|over|under)\|(ml|pl|ou)|p\|\d{1,12}\|((pts|g|a|s|bs|sv)\|(over|under)\d+(\.\d+)?|g\|k1))$/;
const r4 = x => Math.round(x * 1e4) / 1e4;
const etDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
/* the season of an Eastern date: a season starts in August (espn.js's seasonOf, written again so this file reads no feed code) */
const seasonOf = d => +d.slice(0, 4) + (+d.slice(5, 7) >= 8 ? 1 : 0);

/* ---------- the page, booted on a state at a clock ---------- */
async function bootPage(stateText, clockMs, html) {
  const { JSDOM } = require('jsdom');
  const src = fs.readFileSync(html || process.env.NHL_HTML || path.join(ROOT, 'index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const errors = [];
  const dom = new JSDOM(src, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/#parlays',
    beforeParse(w) {
      const Real = w.Date, offset = clockMs - Real.now();
      class Clock extends Real { constructor(...a) { if (a.length) super(...a); else super(Real.now() + offset); } static now() { return Real.now() + offset; } }
      w.Date = Clock;
      w.confirm = () => true;
      w.fetch = async url => String(url).startsWith('state.json') ? { ok: true, json: async () => JSON.parse(stateText) } : { ok: false, status: 404, json: async () => ({}) };
      w.addEventListener('error', e => errors.push(e.message));
    },
  });
  const w = dom.window;
  for (let i = 0; i < 400; i++) { await new Promise(r => setTimeout(r, 15)); if (w.eval('!!S && Array.isArray(S.games) && typeof pbDayLevels === "function"')) break; }
  if (!w.eval('!!S && typeof pbDayLevels === "function"')) { w.close(); throw new Error(`the page did not load the state${errors.length ? ': ' + errors.join(' | ') : ''}`); }
  return w;
}

/* ---------- the days a run takes ---------- */
/* each Eastern day with games, its first puck drop: its earliest start, a game's being the earlier of its start and the puck drop its
   frozen call was made before (`before`), so a first game ESPN moved later after its puck drop passed (the job's delay rule: under way)
   does not open the day again */
function daysOf(state) {
  const first = {};
  for (const g of state.games || []) {
    if (!g.date || !g.start) continue;
    const t = Math.min(Date.parse(g.start), g.frozen && g.before ? Date.parse(g.before) : Infinity);
    first[g.date] = Math.min(first[g.date] === undefined ? Infinity : first[g.date], t);
  }
  return first;
}
/* a day's set as the page gives it: { games, tiers: { safe: { legs, p, fair, dec, pick, minDec, chance } | null, ... } }; the rule's
   fields are copied only where the page gives them (every level it takes from nhl v31), and a level with none keeps v30's `likeliest` */
function setOf(w, date) {
  const r = JSON.parse(w.eval(`JSON.stringify(pbDayLevels(${JSON.stringify(date)}))`));
  const tiers = {};
  for (const id of IDS) {
    const t = r.levels[id];
    tiers[id] = t ? { legs: t.legs.map(L => Object.assign({ id: L.id, game: L.game, kind: L.kind, side: L.side, line: L.num, price: L.price, other: L.other, p: r4(L.p), fair: L.fair === null ? null : r4(L.fair), edge: L.edge === null ? null : r4(L.edge), thin: !!L.thin, mu: L.mu, start: L.start },
      L.kind === 'prop' ? { pid: String(L.pid), name: L.name, team: L.team, grp: L.grp, stat: L.stat, mk: L.mk, k: L.k } : {})),
      p: r4(t.p), fair: t.fair === null ? null : r4(t.fair), dec: r4(t.dec) } : null;
    if (t && t.pick) Object.assign(tiers[id], { pick: t.pick, minDec: t.minDec, chance: t.chance });
    else if (t) tiers[id].likeliest = !!t.likeliest;
  }
  return { games: r.games, tiers };
}
const sameSet = (a, b) => JSON.stringify([a.games, a.tiers, a.lock]) === JSON.stringify([b.games, b.tiers, b.lock]);

/* ---------- grading ---------- */
/* a leg on its own number: the final score (the shootout goal in it), as the page grades a saved leg; null while it is to settle */
function gradeLeg(L, state, date) {
  const g = (state.games || []).find(x => x.id === L.game);
  if (!g) return 'void';                                         // postponed, cancelled or gone from the schedule: off the books
  if (g.date !== date) return 'void';                            // moved to another day: off the books, as a postponed game is
  if (g.state !== 'final' || g.hs === null || g.hs === undefined) return null;
  if (L.kind === 'prop') return gradeProp(L, state);
  if (L.kind === 'ou') { const tot = g.hs + g.as; return tot > L.line ? (L.side === 'over' ? 'win' : 'loss') : tot < L.line ? (L.side === 'under' ? 'win' : 'loss') : 'push'; }
  const margin = L.side === 'home' ? g.hs - g.as : g.as - g.hs;
  if (L.kind === 'ml') return margin > 0 ? 'win' : 'loss';
  const c = margin + L.line; return c > 0 ? 'win' : c < 0 ? 'loss' : 'push';
}
/* a player's line (nhl v18) on the final's box score as the state carries it (state.box, update.js's boxWindow): his stat over or under
   the line (a whole line pushes), the anytime goal at one goal or more; a player not on the ice void, as DraftKings voids him; a goalie's
   saves void unless he started, pulled or not, and void where the box cannot tell who started (the page's rule for a saved leg, except
   that the record cannot leave a leg ungraded); to settle while the final's box is to come */
function gradeProp(L, state) {
  const B = state.box && state.box.games, b = B && B[L.game];
  if (!b || typeof b !== 'object') return null;
  let x;
  if (L.stat === 'sv') { const v = b.g && typeof b.g === 'object' ? b.g[String(L.pid)] : undefined; if (v === undefined) return 'void'; x = v; }
  else { const v = b.s && typeof b.s === 'object' ? b.s[String(L.pid)] : undefined; if (!Array.isArray(v)) return 'void'; x = L.stat === 'pts' ? (typeof v[0] === 'number' && typeof v[1] === 'number' ? v[0] + v[1] : null) : v[{ g: 0, a: 1, s: 2, bs: 3 }[L.stat]]; }
  if (typeof x !== 'number' || !isFinite(x)) return null;
  const line = +L.line;
  return L.mk === 'yes' ? (x >= L.k ? 'win' : 'loss') : x > line ? (L.side === 'over' ? 'win' : 'loss') : x < line ? (L.side === 'under' ? 'win' : 'loss') : 'push';
}
const decOf = am => am > 0 ? 1 + am / 100 : 1 + 100 / -am;
/* a level from its legs' grades */
function levelOf(t, legs) {
  if (legs.includes('loss')) return { result: 'lost', legs, payout: 0 };
  if (legs.some(x => x === null)) return { result: 'pending', legs };
  if (legs.every(x => x === 'push' || x === 'void')) return { result: 'push', legs, payout: 1 };
  const won = t.legs.filter((L, i) => legs[i] === 'win');
  return { result: 'won', legs, payout: won.length === t.legs.length ? t.dec : r4(won.reduce((a, L) => a * decOf(L.price), 1)) };
}
/* every locked entry graded on the state, a settled leg kept as it was */
function gradeAll(ledger, state, now) {
  for (const [date, e] of Object.entries(ledger.days)) {
    if (!(Date.parse(e.lock) <= now)) { delete e.grade; continue; }
    if (seasonOf(date) !== state.season) continue;                 // another season's: graded on its own state, kept as it was
    const was = e.grade || {}; e.grade = {};
    for (const id of IDS) {
      const t = e.tiers[id]; if (!t) continue;
      const old = was[id] && Array.isArray(was[id].legs) ? was[id].legs : [];
      /* as the state grades it, a final ESPN corrects included; a settled leg whose game now gives nothing (gone from the schedule, or back
         to be played) holds as it was */
      const legs = t.legs.map((L, i) => { const now = gradeLeg(L, state, date); return now !== null ? (now === 'void' && old[i] && !(state.games || []).some(y => y.id === L.game) ? old[i] : now) : (old[i] || null); });
      e.grade[id] = levelOf(t, legs);
    }
  }
}

/* ---------- the record ---------- */
/* each level over every rule it has had (the pill's record buries nothing, as the NFL sums its eras), and (nhl v31) each rule's own
   days apart: eras[ruleKey] = { from, to, graded, won, lost, push, units, exp_model, exp_fair }, from and to the first and last day the
   level was taken by that rule. `change`: the publish that first took a set by the new rule (the header's `changed`) and the first day
   taken by it, for the tab's one dated line; null on a ledger that never changed rule */
function summarize(ledger, season) {
  const tiers = {}; let pending = 0, days = 0, since = null;
  for (const [id, label] of TIERS) tiers[id] = { label, graded: 0, won: 0, lost: 0, push: 0, pending: 0, none: 0, units: 0, exp_model: 0, exp_fair: 0, fair_n: 0, replay: 0, eras: {} };
  for (const [date, e] of Object.entries(ledger.days).sort()) {
    if (seasonOf(date) !== season || !e.grade) continue;
    days++; if (!since) since = date;
    for (const id of IDS) {
      const s = tiers[id], t = e.tiers[id], g = e.grade[id];
      if (!t || !g) { s.none++; continue; }
      const k = ruleKey(t), E = s.eras[k] || (s.eras[k] = { from: date, to: date, graded: 0, won: 0, lost: 0, push: 0, units: 0, exp_model: 0, exp_fair: 0 });
      E.to = date;
      if (g.result === 'pending') { s.pending++; pending++; continue; }
      if (g.result === 'push') { s.push++; E.push++; continue; }
      s.graded++; E.graded++; if (g.result === 'won') { s.won++; E.won++; } else { s.lost++; E.lost++; }
      const u = (g.result === 'won' ? g.payout : 0) - 1; s.units += u; E.units += u;
      s.exp_model += t.p; E.exp_model += t.p; if (t.fair !== null) { s.exp_fair += t.fair; s.fair_n++; E.exp_fair += t.fair; }
      if (e.src === 'replay') s.replay++;
    }
  }
  for (const s of Object.values(tiers)) {
    s.units = r4(s.units); s.exp_model = r4(s.exp_model); s.exp_fair = r4(s.exp_fair);
    for (const E of Object.values(s.eras)) { E.units = r4(E.units); E.exp_model = r4(E.exp_model); E.exp_fair = r4(E.exp_fair); }
  }
  const first = Object.keys(ledger.days).sort().find(d => ['new', 'mixed'].includes(ruleOfEntry(ledger.days[d]))) || null;
  return { season, since, days, pending, tiers, change: ledger.changed ? { at: ledger.changed, from: first } : null };
}

/* the days the Suggested Parlays tab draws from the record (nhl v17): every entry from the day before the run's own (Eastern) on, as
   taken, locked and graded, so the tab shows a locked day's set as the record has it, read only. An entry still open at the run becomes
   the locked set at its first puck drop unless a later run rewrites it */
function current(ledger, nowMs) {
  const d0 = new Date(Date.parse(etDate(nowMs) + 'T12:00:00Z') - 86400000).toISOString().slice(0, 10), out = {};
  for (const [d, e] of Object.entries(ledger.days).sort()) if (d >= d0) out[d] = { date: e.date, lock: e.lock, taken: e.taken, src: e.src, tiers: e.tiers, grade: e.grade || null };
  return out;
}

const HOW = 'The record of the suggested parlays (the Suggested Parlays tab\'s Safe, Medium and Aggressive), written by tools/suggest.js in update.js\'s second pass, never by hand: each Eastern day\'s set as the page drew it at the last run before the day\'s first puck drop, locked then, graded on the final scores; src "replay" for the days before the record began, rebuilt by node tools/suggest.js --replay from the state the site published then. tiers: each level the likeliest parlay by the site\'s model of 2 to 12 legs, one leg a game, paying at least its decimal (Safe 2.1, Medium 4, Aggressive 8), every level carrying its rule (pick, minDec, chance); tiersBefore: the rule of the days taken before `changed` (nhl v15 to v30: Safe the likeliest pair, Medium and Aggressive the best return of 3 and 4 legs landing 25% and 12% by the model, else the likeliest of that size), whose levels carry no pick and stand as taken.';
const blank = () => ({ v: 1, how: HOW, tiers: TIERS, days: {} });
/* the ledger on disk: none yet is a blank one; anything else that is not a v1 ledger stops the run (a blank would erase the record) */
function readLedger(file) {
  if (!fs.existsSync(file)) return blank();
  let L; try { L = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { throw new Error(`${file} is not JSON: the suggested parlays' record is left as it is (${e.message})`); }
  if (!L || L.v !== 1 || !L.days || typeof L.days !== 'object') throw new Error(`${file} is not a v1 ledger (v ${L && L.v}): the suggested parlays' record is left as it is`);
  return L;
}
/* the header first, in its own order, then a day a line */
const write = (file, L) => {
  const o = { v: L.v, how: L.how, tiers: L.tiers }; if (L.tiersBefore) o.tiersBefore = L.tiersBefore; if (L.changed) o.changed = L.changed; o.days = L.days;
  fs.writeFileSync(file, JSON.stringify(o, null, 0).replace(/,"days":\{/, ',\n"days":{\n').replace(/\},"(\d{4}-\d{2}-\d{2})":/g, '},\n"$1":') + '\n');
};
/* the change of rule (nhl v31), the job's own write: a header still the v30 rule's becomes the new one, the old kept as tiersBefore
   and the run's publish as `changed`; no day is touched (a day locked before stands as taken, and one still open is rewritten by the
   run under the new rule like any open day) */
function migrate(L, at) {
  if (JSON.stringify(L.tiers) !== JSON.stringify(TIERS_V30)) return false;
  Object.assign(L, { how: HOW, tiers: TIERS, tiersBefore: TIERS_V30, changed: at });
  return true;
}

/* ---------- the job's step: take, rewrite, lock, grade; returns the state's `suggest` ---------- */
async function step({ state, data, now, html, log = () => {} }) {
  const file = path.join(data, 'suggest_ledger.json'), L = readLedger(file), before = JSON.stringify(L);
  const nowMs = Date.parse(now), first = daysOf(state);
  if (migrate(L, now)) log(`suggested parlays' record: the header moved to the rule of nhl v31 (the levels taken before it stand as taken)`);
  /* the days still to lock (their first puck drop to come) with a line read this run, or an entry to take back */
  const pubMin = Math.floor(Date.parse(state.published) / 60000);
  const lined = new Set((state.games || []).filter(g => g.line && g.line.at && Math.floor(Date.parse(g.line.at) / 60000) === pubMin).map(g => g.date));
  const open = Object.keys(first).filter(d => first[d] > nowMs && (lined.has(d) || L.days[d])).sort();
  let took = 0, rewrote = 0, dropped = 0;
  if (open.length) {
    const w = await bootPage(JSON.stringify(state), nowMs, html);
    try {
      for (const d of open) {
        const s = setOf(w, d), e = Object.assign({ date: d, lock: new Date(first[d]).toISOString(), taken: state.published, src: 'job' }, s);
        const had = L.days[d];
        if (had && Date.parse(had.lock) <= nowMs) continue;                 // locked (the first puck drop moved later after it passed): kept
        if (!s.games.length) continue;                                    // no fresh line this run: a set taken earlier stands as the last the page drew
        if (!had) { L.days[d] = e; took++; } else if (!sameSet(had, e)) { L.days[d] = e; rewrote++; }
      }
    } finally { w.close(); }
  }
  /* an open entry whose day is no longer in the schedule (its games all moved or called off before its lock) goes; one whose first puck
     drop has moved earlier, to before this run, locks there if it was taken before it, else goes */
  for (const [d, e] of Object.entries(L.days)) {
    if (!(Date.parse(e.lock) > nowMs)) continue;
    if (!(d in first)) { delete L.days[d]; dropped++; }
    else if (first[d] <= nowMs) { if (Date.parse(e.taken) < first[d]) e.lock = new Date(first[d]).toISOString(); else { delete L.days[d]; dropped++; } }
  }
  gradeAll(L, state, nowMs);
  if (!Object.keys(L.days).length && !fs.existsSync(file)) { log("suggested parlays' record: no day taken yet"); return null; }
  const summary = Object.assign(summarize(L, state.season), { sets: current(L, nowMs) });
  if (JSON.stringify(L) !== before) write(file, L);
  const locked = Object.values(L.days).filter(e => Date.parse(e.lock) <= nowMs).length;
  log(`suggested parlays' record: ${Object.keys(L.days).length} days (${locked} locked), this run ${took} taken, ${rewrote} rewritten, ${dropped} dropped; ` +
    TIERS.map(([id, label]) => `${label} ${summary.tiers[id].won}-${summary.tiers[id].lost}`).join(', ') + `, ${summary.pending} pending`);
  return summary;
}

/* ---------- the check: the ledger against the last commit's and its own rules ---------- */
function check(L, prev, state, nowMs) {
  const bad = [];
  if (!L || L.v !== 1 || !L.days) return ['the ledger is not a v1 ledger'];
  /* the header: the rule of nhl v31 (a ledger begun under it, or one moved to it, the old rule kept as tiersBefore with the publish that
     moved it), or still the v30 rule's (an older job's, which no level of the new rule can be in); never moved back or re-dated */
  const isNew = JSON.stringify(L.tiers) === JSON.stringify(TIERS), isOld = JSON.stringify(L.tiers) === JSON.stringify(TIERS_V30), moved = L.tiersBefore !== undefined;
  if (!isNew && !isOld) bad.push(`its levels are not ${TIERS.map(t => t[1]).join(', ')} by either rule`);
  if (moved && !(isNew && JSON.stringify(L.tiersBefore) === JSON.stringify(TIERS_V30) && isFinite(Date.parse(L.changed)))) bad.push('its rule before (tiersBefore) is not the v30 table under the new one with the publish that moved it (changed)');
  if (!moved && L.changed !== undefined) bad.push('a change of rule dated with no rule before');
  if (prev && JSON.stringify(prev.tiers) === JSON.stringify(TIERS) && !isNew) bad.push('its header went back to the rule before');
  if (prev && prev.changed !== undefined && prev.changed !== L.changed) bad.push(`its change of rule moved from ${prev.changed} to ${L.changed}`);
  /* no going back: a job's entry taken after the first job's entry carrying the new rule carries it too */
  const firstNew = Math.min(...Object.values(L.days).filter(e => e.src === 'job' && ['new', 'mixed'].includes(ruleOfEntry(e))).map(e => Date.parse(e.taken)));
  for (const [d, e] of Object.entries(L.days)) {
    const tag = `${d}`;
    if (e.date !== d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) bad.push(`${tag}: keyed by another date (${e.date})`);
    if (etDate(Date.parse(e.lock)) !== d) bad.push(`${tag}: its lock ${e.lock} is not on its own day (Eastern)`);
    const takenAt = e.src === 'replay' ? e.from && e.from.published : e.taken;
    if (!(Date.parse(takenAt) < Date.parse(e.lock))) bad.push(`${tag}: taken at ${takenAt}, not before its lock ${e.lock}`);
    if (e.src === 'replay' && !(e.from && /^[0-9a-f]{40}$/.test(e.from.commit))) bad.push(`${tag}: a replay with no commit`);
    if (!['job', 'replay'].includes(e.src)) bad.push(`${tag}: src ${e.src}`);
    const rule = ruleOfEntry(e);
    if (rule === 'mixed') bad.push(`${tag}: an entry mixing the two rules (${IDS.map(id => e.tiers[id] ? `${id} ${ruleKey(e.tiers[id])}` : `${id} none`).join(', ')})`);
    if (rule === 'v30' && !isOld && !moved) bad.push(`${tag}: a level of the v30 rule in a ledger begun under the new one`);
    if (rule === 'new' && !isNew) bad.push(`${tag}: a level of the new rule under the v30 header`);
    if (rule === 'v30' && e.src === 'job' && Date.parse(e.taken) > firstNew) bad.push(`${tag}: a v30 level taken (${e.taken}) after a job's level of the new rule (${new Date(firstNew).toISOString()})`);
    for (const T of TIERS) {
      const id = T[0], t = e.tiers && e.tiers[id]; if (t === null) continue;
      if (!t || !Array.isArray(t.legs)) { bad.push(`${tag} ${id}: no legs`); continue; }
      /* each level by its own rule: a v30 level its fixed size; one of the new rule its pick, its least price (its id's), its chance and
         2 to 12 legs, at most one a game of the day, paying that price */
      const n = t.legs.length;
      if (t.pick === undefined) { const V = TIERS_V30.find(x => x[0] === id); if (n !== V[2]) { bad.push(`${tag} ${id}: not ${V[2]} legs`); continue; } }
      else {
        if (t.pick !== PICK) bad.push(`${tag} ${id}: pick ${t.pick}, not ${PICK}`);
        if (t.minDec !== T[4]) bad.push(`${tag} ${id}: its least price ${t.minDec}, not ${T[1]}'s ${T[4]}`);
        if (!CHANCES.includes(t.chance)) bad.push(`${tag} ${id}: ranked by ${t.chance}, not ${CHANCES.join(' or ')}`);
        const cap = Math.min(CAP, Array.isArray(e.games) ? e.games.length : 0);
        if (!(n >= 2 && n <= cap)) { bad.push(`${tag} ${id}: ${n} legs, not 2 to ${cap}`); continue; }
      }
      if (t.legs.some(x => !LEG.test(x.id) || !e.games.includes(x.game))) bad.push(`${tag} ${id}: a leg not on the day's games`);
      if (new Set(t.legs.map(x => x.game)).size !== n) bad.push(`${tag} ${id}: two legs of one game`);
      /* its chance, fair chance and price its legs', the price worked in the legs' order (the record's, the page's leg order) */
      const p = t.legs.reduce((a, x) => a * x.p, 1), dec = t.legs.reduce((a, x) => a * decOf(x.price), 1), fair = t.legs.reduce((a, x) => a === null || x.fair === null ? null : a * x.fair, 1);
      if (Math.abs(p - t.p) > 2e-4 * n || Math.abs(dec - t.dec) > 1e-3 * dec) bad.push(`${tag} ${id}: its chance or price is not its legs' (${t.p} ${t.dec} against ${r4(p)} ${r4(dec)})`);
      if (t.pick !== undefined && (fair === null ? t.fair !== null : !(Math.abs(fair - t.fair) <= 2e-4 * n))) bad.push(`${tag} ${id}: its fair chance ${t.fair} is not its legs' (${fair === null ? null : r4(fair)})`);
      if (t.pick !== undefined && !(dec >= t.minDec * (1 - TIE))) bad.push(`${tag} ${id}: pays ${r4(dec)}, under its least price ${t.minDec}`);
      const g = e.grade && e.grade[id];
      if (Date.parse(e.lock) > nowMs) { if (g) bad.push(`${tag} ${id}: graded before its lock`); continue; }
      if (!g) { if (seasonOf(d) === state.season) bad.push(`${tag} ${id}: locked and not graded`); continue; }
      const want = levelOf(t, g.legs);
      if (JSON.stringify(want) !== JSON.stringify(g)) bad.push(`${tag} ${id}: graded ${JSON.stringify(g)}, its legs give ${JSON.stringify(want)}`);
      /* every leg as the state grades it (a corrected final included); where the state gives nothing (its game gone from the schedule, or
         back to be played) a leg settled before holds, as the last commit's ledger had it */
      const pg = prev && prev.days && prev.days[d] && prev.days[d].grade && prev.days[d].grade[id];
      if (seasonOf(d) === state.season) t.legs.forEach((x, i) => {
        const now = gradeLeg(x, state, d), was = g.legs[i], gone = !(state.games || []).some(y => y.id === x.game), before = pg && pg.legs ? pg.legs[i] : undefined;
        const ok = now !== null && !(now === 'void' && gone) ? was === now : (was === now || (was !== null && (before === undefined ? true : was === before)));
        if (!ok) bad.push(`${tag} ${id}: leg ${x.id} graded ${was}, the state gives ${now}${before !== undefined ? `, the last ledger ${before}` : ''}`);
      });
    }
  }
  /* a day the last commit's ledger never had is one this run took before its lock, or a replay: never a job's day already locked */
  if (prev && prev.days) for (const [d, e] of Object.entries(L.days)) if (!prev.days[d] && Date.parse(e.lock) <= nowMs && e.src !== 'replay') bad.push(`${d}: locked and new since the last ledger, not a replay`);
  if (prev && prev.days) for (const [d, p] of Object.entries(prev.days)) {
    const e = L.days[d];
    if (Date.parse(p.lock) <= nowMs && !e) { bad.push(`${d}: locked in the last ledger and gone`); continue; }
    if (!e) continue;
    if (Date.parse(p.lock) <= nowMs && JSON.stringify([p.lock, p.taken, p.src, p.games, p.tiers]) !== JSON.stringify([e.lock, e.taken, e.src, e.games, e.tiers])) bad.push(`${d}: locked in the last ledger and moved since`);
    if (p.grade) for (const id of IDS) {
      const a = p.grade[id], b = e.grade && e.grade[id], t = e.tiers && e.tiers[id];
      if (a && t && a.legs.some((x, i) => x !== null && (!b || (b.legs[i] !== x && b.legs[i] !== gradeLeg(t.legs[i], state, d))))) bad.push(`${d} ${id}: a settled leg's grade moved, and not to the state's`);
    }
  }
  return bad;
}

module.exports = { TIERS, TIERS_V30, step, check, summarize, current, gradeLeg, gradeProp, levelOf, gradeAll, bootPage, setOf, daysOf, readLedger, blank, write, migrate, ruleKey, ruleOfEntry, seasonOf };

/* ---------- by hand: the replay of the days before the record ---------- */
async function replay() {
  const file = path.join(process.env.NHL_DATA || path.join(ROOT, 'data'), 'suggest_ledger.json'), L = readLedger(file);
  const cur = JSON.parse(fs.readFileSync(process.env.NHL_STATE || path.join(ROOT, 'state.json'), 'utf8'));
  migrate(L, cur.published);                                            // today's page takes the days by the new rule
  const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (git('rev-parse', '--is-shallow-repository').trim() === 'true') throw new Error('this clone is shallow: git fetch --unshallow origin main first');
  const branch = process.env.SUGGEST_REF || 'origin/main';
  const commits = git('log', '--first-parent', '--format=%H %cI', branch, '--', 'state.json').trim().split('\n').map(l => l.split(' ')).reverse();
  /* each day's last state before its first puck drop: a second pass's, published before it, with the day's lines fresh in it */
  const pick = {};
  for (const [sha, at] of commits) {
    let st; try { st = JSON.parse(git('show', `${sha}:state.json`)); } catch (e) { continue; }
    if (st.pass === 'scores' || st.season !== cur.season) continue;
    const pub = Date.parse(st.published), first = daysOf(st);
    for (const [d, f] of Object.entries(first)) {
      if (!(pub < f) || !(Date.parse(at) < f) || f > Date.now()) continue;          // published and committed before the puck drop: the state the site served
      const fresh = st.games.some(g => g.date === d && g.line && g.line.at && Math.floor(Date.parse(g.line.at) / 60000) === Math.floor(pub / 60000));
      if (fresh && (!pick[d] || Date.parse(pick[d].st.published) < pub)) pick[d] = { sha, st, first: f };
    }
  }
  let made = 0;
  for (const d of Object.keys(pick).sort()) {
    if (L.days[d]) continue;                                            // the record's own day, or one replayed before: kept
    const { sha, st, first } = pick[d], w = await bootPage(JSON.stringify(st), Date.parse(st.published));
    try {
      const s = setOf(w, d);
      if (!s.games.length) continue;
      L.days[d] = Object.assign({ date: d, lock: new Date(first).toISOString(), taken: st.published, src: 'replay', from: { commit: sha, published: st.published } }, s);
      made++; console.log(`${d}: from ${sha.slice(0, 7)} (published ${st.published}), ${s.games.length} lined games: ` + TIERS.map(([id, label]) => `${label} ${s.tiers[id] ? s.tiers[id].legs.map(x => x.id.split('|').slice(1).join(' ')).join(' + ') : 'none'}`).join('; '));
    } finally { w.close(); }
  }
  L.days = Object.fromEntries(Object.entries(L.days).sort());
  gradeAll(L, cur, Date.parse(cur.published));
  write(file, L);
  const s = summarize(L, cur.season);
  console.log(`replayed ${made} days; the record: ` + TIERS.map(([id, label]) => `${label} ${s.tiers[id].won}-${s.tiers[id].lost} (${s.tiers[id].units >= 0 ? '+' : ''}${s.tiers[id].units.toFixed(2)} units)`).join(', ') + `, ${s.pending} pending`);
}
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a.includes('--replay')) replay().catch(e => { console.error(e.message || e); process.exit(1); });
  else if (a.includes('--check')) {
    const data = process.env.NHL_DATA || path.join(ROOT, 'data'), st = JSON.parse(fs.readFileSync(process.env.NHL_STATE || path.join(ROOT, 'state.json'), 'utf8'));
    let prev = null; try { prev = JSON.parse(execFileSync('git', ['show', 'HEAD:data/suggest_ledger.json'], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { /* none committed yet */ }
    let L; try { L = readLedger(path.join(data, 'suggest_ledger.json')); } catch (e) { L = null; console.log('FAIL ' + e.message); }
    const bad = L ? check(L, prev, st, Date.parse(st.published)) : ['the ledger could not be read'];
    for (const b of bad) console.log('FAIL ' + b);
    console.log(`suggest check: ${bad.length} failures`); process.exit(bad.length ? 1 : 0);
  } else console.log('node tools/suggest.js --replay | --check (the job runs it from update.js)');
}
