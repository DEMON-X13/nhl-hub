/* ESPN's public NHL feeds, the way the college site's cfb/tools/espn.js in DEMON-X13/nfl-hub
   reads the college ones. No key, no credits. The NHL has no weeks, so the unit is the day
   (Eastern): one scoreboard request per calendar day, which is every game that day, its score
   and period count once final, and DraftKings' moneyline, puck line and total while it is
   still to come.

   A scoreboard event is flattened by gameRow() into the row shape the whole site uses. Team
   codes are this site's own (TEAMS): ESPN's ids are mapped onto them, so a franchise that
   moved (the Coyotes, now Utah) is one team all the way back. */
'use strict';
const fs = require('fs'), path = require('path');

const SB = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard';

/* the 32 clubs: code -> ESPN id, conference, division. Arizona's id (24) folds into Utah's */
const CLUBS = {
  ANA: { id: '25', name: 'Anaheim Ducks', conf: 'West', div: 'Pacific' },
  BOS: { id: '1', name: 'Boston Bruins', conf: 'East', div: 'Atlantic' },
  BUF: { id: '2', name: 'Buffalo Sabres', conf: 'East', div: 'Atlantic' },
  CGY: { id: '3', name: 'Calgary Flames', conf: 'West', div: 'Pacific' },
  CAR: { id: '7', name: 'Carolina Hurricanes', conf: 'East', div: 'Metropolitan' },
  CHI: { id: '4', name: 'Chicago Blackhawks', conf: 'West', div: 'Central' },
  COL: { id: '17', name: 'Colorado Avalanche', conf: 'West', div: 'Central' },
  CBJ: { id: '29', name: 'Columbus Blue Jackets', conf: 'East', div: 'Metropolitan' },
  DAL: { id: '9', name: 'Dallas Stars', conf: 'West', div: 'Central' },
  DET: { id: '5', name: 'Detroit Red Wings', conf: 'East', div: 'Atlantic' },
  EDM: { id: '6', name: 'Edmonton Oilers', conf: 'West', div: 'Pacific' },
  FLA: { id: '26', name: 'Florida Panthers', conf: 'East', div: 'Atlantic' },
  LA: { id: '8', name: 'Los Angeles Kings', conf: 'West', div: 'Pacific' },
  MIN: { id: '30', name: 'Minnesota Wild', conf: 'West', div: 'Central' },
  MTL: { id: '10', name: 'Montreal Canadiens', conf: 'East', div: 'Atlantic' },
  NSH: { id: '27', name: 'Nashville Predators', conf: 'West', div: 'Central' },
  NJ: { id: '11', name: 'New Jersey Devils', conf: 'East', div: 'Metropolitan' },
  NYI: { id: '12', name: 'New York Islanders', conf: 'East', div: 'Metropolitan' },
  NYR: { id: '13', name: 'New York Rangers', conf: 'East', div: 'Metropolitan' },
  OTT: { id: '14', name: 'Ottawa Senators', conf: 'East', div: 'Atlantic' },
  PHI: { id: '15', name: 'Philadelphia Flyers', conf: 'East', div: 'Metropolitan' },
  PIT: { id: '16', name: 'Pittsburgh Penguins', conf: 'East', div: 'Metropolitan' },
  SJ: { id: '18', name: 'San Jose Sharks', conf: 'West', div: 'Pacific' },
  SEA: { id: '124292', name: 'Seattle Kraken', conf: 'West', div: 'Pacific' },
  STL: { id: '19', name: 'St. Louis Blues', conf: 'West', div: 'Central' },
  TB: { id: '20', name: 'Tampa Bay Lightning', conf: 'East', div: 'Atlantic' },
  TOR: { id: '21', name: 'Toronto Maple Leafs', conf: 'East', div: 'Atlantic' },
  UTAH: { id: '129764', name: 'Utah Mammoth', conf: 'West', div: 'Central', was: ['24'] },
  VAN: { id: '22', name: 'Vancouver Canucks', conf: 'West', div: 'Pacific' },
  VGK: { id: '37', name: 'Vegas Golden Knights', conf: 'West', div: 'Pacific' },
  WSH: { id: '23', name: 'Washington Capitals', conf: 'East', div: 'Metropolitan' },
  WPG: { id: '28', name: 'Winnipeg Jets', conf: 'West', div: 'Central' },
};
const TEAMS = Object.keys(CLUBS);
const BY_ID = {};
for (const [code, c] of Object.entries(CLUBS)) { BY_ID[c.id] = code; for (const w of c.was || []) BY_ID[w] = code; }
const codeOf = team => BY_ID[String(team.id)] || null;

const HEADER_SETS = [
  { 'User-Agent': 'nhl-hub/1.0 (+https://github.com/DEMON-X13/nhl-hub)', Accept: 'application/json' },
  {},
];
/* NHL_FIXTURES names a folder of saved answers, which is how simulate.js plays the job offline: a
   URL is read from the file named for it, and a file that is not there is a request that failed */
function fixtureName(url) {
  const u = String(url); let m;
  if ((m = /summary\?event=(\d+)/.exec(u))) return `summary_${m[1]}.json`;
  if ((m = /scoreboard\?dates=(\d{4})(\d{2})(\d{2})/.exec(u))) return `sb_${m[1]}-${m[2]}-${m[3]}.json`;
  if (/\/injuries/.test(u)) return 'injuries.json';
  if (/dailyfaceoff\.com/.test(u)) return 'dailyfaceoff.html';
  return null;
}
function fromFixture(url) {
  const name = fixtureName(url), file = name && path.join(process.env.NHL_FIXTURES, name);
  if (!file || !fs.existsSync(file)) throw new Error(`HTTP 503 (no saved answer) ${url}`);
  return fs.readFileSync(file, 'utf8');
}
/* a page as text (DailyFaceoff's), the same way */
async function getText(url, headers) {
  if (process.env.NHL_FIXTURES) return fromFixture(url);
  const r = await fetch(url, { headers, redirect: 'follow' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.text();
}
async function getJSON(url, tries = 3) {
  if (process.env.NHL_FIXTURES) return JSON.parse(fromFixture(url));
  let last;
  for (let i = 0; i < tries; i++) {
    for (const headers of HEADER_SETS) {
      try {
        const r = await fetch(url, { headers, redirect: 'follow' });
        if (r.ok) return await r.json();
        last = new Error(`HTTP ${r.status} ${url}`);
      } catch (e) { last = e; }
    }
    await new Promise(res => setTimeout(res, 1500 * (i + 1)));
  }
  throw last;
}

/* one day's scoreboard. `day` is YYYY-MM-DD, Eastern */
async function scoreboard(day) { return getJSON(`${SB}?dates=${day.replace(/-/g, '')}&limit=100`); }

const num = v => (v === undefined || v === null || v === '' ? null : (isFinite(+v) ? +v : null));
const american = s => num(String(s ?? '').replace('+', ''));

/* the season is the year it ends: 2026-27 is 2027. A date from August on belongs to the next one */
const seasonOf = day => { const y = +day.slice(0, 4), m = +day.slice(5, 7); return m >= 8 ? y + 1 : y; };
const etDate = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

/* DraftKings via ESPN: both moneylines, the puck line (the home side's number, -1.5 when the
   home side is favoured) with its prices, and the total with its prices. null where ESPN carries
   nothing, which is every finished game and most games more than a couple of days out */
function oddsOf(comp) {
  const o = (comp.odds || [])[0];
  if (!o) return null;
  const ml = o.moneyline, ps = o.pointSpread, tot = o.total;
  const out = { book: o.provider?.name || null, total: num(o.overUnder) };
  out.homeML = ml?.home?.close?.odds !== undefined ? american(ml.home.close.odds) : null;
  out.awayML = ml?.away?.close?.odds !== undefined ? american(ml.away.close.odds) : null;
  if (ps?.home?.close?.line !== undefined) out.homeLine = num(String(ps.home.close.line).replace('+', ''));
  else if (o.spread !== undefined && o.spread !== null) out.homeLine = o.homeTeamOdds?.favorite ? -Math.abs(+o.spread) : Math.abs(+o.spread);
  else out.homeLine = null;
  out.homeSpreadOdds = ps?.home?.close?.odds !== undefined ? american(ps.home.close.odds) : null;
  out.awaySpreadOdds = ps?.away?.close?.odds !== undefined ? american(ps.away.close.odds) : null;
  out.overOdds = tot?.over?.close?.odds !== undefined ? american(tot.over.close.odds) : null;
  out.underOdds = tot?.under?.close?.odds !== undefined ? american(tot.under.close.odds) : null;
  if (out.homeML === null && out.homeLine === null && out.total === null) return null;
  return out;
}

/* one event -> one row. null for a game that is not two NHL clubs (an exhibition). A game the feed
   marks postponed or cancelled is a marker, { id, gone: 'postponed' | 'cancelled', date, home, away },
   never a row: the job takes a game off the schedule only on the feed's word, so a game that is
   merely missing from an answer is never mistaken for one called off */
function gameRow(ev) {
  const comp = ev.competitions?.[0];
  if (!comp || !comp.competitors) return null;
  const home = comp.competitors.find(c => c.homeAway === 'home'), away = comp.competitors.find(c => c.homeAway === 'away');
  if (!home || !away) return null;
  const H = codeOf(home.team), A = codeOf(away.team);
  if (!H || !A) return null;
  const st = comp.status?.type || {};
  const off = `${st.name || ''} ${st.description || ''}`;
  if (/POSTPONED|CANCEL/i.test(off)) return { id: String(ev.id), gone: /CANCEL/i.test(off) ? 'cancelled' : 'postponed', date: etDate(comp.date || ev.date), home: H, away: A };
  const state = st.state === 'post' ? 'final' : st.state === 'in' ? 'live' : 'pre';
  const periods = state === 'pre' ? null : Math.max((home.linescores || []).length, (away.linescores || []).length, comp.status?.period || 0) || null;
  const date = etDate(comp.date || ev.date);
  return {
    id: String(ev.id), season: ev.season?.year ?? seasonOf(date), type: ev.season?.type ?? 2, date, start: comp.date || ev.date,
    state, detail: st.shortDetail || st.detail || null,
    home: H, away: A, hs: state === 'pre' ? null : num(home.score), as: state === 'pre' ? null : num(away.score),
    periods, neutral: !!comp.neutralSite,
    hrec: (home.records || [])[0]?.summary || null, arec: (away.records || [])[0]?.summary || null,
    note: (comp.notes || [])[0]?.headline || null, odds: oddsOf(comp),
  };
}

/* names, colours and logos as the feed shows them, kept beside the fixed club table */
function teamsOf(json, into = {}) {
  for (const ev of json.events || []) for (const c of (ev.competitions?.[0]?.competitors || [])) {
    const code = codeOf(c.team); if (!code) continue;
    const t = c.team;
    into[code] = { abbr: t.abbreviation, name: t.displayName, short: t.shortDisplayName || t.name,
      color: t.color ? '#' + t.color : null, logo: t.logo || null };
  }
  return into;
}

/* a name as two sources can agree on it: no accents, no punctuation, no Jr., lower case */
const normName = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[.'’]/g, '').replace(/-/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, ' ').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();

module.exports = { getJSON, getText, scoreboard, gameRow, teamsOf, CLUBS, TEAMS, codeOf, seasonOf, etDate, normName };
