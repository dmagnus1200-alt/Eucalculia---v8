// Real-time play-through of intensive N-back runs (live INPUT streams).
//   node harness/cdp.mjs run harness/play_nback.mjs Eucalculia_v8.html [WxH]
// Env: NB_MODE (S|D|T|R|Q|X|M|RQ|P, default D), NB_N (default 2), NB_RUNS (default 1),
//      NB_POLICY (perfect|sloppy|lure, default perfect), NB_SHOTS=dir, NB_PAUSE=1 (pause/resume mid-run),
//      NB_POINTER=1 (respond by clicking the pad instead of keys)
import fs from 'node:fs';
import path from 'node:path';

export default async function ({ newPage, pageUrl, sleep }) {
  const mode = process.env.NB_MODE || 'D', n = process.env.NB_N || '2', runs = Number(process.env.NB_RUNS || 1);
  const policy = process.env.NB_POLICY || 'perfect', shots = process.env.NB_SHOTS || '', usePointer = process.env.NB_POINTER === '1';
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const page = await newPage();
  await page.goto(`${pageUrl}&v8=nback&v8variant=${mode}&v8level=${n}`, 3000);
  const S = (expr) => page.evaluate(expr);
  await page.key(' ', 'Space', 32);
  await sleep(1500);
  const log = [], results = [];
  let shotN = 0, guard = 0, lastKey = '', pausedOnce = false;
  const seen = new Set();
  const KEYS = { a: ['a', 'KeyA', 65], s: ['s', 'KeyS', 83], d: ['d', 'KeyD', 68], f: ['f', 'KeyF', 70], j: ['j', 'KeyJ', 74], k: ['k', 'KeyK', 75], l: ['l', 'KeyL', 76] };
  const KEY_OF = { place: 'a', cross: 's', step: 'd', colour: 'f', form: 'j', sound: 'k', number: 'l', rel: 'l' };
  const shot = async (tag) => { if (shots && shotN < 40) await page.screenshot(path.join(shots, `${String(shotN++).padStart(2, '0')}_${tag}.png`)); };
  let answeredTrial = -1;
  while (results.length < runs && guard++ < 20000) {
    await sleep(60);
    const st = await S(`(()=>{const i=State.trialInfo||{}; const ep=i.v8Episode; const c=ep&&ep.liveCtl&&ep.liveCtl.state; const nb=ep&&ep.spec.nback; return {s:State.status, p:State.pendingPanel, paused:!!State.paused, kind:i.kind, phase:ep&&ep.phase, lp:c?c.phase:null, ti:c?c.i:null, el:c?Math.round(performance.now()-c.trialStart):null, lit:c?c.lit:null, nb:nb?{mode:nb.mode,n:nb.n,streams:nb.streams,len:nb.len,trialMs:nb.trialMs}:null, truth:nb&&c&&c.i>=0?Object.fromEntries(nb.streams.map(s=>[s,nb.truth[s][c.i]])):null, lure:nb&&c&&c.i>=0?Object.fromEntries(nb.streams.map(s=>[s,nb.lure[s][c.i]])):null, res:i.v8Result?{ok:i.v8Result.compoundCorrect,total:i.v8Result.total,correct:i.v8Result.correct}:null, id:ep?String(i.episodeWallStartedAt):null, panelActive:!!document.querySelector('#panelV8Live.active'), btns:document.querySelectorAll('#panelV8Live button').length}})()`);
    const key = `${st.s}|${st.phase}|${st.lp}`;
    if (key !== lastKey) { log.push(`${st.s.padEnd(8)} ${st.kind || '-'} phase=${st.phase || '-'} live=${st.lp || '-'} panel=${st.p} active=${st.panelActive} btns=${st.btns}${st.nb ? ` ${st.nb.mode} ${st.nb.n}-back [${st.nb.streams}] len=${st.nb.len} T=${st.nb.trialMs}` : ''}`); lastKey = key;
      if (st.phase === 'live' && st.lp === 'ready') { await sleep(300); await shot('ready'); }
    }
    if (['AUTO_BRIEFING', 'UX_HOLD', 'BLOCK_SUMMARY', 'SUMMARY'].includes(st.s)) {
      await sleep(250); await S(`(()=>{try{ if(typeof resolveFlowHold==='function' && State.flowHold){ resolveFlowHold('qa'); } }catch(_){ } })()`);
      await page.key('Enter', 'Enter', 13); await sleep(120); await page.key(' ', 'Space', 32);
    }
    if (st.s === 'REVIEW') { await sleep(600); await shot('review'); await sleep(200); await S(`(()=>{const b=document.querySelector('#reviewContinue, #reviewNextBtn, [data-review-continue], .review-continue'); if(b){b.click(); return 'btn'} if(typeof continueFromReview==='function'){continueFromReview(); return 'fn'} return 'none'})()`); await page.key(' ', 'Space', 32); await sleep(300); }
    if (st.phase === 'live' && st.lp === 'ready' && st.s === 'INPUT') {
      if (usePointer) { const r = await S(`(()=>{const b=document.querySelector('#panelV8Live [data-act="start"]'); if(!b) return null; const q=b.getBoundingClientRect(); return {x:q.x+q.width/2,y:q.y+q.height/2}})()`); if (r) await page.click(r.x, r.y); }
      else await page.key(' ', 'Space', 32);
      answeredTrial = -1; await sleep(200);
    }
    if (st.phase === 'live' && st.lp === 'run' && st.ti !== null && st.ti !== answeredTrial && st.el > 250) {
      answeredTrial = st.ti;
      if (st.ti === 5 && shots) await shot(`lit_${st.ti}`);
      if (st.ti === 6 && shots) { await sleep(Math.max(0, 1000 - st.el)); await shot(`blank_${st.ti}`); }
      for (const [s, t] of Object.entries(st.truth || {})) {
        if (t === null) continue;
        let press = t;
        if (policy === 'sloppy' && Math.random() < 0.2) press = !t;
        if (policy === 'lure' && st.lure[s]) press = true;
        if (!press) continue;
        if (usePointer) { const r = await S(`(()=>{const b=document.querySelector('#panelV8Live [data-stream="${s}"]'); if(!b) return null; const q=b.getBoundingClientRect(); return {x:q.x+q.width/2,y:q.y+q.height/2}})()`); if (r) await page.click(r.x, r.y); }
        else { const k = KEYS[KEY_OF[s]]; await page.key(...k); }
      }
      if (st.ti === 7 && shots) await shot(`pressed_${st.ti}`);
      if (process.env.NB_PAUSE === '1' && st.ti === 9 && !pausedOnce) {
        pausedOnce = true;
        await S(`(()=>{try{document.getElementById('pauseBtn').click(); return 'paused'}catch(e){return String(e)}})()`);
        await sleep(1500); await shot('paused_menu');
        const r = await S(`(()=>({paused:State.paused, status:State.status, lp:State.trialInfo?.v8Episode?.liveCtl?.state?.phase, pausedAt:State.trialInfo?.v8Episode?.liveCtl?.state?.pausedAt}))()`);
        log.push(`   paused: ${JSON.stringify(r)}`);
        await S(`(()=>{const b=document.getElementById('resumeBtn')||document.getElementById('startBtn'); if(b){b.click(); return b.id} return 'none'})()`);
        await sleep(1500);
        const r2 = await S(`(()=>({paused:State.paused, status:State.status, lp:State.trialInfo?.v8Episode?.liveCtl?.state?.phase, i:State.trialInfo?.v8Episode?.liveCtl?.state?.i}))()`);
        log.push(`   resumed: ${JSON.stringify(r2)}`);
      }
    }
    if (st.res && st.id && !seen.has(st.id)) {
      seen.add(st.id);
      const snap = await S(`(()=>{const c=EUCALCULIA_V8_COORDINATOR.snapshot().axes.nback; return {level:c.level, n:c.custom.n, unlocked:c.custom.unlocked, runs:c.custom.runs, daily:c.custom.daily, last:(c.custom.hist||[]).slice(-1)[0]}})()`);
      results.push({ res: st.res, snap });
      log.push(`   RESULT ${JSON.stringify(st.res)} → ${JSON.stringify(snap.last)} n=${JSON.stringify(snap.n)}`);
      await sleep(400); await shot('after');
    }
  }
  const tail = await S(`(()=>({status:State.status, errs:(window.__eucaErrs||[]).slice(0,10), runtimeErrors:(State.productionMonitor&&State.productionMonitor.runtimeErrors||[]).slice(-8).map(e=>String(e.message||e.error||JSON.stringify(e)).slice(0,200)), panic:(State.productionMonitor&&State.productionMonitor.panicEvents||[]).slice(-5), watchdog:(State.runtimeDebug&&State.runtimeDebug.watchdogEvents||[]).slice(-5), inv:(typeof validateUXFlowInvariants==='function'?(r=>({ok:r.ok,errors:r.errors}))(validateUXFlowInvariants('nb')):null)}))()`);
  return { log, results, pageErrors: page.errors.slice(0, 10), consoleErrors: page.consoleErrors.slice(0, 10), tail };
}
