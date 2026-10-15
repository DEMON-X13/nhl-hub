/* The props model's own test: the parse of ESPN's propBets, the distributions, and the record and the shadow ledger
   end to end in a scratch folder, each check with the broken case it must catch.

    node tools/test_props.js        must end "0 failures"

   A. The parse (tools/espn.js propBets and propsOf): the first item of a main line is the Over, checked with the ladder
      on the recorded answer (tools/fixtures/espn_propbets.json) and on made-up pairs (a contradicted pair left out, a
      near-even one kept, a group of one or three and a pair apart left out); the Yes markets, a duplicate kept once,
      team markets and junk skipped; pages read on and joined; a 404 an answer of none; a body not in the feed's shape,
      a request that fails, each a failure to ask again; every athlete by his ESPN id.
   B. The distributions (props.js dist and pOver): every one parts of 10,000 summing to exactly 10,000, its ladder
      never rising, its tail at one and its mean the negative binomial's or the normal's own, worked out here.
   C. The job's step in a scratch copy of the data, on the real schedule, players.json and the fitted constants: the bar
      written before the first call; a call for every game projected, number for number props.json's; a run at a puck
      drop freezing that game's call unchanged; the game made final with a box score and closing props planted, graded
      line by line against this file's own sums (a player who did not play void, one not projected left out);
      props_check.js clean after each run and failing on each broken ledger (a frozen mean moved, a grade changed, the
      bar changed or registered late, a frozen call gone or open again, a call made after its puck drop, a verdict
      written early, the summary off); the verdict worked on made-up ledgers of 12,000 lines (a PASS, a FAIL on each
      leg of the bar); a FAIL stopping new calls; constants not the registered ones making no new call. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const ROOT = path.join(__dirname, '..'), DATA = path.join(ROOT, 'data');
const E = require('./espn');
const P = require('./props');
const PC = require('./props_check');

const fails = []; let checks = 0;
const chk = (ok, msg) => { checks++; if (!ok) fails.push(msg); };
const J = x => JSON.stringify(x);
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'nhl-props-'));
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const implied = am => am > 0 ? 100 / (am + 100) : -am / (-am + 100);

/* ---------- A. the parse ---------- */
async function partA() {
  console.log('A. the parse');
  const ref = id => ({ $ref: `http://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/seasons/2027/athletes/${id}?lang=en&region=us` });
  const item = (type, id, price, total, target) => Object.assign({ type: { id: '1', name: type }, odds: { american: { value: price }, total: total === undefined ? {} : { value: String(total) } } },
    id ? { athlete: ref(id) } : {}, target !== undefined ? { current: { target: { value: target, displayValue: target + '+' } } } : {});
  const items = [
    item('Total Points', '101', '+220', 0.5), item('Total Points', '101', '-300', 0.5),             // the Over first
    item('Points Milestones', '101', '+220', '1+', 1),
    item('Total Shots on Goal', '102', '+150', 2.5), item('Total Shots on Goal', '102', '-190', 2.5),   // the ladder names the second: contradicted
    item('Shots on Goal Milestones', '102', '-190', '3+', 3),
    item('Total Assists', '103', '-110', 0.5), item('Total Assists', '103', '-118', 0.5),        // near even, the ladder the second's: kept
    item('Assists Milestones', '103', '-118', '1+', 1),
    item('Total Blocked Shots', '104', '-120', 1.5),                                               // a group of one
    item('Total Saves', '105', '-115', 24.5), item('Total Points', '106', '+300', 0.5), item('Total Saves', '105', '-105', 24.5),   // a pair apart
    item('Total Points', '107', '-150', 0.5), item('Total Points', '107', '+120', 0.5), item('Total Points', '107', '+110', 0.5), // a group of three
    item('Anytime Goalscorer', '101', '+250'), item('To Score 2+ Goals', '101', '+1400'), item('Goals Milestones', '101', '+1500', '2+', 2),
    item('Shots on Goal Milestones', '108', 'EVEN', '2+', 2),
    item('1st Period Moneyline', null, '-150'), item('Team Total Goals (Excl OT)', null, '-110', 3.5),
    null, { foo: 1 }, item('To Score 3+ Goals', null, '+9000'), item('Total Points', '109', 'OFF', 0.5),
  ];
  const p = E.propsOf(items);
  chk(J(p.main.find(m => m[0] === '101')) === J(['101', 'pts', 0.5, 220, -300]), `a main line: the first item is the Over (${J(p.main.find(m => m[0] === '101'))})`);
  chk(!p.main.some(m => m[0] === '102') && p.skipped.contradicted === 1, 'a pair whose ladder names the second item as the Over, the two apart, is left out, never guessed');
  chk(J(p.main.find(m => m[0] === '103')) === J(['103', 'a', 0.5, -110, -118]), 'a near-even pair the ladder cannot tell apart keeps the first as the Over');
  chk(!p.main.some(m => ['104', '105', '106', '107'].includes(m[0])) && p.skipped.unpaired === 4, `a group of one, a pair apart (and the lone item between it) and a group of three are left out (${p.skipped.unpaired})`);
  chk(J(p.main.find(m => m[0] === '106')) === undefined, 'a lone item between a pair is no pair');
  chk(J(p.yes.filter(y => y[0] === '101' && y[1] === 'g')) === J([['101', 'g', 1, 250], ['101', 'g', 2, 1400]]), `the goalscorer markets: anytime is goals 1+, and 2+ named twice is kept once, the first (${J(p.yes.filter(y => y[1] === 'g'))})`);
  chk(p.yes.some(y => J(y) === J(['108', 's', 2, 100])), 'an EVEN price is +100');
  chk(p.yes.some(y => J(y) === J(['101', 'pts', 1, 220])), 'a milestone is its stat and its k');
  chk(p.skipped.junk === 4, `team markets are not read, junk items and unpriced or athlete-less ones are skipped (${p.skipped.junk})`);
  chk(E.propsOf(null).main.length === 0 && E.propsOf({}).main.length === 0, 'an answer with no list parses to nothing');
  /* the recorded answer: every main pair whose ladder exists and whose two prices are apart has the ladder's price on the Over */
  const fx = readJSON(path.join(__dirname, 'fixtures', 'espn_propbets.json'));
  const q = E.propsOf(fx.items);
  const LAD = { pts: 'Points Milestones', a: 'Assists Milestones', s: 'Shots on Goal Milestones', bs: 'Blocked Shots Milestones', sv: 'Goalkeeper Saves Milestones' };
  const lad = new Map(); for (const it of fx.items) if (Object.values(LAD).includes(it.type.name) && it.athlete) lad.set(it.type.name + '|' + /athletes\/(\d+)/.exec(it.athlete.$ref)[1] + '|' + Math.round(it.current.target.value), +String(it.odds.american.value).replace('+', ''));
  let seen = 0, agree = 0;
  for (const [a, st, L, o, u] of q.main) { const m = lad.get(LAD[st] + '|' + a + '|' + Math.floor(L + 1)); if (m === undefined || Math.abs(implied(o) - implied(u)) <= 0.15) continue; seen++; if (Math.abs(implied(m) - implied(o)) < Math.abs(implied(m) - implied(u))) agree++; }
  chk(q.main.length >= 20 && seen >= 10 && agree === seen, `on the recorded answer (${fx.items.length} items, ${q.main.length} main lines) the ladder's price is nearer the first item's wherever the pair is apart: the first is the Over (${agree} of ${seen})`);
  /* the same answer with every pair's two items swapped: the ladder now names the second, and those pairs are left out, never read backwards */
  const sw = fx.items.slice(); for (let i = 0; i + 1 < sw.length; i++) { const a = sw[i], b = sw[i + 1]; if (a.type.name === b.type.name && /^Total /.test(a.type.name) && a.athlete && b.athlete && a.athlete.$ref === b.athlete.$ref && J(a.odds.total) === J(b.odds.total)) { sw[i] = b; sw[i + 1] = a; i++; } }
  const qs = E.propsOf(sw), flipped = qs.main.filter(m => { const n = q.main.find(x => x[0] === m[0] && x[1] === m[1] && x[2] === m[2]); return n && n[3] !== m[3] && Math.abs(implied(n[3]) - implied(n[4])) > 0.15 && lad.has(LAD[m[1]] + '|' + m[0] + '|' + Math.floor(m[2] + 1)); });
  chk(qs.skipped.contradicted >= seen && !flipped.length, `swapped pairs whose ladder can tell are left out, never read backwards (${qs.skipped.contradicted} left out; ${flipped.length} read backwards)`);
  chk(q.main.every(m => /^\d+$/.test(m[0])) && q.yes.every(y => /^\d+$/.test(y[0])), 'every athlete is read by his ESPN id');
  const ids = new Set(); for (const f of fs.readdirSync(DATA).filter(f => /^box_\d+\.jsonl$/.test(f)).sort().slice(-2)) for (const l of fs.readFileSync(path.join(DATA, f), 'utf8').split('\n')) if (l) for (const s of JSON.parse(l).skaters.concat(JSON.parse(l).goalies)) ids.add(s.id);
  const known = q.main.filter(m => ids.has(m[0])).length;
  chk(known >= q.main.length * 0.9, `the recorded answer's athletes are the box scores' own ids (${known} of ${q.main.length})`);
  /* pages, 404, junk and a failure, through saved answers */
  const FX = path.join(SCRATCH, 'fx'); fs.mkdirSync(FX);
  const half = Math.floor(fx.items.length / 2);
  fs.writeFileSync(path.join(FX, 'props_900001_p1.json'), J({ count: fx.items.length, pageCount: 2, items: fx.items.slice(0, half) }));
  fs.writeFileSync(path.join(FX, 'props_900001_p2.json'), J({ count: fx.items.length, pageCount: 2, items: fx.items.slice(half) }));
  fs.writeFileSync(path.join(FX, 'props_900002_p1.json'), J({ error: { message: 'No propBets found.', code: 404 } }));
  fs.writeFileSync(path.join(FX, 'props_900003_p1.json'), J({ hello: 'not the feed' }));
  const was = process.env.NHL_FIXTURES; process.env.NHL_FIXTURES = FX;
  const r1 = await E.propBets('900001'), r2 = await E.propBets('900002'), r3 = await E.propBets('900003'), r4 = await E.propBets('900004');
  if (was === undefined) delete process.env.NHL_FIXTURES; else process.env.NHL_FIXTURES = was;
  chk(r1.status === 200 && r1.pages === 2 && r1.items.length === fx.items.length && J(E.propsOf(r1.items)) === J(q), `pages are read on and joined in order (${r1.pages} pages, ${r1.items.length} items)`);
  chk(r2.status === 404 && r2.items.length === 0, 'ESPN\'s "No propBets found" is an answer of none (404)');
  chk(r3.status === 'failed' && /shape/.test(r3.why), `a body not in the feed's shape is a failure, asked again (${r3.why})`);
  chk(r4.status === 'failed', `a request that fails is a failure, asked again (${r4.why})`);
  chk(E.PROPS_URL('1', 2) === 'https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/events/1/competitions/1/odds/100/propBets?lang=en&region=us&limit=1000&page=2', 'the feed\'s address');
}

/* ---------- B. the distributions ---------- */
function partB() {
  console.log('B. the distributions');
  const C = readJSON(path.join(DATA, 'props_model.json')).params;
  const nb0 = (mu, r) => r === null ? Math.exp(-mu) : Math.pow(r / (r + mu), r);
  let n = 0, bad = [];
  for (const r of [null, 100, 30, 10, 5, 2]) for (const mu of [0.004, 0.05, 0.3, 0.9, 1.7, 3.2, 6]) {
    const Cx = { sk: { s: { r } } }, D = P.dist('s', mu, Cx); n++;
    const sum = D.d.reduce((a, x) => a + x, 0), lad = D.d.map((_, k) => D.d.slice(k).reduce((a, x) => a + x, 0));
    if (sum !== 10000 || D.d.some(x => !Number.isInteger(x) || x < 0)) bad.push(`r ${r} mu ${mu}: sums to ${sum}`);
    if (lad.some((x, k) => k && x > lad[k - 1])) bad.push(`r ${r} mu ${mu}: a ladder that rises`);
    if (Math.abs(P.pOver(D, 0.5) - (1 - nb0(mu, r))) > 0.0002) bad.push(`r ${r} mu ${mu}: P(1+) ${P.pOver(D, 0.5)} not ${1 - nb0(mu, r)}`);
    const mean = D.d.reduce((a, x, i) => a + i * x, 0) / 10000; if (mean > mu + 0.002 || mean < mu - 0.02) bad.push(`r ${r} mu ${mu}: mean ${mean}`);
    if (P.pOver(D, D.d.length + 3) !== 0) bad.push(`r ${r} mu ${mu}: a line past the top is not 0`);
  }
  chk(!bad.length, `every skater distribution is whole, its ladder never rising, its tail and mean its own (${n} cases; ${bad.slice(0, 3).join('; ')})`);
  bad = [];
  for (const mu of [15, 18.4, 25, 31.7, 44]) {
    const D = P.dist('sv', mu, C), sd = C.gk.sd, sum = D.d.reduce((a, x) => a + x, 0);
    if (sum !== 10000 || D.lo < 0) bad.push(`saves ${mu}: sum ${sum}, lo ${D.lo}`);
    for (const L of [mu - 5.5, Math.floor(mu) + 0.5, mu + 4.5].map(x => Math.floor(x) + 0.5)) { const want = 1 - P.Phi((Math.floor(L) + 0.5 - mu) / sd); if (Math.abs(P.pOver(D, L) - want) > 0.0005) bad.push(`saves ${mu} over ${L}: ${P.pOver(D, L)} not ${want.toFixed(4)}`); }
    const mean = D.d.reduce((a, x, i) => a + (D.lo + i) * x, 0) / 10000; if (Math.abs(mean - mu) > 0.05) bad.push(`saves ${mu}: mean ${mean}`);
  }
  chk(!bad.length, `every saves distribution is whole, its Overs the normal's own rounded to whole saves (${bad.slice(0, 3).join('; ')})`);
  /* the fit's log-likelihoods are real ones: each sums to one over the counts, the log gamma its known values */
  const lgOk = [[0.5, 0.5723649429], [1, 0], [1.5, -0.1207822376], [2, 0], [3, Math.log(2)], [5, Math.log(24)], [10.5, 13.9406252194]].every(([x, v]) => Math.abs(P.lgam(x) - v) < 1e-8)
    && [3, 2, 1].every(x => Math.abs(P.lgam(x) - [Math.log(2), 0, 0][3 - x]) < 1e-8);         // the same arguments again, from the cache
  chk(lgOk, 'log gamma is right at known values, asked twice (a cache keyed by the shifted argument once returned log Gamma(x+1))');
  const sums = []; for (const r of [null, 100, 30, 10, 5, 3, 2, 1.5, 1]) for (const mu of [0.05, 0.29, 1.6, 4]) { let t = 0; for (let k = 0; k < 400; k++) t += Math.exp(P.nbLog(k, mu, r)); if (Math.abs(t - 1) > 1e-9) sums.push(`r ${r} mu ${mu}: ${t}`); }
  let tn = 0; for (let k = 0; k < 120; k++) tn += Math.exp(P.normLog(k, 25, 6.8));
  chk(!sums.length && Math.abs(tn - 1) < 1e-3, `every log-likelihood the fit searches on sums to one over the counts (${sums.slice(0, 2).join('; ')}; saves ${tn.toFixed(5)})`);
  chk(J(P.toBasis([0.3333333, 0.3333333, 0.3333334])) === J([3333, 3333, 3334]) && P.toBasis([0.5, 0.25, 0.25]).reduce((a, b) => a + b) === 10000, 'parts of 10,000 by the largest remainder');
  chk(Math.abs(P.fairOver(-140, 100) - 0.5) < 1e-12 && Math.abs(P.fairOver(160, -220) - (1 - 220 / 320)) < 1e-12, 'DraftKings\' fair chance of the Over is 1 - the Under\'s implied');
}

/* ---------- C. the job's step, the record and the ledger ---------- */
function runProps(env, args = []) {
  const r = spawnSync('node', [path.join(__dirname, 'props.js')].concat(args), { env: Object.assign({}, process.env, { GITHUB_ACTIONS: '' }, env), encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(`  [props.js${args.length ? ' ' + args.join(' ') : ''} at ${env.NHL_NOW}] exit ${r.status}\n` + out.split('\n').filter(Boolean).slice(-3).map(l => '      ' + l.slice(0, 200)).join('\n') + '\n');
  return { status: r.status, out };
}
function partC() {
  console.log('C. the record and the ledger, in a scratch copy');
  const D = path.join(SCRATCH, 'data'); fs.mkdirSync(D);
  for (const f of fs.readdirSync(DATA)) {
    if (/^box_\d+\.jsonl$/.test(f) && +f.slice(4, 8) < readJSON(path.join(ROOT, 'state.json')).season) fs.symlinkSync(path.join(DATA, f), path.join(D, f));
    else if (/^(box_\d+\.jsonl|props_\d+\.jsonl|props_model\.json|players\.json|history\.json|model\.json|teams\.json|injuries\.json|starters\.json|season_\d+\.json)$/.test(f)) fs.copyFileSync(path.join(DATA, f), path.join(D, f));
  }
  const ST = path.join(SCRATCH, 'state.json'), S0 = readJSON(path.join(ROOT, 'state.json')); fs.writeFileSync(ST, J(S0));
  const FX = path.join(SCRATCH, 'fx-c'); fs.mkdirSync(FX);
  const PJ = readJSON(path.join(D, 'players.json'));
  /* the first game to come with a lineup on both sides, at least two hours off the state's own clock */
  const pub = Date.parse(S0.published);
  const g = S0.games.filter(x => x.state === 'pre' && Date.parse(x.start) > pub + 2 * 3600000 && PJ.upcoming[x.id] && PJ.upcoming[x.id].sh !== undefined).sort((a, b) => a.start < b.start ? -1 : 1)[0];
  if (!g) { console.log('  no game to come with a lineup: the ledger\'s run-through is skipped'); return; }
  const T0 = new Date(Date.parse(g.start) - 3 * 3600000).toISOString().slice(0, 16) + 'Z', T0d = E.etDate(T0);
  const env = (now, extra) => Object.assign({ NHL_DATA: D, NHL_STATE: ST, NHL_NOW: now, NHL_TODAY: E.etDate(now), NHL_FIXTURES: FX }, extra || {});
  const LF = path.join(D, 'props_ledger.json'), OF = path.join(D, 'props.json');
  /* run 1: the first calls */
  const r1 = runProps(env(T0));
  chk(r1.status === 0, 'the job\'s step runs on the real data');
  const L1 = readJSON(LF), O1 = readJSON(OF);
  chk(J(L1.bar) === J(P.BAR) && L1.bar_registered === T0 && Object.values(L1.calls).every(c => c.called_at >= L1.bar_registered), `the bar is written into the ledger before its first call (${L1.bar_registered})`);
  chk(!!L1.calls[g.id] && !!O1.games[g.id], `${g.away}@${g.home} is projected and called`);
  const games1 = Object.keys(O1.games);
  chk(games1.length && games1.every(id => { const x = S0.games.find(y => y.id === id); return x && x.date <= E.etDate(new Date(Date.parse(T0d + 'T12:00Z') + 86400000).toISOString()); }), `only the games through tomorrow are projected (${games1.length})`);
  const shapeBad = [];
  for (const [id, row] of Object.entries(O1.games)) for (const side of ['homeP', 'awayP']) {
    if (!row[side] || !row[side].skaters.length) shapeBad.push(`${id} ${side}: no skaters`);
    for (const p of row[side].skaters) for (const k of P.STATS) { const x = p[k]; if (!x || x.d.reduce((a, b) => a + b, 0) !== 10000 || x.d.some((v, i) => i && x.d.slice(i).reduce((a, b) => a + b, 0) > x.d.slice(i - 1).reduce((a, b) => a + b, 0))) shapeBad.push(`${id} ${p.name} ${k}`); }
    const gl = row[side].goalie; if (gl && gl.sv.d.reduce((a, b) => a + b, 0) !== 10000) shapeBad.push(`${id} goalie`);
    if (L1.calls[id] && J(L1.calls[id].sk) !== J(Object.fromEntries(row.homeP.skaters.concat(row.awayP.skaters).map(p => [p.id, P.STATS.map(k => p[k].mu)])))) shapeBad.push(`${id}: the call is not props.json's`);
  }
  chk(!shapeBad.length, `props.json: every game two sides of skaters, each stat a whole distribution with a ladder that never rises, each call its numbers (${shapeBad.slice(0, 3).join('; ')})`);
  const check = (prev, now) => PC.run(D, ST, now, prev).bad;
  chk(!check(null, T0).length, 'props_check.js passes the first ledger: ' + check(null, T0).join(' | '));
  /* run 2: the puck drop passed, the game frozen as called */
  const T1 = new Date(Date.parse(g.start) + 60000).toISOString().slice(0, 16) + 'Z';
  const r2 = runProps(env(T1)); const L2 = readJSON(LF);
  chk(r2.status === 0 && L2.calls[g.id].frozen && L2.calls[g.id].frozen_at === T1 && J(Object.assign({}, L2.calls[g.id], { frozen: false, frozen_at: null })) === J(L1.calls[g.id]), `at the puck drop the call is frozen exactly as it was made (${L2.calls[g.id].frozen_at})`);
  chk(!readJSON(OF).games[g.id], 'and the game is no longer projected');
  chk(!check(L1, T1).length, 'props_check.js passes it against the last ledger: ' + check(L1, T1).join(' | '));
  /* run 3: the game final, its box score and closing props planted */
  const c = L2.calls[g.id], sk = Object.keys(c.sk), gk = Object.keys(c.gk);
  const S3 = JSON.parse(J(S0)); const row = S3.games.find(x => x.id === g.id); Object.assign(row, { state: 'final', hs: 3, as: 2, periods: 3, detail: 'Final' }); fs.writeFileSync(ST, J(S3));
  const playing = sk.slice(0, -1), sat = sk[sk.length - 1];                      // the last projected skater does not play
  const pidTeam = new Map(); const O2 = O1.games[g.id]; for (const p of O2.homeP.skaters) pidTeam.set(p.id, g.home); for (const p of O2.awayP.skaters) pidTeam.set(p.id, g.away);
  const stat = (i, k) => ({ g: i % 4 === 0 ? 1 : 0, a: i % 3 === 0 ? 1 : 0, s: i % 5, bs: i % 3, ht: 1, pptoi: 60, pm: 0 })[k];
  const box = { id: g.id, season: S0.season, type: g.type, date: g.date, home: g.home, away: g.away, hs: 3, as: 2, periods: 3, neutral: false,
    skaters: playing.map((id, i) => ({ id, name: 'P' + id, team: pidTeam.get(id), pos: 'C', toi: 900, pptoi: 60, g: stat(i, 'g'), a: stat(i, 'a'), s: stat(i, 's'), bs: stat(i, 'bs'), ht: 1, pm: 0 })),
    goalies: gk.map((id, i) => ({ id, name: 'G' + id, team: i ? g.away : g.home, toi: 3600, sa: 30 + i, ga: 2 + i })) };
  fs.appendFileSync(path.join(D, `box_${S0.season}.jsonl`), J(box) + '\n');
  const ref = id => ({ $ref: `http://x/athletes/${id}?l` });
  const pair = (type, id, L, o, u) => [{ type: { name: type }, athlete: ref(id), odds: { american: { value: String(o) }, total: { value: String(L) } } }, { type: { name: type }, athlete: ref(id), odds: { american: { value: String(u) }, total: { value: String(L) } } }];
  const items = [].concat(pair('Total Points', playing[0], 0.5, 120, -150), pair('Total Shots on Goal', playing[1], 2.5, -110, -115), pair('Total Assists', playing[2], 0.5, 200, -260),
    pair('Total Blocked Shots', playing[3], 1.5, 130, -160), pair('Total Points', sat, 0.5, 150, -190), pair('Total Points', '999999999', 0.5, 300, -400),
    gk[0] ? pair('Total Saves', gk[0], 26.5, -115, -105) : []);
  fs.writeFileSync(path.join(FX, `props_${g.id}_p1.json`), J({ count: items.length, pageCount: 1, items }));
  const T2 = new Date(Date.parse(g.start) + 4 * 3600000).toISOString().slice(0, 16) + 'Z';
  const r3 = runProps(env(T2)); const L3 = readJSON(LF);
  const rec = fs.readFileSync(path.join(D, `props_${S0.season}.jsonl`), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).find(x => x.id === g.id);
  chk(r3.status === 0 && rec && rec.status === 200 && rec.main.length === (gk[0] ? 7 : 6), `the final's closing props are recorded once (${rec && rec.main.length} main lines)`);
  const fin = L3.calls[g.id].final;
  if (!fin || !L2.calls[g.id].frozen) { chk(false, `the run-through stops: ${g.away}@${g.home} was ${L2.calls[g.id].frozen ? 'frozen' : 'never frozen'} and ${fin ? 'graded' : 'never graded'}`); return; }
  /* each grade by this file's own sums: the negative binomial or the normal at the call's mean */
  const C = L3.model.params;
  const nbOver = (mu, r, L) => { let p = r === null ? Math.exp(-mu) : Math.pow(r / (r + mu), r), cdf = 0; const q = r === null ? null : mu / (r + mu); for (let k = 0; k <= Math.floor(L); k++) { cdf += p; p = r === null ? p * mu / (k + 1) : p * (k + r) / (k + 1) * q; } return 1 - cdf; };
  const want = [];
  const xOf = (id, st) => { const b = box.skaters.find(s => s.id === id); return st === 'pts' ? b.g + b.a : b[st]; };
  for (const [id, st, L, o, u] of [[playing[0], 'pts', 0.5, 120, -150], [playing[1], 's', 2.5, -110, -115], [playing[2], 'a', 0.5, 200, -260], [playing[3], 'bs', 1.5, 130, -160]])
    want.push([id, st, L, o, u, nbOver(c.sk[id][P.STATS.indexOf(st)], C.sk[st].r, L), 1 - implied(u), xOf(id, st)]);
  if (gk[0]) want.push([gk[0], 'sv', 26.5, -115, -105, 1 - P.Phi((26.5 - c.gk[gk[0]]) / C.gk.sd), 1 - implied(-105), 28]);
  const gradeOk = fin && fin.lines.length === want.length && fin.lines.every((l, i) => J(l.slice(0, 5)) === J(want[i].slice(0, 5)) && Math.abs(l[5] - want[i][5]) < 0.0006 && Math.abs(l[6] - want[i][6]) < 1e-4 && l[7] === want[i][7]);
  chk(gradeOk, `each main line is graded on the frozen call, DraftKings' fair chance and the box score, by this file's own sums (${fin && J(fin.lines.map(l => l.slice(5)))} vs ${J(want.map(l => [+l[5].toFixed(4), +l[6].toFixed(4), l[7]]))})`);
  chk(fin && fin.voided === 1 && fin.unprojected === 1, `a player who did not play is void, one not projected is left out (${fin && fin.voided} void, ${fin && fin.unprojected} unprojected)`);
  chk(!check(L2, T2).length, 'props_check.js passes the graded ledger: ' + check(L2, T2).join(' | '));
  chk(L3.summary.graded_lines === want.length && L3.summary.compared === want.length && /of 12000/.test(L3.summary.standing) && !L3.decision, `the summary counts the graded lines toward the bar, no verdict (${L3.summary.standing})`);
  /* a run that changes nothing writes nothing */
  const before = fs.readFileSync(LF, 'utf8'); runProps(env(T2)); chk(fs.readFileSync(LF, 'utf8') === before, 'a run that changes nothing writes nothing');
  /* the check fails on each broken ledger */
  const ctx = Object.assign(PC.context(D, L3), { now: T2, finals: new Set([g.id]) });
  const broken = (name, f, prev = L2) => { const X = JSON.parse(J(L3)); f(X); const b = PC.check(X, prev, ctx); chk(b.length > 0, `props_check.js fails ${name} (${b[0] || 'it passed'})`); };
  const other = Object.keys(L3.calls).find(id => id !== g.id && !L3.calls[id].frozen);
  broken('a frozen call whose mean moved', X => { X.calls[g.id].sk[sk[0]][2] = r3x(X.calls[g.id].sk[sk[0]][2] + 0.1); });
  broken('a frozen call whose goalie moved', X => { if (gk[0]) X.calls[g.id].gk[gk[0]] += 1; else X.calls[g.id].start = T1; });
  broken('a grade whose box stat is wrong', X => { X.calls[g.id].final.lines[0][7] += 1; });
  broken('a grade whose model chance is wrong', X => { X.calls[g.id].final.lines[1][5] = 0.5; });
  broken('a grade missing a line', X => { X.calls[g.id].final.lines.pop(); });
  broken('a grade the last commit had, changed', X => { X.calls[g.id].final.graded_at = T1; }, L3);
  broken('the bar changed', X => { X.bar = Object.assign({}, X.bar, { lines: 1000 }); });
  broken('the bar registered after a call', X => { X.bar_registered = T2; });
  broken('a frozen call gone', X => { delete X.calls[g.id]; });
  broken('a frozen call open again', X => { X.calls[g.id].frozen = false; });
  broken('a call whose puck drop passed before the run, never frozen', X => { X.calls[g.id].frozen = false; X.calls[g.id].frozen_at = null; X.calls[g.id].final = null; X.summary = P.summarize(X); }, null);
  if (other) broken('a call made after its puck drop', X => { X.calls[other].called_at = new Date(Date.parse(X.calls[other].start) + 60000).toISOString().slice(0, 16) + 'Z'; });
  broken('a verdict written before the bar', X => { X.decision = { verdict: 'PASS', decided_at: T2, lines: 12000 }; });
  broken('a summary that does not follow', X => { X.summary.compared += 1; });
  broken('the registered model changed', X => { X.model.params.gk.sd += 1; });
  broken('a frozen call graded nowhere though final, boxed and recorded', X => { X.calls[g.id].final = null; X.summary = P.summarize(X); }, null);
  /* a call that was open last time and is rewritten after its puck drop */
  if (other) { const prevX = JSON.parse(J(L3)); const X = JSON.parse(J(L3)); const oc = X.calls[other]; const late = new Date(Date.parse(oc.start) + 60000).toISOString().slice(0, 16) + 'Z'; X.run_at = late; oc.called_at = late; oc.sk[Object.keys(oc.sk)[0]][0] += 0.01; const b = PC.check(X, prevX, Object.assign({}, ctx, { now: late })); chk(b.some(x => x.includes(other)), `props_check.js fails a call rewritten after its puck drop (${b[0]})`); }

  /* the verdict on made-up ledgers of 12,000 lines */
  const fake = (pmOf, priceOf) => {
    const L = JSON.parse(J(L3)); L.calls = {}; L.decision = null;
    let k = 0; const R = mul(7);
    for (let gi = 0; gi < 175; gi++) {
      const lines = [];
      for (let j = 0; j < 70; j++) { const truth = 0.2 + 0.6 * R(); const y = R() < truth ? 1 : 0; const [po, pu] = priceOf(truth, R); lines.push(['1' + j, 'pts', 0.5, po, pu, +pmOf(truth, y, R).toFixed(4), +(1 - implied(pu)).toFixed(4), y]); k++; }
      L.calls[String(800000 + gi)] = { start: `2026-11-${String(1 + (gi % 28)).padStart(2, '0')}T23:00Z`, home: 'TOR', away: 'BOS', called_at: '2026-10-31T12:00Z', v: L.model.sha, sk: {}, gk: {}, frozen: true, frozen_at: '2026-11-01T23:00Z', final: { graded_at: `2026-11-${String(2 + (gi % 27)).padStart(2, '0')}T10:${String(gi % 60).padStart(2, '0')}Z`, lines, voided: 0, unprojected: 0 } };
    }
    return L;
  };
  /* DraftKings' prices: its own chance, the truth give or take ten points, with a 6% margin all on the Over */
  const am = p => p >= 0.5 ? Math.round(-100 * p / (1 - p)) : Math.round(100 * (1 - p) / p);
  const fairPrices = (t, R) => { const m = Math.min(0.9, Math.max(0.1, t + (R() - 0.5) * 0.2)); return [am(Math.min(0.95, m + 0.06)), am(1 - m)]; };
  const good = fake((t) => t, fairPrices), bad = fake((t, y, R) => Math.min(0.97, Math.max(0.03, t + (R() - 0.5) * 0.5)), fairPrices);
  const dg = P.decide(good, '2026-12-01T00:00Z'), db = P.decide(bad, '2026-12-01T00:00Z');
  chk(dg && dg.verdict === 'PASS' && dg.scores.lines === 12000 && dg.scores.logloss_diff_ci90[1] < 0 && dg.scores.brier_diff_ci90[1] < 0 && dg.scores.bets.units > 0, `a model that knows the truth passes at 12,000 lines (${dg && dg.verdict}: log loss ${dg && J(dg.scores.logloss_diff_ci90)}, Brier ${dg && J(dg.scores.brier_diff_ci90)}, ${dg && dg.scores.bets.units} units)`);
  chk(db && db.verdict === 'FAIL', `a noisy model fails (${db && db.verdict}: log loss ${db && J(db.scores.logloss_diff_ci90)})`);
  /* a model level with a sharp market (DraftKings' chance the truth itself): no edge, no PASS */
  const sharp = fake(t => t, t => [am(Math.min(0.95, t + 0.06)), am(1 - t)]);
  const ds = P.decide(sharp, '2026-12-01T00:00Z');
  chk(ds && ds.verdict === 'FAIL', `a model no better than a sharp market fails (${ds && ds.verdict}: log loss ${ds && J(ds.scores.logloss_diff_ci90)}, ${ds && ds.scores.bets.n} bets)`);
  /* the flat bets are a leg of their own: the same better chances, but every price so shaded that no bet clears the bar */
  const shaded = fake(t => t, (t, R) => { const m = Math.min(0.9, Math.max(0.1, t + (R() - 0.5) * 0.2)); return [am(Math.min(0.97, m + 0.25)), am(Math.min(0.97, 1 - m + 0.25))]; });
  const dh = P.decide(shaded, '2026-12-01T00:00Z');
  chk(dh && dh.scores.bets.units <= 0 && dh.verdict === 'FAIL', `a better chance with no flat bet up still fails (${dh && dh.verdict}: ${dh && dh.scores.bets.n} bets ${dh && dh.scores.bets.units} units, log loss ${dh && J(dh.scores.logloss_diff_ci90)})`);
  const short = fake(t => t, fairPrices); const ids = Object.keys(short.calls); for (const id of ids.slice(170)) delete short.calls[id];
  chk(P.decide(short, '2026-12-01T00:00Z') === null, `no verdict under 12,000 lines (${P.compared(short).length})`);
  /* the check holds a written verdict to the calls, and keeps it */
  const W = JSON.parse(J(good)); W.decision = dg; W.summary = P.summarize(W);
  const ctxW = { records: new Map(), boxes: new Map(), now: '2026-12-01T00:00Z', finals: new Set() };
  const wb = PC.check(W, null, ctxW).filter(x => !/record|box score/.test(x));
  chk(!wb.length, 'props_check.js accepts the verdict the calls give: ' + wb.slice(0, 2).join(' | '));
  const W2 = JSON.parse(J(W)); W2.decision.verdict = 'PASS' === dg.verdict ? 'FAIL' : 'PASS'; W2.summary = P.summarize(W2);
  chk(PC.check(W2, null, ctxW).some(x => /verdict/.test(x)), 'and fails one that does not follow');
  const W3 = JSON.parse(J(good)); W3.summary = P.summarize(W3);
  chk(PC.check(W3, null, ctxW).some(x => /no verdict/.test(x)), 'and fails 12,000 lines with no verdict written');
  /* a FAIL stops new calls; constants not the registered ones make none */
  const F = JSON.parse(J(L3)); F.decision = Object.assign({}, db, { decided_at: T2 }); writeAs(LF, F);
  runProps(env(T0));
  const LF2 = readJSON(LF);
  chk(Object.values(LF2.calls).every(x => x.frozen) && LF2.calls[g.id] && LF2.calls[g.id].final, `after a FAIL no new call is made and the open ones are dropped; the frozen are kept and graded (${Object.keys(LF2.calls).length} calls)`);
  writeAs(LF, L3);
  const M = readJSON(path.join(D, 'props_model.json')); M.params.sk.g.M += 1; M.sha = P.shaOf(M.params); fs.writeFileSync(path.join(D, 'props_model.json'), J(M));
  const T3 = new Date(Date.parse(T2) + 60000).toISOString().slice(0, 16) + 'Z';
  const r5 = runProps(env(T3));
  const L5 = readJSON(LF);
  chk(r5.status === 0 && /not the ones the ledger registered/.test(r5.out) && Object.keys(L5.calls).every(id => L3.calls[id] && J(L5.calls[id].sk) === J(L3.calls[id].sk)), 'constants not the ones the ledger registered make no new call, and it says so');
  const M2 = readJSON(path.join(D, 'props_model.json')); M2.params.sk.g.M += 1; fs.writeFileSync(path.join(D, 'props_model.json'), J(M2));
  chk(runProps(env(T3)).status === 1, 'constants that are not the ones their sha names stop the step');
}
const r3x = x => Math.round(x * 1000) / 1000;
function mul(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function writeAs(f, L) { P.writeLedger(L, f); }

(async () => {
  await partA();
  partB();
  partC();
  console.log(`${checks} checks, ${fails.length} failures`);
  for (const f of fails) console.log('  FAIL ' + f);
  fs.rmSync(SCRATCH, { recursive: true, force: true });
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
