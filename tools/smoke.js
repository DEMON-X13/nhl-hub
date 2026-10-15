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
       first round the bracket draws
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
   the URL answering ESPN's scoreboard in place of an empty one). The clock is
   the window's __setClock(ms) from then on; every request the page makes is in __requests, every key it
   writes in __writes, and confirm() answers __confirm (true unless set) */
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
      const body = opts.state || STATE;
      w.fetch = async (url, init) => {
        w.__requests.push({ url: String(url), method: (init && init.method) || 'GET', cache: init && init.cache });
        if (String(url).startsWith('state.json')) return { ok: true, json: async () => JSON.parse(body) };
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
}

/* ================= THE PARLAY BUILDER =================
   The panel, its four levels, the builder, the card and DraftKings' ids, each held to the state by rules
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
const TIERS = [['safe', 'Safe', 2, 0], ['med', 'Medium', 3, 0.25], ['aggr', 'Aggressive', 4, 0.12], ['xtrm', 'Extreme', 5, 0.05]];
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
  if (wide) { chk(wEl && txt(wEl) === wide, `${tag}: the panel says "${wide}" (${wEl ? txt(wEl) : 'four levels drawn'})`); return { sl, pool, levels: null, stake }; }
  chk(!wEl && d.querySelectorAll('.pb-tier').length === 4, `${tag}: four levels`);
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
      chk(!ks.length === (empties.length === 4 && empties.every(t => t === 'No bet types ticked: tick at least one above.')), `boxes ${ks.join(',') || 'none'}: "No bet types ticked" shown exactly when none is ticked`);
      holdPanel(w, AT, `boxes ${ks.join(',') || 'none'}`, false);
    }
    setBoxes(['ml', 'pl', 'ou']);
    d.querySelector('#pbGames button[data-gall="0"]').click();
    let empties = [...d.querySelectorAll('.pb-tier.none .pb-empty')].map(txt);
    chk(empties.length === 4 && empties.every(t => t === 'No games ticked: tick at least one above.') && store().ui.pb.off.length === P0.pool.tickable.length, `None: every level says "No games ticked" (${empties[0]}), and the games are stored unticked`);
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
      /* a second bet on one game replaces the first, said */
      const g0 = sl2[0].g, alt = ['ml', 'pl', 'ou'].flatMap(k => PBS.SIDES[k].map(s => [s, k])).find(([s, k]) => `${g0.id}|${s}|${k}` !== sl2[0].id && sLeg(g0, s, k));
      if (alt) {
        const ab = d.querySelector(`#plLines button[data-leg="${g0.id}|${alt[0]}|${alt[1]}"]`); ab.click();
        chk(store().legs.filter(l => l.game === g0.id).length === 1 && store().legs.some(l => l.game === g0.id && l.side === alt[0] && l.kind === alt[1]), 'a second bet on a game replaces the first');
        chk(/replaced .* on .*: one leg a game\./.test(txt($('bMsg'))) && /one leg a game/.test(txt($('slipMsg'))), `the replace is said in the builder and the slip bar (${txt($('bMsg'))})`);
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
        const t = txt(btn);
        chk(t.includes(PBS.odds(L.price)) && t.includes(PBS.pctW(L.p)), `${g.id} ${s} ${k}: the button shows the state's price and model chance (${t})`);
        chk(/model's call/.test(t) === (L.pick === s), `${g.id} ${s} ${k}: the call's side is tagged (${t})`);
        chk(/far off the market/.test(t) === (L.fair !== null && L.p - L.fair >= 0.15), `${g.id} ${s} ${k}: flagged far off exactly at 15 points over the fair chance (${t})`);
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
  const bad = w.__requests.filter(r => !(r.url.startsWith('state.json?t=') || r.url.startsWith('https://site.api.espn.com/')) || r.method !== 'GET' || r.cache !== 'no-store');
  chk(!bad.length, `${tag}: the page asks for state.json and ESPN's scoreboard alone, GET, no-store (${bad.map(r => r.method + ' ' + r.url).join(', ')})`);
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
  chk(order.slice(0, 5).join(',') === 'pcClose,pcDk,pcLink,pcDown,pcAgain' && order.slice(5).every(x => /^leg \d+$/.test(x)), `the Tab order is Close, Open in DraftKings, Share link, Download image, Start over, the legs (${order.join(', ')})`);
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
        const names = held.map(g => `${S.teams[g.away].abbr} @ ${S.teams[g.home].abbr}`), said = (names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0]) + ` dropped the puck: the levels were rebuilt without ${names.length > 1 ? 'them' : 'it'}.`;
        const fb = hitLv.querySelector('[data-pb-finish]'); fb.focus(); fb.click();
        chk(d.getElementById('pcWin').hidden && ![...d.querySelectorAll(`.pb-tier[data-tier="${tier}"] .pb-tl`)].some(x => sStarted(gidOf(x), at2)), `${tier}'s Finish, its game started, opens nothing and redraws the level without it`);
        chk(txt(d.getElementById('pbNotes')).includes(said), `and the panel says why: "${said}" (${txt(d.getElementById('pbNotes')).slice(0, 160)})`);
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
      chk(c && !c.querySelector('button[data-leg]') && /not on DraftKings at the last run/.test(txt(c)), `a stale line's card offers no bet and says why: ${c && txt(c.querySelector('.lines')).slice(0, 160)}`);
      chk(!errs.length, 'no runtime error on a stale line: ' + errs.join(' | '));
    } finally { S = real; }
  }
  /* a made-up state with one game priced at another book (its links ESPN BET's, so no DraftKings id) and one with no book named: their legs
     are offered like any other, but the price is never called DraftKings' and no DraftKings link is made for them */
  if (D && freshOn(D).length >= 2) {
    const M = JSON.parse(STATE), onD = freshOn(D), ob = M.games.find(g => g.id === onD[0].id), nb = M.games.find(g => g.id === onD[1].id);
    ob.line.book = 'ESPN BET'; delete ob.line.dk; nb.line.book = null;
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
const espnReqs = w => w.__requests.filter(r => r.url.includes('espn.com'));
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
  /* and on the state: the page's goals layer gives the published chances back on every line from the row's own (rounded) total, margin and gap */
  const rows = S.games.filter(g => g.line && ((g.cover && g.line.homeLine !== null && g.line.homeLine !== undefined) || (g.ou && g.line.total !== null && g.line.total !== undefined)) && isFinite(g.xt) && isFinite(g.mu) && isFinite(g.diff));
  if (rows.length) {
    const back = JSON.parse(w.eval(`JSON.stringify(${JSON.stringify(rows.map(g => [g.xt, g.mu, g.diff, g.line.homeLine, g.line.total]))}.map(([t, mu, d, hl, tot]) => { const G = MODEL.goals(t, mu, d, (S.model && S.model.pull) || 0); return [MODEL.coverProbs(G, hl), MODEL.totalProbs(G, tot)]; }))`));
    const off = rows.filter((g, i) => (g.cover && back[i][0] && Math.max(Math.abs(back[i][0].cover - g.cover.home), Math.abs(back[i][0].lose - g.cover.away)) > 0.001) || (g.ou && back[i][1] && Math.max(Math.abs(back[i][1].over - g.ou.over), Math.abs(back[i][1].under - g.ou.under)) > 0.001));
    chk(!off.length, `the page's goals layer gives back the published puck line and total chances within a rounding on ${rows.length} lines (${off.length} off, e.g. ${off[0] && off[0].id})`);
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
  chk(txt(d.getElementById('pbOddsNote')) === "Reading DraftKings' lines from ESPN…" && d.getElementById('pbRefreshOdds').getAttribute('aria-disabled') === 'true', `while ESPN is read the status line says so and the button is marked busy (${txt(d.getElementById('pbOddsNote'))})`);
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
  const said = sOddsText(cnt, atMs) + (cardShut ? ' The parlay card was closed: a leg on it moved or came off with this read; Finish again for the new lines.' : '');
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
        if (L && btn) chk(txt(btn).includes(PBS.odds(L.price)) && txt(btn).includes(PBS.pctW(L.p)) && /model's call/.test(txt(btn)) === (L.pick === s), `${g.id} ${s} ${k}: the new price, chance and call (${txt(btn)})`);
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
    const said3 = sOddsText(cnt3, at3);
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
    const said2 = sOddsText({ answered: false, lined: lineNow }, w2.Date.now());
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
    const said3 = sOddsText({ answered: true, read: 0, noLine: comeB.filter(g => g.line && !sFresh(g)).length, unread: 0, started: 0, older: linedB.length }, w3.Date.now());
    chk(canon(pageGames(w3)) === b0 && txt(d3.getElementById('oddsNote')) === said3, `a read older than the lines shown takes none of them and says so ("${said3}": ${txt(d3.getElementById('oddsNote'))})`);
    chk(!errs3.length, 'no runtime error on an older read: ' + errs3.join(' | '));
  } else console.log('  no line on a game still to come half an hour before the publish: the older-read check is skipped');
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
  const withGames = days.find(b => /games/.test(txt(b)) && !b.classList.contains('on'));
  if (withGames) {
    withGames.click();
    const n = S.games.filter(g => g.date === withGames.dataset.day).length;
    chk(d.querySelectorAll('#games .game').length === n, `clicking a day shows its ${n} games`);
  }
  cards = d.querySelectorAll('#games .game');
  for (const c of cards) {
    const wps = [...c.querySelectorAll('.wp')].map(x => parseInt(txt(x)));
    chk(wps.length === 2 && Math.abs(wps[0] + wps[1] - 100) <= 1, 'the two chances on a card add to 100: ' + wps.join('+'));
    chk(/Model/.test(txt(c)) && /total/.test(txt(c)), 'a card shows the model margin and total');
    chk(/call right|call wrong|no edge|no line yet|ML |\+\d/.test(txt(c)), 'every card carries a call, a result or the reason there is none');
    const g = S.games.find(x => x.id === c.dataset.id);
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
  /* a leg can be added from a game that has a line and is still to come; a second leg on the same game replaces it */
  const btn = d.querySelector('#games button[data-leg]');
  if (btn) {
    btn.click();
    chk(w.localStorage.getItem('nhl_v1') && JSON.parse(w.localStorage.getItem('nhl_v1')).legs.length === 1, 'clicking a line adds a leg to the browser store');
    chk(txt($('legCount')) === '1', 'the tab bar counts the leg');
    const same = btn.dataset.leg.split('|')[0];
    const other = [...d.querySelectorAll('#games button[data-leg]')].find(b => b.dataset.leg.split('|')[0] === same && b !== btn && !b.classList.contains('on'));
    if (other) { other.click(); chk(JSON.parse(w.localStorage.getItem('nhl_v1')).legs.length === 1, 'a second leg on the same game replaces the first'); }
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

  /* Playoff */
  d.querySelector('#tabs button[data-tab="playoff"]').click();
  chk(d.querySelectorAll('#bracket .series').length >= 8, 'the bracket has eight first-round series');
  chk(d.querySelectorAll('#poTable tbody tr').length === 32, 'playoff odds table has every club');
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
  for (const s of S.playoff.series || []) {
    const row = [...d.querySelectorAll('#bracket .series')].find(r => r.textContent.includes(S.teams[s.a].short) && r.textContent.includes(S.teams[s.b].short));
    chk(!!row && /won|leads|tied/.test(txt(row.querySelector('.score'))), `the bracket shows the score of ${s.a}-${s.b} (${JSON.stringify(s.wins)})`);
  }
  if (S.playoff.champion) chk(!!$('champ') && !$('champ').hidden && txt($('champ')).includes(S.teams[S.playoff.champion].name), 'the champion is named');

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
  await parlayBuilder();
  await parlayEdges();
  await refreshOddsChecks();

  /* written synchronously: process.exit (the page's timers would keep Node up) must not cut a piped log short */
  const shown = process.env.NHL_SMOKE_ALL ? fails : fails.slice(0, 60);
  fs.writeSync(1, [`${checks} checks, ${fails.length} failures`].concat(shown.map(f => '  FAIL ' + f), fails.length > shown.length ? [`  ... and ${fails.length - shown.length} more (NHL_SMOKE_ALL=1 lists them all)`] : []).join('\n') + '\n');
  process.exit(fails.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
