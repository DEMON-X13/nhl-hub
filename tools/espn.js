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
  if ((m = /\/events\/(\d+)\/competitions\/\d+\/odds\/100\/propBets\?.*\bpage=(\d+)/.exec(u))) return `props_${m[1]}_p${m[2]}.json`;
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

/* DraftKings' player props for one game, from ESPN's core feed (provider 100 is DraftKings): every item on every
   page, as { status, items, pages }. status 200 with the items; 404 when ESPN says there are none ("No propBets
   found": none posted yet, or none kept), which is an answer, not a failure, so it is asked for once and never
   retried; 'failed' (with `why`) when the feed could not be read (a network error, a 5xx, a body that is not the
   feed's shape), which is asked for again next run. ESPN's own `lastUpdated` on each item runs three hours ahead of
   UTC though it is labelled Z, so nothing here reads it for timing. One request a page; limit=1000 holds a whole
   game (the most items seen was 522) */
const PROPS_URL = (e, p) => `https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/events/${e}/competitions/${e}/odds/100/propBets?lang=en&region=us&limit=1000&page=${p}`;
async function propBets(event, maxPages = 5) {
  const items = []; let pages = 0;
  for (let p = 1; p <= maxPages; p++) {
    const url = PROPS_URL(event, p);
    let r = null, why = null;
    for (let i = 0; i < 3 && !r; i++) {
      try {
        if (process.env.NHL_FIXTURES) {
          const j = JSON.parse(fromFixture(url));
          r = j && j.error && +j.error.code === 404 ? { status: 404 } : { status: 200, json: j };
          break;
        }
        const res = await fetch(url, { headers: HEADER_SETS[0], redirect: 'follow' });
        if (res.status === 404) { r = { status: 404 }; break; }
        if (!res.ok) { why = `HTTP ${res.status}`; if (res.status < 500 && res.status !== 408 && res.status !== 429) break; }
        else r = { status: 200, json: await res.json() };
      } catch (e) { why = e.message; if (process.env.NHL_FIXTURES) break; }
      if (!r) await new Promise(res => setTimeout(res, 1500 * (i + 1)));
    }
    if (!r) return { status: 'failed', items: [], pages, why: why || 'no answer' };
    if (r.status === 404) return p === 1 ? { status: 404, items: [], pages: 0 } : { status: 200, items, pages };
    const j = r.json;
    if (!j || typeof j !== 'object' || !Array.isArray(j.items)) return { status: 'failed', items: [], pages, why: 'an answer not in the feed\'s shape' };
    items.push(...j.items); pages = p;
    if (!(+j.pageCount > p)) break;
  }
  return { status: 200, items, pages };
}
/* the props the site reads: two-sided main lines and Yes-only ladders, each stat by this site's code */
const PROP_MAIN = { 'Total Points': 'pts', 'Total Assists': 'a', 'Total Shots on Goal': 's', 'Total Blocked Shots': 'bs', 'Total Saves': 'sv' };
const PROP_YES = { 'Anytime Goalscorer': ['g', 1], 'To Score 2+ Goals': ['g', 2], 'To Score 3+ Goals': ['g', 3], 'Goals Milestones': ['g', null], 'Points Milestones': ['pts', null],
  'Assists Milestones': ['a', null], 'Shots on Goal Milestones': ['s', null], 'Blocked Shots Milestones': ['bs', null], 'Goalkeeper Saves Milestones': ['sv', null] };
const LADDER_OF = { pts: 'Points Milestones', a: 'Assists Milestones', s: 'Shots on Goal Milestones', bs: 'Blocked Shots Milestones', sv: 'Goalkeeper Saves Milestones' };
const propPrice = v => { const t = String(v === undefined || v === null ? '' : v).trim().toUpperCase(); if (t === 'EVEN' || t === 'EV') return 100; return /^[+-]?\d+$/.test(t) && +t !== 0 && Math.abs(+t) >= 100 ? +t : null; };
const propAthlete = it => { const m = /\/athletes\/(\d+)/.exec((it && it.athlete && it.athlete.$ref) || ''); return m ? m[1] : null; };
const propImplied = am => am > 0 ? 100 / (am + 100) : -am / (-am + 100);
/* items (every page's, in the feed's order) -> { main, yes, skipped }.
   main: [athlete, stat, line, over, under]. ESPN does not say which item of a main line is the Over: the two items of
   a pair are adjacent, and the FIRST is the Over (the Over at L is the same bet as the (L+0.5)+ milestone, and where
   the milestone's price matched one item exactly it was the first 5,991 times in 6,022; where the two prices are more
   than 15 points apart, 7,691 of 7,693). Each pair is cross-checked with its ladder: where the milestone's price is
   nearer the second item's than the first's (in implied chance) and the two items are more than 5 points apart, the
   pair is contradicted and left out (`skipped.contradicted`), never guessed. A group of one or of three, or two not
   adjacent, is left out (`skipped.unpaired`).
   yes: [athlete, stat, k, price] for each Yes-only market (anytime goalscorer is goals 1+), the first of any two
   naming the same athlete, stat and k (Goals Milestones 2+ and To Score 2+ Goals are one bet).
   An item with no athlete (a team or period market), an unreadable price or line, or a type not read is skipped */
function propsOf(items) {
  const out = { main: [], yes: [], skipped: { unpaired: 0, contradicted: 0, junk: 0 } };
  if (!Array.isArray(items)) return out;
  const groups = new Map(), ladder = new Map(), seenYes = new Set();
  items.forEach((it, n) => {
    if (!it || typeof it !== 'object' || !it.type) { out.skipped.junk++; return; }
    const t = it.type.name, a = propAthlete(it);
    if (!PROP_MAIN[t] && !PROP_YES[t]) return;
    const price = propPrice(it.odds && it.odds.american && it.odds.american.value);
    if (!a || price === null) { out.skipped.junk++; return; }
    if (PROP_MAIN[t]) {
      const L = num(it.odds && it.odds.total && it.odds.total.value);
      if (L === null) { out.skipped.junk++; return; }
      const k = t + '|' + a + '|' + L;
      if (!groups.has(k)) groups.set(k, { stat: PROP_MAIN[t], a, L, list: [] });
      groups.get(k).list.push({ n, price });
    } else {
      let [stat, k] = PROP_YES[t];
      if (k === null) { const v = num(it.current && it.current.target && it.current.target.value); k = v === null ? null : Math.round(v); }
      if (!k || k < 1) { out.skipped.junk++; return; }
      if (LADDER_OF[stat] === t || (stat === 'g')) ladder.set(stat + '|' + a + '|' + k, price);
      const key = stat + '|' + a + '|' + k;
      if (seenYes.has(key)) return;
      seenYes.add(key); out.yes.push([a, stat, k, price]);
    }
  });
  for (const g of groups.values()) {
    if (g.list.length !== 2 || g.list[1].n !== g.list[0].n + 1) { out.skipped.unpaired++; continue; }
    const over = g.list[0].price, under = g.list[1].price;
    const m = ladder.get(g.stat + '|' + g.a + '|' + Math.floor(g.L + 1));
    if (m !== undefined && Math.abs(propImplied(m) - propImplied(under)) < Math.abs(propImplied(m) - propImplied(over)) && Math.abs(propImplied(over) - propImplied(under)) > 0.05) { out.skipped.contradicted++; continue; }
    out.main.push([g.a, g.stat, g.L, over, under]);
  }
  return out;
}

/* one day's scoreboard. `day` is YYYY-MM-DD, Eastern */
async function scoreboard(day) { return getJSON(`${SB}?dates=${day.replace(/-/g, '')}&limit=100`); }

const num = v => (v === undefined || v === null || v === '' ? null : (isFinite(+v) ? +v : null));
const american = s => num(String(s ?? '').replace('+', ''));

/* the season is the year it ends: 2026-27 is 2027. A date from August on belongs to the next one */
const seasonOf = day => { const y = +day.slice(0, 4), m = +day.slice(5, 7); return m >= 8 ? y + 1 : y; };
const etDate = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));

/* DraftKings' own ids for the outcomes ESPN prices. Each price ESPN carries has a link: DraftKings'
   affiliate gateway (https://sportsbook.draftkings.com/gateway?...&wpcn=ESPN...&preurl=...) wrapping
   the betslip URL https://sportsbook.draftkings.com/event/<event>?outcomes=<id>. Only the event and the
   id are kept, never the gateway (it carries ESPN's affiliate tags). dkHref never throws: a link that
   is not a URL, or not DraftKings', is no link (gameRow runs on every event, and one bad link must not
   stop the run). An id is kept only in its side's shape, naming this line's own number: a puck line id
   carries its number (N150 is -1.5, P150 +1.5) and a total's its total (O650 the over 6.5), so an id
   left from an older number is dropped rather than put on a slip at the wrong line */
function dkHref(href) {
  try {
    if (typeof href !== 'string' || !href) return null;
    let u = new URL(href);
    const pre = u.searchParams.get('preurl');
    if (pre) u = new URL(pre);
    if (!/(^|\.)draftkings\.com$/i.test(u.hostname)) return null;
    const ev = /\/event\/(\d+)/.exec(u.pathname), id = u.searchParams.get('outcomes');
    return { event: ev ? ev[1] : null, id: id || null };
  } catch (e) { return null; }
}
const DK_KEYS = ['event', 'homeML', 'awayML', 'homePL', 'awayPL', 'over', 'under'];
/* each id's shape and the number it must name: homeLine for the home puck line, its opposite for the away one, the total for both totals */
function dkIdOk(key, id, line) {
  if (typeof id !== 'string') return false;
  const n = (s, d) => (s === 'N' ? -1 : 1) * (+d) / 100;
  const has = v => v !== null && v !== undefined;
  let m;
  switch (key) {
    case 'event': return /^\d+$/.test(id);
    case 'homeML': return /^0ML\d+_1$/.test(id);
    case 'awayML': return /^0ML\d+_3$/.test(id);
    case 'homePL': return !!(m = /^0HC\d+([NP])(\d+)_1$/.exec(id)) && has(line.homeLine) && n(m[1], m[2]) === line.homeLine;
    case 'awayPL': return !!(m = /^0HC\d+([NP])(\d+)_3$/.exec(id)) && has(line.homeLine) && n(m[1], m[2]) === -line.homeLine;
    case 'over': return !!(m = /^0OU\d+O(\d+)_1$/.exec(id)) && has(line.total) && +m[1] / 100 === line.total;
    case 'under': return !!(m = /^0OU\d+U(\d+)_3$/.exec(id)) && has(line.total) && +m[1] / 100 === line.total;
  }
  return false;
}
/* an id in its side's shape, whatever number it names: what tells a link the job cannot read from one on another number */
const DK_SHAPE = { homeML: /^0ML\d+_1$/, awayML: /^0ML\d+_3$/, homePL: /^0HC\d+[NP]\d+_1$/, awayPL: /^0HC\d+[NP]\d+_3$/, over: /^0OU\d+O\d+_1$/, under: /^0OU\d+U\d+_3$/ };
/* the six outcomes, each side of each market: what a slip is made of (the event alone opens a game's page, not a bet) */
const DK_OUTCOMES = DK_KEYS.slice(1);
const dkHasIds = dk => !!dk && DK_OUTCOMES.some(k => typeof dk[k] === 'string');
/* one odds object's ids: { dk, links, read }, dk null when no link gave a usable id (the event alone is kept, beside no
   outcome id), links the outcomes' links ESPN carried on it, read the outcome ids kept (the event never counts: an
   answer whose links name the event but no outcome is one with no id, for the carry rule and for sources.js alike) */
function dkOf(o, line) {
  const res = { dk: null, links: 0, read: 0, keys: {} };
  if (!o || typeof o !== 'object') return res;
  const at = side => side && side.close && side.close.link && side.close.link.href;
  const hrefs = { homeML: at(o.moneyline?.home), awayML: at(o.moneyline?.away), homePL: at(o.pointSpread?.home), awayPL: at(o.pointSpread?.away), over: at(o.total?.over), under: at(o.total?.under) };
  const evHref = o.link && o.link.href;
  res.links = Object.values(hrefs).filter(h => typeof h === 'string' && h).length;
  const dk = {};
  const e = dkHref(evHref);
  if (e && e.event && dkIdOk('event', e.event, line)) dk.event = e.event;
  for (const k of DK_KEYS.slice(1)) {
    /* each outcome: ESPN gave it a link; the link held an id in its side's shape; the id was kept (its shape and this line's number) */
    const x = dkHref(hrefs[k]), r = res.keys[k] = { link: typeof hrefs[k] === 'string' && !!hrefs[k], shape: false, id: false };
    if (!x) continue;
    if (!dk.event && x.event) dk.event = x.event;          // the event page from any outcome's link when the event's own link is missing
    r.shape = !!x.id && DK_SHAPE[k].test(x.id);
    if (x.id && dkIdOk(k, x.id, line)) { dk[k] = x.id; r.id = true; }
  }
  const out = {}; for (const k of DK_KEYS) if (dk[k] !== undefined) out[k] = dk[k];
  res.read = DK_OUTCOMES.filter(k => out[k] !== undefined).length;
  if (Object.keys(out).length) res.dk = out;
  return res;
}

/* the carry rule: DraftKings' ids for a line read now, beside `prev`, the line it replaces. The answer's own
   ids whenever it gave an outcome id; an answer with none (no usable link at all: ESPN's DraftKings prices have
   come through as "Draft Kings", and that shape may carry none; or links naming the event and no outcome) keeps
   the line before's outcome ids for the same numbers: the moneylines, the puck lines only on the same puck line,
   the totals only on the same total, beside the event (this answer's, else the one before's; none are carried
   onto another event), dated by when they were read (dk.at, only ever on carried ids). An answer with some
   outcome id never carries, and another book's prices, now or before, carry none. `line` is changed in place
   and returned with how its ids came: 'read', 'carried', 'event' (an event alone, nothing carried) or 'none'.
   update.js reads every line through it, and so does the page's Refresh odds (ESPN.carryDk in index.html, word
   for word: the smoke test holds the two equal on a table of cases) */
function carryDk(line, prev) {
  if (dkHasIds(line.dk)) return { line, how: 'read' };
  const q = prev && prev.dk, ev = line.dk && line.dk.event;
  const none = () => ({ line, how: ev ? 'event' : 'none' });
  if (!dkHasIds(q) || bookKey(line.book) !== 'draftkings' || bookKey(prev.book) !== 'draftkings') return none();
  if (ev && q.event && ev !== q.event) return none();
  const keep = ['homeML', 'awayML'].concat(prev.homeLine === line.homeLine ? ['homePL', 'awayPL'] : [], prev.total === line.total ? ['over', 'under'] : []);
  const dk = {}; if (ev || typeof q.event === 'string') dk.event = ev || q.event;
  for (const k of DK_OUTCOMES) if (keep.includes(k) && typeof q[k] === 'string') dk[k] = q[k];
  if (!dkHasIds(dk)) return none();
  dk.at = q.at || prev.at;
  line.dk = dk;
  return { line, how: 'carried' };
}

/* DraftKings via ESPN: both moneylines, the puck line (the home side's number, -1.5 when the
   home side is favoured) with its prices, and the total with its prices. null where ESPN carries
   nothing, which is every finished game and most games more than a couple of days out. `dk`, last,
   is DraftKings' own id for each outcome (dkOf), left out when ESPN gave no usable link */
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
  const { dk } = dkOf(o, out);
  if (dk) out.dk = dk;
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

/* a book's name as two runs agree on it: ESPN has said both "DraftKings" and "Draft Kings" */
const bookKey = s => String(s || '').toLowerCase().replace(/\s+/g, '');

module.exports = { propBets, propsOf, PROPS_URL, PROP_MAIN, PROP_YES, propPrice, getJSON, getText, scoreboard, gameRow, teamsOf, CLUBS, TEAMS, codeOf, seasonOf, etDate, normName, dkHref, dkOf, dkIdOk, DK_KEYS, DK_OUTCOMES, dkHasIds, bookKey, carryDk };
