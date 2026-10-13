/* The finished seasons, wherever they are kept: data/history.json (2011-12 on, pulled once by
   tools/history.js) and one data/season_<year>.json for each season the job itself closed at a
   rollover. update.js writes that file the first time it runs in a new season, from the last state
   of the old one, so a finished season is never dropped from the models; every reader (update.js,
   players.js, fetch_box.js) goes through rows() and sees both. Same columns in both files. */
'use strict';
const fs = require('fs'), path = require('path');

const COLS = ['id', 'season', 'type', 'date', 'home', 'away', 'hs', 'as', 'periods', 'neutral'];

/* every finished game of every finished season, in date order, one row each */
function rows(dataDir) {
  const files = ['history.json'].concat(fs.readdirSync(dataDir).filter(f => /^season_\d{4}\.json$/.test(f)).sort());
  const byId = new Map();
  for (const f of files) {
    const file = path.join(dataDir, f); if (!fs.existsSync(file)) continue;
    const H = JSON.parse(fs.readFileSync(file, 'utf8'));
    const col = Object.fromEntries(H.cols.map((c, i) => [c, i]));
    for (const r of H.rows) byId.set(String(r[col.id]), Object.fromEntries(COLS.map(c => [c, r[col[c]]])));
  }
  return [...byId.values()].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
}
const seasons = dataDir => [...new Set(rows(dataDir).map(r => r.season))].sort((a, b) => a - b);

/* close a season: its finals (regular season and playoffs) from the last state of it */
function writeSeason(dataDir, season, games) {
  const fin = games.filter(g => g.state === 'final' && g.hs !== null && g.hs !== undefined)
    .map(g => Object.assign({}, g, { season, type: g.type === 2 ? 2 : 3 }))
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const file = path.join(dataDir, `season_${season}.json`);
  fs.writeFileSync(file, JSON.stringify({ cols: COLS, pulled: new Date().toISOString().slice(0, 10), source: 'the job, from the last state of the season', rows: fin.map(g => COLS.map(c => g[c])) }));
  return { file, games: fin.length };
}

module.exports = { COLS, rows, seasons, writeSeason };
