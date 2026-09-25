/* V8.4 INTENSIVE N-BACK:START
   Intensive, adaptive, multi-stream N-back built from Eucalculia's own codes.

   Paradigm (Jaeggi et al. 2008, extended in the Brain Workshop tradition, not limited to "dual"):
   - A run is 20 + N timed trials (3 s or more each: the stimulus, then a blank interval). Responses
     are made DURING the stream on a pad with one button per stream (keys A S D F · J K L).
     No button = "no match".
   - Six targets per stream per run, plus lures (N−1 / N+1 matches, the same number where a
     relation is asked, reversed steps), so familiarity is not enough: the lag must be kept.
   - Jaeggi rule per run and per stream: fewer than 3 errors in every stream → N+1; more than 5
     in any stream → N−1. N goes up to 12.
   Streams (codes):
     place   a square on a 3×3 grid (visuospatial)
     number  a quantity 1–9 in any Eucalculia representation; a match is the same NUMBER, usually in a
             different form, so it must be matched on quantity, not appearance
     form    the representation itself (dice, ten-frame, tally…), whatever number it shows
     colour  the square's colour
     sound   one of 8 notes (only when sound is on)
     rel     a cued relation to the number N back: 2 more · adds to 10 (mirror around 5) ·
             same even/odd · double (comparison, opposition, class, multiplicative comparison)
     step    meta-relation: the change from 2N back → N back repeats from N back → now
     cross   cross-code: the number now equals the PLACE number N back (squares 1–9 in reading order)
   Modes unlock one another: single → dual → triple and relational → quad, cross-code and
   meta-relational → relational quad and penta. Each mode keeps its own N. Blocks rotate between
   the two frontier modes and interleave the others (consolidation plus switching).
   Dose: three introduction runs inside ordinary blocks, then Auto gives N-back the opening stretch
   of every other block (10 runs) until the daily dose is met (20 runs ≈ 25–35 min, the size of
   one Jaeggi session). CONFIG.v8NbackDailyRuns / v8NbackRunsPerBlock / v8NbackBlockSpacing.
*/
(function installV8NBack(){
  "use strict";
  if(globalThis.EUCALCULIA_V8_NBACK) return;
  const coord = globalThis.EUCALCULIA_V8_COORDINATOR, runtime = globalThis.EUCALCULIA_V8_RUNTIME;
  if(!coord || !runtime) return;
  const PATCH_ID = "v8.4-nback-intensive", VERSION = "8.4.2", FAMILY = "nback_intensive", AXIS = "nback";
  const esc = runtime.esc;
  const int = (rng, n) => Math.floor(rng() * n) % Math.max(1, n);
  const pick = (rng, a) => a[int(rng, a.length)];
  const shuffle = (rng, a) => { const b = a.slice(); for(let i = b.length - 1; i > 0; i--){ const j = int(rng, i + 1); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
  const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.trunc(Number(v) || lo)));
  const cfg = (k, d) => { try{ const v = Number(globalThis.CONFIG?.[k]); return Number.isFinite(v) && v >= 0 ? v : d; }catch(_){ return d; } };

  const N_MAX = 12, BASE_TRIALS = 20, TARGETS = 6, LURES = 3, UP_ERR = 3, DOWN_ERR = 5, INTRO_RUNS = 3, SCHEMA = 2;

  // ---- streams, relations, modes -------------------------------------------------------------
  const STREAMS = {
    place: {key:"a", label:"PLACE",   col:"PLC",  rule:n => `the square is in the SAME PLACE as ${n} back`},
    cross: {key:"s", label:"PLACE→#", col:"P→#",  rule:n => `the NUMBER now equals the PLACE number ${n} back (squares 1–9 in reading order)`},
    step:  {key:"d", label:"STEP",    col:"STEP", rule:n => `the CHANGE repeats: from ${2*n} back to ${n} back it changed by the same amount as from ${n} back to now`},
    colour:{key:"f", label:"COLOUR",  col:"COL",  rule:n => `the square is the SAME COLOUR as ${n} back`},
    form:  {key:"j", label:"FORM",    col:"FRM",  rule:n => `the number is drawn in the SAME FORM as ${n} back (dice, tally, ten-frame…), whatever the number`},
    sound: {key:"k", label:"SOUND",   col:"SND",  rule:n => `you hear the SAME NOTE as ${n} back`},
    number:{key:"l", label:"NUMBER",  col:"NUM",  rule:n => `it is the SAME NUMBER as ${n} back, in any form`},
    rel:   {key:"l", label:"RELATION",col:"REL",  rule:(n, R) => R.rule(n)}
  };
  const PAD_ORDER = ["place","cross","step","colour","form","sound","number","rel"];   // = keyboard order A S D F J K L
  const RELATIONS = {
    plus2: {btn:"+2",      frame:"comparison",     test:(c, b) => c === b + 2,  rule:n => `the number is 2 MORE than the number ${n} back`},
    mirror:{btn:"SUM 10",  frame:"opposition",     test:(c, b) => c + b === 10, rule:n => `the number and the number ${n} back ADD UP TO 10 (mirror images around 5)`},
    parity:{btn:"EVEN/ODD",frame:"hierarchy",      test:(c, b) => c % 2 === b % 2, rule:n => `the number is the SAME TYPE (both even or both odd) as the number ${n} back`},
    double:{btn:"×2",      frame:"comparison_mult",test:(c, b) => c === 2 * b,  rule:n => `the number is DOUBLE the number ${n} back`}
  };
  const MODES = [
    {id:"S",  name:"Single",          streams:["place"],                                 start:1, unlock:null},
    {id:"D",  name:"Dual",            streams:["place","number"],                        start:1, unlock:{S:3}},
    {id:"T",  name:"Triple",          streams:["place","number","sound"],                start:2, unlock:{D:3}},
    {id:"R",  name:"Relational",      streams:["place","rel"],                           start:1, unlock:{D:3}},
    {id:"Q",  name:"Quad",            streams:["place","number","colour","sound"],       start:2, unlock:{T:3}},
    {id:"X",  name:"Cross-code",      streams:["place","number","cross"],                start:2, unlock:{D:4, R:2}},
    {id:"M",  name:"Meta-relational", streams:["place","number","step"],                 start:2, unlock:{R:3}},
    {id:"RQ", name:"Relational quad", streams:["place","rel","colour","sound"],          start:2, unlock:{Q:3, R:3}},
    {id:"P",  name:"Penta",           streams:["place","number","form","colour","sound"],start:2, unlock:{Q:4}}
  ];
  const MODE_BY_ID = Object.fromEntries(MODES.map(m => [m.id, m]));
  const SUBSTITUTES = ["colour","form","cross","step"];   // used, in order, when a stream is unavailable
  const COLOURS = [["#ff5a5f","red"],["#ff9f1c","orange"],["#ffd23f","yellow"],["#3ddc84","green"],["#17c3b2","teal"],["#3a86ff","blue"],["#9b5de5","violet"],["#f15bb5","pink"]];
  const NOTES = [[523.25,"C"],[587.33,"D"],[659.25,"E"],[698.46,"F"],[783.99,"G"],[880.00,"A"],[987.77,"B"],[1046.50,"C′"]];
  // Forms that stay legible at grid-cell size within a sub-second exposure (checked with
  // harness/glyph_sheet.mjs). Dice/cube are 3-D, abacus/card/clock too fine, coins need arithmetic,
  // grid would nest a grid inside the grid.
  const FORM_SET = ["dots","ten","tally","finger","roman","cluster"];
  const FORM_NAME = {dots:"dots", dice:"dice", ten:"ten-frame", tally:"tally", finger:"fingers", domino:"domino", roman:"roman", abacus:"abacus", clock:"clock", coins:"coins", cluster:"cluster", card:"card", cube:"cubes", grid:"grid", digit:"digit"};
  const NUMBER_SHOWN = new Set(["number","rel","step","cross","form"]);
  const DROP_ORDER = ["cross","step","rel","number"];

  function allowed(rep, v){ try{ return typeof hardAllowedReps === "function" ? hardAllowedReps(v).includes(rep) : ["dots","dice"].includes(rep); }catch(_){ return rep === "dots"; } }
  function repsFor(v){ try{ return typeof hardAllowedReps === "function" ? hardAllowedReps(v).filter(r => r !== "digit") : ["dots"]; }catch(_){ return ["dots"]; } }
  function formPool(){ return FORM_SET.filter(f => [1,2,3,4,5,6,7,8,9].every(v => allowed(f, v))); }
  function glyph(rep, value, seed){ try{ return typeof relRefReferenceGlyphSVG === "function" ? relRefReferenceGlyphSVG({rep, value, seed}) : ""; }catch(_){ return ""; } }
  function soundOn(){
    try{
      const st = globalThis.State;
      if(!st || !st.soundEnabled) return false;
      if(globalThis.CONFIG && (CONFIG.noEffectsMode || CONFIG.safeMode)) return false;
      if(!(globalThis.AudioContext || globalThis.webkitAudioContext)) return false;
      return typeof AudioFX !== "undefined" && typeof AudioFX.tone === "function";
    }catch(_){ return false; }
  }
  function playNote(idx){
    try{ const ctx = AudioFX.ensure(); if(!ctx) return; AudioFX.tone(NOTES[idx][0], ctx.currentTime + 0.01, 0.42, "triangle", 0.6); }catch(_){ }
  }
  function streamsOf(mode, opts){
    const out = [];
    for(const s of mode.streams){
      let use = s;
      if(s === "sound" && !opts.sound) use = null;
      if(s === "form" && !opts.forms) use = null;
      if(!use){ use = SUBSTITUTES.find(x => !mode.streams.includes(x) && !out.includes(x) && (x !== "form" || opts.forms)) || null; }
      if(use && !out.includes(use)) out.push(use);
    }
    return out;
  }

  // ---- ground truth ----------------------------------------------------------------------------
  // One definition of "match" and "lure" per stream, used both to build and to score.
  function evalStream(s, i, seq, n, R){
    const {P, V, F, C, S} = seq;
    const idLag = (X) => {
      if(i < n) return null;
      const match = X[i] === X[i - n];
      const lure = !match && ((n >= 2 && X[i] === X[i - n + 1]) || (i - n - 1 >= 0 && X[i] === X[i - n - 1]));
      return {match, lure};
    };
    switch(s){
      case "place": return idLag(P);
      case "colour": return idLag(C);
      case "sound": return idLag(S);
      case "form": return idLag(F);
      case "number": return idLag(V);
      case "rel": {
        if(i < n) return null;
        const match = R.test(V[i], V[i - n]);
        const lure = !match && (V[i] === V[i - n] || (n >= 2 && R.test(V[i], V[i - n + 1])) || (i - n - 1 >= 0 && R.test(V[i], V[i - n - 1])));
        return {match, lure};
      }
      case "step": {
        if(i < 2 * n) return null;
        const d1 = V[i - n] - V[i - 2 * n], d2 = V[i] - V[i - n];
        const match = d1 === d2;
        const lure = !match && d1 !== 0 && d2 === -d1;              // same size, reversed direction
        return {match, lure};
      }
      case "cross": {
        if(i < n) return null;
        const match = V[i] === P[i - n] + 1;
        const lure = !match && ((n >= 2 && V[i] === P[i - n + 1] + 1) || (i - n - 1 >= 0 && V[i] === P[i - n - 1] + 1));
        return {match, lure};
      }
    }
    return null;
  }
  const startOf = (s, n) => s === "step" ? 2 * n : n;

  // ---- sequence construction ---------------------------------------------------------------------
  function chooseIdentity(rng, X, i, n, domain, state){
    const back = i >= n ? X[i - n] : undefined;
    const lureVals = new Set();
    if(n >= 2 && i - n + 1 >= 0) lureVals.add(X[i - n + 1]);
    if(i - n - 1 >= 0) lureVals.add(X[i - n - 1]);
    if(back !== undefined) lureVals.delete(back);
    let pool;
    if(state === "T" && back !== undefined) pool = [back];
    else if(state === "L" && lureVals.size) pool = [...lureVals];
    else if(back !== undefined){ pool = domain.filter(v => v !== back && !lureVals.has(v)); if(!pool.length) pool = domain.filter(v => v !== back); }
    else pool = domain.slice();
    if(pool.length > 1 && i >= 1 && state !== "T" && state !== "L"){ const p2 = pool.filter(v => v !== X[i - 1]); if(p2.length) pool = p2; }
    return pick(rng, pool);
  }
  function fill(rng, cfgRun){
    const {n, streams, plan, cells, len, R, forms, showsNumber} = cfgRun;
    const has = s => streams.includes(s);
    const seq = {P:[], V:[], F:[], C:[], S:[]};
    const numStreams = ["number","rel","step","cross"].filter(has);
    for(let i = 0; i < len; i++){
      seq.P[i] = chooseIdentity(rng, seq.P, i, n, cells, plan.place ? plan.place[i] : "-");
      seq.C[i] = has("colour") ? chooseIdentity(rng, seq.C, i, n, [0,1,2,3,4,5,6,7], plan.colour[i]) : null;
      seq.S[i] = has("sound") ? chooseIdentity(rng, seq.S, i, n, [0,1,2,3,4,5,6,7], plan.sound[i]) : null;
      if(!showsNumber){ seq.V[i] = null; seq.F[i] = null; continue; }
      // The number must satisfy every number-based stream at once; relax softly, never silently:
      // the key is always recomputed from the final sequence.
      // Relaxation levels: 0 strict · 1 plain non-targets may be lures · 2 lures may be plain ·
      // 3–6 targets are given up one stream at a time (cross, step, rel, number).
      const formT = has("form") && plan.form[i] === "T" && i >= n ? seq.F[i - n] : null;
      // Lookahead one lag: a target planned at i+N (e.g. a STEP, a relation or PLACE→NUMBER) must stay
      // reachable with a number 1–9 that does not also trip the other number streams planned as non-targets.
      const ahead = i + n;
      const needAhead = ahead < len ? numStreams.filter(s => plan[s][ahead] === "T") : [];
      const lureAhead = ahead < len ? numStreams.filter(s => plan[s][ahead] === "L" && s === "step") : [];
      const avoidAhead = ahead < len ? numStreams.filter(s => plan[s][ahead] === "N" || plan[s][ahead] === "L") : [];
      const lookaheadOk = (withLures) => {
        const lures = withLures ? lureAhead : [];
        if(!needAhead.length && !lures.length) return true;
        let ok = false;
        for(let u = 1; u <= 9 && !ok; u++){
          if(!forms.some(f => allowed(f, u))) continue;
          seq.V[ahead] = u;
          if(needAhead.every(s => { const r = evalStream(s, ahead, seq, n, R); return r && r.match; })
            && lures.every(s => { const r = evalStream(s, ahead, seq, n, R); return r && r.lure; })
            && avoidAhead.every(s => { const r = evalStream(s, ahead, seq, n, R); return !r || !r.match; })) ok = true;
        }
        seq.V[ahead] = undefined;
        return ok;
      };
      const tryLevel = (level) => {
        const dropped = new Set(level >= 3 ? DROP_ORDER.slice(0, level - 2) : []);
        const out = [];
        for(let v = 1; v <= 9; v++){
          if(formT && level < 3 && !allowed(formT, v)) continue;
          if(!forms.some(f => allowed(f, v))) continue;
          seq.V[i] = v;
          if(level < 3 && !lookaheadOk(level < 2)) continue;
          let ok = true;
          for(const s of numStreams){
            const st = plan[s][i]; if(st === "-") continue;
            const r = evalStream(s, i, seq, n, R); if(!r) continue;
            if(st === "T" && !dropped.has(s)){ if(!r.match){ ok = false; break; } }
            else if(st === "L" && level < 2){ if(!r.lure){ ok = false; break; } }
            else if(st === "N" && level < 1){ if(r.match || r.lure){ ok = false; break; } }
            else if(r.match){ ok = false; break; }
          }
          if(ok) out.push(v);
        }
        return out;
      };
      let cands = [];
      for(let level = 0; level <= 6 && !cands.length; level++) cands = tryLevel(level);
      if(!cands.length) cands = [1,2,3,4,5,6,7,8,9].filter(v => forms.some(f => allowed(f, v)));
      if(cands.length > 1 && i >= 1){ const c2 = cands.filter(v => v !== seq.V[i - 1]); if(c2.length) cands = c2; }
      seq.V[i] = pick(rng, cands);
      // Form: its own stream, or (without one) chosen so that a NUMBER match is almost never the same
      // picture and a same-picture item is often a different number (appearance lures).
      const v = seq.V[i];
      const vf = forms.filter(f => allowed(f, v));
      if(has("form")){
        const back = i >= n ? seq.F[i - n] : undefined;
        const lureVals = new Set(); if(n >= 2 && i - n + 1 >= 0) lureVals.add(seq.F[i - n + 1]); if(i - n - 1 >= 0) lureVals.add(seq.F[i - n - 1]); if(back !== undefined) lureVals.delete(back);
        const st = plan.form[i];
        let pool;
        if(st === "T" && back !== undefined && vf.includes(back)) pool = [back];
        else if(st === "L" && [...lureVals].some(x => vf.includes(x))) pool = [...lureVals].filter(x => vf.includes(x));
        else if(back !== undefined){ pool = vf.filter(f => f !== back && !lureVals.has(f)); if(!pool.length) pool = vf.filter(f => f !== back); }
        else pool = vf.slice();
        if(!pool.length) pool = vf.slice();
        seq.F[i] = pick(rng, pool);
      } else {
        const back = i >= n ? seq.F[i - n] : undefined, backV = i >= n ? seq.V[i - n] : undefined;
        let pool = vf;
        if(back !== undefined && v === backV){ const p2 = vf.filter(f => f !== back); if(p2.length) pool = p2; }
        else if(back !== undefined && vf.includes(back) && rng() < 0.35) pool = [back];
        seq.F[i] = pick(rng, pool);
      }
    }
    return seq;
  }
  function makeRun(rng, {n, streams, relation, forms}){
    const R = relation ? RELATIONS[relation] : null;
    const has = s => streams.includes(s);
    const cells = has("cross") ? [0,1,2,3,4,5,6,7,8] : [0,1,2,3,5,6,7,8];
    const len = BASE_TRIALS + n * (has("step") ? 2 : 1);
    const showsNumber = streams.some(s => NUMBER_SHOWN.has(s));
    let best = null;
    // Derived number streams are planned first; NUMBER / RELATION targets then avoid their target
    // positions (a STEP or PLACE→NUMBER target that is also an identity target would be degenerate).
    const planOrder = streams.slice().sort((a, b) => (["step","cross"].includes(b) ? 1 : 0) - (["step","cross"].includes(a) ? 1 : 0));
    for(let attempt = 0; attempt < 60; attempt++){
      const plan = {};
      for(const s of planOrder){
        const taken = new Set();
        if(s === "number" || s === "rel") for(const d of ["step","cross"]) if(plan[d]) plan[d].forEach((x, i) => { if(x === "T" || (d === "step" && x === "L")) taken.add(i); });
        const pos = []; for(let i = startOf(s, n); i < len; i++) pos.push(i);
        const sh = shuffle(rng, pos).sort((a, b) => (taken.has(a) ? 1 : 0) - (taken.has(b) ? 1 : 0));
        const nT = Math.min(TARGETS, Math.round(pos.length * 0.3));
        const nL = Math.min(LURES, Math.floor(pos.length * 0.15));
        plan[s] = new Array(len).fill("-");
        pos.forEach(i => { plan[s][i] = "N"; });
        sh.slice(0, nT).forEach(i => { plan[s][i] = "T"; });
        sh.slice(nT, nT + nL).forEach(i => { plan[s][i] = "L"; });
      }
      const seq = fill(rng, {n, streams, plan, cells, len, R, forms, showsNumber});
      const truth = {}, lure = {};
      let dev = 0, ok = true;
      for(const s of streams){
        truth[s] = []; lure[s] = [];
        for(let i = 0; i < len; i++){ const r = evalStream(s, i, seq, n, R); truth[s][i] = r ? r.match : null; lure[s][i] = r ? r.lure : null; }
        const got = truth[s].filter(x => x === true).length, want = plan[s].filter(x => x === "T").length;
        dev += Math.abs(got - want);
        if(Math.abs(got - want) > 1 || got < Math.min(4, want)) ok = false;
      }
      const run = {seq, truth, lure, len, cells, attempts:attempt + 1, relation, plan};
      if(ok) return run;
      if(!best || dev < best.dev) best = {...run, dev};
    }
    return null;
  }

  // ---- adaptive state --------------------------------------------------------------------------
  function stateOf(axisState){
    const a = axisState || {custom:{}};
    const c = a.custom || (a.custom = {});
    if(c.schema !== SCHEMA){
      const keep = c.lastOwned;
      for(const k of Object.keys(c)) delete c[k];
      Object.assign(c, {schema:SCHEMA, n:{S:1}, best:{}, unlocked:["S"], runs:0, modeRuns:{}, daily:{date:"", runs:0, ms:0}, hist:[], ownedBlocks:0, lastOwned:keep || null, blockPrimary:null});
    }
    c.n = c.n || {S:1}; c.best = c.best || {}; c.unlocked = Array.isArray(c.unlocked) && c.unlocked.length ? c.unlocked : ["S"];
    c.modeRuns = c.modeRuns || {}; c.daily = c.daily || {date:"", runs:0, ms:0}; c.hist = Array.isArray(c.hist) ? c.hist.slice(-60) : [];
    c.tempo = c.tempo || {};
    for(const id of c.unlocked) if(!Number.isFinite(c.n[id])) c.n[id] = MODE_BY_ID[id]?.start || 1;
    return c;
  }
  function refreshUnlocks(c){
    const fresh = [];
    for(const m of MODES){
      if(c.unlocked.includes(m.id) || !m.unlock) continue;
      if(Object.entries(m.unlock).every(([id, need]) => (c.n[id] || 0) >= need)){ c.unlocked.push(m.id); c.n[m.id] = m.start; fresh.push(m.id); }
    }
    return fresh;
  }
  const retired = (c, id) => id === "S" && (c.n.D || 0) >= 2;
  function frontierOf(c){ const live = c.unlocked.filter(id => !retired(c, id)); return live.slice(-2); }
  function frontierN(c){ const ids = c.unlocked.filter(id => !retired(c, id)); return Math.max(1, ...ids.map(id => c.n[id] || 1)); }
  function chooseMode(ctx, c){
    if(ctx.variant && MODE_BY_ID[ctx.variant]) return MODE_BY_ID[ctx.variant];
    const avail = c.unlocked.filter(id => !retired(c, id)).map(id => MODE_BY_ID[id]).filter(Boolean);
    if(!avail.length) return MODES[0];
    const run = ctx.context?.ownerRun, runs = ctx.context?.ownerRuns, block = ctx.context?.blockOrdinal;
    const front = frontierOf(c);
    // The block's primary mode rotates between the two frontier modes, one block each.
    let primaryId = front[front.length - 1];
    if(Number.isFinite(runs) && runs > 0){
      if(!c.blockPrimary || c.blockPrimary.block !== block || c.blockPrimary.session !== ctx.context?.session){
        primaryId = front[(c.ownedBlocks || 0) % front.length];
        c.blockPrimary = {block, session:ctx.context?.session ?? null, mode:primaryId};
        c.ownedBlocks = (c.ownedBlocks || 0) + 1;
      } else primaryId = c.blockPrimary.mode;
    }
    const primary = MODE_BY_ID[primaryId] || avail[avail.length - 1];
    if(!(Number.isFinite(runs) && runs > 0) || run < Math.ceil(runs * 0.6)) return primary;
    // Interleaved tail: other unlocked modes, weighted toward the player's least flexible ones.
    const others = avail.filter(m => m !== primary);
    if(!others.length) return primary;
    const fw = typeof ctx.featureWeight === "function" ? ctx.featureWeight : () => 1;
    const w = others.map(m => fw(`nback.mode:${m.id}`) * (front.includes(m.id) ? 1.4 : 1));
    let r = ctx.rng() * w.reduce((x, y) => x + y, 0);
    for(let i = 0; i < others.length; i++){ r -= w[i]; if(r <= 0) return others[i]; }
    return others[others.length - 1];
  }
  function chooseRelation(ctx, n){
    if(ctx.relationOverride && RELATIONS[ctx.relationOverride]) return ctx.relationOverride;
    const ids = Object.keys(RELATIONS).filter(id => id !== "double" || n >= 2);
    const fw = typeof ctx.featureWeight === "function" ? ctx.featureWeight : () => 1;
    const w = ids.map(id => fw(`nback.relation:${id}`));
    let r = ctx.rng() * w.reduce((x, y) => x + y, 0);
    for(let i = 0; i < ids.length; i++){ r -= w[i]; if(r <= 0) return ids[i]; }
    return ids[0];
  }
  function timingFor(streams){
    const comp = streams.filter(s => s === "rel" || s === "step" || s === "cross").length;
    const trialMs = Math.min(4500, 3000 + 250 * Math.max(0, streams.length - 2) + 400 * comp);
    const stimMs = streams.some(s => NUMBER_SHOWN.has(s)) ? 900 : 500;
    return {trialMs, stimMs};
  }
  function errorsByStream(answers, streams){
    const e = Object.fromEntries(streams.map(s => [s, {hit:0, miss:0, fa:0, cr:0, lureFa:0, lures:0}]));
    for(const a of answers || []){
      const m = a.meta || {}, truth = m.truth || {}, said = m.said || {}, lure = m.lure || {};
      for(const s of streams){
        if(truth[s] === null || truth[s] === undefined) continue;
        const row = e[s]; const t = !!truth[s], y = !!said[s];
        if(lure[s]) row.lures++;
        if(t && y) row.hit++; else if(t && !y) row.miss++; else if(!t && y){ row.fa++; if(lure[s]) row.lureFa++; } else row.cr++;
      }
    }
    return e;
  }
  const verdictOf = (e, streams) => { const errs = streams.map(s => e[s].miss + e[s].fa); return {errs, up:errs.every(x => x < UP_ERR), down:errs.some(x => x > DOWN_ERR)}; };

  // ---- rendering ---------------------------------------------------------------------------------
  function gridSvg(run, i, lit, opts){
    const {seq, cells} = run;
    const showNums = opts.cellNumbers;
    let body = "";
    for(let c = 0; c < 9; c++){
      const x = (c % 3) * 100 + 6, y = Math.floor(c / 3) * 100 + 6;
      const on = lit && seq.P[i] === c;
      const usable = cells.includes(c);
      const col = on && seq.C[i] !== null && seq.C[i] !== undefined ? COLOURS[seq.C[i]][0] : null;
      const cls = on ? "v8-nb-cell v8-nb-on" : usable ? "v8-nb-cell" : "v8-nb-cell v8-nb-off";
      body += `<rect x="${x}" y="${y}" width="88" height="88" rx="12" class="${cls}"${col ? ` style="fill:${col}33;stroke:${col}"` : ""}/>`;
      if(showNums && usable) body += `<text x="${x + 10}" y="${y + 20}" class="v8-nb-cellnum">${c + 1}</text>`;
    }
    if(lit && opts.glyphs && opts.glyphs[i]){
      const c = seq.P[i], x = (c % 3) * 100 + 6, y = Math.floor(c / 3) * 100 + 6;
      body += opts.glyphs[i].replace(/<svg[^>]*>/, `<svg x="${x + 4}" y="${y + 4}" width="80" height="80" viewBox="0 0 132 132">`);
    } else if(lit && !opts.glyphs){
      const c = seq.P[i], x = (c % 3) * 100 + 6, y = Math.floor(c / 3) * 100 + 6;
      body += `<rect x="${x + 22}" y="${y + 22}" width="44" height="44" rx="8" class="v8-nb-block"/>`;
    }
    return `<svg class="v8-nb-grid" viewBox="0 0 306 306" role="img" aria-label="${lit ? `square ${seq.P[i] + 1}` : "grid"}">${body}</svg>`;
  }
  function hud(meta, i){ return `<div class="v8-nb-hud"><span>${esc(meta.modeName.toUpperCase())} · ${meta.n}-BACK</span><span>${i >= 0 ? `${i + 1} / ${meta.len}` : ""}</span></div>`; }
  function stageHtml(meta, inner, i){ return `<div class="v8-live v8-nb-live">${hud(meta, i)}<div class="v8-nb-stage">${inner}</div></div>`; }
  function keyChip(s){ return `<span class="v8-key">${esc(STREAMS[s].key.toUpperCase())}</span>`; }
  function btnLabel(s, R){ return s === "rel" ? R.btn : STREAMS[s].label; }
  function readyHtml(meta){
    const R = meta.relation ? RELATIONS[meta.relation] : null;
    const rows = meta.streams.map(s => `<li><b>${esc(btnLabel(s, R))}</b> ${keyChip(s)} — press when ${esc(STREAMS[s].rule(meta.n, R))}.</li>`).join("");
    const dose = meta.dose ? `<div class="v8-nb-dose">${esc(meta.dose)}</div>` : "";
    return `<div class="v8-live v8-nb-live v8-nb-ready">
      <div class="v8-counter">N-BACK · ${esc(meta.modeName.toUpperCase())}${meta.fresh ? " · NEW" : ""}</div>
      <div class="v8-nb-big">${meta.n}-back</div>
      <ul class="v8-nb-rules">${rows}</ul>
      <div class="v8-nb-note">${esc(meta.len)} items, one every ${(meta.trialMs / 1000).toFixed(1)} s. Compare each item with the one exactly ${meta.n} step${meta.n > 1 ? "s" : ""} back. Press while the stream runs; no press = no match.${meta.feedback ? " Buttons flash green / red / amber after each item while you learn." : ""}</div>
      ${dose}
      <div class="v8-nb-start">Press SPACE or tap START</div>
    </div>`;
  }
  function padHtml(meta, ready){
    if(ready) return `<div class="v8-live-pad" data-count="1"><button type="button" class="v8-live-btn v8-live-start" data-act="start"><b>START</b><span class="v8-key">SPACE</span></button></div>`;
    const R = meta.relation ? RELATIONS[meta.relation] : null;
    const order = PAD_ORDER.filter(s => meta.streams.includes(s));
    return `<div class="v8-live-pad" data-count="${order.length}">${order.map(s => `<button type="button" class="v8-live-btn" data-stream="${s}" aria-label="${esc(btnLabel(s, R))} match (key ${STREAMS[s].key.toUpperCase()})"><b>${esc(btnLabel(s, R))}</b><span class="v8-key">${esc(STREAMS[s].key.toUpperCase())}</span></button>`).join("")}</div>`;
  }

  // ---- the live stream ----------------------------------------------------------------------------
  function mountRun(run, meta){
    return function mount(api){
      const S = {phase:"ready", i:-1, trialStart:0, lit:false, pausedAt:0, readyUntil:0, resumeAt:0, presses:{}, records:[], t0:0, activeMs:0, timer:null};
      const keyMap = Object.fromEntries(meta.streams.map(s => [STREAMS[s].key, s]));
      api.setSurface(readyHtml(meta));
      if(api.panel){ api.panel.innerHTML = padHtml(meta, true); api.panel.addEventListener("pointerdown", onPointer); api.panel.addEventListener("click", onClick); }
      api.prompt("READY"); api.answer("—");
      function btn(s){ return api.panel ? api.panel.querySelector(`[data-stream="${s}"]`) : null; }
      function start(){
        if(S.phase !== "ready") return;
        S.phase = "getready"; S.readyUntil = api.clock() + 900; S.resumeAt = 0; S.t0 = api.clock();
        if(api.panel) api.panel.innerHTML = padHtml(meta, false);
        api.setSurface(stageHtml(meta, gridSvg(run, 0, false, meta.render) + `<div class="v8-nb-getready">GET READY</div>`, -1));
        api.prompt(`${meta.n}-BACK`);
        later();
      }
      function press(s){
        if(S.phase !== "run" || S.i < 0) return;
        if(S.i < startOf(s, meta.n)) return;
        if(S.presses[s] !== undefined) return;
        S.presses[s] = Math.max(0, Math.round(api.clock() - S.trialStart));
        const b = btn(s); if(b) b.classList.add("v8-pressed");
      }
      function onPointer(e){
        const b = e.target && e.target.closest ? e.target.closest("button") : null; if(!b) return;
        e.preventDefault();
        if(b.dataset.act === "start") start(); else if(b.dataset.stream) press(b.dataset.stream);
      }
      function onClick(e){
        // Keyboard-activated clicks only (pointer presses were handled on pointerdown).
        if(e.detail !== 0) return;
        const b = e.target && e.target.closest ? e.target.closest("button") : null; if(!b) return;
        if(b.dataset.act === "start") start(); else if(b.dataset.stream) press(b.dataset.stream);
      }
      function onKey(e){
        const k = String(e.key || "").toLowerCase();
        if(S.phase === "ready"){ if(k === " " || k === "enter" || e.code === "Space"){ if(!e.repeat) start(); return true; } return false; }
        if(keyMap[k]){ if(!e.repeat) press(keyMap[k]); return true; }
        if(k === " " || e.code === "Space" || k === "enter") return true;   // swallow: no stray core actions mid-stream
        return false;
      }
      function openTrial(i, at){
        S.i = i; S.trialStart = at; S.lit = true; S.presses = {};
        if(api.panel) api.panel.querySelectorAll(".v8-live-btn").forEach(b => b.classList.remove("v8-pressed"));
        if(meta.feedback) setTimeout(() => { if(api.panel) api.panel.querySelectorAll(".v8-live-btn").forEach(b => b.classList.remove("v8-fb-hit","v8-fb-fa","v8-fb-miss")); }, 480);
        api.setSurface(stageHtml(meta, gridSvg(run, i, true, meta.render), i));
        api.answer(String(i + 1));
        if(meta.streams.includes("sound") && run.seq.S[i] !== null) playNote(run.seq.S[i]);
      }
      function closeTrial(i){
        const truth = {}, said = {}, lure = {}, outcome = {};
        let any = false, allOk = true, firstRt = null;
        for(const s of meta.streams){
          const t = run.truth[s][i];
          if(t === null || t === undefined) continue;
          any = true;
          const y = S.presses[s] !== undefined;
          truth[s] = !!t; said[s] = y; lure[s] = !!run.lure[s][i];
          outcome[s] = t && y ? "hit" : t ? "miss" : y ? "fa" : "cr";
          if(outcome[s] === "miss" || outcome[s] === "fa") allOk = false;
          if(y) firstRt = firstRt === null ? S.presses[s] : Math.min(firstRt, S.presses[s]);
          if(meta.feedback && outcome[s] !== "cr"){ const b = btn(s); if(b) b.classList.add(outcome[s] === "hit" ? "v8-fb-hit" : outcome[s] === "fa" ? "v8-fb-fa" : "v8-fb-miss"); }
        }
        if(!any) return;
        S.records.push({id:`t${i}`, value:said, correct:allOk, rt:firstRt ?? meta.trialMs, expected:truth, kind:"nback_trial", meta:{i, truth, said, lure, outcome, rt:{...S.presses}}});
      }
      function end(){
        S.phase = "done";
        if(S.timer){ clearTimeout(S.timer); S.timer = null; }
        api.finish(S.records, {activeMs:Math.round(meta.len * meta.trialMs), wallMs:Math.round(api.clock() - S.t0), mode:meta.mode, n:meta.n});
      }
      function later(){ if(S.phase !== "done") S.timer = setTimeout(tick, 20); }
      function tick(){
        S.timer = null;
        if(!api.live()){ S.phase = "done"; return; }
        api.assert();
        const t = api.clock();
        if(S.phase === "ready" || S.phase === "done") return;
        if(api.paused()){
          if(!S.pausedAt){ S.pausedAt = t; api.setSurface(stageHtml(meta, gridSvg(run, 0, false, meta.render) + `<div class="v8-nb-getready">PAUSED</div>`, S.i)); }
          return later();
        }
        if(S.pausedAt){
          // Resume: the interrupted item is shown again from its onset after a short ready.
          S.pausedAt = 0; S.phase = "getready"; S.readyUntil = t + 1200; S.resumeAt = Math.max(0, S.i);
          api.setSurface(stageHtml(meta, gridSvg(run, 0, false, meta.render) + `<div class="v8-nb-getready">GET READY</div>`, S.i));
          return later();
        }
        if(S.phase === "getready"){ if(t >= S.readyUntil){ S.phase = "run"; openTrial(S.resumeAt, t); } return later(); }
        const el = t - S.trialStart;
        if(S.lit && el >= meta.stimMs){ S.lit = false; api.setSurface(stageHtml(meta, gridSvg(run, S.i, false, meta.render), S.i)); }
        if(el >= meta.trialMs){
          closeTrial(S.i);
          if(S.i + 1 >= meta.len) return end();
          // Keep the rhythm exact; after a stall (throttled timers) restart the clock instead of skipping items.
          const next = el > meta.trialMs + 400 ? t : S.trialStart + meta.trialMs;
          openTrial(S.i + 1, next);
        }
        later();
      }
      return {onKey, state:S};
    };
  }

  // ---- build ---------------------------------------------------------------------------------
  function build(ctx){
    const axisState = ctx.axisState || {custom:{}};
    const c = stateOf(axisState);
    const rng = ctx.rng;
    const mode = chooseMode(ctx, c);
    const forms = formPool();
    const sound = ctx.soundOverride !== undefined ? !!ctx.soundOverride : soundOn();
    const streams = streamsOf(mode, {sound, forms:forms.length >= 4});
    const forced = !!ctx.levelForced;
    const n = forced ? clampN(ctx.level, 1, N_MAX) : clampN(c.n[mode.id] || mode.start, 1, N_MAX);
    const relation = streams.includes("rel") ? chooseRelation(ctx, n) : null;
    // Without a FORM stream the number still changes form (cross-format matching); with fewer than
    // two legible forms enabled, fall back to whatever the player's representations allow.
    const displayForms = forms.length >= 2 ? forms : (repsFor(5).length ? [...new Set([1,2,3,4,5,6,7,8,9].flatMap(v => repsFor(v)))] : ["dots"]);
    const run = makeRun(rng, {n, streams, relation, forms:displayForms});
    if(!run) return null;
    // Tempo: accuracy moves N (Jaeggi); speed moves the pace. A clean, fast run shortens the trial by
    // 5 % (down to 75 % of the base), a demoted run gives the time back — like the original's ET.
    const base = timingFor(streams), tempo = forced ? 1 : Math.max(0.75, Math.min(1, Number(c.tempo[mode.id]) || 1));
    const stimMs = base.stimMs, trialMs = Math.max(stimMs + 1500, Math.round(base.trialMs * tempo));
    const showsNumber = streams.some(s => NUMBER_SHOWN.has(s));
    const glyphs = showsNumber ? run.seq.V.map((v, i) => glyph(run.seq.F[i], v, 7000 + i * 13 + n)) : null;
    const modeRuns = c.modeRuns[mode.id] || 0;
    const feedback = mode.id === "S" || (mode.id === "D" && n <= 2) || modeRuns < 2;
    const cellNumbers = streams.includes("cross") && (n <= 2 || modeRuns < 2);
    const daily = c.daily && c.daily.date === ctx.today ? c.daily.runs : 0;
    const target = cfg("v8NbackDailyRuns", 20);
    const own = ctx.context && Number.isFinite(ctx.context.ownerRuns) ? `Run ${ctx.context.ownerRun + 1} of ${ctx.context.ownerRuns} in this block · ` : "";
    const meta = {mode:mode.id, modeName:mode.name, n, streams, relation, len:run.len, trialMs, stimMs, feedback, fresh:modeRuns === 0 && mode.id !== "S",
      dose:`${own}today ${daily} of ${target} runs`, render:{glyphs, cellNumbers}};
    const R = relation ? RELATIONS[relation] : null;
    const features = {[`nback.mode:${mode.id}`]:true, [`nback.n:${n}`]:true, [`nback.streams:${streams.length}`]:true};
    for(const s of streams) features[`nback.stream:${s}`] = true;
    if(relation){ features[`nback.relation:${relation}`] = true; features[`nback.frame:${R.frame}`] = true; }
    const title = `${mode.name} ${n}-back`;
    const steps = [
      {type:"frame", html:`<div class="v8-frame v8-nb-title"><div class="v8-counter">N-BACK · ${esc(mode.name.toUpperCase())}</div><div class="v8-premise">${n}-back</div><div class="v8-muted">${esc(streams.map(s => btnLabel(s, R)).join(" · "))}</div></div>`, ms:1100, label:"N-BACK", prompt:"N-BACK"},
      {type:"live", html:readyHtml(meta), label:"N-BACK", prompt:"READY", question:title, mount:mountRun(run, meta), aria:`${title}: respond to each item`}
    ];
    const spec = {
      family:FAMILY, catId:`nback_${mode.id}_${n}`, contentSpecId:"v8.nback.intensive", label:"N-BACK",
      title, summaryQuestion:`${title} (${streams.map(s => btnLabel(s, R)).join(", ")})`,
      steps, features,
      frameTags:["working_memory_update","n_back", streams.length > 1 ? "multi_stream" : "single_stream"].concat(relation ? ["relational_n_back"] : [], streams.includes("step") ? ["meta_relational_n_back"] : [], streams.includes("cross") ? ["cross_code_binding"] : []),
      executiveTags:["working_memory_update","interference_control","binding","sustained_attention"],
      mechanismTags:["n_back_updating","timed_stream"].concat(relation ? ["relation_to_retained_item"] : []),
      demandVector:{working_memory:Math.min(5, n), updating:5, binding:Math.min(5, streams.length), relational:(relation ? 2 : 0) + (streams.includes("step") ? 3 : 0) + (streams.includes("cross") ? 2 : 0)},
      score:answers => !verdictOf(errorsByStream(answers, streams), streams).down,
      nback:{mode:mode.id, n, streams, relation, len:run.len, trialMs, stimMs, cells:run.cells, forced, feedback,
        seq:{P:run.seq.P.slice(), V:run.seq.V.slice(), F:run.seq.F.slice(), C:run.seq.C.slice(), S:run.seq.S.slice()},
        truth:run.truth, lure:run.lure, attempts:run.attempts},
      review:(result) => reviewFor(meta, run, result)
    };
    return spec;
  }

  // ---- review ------------------------------------------------------------------------------------
  function reviewFor(meta, run, result){
    const answers = result.answers || [];
    const e = errorsByStream(answers, meta.streams);
    const v = verdictOf(e, meta.streams);
    const R = meta.relation ? RELATIONS[meta.relation] : null;
    const byId = Object.fromEntries(answers.map(a => [a.id, a]));
    const order = PAD_ORDER.filter(s => meta.streams.includes(s));
    const showsNumber = meta.streams.some(s => NUMBER_SHOWN.has(s));
    const mark = {hit:["✓","v8-nb-hit"], miss:["○","v8-nb-miss"], fa:["✗","v8-nb-fa"], cr:["·","v8-nb-cr"]};
    const rows = [];
    for(let i = 0; i < run.len; i++){
      const a = byId[`t${i}`], out = a?.meta?.outcome || {};
      const cellsHtml = order.map(s => {
        const t = run.truth[s][i]; if(t === null || t === undefined) return "<td></td>";
        const o = out[s] || (t ? "miss" : "cr"); const [sym, cls] = mark[o];
        return `<td class="${cls}${run.lure[s][i] ? " v8-nb-lure" : ""}">${sym}</td>`;
      }).join("");
      const bad = order.some(s => out[s] === "miss" || out[s] === "fa");
      const col = run.seq.C[i] !== null && run.seq.C[i] !== undefined ? `<span class="v8-nb-sw" style="background:${COLOURS[run.seq.C[i]][0]}"></span>` : "";
      const note = run.seq.S[i] !== null && run.seq.S[i] !== undefined ? NOTES[run.seq.S[i]][1] : "";
      rows.push(`<tr class="${bad ? "v8-nb-bad" : ""}"><td>${i + 1}</td><td>${run.seq.P[i] + 1}</td>${showsNumber ? `<td>${run.seq.V[i]}</td><td>${esc(FORM_NAME[run.seq.F[i]] || run.seq.F[i] || "")}</td>` : ""}${meta.streams.includes("colour") ? `<td>${col}</td>` : ""}${meta.streams.includes("sound") ? `<td>${esc(note)}</td>` : ""}${cellsHtml}</tr>`);
    }
    const head = `<tr><th>#</th><th>sq</th>${showsNumber ? "<th>n</th><th>form</th>" : ""}${meta.streams.includes("colour") ? "<th>col</th>" : ""}${meta.streams.includes("sound") ? "<th>note</th>" : ""}${order.map(s => `<th class="v8-nb-sh">${esc(s === "rel" ? R.btn : STREAMS[s].col)}</th>`).join("")}</tr>`;
    const table = `<table class="v8-nb-table">${head}${rows.join("")}</table>`;
    const legend = `<div class="v8-muted v8-nb-legend">✓ match caught · ○ match missed · ✗ pressed without a match · · correctly left · underlined = lure</div>`;
    const summ = order.map(s => `${btnLabel(s, R)}: ${e[s].hit} caught, ${e[s].miss} missed, ${e[s].fa} false alarm${e[s].fa === 1 ? "" : "s"}`).join(" · ");
    const nextN = v.up ? Math.min(N_MAX, meta.n + 1) : v.down ? Math.max(1, meta.n - 1) : meta.n;
    const lureFa = order.reduce((x, s) => x + e[s].lureFa, 0), fa = order.reduce((x, s) => x + e[s].fa, 0);
    const reasons = [summ, `Next ${meta.modeName} run: ${nextN}-back (${v.up ? "up: fewer than 3 errors in every stream" : v.down ? "down: more than 5 errors in a stream" : "same level"}).`];
    if(fa && lureFa) reasons.push(`${lureFa} of your ${fa} false alarm${fa === 1 ? " was a lure" : "s were lures"}: items that matched ${meta.n > 1 ? `${meta.n - 1} or ` : ""}${meta.n + 1} back${R ? ", or the same number where the relation was asked" : ""}. A lure error means the place in the sequence slipped, not the item.`);
    if(R) reasons.push(`RELATION: a match means ${R.rule(meta.n)}; equality is not enough.`);
    if(meta.streams.includes("step")) reasons.push(`STEP compares two changes: (${meta.n} back − ${2 * meta.n} back) and (now − ${meta.n} back). A reversed step (up 2, then down 2) is a lure.`);
    if(meta.streams.includes("cross")) reasons.push("PLACE→NUMBER: the squares are numbered 1 2 3 / 4 5 6 / 7 8 9; a match is a number equal to the square's number N back.");
    if(meta.streams.includes("number") && !meta.streams.includes("form")) reasons.push("NUMBER is about quantity: the same number in a different form is a match; the same picture showing a different number is not.");
    return {title:"", question:`${meta.modeName} ${meta.n}-back · ${order.map(s => btnLabel(s, R)).join(", ")}`,
      userAnswer:order.map((s, k) => `${btnLabel(s, R)} ${v.errs[meta.streams.indexOf(s)]} error${v.errs[meta.streams.indexOf(s)] === 1 ? "" : "s"}`).join(" · "),
      correctAnswer:"At most 5 errors per stream holds the level; fewer than 3 in every stream moves N up",
      reasons, html:`<div class="v8-review v8-review-nb"><section><h4>RUN</h4>${table}${legend}</section></div>`};
  }

  // ---- adaptation, dose ---------------------------------------------------------------------------
  function onResult(result, axisState, info){
    const nb = info?.v8Episode?.spec?.nback; if(!nb) return;
    const c = stateOf(axisState);
    const e = errorsByStream(result.answers, nb.streams), v = verdictOf(e, nb.streams);
    const today = coord.today ? coord.today() : "";
    const before = c.n[nb.mode];
    if(!nb.forced && c.unlocked.includes(nb.mode)){
      if(v.up) c.n[nb.mode] = Math.min(N_MAX, nb.n + 1);
      else if(v.down) c.n[nb.mode] = Math.max(1, nb.n - 1);
      else c.n[nb.mode] = nb.n;
      if(v.up) c.best[nb.mode] = Math.max(c.best[nb.mode] || 0, nb.n);
      const hitRts = [];
      for(const a of result.answers || []) for(const s of nb.streams) if(a.meta?.outcome?.[s] === "hit" && Number.isFinite(a.meta?.rt?.[s])) hitRts.push(a.meta.rt[s]);
      hitRts.sort((x, y) => x - y);
      const medHit = hitRts.length ? hitRts[Math.floor(hitRts.length / 2)] : null;
      const t0 = Number(c.tempo[nb.mode]) || 1;
      if(v.up && medHit !== null && medHit < 0.45 * nb.trialMs) c.tempo[nb.mode] = Math.max(0.75, +(t0 * 0.95).toFixed(3));
      else if(v.down) c.tempo[nb.mode] = Math.min(1, +(t0 * 1.05).toFixed(3));
    }
    c.runs++; c.modeRuns[nb.mode] = (c.modeRuns[nb.mode] || 0) + 1;
    if(c.daily.date !== today) c.daily = {date:today, runs:0, ms:0};
    c.daily.runs++; c.daily.ms += Number(result.extra?.activeMs) || nb.len * nb.trialMs;
    const fresh = refreshUnlocks(c);
    c.hist.push({t:Date.now(), mode:nb.mode, n:nb.n, errs:Object.fromEntries(nb.streams.map((s, k) => [s, v.errs[k]])), up:v.up, down:v.down, lureFa:nb.streams.reduce((x, s) => x + e[s].lureFa, 0), unlocked:fresh});
    c.hist = c.hist.slice(-60);
    axisState.win.push(v.up ? 1 : 0); axisState.win = axisState.win.slice(-8);
    if(!nb.forced && v.up && c.n[nb.mode] > (before || 0)) axisState.promotions++;
    if(!nb.forced && v.down) axisState.demotions++;
    axisState.level = frontierN(c);
  }
  function blockDemand(axisState, ctx){
    const c = stateOf(axisState);
    if(c.runs < INTRO_RUNS) return 0;
    const target = cfg("v8NbackDailyRuns", 20), per = cfg("v8NbackRunsPerBlock", 10), spacing = Math.max(1, cfg("v8NbackBlockSpacing", 2));
    const done = c.daily && c.daily.date === ctx.today ? c.daily.runs : 0;
    if(done >= target || per <= 0) return 0;
    const lo = c.lastOwned;
    if(lo && lo.session === ctx.session && ctx.blockOrdinal - lo.block < spacing) return 0;
    return Math.min(per, target - done);
  }

  coord.register({axis:AXIS, family:FAMILY, label:"N-BACK", maxLevel:N_MAX, build, onResult, blockDemand,
    // Ordinary slots only carry the three introduction runs; after that N-back lives in its own blocks.
    weight:(axes, a) => stateOf(a).runs < INTRO_RUNS ? 1.6 : 0,
    prereq:() => true});

  // ---- audit ---------------------------------------------------------------------------------------
  function oracle(nb){
    // Independent re-derivation of every key from the stored sequence.
    const {P, V, F, C, S} = nb.seq, n = nb.n, out = {};
    const R = nb.relation ? RELATIONS[nb.relation] : null;
    for(const s of nb.streams){
      out[s] = [];
      for(let i = 0; i < nb.len; i++){
        let m = null;
        if(s === "step"){ if(i >= 2 * n) m = (V[i] - V[i - n]) === (V[i - n] - V[i - 2 * n]); }
        else if(i >= n){
          if(s === "place") m = P[i] === P[i - n];
          else if(s === "number") m = V[i] === V[i - n];
          else if(s === "form") m = F[i] === F[i - n];
          else if(s === "colour") m = C[i] === C[i - n];
          else if(s === "sound") m = S[i] === S[i - n];
          else if(s === "rel") m = R.test(V[i], V[i - n]);
          else if(s === "cross") m = V[i] === P[i - n] + 1;
        }
        out[s].push(m);
      }
    }
    return out;
  }
  function runAudit(options={}){
    const blockers = [], warnings = [], stats = {};
    const per = Math.max(2, Math.min(40, Number(options.per) || 6));
    const Ns = options.ns || [1,2,3,4,5,6,8,10,12];
    const H = coord._test.hash32, M = coord._test.mulberry;
    // Unlock graph: every mode is reachable from Single.
    { const c = {n:{S:N_MAX}, unlocked:["S"]}; for(let k = 0; k < 20; k++){ for(const m of MODES){ if(!c.unlocked.includes(m.id) && m.unlock && Object.entries(m.unlock).every(([id, need]) => (c.n[id] || 0) >= need)){ c.unlocked.push(m.id); c.n[m.id] = N_MAX; } } }
      const missing = MODES.filter(m => !c.unlocked.includes(m.id)).map(m => m.id); if(missing.length) blockers.push(`unreachable modes: ${missing.join(",")}`); }
    for(const mode of MODES){
      for(const sound of mode.streams.includes("sound") ? [true, false] : [true]){
        const row = {runs:0, targetRate:{}, lures:{}, zeroStep:0, stepTargets:0, sameFormNumberMatch:0, numberMatches:0, attempts:0, maxAttempts:0, trialMs:null, streams:null};
        for(const n of Ns){
          for(let k = 0; k < per; k++){
            const seed = H(`nb|${mode.id}|${n}|${sound}|${k}`);
            const spec = build({level:n, levelForced:true, variant:mode.id, rng:M(seed), seed, axisState:{custom:{}}, soundOverride:sound, featureWeight:() => 1, today:"audit"});
            const tag = `${mode.id}${sound ? "" : "(no sound)"} N${n}#${k}`;
            if(!spec){ blockers.push(`${tag}: no run`); continue; }
            const errs = runtime.validateSpec(spec); if(errs.length) blockers.push(`${tag}: ${errs.slice(0, 3).join("; ")}`);
            const nb = spec.nback; row.runs++; row.streams = nb.streams.join("+"); row.trialMs = nb.trialMs;
            row.attempts += nb.attempts; row.maxAttempts = Math.max(row.maxAttempts, nb.attempts);
            const keys = nb.streams.map(s => STREAMS[s].key); if(new Set(keys).size !== keys.length) blockers.push(`${tag}: duplicate keys ${keys.join("")}`);
            if(nb.streams.length > 5) blockers.push(`${tag}: ${nb.streams.length} streams`);
            if(!sound && nb.streams.includes("sound")) blockers.push(`${tag}: sound stream while sound is off`);
            if(nb.streams.includes("cross") && nb.cells.length !== 9) blockers.push(`${tag}: cross-code needs 9 squares`);
            if(nb.trialMs < 2000 || nb.trialMs > 4500 || nb.stimMs + 1500 > nb.trialMs) blockers.push(`${tag}: timing ${nb.stimMs}/${nb.trialMs}`);
            if(nb.len !== BASE_TRIALS + n * (nb.streams.includes("step") ? 2 : 1)) blockers.push(`${tag}: length ${nb.len}`);
            const or = oracle(nb);
            for(const s of nb.streams){
              for(let i = 0; i < nb.len; i++) if(or[s][i] !== nb.truth[s][i]) { blockers.push(`${tag}: key ${s}@${i}`); break; }
              const t = nb.truth[s].filter(x => x === true).length, sc = nb.truth[s].filter(x => x !== null).length;
              const want = Math.min(TARGETS, Math.round(sc * 0.3));
              if(Math.abs(t - want) > 1) blockers.push(`${tag}: ${s} targets ${t}/${want}`);
              if(sc < 8) warnings.push(`${tag}: ${s} only ${sc} scorable items`);
              row.targetRate[s] = (row.targetRate[s] || 0) + t / Math.max(1, sc);
              row.lures[s] = (row.lures[s] || 0) + nb.lure[s].filter(Boolean).length;
            }
            const {P, V, F} = nb.seq;
            for(let i = 0; i < nb.len; i++){
              if(!nb.cells.includes(P[i])) blockers.push(`${tag}: square ${P[i]} outside the grid`);
              if(V[i] !== null){ if(!(V[i] >= 1 && V[i] <= 9)) blockers.push(`${tag}: number ${V[i]}`); if(!allowed(F[i], V[i])) blockers.push(`${tag}: ${F[i]} cannot show ${V[i]}`); }
              if(nb.streams.includes("number") && i >= n && V[i] === V[i - n]){ row.numberMatches++; if(F[i] === F[i - n] && !nb.streams.includes("form")) row.sameFormNumberMatch++; }
              if(nb.streams.includes("step") && nb.truth.step[i] === true){ row.stepTargets++; if(V[i] === V[i - n]) row.zeroStep++; }
            }
            const html = spec.steps.map(s => s.html || "").join("");
            if(/\bNaN\b|\bundefined\b|\bnull\b/.test(html)) blockers.push(`${tag}: NaN/undefined/null in html`);
            // Scoring sanity: the perfect responder is promoted; the lag-slipping responder is not.
            const perfect = [], slipped = [];
            for(let i = 0; i < nb.len; i++){
              const truth = {}, said = {}, lure = {}, said2 = {};
              let any = false;
              for(const s of nb.streams){ const t = nb.truth[s][i]; if(t === null) continue; any = true; truth[s] = t; said[s] = t; lure[s] = nb.lure[s][i]; said2[s] = t || nb.lure[s][i]; }
              if(any){ perfect.push({meta:{truth, said, lure}}); slipped.push({meta:{truth, said:said2, lure}}); }
            }
            if(!verdictOf(errorsByStream(perfect, nb.streams), nb.streams).up) blockers.push(`${tag}: perfect run not promoted`);
            if(n >= 2 && verdictOf(errorsByStream(slipped, nb.streams), nb.streams).up) warnings.push(`${tag}: pressing on every lure still promotes`);
          }
        }
        for(const s of Object.keys(row.targetRate)){ row.targetRate[s] = +(row.targetRate[s] / Math.max(1, row.runs)).toFixed(3); row.lures[s] = +(row.lures[s] / Math.max(1, row.runs)).toFixed(2); }
        row.attempts = +(row.attempts / Math.max(1, row.runs)).toFixed(2);
        if(row.numberMatches && row.sameFormNumberMatch / row.numberMatches > 0.1) warnings.push(`${mode.id}: ${row.sameFormNumberMatch}/${row.numberMatches} NUMBER matches shown in the same form`);
        if(row.stepTargets && row.zeroStep / row.stepTargets > 0.05) warnings.push(`${mode.id}: ${row.zeroStep}/${row.stepTargets} STEP matches are "no change" (also identity matches)`);
        // A reversed step (same size, opposite direction) is structurally rarer than a lag lure.
        for(const s of Object.keys(row.lures)) if(row.lures[s] < (s === "step" ? 1.5 : 2)) warnings.push(`${mode.id}: ${s} averages ${row.lures[s]} lures per run`);
        if(row.maxAttempts > 30) warnings.push(`${mode.id}: up to ${row.maxAttempts} construction attempts`);
        stats[`${mode.id}${sound ? "" : "-nosound"}`] = row;
      }
    }
    return {patch:PATCH_ID, version:VERSION, status:blockers.length ? "BLOCK" : warnings.length ? "WARN" : "PASS", blockers:blockers.slice(0, 30), warnings:warnings.slice(0, 30), stats};
  }

  globalThis.EUCALCULIA_V8_NBACK = Object.freeze({patch:PATCH_ID, version:VERSION, family:FAMILY, axis:AXIS, modes:MODES.map(m => ({...m})), streams:Object.keys(STREAMS), relations:Object.keys(RELATIONS),
    build, runAudit, _test:Object.freeze({evalStream, makeRun, errorsByStream, verdictOf, stateOf, refreshUnlocks, blockDemand, chooseMode, streamsOf, timingFor})});
})();
/* V8.4 INTENSIVE N-BACK:END */
