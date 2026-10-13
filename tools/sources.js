/* The job's last step, after the commit: did a source the published state stands on break?

    node tools/sources.js        exit 1 when one did, after naming it

   The page always publishes on what there is and says so (an injury report carried from an earlier
   run, the model's own goalies when DailyFaceoff could not be read); this step makes the break seen
   too, by failing the run once the data is already live. It fails when, with a game in the next day
   and a half: the injury report in use is more than twelve hours older than the state, or there is
   none, or it has no rows (fetch_box.js never writes an empty one: the league always has someone
   hurt); ESPN's report rows mostly lack the id fetch_box.js reads from the player link (its shape
   moved; players.js is matching names alone); or DailyFaceoff answered on a game day and not one
   game could be read from it (its shape moved), or none it named matched a game on the schedule
   (its dates or club names are being misread). DailyFaceoff not answering at all is a warning only:
   it answers GitHub's runners and not every network, and the next run asks again.
   NHL_STATE and NHL_DATA move the files (simulate.js). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DATA = process.env.NHL_DATA || path.join(ROOT, 'data');
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const S = read(process.env.NHL_STATE || path.join(ROOT, 'state.json'));
const inj = read(path.join(DATA, 'injuries.json')), st = read(path.join(DATA, 'starters.json'));
const now = S ? Date.parse(S.published) : Date.now();
const soon = !!S && S.games.some(g => g.state === 'pre' && Date.parse(g.start) > now && Date.parse(g.start) - now < 36 * 3600000);
const problems = [], notes = [];
if (soon) {
  if (!inj || !inj.pulled) problems.push('there is no injury report: every lineup to come is who dressed last, nobody taken out');
  else if ((now - Date.parse(inj.pulled)) / 3600000 > 12) problems.push(`the injury report in use was pulled ${inj.pulled}, ${Math.round((now - Date.parse(inj.pulled)) / 3600000)} hours before this state: ESPN's report has not been read since (fetch_box.js's log says why)`);
  if (inj && inj.teams) {
    const rows = Object.values(inj.teams).reduce((a, l) => a.concat(l || []), []);
    const withId = rows.filter(r => r.id && /^\d+$/.test(String(r.id))).length;
    if (inj.pulled && !rows.length) problems.push('the injury report in use has no rows: ESPN answered with nobody hurt in the whole league, which is no report, and every lineup to come is who dressed last');
    if (rows.length && withId < rows.length / 2) problems.push(`only ${withId} of ${rows.length} injury report rows carry an ESPN id: the feed's player links have moved, and players.js is matching by name alone`);
  }
  if (st && st.ok === false && /answered/.test(st.why || '')) problems.push(`DailyFaceoff: ${st.why}; the goalies are the model's own choice until starters.js reads the new shape`);
  else if (st && st.ok === false) notes.push(`DailyFaceoff: ${st.why}`);
}
for (const n of notes) console.log('note: ' + n);
for (const p of problems) { console.log('BROKEN: ' + p); if (process.env.GITHUB_ACTIONS) console.log(`::error title=nhl source broken::${p}`); }
console.log(problems.length ? `${problems.length} source(s) broken; the state was published on what there is and the page says so` : 'every source the state stands on was read this run');
process.exit(problems.length ? 1 : 0);
