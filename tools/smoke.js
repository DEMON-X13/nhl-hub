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
   NHL_STATE, NHL_DATA and NHL_PREV_STATE move the files (simulate.js). */
'use strict';
const fs = require('fs'), path = require('path');
const { execFileSync } = require('child_process');
const { JSDOM } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const DATA = process.env.NHL_DATA || path.join(ROOT, 'data');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const STATE = fs.readFileSync(process.env.NHL_STATE || path.join(ROOT, 'state.json'), 'utf8');
const S = JSON.parse(STATE);
const readJSON = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const PREV = (() => {
  if (process.env.NHL_PREV_STATE) return process.env.NHL_PREV_STATE === 'none' ? null : readJSON(process.env.NHL_PREV_STATE);
  if (process.env.NHL_STATE) return null;
  try { return JSON.parse(execFileSync('git', ['show', 'HEAD:state.json'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] })); } catch (e) { return null; }
})();

const fails = []; let checks = 0;
const chk = (ok, msg) => { checks++; if (!ok) fails.push(msg); };
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

/* boot the page with the clock at `clockMs`; resolves to the window once it has drawn */
async function boot(clockMs, errors) {
  const dom = new JSDOM(HTML.replace(/<link[^>]*fonts[^>]*>/g, ''), {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      const Real = w.Date, offset = clockMs - Real.now();
      class Clock extends Real { constructor(...a) { if (a.length) super(...a); else super(Real.now() + offset); } static now() { return Real.now() + offset; } }
      w.Date = Clock;
      w.fetch = async url => {
        if (String(url).startsWith('state.json')) return { ok: true, json: async () => JSON.parse(STATE) };
        if (String(url).includes('espn.com')) return { ok: true, json: async () => ({ events: [] }) };
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

  /* Parlays: the lines are offered with buttons, and the leg added above is priced */
  d.querySelector('#tabs button[data-tab="parlays"]').click();
  const lined = S.games.filter(g => !startedAt(g, PUB + 60000) && g.line);
  chk(d.querySelectorAll('#plLines tbody tr').length > 0, 'the Parlays tab lists lined games or says there are none');
  if (lined.length) {
    chk(d.querySelectorAll('#plLines button[data-leg]').length >= d.querySelectorAll('#plLines tbody tr').length, 'each listed game offers at least one button');
    const before = (JSON.parse(w.localStorage.getItem('nhl_v1') || '{}').legs || []).length;
    const pb = [...d.querySelectorAll('#plLines button[data-leg]')].find(b => !b.classList.contains('on'));
    pb.click();
    const after = (JSON.parse(w.localStorage.getItem('nhl_v1') || '{}').legs || []).length;
    chk(after >= before, 'a button on the Parlays tab adds a leg');
    chk(d.querySelectorAll('#legs .leg').length === after, 'the builder redraws with it');
  }
  const legs = JSON.parse(w.localStorage.getItem('nhl_v1') || '{}').legs || [];
  chk(d.querySelectorAll('#legs .leg').length === legs.length, 'the builder lists the legs');
  if (legs.length) {
    chk(/Parlay odds/.test(txt($('parlayTotals'))) && /Model/.test(txt($('parlayTotals'))), 'a parlay is priced with the model beside it');
    $('saveParlay').click();
    chk(d.querySelectorAll('#savedList .saved').length === 1, 'saving keeps the parlay');
    chk(/pending/.test(txt($('savedList'))), 'an unplayed parlay is pending');
    chk(JSON.parse(w.localStorage.getItem('nhl_v1')).legs.length === 0, 'saving empties the builder');
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

  /* written synchronously: process.exit (the page's timers would keep Node up) must not cut a piped log short */
  const shown = process.env.NHL_SMOKE_ALL ? fails : fails.slice(0, 60);
  fs.writeSync(1, [`${checks} checks, ${fails.length} failures`].concat(shown.map(f => '  FAIL ' + f), fails.length > shown.length ? [`  ... and ${fails.length - shown.length} more (NHL_SMOKE_ALL=1 lists them all)`] : []).join('\n') + '\n');
  process.exit(fails.length ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
