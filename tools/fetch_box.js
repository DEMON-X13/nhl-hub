/* Pull box scores from ESPN into data/box_<season>.jsonl, one line per game: every skater's
   ice time, goals, assists, shots and plus-minus, every goalie's minutes, shots against and
   goals against. This is what the player model is built on.

    node tools/fetch_box.js               every final game not yet in the files: the history's
                                          last five seasons and this season's (from state.json)
    node tools/fetch_box.js 2022 2024     a range of seasons, each named by the year it ends

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

/* one summary -> the line the file keeps. null when the box is empty (a game ESPN never scored) */
function boxOf(j, g) {
  const skaters = [], goalies = [];
  for (const t of (j.boxscore && j.boxscore.players) || []) {
    const code = E.codeOf(t.team); if (!code) continue;
    for (const s of t.statistics || []) {
      const L = s.labels || s.keys || []; const ix = k => L.indexOf(k);
      for (const a of s.athletes || []) {
        const st = a.stats || [], id = String(a.athlete.id), name = a.athlete.displayName;
        if (s.name === 'goalies') { const toi = secs(st[ix('TOI')]); if (toi) goalies.push({ id, name, team: code, toi, sa: +st[ix('SA')] || 0, ga: +st[ix('GA')] || 0 }); }
        else if (s.name === 'forwards' || s.name === 'defenses') {
          const toi = secs(st[ix('TOI')]); if (!toi) continue;
          skaters.push({ id, name, team: code, pos: (a.athlete.position && a.athlete.position.abbreviation) || (s.name === 'defenses' ? 'D' : 'F'), toi, g: +st[ix('G')] || 0, a: +st[ix('A')] || 0, sog: +st[ix('SOG')] || 0, pm: +st[ix('+/-')] || 0 });
        }
      }
    }
  }
  if (!skaters.length || !goalies.length) return null;
  return Object.assign({}, g, { skaters, goalies });
}

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

async function main() {
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
  try { await injuries(); } catch (e) {
    const prev = fs.existsSync(path.join(DATA, 'injuries.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'injuries.json'), 'utf8')).pulled : null;
    warn(`injuries: ${e.message}; the last report${prev ? ` (pulled ${prev})` : ''} stays, and the page says how old it is`);
  }
  if (empty) warn(`box scores: ${empty} of ${asked} empty or failed; they are asked for again next run, and the page names the club's last box until then`);
  log(`box scores: ${asked} asked, ${ok} read, ${empty} empty or failed`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { athleteId, injuriesOf };
