/* The whole job, played offline in a scratch folder, so every part of it is proved before it touches
   the real files: the freeze, the grading, the record, the standings, the lineups, the goalies, the
   playoffs, the season's rollover and the page.

    node tools/simulate.js            must end "0 failures"

   The parts, each on fixtures in the feeds' own shapes (ESPN's scoreboard, game summary and injury
   report; DailyFaceoff's page), read through NHL_FIXTURES, NHL_OUT, NHL_DATA, NHL_STATE, NHL_TEAMS,
   NHL_TODAY, NHL_NOW, NHL_SEASON and NHL_PROPS_ASK. Nothing in the repo is written (a box file the job appends to is a
   scratch copy, and the run fails itself if any file of data/ or state.json changed): the scratch folder is os.tmpdir(). What needs a
   game to come, a starter or a schedule plays what there is (last season's starters on opening night,
   last season's schedule a whole number of weeks on, at least a year, so its opening night falls on or after 1 October,
   before this one is out) or is skipped, said, so the simulation holds
   in the summer and on opening night as well as in season.

   B. Today's real data through the job: the published state, box scores and injury report are
      turned back into the feeds (the injury rows in ESPN's shape, with no athlete id field and the id
      in the player's link, some with no link at all), plus planted cases: a club's top goalie put on
      injured reserve, one of its skaters out by name only, another club's goalie listed on a third
      club's report, DailyFaceoff confirming a backup (its date written as a midnight-GMT stamp, the day
      it names), naming a goalie with no NHL game and an unconfirmed one on the day's last game, or on the next
      game day's where the day has no other for one (dated by a zone-less GMT stamp when its game is past midnight
      GMT), a stale entry from the day before, and the first night of a club's back to back postponed in the feed.
      Each case stands on what the job's own rules accept on the day it runs: only games still to come in this run
      (never last night's final, which the feed has over, nor a game the published state holds as delayed), and a
      goalie DailyFaceoff names unconfirmed is one no report has out or under another club, whose latest game was
      for his. An audit after the 26 October 2026 failure found 19 checks that some later day's real data would have
      failed with the job right. The job runs in the workflow's order (read from update.yml)
      and the smoke test holds the result to those sources (props.js among the steps: last night's final's closing props,
      planted in ESPN's prop-feed shape, recorded once and its frozen call graded; every other final the committed
      files lack answered, its box score made up from its clubs' last box lines with the shots column kept and its
      closing props ESPN's 404, props.js asking for every one, so no step stands on those files being whole; a
      projected game's start moved between the two passes, its projection left out for the run; the box summaries carry ESPN's real
      columns, its SOG shootout column planted non-zero, half of them by label alone). Then the refusals: a scoreboard day that does
      not answer (exit 1, nothing written), an injury report that does not answer or comes back empty
      (the last one kept; one in use with no rows is a broken source), DailyFaceoff silent, in a changed
      shape, or naming games that match nothing on the schedule (said, never applied, and sources.js
      fails the run), and sources.js on a props step whose every closing-props request failed (broken) or one of them (a note).
   B2. The first evening after a change: the published state's first game day with its first puck drop
      an hour gone, those games under way and not boxed, last night's over and mostly not boxed, the
      published calls an older job's; the job and the smoke against the published state must pass (the
      night after a back to back is called while its first night is under way).
   B3. Rows an older job rewrote after puck drop (margin and sides recomputed on the team Elo's margin)
      are put back to the published pre-game call, every field, the team Elo's view included.
   B4. The first game of B's first game day that the published state does not hold as delayed, called half an hour
      before its puck drop; an hour after, the feed still has it scheduled, its start moved ninety minutes on (or to
      the last minute of its own Eastern day where that is sooner; skipped, said, where even that is not after the
      second run), and the injury
      report has been re-pulled (a newer `pulled`, the goalie on the card now on injured reserve,
      DailyFaceoff confirming another): the call is kept, and the smoke against the first run passes.
   B5. A day ahead whose only game the feed moves two days on under the same id, so the day answers with
      no game: the game is on its new day and the run goes on (not "no answer", which would stop every
      run from then on).
   A. A fabricated season on the real schedule (none of the real day's props reads in it): invented scores up to a day
      about six weeks in with four games or more under way by its first puck drop and four to come after it, invented
      DraftKings lines, update.js run as the job would be: the morning the lines are up (calls made);
      the job's first pass a minute before the first puck drop (every call copied, none made) and its
      second a few minutes after, with some games under way, one still "scheduled" in the feed past its
      puck drop, one whose start the feed moved an hour later, and the lines moved, the first game to come's
      favourite flipped on purpose (calls kept; the
      smoke against the morning's state); on copies, a blank answer for the day under way (refused) and
      a partial one (games left out kept with their calls, one postponed taken off and said, one moved
      to another day called again, a blank day weeks ahead kept); the next morning (those games final
      and graded on the calls shown), and a quiet rerun (the file left alone).
   C. The same season played out, then the playoffs: the field from the final table; on a copy, ESPN's
      first round with a club the table left out in the second wild card's place (in for certain, the
      table's club out); a sweep, an upset, series under way; a club knocked out has no Cup chance and
      the bracket shows the scores; then every round to the Final, and a champion.
   D. The rollover: the first run in August closes the finished season into season_<year>.json, the
      new season's ratings are that season's carried, and a season missing everywhere is refused. */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawnSync } = require('child_process');
const E = require('./espn');
const Hist = require('./hist');
const { goals, spreadOf, coverProbs, totalProbs } = require('./elo');
const { injuriesOf, boxOf } = require('./fetch_box');

const ROOT = path.join(__dirname, '..'), REAL_DATA = path.join(ROOT, 'data');
const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
const model = JSON.parse(fs.readFileSync(path.join(REAL_DATA, 'model.json'), 'utf8'));
const SCRATCH = fs.mkdtempSync(path.join(os.tmpdir(), 'nhl-sim-'));
const SEASON = real.season;
/* every final the committed box files hold, and the finished seasons with a final they lack: those seasons' box files are copied
   into each data folder, never linked, since fetch_box.js appends to the file of the season it boxes and a link would write a box
   score made up here into the repo's own file, which the job commits */
const REAL_BOXED = new Set(); for (const f of fs.readdirSync(REAL_DATA).filter(f => /^box_\d+\.jsonl$/.test(f))) for (const l of fs.readFileSync(path.join(REAL_DATA, f), 'utf8').split('\n')) if (l) REAL_BOXED.add(JSON.parse(l).id);
const COPY_SEASONS = new Set(Hist.rows(REAL_DATA).filter(r => r.season >= 2022 && r.season < SEASON && !REAL_BOXED.has(String(r.id))).map(r => r.season));
/* the repo's own files as they were, to hold the simulation to writing none of them */
const fingerprint = () => { const o = {}; for (const f of fs.readdirSync(REAL_DATA).map(f => path.join(REAL_DATA, f)).concat([path.join(ROOT, 'state.json')])) { const st = fs.statSync(f); if (st.isFile()) o[path.relative(ROOT, f)] = st.size + ':' + st.mtimeMs; } return o; };
const BEFORE = fingerprint();

let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const poisson = l => { let k = 0, p = Math.exp(-l), s = p, u = rnd(); while (u > s) { k++; p *= l / k; s += p; } return k; };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const minute = ms => new Date(ms).toISOString().slice(0, 16) + 'Z';
/* a game the job holds as started though the feed has it to come: its call was made before a puck drop that has passed, and
   the feed moved the start less than half a day on (update.js's started(), the smoke's delayedAt) */
const delayedAt = (g, ms) => !!(g.frozen && g.before && Date.parse(g.before) <= ms && Date.parse(g.start) - Date.parse(g.before) < 12 * 3600000);
const fails = []; let checks = 0;
const chk = (ok, msg) => { checks++; if (!ok) fails.push(msg); };
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const mkdir = (...p) => { const d = path.join(SCRATCH, ...p); fs.mkdirSync(d, { recursive: true }); return d; };
/* run one of the job's scripts; its log indented under ours */
function run(script, args, env, label) {
  const r = spawnSync('node', [path.join(__dirname, script)].concat(args || []), { env: Object.assign({}, process.env, { GITHUB_ACTIONS: '' }, env), encoding: 'utf8', maxBuffer: 1 << 26 });
  const out = (r.stdout || '') + (r.stderr || '');
  process.stdout.write(`  [${label || script}${args && args.length ? ' ' + args.join(' ') : ''}] exit ${r.status}\n` + out.split('\n').filter(Boolean).slice(-6).map(l => '      ' + l.slice(0, 220)).join('\n') + '\n');
  return { status: r.status, out };
}
/* a data folder: the fixed files copied, the box scores linked (the current season's copied, since fetch_box.js appends to it) */
function dataDir(name, from = REAL_DATA) {
  const d = mkdir(name);
  /* the props model's constants (source), its ledger and the record of closing props come too, so props.js plays its part */
  for (const f of ['history.json', 'model.json', 'teams.json', 'players.json', 'props_model.json', 'props_ledger.json', 'props.json', 'corr.json', 'suggest_ledger.json', 'models.json', 'models_backtest.json', 'xparlays.json', 'xbets.json'].concat(fs.readdirSync(from).filter(f => /^(season_\d{4}\.json|props_\d{4}\.jsonl)$/.test(f)))) if (fs.existsSync(path.join(from, f))) fs.copyFileSync(path.join(from, f), path.join(d, f));
  /* this season's box scores from the folder copied (B's has last night's final boxed, which its props ledger graded), and a
     finished season's where a final of it has no box line yet */
  for (const f of fs.readdirSync(REAL_DATA).filter(f => /^box_\d+\.jsonl$/.test(f))) {
    if (+f.slice(4, 8) >= SEASON || COPY_SEASONS.has(+f.slice(4, 8))) fs.copyFileSync(path.join(fs.existsSync(path.join(from, f)) ? from : REAL_DATA, f), path.join(d, f)); else fs.symlinkSync(path.join(REAL_DATA, f), path.join(d, f));
  }
  return d;
}

/* ---------- the feeds' shapes ---------- */
const team = code => ({ id: E.CLUBS[code].id, abbreviation: code, displayName: E.CLUBS[code].name, shortDisplayName: E.CLUBS[code].name.split(' ').pop(), name: E.CLUBS[code].name.split(' ').pop(), logo: `https://a.espncdn.com/i/teamlogos/nhl/500/scoreboard/${code.toLowerCase()}.png`, color: '888888' });
const am = n => n === null || n === undefined ? undefined : (n > 0 ? '+' + n : String(n));
/* DraftKings' own ids for a line, invented the way DraftKings builds them: one market number a game, shared by
   its three markets, each id naming its side and, for a puck line or a total, its number (N150 is -1.5) */
function inventIds(g, l) {
  const n = +String(g.id).slice(-6), m = String(86000000 + n), c = x => String(Math.round(Math.abs(x) * 100));
  const o = { event: String(34000000 + n), homeML: `0ML${m}_1`, awayML: `0ML${m}_3` };
  if (l.homeLine !== null && l.homeLine !== undefined) { o.homePL = `0HC${m}${l.homeLine < 0 ? 'N' : 'P'}${c(l.homeLine)}_1`; o.awayPL = `0HC${m}${l.homeLine < 0 ? 'P' : 'N'}${c(l.homeLine)}_3`; }
  if (l.total !== null && l.total !== undefined) { o.over = `0OU${m}O${c(l.total)}_1`; o.under = `0OU${m}U${c(l.total)}_3`; }
  return o;
}
/* ESPN's wrapping of a DraftKings link: its affiliate gateway, the betslip URL in preurl (copied from a real answer) */
const GW = 'https://sportsbook.draftkings.com/gateway?s=__s__&wpcid=__wpcid__&wpsrc=413&wpcn=ESPN&wpscn=Widget&wpcrn=BetSlipDeepLink&wpscid=__wpscid__&wpcrid=xx&preurl=';
const gw = inner => ({ language: 'en-US', rel: ['desktop', 'bets', 'draftkings'], href: GW + encodeURIComponent(inner), isExternal: true });
const idsOnly = dk => { const o = {}; for (const k of ['event', 'homeML', 'awayML', 'homePL', 'awayPL', 'over', 'under']) if (dk && typeof dk[k] === 'string') o[k] = dk[k]; return o; };
/* a line this site keeps, back in ESPN's odds shape: with DraftKings' links on every outcome (its own ids, or ids
   invented for the game), or with none ({ links: false }, the shape a "Draft Kings" answer may come in) */
const oddsOfLine = (l, g, opts = {}) => {
  if (!l) return undefined;
  const dk = opts.links === false ? null : l.dk ? idsOnly(l.dk) : g ? inventIds(g, l) : null;
  const close = (o, id) => Object.assign(o, dk && dk.event && id ? { link: gw(`https://sportsbook.draftkings.com/event/${dk.event}?outcomes=${id}`) } : {});
  return [{ provider: { name: l.book || 'DraftKings' }, overUnder: l.total, link: dk && dk.event ? gw(`https://sportsbook.draftkings.com/event/${dk.event}`) : undefined,
    homeTeamOdds: { favorite: l.homeLine !== null && l.homeLine < 0 }, awayTeamOdds: { favorite: l.homeLine !== null && l.homeLine > 0 },
    moneyline: { home: { close: close({ odds: am(l.homeML) }, dk && dk.homeML) }, away: { close: close({ odds: am(l.awayML) }, dk && dk.awayML) } },
    pointSpread: l.homeLine === null || l.homeLine === undefined ? undefined : { home: { close: close({ line: am(l.homeLine), odds: am(l.homeSpreadOdds) }, dk && dk.homePL) }, away: { close: close({ line: am(-l.homeLine), odds: am(l.awaySpreadOdds) }, dk && dk.awayPL) } },
    total: { over: { close: close({ line: 'o' + l.total, odds: am(l.overOdds) }, dk && dk.over) }, under: { close: close({ line: 'u' + l.total, odds: am(l.underOdds) }, dk && dk.under) } } }];
};
/* an invented DraftKings line around the model's view, with noise, and DraftKings' ids for it; a moved line
   (shift) moves its total a goal too, so the moved line's total ids differ from the morning's */
function invented(g, shift = 0) {
  const p = Math.min(0.85, Math.max(0.15, 1 / (1 + Math.pow(10, -((g.diff || 0) + shift) / 400)) + (rnd() - 0.5) * 0.06));
  const ml = q => q >= 0.5 ? Math.round(-100 * q / (1 - q) / 5) * 5 : Math.round(100 * (1 - q) / q / 5) * 5;
  const fav = p >= 0.5;
  const total = Math.round((g.xt || 6) * 2) / 2 + (rnd() < 0.3 ? 0.5 : 0) + (shift ? 1 : 0);
  const l = { book: 'DraftKings', total, homeML: ml(p), awayML: ml(1 - p), homeLine: fav ? -1.5 : 1.5, homeSpreadOdds: fav ? 190 : -230, awaySpreadOdds: fav ? -230 : 190, overOdds: -110, underOdds: -110 };
  l.dk = inventIds(g, l);
  return l;
}
/* one game as a scoreboard event: pre, in or post */
function event(g, x = {}) {
  const st = x.state || 'pre';
  const ls = n => st === 'pre' ? [] : Array.from({ length: x.periods || 3 }, (_, i) => ({ value: i === 0 ? n : 0 }));
  const type = st === 'post' ? { state: 'post', name: 'STATUS_FINAL', completed: true, shortDetail: x.detail || (x.periods === 5 ? 'Final/SO' : x.periods === 4 ? 'Final/OT' : 'Final') }
    : st === 'in' ? { state: 'in', name: 'STATUS_IN_PROGRESS', shortDetail: x.detail || '10:00 - 2nd' } : { state: 'pre', name: 'STATUS_SCHEDULED', shortDetail: x.detail || 'scheduled' };
  return { id: String(g.id), date: g.start, season: { year: SEASON, type: x.type || 2 }, competitions: [{ date: g.start, neutralSite: !!g.neutral,
    status: { type, period: st === 'pre' ? 0 : (x.periods || 2) },
    competitors: [{ homeAway: 'home', team: team(g.home), score: String(x.hs ?? 0), linescores: ls(x.hs ?? 0), records: [{ summary: g.hrec || '0-0-0' }] },
      { homeAway: 'away', team: team(g.away), score: String(x.as ?? 0), linescores: ls(x.as ?? 0), records: [{ summary: g.arec || '0-0-0' }] }],
    odds: x.odds }] };
}
const writeDays = (dir, byDate) => { for (const [d, evs] of Object.entries(byDate)) fs.writeFileSync(path.join(dir, `sb_${d}.json`), JSON.stringify({ events: evs })); };
/* an invented final: the goals layer's means, overtime when tied, a shootout one time in three */
function score(g) {
  const G = goals(g.xt || 6, g.mu || 0, g.diff || 0, model.pull);
  let hs = poisson(G.lh), as = poisson(G.la), periods = 3;
  if (hs === as) { periods = rnd() < 0.35 ? 5 : 4; if (rnd() < G.pOT) hs++; else as++; }
  return { hs, as, periods };
}
/* a box line back into ESPN's game summary, which fetch_box.js reads */
const mmss = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
/* ESPN's skater columns in its own order, [key, label, the box line's field]; 'SOG' is SHOOTOUT goals in ESPN's
   summary, planted here non-zero on every third skater so a parser that read it as shots would be caught */
const SK_COLS = [['blockedShots', 'BS', 'bs'], ['hits', 'HT', 'ht'], ['plusMinus', '+/-', 'pm'], ['timeOnIce', 'TOI', 'toi'], ['powerPlayTimeOnIce', 'PPTOI', 'pptoi'],
  ['goals', 'G', 'g'], ['assists', 'A', 'a'], ['shotsTotal', 'S', 's'], ['shotsMissed', 'SM', null], ['shootoutGoals', 'SOG', 'so']];
const GK_COLS = [['goalsAgainst', 'GA', 'ga'], ['shotsAgainst', 'SA', 'sa'], ['shootoutSaves', 'SOS', null], ['saves', 'SV', 'sv'], ['timeOnIce', 'TOI', 'toi']];
const shootout = (s, i) => i % 3 === 0 ? 1 + (s.s || 0) : 0;
/* a box line back into ESPN's game summary, which fetch_box.js reads: every column the line has, in ESPN's order, with
   its keys beside its labels; `labelsOnly` drops the keys (the parser falls back to the labels). Its plays name each side's
   starter (`st`) making the side's first save and every other goalie a save after it, listed newest first with their
   sequence numbers, so a parser that took the list's order, or the goalie who played most, would mark the wrong one */
const playsOf = b => {
  const out = []; let seq = 1;
  for (const first of [true, false]) for (const x of b.goalies.filter(x => !!x.st === first && (first || b.goalies.some(y => y.st && y.team === x.team))))
    out.push({ sequenceNumber: String(seq++), type: { text: 'Shot' }, participants: [{ athlete: { id: '1' }, type: 'shooter' }, { athlete: { id: x.id }, type: 'saver' }] });
  return out.reverse();
};
const summaryOf = (b, labelsOnly) => ({ plays: playsOf(b), boxscore: { players: [b.home, b.away].map(code => {
  const group = (name, list) => {
    const cols = SK_COLS.filter(([, , f]) => !f || f === 'so' || list.some(s => s[f] !== undefined));
    return Object.assign({ name, labels: cols.map(c => c[1]), athletes: list.map((s, i) => ({ athlete: { id: s.id, displayName: s.name, position: { abbreviation: s.pos } },
      stats: cols.map(([, , f]) => f === 'so' ? shootout(s, i) : !f ? 0 : f === 'toi' || f === 'pptoi' ? mmss(s[f]) : s[f]).map(String) })) }, labelsOnly ? {} : { keys: cols.map(c => c[0]) });
  };
  const sk = b.skaters.filter(s => s.team === code), gk = b.goalies.filter(x => x.team === code);
  return { team: { id: E.CLUBS[code].id }, statistics: [group('forwards', sk.filter(s => s.pos !== 'D')), group('defenses', sk.filter(s => s.pos === 'D')),
    Object.assign({ name: 'goalies', labels: GK_COLS.map(c => c[1]), athletes: gk.map(x => ({ athlete: { id: x.id, displayName: x.name, position: { abbreviation: 'G' } },
      stats: GK_COLS.map(([, , f]) => f === 'toi' ? mmss(x.toi) : f === 'sv' ? x.sa - x.ga : f ? x[f] : 0).map(String) })) }, labelsOnly ? {} : { keys: GK_COLS.map(c => c[0]) })] };
}) } });
/* an injury row in ESPN's shape: no athlete id field, the id in the player's links when we give one */
const injRow = (name, pos, status, id, detail) => ({ status, date: '2026-10-01T12:00Z', athlete: Object.assign({ displayName: name, position: { abbreviation: pos || 'C' } },
  id ? { links: [{ rel: ['playercard', 'desktop', 'athlete'], href: `https://www.espn.com/nhl/player/_/id/${id}/${String(name).toLowerCase().replace(/[^a-z]+/g, '-')}` }, { rel: ['stats'], href: `sportscenter://x-callback-url/showClubhouse?uid=s:70~l:90~a:${id}` }] } : {}),
  details: { type: detail || 'Lower Body', returnDate: '2026-11-01' } });
/* a final's box line made up from its clubs' last box lines (their skaters, one goalie a side, a starter the box can tell), each
   goalie's shots against the other side's skaters' shots, so the box files' shots column holds on it as on a real line (the smoke
   allows only a few games off it, and lines made up from two other games' halves were off nine times in ten) */
function madeBox(g, hb, ab) {
  const hs = hb.skaters.filter(x => x.team === g.home), as = ab.skaters.filter(x => x.team === g.away), shots = l => l.reduce((a, x) => a + (x.s || 0), 0);
  const one = (b, c, sa) => b.goalies.filter(x => x.team === c).sort((x, y) => y.toi - x.toi).slice(0, 1).map(x => Object.assign({}, x, { sa, ga: Math.min(x.ga, sa) }));
  return { home: g.home, away: g.away, skaters: hs.concat(as), goalies: one(hb, g.home, shots(as)).concat(one(ab, g.away, shots(hs))) };
}
const dfoPage = data => `<html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify({ props: { pageProps: { data } }, page: '/starting-goalies' })}</script></body></html>`;

/* ---------- B. today's real data through the job ---------- */
/* the published state's own rows back into scoreboard events, day by day */
function feedOf(games, tweak) {
  const byDate = {};
  for (const g of games) {
    let x = g.state === 'final' ? { state: 'post', hs: g.hs, as: g.as, periods: g.periods, detail: g.detail } : g.state === 'live' ? { state: 'in', hs: g.hs, as: g.as, periods: g.periods || 2, detail: g.detail } : { state: 'pre', odds: oddsOfLine(g.line, g), detail: g.detail };
    x = Object.assign(x, { type: g.type });
    const ev = event(g, x);
    if (!tweak || tweak(g, ev) !== false) (byDate[g.date] = byDate[g.date] || []).push(ev);
  }
  return byDate;
}
const postponed = ev => { ev.competitions[0].status = { type: { state: 'post', name: 'STATUS_POSTPONED', description: 'Postponed', shortDetail: 'Postponed' }, period: 0 }; ev.competitions[0].odds = undefined; return ev; };
/* the job in the workflow's own order (read from .github/workflows/update.yml, so a step moved there is a step moved here) */
function jobSteps() {
  const yml = path.join(ROOT, '.github', 'workflows', 'update.yml');
  return (fs.existsSync(yml) ? [...fs.readFileSync(yml, 'utf8').matchAll(/run: node tools\/(\S+\.js)([^\n]*)/g)].map(m => [m[1], m[2].trim().split(/\s+/).filter(Boolean)]) : [['update.js', ['--scores']], ['fetch_box.js', []], ['starters.js', []], ['players.js', []], ['props.js', []], ['update.js', []]])
    .filter(([s]) => ['update.js', 'fetch_box.js', 'starters.js', 'players.js', 'props.js'].includes(s));
}
const runJob = (env, tag) => jobSteps().map(([s, a]) => ({ s, a, r: run(s, s === 'update.js' ? ['--offline'].concat(a) : a, env, `${tag}: ${s}`) }));

function partB() {
  console.log('B. the real state, box scores and injury report through the job, offline');
  const B = dataDir('B'), FX = mkdir('B-fx'), OUTB = mkdir('B-sb'), STB = path.join(SCRATCH, 'B-state.json'), PREVB = path.join(SCRATCH, 'B-prev.json');
  fs.copyFileSync(path.join(ROOT, 'state.json'), STB); fs.copyFileSync(path.join(ROOT, 'state.json'), PREVB);
  const NOW = minute(Date.parse(real.published)), TODAY = E.etDate(NOW);
  /* who is who: every player of this season's and last season's box scores */
  const boxFile = path.join(B, `box_${SEASON}.jsonl`);
  const lines = fs.existsSync(boxFile) ? fs.readFileSync(boxFile, 'utf8').split('\n').filter(Boolean) : [];
  const boxes = []; for (const f of fs.readdirSync(REAL_DATA).filter(f => /^box_\d+\.jsonl$/.test(f) && +f.slice(4, 8) >= SEASON - 1).sort()) for (const l of fs.readFileSync(path.join(REAL_DATA, f), 'utf8').split('\n')) if (l) boxes.push(JSON.parse(l));
  const lastOf = c => boxes.filter(b => b.home === c || b.away === c).pop();
  const idOf = {}, nameIds = {};
  for (const b of boxes) for (const p of b.skaters.concat(b.goalies)) { idOf[p.team + '|' + E.normName(p.name)] = p.id; (nameIds[E.normName(p.name)] = nameIds[E.normName(p.name)] || new Set()).add(p.id); }
  const starterOf = (b, c) => { const gs = b.goalies.filter(x => x.team === c).sort((x, y) => y.toi - x.toi); return gs[0] || null; };
  const startsIn = (c, season) => { const n = {}; for (const b of boxes) if (b.season === season && (b.home === c || b.away === c)) { const s = starterOf(b, c); if (s) n[s.id] = (n[s.id] || { id: s.id, name: s.name, n: 0 }), n[s.id].n++; } return Object.values(n).sort((a, b) => b.n - a.n); };
  /* this season's starters first, then last season's for the club: on opening night nobody has started yet */
  const starts = c => { const a = startsIn(c, SEASON), seen = new Set(a.map(x => x.id)); return a.concat(startsIn(c, SEASON - 1).filter(x => !seen.has(x.id))); };
  /* last night: a game the published state still has under way (or one today still to come) is final in the feed now,
     with its box score; the job reads the scores first, so it is boxed and rated in this same run */
  const fresh = real.games.filter(g => g.state === 'live').pop() || real.games.find(g => g.state === 'pre' && g.date === TODAY);
  const freshOk = !!(fresh && lastOf(fresh.home) && lastOf(fresh.away));
  /* the games still to come in this run: never that one, which the feed has over (a case planted on it would be read off its
     published call, kept as it is: on a day whose only game it was, or whose other clubs the planted cases passed over, the
     DailyFaceoff cases landed on it), and never a delayed game, whose call the job keeps (update.js's started()) */
  const toCome = real.games.filter(g => g.state === 'pre' && Date.parse(g.start) > Date.parse(NOW) && !(freshOk && g.id === fresh.id) && !delayedAt(g, Date.parse(NOW))).sort((a, b) => a.start < b.start ? -1 : 1);
  const D = toCome.length ? toCome[0].date : null, onD = toCome.filter(g => g.date === D);
  /* its home side in goal as CBJ at VGK went on 8 January 2026 (401803043, the box file's numbers): the starter pulled at 8:24 with one
     shot against, a goal, and his reliever making the side's first save, so ESPN's plays mark the reliever; the box cannot tell who
     started, and the state grades neither goalie's saves */
  const PULLED = '990011';
  if (freshOk) {
    const hb = lastOf(fresh.home), ab = lastOf(fresh.away);
    const hg = hb.goalies.filter(x => x.team === fresh.home).sort((x, y) => y.toi - x.toi)[0];
    /* the shots each side's goalies faced are the other side's skaters' (the box files' shots column), the away side one goalie */
    const mb = madeBox(fresh, hb, ab), awayShots = mb.skaters.filter(x => x.team === fresh.away).reduce((a, x) => a + (x.s || 0), 0);
    const homeG = [Object.assign({}, hg, { toi: 3089, sa: Math.max(2, awayShots - 1), ga: 2, st: 1 }), { id: PULLED, name: 'Pulled Starter', team: fresh.home, toi: 504, sa: 1, ga: 1 }];
    fs.writeFileSync(path.join(FX, `summary_${fresh.id}.json`), JSON.stringify(summaryOf({ home: fresh.home, away: fresh.away,
      skaters: mb.skaters, goalies: homeG.concat(mb.goalies.filter(x => x.team === fresh.away)) })));
    /* its closing props at ESPN, in the feed's shape: a points line on each side's two busiest skaters, the Over first */
    const ref = id => ({ $ref: `http://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/seasons/${SEASON}/athletes/${id}?lang=en&region=us` });
    const it = (type, id, price, total) => ({ type: { id: '1', name: type }, athlete: ref(id), odds: { american: { value: price }, total: { value: String(total) } } });
    const top = (b, c) => b.skaters.filter(s => s.team === c).sort((x, y) => y.toi - x.toi).slice(0, 2);
    const items = [].concat(...top(hb, fresh.home).concat(top(ab, fresh.away)).map(s => [it('Total Points', s.id, '+105', 0.5), it('Total Points', s.id, '-135', 0.5)]));
    fs.writeFileSync(path.join(FX, `props_${fresh.id}_p1.json`), JSON.stringify({ count: items.length, pageIndex: 1, pageSize: 1000, pageCount: 1, items }));
  }
  /* DraftKings' player lines on the games to come (props.js reads them on every game it projects, every run, since nhl v16): the
     first game through tomorrow answers in ESPN's shape (each club's four busiest skaters' points line, the Over first, a 2+ milestone
     and an anytime goal; the starter's saves), the second answers ESPN's 404, the rest have no saved answer, a failed read */
  const pref = id => ({ $ref: `http://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/seasons/${SEASON}/athletes/${id}?lang=en&region=us` });
  const pItem = (type, id, price, total, target) => Object.assign({ type: { id: '1', name: type }, athlete: pref(id), odds: { american: { value: price }, total: total === undefined ? {} : { value: String(total) } } }, target === undefined ? {} : { current: { target: { value: target, displayValue: String(total) } } });
  const dkGames = toCome.filter(g => g.date <= addDays(TODAY, 1) && !(freshOk && g.id === fresh.id) && lastOf(g.home) && lastOf(g.away));    // never last night's final, whose closing props are its own answer
  const DKF = dkGames[0] || null, DK404 = dkGames[1] || null;
  let DKF_ITEMS = null;
  if (DKF) {
    DKF_ITEMS = [];
    for (const c of [DKF.away, DKF.home]) {
      const b = lastOf(c);
      b.skaters.filter(x => x.team === c).sort((x, y) => y.toi - x.toi).slice(0, 4).forEach((x, i) => DKF_ITEMS.push(pItem('Total Points', x.id, i % 2 ? '-130' : '+110', 0.5, 0.5), pItem('Total Points', x.id, i % 2 ? '+100' : '-140', 0.5, 0.5), pItem('Points Milestones', x.id, '+' + (260 + 20 * i), '2+', 2), pItem('Anytime Goalscorer', x.id, '+' + (190 + 30 * i))));
      const gk = starterOf(b, c); if (gk) DKF_ITEMS.push(pItem('Total Saves', gk.id, '-115', 24.5, 24.5), pItem('Total Saves', gk.id, '-115', 24.5, 24.5));
    }
    fs.writeFileSync(path.join(FX, `props_${DKF.id}_p1.json`), JSON.stringify({ count: DKF_ITEMS.length, pageIndex: 1, pageSize: 1000, pageCount: 1, items: DKF_ITEMS }));
  }
  if (DK404) fs.writeFileSync(path.join(FX, `props_${DK404.id}_p1.json`), JSON.stringify({ error: { message: `No propBets found for eventId ${DK404.id} and provider 100`, code: 404 } }));
  /* three boxed finals held back, to be read again from summaries in ESPN's shape */
  const finals = new Set(real.games.filter(g => g.state === 'final').map(g => String(g.id)));
  const held = lines.filter(l => finals.has(JSON.parse(l).id)).slice(-3).map(l => JSON.parse(l));
  if (lines.length) fs.writeFileSync(boxFile, lines.filter(l => !held.some(h => h.id === JSON.parse(l).id)).join('\n') + '\n');
  held.forEach((h, i) => fs.writeFileSync(path.join(FX, `summary_${h.id}.json`), JSON.stringify(summaryOf(h, i === 1))));      // the second with labels and no keys
  /* every other final the real run left unboxed or without its closing props (a summary ESPN did not give while another final
     was read, a props request that failed, a final between the job's two passes): each answers here, its box score its clubs'
     last box lines and its props ESPN's 404, and props.js asks for every one, so no step of the simulation stands on the
     committed files being whole (fetch_box.js's and props.js's own rules for which finals they ask for) */
  const boxedIds = REAL_BOXED;
  const recorded = new Set(); for (const f of fs.readdirSync(REAL_DATA).filter(f => /^props_\d{4}\.jsonl$/.test(f))) for (const l of fs.readFileSync(path.join(REAL_DATA, f), 'utf8').split('\n')) if (l) recorded.add(String(JSON.parse(l).id));
  const allFinals = Hist.rows(REAL_DATA).filter(r => r.season >= 2022).map(r => ({ id: String(r.id), date: r.date, home: r.home, away: r.away, hist: true }))
    .concat(real.games.filter(g => g.state === 'final' && g.hs !== null).map(g => ({ id: String(g.id), date: g.date, home: g.home, away: g.away })));
  const backlog = { box: [], props: [], none: [] };
  for (const g of allFinals) {
    if (freshOk && g.id === String(fresh.id)) continue;
    if (!boxedIds.has(g.id) && !held.some(h => h.id === g.id)) {
      if (lastOf(g.home) && lastOf(g.away)) { fs.writeFileSync(path.join(FX, `summary_${g.id}.json`), JSON.stringify(summaryOf(madeBox(g, lastOf(g.home), lastOf(g.away))))); backlog.box.push(g.id); }
      else backlog.none.push(`${g.away}@${g.home} ${g.date}`);
    }
    if (!g.hist && g.date >= '2026-04-16' && !recorded.has(g.id)) {
      fs.writeFileSync(path.join(FX, `props_${g.id}_p1.json`), JSON.stringify({ error: { message: `No propBets found for eventId ${g.id} and provider 100`, code: 404 } }));
      backlog.props.push(g.id);
    }
  }
  if (backlog.none.length) console.log(`  finals with no box line and no box line of a club to make one from (fetch_box.js asks for them, unanswered): ${backlog.none.slice(0, 4).join(', ')}`);
  if (backlog.box.length || backlog.props.length) console.log(`  finals the committed files lack, answered here: ${backlog.box.length} box scores (${backlog.box.slice(0, 4).join(', ')}), ${backlog.props.length} closing props as none posted (${backlog.props.slice(0, 4).join(', ')})`);
  /* the injury report in ESPN's shape: every row of the committed one, its id in the link when the box scores know him, one in four with no link */
  const inj = fs.existsSync(path.join(REAL_DATA, 'injuries.json')) ? readJSON(path.join(REAL_DATA, 'injuries.json')) : { teams: {} };
  const feed = {}; let k = 0;
  for (const [club, list] of Object.entries(inj.teams || {})) feed[club] = (list || []).map(r => {
    const id = /^\d+$/.test(String(r.id)) ? r.id : idOf[club + '|' + E.normName(r.name)] || (nameIds[E.normName(r.name)] && nameIds[E.normName(r.name)].size === 1 ? [...nameIds[E.normName(r.name)]][0] : null);
    return injRow(r.name, r.pos, r.status, ++k % 4 === 0 ? null : id, r.detail);
  });
  const feedPlain = JSON.parse(JSON.stringify(feed));                                   // the report as published, for B2
  /* a club's goalies players.js can start: started for it this season or last, his latest game for it (traded or claimed, he is
     another club's), and named on no row of the report (`rep`, in ESPN's shape) of any club, by the id in his link or by name */
  const lastTeam = {}; for (const b of boxes) for (const x of b.goalies) if (!lastTeam[x.id] || lastTeam[x.id].date <= b.date) lastTeam[x.id] = { date: b.date, team: x.team };
  const rowIdOf = r => { const m = ((r.athlete && r.athlete.links) || []).map(l => /\/id\/(\d+)/.exec(l.href || '')).find(Boolean); return m ? m[1] : null; };
  /* out on any club's report (tools/players.js's out statuses) or listed under another club, by his link's id or by name: players.js
     takes neither; a goalie his own club lists day to day it keeps */
  const OUT_RE = /\bout\b|injured reserve|\bir\b|\bltir\b|suspen/i;
  const offFor = (rep, s, c) => Object.entries(rep).some(([club, l]) => (l || []).some(r => (rowIdOf(r) === String(s.id) || E.normName(r.athlete && r.athlete.displayName) === E.normName(s.name)) && (OUT_RE.test(r.status || '') || club !== c)));
  /* in players.js's order (goalieRanks): starts in the club's last ten games this season, then appearances this season, then last season's starts */
  const rankFor = c => {
    const mine = boxes.filter(b => b.home === c || b.away === c).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0), now = mine.filter(b => b.season === SEASON);
    const count = (list, ids) => { const n = {}; for (const b of list) for (const id of ids(b)) n[id] = (n[id] || 0) + 1; return n; }, st = b => { const s = starterOf(b, c); return s ? [s.id] : []; };
    const s10 = count(now.slice(-10), st), ap = count(now, b => b.goalies.filter(x => x.team === c && x.toi > 0).map(x => x.id)), ls = count(mine.filter(b => b.season === SEASON - 1), st);
    return (a, b) => (s10[b.id] || 0) - (s10[a.id] || 0) || (ap[b.id] || 0) - (ap[a.id] || 0) || (ls[b.id] || 0) - (ls[a.id] || 0);
  };
  const freeOf = rep => c => starts(c).filter(s => lastTeam[s.id] && lastTeam[s.id].team === c && !offFor(rep, s, c)).sort(rankFor(c));
  /* the planted cases, on clubs with a game still to come and two goalies who have started for them */
  const listed = (c, name) => (inj.teams[c] || []).some(r => E.normName(r.name) === E.normName(name));
  const clubs = [...new Set(toCome.flatMap(g => [g.home, g.away]))].filter(c => starts(c).length >= 2 && lastOf(c));
  const X = clubs.find(c => !listed(c, starts(c)[0].name));
  const Y = clubs.find(c => c !== X && !listed(c, starts(c)[0].name));
  const Z = E.TEAMS.find(c => c !== X && c !== Y);
  const xg = X && starts(X)[0], yg = Y && starts(Y)[0];
  const xs = X && lastOf(X).skaters.filter(s => s.team === X).sort((a, b) => b.toi - a.toi)[0];
  if (X) { (feed[X] = feed[X] || []).push(injRow(xg.name, 'G', 'Injured Reserve', xg.id, 'Groin')); feed[X].push(injRow(xs.name, xs.pos, 'Out', null, 'Upper Body')); }     // the skater by name only
  if (Y) (feed[Z] = feed[Z] || []).push(injRow(yg.name, 'G', 'Day-To-Day', yg.id, 'Illness'));                                                                     // listed under another club
  fs.writeFileSync(path.join(FX, 'injuries.json'), JSON.stringify({ timestamp: NOW, status: 'success', injuries: Object.entries(feed).map(([c, l]) => ({ id: E.CLUBS[c].id, displayName: E.CLUBS[c].name, injuries: l })) }));
  console.log(X ? `  planted: ${xg.name} (${X}'s top starter) on injured reserve, ${xs.name} (${X}) out by name only${Y ? `, ${yg.name} (${Y}'s top starter) on ${Z}'s report` : ''}` : '  no club with a game to come and two starters: the planted lineup cases are skipped');
  /* DailyFaceoff on the first day with games to come: a backup confirmed (its date written as a midnight-GMT
     ISO stamp, the day it names), a goalie with no NHL game, an unconfirmed one (dated by a zone-less GMT
     stamp when its game is past midnight GMT), and a stale entry from the day before */
  const g1 = D && (onD.find(g => ![X, Y].includes(g.home) && starts(g.home).length >= 2) || onD[0]);
  /* the unconfirmed goalie: one who has started for the club, whose latest game was for it, and whom no club's report names (the
     planted rows among them), since players.js takes an unconfirmed name only for a goalie who is not out, on any club's report
     by id or name (a Confirmed one it takes even so). Its top starter was planted until 26 October 2026, when Edmonton's, Devon
     Levi, had gone on injured reserve two days before and the check failed the job */
  const freeG = c => freeOf(feed)(c)[0];
  /* the latest game of the day (past midnight GMT, when there is one), or of the next game day where the day has no other: on an
     evening whose last game is g1 it was left out, and with it the check */
  const nextD = D && (toCome.find(g => g.date > D) || {}).date;
  /* never g1's home club on the next day: the check that the goalie named for it on D is not carried to its later games would read
     g2's name as carried */
  const g2 = D && [D, nextD].filter(Boolean).map(d => toCome.filter(g => g.date === d).reverse().find(g => g !== g1 && ![X, Y].includes(g.home) && (d === D || !g1 || g.home !== g1.home) && freeG(g.home))).find(Boolean);
  const g2g = g2 && freeG(g2.home);
  const g3 = D && onD.find(g => g !== g1 && g !== g2 && ![X, Y].includes(g.home) && starts(g.home).length >= 1);
  const backup = g1 && (starts(g1.home)[1] || starts(g1.home)[0]);
  const dfo = [];
  if (g1 && backup) dfo.push({ date: `${D}T00:00:00.000Z`, time: '7:00 PM', homeTeamName: E.CLUBS[g1.home].name, awayTeamName: E.CLUBS[g1.away].name, homeGoalieName: backup.name, homeNewsStrengthName: 'Confirmed', awayGoalieName: 'Zed Newman', awayNewsStrengthName: 'Likely' });
  if (g2) dfo.push(Object.assign({ homeTeamName: E.CLUBS[g2.home].name, awayTeamName: E.CLUBS[g2.away].name, homeGoalieName: g2g.name, homeNewsStrengthName: 'Unconfirmed', awayGoalieName: null },
    g2.start.slice(0, 10) > g2.date ? { dateGmt: g2.start.replace(/Z$/, '').replace(/(:\d\d)$/, '$1:00') } : g2.date === TODAY ? {} : { date: g2.date }));
  const staleOn = g3 || g1;
  if (staleOn) dfo.push({ date: addDays(D, -1), homeTeamName: E.CLUBS[staleOn.home].name, awayTeamName: E.CLUBS[staleOn.away].name, homeGoalieName: 'Stale Entry', homeNewsStrengthName: 'Confirmed' });
  fs.writeFileSync(path.join(FX, 'dailyfaceoff.html'), dfoPage(dfo));
  if (g1) console.log(`  DailyFaceoff on ${D}: ${backup.name} confirmed for ${g1.home}, Zed Newman likely for ${g1.away}${g2 ? `, ${g2g.name} unconfirmed for ${g2.home}${g2.date !== D ? ` on ${g2.date}` : ''}${g2.start.slice(0, 10) > g2.date ? ' (dated by dateGmt)' : ''}` : ', no game for an unconfirmed goalie on it or the next game day'}, and a stale entry for ${staleOn.home} on ${addDays(D, -1)}`);
  /* a game the feed has postponed, the first night of a back to back for a club (after the DailyFaceoff day, clubs
     planted above left alone): the job reads every day in both passes, so the night after is no back to back */
  const sched = {}; for (const g of real.games.slice().sort((a, b) => a.start < b.start ? -1 : 1)) for (const t of [g.home, g.away]) (sched[t] = sched[t] || []).push(g);
  const nextOf = (c, g) => { const l = sched[c]; return l[l.findIndex(x => x.id === g.id) + 1] || null; };
  const pp = toCome.find(g => g.date > D && ![g1, g2, g3].includes(g) && ![X, Y, Z].includes(g.home) && ![X, Y, Z].includes(g.away) && [g.home, g.away].some(c => { const n = nextOf(c, g); return n && n.date === addDays(g.date, 1); }));
  if (pp) console.log(`  postponed in the feed: ${pp.away}@${pp.home} ${pp.date}, the first night of a back to back for ${[pp.home, pp.away].filter(c => { const n = nextOf(c, pp); return n && n.date === addDays(pp.date, 1); }).join(' and ')}`);
  writeDays(OUTB, feedOf(real.games, (g, ev) => {
    if (freshOk && g.id === fresh.id) Object.assign(ev, event(fresh, { state: 'post', hs: 4, as: 2, periods: 3, type: fresh.type }));
    if (pp && g.id === pp.id) postponed(ev);
  }));

  const env = { NHL_DATA: B, NHL_STATE: STB, NHL_TEAMS: path.join(B, 'teams.json'), NHL_OUT: OUTB, NHL_FIXTURES: FX, NHL_NOW: NOW, NHL_TODAY: TODAY, NHL_SEASON: String(SEASON), NHL_PROPS_ASK: '100000' };      // props.js asks every final the record lacks, last night's among them
  console.log('  the job\'s steps: ' + jobSteps().map(([s, a]) => [s].concat(a).join(' ')).join(' -> '));
  const stepRuns = runJob(env, 'B');
  for (const { s, r } of stepRuns) chk(r.status === 0, `${s} runs`);
  if (freshOk) {
    const boxedNow = fs.readFileSync(boxFile, 'utf8').split('\n').filter(Boolean).some(l => JSON.parse(l).id === String(fresh.id));
    chk(boxedNow, `last night's final (${fresh.away}@${fresh.home}, ${fresh.date}), still under way in the published state, is boxed in the same run`);
    const pj = readJSON(path.join(B, 'players.json'));
    chk(pj.teams[fresh.home].lastBox === fresh.date && pj.asOf >= fresh.date, `and the lineups are rated through it (${fresh.home} last box ${pj.teams[fresh.home].lastBox}, ratings as of ${pj.asOf})`);
    const fb = (readJSON(STB).box || { games: {} }).games[String(fresh.id)], hg = (fs.readFileSync(boxFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).find(b => b.id === String(fresh.id)) || { goalies: [] }).goalies.filter(x => x.team === fresh.home);
    const marked = hg.filter(x => x.st).map(x => x.id), both = hg.map(x => x.id).sort();
    /* the away side has one goalie, a starter the box can tell, so u is the planted home pair exactly */
    chk(!!fb && marked.length === 1 && marked[0] !== PULLED && both.includes(PULLED) && JSON.stringify(fb.u) === JSON.stringify(both) && both.every(id => !(id in fb.g) && !(fb.r || []).includes(id)),
      `a starter pulled before his first save (401803043's numbers on ${fresh.home}): the plays mark his reliever, and the state grades neither goalie's saves, both in u (${fb ? JSON.stringify({ g: fb.g, r: fb.r, u: fb.u }) : 'no box'}, marked ${marked})`);
  }
  const again = fs.existsSync(boxFile) ? fs.readFileSync(boxFile, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  /* each player's fields, key order aside; `sog` was the old files' misread shootout column, never kept since */
  const byId = l => JSON.stringify(l.slice().sort((x, y) => x.id < y.id ? -1 : x.id > y.id ? 1 : 0).map(p => Object.keys(p).filter(k => k !== 'sog').sort().map(k => [k, p[k]])));
  for (const h of held) {
    const b = again.find(x => x.id === h.id);
    chk(b && byId(b.skaters) === byId(h.skaters) && byId(b.goalies) === byId(h.goalies), `a box score read from ESPN's summary shape is the one the job read before: ${h.id}`);
    chk(b && b.skaters.every(s => s.sog === undefined && s.so === undefined), `ESPN's SOG column (shootout goals, planted non-zero) is kept under no name: ${h.id}`);
    if (h.skaters.some(s => s.s !== undefined)) chk(b && b.skaters.every(s => { const o = h.skaters.find(x => x.id === s.id); return o && s.s === o.s && s.bs === o.bs && s.ht === o.ht && s.pptoi === o.pptoi; }),
      `shots are ESPN's S column (shotsTotal), never SOG, with blocks, hits and power-play time beside them${held.indexOf(h) === 1 ? ', read by label where the summary has no keys' : ''}: ${h.id}`);
    chk(b && b.hs !== undefined && b.hs !== null && b.periods, `a box line carries its game's score: ${h.id}`);
  }
  /* the starting goalie from ESPN's plays: a side whose starter was pulled after fifteen minutes, his reliever playing the
     rest, marks the starter (the first save by the plays' sequence), never the goalie who played most or the list's first */
  if (held.length) {
    const h = held[0], club = h.home, [g0] = h.goalies.filter(x => x.team === club);
    const two = Object.assign({}, h, { goalies: [{ id: '990001', name: 'Relief Goalie', team: club, toi: 2700, sa: 24, ga: 1 }, Object.assign({}, g0, { toi: 900, sa: 8, ga: 4, st: 1 })]
      .concat(h.goalies.filter(x => x.team !== club)) });
    const j = summaryOf(two), b = boxOf(j, {});
    const mark = b ? b.goalies.filter(x => x.team === club).map(x => x.id + (x.st ? '*' : '')) : null;
    chk(b && JSON.stringify(mark) === JSON.stringify(['990001', g0.id + '*']), `a starter pulled early is the side's starter, read from the plays' first save (${JSON.stringify(mark)})`);
    const nb = boxOf(Object.assign({}, j, { plays: [] }), {});
    chk(nb && nb.goalies.every(x => x.st === undefined), 'a summary whose plays name no save marks no starter (the reader then takes the goalie who played most)');
  }
  if (freshOk) {
    const recs = fs.readdirSync(B).filter(f => /^props_\d{4}\.jsonl$/.test(f)).flatMap(f => fs.readFileSync(path.join(B, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)));
    const rf = recs.filter(r => r.id === String(fresh.id));
    chk(rf.length === 1 && rf[0].status === 200 && rf[0].main.length === 4 && rf[0].main.every(m => m[1] === 'pts' && m[3] === 105 && m[4] === -135), `last night's final's closing props are recorded once, the first item the Over (${rf.length ? rf[0].main.length + ' lines' : 'none'})`);
  }
  const injOut = readJSON(path.join(B, 'injuries.json'));
  const rows = Object.values(injOut.teams).reduce((a, l) => a.concat(l), []);
  chk(rows.length === Object.values(feed).reduce((a, l) => a + l.length, 0), `every row of the report is kept (${rows.length})`);
  chk(rows.every(r => r.id === null || /^\d+$/.test(r.id)), 'no injury id is "undefined": each is the ESPN id from the player link, or empty');
  chk(rows.filter(r => r.id).length >= rows.length / 2, `the ids come from the links (${rows.filter(r => r.id).length} of ${rows.length})`);
  const st = readJSON(path.join(B, 'starters.json'));
  const SB = readJSON(STB);
  chk(SB.pass === undefined, 'the state the job leaves is the second pass\'s');
  /* the pick'em models (tools/models.js, nhl v20): every game to come the second pass called carries Alpha and the Joker, and the ELO Model
     wherever the player model lined it up; none of the first pass's copies made one */
  const toComeB = SB.games.filter(g => g.state === 'pre' && Date.parse(g.start) > Date.parse(NOW));
  /* in the summer, between rounds and on the morning of the last game listed there is none: said, and held only where the published
     state had a game to come besides those this run turns final or postpones */
  const shouldCome = toCome.filter(g => !(pp && g.id === pp.id));
  if (!toComeB.length && !shouldCome.length) console.log("  no game to come in B: the pick'em models check is skipped");
  else if (fs.existsSync(path.join(REAL_DATA, 'models.json'))) chk(toComeB.length > 0 && toComeB.every(g => g.models && g.models.alpha && g.models.joker && !!g.pm === !!g.models.elo), `every game to come carries the pick'em models, the ELO Model beside each player model view (${toComeB.filter(g => g.models).length} of ${toComeB.length})`);
  const pre = SB.games.filter(g => g.state === 'pre' && Date.parse(g.start) > Date.parse(NOW) && g.pm);
  const goalieOn = (g, c) => g.pm[g.home === c ? 'home' : 'away'].goalie;
  if (g1) {
    chk(st.ok === true && st.games.length >= (g2 ? 2 : 1) && st.games.every(e => e.id), `DailyFaceoff's page shape is read, each game it names matched to one on the schedule (${st.games.length} games)`);
    chk(st.games.some(e => e.date === D && e.home === g1.home && e.homeGoalie.status === 'Confirmed' && e.id === String(g1.id)), `a game read off the page is matched to the schedule with its date and id, the date written as midnight GMT read as the day it names (${D})`);
    if (g2) chk(st.games.some(e => e.home === g2.home && e.date === g2.date && e.id === String(g2.id) && e.homeGoalie && e.homeGoalie.status === 'Unconfirmed'), `"Unconfirmed" is read as unconfirmed, on its own game${g2.start.slice(0, 10) > g2.date ? ', dated by its GMT stamp in Eastern time' : ''}`);
    const c1 = SB.games.find(g => g.id === g1.id);
    chk(c1.pm.home.goalie && c1.pm.home.goalie.id === backup.id && /confirmed by DailyFaceoff/.test(c1.pm.home.goalie.how), `the confirmed backup ${backup.name} is in goal for ${g1.home} on ${D}: ${c1.pm.home.goalie && c1.pm.home.goalie.name} (${c1.pm.home.goalie && c1.pm.home.goalie.how})`);
    chk(c1.pm.away.goalie && c1.pm.away.goalie.name === 'Zed Newman' && c1.pm.away.goalie.debut, `a goalie DailyFaceoff names with no NHL game starts on a rookie's rating: ${c1.pm.away.goalie && c1.pm.away.goalie.name}`);
    if (g2) { const c2 = SB.games.find(g => g.id === g2.id); chk(/unconfirmed/.test(c2.pm.home.goalie.how), `an unconfirmed goalie is said to be unconfirmed: ${c2.pm.home.goalie.how}`); }
    chk(!SB.games.some(g => g.pm && [g.pm.home, g.pm.away].some(t => t && t.goalie && t.goalie.name === 'Stale Entry')), "a name DailyFaceoff gave for the day before is not used today");
    chk(SB.games.filter(g => g.state === 'pre' && g.date > D && (g.home === g1.home || g.away === g1.home) && g.pm).every(g => !(g.pm[g.home === g1.home ? 'home' : 'away'].goalie || {}).announced), `the goalie DailyFaceoff named for ${g1.home} on ${D} is not carried to its later games`);
  }
  if (X) {
    chk(pre.filter(g => g.home === X || g.away === X).every(g => !goalieOn(g, X) || goalieOn(g, X).id !== xg.id), `${xg.name}, put on injured reserve, is in goal for ${X} in no game to come`);
    chk(!SB.players.teams[X].lineup.some(p => p.id === xs.id), `${xs.name}, out by name only, is not in ${X}'s lineup`);
    chk(SB.players.teams[X].out.some(o => o.name === xs.name && o.id === xs.id), `${xs.name} is matched by club and name and listed out for ${X}`);
  }
  if (Y) chk(pre.filter(g => g.home === Y || g.away === Y).every(g => !goalieOn(g, Y) || goalieOn(g, Y).id !== yg.id), `${yg.name}, on ${Z}'s report, is in goal for ${Y} in no game to come`);
  if (pp) {
    chk(!SB.games.some(g => g.id === pp.id) && (SB.removed || []).some(r => r.id === pp.id && r.why === 'postponed'), `the postponed ${pp.away}@${pp.home} is off the schedule, and the state says why`);
    for (const c of [pp.home, pp.away]) {
      const n = nextOf(c, pp), g = n && SB.games.find(x => x.id === n.id);
      if (g && g.pm && n.date === addDays(pp.date, 1)) chk(!/back to back/.test((goalieOn(g, c) || {}).how || ''), `${c} on ${n.date}: its game the night before was postponed, so no back to back (${(goalieOn(g, c) || {}).how})`);
    }
  }
  /* the player model blends the team Elo's gap of the run itself, after last night's finals, never the last run's */
  const PJ = readJSON(path.join(B, 'players.json'));
  const gap = pre.filter(g => !PJ.upcoming[g.id] || Math.abs(PJ.upcoming[g.id].diff - g.diff) > 0.011);
  if (pre.length) chk(!gap.length, `the team Elo gap the player model blends is this run's on every game to come (${gap.length} differ, e.g. ${gap[0] && `${gap[0].away}@${gap[0].home} ${PJ.upcoming[gap[0].id] && PJ.upcoming[gap[0].id].diff} vs ${gap[0].diff}`})`);
  const b2b = pre.filter(g => [g.pm.home, g.pm.away].some(t => t.goalie && /back to back/.test(t.goalie.how)));
  chk(SB.games.filter(g => g.state !== 'pre' && g.frozen).every(g => !(g.pm && g.pm.pHome === g.pHome && g.pm.xt === g.xt) || (g.mu === g.pm.mu && g.by === 'players')), "every started call that is the player model's carries its margin again");
  console.log(`  ${pre.length} games to come lined up, ${b2b.length} with a back to back; ${SB.players.injuries.matched} of ${SB.players.injuries.rows} report rows matched, ${SB.players.injuries.out} out`);
  /* DraftKings' ids: every line read this run is the feed's, ids and all (the published ids, or ids invented for the game) */
  const realById = new Map(real.games.map(g => [g.id, g]));
  const readNow = SB.games.filter(g => g.state === 'pre' && g.line && g.line.at === NOW);
  const idsBad = readNow.filter(g => { const r = realById.get(g.id), want = r && r.line && r.line.dk ? idsOnly(r.line.dk) : r && r.line ? inventIds(r, r.line) : null; return !want || JSON.stringify(g.line.dk) !== JSON.stringify(want); });
  chk(!idsBad.length, `every line read in B carries the feed's DraftKings ids (${readNow.length - idsBad.length} of ${readNow.length}${idsBad[0] ? `, e.g. ${idsBad[0].id}: ${JSON.stringify(idsBad[0].line.dk)}` : ''})`);
  /* DraftKings' player lines as props.js read them, game by game: the answer parsed as tools/espn.js parses it, the 404 none posted
     yet, a failed read the last run's read where that was one, else failed; the state carries each game still to come as props.js
     wrote it */
  {
    const PJB = readJSON(path.join(B, 'props.json')) || {}, PREVP = readJSON(path.join(REAL_DATA, 'props.json')) || {}, gs = PJB.games || {};
    const want = id => { if (DKF && id === DKF.id) { const pr = E.propsOf(DKF_ITEMS); return { status: 200, main: pr.main, yes: pr.yes }; } if (DK404 && id === DK404.id) return { status: 404 };
      const was = PREVP.games && PREVP.games[id] && PREVP.games[id].dk; return was && was.status === 200 ? was : { status: 'failed' }; };
    const badDk = Object.keys(gs).filter(id => { const d = gs[id].dk, w = want(id); if (!d || d.status !== w.status) return true;
      if (w.at) return JSON.stringify(d) !== JSON.stringify(w);
      if (d.at !== new Date(NOW).toISOString()) return true;
      return w.status === 200 ? JSON.stringify(d.main) !== JSON.stringify(w.main) || JSON.stringify(d.yes) !== JSON.stringify(w.yes) : w.status === 'failed' ? !/HTTP 503/.test(d.why || '') : false; });
    const nG = Object.keys(gs).length, q = PJB.dk || {};
    if (DKF && gs[DKF.id]) chk(E.propsOf(DKF_ITEMS).main.length >= 8 && E.propsOf(DKF_ITEMS).yes.length >= 8, `the planted answer is one the parse reads (${E.propsOf(DKF_ITEMS).main.length} main lines, ${E.propsOf(DKF_ITEMS).yes.length} milestones)`);
    chk(nG > 0 ? !badDk.length && q.asked === nG && q.read + q.none + q.failed === q.asked : true, `props.js reads DraftKings' player lines on every game it projects: the answer as the job parses it, a 404 none posted yet, a failed read the last run's read or failed (${nG} games, ${q.read} read, ${q.none} none, ${q.failed} failed, ${q.kept || 0} kept; ${badDk.length} wrong${badDk[0] ? `, e.g. ${badDk[0]}: ${JSON.stringify(gs[badDk[0]].dk).slice(0, 160)}` : ''})`);
    const sgs = (SB.props && SB.props.games) || {}, notCopied = Object.keys(sgs).filter(id => JSON.stringify(sgs[id].dk) !== JSON.stringify(gs[id] && gs[id].dk));
    chk(!notCopied.length && JSON.stringify(SB.props && SB.props.dk) === JSON.stringify(PJB.dk), `the state carries each game's read as props.js wrote it (${Object.keys(sgs).length} games, ${notCopied.length} not)`);
  }
  const sm = run('smoke.js', [], { NHL_STATE: STB, NHL_DATA: B, NHL_PREV_STATE: PREVB, NHL_OUT: OUTB, NHL_PREV_LEDGER: path.join(REAL_DATA, 'props_ledger.json'), NHL_PREV_SUGGEST: fs.existsSync(path.join(REAL_DATA, 'suggest_ledger.json')) ? path.join(REAL_DATA, 'suggest_ledger.json') : 'none' }, 'smoke.js over B');
  chk(sm.status === 0 && / 0 failures/.test(sm.out), 'smoke over the real data through the new job: ' + sm.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));
  chk(run('sources.js', [], { NHL_STATE: STB, NHL_DATA: B }).status === 0, 'sources.js: every source read');
  /* the props model's record: every final asked for its closing props failing is a broken source; one failing among others a note */
  {
    const BP = mkdir('B-props'); for (const f of ['injuries.json', 'starters.json', 'props.json']) if (fs.existsSync(path.join(B, f))) fs.copyFileSync(path.join(B, f), path.join(BP, f));
    const pj = fs.existsSync(path.join(BP, 'props.json')) ? readJSON(path.join(BP, 'props.json')) : { v: 1, games: {} };
    fs.writeFileSync(path.join(BP, 'props.json'), JSON.stringify(Object.assign({}, pj, { record: { asked: 3, read: 0, none: 0, failed: 3, waiting: 0, why: 'HTTP 503' } })));
    const rp = run('sources.js', [], { NHL_STATE: STB, NHL_DATA: BP }, 'sources.js, every closing props request failed');
    chk(rp.status === 1 && /DraftKings props/.test(rp.out), 'every final asked for its closing props failing fails sources.js after the commit');
    fs.writeFileSync(path.join(BP, 'props.json'), JSON.stringify(Object.assign({}, pj, { record: { asked: 3, read: 1, none: 1, failed: 1, waiting: 0, why: 'HTTP 503' } })));
    const rq = run('sources.js', [], { NHL_STATE: STB, NHL_DATA: BP }, 'sources.js, one closing props request failed');
    chk(rq.status === 0 && /note: ESPN's DraftKings props/.test(rq.out), 'one failing among answers is a note');
    /* DraftKings' player lines on the games to come: every read failing is a broken source, some failing a note */
    fs.writeFileSync(path.join(BP, 'props.json'), JSON.stringify(Object.assign({}, pj, { dk: { asked: 5, read: 0, none: 0, failed: 5, kept: 2, lines: 0 } })));
    const rd = run('sources.js', [], { NHL_STATE: STB, NHL_DATA: BP }, "sources.js, every player lines read failed");
    chk(rd.status === 1 && /BROKEN: ESPN's DraftKings player lines: all 5 games/.test(rd.out), "every game's DraftKings player lines failing to read fails sources.js after the commit");
    fs.writeFileSync(path.join(BP, 'props.json'), JSON.stringify(Object.assign({}, pj, { dk: { asked: 5, read: 3, none: 1, failed: 1, kept: 0, lines: 120 } })));
    const re = run('sources.js', [], { NHL_STATE: STB, NHL_DATA: BP }, "sources.js, one player lines read failed");
    chk(re.status === 0 && /note: ESPN's DraftKings player lines: 1 of 5 games/.test(re.out), 'one failing among them is a note');
  }

  /* the refusals */
  const OUT2 = mkdir('B-sb-missing'); for (const f of fs.readdirSync(OUTB)) fs.copyFileSync(path.join(OUTB, f), path.join(OUT2, f));
  const needDay = SB.games.filter(g => g.state !== 'final' && g.date <= addDays(TODAY, 1)).map(g => g.date).sort()[0];
  if (needDay) {
    fs.rmSync(path.join(OUT2, `sb_${needDay}.json`));
    const before = fs.readFileSync(STB, 'utf8');
    const r = run('update.js', ['--offline'], Object.assign({}, env, { NHL_OUT: OUT2 }), 'update.js, a needed day unanswered');
    chk(r.status === 1 && /did not answer/.test(r.out), `a scoreboard day with games to finish or call (${needDay}) that does not answer fails the run`);
    chk(fs.readFileSync(STB, 'utf8') === before, 'and nothing is written: the last state stays');
  }
  const FX2 = mkdir('B-fx-noinj'); for (const f of fs.readdirSync(FX)) if (f !== 'injuries.json') fs.copyFileSync(path.join(FX, f), path.join(FX2, f));
  const pulled = injOut.pulled;
  const r2 = run('fetch_box.js', [], Object.assign({}, env, { NHL_FIXTURES: FX2 }), 'fetch_box.js, no injury report');
  chk(r2.status === 0 && readJSON(path.join(B, 'injuries.json')).pulled === pulled, 'an injury report that does not answer keeps the last one, and the run goes on');
  fs.writeFileSync(path.join(FX2, 'injuries.json'), JSON.stringify({ timestamp: NOW, status: 'success', injuries: [] }));
  const r3 = run('fetch_box.js', [], Object.assign({}, env, { NHL_FIXTURES: FX2 }), 'fetch_box.js, an empty injury report');
  chk(r3.status === 0 && readJSON(path.join(B, 'injuries.json')).pulled === pulled && Object.values(readJSON(path.join(B, 'injuries.json')).teams).some(l => l.length), 'an injury report that comes back empty is no report: the last one stays');
  const B0 = mkdir('B-noinj'); fs.copyFileSync(path.join(B, 'starters.json'), path.join(B0, 'starters.json'));
  fs.writeFileSync(path.join(B0, 'injuries.json'), JSON.stringify({ pulled: minute(Date.parse(NOW)), source: 'ESPN', teams: {} }));
  if (pre.length) chk(run('sources.js', [], { NHL_STATE: STB, NHL_DATA: B0 }, 'sources.js, a report with no rows').status === 1, 'an injury report in use with no rows, games to come, is a broken source');
  /* the page over a state whose injury report is a day old */
  const old = readJSON(STB); if (old.players && old.players.injuries) old.players.injuries.pulled = minute(Date.parse(old.published) - 20 * 3600000);
  const STALE = path.join(SCRATCH, 'B-stale.json'); fs.writeFileSync(STALE, JSON.stringify(old));
  const sm2 = run('smoke.js', [], { NHL_STATE: STALE, NHL_DATA: B, NHL_PREV_STATE: 'none' }, 'smoke.js, stale injury report');
  chk(sm2.status === 0, 'the page says the injury report is stale: ' + sm2.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 4).join(' | '));
  /* DailyFaceoff: silent, then a shape it cannot read, then dates or names it misreads, on a day with games */
  if (D) {
    const B2 = mkdir('B-dfo'); for (const f of ['starters.json']) fs.copyFileSync(path.join(B, f), path.join(B2, f));
    fs.copyFileSync(path.join(B, 'injuries.json'), path.join(B2, 'injuries.json'));
    const FX3 = mkdir('B-fx-nodfo');
    const envD = Object.assign({}, env, { NHL_DATA: B2, NHL_FIXTURES: FX3, NHL_TODAY: D });
    chk(run('starters.js', [], envD, 'starters.js, no answer').status === 0, 'DailyFaceoff silent: starters.js still exits 0');
    const s1 = readJSON(path.join(B2, 'starters.json'));
    chk(s1.ok === false && /did not answer/.test(s1.why) && s1.games.length === st.games.filter(e => e.date >= addDays(D, -1)).length, "DailyFaceoff silent: said, and the games already read stay for their own dates");
    chk(run('sources.js', [], { NHL_STATE: STB, NHL_DATA: B2 }).status === 0, 'DailyFaceoff silent is a warning, not a broken source');
    fs.writeFileSync(path.join(FX3, 'dailyfaceoff.html'), dfoPage([{ matchup: 'a shape nobody knows', goalies: ['x', 'y'] }]));
    run('starters.js', [], envD, 'starters.js, a new shape');
    const s2 = readJSON(path.join(B2, 'starters.json'));
    chk(s2.ok === false && /shape/.test(s2.why), "DailyFaceoff answering in a shape the job cannot read is said: " + s2.why);
    chk(run('sources.js', [], { NHL_STATE: STB, NHL_DATA: B2 }).status === 1, 'and sources.js fails the run after the commit');
    /* every game on the page dated three days off (a date format misread): nothing matches the schedule */
    const entry = (g, extra) => Object.assign({ homeTeamName: E.CLUBS[g.home].name, awayTeamName: E.CLUBS[g.away].name, homeGoalieName: 'Somebody Real', homeNewsStrengthName: 'Confirmed' }, extra);
    const off3 = onD.slice(0, 4).map(g => entry(g, { date: addDays(D, 3) })).filter(e => !SB.games.some(g => g.date === e.date && E.CLUBS[g.home].name === e.homeTeamName && E.CLUBS[g.away].name === e.awayTeamName));
    fs.writeFileSync(path.join(FX3, 'dailyfaceoff.html'), dfoPage(off3));
    run('starters.js', [], envD, 'starters.js, dates misread');
    const s3 = readJSON(path.join(B2, 'starters.json'));
    chk(s3.ok === false && /none matched the schedule/.test(s3.why) && (s3.unmatched || []).length === off3.length, `DailyFaceoff's games matching no game on the schedule are said, never applied silently: ${s3.why}`);
    chk(run('sources.js', [], { NHL_STATE: STB, NHL_DATA: B2 }).status === 1, 'and sources.js fails the run after the commit');
    /* one good, one matching nothing: the good one is used, the other kept aside */
    fs.writeFileSync(path.join(FX3, 'dailyfaceoff.html'), dfoPage([entry(onD[0], { date: D })].concat(off3.slice(0, 1))));
    run('starters.js', [], envD, 'starters.js, one game misread');
    const s4 = readJSON(path.join(B2, 'starters.json'));
    chk(s4.ok === true && s4.games.some(e => e.id === String(onD[0].id)) && (s4.unmatched || []).length === Math.min(1, off3.length) && !s4.games.some(e => !e.id), 'a game matching nothing is kept aside, the rest used');
  }
  /* ESPN moves a projected game's start between the job's two passes: props.js projected it on the first pass's start, so the
     second pass leaves its projection out for the run (props.js projects it again on its new start next run), and the page and
     the smoke stand on a game to come that has no projection. The game moved is one of a day with an earlier one (the latest
     such, the planted cases' games aside), an hour on within its own day, so the day's first puck drop and the suggested
     parlays' lock stay where they were */
  {
    const SBP = readJSON(STB), pj = new Set(Object.keys((SBP.props && SBP.props.games) || {}));
    const mv = SBP.games.filter(g => pj.has(g.id) && g.state === 'pre' && Date.parse(g.start) > Date.parse(NOW) && ![g1, g2, g3, DKF, DK404].some(x => x && x.id === g.id)
      && SBP.games.some(o => o.date === g.date && o.start < g.start) && E.etDate(minute(Date.parse(g.start) + 3600000)) === g.date).sort((a, b) => a.start < b.start ? 1 : -1)[0];
    if (!mv) console.log('  no projected game to come after another of its day, the planted cases\' games aside, to move between the passes: skipped');
    else {
      const ns = minute(Date.parse(mv.start) + 3600000), BM = dataDir('B-moved', B), OUTM = mkdir('B-sb-moved'), STM = path.join(SCRATCH, 'B-moved.json');
      for (const f of ['injuries.json', 'starters.json']) fs.copyFileSync(path.join(B, f), path.join(BM, f));
      for (const f of fs.readdirSync(OUTB)) fs.copyFileSync(path.join(OUTB, f), path.join(OUTM, f));
      const sbf = path.join(OUTM, `sb_${mv.date}.json`), sbj = readJSON(sbf), ev = sbj.events.find(e => e.id === String(mv.id));
      ev.date = ns; ev.competitions[0].date = ns; fs.writeFileSync(sbf, JSON.stringify(sbj));
      fs.copyFileSync(STB, STM);
      console.log(`  ESPN moves ${mv.away}@${mv.home}'s start from ${mv.start} to ${ns} between the passes, after props.js projected it`);
      const rm = run('update.js', ['--offline'], Object.assign({}, env, { NHL_DATA: BM, NHL_TEAMS: path.join(BM, 'teams.json'), NHL_OUT: OUTM, NHL_STATE: STM }), 'update.js, a start moved between the passes');
      const SM = rm.status === 0 ? readJSON(STM) : null, gm = SM && SM.games.find(g => g.id === mv.id), left = SM && SM.props ? Object.keys(SM.props.games) : [];
      chk(!!gm && gm.start === ns && !left.includes(mv.id) && left.length === pj.size - 1, `a game whose start ESPN moved between the passes is published on its new start with no projection made on its old one, the rest kept (exit ${rm.status}; ${gm && gm.start}; ${left.length} of ${pj.size} projected)`);
      const smM = run('smoke.js', [], { NHL_STATE: STM, NHL_DATA: BM, NHL_PREV_STATE: STB, NHL_OUT: OUTM, NHL_PREV_LEDGER: path.join(B, 'props_ledger.json'), NHL_PREV_SUGGEST: fs.existsSync(path.join(B, 'suggest_ledger.json')) ? path.join(B, 'suggest_ledger.json') : 'none' }, 'smoke.js over a start moved between the passes');
      chk(smM.status === 0 && / 0 failures/.test(smM.out), 'smoke over a start moved between the passes: ' + smM.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));
    }
  }
  return { B, NOW, D, FX, OUTB, dfo, starts, lastOf, feedPlain, avail: freeOf(feedPlain), planted: [X, Y, Z].filter(Boolean) };
}

/* ---------- B2. the first evening after a change: games under way, the published calls an older job's ---------- */
function partB2(b) {
  const NOW0 = Date.parse(real.published);
  const D = b.D, onD = real.games.filter(g => g.date === D && g.state === 'pre' && Date.parse(g.start) > NOW0).sort((x, y) => x.start < y.start ? -1 : 1);
  if (!onD.length) { console.log('B2. no game day ahead in the published state: skipped'); return; }
  const EVE = minute(Date.parse(onD[0].start) + 65 * 60000), TODAY = E.etDate(EVE);
  console.log(`B2. ${D} at ${EVE}: the first puck drops passed, no box score yet, the published calls the last run's, the injury report as published`);
  const DB = dataDir('B2'), OUTE = mkdir('B2-sb'), STE = path.join(SCRATCH, 'B2-state.json'), FXE = mkdir('B2-fx');
  fs.copyFileSync(path.join(ROOT, 'state.json'), STE);
  /* the box scores' summaries as in B; the injury report as published, nothing planted; DailyFaceoff below */
  for (const f of fs.readdirSync(b.FX).filter(f => /^summary_/.test(f))) fs.copyFileSync(path.join(b.FX, f), path.join(FXE, f));
  fs.writeFileSync(path.join(FXE, 'injuries.json'), JSON.stringify({ timestamp: EVE, status: 'success', injuries: Object.entries(b.feedPlain).map(([c, l]) => ({ id: E.CLUBS[c].id, displayName: E.CLUBS[c].name, injuries: l })) }));
  const live = g => g.date === D && Date.parse(g.start) <= Date.parse(EVE);
  /* last night, over and not boxed, DailyFaceoff had confirmed a club's second goalie: tonight is the other one's,
     not the second goalie's again on the guess that the usual starter played */
  const boxedIds = new Set(); for (const f of fs.readdirSync(REAL_DATA).filter(f => /^box_\d+\.jsonl$/.test(f))) for (const l of fs.readFileSync(path.join(REAL_DATA, f), 'utf8').split('\n')) if (l) boxedIds.add(JSON.parse(l).id);
  const lastNight = real.games.filter(g => g.date === addDays(D, -1) && !boxedIds.has(String(g.id)) && !fs.existsSync(path.join(b.FX, `summary_${g.id}.json`)));
  /* on a club with two goalies players.js can start tonight (the second one confirmed last night among them): with one, the
     model rightly names him both nights */
  let conf = null;
  for (const g of lastNight) for (const c of [g.home, g.away]) {
    const tonight = real.games.find(x => x.date === D && (x.home === c || x.away === c) && Date.parse(x.start) > Date.parse(EVE));
    if (!conf && tonight && b.avail(c).length >= 2) conf = { g, c, tonight, second: b.avail(c)[1] };
  }
  if (!conf) console.log(lastNight.length ? "  no club of last night's games not boxed with a game tonight and two goalies to start: the confirmed backup case is skipped" : '  no game of last night left unboxed: the confirmed backup case is skipped');
  if (conf) {
    const side = conf.g.home === conf.c ? 'home' : 'away';
    fs.writeFileSync(path.join(FXE, 'dailyfaceoff.html'), dfoPage([{ date: conf.g.date, homeTeamName: E.CLUBS[conf.g.home].name, awayTeamName: E.CLUBS[conf.g.away].name, [side + 'GoalieName']: conf.second.name, [side + 'NewsStrengthName']: 'Confirmed' }]));
    console.log(`  DailyFaceoff had confirmed ${conf.second.name} for ${conf.c} last night (${conf.g.away}@${conf.g.home}, over, no box score yet)`);
  }
  writeDays(OUTE, feedOf(real.games, (g, ev) => {
    if (g.date < D && g.state !== 'final') Object.assign(ev, event(g, { state: 'post', hs: 3, as: 2, periods: 3, type: g.type }));       // last night's: over, not all boxed
    else if (live(g)) Object.assign(ev, event(g, { state: 'in', hs: 1, as: 0, periods: 1, detail: '12:00 - 1st', type: g.type }));
  }));
  const env = { NHL_DATA: DB, NHL_STATE: STE, NHL_TEAMS: path.join(DB, 'teams.json'), NHL_OUT: OUTE, NHL_FIXTURES: FXE, NHL_NOW: EVE, NHL_TODAY: TODAY, NHL_SEASON: String(SEASON) };
  for (const { s, r } of runJob(env, 'B2')) chk(r.status === 0, `the evening run: ${s} runs`);
  const S2 = readJSON(STE);
  const byId = new Map(real.games.map(g => [g.id, g]));
  const CALL = ['pHome', 'mu', 'xt', 'frozen', 'pm', 'line', 'pick', 'mlPick', 'plPick', 'ouPick'];
  for (const g of S2.games.filter(live)) { const p = byId.get(g.id); const moved = CALL.filter(k => JSON.stringify(g[k] ?? null) !== JSON.stringify(p[k] ?? null)); chk(!moved.length, `a game under way keeps the published call: ${g.away}@${g.home} ${moved.join(', ')}`); }
  /* the case the smoke must not trip on: tomorrow's back to back after a game under way, its card an older run's goalie */
  const after = S2.games.filter(g => g.date === addDays(D, 1) && g.pm).flatMap(g => ['home', 'away'].map(side => ({ g, c: g[side], t: g.pm[side] })))
    .filter(x => x.t && x.t.goalie && /back to back/.test(x.t.goalie.how) && S2.games.some(y => live(y) && (y.home === x.c || y.away === x.c)));
  console.log(`  ${after.length} club(s) on the second night of a back to back whose first is under way: ${after.map(x => `${x.c} (${x.t.goalie.name})`).join(', ') || 'none in this schedule'}`);
  if (conf) {
    const t = S2.games.find(g => g.id === conf.tonight.id), gl = t && t.pm && t.pm[t.home === conf.c ? 'home' : 'away'].goalie;
    chk(gl && gl.id !== conf.second.id, `${conf.c} tonight: not ${conf.second.name} again, whom DailyFaceoff confirmed for last night's game not yet boxed (${gl && gl.name}, ${gl && gl.how})`);
  }
  const sm = run('smoke.js', [], { NHL_STATE: STE, NHL_DATA: DB, NHL_PREV_STATE: path.join(ROOT, 'state.json'), NHL_PREV_LEDGER: path.join(REAL_DATA, 'props_ledger.json') }, 'smoke.js over the evening, against the published state');
  chk(sm.status === 0 && / 0 failures/.test(sm.out), 'smoke over the first evening after a change: ' + sm.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));

  /* B3. rows an older job rewrote after puck drop (the margin and the puck-line, total and overtime chances
     recomputed on the team Elo's margin, whose call it was and the team Elo's view dropped) are put back to the
     call shown before puck drop, every field of it: the published pre-game rows of the evening's games under way,
     rewritten the older job's way, then the job's second pass over them */
  const r3 = x => +x.toFixed(3);
  const LATE = minute(Date.parse(onD.map(g => g.start).filter(t => Date.parse(t) >= Date.parse(D + 'T23:00Z'))[0] || onD[onD.length - 1].start) + 5 * 60000);
  const playedSince = new Set(real.games.filter(g => g.state !== 'pre' && g.date < D && g.state !== 'final').flatMap(g => [g.home, g.away]));
  const legacy = real.games.filter(g => g.date === D && g.state === 'pre' && Date.parse(g.start) <= Date.parse(LATE) && g.by === 'players' && g.line && !playedSince.has(g.home) && !playedSince.has(g.away));
  if (!legacy.length) { console.log('B3. no published call by the player model under way at the late puck drop: skipped'); return; }
  console.log(`B3. ${legacy.length} published calls rewritten the older job's way after puck drop, put back at ${LATE}`);
  const OUTL = mkdir('B3-sb'), STL = path.join(SCRATCH, 'B3-state.json');
  writeDays(OUTL, feedOf(real.games, (g, ev) => {
    if (g.date < D && g.state !== 'final') Object.assign(ev, event(g, { state: 'post', hs: 3, as: 2, periods: 3, type: g.type }));
    else if (g.date === D && Date.parse(g.start) <= Date.parse(LATE)) Object.assign(ev, event(g, { state: 'in', hs: 1, as: 1, periods: 2, detail: '5:00 - 2nd', type: g.type }));
  }));
  const older = JSON.parse(JSON.stringify(real));
  for (const g of older.games) {
    if (!legacy.some(x => x.id === g.id)) continue;
    const mu = spreadOf(g.diff, model), G = goals(g.xt, mu, g.diff, model.pull);
    /* the older job wrote neither callV nor before: rows that carry them are this job's and copied as they are */
    Object.assign(g, { state: 'live', hs: 1, as: 1, mu: +mu.toFixed(2), tie: r3(G.tie) }); delete g.by; delete g.elo; delete g.callV; delete g.before;
    if (g.line.homeLine !== null && g.line.homeLine !== undefined) { const cp = coverProbs(G, g.line.homeLine); g.cover = { home: r3(cp.cover), push: r3(cp.push), away: r3(cp.lose) }; g.plEdge = { home: r3(cp.cover - (g.line.homeSpreadOdds > 0 ? 100 / (g.line.homeSpreadOdds + 100) : -g.line.homeSpreadOdds / (-g.line.homeSpreadOdds + 100))), away: r3(cp.lose - (g.line.awaySpreadOdds > 0 ? 100 / (g.line.awaySpreadOdds + 100) : -g.line.awaySpreadOdds / (-g.line.awaySpreadOdds + 100))) }; g.plPick = g.plEdge.home >= 0.05 ? 'home' : g.plEdge.away >= 0.05 ? 'away' : null; }
    if (g.line.total !== null && g.line.total !== undefined) { const tp = totalProbs(G, g.line.total), imp = am => am > 0 ? 100 / (am + 100) : -am / (-am + 100); g.ou = { over: r3(tp.over), push: r3(tp.push), under: r3(tp.under) }; g.ouEdge = { over: r3(tp.over - imp(g.line.overOdds)), under: r3(tp.under - imp(g.line.underOdds)) }; g.ouPick = g.ouEdge.over >= 0.05 ? 'over' : g.ouEdge.under >= 0.05 ? 'under' : null; }
  }
  fs.writeFileSync(STL, JSON.stringify(older));
  const rl = run('update.js', ['--offline'], Object.assign({}, env, { NHL_STATE: STL, NHL_OUT: OUTL, NHL_NOW: LATE, NHL_TODAY: E.etDate(LATE) }), 'B3: update.js');
  chk(rl.status === 0, 'the second pass over rows an older job rewrote runs');
  const SL = readJSON(STL);
  const FIELDS = ['pHome', 'rh', 'ra', 'diff', 'mu', 'xt', 'tie', 'frozen', 'pm', 'elo', 'by', 'line', 'pick', 'mlEdge', 'mlPick', 'cover', 'plEdge', 'plPick', 'ou', 'ouEdge', 'ouPick'];
  for (const p of legacy) {
    const n = SL.games.find(g => g.id === p.id), moved = n ? FIELDS.filter(k => JSON.stringify(n[k] ?? null) !== JSON.stringify(p[k] ?? null)) : ['missing'];
    chk(!moved.length, `a call an older job rewrote after puck drop is put back to the one shown before it, every field: ${p.away}@${p.home} ${moved.map(k => `${k} ${JSON.stringify(p[k])} -> ${JSON.stringify(n && n[k])}`).join('; ').slice(0, 240)}`);
  }
}

/* ---------- B4. a start moved later after its puck drop, the injury report re-pulled since the call ---------- */
function partB4(b) {
  const NOW0 = Date.parse(real.published), D = b.D;
  /* never a game the published state already holds as delayed: the job keeps its call, which is not this run's */
  const onD = real.games.filter(g => g.date === D && g.state === 'pre' && Date.parse(g.start) > NOW0 && !delayedAt(g, NOW0)).sort((x, y) => x.start < y.start ? -1 : 1);
  const G = onD[0], S0 = G && Date.parse(G.start), T1 = G && minute(Math.max(NOW0 + 60000, S0 - 30 * 60000));
  if (!G || Date.parse(T1) >= S0 - 60000) { console.log('B4. no game day ahead with time to call before its first puck drop: skipped'); return; }
  /* the start moved ninety minutes on, or to the last minute of its own Eastern day where that is sooner: a move past midnight
     Eastern is a game moved to another day, a game to come again (A's run 1c), not this case */
  let mv = S0 + 90 * 60000; while (mv > S0 + 31 * 60000 && E.etDate(minute(mv)) !== D) mv -= 60000;
  const T2 = minute(S0 + 30 * 60000), MOVED = minute(mv);
  if (E.etDate(MOVED) !== D || Date.parse(MOVED) <= Date.parse(T2)) { console.log(`B4. ${G.away}@${G.home} drops the puck too near midnight Eastern to move its start later on its own day: skipped`); return; }
  console.log(`B4. ${G.away}@${G.home} on ${D}: called at ${T1}, its ${G.start} puck drop moved to ${MOVED} after it passed; the job runs again at ${T2} on a newer injury report`);
  const DB = dataDir('B4'), OUT4 = mkdir('B4-sb'), ST4 = path.join(SCRATCH, 'B4-state.json'), R1 = path.join(SCRATCH, 'B4-run1.json'), FX1 = mkdir('B4-fx1'), FX2 = mkdir('B4-fx2');
  fs.copyFileSync(path.join(ROOT, 'state.json'), ST4);
  /* last night's games over, each with a box score to read in the first run, so the second asks ESPN for none */
  const over = real.games.filter(g => g.date < D && g.state !== 'final' && b.lastOf(g.home) && b.lastOf(g.away));
  for (const f of fs.readdirSync(b.FX).filter(f => /^summary_/.test(f))) fs.copyFileSync(path.join(b.FX, f), path.join(FX1, f));      // finals the committed files lack, as in B
  for (const g of over) fs.writeFileSync(path.join(FX1, `summary_${g.id}.json`), JSON.stringify(summaryOf(madeBox(g, b.lastOf(g.home), b.lastOf(g.away)))));
  const feedAt = (now, moved) => feedOf(real.games, (g, ev) => {
    if (over.some(x => x.id === g.id)) Object.assign(ev, event(g, { state: 'post', hs: 3, as: 2, periods: 3, type: g.type }));
    else if (moved && g.id === G.id) Object.assign(ev, event(Object.assign({}, g, { start: MOVED }), { state: 'pre', odds: oddsOfLine(g.line, g), type: g.type }));
    else if (g.date === D && g.state !== 'final' && Date.parse(g.start) <= Date.parse(now)) Object.assign(ev, event(g, { state: 'in', hs: 0, as: 0, periods: 1, detail: '15:00 - 1st', type: g.type }));
  });
  /* run 1: the call before puck drop, on the report the last run pulled (the feed not answering: it stays), stamped
     an hour before this simulation's clock so the second run's pull is newer whenever it runs */
  const injFeed = list => ({ timestamp: T1, status: 'success', injuries: Object.entries(list).map(([c, l]) => ({ id: E.CLUBS[c].id, displayName: E.CLUBS[c].name, injuries: l })) });
  const pulled1 = minute(Date.now() - 3600000);
  fs.writeFileSync(path.join(DB, 'injuries.json'), JSON.stringify(injuriesOf(injFeed(b.feedPlain), pulled1)));
  const env = (now, fx) => ({ NHL_DATA: DB, NHL_STATE: ST4, NHL_TEAMS: path.join(DB, 'teams.json'), NHL_OUT: OUT4, NHL_FIXTURES: fx, NHL_NOW: now, NHL_TODAY: E.etDate(now), NHL_SEASON: String(SEASON) });
  writeDays(OUT4, feedAt(T1, false));
  for (const { s, r } of runJob(env(T1, FX1), 'B4 run 1')) chk(r.status === 0, `B4, the call before puck drop: ${s} runs`);
  fs.copyFileSync(ST4, R1);
  const R1L = path.join(SCRATCH, 'B4-run1-ledger.json'); if (fs.existsSync(path.join(DB, 'props_ledger.json'))) fs.copyFileSync(path.join(DB, 'props_ledger.json'), R1L);
  const R1S = path.join(SCRATCH, 'B4-run1-suggest.json'); if (fs.existsSync(path.join(DB, 'suggest_ledger.json'))) fs.copyFileSync(path.join(DB, 'suggest_ledger.json'), R1S);
  const g1 = readJSON(R1).games.find(g => g.id === G.id), gl = g1 && g1.pm && g1.pm.home && g1.pm.home.goalie;
  chk(g1 && g1.state === 'pre' && g1.frozen === T1 && g1.before === G.start && g1.pm && g1.pm.inj === pulled1 && gl, `${G.away}@${G.home} is called before its puck drop on the report of ${pulled1}: ${g1 && [g1.frozen, g1.before, g1.pm && g1.pm.inj].join(' ')}`);
  if (!gl) return;
  /* run 2: the puck drop passed, the feed has the game scheduled 90 minutes on; the injury report re-pulled with the goalie on
     the card now on injured reserve, and DailyFaceoff confirming another for that game */
  const feed2 = JSON.parse(JSON.stringify(b.feedPlain));
  (feed2[G.home] = feed2[G.home] || []).push(injRow(gl.name, 'G', 'Injured Reserve', gl.id, 'Upper Body'));
  fs.writeFileSync(path.join(FX2, 'injuries.json'), JSON.stringify(injFeed(feed2)));
  const other = b.starts(G.home).find(x => x.id !== gl.id);
  if (other) fs.writeFileSync(path.join(FX2, 'dailyfaceoff.html'), dfoPage([{ date: D, homeTeamName: E.CLUBS[G.home].name, awayTeamName: E.CLUBS[G.away].name, homeGoalieName: other.name, homeNewsStrengthName: 'Confirmed' }]));
  writeDays(OUT4, feedAt(T2, true));
  for (const { s, r } of runJob(env(T2, FX2), 'B4 run 2')) chk(r.status === 0, `B4, the run after the puck drop moved: ${s} runs`);
  const S2 = readJSON(ST4), g2 = S2.games.find(g => g.id === G.id), pulled2 = readJSON(path.join(DB, 'injuries.json')).pulled;
  chk(pulled2 !== pulled1, `the injury report was re-pulled between the runs (${pulled1} -> ${pulled2})`);
  const CALL = ['pHome', 'rh', 'ra', 'diff', 'mu', 'xt', 'tie', 'frozen', 'before', 'pm', 'elo', 'by', 'line', 'pick', 'mlEdge', 'mlPick', 'cover', 'plEdge', 'plPick', 'ou', 'ouEdge', 'ouPick'];
  const moved = g2 ? CALL.filter(k => JSON.stringify(g2[k] ?? null) !== JSON.stringify(g1[k] ?? null)) : ['missing'];
  chk(g2 && g2.state === 'pre' && g2.start === MOVED && !moved.length, `a game whose start the feed moved later after its puck drop keeps the call made before it, ${gl.name} in goal on the report of ${pulled1}: ${moved.join(', ')}`);
  const sm = run('smoke.js', [], { NHL_STATE: ST4, NHL_DATA: DB, NHL_PREV_STATE: R1, NHL_PREV_LEDGER: fs.existsSync(R1L) ? R1L : 'none', NHL_PREV_SUGGEST: fs.existsSync(R1S) ? R1S : 'none' }, 'smoke.js over the delayed game, against the run before its puck drop');
  chk(sm.status === 0 && / 0 failures/.test(sm.out), 'smoke over a start moved later after its puck drop, the report re-pulled since: ' + sm.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));
}

/* ---------- B5. a day's only game moved by the feed to another day, under the same id: that day answers blank ---------- */
function partB5() {
  const NOW0 = Date.parse(real.published), count = {};
  for (const g of real.games) count[g.date] = (count[g.date] || 0) + 1;
  const lone = real.games.find(g => g.state === 'pre' && Date.parse(g.start) > NOW0 + 2 * 86400000 && count[g.date] === 1);
  if (!lone) { console.log('B5. no day ahead with a single game: skipped'); return; }
  const NOW = addDays(lone.date, -1) + 'T15:00Z', newStart = minute(Date.parse(lone.start) + 2 * 86400000), newDay = E.etDate(newStart);
  console.log(`B5. ${lone.away}@${lone.home}, the only game of ${lone.date}, moved by the feed to ${newDay}; the job runs on ${E.etDate(NOW)}`);
  const DB = dataDir('B5'), OUT5 = mkdir('B5-sb'), ST5 = path.join(SCRATCH, 'B5-state.json');
  fs.copyFileSync(path.join(ROOT, 'state.json'), ST5);
  const byDate = feedOf(real.games, g => g.id !== lone.id);
  byDate[lone.date] = [];
  (byDate[newDay] = byDate[newDay] || []).push(event(Object.assign({}, lone, { start: newStart, date: newDay }), { state: 'pre', odds: oddsOfLine(lone.line, lone), type: lone.type }));
  writeDays(OUT5, byDate);
  const r = run('update.js', ['--offline'], { NHL_DATA: DB, NHL_STATE: ST5, NHL_TEAMS: path.join(DB, 'teams.json'), NHL_OUT: OUT5, NHL_NOW: NOW, NHL_TODAY: E.etDate(NOW), NHL_SEASON: String(SEASON) }, 'B5: update.js');
  const S5 = readJSON(ST5), g = S5.games.find(x => x.id === lone.id);
  chk(r.status === 0 && g && g.date === newDay && g.start === newStart && !(S5.removed || []).some(x => x.id === lone.id), `the day a lone game moved from answers blank and the run goes on, the game on its new day (exit ${r.status}, ${g ? g.date : 'gone'})`);
}

/* ---------- A. a fabricated season through update.js ---------- */
function partA(B) {
  console.log('A. a fabricated season on the real schedule: calls made, kept at puck drop, graded');
  const DA = dataDir('A', B), OUT = mkdir('A-sb'), STATE = path.join(SCRATCH, 'A-state.json'), SGA = path.join(DA, 'suggest_ledger.json');
  if (fs.existsSync(SGA)) fs.rmSync(SGA);                  // an invented season keeps a record of its own: the real one's days are graded on real scores
  /* nor does it carry B's props projections: those are the real day's games, read at B's clock, and from about six weeks into a
     season (this one's 18 November) the real day is past this part's clocks, so those games are still to come here and their
     DraftKings reads, stamped at the real clock, would come after every publish this part makes */
  { const f = path.join(DA, 'props.json'); if (fs.existsSync(f)) { const pj = readJSON(f); pj.games = {}; fs.writeFileSync(f, JSON.stringify(pj)); } }
  let games = real.games.filter(g => g.type === 2).map(g => ({ id: g.id, date: g.date, start: g.start, home: g.home, away: g.away, neutral: g.neutral, mu: g.mu, xt: g.xt, diff: g.diff }));
  if (games.length < 400) {
    /* the summer after the rollover, before the schedule is out: the last finished season's, a year on, stands in */
    const hist = Hist.rows(REAL_DATA), last = Math.max(...hist.filter(r => r.season < SEASON).map(r => r.season));
    /* a whole number of weeks on (the weekdays kept), at least a year, so its first night lands inside the days update.js reads
       (from 1 October): 2026-27 opened on 1 October, and a year of 364 days put its opening night on 30 September */
    const rows0 = hist.filter(r => r.season === last && r.type === 2), f0 = rows0.map(r => r.date).sort()[0];
    let shift = 364; while (f0 && addDays(f0, shift) < `${SEASON - 1}-10-01`) shift += 7;
    games = rows0.map((r, i) => { const date = addDays(r.date, shift); return { id: '8' + r.id, date, start: date + (i % 6 === 0 ? 'T17:00Z' : i % 6 === 1 ? 'T23:30Z' : 'T23:00Z'), home: r.home, away: r.away, neutral: !!r.neutral }; });
    console.log(`  no schedule this season yet: ${last}'s ${games.length} games a year on stand in`);
  }
  const first = games[0].date;
  /* a day six weeks in whose games start at different times, so an evening run finds some under way and some not */
  let T0 = addDays(first, 45);
  const busy = (d, n) => games.filter(g => g.date === d).length >= n && new Set(games.filter(g => g.date === d).map(g => g.start)).size >= 2;
  /* the evening's first puck drop (below) leaves four games or more under way by it, one each to be delayed, moved, moved to
     another day and kept under way, and four still to come for run 1d after it, that day's and the next day's */
  const firstStartOf = day => { const st = [...new Set(day.map(g => g.start))].sort(); return [4, 3].map(n => st.find(t => day.filter(g => g.start <= t).length >= n && day.some(g => g.start > t))).find(Boolean) || (day.filter(g => g.start <= st[0]).length >= 2 || st.length < 3 ? st[0] : st[1]); };
  const shapeOk = d => { const day = games.filter(g => g.date === d), fs0 = day.length && firstStartOf(day); if (!fs0) return false;
    const come = day.filter(g => Date.parse(g.start) > Date.parse(fs0) + 25 * 60000).length + games.filter(g => g.date === addDays(d, 1)).length;
    return day.filter(g => g.start <= fs0).length >= 4 && day.some(g => g.start > fs0) && come >= 4; };
  const lastDay = games.map(g => g.date).sort().pop(), span = Math.round((Date.parse(lastDay) - Date.parse(first)) / 86400000);
  T0 = [[45, 75], [30, span - 21]].map(([a, z]) => [6, 2].map(n => { for (let i = a; i < z; i++) if (busy(addDays(first, i), n) && shapeOk(addDays(first, i))) return addDays(first, i); return null; }).find(Boolean)).find(Boolean)
    || [6, 2].map(n => { for (let i = 45; i < 75; i++) if (busy(addDays(first, i), n)) return addDays(first, i); return null; }).find(Boolean) || T0;
  const shaped = shapeOk(T0);
  if (!shaped) console.log(`  no day of this schedule has four games under way by its first puck drop and four to come after it: the cases that need them are skipped`);
  const T1 = addDays(T0, 1);
  const results = {}, lines = {};
  /* the feed: finals through a day, games under way, lines; `start` moves a game's puck drop (a delay, or another day) */
  const feed = (through, opts = {}, dir = OUT) => {
    const byDate = {};
    for (const g0 of games) {
      const ns = opts.start && opts.start(g0), g = ns ? Object.assign({}, g0, { start: ns, date: E.etDate(ns) }) : g0;
      let x;
      if (g.date <= through) { results[g.id] = results[g.id] || score(g); x = Object.assign({ state: 'post' }, results[g.id]); }
      else if (opts.live && opts.live(g)) { const r = results[g.id] = results[g.id] || score(g); x = { state: 'in', hs: Math.min(r.hs, 1), as: Math.min(r.as, 1), periods: 2, detail: '8:12 - 2nd' }; }
      else { const on = (opts.lines || []).includes(g0.date); if (on && (!lines[g.id] || opts.move)) lines[g.id] = invented(g, !opts.move ? 0 : opts.flip && g.id === opts.flip.id ? ((opts.flip.home ? 1 : -1) * 120 - (g.diff || 0)) || 1 : 40); x = { state: 'pre', odds: on ? oddsOfLine(lines[g.id], g, { links: opts.links }) : undefined }; }
      (byDate[g.date] = byDate[g.date] || []).push(event(g, x));
    }
    writeDays(dir, byDate);
  };
  const env = now => ({ NHL_TODAY: E.etDate(now), NHL_NOW: now, NHL_STATE: STATE, NHL_OUT: OUT, NHL_TEAMS: path.join(DA, 'teams.json'), NHL_DATA: DA, NHL_SEASON: String(SEASON) });
  console.log(`  finals through ${addDays(T0, -1)}, lines on ${T0} and ${T1}`);
  /* run 1: the morning of T0 */
  feed(addDays(T0, -1), { lines: [T0, T1] });
  chk(run('update.js', ['--offline'], env(T0 + 'T12:00Z'), 'run 1, the morning').status === 0, 'run 1');
  const A = readJSON(STATE); fs.copyFileSync(STATE, path.join(SCRATCH, 'A-morning.json'));
  const dayA = A.games.filter(g => g.date === T0);
  chk(dayA.length > 0 && dayA.every(g => g.state === 'pre' && g.line && g.frozen && g.callV), `every game on ${T0} has a call and a line (${dayA.length})`);
  chk(dayA.every(g => g.cover && g.ou && g.mlEdge), 'each call has cover, total and moneyline chances');
  chk(dayA.some(g => g.mlPick || g.plPick || g.ouPick), 'some side is taken on the day');
  const PMA = readJSON(path.join(DA, 'players.json'));
  if (dayA.some(g => PMA.upcoming && PMA.upcoming[g.id])) chk(dayA.some(g => g.by === 'players'), "the player model's call is made on the day");
  chk(A.games.filter(g => g.result).length === games.filter(g => g.date < T0).length, 'every earlier game is graded from the replay');
  chk(A.games.filter(g => g.result).every(g => !g.frozen && !g.line), 'a replayed game carries no line and no call made before it');
  /* DraftKings' ids: every game lined this morning carries the feed's, read whole, with no carried date */
  const linedA = A.games.filter(g => (g.date === T0 || g.date === T1) && g.line);
  chk(linedA.length > 0 && linedA.every(g => g.line.dk && JSON.stringify(g.line.dk) === JSON.stringify(idsOnly(lines[g.id].dk)) && !('at' in g.line.dk)), `every line on ${T0} and ${T1} carries DraftKings' ids as the feed gave them (${linedA.filter(g => g.line.dk).length} of ${linedA.length})`);
  /* the models are untouched: the same answers with no links at all give every field but the ids, and every call field but line.dk */
  {
    const NL = mkdir('A-sb-nolinks'), SNL = path.join(SCRATCH, 'A-nolinks.json');
    let same = 0, diff = [];
    for (const f of fs.readdirSync(OUT)) {
      const j = readJSON(path.join(OUT, f)), k = JSON.parse(JSON.stringify(j));
      for (const ev of k.events || []) { const o = ev.competitions && ev.competitions[0] && ev.competitions[0].odds && ev.competitions[0].odds[0]; if (!o) continue; delete o.link; for (const m of [o.moneyline, o.pointSpread, o.total]) for (const side of Object.values(m || {})) if (side && side.close) delete side.close.link; }
      fs.writeFileSync(path.join(NL, f), JSON.stringify(k));
      if (f === `sb_${T0}.json` || f === `sb_${T1}.json`) (j.events || []).forEach((ev, i) => { const a = E.gameRow(ev), b = E.gameRow(k.events[i]); if (!a || !a.odds) return; const x = Object.assign({}, a.odds); delete x.dk; if (JSON.stringify(x) === JSON.stringify(b.odds) && !('dk' in b.odds) && a.odds.dk) same++; else diff.push(ev.id); });
    }
    chk(same > 0 && !diff.length, `oddsOf on answers with links and without agrees on every field but the ids (${same} games${diff.length ? ', differ on ' + diff.slice(0, 3).join(', ') : ''})`);
    const rn = run('update.js', ['--offline'], Object.assign(env(T0 + 'T12:00Z'), { NHL_OUT: NL, NHL_STATE: SNL }), 'run 1 again, the answers with no links');
    const NLS = rn.status === 0 ? readJSON(SNL) : null, byNL = new Map((NLS ? NLS.games : []).map(g => [g.id, g]));
    const CALLF = ['pHome', 'rh', 'ra', 'diff', 'mu', 'xt', 'tie', 'frozen', 'before', 'pm', 'elo', 'by', 'line', 'pick', 'mlEdge', 'mlPick', 'cover', 'plEdge', 'plPick', 'ou', 'ouEdge', 'ouPick', 'result'];
    const strip = g => { const c = {}; for (const k of CALLF) c[k] = g[k] === undefined ? null : g[k]; if (c.line) { c.line = Object.assign({}, c.line); delete c.line.dk; } return JSON.stringify(c); };
    const moved = A.games.filter(g => !byNL.has(g.id) || strip(g) !== strip(byNL.get(g.id)));
    chk(NLS && !moved.length && !NLS.games.some(g => g.line && g.line.dk), `every call field but line.dk is the same on answers with no links (${moved.length} differ${moved[0] ? ', e.g. ' + moved[0].id : ''})`);
  }
  const byIdA = Object.fromEntries(dayA.map(g => [g.id, g]));
  const CALL = ['pHome', 'rh', 'ra', 'diff', 'mu', 'xt', 'tie', 'frozen', 'before', 'pm', 'elo', 'by', 'line', 'pick', 'mlEdge', 'mlPick', 'cover', 'plEdge', 'plPick', 'ou', 'ouEdge', 'ouPick'];
  const same = (a, b) => CALL.filter(k => JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null));
  /* run 1b: that evening, the earliest games under way (one still "scheduled" in the feed, one whose puck drop the
     feed has moved an hour later after it passed), the lines moved on the rest. The job's first pass reads the
     scores a minute before the first puck drop, the second a few minutes after it: the call graded on the games
     that started between the two is the one the page showed, made in the morning, never one the first pass made */
  const firstStart = firstStartOf(dayA);
  const evening = minute(Date.parse(firstStart) + 5 * 60000), justBefore = minute(Date.parse(firstStart) - 60000);
  const early = dayA.filter(g => g.start <= firstStart), late = dayA.filter(g => g.start > firstStart);
  const delayed = early[early.length - 1], moved = early.length >= 3 ? early[early.length - 2] : null;
  const movedStart = moved && minute(Date.parse(moved.start) + 60 * 60000);
  /* the line moved on the first game still to come puts the other club in front (the morning's favourite 120 Elo behind, past the
     noise), so a flipped favourite's puck line ids are always in the test, whatever the real ratings make of the other games */
  const flip = late[0] ? { id: late[0].id, home: !(lines[late[0].id].homeLine < 0) } : null;
  feed(addDays(T0, -1), { lines: [T0, T1], move: true, flip });
  const rs = run('update.js', ['--offline', '--scores'], env(justBefore), 'run 1b, the first pass a minute before puck drop');
  chk(rs.status === 0, 'the first pass runs');
  const AS = readJSON(STATE);
  chk(AS.pass === 'scores', 'the first pass marks its state as the first pass\'s');
  for (const g of dayA) { const n = AS.games.find(x => x.id === g.id); chk(n && !same(n, g).length && n.frozen !== justBefore, `the first pass copies the call it found, and makes none: ${g.id} ${n ? same(n, g).join(', ') : 'missing'}`); }
  feed(addDays(T0, -1), { lines: [T0, T1], move: true, flip, live: g => g.date === T0 && g.start <= firstStart && g.id !== delayed.id && (!moved || g.id !== moved.id), start: g => moved && g.id === moved.id ? movedStart : null });
  chk(run('update.js', ['--offline'], env(evening), 'run 1b, the second pass after puck drop').status === 0, 'run 1b');
  const A2 = readJSON(STATE); fs.copyFileSync(STATE, path.join(SCRATCH, 'A-evening.json'));
  /* the record's ledger as the evening left it: runs 1c and 1d are other versions of that evening, each from it, and the morning
     after (run 2) goes on from it too, so none of them carries another's record; each is held against it as the last ledger */
  const SGA_EVE = path.join(SCRATCH, 'A-evening-suggest.json'); fs.copyFileSync(SGA, SGA_EVE);
  for (const g of early) {
    const n = A2.games.find(x => x.id === g.id);
    chk(!same(n, g).length, `a call is kept from puck drop on (${n.state}${n.state === 'pre' ? (moved && g.id === moved.id ? ', its puck drop moved an hour later after it passed' : ', still scheduled in the feed') : ''}): ${g.id} ${same(n, g).map(k => `${k} ${JSON.stringify(g[k])} -> ${JSON.stringify(n[k])}`).join('; ').slice(0, 200)}`);
  }
  chk(A2.pass === undefined, 'the second pass\'s state is not marked as the first\'s');
  chk(early.length < 2 || A2.games.some(g => g.id === delayed.id && g.state === 'pre'), 'a game past its puck drop that the feed still has as scheduled is in the test');
  chk(!moved || A2.games.some(g => g.id === moved.id && g.state === 'pre' && g.start === movedStart), 'a game whose puck drop the feed moved later after it passed is in the test');
  const smE = run('smoke.js', [], { NHL_STATE: STATE, NHL_DATA: B, NHL_SUGGEST: SGA, NHL_PREV_STATE: path.join(SCRATCH, 'A-morning.json'), NHL_OUT: OUT }, 'smoke.js over the evening, against the morning\'s state');
  chk(smE.status === 0 && / 0 failures/.test(smE.out), 'smoke over the evening, the morning\'s calls the last published: ' + smE.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));
  if (shaped) chk(A2.games.some(g => g.state === 'live' && g.hs !== null), 'a game under way has a score');
  for (const g of late) { const n = A2.games.find(x => x.id === g.id); chk(n.line.at === evening && JSON.stringify(n.line) !== JSON.stringify(g.line), `a game still to come takes the moved line: ${g.id}`); }
  /* DraftKings' ids: a game to come takes the moved line's ids; one whose favourite flipped swaps its puck lines' N and P; the
     games under way, delayed or moved keep the morning's ids though the feed's are different now */
  const moveIds = late.map(g => [g, A2.games.find(x => x.id === g.id)]);
  chk(moveIds.every(([g, n]) => n.line.dk && JSON.stringify(n.line.dk) === JSON.stringify(idsOnly(lines[g.id].dk)) && !('at' in n.line.dk)), 'every game to come takes the moved line\'s DraftKings ids');
  const flipped = moveIds.find(([g, n]) => g.line.homeLine !== n.line.homeLine);
  chk(!!flipped && /N\d+_1$/.test(flipped[0].line.dk.homePL) !== /N\d+_1$/.test(flipped[1].line.dk.homePL) && /N\d+_3$/.test(flipped[0].line.dk.awayPL) !== /N\d+_3$/.test(flipped[1].line.dk.awayPL), `a favourite that flipped swaps its puck line ids' N and P (${flipped ? flipped[0].line.dk.homePL + ' -> ' + flipped[1].line.dk.homePL : 'no favourite flipped'})`);
  for (const g of early) { const n = A2.games.find(x => x.id === g.id); chk(n.line && n.line.dk && JSON.stringify(n.line.dk) === JSON.stringify(g.line.dk) && JSON.stringify(idsOnly(lines[g.id].dk)) !== JSON.stringify(g.line.dk), `${g.id}, started, delayed or moved, keeps the morning's DraftKings ids though the feed's moved (${n.line && n.line.dk && n.line.dk.over} vs the feed's ${lines[g.id].dk.over})`); }
  /* a mutation the smoke must catch: one started game's over id changed after puck drop */
  {
    const mut = readJSON(path.join(SCRATCH, 'A-evening.json')), sg = mut.games.find(g => early.some(e => e.id === g.id) && g.line && g.line.dk && g.line.dk.over);
    if (sg) {
      sg.line.dk.over = sg.line.dk.over.replace(/^0OU(\d+)O/, (m, n) => `0OU${+n + 1}O`);
      const MUT = path.join(SCRATCH, 'A-evening-mutated.json'); fs.writeFileSync(MUT, JSON.stringify(mut));
      const sm = run('smoke.js', [], { NHL_STATE: MUT, NHL_DATA: B, NHL_SUGGEST: SGA, NHL_PREV_STATE: path.join(SCRATCH, 'A-morning.json') }, 'smoke.js over a started game\'s id changed');
      chk(sm.status === 1 && /moved after puck drop: line/.test(sm.out), `a started game's DraftKings id changed after puck drop fails the smoke ("moved after puck drop: line"): exit ${sm.status}`);
    } else chk(false, 'no started game with an over id to mutate');
  }
  /* run 1c, on a copy: what the scoreboard answers never takes a game it merely leaves out */
  const later = minute(Date.parse(evening) + 10 * 60000), EVE = path.join(SCRATCH, 'A-evening.json');
  const copyOut = name => { const d = mkdir(name); for (const f of fs.readdirSync(OUT)) fs.copyFileSync(path.join(OUT, f), path.join(d, f)); return d; };
  const envP = (dir, st) => Object.assign(env(later), { NHL_OUT: dir, NHL_STATE: st });
  /* the day under way answered with no game at all: no answer, the run stops, nothing written */
  const P1 = copyOut('A-sb-blank'), SP1 = path.join(SCRATCH, 'A-blank.json'); fs.copyFileSync(EVE, SP1);
  fs.writeFileSync(path.join(P1, `sb_${T0}.json`), JSON.stringify({ events: [] }));
  const rb = run('update.js', ['--offline'], envP(P1, SP1), 'run 1c, the day under way answered blank');
  chk(rb.status === 1 && /did not answer/.test(rb.out) && fs.readFileSync(SP1, 'utf8') === fs.readFileSync(EVE, 'utf8'), `a day under way answered with no game is no answer: the run stops before writing (exit ${rb.status})`);
  /* the day answered with only the games still to come (the ones under way left out), one of those postponed,
     one game under way moved two days on (another day: a game to come again), a day weeks ahead answered blank */
  const P2 = copyOut('A-sb-partial'), SP2 = path.join(SCRATCH, 'A-partial.json'); fs.copyFileSync(EVE, SP2); fs.copyFileSync(SGA_EVE, SGA);
  const far = A2.games.map(g => g.date).filter(d => d >= addDays(T0, 20)).sort()[0], farGames = A2.games.filter(g => g.date === far);
  /* the games moved or called off are ones whose clubs have no game the next day, and the day a game moves to has
     none of its clubs' games the day before, on or after, so no back to back the lineups were drawn on changes */
  const free = (c, d) => !games.some(g => g.date === d && (g.home === c || g.away === c));
  const freeAround = (g, d) => [g.home, g.away].every(c => free(c, addDays(d, -1)) && free(c, d) && free(c, addDays(d, 1)));
  const off = late.slice().reverse().find(g => [g.home, g.away].every(c => free(c, T1))) || late[late.length - 1];
  const hop = early.find(g => g !== delayed && g !== moved && [g.home, g.away].every(c => free(c, T1))) || early[0];
  let hopDay = addDays(T0, 2); while (!freeAround(hop, hopDay) && hopDay < addDays(T0, 30)) hopDay = addDays(hopDay, 1);
  const hopStart = minute(Date.parse(hop.start) + Math.round((Date.parse(hopDay) - Date.parse(hop.date)) / 86400000) * 86400000);
  hopDay = E.etDate(hopStart);
  const sbT0 = readJSON(path.join(P2, `sb_${T0}.json`));
  sbT0.events = sbT0.events.filter(e => late.some(g => g.id === e.id)).map(e => e.id === off.id ? postponed(e) : e);
  fs.writeFileSync(path.join(P2, `sb_${T0}.json`), JSON.stringify(sbT0));
  const sbH = fs.existsSync(path.join(P2, `sb_${hopDay}.json`)) ? readJSON(path.join(P2, `sb_${hopDay}.json`)) : { events: [] };
  const hopLine = invented(hop);
  sbH.events.push(event(Object.assign({}, hop, { start: hopStart, date: hopDay }), { state: 'pre', odds: oddsOfLine(hopLine, hop) }));
  fs.writeFileSync(path.join(P2, `sb_${hopDay}.json`), JSON.stringify(sbH));
  fs.writeFileSync(path.join(P2, `sb_${far}.json`), JSON.stringify({ events: [] }));
  const rp = run('update.js', ['--offline'], envP(P2, SP2), 'run 1c, a partial answer');
  chk(rp.status === 0, 'a partial answer: the run goes on');
  const AP = readJSON(SP2);
  for (const g of early.filter(g => g.id !== hop.id)) { const n = AP.games.find(x => x.id === g.id), e = A2.games.find(x => x.id === g.id); chk(n && !same(n, e).length && n.state === e.state && (AP.kept || []).includes(g.id), `a game under way that the answer left out is kept, its call with it, and said: ${g.id} ${n ? same(n, e).join(', ') : 'gone'}`); }
  if (shaped) chk(early.some(g => g.id !== hop.id && A2.games.some(x => x.id === g.id && x.state === 'live')), 'a game the feed had under way, its score in, is among those left out');
  chk(AP.games.filter(g => g.state === 'live' && (AP.kept || []).includes(g.id)).every(g => g.scoreAt === A2.published), `a score under way kept from the last state says when it was read (${A2.published})`);
  chk(!AP.games.some(g => g.id === off.id) && (AP.removed || []).some(r => r.id === off.id && r.why === 'postponed'), `a game the feed postponed comes off the schedule, and the state says why: ${off.id}`);
  const hn = AP.games.find(g => g.id === hop.id);
  chk(hn && hn.date === E.etDate(hopStart) && hn.state === 'pre' && hn.frozen === later && hn.before === hopStart, `a game under way that the feed moved to another day is a game to come again, called afresh: ${hop.id} ${hn && hn.date} ${hn && hn.frozen}`);
  chk(farGames.length > 0 && farGames.every(g => AP.games.some(x => x.id === g.id && x.date === far)), `a day weeks ahead answered blank keeps its ${farGames.length} games`);
  chk(hn && hn.line && JSON.stringify(hn.line.dk) === JSON.stringify(idsOnly(hopLine.dk)), `the game moved to another day takes its new line's DraftKings ids (${hn && hn.line && JSON.stringify(hn.line.dk)})`);
  const smP = run('smoke.js', [], { NHL_STATE: SP2, NHL_DATA: B, NHL_SUGGEST: SGA, NHL_PREV_SUGGEST: SGA_EVE, NHL_PREV_STATE: EVE, NHL_OUT: P2 }, 'smoke.js over the partial answer');
  chk(smP.status === 0 && / 0 failures/.test(smP.out), 'smoke over a partial answer: ' + smP.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));
  /* run 1d, on a copy of the evening: ESPN's prices come through as "Draft Kings" with no link at all, the same numbers but one
     total a goal higher; two games keep their links, one with an over on another number, one with an id in a shape the job does
     not read; one game's links are not URLs at all; one game's links name its DraftKings event and no outcome. The ids of the
     last state stay for the same numbers, dated by their read (beside the event, for the game whose links name only that) */
  {
    const later3 = minute(Date.parse(evening) + 20 * 60000), P3 = copyOut('A-sb-nolink'), SP3 = path.join(SCRATCH, 'A-nolink.json'); fs.copyFileSync(EVE, SP3); fs.copyFileSync(SGA_EVE, SGA);
    const come = A2.games.filter(g => g.state === 'pre' && Date.parse(g.start) > Date.parse(later3) && g.line && g.line.dk && g.line.at === evening).sort((a, b) => a.start < b.start ? -1 : 1);
    if (come.length < 4) { if (shaped) chk(false, `run 1d needs four games still to come with ids (${come.length})`); else console.log(`  run 1d needs four games still to come with ids (${come.length}): skipped`); }
    else {
      const [tot, X, Y, Z, W] = come, plant = new Set([X.id, Y.id]);
      const strip = o => { delete o.link; for (const m of [o.moneyline, o.pointSpread, o.total]) for (const side of Object.values(m || {})) if (side && side.close) delete side.close.link; };
      const answers = {};
      for (const g of come) {
        const f = path.join(P3, `sb_${g.date}.json`), j = answers[f] = answers[f] || readJSON(f), ev = j.events.find(e => e.id === g.id), o = ev.competitions[0].odds[0];
        o.provider.name = 'Draft Kings';
        if (g.id === X.id) o.total.over.close.link = gw(`https://sportsbook.draftkings.com/event/${g.line.dk.event}?outcomes=${g.line.dk.over.replace(/O(\d+)_1$/, (m, n) => `O${+n + 100}_1`)}`);
        else if (g.id === Y.id) o.moneyline.home.close.link = gw(`https://sportsbook.draftkings.com/event/${g.line.dk.event}?outcomes=${encodeURIComponent('0QA376553393#2311243956_13L88808Q1-249793997Q20')}`);
        else if (g.id === Z.id) { o.link = { href: 'https://sportsbook.draftkings.com/gateway?preurl=%E0%A4%A' }; for (const m of [o.moneyline, o.pointSpread, o.total]) for (const side of Object.values(m || {})) if (side && side.close) side.close.link = { href: 'not a url' }; }
        else if (W && g.id === W.id) { o.link = gw(`https://sportsbook.draftkings.com/event/${g.line.dk.event}`); for (const m of [o.moneyline, o.pointSpread, o.total]) for (const side of Object.values(m || {})) if (side && side.close) side.close.link = gw(`https://sportsbook.draftkings.com/event/${g.line.dk.event}`); }
        else strip(o);
        if (g.id === tot.id) { o.overUnder = g.line.total + 1; o.total.over.close.line = 'o' + (g.line.total + 1); o.total.under.close.line = 'u' + (g.line.total + 1); }
      }
      for (const [f, j] of Object.entries(answers)) fs.writeFileSync(f, JSON.stringify(j));
      /* oddsOf never throws on a link that is not a URL: Z's answer gives no ids and every other field as it would with none */
      const zEv = readJSON(path.join(P3, `sb_${Z.date}.json`)).events.find(e => e.id === Z.id), zBare = JSON.parse(JSON.stringify(zEv)); strip(zBare.competitions[0].odds[0]);
      let zRow = null; try { zRow = E.gameRow(zEv); } catch (e) { zRow = null; }
      chk(zRow && zRow.odds && !zRow.odds.dk && JSON.stringify(zRow.odds) === JSON.stringify(E.gameRow(zBare).odds), 'links that are not URLs ("not a url", a preurl of "%E0%A4%A") give no ids and a normal row');
      /* links naming the event and no outcome: no id read (the event is no bet), the event kept */
      if (W) { const wEv = readJSON(path.join(P3, `sb_${W.date}.json`)).events.find(e => e.id === W.id), r = E.dkOf(wEv.competitions[0].odds[0], E.gameRow(wEv).odds); chk(r.read === 0 && r.links === 6 && r.dk && JSON.stringify(r.dk) === JSON.stringify({ event: W.line.dk.event }), `links naming the event alone read no outcome id, and keep the event (${JSON.stringify(r)})`); }
      const r1d = run('update.js', ['--offline'], Object.assign(env(later3), { NHL_OUT: P3, NHL_STATE: SP3 }), 'run 1d, prices with no links');
      chk(r1d.status === 0, 'run 1d: answers with no links, an over on another number, an id in an unknown shape, links that are not URLs, links naming the event alone: the run goes on');
      const lg = (/lines: (\d+) games? to come priced this run .*DraftKings ids on (\d+) of them \((\d+) read, (\d+) carried from the last state; (\d+) with an id for every price/.exec(r1d.out) || []).slice(1).map(Number);
      {
        const N1 = readJSON(SP3), fr = N1.games.filter(g => g.line && g.line.at === later3), hasIds = dk => !!dk && ['homeML', 'awayML', 'homePL', 'awayPL', 'over', 'under'].some(k => typeof dk[k] === 'string');
        const rd = fr.filter(g => hasIds(g.line.dk) && !g.line.dk.at).length, cr = fr.filter(g => hasIds(g.line.dk) && g.line.dk.at).length;
        const PR = { homeML: 'homeML', awayML: 'awayML', homePL: 'homeSpreadOdds', awayPL: 'awaySpreadOdds', over: 'overOdds', under: 'underOdds' };
        const full = fr.filter(g => hasIds(g.line.dk) && Object.entries(PR).every(([k, f]) => g.line[f] === null || g.line[f] === undefined || typeof g.line.dk[k] === 'string')).length;
        chk(lg.length === 5 && lg[0] === fr.length && lg[2] === rd && lg[3] === cr && lg[1] === rd + cr && lg[4] === full && full < rd + cr && (!W || fr.some(g => g.id === W.id && g.line.dk && g.line.dk.at)), `the run's log counts the lines with outcome ids read and those carried, an event alone never as read, and those with an id for every price, fewer where one was lost (${lg.join(', ')} vs ${fr.length}, ${rd}, ${cr}, ${full})`);
      }
      const N = readJSON(SP3), byN = new Map(N.games.map(g => [g.id, g]));
      for (const g of come) {
        const n = byN.get(g.id), dk = n && n.line && n.line.dk; if (!dk) { chk(false, `${g.id}: run 1d left no ids`); continue; }
        if (g.id === X.id) chk(!dk.over && dk.under === g.line.dk.under && dk.homeML === g.line.dk.homeML && !dk.at, `an over link on another number is not stored, the rest of the answer's ids are (${JSON.stringify(dk)})`);
        else if (g.id === Y.id) chk(!dk.homeML && dk.awayML === g.line.dk.awayML && !dk.at, `an id in a shape the job does not read is not stored (${JSON.stringify(dk)})`);
        else if (g.id === tot.id) chk(n.line.total === g.line.total + 1 && !dk.over && !dk.under && dk.homeML === g.line.dk.homeML && dk.homePL === g.line.dk.homePL && dk.at === evening, `a total moved a goal with no links: the moneyline and puck line ids kept, dated ${evening}, the totals' dropped (${JSON.stringify(dk)})`);
        else if (W && g.id === W.id) chk(JSON.stringify(idsOnly(dk)) === JSON.stringify(idsOnly(g.line.dk)) && dk.at === evening, `links naming the event and no outcome: the evening's outcome ids kept beside the event, dated ${evening} (${JSON.stringify(dk)})`);
        else chk(JSON.stringify(idsOnly(dk)) === JSON.stringify(idsOnly(g.line.dk)) && dk.at === evening, `${g.id}: no usable link, the same numbers: the evening's ids kept, dated ${evening} (${JSON.stringify(dk)})`);
      }
      const sm1d = run('smoke.js', [], { NHL_STATE: SP3, NHL_DATA: B, NHL_SUGGEST: SGA, NHL_PREV_SUGGEST: SGA_EVE, NHL_PREV_STATE: EVE, NHL_OUT: P3 }, 'smoke.js over prices with no links');
      chk(sm1d.status === 0 && / 0 failures/.test(sm1d.out), 'smoke over prices with no links: ' + sm1d.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));
      /* sources.js: answers with no link at all are a note; answers whose every link is in a shape the job cannot read are broken */
      const DS = mkdir('A-src'); fs.copyFileSync(path.join(B, 'starters.json'), path.join(DS, 'starters.json'));
      const inj = readJSON(path.join(B, 'injuries.json')); inj.pulled = later3; fs.writeFileSync(path.join(DS, 'injuries.json'), JSON.stringify(inj));
      const bare = copyOut('A-sb-bare'), odd = copyOut('A-sb-odd'), evo = copyOut('A-sb-event');
      for (const f of fs.readdirSync(OUT)) {
        const j = readJSON(path.join(OUT, f)), k = readJSON(path.join(OUT, f)), v = readJSON(path.join(OUT, f));
        for (const ev of v.events || []) { const o = ev.competitions[0].odds && ev.competitions[0].odds[0]; if (!o) continue; const e = `https://sportsbook.draftkings.com/event/${34000000 + +String(ev.id).slice(-6)}`; o.link = gw(e); for (const m of [o.moneyline, o.pointSpread, o.total]) for (const side of Object.values(m || {})) if (side && side.close) side.close.link = gw(e); }
        fs.writeFileSync(path.join(evo, f), JSON.stringify(v));
        for (const ev of j.events || []) { const o = ev.competitions[0].odds && ev.competitions[0].odds[0]; if (o) { o.provider.name = 'Draft Kings'; strip(o); } }
        for (const ev of k.events || []) { const o = ev.competitions[0].odds && ev.competitions[0].odds[0]; if (!o) continue; o.link = gw('https://sportsbook.draftkings.com/x?outcomes=0QA1'); for (const m of [o.moneyline, o.pointSpread, o.total]) for (const side of Object.values(m || {})) if (side && side.close) side.close.link = gw(`https://sportsbook.draftkings.com/event/x?outcomes=${encodeURIComponent('0QA376553393#2311243956_13L88808Q1')}`); }
        fs.writeFileSync(path.join(bare, f), JSON.stringify(j)); fs.writeFileSync(path.join(odd, f), JSON.stringify(k));
      }
      const s1 = run('sources.js', [], { NHL_STATE: SP3, NHL_DATA: DS, NHL_OUT: bare }, 'sources.js, prices with no links');
      chk(s1.status === 0 && /note: .*no DraftKings links/.test(s1.out), `sources.js notes prices with no links and passes (exit ${s1.status})`);
      const s2 = run('sources.js', [], { NHL_STATE: SP3, NHL_DATA: DS, NHL_OUT: odd }, 'sources.js, ids in a shape the job does not read');
      chk(s2.status === 1 && /BROKEN: .*DraftKings ids in a shape the job does not read/.test(s2.out), `sources.js fails the run when no link gives an id it reads (exit ${s2.status})`);
      const s2e = run('sources.js', [], { NHL_STATE: SP3, NHL_DATA: DS, NHL_OUT: evo }, 'sources.js, links naming the event alone');
      chk(s2e.status === 1 && /BROKEN: .*not one gave an outcome id/.test(s2e.out), `sources.js fails the run when the links name the event and no outcome (exit ${s2e.status})`);
      const s3 = run('sources.js', [], { NHL_STATE: SP3, NHL_DATA: DS, NHL_OUT: OUT }, 'sources.js, the ids read');
      chk(s3.status === 0 && /DraftKings ids: \d+ read/.test(s3.out), `sources.js passes when the ids are read (exit ${s3.status})`);
      /* one market's shape moved: the totals' links alone give ids the job does not read, the moneylines and puck lines read as ever.
         Broken, named by its market, though most ids still read */
      const tt = copyOut('A-sb-totals');
      for (const f of fs.readdirSync(OUT)) {
        const j = readJSON(path.join(OUT, f));
        for (const ev of j.events || []) { const o = ev.competitions[0].odds && ev.competitions[0].odds[0]; if (!o || !o.total) continue; const e = 34000000 + +String(ev.id).slice(-6); for (const [side, n] of [['over', 1], ['under', 3]]) if (o.total[side] && o.total[side].close) o.total[side].close.link = gw(`https://sportsbook.draftkings.com/event/${e}?outcomes=${encodeURIComponent(`0TT${86000000 + +String(ev.id).slice(-6)}#${side}_${n}`)}`); }
        fs.writeFileSync(path.join(tt, f), JSON.stringify(j));
      }
      const s4 = run('sources.js', [], { NHL_STATE: SP3, NHL_DATA: DS, NHL_OUT: tt }, 'sources.js, the totals in a shape the job does not read');
      chk(s4.status === 1 && /BROKEN: ESPN's DraftKings total links \(over on \d+ games?, under on \d+ games?\) gave not one id in a shape the job reads/.test(s4.out) && !/moneyline|puck line links/.test((/BROKEN: .*/.exec(s4.out) || [''])[0]), `sources.js fails the run when one market's ids are all in a shape it does not read, naming it (exit ${s4.status}: ${(/BROKEN: .*/.exec(s4.out) || [''])[0].slice(0, 160)})`);
      /* run 1d's own answers: games with no link beside games with theirs are named, a note; the run passes */
      const s5 = run('sources.js', [], { NHL_STATE: SP3, NHL_DATA: DS, NHL_OUT: P3 }, "sources.js, run 1d's answers");
      const S3 = readJSON(SP3), pub3 = Date.parse(S3.published), days3 = new Set(S3.games.filter(g => g.state === 'pre' && Date.parse(g.start) > pub3 && Date.parse(g.start) - pub3 < 36 * 3600000).map(g => g.date));
      const bareN = come.filter(g => ![X.id, Y.id, Z.id, W && W.id].includes(g.id) && days3.has(g.date)).length;
      chk(s5.status === 0 && new RegExp(`note: ${bareN} of the \\d+ games priced at DraftKings carried no DraftKings links this run \\(`).test(s5.out) && /note: \d+ of the \d+ games priced at DraftKings carried links that gave no outcome id/.test(s5.out), `sources.js names the games with no link beside those with theirs, and passes (exit ${s5.status}: ${s5.out.split('\n').filter(l => /^note: \d+ of/.test(l)).join(' | ').slice(0, 240)})`);
    }
  }
  /* run 2: the next morning, T0 final */
  feed(T0, { lines: [T1] });
  fs.copyFileSync(SGA_EVE, SGA);
  chk(run('update.js', ['--offline'], env(T1 + 'T12:00Z'), 'run 2, the next morning').status === 0, 'run 2');
  const Bs = readJSON(STATE);
  const byIdEve = Object.fromEntries(A2.games.map(g => [g.id, g]));
  const dayB = Bs.games.filter(g => g.date === T0);
  chk(dayB.every(g => g.state === 'final' && g.result), `every game on ${T0} is final and graded`);
  for (const g of dayB) {
    const shown = g.start <= firstStart ? byIdA[g.id] : byIdEve[g.id];                // the call on the page at puck drop
    const r = results[g.id];
    const moved = same(g, shown);
    chk(!moved.length, `the call graded is the call shown before puck drop: ${g.id} ${moved.map(k => `${k} ${JSON.stringify(shown[k])} -> ${JSON.stringify(g[k])}`).join('; ').slice(0, 200)}`);
    chk(g.hs === r.hs && g.as === r.as && g.periods === r.periods, `score carried: ${g.id}`);
    chk(g.result.su === ((r.hs > r.as) === (g.pick === 'home')), `straight-up grade follows the score: ${g.id}`);
    const covered = r.hs - r.as + g.line.homeLine;
    chk(g.result.homeCover === (covered > 0 ? 'win' : covered < 0 ? 'loss' : 'push'), `puck line grade follows the margin: ${g.id}`);
    if (shown.plPick) chk(g.result.pl === (g.result.homeCover === 'push' ? 'push' : ((g.result.homeCover === 'win') === (shown.plPick === 'home') ? 'win' : 'loss')), `the puck line side shown is the one graded: ${g.id}`);
    else chk(!g.result.pl, `no puck line side shown, none graded: ${g.id}`);
    if (shown.ouPick) { const t = r.hs + r.as; chk(g.result.ou === (t === g.line.total ? 'push' : ((t > g.line.total) === (shown.ouPick === 'over') ? 'win' : 'loss')), `totals pick graded: ${g.id}`); }
    if (shown.mlPick) chk(g.result.ml === ((r.hs > r.as) === (shown.mlPick === 'home') ? 'win' : 'loss'), `moneyline pick graded: ${g.id}`);
  }
  const dayT1 = Bs.games.filter(g => g.date === T1);
  chk(dayT1.every(g => g.state === 'pre' && g.line && g.line.at.startsWith(T1)), `the lines on ${T1} are the morning's, refreshed`);
  const R = Bs.record; const graded = Bs.games.filter(g => g.result);
  chk(R.su.w + R.su.l === graded.length, `the record counts every graded game (${R.su.w}-${R.su.l} of ${graded.length})`);
  chk(R.pl.w + R.pl.l + R.pl.p === graded.filter(g => g.result.pl).length, 'the puck line record counts every graded pick');
  chk(R.ou.w + R.ou.l + R.ou.p === graded.filter(g => g.result.ou).length, 'the totals record counts every graded pick');
  chk(Object.values(R.byMonth).reduce((a, m) => a + m.su.w + m.su.l, 0) === graded.length, 'the months add to the whole');
  const gp = Object.values(Bs.teams).reduce((a, t) => a + t.gp, 0);
  chk(gp === 2 * graded.length, `the standings count every final twice (${gp} vs ${2 * graded.length})`);
  const pts = Object.values(Bs.teams).reduce((a, t) => a + t.pts, 0), otl = Object.values(Bs.teams).reduce((a, t) => a + t.otl, 0);
  chk(pts === 2 * graded.length + otl, 'points are two a game plus the loser point');
  chk(otl === graded.filter(g => g.periods > 3).length, 'a loser point for every game past regulation');
  chk(Bs.playoff.remaining === games.filter(g => g.date > T0).length && Bs.phase === 'regular', `the simulation plays the ${Bs.playoff.remaining} games left, in the regular season`);
  /* run 3: nothing new; the file is left alone */
  const beforeC = fs.readFileSync(STATE, 'utf8');
  run('update.js', ['--offline'], env(T1 + 'T12:00Z'), 'run 3, a quiet rerun');
  chk(fs.readFileSync(STATE, 'utf8') === beforeC, 'a rerun with nothing new leaves state.json alone');
  const sm = run('smoke.js', [], { NHL_STATE: STATE, NHL_DATA: B, NHL_SUGGEST: SGA, NHL_PREV_SUGGEST: SGA_EVE, NHL_PREV_STATE: path.join(SCRATCH, 'A-evening.json') }, 'smoke.js over A');
  chk(sm.status === 0 && / 0 failures/.test(sm.out), 'smoke over the fabricated season: ' + sm.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));
  return { games, results };
}

/* ---------- C. the playoffs ---------- */
function partC(B, games, results) {
  console.log('C. the season played out, then the playoffs');
  const DC = dataDir('C', B), OUT = mkdir('C-sb'), STATE = path.join(SCRATCH, 'C-state.json'), SGC = path.join(DC, 'suggest_ledger.json');
  if (fs.existsSync(SGC)) fs.rmSync(SGC);
  const lastReg = games[games.length - 1].date;
  const byDate = {};
  for (const g of games) { results[g.id] = results[g.id] || score(g); (byDate[g.date] = byDate[g.date] || []).push(event(g, Object.assign({ state: 'post' }, results[g.id]))); }
  writeDays(OUT, byDate);
  const env = day => ({ NHL_TODAY: day, NHL_NOW: day + 'T16:00Z', NHL_STATE: STATE, NHL_OUT: OUT, NHL_TEAMS: path.join(DC, 'teams.json'), NHL_DATA: DC, NHL_SEASON: String(SEASON) });
  chk(run('update.js', ['--offline'], env(addDays(lastReg, 1)), 'the regular season over').status === 0, 'the regular season runs to its end');
  const C1 = readJSON(STATE);
  chk(C1.phase === 'postseason', `the regular season over is the postseason (${C1.phase})`);
  const field = conf => [].concat(...C1.playoff.bracket[conf].series);
  chk(['East', 'West'].every(c => field(c).every(t => C1.playoff.odds[t].playoff === 1)) && Object.values(C1.playoff.odds).filter(o => o.playoff === 1).length === 16, 'the field is the real one: sixteen clubs in, for certain');
  /* on a copy: ESPN's first round has a club the table left out (the league's tie-breakers put it in the second wild
     card, which the table's do not model), two games in. The field is ESPN's: that club is in for certain with a Cup
     chance, the club the table had there is out with none, and the bracket's seeds and wild cards are the sixteen it draws */
  {
    const DW = dataDir('C-wc', DC), OUTW = mkdir('C-sb-wc'), STW = path.join(SCRATCH, 'C-wc-state.json');
    for (const f of fs.readdirSync(OUT)) fs.copyFileSync(path.join(OUT, f), path.join(OUTW, f));
    fs.copyFileSync(STATE, STW);
    const [top, wc2] = C1.playoff.bracket.East.series[0], inField = new Set(field('East'));
    const Y = E.TEAMS.filter(t => E.CLUBS[t].conf === 'East' && !inField.has(t)).sort((a, b) => C1.teams[b].pts - C1.teams[a].pts || C1.teams[b].rw - C1.teams[a].rw)[0];
    [0, 2].forEach((k, i) => { const d = addDays(lastReg, 3 + k), f = path.join(OUTW, `sb_${d}.json`); const had = fs.existsSync(f) ? readJSON(f).events : [];
      fs.writeFileSync(f, JSON.stringify({ events: had.concat([event({ id: `98000000${i + 1}`, date: d, start: d + 'T23:00Z', home: top, away: Y, neutral: false }, { state: 'post', hs: 1, as: 3, periods: 3, type: 3 })]) })); });
    chk(run('update.js', ['--offline'], Object.assign(env(addDays(lastReg, 6)), { NHL_STATE: STW, NHL_OUT: OUTW, NHL_DATA: DW, NHL_TEAMS: path.join(DW, 'teams.json') }), `the first round with ${Y}, whom the table left out`).status === 0, 'a first round with a club the table left out runs');
    const W = readJSON(STW), OW = W.playoff.odds, fw = W.playoff.bracket.East, marked = [].concat(...Object.values(fw.divs), fw.wild);
    chk(JSON.stringify(fw.series[0]) === JSON.stringify([top, Y]) && fw.wild[1] === Y && marked.includes(Y) && !marked.includes(wc2), `ESPN's first round is the bracket and its field: ${top} v ${Y} in the second wild card's place (${JSON.stringify(fw.series[0])}, wild cards ${fw.wild})`);
    chk(OW[Y].playoff === 1 && OW[Y].cup > 0 && OW[Y].conf > 0, `${Y}, left out by the table but up 2-0 on ${top} in ESPN's first round, is in the playoffs for certain with a Cup chance (${JSON.stringify(OW[Y])})`);
    chk(OW[wc2].playoff === 0 && OW[wc2].cup === 0 && OW[wc2].conf === 0 && OW[wc2].div === 0, `${wc2}, the table's second wild card, is out with no chance (${JSON.stringify(OW[wc2])})`);
    chk(Object.values(OW).filter(o => o.playoff === 1).length === 16 && Object.values(OW).every(o => o.playoff === 0 || o.playoff === 1), 'sixteen clubs in for certain, the rest out');
    const smW = run('smoke.js', [], { NHL_STATE: STW, NHL_DATA: B, NHL_SUGGEST: path.join(DW, 'suggest_ledger.json'), NHL_PREV_STATE: 'none' }, 'smoke.js over a first round the table did not draw');
    chk(smW.status === 0 && / 0 failures/.test(smW.out), `smoke over a first round with ${Y}, whom the table left out: ` + smW.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));
  }
  /* the first round: a sweep, an upset, series under way */
  let n = 0, day = addDays(lastReg, 3);
  const po = [], pgame = (a, b, aHome, aWins, d) => { const id = `9${String(++n).padStart(8, '0')}`; const home = aHome ? a : b, away = aHome ? b : a; const hs = (aWins === aHome) ? 3 : 1, as = (aWins === aHome) ? 1 : 3; po.push({ id, date: d, start: d + 'T23:00Z', home, away, neutral: false, state: 'post', hs, as, periods: 3 }); };
  const playSeries = (a, b, results2, d0) => results2.forEach((aWins, i) => pgame(a, b, [0, 1, 4, 6].includes(i), aWins, addDays(d0, i * 2)));
  const [e0, e1, e2] = C1.playoff.bracket.East.series, [w0, w1, w2] = C1.playoff.bracket.West.series;
  playSeries(e0[0], e0[1], [true, true, true, true], day);                  // a sweep
  playSeries(w0[0], w0[1], [false, true, false, false, false], day);        // the top seed knocked out
  playSeries(e1[0], e1[1], [true, false, true], day);                       // under way
  playSeries(w1[0], w1[1], [false, true], day);
  playSeries(e2[0], e2[1], [true], day); playSeries(w2[0], w2[1], [false], day);
  const sched = { id: '900000999', date: addDays(day, 8), start: addDays(day, 8) + 'T23:00Z', home: e1[0], away: e1[1], neutral: false, state: 'pre' };
  const writePo = list => { const pb = {}; for (const g of list) (pb[g.date] = pb[g.date] || []).push(event(g, g.state === 'post' ? { state: 'post', hs: g.hs, as: g.as, periods: g.periods, type: 3 } : { state: 'pre', type: 3, odds: oddsOfLine(invented(g), g) })); for (const [d, evs] of Object.entries(pb)) { const f = path.join(OUT, `sb_${d}.json`); const had = fs.existsSync(f) ? readJSON(f).events : []; fs.writeFileSync(f, JSON.stringify({ events: had.filter(e => !evs.some(x => x.id === e.id)).concat(evs) })); } };
  writePo(po.concat([sched]));
  chk(run('update.js', ['--offline'], env(addDays(day, 7)), 'the first round under way').status === 0, 'the first round runs');
  const C2 = readJSON(STATE);
  const O = C2.playoff.odds;
  chk(O[e0[1]].cup === 0 && O[e0[1]].conf === 0, `${e0[1]}, swept, has no Cup or conference chance left (${O[e0[1]].cup}, ${O[e0[1]].conf})`);
  chk(O[w0[0]].cup === 0 && O[w0[0]].conf === 0, `${w0[0]}, the top seed knocked out, has none either`);
  chk(O[e0[0]].cup > 0 && O[w0[1]].cup > 0, 'the winners go on with a chance');
  chk(Math.abs(Object.values(O).reduce((a, o) => a + o.cup, 0) - 1) < 0.02, 'Cup chances still sum to one');
  const sw = (C2.playoff.series || []).find(s => s.a === [e0[0], e0[1]].sort()[0] && s.b === [e0[0], e0[1]].sort()[1]);
  chk((C2.playoff.series || []).length === 6 && sw && sw.winner === e0[0] && sw.wins[e0[0]] === 4 && sw.wins[e0[1]] === 0 && C2.playoff.series.every(s => s.round === 1), `every first-round series with a game in it, each with its score and its winner once it has one (${(C2.playoff.series || []).length})`);
  chk(JSON.stringify(C2.playoff.bracket) === JSON.stringify(C1.playoff.bracket), 'the first round as drawn is kept');
  const sg = C2.games.find(g => g.id === sched.id);
  chk(sg && sg.type === 3 && sg.line && sg.frozen && sg.line.dk && sg.line.dk.homeML, 'a playoff game to come has a call and a line, with DraftKings\' ids');
  chk(C2.record.byMonth.playoffs && C2.record.byMonth.playoffs.su.w + C2.record.byMonth.playoffs.su.l === po.length, 'the playoffs are their own row of the record');
  const sm = run('smoke.js', [], { NHL_STATE: STATE, NHL_DATA: B, NHL_SUGGEST: SGC, NHL_PREV_STATE: 'none' }, 'smoke.js over the playoffs');
  chk(sm.status === 0 && / 0 failures/.test(sm.out), 'smoke over the playoffs: ' + sm.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));
  /* every round to the Final: the higher seed 4-2, the bracket's way */
  const pts = t => C1.teams[t].pts + C1.teams[t].rw / 100;
  const best = (a, b) => pts(a) >= pts(b) ? [a, b] : [b, a];
  const all = po.filter(g => !['East', 'West'].some(c => [1, 2].some(i => { const s = C1.playoff.bracket[c].series[i]; return (g.home === s[0] && g.away === s[1]) || (g.home === s[1] && g.away === s[0]); })));
  n = 100; let d2 = addDays(day, 10);
  const finish = (a, b, d) => { const [hi, lo] = best(a, b); [true, false, true, true, false, true].forEach((w, i) => { const id = `9${String(++n).padStart(8, '0')}`; const aHome = [0, 1, 4, 6].includes(i); all.push({ id, date: addDays(d, i), start: addDays(d, i) + 'T23:00Z', home: aHome ? hi : lo, away: aHome ? lo : hi, neutral: false, state: 'post', hs: (w === aHome) ? 4 : 2, as: (w === aHome) ? 2 : 4, periods: 3 }); }); return hi; };
  const conf = {};
  for (const c of ['East', 'West']) {
    const s = C1.playoff.bracket[c].series;
    const r1 = s.map((x, i) => i === 0 ? (c === 'East' ? e0[0] : w0[1]) : finish(x[0], x[1], d2));
    const r2 = [finish(r1[0], r1[1], addDays(d2, 8)), finish(r1[2], r1[3], addDays(d2, 8))];
    conf[c] = finish(r2[0], r2[1], addDays(d2, 16));
  }
  const champ = finish(conf.East, conf.West, addDays(d2, 24));
  for (const f of fs.readdirSync(OUT)) if (f > `sb_${lastReg}.json`) fs.rmSync(path.join(OUT, f));
  writePo(all);
  chk(run('update.js', ['--offline'], env(addDays(d2, 32)), 'the Final played').status === 0, 'the playoffs run to the Final');
  const C3 = readJSON(STATE);
  chk(C3.phase === 'over' && C3.playoff.champion === champ, `the season is over and ${champ} won the Cup (${C3.phase}, ${C3.playoff.champion})`);
  chk(C3.playoff.odds[champ].cup === 1 && Object.entries(C3.playoff.odds).every(([t, o]) => t === champ || o.cup === 0), 'the champion has the Cup, nobody else a chance');
  const sm3 = run('smoke.js', [], { NHL_STATE: STATE, NHL_DATA: B, NHL_SUGGEST: SGC, NHL_PREV_STATE: 'none' }, 'smoke.js over a finished season');
  chk(sm3.status === 0 && / 0 failures/.test(sm3.out), 'smoke over a finished season: ' + sm3.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));
  return { STATE, C3 };
}

/* ---------- D. the rollover ---------- */
function partD(B, C) {
  console.log('D. the first run of the next season');
  const DD = dataDir('D', B), OUT = mkdir('D-sb'), STATE = path.join(SCRATCH, 'D-state.json');
  if (fs.existsSync(path.join(DD, 'suggest_ledger.json'))) fs.rmSync(path.join(DD, 'suggest_ledger.json'));
  fs.copyFileSync(C.STATE, STATE);
  const aug = `${SEASON}-08-05`;
  const env = { NHL_TODAY: aug, NHL_NOW: aug + 'T16:00Z', NHL_STATE: STATE, NHL_OUT: OUT, NHL_TEAMS: path.join(DD, 'teams.json'), NHL_DATA: DD };
  const r = run('update.js', ['--offline'], env, 'update.js in August');
  chk(r.status === 0, 'the first run of a new season runs');
  const file = path.join(DD, `season_${SEASON}.json`);
  chk(fs.existsSync(file), `the finished season is closed into season_${SEASON}.json`);
  const closed = fs.existsSync(file) ? readJSON(file).rows.length : 0;
  chk(closed === C.C3.games.filter(g => g.state === 'final').length, `with every final of it, playoffs too (${closed})`);
  const Dn = readJSON(STATE);
  chk(Dn.season === SEASON + 1 && Dn.games.length === 0 && Dn.phase === 'offseason', `the new season has no games yet (${Dn.season}, ${Dn.games.length}, ${Dn.phase})`);
  const carry = model.params.carry;
  const off = E.TEAMS.map(t => Math.abs(Dn.teams[t].rating - (1500 + (C.C3.teams[t].rating - 1500) * carry))).sort((a, b) => b - a)[0];
  chk(off < 0.2, `each club starts the new season at its finished-season rating carried ${carry} of the way (largest gap ${off.toFixed(2)})`);
  const sm = run('smoke.js', [], { NHL_STATE: STATE, NHL_DATA: DD, NHL_PREV_STATE: 'none' }, 'smoke.js before the schedule is out');
  chk(sm.status === 0 && / 0 failures/.test(sm.out), 'smoke with no games: ' + sm.out.trim().split('\n').filter(l => /checks|FAIL/.test(l)).slice(0, 6).join(' | '));
  const pl = run('players.js', [], { NHL_DATA: DD, NHL_STATE: STATE, NHL_TODAY: aug }, 'players.js in August');
  /* the newest season with a box score: the finished one in season, but from the August rollover to the new season's first final
     boxed, the one before it (the job's step that boxes it runs after this simulation) */
  const boxedSeasons = fs.readdirSync(DD).filter(f => /^box_\d{4}\.jsonl$/.test(f) && /\S/.test(fs.readFileSync(path.join(DD, f), 'utf8'))).map(f => +f.slice(4, 8));
  const newest = boxedSeasons.length ? Math.max(...boxedSeasons) : SEASON;
  if (newest < SEASON) console.log(`  no box score of ${SEASON} yet: the player model is held to the newest season boxed, ${newest}`);
  chk(pl.status === 0 && new RegExp(`seasons \\d{4}-${newest}`).test(pl.out), `the player model keeps the finished season's box scores: ${(/\d+ games with box scores, seasons \d{4}-\d{4}/.exec(pl.out) || [''])[0]}`);
  /* a season that is nowhere is refused */
  const r2 = run('update.js', ['--offline'], Object.assign({}, env, { NHL_TODAY: `${SEASON + 1}-08-05`, NHL_NOW: `${SEASON + 1}-08-05T16:00Z` }), 'update.js a year on, with nothing of the year between');
  chk(r2.status === 1 && /is in neither/.test(r2.out), 'a season missing from the history and the last state is refused');
}

try {
  const b = partB();
  const B = b.B;
  partB2(b);
  partB4(b);
  partB5();
  const { games, results } = partA(B);
  const C = partC(B, games, results);
  partD(B, C);
} catch (e) { chk(false, 'the simulation itself broke: ' + (e.stack || e.message)); }
{ const now = fingerprint(), moved = Object.keys(Object.assign({}, BEFORE, now)).filter(f => BEFORE[f] !== now[f]);
  chk(!moved.length, `the simulation writes none of the repo's own files (data/ and state.json): ${moved.slice(0, 6).join(', ') || 'none written'}`); }
fs.writeSync(1, [`${checks} checks, ${fails.length} failures`].concat(fails.map(f => '  FAIL ' + f)).join('\n') + '\n');
if (process.env.NHL_SIM_KEEP) console.log('scratch kept: ' + SCRATCH); else fs.rmSync(SCRATCH, { recursive: true, force: true });
process.exit(fails.length ? 1 : 0);
