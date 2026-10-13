/* Pull past seasons' results from ESPN into data/history.json, once.

    node tools/history.js               2011-12 to last season
    node tools/history.js 2019 2026     a range of seasons, each named by the year it ends

   One scoreboard request per day, October to June (plus the summer of 2020, when the bubble
   playoffs ran into September), four days at a time. Scores, the period count (3 is
   regulation, 4 overtime, 5 a shootout) and the neutral-site flag: ESPN carries no odds
   for a finished game, so the model is fitted on results alone and the market comparison
   starts the day the job goes live. The file is committed; the job never re-pulls it. */
'use strict';
const fs = require('fs'), path = require('path');
const E = require('./espn');
const OUT = path.join(__dirname, '..', 'data', 'history.json');
const TEAMS = path.join(__dirname, '..', 'data', 'teams.json');

const from = +process.argv[2] || 2012, to = +process.argv[3] || (new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1);
const COLS = ['id', 'season', 'type', 'date', 'home', 'away', 'hs', 'as', 'periods', 'neutral'];
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const log = m => console.log(new Date().toISOString().slice(11, 19), m);

/* the days a season can have games on: October to June of the next year, the whole summer for
   the 2019-20 season (finished in September 2020) and from January for 2020-21 */
function daysOf(season) {
  const start = season === 2021 ? `${season}-01-01` : `${season - 1}-10-01`;
  const end = season === 2020 ? '2020-09-30' : `${season}-06-30`;
  const out = []; for (let d = start; d <= end; d = addDays(d, 1)) out.push(d);
  return out;
}

async function main() {
  const rows = new Map(fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).rows.map(r => [r[0], r]) : []);
  const teams = fs.existsSync(TEAMS) ? JSON.parse(fs.readFileSync(TEAMS, 'utf8')).teams || {} : {};
  for (let season = from; season <= to; season++) {
    let n = 0, fails = 0;
    const days = daysOf(season);
    for (let i = 0; i < days.length; i += 4) {
      const batch = await Promise.all(days.slice(i, i + 4).map(d => E.scoreboard(d).catch(e => { fails++; console.log(`  ${d}: ${e.message}`); return { events: [] }; })));
      for (const j of batch) {
        E.teamsOf(j, teams);
        for (const ev of j.events || []) {
          const g = E.gameRow(ev);
          if (!g || g.gone || g.state !== 'final' || g.hs === null || g.as === null || g.season !== season) continue;
          if (g.type === 1) continue;                      // preseason
          if (g.type !== 2) g.type = 3;
          if (!rows.has(g.id)) n++;
          rows.set(g.id, COLS.map(c => g[c]));
        }
      }
      await new Promise(r => setTimeout(r, 200));
    }
    log(`${season}: ${n} new games, ${fails} failed days`);
    fs.writeFileSync(OUT, JSON.stringify({ cols: COLS, pulled: new Date().toISOString().slice(0, 10), rows: [...rows.values()].sort((a, b) => a[3] < b[3] ? -1 : a[3] > b[3] ? 1 : 0) }));
  }
  fs.writeFileSync(TEAMS, JSON.stringify({ clubs: E.CLUBS, teams }, null, 0));
  log(`wrote ${rows.size} games to ${path.relative(process.cwd(), OUT)}; ${Object.keys(teams).length} teams`);
}
main().catch(e => { console.error(e); process.exit(1); });
