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
     - the look (THE LOOK, nhl v12, the card and the colours nhl v13): no image anywhere, every club's colour at its contrast bar (3:1 for
       a badge, 4.5:1 for a pill), in a hue of its own and clear of every club outside its own colour, every game card of every day on the
       strip worked out from the state, part by part (each bet button its one line, its call's tag and edge, a side far off the market
       said on its own button with both numbers, every piece that cannot wrap within the narrowest button's room, a row's two buttons
       laid out alike; who is out cut to the goalies and the players worth OUT_ROW goals, the bar worked out
       again from the model, the rest named a line a club and every out player's status and figure on the card or in its Lineups), and
       every table keeping every column at every width, scrolling sideways in its wrapper with its hidden names held
       inside it (the Standings' four on the same column widths); the figures' formats, no Playoff tab (nhl v14), and the Record's figures
       fitted to their tiles (jsdom lays nothing out: the rules are read, and the Record's fit is held on a made-up layout)
   NHL_STATE, NHL_DATA, NHL_PREV_STATE and NHL_OUT move the files (simulate.js); NHL_HTML tries another page. */
'use strict';
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
const CALL = ['pHome', 'rh', 'ra', 'diff', 'mu', 'xt', 'tie', 'frozen', 'before', 'pm', 'elo', 'by', 'line', 'pick', 'mlEdge', 'mlPick', 'cover', 'plEdge', 'plPick', 'ou', 'ouEdge', 'ouPick'];

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
async function boot(clockMs, errors, opts = {}) {
  const dom = new JSDOM(HTML.replace(/<link[^>]*fonts[^>]*>/g, ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' + (opts.hash ? '#' + opts.hash : ''),
    beforeParse(w) {
      const Real = w.Date; let offset = clockMs - Real.now();
      class Clock extends Real { constructor(...a) { if (a.length) super(...a); else super(Real.now() + offset); } static now() { return Real.now() + offset; } }
      w.Date = Clock;
      w.__setClock = ms => { offset = ms - Real.now(); };
      w.__requests = []; w.__writes = []; w.__confirm = true; w.__asked = [];
      w.confirm = q => { w.__asked.push(String(q)); return w.__confirm; };
      if (opts.store !== undefined) w.localStorage.setItem('nhl_v1', opts.store);
      const set = w.Storage.prototype.setItem;
      w.Storage.prototype.setItem = function (k, v) { w.__writes.push(String(k)); return set.call(this, k, v); };
      const body = opts.keepDk ? opts.state || STATE : noDk(opts.state || STATE);
      w.fetch = async (url, init) => {
        w.__requests.push({ url: String(url), method: (init && init.method) || 'GET', cache: init && init.cache });
        if (String(url).startsWith('state.json')) return { ok: true, json: async () => JSON.parse(body) };
        if (PROPS_RX.test(String(url))) return opts.props ? opts.props(String(url)) : PROPS_404(String(url));
        if (String(url).includes('espn.com')) return opts.espn ? opts.espn(String(url)) : { ok: true, json: async () => ({ events: [] }) };
        return { ok: false, status: 404 };
      };
      w.addEventListener('error', e => errors.push(e.message));
    },
  });
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
  const isOut = (club, p) => outRows.find(r => (r.id && String(r.id) === String(p.id)) || (r.club === club && norm(r.name) === norm(p.name)));
  const goalieOut = p => outRows.find(r => (r.id && String(r.id) === String(p.id)) || norm(r.name) === norm(p.name));
  const listedElsewhere = (club, p, byName) => rows.find(r => r.club !== club && ((r.id && String(r.id) === String(p.id)) || (byName && norm(r.name) === norm(p.name))));
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
    const o = goalieOut(gl); chk(!o, `${gl.name} is named in goal for ${club} on ${g.date} (${g.away}@${g.home}) but is ${o && o.status} on ${o && o.club}'s injury report`);
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
    /* a starter is unavailable when the report has him out (by id, or by name under his club) or lists him under another club */
    const available = (club, id) => { const p = { id, name: nameOf[id] }; return !isOut(club, p) && !outRows.find(r => r.id && String(r.id) === String(id)) && !listedElsewhere(club, p, true); };
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
        if (goalieOutAny(P.goalie) && !(pm && pm.announced === 'Confirmed')) bad.push(`${P.goalie.name} projected in goal but out on the injury report`);
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
const goalieOutAny = p => { const inj = readJSON(path.join(DATA, 'injuries.json')); if (!inj || !inj.teams) return false; return Object.values(inj.teams).some(l => (l || []).some(r => OUT.test(r.status || '') && ((r.id && String(r.id) === String(p.id)) || norm(r.name) === norm(p.name)))); };

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
  const pctW = p => Math.round(p * 100) + '%';
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
const sOrder = (a, b) => (Date.parse(a.start) - Date.parse(b.start)) || (a.mu < b.mu ? -1 : a.mu > b.mu ? 1 : 0) || (PBS.KINDS.indexOf(a.kind) - PBS.KINDS.indexOf(b.kind));
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
function sPool(sl, kinds, off) {
  const scan = (gs, ks) => { const out = [], far = []; for (const g of gs) for (const k of ks) for (const s of PBS.SIDES[k]) { const L = sLeg(g, s, k), q = sQual(L); if (q === 'ok') out.push(L); else if (q === 'far') far.push(L); } return { out, far }; };
  const tickable = sl.games.filter(sFresh), ticked = tickable.filter(g => !off.includes(g.id));
  const { out, far } = scan(ticked, kinds);
  for (const L of out) L.thin = !(L.edge >= S.edge);
  out.sort(sOrder);
  return { kinds, tickable, ticked, legs: out, far, scan, m: new Set(out.map(L => L.game)).size };
}
/* every parlay of n legs, one a game, in leg order; per count of thin legs, the best return over the floor and the likeliest
   (`must`: a leg id every parlay holds, as a level's lock does) */
function sBrute(legs, n, floor, must) {
  const games = []; for (const L of legs) { const last = games[games.length - 1]; if (last && last[0].game === L.game) last.push(L); else games.push([L]); }
  const EPS = 1e-12, ret = [], lik = [];
  const keep = (box, t, v, legs2, p, d) => { const b = box[t] || (box[t] = { v: -1, c: [] }); if (v < b.v - EPS) return; if (v > b.v) { b.v = v; b.c = b.c.filter(c => c.v >= v - EPS); } b.c.push({ v, legs: legs2.slice(), p, d, key: legs2.map(L => L.id).sort().join(',') }); };
  const chosen = [];
  const rec = (i, p, d, t) => {
    if (chosen.length === n) { if (must && !chosen.some(L => L.id === must)) return; keep(lik, t, p, chosen, p, d); if (floor && p >= floor) keep(ret, t, p * d, chosen, p, d); return; }
    for (let j = i; j <= games.length - (n - chosen.length); j++) for (const L of games[j]) { chosen.push(L); rec(j + 1, p * L.p, d * L.dec, t + (L.thin ? 1 : 0)); chosen.pop(); }
  };
  if (games.length >= n) rec(0, 1, 1, 0);
  const pickBest = (box, k) => { let v = -1; for (let t = 0; t <= k; t++) if (box[t]) v = Math.max(v, box[t].v); if (v < 0) return null; const all = []; for (let t = 0; t <= k; t++) if (box[t]) all.push(...box[t].c.filter(c => c.v >= v - EPS)); return all.sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0)[0]; };
  let k0 = -1; for (let t = 0; t <= n; t++) if (lik[t]) { k0 = t; break; }
  if (k0 < 0) return null;
  const fairOf = c => c.legs.reduce((f, L) => f === null || L.fair === null ? null : f * L.fair, 1);
  if (!floor) { const c = pickBest(lik, k0); return Object.assign(c, { fair: fairOf(c) }); }
  for (let k = k0; k <= n; k++) { const c = pickBest(ret, k); if (c) return Object.assign(c, { fair: fairOf(c) }); }
  const c = pickBest(lik, k0); return Object.assign(c, { fair: fairOf(c), likeliest: true });
}
function sWhy(sl, pool, off) {
  if (!pool.kinds.length) return 'No bet types ticked: tick at least one above.';
  if (!pool.ticked.length) return 'No games ticked: tick at least one above.';
  const m = pool.m;
  const moreGames = pool.scan(pool.tickable.filter(g => off.includes(g.id)), pool.kinds).out.length > 0;
  const moreTypes = new Set(pool.scan(pool.ticked, PBS.KINDS).out.map(L => L.game)).size > m;
  const bothHint = sl.both && sl.pick !== 'both';
  const fixes = moreGames && moreTypes ? 'tick more games or bet types' : moreGames ? 'tick more games' : moreTypes ? 'tick more bet types' : '';
  const help = fixes && bothHint ? fixes + ' or choose Both days above' : fixes || (bothHint ? 'choose Both days above' : '');
  const head = m === 0 ? "No leg on your picks qualifies (the model rates none at or above DraftKings' price, at 45% to 97% and not far off the market)" : `Only ${m} leg${m > 1 ? 's' : ''} on your picks (one a game)`;
  if (help) return `${head}: ${help}.`;
  const last = sl.dates[sl.dates.length - 1], nx = last && PBS.nextDay(last);
  const note = sl.pick !== 'both' && nx && sl.on(nx).length && !sl.on(nx).some(sFresh) ? ` ${PBS.day(nx)}'s lines come about a day ahead.` : '';
  if (m === 0) return `${head}.${note}`;
  if (m === pool.tickable.length) return `Only ${m} game${m > 1 ? 's' : ''} on ${sl.text} (one leg a game).${note}`;
  return `Only ${m} of the ${pool.tickable.length} games on ${sl.text} ${m === 1 ? 'has' : 'have'} a leg the model rates at or above DraftKings' price (one leg a game).${note}`;
}
function sWide(sl, pool) {
  const over = "No games to build from: the season is over. The panel comes back with next season's first lines.";
  if (!S.games.length || !sl.come.length) return over;
  const other = sl.days.find(d => !sl.dates.includes(d) && sl.on(d).some(sFresh));
  const otherNote = other ? ` ${PBS.day(other)} is in the Day choice above.` : '';
  if (!pool.tickable.length) {
    const opener = S.games[0].date;
    if (opener > sl.today && sl.dates.every(d => d <= opener)) return `The season opens ${PBS.day(opener)}. DraftKings posts the first lines about a day before.`;
    if (S.phase === 'offseason' || S.phase === 'over') return over;
    return `No DraftKings lines yet for ${sl.text}: DraftKings posts a day's lines about a day before puck drop, and the job reads them at its next run (five times a day).${otherNote}`;
  }
  if (pool.tickable.length < 2) return `Only one game on ${sl.text} is still to come with a DraftKings line, and a parlay needs two.${otherNote}`;
  return '';
}
const TIERS = [['safe', 'Safe', 2, 0], ['med', 'Medium', 3, 0.25], ['aggr', 'Aggressive', 4, 0.12]];        // Extreme went in nhl v14
/* the panel in a window against this smoke's own working: the slate, the Day control, the notes, every level (brute force when asked) */
function holdPanel(w, ms, tag, brute) {
  const d = w.document, store = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}'), ui = (store.ui && store.ui.pb) || {};
  const k = ui.k || {}, kinds = PBS.KINDS.filter(x => k[x] !== false), off = Array.isArray(ui.off) ? ui.off.map(String) : [];
  const sl = sSlate(ms, ui.day), pool = sPool(sl, kinds, off), stake = (() => { const v = +store.stake; return isFinite(v) && v > 0 ? Math.round(Math.min(100000, Math.max(1, v)) * 100) / 100 : 20; })();
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
  chk(d.querySelectorAll('#pbGrid .pb-gt').length === sl.games.length, `${tag}: a tile for every game on the slate still to come (${d.querySelectorAll('#pbGrid .pb-gt').length} vs ${sl.games.length})`);
  const sum = txt(d.getElementById('pbGsum')), nt = pool.ticked.length;
  chk(sum === (nt === pool.tickable.length ? `All ${nt}` : `${nt} of ${pool.tickable.length}`), `${tag}: the Games summary counts the tickable games (${sum})`);
  /* the far-off note */
  const notes = txt(d.getElementById('pbNotes'));
  const farRe = /(\d+) legs? (?:are|is) left out: the model rates/;
  chk(pool.far.length ? (farRe.exec(notes) || [])[1] === String(pool.far.length) : !farRe.test(notes), `${tag}: the far-off note counts ${pool.far.length} legs (${(farRe.exec(notes) || [])[1] || 'none said'})`);
  const wide = sWide(sl, pool), wEl = d.getElementById('pbWide');
  if (wide) { chk(wEl && txt(wEl) === wide, `${tag}: the panel says "${wide}" (${wEl ? txt(wEl) : 'three levels drawn'})`); return { sl, pool, levels: null, stake }; }
  chk(!wEl && d.querySelectorAll('.pb-tier').length === 3 && !d.querySelector('.pb-tier[data-tier="xtrm"]'), `${tag}: three levels, Safe, Medium and Aggressive`);
  const levels = {};
  for (const [id, label, n, floor] of TIERS) {
    const el = d.querySelector(`.pb-tier[data-tier="${id}"]`); if (!el) { chk(false, `${tag}: no ${label} card`); continue; }
    const shown = [...el.querySelectorAll('.pb-tl')].map(x => x.dataset.id);
    /* every leg: still to come, fresh, both prices, 45-97%, at or above the price, no push, not far off, one a game, ticked, on the slate */
    for (const lid of shown) {
      const [gid, side, kind] = lid.split('|'), g = S.games.find(x => x.id === gid), L = g && sLeg(g, side, kind);
      chk(!!L && !sStarted(g, ms) && sFresh(g) && sQual(L) === 'ok' && kinds.includes(kind) && !off.includes(gid) && sl.dates.includes(g.date), `${tag}: ${label}'s leg ${lid} is one the rules allow`);
      if (!L) continue;
      const row = el.querySelector(`.pb-tl[data-id="${lid}"]`), rt = txt(row);
      chk(rt.includes(PBS.odds(L.price)) && rt.includes(`fair ${PBS.pctW(L.fair)}`) && rt.includes(`model ${PBS.pctW(L.p)}`), `${tag}: ${label}'s leg ${lid} shows the state's price, fair and model chance: ${rt}`);
      chk(/thin edge/i.test(rt) === (L.edge < S.edge), `${tag}: ${label}'s leg ${lid} is marked thin exactly when its edge ${L.edge} is under ${S.edge}`);
    }
    chk(new Set(shown.map(x => x.split('|')[0])).size === shown.length, `${tag}: ${label} has one leg a game`);
    const res = el.classList.contains('none') ? null : { legs: shown };
    levels[id] = res;
    if (!brute) continue;
    const b = sBrute(pool.legs, n, floor);
    if (!b) { chk(!res && txt(el.querySelector('.pb-empty')) === sWhy(sl, pool, off), `${tag}: ${label} is empty: "${sWhy(sl, pool, off)}" (${res ? 'a parlay drawn' : txt(el.querySelector('.pb-empty'))})`); continue; }
    chk(!!res && JSON.stringify(shown) === JSON.stringify(b.legs.map(L => L.id)), `${tag}: ${label} is the brute force's ${b.likeliest ? 'likeliest' : floor ? 'best return' : 'likeliest pair'}: ${b.legs.map(L => L.id).join(', ')} (page: ${shown.join(', ')})`);
    if (!res) continue;
    const rule = !floor ? 'the likeliest pair' : b.likeliest ? `the likeliest ${n} legs` : `best return that lands ${Math.round(floor * 100)}%+ by the model`;
    chk(txt(el.querySelector('.pb-rule')) === rule, `${tag}: ${label}'s rule line reads "${rule}" (${txt(el.querySelector('.pb-rule'))})`);
    const v = [...el.querySelectorAll('.pb-n')].map(x => txt(x));
    chk(b.fair === null ? v[0].startsWith(PBS.pctW(b.p)) : v[0].startsWith(PBS.pctW(b.fair)) && v[0].includes(`model says ${PBS.pctW(b.p)}`), `${tag}: ${label} leads with the fair chance ${b.fair === null ? 'none' : PBS.pctW(b.fair)}, the model's ${PBS.pctW(b.p)} beside it: ${v[0]}`);
    chk(v[1].startsWith(PBS.toAm(b.d)), `${tag}: ${label}'s price is ${PBS.toAm(b.d)} (${v[1]})`);
    const pay = el.querySelector('[data-pb-pay]');
    chk(pay && txt(pay.querySelector('.v')) === PBS.money(PBS.cents(stake * b.d)) && txt(pay.querySelector('.k')) === `${PBS.short(stake)} pays`, `${tag}: ${label} pays ${PBS.money(PBS.cents(stake * b.d))} on ${PBS.short(stake)} (${pay && txt(pay)})`);
    levels[id] = Object.assign(res, { b });
  }
  return { sl, pool, levels, stake, kinds, off };
}
/* every level's legs by the leg order, the builder's: puck drop, then the matchup, then the kind */
function legsSorted(ids) { const L = ids.map(x => { const [g, s, k] = x.split('|'); return sLeg(S.games.find(y => y.id === g), s, k); }); return L.slice().sort(sOrder).map(l => l.id).join(',') === ids.join(','); }

async function parlayBuilder() {
  console.log('THE PARLAY BUILDER');
  const AT = PUB + 60000, errors = [];
  const w = await boot(AT, errors, { hash: 'parlay' }), d = w.document, $ = id => d.getElementById(id);
  const store = () => JSON.parse(w.localStorage.getItem('nhl_v1') || '{}');
  /* the tab: second, #parlay opens it */
  const tabs = [...d.querySelectorAll('#tabs button')];
  chk(tabs[1] && tabs[1].dataset.tab === 'parlays' && /Parlay Builder/.test(txt(tabs[1])), `Parlay Builder is the second tab (${tabs.map(b => txt(b)).join(' | ')})`);
  chk(!$('tab-parlays').hidden && w.location.hash === '#parlays', `#parlay opens the Parlay Builder (${w.location.hash})`);
  /* the default panel, every level by brute force */
  const P0 = holdPanel(w, AT, 'default', true);
  /* every clock on the page is the visitor's own and names its zone; the card's, which goes to other people, is Eastern and says ET */
  const clock = ms => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  chk(txt($('pbRead')).includes(`as read at ${clock(PUB)}, the job's last run`), `the panel dates the prices in the visitor's zone, named (${txt($('pbRead'))})`);
  const tileTimes = [...d.querySelectorAll('#pbGrid input[data-g]')].map(x => [x.dataset.g, txt(x.closest('.pb-gt'))]);
  chk(tileTimes.every(([id, t]) => t.endsWith(clock(Date.parse(S.games.find(g => g.id === id).start)))), `every game tile's puck drop names its zone (${tileTimes.slice(0, 2).map(x => x[1]).join(' | ')})`);
  const rowTimes = [...d.querySelectorAll('.pb-tl')].map(x => [x.dataset.id.split('|')[0], txt(x.querySelector('.pb-ll .m'))]);
  chk(rowTimes.every(([id, t]) => t.endsWith(clock(Date.parse(S.games.find(g => g.id === id).start)))), `every level's leg names its puck drop's zone (${rowTimes.slice(0, 2).map(x => x[1]).join(' | ')})`);
  for (const [id] of TIERS) { const r = P0.levels && P0.levels[id]; if (r && r.legs.length) chk(legsSorted(r.legs), `${id}: the legs are in leg order`); }
  /* preferred is the Games cards' call: every qualifying leg of the slate */
  for (const L of P0.pool.legs) chk(!L.thin === (L.pick === L.side), `${L.id}: a leg 5 points above the price is exactly the card's call (edge ${L.edge}, call ${L.pick})`);
  /* Both days, when offered: every level by brute force */
  if (P0.sl.both) {
    const b = d.querySelector('#pbDay button[data-day="both"]'); b.focus(); b.click();
    chk(d.activeElement && d.activeElement.dataset && d.activeElement.dataset.day === 'both', `choosing a Day keeps the keyboard's focus on it, redrawn (${d.activeElement && (d.activeElement.dataset && d.activeElement.dataset.day || d.activeElement.tagName)})`);
    holdPanel(w, AT, 'both days', true);
    chk(store().ui.pb.day === 'both', 'Both days is kept in nhl_v1');
    d.querySelector(`#pbDay button[data-day="${P0.sl.pick}"]`).click();
  } else console.log(`  Both days not offered (${P0.sl.days.join(', ') || 'no day'}): its brute force skipped`);
  const levelsOn = !!P0.levels;
  if (levelsOn) {
    /* the controls: each mix, each box alone, none, the games All and None and one unticked; the levels follow, the reasons say why */
    const setBoxes = ks => { for (const b of d.querySelectorAll('#pbKinds input[data-k]')) if (b.checked !== ks.includes(b.dataset.k)) { b.checked = !b.checked; b.dispatchEvent(new w.Event('change', { bubbles: true })); } };
    const kindsOf = () => [...new Set([...d.querySelectorAll('.pb-tl')].map(x => x.dataset.id.split('|')[2]))];
    for (const [mix, ks] of [['teams', ['ml', 'pl']], ['totals', ['ou']], ['all', ['ml', 'pl', 'ou']]]) {
      d.querySelector(`#pbMix button[data-mix="${mix}"]`).click();
      const got = [...d.querySelectorAll('#pbKinds input[data-k]')].filter(b => b.checked).map(b => b.dataset.k).join(',');
      chk(got === ks.join(','), `${mix}: the mix ticks ${ks.join(', ')} (${got})`);
      chk(kindsOf().every(x => ks.includes(x)), `${mix}: every level's legs are of the ticked kinds (${kindsOf().join(', ')})`);
      chk(JSON.stringify(Object.entries(store().ui.pb.k).filter(([, v]) => v).map(([x]) => x)) === JSON.stringify(ks), `${mix}: ui.pb.k is stored`);
      holdPanel(w, AT, `mix ${mix}`, false);
    }
    for (const ks of [['ml'], ['pl'], ['ou'], []]) {
      setBoxes(ks);
      const lit = d.querySelector('#pbMix button.on');
      const mixOf = ks.join() === 'ou' ? 'totals' : null;
      chk((lit ? lit.dataset.mix : null) === mixOf, `boxes ${ks.join(',') || 'none'}: the mix lit is ${mixOf} (${lit && lit.dataset.mix})`);
      chk(kindsOf().every(x => ks.includes(x)), `boxes ${ks.join(',') || 'none'}: the levels use only those kinds`);
      const empties = [...d.querySelectorAll('.pb-tier.none .pb-empty')].map(txt);
      chk(!ks.length === (empties.length === TIERS.length && empties.every(t => t === 'No bet types ticked: tick at least one above.')), `boxes ${ks.join(',') || 'none'}: "No bet types ticked" shown exactly when none is ticked`);
      holdPanel(w, AT, `boxes ${ks.join(',') || 'none'}`, false);
    }
    setBoxes(['ml', 'pl', 'ou']);
    d.querySelector('#pbGames button[data-gall="0"]').click();
    let empties = [...d.querySelectorAll('.pb-tier.none .pb-empty')].map(txt);
    chk(empties.length === TIERS.length && empties.every(t => t === 'No games ticked: tick at least one above.') && store().ui.pb.off.length === P0.pool.tickable.length, `None: every level says "No games ticked" (${empties[0]}), and the games are stored unticked`);
    holdPanel(w, AT, 'games none', false);
    d.querySelector('#pbGames button[data-gall="1"]').click();
    chk(!d.querySelector('.pb-tier.none .pb-empty') || ![...d.querySelectorAll('.pb-tier.none .pb-empty')].some(x => /No games ticked/.test(txt(x))), 'All: the games are ticked again');
    const first = d.querySelector('#pbGrid input[data-g]');
    first.focus(); first.checked = false; first.dispatchEvent(new w.Event('change', { bubbles: true }));
    chk(d.activeElement && d.activeElement.dataset && d.activeElement.dataset.g === first.dataset.g && d.activeElement !== first, `unticking a game keeps the keyboard's focus on its box, redrawn (${d.activeElement && (d.activeElement.dataset && d.activeElement.dataset.g || d.activeElement.tagName)})`);
    chk(store().ui.pb.off.includes(first.dataset.g) && ![...d.querySelectorAll('.pb-tl')].some(x => x.dataset.id.startsWith(first.dataset.g + '|')), `one game unticked (${first.dataset.g}): stored, and in no level`);
    const tile = d.querySelector(`#pbGrid input[data-g="${first.dataset.g}"]`).closest('.pb-gt');
    chk(tile && tile.classList.contains('un'), 'an unticked game is drawn dashed');
    holdPanel(w, AT, 'one game unticked', true);
    /* the picks come back on a second boot of the same store */
    const kept = w.localStorage.getItem('nhl_v1');
    const e2 = [], w2 = await boot(AT, e2, { store: kept, hash: 'parlays' });
    const in2 = w2.document.querySelector(`#pbGrid input[data-g="${first.dataset.g}"]`);
    chk(in2 && !in2.checked, 'a second boot on the stored nhl_v1 keeps the game unticked');
    holdPanel(w2, AT, 'restored', false);
    chk(!e2.length, 'no runtime error on the restored boot: ' + e2.join(' | '));
    const again = d.querySelector(`#pbGrid input[data-g="${first.dataset.g}"]`);
    again.checked = true; again.dispatchEvent(new w.Event('change', { bubbles: true }));
    chk(!store().ui.pb.off.length, 'ticked again, no game is stored unticked');
    /* the Bet amount: one number, every level's pays line redrawn as it is typed */
    const box = $('pbStake');
    box.value = '50'; box.dispatchEvent(new w.Event('input', { bubbles: true }));
    const pays = [...d.querySelectorAll('[data-pb-pay]')];
    chk(pays.every(x => txt(x.querySelector('.v')) === PBS.money(PBS.cents(50 * +x.dataset.pbPay)) && txt(x.querySelector('.k')) === '$50 pays'), `50 in the Bet amount redraws every pays line to 50 times its decimal (${pays.map(x => txt(x)).join(' / ')})`);
    chk(+store().stake === 50, 'the amount is kept in nhl_v1');
    chk(w.eval("stakeRead('$1,250')") === 1250 && w.eval("stakeRead(' 7.555 ')") === 7.56 && w.eval('stakeRead(250000)') === 100000, '"$1,250" reads as 1250, cents kept, $100,000 the most');
    for (const bad of ['abc', '0', '-5', '']) { box.value = bad; box.dispatchEvent(new w.Event('input', { bubbles: true })); box.dispatchEvent(new w.Event('change', { bubbles: true })); chk(+store().stake === 50 && box.value === '50', `"${bad}" leaves the amount at 50 (${store().stake}, box ${box.value})`); }
    chk(w.eval("stakeRead('abc') === null && stakeRead('0') === null && stakeRead('-5') === null && stakeRead('') === null"), 'stakeRead takes no word, zero, minus or blank');
    await wait(300);
    chk($('stake').value === '50', `the builder's stake is the same number (${$('stake').value})`);
    box.value = '20'; box.dispatchEvent(new w.Event('input', { bubbles: true })); box.dispatchEvent(new w.Event('change', { bubbles: true }));
    const e3 = [], w3 = await boot(AT, e3, { store: JSON.stringify({ stake: 'abc' }), hash: 'parlays' });
    chk(w3.document.getElementById('pbStake').value === '20' && w3.document.getElementById('stake').value === '20', 'a stored amount that is not one boots as $20');
    /* Add to builder: asked before replacing other legs; then exactly the level's legs, priced as the level was */
    const lv = TIERS.map(t => t[0]).find(id => P0.levels[id] && P0.levels[id].legs && P0.levels[id].legs.length >= 2);
    if (lv) {
      const card = () => d.querySelector(`.pb-tier[data-tier="${lv}"]`);
      const ids = [...card().querySelectorAll('.pb-tl')].map(x => x.dataset.id);
      /* another leg in the builder first: a game of the slate shown (Pick your own legs lists only that) the level does not use */
      const slNow = sSlate(AT, ((store().ui || {}).pb || {}).day);
      const other = slNow.games.find(g => !sStarted(g, AT) && sFresh(g) && !ids.some(x => x.startsWith(g.id + '|')) && sLeg(g, 'home', 'ml'));
      const ob = other && d.querySelector(`#plLines button[data-leg="${other.id}|home|ml"]`);
      chk(!other || !!ob, `Pick your own legs offers ${other ? other.id : ''}, a game of the slate shown`);
      if (ob) ob.click(); else console.log(`  every game with a line on ${slNow.text} is in ${lv}: the ask before replacing other legs is not reached`);
      const before = JSON.stringify(store().legs), asked0 = w.__asked.length;
      w.__confirm = false; card().querySelector('[data-pb-add]').click();
      chk(ob ? JSON.stringify(store().legs) === before && w.__asked.slice(asked0).some(q => /^Replace the \d+ legs? in the builder with the \w+ \d-leg parlay\?$/.test(q)) : w.__asked.length === asked0, `Add to builder asks before replacing other legs (and only then), and No changes nothing (${w.__asked.slice(asked0).join(' | ') || 'not asked'})`);
      w.__confirm = true; card().querySelector('[data-pb-add]').focus(); card().querySelector('[data-pb-add]').click();
      chk(JSON.stringify(store().legs.map(l => `${l.game}|${l.side}|${l.kind}`)) === JSON.stringify(ids), `Add to builder puts exactly the level's legs in, in order (${store().legs.length})`);
      chk(d.activeElement === $('bTitle'), `Add to builder takes the keyboard's focus to the builder (${d.activeElement && (d.activeElement.id || d.activeElement.tagName)})`);
      const bt = [...d.querySelectorAll('#parlayTotals .stat')].map(txt), cv = [...card().querySelectorAll('.pb-n')].map(txt);
      const lb = P0.levels[lv].b;
      chk(d.querySelectorAll('#legs .leg').length === ids.length, 'the builder shows them');
      chk([...d.querySelectorAll('#legs .leg button.x')].every((x, i) => { const L = sLeg(S.games.find(g => g.id === ids[i].split('|')[0]), ids[i].split('|')[1], ids[i].split('|')[2]); return x.getAttribute('aria-label').includes(`${S.teams[L.g.away].short} @ ${S.teams[L.g.home].short}`); }), `each Remove names its game (${[...d.querySelectorAll('#legs .leg button.x')].map(x => x.getAttribute('aria-label')).join(' | ')})`);
      chk([...card().querySelectorAll('[data-pb-lock]')].every(x => / @ .*New legs keeps it\)$/.test(x.getAttribute('aria-label'))), 'each lock names its game and what it does');
      if (lb) {
        chk(bt[0] && bt[0].startsWith(lb.fair === null ? PBS.pct1(lb.p) : PBS.pct1(lb.fair)) && (lb.fair === null || bt[0].includes(`model says ${PBS.pct1(lb.p)}`)), `the builder's chance is the level's (${bt[0]} vs ${cv[0]})`);
        chk(bt[1] && bt[1].startsWith(PBS.toAm(lb.d)) && cv[1].startsWith(PBS.toAm(lb.d)), `the builder's price is the level's ${PBS.toAm(lb.d)} (${bt[1]})`);
        chk(bt[2] && bt[2].startsWith(PBS.money(PBS.cents(20 * lb.d))) && cv[2].startsWith(PBS.money(PBS.cents(20 * lb.d))), `the builder pays what the level said (${bt[2]} vs ${cv[2]})`);
      }
      chk(/In the builder/.test(txt(card().querySelector('[data-pb-add]'))) && card().querySelector('[data-pb-add]').disabled, 'the level\'s button reads In the builder');
      /* the builder: rows, the tiles, the confidence, removing one */
      const legs = store().legs;
      chk(d.querySelectorAll('#legs .leg').length === legs.length, 'a row a leg');
      const sl2 = legs.map(l => sLeg(S.games.find(g => g.id === l.game), l.side, l.kind)).sort(sOrder);
      let p = 1, dd = 1, f = 1; for (const L of sl2) { p *= L.p; dd *= L.dec; f = f === null || L.fair === null ? null : f * L.fair; }
      const conf = c => c >= 0.7 ? 'High' : c >= 0.45 ? 'Medium' : 'Low';
      chk(bt[3] && bt[3].startsWith(conf(f === null ? p : f)) && new RegExp(`on the ${f === null ? "model's" : 'fair'} chance`, 'i').test(bt[3]), `the confidence tile is ${conf(f === null ? p : f)} on the ${f === null ? "model's" : 'fair'} chance (${bt[3]})`);
      /* the price is DraftKings' only where every leg's book is DraftKings (its name in any case and spacing), else the book's */
      const bookLab = sl2.every(L => isDKBook(L.g.line)) ? 'DraftKings price' : 'Book price';
      chk(new RegExp(`(fair chance|model's chance) all ${legs.length} land`, 'i').test(bt[0]) && bt[1].includes(bookLab) && (bookLab === 'DraftKings price' || !/DraftKings price/.test(bt[1])) && /\$20 pays/i.test(bt[2]) && /profit/.test(bt[2]), `the four tiles say what they are (${bt.join(' | ')})`);
      chk(!$('pFinish').disabled, 'Finish parlay is on with two legs or more');
      /* the card from the builder: every leg and the price; Escape, the Tab order, outside click, Start over */
      await cardChecks(w, sl2, 'Your parlay');
      /* a second bet in the same slot of a game (a second side bet, the other side of the total) replaces the first, said, with the
         rule's own words; with no same-game table in the state, one leg a game, said so */
      const g0 = sl2[0].g, slotK = k => k === 'ou' ? 'tot' : 'side', k0 = sl2[0].kind;
      const alt = ['ml', 'pl', 'ou'].flatMap(k => PBS.SIDES[k].map(s => [s, k])).find(([s, k]) => `${g0.id}|${s}|${k}` !== sl2[0].id && slotK(k) === slotK(k0) && sLeg(g0, s, k));
      if (alt) {
        const ab = d.querySelector(`#plLines button[data-leg="${g0.id}|${alt[0]}|${alt[1]}"]`); ab.click();
        const rule = !S.sgp ? 'one leg a game here: this publish carries no same-game table.' : slotK(k0) === 'tot' ? 'one total a game.' : 'one side bet a game (the moneyline or the puck line).';
        chk(store().legs.filter(l => l.game === g0.id).length === 1 && store().legs.some(l => l.game === g0.id && l.side === alt[0] && l.kind === alt[1]), 'a second bet in the same slot of a game replaces the first');
        chk(txt($('bMsg')).includes(` on ${S.teams[g0.away].abbr} @ ${S.teams[g0.home].abbr}: ${rule}`) && /replaced/.test(txt($('bMsg'))) && txt($('slipMsg')).includes(rule), `the replace is said in the builder and the slip bar, with the rule (${txt($('bMsg'))})`);
      }
      const n0 = d.querySelectorAll('#legs .leg').length;
      d.querySelector('#legs .leg button.x').click();
      chk(d.querySelectorAll('#legs .leg').length === n0 - 1 && store().legs.length === n0 - 1, 'remove takes one leg out');
      while (d.querySelectorAll('#legs .leg').length > 1) d.querySelector('#legs .leg button.x').click();
      chk($('pFinish').disabled && /two legs or more/.test($('pFinish').title) && !$('bHint').hidden && /one more leg/.test(txt($('bHint'))), 'Finish parlay is off under two legs, and says why where a phone shows it');
      /* the slip bar on the Games tab, and its button */
      d.querySelector('#tabs button[data-tab="games"]').click();
      chk(!$('slip').hidden && /1 leg ·/.test(txt($('slipText'))), `the slip bar is shown on Games with a leg (${txt($('slipText'))})`);
      $('slipOpen').click();
      chk(!$('tab-parlays').hidden && w.location.hash === '#parlays', 'Open builder opens the Parlay Builder');
      $('clearParlay').click();
      d.querySelector('#tabs button[data-tab="games"]').click();
      chk($('slip').hidden, 'no slip bar with no legs');
      d.querySelector('#tabs button[data-tab="parlays"]').click();
    }
    /* a level's Finish: the card names the level */
    const fin = TIERS.map(t => t[0]).find(id => P0.levels[id] && P0.levels[id].b);
    if (fin) {
      d.querySelector(`.pb-tier[data-tier="${fin}"] [data-pb-finish]`).click();
      const lab = TIERS.find(t => t[0] === fin)[1].toUpperCase() + ' PARLAY';
      chk(!$('pcWin').hidden && txt(d.querySelector('.pc-kick')) === lab, `a level's Finish opens the card as ${lab} (${txt(d.querySelector('.pc-kick'))})`);
      chk($('pcAgain').hidden, 'Start over is the builder\'s only');
      chk(/To keep it, Add to builder, then Save on this device/.test(txt($('pcOwn'))), `a level's card says how to keep it (${txt($('pcOwn'))})`);
      $('pcClose').click();
      const fb = d.querySelector(`.pb-tier[data-tier="${fin}"] [data-pb-finish]`);
      chk($('pcWin').hidden && d.activeElement === fb, `Close gives the focus back to the level's Finish (${d.activeElement && (d.activeElement.id || d.activeElement.tagName + ' ' + txt(d.activeElement))})`);
    }
    /* New legs and locks: legs the level has not shown, a locked leg kept, Reset back to the panel's own; none of it stored */
    const sc = () => d.querySelector('.pb-tier[data-tier="safe"]'), sIds = () => [...sc().querySelectorAll('.pb-tl')].map(x => x.dataset.id);
    if (P0.levels.safe && P0.pool.m >= 2) {
      const before = sIds(), stored = w.localStorage.getItem('nhl_v1');
      sc().querySelector('[data-pb-new]').click();
      const after = sIds();
      chk(after.length === 2 && (after.every(x => !before.includes(x)) || /had its turn here: back to the first/.test(txt(sc()))), `New legs on Safe gives legs it has not shown, or says every leg has had its turn (${before.join(', ')} -> ${after.join(', ')})`);
      chk(/^the likeliest pair left/.test(txt(sc().querySelector('.pb-rule'))), `and the rule line says so (${txt(sc().querySelector('.pb-rule'))})`);
      const lockBtn = sc().querySelector('[data-pb-lock]'), lockedId = lockBtn.dataset.pbLock.split('|').slice(1).join('|');
      lockBtn.click();
      chk(sc().querySelector('[data-pb-lock]').getAttribute('aria-pressed') === 'true', 'a lock is pressed');
      sc().querySelector('[data-pb-new]').click();
      chk(sIds().includes(lockedId), `New legs keeps the locked leg (${lockedId} in ${sIds().join(', ')})`);
      holdPanel(w, AT, 'Safe turned', false);
      sc().querySelector('[data-pb-reset]').click();
      chk(JSON.stringify(sIds()) === JSON.stringify(before), 'Reset is the panel\'s own parlay again');
      chk(w.localStorage.getItem('nhl_v1') === stored, 'New legs and locks are not stored');
    }
  } else console.log('  no levels on this state (the panel says why): the controls, the builder and the card are held on the made-up slates below');
  /* the bet block on the Games tab: a button a priced side on every fresh game to come, its price and chance, the call tagged, far off flagged */
  d.querySelector('#tabs button[data-tab="games"]').click();
  for (const day of [...new Set(S.games.filter(g => !sStarted(g, AT) && sFresh(g)).map(g => g.date))].slice(0, 2)) {
    const b = d.querySelector(`#days .day[data-day="${day}"]`); if (b) b.click();
    for (const g of S.games.filter(x => x.date === day && !sStarted(x, AT) && sFresh(x))) {
      const c = d.querySelector(`#games .game[data-id="${g.id}"]`); if (!c) { chk(false, `no card for ${g.id}`); continue; }
      for (const k of PBS.KINDS) for (const s of PBS.SIDES[k]) {
        const L = sLeg(g, s, k), btn = c.querySelector(`button[data-leg="${g.id}|${s}|${k}"]`);
        chk(!!L === !!btn, `${g.id} ${s} ${k}: a button exactly where DraftKings prices it`);
        if (!L || !btn) continue;
        const t = txt(btn), bw = betHave(btn), bad1 = betWrong(btn, L, s);
        chk(bw.price === PBS.odds(L.price) && bw.chance === `· ${PBS.pctW(L.p)}`, `${g.id} ${s} ${k}: the button shows the state's price and model chance (${t})`);
        chk(/^call · /.test(bw.tag || '') === (L.pick === s), `${g.id} ${s} ${k}: the call's side is tagged (${t})`);
        chk(/far off/.test(bw.tag || '') === (L.fair !== null && L.p - L.fair >= 0.15), `${g.id} ${s} ${k}: flagged far off exactly at 15 points over the fair chance (${t})`);
        chk(!bad1, `${g.id} ${s} ${k}: every part of the button exactly (${bad1})`);
      }
    }
  }
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
      chk(new RegExp(`opens 2 of the ${legs.length} legs`).test(note()) && /no DraftKings ids were read for its game/.test(note()) && $('pcDk').href.split('+').length === legs.length - 1, `a game with no ids: named, ${legs.length - 1} of ${legs.length} opened (${note().slice(0, 160)})`);
      noteOk('a game with no ids');
      Object.defineProperty(w.navigator, 'share', { value: async data => { shared.push(data); }, configurable: true });
      Object.defineProperty(w.navigator, 'canShare', { value: () => true, configurable: true });
      $('pcLink').click(); await wait(20);
      const t2 = shared[shared.length - 1].text || '';
      chk(t2.includes(`DraftKings betslip (opens 2 of the ${legs.length} legs as DraftKings had them; add leg 3 by hand):`) && t2.includes('Add by hand at DraftKings:\n3. ' + legs[2].who + ' ' + legs[2].bet + ' (no DraftKings id was read for its game)'), `the Share text names the leg to add by hand: ${JSON.stringify(t2).slice(0, 300)}`);
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
      chk(![...d.querySelectorAll('.pb-tl')].some(x => x.dataset.id.startsWith(g.id + '|')), `${tag}: ${g.away}@${g.home}, started, is in no level`);
      chk(!d.querySelector(`#pbGrid [data-g="${g.id}"]`), `${tag}: ${g.away}@${g.home} is not in the Games fold`);
      chk(!d.querySelector(`#plLines .pb-pg[data-id="${g.id}"]`) && !d.querySelector(`#plLines button[data-leg^="${g.id}|"]`), `${tag}: ${g.away}@${g.home} is not in Pick your own legs`);
      chk(!JSON.parse(w.localStorage.getItem('nhl_v1')).legs.some(l => l.game === g.id), `${tag}: ${g.away}@${g.home} is out of the builder`);
    };
    for (const g of nowStarted) nowhere(g, 'at the puck drop');
    chk(/left the builder: the puck dropped\./.test(txt(d.getElementById('bMsg'))), `a builder leg on a game that has started leaves it, said: ${txt(d.getElementById('bMsg'))}`);
    if (later) {
      const at2 = Date.parse(later.start) + 60000;
      /* the clock past the next puck drop before the watch has looked: a level none of whose games has started still finishes at
         once (another game's puck drop cannot change it); one holding the started game only redraws the panel */
      w.__setClock(at2);
      const tiers = () => [...d.querySelectorAll('.pb-tier:not(.none)')];
      const gidOf = x => S.games.find(g => g.id === x.dataset.id.split('|')[0]);
      const okLv = tiers().find(el => ![...el.querySelectorAll('.pb-tl')].some(x => sStarted(gidOf(x), at2)));
      if (okLv) {
        okLv.querySelector('[data-pb-finish]').click();
        chk(!d.getElementById('pcWin').hidden, `${okLv.dataset.tier}'s Finish opens the card though another game has dropped the puck since the panel was drawn`);
        d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      }
      const hitLv = tiers().find(el => [...el.querySelectorAll('.pb-tl')].some(x => sStarted(gidOf(x), at2)));
      if (hitLv) {
        const tier = hitLv.dataset.tier;
        /* the games any level held that have dropped the puck since, in the order the page names them */
        const held = [...new Set([...d.querySelectorAll('.pb-tier .pb-tl')].map(x => x.dataset.id.split('|')[0]))].map(id => S.games.find(g => g.id === id)).filter(g => sStarted(g, at2));
        const names = held.map(g => `${S.teams[g.away].abbr} @ ${S.teams[g.home].abbr}`), rebuilt = (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]) + ` dropped the puck: the levels were rebuilt without ${names.length > 1 ? 'them' : 'it'}.`;
        /* the rebuilt line holds only while the panel stays on the day shown. A puck drop that leaves that day no game to come
           moves the panel on, and it says so in place of the rebuilt line: the levels are the next day's now (PHI @ BUF and
           FLA @ OTT, 21 October 2026, both at 7:30 PM Eastern, were the whole day). With no day left to move to (the season's
           last, or between playoff rounds), or with the day shown keeping games but no fresh line while the next day has lines
           (the slate follows lined days), the panel is not on that day and its day is not over, so it says neither line */
        const slA = sSlate(at), slB = sSlate(at2), same = slA.dates.join() === slB.dates.join();
        const emptied = slA.dates.length > 0 && slA.dates.every(dd => !slB.on(dd).length);
        const moved = !same && emptied && slB.dates.length ? `Every game on ${slA.dates.map(dd => PBS.day(dd)).join(' and ')} has dropped the puck: the panel moved to ${slB.text}.` : null;
        const said = same ? rebuilt : moved;
        const fb = hitLv.querySelector('[data-pb-finish]'); fb.focus(); fb.click();
        chk(d.getElementById('pcWin').hidden && ![...d.querySelectorAll(`.pb-tier[data-tier="${tier}"] .pb-tl`)].some(x => sStarted(gidOf(x), at2)), `${tier}'s Finish, its game started, opens nothing and redraws the level without it`);
        const notes = txt(d.getElementById('pbNotes'));
        chk((said === null || notes.includes(said)) && (same || !notes.includes('the levels were rebuilt')) && (moved !== null || !notes.includes('has dropped the puck: the panel moved')),
          `and the panel says why: ${said !== null ? `"${said}"` : slB.dates.length ? `nothing, the panel on ${slB.text} while ${slA.text} keeps games with no fresh line` : 'nothing, no day left to move to'} (${notes.slice(0, 160)})`);
        const fb2 = d.querySelector(`[data-pb-finish="${tier}"]`);
        chk(fb2 ? d.activeElement === fb2 : d.activeElement === d.getElementById('pbTitle'), `the keyboard's focus stays on ${tier}'s Finish, redrawn, or with the level gone on the panel's heading (${d.activeElement && (d.activeElement.id || d.activeElement.tagName)})`);
      }
      d.dispatchEvent(new w.Event('visibilitychange'));
      for (const g of S.games.filter(g => sStarted(g, at2) && !sStarted(g, at))) nowhere(g, 'the watch, at the next puck drop');
      chk(/puck dropped/.test(txt(d.getElementById('bMsg'))), 'the watch says why the leg left');
      const sl = sSlate(at2);
      chk(txt(d.getElementById('pbSlate')) === (sl.text || 'no games'), `after the watch the slate is ${sl.text} (${txt(d.getElementById('pbSlate'))})`);
    }
    chk(!errs.length, 'no runtime error at the puck drop: ' + errs.join(' | '));
    holdRequests(w, 'the puck-drop boot');
  } else console.log('  fewer than two fresh games to come: the puck-drop checks of the builder skipped');
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
      const first = d.querySelector('#games').firstElementChild;
      d.dispatchEvent(new w.Event('visibilitychange')); d.dispatchEvent(new w.Event('visibilitychange'));
      chk(d.querySelector('#games').firstElementChild === first, 'the watch does not redraw the Games tab for a line of the panel');
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
      chk(![...d.querySelectorAll('.pb-tl')].some(x => x.dataset.id.startsWith(st.id + '|')) && !d.querySelector(`#plLines button[data-leg^="${st.id}|"]`) && !d.querySelector(`#pbGrid input[data-g="${st.id}"]`), 'a stale line is offered nowhere on the Parlay Builder');
      const stTile = [...d.querySelectorAll('#pbGrid .pb-gt.no')].find(x => txt(x).startsWith(`${S.teams[st.away].abbr} @ ${S.teams[st.home].abbr}`));
      chk(!!stTile && /line not on DraftKings at the last run/.test(txt(stTile)), `its tile says its line was not on DraftKings at the last run (${stTile ? txt(stTile) : 'no tile'})`);
      holdPanel(w, PUB + 60000, 'a stale line and a whole-number total', true);
      if (whole) {
        chk(![...d.querySelectorAll('.pb-tl')].some(x => x.dataset.id.startsWith(wh.id + '|') && /\|ou$/.test(x.dataset.id)), 'a whole-number total is in no level');
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
      const db = d.querySelector(`#days .day[data-day="${st.date}"]`); if (db) db.click();
      const c = d.querySelector(`#games .game[data-id="${st.id}"]`);
      chk(c && !c.querySelector('button[data-leg]') && txt(c.querySelector('.pb-stale')) === `line from ${clockOf(Date.parse(st.line.at))}: not on DraftKings at the last run`, `a stale line's card offers no bet and says why: ${c && txt(c.querySelector('.pb-stale'))}`);
      /* and shows the market's lines as chips, every number the line's, as the card does a game started */
      const L = st.line, mkW = [`Moneyline ${ab(st.away)} ${oddsS(L.awayML)} ${ab(st.home)} ${oddsS(L.homeML)}`].concat(L.homeLine !== null && L.homeLine !== undefined ? [`Puck line ${ab(st.away)} ${lineS(-L.homeLine)} ${oddsS(L.awaySpreadOdds)} ${ab(st.home)} ${lineS(L.homeLine)} ${oddsS(L.homeSpreadOdds)}`] : [], L.total !== null && L.total !== undefined ? [`Over/under ${L.total} o ${oddsS(L.overOdds)} · u ${oddsS(L.underOdds)}`] : []);
      const mkH = c ? [...c.querySelectorAll('.chip[data-ck="ml"], .chip[data-ck="pl"], .chip[data-ck="ou"]')].map(txt) : [];
      chk(eqA(mkH, mkW), `the stale card's market chips are the line's numbers ${JSON.stringify(mkW)} (${JSON.stringify(mkH)})`);
      if (c) { const bad = cardWrongs(w, c, st, PUB + 60000, pageMap(w)); chk(!bad.length, `the stale card is the state's (${bad.slice(0, 3).join(' | ')})`); }
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
      holdPanel(w, PUB + 60000, 'another book', true);
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
    let first = d.querySelector('#games').firstElementChild;
    d.dispatchEvent(new w.Event('visibilitychange')); d.dispatchEvent(new w.Event('visibilitychange'));
    chk(d.querySelector('#games').firstElementChild === first, 'the watch does not redraw the Games tab for legs already gone');
    if (mv) {
      const db = d.querySelector(`#days .day[data-day="${mv.date}"]`); if (db) db.click();
      const b = d.querySelector(`#games button[data-leg="${mv.id}|under|ou"]`);
      chk(!!b && !b.classList.contains('on') && b.getAttribute('aria-pressed') === 'false', `a leg stored at a total DraftKings has moved since is not shown as in the parlay (${b && txt(b)})`);
      d.querySelector('#tabs button[data-tab="parlays"]').click();
      chk(/left the builder: DraftKings' total is now /.test(txt(d.getElementById('bMsg'))), `and the builder says why (${txt(d.getElementById('bMsg'))})`);
      d.querySelector('#tabs button[data-tab="games"]').click();
    }
    /* the clock past the kept leg's puck drop: it leaves once, said, and the Games tab is redrawn no more than once */
    if (keep) {
      w.__setClock(Date.parse(keep.start) + 60000);
      d.dispatchEvent(new w.Event('visibilitychange'));
      chk(!JSON.parse(w.localStorage.getItem('nhl_v1')).legs.length, 'past its puck drop, the leg leaves the builder on the Games tab');
      const first2 = d.querySelector('#games').firstElementChild;
      d.dispatchEvent(new w.Event('visibilitychange')); d.dispatchEvent(new w.Event('visibilitychange'));
      chk(d.querySelector('#games').firstElementChild === first2, 'and the watch redraws the Games tab once, not again and again');
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
    try { const errs = [], w = await boot(at, errs, { state: JSON.stringify(M), hash: 'parlays' }); holdPanel(w, at, tag, true); chk(!errs.length, `${tag}: no runtime error: ${errs.join(' | ')}`); }
    finally { S = real; }
  };
  const copy = () => JSON.parse(STATE);
  { const M = copy(); M.games = []; await madeUp('no games', M, PUB + 60000); }
  if (S.games.length) await madeUp('every game started', copy(), Date.parse(S.games[S.games.length - 1].start) + 3600000);
  { const M = copy(); for (const g of M.games) if (g.state === 'pre' && g.line) { g.line = null; delete g.mlPick; delete g.plPick; delete g.ouPick; } await madeUp('no line', M, PUB + 60000); }
  if (fresh.length >= 3) {
    /* every game of the slate alike: the home side to win at 60% on -110 (a call), the away puck line at 62% on -150 and the under at 50% on
       +100 (thin): no 3-leg parlay reaches 25%, so Medium is the likeliest 3; every level is a tie broken by the leg ids */
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
/* the days a press reads: the strip's (yesterday to ten days out; the first week before the opener, the last after the end) from today on, with a game still to come */
function sOddsDays(ms) {
  const today = etDate(ms); let days = []; for (let d = addD(today, -1); d <= addD(today, 10); d = addD(d, 1)) days.push(d);
  const first = S.games.length ? S.games[0].date : null, last = S.games.length ? S.games[S.games.length - 1].date : null;
  if (first && first > days[days.length - 1]) { days = []; for (let d = first; d <= addD(first, 6); d = addD(d, 1)) days.push(d); }
  if (last && last < days[0]) { days = []; for (let d = addD(last, -6); d <= last; d = addD(d, 1)) days.push(d); }
  const shown = days.filter(d => d >= today);
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
  const when = clockOf(at), n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
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

/* the visitor's place on the levels through a read: a lock on Medium and New legs on Safe, then a read where nothing moved
   (every level, lock and Reset as they were, and the levels' cache kept) and one where every price moved (the lock kept on
   its leg while it still qualifies, Medium the best by its rule beside it, Safe its rule on the legs it has not shown, both
   by brute force on the new prices) */
async function lockChecks(ms) {
  const days = sOddsDays(ms), come = S.games.filter(g => days.includes(g.date) && !sStarted(g, ms) && g.line);
  let shift = 0;
  const bump = v => !PBS.ok(v) || !shift ? v : v > 0 ? v + shift : v - shift;
  const lineOf = L => ({ homeML: bump(L.homeML), awayML: bump(L.awayML), homeLine: L.homeLine, homeSpreadOdds: bump(L.homeSpreadOdds), awaySpreadOdds: bump(L.awaySpreadOdds), total: L.total, overOdds: bump(L.overOdds), underOdds: bump(L.underOdds) });
  const ans = () => { const a = {}; come.forEach((g, i) => { const L = g.line, ids = L.dk && L.dk.event && ['homeML', 'awayML'].every(k => typeof L.dk[k] === 'string') ? Object.assign({}, L.dk) : idsFor(L, String(60000000 + i), String(600000 + i)); delete ids.at; (a[g.date] = a[g.date] || []).push(espnEvent(g, espnOdds(lineOf(L), ids, L.book))); }); return a; };
  let A = ans();
  const errs = [], w = await boot(ms, errs, { hash: 'parlays', espn: async url => { const m = /dates=(\d{4})(\d{2})(\d{2})/.exec(url); return { ok: true, json: async () => ({ events: JSON.parse(JSON.stringify((m && A[`${m[1]}-${m[2]}-${m[3]}`]) || [])) }) }; } }), d = w.document;
  const tierLegs = id => [...d.querySelectorAll(`.pb-tier[data-tier="${id}"] .pb-tl`)].map(x => x.dataset.id);
  const med0 = tierLegs('med'), safe0 = tierLegs('safe');
  if (med0.length < 2 || safe0.length < 2 || !come.length) { console.log('  the levels have too few legs for a lock and New legs: the lock checks are skipped'); return; }
  const lockId = med0[0];
  d.querySelector(`[data-pb-lock="med|${lockId}"]`).click();
  d.querySelector('[data-pb-new="safe"]').click();
  const med1 = tierLegs('med'), safe1 = tierLegs('safe'), v1 = w.eval('ODDS.v'), g1 = pageGames(w);
  const locked = () => { const b = d.querySelector(`[data-pb-lock="med|${lockId}"]`); return !!b && b.getAttribute('aria-pressed') === 'true'; };
  const reset = id => !!d.querySelector(`[data-pb-reset="${id}"]`);
  chk(locked() && reset('med') && reset('safe') && canon(safe1) !== canon(safe0), `before a read: Medium's ${lockId} locked and Safe on New legs (${safe0.join(', ')} -> ${safe1.join(', ')})`);
  /* a read where nothing moved */
  d.getElementById('pbRefreshOdds').click(); await oddsDone(w);
  const g2 = pageGames(w), same = g2.every(g => { const o = g1.find(x => x.id === g.id); return DERIVED.every(k => canon(g[k]) === canon(o && o[k])) && canon(g.line && PRICE_K.map(k => g.line[k])) === canon(o && o.line && PRICE_K.map(k => o.line[k])); });
  chk(locked() && reset('med') && reset('safe'), `a read where nothing moved keeps Medium's lock and Safe's New legs (${locked() ? 'locked' : 'lock lost'}, ${reset('safe') ? 'Safe on New legs' : 'Safe reset'})`);
  if (same) {
    chk(canon(tierLegs('med')) === canon(med1) && canon(tierLegs('safe')) === canon(safe1), `and every level as it was (Medium ${tierLegs('med').join(', ')}; Safe ${tierLegs('safe').join(', ')})`);
    chk(w.eval('ODDS.v') === v1, `and the levels' cache as it was: nothing they stand on moved (reads ${v1} -> ${w.eval('ODDS.v')})`);
  }
  /* a read where every price moved, the numbers held */
  shift = 6; A = ans();
  d.getElementById('pbRefreshOdds').click(); await oddsDone(w);
  const g3 = pageGames(w), EXPL = JSON.parse(STATE);
  for (const g of EXPL.games) { const n = g3.find(x => x.id === g.id); if (n && n.line && n.line.refreshed) { const dv = sCall(JSON.parse(JSON.stringify(g)), n.line); for (const k of DERIVED) delete g[k]; Object.assign(g, dv, { line: n.line }); } }
  const real = S; S = EXPL;
  try {
    const wrong = g3.filter(n => n.line && n.line.refreshed).filter(n => { const g = EXPL.games.find(x => x.id === n.id); return DERIVED.some(k => canon(n[k]) !== canon(g[k])); });
    chk(!wrong.length, `the moved prices' calls are the job's rules on them (${wrong.length} differ)`);
    /* the lock holds while its leg qualifies and a parlay of Medium's size can be made beside it; else Medium is its default */
    const sl = sSlate(ms), pool = sPool(sl, PBS.KINDS, []), lockL = pool.legs.find(L => L.id === lockId);
    const withLock = lockL ? sBrute(pool.legs, 3, 0.25, lockId) : null, medB = withLock || sBrute(pool.legs, 3, 0.25);
    chk(locked() === !!withLock, `after prices moved, Medium's lock ${withLock ? 'holds: its leg still qualifies' : lockL ? 'is gone: no parlay of its size beside it' : 'is gone: its leg no longer qualifies'} (${locked() ? 'locked' : 'not locked'})`);
    chk(canon(tierLegs('med')) === canon(medB ? medB.legs.map(L => L.id) : []), `Medium is the best by its rule${withLock ? ' beside the lock' : ''} on the new prices: ${medB ? medB.legs.map(L => L.id).join(', ') : 'none'} (page: ${tierLegs('med').join(', ') || 'none'})`);
    /* Safe keeps New legs: its rule on the legs it has not shown, else (none left) back to the first; with no pair at all, its default */
    const shown = new Set(safe0), safeB = sBrute(pool.legs.filter(L => !shown.has(L.id)), 2, 0) || sBrute(pool.legs, 2, 0);
    chk(reset('safe') === !!safeB && canon(tierLegs('safe')) === canon(safeB ? safeB.legs.map(L => L.id) : []), `Safe keeps New legs: the likeliest pair on the new prices among the legs it has not shown (${safeB ? safeB.legs.map(L => L.id).join(', ') : 'none'}; page: ${tierLegs('safe').join(', ') || 'none'})`);
    const rows = [...d.querySelectorAll('.pb-tier[data-tier="med"] .pb-tl, .pb-tier[data-tier="safe"] .pb-tl')];
    chk(rows.every(r => { const [g, s2, k] = r.dataset.id.split('|'), L = sLeg(EXPL.games.find(x => x.id === g), s2, k); return L && txt(r).includes(PBS.odds(L.price)); }), 'and their legs show the new prices');
    console.log(`  the levels through a read: Medium locked on ${lockId}${lockL ? '' : ' (no longer qualifying after the prices moved)'}, Safe on New legs; nothing moved: ${same ? 'levels and cache held' : 'a rounding moved a call, levels not compared'}; prices moved: Medium ${tierLegs('med').join(', ')}, Safe ${tierLegs('safe').join(', ')}`);
  } finally { S = real; }
  chk(!errs.length, 'no runtime error through the lock checks: ' + errs.join(' | '));
}
const PRICE_K = ['book', 'homeML', 'awayML', 'homeLine', 'homeSpreadOdds', 'awaySpreadOdds', 'total', 'overOdds', 'underOdds'];
async function refreshOddsChecks() {
  console.log('REFRESH ODDS');
  const AT = PUB + 60000;
  /* the buttons, their status lines, the parse; no ESPN request for odds on load, on the watch or on a tab */
  {
    const errs = [], w = await boot(AT, errs, { hash: 'games' }), d = w.document;
    for (const [id, note, tab] of [['refreshOdds', 'oddsNote', 'games'], ['pbRefreshOdds', 'pbOddsNote', 'parlays']]) {
      const b = d.getElementById(id), s = d.getElementById(note);
      chk(!!b && b.tagName === 'BUTTON' && b.type === 'button' && !b.disabled && b.tabIndex >= 0 && txt(b) === 'Refresh odds' && b.closest('section') === d.getElementById('tab-' + tab), `${id}: a Refresh odds button on the ${tab} tab, a button the keyboard reaches`);
      chk(!!b && w.getComputedStyle(b).minHeight === '44px', `${id}: 44px tall (min-height ${b && w.getComputedStyle(b).minHeight})`);
      chk(!!s && s.getAttribute('role') === 'status' && s.getAttribute('aria-live') === 'polite' && b && b.nextElementSibling === s, `${id}: one aria-live status line beside it`);
      chk(!!s && txt(s) === `Lines published ${clockOf(PUB)}, the job's last run.`, `${id}: before a press its status line says when the lines were published (${s && txt(s)})`);
    }
    const open = d.querySelector('#days .day.on'), day = open ? open.dataset.day : null;
    const live = !!day && S.games.some(g => g.date === day && g.state !== 'final' && sStarted(g, AT));
    const want = live ? [`${SB_URL}?dates=${day.replace(/-/g, '')}&limit=100`] : [];
    const onLoad = () => espnReqs(w).map(r => r.url);
    chk(canon(onLoad()) === canon(want), `on load the page asks ESPN for nothing but the open day's scores${live ? ' (a game under way)' : ''}, never the odds (${onLoad().join(', ') || 'nothing'})`);
    d.dispatchEvent(new w.Event('visibilitychange')); d.dispatchEvent(new w.Event('visibilitychange'));
    for (const t of ['parlays', 'standings', 'games', 'parlays']) d.querySelector(`#tabs button[data-tab="${t}"]`).click();
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
  chk(txt(d.getElementById('pbOddsNote')) === said && txt(d.getElementById('oddsNote')) === said, `after the read the status line says "${said}" (${txt(d.getElementById('pbOddsNote'))})`);
  console.log(`  after the press: "${txt(d.getElementById('pbOddsNote'))}"; the builder ${legs.length} legs -> ${d.querySelectorAll('#legs .leg').length}`);
  chk(d.getElementById('pbRefreshOdds').getAttribute('aria-disabled') === null, 'and the button is no longer busy');
  /* nothing stored by the press */
  chk(w.__writes.length === writes0 && w.localStorage.getItem('nhl_v1') === store0, `the press writes nothing to storage (${w.__writes.length - writes0} writes)`);
  /* everything drawn from the prices: the panel by brute force on what the press should leave, the builder, the card's link */
  const EXP = JSON.parse(STATE);
  for (const g of EXP.games) if (expLine[g.id]) { const p = pub(g.id); for (const k of DERIVED) delete g[k]; Object.assign(g, sCall(p, expLine[g.id]), { line: Object.assign({}, expLine[g.id], { at: new Date(atMs).toISOString(), refreshed: true }) }); }
  const real = S; S = EXP;
  try {
    const PN = holdPanel(w, T2, 'after Refresh odds', true);
    const tick = PN.pool.tickable, rf = tick.filter(g => g.line.refreshed), pubN = tick.length - rf.length;
    if (tick.length) chk(txt(d.getElementById('pbRead')).includes(rf.length ? `as read from ESPN in this browser at ${clockOf(atMs)}${pubN ? ` (${pubN} of the ${tick.length} games as the job read ${pubN > 1 ? 'them' : 'it'} at ${clockOf(PUB)})` : ''}` : `as read at ${clockOf(PUB)}, the job's last run`), `the panel says when its prices were read (${txt(d.getElementById('pbRead'))})`);
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
    /* the Games cards: every bet at its new price and chance, the call tagged on the new edges */
    d.querySelector('#tabs button[data-tab="games"]').click();
    for (const g of [gA, gB, gC, gK, gN].filter(Boolean)) {
      const db = d.querySelector(`#days .day[data-day="${g.date}"]`); if (db) db.click();
      const c = d.querySelector(`#games .game[data-id="${g.id}"]`), eg = EXP.games.find(x => x.id === g.id);
      if (!c) { chk(false, `no card for ${g.id} after the press`); continue; }
      for (const k of PBS.KINDS) for (const s of PBS.SIDES[k]) {
        const L = sLeg(eg, s, k), btn = c.querySelector(`button[data-leg="${g.id}|${s}|${k}"]`);
        chk(!!L === !!btn, `${g.id} ${s} ${k}: after the press a button exactly where the new line prices it`);
        if (L && btn) { const bad1 = betWrong(btn, L, s); chk(!bad1, `${g.id} ${s} ${k}: the new price, chance and call (${bad1})`); }
      }
      chk(txt(c).includes(`as read from ESPN at ${clockOf(atMs)}`), `${g.id}: the card says its prices were read from ESPN (${txt(c.querySelector('.pb-key'))})`);
    }
    for (const g of early.slice(0, 3)) { const db = d.querySelector(`#days .day[data-day="${g.date}"]`); if (db) db.click(); const c = d.querySelector(`#games .game[data-id="${g.id}"]`); chk(!!c && !c.querySelector('button[data-leg]'), `${g.id}, started during the read, offers no bet`); }
  } finally { S = real; }
  /* the store after the press: tabs visited (each a save) keep the builder's legs as they were before it, the moved price and
     the moved puck line included; a reload on that store is the builder on the published lines, with nothing said changed */
  for (const t of ['standings', 'parlays']) d.querySelector(`#tabs button[data-tab="${t}"]`).click();
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
    holdPanel(w, T3, 'after a second press', true);
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
  await lockChecks(AT);
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
/* the props window's numbers for one stat, by this smoke's own rules: the rows DraftKings prices (the job's parse), each player's
   club, name, line, the projection, the model's chance and DraftKings' fair chance, and the Yes ladder without the main line's Over */
function ppExpect(g, parsed, k) {
  const pr = S.props && S.props.games[g.id], PL = (S.players && S.players.players) || {}, who = new Map();
  if (pr) for (const side of ['away', 'home']) { const Q = pr[side + 'P']; for (const p of Q.skaters) who.set(p.id, { name: p.name, team: g[side], D: k === 'sv' ? null : p[k], mine: true }); if (Q.goalie) who.set(Q.goalie.id, { name: Q.goalie.name, team: g[side], D: k === 'sv' ? Q.goalie.sv : null, mine: true }); }
  const info = id => who.get(id) || { name: PL[id] ? PL[id].name : null, team: PL[id] ? PL[id].team : null, D: null, mine: false };
  const out = new Map();
  for (const [a, st, L, po, pu] of (parsed ? parsed.main : [])) if (st === k) out.set(a, Object.assign({ id: a, M: { L, po, pu }, Y: [] }, info(a)));
  for (const [a, st, n, price] of (parsed ? parsed.yes : [])) if (st === k) { if (!out.has(a)) out.set(a, Object.assign({ id: a, M: null, Y: [] }, info(a))); out.get(a).Y.push({ k: n, price }); }
  for (const x of out.values()) {
    x.club = [g.home, g.away].includes(x.team) ? x.team : '';
    x.name = x.name || `ESPN athlete ${x.id}`;
    const proj = x.D ? `projection ${ppMuS(k, x.D.mu)}` : `no projection (${!pr ? 'the props model has not projected this game' : k === 'sv' ? 'not the goalie the model expects' : x.mine ? 'no number for this stat' : "not in the model's expected lineup"})`;
    x.cmp = x.M ? [proj, x.D ? `model ${ppPctS(atLeastS(x.D, Math.floor(x.M.L) + 1))}` : '', `DraftKings ${ppPctS(1 - PBS.imp(x.M.pu))}`].filter(Boolean).join(' · ') : proj;
    x.chips = x.Y.filter(y => !x.M || y.k !== Math.floor(x.M.L) + 1).sort((a, b) => a.k - b.k).map(y => { const f = fairYesS(k, y.k, y.price); return `${k === 'g' && y.k === 1 ? 'Anytime goal' : y.k + '+'} ${PBS.odds(y.price)}${x.D ? ` · model ${ppPctS(atLeastS(x.D, y.k))}` : ''} · DraftKings ${f === null ? '—' : ppPctS(f) + ' est.'}`; });
  }
  const unpriced = [];
  for (const [id, x] of who) if (!out.has(id) && x.D) unpriced.push({ id, club: x.team, cmp: `projection ${ppMuS(k, x.D.mu)}` });
  return { priced: out, unpriced };
}
/* the window, stat by stat, against ppExpect: every row and every number */
function ppHold(w, g, parsed, tag) {
  const d = w.document, bad = [];
  let rows = 0, alone = 0;
  for (const k of PP_STATS_S) {
    const tb = d.querySelector(`#ppStats button[data-pp-tab="${k}"]`); if (!tb) { bad.push(`no ${k} tab`); continue; }
    tb.click();
    const E2 = ppExpect(g, parsed, k), on = d.querySelector(`#ppStats button[data-pp-tab="${k}"]`);
    if (!on || on.getAttribute('aria-pressed') !== 'true') bad.push(`${k}: its tab not pressed`);
    if (parsed && txt(on.querySelector('small')) !== String(E2.priced.size)) bad.push(`${k}: the tab counts ${txt(on.querySelector('small'))}, DraftKings prices ${E2.priced.size}`);
    const all = [...d.querySelectorAll(`#ppBody .pp-row[data-pp-stat="${k}"]`)], top = all.filter(r => !r.closest('details.pp-more')), more = all.filter(r => r.closest('details.pp-more'));
    const shown = parsed ? top : [];
    if (parsed && canon(top.map(r => r.dataset.ppRow).sort()) !== canon([...E2.priced.keys()].sort())) bad.push(`${k}: rows ${top.map(r => r.dataset.ppRow).sort().join(',').slice(0, 120)} where DraftKings prices ${[...E2.priced.keys()].sort().join(',').slice(0, 120)}`);
    for (const r of shown) {
      const x = E2.priced.get(r.dataset.ppRow); if (!x) continue; rows++;
      const sec = r.closest('section.pp-team');
      if (!sec || sec.dataset.ppTeam !== x.club) bad.push(`${k} ${x.name}: under ${sec && sec.dataset.ppTeam} not ${x.club || 'the unmatched'}`);
      if (txt(r.querySelector('.pp-who b')) !== x.name) bad.push(`${k} ${x.id}: named ${txt(r.querySelector('.pp-who b'))}, not ${x.name}`);
      if (txt(r.querySelector('.pp-cmp')) !== x.cmp) bad.push(`${k} ${x.name}: "${txt(r.querySelector('.pp-cmp'))}" where "${x.cmp}"`);
      const mt = txt(r.querySelector('.pp-main'));
      if (x.M ? !(mt.includes(`Over ${x.M.L} ${PBS.odds(x.M.po)}`) && mt.includes(`Under ${x.M.L} ${PBS.odds(x.M.pu)}`)) : !!r.querySelector('.pp-main')) bad.push(`${k} ${x.name}: the line "${mt}"`);
      const chips = [...r.querySelectorAll('.pp-k')].map(txt);
      if (canon(chips) !== canon(x.chips)) bad.push(`${k} ${x.name}: milestones ${chips.join(' | ')} where ${x.chips.join(' | ')}`);
    }
    /* the expected players with no DraftKings line: their projection alone (folded under their club once DraftKings has props) */
    const rest = parsed ? more : top; alone += rest.length;
    if (canon(rest.map(r => r.dataset.ppRow).sort()) !== canon(E2.unpriced.map(u => u.id).sort())) bad.push(`${k}: ${rest.length} rows with a projection alone where ${E2.unpriced.length} expected players have no DraftKings line`);
    for (const u of E2.unpriced) { const r = rest.find(x => x.dataset.ppRow === u.id); if (r && (txt(r.querySelector('.pp-cmp')) !== u.cmp || r.querySelector('.pp-main, .pp-k') || r.closest('section.pp-team').dataset.ppTeam !== u.club)) bad.push(`${k} ${u.id}: "${txt(r.querySelector('.pp-cmp'))}" where "${u.cmp}" under ${u.club}`); }
  }
  d.querySelector('#ppStats button[data-pp-tab="pts"]').click();
  console.log(`  ${tag}: ${rows} rows DraftKings prices and ${alone} with the projection alone, over six stats, held number for number`);
  chk(!bad.length, `${tag}: every row of the props window is DraftKings' line, the projection, the model's chance and DraftKings' fair chance worked out here (${rows} priced rows over six stats; ${bad.length} wrong: ${bad.slice(0, 3).join(' | ')})`);
}
/* the trial note and the ledger's running numbers, by this smoke's own wording; never "model says", "edge" or a verdict before the bar */
function ppTrialChecks(w, tag) {
  const d = w.document, win = txt(d.getElementById('ppWin')), tr = txt(d.getElementById('ppTrial'));
  chk(/props model on trial/.test(txt(d.getElementById('ppGame'))) && tr.startsWith("The props model is on trial. Its projection and its chance sit beside DraftKings' line to be compared, not followed: it has not been shown to beat DraftKings' own prices, and nothing on this site is suggested from it. A DraftKings price can go in your parlay (tap it once it has been read: the job reads them on every run, Refresh odds now), at DraftKings' price as read; the suggested levels never use a prop."), `${tag}: the window says the props model is on trial and suggests nothing (${tr.slice(0, 120)})`);
  const Lg = S.props.ledger, of = (+Lg.of || 0).toLocaleString('en-US'), f4 = v => (+v).toFixed(4);
  const nums = Lg.model && Lg.market ? ` Log loss: model ${f4(Lg.model.logloss)}, DraftKings ${f4(Lg.market.logloss)}; Brier: model ${f4(Lg.model.brier)}, DraftKings ${f4(Lg.market.brier)} (lower is better).` : '';
  const want = Lg.decision === 'PASS' || Lg.decision === 'FAIL' ? `Its shadow ledger was decided at ${of} graded lines: ${Lg.decision}.${nums}`
    : `Its shadow ledger: ${(+Lg.compared || 0).toLocaleString('en-US')} of ${of} DraftKings main lines graded${+Lg.graded_games ? `, in ${Lg.graded_games} game${+Lg.graded_games === 1 ? '' : 's'}` : ''}.${nums} The verdict comes at ${of}, not before.`;
  chk(tr.endsWith(want), `${tag}: the ledger's running numbers, quietly ("${want}": ${tr.slice(-160)})`);
  chk(Lg.decision || !/\bpass/i.test(tr), `${tag}: no word of passing before the bar is decided`);
  const ppBtns = [...d.querySelectorAll('button[data-pp]')];
  chk(ppBtns.length > 0 && !/model says|\bedge/i.test(win) && !ppBtns.some(b => /model says|\bedge/i.test(txt(b) + ' ' + b.title)), `${tag}: neither the window nor a Player props button says "model says" or "edge" on a prop (${ppBtns.length} buttons)`);
  chk(!d.querySelector('#ppWin button[data-leg], #ppWin [data-pb-add], #ppWin [data-pc-finish]'), `${tag}: nothing in the window puts a level or a game's bet in a parlay`);
  const rd = w.eval('PP && PROPS.games[PP.gid] ? PROPS.games[PP.gid].status : null');
  if (rd !== 200) chk(!d.querySelector('#ppWin [data-pp-add]'), `${tag}: with no DraftKings price read, no price in the window can be added (${d.querySelectorAll('#ppWin [data-pp-add]').length})`);
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
    const allBtn = () => [...d.querySelectorAll('button[data-pp]')];
    const days = [...d.querySelectorAll('#days .day')].map(b => b.dataset.day), seen = new Map();
    for (const dd of days) { const b = d.querySelector(`#days .day[data-day="${dd}"]`); if (b) b.click(); for (const x of allBtn()) seen.set(x.dataset.pp, txt(x) + ' | ' + x.title); }
    const want = S.games.filter(g => !sStarted(g, AT) && S.props && S.props.games && S.props.games[g.id]).map(g => g.id).sort();
    chk(canon([...seen.keys()].sort()) === canon(want), `before a press a Player props button on every game still to come that the props model projects, and on no other (${seen.size} buttons, ${want.length} projected)`);
    chk(seen.size > 0 === want.length > 0 && [...seen.values()].every(t => t === "Player props | the model's projections (on trial) · press Refresh odds for DraftKings' props"), `and each says it shows the model's projections, on trial, until Refresh odds (${[...seen.values()][0]})`);
    for (const b of allBtn().slice(0, 1)) chk(w.getComputedStyle(b).minHeight === '44px' && b.getAttribute('aria-haspopup') === 'dialog', 'a Player props button is 44px tall and says it opens a window');
    let g0 = null;
    if (projected.length) {
      g0 = projected[0];
      const db = d.querySelector(`#days .day[data-day="${g0.date}"]`); if (db) db.click();
      const opener = d.querySelector(`#games .game[data-id="${g0.id}"] button[data-pp]`);
      opener.click();
      chk(!d.getElementById('ppWin').hidden && d.activeElement === d.getElementById('ppPanel'), `a Player props button opens the window on its game, the focus in it (${g0.away} @ ${g0.home})`);
      chk(txt(d.getElementById('ppRead')) === "Press Refresh odds for DraftKings' player props on this game. Shown until then: the props model's projections for the expected players.", `before a press the window says to press Refresh odds for DraftKings' props (${txt(d.getElementById('ppRead'))})`);
      ppHold(w, g0, null, 'before a press');
      ppTrialChecks(w, 'before a press');
      for (const el of [d.getElementById('ppClose'), d.getElementById('ppRefreshOdds'), ...d.querySelectorAll('#ppStats button'), d.querySelector('.pp-how > summary')]) chk(!!el && w.getComputedStyle(el).minHeight === '44px', `the window's ${el ? (el.id || txt(el).slice(0, 20)) : 'control'} is 44px tall`);
      /* Tab stays inside the window; Escape closes it and the focus goes back to the button */
      d.getElementById('ppClose').focus();
      d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
      chk(d.getElementById('ppPanel').contains(d.activeElement) && d.activeElement !== d.getElementById('ppClose'), `Shift+Tab from the first control stays in the window (${d.activeElement && (d.activeElement.id || d.activeElement.tagName)})`);
      d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
      chk(d.activeElement === d.getElementById('ppClose'), 'and Tab from the last comes back to the first');
      d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      chk(d.getElementById('ppWin').hidden && d.activeElement === opener, 'Escape closes the window and the focus goes back to its button');
      opener.click(); d.getElementById('ppWin').click();
      chk(d.getElementById('ppWin').hidden, 'a click outside closes it');
      opener.click(); d.getElementById('ppClose').click();
      chk(d.getElementById('ppWin').hidden, 'and Close closes it');
      /* Pick your own legs carries the button too, on a game with a fresh line the model projects */
      d.querySelector('#tabs button[data-tab="parlays"]').click();
      const pick = d.querySelector('#plLines .pb-pg button[data-pp]');
      if (pick) {
        const pg = S.games.find(g => g.id === pick.dataset.pp); pick.click();
        /* the window's head names the game by its clubs' pills, "PIT @ COL", as the NBA's sheet does */
        chk(!d.getElementById('ppWin').hidden && txt(d.querySelector('#ppGame .mu')) === `${S.teams[pg.away].abbr} @ ${S.teams[pg.home].abbr}`, `Pick your own legs carries the Player props button, which opens its game (${txt(d.querySelector('#ppGame .mu'))})`);
        d.getElementById('ppClose').click();
      }
      d.dispatchEvent(new w.Event('visibilitychange'));
      for (const t of ['standings', 'games', 'players', 'parlays']) d.querySelector(`#tabs button[data-tab="${t}"]`).click();
    } else console.log('  no game still to come today or tomorrow that the props model projects: the window before a press is not opened');
    chk(!propReqs(w).length, `nothing asks ESPN for props without a press: load, the window, its stats, the watch and the tabs (${propReqs(w).length} asked)`);
    const st1 = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}');
    chk(!/pp|prop/i.test(JSON.stringify(Object.keys(st1).concat(Object.keys(st1.ui || {})))), `the window stores nothing: nhl_v1 holds no props key (${Object.keys(st1).join(', ')}; ui ${Object.keys(st1.ui || {}).join(', ')})`);
    chk(!errs.length, 'no runtime error before a press: ' + errs.join(' | '));
    void st0; void writes0;
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
  const tiers0 = [...d.querySelectorAll('.pb-tier .pb-tl')].map(x => x.dataset.id), legs0 = w.eval('JSON.stringify(P.legs)');
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
  /* nothing suggested from the model, nothing stored: the lines, the levels' cache, every level and the builder as before, no player anywhere in the panel or the builder */
  chk(canon(pageGames(w)) === games0 && w.eval('ODDS.v') === v0 && w.eval('JSON.stringify(P.legs)') === legs0, 'the props read moves nothing the levels or the builder stand on: every game, line and leg as before, the levels\' cache unmoved');
  void tiers0;
  const names = [...new Set([].concat(...Object.values(S.props.games).map(r => [...r.homeP.skaters, ...r.awayP.skaters].map(p => p.name))))].filter(n => n && n.length > 5);
  chk(d.querySelectorAll('#plLines button[data-pp]').length > 0 || !d.querySelector('#plLines .pb-pg'), 'Pick your own legs carries the Player props buttons it is held without');
  const panelT = ['pbPanel', 'builder', 'slip', 'plLines'].map(id => { const el = d.getElementById(id); if (!el) return ''; const c = el.cloneNode(true); c.querySelectorAll('button[data-pp]').forEach(x => x.remove()); return txt(c); }).join(' ');
  chk(!names.some(n => panelT.includes(n)) && [...d.querySelectorAll('.pb-tier .pb-tl, #legs .leg')].every(x => /^\d+\|(home|away|over|under)\|(ml|pl|ou)$/.test(x.dataset.id)), 'no player is put in a level, the builder or Pick your own legs: every leg is a game\'s');
  chk(w.__writes.length === writes0 && w.localStorage.getItem('nhl_v1') === store0, `the press writes nothing to storage (${w.__writes.length - writes0} writes)`);
  /* the window on the game read in two pages: every number worked out here */
  d.querySelector('#tabs button[data-tab="games"]').click();
  const writesA = w.__writes.length;                       // the tab's own save; from here on nothing is written
  const dayOn = dd => { const b = d.querySelector(`#days .day[data-day="${dd}"]`); if (b) b.click(); };     // the strip is drawn again on each click
  dayOn(G.date);
  const opener = d.querySelector(`#games .game[data-id="${G.id}"] button[data-pp]`);
  const nG = parsedG.main.length, yG = parsedG.yes.length, wordG = nG ? `${nG} line${nG === 1 ? '' : 's'}` : `${yG} price${yG === 1 ? '' : 's'}`;
  chk(!!opener && txt(opener) === `Player props · ${wordG} · ${clockOf(at)}` && opener.title === `DraftKings: ${nG} main line${nG === 1 ? '' : 's'} and ${yG} milestone price${yG === 1 ? '' : 's'}, read ${clockOf(at)}` && opener.classList.contains('has'), `after the press the game's button says what DraftKings has, and when, lit (${opener && txt(opener) + ' | ' + opener.title})`);
  for (const [g, word, title] of [[H, 'Player props · not read', "DraftKings' props could not be read"]].concat(live.filter(g => !taken.has(g.id) && S.props.games[g.id]).slice(0, 1).map(g => [g, `Player props · none posted yet · ${clockOf(at)}`, `DraftKings: none posted yet (read ${clockOf(at)})`]))) {
    if (!g || !S.props.games[g.id]) continue;
    const db = d.querySelector(`#days .day[data-day="${g.date}"]`); if (db) db.click();
    const b = d.querySelector(`#games .game[data-id="${g.id}"] button[data-pp]`);
    chk(!!b && txt(b) === word && b.title === title && !b.classList.contains('has'), `${g.id}: its button says "${word}" ("${title}") (${b && txt(b) + ' | ' + b.title})`);
  }
  dayOn(G.date);
  d.querySelector(`#games .game[data-id="${G.id}"] button[data-pp]`).click();
  chk(txt(d.getElementById('ppRead')) === `DraftKings' player props from ESPN, read ${clockOf(at)}: ${parsedG.main.length} main line${parsedG.main.length === 1 ? '' : 's'} and ${parsedG.yes.length} milestone price${parsedG.yes.length === 1 ? '' : 's'}. Gone with a reload; Refresh odds reads them again.`, `the window says when DraftKings' props were read (${txt(d.getElementById('ppRead'))})`);
  ppHold(w, G, parsedG, `${G.away} @ ${G.home} after the press`);
  ppTrialChecks(w, 'after the press');
  if (A.left) { d.querySelector('#ppStats button[data-pp-tab="s"]').click(); const r = d.querySelector(`#ppBody .pp-row[data-pp-row="${A.left}"]`); chk(!!r && /not in the model's expected lineup/.test(txt(r)), `a player DraftKings prices whom the model leaves out is matched by his ESPN id to his club, with no projection (${r && txt(r).slice(0, 100)})`); }
  { d.querySelector('#ppStats button[data-pp-tab="pts"]').click(); const r = d.querySelector('#ppBody section.pp-team[data-pp-team=""] .pp-row[data-pp-row="990000001"]'); chk(!!r && txt(r.querySelector('.pp-who b')) === 'ESPN athlete 990000001', 'an athlete nobody rates is shown apart, by his ESPN id'); }
  chk(w.__writes.length === writesA, `opening the window and its stats writes nothing (${w.__writes.length - writesA} writes)`);
  /* the windows on a failed read and on none posted yet */
  const winOn = g => { d.getElementById('ppClose').click(); const db = d.querySelector(`#days .day[data-day="${g.date}"]`); if (db) db.click(); const b = d.querySelector(`#games .game[data-id="${g.id}"] button[data-pp]`); if (b) b.click(); return !!b; };
  if (H && S.props.games[H.id] && winOn(H)) chk(txt(d.getElementById('ppRead')) === `ESPN's player props could not be read at ${clockOf(at)} (HTTP 503): press Refresh odds to try again. Shown: the props model's projections.`, `a failed read says so, the projections shown (${txt(d.getElementById('ppRead'))})`);
  const g404 = live.find(g => !taken.has(g.id) && S.props.games[g.id]);
  if (g404 && winOn(g404)) { chk(txt(d.getElementById('ppRead')) === `DraftKings has posted no player props for this game yet (ESPN, read ${clockOf(at)}): they usually go up on game day, the goalies' saves last. Shown: the props model's projections.`, `a 404 says none posted yet (${txt(d.getElementById('ppRead'))})`); ppHold(w, g404, null, 'a game with none posted'); }
  for (const g of [PO, CA].filter(Boolean)) if (winOn(g)) {
    chk(!w.eval(`PROPS.games[${JSON.stringify(g.id)}]`) && txt(d.getElementById('ppRead')).startsWith("Press Refresh odds for DraftKings' player props on this game.") && !d.querySelector('#ppBody .pp-main, #ppBody .pp-k'),
      `${g.id}, ${g === PO ? 'postponed' : 'cancelled'} at ESPN: no DraftKings row in its window, though ESPN answered its props (${txt(d.getElementById('ppRead')).slice(0, 80)})`);
    ppHold(w, g, null, `a game ${g === PO ? 'postponed' : 'cancelled'} at ESPN`);
  }
  winOn(G);
  /* a second press, the game read before failing now: its earlier read stands, said */
  const n1 = propReqs(w).length, T3 = T2 + 120000;
  if (!sStarted(G, T3)) {
    w.__setClock(T3);
    propsNow = async url => { const m = PROPS_RX.exec(url); return m && m[1] === G.id ? { ok: false, status: 502, json: async () => ({}) } : PROPS_404(url); };
    const before2 = JSON.stringify(JSON.parse(w.eval('JSON.stringify(PROPS.games)'))[G.id]);
    const p2had = P2 ? w.eval(`PROPS.games[${JSON.stringify(P2.id)}] && PROPS.games[${JSON.stringify(P2.id)}].status`) : null;
    if (P2) offNow.set(P2.id, OFF);                                                          // ESPN now has the game read in its first page postponed
    d.getElementById('ppRefreshOdds').click(); await oddsDone(w); await wait(20);           // the window's own Refresh odds: the same press
    const ask3 = sPropsAsk(T3), after2 = JSON.stringify(JSON.parse(w.eval('JSON.stringify(PROPS.games)'))[G.id]);
    const off3 = ask3.filter(g => offNow.has(g.id) && g !== I);
    const q3 = { asked: ask3.length, none: ask3.filter(g => g !== G && g !== I && !offNow.has(g.id)).length, failed: 1, kept: 1, started: ask3.includes(I) ? 1 : 0, off: off3.length };
    if (P2 && ask3.includes(P2)) chk(p2had === 200 && !w.eval(`PROPS.games[${JSON.stringify(P2.id)}]`), `a game ESPN postpones after a read loses that earlier read: its props are no longer shown (${p2had} before, ${w.eval(`JSON.stringify(PROPS.games[${JSON.stringify(P2.id)}] || null)`)} after)`);
    chk(propReqs(w).length - n1 === ask3.length && after2 === before2, `a second press reads again, and a game whose read fails keeps this page's earlier read (${propReqs(w).length - n1} asked of ${ask3.length}; ${after2 === before2 ? 'kept' : 'changed'})`);
    chk(txt(d.getElementById('ppOddsNote')).endsWith(sPropsText(q3)), `and the status line, beside the window's own Refresh odds, says so ("${sPropsText(q3).trim()}": ${txt(d.getElementById('ppOddsNote')).slice(-160)})`);
    chk(!d.getElementById('ppWin').hidden && d.querySelectorAll('#ppBody .pp-row .pp-main').length > 0 && txt(d.getElementById('ppRead')).includes(`read ${clockOf(at)}:`), 'the window stays open through the press, on the read it keeps');
  } else console.log('  the game read in two pages starts within two minutes: the second press is skipped');
  /* the watch: the game's puck drops with the window open */
  w.__setClock(Date.parse(G.start) + 60000);
  d.dispatchEvent(new w.Event('visibilitychange'));
  chk(txt(d.getElementById('ppRead')) === 'The puck has dropped on this game: its player props are no longer shown.' && !d.querySelector('#ppBody .pp-row') && !d.querySelector('#ppStats button'), `the window on a game whose puck drops says so and shows nothing more (${txt(d.getElementById('ppRead'))})`);
  d.getElementById('ppClose').click();
  chk(!d.querySelector(`#games .game[data-id="${G.id}"] button[data-pp]`), 'and its card no longer offers the props');
  chk(w.__writes.length === writesA, `nothing in all of it is stored (${w.__writes.length - writesA} writes)`);
  holdRequests(w, 'the props press');
  chk(!errs.length, 'no runtime error through the props press: ' + errs.join(' | '));
  /* nothing suggested: a press whose props answer prices a projected game in full and whose scoreboard moves no line leaves every
     level, its legs and its cache exactly as they were, and the panel's pool holds game legs alone */
  {
    const errsS = [], wS = await boot(AT, errsS, { hash: 'parlays', espn: async url => { const mm = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), dd = mm && `${mm[1]}-${mm[2]}-${mm[3]}`; return { ok: true, json: async () => ({ events: S.games.filter(g => g.date === dd).map(g => espnEvent(g, null)) }) }; },
      props: async url => { const m = PROPS_RX.exec(url); return m && m[1] === G.id ? { ok: true, status: 200, json: async () => ({ pageCount: 1, items: JSON.parse(JSON.stringify(A.items)) }) } : PROPS_404(url); } }), dS = wS.document;
    const lv = () => canon([...dS.querySelectorAll('.pb-tier')].map(t => [t.dataset.tier, [...t.querySelectorAll('.pb-tl')].map(x => x.dataset.id), txt(t.querySelector('.pb-nums'))]));
    const l0 = lv(), v1 = wS.eval('ODDS.v'), g1 = canon(pageGames(wS));
    dS.getElementById('pbRefreshOdds').click(); await oddsDone(wS);
    const pool = JSON.parse(wS.eval('JSON.stringify(PB_CUR && PB_CUR.pool ? (PB_CUR.pool.legs || []).map(L => L.id) : [])'));
    chk(wS.eval('PROPS.games[' + JSON.stringify(G.id) + '] && PROPS.games[' + JSON.stringify(G.id) + '].status') === 200 && lv() === l0 && wS.eval('ODDS.v') === v1 && canon(pageGames(wS)) === g1, `a props read changes no level, no leg of one and no number on one (${l0.slice(0, 120)})`);
    chk(pool.every(id => /^\d+\|(home|away|over|under)\|(ml|pl|ou)$/.test(id)), `the panel's pool after the props read holds game legs alone (${pool.length} legs)`);
    chk(!errsS.length, 'no runtime error on the nothing-suggested press: ' + errsS.join(' | '));
  }
  /* a reload: the published page again, the projections alone */
  {
    const errsR = [], wR = await boot(T2, errsR, { hash: 'games', store: w.localStorage.getItem('nhl_v1') }), dR = wR.document;
    const db = dR.querySelector(`#days .day[data-day="${G.date}"]`); if (db) db.click();
    const b = dR.querySelector(`#games .game[data-id="${G.id}"] button[data-pp]`);
    chk(!!b && txt(b) === 'Player props' && b.title === "the model's projections (on trial) · press Refresh odds for DraftKings' props" && wR.eval('Object.keys(PROPS.games).length') === 0, `a reload is the published page: no DraftKings props, the button back to the projections (${b && txt(b)})`);
    if (b) { b.click(); chk(txt(dR.getElementById('ppRead')).startsWith("Press Refresh odds for DraftKings' player props on this game.") && !dR.querySelector('#ppBody .pp-main, #ppBody .pp-k'), 'and its window shows the projections alone until a press'); }
    chk(!propReqs(wR).length && !errsR.length, `and asks ESPN for no props (${propReqs(wR).length}; ${errsR.join(' | ')})`);
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
/* a Player props button's words, title and light on a read, by this smoke's own wording */
function ppBtnWant(rd) {
  if (!rd) return ['Player props', "the model's projections (on trial) · press Refresh odds for DraftKings' props", false];
  const T = clockOf(Date.parse(rd.at));
  if (rd.status === 200) return [`Player props · ${rd.main.length ? sN(rd.main.length, 'line', 'lines') : sN(rd.yes.length, 'price', 'prices')} · ${T}`, `DraftKings: ${sN(rd.main.length, 'main line', 'main lines')} and ${sN(rd.yes.length, 'milestone price', 'milestone prices')}, read ${T}`, rd.main.length + rd.yes.length > 0];
  if (rd.status === 404) return [`Player props · none posted yet · ${T}`, `DraftKings: none posted yet (read ${T})`, false];
  return ['Player props · not read', "DraftKings' props could not be read", false];
}
/* the window's read line: the job's read said as the job's, a press's said as gone with a reload (the job's read back where the
   state carries one) */
function ppReadWant(rd, hasJob) {
  const T = clockOf(Date.parse(rd.at)), job = rd.src === 'job';
  if (rd.status === 200) return `DraftKings' player props from ESPN, read ${T}${job ? " at the job's last run" : ''}: ${sN(rd.main.length, 'main line', 'main lines')} and ${sN(rd.yes.length, 'milestone price', 'milestone prices')}. ${job ? 'Refresh odds reads them again now.' : hasJob ? "A reload brings back the job's read; Refresh odds reads them again." : 'Gone with a reload; Refresh odds reads them again.'}`;
  if (rd.status === 404) return `DraftKings has posted no player props for this game yet (ESPN, read ${T}${job ? " at the job's last run" : ''}): they usually go up on game day, the goalies' saves last. Shown: the props model's projections.`;
  return `ESPN's player props could not be read ${job ? `at the job's last run (${T}, ${rd.why})` : `at ${T} (${rd.why})`}: press Refresh odds to try again. Shown: the props model's projections.`;
}
async function holdJobRead(body, tag) {
  const J = JSON.parse(body), pg = (J.props && J.props.games) || {}, AT = PUB + 60000;
  const want = {}; for (const id of Object.keys(pg)) { const s = dkSeed(pg[id].dk); if (s) want[id] = s; }
  const hasJob = id => !!(pg[id] && pg[id].dk);
  const sbFn = async url => { const mm = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), dd = mm && `${mm[1]}-${mm[2]}-${mm[3]}`; return { ok: true, json: async () => ({ events: S.games.filter(g => g.date === dd).map(g => espnEvent(g, null)) }) }; };
  let propsNow = url => ({ ok: false, status: 503, json: async () => ({}) });
  const errs = [], w = await boot(AT, errs, { hash: 'games', keepDk: true, state: body, espn: sbFn, props: url => propsNow(url) }), d = w.document;
  /* on load: PROPS is the job's read, game for game, and nothing asked */
  const PR0 = JSON.parse(w.eval('JSON.stringify(PROPS.games)'));
  chk(canon(PR0) === canon(want), `${tag}: the page starts from the job's read, every game as the state carries it (${Object.keys(want).length} games; the page holds ${Object.keys(PR0).length})`);
  chk(!propReqs(w).length, `${tag}: and asks ESPN for no props on load (${propReqs(w).length} asked)`);
  /* every Player props button on the strip, by the read it stands on */
  const buttons = () => { const seen = new Map(); for (const b0 of [...d.querySelectorAll('#days .day')]) { const dd = b0.dataset.day, b = d.querySelector(`#days .day[data-day="${dd}"]`); if (b) b.click(); for (const x of d.querySelectorAll('#games button[data-pp]')) seen.set(x.dataset.pp, x); } return seen; };
  const btnBad = (seen, of) => [...seen].filter(([id, b]) => { const [word, title, has] = ppBtnWant(of(id)); return txt(b) !== word || b.title !== title || b.classList.contains('has') !== has; }).map(([id, b]) => `${id}: "${txt(b)}" | ${b.title}`);
  {
    const seen = buttons(), toCome = S.games.filter(g => !sStarted(g, AT) && (pg[g.id] || want[g.id])).map(g => g.id).sort();
    chk(canon([...seen.keys()].sort()) === canon(toCome), `${tag}: a Player props button on every game still to come the props model projects or the job read, and no other (${seen.size} buttons, ${toCome.length} games)`);
    const bad = btnBad(seen, id => want[id] || null);
    chk(!bad.length, `${tag}: each button says what the job's read has and when, lit where DraftKings priced the game (${seen.size} buttons; ${bad.length} wrong: ${bad.slice(0, 2).join(' || ')})`);
  }
  /* every window on a game still to come with a read, row for row */
  const winOn = g => { if (!d.getElementById('ppWin').hidden) d.getElementById('ppClose').click(); const db = d.querySelector(`#days .day[data-day="${g.date}"]`); if (db) db.click(); const b = d.querySelector(`#games .game[data-id="${g.id}"] button[data-pp]`); if (b) b.click(); return !!b && !d.getElementById('ppWin').hidden; };
  const read = S.games.filter(g => want[g.id] && !sStarted(g, AT)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || (a.id < b.id ? -1 : 1));
  for (const g of read) {
    if (!winOn(g)) { chk(false, `${tag}: ${g.id}'s window opens`); continue; }
    const rd = want[g.id];
    chk(txt(d.getElementById('ppRead')) === ppReadWant(rd, true), `${tag}, ${g.away} @ ${g.home}: the window says it shows the job's read and when ("${txt(d.getElementById('ppRead'))}")`);
    ppHold(w, g, rd.status === 200 ? { main: rd.main, yes: rd.yes } : null, `${tag}, ${g.away} @ ${g.home} (the job's read, ${rd.status})`);
  }
  if (read.length) ppTrialChecks(w, `${tag}, the job's read`);
  /* a price put in the parlay from the job's read: at its price and the read's time, and so after a reload */
  const G = read.find(g => want[g.id].status === 200);
  let store = null;
  if (G && winOn(G)) {
    const tb = d.querySelector('#ppStats button[data-pp-tab="pts"]'); if (tb) tb.click();
    const btn = d.querySelector('#ppBody button[data-pp-add]');
    if (btn) {
      const key = btn.dataset.ppAdd, [pid, stat, mk, a, b] = key.split('|'), rd = want[G.id];
      const m = mk === 'main' ? rd.main.find(r => r[0] === pid && r[1] === stat && r[2] === +b) : rd.yes.find(r => r[0] === pid && r[1] === stat && r[2] === +a);
      const price = mk === 'main' ? (a === 'over' ? m[3] : m[4]) : m[3];
      btn.click();
      const legs = JSON.parse(w.eval('JSON.stringify(P.legs)')), L = legs.find(l => l.kind === 'prop' && l.pid === pid && l.stat === stat);
      chk(!!L && L.odds === price && L.at === rd.at && L.game === G.id, `${tag}: a price in the window's job read goes in the parlay at DraftKings' price as the job read it, dated by that read (${L ? `${L.odds} at ${L.at}` : 'none'}; the read ${price} at ${rd.at})`);
      chk(txt(d.getElementById('ppMsg')).includes(`DraftKings as read ${clockOf(Date.parse(rd.at))}`), `${tag}: and the window says when it was read (${txt(d.getElementById('ppMsg')).slice(0, 160)})`);
      store = w.localStorage.getItem('nhl_v1');
      const e2 = [], w2 = await boot(AT, e2, { hash: 'parlays', keepDk: true, state: body, store });
      const drawn = JSON.parse(w2.eval('JSON.stringify(builderLegs(false).filter(L => L.prop).map(L => [L.pid, L.stat, L.price, L.at]))'));
      chk(drawn.some(x => x[0] === pid && x[1] === stat && x[2] === price && x[3] === rd.at), `${tag}: a reload draws it at the job's price, the same read (${JSON.stringify(drawn).slice(0, 160)})`);
      chk(!e2.length, `${tag}: no runtime error on the reload: ${e2.join(' | ')}`);
      d.querySelector(`#ppBody button[data-pp-add="${key}"]`).click();
      chk(!JSON.parse(w.eval('JSON.stringify(P.legs)')).some(l => l.kind === 'prop'), `${tag}: a second tap takes it out`);
    } else console.log(`  ${tag}: no price on ${G.id} the builder can take: the add is not tried`);
  }
  if (!d.getElementById('ppWin').hidden) d.getElementById('ppClose').click();
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
    const seen = buttons(), bb = btnBad(seen, id => PR1[id] || null);
    chk(!bb.length, `${tag}: each button says the read it now stands on (${seen.size}; ${bb.slice(0, 2).join(' || ')})`);
    if (G && winOn(G)) chk(txt(d.getElementById('ppRead')) === ppReadWant(want[G.id], true), `${tag}: the window still says it shows the job's read (${txt(d.getElementById('ppRead'))})`);
    const Gf = ask.find(g => !want[g.id] || want[g.id].status === 'failed');
    if (Gf && at1 && (pg[Gf.id] || PR1[Gf.id]) && winOn(Gf)) chk(txt(d.getElementById('ppRead')) === ppReadWant(PR1[Gf.id], hasJob(Gf.id)), `${tag}: a game the press failed on and the job did not read says the press's failure (${txt(d.getElementById('ppRead'))})`);
    if (!d.getElementById('ppWin').hidden) d.getElementById('ppClose').click();
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
      if (winOn(G2)) {
        chk(txt(d.getElementById('ppRead')) === ppReadWant(r2, hasJob(G2.id)), `${tag}: the window says the press's read and that a reload brings back the job's (${txt(d.getElementById('ppRead'))})`);
        ppHold(w, G2, parsed2, `${tag}, ${G2.away} @ ${G2.home} after a press`);
      }
      const seen = buttons(), bb2 = btnBad(seen, id => PR2[id] || null);
      chk(!bb2.length, `${tag}: each button says the press's read (${seen.size}; ${bb2.slice(0, 2).join(' || ')})`);
    }
  } else console.log(`  ${tag}: no game for a press to read: the presses are skipped`);
  /* a reload: the job's read again, nothing asked */
  const e3 = [], w3 = await boot(AT, e3, { hash: 'games', keepDk: true, state: body });
  chk(canon(JSON.parse(w3.eval('JSON.stringify(PROPS.games)'))) === canon(want) && !propReqs(w3).length, `${tag}: a reload starts from the job's read again, asking ESPN for nothing`);
  chk(!errs.length && !e3.length, `${tag}: no runtime error: ${errs.concat(e3).join(' | ')}`);
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
    const G = cand.sort((a, b) => Date.parse(a.start) - Date.parse(b.start) || (a.id < b.id ? -1 : 1))[0];
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
  const day = d.querySelector(`#days .day[data-day="${G.date}"]`); if (day) day.click();
  d.querySelector(`#games .game[data-id="${G.id}"] button[data-pp]`).click();
  $('ppRefreshOdds').click(); await oddsDone(w); await wait(20);
  chk(canon(ofG()) === canon(first), `the press re-reads the ${MAX} legs at their lines and keeps them (${ofG().length})`);
  const tab = st => { d.querySelector(`#ppStats button[data-pp-tab="${st}"]`).click(); };
  const btn = c => { tab(c.st); return d.querySelector(`#ppBody button[data-pp-add="${c.x.id}|${c.st}|main|over|${c.m[2]}"]`); };
  const nth = cand[MAX], ref = `Not added: your parlay has ${MAX} legs of ${S.teams[G.away].abbr} @ ${S.teams[G.home].abbr} already, the most of one game this page can price.`;
  const b22 = btn(nth); if (b22) b22.click();
  chk(!!b22 && canon(ofG()) === canon(first) && txt($('ppMsg')) === ref && btn(nth).getAttribute('aria-pressed') === 'false', `one more leg of a game holding ${MAX} is refused, said plainly, nothing added (${txt($('ppMsg'))})`);
  btn(cand[0]).click();
  chk(ofG().length === MAX - 1, `one taken out leaves ${MAX - 1} (${ofG().length})`);
  btn(nth).click();
  chk(ofG().length === MAX && ofG().includes(nth.x.id + '|' + nth.st), `and makes room for the one refused (${ofG().length})`);
  $('ppClose').click();
  /* a team bet past the most: refused on the slip bar, nothing stored */
  const legsNow = canon(JSON.parse(w.localStorage.getItem('nhl_v1')).legs);
  const ml = d.querySelector(`#games .game[data-id="${G.id}"] button[data-leg="${G.id}|home|ml"]`);
  if (ml) {
    ml.click();
    chk(canon(JSON.parse(w.localStorage.getItem('nhl_v1')).legs) === legsNow && ofG().length === MAX && txt($('slipMsg')) === ref, `a team bet past the most legs of one game is refused on the slip bar, nothing stored (${txt($('slipMsg'))})`);
    /* the refusal stands only until the parlay changes: a leg taken out (in the props window, or a bet tapped off) or one added after
       without a word of its own leaves the slip bar saying nothing of it */
    const leg = k => d.querySelector(`#games .game[data-id="${G.id}"] button[data-leg="${G.id}|${k}"]`);
    d.querySelector(`#games .game[data-id="${G.id}"] button[data-pp]`).click();
    btn(cand[1]).click(); $('ppClose').click();
    chk(ofG().length === MAX - 1 && txt($('slipMsg')) === '', `a leg taken out in the props window ends the refusal on the slip bar (${ofG().length}; "${txt($('slipMsg'))}")`);
    leg('home|ml').click();
    chk(ofG().length === MAX && txt($('slipMsg')) === '', `the team bet then goes in, the slip bar saying nothing of the refusal (${ofG().length}; "${txt($('slipMsg'))}")`);
    if (leg('over|ou')) {
      leg('over|ou').click();
      chk(ofG().length === MAX && txt($('slipMsg')) === ref, `the total past the most is refused on the slip bar (${txt($('slipMsg'))})`);
      const hb = () => d.querySelector(`#games .game[data-id="${H.id}"] button[data-leg="${H.id}|home|ml"]`);
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
      d.querySelector('#tabs button[data-tab="games"]').click(); const dG = d.querySelector(`#days .day[data-day="${G.date}"]`); if (dG) dG.click();
      /* a replacement said on the slip bar goes the same way: at a player's price added in the props window without a word of its own,
         and at a level's Add to builder */
      const pin = () => new Set(ofG()), pp = () => d.querySelector(`#games .game[data-id="${G.id}"] button[data-pp]`).click();
      pp(); const outC = cand.find(c => pin().has(c.x.id + '|' + c.st)); if (outC) btn(outC).click(); $('ppClose').click();
      if (!ous().includes('over')) { if (ous().includes('under')) leg('under|ou').click(); leg('over|ou').click(); }
      leg('under|ou').click();
      const rep = txt($('slipMsg'));
      chk(!!outC && ofG().length === MAX - 1 && ous().join() === 'under' && /^Under [\d.]+ replaced Over [\d.]+ on .*: one total a game\.$/.test(rep), `the Under in place of the Over is said on the slip bar (${ofG().length}; ${rep})`);
      pp(); const inC = cand.find(c => !pin().has(c.x.id + '|' + c.st)), nb = inC && btn(inC); if (nb) nb.click(); $('ppClose').click();
      chk(!!nb && pin().has(inC.x.id + '|' + inC.st) && ofG().length === MAX && txt($('slipMsg')) === '', `a player's price added in the props window, without a word of its own, ends the replacement on the slip bar (${ofG().length}; "${txt($('slipMsg'))}")`);
      leg('over|ou').click();
      chk(ous().join() === 'over' && ofG().length === MAX && /^Over [\d.]+ replaced Under [\d.]+ on /.test(txt($('slipMsg'))), `the Over back in place of the Under at the most is said on the slip bar (${txt($('slipMsg'))})`);
      d.querySelector('#tabs button[data-tab="parlays"]').click();
      const lvB = () => d.querySelector('#pbBody button[data-pb-add]:not([disabled])'), pd = d.querySelector(`#pbDay button[data-day="${G.date}"]`);
      if (!lvB() && pd) pd.click();                // the panel on G's day, which has G and H lined, where its own day has no level
      const lv = lvB(); if (lv) lv.click();
      if (!lv) console.log(`  no level to add on the panel's slate (${G.date}): a level's Add to builder ending a replacement on the slip bar is not held on this state`);
      else chk(JSON.parse(w.eval('JSON.stringify(PB_CUR.levels[' + JSON.stringify(lv.dataset.pbAdd) + '].legs.map(L => L.id))')).join() === JSON.parse(w.eval('JSON.stringify(builderLegs(false).map(L => L.id))')).join() && txt($('slipMsg')) === '', `a level's Add to builder ends the replacement on the slip bar (${lv.dataset.pbAdd}; "${txt($('slipMsg'))}")`);
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
    const day = d.querySelector(`#days .day[data-day="${G.date}"]`); if (day) day.click();
    d.querySelector(`#games .game[data-id="${G.id}"] button[data-pp]`).click();
    d.getElementById('ppRefreshOdds').click(); await oddsDone(w); await wait(20);
  };
  const tap = (w, key, st) => { const d = w.document; d.querySelector(`#ppStats button[data-pp-tab="${st}"]`).click(); const b = d.querySelector(`#ppBody button[data-pp-add="${key}"]`); if (b) b.click(); return !!b; };
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
  w7.document.getElementById('ppClose').click();
  const ml7 = w7.document.querySelector(`#games .game[data-id="${G.id}"] button[data-leg="${G.id}|home|ml"]`); if (ml7) ml7.click();
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
  d9.getElementById('ppClose').click();
  const tot = side => d9.querySelector(`#games .game[data-id="${G.id}"] button[data-leg="${G.id}|${side}|ou"]`);
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
  d9.querySelector(`#games .game[data-id="${G.id}"] button[data-pp]`).click();
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
    const r1 = restB[1], bP = () => { const dd = wB.document; dd.querySelector(`#ppStats button[data-pp-tab="${r1.st}"]`).click(); const z = dd.querySelector(`#ppBody button[data-pp-add="${keyOf(r1)}"]`); return z && z.getAttribute('aria-pressed'); };
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
    await press(wT); wT.document.getElementById('ppClose').click();
    const tq = Date.now(), dT = wT.document, bet = (sel, k) => [...dT.querySelectorAll(`${sel} button[data-leg="${G.id}|${k}"]`)];
    const pressed = (k, sel) => bet(sel || '#games', k).map(b => b.getAttribute('aria-pressed') + (b.querySelector('.pb-bin') ? '+in' : '')).join();
    const tab = k => dT.querySelector(`#tabs button[data-tab="${k}"]`).click();      // each tab is drawn when shown
    const mlD = `${S.teams[G.home].short} to win`, ovD = `Over ${G.line.total}`, pg = [pressed('over|ou'), pressed('home|ml')];
    tab('parlays'); const pl = [bet('#plLines', 'over|ou').length, pressed('over|ou', '#plLines'), pressed('home|ml', '#plLines')]; tab('games');
    chk(canon(ofG(wT, 'drawn')) === canon(['home|ml']) && canon(ofG(wT)) === canon(['home|ml', 'over|ou'].sort()) && bet('#games', 'over|ou').length === 1 && pg.join(';') === 'false;true+in' && (!pl[0] || pl.slice(1).join(';') === 'false;true+in'), `${bk}: the moneyline drawn and the Over left out, the Over's button on the Games card${pl[0] ? ' and in Pick your own legs' : ''} not pressed (Games ${pg}; Pick your own legs ${pl})`);
    bet('#games', 'over|ou')[0].click();
    const sayT = inPlace(ovD, mlD);
    chk(canon(ofG(wT, 'drawn')) === canon(['over|ou']) && canon(inStore(wT)) === canon(['home|ml', 'over|ou'].sort()) && /^true\+in/.test(pressed('over|ou')) && /^false/.test(pressed('home|ml')) && txt(dT.getElementById('slipMsg')) === sayT, `${bk}: a tap on the Over puts it in place of the moneyline, both kept stored, said on the slip bar (${canon(inStore(wT))}; ${pressed('over|ou')}; "${txt(dT.getElementById('slipMsg'))}")`);
    if (Date.now() - tq < 8000) chk(!base(wT).includes(leftOut(ovD)), `${bk}: the read's line on the slip bar no longer says the Over is left out ("${base(wT).slice(0, 200)}")`);
    const wT2 = await boot(AT, errsB, { state: JSON.stringify(M), hash: 'parlays', espn: sbB, props, store: wT.localStorage.getItem('nhl_v1') });
    chk(canon(ofG(wT2, 'drawn')) === canon(['home|ml', 'over|ou'].sort()), `${bk}: a reload on the published DraftKings line opens on the moneyline and the Over (${canon(ofG(wT2, 'drawn'))})`);
    bet('#games', 'over|ou')[0].click();
    const sayT2 = inPlace(mlD, ovD), slT2 = txt(dT.getElementById('slipMsg')); tab('parlays');
    chk(canon(inStore(wT)) === canon(['home|ml']) && canon(ofG(wT, 'drawn')) === canon(['home|ml']) && slT2 === sayT2 && txt(dT.getElementById('bMsg')).startsWith(sayT2), `${bk}: the Over tapped again comes out, the moneyline drawn in its place, said on the slip bar and in the builder (${canon(inStore(wT))}; "${slT2}"; "${txt(dT.getElementById('bMsg')).slice(0, 200)}")`);
  }
  /* a team bet at a number a read has moved: the same side at the old number, out of the builder and stored, is replaced, said */
  {
    const T0 = G.line.total, sbM = async url => { const mm = /dates=(\d{4})(\d{2})(\d{2})/.exec(url), dd = mm && `${mm[1]}-${mm[2]}-${mm[3]}`; return { ok: true, json: async () => ({ events: S.games.filter(g => g.date === dd).map(g => espnEvent(g, g.id === G.id ? espnOdds(Object.assign({}, g.line, { total: T0 + 1 }), null) : null)) }) }; };
    const ml = { game: G.id, side: 'home', kind: 'ml', odds: G.line.homeML, line: null, p: G.pHome, label: mu, text: '', date: G.date, start: G.start };
    const ov = { game: G.id, side: 'over', kind: 'ou', odds: G.line.overOdds, line: T0, p: G.ou.over, label: mu, text: '', date: G.date, start: G.start };
    const wM = await boot(AT, errsB, { state: JSON.stringify(M), hash: 'parlays', espn: sbM, props, store: JSON.stringify({ legs: [ml, ov], ui: { tab: 'parlays' } }) });
    await press(wM); wM.document.getElementById('ppClose').click();
    const ovB = () => wM.document.querySelector(`#games .game[data-id="${G.id}"] button[data-leg="${G.id}|over|ou"]`);
    chk(canon(ofG(wM, 'drawn')) === canon(['home|ml']) && canon(ofG(wM)) === canon(['home|ml', 'over|ou'].sort()) && !!ovB() && ovB().getAttribute('aria-pressed') === 'false', `a read that moves the total to ${T0 + 1} takes the Over ${T0} out of the builder and keeps it stored, the Over's button not pressed (${canon(ofG(wM, 'drawn'))})`);
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
      await press(wX); wX.document.getElementById('ppClose').click();
      const dX = wX.document, open = () => dX.querySelector('#pbBody button[data-pb-add]:not([disabled])'); dX.querySelector('#tabs button[data-tab="parlays"]').click();
      const pd = dX.querySelector(`#pbDay button[data-day="${G.date}"]`); if (!open() && pd) pd.click();
      const id = wX.eval(`(() => { const id = Object.keys(PB_CUR.levels).find(k => { const r = PB_CUR.levels[k]; return r && r.legs && r.legs.length >= 2 && document.querySelector('#pbBody button[data-pb-add="' + k + '"]:not([disabled])'); }); if (!id) return null;
        const g = gameById()[${JSON.stringify(G.id)}], L = legOf(g, 'over', 'ou'), r = PB_CUR.levels[id], rest = r.legs.filter(x => x.game !== g.id).slice(0, r.legs.length - 1);
        if (!L || L.num !== ${T0 + 1}) return null;
        PB_CUR = Object.assign({}, PB_CUR, { levels: Object.assign({}, PB_CUR.levels, { [id]: Object.assign({}, r, { legs: rest.concat([L]).sort(legCmp) }) }) });
        return id; })()`);
      if (!id) { console.log(`  no level to plant the Over at ${T0 + 1} on: Add to builder beside a stored leg at a moved number not held`); break; }
      const t = JSON.parse(wX.eval(`JSON.stringify(PB_TIERS.find(x => x[0] === ${JSON.stringify(id)}))`)), what = `${t[1]} ${t[2]}-leg parlay`;
      const s0 = wX.localStorage.getItem('nhl_v1'), a0 = wX.__asked.length; wX.__confirm = false;
      dX.querySelector(`#pbBody button[data-pb-add="${id}"]`).click();
      const asked = wX.__asked.slice(a0).join(' | '); wX.__confirm = true;
      const want = n ? `Replace the 1 leg in the builder, and the 1 leg kept on this device that it leaves out of the parlay, with the ${what}?` : `Replace the 1 leg kept on this device that the builder leaves out of the parlay with the ${what}?`;
      chk(asked === want && wX.localStorage.getItem('nhl_v1') === s0 && canon(inStore(wX)) === canon(legs.map(l => l.side + '|' + l.kind).sort()), `a level holding the Over at ${T0 + 1} does not keep the stored Over ${T0}: with ${n} leg${n === 1 ? '' : 's'} drawn, Add to builder asks before it goes, and No keeps the store (${asked || 'not asked'})`);
    }
  }
  /* a level's Add to builder and Clear all ask before any stored leg goes, those the builder leaves out among them: five player legs
     stored, a press finds no props posted on the game (ESPN's 404), none drawn */
  {
    const wA = await boot(AT, errsB, { state: JSON.stringify(M), hash: 'parlays', espn: sb, props: PROPS_404, store: JSON.stringify({ legs: cand.slice(0, 5).map(legOf), ui: { tab: 'parlays' } }) });
    await press(wA); wA.document.getElementById('ppClose').click();
    const dA = wA.document, before = () => JSON.stringify((JSON.parse(wA.localStorage.getItem('nhl_v1') || '{}').legs || []));
    chk(ofG(wA).length === 5 && ofG(wA, 'drawn').length === 0, `a press that finds no props posted takes the 5 out of the builder and keeps them stored (${ofG(wA).length} stored, ${ofG(wA, 'drawn').length} drawn)`);
    dA.querySelector('#tabs button[data-tab="parlays"]').click();
    const lvB = () => dA.querySelector('#pbBody button[data-pb-add]:not([disabled])'), pd = dA.querySelector(`#pbDay button[data-day="${G.date}"]`);
    if (!lvB() && pd) pd.click();
    const lv = lvB(), t = lv && JSON.parse(wA.eval(`JSON.stringify(PB_TIERS.find(x => x[0] === ${JSON.stringify(lv.dataset.pbAdd)}))`)), what = t && `${t[1]} ${t[2]}-leg parlay`;
    if (!lv) console.log('  no level to add on the panel\'s slate: a level\'s Add to builder asking before the legs it leaves out go is not held on this state');
    else {
      const s0 = before(), a0 = wA.__asked.length; wA.__confirm = false; lv.click();
      chk(before() === s0 && wA.__asked.slice(a0).join(' | ') === `Replace the 5 legs kept on this device that the builder leaves out of the parlay with the ${what}?`, `with none drawn and 5 stored, Add to builder asks first, and No keeps them (${wA.__asked.slice(a0).join(' | ') || 'not asked'})`);
      const mlA = dA.querySelector(`#games .game[data-id="${G.id}"] button[data-leg="${G.id}|home|ml"]`); if (mlA) mlA.click();
      chk(!!mlA && ofG(wA).length === 6 && canon(ofG(wA, 'drawn')) === canon(['home|ml']), `the home moneyline goes in beside them (${ofG(wA).length} stored, ${canon(ofG(wA, 'drawn'))})`);
      const s1 = before(), a1 = wA.__asked.length; dA.getElementById('clearParlay').click();
      chk(before() === s1 && wA.__asked.slice(a1).join(' | ') === 'Clear the 1 leg from the builder, and the 5 legs kept on this device that it leaves out of the parlay?', `Clear all with 1 drawn and 5 left out asks first, and No keeps all 6 (${wA.__asked.slice(a1).join(' | ') || 'not asked'})`);
      const lv2 = lvB(), a2 = wA.__asked.length; if (lv2) lv2.click();
      chk(!!lv2 && before() === s1 && wA.__asked.slice(a2).join(' | ') === `Replace the 1 leg in the builder, and the 5 legs kept on this device that it leaves out of the parlay, with the ${JSON.parse(wA.eval(`JSON.stringify(PB_TIERS.find(x => x[0] === ${JSON.stringify(lv2 && lv2.dataset.pbAdd)}).slice(1, 3).join(' '))`))}-leg parlay?`, `Add to builder with 1 drawn and 5 left out asks about all 6, and No keeps them (${wA.__asked.slice(a2).join(' | ') || 'not asked'})`);
      wA.__confirm = true; const lv3 = lvB(), id3 = lv3 && lv3.dataset.pbAdd; if (lv3) lv3.click();
      const ids3 = id3 ? JSON.parse(wA.eval(`JSON.stringify(PB_CUR.levels[${JSON.stringify(id3)}].legs.map(L => L.id))`)) : [];
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
  const tiers = () => canon([...d.querySelectorAll('.pb-tier')].map(t => [t.dataset.tier, [...t.querySelectorAll('.pb-tl')].map(x => x.dataset.id), txt(t.querySelector('.pb-nums')), txt(t.querySelector('.pb-rule'))]));
  const tiers0 = tiers();
  holdPanel(w, AT, 'before any player leg', true);          // what the levels are held to below: the rules' own, by brute force
  /* before a press: no price in a window can be added */
  const dayOn = dd => { const b = d.querySelector(`#days .day[data-day="${dd}"]`); if (b) b.click(); };
  d.querySelector('#tabs button[data-tab="games"]').click(); dayOn(G.date);
  d.querySelector(`#games .game[data-id="${G.id}"] button[data-pp]`).click();
  chk(!d.querySelector('#ppBody [data-pp-add]'), 'before a press the props window offers nothing to add');
  $('ppRefreshOdds').click(); await oddsDone(w); await wait(20);
  const readAt = w.eval(`PROPS.games[${JSON.stringify(G.id)}].at`), writes0 = w.__writes.length;
  chk(!!readAt && w.eval(`PROPS.games[${JSON.stringify(G.id)}].status`) === 200, `the press read DraftKings' props on ${G.id}`);
  /* the players: X an away forward with a points line, Y a home skater with a shots 3+ price, Z the home goalie with a saves line */
  const mainOf = (pid, st) => parsed.main.find(r => r[0] === String(pid) && r[1] === st), yesOf = (pid, st, k) => parsed.yes.find(r => r[0] === String(pid) && r[1] === st && r[2] === k);
  const X = pr.awayP.skaters.find(p => p.pos !== 'D' && mainOf(p.id, 'pts') && yesOf(p.id, 'g', 1)), Y = pr.homeP.skaters.find(p => yesOf(p.id, 's', 3) && (!mainOf(p.id, 's') || mainOf(p.id, 's')[2] !== 2.5) && p.id !== (X && X.id)), Z = pr.homeP.goalie && mainOf(pr.homeP.goalie.id, 'sv') ? pr.homeP.goalie : null;
  if (!X || !Y) { chk(false, `the made-up answer prices an away forward's points and a home skater's shots 3+ (${X && X.id}, ${Y && Y.id})`); return; }
  /* every DraftKings price a 44px button the keyboard reaches; none for an athlete matched to neither club */
  const tab = st => { d.querySelector(`#ppStats button[data-pp-tab="${st}"]`).click(); };
  let nBtn = 0; const badB = [];
  for (const st of PP_STATS_S) {
    tab(st);
    for (const r of d.querySelectorAll('#ppBody .pp-row')) {
      const id = r.dataset.ppRow, sec = r.closest('section.pp-team'), club = sec && sec.dataset.ppTeam, btns = [...r.querySelectorAll('[data-pp-add]')];
      const priced = [...r.querySelectorAll('.pp-main > *, .pp-k')].length;
      const should = !!club && [G.home, G.away].includes(club) && !r.closest('details.pp-more');
      if (should ? btns.length !== priced : btns.length) badB.push(`${st} ${id}: ${btns.length} buttons of ${priced} prices under ${club || 'neither club'}`);
      for (const b of btns) { nBtn++; if (b.tagName !== 'BUTTON' || b.type !== 'button' || b.disabled || b.tabIndex < 0 || w.getComputedStyle(b).minHeight !== '44px' || b.getAttribute('aria-pressed') !== 'false') badB.push(`${st} ${id}: ${b.dataset.ppAdd} not a 44px button the keyboard reaches, unpressed`); }
    }
  }
  chk(nBtn > 50 && !badB.length, `after the press every DraftKings price of a player of the game's clubs is a 44px button the keyboard reaches, and an athlete matched to neither club has none (${nBtn} buttons; ${badB.slice(0, 3).join(' | ')})`);
  /* the add: X's points Over, into the builder at DraftKings' price as read, dated by the read; the button pressed; said in the window */
  const xm = mainOf(X.id, 'pts');
  tab('pts');
  const xb = () => d.querySelector(`#ppBody button[data-pp-add="${X.id}|pts|main|over|${xm[2]}"]`);
  xb().focus(); xb().click();
  const want1 = { game: G.id, kind: 'prop', pid: String(X.id), team: G.away, grp: 'F', stat: 'pts', mk: 'main', side: 'over', line: xm[2], k: null, odds: xm[3], other: xm[4], at: readAt };
  const s1 = (store().legs || []).find(l => l.kind === 'prop');
  chk(!!s1 && Object.keys(want1).every(k => canon(s1[k]) === canon(want1[k])) && s1.name === X.name, `a tap puts the leg in the builder at DraftKings' price as read, its line, side, player, game and read time (${canon(s1 || null).slice(0, 260)})`);
  chk(xb() && xb().getAttribute('aria-pressed') === 'true' && d.activeElement === xb(), 'the price is pressed, the keyboard\'s focus kept on it');
  chk(txt($('ppMsg')) === `Added to your parlay: ${X.name} Over ${xm[2]} points, ${PBS.odds(xm[3])}, DraftKings as read ${clockOf(Date.parse(readAt))}. Your parlay: 1 leg.`, `the window says what it added (${txt($('ppMsg'))})`);
  /* refused: X's goals beside his points; replaced: X's points Under in his Over's place */
  tab('g');
  const xg = d.querySelector(`#ppBody button[data-pp-add="${X.id}|g|yes|1"]`), legs1 = canon(store().legs);
  xg.click();
  chk(canon(store().legs) === legs1 && txt($('ppMsg')) === `Not added: ${X.name}'s points and his own goals are nearly one bet (every goal is a point). DraftKings may not take both on one ticket, so this page never puts them together.`.replace(`${X.name}'s`, /s$/.test(X.name) ? `${X.name}'` : `${X.name}'s`), `a player's goals beside his own points are refused, said plainly (${txt($('ppMsg'))})`);
  /* refused both ways round with assists: W's points beside his own assists, and his assists beside his own points (W another skater
     of the game with an assists line); neither is stored, each said plainly, and each taken out again by a second tap */
  const possS = nm => /s$/.test(nm) ? `${nm}'` : `${nm}'s`;
  const W = pr.awayP.skaters.concat(pr.homeP.skaters).find(p => p.id !== X.id && p.id !== Y.id && mainOf(p.id, 'a') && mainOf(p.id, 'pts'));
  if (!W) chk(false, `the made-up answer prices a skater's assists beside his points (${G.id})`);
  else {
    const wa = mainOf(W.id, 'a'), wp = mainOf(W.id, 'pts'), refA = `Not added: ${possS(W.name)} points and his own assists are nearly one bet (every assist is a point). DraftKings may not take both on one ticket, so this page never puts them together.`;
    const wB = (st, m) => d.querySelector(`#ppBody button[data-pp-add="${W.id}|${st}|main|over|${m[2]}"]`);
    tab('a'); wB('a', wa).click();
    chk(store().legs.some(l => l.kind === 'prop' && l.pid === String(W.id) && l.stat === 'a'), `${W.name}'s assists Over ${wa[2]} goes in beside ${X.name}'s points`);
    const legsA = canon(store().legs);
    tab('pts'); wB('pts', wp).click();
    chk(canon(store().legs) === legsA && txt($('ppMsg')) === refA && wB('pts', wp).getAttribute('aria-pressed') === 'false', `a player's points beside his own assists are refused, said plainly, nothing stored (${txt($('ppMsg'))})`);
    tab('a'); wB('a', wa).click();
    tab('pts'); wB('pts', wp).click();
    const legsP = canon(store().legs);
    chk(store().legs.some(l => l.kind === 'prop' && l.pid === String(W.id) && l.stat === 'pts') && !store().legs.some(l => l.kind === 'prop' && l.pid === String(W.id) && l.stat === 'a'), `with his assists taken out, ${W.name}'s points go in`);
    tab('a'); wB('a', wa).click();
    chk(canon(store().legs) === legsP && txt($('ppMsg')) === refA && wB('a', wa).getAttribute('aria-pressed') === 'false', `a player's assists beside his own points are refused the same way round, said, nothing stored (${txt($('ppMsg'))})`);
    tab('pts'); wB('pts', wp).click();
    chk(!store().legs.some(l => l.kind === 'prop' && l.pid === String(W.id)), `and ${W.name}'s points are taken out again`);
  }
  tab('pts');
  d.querySelector(`#ppBody button[data-pp-add="${X.id}|pts|main|under|${xm[2]}"]`).click();
  chk(store().legs.filter(l => l.kind === 'prop').length === 1 && store().legs.find(l => l.kind === 'prop').side === 'under' && txt($('ppMsg')).startsWith(`${X.name} Under ${xm[2]} points replaced ${X.name} Over ${xm[2]} points on ${mu}: one leg a player a stat.`), `one leg a player a stat: his Under takes his Over's place, said (${txt($('ppMsg'))})`);
  chk(txt($('slipMsg')) === `${X.name} Under ${xm[2]} points replaced ${X.name} Over ${xm[2]} points on ${mu}: one leg a player a stat.`, `and said on the slip bar, as a side bet's replacement is (${txt($('slipMsg'))})`);
  d.querySelector(`#ppBody button[data-pp-add="${X.id}|pts|main|under|${xm[2]}"]`).click();
  chk(!store().legs.some(l => l.kind === 'prop') && txt($('ppMsg')).startsWith(`Taken out of your parlay: ${X.name} Under ${xm[2]} points.`), `a second tap takes it out (${txt($('ppMsg'))})`);
  xb().click();
  $('ppClose').click();
  /* the bet buttons by the same-game rule: the home moneyline joins X (a same-game pair moving against each other: priced at the product) */
  d.querySelector('#tabs button[data-tab="games"]').click(); dayOn(G.date);
  const gb = (side, kind) => d.querySelector(`#games .game[data-id="${G.id}"] button[data-leg="${G.id}|${side}|${kind}"]`);
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
  dayOn(G.date); d.querySelector(`#games .game[data-id="${G.id}"] button[data-pp]`).click();
  tab('s'); d.querySelector(`#ppBody button[data-pp-add="${Y.id}|s|yes|3"]`).click();
  if (Z) { tab('sv'); const zm = mainOf(Z.id, 'sv'); d.querySelector(`#ppBody button[data-pp-add="${Z.id}|sv|main|under|${zm[2]}"]`).click(); }    // an Under: its fair chance its own implied
  else console.log(`  ${G.id}: no home goalie projected, so no saves Under in the builder; the Under's fair chance is held on the rows that have one`);
  chk(txt($('ppMsg')).endsWith(`Your parlay: ${Z ? 5 : 4} legs.`), `the window counts the parlay's legs (${txt($('ppMsg'))})`);
  $('ppClose').click();
  dayOn(H.date); d.querySelector(`#games .game[data-id="${H.id}"] button[data-leg="${H.id}|home|ml"]`).click();
  d.querySelector('#tabs button[data-tab="parlays"]').click();
  /* the builder: a row a leg, "same game" on G's legs alone, each player leg's read time, fair chance and the props model's, on trial */
  const legs = store().legs, n = legs.length, rows = [...d.querySelectorAll('#legs .leg')];
  chk(rows.length === n && n === (Z ? 6 : 5), `the builder draws the ${n} legs (${rows.length})`);
  const sgRows = rows.filter(r => r.querySelector('.tag.sg')).map(r => r.dataset.id.split('|')[0]);
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
  chk(notes.includes(why) && notes.includes(`never more than the legs' prices multiplied (${PBS.toAm(q.product)})`) && notes.includes('on trial and suggests nothing'), `the builder's notes give the one-line why (${notes.slice(0, 260)})`);
  chk(txt($('slipText')).includes(`${PBS.toAm(q.dec)} est.`) || $('slip').hidden, `the slip bar marks the price est. (${txt($('slipText'))})`);
  const bTxt = txt($('builder'));
  chk(!/\bedge\b/i.test(bTxt) && !/model says/i.test(bTxt), `with a player leg nothing in the builder claims an edge or says "model says" (${(/[^.]*\bedge\b[^.]*|[^.]*model says[^.]*/i.exec(bTxt) || [''])[0].slice(0, 120)})`);
  chk(tiers() === tiers0, 'the suggested levels are exactly as they were: team bets, one leg a game, no player and no same-game parlay');
  holdPanel(w, AT, 'with player legs in the builder', true);
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
      chk(!!hLeg && !!pLeg && thinAlone && !!r4 && !r4.querySelector('.tag.thin') && !/\bedge\b/i.test(b4) && !/model says/i.test(b4),
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
  chk(note.includes("The price here is an estimate: DraftKings prices same-game parlays its own way: this is an estimate from the legs' prices and how they move together, so the slip will show DraftKings' own same-game price."), 'the note says the slip shows DraftKings\' own same-game price');
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
    const tiersR = canon([...dR.querySelectorAll('.pb-tier')].map(t => [t.dataset.tier, [...t.querySelectorAll('.pb-tl')].map(x => x.dataset.id), txt(t.querySelector('.pb-nums')), txt(t.querySelector('.pb-rule'))]));
    chk(tiersR === tiers0 && ![...dR.querySelectorAll('.pb-tier .pb-tl')].some(x => x.dataset.id.includes('|p|')), `a reload with player legs in the builder works out the same levels from nothing: team bets, one leg a game, no player leg (${tiersR === tiers0 ? 'the same' : tiersR.slice(0, 160)})`);
    holdPanel(wR, AT + 60000, 'a reload with player legs in the builder', true);
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
      const c = cardOfS(s.id), ex = want(s), top = c ? txt(c.querySelector('.top')) : '', lis = c ? [...c.querySelectorAll('.pb-slegs li .tag')].map(txt) : [];
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
   card's badges, pick, chances, chips, tags, bets board, who is out, Lineups drawer and foot worked out here from the state; the tab
   counts; Parlay Builder → on a card; every pill and table head; the Record's tiles; the 44px controls */
const pctS = p => (p * 100).toFixed(0) + '%';
const oddsS = n => n === null || n === undefined ? '—' : n > 0 ? '+' + n : String(n);
const lineS = n => n === 0 ? 'PK' : n > 0 ? '+' + n : String(n);
const ab = id => S.teams[id] ? S.teams[id].abbr : id;
const sh = id => S.teams[id] ? S.teams[id].short : id;
const okPrice = v => v !== null && v !== undefined && isFinite(v) && v !== 0;
const styleVar = (el, k) => { const m = new RegExp(`${k}:\\s*([^;]+)`).exec((el && el.getAttribute('style')) || ''); return m ? m[1].trim() : null; };
const sMarginS = g => Math.abs(g.mu) < 0.05 ? 'even' : `${ab(g.mu > 0 ? g.home : g.away)} +${Math.abs(g.mu).toFixed(1)}`;
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
/* every surface a 12px pill sits on: the page's grounds and panels, white over --panel-2, a hovered table row */
const SURFACES = ['#2A3043', '#30374B', '#363D52', '#3D455B', '#475068', '#41495E', '#495065', '#424A5F'];
/* every surface a badge or the win bar sits on: the card's two grounds (--panel, --panel-2, read from the page's CSS in theLook) and the
   badge's own ground, 2% white over each */
const BADGE_SURFACES = ['#363D52', '#3D455B', '#3A4155', '#41495E'];
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
/* who is out (nhl v13): a row for a player worth OUT_ROW_S goals a game or more to his club, by the size of his figure; the bar is worked
   out again in theLook from tools/elo.js's goals layer and the player model's blend: about a point of the club's chance to win */
const OUT_ROW_S = 0.13;
const isRowS = o => typeof o.cost === 'number' && Math.abs(o.cost) >= OUT_ROW_S - 1e-9;
const orderS = list => list.map((o, i) => [o, i]).sort((a, b) => ((typeof b[0].cost === 'number' ? Math.abs(b[0].cost) : -1) - (typeof a[0].cost === 'number' ? Math.abs(a[0].cost) : -1)) || a[1] - b[1]).map(x => x[0]);
const groupS = st => /injured reserve/i.test(String(st || '')) ? 'IR' : /^out$/i.test(String(st || 'out')) ? 'out' : /suspen/i.test(String(st)) ? 'suspended' : `out (${String(st).toLowerCase()})`;
const groupRankS = k => k === 'out' ? 0 : k === 'suspended' ? 1 : k === 'IR' ? 3 : 2;
const OUT_KEY_S = `Who's out: a row for a player worth ${OUT_ROW_S.toFixed(2)} goals a game or more to his club, about a point of its chance to win.`;
/* one game card against the state: returns what is wrong, [] when nothing is */
function cardWrongs(w, c, g, ms, MAP) {
  const bad = [], ck = (ok, m) => { if (!ok) bad.push(m); };
  const L = g.line, started = sStarted(g, ms), fresh = sFresh(g), bets = !started && !!L && fresh;
  /* the top line: the puck drop and the date in the visitor's clock, a note after it; the tags */
  const top = c.querySelector('.top.when');
  ck(!!top && txt(top.firstElementChild) === `${clockOf(Date.parse(g.start))} · ${new Date(g.start).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}${g.note ? ' · ' + g.note : ''}`, `the top line (${top && txt(top.firstElementChild)})`);
  const tags = [];
  if (g.state === 'live') tags.push(g.detail, `as of ${clockOf(Date.parse(g.scoreAt || S.published))}`);
  else if (g.state === 'final') tags.push(g.detail || 'Final');
  else if (Date.parse(g.start) > ms && started) tags.push('start moved · call kept');
  else if (started) tags.push('under way · no score yet');
  if (g.neutral) tags.push('neutral ice');
  if (g.result) tags.push(g.result.su ? 'call right' : 'call wrong');
  if (g.result && !g.frozen) tags.push('replayed');
  ck(eqA([...c.querySelectorAll('.top .tags .tag')].map(txt), tags), `the tags ${JSON.stringify(tags)} (${[...c.querySelectorAll('.top .tags .tag')].map(txt).join(' | ')})`);
  /* the clubs: badges in the map's colour, the state's call filled, names, records, a score where one is known */
  const teams = [...c.querySelectorAll('.teams .team')], badges = [...c.querySelectorAll('.teams .badge')];
  ck(badges.length === 2 && txt(badges[0]) === ab(g.away) && txt(badges[1]) === ab(g.home), `the badges ${ab(g.away)}, ${ab(g.home)} (${badges.map(txt).join(', ')})`);
  ck(teams.length === 2 && styleVar(teams[0], '--tc') === MAP[g.away].c && styleVar(teams[1], '--tc') === MAP[g.home].c, `the badges in the clubs' colours (${teams.map(t => styleVar(t, '--tc')).join(', ')})`);
  const picks = [...c.querySelectorAll('.badge.pick')];
  ck(picks.length === 1 && picks[0] === badges[g.pick === 'away' ? 0 : 1], `exactly one badge filled, on the call ${g.pick}`);
  ck(txt(c.querySelector('.vs b')) === pctS(Math.max(g.pHome, 1 - g.pHome)) && txt(c.querySelector('.vs')) === pctS(Math.max(g.pHome, 1 - g.pHome)) + ab(g[g.pick]), `the call's chance in the middle (${txt(c.querySelector('.vs'))})`);
  ck(teams.length === 2 && txt(teams[0].querySelector('.nm')) === sh(g.away) && txt(teams[1].querySelector('.nm')) === sh(g.home), 'the clubs named');
  ck(teams.length === 2 && txt(teams[0].querySelector('.rec')) === (g.arec || '') && txt(teams[1].querySelector('.rec')) === (g.hrec || ''), `the records ${g.arec}, ${g.hrec}`);
  const known = (g.state === 'final' || g.state === 'live') && typeof g.hs === 'number' && typeof g.as === 'number';
  const scs = teams.map(t => t.querySelector('.sc'));
  ck(scs.every(x => !!x === known) && (!known || (txt(scs[0]) === String(g.as) && txt(scs[1]) === String(g.hs))), `a score exactly where one is known (${scs.map(txt).join('-')})`);
  if (known && g.state === 'final') ck(scs[0].classList.contains('lose') === (g.as < g.hs) && scs[1].classList.contains('lose') === (g.hs < g.as), 'the loser of a final muted');
  const prob = c.querySelector('.prob');
  ck(!!prob && styleVar(prob, '--ac') === MAP[g.away].c && styleVar(prob, '--hc') === MAP[g.home].c, 'the win bar in the clubs\' colours');
  ck(eqA([...c.querySelectorAll('.pline .wp')].map(txt), [pctS(1 - g.pHome), pctS(g.pHome)]), `each side's chance under the bar (${[...c.querySelectorAll('.pline .wp')].map(txt).join(' + ')})`);
  /* the chips */
  const chips = k => [...c.querySelectorAll(`.chips .chip[data-ck="${k}"]`)].map(txt);
  ck(eqA(chips('model'), [`Margin ${sMarginS(g)}`]), `the margin chip (${chips('model')})`);
  ck(eqA(chips('xt'), [`Goals ${g.xt.toFixed(1)}`]) && eqA(chips('ot'), [`OT ${pctS(g.tie)}`]), `the goals and overtime chips (${chips('xt')}; ${chips('ot')})`);
  const alt = g.elo && g.by === 'players' ? [`Team Elo ${ab(g.elo.pHome >= 0.5 ? g.home : g.away)} ${pctS(Math.max(g.elo.pHome, 1 - g.elo.pHome))} ${g.elo.xt.toFixed(1)} goals`]
    : g.pm ? [`Player model ${ab(g.pm.pHome >= 0.5 ? g.home : g.away)} ${pctS(Math.max(g.pm.pHome, 1 - g.pm.pHome))} ${g.pm.xt.toFixed(1)} goals`] : [];
  ck(eqA(chips('alt'), alt), `the other model's chip ${JSON.stringify(alt)} (${chips('alt')})`);
  const mk = { ml: [], pl: [], ou: [] };
  if (!bets && L) {
    if (okPrice(L.awayML) || okPrice(L.homeML)) mk.ml.push(`Moneyline ${ab(g.away)} ${oddsS(L.awayML)} ${ab(g.home)} ${oddsS(L.homeML)}`);
    if (L.homeLine !== null && L.homeLine !== undefined) mk.pl.push(`Puck line ${ab(g.away)} ${lineS(-L.homeLine)} ${oddsS(L.awaySpreadOdds)} ${ab(g.home)} ${lineS(L.homeLine)} ${oddsS(L.homeSpreadOdds)}`);
    if (L.total !== null && L.total !== undefined) mk.ou.push(`Over/under ${L.total} o ${oddsS(L.overOdds)} · u ${oddsS(L.underOdds)}`);
  }
  for (const k of ['ml', 'pl', 'ou']) ck(eqA(chips(k), mk[k]), `the market's ${k} chip exactly where the card has no bets board and the line has it ${JSON.stringify(mk[k])} (${chips(k)})`);
  /* each call said once on the card: on its own bet button where the board shows it with its edge ("call · edge +8"), else in a chip
     (a game started or over, a stale line, a call far off the market, whose button says that instead of its edge) */
  const R = g.result, e = x => Math.round(x * 100), res = (k, word) => R && R[k] ? ` ${word} ${R[k]}` : '', calls = [];
  const onBoard = (side, kind) => { if (!bets) return false; const B = sLeg(g, side, kind); return !!B && !isFarS(B); };
  if (g.mlPick && !onBoard(g.mlPick, 'ml')) calls.push([`ML ${ab(g[g.mlPick])} · edge +${e(g.mlEdge[g.mlPick])}${res('ml', 'ML')}`, !R]);
  if (g.plPick && !onBoard(g.plPick, 'pl')) calls.push([`${ab(g[g.plPick])} ${lineS(g.plPick === 'home' ? L.homeLine : -L.homeLine)} · edge +${e(g.plEdge[g.plPick])}${res('pl', 'PL')}`, !R]);
  if (g.ouPick && !onBoard(g.ouPick, 'ou')) calls.push([`${g.ouPick} ${L.total} · edge +${e(g.ouEdge[g.ouPick])}${res('ou', g.ouPick)}`, !R]);
  if (!g.mlPick && !g.plPick && !g.ouPick && !R) calls.push([L ? 'no edge' : 'no line yet', false]);
  const callEls = [...c.querySelectorAll('.chips .chip[data-ck="call"]')], haveCalls = callEls.map(x => [txt(x), x.classList.contains('edge')]);
  ck(eqA(haveCalls, calls), `the calls, lit until graded, their grades, else why none, each in a chip only where its button does not carry it with its edge ${JSON.stringify(calls)} (${JSON.stringify(haveCalls)})`);
  for (const [k, pk] of [['ml', g.mlPick], ['pl', g.plPick], ['ou', g.ouPick]]) if (pk) {
    const tag = c.querySelector(`button[data-leg="${g.id}|${pk}|${k}"] .pb-bt.tg`), onTag = !!tag && /^call · edge \+\d+$/.test(txt(tag));
    const head = k === 'ml' ? `ML ${ab(g[pk])} ·` : k === 'pl' ? `${ab(g[pk])} ${lineS(pk === 'home' ? L.homeLine : -L.homeLine)} ·` : `${pk} ${L.total} ·`, inChip = callEls.some(x => txt(x).startsWith(head));
    ck(onTag !== inChip, `the ${k} call said exactly once, with its edge: on its button's tag (${onTag}) or in a chip (${inChip}), never both, never neither`);
  }
  ck(callEls.every(x => [...x.querySelectorAll('.res')].every(r => /^(win|loss|push)$/.test(r.className.replace('res', '').trim()))), 'each grade a pill in its colour');
  /* a side far off the market says so on its own button, its two numbers in view (a phone shows no title), and in no chip */
  ck(!c.querySelector('.chips .chip[data-ck="far"]'), 'no Far off chip: the button carries it');
  if (bets) for (const k of PBS.KINDS) for (const s of PBS.SIDES[k]) {
    const B = sLeg(g, s, k), btn = c.querySelector(`button[data-leg="${g.id}|${s}|${k}"]`); if (!B || !btn) continue;
    const bad1 = betWrong(btn, B, s);
    ck(!bad1, `${s} ${k}: the button is its one line (the side, the price, the model's chance), the call's tag with its edge, far off the market on its own button with both numbers, exactly: ${bad1}`);
  }
  /* a stale line, the bets board */
  const stale = c.querySelector('.pb-stale'), wantStale = !started && !!L && !fresh;
  ck(!!stale === wantStale && (!stale || txt(stale) === `line from ${clockOf(Date.parse(L.at))}: not on DraftKings at the last run`), `a stale line says so exactly where it is (${stale && txt(stale)})`);
  const rows = [...c.querySelectorAll('.pb-bets .pb-bk')].map(txt);
  const wantRows = !bets ? null : [['ml', 'Moneyline'], ['pl', 'Puck line'], ['ou', `Total ${L.total}`]].filter(([k]) => (k !== 'ou' || (L.total !== null && L.total !== undefined)) && PBS.SIDES[k].some(s => sLeg(g, s, k))).map(x => x[1]);
  ck(!!c.querySelector('.pb-bets') === bets && (!bets || eqA(rows, wantRows)), `the bets board exactly on a game to come with a fresh line, its rows ${JSON.stringify(wantRows)} (${JSON.stringify(rows)})`);
  if (!bets) ck(!c.querySelector('button[data-leg]'), 'no bet offered without the board');
  /* who is out (nhl v13): the two goalies on one row, a row for each player worth OUT_ROW_S goals or more, each club's day to day on
     a line, the rest of each club's outs named on a line grouped by status, most valuable first, their figures beside them on a card
     with no drawer and in Lineups on one with a drawer, where the players on injured reserve are counted on the card and named in it */
  const PLT = S.players && S.players.teams, lu = !started && !!g.pm && !!PLT && !!PLT[g.away] && !!PLT[g.home];
  const out = c.querySelector('.out');
  ck(!!out === !!g.pm, 'who is out exactly where the player model lined the game up');
  if (g.pm && out) {
    const kids = [...out.children], sides = ['away', 'home'];
    const gks = sides.map(s => ({ t: g.pm[s].goalie, ab: ab(g[s]) })), same = gks.every(x => x.t && !x.t.debut) && gks[0].t.how === gks[1].t.how;
    const gk1 = ({ t, ab: a }) => !t ? `${a} goalie unknown` : `${t.name} ${a}${same ? '' : `, ${t.how}`}${t.debut ? ', first NHL start' : ''}`;
    const want = [['gk', `In goal: ${gks.map(gk1).join(' · ')}${same ? ` both ${gks[0].t.how}` : ''}`]];
    for (const s of sides) for (const o of orderS((g.pm[s].out || []).filter(isRowS))) want.push(['orow', `${o.name} ${ab(g[s])} · ${o.status || 'Out'} ${v2S(o.cost).t} goals`]);
    for (const s of sides) if ((g.pm[s].dtd || []).length) want.push(['dtd', `${ab(g[s])} day to day: ${g.pm[s].dtd.map(o => o.name).join(', ')}`]);
    const irOnly = [];
    for (const s of sides) {
      const groups = new Map(), parts = []; let ir = 0;
      for (const o of orderS((g.pm[s].out || []).filter(o => !isRowS(o)))) { const k = groupS(o.status); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(o); }
      for (const [k, list] of [...groups].sort((x, y) => groupRankS(x[0]) - groupRankS(y[0]))) {
        if (lu && k === 'IR') { ir = list.length; continue; }
        parts.push(`${parts.length ? '' : ab(g[s]) + ' '}${k === 'IR' ? 'on IR' : k}: ${list.map(o => `${o.name}${!lu && typeof o.cost === 'number' ? ' ' + v2S(o.cost).t : ''}`).join(', ')}`);
      }
      if (ir && parts.length) parts.push(`on IR: ${ir}, in Lineups`); else if (ir) irOnly.push(`${ab(g[s])} ${ir}`);
      if (parts.length) want.push(['also', parts.join(' · ')]);
    }
    if (irOnly.length) want.push(['also ir', `On IR, named in Lineups: ${irOnly.join(' · ')}`]);
    for (const s of sides) { const t = g.pm[s]; if (t.lastBox && t.lastFinal && t.lastFinal > t.lastBox) want.push(['muted', `${ab(g[s])} lineup from ${t.lastBox}: the box score of ${t.lastFinal} not read yet`]); }
    want.push(['src', `${g.pm.inj ? `Injury report of ${new Date(g.pm.inj).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}${started ? ', as the call was made' : ''}` : 'No injury report applied'} · the ${g.by === 'players' ? "player model's" : "team Elo's"} call`]);
    const have = kids.map(x => [x.className, txt(x)]);
    ck(eqA(have, want), `who is out, row by row: ${JSON.stringify(want).slice(0, 500)} (${JSON.stringify(have).slice(0, 500)})`);
    ck(kids.filter(x => x.classList.contains('orow')).every(x => { const wh = x.querySelector(':scope > .who'); return !!wh && wh.getAttribute('title') === txt(wh).replace(/ (\S+) · /, ' · $1 · ') && !!x.querySelector(':scope > .cost'); }), 'each player\'s row carries his name and status whole on its title, and his figure');
    /* nothing lost: every player out is named on the card (one on injured reserve counted there where the card has a drawer) with his
       status and figure on the card or in its Lineups, each worked out here from the state on its own */
    const lost = [], outT = txt(out), dr = c.querySelector(`#lu-${g.id}`);
    for (const [i, s] of sides.entries()) for (const o of g.pm[s].out || []) {
      const fig = typeof o.cost === 'number' ? v2S(o.cost).t : null, st = o.status || 'Out';
      const named = [...out.querySelectorAll('.nw, .who > .nw')].some(x => txt(x) === o.name || txt(x).startsWith(o.name + ' '));
      if (lu) {
        const blk = dr && dr.querySelectorAll(':scope > div')[i], li = blk && [...blk.querySelectorAll('.lu-out li')].find(x => txt(x.querySelector(':scope > span > .nw')) === o.name);
        if (!li || txt(li.querySelector(':scope > span > .muted')) !== st || txt(li.querySelector(':scope > .v')) !== (fig === null ? '—' : fig)) lost.push(`${o.name}: not in Lineups with ${st} and ${fig}`);
        if (!named && !(groupS(st) === 'IR' && !isRowS(o))) lost.push(`${o.name}: not named on the card`);
      } else {
        if (!named) lost.push(`${o.name}: not named on the card`);
        if (fig !== null && !outT.includes(`${o.name} ${fig}`) && !outT.includes(`${o.name} ${ab(g[s])} · ${st} ${fig} goals`)) lost.push(`${o.name}: his figure ${fig} not beside him`);
      }
    }
    if (lu && dr) for (const [i, s] of sides.entries()) { const blk = dr.querySelectorAll(':scope > div')[i], n = blk ? blk.querySelectorAll('.lu-out li').length : -1; if (n !== (g.pm[s].out || []).length) lost.push(`${ab(g[s])}: Lineups lists ${n} out where the report has ${(g.pm[s].out || []).length}`); }
    ck(!lost.length, `every player out is named on the card, his status and figure on it or in its Lineups (${lost.slice(0, 4).join(' | ')})`);
    /* nothing cut (a phone shows no title): every name and status, figure and count kept whole, and no rule of the page's, in any media
       query, ellipsing who is out (on a 360 phone it once read "Ryan Nugent-Hopkins EDM · Injured Re…"), nor a name in Lineups' outs */
    const ell = cssWith(w, 'text-overflow', /^ellipsis$/);
    const cutBy = [out, ...out.querySelectorAll('*')].map(el => ell.find(([sel]) => hitsSel(el, sel))).find(Boolean);
    ck(!cutBy, `no rule cuts who is out short with an ellipsis (${cutBy ? cutBy.join(' @media ') : 'none'})`);
    ck(kids.filter(x => x.classList.contains('orow')).every(x => { const wh = x.querySelector('.who'), nm = wh && wh.querySelector(':scope > .nw'), st = wh && wh.querySelector(':scope > .muted.nw'); return !!nm && !!st && txt(wh) === `${txt(nm)} ${txt(st)}`; }), 'each row\'s name and his club and status each kept whole on a line, the two free to wrap between');
    if (dr) for (const sp of dr.querySelectorAll('.lu-out li > span:first-child')) { const cs = w.getComputedStyle(sp); if (cs.whiteSpace === 'nowrap' || cs.overflow === 'hidden') { ck(false, `a name in Lineups' outs is cut: white-space ${cs.whiteSpace}, overflow ${cs.overflow}`); break; } }
  }
  /* the Lineups drawer and the foot */
  const luB = c.querySelector('button[data-lu]'), dr = c.querySelector(`#lu-${g.id}`);
  ck(!!luB === lu && !!dr === lu, `Lineups exactly on a game to come the player model lines up (${!!luB}, ${!!dr})`);
  if (lu && luB && dr) {
    ck(luB.getAttribute('aria-controls') === `lu-${g.id}` && luB.getAttribute('aria-expanded') === String(!dr.hidden) && txt(luB) === 'Lineups', `the Lineups toggle names its drawer, says by aria-expanded whether it is open, and keeps its word, Lineups, so the foot never rewraps (${txt(luB)})`);
    ck(!dr.querySelector('button') && c.querySelectorAll('button[data-lu]').length === 1 && !!luB.closest('.foot'), 'one Lineups toggle, in the foot, as the NBA\'s: the drawer has no button of its own (it once ended on a second Hide lineups right over the foot\'s)');
    for (const [i, s] of [[0, 'away'], [1, 'home']]) {
      const blk = dr.querySelectorAll(':scope > div')[i], t = PLT[g[s]], gkp = g.pm[s].goalie;
      const want = (gkp ? [`${gkp.name}G${v2S(gkp.gk).t}`] : []).concat((t.lineup || []).slice(0, 9).map(p => `${p.name}${Math.round(p.share * 60)}'${v2S(p.v).t}`));
      const have = blk ? [...blk.querySelectorAll('.lu-in li')].map(txt) : [];
      ck(blk && txt(blk.querySelector('h4')) === `${ab(g[s])} · expected` && eqA(have, want), `${ab(g[s])}'s goalie and nine skaters with the most ice time, minutes and goals ${JSON.stringify(want).slice(0, 200)} (${JSON.stringify(have).slice(0, 200)})`);
      const cls = blk ? [...blk.querySelectorAll('.lu-in li .v')].map(x => x.classList.contains('pos') ? 'pos' : x.classList.contains('neg') ? 'neg' : '') : [];
      ck(eqA(cls, (gkp ? [v2S(gkp.gk).c] : []).concat((t.lineup || []).slice(0, 9).map(p => v2S(p.v).c))), `${ab(g[s])}'s figures lime above zero, rose below, plain at 0.00`);
      /* the strength the state's own to the hundredth, half away from zero (the Players tab's figure), and its three parts shown so
         they add up to it, each within a hundredth of its own value (worked here from the line itself, not the page's apportioning) */
      const coachT = txt(blk && blk.querySelector('.coach'));
      const cm = coachT.match(/^Strength ([+-]?\d+\.\d\d) goals a game: attack ([+-]?\d+\.\d\d) · defence ([+-]?\d+\.\d\d) · goalie ([+-]?\d+\.\d\d) · top 9 of (\d+) skaters shown$/);
      ck(!!cm && +cm[5] === (t.lineup || []).length, `${ab(g[s])}'s strength line reads "Strength … goals a game: attack … · defence … · goalie … · top 9 of ${(t.lineup || []).length} skaters shown" (${coachT.slice(0, 120)})`);
      const nums = cm ? cm.slice(1, 5).map(x => Math.round(parseFloat(x) * 100)) : [];
      const own = Math.sign(g.pm[s].strength) * Math.round(Math.abs(g.pm[s].strength) * 100);
      ck(nums.length === 4 && nums[0] === own, `${ab(g[s])}'s strength shown is the state's own ${g.pm[s].strength} to the hundredth, ${own / 100} (${nums[0] / 100})`);
      ck(nums.length === 4 && nums[0] === nums[1] + nums[2] + nums[3], `${ab(g[s])}'s strength is the sum of the attack, defence and goalie shown beside it (${coachT.slice(0, 80)})`);
      const trueP = [t.offence, t.defence, gkp ? gkp.gk : 0];
      ck(nums.length === 4 && trueP.every((x, i) => Math.abs(nums[i + 1] / 100 - x) < 0.0101), `${ab(g[s])}'s attack, defence and goalie each within a hundredth of the state's ${JSON.stringify(trueP)} (${nums.slice(1).map(x => x / 100).join(', ')})`);
      ck(nums.length === 4 && cm.slice(1, 5).every((x, i) => v2S(nums[i] / 100).t === x), `${ab(g[s])}'s strength line signed and to two places as the drawer's other figures (${cm ? cm.slice(1, 5).join(' ') : ''})`);
    }
  }
  const go = !started && fresh && sSlate(ms).days.includes(g.date), goB = c.querySelector('button[data-pbgo]');
  ck(!!goB === go && (!goB || txt(goB) === 'Parlay Builder →'), `Parlay Builder → exactly on a game to come with a fresh line on a day the panel offers (${!!goB})`);
  const foot = c.querySelector('.foot'), footed = !!luB || !!goB || !!c.querySelector('button[data-pp]');
  ck(!!foot === footed, 'a foot exactly where it holds a button');
  ck(!c.querySelector('img'), 'no image on the card');
  return bad;
}

async function theLook() {
  console.log('THE LOOK');
  const AT = PUB + 60000;
  /* no image: the page names none, reads no club logo or colour from the state, and carries no ESPN image address */
  const script = HTML.slice(HTML.indexOf('<script>')).replace(/\/\*[\s\S]*?\*\//g, '');
  chk(!/<img\b/i.test(HTML) && !/espncdn/i.test(HTML) && !/\.(logo|color)\b/.test(script) && !/url\(/i.test(HTML.slice(0, HTML.indexOf('<script>')).replace(/\/\*[\s\S]*?\*\//g, '')), 'the page names no image: no <img>, no espncdn, no CSS url(), never a club\'s logo or colour read from the state');
  const errs = [], w = await boot(AT, errs), d = w.document, MAP = pageMap(w);
  /* the colour map: every club, #1E2230 on each, each colour at its bar on every surface, each club in a hue of its own */
  const keys = Object.keys(S.teams), missing = keys.filter(k => !MAP[k]);
  chk(!missing.length && keys.every(k => !MAP[k] || MAP[k].on === '#1E2230'), `TEAM_COLORS has every club, #1E2230 on each (${missing.join(', ') || 'none missing'})`);
  /* the badge's surfaces are the card's own grounds: held to the page's CSS, so a ground changed there is a ground checked here */
  const cssVar = k => { const m = new RegExp(`${k}:\\s*(#[0-9A-Fa-f]{6})`).exec(HTML); return m ? m[1].toUpperCase() : null; };
  const over2 = h => '#' + hexRgb(h).map(v => Math.round((v * 255) * 0.98 + 255 * 0.02).toString(16).padStart(2, '0')).join('').toUpperCase();
  const cardGrounds = [cssVar('--panel'), cssVar('--panel-2')];
  chk(/\.game\{background:linear-gradient\(180deg,var\(--panel-2\),var\(--panel\)\)/.test(HTML) && /\.badge\{[^}]*background:rgba\(255,255,255,\.02\)/.test(HTML) && eqA(BADGE_SURFACES, cardGrounds.concat(cardGrounds.map(over2))),
    `a badge and the win bar sit on the card's two grounds and the badge's own, 2% white over each: ${BADGE_SURFACES.join(', ')} (${cardGrounds.concat(cardGrounds.map(over2)).join(', ')})`);
  const lowC = [], lowT = [], lowOn = [];
  for (const k of keys.filter(k => MAP[k])) {
    const m = MAP[k];
    for (const s of BADGE_SURFACES) if (!(crH(m.c, s) >= 3)) lowC.push(`${k} ${m.c} on ${s} ${crH(m.c, s).toFixed(3)}`);
    for (const s of SURFACES) if (!(crH(m.t, s) >= 4.5)) lowT.push(`${k} ${m.t} on ${s} ${crH(m.t, s).toFixed(2)}`);
    if (!(crH('#1E2230', m.c) >= 4.5)) lowOn.push(`${k} ${crH('#1E2230', m.c).toFixed(2)}`);
  }
  chk(!lowC.length, `every badge and win-bar colour is 3:1 or more on every surface it sits on, WCAG's bar for large text and a component (${lowC.slice(0, 4).join('; ')})`);
  chk(!lowT.length, `every pill colour (12px) is 4.5:1 or more on every surface (${lowT.slice(0, 4).join('; ')})`);
  chk(!lowOn.length, `#1E2230 is 4.5:1 or more on every badge filled (${lowOn.join('; ')})`);
  /* clubs that share a colour share their brand's: two clubs outside one family are 5 or more apart by CIEDE2000 */
  const famOf = {}; COLOR_FAMILIES.forEach((f, i) => f.forEach(k => { famOf[k] = i; }));
  const close = []; for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) { const a = keys[i], b = keys[j]; if (!MAP[a] || !MAP[b] || (famOf[a] !== undefined && famOf[a] === famOf[b])) continue; const dd = de2000S(MAP[a].c, MAP[b].c); if (!(dd >= 5)) close.push(`${a}-${b} ${dd.toFixed(1)}`); }
  /* who is out's bar: the page's is the smoke's, and it is what it says, about a point of a club's chance to win. The card's chance on
     a player model's call is its goals layer and the team Elo blended, the goals layer weighted 1 - params.blend (data/players.json; tools/players.js's
     pHome = (1 - blend) * pG + blend * pE); a player out moves his
     club's expected margin by what he is worth, and the goals layer (tools/elo.js, data/model.json's pull) turns a margin into a chance.
     Only the median over the games to come is held, and loosely (0.5 to 2 points: "about a point" by a factor of two): the job never
     moves the blend or the pull (players.js keeps its fitted params, fit.js is run by hand), and a lopsided game anywhere on the schedule
     is the model's honest number, never a reason to stop a publish, so the ends are reported, not held. Holding them (0.7 to 1.3), as
     v13's first draft did, failed a state whose one game a month out had its margin moved a third of a goal, and would have stopped the job */
  chk(w.eval('OUT_ROW') === OUT_ROW_S, `the page's bar for a row of who is out is ${OUT_ROW_S} goals a game (${w.eval('OUT_ROW')})`);
  {
    const PJ = readJSON(path.join(DATA, 'players.json')), MJ = readJSON(path.join(DATA, 'model.json')), blend = PJ && PJ.params && PJ.params.blend;
    const pts = S.games.filter(g => g.pm && typeof g.pm.mu === 'number' && typeof g.pm.xt === 'number' && typeof g.diff === 'number' && !sStarted(g, AT))
      .map(g => (1 - blend) * (ELO.homeByGoals(ELO.goals(g.pm.xt, g.pm.mu + OUT_ROW_S, g.diff, MJ.pull)) - ELO.homeByGoals(ELO.goals(g.pm.xt, g.pm.mu, g.diff, MJ.pull)))).sort((a, b) => a - b);
    const medP = pts.length ? pts[Math.floor((pts.length - 1) / 2)] : null;
    if (!pts.length) console.log('  no game to come with the player model\'s numbers: the bar\'s meaning is not worked out on this state');
    else {
      chk(typeof blend === 'number' && medP >= 0.005 && medP <= 0.02, `${OUT_ROW_S} goals a game moves a club's chance to win by about a point at the median of the ${pts.length} games to come: ${(medP * 100).toFixed(2)} points (0.50 to 2.00 held; ${(pts[0] * 100).toFixed(2)} to ${(pts[pts.length - 1] * 100).toFixed(2)} at the ends, reported)`);
      console.log(`  who is out's bar: ${OUT_ROW_S} goals a game moves a club's chance to win by ${(medP * 100).toFixed(2)} points at the median of ${pts.length} games to come (${(pts[0] * 100).toFixed(2)} to ${(pts[pts.length - 1] * 100).toFixed(2)})`);
    }
  }
  /* a bet button is one line where it fits and 44px tall (jsdom lays nothing out: the rules are read): it wraps between its side and its
     price and chance, never inside either, and the call's tag sits on its top edge, taking no line */
  const rule = (sel, prop) => { const r = RULES.has(w) ? RULES.get(w) : (cssWith(w, prop, /./), RULES.get(w)); const hit = r.filter(([sl, media]) => !media && sl.split(',').map(x => x.trim()).includes(sel)); return hit.length ? String(hit[hit.length - 1][2].getPropertyValue(prop)).trim() : null; };
  chk(rule('.pb-bs', 'white-space') === 'nowrap' && rule('.pb-bn', 'white-space') === 'nowrap' && rule('.pb-bet', 'flex-wrap') === 'wrap' && rule('.pb-bt.tg', 'position') === 'absolute' && rule('.pb-bet', 'position') === 'relative',
    `a bet button wraps only between its side and its price and chance, each kept whole, the call's tag on its edge taking no line (${['.pb-bs white-space', '.pb-bn white-space', '.pb-bet flex-wrap', '.pb-bt.tg position', '.pb-bet position'].map(x => { const [a2, b2] = x.split(' '); return `${x} ${rule(a2, b2)}`; }).join(', ')})`);
  chk(!!d.querySelector('#games button.pb-bet') ? w.getComputedStyle(d.querySelector('#games button.pb-bet')).minHeight === '44px' : true, 'a bet button is 44px tall');
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
      const dayB = dd => d.querySelector(`#days .day[data-day="${dd}"]`);
      const day = [...d.querySelectorAll('#days .day')].map(b => b.dataset.day).find(dd => { dayB(dd).click(); return !!d.querySelector('#games .pb-bb'); });
      if (!day) console.log('  no card with a bets board: the rows laid out alike are held in Pick your own legs alone');
      else held('#games', () => dayB(day).click(), 'the Games cards');
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
  const grey = keys.filter(k => MAP[k] && k !== 'LA' && !(Math.hypot(...labH(MAP[k].c).slice(1)) >= 15)).map(k => `${k} ${MAP[k].c} ${Math.hypot(...labH(MAP[k].c).slice(1)).toFixed(1)}`);
  chk(!grey.length, `every club but the Kings (silver) in a colour of its own hue, none grey or white (${grey.join(', ')})`);
  /* every card of every day on the strip */
  let held = 0;
  for (const day of [...d.querySelectorAll('#days .day')].map(b => b.dataset.day)) {
    d.querySelector(`#days .day[data-day="${day}"]`).click();
    const want = S.games.filter(g => g.date === day).map(g => g.id).sort(), cards = [...d.querySelectorAll('#games .game')];
    chk(eqA(cards.map(c => c.dataset.id).sort(), want), `${day}: a card for each game of the day`);
    const dc = txt(d.querySelector(`#days .day[data-day="${day}"] .dc`));
    chk(dc === (want.length ? `${want.length} game${want.length === 1 ? '' : 's'}` : '—'), `${day}: the strip counts its games (${dc})`);
    for (const c of cards) { const g = S.games.find(x => x.id === c.dataset.id); if (!g) continue; const bad = cardWrongs(w, c, g, AT, MAP); held++; chk(!bad.length, `${g.id} (${ab(g.away)} @ ${ab(g.home)}, ${day}): ${bad.slice(0, 3).join(' | ')}`); }
    /* the bets' key said once over the day's cards, exactly where a card has a board, and on no board */
    const gk = d.getElementById('gamesKey'), boards = cards.filter(c => c.querySelector('.pb-bets')).length;
    chk(!!gk && gk.hidden === !boards && txt(gk) === "Tap a bet to add it to your parlay: DraftKings' price · the model's chance. Edge: the model's less the price's, in points." && ![...d.querySelectorAll('#games .pb-bets')].some(b => /Tap a bet|Edge:/.test(txt(b))), `${day}: the bets' key once over the cards, where ${boards} card(s) have a board (${gk && (gk.hidden ? 'hidden' : 'shown')})`);
    /* who is out's key, saying the bar, once over the cards wherever a card says who is out */
    const ok2 = d.getElementById('outKey'), outs = cards.filter(c => c.querySelector('.out')).length;
    chk(!!ok2 && ok2.hidden === !outs && (!outs || txt(ok2) === OUT_KEY_S), `${day}: who is out's key once over the cards, saying the bar, where ${outs} card(s) say who is out (${ok2 && (ok2.hidden ? 'hidden' : txt(ok2))})`);
  }
  console.log(`  ${held} game cards held to the state, every day on the strip`);
  /* a made-up card that takes every branch, whatever the day holds (nhl v13): on a copy of the state, the first game to come with a fresh
     line and both clubs lined up gets a call on its moneyline with its edge (said on its button, in no chip), a puck-line side far off the
     market that is no call, a call on the total far off the market (said in a chip too, its button carrying the numbers), and an injury
     list with a player worth more than the bar, one worth less of each status (out, suspended, another, injured reserve, and one the model
     does not rate), a day to day, a goalie making his first start; then the same game at its puck drop, where the card has no drawer */
  {
    const M = JSON.parse(STATE), G = M.games.filter(g => !sStarted(g, AT) && sFresh(g) && g.pm && S.players && S.players.teams && S.players.teams[g.away] && S.players.teams[g.home]).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
    if (!G) console.log('  no game to come lined up with a fresh line: the made-up card is skipped');
    else {
      Object.assign(G.line, { awayML: 150, homeML: -170, homeLine: -1.5, homeSpreadOdds: 200, awaySpreadOdds: -240, total: 6.5, overOdds: -110, underOdds: -110 });
      Object.assign(G, { pHome: 0.53, mlEdge: { away: 0.07, home: -0.1 }, mlPick: 'away', cover: { home: 0.5, push: 0, away: 0.5 }, plEdge: { home: 0.167, away: -0.206 }, plPick: null, ou: { over: 0.3, push: 0, under: 0.7 }, ouEdge: { over: -0.224, under: 0.176 }, ouPick: 'under' });
      const nm = (k, i) => `Plant ${k}${i}`;
      G.pm.away.out = [{ id: '9000001', name: nm('Row', 1), status: 'Out', cost: -0.16 }, { id: '9000002', name: nm('Susp', 1), status: 'Suspension', cost: 0.03 }, { id: '9000003', name: nm('Ir', 1), status: 'Injured Reserve', cost: 0.05 },
        { id: '9000004', name: nm('Ir', 2), status: 'Injured Reserve', cost: null }, { id: '9000005', name: nm('Out', 1), status: 'Out', cost: 0.01 }, { id: '9000006', name: nm('Q', 1), status: 'Questionable', cost: -0.04 }];
      G.pm.home.out = [{ id: '9000007', name: nm('Ir', 3), status: 'Injured Reserve', cost: 0.02 }];
      G.pm.away.dtd = []; G.pm.home.dtd = [{ id: '9000008', name: nm('Dtd', 1), status: 'Day-To-Day' }];
      if (G.pm.away.goalie) G.pm.away.goalie.debut = true;
      const real = S; S = M;
      try {
        for (const [ms, tag] of [[AT, 'to come, with its drawer'], [Date.parse(G.start) + 60000, 'at its puck drop, no drawer']]) {
          const e3 = [], w3 = await boot(ms, e3, { state: JSON.stringify(M) }), d3 = w3.document;
          const db = d3.querySelector(`#days .day[data-day="${G.date}"]`); if (db) db.click();
          const c3 = d3.querySelector(`#games .game[data-id="${G.id}"]`);
          if (!c3) { chk(false, `the made-up card ${tag}: no card for ${G.id}`); continue; }
          const bad = cardWrongs(w3, c3, G, ms, pageMap(w3));
          chk(!bad.length, `the made-up card ${tag}: ${bad.slice(0, 3).join(' | ')}`);
          const drawn = c3.querySelector(`#lu-${G.id}`), kinds = [...c3.querySelectorAll('.out > span')].map(x => x.className);
          if (ms === AT) chk(!!drawn && c3.querySelectorAll('.pb-bt.tg:not(.far)').length === 1 && c3.querySelectorAll('.pb-bt.tg.far').length === 2 && c3.querySelectorAll('.chips .chip[data-ck="call"]').length === 1
            && kinds.filter(k => k === 'orow').length === 1 && kinds.includes('also ir') && /on IR: 2, in Lineups/.test(txt(c3.querySelector('.out'))) && drawn.querySelectorAll('.lu-out li').length === 7 && (!G.pm.away.goalie || /first NHL start/.test(txt(c3.querySelector('.out .gk')))),
            `the made-up card ${tag} takes every branch: one call's tag, two far-off tags, one call in a chip, one row, the IR counted on a club's line and on the shared one, seven in Lineups, a first start (${kinds.join(', ')})`);
          else { const al = [...c3.querySelectorAll('.out > .also')].map(txt);
            chk(!drawn && !c3.querySelector('.pb-bets') && !c3.querySelector('.out > .also.ir') && al.some(t => t.endsWith('on IR: Plant Ir1 +0.05, Plant Ir2')) && al.some(t => t.endsWith('on IR: Plant Ir3 +0.02')),
              `the made-up card ${tag}: no drawer, every player on IR named on his club's line with his figure, one the model does not rate with none (${al.join(' | ').slice(0, 300)})`); }
          chk(!e3.length, `no runtime error on the made-up card ${tag}: ${e3.join(' | ')}`);
        }
      } finally { S = real; }
    }
  }
  /* the strip names today and tomorrow */
  const today = etDate(AT), dw = dd => { const b = d.querySelector(`#days .day[data-day="${dd}"] .dw`); return b ? txt(b) : null; };
  chk([null, 'Today'].includes(dw(today)) && [null, 'Tomorrow'].includes(dw(PBS.nextDay(today))), `the strip says Today and Tomorrow (${dw(today)}, ${dw(PBS.nextDay(today))})`);
  /* the Games tab's count: today's games still to come (Eastern), hidden at none, moved by a puck drop on the watch */
  const gc = () => d.getElementById('gameCount'), nToday = ms => S.games.filter(g => g.date === etDate(ms) && !sStarted(g, ms)).length;
  const cnt = ms => { const n = nToday(ms); return gc() && gc().hidden === !n && (!n || (txt(gc()) === String(n) && gc().title === `${n} game${n === 1 ? '' : 's'} still to come today`)); };
  chk(cnt(AT), `the Games tab counts today's ${nToday(AT)} games still to come (${gc() && (gc().hidden ? 'hidden' : txt(gc()))})`);
  const nextToday = S.games.filter(g => g.date === today && !sStarted(g, AT)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  /* 44px: the toolbar, the tabs, the players' switch, a card's Lineups and Parlay Builder → */
  const tall = el => !!el && w.getComputedStyle(el).minHeight === '44px';
  chk(tall(d.getElementById('refreshScores')) && [...d.querySelectorAll('#tabs button')].every(tall) && [...d.querySelectorAll('#plKind button')].every(tall), 'Refresh scores, every tab and the Skaters/Goalies switch are 44px tall');
  /* Lineups: shut, opened in place, kept open through a redraw (a bet tapped), never stored; the focus kept on it through the watch's redraw */
  const luDay = [...d.querySelectorAll('#days .day')].map(b => b.dataset.day).find(dd => { d.querySelector(`#days .day[data-day="${dd}"]`).click(); return !!d.querySelector('#games button[data-lu]'); });
  if (luDay) {
    const b = d.querySelector('#games button[data-lu]'), id = b.dataset.lu, card = () => d.querySelector(`#games .game[data-id="${id}"]`);
    chk(tall(b) && tall(d.querySelector('#games button[data-pbgo]') || b), 'a Lineups toggle and Parlay Builder → are 44px tall');
    const w0 = w.__writes.length, s0 = w.localStorage.getItem('nhl_v1');
    chk(b.getAttribute('aria-expanded') === 'false' && d.getElementById('lu-' + id).hidden, 'a Lineups drawer starts shut');
    b.click();
    chk(b.getAttribute('aria-expanded') === 'true' && !d.getElementById('lu-' + id).hidden && card().querySelector('button[data-lu]') === b && txt(b) === 'Lineups', 'Lineups opens its drawer in place, the toggle saying so by aria-expanded, its word kept');
    chk(w.__writes.length === w0 && w.localStorage.getItem('nhl_v1') === s0, 'opening Lineups writes nothing');
    b.focus(); w.eval('rerender()');
    chk(d.activeElement && d.activeElement.dataset && d.activeElement.dataset.lu === id && !d.getElementById('lu-' + id).hidden && d.activeElement.getAttribute('aria-expanded') === 'true', 'a redraw keeps the drawer open and the keyboard on its toggle');
    const bet = card().querySelector('button[data-leg]');
    if (bet) {
      const others = [...d.querySelectorAll('#games .game')].filter(c => c.dataset.id !== id);
      const leg = bet.dataset.leg; bet.click();
      chk(others.every(c => c.isConnected) && !!card().querySelector(`button[data-leg="${leg}"][aria-pressed="true"]`), `a bet tapped redraws its own card alone, the day's ${others.length} other cards left as they were`);
      chk(!d.getElementById('lu-' + id).hidden && card().querySelector('button[data-lu]').getAttribute('aria-expanded') === 'true', 'a bet tapped on the card redraws it with the drawer still open');
      const again = card().querySelector(`button[data-leg="${leg}"]`); if (again) again.click();
    }
    card().querySelector('button[data-lu]').click();
    chk(d.getElementById('lu-' + id).hidden && card().querySelector('button[data-lu]').getAttribute('aria-expanded') === 'false' && txt(card().querySelector('button[data-lu]')) === 'Lineups', 'and shuts it again, the toggle saying Lineups');
    /* opened and shut from the keyboard: the one toggle keeps the focus, and the foot its buttons and their words throughout */
    const w1 = w.__writes.length, s1 = w.localStorage.getItem('nhl_v1'), footW = () => [...card().querySelectorAll('.foot button')].map(txt).join(' | '), f0 = footW();
    const kb = card().querySelector('button[data-lu]'); kb.focus(); kb.click();
    chk(!d.getElementById('lu-' + id).hidden && footW() === f0 && !d.querySelector(`#lu-${id} button`), `open, the foot is as it was shut, one toggle and no second Hide lineups (${footW()})`);
    kb.click();
    chk(d.getElementById('lu-' + id).hidden && kb.getAttribute('aria-expanded') === 'false' && d.activeElement === kb && footW() === f0, 'shut again from the keyboard, the focus still on the toggle');
    chk(w.__writes.length === w1 && w.localStorage.getItem('nhl_v1') === s1, 'opening and shutting Lineups writes nothing');
    const g = S.games.find(x => x.id === id), errsP = [], wP = await boot(Date.parse(g.start) + 60000, errsP), dP = wP.document;
    const bd = dP.querySelector(`#days .day[data-day="${g.date}"]`); if (bd) bd.click();
    const cP = dP.querySelector(`#games .game[data-id="${id}"]`);
    chk(!!cP && !cP.querySelector('button[data-lu]') && !cP.querySelector('.drawer') && !cP.querySelector('button[data-pbgo]'), `opened at its puck drop the card offers neither Lineups nor Parlay Builder → (${id})`);
    chk(!errsP.length, 'no runtime error at the puck drop: ' + errsP.join(' | '));
  } else console.log('  no game to come the player model lines up: the Lineups checks skipped');
  /* Parlay Builder → : the panel on that game's day, the game ticked though it was unticked, the keyboard on the panel's heading */
  const goG = S.games.filter(g => !sStarted(g, AT) && sFresh(g) && sSlate(AT).days.includes(g.date)).sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  for (const [g, day] of goG.length ? [[goG[0], undefined]].concat(sSlate(AT).both ? [[goG[goG.length - 1], 'both']] : []) : []) {
    const store = JSON.stringify({ ui: { pb: Object.assign({ off: [g.id] }, day ? { day } : {}) } });
    const errsG = [], wG = await boot(AT, errsG, { store }), dG = wG.document;
    const bd = dG.querySelector(`#days .day[data-day="${g.date}"]`); if (bd) bd.click();
    const b = dG.querySelector(`#games .game[data-id="${g.id}"] button[data-pbgo]`);
    if (!b) { chk(false, `Parlay Builder → on ${g.id}`); continue; }
    b.click();
    const ui = (JSON.parse(wG.localStorage.getItem('nhl_v1') || '{}').ui || {}).pb || {}, wantDay = day === 'both' && sSlate(AT, 'both').pick === 'both' ? 'both' : g.date;
    const tile = dG.querySelector(`#pbGrid input[data-g="${g.id}"]`);
    chk(!dG.getElementById('tab-parlays').hidden && wG.location.hash === '#parlays' && ui.day === wantDay && !(ui.off || []).includes(g.id), `Parlay Builder → on ${g.id} opens the panel on ${wantDay}, the game no longer unticked (day ${ui.day}, off ${JSON.stringify(ui.off)})`);
    chk(!!tile && tile.checked && txt(dG.getElementById('pbSlate')) === sSlate(AT, wantDay).text, `and its tile is ticked on the slate shown (${txt(dG.getElementById('pbSlate'))})`);
    chk(dG.activeElement === dG.getElementById('pbTitle'), 'and the keyboard is on the panel\'s heading');
    chk(!errsG.length, 'no runtime error on Parlay Builder →: ' + errsG.join(' | '));
  }
  /* the watch at a puck drop today: the Games tab's count follows it on any tab */
  if (nextToday) {
    /* a page opened on another tab, no game card ever drawn: only the watch can move the count */
    const errsW = [], wW = await boot(AT, errsW, { hash: 'standings' }), dW = wW.document, gW = () => dW.getElementById('gameCount');
    const cntW = ms => { const n = nToday(ms); return gW() && gW().hidden === !n && (!n || txt(gW()) === String(n)); };
    chk(cntW(AT), `opened on Standings, the Games tab counts today's ${nToday(AT)} games still to come (${gW() && (gW().hidden ? 'hidden' : txt(gW()))})`);
    const at = Date.parse(nextToday.start) + 60000; wW.__setClock(at); dW.dispatchEvent(new wW.Event('visibilitychange'));
    chk(cntW(at), `after ${nextToday.id}'s puck drop the watch moves the count to ${nToday(at)} (${gW() && (gW().hidden ? 'hidden' : txt(gW()))})`);
    chk(!errsW.length, 'no runtime error as the count moves: ' + errsW.join(' | '));
  }
  /* every pill: a club's abbreviation in that club's pill colour; beside a club's name, the same club, hidden from a screen reader */
  const byAbbr = new Map(keys.map(k => [S.teams[k].abbr, k]));
  const pills = () => {
    const wrong = [];
    for (const p of d.querySelectorAll('.pill')) {
      const k = byAbbr.get(txt(p)); if (!k || !MAP[k] || styleVar(p, '--tc') !== MAP[k].t) { wrong.push(`${txt(p)} ${styleVar(p, '--tc')}`); continue; }
      const tw = p.parentElement && p.parentElement.classList.contains('tw') ? p.parentElement : null;
      if (tw && (txt(tw.querySelector('.tn')) !== S.teams[k].short || p.getAttribute('aria-hidden') !== 'true')) wrong.push(`${txt(p)} beside ${txt(tw.querySelector('.tn'))}`);
    }
    return wrong;
  };
  for (const t of ['standings', 'ratings', 'players', 'parlays', 'games']) { d.querySelector(`#tabs button[data-tab="${t}"]`).click(); const wr = pills(); chk(!wr.length, `${t}: every pill is its club's abbreviation in its club's colour, the club's own name beside it (${wr.slice(0, 4).join('; ')})`); }
  /* the tables: the column each is in order of, marked; the Standings' four */
  d.querySelector('#tabs button[data-tab="standings"]').click();
  chk([...d.querySelectorAll('#standings table')].every(t => eqA([...t.querySelectorAll('th.on')].map(txt), ['#', 'PTS'])), 'each Standings table marks # and PTS, its order');
  d.querySelector('#tabs button[data-tab="ratings"]').click();
  chk(eqA([...d.querySelectorAll('#ratTable th.on')].map(txt), ['#', 'Rating']), 'Power ratings mark # and Rating');
  /* no Playoff tab (nhl v14, the owner's call): no button, section, bracket or odds table; the Standings and Power ratings keep their
     Playoff and Cup columns */
  chk(!d.querySelector('#tabs button[data-tab="playoff"]') && !d.getElementById('tab-playoff') && !d.getElementById('bracket') && !d.getElementById('poTable'), 'no Playoff tab: no button, section, bracket or odds table');
  { const eP = [], wP = await boot(PUB + 60000, eP, { hash: 'playoff' }); chk(!wP.document.getElementById('tab-standings').hidden && wP.location.hash === '#standings' && !eP.length, `an old #playoff link opens the Standings, where the playoff chances are (${wP.location.hash}${eP.length ? '; ' + eP.join(' | ') : ''})`); }
  d.querySelector('#tabs button[data-tab="players"]').click();
  if (S.players) chk(eqA([...d.querySelectorAll('#plTable th.on')].map(txt), ['#', 'Rating']) && eqA([...d.querySelectorAll('#plTeams th.on')].map(txt), ['#', 'Strength']), 'the players mark # and Rating, the clubs # and Strength');
  /* every column at every width: no rule in the page's CSS, in any media query, hides a table, a row or a cell (so a phone has every number a
     desktop has, a swipe away); each table scrolls sideways inside its own wrapper; its club or player column is the one held at the left;
     and each table has the columns it had before the restyle (the skaters' position beside the name now, and a player's rating
     right after his name, as the NBA's Elo), checked header by header */
  const hiders = [], walkCss = rules => { for (const r of rules || []) { if (r.cssRules && !r.selectorText) walkCss(r.cssRules); else if (r.style && /^none$/i.test(String(r.style.getPropertyValue('display')).trim())) hiders.push(r.selectorText); } };
  for (const sh of d.styleSheets) walkCss(sh.cssRules);
  const hits = (el, sel) => { try { return el.matches(sel); } catch (e) { return sel.split(',').some(x => { try { return el.matches(x); } catch (e2) { return false; } }); } };
  const scrollers = []; const walkO = rules => { for (const r of rules || []) { if (r.cssRules && !r.selectorText) walkO(r.cssRules); else if (r.style && /^(auto|scroll)$/.test(String(r.style.getPropertyValue('overflow-x') || r.style.getPropertyValue('overflow')).trim().split(/\s+/).pop())) scrollers.push(r.selectorText); } };
  for (const sh of d.styleSheets) walkO(sh.cssRules);
  chk(hiders.length > 0 && scrollers.length > 0, `the page's CSS read: ${hiders.length} rules that hide, ${scrollers.length} that scroll`);
  const COLS = { standings: ['#', 'Team', 'GP', 'W', 'L', 'OTL', 'PTS', 'RW', 'ROW', 'GF', 'GA', 'Diff', 'Rating', 'Playoff'], ratTable: ['#', 'Team', 'Div', 'Rating', 'Record', 'PTS', 'GF/g', 'GA/g', 'Playoff', 'Cup'],
    plTable: ['#', 'Player', 'Rating', 'Club', 'Offence', 'Defence', 'Games', 'TOI', 'Five seasons'],
    plGoalies: ['#', 'Goalie', 'Rating', 'Club', 'Starts', 'Five seasons'], plTeams: ['#', 'Club', 'Strength', 'Attack', 'Defence', 'Goalie', 'Out'], recMonth: ['When', 'SU', 'Rate', 'ML', 'Puck line', 'Totals'], recBand: ['Model chance', 'SU', 'Rate', 'ML', 'Puck line', 'Totals'] };
  const STICK = { standings: 'Team', ratTable: 'Team', plTable: 'Player', plGoalies: 'Goalie', plTeams: 'Club', recMonth: 'When', recBand: 'Model chance' };
  /* a heading as a desktop shows it: its words without the short form a phone shows instead (.t-narrow) */
  const wideTxt = th => { const c = th.cloneNode(true); for (const x of c.querySelectorAll('.t-narrow')) x.remove(); return txt(c); };
  const lost = [], seen = [];
  const tablesHeld = (tab, keyOf) => {
    for (const tb of d.querySelectorAll(`#tab-${tab} table.tbl`)) {
      const key = keyOf(tb), ths = [...tb.querySelectorAll('thead th')], heads = ths.map(wideTxt), want = COLS[key]; seen.push(key);
      if (!want || !eqA(heads, want)) lost.push(`${key}: columns ${JSON.stringify(heads)}, want ${JSON.stringify(want)}`);
      const wr = tb.parentElement;
      if (!wr || !scrollers.some(sel => hits(wr, sel))) lost.push(`${key}: not inside a wrapper that scrolls sideways (${wr && wr.className})`);
      for (const el of [tb, ...tb.querySelectorAll('thead, tbody, tr, th, td')]) { const h = hiders.find(sel => hits(el, sel)); if (h) { lost.push(`${key}: ${el.tagName.toLowerCase()} "${txt(el).slice(0, 30)}" hidden by ${h}`); break; } }
      const si = heads.indexOf(STICK[key]), rows = [...tb.querySelectorAll('tr')];
      if (si < 0 || !rows.length || rows.some(r => !r.cells[si] || !r.cells[si].classList.contains('sk') || [...r.cells].filter(c => c.classList.contains('sk')).length !== 1)) lost.push(`${key}: the ${STICK[key]} column is not the one held at the left`);
      if (rows.some(r => r.cells.length !== ths.length)) lost.push(`${key}: a row with a cell missing`);
    }
  };
  for (const t of ['standings', 'ratings', 'players', 'record']) {
    d.querySelector(`#tabs button[data-tab="${t}"]`).click();
    tablesHeld(t, tb => tb.id || 'standings');
    if (t === 'players' && S.players) { d.querySelector('#plKind button[data-kind="goalies"]').click(); tablesHeld(t, tb => tb.id === 'plTable' ? 'plGoalies' : tb.id); d.querySelector('#plKind button[data-kind="skaters"]').click(); }
  }
  chk(!lost.length && ['standings', 'ratTable', 'recMonth', 'recBand'].every(k => seen.includes(k)) && (!S.players || ['plTable', 'plGoalies', 'plTeams'].every(k => seen.includes(k))), `every table keeps every column at every width, scrolling sideways in its wrapper with its club or player held (${seen.length} tables; ${lost.slice(0, 4).join(' | ')})`);
  const plRows = [...d.querySelectorAll('#plTable tbody tr')];
  if (S.players) {
    const plWrong = plRows.filter(r => { const id = r.cells[3] && r.cells[3].querySelector('.pill'), k = id && byAbbr.get(txt(id)); return !(r.cells[1] && r.cells[1].querySelector('b') && k && txt(r.cells[3].querySelector('.tn')) === S.teams[k].short); });
    chk(plRows.length > 0 && !plWrong.length, `each player's name in bold, his club in the Club column (${plRows.length} rows${plWrong.length ? '; ' + txt(plWrong[0]).slice(0, 60) : ''})`);
    /* the figures (ratings ×100, one place): a rating or a strength, the column a table is in order of, unsigned; offence, defence and
       attack signed and coloured by the sign shown, as the NBA's and the Standings' Diff (a lime 29.9 once sat beside a rose -8.3) */
    const f1 = v => (v * 100).toFixed(1), sg1 = v => { const t = f1(v), n = +t; return n > 0 ? '+' + t : n < 0 ? t : '0.0'; };
    const clsOf = v => { const n = +f1(v); return n > 0 ? 'pos' : n < 0 ? 'neg' : ''; }, clsHas = c => c.classList.contains('pos') ? 'pos' : c.classList.contains('neg') ? 'neg' : '';
    const byNameClub = new Map(Object.values(S.players.players || {}).filter(p => p.pos !== 'G').map(p => [`${p.name}|${p.team}`, p])), figBad = [];
    for (const r of plRows) {
      const k = byAbbr.get(txt(r.cells[3] && r.cells[3].querySelector('.pill'))), p = byNameClub.get(`${txt(r.cells[1] && r.cells[1].querySelector('b'))}|${k}`);
      if (!p) { figBad.push(`no skater ${txt(r.cells[1]).slice(0, 30)}`); continue; }
      const want = [f1(p.v), sg1(p.o), sg1(p.d)], have = [txt(r.cells[2]), txt(r.cells[4]), txt(r.cells[5])];
      if (!eqA(want, have) || clsHas(r.cells[4]) !== clsOf(p.o) || clsHas(r.cells[5]) !== clsOf(p.d) || clsHas(r.cells[2])) figBad.push(`${p.name}: ${have.join(' ')} (want ${want.join(' ')})`);
    }
    const tmRows = [...d.querySelectorAll('#plTeams tbody tr')];
    for (const r of tmRows) {
      const k = byAbbr.get(txt(r.cells[1] && r.cells[1].querySelector('.pill'))), t = k && S.players.teams[k];
      if (!t) { figBad.push(`no club ${txt(r.cells[1])}`); continue; }
      const want = [f1(t.strength), sg1(t.offence), sg1(t.defence)], have = [txt(r.cells[2]), txt(r.cells[3]), txt(r.cells[4])];
      if (!eqA(want, have) || clsHas(r.cells[3]) !== clsOf(t.offence) || clsHas(r.cells[4]) !== clsOf(t.defence) || clsHas(r.cells[2])) figBad.push(`${k}: ${have.join(' ')} (want ${want.join(' ')})`);
    }
    chk(plRows.length > 0 && tmRows.length > 0 && !figBad.length, `the skaters' rating unsigned, offence and defence signed and coloured by their sign; the clubs' strength unsigned, attack and defence signed (${plRows.length} skaters, ${tmRows.length} clubs; ${figBad.slice(0, 3).join(' | ')})`);
  }
  /* a column of figures at one place: Rating on Standings and Power ratings and Exp. pts on the odds, 1553.0 beside 1600.5 (a whole
     number once dropped its place) */
  const oneBad = [], clubOf = cell => byAbbr.get(txt(cell && cell.querySelector('.pill'))), at1 = x => typeof x === 'number' ? x.toFixed(1) : '—';
  d.querySelector('#tabs button[data-tab="standings"]').click();
  for (const r of d.querySelectorAll('#standings tbody tr')) { const k = clubOf(r.cells[1]); if (!k || txt(r.cells[12]) !== at1(S.teams[k].rating)) oneBad.push(`standings ${k}: ${txt(r.cells[12])}`); }
  /* the Standings' four tables share every column's width, so GP, W, L and PTS run straight down the page (each once sized its Team
     column to its own longest name, the Pacific's 40px right of the Central's): laid out fixed on the same widths, never narrower than
     those widths add to (it scrolls instead), on a desktop and on a phone; jsdom lays nothing out, so this reads the rules */
  const stT = [...d.querySelectorAll('#standings table')], stW = stT.map(t => [...t.querySelectorAll('thead th')].map(th => w.getComputedStyle(th).width));
  const pxN = x => parseFloat(String(x || '').replace('px', '')) || 0;
  const stMin = (media) => { const m = cssWith(w, 'min-width', /px$/).filter(([sel, md]) => md === media && /#standings/.test(sel)); return m.length ? m : null; };
  const phoneM = (cssWith(w, 'width', /px$/).find(([sel, md]) => /#standings/.test(sel) && md) || [])[1];
  const phoneSum = phoneM ? cssWith(w, 'width', /px$/).filter(([sel, md]) => md === phoneM && /#standings .*th:nth-child/.test(sel)) : [];
  const phoneCols = new Set(phoneSum.map(([sel]) => (/nth-child\((\d+)\)/.exec(sel) || [])[1]));
  const phoneW = phoneM ? RULES.get(w).filter(([sel, md]) => md === phoneM && /#standings .*th:nth-child/.test(sel)).reduce((a, [, , st]) => a + pxN(st.getPropertyValue('width')), 0) : 0;
  const phoneMin = phoneM ? pxN((RULES.get(w).find(([sel, md, st]) => md === phoneM && /#standings \.tbl$/.test(sel.trim()) && st.getPropertyValue('min-width')) || [, , { getPropertyValue: () => '' }])[2].getPropertyValue('min-width')) : 0;
  chk(stT.length === 4 && stT.every(t => w.getComputedStyle(t).tableLayout === 'fixed') && stW.every(ws => ws.length === 14 && ws.every(x => /^\d+(\.\d+)?px$/.test(x)) && eqA(ws, stW[0]))
    && pxN(w.getComputedStyle(stT[0]).minWidth) >= stW[0].reduce((a, x) => a + pxN(x), 0) && !!stMin('') && phoneCols.size === 14 && phoneMin >= phoneW,
    `the Standings' four tables laid out fixed on the same 14 column widths, never squeezed under them, on a desktop and a phone (${stW[0] ? stW[0].join(',') : 'none'}; min ${stT[0] && w.getComputedStyle(stT[0]).minWidth}; phone ${phoneCols.size} columns, ${phoneW}px, min ${phoneMin}px)`);
  d.querySelector('#tabs button[data-tab="ratings"]').click();
  for (const r of d.querySelectorAll('#ratTable tbody tr')) { const k = clubOf(r.cells[1]); if (!k || txt(r.cells[3]) !== at1(S.teams[k].rating)) oneBad.push(`ratings ${k}: ${txt(r.cells[3])}`); }
  chk(!oneBad.length, `every Rating at one place (${oneBad.slice(0, 4).join(' | ')})`);
  /* a hidden name in a table (on a phone a club is its pill, its name absolute for a screen reader) is held by a positioned box inside its
     table, never set against the page: a club cell that was not the held (sticky) column once set the Players' 400 names against main,
     outside the table's scrolling box, and ran the tab on some 14,000px past its last table on a phone. jsdom lays nothing out, so this
     reads the rules: an element some rule sets absolute has an ancestor inside its table that a rule under the same media (or none) positions */
  const absR = cssWith(w, 'position', /^absolute$/), posR = cssWith(w, 'position', /^(relative|sticky|absolute|fixed)$/), loose = [];
  let absN = 0;
  for (const t of ['standings', 'ratings', 'players', 'record']) {
    d.querySelector(`#tabs button[data-tab="${t}"]`).click();
    for (const kind of t === 'players' && S.players ? ['skaters', 'goalies'] : [null]) {
      if (kind) d.querySelector(`#plKind button[data-kind="${kind}"]`).click();
      for (const tb of d.querySelectorAll(`#tab-${t} table.tbl`)) for (const el of tb.querySelectorAll('span, div, b, i, small, em')) {
        const a = absR.find(([sel]) => hitsSel(el, sel)); if (!a) continue;
        absN++;
        let held = false; for (let q = el.parentElement; q && q !== tb.parentElement; q = q.parentElement) if (posR.some(([sel, md]) => (md === '' || md === a[1]) && hitsSel(q, sel))) { held = true; break; }
        if (!held) { loose.push(`${tb.id || t}${kind ? ' ' + kind : ''}: ${el.className} "${txt(el).slice(0, 20)}" in ${el.parentElement && el.parentElement.parentElement && el.parentElement.parentElement.tagName.toLowerCase()} (${a[0]})`); break; }
      }
    }
    if (t === 'players' && S.players) d.querySelector('#plKind button[data-kind="skaters"]').click();
  }
  chk(absN > 0 && !loose.length, `every name a table hides for a screen reader is held by a positioned box inside its table (${absN} held; ${loose.slice(0, 3).join(' | ')})`);
  /* the Record's tiles: a figure and its label, lime where the side picks won more than they lost, rose where fewer, none on the straight-up two */
  d.querySelector('#tabs button[data-tab="record"]').click();
  const R = S.record, rate = r => r.w + r.l ? (r.w / (r.w + r.l) * 100).toFixed(1) + '%' : '—', wl = r => `${r.w}-${r.l}${r.p ? '-' + r.p : ''}`, cl = r => r.w > r.l ? 'good' : r.w < r.l ? 'bad' : '';
  const wantT = [[`${R.su.w}-${R.su.l}`, 'Straight up', ''], [rate(R.su), 'SU rate', ''], [wl(R.ml), 'Moneyline picks', cl(R.ml)], [wl(R.pl), 'Puck line picks', cl(R.pl)], [wl(R.ou), 'Totals picks', cl(R.ou)]];
  const haveT = [...d.querySelectorAll('#recordTotals .stat')].map(s => [txt(s.querySelector(':scope > b')), txt(s.querySelector(':scope > span')), (s.querySelector(':scope > b') || { className: '' }).className]);
  chk(eqA(haveT, wantT), `the Record's five tiles ${JSON.stringify(wantT)} (${JSON.stringify(haveT)})`);
  /* the Record's figures fit their tiles on one line, all five at one size: at 30px a three-figure record ("179-145") broke at its hyphen
     on a phone. jsdom lays nothing out, so here a tile is 120px wide and a figure 0.7 of its font size a character, and the page is held to
     stepping its figures down until each fits (fitRecord), on drawing the tab and again on a resize, on a record of 784-646 */
  {
    const big = Object.assign({}, S, { record: Object.assign({}, S.record, { su: { w: 784, l: 646 }, ml: { w: 157, l: 129, p: 3 }, pl: { w: 314, l: 226 }, ou: { w: 353, l: 355, p: 12 } }) });
    const errsR = [], wR = await boot(AT, errsR, { state: JSON.stringify(big) }), dR = wR.document, TILE = 120;
    const fig = el => !!(el && el.matches && el.matches('#recordTotals .stat>b')), fpx = el => parseFloat(wR.getComputedStyle(el).fontSize) || 30;
    const natural = el => txt(el).length * fpx(el) * 0.7;
    Object.defineProperty(wR.HTMLElement.prototype, 'clientWidth', { configurable: true, get() { return fig(this) ? TILE : 0; } });
    Object.defineProperty(wR.HTMLElement.prototype, 'scrollWidth', { configurable: true, get() { return fig(this) ? Math.ceil(Math.max(TILE, natural(this))) : 0; } });
    const fits = () => { const bs = [...dR.querySelectorAll('#recordTotals .stat>b')], sz = bs.map(fpx); return bs.length === 5 && bs.every(b => natural(b) <= TILE) && sz.every(x => x === sz[0]) && sz[0] >= 16 ? null : bs.map(b => `${txt(b)} ${fpx(b)}px`).join(', '); };
    dR.querySelector('#tabs button[data-tab="record"]').click();
    const f1 = fits();
    chk(txt(dR.querySelector('#recordTotals .stat>b')) === '784-646' && 7 * 30 * 0.7 > TILE && !f1, `the Record's figures step down together until each fits its tile on one line (${f1 || 'all fit'})`);
    for (const b of dR.querySelectorAll('#recordTotals .stat>b')) b.style.fontSize = '';
    wR.dispatchEvent(new wR.Event('resize')); await wait(250);
    const f2 = fits();
    chk(!f2, `and again on a resize (${f2 || 'all fit'})`);
    chk(!errsR.length, 'no runtime error fitting the Record: ' + errsR.join(' | '));
  }
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
  /* no image after every tab, every day, a drawer, the props window and the card window */
  d.querySelector('#tabs button[data-tab="games"]').click();
  for (const b of [...d.querySelectorAll('#days .day')]) { b.click(); const l = d.querySelector('#games button[data-lu]'); if (l) l.click(); }
  const ppB = [...d.querySelectorAll('#days .day')].map(b => { b.click(); return d.querySelector('#games button[data-pp]'); }).find(Boolean);
  if (ppB) { ppB.click(); chk(!d.getElementById('ppWin').hidden && [...d.querySelectorAll('#ppBody .pp-team h3')].every(h => !h.querySelector('img')), 'the props window opens, its clubs\' headings without an image'); chk(!d.querySelectorAll('img').length, 'no image with the props window open'); d.getElementById('ppClose').click(); }
  d.querySelector('#tabs button[data-tab="parlays"]').click();
  const fin = d.querySelector('[data-pb-finish]');
  if (fin) { fin.click(); chk(!d.getElementById('pcWin').hidden && !d.querySelectorAll('img').length, 'no image with the parlay card open'); d.getElementById('pcClose').click(); }
  chk(!d.querySelectorAll('img').length, `no image anywhere after every tab, day, drawer and window (${d.querySelectorAll('img').length})`);
  /* the level's lock: a word, Lock or Locked, never an icon */
  const lk = d.querySelector('[data-pb-lock]');
  if (lk) { chk(txt(lk) === 'Lock' && !lk.querySelector('svg'), `a level's lock says Lock (${txt(lk)})`); lk.click(); const l2 = d.querySelector(`[data-pb-lock="${lk.dataset.pbLock}"]`); chk(!!l2 && txt(l2) === 'Locked' && l2.getAttribute('aria-pressed') === 'true', `pressed, it says Locked (${l2 && txt(l2)})`); l2.click(); }
  chk(!d.querySelector('svg:not(.spark)'), 'no icon drawn on the page but the players\' sparklines');
  chk(!errs.length, 'no runtime error in THE LOOK: ' + errs.join(' | '));
  holdRequests(w, 'THE LOOK');
}

/* ---------- THE SUGGESTED PARLAYS' RECORD (nhl v15, tools/suggest.js) ----------
   The ledger by suggest.js's own check (its rules, and against the last commit's: NHL_PREV_SUGGEST, else git's
   HEAD:data/suggest_ledger.json); the state's record its summary; every day still to lock with a line read at the publish taken,
   the page's own levels on it at the publish and this smoke's brute force's on its own pool; and the panel's record row worked out
   from the state, pill by pill, title by title */
async function suggestRecord() {
  console.log("THE SUGGESTED PARLAYS' RECORD");
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
  chk(JSON.stringify(S.suggest) === JSON.stringify(SG.summarize(L, S.season)), `the state's record is the ledger's summary (${JSON.stringify(S.suggest && S.suggest.tiers && S.suggest.tiers.safe)})`);
  /* the days still to lock with a line read at the publish */
  const first = SG.daysOf(S), pubMin = Math.floor(PUB / 60000);
  /* a day locked already is the last commit's ledger's to hold (SG.check), whatever its first puck drop reads now (a game postponed or moved) */
  const lined = [...new Set(S.games.filter(g => g.line && g.line.at && Math.floor(Date.parse(g.line.at) / 60000) === pubMin).map(g => g.date))].filter(d => first[d] > PUB && !(L.days[d] && Date.parse(L.days[d].lock) <= PUB)).sort();
  const errs = [], w = await boot(PUB, errs, { hash: 'parlays' }), d = w.document;
  for (const day of lined) {
    const want = SG.setOf(w, day), e = L.days[day];
    if (!want.games.length) { chk(!e, `${day}: no game to come with a fresh line in the page, no entry`); continue; }
    chk(!!e && e.lock === new Date(first[day]).toISOString() && JSON.stringify([e.games, e.tiers]) === JSON.stringify([want.games, want.tiers]),
      `${day}: taken, to lock at its first puck drop ${new Date(first[day]).toISOString()}, the page's own levels at the publish (${e ? e.lock : 'no entry'})`);
    /* the brute force's levels on the day's default pool, worked out here */
    const pool = sPool({ games: S.games.filter(g => g.date === day && !sStarted(g, PUB)) }, ['ml', 'pl', 'ou'], []);
    for (const [id, label, n, floor] of TIERS) {
      const b = sBrute(pool.legs, n, floor), t = e && e.tiers[id];
      chk(b ? !!t && JSON.stringify(t.legs.map(x => x.id)) === JSON.stringify(b.legs.map(x => x.id)) && Math.abs(t.p - b.p) < 1e-4 && Math.abs(t.dec - b.d) < 1e-3 : !t,
        `${day} ${label}: the record's legs are the brute force's (${t ? t.legs.map(x => x.id).join(', ') : 'none'}; brute ${b ? b.legs.map(x => x.id).join(', ') : 'none'})`);
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
    chk(!rec.hidden && rec.closest('#pbPanel') && rec.previousElementSibling && rec.previousElementSibling.classList.contains('pb-head') && JSON.stringify(got) === JSON.stringify(want),
      `the panel's record row under its heading, pill by pill: ${got.join(' | ')} (want ${want.join(' | ')})`);
    if (any) for (const [id, label] of TIERS) {
      const t = R.tiers[id], el = rec.querySelector(`[data-pb-rec="${id}"]`);
      const title = `${label}: ${t.won} won of ${t.graded} graded${R.since ? ` since ${PBS.day(R.since)}` : ''}${t.graded ? `; wins expected ${f1(t.exp_fair)} by DraftKings' fair chance${t.fair_n < t.graded ? ` (on the ${t.fair_n} with one)` : ''}, ${f1(t.exp_model)} by the model` : ''}`
        + (t.push ? `; ${pl(t.push, 'push')}, the stake back` : '') + (t.none ? `; ${pl(t.none, 'day')} with no ${label} parlay` : '') + (t.replay ? `; ${t.replay} of them rebuilt by today's rules from the state the site published before that day's first puck drop` : '');
      chk(!!el && el.getAttribute('title') === title, `${label}'s pill says its record in its title: ${el && el.getAttribute('title')}`);
    }
    /* the figures by the ledger's own days, worked out here: won, lost and units on 1 a day */
    for (const [id, label] of TIERS) {
      let won = 0, lost = 0, units = 0;
      for (const [day, e] of Object.entries(L.days)) { if (SG.seasonOf(day) !== S.season || !e.grade || !e.grade[id]) continue; const g = e.grade[id]; if (g.result === 'won') { won++; units += g.payout - 1; } else if (g.result === 'lost') { lost++; units -= 1; } }
      chk(R.tiers[id].won === won && R.tiers[id].lost === lost && Math.abs(R.tiers[id].units - units) < 1e-3, `${label}: ${won}-${lost}, ${units.toFixed(2)} units by the ledger's days (${R.tiers[id].won}-${R.tiers[id].lost}, ${R.tiers[id].units})`);
    }
  }
  chk(!errs.length, 'no runtime error drawing the record: ' + errs.join(' | '));
  console.log(`  ${Object.keys(L.days).length} days in the ledger, ${lined.length} still to lock with a fresh line; ` + (R ? TIERS.map(([id, label]) => `${label} ${R.tiers[id].won}-${R.tiers[id].lost}`).join(', ') : 'no record'));
}

async function main() {
  const errors = [];
  reality();
  /* the page at the moment it was published */
  const w = await boot(PUB + 60000, errors), d = w.document;
  const $ = id => d.getElementById(id);
  chk(errors.length === 0, 'runtime errors: ' + errors.join(' | '));
  chk(/season/.test(txt($('stamp'))), 'header stamp says the season: ' + txt($('stamp')));
  chk(txt($('buildTag')).startsWith('nhl v'), 'build tag on the header');

  /* Games: a day strip with one day open, a card per game that day, the two chances on each adding to 100 */
  const days = [...d.querySelectorAll('#days .day')];
  chk(days.length >= 7, `the day strip has a week or more (${days.length})`);
  const on = d.querySelector('#days .day.on');
  chk(!!on, 'one day is open');
  const todayBtn = days.find(b => /today/i.test(txt(b.querySelector('.dw'))));
  if (todayBtn) chk(todayBtn.dataset.day === etDate(PUB + 60000), `"Today" on the strip is the visitor's day ${etDate(PUB + 60000)}, not ${todayBtn.dataset.day}`);
  const dayGames = S.games.filter(g => g.date === on.dataset.day);
  let cards = d.querySelectorAll('#games .game');
  chk(cards.length === dayGames.length, `the open day shows ${dayGames.length} games, not ${cards.length}`);
  const withGames = days.find(b => /\d+ games?/.test(txt(b)) && !b.classList.contains('on'));
  if (withGames) {
    withGames.click();
    const n = S.games.filter(g => g.date === withGames.dataset.day).length;
    chk(d.querySelectorAll('#games .game').length === n, `clicking a day shows its ${n} games`);
  }
  cards = d.querySelectorAll('#games .game');
  const MAP0 = pageMap(w);
  for (const c of cards) {
    const wps = [...c.querySelectorAll('.pline .wp')].map(x => parseInt(txt(x)));
    chk(wps.length === 2 && Math.abs(wps[0] + wps[1] - 100) <= 1, 'the two chances on a card add to 100: ' + wps.join('+'));
    const g = S.games.find(x => x.id === c.dataset.id);
    /* the card, worked out here: the margin, goals and overtime chips, the calls and their grades or why there is none, every part (THE LOOK) */
    if (g) { const bad = cardWrongs(w, c, g, PUB + 60000, MAP0); chk(!bad.length, `${g.id}: the card is the state's (${bad.slice(0, 3).join(' | ')})`); }
    if (g && g.state === 'live') chk(/as of/.test(txt(c.querySelector('.when'))), `a live score the job published says when it was read: ${g.id}`);
    if (g && startedAt(g, PUB + 60000)) chk(!c.querySelector('button[data-leg]'), `no bet offered on a game that has started: ${g.id}`);
    if (g && g.pm && g.pm.inj) chk(/Injury report of/.test(txt(c)), `a card names the injury report its lineup was built on: ${g.id}`);
  }
  /* a game whose start the feed moved after its puck drop keeps the call made before it: its day opened,
     the card offers no bet and says why */
  for (const g of S.games.filter(g => !startedAt(g, PUB + 60000) && delayedAt(g, g.start, PUB + 60000))) {
    const b = d.querySelector(`#days .day[data-day="${g.date}"]`); if (b) b.click();
    const c = d.querySelector(`#games .game[data-id="${g.id}"]`);
    chk(c && !c.querySelector('button[data-leg]') && /start moved/.test(txt(c.querySelector('.when'))), `no bet offered on a game whose start moved after its puck drop, and the card says so: ${g.id}`);
  }
  /* a score the job published while a game was under way says when it was read */
  const liveGames = S.games.filter(g => g.state === 'live');
  if (liveGames.length) {
    const b = d.querySelector(`#days .day[data-day="${liveGames[0].date}"]`);
    if (b) {
      b.click();
      for (const g of liveGames.filter(x => x.date === liveGames[0].date)) { const c = d.querySelector(`#games .game[data-id="${g.id}"]`); chk(c && /as of/.test(txt(c.querySelector('.when'))), `a live score the job published says when it was read: ${g.id}`); }
      if (withGames) withGames.click();
    }
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
  const btn = d.querySelector('#games button[data-leg]');
  if (btn) {
    btn.click();
    chk(w.localStorage.getItem('nhl_v1') && JSON.parse(w.localStorage.getItem('nhl_v1')).legs.length === 1, 'clicking a line adds a leg to the browser store');
    chk(txt($('legCount')) === '1', 'the tab bar counts the leg');
    const same = btn.dataset.leg.split('|')[0], slot = b => b.dataset.leg.split('|')[2] === 'ou' ? 'tot' : 'side';
    const other = [...d.querySelectorAll('#games button[data-leg]')].find(b => b.dataset.leg.split('|')[0] === same && b !== btn && !b.classList.contains('on') && slot(b) === slot(btn));
    if (other) { other.click(); chk(JSON.parse(w.localStorage.getItem('nhl_v1')).legs.length === 1, 'a second leg in the same slot of the same game replaces the first'); }
  }

  /* Standings: four divisions of eight, every club once, the sixteen in the field marked */
  d.querySelector('#tabs button[data-tab="standings"]').click();
  const tables = d.querySelectorAll('#standings table');
  chk(tables.length === 4, `four division tables (${tables.length})`);
  chk(d.querySelectorAll('#standings tbody tr').length === 32, 'thirty-two clubs in the standings');
  chk(d.querySelectorAll('#standings tbody tr.in').length === 16, `sixteen clubs in the field (${d.querySelectorAll('#standings tbody tr.in').length})`);
  for (const t of tables) chk(t.querySelectorAll('tbody tr').length === 8, 'eight clubs in a division');

  /* Power ratings */
  d.querySelector('#tabs button[data-tab="ratings"]').click();
  chk(d.querySelectorAll('#ratTable tbody tr').length === 32, 'ratings table shows the 32 clubs');
  chk(txt(d.querySelector('#ratTable tbody tr td')) === '1', 'ratings start at rank 1');
  $('ratConf').value = 'East'; $('ratConf').dispatchEvent(new w.Event('change'));
  chk(d.querySelectorAll('#ratTable tbody tr').length === 16, 'a conference is sixteen clubs');

  /* the playoff picture: the simulation the Standings' and Power ratings' Playoff and Cup columns read (the tab that drew the bracket
     went in nhl v14) */
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
  if (S.playoff.champion) chk(txt($('stamp')).includes(`${S.teams[S.playoff.champion].short} won the Cup`), `the champion is named in the header (${txt($('stamp'))})`);

  /* Players: the rankings, the clubs, who is out and where the report and the goalies come from */
  d.querySelector('#tabs button[data-tab="players"]').click();
  if (PL) {
    chk(d.querySelectorAll('#plTeams tbody tr').length === Object.keys(PL.teams).length, 'a row a club in Club strength tonight');
    for (const [c, t] of Object.entries(PL.teams)) if ((t.out || []).length) {
      const row = [...d.querySelectorAll('#plTeams tbody tr')].find(r => r.textContent.includes(S.teams[c].short));
      chk(row && !/nobody/.test(txt(row.lastElementChild)), `${c}'s out list is shown (${t.out.length})`);
    }
    if (PL.injuries) chk(/injury report of/i.test(txt($('plSources'))), 'the Players tab says which injury report it used');
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

  /* Record */
  d.querySelector('#tabs button[data-tab="record"]').click();
  chk(new RegExp(`${S.record.su.w}-${S.record.su.l}`).test(txt($('recordTotals'))), 'record tab shows the straight-up record');
  chk(d.querySelectorAll('#recMonth tbody tr').length === Object.keys(S.record.byMonth).length, 'a row per graded month');
  chk(/Held out/.test(txt($('fitNote'))), 'the fit note reports the holdout');
  const blind = S.games.filter(g => g.result && g.frozen && g.pm && !g.pm.inj).length;
  if (blind) chk(txt($('recordNote')).includes(`${blind} calls were made before the injury report was applied`), 'the record says how many calls were made without the injury report');

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
    d2.querySelector(`#days .day[data-day="${next.date}"]`) && d2.querySelector(`#days .day[data-day="${next.date}"]`).click();
    for (const g of startedNow.filter(g => g.date === next.date)) {
      const c = d2.querySelector(`#games .game[data-id="${g.id}"]`);
      chk(c && !c.querySelector('button[data-leg]'), `opened at ${new Date(at).toISOString().slice(0, 16)}Z, the page still offers a bet on ${g.away}@${g.home}, which started at ${g.start}`);
      chk(c && /under way/.test(txt(c.querySelector('.when'))), `a game past its puck drop with no score yet says it is under way: ${g.id}`);
    }
    const t2 = [...d2.querySelectorAll('#days .day')].find(b => /today/i.test(txt(b.querySelector('.dw'))));
    chk(!t2 || t2.dataset.day === etDate(at), `"Today" follows the visitor's clock (${etDate(at)}), not the job's day (${t2 && t2.dataset.day})`);
    d2.querySelector('#tabs button[data-tab="parlays"]').click();
    const offered = [...d2.querySelectorAll('#plLines button[data-leg]')].map(b => b.dataset.leg.split('|')[0]);
    chk(!startedNow.some(g => offered.includes(g.id)), 'the Parlays tab offers no game that has started');
    chk(errs.length === 0, 'runtime errors at puck drop: ' + errs.join(' | '));
  }

  holdRequests(w, 'the page as published');
  try { await theLook(); } catch (e) { chk(false, `THE LOOK stopped at a step the page broke: ${String(e && e.stack || e).split('\n').slice(0, 2).join(' ')}`); }
  await parlayBuilder();
  await parlayEdges();
  try { await suggestRecord(); } catch (e) { chk(false, `THE SUGGESTED PARLAYS' RECORD stopped: ${String(e && e.stack || e).split('\n').slice(0, 2).join(' ')}`); }
  await refreshOddsChecks();
  await playerPropsChecks();
  try { await jobLinesChecks(); } catch (e) { chk(false, `THE JOB'S PLAYER LINES stopped at a step the page broke: ${String(e && e.stack || e).split('\n').slice(0, 2).join(' ')}`); }
  /* a page that breaks this section's steps (a button missing, a leg not where it should be) fails it, never ends the smoke unheard */
  try { await sameGameChecks(); } catch (e) { chk(false, `SAME-GAME PARLAYS AND PLAYER LEGS stopped at a step the page broke: ${String(e && e.stack || e).split('\n').slice(0, 2).join(' ')}`); }

  /* written synchronously: process.exit (the page's timers would keep Node up) must not cut a piped log short */
  const shown = process.env.NHL_SMOKE_ALL ? fails : fails.slice(0, 60);
  fs.writeSync(1, [`${checks} checks, ${fails.length} failures`].concat(shown.map(f => '  FAIL ' + f), fails.length > shown.length ? [`  ... and ${fails.length - shown.length} more (NHL_SMOKE_ALL=1 lists them all)`] : []).join('\n') + '\n');
  process.exit(fails.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
