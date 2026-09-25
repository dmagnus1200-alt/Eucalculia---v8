/* V8.1 EPISODE RUNTIME:START
   One shared runtime for every v8 family (relational frames, N-back, SPA-VER, cross-code).
   An episode is a list of steps played inside ONE scored trial:
     {type:"frame", html, ms, label?, prompt?, aria?}      stimulus on the central surface (FLASH)
     {type:"mask",  ms}                                     canonical dynamic mask (MASK)
     {type:"ask",   question, format:"bool"|"choice", options?, answer, visual?, label?, prompt?, id?}
     {type:"live",  html, mount(api), onKey?(event), label?, prompt?}
                    a self-timed INPUT phase (e.g. a continuous N-back stream): the step owns
                    the central surface and a response pad (#panelV8Live) and ends itself with
                    api.finish(records). INPUT has no watchdog time limit; the pad is validated.
   Frames and masks re-enter FLASH/MASK so each phase stays inside the watchdog limits; asks
   open a normal INPUT panel. Sub-answers are captured here; after the last ask the core
   processInput receives one compound boolean (the SPA-05 R2 contract), so block counting,
   feedback, review and persistence stay on the ordinary path.
*/
(function installV8Runtime(){
  "use strict";
  if(globalThis.EUCALCULIA_V8_RUNTIME) return;
  const PATCH_ID = "v8.1-episode-runtime";
  const VERSION = "8.1.0";
  const APP_MODE_CLASS = "v8-ep-mode";
  const FRAME_MAX_MS = 5200;           // FLASH watchdog is 6000 ms
  const MASK_MAX_MS = 1200;            // MASK watchdog is 2500 ms
  const LIVE_PANEL = "v8live";         // custom pendingPanel, validated below (genpair precedent)

  const stateRef = () => { try{ return typeof State !== "undefined" ? State : globalThis.State; }catch(_){ return globalThis.State; } };
  const clock = () => { try{ return typeof now === "function" ? now() : performance.now(); }catch(_){ return Date.now(); } };
  const esc = v => String(v ?? "").replace(/[&<>"]/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"})[ch]);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
  function schedule(key, fn, delay, meta){
    try{ if(typeof scheduleOwnedRuntimeTask === "function") return scheduleOwnedRuntimeTask(key, fn, delay, {patch:PATCH_ID, protectedContinuation:true, ...(meta||{})}); }catch(_){ }
    return setTimeout(fn, delay);
  }
  const $id = id => document.getElementById(id);

  // ---- surfaces --------------------------------------------------------------------------
  function disableLegacyCanvas(){ try{ const c = $id("gameCanvas"); if(c){ c.hidden = true; c.style.display = "none"; c.setAttribute("aria-hidden","true"); c.dataset.v8Disabled = "true"; delete c.dataset.unifiedSpatialMask; } }catch(_){ } }
  function showCanonicalMask(){
    try{
      const app = $id("app"), c = $id("gameCanvas"), meta = $id("metaQuestion");
      if(app) app.dataset.unifiedSpatialMask = "true";
      if(c){ c.hidden = false; c.style.display = "block"; c.removeAttribute("aria-hidden"); c.dataset.unifiedSpatialMask = "true"; delete c.dataset.v8Disabled; }
      if(meta){ meta.classList.remove("visible"); meta.hidden = true; meta.setAttribute("aria-hidden","true"); }
    }catch(_){ }
  }
  function restoreLegacyCanvas(){
    try{
      const c = $id("gameCanvas");
      if(c && (c.dataset.v8Disabled === "true" || c.dataset.unifiedSpatialMask === "true")){ c.hidden = false; c.style.display = ""; c.removeAttribute("aria-hidden"); delete c.dataset.v8Disabled; delete c.dataset.unifiedSpatialMask; }
      const app = $id("app"); if(app) delete app.dataset.unifiedSpatialMask;
      const meta = $id("metaQuestion"); if(meta){ meta.hidden = false; meta.removeAttribute("aria-hidden"); }
    }catch(_){ }
  }
  function clearPrepBanner(){
    // The core shows "Preparing next trial…" while it prepares an ordinary trial; an episode replaces it.
    try{ const st = stateRef(); if(st) st.trialPrepLoading = null; }catch(_){ }
    try{ const lp = $id("levelProgress"); if(lp) lp.classList.remove("visible","intro","near","ready","reverse"); const lpt = $id("levelProgressText"); if(lpt && /Preparing next trial/i.test(lpt.textContent || "")) lpt.textContent = ""; const f = $id("levelProgressFill"); if(f) f.style.width = "0%"; }catch(_){ }
  }
  function setCentralLabel(text){ try{ const l = document.querySelector("#metaQuestion .meta-label"); if(l) l.textContent = String(text || ""); }catch(_){ } }
  function setPromptSafe(t){ try{ if(typeof setPrompt === "function") setPrompt(t); }catch(_){ } }
  function setAnswerSafe(t){ try{ if(typeof setAnswer === "function") setAnswer(t); }catch(_){ } }
  function setAppPhase(phase, family){
    try{ const app = $id("app"); if(!app) return; app.classList.add(APP_MODE_CLASS); app.dataset.v8Phase = phase; app.dataset.v8Family = family || ""; }catch(_){ }
  }
  function clearAppMode(){ try{ const app = $id("app"); if(!app) return; app.classList.remove(APP_MODE_CLASS); delete app.dataset.v8Phase; delete app.dataset.v8Family; }catch(_){ } }
  // The live pad sits in #trayPanels like the core panels; the core's hideAllPanels() does not
  // know it, so the runtime shows and hides it itself.
  function ensureLivePanel(){
    let p = $id("panelV8Live");
    if(p) return p;
    const host = $id("trayPanels"); if(!host) return null;
    p = document.createElement("div"); p.className = "panel"; p.id = "panelV8Live";
    p.setAttribute("role", "group"); p.setAttribute("aria-label", "Match responses");
    host.appendChild(p);
    return p;
  }
  function hideLivePanel(){ try{ const p = $id("panelV8Live"); if(p){ p.classList.remove("active"); p.innerHTML = ""; } const app = $id("app"); if(app) app.classList.remove("v8-live-mode"); }catch(_){ } }
  function liveStepActive(){ const info = stateRef()?.trialInfo, ep = epOf(info); return !!ep && ep.phase === "live" ? {info, ep} : null; }

  // ---- episode state ---------------------------------------------------------------------
  const epOf = info => (info && info.v8Episode) || null;
  const live = (info, token) => { const st = stateRef(); const ep = epOf(info); return !!ep && st?.trialInfo === info && (token === undefined || ep.token === token) && ep.phase !== "complete"; };
  let internalStatus = 0;
  function setStatusInternal(status, reason){
    internalStatus++;
    try{ setStatus(status, `${PATCH_ID}.${reason}`); }catch(_){ const st = stateRef(); if(st){ st.status = status; st.phaseStartTime = clock(); } }
    finally{ internalStatus--; }
  }

  function currentStep(info){ const ep = epOf(info); return ep ? ep.spec.steps[ep.stepIndex] || null : null; }

  function showSurface(info, step, question, options){
    const ep = epOf(info);
    ep.surfaceHtml = step.html || step.visual || "";
    try{ if(typeof showMetaQuestion === "function") showMetaQuestion(0, question || "", step.hint || "", options || null); }catch(_){ }
    try{ const meta = $id("metaQuestion"); if(meta){ meta.hidden = false; meta.removeAttribute("aria-hidden"); meta.classList.add("visible"); } }catch(_){ }
    setCentralLabel(step.label || ep.spec.label || "RELATIONS");
  }

  function runStep(info, index){
    const ep = epOf(info); if(!ep || stateRef()?.trialInfo !== info) return false;
    ep.stepIndex = index; ep.token++;
    const token = ep.token, step = ep.spec.steps[index], st = stateRef();
    if(!step){ return false; }
    if(step.type === "frame"){
      ep.phase = "frame";
      st.targetValue = null; st.pendingPanel = "none";
      info.options = []; info.responseFormat = "none"; info.answerKind = "none"; info.delayedPrompt = "";
      try{ if(typeof hideAllPanels === "function") hideAllPanels(); }catch(_){ }
      disableLegacyCanvas();
      setAppPhase("frame", ep.spec.family);
      const ms = clamp(step.ms, 250, FRAME_MAX_MS);
      ep.frameMs = ms;
      setStatusInternal("FLASH", "frame");
      clearPrepBanner();
      showSurface(info, step, step.caption || "", null);
      setPromptSafe(step.prompt || "WATCH"); setAnswerSafe("—");
      try{ if(typeof setGameAriaLabel === "function") setGameAriaLabel(step.aria || "Remember what you see."); }catch(_){ }
      const paint = () => { if(!live(info, token) || ep.phase !== "frame") return; disableLegacyCanvas(); setCentralLabel(step.label || ep.spec.label || "RELATIONS"); };
      try{ queueMicrotask(paint); requestAnimationFrame(paint); }catch(_){ }
      ep.frameShownAt = clock();
      schedule(`v8_frame_${token}`, () => advance(info, token), ms, {phase:"frame"});
      return true;
    }
    if(step.type === "mask"){
      ep.phase = "mask";
      st.targetValue = null; st.pendingPanel = "none";
      try{ if(typeof hideAllPanels === "function") hideAllPanels(); }catch(_){ }
      setAppPhase("mask", ep.spec.family);
      const ms = clamp(step.ms, 120, MASK_MAX_MS);
      setStatusInternal("MASK", "mask");
      // The core loop leaves MASK after CONFIG.maskMs; shift the phase start so both clocks agree.
      try{ const base = Math.max(0, Number(CONFIG?.maskMs) || 0); st.phaseStartTime = clock() + ms - base; }catch(_){ }
      showCanonicalMask();
      setPromptSafe("HOLD"); setAnswerSafe("—");
      schedule(`v8_mask_${token}`, () => advance(info, token), ms, {phase:"mask"});
      return true;
    }
    if(step.type === "ask"){
      ep.phase = "ask";
      disableLegacyCanvas();
      setAppPhase("ask", ep.spec.family);
      const isChoice = step.format === "choice";
      const opts = isChoice ? (step.options || []).map(o => typeof o === "string" ? {text:o} : {text:String(o.text ?? o.label ?? ""), html:o.html || null}) : [];
      info.options = opts;
      info.responseFormat = isChoice ? "choice" : "bool";
      info.answerKind = info.responseFormat;
      info.requiredSelections = 1;
      info.choiceSelections = [];
      info.question = step.question;
      info.delayedPrompt = "";
      st.inputBuffer = "";
      st.targetValue = isChoice ? Number(step.answer) : !!step.answer;
      st.pendingPanel = isChoice ? "choice" : "bool";
      if(isChoice){ info.correctIndex = Number(step.answer); try{ if(typeof setChoiceOptions === "function") setChoiceOptions(opts); }catch(_){ } }
      else { info.isTrue = !!step.answer; info.targetOutcome = !!step.answer; }
      showSurface(info, step, step.question, isChoice ? opts : null);
      ep.askOpenedAt = clock();
      try{ beginInputPhase(); }catch(_){ try{ setStatusInternal("INPUT","ask_fallback"); if(typeof showPanel === "function") showPanel(st.pendingPanel); }catch(__){ } }
      if(isChoice){ try{ decorateChoiceButtons(opts); }catch(_){ } }
      setPromptSafe(step.prompt || (isChoice ? "CHOOSE ONE" : "YES OR NO"));
      try{ if(typeof setGameAriaLabel === "function") setGameAriaLabel(step.question); }catch(_){ }
      return true;
    }
    if(step.type === "live"){
      ep.phase = "live";
      disableLegacyCanvas();
      setAppPhase("live", ep.spec.family);
      try{ if(typeof hideAllPanels === "function") hideAllPanels(); }catch(_){ }
      st.targetValue = null; st.inputBuffer = "";
      info.options = []; info.responseFormat = "none"; info.answerKind = "none"; info.question = step.question || ""; info.delayedPrompt = "";
      showSurface(info, step, "", null);
      const panel = ensureLivePanel();
      if(panel){ panel.innerHTML = ""; panel.classList.add("active"); }
      try{ $id("app")?.classList.add("v8-live-mode"); }catch(_){ }
      st.pendingPanel = LIVE_PANEL;
      setStatusInternal("INPUT", "live");
      st.pendingPanel = LIVE_PANEL;
      clearPrepBanner();
      ep.askOpenedAt = clock();
      const liveLabel = step.label || ep.spec.label || "RELATIONS";
      ep.livePrompt = step.prompt || "READY";
      setCentralLabel(liveLabel); setPromptSafe(ep.livePrompt); setAnswerSafe("—");
      // INPUT-entry hooks in the core may relabel the frame or the prompt a moment later.
      for(const d of [40, 200]) setTimeout(() => { if(live(info, token) && ep.phase === "live"){ setCentralLabel(liveLabel); setPromptSafe(ep.livePrompt); } }, d);
      try{ if(typeof setGameAriaLabel === "function") setGameAriaLabel(step.aria || "Continuous task: respond to each item."); }catch(_){ }
      const api = {
        panel,
        clock,
        esc,
        live:() => live(info, token) && ep.phase === "live",
        paused:() => { const s = stateRef(); return !!(s?.paused) || s?.status !== "INPUT" || (typeof document !== "undefined" && document.visibilityState === "hidden"); },
        stage:() => document.querySelector("#metaQuestion .meta-stimulus"),
        setSurface:(html) => { ep.surfaceHtml = String(html || ""); const h = api.stage(); if(h){ h.innerHTML = ep.surfaceHtml; h.style.display = ""; } },
        prompt:(t) => { ep.livePrompt = String(t || ""); setPromptSafe(t); },
        answer:(t) => setAnswerSafe(t),
        // Keep the pad, the pending panel and the frame label asserted (other code may call
        // hideAllPanels() or relabel the frame on INPUT).
        assert:() => {
          if(!api.live()) return;
          const s = stateRef(); if(s && s.status === "INPUT" && s.pendingPanel !== LIVE_PANEL) s.pendingPanel = LIVE_PANEL;
          const p = $id("panelV8Live"); if(p && !p.classList.contains("active")) p.classList.add("active");
          const l = document.querySelector("#metaQuestion .meta-label"); if(l && l.textContent !== liveLabel) l.textContent = liveLabel;
        },
        finish:(records, extra) => finishLive(info, token, records, extra)
      };
      ep.liveApi = api;
      try{ ep.liveCtl = step.mount(api) || {}; }
      catch(error){ try{ recordRuntimeError(error, {source:PATCH_ID + ".live_mount", family:ep.spec.family}); }catch(_){ } finishLive(info, token, [], {aborted:true}); }
      return true;
    }
    return false;
  }
  function finishLive(info, token, records, extra){
    if(!live(info, token)) return false;
    const ep = epOf(info);
    if(ep.phase !== "live") return false;
    ep.answers = (Array.isArray(records) ? records : []).map(r => ({stepIndex:ep.stepIndex, id:r.id || null, value:r.value, correct:!!r.correct, rt:Math.max(0, Math.round(Number(r.rt) || 0)), expected:r.expected ?? null, kind:r.kind || "live", meta:r.meta || null}));
    ep.activeRt = Math.max(1, Math.round(Number(extra?.activeMs) || (clock() - (ep.askOpenedAt || clock()))));
    ep.liveExtra = extra || null;
    hideLivePanel();
    const s = stateRef(); if(s) s.pendingPanel = "none";
    return finalize(info, null);
  }
  // Options may carry html (SVG); the tray keeps its text label for accessibility.
  function decorateChoiceButtons(opts){
    document.querySelectorAll(".choiceBtn").forEach((btn, i) => {
      const o = opts[i]; if(!o || !o.html) return;
      const t = btn.querySelector(".choiceText"); if(!t) return;
      t.innerHTML = `<span class="v8-opt-visual">${o.html}</span><span class="v8-opt-text">${esc(o.text)}</span>`;
    });
  }

  function advance(info, token){
    if(!live(info, token)) return false;
    const ep = epOf(info);
    const next = ep.stepIndex + 1;
    if(next >= ep.spec.steps.length){ return false; }
    return runStep(info, next);
  }

  // ---- answers ---------------------------------------------------------------------------
  function captureAnswer(info, value, activationMeta){
    const ep = epOf(info), st = stateRef(), step = currentStep(info);
    if(!ep || !step || step.type !== "ask" || ep.phase !== "ask") return false;
    const isChoice = step.format === "choice";
    let v;
    if(isChoice){ v = Number(value); if(!Number.isInteger(v) || v < 0 || v >= (step.options || []).length) return false; }
    else v = value === true || value === 1 || value === "1";
    const correct = isChoice ? v === Number(step.answer) : v === !!step.answer;
    const rt = Math.max(1, Math.round(clock() - (ep.askOpenedAt || clock())));
    ep.answers.push({stepIndex:ep.stepIndex, id:step.id || null, value:v, correct, rt, expected:isChoice ? Number(step.answer) : !!step.answer, kind:step.kind || null, meta:step.meta || null});
    ep.activeRt += rt;
    const remainingAsk = ep.spec.steps.slice(ep.stepIndex + 1).some(s => s.type === "ask");
    if(!remainingAsk){ return finalize(info, activationMeta); }
    // Intermediate answer: lock briefly, then continue the episode.
    ep.phase = "locked";
    const token = ep.token;
    try{ if(typeof hideAllPanels === "function") hideAllPanels(); }catch(_){ }
    st.pendingPanel = "none"; st.targetValue = null;
    setStatusInternal("LOCKED", "sub_answer");
    setPromptSafe(ep.spec.subAnswerPrompt || "…");
    schedule(`v8_after_answer_${token}`, () => { if(live(info, token)) runStep(info, ep.stepIndex + 1); }, ep.spec.interAskMs || 140, {phase:"locked"});
    return true;
  }

  function finalize(info, activationMeta){
    const ep = epOf(info), st = stateRef();
    const spec = ep.spec;
    const nAsk = ep.answers.length, nCorrect = ep.answers.filter(a => a.correct).length;
    let compound;
    if(typeof spec.score === "function") compound = !!spec.score(ep.answers);
    else if(spec.scoring?.mode === "threshold") compound = nCorrect >= Number(spec.scoring.minCorrect || nAsk);
    else compound = nCorrect === nAsk;
    ep.compoundCorrect = compound;
    ep.phase = "complete";
    info.v8Result = {compoundCorrect:compound, correct:nCorrect, total:nAsk, answers:ep.answers.map(a => ({...a})), extra:ep.liveExtra || null};
    try{ if(typeof spec.onComplete === "function") spec.onComplete(info.v8Result, info); }catch(_){ }
    const end = clock(), activeRt = clamp(ep.activeRt, 1, 600000), wallStart = Number(info.episodeWallStartedAt) || end - activeRt;
    st.targetValue = true; st.pendingPanel = "bool";
    info.responseFormat = "bool"; info.answerKind = "bool"; info.isTrue = true; info.targetOutcome = true; info.answer = true;
    info.options = [];
    info.question = spec.summaryQuestion || spec.title || "Relational episode";
    try{ if(typeof resetCognitiveTiming === "function") resetCognitiveTiming(); st.trialStartTime = end - activeRt; if(st.timing){ st.timing.inputOpenedAt = st.trialStartTime; st.timing.trialWallStartedAt = wallStart; } }catch(_){ }
    try{ const app = $id("app"); if(app) app.dataset.v8Phase = "complete"; }catch(_){ }
    const original = processInputOriginal();
    if(typeof original !== "function") return false;
    return original.call(globalThis, compound, activationMeta);
  }

  // ---- hooks ------------------------------------------------------------------------------
  const HOOK = "__eucaV8Runtime";
  function copyProps(src, dst){ try{ for(const k of Reflect.ownKeys(src)){ if(["length","name","prototype","arguments","caller"].includes(String(k)) || String(k).startsWith(HOOK)) continue; try{ Object.defineProperty(dst, k, Object.getOwnPropertyDescriptor(src, k)); }catch(_){ } } }catch(_){ } return dst; }
  function hook(name, make){
    try{
      const prev = globalThis[name];
      if(typeof prev !== "function") return false;
      if(prev[HOOK]) return true;
      const wrapped = make(prev);
      copyProps(prev, wrapped);
      wrapped[HOOK] = true; wrapped[HOOK + "Original"] = prev;
      globalThis[name] = wrapped;
      try{ (0, eval)(`${name} = globalThis.${name}`); }catch(_){ }
      return true;
    }catch(_){ return false; }
  }
  let processInputPrev = null;
  function processInputOriginal(){ return processInputPrev; }
  function installHooks(){
    const r = {};
    r.currentET = hook("currentET", prev => function currentETV8(){
      const info = stateRef()?.trialInfo, ep = epOf(info);
      if(ep && ep.phase === "frame") return (ep.frameMs || 1000) + 900; // our own timer ends the frame first
      return prev.apply(this, arguments);
    });
    r.setStatus = hook("setStatus", prev => function setStatusV8(next, reason){
      const info = stateRef()?.trialInfo, ep = epOf(info);
      if(ep && !internalStatus && ep.phase === "frame" && String(next) === "MASK"){
        // The core loop ended the FLASH: let the episode take the next step itself.
        advance(info, ep.token);
        return stateRef()?.status;
      }
      return prev.apply(this, arguments);
    });
    r.beginInputPhase = hook("beginInputPhase", prev => function beginInputPhaseV8(){
      const info = stateRef()?.trialInfo, ep = epOf(info);
      if(ep && ep.phase === "mask"){ advance(info, ep.token); return false; }
      if(ep && (ep.phase === "frame" || ep.phase === "locked")) return false;
      return prev.apply(this, arguments);
    });
    r.processInput = hook("processInput", prev => { processInputPrev = prev; return function processInputV8(value, activationMeta=null){
      const st = stateRef(), info = st?.trialInfo, ep = epOf(info);
      if(!ep || ep.phase === "complete") return prev.apply(this, arguments);
      if(ep.phase !== "ask" || st.status !== "INPUT") return false;
      try{ if(typeof noteUserInput === "function") noteUserInput("v8_episode", value, activationMeta); }catch(_){ }
      return captureAnswer(info, value, activationMeta);
    }; });
    r.handleChoice = hook("handleChoiceInputIndex", prev => function handleChoiceInputIndexV8(index, activationMeta=null){
      const st = stateRef(), info = st?.trialInfo, ep = epOf(info);
      if(!ep || ep.phase === "complete") return prev.apply(this, arguments);
      if(ep.phase !== "ask" || st.status !== "INPUT" || st.pendingPanel !== "choice") return false;
      return captureAnswer(info, Number(index), activationMeta);
    });
    r.metaStimulus = hook("metaStimulusSVGForTrialInfo", prev => function metaStimulusSVGForTrialInfoV8(info){
      const ep = epOf(info);
      if(ep) return ep.surfaceHtml || "";
      return prev.apply(this, arguments);
    });
    r.reviewModel = hook("h35ReviewBuildModel", prev => function h35ReviewBuildModelV8(info){
      const model = prev.apply(this, arguments);
      const ep = epOf(info); if(!ep) return model;
      const rv = typeof ep.spec.review === "function" ? ep.spec.review(info.v8Result || {}, info) : (ep.spec.review || {});
      return {...model, title:rv.title || "", showStimulus:true, question:rv.question || ep.spec.summaryQuestion || "",
        userAnswer:rv.userAnswer || "", correctAnswer:rv.correctAnswer || "", reasons:Array.isArray(rv.reasons) ? rv.reasons : [], learning:rv.learning || ""};
    });
    r.reviewPaint = hook("h35ReviewPaintStimulus", prev => function h35ReviewPaintStimulusV8(info){
      const host = $id("reviewVisualContext"), canvas = $id("reviewStimulusCanvas"), ep = epOf(info);
      let custom = $id("reviewV8");
      if(!ep){ host?.classList.remove("v8-review"); if(custom) custom.hidden = true; if(canvas) canvas.style.display = ""; return prev.apply(this, arguments); }
      if(!host || !canvas) return false;
      for(const id of ["reviewXrepVisual","reviewSpa02","reviewSpa03","reviewSpa04","reviewSpa05","reviewSpa05R2"]){ const s = $id(id); if(s) s.hidden = true; }
      if(!custom){ custom = document.createElement("div"); custom.id = "reviewV8"; canvas.insertAdjacentElement("afterend", custom); }
      const rv = typeof ep.spec.review === "function" ? ep.spec.review(info.v8Result || {}, info) : (ep.spec.review || {});
      custom.innerHTML = rv.html || "";
      custom.hidden = !rv.html; canvas.style.display = "none"; host.hidden = false; host.classList.add("v8-review");
      return true;
    });
    r.startReset = hook("maybeStartInlineGenerativeTrialAfterReset", prev => function maybeStartInlineGenerativeTrialAfterResetV8Reset(){
      // Every new trial starts from a clean surface; a finished v8 episode leaves no mode behind.
      const info = stateRef()?.trialInfo;
      if(!epOf(info) || epOf(info).phase === "complete"){ clearAppMode(); restoreLegacyCanvas(); hideLivePanel(); }
      return prev.apply(this, arguments);
    });
    // The live pad is a custom pendingPanel: accept it when the pad exists with operable buttons.
    r.validateInput = hook("validateCurrentInputOperability", prev => function validateCurrentInputOperabilityV8(){
      const res = prev.apply(this, arguments) || {ok:true, errors:[]};
      const st = stateRef();
      if(st?.status !== "INPUT" || st?.pendingPanel !== LIVE_PANEL) return res;
      const errs = (Array.isArray(res.errors) ? res.errors : []).filter(e => !/invalid pendingPanel v8live/.test(String(e)));
      const lv = liveStepActive();
      const p = $id("panelV8Live");
      if(!lv) errs.push("v8live panel without a live episode");
      else {
        if(p && !p.classList.contains("active")) p.classList.add("active");
        const n = p ? Array.from(p.querySelectorAll("button")).filter(b => b.offsetParent !== null && !b.disabled).length : 0;
        if(!p || n < 1) errs.push("v8live pad missing");
      }
      return {ok:errs.length === 0, errors:errs};
    });
    return r;
  }
  // Keys for a live step (captured before the core's bubble-phase shortcuts).
  function onLiveKey(e){
    const lv = liveStepActive(); if(!lv) return;
    if(e.ctrlKey || e.metaKey || e.altKey || e.key === "Escape") return;
    const step = lv.ep.spec.steps[lv.ep.stepIndex];
    const ctl = lv.ep.liveCtl;
    let used = false;
    try{ if(ctl && typeof ctl.onKey === "function") used = !!ctl.onKey(e); }catch(_){ used = false; }
    if(!used && step && typeof step.onKey === "function"){ try{ used = !!step.onKey(e); }catch(_){ } }
    if(used){ e.preventDefault(); e.stopPropagation(); }
  }
  try{ window.addEventListener("keydown", onLiveKey, true); }catch(_){ }

  // ---- public: start an episode ----------------------------------------------------------
  function validateSpec(spec){
    const errs = [];
    if(!spec || !Array.isArray(spec.steps) || !spec.steps.length) errs.push("no steps");
    else {
      if(!["ask","live"].includes(spec.steps[spec.steps.length-1].type)) errs.push("last step must be an ask or a live step");
      spec.steps.forEach((s, i) => {
        if(!["frame","mask","ask","live"].includes(s.type)) errs.push(`step ${i}: bad type`);
        if(s.type === "live"){ if(typeof s.mount !== "function") errs.push(`step ${i}: live step without mount`); if(i !== spec.steps.length - 1) errs.push(`step ${i}: live step must be last`); }
        if(s.type === "frame" && !(Number(s.ms) > 0)) errs.push(`step ${i}: frame without ms`);
        if(s.type === "ask"){
          if(!s.question) errs.push(`step ${i}: ask without question`);
          if(s.format === "choice"){ const n = (s.options || []).length; if(n < 2 || n > 4) errs.push(`step ${i}: ${n} options`); if(!Number.isInteger(Number(s.answer)) || s.answer < 0 || s.answer >= n) errs.push(`step ${i}: answer index`); }
          else if(typeof s.answer !== "boolean") errs.push(`step ${i}: bool answer`);
        }
        const text = JSON.stringify([s.html || "", s.question || "", s.options || []]);
        if(/\bNaN\b|\bundefined\b/.test(text)) errs.push(`step ${i}: NaN/undefined token`);
      });
    }
    return errs;
  }
  function start(spec){
    const st = stateRef(); if(!st) return false;
    const errs = validateSpec(spec);
    if(errs.length){ try{ if(typeof recordRuntimeError === "function") recordRuntimeError(new Error("v8 episode rejected: " + errs.join("; ")), {source:PATCH_ID, family:spec?.family}); }catch(_){ } return false; }
    try{
      if(typeof invalidatePreparedTrial === "function") invalidatePreparedTrial("v8_episode_commit"); else { st.nextTrialPrepared = null; st.nextTrialPrepareInFlight = false; }
      const app = $id("app");
      app?.classList.remove("productive-balance-mode","visual-predict-mode","visual-path-mode","masked-spatial-probe-mode","masked-paper-folding-mode","spa02-solid-net-mode","spa03-view-mode","spa04-section-mode","spa05-piece-composition-mode","spa05-r2-mode");
      try{ if(typeof clearInputStimulus === "function") clearInputStimulus(); }catch(_){ }
      try{ if(typeof hideAllPanels === "function") hideAllPanels(); }catch(_){ }
      try{ if(typeof hideMemoryCue === "function") hideMemoryCue(); }catch(_){ }
      st.currentTrialLevel = 0; st.autoPhase = "L0"; st.currentTrialValue = null; st.currentTrialRep = null;
      // A 1×1 placeholder keeps the FLASH/MASK "main stimulus cache" invariant true while the legacy
      // canvas is disabled (the XREP pack does the same).
      let dummy = null; try{ dummy = document.createElement("canvas"); dummy.width = 1; dummy.height = 1; }catch(_){ dummy = null; }
      st.mainStim = null; st.secStim = null; st.mainCache = dummy; st.secCache = null;
      st.targetValue = null; st.pendingPanel = "none"; st.inputBuffer = "";
      const wall = clock();
      st.trialInfo = {
        kind:"v8_episode", level:0, statsMode:"D", autoPhase:"L0",
        family:spec.family, catFamily:spec.family, catId:spec.catId || spec.family, contentSpecId:spec.contentSpecId || `v8.${spec.family}`, contentSpecVersion:VERSION,
        responseFormat:"none", answerKind:"none", answer:null, targetOutcome:null, question:"", delayedPrompt:"", options:[],
        questionLayout:"visual", optionOrderPolicy:"v8_episode_locked", episodeWallStartedAt:wall,
        atomics:spec.atomics || [spec.family], atomicsUsed:spec.atomics || [spec.family],
        frameTags:spec.frameTags || [], mechanismTags:spec.mechanismTags || [], executiveTags:spec.executiveTags || [],
        demandVector:spec.demandVector || {}, v8Features:spec.features || {},
        countsForMetaHistory:false, countsForMastery:true, countsForAdaptation:false, memoryEligible:false,
        compoundScoring:{components:spec.steps.filter(s => s.type === "ask").map((s,i) => s.id || `ask${i+1}`), maximumPenalty:1, blockTrialIncrement:1},
        v8Axis:spec.axis || null, v8Level:spec.level ?? null,
        v8Episode:{spec, stepIndex:-1, token:0, phase:"init", answers:[], activeRt:0, surfaceHtml:""}
      };
      runStep(st.trialInfo, 0);
      return true;
    }catch(error){
      try{ recordRuntimeError(error, {source:PATCH_ID + ".start", family:spec?.family}); }catch(_){ }
      clearAppMode(); restoreLegacyCanvas();
      return false;
    }
  }

  let installed = installHooks();
  const reinstall = () => { installed = installHooks(); };
  try{ queueMicrotask(reinstall); setTimeout(reinstall, 0); setTimeout(reinstall, 300); window.addEventListener("pageshow", reinstall, {passive:true}); }catch(_){ }

  globalThis.EUCALCULIA_V8_RUNTIME = Object.freeze({
    patch:PATCH_ID, version:VERSION, start, validateSpec, esc,
    active:() => epOf(stateRef()?.trialInfo),
    installed:() => ({...installed})
  });
})();
/* V8.1 EPISODE RUNTIME:END */
