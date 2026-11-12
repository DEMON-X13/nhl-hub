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
/* ---------- the summary and the check, on a ledger of made-up days ----------
   Four days: 10-19 replayed and 10-20 the job's, both by the v30 rule (Safe a pair, Medium 3 legs, no Aggressive); the header moved to
   the rule of nhl v31 by the run of 10-20 20:00; 10-21 the job's by the new rule and graded; 10-22 by it and still to lock */
const r4 = x => Math.round(x * 1e4) / 1e4, decOf = am => am > 0 ? 1 + am / 100 : 1 + 100 / -am;
const leg = (id, price, p, fair) => ({ id, game: id.split('|')[0], kind: id.split('|')[2], side: id.split('|')[1], line: id.endsWith('|ml') ? null : id.endsWith('|pl') ? (id.includes('|home|') ? -1.5 : 1.5) : 5.5, price, other: -price, p, fair, edge: 0.06, thin: false, mu: 'A @ B', start: '2026-10-20T23:00:00Z' });
const prods = legs => ({ legs, p: r4(legs.reduce((a, x) => a * x.p, 1)), fair: r4(legs.reduce((a, x) => a * x.fair, 1)), dec: r4(legs.reduce((a, x) => a * decOf(x.price), 1)) });
const MIN = { safe: 2.1, med: 4, aggr: 8 };
const tier = legs => Object.assign(prods(legs), { likeliest: false });                                   // a level of the v30 rule
const newTier = (legs, id) => Object.assign(prods(legs), { pick: 'likeliest-any', minDec: MIN[id], chance: 'model' });   // of nhl v31's
const two = gs => [leg(`${gs[0]}|home|ml`, -150, 0.66, 0.58), leg(`${gs[1]}|over|ou`, -110, 0.56, 0.5)];
const three = gs => two(gs).concat([leg(`${gs[2]}|away|pl`, -200, 0.72, 0.64)]);
const long = gs => [leg(`${gs[0]}|away|ml`, 120, 0.48, 0.44), leg(`${gs[1]}|over|ou`, 150, 0.46, 0.38), leg(`${gs[2]}|home|pl`, 100, 0.5, 0.48)];
const v30day = (d, gs, src) => ({ date: d, lock: `${d}T23:00:00.000Z`, taken: `${d}T16:00:00.000Z`, src: src || 'job', games: gs, tiers: { safe: tier(two(gs)), med: tier(three(gs)), aggr: null } });
const newDay = (d, gs) => ({ date: d, lock: `${d}T23:00:00.000Z`, taken: `${d}T16:00:00.000Z`, src: 'job', games: gs, tiers: { safe: newTier(two(gs), 'safe'), med: newTier(three(gs), 'med'), aggr: newTier(long(gs), 'aggr') } });
const G = d => [1, 2, 3].map(i => `40180000${{ 19: 0, 20: 1, 21: 2, 22: 3 }[+d.slice(8)]}${i}`);
const pending = [];                                       // the checks on the step that run before the end-to-end ones
{
  const fin = (id, date, hs, as) => ({ id, date, state: 'final', hs, as });
  const st = { season: 2027, published: '2026-10-22T16:00:00.000Z', games: [
    fin('4018000001', '2026-10-19', 3, 1), fin('4018000002', '2026-10-19', 4, 3), fin('4018000003', '2026-10-19', 2, 1),
    fin('4018000011', '2026-10-20', 1, 2), fin('4018000012', '2026-10-20', 5, 2), fin('4018000013', '2026-10-20', 3, 2),
    fin('4018000021', '2026-10-21', 3, 1), fin('4018000022', '2026-10-21', 4, 3), fin('4018000023', '2026-10-21', 2, 1),
    ...G('2026-10-22').map(id => ({ id, date: '2026-10-22', state: 'pre', hs: null, as: null })) ] };
  const L = SG.blank(); L.tiers = SG.TIERS_V30;
  L.days['2026-10-19'] = v30day('2026-10-19', G('2026-10-19'), 'replay'); L.days['2026-10-19'].from = { commit: 'a'.repeat(40), published: '2026-10-19T15:00:00.000Z' };
  L.days['2026-10-20'] = v30day('2026-10-20', G('2026-10-20'));
  /* the change of rule: the header moved, no day touched */
  { const days = JSON.stringify(L.days); chk(SG.migrate(L, '2026-10-20T20:00:00.000Z') && JSON.stringify(L.tiers) === JSON.stringify(SG.TIERS) && JSON.stringify(L.tiersBefore) === JSON.stringify(SG.TIERS_V30) && L.changed === '2026-10-20T20:00:00.000Z' && JSON.stringify(L.days) === days && /tiersBefore/.test(L.how) && L.v === 1,
      'the change of rule moves the header (tiers, tiersBefore, how, changed) and touches no day; v stays 1');
    chk(!SG.migrate(L, '2026-10-21T20:00:00.000Z') && L.changed === '2026-10-20T20:00:00.000Z', 'a header moved already is not moved again'); }
  L.days['2026-10-21'] = newDay('2026-10-21', G('2026-10-21'));
  L.days['2026-10-22'] = newDay('2026-10-22', G('2026-10-22'));
  const now = Date.parse(st.published);
  SG.gradeAll(L, st, now);
  /* 10-19: home ml 3-1 win, over 5.5 on 7 win -> Safe won; away +1.5 on a 1-goal loss win -> Medium won. 10-20: home ml lost -> both
     lost. 10-21 (the new rule): Safe and Medium won as 10-19's; Aggressive's away moneyline lost */
  chk(L.days['2026-10-19'].grade.safe.result === 'won' && L.days['2026-10-19'].grade.med.result === 'won' && L.days['2026-10-20'].grade.safe.result === 'lost'
    && L.days['2026-10-21'].grade.safe.result === 'won' && L.days['2026-10-21'].grade.med.result === 'won' && L.days['2026-10-21'].grade.aggr.result === 'lost' && !L.days['2026-10-22'].grade,
    `graded as the finals say, the day to come not graded (${JSON.stringify([L.days['2026-10-19'].grade, L.days['2026-10-20'].grade, L.days['2026-10-21'].grade])})`);
  const s = SG.summarize(L, 2027);
  chk(s.since === '2026-10-19' && s.days === 3 && s.tiers.safe.won === 2 && s.tiers.safe.lost === 1 && s.tiers.med.won === 2 && s.tiers.med.lost === 1 && s.tiers.aggr.none === 2 && s.tiers.aggr.lost === 1 && s.tiers.safe.replay === 1,
    `the summary counts each day once over both rules, Aggressive none on the v30 days, the replayed day said (${JSON.stringify(s.tiers.safe)})`);
  const d19 = L.days['2026-10-19'].tiers, d21 = L.days['2026-10-21'].tiers;
  chk(Math.abs(s.tiers.safe.units - (d19.safe.dec - 1 - 1 + d21.safe.dec - 1)) < 1e-4 && Math.abs(s.tiers.safe.exp_model - (d19.safe.p + L.days['2026-10-20'].tiers.safe.p + d21.safe.p)) < 1e-4, 'units on 1 a day and the wins the model expected, over every era');
  /* the eras: each rule's own days apart, keyed by its rule */
  const eS = s.tiers.safe.eras, eA = s.tiers.aggr.eras;
  chk(JSON.stringify(Object.keys(eS).sort()) === JSON.stringify(['likeliest-any 2.1 model', 'v30']) && eS.v30.from === '2026-10-19' && eS.v30.to === '2026-10-20' && eS.v30.graded === 2 && eS.v30.won === 1 && eS.v30.lost === 1
    && Math.abs(eS.v30.units - (d19.safe.dec - 2)) < 1e-4 && eS['likeliest-any 2.1 model'].from === '2026-10-21' && eS['likeliest-any 2.1 model'].won === 1 && Math.abs(eS['likeliest-any 2.1 model'].units - (d21.safe.dec - 1)) < 1e-4
    && JSON.stringify(Object.keys(eA)) === JSON.stringify(['likeliest-any 8 model']) && eA['likeliest-any 8 model'].lost === 1 && Math.abs(eA['likeliest-any 8 model'].exp_fair - d21.aggr.fair) < 1e-4,
    `each level's eras keep the rules apart (${JSON.stringify(eS)})`);
  chk(['graded', 'won', 'lost', 'push'].every(k => ['safe', 'med', 'aggr'].every(id => Object.values(s.tiers[id].eras).reduce((a, E) => a + E[k], 0) === s.tiers[id][k])), 'the eras add up to each level\'s whole record');
  chk(JSON.stringify(s.change) === JSON.stringify({ at: '2026-10-20T20:00:00.000Z', from: '2026-10-21' }) && SG.summarize(Object.assign(SG.blank(), { days: L.days }), 2027).change === null, `the change: the publish that moved the header and the first day by the new rule; none on a ledger begun under it (${JSON.stringify(s.change)})`);
  chk(!SG.check(L, clone(L), st, now).length, `a sound ledger passes the check (${SG.check(L, clone(L), st, now).join(' | ')})`);
  /* a settled leg holds once its game has left the schedule */
  const st2 = clone(st); st2.games = st2.games.filter(g => g.id !== '4018000001');
  const L2 = clone(L); SG.gradeAll(L2, st2, now);
  chk(JSON.stringify(L2.days['2026-10-19'].grade) === JSON.stringify(L.days['2026-10-19'].grade) && !SG.check(L2, L, st2, now).length, 'a settled leg holds when its game leaves the schedule');
  /* broken ledgers the check fails, each for its own reason */
  const D22 = X => X.days['2026-10-22'], G13 = Array.from({ length: 13 }, (_, i) => `40180000${50 + i}`);
  const broken = [
    ['a locked day moved', /moved since/, X => { X.days['2026-10-20'].tiers.safe.legs[0].price = -140; }],
    ['a locked day gone', /gone/, X => { delete X.days['2026-10-20']; }],
    ['a settled leg moved', /settled leg's grade moved/, X => { X.days['2026-10-20'].grade.safe.legs[0] = 'win'; X.days['2026-10-20'].grade.safe = SG.levelOf(X.days['2026-10-20'].tiers.safe, X.days['2026-10-20'].grade.safe.legs); }],
    ['a grade not its legs\'', /its legs give/, X => { X.days['2026-10-20'].grade.safe.result = 'won'; }],
    ['taken after its lock', /not before its lock/, X => { D22(X).taken = '2026-10-22T23:30:00.000Z'; }],
    ['a v30 level of the wrong size', /not 3 legs/, X => { X.days['2026-10-19'].tiers.med.legs.pop(); }],
    ['two legs of one game', /two legs of one game/, X => { const t = D22(X).tiers.safe; t.legs[1] = leg('4018000031|over|ou', -110, 0.56, 0.5); D22(X).tiers.safe = newTier(t.legs, 'safe'); }],
    ['a leg on another day\'s game', /not on the day's games/, X => { const t = D22(X).tiers.safe; t.legs[0] = leg('4018000001|home|ml', -150, 0.66, 0.58); D22(X).tiers.safe = newTier(t.legs, 'safe'); }],
    ['a chance not its legs\'', /chance or price is not its legs'/, X => { D22(X).tiers.safe.p = 0.5; }],
    ['graded before its lock', /graded before its lock/, X => { D22(X).grade = { safe: { result: 'pending', legs: [null, null] } }; }],
    ['a replay with no commit', /replay with no commit/, X => { delete X.days['2026-10-19'].from; }],
    ['a lock on another day', /not on its own day/, X => { D22(X).lock = '2026-10-24T23:00:00.000Z'; }],
    ['a leg left to settle that the state settles', /the state gives/, X => { X.days['2026-10-20'].grade.med.legs[2] = null; X.days['2026-10-20'].grade.med = SG.levelOf(X.days['2026-10-20'].tiers.med, X.days['2026-10-20'].grade.med.legs); }],
    ['other levels', /by either rule/, X => { X.tiers = X.tiers.concat([['xtrm', 'Extreme', 2, 0, 16]]); }],
    /* nhl v31: each level by its own rule, the eras never mixed, no going back */
    ['a 13-leg level of the new rule', /13 legs, not 2 to 12/, X => { D22(X).games = G13; D22(X).tiers.aggr = newTier(G13.map(g => leg(`${g}|home|ml`, -110, 0.6, 0.5)), 'aggr'); }],
    ['a level under its least price', /under its least price 8/, X => { D22(X).tiers.aggr = newTier(two(G('2026-10-22')), 'aggr'); }],
    ['the wrong least price for its level', /its least price 2.1, not Medium's 4/, X => { D22(X).tiers.med.minDec = 2.1; }],
    ['a pick with no chance', /ranked by undefined/, X => { delete D22(X).tiers.safe.chance; }],
    ['a fair chance not its legs\'', /fair chance 0.9 is not its legs'/, X => { D22(X).tiers.safe.fair = 0.9; }],
    ['an entry mixing the two rules', /mixing the two rules/, X => { D22(X).tiers.med = tier(three(G('2026-10-22'))); }],
    ['a v30 level taken after a new one', /a v30 level taken .* after a job's level of the new rule/, X => { X.days['2026-10-23'] = Object.assign(clone(X.days['2026-10-20']), { date: '2026-10-23', lock: '2026-10-23T23:00:00.000Z', taken: '2026-10-22T15:00:00.000Z' }); delete X.days['2026-10-23'].grade; }],
    ['a header gone back to the rule before', /went back/, X => { X.tiers = SG.TIERS_V30; delete X.tiersBefore; delete X.changed; }],
    ['the change of rule re-dated', /change of rule moved/, X => { X.changed = '2026-10-21T20:00:00.000Z'; }],
    ['a v30 level in a ledger begun under the new rule', /begun under the new one/, X => { delete X.tiersBefore; delete X.changed; }],
    ['a header with v: 2', /not a v1 ledger/, X => { X.v = 2; }],
  ];
  for (const [what, rx, f] of broken) { const X = clone(L); f(X); const b = SG.check(X, L, st, now); chk(b.some(x => rx.test(x)), `the check fails ${what} (${b.join(' | ').slice(0, 300) || 'passed'})`); }
  /* a ledger still of the v30 rule (an older job's) passes as it is; one of the new rule under it does not */
  { const X = clone(L); X.tiers = SG.TIERS_V30; delete X.tiersBefore; delete X.changed; delete X.days['2026-10-21']; delete X.days['2026-10-22'];
    const P = clone(X); chk(!SG.check(X, P, st, now).length, `an older job's ledger, all of the v30 rule under its own header, passes (${SG.check(X, P, st, now).join(' | ')})`); }
  /* a header with v: 2 on disk stops the run loudly and is never read as a blank ledger (which the run would then write over the record) */
  { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nhl-suggest-v2-')), f = path.join(dir, 'suggest_ledger.json'), X = clone(L); X.v = 2; fs.writeFileSync(f, JSON.stringify(X));
    let threw = null; try { SG.readLedger(f); } catch (e) { threw = e.message; }
    chk(!!threw && /not a v1 ledger/.test(threw), `a v2 ledger on disk is refused, never read as blank (${threw || 'read'})`);
    fs.writeFileSync(path.join(dir, 'junk.json'), '{"v":1,'); let threwJ = null; try { SG.readLedger(path.join(dir, 'junk.json')); } catch (e) { threwJ = e.message; }
    chk(!!threwJ && JSON.stringify(SG.readLedger(path.join(dir, 'none.json'))) === JSON.stringify(SG.blank()), 'a ledger that is not JSON is refused, and only a missing one reads as blank');
    pending.push(SG.step({ state: st, data: dir, now: st.published }).then(() => { checks++; fails.push('the step ran over a v2 ledger'); }, e => chk(/not a v1 ledger/.test(e.message) && JSON.stringify(JSON.parse(fs.readFileSync(f, 'utf8'))) === JSON.stringify(X), `the step stops on a v2 ledger and leaves it as it was (${e.message})`))
      .finally(() => fs.rmSync(dir, { recursive: true, force: true })));
  }
  /* a job's day new since the last ledger and already locked: a backdated day, refused; a replay's is the one way in */
  { const X = clone(L); X.days['2026-10-18'] = clone(X.days['2026-10-20']); Object.assign(X.days['2026-10-18'], { date: '2026-10-18', lock: '2026-10-18T23:00:00.000Z', taken: '2026-10-18T16:00:00.000Z' });
    chk(SG.check(X, L, st, now).some(b => /new since the last ledger/.test(b)), 'the check fails a job\'s day new since the last ledger and already locked'); }
  /* a final ESPN corrects is graded again, and the check takes it against the last ledger */
  { const st3 = clone(st), g = st3.games.find(x => x.id === '4018000001'); g.hs = 1; g.as = 3;
    const L3 = clone(L); SG.gradeAll(L3, st3, now);
    chk(L3.days['2026-10-19'].grade.safe.legs[0] === 'loss' && L3.days['2026-10-19'].grade.safe.result === 'lost' && !SG.check(L3, L, st3, now).length, `a corrected final is graded again and passes the check (${SG.check(L3, L, st3, now).join(' | ')})`); }
  /* a day's first puck drop moved earlier, past the run: the open day locks there, taken before it */
  { const st4 = clone(st); st4.games.find(x => x.id === '4018000031').start = '2026-10-22T15:30:00.000Z';
    const first = SG.daysOf(st4); chk(first['2026-10-22'] === Date.parse('2026-10-22T15:30:00.000Z'), 'the first puck drop is the earliest start'); }
  /* a delay: a frozen call's puck drop passed, the start moved later: the day's first puck drop stays the one the call was made before */
  { const st5 = clone(st), g = st5.games.find(x => x.id === '4018000031'); Object.assign(g, { start: '2026-10-23T01:00:00.000Z', frozen: '2026-10-22T20:00:00.000Z', before: '2026-10-22T23:00:00.000Z' });
    chk(SG.daysOf(st5)['2026-10-22'] === Date.parse('2026-10-22T23:00:00.000Z'), 'a delayed first game keeps the day\'s first puck drop at the one its call was made before'); }
}

/* ---------- the job's step on the real state, booted in the page ---------- */
(async () => {
  await Promise.all(pending);
  const S0 = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8')), PUB = Date.parse(S0.published);
  /* the first day still open at the publish: a fresh line on a game to come, and the day's own first puck drop (the job's rule, SG.daysOf)
     still ahead. A state published in the evening has games to come on a day whose first puck drop has passed: the step rightly takes no
     set for that day (it locked before this run), so it is not the day to try the step on (the state of 12 November 2026, 00:57Z, failed
     this test on 11 November's late games with the step right) */
  const firstOf = SG.daysOf(S0);
  const lined = [...new Set(S0.games.filter(g => g.state === 'pre' && Date.parse(g.start) > PUB && g.line && g.line.at && Math.floor(Date.parse(g.line.at) / 6e4) === Math.floor(PUB / 6e4)).map(g => g.date))].filter(d => firstOf[d] > PUB).sort();
  if (!lined.length) { console.log('  no day still open with a fresh line in the published state: the step\'s checks skipped'); return; }
  const D = lined[0], onD = S0.games.filter(g => g.date === D).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)), first = Date.parse(onD[0].start);
  /* the change of rule on the real state (nhl v31): a ledger still of the v30 rule, holding a locked day of the real record by it and the
     open day D taken by it at an earlier run, goes through the job's step at the publish: the header moves, D is rewritten by the new
     rule (the page's own levels, every one carrying its rule), the locked day stays byte for byte, and the check passes against it */
  {
    const real = fs.existsSync(path.join(ROOT, 'data', 'suggest_ledger.json')) ? SG.readLedger(path.join(ROOT, 'data', 'suggest_ledger.json')) : SG.blank();
    const old = Object.keys(real.days).sort().reverse().find(d => Date.parse(real.days[d].lock) <= PUB && SG.ruleOfEntry(real.days[d]) === 'v30');
    const w0 = await SG.bootPage(JSON.stringify(S0), PUB);
    const t0 = Date.now(), want = SG.setOf(w0, D), ms = Date.now() - t0; w0.close();
    const levels = SG.TIERS.filter(([id]) => want.tiers[id]).length;
    console.log(`  ${D}: the page's three levels in ${ms} ms (${levels} drawn: ${SG.TIERS.map(([id]) => want.tiers[id] ? `${id} ${want.tiers[id].legs.length} legs` : `${id} none`).join(', ')})`);
    chk(ms < 500, `the page's levels for a day come in well under the job's budget, 50 ms a level (${ms} ms for the day's three, the pool included)`);
    const src = [].concat(...SG.TIERS.map(([id]) => want.tiers[id] ? [want.tiers[id].legs] : []))[0];
    if (!src || src.length < 2) console.log(`  ${D} has no parlay to stand in for a v30 level: the change of rule on the real state is not tried`);
    else {
      const v30 = { legs: src.slice(0, 2).map(x => clone(x)) }; Object.assign(v30, { p: Math.round(v30.legs[0].p * v30.legs[1].p * 1e4) / 1e4, fair: v30.legs.some(x => x.fair === null) ? null : Math.round(v30.legs[0].fair * v30.legs[1].fair * 1e4) / 1e4,
        dec: Math.round(v30.legs.reduce((a, x) => a * (x.price > 0 ? 1 + x.price / 100 : 1 + 100 / -x.price), 1) * 1e4) / 1e4, likeliest: false });
      const L0 = { v: 1, how: 'the record before nhl v31', tiers: SG.TIERS_V30, days: {} };
      if (old) L0.days[old] = clone(real.days[old]);
      L0.days[D] = { date: D, lock: new Date(firstOf[D]).toISOString(), taken: new Date(PUB - 3600000).toISOString(), src: 'job', games: want.games, tiers: { safe: v30, med: null, aggr: null } };
      const dirV = fs.mkdtempSync(path.join(os.tmpdir(), 'nhl-suggest-v30-'));
      try {
        SG.write(path.join(dirV, 'suggest_ledger.json'), L0);
        const prevV = SG.readLedger(path.join(dirV, 'suggest_ledger.json'));
        await SG.step({ state: S0, data: dirV, now: S0.published });
        const L1 = SG.readLedger(path.join(dirV, 'suggest_ledger.json')), e = L1.days[D];
        chk(JSON.stringify(L1.tiers) === JSON.stringify(SG.TIERS) && JSON.stringify(L1.tiersBefore) === JSON.stringify(SG.TIERS_V30) && L1.changed === S0.published && L1.v === 1,
          `the first run of the new page moves the ledger's header itself: tiers, tiersBefore, changed ${L1.changed}, v still 1`);
        chk(!!e && e.taken === S0.published && SG.ruleOfEntry(e) === 'new' && JSON.stringify([e.games, e.tiers]) === JSON.stringify([want.games, want.tiers]) && SG.TIERS.every(([id, , , , m]) => !e.tiers[id] || (e.tiers[id].pick === 'likeliest-any' && e.tiers[id].minDec === m && e.tiers[id].chance === 'model' && e.tiers[id].likeliest === undefined)),
          `${D}, taken by the v30 rule and still open, is rewritten by the new rule, the page's own levels, each carrying its rule (${e ? SG.TIERS.map(([id]) => e.tiers[id] ? `${id} ${SG.ruleKey(e.tiers[id])}` : `${id} none`).join(', ') : 'gone'})`);
        if (old) chk(JSON.stringify(L1.days[old]) === JSON.stringify(L0.days[old]), `${old}, locked by the v30 rule, is kept byte for byte`);
        else console.log('  the real record has no locked day of the v30 rule: the byte-for-byte check is not tried');
        const bad = SG.check(L1, prevV, S0, PUB); chk(!bad.length, `the ledger after the change passes the check against the one before (${bad.join(' | ')})`);
        const sum = SG.summarize(L1, S0.season); chk(sum.change && sum.change.at === S0.published && sum.change.from === D, `the record says the change: ${JSON.stringify(sum.change)}`);
      } finally { fs.rmSync(dirV, { recursive: true, force: true }); }
    }
  }
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
    /* five toward the favourite (-135 to -140, +114 to +109), so the leg stays in the pool: a price moved the other way can put the model
       15 points over the fair chance, and the levels it stood in lose it (the state of 12 November 2026, 19:06Z: VAN -1.5 at -130) */
    if (mv) { const k = { ml: { home: 'homeML', away: 'awayML' }, pl: { home: 'homeSpreadOdds', away: 'awaySpreadOdds' }, ou: { over: 'overOdds', under: 'underOdds' } }[L0.kind][L0.side]; mv.line[k] = mv.line[k] < 0 || mv.line[k] >= 105 ? mv.line[k] - 5 : mv.line[k] + 5; }
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
    { const L4 = SG.readLedger(path.join(dir, 'suggest_ledger.json')), want4 = Object.assign(SG.summarize(L4, S4.season), { sets: SG.current(L4, Date.parse(S4.published)) });
      /* the current days run from the day before the run's own, so the day graded here, a day and more on, may be past them: it is in
         them at its own first puck drop (main's test asked for any current day at all and failed on the state of 12 November, 19:06Z) */
      chk(JSON.stringify(s4) === JSON.stringify(want4) && Object.keys(SG.current(L4, first)).includes(D), `the record returned is the ledger's, with its current days (${Object.keys(s4.sets).join(', ') || 'none at this clock'})`); }
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(e => { checks++; fails.push('threw: ' + (e.stack || e)); }).finally(() => {
  for (const f of fails) console.log('  FAIL ' + f);
  console.log(`test suggest: ${checks} checks, ${fails.length} failures`);
  process.exit(fails.length ? 1 : 0);
});
