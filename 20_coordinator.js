/* V8.2 AUTO COORDINATOR:START
   Schedules the v8 families inside ordinary Auto blocks, keeps one adaptive axis per family,
   persists per profile, and maintains a within-person flexibility profile.
   Pattern follows PH6.C5.R3.18 (spatial coordinator): reserved block slots, never inside a
   pending META memory chain, never on retries/forced levels, numeric D level untouched.
*/
(function installV8Coordinator(){
  "use strict";
  if(globalThis.EUCALCULIA_V8_COORDINATOR) return;
  const PATCH_ID = "v8.2-auto-coordinator";
  const VERSION = "8.2.0";
  const SCHEMA = 1;
  const MIN_BLOCK = 8;
  // Slot positions as a fraction of the block. The spatial coordinator uses ~0.20 and ~0.55.
  const SLOT_FRACTIONS = [0.35, 0.70, 0.90];
  const WINDOW = 8, UP_HITS = 7, DOWN_HITS = 4;         // the SPA-VER ladder rule, per axis
  const FEATURE_WINDOW = 24;

  const stateRef = () => { try{ return typeof State !== "undefined" ? State : globalThis.State; }catch(_){ return globalThis.State; } };
  const clampInt = (v, lo, hi, d=lo) => { const n = Number(v); return Math.max(lo, Math.min(hi, Number.isFinite(n) ? Math.trunc(n) : d)); };
  function hash32(value){ let h = 0x811c9dc5; for(const ch of String(value)){ h ^= ch.charCodeAt(0); h = Math.imul(h, 0x01000193); } return h >>> 0; }
  function mulberry(seed){ let a = seed >>> 0 || 0x9e3779b9; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function sessionSeed(){ try{ return String(globalThis.EUCALCULIA_SESSION_RNG_V1?.session?.().seed || ""); }catch(_){ return ""; } }
  function query(name){ try{ if(globalThis.__EUCALCULIA_PUBLIC_QUERY_POLICY__?.mode !== "LOCAL_QA") return null; return new URLSearchParams(location.search).get(name); }catch(_){ return null; } }

  // ---- registry ---------------------------------------------------------------------------
  const AXES = new Map();   // axis -> {axis, family, label, maxLevel, build, prereq, weight, onResult, window rule}
  function register(def){
    if(!def || !def.axis || typeof def.build !== "function") throw new Error("bad v8 axis");
    AXES.set(def.axis, {maxLevel:10, label:def.axis, ...def});
    ensureAxis(def.axis);
    return true;
  }

  // ---- persistence ------------------------------------------------------------------------
  let store = null, storeProfile = null;
  const keyFor = p => `EUCALCULIA_V8_P${p}`;
  function profileId(){ const st = stateRef(); return String((st && st.activeProfile) || 1); }
  function freshAxis(){ return {level:0, win:[], exposure:0, answered:0, correct:0, lastBlock:-1, promotions:0, demotions:0, custom:{}}; }
  function freshStore(){ return {schema:SCHEMA, version:VERSION, axes:{}, flex:{features:{}, totals:{n:0, c:0, rt:0}}, schedule:{blockOrdinal:-1, plan:[], served:[], servedTrials:[]}, history:[]}; }
  function load(){
    const p = profileId();
    if(store && storeProfile === p) return store;
    let raw = null;
    try{ raw = JSON.parse(localStorage.getItem(keyFor(p)) || "null"); }catch(_){ raw = null; }
    store = raw && raw.schema === SCHEMA ? raw : freshStore();
    store.axes = store.axes || {}; store.flex = store.flex || {features:{}, totals:{n:0,c:0,rt:0}};
    store.schedule = {blockOrdinal:-1, plan:[], served:[], servedTrials:[]};   // schedule is session-local
    store.history = Array.isArray(store.history) ? store.history.slice(-120) : [];
    storeProfile = p;
    for(const axis of AXES.keys()) ensureAxis(axis);
    return store;
  }
  function save(){ try{ if(store) localStorage.setItem(keyFor(storeProfile || profileId()), JSON.stringify({...store, schedule:undefined})); }catch(_){ } }
  function ensureAxis(axis){ const s = store || load(); if(!s.axes[axis] || typeof s.axes[axis] !== "object") s.axes[axis] = freshAxis(); const a = s.axes[axis]; a.win = Array.isArray(a.win) ? a.win.slice(-WINDOW) : []; a.custom = a.custom && typeof a.custom === "object" ? a.custom : {}; a.level = clampInt(a.level, 0, AXES.get(axis)?.maxLevel ?? 20, 0); return a; }

  // ---- flexibility profile (within-person contingency) -------------------------------------
  // For every feature key an item carries (e.g. "rft.frame:opposition", "rft.indeterminate",
  // "rft.cue:arbitrary", "nback.n:3", "switch:frame"), keep a rolling window of correctness and
  // RT. Contingency = feature accuracy − the player's overall v8 accuracy (negative = the
  // player's performance drops when this feature is present → a rigidity target).
  function noteFeatures(features, correct, rt){
    const s = load(); const f = s.flex;
    f.totals.n++; f.totals.c += correct ? 1 : 0; f.totals.rt += Math.max(0, Number(rt) || 0);
    for(const key of Object.keys(features || {})){
      if(!features[key]) continue;
      const row = f.features[key] || (f.features[key] = {w:[], rt:[]});
      row.w.push(correct ? 1 : 0); row.w = row.w.slice(-FEATURE_WINDOW);
      if(Number.isFinite(Number(rt))) { row.rt.push(Math.round(Number(rt))); row.rt = row.rt.slice(-FEATURE_WINDOW); }
    }
  }
  function flexibilityProfile(prefix=""){
    const s = load(), f = s.flex, base = f.totals.n ? f.totals.c / f.totals.n : 0.5;
    const out = {};
    for(const [key, row] of Object.entries(f.features)){
      if(prefix && !key.startsWith(prefix)) continue;
      const n = row.w.length; if(!n) continue;
      const acc = row.w.reduce((a,b)=>a+b,0) / n;
      const rt = row.rt.length ? row.rt.reduce((a,b)=>a+b,0) / row.rt.length : null;
      out[key] = {n, acc:+acc.toFixed(3), contingency:+(acc - base).toFixed(3), meanRt:rt ? Math.round(rt) : null};
    }
    return {baseline:+base.toFixed(3), features:out};
  }
  // Weight for sampling a feature: features where the player's accuracy falls below their own
  // baseline are boosted (bounded) so training goes where responding is least flexible.
  function featureWeight(key){
    const row = load().flex.features[key]; if(!row || row.w.length < 4) return 1.15;   // novelty bonus
    const acc = row.w.reduce((a,b)=>a+b,0) / row.w.length, base = load().flex.totals.n ? load().flex.totals.c / load().flex.totals.n : 0.5;
    return Math.max(0.6, Math.min(2.2, 1 + (base - acc) * 2.5));
  }

  // ---- scheduling -------------------------------------------------------------------------
  function metaMemoryPending(){
    try{ const plans = typeof ensureMetaMemoryPlans === "function" ? ensureMetaMemoryPlans() : null; if(plans && Object.values(plans).some(p => p && (p.active || p.due || p.pending))) return true; }catch(_){ }
    try{ if(typeof shouldExtendBlockForMetaMemory === "function" && shouldExtendBlockForMetaMemory()) return true; }catch(_){ }
    return false;
  }
  function eligibleContext(attempt, forcedLevel){
    const st = stateRef();
    if(!st || Number(attempt) !== 0 || (forcedLevel !== null && forcedLevel !== undefined)) return null;
    if(!st.running || st.paused || st.modeChoice !== "auto" || st.mode !== "D" || metaMemoryPending()) return null;
    if(globalThis.CONFIG && CONFIG.v8Enabled === false) return null;
    const blockSize = clampInt(st.blockSize, 1, 200, 20); if(blockSize < MIN_BLOCK) return null;
    return {blockOrdinal:Math.max(0, clampInt(st.rngBlockOrdinal, 0, 0x7fffffff, 0)), blockTrial:Math.max(0, clampInt(st.blockTrials, 0, 10000, 0)), blockSize};
  }
  function slotsForBlock(){
    // Dose: two v8 episodes per eligible block for a beginner, three once any axis is established.
    const s = load();
    const established = Object.values(s.axes).some(a => a.level >= 3 && a.answered >= 8);
    const cfg = Number(globalThis.CONFIG?.v8SlotsPerBlock);
    return Number.isFinite(cfg) && cfg >= 0 ? Math.min(3, cfg) : (established ? 3 : 2);
  }
  function spatialServedTrials(){ try{ return globalThis.EUCALCULIA_SPATIAL_AUTO_COORDINATOR?.snapshot?.().schedule?.servedTrials || []; }catch(_){ return []; } }
  // Dedicated blocks: an axis with blockDemand() (the intensive N-back) may own the opening
  // trials of a block — one episode per trial, back to back — while its daily dose is unmet.
  // An owned block carries no other v8 slots; its remaining trials are ordinary Auto trials.
  function today(){ try{ const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }catch(_){ return "0000-00-00"; } }
  function ownerFor(ctx){
    const s = load(), session = sessionSeed(), wanting = [];
    for(const def of eligibleAxes()){
      if(typeof def.blockDemand !== "function") continue;
      let runs = 0;
      try{ runs = clampInt(def.blockDemand(ensureAxis(def.axis), {...ctx, today:today(), session, axes:s.axes}), 0, 40, 0); }catch(_){ runs = 0; }
      runs = Math.min(runs, Math.max(0, ctx.blockSize - 2));
      if(runs > 0){ const lo = ensureAxis(def.axis).custom.lastOwned; wanting.push({axis:def.axis, runs, served:0, last:lo && lo.session === session ? lo.block : -1}); }
    }
    // Round robin: the axis that owned a block least recently in this session goes first.
    wanting.sort((a, b) => a.last - b.last);
    return wanting.length ? {axis:wanting[0].axis, runs:wanting[0].runs, served:0} : null;
  }
  function planFor(ctx){
    const s = load(), sch = s.schedule;
    if(sch.blockOrdinal !== ctx.blockOrdinal){
      sch.blockOrdinal = ctx.blockOrdinal; sch.served = []; sch.servedTrials = [];
      sch.owner = ctxAllowsOwner(ctx) ? ownerFor(ctx) : null;
      const n = sch.owner ? 0 : slotsForBlock();
      sch.plan = SLOT_FRACTIONS.slice(0, n).map(f => Math.max(2, Math.round(ctx.blockSize * f)));
      if(sch.owner){ const a = ensureAxis(sch.owner.axis); a.custom.lastOwned = {session:sessionSeed(), block:ctx.blockOrdinal}; save(); }
    }
    return sch;
  }
  // Ownership is decided at the start of a block only (not when the plan is first built mid-block).
  function ctxAllowsOwner(ctx){ return ctx.blockTrial <= 1; }
  function eligibleAxes(){
    const s = load(), out = [];
    for(const def of AXES.values()){
      const a = ensureAxis(def.axis);
      if(typeof def.prereq === "function" && !def.prereq(s.axes, a)) continue;
      if(globalThis.CONFIG && CONFIG[`v8${def.axis[0].toUpperCase()}${def.axis.slice(1)}Enabled`] === false) continue;
      out.push(def);
    }
    return out;
  }
  function chooseAxis(ctx, slot){
    const s = load(), sch = s.schedule, pool = eligibleAxes();
    if(!pool.length) return null;
    const rng = mulberry(hash32(`${sessionSeed()}|v8|${ctx.blockOrdinal}|${slot}|choose`));
    const weights = pool.map(def => {
      const a = s.axes[def.axis];
      let w = typeof def.weight === "function" ? Math.max(0, def.weight(s.axes, a)) : 1;
      if(sch.served.includes(def.axis)) w *= 0.25;                 // variety inside a block
      w *= 1 + Math.min(3, Math.max(0, ctx.blockOrdinal - (a.lastBlock ?? -1)) * 0.15);  // not seen for a while
      return w;
    });
    const total = weights.reduce((x,y)=>x+y,0); if(total <= 0) return null;
    let r = rng() * total;
    for(let i=0;i<pool.length;i++){ r -= weights[i]; if(r <= 0) return pool[i]; }
    return pool[pool.length-1];
  }
  function seedFor(axis, label="content"){
    const st = stateRef(), sch = load().schedule;
    return hash32(`${sessionSeed()}|v8|${clampInt(st?.rngBlockOrdinal,0,0x7fffffff,0)}|${sch.served.length}|${clampInt(st?.blockTrials,0,10000,0)}|${axis}|${label}|${load().axes[axis]?.exposure ?? 0}`);
  }
  function buildFor(def, ctx){
    const s = load(), a = ensureAxis(def.axis);
    const forcedLevel = ctx && Number.isFinite(ctx.auditLevel) ? String(ctx.auditLevel) : query("v8level");
    const levelForced = forcedLevel !== null && forcedLevel !== "";
    const level = levelForced ? clampInt(forcedLevel, 0, def.maxLevel, a.level) : a.level;
    const qSeed = query("v8seed");
    const seed = qSeed !== null && qSeed !== "" ? (Number(qSeed) >>> 0) : seedFor(def.axis);
    const rng = mulberry(seed);
    for(let attempt = 0; attempt < 4; attempt++){
      let spec = null;
      try{ spec = def.build({level, levelForced, rng, seed:seed + attempt, axisState:a, axes:s.axes, featureWeight, flexibility:() => flexibilityProfile(def.axis + "."), context:ctx, variant:(ctx && ctx.auditVariant) || query("v8variant"), today:today()}); }
      catch(error){ try{ recordRuntimeError(error, {source:PATCH_ID + ".build", axis:def.axis}); }catch(_){ } spec = null; }
      if(spec){ spec.axis = def.axis; spec.level = level; spec.family = spec.family || def.family; spec.label = spec.label || def.label; return spec; }
    }
    return null;
  }
  function tryStart(attempt, forcedLevel){
    const runtime = globalThis.EUCALCULIA_V8_RUNTIME; if(!runtime) return false;
    const forcedAxis = query("v8");
    if(forcedAxis && AXES.has(forcedAxis)){
      const st = stateRef();
      if(!st || !st.running || st.paused || Number(attempt) !== 0 || (forcedLevel !== null && forcedLevel !== undefined)) return false;
      if(st._v8ForceConsumedAt === st.blockTrials) return false;
      const spec = buildFor(AXES.get(forcedAxis), {blockOrdinal:0, blockTrial:st.blockTrials, blockSize:st.blockSize, forced:true});
      if(spec && runtime.start(spec)){ st._v8ForceConsumedAt = st.blockTrials; notePresented(forcedAxis); return true; }
      return false;
    }
    const ctx = eligibleContext(attempt, forcedLevel); if(!ctx) return false;
    const sch = planFor(ctx);
    if(sch.owner && sch.owner.served < sch.owner.runs){
      const def = AXES.get(sch.owner.axis);
      if(def){
        const spec = buildFor(def, {...ctx, ownerRun:sch.owner.served, ownerRuns:sch.owner.runs, session:sessionSeed()});
        if(spec && runtime.start(spec)){
          sch.owner.served++; sch.served.push(def.axis); sch.servedTrials.push(ctx.blockTrial);
          notePresented(def.axis, ctx);
          return true;
        }
      }
      sch.owner.runs = sch.owner.served;   // a failed build ends the owned stretch
      return false;
    }
    const slot = sch.served.length; if(slot >= sch.plan.length) return false;
    if(ctx.blockTrial < sch.plan[slot]) return false;
    const prev = sch.servedTrials.at(-1); if(Number.isFinite(prev) && ctx.blockTrial - prev < 3) return false;
    if(spatialServedTrials().some(t => Math.abs(t - ctx.blockTrial) < 2)) return false;
    const def = chooseAxis(ctx, slot); if(!def) return false;
    const spec = buildFor(def, ctx); if(!spec) return false;
    if(!runtime.start(spec)) return false;
    sch.served.push(def.axis); sch.servedTrials.push(ctx.blockTrial);
    notePresented(def.axis, ctx);
    return true;
  }
  function notePresented(axis, ctx){ const a = ensureAxis(axis); a.exposure++; a.lastBlock = ctx ? ctx.blockOrdinal : a.lastBlock; }

  // ---- results ----------------------------------------------------------------------------
  const answered = new WeakSet();
  function noteResult(info){
    if(!info || info.kind !== "v8_episode" || answered.has(info) || !info.v8Result) return false;
    answered.add(info);
    const axis = info.v8Axis, def = AXES.get(axis); if(!def) return false;
    const a = ensureAxis(axis), r = info.v8Result, ok = !!r.compoundCorrect;
    a.answered++; a.correct += ok ? 1 : 0;
    const rt = r.answers.reduce((s,x)=>s+(Number(x.rt)||0),0);
    const before = a.level;
    if(typeof def.onResult === "function"){
      try{ def.onResult(r, a, info); }catch(_){ }
    } else {
      a.win.push(ok ? 1 : 0); a.win = a.win.slice(-WINDOW);
      if(a.win.length >= WINDOW){
        const hits = a.win.reduce((x,y)=>x+y,0);
        if(hits >= UP_HITS && a.level < def.maxLevel){ a.level++; a.win = []; a.promotions++; }
        else if(hits <= DOWN_HITS && a.level > 0){ a.level--; a.win = []; a.demotions++; }
      }
    }
    a.level = clampInt(a.level, 0, def.maxLevel, 0);
    // Flexibility: switch vs repeat of the relational frame between consecutive v8 items.
    const s = load(), last = s.history.at(-1), feats = {...(info.v8Features || {})};
    const frameKey = Object.keys(feats).find(k => /\.frame:/.test(k));
    if(last && frameKey){ feats[last.frameKey && last.frameKey !== frameKey ? "switch:frame" : "repeat:frame"] = true; }
    feats[`${axis}.any`] = true;
    noteFeatures(feats, ok, rt);
    s.history.push({t:Date.now(), axis, level:before, ok, rt, frameKey:frameKey || null, catId:info.catId});
    s.history = s.history.slice(-120);
    save();
    return true;
  }

  // ---- hooks ------------------------------------------------------------------------------
  let startWrapper = null, postWrapper = null;
  function installStartHook(){
    try{
      const prev = globalThis.maybeStartInlineGenerativeTrialAfterReset;
      if(typeof prev !== "function") return false;
      if(prev === startWrapper || prev.__eucaV8CoordDirect === prev) return true;
      const wrapped = function maybeStartInlineGenerativeTrialAfterResetV8(attempt, forcedLevel){
        let started = false;
        try{ started = tryStart(attempt, forcedLevel); }catch(error){ try{ recordRuntimeError(error, {source:PATCH_ID + ".start"}); }catch(_){ } started = false; }
        if(started) return true;
        return prev.apply(this, arguments);
      };
      wrapped.__eucaV8Coord = true; wrapped.__eucaV8CoordDirect = wrapped; wrapped.__eucaV8CoordOriginal = prev;
      startWrapper = wrapped; globalThis.maybeStartInlineGenerativeTrialAfterReset = wrapped;
      try{ maybeStartInlineGenerativeTrialAfterReset = wrapped; }catch(_){ }
      return true;
    }catch(_){ return false; }
  }
  function installPostHook(){
    try{
      const prev = globalThis.processInputPostAnswer;
      if(typeof prev !== "function") return false;
      if(prev === postWrapper || prev.__eucaV8CoordDirect === prev) return true;
      const wrapped = function processInputPostAnswerV8(ctx){
        try{ const info = ctx?.trialInfoRef || stateRef()?.trialInfo; if(info?.kind === "v8_episode") noteResult(info); }catch(_){ }
        return prev.apply(this, arguments);
      };
      wrapped.__eucaV8Coord = true; wrapped.__eucaV8CoordDirect = wrapped; wrapped.__eucaV8CoordOriginal = prev;
      postWrapper = wrapped; globalThis.processInputPostAnswer = wrapped;
      try{ processInputPostAnswer = wrapped; }catch(_){ }
      return true;
    }catch(_){ return false; }
  }
  const reinstall = () => { installStartHook(); installPostHook(); };
  reinstall();
  try{ queueMicrotask(reinstall); setTimeout(reinstall, 0); setTimeout(reinstall, 400); window.addEventListener("pageshow", reinstall, {passive:true}); }catch(_){ }

  function snapshot(){
    const s = load();
    const axes = {};
    for(const [k, v] of Object.entries(s.axes)){ const def = AXES.get(k); axes[k] = {level:v.level, maxLevel:def?.maxLevel ?? null, answered:v.answered, correct:v.correct, window:v.win.slice(), promotions:v.promotions, demotions:v.demotions, custom:v.custom}; }
    return {patch:PATCH_ID, version:VERSION, profile:storeProfile, slotsPerBlock:slotsForBlock(), schedule:{...s.schedule}, axes, flexibility:flexibilityProfile(), registered:[...AXES.keys()], hooks:{start:globalThis.maybeStartInlineGenerativeTrialAfterReset?.__eucaV8Coord === true || !!startWrapper, post:globalThis.processInputPostAnswer?.__eucaV8Coord === true || !!postWrapper}};
  }
  function reset(axis){ const s = load(); if(axis) s.axes[axis] = freshAxis(); else { store = freshStore(); for(const k of AXES.keys()) ensureAxis(k); } save(); return snapshot(); }

  globalThis.EUCALCULIA_V8_COORDINATOR = Object.freeze({
    patch:PATCH_ID, version:VERSION, register, snapshot, flexibilityProfile, featureWeight, noteResult, reset,
    buildNow:(axis, level, variant) => { const def = AXES.get(axis); if(!def) return null; const st = stateRef(); return buildFor(def, {blockOrdinal:0, blockTrial:st?.blockTrials || 0, blockSize:20, audit:true, auditLevel:Number.isFinite(level) ? level : undefined, auditVariant:variant || null}); },
    today,
    axes:() => [...AXES.values()].map(d => ({axis:d.axis, family:d.family, maxLevel:d.maxLevel, label:d.label})),
    _test:Object.freeze({hash32, mulberry, slotsForBlock, planFor, ownerFor, today})
  });
})();
/* V8.2 AUTO COORDINATOR:END */
