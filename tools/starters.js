/* The announced starting goalies, into data/starters.json.

    node tools/starters.js

   DailyFaceoff's starting-goalies page carries its data as the JSON a Next.js page embeds
   (__NEXT_DATA__): props.pageProps.data is a list of games, each with flat keys, homeTeamName and
   awayTeamName, homeGoalieName and awayGoalieName, and homeNewsStrengthName and
   awayNewsStrengthName, the status: Confirmed, Likely or Unconfirmed, read exactly (Unconfirmed is
   not confirmed). A nested shape (homeTeam: {name}, homeGoalie: {name}) is read too, since the page
   has moved before.

   Each game is written with its date, the date of the game on this site's schedule it matches
   (the same two clubs on the page's date, or within a day of the run's Eastern date when the page
   gives none), and that game's ESPN id, so players.js applies a name only to that game: yesterday's
   starters are never tonight's. The page's date is its GMT timestamp (dateGmt) in Eastern time when
   it has one, else its calendar date as written (date, gameDate: the first ten characters, never
   moved a day by reading midnight GMT as the evening before). A game that matches nothing on the
   schedule is kept aside in `unmatched`, never applied, and warned; when on a game day the page
   names games and none of them matches, the file says so (`ok: false`, "answered ... none matched")
   and the workflow's last step fails the run after the commit. The file carries names and clubs,
   never ratings; players.js matches the names to the box scores' goalies (any club's, so a goalie
   who changed clubs is found).

   The page answers GitHub's runners and not every network. When it does not answer, the games
   already in the file stay (each only for its own date) and `ok: false` with `why` says so; when it
   answers on a day with games and not one game can be read from it, the shape has changed: the
   file says so the same way and the workflow's last step fails the run after the commit, so the
   page still publishes (on the model's own goalies, saying why) and the break is seen.
   NHL_DATA, NHL_STATE, NHL_TODAY and NHL_FIXTURES move the files, the day and the page (simulate.js). */
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./espn');
const DATA = process.env.NHL_DATA || path.join(__dirname, '..', 'data');
const STATE = process.env.NHL_STATE || path.join(__dirname, '..', 'state.json');
const OUT = path.join(DATA, 'starters.json');
const URL = 'https://www.dailyfaceoff.com/starting-goalies/';
const log = m => console.log(new Date().toISOString().slice(11, 19), m);
const warn = m => { log(m); if (process.env.GITHUB_ACTIONS) console.log(`::warning title=nhl starters::${m}`); };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/* DailyFaceoff's club names to this site's codes */
const NAMES = { 'Anaheim Ducks': 'ANA', 'Boston Bruins': 'BOS', 'Buffalo Sabres': 'BUF', 'Calgary Flames': 'CGY', 'Carolina Hurricanes': 'CAR', 'Chicago Blackhawks': 'CHI', 'Colorado Avalanche': 'COL', 'Columbus Blue Jackets': 'CBJ', 'Dallas Stars': 'DAL', 'Detroit Red Wings': 'DET', 'Edmonton Oilers': 'EDM', 'Florida Panthers': 'FLA', 'Los Angeles Kings': 'LA', 'Minnesota Wild': 'MIN', 'Montreal Canadiens': 'MTL', 'Montréal Canadiens': 'MTL', 'Nashville Predators': 'NSH', 'New Jersey Devils': 'NJ', 'New York Islanders': 'NYI', 'New York Rangers': 'NYR', 'Ottawa Senators': 'OTT', 'Philadelphia Flyers': 'PHI', 'Pittsburgh Penguins': 'PIT', 'San Jose Sharks': 'SJ', 'Seattle Kraken': 'SEA', 'St. Louis Blues': 'STL', 'St Louis Blues': 'STL', 'Tampa Bay Lightning': 'TB', 'Toronto Maple Leafs': 'TOR', 'Utah Mammoth': 'UTAH', 'Utah Hockey Club': 'UTAH', 'Vancouver Canucks': 'VAN', 'Vegas Golden Knights': 'VGK', 'Washington Capitals': 'WSH', 'Winnipeg Jets': 'WPG' };
const ABBR = { LAK: 'LA', NJD: 'NJ', SJS: 'SJ', TBL: 'TB', UTA: 'UTAH', MON: 'MTL', WAS: 'WSH', CLB: 'CBJ', NAS: 'NSH' };
const codeOf = s => {
  if (!s || typeof s !== 'string') return null;
  const t = s.trim(); if (E.TEAMS.includes(t.toUpperCase())) return t.toUpperCase(); if (ABBR[t.toUpperCase()]) return ABBR[t.toUpperCase()];
  if (NAMES[t]) return NAMES[t];
  const low = t.toLowerCase();
  const k = Object.keys(NAMES).find(n => n.toLowerCase() === low) || Object.keys(NAMES).find(n => low.endsWith(n.split(' ').pop().toLowerCase()) && n.split(' ').pop().length > 3);
  return k ? NAMES[k] : null;
};
/* the status exactly: Confirmed, Likely, Unconfirmed; anything else as the page wrote it */
const statusOf = s => { const t = String(s || '').trim(); return /^confirmed$/i.test(t) ? 'Confirmed' : /^likely$/i.test(t) ? 'Likely' : /^unconfirmed$/i.test(t) ? 'Unconfirmed' : (t || null); };
const nameOf = v => !v ? null : typeof v === 'string' ? v : v.name || v.fullName || v.playerName || (v.firstName && v.lastName ? `${v.firstName} ${v.lastName}` : null);
/* the game's Eastern date. A real timestamp (dateGmt, or a start time that says its zone) is converted
   to Eastern, dateGmt first: a zone-less GMT stamp is read as GMT. A calendar key (date, gameDate) is
   the day it names, its first ten characters, never converted: '2026-10-10T00:00:00.000Z' is the 10th,
   not the evening of the 9th in New York. A clock time alone ('7:00 PM') is no date */
const STAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/, ZONE = /(Z|[+-]\d{2}:?\d{2})$/i;
const dateOf = node => {
  const gmt = node.dateGmt;
  if (typeof gmt === 'string' && STAMP.test(gmt.trim())) { const t = gmt.trim().replace(' ', 'T'); const ms = Date.parse(ZONE.test(t) ? t : t + 'Z'); if (!isNaN(ms)) return E.etDate(ms); }
  for (const k of ['date', 'gameDate']) { const v = node[k]; if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10); }
  for (const k of ['startTime', 'gameTime', 'startTimeUTC']) { const v = node[k]; if (typeof v === 'string' && STAMP.test(v.trim()) && ZONE.test(v.trim())) { const ms = Date.parse(v.trim()); if (!isNaN(ms)) return E.etDate(ms); } }
  return null;
};

/* walk the page's JSON for every game with two clubs and at least one goalie */
function harvest(node, found = [], depth = 0) {
  if (!node || typeof node !== 'object' || depth > 14) return found;
  if (Array.isArray(node)) { for (const x of node) harvest(x, found, depth + 1); return found; }
  const side = h => {
    const team = codeOf(node[`${h}TeamName`]) || codeOf(node[`${h}TeamAbbreviation`]) || codeOf(node[`${h}TeamSlug`] && String(node[`${h}TeamSlug`]).replace(/-/g, ' '))
      || (node[`${h}Team`] && typeof node[`${h}Team`] === 'object' ? codeOf(node[`${h}Team`].name) || codeOf(node[`${h}Team`].abbreviation) || codeOf(node[`${h}Team`].fullName) : codeOf(node[`${h}Team`]));
    const g = node[`${h}Goalie`];
    const name = node[`${h}GoalieName`] || nameOf(g);
    const status = statusOf(node[`${h}NewsStrengthName`] || node[`${h}GoalieStatus`] || node[`${h}Status`] || (g && typeof g === 'object' && (g.newsStrengthName || g.status)));
    return { team, goalie: name ? { name: String(name).trim(), status } : null };
  };
  const h = side('home'), a = side('away');
  if (h.team && a.team && (h.goalie || a.goalie)) found.push({ home: h.team, away: a.team, date: dateOf(node), homeGoalie: h.goalie, awayGoalie: a.goalie });
  else for (const k of Object.keys(node)) harvest(node[k], found, depth + 1);
  return found;
}

/* each game read off the page to the game on the schedule: the same two clubs, on the page's date
   or, without one, the run's Eastern date or the day either side of it */
function matchGames(found, games, today) {
  const out = [];
  for (const f of found) {
    const cands = games.filter(g => g.home === f.home && g.away === f.away && (f.date ? g.date === f.date : Math.abs(Date.parse(g.date) - Date.parse(today)) <= 86400000));
    cands.sort((x, y) => Math.abs(Date.parse(x.date) - Date.parse(f.date || today)) - Math.abs(Date.parse(y.date) - Date.parse(f.date || today)));
    const g = cands[0];
    out.push({ date: g ? g.date : (f.date || today), id: g ? String(g.id) : null, home: f.home, away: f.away, homeGoalie: f.homeGoalie, awayGoalie: f.awayGoalie });
  }
  return out;
}

async function main() {
  const today = process.env.NHL_TODAY || E.etDate(new Date());
  const S = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : { games: [] };
  const gameDay = S.games.some(g => g.date === today && g.state !== 'final');
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const keep = ((prev && prev.games) || []).filter(e => e.date >= addDays(today, -1));
  const write = o => fs.writeFileSync(OUT, JSON.stringify(Object.assign({ pulled: new Date().toISOString().slice(0, 16) + 'Z', source: 'DailyFaceoff', date: today }, o)));
  let html;
  try { html = await E.getText(URL, { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', Accept: 'text/html' }); }
  catch (e) { warn(`starters: DailyFaceoff did not answer (${e.message}); the games already in the file stay, each for its own date`); write({ ok: false, why: 'DailyFaceoff did not answer', pulled: prev ? prev.pulled : null, games: keep }); return; }
  const m = /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  let found = [];
  if (m) { try { found = harvest(JSON.parse(m[1])); } catch (e) { log(`starters: the page's data did not parse (${e.message})`); } }
  const read = matchGames(found, S.games, today);
  /* an entry is used only on the game it matched; one that matches no game on the schedule is kept
     aside (`unmatched`), never applied, and said. When the page names games on a game day and not one
     of them matches, its dates or names are being misread: the file says so (`ok: false`, 'answered'),
     and the workflow's last step fails the run after the commit, so the break is seen */
  const games = read.filter(g => g.id), unmatched = read.filter(g => !g.id);
  if (unmatched.length) warn(`starters: ${unmatched.length} of ${read.length} games read off the page match no game on the schedule: ${unmatched.slice(0, 6).map(g => `${g.away}@${g.home} ${g.date}`).join(', ')}`);
  if (!games.length && read.length) {
    const why = `DailyFaceoff answered with ${read.length} game(s) but none matched the schedule (read as ${[...new Set(unmatched.map(g => g.date))].slice(0, 3).join(', ')}): its dates or club names are being misread`;
    if (gameDay) warn(`starters: ${why}`); else log(`starters: ${why}; no game today`);
    write({ ok: !gameDay, why: gameDay ? why : null, games: keep, unmatched }); return;
  }
  if (!games.length) {
    const why = gameDay ? `DailyFaceoff answered but no game could be read from it (${m ? 'the page\'s shape has changed' : 'no __NEXT_DATA__ on the page'})` : 'no game on the page';
    if (gameDay) {
      warn(`starters: ${why}`);
      if (m) { const keys = new Set(); (function walk(n, d) { if (!n || typeof n !== 'object' || d > 6) return; for (const k of Object.keys(n)) { keys.add(k); walk(n[k], d + 1); } })(JSON.parse(m[1]), 0); log('starters: the page shape has keys ' + [...keys].slice(0, 80).join(' ')); }
    } else log(`starters: ${why}; no game today`);
    write({ ok: !gameDay, why: gameDay ? why : null, games: keep }); return;
  }
  const n = games.reduce((a, g) => a + (g.homeGoalie ? 1 : 0) + (g.awayGoalie ? 1 : 0), 0);
  const conf = games.reduce((a, g) => a + [g.homeGoalie, g.awayGoalie].filter(x => x && x.status === 'Confirmed').length, 0);
  const likely = games.reduce((a, g) => a + [g.homeGoalie, g.awayGoalie].filter(x => x && x.status === 'Likely').length, 0);
  /* the page's games replace the file's for the same game; earlier ones stay, each for its own date */
  const ids = new Set(games.map(g => g.id || `${g.date}|${g.home}|${g.away}`));
  write(Object.assign({ ok: true, why: null, games: keep.filter(e => !ids.has(e.id || `${e.date}|${e.home}|${e.away}`)).concat(games) }, unmatched.length ? { unmatched } : {}));
  log(`starters: ${read.length} games read, ${games.length} matched to the schedule; ${n} goalies named (${conf} confirmed, ${likely} likely, ${n - conf - likely} unconfirmed)`);
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { harvest, matchGames, statusOf, codeOf };
