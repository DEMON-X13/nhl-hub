/* The suggested parlays' record's own test (tools/suggest.js): the grading of a leg and a level, a settled leg holding, the
   summary, the check on broken ledgers, and the job's step end to end on the real state booted in the page at made-up clocks
   (taken before the day's first puck drop, rewritten while it changes, locked at it, graded on made-up finals). Ends
   "test suggest: N checks, 0 failures". */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const SG = require('./suggest');
const ROOT = path.join(__dirname, '..');
let checks = 0; const fails = [];
const chk = (ok, msg) => { checks++; if (!ok) fails.push(msg); };
const clone = x => JSON.parse(JSON.stringify(x));

/* ---------- a leg ---------- */
{
  const st = { season: 2027, games: [
    { id: '1', date: '2026-10-20', state: 'final', hs: 4, as: 3, periods: 5 },       // a shootout: 4-3 with the shootout goal
    { id: '2', date: '2026-10-20', state: 'final', hs: 2, as: 5, periods: 3 },
    { id: '3', date: '2026-10-20', state: 'live', hs: 1, as: 0 },
    { id: '4', date: '2026-10-22', state: 'pre', hs: null, as: null },              // moved to another day
  ] };
  const g = (game, kind, side, line) => SG.gradeLeg({ game, kind, side, line }, st, '2026-10-20');
  chk(g('1', 'ml', 'home') === 'win' && g('1', 'ml', 'away') === 'loss', 'the moneyline on the final score, the shootout goal in it');
  chk(g('1', 'pl', 'home', -1.5) === 'loss' && g('1', 'pl', 'away', 1.5) === 'win', 'the puck line: a shootout win by one does not cover -1.5');
  chk(g('2', 'pl', 'away', -1.5) === 'win' && g('2', 'pl', 'home', 1.5) === 'loss', 'a win by three covers -1.5');
  chk(g('1', 'ou', 'over', 6.5) === 'win' && g('1', 'ou', 'under', 6.5) === 'loss' && g('2', 'ou', 'under', 7.5) === 'win', 'the total with the shootout goal in it');
  chk(g('2', 'ou', 'over', 7) === 'push' && g('2', 'pl', 'away', -3) === 'push', 'a whole number lands: a push');
  chk(g('3', 'ml', 'home') === null, 'a game under way is to settle');
  chk(g('4', 'ml', 'home') === 'void' && g('9', 'ml', 'home') === 'void', 'a game moved to another day or gone from the schedule is void');
}
/* ---------- a player's line (nhl v18), on the box the state carries ---------- */
{
  const st = { season: 2027, games: [{ id: '5', date: '2026-10-20', state: 'final', hs: 3, as: 2 }, { id: '6', date: '2026-10-20', state: 'final', hs: 1, as: 0 }, { id: '7', date: '2026-10-20', state: 'live', hs: 1, as: 1 }],
    box: { from: '2026-10-11', games: { '5': { s: { '11': [1, 1, 4, 0], '12': [0, 0, 2, 3] }, g: { '21': 28 }, r: ['22'] } } } };
  const p = (pid, stat, mk, side, line, k, game) => SG.gradeLeg({ game: game || '5', kind: 'prop', pid, stat, mk, side, line, k }, st, '2026-10-20');
  chk(p('11', 'pts', 'main', 'over', 1.5) === 'win' && p('11', 'pts', 'main', 'under', 1.5) === 'loss' && p('12', 'pts', 'main', 'under', 0.5) === 'win', 'points are goals plus assists, over or under the line');
  chk(p('11', 's', 'main', 'over', 3.5) === 'win' && p('12', 'bs', 'main', 'under', 2.5) === 'loss' && p('11', 'a', 'main', 'over', 1) === 'push', 'shots, blocks, a whole line pushing');
  chk(p('11', 'g', 'yes', 'over', 0.5, 1) === 'win' && p('12', 'g', 'yes', 'over', 0.5, 1) === 'loss', 'the anytime goal at one goal or more');
  chk(p('21', 'sv', 'main', 'over', 24.5) === 'win' && p('22', 'sv', 'main', 'over', 24.5) === 'void' && p('23', 'sv', 'main', 'over', 24.5) === 'void', "a starter's saves; a reliever's, or a goalie who did not play, void");
  chk(p('99', 'pts', 'main', 'over', 0.5) === 'void', 'a player not on the ice: void, as DraftKings voids him');
  chk(p('11', 'pts', 'main', 'over', 0.5, null, '6') === null && p('11', 'pts', 'main', 'over', 0.5, null, '7') === null, 'a final whose box is not carried yet, or a game under way, is to settle');
}
/* ---------- a level ---------- */
{
  const t = { legs: [{ price: -150 }, { price: 120 }, { price: 100 }], dec: 1.6667 * 2.2 * 2 };
  chk(JSON.stringify(SG.levelOf(t, ['win', 'loss', null])) === JSON.stringify({ result: 'lost', legs: ['win', 'loss', null], payout: 0 }), 'a leg lost loses it, whatever is still to settle');
  chk(SG.levelOf(t, ['win', null, 'win']).result === 'pending' && SG.levelOf(t, ['win', null, 'win']).payout === undefined, 'a leg to settle and none lost: pending, no payout');
  chk(SG.levelOf(t, ['push', 'void', 'void']).result === 'push' && SG.levelOf(t, ['push', 'void', 'void']).payout === 1, 'every leg pushed or void: the stake back');
  chk(SG.levelOf(t, ['win', 'win', 'win']).payout === t.dec, 'every leg won pays the level\'s price');
  const part = SG.levelOf(t, ['win', 'void', 'win']);
  chk(part.result === 'won' && Math.abs(part.payout - (1 + 100 / 150) * 2) < 1e-4, `a void leg drops out: the legs won multiplied (${part.payout})`);
}
/* ---------- the summary and the check, on a ledger of made-up days ---------- */
const leg = (id, price, p, fair) => ({ id, game: id.split('|')[0], kind: id.split('|')[2], side: id.split('|')[1], line: id.endsWith('|ml') ? null : id.endsWith('|pl') ? (id.includes('|home|') ? -1.5 : 1.5) : 5.5, price, other: -price, p, fair, edge: 0.06, thin: false, mu: 'A @ B', start: '2026-10-20T23:00:00Z' });
const tier = legs => ({ legs, p: Math.round(legs.reduce((a, x) => a * x.p, 1) * 1e4) / 1e4, fair: Math.round(legs.reduce((a, x) => a * x.fair, 1) * 1e4) / 1e4,
  dec: Math.round(legs.reduce((a, x) => a * (x.price > 0 ? 1 + x.price / 100 : 1 + 100 / -x.price), 1) * 1e4) / 1e4, likeliest: false });
const day = (d, gs, src) => ({ date: d, lock: `${d}T23:00:00.000Z`, taken: `${d}T16:00:00.000Z`, src: src || 'job', games: gs,
  tiers: { safe: tier([leg(`${gs[0]}|home|ml`, -150, 0.66, 0.58), leg(`${gs[1]}|over|ou`, -110, 0.56, 0.5)]),
    med: tier([leg(`${gs[0]}|home|ml`, -150, 0.66, 0.58), leg(`${gs[1]}|over|ou`, -110, 0.56, 0.5), leg(`${gs[2]}|away|pl`, -200, 0.72, 0.64)]), aggr: null } });
{
  const st = { season: 2027, published: '2026-10-22T16:00:00.000Z', games: [
    { id: '4018000011', date: '2026-10-20', state: 'final', hs: 3, as: 1 }, { id: '4018000012', date: '2026-10-20', state: 'final', hs: 4, as: 3 }, { id: '4018000013', date: '2026-10-20', state: 'final', hs: 2, as: 1 },
    { id: '4018000021', date: '2026-10-21', state: 'final', hs: 1, as: 2 }, { id: '4018000022', date: '2026-10-21', state: 'final', hs: 5, as: 2 }, { id: '4018000023', date: '2026-10-21', state: 'final', hs: 3, as: 2 },
    { id: '4018000031', date: '2026-10-22', state: 'pre', hs: null, as: null }, { id: '4018000032', date: '2026-10-22', state: 'pre', hs: null, as: null }, { id: '4018000033', date: '2026-10-22', state: 'pre', hs: null, as: null } ] };
  const L = SG.blank();
  L.days['2026-10-20'] = day('2026-10-20', ['4018000011', '4018000012', '4018000013'], 'replay'); L.days['2026-10-20'].from = { commit: 'a'.repeat(40), published: '2026-10-20T15:00:00.000Z' };
  L.days['2026-10-21'] = day('2026-10-21', ['4018000021', '4018000022', '4018000023']);
  L.days['2026-10-22'] = day('2026-10-22', ['4018000031', '4018000032', '4018000033']);
  const now = Date.parse(st.published);
  SG.gradeAll(L, st, now);
  /* 10-20: home ml 3-1 win, over 5.5 on 7 win -> Safe won; away +1.5 on a 1-goal loss win -> Medium won. 10-21: home ml lost -> both lost */
  chk(L.days['2026-10-20'].grade.safe.result === 'won' && L.days['2026-10-20'].grade.med.result === 'won' && L.days['2026-10-21'].grade.safe.result === 'lost' && !L.days['2026-10-22'].grade,
    `graded as the finals say, the day to come not graded (${JSON.stringify([L.days['2026-10-20'].grade, L.days['2026-10-21'].grade])})`);
  const s = SG.summarize(L, 2027);
  chk(s.since === '2026-10-20' && s.days === 2 && s.tiers.safe.won === 1 && s.tiers.safe.lost === 1 && s.tiers.med.won === 1 && s.tiers.med.lost === 1 && s.tiers.aggr.none === 2 && s.tiers.safe.replay === 1,
    `the summary counts each day once, Aggressive none on both, the replayed day said (${JSON.stringify(s.tiers.safe)})`);
  chk(Math.abs(s.tiers.safe.units - (L.days['2026-10-20'].tiers.safe.dec - 1 - 1)) < 1e-4 && Math.abs(s.tiers.safe.exp_model - (L.days['2026-10-20'].tiers.safe.p + L.days['2026-10-21'].tiers.safe.p)) < 1e-4, 'units on 1 a day and the wins the model expected');
  chk(!SG.check(L, clone(L), st, now).length, `a sound ledger passes the check (${SG.check(L, clone(L), st, now).join(' | ')})`);
  /* a settled leg holds once its game has left the schedule */
  const st2 = clone(st); st2.games = st2.games.filter(g => g.id !== '4018000011');
  const L2 = clone(L); SG.gradeAll(L2, st2, now);
  chk(JSON.stringify(L2.days['2026-10-20'].grade) === JSON.stringify(L.days['2026-10-20'].grade) && !SG.check(L2, L, st2, now).length, 'a settled leg holds when its game leaves the schedule');
  /* broken ledgers the check fails */
  const broken = [
    ['a locked day moved', X => { X.days['2026-10-21'].tiers.safe.legs[0].price = -140; }],
    ['a locked day gone', X => { delete X.days['2026-10-21']; }],
    ['a settled leg moved', X => { X.days['2026-10-21'].grade.safe.legs[0] = 'win'; X.days['2026-10-21'].grade.safe = SG.levelOf(X.days['2026-10-21'].tiers.safe, X.days['2026-10-21'].grade.safe.legs); }],
    ['a grade not its legs\'', X => { X.days['2026-10-21'].grade.safe.result = 'won'; }],
    ['taken after its lock', X => { X.days['2026-10-22'].taken = '2026-10-22T23:30:00.000Z'; }],
    ['a level of the wrong size', X => { X.days['2026-10-22'].tiers.med.legs.pop(); }],
    ['two legs of one game', X => { X.days['2026-10-22'].tiers.safe.legs[1] = leg('4018000031|over|ou', -110, 0.56, 0.5); X.days['2026-10-22'].tiers.safe = tier(X.days['2026-10-22'].tiers.safe.legs); }],
    ['a leg on another day\'s game', X => { X.days['2026-10-22'].tiers.safe.legs[0] = leg('4018000011|home|ml', -150, 0.66, 0.58); X.days['2026-10-22'].tiers.safe = tier(X.days['2026-10-22'].tiers.safe.legs); }],
    ['a chance not its legs\'', X => { X.days['2026-10-22'].tiers.safe.p = 0.5; }],
    ['graded before its lock', X => { X.days['2026-10-22'].grade = { safe: { result: 'pending', legs: [null, null] } }; }],
    ['a replay with no commit', X => { delete X.days['2026-10-20'].from; }],
    ['a lock on another day', X => { X.days['2026-10-22'].lock = '2026-10-24T23:00:00.000Z'; }],
    ['a leg left to settle that the state settles', X => { X.days['2026-10-21'].grade.med.legs[2] = null; X.days['2026-10-21'].grade.med = SG.levelOf(X.days['2026-10-21'].tiers.med, X.days['2026-10-21'].grade.med.legs); }],
    ['other levels', X => { X.tiers = X.tiers.concat([['xtrm', 'Extreme', 5, 0.05]]); }],
  ];
  for (const [what, f] of broken) { const X = clone(L); f(X); chk(SG.check(X, L, st, now).length > 0, `the check fails ${what}`); }
  /* a job's day new since the last ledger and already locked: a backdated day, refused; a replay's is the one way in */
  { const X = clone(L); X.days['2026-10-19'] = clone(X.days['2026-10-21']); Object.assign(X.days['2026-10-19'], { date: '2026-10-19', lock: '2026-10-19T23:00:00.000Z', taken: '2026-10-19T16:00:00.000Z' });
    chk(SG.check(X, L, st, now).some(b => /new since the last ledger/.test(b)), 'the check fails a job\'s day new since the last ledger and already locked'); }
  /* a final ESPN corrects is graded again, and the check takes it against the last ledger */
  { const st3 = clone(st), g = st3.games.find(x => x.id === '4018000011'); g.hs = 1; g.as = 3;
    const L3 = clone(L); SG.gradeAll(L3, st3, now);
    chk(L3.days['2026-10-20'].grade.safe.legs[0] === 'loss' && L3.days['2026-10-20'].grade.safe.result === 'lost' && !SG.check(L3, L, st3, now).length, `a corrected final is graded again and passes the check (${SG.check(L3, L, st3, now).join(' | ')})`); }
  /* a day's first puck drop moved earlier, past the run: the open day locks there, taken before it */
  { const st4 = clone(st); st4.games.find(x => x.id === '4018000031').start = '2026-10-22T15:30:00.000Z';
    const first = SG.daysOf(st4); chk(first['2026-10-22'] === Date.parse('2026-10-22T15:30:00.000Z'), 'the first puck drop is the earliest start'); }
  /* a delay: a frozen call's puck drop passed, the start moved later: the day's first puck drop stays the one the call was made before */
  { const st5 = clone(st), g = st5.games.find(x => x.id === '4018000031'); Object.assign(g, { start: '2026-10-23T01:00:00.000Z', frozen: '2026-10-22T20:00:00.000Z', before: '2026-10-22T23:00:00.000Z' });
    chk(SG.daysOf(st5)['2026-10-22'] === Date.parse('2026-10-22T23:00:00.000Z'), 'a delayed first game keeps the day\'s first puck drop at the one its call was made before'); }
}

/* ---------- the job's step on the real state, booted in the page ---------- */
(async () => {
  const S0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8')), PUB = Date.parse(S0.published);
  const lined = [...new Set(S0.games.filter(g => g.state === 'pre' && Date.parse(g.start) > PUB && g.line && g.line.at && Math.floor(Date.parse(g.line.at) / 6e4) === Math.floor(PUB / 6e4)).map(g => g.date))].sort();
  if (!lined.length) { console.log('  no day ahead with a fresh line in the published state: the step\'s checks skipped'); return; }
  const D = lined[0], onD = S0.games.filter(g => g.date === D).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)), first = Date.parse(onD[0].start);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nhl-suggest-'));
  try {
    /* taken before the first puck drop: exactly the page's default levels on the day */
    const s1 = await SG.step({ state: S0, data: dir, now: S0.published });
    const L1 = SG.readLedger(path.join(dir, 'suggest_ledger.json')), e1 = L1.days[D];
    const w = await SG.bootPage(JSON.stringify(S0), PUB); const want = SG.setOf(w, D); w.close();
    chk(!!e1 && e1.src === 'job' && e1.taken === S0.published && e1.lock === new Date(first).toISOString() && JSON.stringify([e1.games, e1.tiers]) === JSON.stringify([want.games, want.tiers]),
      `${D} taken at the publish, locked at its first puck drop, the page's own levels (${e1 ? Object.entries(e1.tiers).map(([k, t]) => `${k} ${t ? t.legs.length : 0}`).join(', ') : 'none'})`);
    chk(s1.tiers && s1.season === S0.season, 'the step returns the record');
    /* a later run before the lock with a price moved: rewritten */
    const S2 = clone(S0), pub2 = new Date(Math.min(first - 60000, PUB + 3600000)).toISOString().slice(0, 16) + ':00.000Z'; S2.published = pub2;
    for (const g of S2.games) if (g.line && Math.floor(Date.parse(g.line.at) / 6e4) === Math.floor(PUB / 6e4)) g.line.at = pub2;
    for (const x of Object.values((S2.props && S2.props.games) || {})) if (x && x.dk) x.dk.at = pub2;          // the run reads the player lines again too
    /* a team leg of a level (nhl v18: a level can hold player lines) has its price moved */
    const L0 = e1 ? [].concat(...Object.values(e1.tiers).filter(Boolean).map(t => t.legs)).find(x => x.kind !== 'prop') : null;
    const mv = L0 && S2.games.find(g => g.id === L0.game);
    if (mv) { const k = { ml: { home: 'homeML', away: 'awayML' }, pl: { home: 'homeSpreadOdds', away: 'awaySpreadOdds' }, ou: { over: 'overOdds', under: 'underOdds' } }[L0.kind][L0.side]; mv.line[k] += 5; }
    await SG.step({ state: S2, data: dir, now: pub2 });
    const e2 = SG.readLedger(path.join(dir, 'suggest_ledger.json')).days[D];
    chk(!!e2 && (mv ? e2.taken === pub2 && JSON.stringify(e2.tiers) !== JSON.stringify(e1.tiers) : true), `a run before the lock with a price moved rewrites the day (${e2 && e2.taken})`);
    /* the first run at the puck drop: locked, nothing taken again though the state moves on */
    const S3 = clone(S2), pub3 = new Date(first + 60000).toISOString(); S3.published = pub3;
    for (const g of S3.games) if (g.line) { g.line.at = pub3; if (g.line.homeML) g.line.homeML += 7; }
    await SG.step({ state: S3, data: dir, now: pub3 });
    const L3 = SG.readLedger(path.join(dir, 'suggest_ledger.json')), e3 = L3.days[D];
    chk(!!e3 && JSON.stringify([e3.taken, e3.tiers]) === JSON.stringify([e2.taken, e2.tiers]) && !!e3.grade, 'at the first puck drop the day is locked as the last run left it, and graded (pending)');
    chk(!SG.check(L3, SG.readLedger(path.join(dir, 'suggest_ledger.json')), S3, Date.parse(pub3)).length, `the locked ledger passes the check (${SG.check(L3, null, S3, Date.parse(pub3)).join(' | ')})`);
    /* made-up finals: every game of the day 3-2 to the home side in regulation */
    const S4 = clone(S3), pub4 = new Date(first + 30 * 3600000).toISOString(); S4.published = pub4;
    for (const g of S4.games) if (g.date === D) Object.assign(g, { state: 'final', hs: 3, as: 2, periods: 3 });
    /* and their box scores for the levels' player lines (nhl v18): every skater blanked, every goalie 20 saves */
    S4.box = { from: D, games: {} };
    for (const t of Object.values(e3.tiers).filter(Boolean)) for (const L of t.legs) if (L.kind === 'prop') { const b = S4.box.games[L.game] || (S4.box.games[L.game] = { s: {}, g: {} }); if (L.stat === 'sv') b.g[L.pid] = 20; else b.s[L.pid] = [0, 0, 0, 0]; }
    const s4 = await SG.step({ state: S4, data: dir, now: pub4 });
    const e4 = SG.readLedger(path.join(dir, 'suggest_ledger.json')).days[D];
    const propMine = L => { const x = L.stat === 'sv' ? 20 : 0; return L.mk === 'yes' ? (x >= L.k ? 'win' : 'loss') : x > L.line ? (L.side === 'over' ? 'win' : 'loss') : x < L.line ? (L.side === 'under' ? 'win' : 'loss') : 'push'; };
    const mine = id => { const t = e4.tiers[id]; if (!t) return null; const legs = t.legs.map(L => L.kind === 'prop' ? propMine(L) : L.kind === 'ou' ? (5 > L.line ? (L.side === 'over' ? 'win' : 'loss') : 5 < L.line ? (L.side === 'under' ? 'win' : 'loss') : 'push') : L.kind === 'ml' ? (L.side === 'home' ? 'win' : 'loss') : ((L.side === 'home' ? 1 : -1) + L.line > 0 ? 'win' : 'loss')); return legs; };
    chk(SG.TIERS.every(([id]) => !e4.tiers[id] || JSON.stringify(e4.grade[id].legs) === JSON.stringify(mine(id))), `every leg graded on its own number by this test's own sums (${SG.TIERS.map(([id]) => e4.tiers[id] ? `${id} ${e4.grade[id].result}` : `${id} none`).join(', ')})`);
    { const L4 = SG.readLedger(path.join(dir, 'suggest_ledger.json')); chk(JSON.stringify(s4) === JSON.stringify(Object.assign(SG.summarize(L4, S4.season), { sets: SG.current(L4, Date.parse(S4.published)) })) && Object.keys(s4.sets).length > 0, 'the record returned is the ledger\'s, with its current days'); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { checks++; fails.push('threw: ' + (e.stack || e)); }).finally(() => {
  for (const f of fails) console.log('  FAIL ' + f);
  console.log(`test suggest: ${checks} checks, ${fails.length} failures`);
  process.exit(fails.length ? 1 : 0);
});
