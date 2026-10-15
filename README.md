# X NHL Bets

A rating model's call on every NHL game: win chances, puck lines and totals against DraftKings'
numbers, frozen before puck drop and graded after, with the standings, the playoff picture, a
player and goalie model and a parlay builder that lives in the visitor's own browser.

Served by GitHub Pages from the repo root: https://demon-x13.github.io/nhl-hub/

- **The page** is `index.html`, one hand-written file. It fetches `state.json` on every load, and
  DraftKings' latest lines from ESPN's scoreboard only when Refresh odds is pressed (in memory: a
  reload is the published state again).
- **The data** comes from ESPN's public feeds (scoreboards with DraftKings' lines, box scores,
  the injury report) and DailyFaceoff's announced starting goalies. All free: no key, no credits.
- **The job**, `.github/workflows/update.yml`, runs five times a day (queued at 06:17, 12:17, 15:17,
  18:17 and 22:17 UTC; GitHub starts them hours late, so each is set for the window it must land
  in: the night's finals and the morning lines, before the 7pm and 10pm Eastern puck drops, and
  the night's finals again), and once on a push to `tools/`, the page or the workflow. It plays
  itself offline first (`tools/simulate.js`), reads the season, boxes the finals, lines up every
  game, rates, calls and grades, checks the result (`tools/smoke.js`) and commits `state.json` and
  `data/`.

It began as `nhl/` in `DEMON-X13/nfl-hub` and moved here on 2026-10-13.

`CLAUDE.md` is how to work on it; `docs/ARCHITECTURE.md` is the map.
