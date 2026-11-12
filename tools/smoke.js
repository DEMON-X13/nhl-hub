/* Boot index.html in jsdom against the published state.json and walk every tab, then hold
   the state to what it was built from.

    node tools/smoke.js        (from the repo root, or node smoke.js from tools/)

   Must end "0 failures". Checks are against the page's invariants and against reality, never
   against what the day's data happens to offer: an off day, a lean slate, opening night, a day with
   no injury report, a game already played or postponed, the playoffs and the summer must not fail it.

   Reality, each read here on its own terms and never through the job's code:
     - the injury report (data/injuries.json): no row's id is the string "undefined"; the
       lineups still to play were built on this report (a game whose start the feed moved later after
       its puck drop is not still to play: its card is the call frozen then, as the job keeps it);
       nobody it has out, on injured reserve or suspended is in his club's lineup or named in goal,
       and no goalie it lists under another club is named for his old one (a goalie DailyFaceoff
       confirms stands)
     - the box scores (data/box_<season>.jsonl): a goalie named by the model's own rule has
       played for the club this season or last, and once the club has three games this season he
       started one of them, unless every goalie who did is out or gone; a goalie said to be on the
       second night of a back to back is (the club's game before is the day before) and is not
       the one who started that night (its box score) or is named for it (a game still to come);
       a game under way or over and not yet boxed is not compared, since its card is the call
       frozen at puck drop, which may be an older run's goalie
     - DailyFaceoff (data/starters.json): a goalie it names for a game still to come, who is a
       rated goalie of that club and not out, is the one in goal on that game
     - the clock: a call is never made after its puck drop; a call shown before puck drop is the call
       graded, field for field, against the last published state (NHL_PREV_STATE, else git's
       HEAD:state.json; a row an older job wrote after puck drop is exempt), a game delayed less
       than half a day counting as started; no started call of that state is gone from this one
       unless `removed` gives the feed's reason (postponed, cancelled, or never final and unseen two
       days past its puck drop); the state is the job's second pass, never the first's; a call that
       is the player model's carries the player model's margin; and the page, opened at a game's
       puck drop, offers no bet on it and calls the visitor's day Today
     - the playoffs: a club knocked out has no Cup or conference chance, the champion has the Cup, a
       club in a series ESPN has is in the playoffs for certain, and the field the standings mark is the
       first round of the league's bracket (the tab that drew it went in nhl v14)
     - the props model (THE PROPS MODEL): the box files' shots kept and never ESPN's SOG (shootout) column, the
       record of closing props in its shape, the shadow ledger by props_check.js against the last commit's
       (NHL_PREV_LEDGER, else git's HEAD:data/props_ledger.json), and the state's projections: games still to
       come only, every distribution whole, every player in his club's lineup and not out, each game the
       ledger's open call
     - the Games list (THE GAMES LIST, nhl v28): the Day select, its steppers, the two pills, Refresh scores and its stamp, Refresh odds
       on a day with a game to come, and every row of every day in the select cell by cell, by a model of this file's own on any state
       the job can publish; planted scores, finals, a moved start, the day's turn, no game and no schedule; the page opened before the
       season, after it and on a day with no game; the three layouts read from the stylesheet. Since its review: the one read of a day
       shown and its stamp's zone, a game ESPN has called off (never a final), the call by one rounding on the row and the page, a
       band's record on its pill, a game with no call, the last cell's two whole parts, the source note, the idle odds line's books
     - the game's page (THE GAME'S PAGE, nhl v27): the page every game's row opens and its three windows, by a model of this file's
       own on any state the job can publish: the bar, the status line or the score's strip, the head, Game bets row by row (a box where
       a fresh line of a game to come prices the side, DraftKings' fair chance, its band, the model's chance, the price, Value on the
       state's picks, the grades once the puck has dropped), each club's outs and every player's row and lines, the keyboard and the
       ways out, the layout's rules, and planted states (another book, a stale line, no line, the read's states, the trial's verdicts,
       the puck dropping, a score and a final read here, a moved start, a final with and without its box score, no props model).
       Since its review: a final with no box score keeps its projections, the ticked box stays where it stood (a made-up layout), the
       status line at the foot follows the builder (another tab, the puck drop, a read), and a press made from the page says its
       word on each game there, worked out from the answers every window's stubs gave (boot's __answers, pressS, pressWordS)
     - the look (THE LOOK, nhl v12, the colours nhl v13, the tags nhl v25): no image
       anywhere, every club's tag by its own contrast sums, in a hue of its own and clear of every club outside its own colour,
       nothing the cards carried left on the Games tab; the bets board of Pick your own legs, each bet button its one line, its call's tag
       and edge, a side far off the market said on its own button with both numbers, every piece that cannot wrap within the narrowest
       button's room, a row's two buttons laid out alike; a made-up game that takes every branch on its row, its page and its windows; and
       every table keeping every column at every width, scrolling sideways in its wrapper with its hidden names held
       inside it (Team Rankings' table fixed on its eleven columns' widths, laid out by its words on a phone); the figures' formats, no
       Playoff tab (nhl v14) and no Standings tab (nhl v26), and the Record's figures fitted to their tiles (jsdom lays nothing out: the
       rules are read, and the Record's fit is held on a made-up layout)
     - Team Rankings (TEAM RANKINGS, nhl v26, the NFL hub's tab where the Standings and Power Ratings were): the one table worked out
       from the state by rules of this file's own (the order, the shared ranks, each row word for word, the tier of the Elo shown by its
       own nine numbers, the Elo change and the rank moves over seven days from the game rows' rh and ra), the absences card, nothing
       stored or fetched, the old addresses, on the state and on made-up copies
     - ELO Ratings (ELO RATINGS, nhl v29, the NFL hub's tab where the Players tab was): who is ranked, the scale (the mean and the
       spread of each group's goals-a-game figures), every row's Elo, tier, figures, Career, Trend and Peak, the histogram's counts,
       the clubs' four unit tables, the pills, the search and what is stored, by this file's own sums, on the state and on made-up
       copies
   NHL_STATE, NHL_DATA, NHL_PREV_STATE and NHL_OUT move the files (simulate.js); NHL_HTML tries another page; NHL_SMOKE_ALL=1 lists every
   failure; NHL_SMOKE_ONLY=list,page,look,... runs the named sections alone, a development aid that always ends as a failure. */
'use strict';
/* The heap. Every section boots the page in jsdom several times. On 12 November 2026 a review measured the whole run at 2,009 MB of the
   2,096 MB Node 22 allows by default, and a page three small edits bigger died there ("Reached heap limit", exit 134); with THE GAMES LIST
   and THE GAME'S PAGE added it reached 2,637 MB where it was given room. A gate that dies takes every publish with it. The cause was
   windows left open: a window booted and closed is given back whole (eight of them hold 62 MB, measured), but one left open keeps its
   page's timers and its whole realm, and the sections written before the heap mattered left theirs open. So:
   - main() closes every window a section opened once the section is over (OPEN, closeSince) and collects; what a section leaves held
     is then 170 to 380 MB, and the run's peak 1,141 MB, inside the heaviest section;
   - the smoke runs itself again with room (a 6 GB ceiling, not a reservation; GitHub's runner has 16) and --expose-gc, whoever starts
     it: the job, simulate.js, a hand. A caller that sets --max-old-space-size itself is left alone;
   - the line before the count says the peak and what is still held at the end, so a run that creeps is seen in the job's log long
     before it reaches the ceiling. NHL_SMOKE_HEAP=1 says both after each section. */
if (!process.execArgv.some(a => /^--max[-_]old[-_]space[-_]size/.test(a)) && !process.env.NHL_SMOKE_CHILD) {
  const r = require('child_process').spawnSync(process.execPath, ['--max-old-space-size=6144', '--expose-gc', ...process.execArgv, ...process.argv.slice(1)],
    { stdio: 'inherit', env: Object.assign({}, process.env, { NHL_SMOKE_CHILD: '1' }) });
  if (r.error) { console.error(`smoke: could not start itself with a larger heap: ${r.error.message}`); process.exit(1); }
  process.exit(r.status === null ? 1 : r.status);
}
let HEAP_PEAK = 0;
const heapNow = () => { const h = process.memoryUsage().heapUsed; if (h > HEAP_PEAK) HEAP_PEAK = h; return h; };
setInterval(heapNow, 500).unref();
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const DATA = process.env.NHL_DATA || path.join(ROOT, 'data');
const HTML = fs.readFileSync(process.env.NHL_HTML || path.join(ROOT, 'index.html'), 'utf8');      // NHL_HTML: a page to try in its place
const STATE = fs.readFileSync(process.env.NHL_STATE || path.join(ROOT, 'state.json'), 'utf8');
let S = JSON.parse(STATE);          // the published state; the builder's checks on made-up copies swap it for a moment
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const PREV = (() => {
  if (process.env.NHL_PREV_STATE) return process.env.NHL_PREV_STATE === 'none' ? null : readJSON(process.env.NHL_PREV_STATE);
  if (process.env.NHL_STATE) return null;
  try { return JSON.parse(execFileSync('git', ['show', 'HEAD:state.json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { return null; }
})();

const fails = []; let checks = 0;
const chk = (ok, msg) => { checks++; if (!ok) fails.push(msg); };
/* a promise the page leaves rejected (an async handler that throws) is a failure, never a crash of this smoke */
process.on('unhandledRejection', e => { checks++; fails.push(`an unhandled rejection in the page: ${e && e.stack ? String(e.stack).split('\n').slice(0, 2).join(' ') : e}`); });
const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
const wait = ms => new Promise(r => setTimeout(r, ms));
/* nhl v27: a game's card opens the game's page (#gameModal): its bets are the page's Game bets (.gbets), a box a bet; a player's lines
   are under his row there, one player open at a time. These find them: the day shown (openDay), a game's card (cardOf), the page opened
   on a game from its card (betsOn: the Games tab and the game's day shown first, another game's page shut first; null where the game has
   no card), the box of a leg "gid|side|kind" (betIn: null where the page offers no such bet), a player's box by its key (propBox: his
   row opened first, All skaters ticked where the cut leaves him out), and whether a box or a button is on (isOn). The page is left
   open on the game: closeBets shuts it */
const gameDoc = d => d.defaultView;
const openDay = (d, date) => { const s = d.getElementById('daySel'); if (!s || ![...s.options].some(o => o.value === date)) return false; if (s.value !== date) { s.value = date; s.dispatchEvent(new d.defaultView.Event('change', { bubbles: true })); } return true; };
const dayList = d => [...d.querySelectorAll('#daySel option')].map(o => o.value);
const cardOf = (d, gid) => d.querySelector(`#gamesList .game[data-game="${gid}"]`);
const pageOn = (d, gid) => { const m = d.getElementById('gameModal'), c = d.querySelector('#gameView .gbets'); return !!m && !m.hidden && !!c && (gid === undefined || c.dataset.game === gid); };
const closeBets = d => { const m = d.getElementById('gameModal'); if (m && !m.hidden) d.getElementById('backBtn').click(); };
function betsOn(d, g) {
  const gid = typeof g === 'string' ? g : g.id;
  if (pageOn(d, gid)) return d.querySelector('#gameView .gbets');
  closeBets(d);
  const tab = d.querySelector('#tabs button[data-tab="games"]'); if (tab && !tab.classList.contains('on')) tab.click();
  const date = typeof g === 'string' ? (gameDoc(d).eval(`(gameById()[${JSON.stringify(gid)}] || {}).date`) || null) : g.date;
  if (date) openDay(d, date);
  const ob = cardOf(d, gid); if (!ob) return null;
  ob.click();
  return pageOn(d, gid) ? d.querySelector('#gameView .gbets') : null;
}
const betIn = (d, g, leg) => { const pb = betsOn(d, g); return pb ? pb.querySelector(`input[data-leg="${leg}"]`) : null; };
const isOn = el => !!el && (el.tagName === 'INPUT' ? el.checked : el.getAttribute('aria-pressed') === 'true');
function propBox(d, key) {
  if (!pageOn(d)) return null;
  const pid = String(key).split('|')[0], row = () => [...d.querySelectorAll('#gameView .plrbtn[data-open]')].find(r => r.dataset.open === pid);
  if (!row()) { const all = d.getElementById('allCb'); if (all && !all.checked) all.click(); }
  if (!row()) return null;
  if (row().getAttribute('aria-expanded') !== 'true') row().click();
  return [...d.querySelectorAll('#gameView input[data-pp-add]')].find(x => x.dataset.ppAdd === key) || null;
}
/* a bet tapped on its game's page, the page shut after and the tab open before it opened again; false where there is no such bet */
const tapBet = (d, g, leg) => { const t0 = d.querySelector('#tabs button.on'), b = betIn(d, g, leg); if (b) b.click(); closeBets(d); if (t0 && !t0.classList.contains('on')) t0.click(); return !!b; };
/* the legs the builder draws now, by id (the page's own list: what a box should show as ticked) */
const drawnIds = w => new Set(JSON.parse(w.eval('JSON.stringify(builderLegs(false).map(L => L.id))')));
const PUB = Date.parse(S.published);
const etDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const dayBefore = d => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - 1); return x.toISOString().slice(0, 10); };
const startedAt = (g, ms) => g.state !== 'pre' || Date.parse(g.start) <= ms;
/* a delay: the puck drop a frozen call was made before has passed and the feed has moved the start less than
   half a day later; the job keeps that call (its started() rule), so the game is under way for these checks */
const delayedAt = (call, start, ms) => !!(call && call.frozen && call.before && Date.parse(call.before) <= ms && Date.parse(start) - Date.parse(call.before) < 12 * 3600000);
/* a name as the report and the box scores can agree on it; written here again on purpose, not shared with the job */
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.'’]/g, '').replace(/-/g, ' ').replace(/\b(jr|sr|ii|iii|iv)\b/g, ' ').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim();
const OUT = /\bout\b|injured reserve|\bir\b|\bltir\b|suspen/i;
/* a row of the injury report is a player as players.js's readInjuries reads it: a row with an ESPN id is that player and no
   other (no name guess past it), a row with none the rated player of its club by that name, else the one rated player of the
   name. Matched by name alone, two goalies of one name (two Matt Murrays) once made one's injury the other's */
const hasId = r => !!r.id && /^\d+$/.test(String(r.id));
const rowIs = (r, p) => {
  /* a goalie DailyFaceoff names with no NHL game has no ESPN id here ('new:<name>'): a row of his club by his name is his */
  if (hasId(r)) return String(r.id) === String(p.id) || (!/^\d+$/.test(String(p.id)) && !!p.club && r.club === p.club && norm(r.name) === norm(p.name));
  const n = norm(r.name); if (!n || n !== norm(p.name)) return false;
  const rated = S.players && S.players.players; if (!rated) return true;
  const of = club => Object.entries(rated).filter(([, x]) => norm(x.name) === n && (!club || x.team === club)).map(([id]) => id);
  const own = of(r.club), any = of(null);
  return own.length === 1 ? own[0] === String(p.id) : !own.length && any.length === 1 ? any[0] === String(p.id) : false;
};
const CALL = ['pHome', 'rh', 'ra', 'diff', 'mu', 'xt', 'tie', 'frozen', 'before', 'pm', 'elo', 'by', 'models', 'line', 'pick', 'mlEdge', 'mlPick', 'cover', 'plEdge', 'plPick', 'ou', 'ouEdge', 'ouPick'];

/* boot the page with the clock at `clockMs`; resolves to the window once it has drawn. opts: state (a JSON
   string in place of the published one), store (what nhl_v1 holds before the page loads), hash, espn (a function of
   the URL answering ESPN's scoreboard in place of an empty one), props (a function of the URL answering ESPN's DraftKings
   propBets, which never reach `espn`; by default ESPN's own 404, "No propBets found"). The clock is
   the window's __setClock(ms) from then on; every request the page makes is in __requests, every key it
   writes in __writes, and confirm() answers __confirm (true unless set) */
/* ESPN's DraftKings propBets for one game, as the page asks for it (a cache-buster at the end), and ESPN's 404 for a game with none */
const PROPS_RX = /^https:\/\/sports\.core\.api\.espn\.com\/v2\/sports\/hockey\/leagues\/nhl\/events\/(\d+)\/competitions\/\1\/odds\/100\/propBets\?lang=en&region=us&limit=1000&page=(\d+)&_=\d+$/;
const PROPS_404 = url => { const m = PROPS_RX.exec(url); return { ok: false, status: 404, json: async () => ({ error: { message: `No propBets found for eventId ${m ? m[1] : '?'} and provider 100`, code: 404 } }) }; };
/* the state without the job's read of DraftKings' player lines (props.games[id].dk, props.dk): the sections that hold a Refresh odds
   press, the props window before one and the same-game legs boot on it, so the page they hold is the one a press starts from on a
   state that carries no job read; THE JOB'S PLAYER LINES boots on the state as published (`keepDk`) and holds the read itself */
const NODK_C = new Map();
function noDk(body) {
  if (NODK_C.has(body)) return NODK_C.get(body);
  let out = body;
  try {
    const j = JSON.parse(body), pg = j && j.props && j.props.games;
    if (pg && typeof pg === 'object' && (j.props.dk || Object.values(pg).some(x => x && x.dk))) {
      delete j.props.dk;
      for (const x of Object.values(pg)) if (x && typeof x === 'object') delete x.dk;
      out = JSON.stringify(j);
    }
  } catch (e) { /* a junk state is booted as it is */ }
  if (NODK_C.size > 8) NODK_C.clear();
  NODK_C.set(body, out);
  return out;
}
/* every window boot() makes, until it is closed (the heap, at the top of this file): main() closes whatever a section opened once the
   section is over, and everything at the end */
const OPEN = new Set();
function closeSince(had) { for (const x of [...OPEN]) if (!had || !had.has(x)) { try { x.close(); } catch (e) { /* closed already */ } OPEN.delete(x); } }
async function boot(clockMs, errors, opts = {}) {
  /* opts.bodyProbe, for THE LOOK: LIGHT AND DARK: a script first in the body noting html[data-theme] as the body starts to be parsed (__atBody) */
  const html0 = opts.bodyProbe ? HTML.replace('<body>', '<body><script>window.__atBody = document.documentElement.getAttribute("data-theme") || "";</' + 'script>') : HTML;
  const dom = new JSDOM(html0.replace(/<link[^>]*fonts[^>]*>/g, ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' + (opts.hash ? '#' + opts.hash : ''),
    beforeParse(w) {
      const Real = w.Date; let offset = clockMs - Real.now();
      class Clock extends Real { constructor(...a) { if (a.length) super(...a); else super(Real.now() + offset); } static now() { return Real.now() + offset; } }
      w.Date = Clock;
      w.__setClock = ms => { offset = ms - Real.now(); };
      w.__requests = []; w.__writes = []; w.__confirm = true; w.__asked = [];
      w.confirm = q => { w.__asked.push(String(q)); return w.__confirm; };
      if (opts.store !== undefined) w.localStorage.setItem('nhl_v1', opts.store);
      if (opts.admin !== undefined) w.localStorage.setItem('nflhub_admin_v1', opts.admin);      // the NFL hub's sign-in on this origin (nhl v21)
      const set = w.Storage.prototype.setItem;
      w.Storage.prototype.setItem = function (k, v) { w.__writes.push(String(k)); return set.call(this, k, v); };
      const body = opts.keepDk ? opts.state || STATE : noDk(opts.state || STATE);
      /* every answer given in ESPN's place is noted too (__answers: the URL, the Refresh odds press it belongs to, when it was delivered on
         the page's clock, whether it was ok, its status and its body), so a section can work out by a rule of its own what a press was told
         of each game (pressS). A press is the scoreboard reads with a cache-buster made in one turn, and what is asked until the next */
      w.__answers = []; w.__press = 0; let turn = false;
      const note = (url, p) => { const rec = { url, press: w.__press, ok: false, status: 0, body: null, at: null }; w.__answers.push(rec);
        Promise.resolve(p).then(async res => { rec.at = w.Date.now(); rec.ok = !!(res && res.ok); rec.status = res ? (res.status || (res.ok ? 200 : 0)) : 0; try { rec.body = rec.ok ? await res.json() : null; } catch (e) { rec.body = null; } }, () => { rec.at = w.Date.now(); });
        return p; };
      w.fetch = async (url, init) => {
        w.__requests.push({ url: String(url), method: (init && init.method) || 'GET', cache: init && init.cache });
        if (String(url).startsWith('state.json')) return { ok: true, json: async () => JSON.parse(body) };
        if (PROPS_RX.test(String(url))) return note(String(url), opts.props ? opts.props(String(url)) : PROPS_404(String(url)));
        if (String(url).includes('espn.com')) {
          if (/scoreboard\?dates=\d{8}&limit=100&_=\d+$/.test(String(url)) && !turn) { turn = true; w.__press++; Promise.resolve().then(() => { turn = false; }); }
          return note(String(url), opts.espn ? opts.espn(String(url)) : { ok: true, json: async () => ({ events: [] }) });
        }
        const fk = opts.files && Object.keys(opts.files).find(k => String(url).startsWith(k));
        if (fk) { const v = opts.files[fk]; return typeof v === 'number' ? { ok: false, status: v } : { ok: true, json: async () => JSON.parse(JSON.stringify(v)) }; }
        return { ok: false, status: 404 };
      };
      w.addEventListener('error', e => errors.push(e.message));
    },
  });
  OPEN.add(dom.window);
  await wait(300);
  return dom.window;
}

/* ---------- the state against what it was built from ---------- */
function reality() {
  const games = S.games.filter(g => g.id !== 'fake');
  const toCome = games.filter(g => !startedAt(g, PUB) && !delayedAt(g, g.start, PUB));      // a delayed game's card is its frozen call
  const PL = S.players;
  /* the injury report */
  const inj = readJSON(path.join(DATA, 'injuries.json'));
  const rows = [];
  if (inj && inj.teams) for (const [club, list] of Object.entries(inj.teams)) for (const r of list || []) rows.push(Object.assign({ club }, r));
  chk(rows.every(r => r.id === null || r.id === undefined || /^\d+$/.test(String(r.id))), `the injury report's ids are ESPN ids or empty, never ${JSON.stringify((rows.find(r => r.id !== null && r.id !== undefined && !/^\d+$/.test(String(r.id))) || {}).id)}`);
  const withPm = toCome.filter(g => g.pm);
  if (PL && inj && withPm.length) {
    const bad = withPm.filter(g => g.pm.inj !== inj.pulled);
    chk(!bad.length, `every lineup still to play was built on the injury report of ${inj.pulled} (${bad.length} were not, e.g. ${bad[0] && bad[0].id}: ${bad[0] && bad[0].pm.inj})`);
  }
  const outRows = rows.filter(r => OUT.test(r.status || ''));
  /* out by id, or by club and name where the row's id is no other rated player's (an id ESPN gave wrong, which players.js
     resolves to nobody, is still caught) */
  const isOut = (club, p) => outRows.find(r => (hasId(r) && String(r.id) === String(p.id)) || (r.club === club && norm(r.name) === norm(p.name) && !(hasId(r) && PL && PL.players && PL.players[r.id])));
  const goalieOut = (p, club) => outRows.find(r => rowIs(r, Object.assign({ club }, p)));
  const listedElsewhere = (club, p, byName) => rows.find(r => r.club !== club && (hasId(r) ? String(r.id) === String(p.id) : byName && rowIs(r, p)));
  if (PL && PL.teams && inj) for (const [club, t] of Object.entries(PL.teams)) {
    for (const p of t.lineup || []) {
      const o = isOut(club, p); chk(!o, `${p.name} is ${o && o.status} on the injury report and still in ${club}'s lineup`);
      const e = listedElsewhere(club, p, false); chk(!e, `${p.name} is on ${e && e.club}'s injury report and still in ${club}'s lineup`);
    }
  }
  /* the goalies named on games still to come */
  const named = [];
  for (const g of withPm) for (const side of ['home', 'away']) { const t = g.pm[side]; if (t && t.goalie) named.push({ g, club: g[side], gl: t.goalie }); }
  if (inj) for (const { g, club, gl } of named) {
    if (gl.announced === 'Confirmed') continue;
    const o = goalieOut(gl, club); chk(!o, `${gl.name} is named in goal for ${club} on ${g.date} (${g.away}@${g.home}) but is ${o && o.status} on ${o && o.club}'s injury report`);
    /* a goalie DailyFaceoff names for a club is that club's by DailyFaceoff's word, as players.js takes him (only out stops it): a
       trade the report has not caught up with lists him under his old club, day to day, the day he is named for the new one */
    if (gl.announced) continue;
    const e = listedElsewhere(club, gl, true); chk(!e, `${gl.name} is named in goal for ${club} on ${g.date} but is on ${e && e.club}'s injury report`);
  }
  /* the box scores: who has played in goal for whom */
  const box = [];
  for (const f of fs.existsSync(DATA) ? fs.readdirSync(DATA).filter(f => /^box_\d+\.jsonl$/.test(f) && +f.slice(4, 8) >= S.season - 1) : []) for (const l of fs.readFileSync(path.join(DATA, f), 'utf8').split('\n')) if (l) box.push(JSON.parse(l));
  if (box.length) {
    const starterOf = (b, club) => { const gs = b.goalies.filter(x => x.team === club).sort((x, y) => y.toi - x.toi); return gs[0] ? gs[0].id : null; };
    const played = new Set(), startsNow = {}, gamesNow = {}, nameOf = {};
    for (const b of box) for (const club of [b.home, b.away]) {
      for (const x of b.goalies) { nameOf[x.id] = x.name; if (x.team === club && x.toi > 0) played.add(club + '|' + x.id); }
      if (b.season === S.season) { gamesNow[club] = (gamesNow[club] || 0) + 1; const s = starterOf(b, club); if (s) (startsNow[club] = startsNow[club] || new Set()).add(s); }
    }
    /* a starter is unavailable when the report has him out (by id, or by name under his club), lists him under another club, or
       his latest game was for another club (traded or claimed: players.js ranks only the club's own goalies) */
    const lastClub = {}, lastDate = {}; for (const b of box) for (const x of b.goalies) if (!lastDate[x.id] || lastDate[x.id] <= b.date) { lastDate[x.id] = b.date; lastClub[x.id] = x.team; }
    const gone = (club, id) => { const t = PL && PL.players && PL.players[id] ? PL.players[id].team : lastClub[id]; return !!t && t !== club; };
    const available = (club, id) => { const p = { id, name: nameOf[id] }; return !gone(club, id) && !isOut(club, p) && !outRows.find(r => hasId(r) && String(r.id) === String(id)) && !listedElsewhere(club, p, true); };
    const byStart = {}; for (const b of box) byStart[b.id] = b;
    const ownReport = (club, gl) => rows.some(r => r.club === club && ((r.id && String(r.id) === String(gl.id)) || norm(r.name) === norm(gl.name)));
    for (const { g, club, gl } of named) {
      if (gl.announced || gl.debut) continue;
      chk(played.has(club + '|' + gl.id) || ownReport(club, gl), `${gl.name} is named in goal for ${club} on ${g.date} without a game for ${club} this season or last`);
      const st = startsNow[club];
      if (!/back to back/.test(gl.how || '') && (gamesNow[club] || 0) >= 3 && st && [...st].some(id => available(club, id)))
        chk(st.has(gl.id), `${gl.name} is named in goal for ${club} on ${g.date} (${gl.how}) but has not started any of its ${gamesNow[club]} games this season`);
    }
    /* back to back: the club's game before is the day before, and the goalie is not that night's */
    const sched = {}; for (const g of games.slice().sort((a, b) => a.start < b.start ? -1 : 1)) for (const t of [g.home, g.away]) (sched[t] = sched[t] || []).push(g);
    for (const { g, club, gl } of named) {
      if (!/back to back/.test(gl.how || '')) continue;
      const list = sched[club]; const i = list.findIndex(x => x.id === g.id); const prev = i > 0 ? list[i - 1] : null;
      chk(prev && prev.date === dayBefore(g.date), `${club} on ${g.date}: "${gl.how}" but its game before is on ${prev ? prev.date : 'no date'}`);
      if (prev && prev.date === dayBefore(g.date)) {
        /* that night's goalie: the box score's starter once boxed; the one named on its card while it is
           still to come; a game under way or over with no box yet is not known here, and not compared
           (its card is the call frozen at puck drop, which may be an older run's goalie) */
        const side = prev.pm && prev.pm[prev.home === club ? 'home' : 'away'];
        const begun = startedAt(prev, PUB) || (!!prev.before && Date.parse(prev.before) <= PUB);       // a delayed game's call is frozen too
        const thatNight = byStart[prev.id] ? starterOf(byStart[prev.id], club) : !begun && side && side.goalie ? side.goalie.id : null;
        if (thatNight) chk(thatNight !== gl.id, `${club} on ${g.date}: "${gl.how}" names ${gl.name}, who is also the goalie of ${prev.date}`);
      }
    }
  }
  /* DailyFaceoff's names reach the games still to come */
  const st = readJSON(path.join(DATA, 'starters.json'));
  if (st && st.games && PL && PL.players) {
    const goalies = Object.entries(PL.players).filter(([, p]) => p.pos === 'G');
    for (const e of st.games) for (const side of ['home', 'away']) {
      const a = e[side + 'Goalie']; if (!a || !a.name) continue;
      const g = toCome.find(x => x.date === e.date && x[side] === e[side] && (!e.id || String(e.id) === String(x.id)));
      if (!g || !g.pm || !g.pm[side]) continue;
      const own = goalies.filter(([, p]) => p.team === e[side] && norm(p.name) === norm(a.name));
      if (own.length !== 1 || (goalieOut({ id: own[0][0], name: a.name }) && a.status !== 'Confirmed')) continue;
      chk(g.pm[side].goalie && g.pm[side].goalie.id === own[0][0] && !!g.pm[side].goalie.announced, `DailyFaceoff names ${a.name} (${a.status}) for ${e[side]} on ${e.date}, the card has ${g.pm[side].goalie && g.pm[side].goalie.name}`);
    }
  }
  /* the call: never made after puck drop, the player model's margin when it is the player model's call, and unchanged since puck drop */
  for (const g of games) {
    if (g.frozen) chk(Date.parse(g.frozen) < Date.parse(g.before || g.start), `the call on ${g.id} was made at ${g.frozen}, at or after its puck drop ${g.before || g.start}`);
    if (g.pm && g.pHome === g.pm.pHome && g.xt === g.pm.xt && g.frozen) chk(g.mu === g.pm.mu && g.by === 'players', `the call on ${g.id} (${g.away}@${g.home} ${g.date}, ${g.state}) is the player model's chance and total but carries margin ${g.mu} (the player model's is ${g.pm.mu}) and by=${g.by}`);
  }
  /* the published state is the second pass's, never the first's (which makes no call) */
  chk(S.pass === undefined, `the state is the job's second pass, not its first (pass ${S.pass})`);
  /* a line the page read itself (Refresh odds) is marked refreshed in its memory; the job never writes the mark */
  chk(!S.games.some(g => g.line && g.line.refreshed !== undefined), `no published line carries the page's own "refreshed" mark (${(S.games.find(g => g.line && g.line.refreshed !== undefined) || {}).id})`);
  if (PREV && PREV.season === S.season) {
    const prev = new Map(PREV.games.map(g => [g.id, g]));
    /* no started call is lost: every game the last published state had a call on that has started is
       still on the schedule, unless the feed called it off (or, never final, it has not been seen two
       days past its puck drop), which `removed` must say */
    const now = new Map(games.map(g => [g.id, g])), off = new Map((S.removed || []).map(r => [r.id, r]));
    for (const p of PREV.games) {
      if (!p.frozen || !startedAt(p, PUB) || now.has(p.id)) continue;
      const r = off.get(p.id);
      const ok = r && (/postponed|cancelled/.test(r.why) || (r.why === 'missing from the feed' && p.state !== 'final' && PUB - Date.parse(p.start) > 48 * 3600000));
      chk(ok, `${p.away}@${p.home} ${p.date} (${p.state}, call frozen ${p.frozen}) was in the last published state and is gone from this one${r ? ` (${r.why})` : ', with no reason given'}`);
    }
    let compared = 0;
    for (const g of games) {
      const p = prev.get(g.id); if (!p || !p.frozen) continue;
      /* started, or delayed: the puck drop the call was made before has passed and the start moved less than half a day */
      if (!startedAt(g, PUB) && !delayedAt(p, g.start, PUB)) continue;
      if (!(p.state === 'pre' || p.callV)) continue;                                // an older job's row after puck drop: put back once, not compared
      compared++;
      const moved = CALL.filter(k => JSON.stringify(g[k] ?? null) !== JSON.stringify(p[k] ?? null));
      chk(!moved.length, `the call on ${g.id} (${g.away}@${g.home} ${g.date}) moved after puck drop: ${moved.map(k => `${k} ${JSON.stringify(p[k])} -> ${JSON.stringify(g[k])}`).join('; ').slice(0, 300)}`);
    }
    if (compared) console.log(`${compared} started games' calls compared with the last published state`);
  }
  /* the playoffs */
  const PO = S.playoff;
  chk(!PO.phase || ['preseason', 'regular', 'postseason', 'over', 'offseason'].includes(PO.phase), `a known phase: ${PO.phase}`);
  for (const s of PO.series || []) if (s.winner) {
    const loser = s.winner === s.a ? s.b : s.a, final = s.conf === 'Final' || s.round === 4;     // the Final's loser did win its conference
    chk(PO.odds[loser].cup === 0 && (final || PO.odds[loser].conf === 0), `${loser}, knocked out by ${s.winner}, keeps a Cup chance ${PO.odds[loser].cup} or conference chance ${PO.odds[loser].conf}`);
  }
  if (PO.phase === 'postseason' || PO.phase === 'over') for (const [t, o] of Object.entries(PO.odds)) if (!o.playoff) chk(o.cup === 0, `${t} missed the playoffs but has a Cup chance`);
  /* a club ESPN has in a playoff series made the playoffs, whatever the table's tie-breakers said */
  for (const s of PO.series || []) for (const t of [s.a, s.b]) chk(PO.odds[t] && PO.odds[t].playoff === 1, `${t} plays ${t === s.a ? s.b : s.a} in a round-${s.round} series but has a playoff chance of ${PO.odds[t] && PO.odds[t].playoff}`);
  /* the field the standings mark is the bracket's first round */
  for (const conf of ['East', 'West']) {
    const f = PO.bracket && PO.bracket[conf]; if (!f) continue;
    const marked = [].concat(...Object.values(f.divs), f.wild).sort().join(','), drawn = [].concat(...f.series).sort().join(',');
    chk(marked === drawn, `${conf}: the division seeds and wild cards (${marked}) are the clubs of the first round drawn (${drawn})`);
  }
  if (PO.champion) chk(PO.odds[PO.champion].cup === 1, `the champion ${PO.champion} has the Cup`);
  dkReality();
  propsReality(toCome, isOut, listedElsewhere);
}

/* ================= THE PROPS MODEL =================
   The props model's projections in the state (props.js, on trial), held to the rules written here again: every
   distribution a whole one (parts of 10,000 summing to exactly 10,000) whose tail at one is the published dispersion's
   own, worked out here; every projected player in his club's lineup and not out, the goalie the game's own; only games
   still to come; and each the shadow ledger's open call, number for number. The ledger itself is held by props_check.js
   (the bar, nothing frozen moved, every grade from the record and the box score) against the last commit's
   (NHL_PREV_LEDGER, else git's HEAD:data/props_ledger.json); the record of closing props and the box files to their shape */
function propsReality(toCome, isOut, listedElsewhere) {
  const PR = S.props, PL = S.players;
  const ledgerF = path.join(DATA, 'props_ledger.json'), L = readJSON(ledgerF);
  /* the box files: shots, blocks, hits and power-play time kept, ESPN's shootout column never as shots */
  for (const f of fs.readdirSync(DATA).filter(f => /^box_\d{4}\.jsonl$/.test(f)).sort().slice(-1)) {
    const lines = fs.readFileSync(path.join(DATA, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const oldShape = lines.filter(b => !b.skaters.some(x => x.s !== undefined)), sog = lines.filter(b => b.skaters.some(x => x.sog !== undefined));
    chk(!oldShape.length, `${f}: every box line keeps its skaters' shots on goal (${oldShape.length} in the old shape, e.g. ${oldShape[0] && oldShape[0].id})`);
    chk(!sog.length, `${f}: no box line keeps ESPN's SOG column (shootout goals) as sog (${sog.length})`);
    /* ESPN's own columns disagree by a shot now and then (and an empty net adds one or two), so this holds the column, not each game:
       a parser reading another column (the shootout goals are nearly always 0) would be off on nearly every side */
    const off = lines.filter(b => [b.home, b.away].some(t => { const o = t === b.home ? b.away : b.home; const sh = b.skaters.filter(x => x.team === t).reduce((a, x) => a + (x.s || 0), 0), sa = b.goalies.filter(x => x.team === o).reduce((a, x) => a + x.sa, 0); return Math.abs(sh - sa) > 3; }));
    chk(off.length <= Math.max(2, lines.length * 0.05), `${f}: each side's skater shots are what the other side's goalies faced, within three (an empty net, ESPN's own slips), on all but ${off.length} of ${lines.length} games (e.g. ${off[0] && off[0].id})`);
  }
  /* the starting goalie (`st`, from ESPN's plays): at most one a side, on a goalie of that side who played, and marked on every side
     that used two goalies (the props model fits and grades the starter, pulled or not; without the mark it would take the goalie
     who played most, the reliever when a starter is pulled before half the game) */
  for (const f of fs.readdirSync(DATA).filter(f => /^box_\d{4}\.jsonl$/.test(f)).sort()) {
    const lines = fs.readFileSync(path.join(DATA, f), 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const badSt = lines.filter(b => b.goalies.some(x => x.st !== undefined && (x.st !== 1 || !(x.toi > 0) || ![b.home, b.away].includes(x.team))) || [b.home, b.away].some(t => b.goalies.filter(x => x.team === t && x.st).length > 1));
    const two = lines.filter(b => [b.home, b.away].some(t => b.goalies.filter(x => x.team === t && x.toi > 0).length > 1));
    const unmarked = two.filter(b => [b.home, b.away].some(t => { const gs = b.goalies.filter(x => x.team === t && x.toi > 0); return gs.length > 1 && !gs.some(x => x.st); }));
    chk(!badSt.length, `${f}: each side's starting goalie mark is one goalie of that side who played (${badSt.length} lines wrong, e.g. ${badSt[0] && badSt[0].id})`);
    /* a game whose plays named no save carries no mark (the reader falls back), so a few are allowed; a reader that marks none is not */
    chk(unmarked.length <= Math.max(3, two.length * 0.1), `${f}: the sides that used two goalies mark their starter, read from ESPN's plays (${unmarked.length} of ${two.length} games unmarked, e.g. ${unmarked[0] && unmarked[0].id}; node tools/fetch_box.js --starters)`);
  }
  /* the record of DraftKings' closing props: its shape, one line a final */
  const STAT = new Set(['pts', 'a', 's', 'bs', 'sv']), YSTAT = new Set(['g', 'pts', 'a', 's', 'bs', 'sv']);
  const am = x => Number.isInteger(x) && Math.abs(x) >= 100;
  const seen = new Set(); let recLines = 0, recBad = [];
  for (const f of fs.readdirSync(DATA).filter(f => /^props_\d{4}\.jsonl$/.test(f))) for (const l of fs.readFileSync(path.join(DATA, f), 'utf8').split('\n')) {
    if (!l) continue; recLines++;
    let r; try { r = JSON.parse(l); } catch (e) { recBad.push(`${f}: a line that is not JSON`); continue; }
    if (seen.has(String(r.id))) recBad.push(`${r.id} recorded twice`); seen.add(String(r.id));
    if (r.status === 404) continue;
    if (r.status !== 200 || !Array.isArray(r.main) || !Array.isArray(r.yes)) { recBad.push(`${r.id}: not a record line`); continue; }
    const m = r.main.find(x => !(Array.isArray(x) && /^\d+$/.test(x[0]) && STAT.has(x[1]) && typeof x[2] === 'number' && am(x[3]) && am(x[4])));
    const y = r.yes.find(x => !(Array.isArray(x) && /^\d+$/.test(x[0]) && YSTAT.has(x[1]) && Number.isInteger(x[2]) && x[2] >= 1 && am(x[3])));
    if (m || y) recBad.push(`${r.id}: ${JSON.stringify(m || y)}`);
    const dup = new Set(); for (const x of r.main) { const k = x[0] + '|' + x[1] + '|' + x[2]; if (dup.has(k)) recBad.push(`${r.id}: ${k} twice`); dup.add(k); }
  }
  chk(!recBad.length, `the record of closing props is in its shape, one line a final (${recLines} lines; ${recBad.slice(0, 3).join('; ')})`);
  /* the ledger, by props_check.js */
  if (L) {
    const PC = require('./props_check');
    const prevArg = process.env.NHL_PREV_LEDGER ? (process.env.NHL_PREV_LEDGER === 'none' ? null : readJSON(process.env.NHL_PREV_LEDGER)) : process.env.NHL_DATA ? null : undefined;
    const { bad, prev } = PC.run(DATA, process.env.NHL_STATE || path.join(ROOT, 'state.json'), S.published, prevArg);
    chk(!bad.length, `the props ledger holds (props_check.js${prev ? ', against the last commit\'s' : ', on its own'}): ${bad.slice(0, 4).join(' | ')}${bad.length > 4 ? ` ... ${bad.length} in all` : ''}`);
    chk(L.bar_registered && Object.values(L.calls).every(c => Date.parse(c.called_at) >= Date.parse(L.bar_registered)), 'the ledger\'s bar was written before its first call');
  }
  if (!PR) { chk(!fs.existsSync(path.join(DATA, 'props.json')) || !S.players, 'the state carries the props model when props.js has run'); return; }
  chk(PR.v === 1 && PR.label === 'on trial' && PR.games && typeof PR.games === 'object', 'the props model in the state is in its shape and labelled on trial');
  chk(PR.fair && PR.fair.main === 'over', 'DraftKings\' fair chance on a main line is all of the margin on the Over');
  /* each distribution, by this smoke's own sums: parts of 10,000, the tail at one the dispersion's own */
  const r = (PR.params && PR.params.r) || {};
  const tail1 = (k, mu) => r[k] === null || r[k] === undefined ? 1 - Math.exp(-mu) : 1 - Math.pow(r[k] / (r[k] + mu), r[k]);
  const atLeast = (D, k) => D.d.reduce((a, x, i) => a + ((D.lo || 0) + i >= k ? x : 0), 0) / 10000;
  const bad = [], badGame = [];
  const byId = new Map(S.games.map(g => [g.id, g]));
  for (const [gid, row] of Object.entries(PR.games)) {
    const g = byId.get(gid);
    if (!g || startedAt(g, PUB) || delayedAt(g, g.start, PUB) || row.home !== g.home || row.away !== g.away || row.start !== g.start) { badGame.push(gid); continue; }
    for (const side of ['home', 'away']) {
      const club = g[side], P = row[side + 'P'], lineup = new Set(((PL && PL.teams[club] && PL.teams[club].lineup) || []).map(p => p.id));
      if (!P || !Array.isArray(P.skaters)) { badGame.push(gid); continue; }
      for (const p of P.skaters) {
        if (!lineup.has(p.id)) bad.push(`${p.name} (${club}) projected but not in its lineup`);
        const o = isOut(club, p); if (o) bad.push(`${p.name} (${club}) projected but ${o.status}`);
        if (listedElsewhere(club, p, false)) bad.push(`${p.name} projected for ${club} but on another club's report`);
        if (!(p.toi > 0)) bad.push(`${p.name}: no expected minutes`);
        for (const k of ['g', 'a', 'pts', 's', 'bs']) {
          const D = p[k];
          if (!D || !(D.mu >= 0) || !Array.isArray(D.d) || D.d.length < 2 || D.d.some(x => !Number.isInteger(x) || x < 0) || D.d.reduce((a, x) => a + x, 0) !== 10000) { bad.push(`${p.name} ${k}: not a whole distribution`); continue; }
          if (Math.abs(atLeast(D, 1) - tail1(k, D.mu)) > 0.0003) bad.push(`${p.name} ${k}: P(1+) ${atLeast(D, 1)} where its mean ${D.mu} gives ${tail1(k, D.mu).toFixed(4)}`);
          const mean = D.d.reduce((a, x, i) => a + i * x, 0) / 10000;
          if (mean > D.mu + 0.002 || mean < D.mu - 0.02) bad.push(`${p.name} ${k}: the distribution's mean ${mean.toFixed(3)} is not its mean ${D.mu}`);
        }
      }
      if (P.goalie) {
        const D = P.goalie.sv;
        if (!D || !Array.isArray(D.d) || D.d.reduce((a, x) => a + x, 0) !== 10000 || D.d.some(x => !Number.isInteger(x) || x < 0) || !(D.lo >= 0) || D.sd !== PR.params.svSd) bad.push(`${P.goalie.name} saves: not a whole distribution`);
        else { const mean = D.d.reduce((a, x, i) => a + (D.lo + i) * x, 0) / 10000; if (Math.abs(mean - D.mu) > 0.05) bad.push(`${P.goalie.name} saves: mean ${mean.toFixed(2)} not ${D.mu}`); }
        const pm = g.pm && g.pm[side] && g.pm[side].goalie;
        if (pm && g.frozen && Date.parse(g.frozen) === PUB && pm.id !== P.goalie.id) bad.push(`${club} on ${gid}: the props model has ${P.goalie.name} in goal, the game's call ${pm.name}`);
        if (goalieOutAny(Object.assign({ club }, P.goalie)) && !(pm && pm.announced === 'Confirmed')) bad.push(`${P.goalie.name} projected in goal but out on the injury report`);
      }
    }
  }
  chk(!badGame.length, `the props model projects only games still to come, on the state's own clubs and puck drops (${badGame.length} not: ${badGame.slice(0, 3).join(', ')})`);
  chk(!bad.length, `every projection is a whole distribution on a player in his club's lineup and not out (${bad.length} not: ${bad.slice(0, 4).join('; ')})`);
  /* each game projected is the ledger's open call, number for number, while the ledger takes calls */
  if (L && PR.model && L.model && L.model.sha === PR.model.sha && !(L.decision && L.decision.verdict === 'FAIL')) {
    const off = [];
    for (const [gid, row] of Object.entries(PR.games)) {
      const c = L.calls[gid];
      if (!c || c.frozen) { off.push(`${gid}: no open call`); continue; }
      for (const side of ['homeP', 'awayP']) {
        for (const p of row[side].skaters) if (JSON.stringify(c.sk[p.id]) !== JSON.stringify(['g', 'a', 'pts', 's', 'bs'].map(k => p[k].mu))) off.push(`${gid} ${p.name}`);
        if (row[side].goalie && c.gk[row[side].goalie.id] !== row[side].goalie.sv.mu) off.push(`${gid} ${row[side].goalie.name}`);
      }
      if (Object.keys(c.sk).length !== row.homeP.skaters.length + row.awayP.skaters.length) off.push(`${gid}: the call projects other players`);
    }
    chk(!off.length, `every game the page shows projected is the ledger's open call, number for number (${off.length} not: ${off.slice(0, 3).join('; ')})`);
    const ls = PR.ledger || {};
    chk(ls.compared === L.summary.compared && ls.standing === L.summary.standing && ls.of === 12000 && (ls.decision || null) === (L.decision ? L.decision.verdict : null), `the state's ledger numbers are the ledger's (${ls.compared} / ${L.summary.compared}; "${ls.standing}")`);
    chk(!/pass/i.test(ls.standing || '') || !!L.decision, 'the ledger is never said to be passing before its bar is decided');
  }
}
const goalieOutAny = p => { const inj = readJSON(path.join(DATA, 'injuries.json')); if (!inj || !inj.teams) return false; return Object.entries(inj.teams).some(([club, l]) => (l || []).some(r => OUT.test(r.status || '') && rowIs(Object.assign({ club }, r), p))); };

/* ================= THE PARLAY BUILDER =================
   The panel, its three levels, the builder, the card and DraftKings' ids, each held to the state by rules
   written here again: nothing is shared with the page but the state. Every level is worked out by brute
   force (every parlay of its size, one leg a game) on the default slate and on Both days; the controls,
   the store, the card and the clock are held to their invariants on any day, a lean one and an empty one */
const PBS = (() => {
  const imp = am => am > 0 ? 100 / (am + 100) : -am / (-am + 100);
  const decOf = am => am > 0 ? 1 + am / 100 : 1 + 100 / -am;
  const toAm = d => d >= 2 ? '+' + Math.round((d - 1) * 100) : String(Math.round(-100 / (d - 1)));
  const odds = n => n > 0 ? '+' + n : String(n);
  const line = n => n === 0 ? 'PK' : (n > 0 ? '+' + n : String(n));
  /* a chance as a whole percentage, as the call is written (slCallS): to four places first, so a side at a half-point rounds up
     whichever side it is (1 - 0.455 is 0.54499999... in floating point: 55%, the call's own figure) */
  const pctW = p => Math.round(Math.round(p * 1e4) / 100) + '%';
  const pct1 = p => (p * 100).toFixed(1) + '%';
  const money = v => '$' + (+v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const short = v => '$' + (+v || 0).toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(+v) ? 0 : 2, maximumFractionDigits: 2 });
  const cents = x => Math.round(x * 100) / 100;
  const nextDay = d => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); };
  const day = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const etRead = iso => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  const KINDS = ['ml', 'pl', 'ou'], SIDES = { ml: ['home', 'away'], pl: ['home', 'away'], ou: ['over', 'under'] };
  const ok = v => v !== null && v !== undefined && isFinite(v) && v !== 0;
  return { imp, decOf, toAm, odds, line, pctW, pct1, money, short, cents, nextDay, day, etRead, KINDS, SIDES, ok };
})();
/* DraftKings' ids, by this smoke's own reading: each id's shape, and the number a puck line or total id names */
const DK_RX = { homeML: /^0ML\d+_1$/, awayML: /^0ML\d+_3$/, homePL: /^0HC\d+([NP])(\d+)_1$/, awayPL: /^0HC\d+([NP])(\d+)_3$/, over: /^0OU\d+O(\d+)_1$/, under: /^0OU\d+U(\d+)_3$/ };
function dkNamesLine(key, id, L) {
  const m = DK_RX[key] && DK_RX[key].exec(id); if (!m) return false;
  if (key === 'homePL') return L.homeLine !== null && L.homeLine !== undefined && (m[1] === 'N' ? -1 : 1) * +m[2] / 100 === L.homeLine;
  if (key === 'awayPL') return L.homeLine !== null && L.homeLine !== undefined && (m[1] === 'N' ? -1 : 1) * +m[2] / 100 === -L.homeLine;
  if (key === 'over' || key === 'under') return L.total !== null && L.total !== undefined && +m[1] / 100 === L.total;
  return true;
}
/* the ids an ESPN odds object carries, read here on its own: the gateway's preurl (or a plain DraftKings URL), the event and the outcome */
function dkFromAnswer(o, L) {
  const read = href => { try { if (typeof href !== 'string') return null; let u = new URL(href); const pre = u.searchParams.get('preurl'); if (pre) u = new URL(pre); if (!/(^|\.)draftkings\.com$/i.test(u.hostname)) return null; const e = /\/event\/(\d+)/.exec(u.pathname); return { event: e ? e[1] : null, id: u.searchParams.get('outcomes') }; } catch (e) { return null; } };
  const at = x => x && x.close && x.close.link && x.close.link.href;
  const src = { homeML: at(o.moneyline && o.moneyline.home), awayML: at(o.moneyline && o.moneyline.away), homePL: at(o.pointSpread && o.pointSpread.home), awayPL: at(o.pointSpread && o.pointSpread.away), over: at(o.total && o.total.over), under: at(o.total && o.total.under) };
  const out = {}; const e = read(o.link && o.link.href); if (e && e.event) out.event = e.event;
  for (const [k, h] of Object.entries(src)) { const x = read(h); if (!x) continue; if (!out.event && x.event) out.event = x.event; if (x.id && dkNamesLine(k, x.id, L)) out[k] = x.id; }
  const order = ['event', 'homeML', 'awayML', 'homePL', 'awayPL', 'over', 'under'], res = {};
  for (const k of order) if (out[k] !== undefined) res[k] = out[k];
  return res;
}
function dkReality() {
  const PUBMIN = Math.floor(PUB / 60000);
  const KEYS = ['event', 'homeML', 'awayML', 'homePL', 'awayPL', 'over', 'under', 'at'];
  for (const g of S.games) {
    const L = g.line, dk = L && L.dk; if (!dk) continue;
    chk(typeof dk === 'object' && Object.keys(dk).every(k => KEYS.includes(k)), `${g.id}: line.dk holds only DraftKings' keys (${Object.keys(dk).join(',')})`);
    if (dk.event !== undefined) chk(/^\d+$/.test(String(dk.event)), `${g.id}: the DraftKings event is all digits (${dk.event})`);
    for (const k of Object.keys(DK_RX)) if (dk[k] !== undefined) chk(typeof dk[k] === 'string' && dkNamesLine(k, dk[k], L), `${g.id}: line.dk.${k} ${dk[k]} is in its shape and names this line's number (puck line ${L.homeLine}, total ${L.total})`);
    if (dk.at !== undefined) chk(Date.parse(dk.at) < Date.parse(L.at), `${g.id}: carried ids are older than the line (${dk.at} vs ${L.at})`);
  }
  /* against the answers this run saved: the ids are the answer's own; an answer with none keeps the last state's under the carry rule, dated */
  const OUTDIR = process.env.NHL_OUT || (process.env.NHL_STATE ? null : path.join(__dirname, 'out'));
  if (!OUTDIR) return;
  const prev = PREV ? new Map(PREV.games.map(g => [g.id, g])) : new Map();
  let compared = 0; const answers = {};
  for (const g of S.games) {
    if (startedAt(g, PUB) || !g.line || Math.floor(Date.parse(g.line.at) / 60000) !== PUBMIN) continue;
    const f = path.join(OUTDIR, `sb_${g.date}.json`); if (!(f in answers)) answers[f] = readJSON(f); const j = answers[f]; if (!j) continue;
    const ev = (j.events || []).find(e => String(e.id) === g.id), o = ev && ev.competitions && ev.competitions[0] && (ev.competitions[0].odds || [])[0];
    if (!o) continue;
    const L = g.line, num = v => v === undefined || v === null || v === '' ? null : +String(v).replace('+', '');
    if (num(o.overUnder) !== L.total || (o.moneyline && num(o.moneyline.home && o.moneyline.home.close && o.moneyline.home.close.odds) !== L.homeML)) continue;
    compared++;
    const want = dkFromAnswer(o, L), have = Object.assign({}, L.dk || {}); delete have.at;
    const OUTC = ['homeML', 'awayML', 'homePL', 'awayPL', 'over', 'under'], ids = x => OUTC.some(k => x && typeof x[k] === 'string');
    /* an answer with an outcome id: exactly its ids, never carried; with none (no link, or links naming the event alone): its event at
       most, or the last state's outcome ids for the same numbers beside it, dated by their read and never moved onto another event */
    if (ids(want)) chk(JSON.stringify(have) === JSON.stringify(want) && !(L.dk && L.dk.at), `${g.id}: line.dk is this answer's own ids (${JSON.stringify(L.dk)} vs ${JSON.stringify(want)})`);
    else if (L.dk && !L.dk.at) chk(JSON.stringify(have) === JSON.stringify(want), `${g.id}: an answer with no outcome id gives its event alone, undated (${JSON.stringify(L.dk)} vs ${JSON.stringify(want)})`);
    else if (L.dk) {
      const p = prev.get(g.id), q = p && p.line && p.line.dk;
      const okCarry = !!q && ids(have) && L.dk.at === (q.at || p.line.at) && (!want.event || !q.event || want.event === q.event)
        && Object.entries(have).every(([k, v]) => k === 'event' ? v === (want.event || q.event) : q[k] === v && (!/PL$/.test(k) || p.line.homeLine === L.homeLine) && (!/^(over|under)$/.test(k) || p.line.total === L.total));
      chk(okCarry, `${g.id}: an answer with no DraftKings outcome id keeps only the last state's ids for the same numbers, dated (${JSON.stringify(L.dk)})`);
    }
  }
  if (OUTDIR) console.log(`DraftKings ids compared with the saved answers on ${compared} games to come`);
}

/* the smoke's own leg: one side of one market, the state's numbers */
function sLeg(g, side, kind) {
  const L = g.line; if (!L) return null;
  let price, other, num = null, p, edge, push = 0, pick;
  if (kind === 'ml') { price = side === 'home' ? L.homeML : L.awayML; other = side === 'home' ? L.awayML : L.homeML; p = side === 'home' ? g.pHome : 1 - g.pHome; edge = g.mlEdge && g.mlEdge[side]; pick = g.mlPick; }
  else if (kind === 'pl') { if (!g.cover || L.homeLine === null || L.homeLine === undefined) return null; price = side === 'home' ? L.homeSpreadOdds : L.awaySpreadOdds; other = side === 'home' ? L.awaySpreadOdds : L.homeSpreadOdds; num = side === 'home' ? L.homeLine : -L.homeLine; p = g.cover[side]; push = g.cover.push; edge = g.plEdge && g.plEdge[side]; pick = g.plPick; }
  else { if (!g.ou || L.total === null || L.total === undefined) return null; price = side === 'over' ? L.overOdds : L.underOdds; other = side === 'over' ? L.underOdds : L.overOdds; num = L.total; p = g.ou[side]; push = g.ou.push; edge = g.ouEdge && g.ouEdge[side]; pick = g.ouPick; }
  if (!PBS.ok(price)) return null;
  const fair = PBS.ok(other) ? PBS.imp(price) / (PBS.imp(price) + PBS.imp(other)) : null;
  const T = id => S.teams[id];
  return { id: `${g.id}|${side}|${kind}`, game: g.id, g, side, kind, price, other: PBS.ok(other) ? other : null, num, p, edge: typeof edge === 'number' ? edge : null, push: push || 0, pick, fair, dec: PBS.decOf(price),
    start: g.start, mu: `${T(g.away).abbr} @ ${T(g.home).abbr}`, who: kind === 'ou' ? `${T(g.away).short} @ ${T(g.home).short}` : T(g[side]).short,
    bet: kind === 'ml' ? 'To win' : kind === 'pl' ? `Puck line ${PBS.line(num)}` : `${side === 'over' ? 'Over' : 'Under'} ${num} goals` };
}
const S_KIND_RANK = { ml: 0, pl: 1, ou: 2, prop: 3 }, S_PROP_STATS = ['pts', 'g', 'a', 's', 'bs', 'sv'];
const sStr = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sOrder = (a, b) => (Date.parse(a.start) - Date.parse(b.start)) || sStr(a.mu, b.mu) || ((S_KIND_RANK[a.kind] ?? 9) - (S_KIND_RANK[b.kind] ?? 9))
  || (a.kind === 'prop' && b.kind === 'prop' ? sStr(String(a.who), String(b.who)) || sStr(String(a.pid), String(b.pid)) || (S_PROP_STATS.indexOf(a.stat) - S_PROP_STATS.indexOf(b.stat)) || sStr(a.id, b.id) : 0);
/* the Top 30's and the levels' bet types: the team markets and (nhl v18) the player lines, Overs (the anytime goal among them) and Unders */
const S_KINDS = ['ml', 'pl', 'ou', 'po', 'pu'];
/* a game's player lines as legs by this smoke's own sums (nhl v18): on the read the page holds for the game (`reads`, its PROPS.games:
   the job's, fresh within 15 minutes of the publish, or a press's), DraftKings' main lines Over and Under and the anytime goal (not where
   it is the goals line's Over), each on a player the props model projects for one of the game's clubs, in a stat of his group; the
   model's chance from the published distribution, DraftKings' fair chance, the edge the chance less the price's */
const sGrp = pos => pos === 'G' ? 'G' : pos === 'D' ? 'D' : /^(C|LW|RW|F|W|L|R)$/.test(String(pos || '')) ? 'F' : null;
const S_STAT_NAME = { pts: 'points', g: 'goals', s: 'shots on goal', a: 'assists', bs: 'blocked shots', sv: 'saves' };
function sPropLegs(g, reads, over, under) {
  const rd = reads && reads[g.id]; if (!rd || rd.status !== 200) return [];
  if (rd.src === 'job' && !(Date.parse(rd.at) >= PUB - 15 * 60000)) return [];
  const pr = S.props && S.props.games && S.props.games[g.id]; if (!pr) return [];
  const who = new Map();
  for (const side of ['away', 'home']) { const Q = pr[side + 'P']; if (!Q) continue; for (const p of Q.skaters || []) who.set(String(p.id), { name: p.name, pos: p.pos, team: g[side], D: p }); if (Q.goalie) who.set(String(Q.goalie.id), { name: Q.goalie.name, pos: 'G', team: g[side], D: { sv: Q.goalie.sv } }); }
  const main = new Map(), yes = new Map();
  for (const [a, st, L, po, pu] of rd.main || []) main.set(a + '|' + st, { L, po, pu });
  for (const [a, st, k, price] of rd.yes || []) if (st === 'g' && k === 1 && !yes.has(a)) yes.set(a, price);
  const T = id => S.teams[id], mu = `${T(g.away).abbr} @ ${T(g.home).abbr}`, out = [];
  const leg = (x, pid, st, mk, side, line, k, price, other) => {
    const D = x.D[st]; if (!D || !Array.isArray(D.d)) return;
    const p = mk === 'yes' ? atLeastS(D, 1) : side === 'over' ? atLeastS(D, Math.floor(line) + 1) : 1 - atLeastS(D, Math.floor(Math.ceil(line) - 0.5) + 1);
    const fair = mk === 'yes' ? fairYesS('g', 1, price) : side === 'over' ? (PBS.ok(other) ? 1 - PBS.imp(other) : null) : PBS.imp(price);
    const bet = mk === 'yes' ? 'Anytime goal' : `${side === 'over' ? 'Over' : 'Under'} ${line} ${S_STAT_NAME[st]}`;
    out.push({ id: `${g.id}|p|${pid}|${st}|${mk === 'yes' ? 'k1' : side + line}`, game: g.id, g, kind: 'prop', prop: true, pid, name: x.name, team: x.team, grp: sGrp(x.pos), stat: st, mk, side, line, num: line, k,
      price, other: PBS.ok(other) ? other : null, p, fair, fairEst: mk === 'yes', edge: p - PBS.imp(price), dec: PBS.decOf(price), start: g.start, mu, who: x.name, bet });
  };
  for (const [pid, x] of who) {
    const grp = sGrp(x.pos); if (!grp || !x.name) continue;
    for (const st of S_PROP_STATS) {
      if ((grp === 'G') !== (st === 'sv')) continue;
      const M = main.get(pid + '|' + st);
      if (M) for (const side of ['over', 'under']) if (side === 'over' ? over : under) leg(x, pid, st, 'main', side, M.L, null, side === 'over' ? M.po : M.pu, side === 'over' ? M.pu : M.po);
      if (st === 'g' && over && yes.has(pid) && !(M && Math.floor(M.L) + 1 === 1)) leg(x, pid, st, 'yes', 'over', 0.5, 1, yes.get(pid), null);
    }
  }
  return out.sort(sOrder);
}
/* a player leg qualifies as a team leg does: a chance and a fair chance, both prices on a main line, 45% to 97%, at or above the price,
   no push, under 15 points over the fair chance */
function sPropQual(L) {
  if (L.p === null || L.fair === null || (L.mk === 'main' && L.other === null)) return null;
  if (!(L.p >= 0.45 && L.p < 0.97) || !(L.edge >= 0) || (L.mk === 'main' && Number.isInteger(+L.line))) return null;
  return L.p - L.fair < 0.15 ? 'ok' : 'far';
}
/* the reads the page holds now (its PROPS.games), which the smoke's own player legs stand on */
const sReads = w => JSON.parse(w.eval('JSON.stringify(PROPS.games)'));
/* fresh: read at the job's last run; or, on the copy REFRESH ODDS below makes of what a press should leave, read by the press */
const sFresh = g => !!g.line && (g.line.refreshed === true || Math.floor(Date.parse(g.line.at) / 60000) === Math.floor(PUB / 60000));
const sStarted = (g, ms) => startedAt(g, ms) || delayedAt(g, g.start, ms);
/* a leg for a level: both prices, 45% to 97%, at or above the price, no push, under 15 points over the fair chance */
function sQual(L) {
  if (!L || L.other === null || L.edge === null) return null;
  if (!(L.p >= 0.45 && L.p < 0.97) || !(L.edge >= 0) || L.push !== 0) return null;
  return L.p - L.fair < 0.15 ? 'ok' : 'far';
}
function sSlate(ms, uiDay) {
  const today = etDate(ms), tom = PBS.nextDay(today);
  const come = S.games.filter(g => !sStarted(g, ms));
  const on = d => come.filter(g => g.date === d);
  let days = [today, tom].filter(d => on(d).length);
  if (!days.length) { const nx = come.map(g => g.date).filter(d => d >= today).sort()[0]; if (nx) days = [nx]; }
  const lined = d => on(d).some(sFresh);
  const both = days.length === 2 && lined(days[0]) && lined(days[1]);
  let pick = uiDay === 'both' && both ? 'both' : days.includes(uiDay) ? uiDay : null;
  if (!pick) pick = days.find(lined) || days[0] || null;
  const dates = pick === 'both' ? days : pick ? [pick] : [];
  const games = come.filter(g => dates.includes(g.date));
  return { today, tom, days, both, pick, dates, on, come, games, text: dates.length > 1 ? `${PBS.day(dates[0])} – ${PBS.day(dates[dates.length - 1])}` : dates.length ? PBS.day(dates[0]) : '' };
}
function sPool(sl, kinds, off, reads) {
  const scan = (gs, ks) => {
    const out = [], far = [], put = (L, q) => { if (q === 'ok') out.push(L); else if (q === 'far') far.push(L); };
    for (const g of gs) {
      for (const k of PBS.KINDS) if (ks.includes(k)) for (const s of PBS.SIDES[k]) { const L = sLeg(g, s, k); put(L, sQual(L)); }
      if (ks.includes('po') || ks.includes('pu')) for (const L of sPropLegs(g, reads, ks.includes('po'), ks.includes('pu'))) put(L, sPropQual(L));
    }
    return { out, far };
  };
  const tickable = sl.games.filter(sFresh), ticked = tickable.filter(g => !off.includes(g.id));
  const { out, far } = scan(ticked, kinds);
  for (const L of out) L.thin = !(L.edge >= S.edge);
  out.sort(sOrder);
  return { kinds, tickable, ticked, legs: out, far, scan, m: new Set(out.map(L => L.game)).size };
}
/* a level by this smoke's own search (nhl v31): the likeliest parlay by the chance given (the site's model, S_CHANCE) of 2 to 12 legs,
   one leg a game, whose legs' decimals multiplied reach minDec, paying where dec >= minDec * (1 - 1e-9). A depth-first search over
   every parlay one leg a game, pruned only by the best found and the price still to reach (a leg another of its game beats strictly on
   the chance at no lower price first left out: it is in no best parlay); none of the page's frontier. Ties: the chance within a relative
   1e-9, fewer legs, the larger product of the other chance, the lower of the sorted leg ids joined by commas. Its chance, fair chance and
   price worked in leg order, as the page and the record work them. Memoised on the pool (its legs' ids and numbers) and the price, since
   holdSuggest runs at many clocks and after every read */
const S_CAP = 12, S_TIE = 1e-9, S_PICK = 'likeliest-any', S_CHANCE = 'model';      // the owner's 11 November 2026 call: ranked by the model
const S_LV_MEMO = new Map();
function sLevel(legs, minDec, chance) {
  chance = chance || S_CHANCE;
  const memo = `${chance}|${minDec}|` + legs.map(L => `${L.id}:${L.p}:${L.fair}:${L.dec}`).join(';');
  if (S_LV_MEMO.has(memo)) return S_LV_MEMO.get(memo);
  const ch = chance === 'fair' ? (L => L.fair) : (L => L.p), oth = chance === 'fair' ? (L => L.p) : (L => L.fair), need = minDec * (1 - S_TIE);
  const near = (a, b) => Math.abs(a - b) <= S_TIE * Math.max(a, b);
  const better = (a, b) => !b || (!near(a.p, b.p) ? a.p > b.p : a.n !== b.n ? a.n < b.n : !near(a.o, b.o) ? a.o > b.o : a.key < b.key);
  const by = new Map(); for (const L of legs) { if (!(ch(L) > 0)) continue; if (!by.has(L.game)) by.set(L.game, []); by.get(L.game).push(L); }
  const games = [...by.values()].map(gl => gl.filter(B => !gl.some(A => A !== B && ch(A) > ch(B) * (1 + S_TIE) && A.dec >= B.dec)).sort((a, b) => ch(b) - ch(a)));
  const m = games.length, top = games.map(gl => Math.max(...gl.map(L => L.dec)));
  /* reach[i][r]: the most r more legs of games i on can add to the price */
  const reach = []; reach[m] = [1].concat(new Array(S_CAP).fill(1));
  for (let i = m - 1; i >= 0; i--) { reach[i] = [1]; for (let r = 1; r <= S_CAP; r++) reach[i][r] = Math.max(reach[i + 1][r], top[i] * reach[i + 1][r - 1]); }
  let best = null; const chosen = [];
  const go = (i, p, d, o) => {
    if (chosen.length >= 2 && d >= need) { const q = { p, d, n: chosen.length, o, key: chosen.map(x => x.id).sort().join(','), legs: chosen.slice() }; if (better(q, best)) best = q; return; }
    if (i >= m || chosen.length >= S_CAP || d * reach[i][S_CAP - chosen.length] < need) return;
    for (const L of games[i]) { const np = p * ch(L); if (best && np < best.p * (1 - S_TIE)) continue; chosen.push(L); go(i + 1, np, d * L.dec, o * (oth(L) || 0)); chosen.pop(); }
    go(i + 1, p, d, o);
  };
  go(0, 1, 1, 1);
  let res = null;
  if (best) {
    const out = best.legs.slice().sort(sOrder); let p = 1, d = 1, f = 1;
    for (const L of out) { p *= L.p; d *= L.dec; f = f === null || L.fair === null ? null : f * L.fair; }
    res = { legs: out, p, fair: f, d, n: out.length, key: best.key };
  }
  if (S_LV_MEMO.size > 400) S_LV_MEMO.clear();
  S_LV_MEMO.set(memo, res);
  return res;
}
/* the Top 30 lines by this smoke's own sums (nhl v17): the value picks (5 points or more above the price, the calls) then the other
   lines, each part by the expected return on $1 (the model's chance times the decimal, less the stake), ties to the lower leg id, 30 in all */
const sEv = L => L.p * L.dec - 1;
function sTop(pool) {
  const cmp = (a, b) => (sEv(b) - sEv(a)) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const value = pool.legs.filter(L => !L.thin).sort(cmp).slice(0, 30), other = pool.legs.filter(L => L.thin).sort(cmp).slice(0, 30 - value.length);
  return { value, other, n: pool.legs.length };
}
/* why the list is empty, by this smoke's own wording */
function sWhy(sl, pool, off) {
  if (!pool.kinds.length) return 'No bet types ticked: tick at least one above.';
  if (!pool.ticked.length) return 'No games ticked: tick at least one above.';
  const moreGames = pool.scan(pool.tickable.filter(g => off.includes(g.id)), pool.kinds).out.length > 0;
  const moreTypes = pool.scan(pool.ticked, S_KINDS).out.length > 0;
  const bothHint = sl.both && sl.pick !== 'both';
  const fixes = moreGames && moreTypes ? 'tick more games or bet types' : moreGames ? 'tick more games' : moreTypes ? 'tick more bet types' : '';
  const help = fixes && bothHint ? fixes + ' or choose Both days above' : fixes || (bothHint ? 'choose Both days above' : '');
  const head = "No line on your picks qualifies (the model rates none at or above DraftKings' price, at 45% to 97% and not far off the market)";
  if (help) return `${head}: ${help}.`;
  const last = sl.dates[sl.dates.length - 1], nx = last && PBS.nextDay(last);
  const note = sl.pick !== 'both' && nx && sl.on(nx).length && !sl.on(nx).some(sFresh) ? ` ${PBS.day(nx)}'s lines come about a day ahead.` : '';
  return `${head}.${note}`;
}
function sWide(sl, pool) {
  const over = 'No games to build from: the season is over.';
  if (!S.games.length || !sl.come.length) return over;
  if (!pool.tickable.length) {
    const other = sl.days.find(d => !sl.dates.includes(d) && sl.on(d).some(sFresh));
    const otherNote = other ? ` ${PBS.day(other)} is in the Day choice above.` : '';
    const opener = S.games[0].date;
    if (opener > sl.today && sl.dates.every(d => d <= opener)) return `The season opens ${PBS.day(opener)}.`;
    if (S.phase === 'offseason' || S.phase === 'over') return over;
    return `No DraftKings lines yet for ${sl.text}.${otherNote}`;
  }
  return '';
}
/* the levels (nhl v31): [id, label, the least legs, no floor, the least decimal]; the rule before, whose locked days keep their words */
const TIERS = [['safe', 'Safe', 2, 0, 2.1], ['med', 'Medium', 2, 0, 4], ['aggr', 'Aggressive', 2, 0, 8]];        // Extreme went in nhl v14
const TIERS_V30 = [['safe', 'Safe', 2, 0], ['med', 'Medium', 3, 0.25], ['aggr', 'Aggressive', 4, 0.12]];
const sClock = ms => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const sDayClock = ms => new Date(ms).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const sStakeOf = store => { const v = +store.stake; return isFinite(v) && v > 0 ? Math.round(Math.min(100000, Math.max(1, v)) * 100) / 100 : 20; };
/* the builder's legs as the page draws them: the ids of the stored team legs still drawn (the page's own list, read once) */
const sDrawn = w => new Set(JSON.parse(w.eval('JSON.stringify(builderLegs(false).map(L => L.id))')));
/* the Top 30 panel in a window against this smoke's own working: the slate, the Day control, the games fold, the notes, the list row by
   row (its order, its two parts, every number) or the line that says why there is none */
function holdPanel(w, ms, tag) {
  const d = w.document, store = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}'), ui = (store.ui && store.ui.pb) || {};
  const k = ui.k || {}, kinds = S_KINDS.filter(x => k[x] !== false), off = Array.isArray(ui.off) ? ui.off.map(String) : [];
  const sl = sSlate(ms, ui.day), pool = sPool(sl, kinds, off, sReads(w)), stake = sStakeOf(store);
  chk(txt(d.getElementById('pbSlate')) === (sl.text || 'no games'), `${tag}: the slate pill names ${sl.text} (${txt(d.getElementById('pbSlate'))})`);
  chk(d.getElementById('pbDayRow').hidden === (sl.days.length < 2), `${tag}: the Day control is shown exactly when two days are offered (${sl.days.join(', ')})`);
  if (sl.days.length > 1) {
    const on = d.querySelector('#pbDay button.on');
    chk(on && on.dataset.day === sl.pick, `${tag}: the Day control has ${sl.pick} chosen (${on && on.dataset.day})`);
    chk(!!d.querySelector('#pbDay button[data-day="both"]') === sl.both, `${tag}: Both days is offered exactly when both days have a fresh line`);
  }
  /* the games fold: every game of the slate still to come, tickable only on a fresh line */
  const tiles = [...d.querySelectorAll('#pbGrid input[data-g]')].map(x => x.dataset.g).sort(), want = pool.tickable.map(g => g.id).sort();
  chk(JSON.stringify(tiles) === JSON.stringify(want), `${tag}: the Games fold ticks exactly the slate's games with a fresh line (${tiles.length} vs ${want.length})`);
  chk(d.querySelectorAll('#pbGrid .pb-g').length === sl.games.length, `${tag}: a tile for every game on the slate still to come (${d.querySelectorAll('#pbGrid .pb-g').length} vs ${sl.games.length})`);
  const sum = txt(d.getElementById('pbGsum')), nt = pool.ticked.length;
  chk(sum === (nt === pool.tickable.length ? `All ${nt}` : `${nt} of ${pool.tickable.length}`), `${tag}: the Games summary counts the tickable games (${sum})`);
  /* the far-off note */
  const notes = txt(d.getElementById('pbNotes'));
  const farRe = /(\d+) lines? far off the market left out\./, farPRe = /(\d+) player lines? far off the market left out\./;
  const farT = pool.far.filter(L => !L.prop).length, farP = pool.far.length - farT;
  chk(farT ? (farRe.exec(notes) || [])[1] === String(farT) : !farRe.test(notes), `${tag}: the far-off note counts ${farT} team lines (${(farRe.exec(notes) || [])[1] || 'none said'})`);
  chk(farP ? (farPRe.exec(notes) || [])[1] === String(farP) : !farPRe.test(notes), `${tag}: and apart ${farP} player lines (${(farPRe.exec(notes) || [])[1] || 'none said'})`);
  const wide = sWide(sl, pool), wEl = d.getElementById('pbWide'), nEl = d.getElementById('pbNone'), rows = [...d.querySelectorAll('#pbBody .t30-r')];
  if (wide) { chk(wEl && txt(wEl) === wide && !rows.length, `${tag}: the panel says "${wide}" (${wEl ? txt(wEl) : rows.length + ' lines drawn'})`); return { sl, pool, top: null, stake, kinds, off }; }
  if (!pool.legs.length) { const why = sWhy(sl, pool, off); chk(nEl && txt(nEl) === why && !rows.length, `${tag}: no line qualifies, and the panel says "${why}" (${nEl ? txt(nEl) : rows.length + ' lines drawn'})`); return { sl, pool, top: { value: [], other: [], n: 0 }, stake, kinds, off }; }
  const top = sTop(pool), all = top.value.concat(top.other), both = sl.dates.length > 1, inB = sDrawn(w), bad = [];
  chk(canon(rows.map(r => r.dataset.id)) === canon(all.map(L => L.id)), `${tag}: the Top 30 is every qualifying line on the picks, value picks first, each part by the expected return on $1, cut at 30, by this smoke's own ranking (${rows.length} drawn, ${all.length} worked out of ${pool.legs.length}; first ${all.slice(0, 3).map(L => L.id).join(', ')} vs ${rows.slice(0, 3).map(r => r.dataset.id).join(', ')})`);
  const vRows = [...d.querySelectorAll('#pbBody .t30-v .t30-r')].map(r => r.dataset.id), oRows = [...d.querySelectorAll('#pbBody .t30-o .t30-r')].map(r => r.dataset.id);
  chk(canon(vRows) === canon(top.value.map(L => L.id)) && canon(oRows) === canon(top.other.map(L => L.id)), `${tag}: Value picks hold the calls and Other lines the rest (${vRows.length} and ${oRows.length})`);
  const heads = [...d.querySelectorAll('#pbBody .t30-h')].map(h => [h.closest('.t30-part').classList.contains('t30-v') ? 'v' : 'o', txt(h.querySelector('.n'))]);
  chk(canon(heads) === canon([].concat(top.value.length ? [['v', String(top.value.length)]] : [], top.other.length ? [['o', String(top.other.length)]] : [])), `${tag}: each part's heading counts its lines (${JSON.stringify(heads)})`);
  chk(!!d.querySelector('#pbBody .t30-nov') === !top.value.length, `${tag}: "No line on your picks is a value pick" exactly when there is none`);
  const more = top.n - all.length, mEl = d.querySelector('#pbBody .t30-more');
  chk(more > 0 ? !!mEl && txt(mEl) === `${more} more line${more > 1 ? 's qualify' : ' qualifies'} beyond the top 30.` : !mEl, `${tag}: the lines beyond the top 30 are counted (${more}; ${mEl ? txt(mEl) : 'none said'})`);
  all.forEach((L, i) => {
    const r = rows[i]; if (!r || r.dataset.id !== L.id) return;
    const ev = sEv(L), nums = `${L.prop ? 'props model' : 'model'} ${PBS.pctW(L.p)} · fair ${PBS.pctW(L.fair)}${L.fairEst ? ' est.' : ''} · $1 wins ${PBS.money(L.dec - 1)} · expected ${ev < 0 ? '−' : '+'}${PBS.money(Math.abs(ev))}`;
    const when = `${L.mu} · ${both ? sDayClock(Date.parse(L.start)) : sClock(Date.parse(L.start))}`;
    const b = r.querySelector('button.t30-add'), on = inB.has(L.id);
    const bet = L.prop ? `${L.name} ${L.bet}` : L.kind === 'ml' ? 'to win' : L.kind === 'pl' ? PBS.line(L.num) : `${L.side === 'over' ? 'Over' : 'Under'} ${L.num}`;
    const pills = [...r.querySelectorAll('.t30-1 .ttag')].map(x => x.dataset.c || txt(x)), wantPills = L.prop ? [S.teams[L.team].abbr] : L.kind === 'ou' ? [S.teams[L.g.away].abbr, S.teams[L.g.home].abbr] : [S.teams[L.g[L.side]].abbr];
    const why = [txt(r.querySelector('.t30-rk')) !== String(i + 1) && 'rank', txt(r.querySelector('.t30-p')) !== PBS.odds(L.price) && 'price', txt(r.querySelector('.t30-n')) !== nums && `numbers "${txt(r.querySelector('.t30-n'))}" not "${nums}"`,
      txt(r.querySelector('.t30-2 .m')) !== when && `game "${txt(r.querySelector('.t30-2 .m'))}" not "${when}"`, txt(r.querySelector('.t30-1 .pb-who b')) !== bet && 'bet', !!r.querySelector('.pb-valmark') === L.thin && 'Value tag',
      canon(pills.map(x => x.replace(/[^A-Z]/g, ''))) !== canon(wantPills) && `pills ${pills.join(',')}`,
      (!b || b.dataset.leg !== L.id || b.getAttribute('aria-pressed') !== String(on) || txt(b) !== (on ? 'Added' : 'Add')) && 'Add button'].filter(Boolean);
    if (why.length) bad.push(`${L.id}: ${why.join(', ')}`);
  });
  chk(!bad.length, `${tag}: every line's row is its rank, the bet, Value where it is a call, DraftKings' price, the game and its puck drop, the model's and the fair chance, what $1 wins and its expected return, and Add (Added in the parlay) (${all.length} rows; ${bad.length} wrong: ${bad.slice(0, 3).join(' | ')})`);
  return { sl, pool, top, stake, kinds, off };
}
/* the Suggested Parlays tab's days and their sets by this smoke's own working: today and tomorrow (the visitor's, Eastern) with a game,
   else the next day with a game to come; a day open while none of its games has started, its levels by brute force on every game of the
   day and every bet type; a locked day the record's set from the state, read only, each leg graded */
function sSpDays(ms) {
  const today = etDate(ms), tom = PBS.nextDay(today), has = dd => S.games.some(g => g.date === dd);
  const days = [today, tom].filter(has);
  if (days.length) return days;
  const nx = S.games.filter(g => !sStarted(g, ms)).map(g => g.date).filter(dd => dd >= today).sort()[0];
  return nx ? [nx] : [];
}
const sDayLock = dd => Math.min(...S.games.filter(g => g.date === dd).map(g => Math.min(Date.parse(g.start), g.frozen && g.before ? Date.parse(g.before) : Infinity)));
/* a day locks at its first puck drop, or at the record's lock where the state carries the record's set for it (a day the record has locked
   stays locked though its first game is postponed since) */
const sSet = dd => S.suggest && S.suggest.sets && S.suggest.sets[dd] || null;
const sLockAt = dd => { const e = sSet(dd); return Math.min(sDayLock(dd), e ? Date.parse(e.lock) : Infinity); };
const sDayOpen = (dd, ms) => S.games.some(g => g.date === dd) && !S.games.some(g => g.date === dd && sStarted(g, ms)) && ms < sLockAt(dd);
function sDayPool(dd, ms, reads) { const games = S.games.filter(g => g.date === dd && !sStarted(g, ms)); return sPool({ games }, S_KINDS, [], reads); }
function sSpWhy(dd, pool, minDec) {
  const m = pool.m, t = PBS.day(dd);
  if (m === 0) return `No leg on ${t} qualifies: the model rates none at or above DraftKings' price, at 45% to 97% and not far off the market.`;
  if (m < 2) return `Only ${m} of the ${pool.tickable.length} games on ${t} has a leg the model rates at or above DraftKings' price (one leg a game).`;
  return `No parlay of ${t}'s legs pays ${PBS.toAm(minDec)} or more (one leg a game).`;
}
function sSpWide(dd, pool) {
  const t = PBS.day(dd), n = S.games.filter(g => g.date === dd).length;
  if (!pool.tickable.length) return S.games[0] && S.games[0].date === dd && S.games.every(g => g.date >= dd) ? `The season opens ${t}.` : `Next up: ${t}, ${n} game${n === 1 ? '' : 's'}. Its set goes up once DraftKings posts lines, about a day ahead.`;
  if (pool.tickable.length < 2) return `Only one game on ${t} has a DraftKings line, and a parlay needs two.`;
  return '';
}
/* a locked leg's grade: the record's where it has one, else the scores' (a game gone or moved to another day void) */
function sSpGrade(L, i, e, id) {
  const jg = e.grade && e.grade[id] && Array.isArray(e.grade[id].legs) ? e.grade[id].legs[i] : null;
  if (jg) return jg;
  const g = S.games.find(x => x.id === L.game);
  if (!g || g.date !== e.date) return 'void';
  if (g.state !== 'final' || g.hs === null || g.hs === undefined) return null;
  if (L.kind === 'prop') {
    /* a player's line on the box the state carries: not on the ice void, a goalie's saves void unless he started */
    const b = S.box && S.box.games && S.box.games[L.game]; if (!b) return null;
    let x;
    if (L.stat === 'sv') { const v = b.g ? b.g[String(L.pid)] : undefined; if (v === undefined) return 'void'; x = v; }
    else { const v = b.s ? b.s[String(L.pid)] : undefined; if (!Array.isArray(v)) return 'void'; x = L.stat === 'pts' ? (typeof v[0] === 'number' && typeof v[1] === 'number' ? v[0] + v[1] : null) : v[{ g: 0, a: 1, s: 2, bs: 3 }[L.stat]]; }
    if (typeof x !== 'number') return null;
    return L.mk === 'yes' ? (x >= L.k ? 'win' : 'loss') : x > +L.line ? (L.side === 'over' ? 'win' : 'loss') : x < +L.line ? (L.side === 'under' ? 'win' : 'loss') : 'push';
  }
  if (L.kind === 'ou') { const tot = g.hs + g.as; return tot > L.line ? (L.side === 'over' ? 'win' : 'loss') : tot < L.line ? (L.side === 'under' ? 'win' : 'loss') : 'push'; }
  const margin = L.side === 'home' ? g.hs - g.as : g.as - g.hs;
  if (L.kind === 'ml') return margin > 0 ? 'win' : 'loss';
  const c = margin + L.line; return c > 0 ? 'win' : c < 0 ? 'loss' : 'push';
}
function sSpResult(t, legs) {
  if (legs.includes('loss')) return { result: 'lost', payout: 0 };
  if (legs.some(x => x === null)) return { result: 'pending' };
  if (legs.every(x => x === 'push' || x === 'void')) return { result: 'push', payout: 1 };
  const won = t.legs.filter((L, i) => legs[i] === 'win');
  return { result: 'won', payout: won.length === t.legs.length ? t.dec : won.reduce((a, L) => a * PBS.decOf(L.price), 1) };
}
/* a level's rule line and its title by the rule it carries (nhl v31), or the v30 rule's words for a level locked before it (no pick) */
function sRuleWords(id, t) {
  if (t.pick) return [`likeliest · ${PBS.toAm(t.minDec)}+`, `The likeliest parlay by ${t.chance === 'fair' ? "DraftKings' fair chance" : "the site's model (the props model, on trial, on player lines)"} paying at least ${PBS.toAm(t.minDec)}: $1 returns ${PBS.short(t.minDec)} or more`];
  const [, , n, floor] = TIERS_V30.find(x => x[0] === id), pct = Math.round(floor * 100);
  return !floor ? ['likeliest pair', 'The likeliest 2-leg parlay by the model'] : t.likeliest ? [`likeliest ${n} legs`, `No ${n}-leg parlay lands ${pct}% of the time by the model: the likeliest ${n} legs`]
    : [`best return · model ${pct}%+`, `The ${n}-leg parlay with the best return (the model's chance times the payout) that lands at least ${pct}% of the time by the model`];
}
/* a level's head and its three numbers, as a card should draw them: its name and size (no size on an empty one), the rule line and its
   title, the fair chance (", est." with a Yes price) and what $1 is expected to return at it ("expected −1%", rose below 0, titled with
   the dollars), the model's chance it was ranked on under them ("model says 41%", "model 41%, props on trial"; none on a level ranked on
   the fair chance), the price plain. A list of what is wrong */
function sLevelWrongs(el, id, label, t, hasProp, est) {
  const bad = [], [rule, title] = sRuleWords(id, t), r = el.querySelector('.pb-rule'), pill = el.querySelector('.pb-tc');
  if (txt(el.querySelector('.pb-tn')) !== label) bad.push(`name "${txt(el.querySelector('.pb-tn'))}"`);
  if (!pill || txt(pill) !== `${t.legs.length} legs`) bad.push(`size pill "${txt(pill)}" not "${t.legs.length} legs"`);
  if (!r || txt(r) !== rule || r.getAttribute('title') !== title) bad.push(`rule "${txt(r)}" [${r && r.getAttribute('title')}] not "${rule}" [${title}]`);
  const box = el.querySelector('.pb-n.pb-chance'), ev = box && box.querySelector('.pb-ev'), mline = box && [...box.querySelectorAll('.s')].filter(x => !x.classList.contains('pb-ev'));
  if (t.fair === null) { if (!box || txt(box.querySelector('.v')) !== PBS.pctW(t.p) || txt(box.querySelector('.k')) !== "model's chance" || ev) bad.push(`chance box "${txt(box)}" with no fair chance`); }
  else {
    const e = t.fair * t.d - 1, rr = Math.round(e * 100), evW = `expected ${rr < 0 ? '−' : rr > 0 ? '+' : ''}${Math.abs(rr)}%`, evT = `At DraftKings' fair chance: $1 returns $${(1 + e).toFixed(2)} on average`;
    const mW = t.chance === 'fair' ? null : hasProp ? `model ${PBS.pctW(t.p)}, props on trial` : `model says ${PBS.pctW(t.p)}`;
    if (!box || txt(box.querySelector('.v')) !== PBS.pctW(t.fair) || txt(box.querySelector('.k')) !== `fair chance${est ? ', est.' : ''}`) bad.push(`chance "${txt(box)}" not ${PBS.pctW(t.fair)} fair chance${est ? ', est.' : ''}`);
    if (!ev || txt(ev) !== evW || ev.getAttribute('title') !== evT || ev.classList.contains('neg') !== (rr < 0)) bad.push(`expected "${txt(ev)}" [${ev && ev.getAttribute('title')}${ev && ev.classList.contains('neg') ? ', rose' : ''}] not "${evW}" [${evT}${rr < 0 ? ', rose' : ''}]`);
    if (!mline || mline.length !== (mW ? 1 : 0) || (mW && txt(mline[0]) !== mW)) bad.push(`model line "${mline ? mline.map(txt).join(' / ') : ''}" not "${mW || 'none'}"`);
  }
  const price = el.querySelectorAll('.pb-n')[1];
  if (!price || txt(price.querySelector('.v')) !== PBS.toAm(t.d) || txt(price.querySelector('.k')) !== 'price' || /est/.test(txt(price))) bad.push(`price "${txt(price)}" not ${PBS.toAm(t.d)}, plain`);
  if (el.querySelector('.pill.thin') || /thin edge/i.test(txt(el))) bad.push('a thin edge drawn');
  return bad;
}
/* each level's eras (nhl v31) by this smoke's own sums over the ledger's graded days of the season: the rule a level was taken by (its
   pick, least price and chance, or 'v30' with none), its first and last day, graded, won, lost, pushes, units on 1 a day, wins expected */
function sEras(L, season) {
  const SG = require('./suggest'), out = {}, r4 = x => Math.round(x * 1e4) / 1e4;
  for (const [id] of TIERS) out[id] = {};
  for (const dd of Object.keys(L.days).sort()) {
    const e = L.days[dd]; if (SG.seasonOf(dd) !== season || !e.grade) continue;
    for (const [id] of TIERS) {
      const t = e.tiers[id], g = e.grade[id]; if (!t || !g) continue;
      const k = t.pick ? `${t.pick} ${t.minDec} ${t.chance}` : 'v30', E = out[id][k] || (out[id][k] = { from: dd, to: dd, graded: 0, won: 0, lost: 0, push: 0, units: 0, exp_model: 0, exp_fair: 0 });
      E.to = dd;
      if (g.result === 'pending') continue;
      if (g.result === 'push') { E.push++; continue; }
      E.graded++; if (g.result === 'won') { E.won++; E.units += g.payout - 1; } else { E.lost++; E.units += -1; }
      E.exp_model += t.p; if (t.fair !== null) E.exp_fair += t.fair;
    }
  }
  for (const x of Object.values(out)) for (const E of Object.values(x)) { E.units = r4(E.units); E.exp_model = r4(E.exp_model); E.exp_fair = r4(E.exp_fair); }
  return out;
}
/* a record pill's title by this smoke's own wording: the level's whole record, then each rule's own where it has had one before today's
   ("of them 25 under the earlier rule (3 legs, best return at 25%+), to Nov 12: 4–21, −2.56 units; 2 since Nov 13 (likeliest paying
   +300 or more): 1–1, +2.00 units") */
function sRecTitle(id, label, minDec, t, since, eras) {
  const un = v => { const r = Math.round(v * 100) / 100; return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(2); }, f1 = v => (+v || 0).toFixed(1), pl = (n, x) => `${n} ${x}${n === 1 ? '' : x === 'push' ? 'es' : 's'}`;
  const md = dd => new Date(dd + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  let title = `${label}: ${t.won} won of ${t.graded} graded${since ? ` since ${PBS.day(since)}` : ''}${t.graded ? `; wins expected ${f1(t.exp_fair)} by DraftKings' fair chance${t.fair_n < t.graded ? ` (on the ${t.fair_n} with one)` : ''}, ${f1(t.exp_model)} by the model` : ''}`
    + (t.push ? `; ${pl(t.push, 'push')}, the stake back` : '') + (t.none ? `; ${pl(t.none, 'day')} with no ${label} parlay` : '') + (t.replay ? `; ${t.replay} of them rebuilt afterwards, by the earlier rule, from the state the site published before that day's first puck drop` : '');
  if (!eras) return title;
  const cur = `${S_PICK} ${minDec} ${S_CHANCE}`, list = Object.entries(eras).filter(([, E]) => E.graded || E.push).sort((a, b) => a[1].from < b[1].from ? -1 : a[1].from > b[1].from ? 1 : a[0] < b[0] ? -1 : 1);
  if (!list.some(([k]) => k !== cur)) return title;
  return title + '; of them ' + list.map(([k, E]) => {
    const rec = `${E.won}–${E.lost}${E.push ? `, ${pl(E.push, 'push')}` : ''}, ${un(E.units)} units`;
    if (k === 'v30') { const V = TIERS_V30.find(x => x[0] === id); return `${E.graded} under the earlier rule (${!V[3] ? 'the likeliest pair' : `${V[2]} legs, best return at ${Math.round(V[3] * 100)}%+`}), to ${md(E.to)}: ${rec}`; }
    const [, m, c] = k.split(' '), how = `likeliest${c === S_CHANCE ? '' : c === 'fair' ? " by DraftKings' fair chance" : ' by the model'} paying ${PBS.toAm(+m)} or more`;
    return k === cur ? `${E.graded} since ${md(E.from)} (${how}): ${rec}` : `${E.graded} from ${md(E.from)} to ${md(E.to)} (${how}): ${rec}`;
  }).join('; ');
}
function holdSuggest(w, ms, tag) {
  w.eval('renderSuggest()');
  const d = w.document, store = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}'), stake = sStakeOf(store), inB = sDrawn(w);
  const days = sSpDays(ms), secs = [...d.querySelectorAll('#spBody .sp-day')].map(x => x.dataset.spDay), out = {};
  chk(canon(secs) === canon(days), `${tag}: the Suggested Parlays tab shows ${days.join(' and ') || 'no day'} (${secs.join(', ') || 'none'})`);
  /* the one dated line on the change of rule: for seven days from the publish that first carried it, by the publish's Eastern date */
  { const c = S.suggest && S.suggest.change, el = d.getElementById('spChange');
    const want = c && c.from && c.at && etDate(Date.parse(S.published)) < addD(etDate(Date.parse(c.at)), 7) ? `From ${new Date(c.from + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} each level is the likeliest parlay paying +110, +300 or +700 or more; each pill's title keeps the earlier levels apart.` : '';
    chk(!!el && (want ? !el.hidden && txt(el) === want : el.hidden), `${tag}: the change of rule ${want ? `says "${want}"` : 'says nothing'} (${el && !el.hidden ? txt(el) : 'hidden'})`); }
  if (!days.length) { chk(!!d.getElementById('spWide'), `${tag}: with no day to show the tab says why (${txt(d.getElementById('spWide'))})`); return out; }
  for (const dd of days) {
    const sec = d.querySelector(`#spBody .sp-day[data-sp-day="${dd}"]`); if (!sec) continue;
    const open = sDayOpen(dd, ms), lockMs = sLockAt(dd), lockEl = sec.querySelector('.sp-lock'), dt = `${tag}, ${dd}`;
    {
      const today = etDate(ms), nm = dd === today ? 'Today' : dd === PBS.nextDay(today) ? 'Tomorrow' : PBS.day(dd), dg = S.games.filter(g => g.date === dd);
      const ts = [...new Set(dg.slice().sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0).map(g => sClock(Date.parse(g.start))))], span = ts.length > 1 ? `${ts[0]} to ${ts[ts.length - 1]}` : ts[0] || '';
      const pill = sec.querySelector('.sp-dh .sp-dpill');
      chk(txt(sec.querySelector('.sp-dh h3')) === `${nm}, ${dg.length} game${dg.length === 1 ? '' : 's'}` && (nm === PBS.day(dd) ? !pill : txt(pill) === PBS.day(dd)) && txt(sec.querySelector('.sp-dh small')) === span,
        `${dt}: the day's heading names it, counts its games, dates it and gives its first and last puck drop in the visitor's zone (${txt(sec.querySelector('.sp-dh'))})`);
    }
    chk((sec.dataset.spState === 'open') === open, `${dt}: the set is ${open ? 'open' : 'locked'} (${sec.dataset.spState})`);
    if (open) {
      chk(!!lockEl && txt(lockEl) === `Locks ${sDayClock(lockMs)}`, `${dt}: it says when it locks, the day's first puck drop with its weekday (${txt(lockEl)})`);
      const pool = sDayPool(dd, ms, sReads(w)), wide = sSpWide(dd, pool), cards = [...sec.querySelectorAll('.pb-tier')];
      if (wide) { chk(!cards.length && txt(sec.querySelector('.pb-wide')) === wide, `${dt}: no levels, and it says "${wide}" (${txt(sec.querySelector('.pb-wide'))})`); out[dd] = { open, pool, levels: null }; continue; }
      chk(cards.length === 3 && !sec.querySelector('.pb-tier[data-tier="xtrm"]'), `${dt}: three levels, Safe, Medium and Aggressive`);
      /* what the page hands the record (pbDayLevels): each level with the rule that chose it, its numbers its legs' in leg order */
      const given = JSON.parse(w.eval(`JSON.stringify(pbDayLevels(${JSON.stringify(dd)}))`)), levels = {};
      for (const [id, label, , , minDec] of TIERS) {
        const el = sec.querySelector(`.pb-tier[data-tier="${id}"]`); if (!el) { chk(false, `${dt}: no ${label} card`); continue; }
        const shown = [...el.querySelectorAll('.pb-tl')].map(x => x.dataset.id), b = sLevel(pool.legs, minDec), gv = given.levels[id];
        if (!b) {
          chk(el.classList.contains('none') && !el.querySelector('.pb-tc') && txt(el.querySelector('.pb-empty')) === sSpWhy(dd, pool, minDec) && gv === null, `${dt}: ${label} is empty, with no size pill: "${sSpWhy(dd, pool, minDec)}" (${txt(el.querySelector('.pb-empty')) || 'a parlay drawn'}${gv ? ', handed to the record' : ''})`);
          levels[id] = null; continue;
        }
        chk(JSON.stringify(shown) === JSON.stringify(b.legs.map(L => L.id)), `${dt}: ${label} is this smoke's search's likeliest paying ${PBS.toAm(minDec)} or more: ${b.legs.map(L => L.id).join(', ')} (page: ${shown.join(', ')})`);
        { const gl = gv ? gv.legs : [], gm = new Set(gl.map(L => L.game)), pr = gl.reduce((a, L) => a * L.p, 1), dc = gl.reduce((a, L) => a * PBS.decOf(L.price), 1), fr = gl.reduce((a, L) => a === null || L.fair === null ? null : a * L.fair, 1);
          chk(!!gv && gv.pick === S_PICK && gv.minDec === minDec && gv.chance === S_CHANCE && !('likeliest' in gv) && JSON.stringify(gl.map(L => L.id)) === JSON.stringify(shown) && gl.length >= 2 && gl.length <= Math.min(S_CAP, pool.m) && gm.size === gl.length
            && Math.abs(gv.p - pr) <= 1e-12 && Math.abs(gv.dec - dc) <= 1e-12 * dc && (fr === null ? gv.fair === null : Math.abs(gv.fair - fr) <= 1e-12) && gv.dec >= minDec * (1 - S_TIE) && Math.abs(gv.p - b.p) <= 1e-12 && Math.abs(gv.dec - b.d) <= 1e-12 * b.d,
            `${dt}: ${label} as the page hands it to the record: pick ${gv && gv.pick}, ${gv && gv.minDec}, by ${gv && gv.chance}, ${gl.length} legs one a game, its chance, fair chance and price its legs' in leg order, paying ${gv && PBS.toAm(gv.dec)}`); }
        const hasP = b.legs.some(L => L.prop), est = b.legs.some(L => L.fairEst);
        const lw = sLevelWrongs(el, id, label, { legs: b.legs, p: b.p, fair: b.fair, d: b.d, pick: S_PICK, minDec, chance: S_CHANCE }, hasP, est);
        chk(!lw.length, `${dt}: ${label}'s head and numbers: ${b.n} legs, "likeliest · ${PBS.toAm(minDec)}+", fair ${b.fair === null ? 'none' : PBS.pctW(b.fair)} and its expected return, the model's ${PBS.pctW(b.p)}${hasP ? ' (props on trial)' : ''}, ${PBS.toAm(b.d)} (${lw.join('; ')})`);
        const pay = el.querySelector('[data-pb-pay]');
        chk(pay && txt(pay.querySelector('.v')) === PBS.money(PBS.cents(stake * b.d)) && txt(pay.querySelector('.k')) === `${PBS.short(stake)} pays`, `${dt}: ${label} pays ${PBS.money(PBS.cents(stake * b.d))} on ${PBS.short(stake)} (${pay && txt(pay)})`);
        /* every leg: the state's price, fair and model chance, its puck drop in the visitor's zone, its own Add */
        const lb = [];
        for (const L of b.legs) {
          const row = el.querySelector(`.pb-tl[data-id="${L.id}"]`), rt = txt(row), ab = row && row.querySelector('button.sp-add'), on = inB.has(L.id);
          const ttl = row ? row.getAttribute('title') || '' : '', pr = row && row.querySelector('.pr'), em = pr && pr.querySelector('em'), mdl = `${L.prop ? 'props model' : 'model'} ${PBS.pctW(L.p)}`;
          const ch = `${PBS.pctW(L.fair)}${L.fairEst ? ' est.' : ''}`, bold = L.kind === 'ou' && !L.prop ? L.bet : L.who, under = L.kind === 'ou' && !L.prop ? '' : `${L.bet} · `;
          if (!(pr && txt(pr) === `${PBS.odds(L.price)}${ch}` && txt(em) === ch && ttl.includes(`fair ${PBS.pctW(L.fair)}`) && ttl.includes(mdl) && (!L.prop || /on trial/.test(ttl))
            && txt(row.querySelector('.nm .m')) === `${L.mu} · ${sClock(Date.parse(L.start))}` && txt(row.querySelector('.nm b')) === bold && txt(row.querySelector('.nm small')) === `${under}${L.mu} · ${sClock(Date.parse(L.start))}`
            && ab && ab.getAttribute('aria-label').includes(mdl) && !/ · /.test(ab.getAttribute('aria-label')))) lb.push(`${L.id}: ${rt} [${ttl}]`);
          if (!ab || ab.dataset.leg !== L.id || ab.getAttribute('aria-pressed') !== String(on) || txt(ab) !== (on ? 'Added' : 'Add') || !ab.getAttribute('aria-label').includes(`${S.teams[L.g.away].short} @ ${S.teams[L.g.home].short}`)) lb.push(`${L.id}: its Add (${ab ? txt(ab) + ' ' + ab.getAttribute('aria-pressed') : 'none'})`);
        }
        chk(!lb.length, `${dt}: ${label}'s every leg is the state's, in leg order, with its own Add naming its game (${lb.slice(0, 2).join(' | ')})`);
        { const byId = new Map(pool.legs.map(L => [L.id, L])), ls = shown.map(id2 => byId.get(id2)); chk(ls.every(Boolean) && JSON.stringify(ls.slice().sort(sOrder).map(L => L.id)) === JSON.stringify(shown), `${dt}: ${label}'s legs are in leg order`); }
        const all = sameIds(sDrawnList(w), shown), add = el.querySelector('[data-sp-add]'), fin = el.querySelector('[data-sp-finish]');
        chk(!!fin && fin.dataset.spFinish === `${dd}|${id}` && !!add && add.dataset.spAdd === `${dd}|${id}` && add.disabled === all && txt(add) === (all ? 'In the builder' : 'Add to builder'), `${dt}: ${label} ends with Finish and ${all ? 'In the builder, off' : 'Add to builder'} (${txt(add)})`);
        levels[id] = { legs: shown, b };
      }
      out[dd] = { open, pool, levels };
    } else {
      const e = sSet(dd);
      chk(!sec.querySelector('button[data-leg], [data-sp-add], [data-sp-finish]'), `${dt}: a locked set offers no Add, Add to builder or Finish`);
      if (!e) {
        /* a state from before the record's sets were carried says only that the day locked */
        const said = S.suggest && S.suggest.sets ? `No set was taken for ${PBS.day(dd)} before its first puck drop.` : `${PBS.day(dd)}'s set locked at its first puck drop.`;
        chk(txt(sec.querySelector('.pb-wide')) === said && txt(lockEl) === 'Locked', `${dt}: locked with no set of the record's in the state, it says "${said}" (${txt(sec.querySelector('.pb-wide'))})`); out[dd] = { open, entry: null }; continue;
      }
      const all = S.games.filter(g => g.date === dd), under = all.length && all.every(g => sStarted(g, ms));
      const res = {}; for (const [id] of TIERS) if (e.tiers[id]) res[id] = sSpResult(e.tiers[id], e.tiers[id].legs.map((L, i) => sSpGrade(L, i, e, id)));
      const lv = TIERS.filter(([id]) => e.tiers[id]), newRule = Object.values(e.tiers).some(t => t && t.pick);
      const words = `Locked since ${sDayClock(Date.parse(e.lock))}.` + (lv.length && lv.every(([id]) => res[id].result !== 'pending') ? ' Graded.' : under ? ' Under way.' : '');
      chk(txt(lockEl) === words, `${dt}: the locked set says "${words}" (${txt(lockEl)})`);
      const lb = [];
      for (const [id, label, , , minDec] of TIERS) {
        const el = sec.querySelector(`.pb-tier[data-tier="${id}"]`), t = e.tiers[id]; if (!el) { lb.push(`no ${label}`); continue; }
        if (!t) {
          const none = `No ${label} parlay was in the set: ${newRule ? `no parlay of ${PBS.day(dd)}'s legs paid ${PBS.toAm(minDec)} or more` : `too few legs qualified on ${PBS.day(dd)}`}.`;
          if (!el.classList.contains('none') || el.querySelector('.pb-tc') || txt(el.querySelector('.pb-empty')) !== none) lb.push(`${label} drawn "${txt(el)}" though the record has none ("${none}")`);
          continue;
        }
        const shown = [...el.querySelectorAll('.pb-tl')];
        if (canon(shown.map(x => x.dataset.id)) !== canon(t.legs.map(L => L.id))) lb.push(`${label}: legs ${shown.map(x => x.dataset.id).join(',')} not the record's`);
        t.legs.forEach((L, i) => { const gr = sSpGrade(L, i, e, id), r = shown[i]; if (r && r.dataset.grade !== (gr || 'pending')) lb.push(`${L.id}: graded ${r.dataset.grade}, not ${gr || 'pending'}`); });
        if (el.dataset.result !== res[id].result) lb.push(`${label}: ${el.dataset.result}, not ${res[id].result}`);
        /* the head and the numbers by the level's own rule: a v30 level's words (no pick), or the new rule's */
        lb.push(...sLevelWrongs(el, id, label, Object.assign({}, t, { d: t.dec }), t.legs.some(L => L.kind === 'prop'), t.legs.some(L => L.kind === 'prop' && L.mk === 'yes')).map(x => `${label}: ${x}`));
        t.legs.forEach((L, i) => {
          const r = shown[i]; if (!r) return;
          const g = S.games.find(x => x.id === L.game), ab = String(L.mu || '').split(' @ '), club = x => Object.keys(S.teams || {}).find(k => S.teams[k].abbr === x) || null;
          const side = L.side === 'home' ? (g ? g.home : club(ab[1])) : L.side === 'away' ? (g ? g.away : club(ab[0])) : null;
          const name = L.kind === 'prop' ? (L.name || `ESPN athlete ${L.pid}`) : L.kind === 'ou' ? `${L.side === 'over' ? 'Over' : 'Under'} ${L.line} goals` : side ? S.teams[side].short : (L.side === 'home' ? ab[1] : ab[0]) || 'A club';
          const what = L.kind === 'prop' ? null : L.kind === 'ml' ? 'To win' : L.kind === 'pl' ? `Puck line ${PBS.line(L.line)}` : '';
          const fair = L.fair === null || L.fair === undefined ? '—' : `${PBS.pctW(L.fair)}${L.kind === 'prop' && L.mk === 'yes' ? ' est.' : ''}`, gr = sSpGrade(L, i, e, id);
          const st = gr ? { win: 'won', loss: 'lost', push: 'push', void: 'void' }[gr] : g && sStarted(g, ms) ? 'live' : sClock(Date.parse(L.start));
          const small = txt(r.querySelector('.nm small'));
          if (txt(r.querySelector('.nm b')) !== name || (what === null ? !small.endsWith(` · ${L.mu}`) : small !== `${what ? what + ' · ' : ''}${L.mu}`) || txt(r.querySelector('.pr')) !== `${PBS.odds(L.price)}${fair}` || txt(r.querySelector('.sp-st')) !== st)
            lb.push(`${L.id}: "${txt(r)}" not ${name} / ${what === null ? '(a player\'s bet)' : what} · ${L.mu} / ${PBS.odds(L.price)} ${fair} / ${st}`);
        });
        const v = [...el.querySelectorAll('.pb-n')].map(x => txt(x)), R = res[id];
        /* what the bet amount paid, was lost, came back or pays */
        const pay = R.result === 'won' ? `${PBS.money(PBS.cents(stake * R.payout))}${PBS.short(stake)} paid` : R.result === 'lost' ? `$0.00${PBS.short(stake)} lost` : R.result === 'push' ? `${PBS.money(PBS.cents(stake))}the stake back` : `${PBS.money(PBS.cents(stake * t.dec))}${PBS.short(stake)} pays`;
        if ((v[2] || '').replace(/\s+/g, '') !== pay.replace(/\s+/g, '')) lb.push(`${label}: pays "${v[2]}" not "${pay}"`);
      }
      chk(!lb.length, `${dt}: the locked set is the record's, read only, each level by its own rule's words, each leg graded on the scores and each level's result (${lb.slice(0, 3).join(' | ')})`);
      out[dd] = { open, entry: e, newRule };
    }
  }
  return out;
}
const sameIds = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const sDrawnList = w => JSON.parse(w.eval('JSON.stringify(builderLegs(false).map(L => L.id))'));
/* every level's legs by the leg order, the builder's: puck drop, then the matchup, then the kind */
function legsSorted(ids) { const L = ids.map(x => { const [g, s, k] = x.split('|'); return sLeg(S.games.find(y => y.id === g), s, k); }); return L.slice().sort(sOrder).map(l => l.id).join(',') === ids.join(','); }

/* Pick your own legs' Model chips against the state St: a game with a call (slCallS, the Games list's rule) carries "Model <club> <N>%",
   its pick's club and chance as a row writes them, and the moneyline button on that club, where it has one, the same chance; a game
   with no call carries no chip. { n, ids, bad } */
function plChipWrongs(d, St) {
  const pgs = [...d.querySelectorAll('#plLines .pb-pg[data-id]')], bad = [];
  for (const pg of pgs) {
    const g = St.games.find(x => x.id === pg.dataset.id), chip = pg.querySelector('.pb-pgh > .chip'); if (!g) { bad.push(`${pg.dataset.id}: no such game`); continue; }
    const c = slCallS(g), want = c ? `Model ${St.teams[c.pick].abbr} ${c.conf}%` : null, ml = c && pg.querySelector(`button[data-leg="${g.id}|${c.side}|ml"] .pb-bc`);
    if ((chip ? txt(chip) : null) !== want || (chip && txt(chip.querySelector('b')) !== `${St.teams[c.pick].abbr} ${c.conf}%`)) bad.push(`${g.id}: chip "${chip ? txt(chip) : 'none'}", want "${want || 'none'}" (pHome ${g.pHome}, pick ${g.pick})`);
    if (ml && txt(ml) !== `· ${c.conf}%`) bad.push(`${g.id}: the moneyline on ${St.teams[c.pick].abbr} reads "${txt(ml)}" beside the chip's ${c.conf}%`);
  }
  return { n: pgs.length, ids: pgs.map(x => x.dataset.id), bad };
}
async function parlayBuilder() {
  console.log('THE PARLAY BUILDER');
  const AT = PUB + 60000, errors = [];
  const w = await boot(AT, errors, { hash: 'parlay' }), d = w.document, $ = id => d.getElementById(id);
  const store = () => JSON.parse(w.localStorage.getItem('nhl_v1') || '{}');
  /* the tabs: Games, Suggested Parlays, Parlay Builder (the NFL hub's order); #parlay opens the Parlay Builder, the builder first */
  const tabs = [...d.querySelectorAll('#tabs button')];
  chk(tabs[1] && tabs[1].dataset.tab === 'suggest' && txt(tabs[1]) === 'Suggested Parlays' && tabs[2] && tabs[2].dataset.tab === 'parlays' && /^Parlay Builder/.test(txt(tabs[2])), `Suggested Parlays is the second tab and the Parlay Builder the third (${tabs.map(b => txt(b)).join(' | ')})`);
  chk(!$('tab-parlays').hidden && w.location.hash === '#parlays', `#parlay opens the Parlay Builder (${w.location.hash})`);
  const order = [...$('tab-parlays').children].map(x => x.id || x.className.split(' ')[0]), at = id => order.indexOf(id);
  chk(at('builder') >= 0 && at('builder') < at('pbPanel') && at('pbPanel') < at('pbPick') && at('pbPick') < at('saved'), `the Parlay Builder is the builder first, then the Top 30 lines, Pick your own legs and the saved parlays (${order.join(', ')})`);
  chk(txt($('pbTitle')) === 'Top 30 lines' && txt($('spTitle')) === 'Suggested Parlays' && !!$('tab-suggest').querySelector('#pbRec'), `the panel is the Top 30 lines, and the levels and their record are the Suggested Parlays tab's (${txt($('pbTitle'))}; ${txt($('spTitle'))})`);
  /* the default list, and the Suggested Parlays tab's sets, every level by brute force */
  const P0 = holdPanel(w, AT, 'default'), S0 = holdSuggest(w, AT, 'default');
  /* every clock on the page is the visitor's own and names its zone; the card's, which goes to other people, is Eastern and says ET */
  const clock = ms => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  /* nhl v25: when the prices were read is the Refresh odds line's to say (the panel's own sentence went); the panel's own line shows
     only where another book prices a game, a money warning */
  { const ob = P0.pool.tickable.filter(g => !isDKBook(g.line));
    chk(txt($('pbOddsNote')) === oddsIdleS(AT) && $('pbRead').hidden === !ob.length && (!ob.length || /not DraftKings\.$/.test(txt($('pbRead')))), `the Refresh odds line dates the prices in the visitor's zone, named, and the panel's own line shows only where another book prices a game (${txt($('pbOddsNote'))}; ${$('pbRead').hidden ? 'hidden' : txt($('pbRead'))})`); }
  const tileTimes = [...d.querySelectorAll('#pbGrid input[data-g]')].map(x => [x.dataset.g, txt(x.closest('.pb-g'))]);
  chk(tileTimes.every(([id, t]) => t.endsWith(clock(Date.parse(S.games.find(g => g.id === id).start)))), `every game tile's puck drop names its zone (${tileTimes.slice(0, 2).map(x => x[1]).join(' | ')})`);
  const spTimes = [...d.querySelectorAll('#spBody .sp-day[data-sp-state="open"] .pb-tl')].map(x => [x.dataset.id.split('|')[0], txt(x.querySelector('.nm .m'))]);
  chk(spTimes.every(([id, t]) => t.endsWith(clock(Date.parse(S.games.find(g => g.id === id).start)))), `every suggested level's leg names its puck drop's zone (${spTimes.slice(0, 2).map(x => x[1]).join(' | ')})`);
  /* preferred is the Games cards' call: every qualifying leg of the slate */
  for (const L of P0.pool.legs) chk(!L.thin === (L.pick === L.side), `${L.id}: a line 5 points above the price is exactly the card's call (edge ${L.edge}, call ${L.pick})`);
  /* Pick your own legs: each game's Model chip is the call as the Games list writes it (the second review of nhl v30: the chip and the
     moneyline button beside it rounded an away pick at a half-point apart, 55% and 54%) */
  const chipsAt = (dd, tag) => { const c = plChipWrongs(dd, S); chk(!c.bad.length, `${tag}: Pick your own legs' Model chip on each game is the call, its club and its chance as the Games list writes it, and the moneyline on that club reads the same chance (${c.n} games; ${c.bad.slice(0, 3).join(' | ')})`); return c; };
  const plIds = chipsAt(d, 'the default slate').ids;
  /* Both days, when offered: the list on both */
  if (P0.sl.both) {
    const b = d.querySelector('#pbDay button[data-day="both"]'); b.focus(); b.click();
    chk(d.activeElement && d.activeElement.dataset && d.activeElement.dataset.day === 'both', `choosing a Day keeps the keyboard's focus on it, redrawn (${d.activeElement && (d.activeElement.dataset && d.activeElement.dataset.day || d.activeElement.tagName)})`);
    holdPanel(w, AT, 'both days');
    chipsAt(d, 'Both days');
    chk(store().ui.pb.day === 'both', 'Both days is kept in nhl_v1');
    d.querySelector(`#pbDay button[data-day="${P0.sl.pick}"]`).click();
  } else console.log(`  Both days not offered (${P0.sl.days.join(', ') || 'no day'}): its list skipped`);
  /* and on a copy planting, on the games Pick your own legs lists, an away pick at pHome exactly 0.455 (55%, as a home pick at 0.545 is,
     though 1 - 0.455 is 0.54499999... in floating point) and a home pick at 0.545 */
  if (plIds.length) {
    const PC = JSON.parse(STATE), pa = PC.games.find(g => g.id === plIds[0]), ph = plIds[1] ? PC.games.find(g => g.id === plIds[1]) : null;
    pa.pHome = 0.455; pa.pick = 'away'; if (ph) { ph.pHome = 0.545; ph.pick = 'home'; }
    const e5 = [], w5 = await boot(AT, e5, { state: JSON.stringify(PC), hash: 'parlays' }), c5 = plChipWrongs(w5.document, PC), chip5 = w5.document.querySelector(`#plLines .pb-pg[data-id="${pa.id}"] .chip`);
    chk(!c5.bad.length && txt(chip5) === `Model ${S.teams[pa.away].abbr} 55%`, `a copy planting an away pick at pHome 0.455 on ${pa.id}${ph ? ` and a home pick at 0.545 on ${ph.id}` : ''}: each chip ${S.teams[pa.away].abbr} 55% and the moneyline beside it the same (${txt(chip5)}; ${c5.bad.slice(0, 3).join(' | ')})`);
    chk(!e5.length, 'no runtime error on the planted copy: ' + e5.join(' | '));
    w5.close(); OPEN.delete(w5);
  } else console.log('  Pick your own legs lists no game on the default slate: its Model chip is not held on this state');
  const listOn = !!(P0.top && P0.top.value.length + P0.top.other.length);
  if (listOn) {
    /* the controls: each mix, each box alone, none, the games All and None and one unticked; the list follows, the reasons say why */
    const setBoxes = ks => { for (const b of d.querySelectorAll('#pbKinds input[data-k]')) if (b.checked !== ks.includes(b.dataset.k)) { b.checked = !b.checked; b.dispatchEvent(new w.Event('change', { bubbles: true })); } };
    const kindsOf = () => [...new Set([...d.querySelectorAll('#pbBody .t30-r')].map(x => x.dataset.id.includes('|p|') ? (/\|(under)[\d.]+$/.test(x.dataset.id) ? 'pu' : 'po') : x.dataset.id.split('|')[2]))];
    const noneSaid = () => txt($('pbNone'));
    for (const [mix, ks] of [['teams', ['ml', 'pl', 'ou']], ['players', ['po', 'pu']], ['all', ['ml', 'pl', 'ou', 'po', 'pu']]]) {
      d.querySelector(`#pbMix button[data-mix="${mix}"]`).click();
      const got = [...d.querySelectorAll('#pbKinds input[data-k]')].filter(b => b.checked).map(b => b.dataset.k).join(',');
      chk(got === ks.join(','), `${mix}: the mix ticks ${ks.join(', ')} (${got})`);
      chk(kindsOf().every(x => ks.includes(x)), `${mix}: every line listed is of the ticked kinds (${kindsOf().join(', ')})`);
      chk(JSON.stringify(Object.entries(store().ui.pb.k).filter(([, v]) => v).map(([x]) => x)) === JSON.stringify(ks), `${mix}: ui.pb.k is stored`);
      holdPanel(w, AT, `mix ${mix}`);
    }
    for (const ks of [['ml'], ['pl'], ['ou'], ['po'], ['pu'], ['po', 'pu'], []]) {
      setBoxes(ks);
      const lit = d.querySelector('#pbMix button.on');
      const mixOf = ks.join() === 'po,pu' ? 'players' : null;
      chk((lit ? lit.dataset.mix : null) === mixOf, `boxes ${ks.join(',') || 'none'}: the mix lit is ${mixOf} (${lit && lit.dataset.mix})`);
      chk(kindsOf().every(x => ks.includes(x)), `boxes ${ks.join(',') || 'none'}: the list holds only those kinds`);
      chk(!ks.length === (noneSaid() === 'No bet types ticked: tick at least one above.'), `boxes ${ks.join(',') || 'none'}: "No bet types ticked" shown exactly when none is ticked (${noneSaid()})`);
      holdPanel(w, AT, `boxes ${ks.join(',') || 'none'}`);
    }
    setBoxes(['ml', 'pl', 'ou', 'po', 'pu']);
    d.querySelector('#pbGames button[data-gall="0"]').click();
    chk(noneSaid() === 'No games ticked: tick at least one above.' && store().ui.pb.off.length === P0.pool.tickable.length, `None: the list says "No games ticked" (${noneSaid()}), and the games are stored unticked`);
    holdPanel(w, AT, 'games none');
    d.querySelector('#pbGames button[data-gall="1"]').click();
    chk(!/No games ticked/.test(noneSaid()) && d.querySelectorAll('#pbBody .t30-r').length > 0, 'All: the games are ticked again');
    const first = d.querySelector('#pbGrid input[data-g]');
    first.focus(); first.checked = false; first.dispatchEvent(new w.Event('change', { bubbles: true }));
    chk(d.activeElement && d.activeElement.dataset && d.activeElement.dataset.g === first.dataset.g && d.activeElement !== first, `unticking a game keeps the keyboard's focus on its box, redrawn (${d.activeElement && (d.activeElement.dataset && d.activeElement.dataset.g || d.activeElement.tagName)})`);
    chk(store().ui.pb.off.includes(first.dataset.g) && ![...d.querySelectorAll('#pbBody .t30-r')].some(x => x.dataset.id.startsWith(first.dataset.g + '|')), `one game unticked (${first.dataset.g}): stored, and in no line of the list`);
    const tile = d.querySelector(`#pbGrid input[data-g="${first.dataset.g}"]`).closest('.pb-g');
    chk(tile && !tile.classList.contains('on') && [...d.querySelectorAll('#pbGrid label.pb-g')].every(t => t.classList.contains('on') === t.querySelector('input[data-g]').checked) && /\.pb-g:not\(\.on\)\{[^}]*border-style:dashed/.test(HTML), 'an unticked game is drawn dashed: a tile is .on exactly while its box is ticked (the NFL hub\'s, the class set with the box)');
    holdPanel(w, AT, 'one game unticked');
    /* the picks come back on a second boot of the same store */
    const kept = w.localStorage.getItem('nhl_v1');
    const e2 = [], w2 = await boot(AT, e2, { store: kept, hash: 'parlays' });
    const in2 = w2.document.querySelector(`#pbGrid input[data-g="${first.dataset.g}"]`);
    chk(in2 && !in2.checked, 'a second boot on the stored nhl_v1 keeps the game unticked');
    holdPanel(w2, AT, 'restored');
    chk(!e2.length, 'no runtime error on the restored boot: ' + e2.join(' | '));
    const again = d.querySelector(`#pbGrid input[data-g="${first.dataset.g}"]`);
    again.checked = true; again.dispatchEvent(new w.Event('change', { bubbles: true }));
    chk(!store().ui.pb.off.length, 'ticked again, no game is stored unticked');
    /* a line's Add: into the builder above, Added and pressed, the keyboard's focus kept on it; a second tap takes it out */
    const r0 = d.querySelector('#pbBody .t30-r'), id0 = r0.dataset.id, add0 = () => d.querySelector(`#pbBody .t30-r[data-id="${id0}"] button.t30-add`);
    add0().focus(); add0().click();
    chk(store().legs.length === 1 && `${store().legs[0].game}|${store().legs[0].side}|${store().legs[0].kind}` === id0 && add0().getAttribute('aria-pressed') === 'true' && txt(add0()) === 'Added' && !!d.querySelector(`#legs .leg[data-id="${id0}"]`), `a Top 30 line's Add puts it in the builder above, the button Added and pressed (${id0}; ${add0() && txt(add0())})`);
    chk(d.activeElement === add0(), `the keyboard's focus stays on the line's Add, redrawn (${d.activeElement && (d.activeElement.dataset && d.activeElement.dataset.leg || d.activeElement.tagName)})`);
    holdPanel(w, AT, 'a line added');
    add0().click();
    chk(!store().legs.length && add0().getAttribute('aria-pressed') === 'false' && txt(add0()) === 'Add', 'a second tap takes it out');
  } else console.log('  no line on the default picks: the controls are held on the made-up slates below');
  /* the Suggested Parlays tab: a level's legs, its Add to builder and Finish */
  const openDays = Object.keys(S0).filter(dd => S0[dd].open && S0[dd].levels);
  const levelsOn = openDays.some(dd => TIERS.some(t => S0[dd].levels[t[0]]));
  if (levelsOn) {
    const spTab = () => d.querySelector('#tabs button[data-tab="suggest"]').click();
    spTab();
    chk(!$('tab-suggest').hidden && w.location.hash === '#suggest', `the Suggested Parlays tab opens (${w.location.hash})`);
    holdSuggest(w, AT, 'the tab shown');
    /* the Bet amount: one number, every level's pays line redrawn as it is typed */
    d.querySelector('#tabs button[data-tab="parlays"]').click(); w.eval('renderSuggest()');
    const box = $('pbStake');
    box.value = '50'; box.dispatchEvent(new w.Event('input', { bubbles: true }));
    const pays = [...d.querySelectorAll('#spBody [data-pb-pay]')];
    chk(pays.length > 0 && pays.every(x => txt(x.querySelector('.v')) === PBS.money(PBS.cents(50 * +x.dataset.pbPay)) && txt(x.querySelector('.k')) === '$50 pays'), `50 in the Bet amount redraws every suggested level's pays line to 50 times its decimal (${pays.map(x => txt(x)).join(' / ')})`);
    chk(+store().stake === 50, 'the amount is kept in nhl_v1');
    chk(w.eval("stakeRead('$1,250')") === 1250 && w.eval("stakeRead(' 7.555 ')") === 7.56 && w.eval('stakeRead(250000)') === 100000, '"$1,250" reads as 1250, cents kept, $100,000 the most');
    for (const bad of ['abc', '0', '-5', '']) { box.value = bad; box.dispatchEvent(new w.Event('input', { bubbles: true })); box.dispatchEvent(new w.Event('change', { bubbles: true })); chk(+store().stake === 50 && box.value === '50', `"${bad}" leaves the amount at 50 (${store().stake}, box ${box.value})`); }
    chk(w.eval("stakeRead('abc') === null && stakeRead('0') === null && stakeRead('-5') === null && stakeRead('') === null"), 'stakeRead takes no word, zero, minus or blank');
    await wait(300);
    chk($('stake').value === '50', `the builder's stake is the same number (${$('stake').value})`);
    box.value = '20'; box.dispatchEvent(new w.Event('input', { bubbles: true })); box.dispatchEvent(new w.Event('change', { bubbles: true }));
    const e3 = [], w3 = await boot(AT, e3, { store: JSON.stringify({ stake: 'abc' }), hash: 'parlays' });
    chk(w3.document.getElementById('pbStake').value === '20' && w3.document.getElementById('stake').value === '20', 'a stored amount that is not one boots as $20');
    /* Add to builder: asked before replacing other legs; then exactly the level's legs, priced as the level was, on the Parlay Builder */
    const dd = openDays.find(x => TIERS.some(t => S0[x].levels[t[0]] && S0[x].levels[t[0]].legs.length >= 2));
    /* the level with the most legs (nhl v31: a level of any size), so its own size is in the words asked */
    const lv = dd && TIERS.map(t => t[0]).filter(id => S0[dd].levels[id] && S0[dd].levels[id].legs.length >= 2).sort((a, b) => S0[dd].levels[b].legs.length - S0[dd].levels[a].legs.length)[0];
    if (lv) {
      spTab();
      const card = () => { w.eval('renderSuggest()'); return d.querySelector(`#spBody .sp-day[data-sp-day="${dd}"] .pb-tier[data-tier="${lv}"]`); };
      const ids = [...card().querySelectorAll('.pb-tl')].map(x => x.dataset.id), cv = [...card().querySelectorAll('.pb-n')].map(txt);
      /* another leg in the builder first: another level's leg on a game this level does not use */
      const ob = [...d.querySelectorAll(`#spBody .sp-day[data-sp-day="${dd}"] button.sp-add`)].find(b => !ids.some(x => x.split('|')[0] === b.dataset.leg.split('|')[0]));
      if (ob) ob.click(); else console.log(`  every suggested leg of ${dd} is on a game ${lv} uses: the ask before replacing other legs is not reached`);
      const before = JSON.stringify(store().legs), asked0 = w.__asked.length;
      w.__confirm = false; card().querySelector('[data-sp-add]').click();
      chk(ob ? JSON.stringify(store().legs) === before && w.__asked.slice(asked0).includes(`Replace the 1 leg in the builder with the ${TIERS.find(t => t[0] === lv)[1]} ${ids.length}-leg parlay?`) : w.__asked.length === asked0, `Add to builder asks before replacing other legs (and only then), and No changes nothing (${w.__asked.slice(asked0).join(' | ') || 'not asked'})`);
      w.__confirm = true; card().querySelector('[data-sp-add]').focus(); card().querySelector('[data-sp-add]').click();
      chk(JSON.stringify(store().legs.map(l => `${l.game}|${l.side}|${l.kind}`)) === JSON.stringify(ids), `Add to builder puts exactly the level's legs in, in order (${store().legs.length})`);
      chk(!$('tab-parlays').hidden && d.activeElement === $('bTitle'), `Add to builder opens the Parlay Builder and takes the keyboard's focus to the builder (${w.location.hash}; ${d.activeElement && (d.activeElement.id || d.activeElement.tagName)})`);
      const bt = [...d.querySelectorAll('#parlayTotals .stat')].map(txt), lb = S0[dd].levels[lv].b;
      chk(d.querySelectorAll('#legs .leg').length === ids.length, 'the builder shows them');
      chk([...d.querySelectorAll('#legs .leg button.x')].every((x, i) => { const L = sLeg(S.games.find(g => g.id === ids[i].split('|')[0]), ids[i].split('|')[1], ids[i].split('|')[2]); return x.getAttribute('aria-label').includes(`${S.teams[L.g.away].short} @ ${S.teams[L.g.home].short}`); }), `each Remove names its game (${[...d.querySelectorAll('#legs .leg button.x')].map(x => x.getAttribute('aria-label')).join(' | ')})`);
      if (lb) {
        chk(bt[0] && bt[0].startsWith(lb.fair === null ? PBS.pct1(lb.p) : PBS.pct1(lb.fair)) && (lb.fair === null || bt[0].includes(`model says ${PBS.pct1(lb.p)}`)), `the builder's chance is the level's (${bt[0]} vs ${cv[0]})`);
        chk(bt[1] && bt[1].startsWith(PBS.toAm(lb.d)) && cv[1].startsWith(PBS.toAm(lb.d)), `the builder's price is the level's ${PBS.toAm(lb.d)} (${bt[1]})`);
        chk(bt[2] && bt[2].startsWith(PBS.money(PBS.cents(20 * lb.d))) && cv[2].startsWith(PBS.money(PBS.cents(20 * lb.d))), `the builder pays what the level said (${bt[2]} vs ${cv[2]})`);
      }
      chk(/In the builder/.test(txt(card().querySelector('[data-sp-add]'))) && card().querySelector('[data-sp-add]').disabled && [...card().querySelectorAll('button.sp-add')].every(b => b.getAttribute('aria-pressed') === 'true' && txt(b) === 'Added'), "the level's button reads In the builder, and each leg's Added");
      /* the builder: rows, the tiles, the confidence, removing one */
      const legs = store().legs;
      chk(d.querySelectorAll('#legs .leg').length === legs.length, 'a row a leg');
      const sl2 = legs.map(l => sLeg(S.games.find(g => g.id === l.game), l.side, l.kind)).sort(sOrder);
      let p = 1, f = 1; for (const L of sl2) { p *= L.p; f = f === null || L.fair === null ? null : f * L.fair; }
      const conf = c => c >= 0.7 ? 'High' : c >= 0.45 ? 'Medium' : 'Low';
      chk(bt[3] && bt[3].startsWith(conf(f === null ? p : f)) && new RegExp(`on the ${f === null ? "model's" : 'fair'} chance`, 'i').test(bt[3]), `the confidence tile is ${conf(f === null ? p : f)} on the ${f === null ? "model's" : 'fair'} chance (${bt[3]})`);
      /* the price is DraftKings' only where every leg's book is DraftKings (its name in any case and spacing), else the book's */
      const bookLab = sl2.every(L => isDKBook(L.g.line)) ? 'DraftKings price' : 'Book price';
      chk(new RegExp(`(fair chance|model's chance) all ${legs.length} land`, 'i').test(bt[0]) && bt[1].includes(bookLab) && (bookLab === 'DraftKings price' || !/DraftKings price/.test(bt[1])) && /\$20 pays/i.test(bt[2]) && /profit/.test(bt[2]), `the four tiles say what they are (${bt.join(' | ')})`);
      chk(!$('pFinish').disabled, 'Finish parlay is on with two legs or more');
      /* the card from the builder: every leg and the price; Escape, the Tab order, outside click, Start over */
      await cardChecks(w, sl2, 'Your parlay');
      /* a second bet in the same slot of a game (a second side bet, the other side of the total) replaces the first, said, with the
         rule's own words; with no same-game table in the state, one leg a game, said so (Pick your own legs on the level's day) */
      const pd = d.querySelector(`#pbDay button[data-day="${dd}"]`); if (pd && !pd.classList.contains('on')) pd.click();
      const g0 = sl2[0].g, slotK = k => k === 'ou' ? 'tot' : 'side', k0 = sl2[0].kind;
      const alt = ['ml', 'pl', 'ou'].flatMap(k => PBS.SIDES[k].map(s => [s, k])).find(([s, k]) => `${g0.id}|${s}|${k}` !== sl2[0].id && slotK(k) === slotK(k0) && sLeg(g0, s, k));
      const ab = alt && d.querySelector(`#plLines button[data-leg="${g0.id}|${alt[0]}|${alt[1]}"]`);
      if (ab) {
        ab.click();
        const rule = !S.sgp ? 'one leg a game here: this publish carries no same-game table.' : slotK(k0) === 'tot' ? 'one total a game.' : 'one side bet a game (the moneyline or the puck line).';
        chk(store().legs.filter(l => l.game === g0.id).length === 1 && store().legs.some(l => l.game === g0.id && l.side === alt[0] && l.kind === alt[1]), 'a second bet in the same slot of a game replaces the first');
        chk(txt($('bMsg')).includes(` on ${S.teams[g0.away].abbr} @ ${S.teams[g0.home].abbr}: ${rule}`) && /replaced/.test(txt($('bMsg'))) && txt($('slipMsg')).includes(rule), `the replace is said in the builder and the slip bar, with the rule (${txt($('bMsg'))})`);
      } else if (alt) console.log(`  Pick your own legs does not list ${g0.id} on the panel's slate: the replace in a game's slot is held elsewhere`);
      const n0 = d.querySelectorAll('#legs .leg').length;
      d.querySelector('#legs .leg button.x').click();
      chk(d.querySelectorAll('#legs .leg').length === n0 - 1 && store().legs.length === n0 - 1, 'remove takes one leg out');
      while (d.querySelectorAll('#legs .leg').length > 1) d.querySelector('#legs .leg button.x').click();
      chk($('pFinish').disabled && /two legs or more/.test($('pFinish').title) && !$('bHint'), 'Finish parlay is off under two legs, its title says why, and no sentence under it says it again (nhl v25)');
      /* the slip bar on the Games tab and the Suggested Parlays tab, and its button */
      for (const t of ['games', 'suggest']) {
        d.querySelector(`#tabs button[data-tab="${t}"]`).click();
        chk(!$('slip').hidden && /1 leg ·/.test(txt($('slipText'))), `the slip bar is shown on ${t} with a leg (${txt($('slipText'))})`);
      }
      $('slipOpen').click();
      chk(!$('tab-parlays').hidden && w.location.hash === '#parlays', 'Open builder opens the Parlay Builder');
      $('clearParlay').click();
      d.querySelector('#tabs button[data-tab="games"]').click();
      chk($('slip').hidden, 'no slip bar with no legs');
      /* a suggested leg's own Add: one leg in the builder, Added and pressed, the keyboard's focus kept; a second tap takes it out */
      spTab();
      const sb = () => d.querySelector(`#spBody .sp-day[data-sp-day="${dd}"] .pb-tier[data-tier="${lv}"] button.sp-add`), sid = sb().dataset.leg;
      sb().focus(); sb().click();
      chk(store().legs.length === 1 && `${store().legs[0].game}|${store().legs[0].side}|${store().legs[0].kind}` === sid && sb().getAttribute('aria-pressed') === 'true' && txt(sb()) === 'Added' && d.activeElement === sb() && !$('tab-suggest').hidden, `a suggested leg's own Add puts it in the builder, the tab kept and the focus on it (${sid}; ${txt(sb())})`);
      sb().click();
      chk(!store().legs.length && sb().getAttribute('aria-pressed') === 'false', 'a second tap takes it out');
      /* a leg two levels share: its Add in the later level keeps the keyboard there, never on the first copy (a phone's page would jump) */
      const shared = [...d.querySelectorAll(`#spBody .sp-day[data-sp-day="${dd}"] .pb-tier:not([data-tier="safe"]) button.sp-add`)].find(b => d.querySelectorAll(`#spBody .sp-day[data-sp-day="${dd}"] button.sp-add[data-leg="${b.dataset.leg}"]`).length > 1);
      if (shared) {
        const tierS = shared.closest('.pb-tier').dataset.tier, legS = shared.dataset.leg; shared.focus(); shared.click();
        const f = d.activeElement;
        chk(!!f && f.dataset && f.dataset.leg === legS && !!f.closest('.pb-tier') && f.closest('.pb-tier').dataset.tier === tierS && f.getAttribute('aria-pressed') === 'true', `a leg two levels share, added from ${tierS}, keeps the focus on ${tierS}'s Add (${f && f.closest('.pb-tier') ? f.closest('.pb-tier').dataset.tier : f && f.tagName})`);
        if (f && f.dataset && f.dataset.leg === legS) f.click();
      } else console.log(`  no leg shared by two levels of ${dd}: the focus on a shared leg's Add is not held on this state`);
      d.querySelector('#tabs button[data-tab="parlays"]').click();
    }
    /* a level's Finish: the card names the level */
    const fd = openDays.find(x => TIERS.some(t => S0[x].levels[t[0]])), fin = fd && TIERS.map(t => t[0]).find(id => S0[fd].levels[id]);
    if (fin) {
      spTab();
      const fsel = `#spBody [data-sp-finish="${fd}|${fin}"]`;
      d.querySelector(fsel).click();
      const lab = TIERS.find(t => t[0] === fin)[1].toUpperCase() + ' PARLAY';
      chk(!$('pcWin').hidden && txt(d.querySelector('.pc-kick')) === lab, `a level's Finish opens the card as ${lab} (${txt(d.querySelector('.pc-kick'))})`);
      chk($('pcAgain').hidden, 'Start over is the builder\'s only');
      chk(!$('pcOwn'), "the card's window carries no line of description under it (nhl v25)");
      $('pcClose').click();
      chk($('pcWin').hidden && d.activeElement === d.querySelector(fsel), `Close gives the focus back to the level's Finish (${d.activeElement && (d.activeElement.id || d.activeElement.tagName + ' ' + txt(d.activeElement))})`);
      d.querySelector('#tabs button[data-tab="parlays"]').click();
    }
  } else console.log('  no suggested level open on this state (the tab says why): Add to builder, Finish and the builder from a level are held on the made-up slates below');
  /* each fresh game's bets are on its page (nhl v27): a box a priced side, by the leg's own id, at the state's price; none on the card
     itself (the page's every row is held in THE GAME'S PAGE) */
  d.querySelector('#tabs button[data-tab="games"]').click();
  for (const day of [...new Set(S.games.filter(g => !sStarted(g, AT) && sFresh(g)).map(g => g.date))].slice(0, 2)) {
    openDay(d, day);
    for (const g of S.games.filter(x => x.date === day && !sStarted(x, AT) && sFresh(x))) {
      const c = cardOf(d, g.id); if (!c) { chk(false, `no card for ${g.id}`); continue; }
      chk(!c.querySelector('[data-leg]'), `${g.id}: no bet on the card itself, its bets are on its page`);
      const pb = betsOn(d, g); chk(!!pb, `${g.id}: its card opens the game's page on its Game bets`); if (!pb) continue;
      for (const k of PBS.KINDS) for (const s of PBS.SIDES[k]) {
        const L = sLeg(g, s, k), box = pb.querySelector(`input[data-leg="${g.id}|${s}|${k}"]`);
        chk(!!L === !!box, `${g.id} ${s} ${k}: a box exactly where DraftKings prices it`);
        if (L && box) chk(txt(box.closest('tr').querySelector('.book')) === PBS.odds(L.price) && txt(box.closest('tr').querySelector('.est')) === `model ${PBS.pctW(L.p)}` && !!box.closest('tr').querySelector('.pb-valmark') === (L.pick === s), `${g.id} ${s} ${k}: its row shows the state's price and the model's chance, Value on the call's side alone (${txt(box.closest('tr'))})`);
      }
    }
  }
  closeBets(d);
  chk(/\.pb-bet[^{]*\{min-height:44px\}|\.pb-bet,[^{]*\{min-height:44px\}/.test(HTML) || /[^}]*\.pb-bet[^{]*\{[^}]*min-height:44px/.test(HTML), 'a CSS rule gives the bet buttons and the pb-/pc- controls 44px');
  chk(!errors.length, 'no runtime error in the builder boot: ' + errors.join(' | '));
  holdRequests(w, 'the builder boot');
  return levelsOn;
}
/* only state.json and ESPN's scoreboard are read, only GET, only nhl_v1 written */
function holdRequests(w, tag) {
  const bad = w.__requests.filter(r => !(r.url.startsWith('state.json?t=') || r.url.startsWith('https://site.api.espn.com/') || PROPS_RX.test(r.url)) || r.method !== 'GET' || r.cache !== 'no-store');
  chk(!bad.length, `${tag}: the page asks for state.json, ESPN's scoreboard and its DraftKings propBets alone, GET, no-store, each read with its cache-buster (${bad.map(r => r.method + ' ' + r.url).join(', ')})`);
  const keys = [...new Set(w.__writes)].filter(k => k !== 'nhl_v1');
  chk(!keys.length, `${tag}: the page writes nhl_v1 alone (${keys.join(', ')})`);
}
/* the card: opened on these legs; its link, its note, Share, Download, Escape, the Tab order, an outside click, Start over */
async function cardChecks(w, legs, origin) {
  const d = w.document, $ = id => d.getElementById(id), store = () => JSON.parse(w.localStorage.getItem('nhl_v1') || '{}');
  const open = () => { $('pFinish').click(); return !$('pcWin').hidden; };
  chk(open(), 'Finish parlay opens the card');
  const view = txt($('pcView'));
  let dd = 1, p = 1, f = 1; for (const L of legs) { dd *= L.dec; p *= L.p; f = f === null || L.fair === null ? null : f * L.fair; }
  chk(legs.every(L => view.includes(L.who) && view.includes(L.bet) && view.includes(PBS.odds(L.price))) && view.includes(PBS.toAm(dd)), `the card shows every leg and the price ${PBS.toAm(dd)}`);
  chk(txt(d.querySelector('.pc-kick')) === origin.toUpperCase(), `the card names its origin (${txt(d.querySelector('.pc-kick'))})`);
  chk(d.activeElement === ($('pcFile').hidden ? $('pcDown') : $('pcFile')), `the card opens with the focus on Download (${d.activeElement && d.activeElement.id})`);
  /* the Tab order: Close, Open in DraftKings, Share link, Download image, Start over, then each leg's own link */
  const focusables = () => [...$('pcPanel').querySelectorAll('button, a[href]')].filter(x => !x.hidden && !x.disabled && !x.closest('[hidden]')).map(x => x.id || ('leg ' + txt(x)));
  const order = focusables();
  chk(order.slice(0, 5).join(',') === 'pcClose,pcDk,pcLink,pcDown,pcAgain' && order.slice(5).every((x, i) => x === `leg Leg ${i + 1}` || /^leg Leg \d+$/.test(x)), `the Tab order is Close, Open in DraftKings, Share link, Download image, Start over, the legs, each a 44px link named Leg N (${order.join(', ')})`);
  chk([...$('pcNote').querySelectorAll('a[href]')].every(a => w.getComputedStyle(a).minHeight === '44px' && w.getComputedStyle(a).minWidth === '44px'), 'each leg\'s own link is 44px square or more');
  const last = [...$('pcPanel').querySelectorAll('button, a[href]')].filter(x => !x.hidden && !x.closest('[hidden]')).pop();
  last.focus(); d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
  chk(d.activeElement === $('pcClose'), `Tab from the last stays inside: back to Close (${d.activeElement && d.activeElement.id})`);
  $('pcClose').focus(); d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
  chk(d.activeElement === last, 'Shift+Tab from Close goes to the last');
  /* DraftKings: planted ids on these legs' games, then a game's ids gone, a key gone, a number moved, and none */
  const games = [...new Set(legs.map(L => L.game))];
  const saved = games.map(id => w.eval(`JSON.stringify(S.games.find(g => g.id === ${JSON.stringify(id)}).line.dk || null)`));
  const plant = (gid, dk) => w.eval(`(() => { const L = S.games.find(g => g.id === ${JSON.stringify(gid)}).line; if (${JSON.stringify(dk)} === null) delete L.dk; else L.dk = ${JSON.stringify(dk)}; })()`);
  const inv = L => { const n = +String(L.g.id).slice(-6), m = String(86000000 + n), l = L.g.line, c = x => String(Math.round(Math.abs(x) * 100)); const o = { event: String(34000000 + n), homeML: `0ML${m}_1`, awayML: `0ML${m}_3` };
    if (l.homeLine !== null && l.homeLine !== undefined) { o.homePL = `0HC${m}${l.homeLine < 0 ? 'N' : 'P'}${c(l.homeLine)}_1`; o.awayPL = `0HC${m}${l.homeLine < 0 ? 'P' : 'N'}${c(l.homeLine)}_3`; }
    if (l.total !== null && l.total !== undefined) { o.over = `0OU${m}O${c(l.total)}_1`; o.under = `0OU${m}U${c(l.total)}_3`; } return o; };
  const key = L => L.kind === 'ou' ? L.side : L.side + (L.kind === 'ml' ? 'ML' : 'PL');
  const DK = id => 'https://sportsbook.draftkings.com/?outcomes=' + id;
  const dk = L => isDKBook(L.g.line);
  const reopen = () => { d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return open(); };
  const note = () => txt($('pcNote'));
  const noteOk = tag => { const n = note(); chk(!/\ball\b|every leg/i.test(n) && !/\ball\b|every leg/i.test($('pcDk').title), `${tag}: the note and the button never promise every leg (${n.slice(0, 120)})`); chk(!/gateway|preurl|wpcn/.test($('pcDk').href + d.getElementById('pcNote').innerHTML), `${tag}: no gateway, preurl or wpcn in the link`); };
  const ids = legs.map(L => inv(L));
  legs.forEach((L, i) => plant(L.game, Object.assign({}, ids[i])));
  const allDK = legs.every(dk);
  if (allDK) {
    reopen();
    const want = 'https://sportsbook.draftkings.com/?outcomes=' + legs.map((L, i) => encodeURIComponent(ids[i][key(L)])).join('+');
    chk($('pcDk').href === want && txt($('pcDk')) === 'Open in DraftKings', `Open in DraftKings opens the legs' ids in card order (${$('pcDk').href})`);
    const oldest = legs.map(L => L.g.line.at).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
    chk(note().startsWith(`DraftKings' lines as read ${PBS.etRead(oldest)}: Open in DraftKings opens the ${legs.length} legs as DraftKings had them then`), `the note is dated by the oldest read (${note().slice(0, 90)})`);
    noteOk('every leg on the slip');
    /* the Share text: the link alone on its line */
    const shared = [];
    Object.defineProperty(w.navigator, 'share', { value: async data => { shared.push(data); }, configurable: true });
    Object.defineProperty(w.navigator, 'canShare', { value: data => { shared.push({ asked: data }); return true; }, configurable: true });
    $('pcLink').click(); await wait(20);
    const sent = shared.find(x => !x.asked), asked = shared.find(x => x.asked);
    chk(sent && !('url' in sent) && asked && asked.asked.title === sent.title && asked.asked.text === sent.text, 'Share link sends {title, text}, no url, and asks canShare about the same');
    if (sent) {
      chk(/^\d+-leg parlay [+-]\d+$/.test(sent.title) && sent.title === `${legs.length}-leg parlay ${PBS.toAm(dd)}`, `the title is "${legs.length}-leg parlay ${PBS.toAm(dd)}" (${sent.title})`);
      const lines = legs.map((L, i) => `${i + 1}. ${L.who}: ${L.bet} (${PBS.odds(L.price)})`).concat([
        `Stake ${PBS.money(20)} · Pays ${PBS.money(PBS.cents(20 * dd))}`,
        f === null ? `Model's chance all ${legs.length} land ${PBS.pct1(p)} · the price says ${PBS.pct1(1 / dd)}` : `Fair chance all ${legs.length} land ${PBS.pct1(f)} · model says ${PBS.pct1(p)} · the price says ${PBS.pct1(1 / dd)}`,
        `DraftKings betslip (opens the ${legs.length} legs as DraftKings had them):`, want,
        `DraftKings lines as read ${PBS.etRead(oldest)}: a leg whose line DraftKings has moved or pulled since will not be on the slip, so check it before you bet`,
        'demon-x13.github.io/nhl-hub']);
      chk(sent.text === lines.join('\n'), `the Share text, line by line: ${JSON.stringify(sent.text).slice(0, 400)} vs ${JSON.stringify(lines.join('\n')).slice(0, 400)}`);
    }
    /* a cancel copies nothing; no share sheet, one that cannot share, one that fails: copied, by the clipboard or the hidden box */
    const copied = [];
    Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async t => { copied.push(['clip', t]); } }, configurable: true });
    Object.defineProperty(w.navigator, 'share', { value: async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e; }, configurable: true });
    $('pcLink').click(); await wait(20);
    chk(!copied.length, 'a cancelled share copies nothing');
    Object.defineProperty(w.navigator, 'share', { value: async () => { throw new Error('no'); }, configurable: true });
    $('pcLink').click(); await wait(20);
    Object.defineProperty(w.navigator, 'canShare', { value: () => false, configurable: true });
    $('pcLink').click(); await wait(20);
    Object.defineProperty(w.navigator, 'share', { value: undefined, configurable: true });
    $('pcLink').click(); await wait(20);
    chk(copied.length === 3 && copied.every(c => c[1] === (sent && sent.text)) && txt($('pcMsg')) === 'Link copied', `a failed share, one that cannot share and none at all copy the same text (${copied.length}, "${txt($('pcMsg'))}")`);
    Object.defineProperty(w.navigator, 'clipboard', { value: undefined, configurable: true });
    w.document.execCommand = cmd => { const ta = d.activeElement; copied.push(['box', cmd === 'copy' && ta && ta.tagName === 'TEXTAREA' ? ta.value : null]); return true; };
    $('pcLink').click(); await wait(20);
    chk(copied.length === 4 && copied[3][0] === 'box' && copied[3][1] === (sent && sent.text) && !d.querySelector('#pcPanel textarea'), 'with no clipboard the hidden box copies the same text, and is taken away');
    /* one game's ids gone, one key gone, a number moved */
    if (legs.length >= 3) {
      plant(legs[2].game, null); reopen();
      chk(new RegExp(`opens ${legs.length - 1} of the ${legs.length} legs`).test(note()) && /no DraftKings ids were read for its game/.test(note()) && $('pcDk').href.split('+').length === legs.length - 1, `a game with no ids: named, ${legs.length - 1} of ${legs.length} opened (${note().slice(0, 160)})`);
      noteOk('a game with no ids');
      Object.defineProperty(w.navigator, 'share', { value: async data => { shared.push(data); }, configurable: true });
      Object.defineProperty(w.navigator, 'canShare', { value: () => true, configurable: true });
      $('pcLink').click(); await wait(20);
      const t2 = shared[shared.length - 1].text || '';
      chk(t2.includes(`DraftKings betslip (opens ${legs.length - 1} of the ${legs.length} legs as DraftKings had them; add leg 3 by hand):`) && t2.includes('Add by hand at DraftKings:\n3. ' + legs[2].who + ' ' + legs[2].bet + ' (no DraftKings id was read for its game)'), `the Share text names the leg to add by hand: ${JSON.stringify(t2).slice(0, 300)}`);
      plant(legs[2].game, Object.assign({}, ids[2]));
      const k1 = Object.assign({}, ids[1]); delete k1[key(legs[1])]; plant(legs[1].game, k1); reopen();
      chk(/not among the DraftKings ids read for its game/.test(note()), 'a key gone: "not among the DraftKings ids read for its game"');
      plant(legs[1].game, Object.assign({}, ids[1]));
      const mv = legs.find(L => L.kind !== 'ml');
      if (mv) {
        const i = legs.indexOf(mv), k2 = Object.assign({}, ids[i]), kk = key(mv);
        k2[kk] = mv.kind === 'pl' ? k2[kk].replace(/([NP])(\d+)_/, (m, s, n) => `${s}${+n + 100}_`) : k2[kk].replace(/([OU])(\d+)_/, (m, s, n) => `${s}${+n + 100}_`);
        plant(mv.game, k2); reopen();
        chk(/DraftKings had it at .* when its lines were last read \(/.test(note()) && !$('pcDk').href.includes(encodeURIComponent(k2[kk])), `a number moved: "DraftKings had it at …", not linked (${note().slice(0, 200)})`);
        noteOk('a number moved');
        plant(mv.game, Object.assign({}, ids[i]));
      }
    }
    /* the note dated by the oldest read: a carried id's own date */
    const old = new Date(PUB - 5 * 3600000).toISOString();
    plant(legs[0].game, Object.assign({}, ids[0], { at: old })); reopen();
    chk(note().startsWith(`DraftKings' lines as read ${PBS.etRead(old)}:`), `the note is dated by the oldest dk.at || line.at (${note().slice(0, 70)})`);
    for (const L of legs) plant(L.game, null); reopen();
    chk(txt($('pcDk')) === 'Open DraftKings' && $('pcDk').href === 'https://sportsbook.draftkings.com/leagues/hockey/nhl' && /add the legs by hand/.test(note()), `no ids: Open DraftKings, DraftKings' NHL page (${$('pcDk').href})`);
    noteOk('no ids');
  } else console.log('  a leg priced at a book other than DraftKings: the DraftKings link checks skipped');
  games.forEach((id, i) => plant(id, JSON.parse(saved[i])));
  reopen();
  /* Download: the card drawn by context calls alone, never a remote image, saved under its name */
  const rec = [], downloads = [];
  w.HTMLCanvasElement.prototype.getContext = function () { const self = this; return new Proxy({}, { get(t, k) { if (k === 'canvas') return self; if (k === 'measureText') return s => ({ width: String(s).length * 7 }); if (k in t) return t[k]; return (...a) => { rec.push([k, a]); if (k === 'drawImage') rec.push(['REMOTE', a]); }; }, set(t, k, v) { t[k] = v; return true; } }); };
  w.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new w.Blob(['png'], { type: 'image/png' })); };
  w.URL.createObjectURL = () => 'blob:card'; w.URL.revokeObjectURL = () => {};
  const click = w.HTMLAnchorElement.prototype.click;
  w.HTMLAnchorElement.prototype.click = function () { if (this.download) downloads.push(this.download); else click.call(this); };
  $('pcDown').click(); await wait(50);
  const drawn = rec.filter(r => r[0] === 'fillText').map(r => String(r[1][0])).join(' | ');
  chk(!rec.some(r => r[0] === 'REMOTE'), 'the image draws no remote picture');
  chk(legs.every(L => drawn.includes(L.who)) && drawn.includes(PBS.toAm(dd)), `the image holds every leg and the price: ${drawn.slice(0, 200)}`);
  chk(downloads.length === 1 && /^nhl-parlay-\d{4}-\d{2}-\d{2}-\d+legs\.png$/.test(downloads[0]) && downloads[0] === `nhl-parlay-${etDate(Date.parse(legs.map(L => L.start).sort()[0]))}-${legs.length}legs.png`, `saved as ${downloads[0]}`);
  w.HTMLAnchorElement.prototype.click = click;
  /* Escape closes it and gives the focus back; an outside click closes it; Start over empties the builder */
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  chk($('pcWin').hidden && d.activeElement === $('pFinish'), `Escape closes the card and gives the focus back (${d.activeElement && d.activeElement.id})`);
  open(); $('pcClose').click();
  chk($('pcWin').hidden && d.activeElement === $('pFinish'), `Close closes the card and gives the focus back to the button that opened it (${d.activeElement && (d.activeElement.id || d.activeElement.tagName)})`);
  open(); $('pcWin').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  chk($('pcWin').hidden, 'a click outside closes it');
  const kept = JSON.stringify(store().legs);
  open(); chk(JSON.stringify(store().legs) === kept && !(store().saved || []).some(s => false), 'finishing saves nothing');
  const keepLegs = store().legs;
  $('pcAgain').click();
  chk($('pcWin').hidden && store().legs.length === 0, 'Start over empties the builder and closes the card');
  chk(d.activeElement === $('bTitle'), `Start over leaves the focus on the builder's heading, not the page (${d.activeElement && (d.activeElement.id || d.activeElement.tagName)})`);
  w.localStorage.setItem('nhl_v1', JSON.stringify(Object.assign(store(), { legs: keepLegs })));
  w.eval('P = load(); rerender();');
}
const isDKBook = line => String(line && line.book || '').toLowerCase().replace(/\s+/g, '') === 'draftkings';

/* the builder at the clock's edges and on made-up copies of the state: a puck drop, a stale line, a whole-number total,
   the store an older page wrote or a junk one, and the panel's empty states */
async function parlayEdges() {
  const real = S, legOn = (g, side, kind) => { const L = sLeg(g, side, kind); return L && { game: g.id, side, kind, odds: L.price, line: L.num, p: L.p, label: L.mu, text: L.who, date: g.date }; };
  const firstLeg = g => { for (const k of PBS.KINDS) for (const s of PBS.SIDES[k]) { const l = legOn(g, s, k); if (l) return l; } return null; };
  const fresh = S.games.filter(g => !sStarted(g, PUB) && sFresh(g)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  /* at a puck drop: the game in no level, no tile, no list, no card button, and out of the builder, said; then the next one, by the watch */
  if (fresh.length >= 2) {
    const next = fresh[0], at = Date.parse(next.start) + 60000, later = fresh.find(g => Date.parse(g.start) > at && g.id !== next.id);
    const legs = [firstLeg(next)].concat(later ? [firstLeg(later)] : []).filter(Boolean);
    const errs = [], w = await boot(at, errs, { store: JSON.stringify({ legs, ui: { tab: 'parlays' } }), hash: 'parlays' }), d = w.document;
    const nowStarted = S.games.filter(g => sStarted(g, at) && !sStarted(g, PUB));
    const nowhere = (g, tag) => {
      chk(![...d.querySelectorAll('#pbBody .t30-r')].some(x => x.dataset.id.startsWith(g.id + '|')), `${tag}: ${g.away}@${g.home}, started, is in no line of the Top 30`);
      w.eval('renderSuggest()');
      chk(!d.querySelector(`#spBody button[data-leg^="${g.id}|"]`), `${tag}: ${g.away}@${g.home}, started, offers no suggested leg to add`);
      chk(!d.querySelector(`#pbGrid [data-g="${g.id}"]`), `${tag}: ${g.away}@${g.home} is not in the Games fold`);
      chk(!d.querySelector(`#plLines .pb-pg[data-id="${g.id}"]`) && !d.querySelector(`#plLines button[data-leg^="${g.id}|"]`), `${tag}: ${g.away}@${g.home} is not in Pick your own legs`);
      chk(!JSON.parse(w.localStorage.getItem('nhl_v1')).legs.some(l => l.game === g.id), `${tag}: ${g.away}@${g.home} is out of the builder`);
    };
    for (const g of nowStarted) nowhere(g, 'at the puck drop');
    chk(/left the builder: the puck dropped\./.test(txt(d.getElementById('bMsg'))), `a builder leg on a game that has started leaves it, said: ${txt(d.getElementById('bMsg'))}`);
    if (later) {
      const at2 = Date.parse(later.start) + 60000;
      const listed = [...new Set([...d.querySelectorAll('#pbBody .t30-r')].map(x => x.dataset.id.split('|')[0]))];
      /* the clock past the next puck drop before the watch has looked. On the Suggested Parlays tab a level of a day still open finishes at
         once (another day's puck drop cannot change it); one of the day that puck drop locked only redraws its day, locked, opening
         nothing, the keyboard on the tab's heading */
      d.querySelector('#tabs button[data-tab="suggest"]').click();
      w.__setClock(at2);
      const fin = f => [...d.querySelectorAll('#spBody [data-sp-finish]')].find(b => f(b.dataset.spFinish.split('|')[0]));
      const okF = fin(dd => sDayOpen(dd, at2));
      if (okF) {
        okF.click();
        chk(!d.getElementById('pcWin').hidden, `${okF.dataset.spFinish}'s Finish opens the card though a game of another day has dropped the puck since the tab was drawn`);
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      const hitF = fin(dd => !sDayOpen(dd, at2));
      if (hitF) {
        const key = hitF.dataset.spFinish, dd = key.split('|')[0]; hitF.focus(); hitF.click();
        const sec = d.querySelector(`#spBody .sp-day[data-sp-day="${dd}"]`);
        chk(d.getElementById('pcWin').hidden && !!sec && sec.dataset.spState !== 'open' && !d.querySelector(`#spBody [data-sp-finish="${key}"]`), `${key}'s Finish, its day's first puck drop passed, opens nothing and redraws the day locked (${sec && sec.dataset.spState})`);
        chk(d.activeElement === d.getElementById('spTitle'), `the keyboard's focus goes to the tab's heading, the level gone (${d.activeElement && (d.activeElement.id || d.activeElement.tagName)})`);
      }
      /* the Top 30, drawn again: the lines of a game that dropped the puck since it was drawn are gone, said. The line holds only while
         the panel stays on the day shown. A puck drop that leaves that day no game to come moves the panel on, and it says so in its
         place (PHI @ BUF and FLA @ OTT, 21 October 2026, both at 7:30 PM Eastern, were the whole day). With no day left to move to,
         or with the day shown keeping games but no fresh line while the next day has lines, it says neither */
      d.querySelector('#tabs button[data-tab="parlays"]').click();
      const held = listed.map(id => S.games.find(g => g.id === id)).filter(g => g && sStarted(g, at2));
      const names = held.map(g => `${S.teams[g.away].abbr} @ ${S.teams[g.home].abbr}`);
      const slA = sSlate(at), slB = sSlate(at2), same = slA.dates.join() === slB.dates.join();
      const emptied = slA.dates.length > 0 && slA.dates.every(dd => !slB.on(dd).length);
      const gone = names.length ? (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]) + ` dropped the puck: ${names.length > 1 ? 'their' : 'its'} lines left the list.` : null;
      const moved = !same && emptied && slB.dates.length ? `Every game on ${slA.dates.map(dd => PBS.day(dd)).join(' and ')} has dropped the puck: the panel moved to ${slB.text}.` : null;
      const said = same ? gone : moved, notes = txt(d.getElementById('pbNotes'));
      chk((said === null || notes.includes(said)) && (same || !notes.includes('lines left the list')) && (moved !== null || !notes.includes('has dropped the puck: the panel moved')),
        `and the panel says why: ${said !== null ? `"${said}"` : same ? 'nothing, no line of the list on a game started' : slB.dates.length ? `nothing, the panel on ${slB.text} while ${slA.text} keeps games with no fresh line` : 'nothing, no day left to move to'} (${notes.slice(0, 160)})`);
      d.dispatchEvent(new w.Event('visibilitychange'));
      for (const g of S.games.filter(g => sStarted(g, at2) && !sStarted(g, at))) nowhere(g, 'the watch, at the next puck drop');
      chk(/puck dropped/.test(txt(d.getElementById('bMsg'))), 'the watch says why the leg left');
      const sl = sSlate(at2);
      chk(txt(d.getElementById('pbSlate')) === (sl.text || 'no games'), `after the watch the slate is ${sl.text} (${txt(d.getElementById('pbSlate'))})`);
      holdSuggest(w, at2, 'past the next puck drop');
    }
    chk(!errs.length, 'no runtime error at the puck drop: ' + errs.join(' | '));
    holdRequests(w, 'the puck-drop boot');
  } else console.log('  fewer than two fresh games to come: the puck-drop checks of the builder skipped');
  /* a level's Finish once its day's first puck drop has passed (the tab drawn before it, the watch not yet looked): it opens nothing and
     redraws the day locked, the keyboard on the tab's heading; a level of the next day, still open, finishes at once */
  {
    const T0 = PUB + 60000, open0 = sSpDays(T0).filter(dd => sDayOpen(dd, T0)), D1 = open0[0], lk = D1 ? sLockAt(D1) : Infinity;
    if (D1 && isFinite(lk)) {
      const errs = [], w = await boot(T0, errs, { hash: 'suggest' }), d = w.document, f1 = d.querySelector(`#spBody [data-sp-finish^="${D1}|"]`);
      if (f1) {
        const at = lk + 60000, key = f1.dataset.spFinish; w.__setClock(at);
        const other = open0.slice(1).find(dd => sDayOpen(dd, at)), f2 = other && d.querySelector(`#spBody [data-sp-finish^="${other}|"]`);
        if (f2) {
          f2.click();
          chk(!d.getElementById('pcWin').hidden, `${f2.dataset.spFinish}'s Finish opens the card though ${D1}'s first puck drop has passed since the tab was drawn`);
          d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        } else console.log(`  no other day open past ${D1}'s first puck drop: a level of another day finishing at once is not held here`);
        const b1 = d.querySelector(`#spBody [data-sp-finish="${key}"]`); b1.focus(); b1.click();
        const sec = d.querySelector(`#spBody .sp-day[data-sp-day="${D1}"]`);
        chk(d.getElementById('pcWin').hidden && !!sec && sec.dataset.spState !== 'open' && !d.querySelector(`#spBody [data-sp-finish="${key}"]`), `${key}'s Finish, its day's first puck drop passed, opens nothing and redraws the day locked (${sec && sec.dataset.spState})`);
        chk(d.activeElement === d.getElementById('spTitle'), `the keyboard's focus goes to the tab's heading, the level gone (${d.activeElement && (d.activeElement.id || d.activeElement.tagName)})`);
        holdSuggest(w, at, `past ${D1}'s first puck drop`);
      } else console.log(`  no level open on ${D1}: a Finish across its lock is not held on this state`);
      chk(!errs.length, 'no runtime error across a day\'s lock: ' + errs.join(' | '));
    } else console.log('  no open day to lock: a Finish across its lock is not held on this state');
  }
  /* a × pressed after a puck drop and before the watch's next look takes out the leg its row names, never the one now at its place:
     three legs, the first on the next game to drop the puck; the clock passes that puck drop with no look, and the second row's × is
     pressed. The started game's leg leaves at its puck drop, said; the third stays */
  {
    const A = fresh[0], tA = A ? Date.parse(A.start) : 0, two = A ? fresh.filter(g => Date.parse(g.start) > tA + 60000).slice(0, 2) : [];
    const legs = A ? [firstLeg(A)].concat(two.map(firstLeg)).filter(Boolean) : [];
    if (legs.length === 3) {
      const errs = [], w = await boot(Math.max(PUB, tA - 60000), errs, { store: JSON.stringify({ legs, ui: { tab: 'parlays' } }), hash: 'parlays' }), d = w.document;
      const rows = () => [...d.querySelectorAll('#legs .leg')].map(x => x.dataset.id), r0 = rows();
      w.__setClock(tA + 6000);
      const x1 = d.querySelectorAll('#legs .leg button.x')[1], lab = x1 ? x1.getAttribute('aria-label') : '';
      if (x1) x1.click();
      const left = (JSON.parse(w.localStorage.getItem('nhl_v1')).legs || []).map(l => `${l.game}|${l.side}|${l.kind}`);
      chk(r0.length === 3 && r0[0].startsWith(A.id + '|') && !!x1 && canon(left) === canon([r0[2]]) && canon(rows()) === canon([r0[2]]) && /left the builder: the puck dropped\./.test(txt(d.getElementById('bMsg'))), `a × pressed after ${A.id}'s puck drop, before the watch looks, takes out the leg it names ("${lab}"), the started game's leg leaving, said, and the third kept (rows ${r0.join(', ')}; stored after ${left.join(', ')})`);
      chk(!errs.length, 'no runtime error on a × pressed past a puck drop: ' + errs.join(' | '));
    } else console.log('  no three fresh games with two after the next puck drop: the × past a puck drop not held');
  }
  /* the slate moving on: a page open past the last puck drop of the day shown says the panel moved, and the line goes once
     that day is over (Eastern), the watch redrawing the panel for it alone */
  {
    const sl1 = sSlate(PUB + 60000), day = sl1.pick, last = day && sl1.dates.length === 1 ? sl1.on(day).map(g => Date.parse(g.start)).sort((a, b) => b - a)[0] : null;
    const at2 = last ? last + 60000 : null, sl2 = at2 ? sSlate(at2) : null;
    if (sl2 && sl2.dates.length && !sl2.dates.includes(day)) {
      const errs = [], w = await boot(PUB + 60000, errs, { hash: 'parlays' }), d = w.document;
      w.__setClock(at2); d.dispatchEvent(new w.Event('visibilitychange'));
      const said = `Every game on ${PBS.day(day)} has dropped the puck: the panel moved to ${sl2.text}.`;
      chk(txt(d.getElementById('pbSlate')) === sl2.text && txt(d.getElementById('pbNotes')).includes(said), `past the last puck drop of ${day} the panel moves to ${sl2.text} and says so (${txt(d.getElementById('pbNotes')).slice(0, 120)})`);
      const midnight = Date.parse(PBS.nextDay(day) + 'T05:05:00Z');   // just after midnight Eastern, EST or EDT
      if (midnight > at2 && sSlate(midnight).dates.join() === sl2.dates.join()) {
        w.__setClock(midnight); d.dispatchEvent(new w.Event('visibilitychange'));
        chk(!txt(d.getElementById('pbNotes')).includes('has dropped the puck: the panel moved'), `once ${day} is over the line goes (${txt(d.getElementById('pbNotes')).slice(0, 120)})`);
      }
      d.querySelector('#tabs button[data-tab="games"]').click();
      const first = d.querySelector('#gamesList').firstElementChild;
      d.dispatchEvent(new w.Event('visibilitychange')); d.dispatchEvent(new w.Event('visibilitychange'));
      chk(d.querySelector('#gamesList').firstElementChild === first, 'the watch does not redraw the Games tab for a line of the panel');
      chk(!errs.length, 'no runtime error as the slate moves on: ' + errs.join(' | '));
    } else console.log(`  the slate shown (${sl1.text}) does not move on at its last puck drop: the move-on checks skipped`);
  }
  /* a made-up state: one line an hour stale, one total on a whole number; the stale one offered nowhere, the whole one in no level but priced by hand.
     All three games are of one offered day, the one with the most lines, chosen in the Day control, so the day stays the one shown with its line staled */
  const sl0 = sSlate(PUB + 60000), freshOn = dd => fresh.filter(g => g.date === dd);
  const D = sl0.days.slice().sort((a, b) => freshOn(b).length - freshOn(a).length || (a < b ? -1 : 1)).find(dd => freshOn(dd).length);
  if (D) {
    const M = JSON.parse(STATE), byId = id => M.games.find(g => g.id === id), onD = freshOn(D);
    const st = byId(onD[0].id), wh = onD[1] ? byId(onD[1].id) : null, third = onD[2] ? byId(onD[2].id) : null;
    st.line.at = new Date(PUB - 3600000).toISOString().slice(0, 16) + 'Z'; if (st.line.dk) delete st.line.dk;
    const whole = !!wh && wh.line.total !== null && wh.line.total !== undefined && !!wh.ou;
    /* the whole total made the likeliest leg on the slate were its push not ruled out: 85%, 5 points over a -400 price */
    if (whole) { wh.line.total = Math.round(wh.line.total + 0.5); wh.line.overOdds = -400; wh.line.underOdds = 300; wh.ou = { over: 0.85, push: 0.05, under: 0.1 }; wh.ouEdge = { over: 0.05, under: -0.15 }; wh.ouPick = 'over'; if (wh.line.dk) { delete wh.line.dk.over; delete wh.line.dk.under; } }
    S = M;
    try {
      const errs = [], w = await boot(PUB + 60000, errs, { state: JSON.stringify(M), store: JSON.stringify({ ui: { pb: { day: D } } }), hash: 'parlays' }), d = w.document;
      chk(sSlate(PUB + 60000, D).dates.includes(D) && txt(d.getElementById('pbSlate')) === sSlate(PUB + 60000, D).text, `the Day control keeps ${D}, the day of the stale line, shown (${txt(d.getElementById('pbSlate'))})`);
      w.eval('renderSuggest()');
      chk(![...d.querySelectorAll('#pbBody .t30-r, #spBody .sp-day[data-sp-state="open"] .pb-tl')].some(x => x.dataset.id.startsWith(st.id + '|')) && !d.querySelector(`#plLines button[data-leg^="${st.id}|"]`) && !d.querySelector(`#pbGrid input[data-g="${st.id}"]`), 'a stale line is offered nowhere on the Parlay Builder');
      const stTile = [...d.querySelectorAll('#pbGrid .pb-g.no')].find(x => txt(x).startsWith(`${S.teams[st.away].abbr} @ ${S.teams[st.home].abbr}`));
      chk(!!stTile && /line not on DraftKings at the last run/.test(txt(stTile)), `its tile says its line was not on DraftKings at the last run (${stTile ? txt(stTile) : 'no tile'})`);
      holdPanel(w, PUB + 60000, 'a stale line and a whole-number total'); holdSuggest(w, PUB + 60000, 'a stale line and a whole-number total');
      if (whole) {
        chk(![...d.querySelectorAll('#pbBody .t30-r, #spBody .sp-day[data-sp-state="open"] .pb-tl')].some(x => x.dataset.id.startsWith(wh.id + '|') && /\|ou$/.test(x.dataset.id)), 'a whole-number total is in no level and no line of the Top 30');
        const b = d.querySelector(`#plLines button[data-leg="${wh.id}|over|ou"]`), o = () => third && d.querySelector(`#plLines button[data-leg^="${third.id}|"]`);
        chk(!!b, 'a whole-number total is offered by hand');
        if (b && o()) {
          b.click(); o().click();
          chk(d.querySelectorAll('#legs .leg').length === 2 && /Over \d+ goals/.test(txt(d.getElementById('legs'))), 'added by hand, the builder shows it');
          chk(d.getElementById('slip').hidden, 'no slip bar on the Parlay Builder tab while the builder is in view');
          d.getElementById('pFinish').click();
          chk(!d.getElementById('pcWin').hidden && new RegExp(`Over ${wh.line.total} goals`).test(txt(d.getElementById('pcView'))), 'and the card prices it');
          d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        }
      }
      d.querySelector('#tabs button[data-tab="games"]').click();
      openDay(d, st.date);
      const c = cardOf(d, st.id);
      if (c) { const bad = rowWrongs(w, c, st, PUB + 60000, pageMap(w), null); chk(!bad.length, `the stale game's row is the state's (${bad.slice(0, 3).join(' | ')})`); }
      /* its page draws the line's prices with no box, and says why under the bets and in its status line */
      const badS = c ? gpWrongs(w, st, PUB + 60000, null, { noPlayers: true }) : ['no card'], vS = d.getElementById('gameView');
      chk(!badS.length && !vS.querySelector('input[data-leg]') && vS.querySelectorAll('.gbets .book').length > 0 && txt(vS.querySelector('.gbets .gp-why')) === `Line from ${clockOf(Date.parse(st.line.at))}: not on DraftKings at the last run.`, `a stale line's page offers no bet and says why (${badS.slice(0, 2).join(' | ')}; ${txt(vS.querySelector('.gbets .gp-why'))})`);
      closeBets(d);
      chk(!errs.length, 'no runtime error on a stale line: ' + errs.join(' | '));
    } finally { S = real; }
  }
  /* a made-up state with one game priced at another book (its links ESPN BET's, so no DraftKings id) and one with no book named: their legs
     are offered like any other, but the price is never called DraftKings' and no DraftKings link is made for them */
  if (D && freshOn(D).length >= 2) {
    const M = JSON.parse(STATE), onD = freshOn(D), ob = M.games.find(g => g.id === onD[0].id), nb = M.games.find(g => g.id === onD[1].id);
    ob.line.book = 'ESPN BET'; delete ob.line.dk; nb.line.book = null;
    /* with the same-game table there (the job's next publish), so it is the other book alone that keeps these games to one leg */
    const Cg = readJSON(path.join(DATA, 'corr.json')); if (!M.sgp && Cg) M.sgp = { rho: Cg.rho, hold: Cg.hold, measured: Cg.measured || null };
    S = M;
    try {
      const legs = [firstLeg(ob), firstLeg(nb)].filter(Boolean);
      const errs = [], w = await boot(PUB + 60000, errs, { state: JSON.stringify(M), store: JSON.stringify({ legs, ui: { pb: { day: D } } }), hash: 'parlays' }), d = w.document;
      holdPanel(w, PUB + 60000, 'another book'); holdSuggest(w, PUB + 60000, 'another book');
      chk(d.querySelectorAll('#legs .leg').length === legs.length, `another book: its legs are in the builder (${d.querySelectorAll('#legs .leg').length} of ${legs.length})`);
      const bt = [...d.querySelectorAll('#parlayTotals .stat')].map(txt);
      chk(!!bt[1] && bt[1].includes('Book price') && !/DraftKings/.test(bt[1]), `another book: the price tile is the book's, never DraftKings' (${bt[1]})`);
      chk(!/DraftKings' parlay price|as DraftKings had them/.test(txt(d.getElementById('bNotes'))), `another book: the builder's notes do not call the price DraftKings' (${txt(d.getElementById('bNotes'))})`);
      if (legs.length === 2) {
        d.getElementById('pFinish').click();
        const head = txt(d.querySelector('.pc-head')), note = txt(d.getElementById('pcNote')), dkA = d.getElementById('pcDk');
        chk(!d.getElementById('pcWin').hidden && /the book's price/.test(head) && !/DraftKings' price/.test(head), `another book: the card calls it the book's price (${head})`);
        chk(txt(dkA) === 'Open DraftKings' && dkA.href === 'https://sportsbook.draftkings.com/leagues/hockey/nhl', `another book: no DraftKings link, its NHL page (${dkA.href})`);
        chk(/priced at ESPN BET, not DraftKings/.test(note) && /priced at the book, not DraftKings/.test(note), `another book: the note names each book (${note.slice(0, 220)})`);
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      /* one leg a game at another book, the same-game table there or not: a second leg of the game, of a kind the same-game rule would take
         beside the first (its total beside a side bet, a side bet beside its total), takes the first's place, said */
      const slotK = k => k === 'ou' ? 'ou' : 'side', l0 = legs.find(l => l.game === ob.id), sec = l0 && PBS.KINDS.flatMap(k => PBS.SIDES[k].map(sd => [sd, k])).find(([sd, k]) => slotK(k) !== slotK(l0.kind) && legOn(ob, sd, k));
      const sb = sec && d.querySelector(`#plLines button[data-leg="${ob.id}|${sec[0]}|${sec[1]}"]`), muO = `${S.teams[ob.away].abbr} @ ${S.teams[ob.home].abbr}`;
      if (!sb) chk(!sec, `another book: Pick your own legs offers ${ob.id}'s ${sec && sec.join(' ')}`);
      else {
        sb.click();
        const mine = JSON.parse(w.localStorage.getItem('nhl_v1')).legs.filter(l => l.game === ob.id), said = txt(d.getElementById('bMsg')) + ' | ' + txt(d.getElementById('slipMsg'));
        chk(!!M.sgp && mine.length === 1 && mine[0].kind === sec[1] && mine[0].side === sec[0] && said.includes(`on ${muO}: one leg a game here: its lines are at ESPN BET, and a same-game parlay is priced here on DraftKings' prices alone.`),
          `another book, with the same-game table there: a second leg of ${ob.id} (${sec.join(' ')}) takes the first's place, one leg a game, said (${mine.map(l => l.side + ' ' + l.kind).join(', ')}; ${said.slice(0, 220)})`);
      }
      chk(!errs.length, 'no runtime error with another book: ' + errs.join(' | '));
    } finally { S = real; }
  }
  /* on the Games tab: stored legs on a game started and on one off the schedule leave the builder at once, said, and the watch then
     redraws nothing for them; a leg at a number DraftKings has moved since is not shown as in the parlay, and leaves, said */
  {
    const over = S.games.filter(g => sStarted(g, PUB + 60000) && g.line && firstLeg(g)).slice(-1)[0];
    const gone = { game: '999999902', side: 'home', kind: 'ml', odds: -110, line: null, p: 0.5, label: 'MTL @ BOS', date: '2026-10-02' };
    const mv = fresh.find(g => g.line.total !== null && g.line.total !== undefined && g.ou && sLeg(g, 'under', 'ou'));
    const keep = fresh.find(g => g !== mv && firstLeg(g));
    const legs = [over && firstLeg(over), gone].concat(mv ? [Object.assign(legOn(mv, 'under', 'ou'), { line: mv.line.total - 1 })] : [], keep ? [firstLeg(keep)] : []).filter(Boolean);
    const errs = [], w = await boot(PUB + 60000, errs, { store: JSON.stringify({ legs, ui: { tab: 'games' } }), hash: 'games' }), d = w.document;
    const st = JSON.parse(w.localStorage.getItem('nhl_v1')).legs;
    chk(st.length === (keep ? 1 : 0) && (!keep || st[0].game === keep.id), `on the Games tab, stored legs on a game started, one off the schedule${mv ? ' and one at a moved total' : ''} leave the builder at once (${st.map(l => l.game).join(', ')})`);
    if (keep) chk(!d.getElementById('slip').hidden && /left the builder/.test(txt(d.getElementById('slipMsg'))), `the slip bar says why (${txt(d.getElementById('slipMsg'))})`);
    let first = d.querySelector('#gamesList').firstElementChild;
    d.dispatchEvent(new w.Event('visibilitychange')); d.dispatchEvent(new w.Event('visibilitychange'));
    chk(d.querySelector('#gamesList').firstElementChild === first, 'the watch does not redraw the Games tab for legs already gone');
    if (mv) {
      const b = betIn(d, mv, `${mv.id}|under|ou`);
      chk(!!b && !b.checked && !b.closest('tr').classList.contains('on'), `a leg stored at a total DraftKings has moved since is not shown as in the parlay (${b && txt(b.closest('tr'))})`);
      closeBets(d);
      d.querySelector('#tabs button[data-tab="parlays"]').click();
      chk(/left the builder: DraftKings' total is now /.test(txt(d.getElementById('bMsg'))), `and the builder says why (${txt(d.getElementById('bMsg'))})`);
      d.querySelector('#tabs button[data-tab="games"]').click();
    }
    /* the clock past the kept leg's puck drop: it leaves once, said, and the Games tab is redrawn no more than once */
    if (keep) {
      w.__setClock(Date.parse(keep.start) + 60000);
      d.dispatchEvent(new w.Event('visibilitychange'));
      chk(!JSON.parse(w.localStorage.getItem('nhl_v1')).legs.length, 'past its puck drop, the leg leaves the builder on the Games tab');
      const first2 = d.querySelector('#gamesList').firstElementChild;
      d.dispatchEvent(new w.Event('visibilitychange')); d.dispatchEvent(new w.Event('visibilitychange'));
      chk(d.querySelector('#gamesList').firstElementChild === first2, 'and the watch redraws the Games tab once, not again and again');
    }
    chk(!errs.length, 'no runtime error on the Games tab with legs gone: ' + errs.join(' | '));
  }
  /* every stored leg gone at load, on the Games tab: the slip bar says why though no leg is left, and the builder still
     says it when next opened, after a reload; said there once, it is taken out of the store */
  {
    const gone = { game: '999999902', side: 'home', kind: 'ml', odds: -110, line: null, p: 0.5, label: 'MTL @ BOS', date: '2026-10-02' };
    const errs = [], w = await boot(PUB + 60000, errs, { store: JSON.stringify({ legs: [gone], ui: { tab: 'games' } }), hash: 'games' }), d = w.document;
    const st = JSON.parse(w.localStorage.getItem('nhl_v1'));
    chk(!st.legs.length && !d.getElementById('slip').hidden && /No legs in the builder/.test(txt(d.getElementById('slipText'))) && /MTL @ BOS left the builder: it is no longer on the schedule\./.test(txt(d.getElementById('slipMsg'))), `a builder emptied at load shows the slip bar with why (${txt(d.getElementById('slip'))})`);
    const e2 = [], w2 = await boot(PUB + 60000, e2, { store: w.localStorage.getItem('nhl_v1'), hash: 'parlays' });
    chk(/MTL @ BOS left the builder: it is no longer on the schedule\./.test(txt(w2.document.getElementById('bMsg'))), `after a reload the builder still says why the leg left (${txt(w2.document.getElementById('bMsg'))})`);
    chk(JSON.parse(w2.localStorage.getItem('nhl_v1')).ui.bmsg === undefined, 'and, said, the reason leaves the store');
    chk(!errs.length && !e2.length, 'no runtime error when the builder empties at load: ' + errs.concat(e2).join(' | '));
  }
  /* a saved leg on a game called off: void, and written into the leg the first time the page sees the game in `removed`, so it
     holds on the next state, which no longer lists it */
  {
    const fin1 = S.games.filter(g => g.state === 'final' && g.hs !== null && g.hs !== g.as).slice(-1)[0];
    const off = { id: '999999903', date: '2026-10-12', home: 'BOS', away: 'MTL', why: 'postponed' };
    const sp = { id: 'pp1', at: '2026-10-11T12:00:00.000Z', stake: 10, legs: [{ game: off.id, side: 'home', kind: 'ml', odds: -150, line: null, p: 0.6, label: 'MTL @ BOS', text: 'Bruins to win', date: off.date }].concat(fin1 ? [{ game: fin1.id, side: 'home', kind: 'ml', odds: 120, line: null, p: 0.5, label: `${fin1.away} @ ${fin1.home}`, text: 'to win', date: fin1.date }] : []), am: '+150', p: 0.3, imp: 0.4 };
    const M = JSON.parse(STATE); M.removed = (M.removed || []).concat([off]);
    const legWord = w => txt([...w.document.querySelectorAll('#savedList .saved')].find(x => x.querySelector('[data-del="pp1"]')) || { textContent: '' });
    const errs = [], w = await boot(PUB + 60000, errs, { state: JSON.stringify(M), store: JSON.stringify({ saved: [sp], ui: { tab: 'parlays' } }), hash: 'parlays' });
    const stLeg = (JSON.parse(w.localStorage.getItem('nhl_v1')).saved.find(x => x.id === 'pp1') || { legs: [] }).legs[0] || {};
    chk(/void: called off/.test(legWord(w)) && stLeg.void && stLeg.void.why === 'postponed', `a saved leg on a game called off is void, and the void is kept in the leg (${JSON.stringify(stLeg.void)})`);
    const e2 = [], w2 = await boot(PUB + 60000, e2, { store: w.localStorage.getItem('nhl_v1'), hash: 'parlays' });
    const card = legWord(w2), won = fin1 && fin1.hs > fin1.as;
    chk(/void: called off/.test(card) && !/not on the schedule/.test(card), `on a state no longer listing it, the leg is still void (${card.slice(0, 160)})`);
    if (fin1) chk(won ? /won · \$22\.00/.test(card) : /lost/.test(card), `and the parlay is settled on the leg left (${card.slice(0, 120)})`);
    chk(!errs.length && !e2.length, 'no runtime error grading a game called off: ' + errs.concat(e2).join(' | '));
  }
  /* the store: an older page's legs and saved parlays boot, draw and grade; a junk one boots */
  const fin = S.games.filter(g => g.state === 'final' && g.hs !== null).slice(-2);
  const v6legs = fresh.slice(0, 2).map(firstLeg).filter(Boolean);
  const savedLeg = g => ({ game: g.id, side: 'home', kind: 'ml', odds: -120, line: null, p: 0.55, label: `${g.away} @ ${g.home}`, text: `${g.home} ML`, date: g.date });
  const v6 = { legs: v6legs, saved: [], ui: { tab: 'parlays' } };
  if (fin.length === 2) v6.saved.push({ id: 'v6a', at: '2026-10-01T12:00:00.000Z', stake: 10, legs: fin.map(savedLeg), am: '+264', p: 0.3, imp: 0.29 });
  v6.saved.push({ id: 'v6b', at: '2026-10-02T12:00:00.000Z', stake: 10, legs: [savedLeg({ id: '999999901', away: 'MTL', home: 'BOS', date: '2026-10-02' })].concat(fresh.length ? [savedLeg(fresh[0])] : []), am: '+264', p: 0.3, imp: 0.29 });
  {
    const errs = [], w = await boot(PUB + 60000, errs, { store: JSON.stringify(v6), hash: 'parlays' }), d = w.document;
    chk(d.querySelectorAll('#legs .leg').length === v6legs.length, `an older page's builder boots and draws (${d.querySelectorAll('#legs .leg').length} of ${v6legs.length})`);
    chk(d.querySelectorAll('#savedList .saved').length === v6.saved.length, 'and its saved parlays');
    if (fin.length === 2) {
      const won = fin.every(g => g.hs > g.as);
      const card = [...d.querySelectorAll('#savedList .saved')].find(x => x.querySelector('[data-del="v6a"]'));
      chk(card && (won ? /won/ : /lost/).test(txt(card.querySelector('.top'))), `a saved parlay on two finals is graded ${won ? 'won' : 'lost'}: ${card && txt(card.querySelector('.top'))}`);
      const st = JSON.parse(w.localStorage.getItem('nhl_v1')).saved.find(s => s.id === 'v6a');
      chk(st && st.graded && st.graded.status === (won ? 'win' : 'loss'), 'its grade is kept in its own entry');
    }
    const gone = [...d.querySelectorAll('#savedList .saved')].find(x => x.querySelector('[data-del="v6b"]'));
    chk(gone && /not on the schedule/.test(txt(gone)) && !/pending/.test(txt(gone.querySelector('.top'))), `a leg on a game not on the schedule reads "not on the schedule", and its parlay is not pending: ${gone && txt(gone.querySelector('.top'))}`);
    w.__confirm = false; gone.querySelector('[data-del]').click();
    chk(d.querySelectorAll('#savedList .saved').length === v6.saved.length && w.__asked.includes('Delete this saved parlay?'), 'Delete asks first, and No keeps it');
    w.__confirm = true; d.querySelector('#savedList [data-del="v6b"]').click();
    chk(!JSON.parse(w.localStorage.getItem('nhl_v1')).saved.some(s => s.id === 'v6b'), 'Yes deletes it');
    chk(!errs.length, 'no runtime error on an older store: ' + errs.join(' | '));
    holdRequests(w, 'an older store');
  }
  for (const [tag, junk] of [['junk', '{"legs":"x","saved":{},"ui":null,"stake":"abc"}'], ['a junk leg', JSON.stringify({ legs: [{ game: fresh[0] ? fresh[0].id : '1', side: 'home', kind: 'zz' }, { game: 5, side: 'home', kind: 'ml' }, null], saved: [null, { legs: 'x' }, { id: 'z', legs: [{ game: '1', side: 'over', kind: 'ml', odds: 'x' }] }], ui: { pb: { k: 'x', off: [1, 'a', '12345'], day: 7 } } })], ['not JSON', '{nope']]) {
    const errs = [], w = await boot(PUB + 60000, errs, { store: junk, hash: 'parlays' });
    chk(!errs.length && w.document.querySelectorAll('#legs .leg').length === 0, `a ${tag} store boots with no runtime error and no leg: ${errs.join(' | ')}`);
  }
  /* the panel's empty states, on made-up copies: no games; every game started; no line; a two-game night */
  const madeUp = async (tag, M, at) => {
    S = M;
    try { const errs = [], w = await boot(at, errs, { state: JSON.stringify(M), hash: 'parlays' }); holdPanel(w, at, tag); holdSuggest(w, at, tag); chk(!errs.length, `${tag}: no runtime error: ${errs.join(' | ')}`); }
    finally { S = real; }
  };
  const copy = () => JSON.parse(STATE);
  { const M = copy(); M.games = []; await madeUp('no games', M, PUB + 60000); }
  if (S.games.length) await madeUp('every game started', copy(), Date.parse(S.games[S.games.length - 1].start) + 3600000);
  { const M = copy(); for (const g of M.games) if (g.state === 'pre' && g.line) { g.line = null; delete g.mlPick; delete g.plPick; delete g.ouPick; } await madeUp('no line', M, PUB + 60000); }
  if (fresh.length >= 3) {
    /* every game of the slate alike: the home side to win at 60% on -110 (a call), the away puck line at 62% on -150 and the under at 50% on
       +100 (thin): every level is the likeliest of any size at its price, and each a tie broken by the leg ids */
    const M = copy(), day = fresh[0].date;
    for (const g of M.games) if (g.date === day && g.state === 'pre' && Date.parse(g.start) > PUB && g.line && Math.floor(Date.parse(g.line.at) / 60000) === Math.floor(PUB / 60000)) {
      Object.assign(g.line, { homeML: -110, awayML: 100, homeLine: 1.5, homeSpreadOdds: 125, awaySpreadOdds: -150, total: 5.5, overOdds: -120, underOdds: 100 }); delete g.line.dk;
      Object.assign(g, { pHome: 0.6, mlEdge: { home: 0.076, away: -0.1 }, mlPick: 'home', cover: { home: 0.38, push: 0, away: 0.62 }, plEdge: { home: -0.064, away: 0.02 }, plPick: null, ou: { over: 0.5, push: 0, under: 0.5 }, ouEdge: { over: -0.045, under: 0 }, ouPick: null });
    }
    await madeUp('every game alike', M, PUB + 60000);
  }
  if (fresh.length >= 2) {
    const M = copy(), keep = new Set(fresh.filter(g => g.date === fresh[0].date).slice(0, 2).map(g => g.id));
    for (const g of M.games) if (g.state === 'pre' && g.line && !keep.has(g.id) && Math.floor(Date.parse(g.line.at) / 60000) === Math.floor(PUB / 60000)) { g.line = null; delete g.mlPick; delete g.plPick; delete g.ouPick; }
    await madeUp('a two-game night', M, PUB + 60000);
  }
}

/* ================= REFRESH ODDS =================
   The page reads DraftKings' lines from ESPN itself on a press of Refresh odds, in memory alone. Held here with rules
   written again: the two buttons (44px, keyboard reachable) and their status lines; no ESPN request for it on load, on the
   watch or on a tab; a press on a scoreboard this smoke answers from the state (a moneyline flipped, a puck line and a
   total moved, a first line, a game with no odds, a day ESPN does not answer, ids carried from an answer with none, a
   puck drop while ESPN is read) leaving exactly the lines, edges, sides and chances the job's rules give, the Games
   cards, the levels by brute force, the builder and the card's DraftKings link on them, and nothing stored; a second
   press reading again and one during a read doing nothing; a failed, a junk and an older read changing nothing, worded.
   The page's parse is held equal to the job's (tools/espn.js) on the recorded answers in tools/fixtures, variants of
   them and the answers this run saved (NHL_OUT, else tools/out), and the page's goals layer to tools/elo.js's */
const E = require('./espn'), ELO = require('./elo');
const SB_URL = 'https://site.api.espn.com/apis/site/v2/sports/hockey/nhl/scoreboard';
const canon = x => JSON.stringify(x, (k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce((o, kk) => { o[kk] = v[kk]; return o; }, {}) : v);
const addD = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const clockOf = ms => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
/* the days a press reads: the Day select's (slDaysS, THE GAMES LIST) from today on, with a game still to come */
function sOddsDays(ms) {
  const today = etDate(ms), shown = slDaysS(ms).filter(d => d >= today);
  return [...new Set(S.games.filter(g => shown.includes(g.date) && !sStarted(g, ms)).map(g => g.date))].sort();
}
/* an answer in ESPN's own shape: each price a string, each outcome's link DraftKings' gateway wrapping the betslip URL */
const amS = n => n === null || n === undefined ? undefined : (n > 0 ? '+' + n : String(n));
const gateway = (ev, id) => 'https://sportsbook.draftkings.com/gateway?s=__s__&wpsrc=413&wpcn=ESPN&wpscn=Widget&preurl=' + encodeURIComponent(`https://sportsbook.draftkings.com/event/${ev}` + (id ? `?outcomes=${id}` : ''));
function idsFor(L, ev, mk) {
  const pl = n => `${n < 0 ? 'N' : 'P'}${Math.round(Math.abs(n) * 100)}`, o = { event: ev, homeML: `0ML${mk}_1`, awayML: `0ML${mk}_3` };
  if (L.homeLine !== null && L.homeLine !== undefined) { o.homePL = `0HC${mk}${pl(L.homeLine)}_1`; o.awayPL = `0HC${mk}${pl(-L.homeLine)}_3`; }
  if (L.total !== null && L.total !== undefined) { o.over = `0OU${mk}O${Math.round(L.total * 100)}_1`; o.under = `0OU${mk}U${Math.round(L.total * 100)}_3`; }
  return o;
}
function espnOdds(L, ids, book) {
  const at = (o, k) => Object.assign(o, ids && ids[k] ? { link: { href: gateway(ids.event, ids[k]) } } : {});
  const o = { provider: { id: '100', name: book === undefined ? 'DraftKings' : book } };
  if (L.total !== null && L.total !== undefined) o.overUnder = L.total;
  if (L.homeLine !== null && L.homeLine !== undefined) o.spread = L.homeLine;
  o.moneyline = { home: { close: at({ odds: amS(L.homeML) }, 'homeML') }, away: { close: at({ odds: amS(L.awayML) }, 'awayML') } };
  if (L.homeLine !== null && L.homeLine !== undefined) o.pointSpread = { home: { close: at({ line: PBS.line(L.homeLine), odds: amS(L.homeSpreadOdds) }, 'homePL') }, away: { close: at({ line: PBS.line(-L.homeLine), odds: amS(L.awaySpreadOdds) }, 'awayPL') } };
  if (L.total !== null && L.total !== undefined) o.total = { over: { close: at({ line: 'o' + L.total, odds: amS(L.overOdds) }, 'over') }, under: { close: at({ line: 'u' + L.total, odds: amS(L.underOdds) }, 'under') } };
  return o;
}
const espnEvent = (g, odds, status) => ({ id: g.id, date: g.start, season: { year: S.season, type: g.type || 2 }, competitions: [{ date: g.start, neutralSite: !!g.neutral,
  status: { type: status || { name: 'STATUS_SCHEDULED', state: 'pre', description: 'Scheduled', shortDetail: '' } },
  competitors: [{ homeAway: 'home', team: { id: E.CLUBS[g.home].id, abbreviation: g.home }, score: '0' }, { homeAway: 'away', team: { id: E.CLUBS[g.away].id, abbreviation: g.away }, score: '0' }],
  odds: odds ? [odds] : [] }] });
/* the call's parts on a line, by the job's callOf: the moneyline's edges and side; the puck line's and the total's chances
   kept where the number holds and from tools/elo.js's goals layer where it moved, their edges and sides; a market whose
   number and prices all hold kept whole */
function sCall(row, L) {
  const r3 = x => +x.toFixed(3), imp = am => am === null || am === undefined ? null : PBS.imp(am), out = {}, EDGE = S.edge;
  const G = () => ELO.goals(row.xt, row.mu, row.diff, (S.model && S.model.pull) || 0);
  const ih = imp(L.homeML), ia = imp(L.awayML);
  if (ih !== null && ia !== null) { out.mlEdge = { home: r3(row.pHome - ih), away: r3(1 - row.pHome - ia) }; out.mlPick = out.mlEdge.home >= EDGE ? 'home' : out.mlEdge.away >= EDGE ? 'away' : null; }
  if (L.homeLine !== null && L.homeLine !== undefined) {
    const keep = row.line && row.cover && row.line.homeLine === L.homeLine, cp = keep ? { cover: row.cover.home, push: row.cover.push, lose: row.cover.away } : ELO.coverProbs(G(), L.homeLine);
    out.cover = { home: r3(cp.cover), push: r3(cp.push), away: r3(cp.lose) };
    const jh = imp(L.homeSpreadOdds), ja = imp(L.awaySpreadOdds);
    if (jh !== null && ja !== null) { out.plEdge = { home: r3(cp.cover - jh), away: r3(cp.lose - ja) }; out.plPick = out.plEdge.home >= EDGE ? 'home' : out.plEdge.away >= EDGE ? 'away' : null; }
  }
  if (L.total !== null && L.total !== undefined) {
    const keep = row.line && row.ou && row.line.total === L.total, tp = keep ? { over: row.ou.over, push: row.ou.push, under: row.ou.under } : ELO.totalProbs(G(), L.total);
    out.ou = { over: r3(tp.over), push: r3(tp.push), under: r3(tp.under) };
    const jo = imp(L.overOdds), ju = imp(L.underOdds);
    if (jo !== null && ju !== null) { out.ouEdge = { over: r3(tp.over - jo), under: r3(tp.under - ju) }; out.ouPick = out.ouEdge.over >= EDGE ? 'over' : out.ouEdge.under >= EDGE ? 'under' : null; }
  }
  /* a market whose number and both prices hold keeps the row's parts as they are */
  for (const [pk, ck] of [[['homeML', 'awayML'], ['mlEdge', 'mlPick']], [['homeLine', 'homeSpreadOdds', 'awaySpreadOdds'], ['cover', 'plEdge', 'plPick']], [['total', 'overOdds', 'underOdds'], ['ou', 'ouEdge', 'ouPick']]])
    if (row.line && pk.every(k => row.line[k] === L[k])) for (const k of ck) { if (row[k] === undefined) delete out[k]; else out[k] = row[k]; }
  return out;
}
const DERIVED = ['mlEdge', 'mlPick', 'cover', 'plEdge', 'plPick', 'ou', 'ouEdge', 'ouPick'];
const pageGames = w => JSON.parse(w.eval('JSON.stringify(S.games)'));
const espnReqs = w => w.__requests.filter(r => r.url.includes('espn.com') && !PROPS_RX.test(r.url));      // the scoreboard's (and anything else at ESPN but the props)
const propReqs = w => w.__requests.filter(r => PROPS_RX.test(r.url) || /propBets/i.test(r.url));
async function oddsDone(w) { for (let i = 0; i < 300 && w.eval('ODDS.busy'); i++) await wait(10); return !w.eval('ODDS.busy'); }
/* the status line's words after a read, written here again from its counts */
function sOddsText(r, at) {
  const when = sDayClock(at), n = (k, one, many) => `${k} ${k === 1 ? one : many}`;      // with its weekday (nhl v31): "read Thu 9:12 PM EST"
  if (!r.answered) return `ESPN could not be read at ${when}: ${r.lined ? 'every line stands as shown' : 'nothing changed'}.`;
  let t = r.read ? `${r.allDK ? "DraftKings' lines" : 'Lines'} from ESPN, read ${when}: ${n(r.read, 'game', 'games')}${r.moved ? `, ${r.moved} moved since the last read` : ''}${r.first ? `, ${r.first} with a first line` : ''}.`
    : r.noLine || r.unread || r.started || r.postponed || r.cancelled || r.older ? `Lines from ESPN, read ${when}: none taken.` : `Lines from ESPN, read ${when}: no game on the days shown has a line yet.`;
  const stand = [r.noLine ? `${n(r.noLine, 'game', 'games')} had no line at ESPN` : '', r.unread ? `${n(r.unread, 'game', 'games')} could not be read` : ''].filter(Boolean);
  if (stand.length) t += ` ${stand.join(' and ')}: ${r.noLine + r.unread > 1 ? 'their published lines stand' : 'its published line stands'}.`;
  if (r.started) t += ` ${n(r.started, 'game', 'games')} dropped the puck during the read: left as published.`;
  const off = (r.postponed || 0) + (r.cancelled || 0);
  if (off) t += ` ${n(off, 'game is', 'games are')} ${r.postponed && r.cancelled ? 'postponed or cancelled' : r.postponed ? 'postponed' : 'cancelled'} at ESPN: ${off > 1 ? 'their published lines stand' : 'its published line stands'} until the job takes ${off > 1 ? 'them' : 'it'} off.`;
  if (r.older) t += ` ${n(r.older, 'game', 'games')} kept ${r.older > 1 ? 'their lines' : 'its line'}: the line shown was read later than this (is this device's clock behind?).`;
  const silent = r.silent || [];
  if (silent.length) t += ` ESPN did not answer for ${silent.length > 2 ? `${silent.length} of the ${r.days} days` : silent.map(PBS.day).join(' or ')}.`;
  return t;
}

/* the props read's sentence after the lines', written here again from its counts */
function sPropsText(q) {
  if (!q || !q.asked) return '';
  const n = (k, one, many) => `${k} ${k === 1 ? one : many}`, parts = [];
  if (q.got) parts.push(`${n(q.got, 'game', 'games')} read (${n(q.lines, 'main line', 'main lines')})`);
  if (q.none) parts.push(`${n(q.none, 'game', 'games')} with none posted yet`);
  if (q.failed) parts.push(`${n(q.failed, 'game', 'games')} could not be read${q.kept ? ` (${n(q.kept, 'earlier read', 'earlier reads')} kept)` : ''}`);
  if (q.started) parts.push(`${n(q.started, 'game', 'games')} started: not shown`);
  if (q.off) parts.push(`${n(q.off, 'game', 'games')} called off at ESPN: not shown`);
  return ` DraftKings' player props: ${parts.join(', ')}.`;
}
/* the games a press reads props for: still to come at the press on the days it reads, and today or tomorrow (Eastern) */
const sPropsAsk = ms => { const days = sOddsDays(ms), last = addD(etDate(ms), 1); return S.games.filter(g => days.includes(g.date) && g.date <= last && !sStarted(g, ms)); };
/* every game asked answered ESPN's 404: none posted yet */
const sPropsNone = ms => { const k = sPropsAsk(ms).length; return { asked: k, none: k }; };

/* the page's parse against the job's, and its goals layer against tools/elo.js's, in a window of the page */
function oddsParity(w) {
  const pageOdds = comps => JSON.parse(w.eval(`JSON.stringify(${JSON.stringify(comps)}.map(c => ESPN.oddsOf(c)))`));
  let compared = 0, priced = 0, withIds = 0; const bad = [];
  const holdEvents = (events, tag) => {
    const rows = []; for (const ev of events || []) { let r = null; try { r = E.gameRow(ev); } catch (e) { r = null; } if (r && !r.gone) rows.push([ev, r]); }
    if (!rows.length) return;
    const page = pageOdds(rows.map(([ev]) => ev.competitions[0]));
    rows.forEach(([ev, r], i) => { compared++; if (r.odds) priced++; if (r.odds && r.odds.dk) withIds++; if (canon(page[i]) !== canon(r.odds)) bad.push(`${tag} ${ev.id}: page ${canon(page[i]).slice(0, 160)} vs job ${canon(r.odds).slice(0, 160)}`); });
  };
  /* the recorded answers, and variants of each priced event in shapes ESPN has sent or may send */
  const FIX = readJSON(path.join(__dirname, 'fixtures', 'espn_scoreboard.json'));
  chk(!!FIX && FIX.answers && Object.values(FIX.answers).some(a => (a.events || []).some(e => (e.competitions[0].odds || []).length)), 'tools/fixtures/espn_scoreboard.json holds recorded answers with odds');
  const recorded = FIX ? Object.values(FIX.answers).flatMap(a => a.events || []) : [];
  holdEvents(recorded, 'recorded');
  const variants = ev => {
    const c = () => JSON.parse(JSON.stringify(ev)), o = x => x.competitions[0].odds[0], out = [];
    const links = x => { const r = []; const walk = v => { if (v && typeof v === 'object') { if (typeof v.href === 'string' && /draftkings/i.test(v.href)) r.push(v); for (const k of Object.keys(v)) walk(v[k]); } }; walk(o(x)); return r; };
    let x;
    x = c(); for (const l of links(x)) delete l.href; o(x).provider.name = 'Draft Kings'; out.push(x);                         // no links, the book spaced
    x = c(); for (const l of links(x)) l.href = l.href.replace(/%3Foutcomes%3D[^&]*/i, ''); out.push(x);                       // links naming the event alone
    x = c(); for (const l of links(x)) l.href = l.href.replace(/outcomes%3D[^&]*/i, 'outcomes%3DXYZ123'); out.push(x);          // ids in an unknown shape
    x = c(); for (const l of links(x)) l.href = l.href.replace(/O(\d+)_1/, 'O975_1').replace(/N(\d+)_1/, 'N250_1'); out.push(x); // ids on another number
    x = c(); links(x).forEach((l, i) => { l.href = i % 3 === 0 ? 'not a url' : i % 3 === 1 ? 'https://example.com/event/1?outcomes=0ML1_1' : 'https://sportsbook.draftkings.com/gateway?preurl=%E0%A4%A'; }); out.push(x);
    x = c(); delete o(x).pointSpread; out.push(x);                                                                             // the spread and the favourite alone
    x = c(); delete o(x).pointSpread; o(x).homeTeamOdds = { favorite: false }; out.push(x);
    x = c(); if (o(x).moneyline) { o(x).moneyline.home.close.odds = 'EVEN'; o(x).moneyline.away.close.odds = ''; } out.push(x);
    x = c(); o(x).overUnder = String(o(x).overUnder); out.push(x);
    x = c(); delete o(x).overUnder; delete o(x).total; out.push(x);
    x = c(); delete o(x).moneyline; delete o(x).pointSpread; delete o(x).spread; delete o(x).overUnder; out.push(x);          // nothing priced
    x = c(); delete o(x).provider; out.push(x);
    x = c(); x.competitions[0].odds = []; out.push(x);
    x = c(); x.competitions[0].odds = [null]; out.push(x);
    x = c(); x.competitions[0].odds = 'x'; out.push(x);
    x = c(); { const ml = o(x).moneyline, ps = o(x).pointSpread;                                                                // the favourite flipped, its ids with it
      if (ml) { const h = ml.home.close.odds; ml.home.close.odds = ml.away.close.odds; ml.away.close.odds = h; }
      if (ps) { for (const s of ['home', 'away']) { const cl = ps[s].close; cl.line = String(cl.line).startsWith('-') ? String(cl.line).replace('-', '+') : String(cl.line).replace('+', '-'); if (cl.link && cl.link.href) cl.link.href = cl.link.href.replace(/([NP])(\d+_[13])/, (m, a, b) => (a === 'N' ? 'P' : 'N') + b); } } }
    out.push(x);
    return out;
  };
  const vs = recorded.filter(e => (e.competitions[0].odds || []).length).flatMap(variants);
  holdEvents(vs, 'variant');
  /* the answers this run saved: the job's own reads of today's ESPN (or the simulation's fabricated ones) */
  const OUTDIR = process.env.NHL_OUT || (process.env.NHL_STATE ? null : path.join(__dirname, 'out'));
  let saved = 0;
  if (OUTDIR && fs.existsSync(OUTDIR)) for (const f of fs.readdirSync(OUTDIR).filter(f => /^sb_\d{4}-\d{2}-\d{2}\.json$/.test(f))) { const j = readJSON(path.join(OUTDIR, f)); if (j && Array.isArray(j.events)) { saved++; holdEvents(j.events, f); } }
  chk(!bad.length, `the page's parse of ESPN's odds is the job's (tools/espn.js gameRow) on every event (${bad.length} differ: ${bad.slice(0, 2).join(' | ')})`);
  chk(compared > 0 && priced > 0 && withIds > 0, `the parse is compared on events with odds and with DraftKings' ids (${compared} events, ${priced} priced, ${withIds} with ids)`);
  console.log(`  the page's parse equals the job's on ${compared} events (${priced} priced, ${withIds} with DraftKings ids; ${recorded.length} recorded, ${vs.length} variants, ${saved} saved answers)`);
  /* dkHref on every link in the recorded answers and on links that are not DraftKings', not URLs or not strings */
  const hrefs = []; const walk = v => { if (v && typeof v === 'object') { if (typeof v.href === 'string') hrefs.push(v.href); for (const k of Object.keys(v)) walk(v[k]); } }; walk(recorded);
  const junk = ['', 'not a url', 'https://example.com/?preurl=https%3A%2F%2Fsportsbook.draftkings.com%2Fevent%2F1%3Foutcomes%3D0ML1_1', 'https://sportsbook.draftkings.com/event/34827963?outcomes=0ML86733611_1', 'https://sportsbook.draftkings.com/gateway?preurl=%E0%A4%A', 'https://sportsbook.draftkings.com/gateway?preurl=https%3A%2F%2Fevil.example%2Fevent%2F1', 'https://SPORTSBOOK.DraftKings.com/event/9?outcomes=0OU1O650_1'];
  const all = [...new Set(hrefs)].concat(junk), page = JSON.parse(w.eval(`JSON.stringify(${JSON.stringify(all)}.concat([null, 7, {}]).map(h => ESPN.dkHref(h)))`)), job = all.concat([null, 7, {}]).map(h => E.dkHref(h));
  chk(canon(page) === canon(job), `the page's dkHref is the job's on ${job.length} links (${job.length - 3} strings, null, a number and an object)`);
  /* the carry rule: the page's ESPN.carryDk is tools/espn.js's carryDk, which update.js reads every line through, field for
     field on every pairing of a line before (full ids, dated or not, an event alone, moneylines alone, none, another book,
     the book spaced or unnamed) with a line read now (ESPN's own ids, an event alone, the same or another event, none; the
     book DraftKings, spaced, another or unnamed; the puck line and the total held, moved or gone) */
  {
    const ids0 = { event: '34827963', homeML: '0ML86733611_1', awayML: '0ML86733611_3', homePL: '0HC86733620N150_1', awayPL: '0HC86733620P150_3', over: '0OU86733629O650_1', under: '0OU86733629U650_3' };
    const base = { book: 'DraftKings', homeML: -150, awayML: 125, homeLine: -1.5, homeSpreadOdds: 170, awaySpreadOdds: -205, total: 6.5, overOdds: -110, underOdds: -110, at: '2026-10-15T12:00:00.000Z' };
    const prevs = [null, Object.assign({}, base, { dk: Object.assign({}, ids0) }), Object.assign({}, base, { dk: Object.assign({}, ids0, { at: '2026-10-14T20:00:00.000Z' }) }), Object.assign({}, base, { dk: { event: ids0.event } }),
      Object.assign({}, base, { dk: { homeML: ids0.homeML, awayML: ids0.awayML } }), Object.assign({}, base, { dk: { event: ids0.event, over: ids0.over, under: ids0.under } }), Object.assign({}, base),
      Object.assign({}, base, { book: 'FanDuel', dk: Object.assign({}, ids0) }), Object.assign({}, base, { book: 'Draft Kings', dk: Object.assign({}, ids0) }), Object.assign({}, base, { book: null, dk: Object.assign({}, ids0) })];
    const dks = [undefined, { event: ids0.event }, { event: '99999999' }, { event: ids0.event, homeML: '0ML55555555_1', awayML: '0ML55555555_3' }, { over: '0OU55555556O550_1' }];
    const cases = [];
    for (const prev of prevs) for (const dk of dks) for (const book of ['DraftKings', 'Draft Kings', 'FanDuel', null]) for (const homeLine of [-1.5, 1.5, null]) for (const total of [6.5, 5.5, null]) {
      const line = Object.assign({}, base, { book, homeLine, total, at: '2026-10-15T23:30:00.000Z', refreshed: true }); if (dk) line.dk = Object.assign({}, dk);
      cases.push([line, prev]);
    }
    const pageC = JSON.parse(w.eval(`JSON.stringify(${JSON.stringify(cases)}.map(([l, p]) => ESPN.carryDk(l, p)))`));
    const jobC = cases.map(([l, p]) => E.carryDk(JSON.parse(JSON.stringify(l)), p === null ? null : JSON.parse(JSON.stringify(p))));
    const differ = cases.map((c, i) => i).filter(i => canon(pageC[i]) !== canon(jobC[i]));
    const hows = {}; for (const r of jobC) hows[r.how] = (hows[r.how] || 0) + 1;
    chk(!differ.length && hows.read && hows.carried && hows.event && hows.none, `the page's carry rule is the job's (tools/espn.js carryDk) on ${cases.length} cases (${Object.entries(hows).map(([k, v]) => `${v} ${k}`).join(', ')}; ${differ.length} differ${differ.length ? `, e.g. page ${canon(pageC[differ[0]]).slice(0, 200)} vs job ${canon(jobC[differ[0]]).slice(0, 200)}` : ''})`);
  }
  /* the goals layer: the page's MODEL is tools/elo.js's, number for number */
  const grid = []; for (const t of [4.5, 5.5, 6.25, 7.5]) for (const mu of [-2.2, -0.5, 0, 0.73, 2]) for (const diff of [-180, 0, 95]) for (const pull of [0, 0.22]) grid.push([t, mu, diff, pull]);
  const lines = [-2.5, -1.5, -1, 0, 1, 1.5, 2.5], tots = [4.5, 5, 5.5, 6, 6.5, 7];
  const pageG = w.eval(`JSON.stringify(${JSON.stringify(grid)}.map(([t, mu, d, p]) => { const G = MODEL.goals(t, mu, d, p); return [G, ${JSON.stringify(lines)}.map(l => MODEL.coverProbs(G, l)), ${JSON.stringify(tots)}.map(l => MODEL.totalProbs(G, l))]; }))`);
  const jobG = JSON.stringify(grid.map(([t, mu, d, p]) => { const G = ELO.goals(t, mu, d, p); return [G, lines.map(l => ELO.coverProbs(G, l)), tots.map(l => ELO.totalProbs(G, l))]; }));
  chk(pageG === jobG, `the page's goals layer is tools/elo.js's, number for number, on ${grid.length} games and ${lines.length + tots.length} lines each`);
  /* and on the state: the page's goals layer gives the published chances back on every line from the row's own total, margin and gap.
     Those are stored to the hundredth and the chances to the thousandth, so a published chance must lie within the range the page's layer
     gives over its inputs' rounding (each of xt, mu and diff at -0.005, 0 and +0.005), less or more half a thousandth. A flat 0.001 held
     the player model's calls, whose total and margin are rounded before the job prices them, but failed a team Elo call (no lineup, the
     inputs full-precision): the job's run of 17 October 2026 stopped on a made-up playoff game's over, published 0.357, given back 0.3559
     from the rounded inputs and 0.3551 to 0.3567 over their rounding */
  const rows = S.games.filter(g => g.line && ((g.cover && g.line.homeLine !== null && g.line.homeLine !== undefined) || (g.ou && g.line.total !== null && g.line.total !== undefined)) && isFinite(g.xt) && isFinite(g.mu) && isFinite(g.diff));
  if (rows.length) {
    const back = JSON.parse(w.eval(`JSON.stringify(${JSON.stringify(rows.map(g => [g.xt, g.mu, g.diff, g.line.homeLine, g.line.total]))}.map(([t, mu, d, hl, tot]) => { const r = []; for (const a of [-0.005, 0, 0.005]) for (const b of [-0.005, 0, 0.005]) for (const c of [-0.005, 0, 0.005]) { const G = MODEL.goals(t + a, mu + b, d + c, (S.model && S.model.pull) || 0), cp = MODEL.coverProbs(G, hl), tp = MODEL.totalProbs(G, tot); r.push([cp.cover, cp.lose, tp.over, tp.under]); } return r; }))`));
    const within = (box, k, v) => { const xs = box.map(x => x[k]); return v >= Math.min(...xs) - 0.0005 - 1e-9 && v <= Math.max(...xs) + 0.0005 + 1e-9; };
    const off = rows.filter((g, i) => (g.cover && g.line.homeLine !== null && g.line.homeLine !== undefined && !(within(back[i], 0, g.cover.home) && within(back[i], 1, g.cover.away))) || (g.ou && g.line.total !== null && g.line.total !== undefined && !(within(back[i], 2, g.ou.over) && within(back[i], 3, g.ou.under))));
    chk(!off.length, `the page's goals layer gives back the published puck line and total chances within the rounding of their inputs on ${rows.length} lines (${off.length} off, e.g. ${off[0] && off[0].id})`);
  }
}

const PRICE_K = ['book', 'homeML', 'awayML', 'homeLine', 'homeSpreadOdds', 'awaySpreadOdds', 'total', 'overOdds', 'underOdds'];
async function refreshOddsChecks() {
  console.log('REFRESH ODDS');
  const AT = PUB + 60000;
  /* the buttons, their status lines, the parse; no ESPN request for odds on load, on the watch or on a tab */
  {
    const errs = [], w = await boot(AT, errs, { hash: 'games' }), d = w.document;
    for (const [id, note, tab] of [['refreshOdds', 'oddsNote', 'games'], ['spRefreshOdds', 'spOddsNote', 'suggest'], ['pbRefreshOdds', 'pbOddsNote', 'parlays']]) {
      const b = d.getElementById(id), s = d.getElementById(note);
      chk(!!b && b.tagName === 'BUTTON' && b.type === 'button' && !b.disabled && b.tabIndex >= 0 && txt(b) === 'Refresh odds' && b.closest('section') === d.getElementById('tab-' + tab), `${id}: a Refresh odds button on the ${tab} tab, a button the keyboard reaches`);
      chk(!!b && w.getComputedStyle(b).minHeight === '44px', `${id}: 44px tall (min-height ${b && w.getComputedStyle(b).minHeight})`);
      chk(!!s && s.getAttribute('role') === 'status' && s.getAttribute('aria-live') === 'polite' && b && b.nextElementSibling === s, `${id}: one aria-live status line beside it`);
      chk(!!s && txt(s) === oddsIdleS(AT), `${id}: before a press its status line names the books the lines to come are from and when the job read them ("${oddsIdleS(AT)}": "${s && txt(s)}")`);
    }
    const day = d.getElementById('daySel').value || null;
    const live = !!day && S.games.some(g => g.date === day && g.state !== 'final' && sStarted(g, AT));
    const want = live ? [`${SB_URL}?dates=${day.replace(/-/g, '')}&limit=100`] : [];
    const onLoad = () => espnReqs(w).map(r => r.url);
    chk(canon(onLoad()) === canon(want), `on load the page asks ESPN for nothing but the open day's scores${live ? ' (a game under way)' : ''}, never the odds (${onLoad().join(', ') || 'nothing'})`);
    d.dispatchEvent(new w.Event('visibilitychange')); d.dispatchEvent(new w.Event('visibilitychange'));
    for (const t of ['parlays', 'ratings', 'games', 'parlays']) d.querySelector(`#tabs button[data-tab="${t}"]`).click();
    d.dispatchEvent(new w.Event('visibilitychange'));
    chk(canon(onLoad()) === canon(want), `the watch and the tabs ask ESPN for nothing more (${onLoad().join(', ') || 'nothing'})`);
    oddsParity(w);
    chk(!errs.length, 'no runtime error on the Refresh odds boot: ' + errs.join(' | '));
  }
  const days = sOddsDays(AT), come = S.games.filter(g => days.includes(g.date) && !sStarted(g, AT));
  if (!come.length) {
    const errs = [], w = await boot(AT, errs, { hash: 'parlays' }), d = w.document, n0 = espnReqs(w).length, st = w.localStorage.getItem('nhl_v1');
    d.getElementById('pbRefreshOdds').click(); await oddsDone(w);
    chk(espnReqs(w).length === n0 && txt(d.getElementById('pbOddsNote')) === 'No game still to come on the days shown: there are no lines to read.', `no game still to come: a press reads nothing and says so (${txt(d.getElementById('pbOddsNote'))})`);
    chk(w.localStorage.getItem('nhl_v1') === st && !errs.length, 'and stores nothing, with no runtime error: ' + errs.join(' | '));
    console.log('  no game still to come on the days shown: the press with a scoreboard is skipped');
    return;
  }
  /* the press: the clock passes the first puck drop while ESPN is read; then each game still to come takes what this answer gives it */
  const byStart = come.slice().sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || (a.id < b.id ? -1 : 1));
  const T2 = Date.parse(byStart[0].start) + 60000, later = byStart.filter(g => !sStarted(g, T2)), early = byStart.filter(g => sStarted(g, T2));
  const lined = later.filter(g => g.line && sFresh(g)), taken = new Set();
  const role = f => { const g = lined.find(x => !taken.has(x.id) && f(x)); if (g) taken.add(g.id); return g || null; };
  const has = v => v !== null && v !== undefined;
  const gA = role(g => PBS.ok(g.line.homeML) && PBS.ok(g.line.awayML));                                                  // the moneyline flips
  const gB = role(g => has(g.line.homeLine) && g.line.homeLine !== 0 && PBS.ok(g.line.homeSpreadOdds) && PBS.ok(g.line.awaySpreadOdds) && g.cover);   // the puck line moves to the other side
  const gC = role(g => has(g.line.total) && PBS.ok(g.line.overOdds) && PBS.ok(g.line.underOdds) && g.ou);                // the total moves a goal
  const gD = role(() => true);                                                                                            // ESPN has no odds on it
  const gU = role(() => true);                                                                                            // ESPN's answer leaves it out
  const gK = role(g => isDKBook(g.line) && g.line.dk && ['homeML', 'awayML', 'homePL', 'awayPL', 'over', 'under'].some(k => typeof g.line.dk[k] === 'string') && PBS.ok(g.line.homeML));   // no links: ids carried
  const gN = later.find(g => !g.line && isFinite(g.pHome) && isFinite(g.xt) && isFinite(g.mu) && isFinite(g.diff)) || null;   // a first line
  if (gN) taken.add(gN.id);
  /* games ESPN no longer has as scheduled though the clock still calls them to come, priced at ESPN all the same: a lined
     game where there is one to spare, else one with no line yet (which must not take a first line) */
  const spare = () => { const g = role(x => PBS.ok(x.line.homeML) && PBS.ok(x.line.awayML)) || later.find(x => !taken.has(x.id) && !x.line && isFinite(x.pHome) && isFinite(x.xt)) || null; if (g) taken.add(g.id); return g; };
  const gI = spare(), gP = spare(), gX = spare();                                                                          // under way, postponed, cancelled at ESPN
  const roleDays = new Set([gA, gB, gC, gD, gU, gK, gI, gP, gX, gN].filter(Boolean).map(g => g.date));
  const ESPN_ST = new Map([[gI, { name: 'STATUS_IN_PROGRESS', state: 'in', description: 'In Progress', shortDetail: '1st' }], [gP, { name: 'STATUS_POSTPONED', state: 'post', description: 'Postponed', shortDetail: 'Postponed' }],
    [gX, { name: 'STATUS_CANCELED', state: 'post', description: 'Canceled', shortDetail: 'Canceled' }]].filter(([g]) => g));
  /* a day ESPN does not answer: one with no game above on it, one with a line if there is one */
  const freeDays = days.slice().reverse().filter(dd => !roleDays.has(dd) && later.some(g => g.date === dd));
  const failDay = freeDays.find(dd => later.some(g => g.date === dd && g.line)) || freeDays[0] || null;
  const answer = {}, expLine = {}, mk = (g, i) => String(900000 + i) + String(g.id).slice(-4);
  later.forEach((g, i) => {
    if (g.date === failDay || g === gU) return;
    const L = g.line, base = L ? { homeML: L.homeML, awayML: L.awayML, homeLine: L.homeLine, homeSpreadOdds: L.homeSpreadOdds, awaySpreadOdds: L.awaySpreadOdds, total: L.total, overOdds: L.overOdds, underOdds: L.underOdds } : null;
    let nl = null, ids = null, book;
    if (g === gA) nl = Object.assign({}, base, { homeML: L.homeML < 0 ? 135 : -160, awayML: L.homeML < 0 ? -160 : 135 });
    else if (g === gB) nl = Object.assign({}, base, { homeLine: -L.homeLine, homeSpreadOdds: L.awaySpreadOdds, awaySpreadOdds: L.homeSpreadOdds });
    else if (g === gC) nl = Object.assign({}, base, { total: L.total - 1, overOdds: L.underOdds, underOdds: L.overOdds });
    else if (g === gD) nl = null;
    else if (g === gK) { nl = Object.assign({}, base, { homeML: L.homeML + (L.homeML > 0 ? 5 : -5) }); book = 'Draft Kings'; ids = {}; }
    else if (g === gN) nl = { homeML: -130, awayML: 110, homeLine: -1.5, homeSpreadOdds: 190, awaySpreadOdds: -230, total: 6.5, overOdds: -110, underOdds: -110 };
    else if (ESPN_ST.has(g)) nl = L ? Object.assign({}, base, { homeML: L.homeML < 0 ? 140 : -170, awayML: L.homeML < 0 ? -170 : 140 }) : { homeML: 140, awayML: -170, homeLine: 1.5, homeSpreadOdds: -200, awaySpreadOdds: 165, total: 5.5, overOdds: -115, underOdds: -105 };   // a price that must not be taken
    else if (L) { nl = base; ids = L.dk && L.dk.event && ['homeML', 'awayML'].every(k => typeof L.dk[k] === 'string') ? Object.assign({}, L.dk) : null; if (ids) delete ids.at; }
    if (nl && ids === null) ids = idsFor(nl, (L && L.dk && L.dk.event) || String(70000000 + i), mk(g, i));
    const ev = espnEvent(g, nl ? espnOdds(nl, ids, book) : null, ESPN_ST.get(g));
    (answer[g.date] = answer[g.date] || []).push(ev);
    if (nl && !ESPN_ST.has(g)) expLine[g.id] = E.gameRow(ev).odds;           // the job's parse of this answer
  });
  for (const g of early) (answer[g.date] = answer[g.date] || []).push(espnEvent(g, espnOdds({ homeML: -999, awayML: 650, homeLine: -1.5, homeSpreadOdds: 300, awaySpreadOdds: -400, total: 9.5, overOdds: 300, underOdds: -400 }, idsFor({ homeLine: -1.5, total: 9.5 }, '1', '42'))));
  /* the carried ids: the published outcome ids for the same numbers, beside the event, dated by their read */
  if (gK) { const q = gK.line.dk, dk = {}; if (typeof q.event === 'string') dk.event = q.event; for (const k of ['homeML', 'awayML', 'homePL', 'awayPL', 'over', 'under']) if (typeof q[k] === 'string') dk[k] = q[k]; dk.at = q.at || gK.line.at; expLine[gK.id] = Object.assign({}, expLine[gK.id], { dk }); }
  console.log(`  the press: ${days.length} days read (${days.join(', ')}), ${early.length} game${early.length === 1 ? '' : 's'} dropping the puck during the read; the moneyline flips on ${gA ? gA.id : 'none'}, the puck line moves on ${gB ? gB.id : 'none'}, the total on ${gC ? gC.id : 'none'}, no odds on ${gD ? gD.id : 'none'}, left out of the answer ${gU ? gU.id : 'none'}, ids carried on ${gK ? gK.id : 'none'}, a first line on ${gN ? gN.id : 'none'}, under way at ESPN ${gI ? gI.id : 'none'}, postponed at ESPN ${gP ? gP.id : 'none'}, cancelled ${gX ? gX.id : 'none'}, ESPN silent on ${failDay || 'no day'}`);
  const stub = gated => { let release = () => {}; const gate = new Promise(r => { release = r; }); return { release, fn: async url => {
    const m = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), dd = m && `${m[1]}-${m[2]}-${m[3]}`;
    if (gated.on && /[?&]_=/.test(url)) await gate;
    if (dd === failDay) return { ok: false, status: 503 };
    return { ok: true, json: async () => ({ events: JSON.parse(JSON.stringify(answer[dd] || [])) }) };
  } }; };
  /* the builder before the press: the moneyline that flips, the puck line that moves and a leg on a game that holds */
  const legOf = (g, side, kind) => { const L = sLeg(g, side, kind); return L && { game: g.id, side, kind, odds: L.price, line: L.num, p: L.p, fair: L.fair, label: L.mu, text: L.who, date: g.date, start: g.start }; };
  const hold = later.find(g => g.line && sFresh(g) && expLine[g.id] && ![gA, gB, gK].includes(g) && legOf(g, 'home', 'ml'));      // its moneyline holds
  const legs = [gA && legOf(gA, 'home', 'ml'), gB && legOf(gB, 'home', 'pl'), hold && legOf(hold, 'home', 'ml')].filter(Boolean);
  const gated = { on: false }, sb = stub(gated);
  const errs = [], w = await boot(AT, errs, { hash: 'parlays', store: JSON.stringify({ legs, ui: { tab: 'parlays' } }), espn: sb.fn }), d = w.document;
  const before = pageGames(w), store0 = w.localStorage.getItem('nhl_v1'), writes0 = w.__writes.length, n0 = espnReqs(w).length;
  gated.on = true;
  d.getElementById('pbRefreshOdds').click();
  await wait(5);
  const reading = sPropsAsk(AT).length ? "Reading DraftKings' lines and player props from ESPN…" : "Reading DraftKings' lines from ESPN…";
  chk(txt(d.getElementById('pbOddsNote')) === reading && d.getElementById('pbRefreshOdds').getAttribute('aria-disabled') === 'true', `while ESPN is read the status line says so and the button is marked busy (${txt(d.getElementById('pbOddsNote'))})`);
  d.getElementById('pbRefreshOdds').click(); d.getElementById('refreshOdds').click();          // presses while a read runs: nothing
  /* Finish parlay while ESPN is read: the card opens on the published lines, with the puck line the read moves on it */
  const cardDuring = legs.length >= 2 && !d.getElementById('pFinish').disabled;
  if (cardDuring) { d.getElementById('pFinish').click(); chk(!d.getElementById('pcWin').hidden, 'Finish parlay during the read opens the card'); }
  const asked = espnReqs(w).slice(n0).map(r => r.url);
  chk(asked.length === days.length && days.every((dd, i) => new RegExp(`^${SB_URL.replace(/[.?]/g, '\\$&')}\\?dates=${dd.replace(/-/g, '')}&limit=100&_=\\d+$`).test(asked[i])) && espnReqs(w).slice(n0).every(r => r.method === 'GET' && r.cache === 'no-store'), `a press asks ESPN's scoreboard once for each day shown with a game still to come (${days.join(', ')}), GET, no-store, a cache-buster on each, and a press during the read asks nothing (${asked.length} asked)`);
  w.__setClock(T2); sb.release(); gated.on = false;
  chk(await oddsDone(w), 'the read finishes');
  /* the read's time: the lines it dated, else (no game took one) the clock it finished on, whose minute is the status line's */
  const after = pageGames(w), atMs = (() => { const g = after.find(x => x.line && x.line.refreshed); return g ? Date.parse(g.line.at) : T2; })();
  const pub = id => before.find(g => g.id === id), now = id => after.find(g => g.id === id);
  /* each game that took a line: the job's parse of the answer, read now, and the call's parts on it by the job's rules */
  const took = later.filter(g => expLine[g.id]);
  if (took.length) chk(isFinite(atMs) && atMs >= T2 && atMs < T2 + 10000, `the lines read are dated by the read (${isFinite(atMs) ? new Date(atMs).toISOString() : atMs})`);
  for (const g of took) {
    const p = pub(g.id), n = now(g.id), want = Object.assign({}, expLine[g.id], { at: n && n.line && n.line.at, refreshed: true });
    chk(!!n && !!n.line && canon(n.line) === canon(want) && Date.parse(n.line.at) === atMs, `${g.id}: the line is the job's parse of ESPN's answer, read now (${n && canon(n.line).slice(0, 200)} vs ${canon(want).slice(0, 200)})`);
    const dv = sCall(p, expLine[g.id]), got = {}; for (const k of DERIVED) if (n && n[k] !== undefined) got[k] = n[k];
    chk(canon(got) === canon(dv), `${g.id}: the edges, sides and chances follow the new line as the job's callOf makes them (${canon(got).slice(0, 220)} vs ${canon(dv).slice(0, 220)})`);
    const keep = {}, keepP = {}; for (const k of CALL.filter(k => !DERIVED.includes(k) && k !== 'line')) { keep[k] = n && n[k]; keepP[k] = p[k]; }
    chk(canon(keep) === canon(keepP), `${g.id}: the rest of the call is as published (the chance, margin, total, pick)`);
  }
  if (gA) chk(now(gA.id).line.dk.homeML !== (pub(gA.id).line.dk || {}).homeML && now(gA.id).line.dk.homeML === expLine[gA.id].dk.homeML, `${gA.id}: a moved line takes ESPN's fresh DraftKings ids (${now(gA.id).line.dk.homeML})`);
  if (gB) chk(now(gB.id).line.homeLine === -pub(gB.id).line.homeLine && now(gB.id).cover && now(gB.id).cover.home !== undefined, `${gB.id}: the puck line moved to ${now(gB.id).line.homeLine}, its chances worked again`);
  if (gK) chk(canon(now(gK.id).line.dk) === canon(expLine[gK.id].dk), `${gK.id}: an answer with no DraftKings link keeps the published ids for the same numbers, dated by their read (${canon(now(gK.id).line.dk)})`);
  /* the games that keep their published line: no odds at ESPN, a day ESPN did not answer, a puck drop during the read, and every game started before */
  const stood = S.games.filter(g => !expLine[g.id]);
  const moved = stood.filter(g => canon(now(g.id)) !== canon(pub(g.id)));
  chk(!moved.length, `every game that took no line is as published: no odds at ESPN${gD ? ` (${gD.id})` : ''}, left out of ESPN's answer${gU ? ` (${gU.id})` : ''}, a day ESPN did not answer${failDay ? ` (${failDay})` : ''}, ${early.length} dropping the puck during the read, every game started before (${moved.length} changed, e.g. ${moved[0] && moved[0].id})`);
  for (const [g, st] of ESPN_ST) chk(canon(now(g.id)) === canon(pub(g.id)), `${g.id}, ${st.description.toLowerCase()} at ESPN though the clock still calls it to come, keeps its published line and call (${canon(now(g.id).line).slice(0, 120)})`);
  /* the status line, worded from the counts */
  const cnt = { answered: true, allDK: took.every(g => isDKBook(expLine[g.id])), read: took.length, moved: took.filter(g => pub(g.id).line && ['book', 'homeML', 'awayML', 'homeLine', 'homeSpreadOdds', 'awaySpreadOdds', 'total', 'overOdds', 'underOdds'].some(k => pub(g.id).line[k] !== expLine[g.id][k])).length,
    first: took.filter(g => !pub(g.id).line).length, noLine: later.filter(g => g.line && g.date !== failDay && g !== gU && !expLine[g.id] && !ESPN_ST.has(g)).length, unread: later.filter(g => g.line && (g.date === failDay || g === gU)).length,
    started: early.length + (gI ? 1 : 0), postponed: gP ? 1 : 0, cancelled: gX ? 1 : 0, older: 0, days: days.length, silent: failDay ? [failDay] : [] };
  /* the card opened during the read held the puck line that moved: closed, and said */
  const cardShut = cardDuring && gB && legs.some(l => l.game === gB.id);
  /* the props read beside it (every game ESPN's 404 here): a game started by the clock at the end of the read or under way at ESPN is
     not shown, one postponed or cancelled at ESPN is called off */
  const pq = { asked: 0, none: 0, started: 0, off: 0 };
  for (const g of sPropsAsk(AT)) { pq.asked++; if (sStarted(g, T2) || g === gI) pq.started++; else if (g === gP || g === gX) pq.off++; else pq.none++; }
  const said = sOddsText(cnt, atMs) + sPropsText(pq) + (cardShut ? ' The parlay card was closed: a leg on it moved or came off with this read; Finish again for the new lines.' : '');
  if (cardDuring) chk(d.getElementById('pcWin').hidden === !!cardShut, `a card open during the read ${cardShut ? 'that held a leg whose number moved is closed' : 'stays open'} (${d.getElementById('pcWin').hidden ? 'closed' : 'open'})`);
  chk(txt(d.getElementById('pbOddsNote')) === said && txt(d.getElementById('oddsNote')) === said && txt(d.getElementById('spOddsNote')) === said, `after the read every status line says "${said}" (${txt(d.getElementById('pbOddsNote'))})`);
  console.log(`  after the press: "${txt(d.getElementById('pbOddsNote'))}"; the builder ${legs.length} legs -> ${d.querySelectorAll('#legs .leg').length}`);
  chk(d.getElementById('pbRefreshOdds').getAttribute('aria-disabled') === null, 'and the button is no longer busy');
  /* nothing stored by the press */
  chk(w.__writes.length === writes0 && w.localStorage.getItem('nhl_v1') === store0, `the press writes nothing to storage (${w.__writes.length - writes0} writes)`);
  /* everything drawn from the prices: the panel by brute force on what the press should leave, the builder, the card's link */
  const EXP = JSON.parse(STATE);
  for (const g of EXP.games) if (expLine[g.id]) { const p = pub(g.id); for (const k of DERIVED) delete g[k]; Object.assign(g, sCall(p, expLine[g.id]), { line: Object.assign({}, expLine[g.id], { at: new Date(atMs).toISOString(), refreshed: true }) }); }
  const real = S; S = EXP;
  try {
    const PN = holdPanel(w, T2, 'after Refresh odds'); holdSuggest(w, T2, 'after Refresh odds');
    const tick = PN.pool.tickable, rf = tick.filter(g => g.line.refreshed), pubN = tick.length - rf.length;
    if (tick.length) { const ob2 = tick.filter(g => !isDKBook(g.line)); chk(d.getElementById('pbRead').hidden === !ob2.length, `after the read the panel's own line still shows only where another book prices a game: the status line says when the prices were read (${rf.length} read, ${pubN} as published; ${txt(d.getElementById('pbRead')) || 'hidden'})`); }
    /* the builder: the flipped moneyline at its new price, the moved puck line out and said, the card's link on the fresh ids */
    const bm = txt(d.getElementById('bMsg')), rowsB = [...d.querySelectorAll('#legs .leg')];
    if (gB) chk(bm.includes(`${S.teams[gB.home].short} ${PBS.line(gB.line.homeLine)} left the builder: DraftKings' puck line is now ${PBS.line(-gB.line.homeLine)} (as read ${clockOf(atMs)}).`) && !rowsB.some(r => r.dataset.id.startsWith(gB.id + '|')), `a builder leg at a puck line that moved leaves it, said (${bm.slice(0, 200)})`);
    if (gA) {
      const r = rowsB.find(x => x.dataset.id === `${gA.id}|home|ml`), L = sLeg(EXP.games.find(g => g.id === gA.id), 'home', 'ml');
      chk(!!r && txt(r).includes(PBS.odds(L.price)) && txt(r).includes(`model ${PBS.pctW(L.p)}`), `the builder shows the flipped moneyline at DraftKings' new price ${PBS.odds(L.price)} (${r && txt(r)})`);
      chk(bm.includes(`1 price has changed since you added it: the builder shows DraftKings' price as read from ESPN at ${clockOf(atMs)}.`), `the builder says the price changed, as read from ESPN (${bm.slice(0, 240)})`);
    }
    const blegs = rowsB.map(r => { const [g, s, k] = r.dataset.id.split('|'); return sLeg(EXP.games.find(x => x.id === g), s, k); }).filter(Boolean).sort(sOrder);
    if (blegs.length >= 2) {
      let p = 1, dd = 1; for (const L of blegs) { p *= L.p; dd *= L.dec; }
      const bt = [...d.querySelectorAll('#parlayTotals .stat')].map(txt);
      chk(bt[1] && bt[1].startsWith(PBS.toAm(dd)) && bt[2] && bt[2].startsWith(PBS.money(PBS.cents(20 * dd))), `the builder's price and pays follow the new prices (${bt[1]} · ${bt[2]}: ${PBS.toAm(dd)})`);
      d.getElementById('pFinish').click();
      const href = d.getElementById('pcDk').href, key = L => L.kind === 'ou' ? L.side : L.side + (L.kind === 'ml' ? 'ML' : 'PL');
      const ids = blegs.map(L => L.g.line.dk && L.g.line.dk[key(L)]).filter(x => typeof x === 'string');
      chk(href === 'https://sportsbook.draftkings.com/?outcomes=' + ids.map(encodeURIComponent).join('+'), `the card opens the legs on DraftKings' fresh ids, in leg order (${href})`);
      if (gA) chk(!href.includes(encodeURIComponent((gA.line.dk || {}).homeML || 'none')), 'and never on an id the moved line had');
      const oldest = blegs.map(L => L.g.line.dk && L.g.line.dk.at || L.g.line.at).sort((a, b) => Date.parse(a) - Date.parse(b))[0];
      chk(txt(d.getElementById('pcNote')).startsWith(`DraftKings' lines as read ${PBS.etRead(oldest)}:`), `the card's note is dated by the oldest read among its legs (${txt(d.getElementById('pcNote')).slice(0, 80)})`);
      d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
    /* each game's page after the press (nhl v27): its Game bets on the new line row by row (the new prices, fair chances and calls, a box
       ticked exactly where the builder draws the leg), the lines' source saying Refresh odds read them, the status line this game's own,
       at the clock the page is on since the read (T2: its player lines' words turn on the page's own day) */
    d.querySelector('#tabs button[data-tab="games"]').click();
    for (const g of [gA, gB, gC, gK, gN].filter(Boolean)) {
      const eg = EXP.games.find(x => x.id === g.id), real2 = S; S = Object.assign({}, real2, { games: real2.games.map(x => x.id === g.id ? eg : x) });
      try {
        const badG = gpWrongs(w, eg, T2, sReads(w)[g.id] || null, { noPlayers: true, inB: drawnIds(w) }), pb = d.querySelector('#gameView .gbets');
        chk(!badG.length, `${g.id}: after the press its page is on the new line, row by row (${badG.slice(0, 3).join(' | ')})`);
        if (eg.line && eg.line.refreshed) chk(!!pb && txt(pb.querySelector('.gp-src')).includes(`read from ESPN by Refresh odds ${clockOf(atMs)}`), `${g.id}: its Game bets say the prices were read from ESPN by the press (${pb && txt(pb.querySelector('.gp-src'))})`);
        const c = cardOf(d, g.id); if (c) { const bc = rowWrongs(w, c, eg, T2, pageMap(w), null); chk(!bc.length, `${g.id}: its row after the press (${bc.slice(0, 2).join(' | ')})`); }
      } finally { S = real2; }
    }
    /* a game of the day ESPN did not answer for says so on its own page: its line as published, "couldn't reach ESPN" at the end */
    { const gF = failDay ? later.find(g => g.date === failDay && !sStarted(g, T2)) : null;
      if (gF) { const bF = gpWrongs(w, gF, T2, sReads(w)[gF.id] || null, { noPlayers: true, inB: drawnIds(w) }), nF = txt(d.getElementById('ppOddsNote')); chk(!bF.length && /· couldn't reach ESPN\.$/.test(nF), `${gF.id}: a game of a day ESPN did not answer for says the press could not reach ESPN (${nF}; ${bF.slice(0, 2).join(' | ')})`); }
      else console.log("  no day ESPN left unanswered with a game still to come: \"couldn't reach ESPN\" on a game's page is not held on this state"); }
    closeBets(d);
    for (const g of early.slice(0, 3)) { const pb = betsOn(d, g); chk(!!pb && !d.querySelector('#gameView input[data-leg], #gameView input[data-pp-add]'), `${g.id}, started during the read, offers no bet`); closeBets(d); }
  } finally { S = real; }
  /* the store after the press: tabs visited (each a save) keep the builder's legs as they were before it, the moved price and
     the moved puck line included; a reload on that store is the builder on the published lines, with nothing said changed */
  for (const t of ['ratings', 'parlays']) d.querySelector(`#tabs button[data-tab="${t}"]`).click();
  const legsOf = st => JSON.stringify((JSON.parse(st || '{}').legs) || []), storeAfter = w.localStorage.getItem('nhl_v1');
  chk(w.__writes.length > writes0 && legsOf(storeAfter) === legsOf(store0), `after the press, a save (a tab) stores the builder's legs as they were before it (${legsOf(storeAfter).slice(0, 160)} vs ${legsOf(store0).slice(0, 160)})`);
  {
    const errsR = [], wR = await boot(T2, errsR, { hash: 'parlays', store: storeAfter }), dR = wR.document;
    const rowsR = [...dR.querySelectorAll('#legs .leg')].map(r => r.dataset.id), want = legs.map(l => sLeg(S.games.find(g => g.id === l.game), l.side, l.kind)).sort(sOrder);
    const priced = want.every(L => { const r = dR.querySelector(`#legs .leg[data-id="${L.id}"]`); return r && txt(r).includes(PBS.odds(L.price)); });
    chk(canon(rowsR) === canon(want.map(L => L.id)) && priced, `a reload after the press is the builder on the published lines: every leg back at DraftKings' published price (${rowsR.join(', ')})`);
    const bmR = txt(dR.getElementById('bMsg'));
    chk(!/changed since you added|left the builder/.test(bmR), `and says no price changed and no leg left (${bmR || 'nothing said'})`);
    chk(legsOf(wR.localStorage.getItem('nhl_v1')) === legsOf(store0) && !errsR.length, `and its store is the one before the press, with no runtime error (${errsR.join(' | ')})`);
  }
  /* a second press reads again, every price moved a little since the first: the lines, the call, the levels by brute force
     (never a panel cached from before the read) and the status line follow; the watch and the tabs read nothing */
  const n1 = espnReqs(w).length;
  d.dispatchEvent(new w.Event('visibilitychange'));
  chk(espnReqs(w).length === n1, 'the watch asks ESPN for nothing after a press');
  d.querySelector('#tabs button[data-tab="parlays"]').click();
  const T3 = w.Date.now(), days3 = sOddsDays(T3), cur = pageGames(w), shift = v => !PBS.ok(v) ? v : v > 0 ? v + 5 : v - 5;
  for (const k of Object.keys(answer)) delete answer[k];
  const exp3 = {};
  EXP.games.filter(g => days3.includes(g.date) && !sStarted(g, T3)).forEach((g, i) => {
    if (!g.line || g.date === failDay) return;
    const L = g.line, nl = { homeML: shift(L.homeML), awayML: shift(L.awayML), homeLine: L.homeLine, homeSpreadOdds: shift(L.homeSpreadOdds), awaySpreadOdds: shift(L.awaySpreadOdds), total: L.total, overOdds: shift(L.overOdds), underOdds: shift(L.underOdds) };
    const ev = espnEvent(g, espnOdds(nl, idsFor(nl, (L.dk && L.dk.event) || String(80000000 + i), String(800000 + i)), 'DraftKings'));
    (answer[g.date] = answer[g.date] || []).push(ev); exp3[g.id] = E.gameRow(ev).odds;
  });
  /* a card open through the second read (every price moved, no number): drawn again on the new prices and ids, and said */
  const card3 = !d.getElementById('pFinish').disabled;
  if (card3) d.getElementById('pFinish').click();
  const writes3 = w.__writes.length;
  d.getElementById('pbRefreshOdds').click(); await oddsDone(w);
  chk(espnReqs(w).length - n1 === days3.length, `a second press reads again (${espnReqs(w).length - n1} asked, ${days3.length} days)`);
  const after3 = pageGames(w), at3 = (() => { const g = after3.find(x => exp3[x.id] && x.line); return g ? Date.parse(g.line.at) : w.Date.now(); })();
  const took3 = Object.keys(exp3), wrong3 = took3.filter(id => {
    const n = after3.find(g => g.id === id), p = cur.find(g => g.id === id);
    if (!n || !n.line || !p || !p.line) return true;
    const dv = sCall(p, exp3[id]), got = {}; for (const k of DERIVED) if (n[k] !== undefined) got[k] = n[k];
    return canon(n.line) !== canon(Object.assign({}, exp3[id], { at: n.line.at, refreshed: true })) || canon(got) !== canon(dv) || !(Date.parse(n.line.at) > Date.parse(p.line.at));
  });
  chk(!wrong3.length, `the second read moves every line it read to ESPN's new prices, and the call with it (${wrong3.length} of ${took3.length} wrong, e.g. ${wrong3[0]})`);
  if (days3.length) {
    const cnt3 = { answered: true, allDK: true, read: took3.length, moved: took3.length, first: 0, noLine: 0, unread: cur.filter(g => days3.includes(g.date) && !sStarted(g, T3) && g.line && g.date === failDay).length, started: 0, older: 0, days: days3.length, silent: failDay && days3.includes(failDay) ? [failDay] : [] };
    const said3 = sOddsText(cnt3, at3) + sPropsText(sPropsNone(T3));
    chk(txt(d.getElementById('pbOddsNote')) === said3, `and says "${said3}" (${txt(d.getElementById('pbOddsNote'))})`);
  } else chk(txt(d.getElementById('pbOddsNote')) === 'No game still to come on the days shown: there are no lines to read.', `with no game left to come it reads nothing and says so (${txt(d.getElementById('pbOddsNote'))})`);
  chk(w.__writes.length === writes3, `the second press writes nothing to storage (${w.__writes.length - writes3} writes)`);
  const EXP3 = JSON.parse(JSON.stringify(EXP));
  for (const g of EXP3.games) if (exp3[g.id]) { const p = cur.find(x => x.id === g.id); for (const k of DERIVED) delete g[k]; Object.assign(g, sCall(p, exp3[g.id]), { line: Object.assign({}, exp3[g.id], { at: new Date(at3).toISOString(), refreshed: true }) }); }
  { const real3 = S; S = EXP3; try {
    holdPanel(w, T3, 'after a second press'); holdSuggest(w, T3, 'after a second press');
    if (card3) {
      const cl = [...d.querySelectorAll('#legs .leg')].map(r => { const [g, s2, k] = r.dataset.id.split('|'); return sLeg(EXP3.games.find(x => x.id === g), s2, k); }).filter(Boolean).sort(sOrder);
      const key = L => L.kind === 'ou' ? L.side : L.side + (L.kind === 'ml' ? 'ML' : 'PL'), ids = cl.map(L => L.g.line.dk && L.g.line.dk[key(L)]).filter(x => typeof x === 'string');
      const lp = [...d.querySelectorAll('#pcView .pc-lp')].map(txt);
      chk(!d.getElementById('pcWin').hidden && canon(lp) === canon(cl.map(L => PBS.odds(L.price))) && d.getElementById('pcDk').href === 'https://sportsbook.draftkings.com/?outcomes=' + ids.map(encodeURIComponent).join('+'),
        `a card open through a read is drawn again on its new prices and DraftKings' new ids (${lp.join(' ')} vs ${cl.map(L => PBS.odds(L.price)).join(' ')}; ${d.getElementById('pcDk').href})`);
      if (took3.some(id => cl.some(L => L.game === id))) chk(txt(d.getElementById('pcMsg')) === `Updated to DraftKings' lines as read from ESPN at ${clockOf(at3)}.`, `and says so in the card (${txt(d.getElementById('pcMsg'))})`);
      d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    }
  } finally { S = real3; } }
  chk(!errs.length, 'no runtime error through the press: ' + errs.join(' | '));
  holdRequests(w, 'the Refresh odds boot');
  /* reads that change nothing: ESPN failing, a junk answer, an answer of the wrong shape, a read older than the lines shown */
  const lineNow = come.some(g => g.line);
  for (const [tag, fn] of [['a failed read', async () => ({ ok: false, status: 503 })], ['a junk answer', async () => ({ ok: true, json: async () => { throw new SyntaxError('Unexpected token'); } })], ['an answer of the wrong shape', async () => ({ ok: true, json: async () => ({ events: 'x' }) })], ['a network error', async () => { throw new TypeError('Failed to fetch'); }]]) {
    const errs2 = [], w2 = await boot(AT, errs2, { hash: 'games', espn: url => /[?&]_=/.test(url) ? fn() : Promise.resolve({ ok: true, json: async () => ({ events: [] }) }) }), d2 = w2.document;
    const b0 = canon(pageGames(w2)), s0 = w2.localStorage.getItem('nhl_v1'), wr = w2.__writes.length;
    d2.getElementById('refreshOdds').click(); await oddsDone(w2);
    const said2 = sOddsText({ answered: false, lined: lineNow }, w2.Date.now()) + sPropsText(sPropsNone(AT));
    chk(txt(d2.getElementById('oddsNote')) === said2, `${tag}: the status line says "${said2}" (${txt(d2.getElementById('oddsNote'))})`);
    chk(canon(pageGames(w2)) === b0 && w2.__writes.length === wr && w2.localStorage.getItem('nhl_v1') === s0, `${tag}: every line is as published, and nothing is stored`);
    chk(!errs2.length, `${tag}: no runtime error: ${errs2.join(' | ')}`);
  }
  /* the visitor's clock behind the job's: every line shown was read later than this read, so none is taken */
  const BEHIND = PUB - 30 * 60000, daysB = sOddsDays(BEHIND), comeB = S.games.filter(g => daysB.includes(g.date) && !sStarted(g, BEHIND)), linedB = comeB.filter(g => g.line && sFresh(g));
  if (linedB.length) {
    const ans = {}; for (const g of linedB) (ans[g.date] = ans[g.date] || []).push(espnEvent(g, espnOdds(Object.assign({}, g.line, { homeML: PBS.ok(g.line.homeML) ? g.line.homeML + (g.line.homeML > 0 ? 7 : -7) : -120 }), idsFor(g.line, '5', '77'))));
    for (const g of comeB.filter(g => !linedB.includes(g))) (ans[g.date] = ans[g.date] || []).push(espnEvent(g, null));      // the rest: no odds at ESPN
    const errs3 = [], w3 = await boot(BEHIND, errs3, { hash: 'games', espn: async url => { const m = /dates=(\d{4})(\d{2})(\d{2})/.exec(url); return { ok: true, json: async () => ({ events: (m && ans[`${m[1]}-${m[2]}-${m[3]}`]) || [] }) }; } }), d3 = w3.document;
    const b0 = canon(pageGames(w3));
    d3.getElementById('refreshOdds').click(); await oddsDone(w3);
    const said3 = sOddsText({ answered: true, read: 0, noLine: comeB.filter(g => g.line && !sFresh(g)).length, unread: 0, started: 0, older: linedB.length }, w3.Date.now()) + sPropsText(sPropsNone(BEHIND));
    chk(canon(pageGames(w3)) === b0 && txt(d3.getElementById('oddsNote')) === said3, `a read older than the lines shown takes none of them and says so ("${said3}": ${txt(d3.getElementById('oddsNote'))})`);
    chk(!errs3.length, 'no runtime error on an older read: ' + errs3.join(' | '));
  } else console.log('  no line on a game still to come half an hour before the publish: the older-read check is skipped');
}

/* ================= PLAYER PROPS =================
   The Refresh odds press's read of ESPN's DraftKings propBets and the props window, held with rules of its own: the page's
   parse equal to tools/espn.js's propsOf on the recorded answer (tools/fixtures/espn_propbets.json) and on variants of it,
   the first item of a pair the Over by its ladder; on a press with a made-up answer built from the state's own projections
   (pages joined, a 404, a failed request, a junk body, a body of the wrong shape, a page two that 404s, a game whose puck
   drops during the read, one ESPN has under way), every number in the window worked out here from the state's
   distributions and the job's parse of that answer; the model on trial, never "model says" or "edge"; nothing suggested,
   nothing fetched without a press, nothing stored, and a reload the published page again */
const PP_STATS_S = ['pts', 'g', 's', 'a', 'bs', 'sv'];
const PP_NAME_S = { pts: 'points', g: 'goals', s: 'shots on goal', a: 'assists', bs: 'blocked shots', sv: 'saves' };
const PROP_REF = id => `http://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/seasons/2027/athletes/${id}?lang=en&region=us`;
/* an item in ESPN's shape: a type, the athlete as a $ref, the price as a string, a main line's total (or a milestone's "k+") and target */
function pIt(name, id, price, total, target) {
  const it = { type: { id: '1', name } };
  if (id !== null) it.athlete = { $ref: PROP_REF(id) };
  it.odds = { american: { value: typeof price === 'number' ? (price > 0 ? '+' + price : String(price)) : price }, total: total === undefined ? {} : { value: String(total) } };
  if (target !== undefined) it.current = { target: { value: target, displayValue: String(total) } };
  return it;
}
const ppPctS = p => p > 0 && p < 0.005 ? '<1%' : p < 1 && p > 0.995 ? '>99%' : Math.round(p * 100) + '%';
const ppMuS = (k, mu) => k === 's' || k === 'sv' ? mu.toFixed(1) : mu.toFixed(2);
/* P(X >= k) from a published distribution (d[0] is P(X <= lo), the last entry the tail), summed here again */
const atLeastS = (D, k) => { const lo = +D.lo || 0; let s = 0; D.d.forEach((x, i) => { if (lo + i >= k || (i === 0 && k <= lo)) s += x; }); return s / 10000; };
const fairYesS = (k, n, price) => { const y = S.props && S.props.fair && S.props.fair.yes, m = y ? +y[k === 'g' && n >= 2 ? 'g2+' : k] : NaN; return isFinite(m) && m > 0 ? PBS.imp(price) / m : null; };
/* the made-up answer for a game: every projected skater and goalie priced as DraftKings prices them, a pair the ladder says was
   read backwards, an athlete nobody projects and a club's player the model leaves out, and junk the parse must skip */
function propsAnswer(g) {
  const pr = S.props.games[g.id], items = [];
  const pair = (name, id, L, po, pu) => items.push(pIt(name, id, po, L, L), pIt(name, id, pu, L, L));
  const mile = (name, id, k, price) => items.push(pIt(name, id, price, k + '+', k));
  const yes = (name, id, price) => items.push(pIt(name, id, price));
  const proj = new Set();
  for (const side of ['awayP', 'homeP']) {
    const Q = pr[side];
    Q.skaters.forEach((p, i) => {
      proj.add(p.id);
      const po = i % 2 ? -130 : 115, pu = i % 2 ? 105 : -145;
      pair('Total Points', p.id, 0.5, po, pu); mile('Points Milestones', p.id, 1, po); mile('Points Milestones', p.id, 2, 260 + 10 * i);
      if (i % 3 === 0) { pair('Total Assists', p.id, 0.5, 150, -195); mile('Assists Milestones', p.id, 2, 700); }
      if (i < 6) { pair('Total Shots on Goal', p.id, i % 2 ? 1.5 : 2.5, -120, -110); mile('Shots on Goal Milestones', p.id, 2, -400); mile('Shots on Goal Milestones', p.id, 3, -120); mile('Shots on Goal Milestones', p.id, 4, 175); }
      if (p.pos === 'D') pair('Total Blocked Shots', p.id, 1.5, 110, -140);
      yes('Anytime Goalscorer', p.id, 180 + 20 * i); if (i < 4) yes('To Score 2+ Goals', p.id, 900 + 100 * i);
      if (i === 0) mile('Goals Milestones', p.id, 2, 950);                 // the same bet as To Score 2+ Goals: the first is kept
    });
    if (Q.goalie) { proj.add(Q.goalie.id); pair('Total Saves', Q.goalie.id, 24.5, -115, -115); mile('Goalkeeper Saves Milestones', Q.goalie.id, 25, -115); mile('Goalkeeper Saves Milestones', Q.goalie.id, 30, 280); }
  }
  /* read backwards by its ladder: the Under first (the 2+ milestone at the second item's price, more than 5 points apart): left out */
  const back = pr.homeP.skaters.find((p, i) => i % 3 === 1) || null;
  if (back) { pair('Total Assists', back.id, 1.5, -700, 400); mile('Assists Milestones', back.id, 2, 400); }
  /* an athlete nobody projects and nobody rates; a club's rated player the model leaves out of its lineup */
  pair('Total Points', '990000001', 0.5, 300, -450); yes('Anytime Goalscorer', '990000001', 900);
  const PL = (S.players && S.players.players) || {}, left = Object.keys(PL).find(id => PL[id].team === g.home && PL[id].pos !== 'G' && !proj.has(id)) || null;
  if (left) pair('Total Shots on Goal', left, 1.5, -105, -125);
  /* junk: a team market, a price that is not one, a missing line, null, a lone item */
  items.push(Object.assign(pIt('Team Total Goals (Excl OT)', null, -630, 1.5, 1.5), { team: { $ref: 'http://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/seasons/2027/teams/2?lang=en&region=us' } }));
  items.push(pIt('Total Points', pr.awayP.skaters[0] ? pr.awayP.skaters[0].id : '990000002', 'N/A', 1.5, 1.5), pIt('Total Shots on Goal', '990000003', -110), null);
  const fw = pr.awayP.skaters.find(p => p.pos !== 'D'); if (fw) items.push(pIt('Total Blocked Shots', fw.id, 140, 0.5, 0.5));
  return { items, left, back: back && back.id };
}
/* a Player props button of Pick your own legs (the one place the button is left: a game's card is the way in on the Games tab), by the
   read it stands on: its word alone, the read on its title, lit where DraftKings priced the game; nothing on it says "model says" or "edge" */
function plBtnsBad(d, of, AT) {
  const tab0 = d.querySelector('#tabs button.on'), pt = d.querySelector('#tabs button[data-tab="parlays"]'); closeBets(d); pt.click();
  const btns = [...d.querySelectorAll('#plLines button[data-pp]')], bad = [];
  for (const b of btns) { const id = b.dataset.pp, gx = S.games.find(y => y.id === id), [word, title, has] = ppBtnWant(of(id), !!(S.props && S.props.games && S.props.games[id]), !!gx && sPropsAsk(AT).some(y => y.id === id));
    if (txt(b) !== word || !ppTitleIs(b, title, undefined) || b.classList.contains('has') !== has || b.getAttribute('aria-haspopup') !== 'dialog' || /model says|\bedge/i.test(txt(b) + ' ' + b.title.replace(GB_TITLE, ''))) bad.push(`${id}: "${txt(b)}" | ${b.title}`); }
  if (tab0 && tab0 !== pt) tab0.click();
  return { n: btns.length, bad };
}
async function playerPropsChecks() {
  console.log('PLAYER PROPS');
  /* the parse: the page's PROPS_FEED.propsOf is tools/espn.js's propsOf, on the recorded answer and variants of it */
  const FIXP = readJSON(path.join(__dirname, 'fixtures', 'espn_propbets.json'));
  chk(!!FIXP && Array.isArray(FIXP.items) && FIXP.items.length > 100, 'tools/fixtures/espn_propbets.json holds a recorded propBets answer');
  {
    const errs = [], w = await boot(PUB + 60000, errs, { hash: 'games' });
    const rec = FIXP ? FIXP.items : [];
    const swap = a => { const out = a.slice(); for (let i = 0; i + 1 < out.length; i++) { const x = out[i], y = out[i + 1]; if (x && y && x.type && y.type && x.type.name === y.type.name && x.athlete && y.athlete && x.athlete.$ref === y.athlete.$ref && x.odds && y.odds && x.odds.total && y.odds.total && x.odds.total.value === y.odds.total.value && /^Total /.test(x.type.name)) { out[i] = y; out[i + 1] = x; i++; } } return out; };
    const noLadder = a => a.filter(x => !/Milestones/.test(x.type.name));
    const junked = a => { const o = JSON.parse(JSON.stringify(a)); o.forEach((x, i) => { if (i % 17 === 0) x.odds.american.value = ['N/A', '', 'EVEN', '+0', '50', 'EV', null][i % 7]; if (i % 23 === 0) delete x.athlete; if (i % 29 === 0) delete x.odds.total; }); return o.concat([null, 7, 'x', {}, { type: {} }]); };
    const split = a => { const o = a.slice(), i = o.findIndex(x => /^Total /.test(x.type.name)); if (i >= 0) o.splice(i + 1, 0, pIt('1st Period Moneyline', null, 180)); return o; };
    const triple = a => { const o = a.slice(), i = o.findIndex(x => /^Total /.test(x.type.name)); if (i >= 0) o.splice(i + 2, 0, JSON.parse(JSON.stringify(o[i]))); return o; };
    const cases = [['recorded', rec], ['every pair swapped', swap(rec)], ['swapped with no ladder', swap(noLadder(rec))], ['junk inside', junked(rec)], ['a pair split by another item', split(rec)], ['a pair of three', triple(rec)], ['reversed', rec.slice().reverse()], ['empty', []], ['null', null], ['an object', {}], ['a string', 'x']];
    const page = JSON.parse(w.eval(`JSON.stringify(${JSON.stringify(cases.map(c => c[1]))}.map(a => PROPS_FEED.propsOf(a)))`)), job = cases.map(c => E.propsOf(c[1]));
    const differ = cases.filter((c, i) => canon(page[i]) !== canon(job[i])).map(c => c[0]);
    chk(!differ.length, `the page's props parse is tools/espn.js's propsOf on ${cases.length} answers (${cases.map(c => c[0]).join(', ')}; ${differ.length} differ: ${differ.join(', ')})`);
    /* the first item of a pair is the Over: on the recorded answer the ladder's (L+0.5)+ milestone is the first item's price, and
       with every pair swapped a pair the ladder contradicts is left out, never read backwards */
    const R = job[0], lad = new Map(R.yes.map(([a, st, k, p]) => [a + '|' + st + '|' + k, p]));
    const withRung = R.main.filter(([a, st, L]) => lad.has(a + '|' + st + '|' + (Math.floor(L) + 1)));
    const nearUnder = withRung.filter(([a, st, L, po, pu]) => { const m = PBS.imp(lad.get(a + '|' + st + '|' + (Math.floor(L) + 1))); return Math.abs(m - PBS.imp(pu)) < Math.abs(m - PBS.imp(po)); });
    chk(R.main.length > 20 && withRung.length > 10 && !nearUnder.length && R.skipped.contradicted === 0, `on the recorded answer every main line with a milestone beside it has the milestone at its Over's price, the first item (${withRung.length} of ${R.main.length} checked, ${nearUnder.length} nearer the Under)`);
    const Sw = job[1], apart = withRung.filter(([, , , po, pu]) => Math.abs(PBS.imp(po) - PBS.imp(pu)) > 0.05).length;
    const backwards = Sw.main.filter(([a, st, L, po, pu]) => { const k = a + '|' + st + '|' + (Math.floor(L) + 1); if (!lad.has(k)) return false; const m = PBS.imp(lad.get(k)); return Math.abs(m - PBS.imp(pu)) < Math.abs(m - PBS.imp(po)) && Math.abs(PBS.imp(po) - PBS.imp(pu)) > 0.05; });
    chk(Sw.skipped.contradicted === apart && !backwards.length, `with every pair swapped, each pair its ladder contradicts is left out (${Sw.skipped.contradicted} left out, ${apart} more than 5 points apart with a milestone; ${backwards.length} read backwards)`);
    chk(job[4].skipped.unpaired >= 1 && job[5].skipped.unpaired >= 1 && job[3].skipped.junk >= 5, `a split pair and a pair of three are left out, junk is skipped (${job[4].skipped.unpaired}, ${job[5].skipped.unpaired} unpaired; ${job[3].skipped.junk} junk)`);
    chk(!errs.length, 'no runtime error in the parse checks: ' + errs.join(' | '));
  }
  /* nothing fetched without a press: load, every window and stat, the watch and every tab ask ESPN for no props */
  const AT = PUB + 60000, ask = sPropsAsk(AT), projected = ask.filter(g => S.props && S.props.games && S.props.games[g.id]);
  {
    const errs = [], w = await boot(AT, errs, { hash: 'games' }), d = w.document, writes0 = w.__writes.length, st0 = w.localStorage.getItem('nhl_v1');
    /* nhl v27: a game's card is the way in; the Player props button is left in Pick your own legs alone */
    chk(!d.querySelector('#gamesList button[data-pp]') && !d.querySelector('#gameModal button[data-pp]'), 'no Player props button on a game\'s row: the row opens the game\'s page');
    { const PB = plBtnsBad(d, () => null, AT); chk(!PB.bad.length, `before a press each Player props button of Pick your own legs says, on its title, that it shows the model's projections (on trial) until Refresh odds (${PB.n} buttons; ${PB.bad.slice(0, 2).join(' || ')})`); }
    let g0 = null;
    if (projected.length) {
      g0 = projected[0];
      /* the page before a press: every expected player's projection, no line, no box, the status line saying the player lines are not read */
      const b0 = gpWrongs(w, g0, AT, null, {});
      chk(!b0.length, `before a press the game's page shows the props model's projection for every expected player in every stat, no DraftKings line and no box, and says the player lines are not read yet (${g0.away} @ ${g0.home}: ${b0.opened} players opened; ${b0.length} wrong: ${b0.slice(0, 3).join(' | ')})`);
      chk(pageOn(d, g0.id) && !d.querySelector('#gameView input[data-pp-add]') && /player lines not read yet\.$/.test(txt(d.getElementById('ppOddsNote'))), `with no DraftKings price read, no price on the page can be added (${txt(d.getElementById('ppOddsNote'))})`);
      closeBets(d);
      /* Pick your own legs carries the button, which opens the game's page; closed, the focus is back on the button */
      d.querySelector('#tabs button[data-tab="parlays"]').click();
      const pick = d.querySelector('#plLines .pb-pg button[data-pp]');
      if (pick) {
        const pg = S.games.find(g => g.id === pick.dataset.pp); pick.focus(); pick.click();
        chk(pageOn(d, pg.id) && d.activeElement === d.querySelector('#gameModal .modal-panel') && !d.getElementById('tab-parlays').hidden, `a Player props button of Pick your own legs opens its game's page over the tab, the focus in it (${pg.away} @ ${pg.home})`);
        d.getElementById('backBtn').click();
        chk(d.getElementById('gameModal').hidden && d.activeElement === d.querySelector(`#plLines button[data-pp="${pg.id}"]`), 'closed, the focus goes back to the button');
      }
      d.dispatchEvent(new w.Event('visibilitychange'));
      for (const t of ['ratings', 'games', 'players', 'parlays']) d.querySelector(`#tabs button[data-tab="${t}"]`).click();
    } else console.log('  no game still to come today or tomorrow that the props model projects: the page before a press is not opened');
    chk(!propReqs(w).length, `nothing asks ESPN for props without a press: load, a game's page and its players, the watch and the tabs (${propReqs(w).length} asked)`);
    const st1 = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}');
    chk(!/pp|prop/i.test(JSON.stringify(Object.keys(st1).concat(Object.keys(st1.ui || {})))), `the page stores nothing of the props: nhl_v1 holds no props key (${Object.keys(st1).join(', ')}; ui ${Object.keys(st1.ui || {}).join(', ')})`);
    chk(!errs.length, 'no runtime error before a press: ' + errs.join(' | '));
    void st0; void writes0;
    w.close();
  }
  if (!projected.length) { console.log('  no projected game to come today or tomorrow: the press with props is skipped'); return; }
  /* the press. Roles among the games it reads props for: one whose puck drops during the read (the clock passes the first puck drop
     before ESPN answers), the projected game read in two pages, one that fails, one with a junk body, one of the wrong shape, one
     whose page two answers 404, one ESPN's scoreboard has under way, one it has postponed and one cancelled (each with a full props
     answer that would otherwise be kept; and at the second press the game read in its first page postponed too, its earlier read
     dropped); the rest ESPN's 404 */
  const first = ask.slice().sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  const later2 = projected.filter(g => Date.parse(g.start) > Date.parse(first.start));
  const T2 = later2.length ? Date.parse(first.start) + 60000 : AT;
  const live = ask.filter(g => !sStarted(g, T2)), taken = new Set();
  const pick = f => { const g = live.find(x => !taken.has(x.id) && f(x)) || null; if (g) taken.add(g.id); return g; };
  const G = pick(x => S.props.games[x.id]), H = pick(() => true), N = pick(() => true), K = pick(() => true), P2 = pick(x => S.props.games[x.id]), I = pick(() => true);
  const PO = pick(x => S.props.games[x.id]), CA = pick(x => S.props.games[x.id]);
  const OFF = { name: 'STATUS_POSTPONED', state: 'pre', description: 'Postponed', shortDetail: 'Postponed' }, CANC = { name: 'STATUS_CANCELED', state: 'pre', description: 'Canceled', shortDetail: 'Canceled' };
  const offNow = new Map([[PO && PO.id, OFF], [CA && CA.id, CANC]].filter(([id]) => id));        // ESPN's word on the games called off; the second press adds P2
  const A = propsAnswer(G), half = Math.floor(A.items.length / 2), ansP2 = P2 ? propsAnswer(P2).items.slice(0, 2) : null;
  const parsedG = E.propsOf(A.items), parsedP2 = P2 ? E.propsOf(ansP2) : null;
  chk(parsedG.main.length > 10 && parsedG.skipped.contradicted >= (A.back ? 1 : 0) && parsedG.skipped.unpaired >= 1 && parsedG.skipped.junk >= 2, `the made-up answer is a real test: ${parsedG.main.length} main lines, ${parsedG.yes.length} milestones, ${parsedG.skipped.contradicted} read backwards, ${parsedG.skipped.unpaired} unpaired, ${parsedG.skipped.junk} junk`);
  const gate = { on: true }; let release = () => {}; const gated = new Promise(r => { release = r; });
  const propsFn = async url => {
    const m = PROPS_RX.exec(url), id = m && m[1], pg = m && +m[2];
    if (gate.on) await gated;
    if (G && id === G.id) return { ok: true, status: 200, json: async () => ({ count: A.items.length, pageIndex: pg, pageSize: 1000, pageCount: 2, items: JSON.parse(JSON.stringify(pg === 1 ? A.items.slice(0, half) : A.items.slice(half))) }) };
    if (H && id === H.id) return { ok: false, status: 503, json: async () => ({}) };
    if (N && id === N.id) return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } };
    if (K && id === K.id) return { ok: true, status: 200, json: async () => ({ items: 'x' }) };
    if (P2 && id === P2.id) return pg === 1 ? { ok: true, status: 200, json: async () => ({ pageCount: 2, items: JSON.parse(JSON.stringify(ansP2)) }) } : PROPS_404(url);
    for (const g of [PO, CA]) if (g && id === g.id) return { ok: true, status: 200, json: async () => ({ pageCount: 1, items: JSON.parse(JSON.stringify(propsAnswer(g).items)) }) };
    return PROPS_404(url);
  };
  /* ESPN's scoreboard: every game with no odds (no line moves, so nothing the levels stand on moves), the one under way as under way */
  const sbFn = async url => { const mm = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), dd = mm && `${mm[1]}-${mm[2]}-${mm[3]}`; if (gate.on) await gated;
    return { ok: true, json: async () => ({ events: S.games.filter(g => g.date === dd).map(g => espnEvent(g, null, I && g.id === I.id ? { name: 'STATUS_IN_PROGRESS', state: 'in', description: 'In Progress', shortDetail: '1st' } : offNow.get(g.id))) }) }; };
  let propsNow = propsFn;                       // the answer the props stub gives, swapped for the second press
  const errs = [], w = await boot(AT, errs, { hash: 'parlays', espn: sbFn, props: url => propsNow(url) }), d = w.document;
  const writes0 = w.__writes.length, store0 = w.localStorage.getItem('nhl_v1'), games0 = canon(pageGames(w)), v0 = w.eval('ODDS.v');
  const tiers0 = [...d.querySelectorAll('#pbBody .t30-r')].map(x => x.dataset.id), legs0 = w.eval('JSON.stringify(P.legs)');
  d.getElementById('pbRefreshOdds').click();
  await wait(5);
  const asked = propReqs(w).map(r => r.url);
  chk(asked.length === ask.length && ask.every(g => asked.some(u => { const m = PROPS_RX.exec(u); return m && m[1] === g.id && m[2] === '1'; })) && propReqs(w).every(r => r.method === 'GET' && r.cache === 'no-store'),
    `a press asks ESPN for the props of every game still to come today and tomorrow, one request each, GET, no-store, a cache-buster on each (${asked.length} asked, ${ask.length} games: ${ask.map(g => g.id).join(', ')})`);
  w.__setClock(T2); gate.on = false; release();
  chk(await oddsDone(w), 'the read with props finishes');
  await wait(20);
  chk(propReqs(w).length === ask.length + 1 + (P2 ? 1 : 0), `a second page is asked only where ESPN pages the answer (${propReqs(w).length - ask.length} more)`);
  const at = (() => { const r = JSON.parse(w.eval('JSON.stringify(PROPS.games)')); const x = Object.values(r).find(v => v.at); return x ? Date.parse(x.at) : T2; })();
  const PR = JSON.parse(w.eval('JSON.stringify(PROPS.games)'));
  /* what the press keeps, game by game */
  const q = { asked: ask.length, got: 0, lines: 0, none: 0, failed: 0, kept: 0, started: 0, off: 0 }, badK = [];
  for (const g of ask) {
    const r = PR[g.id];
    if (sStarted(g, T2) || g === I) { q.started++; if (r) badK.push(`${g.id} started but kept`); continue; }
    if (g === PO || g === CA) { q.off++; if (r) badK.push(`${g.id}: ${g === PO ? 'postponed' : 'cancelled'} at ESPN, yet its props are kept`); continue; }
    if (g === G) { q.got++; q.lines += parsedG.main.length; if (!r || r.status !== 200 || canon(r.main) !== canon(parsedG.main) || canon(r.yes) !== canon(parsedG.yes)) badK.push(`${g.id}: not the job's parse of its two pages`); continue; }
    if (g === P2) { q.got++; q.lines += parsedP2.main.length; if (!r || r.status !== 200 || canon(r.main) !== canon(parsedP2.main)) badK.push(`${g.id}: page one's lines not kept when page two answered 404`); continue; }
    if (g === H || g === N || g === K) { q.failed++; if (!r || r.status !== 'failed') badK.push(`${g.id}: a ${g === H ? '503' : g === N ? 'junk body' : 'body of the wrong shape'} not a failed read`); continue; }
    q.none++; if (!r || r.status !== 404) badK.push(`${g.id}: a 404 not none`);
  }
  chk(!badK.length, `each game keeps what its answer gave: the joined pages parsed as the job parses them, a page two's 404 the end, a 503, a junk body and a wrong shape failed, a 404 none posted yet, a game started (by the clock or at ESPN) or called off at ESPN (postponed, cancelled) not kept (${badK.join('; ')})`);
  if (PO || CA) chk(q.off === [PO, CA].filter(Boolean).length && sPropsText(q).includes(`${q.off} game${q.off === 1 ? '' : 's'} called off at ESPN: not shown`), `the games ESPN has postponed and cancelled are counted as called off (${sPropsText(q).trim()})`);
  else console.log('  too few projected games to come for a postponed and a cancelled one: those cases are skipped');
  chk(Object.keys(PR).every(id => ask.some(g => g.id === id)), 'no props kept for a game the press did not ask for');
  chk(txt(d.getElementById('pbOddsNote')).endsWith(sPropsText(q)) && txt(d.getElementById('oddsNote')).endsWith(sPropsText(q)), `the status line says what the props read gave ("${sPropsText(q).trim()}": ${txt(d.getElementById('pbOddsNote')).slice(-200)})`);
  /* nothing stored, no line moved: every game, line and builder leg as before; the Top 30 and the suggested levels rank the player lines
     the read gave (nhl v18, the owner's call), held by this smoke's own sums on the page's reads; no player in the builder or Pick your own legs */
  chk(canon(pageGames(w)) === games0 && w.eval('ODDS.v') === v0 && w.eval('JSON.stringify(P.legs)') === legs0, 'the props read moves no game, line or builder leg: every one as before');
  holdPanel(w, T2, 'the Top 30 after a props press'); holdSuggest(w, T2, 'the suggested levels after a props press');
  void tiers0;
  const names = [...new Set([].concat(...Object.values(S.props.games).map(r => [...r.homeP.skaters, ...r.awayP.skaters].map(p => p.name))))].filter(n => n && n.length > 5);
  chk(d.querySelectorAll('#plLines button[data-pp]').length > 0 || !d.querySelector('#plLines .pb-pg'), 'Pick your own legs carries the Player props buttons it is held without');
  const panelT = ['builder', 'slip', 'plLines'].map(id => { const el = d.getElementById(id); if (!el) return ''; const c = el.cloneNode(true); c.querySelectorAll('button[data-pp]').forEach(x => x.remove()); return txt(c); }).join(' ');
  chk(!names.some(n => panelT.includes(n)) && [...d.querySelectorAll('#legs .leg')].every(x => /^\d+\|(home|away|over|under)\|(ml|pl|ou)$/.test(x.dataset.id)), 'no player is put in the builder or Pick your own legs by a press: every leg there is a game\'s');
  chk(w.__writes.length === writes0 && w.localStorage.getItem('nhl_v1') === store0, `the press writes nothing to storage (${w.__writes.length - writes0} writes)`);
  /* the page of the game read in two pages: every row and every number worked out here (THE GAME'S PAGE's own model, on the job's parse
     of the made-up answer), All skaters ticked so the player the model leaves out and the athlete nobody rates are listed */
  d.querySelector('#tabs button[data-tab="games"]').click();
  const dayOn = dd => openDay(d, dd), iso = ms => new Date(ms).toISOString(), view = d.getElementById('gameView');
  const rdG = { status: 200, at: iso(at), main: parsedG.main, yes: parsedG.yes };
  { const PB = plBtnsBad(d, id => PR[id] || null, T2); chk(!PB.bad.length, `after the press each Player props button of Pick your own legs says what DraftKings has and when, lit where it priced the game (${PB.n} buttons; ${PB.bad.slice(0, 2).join(' || ')})`); }
  const writesA = w.__writes.length;                       // the tabs' own saves; from here on nothing is written
  const bG = gpWrongs(w, G, T2, rdG, { all: true });
  chk(!bG.length, `${G.away} @ ${G.home} after the press: every row of its page is DraftKings' line, the projection, the props model's chance and DraftKings' fair chance worked out here (${bG.rows} rows, ${bG.opened} players opened; ${bG.length} wrong: ${bG.slice(0, 3).join(' | ')})`);
  chk(bG.opened > 20 && view.querySelectorAll('.plrbtn').length > 30, `the made-up answer fills the page: ${bG.opened} players opened`);
  if (A.left) { const r = view.querySelector(`.plrbtn[data-open="${A.left}"]`); chk(!!r && r.closest('#gameView') && !/projected|min\b/.test(txt(r)), `a player DraftKings prices whom the model leaves out is matched by his ESPN id to his club, listed last with All skaters, with no projection (${r && txt(r).slice(0, 100)})`); }
  { const r = view.querySelector('.plrbtn[data-nohist="990000001"]'); chk(!!r && /^ESPN athlete 990000001/.test(txt(r)) && /not matched to either club/.test(txt(r)) && !r.querySelector('input'), 'an athlete nobody rates is shown apart, by his ESPN id, and not offered'); }
  chk(w.__writes.length === writesA, `opening the page and its players writes nothing (${w.__writes.length - writesA} writes)`);
  /* the pages on a failed read, on none posted yet, and on the games ESPN called off (their props not kept) */
  const holdG = (g, rd, tag) => { const b = gpWrongs(w, g, T2, rd, { noPlayers: true }); chk(!b.length, `${tag} (${b.slice(0, 3).join(' | ')})`); return b; };
  if (H && S.props.games[H.id]) { holdG(H, PR[H.id], 'a failed read says so in the status line, the projections shown'); chk(/couldn't read player lines\.$/.test(txt(d.getElementById('ppOddsNote'))) && PR[H.id].why === 'HTTP 503', `the failed read's status line (${txt(d.getElementById('ppOddsNote'))})`); }
  const g404 = live.find(g => !taken.has(g.id) && S.props.games[g.id]);
  if (g404) { holdG(g404, PR[g404.id], 'a 404 says no player lines yet'); chk(/no player lines yet\.$/.test(txt(d.getElementById('ppOddsNote'))), `none posted yet, said (${txt(d.getElementById('ppOddsNote'))})`); }
  for (const g of [PO, CA].filter(Boolean)) {
    holdG(g, null, `${g.id}, ${g === PO ? 'postponed' : 'cancelled'} at ESPN: no DraftKings row on its page, though ESPN answered its props`);
    chk(!w.eval(`PROPS.games[${JSON.stringify(g.id)}]`) && !view.querySelector('input[data-pp-add]') && !view.querySelector('.plrbody'), `${g.id}: its props are not kept`);
  }
  closeBets(d); betsOn(d, G);
  /* a second press, from the page's own Refresh odds, the game read before failing now: its earlier read stands, said */
  const n1 = propReqs(w).length, T3 = T2 + 120000;
  if (!sStarted(G, T3)) {
    w.__setClock(T3);
    propsNow = async url => { const m = PROPS_RX.exec(url); return m && m[1] === G.id ? { ok: false, status: 502, json: async () => ({}) } : PROPS_404(url); };
    const before2 = JSON.stringify(JSON.parse(w.eval('JSON.stringify(PROPS.games)'))[G.id]);
    const p2had = P2 ? w.eval(`PROPS.games[${JSON.stringify(P2.id)}] && PROPS.games[${JSON.stringify(P2.id)}].status`) : null;
    if (P2) offNow.set(P2.id, OFF);                                                          // ESPN now has the game read in its first page postponed
    const rb = d.getElementById('ppRefreshOdds'); rb.focus(); rb.click();
    chk(d.getElementById('ppRefreshOdds').getAttribute('aria-busy') === 'true' && txt(d.getElementById('ppOddsNote')) === 'reading…', `while the read runs the page's Refresh odds is busy and its status line says reading (${txt(d.getElementById('ppOddsNote'))})`);
    await oddsDone(w); await wait(20);           // the page's own Refresh odds: the same press
    const ask3 = sPropsAsk(T3), after2 = JSON.stringify(JSON.parse(w.eval('JSON.stringify(PROPS.games)'))[G.id]);
    const off3 = ask3.filter(g => offNow.has(g.id) && g !== I);
    const q3 = { asked: ask3.length, none: ask3.filter(g => g !== G && g !== I && !offNow.has(g.id)).length, failed: 1, kept: 1, started: ask3.includes(I) ? 1 : 0, off: off3.length };
    if (P2 && ask3.includes(P2)) chk(p2had === 200 && !w.eval(`PROPS.games[${JSON.stringify(P2.id)}]`), `a game ESPN postpones after a read loses that earlier read: its props are no longer shown (${p2had} before, ${w.eval(`JSON.stringify(PROPS.games[${JSON.stringify(P2.id)}] || null)`)} after)`);
    chk(propReqs(w).length - n1 === ask3.length && after2 === before2, `a second press reads again, and a game whose read fails keeps this page's earlier read (${propReqs(w).length - n1} asked of ${ask3.length}; ${after2 === before2 ? 'kept' : 'changed'})`);
    chk(txt(d.getElementById('oddsNote')).endsWith(sPropsText(q3)), `and the tabs' status line says so ("${sPropsText(q3).trim()}": ${txt(d.getElementById('oddsNote')).slice(-160)})`);
    chk(pageOn(d, G.id) && d.activeElement === d.getElementById('ppRefreshOdds') && d.getElementById('ppRefreshOdds').getAttribute('aria-busy') === 'false', 'the page stays open through the press, the keyboard back on its Refresh odds, no longer busy');
    const b3 = gpWrongs(w, G, T3, rdG, { noPlayers: true });
    chk(!b3.length, `after the press the page is on the read it keeps, its status line this game's own (${txt(d.getElementById('ppOddsNote'))}; ${b3.slice(0, 2).join(' | ')})`);
  } else console.log('  the game read in two pages starts within two minutes: the second press is skipped');
  /* the watch: the game's puck drops with the page open */
  betsOn(d, G);
  const tD = Date.parse(G.start) + 60000;
  w.__setClock(tD);
  d.dispatchEvent(new w.Event('visibilitychange'));
  chk(pageOn(d, G.id) && !view.querySelector('input[data-leg], input[data-pp-add], #ppRefreshOdds') && !!view.querySelector('.gp-live'), `the page on a game whose puck drops is drawn again by the watch: no box left, the strip in (${txt(view.querySelector('.gp-live'))})`);
  { const bD = gpWrongs(w, G, tD, rdG, { noPlayers: true }); chk(!bD.length, `and it is the page of a game under way (${bD.slice(0, 3).join(' | ')})`); }
  closeBets(d);
  chk(w.__writes.length === writesA, `nothing in all of it is stored (${w.__writes.length - writesA} writes)`);
  holdRequests(w, 'the props press');
  chk(!errs.length, 'no runtime error through the props press: ' + errs.join(' | '));
  const storeP = w.localStorage.getItem('nhl_v1'); w.close();
  /* a press whose props answer prices a projected game in full and whose scoreboard moves no line: no line moves, and the Top 30 and
     the suggested levels are worked again with that game's player lines (nhl v18), each by this smoke's own sums on the read */
  {
    const errsS = [], wS = await boot(AT, errsS, { hash: 'parlays', espn: async url => { const mm = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), dd = mm && `${mm[1]}-${mm[2]}-${mm[3]}`; return { ok: true, json: async () => ({ events: S.games.filter(g => g.date === dd).map(g => espnEvent(g, null)) }) }; },
      props: async url => { const m = PROPS_RX.exec(url); return m && m[1] === G.id ? { ok: true, status: 200, json: async () => ({ pageCount: 1, items: JSON.parse(JSON.stringify(A.items)) }) } : PROPS_404(url); } }), dS = wS.document;
    const lv = () => { wS.eval('renderSuggest()'); return canon([[...dS.querySelectorAll('#pbBody .t30-r')].map(r => [r.dataset.id, txt(r)])].concat([...dS.querySelectorAll('#spBody .pb-tier')].map(t => [t.closest('.sp-day').dataset.spDay, t.dataset.tier, [...t.querySelectorAll('.pb-tl')].map(x => x.dataset.id), txt(t.querySelector('.pb-nums'))]))); };
    const l0 = lv(), v1 = wS.eval('ODDS.v'), g1 = canon(pageGames(wS));
    dS.getElementById('pbRefreshOdds').click(); await oddsDone(wS);
    const pool = JSON.parse(wS.eval('JSON.stringify(PB_CUR && PB_CUR.pool ? (PB_CUR.pool.legs || []).map(L => L.id) : [])'));
    chk(wS.eval('PROPS.games[' + JSON.stringify(G.id) + '] && PROPS.games[' + JSON.stringify(G.id) + '].status') === 200 && wS.eval('ODDS.v') === v1 && canon(pageGames(wS)) === g1, 'a props read moves no line');
    const PN = holdPanel(wS, AT, 'the Top 30 on a props read'); holdSuggest(wS, AT, 'the suggested levels on a props read');
    const mine = PN.pool ? PN.pool.legs.filter(L => L.prop && L.game === G.id).map(L => L.id).sort() : [];
    chk(canon(pool.filter(id => id.includes('|p|')).sort()) === canon(mine) && pool.filter(id => id.includes('|p|')).every(id => id.startsWith(G.id + '|p|')), `the pool holds exactly the read game's qualifying player lines, by this smoke's own sums (${mine.length}; the page ${pool.filter(id => id.includes('|p|')).length})`);
    void l0;
    chk(!errsS.length, 'no runtime error on the nothing-suggested press: ' + errsS.join(' | '));
    wS.close();
  }
  /* a reload: the published page again, the projections alone */
  {
    const errsR = [], wR = await boot(T2, errsR, { hash: 'games', store: storeP }), dR = wR.document;
    const bR = gpWrongs(wR, G, T2, null, { noPlayers: true });
    chk(wR.eval('Object.keys(PROPS.games).length') === 0 && !bR.length && !dR.querySelector('#gameView input[data-pp-add]'), `a reload is the published page: no DraftKings props, the game's page back to the projections alone (${bR.slice(0, 2).join(' | ')})`);
    chk(!propReqs(wR).length && !errsR.length, `and asks ESPN for no props (${propReqs(wR).length}; ${errsR.join(' | ')})`);
    wR.close();
  }
  console.log(`  the press read props for ${ask.length} games (${ask.map(g => g.id).join(', ')}): ${G.id} in two pages (${parsedG.main.length} main lines, ${parsedG.yes.length} milestones), ${H ? H.id : 'none'} failed, ${N ? N.id : 'none'} a junk body, ${K ? K.id : 'none'} the wrong shape, ${P2 ? P2.id : 'none'} a page two 404, ${I ? I.id : 'none'} under way at ESPN, ${ask.filter(g => sStarted(g, T2)).length} dropping the puck during the read`);
}

/* ================= SAME-GAME PARLAYS AND PLAYER LEGS =================
   The builder's player legs (a DraftKings price from the props window, after a press) and its same-game legs, held with rules of their
   own: the state's same-game table and hold are data/corr.json's, and its box scores the box files' (each final of the window, each
   player on the ice, a side whose starter the box cannot tell apart), both required of any state but the last published one
   unchanged; the page's copy of tools/sgp.js is the file's word for word and gives its numbers; on a made-up copy of the state
   carrying the table (as the job's next publish does), a press, and every DraftKings price in the window a 44px button that puts that
   leg in the builder at its price, dated by its read; the same-game rule (a second side bet or total replaces the first, one leg a player
   a stat, a player's points beside his own goals refused, at most 21 legs of one game, each said); the price of a game's legs worked out here again from the table and
   the hold (an exact bivariate normal for two legs, a Monte Carlo of two million draws beyond), never above the legs' prices multiplied,
   est. wherever it shows; DraftKings' fair chance first, the props model's chance on trial and never an edge; the card, its note, image
   and Share text (a player leg to add by hand); nothing of the read stored but the legs added; a reload at their read prices, dated; a
   later read re-pricing, moving and pulling them (said once, nothing stored); the puck drop; the levels as they were; and saved parlays'
   player legs graded from planted box scores (won, lost, a push, void, waiting, past the window, a start not certain), the grades kept */
const SG = (() => {
  /* the standard normal, written here again by another road: erf's series near 0, erfc's continued fraction beyond */
  function erfc(x) {
    if (x < 0) return 2 - erfc(-x);
    if (x < 3) { let s = 0, t = x; for (let n = 0; n < 200; n++) { const term = t / (2 * n + 1); s += term; if (Math.abs(term) < 1e-17) break; t *= -x * x / (n + 1); } return 1 - 2 / Math.sqrt(Math.PI) * s; }
    let t = x; for (let n = 80; n >= 1; n--) t = x + (n / 2) / t;
    return Math.exp(-x * x) / (Math.sqrt(Math.PI) * t);
  }
  const Phi = x => 0.5 * erfc(-x / Math.SQRT2), phi = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  const q = p => { let lo = -40, hi = 40; for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; };
  /* P(Z1 <= a, Z2 <= b) with correlation r: phi(x) Phi((b - r x) / sqrt(1 - r^2)) summed by Simpson's rule up to a */
  function bvn(a, b, r) {
    const lo = -12, hi = Math.min(a, 12); if (!(hi > lo)) return 0;
    const N = 6000, h = (hi - lo) / N, sd = Math.sqrt(1 - r * r); let sum = 0;
    for (let i = 0; i <= N; i++) { const x = lo + i * h, wt = i === 0 || i === N ? 1 : i % 2 ? 4 : 2; sum += wt * phi(x) * Phi((b - r * x) / sd); }
    return sum * h / 3;
  }
  const chol = (R, tol) => { const n = R.length, L = R.map(r => r.map(() => 0)); for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let v = R[i][j]; for (let k = 0; k < j; k++) v -= L[i][k] * L[j][k]; if (i === j) { if (!(v > tol)) return null; L[i][i] = Math.sqrt(v); } else L[i][j] = v / L[j][j]; } return L; };
  /* positive definite in use: shrunk toward independence by the least lambda, to 1e-4 by halving, that leaves every pivot above 1e-6 */
  function pd(R) { const at = l => R.map((r, i) => r.map((v, j) => i === j ? 1 : v * (1 - l))); if (chol(R, 1e-6)) return R; let lo = 0, hi = 1; for (let i = 0; i < 14; i++) { const m = (lo + hi) / 2; if (chol(at(m), 1e-6)) hi = m; else lo = m; } return at(hi); }
  function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  /* the chance every leg lands: one leg its chance, two the integral, more a Monte Carlo of N draws (with its standard error) */
  function joint(ps, R, N = 2000000) {
    if (ps.length === 1) return { p: ps[0], se: 0 };
    if (ps.length === 2) return { p: bvn(q(ps[0]), q(ps[1]), R[0][1]), se: 0 };
    const L = chol(R, 0), h = ps.map(q), rnd = mulberry(20261015); let hit = 0;
    for (let s = 0; s < N; s++) {
      const z = []; for (let i = 0; i < ps.length; i += 2) { const u = rnd() || 1e-12, v = rnd(), m = Math.sqrt(-2 * Math.log(u)); z.push(m * Math.cos(2 * Math.PI * v), m * Math.sin(2 * Math.PI * v)); }
      let all = true; for (let i = 0; i < ps.length && all; i++) { let x = 0; for (let k = 0; k <= i; k++) x += L[i][k] * z[k]; if (x > h[i]) all = false; }
      if (all) hit++;
    }
    const p = hit / N; return { p, se: Math.sqrt(p * (1 - p) / N) };
  }
  /* a leg's latent, read here again from tools/sgp.js's header: a player's stat (its group and stat), a club's win, the -1.5 side's cover
     (a +1.5 is that side failing), the total going over; the end it lands at (an Under, a +1.5) is -1 */
  const lat = l => l.kind === 'ml' ? { t: 'ml', team: l.team, fav: !!l.fav, dir: 1 }
    : l.kind === 'pl' ? (l.line < 0 ? { t: 'pl', team: l.team, fav: !!l.fav, dir: 1 } : { t: 'pl', team: l.opp, fav: !l.fav, dir: -1 })
    : l.kind === 'tot' ? { t: 'tot', dir: l.side === 'under' ? -1 : 1 }
    : { t: 'p', team: l.team, pid: String(l.pid), k: `${l.grp}:${l.stat}`, dir: l.side === 'under' ? -1 : 1 };
  const key = (rel, a, b) => a <= b ? `${rel}|${a}|${b}` : `${rel}|${b}|${a}`;
  /* two legs of one game: the table's correlation, signed by the ends they land at; undefined where the rule refuses the pair */
  function rho(T, x, y) {
    const a = lat(x), b = lat(y), v = k => (typeof T.rho[k] === 'number' ? T.rho[k] : 0);
    let r;
    if (a.t === 'p' && b.t === 'p') {
      if (a.pid === b.pid) { if (a.k === b.k || !(key('self', a.k, b.k) in T.rho)) return undefined; r = v(key('self', a.k, b.k)); }
      else r = v(key(a.team === b.team ? 'team' : 'opp', a.k, b.k));
    } else if (a.t === 'p' || b.t === 'p') {
      const p = a.t === 'p' ? a : b, o = a.t === 'p' ? b : a;
      r = o.t === 'ml' ? v(key('team', p.k, 'ml')) * (p.team === o.team ? 1 : -1) : o.t === 'pl' ? v(key(p.team === o.team ? 'team' : 'opp', p.k, 'pl')) : v(key('game', p.k, 'tot'));
    } else {
      const s = [a.t, b.t].sort().join('|');
      if (s === 'ml|tot') { const m = a.t === 'ml' ? a : b; r = v('fav|ml|tot') * (m.fav ? 1 : -1); }
      else if (s === 'pl|tot') { const m = a.t === 'pl' ? a : b; r = v((m.fav ? 'fav' : 'dog') + '|pl|tot'); }
      else return undefined;
    }
    return r * a.dir * b.dir;
  }
  /* a parlay by the rule: games multiplied; a game's legs joined on their fair chances (the fair chance) and their implied chances (the
     price: the hold over the joint, never above the legs' prices multiplied); se and seI the Monte Carlo's standard errors where it ran */
  function parlay(T, legs) {
    const by = new Map(); for (const l of legs) { if (!by.has(l.game)) by.set(l.game, []); by.get(l.game).push(l); }
    let fair = 1, dec = 1, product = 1, est = false, se = 0, seI = 0;
    for (const ls of by.values()) {
      const mult = ls.reduce((a, l) => a * l.dec, 1); product *= mult;
      if (ls.length === 1) { fair = fair === null || ls[0].p === null ? null : fair * ls[0].p; dec *= mult; continue; }
      const R = ls.map((x, i) => ls.map((y, j) => i === j ? 1 : rho(T, x, y)));
      if (R.some(r => r.some(v => v === undefined))) return { refused: true };
      const Rp = pd(R), fj = ls.some(l => l.p === null) ? null : joint(ls.map(l => l.p), Rp), ij = joint(ls.map(l => 1 / l.dec), Rp);
      fair = fair === null || fj === null ? null : fair * fj.p; se = Math.max(se, fj ? fj.se : 0); seI = Math.max(seI, ij.se);
      dec *= Math.min(mult, T.hold.sgp / ij.p); est = true;
    }
    return { fair, dec, product, est, se, seI };
  }
  return { Phi, q, bvn, joint, rho, parlay, pd };
})();
const etClockS = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
/* the favourite, by this smoke's reading of the rule: the club whose moneyline implies more (level, the home club), else the club laying -1.5 */
function sFav(g, side) {
  const L = g.line || {}, ih = PBS.ok(L.homeML) ? PBS.imp(L.homeML) : null, ia = PBS.ok(L.awayML) ? PBS.imp(L.awayML) : null;
  const homeFav = ih !== null && ia !== null ? ih >= ia : L.homeLine !== null && L.homeLine !== undefined ? L.homeLine < 0 : true;
  return side === 'home' ? homeFav : !homeFav;
}
/* a stored builder leg as the rule reads it, here: p its DraftKings fair chance (or `chance`, a function of the leg), dec its price */
function sgOf(M, l, chance) {
  const g = M.games.find(x => x.id === l.game), dc = PBS.decOf(+l.odds);
  if (l.kind === 'prop') {
    const f = l.mk === 'yes' ? fairYesS(l.stat, l.k, +l.odds) : l.side === 'over' ? 1 - PBS.imp(+l.other) : PBS.imp(+l.odds);
    return { game: l.game, team: l.team, pid: String(l.pid), grp: l.grp, stat: l.stat, side: l.side, p: chance ? chance(l) : f, dec: dc };
  }
  const L = sLeg(g, l.side, l.kind), p = chance ? chance(l) : L.fair;
  if (l.kind === 'ou') return { game: l.game, kind: 'tot', side: l.side, p, dec: dc };
  return { game: l.game, team: g[l.side], opp: g[l.side === 'home' ? 'away' : 'home'], kind: l.kind, line: L.num, fav: sFav(g, l.side), p, dec: dc };
}
/* the props model's chance of a stored player leg, from the state's distribution, worked here again (null where it has none) */
function sModelP(M, l) {
  const pr = M.props && M.props.games[l.game]; if (!pr) return null;
  let D = null;
  for (const s of ['awayP', 'homeP']) { const Q = pr[s]; if (l.stat === 'sv') { if (Q.goalie && String(Q.goalie.id) === String(l.pid)) D = Q.goalie.sv; } else for (const x of Q.skaters) if (String(x.id) === String(l.pid) && x[l.stat]) D = x[l.stat]; }
  if (!D) return null;
  return l.mk === 'yes' ? atLeastS(D, l.k) : l.side === 'over' ? atLeastS(D, Math.floor(+l.line) + 1) : 1 - atLeastS(D, Math.ceil(+l.line));
}
/* one box line as the state must carry it for grading, by this smoke's own reading: each skater on the ice and his four counts; per
   side, a lone goalie is its starter; of two or more, the one the box file marks started only if every other made a save of his own
   (the mark is the first save ESPN's plays name, so a starter pulled without a save, or a reliever without one, leaves it unsure):
   then the marked one's saves in g and the rest, relief, in r; else every goalie of that side in u, graded nowhere */
const isObjS = x => !!x && typeof x === 'object' && !Array.isArray(x);
function boxRuleS(b) {
  const s = {}, gk = {}, rel = [], uns = [], n = v => typeof v === 'number' ? v : null;
  for (const x of b.skaters) if (x.toi > 0) s[x.id] = [n(x.g), n(x.a), n(x.s), n(x.bs)];
  for (const club of [b.home, b.away]) {
    const gs = b.goalies.filter(x => x.team === club && x.toi > 0);
    if (!gs.length) continue;
    const marked = gs.length === 1 ? gs[0] : gs.find(x => x.st === 1);
    const sure = !!marked && gs.every(x => x === marked || (typeof x.sa === 'number' && typeof x.ga === 'number' && x.sa > x.ga));
    for (const x of gs) if (!sure) uns.push(x.id); else if (x === marked) gk[x.id] = typeof x.sa === 'number' && typeof x.ga === 'number' ? x.sa - x.ga : null; else rel.push(x.id);
  }
  return Object.assign({ s, g: gk }, rel.length ? { r: rel.sort() } : {}, uns.length ? { u: uns.sort() } : {});
}
/* ---------- THE JOB'S PLAYER LINES (nhl v16) ----------
   props.js reads DraftKings' player lines from ESPN on every game it projects, every run; the state carries each game's read
   (props.games[id].dk) and the run's counts (props.dk). Held here: the read's shape on the state as published; the page starting
   from it on every load, asking ESPN for nothing (every Player props button's words, every window row for row by this smoke's own
   sums, a price put in the parlay at the job's read and its time, and drawn so after a reload); a Refresh odds press whose reads
   fail keeping the job's read, said, and one that answers replacing it, said; a reload the job's read again. On the state as
   published where it carries a read, and always on a copy with a read planted on the projected games to come (an answer, none
   posted yet, a failed read) */
const DK_STATS = ['g', 'a', 'pts', 's', 'bs', 'sv'];
const sN = (k, one, many) => `${k} ${k === 1 ? one : many}`;
function dkShapeBad(dk, g) {
  if (!dk || typeof dk !== 'object') return 'no read';
  const at = Date.parse(dk.at);
  if (!isFinite(at) || new Date(at).toISOString() !== dk.at) return `read at ${dk.at}`;
  if (at > Date.parse(S.published) + 60000) return `read at ${dk.at}, after the publish`;
  if (g && at >= Date.parse(g.start)) return `read at ${dk.at}, at or after its puck drop`;
  const keys = Object.keys(dk).sort().join();
  if (dk.status === 404) return keys === 'at,status' ? null : `a 404 with ${keys}`;
  if (dk.status === 'failed') return keys === 'at,status,why' && typeof dk.why === 'string' && dk.why ? null : `a failed read with ${keys}`;
  if (dk.status !== 200) return `status ${dk.status}`;
  if (keys !== 'at,main,status,yes') return `a read with ${keys}`;
  if (!Array.isArray(dk.main) || !Array.isArray(dk.yes) || !(dk.main.length + dk.yes.length)) return 'a read with nothing in it';
  const price = p => Number.isInteger(p) && Math.abs(p) >= 100;
  const m = dk.main.find(r => !(Array.isArray(r) && r.length === 5 && /^\d+$/.test(r[0]) && DK_STATS.includes(r[1]) && typeof r[2] === 'number' && isFinite(r[2]) && r[2] >= 0 && price(r[3]) && price(r[4])));
  if (m) return `a main line ${JSON.stringify(m)}`;
  const y = dk.yes.find(r => !(Array.isArray(r) && r.length === 4 && /^\d+$/.test(r[0]) && DK_STATS.includes(r[1]) && Number.isInteger(r[2]) && r[2] >= 1 && price(r[3])));
  if (y) return `a milestone ${JSON.stringify(y)}`;
  const seen = new Set();
  for (const r of dk.main) { const k = r.slice(0, 3).join('|'); if (seen.has(k)) return `two main lines ${k}`; seen.add(k); }
  for (const r of dk.yes) { const k = 'y' + r.slice(0, 3).join('|'); if (seen.has(k)) return `two milestones ${k}`; seen.add(k); }
  return null;
}
/* what the page seeds from a game's read: the read as published, its time in full, marked the job's */
function dkSeed(dk) {
  if (!dk || typeof dk !== 'object' || !isFinite(Date.parse(dk.at))) return null;
  const at = new Date(Date.parse(dk.at)).toISOString();
  return dk.status === 200 && Array.isArray(dk.main) && Array.isArray(dk.yes) ? { status: 200, at, main: dk.main, yes: dk.yes, src: 'job' }
    : dk.status === 404 ? { status: 404, at, src: 'job' } : dk.status === 'failed' ? { status: 'failed', at, why: String(dk.why || 'no answer'), src: 'job' } : null;
}
/* a Player props button's words, title and light on a read, by this smoke's own wording: the NBA's word alone since nhl v23, outlined
   ice where DraftKings priced the game, the read said on its title (after what its window's Game bets hold, on a fresh line) */
function ppBtnWant(rd, proj = true, askable = true) {
  if (!rd) return ['Player props', `Player props: ${proj ? "the model's projections (on trial) · press Refresh odds for DraftKings' props" : askable ? "press Refresh odds for DraftKings' props" : 'DraftKings posts player props on game day'}`, false];
  const T = clockOf(Date.parse(rd.at));
  if (rd.status === 200) return ['Player props', `Player props: DraftKings: ${sN(rd.main.length, 'main line', 'main lines')} and ${sN(rd.yes.length, 'milestone price', 'milestone prices')}, read ${T}`, rd.main.length + rd.yes.length > 0];
  if (rd.status === 404) return ['Player props', `Player props: DraftKings: none posted yet (read ${T})`, false];
  return ['Player props', "Player props: DraftKings' props could not be read", false];
}
/* what a Player props button's title says first on a game with a fresh line: its window's Game bets */
const GB_TITLE = "Game bets: DraftKings' moneyline, puck line and total, tap one to add it to your parlay. ";
/* gl: whether this smoke knows the game's line is fresh (true, false), or undefined where a press may have made it so */
const ppTitleIs = (b, want, gl) => !!b && (gl === true ? b.title === GB_TITLE + want : gl === false ? b.title === want : (b.title === want || b.title === GB_TITLE + want)) && (b.title.startsWith(GB_TITLE) ? b.getAttribute('aria-label') === 'Player props and game bets' : !b.hasAttribute('aria-label'));
async function holdJobRead(body, tag) {
  const J = JSON.parse(body), pg = (J.props && J.props.games) || {}, AT = PUB + 60000;
  const want = {}; for (const id of Object.keys(pg)) { const s = dkSeed(pg[id].dk); if (s) want[id] = s; }
  const sbFn = async url => { const mm = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), dd = mm && `${mm[1]}-${mm[2]}-${mm[3]}`; return { ok: true, json: async () => ({ events: S.games.filter(g => g.date === dd).map(g => espnEvent(g, null)) }) }; };
  let propsNow = url => ({ ok: false, status: 503, json: async () => ({}) });
  const errs = [], w = await boot(AT, errs, { hash: 'games', keepDk: true, state: body, espn: sbFn, props: url => propsNow(url) }), d = w.document;
  /* on load: PROPS is the job's read, game for game, and nothing asked */
  const PR0 = JSON.parse(w.eval('JSON.stringify(PROPS.games)'));
  chk(canon(PR0) === canon(want), `${tag}: the page starts from the job's read, every game as the state carries it (${Object.keys(want).length} games; the page holds ${Object.keys(PR0).length})`);
  chk(!propReqs(w).length, `${tag}: and asks ESPN for no props on load (${propReqs(w).length} asked)`);
  /* each Player props button of Pick your own legs, by the read it stands on */
  { const PB = plBtnsBad(d, id => want[id] || null, AT); chk(!PB.bad.length, `${tag}: each Player props button says what the job's read has and when, lit where DraftKings priced the game (${PB.n} buttons; ${PB.bad.length} wrong: ${PB.bad.slice(0, 2).join(' || ')})`); }
  /* every page of a game still to come with a read, row for row */
  const read = S.games.filter(g => want[g.id] && !sStarted(g, AT)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || (a.id < b.id ? -1 : 1));
  for (const g of read) {
    const rd = want[g.id], b = gpWrongs(w, g, AT, rd, {});
    chk(!b.length, `${tag}, ${g.away} @ ${g.home} (the job's read, ${rd.status}): its page is the read's every line, the projection, the props model's chance and DraftKings' fair chance, its status line the read's state (${b.rows} rows, ${b.opened} opened; ${b.length} wrong: ${b.slice(0, 3).join(' | ')})`);
  }
  /* a price put in the parlay from the job's read: at its price and the read's time, and so after a reload */
  const G = read.find(g => want[g.id].status === 200);
  let store = null;
  if (G && betsOn(d, G)) {
    let btn = null; for (const r of [...d.querySelectorAll('#gameView button.plrbtn')].map(x => x.dataset.open)) { [...d.querySelectorAll('#gameView button.plrbtn')].find(x => x.dataset.open === r).click(); btn = d.querySelector('#gameView .plrbody input[data-pp-add]'); if (btn) break; }
    if (btn) {
      const key = btn.dataset.ppAdd, [pid, stat, mk, a, b] = key.split('|'), rd = want[G.id];
      const m = mk === 'main' ? rd.main.find(r => r[0] === pid && r[1] === stat && r[2] === +b) : rd.yes.find(r => r[0] === pid && r[1] === stat && r[2] === +a);
      const price = mk === 'main' ? (a === 'over' ? m[3] : m[4]) : m[3];
      btn.focus(); btn.click();
      const legs = JSON.parse(w.eval('JSON.stringify(P.legs)')), L = legs.find(l => l.kind === 'prop' && l.pid === pid && l.stat === stat);
      chk(!!L && L.odds === price && L.at === rd.at && L.game === G.id, `${tag}: a price on the page's job read goes in the parlay at DraftKings' price as the job read it, dated by that read (${L ? `${L.odds} at ${L.at}` : 'none'}; the read ${price} at ${rd.at})`);
      chk(txt(d.getElementById('ppMsg')).includes(`DraftKings as read ${clockOf(Date.parse(rd.at))}`) && !!propBox(d, key) && propBox(d, key).checked && propBox(d, key).closest('tr').classList.contains('on') && d.activeElement === propBox(d, key), `${tag}: the page says when it was read, the box drawn ticked with the keyboard on it (${txt(d.getElementById('ppMsg')).slice(0, 160)})`);
      store = w.localStorage.getItem('nhl_v1');
      const e2 = [], w2 = await boot(AT, e2, { hash: 'parlays', keepDk: true, state: body, store });
      const drawn = JSON.parse(w2.eval('JSON.stringify(builderLegs(false).filter(L => L.prop).map(L => [L.pid, L.stat, L.price, L.at]))'));
      chk(drawn.some(x => x[0] === pid && x[1] === stat && x[2] === price && x[3] === rd.at), `${tag}: a reload draws it at the job's price, the same read (${JSON.stringify(drawn).slice(0, 160)})`);
      chk(!e2.length, `${tag}: no runtime error on the reload: ${e2.join(' | ')}`);
      w2.close();
      propBox(d, key).click();
      chk(!JSON.parse(w.eval('JSON.stringify(P.legs)')).some(l => l.kind === 'prop') && !propBox(d, key).checked, `${tag}: a second tap takes it out`);
    } else console.log(`  ${tag}: no price on ${G.id} the builder can take: the add is not tried`);
  }
  closeBets(d);
  /* a press whose every props request fails: the job's read stands wherever it read or found none, a failed read is the press's */
  const ask = sPropsAsk(AT);
  if (ask.length) {
    d.getElementById('refreshOdds').click();
    chk(await oddsDone(w), `${tag}: a press whose props reads all fail finishes`);
    await wait(20);
    const PR1 = JSON.parse(w.eval('JSON.stringify(PROPS.games)')), q = { asked: ask.length, failed: ask.length, kept: 0 }, bad = [];
    let at1 = null;
    for (const g of ask) {
      const r = PR1[g.id], s0 = want[g.id];
      if (s0 && s0.status !== 'failed') { q.kept++; if (canon(r) !== canon(s0)) bad.push(`${g.id}: the job's read not kept`); }
      else { if (!r || r.status !== 'failed' || r.src || r.why !== 'HTTP 503') bad.push(`${g.id}: not the press's failed read (${JSON.stringify(r).slice(0, 80)})`); else at1 = r.at; }
    }
    chk(!bad.length, `${tag}: a press whose props reads fail keeps the job's read on every game it read or found none, and says the rest failed (${ask.length} asked; ${bad.slice(0, 3).join('; ')})`);
    chk(txt(d.getElementById('oddsNote')).endsWith(sPropsText(q)), `${tag}: the status line counts the job's reads kept ("${sPropsText(q).trim()}": ${txt(d.getElementById('oddsNote')).slice(-160)})`);
    { const PB = plBtnsBad(d, id => PR1[id] || null, AT); chk(!PB.bad.length, `${tag}: each Player props button says the read it now stands on (${PB.n}; ${PB.bad.slice(0, 2).join(' || ')})`); }
    if (G) { const b = gpWrongs(w, G, AT, want[G.id], { noPlayers: true }); chk(!b.length, `${tag}: the page still shows the job's read (${b.slice(0, 2).join(' | ')})`); }
    const Gf = ask.find(g => !want[g.id] || want[g.id].status === 'failed');
    if (Gf && at1 && (pg[Gf.id] || PR1[Gf.id])) { const b = gpWrongs(w, Gf, AT, PR1[Gf.id], { noPlayers: true }); chk(!b.length && /couldn't read player lines\.$/.test(txt(d.getElementById('ppOddsNote'))), `${tag}: a game the press failed on and the job did not read says the press's failure (${txt(d.getElementById('ppOddsNote'))}; ${b.slice(0, 2).join(' | ')})`); }
    closeBets(d);
    /* a second press that answers: the press's read replaces the job's, said */
    const G2 = ask.find(g => pg[g.id] && want[g.id] && want[g.id].status === 200) || ask.find(g => pg[g.id]);
    if (G2) {
      const A2 = propsAnswer(G2), parsed2 = E.propsOf(A2.items);
      propsNow = url => { const mm = PROPS_RX.exec(url); return mm && mm[1] === G2.id ? { ok: true, status: 200, json: async () => ({ pageCount: 1, items: JSON.parse(JSON.stringify(A2.items)) }) } : PROPS_404(url); };
      d.getElementById('refreshOdds').click();
      chk(await oddsDone(w), `${tag}: a second press finishes`);
      await wait(20);
      const PR2 = JSON.parse(w.eval('JSON.stringify(PROPS.games)')), r2 = PR2[G2.id];
      chk(!!r2 && r2.status === 200 && !r2.src && canon(r2.main) === canon(parsed2.main) && canon(r2.yes) === canon(parsed2.yes) && Date.parse(r2.at) > Date.parse(want[G2.id] ? want[G2.id].at : 0),
        `${tag}: a press that answers replaces the job's read with its own (${G2.id}: ${r2 ? `${r2.main.length} main lines read ${r2.at}${r2.src ? ', still the job\'s' : ''}` : 'none'})`);
      chk(ask.filter(g => g !== G2).every(g => PR2[g.id] && PR2[g.id].status === 404 && !PR2[g.id].src), `${tag}: and a 404 now is none posted yet now, the job's read gone (${ask.filter(g => g !== G2 && (!PR2[g.id] || PR2[g.id].src)).map(g => g.id).join(', ')})`);
      { const b = gpWrongs(w, G2, AT, { status: 200, at: r2.at, main: parsed2.main, yes: parsed2.yes }, { all: true });
        chk(!b.length, `${tag}, ${G2.away} @ ${G2.home} after a press: its page is the press's read row for row, its status line the press's time (${b.rows} rows, ${b.opened} opened; ${b.length} wrong: ${b.slice(0, 3).join(' | ')})`); closeBets(d); }
      { const PB = plBtnsBad(d, id => PR2[id] || null, AT); chk(!PB.bad.length, `${tag}: each Player props button says the press's read (${PB.n}; ${PB.bad.slice(0, 2).join(' || ')})`); }
    }
  } else console.log(`  ${tag}: no game for a press to read: the presses are skipped`);
  /* the Top 30 and the suggested levels rank the job's player lines (nhl v18, the owner's call), each held by this smoke's own sums on the
     page's reads; a player line's Add from the Top 30 and a level's Add to builder put exactly those legs in, at the read's price */
  {
    const e4 = [], w4 = await boot(AT, e4, { hash: 'parlays', keepDk: true, state: body }), d4 = w4.document, ids = () => JSON.parse(w4.eval('JSON.stringify(P.legs.map(legIdOf))'));
    const PN = holdPanel(w4, AT, `${tag}: the Top 30 with the job's player lines`); holdSuggest(w4, AT, `${tag}: the suggested levels with the job's player lines`);
    const nP = PN.top ? PN.top.value.concat(PN.top.other).filter(L => L.prop).length : 0;
    console.log(`  ${tag}: ${nP} player lines in the Top 30, ${PN.pool ? PN.pool.legs.filter(L => L.prop).length : 0} qualifying`);
    const pr0 = d4.querySelector('#pbBody .t30-r[data-id*="|p|"] button.t30-add');
    if (pr0) {
      const id = pr0.dataset.leg, L = PN.pool.legs.find(x => x.id === id); pr0.click();
      const st = JSON.parse(w4.eval('JSON.stringify(P.legs)')), l = st.find(x => x.kind === 'prop');
      chk(canon(ids()) === canon([id]) && !!l && l.odds === L.price && Date.parse(l.at) === Date.parse(want[L.game].at) && !!d4.querySelector(`#legs .leg[data-id="${id}"]`), `${tag}: a player line's Add in the Top 30 puts it in the builder at the read's price, dated by the read (${id}; ${l ? l.odds + ' at ' + l.at : 'none'})`);
      d4.querySelector(`#pbBody .t30-r[data-id="${id}"] button.t30-add`).click();
      chk(!ids().length, `${tag}: and a second tap takes it out`);
    } else if (nP) chk(false, `${tag}: a player line in the Top 30 has no Add`);
    w4.eval('renderSuggest()');
    const lv = [...d4.querySelectorAll('#spBody .sp-day[data-sp-state="open"] .pb-tier')].find(t => t.querySelector('.pb-tl[data-id*="|p|"]'));
    if (lv) {
      const want2 = [...lv.querySelectorAll('.pb-tl')].map(x => x.dataset.id); lv.querySelector('[data-sp-add]').click();
      chk(canon(ids()) === canon(want2), `${tag}: a level holding a player line goes in the builder whole (${want2.join(', ')}; the builder ${ids().join(', ')})`);
      d4.getElementById('clearParlay').click();
    } else console.log(`  ${tag}: no suggested level holds a player line on this read`);
    chk(!e4.length, `${tag}: no runtime error ranking the job's player lines: ${e4.join(' | ')}`);
    w4.close();
  }
  /* a reload: the job's read again, nothing asked */
  const e3 = [], w3 = await boot(AT, e3, { hash: 'games', keepDk: true, state: body });
  chk(canon(JSON.parse(w3.eval('JSON.stringify(PROPS.games)'))) === canon(want) && !propReqs(w3).length, `${tag}: a reload starts from the job's read again, asking ESPN for nothing`);
  chk(!errs.length && !e3.length, `${tag}: no runtime error: ${errs.concat(e3).join(' | ')}`);
  w.close(); w3.close();
}
async function jobLinesChecks() {
  console.log("THE JOB'S PLAYER LINES");
  const pg = (S.props && S.props.games) || {};
  if (!S.props || !S.props.dk) {
    chk(!Object.values(pg).some(x => x && x.dk), "a state with no counts of the job's read carries no read");
    console.log("  the state carries no job read of DraftKings' player lines (an older job published it): its own checks wait for one, and the page is held on a copy with one planted");
  } else {
    const q = S.props.dk;
    chk(['asked', 'read', 'none', 'failed', 'kept', 'lines'].every(k => Number.isInteger(q[k]) && q[k] >= 0) && q.read + q.none + q.failed === q.asked && q.kept <= q.failed, `the job's read counts add up (${JSON.stringify(q)})`);
    const ids = Object.keys(pg), bad = ids.map(id => [id, dkShapeBad(pg[id].dk, S.games.find(g => g.id === id))]).filter(x => x[1]);
    chk(!bad.length, `every game the props model projects carries the job's read of DraftKings' player lines in its shape, read before its puck drop and by the publish (${ids.length} games; ${bad.length} wrong${bad[0] ? `, e.g. ${bad[0][0]}: ${bad[0][1]}` : ''})`);
    chk(ids.length <= q.asked, `no more games carry a read than the job asked (${ids.length} of ${q.asked}; a game started since is left out)`);
    const by = ids.reduce((o, id) => { const s = pg[id].dk && pg[id].dk.status; o[s] = (o[s] || 0) + 1; return o; }, {});
    console.log(`  the job's read: ${q.asked} games asked, ${q.read} read (${q.lines} main lines), ${q.none} none posted, ${q.failed} failed (${q.kept} kept); the state carries ${ids.length}: ${JSON.stringify(by)}`);
    if (ids.some(id => pg[id].dk)) await holdJobRead(STATE, 'the state as published');
  }
  /* a copy with a read planted on every projected game to come, by turns an answer, none posted yet and a failed read */
  const AT = PUB + 60000, come = Object.keys(pg).map(id => S.games.find(g => g.id === id)).filter(g => g && !sStarted(g, AT)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || (a.id < b.id ? -1 : 1));
  if (!come.length) { console.log('  no projected game still to come: the page on a planted read is skipped'); return; }
  const J = JSON.parse(STATE), at0 = new Date(PUB - 7 * 60000).toISOString(), q = { asked: come.length, read: 0, none: 0, failed: 0, kept: 0, lines: 0 };
  for (const g of Object.keys(J.props.games)) delete J.props.games[g].dk;
  come.forEach((g, i) => {
    const pr = E.propsOf(propsAnswer(g).items);
    J.props.games[g.id].dk = i % 3 === 0 ? { status: 200, at: at0, main: pr.main, yes: pr.yes } : i % 3 === 1 ? { status: 404, at: at0 } : { status: 'failed', at: at0, why: 'HTTP 503' };
    if (i % 3 === 0) { q.read++; q.lines += pr.main.length; } else if (i % 3 === 1) q.none++; else q.failed++;
  });
  J.props.dk = q;
  await holdJobRead(JSON.stringify(J), 'a planted read');
}
async function sameGameChecks() {
  console.log('SAME-GAME PARLAYS AND PLAYER LEGS');
  const SGPJS = require('./sgp'), C = readJSON(path.join(DATA, 'corr.json'));
  chk(!!C && !!C.rho && !!C.hold && C.hold.sgp > 0 && C.hold.sgp <= 1, 'data/corr.json holds the same-game table and hold');
  if (!C) return;
  /* the state against its sources: the table and hold are corr.json's; the box scores are the box files', every final of the window.
     The job writes both on every run once data/corr.json is in the repo, so the state under test must carry them: a job that stopped
     would leave the page one leg a game and every saved player leg pending for good. Only the last published state itself, unchanged
     (a run that found nothing new, or a checkout before the first run that carried them), may be without */
  const asPublished = !!PREV && JSON.stringify(PREV) === JSON.stringify(S);
  if (S.sgp || !asPublished) chk(isObjS(S.sgp) && canon(S.sgp.rho) === canon(C.rho) && canon(S.sgp.hold) === canon(C.hold), `the state carries the same-game table and hold, data/corr.json's (${S.sgp ? Object.keys(S.sgp.rho || {}).length + ' pairs, hold ' + (S.sgp.hold && S.sgp.hold.sgp) : 'none: the job wrote no sgp'})`);
  else console.log('  this state is the last published one and carries no same-game table (a publish before it): the page takes one leg a game; the rule is held on a made-up copy below');
  if (!S.box && !asPublished) chk(false, 'the state carries the box scores of the window (none: the job wrote no box, so a saved player leg would wait for good)');
  if (S.box && !(isObjS(S.box) && isObjS(S.box.games))) chk(false, `the state's box scores are { from, days, games } (${canon(S.box).slice(0, 80)})`);
  if (isObjS(S.box) && isObjS(S.box.games)) {
    const B = S.box, want = {}, bad = [];
    const from = (() => { const x = new Date(S.today + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - (+B.days || 0)); return x.toISOString().slice(0, 10); })();
    chk(B.from === from && B.days === 14, `the box scores carried are the finals from ${from}, the 14 days before ${S.today} (${B.from}, ${B.days})`);
    const fin = new Map(S.games.filter(g => g.state === 'final' && g.date >= B.from && g.date <= S.today).map(g => [g.id, g]));
    for (const f of fs.readdirSync(DATA).filter(f => /^box_\d{4}\.jsonl$/.test(f) && +f.slice(4, 8) >= E.seasonOf(B.from))) for (const line of fs.readFileSync(path.join(DATA, f), 'utf8').split('\n')) {
      if (!line || !fin.has((/"id":"(\d+)"/.exec(line) || [])[1])) continue; const b = JSON.parse(line);
      want[b.id] = boxRuleS(b);
    }
    for (const id of new Set(Object.keys(want).concat(Object.keys(B.games || {})))) if (canon(want[id] || null) !== canon((B.games || {})[id] || null)) bad.push(id);
    const relief = Object.values(B.games || {}).reduce((a, g) => a + (Array.isArray(g.r) ? g.r.length : 0), 0), unsure = Object.values(B.games || {}).reduce((a, g) => a + (Array.isArray(g.u) ? g.u.length : 0), 0);
    chk(!bad.length, `the state's box scores are every final of the window the box files have, each skater on the ice with his goals, assists, shots and blocks, each side's starting goalie with his saves, the goalies who came on in relief apart, and apart again the goalies of a side whose starter the box cannot tell (${Object.keys(B.games || {}).length} games, ${relief} relief appearances, ${unsure} goalies of uncertain start; ${bad.length} differ: ${bad.slice(0, 4).join(', ')})`);
  } else if (!S.box) console.log('  this state is the last published one and carries no box scores (a publish before them): a saved player leg waits; grading is held on made-up box scores below');
  /* the rule on a real line: CBJ at VGK, 8 January 2026 (401803043), as data/box_2026.jsonl has it. Carter Hart started for VGK and was
     pulled at 8:24 with one shot against, a goal (ESPN's plays); Akira Schmid relieved him and made VGK's first save, so the box marks
     Schmid. Neither's saves can be graded from the box: both in u, neither in g nor r; CBJ's lone goalie is its starter. Given a save
     of his own, Hart is the reliever the mark says he is, and Schmid's saves stand */
  {
    const cv = { id: '401803043', date: '2026-01-08', home: 'VGK', away: 'CBJ', skaters: [], goalies: [{ id: '4894366', name: 'Jet Greaves', team: 'CBJ', toi: 3408, sa: 26, ga: 5, st: 1 },
      { id: '4587845', name: 'Akira Schmid', team: 'VGK', toi: 3089, sa: 24, ga: 2, st: 1 }, { id: '4064582', name: 'Carter Hart', team: 'VGK', toi: 504, sa: 1, ga: 1 }] };
    const r1 = boxRuleS(cv), r2 = boxRuleS(Object.assign({}, cv, { goalies: cv.goalies.map(x => x.id === '4064582' ? Object.assign({}, x, { sa: 2, ga: 1 }) : x) }));
    chk(canon(r1.g) === canon({ 4894366: 21 }) && canon(r1.u) === canon(['4064582', '4587845']) && r1.r === undefined, `a side whose starter the box cannot tell (401803043: Hart pulled without a save, Schmid marked) grades neither goalie's saves (${canon(r1)})`);
    chk(canon(r2.g) === canon({ 4894366: 21, 4587845: 22 }) && canon(r2.r) === canon(['4064582']) && r2.u === undefined, `a reliever with a save of his own leaves the mark sure: the starter's saves stand, the reliever's void (${canon(r2)})`);
  }
  /* the page's copy of tools/sgp.js: the file's text between its marks, and its numbers on legs of every kind */
  const src = fs.readFileSync(path.join(__dirname, 'sgp.js'), 'utf8'), body = src.slice(src.indexOf("'use strict';\n") + 14, src.indexOf('module.exports')).replace(/^\n+|\n+$/g, '');
  const m1 = HTML.indexOf('/* sgp.js begins */\n'), m2 = HTML.indexOf('\n/* sgp.js ends */');
  chk(m1 > 0 && m2 > m1 && HTML.slice(m1 + 20, m2).replace(/^\n+|\n+$/g, '') === body, `the page's same-game rule is tools/sgp.js word for word (${m1 > 0 && m2 > m1 ? HTML.slice(m1 + 20, m2).length : 'no marks'} vs ${body.length} characters)`);
  /* a made-up copy of the state carrying the table (the job's next publish), so the rule is held on any day */
  const M = JSON.parse(STATE); if (!M.sgp) M.sgp = { rho: C.rho, hold: C.hold, measured: C.measured || null };
  const T = M.sgp, AT = PUB + 60000;
  const real = S; S = M;
  try {
    const ask = sPropsAsk(AT), cand = ask.filter(g => M.props && M.props.games[g.id] && sFresh(g) && isDKBook(g.line) && g.line.total !== null && g.line.total !== undefined && PBS.ok(g.line.homeML) && PBS.ok(g.line.awayML) && PBS.ok(g.line.overOdds) && PBS.ok(g.line.underOdds) && g.ou && sLeg(g, 'away', 'pl'));
    /* its page is loaded again a minute on and read again two minutes on: a game starting within four minutes of the clock would drop its
       puck under those steps, so it is not the section's game */
    const G = cand.filter(g => Date.parse(g.start) > AT + 4 * 60000).sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || (a.id < b.id ? -1 : 1))[0];
    if (!G && cand.length) console.log(`  every game to come with a line and projections starts within four minutes (${cand.map(g => g.id).join(', ')}): too soon for the section's reload and later read`);
    const H = G && S.games.filter(g => g.id !== G.id && g.date === G.date && !sStarted(g, AT) && sFresh(g) && isDKBook(g.line) && sLeg(g, 'home', 'ml')).sort((a, b) => Date.parse(b.start) - Date.parse(a.start) || (a.id < b.id ? -1 : 1))[0];
    /* parity on numbers: the page's SGP.parlay and rho against tools/sgp.js's on legs of G of every kind, random sets of two to seven */
    if (G) {
      const pr = M.props.games[G.id], pool = [];
      for (const [side, club, opp] of [['awayP', G.away, G.home], ['homeP', G.home, G.away]]) {
        for (const x of pr[side].skaters.slice(0, 6)) for (const st of ['pts', 'g', 'a', 's', 'bs']) for (const sd of ['over', 'under']) pool.push({ game: G.id, team: club, pid: x.id, grp: x.pos === 'D' ? 'D' : 'F', stat: st, side: sd });
        if (pr[side].goalie) for (const sd of ['over', 'under']) pool.push({ game: G.id, team: club, pid: pr[side].goalie.id, grp: 'G', stat: 'sv', side: sd });
        for (const k of ['ml', 'pl']) pool.push({ game: G.id, team: club, opp, kind: k, line: k === 'pl' ? (club === G.home ? G.line.homeLine : -G.line.homeLine) : 0, fav: sFav(G, club === G.home ? 'home' : 'away') });
      }
      for (const sd of ['over', 'under']) pool.push({ game: G.id, kind: 'tot', side: sd });
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const sets = [];
      for (let i = 0; i < 160; i++) { const n = 2 + Math.floor(rnd() * 6), ls = []; for (let k = 0; k < n; k++) { const l = Object.assign({}, pool[Math.floor(rnd() * pool.length)]); l.p = 0.15 + rnd() * 0.7; l.dec = 1.2 + rnd() * 4; ls.push(l); } if (i % 5 === 0) ls.push(Object.assign({}, ls[0], { game: 'other', p: 0.5, dec: 1.91 })); sets.push(ls); }
      const eP = [], wP = await boot(AT, eP, { state: JSON.stringify(M), hash: 'games' });
      const pageR = JSON.parse(wP.eval(`JSON.stringify(${JSON.stringify(sets)}.map(ls => SGP.parlay(S.sgp, ls)))`)), jobR = sets.map(ls => SGPJS.parlay(T, ls));
      const differ = sets.filter((ls, i) => canon(pageR[i]) !== canon(jobR[i])).length;
      chk(!differ, `the page's same-game price is tools/sgp.js's on ${sets.length} random sets of legs of one game (${jobR.filter(r => r.refused).length} refused, ${jobR.filter(r => r.lam > 0).length} shrunk to positive definite; ${differ} differ)`);
      /* and the rule itself, worked out here again: the page's correlation of every pair of the pool against this smoke's reading of the table */
      const pairs = []; for (let i = 0; i < pool.length; i += 3) for (let j = i + 1; j < pool.length; j += 7) pairs.push([pool[i], pool[j]]);
      const pr2 = JSON.parse(wP.eval(`JSON.stringify(${JSON.stringify(pairs)}.map(([a, b]) => SGP.rho(S.sgp, a, b)))`));
      const wrong = pairs.filter(([a, b], i) => { const r = SG.rho(T, a, b); return r === undefined ? pr2[i] !== null : pr2[i] === null || Math.abs(pr2[i] - r) > 1e-15; });
      chk(!wrong.length, `every pair's correlation is the table's by the rule written again here (${pairs.length} pairs, ${pr2.filter(x => x === null).length} refused; ${wrong.length} wrong, e.g. ${canon(wrong[0] || null).slice(0, 160)})`);
      /* never above the product: two legs that move against each other (a player's points and the other club's win) priced at the product,
         two that move together under it, by the page and by the rule written here */
      const X0 = pool.find(l => l.stat === 'pts' && l.side === 'over' && l.team === G.away), oppMl = pool.find(l => l.kind === 'ml' && l.team === G.home), ownMl = pool.find(l => l.kind === 'ml' && l.team === G.away);
      const two = [[Object.assign({}, X0, { p: 0.6, dec: 1.6 }), Object.assign({}, oppMl, { p: 0.5, dec: 1.9 })], [Object.assign({}, X0, { p: 0.6, dec: 1.6 }), Object.assign({}, ownMl, { p: 0.5, dec: 1.9 })]];
      const pg2 = JSON.parse(wP.eval(`JSON.stringify(${JSON.stringify(two)}.map(ls => SGP.parlay(S.sgp, ls)))`)), sg2 = two.map(ls => SG.parlay(T, ls));
      chk(Math.abs(pg2[0].dec - 1.6 * 1.9) < 1e-12 && Math.abs(sg2[0].dec - 1.6 * 1.9) < 1e-12 && pg2[0].fair < 0.3 && Math.abs(pg2[0].fair - sg2[0].fair) < 1e-8, `legs moving against each other are priced at the legs' prices multiplied, never above (${pg2[0].dec} vs ${(1.6 * 1.9).toFixed(4)}; fair ${pg2[0].fair})`);
      chk(pg2[1].dec < 1.6 * 1.9 && Math.abs(pg2[1].dec - sg2[1].dec) < 1e-6 && Math.abs(pg2[1].fair - sg2[1].fair) < 1e-8, `legs moving together: the hold over their joint implied chance, worked out here (${pg2[1].dec} vs ${sg2[1].dec})`);
      chk(!eP.length, 'no runtime error on the made-up state: ' + eP.join(' | '));
    }
    if (!G || !H) { console.log(`  no game to come today or tomorrow with a DraftKings line, a total and projections beside another with a line (${G ? G.id : 'none'}, ${H ? H.id : 'none'}): the builder's player legs are not held on this state`); return; }
    await builderPlayerLegs(M, G, H, AT);
    await gameLegsMax(M, G, H, AT);
  } finally { S = real; }
  await gradingChecks(C);
}
/* the most legs of one game: tools/sgp.js prices up to its MAX_GAME_LEGS (its lattice's roots) and the page's GAME_LEGS_MAX is that
   number. A store holding 23 legs of G opens with the first 21; with 21 in, a 22nd (a player's price or a team bet) is refused, said,
   nothing stored; one taken out makes room again. The price shown is the rule's estimate on all 21, never the product. A stored leg a
   later read has taken out of the builder (its line moved) is not in the parlay: it counts toward neither the most of one game nor the
   nested rule, and a leg added beside it on a reload takes it out of the store for good, said, so a reload brings back no more than 21 */
async function gameLegsMax(M, G, H, AT) {
  const SGPJS = require('./sgp'), MAX = SGPJS.MAX_GAME_LEGS, A = propsAnswer(G), parsed = E.propsOf(A.items), pr = M.props.games[G.id];
  const mainOf = (pid, st) => parsed.main.find(r => r[0] === String(pid) && r[1] === st);
  /* the candidates: every shots and blocks line, then every points line (no two nested: no goals or assists among them), so any game
     the made-up answer prices gives more than enough, however many defencemen a club dresses */
  const cand = [];
  for (const sts of [['s', 'bs'], ['pts']]) for (const [side, club] of [['awayP', G.away], ['homeP', G.home]]) for (const x of pr[side].skaters) for (const st of sts) { const m = mainOf(x.id, st); if (m) cand.push({ x, club, st, m }); }
  if (cand.length < MAX + 3) { console.log(`  ${G.id}: ${cand.length} shots, blocks and points lines in the made-up answer, too few to hold the most legs of one game (${MAX + 3} wanted)`); return; }
  const at0 = new Date(AT - 3600000).toISOString();
  const legOf = c => ({ game: G.id, kind: 'prop', pid: String(c.x.id), name: c.x.name, team: c.club, grp: c.x.pos === 'D' ? 'D' : 'F', stat: c.st, mk: 'main', side: 'over', line: c.m[2], k: null, odds: c.m[3], other: c.m[4], at: at0 });
  const errs = [], sb = async url => { const mm = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), dd = mm && `${mm[1]}-${mm[2]}-${mm[3]}`; return { ok: true, json: async () => ({ events: S.games.filter(g => g.date === dd).map(g => espnEvent(g, null)) }) }; };
  const props = url => { const m = PROPS_RX.exec(url); return m && m[1] === G.id ? { ok: true, status: 200, json: async () => ({ pageCount: 1, items: JSON.parse(JSON.stringify(A.items)) }) } : PROPS_404(url); };
  const w = await boot(AT, errs, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props, store: JSON.stringify({ legs: cand.slice(0, MAX + 2).map(legOf), ui: { tab: 'parlays' } }) }), d = w.document, $ = id => d.getElementById(id);
  chk(w.eval('GAME_LEGS_MAX') === MAX, `the page's most legs of one game is tools/sgp.js's (${w.eval('GAME_LEGS_MAX')} vs ${MAX})`);
  const ofG = () => JSON.parse(w.eval(`JSON.stringify(P.legs.filter(l => l.game === ${JSON.stringify(G.id)}).map(l => l.pid + '|' + l.stat))`)).sort();     // as a set: the builder keeps its own order
  const first = cand.slice(0, MAX).map(c => c.x.id + '|' + c.st).sort();
  chk(canon(ofG()) === canon(first), `a store holding ${MAX + 2} legs of one game opens with the first ${MAX} (${ofG().length})`);
  /* the legs the page hands the rule, in its order, are this smoke's reading of the stored legs; tools/sgp.js prices them as the page shows */
  const conv = JSON.parse(w.eval('JSON.stringify(builderLegs(false).map(L => sgpLeg(L, L.fair)))')), q = JSON.parse(w.eval('JSON.stringify(quote(builderLegs(false)))'));
  const mine = cand.slice(0, MAX).map(c => ({ game: G.id, team: c.club, pid: String(c.x.id), grp: c.x.pos === 'D' ? 'D' : 'F', stat: c.st, side: 'over', p: 1 - PBS.imp(c.m[4]), dec: PBS.decOf(c.m[3]) }));
  const key = l => l.pid + '|' + l.stat, convOk = conv.length === MAX && conv.every(c => { const m = mine.find(x => key(x) === key(c)); return m && Object.keys(m).every(k => k === 'p' || k === 'dec' ? Math.abs(c[k] - m[k]) < 1e-12 : canon(c[k]) === canon(m[k])); });
  const e = SGPJS.parlay(M.sgp, conv), prod = mine.reduce((a, l) => a * l.dec, 1);
  chk(convOk && !e.refused && q.est && Math.abs(q.dec - e.dec) < 1e-9 && Math.abs(q.fair - e.fair) < 1e-12 && Math.abs(q.product - prod) < 1e-6 * prod && q.dec < q.product, `${MAX} legs of one game are priced by the rule, an estimate under the legs' prices multiplied, with a fair chance (${q.dec} vs ${q.product}, fair ${q.fair})`);
  /* a press, the window, and the 22nd */
  d.querySelector('#tabs button[data-tab="games"]').click();
  openDay(d, G.date);
  betsOn(d, G);
  $('ppRefreshOdds').click(); await oddsDone(w); await wait(20);
  chk(canon(ofG()) === canon(first), `the press re-reads the ${MAX} legs at their lines and keeps them (${ofG().length})`);
  const tab = st => { };
  const btn = c => { tab(c.st); return propBox(d, `${c.x.id}|${c.st}|main|over|${c.m[2]}`); };
  const nth = cand[MAX], ref = `Not added: your parlay has ${MAX} legs of ${S.teams[G.away].abbr} @ ${S.teams[G.home].abbr} already, the most of one game this page can price.`;
  const b22 = btn(nth); if (b22) b22.click();
  chk(!!b22 && canon(ofG()) === canon(first) && txt($('ppMsg')) === ref && !btn(nth).checked, `one more leg of a game holding ${MAX} is refused, said plainly, nothing added (${txt($('ppMsg'))})`);
  btn(cand[0]).click();
  chk(ofG().length === MAX - 1, `one taken out leaves ${MAX - 1} (${ofG().length})`);
  btn(nth).click();
  chk(ofG().length === MAX && ofG().includes(nth.x.id + '|' + nth.st), `and makes room for the one refused (${ofG().length})`);
  closeBets(d);
  /* a team bet past the most: refused on the slip bar, nothing stored */
  const legsNow = canon(JSON.parse(w.localStorage.getItem('nhl_v1')).legs);
  const ml = betIn(d, G, `${G.id}|home|ml`);
  if (ml) {
    ml.click();
    chk(canon(JSON.parse(w.localStorage.getItem('nhl_v1')).legs) === legsNow && ofG().length === MAX && txt($('slipMsg')) === ref, `a team bet past the most legs of one game is refused on the slip bar, nothing stored (${txt($('slipMsg'))})`);
    /* the refusal stands only until the parlay changes: a leg taken out (in the props window, or a bet tapped off) or one added after
       without a word of its own leaves the slip bar saying nothing of it */
    const leg = k => betIn(d, G, `${G.id}|${k}`);
    betsOn(d, G);
    btn(cand[1]).click(); closeBets(d);
    chk(ofG().length === MAX - 1 && txt($('slipMsg')) === '', `a leg taken out in the props window ends the refusal on the slip bar (${ofG().length}; "${txt($('slipMsg'))}")`);
    leg('home|ml').click();
    chk(ofG().length === MAX && txt($('slipMsg')) === '', `the team bet then goes in, the slip bar saying nothing of the refusal (${ofG().length}; "${txt($('slipMsg'))}")`);
    if (leg('over|ou')) {
      leg('over|ou').click();
      chk(ofG().length === MAX && txt($('slipMsg')) === ref, `the total past the most is refused on the slip bar (${txt($('slipMsg'))})`);
      const hb = () => betIn(d, H, `${H.id}|home|ml`);
      if (hb()) {
        hb().click();
        chk(JSON.parse(w.eval(`JSON.stringify(P.legs.some(l => l.game === ${JSON.stringify(H.id)}))`)) && txt($('slipMsg')) === '', `a bet on another game, added without a word of its own, ends the refusal on the slip bar ("${txt($('slipMsg'))}")`);
        leg('over|ou').click();
        chk(ofG().length === MAX && txt($('slipMsg')) === ref, `the total past the most is refused again (${txt($('slipMsg'))})`);
      } else chk(false, `${H.id}'s home moneyline is on the Games tab beside ${G.id}`);
      leg('home|ml').click();
      chk(ofG().length === MAX - 1 && txt($('slipMsg')) === '', `a bet tapped off ends the refusal on the slip bar (${ofG().length}; "${txt($('slipMsg'))}")`);
      leg('over|ou').click();
      chk(ofG().length === MAX && txt($('slipMsg')) === '', `and the total then goes in, the slip bar saying nothing of the refusal (${ofG().length}; "${txt($('slipMsg'))}")`);
      leg('home|ml').click();
      chk(ofG().length === MAX && txt($('slipMsg')) === ref, `the team bet past the most is refused once more (${txt($('slipMsg'))})`);
      const ous = () => JSON.parse(w.eval(`JSON.stringify(P.legs.filter(l => l.game === ${JSON.stringify(G.id)} && l.kind === 'ou').map(l => l.side))`));
      /* the × is pressed where a visitor sees it: on the Parlay Builder tab, the builder drawn as it stands (the Games tab leaves it as it
         was last drawn), on the total's row; then back to the Games tab on G's day */
      d.querySelector('#tabs button[data-tab="parlays"]').click();
      const refT = txt($('slipMsg')), x = d.querySelector(`#legs .leg[data-id="${G.id}|over|ou"] button.x`); if (x) x.click();
      chk(refT === ref && !!x && ofG().length === MAX - 1 && !ous().length && txt($('slipMsg')) === '', `the total taken out with its × in the builder ends the refusal on the slip bar (${ofG().length}; "${refT}" then "${txt($('slipMsg'))}")`);
      d.querySelector('#tabs button[data-tab="games"]').click(); openDay(d, G.date);
      /* a replacement said on the slip bar goes the same way: at a player's price added in the props window without a word of its own,
         and at a level's Add to builder */
      const pin = () => new Set(ofG()), pp = () => betsOn(d, G);
      pp(); const outC = cand.find(c => pin().has(c.x.id + '|' + c.st)); if (outC) btn(outC).click(); closeBets(d);
      if (!ous().includes('over')) { if (ous().includes('under')) leg('under|ou').click(); leg('over|ou').click(); }
      leg('under|ou').click();
      const rep = txt($('slipMsg'));
      chk(!!outC && ofG().length === MAX - 1 && ous().join() === 'under' && /^Under [\d.]+ replaced Over [\d.]+ on .*: one total a game\.$/.test(rep), `the Under in place of the Over is said on the slip bar (${ofG().length}; ${rep})`);
      pp(); const inC = cand.find(c => !pin().has(c.x.id + '|' + c.st)), nb = inC && btn(inC); if (nb) nb.click(); closeBets(d);
      chk(!!nb && pin().has(inC.x.id + '|' + inC.st) && ofG().length === MAX && txt($('slipMsg')) === '', `a player's price added in the props window, without a word of its own, ends the replacement on the slip bar (${ofG().length}; "${txt($('slipMsg'))}")`);
      leg('over|ou').click();
      chk(ous().join() === 'over' && ofG().length === MAX && /^Over [\d.]+ replaced Under [\d.]+ on /.test(txt($('slipMsg'))), `the Over back in place of the Under at the most is said on the slip bar (${txt($('slipMsg'))})`);
      d.querySelector('#tabs button[data-tab="suggest"]').click();
      const lv = d.querySelector('#spBody button[data-sp-add]:not([disabled])'); if (lv) lv.click();
      if (!lv) console.log('  no suggested level to add on this state: a level\'s Add to builder ending a replacement on the slip bar is not held');
      else { const [dd, id] = lv.dataset.spAdd.split('|'); chk(JSON.parse(w.eval(`JSON.stringify(spDay(${JSON.stringify(dd)}).levels[${JSON.stringify(id)}].legs.map(L => L.id))`)).join() === JSON.parse(w.eval('JSON.stringify(builderLegs(false).map(L => L.id))')).join() && txt($('slipMsg')) === '', `a suggested level's Add to builder ends the replacement on the slip bar (${lv.dataset.spAdd}; "${txt($('slipMsg'))}")`); }
    }
  }
  chk(!errs.length, 'no runtime error at the most legs of one game: ' + errs.join(' | '));
  await hiddenLegs(M, G, AT, { cand, nth, legOf, sb, props, parsed, mainOf, MAX, at0 });
}
/* a stored leg a read has taken out of the builder (its line moved or pulled, or the game's lines read at another book) is not in the
   parlay: the most of one game and the nested rule count only the legs drawn. A leg added beside it takes it out of the store for good,
   said, only where a reload would put the two together against the published line's rule: nested, or past the most of one game, and
   then only as many as bring the store back to the most, the last stored first. Every other stays stored and comes back on a reload,
   and what the slip bar says of the legs a read took out is not cut short by the next change to the builder */
async function hiddenLegs(M, G, AT, o) {
  const { cand, nth, legOf, sb, props, parsed, mainOf, MAX, at0 } = o, pr = M.props.games[G.id];
  const answer = A => url => { const m = PROPS_RX.exec(url); return m && m[1] === G.id ? { ok: true, status: 200, json: async () => ({ pageCount: 1, items: JSON.parse(JSON.stringify(A.items)) }) } : PROPS_404(url); };
  const kOf = `l => l.kind === 'prop' ? l.pid + '|' + l.stat + '|' + l.line : l.side + '|' + l.kind`;
  const order = w => JSON.parse(w.eval(`JSON.stringify(P.legs.filter(l => l.game === ${JSON.stringify(G.id)}).map(${kOf}))`));
  const ofG = (w, f) => JSON.parse(w.eval(`JSON.stringify(${f === 'drawn' ? 'builderLegs(false)' : 'P.legs'}.filter(l => l.game === ${JSON.stringify(G.id)}).map(${kOf}))`)).sort();
  const inStore = w => (JSON.parse(w.localStorage.getItem('nhl_v1') || '{}').legs || []).filter(l => l.game === G.id).map(l => l.kind === 'prop' ? l.pid + '|' + l.stat + '|' + l.line : l.side + '|' + l.kind).sort();
  const lid = c => `${c.x.id}|${c.st}|${c.m[2]}`, SN = { s: 'shots on goal', bs: 'blocked shots', pts: 'points' }, NM = { s: 'Total Shots on Goal', bs: 'Total Blocked Shots', pts: 'Total Points' };
  const desc = (c, side) => `${c.x.name} ${side === 'under' ? 'Under' : 'Over'} ${c.m[2]} ${SN[c.st]}`, keyOf = (c, side) => `${c.x.id}|${c.st}|main|${side || 'over'}|${c.m[2]}`;
  const mu = `${S.teams[G.away].abbr} @ ${S.teams[G.home].abbr}`;
  /* a candidate's main line moved a goal (or a shot) up in a made-up answer: its Over and Under items, so a press takes it out */
  const moveIn = (A, c) => { let n = 0; for (const it of A.items) if (it && it.athlete && it.athlete.$ref === PROP_REF(c.x.id) && it.type.name === NM[c.st] && /^[+-]\d+$/.test(it.odds.american.value)) { const L = c.m[2] + 1; it.odds.total = { value: String(L) }; it.current = { target: { value: L, displayValue: String(L) } }; n++; } return n; };
  const press = async w => {
    const d = w.document; d.querySelector('#tabs button[data-tab="games"]').click();
    openDay(d, G.date);
    betsOn(d, G);
    d.getElementById('ppRefreshOdds').click(); await oddsDone(w); await wait(20);
  };
  const tap = (w, key, st) => { const d = w.document; const b = propBox(d, `${key}`); if (b) b.click(); return !!b; };
  /* the most of one game: 21 stored, the press moves one of their lines (so 20 drawn), and one more is added */
  const mv = cand[1], refM = PROP_REF(mv.x.id), nm = { s: 'Total Shots on Goal', bs: 'Total Blocked Shots', pts: 'Total Points' }[mv.st], A2 = propsAnswer(G), L2 = mv.m[2] + 1;
  let movedN = 0;
  for (const it of A2.items) if (it && it.athlete && it.athlete.$ref === refM && it.type.name === nm && /^[+-]\d+$/.test(it.odds.american.value)) { it.odds.total = { value: String(L2) }; it.current = { target: { value: L2, displayValue: String(L2) } }; movedN++; }
  const errs = [], w = await boot(AT, errs, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props: answer(A2), store: JSON.stringify({ legs: cand.slice(0, MAX).map(legOf), ui: { tab: 'parlays' } }) });
  await press(w);
  chk(movedN === 2 && ofG(w).length === MAX && ofG(w, 'drawn').length === MAX - 1 && !ofG(w, 'drawn').includes(lid(mv)), `a press that moves the line of one of ${MAX} stored legs of a game takes it out of the builder and keeps it stored (${movedN} items moved; ${ofG(w).length} stored, ${ofG(w, 'drawn').length} drawn)`);
  const tapped = tap(w, `${nth.x.id}|${nth.st}|main|over|${nth.m[2]}`, nth.st), msg = txt(w.document.getElementById('ppMsg'));
  const want = cand.slice(0, MAX).filter(c => c !== mv).concat([nth]).map(lid).sort();
  const said = `On ${mu}, ${desc(mv)} had left the builder and is now taken out of it for good, so it cannot come back beside ${desc(nth)} on a reload.`;
  chk(tapped && canon(ofG(w)) === canon(want) && canon(ofG(w, 'drawn')) === canon(want) && canon(inStore(w)) === canon(want), `with one of them out of the builder, one more leg of the game goes in: ${MAX} in the parlay, the same ${MAX} stored, the moved one out of the store (${ofG(w).length} stored, ${ofG(w, 'drawn').length} drawn, ${inStore(w).length} in nhl_v1)`);
  chk(msg.startsWith(said) && msg.endsWith(`Your parlay: ${MAX} legs.`), `the window says the moved leg is taken out for good and why (${msg.slice(0, 300)})`);
  const errs2 = [], w2 = await boot(AT, errs2, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props, store: w.localStorage.getItem('nhl_v1') });
  chk(canon(ofG(w2)) === canon(want) && canon(ofG(w2, 'drawn')) === canon(want), `a reload opens on the ${MAX} the parlay showed, the moved leg not back (${ofG(w2).length} stored, ${ofG(w2, 'drawn').length} drawn)`);
  /* the nested rule: a player's points Over stored, the press finds no points line on him (pulled), and his anytime goal goes in */
  const NP = pr.awayP.skaters.concat(pr.homeP.skaters).find(p => mainOf(p.id, 'pts') && parsed.yes.some(r => r[0] === String(p.id) && r[1] === 'g' && r[2] === 1));
  if (!NP) { chk(false, `the made-up answer prices a skater's points beside his anytime goal (${G.id})`); return; }
  const npm = mainOf(NP.id, 'pts'), refN = PROP_REF(NP.id), A3 = propsAnswer(G);
  A3.items = A3.items.filter(it => !(it && it.athlete && it.athlete.$ref === refN && it.type.name === 'Total Points'));
  const ptsLeg = { game: G.id, kind: 'prop', pid: String(NP.id), name: NP.name, team: pr.awayP.skaters.includes(NP) ? G.away : G.home, grp: NP.pos === 'D' ? 'D' : 'F', stat: 'pts', mk: 'main', side: 'over', line: npm[2], k: null, odds: npm[3], other: npm[4], at: at0 };
  const errs3 = [], w3 = await boot(AT, errs3, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props: answer(A3), store: JSON.stringify({ legs: [ptsLeg], ui: { tab: 'parlays' } }) });
  await press(w3);
  chk(ofG(w3).length === 1 && ofG(w3, 'drawn').length === 0, `a press that finds no points line on ${NP.name} takes his points Over out of the builder and keeps it stored (${ofG(w3).length} stored, ${ofG(w3, 'drawn').length} drawn)`);
  const tapG = tap(w3, `${NP.id}|g|yes|1`, 'g'), msg3 = txt(w3.document.getElementById('ppMsg')), goal = [`${NP.id}|g|0.5`];
  chk(tapG && canon(ofG(w3)) === canon(goal) && canon(ofG(w3, 'drawn')) === canon(goal) && canon(inStore(w3)) === canon(goal) && msg3.startsWith(`On ${mu}, ${NP.name} Over ${npm[2]} points had left the builder and is now taken out of it for good, so it cannot come back beside ${NP.name} Anytime goal on a reload.`), `his anytime goal goes in beside the points Over the read took out, which leaves the store for good, said (${canon(ofG(w3))}; ${msg3.slice(0, 240)})`);
  const errs4 = [], w4 = await boot(AT, errs4, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props, store: w3.localStorage.getItem('nhl_v1') });
  chk(canon(ofG(w4)) === canon(goal) && canon(ofG(w4, 'drawn')) === canon(goal), `a reload opens on his anytime goal alone, never beside his points (${canon(ofG(w4))})`);
  /* several out at the most: 21 stored, the press moves three of their lines (18 drawn), one more goes in. Only one leaves the store,
     the last stored of the three, said by name; the other two stay stored and come back on a reload */
  const mv3 = [cand[2], cand[5], cand[9]], A5 = propsAnswer(G), m5 = mv3.map(c => moveIn(A5, c)), hid5 = mv3.map(lid);
  const errs5 = [], w5 = await boot(AT, errs5, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props: answer(A5), store: JSON.stringify({ legs: cand.slice(0, MAX).map(legOf), ui: { tab: 'parlays' } }) });
  await press(w5);
  chk(m5.every(n => n === 2) && ofG(w5).length === MAX && ofG(w5, 'drawn').length === MAX - 3 && hid5.every(x => !ofG(w5, 'drawn').includes(x)), `a press that moves three of ${MAX} stored legs' lines takes the three out of the builder and keeps them stored (${m5}; ${ofG(w5).length} stored, ${ofG(w5, 'drawn').length} drawn)`);
  const ord5 = order(w5), last5 = mv3.slice().sort((a, b) => ord5.indexOf(lid(b)) - ord5.indexOf(lid(a)))[0];
  const tap5 = tap(w5, keyOf(nth), nth.st), msg5 = txt(w5.document.getElementById('ppMsg'));
  const want5 = cand.slice(0, MAX).filter(c => c !== last5).concat([nth]).map(lid).sort(), drawn5 = want5.filter(x => !hid5.includes(x));
  chk(tap5 && ord5.includes(lid(last5)) && canon(ofG(w5)) === canon(want5) && canon(inStore(w5)) === canon(want5) && canon(ofG(w5, 'drawn')) === canon(drawn5), `with three of them out of the builder, one more goes in and only the last stored of the three leaves the store: ${MAX} stored, the other two kept (${ofG(w5).length} stored, ${ofG(w5, 'drawn').length} drawn, ${inStore(w5).length} in nhl_v1)`);
  chk(msg5.startsWith(`On ${mu}, ${desc(last5)} had left the builder and is now taken out of it for good, so it cannot come back beside ${desc(nth)} on a reload. Added to your parlay:`), `the window names the one taken out for good, and no other (${msg5.slice(0, 300)})`);
  const errs6 = [], w6 = await boot(AT, errs6, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props, store: w5.localStorage.getItem('nhl_v1') });
  chk(canon(ofG(w6)) === canon(want5) && canon(ofG(w6, 'drawn')) === canon(want5), `a reload opens on ${MAX}, the two the read took out and kept back in the parlay (${ofG(w6).length} stored, ${ofG(w6, 'drawn').length} drawn)`);
  /* every one out: 21 stored, the press finds no props posted on the game (ESPN's 404), and the home moneyline goes in from the Games
     card: one player leg, the last stored, leaves the store, said on the slip bar; the other 20 stay and come back on a reload */
  const errs7 = [], w7 = await boot(AT, errs7, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props: PROPS_404, store: JSON.stringify({ legs: cand.slice(0, MAX).map(legOf), ui: { tab: 'parlays' } }) });
  await press(w7);
  chk(ofG(w7).length === MAX && ofG(w7, 'drawn').length === 0, `a press that finds no props posted on the game takes all ${MAX} out of the builder and keeps them stored (${ofG(w7).length} stored, ${ofG(w7, 'drawn').length} drawn)`);
  const ord7 = order(w7), last7 = cand.slice(0, MAX).sort((a, b) => ord7.indexOf(lid(b)) - ord7.indexOf(lid(a)))[0];
  closeBets(w7.document);
  const ml7 = tapBet(w7.document, G, `${G.id}|home|ml`);
  const want7 = cand.slice(0, MAX).filter(c => c !== last7).map(lid).concat(['home|ml']).sort(), slip7 = txt(w7.document.getElementById('slipMsg'));
  chk(!!ml7 && canon(ofG(w7)) === canon(want7) && canon(inStore(w7)) === canon(want7) && canon(ofG(w7, 'drawn')) === canon(['home|ml']), `the home moneyline goes in beside them: one player leg, the last stored, leaves the store, the other ${MAX - 1} kept (${ofG(w7).length} stored, ${ofG(w7, 'drawn').length} drawn, ${inStore(w7).length} in nhl_v1)`);
  chk(slip7 === `On ${mu}, ${desc(last7)} had left the builder and is now taken out of it for good, so it cannot come back beside ${S.teams[G.home].short} to win on a reload.`, `the slip bar names that one leg alone (${slip7.slice(0, 300)})`);
  const errs8 = [], w8 = await boot(AT, errs8, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props, store: w7.localStorage.getItem('nhl_v1') });
  chk(canon(ofG(w8)) === canon(want7) && canon(ofG(w8, 'drawn')) === canon(want7), `a reload opens on the moneyline and the ${MAX - 1} player legs (${ofG(w8).length} stored, ${ofG(w8, 'drawn').length} drawn)`);
  /* below the most: a player's points Over the press took out (no points line on him) stays stored when the game's total and another
     player's line go in beside it, nothing said of it, and comes back on a reload. What the slip bar says of the read stands through an
     add without a word of its own, and comes back when a replacement said over it goes */
  const other = cand.find(c => String(c.x.id) !== String(NP.id));
  const errs9 = [], w9 = await boot(AT, errs9, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props: answer(A3), store: JSON.stringify({ legs: [ptsLeg], ui: { tab: 'parlays' } }) });
  await press(w9);
  const d9 = w9.document, slip9 = () => txt(d9.getElementById('slipMsg')), readSaid = slip9(), t9 = Date.now(), ptsK = `${NP.id}|pts|${npm[2]}`;
  closeBets(d9);
  const tot = side => betIn(d9, G, `${G.id}|${side}|ou`);
  chk(readSaid.startsWith(`${NP.name} Over ${npm[2]} points left the builder: DraftKings had no points line on ${NP.name}`), `the slip bar says the read took his points Over out (${readSaid.slice(0, 200)})`);
  if (tot('over')) tot('over').click();
  chk(!!tot('over') && canon(ofG(w9)) === canon([ptsK, 'over|ou'].sort()) && canon(inStore(w9)) === canon([ptsK, 'over|ou'].sort()) && canon(ofG(w9, 'drawn')) === canon(['over|ou']), `the game's total goes in beside the points Over the read took out, which stays stored (${canon(ofG(w9))}; ${canon(inStore(w9))})`);
  const live = Date.now() - t9 < 8000;           // the read's line runs nine seconds
  if (live) chk(slip9() === readSaid, `an add without a word of its own leaves what the slip bar says of the read ("${slip9().slice(0, 160)}")`);
  tot('under').click();
  const rep9 = slip9();
  chk(/^Under [\d.]+ replaced Over [\d.]+ on .*: one total a game\.$/.test(rep9) && !/taken out/.test(rep9), `the Under in place of the Over is said on the slip bar, nothing of the points Over (${rep9})`);
  tot('under').click();
  if (live && Date.now() - t9 < 8000) chk(slip9() === readSaid, `the Under tapped off ends the replacement and the read's line comes back ("${slip9().slice(0, 160)}")`);
  else console.log('  the read\'s line ran out before it could be held (a slow run): not checked');
  betsOn(d9, G);
  const tapO = tap(w9, keyOf(other), other.st), msg9 = txt(d9.getElementById('ppMsg')), want9 = [ptsK, lid(other)].sort();
  chk(tapO && canon(ofG(w9)) === canon(want9) && canon(inStore(w9)) === canon(want9) && !/taken out|replaced/.test(msg9), `another player's line goes in beside it too, the points Over still stored, nothing said of it (${canon(ofG(w9))}; ${msg9.slice(0, 200)})`);
  const errs10 = [], w10 = await boot(AT, errs10, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props, store: w9.localStorage.getItem('nhl_v1') });
  chk(canon(ofG(w10)) === canon(want9) && canon(ofG(w10, 'drawn')) === canon(want9), `a reload brings the points Over back beside the other line (${canon(ofG(w10, 'drawn'))})`);
  /* a read alone that names another book for the game (or none): the game draws one leg, the rest stay stored; a leg added takes the
     place of the one drawn alone, every other kept to the published line's rule (one in its slot replaced, said), and a reload on the
     published DraftKings line opens on them all */
  const errsB = [];
  for (const book of ['ESPN BET', null]) {
    const sbB = async url => { const mm = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), dd = mm && `${mm[1]}-${mm[2]}-${mm[3]}`; return { ok: true, json: async () => ({ events: S.games.filter(g => g.date === dd).map(g => espnEvent(g, g.id === G.id ? espnOdds(g.line, null, book) : null)) }) }; };
    const four = cand.slice(0, 4), wB = await boot(AT, errsB, { state: JSON.stringify(M), hash: 'parlays', espn: sbB, props, store: JSON.stringify({ legs: four.map(legOf), ui: { tab: 'parlays' } }) });
    await press(wB);
    const bk = book || 'the book', drawnB = ofG(wB, 'drawn'), shownB = four.find(c => drawnB.includes(lid(c))), restB = four.filter(c => c !== shownB);
    chk(JSON.parse(wB.eval(`JSON.stringify(gameById()[${JSON.stringify(G.id)}].line.book)`)) === book && drawnB.length === 1 && !!shownB && ofG(wB).length === 4, `a read naming ${bk} for the game draws one of its 4 stored legs and keeps the rest stored (${drawnB}; ${ofG(wB).length} stored)`);
    const tP = Date.now(), live = () => Date.now() - tP < 8000, base = ww => ww.eval('SLIP_BASE ? SLIP_BASE.msg : ""');     // the read's slip line runs nine seconds
    const whyC = `its lines are at ${bk}, and a same-game parlay is priced here on DraftKings' prices alone.`, why = `one leg a game here: ${whyC}`;
    const leftOut = x => `${x} is left out of the parlay on ${mu}: one leg a game here, ${whyC}`, inPlace = (a, b) => `On ${mu}, ${a} is in the parlay in place of ${b}: one leg a game here, ${whyC}`;
    if (live()) chk(restB.every(c => base(wB).includes(leftOut(desc(c)))), `${bk}: the slip bar says the read leaves each of the other 3 out of the parlay ("${base(wB).slice(0, 200)}")`);
    /* a leg added: drawn alone in place of the one drawn, which stays stored with the rest, said */
    const c5 = cand[4], tB = tap(wB, keyOf(c5), c5.st), msgB = txt(wB.document.getElementById('ppMsg')), wantB = four.concat([c5]).map(lid).sort();
    chk(tB && canon(ofG(wB)) === canon(wantB) && canon(inStore(wB)) === canon(wantB) && canon(ofG(wB, 'drawn')) === canon([lid(c5)]), `${bk}: a leg added is drawn alone in place of the one drawn, all 4 kept stored (${ofG(wB).length} stored, ${inStore(wB).length} in nhl_v1)`);
    chk(msgB.startsWith(`${inPlace(desc(c5), desc(shownB))} Added to your parlay:`), `${bk}: the window says which leg it is in place of, and no other (${msgB.slice(0, 260)})`);
    /* a stored leg the read left out, its button not pressed: a tap puts it in again in place of the one drawn, never takes it out;
       the slip bar's line about the read no longer says it is left out */
    const r1 = restB[1], bP = () => { const dd = wB.document; const z = propBox(dd, `${keyOf(r1)}`); return z && String(z.checked); };
    const was = bP(), tR = tap(wB, keyOf(r1), r1.st), msgR = txt(wB.document.getElementById('ppMsg'));
    chk(was === 'false' && tR && canon(ofG(wB)) === canon(wantB) && canon(inStore(wB)) === canon(wantB) && canon(ofG(wB, 'drawn')) === canon([lid(r1)]) && bP() === 'true' && msgR.startsWith(`${inPlace(desc(r1), desc(c5))} Added to your parlay:`), `${bk}: a tap on a stored leg the builder leaves out puts it in place of the one drawn, every leg kept (${was}; ${canon(ofG(wB, 'drawn'))}; ${msgR.slice(0, 200)})`);
    if (live()) chk(!base(wB).includes(leftOut(desc(r1))) && base(wB).includes(leftOut(desc(restB[2]))), `${bk}: the read's line on the slip bar drops what it said of the leg now drawn and keeps the rest ("${base(wB).slice(0, 240)}")`);
    else console.log(`  ${bk}: the read's slip line ran out before it could be held (a slow run): not checked`);
    /* the Under of a leg the read left out: in its slot, so the stored Over goes, said under the published rule; the one drawn stays */
    const h = restB[0], tU = tap(wB, keyOf(h, 'under'), h.st), msgU = txt(wB.document.getElementById('ppMsg'));
    const hU = `${h.x.id}|${h.st}|${h.m[2]}`, wantU = wantB.filter(x => x !== lid(h)).concat([hU]).sort();
    chk(tU && canon(ofG(wB)) === canon(wantU) && canon(inStore(wB)) === canon(wantU) && canon(ofG(wB, 'drawn')) === canon([hU]) && JSON.parse(wB.eval(`JSON.stringify(P.legs.find(l => l.pid === ${JSON.stringify(String(h.x.id))} && l.stat === ${JSON.stringify(h.st)}).side)`)) === 'under', `${bk}: the Under of a stored leg the read left out replaces that stored Over and is drawn alone, every other kept (${canon(ofG(wB))})`);
    chk(msgU.startsWith(`${inPlace(desc(h, 'under'), desc(r1))} ${desc(h, 'under')} replaced ${desc(h)} on ${mu}: one leg a player a stat. Added to your parlay:`), `${bk}: the window says both, each with its rule (${msgU.slice(0, 320)})`);
    const wR = await boot(AT, errsB, { state: JSON.stringify(M), hash: 'parlays', espn: sbB, props, store: wB.localStorage.getItem('nhl_v1') });
    chk(canon(ofG(wR)) === canon(wantU) && canon(ofG(wR, 'drawn')) === canon(wantU), `${bk}: a reload on the published DraftKings line opens on all ${wantU.length} (${ofG(wR, 'drawn').length} drawn)`);
    /* the leg drawn taken out: another stored leg is drawn in its place, said in the window and on the slip bar */
    const tO = tap(wB, keyOf(h, 'under'), h.st), msgO = txt(wB.document.getElementById('ppMsg')), dO = ofG(wB, 'drawn'), cO = four.concat([c5]).find(c => dO.includes(lid(c)));
    const wantO = wantU.filter(x => x !== hU), sayO = cO && inPlace(desc(cO), desc(h, 'under'));
    chk(tO && canon(ofG(wB)) === canon(wantO) && canon(inStore(wB)) === canon(wantO) && dO.length === 1 && !!cO && msgO === `Taken out of your parlay: ${desc(h, 'under')}. ${sayO} Your parlay: 1 leg.` && txt(wB.document.getElementById('slipMsg')) === sayO, `${bk}: the leg drawn taken out, the leg drawn in its place is said in the window and on the slip bar (${canon(dO)}; ${msgO.slice(0, 260)}; "${txt(wB.document.getElementById('slipMsg')).slice(0, 160)}")`);
    if (live() && cO) chk(!base(wB).includes(leftOut(desc(cO))), `${bk}: the read's line on the slip bar no longer says the leg now drawn is left out ("${base(wB).slice(0, 240)}")`);
    /* team bets the same way: the moneyline and the total stored, the read draws the moneyline; the Over's buttons are not pressed, a tap
       puts it in (never takes it out), the moneyline stays stored, a reload opens on both, and the Over taken out brings the moneyline in */
    const ml = { game: G.id, side: 'home', kind: 'ml', odds: G.line.homeML, line: null, p: G.pHome, label: mu, text: '', date: G.date, start: G.start };
    const ov = { game: G.id, side: 'over', kind: 'ou', odds: G.line.overOdds, line: G.line.total, p: G.ou.over, label: mu, text: '', date: G.date, start: G.start };
    const wT = await boot(AT, errsB, { state: JSON.stringify(M), hash: 'parlays', espn: sbB, props, store: JSON.stringify({ legs: [ml, ov], ui: { tab: 'parlays' } }) });
    await press(wT); betsOn(wT.document, G);          // the window left open on G: its Game bets (nhl v23) are the card's bets
    /* a bet's box on the game's page (opened again where a change of tab shut it) or its button in Pick your own legs; ticked, or pressed with its check, is in the parlay */
    const tq = Date.now(), dT = wT.document, bet = (sel, k) => { if (sel === '#gameView') betsOn(dT, G); return [...dT.querySelectorAll(`${sel} [data-leg="${G.id}|${k}"]`)]; };
    const pressed = (k, sel) => bet(sel || '#gameView', k).map(b => b.tagName === 'INPUT' ? (b.checked ? 'true+in' : 'false') : b.getAttribute('aria-pressed') + (b.querySelector('.pb-bin') ? '+in' : '')).join();
    const tab = k => dT.querySelector(`#tabs button[data-tab="${k}"]`).click();      // each tab is drawn when shown
    const mlD = `${S.teams[G.home].short} to win`, ovD = `Over ${G.line.total}`, pg = [pressed('over|ou'), pressed('home|ml')];
    tab('parlays'); const pl = [bet('#plLines', 'over|ou').length, pressed('over|ou', '#plLines'), pressed('home|ml', '#plLines')]; tab('games');
    chk(canon(ofG(wT, 'drawn')) === canon(['home|ml']) && canon(ofG(wT)) === canon(['home|ml', 'over|ou'].sort()) && bet('#gameView', 'over|ou').length === 1 && pg.join(';') === 'false;true+in' && (!pl[0] || pl.slice(1).join(';') === 'false;true+in'), `${bk}: the moneyline drawn and the Over left out, the Over's button in its Game bets${pl[0] ? ' and in Pick your own legs' : ''} not pressed (Games ${pg}; Pick your own legs ${pl})`);
    bet('#gameView', 'over|ou')[0].click();
    const sayT = inPlace(ovD, mlD);
    chk(canon(ofG(wT, 'drawn')) === canon(['over|ou']) && canon(inStore(wT)) === canon(['home|ml', 'over|ou'].sort()) && /^true\+in/.test(pressed('over|ou')) && /^false/.test(pressed('home|ml')) && txt(dT.getElementById('slipMsg')) === sayT, `${bk}: a tap on the Over puts it in place of the moneyline, both kept stored, said on the slip bar (${canon(inStore(wT))}; ${pressed('over|ou')}; "${txt(dT.getElementById('slipMsg'))}")`);
    if (Date.now() - tq < 8000) chk(!base(wT).includes(leftOut(ovD)), `${bk}: the read's line on the slip bar no longer says the Over is left out ("${base(wT).slice(0, 200)}")`);
    const wT2 = await boot(AT, errsB, { state: JSON.stringify(M), hash: 'parlays', espn: sbB, props, store: wT.localStorage.getItem('nhl_v1') });
    chk(canon(ofG(wT2, 'drawn')) === canon(['home|ml', 'over|ou'].sort()), `${bk}: a reload on the published DraftKings line opens on the moneyline and the Over (${canon(ofG(wT2, 'drawn'))})`);
    bet('#gameView', 'over|ou')[0].click();
    const sayT2 = inPlace(mlD, ovD), slT2 = txt(dT.getElementById('slipMsg')); tab('parlays');
    chk(canon(inStore(wT)) === canon(['home|ml']) && canon(ofG(wT, 'drawn')) === canon(['home|ml']) && slT2 === sayT2 && txt(dT.getElementById('bMsg')).startsWith(sayT2), `${bk}: the Over tapped again comes out, the moneyline drawn in its place, said on the slip bar and in the builder (${canon(inStore(wT))}; "${slT2}"; "${txt(dT.getElementById('bMsg')).slice(0, 200)}")`);
  }
  /* a team bet at a number a read has moved: the same side at the old number, out of the builder and stored, is replaced, said */
  {
    const T0 = G.line.total, sbM = async url => { const mm = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), dd = mm && `${mm[1]}-${mm[2]}-${mm[3]}`; return { ok: true, json: async () => ({ events: S.games.filter(g => g.date === dd).map(g => espnEvent(g, g.id === G.id ? espnOdds(Object.assign({}, g.line, { total: T0 + 1 }), null) : null)) }) }; };
    const ml = { game: G.id, side: 'home', kind: 'ml', odds: G.line.homeML, line: null, p: G.pHome, label: mu, text: '', date: G.date, start: G.start };
    const ov = { game: G.id, side: 'over', kind: 'ou', odds: G.line.overOdds, line: T0, p: G.ou.over, label: mu, text: '', date: G.date, start: G.start };
    const wM = await boot(AT, errsB, { state: JSON.stringify(M), hash: 'parlays', espn: sbM, props, store: JSON.stringify({ legs: [ml, ov], ui: { tab: 'parlays' } }) });
    await press(wM); closeBets(wM.document);
    const ovB = () => betIn(wM.document, G, `${G.id}|over|ou`);
    chk(canon(ofG(wM, 'drawn')) === canon(['home|ml']) && canon(ofG(wM)) === canon(['home|ml', 'over|ou'].sort()) && !!ovB() && !ovB().checked, `a read that moves the total to ${T0 + 1} takes the Over ${T0} out of the builder and keeps it stored, the Over's button not pressed (${canon(ofG(wM, 'drawn'))})`);
    if (ovB()) ovB().click();
    const lines = JSON.parse(wM.eval(`JSON.stringify(P.legs.filter(l => l.game === ${JSON.stringify(G.id)} && l.kind === 'ou').map(l => l.side + l.line))`)), sayM = `Over ${T0 + 1} replaced Over ${T0} on ${mu}: one total a game.`;
    const slM = txt(wM.document.getElementById('slipMsg')); wM.document.querySelector('#tabs button[data-tab="parlays"]').click();
    chk(lines.join() === `over${T0 + 1}` && canon(ofG(wM, 'drawn')) === canon(['home|ml', 'over|ou'].sort()) && slM === sayM && txt(wM.document.getElementById('bMsg')).startsWith(sayM), `the Over at ${T0 + 1} replaces the stored Over ${T0}, said on the slip bar and in the builder (${lines}; "${slM}"; "${txt(wM.document.getElementById('bMsg')).slice(0, 200)}")`);
    /* a level holding the same Over at the number the read moved it to is another bet: it does not keep the stored Over T0, so Add to
       builder asks before it goes, with the moneyline drawn beside it and with the Over alone stored (none drawn), and No keeps the store
       as it was. The Over at T0+1 is planted in one level of a copy of the panel's levels (PB_CUR; the levels' cache untouched), the
       rest of that level its own legs, so it holds whatever the read leaves the levels */
    for (const [legs, n] of [[[ml, ov], 1], [[ov], 0]]) {
      const wX = await boot(AT, errsB, { state: JSON.stringify(M), hash: 'parlays', espn: sbM, props, store: JSON.stringify({ legs, ui: { tab: 'parlays' } }) });
      await press(wX); closeBets(wX.document);
      const dX = wX.document;
      /* planted through the page's own spDay, so the tab draws the level and its Add to builder takes it as drawn */
      const id = wX.eval(`(() => { const D = spDay(${JSON.stringify(G.date)}), id = Object.keys(D.levels).find(k => { const r = D.levels[k]; return r && r.legs && r.legs.length >= 2; }); if (!id) return null;
        const g = gameById()[${JSON.stringify(G.id)}], L = legOf(g, 'over', 'ou'), r = D.levels[id], rest = r.legs.filter(x => x.game !== g.id).slice(0, r.legs.length - 1);
        if (!L || L.num !== ${T0 + 1}) return null;
        const planted = Object.assign({}, r, { legs: rest.concat([L]).sort(legCmp) }), real = spDay;
        spDay = date => { const D2 = real(date); if (date === ${JSON.stringify(G.date)}) D2.levels[id] = planted; return D2; };
        return id; })()`);
      dX.querySelector('#tabs button[data-tab="suggest"]').click();
      const addX = id && dX.querySelector(`#spBody button[data-sp-add="${G.date}|${id}"]`);
      if (!addX) { console.log(`  no suggested level of ${G.date} to plant the Over at ${T0 + 1} on: Add to builder beside a stored leg at a moved number not held`); break; }
      const what = `${TIERS.find(x => x[0] === id)[1]} ${addX.closest('.pb-tier').querySelectorAll('.pb-tl').length}-leg parlay`;      // the level's own size (nhl v31: any size)
      const s0 = wX.localStorage.getItem('nhl_v1'), a0 = wX.__asked.length; wX.__confirm = false;
      addX.click();
      const asked = wX.__asked.slice(a0).join(' | '); wX.__confirm = true;
      const want = n ? `Replace the 1 leg in the builder, and the 1 leg kept on this device that it leaves out of the parlay, with the ${what}?` : `Replace the 1 leg kept on this device that the builder leaves out of the parlay with the ${what}?`;
      chk(asked === want && wX.localStorage.getItem('nhl_v1') === s0 && canon(inStore(wX)) === canon(legs.map(l => l.side + '|' + l.kind).sort()), `a level holding the Over at ${T0 + 1} does not keep the stored Over ${T0}: with ${n} leg${n === 1 ? '' : 's'} drawn, Add to builder asks before it goes, and No keeps the store (${asked || 'not asked'})`);
    }
  }
  /* a level's Add to builder and Clear all ask before any stored leg goes, those the builder leaves out among them: five player legs
     stored, a press finds no props posted on the game (ESPN's 404), none drawn */
  {
    const wA = await boot(AT, errsB, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props: PROPS_404, store: JSON.stringify({ legs: cand.slice(0, 5).map(legOf), ui: { tab: 'parlays' } }) });
    await press(wA); closeBets(wA.document);
    const dA = wA.document, before = () => JSON.stringify((JSON.parse(wA.localStorage.getItem('nhl_v1') || '{}').legs || []));
    chk(ofG(wA).length === 5 && ofG(wA, 'drawn').length === 0, `a press that finds no props posted takes the 5 out of the builder and keeps them stored (${ofG(wA).length} stored, ${ofG(wA, 'drawn').length} drawn)`);
    dA.querySelector('#tabs button[data-tab="suggest"]').click();
    const lvB = () => dA.querySelector('#spBody button[data-sp-add]:not([disabled])');
    const lvWhat = b => b && `${TIERS.find(x => x[0] === b.dataset.spAdd.split('|')[1])[1]} ${b.closest('.pb-tier').querySelectorAll('.pb-tl').length}-leg parlay`;      // the level's own size
    const lv = lvB(), what = lvWhat(lv);
    if (!lv) console.log('  no suggested level to add: a level\'s Add to builder asking before the legs it leaves out go is not held on this state');
    else {
      const s0 = before(), a0 = wA.__asked.length; wA.__confirm = false; lv.click();
      chk(before() === s0 && wA.__asked.slice(a0).join(' | ') === `Replace the 5 legs kept on this device that the builder leaves out of the parlay with the ${what}?`, `with none drawn and 5 stored, Add to builder asks first, and No keeps them (${wA.__asked.slice(a0).join(' | ') || 'not asked'})`);
      const mlA = tapBet(dA, G, `${G.id}|home|ml`);
      chk(!!mlA && ofG(wA).length === 6 && canon(ofG(wA, 'drawn')) === canon(['home|ml']), `the home moneyline goes in beside them (${ofG(wA).length} stored, ${canon(ofG(wA, 'drawn'))})`);
      const s1 = before(), a1 = wA.__asked.length; dA.getElementById('clearParlay').click();
      chk(before() === s1 && wA.__asked.slice(a1).join(' | ') === 'Clear the 1 leg from the builder, and the 5 legs kept on this device that it leaves out of the parlay?', `Clear all with 1 drawn and 5 left out asks first, and No keeps all 6 (${wA.__asked.slice(a1).join(' | ') || 'not asked'})`);
      const lv2 = lvB(), a2 = wA.__asked.length; if (lv2) lv2.click();
      chk(!!lv2 && before() === s1 && wA.__asked.slice(a2).join(' | ') === `Replace the 1 leg in the builder, and the 5 legs kept on this device that it leaves out of the parlay, with the ${lvWhat(lv2)}?`, `Add to builder with 1 drawn and 5 left out asks about all 6, and No keeps them (${wA.__asked.slice(a2).join(' | ') || 'not asked'})`);
      wA.__confirm = true; const lv3 = lvB(), k3 = lv3 && lv3.dataset.spAdd.split('|');
      const ids3 = k3 ? JSON.parse(wA.eval(`JSON.stringify(spDay(${JSON.stringify(k3[0])}).levels[${JSON.stringify(k3[1])}].legs.map(L => L.id))`)) : [];
      if (lv3) lv3.click();
      chk(!!lv3 && JSON.stringify((JSON.parse(wA.localStorage.getItem('nhl_v1') || '{}').legs || []).map(l => `${l.game}|${l.side}|${l.kind}`)) === JSON.stringify(ids3), `Yes puts exactly the level's legs in (${ids3.length})`);
    }
  }
  const all = errs.concat(errs2, errs3, errs4, errs5, errs6, errs7, errs8, errs9, errs10, errsB);
  chk(!all.length, 'no runtime error with legs a read took out of the builder: ' + all.join(' | '));
}
async function builderPlayerLegs(M, G, H, AT) {
  const T = M.sgp, A = propsAnswer(G), parsed = E.propsOf(A.items), pr = M.props.games[G.id];
  const errs = [], sb = async url => { const mm = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), dd = mm && `${mm[1]}-${mm[2]}-${mm[3]}`; return { ok: true, json: async () => ({ events: S.games.filter(g => g.date === dd).map(g => espnEvent(g, null)) }) }; };
  let propsNow = url => { const m = PROPS_RX.exec(url); return m && m[1] === G.id ? { ok: true, status: 200, json: async () => ({ pageCount: 1, items: JSON.parse(JSON.stringify(A.items)) }) } : PROPS_404(url); };
  const w = await boot(AT, errs, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props: url => propsNow(url) }), d = w.document, $ = id => d.getElementById(id);
  const store = () => JSON.parse(w.localStorage.getItem('nhl_v1') || '{}'), mu = `${S.teams[G.away].abbr} @ ${S.teams[G.home].abbr}`;
  const tiers = (ww = w) => { ww.eval('renderSuggest()'); return canon([...ww.document.querySelectorAll('#spBody .pb-tier')].map(t => [t.closest('.sp-day').dataset.spDay, t.dataset.tier, [...t.querySelectorAll('.pb-tl')].map(x => x.dataset.id), txt(t.querySelector('.pb-nums')), txt(t.querySelector('.pb-rule'))])); };
  const tiers0 = tiers();
  holdPanel(w, AT, 'before any player leg'); holdSuggest(w, AT, 'before any player leg');          // what the levels are held to below: the rules' own, by brute force
  /* before a press: no price in a window can be added */
  const dayOn = dd => openDay(d, dd);
  d.querySelector('#tabs button[data-tab="games"]').click(); dayOn(G.date);
  betsOn(d, G);
  chk(!d.querySelector('#gameView input[data-pp-add]'), "before a press the game's page offers no player's price to add");
  $('ppRefreshOdds').click(); await oddsDone(w); await wait(20);
  const readAt = w.eval(`PROPS.games[${JSON.stringify(G.id)}].at`), writes0 = w.__writes.length;
  chk(!!readAt && w.eval(`PROPS.games[${JSON.stringify(G.id)}].status`) === 200, `the press read DraftKings' props on ${G.id}`);
  /* the players: X an away forward with a points line, Y a home skater with a shots 3+ price, Z the home goalie with a saves line */
  const mainOf = (pid, st) => parsed.main.find(r => r[0] === String(pid) && r[1] === st), yesOf = (pid, st, k) => parsed.yes.find(r => r[0] === String(pid) && r[1] === st && r[2] === k);
  const X = pr.awayP.skaters.find(p => p.pos !== 'D' && mainOf(p.id, 'pts') && yesOf(p.id, 'g', 1)), Y = pr.homeP.skaters.find(p => yesOf(p.id, 's', 3) && (!mainOf(p.id, 's') || mainOf(p.id, 's')[2] !== 2.5) && p.id !== (X && X.id)), Z = pr.homeP.goalie && mainOf(pr.homeP.goalie.id, 'sv') ? pr.homeP.goalie : null;
  if (!X || !Y) { chk(false, `the made-up answer prices an away forward's points and a home skater's shots 3+ (${X && X.id}, ${Y && Y.id})`); return; }
  /* every DraftKings price of a player of the game's clubs a box the keyboard reaches, in a row 44px tall that takes the tap; none for
     an athlete matched to neither club (All skaters ticked, each player opened in turn) */
  const tab = () => { };
  let nBtn = 0; const badB = [], vw = d.getElementById('gameView');
  if (!d.getElementById('allCb').checked) d.getElementById('allCb').click();
  for (const pid of [...vw.querySelectorAll('button.plrbtn')].map(r => r.dataset.open)) {
    [...vw.querySelectorAll('button.plrbtn')].find(r => r.dataset.open === pid).click();
    const body = vw.querySelector('.plrbody'), club = (() => { let n = [...vw.querySelectorAll('button.plrbtn')].find(r => r.dataset.open === pid); while (n && !n.classList.contains('teamhdr')) n = n.previousElementSibling; return n ? n.dataset.team : ''; })();
    for (const tr of body ? body.querySelectorAll('table.rungs tr') : []) {
      const b = tr.querySelector('input[data-pp-add]'), priced = !!txt(tr.querySelector('.book'));
      if (priced !== !!b || ![G.home, G.away].includes(club)) { badB.push(`${pid}: ${txt(tr).slice(0, 40)} ${priced ? 'priced' : 'no price'}, ${b ? 'a box' : 'no box'} under ${club || 'neither club'}`); continue; }
      nBtn++; if (b.type !== 'checkbox' || b.disabled || b.tabIndex < 0 || b.checked || !b.getAttribute('aria-label') || !tr.classList.contains('pickable') || w.getComputedStyle(tr).height !== '44px') badB.push(`${pid}: ${b.dataset.ppAdd} not an unticked box the keyboard reaches in a 44px row`);
    }
  }
  chk(!vw.querySelector('.plrbtn[data-nohist="990000001"] input') && !!vw.querySelector('.plrbtn[data-nohist="990000001"]'), 'an athlete matched to neither club is listed with no box');
  chk(nBtn > 50 && !badB.length, `after the press every DraftKings price of a player of the game's clubs is a box the keyboard reaches, in a 44px row, and an athlete matched to neither club has none (${nBtn} boxes; ${badB.slice(0, 3).join(' | ')})`);
  /* the add: X's points Over, into the builder at DraftKings' price as read, dated by the read; the button pressed; said in the window */
  const xm = mainOf(X.id, 'pts');
  tab('pts');
  const xb = () => propBox(d, `${X.id}|pts|main|over|${xm[2]}`);
  xb().focus(); xb().click();
  const want1 = { game: G.id, kind: 'prop', pid: String(X.id), team: G.away, grp: 'F', stat: 'pts', mk: 'main', side: 'over', line: xm[2], k: null, odds: xm[3], other: xm[4], at: readAt };
  const s1 = (store().legs || []).find(l => l.kind === 'prop');
  chk(!!s1 && Object.keys(want1).every(k => canon(s1[k]) === canon(want1[k])) && s1.name === X.name, `a tap puts the leg in the builder at DraftKings' price as read, its line, side, player, game and read time (${canon(s1 || null).slice(0, 260)})`);
  chk(xb() && xb().checked && d.activeElement === xb(), 'the price is pressed, the keyboard\'s focus kept on it');
  chk(txt($('ppMsg')) === `Added to your parlay: ${X.name} Over ${xm[2]} points, ${PBS.odds(xm[3])}, DraftKings as read ${clockOf(Date.parse(readAt))}. Your parlay: 1 leg.`, `the window says what it added (${txt($('ppMsg'))})`);
  /* refused: X's goals beside his points; replaced: X's points Under in his Over's place */
  tab('g');
  const xg = propBox(d, `${X.id}|g|yes|1`), legs1 = canon(store().legs);
  xg.click();
  chk(canon(store().legs) === legs1 && txt($('ppMsg')) === `Not added: ${X.name}'s points and his own goals are nearly one bet (every goal is a point). DraftKings may not take both on one ticket, so this page never puts them together.`.replace(`${X.name}'s`, /s$/.test(X.name) ? `${X.name}'` : `${X.name}'s`), `a player's goals beside his own points are refused, said plainly (${txt($('ppMsg'))})`);
  /* refused both ways round with assists: W's points beside his own assists, and his assists beside his own points (W another skater
     of the game with an assists line); neither is stored, each said plainly, and each taken out again by a second tap */
  const possS = nm => /s$/.test(nm) ? `${nm}'` : `${nm}'s`;
  const W = pr.awayP.skaters.concat(pr.homeP.skaters).find(p => p.id !== X.id && p.id !== Y.id && mainOf(p.id, 'a') && mainOf(p.id, 'pts'));
  if (!W) chk(false, `the made-up answer prices a skater's assists beside his points (${G.id})`);
  else {
    const wa = mainOf(W.id, 'a'), wp = mainOf(W.id, 'pts'), refA = `Not added: ${possS(W.name)} points and his own assists are nearly one bet (every assist is a point). DraftKings may not take both on one ticket, so this page never puts them together.`;
    const wB = (st, m) => propBox(d, `${W.id}|${st}|main|over|${m[2]}`);
    tab('a'); wB('a', wa).click();
    chk(store().legs.some(l => l.kind === 'prop' && l.pid === String(W.id) && l.stat === 'a'), `${W.name}'s assists Over ${wa[2]} goes in beside ${X.name}'s points`);
    const legsA = canon(store().legs);
    tab('pts'); wB('pts', wp).click();
    chk(canon(store().legs) === legsA && txt($('ppMsg')) === refA && !wB('pts', wp).checked, `a player's points beside his own assists are refused, said plainly, nothing stored (${txt($('ppMsg'))})`);
    tab('a'); wB('a', wa).click();
    tab('pts'); wB('pts', wp).click();
    const legsP = canon(store().legs);
    chk(store().legs.some(l => l.kind === 'prop' && l.pid === String(W.id) && l.stat === 'pts') && !store().legs.some(l => l.kind === 'prop' && l.pid === String(W.id) && l.stat === 'a'), `with his assists taken out, ${W.name}'s points go in`);
    tab('a'); wB('a', wa).click();
    chk(canon(store().legs) === legsP && txt($('ppMsg')) === refA && !wB('a', wa).checked, `a player's assists beside his own points are refused the same way round, said, nothing stored (${txt($('ppMsg'))})`);
    tab('pts'); wB('pts', wp).click();
    chk(!store().legs.some(l => l.kind === 'prop' && l.pid === String(W.id)), `and ${W.name}'s points are taken out again`);
  }
  tab('pts');
  propBox(d, `${X.id}|pts|main|under|${xm[2]}`).click();
  chk(store().legs.filter(l => l.kind === 'prop').length === 1 && store().legs.find(l => l.kind === 'prop').side === 'under' && txt($('ppMsg')).startsWith(`${X.name} Under ${xm[2]} points replaced ${X.name} Over ${xm[2]} points on ${mu}: one leg a player a stat.`), `one leg a player a stat: his Under takes his Over's place, said (${txt($('ppMsg'))})`);
  chk(txt($('slipMsg')) === `${X.name} Under ${xm[2]} points replaced ${X.name} Over ${xm[2]} points on ${mu}: one leg a player a stat.`, `and said on the slip bar, as a side bet's replacement is (${txt($('slipMsg'))})`);
  propBox(d, `${X.id}|pts|main|under|${xm[2]}`).click();
  chk(!store().legs.some(l => l.kind === 'prop') && txt($('ppMsg')).startsWith(`Taken out of your parlay: ${X.name} Under ${xm[2]} points.`), `a second tap takes it out (${txt($('ppMsg'))})`);
  xb().click();
  closeBets(d);
  /* the bet buttons by the same-game rule: the home moneyline joins X (a same-game pair moving against each other: priced at the product) */
  d.querySelector('#tabs button[data-tab="games"]').click(); dayOn(G.date);
  const gb = (side, kind) => betIn(d, G, `${G.id}|${side}|${kind}`);
  gb('home', 'ml').click();
  const bq = () => JSON.parse(w.eval('JSON.stringify(quote(builderLegs(false)))'));
  const sgNow = chance => SG.parlay(T, store().legs.map(l => sgOf(M, l, chance)));
  let q = bq(), e = sgNow();
  chk(store().legs.length === 2 && q.est && Math.abs(q.fair - e.fair) < 1e-8 && Math.abs(q.dec - e.dec) < 1e-6 && q.dec <= q.product + 1e-12 && e.fair < store().legs.map(l => sgOf(M, l).p).reduce((a, b) => a * b, 1),
    `legs of one game that move against each other (an away forward's points and the home club's win): the fair chance under the product of the fair chances, worked out here (${q.fair} vs ${e.fair}), the price ${e.dec >= e.product - 1e-12 ? 'capped at' : 'under'} the legs' prices multiplied (${q.dec} vs ${q.product})`);
  /* a second side bet replaces the first, said: the away moneyline, X's own club's win, in the home moneyline's place */
  gb('away', 'ml').click();
  chk(store().legs.length === 2 && store().legs.some(l => l.kind === 'ml' && l.side === 'away') && txt($('slipMsg')).includes(`on ${mu}: one side bet a game (the moneyline or the puck line).`), `a second side bet takes the first's place, said (${txt($('slipMsg'))})`);
  /* two legs that move together: the price the hold over the joint of their implied chances, worked out here by an exact integral */
  q = bq(); e = sgNow();
  chk(q.est && Math.abs(q.fair - e.fair) < 1e-8 && Math.abs(q.dec - e.dec) < 1e-6 && q.dec < q.product - 1e-9 && Math.abs(q.product - e.product) < 1e-9,
    `two legs of one game that move together: the fair chance ${e.fair.toFixed(5)} and the price ${e.dec.toFixed(4)} (the hold ${T.hold.sgp} over the joint of the implied chances) worked out here, under the product ${e.product.toFixed(4)} (page ${q.fair}, ${q.dec})`);
  const pm = sgNow(l => l.kind === 'prop' ? sModelP(M, l) : sLeg(M.games.find(x => x.id === l.game), l.side, l.kind).p);
  chk(pm.fair !== null ? Math.abs(q.p - pm.fair) < 1e-8 : q.p === null, `the model's chance beside it is the same copula on the legs' model chances (${q.p} vs ${pm.fair})`);
  /* the total joins them; then the other side of the total replaces it, said; the puck line replaces the moneyline */
  gb('over', 'ou').click();
  chk(store().legs.length === 3, 'the total joins a side bet and a player leg of the same game');
  gb('under', 'ou').click();
  chk(store().legs.length === 3 && store().legs.some(l => l.kind === 'ou' && l.side === 'under') && txt($('slipMsg')).includes(`on ${mu}: one total a game.`), `the other side of the total takes its place, said (${txt($('slipMsg'))})`);
  gb('over', 'ou').click();
  /* Y's shots 3+ and Z's saves from the window; then H's moneyline, another game */
  dayOn(G.date); betsOn(d, G);
  tab('s'); propBox(d, `${Y.id}|s|yes|3`).click();
  if (Z) { tab('sv'); const zm = mainOf(Z.id, 'sv'); propBox(d, `${Z.id}|sv|main|under|${zm[2]}`).click(); }    // an Under: its fair chance its own implied
  else console.log(`  ${G.id}: no home goalie projected, so no saves Under in the builder; the Under's fair chance is held on the rows that have one`);
  chk(txt($('ppMsg')).endsWith(`Your parlay: ${Z ? 5 : 4} legs.`), `the window counts the parlay's legs (${txt($('ppMsg'))})`);
  closeBets(d);
  dayOn(H.date); tapBet(d, H, `${H.id}|home|ml`);
  d.querySelector('#tabs button[data-tab="parlays"]').click();
  /* the builder: a row a leg, "same game" on G's legs alone, each player leg's read time, fair chance and the props model's, on trial */
  const legs = store().legs, n = legs.length, rows = [...d.querySelectorAll('#legs .leg')];
  chk(rows.length === n && n === (Z ? 6 : 5), `the builder draws the ${n} legs (${rows.length})`);
  const sgRows = rows.filter(r => r.querySelector('.pill.sg')).map(r => r.dataset.id.split('|')[0]);
  chk(sgRows.length === n - 1 && sgRows.every(id => id === G.id), `"same game" on the legs of ${G.id} and no other (${sgRows.join(', ')})`);
  for (const l of legs.filter(l => l.kind === 'prop')) {
    const id = `${l.game}|p|${l.pid}|${l.stat}|${l.mk === 'yes' ? 'k' + l.k : l.side + l.line}`, r = rows.find(x => x.dataset.id === id), mp = sModelP(M, l);
    const f = l.mk === 'yes' ? fairYesS(l.stat, l.k, l.odds) : l.side === 'over' ? 1 - PBS.imp(l.other) : PBS.imp(l.odds), t = r ? txt(r) : '';
    chk(!!r && t.includes(PBS.odds(l.odds)) && t.includes(`DraftKings, as read ${clockOf(Date.parse(readAt))}`) && t.includes(`fair ${PBS.pctW(f)}${l.mk === 'yes' ? ' est.' : ''}`) && t.includes(mp === null ? 'no projection' : `model ${PBS.pctW(mp)}, on trial`), `the player leg ${id}: its price, its read, its fair chance and the props model's, on trial (${t})`);
  }
  chk(!Z || legs.some(l => l.kind === 'prop' && l.mk === 'main' && l.side === 'under' && l.stat === 'sv'), `an Under main line is among the player legs held here (${Z ? Z.name + "'s saves" : 'none'})`);
  /* the legs as the rule reads them: every leg the page hands tools/sgp.js's rule (its club and the other, its kind, number and side, the
     favourite, the player, his group and stat, its fair chance and price) is this smoke's reading of the stored leg */
  const conv = JSON.parse(w.eval('JSON.stringify(builderLegs(false).map(L => sgpLeg(L, L.fair)))')), mineC = store().legs.map(l => sgOf(M, l));
  const badC = conv.map((c, i) => { const m = mineC[i] || {}, ks = [...new Set(Object.keys(c).concat(Object.keys(m)))]; return ks.every(k => k === 'p' ? Math.abs(c.p - m.p) < 1e-12 : canon(c[k]) === canon(m[k])) ? null : `${canon(c)} vs ${canon(m)}`; }).filter(Boolean);
  chk(conv.length === mineC.length && !badC.length, `every leg reaches the same-game rule as it should: its clubs, kind, number, side, the favourite, the player's group and stat, its fair chance and price (${badC.slice(0, 2).join(' | ')})`);
  /* the price: G's legs joined (a Monte Carlo here), H multiplied; never above the product; est. wherever it shows */
  q = bq(); e = { product: store().legs.reduce((a, l) => a * PBS.decOf(+l.odds), 1) };
  const pgG = JSON.parse(w.eval(`JSON.stringify(SGP.parlay(S.sgp, builderLegs(false).map(L => sgpLeg(L, L.fair))).games)`)).find(x => x.game === G.id);
  const lsG = store().legs.filter(l => l.game === G.id).map(l => sgOf(M, l)), Rg = SG.pd(lsG.map((x, i) => lsG.map((y, j) => i === j ? 1 : SG.rho(M.sgp, x, y))));
  const jF = SG.joint(lsG.map(l => l.p), Rg), jI = SG.joint(lsG.map(l => 1 / l.dec), Rg), tolF = 4.5 * jF.se + 2e-4, tolI = 4.5 * jI.se + 2e-4;
  const hL = store().legs.find(l => l.game === H.id), hS = sgOf(M, hL);
  chk(!!pgG && Math.abs(pgG.fair - jF.p) <= tolF && Math.abs(pgG.implied - jI.p) <= tolI && Math.abs(pgG.dec - Math.min(pgG.product, T.hold.sgp / pgG.implied)) < 1e-12,
    `${lsG.length} legs of one game: their joint fair chance ${pgG && pgG.fair.toFixed(5)} and joint implied chance ${pgG && pgG.implied.toFixed(5)} are the rule's by two million draws here (${jF.p.toFixed(5)}, ${jI.p.toFixed(5)}, ± ${tolF.toFixed(5)}), the price the hold over the implied, never above the product`);
  chk(Math.abs(q.dec - pgG.dec * hS.dec) < 1e-9 && Math.abs(q.fair - pgG.fair * hS.p) < 1e-12 && Math.abs(q.product - e.product) < 1e-9 && q.dec <= q.product + 1e-12, `and the other game's leg multiplies it, the price and the fair chance (${q.dec} = ${pgG.dec} × ${hS.dec}; product ${q.product})`);
  console.log(`  the builder on ${G.id} (${mu}) and ${H.id}: ${[...d.querySelectorAll('#legs .leg')].map(r => txt(r.querySelector('.pb-ll b')) + ' ' + txt(r.querySelector('.pb-ll span')) + ' ' + txt(r.querySelector('.pb-lr b'))).join('; ')}`);
  console.log(`  priced ${PBS.toAm(q.dec)} est. (the legs multiplied ${PBS.toAm(q.product)}), fair chance ${PBS.pct1(q.fair)}, the model's ${q.p === null ? 'none' : PBS.pct1(q.p)}; ${G.id}'s ${lsG.length} legs joined ${pgG.fair.toFixed(4)} fair, ${pgG.implied.toFixed(4)} implied (two million draws here: ${jF.p.toFixed(4)}, ${jI.p.toFixed(4)})`);
  const bt = [...d.querySelectorAll('#parlayTotals .stat')].map(txt), notes = txt($('bNotes'));
  const why = "DraftKings prices same-game parlays its own way: this is an estimate from the legs' prices and how they move together";
  chk(bt[0].startsWith(PBS.pct1(q.fair)) && bt[0].includes(`Fair chance all ${n} land, est.`) && (q.p === null ? bt[0].includes('no model chance on every leg') : bt[0].includes(`model ${PBS.pct1(q.p)}, props model on trial`)), `the summary leads with DraftKings' fair chance of the parlay, est., the model's beside it on trial (${bt[0]})`);
  chk(bt[1].startsWith(`${PBS.toAm(q.dec)} est.`) && bt[1].includes('DraftKings price, estimated') && bt[1].includes(`the legs multiplied ${PBS.toAm(q.product)}`), `the price tile says est., and the plain product beside it (${bt[1]})`);
  chk(bt[2].startsWith(PBS.money(PBS.cents(20 * q.dec))) && /profit, est\./.test(bt[2]) && bt[3].includes('on the fair chance, est.'), `what it pays and the confidence, est. (${bt[2]} | ${bt[3]})`);
  chk(notes.includes('Price est.: DraftKings prices same-game parlays its own way.') && /Player legs as read [^;]+; props model on trial\./.test(notes) && notes.length < 220, `the builder's notes are the money warnings alone, in a few words: the price an estimate, the player legs' read and the model on trial (${notes.slice(0, 260)})`);
  chk(txt($('slipText')).includes(`${PBS.toAm(q.dec)} est.`) || $('slip').hidden, `the slip bar marks the price est. (${txt($('slipText'))})`);
  const bTxt = txt($('builder'));
  chk(!/\bedge\b/i.test(bTxt) && !/model says/i.test(bTxt), `with a player leg nothing in the builder claims an edge or says "model says" (${(/[^.]*\bedge\b[^.]*|[^.]*model says[^.]*/i.exec(bTxt) || [''])[0].slice(0, 120)})`);
  /* the suggested levels: one leg a game, by brute force on the reads the page holds now (the press put G's player lines among them) */
  holdPanel(w, AT, 'with player legs in the builder'); holdSuggest(w, AT, 'with player legs in the builder');
  /* no thin edge beside a player leg: on a made-up copy where H's home moneyline is thin (its edge at or above 0 and under the site's bar),
     the builder marks it thin edge alone, and beside a player leg it marks it nothing, and nothing in the builder says edge */
  {
    const M3 = JSON.parse(JSON.stringify(M)), h3 = M3.games.find(g => g.id === H.id);
    h3.mlEdge = Object.assign({}, h3.mlEdge, { home: +(M3.edge / 2).toFixed(4) });
    const hLeg = store().legs.find(l => l.game === H.id && l.kind === 'ml' && l.side === 'home'), pLeg = store().legs.find(l => l.kind === 'prop');
    const real3 = S; S = M3;
    try {
      const rowH = dd => dd.querySelector(`#legs .leg[data-id="${H.id}|home|ml"]`);
      const e3 = [], w3 = await boot(AT, e3, { state: JSON.stringify(M3), hash: 'parlays', store: JSON.stringify({ legs: [hLeg] }) });
      const thinAlone = !!rowH(w3.document) && /thin edge/.test(txt(rowH(w3.document)));
      const e4 = [], w4 = await boot(AT, e4, { state: JSON.stringify(M3), hash: 'parlays', store: JSON.stringify({ legs: [pLeg, hLeg] }) }), r4 = rowH(w4.document), b4 = txt(w4.document.getElementById('builder'));
      chk(!!hLeg && !!pLeg && thinAlone && !!r4 && !r4.querySelector('.pill.thin') && !/\bedge\b/i.test(b4) && !/model says/i.test(b4),
        `a thin team leg (edge ${h3.mlEdge.home}) is marked thin edge on its own, and beside a player leg it is marked nothing, no edge said anywhere in the builder (alone: ${rowH(w3.document) ? txt(rowH(w3.document)).slice(0, 120) : 'no row'}; beside: ${r4 ? txt(r4).slice(0, 120) : 'no row'})`);
      chk(!e3.length && !e4.length, 'no runtime error with a thin team leg beside a player leg: ' + e3.concat(e4).join(' | '));
    } finally { S = real3; }
  }
  /* the card: each player leg with its price and read time, to add by hand; the betslip link the team legs' ids alone; est. */
  $('pFinish').click();
  const view = txt($('pcView')), note = txt($('pcNote')), cardLegs = JSON.parse(w.eval('JSON.stringify(PC.legs.map(L => ({ id: L.id, prop: !!L.prop, who: L.who, bet: L.bet, price: L.price, at: L.at || null, kind: L.kind, side: L.side, game: L.game })))'));
  chk(!$('pcWin').hidden && cardLegs.length === n, 'Finish parlay opens the card on every leg');
  chk(cardLegs.filter(L => L.prop).every(L => view.includes(L.who) && view.includes(L.bet) && view.includes(PBS.odds(L.price)) && view.includes(`DraftKings, read ${etClockS(L.at)}`)) && txt(d.querySelector('.pc-price')).endsWith('est.') && view.includes(why), `the card lists each player leg with its price and read time, its price est. with the why (${view.slice(0, 200)})`);
  chk(cardLegs.map((L, i) => [L, i + 1]).filter(([L]) => L.prop).every(([L, k]) => note.includes(`Leg ${k}, ${L.who} ${L.bet}: DraftKings' player lines carry no betslip id in ESPN's feed: add this leg by hand.`)), `the note lists every player leg to add by hand (${note.slice(0, 300)})`);
  const key = L => L.kind === 'ou' ? L.side : L.side + (L.kind === 'ml' ? 'ML' : 'PL');
  const ids = cardLegs.filter(L => !L.prop).map(L => { const g = S.games.find(x => x.id === L.game), dk = g.line.dk || {}, id = dk[key(L)]; return typeof id === 'string' && dkNamesLine(key(L), id, g.line) ? id : null; }).filter(Boolean);
  chk($('pcDk').href === (ids.length ? 'https://sportsbook.draftkings.com/?outcomes=' + ids.map(encodeURIComponent).join('+') : 'https://sportsbook.draftkings.com/leagues/hockey/nhl'), `the betslip link opens the legs with ids, the team legs alone (${$('pcDk').href})`);
  chk(note.includes("Price est.: the slip will show DraftKings' own same-game price."), 'the note says the slip shows DraftKings\' own same-game price');
  const shared = [];
  Object.defineProperty(w.navigator, 'share', { value: async x => { shared.push(x); }, configurable: true });
  Object.defineProperty(w.navigator, 'canShare', { value: () => true, configurable: true });
  $('pcLink').click(); await wait(20);
  const sent = shared[0] || { text: '' }, lines = sent.text.split('\n');
  chk(sent.title === `${n}-leg parlay ${PBS.toAm(q.dec)} (estimated price)` && cardLegs.every((L, i) => lines[i] === `${i + 1}. ${L.who}: ${L.bet} (${PBS.odds(L.price)}${L.prop ? `, DraftKings as read ${etClockS(L.at)}` : ''})`)
    && lines.includes(`Stake ${PBS.money(20)} · Pays ${PBS.money(PBS.cents(20 * q.dec))} (est.)`) && lines.includes(`Estimated price: ${why}; the legs' prices multiplied would be ${PBS.toAm(q.product)}.`)
    && cardLegs.map((L, i) => [L, i + 1]).filter(([L]) => L.prop).every(([L, k]) => lines.includes(`${k}. ${L.who} ${L.bet} (DraftKings' player lines carry no betslip id in ESPN's feed)`)) && !/model says|\bedge\b/i.test(sent.text),
    `the Share text: the title est., every leg with its price (a player leg's read time), the pays est., the why, each player leg to add by hand, no edge (${JSON.stringify(sent.text).slice(0, 500)})`);
  const rec = [];
  w.HTMLCanvasElement.prototype.getContext = function () { const self = this; return new Proxy({}, { get(t, k) { if (k === 'canvas') return self; if (k === 'measureText') return s2 => ({ width: String(s2).length * 7 }); if (k in t) return t[k]; return (...a) => { rec.push([k, a]); }; }, set(t, k, v) { t[k] = v; return true; } }); };
  w.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new w.Blob(['png'], { type: 'image/png' })); };
  w.URL.createObjectURL = () => 'blob:card'; w.URL.revokeObjectURL = () => {};
  const click0 = w.HTMLAnchorElement.prototype.click; w.HTMLAnchorElement.prototype.click = function () {};
  $('pcDown').click(); await wait(50); w.HTMLAnchorElement.prototype.click = click0;
  const drawn = rec.filter(r => r[0] === 'fillText').map(r => String(r[1][0])).join(' | ');
  chk(drawn.includes('est.') && drawn.includes('an estimate of DraftKings\' same-game price') && cardLegs.filter(L => L.prop).every(L => drawn.includes(L.who) && drawn.includes(`read ${etClockS(L.at)}`)), `the image marks the price est. and dates each player leg (${drawn.slice(0, 200)})`);
  d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  /* saved: the estimate kept with the legs */
  $('saveParlay').click();
  const sv = (store().saved || [])[0] || {};
  chk(sv.est === true && Math.abs(sv.dec - q.dec) < 1e-12 && Math.abs(sv.product - q.product) < 1e-12 && sv.legs.length === n && /est\./.test(txt(d.querySelector('#savedList .saved .top'))), `a saved same-game parlay keeps its estimated price and says est. (${txt(d.querySelector('#savedList .saved .top'))})`);
  /* nothing of the read stored: nhl_v1 alone written, and in it the legs added (no read, no line, no price the visitor did not add) */
  const st = store(), allowed = ['game', 'kind', 'pid', 'name', 'team', 'grp', 'stat', 'mk', 'side', 'line', 'k', 'odds', 'other', 'at', 'p', 'fair', 'label', 'text', 'date', 'start'];
  chk([...new Set(w.__writes)].every(k => k === 'nhl_v1') && !/"main":\[|"yes":\[|PROPS|propBets|"items"/.test(JSON.stringify(st)) && st.legs.filter(l => l.kind === 'prop').every(l => Object.keys(l).every(k => allowed.includes(k))), `nothing from the props read is stored but the legs added (${Object.keys(st).join(', ')}; ${st.legs.filter(l => l.kind === 'prop').length} player legs)`);
  const stored = w.localStorage.getItem('nhl_v1');
  /* a reload: the legs at their read prices, dated by the read, the price as before */
  {
    const eR = [], wR = await boot(AT + 60000, eR, { state: JSON.stringify(M), hash: 'parlays', store: stored }), dR = wR.document;
    const qR = JSON.parse(wR.eval('JSON.stringify(quote(builderLegs(false)))'));
    const rr = [...dR.querySelectorAll('#legs .leg')].filter(r => r.dataset.id.includes('|p|'));
    chk(rr.length === st.legs.filter(l => l.kind === 'prop').length && rr.every(r => txt(r).includes(`DraftKings, as read ${clockOf(Date.parse(readAt))}`)) && Math.abs(qR.dec - q.dec) < 1e-12 && Math.abs(qR.fair - q.fair) < 1e-12 && !wR.eval('Object.keys(PROPS.games).length'),
      `a reload keeps the player legs at their read prices, dated by the read, with nothing read (${rr.length} rows; ${qR.dec} vs ${q.dec})`);
    /* the levels worked out from nothing on a page that opens with player legs in the builder (the open page's levels are cached on
       the picks, the slate and the reads, so only a fresh page computes them with the player legs there): every level by brute
       force, team bets alone, one leg a game, and exactly the levels the page drew before any player leg */
    const tiersR = tiers(wR);
    chk(tiersR === tiers0, `a reload with player legs in the builder works out the same levels as before the press, the page holding no read of player lines (${tiersR === tiers0 ? 'the same' : tiersR.slice(0, 160)})`);
    holdPanel(wR, AT + 60000, 'a reload with player legs in the builder'); holdSuggest(wR, AT + 60000, 'a reload with player legs in the builder');
    chk(!eR.length, 'no runtime error on the reload: ' + eR.join(' | '));
  }
  /* a later press: Y's 3+ re-priced, X's points line moved, Z's saves line pulled; each said once, nothing stored */
  const A2 = JSON.parse(JSON.stringify(A.items)), T2 = AT + 2 * 60000;
  for (const it of A2) {
    if (!it || !it.athlete) continue;
    const id = (/\/athletes\/(\d+)/.exec(it.athlete.$ref) || [])[1], ty = it.type && it.type.name;
    if (id === String(Y.id) && ty === 'Shots on Goal Milestones' && it.current && it.current.target && it.current.target.value === 3) it.odds.american.value = '+410';
    if (id === String(X.id) && ty === 'Total Points') { it.odds.total.value = String(xm[2] + 1); if (it.current && it.current.target) it.current.target.value = xm[2] + 1; }
    if (id === String(X.id) && ty === 'Points Milestones' && it.current && it.current.target && it.current.target.value === xm[2] + 1.5) it.odds.american.value = (xm[3] > 0 ? '+' : '') + xm[3];      // its ladder agrees with the moved line's Over
  }
  const A3 = Z ? A2.filter(it => !(it && it.athlete && it.type && it.type.name === 'Total Saves' && it.athlete.$ref.includes(`/athletes/${Z.id}?`))) : A2;
  propsNow = url => { const m = PROPS_RX.exec(url); return m && m[1] === G.id ? { ok: true, status: 200, json: async () => ({ pageCount: 1, items: JSON.parse(JSON.stringify(A3)) }) } : PROPS_404(url); };
  w.__setClock(T2);
  const wr2 = w.__writes.length;
  $('pbRefreshOdds').click(); await oddsDone(w); await wait(20);
  const at2 = w.eval(`PROPS.games[${JSON.stringify(G.id)}].at`), bm = txt($('bMsg')), ids2 = [...d.querySelectorAll('#legs .leg')].map(r => r.dataset.id);
  const yRow = d.querySelector(`#legs .leg[data-id="${G.id}|p|${Y.id}|s|k3"]`);
  chk(!!yRow && txt(yRow).includes('+410') && txt(yRow).includes(`DraftKings, as read ${clockOf(Date.parse(at2))}`) && bm.includes(`1 player price has changed since you added it: the builder shows DraftKings' price as read from ESPN at ${clockOf(Date.parse(at2))}.`), `a later read draws a re-priced player leg at its new price, dated, and says so (${yRow && txt(yRow)} | ${bm.slice(0, 200)})`);
  chk(!ids2.some(id => id.startsWith(`${G.id}|p|${X.id}|pts|`)) && bm.includes(`${X.name} Over ${xm[2]} points left the builder: DraftKings' points line on ${X.name} is now ${xm[2] + 1} (as read ${clockOf(Date.parse(at2))}).`), `a player leg whose line DraftKings has moved leaves the builder, said (${bm.slice(0, 300)})`);
  if (Z) chk(!ids2.some(id => id.startsWith(`${G.id}|p|${Z.id}|sv|`)) && bm.includes(`left the builder: DraftKings had no saves line on ${Z.name} when ESPN was read at ${clockOf(Date.parse(at2))}.`), `a player leg whose line DraftKings has pulled leaves the builder, said (${bm.slice(0, 300)})`);
  chk(w.__writes.length === wr2 && w.localStorage.getItem('nhl_v1') === stored, `the later read stores nothing: the legs stay as added (${w.__writes.length - wr2} writes)`);
  d.querySelector('#tabs button[data-tab="games"]').click(); d.querySelector('#tabs button[data-tab="parlays"]').click();
  chk(!txt($('bMsg')).includes('player price has changed') || txt($('bMsg')) === bm, 'what a read changed is said once, not at every draw');
  chk(JSON.stringify(store().legs) === JSON.stringify(JSON.parse(stored).legs), 'a save after the read (the tabs) keeps the legs as they were added');
  /* the puck drop: every leg of G leaves the builder, said once */
  w.__setClock(Date.parse(G.start) + 60000); d.dispatchEvent(new w.Event('visibilitychange'));
  const left = store().legs;
  const hLeft = Date.parse(H.start) > Date.parse(G.start) + 60000 ? 1 : 0;
  chk(!left.some(l => l.game === G.id) && left.length === hLeft && (txt($('bMsg')).match(new RegExp(`${mu.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} left the builder: the puck dropped\\.`, 'g')) || []).length === 1, `at the puck drop every leg of ${G.id}, the player legs with them, leaves the builder, said once (${txt($('bMsg')).slice(0, 160)})`);
  chk(!errs.length, 'no runtime error through the player legs: ' + errs.join(' | '));
  holdRequests(w, 'the player legs');
}
/* saved parlays' player legs graded from planted box scores, by this smoke's own rule: Over or Under the line (a whole line can push), a
   Yes k+ at k or more, a player not on the ice void, a goalie who came on in relief void on his saves (the prop stands on the
   starter alone, pulled or not), a goalie of a side whose starter the box cannot tell graded nowhere ("who started is not
   certain", the parlay not graded here unless another leg lost); a final not boxed yet waits, one older than the box scores
   carried cannot be graded here; a same-game parlay pays its estimated price, or on the legs left priced again by the rule */
async function gradingChecks(C) {
  const M = JSON.parse(STATE); M.sgp = { rho: C.rho, hold: C.hold, measured: C.measured || null };
  const fins = M.games.filter(g => g.state === 'final' && g.hs !== null && g.hs !== g.as).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1);
  const F = fins[fins.length - 1], F2 = fins.find(g => g.date < (F || {}).date), F3 = fins.find(g => g !== F && g.date === (F || {}).date);
  if (!F || !F2) { console.log('  fewer than two finals on two days: the grading of player legs is skipped'); return; }
  const real = S; S = M;
  try {
    const A = '7000001', B = '7000002', Gk = '7000003', D = '7000004', R = '7000005', U = '7000006', U2 = '7000007';   // A and B skaters of F's home club, Gk the away starter, R the home club's goalie who came on in relief, D dressed for nobody, U and U2 two goalies of a side whose starter the box cannot tell
    M.box = { from: F.date, days: 14, games: { [F.id]: { s: { [A]: [2, 1, 4, 1], [B]: [0, 0, 1, 3] }, g: { [Gk]: 30 }, r: [R], u: [U, U2] } } };
    const pl = (pid, team, grp, stat, mk, side, line, k, odds, other) => ({ game: F.id, kind: 'prop', pid, name: `Player ${pid.slice(-1)}`, team, grp, stat, mk, side, line, k, odds, other, at: new Date(PUB - 86400000).toISOString(), p: 0.5, fair: 0.5, label: `${F.away} @ ${F.home}`, text: '', date: F.date, start: F.start });
    const won = F.hs > F.as ? 'home' : 'away';
    const L = {
      aPts: pl(A, F.home, 'F', 'pts', 'main', 'over', 2.5, null, 150, -190),          // 3 points: won
      gSv: pl(Gk, F.away, 'G', 'sv', 'main', 'over', 25.5, null, -115, -105),         // 30 saves: won
      bS: pl(B, F.home, 'D', 's', 'main', 'over', 1.5, null, 120, -150),              // 1 shot: lost
      aG2: pl(A, F.home, 'F', 'g', 'yes', 'over', 1.5, 2, 650, null),                 // 2 goals, 2+: won
      aS4: pl(A, F.home, 'F', 's', 'main', 'over', 4, null, 105, -135),               // 4 shots on a whole line: a push
      aSh: pl(A, F.home, 'F', 's', 'main', 'over', 2.5, null, 110, -140),             // 4 shots over 2.5: won (with his points, legs that move together)
      bBs: pl(B, F.home, 'D', 'bs', 'main', 'under', 3.5, null, -160, 125),           // 3 blocks under 3.5: won
      dPts: pl(D, F.home, 'F', 'pts', 'main', 'over', 0.5, null, -140, 110),          // not on the ice: void
      rSv: pl(R, F.home, 'G', 'sv', 'main', 'over', 5.5, null, -115, -105),           // came on in relief: void, did not start (his saves never graded)
      uSv: pl(U, F.away, 'G', 'sv', 'main', 'under', 24.5, null, -115, -105),         // who started is not certain: graded nowhere (401803043's case)
      u2Sv: pl(U2, F.away, 'G', 'sv', 'main', 'over', 21.5, null, -110, -110),        // the other goalie of that side: the same
      f3: Object.assign(pl(A, F3 ? F3.home : F.home, 'F', 's', 'main', 'over', 1.5, null, -120, -110), { game: F3 ? F3.id : F.id }),      // F3 not boxed yet: waits
      f2: Object.assign(pl(A, F2.home, 'F', 's', 'main', 'over', 1.5, null, -120, -110), { game: F2.id, date: F2.date }),                 // F2 before the window: past it
      ml: { game: F.id, side: won, kind: 'ml', odds: -130, line: null, p: 0.55, fair: 0.54, label: `${F.away} @ ${F.home}`, text: '', date: F.date, start: F.start },
    };
    const sp = (id, legs, extra) => Object.assign({ id, at: new Date(PUB - 86400000).toISOString(), stake: 10, legs, am: '+500', dec: 6, p: 0.2, imp: 0.17, fair: 0.18 }, extra || {});
    const saved = [sp('w1', [L.aPts, L.gSv, L.ml], { est: true, dec: 4.4, product: 6.1 }), sp('l1', [L.bS, L.aG2]), sp('p1', [L.aS4, L.bBs]), sp('v1', [L.dPts, L.aG2]), sp('v2', [L.dPts]), sp('v3', [L.aPts, L.aSh, L.dPts], { est: true, dec: 3.9 }), sp('r1', [L.rSv, L.gSv]), sp('r2', [L.rSv]), sp('u1', [L.uSv]), sp('u2', [L.u2Sv, L.bS]), sp('u3', [L.uSv, L.aPts])]
      .concat(F3 ? [sp('q1', [L.f3])] : []).concat([sp('o1', [L.f2])]);
    /* this smoke's own grading of a planted leg */
    const box = M.box.games[F.id], xOf = l => l.stat === 'sv' ? box.g[l.pid] : box.s[l.pid] && (l.stat === 'pts' ? box.s[l.pid][0] + box.s[l.pid][1] : box.s[l.pid][{ g: 0, a: 1, s: 2, bs: 3 }[l.stat]]);
    const whyS = l => l.stat === 'sv' && box.r.includes(l.pid) ? 'did not start' : 'did not play';
    const gradeS = l => { if (l.game !== F.id) return l.game === F2.id ? 'unboxed' : 'pending'; if (l.kind !== 'prop') return l.side === won ? 'win' : 'loss'; if (l.stat === 'sv' && box.u.includes(l.pid)) return 'unsure'; const x = xOf(l); if (x === undefined) return 'void'; return l.mk === 'yes' ? (x >= l.k ? 'win' : 'loss') : x > l.line ? (l.side === 'over' ? 'win' : 'loss') : x < l.line ? (l.side === 'under' ? 'win' : 'loss') : 'push'; };
    const decS = ls => { const by = {}; for (const l of ls) by[l.game] = (by[l.game] || 0) + 1; const prod = ls.reduce((a, l) => a * PBS.decOf(l.odds), 1); if (!Object.values(by).some(n => n > 1)) return prod; return SG.parlay(M.sgp, ls.map(l => sgOf(M, l))).dec; };
    const want = s => { const gl = s.legs.map(gradeS); const st = gl.includes('loss') ? 'loss' : gl.some(x => x === 'unboxed' || x === 'unsure') ? 'gone' : gl.includes('pending') ? 'pending' : gl.every(x => x === 'push' || x === 'void') ? 'push' : 'win';
      const wonL = s.legs.filter((l, i) => gl[i] === 'win'); return { st, gl, pays: st === 'win' ? PBS.cents(s.stake * (s.est && wonL.length === s.legs.length ? s.dec : decS(wonL))) : null }; };
    const errs = [], w = await boot(PUB + 60000, errs, { state: JSON.stringify(M), store: JSON.stringify({ saved, ui: { tab: 'parlays' } }), hash: 'parlays' }), d = w.document;
    const cardOfS = id => [...d.querySelectorAll('#savedList .saved')].find(x => x.querySelector(`[data-del="${id}"]`));
    const words = { win: 'won', loss: 'lost', push: 'push', pending: 'pending', void: 'void', unboxed: 'box score no longer carried', unsure: 'who started is not certain' };
    const tagOf = { win: 'won', loss: 'lost', push: 'push: stake back', pending: 'pending', gone: "can't be graded here" };
    const stS = () => JSON.parse(w.localStorage.getItem('nhl_v1')).saved;
    for (const s of saved) {
      const c = cardOfS(s.id), ex = want(s), top = c ? txt(c.querySelector('.top')) : '', lis = c ? [...c.querySelectorAll('.pb-slegs li .pill')].map(txt) : [];
      chk(!!c && top.includes(tagOf[ex.st] + (ex.st === 'win' ? ` · ${PBS.money(ex.pays)}` : '')), `${s.id}: graded ${ex.st}${ex.st === 'win' ? ' paying ' + PBS.money(ex.pays) : ''} (${top})`);
      chk(lis.length === s.legs.length && s.legs.every((l, i) => { const gl = ex.gl[i], x = l.kind === 'prop' && l.game === F.id ? xOf(l) : undefined; return gl === 'void' ? lis[i] === `void: ${whyS(l)}` : /^(win|loss|push)$/.test(gl) && l.kind === 'prop' ? lis[i] === `${words[gl]} (${x})` : lis[i] === words[gl]; }), `${s.id}: each leg graded as DraftKings settles it, its count beside it (${lis.join(' | ')})`);
      const kept = stS().find(x => x.id === s.id);
      chk(kept && kept.legs.every((l, i) => l.kind !== 'prop' || !/^(win|loss|push|void)$/.test(ex.gl[i]) ? !l.res : l.res && l.res.grade === ex.gl[i] && (ex.gl[i] === 'void' ? l.res.x === null && l.res.why === whyS(l) : l.res.x === xOf(l))), `${s.id}: each settled player leg's grade is written into the saved leg (${canon(kept && kept.legs.map(l => l.res || null)).slice(0, 200)})`);
    }
    console.log(`  ${saved.length} saved parlays graded on planted box scores of ${F.id} (${saved.map(s2 => s2.id + ' ' + want(s2).st).join(', ')})`);
    /* the next publish carries no box score for F (past the window, or a publish without them): the grades written stand */
    const M2 = JSON.parse(JSON.stringify(M)); M2.box = { from: F.date, days: 14, games: {} };
    const e2 = [], w2 = await boot(PUB + 60000, e2, { state: JSON.stringify(M2), store: w.localStorage.getItem('nhl_v1'), hash: 'parlays' }), d2 = w2.document;
    const keptOk = saved.filter(s => want(s).st !== 'pending' && want(s).st !== 'gone').every(s => { const c = [...d2.querySelectorAll('#savedList .saved')].find(x => x.querySelector(`[data-del="${s.id}"]`)); return c && txt(c.querySelector('.top')).includes(tagOf[want(s).st]); });
    chk(keptOk, 'a settled grade holds on a publish no longer carrying its box score');
    chk(!errs.length && !e2.length, 'no runtime error grading player legs: ' + errs.concat(e2).join(' | '));
  } finally { S = real; }
}

/* ---------- THE LOOK (nhl v12): the NBA Hub's components, every one held to the state with this smoke's own code ----------
   No image anywhere (the page's source names none and a walk of every tab, day, drawer and window finds none); the club colours
   (TEAM_COLORS) on every club, each at its contrast bar on every surface and in a hue of its own; every game
   card's badges, pick, chances, confidence pill, chips, tags, who is out, Lineups drawer and foot worked out here from the state, and
   its bets in its Player props window (nhl v23, the NBA's Tonight card); the tab
   counts; Parlay Builder → on a card; every pill and table head; the Record's tiles; the 44px controls */
const pctS = p => (p * 100).toFixed(0) + '%';
const oddsS = n => n === null || n === undefined ? '—' : n > 0 ? '+' + n : String(n);
const lineS = n => n === 0 ? 'PK' : n > 0 ? '+' + n : String(n);
const ab = id => S.teams[id] ? S.teams[id].abbr : id;
const sh = id => S.teams[id] ? S.teams[id].short : id;
const okPrice = v => v !== null && v !== undefined && isFinite(v) && v !== 0;
const styleVar = (el, k) => { const m = new RegExp(`${k}:\\s*([^;]+)`).exec((el && el.getAttribute('style')) || ''); return m ? m[1].trim() : null; };
/* a goals figure as the card and the drawer write it: two places, its sign from the rounded value (never -0.00) */
const v2S = x => { const r = Math.round(x * 100) / 100; return { t: `${r > 0 ? '+' : ''}${(r === 0 ? 0 : r).toFixed(2)}`, c: r > 0 ? 'pos' : r < 0 ? 'neg' : '' }; };
const eqA = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* WCAG contrast and CIELAB, written here on their own */
const hexRgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const linC = c => c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
const lumH = h => { const [r, g, b] = hexRgb(h).map(linC); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const crH = (a, b) => { const x = lumH(a), y = lumH(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
function labH(h) {
  const [r, g, b] = hexRgb(h).map(linC), f = t => t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
  const X = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047, Y = r * 0.2126 + g * 0.7152 + b * 0.0722, Z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
/* a club's tag (nhl v25, the NFL hub's filled tag), worked out here on this file's own WCAG sums (crH), never the page's code: the fill is
   the club's first colour, darkened 8% at a time (ten times at most) until white or the hub's dark ink reads on it at 4.5:1; the text is
   whichever of the two reads better on the fill; the border is the fill at 72%. A colour is compared whatever its letters' case */
const TAG_INK_S = '#1E2230';
const darkS = (h, f) => '#' + [1, 3, 5].map(i => Math.round(parseInt(h.slice(i, i + 2), 16) * f).toString(16).padStart(2, '0')).join('');
const tagFillS = h => { let c = h; for (let i = 0; i < 10 && Math.max(crH(c, '#FFFFFF'), crH(c, TAG_INK_S)) < 4.5; i++) c = darkS(c, 0.92); return c; };
const tagOfS = pal => { const bg = tagFillS(pal[0]); return { bg, fg: crH(bg, '#FFFFFF') >= crH(bg, TAG_INK_S) ? '#FFFFFF' : TAG_INK_S, bd: darkS(bg, 0.72) }; };
const sameHex = (a, b) => typeof a === 'string' && typeof b === 'string' && a.trim().toUpperCase() === b.trim().toUpperCase();
/* what is wrong with a tag drawn for a club (its palette pal): nothing where the three colours its style attribute writes (background,
   color, border-color) are the club's by the sums above */
const styleMap = el => Object.fromEntries(String((el && el.getAttribute('style')) || '').split(';').map(x => x.split(':').map(y => y.trim())).filter(x => x.length === 2 && x[0]));
const tagWrong = (el, pal) => { const t = tagOfS(pal), m = styleMap(el), got = [m.background, m.color, m['border-color']];
  return sameHex(got[0], t.bg) && sameHex(got[1], t.fg) && sameHex(got[2], t.bd) ? '' : `${got.join('/')} not ${t.bg}/${t.fg}/${t.bd}`; };
/* CIEDE2000 (Sharma, Wu and Dalal 2005), on labH above: how far apart two colours look */
function de2000S(h1, h2) {
  const [L1, a1, b1] = labH(h1), [L2, a2, b2] = labH(h2), rad = Math.PI / 180, deg = 180 / Math.PI;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2, G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = (1 + G) * a1, a2p = (1 + G) * a2, C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hp = (a, b) => { if (a === 0 && b === 0) return 0; const h = Math.atan2(b, a) * deg; return h < 0 ? h + 360 : h; };
  const h1p = hp(a1p, b1), h2p = hp(a2p, b2), dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0; if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp / 2 * rad), Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p; if (C1p * C2p !== 0) hbp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p < 360 ? (h1p + h2p + 360) / 2 : (h1p + h2p - 360) / 2) : (h1p + h2p) / 2;
  const T = 1 - 0.17 * Math.cos((hbp - 30) * rad) + 0.24 * Math.cos(2 * hbp * rad) + 0.32 * Math.cos((3 * hbp + 6) * rad) - 0.20 * Math.cos((4 * hbp - 63) * rad);
  const dTh = 30 * Math.exp(-(((hbp - 275) / 25) ** 2)), RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + 0.015 * (Lbp - 50) ** 2 / Math.sqrt(20 + (Lbp - 50) ** 2), SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T, RT = -Math.sin(2 * dTh * rad) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}
/* the clubs that share a colour, as the NBA's Bulls and Raptors do: their brands' reds, navies, golds and oranges. Any two clubs outside
   one of these are 5 or more apart (a difference anyone sees); nhl v12 had Dallas and Minnesota 0.7 apart and Utah and the Islanders 2.8 */
const COLOR_FAMILIES = [['CGY', 'CAR', 'CHI', 'DET', 'FLA', 'MTL', 'NJ', 'OTT', 'WSH'], ['BUF', 'CBJ', 'NYI', 'NYR', 'STL', 'TB', 'TOR', 'VAN', 'WPG'], ['BOS', 'NSH', 'PIT'], ['EDM', 'PHI']];
const pageMap = w => JSON.parse(w.eval('JSON.stringify(TEAM_COLORS)'));
/* the page's CSS rules (in any media query) whose `prop` reads as `re`, as [selector, the media it is under or '']; read once a window */
const RULES = new WeakMap();
function cssWith(w, prop, re) {
  if (!RULES.has(w)) { const all = []; const walk = (rules, media) => { for (const r of rules || []) { if (r.cssRules && !r.selectorText) walk(r.cssRules, r.media ? String(r.media.mediaText || '') : media); else if (r.style && r.selectorText) all.push([r.selectorText, media, r.style]); } }; for (const sh of w.document.styleSheets) walk(sh.cssRules, ''); RULES.set(w, all); }
  return RULES.get(w).filter(([, , st]) => re.test(String(st.getPropertyValue(prop)).trim())).map(([sel, media]) => [sel, media]);
}
/* an element matched by a selector list, a selector the DOM cannot parse taken a part at a time */
const hitsSel = (el, sel) => { try { return el.matches(sel); } catch (e) { return sel.split(',').some(x => { try { return el.matches(x); } catch (e2) { return false; } }); } };

/* a bet button's every part, worked out here (nhl v13): one line, the side, DraftKings' price and the model's chance, "PIT +170 · 34%",
   a check before the side in the parlay; the model's call a tag on its top edge with its edge ("call · edge +8"); a side far off the
   market a tag ("far off", or "call · far off") and, under the line, both numbers (the call's "left out of the levels") */
const isFarS = B => B.fair !== null && B.p - B.fair >= 0.15;
const betWant = (B, s, on) => {
  const far = isFarS(B), call = B.pick === s;
  const side = B.kind === 'ml' ? ab(B.g[s]) : B.kind === 'pl' ? `${ab(B.g[s])} ${lineS(B.num)}` : (s === 'over' ? 'Over' : 'Under');
  return { side: (on ? '✓' : '') + side, price: PBS.odds(B.price), chance: `· ${PBS.pctW(B.p)}`,
    tag: call && far ? 'call · far off' : call ? `call · edge +${Math.round(B.edge * 100)}` : far ? 'far off' : null,
    far: far ? `model ${PBS.pctW(B.p)} · market ${PBS.pctW(B.fair)}${call ? ' · left out of the levels' : ''}` : null,
    kids: ['pb-bs', 'pb-bn'].concat(call || far ? ['pb-bt tg' + (far ? ' far' : '')] : [], far ? ['pb-bt far'] : []) };
};
const betHave = btn => { const tg = btn.querySelector(':scope > .pb-bt.tg'), fl = btn.querySelector(':scope > .pb-bt.far:not(.tg)'), bn = btn.querySelector(':scope > .pb-bn');
  return { side: txt(btn.querySelector(':scope > .pb-bs')), price: txt(bn && bn.querySelector(':scope > .pb-bp')), chance: txt(bn && bn.querySelector(':scope > .pb-bc')), tag: tg ? txt(tg) : null, far: fl ? txt(fl) : null,
    kids: [...btn.children].map(x => x.className) }; };
/* its name for a screen reader, which carries the call, its edge and the far-off numbers too */
const betAria = (B, s, on) => { const far = isFarS(B), call = B.pick === s, sh2 = sh(B.g[s]);
  const desc = B.kind === 'ml' ? `${sh2} to win` : B.kind === 'pl' ? `${sh2} ${lineS(B.num)}` : `${s === 'over' ? 'Over' : 'Under'} ${B.num}`;
  return `${desc}, ${PBS.odds(B.price)}, model ${PBS.pctW(B.p)}${call && !far ? `, the model's call, edge +${Math.round(B.edge * 100)}` : ''}${far ? `${call ? ", the model's call" : ''}, far off the market: model ${PBS.pctW(B.p)}, market ${PBS.pctW(B.fair)}` : ''}${on ? ', in your parlay' : ''}`; };
/* every piece of a bet button that cannot wrap fits the narrowest button the page draws (nhl v13). jsdom lays nothing out, so the pieces
   are counted against widths measured in Chromium with the page's Manrope: at 320px a card's bet button is 94px wide, 76 inside, and its
   tag, one line on its top edge 6px in, has 86 of it: "call · edge +99", 15 characters, is 84px. Under the line the far-off numbers wrap
   between words, each number whole: "market 100%", 11 characters, is 69px at 11px. "far off the market" as a tag (18, 101px) and "left
   out of the levels" kept whole (22, 108px) ran out of their buttons at 320 and 360, on the cards and in Pick your own legs. The side
   and the price and chance are the data's (a club's three letters and a line, a price and a chance) and are held whole by the rules */
const BET_FIT = { tag: 15, run: 11 };
const betRuns = (w, el, up) => { if ([el].concat(up || []).some(x => w.getComputedStyle(x).whiteSpace === 'nowrap')) return [el.textContent];
  const out = []; for (const n of el.childNodes) { if (n.nodeType === 3) out.push(...n.textContent.split(/\s+/).filter(Boolean)); else if (n.nodeType === 1) out.push(...betRuns(w, n)); } return out; };
const betFit = btn => { const w = btn.ownerDocument.defaultView, tg = btn.querySelector(':scope > .pb-bt.tg'), fl = btn.querySelector(':scope > .pb-bt.far:not(.tg)'), bad = [];
  if (tg && txt(tg).length > BET_FIT.tag) bad.push(`its tag "${txt(tg)}" is ${txt(tg).length} characters, wider than the ${BET_FIT.tag} the narrowest button has room for`);
  if (fl) for (const r of betRuns(w, fl, [btn])) if (r.trim().length > BET_FIT.run) bad.push(`"${r.trim()}" under its line cannot wrap and is ${r.trim().length} characters, wider than the ${BET_FIT.run} the narrowest button has room for`);
  return bad.join('; '); };
/* what is wrong with one button, '' when nothing is */
const betWrong = (btn, B, s) => { const on = btn.getAttribute('aria-pressed') === 'true', want = betWant(B, s, on), have = betHave(btn);
  if (!eqA(have, want)) return `${btn.dataset.leg}: ${JSON.stringify(have)} where ${JSON.stringify(want)}`;
  const fit = betFit(btn); if (fit) return `${btn.dataset.leg}: ${fit}`;
  if (btn.getAttribute('aria-label') !== betAria(B, s, on)) return `${btn.dataset.leg}: named "${btn.getAttribute('aria-label')}" where "${betAria(B, s, on)}"`;
  return ''; };
/* ---------- THE GAMES LIST (nhl v28) ----------
   The Games tab as the NFL hub's list, worked out here from the state by this section's own rules, on any state the job can publish:
   the Day select (every game day from the season's first to ten days out, by month, today where it has no game; today and its first
   week before the season opens; every game day once it is over), its words, the day it opens on and its two steppers; the day's and
   the season's record of the call; Refresh scores and its stamp; Refresh odds exactly on a day from today on with a game to come; the
   six heads; and every row, cell by cell (rowWrongs): the date on the visitor's clock, the two tags in their colours with the pick's
   raised and "vs" on neutral ice, a tick or a cross on the winner's tag alone once final, the two chances as whole percentages that
   add to 100 on a bar in the clubs' colours (two clubs of one brand colour: the home half its other colour, else the track), the
   band of the larger by 65, 60 and 55 with its percentage, the predicted score to a tenth with its leader and "by" the difference
   of the two shown, and where the game stands; the rows not final first, then Completed. No bet, price or edge is on a row */
const SL_TIERS_S = [[65, 'high', 'HIGH'], [60, 'med', 'MED'], [55, 'low', 'LOW'], [0, 'coin', '50/50']];
const hslS = h => { const [r, g, b] = hexRgb(h), mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn; const hh = !dl ? 0 : mx === r ? ((g - b) / dl + 6) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4; return [hh * 60, dl, (mx + mn) / 2]; };
/* two colours that read as one: two greys of like lightness, or hues within 28 degrees and lightness within .18 (the NFL hub's test) */
const nearS = (x, y) => { const [h1, c1, l1] = hslS(x), [h2, c2, l2] = hslS(y), dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2)); return c1 < 0.15 || c2 < 0.15 ? c1 < 0.15 && c2 < 0.15 && Math.abs(l1 - l2) < 0.15 : dh < 28 && Math.abs(l1 - l2) < 0.18; };
const FAM_S = {}; COLOR_FAMILIES.forEach((f, i) => f.forEach(k => { FAM_S[k] = i; }));
/* a bar's two halves: each club's own tag fill and its text; two clubs of one brand colour (or one fill), the home half the first of the
   home club's other colours that is a colour and does not read as the away's, else the track */
function barColsS(MAP, a, h) {
  const ta = tagOfS(MAP[a]), th = tagOfS(MAP[h]); let bg = th.bg, ink = th.fg;
  if (sameHex(ta.bg, th.bg) || (FAM_S[a] !== undefined && FAM_S[a] === FAM_S[h])) {
    const alt = MAP[h].slice(1).map(tagFillS).find(c => hslS(c)[1] >= 0.15 && !nearS(ta.bg, c));
    if (alt) { bg = alt; ink = crH(alt, '#FFFFFF') >= crH(alt, TAG_INK_S) ? '#FFFFFF' : TAG_INK_S; } else { bg = 'var(--panel-3)'; ink = 'var(--ink)'; }
  }
  return [{ bg: ta.bg, ink: ta.fg }, { bg, ink }];
}
/* where a game stands: a read this browser made (lv) over the state's own score; a live score the job read says when; null with none */
/* the call as it is written, by this section's own rule: the pick's own chance rounded to a whole percentage, the other side the rest;
   null where the state has no call for the game. The chance is taken to four places first, so a half-point rounds up on either side
   (1 - 0.455 is 0.54499999... in floating point: an away pick at 0.455 is 55%, as a home pick at 0.545 is) */
function slCallS(g) {
  if (!Number.isFinite(g.pHome)) return null;
  const side = g.pick === 'home' || g.pick === 'away' ? g.pick : (g.pHome >= 0.5 ? 'home' : 'away'), conf = Math.round(Math.round((side === 'home' ? g.pHome : 1 - g.pHome) * 1e4) / 100);
  return { side, pick: g[side], conf, ph: side === 'home' ? conf : 100 - conf, pa: side === 'away' ? conf : 100 - conf };
}
/* each band's record this season: the call straight up on every graded game, banded by its chance as written */
const SL_SAY_S = { high: '65% or more', med: '60 to 64%', low: '55 to 59%', coin: 'under 55%' };
function slRecS() { const t = { high: [0, 0], med: [0, 0], low: [0, 0], coin: [0, 0] }; for (const g of S.games) { const c = isO(g.result) && typeof g.result.su === 'boolean' ? slCallS(g) : null; if (c) t[SL_TIERS_S.find(x => c.conf >= x[0])[1]][g.result.su ? 0 : 1]++; } return t; }
function slOutS(g, lv) {
  const ok = Number.isFinite;
  if (lv && lv.state === 'off') return null;                /* called off at ESPN (a read made here): no score, never a final */
  if (lv && lv.state !== 'pre' && ok(lv.hs) && ok(lv.as)) return { final: lv.state === 'final', live: lv.state === 'live', as: lv.as, hs: lv.hs, clock: lv.detail || '' };
  if (g.state === 'final' && ok(g.hs) && ok(g.as)) return { final: true, live: false, as: g.as, hs: g.hs, clock: g.detail || 'Final' };
  if (g.state === 'live' && ok(g.hs) && ok(g.as)) return { final: false, live: true, as: g.as, hs: g.hs, clock: `${g.detail || ''} · as of ${clockOf(Date.parse(g.scoreAt || S.published))}` };
  return null;
}
const slMovedS = (g, ms) => g.state === 'pre' && Date.parse(g.start) > ms && sStarted(g, ms);
const slFinalS = (g, lv, ms) => { if (lv && lv.state === 'off') return false; const o = slOutS(g, lv); return o ? o.final : g.state === 'final' || (sStarted(g, ms) && !slMovedS(g, ms) && ms >= Date.parse(g.start) + 4 * 3600000); };
const slPickS = g => g[g.pick === 'home' || g.pick === 'away' ? g.pick : (g.pHome >= 0.5 ? 'home' : 'away')];
/* the call graded on a row: the job's grade, else the same rule on a final read here; null where neither */
const slHitS = (g, o) => g.result && typeof g.result.su === 'boolean' ? g.result.su : !o || !o.final || o.as === o.hs || !slCallS(g) ? null : slCallS(g).pick === (o.as > o.hs ? g.away : g.home);
/* one row against the state: what is wrong, [] when nothing is */
function rowWrongs(w, c, g, ms, MAP, lv) {
  const bad = [], ck = (ok, m) => { if (!ok) bad.push(m); }, sm = el => styleMap(el);
  const o = slOutS(g, lv || null), fin = slFinalS(g, lv || null, ms), started = sStarted(g, ms) || !!o, A = ab(g.away), H = ab(g.home);
  ck(c.tagName === 'BUTTON' && c.getAttribute('type') === 'button' && !c.disabled && c.dataset.game === g.id && c.getAttribute('aria-haspopup') === 'dialog' && c.className === `game${fin ? ' final' : started ? ' locked' : ''}`, `the row is a button that opens its game's page, classed by where the game stands (${c.className})`);
  const cells = [...c.children];
  ck(cells.length === 6 && eqA(cells.map(x => x.className.split(' ')[0]), ['when', 'matchup', 'sl-probrow', 'sl-conf', 'sl-pred', 'sl-result']), `six cells: the date, the matchup, the win probability, the confidence, the prediction, the score (${cells.map(x => x.className).join(', ')})`);
  if (cells.length !== 6) return bad;
  const day = gpDayS(g.start);
  ck(txt(cells[0].querySelector('b')) === day && txt(cells[0]) === day + clockOf(Date.parse(g.start)) && (cells[0].getAttribute('title') || '') === (g.note || ''), `the date and the puck drop on the visitor's clock, the game's note on its title (${txt(cells[0])})`);
  const CW = slCallS(g), pick = CW ? CW.pick : null, pa = CW ? CW.pa : null, ph = CW ? CW.ph : null, conf = CW ? CW.conf : null;
  const tags = [...cells[1].querySelectorAll('.ttag')], at = cells[1].querySelector('.at');
  ck(tags.length === 2 && txt(tags[0]) === A && txt(tags[1]) === H && !tagWrong(tags[0], MAP[g.away]) && !tagWrong(tags[1], MAP[g.home]) && tags[0].classList.contains('sl-win') === (pick === g.away) && tags[1].classList.contains('sl-win') === (pick === g.home), `the two clubs' tags in their colours, the pick's alone raised (${txt(cells[1])})`);
  ck(!!at && txt(at) === (g.neutral ? 'vs' : 'at') && at.classList.contains('neutral') === !!g.neutral && (at.getAttribute('title') || '') === (g.neutral ? 'Neutral site' : ''), `"${g.neutral ? 'vs' : 'at'}" between them, vs exactly on neutral ice`);
  const win = o && o.final && o.as !== o.hs ? (o.as > o.hs ? g.away : g.home) : null, hit = win ? slHitS(g, o) : null, marks = [...cells[1].querySelectorAll('.sl-res')];
  ck(marks.length === (win && hit !== null ? 1 : 0) && (!marks.length || (marks[0].parentElement.classList.contains(win === g.away ? 'sl-away' : 'sl-home') && txt(marks[0]) === (hit ? '✓' : '✗') && marks[0].classList.contains(hit ? 'sl-ok' : 'sl-bad') && marks[0].title === (hit ? 'Pick hit' : 'Pick missed'))), `a tick or a cross on the winner's tag alone, once final (${marks.map(txt).join('')})`);
  const pr = cells[2], a = pr.querySelector('.sl-a'), h = pr.querySelector('.sl-h'), labs = [...pr.querySelectorAll('.sl-tlab')], cols = barColsS(MAP, g.away, g.home);
  if (!CW) ck(pr.getAttribute('aria-label') === `${A} at ${H}: no call yet` && !a && !h && !!pr.querySelector('.sl-prob') && !pr.querySelector('.sl-prob').children.length && !/\d/.test(txt(pr)) && eqA(labs.map(txt), [A, H]) && !labs.some(l => l.classList.contains('sl-win')), `a game the state has no call for draws an empty bar and no number (${pr.getAttribute('aria-label')}: ${txt(pr)})`);
  else ck(pr.getAttribute('aria-label') === `${A} ${pa}%, ${H} ${ph}%` && pa + ph === 100 && !!a && !!h && sm(a).width === `${pa}%` && sm(h).width === `${ph}%` && txt(a) === (pa >= 14 ? pa + '%' : '') && txt(h) === (ph >= 14 ? ph + '%' : ''), `the model's two chances, whole percentages that add to 100, each half as wide as its chance and printed from 14% up (${pr.getAttribute('aria-label')}: ${txt(a)} | ${txt(h)})`);
  if (CW) ck(!!a && !!h && !!a.querySelector('.sl-w') === (pick === g.away) && !!h.querySelector('.sl-w') === (pick === g.home) && eqA(labs.map(txt), [A, H]) && labs[0].classList.contains('sl-win') === (pick === g.away) && labs[1].classList.contains('sl-win') === (pick === g.home), 'the pick\'s label and percentage bold, the other quiet');
  const colOk = (el, want) => !!el && (/^var\(/.test(want.bg) ? sm(el).background === want.bg && sm(el).color === want.ink : sameHex(sm(el).background, want.bg) && sameHex(sm(el).color, want.ink));
  if (CW) ck(colOk(a, cols[0]) && colOk(h, cols[1]), `the bar's halves in the clubs' colours, the home half its other colour or the track where the two share one (${a && sm(a).background}/${h && sm(h).background}; want ${cols[0].bg}/${cols[1].bg})`);
  const tier = CW ? SL_TIERS_S.find(x => conf >= x[0]) : null, tp = cells[3].querySelector('.sl-tier');
  /* the band's record this season on the pill's title, by this section's own count (nhl v23 had it on the card's pill) */
  const recW = tier ? slRecS()[tier[1]] : null, titleW = tier ? `${tier[2]}: the model gives its pick ${SL_SAY_S[tier[1]]}.${recW[0] + recW[1] ? ` Its ${tier[2]} picks this season: ${recW[0]}–${recW[1]}.` : ''}` : '';
  if (!CW) ck(!!tp && tp.className === 'sl-tier' && txt(tp) === 'no call yet' && !tp.getAttribute('title'), `with no call the pill says so (${tp ? `${tp.className} ${txt(tp)}` : 'none'})`);
  else ck(!!tp && (tp.getAttribute('title') || '') === titleW, `the pill's title says what the band is and its record this season ("${titleW}": "${tp ? tp.getAttribute('title') : ''}")`);
  if (CW) ck(!!tp && tp.className === `sl-tier sl-${tier[1]}` && txt(tp) === `${tier[2]} ${conf}%`, `the confidence: the band of the larger chance shown, by 65, 60 and 55, and that percentage (${tier[2]} ${conf}%: ${tp ? `${tp.className} ${txt(tp)}` : 'none'})`);
  const XG = Number.isFinite(g.xt) && Number.isFinite(g.mu), xa = +Math.max(0.3, (g.xt - g.mu) / 2).toFixed(1), xh = +Math.max(0.3, (g.xt + g.mu) / 2).toFixed(1), dd = Math.round(Math.abs(xa - xh) * 10) / 10, psc = cells[4].querySelector('.sl-psc'), pby = cells[4].querySelector('.sl-pby'), lead = xa > xh ? g.away : g.home;
  if (!XG) ck(txt(cells[4]) === 'Predicted–' && !pby && !cells[4].querySelector('.ttag') && !/NaN/.test(txt(c)), `with no goals layer for the game the prediction is a dash, never a number (${txt(cells[4])})`);
  else ck(txt(cells[4].querySelector('.sl-plab')) === 'Predicted' && !!psc && txt(psc) === `${xa.toFixed(1)}–${xh.toFixed(1)}` && psc.title === `${A} ${xa.toFixed(1)}, ${H} ${xh.toFixed(1)}: the model's expected goals`, `the predicted score: the goals layer's two rates to a tenth, away first, whose numbers they are on its title (${psc && txt(psc)})`);
  if (XG) ck(!!pby && (dd === 0 ? txt(pby) === 'even' && !pby.querySelector('.ttag') : txt(pby) === `${ab(lead)} by ${dd.toFixed(1)}` && !!pby.querySelector('.ttag.sl-mini') && !tagWrong(pby.querySelector('.ttag'), MAP[lead])), `its leader and "by" the difference of the two numbers shown, "even" where level (${pby && txt(pby)})`);
  let want;
  if (lv && lv.state === 'off') want = [lv.off === 'cancelled' ? 'Cancelled' : 'Postponed', 'at ESPN', 'sl-mwin sl-tie'];      /* ESPN's word, not a score */
  else if (!o) want = slMovedS(g, ms) ? ['0 : 0', 'start moved · call kept', 'sl-sc sl-pend'] : fin ? ['Final', null, 'sl-sc sl-pend'] : sStarted(g, ms) ? ['LIVE', null, 'sl-sc sl-pend'] : ['0 : 0', null, 'sl-sc sl-pend'];
  else {
    const score = `${o.as}–${o.hs}`, up = o.as > o.hs ? g.away : o.hs > o.as ? g.home : null;
    if (o.live) want = [up ? `${ab(up)} leading ${score}` : `Tied ${score}`, o.clock, `sl-mwin sl-${!up || !CW ? 'tie' : pick === up ? 'ok' : 'bad'}`];
    else { const h2 = slHitS(g, o), ot = /SO/.test(o.clock) ? ' · SO' : /OT/.test(o.clock) ? ' · OT' : ''; want = [up ? `${ab(up)} won ${score}` : `Tied ${score}`, `${h2 === null ? '' : h2 ? 'Pick hit' : 'Pick missed'}${ot}`, `sl-mwin sl-${h2 === null ? 'tie' : h2 ? 'ok' : 'bad'}`]; }
  }
  const main = cells[5].firstElementChild, sub = cells[5].querySelector('.sl-sub');
  /* the words and the score are two whole parts, each its own element, so the cell can put the score under the words and never cut either */
  if (main && /sl-mwin/.test(want[2])) { const parts = [...main.children], loose = [...main.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim());
    ck(!loose.length && parts.every(p => p.tagName === 'SPAN') && (lv && lv.state === 'off' ? parts.length === 1 : parts.length === 2 && /^\d+–\d+$/.test(txt(parts[1])) && !/\d/.test(txt(parts[0]))), `the words and the score are two whole parts (${parts.map(txt).join(' | ')})`); }
  ck(!!main && txt(main) === want[0] && main.className === want[2] && (want[1] === null ? !sub : !!sub && txt(sub) === want[1]), `where the game stands ("${want[0]}"${want[1] === null ? '' : ` / "${want[1]}"`}, ${want[2]}: "${main ? txt(main) : ''}" / "${sub ? txt(sub) : ''}", ${main ? main.className : ''})`);
  if (sub && o && o.final) ck((sub.getAttribute('title') || '') === (g.result && !g.frozen ? "the call is the replay's: this game was over before the job first ran" : ''), 'a call that is the replay\'s says so on the sub-line\'s title');
  ck(!c.querySelector('button, a, input, img, .chip, .pb-bets, .conf, [data-leg], [data-pp]') && !/[+-]\d{3}\b|\bedge\b|Value|\bmodel\b/i.test(txt(c)), "no bet, price, edge, chip or control on a row: they are on the game's page");
  return bad;
}
/* the days the select should list at a clock, and the day it should open on */
const slAdd = (dd, n) => { const x = new Date(dd + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
function slDaysS(ms) {
  const today = etDate(ms), all = [...new Set(S.games.map(g => g.date))].sort(); if (!all.length) return [today];
  if (all[0] > today) return [today].concat(all.filter(dd => dd <= slAdd(all[0], 6)));
  if (all[all.length - 1] < today) return all;
  return [...new Set(all.filter(dd => dd <= slAdd(today, 10)).concat([today]))].sort();
}
function slOpenS(ms) { const today = etDate(ms), days = slDaysS(ms), has = dd => S.games.some(g => g.date === dd); return days.includes(today) && (has(today) || !has(slAdd(today, 1))) ? today : (days.find(dd => dd >= today && has(dd)) || days.slice().reverse().find(has) || days[0]); }
const slWordS = (dd, today) => dd === today ? 'Today' : dd === slAdd(today, 1) ? 'Tomorrow' : dd === slAdd(today, -1) ? 'Yesterday' : null;
const slMdS = dd => new Date(dd + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const slOptS = (dd, today) => slWordS(dd, today) ? `${slWordS(dd, today)}, ${slMdS(dd)}` : new Date(dd + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
/* what the list says of a day with no game: the countdown before the season opens, that the schedule is not out, else that the day has none */
function slEmptyS(day, ms) {
  const today = etDate(ms), all = S.games.map(g => g.date).sort();
  if (!all.length) return `The ${S.season - 1}-${String(S.season).slice(2)} schedule is not out yet`;
  if (all[0] > today && day < all[0]) { const n = Math.round((Date.parse(all[0] + 'T12:00:00Z') - Date.parse(today + 'T12:00:00Z')) / 86400000); return `${n}day${n === 1 ? '' : 's'} to opening night`; }
  return 'No games scheduled for this day.';
}
/* the days the smoke walks: yesterday to ten days out (the days the strip had), the season's first day and one past day mid-way */
function heldDays(d, ms) { const all = dayList(d), today = etDate(ms), past = all.filter(dd => dd < slAdd(today, -1)); return [...new Set(all.filter(dd => dd >= slAdd(today, -1)).concat(all.slice(0, 1), past.length ? [past[Math.floor(past.length / 2)]] : []))].sort(); }
/* the list on the day shown: the bar, the heads, the rows in order with Completed between, the pills, Refresh odds. lv: reads planted by game id */
function listWrongs(w, day, ms, MAP, lv = {}) {
  const d = w.document, bad = [], ck = (ok, m) => { if (!ok) bad.push(m); }, today = etDate(ms), $ = id => d.getElementById(id);
  const gs = S.games.filter(g => g.date === day).sort((a, b) => (Date.parse(a.start) - Date.parse(b.start)) || sStr(`${ab(a.away)} @ ${ab(a.home)}`, `${ab(b.away)} @ ${ab(b.home)}`));
  ck($('daySel').value === day, `the select shows ${day} (${$('daySel').value})`);
  const i = dayList(d).indexOf(day);
  ck($('dayPrev').disabled === (i <= 0) && $('dayNext').disabled === (i >= dayList(d).length - 1), 'a stepper is off exactly at its end of the days');
  const live = gs.filter(g => !slFinalS(g, lv[g.id], ms)), fin = gs.filter(g => slFinalS(g, lv[g.id], ms)), kids = [...$('gamesList').children];
  const wantK = live.map(g => g.id).concat(fin.length ? ['Completed'] : [], fin.map(g => g.id)), haveK = kids.map(k => k.classList.contains('slatesep') ? txt(k) : k.dataset.game || k.className);
  if (!gs.length) ck(kids.length === 1 && kids[0].classList.contains('empty') && txt($('gamesList')) === slEmptyS(day, ms), `${day}: a day with no game says so, and only that ("${slEmptyS(day, ms)}": "${txt($('gamesList'))}")`);
  else ck(eqA(haveK, wantK), `${day}: a row a game, those still to play first in puck-drop order, then Completed and the finals (${haveK.join(',').slice(0, 160)}; want ${wantK.join(',').slice(0, 160)})`);
  let n = 0;
  for (const g of gs) { const c = kids.find(k => k.dataset.game === g.id); if (!c) continue; n++; for (const m of rowWrongs(w, c, g, ms, MAP, lv[g.id])) bad.push(`${g.id} ${ab(g.away)} @ ${ab(g.home)}: ${m}`); }
  let hit = 0, miss = 0; for (const g of gs) { const r = slHitS(g, slOutS(g, lv[g.id] || null)); if (r === true) hit++; else if (r === false) miss++; }
  const su = (S.record && S.record.su) || { w: 0, l: 0 }, T1 = "The model's pick to win, frozen at puck drop and graded straight up";
  ck(txt($('dayRec')) === `${slWordS(day, today) || slMdS(day)} ${hit}–${miss}` && txt($('dayRec').querySelector('b')) === `${hit}–${miss}` && $('dayRec').title === T1, `the day's pill counts the call as its rows show it (${slWordS(day, today) || slMdS(day)} ${hit}–${miss}: ${txt($('dayRec'))})`);
  ck(txt($('seasonRec')) === `Season ${su.w}–${su.l}` && $('seasonRec').title === T1, `the season's pill is the state's straight-up record (${txt($('seasonRec'))})`);
  ck($('slateOdds').hidden === !(day >= today && gs.some(g => !sStarted(g, ms))) && !!$('slateOdds').querySelector('#refreshOdds[data-odds]') && !!$('slateOdds').querySelector('#oddsNote[role="status"]'), `Refresh odds exactly on a day from today on with a game still to come (${day}: ${$('slateOdds').hidden ? 'hidden' : 'shown'})`);
  ck(!$('slateNow').hidden && !$('slateNow').disabled && txt($('slateNow')) === 'Refresh scores', 'Refresh scores is always there, its word unchanged');
  bad.rows = n;
  return bad;
}
async function gamesListChecks() {
  console.log('THE GAMES LIST');
  const AT = PUB + 60000, errs = [], show = process.env.NHL_SMOKE_ALL ? 40 : 4, real = S;
  let sb = async () => ({ ok: true, json: async () => ({ events: [] }) });
  const w = await boot(AT, errs, { espn: url => sb(url) }), d = w.document, MAP = pageMap(w), $ = id => d.getElementById(id), today = etDate(AT);
  const sbReqs = () => w.__requests.filter(r => r.url.startsWith('https://site.api.espn.com/'));
  /* the tab: the bar, the note, the odds bar, the heads, the list; no strip, no card grid, no key */
  const sv = $('slateView'), kidsV = sv ? [...sv.children].map(x => x.id || x.className) : [];
  chk(eqA(kidsV, ['bar', 'sourceNote', 'slateOdds', 'gamehead', 'gamesList']) && !d.querySelector('#days, #games, .grid, .day, .teams, .badge, .prob, .pline, .chips, #opening:not(.empty), #refreshScores, #confKey'), `the Games tab is the bar, the source note, the odds bar, the column heads and the list; no day strip, no card grid (${kidsV.join(', ')})`);
  const barK = [...sv.querySelector('.bar').children].map(x => x.id || (x.querySelector('select') ? 'label:' + x.querySelector('select').id : x.className));
  chk(eqA(barK, ['label:daySel', 'day-step', 'dayRec', 'seasonRec', 'grow', 'slateStamp', 'slateNow']) && txt(sv.querySelector('.bar label')).startsWith('Day') && $('dayPrev').getAttribute('aria-label') === 'Previous day' && $('dayNext').getAttribute('aria-label') === 'Next day' && $('slateStamp').getAttribute('role') === 'status', `the bar: the Day select and its two steppers, the day's and the season's record, Refresh scores and its stamp (${barK.join(', ')})`);
  chk(eqA([...sv.querySelectorAll('.gamehead > div')].map(txt), ['Date', 'Matchup', 'Win probability', 'Confidence', 'Score prediction', 'Final score']), 'six column heads');
  /* the select: its days, by month, their words, the day it opens on */
  const wantD = slDaysS(AT), opts = [...$('daySel').querySelectorAll('option')], groups = [...$('daySel').querySelectorAll('optgroup')];
  chk(eqA(opts.map(o => o.value), wantD) && eqA(opts.map(txt), wantD.map(dd => slOptS(dd, today))), `the select lists every game day from the season's first to ten days out (and today), each by its words: Today, Tomorrow, Yesterday, else its weekday and date (${opts.length} days, ${wantD.length} wanted; ${opts.slice(-3).map(txt).join(' | ')})`);
  const monthOf = dd => new Date(dd + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  chk(eqA(groups.map(g => g.label), [...new Set(wantD.map(monthOf))]) && groups.every(g => [...g.querySelectorAll('option')].every(o => monthOf(o.value) === g.label)), `its days grouped by month (${groups.map(g => g.label).join(', ')})`);
  chk($('daySel').value === slOpenS(AT), `it opens on today where today has games or tomorrow has none, else the next day with games, else the last (${slOpenS(AT)}: ${$('daySel').value})`);
  const tOpt = opts.find(o => /^Today, /.test(txt(o)));
  chk(!tOpt || tOpt.value === today, `"Today" in the select is the visitor's day (${today})`);
  chk(JSON.parse(w.eval('JSON.stringify(BAR_FAMILIES)')) && canon(JSON.parse(w.eval('JSON.stringify(BAR_FAMILIES)'))) === canon(COLOR_FAMILIES), "the page's colour families for a win bar are this smoke's own list");
  { const keys = Object.keys(S.teams).filter(k => MAP[k]), off = [], low = [], one = [];
    for (const a of keys) for (const h of keys) { if (a === h) continue; const want = barColsS(MAP, a, h), got = JSON.parse(w.eval(`JSON.stringify(slateCols(${JSON.stringify(a)}, ${JSON.stringify(h)}))`));
      if (!got || got.length !== 2 || [0, 1].some(i => (/^var\(/.test(want[i].bg) ? got[i].bg !== want[i].bg || got[i].ink !== want[i].ink : !sameHex(got[i].bg, want[i].bg) || !sameHex(got[i].ink, want[i].ink)))) off.push(`${a} at ${h}`);
      for (const x of want) if (!/^var\(/.test(x.bg) && crH(x.bg, x.ink) < 4.5) low.push(`${a} at ${h} ${x.bg}/${x.ink}`);
      if (!/^var\(/.test(want[1].bg) && (sameHex(want[0].bg, want[1].bg) || (FAM_S[a] !== undefined && FAM_S[a] === FAM_S[h] && nearS(want[0].bg, want[1].bg)))) one.push(`${a} at ${h} ${want[0].bg}/${want[1].bg}`); }
    chk(keys.length === 32 && !off.length, `every pair of clubs: the win bar's halves are this section's rule (each club's fill; two of one brand colour, the home half its other colour or the track) (${keys.length * (keys.length - 1)} pairs; ${off.length} off: ${off.slice(0, 5).join(', ')})`);
    chk(!low.length && !one.length, `each half's percentage reads 4.5:1 on its fill, and two clubs of one brand colour never share the bar's colour (${low.slice(0, 3).join('; ')} ${one.slice(0, 3).join('; ')})`); }
  /* every row of the held days */
  const wr0 = w.__writes.length, held = dayList(d); let rows = 0; const bad = [];
  for (const day of held) { openDay(d, day); const b = listWrongs(w, day, AT, MAP); rows += b.rows || 0; for (const m of b) bad.push(`${day}: ${m}`); }
  chk(!bad.length, `every row of every day in the select is the state's, cell by cell, the rows in order, the pills and the odds bar with them (${held.length} days, ${rows} rows; ${bad.length} wrong: ${bad.slice(0, show).join(' | ')})`);
  chk(w.__writes.length === wr0, `choosing a day writes nothing: the day is this page's memory alone (${w.__writes.length - wr0} writes)`);
  console.log(`  ${rows} rows held on the select's ${held.length} days (${held[0]} to ${held[held.length - 1]})`);
  /* the steppers: one listed day back and forth, the keyboard left on the control used; at an end the stepper is off and hands it to the select */
  if (wantD.length > 1) {
    const mid = wantD[Math.min(1, wantD.length - 1)]; openDay(d, mid);
    $('dayNext').focus(); const before = $('daySel').value, iB = wantD.indexOf(before);
    if (iB < wantD.length - 1) { $('dayNext').click(); chk($('daySel').value === wantD[iB + 1] && (d.activeElement === $('dayNext') || ($('dayNext').disabled && d.activeElement === $('daySel'))), `› shows the next listed day (${$('daySel').value})`); $('dayPrev').focus(); $('dayPrev').click(); chk($('daySel').value === before, '‹ the one before'); }
    openDay(d, wantD[1]); $('dayPrev').focus(); $('dayPrev').click();
    chk($('daySel').value === wantD[0] && $('dayPrev').disabled && d.activeElement === $('daySel'), `at the first day ‹ is off and the keyboard goes to the select (${$('daySel').value}, ${d.activeElement && d.activeElement.id})`);
    openDay(d, wantD[wantD.length - 1]);
    chk($('dayNext').disabled && !$('dayPrev').disabled, 'at the last day › is off');
    const junk = $('daySel').value; $('daySel').value = ''; $('daySel').dispatchEvent(new w.Event('change', { bubbles: true }));
    chk($('daySel').value === junk, 'a value that is no listed day changes nothing');
  }
  /* the one read of a day shown (the review's L3 and L7): every day of the select has now been chosen once. A day with a game under way that
     the state has no final for was read once, no-store; a day without was never read; choosing it or opening the tab again reads nothing
     more; and the read the page makes itself says when beside Refresh scores, in the visitor's clock with its zone, as a press does */
  const zone = clockOf(AT).split(' ').pop(), stampOk = t => /^scores \d{1,2}:\d\d:\d\d/.test(t) && t.endsWith(' ' + zone);
  /* the page's clock runs on from AT through this walk: a day under way at AT was read once; a day with nothing under way by the page's
     clock now was never read; a day whose first game dropped the puck in between (a state published a minute before a puck drop) may
     have been read once or not at all, as its row was drawn before or after */
  { const NOWP = w.Date.now(), underAt = (dd, ms) => S.games.some(g => g.date === dd && g.state !== 'final' && sStarted(g, ms)), urlOf = dd => `${SB_URL}?dates=${dd.replace(/-/g, '')}&limit=100`, readsOf = dd => sbReqs().filter(r => r.url === urlOf(dd));
    const dU = dayList(d).filter(dd => underAt(dd, AT)), dN = dayList(d).filter(dd => !underAt(dd, NOWP)), dM = dayList(d).filter(dd => !underAt(dd, AT) && underAt(dd, NOWP));
    const okRead = r => r.cache === 'no-store' && r.method === 'GET', badU = dU.filter(dd => readsOf(dd).length !== 1 || !okRead(readsOf(dd)[0])), badN = dN.filter(dd => readsOf(dd).length), badM = dM.filter(dd => readsOf(dd).length > 1 || !readsOf(dd).every(okRead));
    const nM = dM.reduce((n, dd) => n + readsOf(dd).length, 0);
    chk(!badU.length && !badN.length && !badM.length && sbReqs().length === dU.length + nM, `a day shown is read once where it has a game under way that the state has no final for, and never where it has none (${dU.length} days read of ${dayList(d).length}${dM.length ? `, ${dM.length} whose first puck dropped during the walk` : ''}; read wrongly: ${badU.concat(badM).join(', ') || 'none'}; read for nothing: ${badN.join(', ') || 'none'}; ${sbReqs().length} requests)`);
    if (dU.length) { const other = dayList(d).find(dd => dd !== dU[0] && !dM.includes(dd)); if (other) openDay(d, other); openDay(d, dU[0]); d.querySelector('#tabs button[data-tab="pickem"]').click(); d.querySelector('#tabs button[data-tab="games"]').click();
      chk(readsOf(dU[0]).length === 1 && sbReqs().length - dM.reduce((n, dd) => n + readsOf(dd).length, 0) === dU.length, `and not again when the day is chosen or the tab opened a second time (${readsOf(dU[0]).length})`); }
    else console.log('  no day of the select has a game under way at the publish: the one read is held on the page opened at a puck drop below');
    await wait(20);
    chk(dU.length ? stampOk(txt($('slateStamp'))) && !$('slateStamp').classList.contains('bad') : txt($('slateStamp')) === '', `the read the page makes itself says when beside Refresh scores, to the second with its zone; with none made the stamp is empty (${txt($('slateStamp')) || 'empty'}; zone ${zone})`);
  }
  /* Refresh scores and its stamp: reading while one runs (a second press asks nothing), when it was read, that it failed */
  {
    openDay(d, slOpenS(AT));
    let release = () => {}; const gate = new Promise(r => { release = r; }), n0 = sbReqs().length;
    sb = async () => { await gate; return { ok: true, json: async () => ({ events: [] }) }; };
    $('slateNow').click(); await wait(5);
    chk(txt($('slateStamp')) === 'reading…' && sbReqs().length === n0 + 1 && sbReqs().slice(-1)[0].cache === 'no-store' && new RegExp(`dates=${$('daySel').value.replace(/-/g, '')}&limit=100$`).test(sbReqs().slice(-1)[0].url), `a press reads the day's scoreboard once, no-store, and the stamp says reading (${txt($('slateStamp'))})`);
    $('slateNow').click(); await wait(5);
    chk(sbReqs().length === n0 + 1, 'a press while a read runs does nothing');
    release(); await wait(20);
    chk(stampOk(txt($('slateStamp'))) && !$('slateStamp').classList.contains('bad') && txt($('slateNow')) === 'Refresh scores', `after it the stamp says when the scores were read, to the second, in the visitor's clock with its zone (${txt($('slateStamp'))}; zone ${zone})`);
    sb = async () => ({ ok: false, status: 503, json: async () => ({}) });
    $('slateNow').click(); await wait(20);
    chk(txt($('slateStamp')) === 'scores not loading' && $('slateStamp').classList.contains('bad'), `a read that fails says so, in the warning ink (${txt($('slateStamp'))})`);
    sb = async () => ({ ok: true, json: async () => ({ events: [] }) });
    $('slateNow').click(); await wait(20);
    chk(stampOk(txt($('slateStamp'))) && !$('slateStamp').classList.contains('bad'), `and the next read that answers says when again (${txt($('slateStamp'))})`);
  }
  /* ---- where a game stands, planted in the page's memory and in this section's own copy alike ---- */
  S = JSON.parse(JSON.stringify(real));
  try {
    const both = (fn, arg) => { fn(S, arg); w.eval(`(${fn.toString()})(S, ${JSON.stringify(arg === undefined ? null : arg)})`); };
    const redraw = day => { d.querySelector('#tabs button[data-tab="pickem"]').click(); d.querySelector('#tabs button[data-tab="games"]').click(); openDay(d, day); };
    const row = g => cardOf(d, g.id), gBy = id => S.games.find(x => x.id === id);
    const hold = (g, at, lv, tag) => { redraw(g.date); const c = row(g), b = c ? rowWrongs(w, c, gBy(g.id), at, MAP, lv) : ['no row']; chk(!b.length, `${tag} (${b.slice(0, 3).join(' | ')}${c ? `: ${txt(c.querySelector('.sl-result'))}` : ''})`); return c; };
    const come = S.games.filter(g => dayList(d).includes(g.date) && !sStarted(g, AT)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)), G = come[0];
    /* a game ESPN has postponed or cancelled (the review's L1). ESPN's scoreboard gives such a game the state of a final and a score of
       0–0, and the job's own reading (tools/espn.js) takes it for a game gone. Read here by Refresh scores it is ESPN's word in the last
       cell, never "Tied 0–0": not a final, not among Completed, not in the day's record; and its page never says FINAL, to come or
       hours past its puck drop */
    { const offG = come.filter(g => g.date === come[0].date).slice(0, 2), v = d.getElementById('gameView');
      if (offG.length) {
        const ST = [{ name: 'STATUS_POSTPONED', state: 'post', description: 'Postponed', shortDetail: 'Postponed' }, { name: 'STATUS_CANCELED', state: 'post', description: 'Canceled', shortDetail: 'Canceled' }], words = ['postponed', 'cancelled'], Words = ['Postponed', 'Cancelled'];
        const evs = offG.map((g, i) => espnEvent(g, null, ST[i])), day0 = offG[0].date;
        chk(evs.every((ev, i) => E.gameRow(ev).gone === words[i] && ev.competitions[0].status.type.state === 'post'), "the planted events are games gone by the job's own reading, though ESPN's state for them is a final's");
        sb = async () => ({ ok: true, json: async () => ({ events: evs }) });
        openDay(d, day0); $('slateNow').click(); await wait(20);
        const lvMap = {}; offG.forEach((g, i) => { lvMap[g.id] = { state: 'off', off: words[i], at: w.eval(`(LIVE[${JSON.stringify(g.id)}] || {}).at`) || new Date(AT).toISOString() }; });
        const bL = listWrongs(w, day0, AT, MAP, lvMap), got = offG.map(g => row(g) ? `${row(g).className}: ${txt(row(g).querySelector('.sl-result'))}` : 'no row');
        chk(!bL.length && eqA(got, offG.map((g, i) => `game: ${Words[i]}at ESPN`)) && offG.every(g => !/Tied|Final|\d–\d/.test(txt(row(g).querySelector('.sl-result'))) && !row(g).querySelector('.sl-res')), `a game postponed or cancelled at ESPN says ESPN's word in its last cell, never a score, and stays out of Completed and of the day's record (${got.join(' | ')}; ${bL.slice(0, 3).join(' | ')})`);
        const b1 = gpWrongs(w, gBy(offG[0].id), AT, null, { lv: lvMap[offG[0].id], noPlayers: true });
        chk(!b1.length && pageOn(d, offG[0].id) && !/FINAL|actual/i.test(txt(v)) && /postponed at ESPN$/.test(txt(v.querySelector('.ghead .when'))) && /· postponed at ESPN, read .+\.$/.test(txt(d.getElementById('ppOddsNote'))) && !v.querySelector('.gp-live'), `its page, still to come by the clock, says postponed at ESPN on the head and in its status line, never FINAL (${txt(v.querySelector('.ghead .when'))} | ${txt(d.getElementById('ppOddsNote'))}; ${b1.slice(0, 3).join(' | ')})`);
        closeBets(d);
        const tO = Date.parse(offG[0].start) + 4 * 3600000 + 60000; w.__setClock(tO); d.dispatchEvent(new w.Event('visibilitychange'));
        if (openDay(d, day0)) {
          const bL2 = listWrongs(w, day0, tO, MAP, lvMap), r1 = row(offG[0]);
          chk(!bL2.length && !!r1 && r1.className === 'game locked' && txt(r1.querySelector('.sl-result')) === 'Postponedat ESPN', `four hours past its puck drop it is still postponed, never Final or among Completed (${r1 ? `${r1.className}: ${txt(r1.querySelector('.sl-result'))}` : 'no row'}; ${bL2.slice(0, 3).join(' | ')})`);
          const b2 = gpWrongs(w, gBy(offG[0].id), tO, null, { lv: lvMap[offG[0].id], noPlayers: true });
          chk(!b2.length && txt(v.querySelector('.gp-live b')) === 'Postponed at ESPN.' && txt(v.querySelector('.ghead .when .pill')) === 'POSTPONED' && !/FINAL/.test(txt(v)) && !v.querySelector('.finchip'), `and its page says Postponed at ESPN on the strip and the head, no FINAL and no LIVE on any row (${txt(v.querySelector('.gp-live'))}; ${b2.slice(0, 3).join(' | ')})`);
          closeBets(d);
        }
        w.__setClock(AT); d.dispatchEvent(new w.Event('visibilitychange'));
        /* scheduled again at ESPN: the word goes */
        sb = async () => ({ ok: true, json: async () => ({ events: offG.map(g => espnEvent(g, null)) }) });
        openDay(d, day0); $('slateNow').click(); await wait(20);
        chk(offG.every(g => !!row(g) && txt(row(g).querySelector('.sl-result')) === '0 : 0'), `a game ESPN has scheduled again at the next read loses the word (${offG.map(g => row(g) ? txt(row(g).querySelector('.sl-result')) : 'no row').join(' | ')})`);
        /* the score read itself: ESPN answers one of the two under way and the other a final in overtime; read by the page's own Refresh
           scores and held to the job's own reading of the same events (tools/espn.js): who leads and by what, away first, the clock under
           it; the final among Completed with who won, the pick's mark and OT; the day's pill; the stamp. Then the game's page and its own
           Refresh scores, which reads the day again: the strip and the head on the new score, its stamp with the zone, the list under it too */
        { const scored = (g, st, as, hs) => { const ev = espnEvent(g, null, st); for (const c of ev.competitions[0].competitors) c.score = String(c.homeAway === 'home' ? hs : as); return ev; };
          const LIVE_ST = { name: 'STATUS_IN_PROGRESS', state: 'in', description: 'In Progress', shortDetail: '8:12 - 2nd' }, FIN_ST = { name: 'STATUS_FINAL', state: 'post', description: 'Final', shortDetail: 'Final/OT' };
          const lvOf = ev => { const r = E.gameRow(ev); return { state: r.state, hs: r.hs, as: r.as, detail: r.detail || '' }; }, g1 = offG[0], g2 = offG[1] || null;
          const evs2 = [scored(g1, LIVE_ST, 2, 1)].concat(g2 ? [scored(g2, FIN_ST, 3, 4)] : []);
          sb = async () => ({ ok: true, json: async () => ({ events: evs2 }) });
          openDay(d, day0); $('slateNow').click(); await wait(20);
          const lv2 = {}; [g1, g2].filter(Boolean).forEach((g, i) => { lv2[g.id] = lvOf(evs2[i]); });
          const bS = listWrongs(w, day0, AT, MAP, lv2), r1 = row(g1), r2 = g2 ? row(g2) : null;
          chk(!bS.length && !!r1 && txt(r1.querySelector('.sl-mwin')) === `${ab(g1.away)} leading 2–1` && txt(r1.querySelector('.sl-sub')) === '8:12 - 2nd' && (!g2 || (!!r2 && r2.classList.contains('final') && txt(r2.querySelector('.sl-mwin')) === `${ab(g2.home)} won 3–4` && / · OT$/.test(txt(r2.querySelector('.sl-sub'))))) && stampOk(txt($('slateStamp'))),
            `a score read by Refresh scores is ESPN's, by the job's own reading of the answer: the away club leading 2–1 with its clock, the final in overtime among Completed with its winner, the day's pill and the stamp with them (${r1 ? txt(r1.querySelector('.sl-result')) : 'no row'} | ${r2 ? txt(r2.querySelector('.sl-result')) : ''}; ${bS.slice(0, 3).join(' | ')})`);
          const bP1 = gpWrongs(w, gBy(g1.id), AT, null, { lv: lv2[g1.id], noPlayers: true });
          const evs3 = [scored(g1, Object.assign({}, LIVE_ST, { shortDetail: '0:40 - 3rd' }), 2, 2)].concat(evs2.slice(1)); sb = async () => ({ ok: true, json: async () => ({ events: evs3 }) });
          const n0 = sbReqs().length, btn = d.getElementById('gameScoresNow'); if (btn) btn.click(); await wait(20);
          const bP2 = gpWrongs(w, gBy(g1.id), AT, null, { lv: lvOf(evs3[0]), noPlayers: true }), stp = v.querySelector('.gp-live .livestamp');
          chk(!bP1.length && !!btn && sbReqs().length === n0 + 1 && sbReqs().slice(-1)[0].url === `${SB_URL}?dates=${day0.replace(/-/g, '')}&limit=100` && sbReqs().slice(-1)[0].cache === 'no-store' && !bP2.length && txt(v.querySelector('.gp-live b')) === `${ab(g1.away)} 2, ${ab(g1.home)} 2 · 0:40 - 3rd.` && !!stp && /^read \d{1,2}:\d\d:\d\d/.test(txt(stp)) && txt(stp).endsWith(' ' + zone),
            `the game's page carries the score read, and its own Refresh scores reads the day once more: the strip and the head on the new score, when it was read with its zone (${txt(v.querySelector('.gp-live'))}; ${bP1.concat(bP2).slice(0, 3).join(' | ')})`);
          closeBets(d); openDay(d, day0);
          chk(!!row(g1) && txt(row(g1).querySelector('.sl-mwin')) === 'Tied 2–2' && row(g1).querySelector('.sl-mwin').classList.contains('sl-tie'), `and the list under the page follows that read (${row(g1) ? txt(row(g1).querySelector('.sl-result')) : 'no row'})`);
          for (const g of offG) w.eval(`delete LIVE[${JSON.stringify(g.id)}]`);
        }
        sb = async () => ({ ok: true, json: async () => ({ events: [] }) }); redraw(day0);
      } }
    if (G) {
      const pickHome = slPickS(G) === G.home, t1 = Date.parse(G.start) + 60000;
      openDay(d, G.date);
      /* the puck drops with the list shown: the watch draws the row again, locked, LIVE */
      const c0 = row(G); c0.focus();
      w.__setClock(t1); d.dispatchEvent(new w.Event('visibilitychange'));
      const c1 = row(G), b1 = c1 ? rowWrongs(w, c1, G, t1, MAP, null) : ['no row'];
      chk(!!c1 && c1 !== c0 && d.activeElement === c1, `the keyboard stays on its row through the watch's redraw (on ${d.activeElement && (d.activeElement.dataset.game || d.activeElement.tagName)})`);
      chk(!b1.length && c1.classList.contains('locked') && txt(c1.querySelector('.sl-result')) === 'LIVE', `a row whose puck drops is drawn again by the watch: locked, LIVE until a score is read (${b1.slice(0, 2).join(' | ')})`);
      const plant = lv => { w.eval(`LIVE[${JSON.stringify(G.id)}] = ${JSON.stringify(lv)}`); return lv; };
      let lv = plant({ state: 'live', hs: pickHome ? 2 : 0, as: pickHome ? 0 : 2, detail: '8:12 - 2nd' });
      const c2 = hold(G, t1, lv, 'a live score read here with the pick ahead: who leads and the score, away first, in the pick\'s ink, the clock under it');
      chk(!!c2 && c2.querySelector('.sl-mwin').classList.contains('sl-ok') && / leading /.test(txt(c2.querySelector('.sl-mwin'))), 'leading, lime');
      lv = plant({ state: 'live', hs: pickHome ? 0 : 3, as: pickHome ? 3 : 0, detail: 'End of 2nd' });
      const c3 = hold(G, t1, lv, 'the pick behind: the same words in the miss ink'); chk(!!c3 && c3.querySelector('.sl-mwin').classList.contains('sl-bad'), 'behind, rose');
      lv = plant({ state: 'live', hs: 1, as: 1, detail: '0:40 - 3rd' });
      const c4 = hold(G, t1, lv, 'level: Tied, in the quiet ink'); chk(!!c4 && txt(c4.querySelector('.sl-mwin')) === 'Tied 1–1' && c4.querySelector('.sl-mwin').classList.contains('sl-tie'), 'tied');
      for (const [det, word] of [['Final/OT', ' · OT'], ['Final/SO', ' · SO'], ['Final', '']]) {
        lv = plant({ state: 'final', hs: pickHome ? 3 : 2, as: pickHome ? 2 : 3, detail: det });
        const c5 = hold(G, t1, lv, `a final read here (${det}): who won, Pick hit${word}, the row among Completed with a tick on the winner's tag`);
        chk(!!c5 && c5.classList.contains('final') && txt(c5.querySelector('.sl-sub')) === `Pick hit${word}` && txt(c5.querySelector('.sl-res')) === '✓' && !!c5.previousElementSibling && (c5.previousElementSibling.classList.contains('slatesep') || c5.previousElementSibling.classList.contains('final')), `Pick hit${word}`);
      }
      lv = plant({ state: 'final', hs: pickHome ? 1 : 4, as: pickHome ? 4 : 1, detail: 'Final' });
      const c6 = hold(G, t1, lv, 'a final the pick lost: Pick missed in the miss ink, a cross on the winner\'s tag');
      chk(!!c6 && txt(c6.querySelector('.sl-res')) === '✗' && c6.querySelector('.sl-mwin').classList.contains('sl-bad'), 'missed');
      { const bL = listWrongs(w, G.date, t1, MAP, { [G.id]: lv }); chk(!bL.length, `the day's pill and the rows' order follow a final read here (${bL.slice(0, 3).join(' | ')}: ${txt($('dayRec'))})`); }
      w.eval(`delete LIVE[${JSON.stringify(G.id)}]`);
      /* four hours on with no score read: Final, among Completed */
      { const t3 = Date.parse(G.start) + 4 * 3600000 - 60000; w.__setClock(t3); const c6 = hold(G, t3, null, 'a minute short of four hours with no score read the row is still under way');
        chk(!!c6 && c6.className === 'game locked' && txt(c6.querySelector('.sl-result')) === 'LIVE', `not Final before four hours (${c6 ? `${c6.className}: ${txt(c6.querySelector('.sl-result'))}` : 'no row'})`); }
      const t4 = Date.parse(G.start) + 4 * 3600000 + 60000; w.__setClock(t4);
      const c7 = hold(G, t4, null, 'four hours past its puck drop with no score read the row says Final');
      chk(!!c7 && c7.classList.contains('final') && txt(c7.querySelector('.sl-result')) === 'Final', 'Final');
      w.__setClock(AT);
      /* a live score the job read: it says when; then a start moved after the first puck drop */
      both((St, id) => { Object.assign(St.games.find(x => x.id === id), { state: 'live', hs: 1, as: 2, detail: '5:00 - 1st', scoreAt: St.published.slice(0, 16) + 'Z' }); }, G.id);
      const c8 = hold(G, AT, null, 'a live score the job published says when it was read');
      chk(!!c8 && / · as of /.test(txt(c8.querySelector('.sl-sub'))), 'as of');
      both((St, a) => { const g = St.games.find(x => x.id === a.id); Object.assign(g, { state: 'pre', hs: null, as: null, detail: '', before: new Date(Date.parse(St.published) - 3600000).toISOString().slice(0, 16) + 'Z', frozen: g.frozen || new Date(Date.parse(St.published) - 7200000).toISOString().slice(0, 16) + 'Z' }); delete g.scoreAt; if (Date.parse(g.start) - Date.parse(g.before) >= 12 * 3600000) g.start = new Date(Date.parse(St.published) + 3 * 3600000).toISOString().slice(0, 16) + 'Z'; }, { id: G.id });
      if (delayedAt(gBy(G.id), gBy(G.id).start, AT) && !startedAt(gBy(G.id), AT) && gBy(G.id).date === G.date) { const c9 = hold(G, AT, null, 'a start the feed moved after the first puck drop keeps its call and says so, locked'); chk(!!c9 && c9.classList.contains('locked') && txt(c9.querySelector('.sl-sub')) === 'start moved · call kept', 'start moved'); }
    } else console.log('  no game to come on the listed days: the puck drop, the scores read here, a job-read score and a moved start are not planted');
    /* Refresh odds is for a day from today on: a game still to come on a past date (made up) does not bring the bar back */
    { const GZ = come[come.length - 1], yday = slAdd(today, -1);
      if (GZ && GZ.date > today) { const was = GZ.date; both((St, a) => { St.games.find(x => x.id === a.id).date = a.d; }, { id: GZ.id, d: yday });
        redraw(yday); if ($('daySel').value === yday) { const bZ = listWrongs(w, yday, AT, MAP), rZ = row(GZ); chk(!bZ.length && !!rZ && rZ.classList.contains('game') && !rZ.classList.contains('final') && $('slateOdds').hidden, `a game still to come on a past day does not bring Refresh odds back (${$('slateOdds').hidden ? 'hidden' : 'shown'}; ${bZ.slice(0, 2).join(' | ')})`); }
        both((St, a) => { St.games.find(x => x.id === a.id).date = a.d; }, { id: GZ.id, d: was }); redraw(today); } }
    /* a neutral game and a noted one */
    const GN = S.games.find(g => dayList(d).includes(g.date));
    if (GN) { both((St, id) => { Object.assign(St.games.find(x => x.id === id), { neutral: true, note: 'NHL Global Series' }); }, GN.id); const cN = hold(GN, AT, null, 'neutral ice reads vs, and the game\'s note is on the date\'s title'); chk(!!cN && txt(cN.querySelector('.at')) === 'vs' && cN.querySelector('.when').title === 'NHL Global Series', 'vs'); }
    if (GN) { for (const [p, side] of [[0.9, 'home'], [0.1, 'away']]) { both((St, a) => { Object.assign(St.games.find(x => x.id === a.id), { pHome: a.p, pick: a.side }); }, { id: GN.id, p, side });
        const cL = hold(GN, AT, null, `a lopsided game (${Math.round(p * 100)}% home): the short half of the bar prints no number, the long one its own, HIGH 90%`);
        chk(!!cL && txt(cL.querySelector(side === 'home' ? '.sl-a' : '.sl-h')) === '' && txt(cL.querySelector(side === 'home' ? '.sl-h' : '.sl-a')) === '90%' && txt(cL.querySelector('.sl-tier')) === 'HIGH 90%' && cL.querySelector('.sl-probrow').getAttribute('aria-label').replace(/[^0-9,]/g, '') === (side === 'home' ? '10,90' : '90,10'), `the 10% half is blank, its number on the row's label for a screen reader (${cL && cL.querySelector('.sl-probrow').getAttribute('aria-label')})`); } }
    /* one rounding everywhere (the review's L4): on a half-point the row and the game's page write the call the same way, the pick's own
       chance rounded and the other side the rest, and the band is the band of the chance as written (0.645 is HIGH 65%, on both). An
       away pick at 0.455 is 55% and LOW as the home pick at 0.545 is (the review of nhl v30: 1 - 0.455 is 0.54499999... in floating
       point, which rounded straight to a whole percentage wrote 54% and 50/50) */
    if (GN) for (const [p, side, cW, band] of [[0.695, 'home', 70, 'HIGH'], [0.645, 'home', 65, 'HIGH'], [0.305, 'away', 70, 'HIGH'], [0.355, 'away', 65, 'HIGH'], [0.545, 'home', 55, 'LOW'], [0.455, 'away', 55, 'LOW']]) {
      both((St, a) => { Object.assign(St.games.find(x => x.id === a.id), { pHome: a.p, pick: a.side }); }, { id: GN.id, p, side });
      const cR = hold(GN, AT, null, `a half-point (${p} home, the pick ${side}): the row by this section's rule`), A = ab(GN.away), H = ab(GN.home), labW = side === 'home' ? `${A} ${100 - cW}%, ${H} ${cW}%` : `${A} ${cW}%, ${H} ${100 - cW}%`;
      const bP = gpWrongs(w, gBy(GN.id), AT, null, { noPlayers: true }), v = d.getElementById('gameView'), small = v.querySelector('.ghead .winner small');
      const mk = ['away', 'home'].map(sd => { const tr = v.querySelector(`.gbets .statblk[data-gb="${sd}"] tr`); return tr ? txt(tr.querySelector('.mkt')) : ''; });
      chk(!!cR && txt(cR.querySelector('.sl-tier')) === `${band} ${cW}%` && cR.querySelector('.sl-probrow').getAttribute('aria-label') === labW && !bP.length && txt(small) === `${cW}%` && eqA(mk, side === 'home' ? [`model ${100 - cW}%`, `model ${cW}%`] : [`model ${cW}%`, `model ${100 - cW}%`]),
        `a half-point (${p} home, the pick ${side}) reads the same on the row and on the game's page: ${cW}% for the pick, ${100 - cW}% for the other side, the band ${band} (row "${cR ? cR.querySelector('.sl-probrow').getAttribute('aria-label') : ''}", ${cR ? txt(cR.querySelector('.sl-tier')) : ''}; page ${txt(small)}, ${mk.join(' / ')}; ${bP.slice(0, 2).join(' | ')})`);
      closeBets(d);
    }
    /* a game the state has no call for (the review's L6: a game new to the feed as the job's first pass writes it): "no call yet", an
       empty bar, a dash for the prediction, never NaN or a made-up 50%; its page opens and says the same. Then a chance with no goals
       layer: the bar and the band drawn, the prediction still a dash */
    { const GQ = come[come.length - 1], v = d.getElementById('gameView');
      if (GQ) {
        both((St, id) => { const g = St.games.find(x => x.id === id); for (const k of ['pHome', 'rh', 'ra', 'diff', 'mu', 'xt', 'tie', 'pm', 'elo', 'by', 'models', 'line', 'pick', 'mlEdge', 'mlPick', 'cover', 'plEdge', 'plPick', 'ou', 'ouEdge', 'ouPick']) delete g[k]; }, GQ.id);
        const cQ = hold(GQ, AT, null, 'a game with no call: the row by this section\'s rule'), e0 = errs.length, bQ = gpWrongs(w, gBy(GQ.id), AT, null, { noPlayers: true });
        chk(!!cQ && txt(cQ.querySelector('.sl-tier')) === 'no call yet' && txt(cQ.querySelector('.sl-pred')) === 'Predicted–' && !/NaN|%/.test(txt(cQ)) && !cQ.querySelector('.sl-a, .sl-h') && !bQ.length && pageOn(d, GQ.id) && errs.length === e0 && txt(v.querySelector('.ghead .winner')) === 'Model pickno call yet' && !/NaN/.test(txt(v)),
          `a game with no call says "no call yet" with an empty bar and a dash for the prediction, and its page opens and says the same, nothing thrown (${cQ ? txt(cQ).slice(-60) : 'no row'}; page: ${txt(v.querySelector('.ghead .winner'))}; ${bQ.slice(0, 3).join(' | ')}; ${errs.slice(e0).join(' | ')})`);
        closeBets(d);
        both((St, id) => { Object.assign(St.games.find(x => x.id === id), { pHome: 0.56, pick: 'home' }); }, GQ.id);
        const cQ2 = hold(GQ, AT, null, 'a chance with no goals layer: the bar and the band drawn, the prediction a dash');
        chk(!!cQ2 && txt(cQ2.querySelector('.sl-tier')) === 'LOW 56%' && txt(cQ2.querySelector('.sl-pred')) === 'Predicted–' && !/NaN/.test(txt(cQ2)), `a chance with no goals layer keeps its bar and band and predicts nothing (${cQ2 ? txt(cQ2.querySelector('.sl-pred')) : ''})`);
        /* and, still to come, an away pick at pHome 0.455 (the review of nhl v30): 55% and LOW on the row and on its page, never 54% and 50/50 */
        both((St, id) => { Object.assign(St.games.find(x => x.id === id), { pHome: 0.455, pick: 'away' }); }, GQ.id);
        const cQ3 = hold(GQ, AT, null, 'still to come, an away pick at 0.455: the row by this section\'s rule'), bQ3 = gpWrongs(w, gBy(GQ.id), AT, null, { noPlayers: true }), A3 = ab(GQ.away), H3 = ab(GQ.home);
        chk(!!cQ3 && slCallS(gBy(GQ.id)).conf === 55 && txt(cQ3.querySelector('.sl-tier')) === 'LOW 55%' && cQ3.querySelector('.sl-probrow').getAttribute('aria-label') === `${A3} 55%, ${H3} 45%` && !bQ3.length && pageOn(d, GQ.id) && txt(v.querySelector('.ghead .winner small')) === '55%',
          `a game to come whose pick is away at pHome 0.455 is LOW 55% on its row and 55% on its page, as a home pick at 0.545 is (${cQ3 ? txt(cQ3.querySelector('.sl-tier')) : 'no row'}; page ${txt(v.querySelector('.ghead .winner small'))}; ${bQ3.slice(0, 2).join(' | ')})`);
        closeBets(d);
      } }
    /* the source note (the review's L8): a warning in the page's warning ink, and what it means for the calls on its title */
    if (S.players && isO(S.players.injuries) && S.players.injuries.pulled) {
      both(St => { St.players.injuries.pulled = new Date(Date.parse(St.published) - 48 * 3600000).toISOString().slice(0, 16) + 'Z'; });
      redraw(dayList(d)[0]); const sn = $('sourceNote');
      chk(!sn.hidden && /^Injury report from .+\.$/.test(txt(sn)) && sn.querySelectorAll('b').length === sn.childElementCount && /^The injury report could not be read at the last run: the lineups the calls stand on leave out who that report had out\./.test(sn.title), `an injury report carried from an earlier run is said over the list, and what it means for the calls is on the note's title (${txt(sn)} | ${sn.title})`);
    }
    /* the Eastern day turns with the list shown: the watch draws the select again, Today on the new day */
    { const tN = AT + 86400000; w.__setClock(tN); d.dispatchEvent(new w.Event('visibilitychange'));
      const tO = [...$('daySel').querySelectorAll('option')].find(o => /^Today, /.test(txt(o)));
      chk(eqA(dayList(d), slDaysS(tN)) && (!tO || tO.value === etDate(tN)) && eqA([...$('daySel').querySelectorAll('option')].map(txt), slDaysS(tN).map(dd => slOptS(dd, etDate(tN)))), `when the Eastern day turns the watch draws the select again, Today on the new day (${tO ? tO.value : 'no Today'}, ${etDate(tN)})`);
      w.__setClock(AT); d.dispatchEvent(new w.Event('visibilitychange'));
      chk(eqA(dayList(d), slDaysS(AT)), 'and back'); }
    /* a day with no game, and no schedule at all */
    if (S.games.some(g => g.date === today)) { const later = S.games.some(g => g.date > today); openDay(d, today);      /* today shown, then its games gone */
      both((St, dd) => { St.games = St.games.filter(g => g.date !== dd); }, today);
      if (later) { redraw(today); const bE = listWrongs(w, today, AT, MAP); chk(!bE.length && $('gamesList').children.length === 1 && txt($('gamesList')) === slEmptyS(today, AT) && $('slateOdds').hidden && /0–0$/.test(txt($('dayRec'))), `today with no game is still in the select and says so, its record 0–0 and no odds bar (${txt($('gamesList'))}; ${bE.slice(0, 2).join(' | ')})`); }
      /* on the schedule's last game day there is no later day: with today's games gone the season is over, so the select is every game day, the last one shown, today not among them */
      else { d.querySelector('#tabs button[data-tab="pickem"]').click(); d.querySelector('#tabs button[data-tab="games"]').click(); const shown = $('daySel').value, bE = listWrongs(w, shown, AT, MAP);
        chk(eqA(dayList(d), slDaysS(AT)) && !dayList(d).includes(today) && shown === slOpenS(AT) && !bE.length, `on the schedule's last game day, with today's games gone the select is every game day and shows the last, today not listed (${dayList(d).length} days, ${shown}; ${bE.slice(0, 2).join(' | ')})`); } }
    both(St => { St.games = []; }); w.__setClock(AT + 86400000 * 400); d.dispatchEvent(new w.Event('visibilitychange')); w.__setClock(AT); d.dispatchEvent(new w.Event('visibilitychange'));
    chk(eqA(dayList(d), [today]) && txt($('gamesList')) === `The ${S.season - 1}-${String(S.season).slice(2)} schedule is not out yet` && $('dayPrev').disabled && $('dayNext').disabled, `with no schedule the select is today alone and the list says the schedule is not out (${txt($('gamesList'))})`);
  } finally { S = real; }
  { const all = [...new Set(S.games.map(g => g.date))].sort(), has = new Set(all), gap = all.map(dd => slAdd(dd, -1)).find(dd => !has.has(dd) && dd > all[0] && has.has(slAdd(dd, 1)));
    if (gap) { const tG = Date.parse(gap + 'T17:00:00Z'), e4 = [], w4 = await boot(tG, e4), d4 = w4.document;
      chk(etDate(tG) === gap && d4.getElementById('daySel').value === slOpenS(tG) && slOpenS(tG) === slAdd(gap, 1) && dayList(d4).includes(gap) && eqA(dayList(d4), slDaysS(tG)), `opened on a day with no game whose tomorrow has one (${gap}), the page shows tomorrow, today still in the select (${d4.getElementById('daySel').value})`);
      openDay(d4, gap); const bG = listWrongs(w4, gap, tG, pageMap(w4)); chk(!bG.length && txt(d4.getElementById('gamesList')) === 'No games scheduled for this day.', `and today, chosen, says it has no game (${txt(d4.getElementById('gamesList'))}; ${bG.slice(0, 2).join(' | ')})`);
      chk(!e4.length, 'no runtime error on a day with no game: ' + e4.join(' | ')); w4.close(); }
    else console.log('  no day without a game between two game days in this schedule: opening on tomorrow is not held'); }
  /* the idle odds line names the books (the review's L9): another book's price is never called DraftKings'. On copies of the state: one of
     the lines to come at another book, then no line to come at all */
  { const today9 = etDate(AT), lined9 = S.games.filter(g => slDaysS(AT).includes(g.date) && g.date >= today9 && !sStarted(g, AT) && g.line), real9 = S;
    try {
      if (lined9.length) { const M1 = JSON.parse(STATE); M1.games.find(g => g.id === lined9[0].id).line.book = 'ESPN BET'; S = M1;
        const e9 = [], w9 = await boot(AT, e9, { state: JSON.stringify(M1) }), t9 = txt(w9.document.getElementById('oddsNote'));
        chk(t9 === oddsIdleS(AT) && /\bESPN BET\b/.test(t9) && !/^DraftKings via ESPN/.test(t9) && / via ESPN, .+\.$/.test(t9) && !e9.length, `with a line to come at another book the idle odds line names the book, never "DraftKings via ESPN" alone (${t9})`); w9.close(); }
      else console.log('  no line among the games to come: another book in the idle odds line is not planted');
      const M2 = JSON.parse(STATE); for (const g of M2.games) if (!sStarted(g, AT)) { g.line = null; for (const k of ['mlEdge', 'mlPick', 'cover', 'plEdge', 'plPick', 'ou', 'ouEdge', 'ouPick']) delete g[k]; }
      S = M2; const e8 = [], w8 = await boot(AT, e8, { state: JSON.stringify(M2) }), t8 = txt(w8.document.getElementById('oddsNote'));
      chk(t8 === oddsIdleS(AT) && t8 === `No lines yet at the job's last run, ${sDayClock(PUB)}.` && !/DraftKings/.test(t8) && !e8.length, `with no line among the games to come the idle odds line claims none (${t8})`); w8.close();
    } finally { S = real9; } }
  /* the one read wherever the Games tab is first drawn (the review's L3): a page opened on another tab at a puck drop asks ESPN for nothing,
     and reads the day shown once when Games is opened, no more when it is opened again */
  { const nextG = S.games.filter(g => g.state === 'pre' && !sStarted(g, AT)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0], tU = nextG ? Date.parse(nextG.start) + 60000 : AT;
    const e5 = [], w5 = await boot(tU, e5, { hash: 'pickem' }), d5 = w5.document, sb5 = () => w5.__requests.filter(r => r.url.startsWith(SB_URL)), n0 = sb5().length;
    d5.querySelector('#tabs button[data-tab="games"]').click(); await wait(20);
    const day5 = d5.getElementById('daySel').value, want5 = S.games.some(g => g.date === day5 && g.state !== 'final' && sStarted(g, tU)) ? 1 : 0, n1 = sb5().length;
    d5.querySelector('#tabs button[data-tab="pickem"]').click(); d5.querySelector('#tabs button[data-tab="games"]').click(); d5.dispatchEvent(new w5.Event('visibilitychange')); await wait(20);
    chk(n0 === 0 && n1 === want5 && sb5().length === want5 && (!want5 || (sb5()[0].url === `${SB_URL}?dates=${day5.replace(/-/g, '')}&limit=100` && sb5()[0].cache === 'no-store')) && (!nextG || want5 === 1), `a page opened on another tab asks ESPN for nothing, reads the day shown once when Games is first opened${nextG ? ' (a game under way: one read)' : ''}, and nothing more after (${n0}, ${n1}, ${sb5().length} requests; day ${day5})`);
    chk(!e5.length, 'no runtime error on a page opened on another tab: ' + e5.join(' | ')); w5.close(); }
  /* before the season opens (the page opened five days before the first game): today and the first week's game days, today the countdown.
     Once it is over (twenty days after the last): every game day, the last one shown */
  { const all = [...new Set(S.games.map(g => g.date))].sort();
    if (all.length) {
      const tPre = Date.parse(slAdd(all[0], -5) + 'T17:00:00Z'), e2 = [], w2 = await boot(tPre, e2), d2 = w2.document, todayP = etDate(tPre), nP = Math.round((Date.parse(all[0] + 'T12:00:00Z') - Date.parse(todayP + 'T12:00:00Z')) / 86400000);
      chk(eqA(dayList(d2), slDaysS(tPre)) && dayList(d2)[0] === todayP && d2.getElementById('daySel').value === todayP && dayList(d2).every(dd => dd === todayP || dd <= slAdd(all[0], 6)), `before the season opens the select lists today and the first week's game days, and shows today (${dayList(d2).join(', ').slice(0, 120)}: ${d2.getElementById('daySel').value})`);
      chk(!!d2.querySelector('#gamesList .empty#opening .countdown') && txt(d2.querySelector('#gamesList .countdown')) === String(nP) && txt(d2.getElementById('gamesList')) === `${nP}day${nP === 1 ? '' : 's'} to opening night` && d2.getElementById('slateOdds').hidden, `and today is the countdown to opening night, nothing more (${txt(d2.getElementById('gamesList'))})`);
      const bP = listWrongs(w2, todayP, tPre, pageMap(w2)); chk(!bP.length, `the list before the season: ${bP.slice(0, 3).join(' | ')}`);
      if (dayList(d2).length > 1) { openDay(d2, dayList(d2)[1]); const bP2 = listWrongs(w2, dayList(d2)[1], tPre, pageMap(w2)); chk(!bP2.length && bP2.rows > 0, `opening night's rows before the season (${bP2.rows}): ${bP2.slice(0, 3).join(' | ')}`); }
      chk(!e2.length, 'no runtime error before the season: ' + e2.join(' | ')); w2.close();
      const tPost = Date.parse(slAdd(all[all.length - 1], 20) + 'T17:00:00Z'), e3 = [], w3 = await boot(tPost, e3), d3 = w3.document;
      chk(eqA(dayList(d3), all) && d3.getElementById('daySel').value === all[all.length - 1] && !dayList(d3).includes(etDate(tPost)) && d3.getElementById('dayNext').disabled, `once the season is over the select lists every game day and shows the last (${dayList(d3).length} days, ${d3.getElementById('daySel').value})`);
      const bO = listWrongs(w3, all[all.length - 1], tPost, pageMap(w3)); chk(!bO.length, `the list once the season is over: ${bO.slice(0, 3).join(' | ')}`);
      chk(!e3.length, 'no runtime error once the season is over: ' + e3.join(' | ')); w3.close();
    }
  }
  /* ---- the layout, read from the stylesheet (jsdom lays nothing out) ---- */
  {
    cssWith(w, 'display', /./);
    const R = RULES.get(w), gv = (sel, mediaRx, prop) => { for (const [s2, m2, st] of R) if (s2.split(',').map(x => x.trim()).includes(sel) && (mediaRx ? mediaRx.test(m2) : !m2) && st.getPropertyValue(prop)) return st.getPropertyValue(prop).trim(); return ''; };
    const cols = v => { const out = []; let dep = 0, cur = ''; for (const ch of v) { if (ch === '(') dep++; if (ch === ')') dep--; if (ch === ' ' && !dep) { if (cur) out.push(cur); cur = ''; } else cur += ch; } if (cur) out.push(cur); return out; };
    const least = t => { const m = /^minmax\((\d+)px,/.exec(t); return m ? +m[1] : /^(\d+)px$/.test(t) ? parseInt(t, 10) : NaN; };
    const wide = cols(gv('.game', null, 'grid-template-columns')), midRx = /min-width:\s*901px\)\s*and\s*\(max-width:\s*1160px/, mid = cols(gv('.game', midRx, 'grid-template-columns')), phoneRx = /^\(max-width:\s*900px\)$/, phone = cols(gv('.game', phoneRx, 'grid-template-columns'));
    const sum = (c, gap, pad) => c.map(least).reduce((a, b) => a + b, 0) + gap * (c.length - 1) + 2 * pad;
    const wideW = sum(wide, parseInt(gv('.game', null, 'gap'), 10), 16), midW = sum(mid, parseInt(gv('.game', midRx, 'gap'), 10), 12);
    chk(wide.length === 6 && mid.length === 6 && wideW <= 1161 - 44 - 17 && midW <= 901 - 44 - 17, `the six columns fit their layouts with a scrollbar: ${wideW}px of ${1161 - 61} at 1161px, ${midW}px of ${901 - 61} at 901px (${wide.join(' ')} | ${mid.join(' ')})`);
    chk(least(wide[5]) === 136 && least(mid[5]) === 136 && gv('.gamehead', null, 'grid-template-columns') === gv('.game', null, 'grid-template-columns'), 'the Final-score column is 136px in both, and the heads share the rows\' columns');
    chk(phone.length === 3 && gv('.gamehead', phoneRx, 'display') === 'none' && gv('.game .when', phoneRx, 'grid-row') === '1' && gv('.game .matchup', phoneRx, 'grid-row') === '2' && gv('.game .sl-probrow', phoneRx, 'grid-row') === '3' && gv('.game .sl-conf', phoneRx, 'grid-row') === '4' && gv('.game .sl-pred', phoneRx, 'grid-row') === '4' && /^1\s*\/\s*3$/.test(gv('.game .sl-result', phoneRx, 'grid-row')), `at 900px and under a row is a card of four lines, its heads hidden (${phone.join(' ')})`);
    /* nothing cut on a row: a number its half of the bar has no room for wraps under a strut, out of sight (the half one line tall, its overflow
       hidden); on a phone the date and the time each stay whole, the time under the date where the two will not fit; on the narrowest
       phones the score's cell is capped, so a long clock under it wraps and the matchup keeps its room */
    chk(/\.sl-prob \.sl-a,\.sl-prob \.sl-h\{[^}]*flex-wrap:wrap;[^}]*height:28px;[^}]*white-space:nowrap;overflow:hidden\}/.test(HTML) && /\.sl-prob \.sl-a::before,\.sl-prob \.sl-h::before\{content:"";flex:none;width:0;height:28px\}/.test(HTML) && gv('.sl-prob', null, 'height') === '28px',
      "a percentage its half of the bar has no room for wraps out of sight under a strut the bar's height, never cut");
    chk(gv('.game .when', phoneRx, 'white-space') === 'nowrap' && gv('.game .when', phoneRx, 'flex-wrap') === 'wrap' && gv('.game .sl-result', /^\(max-width:\s*380px\)$/, 'max-width') === '125px' && gv('.sl-sub', null, 'white-space') === 'normal',
      `on a phone the date and the puck drop each stay whole, and at 380px and under the score's cell is capped so a long clock wraps under it (${gv('.game .when', phoneRx, 'white-space')}, ${gv('.game .sl-result', /^\(max-width:\s*380px\)$/, 'max-width')})`);
    const medias = [...new Set(R.filter(([s2, m2]) => m2 && s2.split(',').map(x => x.trim()).includes('.game') && R.some(([s3, m3, st]) => s3 === s2 && m3 === m2 && st.getPropertyValue('grid-template-columns'))).map(x => x[1]))];
    chk(medias.length === 2, `exactly one layout between the phone card and the wide one (${medias.join(' | ')})`);
    /* nothing in a row is cut (the review's L2): the last cell is free to wrap, its words and its score each whole (rowWrongs holds the two
       parts), the line under them too; so "WPG leading" over "10–9" where the column has no room for both, at any width. jsdom lays
       nothing out: the rules are read, and the parts counted (a club's letters are four at the most) */
    { const nowrap = cssWith(w, 'white-space', /^nowrap$/).flatMap(([sel]) => sel.split(',').map(x => x.trim()));
      chk(!nowrap.some(x => ['.sl-result', '.sl-mwin', '.sl-result .sl-mwin', '.sl-sub', '.game .sl-result'].includes(x)) && nowrap.includes('.sl-result .sl-mwin span') && gv('.sl-sub', null, 'white-space') === 'normal' && gv('.sl-result', null, 'min-width') === '0px' && Object.values(S.teams).every(t => String(t.abbr || '').length <= 4),
        `the last cell wraps between its whole parts and nothing in it is cut: the cell itself is not nowrap, each part is (${nowrap.filter(x => /sl-(result|mwin|sub|sc)/.test(x)).join(', ')})`); }
    chk(gv('.src-note b', null, 'color') === 'var(--gold-ink)', `the source note is a warning, in the page's warning ink (${gv('.src-note b', null, 'color')})`);
    const tall = el => !!el && w.getComputedStyle(el).minHeight === '44px';
    chk(tall($('slateNow')) && tall($('dayPrev')) && tall($('dayNext')) && tall($('daySel')) && tall($('refreshOdds')) && R.some(([s2, m2, st]) => /max-width:\s*640px/.test(m2) && s2.split(',').some(x => x.trim() === 'select') && st.getPropertyValue('font-size') === '16px'), 'Refresh scores, the steppers, the select and Refresh odds are 44px tall, and the select is 16px on a phone');
    chk(gv('.gamehead', null, 'color') === 'var(--ink-2)' && gv('.slatesep', null, 'color') === 'var(--ink-2)' && /\.game::before\{[^}]*background:linear-gradient\(180deg,var\(--ice\),transparent\)\}/.test(HTML) && /\.game\.final::before\{background:linear-gradient\(180deg,var\(--muted\),transparent\)\}/.test(HTML) && gv('.sl-tier.sl-med', null, 'color') === 'var(--gold-ink)', "the heads and Completed in --ink-2 (they sit straight on the page), a row's edge ice and a finished game's the quiet ink, the MED pill gold");
  }
  chk(!errs.length, 'no runtime error on the Games list: ' + errs.join(' | '));
  w.close();
}

/* ---------- THE GAME'S PAGE (nhl v27) ----------
   The page a game opens (#gameModal, the NFL hub's game page in hockey's numbers) and its three little windows (#gsModal), worked out
   here from the state by this section's own rules, never the page's code, on any state the job can publish (no game, every game
   started, no line, a stale line, another book, no props model, no box score, the offseason): what a rule needs and the state lacks is
   said and skipped, never failed.
   gpWrongs(w, g, ms, rd, o) opens the game's page from its card and returns what is wrong with it: the bar (Close, the trial's pill by
   the ledger's decision, All skaters), the search, Refresh odds and this game's own status line or, once the puck has dropped, the
   strip; the head's six cells; the windows' buttons; Game bets row by row (the bet, a box exactly where a fresh line of a game to come
   prices the side, ticked exactly where `o.inB` has the leg, the fair chance, its band by 70 and 45, the model's chance, the price,
   Value exactly on the state's picks; the grades from `result` once the puck has dropped); each club's head, its outs (the report's,
   in its order), the box score not read; every player's row in order (the goalie, the forwards and the defencemen by expected ice
   time, six and four before All skaters; a game not projected the player model's lineup, names alone; a final the box score's), his
   role, his day-to-day chip, his figures; and, opened one at a time, every block and row of his lines (the projection and the line
   on the heading, the Over and the Under at DraftKings' fair chance with all of the margin on the Over, each milestone but the main
   line's Over at its price over the measured margin, est. drawn, the props model's chance, the box's key) */
const GP_STATS_S = { F: ['pts', 'g', 's', 'a', 'bs'], D: ['pts', 'g', 's', 'a', 'bs'], G: ['sv'] }, GP_HEAD_S = { F: ['pts', 's', 'g'], D: ['pts', 's', 'bs'], G: ['sv'] };
const GP_LBL_S = { pts: 'Points', g: 'Goals', s: 'Shots on goal', a: 'Assists', bs: 'Blocked shots', sv: 'Saves' }, GP_SHORT_S = { pts: 'points', g: 'goals', s: 'shots', a: 'assists', bs: 'blocks', sv: 'saves' };
const GP_CUT_F = 6, GP_CUT_D = 4;
const gpSgnS = (x, n) => { const r = +(+x).toFixed(n); return (r > 0 ? '+' : r < 0 ? '-' : '') + Math.abs(r).toFixed(n); };
const gpTierS = p => p >= 0.7 ? 'High' : p >= 0.45 ? 'Med' : 'Low';
const gpDayS = iso => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const gpOrdS = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th');
const gpShortS = n => { const p = String(n || '').split(' '); return p.length < 2 ? String(n || '') : p[0][0] + '. ' + p.slice(1).join(' '); };
const gpBookS = L => !L ? 'DraftKings' : String(L.book || '').toLowerCase().replace(/\s+/g, '') === 'draftkings' ? 'DraftKings' : L.book ? String(L.book) : 'the book';
const gpPossS = n => /s$/.test(n) ? n + "'" : n + "'s";
const gpDateClockS = iso => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const isO = x => !!x && typeof x === 'object' && !Array.isArray(x);
/* the score as the page should know it: a read this browser made (lv) over the state's own */
function gpScoreS(g, lv) {
  if (lv && lv.state === 'off') return { st: 'off', hs: null, as: null, fin: false, live: false, detail: '', off: lv.off, offAt: lv.at };      /* called off at ESPN: no score, never a final */
  const st = lv ? lv.state : g.state, hs = lv ? lv.hs : g.hs, as = lv ? lv.as : g.as, ok = (st === 'final' || st === 'live') && Number.isFinite(hs) && Number.isFinite(as);
  return { st, hs, as, fin: st === 'final' && ok, live: st === 'live' && ok, detail: String((lv ? lv.detail : g.detail) || '') };
}
/* every player of a game: the props model's projections, DraftKings' lines of the read (rd), by ESPN's athlete id */
function gpPeopleS(g, rd) {
  const pr = S.props && isO(S.props.games) && isO(S.props.games[g.id]) ? S.props.games[g.id] : null, PL = (S.players && S.players.players) || {}, m = new Map();
  const get = id => { id = String(id); if (!m.has(id)) { const p = PL[id]; m.set(id, { id, name: p ? p.name : null, pos: p ? p.pos : null, team: p ? p.team : null, toi: null, how: null, debut: false, proj: {}, main: {}, yes: {}, dk: false, mine: false }); } return m.get(id); };
  if (pr) for (const side of ['away', 'home']) {
    const Q = pr[side + 'P']; if (!isO(Q)) continue;
    for (const p of Q.skaters || []) { if (!isO(p) || !p.id) continue; const x = get(p.id); Object.assign(x, { name: p.name, pos: p.pos, team: g[side], toi: p.toi, mine: true }); for (const k of ['pts', 'g', 's', 'a', 'bs']) if (isO(p[k]) && Array.isArray(p[k].d)) x.proj[k] = p[k]; }
    if (isO(Q.goalie) && Q.goalie.id) { const x = get(Q.goalie.id); Object.assign(x, { name: Q.goalie.name, pos: 'G', team: g[side], how: Q.goalie.how || null, debut: !!Q.goalie.debut, mine: true }); if (isO(Q.goalie.sv) && Array.isArray(Q.goalie.sv.d)) x.proj.sv = Q.goalie.sv; }
  }
  if (rd && rd.status === 200) {
    for (const [a, st, L, po, pu] of rd.main) { const x = get(a); x.main[st] = { L, po, pu }; x.dk = true; }
    for (const [a, st, k, price] of rd.yes) { const x = get(a); (x.yes[st] = x.yes[st] || []).push({ k, price }); x.dk = true; }
  }
  return m;
}
const gpBoxS = (g, pid) => { const b = S.box && isO(S.box.games) ? S.box.games[g.id] : null; if (!isO(b)) return null; const s = isO(b.s) ? b.s[pid] : null; if (Array.isArray(s)) return { g: s[0], a: s[1], pts: s[0] + s[1], s: s[2], bs: s[3] }; for (const k of ['g', 'r', 'u']) if (isO(b[k]) && b[k][pid] !== undefined) return { sv: b[k][pid] }; return null; };
/* a club's rows in order, and the players DraftKings prices on neither club */
function gpRosterS(g, rd, all, sc, started) {
  const people = [...gpPeopleS(g, rd).values()], box = S.box && isO(S.box.games) && isO(S.box.games[g.id]) ? S.box.games[g.id] : null, PL = (S.players && S.players.players) || {}, PT = (S.players && S.players.teams) || {};
  const out = {}, bare = (id, name, pos, club, more) => Object.assign({ id: String(id), name, pos, team: club, toi: null, how: null, debut: false, proj: {}, main: {}, yes: {}, dk: false, mine: true }, more || {});
  for (const side of ['away', 'home']) {
    const club = g[side], pm = isO(g.pm) && isO(g.pm[side]) ? g.pm[side] : null;
    let list = people.filter(x => x.team === club && x.mine);
    if (!list.length && sc.fin && box) {
      list = Object.keys(isO(box.s) ? box.s : {}).filter(id => PL[id] && PL[id].team === club).map(id => bare(id, PL[id].name, PL[id].pos, club, { boxed: true }));
      for (const k of ['g', 'r', 'u']) for (const id of Object.keys(isO(box[k]) ? box[k] : {})) if (PL[id] && PL[id].team === club) list.push(bare(id, PL[id].name, 'G', club, { boxed: true, relief: k === 'r' }));
    }
    if (!list.length && !started && pm && isO(PT[club])) {
      if (isO(pm.goalie) && pm.goalie.name) list.push(bare(pm.goalie.id || 'g-' + club, pm.goalie.name, 'G', club, { how: pm.goalie.how || null, debut: !!pm.goalie.debut }));
      for (const p of PT[club].lineup || []) if (isO(p) && p.id) list.push(bare(p.id, p.name, p.pos, club, { toi: Math.round((+p.share || 0) * 600) / 10 }));
    }
    const bx = x => { const v = x.boxed && box && isO(box.s) ? box.s[x.id] : null; return Array.isArray(v) ? (v[0] + v[1]) * 100 + v[2] : 0; };
    const by = (a, b) => (b.toi || 0) - (a.toi || 0) || bx(b) - bx(a) || (b.proj.pts ? b.proj.pts.mu : 0) - (a.proj.pts ? a.proj.pts.mu : 0) || sStr(String(a.name), String(b.name)) || sStr(a.id, b.id);
    const G = list.filter(x => sGrp(x.pos) === 'G'), F = list.filter(x => sGrp(x.pos) === 'F').sort(by), D = list.filter(x => sGrp(x.pos) === 'D').sort(by);
    const extra = all ? people.filter(x => x.team === club && !x.mine && x.dk).sort((a, b) => sStr(String(a.name), String(b.name)) || sStr(a.id, b.id)) : [];
    const dtd = new Set((pm && Array.isArray(pm.dtd) ? pm.dtd : []).flatMap(o => [o.id ? String(o.id) : null, o.name]).filter(Boolean));
    out[side] = { club, pm, cut: F.length + D.length - Math.min(F.length, GP_CUT_F) - Math.min(D.length, GP_CUT_D),
      players: (all ? [...G, ...F, ...D] : [...G, ...F.slice(0, GP_CUT_F), ...D.slice(0, GP_CUT_D)]).concat(extra).map(x => Object.assign({}, x, { grp: sGrp(x.pos), dtd: dtd.has(String(x.id)) || dtd.has(x.name) })) };
  }
  out.other = all ? people.filter(x => x.dk && ![g.home, g.away].includes(x.team)) : [];
  return out;
}
/* one row of a bet table as drawn, and as it should be */
const gpRowS = tr => { const c = tr.children, inp = c[0].querySelector('input[type="checkbox"]'), res = c[0].querySelector('.res'), val = c[1].querySelector('.pb-valmark'), fill = c[2].querySelector('.bar-fill'), mk = c[5].querySelector('.mkt');
  return { n: c.length, box: inp ? (inp.dataset.leg !== undefined ? 'L:' + inp.dataset.leg : 'P:' + inp.dataset.ppAdd) : null, on: !!inp && inp.checked, aria: inp ? inp.getAttribute('aria-label') : null, res: res ? txt(res) : null,
    label: val ? txt(c[1]).slice(0, -txt(val).length) : txt(c[1]), value: val ? `${txt(val)}|${val.title}` : null, bar: fill ? `${fill.className.replace(/^bar-fill\s*/, '')} ${fill.style.width}` : c[2].querySelector('.bar-track') ? 'empty' : 'none',
    pct: c[3].querySelector('em') ? txt(c[3]).slice(0, -txt(c[3].querySelector('em')).length) : txt(c[3]), est: c[3].querySelector('em') ? txt(c[3].querySelector('em')) : '', pctT: c[3].title || '', band: txt(c[4]), bandC: c[4].querySelector('.conf') ? c[4].querySelector('.conf').className : '',
    model: txt(c[5]), modelT: mk ? mk.title : '', price: txt(c[6]), cls: tr.className.split(/\s+/).filter(Boolean).sort().join(' ') }; };
const gpRowWant = o => { const f = o.fair === null || o.fair === undefined || !isFinite(o.fair) ? null : o.fair, t = f === null ? null : gpTierS(f), pc = o.pc || PBS.pctW, locked = !!o.locked, key = !locked && o.box ? o.box : null;
  return { n: 7, box: key, on: !!key && !!o.on, aria: key ? o.aria : null, res: locked ? (o.res === 'win' ? '✓' : o.res === 'loss' ? '✗' : o.res === 'push' ? 'push' : '–') : null,
    label: o.label, value: o.value ? `Value|${o.value}` : o.call ? "Call|the model's call, made before the puck drop" : null, bar: f === null ? 'empty' : `${t.toLowerCase()} ${Math.max(2, Math.min(100, f * 100)).toFixed(0)}%`,
    pct: f === null ? '–' : pc(f), est: f !== null && o.est ? 'est.' : '', pctT: f === null ? '' : `${gpPossS(o.book || 'DraftKings')} fair chance${o.est ? ', est.' : ''}`, band: f === null ? '' : t, bandC: f === null ? '' : `conf ${t.toLowerCase()}`,
    model: o.modelPct !== undefined && o.modelPct !== null ? `model ${o.modelPct}%` : o.model === null || o.model === undefined ? '' : `model ${pc(o.model)}`, modelT: (o.modelPct === undefined || o.modelPct === null) && (o.model === null || o.model === undefined) ? '' : o.modelT, price: PBS.ok(o.price) ? PBS.odds(o.price) : '',
    cls: [o.cls || '', key && o.on ? 'on' : '', key ? 'pickable' : '', locked && o.res === 'win' ? 'hit' : locked && o.res === 'loss' ? 'miss' : ''].filter(Boolean).sort().join(' ') }; };
const gpDiff = (have, want) => Object.keys(want).filter(k => have[k] !== want[k]).map(k => `${k} "${have[k]}" not "${want[k]}"`);
const gpFlipS = r => r === 'win' ? 'loss' : r === 'loss' ? 'win' : r;
/* Game bets as they should be: [block key, heading parts, rows] and the lines over and under them */
function gpBetsS(g, sc, locked, inB) {
  const L = g.line, R = isO(g.result) ? g.result : null, offer = !locked && !!L && sFresh(g), bk = gpBookS(L), on = id => !!inB && inB.has(id);
  const won = sc.fin && sc.hs !== sc.as ? (sc.hs > sc.as ? 'home' : 'away') : null;
  const valT = (pick, edge, side) => !locked && L && pick === side ? (isO(edge) && typeof edge[side] === 'number' ? `the model's call: its chance is ${Math.round(edge[side] * 100)} points above the chance ${gpPossS(bk)} price implies` : "the model's call") : '';
  const callS = (pick, side) => locked && !!L && pick === side;      /* once the puck has dropped the side the call took is still marked, beside its grade */
  const blocks = [];
  for (const side of ['away', 'home']) {
    const id = g[side], nm = sh(id), B = sLeg(g, side, 'ml'), C = sLeg(g, side, 'pl'), CWb = slCallS(g), pctW2 = CWb ? (side === 'home' ? CWb.ph : CWb.pa) : null, rows = [];
    rows.push(gpRowWant({ label: 'To win', fair: B ? B.fair : null, book: bk, model: null, modelPct: pctW2, modelT: "the model's chance to win, overtime included", price: B ? B.price : null, box: offer && B ? 'L:' + B.id : null, on: B && on(B.id), aria: `Add ${nm} to win`, locked, res: locked && won ? (won === side ? 'win' : 'loss') : null, value: B ? valT(g.mlPick, g.mlEdge, side) : '', call: !!B && callS(g.mlPick, side) }));
    if (C) rows.push(gpRowWant({ label: `To cover ${lineS(C.num)}`, fair: C.fair, book: bk, model: C.p, modelT: "the model's chance to cover", price: C.price, box: offer ? 'L:' + C.id : null, on: on(C.id), aria: `Add ${nm} to cover ${lineS(C.num)}`, locked, res: locked && R && R.homeCover ? (side === 'home' ? R.homeCover : gpFlipS(R.homeCover)) : null, value: valT(g.plPick, g.plEdge, side), call: callS(g.plPick, side) }));
    blocks.push({ key: side, tag: id, ems: (Number.isFinite(g.xt) && Number.isFinite(g.mu) ? [`our margin ${gpSgnS(side === 'home' ? g.mu : -g.mu, 1)}`] : []).concat(C ? [`book line ${lineS(C.num)}`] : []), head: `${ab(id)} ${nm}`, rows });
  }
  const O = sLeg(g, 'over', 'ou'), U = sLeg(g, 'under', 'ou');
  if (O || U) blocks.push({ key: 'total', tag: null, ems: (Number.isFinite(g.xt) && Number.isFinite(g.mu) ? [`model's goals ${g.xt.toFixed(1)}`] : []).concat([`book line ${L.total}`]), head: 'Game total', rows: [[O, 'over'], [U, 'under']].filter(x => x[0]).map(([B, side]) => gpRowWant({ label: `${side === 'over' ? 'Over' : 'Under'} ${B.num}`, fair: B.fair, book: bk, model: B.p, modelT: `the model's chance of the ${side}`, price: B.price, box: offer ? 'L:' + B.id : null, on: on(B.id), aria: `Add ${side} ${B.num} goals, ${sh(g.away)} at ${sh(g.home)}`, locked, res: locked && R && R.over ? (side === 'over' ? R.over : gpFlipS(R.over)) : null, value: valT(g.ouPick, g.ouEdge, side), call: callS(g.ouPick, side) })) });
  return { blocks, src: !L ? null : `Lines: ${gpPossS(bk)}, read from ESPN ${L.refreshed ? 'by Refresh odds ' : ''}${clockOf(Date.parse(L.at))}.`, why: !L ? 'No DraftKings line yet.' : !locked && !sFresh(g) ? `Line from ${clockOf(Date.parse(L.at))}: not on DraftKings at the last run.` : null };
}
/* a player's open body: a block a stat, its heading's parts and its rows */
function gpBodyS(x, g, inB, canAdd) {
  const out = [], addOk = canAdd && [g.home, g.away].includes(x.team) && !!x.grp, nm = x.name || `ESPN athlete ${x.id}`, modelT = "the props model's chance (on trial)";
  for (const st of GP_STATS_S[x.grp] || PP_STATS_S_ORDER) {
    const D = x.proj[st], M = x.main[st], Y = (x.yes[st] || []).filter(y => !M || y.k !== Math.floor(M.L) + 1).sort((a, b) => a.k - b.k);
    if (!D && !M && !Y.length) continue;
    const blk = { stat: st, head: GP_LBL_S[st], ems: (D ? [`projected ${ppMuS(st, D.mu)}`] : []).concat(M ? [`DraftKings line ${M.L}`] : []), rows: [], none: !M && !Y.length };
    if (M) for (const side of ['over', 'under']) { const word = side === 'over' ? 'Over' : 'Under', price = side === 'over' ? M.po : M.pu, id = `${g.id}|p|${x.id}|${st}|${side}${M.L}`;
      blk.rows.push(gpRowWant({ cls: 'mainline', label: `${word} ${M.L}`, fair: side === 'over' ? 1 - PBS.imp(M.pu) : PBS.imp(M.pu), pc: ppPctS, model: !D ? null : side === 'over' ? atLeastS(D, Math.floor(M.L) + 1) : 1 - atLeastS(D, Math.ceil(M.L)), modelT, price, box: addOk ? `P:${x.id}|${st}|main|${side}|${M.L}` : null, on: !!inB && inB.has(id), aria: `Add ${nm}, ${word} ${M.L} ${S_STAT_NAME[st]}, ${PBS.odds(price)}` })); }
    for (const y of Y) { const id = `${g.id}|p|${x.id}|${st}|k${y.k}`, any = st === 'g' && y.k === 1;
      blk.rows.push(gpRowWant({ cls: 'rung', label: any ? 'Anytime goal' : `${y.k}+`, fair: fairYesS(st, y.k, y.price), est: true, pc: ppPctS, model: D ? atLeastS(D, y.k) : null, modelT, price: y.price, box: addOk ? `P:${x.id}|${st}|yes|${y.k}` : null, on: !!inB && inB.has(id), aria: `Add ${nm}, ${any ? 'Anytime goal' : `${y.k}+ ${S_STAT_NAME[st]}`}, ${PBS.odds(y.price)}` })); }
    out.push(blk);
  }
  return out;
}
const PP_STATS_S_ORDER = ['pts', 'g', 'a', 's', 'bs', 'sv'];
function gpRoleS(x) {
  if (x.grp !== 'G') return { t: `${x.pos || ''}${x.toi ? ` · ${Math.round(x.toi)} min` : ''}`, title: x.toi ? 'his position · expected minutes on the ice' : '' };
  const how = String(x.how || ''), m = /^(confirmed|likely|unconfirmed|named)\b/i.exec(how);
  return { t: ['G', m ? m[1].toLowerCase() : how, x.debut ? 'first NHL start' : '', x.relief ? 'in relief' : ''].filter(Boolean).join(' · '), title: how };
}
/* before a press: whose lines the page holds for the games still to come on the days listed and when the job read them. Each book is named,
   DraftKings first; a price of another book is never called DraftKings'; with no line there is no claim of one */
function oddsIdleS(ms) {
  const today = etDate(ms), days = slDaysS(ms).filter(dd => dd >= today), when = sDayClock(PUB), nm = L => { const b = gpBookS(L); return b === 'the book' ? 'a book ESPN does not name' : b; };
  const names = [...new Set(S.games.filter(g => days.includes(g.date) && !sStarted(g, ms) && g.line).map(g => nm(g.line)))].sort((a, b) => (b === 'DraftKings') - (a === 'DraftKings') || sStr(a, b));
  return names.length ? `${names.join(', ')} via ESPN, ${when}.` : `No lines yet at the job's last run, ${when}.`;
}
/* what the window's last Refresh odds press was told, from the answers given in ESPN's place (boot notes them): when the last of them
   came, each day's events (null: no answer this page can use) and the games whose player props could not be read. null: no press */
function pressS(w) {
  const A = (w.__answers || []).filter(a => a.press > 0), n = Math.max(0, ...A.map(a => a.press)); if (!n) return null;
  const P = { at: 0, evs: {}, propFail: new Set() };
  for (const a of A.filter(x => x.press === n)) {
    const m = /scoreboard\?dates=(\d{4})(\d{2})(\d{2})&limit=100&_=\d+$/.exec(a.url), pm = PROPS_RX.exec(a.url);
    if (m) P.evs[`${m[1]}-${m[2]}-${m[3]}`] = a.ok && isO(a.body) && Array.isArray(a.body.events) ? a.body.events : null;
    else if (pm) { if (a.status !== 404 && !(a.ok && isO(a.body) && Array.isArray(a.body.items))) P.propFail.add(pm[1]); }
    else continue;
    if (a.at > P.at) P.at = a.at;
  }
  return P;
}
/* the press's word on one game, by the job's own reading of ESPN's answer (tools/espn.js): postponed or cancelled there, under way or
   over there, no line there, the game not in the answer, a read older than the line the page holds; 'silent' where the day was not
   answered, 'read' where the game simply took its line, null where the press asked nothing of its day */
function pressWordS(g, P) {
  if (!P || !(g.date in P.evs)) return null;
  const list = P.evs[g.date]; if (!list) return 'silent';
  const ev = list.find(e => isO(e) && String(e.id) === g.id), comp = ev && Array.isArray(ev.competitions) ? ev.competitions[0] : null;
  if (!isO(comp)) return 'missing';
  const st = isO(comp.status) && isO(comp.status.type) ? comp.status.type : {}, word = `${st.name || ''} ${st.description || ''}`;
  if (/CANCEL/i.test(word)) return 'cancelled';
  if (/POSTPONED/i.test(word)) return 'postponed';
  if (st.state === 'in' || st.state === 'post') return 'started';
  let odds = null; try { odds = E.gameRow(ev).odds; } catch (e) { odds = null; }      /* the job's parse of the event (tools/espn.js) */
  if (!odds) return 'noLine';
  if (g.line && g.line.refreshed && Math.abs(Date.parse(g.line.at) - P.at) < 60000) return 'read';
  if (g.line && !(P.at > Date.parse(g.line.at))) return 'older';
  return 'read';
}
/* this game's status line: whose line and when (none, or one DraftKings no longer lists); the last press's word on it where ESPN did not
   simply give its line; then its player lines where they are not simply in (never for a game ESPN has called off or under way, whose
   player lines are not shown; "not read yet" only where nothing was asked); then a press that could not reach ESPN */
function gpStatusS(g, rd, ms, failed, P, lv) {
  const L = g.line, parts = [], last = PBS.nextDay(etDate(ms)), stands = L ? ': the published line stands' : '';
  let W = pressWordS(g, P), when = P ? clockOf(P.at) : '';
  if (lv && lv.state === 'off' && W !== 'postponed' && W !== 'cancelled') { W = lv.off; when = clockOf(Date.parse(lv.at)); }      /* a scoreboard read made here found it called off */
  parts.push(!L ? 'No DraftKings line yet' : !sFresh(g) ? `Line from ${clockOf(Date.parse(L.at))}: not on DraftKings at the last run` : `${gpBookS(L)} via ESPN, ${clockOf(Date.parse(L.at))}`);
  const off = W === 'postponed' || W === 'cancelled' || W === 'started';
  if (W === 'postponed' || W === 'cancelled') parts.push(`${W} at ESPN, read ${when}${L ? ': the published line stands until the job takes the game off' : ''}`);
  else if (W === 'started') parts.push(`under way at ESPN, read ${when}${stands}`);
  else if (W === 'noLine') parts.push(`no line at ESPN, read ${when}${stands}`);
  else if (W === 'missing') parts.push(`not in ESPN's answer, read ${when}${stands}`);
  else if (W === 'older') parts.push(`ESPN's read of ${when} is older than the line shown`);
  if (!off) {
    if (!rd) parts.push(g.date <= last ? 'player lines not read yet' : 'player lines on game day');
    else if (rd.status === 404) parts.push('no player lines yet');
    else if (rd.status !== 200) parts.push("couldn't read player lines");
    else if (P && P.propFail.has(g.id)) parts.push(`couldn't read player lines at ${when}: the read of ${clockOf(Date.parse(rd.at))} stands`);
    else if (L && sFresh(g) && Math.floor(Date.parse(rd.at) / 60000) !== Math.floor(Date.parse(L.at) / 60000)) parts.push(`player lines ${clockOf(Date.parse(rd.at))}`);
  }
  const fd = failed !== undefined && failed !== null ? failed : P ? Object.keys(P.evs).filter(dd => !P.evs[dd]) : null;
  if (fd && fd.includes(g.date)) parts.push("couldn't reach ESPN");
  return parts.join(' · ') + '.';
}
/* a finished game the state has no box score for: not read yet, or older than the box scores the state carries */
const boxWordS = g => S.box && S.box.from && g.date < S.box.from ? 'Box score no longer carried' : 'Box score not read yet';
const gpBoxOnS = g => !!(S.box && isO(S.box.games) && isO(S.box.games[g.id]));
function gpTrialS() {
  if (!S.props) return null;
  const Lg = isO(S.props.ledger) ? S.props.ledger : null, f4 = v => (+v).toFixed(4), n = v => (+v || 0).toLocaleString('en-US');
  const graded = Lg ? `${n(Lg.compared)} of ${n(Lg.of)} DraftKings main lines graded` : '', nums = Lg && isO(Lg.model) && isO(Lg.market) ? `; log loss: model ${f4(Lg.model.logloss)}, DraftKings ${f4(Lg.market.logloss)}` : '';
  if (Lg && Lg.decision === 'FAIL') return { cls: 'bad', t: 'props model: failed its trial', title: `The props model did not beat DraftKings' own prices: ${graded}${nums}.` };
  if (Lg && Lg.decision === 'PASS') return { cls: 'ok', t: 'props model: passed its trial', title: `${graded}${nums}.` };
  return { cls: 'warn', t: 'props model on trial', title: `Not yet shown to beat DraftKings' own prices.${graded ? ` ${graded}${nums}; the verdict comes at ${n(Lg.of)}.` : ''}` };
}
/* the head's three: the biggest projected points, shots on goal and saves; a final with no projection its box score's leaders */
function gpLeadS(g, rd, sc, started) {
  const people = [...gpPeopleS(g, rd).values()].filter(x => x.mine), top = st => people.filter(x => x.proj[st]).sort((a, b) => b.proj[st].mu - a.proj[st].mu || sStr(a.id, b.id))[0];
  const rows = [['pts', 'pts'], ['s', 'sog'], ['sv', 'sv']].map(([st, cat]) => { const x = top(st), act = x && sc.fin ? gpBoxS(g, x.id) : null, a = act && act[st] !== undefined ? act[st] : null;
    return x ? [cat, gpShortS(x.name), `${ppMuS(st, x.proj[st].mu)}${cat}${a !== null ? `${a}${cat}` : sc.fin ? '–' : ''}`] : null; }).filter(Boolean);
  if (rows.length || !sc.fin) return { lab: 'Biggest projections', rows, none: started ? 'No projections for this game' : 'No projections for this game yet' };
  const box = S.box && isO(S.box.games) && isO(S.box.games[g.id]) ? S.box.games[g.id] : null, PL = (S.players && S.players.players) || {}; if (!box) return { lab: 'Leaders', rows: [], none: boxWordS(g) };
  const best = (o, f) => Object.keys(o).map(id => [id, f(o[id])]).sort((a, b) => b[1] - a[1] || sStr(a[0], b[0]))[0], nm = id => PL[id] && PL[id].name ? PL[id].name : `ESPN athlete ${id}`;
  const L = [], sk = isO(box.s) ? box.s : {}, gk = isO(box.g) ? box.g : {};
  if (Object.keys(sk).length) { const [a, v] = best(sk, x => x[0] + x[1]); L.push(['pts', gpShortS(nm(a)), `${v}pts`]); const [b, w2] = best(sk, x => x[2]); L.push(['sog', gpShortS(nm(b)), `${w2}sog`]); }
  if (Object.keys(gk).length) { const [c, u] = best(gk, x => +x); L.push(['sv', gpShortS(nm(c)), `${u}sv`]); }
  return { lab: 'Leaders', rows: L, none: boxWordS(g) };
}
/* what is wrong with the game's page, opened from its card. o: lv (a read of the score this browser made), inB (the leg ids the
   builder should draw), failed (the days a press could not reach), noPlayers (the rows' order alone, no player opened), all */
function gpWrongs(w, g, ms, rd, o = {}) {
  const d = w.document, bad = [], ck = (ok, m) => { if (!ok) bad.push(m); }, MAP = o.MAP || pageMap(w);
  const card = betsOn(d, g), view = d.getElementById('gameView'), modal = d.getElementById('gameModal');
  if (!card) return [`the game's card did not open its page (${g.id})`];
  const sc = gpScoreS(g, o.lv || null), started = sStarted(g, ms), locked = started || (sc.st !== 'pre' && sc.st !== 'off'), future = g.state === 'pre' && Date.parse(g.start) > ms;
  const fin = !sc.off && (sc.fin || sc.st === 'final' || (!sc.live && locked && !future && ms >= Date.parse(g.start) + 4 * 3600000)), A = ab(g.away), H = ab(g.home), offW = sc.off ? (sc.off === 'cancelled' ? 'Cancelled' : 'Postponed') : null;
  const panel = modal.querySelector('.modal-panel');
  ck(panel.getAttribute('role') === 'dialog' && panel.getAttribute('aria-modal') === 'true' && panel.getAttribute('aria-labelledby') === 'gpTitle' && !!d.getElementById('gpTitle') && d.body.classList.contains('modal-open'), 'the page is a modal dialog named by its matchup, the page under it locked');
  /* the bar */
  const bar = view.firstElementChild, all = d.getElementById('allCb'), tp = d.getElementById('ppTrial'), TW = S.props && isO(S.props.games) && isO(S.props.games[g.id]) ? gpTrialS() : null;
  ck(!!bar && bar.classList.contains('bar') && bar.firstElementChild === d.getElementById('backBtn') && txt(d.getElementById('backBtn')) === '✕ Close' && !!all && all.type === 'checkbox' && txt(all.closest('label')) === 'All skaters' && !view.querySelector('select'), `the bar is Close, the trial's pill and All skaters; no Book's cut (${txt(bar)})`);
  ck(TW ? !!tp && txt(tp) === TW.t && tp.classList.contains('pill') && tp.classList.contains(TW.cls) && tp.title === TW.title : !tp, `the props model's trial is one pill on a page that shows a projection, the ledger's numbers on its title (${tp ? `${txt(tp)}: ${tp.title}` : 'none'}; want ${TW ? `${TW.t}: ${TW.title}` : 'none'})`);
  if (o.all !== undefined && all && all.checked !== o.all) all.click();
  const allOn = d.getElementById('allCb').checked, sr = d.getElementById('gameSearch');
  ck(!!sr && sr.type === 'search' && sr.placeholder === 'Find a player' && sr.getAttribute('aria-label') === 'Find a player in this game' && sr.closest('.gsearch') === view.children[1], 'Find a player under the bar');
  /* Refresh odds and the status line, or the strip */
  const rb = d.getElementById('ppRefreshOdds'), note = d.getElementById('ppOddsNote'), strip = view.querySelector('.gp-live'), msg = d.getElementById('ppMsg');
  ck(!!msg && msg.getAttribute('role') === 'status' && msg.getAttribute('aria-live') === 'polite' && view.lastElementChild === msg && view.querySelectorAll('.gp-msg').length === 1, 'the page has its one live status line (#ppMsg), the last thing on it: above no row, so its words move none');
  if (!locked) {
    const want = gpStatusS(g, rd, ms, o.failed, o.press !== undefined ? o.press : pressS(w), o.lv || null);
    ck(!!rb && rb.hasAttribute('data-odds') && txt(rb) === 'Refresh odds' && rb.getAttribute('aria-describedby') === 'ppOddsNote' && rb.getAttribute('aria-busy') === 'false' && !!note && note.getAttribute('role') === 'status' && !strip, 'a game to come has Refresh odds and its status line, no strip');
    ck(!!note && txt(note) === want, `the status line is this game's state ("${want}": "${note ? txt(note) : ''}")`);
  } else {
    const ot = /\/(OT|SO)/.exec(sc.detail), want = sc.off ? `${offW} at ESPN.` : sc.fin ? `Final${ot ? ` (${ot[1]})` : ''}: ${A} ${sc.as}, ${H} ${sc.hs}.` : sc.live ? `${A} ${sc.as}, ${H} ${sc.hs} · ${sc.detail}.` : future ? 'Start moved · call kept.' : fin ? 'Final.' : 'In progress.';
    ck(!rb && !note && !!strip && txt(strip.querySelector('b')) === want && strip.classList.contains('fin') === fin && !!strip.querySelector('#gameScoresNow') === !sc.fin, `once the puck has dropped the strip says the score, Refresh scores until it is final, and Refresh odds is gone ("${want}": "${strip ? txt(strip) : ''}")`);
    if (sc.live && !o.lv) ck(!!strip && /as of /.test(txt(strip)), 'a live score the job published says when it was read');
    ck(!view.querySelector('input[data-leg], input[data-pp-add]'), 'no bet can be ticked once the puck has dropped');
  }
  /* the head */
  const hd = view.querySelector('.ghead'), cells = hd ? [...hd.querySelector('.gh-grid').children] : [];
  const L3 = gpLeadS(g, rd, sc, locked), labs = cells.map(c => txt(c.querySelector('.gh-lab')));
  ck(cells.length === 6 && eqA(labs, ['Puck drop', 'Matchup', L3.lab, 'Expected score', 'Total', 'Model pick']), `the head's six cells (${labs.join(' | ')})`);
  if (cells.length === 6) {
    const ot = /\/(OT|SO)/.exec(sc.detail), day = gpDayS(g.start), wb = cells[0].querySelector('.when');
    const whenW = sc.off ? (started ? offW.toUpperCase() : `${clockOf(Date.parse(g.start))}${sc.off} at ESPN`) : sc.fin || sc.st === 'final' ? `FINAL${ot ? ' · ' + ot[1] : ''}` : sc.live ? `${A} ${sc.as}–${sc.hs} ${H}${sc.detail}` : future && started ? `${clockOf(Date.parse(g.start))}start moved · call kept` : locked ? 'LIVE' : clockOf(Date.parse(g.start));
    ck(txt(wb.querySelector('b')) === day && txt(wb).slice(day.length).trim() === whenW.trim(), `the puck drop cell: the day and the time on the visitor's clock, or where the game stands ("${day}" + "${whenW}": "${txt(wb)}")`);
    const tags = [...cells[1].querySelectorAll('h2 .ttag')], won = sc.fin && sc.hs !== sc.as ? (sc.hs > sc.as ? g.home : g.away) : null, wk = [...cells[1].querySelectorAll('.wck')];
    ck(tags.length === 2 && txt(tags[0]) === A && txt(tags[1]) === H && !tagWrong(tags[0], MAP[g.away]) && !tagWrong(tags[1], MAP[g.home]) && txt(cells[1].querySelector('.at')) === (g.neutral ? 'vs' : 'at'), `the matchup: the two clubs' tags in their colours, "${g.neutral ? 'vs' : 'at'}" between them (${txt(cells[1])})`);
    ck(wk.length === (won ? 1 : 0) && (!won || wk[0].previousElementSibling === tags[won === g.away ? 0 : 1]), `a tick on the winner's tag alone, once final (${wk.length})`);
    const noteW = [g.note, g.neutral ? 'neutral ice' : ''].filter(Boolean).join(' · '), nt = cells[1].querySelector('.gh-note');
    ck(noteW ? !!nt && txt(nt) === noteW : !nt, `the game's note and neutral ice under the tags ("${noteW}": "${nt ? txt(nt) : ''}")`);
    const lr = [...cells[2].querySelectorAll('.lead > div')].map(r => [txt(r.querySelector('.cat')), txt(r.querySelector('.nm')), txt(r.querySelector('.v'))]);
    ck(L3.rows.length ? eqA(lr, L3.rows) : !lr.length && txt(cells[2].querySelector('.lead')) === L3.none, `the head's three (${L3.lab}: ${JSON.stringify(L3.rows)}; drawn ${JSON.stringify(lr)} ${txt(cells[2].querySelector('.lead')).slice(0, 40)})`);
    const XG = Number.isFinite(g.xt) && Number.isFinite(g.mu), xa = Math.max(0.3, (g.xt - g.mu) / 2).toFixed(1), xh = Math.max(0.3, (g.xt + g.mu) / 2).toFixed(1);
    const totW = `${XG ? `${xa} – ${xh}` : '–'}${A} / ${H}${sc.fin ? `(actual ${sc.as} – ${sc.hs})` : sc.live ? `live ${sc.as} – ${sc.hs}` : ''}`, totH = txt(cells[3]).slice('Expected score'.length);
    ck(totH === totW, `the expected score: the goals layer's two rates to a tenth, away first ("${totW}": "${totH}")`);
    const tpW = `${XG ? g.xt.toFixed(1) : '–'}goals${sc.fin ? `(actual ${sc.as + sc.hs})` : ''}`;
    ck(txt(cells[4]).slice('Total'.length) === tpW, `the total: the model's expected goals ("${tpW}": "${txt(cells[4])}")`);
    /* the pick and its chance as the list writes them (slCallS: one rounding everywhere); none where the state has no call */
    const CW = slCallS(g), pickId = CW ? CW.pick : null, pt = cells[5].querySelector('.ttag'), acts = [...cells[5].querySelectorAll('small')];
    const actW = won && CW ? `${won === pickId ? '✓' : '✗'} ${ab(won)} by ${Math.abs(sc.hs - sc.as)}` : null;
    if (!CW) ck(!pt && txt(cells[5]) === 'Model pickno call yet', `with no call the head says so (${txt(cells[5])})`);
    else ck(!!pt && txt(pt) === ab(pickId) && !tagWrong(pt, MAP[pickId]) && txt(acts[0]) === `${CW.conf}%` && (actW ? acts.length === 2 && txt(acts[1]) === actW && acts[1].classList.contains(won === pickId ? 'right' : 'wrong') : acts.length === 1), `the model's pick: the state's call and its chance as the list writes it, right or wrong once final (${ab(pickId)} ${CW.conf}% ${actW || ''}: ${txt(cells[5])})`);
  }
  /* the windows' buttons */
  const wins = [...view.querySelectorAll('.gwin [data-gp-pop]')];
  ck(eqA(wins.map(b => `${b.dataset.gpPop}:${txt(b)}`), ['units:Matchup', 'lineups:Lineups', 'stats:Team Stats']) && wins.every(b => b.tagName === 'BUTTON' && b.getAttribute('aria-haspopup') === 'dialog') && hd && hd.nextElementSibling === view.querySelector('.gwin'), `three buttons under the head: Matchup, Lineups, Team Stats (${wins.map(txt).join(', ')})`);
  /* Game bets */
  const BW = gpBetsS(g, sc, locked, o.inB || new Set()), blocks = [...card.querySelectorAll('.statblk')];
  ck(txt(card.querySelector('h2')) === 'Game bets' && (BW.src ? txt(card.querySelector('.gp-src')) === BW.src : !card.querySelector('.gp-src')) && (BW.why ? txt(card.querySelector('.gp-why')) === BW.why : !card.querySelector('.gp-why')), `Game bets says where its lines were read and why it has none or offers none ("${BW.src}", "${BW.why}": ${txt(card.querySelector('.gp-src'))} | ${txt(card.querySelector('.gp-why'))})`);
  ck(eqA(blocks.map(b => b.dataset.gb), BW.blocks.map(b => b.key)), `its blocks: each club, then the total where the line has one (${blocks.map(b => b.dataset.gb).join(', ')}; want ${BW.blocks.map(b => b.key).join(', ')})`);
  BW.blocks.forEach((bw, i) => {
    const el = blocks[i]; if (!el || el.dataset.gb !== bw.key) return;
    const h4 = el.querySelector('h4'), ems = [...h4.querySelectorAll('em')].map(txt), tg = h4.querySelector('.ttag'), rows = [...el.querySelectorAll('table.rungs tr')];
    ck(eqA(ems, bw.ems) && txt(h4).startsWith(bw.head) && (bw.tag ? !!tg && !tagWrong(tg, MAP[bw.tag]) : !tg), `Game bets, ${bw.key}: its heading (${bw.head} ${bw.ems.join(' | ')}: ${txt(h4)})`);
    ck(rows.length === bw.rows.length, `Game bets, ${bw.key}: ${bw.rows.length} rows (${rows.length})`);
    rows.forEach((tr, j) => { if (!bw.rows[j]) return; const df = gpDiff(gpRowS(tr), bw.rows[j]); ck(!df.length, `Game bets, ${bw.key}, ${bw.rows[j].label}: ${df.slice(0, 3).join('; ')}`); });
  });
  /* the clubs and their players */
  const R = gpRosterS(g, rd, allOn, sc, started), kids = [...view.children], PT = (S.players && S.players.teams) || {};
  const heads = kids.filter(k => k.classList.contains('teamhdr'));
  const wantHeads = [g.away, g.home].concat(R.other.length ? [''] : []);
  ck(eqA(heads.map(h => h.dataset.team), wantHeads), `a head a club, away first${R.other.length ? ', then Other players' : ''} (${heads.map(h => h.dataset.team).join(', ')})`);
  let opened = 0, rowsN = 0; const toOpen = [];
  ['away', 'home'].forEach((side, si) => {
    const t = R[side], hdr = heads[si]; if (!hdr || hdr.dataset.team !== t.club) return;
    const under = []; for (let n = hdr.nextElementSibling; n && !n.classList.contains('teamhdr'); n = n.nextElementSibling) under.push(n);
    const opp = ab(g[side === 'home' ? 'away' : 'home']), htag = hdr.querySelector('.ttag');
    ck(!!htag && txt(htag) === ab(t.club) && !tagWrong(htag, MAP[t.club]) && txt(hdr) === `${ab(t.club)} ${sh(t.club)} ${fin ? 'played' : 'playing'} ${opp}` && txt(hdr.querySelector('.pill')) === `${fin ? 'played' : 'playing'} ${opp}`, `${t.club}: its head, its tag, its name and who it ${fin ? 'played' : 'is playing'} (${txt(hdr)})`);
    const outs = t.pm && Array.isArray(t.pm.out) ? t.pm.out : [], outEl = under.find(n => n.matches('[data-gp-out]')), boxEl = under.find(n => n.matches('[data-gp-box]'));
    const outW = !locked && outs.length ? `Out: ${outs.map(x => `${x.name} (${[x.pos, String(x.status || 'Out').toLowerCase()].filter(Boolean).join(', ')})`).join(', ')}.` : null;
    ck(outW ? !!outEl && txt(outEl) === outW && eqA([...outEl.querySelectorAll('b')].map(txt), outs.map(x => x.name)) : !outEl, `${t.club}: "Out:" is exactly the injury report's outs for the club, in its order, while the game is to come ("${outW}": "${outEl ? txt(outEl) : ''}")`);
    const boxW = !locked && t.pm && t.pm.lastBox && t.pm.lastFinal && t.pm.lastFinal > t.pm.lastBox ? `Lineup from ${t.pm.lastBox}: the box score of ${t.pm.lastFinal} not read yet.` : null;
    ck(boxW ? !!boxEl && txt(boxEl) === boxW : !boxEl, `${t.club}: a lineup built before its last box score was read says so ("${boxW}": "${boxEl ? txt(boxEl) : ''}")`);
    const rows = under.filter(n => n.classList.contains('plrbtn')), empty = under.find(n => n.classList.contains('empty')), noBox = under.find(n => n.matches('[data-gp-nobox]'));
    /* a finished game the state has no box score for says so under each club that lists anybody: the rows under it are projections still */
    const nbW = fin && !gpBoxOnS(g) && t.players.length ? boxWordS(g) + '.' : null;
    ck(nbW ? !!noBox && txt(noBox) === nbW && noBox.dataset.gpNobox === t.club : !noBox, `${t.club}: a finished game with no box score in the state says so over its rows, and only then ("${nbW}": "${noBox ? txt(noBox) : ''}")`);
    if (!t.players.length) { const ew = !locked ? 'No players to project.' : fin ? boxWordS(g) + '.' : 'Under way: the box score comes after the final.'; ck(!rows.length && !!empty && txt(empty) === ew, `${t.club}: with nobody to list the club says why ("${ew}": "${empty ? txt(empty) : rows.length + ' rows'}")`); return; }
    ck(eqA(rows.map(r => r.dataset.open || r.dataset.nohist), t.players.map(x => x.id)) && !empty, `${t.club}: its rows in order, the goalie, the forwards and the defencemen by expected ice time${allOn ? '' : `, ${GP_CUT_F} and ${GP_CUT_D} before All skaters`} (${rows.length} rows, want ${t.players.length}: ${rows.map(r => r.dataset.open || r.dataset.nohist).join(',').slice(0, 90)} | ${t.players.map(x => x.id).join(',').slice(0, 90)})`);
    t.players.forEach((x, i) => {
      const r = rows[i]; if (!r || (r.dataset.open || r.dataset.nohist) !== x.id) return; rowsN++;
      /* he "did not play" only on the word of a box score the state carries: a final with none keeps his projection */
      const nProj = Object.keys(x.proj).length, boxed = sc.fin && gpBoxOnS(g), act = boxed ? gpBoxS(g, x.id) : null, hasBody = locked ? (boxed && !!act) || nProj > 0 : nProj > 0 || x.dk, role = gpRoleS(x);
      const who = r.querySelector('.who'), nmEl = [...who.childNodes].find(c => c.nodeType === 3 && c.textContent.trim()), inj = who.querySelector('.inj'), chip = who.querySelector('.stbtn'), rs = [...who.children].find(c => !c.classList.contains('inj') && !c.classList.contains('stbtn'));
      const nmW = x.name || `ESPN athlete ${x.id}`;
      ck((r.tagName === 'BUTTON') === hasBody && (hasBody ? r.dataset.open === x.id && r.hasAttribute('aria-expanded') : r.dataset.nohist === x.id), `${nmW}: a row that opens exactly where he has something under it`);
      ck(!!nmEl && nmEl.textContent.trim() === nmW && !!rs && txt(rs) === role.t && (rs.getAttribute('title') || '') === role.title, `${nmW}: his name and his role ("${role.t}", title "${role.title}": "${txt(who)}")`);
      ck(!!inj === (!locked && x.dtd) && (!inj || (txt(inj) === 'DTD' && /^Day to day/.test(inj.title))), `${nmW}: a DTD chip exactly where the report has him day to day and the game is to come`);
      ck(hasBody ? !!chip && chip.getAttribute('role') === 'button' && chip.getAttribute('tabindex') === '0' && chip.dataset.stats === x.id && txt(chip) === (chip.getAttribute('aria-pressed') === 'true' ? 'Hide stats' : 'Show stats') : !chip, `${nmW}: Show stats on a row that opens`);
      const sum = r.querySelector('.sum'), fc = sum.querySelector('.finchip');
      const figs = boxed && !act ? 'did not play' : ((GP_HEAD_S[x.grp] || []).filter(st => act ? act[st] !== undefined : x.proj[st]).map(st => act ? `${act[st]} ${GP_SHORT_S[st]}${x.proj[st] ? ` (proj ${ppMuS(st, x.proj[st].mu)})` : ''}` : `${ppMuS(st, x.proj[st].mu)} ${GP_SHORT_S[st]}`).join(' · ') || 'No projection yet');
      const sumW = !hasBody ? (boxed ? 'did not play' : locked ? 'No projection' : 'No lines yet') : `${locked && !sc.off ? (fin ? 'FINAL' : 'LIVE') : ''}${locked && !boxed && nProj ? 'projected ' : ''}${figs}`;
      ck(txt(sum) === sumW && !!fc === (hasBody && locked && !sc.off), `${nmW}: his figures ("${sumW}": "${txt(sum)}")`);
      if (hasBody && !o.noPlayers) toOpen.push({ x, nmW, act, boxed });
    });
  });
  /* each player opened in turn (a tap draws the page again, so his row is found afresh): one open at a time, his lines under his row */
  for (const { x, nmW, act, boxed } of toOpen) {
    {
      const r = [...view.querySelectorAll('.plrbtn[data-open]')].find(z => z.dataset.open === x.id); if (!r) { bad.push(`${nmW}: his row is gone`); continue; }
      r.click(); opened++;
      const r2 = [...view.querySelectorAll('.plrbtn[data-open]')].find(z => z.dataset.open === x.id), body = r2 && r2.nextElementSibling && r2.nextElementSibling.classList.contains('wkstats') ? r2.nextElementSibling.nextElementSibling : r2 && r2.nextElementSibling;
      const openN = view.querySelectorAll('.plrbtn[aria-expanded="true"]').length;
      if (!r2 || r2.getAttribute('aria-expanded') !== 'true' || openN !== 1 || !body || !body.classList.contains('plrbody') || view.querySelectorAll('.plrbody').length !== 1) { bad.push(`${nmW}: a tap opens him alone, his lines under his row (${openN} open)`); continue; }
      if (locked) {
        const tiles = [...body.querySelectorAll('.tile')], tw = (GP_STATS_S[x.grp] || []).filter(st => x.proj[st] || (act && act[st] !== undefined)).map(st => { const av = act && act[st] !== undefined ? act[st] : null, D = x.proj[st], df = av === null || !D ? null : av - D.mu; return `${GP_LBL_S[st]}${av === null ? '–' : av}${D ? `proj ${ppMuS(st, D.mu)}${df === null ? '' : ` · ${df >= 0 ? '+' : '-'}${Math.abs(df).toFixed(1)}`}` : ''}`; });
        const nl = body.querySelector('.noline'), nlW = boxed && !act ? 'Did not play: legs void.' : sc.fin && !boxed ? boxWordS(g) + '.' : null;
        ck(eqA(tiles.map(txt), tw) && !body.querySelector('input'), `${nmW}: once the puck has dropped, a tile a stat, what he did beside what was projected, no bet (${tiles.map(txt).join(' | ')}; want ${tw.join(' | ')})`);
        ck(nlW ? !!nl && txt(nl) === nlW : !nl, `${nmW}: "Did not play: legs void." only where the state's box score of the game lacks him; a final with no box score says that instead ("${nlW}": "${nl ? txt(nl) : ''}")`);
        continue;
      }
      const BL = gpBodyS(x, g, o.inB, !!(rd && rd.status === 200)), bls = [...body.querySelectorAll('.statblk')];
      ck(eqA(bls.map(b => b.dataset.ppStat), BL.map(b => b.stat)), `${nmW}: a block a stat of his group that has a projection or a price (${bls.map(b => b.dataset.ppStat).join(',')}; want ${BL.map(b => b.stat).join(',')})`);
      BL.forEach((bw, bi) => {
        const el = bls[bi]; if (!el || el.dataset.ppStat !== bw.stat) return;
        const h4 = el.querySelector('h4'), ems = [...h4.querySelectorAll('em')].map(txt), trs = [...el.querySelectorAll('table.rungs tr')], nl = el.querySelector('[data-noline]');
        ck(txt(h4).startsWith(bw.head) && eqA(ems, bw.ems), `${nmW}, ${bw.stat}: the heading's projection and line (${bw.ems.join(' | ')}: ${txt(h4)})`);
        ck(bw.none ? !!nl && txt(nl) === 'No DraftKings line yet.' && !trs.length : !nl && trs.length === bw.rows.length, `${nmW}, ${bw.stat}: ${bw.none ? 'no line, said' : `${bw.rows.length} rows, the main line's two then each milestone`} (${trs.length} rows)`);
        trs.forEach((tr, j) => { if (!bw.rows[j]) return; const df = gpDiff(gpRowS(tr), bw.rows[j]); ck(!df.length, `${nmW}, ${bw.stat}, ${bw.rows[j].label}: ${df.slice(0, 3).join('; ')}`); });
      });
    }
  }
  if (R.other.length) { const hdr = [...view.querySelectorAll('.teamhdr')][2], rows = []; for (let n = hdr && hdr.nextElementSibling; n; n = n.nextElementSibling) if (n.id !== 'ppMsg') rows.push(n);
    ck(!!hdr && txt(hdr) === 'Other players' && eqA(rows.map(r => r.dataset.nohist), R.other.map(x => x.id)) && rows.every(r => r.tagName === 'DIV' && /not matched to either club/.test(txt(r)) && !r.querySelector('input')), `a player DraftKings prices whom no table puts on either club is listed last, not offered (${rows.length}, want ${R.other.length})`); }
  /* no description, and no word of an edge on a player's line */
  const long = [...view.querySelectorAll('p, small')].filter(el => txt(el).length > 90 && !el.matches('.gp-out, .gp-msg'));
  ck(!long.length && !/How these numbers|Tap a |model says/i.test(txt(view)) && ![...view.querySelectorAll('.plrbody, .plrbtn')].some(el => /\bedge\b|Value/i.test(txt(el))) && !view.querySelector('details, .pp-key, .pb-key, .pp-how'), `no description on the page, and nothing on a player's line says "edge", "Value" or "model says" (${long.map(el => txt(el).slice(0, 50)).join(' | ')})`);
  bad.opened = opened; bad.rows = rowsN;
  return bad;
}
/* the three little windows of a game, each worked out here: what is wrong with them. The game's page must be open on the game */
function gpWindowWrongs(w, g, ms) {
  const d = w.document, bad = [], ck = (ok, m) => { if (!ok) bad.push(m); }, MAP = pageMap(w), md = d.getElementById('gsModal'), A = ab(g.away), H = ab(g.home);
  const PT = (S.players && S.players.teams) || {}, num = v => typeof v === 'number' && isFinite(v);
  const open = kind => { const b = d.querySelector(`#gameView [data-gp-pop="${kind}"]`); if (!b) return null; b.click(); return md.hidden ? null : b; };
  const close = () => { if (!md.hidden) d.getElementById('gsClose').click(); };
  const title = kind => `${A}${g.neutral ? 'vs' : 'at'}${H}${kind} · ${gpDayS(g.start)}`;
  const shell = (kind, name) => { const p = md.querySelector('.modal-panel'), sec = md.querySelector('.gs-sec');
    ck(md.classList.contains('gs-one') && md.dataset.gsOnly === kind && p.getAttribute('role') === 'dialog' && p.getAttribute('aria-modal') === 'true' && p.getAttribute('aria-labelledby') === 'gsTitle' && txt(d.getElementById('gsTitle')) === title(name) && w.document.activeElement === d.getElementById('gsClose') && !!sec && sec.dataset.gsOnly === kind && !d.getElementById('gameModal').hidden,
      `${name}: a dialog over the game's page, titled by the game and the day, its Close holding the focus (${txt(d.getElementById('gsTitle'))})`); };
  /* Matchup */
  if (open('units')) {
    shell('units', 'Matchup');
    const clubs = Object.keys(PT).filter(c => isO(PT[c]) && num(PT[c].offence) && num(PT[c].defence)), pm = side => isO(g.pm) && isO(g.pm[side]) ? g.pm[side] : null;
    const gk = (c, side) => { const k = side && pm(side) && isO(pm(side).goalie) ? pm(side).goalie : PT[c].goalie; return isO(k) && num(k.gk) ? k.gk : 0; };
    const units = [...md.querySelectorAll('.gs-unit')];
    if (clubs.includes(g.away) && clubs.includes(g.home)) {
      const offs = clubs.map(c => PT[c].offence), defs = clubs.map(c => PT[c].defence + gk(c)), sd = a => { const m = a.reduce((s, v) => s + v, 0) / a.length; return Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / a.length); };
      const spread = Math.sqrt(sd(offs) ** 2 + sd(defs) ** 2) || 1, rank = (a, v) => 1 + a.filter(x => x > v + 1e-12).length;
      const band = z => z >= 1.5 ? 'Easy' : z >= 0.5 ? 'Favorable' : z > -0.5 ? 'Even' : z > -1.5 ? 'Tough' : 'Very tough';
      ck(units.length === 2, `Matchup: two blocks, each club's attack (${units.length})`);
      [['away', 'home'], ['home', 'away']].forEach(([att, def], i) => {
        const u = units[i]; if (!u) return;
        const o1 = PT[g[att]].offence, d1 = PT[g[def]].defence + gk(g[def], def), e = o1 - d1, ro = rank(offs, o1), rd2 = rank(defs, d1), boxes = [...u.querySelectorAll('.gs-ubox')];
        const want = [`${ab(g[att])} attack${gpOrdS(ro)} of ${clubs.length}${gpSgnS(o1, 2)}goals a game`, `${ab(g[def])} defence + goalie${gpOrdS(rd2)} of ${clubs.length}${gpSgnS(d1, 2)}goals a game`];
        ck(u.dataset.gsPoss === `${g[att]}-${g[def]}` && txt(u.querySelector('h4')) === `${sh(g[att])} attack` && txt(u.querySelector('.dtag')) === band(e / spread) && !!u.querySelector('.dtag').title && txt(u.querySelector('.gs-hpts')) === `${gpSgnS(e, 2)} goals`, `Matchup, ${g[att]}'s attack: the gap between it and the defence and goalie it meets, tagged by the league's spread (${band(e / spread)} ${gpSgnS(e, 2)}: ${txt(u.querySelector('.gs-uhd'))})`);
        ck(eqA(boxes.map(b => txt(b).replace(/\s+/g, '')), want.map(x => x.replace(/\s+/g, ''))) && boxes.length === 2 && boxes[0].classList.contains('gs-better') === (ro < rd2) && boxes[1].classList.contains('gs-better') === (rd2 < ro), `Matchup, ${g[att]}'s attack: each side's rank of ${clubs.length} and its goals a game, the better rank washed (${boxes.map(txt).join(' | ')}; want ${want.join(' | ')})`);
      });
    } else ck(!units.length, 'Matchup: no attack blocks where the player model has no parts for a club');
    const prev = c => { let p = null; for (const x of S.games) if (x !== g && x.id !== g.id && (x.home === c || x.away === c) && x.date < g.date && (p === null || x.date > p)) p = x.date; return p === null ? null : Math.round((Date.parse(g.date + 'T12:00:00Z') - Date.parse(p + 'T12:00:00Z')) / 86400000) - 1; };
    const restT = r => r === null ? '–' : r <= 0 ? 'back to back' : `${r} day${r === 1 ? '' : 's'}`, fig = v => num(v) ? gpSgnS(v, 2) : '–', last = n => String(n || '').split(' ').slice(1).join(' ') || String(n || '');
    const ga = pm('away') && isO(pm('away').goalie) ? pm('away').goalie : null, gh = pm('home') && isO(pm('home').goalie) ? pm('home').goalie : null, sa = pm('away') ? pm('away').strength : null, shh = pm('home') ? pm('home').strength : null, ra = prev(g.away), rh = prev(g.home);
    const rowsW = [].concat(ga || gh ? [['goal', 'In goal', fig(ga ? ga.gk : null), fig(gh ? gh.gk : null), ga ? ga.gk : null, gh ? gh.gk : null, `${ga ? last(ga.name) : '–'} · ${gh ? last(gh.name) : '–'}`]] : [],
      num(sa) || num(shh) ? [['strength', 'Strength', fig(sa), fig(shh), sa, shh, 'goals a game']] : [], num(g.ra) && num(g.rh) ? [['elo', 'Team Elo', String(Math.round(g.ra)), String(Math.round(g.rh)), g.ra, g.rh, '']] : [], [['rest', 'Rest', restT(ra), restT(rh), ra, rh, '']]);
    const rowsH = [...md.querySelectorAll('.ddrow[data-gs-row]')];
    ck(eqA(rowsH.map(r => r.dataset.gsRow), rowsW.map(r => r[0])), `Matchup, the clubs: in goal, strength, the team Elo, rest (${rowsH.map(r => r.dataset.gsRow).join(', ')})`);
    rowsW.forEach((rw, i) => { const r = rowsH[i]; if (!r || r.dataset.gsRow !== rw[0]) return; const el = [...r.querySelectorAll('.ddelo')], sn = [...r.querySelectorAll('.ddsn')].map(txt), both = num(rw[4]) && num(rw[5]);
      ck(txt(r.querySelector('.ddunit')) === rw[1] && eqA(sn, [A, H]) && eqA(el.map(txt), [rw[2], rw[3]]) && el[0].classList.contains('gs-better') === (both && rw[4] > rw[5]) && el[1].classList.contains('gs-better') === (both && rw[5] > rw[4]) && txt(r.querySelector('.ddend')) === rw[6], `Matchup, ${rw[1]}: ${A} ${rw[2]} · ${H} ${rw[3]} ${rw[6]}, the higher marked (${txt(r)})`); });
    /* the models: the Pick'em Record's reading of the same game (sPkPick, sPkModel), each model's side and its chance */
    const dkp = sPkLined(g.line) ? sImp(+g.line.homeML) / (sImp(+g.line.homeML) + sImp(+g.line.awayML)) : null, mk = id => { const x = sPkModel(g, id, S); return x && num(x.c.pHome) ? x.c.pHome : null; }, bt = id => { const x = sPkModel(g, id, S); return !!(x && x.bt); };
    /* Alpha, the Joker and the ELO Model: the call frozen with the game's own, else, for a final from before they existed, its backtest, said on the row */
    const MW = [['The call', g.pHome, 'call'], ['Team Elo', g.by === 'players' && isO(g.elo) && num(g.elo.pHome) ? g.elo.pHome : g.pHome, 'elo'], ['Alpha', mk('alpha'), 'alpha', bt('alpha')], ['The Joker', mk('joker'), 'joker', bt('joker')], ['ELO Model', mk('elom'), 'elom', bt('elom')], ['DraftKings', dkp, 'dk']].filter(r => num(r[1]));
    const MH = [...md.querySelectorAll('.ddrow[data-gs-model]')].map(r => [r.dataset.gsModel, txt(r.querySelector('.ttag')), txt(r.querySelector('.ddelo')), txt(r.querySelector('.ddend'))]);
    const CWm = slCallS(g);      /* the call's own row reads as the list and the page write it */
    ck(eqA(MH, MW.map(([n, p, id, b]) => id === 'call' && CWm ? [n, ab(CWm.pick), `${CWm.conf}%`, ''] : [n, ab(p >= 0.5 ? g.home : g.away), PBS.pctW(Math.max(p, 1 - p)), b ? 'backtest' : ''])), `Matchup, the models: each model's pick and its chance, the call first, DraftKings last where the game has both moneylines (${JSON.stringify(MH)})`);
    /* each row's side is the Pick'em tab's own pick of the model on this game (but a call whose stored pick parts from its chance, which the tab reads off `pick`) */
    for (const [n, p, id] of MW) { const pk = sPkPick(g, id), side = p >= 0.5 ? 'home' : 'away'; if (id !== 'call' && pk) ck(pk === side, `Matchup, ${n}: its side is the Pick'em Record's pick for the game (${side}, ${pk})`); }
    ck(!md.querySelector('p') || [...md.querySelectorAll('p')].every(p => txt(p).length <= 90), 'Matchup: no description');
    close();
  } else ck(false, 'the Matchup window did not open');
  /* Lineups */
  if (open('lineups')) {
    shell('lineups', 'Lineups');
    const ok = isO(g.pm) && isO(g.pm.away) && isO(g.pm.home) && isO(PT[g.away]) && isO(PT[g.home]);
    if (!ok) ck(txt(md.querySelector('.gs-msg')) === 'No lineup for this game yet.' && !md.querySelector('.lu-club'), `Lineups: with no lineup in the state it says so (${txt(md.querySelector('.gs-secbody'))})`);
    else {
      /* once the puck has dropped the window shows what the call was frozen on (its goalie, its strength, who was out), never today's skaters and parts */
      const cols = [...md.querySelectorAll('.lu-club')], lockedL = sStarted(g, ms) || g.state !== 'pre';
      ck(eqA(cols.map(c => c.dataset.luClub), [g.away, g.home]), `Lineups: a column a club, away first (${cols.map(c => c.dataset.luClub).join(', ')})`);
      ['away', 'home'].forEach((side, i) => {
        const c = cols[i]; if (!c) return;
        const code = g[side], t = PT[code], pmS = g.pm[side], gkp = isO(pmS.goalie) ? pmS.goalie : null, lu = !lockedL && Array.isArray(t.lineup) ? t.lineup : [];
        const inW = (gkp ? [[gkp.name, 'G', v2S(gkp.gk)]] : []).concat(lu.slice(0, 9).map(p => [p.name, `${Math.round(p.share * 60)}'`, v2S(p.v)]));
        const inH = [...c.querySelectorAll('.lu-in li')].map(li => [txt(li.children[0]), txt(li.children[1]), txt(li.children[2]), li.children[2].className.replace(/^v\s*/, '')]);
        ck(txt(c.querySelector('.gs-thn')) === `${ab(code)}${sh(code)}` && eqA(inH, inW.map(x => [x[0], x[1], x[2].t, x[2].c])), `Lineups, ${code}: its goalie and its nine skaters with the most ice time, minutes and goals a game, signed and coloured by the sign (${inH.length} rows, want ${inW.length})`);
        /* the strength the state's own to the hundredth, its three parts as shown adding up to it, each within a hundredth of its own value */
        const st = c.querySelector('.lu-str'), tot = Math.sign(pmS.strength) * Math.round(Math.abs(pmS.strength) * 100) / 100, m = (lockedL ? /Strength ([+-]?\d+\.\d\d)$/ : /Strength ([+-]?\d+\.\d\d): attack ([+-]?\d+\.\d\d) · defence ([+-]?\d+\.\d\d) · goalie ([+-]?\d+\.\d\d)$/).exec(txt(st));
        const parts = [t.offence, t.defence, gkp ? gkp.gk : 0];
        ck(!!m && Math.abs(+m[1] - tot) < 1e-9 && (lockedL || (Math.abs(+m[2] + +m[3] + +m[4] - +m[1]) < 1e-9 && [2, 3, 4].every(k => Math.abs(+m[k] - parts[k - 2]) <= 0.01 + 1e-9))), `Lineups, ${code}: the strength the state's own to the hundredth, its parts adding up to it, each within a hundredth of its own value (${txt(st)}; ${tot}: ${parts.join(', ')})`);
        ck(gkp ? txt(st).startsWith(`In goal ${gkp.name}, ${gkp.how}${gkp.debut ? ', first NHL start' : ''} · Strength `) : txt(st).startsWith('Strength '), `Lineups, ${code}: led by the goalie and how he was chosen (${txt(st).slice(0, 80)})`);
        const outs = (Array.isArray(pmS.out) ? pmS.out : []).map((x, k) => [x, k]).sort((a, b) => ((typeof b[0].cost === 'number' ? Math.abs(b[0].cost) : -1) - (typeof a[0].cost === 'number' ? Math.abs(a[0].cost) : -1)) || a[1] - b[1]).map(x => x[0]);
        const outH = [...c.querySelectorAll('.lu-out li')].map(li => [txt(li.children[0]), txt(li.children[1])]), outW = outs.map(x => [`${x.name} ${x.status || 'Out'}`, typeof x.cost === 'number' ? v2S(x.cost).t : '–']);
        ck(eqA(outH, outW) && (outs.length ? [...c.querySelectorAll('.gs-lab')].some(l => txt(l) === 'Out') : !c.querySelector('.lu-out')) && [...c.querySelectorAll('.lu-out li > span:first-child > span')].every(s => s.classList.contains('nw')), `Lineups, ${code}: everyone the report has out, his status and what he adds, most valuable first, each name and status whole (${JSON.stringify(outH).slice(0, 160)}; want ${JSON.stringify(outW).slice(0, 160)})`);
        const dtd = Array.isArray(pmS.dtd) ? pmS.dtd : [], dd = c.querySelector('.lu-day');
        ck(dtd.length ? !!dd && txt(dd) === `Day to day, in the lineup: ${dtd.map(x => x.name).join(', ')}` : !dd, `Lineups, ${code}: its day to day by name (${dd ? txt(dd) : 'none'})`);
      });
      const src = md.querySelector('.lu-src'), srcW = `${g.pm.inj ? `Injury report of ${gpDateClockS(g.pm.inj)}` : 'No injury report applied'} · the ${g.by === 'players' ? "player model's" : "team Elo's"} call.`;
      ck(!!src && txt(src) === srcW && !md.querySelector('button:not(#gsClose)'), `Lineups: its foot names the injury report the lineup stands on and whose call it is; no button in it but Close ("${srcW}": "${src ? txt(src) : ''}")`);
    }
    close();
  } else ck(false, 'the Lineups window did not open');
  /* Team Stats */
  if (open('stats')) {
    shell('stats', 'Team Stats');
    const TA = isO(S.teams[g.away]) ? S.teams[g.away] : {}, TH = isO(S.teams[g.home]) ? S.teams[g.home] : {}, po = c => S.playoff && isO(S.playoff.odds) && isO(S.playoff.odds[c]) && num(S.playoff.odds[c].playoff) ? Math.round(1000 * S.playoff.odds[c].playoff) / 10 : null;
    const SR = [['ptp', 'Points percentage', t => t.gp ? Math.round(1000 * t.pts / (2 * t.gp)) / 10 : null, 0, 0, 1], ['gd', 'Goal differentialper game', t => t.gp ? Math.round(100 * (t.gf - t.ga) / t.gp) / 100 : null, 0, 1, 0], ['gf', 'Goals per game', t => t.gfRate, 0, 0, 0], ['ga', 'Goals allowedper game', t => t.gaRate, 1, 0, 0],
      ['sf', 'Shots per game', t => t.sf, 0, 0, 0], ['sa', 'Shots allowedper game', t => t.sa, 1, 0, 0], ['rw', 'Regulation wins', t => t.rw, 0, 0, 0], ['po', 'Playoff chance', (t, c) => po(c), 0, 0, 1]];
    const nv = v => v === null || v === undefined || v === '' || !isFinite(+v) ? null : +v, fmt = (v, sign, pc) => v === null ? '–' : (v < 0 ? '-' + Math.abs(v) : (sign && v > 0 ? '+' : '') + v) + (pc ? '%' : '');
    let na = 0, nh = 0; const want = [];
    for (const [k, lab, f, lo, sign, pc] of SR) {
      const x = nv(f(TA, g.away)), y = nv(f(TH, g.home)); if (x === null && y === null) continue;
      let pa = 0, ph = 0;
      if (x !== null && y !== null && !(x === 0 && y === 0)) { if (lo) { const ix = 1 / Math.max(x, 0.01), iy = 1 / Math.max(y, 0.01); pa = ix / (ix + iy) * 100; } else { const mn = Math.min(x, y, 0), sx = x - mn, sy = y - mn; pa = sx + sy === 0 ? 50 : sx / (sx + sy) * 100; } pa = Math.round(pa * 10) / 10; ph = Math.round((100 - pa) * 10) / 10; }
      const ba = x !== null && y !== null && x !== y && (lo ? x < y : x > y), bh = x !== null && y !== null && x !== y && !ba; if (ba) na++; if (bh) nh++;
      want.push([k, lab, fmt(x, sign, pc), fmt(y, sign, pc), `${pa}%`, `${ph}%`, ba, bh]);
    }
    const bars = [...md.querySelectorAll('.gs-sbar')].map(r => { const i = r.querySelectorAll('.gs-shalf i'), v = r.querySelectorAll('.gs-v'); return [r.dataset.gsSrow, txt(r.querySelector('.gs-slb')), txt(v[0]), txt(v[1]), i[0].style.width, i[1].style.width, v[0].classList.contains('gs-better'), v[1].classList.contains('gs-better')]; });
    if (!want.length) ck(txt(md.querySelector('.gs-msg')) === 'No team stats yet.', 'Team Stats: with no number for either club it says so');
    else {
      ck(eqA(bars, want), `Team Stats: a row a stat the state carries, each club's number, the pair split on its bar, the better marked (${JSON.stringify(bars).slice(0, 200)}; want ${JSON.stringify(want).slice(0, 200)})`);
      ck(txt(md.querySelector('[data-gs-tsum]')) === `${A} better on ${na}, ${H} on ${nh}`, `Team Stats: how many each club is better on (${txt(md.querySelector('[data-gs-tsum]'))}; ${na}, ${nh})`);
      let thru = null; for (const x of S.games) if (x.state === 'final' && (thru === null || x.date > thru)) thru = x.date;
      const g1 = n => `${+n || 0} game${+n === 1 ? '' : 's'}`, footW = `${S.season - 1}-${String(S.season).slice(2)} season${thru ? ' through ' + new Date(thru + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : ''}: ${A} ${g1(TA.gp)}, ${H} ${g1(TH.gp)}.`;
      ck(txt(md.querySelector('[data-gs-sbasis]')) === footW, `Team Stats: its foot, the season and each club's games ("${footW}": "${txt(md.querySelector('[data-gs-sbasis]'))}")`);
      const fills = [...md.querySelectorAll('.gs-shalf i')].map(i => styleVar(i, '--gs-tc')), fw = barColsS(MAP, g.away, g.home).map(x => /^var\(/.test(x.bg) ? 'var(--ink-2)' : x.bg);
      ck(fills.length > 0 && fills.every((c, i) => /^var\(/.test(fw[i % 2]) ? c === fw[i % 2] : sameHex(c, fw[i % 2])), `Team Stats: each bar's halves in the two clubs' colours as the list's win bar has them (two clubs of one colour: the home half its other colour, else the quiet ink) (${fills.slice(0, 2).join(', ')}; ${fw.join(', ')})`);
    }
    close();
  } else ck(false, 'the Team Stats window did not open');
  return bad;
}
/* Show stats, by this section's own sums: a player's games in the box scores the state carries (his club's, by puck drop), a row a
   game, and the foot's averages */
function gpStatsS(x) {
  const B = S.box && isO(S.box.games) ? S.box.games : {}, gk = x.grp === 'G';
  const rows = Object.keys(B).map(id => [S.games.find(z => z.id === id), gk ? (isO(B[id].g) ? B[id].g : {})[x.id] : (isO(B[id].s) ? B[id].s : {})[x.id]]).filter(r => r[0] && r[1] !== undefined && [r[0].home, r[0].away].includes(x.team))
    .sort((a, b) => (Date.parse(a[0].start) - Date.parse(b[0].start)) || sStr(`${ab(a[0].away)} @ ${ab(a[0].home)}`, `${ab(b[0].away)} @ ${ab(b[0].home)}`));
  if (!rows.length) return { none: `No games in the last ${S.box && +S.box.days ? +S.box.days : 14} days.` };
  const cols = gk ? [v => +v] : [v => v[0], v => v[1], v => v[0] + v[1], v => v[2], v => v[3]];
  return { head: ['Date', 'Opp'].concat(gk ? ['SV'] : ['G', 'A', 'PTS', 'SOG', 'BLK']), body: rows.map(([r, v]) => [new Date(r.start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), ab(r.home === x.team ? r.away : r.home)].concat(cols.map(f => String(f(v))))),
    foot: [`Per game (${rows.length})`].concat(cols.map(f => { const s = rows.reduce((t, r) => t + f(r[1]), 0) / rows.length; return s.toFixed(s < 10 ? 1 : 0); })) };
}
async function gamePageChecks() {
  console.log("THE GAME'S PAGE");
  const AT = PUB + 60000, errs = [], w = await boot(AT, errs, { keepDk: true }), d = w.document, MAP = pageMap(w), real = S, show = process.env.NHL_SMOKE_ALL ? 40 : 4;
  const $ = id => d.getElementById(id), modal = $('gameModal'), view = $('gameView'), gs = $('gsModal');
  const rdOf = g => S.props && isO(S.props.games) && isO(S.props.games[g.id]) ? dkSeed(S.props.games[g.id].dk) : null;
  const key = (k, o = {}) => new w.KeyboardEvent('keydown', Object.assign({ key: k, bubbles: true, cancelable: true }, o));
  chk(!!modal && modal.hidden && modal.parentElement === d.body && !!gs && gs.hidden && gs.parentElement === d.body && !d.getElementById('ppWin') && !d.querySelector('.pp-row, .pp-add, #ppStats, #ppBody, #ppRead, .drawer, .orow, button[data-lu], button[data-pbgo]'),
    "the game's page and its little window are children of the body, shut on load; the Player props window, the Lineups drawer, the out rows and Parlay Builder → are gone");
  /* ---- every game of the days held (heldDays: yesterday to ten days out, the season's first day and a past day mid-way; every row of
     every day is THE GAMES LIST's): its page and its three windows, worked out here ---- */
  /* walking the held days reads the scoreboard of a day shown that has a game under way, once: that read is the list's own (THE GAMES LIST
     holds it), so it is counted apart from what a game's page may ask for, which is nothing */
  const dayRead = r => /scoreboard\?dates=\d{8}&limit=100$/.test(r.url), asked = () => w.__requests.filter(r => !dayRead(r)).length;
  const days = heldDays(d, AT), req0 = asked(), rd0 = w.__requests.length, wr0 = w.__writes.length;
  let n = 0, opened = 0, rows = 0; const bad = [], badW = [], kinds = { come: 0, lined: 0, read: 0, proj: 0, live: 0, fin: 0, boxed: 0 };
  for (const day of days) for (const g of S.games.filter(x => x.date === day)) {
    const rd = rdOf(g), b = gpWrongs(w, g, AT, rd, { MAP });
    n++; opened += b.opened || 0; rows += b.rows || 0;
    kinds[sStarted(g, AT) ? (g.state === 'final' ? 'fin' : 'live') : 'come']++; if (!sStarted(g, AT) && g.line && sFresh(g)) kinds.lined++; if (rd && rd.status === 200) kinds.read++; if (S.props && isO(S.props.games) && S.props.games[g.id]) kinds.proj++; if (g.state === 'final' && S.box && isO(S.box.games) && S.box.games[g.id]) kinds.boxed++;
    for (const m of b) bad.push(`${g.id} ${ab(g.away)} @ ${ab(g.home)}: ${m}`);
    if (pageOn(d, g.id)) for (const m of gpWindowWrongs(w, g, AT)) badW.push(`${g.id} ${ab(g.away)} @ ${ab(g.home)}: ${m}`);
  }
  closeBets(d);
  chk(!bad.length, `every game of the days held opens its page from its row, and the page is the state's: the bar, the status line or the strip, the head, Game bets row by row, each club's outs and every player's row and lines (${n} games, ${rows} rows, ${opened} players opened; ${bad.length} wrong: ${bad.slice(0, show).join(' | ')})`);
  chk(!badW.length, `each game's three windows are the state's: Matchup (both attacks' ranks and gaps, the clubs' rows, every model's pick as the Pick'em Record reads it), Lineups, Team Stats (${badW.length} wrong: ${badW.slice(0, show).join(' | ')})`);
  { const reads = w.__requests.slice(rd0).filter(dayRead).map(r => r.url), okDay = u => days.some(dd => u.endsWith(`dates=${dd.replace(/-/g, '')}&limit=100`) && S.games.some(g => g.date === dd && g.state !== 'final' && sStarted(g, w.Date.now())));
    chk(asked() === req0 && w.__writes.length === wr0 && reads.every(okDay) && new Set(reads).size === reads.length, `opening a game's page, its players and its windows asks for nothing and stores nothing; choosing its day reads that day's scoreboard once, only where it has a game under way (${asked() - req0} requests, ${reads.length} day reads, ${w.__writes.length - wr0} writes)`); }
  console.log(`  ${n} games on ${days.length} days of the select (${days[0] || 'none'} to ${days[days.length - 1] || 'none'}): ${kinds.come} to come (${kinds.lined} with a fresh line, ${kinds.proj} projected, ${kinds.read} with DraftKings' player lines read), ${kinds.live} under way, ${kinds.fin} final (${kinds.boxed} boxed); ${rows} player rows held, ${opened} opened and held line by line`);
  if (!n) console.log("  no game on the days held: the game's page is held on no game of this state");
  /* ---- the keyboard, the focus, the ways out: on a game to come where the days held have one, else on their first game ---- */
  const onStrip = S.games.filter(g => days.includes(g.date)), G0 = onStrip.find(g => !sStarted(g, AT) && rdOf(g) && rdOf(g).status === 200 && sFresh(g)) || onStrip.find(g => !sStarted(g, AT) && S.props && isO(S.props.games) && S.props.games[g.id]) || onStrip.find(g => !sStarted(g, AT)) || onStrip[0];
  if (G0) {
    openDay(d, G0.date); d.querySelector('#tabs button[data-tab="games"]').click(); openDay(d, G0.date);
    const card = () => cardOf(d, G0.id), panel = modal.querySelector('.modal-panel');
    chk(!!card() && card().tagName === 'BUTTON' && card().getAttribute('aria-haspopup') === 'dialog' && !card().querySelector('button, a, input'), 'a game\'s row is one button, which opens the game\'s page; no control inside it');
    card().focus(); card().click();
    chk(pageOn(d, G0.id) && d.activeElement === panel && panel.getAttribute('tabindex') === '-1' && d.body.classList.contains('modal-open') && modal.scrollTop === 0, `the row opens the game's page, and the focus moves into it (on ${d.activeElement && (d.activeElement.id || d.activeElement.className)})`);
    chk(w.location.hash === '#games', `the address does not change (${w.location.hash})`);
    /* Tab stays inside: from the last control round to the first, and back */
    const focusable = () => [...modal.querySelectorAll('button, a[href], input, select, [tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && !x.closest('[hidden]'));
    const f = focusable(); f[f.length - 1].focus(); const ev1 = key('Tab'); d.activeElement.dispatchEvent(ev1);
    chk(d.activeElement === f[0] && ev1.defaultPrevented && f[0].id === 'backBtn', `Tab from the page's last control goes to its first, Close (${d.activeElement && d.activeElement.id})`);
    const ev2 = key('Tab', { shiftKey: true }); d.activeElement.dispatchEvent(ev2);
    chk(d.activeElement === f[f.length - 1] && ev2.defaultPrevented, 'Shift+Tab from the first goes to the last: Tab never leaves the page');
    /* Escape closes it; the focus is back on the card */
    d.activeElement.dispatchEvent(key('Escape'));
    chk(modal.hidden && !d.body.classList.contains('modal-open') && d.activeElement === card() && !view.children.length, `Escape closes the page and the focus goes back to the game's card (${d.activeElement && (d.activeElement.dataset.game || d.activeElement.tagName)})`);
    card().click(); $('backBtn').click();
    chk(modal.hidden && d.activeElement === card(), 'Close closes it, the focus back on the card');
    card().click(); modal.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    chk(modal.hidden && d.activeElement === card(), 'a click on the backdrop closes it');
    card().click(); view.querySelector('.ghead').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    chk(!modal.hidden, 'a click inside the page does not');
    d.querySelector('#tabs button[data-tab="pickem"]').click();
    chk(modal.hidden && !d.body.classList.contains('modal-open'), 'a change of tab closes it');
    d.querySelector('#tabs button[data-tab="games"]').click(); openDay(d, G0.date);
    /* a window: Close holds the focus, Tab stays inside, Escape closes it alone and gives the focus back to its button; the next Escape closes the page */
    card().click();
    const wb = view.querySelector('[data-gp-pop="lineups"]'); wb.focus(); wb.click();
    const e1 = key('Tab'); d.activeElement.dispatchEvent(e1);
    chk(!gs.hidden && d.activeElement === $('gsClose') && e1.defaultPrevented, 'a window\'s Close holds the focus, and Tab stays inside the window');
    const e2 = key('Escape'); d.activeElement.dispatchEvent(e2);
    chk(gs.hidden && !modal.hidden && d.activeElement === view.querySelector('[data-gp-pop="lineups"]') && d.body.classList.contains('modal-open'), `Escape closes the window alone, the focus back on its button, the game's page still open (${d.activeElement && (d.activeElement.dataset.gpPop || d.activeElement.id)})`);
    view.querySelector('[data-gp-pop="stats"]').click(); gs.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
    chk(gs.hidden && !modal.hidden, 'a click on the window\'s backdrop closes the window alone');
    view.querySelector('[data-gp-pop="units"]').click(); $('backBtn').click();
    chk(gs.hidden && modal.hidden, 'the window goes with the page');
    card().click(); d.activeElement.dispatchEvent(key('Escape'));
    chk(modal.hidden, 'and with no window open Escape closes the page');
    /* All skaters and the search */
    card().click();
    const R0 = gpRosterS(G0, rdOf(G0), false, gpScoreS(G0, null), sStarted(G0, AT)), R1 = gpRosterS(G0, rdOf(G0), true, gpScoreS(G0, null), sStarted(G0, AT));
    const cutN = R0.away.cut + R0.home.cut, ids = () => [...view.querySelectorAll('.plrbtn')].filter(r => !r.hidden).map(r => r.dataset.open || r.dataset.nohist);
    $('allCb').focus(); $('allCb').click();
    chk($('allCb').checked && d.activeElement === $('allCb') && eqA(ids(), R1.away.players.concat(R1.home.players, R1.other).map(x => x.id)), `All skaters lists every skater of both clubs, then the players DraftKings prices whom the model leaves out; the focus stays on the box (${ids().length} rows, ${R1.away.players.length + R1.home.players.length + R1.other.length} wanted)`);
    $('allCb').click();
    chk(!$('allCb').checked && eqA(ids(), R0.away.players.concat(R0.home.players).map(x => x.id)), `unticked, each club is back to its goalie, ${GP_CUT_F} forwards and ${GP_CUT_D} defencemen (${ids().length} rows)`);
    const hid = R1.home.players.concat(R1.away.players).find(x => x.mine && !R0.home.players.concat(R0.away.players).some(y => y.id === x.id) && x.name);
    if (hid) {
      const q = hid.name.split(' ').slice(-1)[0].toLowerCase(), sb = $('gameSearch'); sb.focus(); sb.value = q; sb.dispatchEvent(new w.Event('input', { bubbles: true }));
      const wantQ = R1.away.players.concat(R1.home.players, R1.other).filter(x => String(x.name || `ESPN athlete ${x.id}`).toLowerCase().includes(q)).map(x => x.id);
      const hdrs = [...view.querySelectorAll('.teamhdr')].filter(h => h.dataset.team), shownH = hdrs.filter(h => !h.hidden).map(h => h.dataset.team), wantH = [G0.away, G0.home].filter(c => R1[c === G0.away ? 'away' : 'home'].players.some(x => wantQ.includes(x.id)));
      chk(eqA(ids(), wantQ) && wantQ.includes(hid.id) && d.activeElement === $('gameSearch') && $('gameSearch').value === q && eqA(shownH, wantH) && [...view.querySelectorAll('.gp-out')].every(p => p.hidden), `the search finds a skater the cut leaves out ("${q}": ${ids().join(',')}; want ${wantQ.join(',')}), hides a club with no row left and the lines under the heads, and keeps the keyboard in the box`);
      const sb2 = $('gameSearch'); sb2.value = ''; sb2.dispatchEvent(new w.Event('input', { bubbles: true }));
      chk(eqA(ids(), R0.away.players.concat(R0.home.players).map(x => x.id)) && [...view.querySelectorAll('.teamhdr, .gp-out')].every(p => !p.hidden), 'cleared, the cut is back');
    } else console.log(`  no skater past the cut on ${ab(G0.away)} @ ${ab(G0.home)}: the search finding one is not held here`);
    /* Show stats: the chip toggles his games under his row without opening him, from a click and from the keyboard */
    const xs = R0.away.players.concat(R0.home.players).find(x => view.querySelector(`.plrbtn[data-open="${x.id}"]`));
    if (xs) {
      const chip = () => view.querySelector(`.stbtn[data-stats="${xs.id}"]`), row = () => view.querySelector(`.plrbtn[data-open="${xs.id}"]`);
      chip().focus(); chip().click();
      const wk = row().nextElementSibling, SW = gpStatsS(xs);
      const tbl = wk && wk.querySelector('table'), got = tbl ? { head: [...tbl.querySelectorAll('thead th')].map(txt), body: [...tbl.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(txt)), foot: [...tbl.querySelectorAll('tfoot td')].map(txt) } : { none: wk ? txt(wk) : null };
      chk(!!wk && wk.classList.contains('wkstats') && eqA(got, SW) && txt(chip()) === 'Hide stats' && chip().getAttribute('aria-pressed') === 'true' && chip().classList.contains('on') && row().getAttribute('aria-expanded') === 'false' && d.activeElement === chip(), `Show stats draws his games in the box scores the state carries under his row, without opening him, the focus kept on the chip (${JSON.stringify(got).slice(0, 160)}; want ${JSON.stringify(SW).slice(0, 160)})`);
      const ek = key('Enter'); chip().dispatchEvent(ek);
      chk(ek.defaultPrevented && txt(chip()) === 'Show stats' && chip().getAttribute('aria-pressed') === 'false' && !view.querySelector('.wkstats') && row().getAttribute('aria-expanded') === 'false', 'Enter on the chip is the chip\'s own: it hides them again and does not open the row');
      const es = key(' '); chip().dispatchEvent(es);
      chk(es.defaultPrevented && !!view.querySelector('.wkstats') && row().getAttribute('aria-expanded') === 'false', 'Space on it too');
      chip().click();
      /* a row opened from the keyboard keeps the focus; opening another shuts the first */
      row().focus(); row().click();
      chk(row().getAttribute('aria-expanded') === 'true' && d.activeElement === row() && txt(row().querySelector('.arrow')) === '⌃', 'a row opened keeps the keyboard on it');
      const other = R0.away.players.concat(R0.home.players).find(x => x.id !== xs.id && view.querySelector(`.plrbtn[data-open="${x.id}"]`));
      if (other) { view.querySelector(`.plrbtn[data-open="${other.id}"]`).click(); chk(row().getAttribute('aria-expanded') === 'false' && view.querySelectorAll('.plrbody').length === 1, 'one player open at a time'); view.querySelector(`.plrbtn[data-open="${other.id}"]`).click(); chk(!view.querySelector('.plrbody'), 'a second tap shuts him'); }
    }
    /* a tick: the leg in the builder by its own rules, said in the page's status line, the box redrawn ticked with the focus on it; the other
       side of the total takes its place; a second tick takes it out */
    const tk = !sStarted(G0, AT) && sFresh(G0) ? [['over', 'ou'], ['home', 'ml'], ['away', 'ml'], ['home', 'pl']].map(([s, k]) => sLeg(G0, s, k)).find(Boolean) : null;
    if (tk) {
      const box = id => [...view.querySelectorAll('input[data-leg]')].find(x => x.dataset.leg === id), stored = () => (JSON.parse(w.localStorage.getItem('nhl_v1') || '{}').legs || []).map(l => `${l.game}|${l.side}|${l.kind}`);
      const st0 = stored();
      box(tk.id).focus(); box(tk.id).click();
      chk(box(tk.id).checked && box(tk.id).closest('tr').classList.contains('on') && d.activeElement === box(tk.id) && stored().includes(tk.id) && /^Added to your parlay: .+ Your parlay: \d+ legs?\.$/.test(txt($('ppMsg'))), `a box ticked puts the leg in the parlay, said in the page's status line, the box drawn ticked with the keyboard still on it (${txt($('ppMsg'))})`);
      const oth = tk.kind === 'ou' ? sLeg(G0, 'under', 'ou') : null;
      if (oth) { box(oth.id).click(); chk(box(oth.id).checked && !box(tk.id).checked && !box(tk.id).closest('tr').classList.contains('on') && stored().includes(oth.id) && !stored().includes(tk.id) && /replaced .+ one total a game\./.test(txt($('ppMsg'))), `the other side of the total takes its place, said (${txt($('ppMsg'))})`); box(oth.id).click(); }
      else box(tk.id).click();
      chk(!box(tk.id).checked && ![...view.querySelectorAll('input[data-leg]')].some(x => x.checked && !st0.includes(x.dataset.leg)) && /^Taken out of your parlay: /.test(txt($('ppMsg'))), `a second tick takes it out, said (${txt($('ppMsg'))})`);
      /* a tap anywhere on the row is a tap on its box */
      box(tk.id).closest('tr').querySelector('.thr').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
      chk(box(tk.id).checked, 'a tap anywhere on a bet\'s row ticks its box'); box(tk.id).click();
      /* the box ticked stays under the finger (the review's P2: the status line once came in above the rows and moved them, so a second tap
         on the same spot ticked the row above). jsdom lays nothing out, so on a made-up layout: every element of the page 40px under the
         one before it, and all of them 30px lower once the status line has words. A tick must scroll the page back by exactly what the
         draw moved its box, and a second tick, which moves nothing, by nothing */
      closeBets(d); betsOn(d, G0);
      { const realRect = w.Element.prototype.getBoundingClientRect, fake = el => 40 * [...view.querySelectorAll('*')].indexOf(el) + (txt($('ppMsg')) ? 30 : 0);
        w.Element.prototype.getBoundingClientRect = function () { const t = view.contains(this) ? fake(this) : 0; return { top: t, bottom: t + 40, left: 0, right: 100, width: 100, height: 40, x: 0, y: t }; };
        try {
          modal.scrollTop = 500; const t0 = fake(box(tk.id)); box(tk.id).click(); const t1 = fake(box(tk.id)), s1 = modal.scrollTop;
          chk(txt($('ppMsg')) !== '' && t1 - t0 === 30 && s1 === 500 + (t1 - t0), `a box ticked stays where it stood: the draw moved it ${t1 - t0}px on the made-up layout and the page is scrolled back by as much (${s1 - 500}px)`);
          box(tk.id).click(); const t2 = fake(box(tk.id));
          chk(t2 === t1 && modal.scrollTop === s1 && !box(tk.id).checked, `and a tick that moves nothing scrolls nothing (${modal.scrollTop - s1}px)`);
        } finally { w.Element.prototype.getBoundingClientRect = realRect; modal.scrollTop = 0; } }
    } else console.log('  no game to come with a fresh line on the strip: a tick is held on the made-up slates of the other sections');
    closeBets(d);
  }
  /* ---- the layout, read from the stylesheet (jsdom lays nothing out) ---- */
  if (G0) {
    betsOn(d, G0); const cs = el => el ? w.getComputedStyle(el) : null, mh = el => { const c = cs(el); return c ? c.minHeight : 'none'; };
    const row1 = view.querySelector('.rungs tr'), plr = view.querySelector('button.plrbtn'), ctl = [['#backBtn', $('backBtn')], ['the search', $('gameSearch')], ['a window button', view.querySelector('.gwin-btn')]].concat($('ppRefreshOdds') ? [['Refresh odds', $('ppRefreshOdds')]] : [], plr ? [["a player's row", plr]] : []);
    const low = ctl.filter(([, el]) => mh(el) !== '44px').map(x => `${x[0]} ${mh(x[1])}`);
    chk(!low.length && (!row1 || cs(row1).height === '44px') && mh($('gsClose')) === '44px', `every control of the page is 44px tall: Close, the search, Refresh odds, the windows' buttons, a bet's row, a player's row, a window's Close (${low.join(', ') || 'all'}; a row ${row1 ? cs(row1).height : 'none'})`);
    /* Show stats is the one exception, named: the NFL's 22px chip inside the row's button */
    const chipR = cssWith(w, 'min-height', /^44px$/).filter(([sel]) => /stbtn/.test(sel));
    chk(!chipR.length, `Show stats stays the NFL's small chip inside a player's row, the page's one control under 44px (${chipR.length} rules give it 44px)`);
    const tracks = v => { let dep = 0, nT = 0, cur = ''; for (const ch of String(v).trim()) { if (ch === '(') dep++; if (ch === ')') dep--; if (ch === ' ' && !dep) { if (cur) nT++; cur = ''; } else cur += ch; } return nT + (cur ? 1 : 0); };
    const grid = cssWith(w, 'grid-template-columns', /./).filter(([sel]) => sel === '.ghead .gh-grid');
    const wide = grid.find(([, m]) => !m), mid = grid.find(([, m]) => /max-width:\s*980px/.test(m));
    const gv = (sel, media) => { for (const [s2, m2, st] of RULES.get(w)) if (s2 === sel && (media ? media.test(m2) : !m2) && st.getPropertyValue('grid-template-columns')) return st.getPropertyValue('grid-template-columns'); return ''; };
    chk(!!wide && !!mid && tracks(gv('.ghead .gh-grid', null)) === 6 && /^repeat\(3,/.test(gv('.ghead .gh-grid', /max-width:\s*980px/).trim()), `the head is six columns, and three from 980px down (${gv('.ghead .gh-grid', null)} | ${gv('.ghead .gh-grid', /max-width:\s*980px/)})`);
    /* at 760px and under the page is the whole screen and a bet's row drops its bar, which only draws the percentage beside it: no other cell of a bet's row is ever hidden */
    const hides = cssWith(w, 'display', /^none$/).filter(([sel]) => /\.rungs|\.statblk|\.plrbody/.test(sel));
    chk(hides.length === 2 && hides.some(([sel, m]) => sel === '.rungs .barcell' && /max-width:\s*760px/.test(m)) && hides.some(([sel, m]) => sel === '.rungs .conf::before' && /max-width:\s*760px/.test(m)), `on a phone a bet's row hides its bar and the band's dot, nothing else, at any width (${hides.map(x => `${x[0]} @ ${x[1] || 'all'}`).join('; ')})`);
    const phone = RULES.get(w).filter(([sel, m]) => /max-width:\s*760px/.test(m) && (sel === '#gameModal' || sel === '#gameModal .modal-panel'));
    const pv = (sel, p) => { const r = phone.find(x => x[0] === sel && x[2].getPropertyValue(p)); return r ? r[2].getPropertyValue(p).trim() : ''; };
    chk(pv('#gameModal', 'padding') === '0px' && pv('#gameModal', 'overflow-y') === 'auto' && pv('#gameModal .modal-panel', 'min-height') === '100%' && pv('#gameModal .modal-panel', 'border-radius') === '0px' && pv('#gameModal .modal-panel', 'overflow') === 'visible', `at 760px and under the game's page is the whole screen, its backdrop scrolling (${pv('#gameModal', 'padding')}, ${pv('#gameModal .modal-panel', 'min-height')}, ${pv('#gameModal .modal-panel', 'border-radius')})`);
    const z = sel => { for (const [s2, m2, st] of RULES.get(w)) if (s2 === sel && !m2 && st.getPropertyValue('z-index')) return +st.getPropertyValue('z-index'); return NaN; };
    chk(z('.pb-slip') < z('#gameModal') && z('#gameModal') < z('#gsModal') && z('#gsModal') < z('.modal'), `the layers: the slip bar under the game's page, its window over it, the parlay card over both (${z('.pb-slip')}, ${z('#gameModal')}, ${z('#gsModal')}, ${z('.modal')})`);
    const s16 = RULES.get(w).some(([sel, m, st]) => /max-width:\s*640px/.test(m) && sel.split(',').some(x => x.trim() === '.gsearch input') && st.getPropertyValue('font-size') === '16px');
    chk(s16, 'on a phone the search box is 16px, so iOS does not zoom the page in on it');
    /* the status line (the review's P2): the page's last element (gpWrongs), held at the foot of the screen, on a ground of its own, gone while empty.
       So what a tick, a refusal or the builder says is in view wherever the visitor is, and its coming and going moves no row */
    { const st = (RULES.get(w).find(([s2, m2]) => s2 === '.gp-msg' && !m2) || [])[2], gp = p => st ? st.getPropertyValue(p).trim() : '';
      chk(gp('position') === 'sticky' && /^\d+px$/.test(gp('bottom')) && gp('background') === 'var(--panel-3)' && gp('color') === 'var(--ink)' && cssWith(w, 'display', /^none$/).some(([sel, m]) => sel === '.gp-msg:empty' && !m) && pv('#gameModal .modal-panel', 'overflow') === 'visible',
        `the status line is held at the foot of the screen (sticky, the page's last element), on its own ground, and hidden while it has nothing to say (${gp('position')}, bottom ${gp('bottom')}, ${gp('background')})`); }
    /* the band and the model's figure on a ticked or graded row (the review's P7): the band on the panel itself, never on its own soft fill over
       the row's wash, the figure in --ink; by this section's own sums both looks read 4.5:1 or more */
    { const cssT = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, ''), blk = sel => { const i = cssT.indexOf(sel + '{'); return i < 0 ? '' : cssT.slice(i + sel.length + 1, cssT.indexOf('}', i)); };
      const tks = b => { const o = {}; for (const m of b.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) o[m[1]] = m[2].trim(); return o; }, PAL = { dark: tks(blk(':root')), light: tks(blk('html[data-theme="light"]')) };
      const rgbaOf = v => { const m = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(v || ''); return m ? [+m[1], +m[2], +m[3], +m[4]] : null; };
      const laid = (soft, ground) => { const a = rgbaOf(soft); if (!a || !/^#[0-9A-Fa-f]{6}$/.test(ground || '')) return null; const g2 = hexRgb(ground).map(x => x * 255); return '#' + [0, 1, 2].map(i => Math.round(a[i] * a[3] + g2[i] * (1 - a[3])).toString(16).padStart(2, '0')).join(''); };
      const low = [];
      for (const [name, P] of Object.entries(PAL)) {
        for (const t of ['--pick', '--gold-ink', '--ink-2']) { const r = /^#[0-9A-Fa-f]{6}$/.test(P[t] || '') && /^#[0-9A-Fa-f]{6}$/.test(P['--panel'] || '') ? crH(P[t], P['--panel']) : 0; if (!(r >= 4.5)) low.push(`${name}: the band's ${t} on --panel ${r.toFixed(2)}`); }
        for (const wash of ['--ice-soft', '--pick-soft', '--miss-soft']) for (const gr of ['--panel', '--panel-2']) { const c = laid(P[wash], P[gr]), r = c ? crH(P['--ink'], c) : 0; if (!(r >= 4.5)) low.push(`${name}: --ink on ${wash} over ${gr} ${r.toFixed(2)}`); }
      }
      const ruled = (sels, prop, val) => sels.every(sel => RULES.get(w).some(([s2, m2, st]) => !m2 && s2.split(',').map(x => x.trim()).includes(sel) && st.getPropertyValue(prop).trim() === val));
      chk(ruled(['.rungs tr.on .conf', '.rungs tr.hit .conf', '.rungs tr.miss .conf'], 'background', 'var(--panel)') && ruled(['.rungs tr.on .mkt', '.rungs tr.hit .mkt', '.rungs tr.miss .mkt'], 'color', 'var(--ink)') && !low.length,
        `on a ticked or graded row the band stands on the panel and the model's figure is in --ink, each 4.5:1 or more in both looks (${low.slice(0, 4).join('; ') || 'all'})`); }
    /* the narrowest phones (the review's P9): at 340px and under a bet table's cells are drawn closer and the bet's name may take two lines, so a
       table with "Anytime goal" and a five-figure price fits its box at 320px (measured in Chromium; jsdom lays nothing out, so the rules are read) */
    { const nr = (sel, prop) => { const r = RULES.get(w).find(([s2, m2, st]) => /^\(max-width:\s*340px\)$/.test(m2) && s2 === sel && st.getPropertyValue(prop)); return r ? r[2].getPropertyValue(prop).trim() : ''; }, px = v => { const m = /^(\d+(?:\.\d+)?)px$/.exec(v); return m ? +m[1] : NaN; };
      const fixed = px(nr('.rungs td.pick', 'width')) + px(nr('.rungs .thr', 'width')) + px(nr('.rungs .pct', 'width')) + px(nr('.rungs .est', 'width'));
      chk(nr('.rungs td', 'padding') === '7px 2px' && fixed <= 178 && px(nr('.rungs .thr', 'width')) <= 62 && !cssWith(w, 'white-space', /^nowrap$/).some(([sel]) => sel.split(',').some(x => /\.rungs\b.*\.thr\b/.test(x))),
        `at 340px and under a bet's row is drawn closer (its fixed cells ${fixed}px, 2px between) and the bet's name is free to wrap, so no table is wider than its box (${nr('.rungs td', 'padding')})`); }
    closeBets(d);
  }
  /* ---- made-up copies of the state, planted in this page's memory and in this section's own copy alike ---- */
  S = JSON.parse(JSON.stringify(real));
  try {
    const both = (fn, arg) => { fn(S, arg); w.eval(`(${fn.toString()})(S, ${JSON.stringify(arg === undefined ? null : arg)})`); };
    const hold = (g, tag, o = {}) => { closeBets(d); const b = gpWrongs(w, g, o.at || AT, o.rd !== undefined ? o.rd : rdOf(g), Object.assign({ MAP, noPlayers: true }, o)); chk(!b.length, `${tag} (${b.length} wrong: ${b.slice(0, show).join(' | ')})`); return b; };
    const come = onStrip.filter(g => !sStarted(g, AT)), gById = id => S.games.find(x => x.id === id);
    /* the status line follows the builder (the review's P3): what a tick said goes once the builder's legs are no longer what the tick left.
       Another tab empties the builder: the box unticked, nothing said. The puck drops with a leg ticked: the builder's own reason in its place */
    { const GT = come.find(g => g.line && sFresh(g) && sLeg(g, 'home', 'ml'));
      if (GT) {
        closeBets(d); betsOn(d, GT); const LT = sLeg(GT, 'home', 'ml'), bT = () => [...view.querySelectorAll('input[data-leg]')].find(x => x.dataset.leg === LT.id), stored = () => JSON.parse(w.localStorage.getItem('nhl_v1') || '{}');
        bT().click(); const added = txt($('ppMsg'));
        const st1 = stored(); st1.legs = []; w.localStorage.setItem('nhl_v1', JSON.stringify(st1)); w.dispatchEvent(new w.StorageEvent('storage', { key: 'nhl_v1' }));
        chk(/^Added to your parlay: .+ Your parlay: 1 leg\.$/.test(added) && pageOn(d, GT.id) && !!bT() && !bT().checked && txt($('ppMsg')) === '', `a builder emptied in another tab unticks the box and takes the tick's words off the page's status line ("${added}" then "${txt($('ppMsg'))}")`);
        bT().click(); const tT = Date.parse(GT.start) + 60000, muT = `${ab(GT.away)} @ ${ab(GT.home)}`;
        w.__setClock(tT); d.dispatchEvent(new w.Event('visibilitychange'));
        chk(pageOn(d, GT.id) && !view.querySelector('input[data-leg], input[data-pp-add]') && txt($('ppMsg')) === `${muT} left the builder: the puck dropped. Your parlay: 0 legs.` && !(stored().legs || []).length, `at the puck drop the leg leaves the builder and the page says the builder's reason, never that the leg is still in the parlay (${txt($('ppMsg'))})`);
        w.__setClock(AT); d.dispatchEvent(new w.Event('visibilitychange')); closeBets(d);
      } else console.log('  no game to come with a fresh moneyline on the strip: the status line following the builder is held on the press below alone'); }
    const GL = come.find(g => g.line && sFresh(g) && sLeg(g, 'home', 'ml') && sLeg(g, 'over', 'ou'));
    if (GL) {
      /* another book: named in the source line, the status line and each fair chance's title */
      both((St, id) => { St.games.find(x => x.id === id).line.book = 'ESPN BET'; }, GL.id);
      hold(gById(GL.id), "a game priced at another book names the book where DraftKings' name stood: the lines' source, the status line, each fair chance");
      both((St, id) => { St.games.find(x => x.id === id).line.book = 'Draft Kings'; }, GL.id);
      /* a stale line: the rows and their prices drawn, no box, said under the bets and in the status line */
      both((St, id) => { const L = St.games.find(x => x.id === id).line; L.at = new Date(Date.parse(L.at) - 6 * 3600000).toISOString().slice(0, 16) + 'Z'; delete L.refreshed; }, GL.id);
      const bS = hold(gById(GL.id), 'a line DraftKings did not list at the last run is drawn with its prices and no box, and says so under the bets and in the status line');
      chk(bS.length || (pageOn(d, GL.id) && !view.querySelector('.gbets input') && view.querySelectorAll('.gbets .book').length > 0), 'a stale line offers no box');
      /* no line: each club's To win alone, the model's chance and no price, no total, said */
      both((St, id) => { const g = St.games.find(x => x.id === id); g.line = null; for (const k of ['mlEdge', 'mlPick', 'cover', 'plEdge', 'plPick', 'ou', 'ouEdge', 'ouPick']) delete g[k]; }, GL.id);
      const bN = hold(gById(GL.id), "a game with no line draws each club's To win alone, the model's chance and no price or box, no total, and says there is no DraftKings line yet");
      chk(bN.length || (view.querySelectorAll('.gbets tr').length === 2 && txt(view.querySelector('.gbets .gp-why')) === 'No DraftKings line yet.'), 'two rows and the line that says why');
    } else console.log('  no game to come with a fresh moneyline and total on the strip: another book, a stale line and no line are not planted here');
    const GP1 = come.find(g => S.props && isO(S.props.games) && isO(S.props.games[g.id]));
    if (GP1) {
      /* the read's three states and none, in the status line and the rows */
      const dk0 = S.props.games[GP1.id].dk, at = new Date(PUB).toISOString();
      for (const [dk, tag] of [[{ status: 404, at }, 'none posted yet'], [{ status: 'failed', at, why: 'HTTP 503' }, 'a read that failed'], [null, 'no read at all']]) {
        both((St, a) => { if (a.dk) St.props.games[a.id].dk = a.dk; else delete St.props.games[a.id].dk; }, { id: GP1.id, dk }); w.eval('ppSeed()');
        hold(gById(GP1.id), `DraftKings' player lines with ${tag}: the status line says so and every player's row is his projection, no box`, { noPlayers: false });
      }
      both((St, a) => { if (a.dk) St.props.games[a.id].dk = a.dk; else delete St.props.games[a.id].dk; }, { id: GP1.id, dk: dk0 || null }); w.eval('ppSeed()');
      /* the trial decided, and no ledger: the pill's three states */
      for (const dec of ['FAIL', 'PASS']) { both((St, v) => { St.props.ledger = Object.assign({}, St.props.ledger, { decision: v }); }, dec); hold(gById(GP1.id), `the trial decided ${dec}: the pill says so, and only then`); }
      both(St => { delete St.props.ledger; }); hold(gById(GP1.id), 'with no ledger in the state the pill still says the props model is on trial');
      both((St, v) => { St.props.ledger = v; }, real.props.ledger || null); if (!real.props.ledger) both(St => { delete St.props.ledger; });
      /* the puck drops with the page open: the watch draws it again, the boxes go and the strip comes in; then a score this browser read, then its final in overtime */
      closeBets(d); betsOn(d, gById(GP1.id));
      const t1 = Date.parse(GP1.start) + 60000;
      w.__setClock(t1); d.dispatchEvent(new w.Event('visibilitychange'));
      chk(pageOn(d, GP1.id) && !view.querySelector('input[data-leg], input[data-pp-add], #ppRefreshOdds') && !!view.querySelector('.gp-live'), 'a page open at its game\'s puck drop is drawn again by the watch: no box left, the strip in');
      hold(gById(GP1.id), 'past its puck drop with no score read, the page says In progress, LIVE on the head and every row, the projections still shown as projected', { at: t1, noPlayers: false });
      const lv1 = { state: 'live', hs: 1, as: 2, detail: '8:12 - 2nd' }; w.eval(`LIVE[${JSON.stringify(GP1.id)}] = ${JSON.stringify(lv1)}`);
      hold(gById(GP1.id), 'with a live score read in this browser the strip and the head carry it', { at: t1, lv: lv1 });
      /* a live score is a game under way however long ago the puck dropped (a long overtime, a score the job kept): four hours on the page
         still says playing and LIVE, never FINAL, and keeps Refresh scores */
      { const tL = Date.parse(GP1.start) + 4 * 3600000 + 120000; w.__setClock(tL); d.dispatchEvent(new w.Event('visibilitychange'));
        hold(gById(GP1.id), 'a live score four hours past the puck drop is still a game under way', { at: tL, lv: lv1 });
        const stp = view.querySelector('.gp-live'), pills = [...view.querySelectorAll('.teamhdr .pill')].map(txt);
        chk(pageOn(d, GP1.id) && !!stp && !stp.classList.contains('fin') && pills.length === 2 && pills.every(t => /^playing /.test(t)) && !/FINAL|played/.test(txt(view)) && !!view.querySelector('#gameScoresNow'), `a live score four hours on: the strip is not a final's, both clubs are "playing", Refresh scores is still there (${stp ? stp.className : 'no strip'}; ${pills.join(' | ')})`);
        w.__setClock(t1); d.dispatchEvent(new w.Event('visibilitychange')); }
      const lv2 = { state: 'final', hs: 3, as: 2, detail: 'Final/OT' }; w.eval(`LIVE[${JSON.stringify(GP1.id)}] = ${JSON.stringify(lv2)}`);
      hold(gById(GP1.id), 'a final read in this browser: FINAL · OT, the winner ticked, the actual score beside the expected, To win graded by the score, played for playing', { at: t1, lv: lv2, noPlayers: false });
      /* the review's P1: the state has no box score for a game this browser has just read final (the job boxes it at its next run), so nobody
         "did not play" and no leg is void: every row keeps its projection and each club says the box score is not read yet */
      { const rowsF = [...view.querySelectorAll('.plrbtn')], nbs = [...view.querySelectorAll('[data-gp-nobox]')], pb1 = view.querySelector('.plrbody');
        chk(pageOn(d, GP1.id) && rowsF.length > 0 && rowsF.some(r => /^FINALprojected /.test(txt(r.querySelector('.sum')))) && !/did not play|legs void/i.test(txt(view)) && nbs.length === 2 && nbs.every(p => txt(p) === 'Box score not read yet.'),
          `a final read here before the job has boxed it keeps every projection: nobody "did not play", no leg is called void, each club says its box score is not read yet (${nbs.map(txt).join(' | ')}; ${rowsF.slice(0, 2).map(r => txt(r.querySelector('.sum'))).join(' | ')})`);
        chk(!pb1 || txt(pb1.querySelector('.noline')) === 'Box score not read yet.', `and a player opened says the same under his tiles (${pb1 ? txt(pb1.querySelector('.noline')) : 'none open'})`); }
      /* the same final once the state carries its box score: who is in it has what he did, who is not did not play, his legs void */
      { const PG = S.props.games[GP1.id], sks = ((PG.awayP && PG.awayP.skaters) || []).concat((PG.homeP && PG.homeP.skaters) || []).filter(p => isO(p) && p.id), inId = sks[0] && String(sks[0].id), outId = sks[1] && String(sks[1].id);
        if (inId && outId) {
          both((St, a) => { St.box = St.box || {}; St.box.games = St.box.games || {}; St.box.games[a.id] = { s: { [a.pid]: [1, 1, 3, 0] }, g: {}, r: {}, u: {} }; }, { id: GP1.id, pid: inId });
          hold(gById(GP1.id), 'the same final once the state carries its box score: who is in it has what he did beside his projection, who is not did not play', { at: t1, lv: lv2, noPlayers: false, all: true });
          const rIn = view.querySelector(`.plrbtn[data-open="${inId}"]`), rOut = view.querySelector(`.plrbtn[data-open="${outId}"]`);
          chk(!!rIn && /^FINAL2 points \(proj /.test(txt(rIn.querySelector('.sum'))) && !!rOut && txt(rOut.querySelector('.sum')) === 'FINALdid not play' && !view.querySelector('[data-gp-nobox]'), `with the box score in the state a player in it shows what he did and one it lacks did not play (${rIn ? txt(rIn.querySelector('.sum')) : 'no row'} | ${rOut ? txt(rOut.querySelector('.sum')) : 'no row'})`);
          if (rOut) { rOut.click(); const pb2 = view.querySelector('.plrbody'); chk(!!pb2 && txt(pb2.querySelector('.noline')) === 'Did not play: legs void.', `and only then are his legs called void (${pb2 ? txt(pb2.querySelector('.noline')) : 'not opened'})`); }
          both((St, id) => { delete St.box.games[id]; }, GP1.id);
          if ($('allCb') && $('allCb').checked) $('allCb').click();
        } }
      w.eval(`delete LIVE[${JSON.stringify(GP1.id)}]`); w.__setClock(AT); closeBets(d);
      /* a start the feed moved after the first puck drop: the call kept, said, no box */
      both((St, id) => { const g = St.games.find(x => x.id === id); g.before = new Date(Date.parse(St.published) - 3600000).toISOString().slice(0, 16) + 'Z'; g.frozen = g.frozen || new Date(Date.parse(St.published) - 7200000).toISOString().slice(0, 16) + 'Z'; g.start = new Date(Date.parse(St.published) + 3 * 3600000).toISOString().slice(0, 16) + 'Z'; }, GP1.id);
      if (delayedAt(gById(GP1.id), gById(GP1.id).start, AT) && !startedAt(gById(GP1.id), AT)) hold(gById(GP1.id), 'a start moved after the first puck drop says so on the strip and the head, and offers no box');
    } else console.log('  no projected game to come on the strip: the read\'s states, the trial\'s verdicts, the puck drop and a moved start are not planted here');
    /* a final: with its box score (as published), then with none, then one older than the box window */
    const GF = onStrip.find(g => g.state === 'final' && Number.isFinite(g.hs) && S.box && isO(S.box.games) && isO(S.box.games[g.id]));
    if (GF) {
      hold(gById(GF.id), "a final with its box score: the leaders, each club's players by points with what they did, a tile a stat when opened", { noPlayers: false });
      both((St, id) => { delete St.box.games[id]; }, GF.id);
      const bF = hold(gById(GF.id), 'a final whose box score is not read lists nobody and says so, on the head and under each club');
      chk(bF.length || ([...view.querySelectorAll('.empty')].length === 2 && [...view.querySelectorAll('.empty')].every(e => txt(e) === 'Box score not read yet.') && !view.querySelector('.plrbtn')), 'no row, never a lineup of names marked did not play');
      both((St, a) => { St.box.from = a; }, PBS.nextDay(GF.date));
      hold(gById(GF.id), 'a final older than the box scores the state carries says they are no longer carried');
      { const leadT = txt(view.querySelector('.ghead .gh-lead .lead')), em = [...view.querySelectorAll('.empty')].map(txt);
        chk(leadT === 'Box score no longer carried' && em.length === 2 && em.every(t => t === 'Box score no longer carried.'), `the head's Leaders cell says what the clubs under it say, never "not read yet" beside "no longer carried" (${leadT} | ${em.join(' | ')})`); }
    } else console.log('  no boxed final on the strip: a final\'s rows, a final with no box score and one past the box window are not planted here');
    /* no props model in the state at all: no pill, the player model's lineup by name, no line, nothing thrown */
    const GC = come[0];
    if (GC) { both(St => { delete St.props; }); w.eval('ppSeed()'); const bP = hold(gById(GC.id), "with no props model in the state the page has no trial pill and lists the player model's lineup by name, no figures"); chk(bP.length || !$('ppTrial'), 'no pill');
      /* the same game once its puck has dropped, nothing projected: the head does not promise projections "yet", and no box score is "not read" while the game is on */
      const tC = Date.parse(gById(GC.id).start) + 60000; w.__setClock(tC); d.dispatchEvent(new w.Event('visibilitychange'));
      hold(gById(GC.id), 'a game under way with no projections says so plainly on the head and under each club', { at: tC });
      { const leadT = txt(view.querySelector('.ghead .gh-lead .lead')), em = [...view.querySelectorAll('.empty')].map(txt);
        chk(leadT === 'No projections for this game' && em.length === 2 && em.every(t => t === 'Under way: the box score comes after the final.'), `under way with nothing projected: no "yet" on the head, no box score "not read" under the clubs (${leadT} | ${em.join(' | ')})`); }
      w.__setClock(AT); d.dispatchEvent(new w.Event('visibilitychange')); closeBets(d); }
  } finally { S = real; }
  chk(!errs.length, "no runtime error on a game's page: " + errs.join(' | '));
  w.close();
  /* ---- a Refresh odds press made from a game's page, ESPN answered here from the state (a window of its own). The review's P4: what the
     press was told of each game is said on that game's own page (postponed, cancelled or under way at ESPN, no line there, not in its
     answer, an earlier read of its player lines kept), and "player lines not read yet" only where nothing was asked. Its P3: a leg the
     read takes out of the builder takes the tick's words off the page's status line, the builder's own reason in their place ---- */
  {
    const T2 = AT + 120000, days2 = sOddsDays(AT), comeAll = S.games.filter(g => days2.includes(g.date) && !sStarted(g, T2)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || sStr(a.id, b.id));
    const used = new Set(), take = pool => { const g = pool.find(x => !used.has(x.id)); if (g) used.add(g.id); return g || null; };
    const lined = comeAll.filter(g => g.line && sFresh(g) && PBS.ok(g.line.homeML) && PBS.ok(g.line.awayML) && sLeg(g, 'over', 'ou') && sLeg(g, 'under', 'ou'));
    const jobRead = g => !!(S.props && isO(S.props.games) && isO(S.props.games[g.id]) && isO(S.props.games[g.id].dk) && S.props.games[g.id].dk.status === 200 && Array.isArray(S.props.games[g.id].dk.main));
    const gK = take(sPropsAsk(AT).filter(g => !sStarted(g, T2) && jobRead(g))), gM = take(lined), gP = take(lined), gX = take(lined), gI = take(lined), gN = take(lined), gU = take(lined), gR = take(lined);
    const ST = new Map([[gP, { name: 'STATUS_POSTPONED', state: 'post', description: 'Postponed', shortDetail: 'Postponed' }], [gX, { name: 'STATUS_CANCELED', state: 'post', description: 'Canceled', shortDetail: 'Canceled' }], [gI, { name: 'STATUS_IN_PROGRESS', state: 'in', description: 'In Progress', shortDetail: '1st' }]].filter(([g]) => g));
    const ans = {};
    comeAll.forEach((g, i) => {
      if (g === gU) return;                                                                 // left out of ESPN's answer
      const L = g.line, base = L ? { homeML: L.homeML, awayML: L.awayML, homeLine: L.homeLine, homeSpreadOdds: L.homeSpreadOdds, awaySpreadOdds: L.awaySpreadOdds, total: L.total, overOdds: L.overOdds, underOdds: L.underOdds } : null;
      let nl = g === gN ? null : base;                                                      // gN: in the answer with no odds
      if (g === gM) nl = Object.assign({}, base, { total: L.total - 1, overOdds: L.underOdds, underOdds: L.overOdds });      // gM: its total moves
      const ev = espnEvent(g, nl ? espnOdds(nl, idsFor(nl, (L && L.dk && L.dk.event) || String(70000000 + i), String(900000 + i) + String(g.id).slice(-4))) : null, ST.get(g));
      (ans[g.date] = ans[g.date] || []).push(ev);
    });
    const espn2 = async url => { const m = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), day = m ? `${m[1]}-${m[2]}-${m[3]}` : ''; return { ok: true, json: async () => ({ events: /[?&]_=\d+$/.test(url) ? (ans[day] || []) : [] }) }; };
    const props2 = url => { const m = PROPS_RX.exec(url); return gK && m && m[1] === gK.id ? { ok: false, status: 503, json: async () => ({}) } : PROPS_404(url); };
    const e2 = [], w2 = await boot(AT, e2, { keepDk: true, espn: espn2, props: props2 }), d2 = w2.document, v2 = d2.getElementById('gameView'), $2 = id => d2.getElementById(id);
    const opener = gM || gR || gK || comeAll[0];
    if (!opener) console.log("  no game still to come: a press made from a game's page is not held on this state");
    else {
      betsOn(d2, opener);
      const LO = gM ? sLeg(gM, 'over', 'ou') : null, bx = () => LO ? [...v2.querySelectorAll('input[data-leg]')].find(x => x.dataset.leg === LO.id) : null;
      if (bx()) bx().click();
      const added = txt($2('ppMsg'));
      w2.__setClock(T2); $2('ppRefreshOdds').click();
      chk(await oddsDone(w2), "a press made from a game's page finishes");
      const P2 = pressS(w2), note2 = () => txt($2('ppOddsNote'));
      chk(!!P2 && eqA(Object.keys(P2.evs).sort(), sOddsDays(T2)), `the press read each day shown with a game to come (${P2 ? Object.keys(P2.evs).join(', ') : 'none'})`);
      if (gM && LO) {
        const saidW = `Over ${gM.line.total} left the builder: DraftKings' total is now ${gM.line.total - 1} (as read ${clockOf(P2.at)}).`;
        chk(/^Added to your parlay: .+ Your parlay: 1 leg\.$/.test(added) && pageOn(d2, gM.id) && ![...v2.querySelectorAll('input[data-leg]')].some(x => x.checked) && txt($2('ppMsg')) === `${saidW} Your parlay: 0 legs.` && txt($2('slipMsg')).includes(saidW),
          `a leg a Refresh odds read takes out of the builder: its box is unticked and the page's status line says the builder's own reason, never that the leg is still in the parlay ("${txt($2('ppMsg'))}"; the tick had said "${added}")`);
      } else console.log('  no game to come with a fresh total: a leg a read takes out is not held on this state');
      /* each game's own word: the model's status line (gpStatusS on the answers this window gave), and the words themselves */
      const told = [[gP, 'postponed at ESPN', /· postponed at ESPN, read .+: the published line stands until the job takes the game off\.$/, true], [gX, 'cancelled at ESPN', /· cancelled at ESPN, read .+: the published line stands until the job takes the game off\.$/, true],
        [gI, 'under way at ESPN', /· under way at ESPN, read .+: the published line stands\.$/, true], [gN, 'no line at ESPN', /· no line at ESPN, read .+: the published line stands · /, false], [gU, "not in ESPN's answer", /· not in ESPN's answer, read .+: the published line stands · /, false]];
      for (const [g, tag, rx, off] of told) {
        if (!g) { console.log(`  not enough games to come with a fresh line: a game ${tag} is not planted`); continue; }
        closeBets(d2); const b = gpWrongs(w2, g, T2, sReads(w2)[g.id] || null, { noPlayers: true }), n2 = note2();
        chk(!b.length && rx.test(n2) && (off ? !/player lines/.test(n2) && !sReads(w2)[g.id] : !/not read yet/.test(n2)), `a game ${tag} says so on its own page after the press${off ? ', and nothing of player lines that are not shown' : ', and never "player lines not read yet"'} (${n2}; ${b.slice(0, 2).join(' | ')})`);
      }
      if (gR) { closeBets(d2); betsOn(d2, gR); const pgR = pageGames(w2).find(x => x.id === gR.id), n2 = note2();
        chk(!!pgR.line && pgR.line.refreshed === true && n2 === gpStatusS(pgR, sReads(w2)[gR.id] || null, T2, undefined, P2) && !/at ESPN|ESPN's answer|stands/.test(n2), `a game whose line the press simply read says only whose line it is and when (${n2})`); }
      if (gK) { closeBets(d2); betsOn(d2, gK); const pgK = pageGames(w2).find(x => x.id === gK.id), rdK = sReads(w2)[gK.id] || null, n2 = note2();
        chk(!!rdK && rdK.status === 200 && rdK.src === 'job' && n2 === gpStatusS(pgK, rdK, T2, undefined, P2) && n2.endsWith(`couldn't read player lines at ${clockOf(P2.at)}: the read of ${clockOf(Date.parse(rdK.at))} stands.`),
          `a press that could not read a game's player lines keeps the job's read and says so on its page, with both times (${n2})`); }
      else console.log("  no game to come today or tomorrow with a job read of its player lines: an earlier read kept by a press is not planted");
      closeBets(d2);
    }
    chk(!e2.length, "no runtime error on a press made from a game's page: " + e2.join(' | '));
    w2.close();
  }
}

async function theLook() {
  console.log('THE LOOK');
  const AT = PUB + 60000;
  /* no image: the page names none, reads no club logo or colour from the state, and carries no ESPN image address */
  const script = HTML.slice(HTML.indexOf('<script>')).replace(/\/\*[\s\S]*?\*\//g, '');
  chk(!/<img\b/i.test(HTML) && !/espncdn/i.test(HTML) && !/\.(logo|color)\b/.test(script) && !/url\(/i.test(HTML.slice(0, HTML.indexOf('<script>')).replace(/\/\*[\s\S]*?\*\//g, '')), 'the page names no image: no <img>, no espncdn, no CSS url(), never a club\'s logo or colour read from the state');
  chk(!/prefers-color-scheme/i.test(HTML), "nothing in the page follows the system's colour scheme: dark is every visitor's default");
  const errs = [], w = await boot(AT, errs), d = w.document, MAP = pageMap(w);
  /* the colour map (nhl v25): every club a palette of hex colours, the tag's first; each club's tag worked out again here, its text 4.5:1
     or more on its fill, and its fill the club's own colour as written (none of the 32 needs darkening); the surfaces an outlined pill
     and badge were held on went with them: a filled tag does not stand on the ground's contrast */
  const keys = Object.keys(S.teams), missing = keys.filter(k => !MAP[k]);
  chk(!missing.length && keys.every(k => !MAP[k] || (Array.isArray(MAP[k]) && MAP[k].length >= 1 && MAP[k].every(c => typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c)))), `TEAM_COLORS has every club, each a palette of hex colours (${missing.join(', ') || 'none missing'})`);
  for (const k of keys) if (!Array.isArray(MAP[k]) || !/^#[0-9A-Fa-f]{6}$/.test(String(MAP[k][0]))) delete MAP[k];      // a club with no usable palette is failed above, once
  const lowTx = [], dark = [];
  for (const k of keys.filter(k => MAP[k])) { const t = tagOfS(MAP[k]);
    if (!(crH(t.fg, t.bg) >= 4.5)) lowTx.push(`${k} ${t.fg} on ${t.bg} ${crH(t.fg, t.bg).toFixed(2)}`);
    if (!sameHex(t.bg, MAP[k][0])) dark.push(`${k} ${MAP[k][0]} -> ${t.bg}`); }
  chk(!lowTx.length, `every club's tag text (white or #1E2230, whichever reads better) is 4.5:1 or more on its fill (${lowTx.slice(0, 4).join('; ')})`);
  chk(!dark.length, `every tag's fill is its club's own colour as written: none needs darkening to carry its text (${dark.slice(0, 4).join('; ')})`);
  /* a row's tags (nhl v28): the club's own tag, the pick's raised by weight and a shadow alone, never by another colour; no badge left */
  chk(/\.ttag\.sl-win\{font-weight:800;box-shadow:[^}]*\}/.test(HTML) && !/\.ttag\.sl-win\{[^}]*(background|color)\s*:/.test(HTML) && !/\.badge[ .{,]/.test(HTML.slice(0, HTML.indexOf('</style>'))), "a row's pick is its club's tag raised by weight and a shadow, in the tag's own colours; no badge rule left in the stylesheet");
  /* clubs that share a colour share their brand's: two clubs outside one family are 5 or more apart by CIEDE2000 */
  const famOf = {}; COLOR_FAMILIES.forEach((f, i) => f.forEach(k => { famOf[k] = i; }));
  const close = []; for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = keys[i], b = keys[j]; if (!MAP[a] || !MAP[b] || (famOf[a] !== undefined && famOf[a] === famOf[b])) continue; const dd = de2000S(MAP[a][0], MAP[b][0]); if (!(dd >= 5)) close.push(`${a}-${b} ${dd.toFixed(1)}`); }
  /* a bet button is one line where it fits and 44px tall (jsdom lays nothing out: the rules are read): it wraps between its side and its
     price and chance, never inside either, and the call's tag sits on its top edge, taking no line */
  const rule = (sel, prop) => { const r = RULES.has(w) ? RULES.get(w) : (cssWith(w, prop, /./), RULES.get(w)); const hit = r.filter(([sl, media]) => !media && sl.split(',').map(x => x.trim()).includes(sel)); return hit.length ? String(hit[hit.length - 1][2].getPropertyValue(prop)).trim() : null; };
  chk(rule('.pb-bs', 'white-space') === 'nowrap' && rule('.pb-bn', 'white-space') === 'nowrap' && rule('.pb-bet', 'flex-wrap') === 'wrap' && rule('.pb-bt.tg', 'position') === 'absolute' && rule('.pb-bet', 'position') === 'relative',
    `a bet button wraps only between its side and its price and chance, each kept whole, the call's tag on its edge taking no line (${['.pb-bs white-space', '.pb-bn white-space', '.pb-bet flex-wrap', '.pb-bt.tg position', '.pb-bet position'].map(x => { const [a2, b2] = x.split(' '); return `${x} ${rule(a2, b2)}`; }).join(', ')})`);
  chk(cssWith(w, 'min-height', /^44px$/).some(([sel, m]) => !m && sel.split(',').map(x => x.trim()).includes('.pb-bet')), 'a bet button of the board (Pick your own legs) is 44px tall');
  /* a row's two bets laid out alike (nhl v13): the page reads each button's wrap (syncBetRows) and marks a row whose either button
     wrapped .st, whose rule puts both buttons' price and chance under the side; a row with neither wrapped stays one line, and each draw
     of the cards and of Pick your own legs reads them again. jsdom lays nothing out, so the wrap is planted, a price and chance 16px under
     its side: in a row's first button, in its second, in neither, by turns. One button on one line beside one wrapped looked uneven */
  chk(rule('.pb-bb.st .pb-bs', 'flex-basis') === '100%', `a row marked .st puts each button's price and chance under its side (.pb-bb.st .pb-bs flex-basis ${rule('.pb-bb.st .pb-bs', 'flex-basis')})`);
  {
    const P0 = Object.getOwnPropertyDescriptor(w.HTMLElement.prototype, 'offsetTop'), WR = new Set();
    Object.defineProperty(w.HTMLElement.prototype, 'offsetTop', { configurable: true, get() { return this.classList && this.classList.contains('pb-bn') && this.parentElement && WR.has(this.parentElement.dataset.leg) ? 16 : 0; } });
    const plant = box => { WR.clear(); [...d.querySelectorAll(`${box} .pb-bb`)].forEach((r, i) => { const b = r.querySelectorAll(':scope > .pb-bet')[i % 3]; if (b) WR.add(b.dataset.leg); }); return WR.size; };
    const rowsOff = box => [...d.querySelectorAll(`${box} .pb-bb`)].filter(r => r.classList.contains('st') !== [...r.querySelectorAll(':scope > .pb-bet')].some(b => WR.has(b.dataset.leg))).map(r => [...r.querySelectorAll(':scope > .pb-bet')].map(b => b.dataset.leg).join(' & '));
    const held = (box, redraw, where) => {
      const n = plant(box); redraw();
      const off1 = rowsOff(box), st1 = d.querySelectorAll(`${box} .pb-bb.st`).length;
      chk(n > 0 && st1 === n && !off1.length, `${where}: a row is marked to lay out its two buttons alike exactly where either wraps (${n} planted, ${st1} marked; ${off1.slice(0, 3).join(' | ')})`);
      WR.clear(); redraw();
      const st2 = d.querySelectorAll(`${box} .pb-bb.st`).length;
      chk(st2 === 0, `${where}: drawn again with no button wrapped, no row stays marked (${st2})`);
    };
    try {
      /* the strip is drawn again with each day, so a day's button is looked up afresh each time */
      /* the board is Pick your own legs' alone since nhl v27 (a game's page draws its bets as rows) */
      const pt = d.querySelector('#tabs button[data-tab="parlays"]');
      pt.click();
      if (d.querySelector('#plLines .pb-bb')) held('#plLines', () => pt.click(), 'Pick your own legs');
      else console.log('  Pick your own legs lists no game: its rows laid out alike are not held here');
    } finally {
      if (P0) Object.defineProperty(w.HTMLElement.prototype, 'offsetTop', P0); else delete w.HTMLElement.prototype.offsetTop;
      WR.clear(); d.querySelector('#tabs button[data-tab="games"]').click();
    }
  }
  chk(!close.length && de2000S('#3D455B', '#363D52') > 0, `every two clubs that do not share a brand colour are 5 or more apart in CIEDE2000, so none is taken for another (${close.join(', ') || 'none closer'})`);
  /* each club in a colour of its own hue, as the NBA's: none grey or white but the Kings, whose colour is silver (CIELAB chroma 15 or more) */
  const grey = keys.filter(k => MAP[k] && k !== 'LA' && !(Math.hypot(...labH(MAP[k][0]).slice(1)) >= 15)).map(k => `${k} ${MAP[k][0]} ${Math.hypot(...labH(MAP[k][0]).slice(1)).toFixed(1)}`);
  chk(!grey.length, `every club but the Kings (silver) in a colour of its own hue, none grey or white (${grey.join(', ')})`);
  /* every row of every day is held in THE GAMES LIST (nhl v28); here, that nothing the cards carried is left on the tab */
  d.querySelector('#tabs button[data-tab="games"]').click();
  chk(!d.getElementById('confKey') && !d.querySelector('#tab-games .confkey, #tab-games [data-confkey]'), 'no confidence key on the Games tab');
  chk(!d.getElementById('gamesKey') && !d.getElementById('outKey') && !d.querySelector('#tab-games .pb-bets, #tab-games .out, #tab-games .drawer, #tab-games .foot, #tab-games .chip, #tab-games .conf, #tab-games .badge'), "no bets' key, no who is out's key, no bets board, chip, out row, drawer or foot on the Games tab");
  /* a made-up game that takes every branch, whatever the day holds (nhl v13; on its page since nhl v27): on a copy of the state, the first
     game to come with a fresh line and both clubs lined up gets a call on its moneyline, a puck-line side far off the market that is no
     call, a call on the total, and an injury list with players of every status (one the model does not rate), a day to day who is in the
     projected lineup, a goalie making his first start; then the same game at its puck drop. Its row, its page and its windows are held
     as any game's, and the marks these branches draw are counted */
  {
    const M = JSON.parse(STATE), G = M.games.filter(g => !sStarted(g, AT) && sFresh(g) && g.pm && S.players && S.players.teams && S.players.teams[g.away] && S.players.teams[g.home]).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
    if (!G) console.log('  no game to come lined up with a fresh line: the made-up game is skipped');
    else {
      Object.assign(G.line, { awayML: 150, homeML: -170, homeLine: -1.5, homeSpreadOdds: 200, awaySpreadOdds: -240, total: 6.5, overOdds: -110, underOdds: -110 });
      Object.assign(G, { pHome: 0.53, mlEdge: { away: 0.07, home: -0.1 }, mlPick: 'away', cover: { home: 0.5, push: 0, away: 0.5 }, plEdge: { home: 0.167, away: -0.206 }, plPick: null, ou: { over: 0.3, push: 0, under: 0.7 }, ouEdge: { over: -0.224, under: 0.176 }, ouPick: 'under' });
      const nm = (k, i) => `Plant ${k}${i}`, PG = M.props && M.props.games && M.props.games[G.id], dtdP = PG && PG.homeP && PG.homeP.skaters && PG.homeP.skaters.slice().sort((a, b) => (b.toi || 0) - (a.toi || 0) || sStr(String(a.id), String(b.id)))[0];      /* the home skater with the most ice time: inside the page's cut whatever his place by projected points */
      G.pm.away.out = [{ id: '9000001', name: nm('Row', 1), pos: 'C', status: 'Out', cost: -0.16 }, { id: '9000002', name: nm('Susp', 1), pos: 'D', status: 'Suspension', cost: 0.03 }, { id: '9000003', name: nm('Ir', 1), status: 'Injured Reserve', cost: 0.05 },
        { id: '9000004', name: nm('Ir', 2), status: 'Injured Reserve', cost: null }, { id: '9000005', name: nm('Out', 1), status: 'Out', cost: 0.01 }, { id: '9000006', name: nm('Q', 1), status: 'Questionable', cost: -0.04 }];
      G.pm.home.out = [{ id: '9000007', name: nm('Ir', 3), status: 'Injured Reserve', cost: 0.02 }];
      G.pm.away.dtd = []; G.pm.home.dtd = [dtdP ? { id: dtdP.id, name: dtdP.name, status: 'Day-To-Day' } : { id: '9000008', name: nm('Dtd', 1), status: 'Day-To-Day' }];
      if (G.pm.away.goalie) G.pm.away.goalie.debut = true;
      if (PG && PG.awayP && PG.awayP.goalie) PG.awayP.goalie.debut = true;
      const real = S; S = M;
      try {
        for (const [ms, tag] of [[AT, 'to come'], [Date.parse(G.start) + 60000, 'at its puck drop']]) {
          const e3 = [], w3 = await boot(ms, e3, { state: JSON.stringify(M) }), d3 = w3.document;
          openDay(d3, G.date);
          const c3 = cardOf(d3, G.id);
          if (!c3) { chk(false, `the made-up game ${tag}: no row for ${G.id}`); w3.close(); continue; }
          const bad = rowWrongs(w3, c3, G, ms, pageMap(w3), null);
          chk(!bad.length, `the made-up game's row ${tag}: ${bad.slice(0, 3).join(' | ')}`);
          const badP = gpWrongs(w3, G, ms, null, { noPlayers: ms !== AT }), v3 = d3.getElementById('gameView');
          chk(!badP.length, `the made-up game's page ${tag}: ${badP.slice(0, 4).join(' | ')}`);
          const vals = [...v3.querySelectorAll('.gbets .pb-valmark')].map(x => txt(x.closest('tr').querySelector('.thr')).replace(/Value$/, '') + '@' + x.closest('.statblk').dataset.gb);
          if (ms === AT) {
            chk(eqA(vals, ['To win@away', 'Under 6.5@total']) && /7 points above/.test(v3.querySelector('.gbets .pb-valmark').title) && !/far off/i.test(txt(v3)) && v3.querySelectorAll('.gbets input[data-leg]').length === 6,
              `the made-up game ${tag} takes every branch of Game bets: Value on the moneyline's call and the total's, none on a puck-line side that is no call, nothing called far off, six boxes (${vals.join(', ')})`);
            const outA = v3.querySelector(`[data-gp-out="${G.away}"]`), outH = v3.querySelector(`[data-gp-out="${G.home}"]`);
            chk(!!outA && outA.querySelectorAll('b').length === 6 && /Plant Row1 \(C, out\), Plant Susp1 \(D, suspension\), Plant Ir1 \(injured reserve\)/.test(txt(outA)) && !!outH && txt(outH) === 'Out: Plant Ir3 (injured reserve).' && !/-0\.16|goals/.test(txt(outA)), `"Out:" names everyone out with his position and status, no figure (${outA ? txt(outA) : 'none'})`);
            if (dtdP) chk(v3.querySelectorAll('.plrbtn .inj').length === 1 && !!v3.querySelector(`.plrbtn[data-open="${dtdP.id}"] .inj`), `the day to day who is in the lineup wears the DTD chip on his row, and nobody else (${v3.querySelectorAll('.plrbtn .inj').length})`);
            if (PG && PG.awayP && PG.awayP.goalie) chk(/first NHL start/.test(txt(v3.querySelector(`.plrbtn[data-open="${PG.awayP.goalie.id}"] .who`))), 'a goalie making his first start says so on his row');
            const badW = gpWindowWrongs(w3, G, ms);
            chk(!badW.length, `the made-up game's windows: ${badW.slice(0, 3).join(' | ')}`);
            v3.querySelector('[data-gp-pop="lineups"]').click();
            const lw = d3.getElementById('gsModal'), cols = [...lw.querySelectorAll('.lu-club')];
            chk(cols.length === 2 && cols[0].querySelectorAll('.lu-out li').length === 6 && cols[1].querySelectorAll('.lu-out li').length === 1 && txt(cols[0].querySelector('.lu-out li')) === 'Plant Row1 Out-0.16' && [...cols[0].querySelectorAll('.lu-out li .v')].some(x => txt(x) === '–') && /^Day to day, in the lineup: /.test(txt(cols[1].querySelector('.lu-day'))) && (!G.pm.away.goalie || /first NHL start/.test(txt(cols[0].querySelector('.lu-str')))),
              `its Lineups window lists the seven out with their figures, most valuable first, a dash for the one the model does not rate, the day to day and the first start (${cols.map(c => txt(c.querySelector('.lu-out'))).join(' | ').slice(0, 200)})`);
            d3.getElementById('gsClose').click();
          } else { const calls = [...v3.querySelectorAll('.gbets .pb-valmark')].map(x => `${txt(x)}:${txt(x.closest('tr').querySelector('.thr')).slice(0, -txt(x).length)}@${x.closest('.statblk').dataset.gb}`);
            chk(eqA(calls, ['Call:To win@away', 'Call:Under 6.5@total']) && !/Value/.test(txt(v3.querySelector('.gbets'))) && !v3.querySelector('input[data-leg], input[data-pp-add], [data-gp-out], .inj') && !!v3.querySelector('.gp-live') && v3.querySelectorAll('.gbets .res').length === 6, `the made-up game ${tag}: no Value mark, no box, no outs line and no DTD chip once the puck has dropped; a grade to come in each box's place, and the two sides the call took still marked, Call, beside it (${calls.join(', ')}; ${v3.querySelectorAll('.gbets .res').length} grades)`); }
          closeBets(d3);
          chk(!e3.length, `no runtime error on the made-up game ${tag}: ${e3.join(' | ')}`);
          w3.close();
        }
      } finally { S = real; }
    }
  }
  /* nhl v25: the tab bar is words alone, the NFL hub's: no count on a tab (Games and Parlay Builder carried one), on any tab, with a
     leg in the builder or without */
  const tabWords = { games: 'Games', suggest: 'Suggested Parlays', parlays: 'Parlay Builder', xparlays: 'X Parlays', ratings: 'Team Rankings', players: 'ELO Ratings', pickem: "Pick'em Record", xbets: 'X Bet Log' };
  const bareTabs = dd => [...dd.querySelectorAll('#tabs button')].every(b => !b.children.length && txt(b) === tabWords[b.dataset.tab]) && !dd.getElementById('gameCount') && !dd.getElementById('legCount');
  chk(bareTabs(d), `every tab is its words alone, no count on any (${[...d.querySelectorAll('#tabs button')].map(txt).join(' | ')})`);
  /* 44px: the toolbar, the tabs, ELO Ratings' seven pills and its search */
  const tall = el => !!el && w.getComputedStyle(el).minHeight === '44px';
  chk(tall(d.getElementById('slateNow')) && [...d.querySelectorAll('#tabs button')].every(tall) && d.querySelectorAll('#pePos button').length === 7 && [...d.querySelectorAll('#pePos button')].every(tall) && tall(d.getElementById('peSearch')), "Refresh scores, every tab, ELO Ratings' seven pills and its search are 44px tall");
  /* nhl v25, the NFL hub's controls at the NHL's 44px: every button, select, text box, amount box, segmented choice and checkbox chip on
     the page, and the header's light/dark switch 44px by 44px */
  { const ctl = [...d.querySelectorAll('.btn, select, input[type=text], input[type=search], .pb-amt, .pb-seg button, .seg button, .pb-chip, .pe-pos button')], low = ctl.filter(el => !tall(el));
    chk(ctl.length >= 30 && !low.length && d.querySelectorAll('.btn').length >= 15 && d.querySelectorAll('.pb-chip').length === 5 && d.querySelectorAll('#pbMix button').length === 3, `every button, select, box, segmented choice and checkbox chip is 44px tall (${ctl.length} held; under: ${low.slice(0, 4).map(el => el.id || el.className || txt(el)).join(', ') || 'none'})`);
    const sw = d.querySelector('header [data-theme-toggle]'), cs = sw && w.getComputedStyle(sw);
    chk(!!cs && cs.minHeight === '44px' && cs.minWidth === '44px' && cs.width === '44px' && cs.height === '44px', `the light/dark switch is 44px by 44px (${cs && [cs.width, cs.height].join(' x ')})`); }
  /* a puck drop on the watch, on another tab: the bar stays words alone */
  { const today = etDate(AT), nextToday = S.games.filter(g => g.date === today && !sStarted(g, AT)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
    if (nextToday) {
      const errsW = [], wW = await boot(AT, errsW, { hash: 'ratings' }), dW = wW.document;
      const at = Date.parse(nextToday.start) + 60000; wW.__setClock(at); dW.dispatchEvent(new wW.Event('visibilitychange'));
      chk(bareTabs(dW), `after ${nextToday.id}'s puck drop the bar is still words alone (${[...dW.querySelectorAll('#tabs button')].map(txt).join(' | ')})`);
      chk(!errsW.length, 'no runtime error on the watch at a puck drop: ' + errsW.join(' | '));
      wW.close();
    } }
  /* every tag (nhl v25): a club's abbreviation, filled in that club's colour by this smoke's own sums (its text and its edge with it);
     beside a club's name, the same club, hidden from a screen reader. And no club is drawn any other way: the outlined pill is gone
     (.pill is the NFL's small grey label now, never a club) */
  const byAbbr = new Map(keys.map(k => [S.teams[k].abbr, k]));
  const pills = () => {
    const wrong = [];
    for (const p of d.querySelectorAll('.ttag')) {
      const k = byAbbr.get(txt(p)); if (!k || !MAP[k]) { wrong.push(`${txt(p)}: no club`); continue; }
      const tw0 = tagWrong(p, MAP[k]); if (tw0) { wrong.push(`${txt(p)} ${tw0}`); continue; }
      const tw = p.parentElement && p.parentElement.classList.contains('tw') ? p.parentElement : null;
      if (tw && (txt(tw.querySelector('.tn')) !== S.teams[k].short || p.getAttribute('aria-hidden') !== 'true')) wrong.push(`${txt(p)} beside ${txt(tw.querySelector('.tn'))}`);
    }
    for (const p of d.querySelectorAll('.pill')) if (p.style.getPropertyValue('--tc') || /^[A-Z]{2,4}$/.test(txt(p)) && byAbbr.has(txt(p))) wrong.push(`${txt(p)}: a club in a .pill`);
    return wrong;
  };
  for (const t of ['ratings', 'players', 'parlays', 'pickem', 'games']) { d.querySelector(`#tabs button[data-tab="${t}"]`).click(); if (t === 'pickem' && d.querySelector('#pkPicksW').hidden) d.querySelector('#pkShow').click(); const wr = pills(); chk(d.querySelectorAll('.ttag').length > 0 && !wr.length, `${t}: every tag is its club's abbreviation filled in its club's colour, the club's own name beside it (${d.querySelectorAll('.ttag').length} tags; ${wr.slice(0, 4).join('; ')})`); }
  /* the tables: the column each is in order of, marked. Team Rankings lights none (nhl v26, the NFL's: one order, by Elo, and no sort) */
  d.querySelector('#tabs button[data-tab="ratings"]').click();
  chk(!!d.querySelector('#tab-ratings table.rt-v thead th') && !d.querySelector('#tab-ratings th.on'), 'Team Rankings lights no heading: its one order is the Elo, and it does not sort');
  /* no Playoff tab (nhl v14, the owner's call) and no Standings tab (nhl v26: Team Rankings took its place and Power Ratings'): no button,
     section, bracket, odds table, division table or conference select; Team Rankings keeps the Playoff and Cup columns. The old addresses
     are held in TEAM RANKINGS */
  chk(!d.querySelector('#tabs button[data-tab="playoff"]') && !d.getElementById('tab-playoff') && !d.getElementById('bracket') && !d.getElementById('poTable'), 'no Playoff tab: no button, section, bracket or odds table');
  chk(!d.querySelector('#tabs button[data-tab="standings"]') && !d.getElementById('tab-standings') && !d.getElementById('standings') && !d.getElementById('ratConf') && !d.getElementById('ratTable') && d.querySelectorAll('#tabs button[data-tab="ratings"]').length === 1,
    'no Standings tab: no button, section or division table, and no conference select or old Power Ratings table; one Team Rankings button');
  /* ELO Ratings (nhl v29, the NFL's) lights none either: a pill chooses the order, and no heading sorts */
  d.querySelector('#tabs button[data-tab="players"]').click();
  chk(!d.querySelector('#tab-players th.on') && !d.querySelector('#tab-players th[aria-sort]') && !d.getElementById('plTable') && !d.getElementById('plTeams') && !d.getElementById('plKind') && !d.getElementById('plTeam') && !d.getElementById('plSources'), 'ELO Ratings lights no heading, and the Players tab\'s tables, switch, club select and sources line are gone');
  /* every column at every width: no rule in the page's CSS, in any media query, hides a table, a row or a cell (so a phone has every number a
     desktop has, a swipe away); each table scrolls sideways inside its own wrapper; its club or player column is the one held at the left;
     and each table has the columns it is meant to, checked header by header (ELO Ratings' three, nhl v29: the players', the goalies'
     and the clubs', the NFL's columns with the goals-a-game figures the Elo is set from) */
  const hiders = [], walkCss = rules => { for (const r of rules || []) { if (r.cssRules && !r.selectorText) walkCss(r.cssRules); else if (r.style && /^none$/i.test(String(r.style.getPropertyValue('display')).trim())) hiders.push(r.selectorText); } };
  for (const sh of d.styleSheets) walkCss(sh.cssRules);
  const hits = (el, sel) => { try { return el.matches(sel); } catch (e) { return sel.split(',').some(x => { try { return el.matches(x); } catch (e2) { return false; } }); } };
  const scrollers = []; const walkO = rules => { for (const r of rules || []) { if (r.cssRules && !r.selectorText) walkO(r.cssRules); else if (r.style && /^(auto|scroll)$/.test(String(r.style.getPropertyValue('overflow-x') || r.style.getPropertyValue('overflow')).trim().split(/\s+/).pop())) scrollers.push(r.selectorText); } };
  for (const sh of d.styleSheets) walkO(sh.cssRules);
  chk(hiders.length > 0 && scrollers.length > 0, `the page's CSS read: ${hiders.length} rules that hide, ${scrollers.length} that scroll`);
  /* nhl v26: Team Rankings' one table (the NFL's eight columns with goals a game for its EPA pair, and PTS, Playoff and Cup: what the
     Standings' fourteen and Power Ratings' ten gave, less the columns the record and the two rates carry) and its absences table */
  const PKD = sPkData(S);
  const COLS = { ratings: TR_HEAD, absences: TR_ABS,
    pePlayers: PE_HEAD.F, peGoalies: PE_HEAD.G, peClubs: PE_HEAD.U,
    /* the Pick'em Record's three (nhl v30, the NFL's): the week grid, a column a week played (its Monday over its games) and the season, its
       models' column headed by no word; every pick of a day, the game and a column a model; the bets record, what the Record tab's two tables held */
    pkWeeks: [''].concat(PKD.weeks.map(x => `${sPkShort(x)}${PKD.games[x]} game${PKD.games[x] === 1 ? '' : 's'}`), ['Season']), pkPicks: ['Game'].concat(PK_S.map(m => m[1])), pkBets: ['When', 'Straight up', 'Moneyline', 'Puck line', 'Totals'] };
  const STICK = { ratings: 'Team', absences: 'Player', pePlayers: 'Player', peGoalies: 'Player', peClubs: 'Team', pkWeeks: '', pkPicks: 'Game', pkBets: 'When' };
  /* a heading as a desktop shows it: its words without the short form a phone shows instead (.t-narrow) */
  const wideTxt = th => { const c = th.cloneNode(true); for (const x of c.querySelectorAll('.t-narrow')) x.remove(); return txt(c); };
  const lost = [], seen = [];
  const unheld = cssWith(w, 'position', /^(?!sticky$).+/).concat(cssWith(w, 'left', /^(?!0(px)?$).+/));      // every rule, under any media, that sets a position other than sticky, or a left other than 0
  const tablesHeld = (tab, keyOf) => {
    for (const tb of d.querySelectorAll(`#tab-${tab} table`)) {      // every table of the tab (Team Rankings' two, ELO Ratings' one and the Pick'em Record's grids are the NFL's plain tables, not table.tbl)
      if (!tb.rows.length) continue;                         // a table the tab has put away, nothing drawn in it (the Pick'em Record's before any final, its picks until asked)
      const key = keyOf(tb), ths = [...tb.querySelectorAll('thead th')], heads = ths.map(wideTxt), want = COLS[key]; seen.push(key);
      if (!want || !eqA(heads, want)) lost.push(`${key}: columns ${JSON.stringify(heads)}, want ${JSON.stringify(want)}`);
      const wr = tb.parentElement;
      if (!wr || !scrollers.some(sel => hits(wr, sel))) lost.push(`${key}: not inside a wrapper that scrolls sideways (${wr && wr.className})`);
      /* nhl v25: the page clips every table for its rounded corners, and a clipped table is the box its held column would stick in (it
         would never scroll): a table in its wrapper is let out of the clip */
      if (w.getComputedStyle(tb).overflow !== 'visible' || !/(^|[\s},])table\{[^}]*overflow:hidden/.test(HTML)) lost.push(`${key}: its table is clipped (overflow ${w.getComputedStyle(tb).overflow}), so its held column cannot stick`);
      for (const el of [tb, ...tb.querySelectorAll('thead, tbody, tr, th, td')]) { const h = hiders.find(sel => hits(el, sel)); if (h) { lost.push(`${key}: ${el.tagName.toLowerCase()} "${txt(el).slice(0, 30)}" hidden by ${h}`); break; } }
      const si = heads.indexOf(STICK[key]), rows = [...tb.querySelectorAll('tr')];
      if (si < 0 || !rows.length || rows.some(r => !r.cells[si] || !r.cells[si].classList.contains('sk') || [...r.cells].filter(c => c.classList.contains('sk')).length !== 1)) lost.push(`${key}: the ${STICK[key]} column is not the one held at the left`);
      /* and no rule, in any media query, lets go of it: a rule that sets a held cell's position says sticky, and none moves its left off 0
         (a phone's `.sk{position:static}` once let the player scroll away with the figures, and the checks above read no media rule) */
      else for (const r of [rows[0], rows[rows.length - 1]]) { const c = r.cells[si], un = unheld.find(([sel]) => hits(c, sel));
        if (un) { lost.push(`${key}: the held ${STICK[key]} column is let go by ${un[0]}${un[1] ? ' under ' + un[1] : ''}`); break; } }
      if (rows.some(r => r.cells.length !== ths.length)) lost.push(`${key}: a row with a cell missing`);
    }
  };
  for (const t of ['ratings', 'players', 'pickem']) {
    d.querySelector(`#tabs button[data-tab="${t}"]`).click();
    if (t === 'pickem' && d.querySelector('#pkPicksW').hidden) d.querySelector('#pkShow').click();
    if (t === 'players') { if (S.players) for (const [v, key] of [['F', 'pePlayers'], ['G', 'peGoalies'], ['str', 'peClubs'], ['F', null]]) { d.querySelector(`#pePos button[data-view="${v}"]`).click(); if (key && d.querySelector('#peTable tbody tr')) tablesHeld(t, () => key); } }
    else tablesHeld(t, tb => tb.id || (tb.classList.contains('rt-v') ? 'ratings' : tb.closest('#injCard') ? 'absences' : 'a table with no name'));
  }
  chk(!lost.length && seen.includes('ratings') && seen.includes('pkWeeks') === PKD.fin.length > 0 && seen.includes('pkPicks') === S.games.length > 0 && seen.includes('pkBets') === (!!S.record && S.record.su.w + S.record.su.l > 0) && seen.includes('absences') === sTrOuts(S).length > 0 && (!S.players || [['pePlayers', sPeRows(S, 'F').rows.length], ['peGoalies', sPeRows(S, 'G').rows.length], ['peClubs', Object.keys(S.players.teams || {}).length]].every(([k, n]) => !n || seen.includes(k))), `every table keeps every column at every width, scrolling sideways in its wrapper with its club or player held (${seen.length} tables; ${lost.slice(0, 4).join(' | ')})`);
  /* Team Rankings' table (nhl v26) is laid out fixed on a width for each of its eleven columns, never squeezed under what they add up to
     (it scrolls in its wrapper instead), so every heading stays on one line (the NFL shares what is left among its figure columns, and
     its headings break in two on a tablet); on a phone it is laid out by its own words, every cell's width let go. jsdom lays nothing
     out, so this reads the rules */
  d.querySelector('#tabs button[data-tab="ratings"]').click();
  { const pxN = x => parseFloat(String(x || '').replace('px', '')) || 0, rt = d.querySelector('#tab-ratings table.rt-v');
    const rtW = rt ? [...rt.querySelectorAll('thead th')].map(th => w.getComputedStyle(th).width) : [], tdW = rt && rt.querySelector('tbody tr') ? [...rt.querySelector('tbody tr').cells].map(td => w.getComputedStyle(td).whiteSpace) : [];
    cssWith(w, 'width', /./);
    const phone = RULES.get(w).filter(([sel, md]) => /max-width:\s*640px/.test(md) && /table\.rt-v/.test(sel));
    const phoneAuto = phone.some(([sel, , st]) => sel.trim() === 'table.rt-v' && st.getPropertyValue('table-layout') === 'auto') && phone.some(([sel, , st]) => /th:nth-child\(n\)/.test(sel) && /td:nth-child\(n\)/.test(sel) && st.getPropertyValue('width') === 'auto');
    chk(!!rt && w.getComputedStyle(rt).tableLayout === 'fixed' && rtW.length === 11 && rtW.every(x => /^\d+(\.\d+)?px$/.test(x)) && pxN(w.getComputedStyle(rt).minWidth) >= rtW.reduce((a, x) => a + pxN(x), 0) && tdW.length === 11 && tdW.every(x => x === 'nowrap') && phoneAuto,
      `Team Rankings' table laid out fixed on its eleven columns' widths, never squeezed under them and no cell broken, and by its own words on a phone (${rtW.join(',') || 'none'}; min ${rt && w.getComputedStyle(rt).minWidth}; phone auto ${phoneAuto})`); }
  /* a hidden name in a table (on a phone a club is its pill, its name absolute for a screen reader) is held by a positioned box inside its
     table, never set against the page: a club cell that was not the held (sticky) column once set the Players' 400 names against main,
     outside the table's scrolling box, and ran the tab on some 14,000px past its last table on a phone (ELO Ratings, nhl v29, hides a
     club's name at every width, in the players' Team column and the clubs' held one). jsdom lays nothing out, so this reads the rules:
     an element some rule sets absolute has an ancestor inside its table that a rule under the same media (or none) positions */
  const absR = cssWith(w, 'position', /^absolute$/), posR = cssWith(w, 'position', /^(relative|sticky|absolute|fixed)$/), loose = [];
  let absN = 0;
  let absRt = 0, absPe = 0;
  for (const t of ['ratings', 'players', 'pickem']) {
    d.querySelector(`#tabs button[data-tab="${t}"]`).click();
    for (const kind of t === 'players' && S.players ? ['F', 'G', 'str'] : [null]) {
      if (kind) d.querySelector(`#pePos button[data-view="${kind}"]`).click();
      for (const tb of d.querySelectorAll(`#tab-${t} table`)) for (const el of tb.querySelectorAll('span, div, b, i, small, em')) {
        const a = absR.find(([sel]) => hitsSel(el, sel)); if (!a) continue;
        absN++; if (t === 'ratings') absRt++; if (kind === 'str') absPe++;
        let held = false; for (let q = el.parentElement; q && q !== tb.parentElement; q = q.parentElement) if (posR.some(([sel, md]) => (md === '' || md === a[1]) && hitsSel(q, sel))) { held = true; break; }
        if (!held) { loose.push(`${tb.id || t}${kind ? ' ' + kind : ''}: ${el.className} "${txt(el).slice(0, 20)}" in ${el.parentElement && el.parentElement.parentElement && el.parentElement.parentElement.tagName.toLowerCase()} (${a[0]})`); break; }
      }
    }
    if (t === 'players' && S.players) d.querySelector('#pePos button[data-view="F"]').click();
  }
  chk(absN > 0 && absRt === Object.keys(S.teams).length && (!S.players || absPe === Object.keys(S.players.teams || {}).length) && !loose.length, `every name a table hides for a screen reader is held by a positioned box inside its table, Team Rankings' ${Object.keys(S.teams).length} and ELO Ratings' clubs among them (${absN} held, ${absRt} in Team Rankings, ${absPe} in the clubs' table; ${loose.slice(0, 3).join(' | ')})`);
  /* Pick your own legs (no chips there): a side far off the market says so on its own button, both numbers in view; on Both days where
     offered, so tomorrow's games are held too */
  d.querySelector('#tabs button[data-tab="parlays"]').click();
  const day0 = (d.querySelector('#pbDay button.on') || { dataset: {} }).dataset.day, bothB = d.querySelector('#pbDay button[data-day="both"]'); if (bothB) bothB.click();
  let farN = 0, farB = 0; const farBad = [];
  for (const b of d.querySelectorAll('#plLines button[data-leg]')) {
    const [gid, s, k] = b.dataset.leg.split('|'), g = S.games.find(x => x.id === gid), B = g && sLeg(g, s, k); if (!B) continue;
    const bad1 = betWrong(b, B, s); farB++; if (isFarS(B)) farN++;
    if (bad1) farBad.push(bad1);
  }
  chk(!farBad.length, `Pick your own legs: each button its one line, the call's tag with its edge, a side far off the market saying so on its button with model and market in view (${farB} buttons, ${farN} far; ${farBad.slice(0, 3).join(' | ')})`);
  console.log(`  Pick your own legs: ${farB} bet buttons held, ${farN} of them far off the market`);
  if (bothB && day0) { const b0 = d.querySelector(`#pbDay button[data-day="${day0}"]`); if (b0) b0.click(); }
  /* no image after every tab, every day, a game's page, its windows and the card window */
  d.querySelector('#tabs button[data-tab="pickem"]').click();
  chk(!d.querySelectorAll('#tab-pickem img').length && (sPkData(S).weeks.length ? !!d.querySelector('#pkChart svg.pk-chart') && d.querySelector('#pkNone').hidden : !d.querySelector('#pkNone').hidden && /No game graded yet/.test(txt(d.querySelector('#pkNone')))), "the Pick'em tab: its chart drawn inline (or, before any final, said not to be), no image");
  d.querySelector('#tabs button[data-tab="games"]').click();
  for (const dd of dayList(d)) openDay(d, dd);
  const gI = S.games.filter(g => dayList(d).includes(g.date)).find(g => S.props && S.props.games && S.props.games[g.id]) || S.games.find(g => dayList(d).includes(g.date));
  if (gI && betsOn(d, gI)) { const v = d.getElementById('gameView'), r1 = v.querySelector('button.plrbtn'); if (r1) r1.click(); for (const k of ['units', 'lineups', 'stats']) { v.querySelector(`[data-gp-pop="${k}"]`).click(); chk(!d.querySelectorAll('img').length, `no image with a game's page and its ${k} window open`); d.getElementById('gsClose').click(); } closeBets(d); }
  d.querySelector('#tabs button[data-tab="suggest"]').click();
  const fin = d.querySelector('[data-sp-finish]');
  if (fin) { fin.click(); chk(!d.getElementById('pcWin').hidden && !d.querySelectorAll('img').length, 'no image with the parlay card open'); d.getElementById('pcClose').click(); }
  chk(!d.querySelectorAll('img').length, `no image anywhere after every tab, day, page and window (${d.querySelectorAll('img').length})`);
  /* a suggested leg's Add and a Top 30 line's: a word, Add or Added, never an icon */
  for (const sel of ['#spBody button.sp-add', '#pbBody button.t30-add']) {
    if (sel.startsWith('#pbBody')) d.querySelector('#tabs button[data-tab="parlays"]').click();
    const ab = d.querySelector(sel);
    if (!ab) continue;
    const key = ab.dataset.leg, was = ab.getAttribute('aria-pressed') === 'true';
    chk(txt(ab) === (was ? 'Added' : 'Add') && !ab.querySelector('svg') && w.getComputedStyle(ab).minHeight === '44px', `${sel}: says ${was ? 'Added' : 'Add'}, a word, 44px (${txt(ab)})`);
    ab.click(); const a2 = d.querySelector(`${sel}[data-leg="${key}"]`);
    chk(!!a2 && txt(a2) === (was ? 'Add' : 'Added') && a2.getAttribute('aria-pressed') === String(!was), `${sel}: pressed, it says ${was ? 'Add' : 'Added'} (${a2 && txt(a2)})`);
    { const lit = el => cssWith(w, 'border-color', /var\(--ice\)/).some(([sl, m]) => !m && hitsSel(el, sl)), on = was ? ab : a2, off = was ? a2 : ab;
      chk(!!on && !!off && lit(on) && !lit(off), `${sel}: Added is lit ice and Add is not, by the page's own rules`); }
    if (a2) a2.click();
  }
  /* nhl v26: the tier shields too (the NFL's, an inline SVG beside a rating, each named for a screen reader), and their gradients, defined
     once in a zero-size SVG the first shield appends to the body (#peDefs) */
  { const defs = [...d.querySelectorAll('#peDefs svg')], shields = [...d.querySelectorAll('svg.tierbadge')];
    chk(!d.querySelector('svg:not(.pe-spark):not(.pe-cv):not(.pk-chart):not(.ht-sun):not(.ht-moon):not(.tierbadge):not(#peDefs svg)') && !d.querySelector('svg.spark') && [...d.querySelectorAll('svg.pe-spark, svg.pe-cv')].every(x => !!x.closest('#tab-players') && x.getAttribute('aria-hidden') === 'true') && [...d.querySelectorAll('svg.ht-sun, svg.ht-moon')].every(x => !!x.closest('header [data-theme-toggle]')) && d.querySelectorAll('svg.ht-sun, svg.ht-moon').length === 2
      && shields.length >= Object.keys(S.teams).length && shields.every(x => x.getAttribute('role') === 'img' && / tier$/.test(x.getAttribute('aria-label') || '') && !!x.querySelector('title')) && d.querySelectorAll('#peDefs').length === 1 && d.getElementById('peDefs').parentElement === d.body && defs.length === 1 && defs[0].getAttribute('aria-hidden') === 'true' && defs[0].getAttribute('width') === '0' && defs[0].getAttribute('height') === '0',
      `no icon drawn on the page but ELO Ratings' trend lines and histogram (each hidden from a screen reader: the cell's title and the chart's label say them), the Pick'em chart, the tier shields (each named, their gradients once in a zero-size SVG) and the two glyphs of the header's light/dark switch (${shields.length} shields, ${defs.length} defs)`); }
  chk(!errs.length, 'no runtime error in THE LOOK: ' + errs.join(' | '));
  holdRequests(w, 'THE LOOK');
}

/* ---------- THE SUGGESTED PARLAYS' RECORD (nhl v15, tools/suggest.js) ----------
   The ledger by suggest.js's own check (its rules, and against the last commit's: NHL_PREV_SUGGEST, else git's
   HEAD:data/suggest_ledger.json); the state's record its summary; every day still to lock with a line read at the publish taken,
   the page's own levels on it at the publish and this smoke's brute force's on its own pool; and the panel's record row worked out
   from the state, pill by pill, title by title */
/* ---------- THE PICK'EM RECORD (nhl v19; the NFL hub's anatomy with the Record tab folded in, nhl v30) ----------
   The Pick'em tab worked out here from the state by rules of its own: every final with a winner, straight up; each model's pick read
   off the game's call as frozen at puck drop (the call its own side, `pick`; the Team Elo the club ratings' chance, the
   Elo's view kept beside a player-model call, else the call's chance; DraftKings the moneyline favourite by the two prices, the home
   side where they are level); the week Monday to Sunday by the game's Eastern date. The six tiles (DraftKings' record; the call
   straight up in each of the Games tab's four confidence bands, cut on the chance rounded as a row writes it; how far DraftKings'
   total was from the goals scored), the legend, the chart's lines week by week with their end labels and a week's own numbers on a
   hover or a tap, the chart's geometry in its own coordinates (sPkGeom: the axis's figures and step, the units, every point and dot,
   the weeks' names, the end labels' order and place, every word inside the drawing) at 900 wide and at boxes 242, 320, 200 and 1400
   wide, the week's numbers kept inside the box, the week grid with its shading, the bets record (the state's `record`, and on the
   state as given the record worked out again from its finals and calls), the line on calls made before the injury report, and every
   pick of a day (each day by its weekday and date; the day it opens on, a past day); the old addresses (#record, a stored `record`
   tab). On the state, on a copy with no final, and on a copy of one month planting an unlined final, a game whose two ratings part, a
   level price, a model's own call over its backtest, a final with neither, a total and a puck line that push, a band with no game, a
   chance that rounds up into a band and an away pick at pHome 0.455 */
const PK_S = [['alpha', 'Alpha'], ['joker', 'The Joker'], ['elom', 'ELO Model'], ['call', 'The call'], ['elo', 'Team Elo'], ['dk', 'DraftKings']];
const PK_MK = { alpha: 'alpha', joker: 'joker', elom: 'elo' };
/* one of the NFL's three on a game: the call frozen with the game's own (`models`), else, with none, the state's backtest of it */
function sPkModel(g, id, St) {
  const k = PK_MK[id], isO = x => !!x && typeof x === 'object' && !Array.isArray(x);
  if (isO(g.models)) return isO(g.models[k]) ? { c: g.models[k], bt: false } : null;
  const b = St && St.models && St.models.backtest && St.models.backtest.games ? St.models.backtest.games[g.id] : null;
  return isO(b) && isO(b[k]) ? { c: b[k], bt: true } : null;
}
const MON_S = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MON_L = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sImp = o => o < 0 ? -o / (100 - o) : 100 / (100 + o);
const sPkLined = L => !!L && [L.homeML, L.awayML].every(v => v !== null && v !== undefined && v !== '' && isFinite(v) && +v !== 0);
function sPkPick(g, id, St = S) {
  const num = v => typeof v === 'number' && isFinite(v), side = p => num(p) ? (p >= 0.5 ? 'home' : 'away') : null;
  if (PK_MK[id]) { const x = sPkModel(g, id, St); return x ? side(x.c.pHome) : null; }
  if (id === 'call') return g.pick === 'home' || g.pick === 'away' ? g.pick : side(g.pHome);
  if (id === 'elo') return side(g.by === 'players' ? g.elo && g.elo.pHome : g.pHome);
  return sPkLined(g.line) ? (sImp(+g.line.homeML) >= sImp(+g.line.awayML) ? 'home' : 'away') : null;
}
const sPkWeek = d => { const t = Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)); return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10); };
const sPkShort = d => `${MON_S[+d.slice(5, 7) - 1]} ${+d.slice(8, 10)}`;
const sPkRec = r => `${r.w}–${r.l}`;
const sPkSigned = n => n > 0 ? '+' + n : n < 0 ? '−' + -n : '0';
const sPkWin = g => g.hs > g.as ? 'home' : g.as > g.hs ? 'away' : null;
function sPkData(St) {
  const fin = St.games.filter(g => g.state === 'final' && typeof g.hs === 'number' && typeof g.as === 'number' && g.hs !== g.as);
  const weeks = [...new Set(fin.map(g => sPkWeek(g.date)))].sort();
  const rec = {}, vs = {}, games = {}, miss = [];
  for (const [id] of PK_S) { rec[id] = { w: 0, l: 0 }; for (const wk of weeks) rec[id][wk] = { w: 0, l: 0 }; if (id !== 'dk') vs[id] = {}; }
  for (const g of fin) {
    const win = sPkWin(g), wk = sPkWeek(g.date), right = {};
    games[wk] = (games[wk] || 0) + 1;
    for (const [id] of PK_S) { const p = sPkPick(g, id, St); if (!p) continue; right[id] = p === win; const k = right[id] ? 'w' : 'l'; rec[id][k]++; rec[id][wk][k]++; }
    for (const id of Object.keys(vs)) if (id in right && 'dk' in right) vs[id][wk] = (vs[id][wk] || 0) + right[id] - right.dk;
    if (g.line && typeof g.line.total === 'number' && isFinite(g.line.total)) miss.push(Math.abs(g.hs + g.as - g.line.total));
  }
  const cum = {}; for (const id of Object.keys(vs)) { let c = 0; cum[id] = weeks.map(w => (c += vs[id][w] || 0)); }
  return { fin, weeks, rec, cum, games, missN: miss.length, miss: miss.length ? miss.reduce((a, x) => a + x, 0) / miss.length : null };
}
/* the call straight up in the Games tab's four confidence bands: every game the job graded, by its pick's chance rounded to a whole
   percentage as a row writes it (so 54.51% is 55%, a LOW pick; the chance to four places first, so an away pick at pHome 0.455 is 55%
   too, though 1 - 0.455 is 0.54499999... in floating point) */
const PK_BANDS_S = [['high', 65, 'high confidence'], ['med', 60, 'medium'], ['low', 55, 'low'], ['coin', 0, '50/50']];
const sPkConf = g => { if (typeof g.pHome !== 'number' || !isFinite(g.pHome)) return null; const side = g.pick === 'home' || g.pick === 'away' ? g.pick : g.pHome >= 0.5 ? 'home' : 'away'; return Math.round(Math.round((side === 'home' ? g.pHome : 1 - g.pHome) * 1e4) / 100); };
function sPkBands(St) {
  const B = {}; for (const [k] of PK_BANDS_S) B[k] = { w: 0, l: 0 };
  for (const g of St.games) { const c = g.result && typeof g.result.su === 'boolean' ? sPkConf(g) : null; if (c !== null) B[PK_BANDS_S.find(x => c >= x[1])[0]][g.result.su ? 'w' : 'l']++; }
  return B;
}
/* a final graded again from its score and its call, the job's rule: straight up on the pick; the moneyline side taken; the puck line
   and the total on the line's own number where a side was taken, a push where the number lands on it */
function sPkGrade(g) {
  const has = v => v !== null && v !== undefined;
  if (g.state !== 'final' || !has(g.hs)) return null;                // the job grades a final with a score
  const margin = g.hs - g.as, total = g.hs + g.as, L = g.line, r = { su: (margin > 0) === (g.pick === 'home') };
  if (g.mlPick) r.ml = (margin > 0) === (g.mlPick === 'home') ? 'win' : 'loss';
  if (L && has(L.homeLine) && g.plPick) { const c = margin + L.homeLine, home = c > 0 ? 'win' : c < 0 ? 'loss' : 'push'; r.pl = home === 'push' ? 'push' : (home === 'win') === (g.plPick === 'home') ? 'win' : 'loss'; }
  if (L && has(L.total) && g.ouPick) { const over = total > L.total ? 'win' : total < L.total ? 'loss' : 'push'; r.ou = over === 'push' ? 'push' : (over === 'win') === (g.ouPick === 'over') ? 'win' : 'loss'; }
  return r;
}
function sPkRecord(St) {
  const fresh = () => ({ su: { w: 0, l: 0 }, ml: { w: 0, l: 0 }, pl: { w: 0, l: 0, p: 0 }, ou: { w: 0, l: 0, p: 0 } }), R = Object.assign(fresh(), { byMonth: {} });
  for (const g of St.games) { const r = sPkGrade(g); if (!r) continue; const mo = g.type === 3 ? 'playoffs' : g.date.slice(0, 7), M = R.byMonth[mo] = R.byMonth[mo] || fresh();
    for (const t of [R, M]) { t.su[r.su ? 'w' : 'l']++; for (const k of ['ml', 'pl', 'ou']) if (r[k]) t[k][r[k] === 'win' ? 'w' : r[k] === 'loss' ? 'l' : 'p']++; } }
  return R;
}
const sPkRecStr = R => { const one = r => r && r.su && r.ml && r.pl && r.ou ? `${r.su.w}-${r.su.l} ml ${r.ml.w}-${r.ml.l} pl ${r.pl.w}-${r.pl.l}-${r.pl.p || 0} ou ${r.ou.w}-${r.ou.l}-${r.ou.p || 0}` : 'none'; return R ? [one(R)].concat(Object.keys(R.byMonth || {}).sort().map(m => `${m} ${one(R.byMonth[m])}`)).join('; ') : 'none'; };
/* the chart's geometry by this section's own rules, in the drawing's own coordinates (jsdom lays nothing out; the review of nhl v30
   found the lines' heights, the axis's figures, the weeks' names, the dots and the end labels' order all free to be wrong). The weeks
   spread evenly along the zero line, the start at its left end and the last week at its right; a band a week to point at, centred on
   its week, as wide as the step between weeks, all of the plot's height. The axis: a figure every game while the lines span 8 games or
   fewer (and always −3 to +3), every 2 to 20, 5 to 50, 10 to 100, else 20, from the step at or under the lowest to the step at or over
   the highest, the highest at the bands' top and the lowest at their foot, so a game is the bands' height over that span (the units);
   each figure's grid line at its height and the figure centred on it at the left. Each line's points and dots at its weekly sums'
   heights over the zero line, a week at its week's x. Under the plot "Start" at the start and weeks by their Mondays, the last always
   where it stands 40 or more from the start, then every so many weeks back from it, every week where the weeks are 46 or more apart,
   never two on one another. At the right the end labels in the order of their values down the chart (a tie: DraftKings, then the
   legend's order), never on one another, within the plot's height, each beside its line's end. Every word inside the drawing, at a
   generous 6.5 a character of its 11px words. Wrongs, [] where none */
const PK_CHAR = 6.5;
const sPkNum = s => { const t = String(s).trim(), m = /^([+−])(\d+)$/.exec(t); return t === '0' ? 0 : m ? (m[1] === '+' ? 1 : -1) * +m[2] : NaN; };
const sPkDayWords = dd => `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(Date.UTC(+dd.slice(0, 4), +dd.slice(5, 7) - 1, +dd.slice(8, 10))).getUTCDay()]}, ${sPkShort(dd)}`;
function sPkGeom(svg, D, wantW) {
  const bad = [], n = D.weeks.length, models = PK_S.filter(([id]) => id !== 'dk'), near = (a, b, t = 0.1) => Math.abs(a - b) <= t + 1e-9, f1 = v => (+v).toFixed(1), num = (e, k) => +e.getAttribute(k);
  const vb = String(svg.getAttribute('viewBox') || '').trim().split(/\s+/).map(Number), W = vb[2], H = vb[3];
  if (vb.length !== 4 || vb[0] !== 0 || vb[1] !== 0 || !(W > 0) || !(H > 0)) return [`its drawing's box is "${svg.getAttribute('viewBox')}"`];
  if (wantW !== undefined && W !== wantW) bad.push(`drawn ${W} wide, want ${wantW}`);
  const zero = svg.querySelector('line.z'), hits = [...svg.querySelectorAll('rect.rv-hit')];
  if (!zero || !n || hits.length !== n) return bad.concat([`no zero line, or not a band a week (${hits.length} for ${n})`]);
  const x0 = num(zero, 'x1'), xR = num(zero, 'x2'), zy = num(zero, 'y1'), gap = (xR - x0) / n, xw = i => x0 + i * gap, top = num(hits[0], 'y'), ph = num(hits[0], 'height'), foot = top + ph;
  if (!(xR > x0) || !(ph > 0) || num(zero, 'y2') !== zy) return bad.concat([`the zero line from ${x0} to ${xR} at ${zy}, the plot ${ph} high`]);
  hits.forEach((h, i) => { const x = num(h, 'x'), wd = num(h, 'width'); if (!near(x + wd / 2, xw(i + 1)) || !near(wd, gap) || num(h, 'y') !== top || num(h, 'height') !== ph) bad.push(`week ${i + 1}'s band at ${x}+${wd}, want centred on ${f1(xw(i + 1))}, ${f1(gap)} wide, ${top} to ${foot}`); });
  /* the axis: its figures, the step, the units, each figure's line and place */
  const texts = [...svg.querySelectorAll(':scope > text')], ticks = texts.filter(t => t.getAttribute('text-anchor') === 'end' && !t.dataset.end).sort((a, b) => num(a, 'y') - num(b, 'y'));
  const all = models.flatMap(([id]) => D.cum[id]), lo0 = Math.min(-3, ...all), hi0 = Math.max(3, ...all), span = hi0 - lo0;
  const st = span <= 8 ? 1 : span <= 20 ? 2 : span <= 50 ? 5 : span <= 100 ? 10 : 20, lo = Math.floor(lo0 / st) * st, hi = Math.ceil(hi0 / st) * st, vals = [];
  for (let v = hi; v >= lo; v -= st) vals.push(v);
  if (!eqA(ticks.map(txt), vals.map(sPkSigned))) bad.push(`the axis reads ${ticks.map(txt).join(' ')} down the chart, want ${vals.map(sPkSigned).join(' ')} (a step of ${st})`);
  const u = ph / (hi - lo), Yv = v => top + (hi - v) * u;        /* the units: a game's height */
  if (!near(zy, Yv(0))) bad.push(`the zero line at ${zy}, want ${f1(Yv(0))} (${f1(u)} a game)`);
  for (const t of ticks) { const v = sPkNum(txt(t)), dy = num(t, 'y') - Yv(v); if (!Number.isFinite(v) || dy < 2 || dy > 6 || num(t, 'x') > x0 - 4) bad.push(`the axis's ${txt(t)} at ${t.getAttribute('x')},${t.getAttribute('y')}, want its figure centred on ${f1(Yv(v))} left of ${x0}`); }
  const grid = [...svg.querySelectorAll('line.g')].sort((a, b) => num(a, 'y1') - num(b, 'y1')), wantG = vals.filter(v => v !== 0);
  if (grid.length !== wantG.length || grid.some((g, i) => !near(num(g, 'y1'), Yv(wantG[i])) || num(g, 'y2') !== num(g, 'y1') || num(g, 'x1') !== x0 || num(g, 'x2') !== xR)) bad.push(`the grid's lines at ${grid.map(g => g.getAttribute('y1')).join(' ')}, want ${wantG.map(v => f1(Yv(v))).join(' ')}`);
  /* each line's points and dots at its weeks' heights */
  for (const [id, name] of models) {
    const pl = svg.querySelector(`polyline[data-model="${id}"]`); if (!pl) { bad.push(`no line for ${name}`); continue; }
    const pts = pl.getAttribute('points').trim().split(/\s+/).map(p => p.split(',').map(Number)), want = [[x0, Yv(0)]].concat(D.cum[id].map((v, i) => [xw(i + 1), Yv(v)]));
    const off = want.map((p, i) => pts[i] && near(pts[i][0], p[0]) && near(pts[i][1], p[1]) ? null : `${i}: ${pts[i] ? pts[i].join(',') : 'none'} for ${f1(p[0])},${f1(p[1])}`).filter(Boolean);
    if (pts.length !== want.length || off.length) bad.push(`${name}'s line off its weeks' heights (${off.slice(0, 2).join('; ')})`);
    /* a dot a week from the start where the weeks stand 8 or more apart, the last alone under that (the second review of nhl v30: a line
       drawing its last dot alone with the weeks 120 apart passed); each dot 3 to 4 across, never hidden by its size */
    const dotEls = [...svg.querySelectorAll('circle')].filter(c => c.getAttribute('style') === pl.getAttribute('style')), dots = dotEls.map(c => [num(c, 'cx'), num(c, 'cy')]), wantD = gap >= 8 ? want : want.slice(-1);
    if (dots.length !== wantD.length || dots.some((p, i) => !near(p[0], wantD[i][0]) || !near(p[1], wantD[i][1]))) bad.push(`${name}'s dots off its line, a dot a week from the start where the weeks are 8 or more apart and the last alone under that (${dots.length} dots for ${n} weeks ${f1(gap)} apart: ${dots.slice(0, 2).map(p => p.join(',')).join('; ')}, want ${wantD.length}: ${wantD.slice(0, 2).map(p => p.map(f1).join(',')).join('; ')})`);
    if (dotEls.some(c => !(num(c, 'r') >= 3 && num(c, 'r') <= 4))) bad.push(`${name}'s dots ${[...new Set(dotEls.map(c => c.getAttribute('r')))].join(', ')} across, want 3 to 4`);
  }
  /* the weeks under the plot */
  const wk = texts.filter(t => t.getAttribute('text-anchor') === 'middle'), wy = wk.length ? num(wk[0], 'y') : NaN, rest = wk.slice(1), idx = rest.map(t => Math.round((num(t, 'x') - x0) / gap));
  if (!wk.length || txt(wk[0]) !== 'Start' || !near(num(wk[0], 'x'), x0) || wk.some(t => num(t, 'y') !== wy) || !(wy > foot && wy <= H)) bad.push(`under the plot "Start" at the start, every week's name on one line under it (${wk.map(t => `${txt(t)}@${t.getAttribute('x')},${t.getAttribute('y')}`).slice(0, 3).join(' ')})`);
  rest.forEach((t, j) => { const i = idx[j]; if (!(i >= 1 && i <= n) || !near(num(t, 'x'), xw(i)) || txt(t) !== sPkShort(D.weeks[i - 1])) bad.push(`a week's name "${txt(t)}" at ${t.getAttribute('x')}, want ${i >= 1 && i <= n ? `"${sPkShort(D.weeks[i - 1])}" at ${f1(xw(i))}` : 'a week'}`); });
  const every = Math.max(1, Math.ceil(46 / gap)), wantI = []; for (let i = n; i >= 1; i -= every) if (xw(i) - x0 >= 40) wantI.unshift(i);
  if (!eqA(idx, wantI)) bad.push(`the weeks named under the plot are ${idx.join(',')}, want ${wantI.join(',')} (the last, then every ${every} back; every week where the weeks are 46 or more apart)`);
  /* the end labels */
  const ends = [['dk', 0]].concat(models.map(([id]) => [id, D.cum[id][n - 1]])).map(([id, v], k) => ({ id, v, k, t: svg.querySelector(`text[data-end="${id}"]`) }));
  if (ends.some(e => !e.t)) return bad.concat([`an end label missing (${ends.filter(e => !e.t).map(e => e.id).join(', ')})`]);
  const byY = ends.slice().sort((a, b) => num(a.t, 'y') - num(b.t, 'y')).map(e => e.id), byV = ends.slice().sort((a, b) => b.v - a.v || a.k - b.k).map(e => e.id);
  if (!eqA(byY, byV)) bad.push(`the end labels down the chart ${byY.join(' ')}, want ${byV.join(' ')} by their values`);
  const ys = ends.map(e => num(e.t, 'y')).sort((a, b) => a - b);
  if (ys.some((y, i) => i && y - ys[i - 1] < 12)) bad.push(`two end labels on one another (${ys.map(f1).join(' ')})`);
  /* each label's place by the nudging rule (the second review of nhl v30: labels pushed 24 apart, up to 61 from their lines' ends, passed):
     each at its value's height, taken down the chart in its values' order, pushed down to 14 under the one above where closer, then all
     lifted by as much as the lowest passes the plot's foot; its words 4 under that, its marker on it */
  const nud = ends.slice().sort((a, b) => b.v - a.v || a.k - b.k).map(e => ({ e, y: Yv(e.v) }));
  for (let i = 1; i < nud.length; i++) if (nud[i].y - nud[i - 1].y < 14) nud[i].y = nud[i - 1].y + 14;
  { const lift = nud[nud.length - 1].y - foot; if (lift > 0) for (const x of nud) x.y -= lift; }
  const offN = nud.filter(({ e, y }) => { const mk = e.id === 'dk' ? null : e.t.previousElementSibling; return !near(num(e.t, 'y'), y + 4) || (mk && (!mk.matches('line.s') || !near(num(mk, 'y1'), y))); });
  if (offN.length) bad.push(`the end labels off their nudged places (${offN.slice(0, 3).map(({ e, y }) => `${e.id} at ${e.t.getAttribute('y')}, want ${f1(y + 4)}`).join(', ')})`);
  for (const e of ends) {
    const y = num(e.t, 'y'), x = num(e.t, 'x'), mk = e.t.previousElementSibling, pl = svg.querySelector(`polyline[data-model="${e.id}"]`);
    if (y < top + 2 || y > foot + 6 || Math.abs(y - 4 - Yv(e.v)) > 14 * (ends.length - 1) + 2) bad.push(`${e.id}'s end label at ${f1(y)}, want within the plot (${top} to ${foot}) and near ${f1(Yv(e.v))}`);
    if (e.id === 'dk') { if (x < xR + 4 || x > xR + 24) bad.push(`"= DraftKings" at ${x}, want beside the zero line's end (${xR})`); continue; }
    if (!mk || !mk.matches('line.s') || !pl || mk.getAttribute('style') !== pl.getAttribute('style') || num(mk, 'x1') < xR + 4 || num(mk, 'x1') > xR + 24 || x < num(mk, 'x2') || num(mk, 'y1') !== num(mk, 'y2') || y - num(mk, 'y1') < 2 || y - num(mk, 'y1') > 6) bad.push(`${e.id}'s end label not beside its line's end in its colour (${mk ? `${mk.getAttribute('x1')}..${mk.getAttribute('x2')},${mk.getAttribute('y1')}` : 'no marker'}; words at ${x},${y})`);
  }
  /* every word inside the drawing */
  const out = texts.filter(t => { const w = txt(t).length * PK_CHAR, x = num(t, 'x'), a = t.getAttribute('text-anchor') || 'start', l = a === 'end' ? x - w : a === 'middle' ? x - w / 2 : x; return l < 0 || l + w > W || num(t, 'y') < 11 || num(t, 'y') > H; });
  if (out.length) bad.push(`words past the drawing's edge (${W}x${H}): ${out.slice(0, 3).map(t => `"${txt(t)}" at ${t.getAttribute('x')},${t.getAttribute('y')}`).join(', ')}`);
  /* every mark of the drawing carries only what its kind draws with (the second review of nhl v30: Alpha's line with opacity="0", its dots
     drawn and its line not, passed): no opacity, visibility, transform, fill or stroke written on a mark, a line's colour its --c alone,
     a dash on the baseline's alone, a band clear and nothing in the drawing but these */
  const KIND = [['line.g', 'class x1 x2 y1 y2'], ['line.z', 'class x1 x2 y1 y2'], ['line.rv-cross', 'class x1 x2 y1 y2 style'], ['line.s', 'class style stroke-dasharray x1 x2 y1 y2'],
    ['polyline', 'style stroke-dasharray data-model data-cum points'], ['circle', 'style cx cy r'], ['text', 'class x y text-anchor data-end'], ['tspan', ''], ['rect.rv-hit', 'class data-i x y width height fill']];
  const marks = [], tok = /^--c:var\(--m-(alpha|joker|elom|call|base)\)$/;
  for (const x of svg.querySelectorAll('*')) {
    const k = KIND.find(([sel]) => x.matches(sel)), names = [...x.attributes].map(a => a.name), cls = x.getAttribute('class');
    const why = !k ? 'not a mark the chart draws' : names.filter(a => !k[1].split(' ').includes(a)).map(a => `${a}="${x.getAttribute(a)}"`).join(' ')
      || (x.matches('line') && !['g', 'z', 'rv-cross', 's'].includes(cls) ? `class "${cls}"` : '') || (x.matches('text') && cls !== null && !['z', 'e'].includes(cls) ? `class "${cls}"` : '')
      || (x.matches('polyline, circle, line.s') && !tok.test(x.getAttribute('style') || '') ? `style "${x.getAttribute('style')}"` : '')
      || (x.matches('polyline, line.s') && x.hasAttribute('stroke-dasharray') !== (x.getAttribute('style') === '--c:var(--m-base)') ? 'a dash off the baseline, or the baseline solid' : '')
      || (x.matches('line.rv-cross') && !/^(display: ?none;?)?$/.test(x.getAttribute('style') || '') ? `style "${x.getAttribute('style')}"` : '')
      || (x.matches('rect') && x.getAttribute('fill') !== 'transparent' ? `fill "${x.getAttribute('fill')}"` : '');
    if (why) marks.push(`<${x.tagName.toLowerCase()}${cls ? '.' + cls : ''}> ${why}`);
  }
  if (!eqA([...svg.attributes].map(a => a.name).sort(), ['aria-label', 'class', 'role', 'viewBox'].sort())) marks.push(`the drawing carries ${[...svg.attributes].map(a => a.name).join(' ')}`);
  if (marks.length) bad.push(`marks carrying what their kind does not draw with (${[...new Set(marks)].slice(0, 3).join(' | ')})`);
  return bad;
}
/* a grid cell's shade, the NFL's: clear at .500, green over and red under, deepest (42%) from 30 points off */
const sPkShade = r => { const g = r.w + r.l, p = g ? r.w / g : 0.5; return !g || p === 0.5 ? ['', null] : [p > 0.5 ? 'up' : 'dn', `--a:${(Math.min(0.42, Math.abs(p - 0.5) / 0.3 * 0.42) * 100).toFixed(1)}%`]; };
async function holdPickem(St, ms, tag, opts = {}) {
  const errs = [], w = await boot(ms, errs, Object.assign({ state: JSON.stringify(St) }, opts.store ? { store: opts.store } : { hash: opts.hash || 'pickem' })), d = w.document;
  const ck = (ok, msg) => chk(ok, `${tag}: ${msg}`), el = id => d.getElementById(id), D = sPkData(St), abbr = id => St.teams[id].abbr, any = D.fin.length > 0, n = D.weeks.length;
  const sec = el('tab-pickem'), onB = d.querySelector('#tabs button.on'), tabs = [...d.querySelectorAll('#tabs button')].map(b => b.dataset.tab);
  ck(!!sec && !sec.hidden && w.location.hash === '#pickem' && !!onB && onB.dataset.tab === 'pickem' && txt(onB) === "Pick'em Record" && onB.getAttribute('aria-current') === 'page', `${opts.how || '#pickem'} opens the Pick'em Record, its address #pickem (${w.location.hash}; ${txt(onB)})`);
  if (!sec) { w.close(); return; }
  if (opts.laProbe) ck(new w.Date(opts.laProbe).getHours() === 4 && w.eval(`new Date(${opts.laProbe}).getTimezoneOffset()`) === 480, `the page's own clock is the visitor's, in Los Angeles (noon UTC reads ${new w.Date(opts.laProbe).getHours()}:00 on it)`);
  const writes0 = w.__writes.slice();
  /* the NFL's tab bar, and no Record tab: its button, its section and what it drew are gone */
  ck(eqA(tabs, ['games', 'suggest', 'parlays', 'ratings', 'players', 'pickem']) && !el('tab-record') && !d.querySelector('#recordTotals, #recMonth, #recBand, #recordNote, .two') && !/fitRecord|renderRecord/.test(HTML),
    `a visitor's tabs are the NFL's six, the Pick'em Record last, and the Record tab is gone with its tiles, its two tables and its fit (${tabs.join(' ')})`);
  /* the anatomy, the NFL's: the tiles, then three cards by their headings, the state line last; in the first card the legend, the chart, the button and the picks */
  const cardIds = ['pkChartC', 'pkWeeksC', 'pkBetsC'], heads = cardIds.map(id => el(id) ? txt(el(id).querySelector(':scope > h2')) : '');
  ck(eqA([...sec.children].map(x => x.id), ['pkTiles'].concat(cardIds, ['pkBlind'])) && cardIds.every(id => el(id).classList.contains('card')) && eqA(heads, ['Wins against DraftKings', 'Week by week', 'Bets record'])
    && eqA([...el('pkChartC').children].map(x => x.id || x.tagName), ['H2', 'pkNone', 'pkLegend', 'pkChart', 'pkBar', 'pkPicksW']) && el('pkTiles').classList.contains('stat-strip'),
    `the tab is the tiles, then the cards Wins against DraftKings (the legend, the chart, Show every pick, the picks), Week by week and Bets record (${[...sec.children].map(x => x.id).join(' ')}; ${heads.join(' | ')})`);
  /* nothing but numbers and names: no paragraph but the one state line, no link, image or frame, every control 44px */
  const tall = x => !!x && w.getComputedStyle(x).minHeight === '44px';
  ck([...sec.querySelectorAll('p')].every(p => p.id === 'pkBlind') && !sec.querySelector('img, canvas, iframe, a, details, .note, .intro') && tall(el('pkShow')) && tall(el('pkDay')) && eqA([...sec.querySelectorAll('button, select, input')].map(x => x.id), ['pkShow', 'pkDay']),
    'no description, link or image on the tab, and its two controls (Show every pick, the Day) 44px tall');
  /* every inline style on the tab is a token: a line's colour by its name, a cell's depth, the crosshair put away (a club's tag apart) */
  const styled = [...sec.querySelectorAll('[style]')].filter(x => !x.classList.contains('ttag')).map(x => x.getAttribute('style')).filter(s => !/^(--c:var\(--m-(alpha|joker|elom|call|base)\)|--a:\d+\.\d%|display:none)$/.test(s));
  ck(!styled.length, `no colour written on the tab but by a token (${styled.slice(0, 3).join(' | ')})`);
  /* the six tiles */
  const tiles = [...d.querySelectorAll('#pkTiles .stat')], B = sPkBands(St), dk = D.rec.dk, dkN = dk.w + dk.l, pc0 = (a, b) => b ? Math.round(100 * a / b) + '%' : '–';
  const wantT = !any ? [] : [[dkN ? (100 * dk.w / dkN).toFixed(1) + '%' : '–', `DraftKings record, ${dk.w}/${dkN}`]].concat(PK_BANDS_S.map(([k, , lab]) => [pc0(B[k].w, B[k].w + B[k].l), `${lab}, ${B[k].w}/${B[k].w + B[k].l}`]), [[D.miss === null ? '–' : D.miss.toFixed(2), "total's avg miss, goals"]]);
  const haveT = tiles.map(t => [txt(t.querySelector(':scope > b')), txt(t.querySelector(':scope > span'))]);
  ck(eqA(haveT, wantT) && el('pkTiles').hidden === !any, `the six tiles: DraftKings' record, the call in each confidence band on its rounded chance, the total's average miss in goals (${JSON.stringify(haveT)}, want ${JSON.stringify(wantT)})`);
  ck(tiles.every(t => t.children.length === 2 && (t.getAttribute('title') || '').length >= 30), 'a tile is its figure and its label, what the number means on its title');
  if (any) { const t6 = tiles[5] ? tiles[5].getAttribute('title') || '' : '', t1 = tiles[0] ? tiles[0].getAttribute('title') || '' : '';
    ck(t6.includes(`the ${D.missN} final${D.missN === 1 ? '' : 's'} with a total`) && t1.includes(`${dk.w} of ${dkN}`) && PK_BANDS_S.every(([k], i) => (tiles[1 + i].getAttribute('title') || '').includes(`${B[k].w} of ${B[k].w + B[k].l}`)), `each tile's title counts what it stands on (${t1} | ${t6})`); }
  /* before any final: the tiles, the legend, the chart, the grid put away, and the card says so */
  ck(el('pkNone').hidden === any && txt(el('pkNone')) === 'No game graded yet.' && el('pkLegend').hidden === !any && el('pkChart').hidden === !any && el('pkWeeksC').hidden === !any
    && (any || (!tiles.length && !el('pkLegend').children.length && !el('pkChart').children.length && !el('pkWeeks').rows.length)), `${any ? 'with a final graded the card draws its legend and chart' : 'before any final the card says "No game graded yet." and draws no tile, legend, chart or grid'} (${D.fin.length} finals)`);
  const last = id => D.cum[id].length ? D.cum[id][n - 1] : 0, models = PK_S.filter(([id]) => id !== 'dk');
  if (any) {
    /* the legend: each model's season and its wins less DraftKings' on the games both picked; the swatch carries the colour, the words the ink */
    ck(eqA([...el('pkLegend').children].map(x => x.dataset.pk), PK_S.map(x => x[0])) && el('pkLegend').classList.contains('lgdrow'), `the legend's entries in order (${[...el('pkLegend').children].map(x => x.dataset.pk).join(' ')})`);
    for (const [id, name] of PK_S) {
      const li = d.querySelector(`#pkLegend > span[data-pk="${id}"]`), r = D.rec[id], base = id === 'elo', sw = li && li.querySelector(':scope > i.lgd');
      /* the Team Elo is the baseline (nhl v24): the legend calls it so and its swatch and line are dashed, every other model's solid */
      const wantLi = id === 'dk' ? `DraftKings ${sPkRec(r)}` : `${name} ${sPkRec(r)} ${sPkSigned(last(id))} vs DraftKings${base ? ' · baseline' : ''}`;
      ck(txt(li) === wantLi && !!li && txt(li.querySelector('b')) === sPkRec(r) && (li.getAttribute('title') || '').length >= 30, `the legend says ${wantLi}, the record in bold, what the model is on its title (${txt(li)})`);
      ck(!!sw && sw.classList.contains('dash') === base && sw.classList.contains('ink') === (id === 'dk') && (id === 'dk' || sw.getAttribute('style') === `--c:var(--m-${id === 'elo' ? 'base' : id})`), `${name}'s legend swatch ${base ? 'dashed, the baseline' : id === 'dk' ? "the ink's, as its zero line" : 'solid, in its own colour'}`);
    }
    /* the chart: an image to a screen reader with its words; each line its weekly sums from zero; the end labels; a band a week */
    const svg = d.querySelector('#pkChart svg'), zero = svg && svg.querySelector('line.z'), zy = zero ? +zero.getAttribute('y1') : NaN;
    const aria = 'Wins against DraftKings by week: ' + models.map(([id, name]) => `${name} ${sPkSigned(last(id))}`).join(', ');
    ck(!!svg && svg.classList.contains('pk-chart') && svg.classList.contains('rv-chart') && svg.getAttribute('role') === 'img' && svg.getAttribute('aria-label') === aria && !svg.querySelector('image, use, foreignObject') && !!zero && d.querySelectorAll('#pkChart svg').length === 1,
      `the chart drawn inline, an image to a screen reader with its words, no image inside it (${svg && svg.getAttribute('aria-label')})`);
    if (svg) {
      for (const [id, name] of models) {
        const pl = svg.querySelector(`polyline[data-model="${id}"]`), base = id === 'elo', pts = pl ? pl.getAttribute('points').trim().split(/\s+/).map(p => p.split(',').map(Number)) : [], end = svg.querySelector(`text[data-end="${id}"]`);
        ck(!!pl && pl.getAttribute('data-cum') === D.cum[id].join(',') && pts.length === n + 1 && pts[0][1] === zy, `${name}'s line on the chart, its wins less DraftKings' added up week by week from 0 (${pl && pl.getAttribute('data-cum')}, want ${D.cum[id].join(',')})`);
        ck(!!pl && (pl.getAttribute('stroke-dasharray') !== null) === base && pl.getAttribute('style') === `--c:var(--m-${base ? 'base' : id})`, `${name}'s line ${base ? 'dashed, the baseline' : 'solid'}, in its own colour (${pl && pl.getAttribute('stroke-dasharray')})`);
        /* a line's height is games: over the zero line with more wins than DraftKings, under it with fewer, each week */
        ck(pts.length === n + 1 && D.cum[id].every((v, i) => Math.sign(zy - pts[i + 1][1]) === Math.sign(v)), `${name}'s line is above DraftKings' zero line in the weeks it leads and below where it trails`);
        ck(txt(end) === `${sPkSigned(last(id))} ${name}` && !!end && txt(end.querySelector('tspan')) === sPkSigned(last(id)), `${name}'s line labelled at its end, "${sPkSigned(last(id))} ${name}" (${txt(end)})`);
        const dots = [...svg.querySelectorAll('circle')].filter(c => c.getAttribute('style') === pl.getAttribute('style')).length, gapW = zero ? (+zero.getAttribute('x2') - +zero.getAttribute('x1')) / n : NaN;
        ck(dots === (gapW >= 8 ? n + 1 : 1), `${name}'s line has a dot a week from the start where the weeks stand 8 or more apart (${gapW.toFixed(1)} here), its last alone under that (${dots} for ${n} weeks)`);
      }
      /* the page's CSS draws each line and its marker in its own --c and fills each dot with it, every mark shown (the second review of
         nhl v30: a rule stroking every line in the ink, all five one colour, passed). jsdom's computed style is the cascade's declared value */
      { const cs = x => w.getComputedStyle(x), v = (s, k) => s.getPropertyValue(k).trim(), one = (s, k) => ['', '1'].includes(v(s, k)), wrongC = [];
        const shown = s => one(s, 'opacity') && one(s, 'stroke-opacity') && one(s, 'fill-opacity') && !['hidden', 'collapse'].includes(v(s, 'visibility')) && v(s, 'display') !== 'none';
        for (const x of svg.querySelectorAll('polyline, line.s')) { const s = cs(x); if (v(s, 'stroke') !== 'var(--c)' || !['none', 'rgba(0, 0, 0, 0)', 'transparent'].includes(v(s, 'fill')) || !shown(s)) wrongC.push(`${x.tagName.toLowerCase()}${x.dataset.model ? ' ' + x.dataset.model : ''}: stroke ${v(s, 'stroke')}, fill ${v(s, 'fill')}, opacity ${v(s, 'opacity')}, visibility ${v(s, 'visibility')}`); }
        for (const x of svg.querySelectorAll('circle')) { const s = cs(x); if (v(s, 'fill') !== 'var(--c)' || !shown(s)) wrongC.push(`a dot: fill ${v(s, 'fill')}, opacity ${v(s, 'opacity')}`); }
        ck(!wrongC.length && !!svg.querySelector('polyline') && !!svg.querySelector('circle'), `the page's CSS strokes every line and its end marker in the line's own --c and fills every dot with it, none of them hidden (${[...new Set(wrongC)].slice(0, 3).join(' | ')})`); }
      const hits = [...svg.querySelectorAll('rect.rv-hit')], inked = [...svg.querySelectorAll('text, tspan')].every(t => !t.getAttribute('fill') && !t.getAttribute('style'));
      ck(txt(svg.querySelector('text[data-end="dk"]')) === '= DraftKings' && eqA(hits.map(h => h.dataset.i), D.weeks.map((x, i) => String(i))) && inked, `the zero line labelled "= DraftKings", a band to point at for each of the ${n} weeks, and every word in the page's ink, never a line's colour`);
      /* the drawing itself, by this section's own geometry (the review of nhl v30): jsdom lays nothing out, so the chart is drawn 900 wide */
      const geo = sPkGeom(svg, D, 900);
      ck(!geo.length, `the chart's geometry: each line's points and dots at its weekly sums' heights, the axis's figures every step at their heights, the weeks named under the plot by their Mondays, the end labels in their values' order beside the lines' ends, every word inside the drawing (${geo.slice(0, 3).join(' | ')})`);
      /* a week pointed at: its own numbers beside a crosshair; pointed away from, both gone. A mouse points; a finger taps */
      const tip = el('pkTip'), cross = svg.querySelector('line.rv-cross'), PE = (t, type) => new w.PointerEvent(t, { bubbles: true, pointerType: type });
      const wantTip = k => { const wk = D.weeks[k]; return [`Week of ${sPkShort(wk)}`].concat(models.map(([id, name]) => `${name} ${sPkRec(D.rec[id][wk])} · season ${sPkSigned(D.cum[id][k])} vs DraftKings`), [`DraftKings ${sPkRec(D.rec.dk[wk])}`]); };
      const shows = k => { const px = svg.querySelector('polyline') ? svg.querySelector('polyline').getAttribute('points').trim().split(/\s+/)[k + 1].split(',')[0] : ''; return !!tip && !tip.hidden && eqA([...tip.children].map(txt), wantTip(k)) && cross.style.display !== 'none' && cross.getAttribute('x1') === px; };
      const shut = () => !!tip && tip.hidden && !!cross && cross.style.display === 'none';
      /* every week (the second review of nhl v30: a tip a week behind in its season's figure, or a crosshair a week behind, on the weeks
         between the first and the last passed): its own numbers, the season's sums after it, the crosshair on it; pointed away, both gone */
      const offWk = [], stayWk = [];
      for (let k = 0; k < n; k++) {
        const tip0 = shut();
        hits[k].dispatchEvent(PE('pointerover', 'mouse'));
        if (!tip0 || !shows(k)) offWk.push(`${sPkShort(D.weeks[k])}: ${tip ? [...tip.children].map(txt).join(' | ') : 'no tip'}, crosshair at ${cross && cross.getAttribute('x1')}; want ${wantTip(k).join(' | ')}`);
        hits[k].dispatchEvent(PE('pointerout', 'mouse'));
        if (!shut()) stayWk.push(sPkShort(D.weeks[k]));
      }
      ck(!offWk.length, `each of the ${n} weeks pointed at shows its own numbers, and the season's sums after it, beside a crosshair on that week (${offWk.slice(0, 2).join(' || ')})`);
      ck(!stayWk.length, `pointed away from, the numbers and the crosshair go, on every week (${stayWk.slice(0, 3).join(', ')})`);
      /* a finger (the review of nhl v30: a tap opened the numbers and the touch's own out shut them at once): a tap opens a week's numbers,
         which stay through the touch's own over and out until the next tap, on the same week (shut), another week (moved) or anywhere
         off the chart (shut); a mouse's click on a week it points at leaves them as they are. A pen taps as a finger does (the second
         review: a pen's second tap on its week shut nothing) */
      for (const type of ['touch', 'pen']) {
        const tap = (x, k) => { for (const t of ['pointerover', 'pointerdown', 'pointerup', 'pointerout']) x.dispatchEvent(PE(t, type)); x.dispatchEvent(new w.MouseEvent('mouseover', { bubbles: true })); x.dispatchEvent(new w.MouseEvent('mouseout', { bubbles: true })); x.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); return k; };
        const kT = n - 1, kO = n > 1 ? 0 : null;
        tap(hits[kT]); const t1 = shows(kT);
        hits[kT].dispatchEvent(PE('pointerout', type)); const t2 = shows(kT);
        tap(hits[kT]); const t3 = shut();
        tap(hits[kT]); if (kO !== null) tap(hits[kO]); const t4 = shows(kO === null ? kT : kO);
        tap(el('pkLegend')); const t5 = shut();
        tap(hits[kT]); tap(el('pkWeeksC')); const t6 = shut();
        hits[kT].dispatchEvent(PE('pointerover', 'mouse')); hits[kT].dispatchEvent(PE('pointerdown', 'mouse')); hits[kT].dispatchEvent(new w.MouseEvent('click', { bubbles: true })); const t7 = shows(kT);
        hits[kT].dispatchEvent(PE('pointerout', 'mouse')); const t8 = shut();
        ck(t1 && t2 && t3 && t4 && t5 && t6 && t7 && t8, `a ${type}'s tap opens a week's numbers and they stay through its own out; a second tap on that week shuts them, a tap on another moves them, a tap off the chart shuts them; a mouse's click keeps them while it points (${[t1, t2, t3, t4, t5, t6, t7, t8].map(x => x ? 'y' : 'n').join('')})`);
      }
      /* a narrower box (the review of nhl v30: at 320px the chart was drawn 280 wide and shrunk, its 11px words 9.5px): the chart drawn at
         the box's own width down to 240 and at most 900, by the same geometry; and the numbers kept inside the box, beside the week where
         they fit, and short (.tight, no "vs DraftKings") where they would stand taller than it */
      const box = el('pkChart'), drawAt = async cw => { Object.defineProperty(box, 'clientWidth', { configurable: true, get: () => cw }); w.dispatchEvent(new w.Event('resize')); await wait(200); return d.querySelector('#pkChart svg'); };
      for (const [cw, want] of [[242, 242], [320, 320], [200, 240], [1400, 900]]) {
        const s2 = await drawAt(cw), g2 = s2 ? sPkGeom(s2, D, want) : ['no chart'];
        ck(!g2.length, `a box ${cw} wide draws the chart ${want} wide, its words 11px in a box that wide, by the same geometry (${g2.slice(0, 3).join(' | ')})`);
      }
      { await drawAt(242); const t2b = el('pkTip'), h2 = [...d.querySelectorAll('#pkChart rect.rv-hit')], bad2 = [];
        box.getBoundingClientRect = () => ({ left: 0, top: 0, width: 242, height: 230, right: 242, bottom: 230, x: 0, y: 0 });
        for (const [k, tw, th] of [[n - 1, 226, 160], [0, 150, 160], [n - 1, 226, 226]]) {
          Object.defineProperty(t2b, 'offsetWidth', { configurable: true, get: () => tw }); Object.defineProperty(t2b, 'offsetHeight', { configurable: true, get: () => th });
          h2[k].dispatchEvent(PE('pointerover', 'mouse'));
          const L = parseFloat(t2b.style.left), T = parseFloat(t2b.style.top);
          if (t2b.hidden || !(L >= 0 && L + tw <= 242 && T >= 0 && T + th <= 230) || t2b.classList.contains('tight') !== (th > 230 - 12)) bad2.push(`week ${k + 1}, a ${tw}x${th} tip at ${t2b.style.left},${t2b.style.top}${t2b.classList.contains('tight') ? ' tight' : ''}`);
          h2[k].dispatchEvent(PE('pointerout', 'mouse'));
        }
        ck(!bad2.length, `in a box 242 by 230 the week's numbers stand inside it, and drop their "vs DraftKings" where they would stand taller than it less 12 (${bad2.join(' | ')})`);
        /* short or not is the week's own, never the week shown before's (the second review of nhl v30: at 390 a week's tip was full when
           shown first and short after another): a tip absolutely placed is only as wide as the room right of where it stands, so laid
           out here as a browser would, each row one line where its words fit in the room left of the tip's place and two where not (the
           DraftKings row, short, never two). The last week's rows are long enough to want two lines anywhere, so it is short and stands
           far right; every other week's fit on one line from the box's left edge, so each is full though shown after it */
        if (n > 1) {
          const s3 = await drawAt(242), t3 = el('pkTip'), h3 = [...d.querySelectorAll('#pkChart rect.rv-hit')], kL = n - 1, longW = `Week of ${sPkShort(D.weeks[kL])}`;
          const at = () => { const L = parseFloat(t3.style.left); return Number.isFinite(L) ? L : 0; }, room = () => 242 - at() - 16, tight = () => t3.classList.contains('tight');
          const rowW = rw => { const rows = [...t3.querySelectorAll(':scope > div')], last = rows.indexOf(rw) === rows.length - 1, lng = txt(t3.querySelector('b')) === longW; return last ? 90 : lng ? (tight() ? 140 : 240) : (tight() ? 130 : 210); };
          const oh0 = Object.getOwnPropertyDescriptor(w.HTMLElement.prototype, 'offsetHeight');
          Object.defineProperty(w.HTMLDivElement.prototype, 'offsetHeight', { configurable: true, get() { return this.parentElement === t3 ? (rowW(this) > room() ? 32 : 16) : oh0.get.call(this); } });
          Object.defineProperty(t3, 'offsetHeight', { configurable: true, get: () => 34 + [...t3.querySelectorAll(':scope > div')].reduce((a, r) => a + r.offsetHeight, 0) });
          Object.defineProperty(t3, 'offsetWidth', { configurable: true, get: () => Math.min(16 + Math.max(...[...t3.querySelectorAll(':scope > div')].map(rowW)), 242 - at()) });
          const bad3 = [], showT = k => { h3[k].dispatchEvent(PE('pointerover', 'mouse')); const r = { k, tight: tight(), L: at(), W: t3.offsetWidth, H: t3.offsetHeight }; h3[k].dispatchEvent(PE('pointerout', 'mouse')); return r; };
          for (let k = 0; k < kL; k++) {
            const a = showT(kL), b = showT(k);
            if (!a.tight || b.tight || a.L + a.W > 242 || b.L + b.W > 242 || b.L < 0) bad3.push(`${sPkShort(D.weeks[k])} after ${sPkShort(D.weeks[kL])}: ${b.tight ? 'short' : 'full'} at ${b.L} (${b.W} wide), the long week ${a.tight ? 'short' : 'full'} at ${a.L}`);
          }
          delete w.HTMLDivElement.prototype.offsetHeight; delete t3.offsetHeight; delete t3.offsetWidth;
          ck(!!s3 && !bad3.length, `a week's tip is short or full by its own rows alone, measured from the box's left edge: every week after the long last one is full and stands inside the box (${bad3.slice(0, 3).join(' | ')})`);
        }
        delete box.getBoundingClientRect; delete box.clientWidth; }
    }
    /* the week grid: a column a week (its Monday, its games) and the season, a row a model, each cell its record and rate, shaded by the rate */
    const ths = [...d.querySelectorAll('#pkWeeks thead th')], own = th => { const c = th.cloneNode(true); for (const x of c.querySelectorAll('small')) x.remove(); return txt(c); };
    const haveH = ths.map(th => [own(th), txt(th.querySelector('small'))]), wantH = [['', '']].concat(D.weeks.map(x => [sPkShort(x), `${D.games[x]} game${D.games[x] === 1 ? '' : 's'}`]), [['Season', '']]);
    ck(eqA(haveH, wantH) && !!ths[n + 1] && ths[0].getAttribute('aria-label') === 'Model' && ths[n + 1].classList.contains('rv-season') && el('pkWeeks').classList.contains('rv-grid'), `the week grid's columns, each week by its Monday with its games, the season last (${haveH.map(x => x.join(' ')).join(' | ')})`);
    const gridWrong = [], rowsG = [...d.querySelectorAll('#pkWeeks tbody tr')];
    if (!eqA(rowsG.map(r => r.dataset.pk), PK_S.map(x => x[0]))) gridWrong.push(`rows ${rowsG.map(r => r.dataset.pk).join(' ')}`);
    for (const [id, name] of PK_S) {
      const tr = d.querySelector(`#pkWeeks tr[data-pk="${id}"]`), sw = tr && tr.cells[0].querySelector('i.lgd');
      if (!tr || txt(tr.cells[0]) !== name || tr.cells[0].tagName !== 'TH' || !sw || sw.classList.contains('dash') !== (id === 'elo') || sw.classList.contains('ink') !== (id === 'dk')) { gridWrong.push(`${id}: no row, or not its name and swatch`); continue; }
      D.weeks.concat(['season']).forEach((wk, i) => {
        const r = wk === 'season' ? D.rec[id] : D.rec[id][wk], c = tr.cells[i + 1], g = r.w + r.l, [cls, a] = sPkShade(r), pc = g ? Math.round(100 * r.w / g) : 0;
        const want = g ? `${sPkRec(r)} ${pc}%` : '–', got = c && c.querySelector('b') ? `${txt(c.querySelector('b'))} ${txt(c.querySelector('small'))}` : txt(c);
        const shown = c ? ['up', 'dn'].filter(x => c.classList.contains(x)).join(' ') : '?', title = g ? `${name}, ${wk === 'season' ? 'season' : 'week of ' + sPkShort(wk)}: ${r.w} of ${g} (${pc}%)` : null;
        if (!c || got !== want || shown !== cls || c.getAttribute('style') !== a || c.getAttribute('title') !== title || c.classList.contains('rv-none') !== !g || c.classList.contains('rv-season') !== (wk === 'season')) gridWrong.push(`${name} ${wk}: "${got}" ${shown} ${c && c.getAttribute('style')}, want "${want}" ${cls} ${a}`);
      });
    }
    ck(!gridWrong.length, `every cell of the week grid by its own sums: its record, its rate, its shade and what it counts on its title (${gridWrong.slice(0, 3).join(' | ')})`);
  }
  /* the bets record: the state's `record`, the season and each month: the call straight up with its rate, and the sides it took */
  const R = St.record, okR = r => !!r && ['su', 'ml', 'pl', 'ou'].every(k => r[k] && typeof r[k] === 'object'), has = okR(R) && R.su.w + R.su.l > 0;
  ck(el('pkBetsC').hidden === !has && (has || !el('pkBets').rows.length), `the Bets record ${has ? 'shows' : 'is put away with no game graded'}`);
  if (has) {
    const months = Object.keys(R.byMonth || {}).filter(m => okR(R.byMonth[m])).sort((a, b) => (a === 'playoffs') - (b === 'playoffs') || (a < b ? -1 : a > b ? 1 : 0));
    const wl = r => `${r.w}–${r.l}${r.p ? '–' + r.p : ''}`, rate = r => r.su.w + r.su.l ? (100 * r.su.w / (r.su.w + r.su.l)).toFixed(1) + '%' : '–';
    const wantB = [['season', 'Season', '', R]].concat(months.map(m => [m, m === 'playoffs' ? 'Playoffs' : `${MON_L[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`, m === 'playoffs' ? '' : `${MON_S[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}`, R.byMonth[m]]));
    const wide = x => { const c = x.cloneNode(true); for (const y of c.querySelectorAll('.t-narrow')) y.remove(); return txt(c); };
    const rowsB = [...d.querySelectorAll('#pkBets tbody tr')], badB = [];
    if (rowsB.length !== wantB.length) badB.push(`${rowsB.length} rows for the season and ${months.length} month(s)`);
    wantB.forEach(([key, lab, short, r], i) => { const tr = rowsB[i]; if (!tr) return;
      const got = [tr.dataset.k, wide(tr.cells[0]), txt(tr.cells[0].querySelector('.t-narrow')), txt(tr.cells[1].querySelector('b')), txt(tr.cells[1].querySelector('small')), txt(tr.cells[2]), txt(tr.cells[3]), txt(tr.cells[4])];
      const want = [key, lab, short, `${r.su.w}–${r.su.l}`, rate(r), wl(r.ml), wl(r.pl), wl(r.ou)];
      if (!eqA(got, want)) badB.push(`${key}: ${got.join(' | ')}, want ${want.join(' | ')}`); });
    const thB = [...d.querySelectorAll('#pkBets thead th')], bar = Math.round((St.edge || 0.05) * 100);
    ck(!badB.length && eqA(thB.map(txt), ['When', 'Straight up', 'Moneyline', 'Puck line', 'Totals']) && thB.slice(1).every(th => (th.getAttribute('title') || '').length >= 30) && thB.slice(2).every(th => th.getAttribute('title').includes(`${bar} points or more`)),
      `the Bets record, a row for the season and one a month: the call straight up with its rate, and its moneyline, puck line and totals sides, a push counted where there is one (${rowsB.length} rows; ${badB.slice(0, 3).join(' || ')})`);
  }
  /* on a state the job made: its record is its finals and calls worked out again, the call's season on the chart is it, and the four bands hold it */
  if (opts.regrade) {
    const mine = sPkRecord(St), Bs = PK_BANDS_S.reduce((a, [k]) => [a[0] + B[k].w, a[1] + B[k].l], [0, 0]);
    ck(okR(R) && sPkRecStr(mine) === sPkRecStr(R), `the state's record is its finals and calls graded again, the season and month by month (${sPkRecStr(R).slice(0, 160)}; graded again ${sPkRecStr(mine).slice(0, 160)})`);
    ck(okR(R) && D.rec.call.w === R.su.w && D.rec.call.l === R.su.l && Bs[0] === R.su.w && Bs[1] === R.su.l, `the call's season on the tab is the state's own straight-up record, and the four bands add up to it (${D.rec.call.w}-${D.rec.call.l}; bands ${Bs.join('-')}; the job's ${R && R.su ? R.su.w + '-' + R.su.l : 'none'})`);
  }
  /* calls made before the injury report was read: one short line under the bets record, only where there are any */
  const blind = St.games.filter(g => g.result && g.frozen && g.pm && !g.pm.inj).length;
  ck(blind && has ? !el('pkBlind').hidden && txt(el('pkBlind')) === `${blind} call${blind === 1 ? '' : 's'} predate${blind === 1 ? 's' : ''} the injury report.` : el('pkBlind').hidden, `the tab says how many calls were made without the injury report, in one short line (${blind}: ${el('pkBlind').hidden ? 'hidden' : txt(el('pkBlind'))})`);
  /* every pick of a day: shut until asked; then the day it opens on (today with games, else the latest played) and a day before it */
  const days = [...new Set(St.games.map(g => g.date))].sort();
  ck(el('pkPicksW').hidden && el('pkShow').getAttribute('aria-expanded') === 'false' && txt(el('pkShow')) === 'Show every pick' && el('pkDayL').hidden && !el('pkPicks').rows.length && el('pkBar').hidden === !days.length, `every pick shut until asked${days.length ? '' : ', and with no game on the schedule nothing to ask for'}`);
  if (days.length) {
    el('pkShow').click();
    const today = etDate(w.Date.now()), open = days.includes(today) ? today : [...days].reverse().find(x => x <= today) || days[0];
    ck(!el('pkPicksW').hidden && el('pkShow').getAttribute('aria-expanded') === 'true' && txt(el('pkShow')) === 'Hide every pick' && !el('pkDayL').hidden && el('pkDay').value === open && eqA([...el('pkDay').options].map(o => o.value), [...days].reverse()), `shown, it opens on ${open}, the days with games to choose from, the latest first (${el('pkDay').value})`);
    /* each day by its own words, its weekday and date (the review of nhl v30: a day's name was free to be another day's) */
    const dayWrong = [...el('pkDay').options].filter(o => txt(o) !== sPkDayWords(o.value));
    ck(!dayWrong.length, `each day to choose from named by its weekday and date, "${sPkDayWords(open)}" (${dayWrong.slice(0, 3).map(o => `${o.value}: "${txt(o)}"`).join(', ')})`);
    ck(eqA([...d.querySelectorAll('#pkPicks thead th')].map(txt), ['Game'].concat(PK_S.map(x => x[1]))) && el('pkPicksW').classList.contains('pickgrid'), `the picks' columns: the game, then a column a model (${[...d.querySelectorAll('#pkPicks thead th')].map(txt).join(' ')})`);
    const holdDay = day => {
      const now = w.Date.now(), gs = St.games.filter(g => g.date === day).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)), rows = [...d.querySelectorAll('#pkPicks tbody tr[data-id]')], bad = [];
      if (rows.map(r => r.dataset.id).sort().join() !== gs.map(g => g.id).sort().join()) bad.push(`games ${rows.map(r => r.dataset.id).join(',')}`);
      for (let i = 1; i < rows.length; i++) { const a = St.games.find(g => g.id === rows[i - 1].dataset.id), b = St.games.find(g => g.id === rows[i].dataset.id); if (a && b && Date.parse(a.start) > Date.parse(b.start)) bad.push('not in puck-drop order'); }
      for (const tr of rows) {
        const g = St.games.find(x => x.id === tr.dataset.id); if (!g) continue;
        const fin = g.state === 'final' && sPkWin(g), t0 = new Date(g.start), c0 = tr.cells[0], sm = c0.querySelector('small'), mu = c0.cloneNode(true); for (const x of mu.querySelectorAll('small')) x.remove();
        const when = `${t0.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} ${t0.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}`;
        /* a game is under way from its puck drop by the page's clock, which runs on: one within a few seconds of it may read either way.
           A start the feed moved after the puck drop its frozen call was made before (the job's delay rule) reads "start moved" until the
           new puck drop; one still to come with no such call, nothing */
        const moved = ms => g.state === 'pre' && Date.parse(g.start) > ms && delayedAt(g, g.start, ms), stand = ms => moved(ms) ? ' · start moved' : sStarted(g, ms) ? ' · under way' : '';
        const near = g.state === 'pre' && (Math.abs(Date.parse(g.start) - now) < 5000 || (g.before && Math.abs(Date.parse(g.before) - now) < 5000));
        const hows = fin ? [` · ${abbr(g[fin])} won ${g.as}–${g.hs}`] : near ? [...new Set([stand(now - 5000), stand(now + 5000)])] : [stand(now)];
        if (txt(mu) !== `${abbr(g.away)} at ${abbr(g.home)}` || !eqA([...c0.querySelectorAll('b')].map(txt), [abbr(g.away), abbr(g.home)]) || !hows.some(h => txt(sm) === (when + h).trim())) bad.push(`${g.id}: "${txt(mu)}" "${txt(sm)}", want "${abbr(g.away)} at ${abbr(g.home)}" "${when + hows[0]}"`);
        PK_S.forEach(([id], j) => {
          const c = tr.cells[1 + j], p = sPkPick(g, id, St), mark = !fin || !p ? '' : p === fin ? '✓' : '✗', x = PK_MK[id] ? sPkModel(g, id, St) : null, bt = !!(x && x.bt);
          const want = p ? abbr(g[p]) + mark + (bt ? 'bt' : '') : '–', res = c && c.querySelector('.res');
          if (!c || txt(c) !== want || (c.dataset.pick || null) !== p || (!!c.dataset.bt) !== bt || !!res !== !!mark || (res && res.classList.contains('ok') !== (mark === '✓')) || (p && txt(c.querySelector('.ttag')) !== abbr(g[p]))) bad.push(`${g.id} ${id}: "${txt(c)}"${c && c.dataset.bt ? ' (bt)' : ''}, want "${want}"`);
        });
      }
      ck(gs.length > 0 && !bad.length, `every pick of ${day}: the game, its day and puck drop, how it ended, each model's side and whether it was right (${gs.length} games; ${bad.slice(0, 3).join(' | ')})`);
    };
    holdDay(open);
    const past = [...days].reverse().find(x => x < open && St.games.some(g => g.date === x && g.state === 'final'));
    const choose = day => { const sel = el('pkDay'); sel.value = day; sel.dispatchEvent(new w.Event('change', { bubbles: true })); ck(d.activeElement === el('pkDay') && el('pkDay').value === day, 'the day chosen, the keyboard stays on it'); holdDay(day); };
    if (past) choose(past);
    /* and the latest day with a pick that is a backtest's (a final from before the models existed: its pick marked bt), and any day the copy plants on */
    const isBt = g => g.state === 'final' && Object.keys(PK_MK).some(id => { const x = sPkModel(g, id, St); return !!x && x.bt; });
    const btDay = [...days].reverse().find(x => x !== open && x !== past && St.games.some(g => g.date === x && isBt(g)));
    for (const day of [...new Set([btDay].concat(opts.days || []))].filter(x => x && days.includes(x) && x !== past && x !== open)) choose(day);
    el('pkShow').click();
    ck(el('pkPicksW').hidden && !el('pkPicks').rows.length && txt(el('pkShow')) === 'Show every pick' && el('pkShow').getAttribute('aria-expanded') === 'false', 'Hide every pick shuts them');
  }
  /* nothing stored but the tab the visitor is on, as before; nothing asked for */
  let stored = null; try { stored = JSON.parse(w.localStorage.getItem('nhl_v1')); } catch (e) { stored = null; }
  ck(eqA(w.__writes, writes0) && writes0.every(k => k === 'nhl_v1') && !!stored && !!stored.ui && stored.ui.tab === 'pickem', `the tab stores nothing of its own: the picks shown, the day and the week pointed at are in the page's memory (${w.__writes.length - writes0.length} writes after it opened; the tab kept: ${stored && stored.ui && stored.ui.tab})`);
  ck(w.__requests.every(r => r.url.startsWith('state.json?t=')), `the tab asks for nothing: the page read state.json and no more (${w.__requests.map(r => r.url.slice(0, 40)).join(', ')})`);
  ck(!errs.length, `no runtime error on the Pick'em tab: ${errs.join(' | ')}`);
  holdRequests(w, `THE PICK'EM RECORD (${tag})`);
  w.close();
}
/* ---------- THE PICK'EM MODELS (nhl v20, tools/models.js) ----------
   The NFL hub's three on the state: its `models` the constants' sha, fit and walk-forward table of data/models.json; its backtest the
   finals data/models_backtest.json holds less any carrying its own frozen call; every game to come called this run carrying the three
   with that sha, the ELO Model the Joker moved by the player model's gap (home ice out) by the registered beta, Alpha's chance the
   logistic of its margin; and, on the data the run stood on (players.json the state's own), every call made again by tools/models.js
   the same to the last place. A call made before puck drop and never moved after is the frozen-call check's (CALL) */
function modelsChecks() {
  console.log("THE PICK'EM MODELS");
  const f = path.join(DATA, 'models.json');
  if (!fs.existsSync(f)) { chk(!S.models, `no data/models.json and no models in the state (${JSON.stringify(S.models).slice(0, 60)})`); console.log('  no data/models.json: its checks skipped'); return; }
  const M = readJSON(f), Mo = require('./models');
  if (S.models === undefined) { chk(!(PREV && PREV.models), 'the models are in every state after the first that carried them'); console.log('  the state predates the models: their checks skipped'); return; }
  chk(!!S.models && S.models.v === M.v && S.models.beta === M.elo.beta && JSON.stringify(S.models.report) === JSON.stringify(M.report) && JSON.stringify(S.models.fitted) === JSON.stringify(M.fitted), `the state's models are data/models.json's (${S.models && S.models.v}, ${M.v})`);
  const bf = path.join(DATA, 'models_backtest.json'), B = fs.existsSync(bf) ? readJSON(bf) : null;
  const wantBt = B ? Object.fromEntries(Object.entries(B.games).filter(([id]) => S.games.some(g => g.id === id && !g.models))) : {};
  chk(!!S.models && JSON.stringify((S.models.backtest || {}).games || {}) === JSON.stringify(wantBt) && (S.models.backtest || {}).made === (B ? B.made : null), `the state's backtest is data/models_backtest.json's finals with no call of their own (${Object.keys(wantBt).length})`);
  const pubMin = Math.floor(PUB / 60000), hfa = S.players && S.players.params ? S.players.params.hfa : M.elo.hfa;
  const called = S.games.filter(g => g.state === 'pre' && g.frozen && Math.floor(Date.parse(g.frozen) / 60000) === pubMin && !sStarted(g, PUB));
  const bad = [];
  for (const g of called) {
    const c = g.models;
    if (!c || c.v !== M.v || !(c.alpha && c.alpha.pHome > 0 && c.alpha.pHome < 1) || !(c.joker && c.joker.pHome > 0 && c.joker.pHome < 1)) { bad.push(`${g.id}: ${String(JSON.stringify(c)).slice(0, 80)}`); continue; }
    if (Math.abs(c.alpha.pHome - 1 / (1 + Math.exp(-M.alpha.k * c.alpha.mu))) > 0.003) bad.push(`${g.id}: Alpha ${c.alpha.pHome} is not the logistic of its margin ${c.alpha.mu}`);
    if (!!g.pm !== !!c.elo) bad.push(`${g.id}: an ELO Model ${c.elo ? 'with no player model view' : 'missing beside the player model view'}`);
    if (c.elo) {
      const m = +(g.pm.mu - (g.neutral ? 0 : hfa)).toFixed(2), want = +Mo.eloP(M.elo.beta, c.joker.pHome, m).toFixed(4);
      if (c.elo.m !== m || c.elo.pHome !== want) bad.push(`${g.id}: ELO Model ${c.elo.pHome} on ${c.elo.m}, want ${want} on ${m}`);
    }
  }
  chk(!bad.length, `every game called this run carries Alpha, the Joker and the ELO Model, the ELO Model the Joker moved by the player model's gap (${called.length} games; ${bad.slice(0, 3).join(' | ')})`);
  /* made again on the data the run stood on: only where players.json is the one the state was built on */
  const PJf = path.join(DATA, 'players.json'), PJ = fs.existsSync(PJf) ? readJSON(PJf) : null;
  if (PJ && S.players && PJ.generated === S.players.generated && called.length) {
    const MD = Mo.prepare(DATA, S.season, S.games, S.model.params, PJ), diff = [];
    for (const g of called) { const c = MD.call(g, g.line, PJ.upcoming && PJ.upcoming[g.id]); if (JSON.stringify(c) !== JSON.stringify(g.models)) diff.push(`${g.id}: ${String(JSON.stringify(g.models)).slice(0, 70)} -> ${String(JSON.stringify(c)).slice(0, 70)}`); }
    chk(!diff.length, `every call made again by tools/models.js on the run's own data is the state's (${called.length} games; ${diff.slice(0, 2).join(' | ')})`);
    console.log(`  ${called.length} games called this run, each made again the same; beta ${M.elo.beta}; ${Object.keys(wantBt).length} finals from the backtest`);
  } else console.log(`  ${called.length} games called this run; the calls are not made again here (players.json is not the state's own, or no game was called)`);
}
/* ---------- TEAM RANKINGS (nhl v26) ----------
   The NFL hub's Team Rankings tab in hockey's terms, where the Standings and Power Ratings were: one table of the clubs in order of the
   team Elo and, under it, the absences that move a call. All of it worked out here from the state by rules of this file's own, never by
   the page's functions, and every rule an invariant of whatever state the job can publish (no final yet, a summer with no schedule, a
   day months after the last game, the playoffs, a champion, no player model):
   - the tab holds its two cards and nothing else: no intro, small print, select, button or link; the heading and its pill;
   - the order (the rating, best first; level, the key) and the rank (one more than the clubs whose Elo AS SHOWN, a whole number, is
     greater: clubs level on it share a rank);
   - each row word for word: the tag and the name, W-L-OTL, the points, the Elo and its shield (the tier of the number shown by the nine
     numbers below, its words on the shield), the chance against an average club, goals for and against a game, the simulation's two;
   - the Elo change and the rank chip over seven days from the state's own day: a club's Elo then is the rating going into its first
     game dated that day or later (the game row's rh or ra, whatever the game's state), its rating as it stands where it has none; the
     change the difference of the two whole numbers; the rank then every club's on its Elo then; a club with no final this season is
     ranked then where it stands and wears no chip. The page is held to the state's rows, never to a replay of tools/elo.js: rh and ra
     are call fields (the rating at the job's last run before the puck drop), and a replay would fail a publish, the job right, on the
     day a failed run left a row a game behind;
   - the absences card: exactly the outs worth OUT_ROW_S goals or more either way, the most first, each row's five cells, the stamp;
     hidden with none and with no player model;
   - opening the tab stores only the tab's name and asks the network for nothing; #standings, #playoff and a stored Standings tab open it;
   on the state and on three made-up copies (no final at all; a rating each side of every tier's line, clubs level, a club 40 Elo higher
   a week ago, one idle all week, one with no final, one with no playoff odds, outs each side of the bar; no out worth a row). */
const TR_HEAD = ['#', 'Team', 'Record', 'PTS', 'Elo', 'Elo change', 'Vs average', 'GF/G', 'GA/G', 'Playoff', 'Cup'];
const TR_ABS = ['Team', 'Player', 'Pos', 'Status', 'Goals off predicted margin'];
const TR_DAYS = 7;
/* copy B's planted outs worth a row, in the card's order: the size of the figure, then the club, then the name (the day's real outs fall among them) */
const TR_PLANT = ['Amy Beta', 'Dee Delta', 'Gil Goalie', 'Abe Alpha', 'Zed Alpha', 'Cy Gamma', 'Gia Edge'];
/* what each figure's heading says on its title, word for word: the page keeps a number's meaning nowhere else */
const TR_TITLES = ['Wins, losses, losses past regulation', 'Standings points', 'The team Elo, and its tier', `Elo gained or lost over the last ${TR_DAYS} days`, 'The chance of beating an average club on neutral ice',
  'Goals for a game this season', 'Goals against a game this season', "The simulation's chance of a playoff spot", "The simulation's chance of the Stanley Cup"];
/* hockey's ladder: the NFL's ten tiers on a 30-point step, Gold from 1500; under the last, Wood */
const TR_TIERS = [['HOF', 1650], ['Elite', 1620], ['Master', 1590], ['Diamond', 1560], ['Platinum', 1530], ['Gold', 1500], ['Silver', 1470], ['Bronze', 1440], ['Iron', 1410]];
const sTrTier = elo => { const t = TR_TIERS.find(x => elo >= x[1]); return t ? { name: t[0], words: `${t[0]} tier (Elo ${t[1]}+)` } : { name: 'Wood', words: `Wood tier (Elo under ${TR_TIERS[TR_TIERS.length - 1][1]})` }; };
const sTrBack = (iso, n) => { const x = new Date(iso + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
const sTrWords = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
const sTrCmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function sTrRows(St) {
  const from = sTrBack(St.today, TR_DAYS);
  const rows = Object.keys(St.teams).map(id => {
    const mine = St.games.filter(g => g.home === id || g.away === id), into = g => g.home === id ? g.rh : g.ra;
    const fins = mine.filter(g => g.state === 'final' && typeof g.hs === 'number');
    let first = null;
    for (const g of mine) { if (!(g.date >= from) || typeof into(g) !== 'number') continue; const a = Date.parse(g.start), b = first ? Date.parse(first.start) : Infinity; if (a < b || (a === b && String(g.id) < String(first.id))) first = g; }
    const rating = St.teams[id].rating;
    return { id, rating, elo: Math.round(rating), was: fins.length ? Math.round(first ? into(first) : rating) : null, n: fins.filter(g => g.date >= from).length };
  }).sort((a, b) => b.rating - a.rating || sTrCmp(a.id, b.id));
  for (const x of rows) x.then = x.was === null ? x.elo : x.was;
  for (const x of rows) { x.rank = 1 + rows.filter(y => y.elo > x.elo).length; x.rankWas = x.was === null ? null : 1 + rows.filter(y => y.then > x.then).length; }
  return { rows, from };
}
/* the bar an out has a row at, the page's OUT_ROW: 0.13 goals a game or more to his club, either way */
const OUT_ROW_S = 0.13;
const isRowS = o => typeof o.cost === 'number' && Math.abs(o.cost) >= OUT_ROW_S - 1e-9;
/* what an out is worth on the card, or null where he has no row: a player with a cost by the player model, that cost at the Games card's
   bar; a goalie (players.js gives him none), the gap to his replacement, as the NFL sizes a quarterback: his save rating less that of the
   goalie in net for his club's next game, in whole hundredths (worked in thousandths, as the state writes a rating), at the bar or over
   and only where he is the better of the two */
function sTrWorth(St, t, o) {
  if (typeof o.cost === 'number') return isRowS(o) ? o.cost : null;
  const P = (St.players && St.players.players) || {}, p = o.pos === 'G' && o.id != null ? P[o.id] : null, n = t.goalie;
  if (!p || typeof p.gk !== 'number' || !n || typeof n.gk !== 'number') return null;
  const h = Math.round((Math.round(p.gk * 1000) - Math.round(n.gk * 1000)) / 10);
  return h >= Math.round(OUT_ROW_S * 100) ? h / 100 : null;
}
/* the outs worth a row, in the card's order: the size of the figure, then the club's key, then the name */
function sTrOuts(St) {
  const list = [];
  for (const [club, t] of Object.entries((St.players && St.players.teams) || {})) for (const o of t.out || []) { const cost = sTrWorth(St, t, o); if (cost !== null) list.push({ club, o, cost }); }
  return list.sort((a, b) => Math.abs(b.cost) - Math.abs(a.cost) || sTrCmp(a.club, b.club) || sTrCmp(String(a.o.name), String(b.o.name)));
}
const sTrGoals = x => { const r = Math.round(x * 100) / 100; return `${r > 0 ? '+' : ''}${(r === 0 ? 0 : r).toFixed(2)} goals`; };
const sTrStatus = s => { const v = String(s || 'Out'); return /^out$/i.test(v) ? 'OUT' : v.charAt(0).toUpperCase() + v.slice(1).toLowerCase(); };
async function holdRankings(St, ms, tag, opts = {}) {
  const errs = [], w = await boot(ms, errs, Object.assign({ state: JSON.stringify(St) }, opts.hash ? { hash: opts.hash } : {}, opts.store ? { store: opts.store } : {})), d = w.document;
  const sec = d.getElementById('tab-ratings'), ck = (ok, msg) => chk(ok, `${tag}: ${msg}`), ids = Object.keys(St.teams);
  ck(!!sec && !sec.hidden && w.location.hash === '#ratings' && (d.querySelector('#tabs button.on') || { dataset: {} }).dataset.tab === 'ratings' && txt(d.querySelector('#tabs button.on')) === 'Team Rankings' && d.querySelector('#tabs button.on').getAttribute('aria-current') === 'page',
    `${opts.how || '#ratings'} opens Team Rankings, the address #ratings (${w.location.hash}; ${txt(d.querySelector('#tabs button.on'))})`);
  if (!sec) { w.close(); return; }
  /* the two cards and nothing else: no description and no control */
  ck(eqA([...sec.children].map(c => `${c.tagName.toLowerCase()}#${c.id}.${c.className}`), ['div#ratingsCard.card', 'div#injCard.card']) && !sec.querySelector('select, button, input, a, details, small, .intro, .note') && [...sec.querySelectorAll('p')].every(p => p.classList.contains('inj-asof')),
    `the tab holds its two cards and nothing else: no intro, small print, select, button or link (${[...sec.children].map(c => c.id || c.tagName).join(', ')}; ${[...sec.querySelectorAll('select, button, input, a, details, small, p')].map(x => x.tagName.toLowerCase() + (x.className ? '.' + x.className : '')).join(' ')})`);
  const h2 = sec.querySelector('#ratingsCard h2'), pills = h2 ? [...h2.querySelectorAll('.pill')] : [], lead = h2 ? [...h2.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\s+/g, ' ').trim() : '';
  const champ = St.playoff && St.playoff.phase === 'over' && St.playoff.champion;
  ck(sec.querySelectorAll('h2').length === 1 && lead === 'Team rankings' && pills.length === 2 && txt(pills[0]) === 'Team Elo' && pills[1].id === 'ratChamp' && (champ ? !pills[1].hidden && txt(pills[1]) === `${St.teams[champ].short} won the Cup` : pills[1].hidden && !txt(pills[1])),
    `the heading is "Team rankings", its pill "Team Elo", and a champion's pill exactly when the season has one (${txt(h2)})`);
  /* one table, in a wrapper that scrolls sideways; its head the eleven words; a row a club, eleven cells each */
  const tbs = [...sec.querySelectorAll('#ratingsCard table')], tb = tbs[0], trs = tb ? [...tb.querySelectorAll('tbody tr')] : [];
  const heads = tb ? [...tb.querySelectorAll('thead th')] : [];
  ck(tbs.length === 1 && tb.classList.contains('rt-v') && tb.parentElement.classList.contains('wrap') && /^(auto|scroll)$/.test(w.getComputedStyle(tb.parentElement).overflowX) && eqA(heads.map(txt), TR_HEAD) && trs.length === ids.length && trs.every(r => r.cells.length === TR_HEAD.length),
    `one table (table.rt-v) in a wrapper that scrolls sideways, its head ${TR_HEAD.join(' · ')}, a row a club (${tbs.length} tables; ${heads.map(txt).join(' · ')}; ${trs.length} rows of ${ids.length})`);
  /* what a number means is on its heading's title, never in a sentence on the page */
  ck(heads.length === TR_HEAD.length && eqA(heads.slice(2).map(th => th.getAttribute('title')), TR_TITLES) && heads.slice(0, 2).every(th => !th.getAttribute('title')), `each figure's heading says what it is on its title, word for word, the Elo change's its seven days (${heads.slice(2).map(th => th.getAttribute('title')).join(' | ')})`);
  if (tbs.length !== 1 || trs.length !== ids.length || !trs.every(r => r.cells.length === TR_HEAD.length)) { ck(!errs.length, 'no runtime error: ' + errs.join(' | ')); w.close(); return; }
  /* every row, by this file's own sums */
  const { rows, from } = sTrRows(St), since = sTrWords(from), po = (St.playoff && St.playoff.odds) || {}, games = n => `${n} game${n === 1 ? '' : 's'}`, bad = [];
  const MAPP = pageMap(w), per = (n, gp) => gp ? (n / gp).toFixed(2) : '—', odd = (o, k, places) => o && typeof o[k] === 'number' ? (o[k] * 100).toFixed(places) + '%' : '—';
  rows.forEach((x, i) => {
    const r = trs[i], c = r.cells, t = St.teams[x.id], miss = m => bad.push(`row ${i + 1} ${x.id}: ${m}`);
    if (txt(c[0]) !== String(x.rank)) miss(`rank "${txt(c[0])}", want ${x.rank}`);
    /* the club: its tag (its abbreviation, filled in its colour, hidden from a screen reader beside its name), its name, then the rank chip; the one held cell */
    const tg = c[1].querySelector('.ttag'), tw = c[1].querySelector('.tw');
    if (!tg || !tw || tg.parentElement !== tw || txt(tg) !== t.abbr || !tg.classList.contains('mini') || !tg.classList.contains('win') || tg.getAttribute('aria-hidden') !== 'true' || txt(tw.querySelector('.tn')) !== t.short || (MAPP[x.id] && tagWrong(tg, MAPP[x.id]))) miss(`club "${txt(c[1])}", want the tag ${t.abbr} and ${t.short}`);
    if (!c[1].classList.contains('sk') || [...c].filter(q => q.classList.contains('sk')).length !== 1) miss('the club is not the one held cell');
    const mv = c[1].querySelectorAll('.rankmv'), m0 = mv[0], dR = x.rankWas === null ? null : x.rankWas - x.rank;
    if (dR === null) { if (mv.length) miss(`a rank chip "${txt(m0)}" on a club with no final`); }
    else if (mv.length !== 1 || m0.parentElement !== tw) miss(`${mv.length} rank chips, want one in the club's box`);
    else if (dR === 0) { if (!m0.classList.contains('flat') || m0.classList.contains('up') || m0.classList.contains('down') || m0.getAttribute('title') !== `No change since ${since}` || w.getComputedStyle(m0).display !== 'none') miss(`rank chip "${txt(m0)}" (${m0.className}; ${m0.getAttribute('title')}; display ${w.getComputedStyle(m0).display}), want a level one, not shown`); }
    else { const wds = `${dR > 0 ? 'Up' : 'Down'} ${Math.abs(dR)} since ${since}`, arrow = m0.querySelector('i');
      if (!m0.classList.contains(dR > 0 ? 'up' : 'down') || m0.classList.contains(dR > 0 ? 'down' : 'up') || m0.classList.contains('flat') || !arrow || txt(arrow) !== (dR > 0 ? '▲' : '▼') || txt(m0) !== `${dR > 0 ? '▲' : '▼'}${Math.abs(dR)}` || m0.getAttribute('title') !== wds || m0.getAttribute('aria-label') !== wds || w.getComputedStyle(m0).display === 'none')
        miss(`rank chip "${txt(m0)}" (${m0.className}; ${m0.getAttribute('title')}), want ${dR > 0 ? '▲' : '▼'}${Math.abs(dR)}, "${wds}" (rank ${x.rankWas} then, ${x.rank} now)`); }
    if (txt(c[2]) !== `${t.w}-${t.l}-${t.otl}`) miss(`record "${txt(c[2])}", want ${t.w}-${t.l}-${t.otl}`);
    if (txt(c[3]) !== String(t.pts)) miss(`points "${txt(c[3])}", want ${t.pts}`);
    /* the Elo a whole number in bold, the shield before it the tier of that number */
    const sh = c[4].querySelector('svg.tierbadge'), bb = c[4].querySelector('b'), tier = sTrTier(x.elo);
    if (!bb || txt(bb) !== String(x.elo) || txt(c[4]).replace(txt(sh && sh.querySelector('title')), '').trim() !== String(x.elo)) miss(`Elo "${txt(bb)}", want ${x.elo} (${x.rating})`);
    if (!sh || !bb || c[4].querySelectorAll('svg').length !== 1 || sh.getAttribute('aria-label') !== `${tier.name} tier` || sh.getAttribute('role') !== 'img' || txt(sh.querySelector('title')) !== tier.words || !(sh.compareDocumentPosition(bb) & 4)) miss(`shield "${sh && sh.getAttribute('aria-label')}" / "${sh && txt(sh.querySelector('title'))}", want ${tier.words} before the number`);
    else { const fills = [...sh.querySelectorAll('[fill^="url(#"]')].map(p => /#([\w-]+)\)/.exec(p.getAttribute('fill'))[1]), wantFill = tier.name === 'Wood' ? [] : [tier.name === 'HOF' ? 'tg-hof-gem' : `tg-${tier.name.toLowerCase()}`];
      if (!eqA(fills, wantFill) || fills.some(f => d.querySelectorAll(`[id="${f}"]`).length !== 1)) miss(`shield filled ${fills.join(',') || 'flat'}, want ${wantFill.join(',') || 'flat'}, each gradient in the page once`); }
    /* the Elo change over the window */
    const ev = c[5].querySelectorAll('.elomv'), e0 = ev[0], dE = x.was === null ? null : x.elo - x.was;
    if (!c[5].classList.contains('movecell')) miss('the Elo change is not in a movecell');
    if (dE === null) { if (ev.length || txt(c[5])) miss(`an Elo change "${txt(c[5])}" on a club with no final`); }
    else if (ev.length !== 1 || txt(c[5]) !== txt(e0)) miss(`${ev.length} Elo chips ("${txt(c[5])}"), want one`);
    else if (dE === 0) { if (!e0.classList.contains('flat') || e0.classList.contains('up') || e0.classList.contains('down') || txt(e0) !== '·' || e0.getAttribute('title') !== `No change since ${since} (${games(x.n)})`) miss(`Elo chip "${txt(e0)}" (${e0.className}; ${e0.getAttribute('title')}), want · "No change since ${since} (${games(x.n)})"`); }
    else { const wds = `${dE > 0 ? 'Gained' : 'Lost'} ${Math.abs(dE)} Elo since ${since} (${games(x.n)})`, want = `${dE > 0 ? '+' : '−'}${Math.abs(dE)}`;
      if (!e0.classList.contains(dE > 0 ? 'up' : 'down') || e0.classList.contains(dE > 0 ? 'down' : 'up') || e0.classList.contains('flat') || txt(e0) !== want || e0.getAttribute('title') !== wds || e0.getAttribute('aria-label') !== wds) miss(`Elo chip "${txt(e0)}" (${e0.className}; ${e0.getAttribute('title')}), want ${want} "${wds}" (${x.was} then, ${x.elo} now)`); }
    const vs = `${Math.round(1 / (1 + Math.pow(10, -(x.rating - 1500) / 400)) * 100)}%`;
    if (txt(c[6]) !== vs) miss(`vs average "${txt(c[6])}", want ${vs}`);
    if (txt(c[7]) !== per(t.gf, t.gp) || txt(c[8]) !== per(t.ga, t.gp)) miss(`goals a game "${txt(c[7])}" and "${txt(c[8])}", want ${per(t.gf, t.gp)} and ${per(t.ga, t.gp)}`);
    if (txt(c[9]) !== odd(po[x.id], 'playoff', 0) || txt(c[10]) !== odd(po[x.id], 'cup', 1)) miss(`playoff "${txt(c[9])}" and Cup "${txt(c[10])}", want ${odd(po[x.id], 'playoff', 0)} and ${odd(po[x.id], 'cup', 1)}`);
  });
  ck(!bad.length, `every row by this file's own sums: the order, the shared rank, the club, the record and points, the Elo shown and its tier's shield, the Elo change and the rank chip since ${since}, the chance against an average club, goals a game, the playoff and Cup chances (${bad.length} wrong: ${bad.slice(0, 4).join(' | ')})`);
  /* the shields' gradients are in the page once, outside the table; no image */
  ck(d.querySelectorAll('#peDefs').length === (trs.length ? 1 : 0) && d.querySelectorAll('[id="tg-gold"]').length === 1 && !sec.querySelector('img, image, [style*="url("]') && ![...sec.querySelectorAll('*')].some(e => /gradient|defs/i.test(e.localName)), `the shields' gradients are defined once a page, outside the tab (#peDefs ${d.querySelectorAll('#peDefs').length}, #tg-gold ${d.querySelectorAll('[id="tg-gold"]').length})`);
  /* the absences card: exactly the outs worth a row, the most first */
  const outs = sTrOuts(St), card = d.getElementById('injCard'), box = d.getElementById('injSuggest'), aBad = [];
  { let bar; try { bar = w.eval('OUT_ROW'); } catch (e) { bar = String(e && e.message || e); }
    ck(bar === OUT_ROW_S, `the page's bar for an absence's row is ${OUT_ROW_S} goals a game (${bar})`); }
  if (!outs.length) ck(!!card && card.hidden && !!box && !box.children.length && w.getComputedStyle(card).display === 'none', `no out is worth ${OUT_ROW_S} goals${St.players ? '' : ' (no player model in the state)'}: the absences card is hidden and empty`);
  else {
    const at = card.querySelectorAll('table'), ar = at[0] ? [...at[0].querySelectorAll('tbody tr')] : [], pulled = St.players.injuries && St.players.injuries.pulled, stamp = [...card.querySelectorAll('p')];
    ck(!card.hidden && txt(card.querySelector('h3')) === 'Impact absences' && card.querySelectorAll('h2, h3').length === 1 && at.length === 1 && at[0].parentElement.classList.contains('wrap') && eqA([...at[0].querySelectorAll('thead th')].map(txt), TR_ABS) && ar.length === outs.length && ar.every(r => r.cells.length === TR_ABS.length),
      `the absences card shows: "Impact absences", one table in a wrapper, ${TR_ABS.join(' · ')}, a row for each of the ${outs.length} outs worth ${OUT_ROW_S} goals or more (${ar.length} rows; ${at[0] ? [...at[0].querySelectorAll('thead th')].map(txt).join(' · ') : 'no table'})`);
    if (ar.length === outs.length && ar.every(r => r.cells.length === TR_ABS.length)) outs.forEach(({ club, o, cost }, i) => {
      const c = ar[i].cells, tg = c[0].querySelector('.ttag'), fig = c[4].querySelector('b.delta'), pill = c[3].querySelector('.tier');
      const want = [St.teams[club].abbr, String(o.name), o.pos || '—', sTrStatus(o.status), sTrGoals(-cost)], have = [txt(tg), txt(c[1]), txt(c[2]), txt(pill), txt(fig)];
      if (!tg || !fig || !pill) { aBad.push(`row ${i + 1}: ${txt(ar[i])}, want ${want.join(' · ')}`); return; }
      if (!eqA(have, want) || txt(c[0]) !== want[0] || txt(c[3]) !== want[3] || txt(c[4]) !== want[4] || !pill.classList.contains('out') || fig.classList.contains('down') !== (cost > 0) || fig.classList.contains('up') !== !(cost > 0) || !c[1].classList.contains('sk') || (MAPP[club] && tagWrong(tg, MAPP[club])))
        aBad.push(`row ${i + 1}: ${have.join(' · ')} (${fig ? fig.className : 'no figure'}), want ${want.join(' · ')} ${cost > 0 ? 'down' : 'up'}`);
    });
    ck(!aBad.length, `each absence's row: the club's tag, the player, his position, the report's status, and what his absence does to his club's margin (a goalie's the gap to the goalie in net), rose where it costs and lime where it gains (${aBad.slice(0, 3).join(' | ')})`);
    { const fh = at[0] && at[0].querySelector('thead th:last-child');
      ck(!!fh && fh.getAttribute('title') === "What his absence does to his club's expected margin, by the player model; a goalie against the goalie in net", `the figure's heading says what it is on its title, a goalie's too (${fh ? fh.getAttribute('title') : 'no heading'})`); }
    ck(pulled ? stamp.length === 1 && stamp[0].classList.contains('inj-asof') && txt(stamp[0]) === `Injury report of ${new Date(pulled).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}` : !stamp.length, `the card's one line is the injury report's own time, in the visitor's clock (${stamp.map(txt).join(' | ') || 'none'})`);
  }
  /* nothing stored but the tab's name, nothing fetched: another tab and back */
  { const other = d.querySelector('#tabs button[data-tab="pickem"]'); other.click();
    const st0 = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}'), r0 = w.__requests.length, w0 = w.__writes.length, html0 = tb.outerHTML;
    d.querySelector('#tabs button[data-tab="ratings"]').click();
    const st1 = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}'), wr = w.__writes.slice(w0), tab1 = st1.ui && st1.ui.tab;
    if (st0.ui) st0.ui.tab = null; if (st1.ui) st1.ui.tab = null;
    ck(w.__requests.length === r0 && wr.every(k => k === 'nhl_v1') && tab1 === 'ratings' && eqA(st0, st1) && w.location.hash === '#ratings', `opening the tab asks the network for nothing and stores nothing but the tab's name (${w.__requests.length - r0} requests; wrote ${[...new Set(wr)].join(', ') || 'nothing'}; tab ${tab1})`);
    const tb2 = sec.querySelector('table.rt-v');
    ck(!!tb2 && tb2.outerHTML === html0 && d.querySelectorAll('#peDefs').length === 1 && d.querySelectorAll('[id="tg-gold"]').length === 1, 'drawn again it is the same table, the gradients still in the page once'); }
  ck(!errs.length, 'no runtime error: ' + errs.join(' | '));
  w.close();
  return { rows, from, outs };
}
async function teamRankingsChecks() {
  console.log('TEAM RANKINGS');
  const R0 = await holdRankings(S, PUB, 'the state', { hash: 'ratings' });
  if (R0) console.log(`  the state: ${R0.rows.length} clubs, ${R0.rows.filter(x => x.was !== null).length} with a final; since ${R0.from}: ${R0.rows.filter(x => x.was !== null && x.elo !== x.was).length} moved in Elo, ${R0.rows.filter(x => x.rankWas !== null && x.rankWas !== x.rank).length} in rank; ${new Set(R0.rows.map(x => x.elo)).size} different Elos shown; tiers ${[...new Set(R0.rows.map(x => sTrTier(x.elo).name))].join(', ')}; ${R0.outs.length} absences worth a row`);
  /* (A) no final at all, as on opening night: every game to come at the ratings as they stand, the records zero, no player model. No
     chip anywhere, a dash in both rate cells, the card hidden; the old #standings address opens the tab */
  { const A = JSON.parse(STATE);
    for (const g of A.games) { g.state = 'pre'; g.hs = null; g.as = null; g.rh = A.teams[g.home].rating; g.ra = A.teams[g.away].rating; }
    for (const t of Object.values(A.teams)) for (const k of ['w', 'l', 'otl', 'pts', 'rw', 'row', 'gf', 'ga', 'gp']) t[k] = 0;
    A.players = null;
    const RA = sTrRows(A);
    chk(RA.rows.every(x => x.was === null && x.rankWas === null) && !sTrOuts(A).length, 'copy A plants a season with no final and no player model');
    await holdRankings(A, PUB, 'copy A (no final yet, no player model)', { hash: 'standings', how: 'the old #standings address' }); }
  /* (B) a rating each side of every tier's line (1649.6 shows 1650 and wears HOF, 1649.4 shows 1649 and wears Elite); three clubs level
     on the Elo shown; a club 40 Elo higher going into its first game of the window; a club with no game in the window; a club with no
     final (the others ranked then with it where it stands); a club with no playoff odds; outs each side of the bar, level in size, with
     no position and no status; the old #playoff address */
  { const B = JSON.parse(STATE), ord = Object.keys(B.teams).sort((a, b) => B.teams[b].rating - B.teams[a].rating || sTrCmp(a, b)), from = sTrBack(B.today, TR_DAYS);
    const use = ord.slice(); let planted = use.length >= 28;
    if (planted) {
      TR_TIERS.forEach(([, m]) => { B.teams[use.shift()].rating = m - 0.4; B.teams[use.shift()].rating = m - 0.6; });
      const lv = [use.shift(), use.shift(), use.shift()]; B.teams[lv[0]].rating = 1455.4; B.teams[lv[1]].rating = 1454.6; B.teams[lv[2]].rating = 1455;
      const hi = use.shift(), idle = use.shift(), none = use.shift(), noOdds = use.shift();
      const inWin = id => B.games.filter(g => g.date >= from && (g.home === id || g.away === id)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
      B.games = B.games.filter(g => !(g.date >= from && (g.home === idle || g.away === idle)));
      const g1 = inWin(hi)[0]; if (g1) { if (g1.home === hi) g1.rh = B.teams[hi].rating + 40; else g1.ra = B.teams[hi].rating + 40; }
      for (const g of B.games) if ((g.home === none || g.away === none) && g.state === 'final') { g.state = 'pre'; g.hs = null; g.as = null; }
      if (B.playoff && B.playoff.odds) delete B.playoff.odds[noOdds];
      if (B.players && B.players.teams) { const cl = Object.keys(B.players.teams).sort();
        if (cl.length >= 3) {
          B.players.teams[cl[0]].out = [{ id: 'p1', name: 'Zed Alpha', pos: 'C', status: 'Out', cost: 0.13 }, { id: 'p2', name: 'Amy Beta', pos: '', status: 'Suspension', cost: -0.4 }, { id: 'p3', name: 'Low Guy', pos: 'D', status: 'Injured Reserve', cost: 0.129 }, { id: 'p4', name: 'No Cost', pos: 'G', status: 'Injured Reserve' }, { id: 'p5', name: 'Abe Alpha', pos: 'LW', cost: 0.13 }];
          B.players.teams[cl[1]].out = [{ id: 'p6', name: 'Cy Gamma', pos: 'G', status: 'Injured Reserve', cost: -0.13 }, { id: 'p7', name: 'Dee Delta', pos: 'RW', status: 'Injured Reserve', cost: 0.31 }];
          B.players.teams[cl[2]].out = [{ id: 'p8', name: 'Under Bar', pos: 'D', status: 'Out', cost: -0.12 }];
          /* goalies, who have no cost: one 0.25 over the goalie in net, one at the bar to the thousandth (0.125 is 0.13 in hundredths), one
             just under it, one worse than the goalie in net, one no table rates, one with no id */
          const t2 = B.players.teams[cl[2]]; if (!t2.goalie || typeof t2.goalie.gk !== 'number') t2.goalie = { id: 'pg0', name: 'In Net', gk: -0.05, how: 'planted' };
          const k0 = Math.round(t2.goalie.gk * 1000); B.players.players = B.players.players || {};
          [['pg1', 'Gil Goalie', 250], ['pg2', 'Gia Edge', 125], ['pg3', 'Gus Under', 124], ['pg4', 'Guy Worse', -300]].forEach(([id, name, dk]) => {
            B.players.players[id] = { name, pos: 'G', team: cl[2], o: 0, d: 0, gk: (k0 + dk) / 1000, v: (k0 + dk) / 1000, gp: 1, toi: 60, seasons: {} };
            t2.out.push({ id, name, pos: 'G', status: 'Injured Reserve', cost: null }); });
          t2.out.push({ id: 'pg9', name: 'Not Rated', pos: 'G', status: 'Injured Reserve', cost: null }, { id: null, name: 'No Id', pos: 'G', status: 'Out', cost: null });
        } }
      const RB = sTrRows(B), by = Object.fromEntries(RB.rows.map(x => [x.id, x])), names = new Set(RB.rows.map(x => sTrTier(x.elo).name)), oB = sTrOuts(B);
      chk(names.size === 10 && TR_TIERS.every(([, m]) => RB.rows.some(x => x.elo === m) && RB.rows.some(x => x.elo === m - 1)) && lv.every(id => by[id].elo === 1455 && by[id].rank === by[lv[0]].rank) && RB.rows.filter(x => x.elo < 1455).every(x => x.rank >= by[lv[0]].rank + 3)
        && (!g1 || by[hi].was === null || by[hi].elo - by[hi].was === -40) && by[idle].n === 0 && (by[idle].was === null || by[idle].was === by[idle].elo) && by[none].was === null && by[none].rankWas === null
        && (!B.playoff || !B.playoff.odds || !(noOdds in B.playoff.odds)) && (!B.players || !B.players.teams || Object.keys(B.players.teams).length < 3 || (eqA(oB.map(x => x.o.name).filter(n => TR_PLANT.includes(n)), TR_PLANT) && eqA(TR_PLANT.map(n => { const x = oB.find(y => y.o.name === n); return x ? x.cost : null; }), [-0.4, 0.31, 0.25, 0.13, 0.13, -0.13, 0.13]) && !oB.some(x => ['Low Guy', 'No Cost', 'Under Bar', 'Gus Under', 'Guy Worse', 'Not Rated', 'No Id'].includes(x.o.name)))),
        `copy B plants all ten tiers with a rating each side of every line, three clubs level, a club 40 Elo down on the week${g1 ? '' : ' (not planted: no game of its own in the window)'}, one idle, one with no final, one with no playoff odds, and outs each side of the bar, goalies among them, in the card's order among themselves (${[...names].join(', ')}; ${hi} ${by[hi].was} to ${by[hi].elo}; ${oB.length} outs: ${oB.filter(x => TR_PLANT.includes(x.o.name)).map(x => `${x.o.name} ${x.cost}`).join(', ')})`);
      await holdRankings(B, PUB, 'copy B (every tier, level clubs, the planted week, the planted outs)', { hash: 'playoff', how: 'the old #playoff address' });
    } else chk(false, `copy B needs 28 clubs to plant on (${ord.length})`); }
  /* (C) a player model with no out worth a row: the card hidden; and a Standings tab stored by an older page opens Team Rankings */
  { const C = JSON.parse(STATE);
    if (C.players && C.players.teams) for (const t of Object.values(C.players.teams)) t.out = (t.out || []).filter(o => sTrWorth(C, t, o) === null);
    chk(!sTrOuts(C).length, 'copy C plants a player model with no out worth a row');
    await holdRankings(C, PUB, 'copy C (no out worth a row; an older page\'s stored Standings tab)', { store: JSON.stringify({ ui: { tab: 'standings' } }), how: 'a stored Standings tab' }); }
}

/* ---------- ELO RATINGS (nhl v29) ----------
   The NFL hub's ELO Ratings tab in hockey's terms, where the Players tab was: one card (the heading and its pill, one search box, the
   three position pills, the clubs' four, the tier histogram, one table) and the stamp over it. All of it worked out here from the state
   by rules of this file's own, never by the page's functions, and every rule an invariant of whatever state the job can publish (no
   player model, a summer with no box score, a group of one, a group all level, a club with no goalie in net):
   - who is ranked: a rated player of the group (a goalie, a defenceman, anyone else a forward) with the floor of games behind his
     rating (20; a goalie 10) and either on a club's injury report (out or day to day, by the row's id) or a game this season: his
     `last`, the day of his last game on the ice (tools/players.js writes it; where the state has it, it is held here to the box
     file), is of this season, or of last season while this one has no final. A state from before `last` (no player has one) is
     read by the rule the tab shipped with: on a report, in a club's last lineup, its goalie in net, or on the ice in a final whose
     box score the state carries. His mark where a report names him: the first club's out row (IR, SUSP or OUT by its words, the
     words on its title), else a day to day (DTD), and the club he is shown at is that report's;
   - the order (the figure, best first; level, the name, then the id) and the rank, one more than the players whose Elo as shown is
     greater (players level on it share a rank), kept through a search; a club's place in a unit the same;
   - the scale: Elo = round(1500 + 100 x (v - mean) / sd), the mean and the population's spread of the group's ranked figures, summed in
     the ranked order (so the last bit is the page's); every Elo 1500 where the spread is nothing. The tier of the Elo shown by the
     NFL's nine numbers, its words on the shield;
   - each row word for word: the rank, the name and mark and the small line (position, club, games), the club's tag, the Elo with the
     figure to the thousandth on its title, the shield and its tier, the figures in goals a game to the hundredth (half away from zero,
     signed, lime over zero and rose under), Career (the average of his season-end figures on file, on the same scale), Trend (a line
     through them to now, lime where it ends at or over its start, its numbers on the cell's title) and Peak (the best of them and of
     now, the first season to reach it);
   - the histogram: twelve 50-point bins from 1200 to 1800, the ends clamped in, each bin's count, its bar in its tier's colour (taller
     for more), the tiers and their lines under the axis, the bell curve as tall as a normal curve of as many, the legend, the label a
     screen reader gets, a bin's words while the pointer is on it; none under five ranked; drawn at its box's width, 520 to 680px;
   - the clubs' four tables: each unit's order (the figure, best first; level, the key) among the clubs that have it, its scale and
     tiers, every club's four figures with their places (the top eight lime, the bottom eight rose), the goalie in net and how he was
     chosen; a club with no goalie last and unranked in Goaltending;
   - what a number means is on its heading's title, word for word; the card holds no description, select or link;
   - the pills: one pressed, the choice kept in nhl_v1 (ui.plKind) and nothing else; a stored Skaters or Goalies of the Players tab and
     a junk value open Forwards, Goalies and Forwards; two pills pressed one after the other draw the second's table alone; the search
     (a name, or a club's abbreviation typed whole) drawn a fifth of a second after the typing stops, never stored, and a name with no
     row said where it is (another group, under the floor, no game this season); the first sixty rows at once and the rest after;
     nothing fetched; #players and #elo open the tab;
   on the state and on made-up copies (no player model; on the first rule, every tier with a player each side of every line, players
   level, each kind of mark, each kind of history, players under the floor or with no club, two goalies, a club with no goalie; on
   `last`, a player off the report and not dressed who stays, one dressed whose last game was last season who does not, one on
   another club's report, a group all level, a group of five and a group of one; and the same before the season's first final). */
const PE_HEAD = { F: ['#', 'Player', 'Team', 'Elo', 'Tier', 'Goals/G', 'Offence', 'Defence', 'Career', 'Trend', 'Peak'], G: ['#', 'Player', 'Team', 'Elo', 'Tier', 'Goals/G', 'Career', 'Trend', 'Peak'],
  U: ['#', 'Team', 'Record', 'Rating', 'Tier', 'Overall', 'Attack', 'Defence', 'Goalie', 'In goal'] };
const PE_FLOOR_S = { F: 20, D: 20, G: 10 };
const PE_VIEWS = [['F', 'Forwards', 'forwards', 'forward'], ['D', 'Defencemen', 'defencemen', 'defenceman'], ['G', 'Goalies', 'goalies', 'goalie']];
const PE_UNITS_S = [['str', 'Overall'], ['off', 'Attack'], ['def', 'Defence'], ['gk', 'Goaltending']];
/* the NFL's ladder: the least Elo of each tier; under the last, Wood. And each tier's colour on the histogram (HOF's is the gem's gradient) */
const PE_LADDER = [['HOF', 1750], ['Elite', 1700], ['Master', 1650], ['Diamond', 1600], ['Platinum', 1550], ['Gold', 1500], ['Silver', 1450], ['Bronze', 1400], ['Iron', 1350]];
const PE_HEX = { Wood: '#9A7B56', Iron: '#6B6B6B', Bronze: '#A05A2C', Silver: '#9CA3AF', Gold: '#D4A017', Platinum: '#2FA5A0', Diamond: '#3B82F6', Master: '#DB2777', Elite: '#7C3AED' };
const sPeTier = elo => { const t = PE_LADDER.find(x => elo >= x[1]); return t ? { name: t[0], words: `${t[0]} tier (Elo ${t[1]}+)` } : { name: 'Wood', words: 'Wood tier (Elo under 1350)' }; };
const sPeGroup = pos => pos === 'G' ? 'G' : pos === 'D' ? 'D' : 'F';
const sPeSeason = y => `${y - 1}-${String(y).slice(2)}`;
const sPeIsNum = x => typeof x === 'number' && isFinite(x);
/* what each heading says on its title, word for word: the page keeps a number's meaning nowhere else */
const PE_TIER_WORDS = 'Wood under 1350, then a tier every 50 Elo: Iron, Bronze, Silver, Gold from 1500, Platinum, Diamond, Master, Elite, and HOF from 1750';
const sPeRankedWords = St => { const W = sPeWho(St); return 'Ranked: 20 games or more behind his rating (a goalie 10, of 20 minutes or more) and '
  + (W.dated ? `a game ${W.early ? 'last season or this' : 'this season'}, or on a club's injury report` : `with a club now: in its last lineup or in net, on its injury report, or on the ice in the last ${(St.box && St.box.days) || 14} days`); };
const sPeTitles = (St, view) => {
  const g = PE_VIEWS.find(x => x[0] === view), tail = ["His rating at the end of each season on file, averaged, on today's scale", 'His rating at the end of each season on file, then now', "His best rating at a season's end or now, on today's scale, and the season"];
  if (g) return ['', sPeRankedWords(St), '', `Goals a game by the player model, set on the Elo scale: 1500 the average ranked ${g[3]}, 100 a standard deviation`, PE_TIER_WORDS].concat(
    view === 'G' ? ['His save rating by the player model, in goals a game: the figure his Elo is set from']
      : ['What he adds to his club by the player model, in goals a game on the ice all game: his offence and his defence, the figure his Elo is set from', 'His offence rating, in goals a game', 'His defence rating, in goals a game'], tail);
  const name = PE_UNITS_S.find(x => x[0] === view)[1], what = { str: "the club's strength for its next game: its lineup's attack and defence and the goalie in net", off: "its lineup's offence, weighted by ice time", def: "its lineup's defence, weighted by ice time", gk: 'the save rating of the goalie in net for its next game' }[view];
  return ['', '', 'Wins, losses, losses past regulation', `${name}: ${what}, in goals a game by the player model, set on the Elo scale: 1500 the average club, 100 a standard deviation`, PE_TIER_WORDS,
    'Attack, defence and the goalie in net, in goals a game, and its place among the clubs', "Its lineup's offence, weighted by ice time, in goals a game, and its place among the clubs", "Its lineup's defence, weighted by ice time, in goals a game, and its place among the clubs",
    'The save rating of the goalie in net for its next game, in goals a game, and its place among the clubs', 'The goalie the model has in net for its next game'];
};
/* the scale of a list of figures, summed in the order given: the mean, the population's spread, and a figure's Elo on them */
function sPeScale(vals) {
  const n = vals.length; let sum = 0; for (const v of vals) sum += v;
  const m = n ? sum / n : 0; let sq = 0; for (const v of vals) sq += (v - m) * (v - m);
  const sd = n ? Math.sqrt(sq / n) : 0;
  return { n, m, sd, elo: v => sd > 1e-9 ? Math.round(1500 + 100 * (v - m) / sd) : 1500 };
}
/* the season of an Eastern day: August on is the next one's (the job's rule, written again here) */
const sPeDay = x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x);
const sPeSeasonOf = d => { const y = Number(d.slice(0, 4)), m = Number(d.slice(5, 7)); return m >= 8 ? y + 1 : y; };
/* who counts, but for the floor. `rep`: the players a report names, each his mark and that report's club (an out row before a day to
   day, the first club's that names him). `played`: with `last` in the state (any player has one), a game this season, or last season
   while this season has no final; without it, the rule the tab shipped with: a club's last lineup, its goalie in net, a final whose
   box score the state carries */
function sPeWho(St) {
  const PL = St.players || {}, clubs = Object.keys(PL.teams || {}).filter(k => PL.teams[k] && typeof PL.teams[k] === 'object'), rep = new Map(), P = PL.players || {};
  for (const [kind, key] of [['out', 'out'], ['dtd', 'dtd']]) for (const c of clubs) for (const o of PL.teams[c][key] || []) {
    if (!o || typeof o !== 'object' || o.id === null || o.id === undefined || rep.has(String(o.id))) continue;
    rep.set(String(o.id), { k: kind, w: kind === 'dtd' ? 'Day to day' : String(o.status || 'Out'), club: c }); }
  const dated = Object.values(P).some(p => p && typeof p === 'object' && sPeDay(p.last)), early = dated && !(St.games || []).some(g => g.state === 'final');
  if (dated) return { rep, dated, early, played: (id, p) => sPeDay(p.last) && (sPeSeasonOf(p.last) === St.season || (early && sPeSeasonOf(p.last) === St.season - 1)) };
  const now = new Set(), add = id => { if (id !== null && id !== undefined) now.add(String(id)); };
  for (const c of clubs) { for (const l of PL.teams[c].lineup || []) if (l && typeof l === 'object') add(l.id); const g = PL.teams[c].goalie; if (g && typeof g === 'object') add(g.id); }
  for (const b of Object.values((St.box && St.box.games) || {})) { if (!b || typeof b !== 'object') continue;
    for (const id of Object.keys(b.s && typeof b.s === 'object' ? b.s : {})) add(id); for (const id of Object.keys(b.g && typeof b.g === 'object' ? b.g : {})) add(id);
    for (const id of [].concat(Array.isArray(b.r) ? b.r : [], Array.isArray(b.u) ? b.u : [])) add(id); }
  return { rep, dated, early, played: id => now.has(id) };
}
/* ranks down a list of Elos already in order, best first: one more than the count of greater ones */
const sPeRanks = elos => elos.map(e => 1 + elos.filter(x => x > e).length);
function sPeRows(St, grp, who) {
  const W = who || sPeWho(St), P = (St.players && St.players.players) || {};
  const rows = Object.keys(P).filter(id => { const p = P[id]; return !!p && typeof p === 'object' && sPeIsNum(p.v) && sPeGroup(p.pos) === grp && p.gp >= PE_FLOOR_S[grp] && (W.rep.has(id) || W.played(id, p)); })
    .map(id => { const mark = W.rep.get(id) || null; return { id, p: P[id], mark, club: mark ? mark.club : P[id].team }; }).sort((a, b) => b.p.v - a.p.v || sTrCmp(String(a.p.name), String(b.p.name)) || sTrCmp(a.id, b.id));
  const sc = sPeScale(rows.map(x => x.p.v));
  for (const x of rows) x.elo = sc.elo(x.p.v);
  const rk = sPeRanks(rows.map(x => x.elo)); rows.forEach((x, i) => { x.rank = rk[i]; });
  return { rows, sc, who: W };
}
/* a name typed that no row of the pressed group holds: where its player is, or nothing. A ranked player of another group first (the
   groups in their order, each in its own), then the rated who are not ranked, the latest on the ice first, then the most games, the name */
function sPeWhere(St, q, view) {
  if (!q) return '';
  const W = sPeWho(St), hits = [], ranked = new Set(), P = (St.players && St.players.players) || {};
  for (const g of PE_VIEWS) for (const x of sPeRows(St, g[0], W).rows) { ranked.add(x.id); if (g[0] !== view && sPeFold(x.p.name).includes(q)) hits.push(`${x.p.name} · ${g[3]} · press ${g[1]}`); }
  const rest = Object.keys(P).filter(id => P[id] && typeof P[id] === 'object' && !ranked.has(id) && sPeFold(P[id].name).includes(q))
    .sort((a, b) => sTrCmp(String(P[b].last || ''), String(P[a].last || '')) || (P[b].gp || 0) - (P[a].gp || 0) || sTrCmp(String(P[a].name), String(P[b].name)) || sTrCmp(a, b));
  for (const id of rest) { const p = P[id], fl = PE_FLOOR_S[sPeGroup(p.pos)], n = p.gp || 0;
    hits.push(`${p.name} · ` + (!(p.gp >= fl) ? `${n} game${n === 1 ? '' : 's'} rated: under the floor of ${fl}` : W.dated ? `not ranked: no game ${W.early ? 'last season or this' : 'this season'}` : 'not ranked: with no club now')); }
  return hits.length ? hits[0] + (hits.length > 1 ? ` · and ${hits.length - 1} more` : '') : '';
}
/* his seasons on file, oldest first: Career their average, Peak the best of them and of now (the first to reach it), the line through them */
function sPeHist(St, p, sc) {
  const ks = Object.keys(p.seasons && typeof p.seasons === 'object' ? p.seasons : {}).filter(k => /^\d{4}$/.test(k) && sPeIsNum(p.seasons[k])).sort();
  let sum = 0, best = null;
  for (const k of ks) { sum += p.seasons[k]; if (best === null || p.seasons[k] > best[1]) best = [sPeSeason(+k), p.seasons[k]]; }
  if (best === null || p.v > best[1]) best = [sPeSeason(St.season), p.v];
  return { career: ks.length ? sc.elo(sum / ks.length) : null, line: ks.map(k => [sPeSeason(+k), sc.elo(p.seasons[k])]), peak: [sc.elo(best[1]), best[0]] };
}
/* a figure in goals a game: whole thousandths (the state writes three places), then hundredths, half away from zero; signed, zero plain */
const sPeHun = v => { const k = Math.round(Math.abs(v) * 1000), h = Math.floor((k + 5) / 10); return v < 0 && h ? -h : h; };
const sPeFig = v => { const h = sPeHun(v); return { t: (h > 0 ? '+' : h < 0 ? '−' : '') + (Math.abs(h) / 100).toFixed(2), c: h > 0 ? 'pe-up' : h < 0 ? 'pe-down' : 'pe-flat' }; };
const sPeExact = v => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(3)} goals a game`;
const sPeOrd = n => { const t = n % 100; return n + (t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th'); };
const sPeFold = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
/* the clubs by each unit: the figure, the order among the clubs that have it (best first; level, the key), the scale, and a club's
   place: one more than the clubs whose Elo in the unit is greater */
const PE_VAL = { str: t => t.strength, off: t => t.offence, def: t => t.defence, gk: t => t.goalie && typeof t.goalie === 'object' ? t.goalie.gk : null };
function sPeClubs(St) {
  const teams = (St.players && St.players.teams) || {}, U = {};
  for (const [k] of PE_UNITS_S) {
    const have = Object.keys(teams).filter(id => teams[id] && typeof teams[id] === 'object' && sPeIsNum(PE_VAL[k](teams[id]))).sort((a, b) => PE_VAL[k](teams[b]) - PE_VAL[k](teams[a]) || sTrCmp(a, b));
    const sc = sPeScale(have.map(id => PE_VAL[k](teams[id]))), rk = sPeRanks(have.map(id => sc.elo(PE_VAL[k](teams[id]))));
    U[k] = { have, sc, place: new Map(have.map((id, i) => [id, rk[i]])) };
  }
  return U;
}
/* a shield in a cell: the tier of the Elo shown, named for a screen reader, its gradient in the page once (Wood's is drawn flat).
   `memo` (a Map a table pass makes and drops) counts each gradient in the document once a pass: the count is the same for every row of
   one drawing, and a document-wide search a row was half this section's time */
function sPeShieldBad(d, cell, elo, memo) {
  const sh = cell.querySelector('svg.tierbadge'), tier = sPeTier(elo), box = cell.querySelector('.pe-shield');
  if (!sh || !box || cell.querySelectorAll('svg').length !== 1 || sh.parentElement !== box) return 'no shield';
  if (sh.getAttribute('aria-label') !== `${tier.name} tier` || sh.getAttribute('role') !== 'img' || txt(sh.querySelector('title')) !== tier.words) return `shield "${txt(sh.querySelector('title'))}", want ${tier.words}`;
  if (txt(box).replace(txt(sh.querySelector('title')), '').trim() !== tier.name) return `tier "${txt(box)}", want ${tier.name}`;
  const fills = [...sh.querySelectorAll('[fill^="url(#"]')].map(p => /#([\w-]+)\)/.exec(p.getAttribute('fill'))[1]), want = tier.name === 'Wood' ? [] : [tier.name === 'HOF' ? 'tg-hof-gem' : `tg-${tier.name.toLowerCase()}`];
  const count = f => { if (memo && memo.has(f)) return memo.get(f); const n = d.querySelectorAll(`[id="${f}"]`).length; if (memo) memo.set(f, n); return n; };
  return eqA(fills, want) && fills.every(f => count(f) === 1) ? '' : `shield filled ${fills.join(',') || 'flat'}, want ${want.join(',') || 'flat'}`;
}
/* the histogram of a list of Elos as shown: what is wrong with it, or nothing (`label` what they are, `one` one of them) */
function sPeCurveBad(w, root, elos, label, one) {
  const d = w.document, n = elos.length, bad = [];
  if (n < 5) return root.children.length || txt(root) ? [`a histogram of ${n} (none is drawn under five)`] : [];
  const cv = root.querySelectorAll('.pe-curve'), c = cv[0], svg = c && c.querySelector('.pe-cv-in > svg.pe-cv');
  if (cv.length !== 1 || root.children.length !== 1 || !svg) return ['no histogram'];
  const cnt = Array.from({ length: 12 }, () => 0);
  for (const e of elos) cnt[Math.floor((Math.min(1799, Math.max(1200, e)) - 1200) / 50)]++;
  const said = cnt.map((x, i) => x ? `${1200 + i * 50} ${x}` : '').filter(Boolean).join(', ');
  if (c.getAttribute('role') !== 'img' || c.getAttribute('aria-label') !== `${label} by rating: ${said}` || svg.getAttribute('aria-hidden') !== 'true') bad.push(`its label "${c.getAttribute('aria-label')}", want "${label} by rating: ${said}"`);
  const bins = [...svg.querySelectorAll('g.pe-cv-bin')], tops = [];
  if (bins.length !== 12) return bad.concat(`${bins.length} bins, want 12`);
  bins.forEach((g, i) => {
    const lo = 1200 + i * 50, tier = sPeTier(lo).name, bar = g.querySelectorAll('path.pe-cv-bar'), num = g.querySelectorAll('text');
    const range = i === 0 ? `under ${lo + 50}` : i === 11 ? `${lo} and up` : `${lo}–${lo + 49}`, tip = `<b>${tier}</b> · ${range}<br>${cnt[i]} ${cnt[i] === 1 ? one : label} (${Math.round(cnt[i] / n * 100)}%)`;
    if (g.dataset.lo !== String(lo) || g.dataset.n !== String(cnt[i])) bad.push(`bin ${lo} counts ${g.dataset.n}, want ${cnt[i]}`);
    if (g.dataset.tip !== tip) bad.push(`bin ${lo} says "${g.dataset.tip}", want "${tip}"`);
    if (!cnt[i]) { if (bar.length || num.length) bad.push(`bin ${lo} is empty and drawn`); tops.push(null); return; }
    const fill = tier === 'HOF' ? 'url(#tg-hof-gem)' : PE_HEX[tier], m = bar[0] && /^M[\d.]+ ([\d.]+)V[\d.]+Q[\d.]+ ([\d.]+) /.exec(bar[0].getAttribute('d'));
    if (bar.length !== 1 || !m || !(tier === 'HOF' ? bar[0].getAttribute('fill') === fill : sameHex(bar[0].getAttribute('fill'), fill))) { bad.push(`bin ${lo}: a bar filled ${bar[0] && bar[0].getAttribute('fill')}, want one in ${fill}`); tops.push(null); return; }
    if (num.length !== 1 || txt(num[0]) !== String(cnt[i]) || num[0].getAttribute('fill') !== 'var(--ink)') bad.push(`bin ${lo}: its count reads "${num.length ? txt(num[0]) : ''}", want ${cnt[i]} in --ink`);
    tops.push({ base: +m[1], y: +m[2], n: cnt[i] });
  });
  const drawn = tops.filter(Boolean);
  for (const a of drawn) for (const b of drawn) if (a.base !== b.base || !(a.y < a.base) || a.y < 0 || (a.n > b.n && a.y > b.y) || (a.n === b.n && a.y !== b.y)) { bad.push(`a bar of ${a.n} stands at ${a.y} beside one of ${b.n} at ${b.y} (base ${a.base})`); break; }
  /* the axis: the ten tiers in order and where each starts */
  const names = [...svg.querySelectorAll('text.pe-cv-tn')], marks = [...svg.querySelectorAll('text.pe-cv-tm')], order = ['Wood'].concat(PE_LADDER.map(x => x[0]).reverse());
  if (!eqA(names.map(txt), order) || !eqA(marks.map(txt), ['<1350'].concat(PE_LADDER.map(x => String(x[1])).reverse().slice(0, 8), ['1750+'])) || names.some(t => t.getAttribute('fill') !== 'var(--ink-2)') || marks.some(t => t.getAttribute('fill') !== 'var(--muted)'))
    bad.push(`the axis reads ${names.map(txt).join(' ')} / ${marks.map(txt).join(' ')}`);
  if ([...svg.querySelectorAll('text')].some(t => !(parseFloat(t.getAttribute('font-size')) >= 9.5))) bad.push('a word of the chart under 9.5px');
  /* the bell: dashed, in --ink-2, highest at 1500 (the middle of the box) and as tall there as a normal curve of n: n x 50 / (100 x root 2 pi),
     on the bars' own scale (a bar of k stands (base - y) high) */
  const bell = svg.querySelectorAll('path.pe-cv-bell'), W = parseFloat(svg.getAttribute('width')), pts = bell[0] ? [...bell[0].getAttribute('d').matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(m => [+m[1], +m[2]]) : [];
  if (bell.length !== 1 || bell[0].getAttribute('stroke') !== 'var(--ink-2)' || bell[0].getAttribute('fill') !== 'none' || !bell[0].getAttribute('stroke-dasharray') || pts.length !== 97) bad.push('no dashed bell curve in --ink-2');
  else {
    /* its top, read to the tenth of a pixel the path is written in: the middle of the points that share its least y */
    const topY = Math.min(...pts.map(q => q[1])), flat = pts.filter(q => q[1] === topY), peak = [(flat[0][0] + flat[flat.length - 1][0]) / 2, topY];
    const dens = n * 50 / (100 * Math.sqrt(2 * Math.PI)), ref = drawn.length ? drawn.reduce((a, b) => b.n > a.n ? b : a) : null;
    if (Math.abs(peak[0] - W / 2) > 0.15) bad.push(`the bell peaks at x ${peak[0]} of ${W}`);
    if (ref) { const want = ref.base - (ref.base - ref.y) / ref.n * dens; if (Math.abs(peak[1] - want) > 0.2 + 0.1 * dens / ref.n) bad.push(`the bell stands at ${peak[1]}, want ${want.toFixed(1)} for ${n}`); }
  }
  if (svg.getAttribute('viewBox') !== `0 0 ${W} 200` || !(W >= 520 && W <= 680)) bad.push(`drawn ${svg.getAttribute('width')} wide on ${svg.getAttribute('viewBox')}`);
  const key = [...c.querySelectorAll('.pe-cv-key > span')];
  if (!eqA(key.map(txt), [`${n} ranked ${label}`, 'bell curve'])) bad.push(`the legend reads "${key.map(txt).join(' | ')}", want "${n} ranked ${label} | bell curve"`);
  /* the pointer on a bin: its words over it; off it, gone */
  const tip = c.querySelector('.pe-cv-in > .pe-cv-tip'), g0 = bins[cnt.findIndex(x => x > 0)];
  if (!tip || tip.classList.contains('on')) bad.push('no tip, or one showing before the pointer');
  else { g0.dispatchEvent(new w.MouseEvent('mouseenter')); const on = tip.classList.contains('on') && tip.innerHTML === g0.dataset.tip; g0.dispatchEvent(new w.MouseEvent('mouseleave'));
    if (!on || tip.classList.contains('on')) bad.push(`the pointer on a bin shows "${tip.innerHTML}", want its words, gone when it leaves`); }
  if (d.querySelectorAll('#peDefs').length !== 1) bad.push('the gradients are not in the page once');
  return bad;
}
async function holdElo(St, ms, tag, opts = {}) {
  const errs = [], w = await boot(ms, errs, Object.assign({ state: JSON.stringify(St) }, opts.hash ? { hash: opts.hash } : {}, opts.store ? { store: opts.store } : {})), d = w.document;
  const sec = d.getElementById('tab-players'), ck = (ok, msg) => chk(ok, `${tag}: ${msg}`), el = id => d.getElementById(id), onB = d.querySelector('#tabs button.on');
  ck(!!sec && !sec.hidden && w.location.hash === '#players' && !!onB && onB.dataset.tab === 'players' && txt(onB) === 'ELO Ratings' && onB.getAttribute('aria-current') === 'page', `${opts.how || '#players'} opens ELO Ratings, the address #players (${w.location.hash}; ${txt(onB)})`);
  if (!sec) { w.close(); return null; }
  { const tabs = [...d.querySelectorAll('#tabs button')].map(b => b.dataset.tab), i = tabs.indexOf('players');
    ck(tabs.filter(t => t === 'players').length === 1 && tabs[i - 1] === 'ratings' && tabs[i + 1] === 'pickem' && !tabs.includes('elo'), `one ELO Ratings button, after Team Rankings and before the Pick'em Record, as the NFL's (${tabs.join(' ')})`); }
  /* the stamp over one card, and in the card nothing but the heading and its pill, the search, the seven pills, the histogram, the table
     and the one line that can stand in the table's place: no description, select or link */
  const card = el('peCard'), pos = el('pePos'), inp = el('peSearch'), none = el('peNone'), boxT = el('peBox'), tb = el('peTable'), cur = el('peCurve'), h2 = sec.querySelector('h2');
  ck(eqA([...sec.children].map(c => `${c.tagName.toLowerCase()}${c.id ? '#' + c.id : ''}.${c.className}`), ['div.bar', 'div#peCard.card pe-wrap']) && !!card && !!pos && !!inp && !!none && !!boxT && !!tb && !!cur && sec.querySelectorAll('h2, h3').length === 1
    && !sec.querySelector('select, a, details, .note, .intro, .seg') && [...sec.querySelectorAll('p')].every(p => p === none) && sec.querySelectorAll('input').length === 1 && sec.querySelectorAll('table').length === 1 && [...sec.querySelectorAll('button')].every(b => b.parentElement === pos || b.parentElement.parentElement === pos),
    `the tab is its stamp and one card: the heading, one search box, the pills, the histogram and one table; no description, select or link (${[...sec.children].map(c => c.id || c.className).join(', ')}; ${sec.querySelectorAll('input').length} inputs, ${sec.querySelectorAll('table').length} tables, ${sec.querySelectorAll('p').length} paragraphs)`);
  if (!card || !pos || !inp || !none || !boxT || !tb || !cur || !h2) { ck(!errs.length, 'no runtime error: ' + errs.join(' | ')); w.close(); return null; }
  const lead = [...h2.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join(' ').replace(/\s+/g, ' ').trim(), pill = el('pePill'), stamp = el('peStamp'), PL = St.players;
  const btns = [...pos.querySelectorAll('button')], unitBox = pos.querySelector('.pe-units'), tall = x => w.getComputedStyle(x).minHeight === '44px';
  ck(eqA(btns.map(b => [b.dataset.view, txt(b)]), PE_VIEWS.map(v => [v[0], v[1]]).concat(PE_UNITS_S)) && btns.every(b => b.type === 'button' && b.hasAttribute('aria-pressed')) && !!unitBox && eqA([...unitBox.children].map(c => c.tagName), ['SPAN', 'BUTTON', 'BUTTON', 'BUTTON', 'BUTTON']) && txt(unitBox.querySelector('.pe-ulab')) === 'Clubs'
    && btns.slice(3).every(b => b.parentElement === unitBox && b.classList.contains('pe-unitpill')) && btns.slice(0, 3).every(b => b.parentElement === pos && !b.classList.contains('pe-unitpill')) && pos.getAttribute('role') === 'group' && !!pos.getAttribute('aria-label'),
    `the pills: Forwards, Defencemen, Goalies, then the clubs' four under their label, Overall, Attack, Defence, Goaltending (${btns.map(txt).join(' | ')}; label "${txt(unitBox && unitBox.querySelector('.pe-ulab'))}")`);
  ck(btns.length === 7 && btns.every(tall) && tall(inp) && inp.type === 'search' && inp.getAttribute('aria-label') === 'Search a name' && inp.getAttribute('placeholder') === 'Search a name' && inp.parentElement === h2.parentElement, `every pill and the search box are 44px tall, the search named and in the card's head (${btns.filter(b => !tall(b)).map(txt).join(', ') || 'all'})`);
  const stored = () => { const s = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}'); return s.ui || {}; }, pressed = () => btns.filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.dataset.view);
  const shows = x => { for (let q = x; q && q !== d.body; q = q.parentElement) if (q.hidden) return false; return true; };
  /* no player model: the heading and one line; no pill pressed or showing, no search, no histogram, no table, no stamp */
  if (!PL) {
    ck(lead === 'Rankings' && pill.hidden && !txt(stamp) && pos.hidden && inp.hidden && !shows(btns[0]) && boxT.hidden && !tb.rows.length && !cur.children.length && !none.hidden && txt(none) === 'No player model yet.' && !sec.querySelector('svg'),
      `with no player model the card is its heading and "No player model yet.": no pills, search, histogram, table or stamp (${lead}; "${txt(none)}"; pills ${pos.hidden ? 'hidden' : 'showing'}; ${tb.rows.length} rows; pressed ${pressed().join(',') || 'none'})`);
    ck(!errs.length, 'no runtime error: ' + errs.join(' | ')); w.close(); return { none: true };
  }
  /* the heading, its pill (the season and the last day rated) and the stamp (when the ratings were made, in the visitor's clock) */
  const made = Date.parse(PL.generated), wantStamp = isFinite(made) ? 'rated ' + new Date(made).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }) : '';
  const wantPill = sPeSeason(St.season) + (/^\d{4}-\d{2}-\d{2}$/.test(String(PL.asOf)) ? ' through ' + sTrWords(PL.asOf) : '');
  ck(lead === 'Rankings' && h2.querySelectorAll('.pill').length === 1 && !pill.hidden && txt(pill) === wantPill && txt(stamp) === wantStamp && stamp.classList.contains('livestamp') && !!stamp.closest('.bar') && !stamp.closest('.card') && !pos.hidden,
    `the heading is "Rankings", its pill "${wantPill}", and the stamp over the card "${wantStamp}" (${lead}; "${txt(pill)}"; "${txt(stamp)}")`);
  const MAPP = pageMap(w), r0 = w.__requests.length, w0 = w.__writes.length, st0 = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}');
  const settle = async n => { for (let i = 0; i < 400 && tb.querySelectorAll('tbody tr').length < n; i++) await wait(20); await wait(40); };
  const trs = () => [...tb.querySelectorAll('tbody tr')], heads = () => [...tb.querySelectorAll('thead th')];
  const out = { groups: {}, clubs: {} };
  /* the view it opens on: the pill kept (the Players tab's Skaters and Goalies read as Forwards and Goalies), else Forwards */
  { const want = opts.view0 || 'F';
    ck(eqA(pressed(), [want]), `it opens on ${want}${opts.kept !== undefined ? `, with ${JSON.stringify(opts.kept)} kept` : ''} (${pressed().join(',')})`); }
  /* ---- a group of players ---- */
  const holdGroup = async ([view, , many, one]) => {
    const { rows, sc } = sPeRows(St, view), goalie = view === 'G', HEAD = goalie ? PE_HEAD.G : PE_HEAD.F, b = btns.find(x => x.dataset.view === view);
    inp.value = ''; b.click();
    const first = trs().length;
    await settle(rows.length);
    ck(eqA(pressed(), [view]) && stored().plKind === view && !inp.hidden && boxT.classList.contains('scroll') && !boxT.classList.contains('wrap'), `${many}: its pill alone is pressed, the choice kept (ui.plKind ${stored().plKind}), the search showing, the table in its scrolling box (${pressed().join(',')})`);
    /* the histogram of the ranked, whatever the search shows */
    const cb = sPeCurveBad(w, cur, rows.map(x => x.elo), many, one);
    ck(!cb.length, `${many}: the histogram by this file's own counts: twelve bins, each bar in its tier's colour and taller for more, the axis, the bell curve of ${rows.length}, the legend, the label, a bin's words under the pointer (${cb.slice(0, 3).join(' | ')})`);
    if (!rows.length) { ck(boxT.hidden && !tb.rows.length && !none.hidden && txt(none) === `No ${many} ranked yet.`, `${many}: nobody ranked, said in one line, no table ("${txt(none)}")`); out.groups[view] = { rows, sc }; return; }
    ck(none.hidden && !boxT.hidden && eqA(heads().map(txt), HEAD) && trs().length === rows.length && trs().every(r => r.cells.length === HEAD.length) && first === Math.min(60, rows.length),
      `${many}: one table, its head ${HEAD.join(' · ')}, a row a ranked ${one}, the first sixty drawn at once and the rest after (${heads().map(txt).join(' · ')}; ${trs().length} rows of ${rows.length}; ${first} at once)`);
    ck(eqA(heads().map(th => th.getAttribute('title') || ''), sPeTitles(St, view)), `${many}: each heading says what it is on its title, word for word, who is ranked on the Player's (${heads().map(th => th.getAttribute('title') || '').filter((t, i) => t !== sPeTitles(St, view)[i]).slice(0, 2).join(' | ')})`);
    if (trs().length !== rows.length || !trs().every(r => r.cells.length === HEAD.length)) { out.groups[view] = { rows, sc }; return; }
    const bad = [], T = trs(), gradMemo = new Map();
    rows.forEach((x, i) => {
      const c = T[i].cells, p = x.p, miss = m => bad.push(`row ${i + 1} ${p.name}: ${m}`), h = sPeHist(St, p, sc), k = goalie ? 6 : 8;
      if (txt(c[0]) !== String(x.rank)) miss(`rank "${txt(c[0])}", want ${x.rank}`);
      /* the name, his mark where a report names him, and the small line; the one held cell */
      /* the club he is shown at: the report's that names him (Frederik Andersen on Edmonton's injured reserve, his last game Carolina's), else his last game's */
      const nm = c[1].querySelector('b'), mk = c[1].querySelectorAll('.pe-q'), sm = c[1].querySelector('small'), club = St.teams[x.club], ab = club ? club.abbr : x.club;
      if (!nm || txt(nm) !== String(p.name) || !sm || txt(sm) !== `${p.pos} · ${ab} · ${p.gp} game${p.gp === 1 ? '' : 's'} rated`) miss(`"${txt(nm)}" / "${txt(sm)}", want ${p.name} / ${p.pos} · ${ab} · ${p.gp} games rated`);
      if (!c[1].classList.contains('sk') || [...c].filter(q => q.classList.contains('sk')).length !== 1) miss('the player is not the one held cell');
      if (!x.mark) { if (mk.length) miss(`a mark "${txt(mk[0])}" on a player no report names`); }
      else { const word = x.mark.k === 'dtd' ? 'DTD' : /injured reserve/i.test(x.mark.w) ? 'IR' : /suspen/i.test(x.mark.w) ? 'SUSP' : 'OUT', cls = x.mark.k === 'dtd' ? 'warn' : 'bad';
        if (mk.length !== 1 || txt(mk[0]) !== word || mk[0].getAttribute('title') !== x.mark.w || !mk[0].classList.contains('pill') || !mk[0].classList.contains(cls) || mk[0].classList.contains(cls === 'bad' ? 'warn' : 'bad')) miss(`mark "${mk.length ? txt(mk[0]) : ''}" (${mk.length ? mk[0].getAttribute('title') : ''}), want ${word} "${x.mark.w}"`); }
      /* his club: its tag alone, its name kept beside it for a screen reader */
      const tg = c[2].querySelector('.ttag'), tw = c[2].querySelector('.tw');
      if (!tg || !tw || tg.parentElement !== tw || txt(tg) !== ab || !tg.classList.contains('mini') || tg.getAttribute('aria-hidden') !== 'true' || txt(tw.querySelector('.tn')) !== (club ? club.short : x.club) || (MAPP[x.club] && tagWrong(tg, MAPP[x.club]))) miss(`club "${txt(c[2])}", want the tag ${ab}${x.club !== p.team ? ` (his report's club, not ${p.team})` : ''}`);
      /* the Elo, the figure it is set from on its title, and the shield of its tier */
      const eb = c[3].querySelector('.pe-elo');
      if (!eb || txt(c[3]) !== String(x.elo) || eb.getAttribute('title') !== sPeExact(p.v)) miss(`Elo "${txt(c[3])}" (${eb && eb.getAttribute('title')}), want ${x.elo} (${sPeExact(p.v)})`);
      const sb = sPeShieldBad(d, c[4], x.elo, gradMemo); if (sb) miss(sb);
      /* the figures in goals a game, signed and coloured by the sign shown */
      (goalie ? [p.v] : [p.v, p.o, p.d]).forEach((v, j) => { const f = sPeFig(v), cell = c[5 + j], sp = cell.querySelector('span');
        if (txt(cell) !== f.t || !sp || !sp.classList.contains(f.c) || ['pe-up', 'pe-down', 'pe-flat'].filter(q => sp.classList.contains(q)).length !== 1) miss(`${HEAD[5 + j]} "${txt(cell)}" (${sp && sp.className}), want ${f.t} ${f.c}`); });
      /* Career, Trend, Peak */
      if (txt(c[k]) !== (h.career === null ? '–' : String(h.career))) miss(`Career "${txt(c[k])}", want ${h.career === null ? '–' : h.career}`);
      const line = h.line.concat([['now', x.elo]]), sp = c[k + 1].querySelectorAll('svg.pe-spark'), said = line.map(l => `${l[0]} ${l[1]}`).join(', ');
      if (c[k + 1].getAttribute('title') !== said) miss(`Trend says "${c[k + 1].getAttribute('title')}", want "${said}"`);
      if (line.length < 2) { if (sp.length || txt(c[k + 1]) !== '–') miss(`a trend line through one point ("${txt(c[k + 1])}")`); }
      else { const path = sp[0] && sp[0].querySelector('path'), pts = path ? [...path.getAttribute('d').matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map(m => [+m[1], +m[2]]) : [], vs = line.map(l => l[1]), up = vs[vs.length - 1] >= vs[0];
        if (sp.length !== 1 || txt(c[k + 1]) || sp[0].getAttribute('aria-hidden') !== 'true' || pts.length !== vs.length || path.getAttribute('stroke') !== (up ? 'var(--pick)' : 'var(--miss)') || path.getAttribute('fill') !== 'none'
          || pts.some((q, a) => pts.some((r, e) => (a < e && !(q[0] < r[0])) || (vs[a] > vs[e] && q[1] > r[1]) || (vs[a] === vs[e] && q[1] !== r[1])))) miss(`the trend line: ${pts.length} points ${path ? path.getAttribute('stroke') : ''}, want ${vs.length} through ${vs.join(' ')} in ${up ? '--pick' : '--miss'}`); }
      const ps = c[k + 2].querySelector('small');
      if (txt(c[k + 2]) !== `${h.peak[0]} · ${h.peak[1]}` || !ps || txt(ps) !== `· ${h.peak[1]}`) miss(`Peak "${txt(c[k + 2])}", want ${h.peak[0]} · ${h.peak[1]}`);
    });
    ck(!bad.length, `${many}: every row by this file's own sums: who is ranked and in what order, the rank shared on a level Elo, the name, mark and small line, the tag of the club that has him, the Elo on the group's mean and spread (${sc.m.toFixed(4)}, ${sc.sd.toFixed(4)}) and its tier's shield, the figures in goals a game, Career, Trend and Peak (${bad.length} wrong: ${bad.slice(0, 4).join(' | ')})`);
    out.groups[view] = { rows, sc };
  };
  /* ---- the clubs by a unit ---- */
  const holdUnit = async ([view, name], U) => {
    const teams = PL.teams || {}, u = U[view], order = u.have.concat(Object.keys(teams).filter(id => !u.place.has(id)).sort(sTrCmp)), b = btns.find(x => x.dataset.view === view);
    b.click(); await wait(30);
    ck(eqA(pressed(), [view]) && stored().plKind === view && inp.hidden && w.getComputedStyle(inp).display === 'none' && boxT.classList.contains('wrap') && !boxT.classList.contains('scroll'), `${name}: its pill alone is pressed, the choice kept (ui.plKind ${stored().plKind}), no search over 32 clubs, the table in its sideways wrapper (${pressed().join(',')})`);
    const cb = sPeCurveBad(w, cur, u.have.map(id => u.sc.elo(PE_VAL[view](teams[id]))), 'clubs', 'club');
    ck(!cb.length, `${name}: the histogram of the clubs' Elos by this file's own counts (${cb.slice(0, 3).join(' | ')})`);
    if (!order.length) { ck(boxT.hidden && !none.hidden && txt(none) === 'No club rated yet.', `${name}: no club, said in one line ("${txt(none)}")`); return; }
    const T = trs();
    ck(none.hidden && !boxT.hidden && eqA(heads().map(txt), PE_HEAD.U) && T.length === order.length && T.every(r => r.cells.length === PE_HEAD.U.length), `${name}: one table, its head ${PE_HEAD.U.join(' · ')}, a row a club (${heads().map(txt).join(' · ')}; ${T.length} rows of ${order.length})`);
    ck(eqA(heads().map(th => th.getAttribute('title') || ''), sPeTitles(St, view)), `${name}: each heading says what it is on its title, the Rating's which unit it is (${heads().map(th => th.getAttribute('title') || '').filter((t, i) => t !== sPeTitles(St, view)[i]).slice(0, 2).join(' | ')})`);
    if (T.length !== order.length || !T.every(r => r.cells.length === PE_HEAD.U.length)) return;
    const bad = [], gradMemo = new Map();
    order.forEach((id, i) => {
      const c = T[i].cells, t = teams[id] && typeof teams[id] === 'object' ? teams[id] : {}, club = St.teams[id], v = PE_VAL[view](t), ok = sPeIsNum(v), miss = m => bad.push(`row ${i + 1} ${id}: ${m}`);
      if (txt(c[0]) !== (ok ? String(u.place.get(id)) : '–')) miss(`rank "${txt(c[0])}", want ${ok ? u.place.get(id) : '–'}`);
      const tg = c[1].querySelector('.ttag'), tw = c[1].querySelector('.tw'), sm = c[1].querySelector('small');
      if (!tg || !tw || tg.parentElement !== tw || txt(tg) !== (club ? club.abbr : id) || !tg.classList.contains('mini') || tg.getAttribute('aria-hidden') !== 'true' || txt(tw.querySelector('.tn')) !== (club ? club.short : id) || (MAPP[id] && tagWrong(tg, MAPP[id]))) miss(`club "${txt(c[1])}", want the tag ${club ? club.abbr : id}`);
      if (!c[1].classList.contains('sk') || [...c].filter(q => q.classList.contains('sk')).length !== 1) miss('the club is not the one held cell');
      if (club && sPeIsNum(club.gp) ? txt(sm) !== `${club.gp} game${club.gp === 1 ? '' : 's'}` : !!sm) miss(`games "${txt(sm)}", want ${club && club.gp}`);
      if (txt(c[2]) !== (club && sPeIsNum(club.w) ? `${club.w}-${club.l}-${club.otl}` : '–')) miss(`record "${txt(c[2])}"`);
      if (!ok) { if (txt(c[3]) !== '–' || txt(c[4]) !== '–' || c[4].querySelector('svg')) miss(`a rating "${txt(c[3])}" and tier "${txt(c[4])}" on a club with no figure`); }
      else { const elo = u.sc.elo(v), eb = c[3].querySelector('.pe-elo');
        if (!eb || txt(c[3]) !== String(elo) || eb.getAttribute('title') !== sPeExact(v)) miss(`rating "${txt(c[3])}" (${eb && eb.getAttribute('title')}), want ${elo} (${sPeExact(v)})`);
        const sb = sPeShieldBad(d, c[4], elo, gradMemo); if (sb) miss(sb); }
      /* its four figures, each with its place among the clubs that have one: the top eight lime, the bottom eight rose */
      PE_UNITS_S.forEach(([k2], j) => { const cell = c[5 + j], x = PE_VAL[k2](t), n2 = U[k2].have.length, pl = U[k2].place.get(id);
        if (!sPeIsNum(x)) { if (txt(cell) !== '–' || cell.querySelector('small')) miss(`${PE_HEAD.U[5 + j]} "${txt(cell)}" on a club with none`); return; }
        const sv = cell.querySelector('.pe-sv'), od = cell.querySelector('small.pe-ord'), cls = pl <= 8 ? 'top' : pl > n2 - 8 ? 'bot' : '';
        if (!sv || !od || txt(sv) !== sPeFig(x).t || txt(od) !== sPeOrd(pl) || txt(cell) !== sPeFig(x).t + sPeOrd(pl) && txt(cell) !== `${sPeFig(x).t} ${sPeOrd(pl)}` || od.classList.contains('top') !== (cls === 'top') || od.classList.contains('bot') !== (cls === 'bot') || cell.getAttribute('title') !== sPeExact(x))
          miss(`${PE_HEAD.U[5 + j]} "${txt(cell)}" (${od && od.className}; ${cell.getAttribute('title')}), want ${sPeFig(x).t} ${sPeOrd(pl)} ${cls}`); });
      const g = t.goalie && typeof t.goalie === 'object' ? t.goalie : null;
      if (txt(c[9]) !== (g ? String(g.name) : '–') || (g && g.how ? c[9].getAttribute('title') !== String(g.how) : c[9].hasAttribute('title'))) miss(`in goal "${txt(c[9])}" (${c[9].getAttribute('title')}), want ${g ? g.name : '–'} (${g ? g.how : ''})`);
    });
    ck(!bad.length, `${name}: every row by this file's own sums: the order and the rank, the club's tag and games, its record, its Elo among the ${u.have.length} clubs that have the figure (mean ${u.sc.m.toFixed(4)}, spread ${u.sc.sd.toFixed(4)}) and its tier's shield, its four figures with their places, the goalie in net and how he was chosen (${bad.length} wrong: ${bad.slice(0, 4).join(' | ')})`);
    out.clubs[view] = { order, n: u.have.length };
  };
  for (const g of PE_VIEWS) await holdGroup(g);
  const U = sPeClubs(St);
  for (const u of PE_UNITS_S) await holdUnit(u, U);
  /* ---- the search, on a group with two ranked or more (one with an accented name among them first): drawn a fifth of a second after
     the typing stops, the ranks kept, never stored ---- */
  { const accented = x => sPeFold(x.p.name) !== String(x.p.name).toLowerCase().trim(), two = x => out.groups[x[0]] && out.groups[x[0]].rows.length >= 2;
    const g = PE_VIEWS.find(x => two(x) && out.groups[x[0]].rows.some(accented)) || PE_VIEWS.find(two);
    if (g) {
      const rows = out.groups[g[0]].rows; btns.find(x => x.dataset.view === g[0]).click(); await settle(rows.length);
      const type = v => { inp.value = v; inp.dispatchEvent(new w.Event('input', { bubbles: true })); };
      /* a piece of a name, typed in capitals (where capitals read back the same) between spaces: the accented word of the first ranked
         player who has one, typed without its accents, else the last four letters of the last-ranked player's name */
      const pk = rows.find(accented) || rows[rows.length - 1], nameF = sPeFold(pk.p.name), fw = nameF.split(/\s+/), lw = String(pk.p.name).toLowerCase().trim().split(/\s+/), wi = fw.findIndex((x, i) => x !== lw[i]);
      /* what a search for `typed` shows in the pressed group, by this file's own rule: the rows whose name holds it, whatever its case
         or accents, and, where it is a club's abbreviation whole, that club's ranked players of the group; with no such row, where the
         name's player is (sPeWhere), else that nobody matches */
      const NOBODY = /^No (forward|defenceman|goalie) matches “/;
      const expect = typed => { const q = sPeFold(typed), clubQ = q ? Object.keys(St.teams).find(id => sPeFold(St.teams[id].abbr) === q) : null, hit = q ? rows.filter(x => sPeFold(x.p.name).includes(q) || (clubQ && x.club === clubQ)) : rows;
        return { hit, clubQ, say: hit.length ? '' : sPeWhere(St, q, g[0]) || `No ${g[3]} matches “${typed.trim()}”.` }; };
      const shown = async typed => { type(typed); await wait(300); const e = expect(typed); await settle(e.hit.length); const got = trs().map(r => [txt(r.cells[0]), txt(r.cells[1].querySelector('b'))]);
        return { e, got, ok: e.hit.length ? none.hidden && !boxT.hidden && eqA(got, e.hit.map(x => [String(x.rank), String(x.p.name)])) : boxT.hidden && !got.length && !none.hidden && txt(none) === e.say && e.say.length <= 90 }; };
      const piece = wi >= 0 ? fw[wi] : nameF.slice(Math.max(0, nameF.length - 4)), typedQ = sPeFold(piece.toUpperCase()) === piece ? piece.toUpperCase() : piece, want = expect(`  ${typedQ} `).hit;
      const sBefore = w.localStorage.getItem('nhl_v1'), rq = w.__requests.length, wr = w.__writes.length, n0 = trs().length, html0 = cur.innerHTML;
      type(`  ${typedQ} `);
      const still = trs().length === n0;
      await wait(120); const mid = trs().length === n0 || rows.length === want.length;
      await wait(160); await settle(want.length);
      const got = trs().map(r => [txt(r.cells[0]), txt(r.cells[1].querySelector('b'))]);
      ck(still && mid && want.length >= 1 && eqA(got, want.map(x => [String(x.rank), String(x.p.name)])) && cur.innerHTML === html0, `the search "${typedQ}" (from ${pk.p.name}) draws once the typing has stopped a fifth of a second, the ${want.length} ${want.length === 1 ? g[3] : g[2]} it finds whatever its case or accents, each on his rank in the group, the histogram still the group's (${got.length} rows; ${got.slice(0, 3).map(x => x.join(' ')).join(', ')}; at once ${still}, at 120ms ${mid})`);
      { const r = await shown('zzqqzz'); ck(r.ok && cur.innerHTML === html0, `a name nobody has: one line in the table's place ("${txt(none)}", want "${r.e.say}")`); }
      /* a club's abbreviation typed whole lists the club's ranked players of the group (with whoever's name holds those letters); the
         club is the top-ranked player's, so the list is never empty */
      { const cl = rows[0].club, ab = St.teams[cl] && St.teams[cl].abbr;
        if (ab) { const r = await shown(String(ab).toLowerCase()), own = rows.filter(x => x.club === cl);
          ck(r.ok && r.e.clubQ === cl && own.length >= 1 && own.every(x => r.got.some(y => y[1] === String(x.p.name))), `"${String(ab).toLowerCase()}" lists ${St.teams[cl].short}' ${own.length} ranked ${g[2]}, each on his rank, with any name that holds the letters (${r.got.length} rows; ${r.got.slice(0, 3).map(x => x.join(' ')).join(', ')})`); } }
      /* a name with no row in the pressed group says where its player is, in one short line: a ranked player of another group (the
         group to press), and a rated player who is not ranked (under the floor, or no game this season) */
      { const other = PE_VIEWS.filter(x => x[0] !== g[0]).map(x => out.groups[x[0]] && out.groups[x[0]].rows[0]).find(Boolean);
        if (other) { const r = await shown(String(other.p.name).toUpperCase()), og = PE_VIEWS.find(x => x[0] === sPeGroup(other.p.pos));
          ck(r.ok && (r.e.hit.length > 0 || r.e.say.startsWith(`${other.p.name} · ${og[3]} · press ${og[1]}`) || !NOBODY.test(r.e.say)), `"${other.p.name}" typed on ${g[1]}: his rows, or where he is ("${txt(none)}", want "${r.e.say}")`); }
        const P2 = PL.players || {}, rankedIds = new Set(PE_VIEWS.flatMap(x => (out.groups[x[0]] ? out.groups[x[0]].rows : []).map(y => y.id)));
        const lost = Object.keys(P2).filter(id => P2[id] && typeof P2[id] === 'object' && typeof P2[id].name === 'string' && P2[id].name.trim() && !rankedIds.has(id));
        const low = lost.find(id => !(P2[id].gp >= PE_FLOOR_S[sPeGroup(P2[id].pos)])), idle = lost.find(id => P2[id].gp >= PE_FLOOR_S[sPeGroup(P2[id].pos)]);
        for (const [id, why] of [[low, 'under the floor'], [idle, 'not ranked']]) { if (!id) continue;
          const r = await shown(P2[id].name);
          ck(r.ok && (r.e.hit.length > 0 || !NOBODY.test(r.e.say)), `"${P2[id].name}" (${P2[id].gp} games, ${why}) typed on ${g[1]}: a row of that name, or where its player is ("${txt(none)}", want "${r.e.say}")`); } }
      type(''); await wait(300); await settle(rows.length);
      ck(trs().length === rows.length && none.hidden && !boxT.hidden, `the box cleared, every ranked ${g[3]} is back (${trs().length} of ${rows.length})`);
      ck(w.localStorage.getItem('nhl_v1') === sBefore && w.__requests.length === rq && w.__writes.length === wr, `a search stores nothing and asks the network for nothing (${w.__writes.length - wr} writes, ${w.__requests.length - rq} requests)`);
    } }
  /* ---- two pills pressed one after the other with no pause: the second's table alone, never the first's long tail under it (a draw
     that is not the latest stops) ---- */
  { const big = PE_VIEWS.filter(x => out.groups[x[0]]).sort((a, b) => out.groups[b[0]].rows.length - out.groups[a[0]].rows.length)[0], next = big && PE_VIEWS.find(x => x[0] !== big[0] && out.groups[x[0]] && out.groups[x[0]].rows.length);
    if (big && next && out.groups[big[0]].rows.length) {
      const R2 = out.groups[next[0]].rows, H2 = next[0] === 'G' ? PE_HEAD.G : PE_HEAD.F; inp.value = '';
      btns.find(x => x.dataset.view === big[0]).click(); btns.find(x => x.dataset.view === next[0]).click();
      await settle(R2.length); await wait(400);
      const T2 = trs();
      ck(eqA(pressed(), [next[0]]) && eqA(heads().map(txt), H2) && T2.length === R2.length && T2.every(r => r.cells.length === H2.length) && eqA(T2.map(r => txt(r.cells[1].querySelector('b'))), R2.map(x => String(x.p.name))),
        `${big[1]} then ${next[1]} pressed at once: the ${R2.length} ${next[2]} alone under their own head, none of the ${out.groups[big[0]].rows.length} ${big[2]}' tail (${T2.length} rows; ${T2.filter(r => r.cells.length !== H2.length).length} of another shape)`);
    } }
  /* ---- the histogram at its box's width: 520px the least (a narrower box scrolls it), 680 the most, drawn again on a resize ---- */
  { const g = PE_VIEWS.find(x => out.groups[x[0]] && out.groups[x[0]].rows.length >= 5) || null, uv = !g && U.str.have.length >= 5;
    if (g || uv) {
      btns.find(x => x.dataset.view === (g ? g[0] : 'str')).click(); await wait(30);
      let CW = 0, VIEW = 0, SL = 0; Object.defineProperty(w.HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return this.id === 'peCurve' ? CW : this.classList.contains('pe-curve') ? VIEW : 0; } });
      const wide = async cw => { CW = cw; w.dispatchEvent(new w.Event('resize')); await wait(220); const s = cur.querySelector('svg.pe-cv'); return s ? `${s.getAttribute('width')}|${s.getAttribute('viewBox')}|${s.querySelectorAll('g.pe-cv-bin').length}` : 'none'; };
      const a = await wide(300), b2 = await wide(601), c2 = await wide(1150);
      ck(a === '520|0 0 520 200|12' && b2 === '601|0 0 601 200|12' && c2 === '680|0 0 680 200|12', `the histogram is drawn at its box's own width, 520px the least and 680 the most, again on a resize (${a}; ${b2}; ${c2})`);
      const cv = cur.querySelector('.pe-curve'), inn = cur.querySelector('.pe-cv-in'), tip = cur.querySelector('.pe-cv-tip');
      ck(/^(auto|scroll)$/.test(w.getComputedStyle(cv).overflowX) && w.getComputedStyle(inn).minWidth === '520px' && w.getComputedStyle(cv).maxWidth === '680px' && w.getComputedStyle(tip).position === 'absolute' && w.getComputedStyle(inn).position === 'relative',
        `a box narrower than 520px scrolls the histogram sideways inside the card, its tip set against its own box (overflow-x ${w.getComputedStyle(cv).overflowX}, min ${w.getComputedStyle(inn).minWidth}, max ${w.getComputedStyle(cv).maxWidth})`);
      /* a bin's tip stays inside what shows of the chart: centred over its bar, but never nearer an edge of the showing part than half
         its own width (unheld, the first bin's was cut at the card's left and the last's gave the chart a sideways scroll of its own).
         jsdom lays nothing out, so on a made-up layout: the chart as wide as it is drawn, 400px of it showing, a tip 150px wide */
      { const HP = w.HTMLElement.prototype, EP = w.Element.prototype, rect0 = EP.getBoundingClientRect, Wd = Number(cur.querySelector('svg.pe-cv').getAttribute('width')), bins = [...cur.querySelectorAll('g.pe-cv-bin')];
        EP.getBoundingClientRect = function () { const wd = this.classList.contains('pe-cv') ? Number(this.getAttribute('width')) : 0; return { left: 0, top: 0, right: wd, bottom: 0, width: wd, height: 0, x: 0, y: 0 }; };
        Object.defineProperty(HP, 'offsetWidth', { configurable: true, get() { return this.classList.contains('pe-cv-tip') ? 150 : 0; } });
        Object.defineProperty(HP, 'scrollLeft', { configurable: true, get() { return this.classList.contains('pe-curve') ? SL : 0; }, set() {} });
        VIEW = 400; const at = (i, sl) => { SL = sl; bins[i].dispatchEvent(new w.MouseEvent('mouseenter')); const x = parseFloat(tip.style.left); bins[i].dispatchEvent(new w.MouseEvent('mouseleave')); return x; };
        const mid = i => (i + 0.5) * Wd / 12, near = (a, b) => Math.abs(a - b) <= 0.3;
        const got = [at(0, 0), at(11, 0), at(5, 0), at(0, 200), at(11, 200), at(7, 200)], want = [75, 325, mid(5), 275, 525, mid(7)];
        ck(bins.length === 12 && mid(5) > 75 && mid(5) < 325 && mid(7) > 275 && mid(7) < 525 && got.every((x, i) => near(x, want[i])), `a bin's tip is centred over its bar and held inside what shows of the chart, at either end and scrolled (at ${got.map(x => Math.round(x)).join(', ')}; want ${want.map(x => Math.round(x)).join(', ')})`);
        EP.getBoundingClientRect = rect0; delete HP.offsetWidth; delete HP.scrollLeft; VIEW = 0; }
      delete w.HTMLElement.prototype.clientWidth;
    } }
  /* ---- nothing stored but the pill and the tab's name, nothing fetched; another tab and back draws the same table ---- */
  { btns[0].click(); await settle(out.groups.F ? out.groups.F.rows.length : 0);
    const html0 = tb.outerHTML; d.querySelector('#tabs button[data-tab="pickem"]').click(); d.querySelector('#tabs button[data-tab="players"]').click(); await settle(out.groups.F ? out.groups.F.rows.length : 0);
    const st1 = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}'), wr = w.__writes.slice(w0), kind = st1.ui && st1.ui.plKind, tab1 = st1.ui && st1.ui.tab, strip = s => { const o = JSON.parse(JSON.stringify(s)); if (o.ui) { delete o.ui.plKind; delete o.ui.tab; } return o; };
    ck(w.__requests.length === r0 && wr.every(k => k === 'nhl_v1') && kind === 'F' && tab1 === 'players' && eqA(strip(st0), strip(st1)) && w.location.hash === '#players', `the tab asks the network for nothing and stores nothing but the pill chosen and the tab's name (${w.__requests.length - r0} requests; wrote ${[...new Set(wr)].join(', ') || 'nothing'}; plKind ${kind}, tab ${tab1})`);
    ck(tb.outerHTML === html0 && d.querySelectorAll('#peDefs').length === 1 && d.querySelectorAll('[id="tg-gold"]').length === 1 && d.getElementById('peDefs').parentElement === d.body, 'another tab and back: the same table, the gradients still in the page once, outside the tab'); }
  /* no image, and no colour written on anything of the tab but a club's tag (its own, inline) and the chart's tip, which is placed, not coloured */
  ck(!sec.querySelector('img, image, [style*="url("]') && [...sec.querySelectorAll('[style]')].every(x => x.classList.contains('ttag') || (x.classList.contains('pe-cv-tip') && !/color|background/.test(x.getAttribute('style')))), `no image in the tab, and no inline colour but a club's tag (${[...sec.querySelectorAll('[style]')].filter(x => !x.classList.contains('ttag')).map(x => x.className).slice(0, 3).join(', ') || 'none'})`);
  ck(!errs.length, 'no runtime error: ' + errs.join(' | '));
  w.close();
  return out;
}
async function eloRatingsChecks() {
  console.log('ELO RATINGS');
  /* the stylesheet's own words, read as text (jsdom lays nothing out and resolves no colour): the tab's rules write no colour but the
     tiers' on the legend's swatch, so both looks follow the tokens; a bar's edge is half --ink, 3:1 or more on the card in both looks */
  { const css = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(m => [m[1].trim(), m[2]]).filter(([sel]) => /(^|[\s,>+~(])(\.pe-(?!badge)[\w-]*|#pe[A-Z]\w*|table\.pe-t)/.test(sel));
    const loud = rules.filter(([sel, body]) => /#[0-9A-Fa-f]{3,8}\b|rgba?\(|hsla?\(/.test(body) && !/^\.pe-cv-key b$/.test(sel));
    const swatch = rules.find(([sel]) => sel === '.pe-cv-key b');
    chk(rules.length >= 30 && !loud.length && !!swatch && ['Bronze', 'Gold', 'Diamond', 'Elite'].every(t => swatch[1].toUpperCase().includes(PE_HEX[t])), `the tab's ${rules.length} rules write no colour of their own but the tiers' on the legend's swatch: every other is a token, in both looks (${loud.map(x => x[0]).slice(0, 3).join(' | ') || 'none'})`);
    /* and which token: a rule of the tab that colours text names a text token (each held 4.5:1 on the grounds by THE LOOK: LIGHT AND
       DARK), never a line's or a ground's (--line-2 on a card is 1.7:1); --on-fill only on an --ink fill of the same rule */
    const TEXT_TOK = ['var(--ink)', 'var(--ink-2)', 'var(--muted)', 'var(--pick)', 'var(--miss)', 'var(--on-fill)'];
    const inks = rules.flatMap(([sel, body]) => [...body.matchAll(/(?:^|;)\s*color:\s*([^;]+)/g)].map(m => [sel, m[1].trim(), body]));
    const offTok = inks.filter(([, v, body]) => !TEXT_TOK.includes(v) || (v === 'var(--on-fill)' && !/(?:^|;)\s*background:var\(--ink\)/.test(body)));
    chk(inks.length >= 12 && !offTok.length, `each of the tab's ${inks.length} text colours is a text token (${TEXT_TOK.slice(0, 5).join(', ')}; --on-fill on an --ink fill alone) (${offTok.map(x => `${x[0]} ${x[1]}`).slice(0, 3).join(' | ') || 'all'})`);
    const block = sel => { const i = css.indexOf(sel + '{'); return i < 0 ? '' : css.slice(i + sel.length + 1, css.indexOf('}', i)); };
    const tok = (b, k) => { const m = new RegExp(`${k}:\\s*(#[0-9A-Fa-f]{6})\\b`).exec(b); return m ? m[1] : null; };
    const mix = (a, b) => '#' + [1, 3, 5].map(i => Math.round((parseInt(a.slice(i, i + 2), 16) + parseInt(b.slice(i, i + 2), 16)) / 2).toString(16).padStart(2, '0')).join('');
    const edge = /\.pe-cv-bar\{[^}]*stroke:color-mix\(in srgb,var\(--ink\) 50%,transparent\)[^}]*stroke-width:1[;}]/.test(css.replace(/\}/g, ';}')), low = [];
    for (const [look, b] of [['dark', block(':root')], ['light', block('html[data-theme="light"]')]]) for (const g of ['--panel', '--panel-2']) { const ink = tok(b, '--ink'), gr = tok(b, g); const r = ink && gr ? crH(mix(ink, gr), gr) : 0; if (!(r >= 3)) low.push(`${look} ${g} ${r.toFixed(2)}`); }
    chk(edge && !low.length, `a bar of the histogram is edged in half --ink, 3:1 or more on the card's two grounds in both looks, whatever its tier's colour (${edge ? '' : 'no such rule; '}${low.join(', ') || 'all four'})`);
    /* the pills' looks, by the rules: the chosen one --ink under --on-fill; and no rule of the tab hides a part of its table */
    chk(/\.pe-pos button\[aria-pressed="true"\]\{[^}]*background:var\(--ink\)[^}]*color:var\(--on-fill\)/.test(css) && !rules.some(([sel, body]) => /display:\s*none/.test(body) && /table|\bt[hdr]\b|thead|tbody/.test(sel)), 'the chosen pill is --ink under --on-fill, and no rule of the tab hides a part of its table'); }
  /* `last` against reality, where the state has it, read off this season's box file as tools/players.js reads it: a box line counts
     where its game is a final of the state or carries its own score, on or before the last day the ratings stand on (asOf). No rated
     player is dated earlier than his last such line on the ice (or not dated at all), and nobody is dated on a day of this season on
     which the file never had him on the ice. Held this way round, a line the job did not replay (a game the state has not as a
     final) never fails a run with the job right */
  { const P = (S.players && S.players.players) || {}, f = path.join(DATA, `box_${S.season}.jsonl`), asOf = S.players && S.players.asOf;
    if (Object.values(P).some(p => p && typeof p === 'object' && sPeDay(p.last)) && fs.existsSync(f)) {
      const fin = new Set((S.games || []).filter(g => g && g.state === 'final' && g.hs !== null && g.hs !== undefined).map(g => String(g.id))), top = new Map(), days = new Map();
      for (const line of fs.readFileSync(f, 'utf8').split('\n')) { if (!line) continue; let b; try { b = JSON.parse(line); } catch (e) { continue; }
        if (!b || !sPeDay(b.date)) continue;
        const counts = (fin.has(String(b.id)) || (b.hs !== undefined && b.hs !== null)) && !(sPeDay(asOf) && b.date > asOf);
        for (const x of [].concat(b.skaters || [], b.goalies || [])) { if (!x || !x.id || !(x.toi > 0)) continue; const id = String(x.id);
          if (!days.has(id)) days.set(id, new Set()); days.get(id).add(b.date);
          if (counts && !(top.get(id) >= b.date)) top.set(id, b.date); } }
      const off = Object.keys(P).filter(id => { const p = P[id]; if (!p || typeof p !== 'object') return false;
        return (top.has(id) && !(sPeDay(p.last) && p.last >= top.get(id))) || (sPeDay(p.last) && sPeSeasonOf(p.last) === S.season && !(days.has(id) && days.get(id).has(p.last))); });
      chk(!off.length, `each rated player's \`last\` is the day of his last game on the ice by data/box_${S.season}.jsonl, through ${asOf} (${off.length} differ: ${off.slice(0, 3).map(id => `${P[id].name} ${P[id].last} vs ${top.get(id) || 'no game'}`).join(', ')})`);
      console.log(`  \`last\`: ${Object.values(P).filter(p => p && sPeDay(p.last)).length} of ${Object.keys(P).length} rated players dated, ${top.size} on the ice this season by the box file`);
    } else console.log('  no player of this state carries `last` (a state from before the job wrote it): the tab reads it by the rule it shipped with, held below; the rule on `last` is held on the made-up copies');
  }
  const R0 = await holdElo(S, PUB, 'the state', { hash: 'players', store: JSON.stringify({ ui: { plKind: 'def' } }), view0: 'def', kept: 'def' });
  if (R0 && !R0.none) console.log(`  the state: ${PE_VIEWS.map(g => { const x = R0.groups[g[0]]; return x ? `${x.rows.length} ${g[2]} (mean ${x.sc.m.toFixed(3)}, spread ${x.sc.sd.toFixed(3)}, Elo ${x.rows.length ? `${x.rows[x.rows.length - 1].elo} to ${x.rows[0].elo}` : 'none'}, ${x.rows.filter(r => r.mark).length} marked)` : `${g[2]} not held`; }).join('; ')}; ${R0.clubs.str ? R0.clubs.str.n : 0} clubs; of ${S.players ? Object.keys(S.players.players || {}).length : 0} rated`);
  /* (A) no player model, and the NFL site's address */
  { const A = JSON.parse(STATE); A.players = null;
    await holdElo(A, PUB, 'copy A (no player model)', { hash: 'elo', how: 'the NFL site\'s #elo address' }); }
  /* (B) made-up defencemen and goalies beside the real forwards. The defencemen: 58 players whose figures have a mean of nothing and a
     spread of a tenth of a goal, so a figure in thousandths is its Elo's distance from 1500: one on each tier's line and one a point
     under it (eighteen), and forty more in two level groups that balance the sums (two of them one name: the id orders them; one name accented, for the search). Among them
     each kind of history (no season on file; every season under now; a season over now; two seasons level at the top; a season level
     with now; a junk season) and each way onto a club (a lineup, a box score, an out row of each wording, a day to day, an out and a day
     to day on two clubs, two out rows), and beside them a defenceman a game under the floor, one with no club and one with no figure,
     who are not ranked. The goalies: one in net with his ten games, one who came on in relief and one of a side whose starter the box
     cannot tell, each with his ten (ranked by the box score alone: three, no histogram), and one a game short. A club with no goalie
     in net; two clubs level in attack. An older page's stored Goalies. No player carries `last` here (taken off where the state has
     it), so this copy is read by the rule the tab shipped with, whatever the state */
  { const B = JSON.parse(STATE), okT = t => !!t && typeof t === 'object', ordB = B.players && okT(B.players.teams) ? Object.keys(B.players.teams).filter(k => okT(B.players.teams[k])) : [];
    if (B.players && okT(B.players.players) && ordB.length >= 6) {
      const P = B.players.players, TM = B.players.teams, ord = ordB, cl = ord.slice().sort(), now = B.season;
      for (const p of Object.values(P)) if (p && typeof p === 'object') { delete p.last; if (p.pos === 'D' || p.pos === 'G') p.gp = 0; }      // no `last`; the real defencemen and goalies drop under the floor
      const lines = PE_LADDER.map(x => x[1]).reverse(), offs = [];
      for (const L of lines) offs.push(L - 1500, L - 1501);
      const k = 40, sumO = offs.reduce((a, b) => a + b, 0), sumQ = offs.reduce((a, b) => a + b * b, 0), mu = -sumO / k, s = Math.sqrt((10000 * (offs.length + k) - sumQ) / k - mu * mu);
      for (let i = 0; i < k; i++) offs.push(i < k / 2 ? mu + s : mu - s);
      if (!B.box || typeof B.box !== 'object') B.box = { from: B.today, days: 14, games: {} };
      if (!okT(B.box.games) || !Object.values(B.box.games).some(okT)) B.box.games = Object.assign({}, okT(B.box.games) ? B.box.games : {}, { peGame: { s: {}, g: {} } });
      const bx = Object.values(B.box.games).find(okT); bx.s = okT(bx.s) ? bx.s : {}; bx.g = okT(bx.g) ? bx.g : {};
      const sea = (v, i) => i === 0 ? {} : i === 1 ? { [now - 2]: v - 0.2, [now - 1]: v - 0.1 } : i === 2 ? { [now - 3]: v + 0.05, [now - 2]: v + 0.3, [now - 1]: v + 0.1 } : i === 3 ? { [now - 3]: v + 0.2, [now - 2]: v + 0.2, [now - 1]: v - 0.3 }
        : i === 4 ? { [now - 2]: v - 0.1, [now - 1]: v } : i === 5 ? { [now - 2]: null, junk: 0.9, [now - 1]: v - 0.05 } : { [now - 1]: v };
      offs.forEach((o, i) => { const id = `peD${String(i).padStart(2, '0')}`, v = o / 1000, club = cl[i % cl.length];
        P[id] = { name: i === 20 || i === 21 ? 'Level Twin' : i === 13 ? 'Zoë Ståhl' : `Dee ${String(i).padStart(2, '0')}`, pos: 'D', team: club, o: v - 0.01, d: 0.01, gk: 0, v, gp: i % 2 ? 20 : 300 + i, toi: 1200, seasons: sea(v, i) };
        if (i === 6) TM[club].out = (TM[club].out || []).concat({ id, name: P[id].name, pos: 'D', status: 'Injured Reserve', cost: 0 });
        else if (i === 7) TM[club].out = (TM[club].out || []).concat({ id, name: P[id].name, pos: 'D', status: 'Out', cost: 0 });
        else if (i === 8) TM[club].out = (TM[club].out || []).concat({ id, name: P[id].name, pos: 'D', status: 'Suspension', cost: 0 });
        else if (i === 9) TM[club].out = (TM[club].out || []).concat({ id, name: P[id].name, pos: 'D' });
        else if (i === 10) TM[club].dtd = (TM[club].dtd || []).concat({ id, name: P[id].name, pos: 'D' });
        else if (i === 11) { TM[cl[5]].dtd = (TM[cl[5]].dtd || []).concat({ id, name: P[id].name, pos: 'D' }); TM[cl[1]].out = (TM[cl[1]].out || []).concat({ id, name: P[id].name, pos: 'D', status: 'Out' }); }
        else if (i === 12) { TM[ord[0]].out = (TM[ord[0]].out || []).concat({ id, name: P[id].name, pos: 'D', status: 'Suspension' }); TM[ord[1]].out = (TM[ord[1]].out || []).concat({ id, name: P[id].name, pos: 'D', status: 'Injured Reserve' }); }
        else if (i % 3 === 0) bx.s[id] = [0, 0, 1, 1];
        else TM[club].lineup = (TM[club].lineup || []).concat({ id, name: P[id].name, pos: 'D', share: 0.01, v }); });
      P.peDu = { name: 'Under Floor', pos: 'D', team: cl[0], o: 0.9, d: 0, gk: 0, v: 0.9, gp: 19, toi: 900, seasons: {} }; TM[cl[0]].lineup = (TM[cl[0]].lineup || []).concat({ id: 'peDu', name: 'Under Floor', pos: 'D', share: 0.01, v: 0.9 });
      P.peDn = { name: 'No Club', pos: 'D', team: cl[0], o: 0.9, d: 0, gk: 0, v: 0.9, gp: 400, toi: 900, seasons: {} };
      P.peDx = { name: 'No Figure', pos: 'D', team: cl[0], o: 0, d: 0, gk: 0, v: null, gp: 400, toi: 900, seasons: {} }; TM[cl[0]].lineup = TM[cl[0]].lineup.concat({ id: 'peDx', name: 'No Figure', pos: 'D', share: 0.01, v: 0 });
      P.peG1 = { name: 'Only Goalie', pos: 'G', team: cl[1], o: 0, d: 0, gk: 0.2, v: 0.2, gp: 10, toi: 0, seasons: { [now - 1]: 0.1 } };
      TM[cl[1]].goalie = { id: 'peG1', name: 'Only Goalie', gk: 0.2, how: 'planted' };
      P.peG2 = { name: 'Short Goalie', pos: 'G', team: cl[2], o: 0, d: 0, gk: 0.4, v: 0.4, gp: 9, toi: 0, seasons: {} }; bx.g.peG2 = 20;
      P.peG3 = { name: 'Relief Goalie', pos: 'G', team: cl[2], o: 0, d: 0, gk: -0.1, v: -0.1, gp: 10, toi: 0, seasons: {} }; bx.r = (Array.isArray(bx.r) ? bx.r : []).concat('peG3');
      P.peG4 = { name: 'Unsure Goalie', pos: 'G', team: cl[4], o: 0, d: 0, gk: 0.05, v: 0.05, gp: 11, toi: 0, seasons: {} }; bx.u = (Array.isArray(bx.u) ? bx.u : []).concat('peG4');
      TM[cl[3]].goalie = null;
      TM[cl[4]].offence = TM[cl[5]].offence;
      const RD = sPeRows(B, 'D'), RG = sPeRows(B, 'G'), byId = Object.fromEntries(RD.rows.map(x => [x.id, x])), UB = sPeClubs(B), elos = RD.rows.map(x => x.elo), hist = i => sPeHist(B, P[`peD0${i}`], RD.sc), cur = sPeSeason(now);
      chk(RD.rows.length === 58 && Math.abs(RD.sc.m) < 1e-12 && Math.abs(RD.sc.sd - 0.1) < 1e-12 && lines.every(L => elos.includes(L) && elos.includes(L - 1)) && new Set(RD.rows.map(x => sPeTier(x.elo).name)).size === 10
        && RD.rows.filter(x => x.elo === 1551).length === 20 && RD.rows.filter(x => x.elo === 1404).length === 20 && !byId.peDu && !byId.peDn && !byId.peDx
        && (() => { const lv = RD.rows.filter(x => x.elo === 1551), under = RD.rows.find(x => x.elo < 1551); return lv.every(x => x.rank === lv[0].rank) && RD.rows[RD.rows.indexOf(byId.peD20) + 1] === byId.peD21 && !!under && under.rank === lv[0].rank + 20; })()
        && eqA([6, 7, 8, 9, 10, 11, 12].map(i => { const m = byId[`peD${String(i).padStart(2, '0')}`].mark; return m ? `${m.k} ${m.w}` : ''; }), ['out Injured Reserve', 'out Out', 'out Suspension', 'out Out', 'dtd Day to day', 'out Out', 'out Suspension'])
        && hist(0).career === null && !hist(0).line.length && hist(0).peak[1] === cur && hist(1).peak[1] === cur && hist(2).peak[1] === sPeSeason(now - 2) && hist(3).peak[1] === sPeSeason(now - 3) && hist(4).peak[1] === sPeSeason(now - 1) && hist(5).line.length === 1
        && !sPeWho(B).dated && eqA(RG.rows.map(x => x.id), ['peG1', 'peG4', 'peG3']) && RG.rows[0].elo > RG.rows[1].elo && RG.rows[1].elo > RG.rows[2].elo && eqA(RG.rows.map(x => x.rank), [1, 2, 3]) && !UB.gk.place.has(cl[3]) && (!sPeIsNum(TM[cl[3]].strength) || UB.str.place.has(cl[3])) && (!sPeIsNum(TM[cl[5]].offence) || (UB.off.place.get(cl[4]) === UB.off.place.get(cl[5]) && Math.abs(UB.off.have.indexOf(cl[4]) - UB.off.have.indexOf(cl[5])) === 1)),
        `copy B plants 58 defencemen on a mean of nothing and a spread of a tenth (${RD.sc.m.toExponential(1)}, ${RD.sc.sd}), one on each tier's line and one under it, two level groups of twenty sharing a rank each, twins, each mark and each history, three who are not ranked, three goalies (in net, in relief, of a side with no starter told) and one a game short, a club with no goalie and two level in attack, no \`last\` (${RD.rows.length} ranked; ${[...new Set(RD.rows.map(x => sPeTier(x.elo).name))].join(', ')}; goalies ${RG.rows.map(x => `${x.id} ${x.elo}`).join(', ')})`);
      await holdElo(B, PUB, 'copy B (the first rule: every tier, level players, the marks, the histories, three goalies, a club with no goalie)', { store: JSON.stringify({ ui: { tab: 'players', plKind: 'goalies' } }), view0: 'G', kept: 'goalies', how: 'a stored Players tab' });
    } else console.log(`  copy B not planted: it needs a player model with six clubs (${ordB.length})`);
  }
  /* (C) and (D): `last` planted, so these two are read by the rule on it, whatever the state. Everyone the state's own rule ranks today
     is dated this season, everyone else three seasons back; then three forwards no report names: one taken out of every lineup and box
     score (off the report and not dressed: he stays, on his game this season); one left in his lineup and dated last season (he goes:
     a lineup ranks nobody now); one dated three seasons back and put on the injured reserve of a club that is not his last game's (he
     stays, marked, and is shown at that club). The goalies all level (a spread of nothing: every one 1500 and one rank), the forwards
     cut to a handful (a histogram is drawn from five) and the defencemen to one (1500, none drawn). (C) as the season stands, an older
     page's stored Skaters; (D) the same with no game final yet, as before a season's first puck drop: last season counts, so the
     second forward stays too, and one dated two seasons back does not */
  for (const early of [false, true]) {
    const C = JSON.parse(STATE), okT = t => !!t && typeof t === 'object', tag = early ? 'copy D (`last`, before the season\'s first final)' : 'copy C (`last`: off the report and not dressed, last season\'s, another club\'s report; a group all level, a group of one)';
    const clubs = C.players && okT(C.players.teams) ? Object.keys(C.players.teams).filter(k => okT(C.players.teams[k])) : [];
    if (!(C.players && okT(C.players.players) && Object.values(C.players.players).some(okT) && clubs.length >= 2 && Array.isArray(C.games))) { console.log(`  ${early ? 'copy D' : 'copy C'} not planted: it needs a player model with a rated player and two clubs`); continue; }
    const P = C.players.players, TM = C.players.teams, now = C.season, day = back => `${now - 1 - back}-11-15`, W0 = sPeWho(C);
    const was = { F: sPeRows(C, 'F', W0).rows, D: sPeRows(C, 'D', W0).rows, G: sPeRows(C, 'G', W0).rows }, rankedWas = new Set([].concat(was.F, was.D, was.G).map(x => x.id));
    if (early) { for (const g of C.games) if (g && g.state === 'final') { g.state = 'pre'; g.hs = null; g.as = null; } }
    const noFinal = !C.games.some(g => g && g.state === 'final');      // (C) on a state with no final of its own, a summer's, is before the first final too
    for (const id of Object.keys(P)) if (okT(P[id])) P[id].last = rankedWas.has(id) ? day(0) : day(3);
    const free = was.F.filter(x => !x.mark), f1 = free[0], f2 = free[1], f3 = free[2], f4 = free[3];
    if (f1) { for (const c of clubs) TM[c].lineup = (TM[c].lineup || []).filter(l => !l || String(l.id) !== f1.id);
      for (const b of Object.values((C.box && C.box.games) || {})) if (okT(b)) { if (okT(b.s)) delete b.s[f1.id]; } }
    if (f2) P[f2.id].last = day(1);
    const far = f3 && clubs.find(c => c !== f3.p.team);
    if (f3 && far) { P[f3.id].last = day(3); TM[far].out = (TM[far].out || []).concat({ id: f3.id, name: f3.p.name, pos: f3.p.pos, status: 'Injured Reserve', cost: 0 }); }
    if (f4) P[f4.id].last = day(2);
    const keepF = new Set(was.F.slice(0, 5).map(x => x.id).concat([f1, f2, f3, f4].filter(Boolean).map(x => x.id)));
    was.F.forEach(x => { if (!keepF.has(x.id)) P[x.id].gp = 0; }); was.D.slice(1).forEach(x => { P[x.id].gp = 0; });
    for (const x of was.G) { P[x.id].v = 0.123; P[x.id].gk = 0.123; }
    const W = sPeWho(C), F2 = sPeRows(C, 'F', W), D2 = sPeRows(C, 'D', W), G2 = sPeRows(C, 'G', W), inF = x => !!x && F2.rows.some(y => y.id === x.id), r3 = f3 && F2.rows.find(y => y.id === f3.id);
    chk(W.dated && W.early === noFinal && (!early || noFinal) && (!f1 || (inF(f1) && !clubs.some(c => (TM[c].lineup || []).some(l => l && String(l.id) === f1.id)))) && (!f2 || inF(f2) === noFinal) && (!f3 || !far || (!!r3 && r3.club === far && r3.club !== f3.p.team && r3.mark && r3.mark.k === 'out')) && (!f4 || !inF(f4))
      && G2.rows.length === was.G.length && G2.rows.every(x => x.elo === 1500 && x.rank === 1) && D2.rows.length === Math.min(1, was.D.length) && D2.rows.every(x => x.elo === 1500) && F2.rows.length <= 9,
      `${tag} plants \`last\` on every player: a forward off the report and out of every lineup who stays, one dressed and dated last season who ${noFinal ? 'stays (no final yet)' : 'goes'}, one on another club's injured reserve shown there, one dated two seasons back who goes; the goalies all level on one rank, one defenceman (${F2.rows.length} forwards, ${D2.rows.length} defencemen, ${G2.rows.length} goalies at ${[...new Set(G2.rows.map(x => x.elo))].join(',')}; ${f1 ? f1.p.name : 'no forward to plant on'})`);
    await holdElo(C, PUB, tag, early ? { hash: 'players' } : { store: JSON.stringify({ ui: { tab: 'players', plKind: 'skaters' } }), view0: 'F', kept: 'skaters', how: 'a stored Players tab' });
  }
  /* a junk pill kept (a number where a pill's name should be) opens Forwards and breaks nothing: the stored tab alone opens ELO Ratings */
  for (const junk of [42]) {
    const errs = [], w = await boot(PUB, errs, { store: JSON.stringify({ ui: { tab: 'players', plKind: junk } }) }), d = w.document, on = [...d.querySelectorAll('#pePos button[aria-pressed="true"]')].map(b => b.dataset.view);
    chk(!d.getElementById('tab-players').hidden && (S.players ? eqA(on, ['F']) && d.querySelectorAll('#peTable tbody tr').length >= Math.min(60, sPeRows(S, 'F').rows.length) : d.getElementById('pePos').hidden) && !errs.length, `a kept pill of ${JSON.stringify(junk)} opens Forwards, nothing thrown (${on.join(',') || 'none'}; ${d.querySelectorAll('#peTable tbody tr').length} rows; ${errs.join(' | ')})`);
    w.close();
  }
}

/* ---------- THE LOOK: LIGHT AND DARK (nhl v25), and the owner's rule that the page carries no descriptions ----------
   The NFL hub's two looks on hockey's tokens: both palettes in the page, the head's script (the NFL's theme.js, its key nhlhub_theme_v1)
   before the body, the switch in the header. All of it by rules of this file's own: the palettes read from the stylesheet's text and
   every text and fill pair by the WCAG sums above (crH), the switch pressed in jsdom. The switch ships hidden until every tab is
   rebuilt on the tokens, and that is held too. What jsdom cannot hold (the wordmark on one line clear of the switch, no sideways
   scroll, the composed contrast of every visible text in the light look) is looked at in a real browser. */
async function lightDarkChecks() {
  console.log('THE LOOK: LIGHT AND DARK');
  const KEYT = 'nhlhub_theme_v1', AT = PUB + 60000;
  /* the head: the theme script after the stylesheet and before the body; the key named in that script alone */
  const scripts = [...HTML.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => ({ at: m.index, text: m[1] })), keyed = scripts.filter(x => x.text.includes(KEYT));
  const count = (hay, needle) => hay.split(needle).length - 1;
  chk(keyed.length === 1 && keyed[0].at > HTML.indexOf('</style>') && keyed[0].at < HTML.indexOf('</head>') && HTML.indexOf('</head>') < HTML.indexOf('<body') && count(HTML, KEYT) === count(keyed[0].text, KEYT),
    `the theme script is in the head, after the stylesheet and before the body is parsed, and ${KEYT} is named in it alone (${keyed.length} scripts name it, ${count(HTML, KEYT)} times in the page)`);
  chk(scripts.length >= 3 && scripts[0] === keyed[0] && /localStorage\.getItem\(KEY\)==='light'/.test(keyed[0].text) && !/localStorage\.(setItem|removeItem)\((?!KEY,)/.test(keyed[0].text), 'it is the first script of the page, reads the key for exactly "light" and writes that key alone');
  /* both palettes, read from the stylesheet's text: every token of :root that names a colour has a light value */
  const css = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');
  const block = sel => { const i = css.indexOf(sel + '{'); return i < 0 ? '' : css.slice(i + sel.length + 1, css.indexOf('}', i)); };
  const toks = b => { const o = {}; for (const m of b.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) o[m[1]] = m[2].trim(); return o; };
  const DARK = toks(block(':root')), LIGHT = toks(block('html[data-theme="light"]'));
  const isCol = v => /#[0-9A-Fa-f]{3,8}\b|rgba?\(/.test(v) && !/^var\(/.test(v), colourToks = Object.keys(DARK).filter(k => isCol(DARK[k])), noLight = colourToks.filter(k => !LIGHT[k] || !isCol(LIGHT[k]));
  chk(colourToks.length >= 24 && !noLight.length && /color-scheme:dark/.test(block(':root')) && /color-scheme:light/.test(block('html[data-theme="light"]')), `the page has both palettes, and every colour token of :root has a light value (${colourToks.length} colour tokens; without one: ${noLight.join(', ') || 'none'})`);
  const hexT = (P, k) => /^#[0-9A-Fa-f]{6}$/.test(P[k] || '') ? P[k] : null;
  const TEXT = ['--ink', '--ink-2', '--muted', '--ice', '--ice-2', '--pick', '--miss', '--gold-ink'], GROUNDS = ['--bg', '--bg-2', '--panel', '--panel-2', '--panel-3'], FILLS = ['--ice', '--pick', '--rose', '--ink'];
  const need = TEXT.concat(GROUNDS, FILLS, ['--on-fill']);
  chk(need.every(k => hexT(DARK, k) && hexT(LIGHT, k)), `every text, ground and fill token is a hex colour in both palettes (${need.filter(k => !hexT(DARK, k) || !hexT(LIGHT, k)).join(', ') || 'all'})`);
  if (need.every(k => hexT(DARK, k) && hexT(LIGHT, k))) {
    /* the light look: every text token 4.5:1 on every ground, and its fills carry white */
    const lowL = []; for (const t of TEXT) for (const g of GROUNDS) { const r = crH(LIGHT[t], LIGHT[g]); if (!(r >= 4.5)) lowL.push(`${t} on ${g} ${r.toFixed(2)}`); }
    chk(!lowL.length, `the light look: ${TEXT.join(', ')} are each 4.5:1 or more on ${GROUNDS.join(', ')} (${lowL.slice(0, 5).join('; ') || `least ${Math.min(...TEXT.flatMap(t => GROUNDS.map(g => crH(LIGHT[t], LIGHT[g])))).toFixed(2)}`})`);
    const lowLF = FILLS.map(f => [f, crH(LIGHT['--on-fill'], LIGHT[f])]).filter(x => !(x[1] >= 4.5));
    chk(sameHex(LIGHT['--on-fill'], '#FFFFFF') && !lowLF.length, `the light look: the text on a fill is white, 4.5:1 or more on ${FILLS.join(', ')} (${lowLF.map(x => `${x[0]} ${x[1].toFixed(2)}`).join('; ') || 'all'})`);
    /* the dark look the same way, #1E2230 on its fills; on --panel-3 quiet and red text are --ink-2's to carry (the page's standing rule:
       --muted and --miss are for --panel and --panel-2), so those two pairs are reported, not held */
    const lowD = [], said = []; for (const t of TEXT) for (const g of GROUNDS) { const r = crH(DARK[t], DARK[g]); if (g === '--panel-3' && (t === '--muted' || t === '--miss')) { said.push(`${t} ${r.toFixed(2)}`); continue; } if (!(r >= 4.5)) lowD.push(`${t} on ${g} ${r.toFixed(2)}`); }
    chk(!lowD.length, `the dark look: every text token is 4.5:1 or more on every ground it is written on (${lowD.slice(0, 5).join('; ') || 'all'}; on --panel-3, where secondary text is --ink-2: ${said.join(', ')})`);
    const lowDF = FILLS.map(f => [f, crH(DARK['--on-fill'], DARK[f])]).filter(x => !(x[1] >= 4.5));
    chk(sameHex(DARK['--on-fill'], '#1E2230') && !lowDF.length, `the dark look: the text on a fill is #1E2230, 4.5:1 or more on ${FILLS.join(', ')} (${lowDF.map(x => `${x[0]} ${x[1].toFixed(2)}`).join('; ') || 'all'})`);
    console.log(`  both palettes: ${colourToks.length} colour tokens; light text on its grounds ${Math.min(...TEXT.flatMap(t => GROUNDS.map(g => crH(LIGHT[t], LIGHT[g])))).toFixed(2)}:1 at the least, white on its fills ${Math.min(...FILLS.map(f => crH('#FFFFFF', LIGHT[f]))).toFixed(2)}:1; dark on --panel-3: ${said.join(', ')}`);
  }
  /* a rule that draws the two looks apart must not unhide the switch, nor may any rule: the stylesheet hides whatever carries [hidden] */
  chk(/\[hidden\]\{display:none!important\}/.test(css) && !/\.hub-theme[^{}]*\{[^}]*display:[^;}]*!important/.test(css), 'the stylesheet hides whatever is [hidden], the switch among it, and no rule of the switch outranks that');
  /* the switch, with nothing stored: one, in the header before the tabs, a button named Light mode, its glyphs hidden from a screen reader,
     not pressed, the page dark with no data-theme; and hidden for now */
  const errs = [], w = await boot(AT, errs, { bodyProbe: true }), d = w.document, root = d.documentElement;
  const sws = [...d.querySelectorAll('[data-theme-toggle]')], sw = sws[0];
  chk(sws.length === 1 && sw.tagName === 'BUTTON' && !!sw.closest('header') && !!(sw.compareDocumentPosition(d.getElementById('tabs')) & 4) && sw.getAttribute('aria-label') === 'Light mode' && !txt(sw)
    && sw.querySelectorAll('svg').length === 2 && [...sw.querySelectorAll('svg')].every(x => x.getAttribute('aria-hidden') === 'true'), `one switch, a button in the header before the tabs, named Light mode, its two glyphs hidden from a screen reader (${sws.length})`);
  if (!sw) return;
  chk(root.getAttribute('data-theme') === null && w.__atBody === '' && sw.getAttribute('aria-pressed') === 'false' && sw.title === 'Switch to light mode' && w.localStorage.getItem(KEYT) === null && !w.__writes.includes(KEYT),
    `with nothing stored the page is dark, no data-theme on it, the switch not pressed and nothing written (${root.getAttribute('data-theme')}, ${sw.getAttribute('aria-pressed')}, "${sw.title}")`);
  chk(sw.hidden && sw.hasAttribute('hidden') && w.getComputedStyle(sw).display === 'none', `the switch is hidden for now, by its attribute and by the stylesheet: visitors get the dark look until every tab is rebuilt (hidden ${sw.hidden}, display ${w.getComputedStyle(sw).display})`);
  /* a press (jsdom presses a hidden button): light, pressed, the title turned, the key written and nothing else, nhl_v1 as it was; again: dark */
  const store0 = w.localStorage.getItem('nhl_v1'), w0 = w.__writes.length;
  sw.click();
  chk(root.getAttribute('data-theme') === 'light' && sw.getAttribute('aria-pressed') === 'true' && sw.title === 'Switch to dark mode' && sw.getAttribute('aria-label') === 'Light mode', `a press puts html[data-theme="light"] on the page, the switch pressed, its title turned, its name kept (${root.getAttribute('data-theme')}, ${sw.getAttribute('aria-pressed')}, "${sw.title}")`);
  chk(w.localStorage.getItem(KEYT) === 'light' && eqA(w.__writes.slice(w0), [KEYT]) && w.localStorage.getItem('nhl_v1') === store0 && !w.__requests.slice().some(r => /theme/i.test(r.url)), `the press writes ${KEYT} and nothing else, sends nothing, and leaves nhl_v1 as it was (${w.__writes.slice(w0).join(', ')})`);
  sw.click();
  chk(root.getAttribute('data-theme') === 'dark' && sw.getAttribute('aria-pressed') === 'false' && sw.title === 'Switch to light mode' && w.localStorage.getItem(KEYT) === 'dark' && eqA(w.__writes.slice(w0), [KEYT, KEYT]), `a second press is dark again, kept (${root.getAttribute('data-theme')}, ${w.localStorage.getItem(KEYT)})`);
  /* another tab of the site switched: this one follows, writing nothing; a storage event for another key changes nothing */
  w.localStorage.setItem(KEYT, 'light'); const w1 = w.__writes.length;
  w.dispatchEvent(new w.StorageEvent('storage', { key: KEYT, newValue: 'light' }));
  chk(root.getAttribute('data-theme') === 'light' && sw.getAttribute('aria-pressed') === 'true' && w.__writes.length === w1, `another tab's switch is followed, nothing written (${root.getAttribute('data-theme')}, ${w.__writes.length - w1} writes)`);
  w.localStorage.setItem(KEYT, 'dark'); const w2 = w.__writes.length;
  w.dispatchEvent(new w.StorageEvent('storage', { key: 'somebody_elses_key', newValue: 'x' }));
  chk(root.getAttribute('data-theme') === 'light' && sw.getAttribute('aria-pressed') === 'true' && w.__writes.length === w2, `a storage event for another key changes nothing (${root.getAttribute('data-theme')})`);
  w.dispatchEvent(new w.StorageEvent('storage', { key: null }));
  chk(root.getAttribute('data-theme') === 'dark' && sw.getAttribute('aria-pressed') === 'false' && w.__writes.length === w2, `storage cleared or changed wholesale (a null key) is read again, nothing written (${root.getAttribute('data-theme')})`);
  chk(!errs.length, 'no runtime error on the switch: ' + errs.join(' | '));
  /* the head's script and the switch's own markup on a bare page (the page's text, nothing else of it: the whole page booted nine more
     times is more than this smoke's memory): a reload with light kept is light as the body starts to be parsed, so the first paint is
     light; every kept value but exactly 'light' reads as dark; storage that throws on the key reads as dark, a press still switches,
     nothing is thrown */
  const swHtml = (/<button type="button" class="hub-theme"[\s\S]*?<\/button>/.exec(HTML) || [''])[0];
  const bare = (kept, denied) => { const es = [];
    const dom = new JSDOM(`<!doctype html><html lang="en"><head><script>${keyed[0].text}</` + `script></head><body><script>window.__atBody = document.documentElement.getAttribute("data-theme") || "";</` + `script><header>${swHtml}</header></body></html>`, {
      runScripts: 'dangerously', url: 'http://localhost/', beforeParse(x) {
        x.__writes = []; x.addEventListener('error', e => es.push(e.message));
        if (kept !== undefined) x.localStorage.setItem(KEYT, kept);
        const set = x.Storage.prototype.setItem, get = x.Storage.prototype.getItem;
        x.Storage.prototype.setItem = function (k, v) { x.__writes.push(String(k)); if (denied) throw new Error('storage denied'); return set.call(this, k, v); };
        if (denied) x.Storage.prototype.getItem = function () { throw new Error('storage denied'); };
      } });
    return { x: dom.window, es }; };
  chk(swHtml.length > 200 && /data-theme-toggle/.test(swHtml), "the switch's markup read from the page");
  { const { x, es } = bare('light'), sL = x.document.querySelector('[data-theme-toggle]'); await wait(20);      // the switch is drawn once the page is parsed
    chk(x.__atBody === 'light' && x.document.documentElement.getAttribute('data-theme') === 'light' && sL.getAttribute('aria-pressed') === 'true' && sL.title === 'Switch to dark mode' && !x.__writes.length && !es.length,
      `a reload with light kept is light before the body is parsed, the switch drawn pressed, nothing written (${x.__atBody}, ${sL.getAttribute('aria-pressed')}; ${es.join(' | ')})`); x.close(); }
  for (const v of ['Light', 'LIGHT', ' light ', 'light\n', 'dark', 'junk', '']) {
    const { x, es } = bare(v), dV = x.document; await wait(20);
    chk(x.__atBody === '' && dV.documentElement.getAttribute('data-theme') === null && dV.querySelector('[data-theme-toggle]').getAttribute('aria-pressed') === 'false' && dV.querySelector('[data-theme-toggle]').title === 'Switch to light mode' && !x.__writes.length && !es.length, `${JSON.stringify(v)} kept reads as dark (${x.__atBody || 'dark'}; ${es.join(' | ')})`);
    x.close();
  }
  { const { x, es } = bare(undefined, true), dT = x.document, sT = dT.querySelector('[data-theme-toggle]'); await wait(20);
    const dark0 = x.__atBody === '' && dT.documentElement.getAttribute('data-theme') === null && sT.getAttribute('aria-pressed') === 'false';
    sT.click();
    const light1 = dT.documentElement.getAttribute('data-theme') === 'light' && sT.getAttribute('aria-pressed') === 'true';
    sT.click();
    chk(dark0 && light1 && dT.documentElement.getAttribute('data-theme') === 'dark' && !es.length, `storage that throws reads as dark, a press still switches the look and back, nothing is thrown (${dT.documentElement.getAttribute('data-theme')}; ${es.join(' | ')})`); x.close(); }

  /* ---- no descriptions (the owner's rule on the NFL page, 22 October 2026: "i dont want any descriptions anywhere. i want the site
     to speak for itself"): the classes the cut texts wore are gone from the page and its stylesheet, and on every tab no paragraph or
     small print of main that shows is a sentence over 90 characters, but for the kept few: a warning that a call stands on old data,
     the builder's and the panel's money warnings, a notice the watch said, an error line */
  const GONE = ['tagline', 'intro', 'pb-sub', 'pb-ctlnote', 'pb-hint', 'pb-rules', 'pp-how', 'pp-trial', 'lu-key', 'confkey', 'pb-key', 'pb-tap', 'pc-own', 'pp-key', 'pp-more', 'pp-none', 'pp-read', 'coach'];
  const inCss = GONE.filter(c => new RegExp(`\\.${c}(?![\\w-])`).test(css));
  const wP = w, dP = d;      // the page booted above, dark again
  const inDom = GONE.filter(c => dP.querySelector('.' + c));
  chk(!inCss.length && !inDom.length && !dP.querySelector('main details:not(.pb-games):not(.pb-pick)') && !dP.querySelector('#gameModal details, #gsModal details') && !dP.querySelector('#spRules, #pbRules, #ppHow, #fitNote, #pkNote, #bHint, #pcOwn, #pbStakeH'),
    `the classes and folds the cut descriptions wore are gone from the page and its stylesheet (in the CSS: ${inCss.join(', ') || 'none'}; in the page: ${inDom.join(', ') || 'none'})`);
  /* kept: the source warnings, the builder's and the panel's money warnings and notices, another book's prices, an error line, the
     change of the levels' rule for its seven days (a model change, the one thing worth a banner); and one that is not a description: a
     level with no parlay says why (.pb-tier.none). A game's page and its windows are outside main: THE
     GAME'S PAGE holds them to the same rule, game by game */
  const KEPT = ['#sourceNote', '#bNotes', '#pbNotes', '#pbRead', '#spRead', '#xpNote', '#xbNote', '#bMsg', '.pb-tier.none', '#spChange'];      // #spChange: the one dated line on a change of rule (nhl v31), seven days
  const showing = el => { for (let x = el; x && x !== dP.body; x = x.parentElement) if (x.hidden) return false; return true; };
  const long = [];
  const sweep = tag => { for (const el of dP.querySelectorAll('main p, main small, main .intro')) { if (!showing(el) || KEPT.some(k => el.closest(k))) continue; const t = txt(el); if (t.length > 90) long.push(`${tag}: ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : el.className ? '.' + String(el.className).split(' ')[0] : ''} "${t.slice(0, 70)}…" (${t.length})`); } };
  for (const b of [...dP.querySelectorAll('#tabs button')]) {
    b.click(); sweep(b.dataset.tab);
    if (b.dataset.tab === 'games') { for (const day of dayList(dP)) { openDay(dP, day); sweep(`games ${day}`); } }
    if (b.dataset.tab === 'pickem' && dP.querySelector('#pkPicksW').hidden) { dP.querySelector('#pkShow').click(); sweep('pickem, every pick'); }
    if (b.dataset.tab === 'parlays') { if (!dP.getElementById('pbPick').open) dP.getElementById('pbPick').open = true; sweep('parlays, Pick your own legs'); }
  }
  chk(!long.length, `no paragraph or small print of main is a sentence over 90 characters, on any tab, but the kept warnings (${long.length}: ${long.slice(0, 3).join(' | ')})`);
  /* the kept ones are short too where they show: the source warnings a few bold words each */
  const sn = dP.getElementById('sourceNote');
  chk(sn.hidden || [...sn.querySelectorAll('b')].every(x => txt(x).length <= 60) && txt(sn).length === [...sn.querySelectorAll('b')].reduce((a, x) => a + txt(x).length, 0) + Math.max(0, sn.querySelectorAll('b').length - 1) * 0, `a source warning is its few bold words and nothing after them (${txt(sn).slice(0, 120)})`);
  console.log(`  no descriptions: ${GONE.length} classes gone from the page and its stylesheet; every tab swept, ${long.length} long line(s)`);
  chk(!errs.length, 'no runtime error on the sweep: ' + errs.join(' | '));
  w.close();
}

/* ---------- X PARLAYS AND THE X BET LOG (nhl v21) ----------
   The owner's two tabs, by rules of their own. A visitor's page (no NFL sign-in, a refused one, a junk one) has neither tab, never asks
   for either file, and lands an X address (or a stored X tab) on Games. The admin's (the NFL hub's record under nflhub_admin_v1, which
   the page never writes) shows both and reads both files no-store; on the committed files, and on planted ones built from the state:
   every slip's legs graded by this section's own rules on the finals and the box scores the state carries (a team bet on the score, a
   player's line on the box, void where he did not play), each card's state, tags, money and every leg's mark and words; a slip settled
   two Eastern days before today, one marked cleared and one with a junk leg left off; the per-device clear and Show them again
   (stored in nhl_v1, kept through a reload); the files unread said so; the X Bet Log's tiles, table and chart by its own sums */
const xEt = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
const xAdd = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
function xLegWant(l, St) {
  const g = St.games.find(x => x.id === String(l.game));
  if (!g) return 'gone';
  if (g.state !== 'final' || g.hs === null) return 'pending';
  if (l.kind === 'prop') {
    const b = St.box && St.box.games && St.box.games[String(l.game)]; if (!b) return 'pending';
    let x;
    if (l.stat === 'sv') { const v = b.g && b.g[String(l.pid)]; if (v === undefined) return 'void'; x = v; }
    else { const v = b.s && b.s[String(l.pid)]; if (!Array.isArray(v)) return 'void'; x = l.stat === 'pts' ? v[0] + v[1] : v[{ g: 0, a: 1, s: 2, bs: 3 }[l.stat]]; }
    if (l.mk === 'yes') return x >= l.k ? 'win' : 'loss';
    return x > l.line ? (l.side === 'over' ? 'win' : 'loss') : x < l.line ? (l.side === 'under' ? 'win' : 'loss') : 'push';
  }
  if (l.kind === 'ou') { const t = g.hs + g.as; return t > l.line ? (l.side === 'over' ? 'win' : 'loss') : t < l.line ? (l.side === 'under' ? 'win' : 'loss') : 'push'; }
  const m = l.side === 'home' ? g.hs - g.as : g.as - g.hs;
  if (l.kind === 'ml') return m > 0 ? 'win' : 'loss';
  return m + l.line > 0 ? 'win' : m + l.line < 0 ? 'loss' : 'push';
}
async function xParlaysChecks() {
  console.log('X PARLAYS AND THE X BET LOG');
  const REC = JSON.stringify({ k: 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6', at: '2026-10-01T00:00:00Z', ok: true, checked: '2026-10-01T00:00:00Z', left: 400, leftAt: '2026-10-01T00:00:00Z' });
  const xReq = w => w.__requests.filter(r => /data\/x(parlays|bets)\.json/.test(r.url));
  const tabsOf = d => [...d.querySelectorAll('#tabs button')].filter(b => !b.hidden).map(b => b.dataset.tab);
  /* a visitor's page, three ways */
  for (const [tag, admin] of [['no NFL sign-in', undefined], ['a sign-in The Odds API refused', JSON.stringify({ k: 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6', ok: false })], ['a junk record', '{"k":"short","ok":true}']]) {
    const errs = [], w = await boot(PUB, errs, { hash: 'xparlays', admin, store: JSON.stringify({ ui: { tab: 'xbets' } }) }), d = w.document;
    chk(!d.documentElement.getAttribute('data-admin') && !tabsOf(d).some(t => t === 'xparlays' || t === 'xbets') && !xReq(w).length, `${tag}: a visitor's page, no X tab and neither file asked for (${tabsOf(d).join(',')}; ${xReq(w).length} asked)`);
    /* nhl v25, the NFL hub's way: the owner's two tabs are not in a visitor's page at all (the stylesheet hides them from the first paint,
       the page then takes them out), and the header carries no Admin mark */
    chk(!d.querySelector('#tabs [data-admin-only]') && !d.querySelector('#tabs button[data-tab="xparlays"], #tabs button[data-tab="xbets"]') && d.querySelector('#hubAdmin').hidden && /html:not\(\[data-admin="on"\]\) #tabs \[data-admin-only\]\{display:none!important\}/.test(HTML), `${tag}: the owner's tabs are out of a visitor's page, hidden by the stylesheet until then, and no Admin mark shows`);
    chk(!d.querySelector('#tab-games').hidden && d.querySelector('#tab-xparlays').hidden && d.querySelector('#tab-xbets').hidden, `${tag}: #xparlays lands on Games`);
    w.location.hash = '#xbets'; w.dispatchEvent(new w.HashChangeEvent('hashchange')); await wait(5);
    chk(!d.querySelector('#tab-games').hidden && d.querySelector('#tab-xbets').hidden && !xReq(w).length, `${tag}: #xbets lands on Games, nothing read`);
    chk(!w.__writes.includes('nflhub_admin_v1') && !errs.length, `${tag}: the NFL's record never written; no runtime error: ${errs.join(' | ')}`);
  }
  /* the admin's page on the committed files */
  const XP = readJSON(path.join(DATA, 'xparlays.json')), XB = readJSON(path.join(DATA, 'xbets.json'));
  chk(!!XP && Array.isArray(XP.parlays) && !!XB && XB.weeks && typeof XB.weeks === 'object', 'data/xparlays.json and data/xbets.json in their shapes');
  {
    const errs = [], w = await boot(PUB, errs, { hash: 'xparlays', admin: REC, files: { 'data/xparlays.json': XP, 'data/xbets.json': XB } }), d = w.document;
    const tabs = tabsOf(d);
    chk(d.documentElement.getAttribute('data-admin') === 'on' && tabs.indexOf('xparlays') === tabs.indexOf('parlays') + 1 && tabs.indexOf('xbets') === tabs.indexOf('pickem') + 1 && eqA(tabs, ['games', 'suggest', 'parlays', 'xparlays', 'ratings', 'players', 'pickem', 'xbets']) && !d.querySelector('#hubAdmin').hidden && !d.querySelector('#adminMark').hidden && txt(d.querySelector('#hubAdmin')) === 'Admin' && d.querySelector('#hubAdmin').contains(d.querySelector('#adminMark')), `the admin's page: X Parlays after the Parlay Builder, the X Bet Log after the Pick'em Record and last (the NFL's bar, the owner's two in it), Admin in the header (${tabs.join(',')})`);
    const rq = xReq(w);
    chk(rq.length === 2 && rq.every(r => r.cache === 'no-store' && /\?t=\d+/.test(r.url) && r.method === 'GET'), `both files read once, no-store, a cache-buster each (${rq.map(r => r.url).join(', ')})`);
    chk(!d.querySelector('#tab-xparlays').hidden && d.querySelector('#tab-games').hidden, 'the X Parlays tab opens on the admin\'s page');
    if (!XP.parlays.length) chk(/No parlays yet/.test(txt(d.querySelector('#xpList'))), 'no slip in the file: "No parlays yet."');
    chk(!w.__writes.includes('nflhub_admin_v1') && !errs.length, `the NFL's record never written; no runtime error: ${errs.join(' | ')}`);
  }
  /* planted slips, built from the state's own finals and box scores */
  const today = xEt(PUB), boxed = S.box && S.box.games ? S.box.games : {};
  const fin = S.games.filter(g => g.state === 'final' && g.hs !== null && g.hs !== g.as && boxed[g.id] && g.date >= xAdd(today, -2)).sort((a, b) => a.start < b.start ? -1 : 1);
  const old = S.games.filter(g => g.state === 'final' && g.hs !== null && g.hs !== g.as && g.date < xAdd(today, -2)).pop();
  const toCome = S.games.find(g => g.state === 'pre' && !sStarted(g, PUB));
  if (fin.length < 2 || !old || !toCome) { console.log('  fewer than two boxed finals in the last two days, or none older, or no game to come: the planted slips are not held on this state'); }
  else {
    const [f1, f2] = fin, win = g => g.hs > g.as ? 'home' : 'away', lose = g => g.hs > g.as ? 'away' : 'home';
    const b1 = boxed[f1.id], sk = Object.entries(b1.s || {}).find(([, v]) => Array.isArray(v) && v[0] >= 1) || Object.entries(b1.s || {})[0];
    const scorer = sk ? { pid: sk[0], g: sk[1][0] } : null;
    const nm = id => ((S.players && S.players.players && S.players.players[id]) || {}).name || `Player ${id}`;
    const P0 = [
      { id: 'A', placed: f1.date, stake: 5, price: 264, payout: 18.2, legs: [{ game: f1.id, kind: 'ml', side: win(f1) }].concat(scorer ? [{ game: f1.id, kind: 'prop', pid: scorer.pid, name: nm(scorer.pid), team: f1.home, stat: 'g', side: scorer.g >= 1 ? 'over' : 'under', line: 0.5 }] : []) },
      { id: 'B', placed: f1.date, stake: 2, price: 400, payout: 10, note: 'boost', legs: [{ game: f1.id, kind: 'ml', side: lose(f1) }, { game: f2.id, kind: 'ml', side: win(f2) }] },
      { id: 'C', placed: today, stake: 3, price: -120, payout: 5.5, legs: [{ game: toCome.id, kind: 'ml', side: 'home' }, { game: f2.id, kind: 'ou', side: 'over', line: f2.hs + f2.as - 0.5 }] },
      { id: 'D', placed: f2.date, stake: 1, price: 150, payout: 2.5, legs: [{ game: f2.id, kind: 'prop', pid: '999999901', name: 'Nobody Played', team: f2.home, stat: 's', side: 'over', line: 1.5 }, { game: f2.id, kind: 'ml', side: win(f2) }] },
      { id: 'E', placed: f1.date, stake: 1, price: 100, payout: 2, cleared: true, legs: [{ game: f1.id, kind: 'ml', side: win(f1) }] },
      { id: 'F', placed: old.date, stake: 1, price: 100, payout: 2, legs: [{ game: old.id, kind: 'ml', side: win(old) }] },
      { id: 'G', placed: f1.date, stake: 1, price: 100, payout: 2, legs: [{ game: f1.id, kind: 'zz', side: 'home' }] },
    ].concat(scorer && scorer.g >= 1 ? [{ id: 'H', placed: f1.date, stake: 1, price: 120, payout: 2.2, legs: [{ game: f1.id, kind: 'prop', pid: scorer.pid, name: nm(scorer.pid), team: f1.home, stat: 'g', mk: 'yes', k: 1 }] }] : []);
    const XPp = { parlays: P0 }, XBp = { season: S.season, deposit: 100, weeks: { '2026-10-05': { staked: 10, returned: 8.71 }, '2026-10-12': { staked: 11, returned: 14.66 }, junk: { staked: 1, returned: 'x' } } };
    const want = {};
    for (const p of P0) {
      if (p.cleared || p.legs.some(l => !['ml', 'pl', 'ou', 'prop'].includes(l.kind))) continue;
      const gs = p.legs.map(l => xLegWant(l, S));
      const status = gs.includes('loss') ? 'lost' : gs.includes('pending') ? 'live' : gs.every(x => x === 'void' || x === 'push') ? 'void' : 'landed';
      const last = p.legs.map(l => S.games.find(g => g.id === l.game)).filter(Boolean).sort((a, b) => a.start < b.start ? -1 : 1).pop();
      if (status !== 'live' && last.date < xAdd(today, -2)) continue;
      want[p.id] = { status, gs, voids: gs.filter(x => x === 'void').length };
    }
    const store = JSON.stringify({ ui: {} }), files = { 'data/xparlays.json': XPp, 'data/xbets.json': XBp };
    const errs = [], w = await boot(PUB, errs, { hash: 'xparlays', admin: REC, files, store }), d = w.document;
    const cards = [...d.querySelectorAll('.xp-card')], ids = cards.map(c => c.dataset.xp);
    chk(ids.slice().sort().join() === Object.keys(want).sort().join(), `the slips drawn: every one but the cleared, the junk and the one settled before ${xAdd(today, -2)} (${ids.join(',')}; want ${Object.keys(want).join(',')})`);
    chk(ids[0] === 'C' && /first puck drop/.test(txt(d.querySelector('.xp-day'))) && [...d.querySelectorAll('.xp-day')].some(h => /^Finished/.test(txt(h))), `the live slip first under its day, the settled under Finished (${[...d.querySelectorAll('.xp-day')].map(txt).join(' | ')})`);
    const bad = [];
    for (const c of cards) {
      const p = P0.find(x => x.id === c.dataset.xp), W = want[p.id]; if (!W) continue;
      if (c.dataset.xpState !== W.status) bad.push(`${p.id}: ${c.dataset.xpState}, want ${W.status}`);
      const tags = [...c.querySelectorAll('.xp-head .pill')].map(txt);
      const wantTags = ['placed'].concat(p.note ? [p.note] : [], W.status === 'lost' ? ['lost'] : W.status === 'landed' ? ['landed'] : W.status === 'void' ? ['void'] : [], W.voids && !['lost', 'void'].includes(W.status) ? [`${W.voids} void`] : []);
      if (tags.join('|').toLowerCase() !== wantTags.join('|').toLowerCase()) bad.push(`${p.id}: tags ${tags.join(',')}, want ${wantTags.join(',')}`);
      const money = [...c.querySelectorAll('.xp-money b')].map(txt), wm = [`$${p.stake.toFixed(2)}`, p.price > 0 ? '+' + p.price : String(p.price), `$${p.payout.toFixed(2)}`];
      if (money.join('|') !== wm.join('|')) bad.push(`${p.id}: money ${money.join(',')}, want ${wm.join(',')}`);
      const lis = [...c.querySelectorAll('.xp-legs li')];
      if (lis.length !== p.legs.length) bad.push(`${p.id}: ${lis.length} legs drawn`);
      lis.forEach((li, i) => {
        const gw = W.gs[i], mark = gw === 'win' ? '✓' : gw === 'loss' ? '✗' : gw === 'pending' ? '○' : '–', st = txt(li.querySelector('.xp-st'));
        const word = { win: /^won/, loss: /^lost/, push: /^push/, pending: /^(to play|under way)$/, void: /^void: did not play$/ }[gw];
        if (li.dataset.g !== gw || txt(li.querySelector('.xp-m')) !== mark || !(word && word.test(st))) bad.push(`${p.id} leg ${i + 1}: ${li.dataset.g} "${txt(li.querySelector('.xp-m'))}" "${st}", want ${gw}`);
        const l = p.legs[i]; if (l.kind === 'prop' && !txt(li).includes(l.name)) bad.push(`${p.id} leg ${i + 1}: the player's name is not on it`);
      });
      if (!c.querySelector('button.xp-x[aria-label]') || w.getComputedStyle(c.querySelector('button.xp-x')).minHeight !== '44px') bad.push(`${p.id}: no 44px clear button`);
    }
    chk(!bad.length, `every slip's state, tags, money and legs by this section's own rules (${cards.length} slips; ${bad.slice(0, 3).join(' | ')})`);
    /* the clear on this device, a reload, and Show them again */
    w.__confirm = true; const xb = d.querySelector('.xp-card[data-xp="A"] .xp-x'); xb.click(); await wait(5);
    const stored = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}');
    chk(!d.querySelector('.xp-card[data-xp="A"]') && /You cleared 1 parlay on this device/.test(txt(d.querySelector('.xp-here'))) && /Clear this parlay/.test(w.__asked.slice(-1)[0] || '') && JSON.stringify(stored.ui && stored.ui.xclr) === '["A"]', `the × asks, takes A off this device's tab and stores it (${JSON.stringify(stored.ui && stored.ui.xclr)})`);
    const w2 = await boot(PUB, errs, { hash: 'xparlays', admin: REC, files, store: w.localStorage.getItem('nhl_v1') }), d2 = w2.document;
    chk(!d2.querySelector('.xp-card[data-xp="A"]') && !!d2.querySelector('#xpShowAll'), 'a reload keeps A cleared on this device');
    d2.querySelector('#xpShowAll').click(); await wait(5);
    chk(!!d2.querySelector('.xp-card[data-xp="A"]') && JSON.stringify(JSON.parse(w2.localStorage.getItem('nhl_v1')).ui.xclr) === '[]', 'Show it again brings A back and forgets the clear');
    chk(!w.__writes.includes('nflhub_admin_v1') && !w2.__writes.includes('nflhub_admin_v1') && !errs.length, `the NFL's record never written; no runtime error: ${errs.join(' | ')}`);
    /* the X Bet Log, by its own sums */
    d2.querySelector('#tabs button[data-tab="xbets"]').click(); await wait(5);
    const rows = [['2026-10-05', 10, 8.71], ['2026-10-12', 11, 14.66]];
    let cum = 0; const bal = rows.map(([, st, rt]) => (cum = Math.round((cum + rt - st) * 100) / 100, Math.round((100 + cum) * 100) / 100));
    const net = Math.round(cum * 100) / 100, staked = 21, tiles = [...d2.querySelectorAll('#xbTiles .stat')].map(t => [txt(t.querySelector('.v')), txt(t.querySelector('.k'))]);
    const wantT = [[`$${bal[1].toFixed(2)}`, 'Balance'], [`${net >= 0 ? '+' : '−'}$${Math.abs(net).toFixed(2)}`, 'Net'], [`${net >= 0 ? '+' : '−'}${Math.abs(100 * net / staked).toFixed(1)}%`, 'Return'], ['1 of 2', 'Winning weeks']];
    chk(JSON.stringify(tiles) === JSON.stringify(wantT), `the X Bet Log's tiles by their own sums (${JSON.stringify(tiles)}, want ${JSON.stringify(wantT)})`);
    const tr = [...d2.querySelectorAll('#xbTable tbody tr')].map(r => [r.dataset.k, ...[...r.cells].slice(1).map(txt)]);
    const wantR = rows.map(([k, st, rt], i) => [k, `$${st.toFixed(2)}`, `$${rt.toFixed(2)}`, `${rt - st >= 0 ? '+' : '−'}$${Math.abs(rt - st).toFixed(2)}`, `$${bal[i].toFixed(2)}`]).reverse();
    chk(JSON.stringify(tr) === JSON.stringify(wantR), `the table, the newest week first, the junk week left out (${JSON.stringify(tr)})`);
    const pl = d2.querySelector('#xbChart svg.xb-chart polyline');
    chk(!!pl && pl.getAttribute('data-bal') === bal.join(',') && pl.getAttribute('points').trim().split(/\s+/).length === 3 && d2.querySelector('#xbTable').parentElement.classList.contains('wrap') && d2.querySelector('#xbTable td.sk'), `the chart's balance week by week from the deposit (${pl && pl.getAttribute('data-bal')}), the table in its wrapper, the week held`);
    /* no deposit: the profit; files that do not answer: said so */
    const w3 = await boot(PUB, errs, { hash: 'xbets', admin: REC, files: { 'data/xparlays.json': 404, 'data/xbets.json': Object.assign({}, XBp, { deposit: null }) } }), d3 = w3.document;
    chk(txt(d3.querySelector('#xbTiles .stat .k')) === 'Profit' && txt(d3.querySelector('#xbTiles .stat .v')) === `$${net.toFixed(2)}` && txt(d3.querySelector('#xbChartH')) === 'Profit', 'no deposit on file: the profit from break even');
    d3.querySelector('#tabs button[data-tab="xparlays"]').click(); await wait(5);
    chk(!d3.querySelector('#xpNote').hidden && /could not be read \(HTTP 404\)/.test(txt(d3.querySelector('#xpNote'))), `a file that does not answer is said so (${txt(d3.querySelector('#xpNote'))})`);
    console.log(`  planted slips on ${f1.away}@${f1.home} and ${f2.away}@${f2.home}: ${ids.join(', ')} drawn (${ids.map(i => want[i].status).join(', ')})`);
  }
}
async function pickemChecks() {
  console.log("THE PICK'EM RECORD");
  /* the chart's five colours and the grid's two are tokens with a value in each look, and each line's is 3:1 or more on a card's two grounds */
  { const css = HTML.slice(HTML.indexOf('<style>'), HTML.indexOf('</style>')).replace(/\/\*[\s\S]*?\*\//g, '');
    const blockOf = sel => { const i = css.indexOf(sel + '{'); return i < 0 ? '' : css.slice(i + sel.length + 1, css.indexOf('}', i)); };
    const tok = (b, k) => (new RegExp(`${k}\\s*:\\s*(#[0-9A-Fa-f]{6})\\s*;`).exec(b) || [])[1] || null, low = [];
    for (const [look, b] of [['dark', blockOf(':root')], ['light', blockOf('html[data-theme="light"]')]]) {
      for (const k of ['--m-alpha', '--m-joker', '--m-elom', '--m-call', '--m-base']) for (const g of ['--panel', '--panel-2']) { const c = tok(b, k), s = tok(b, g); if (!c || !s || !(crH(c, s) >= 3)) low.push(`${look} ${k} on ${g}: ${c && s ? crH(c, s).toFixed(2) : 'no token'}`); }
      for (const k of ['--rv-up', '--rv-dn']) if (!tok(b, k)) low.push(`${look} ${k}: no token`);
    }
    chk(!low.length, `the chart's five line colours and the grid's two shades are tokens in both looks, each line 3:1 or more on a card (${low.slice(0, 4).join('; ') || 'all'})`); }
  const D0 = sPkData(S), num = v => typeof v === 'number' && isFinite(v);
  console.log(`  the state: ${D0.fin.length} finals over ${D0.weeks.length} weeks; ${PK_S.map(([id, name]) => `${name} ${D0.rec[id].w}-${D0.rec[id].l}${id === 'dk' ? '' : ` (${sPkSigned(D0.cum[id].length ? D0.cum[id][D0.cum[id].length - 1] : 0)} vs DraftKings)`}`).join(', ')}; the total's average miss ${D0.miss === null ? 'none' : D0.miss.toFixed(2)} over ${D0.missN}`);
  await holdPickem(S, PUB, 'the state', { regrade: true });
  /* copy A: no final yet (every game put back to come), opened by the old #record address */
  { const A = JSON.parse(STATE);
    for (const g of A.games) if (g.state !== 'pre') { g.state = 'pre'; g.hs = null; g.as = null; delete g.result; }
    A.record = sPkRecord(A);
    chk(!sPkData(A).fin.length && A.record.su.w + A.record.su.l === 0 && !Object.keys(A.record.byMonth).length, 'copy A plants a season with no final yet');
    /* and on the state's own day, where it has two games: one whose start the feed moved three hours after the puck drop its frozen call
       was made before, an hour ago (the job's delay rule: its call is kept, "start moved" until the new puck drop), and one whose puck
       drop passed half an hour ago with the feed still saying scheduled ("under way") */
    const isoA = ms => new Date(ms).toISOString().slice(0, 16) + 'Z', onT = A.games.filter(g => g.date === A.today).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    let plantA = null;
    if (onT.length >= 2) { const [gm, gu] = onT; gm.before = isoA(PUB - 3600000); gm.frozen = isoA(PUB - 7200000); gm.start = isoA(PUB + 2 * 3600000); gu.start = isoA(PUB - 1800000); delete gu.before; plantA = A.today;
      chk(delayedAt(gm, gm.start, PUB) && !startedAt(gm, PUB) && startedAt(gu, PUB) && !delayedAt(gu, gu.start, PUB), `copy A plants on ${A.today} a start moved after its puck drop (${gm.id}) and a puck drop passed with the feed saying scheduled (${gu.id})`); }
    else console.log(`  copy A: ${A.today} has ${onT.length} games, so no moved start or passed puck drop is planted`);
    await holdPickem(A, PUB, 'copy A (no final yet)', { hash: 'record', how: 'the old #record address', days: plantA ? [plantA] : [] }); }
  /* copy B: a season of one month (the latest with a final, else the schedule's first; finals made up where it has under nine), opened by a
     stored Record tab, planting: a final with no line (DraftKings picks nothing, so it counts in neither DraftKings' season nor against it,
     nor in the total's miss), one whose club ratings part from the call, one priced level (DraftKings picks the home side), a model's own
     frozen call beside a backtest of the same game (the call is the one counted), a final with neither, one called by its backtest alone
     (marked bt), a total and a puck line landing on their numbers (two pushes), no HIGH pick at all, a pick at 54.51%, which a row
     writes as 55%: a LOW pick, and (the review of nhl v30) an away pick at pHome exactly 0.455, 55% and LOW as a home pick at 0.545 is,
     though 1 - 0.455 is 0.54499999... in floating point. Every final graded again, and the record made from the grades */
  { const C = JSON.parse(STATE), moOf = g => g.date.slice(0, 7), callable = g => num(g.pHome) && (g.pick === 'home' || g.pick === 'away'), over = g => g.state === 'final' && num(g.hs) && num(g.as) && g.hs !== g.as;
    const had = C.games.filter(over), M = had.length ? had.map(moOf).sort().pop() : (C.games.map(moOf).sort()[0] || null);
    const inM = M ? C.games.filter(g => moOf(g) === M && callable(g)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start)) : [];
    if (inM.length < 9) console.log(`  copy B skipped: ${M ? `${M} has ${inM.length} games with a call` : 'no game on the schedule'}, and it plants on nine finals`);
    else {
      for (const g of C.games) if (moOf(g) !== M && g.state !== 'pre') { g.state = 'pre'; g.hs = null; g.as = null; delete g.result; }
      const f = inM.filter(over);
      for (let i = 0; f.length < 9 && i < inM.length; i++) { const g = inM[i]; if (f.includes(g)) continue; const a0 = 1 + ((i + 1) % 4); g.state = 'final'; g.hs = 2 + (i % 3); g.as = a0 === g.hs ? a0 + 1 : a0; f.push(g); }
      f.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
      f[0].line = null; for (const k of ['mlPick', 'plPick', 'ouPick']) delete f[0][k];
      f[1].by = 'players'; f[1].elo = Object.assign({}, f[1].elo || {}, { pHome: f[1].pick === 'home' ? 0.41 : 0.59 });
      f[2].line = Object.assign({ total: null, homeLine: null }, f[2].line || {}, { homeML: -110, awayML: -110 });
      const was3 = ['alpha', 'joker', 'elom'].map(id => sPkPick(f[3], id, C));
      f[3].models = { v: 'planted', alpha: { pHome: was3[0] === 'home' ? 0.3 : 0.7, mu: 0 }, joker: { pHome: was3[1] === 'home' ? 0.3 : 0.7 }, elo: { pHome: was3[2] === 'home' ? 0.3 : 0.7, m: 0 } };
      C.models = C.models || {}; C.models.backtest = C.models.backtest || {}; C.models.backtest.games = C.models.backtest.games || {};
      C.models.backtest.games[f[3].id] = { alpha: { pHome: was3[0] === 'home' ? 0.7 : 0.3, mu: 0 }, joker: { pHome: was3[1] === 'home' ? 0.7 : 0.3 }, elo: { pHome: was3[2] === 'home' ? 0.7 : 0.3, m: 0 } };
      delete f[4].models; delete C.models.backtest.games[f[4].id];
      delete f[8].models; C.models.backtest.games[f[8].id] = { alpha: { pHome: 0.7, mu: 0.3 }, joker: { pHome: 0.3 }, elo: { pHome: 0.7, m: 0.2 } };
      f[5].line = Object.assign({ homeML: -120, awayML: 100, homeLine: null }, f[5].line || {}, { total: f[5].hs + f[5].as }); f[5].ouPick = 'over';
      f[6].line = Object.assign({ homeML: -120, awayML: 100, total: null }, f[6].line || {}, { homeLine: f[6].as - f[6].hs }); f[6].plPick = 'home';
      for (const g of C.games) if (g.state === 'final' && sPkConf(g) >= 65) g.pHome = g.pick === 'home' || (g.pick !== 'away' && g.pHome >= 0.5) ? 0.62 : 0.38;
      f[7].pHome = f[7].pick === 'home' ? 0.5451 : 0.4549;
      f[4].pHome = 0.455; f[4].pick = 'away';
      for (const g of C.games) { const r = sPkGrade(g); if (r) g.result = r; else delete g.result; }
      C.record = sPkRecord(C);
      const D = sPkData(C), Bb = sPkBands(C);
      chk(sPkPick(f[0], 'dk', C) === null && sPkPick(f[1], 'elo', C) !== sPkPick(f[1], 'call', C) && sPkPick(f[2], 'dk', C) === 'home' && ['alpha', 'joker', 'elom'].every((id, i) => sPkPick(f[3], id, C) !== was3[i] && !sPkModel(f[3], id, C).bt && !sPkPick(f[4], id, C) && sPkModel(f[8], id, C).bt)
        && sPkPick(f[8], 'alpha', C) === 'home' && sPkPick(f[8], 'joker', C) === 'away'
        && C.record.ou.p >= 1 && C.record.pl.p >= 1 && Bb.high.w + Bb.high.l === 0 && Bb.low.w + Bb.low.l >= 2 && sPkConf(f[7]) === 55 && sPkConf(f[4]) === 55 && f[4].pick === 'away' && D.fin.length >= 9 && D.fin.every(g => moOf(g) === M) && Object.keys(C.record.byMonth).length === new Set(D.fin.map(g => g.type === 3 ? 'playoffs' : M)).size,
        `copy B plants one month of finals (${M}) with an unlined final, the two ratings parting, a level price, a model's own call over a backtest of the same game, a final with neither, one called by its backtest alone, two pushes, no HIGH pick, a 54.51% pick and an away pick at pHome 0.455, both LOW 55%`);
      console.log(`  copy B: ${D.fin.length} finals in ${M}; the record ${sPkRecStr(C.record).slice(0, 110)}`);
      /* copy B on a visitor's clock in Los Angeles (the second review of nhl v30: days and weeks named from a date read at midnight UTC and
         written on the visitor's clock, the day before for any American visitor, passed on this machine's UTC, as on GitHub's runners).
         Node takes a new TZ at once, and the page's Date with it; put back as it was after */
      const tz0 = process.env.TZ, probe = Date.UTC(2026, 0, 15, 12), off0 = new Date(probe).getTimezoneOffset();
      process.env.TZ = 'America/Los_Angeles';
      try {
        chk(new Date(probe).getHours() === 4 && new Date(probe).getTimezoneOffset() === 480, `copy B runs on a clock in Los Angeles (noon UTC on 15 January reads ${new Date(probe).getHours()}:00 there)`);
        await holdPickem(C, PUB, 'copy B (one month, the planted finals; a visitor in Los Angeles)', { store: JSON.stringify({ ui: { tab: 'record' } }), how: 'a stored Record tab', days: [f[3].date, f[8].date], laProbe: probe });
      } finally { if (tz0 === undefined) delete process.env.TZ; else process.env.TZ = tz0; }
      chk(new Date(probe).getTimezoneOffset() === off0, `and the clock put back as it was for the rest of the run (${process.env.TZ || 'the machine\'s own'}: offset ${new Date(probe).getTimezoneOffset()} minutes, was ${off0})`);
    } }
  /* copy C: one week of finals, at most four of them (the second review of nhl v30: the axis's step for lines spanning 8 games or fewer,
     a figure every game, was never drawn by the state or copies A and B, so doubling it passed): the latest week with a final, its first
     four finals kept and every other final put back to come, so no line can stand more than four games off DraftKings and the axis runs
     −4 to +4 at most, a figure a game; one week, so a dot at the start and one at the week's end */
  { const C3 = JSON.parse(STATE), fin3 = C3.games.filter(g => g.state === 'final' && num(g.hs) && num(g.as) && g.hs !== g.as).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    if (!fin3.length) console.log("  copy C skipped: the state has no final, so no week to keep");
    else {
      const wk = sPkWeek(fin3[fin3.length - 1].date), keep = new Set(fin3.filter(g => sPkWeek(g.date) === wk).slice(0, 4).map(g => g.id));
      for (const g of C3.games) if (g.state !== 'pre' && !keep.has(g.id)) { g.state = 'pre'; g.hs = null; g.as = null; delete g.result; }
      C3.record = sPkRecord(C3);
      const D3 = sPkData(C3), all3 = PK_S.filter(([id]) => id !== 'dk').flatMap(([id]) => D3.cum[id]), span3 = Math.max(3, ...all3) - Math.min(-3, ...all3);
      chk(D3.weeks.length === 1 && D3.fin.length === keep.size && keep.size >= 1 && span3 <= 8, `copy C plants one week of finals (${wk}, ${keep.size} of them), its lines spanning ${span3} games: a figure a game on the axis`);
      await holdPickem(C3, PUB, 'copy C (one week of finals)', {});
    } }
}

/* the level rule on planted pools (nhl v31): the page's pbLevel against this smoke's own search and against answers worked out by
   hand, one pool a rule: a tie in the chance going to fewer legs, then to the larger product of the other chance, then to the lower
   leg ids; the tie window relative (an absolute 1e-9 calls chances of 9e-4 that differ by a third of a millionth equal); the pays test
   (1.5 x 1.4 is 2.0999999999999996, which pays +110, and a pair a cent under $2.10 does not); the cap of 12 legs (twelve legs of 1.2
   pay +700 and eleven do not; fourteen of 1.17 pay and thirteen do not); one leg a game */
async function sPlantedPools() {
  const errs = [], w = await boot(PUB, errs, { hash: 'suggest' });
  try {
    let t0 = Date.parse('2026-11-13T00:00:00Z');
    const amOf = dec => dec >= 2 ? Math.round((dec - 1) * 100) : -Math.round(100 / (dec - 1));
    const L = (game, p, fair, dec, side) => ({ id: `${game}|${side || 'home'}|ml`, game, kind: 'ml', side: side || 'home', p, fair, dec, price: amOf(dec), start: new Date(t0 + 60000 * (parseInt(game.slice(1), 10) || 0)).toISOString(), mu: `${game} @ X` });
    const G = n => `G${String(n).padStart(2, '0')}`;
    const pools = [
      /* the 3 legs G02, G03, G04 tie the pair on the chance (0.3) and have the larger fair product, so only the rule of fewer legs picks the pair */
      ['a tie in the chance goes to fewer legs', 4, [L('G01', 0.6, 0.4, 2.0), L('G02', 0.5, 0.4, 2.4), L('G03', 0.8, 0.79, 1.25), L('G04', 0.75, 0.74, 1.4)], ['G01|home|ml', 'G02|home|ml']],
      ['then to the larger product of the other chance', 4, [L('G01', 0.6, 0.5, 2.1), L('G02', 0.5, 0.45, 2.0), L('G03', 0.5, 0.48, 2.0)], ['G01|home|ml', 'G03|home|ml']],
      ['then to the lower leg ids', 4, [L('G01', 0.6, 0.5, 2.1), L('G02', 0.5, 0.45, 2.0), L('G03', 0.5, 0.45, 2.0)], ['G01|home|ml', 'G02|home|ml']],
      ['the tie window is relative', 2.1, [L('G01', 0.03, 0.6, 50), L('G02', 0.03, 0.5, 50), L('G03', 0.03000001, 0.4, 50)], ['G01|home|ml', 'G03|home|ml']],
      ['1.5 x 1.4 pays +110', 2.1, [L('G01', 0.7, 0.6, 1.5), L('G02', 0.7, 0.62, 1.4), L('G03', 0.3, 0.25, 3)], ['G01|home|ml', 'G02|home|ml']],
      ['a pair a cent under $2.10 does not pay +110', 2.1, [L('G01', 0.7, 0.6, 1.5), L('G02', 0.69, 0.62, 1 + 100 / 254), L('G03', 0.3, 0.25, 3)], ['G01|home|ml', 'G03|home|ml']],
      ['twelve legs at the most: twelve of 1.2 pay +700', 8, Array.from({ length: 13 }, (_, i) => L(G(i + 1), 0.9, 0.8, 1.2)), Array.from({ length: 12 }, (_, i) => `${G(i + 1)}|home|ml`)],
      /* 1.18 to the 12th is 7.29, under 8; to the 13th 8.60: a cap of 13 would take 13 legs here */
      ['twelve legs at the most: none of 1.18 pays +700', 8, Array.from({ length: 14 }, (_, i) => L(G(i + 1), 0.9, 0.8, 1.18)), null],
      ['one leg a game', 2.1, [L('G01', 0.8, 0.7, 1.6), L('G01', 0.79, 0.7, 1.62, 'away'), L('G02', 0.3, 0.25, 3)], ['G01|home|ml', 'G02|home|ml']],
      /* a team leg and a player's line of one game: the two of them would be the likeliest (0.48 at 2.2), but one leg a game takes
         G01's moneyline with G02's (0.36 at 3.68) */
      ['one leg a game, a team leg and a player line alike', 2.1, [L('G01', 0.8, 0.7, 1.6), Object.assign(L('G01', 0.6, 0.55, 1.375), { id: 'G01|prop|900001|pts|under|0.5', kind: 'prop', prop: { pid: '900001', stat: 'pts', side: 'under', line: 0.5 } }), L('G02', 0.45, 0.4, 2.3)], ['G01|home|ml', 'G02|home|ml']],
    ];
    for (const [what, minDec, legs, want] of pools) {
      const got = JSON.parse(w.eval(`JSON.stringify(pbLevel(${JSON.stringify(legs)}, ${minDec}))`)), mine = sLevel(legs, minDec);
      const ids = got ? got.legs.map(x => x.id) : null, mineIds = mine ? mine.legs.map(x => x.id) : null;
      chk(JSON.stringify(ids) === JSON.stringify(want) && JSON.stringify(mineIds) === JSON.stringify(want) && (!got || (got.pick === S_PICK && got.minDec === minDec && got.chance === S_CHANCE && got.dec >= minDec * (1 - S_TIE))),
        `the level rule on a planted pool: ${what} (page ${ids ? ids.join(', ') : 'none'}; this smoke's search ${mineIds ? mineIds.join(', ') : 'none'}; by hand ${want ? want.join(', ') : 'none'})`);
    }
    chk(!errs.length, `no runtime error on the planted pools: ${errs.join(' | ')}`);
  } finally { w.close(); }
}
async function suggestRecord() {
  console.log("THE SUGGESTED PARLAYS' RECORD");
  await sPlantedPools();
  const SG = require('./suggest'), file = process.env.NHL_SUGGEST || path.join(DATA, 'suggest_ledger.json');      // NHL_SUGGEST: simulate.js's own
  if (!fs.existsSync(file)) { chk(!S.suggest, `no ledger and no record in the state (${JSON.stringify(S.suggest)})`); console.log('  no ledger: its checks skipped'); return; }
  const L = SG.readLedger(file);
  const prev = process.env.NHL_PREV_SUGGEST ? (process.env.NHL_PREV_SUGGEST === 'none' ? null : readJSON(process.env.NHL_PREV_SUGGEST))
    : process.env.NHL_STATE ? null : (() => { try { return JSON.parse(execFileSync('git', ['show', 'HEAD:data/suggest_ledger.json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { return null; } })();
  const bad = SG.check(L, prev, S, PUB);
  for (const b of bad) chk(false, `the record's ledger: ${b}`);
  chk(!bad.length, `the record's ledger holds to its rules${prev ? ' and the last commit\'s' : ''} (${Object.keys(L.days).length} days)`);
  /* a state an older job published, before the record began, carries none; once one has, every state after it does */
  if (S.suggest === undefined) {
    chk(!(PREV && PREV.suggest !== undefined), 'the record is in every state after the first that carried it');
    console.log('  the state predates the record (an older job published it): the record\'s state and page checks skipped'); return;
  }
  const sumOnly = Object.assign({}, S.suggest); delete sumOnly.sets;
  /* the summary with each rule's days apart (nhl v31: each level's eras, and the change of rule): a state an older job published carries
     neither, and is held to the summary without them; once one has, every state after it does */
  const withEras = !!(S.suggest.tiers && Object.values(S.suggest.tiers).every(t => t && t.eras !== undefined)), wantSum = SG.summarize(L, S.season);
  if (!withEras) { for (const t of Object.values(wantSum.tiers)) delete t.eras; delete wantSum.change;
    chk(!(PREV && PREV.suggest && PREV.suggest.tiers && Object.values(PREV.suggest.tiers).some(t => t && t.eras !== undefined)), 'the record\'s eras are in every state after the first that carried them');
    console.log('  the record\'s summary is an older job\'s (no eras): held without them'); }
  chk(JSON.stringify(sumOnly) === JSON.stringify(wantSum), `the state's record is the ledger's summary (${JSON.stringify(S.suggest && S.suggest.tiers && S.suggest.tiers.safe).slice(0, 400)})`);
  /* the days the Suggested Parlays tab draws once they lock (nhl v17): the ledger's entries from the day before the publish's on, exactly;
     a state an older job published carries none, and once one has, every state after it does */
  if (S.suggest && S.suggest.sets !== undefined) chk(JSON.stringify(S.suggest.sets) === JSON.stringify(SG.current(L, PUB)), `the state's suggest.sets are the ledger's entries from the day before the publish on (${Object.keys(S.suggest.sets).join(', ')}; the ledger's ${Object.keys(SG.current(L, PUB)).join(', ')})`);
  else chk(!(PREV && PREV.suggest && PREV.suggest.sets !== undefined), 'the record\'s sets are in every state after the first that carried them');
  /* the days still to lock with a line read at the publish */
  const first = SG.daysOf(S), pubMin = Math.floor(PUB / 60000);
  /* a day locked already is the last commit's ledger's to hold (SG.check), whatever its first puck drop reads now (a game postponed or moved) */
  const lined = [...new Set(S.games.filter(g => g.line && g.line.at && Math.floor(Date.parse(g.line.at) / 60000) === pubMin).map(g => g.date))].filter(d => first[d] > PUB && !(L.days[d] && Date.parse(L.days[d].lock) <= PUB)).sort();
  const errs = [], w = await boot(PUB, errs, { hash: 'suggest', keepDk: true }), d = w.document;      // as the job's page boots: the state as published, its player lines read
  /* a ledger whose header is still the v30 rule's was written by an older job, whose page took the open days by that rule: this page's
     levels on them are held once the job runs it (and the record's check holds those days to their own rule meanwhile) */
  const olderJob = JSON.stringify(L.tiers) === JSON.stringify(SG.TIERS_V30);
  if (olderJob) console.log(`  the ledger is an older job's (its header the v30 rule's): ${lined.join(', ') || 'no day'} taken by that rule, held by the record's check alone`);
  for (const day of lined) {
    const want = SG.setOf(w, day), e = L.days[day];
    if (!want.games.length) { chk(!e, `${day}: no game to come with a fresh line in the page, no entry`); continue; }
    if (olderJob) { chk(!!e && e.lock === new Date(first[day]).toISOString() && SG.ruleOfEntry(e) !== 'new', `${day}: taken by the older job, to lock at its first puck drop (${e ? e.lock : 'no entry'})`); continue; }
    chk(!!e && e.lock === new Date(first[day]).toISOString() && JSON.stringify([e.games, e.tiers]) === JSON.stringify([want.games, want.tiers]),
      `${day}: taken, to lock at its first puck drop ${new Date(first[day]).toISOString()}, the page's own levels at the publish (${e ? e.lock : 'no entry'})`);
    /* this smoke's own search on the day's default pool, worked out here: each level the likeliest paying its price, carrying its rule */
    const readsS = {}; for (const [gid, x] of Object.entries((S.props && S.props.games) || {})) { const r = dkSeed(x && x.dk); if (r) readsS[gid] = r; }      // what the job's page booted on
    const pool = sPool({ games: S.games.filter(g => g.date === day && !sStarted(g, PUB)) }, S_KINDS, [], readsS);
    for (const [id, label, , , minDec] of TIERS) {
      const b = sLevel(pool.legs, minDec), t = e && e.tiers[id];
      chk(b ? !!t && JSON.stringify(t.legs.map(x => x.id)) === JSON.stringify(b.legs.map(x => x.id)) && Math.abs(t.p - b.p) < 1e-4 && Math.abs(t.dec - b.d) < 1e-3 && t.pick === S_PICK && t.minDec === minDec && t.chance === S_CHANCE && t.dec >= minDec * (1 - S_TIE) : !t,
        `${day} ${label}: the record's level is this smoke's search's, the likeliest paying ${PBS.toAm(minDec)} or more, with its rule (${t ? `${t.legs.map(x => x.id).join(', ')} ${SG.ruleKey(t)}` : 'none'}; the search ${b ? b.legs.map(x => x.id).join(', ') : 'none'})`);
    }
  }
  /* an entry still to lock is a day with a line read at the publish (held above), or one with none read now whose set an earlier run took */
  for (const [day, e] of Object.entries(L.days)) if (Date.parse(e.lock) > PUB && !lined.includes(day))
    chk(first[day] > PUB && Date.parse(e.taken) < PUB && !S.games.some(g => g.date === day && g.line && g.line.at && Math.floor(Date.parse(g.line.at) / 60000) === pubMin), `${day}: an entry still to lock with no line read at the publish was taken by an earlier run (${e.taken})`);
  /* the record row, worked out here from the state */
  const R = S.suggest, rec = d.getElementById('pbRec');
  if (!R) chk(!!rec && rec.hidden && !rec.innerHTML, 'no record in the state: no record row');
  else {
    const un = v => { const r = Math.round(v * 100) / 100; return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(2); }, f1 = v => v.toFixed(1), pl = (n, x) => `${n} ${x}${n === 1 ? '' : x === 'push' ? 'es' : 's'}`;
    const any = TIERS.some(([id]) => R.tiers[id].graded || R.tiers[id].push);
    const want = ['Record'].concat(any ? TIERS.map(([id, label]) => { const t = R.tiers[id]; return `${label} ${t.won}–${t.lost}${t.graded || t.push ? ` ${un(t.units)} units` : ''}`; }) : ['None graded yet']).concat(R.pending ? [`Pending ${R.pending}`] : []);
    const got = [...rec.children].map(txt);
    chk(rec.firstElementChild && rec.firstElementChild.tagName === 'H3', `the record's heading is an h3, as the days' (${rec.firstElementChild && rec.firstElementChild.tagName})`);
    /* the NFL hub's order (nhl v22): the heading, the odds bar, the record, the days' sets */
    const sibs = rec.parentElement ? [...rec.parentElement.children] : [], at = q => sibs.indexOf(d.querySelector(q));
    chk(!rec.hidden && rec.closest('#spPanel') && at('#spPanel .pb-hd') === 0 && at('#spPanel .pb-hd') < at('#spPanel .sp-odds') && at('#spPanel .sp-odds') < at('#pbRec') && at('#pbRec') < at('#spBody') && JSON.stringify(got) === JSON.stringify(want),
      `the Suggested Parlays tab's record row under its heading and odds bar, pill by pill: ${got.join(' | ')} (want ${want.join(' | ')})`);
    /* each pill's title: its whole record, then (nhl v31) each rule's own where the level has had one before today's, worked out here
       from the ledger's own days (a state an older job published carries no eras: none said) */
    const eras = sEras(L, S.season);
    if (any) for (const [id, label, , , minDec] of TIERS) {
      const t = R.tiers[id], el = rec.querySelector(`[data-pb-rec="${id}"]`);
      const title = sRecTitle(id, label, minDec, t, R.since, withEras ? eras[id] : null);
      chk(!!el && el.getAttribute('title') === title, `${label}'s pill says its record in its title: ${el && el.getAttribute('title')}`);
      if (withEras) chk(canon(t.eras) === canon(eras[id]), `${label}'s eras in the state are the ledger's days by this smoke's own sums (${JSON.stringify(t.eras).slice(0, 300)})`);
    }
    /* the figures by the ledger's own days, worked out here: won, lost and units on 1 a day */
    for (const [id, label] of TIERS) {
      let won = 0, lost = 0, units = 0;
      for (const [day, e] of Object.entries(L.days)) { if (SG.seasonOf(day) !== S.season || !e.grade || !e.grade[id]) continue; const g = e.grade[id]; if (g.result === 'won') { won++; units += g.payout - 1; } else if (g.result === 'lost') { lost++; units -= 1; } }
      chk(R.tiers[id].won === won && R.tiers[id].lost === lost && Math.abs(R.tiers[id].units - units) < 1e-3, `${label}: ${won}-${lost}, ${units.toFixed(2)} units by the ledger's days (${R.tiers[id].won}-${R.tiers[id].lost}, ${R.tiers[id].units})`);
    }
  }
  chk(!errs.length, 'no runtime error drawing the record: ' + errs.join(' | '));
  /* the locked sets on the Suggested Parlays tab, on a copy carrying the ledger's current sets (the job's state does from nhl v17 on): the
     latest day before the publish's whose games are all final, seen that evening (Graded, every leg and level graded on the scores), and
     the publish's own day at its first puck drop (Locked since) */
  {
    const M = JSON.parse(STATE); if (!M.suggest) M.suggest = SG.summarize(L, S.season);
    M.suggest.sets = SG.current(L, PUB);
    const real = S; S = M;
    try {
      /* the pills' titles with two eras planted (the earlier rule's and today's), and the change of rule's line: said by the publish's date
         for seven days from the publish that first carried it, gone on the seventh */
      { const P = JSON.parse(JSON.stringify(M)), at0 = Date.parse(P.published);
        for (const [id, , , , minDec] of TIERS) { const t = P.suggest.tiers[id];
          /* the level's whole record the two eras', so its pill is drawn whatever the record held (an invented season's may hold none) */
          Object.assign(t, { graded: 27, won: 5, lost: 22, push: 1, units: -0.5555, exp_model: 7.59, exp_fair: 4.2, fair_n: 27 });
          t.eras = { v30: { from: '2026-10-13', to: '2026-11-12', graded: 25, won: 4, lost: 21, push: 1, units: -2.5555, exp_model: 6.79, exp_fair: 3.7 },
            [`${S_PICK} ${minDec} ${S_CHANCE}`]: { from: '2026-11-13', to: '2026-11-14', graded: 2, won: 1, lost: 1, push: 0, units: 2, exp_model: 0.8, exp_fair: 0.5 } }; }
        for (const [days, shown] of [[6, true], [7, false]]) {
          P.suggest.change = { at: new Date(at0 - days * 86400000).toISOString(), from: '2026-11-13' }; S = P;
          const e5 = [], w5 = await boot(PUB, e5, { state: JSON.stringify(P), hash: 'suggest' }), d5 = w5.document;
          if (shown) holdSuggest(w5, PUB, `the change of rule said ${days} days on`);
          const ch5 = d5.getElementById('spChange');
          chk(ch5.hidden === !shown && (!shown || txt(ch5) === "From Nov 13 each level is the likeliest parlay paying +110, +300 or +700 or more; each pill's title keeps the earlier levels apart."), `the change of rule's line ${shown ? 'shows' : 'is gone'} ${days} days after the publish that first carried it (${ch5.hidden ? 'hidden' : txt(ch5)})`);
          if (shown) for (const [id, label, , , minDec] of TIERS) {
            const el = d5.querySelector(`#pbRec [data-pb-rec="${id}"]`), t = P.suggest.tiers[id], want = sRecTitle(id, label, minDec, t, P.suggest.since, t.eras);
            chk(!!el && el.getAttribute('title') === want && /under the earlier rule/.test(want) && / since Nov 13 \(likeliest paying /.test(want), `${label}'s pill splits its eras in its title: ${el && el.getAttribute('title')}`);
          }
          chk(!e5.length, `no runtime error with the eras planted: ${e5.join(' | ')}`); w5.close();
        }
        S = M; }
      const today = etDate(PUB), sets = Object.keys(M.suggest.sets).sort(), clocks = [];
      const past = sets.filter(dd => dd < today && S.games.some(g => g.date === dd) && S.games.filter(g => g.date === dd).every(g => g.state === 'final')).pop();
      if (past) { const ms = Math.max(...S.games.filter(g => g.date === past).map(g => Date.parse(g.start))) + 60000; if (etDate(ms) === past) clocks.push([ms, `${past}, its games final`]); }
      const tl = sDayLock(today); if (M.suggest.sets[today] && isFinite(tl) && tl > PUB) clocks.push([tl + 60000, `${today} at its first puck drop`]);
      for (const [ms, tag] of clocks) {
        const e2 = [], w2 = await boot(ms, e2, { state: JSON.stringify(M), hash: 'suggest' });
        const H = holdSuggest(w2, ms, `the locked sets, ${tag}`), dd = tag.slice(0, 10);
        chk(!!H[dd] && H[dd].open === false && !!H[dd].entry, `${tag}: the day is drawn locked from the record (${H[dd] ? (H[dd].open ? 'open' : H[dd].entry ? 'the record\'s set' : 'no set') : 'not shown'})`);
        chk(!e2.length, `${tag}: no runtime error drawing a locked set: ${e2.join(' | ')}`);
        console.log(`  the locked sets drawn on ${tag}: ${dd} ${H[dd] ? (H[dd].open ? 'open' : 'locked, the record\'s set') : 'not shown'}`);
      }
      if (!clocks.length) console.log('  no locked day to draw on this state: the locked sets are held where the record has one');
      /* the publish's day, its first game taken off the schedule (postponed) after the record locked it: the day stays locked on the
         record's set, never reopened on the games left with levels the record will never take */
      if (M.suggest.sets[today] && isFinite(tl) && tl > PUB) {
        const M2 = JSON.parse(JSON.stringify(M)), firstG = M2.games.filter(g => g.date === today).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
        M2.games = M2.games.filter(g => g !== firstG);
        S = M2;
        const ms = tl + 60000;
        if (S.games.some(g => g.date === today) && sDayLock(today) > ms) {
          const e3 = [], w3 = await boot(ms, e3, { state: JSON.stringify(M2), hash: 'suggest' }), H3 = holdSuggest(w3, ms, `${today}, its first game postponed after the record locked it`);
          chk(!!H3[today] && H3[today].open === false && !!H3[today].entry, `a day the record has locked stays locked when its first game is postponed after (${H3[today] ? (H3[today].open ? 'reopened' : 'locked') : 'not shown'})`);
          chk(!e3.length, `no runtime error on a postponed opener: ${e3.join(' | ')}`);
        } else console.log(`  ${today} has no game after its first: a postponed opener is not held here`);
        S = M;
      }
    } finally { S = real; }
  }
  console.log(`  ${Object.keys(L.days).length} days in the ledger, ${lined.length} still to lock with a fresh line; ` + (R ? TIERS.map(([id, label]) => `${label} ${R.tiers[id].won}-${R.tiers[id].lost}`).join(', ') : 'no record'));
}

async function main() {
  const errors = [];
  reality();
  /* the page at the moment it was published */
  const w = await boot(PUB + 60000, errors), d = w.document;
  const $ = id => d.getElementById(id);
  chk(errors.length === 0, 'runtime errors: ' + errors.join(' | '));
  /* the header (nhl v25), the NFL hub's: the wordmark, when the job published and the build, the tabs' words; nothing else in it (no
     tagline, no season or record line, no count on a tab). What shows is read here: a hidden element's words (the Admin mark on a
     visitor's page) are not in the header a visitor reads */
  const seen = el => { let t = ''; const walk = n => { if (n.nodeType === 3) t += n.nodeValue; else if (n.nodeType === 1 && !n.hidden) for (const c of n.childNodes) walk(c); }; walk(el); return t.replace(/\s+/g, ' ').trim(); };
  const stampW = 'Updated ' + new Date(S.published).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  chk(txt($('stamp')) === stampW && !$('stamp').classList.contains('bad'), `the header's stamp says when the job published, in the visitor's clock, its zone named ("${stampW}": ${txt($('stamp'))})`);
  const h1 = d.querySelector('header h1'), hdrW = ['X NHL Bets', stampW, txt($('buildTag'))].concat([...d.querySelectorAll('#tabs button')].map(txt)).join('');
  chk(!!h1 && txt(h1) === 'X NHL Bets' && h1.children.length === 1 && h1.firstElementChild.tagName === 'EM' && txt(h1.firstElementChild) === 'Bets', `the wordmark is X NHL Bets, its last word the accent's (${h1 && h1.innerHTML})`);
  chk(!d.querySelector('.tagline') && !d.querySelector('header p') && seen(d.querySelector('header')).replace(/\s+/g, '') === hdrW.replace(/\s+/g, ''), `the header holds the wordmark, the stamp, the build tag and the tabs' words, nothing else: no tagline, no description (${seen(d.querySelector('header')).slice(0, 200)})`);
  chk(!d.querySelector('meta[name="description"]') && !d.querySelector('.rink') && !d.querySelector('footer'), 'no description in the head, no footer, the rink lines drawn by the body');
  chk(txt($('buildTag')).startsWith('nhl v'), 'build tag on the header');

  /* Games: the Day select with one day shown, a row a game that day, the two chances on each adding to 100 (THE GAMES LIST holds the rest) */
  const days = dayList(d), onDay = $('daySel').value;
  chk(days.length >= 1 && days.includes(onDay), `the Day select lists the days and shows one of them (${days.length}; ${onDay})`);
  const todayOpt = [...d.querySelectorAll('#daySel option')].find(o => /^Today, /.test(txt(o)));
  if (todayOpt) chk(todayOpt.value === etDate(PUB + 60000), `"Today" in the select is the visitor's day ${etDate(PUB + 60000)}, not ${todayOpt.value}`);
  const dayGames = S.games.filter(g => g.date === onDay);
  let cards = d.querySelectorAll('#gamesList .game');
  chk(cards.length === dayGames.length, `the day shown has ${dayGames.length} games, not ${cards.length}`);
  const withGames = days.find(dd => dd !== onDay && S.games.some(g => g.date === dd));
  if (withGames) {
    openDay(d, withGames);
    const n = S.games.filter(g => g.date === withGames).length;
    chk(d.querySelectorAll('#gamesList .game').length === n, `choosing a day shows its ${n} games`);
  }
  cards = d.querySelectorAll('#gamesList .game');
  const MAP0 = pageMap(w);
  for (const c of cards) {
    const m = /(\d+)%, \S+ (\d+)%$/.exec((c.querySelector('.sl-probrow') && c.querySelector('.sl-probrow').getAttribute('aria-label')) || ''), wps = m ? [+m[1], +m[2]] : [];
    chk(wps.length === 2 && wps[0] + wps[1] === 100, 'the two chances on a row add to 100: ' + wps.join('+'));
    const g = S.games.find(x => x.id === c.dataset.game);
    /* the row, worked out here cell by cell (THE GAMES LIST) */
    if (g) { const bad = rowWrongs(w, c, g, PUB + 60000, MAP0, null); chk(!bad.length, `${g.id}: the row is the state's (${bad.slice(0, 3).join(' | ')})`); }
    if (g && g.state === 'live') chk(/ · as of /.test(txt(c.querySelector('.sl-result'))), `a live score the job published says when it was read: ${g.id}`);
    if (g && startedAt(g, PUB + 60000)) { const pb = betsOn(d, g); chk(!!pb && !d.querySelector('#gameView input[data-leg], #gameView input[data-pp-add]'), `no bet offered on the page of a game that has started: ${g.id}`); closeBets(d); }
  }
  /* a game whose start the feed moved after its puck drop keeps the call made before it: its day shown,
     the page offers no bet, and its row and its page say why */
  for (const g of S.games.filter(g => !startedAt(g, PUB + 60000) && delayedAt(g, g.start, PUB + 60000))) {
    if (!openDay(d, g.date)) continue;
    const c = cardOf(d, g.id), said = c && txt(c.querySelector('.sl-result'));
    const pbM = c && betsOn(d, g);
    chk(c && !!pbM && !d.querySelector('#gameView input[data-leg], #gameView input[data-pp-add]') && /start moved · call kept/.test(said) && c.classList.contains('locked') && /start moved · call kept/.test(txt(d.querySelector('#gameView .ghead .when'))), `no bet offered on a game whose start moved after its puck drop, and its row and its page say so: ${g.id}`); closeBets(d);
  }
  /* a score the job published while a game was under way says when it was read */
  const liveGames = S.games.filter(g => g.state === 'live');
  if (liveGames.length && openDay(d, liveGames[0].date)) {
    for (const g of liveGames.filter(x => x.date === liveGames[0].date)) { const c = cardOf(d, g.id); chk(c && (!Number.isFinite(g.hs) || !Number.isFinite(g.as) || / · as of /.test(txt(c.querySelector('.sl-result')))), `a live score the job published says when it was read: ${g.id}`); }
    if (withGames) openDay(d, withGames);
  }
  /* what the calls stand on, said when it is stale */
  const PL = S.players;
  const staleInj = !!(PL && PL.injuries && PL.injuries.pulled && (PUB - Date.parse(PL.injuries.pulled)) / 3600000 > 12);
  const noStarters = !!(PL && PL.starters && PL.starters.ok === false && S.games.some(g => g.date === etDate(PUB + 60000) && !startedAt(g, PUB + 60000)));
  chk(!!$('sourceNote') && $('sourceNote').hidden === !(staleInj || noStarters), `the note on stale sources is shown exactly when one is stale (injury report ${staleInj}, DailyFaceoff ${noStarters})`);
  if (staleInj) chk(/Injury report from/.test(txt($('sourceNote'))), 'a stale injury report is named with its time');
  if (noStarters) chk(/No announced goalies/.test(txt($('sourceNote'))), 'DailyFaceoff not read is said');
  /* a leg can be added from a game that has a line and is still to come; a second leg in the same slot of the same game (a second side
     bet, or the other side of the total) replaces it, and with no same-game table in the state any second leg of the game does */
  const gB0 = S.games.filter(g => !startedAt(g, PUB + 60000) && !delayedAt(g, g.start, PUB + 60000) && sFresh(g)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  const bw0 = gB0 && betsOn(d, gB0), btn = bw0 && bw0.querySelector('input[data-leg]');
  chk(!gB0 || !!btn, `the first game to come with a fresh line offers its bets on its page, a box a bet (${gB0 ? gB0.id : 'none'})`);
  if (!gB0) console.log('  no game to come with a fresh line: adding a leg from the Games tab is not held on the published state');
  if (btn) {
    btn.click();
    const leg0 = btn.dataset.leg, box0 = () => [...d.querySelectorAll('#gameView input[data-leg]')].find(b => b.dataset.leg === leg0);
    chk(w.localStorage.getItem('nhl_v1') && JSON.parse(w.localStorage.getItem('nhl_v1')).legs.length === 1 && !!box0() && box0().checked, 'ticking a bet in a game\'s Game bets adds a leg to the browser store, the box drawn ticked');
    chk(txt(d.querySelector('#tabs button[data-tab="parlays"]')) === 'Parlay Builder' && !$('legCount'), 'the tab bar stays words alone with a leg in the builder (nhl v25: no count)');
    chk(/Added to your parlay: .+ Your parlay: 1 leg\.$/.test(txt($('ppMsg'))), `and the page says so in its own status line (${txt($('ppMsg'))})`);
    const same = leg0.split('|')[0], slot = b => b.dataset.leg.split('|')[2] === 'ou' ? 'tot' : 'side';
    const other = [...d.querySelectorAll('#gameView input[data-leg]')].find(b => b.dataset.leg.split('|')[0] === same && b.dataset.leg !== leg0 && !b.checked && slot(b) === slot(box0()));
    if (other) { other.click(); chk(JSON.parse(w.localStorage.getItem('nhl_v1')).legs.length === 1, 'a second leg in the same slot of the same game replaces the first'); }
  }
  closeBets(d);

  /* Team Rankings (nhl v26; the Standings' four division tables and Power Ratings' conference select went with their tabs): every club
     once, the first of them ranked 1. TEAM RANKINGS holds the rest */
  d.querySelector('#tabs button[data-tab="ratings"]').click();
  chk(d.querySelectorAll('#tab-ratings table.rt-v tbody tr').length === Object.keys(S.teams).length, `Team Rankings shows every club once (${d.querySelectorAll('#tab-ratings table.rt-v tbody tr').length})`);
  chk(txt(d.querySelector('#tab-ratings table.rt-v tbody tr td')) === '1', 'Team Rankings start at rank 1');

  /* the playoff picture: the simulation Team Rankings' Playoff and Cup columns read (the tab that drew the bracket went in nhl v14) */
  const O = S.playoff.odds;
  const sum = k => Object.values(O).reduce((a, o) => a + o[k], 0);
  chk(Math.abs(sum('cup') - 1) < 0.02, 'Cup chances sum to one: ' + sum('cup').toFixed(3));
  chk(Math.abs(sum('conf') - 2) < 0.03, 'conference chances sum to two: ' + sum('conf').toFixed(3));
  chk(Math.abs(sum('div') - 4) < 0.05, 'division chances sum to four: ' + sum('div').toFixed(3));
  chk(Math.abs(sum('playoff') - 16) < 0.2, 'playoff chances sum to sixteen: ' + sum('playoff').toFixed(2));
  for (const conf of ['East', 'West']) {
    const f = S.playoff.bracket[conf];
    const all = [].concat(...Object.values(f.divs), f.wild);
    chk(all.length === 8 && new Set(all).size === 8, `${conf} field is eight different clubs`);
    chk(f.series.length === 4 && f.series.every(s => s.length === 2), `${conf} has four series`);
    chk(new Set([].concat(...f.series)).size === 8, `${conf}'s first round has each club once`);
  }
  /* the champion, once the season has one: on Team Rankings' heading, a pill (the header's stamp said it before nhl v25) */
  d.querySelector('#tabs button[data-tab="ratings"]').click();
  chk(!!$('ratChamp') && !!$('ratChamp').closest('#tab-ratings h2') && (S.playoff.champion ? !$('ratChamp').hidden && txt($('ratChamp')) === `${S.teams[S.playoff.champion].short} won the Cup` : $('ratChamp').hidden), `the champion is named on Team Rankings' heading exactly when there is one (${!$('ratChamp') ? 'no pill' : $('ratChamp').hidden ? 'hidden' : txt($('ratChamp'))})`);
  { const pillE = $('tab-ratings').querySelector('h2 .pill'), tE = pillE ? pillE.getAttribute('title') || '' : '';
    chk(/^Home ice \d+ Elo; \d+ Elo a goal of margin$/.test(tE) && tE === `Home ice ${S.model.params.hfa} Elo; ${S.model.gpe.toFixed(0)} Elo a goal of margin` && !/home ice/i.test(txt($('tab-ratings').querySelector('h2'))), `the Elo's two constants are on the Team Elo pill's title, not beside the heading (${tE})`); }

  /* ELO Ratings (nhl v29; the Players tab's two cards, its club select and its sources line went with it): with a player model the
     clubs' table has a row a club and the players' starts at rank 1. ELO RATINGS holds the rest */
  d.querySelector('#tabs button[data-tab="players"]').click();
  if (PL) {
    d.querySelector('#pePos button[data-view="str"]').click();
    chk(d.querySelectorAll('#peTable tbody tr').length === Object.keys(PL.teams).length, `ELO Ratings' Overall shows every club once (${d.querySelectorAll('#peTable tbody tr').length})`);
    d.querySelector('#pePos button[data-view="F"]').click();
    chk(!sPeRows(S, 'F').rows.length || txt(d.querySelector('#peTable tbody tr td')) === '1', 'ELO Ratings\' forwards start at rank 1');
  }

  /* the Parlay Builder tab: Pick your own legs offers the lined games (a list, never a table), and the leg added above is priced.
     (Retired with nhl v7: the 1409px lines table and its rows, the "Parlay odds" and "Model" tiles, and "saving empties the
     builder": Save on this device now keeps the builder as it is.) */
  d.querySelector('#tabs button[data-tab="parlays"]').click();
  chk(!d.querySelector('#tab-parlays table'), 'no table inside the Parlay Builder tab');
  chk(d.querySelectorAll('#plLines button[data-leg]').length > 0 || !!d.querySelector('#plLines .empty'), 'Pick your own legs lists lined games or says there are none');
  const stored = () => JSON.parse(w.localStorage.getItem('nhl_v1') || '{}').legs || [];
  const pbBtn = () => [...d.querySelectorAll('#plLines button[data-leg]')].find(b => !b.classList.contains('on') && !stored().some(l => l.game === b.dataset.leg.split('|')[0]));
  if (pbBtn()) {
    const before = stored().length;
    pbBtn().click();
    const after = stored().length;
    chk(after === before + 1, `a button in Pick your own legs adds a leg (${before} -> ${after})`);
  }
  /* one leg is no parlay: Save is off, and says why, as Finish does */
  if (stored().length === 1) chk($('saveParlay').disabled && /two legs or more/.test($('saveParlay').title), `Save is off with one leg (${$('saveParlay').title})`);
  if (stored().length === 1 && pbBtn()) pbBtn().click();
  const legs = stored();
  chk(d.querySelectorAll('#legs .leg').length === legs.length, `the builder lists the legs (${d.querySelectorAll('#legs .leg').length} rows, ${legs.length} stored)`);
  if (legs.length >= 2) {
    chk(/model says|Model's chance/i.test(txt($('parlayTotals'))) && /DraftKings price|Book price/i.test(txt($('parlayTotals'))), 'a parlay is priced with the model beside it: ' + txt($('parlayTotals')).slice(0, 120));
    $('saveParlay').click();
    chk(d.querySelectorAll('#savedList .saved').length === 1, 'saving keeps the parlay');
    chk(/pending/.test(txt($('savedList'))) && /pays \$/.test(txt($('savedList'))), 'an unplayed parlay is pending, with what it pays');
    chk(JSON.stringify(JSON.parse(w.localStorage.getItem('nhl_v1')).legs.map(l => l.game + l.side + l.kind)) === JSON.stringify(legs.map(l => l.game + l.side + l.kind)), 'saving keeps the builder as it is');
    chk($('saveParlay').disabled && /Saved/.test(txt($('saveParlay'))), 'Save reads Saved while the builder is the parlay just saved');
    /* a reload: the builder still the parlay saved, Save still says so, and cannot save it twice */
    const e4 = [], w4 = await boot(PUB + 60000, e4, { store: w.localStorage.getItem('nhl_v1'), hash: 'parlays' }), sv = w4.document.getElementById('saveParlay');
    chk(sv.disabled && /Saved/.test(txt(sv)), `after a reload Save still reads Saved for the parlay already saved (${txt(sv)})`);
    sv.click();
    chk((JSON.parse(w4.localStorage.getItem('nhl_v1')).saved || []).length === 1, 'and saving it again stores nothing');
    chk(!e4.length, 'no runtime error on the reload: ' + e4.join(' | '));
  }
  /* grading a saved parlay: a fabricated final on every kind of leg */
  const fake = { hs: 4, as: 2, state: 'final' };
  S.games.push(Object.assign({ id: 'fake', date: '2000-01-01', start: '2000-01-01T00:00Z', home: 'BOS', away: 'MTL', type: 2, pHome: 0.5, mu: 0, xt: 6, tie: 0.2, frozen: null }, fake));
  w.eval(`S.games.push(${JSON.stringify(S.games[S.games.length - 1])})`);
  const grade = (side, kind, line) => w.eval(`gradeLeg(${JSON.stringify({ game: 'fake', side, kind, line, odds: -110, p: 0.5 })})`);
  chk(grade('home', 'ml', null) === 'win' && grade('away', 'ml', null) === 'loss', 'a moneyline leg grades on the winner');
  chk(grade('home', 'pl', -1.5) === 'win' && grade('away', 'pl', 1.5) === 'loss', 'a puck line leg grades on the margin');
  chk(grade('over', 'ou', 5.5) === 'win' && grade('under', 'ou', 5.5) === 'loss' && grade('over', 'ou', 6) === 'push', 'a total leg grades over, under and push');
  S.games.pop();

  /* the record (nhl v30: the Record tab is folded into the Pick'em Record, whose section holds it number for number): no Record tab, the
     straight-up record and a row a graded month in its Bets record, no paragraph on the fit */
  d.querySelector('#tabs button[data-tab="pickem"]').click();
  chk(!$('tab-record') && !d.querySelector('#tabs button[data-tab="record"]'), 'no Record tab: its button and its section are gone');
  { const graded = S.record.su.w + S.record.su.l > 0, rowsR = [...d.querySelectorAll('#pkBets tbody tr')];
    chk(graded ? txt(rowsR[0] && rowsR[0].cells[1].querySelector('b')) === `${S.record.su.w}–${S.record.su.l}` && rowsR.length === 1 + Object.keys(S.record.byMonth).length : $('pkBetsC').hidden, `the Pick'em Record's Bets record shows the straight-up record, and a row per graded month under the season's (${rowsR.length} rows)`); }
  chk(!$('fitNote') && !/How it was fitted|Held out/.test(txt($('tab-pickem'))), 'the tab carries no paragraph on the fit (nhl v25: it is in CLAUDE.md and data/model.json)');

  /* state invariants the page relies on */
  for (const g of S.games) {
    chk(g.pHome > 0 && g.pHome < 1, `chance in (0,1) on ${g.id}`);
    chk(isFinite(g.mu) && isFinite(g.xt) && g.xt > 3 && g.xt < 9, `an expected margin and a sane total on ${g.id} (${g.mu}, ${g.xt})`);
    chk(g.tie > 0 && g.tie < 0.6, `an overtime chance on ${g.id} (${g.tie})`);
    if (g.line && g.line.homeLine !== null) chk(g.cover && Math.abs(g.cover.home + g.cover.push + g.cover.away - 1) < 0.01, `cover chances sum to one on ${g.id}`);
    if (g.line && g.line.total !== null) chk(g.ou && Math.abs(g.ou.over + g.ou.push + g.ou.under - 1) < 0.01, `total chances sum to one on ${g.id}`);
    if (g.state === 'final') chk(!!g.result, `a final game is graded: ${g.id}`);
    if (g.result && g.result.pl) chk(!!g.line && !!g.plPick, `a puck line grade has a line and a pick: ${g.id}`);
    if (g.result && g.result.ou) chk(!!g.line && !!g.ouPick, `a totals grade has a line and a pick: ${g.id}`);
    chk(S.teams[g.home] && S.teams[g.away], `both clubs known on ${g.id}`);
  }
  chk(Object.keys(S.teams).length === 32, 'thirty-two clubs in the state');
  chk(errors.length === 0, 'runtime errors after walking: ' + errors.join(' | '));

  /* the page opened at a game's puck drop, the job not run since: no bet on it, the visitor's day is Today */
  const next = S.games.filter(g => !startedAt(g, PUB)).sort((a, b) => a.start < b.start ? -1 : 1)[0];
  if (next) {
    const at = Date.parse(next.start) + 60000;
    const errs = [], w2 = await boot(at, errs), d2 = w2.document;
    const startedNow = S.games.filter(g => g.state === 'pre' && Date.parse(g.start) <= at);
    openDay(d2, next.date);
    for (const g of startedNow.filter(g => g.date === next.date)) {
      const c = cardOf(d2, g.id), bw = c ? rowWrongs(w2, c, g, at, pageMap(w2), null) : ['no row'], cls = c ? c.className : '', said = c ? txt(c.querySelector('.sl-result')) : '';
      const pbD = c && betsOn(d2, g);
      chk(c && !!pbD && !d2.querySelector('#gameView input[data-leg], #gameView input[data-pp-add], #gameView #ppRefreshOdds') && !!d2.querySelector('#gameView .gp-live'), `opened at ${new Date(at).toISOString().slice(0, 16)}Z, the page still offers a bet on ${g.away}@${g.home}, which started at ${g.start}`); closeBets(d2);
      chk(!bw.length && (at >= Date.parse(g.start) + 4 * 3600000 ? cls === 'game final' && said === 'Final' : cls === 'game locked' && said === 'LIVE'), `a game past its puck drop with no score yet is locked and says LIVE (Final four hours on): ${g.id} (${cls}: ${said}; ${bw.slice(0, 2).join(' | ')})`);
    }
    const t2 = [...d2.querySelectorAll('#daySel option')].find(o => /^Today, /.test(txt(o)));
    chk(!t2 || t2.value === etDate(at), `"Today" follows the visitor's clock (${etDate(at)}), not the job's day (${t2 && t2.value})`);
    d2.querySelector('#tabs button[data-tab="parlays"]').click();
    const offered = [...d2.querySelectorAll('#plLines button[data-leg]')].map(b => b.dataset.leg.split('|')[0]);
    chk(!startedNow.some(g => offered.includes(g.id)), 'the Parlays tab offers no game that has started');
    chk(errs.length === 0, 'runtime errors at puck drop: ' + errs.join(' | '));
  }

  holdRequests(w, 'the page as published');
  /* NHL_SMOKE_ONLY=page,look,...: a development aid that runs the named sections alone (after the walk above). A partial run says so
     and never passes: the gate is the whole run */
  const ONLY = process.env.NHL_SMOKE_ONLY ? process.env.NHL_SMOKE_ONLY.split(',').map(x => x.trim()).filter(Boolean) : null;
  const SECTIONS = [['list', 'THE GAMES LIST', gamesListChecks], ['page', "THE GAME'S PAGE", gamePageChecks], ['look', 'THE LOOK', theLook], ['builder', 'THE PARLAY BUILDER', parlayBuilder], ['edges', "THE PARLAY BUILDER's edges", parlayEdges], ['suggest', "THE SUGGESTED PARLAYS' RECORD", suggestRecord],
    ['x', 'X PARLAYS AND THE X BET LOG', xParlaysChecks], ['models', "THE PICK'EM MODELS", async () => modelsChecks()], ['theme', 'THE LOOK: LIGHT AND DARK', lightDarkChecks], ['teams', 'TEAM RANKINGS', teamRankingsChecks], ['elo', 'ELO RATINGS', eloRatingsChecks], ['pickem', "THE PICK'EM RECORD", pickemChecks], ['odds', 'REFRESH ODDS', refreshOddsChecks],
    ['props', 'PLAYER PROPS', playerPropsChecks], ['job', "THE JOB'S PLAYER LINES", jobLinesChecks], ['sgp', 'SAME-GAME PARLAYS AND PLAYER LEGS', sameGameChecks]];
  /* a page that breaks a section's steps (a button missing, a leg not where it should be) fails it, never ends the smoke unheard */
  for (const [key, name, fn] of SECTIONS) { if (ONLY && !ONLY.includes(key)) continue; const had = new Set(OPEN); try { await fn(); } catch (e) { chk(false, `${name} stopped at a step the page broke: ${String(e && e.stack || e).split('\n').slice(0, 3).join(' ')}`); } closeSince(had); heapNow();
    if (global.gc) { global.gc(); global.gc(); }
    if (process.env.NHL_SMOKE_HEAP) console.log(`  heap after ${name}: ${Math.round(process.memoryUsage().heapUsed / 1048576)} MB held, peak so far ${Math.round(HEAP_PEAK / 1048576)} MB`); }
  if (ONLY) { checks++; fails.push(`a partial run (NHL_SMOKE_ONLY=${ONLY.join(',')}): the gate is the whole run`); }

  /* written synchronously: process.exit (the page's timers would keep Node up) must not cut a piped log short */
  const shown = process.env.NHL_SMOKE_ALL ? fails : fails.slice(0, 60);
  heapNow(); closeSince(null); if (global.gc) { global.gc(); global.gc(); }
  fs.writeSync(1, [`  heap: peak ${Math.round(HEAP_PEAK / 1048576)} MB, ${Math.round(process.memoryUsage().heapUsed / 1048576)} MB held at the end, of ${Math.round(require('v8').getHeapStatistics().heap_size_limit / 1048576)} MB`, `${checks} checks, ${fails.length} failures`].concat(shown.map(f => '  FAIL ' + f), fails.length > shown.length ? [`  ... and ${fails.length - shown.length} more (NHL_SMOKE_ALL=1 lists them all)`] : []).join('\n') + '\n');
  process.exit(fails.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
