/* The props shadow ledger's check: data/props_ledger.json against the last commit's, the record of DraftKings' closing
   props (data/props_<season>.jsonl), the box scores and the clock. The smoke test runs it (THE PROPS MODEL), so a
   failure here holds the whole run back before its commit and the last good ledger stays live; it runs on its own too.

   It fails when:
     * the bar is not the one registered (BAR in props.js), or not the last commit's, or its registration time moved,
       or a call was made before it was registered;
     * the registered model (its constants and their sha) moved, or its sha is not its constants';
     * a call was made at or after its puck drop, or is not in its shape (five non-negative means a skater, one a goalie), or
       its puck drop was before the props step's last run (the ledger's, or data/props.json's) and it is not frozen;
     * a call the last commit had frozen, or whose puck drop has passed, is gone, open again, or changed in any field of
       the call (the puck drop, the clubs, when it was made, the model, any mean). The one change allowed is a rewrite by
       this run before the puck drop (its called_at this run's own, later than the old one and before both puck drops)
       of a call the last commit had not frozen;
     * a grade the last commit had is changed, or a grade does not follow from the frozen call, the record and the box
       score: every main line of the record on a player the call projects for that stat and who played, the model's
       chance of the Over from the call's mean, DraftKings' fair chance (1 - the Under's implied), the stat in the box;
       or a game final, boxed and recorded with its call frozen is not graded;
     * a verdict is written before 12,000 lines are in, is missing once they are, does not follow from the first 12,000,
       or differs from the last commit's;
     * the summary does not follow from the calls.

    node tools/props_check.js [--prev FILE | --no-prev]     ends "props check: 0 failures"

   Without --prev the last commit's ledger is read with `git show HEAD:data/props_ledger.json` (none there, or NHL_DATA
   set with no NHL_PREV_LEDGER: checked on its own). NHL_DATA, NHL_STATE and NHL_NOW move the files and the clock. */
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const P = require('./props');

const ROOT = path.join(__dirname, '..');
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const J = x => JSON.stringify(x);

/* the context a check needs: the records and the box scores of the ledger's graded or gradable games */
function context(dataDir, L) {
  const ids = new Set(Object.keys((L && L.calls) || {}));
  const records = new Map(), boxes = new Map();
  for (const f of fs.readdirSync(dataDir).filter(f => /^props_\d{4}\.jsonl$/.test(f))) for (const l of fs.readFileSync(path.join(dataDir, f), 'utf8').split('\n')) { if (!l) continue; const r = JSON.parse(l); if (ids.has(String(r.id))) records.set(String(r.id), r); }
  for (const f of fs.readdirSync(dataDir).filter(f => /^box_\d{4}\.jsonl$/.test(f)).sort().slice(-2)) for (const l of fs.readFileSync(path.join(dataDir, f), 'utf8').split('\n')) { if (!l || !ids.has((/"id":"(\d+)"/.exec(l) || [])[1])) continue; const b = JSON.parse(l); boxes.set(String(b.id), b); }
  return { records, boxes };
}

/* every failure as a sentence; an empty list is a clean ledger */
function check(L, prev, ctx) {
  const bad = [], t = Date.parse, now = t(ctx.now);
  if (!L || typeof L !== 'object' || !L.calls) return ['the ledger is missing or not a ledger'];
  if (J(L.bar) !== J(P.BAR)) bad.push('the bar in the ledger is not the one registered (BAR in props.js)');
  if (prev && (J(prev.bar) !== J(L.bar) || prev.bar_registered !== L.bar_registered)) bad.push('the bar or its registration time differs from the last commit\'s');
  if (!L.model || P.shaOf(L.model.params) !== L.model.sha) bad.push('the registered model\'s sha is not its constants\'');
  if (prev && J(prev.model) !== J(L.model)) bad.push('the registered model differs from the last commit\'s');
  const reg = L.bar_registered ? t(L.bar_registered) : NaN;
  /* the props step's last run: the ledger's own, or the projections' (data/props.json), written by the same run whenever a
     game it projected has started, so a call its run should have frozen is seen even when the ledger was not rewritten */
  const lastRun = Math.max(t(L.run_at) || 0, t(ctx.projectedAt) || 0);
  for (const [gid, c] of Object.entries(L.calls)) {
    if (!(t(c.called_at) < t(c.start))) bad.push(`${gid}: called at ${c.called_at}, not before its puck drop ${c.start}`);
    if (!(t(c.called_at) >= reg)) bad.push(`${gid}: called at ${c.called_at}, before the bar was registered (${L.bar_registered})`);
    const skOk = c.sk && typeof c.sk === 'object' && Object.values(c.sk).every(a => Array.isArray(a) && a.length === 5 && a.every(x => typeof x === 'number' && x >= 0 && isFinite(x)));
    const gkOk = c.gk && typeof c.gk === 'object' && Object.values(c.gk).every(x => typeof x === 'number' && x >= 0 && isFinite(x));
    if (!skOk || !gkOk || typeof c.v !== 'string') bad.push(`${gid}: a call not in its shape`);
    if (c.final && !c.frozen) bad.push(`${gid}: graded but not frozen`);
    if (!c.frozen && t(c.start) <= lastRun) bad.push(`${gid}: its puck drop (${c.start}) was before the props step's last run (${new Date(lastRun).toISOString().slice(0, 16)}Z) and its call is not frozen`);
    if (c.frozen && !(t(c.frozen_at) >= t(c.called_at))) bad.push(`${gid}: frozen before it was made`);
  }
  /* nothing frozen moved */
  if (prev) for (const [gid, pc] of Object.entries(prev.calls || {})) {
    if (!(pc.frozen || t(pc.start) <= now)) continue;
    const c = L.calls[gid];
    if (!c) { bad.push(`${gid}: a call frozen at its puck drop (${pc.start}) is gone`); continue; }
    if (pc.frozen && !c.frozen) bad.push(`${gid}: a frozen call is open again`);
    if (pc.frozen && pc.frozen_at !== c.frozen_at) bad.push(`${gid}: its freeze time moved`);
    if (pc.final && J(pc.final) !== J(c.final)) bad.push(`${gid}: a grade the last commit had is changed`);
    if (P.CALL_FIELDS.every(f => J(pc[f]) === J(c[f]))) continue;
    const rewrite = !pc.frozen && c.called_at === L.run_at && t(pc.called_at) < t(c.called_at) && t(c.called_at) < Math.min(t(pc.start), t(c.start));
    if (!rewrite) bad.push(`${gid}: the call changed after its puck drop (${P.CALL_FIELDS.filter(f => J(pc[f]) !== J(c[f])).join(', ')})`);
  }
  /* each grade from the call, the record and the box score */
  const paramsOf = v => v === L.model.sha ? L.model.params : null;
  for (const [gid, c] of Object.entries(L.calls)) {
    const rec = ctx.records.get(gid), box = ctx.boxes.get(gid);
    if (c.final) {
      if (!rec) { bad.push(`${gid}: graded, but the record has no closing props for it`); continue; }
      if (rec.status === 404) { if (c.final.lines.length || !c.final.none) bad.push(`${gid}: ESPN had no props for it, yet it is graded on lines`); continue; }
      if (!box) { bad.push(`${gid}: graded, but there is no box score for it`); continue; }
      const C = paramsOf(c.v);
      if (!C) { bad.push(`${gid}: graded on a model the ledger did not register (${c.v})`); continue; }
      const want = P.gradeCall(c, rec, box, C);
      if (J(want.lines) !== J(c.final.lines) || want.voided !== c.final.voided || want.unprojected !== c.final.unprojected) {
        const i = want.lines.findIndex((l, k) => J(l) !== J(c.final.lines[k]));
        bad.push(`${gid}: the grade does not follow from the call, the record and the box score (${want.lines.length} lines due, ${c.final.lines.length} graded${i >= 0 ? `; first difference ${J(c.final.lines[i])} where ${J(want.lines[i])}` : ''})`);
      }
    } else if (c.frozen && rec && box && ctx.finals && ctx.finals.has(gid)) bad.push(`${gid}: final, boxed and its closing props recorded, but not graded`);
  }
  /* the verdict and the summary */
  const n = P.compared(L).length;
  if (L.decision) {
    const want = P.decide(L, L.decision.decided_at);
    if (J(want) !== J(L.decision)) bad.push(`the verdict does not follow from the calls (the first ${P.BAR.lines} graded lines, in grading order)`);
  } else if (n >= P.BAR.lines) bad.push(`${P.BAR.lines} lines are in and no verdict was written`);
  if (prev && prev.decision && J(prev.decision) !== J(L.decision)) bad.push('the verdict differs from the last commit\'s');
  if (J(P.summarize(L)) !== J(L.summary)) bad.push('the summary does not follow from the calls');
  return bad;
}

function prevLedger(dataDir) {
  if (process.env.NHL_PREV_LEDGER) return process.env.NHL_PREV_LEDGER === 'none' ? null : readJSON(process.env.NHL_PREV_LEDGER);
  if (process.env.NHL_DATA) return null;
  try { return JSON.parse(execFileSync('git', ['show', 'HEAD:data/props_ledger.json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { return null; }
}
/* the whole check on the files: { bad, prev } */
function run(dataDir, stateFile, nowIso, prevArg) {
  const L = readJSON(path.join(dataDir, 'props_ledger.json'));
  if (!L) return { bad: [], prev: null, none: true };
  const prev = prevArg !== undefined ? prevArg : prevLedger(dataDir);
  const S = readJSON(stateFile);
  const PJ = readJSON(path.join(dataDir, 'props.json'));
  const ctx = Object.assign(context(dataDir, L), { now: nowIso, projectedAt: PJ && PJ.generated, finals: new Set(((S && S.games) || []).filter(g => g.state === 'final').map(g => String(g.id))) });
  return { bad: check(L, prev, ctx), prev };
}

if (require.main === module) {
  const DATA = process.env.NHL_DATA || path.join(ROOT, 'data'), STATE = process.env.NHL_STATE || path.join(ROOT, 'state.json');
  const a = process.argv.slice(2);
  const prevArg = a.includes('--no-prev') ? null : a.includes('--prev') ? readJSON(a[a.indexOf('--prev') + 1]) : undefined;
  const now = process.env.NHL_NOW || new Date().toISOString().slice(0, 16) + 'Z';
  const { bad, prev, none } = run(DATA, STATE, now, prevArg);
  for (const b of bad) console.log('FAIL', b);
  console.log(`props check: ${bad.length} failures${none ? ' (no ledger yet)' : prev ? '' : ' (no earlier ledger to hold it to)'}`);
  process.exit(bad.length ? 1 : 0);
}
module.exports = { check, context, run, prevLedger };
