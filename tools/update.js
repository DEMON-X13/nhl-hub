/* The NHL job: read this season from ESPN, rate every club, call every game, freeze the call
   and the lines before puck drop, grade what has finished, simulate the playoff picture and
   write state.json, which is everything the page shows.

    node tools/update.js              the season, from ESPN: rate, call, grade, write
    node tools/update.js --scores     the job's first pass: the same season read, the scores, states and
                                      schedule written, and every call copied from the last state
                                      as it was, none made; last night's finals are then in the state
                                      before fetch_box.js boxes them and players.js lines up on the
                                      same schedule the second pass calls on
    node tools/update.js --offline    from the scoreboard files a previous run saved in tools/out/

   NHL_TODAY, NHL_NOW, NHL_STATE, NHL_OUT, NHL_TEAMS and NHL_DATA in the environment move the day,
   the clock and the files, which is how simulate.js plays a fabricated season through it without
   touching the real ones.

   Free: ESPN's public feeds only, nothing spends a credit. One request per day from the
   season's start to the end of June, skipping the days the last state already has complete,
   so the whole schedule is known and a pass in season is a couple of hundred small requests.
   A day the last state still has a game to finish on, through tomorrow, must be read fresh: if
   ESPN does not answer for one (or answers with no game where the last state has some, none
   called off and not all on another day now), the run exits 1 having written nothing, so the last
   good state stays live; a later day that fails keeps the schedule the last state had. A game
   leaves the schedule only when the feed marks it postponed or cancelled (or it has moved to
   another day): one an answer merely leaves out is kept as the last state had it, call, line and
   grade, and said (`kept`), and only one never final two days past its puck drop that the feed has
   not shown since goes. Every game taken off is listed in `removed` with the feed's reason, so the
   smoke test can account for each started call of the last published state.

   The call is frozen at puck drop, by the clock and not only by ESPN's state (a game delayed past
   its start is not called again, nor one whose start ESPN moves less than half a day later after
   the puck drop its call was made before): once a game has started, every part of the call shown
   before it (the chance, margin, total, overtime chance, the line, each side taken and whose call
   it was) is copied from the last state and graded as it stands, never recomputed. Only the second
   pass makes calls. A row an older job wrote after puck drop, which recomputed the puck-line side
   from the team Elo's margin, is put back to the call shown before puck drop from the inputs it
   kept (the player model's margin, the line, the chance and total): every pick, side and margin as
   that run computed it; the team Elo's view shown beside it (`elo`, display only) from the replay
   for a final and from the ratings as they stand while it is live. Games that were already over
   when this job first ran are graded from the replay and marked so.

   The model is tools/elo.js with the parameters fit.js wrote to data/model.json,
   replayed over the finished seasons (hist.js: history.json and the season_<year>.json files) and
   then this season's finished games, in date order. The first run of a new season (from August)
   writes the old season's finals, playoffs included, to data/season_<year>.json from the last
   state, so no season is ever dropped; with neither that state nor the file it exits 1.

   The playoff picture: before the regular season ends, the rest of it played SIMS times and the
   league's bracket off each simulated table; once it has ended the field is the real one, the
   series are the ones ESPN has, each played on from its real score, so a club knocked out has no
   chance left and the bracket carries each series' score. The field is the sixteen of that first
   round: a club the table's tie-breakers left out that ESPN has in a series is in for certain, and
   the club it displaced is out. `phase` says preseason, regular, postseason or over (the Cup
   awarded), offseason with no games at all.

   For the Parlay Builder's same-game legs and player legs the state carries two more things, copied, never worked out
   here: `sgp`, data/corr.json's table of how the legs of one game move together and its same-game hold (tools/corr.js
   measured it on the finished seasons; tools/sgp.js is the rule the page copies word for word), and `box`, the box score
   of every final from BOX_DAYS days before today through today from data/box_<season>.jsonl, each player who was on the
   ice with what DraftKings settles his props on (a skater's goals, assists, shots on goal and blocked shots, a starting
   goalie's saves; a goalie who came on in relief is listed apart, his saves prop void; the goalies of a side whose starter
   the box score cannot tell are listed apart again, their saves graded nowhere), so the page can grade a visitor's saved
   player leg. */
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./espn');
const Hist = require('./hist');
const { Elo, expected, spreadOf, goals, coverProbs, totalProbs } = require('./elo');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.NHL_DATA || path.join(ROOT, 'data'), OUT = process.env.NHL_OUT || path.join(__dirname, 'out');
const STATE = process.env.NHL_STATE || path.join(ROOT, 'state.json');   // simulate.js points these at a scratch folder
const TEAMS = process.env.NHL_TEAMS || path.join(DATA, 'teams.json');
const ARGS = new Set(process.argv.slice(2));
/* the clock: NHL_NOW (YYYY-MM-DDTHH:MMZ), or NHL_TODAY at noon UTC for the simulation, else now */
const NOW = process.env.NHL_NOW || (process.env.NHL_TODAY ? process.env.NHL_TODAY + 'T12:00Z' : new Date().toISOString().slice(0, 16) + 'Z');
const TODAY = process.env.NHL_TODAY || E.etDate(NOW);
const SEASON = +(process.env.NHL_SEASON || E.seasonOf(TODAY));      // the season's one source: the Eastern date
const EDGE = 0.05;                                  // the model's chance must beat the book's implied by this to take a side
const SIMS = 2000;
const SHRINK = 20;                                  // games before a club's own scoring rate outweighs the league's
/* the parts of a row that are the call: made before puck drop, copied unchanged after it */
const CALL = ['pHome', 'rh', 'ra', 'diff', 'mu', 'xt', 'tie', 'frozen', 'before', 'pm', 'elo', 'by', 'line', 'pick', 'mlEdge', 'mlPick', 'cover', 'plEdge', 'plPick', 'ou', 'ouEdge', 'ouPick'];
const CALL_V = 2;                                   // a row whose call this job made or kept whole

const log = m => console.log(new Date().toISOString().slice(11, 19), m);
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const implied = am => am === null || am === undefined ? null : (am > 0 ? 100 / (am + 100) : -am / (-am + 100));
const r3 = x => +x.toFixed(3);
const BOX_DAYS = 14;                                // the finals whose box scores the state carries for grading saved player legs: today and the 14 days before
/* the box scores the page grades a saved player leg on: every final in this state on the days from TODAY - BOX_DAYS through
   TODAY that data/box_<season>.jsonl has, each skater who was on the ice ([goals, assists, shots on goal, blocked shots]) in `s`,
   each side's STARTING goalie (his saves) in `g`, and the goalies who came on in relief in `r` (only where a side used two). A
   saves prop stands only on the goalie who starts, pulled or not, and is void on one who comes on in relief: the books' rule
   for goalie props as secondary sources quote it, DraftKings' among them (its house rules, filed with the Massachusetts Gaming
   Commission, could not be read from here; the conservative reading), so a reliever's saves are never carried to grade on. The
   starter is the one the box file marks (`st`: the first of the side's goalies ESPN's plays name making a save, read by
   fetch_box.js), and the mark is certain only where every other goalie of the side made a save of his own: a starter pulled
   with every shot he faced a goal (or before facing one) made none, so the first save is his reliever's and the mark falls on
   the reliever (CBJ at VGK, 8 January 2026, 401803043: Carter Hart started and was pulled at 8:24 with one shot against, a
   goal; Akira Schmid, who relieved him, carries the mark), and a late reliever who faced a shot or two without a save looks the
   same in the box. So a side that used two goalies, any of them unmarked and without a save (or none marked), is a side whose
   starter the box cannot tell: all its goalies go in `u`, in neither `g` nor `r`, and the page grades no saves prop on them
   (it cannot be graded here). A side with one goalie is certain. A player not listed did not play, and a column ESPN left
   out is null */
const savesOf = x => typeof x.sa === 'number' && isFinite(x.sa) && typeof x.ga === 'number' && isFinite(x.ga) ? x.sa - x.ga : null;
/* each side's goalies who played: { st: the starter, rel: the others } where the box tells, else { unsure: every one of them } */
const sidesOf = b => [b.home, b.away].map(t => {
  const gs = (b.goalies || []).filter(x => x && x.team === t && x.id && x.toi > 0);
  if (gs.length < 2) return gs.length ? { st: gs[0], rel: [] } : null;
  const st = gs.find(x => x.st), rel = gs.filter(x => x !== st);
  return st && rel.every(x => savesOf(x) > 0) ? { st, rel } : { unsure: gs };
}).filter(Boolean);
function boxWindow(rows) {
  const from = addDays(TODAY, -BOX_DAYS), want = new Map(rows.filter(r => r.state === 'final' && r.date >= from && r.date <= TODAY).map(r => [r.id, r]));
  const games = {};
  for (const s of [E.seasonOf(from), SEASON].filter((s, i, a) => a.indexOf(s) === i)) {
    const f = path.join(DATA, `box_${s}.jsonl`); if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
      if (!line) continue;
      let b; try { b = JSON.parse(line); } catch (e) { continue; }
      if (!b || !want.has(String(b.id))) continue;
      const n = v => typeof v === 'number' && isFinite(v) ? v : null;
      const sk = {}, gk = {}, rel = [], uns = [];
      for (const x of b.skaters || []) if (x && x.id && x.toi > 0) sk[String(x.id)] = [n(x.g), n(x.a), n(x.s), n(x.bs)];
      for (const side of sidesOf(b)) {
        if (side.unsure) { uns.push(...side.unsure.map(x => String(x.id))); continue; }
        gk[String(side.st.id)] = savesOf(side.st);
        rel.push(...side.rel.map(x => String(x.id)));
      }
      games[String(b.id)] = Object.assign({ s: sk, g: gk }, rel.length ? { r: rel.sort() } : {}, uns.length ? { u: uns.sort() } : {});
    }
  }
  const ids = Object.keys(games).sort((a, b) => { const x = want.get(a), y = want.get(b); return x.start < y.start ? -1 : x.start > y.start ? 1 : a < b ? -1 : 1; });
  return { from, days: BOX_DAYS, games: Object.fromEntries(ids.map(id => [id, games[id]])) };
}

/* ---------- the season, from ESPN ---------- */
async function pullSeason(prev) {
  fs.mkdirSync(OUT, { recursive: true });
  const teams = JSON.parse(fs.readFileSync(TEAMS, 'utf8'));
  const games = new Map();
  const complete = new Set();
  const prevByDate = {};
  if (prev && prev.season === SEASON) {
    for (const g of prev.games) { (prevByDate[g.date] = prevByDate[g.date] || []).push(g); games.set(g.id, g); }
    for (const [d, rs] of Object.entries(prevByDate)) if (d < TODAY && rs.every(r => r.state === 'final')) complete.add(d);
  }
  const days = [];
  /* every day of the season, so the whole schedule is known and the playoff picture is the rest
     of the season and not the next fortnight; a day already complete is not asked for again. Both
     passes read every day, so the lineups players.js builds between them stand on the same schedule
     the calls are made on (a game postponed tomorrow is not a back to back's first night) */
  for (let d = `${SEASON - 1}-10-01`; d <= `${SEASON}-06-30`; d = addDays(d, 1)) if (!complete.has(d)) days.push(d);
  /* the days that must be read fresh: any through tomorrow on which the last state has a game not final */
  const needed = new Set();
  if (prev && prev.season === SEASON) for (const g of prev.games) if (g.state !== 'final' && g.date <= addDays(TODAY, 1)) needed.add(g.date);
  const fresh = new Set(), rowsOf = new Map(), gone = new Map(), blank = [];
  let asked = 0, ok = 0;
  for (let i = 0; i < days.length; i += 4) {
    const batch = await Promise.all(days.slice(i, i + 4).map(async d => {
      const file = path.join(OUT, `sb_${d}.json`);
      if (ARGS.has('--offline')) { if (!fs.existsSync(file)) return [d, null]; fresh.add(d); return [d, JSON.parse(fs.readFileSync(file, 'utf8'))]; }
      asked++;
      try { const j = await E.scoreboard(d); fs.writeFileSync(file, JSON.stringify(j)); ok++; fresh.add(d); return [d, j]; }
      catch (e) {
        const saved = fs.existsSync(file) && !needed.has(d);              // a saved copy stands in only for a day that need not be fresh
        log(`${d}: ${e.message}${saved ? ' (using the saved copy)' : ''}`); return [d, saved ? JSON.parse(fs.readFileSync(file, 'utf8')) : null];
      }
    }));
    for (const [d, j] of batch) {
      if (!j) continue;
      E.teamsOf(j, teams.teams);
      const here = [];
      for (const ev of j.events || []) {
        const g = E.gameRow(ev); if (!g) continue;
        if (g.gone) { gone.set(g.id, g); continue; }
        if (g.season === SEASON && g.type !== 1 && g.date === d) { if (g.type !== 2) g.type = 3; here.push(g); }
      }
      /* an answer with no game on a day the last state has games on, none of them called off, is no
         answer: that day is not fresh (a needed one stops the run below), and its games stay */
      if (!here.length && (prevByDate[d] || []).some(g => !gone.has(g.id))) { fresh.delete(d); blank.push(d); log(`${d}: the scoreboard answered with no game, where the last state has ${prevByDate[d].length}: taken as no answer`); continue; }
      for (const g of here) rowsOf.set(g.id, g);
    }
    if (!ARGS.has('--offline')) await new Promise(r => setTimeout(r, 200));
  }
  if (asked && !ok) throw new Error('ESPN scoreboard unreachable: every day asked for failed');
  /* a blank day all of whose games the answer has on another day (the same id) or called off did answer: they moved */
  for (const d of blank.slice()) if (prevByDate[d].every(g => rowsOf.has(g.id) || gone.has(g.id))) { fresh.add(d); blank.splice(blank.indexOf(d), 1); log(`${d}: its games are on another day now; the blank answer stands`); }
  const unanswered = [...needed].filter(d => days.includes(d) && !fresh.has(d)).sort();
  if (unanswered.length) throw new Error(`ESPN's scoreboard did not answer for ${unanswered.join(', ')}, which still have games to finish or to call; nothing written, the last state stays live`);
  /* the feed's rows, each on the day it is on now (a game moved to another day leaves its old one) */
  for (const [id, g] of rowsOf) games.set(id, g);
  /* a game comes off the schedule only on the feed's word: postponed or cancelled, and not on another day now */
  const removed = [];
  for (const [id, x] of gone) if (!rowsOf.has(id) && games.has(id)) { const p = games.get(id); games.delete(id); removed.push({ id, date: p.date, home: p.home, away: p.away, why: x.gone }); log(`${p.away}@${p.home} ${p.date}: ${x.gone} in the feed, taken off the schedule`); }
  /* a game the last state has on a day the feed answered for, left out of that answer and neither
     called off nor on another day: a partial answer never takes a game, its call, its line or its
     grade. It is kept as the last state had it, and said; one still not final two days after its
     puck drop that the feed has never shown again was not played, and goes, said the same way */
  const kept = [];
  for (const [id, g] of [...games]) {
    if (!fresh.has(g.date) || rowsOf.has(id)) continue;
    if (g.state !== 'final' && g.start && Date.parse(NOW) - Date.parse(g.start) > 48 * 3600000) { games.delete(id); removed.push({ id, date: g.date, home: g.home, away: g.away, why: 'missing from the feed' }); log(`${g.away}@${g.home} ${g.date}: missing from the feed since its day and never final, taken off the schedule`); }
    else kept.push(g);
  }
  if (kept.length) log(`${kept.length} game(s) the feed's answer left out, kept as the last state had them: ${kept.map(g => `${g.away}@${g.home} ${g.date} (${g.state})`).join(', ')}`);
  log(`${days.length} days read (${complete.size} already complete), ${asked} asked, ${ok} answered${blank.length ? `, ${blank.length} blank` : ''}`);
  fs.writeFileSync(TEAMS, JSON.stringify(teams));
  return { games: [...games.values()].sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0), teams, removed, kept: kept.map(g => g.id) };
}

/* the finished seasons; at a new season's first run the old one is closed into season_<year>.json
   from the last state first, and a season missing from both is a refusal, not a silent gap */
function loadHistory(prev) {
  let have = new Set(Hist.seasons(DATA));
  if (!have.has(SEASON - 1) && prev && prev.season === SEASON - 1 && (prev.games || []).some(g => g.state === 'final')) {
    const w = Hist.writeSeason(DATA, SEASON - 1, prev.games || []);
    log(`closed the ${SEASON - 2}-${String(SEASON - 1).slice(2)} season: ${w.games} finals into ${path.relative(ROOT, w.file)}`);
    have = new Set(Hist.seasons(DATA));
  }
  if (!have.has(SEASON - 1)) throw new Error(`the ${SEASON - 2}-${String(SEASON - 1).slice(2)} season is in neither data/history.json, a season_${SEASON - 1}.json nor the last state; run node tools/history.js ${SEASON - 1} ${SEASON - 1}`);
  return Hist.rows(DATA).filter(g => g.season < SEASON);
}

/* ---------- scoring rates: each club's goals for and against this season, shrunk to the league ---------- */
class Rates {
  constructor(leagueTotal) { this.half = leagueTotal / 2; this.gf = {}; this.ga = {}; this.n = {}; }
  rate(id, which) { const n = this.n[id] || 0; const own = n ? (which === 'gf' ? this.gf[id] : this.ga[id]) / n : this.half; return (own * n + this.half * SHRINK) / (n + SHRINK); }
  /* the expected total of a game: each side's scoring against the other's conceding */
  total(home, away) { return (this.rate(home, 'gf') + this.rate(away, 'ga')) / 2 + (this.rate(away, 'gf') + this.rate(home, 'ga')) / 2; }
  add(g) { for (const [id, f, a] of [[g.home, g.hs, g.as], [g.away, g.as, g.hs]]) { this.gf[id] = (this.gf[id] || 0) + f; this.ga[id] = (this.ga[id] || 0) + a; this.n[id] = (this.n[id] || 0) + 1; } }
}

/* ---------- standings ---------- */
function standingsOf(games) {
  const S = {};
  for (const id of E.TEAMS) S[id] = { w: 0, l: 0, otl: 0, pts: 0, rw: 0, row: 0, gf: 0, ga: 0, gp: 0 };
  for (const g of games) {
    if (g.state !== 'final' || g.type !== 2 || g.hs === null) continue;
    const hw = g.hs > g.as, past = g.periods > 3;
    const W = S[hw ? g.home : g.away], L = S[hw ? g.away : g.home];
    W.w++; W.pts += 2; if (!past) W.rw++; if (g.periods !== 5) W.row++;
    if (past) { L.otl++; L.pts++; } else L.l++;
    S[g.home].gf += g.hs; S[g.home].ga += g.as; S[g.away].gf += g.as; S[g.away].ga += g.hs; S[g.home].gp++; S[g.away].gp++;
  }
  return S;
}
const order = (ids, S, ratings) => ids.slice().sort((a, b) => S[b].pts - S[a].pts || S[b].rw - S[a].rw || S[b].row - S[a].row || (S[b].gf - S[b].ga) - (S[a].gf - S[a].ga) || ratings[b] - ratings[a]);

/* the sixteen: the top three of each division and two wild cards a conference, seeded the league's way */
function fieldOf(S, ratings) {
  const out = {};
  for (const conf of ['East', 'West']) {
    const divs = [...new Set(E.TEAMS.filter(t => E.CLUBS[t].conf === conf).map(t => E.CLUBS[t].div))];
    const top = {}, rest = [];
    for (const d of divs) { const o = order(E.TEAMS.filter(t => E.CLUBS[t].div === d), S, ratings); top[d] = o.slice(0, 3); rest.push(...o.slice(3)); }
    const wc = order(rest, S, ratings).slice(0, 2);
    const [d1, d2] = divs.slice().sort((a, b) => order([top[a][0], top[b][0]], S, ratings)[0] === top[a][0] ? -1 : 1);
    out[conf] = { divs: { [d1]: top[d1], [d2]: top[d2] }, wild: wc,
      /* four series: the stronger division winner takes the second wild card */
      series: [[top[d1][0], wc[1]], [top[d1][1], top[d1][2]], [top[d2][0], wc[0]], [top[d2][1], top[d2][2]]] };
  }
  return out;
}

/* ---------- the playoffs as they stand: every series ESPN has a final in ---------- */
/* a series is a pair of clubs' playoff finals; its round is one more than the series either club
   played before it (a pair meets once a spring), its winner the club with four */
function seriesOf(games) {
  const fin = games.filter(g => g.type === 3 && g.state === 'final' && g.hs !== null).sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0);
  const map = new Map();
  for (const g of fin) {
    const [a, b] = [g.home, g.away].sort(); const k = a + '|' + b;
    let s = map.get(k); if (!s) map.set(k, s = { a, b, wins: { [a]: 0, [b]: 0 }, first: g.date, last: g.date, games: 0 });
    s.wins[g.hs > g.as ? g.home : g.away]++; s.games++; s.last = g.date;
  }
  const list = [...map.values()].sort((x, y) => x.first < y.first ? -1 : x.first > y.first ? 1 : 0);
  const played = {};
  for (const s of list) {
    s.round = 1 + Math.max(played[s.a] || 0, played[s.b] || 0); played[s.a] = played[s.b] = s.round;
    s.winner = s.wins[s.a] >= 4 ? s.a : s.wins[s.b] >= 4 ? s.b : null;
    s.conf = E.CLUBS[s.a].conf === E.CLUBS[s.b].conf ? E.CLUBS[s.a].conf : 'Final';
  }
  return list;
}
/* the computed first round, put right by the series ESPN actually has (the league's tie-breakers
   beyond goal difference are not modelled, so a wild card can land the other way round). The field is
   then the sixteen clubs of that first round: the division seeds and the wild cards are read back off its
   slots, so a club the table left out that the real bracket has is in, and the club it displaced is out */
function fixBracket(F, observed) {
  for (const conf of ['East', 'West']) {
    const field = [].concat(...F[conf].series), real = observed.filter(s => s.round === 1 && s.conf === conf), placed = new Set();
    const take = (t, first) => { const s = real.find(x => !placed.has(x) && (x.a === t || x.b === t)); if (!s) return null; placed.add(s); const o = s.a === t ? s.b : s.a; return first ? [t, o, true] : [o, t, true]; };
    /* each real series to the slot of the club the table put first in it (the higher seed), else of its other club, else a slot left */
    const fixed = F[conf].series.map(([a]) => take(a, true));
    F[conf].series.forEach(([, b], i) => { if (!fixed[i]) fixed[i] = take(b, false); });
    for (const s of real.filter(x => !placed.has(x))) { const i = fixed.indexOf(null); if (i >= 0) { placed.add(s); fixed[i] = [s.a, s.b, true]; } }
    F[conf].series.forEach(([a, b], i) => { if (!fixed[i]) fixed[i] = [a, b, false]; });
    /* a series not started yet keeps its slot, less a club a started one has taken, which goes to whoever that left out */
    const seen = new Set(fixed.filter(s => s[2]).flatMap(s => [s[0], s[1]]));
    const spare = field.filter(t => !seen.has(t) && !fixed.some(s => !s[2] && (s[0] === t || s[1] === t)));
    const series = fixed.map(([a, b, isReal]) => isReal ? [a, b] : [a, b].map(t => seen.has(t) && spare.length ? spare.shift() : t));
    const [d1, d2] = Object.keys(F[conf].divs);
    F[conf] = { divs: { [d1]: [series[0][0], series[1][0], series[1][1]], [d2]: [series[2][0], series[3][0], series[3][1]] }, wild: [series[2][1], series[0][1]], series };
  }
  return F;
}

/* ---------- the playoff picture: the rest of the season played SIMS times ---------- */
function playoffPicture(games, ratings, model, rates) {
  let seed = 20261007; const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
  const remaining = games.filter(g => g.type === 2 && g.state !== 'final').map(g => {
    const diff = ratings[g.home] - ratings[g.away] + (g.neutral ? 0 : model.params.hfa);
    const G = goals(rates.total(g.home, g.away), spreadOf(diff, model), diff, model.pull);
    return { home: g.home, away: g.away, pHome: expected(diff), tie: G.tie, pOT: G.pOT };
  });
  const base = standingsOf(games);
  const observed = seriesOf(games);
  const regDone = !remaining.length && games.some(g => g.type === 2 && g.state === 'final');
  const cupSeries = observed.find(s => s.round === 4 && s.winner);
  const phase = !games.length ? 'offseason' : cupSeries ? 'over' : regDone || observed.length ? 'postseason' : games.some(g => g.state === 'final') ? 'regular' : 'preseason';
  /* once the regular season is over the field is the real one, put right by the real series */
  const actual = regDone || observed.length ? fixBracket(fieldOf(base, ratings), observed) : null;
  const obsByPair = new Map(observed.map(s => [s.a + '|' + s.b, s]));
  const tally = {}; for (const id of E.TEAMS) tally[id] = { playoff: 0, div: 0, conf: 0, cup: 0, pts: 0 };
  const series = (a, b, hfa) => {                      // best of seven, 2-2-1-1-1, a has home ice; played on from the real score
    const o = obsByPair.get([a, b].sort().join('|'));
    let wa = o ? o.wins[a] : 0, wb = o ? o.wins[b] : 0, g = wa + wb;
    while (wa < 4 && wb < 4) { const aHome = [0, 1, 4, 6].includes(g); const d = ratings[a] - ratings[b] + (aHome ? hfa : -hfa); if (rnd() < expected(d)) wa++; else wb++; g++; }
    return wa >= 4 ? a : b;
  };
  for (let i = 0; i < SIMS; i++) {
    const S = {}; for (const id of E.TEAMS) S[id] = Object.assign({}, base[id]);
    for (const g of remaining) {
      const r = rnd();
      if (r < g.tie) { const hw = rnd() < g.pOT; const W = S[hw ? g.home : g.away], L = S[hw ? g.away : g.home]; W.w++; W.pts += 2; if (rnd() < 0.55) W.row++; L.otl++; L.pts++; }
      else { const hw = rnd() < g.pHome; const W = S[hw ? g.home : g.away], L = S[hw ? g.away : g.home]; W.w++; W.pts += 2; W.rw++; W.row++; L.l++; }
    }
    const F = actual || fieldOf(S, ratings);
    const finalists = [];
    for (const conf of ['East', 'West']) {
      const f = F[conf];
      for (const d of Object.keys(f.divs)) tally[f.divs[d][0]].div++;
      for (const t of [].concat(...f.series)) tally[t].playoff++;                // the field is the first round's sixteen
      const seedOf = t => S[t].pts + S[t].rw / 100;
      const r1 = f.series.map(([a, b]) => series(a, b, model.params.hfa));
      const r2 = [[r1[0], r1[1]], [r1[2], r1[3]]].map(([a, b]) => seedOf(a) >= seedOf(b) ? series(a, b, model.params.hfa) : series(b, a, model.params.hfa));
      const cf = seedOf(r2[0]) >= seedOf(r2[1]) ? series(r2[0], r2[1], model.params.hfa) : series(r2[1], r2[0], model.params.hfa);
      tally[cf].conf++; finalists.push(cf);
    }
    const [e, w] = finalists; const seedOf = t => S[t].pts + S[t].rw / 100;
    tally[seedOf(e) >= seedOf(w) ? series(e, w, model.params.hfa) : series(w, e, model.params.hfa)].cup++;
    for (const id of E.TEAMS) tally[id].pts += S[id].pts;
  }
  const odds = {};
  for (const id of E.TEAMS) { const t = tally[id]; odds[id] = { playoff: r3(t.playoff / SIMS), div: r3(t.div / SIMS), conf: r3(t.conf / SIMS), cup: r3(t.cup / SIMS), expPts: +(t.pts / SIMS).toFixed(1) }; }
  /* if the season ended today; the real bracket once it has */
  const now = actual || fieldOf(base, ratings);
  const standings = {};
  for (const div of ['Atlantic', 'Metropolitan', 'Central', 'Pacific']) standings[div] = order(E.TEAMS.filter(t => E.CLUBS[t].div === div), base, ratings).map(t => Object.assign({ team: t }, base[t]));
  const out = { sims: SIMS, odds, standings, bracket: now, remaining: remaining.length, phase,
    series: observed.map(s => ({ a: s.a, b: s.b, wins: s.wins, round: s.round, conf: s.conf, winner: s.winner, first: s.first, last: s.last })) };
  if (cupSeries) out.champion = cupSeries.winner;
  return out;
}

/* ---------- the run ---------- */
async function main() {
  const prev = fs.existsSync(STATE) ? JSON.parse(fs.readFileSync(STATE, 'utf8')) : null;
  const prevGames = new Map(((prev && prev.season === SEASON && prev.games) || []).map(g => [g.id, g]));
  const model = JSON.parse(fs.readFileSync(path.join(DATA, 'model.json'), 'utf8'));
  /* the player model's numbers on the games to come, when players.js has run; `use` says whose call the page carries */
  const PM = fs.existsSync(path.join(DATA, 'players.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'players.json'), 'utf8')) : null;
  const usePM = !!(PM && PM.report && PM.report.use);
  const { games, teams: T, removed, kept } = await pullSeason(prev);
  log(`${games.length} games this season, ${games.filter(g => g.state === 'final').length} final`);
  /* the games taken off the schedule since the last published state: this run's, and the first pass's when this is the second */
  const prevPass = prev && prev.season === SEASON && prev.pass === 'scores';
  const removedNow = (prevPass ? (prev.removed || []).filter(r => !games.some(g => g.id === r.id)) : []).concat(removed);

  /* replay: the history, then this season's finals, keeping each one's pre-game view and the scoring rates before it */
  const m = new Elo(model.params);
  for (const g of loadHistory(prev)) { m.newSeason(g.season); m.play(g); }
  m.newSeason(SEASON);
  const rates = new Rates(model.leagueTotal);
  const replayed = {};
  for (const g of games) if (g.state === 'final' && g.hs !== null) { replayed[g.id] = Object.assign(m.play(g), { xt: rates.total(g.home, g.away) }); rates.add(g); }
  const ratings = m.r;
  for (const id of E.TEAMS) m.rating(id);

  /* the club table: names and logos from the feed, the fixed conference and division, this season's line, the rating and its rank */
  const S = standingsOf(games);
  const teams = {};
  for (const id of E.TEAMS) {
    const t = T.teams[id] || {};
    teams[id] = Object.assign({ abbr: id, name: E.CLUBS[id].name, short: E.CLUBS[id].name.split(' ').pop(), logo: null, color: null }, t, { conf: E.CLUBS[id].conf, div: E.CLUBS[id].div, rating: +ratings[id].toFixed(1) }, S[id],
      { gfRate: +rates.rate(id, 'gf').toFixed(2), gaRate: +rates.rate(id, 'ga').toFixed(2) });
  }
  E.TEAMS.slice().sort((a, b) => teams[b].rating - teams[a].rating).forEach((id, i) => { teams[id].rank = i + 1; });

  /* every game's call and lines: made while it is still to come, frozen at puck drop, kept after.
     Started: under way or over in the feed, or its puck drop passed by the clock, or (a delay) the puck
     drop its call was made before has passed and the feed has moved the start less than half a day
     later; a game moved to another day is a game to come again */
  const now = NOW;
  const DELAY = 12 * 3600000;
  const started = (g, p) => g.state !== 'pre' || (!!g.start && Date.parse(g.start) <= Date.parse(NOW))
    || !!(p && p.frozen && p.before && Date.parse(p.before) <= Date.parse(NOW) && g.start && Date.parse(g.start) - Date.parse(p.before) < DELAY);
  /* the call from a view and a line: the chance, margin, total, overtime chance and each side taken */
  const callOf = (view, line) => {
    const mu = view.pmMu !== undefined && view.pmMu !== null ? view.pmMu : spreadOf(view.diff, model);
    const G = goals(view.xt, mu, view.diff, model.pull);
    const c = { pHome: +view.pHome.toFixed(4), rh: +view.rh.toFixed(1), ra: +view.ra.toFixed(1), diff: +view.diff.toFixed(2), mu: +mu.toFixed(2), xt: +view.xt.toFixed(2), tie: r3(G.tie), frozen: view.frozen };
    if (view.pm) c.pm = view.pm;
    if (view.elo && view.pmMu !== undefined && view.pmMu !== null) c.elo = { pHome: +view.elo.pHome.toFixed(4), xt: +view.elo.xt.toFixed(2) };
    if (view.pmMu !== undefined && view.pmMu !== null) c.by = 'players';
    c.line = line;
    c.pick = view.pHome >= 0.5 ? 'home' : 'away';
    if (line) {
      /* the moneyline: a side whose chance beats the book's implied by the edge */
      const ih = implied(line.homeML), ia = implied(line.awayML);
      if (ih !== null && ia !== null) { c.mlEdge = { home: r3(view.pHome - ih), away: r3(1 - view.pHome - ia) }; c.mlPick = c.mlEdge.home >= EDGE ? 'home' : c.mlEdge.away >= EDGE ? 'away' : null; }
      if (line.homeLine !== null && line.homeLine !== undefined) {
        const cp = coverProbs(G, line.homeLine);
        c.cover = { home: r3(cp.cover), push: r3(cp.push), away: r3(cp.lose) };
        const jh = implied(line.homeSpreadOdds), ja = implied(line.awaySpreadOdds);
        if (jh !== null && ja !== null) { c.plEdge = { home: r3(cp.cover - jh), away: r3(cp.lose - ja) }; c.plPick = c.plEdge.home >= EDGE ? 'home' : c.plEdge.away >= EDGE ? 'away' : null; }
      }
      if (line.total !== null && line.total !== undefined) {
        const tp = totalProbs(G, line.total);
        c.ou = { over: r3(tp.over), push: r3(tp.push), under: r3(tp.under) };
        const jo = implied(line.overOdds), ju = implied(line.underOdds);
        if (jo !== null && ju !== null) { c.ouEdge = { over: r3(tp.over - jo), under: r3(tp.under - ju) }; c.ouPick = c.ouEdge.over >= EDGE ? 'over' : c.ouEdge.under >= EDGE ? 'under' : null; }
      }
    }
    if (view.frozen) { c.callV = CALL_V; if (view.before) c.before = view.before; }      // `before`: the puck drop the call was made ahead of, should ESPN move it later
    return c;
  };
  /* the call shown before puck drop, from the last state: verbatim when this job wrote it (or it was
     still to come there), else rebuilt from what an older job kept after puck drop: the chance, the
     total, the player model's view and the line were kept, the margin and the sides recomputed on the
     team Elo's margin, so the player model's margin is put back and the sides recomputed from it */
  const shown = p => p.state === 'pre' || !!p.callV;               // the row's call is the one the page showed before puck drop
  const verbatim = p => { const c = {}; for (const k of CALL) if (p[k] !== undefined) c[k] = p[k]; if (shown(p)) c.callV = CALL_V; return c; };
  const keptCall = (p, rp) => {
    if (shown(p)) return verbatim(p);
    /* the team Elo's view beside the player model's, as the row had it before puck drop: the replay's
       pre-game view for a final, the ratings as they stand (the game not yet rated) while it is live */
    const byPlayers = !!(p.pm && p.pm.pHome === p.pHome && p.pm.xt === p.xt);
    const view = { pHome: p.pHome, diff: p.diff, rh: p.rh, ra: p.ra, xt: p.xt, frozen: p.frozen, pm: p.pm };
    if (byPlayers) { view.pmMu = p.pm.mu; view.elo = rp ? { pHome: rp.pHome, xt: rp.xt } : { pHome: m.predict(p).pHome, xt: rates.total(p.home, p.away) }; }
    rebuilt++;
    return callOf(view, p.line || null);
  };
  let rebuilt = 0;
  /* a line read this run, dated by it. DraftKings' ids (line.dk) are this answer's own whenever it gave
     an outcome id; an answer with none (no usable link at all: ESPN's DraftKings prices have come through
     as "Draft Kings", and that shape may carry none; or links naming the event and no outcome) keeps the
     last state's outcome ids for the same numbers: the moneylines, the puck lines only on the same puck
     line, the totals only on the same total, beside the event (this answer's, else the last one's; none
     are carried onto another event), dated by when they were read (dk.at, only ever on carried ids). An
     answer with some outcome id never carries. Another book's prices carry none. The rule is E.carryDk
     (tools/espn.js), shared with the page's Refresh odds */
  const lineCount = { games: 0, read: 0, carried: 0, event: 0, full: 0, books: {} };
  /* a line with an id for every price it has (each side of the moneyline, the puck line and the total that ESPN priced):
     counted in the log, so a market whose ids stop coming shows there as fewer games with all of them */
  const PRICE = { homeML: 'homeML', awayML: 'awayML', homePL: 'homeSpreadOdds', awayPL: 'awaySpreadOdds', over: 'overOdds', under: 'underOdds' };
  const fullIds = line => !!line.dk && Object.entries(PRICE).every(([k, f]) => line[f] === null || line[f] === undefined || typeof line.dk[k] === 'string');
  const freshLine = (odds, p) => {
    lineCount.games++; lineCount.books[odds.book || 'no book'] = (lineCount.books[odds.book || 'no book'] || 0) + 1;
    const { line, how } = E.carryDk(Object.assign({}, odds, { at: now }), p && p.line);      // the rule itself is in espn.js, which the page's Refresh odds shares
    if (how === 'read') lineCount.read++; else if (how === 'carried') lineCount.carried++; else if (how === 'event') lineCount.event++;
    if ((how === 'read' || how === 'carried') && fullIds(line)) lineCount.full++;
    return line;
  };
  const out = [];
  /* --scores, the job's first pass, makes no call: every row keeps the last state's call as it was
     (a game still to come included), and only its score, state and schedule are new. players.js lines
     up on that state, and the second pass makes the calls, so a game whose puck drop falls between the
     two passes is graded on the call the page showed, never on one the first pass made and nobody saw */
  const SCORES = ARGS.has('--scores');
  for (const g of games) {
    const p = prevGames.get(g.id);
    const row = { id: g.id, type: g.type, date: g.date, start: g.start, state: g.state, detail: g.detail, home: g.home, away: g.away, hs: g.hs, as: g.as, periods: g.periods,
      neutral: g.neutral, note: g.note, hrec: g.hrec, arec: g.arec };
    /* a score under way that a partial answer left out is the one read before: said with when it was read */
    if (g.state === 'live' && kept.includes(g.id)) row.scoreAt = (p && p.scoreAt) || (prev && prev.published) || null;
    let call;
    if (SCORES) call = p ? verbatim(p) : {};
    else if (started(g, p) && p && p.frozen) call = keptCall(p, replayed[g.id]);
    else if (!started(g, p)) {
      const v = m.predict(g); const view = { pHome: v.pHome, diff: v.diff, rh: v.rh, ra: v.ra, xt: rates.total(g.home, g.away), frozen: now, elo: { pHome: v.pHome, xt: rates.total(g.home, g.away) } };
      /* the player model's view, frozen with the rest; the call is its when it has earned it */
      const u = PM && PM.upcoming && PM.upcoming[g.id];
      if (u) { view.pm = { pHome: u.pHome, mu: u.mu, xt: u.total, home: u.home, away: u.away, inj: u.inj || null }; if (usePM) { view.pHome = u.pHome; view.xt = u.total; view.pmMu = u.mu; } }
      /* the lines: taken while the game is still to come */
      view.before = g.start;
      call = callOf(view, g.odds ? freshLine(g.odds, p) : (p && p.line) || null);
    }
    /* started with no call made before it: the replay's view for a final, the current one while live; no line, no side */
    else if (replayed[g.id]) { const v = replayed[g.id]; call = callOf({ pHome: v.pHome, diff: v.diff, rh: v.rh, ra: v.ra, xt: v.xt, frozen: null }, null); }
    else { const v = m.predict(g); call = callOf({ pHome: v.pHome, diff: v.diff, rh: v.rh, ra: v.ra, xt: rates.total(g.home, g.away), frozen: null }, null); }
    Object.assign(row, call);
    const line = row.line;
    if (g.state === 'final' && g.hs !== null) {
      const margin = g.hs - g.as, total = g.hs + g.as;
      const res = { su: (margin > 0) === (row.pick === 'home') };
      if (row.mlPick) res.ml = (margin > 0) === (row.mlPick === 'home') ? 'win' : 'loss';
      if (line && line.homeLine !== null && line.homeLine !== undefined) {
        const covered = margin + line.homeLine;
        res.homeCover = covered > 0 ? 'win' : covered < 0 ? 'loss' : 'push';
        if (row.plPick) res.pl = res.homeCover === 'push' ? 'push' : ((res.homeCover === 'win') === (row.plPick === 'home') ? 'win' : 'loss');
      }
      if (line && line.total !== null && line.total !== undefined) {
        res.over = total > line.total ? 'win' : total < line.total ? 'loss' : 'push';
        if (row.ouPick) res.ou = res.over === 'push' ? 'push' : ((res.over === 'win') === (row.ouPick === 'over') ? 'win' : 'loss');
      }
      row.result = res;
    }
    out.push(row);
  }
  if (rebuilt) log(`${rebuilt} calls an older job recomputed after puck drop put back to the call shown before it`);
  if (!SCORES) log(`lines: ${lineCount.games} game${lineCount.games === 1 ? '' : 's'} to come priced this run (${Object.entries(lineCount.books).map(([b, n]) => `"${b}" ${n}`).join(', ') || 'no book'}); DraftKings ids on ${lineCount.read + lineCount.carried} of them (${lineCount.read} read, ${lineCount.carried} carried from the last state; ${lineCount.full} with an id for every price${lineCount.event ? `; ${lineCount.event} more with DraftKings' event and no outcome id` : ''})`);

  /* the record: straight up on every game, and on the moneyline, the puck line and the total where a side was taken */
  const fresh = () => ({ su: { w: 0, l: 0 }, ml: { w: 0, l: 0 }, pl: { w: 0, l: 0, p: 0 }, ou: { w: 0, l: 0, p: 0 } });
  const record = Object.assign(fresh(), { byMonth: {}, bands: {} });
  const bandOf = p => { const c = Math.max(p, 1 - p); return c >= 0.7 ? '70+' : c >= 0.6 ? '60-70' : '50-60'; };
  for (const r of out) {
    if (!r.result) continue;
    const mo = r.type === 3 ? 'playoffs' : r.date.slice(0, 7);
    const bm = record.byMonth[mo] = record.byMonth[mo] || fresh();
    const bd = record.bands[bandOf(r.pHome)] = record.bands[bandOf(r.pHome)] || fresh();
    const bump = t => {
      r.result.su ? t.su.w++ : t.su.l++;
      for (const k of ['ml', 'pl', 'ou']) { const v = r.result[k]; if (v === 'win') t[k].w++; else if (v === 'loss') t[k].l++; else if (v === 'push') t[k].p++; }
    };
    bump(record); bump(bm); bump(bd);
  }

  const playoff = playoffPicture(games, ratings, model, rates);
  const top = E.TEAMS.slice().sort((a, b) => playoff.odds[b].cup - playoff.odds[a].cup).slice(0, 4).map(t => `${t} ${Math.round(playoff.odds[t].cup * 100)}%`).join(', ');
  log(`playoff picture: ${top} for the Cup; ${SIMS} sims over ${playoff.remaining} games left`);

  /* the player rankings, for the Players tab: every rated player, the club strengths, the report */
  const players = PM ? { asOf: PM.asOf, generated: PM.generated, use: usePM, report: PM.report, params: PM.params, players: PM.players, teams: PM.teams, injuries: PM.injuries || null, starters: PM.starters || null } : null;
  /* the props model (props.js, ON TRIAL: shown beside DraftKings' lines, never suggested): its projections for each game still to
     come by this run's clock, and the shadow ledger's running numbers. Copied as props.js wrote them; a game that has started
     since it ran is left out (its call is in the ledger, frozen) */
  const PR = fs.existsSync(path.join(DATA, 'props.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'props.json'), 'utf8')) : null;
  const toComeNow = r => r && r.state === 'pre' && Date.parse(r.start) > Date.parse(NOW) && !(r.before && Date.parse(r.before) <= Date.parse(NOW) && Date.parse(r.start) - Date.parse(r.before) < DELAY);
  const props = PR ? Object.assign({}, PR, { games: Object.fromEntries(Object.entries(PR.games || {}).filter(([id, g]) => toComeNow(out.find(x => x.id === id)) && Date.parse(g.start) > Date.parse(NOW))) }) : null;
  /* the Parlay Builder's same-game legs: the table of how legs of one game move together and the same-game hold, copied from
     data/corr.json (tools/corr.js wrote it from the finished seasons' box scores; tools/sgp.js is the rule the page copies), and
     what the page needs to grade a saved player leg: the box score of every final from BOX_DAYS days ago through today, each player who
     played (on the ice at all, as DraftKings and the props ledger count it) with the four counts DraftKings settles skaters on
     (goals, assists, shots on goal, blocked shots; points are goals plus assists), each side's starting goalie's saves (shots
     against less goals against), the goalies who came on in relief, whose saves prop is void, and apart the goalies of a side whose
     starter the box cannot tell, whose saves are graded nowhere (boxWindow). A column ESPN left
     out is null. The page writes a settled leg's grade into the visitor's saved leg, so a parlay graded while its final is
     carried stays graded after it leaves the window */
  const C = fs.existsSync(path.join(DATA, 'corr.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'corr.json'), 'utf8')) : null;
  const sgp = C && C.rho && C.hold ? { rho: C.rho, hold: C.hold, measured: C.measured || null } : null;
  const box = boxWindow(out);
  /* `removed`: the games taken off the schedule since the last published state, each with the feed's
     reason, so the smoke test can hold every started call of that state to this one; `kept`: games a
     partial answer left out, kept as they were; `pass`: only on the first pass's state, never published */
  /* published at the run's own clock, the one every call was made and frozen by, so a puck drop while the run reads
     the feed is not a call "made after puck drop" to the smoke test */
  const state = Object.assign({ published: new Date(Date.parse(NOW)).toISOString(), season: SEASON, today: TODAY, phase: playoff.phase, model, teams, games: out, record, playoff, edge: EDGE, players, props, sgp, box },
    removedNow.length ? { removed: removedNow } : {}, kept.length ? { kept } : {}, SCORES ? { pass: 'scores' } : {});
  const before = prev ? JSON.stringify(Object.assign({}, prev, { published: null, today: null })) : null;
  const after = JSON.stringify(Object.assign({}, state, { published: null, today: null }));
  if (before === after) { log('nothing changed; state.json left alone'); return; }
  fs.writeFileSync(STATE, JSON.stringify(state));
  const fin = out.filter(g => g.result).length;
  log(`wrote ${path.relative(ROOT, STATE)}: ${fin} graded (${record.su.w}-${record.su.l} straight up, ${record.pl.w}-${record.pl.l}-${record.pl.p} on the puck line, ${record.ou.w}-${record.ou.l}-${record.ou.p} on totals), ${out.length} games`);
}
main().catch(e => { console.error(e); process.exit(1); });
