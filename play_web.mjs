// Real-time play-through of relational web sprints (live INPUT).
//   node harness/cdp.mjs run harness/play_web.mjs Eucalculia_v8.html [WxH]
// Env: WEB_LEVEL (default 3), WEB_RUNS (1), WEB_POLICY (perfect|sloppy|slow), WEB_RT (ms, default 900),
//      WEB_SHOTS=dir, WEB_POINTER=1 (tap buttons instead of keys)
import fs from 'node:fs';
import path from 'node:path';

export default async function ({ newPage, pageUrl, sleep }) {
  const level = process.env.WEB_LEVEL || '3', runs = Number(process.env.WEB_RUNS || 1), policy = process.env.WEB_POLICY || 'perfect';
  const rtMs = Number(process.env.WEB_RT || 900), shots = process.env.WEB_SHOTS || '', usePointer = process.env.WEB_POINTER === '1';
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const page = await newPage();
  await page.goto(`${pageUrl}&v8=web&v8level=${level}`, 3000);
  const S = (expr) => page.evaluate(expr);
  await page.key(' ', 'Space', 32);
  await sleep(1500);
  const log = [], results = [];
  let shotN = 0, guard = 0, lastKey = '', answered = -1, keyShot = false;
  const seen = new Set();
  const shot = async (tag) => { if (shots && shotN < 40) await page.screenshot(path.join(shots, `${String(shotN++).padStart(2, '0')}_${tag}.png`)); };
  const KEYS = { yn: [['y', 'KeyY', 89], ['n', 'KeyN', 78], ['c', 'KeyC', 67]], num: [['1', 'Digit1', 49], ['2', 'Digit2', 50], ['3', 'Digit3', 51], ['4', 'Digit4', 52]] };
  while (results.length < runs && guard++ < 20000) {
    await sleep(50);
    const st = await S(`(()=>{const i=State.trialInfo||{}; const ep=i.v8Episode; const c=ep&&ep.liveCtl&&ep.liveCtl.state; const w=ep&&ep.spec.web; const q=w&&c&&c.k>=0?w.questions[c.k]:null; return {s:State.status, kind:i.kind, phase:ep&&ep.phase, lp:c?c.phase:null, k:c?c.k:null, el:c?Math.round(performance.now()-c.shownAt):null, dl:c?Math.round(c.dl):null, q:q?{fmt:q.fmt,answer:q.answer,text:q.text,twoWay:!!(w.level===0)}:null, level:w?w.level:null, res:i.v8Result?{ok:i.v8Result.compoundCorrect,total:i.v8Result.total,correct:i.v8Result.correct,dl:i.v8Result.extra&&i.v8Result.extra.deadline}:null, id:ep?String(i.episodeWallStartedAt):null, keyPhase:c?c.keyPhase:null}})()`);
    const key = `${st.s}|${st.phase}|${st.lp}`;
    if (key !== lastKey) { log.push(`${st.s.padEnd(8)} ${st.kind || '-'} phase=${st.phase || '-'} live=${st.lp || '-'} L=${st.level ?? '-'}`); lastKey = key; if (st.lp === 'ready') { await sleep(300); await shot('study'); } }
    if (['AUTO_BRIEFING', 'UX_HOLD', 'BLOCK_SUMMARY', 'SUMMARY'].includes(st.s)) { await sleep(250); await page.key('Enter', 'Enter', 13); await sleep(120); await page.key(' ', 'Space', 32); }
    if (st.s === 'REVIEW') { await sleep(700); await shot('review'); await S(`(()=>{const b=document.querySelector('#reviewContinue, #reviewNextBtn, [data-review-continue], .review-continue'); if(b){b.click(); return 'btn'} return 'none'})()`); await page.key(' ', 'Space', 32); await sleep(300); }
    if (st.phase === 'live' && st.lp === 'ready' && st.s === 'INPUT') { await page.key(' ', 'Space', 32); answered = -1; await sleep(150); }
    if (st.lp === 'inter' && !keyShot) { keyShot = true; await sleep(300); await shot('keychange'); }
    if (st.phase === 'live' && st.lp === 'q' && st.q && st.k !== answered) {
      const want = policy === 'slow' ? rtMs * 4 : rtMs;
      if (st.el < want) continue;
      answered = st.k;
      if (st.k === 2) await shot(`q${st.k}`);
      let choice = st.q.answer;
      const n = st.q.fmt === 'order' || st.q.fmt === 'mirror' ? 4 : (st.level === 0 ? 2 : 3);
      if (policy === 'sloppy' && Math.random() < 0.25) choice = (choice + 1) % n;
      if (usePointer) { const r = await S(`(()=>{const b=document.querySelector('#panelV8Live [data-opt="${choice}"]'); if(!b) return null; const q=b.getBoundingClientRect(); return {x:q.x+q.width/2,y:q.y+q.height/2}})()`); if (r) await page.click(r.x, r.y); }
      else { const k = (st.q.fmt === 'order' || st.q.fmt === 'mirror') ? KEYS.num[choice] : KEYS.yn[choice]; await page.key(...k); }
      if (st.k === 3) { await sleep(120); await shot(`fb${st.k}`); }
    }
    if (st.res && st.id && !seen.has(st.id)) {
      seen.add(st.id);
      const snap = await S(`(()=>{const a=EUCALCULIA_V8_COORDINATOR.snapshot().axes.web; return {level:a.level, dl:a.custom.dl, hist:a.custom.hist, decision:a.custom.lastDecision}})()`);
      results.push({ res: st.res, snap });
      log.push(`   RESULT ${JSON.stringify(st.res)} decision=${JSON.stringify(snap.decision)} dl=${JSON.stringify(snap.dl)}`);
      await sleep(400); await shot('after');
    }
  }
  const tail = await S(`(()=>({status:State.status, errs:(window.__eucaErrs||[]).slice(0,10), runtimeErrors:(State.productionMonitor&&State.productionMonitor.runtimeErrors||[]).slice(-8).map(e=>String(e.message||e.error||JSON.stringify(e)).slice(0,200)), panic:(State.productionMonitor&&State.productionMonitor.panicEvents||[]).slice(-5), watchdog:(State.runtimeDebug&&State.runtimeDebug.watchdogEvents||[]).slice(-5), inv:(typeof validateUXFlowInvariants==='function'?(r=>({ok:r.ok,errors:r.errors}))(validateUXFlowInvariants('web')):null)}))()`);
  return { log, results, pageErrors: page.errors.slice(0, 10), consoleErrors: page.consoleErrors.slice(0, 10), tail };
}
