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
   DraftKings' ids: on the run's saved scoreboard answers (tools/out/sb_<date>.json, NHL_OUT) for the
   days with a game in that day and a half, each of the six outcomes is counted on its own (each side
   of the moneyline, the puck line and the total). An outcome ESPN gave links for on some game and
   whose links gave not one id in its side's shape on any game is broken (DraftKings or ESPN moved
   that market's shape): those legs then open no slip, so a lost market is seen even while the rest
   read; every link with no id the job reads is the old, wider break, and the card opens DraftKings'
   NHL page. A game whose DraftKings prices carried no link at all (ESPN has answered as "Draft
   Kings" on some runs), or links giving no outcome id, is a note, named, even beside games that
   carried theirs: the job keeps the last ids read for the same numbers.
   The props model's record (props.js): every final the run asked ESPN's prop feed for failed (a 404 is ESPN
   saying it has none, an answer), so the closing props and the ledger's grades wait; some failing is a note.
   DraftKings' player lines (props.js, every game projected): every read failed; some failing is a note.
   NHL_STATE, NHL_DATA and NHL_OUT move the files (simulate.js). */
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), DATA = process.env.NHL_DATA || path.join(ROOT, 'data');
const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };
const OUT = process.env.NHL_OUT || path.join(__dirname, 'out');
const E = require('./espn');
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
  /* DraftKings' ids on the answers this run saved for the days with a game in the next day and a half */
  const days = [...new Set(S.games.filter(g => g.state === 'pre' && Date.parse(g.start) > now && Date.parse(g.start) - now < 36 * 3600000).map(g => g.date))].sort();
  let priced = 0, links = 0, ids = 0, answers = 0, elsewhere = 0; const books = new Set(), others = new Set();
  const OUTS = E.DK_OUTCOMES, byKey = Object.fromEntries(OUTS.map(k => [k, { link: 0, shape: 0, id: 0 }])), bare = [], blind = [];
  for (const d of days) {
    const j = read(path.join(OUT, `sb_${d}.json`)); if (!j) continue; answers++;
    for (const ev of j.events || []) {
      const comp = ev && ev.competitions && ev.competitions[0], o = comp && Array.isArray(comp.odds) ? comp.odds[0] : null;
      const row = (() => { try { return E.gameRow(ev); } catch (e) { return null; } })();
      if (!o || !row || !row.odds) continue;
      /* another book's prices carry no DraftKings id by nature: named, never counted against DraftKings' */
      if (E.bookKey(row.odds.book) !== 'draftkings') { elsewhere++; others.add(String(row.odds.book || 'no book named')); continue; }
      priced++; books.add(String(row.odds.book));
      const r = E.dkOf(o, row.odds); links += r.links; ids += r.read;      // the outcomes' links and ids alone: an event is no bet
      for (const k of OUTS) { const x = r.keys[k] || {}; if (x.link) byKey[k].link++; if (x.shape) byKey[k].shape++; if (x.id) byKey[k].id++; }
      const name = `${row.away}@${row.home}`;
      if (!r.links) bare.push(name); else if (!r.read) blind.push(name);
    }
  }
  if (elsewhere) notes.push(`${elsewhere} games priced at ${[...others].join(', ')}, not DraftKings: no DraftKings ids for them, and the page names the book`);
  /* an outcome whose links, on every game that had one, gave no id in its side's shape */
  const lost = OUTS.filter(k => byKey[k].link && !byKey[k].shape);
  const MKT = { homeML: 'moneyline', awayML: 'moneyline', homePL: 'puck line', awayPL: 'puck line', over: 'total', under: 'total' };
  if (priced && links && !ids) problems.push(`ESPN's DraftKings prices carried ${links} outcome links on ${priced} games and not one gave an outcome id the job reads: DraftKings ids in a shape the job does not read; the card opens DraftKings' NHL page`);
  else if (lost.length) problems.push(`ESPN's DraftKings ${[...new Set(lost.map(k => MKT[k]))].join(' and ')} links (${lost.map(k => `${k} on ${byKey[k].link} game${byKey[k].link > 1 ? 's' : ''}`).join(', ')}) gave not one id in a shape the job reads: DraftKings ids in a shape the job does not read for ${lost.length > 1 ? 'those outcomes' : 'that outcome'}; those legs open no slip, and the card names them to add by hand`);
  if (priced && !links) notes.push(`ESPN's prices (${[...books].join(', ')}) carried no DraftKings links on ${priced} games this run: the job keeps the last ids read for the same numbers, and the card opens DraftKings' NHL page for a leg with none`);
  else if (priced) {
    if (bare.length) notes.push(`${bare.length} of the ${priced} games priced at DraftKings carried no DraftKings links this run (${bare.join(', ')}): the job keeps the last ids read for the same numbers`);
    if (blind.length) notes.push(`${blind.length} of the ${priced} games priced at DraftKings carried links that gave no outcome id the job reads (${blind.join(', ')})`);
    const short = OUTS.filter(k => byKey[k].shape && byKey[k].id < byKey[k].shape);
    if (short.length) notes.push(`ids on another number than the line, not kept: ${short.map(k => `${k} on ${byKey[k].shape - byKey[k].id}`).join(', ')}`);
    console.log(`DraftKings ids: ${ids} read from ${links} outcome links on ${priced} games (${[...books].join(', ')}); by outcome, games with a link / an id read: ${OUTS.map(k => `${k} ${byKey[k].link}/${byKey[k].id}`).join(', ')}`);
  }
  else if (days.length && !answers) notes.push(`no saved scoreboard answer for ${days.join(', ')} in ${path.relative(ROOT, OUT) || OUT}: DraftKings' ids not checked`);
}
/* the props model's record of DraftKings' closing props (props.js): every final this run asked ESPN's prop feed for failed
   (a 404, none posted, is an answer); the record and the ledger's grades wait, and the next run asks again */
const pr = read(path.join(DATA, 'props.json'));
if (pr && pr.record && pr.record.asked && !(pr.record.read + pr.record.none)) problems.push(`ESPN's DraftKings props: all ${pr.record.asked} finals asked for their closing props failed (${pr.record.why || 'no answer'}): the record and the props ledger's grades wait, and the next run asks again`);
else if (pr && pr.record && pr.record.failed) notes.push(`ESPN's DraftKings props: ${pr.record.failed} of ${pr.record.asked} finals asked for their closing props failed; asked again next run`);
/* DraftKings' player lines on the games to come (props.js, since nhl v16: the page draws them on load): every game projected failing
   to read is broken (the page shows the projections, and any earlier read kept, until a press); some failing is a note */
const kept = n => n ? ` (${n} earlier read${n === 1 ? '' : 's'} kept)` : '';
if (pr && pr.dk && pr.dk.asked && !(pr.dk.read + pr.dk.none)) problems.push(`ESPN's DraftKings player lines: all ${pr.dk.asked} games projected failed to read${kept(pr.dk.kept)}: the page shows the props model's projections${pr.dk.kept ? ' and the reads kept' : ''} until a Refresh odds press, and the next run reads again`);
else if (pr && pr.dk && pr.dk.failed) notes.push(`ESPN's DraftKings player lines: ${pr.dk.failed} of ${pr.dk.asked} games projected could not be read${kept(pr.dk.kept)}; read again next run`);
for (const n of notes) console.log('note: ' + n);
for (const p of problems) { console.log('BROKEN: ' + p); if (process.env.GITHUB_ACTIONS) console.log(`::error title=nhl source broken::${p}`); }
console.log(problems.length ? `${problems.length} source(s) broken; the state was published on what there is and the page says so` : 'every source the state stands on was read this run');
process.exit(problems.length ? 1 : 0);
