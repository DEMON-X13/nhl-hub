/* The market's history: each finished game's closing line from ESPN's odds archive, pulled once
   (`node tools/lines.js`) for the Joker to be fitted on (tools/joker.js), as data/history.json is the
   results'. It is source: the job never writes it, and a pull again is a deliberate change, committed.

   ESPN's core API serves every past game's odds, one request a game, free:
   sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/events/<id>/competitions/<id>/odds.
   Each book is an item; a book's `close` block is its last price before the puck drop. Which books
   ESPN keeps differs by season: ESPN BET's closing line from 2022-23 to 2025-26, a dozen books in
   2023-24 (DraftKings among them, but its prices there carry no close block and read as in-game,
   both sides plus money), DraftKings alone (ESPN's provider 100, with a close block) once ESPN BET
   closed in the 2025-26 season, and 2021-22 no close block at all. So the line taken is ESPN BET's
   close, else DraftKings' (provider 100, then 40), and only a close: a top-level price can be a live one. A line is
   kept only where both moneylines are there and price a fair book (the two implied chances adding
   to 1.00 to 1.15, one favourite); otherwise the game has no line here and the Joker reads it so.
   2026-27 is not pulled: this season's lines are the hub's own, frozen with each call in state.json.

   Columns: id, book, homeML, awayML, total, overOdds, underOdds, homeLine, homeSpreadOdds,
   awaySpreadOdds (each null where ESPN gave none). */
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./espn');

const ROOT = path.join(__dirname, '..');
const DATA = process.env.NHL_DATA || path.join(ROOT, 'data');
const OUT = path.join(DATA, 'lines.json');
const SEASONS = [2023, 2024, 2025, 2026];          // 2022-23 to 2025-26, by the year a season ends
const BOOKS = [['58', 'ESPN BET'], ['100', 'DraftKings'], ['40', 'DraftKings']];
const COLS = ['id', 'book', 'homeML', 'awayML', 'total', 'overOdds', 'underOdds', 'homeLine', 'homeSpreadOdds', 'awaySpreadOdds'];
const URL = id => `https://sports.core.api.espn.com/v2/sports/hockey/leagues/nhl/events/${id}/competitions/${id}/odds?limit=50`;

const am = x => { if (!x) return null; const s = String(x.american !== undefined ? x.american : x.alternateDisplayValue || '').replace(/^\+/, ''); const v = Number(s); return s !== '' && isFinite(v) && v !== 0 ? v : null; };
const num = x => { if (!x) return null; const s = String(x.american !== undefined ? x.american : x.alternateDisplayValue || ''); const v = Number(s.replace(/^\+/, '')); return s !== '' && isFinite(v) ? v : null; };
const implied = o => o === null ? null : o < 0 ? -o / (100 - o) : 100 / (100 + o);

/* one game's line from ESPN's answer: the first book of BOOKS with a close block that prices a fair book */
function lineOf(id, body) {
  const items = (body && Array.isArray(body.items)) ? body.items : [];
  for (const [pid, name] of BOOKS) {
    const it = items.find(x => x && x.provider && String(x.provider.id) === pid);
    if (!it || !it.homeTeamOdds || !it.awayTeamOdds) continue;
    const hc = it.homeTeamOdds.close || {}, ac = it.awayTeamOdds.close || {}, tc = it.close || {};
    const homeML = am(hc.moneyLine), awayML = am(ac.moneyLine);
    if (homeML === null || awayML === null) continue;
    const s = implied(homeML) + implied(awayML);
    if (!(s >= 1.0 && s <= 1.15) || (homeML > 0 && awayML > 0)) continue;
    const homeLine = num(hc.pointSpread);
    return [id, name, homeML, awayML, num(tc.total), am(tc.over), am(tc.under), homeLine, homeLine === null ? null : am(hc.spread), homeLine === null ? null : am(ac.spread)];
  }
  return null;
}

async function main() {
  const H = JSON.parse(fs.readFileSync(path.join(DATA, 'history.json'), 'utf8'));
  const ix = Object.fromEntries(H.cols.map((c, i) => [c, i]));
  const games = H.rows.filter(r => SEASONS.includes(r[ix.season]));
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  const have = new Map(prev ? prev.rows.map(r => [r[0], r]) : []);
  const none = new Set(prev ? prev.none || [] : []);
  const todo = games.map(r => r[ix.id]).filter(id => !have.has(id) && !none.has(id));
  console.log(`lines: ${games.length} games in ${SEASONS.join(', ')}; ${have.size} held, ${none.size} with none, ${todo.length} to read`);
  let done = 0, failed = 0;
  const work = todo.slice();
  const one = async () => {
    for (let id = work.shift(); id; id = work.shift()) {
      try { const body = await E.getJSON(URL(id)); const row = lineOf(id, body); if (row) have.set(id, row); else none.add(id); }
      catch (e) { failed++; }
      if (++done % 250 === 0) console.log(`  ${done}/${todo.length} read, ${have.size} lines, ${none.size} none, ${failed} failed`);
    }
  };
  await Promise.all(Array.from({ length: 8 }, one));
  const order = new Map(games.map((r, i) => [r[ix.id], i]));
  const rows = [...have.values()].filter(r => order.has(r[0])).sort((a, b) => order.get(a[0]) - order.get(b[0]));
  const out = { cols: COLS, pulled: new Date().toISOString().slice(0, 10), books: BOOKS.map(b => b[1]), rows, none: [...none].filter(id => order.has(id)).sort((a, b) => order.get(a) - order.get(b)) };
  fs.writeFileSync(OUT, '{"cols":' + JSON.stringify(out.cols) + ',"pulled":' + JSON.stringify(out.pulled) + ',"books":' + JSON.stringify(out.books) + ',"rows":[\n' + rows.map(r => JSON.stringify(r)).join(',\n') + '\n],"none":' + JSON.stringify(out.none) + '}\n');
  const byBook = {}; for (const r of rows) byBook[r[1]] = (byBook[r[1]] || 0) + 1;
  console.log(`lines: wrote ${rows.length} lines (${Object.entries(byBook).map(([b, n]) => `${b} ${n}`).join(', ')}), ${out.none.length} games with none, ${failed} failed (read again next time)`);
  if (failed) process.exitCode = 1;
}
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { lineOf, COLS, BOOKS };
