// Live play-through of v8 episodes in a real Auto block.
//   node harness/cdp.mjs run harness/play_v8.mjs Eucalculia_v8.html [WxH]
// Env: V8_AXIS (rft|nback|spaver|xcode, default rft), V8_LEVEL, V8_EPISODES (default 3), V8_ANSWER (correct|wrong|mixed), V8_SHOTS=dir
import fs from 'node:fs';
import path from 'node:path';

export default async function ({ newPage, pageUrl, sleep }) {
  const axis = process.env.V8_AXIS || 'rft';
  const level = process.env.V8_LEVEL;
  const episodes = Number(process.env.V8_EPISODES || 3);
  const mode = process.env.V8_ANSWER || 'mixed';
  const shots = process.env.V8_SHOTS || '';
  if (shots) fs.mkdirSync(shots, { recursive: true });
  const page = await newPage();
  const url = `${pageUrl}&v8=${axis}${level !== undefined ? `&v8level=${level}` : ''}${process.env.V8_VARIANT ? `&v8variant=${process.env.V8_VARIANT}` : ''}`;
  await page.goto(url, 3000);
  const S = (expr) => page.evaluate(expr);
  // Start the game the way a player does.
  await page.key(' ', 'Space', 32);
  await sleep(1500);
  const log = [];
  let done = 0, lastPhase = '', shotN = 0, guard = 0;
  const seenEpisodes = new Set();
  while (done < episodes && guard++ < 2400) {
    await sleep(120);
    const st = await S(`(()=>{const i=State.trialInfo||{}; const ep=i.v8Episode; return {s:State.status, p:State.pendingPanel, kind:i.kind, cat:i.catId, phase:ep&&ep.phase, step:ep&&ep.stepIndex, nSteps:ep&&ep.spec.steps.length, tok:ep&&ep.token, ask:ep&&ep.phase==='ask'?ep.spec.steps[ep.stepIndex]:null, res:i.v8Result||null, bt:State.blockTrials, running:State.running, flowHold:!!State.flowHold, errs:(window.__eucaErrs||[]).length, id:ep?String(i.episodeWallStartedAt):null}})()`);
    const key = `${st.s}|${st.phase}|${st.step}`;
    if (key !== lastPhase) { log.push(`${st.s.padEnd(8)} ${st.kind || '-'} ${st.cat || ''} phase=${st.phase || '-'} step=${st.step ?? '-'}/${st.nSteps ?? '-'} panel=${st.p}`); lastPhase = key;
      if (shots && st.kind === 'v8_episode' && (st.phase === 'frame' || st.phase === 'ask') && shotN < 40) { await sleep(250); await page.screenshot(path.join(shots, `${String(shotN++).padStart(2, '0')}_${st.phase}_${st.step}.png`)); }
    }
    if (st.s === 'AUTO_BRIEFING' || st.s === 'UX_HOLD' || st.s === 'BLOCK_SUMMARY' || st.s === 'SUMMARY') {
      await sleep(250);
      await S(`(()=>{try{ if(typeof resolveFlowHold==='function' && State.flowHold){ resolveFlowHold('qa'); return 'resolve'; } }catch(_){ } const el=document.querySelector('#flowHold button, .flow-hold button, #autoBriefing button, .briefing-continue, #holdContinue'); if(el){el.click(); return 'btn'} return 'none'})()`);
      await page.key('Enter', 'Enter', 13); await sleep(120); await page.key(' ', 'Space', 32); await page.click(260, 450);
    }
    if (st.s === 'REVIEW' && shots && shotN < 60) { await sleep(400); await page.screenshot(path.join(shots, `${String(shotN++).padStart(2, '0')}_review.png`)); }
    if (st.s === 'REVIEW') { await sleep(300); await S(`(()=>{const b=document.querySelector('#reviewContinue, #reviewNextBtn, [data-review-continue], .review-continue'); if(b){b.click(); return 'btn'} if(typeof continueFromReview==='function'){continueFromReview(); return 'fn'} return 'none'})()`); await page.key(' ', 'Space', 32); await sleep(300); }
    if (st.kind === 'v8_episode' && st.phase === 'ask' && st.s === 'INPUT') {
      const ask = st.ask; let choice;
      const wantCorrect = mode === 'correct' || (mode === 'mixed' && Math.random() < 0.7);
      if (ask.format === 'bool') { choice = wantCorrect ? ask.answer : !ask.answer; await S(`document.querySelector(${JSON.stringify(choice ? '#btnYes, .boolBtn.yes, [data-v="true"]' : '#btnNo, .boolBtn.no, [data-v="false"]')})?.click()`); }
      else { const n = ask.options.length; choice = wantCorrect ? ask.answer : (ask.answer + 1) % n; await S(`document.querySelectorAll('.choiceBtn')[${choice}]?.click()`); }
      await sleep(200);
    }
    if (st.res && st.id && !seenEpisodes.has(st.id)) { seenEpisodes.add(st.id); done++; log.push(`   RESULT ${JSON.stringify({ok:st.res.compoundCorrect, correct:st.res.correct, total:st.res.total})}`); }
    if (!st.running && guard > 30) { log.push('   (not running)'); break; }
  }
  const tail = await S(`(()=>({status:State.status, v8:EUCALCULIA_V8_COORDINATOR.snapshot().axes, errs:(window.__eucaErrs||[]).slice(0,10), runtimeErrors:(State.productionMonitor&&State.productionMonitor.runtimeErrors||[]).slice(-8).map(e=>String(e.message||e.error||JSON.stringify(e)).slice(0,160)), panic:(State.productionMonitor&&State.productionMonitor.panicEvents||[]).slice(-5), watchdog:(State.runtimeDebug&&State.runtimeDebug.watchdogEvents||[]).slice(-5)}))()`);
  return { log, pageErrors: page.errors.slice(0, 10), consoleErrors: page.consoleErrors.slice(0, 10), tail };
}
