/* Pull box scores from ESPN into data/box_<season>.jsonl, one line per game: every skater's
   ice time, power-play ice time, goals, assists, shots on goal, blocked shots, hits and plus-minus,
   every goalie's minutes, shots against and goals against (his saves are the one less the other).
   This is what the player model (players.js) and the props model (props.js) are built on.

   Each column is read by ESPN's key (`keys`, beside the labels), else by its label: shots on goal are
   `shotsTotal`, labelled "S". ESPN's column labelled "SOG" is SHOOTOUT goals (`shootoutGoals`), which
   no prop counts and this file does not keep: before 15 October 2026 it was stored as `sog` and read
   as shots by nobody (0 in all 7,090 games), and shots, blocks, hits and power-play time were not kept
   at all; `--refill` read every stored game again. A column ESPN leaves out is left out of the line
   (never written as 0), so a reader can tell a missing stat from none.

   Each side's STARTING goalie carries `st: 1`: the first of its goalies ESPN's plays name making a save
   (a "saver" on a Shot, the plays taken by their sequence numbers). ESPN's box lists a club's goalies in no set order and has no
   starter field, so before 15 October 2026 a reader took the goalie who played most, which is the
   reliever when a starter is pulled before half the game (the props model fits and grades the starter,
   pulled or not: props.js). A side whose plays name no save (a starter pulled with every shot a goal is
   named by his reliever's first save, as before) carries no flag, and a reader falls back to the goalie
   who played most. `--starters` read once again every stored game in which a side used two goalies.

    node tools/fetch_box.js               every final game not yet in the files: the history's
                                          last five seasons and this season's (from state.json); and up
                                          to REFILL_PER_RUN lines still in the old shape (no shots) read again
    node tools/fetch_box.js 2022 2024     a range of seasons, each named by the year it ends
    node tools/fetch_box.js --refill [from] [to]   every stored line in the old shape (no `s` on its
                                          skaters) read again from ESPN's summary and rewritten in place,
                                          its score and schedule fields kept; a game that cannot be read
                                          keeps its old line (said, and read again next time). Free: one
                                          request a game, about 25 minutes for five seasons
    node tools/fetch_box.js --starters [from] [to]   every stored line in which a side used two goalies and
                                          none of them carries `st` read again for its plays, and the
                                          starter marked; nothing else in the line changes (871 games over
                                          six seasons on 15 October 2026, under a minute)

   One request per game (ESPN's game summary), four at a time with a pause, free. A game already in
   the file is never asked for again, so the daily run is last night's games only; the one-time
   backfill of five seasons is about seven thousand requests. Each line carries the game's score
   beside the box, so the player model can rate a final the state does not have yet. The job runs
   update.js --scores first, so last night's finals are in the state and boxed in the same run.

   Also pulls today's injury report into data/injuries.json. ESPN's injury feed carries no
   athlete id field: the id is read from the player's page link (.../player/_/id/NNN/...), else the
   headshot's file name, else left null, and players.js falls back to the club and the name. A report
   that does not download, or comes back empty, leaves the last one in place (its `pulled` time says
   how old it is, players.js carries that to the page, and the workflow's last step goes red once
   it is stale on a game day). Exit 1 if ESPN could not be read at all.

   NHL_DATA and NHL_STATE move the files, NHL_FIXTURES reads saved answers instead of ESPN
   (simulate.js plays the job offline that way). */
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./espn');
const Hist = require('./hist');
const DATA = process.env.NHL_DATA || path.join(__dirname, '..', 'data');
const STATE = process.env.NHL_STATE || path.join(__dirname, '..', 'state.json');
const SUMMARY = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/summary?event=';
const INJ = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/injuries';
const FROM_SEASON = 2022;                                     // five seasons of box scores before this one
const log = m => console.log(new Date().toISOString().slice(11, 19), m);
const warn = m => { log(m); if (process.env.GITHUB_ACTIONS) console.log(`::warning title=nhl fetch_box::${m}`); };
const secs = t => { const m = /^(\d+):(\d+)$/.exec(t || ''); return m ? +m[1] * 60 + +m[2] : 0; };

/* the games worth a box score: the finished seasons', then this season's finals from the state,
   each with its score, which the box line keeps */
const pick = g => ({ id: String(g.id), season: g.season, type: g.type, date: g.date, home: g.home, away: g.away, hs: g.hs, as: g.as, periods: g.periods, neutral: !!g.neutral });
function finals(from, to) {
  const out = Hist.rows(DATA).filter(r => r.season >= from && r.season <= to).map(pick);
  const seen = new Set(out.map(g => g.id));
  if (fs.existsSync(STATE)) {
    const S = JSON.parse(fs.readFileSync(STATE, 'utf8'));
    if (S.season >= from && S.season <= to) for (const g of S.games) if (g.state === 'final' && g.hs !== null && !seen.has(String(g.id))) out.push(pick(Object.assign({}, g, { season: S.season })));
  }
  return out;
}

/* the columns kept, each by ESPN's key first and its label second. Never 'SOG': in ESPN's summary that
   is shootout goals (key shootoutGoals); shots on goal are 'S' (key shotsTotal) */
const SKATER_COLS = { toi: ['timeOnIce', 'TOI'], pptoi: ['powerPlayTimeOnIce', 'PPTOI'], g: ['goals', 'G'], a: ['assists', 'A'], s: ['shotsTotal', 'S'],
  bs: ['blockedShots', 'BS'], ht: ['hits', 'HT'], pm: ['plusMinus', '+/-'] };
const GOALIE_COLS = { toi: ['timeOnIce', 'TOI'], sa: ['shotsAgainst', 'SA'], ga: ['goalsAgainst', 'GA'] };
const TIMES = new Set(['toi', 'pptoi']);
/* a group's column index for one field: its key in `keys`, else its label in `labels`; -1 when neither */
function colOf(s, [key, label]) {
  const K = s.keys || [], L = s.labels || [];
  const i = K.indexOf(key); if (i >= 0) return i;
  return L.indexOf(label);
}
/* one athlete's row -> the fields kept; a column the group lacks is left out, never written as 0 */
function rowOf(s, st, cols) {
  const o = {};
  for (const [f, kl] of Object.entries(cols)) { const i = colOf(s, kl); if (i < 0) continue; o[f] = TIMES.has(f) ? secs(st[i]) : (+st[i] || 0); }
  return o;
}
/* each side's starting goalie: the first of its goalies (by id, from the box) that ESPN's plays name making a save, the
   plays taken in their sequence order. { club: id }; a side whose plays name no save is left out */
function startersOf(j, goalies) {
  const team = new Map(goalies.map(x => [String(x.id), x.team])), first = {};
  const plays = ((j && Array.isArray(j.plays)) ? j.plays : []).map((p, i) => [p, i]).filter(([p]) => p && typeof p === 'object');
  const seq = p => { const n = Number(p.sequenceNumber); return Number.isFinite(n) ? n : null; };
  if (plays.every(([p]) => seq(p) !== null)) plays.sort((a, b) => seq(a[0]) - seq(b[0]) || a[1] - b[1]);
  for (const [p] of plays) for (const q of Array.isArray(p.participants) ? p.participants : []) {
    if (!q || q.type !== 'saver' || !q.athlete || q.athlete.id === undefined) continue;
    const id = String(q.athlete.id), t = team.get(id);
    if (t && !first[t]) first[t] = id;
  }
  return first;
}
/* one summary -> the line the file keeps. null when the box is empty (a game ESPN never scored) */
function boxOf(j, g) {
  const skaters = [], goalies = [];
  for (const t of (j.boxscore && j.boxscore.players) || []) {
    const code = E.codeOf(t.team); if (!code) continue;
    for (const s of t.statistics || []) {
      for (const a of s.athletes || []) {
        const st = a.stats || [], id = String(a.athlete.id), name = a.athlete.displayName;
        if (s.name === 'goalies') { const r = rowOf(s, st, GOALIE_COLS); if (r.toi) goalies.push({ id, name, team: code, toi: r.toi, sa: r.sa || 0, ga: r.ga || 0 }); }
        else if (s.name === 'forwards' || s.name === 'defenses') {
          const r = rowOf(s, st, SKATER_COLS); if (!r.toi) continue;
          const pos = (a.athlete.position && a.athlete.position.abbreviation) || (s.name === 'defenses' ? 'D' : 'F');
          skaters.push(Object.assign({ id, name, team: code, pos, toi: r.toi }, ...['pptoi', 'g', 'a', 's', 'bs', 'ht', 'pm'].filter(f => f in r).map(f => ({ [f]: r[f] }))));
        }
      }
    }
  }
  if (!skaters.length || !goalies.length) return null;
  const st = startersOf(j, goalies);
  for (const x of goalies) if (st[x.team] === x.id) x.st = 1;
  return Object.assign({}, g, { skaters, goalies });
}
/* a line in the old shape: written before shots were kept (no skater carries `s`) */
const oldShape = b => !b.skaters.some(s => s.s !== undefined);

/* the athlete's ESPN id: the feed has no id field, so it is read from the player's page link, else
   from the headshot's file name; null when neither is there (players.js then matches the name) */
function athleteId(a) {
  if (!a) return null;
  if (a.id !== undefined && a.id !== null && /^\d+$/.test(String(a.id))) return String(a.id);
  for (const l of a.links || []) { const m = /\/id\/(\d+)/.exec((l && l.href) || ''); if (m) return m[1]; }
  const m = /\/(\d+)\.png/.exec((a.headshot && a.headshot.href) || '');
  return m ? m[1] : null;
}
/* one feed answer -> the file's shape: each club's list as ESPN files it */
function injuriesOf(j, pulled) {
  const out = { pulled, source: 'ESPN', teams: {} };
  for (const t of j.injuries || []) {
    const code = E.codeOf({ id: t.id }) || E.codeOf({ id: t.team && t.team.id }) || Object.keys(E.CLUBS).find(c => E.CLUBS[c].name === t.displayName) || null;
    if (!code) { log(`injuries: club not recognised: ${t.id} ${t.displayName}`); continue; }
    out.teams[code] = (t.injuries || []).map(x => {
      const a = x.athlete || {}, d = x.details || {};
      return { id: athleteId(a), name: a.displayName || a.fullName || null, pos: (a.position && a.position.abbreviation) || null, status: x.status || (x.type && x.type.description) || null,
        detail: d.type || null, returns: d.returnDate ? String(d.returnDate).slice(0, 10) : null, date: x.date ? String(x.date).slice(0, 10) : null };
    });
  }
  return out;
}
async function injuries() {
  const out = injuriesOf(await E.getJSON(INJ), new Date().toISOString().slice(0, 16) + 'Z');
  const rows = Object.values(out.teams).reduce((a, l) => a.concat(l), []);
  /* an empty answer is not a report: the last one stays */
  if (!rows.length) throw new Error('the injury report came back empty');
  fs.writeFileSync(path.join(DATA, 'injuries.json'), JSON.stringify(out));
  log(`injuries: ${rows.length} players on ${Object.keys(out.teams).length} clubs, ${rows.filter(r => r.id).length} with an ESPN id`);
  if (rows.filter(r => r.id).length < rows.length / 2) warn(`injuries: only ${rows.filter(r => r.id).length} of ${rows.length} rows carry an ESPN id; players.js matches the rest by club and name`);
}

/* read again from ESPN every line in the old shape (no shots), in the seasons from..to (all of them
   with `limit` Infinity, the newest seasons first with a limit): each rewritten in place, its schedule and
   score fields kept and its skaters and goalies the summary's; one that cannot be read keeps its old line.
   Each file is written whole once its season is done (a temporary file, then renamed) */
async function refill(from, to, limit = Infinity, par = 6) {
  const files = fs.readdirSync(DATA).filter(f => /^box_\d{4}\.jsonl$/.test(f)).map(f => +f.slice(4, 8)).filter(y => y >= from && y <= to).sort((a, b) => b - a);
  let left = limit, asked = 0, done = 0, failed = 0;
  for (const season of files) {
    if (left <= 0) break;
    const file = path.join(DATA, `box_${season}.jsonl`);
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const todo = lines.map((b, i) => [b, i]).filter(([b]) => oldShape(b)).slice(0, left);
    if (!todo.length) continue;
    left -= todo.length;
    let n = 0;
    for (let i = 0; i < todo.length; i += par) {
      await Promise.all(todo.slice(i, i + par).map(async ([b, k]) => {
        asked++;
        try {
          const nb = boxOf(await E.getJSON(SUMMARY + b.id), {});
          if (nb && !oldShape(nb)) { lines[k] = Object.assign({}, b, { skaters: nb.skaters, goalies: nb.goalies }); done++; } else failed++;
        } catch (e) { failed++; log(`refill ${b.id} ${b.date}: ${e.message}`); }
      }));
      n += Math.min(par, todo.length - i);
      if (n % 300 < par) log(`refill ${season}: ${n} of ${todo.length}`);
      await new Promise(r => setTimeout(r, 120));
    }
    const tmp = file + '.part';
    fs.writeFileSync(tmp, lines.map(l => JSON.stringify(l)).join('\n') + '\n'); fs.renameSync(tmp, file);
    log(`refill ${season}: ${todo.length} lines in the old shape asked for again; the file has ${lines.filter(oldShape).length} left in it`);
  }
  if (asked) log(`refill: ${asked} asked, ${done} rewritten with shots, blocks, hits and power-play time, ${failed} kept as they were`);
  return { asked, done, failed };
}
/* a line with a side that used two goalies, none of them marked the starter */
const starterUnknown = b => [b.home, b.away].some(t => { const gs = b.goalies.filter(x => x.team === t && x.toi > 0); return gs.length > 1 && !gs.some(x => x.st); });
/* read again, for its plays, every stored line in which a side used two goalies and none is marked the starter; each side's
   starter marked (`st: 1`) and nothing else in the line changed. Each file written whole once its season is done */
async function refillStarters(from, to, par = 6) {
  const files = fs.readdirSync(DATA).filter(f => /^box_\d{4}\.jsonl$/.test(f)).map(f => +f.slice(4, 8)).filter(y => y >= from && y <= to).sort((a, b) => b - a);
  let asked = 0, marked = 0, none = 0, failed = 0, pulled = 0;
  for (const season of files) {
    const file = path.join(DATA, `box_${season}.jsonl`);
    const lines = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const todo = lines.map((b, i) => [b, i]).filter(([b]) => starterUnknown(b));
    if (!todo.length) continue;
    for (let i = 0; i < todo.length; i += par) {
      await Promise.all(todo.slice(i, i + par).map(async ([b, k]) => {
        asked++;
        try {
          const st = startersOf(await E.getJSON(SUMMARY + b.id), b.goalies);
          if (!Object.keys(st).length) { none++; return; }
          const goalies = b.goalies.map(x => { const o = Object.assign({}, x); delete o.st; if (st[o.team] === o.id) o.st = 1; return o; });
          for (const t of [b.home, b.away]) { const gs = goalies.filter(x => x.team === t && x.toi > 0); if (gs.length > 1 && gs.some(x => x.st) && gs.sort((x, y) => y.toi - x.toi)[0].st !== 1) pulled++; }
          lines[k] = Object.assign({}, b, { goalies }); marked++;
        } catch (e) { failed++; log(`starters ${b.id} ${b.date}: ${e.message}`); }
      }));
      await new Promise(r => setTimeout(r, 120));
    }
    const tmp = file + '.part';
    fs.writeFileSync(tmp, lines.map(l => JSON.stringify(l)).join('\n') + '\n'); fs.renameSync(tmp, file);
    log(`starters ${season}: ${todo.length} games with a side on two goalies read again; ${lines.filter(starterUnknown).length} still unmarked`);
  }
  log(`starters: ${asked} asked, ${marked} marked, ${none} whose plays named no save, ${failed} failed; ${pulled} sides whose starter played less than his reliever`);
  return { asked, marked, none, failed, pulled };
}
const REFILL_PER_RUN = 100;                 // the daily run's share of old-shape lines read again (none once --refill has run)

async function main() {
  if (process.argv[2] === '--starters') {
    const r = await refillStarters(+process.argv[3] || FROM_SEASON, +process.argv[4] || 9999);
    if (r.asked && !r.marked && !r.none) throw new Error('ESPN unreachable: no game could be read again');
    return;
  }
  if (process.argv[2] === '--refill') {
    const r = await refill(+process.argv[3] || FROM_SEASON, +process.argv[4] || 9999);
    if (r.asked && !r.done) throw new Error('ESPN unreachable: no box score could be read again');
    return;
  }
  const from = +process.argv[2] || FROM_SEASON, to = +process.argv[3] || 9999;
  const wanted = finals(from, to);
  const bySeason = {}; for (const g of wanted) (bySeason[g.season] = bySeason[g.season] || []).push(g);
  let asked = 0, ok = 0, empty = 0;
  for (const season of Object.keys(bySeason).sort()) {
    const file = path.join(DATA, `box_${season}.jsonl`);
    const have = new Set(fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l).id) : []);
    const todo = bySeason[season].filter(g => !have.has(g.id));
    if (!todo.length) { log(`${season}: ${have.size} box scores, nothing new`); continue; }
    const lines = [];
    for (let i = 0; i < todo.length; i += 4) {
      const batch = await Promise.all(todo.slice(i, i + 4).map(async g => { asked++; try { const j = await E.getJSON(SUMMARY + g.id); ok++; return boxOf(j, g); } catch (e) { log(`${g.id} ${g.date}: ${e.message}`); return null; } }));
      for (const b of batch) { if (b) lines.push(JSON.stringify(b)); else empty++; }
      if (lines.length >= 200) { fs.appendFileSync(file, lines.join('\n') + '\n'); lines.length = 0; }
      await new Promise(r => setTimeout(r, 150));
    }
    if (lines.length) fs.appendFileSync(file, lines.join('\n') + '\n');
    log(`${season}: ${todo.length} games asked, file now ${fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).length} box scores`);
  }
  if (asked && !ok) throw new Error('ESPN unreachable: no box score could be read');
  /* lines still in the old shape (none once --refill has run), a few a run, the newest seasons first */
  try { await refill(from, to, REFILL_PER_RUN, 4); } catch (e) { warn(`refill: ${e.message}`); }
  try { await injuries(); } catch (e) {
    const prev = fs.existsSync(path.join(DATA, 'injuries.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'injuries.json'), 'utf8')).pulled : null;
    warn(`injuries: ${e.message}; the last report${prev ? ` (pulled ${prev})` : ''} stays, and the page says how old it is`);
  }
  if (empty) warn(`box scores: ${empty} of ${asked} empty or failed; they are asked for again next run, and the page names the club's last box until then`);
  log(`box scores: ${asked} asked, ${ok} read, ${empty} empty or failed`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { athleteId, injuriesOf, boxOf, oldShape, startersOf, starterUnknown, SKATER_COLS, GOALIE_COLS };
