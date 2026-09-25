/* V8.5 RELATIONAL WEB SPRINTS:START
   Fluency training on a web of BASIC relations, the owner's first criterion: a complex web with a
   very large number of derivable relations, mastered, used flexibly, and fast.

   A web is a set of nonsense terms linked by the basic frames on ONE signed scale:
     SAME (a = b) · OPPOSITE (a = −b, the mirror around 0) · DIFFERENT (a ≠ b)
     MORE / LESS (a > b) · exact amounts (a − b = d)
   so the derived relations include the ones people miss, e.g. an OPPOSITE flips MORE and LESS.
   A sprint = study the web (self-paced), then 12–16 rapid questions across the whole web, each with a
   deadline. Questions switch frame, direction and format (YES/NO/CAN'T TELL, "how do they compare?",
   "same, opposite or neither?", exact amounts); at higher levels the web is hidden, grows across
   sprints, is written in arbitrary symbols, and the symbols' meaning in questions is switched mid-run.

   Adaptation follows the original game (accuracy first, speed second):
   - the deadline is a staircase like the exposure time (ET): a correct answer shortens it by 1–2
     steps depending on speed, an error or timeout lengthens it by 8 steps (≈ 85–89 % accuracy);
   - level up by fast-track (≥ 94 % and fast twice), by fluency plateau after real RT improvement
     against the player's own history (training to asymptote), or slow-but-accurate breadth;
   - level down only when accuracy collapses, or when accuracy AND speed regress together.
   Every answer comes from an exact arc-consistent search over integer models (checked against the
   brute-force oracle); every web uses fresh terms and a random structure, and a growing web keeps a
   ledger so no question is ever asked twice.
*/
(function installV8Web(){
  "use strict";
  if(globalThis.EUCALCULIA_V8_WEB) return;
  const coord = globalThis.EUCALCULIA_V8_COORDINATOR, runtime = globalThis.EUCALCULIA_V8_RUNTIME, relEngine = globalThis.EUCALCULIA_V8_RELATIONAL;
  if(!coord || !runtime || !relEngine || !relEngine._oracle) return;
  const O = relEngine._oracle;
  const holds = O.holds, BLACK = O.blacklist;
  const PATCH_ID = "v8.5-relational-web", VERSION = "8.5.0", FAMILY = "rft_web_fluency", AXIS = "web";
  const esc = runtime.esc;
  const int = (rng, n) => Math.floor(rng() * n) % Math.max(1, n);
  const pick = (rng, a) => a[int(rng, a.length)];
  const shuffle = (rng, a) => { const b = a.slice(); for(let i = b.length - 1; i > 0; i--){ const j = int(rng, i + 1); const t = b[i]; b[i] = b[j]; b[j] = t; } return b; };
  const cfg = (k, d) => { try{ const v = Number(globalThis.CONFIG?.[k]); return Number.isFinite(v) && v >= 0 ? v : d; }catch(_){ return d; } };
  const median = a => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); if(!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const quantile = (a, p) => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); if(!s.length) return null; const pos = p * (s.length - 1), lo = Math.floor(pos), hi = Math.ceil(pos); return s[lo] + (s[hi] - s[lo]) * (pos - lo); };

  // ---- levels ------------------------------------------------------------------------------------
  // kinds: eq neg neq gt lt amt · formats: yn (YES/NO[/CAN'T TELL]) · order · mirror · amt
  const LEVELS = [
    {K:3, kinds:["eq","neg"],                 formats:["yn"],                     visible:true,  twoWay:true, chain:true, Q:10, note:"SAME and OPPOSITE"},
    {K:4, kinds:["eq","neg","neq"],           formats:["yn"],                     visible:true,  Q:12, note:"+ DIFFERENT and CAN'T TELL"},
    {K:4, kinds:["gt","lt"],                  formats:["yn"],                     visible:true,  Q:12, note:"MORE and LESS"},
    {K:4, kinds:["eq","neg","gt","lt"],       formats:["yn"],                     visible:true,  Q:16, note:"one scale: SAME, OPPOSITE, MORE, LESS together"},
    {K:5, kinds:["eq","neg","gt","lt"],       formats:["yn"],                     visible:false, Q:16, note:"the web is hidden while you answer"},
    {K:5, kinds:["eq","neg","neq","gt","lt"], formats:["yn","order","mirror"],    visible:false, Q:16, note:"+ which relation? questions"},
    {K:5, kinds:["eq","neg","gt","lt","amt"], formats:["yn","order","amt"],       visible:false, Q:16, note:"+ exact amounts"},
    {K:6, kinds:["eq","neg","neq","gt","lt"], formats:["yn","order","mirror"],    visible:false, Q:16, grow:3, maxK:9,  showAll:true,  note:"a web that grows across sprints"},
    {K:6, kinds:["eq","neg","neq","gt","lt"], formats:["yn","order","mirror"],    visible:false, Q:16, grow:3, maxK:9,  showAll:true,  cued:true, note:"+ symbols instead of words"},
    {K:6, kinds:["eq","neg","neq","gt","lt","amt"], formats:["yn","order","mirror","amt"], visible:false, Q:16, grow:3, maxK:12, showAll:false, cued:true, note:"only the NEW links are shown"},
    {K:6, kinds:["eq","neg","neq","gt","lt"], formats:["yn","order","mirror"],    visible:false, Q:16, grow:3, maxK:12, showAll:false, cued:true, keyChange:true, note:"+ the symbols' meaning switches mid-sprint"},
    {K:7, kinds:["eq","neg","neq","gt","lt","amt"], formats:["yn","order","mirror","amt"], visible:false, Q:16, grow:3, maxK:12, showAll:false, cued:true, keyChange:true, extra:1, note:"+ loops in the web"}
  ];
  const MAX_LEVEL = LEVELS.length - 1;
  const COORD = new Set(["eq","neg","neq"]), CMP = new Set(["gt","lt","amt"]);
  // Reference RTs on the original's META scale (rtL1Fast 1.8 s … rtL3Good 9 s).
  const fastRT = L => 1600 + 250 * L;
  const goodRT = L => 3000 + 450 * L;
  const STEP = 0.015, PENALTY = 0.12;              // deadline staircase (fractions of the deadline)
  const dlStart = L => Math.round(goodRT(L) * 1.6), dlFloor = L => Math.round(fastRT(L) * 0.75), dlCeil = L => Math.round(goodRT(L) * 2.4);

  // ---- terms ----------------------------------------------------------------------------------------
  const CONS = "BDFGKLMNPRSTVZ", VOW = "AEIOU";
  function newTerms(rng, count, existing){
    const out = [], firsts = new Set(existing.map(w => w[0])), all = new Set(existing);
    for(let guard = 0; out.length < count && guard < 2000; guard++){
      const w = CONS[int(rng, CONS.length)] + VOW[int(rng, 5)] + CONS[int(rng, CONS.length)];
      if(BLACK.has(w) || firsts.has(w[0]) || w[0] === w[2] || all.has(w)) continue;
      out.push(w); firsts.add(w[0]); all.add(w);
    }
    return out.length === count ? out : null;
  }

  // ---- exact oracle: arc-consistent search over bounded integers ------------------------------------
  function negate(r){
    switch(r.k){
      case "eq": return {k:"neq"}; case "neq": return {k:"eq"};
      case "neg": return {k:"nneg"}; case "nneg": return {k:"neg"};
      case "gt": return {k:"le"}; case "lt": return {k:"ge"};
      case "le": return {k:"gt"}; case "ge": return {k:"lt"};
      case "diffd": return {k:"ndiffd", d:r.d}; case "ndiffd": return {k:"diffd", d:r.d};
    }
    return {k:"neq"};
  }
  // Search budget: a problem that exceeds it is reported as UNKNOWN (never guessed); callers skip it.
  const NODE_BUDGET = 60000;
  const UNKNOWN = Symbol("unknown");
  let slowLog = null;
  function solveWeb(n, cons, H){
    let nodes = 0;
    const dom = []; for(let v = 0; v <= H; v = v > 0 ? -v : -v + 1) dom.push(v);   // 0, 1, −1, 2, −2 … (small values first)
    const arcs = [], into = Array.from({length:n}, () => []);
    for(const c of cons){ const a1 = {i:c.a, j:c.b, c, fwd:true}, a2 = {i:c.b, j:c.a, c, fwd:false}; arcs.push(a1, a2); into[c.b].push(a1); into[c.a].push(a2); }
    // Branch on the 2-core first (terms on cycles, parallel links included): once it is assigned, the
    // rest of the network is a forest, and arc consistency makes a forest backtrack-free (Freuder 1982),
    // so the search never thrashes over terms that cannot matter.
    const deg = new Array(n).fill(0); for(const c of cons){ deg[c.a]++; deg[c.b]++; }
    const inCore = new Array(n).fill(true), stack = [];
    for(let v = 0; v < n; v++) if(deg[v] <= 1) stack.push(v);
    while(stack.length){ const v = stack.pop(); if(!inCore[v]) continue; inCore[v] = false; for(const c of cons){ const w = c.a === v ? c.b : c.b === v ? c.a : -1; if(w >= 0 && inCore[w] && --deg[w] <= 1) stack.push(w); } }
    const ok = (arc, vi, vj) => arc.fwd ? holds(arc.c, vi, vj) : holds(arc.c, vj, vi);
    function propagate(D, queue){
      while(queue.length){
        const arc = queue.pop(), di = D[arc.i], dj = D[arc.j];
        const keep = di.filter(vi => dj.some(vj => ok(arc, vi, vj)));
        if(keep.length !== di.length){ if(!keep.length) return false; D[arc.i] = keep; for(const b of into[arc.i]) queue.push(b); }
      }
      return true;
    }
    function search(D, depth){
      if(++nodes > NODE_BUDGET) throw UNKNOWN;
      let best = -1;
      for(let v = 0; v < n; v++) if(inCore[v] && D[v].length > 1 && (best < 0 || D[v].length < D[best].length)) best = v;
      if(best < 0) for(let v = 0; v < n; v++) if(D[v].length > 1 && (best < 0 || D[v].length < D[best].length)) best = v;
      if(best < 0){ const vals = D.map(d => d[0]); return cons.every(c => holds(c, vals[c.a], vals[c.b])) ? vals : null; }
      for(const x of D[best]){
        const D2 = D.slice(); D2[best] = [x];
        if(propagate(D2, into[best].slice())){ const r = search(D2, depth + 1); if(r) return r; }
      }
      return null;
    }
    const D = Array.from({length:n}, () => dom.slice());
    if(!propagate(D, arcs.slice())) return null;
    try{ return search(D, 0); }
    catch(e){ if(e !== UNKNOWN) throw e; if(!slowLog) slowLog = {n, H, cons:cons.map(c => ({...c}))}; return UNKNOWN; }
  }
  const sat = v => !!v && v !== UNKNOWN;
  function modalW(web, x, y, r){
    const n = web.terms.length;
    const yes = solveWeb(n, web.cons.concat([{...r, a:x, b:y}]), web.H);
    if(yes === UNKNOWN) return {status:"unknown"};
    if(!yes){ const m = solveWeb(n, web.cons, web.H); return {status:"no", model:m === UNKNOWN ? null : m, counter:null}; }
    const no = solveWeb(n, web.cons.concat([{...negate(r), a:x, b:y}]), web.H);
    if(no === UNKNOWN) return {status:"unknown"};
    if(!no) return {status:"yes", model:yes, counter:null};
    return {status:"cant", model:yes, counter:no};
  }
  const boundFor = (K, cons) => Math.max(6, K + 2 + cons.reduce((s, c) => s + (c.k === "diffd" ? Math.abs(c.d) : 0), 0));

  // ---- webs ------------------------------------------------------------------------------------------
  function relOf(rng, kind){
    if(kind === "amt"){ const d = 1 + int(rng, 3); return {k:"diffd", d:rng() < 0.5 ? d : -d}; }
    return {k:kind};
  }
  function addEdge(rng, web, a, b, kinds){
    // A new link must keep the web consistent; for a link between existing terms (a loop) prefer one
    // that adds information (CAN'T TELL before) over a redundant one.
    const order = shuffle(rng, kinds);
    let fallback = null;
    for(const kind of order){
      const r = relOf(rng, kind);
      const [p, q] = rng() < 0.5 ? [a, b] : [b, a];
      const c = {...r, a:p, b:q};
      const trial = {...web, cons:web.cons.concat([c])};
      trial.H = boundFor(trial.terms.length, trial.cons);
      if(!sat(solveWeb(trial.terms.length, trial.cons, trial.H))) continue;
      const m = modalW(web, p, q, r).status;
      if(m === "unknown") continue;
      if(m === "cant") return c;
      if(m === "yes" && !fallback) fallback = c;
    }
    return fallback;
  }
  function kindMixOk(web, kinds){
    const has = k => web.cons.some(c => (k === "amt" ? c.k === "diffd" : c.k === k));
    const needC = kinds.some(k => COORD.has(k)), needQ = kinds.some(k => CMP.has(k));
    const hasC = web.cons.some(c => COORD.has(c.k)), hasQ = web.cons.some(c => c.k === "gt" || c.k === "lt" || c.k === "diffd");
    if(needC && !hasC) return false;
    if(needQ && !hasQ) return false;
    if(kinds.includes("neg") && web.cons.length >= 3 && !has("neg")) return false;
    return true;
  }
  function makeWeb(rng, spec){
    for(let attempt = 0; attempt < 60; attempt++){
      const terms = newTerms(rng, spec.K, []); if(!terms) continue;
      const web = {terms, cons:[], H:6, born:[], newFrom:0};
      for(let i = 1; i < spec.K; i++){
        const j = spec.chain ? i - 1 : int(rng, i);
        const c = addEdge(rng, {...web, H:boundFor(web.terms.length, web.cons)}, j, i, spec.kinds);
        if(!c) break;
        web.cons.push(c); web.born.push(0);
      }
      if(web.cons.length !== spec.K - 1) continue;
      for(let e = 0; e < (spec.extra || 0); e++){
        const a = int(rng, spec.K); let b = int(rng, spec.K); if(a === b) continue;
        if(web.cons.some(c => (c.a === a && c.b === b) || (c.a === b && c.b === a))) continue;
        web.H = boundFor(web.terms.length, web.cons);
        const c = addEdge(rng, web, a, b, spec.kinds); if(c){ web.cons.push(c); web.born.push(0); }
      }
      web.H = boundFor(web.terms.length, web.cons);
      if(!kindMixOk(web, spec.kinds)) continue;
      if(!sat(solveWeb(web.terms.length, web.cons, web.H))) continue;
      return web;
    }
    return null;
  }
  function growWeb(rng, web, spec, generation){
    const add = Math.min(spec.grow, spec.maxK - web.terms.length);
    const fresh = newTerms(rng, add, web.terms); if(!fresh) return null;
    const g = {terms:web.terms.slice(), cons:web.cons.slice(), born:web.born.slice(), H:web.H, newFrom:web.terms.length};
    for(const t of fresh){
      g.terms.push(t);
      const i = g.terms.length - 1;
      // Attach mostly to older terms so the new part must be integrated with the old.
      const j = int(rng, i);
      g.H = boundFor(g.terms.length, g.cons);
      const c = addEdge(rng, g, j, i, spec.kinds); if(!c) return null;
      g.cons.push(c); g.born.push(generation);
    }
    for(let e = 0; e < (spec.extra || 0); e++){
      const a = g.newFrom + int(rng, g.terms.length - g.newFrom), b = int(rng, g.newFrom);
      if(g.cons.some(c => (c.a === a && c.b === b) || (c.a === b && c.b === a))) continue;
      g.H = boundFor(g.terms.length, g.cons);
      const c = addEdge(rng, g, a, b, spec.kinds); if(c){ g.cons.push(c); g.born.push(generation); }
    }
    g.H = boundFor(g.terms.length, g.cons);
    return sat(solveWeb(g.terms.length, g.cons, g.H)) ? g : null;
  }
  function distances(web, x){
    const n = web.terms.length, d = new Array(n).fill(Infinity), q = [x]; d[x] = 0;
    while(q.length){ const v = q.shift(); for(const c of web.cons){ const w = c.a === v ? c.b : c.b === v ? c.a : -1; if(w >= 0 && d[w] === Infinity){ d[w] = d[v] + 1; q.push(w); } } }
    return d;
  }
  function pathCons(web, x, y){
    const n = web.terms.length, prev = new Array(n).fill(-1), via = new Array(n).fill(-1), seen = new Array(n).fill(false), q = [x]; seen[x] = true;
    while(q.length){ const v = q.shift(); if(v === y) break; web.cons.forEach((c, i) => { const w = c.a === v ? c.b : c.b === v ? c.a : -1; if(w >= 0 && !seen[w]){ seen[w] = true; prev[w] = v; via[w] = i; q.push(w); } }); }
    if(!seen[y]) return [];
    const out = []; for(let v = y; v !== x; v = prev[v]) out.unshift(web.cons[via[v]]);
    return out;
  }

  // ---- wording -------------------------------------------------------------------------------------
  const STMT = {eq:"is the SAME as", neg:"is the OPPOSITE of", neq:"is DIFFERENT from", gt:"is MORE than", lt:"is LESS than"};
  const ASKW = {eq:"the SAME as", neg:"the OPPOSITE of", neq:"DIFFERENT from", gt:"MORE than", lt:"LESS than"};
  const RCLS = {eq:"same", neg:"opp", neq:"diff", gt:"more", lt:"less", diffd:"more"};
  const GLYPH_OF = {eq:"diamond", neg:"triangle", neq:"circle", gt:"square", lt:"cross"};
  const glyph = id => O.glyphSvg(id);
  function stmtText(c){ if(c.k === "diffd") return c.d > 0 ? `is ${c.d} MORE than` : `is ${-c.d} LESS than`; return STMT[c.k]; }
  function relHtml(c, cues){
    if(cues){ const k = c.k === "diffd" ? (c.d > 0 ? "gt" : "lt") : c.k; return `<span class="v8-cue">${glyph(cues[k])}</span>${c.k === "diffd" ? `<b class="v8-web-amt">${Math.abs(c.d)}</b>` : ""}`; }
    return `<span class="v8-rel v8-rel-${RCLS[c.k === "diffd" ? (c.d > 0 ? "gt" : "lt") : c.k]}">${esc(stmtText(c))}</span>`;
  }
  const termHtml = t => `<span class="v8-term">${esc(t)}</span>`;
  function premiseLine(web, c, cues, isNew){ return `<li class="${isNew ? "v8-web-new" : ""}">${termHtml(web.terms[c.a])} ${relHtml(c, cues)} ${termHtml(web.terms[c.b])}${isNew ? ' <span class="v8-web-badge">NEW</span>' : ""}</li>`; }
  function premiseSentence(web, c){ return `${web.terms[c.a]} ${stmtText(c)} ${web.terms[c.b]}`; }
  const FMT_OPTIONS = {
    yn3:["YES","NO","CAN'T TELL"], yn2:["YES","NO"],
    order:["MORE","LESS","SAME","CAN'T TELL"], mirror:["SAME","OPPOSITE","NEITHER","CAN'T TELL"]
  };
  const FMT_KEYS = {yn3:[["y","arrowleft","1"],["n","arrowright","2"],["c","arrowdown","3"]], yn2:[["y","arrowleft","1"],["n","arrowright","2"]],
    order:[["1"],["2"],["3"],["4"]], mirror:[["1"],["2"],["3"],["4"]]};
  const KEY_HINT = {yn3:["Y","N","C"], yn2:["Y","N"], order:["1","2","3","4"], mirror:["1","2","3","4"]};

  // ---- questions -------------------------------------------------------------------------------------
  function evaluate(web, q){
    // Returns the answer index into q.optionsKey, plus models for the review.
    if(q.fmt === "yn" || q.fmt === "amt"){
      const m = modalW(web, q.x, q.y, q.r);
      if(m.status === "unknown") return null;
      const opts = q.twoWay ? FMT_OPTIONS.yn2 : FMT_OPTIONS.yn3;
      const label = m.status === "yes" ? "YES" : m.status === "no" ? "NO" : "CAN'T TELL";
      return {answer:opts.indexOf(label), label, status:m.status, model:m.model, counter:m.counter};
    }
    if(q.fmt === "order"){
      const gt = modalW(web, q.x, q.y, {k:"gt"}), lt = modalW(web, q.x, q.y, {k:"lt"}), eq = modalW(web, q.x, q.y, {k:"eq"});
      if([gt, lt, eq].some(m => m.status === "unknown")) return null;
      const label = gt.status === "yes" ? "MORE" : lt.status === "yes" ? "LESS" : eq.status === "yes" ? "SAME" : "CAN'T TELL";
      const alt = label === "CAN'T TELL" ? [gt, lt, eq].filter(m => m.status === "cant") : [];
      return {answer:FMT_OPTIONS.order.indexOf(label), label, status:label === "CAN'T TELL" ? "cant" : "det", model:(alt[0] || gt).model, counter:alt[0] ? alt[0].counter : null};
    }
    if(q.fmt === "mirror"){
      const eq = modalW(web, q.x, q.y, {k:"eq"}), ng = modalW(web, q.x, q.y, {k:"neg"});
      if(eq.status === "unknown" || ng.status === "unknown") return null;
      const label = eq.status === "yes" ? "SAME" : ng.status === "yes" ? "OPPOSITE" : (eq.status === "no" && ng.status === "no") ? "NEITHER" : "CAN'T TELL";
      const alt = label === "CAN'T TELL" ? [eq, ng].filter(m => m.status === "cant") : [];
      return {answer:FMT_OPTIONS.mirror.indexOf(label), label, status:label === "CAN'T TELL" ? "cant" : "det", model:(alt[0] || eq).model, counter:alt[0] ? alt[0].counter : null};
    }
    return null;
  }
  function questionHtml(web, q, cues){
    const X = termHtml(web.terms[q.x]), Y = termHtml(web.terms[q.y]);
    if(q.fmt === "yn" || q.fmt === "amt"){
      const r = q.r;
      if(cues){ const k = r.k === "diffd" ? (r.d > 0 ? "gt" : "lt") : r.k; return `Is ${X} <span class="v8-cue">${glyph(cues[k])}</span>${r.k === "diffd" ? `<b class="v8-web-amt">${Math.abs(r.d)}</b>` : ""} ${Y}?`; }
      if(r.k === "diffd") return `Is ${X} <span class="v8-rel v8-rel-${r.d > 0 ? "more" : "less"}">${Math.abs(r.d)} ${r.d > 0 ? "MORE" : "LESS"} than</span> ${Y}?`;
      return `Is ${X} <span class="v8-rel v8-rel-${RCLS[r.k]}">${ASKW[r.k]}</span> ${Y}?`;
    }
    if(q.fmt === "order") return `Compared with ${Y}, ${X} is…`;
    if(q.fmt === "mirror") return `${X} and ${Y} are…`;
    return "";
  }
  function questionText(web, q){
    const X = web.terms[q.x], Y = web.terms[q.y];
    if(q.fmt === "yn" || q.fmt === "amt"){ const r = q.r; if(r.k === "diffd") return `Is ${X} ${Math.abs(r.d)} ${r.d > 0 ? "MORE" : "LESS"} than ${Y}?`; return `Is ${X} ${ASKW[r.k]} ${Y}?`; }
    if(q.fmt === "order") return `Compared with ${Y}, ${X} is…`;
    return `${X} and ${Y} are…`;
  }
  function sigOf(web, q){ return `${web.terms[q.x]}|${web.terms[q.y]}|${q.fmt}|${q.r ? q.r.k + (q.r.d ?? "") : ""}`; }

  function candidateList(rng, web, spec){
    const out = [], n = web.terms.length;
    const hasC = web.cons.some(c => COORD.has(c.k)), hasQ = web.cons.some(c => c.k === "gt" || c.k === "lt" || c.k === "diffd");
    const ynKinds = [].concat(hasC ? ["eq","neg"].concat(spec.kinds.includes("neq") ? ["neq"] : []) : [], hasQ ? ["gt","lt"] : [], hasQ && !hasC ? ["eq"] : []);
    for(let x = 0; x < n; x++) for(let y = 0; y < n; y++){
      if(x === y) continue;
      for(const fmt of spec.formats){
        if(fmt === "yn") for(const k of ynKinds) out.push({fmt, x, y, r:{k}});
        else if(fmt === "order" && hasQ) out.push({fmt, x, y});
        else if(fmt === "mirror" && hasC) out.push({fmt, x, y});
        else if(fmt === "amt" && web.cons.some(c => c.k === "diffd")) out.push({fmt, x, y, needD:true});
      }
    }
    return shuffle(rng, out);
  }
  function resolveAmount(rng, web, q){
    // "Is X d MORE/LESS than Y?": ask the exact derived difference or a near miss; when the difference is
    // open, ask a value some model allows.
    const m = solveWeb(web.terms.length, web.cons, web.H); if(!sat(m)) return null;
    const d0 = m[q.x] - m[q.y];
    let d = d0;
    const st0 = modalW(web, q.x, q.y, {k:"diffd", d:d0}).status;
    if(st0 === "unknown") return null;
    const det = st0 === "yes";
    if(det){ if(rng() < 0.5){ const alt = shuffle(rng, [d0 + 1, d0 - 1, d0 + 2, d0 - 2, -d0].filter(v => v !== 0 && v !== d0)); d = alt[0]; } }
    if(d === 0) return null;
    return {...q, r:{k:"diffd", d}};
  }
  function chooseQuestions(rng, web, spec, ledger, isNewTerm){
    const Q = spec.Q, cands = candidateList(rng, web, spec);
    const dist = web.terms.map((_, i) => distances(web, i));
    // 1. Evaluate a budget of distinct, never-asked candidates and bucket them by (format, answer).
    const buckets = new Map(), seenSig = new Set();
    const budget = Math.max(120, Q * 16);
    let evaluated = 0;
    for(const c0 of cands){
      if(evaluated >= budget) break;
      let q = c0;
      if(q.needD){ q = resolveAmount(rng, web, q); if(!q) continue; }
      const sig = sigOf(web, q);
      if(seenSig.has(sig) || ledger.has(sig)) continue;
      seenSig.add(sig);
      q = {...q, twoWay:!!spec.twoWay};
      const ev = evaluate(web, q); evaluated++;
      if(!ev || ev.answer < 0) continue;
      const fmt = q.fmt === "amt" ? "amt" : q.fmt;
      const key = `${fmt}|${ev.label}`;
      if(!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push({...q, sig, path:dist[q.x][q.y], touchesNew:isNewTerm(q.x) || isNewTerm(q.y), ...ev});
    }
    // Within a bucket, prefer derived (non-adjacent) pairs and pairs that touch the new part of the web.
    for(const list of buckets.values()) list.sort((a, b) => ((b.path > 1) - (a.path > 1)) * 2 + (b.touchesNew - a.touchesNew) + (rng() - 0.5) * 0.9);
    // 2. Format shares: half YES/NO questions, the rest split between the other formats.
    const fmts = spec.formats.filter(f => [...buckets.keys()].some(k => k.startsWith(f + "|")));
    const share = {}; fmts.forEach(f => { share[f] = f === "yn" && fmts.length > 1 ? 0.5 : (fmts.length > 1 ? 0.5 / (fmts.length - (fmts.includes("yn") ? 1 : 0)) : 1); });
    const want = {}; fmts.forEach(f => { want[f] = Math.max(1, Math.round(Q * share[f])); });
    const maxAdjacent = spec.twoWay ? Math.ceil(Q * 0.6) : Math.ceil(Q * (web.terms.length <= 4 ? 0.3 : 0.18));
    const chosen = [], used = new Set();
    let adjacent = 0;
    // 3. Round robin over answer labels inside each format keeps the key balanced.
    const labelCount = key => chosen.filter(q => `${q.fmt}|${q.label}` === key).length;
    const takeFrom = (key, strict, capped = true) => {
      const list = buckets.get(key) || [];
      const f = key.split("|")[0];
      if(capped && labelCount(key) >= Math.max(1, Math.ceil((want[f] || Q) * 0.4))) return false;
      for(let i = 0; i < list.length; i++){
        const q = list[i];
        if(used.has(q.sig)) continue;
        if(strict && q.path === 1 && adjacent >= maxAdjacent) continue;
        list.splice(i, 1); used.add(q.sig); if(q.path === 1) adjacent++; chosen.push(q); return true;
      }
      return false;
    };
    for(const strict of [true, false]){
      for(const f of fmts){
        const labels = shuffle(rng, [...buckets.keys()].filter(k => k.startsWith(f + "|")));
        let got = chosen.filter(q => q.fmt === f).length, progress = true;
        while(got < want[f] && chosen.length < Q && progress){
          progress = false;
          for(const key of labels){ if(got >= want[f] || chosen.length >= Q) break; if(takeFrom(key, strict)){ got++; progress = true; } }
        }
      }
    }
    // Any shortfall is filled from the least-used labels (relative to chance for their format).
    while(chosen.length < Q){
      const counts = {}; chosen.forEach(q => { const k = `${q.fmt}|${q.label}`; counts[k] = (counts[k] || 0) + 1; });
      const opts = k => { const f = k.split("|")[0]; return f === "order" || f === "mirror" ? 4 : spec.twoWay ? 2 : 3; };
      const keys = [...buckets.keys()].filter(k => (buckets.get(k) || []).some(q => !used.has(q.sig))).sort((a, b) => (counts[a] || 0) * opts(a) - (counts[b] || 0) * opts(b));
      if(!keys.length || !takeFrom(keys[0], false, false)) break;
    }
    // Order for flexibility: consecutive questions switch frame, format and direction where possible.
    const frameOf = q => q.fmt === "order" || q.fmt === "amt" || (q.r && (q.r.k === "gt" || q.r.k === "lt")) ? "cmp" : "coord";
    const ordered = [];
    const pool = chosen.slice();
    while(pool.length){
      const prev = ordered[ordered.length - 1];
      let idx = 0;
      if(prev){
        const score = q => (frameOf(q) !== frameOf(prev) ? 2 : 0) + (q.fmt !== prev.fmt ? 1 : 0) + (q.x === prev.y && q.y === prev.x ? 1 : 0) + (q.label !== prev.label ? 0.5 : 0) + rng() * 0.3;
        let best = -1; pool.forEach((q, i) => { const s = score(q); if(s > best){ best = s; idx = i; } });
      }
      ordered.push(pool.splice(idx, 1)[0]);
    }
    return ordered;
  }

  // ---- adaptive state -----------------------------------------------------------------------------------
  const SCHEMA = 1;
  function stateOf(axisState){
    const a = axisState || {custom:{}}; const c = a.custom || (a.custom = {});
    if(c.schema !== SCHEMA){ const keep = c.lastOwned; for(const k of Object.keys(c)) delete c[k]; Object.assign(c, {schema:SCHEMA, dl:{}, hist:{}, sprints:0, daily:{date:"", runs:0}, web:null, recentDown:null, reviewDue:0, lastOwned:keep || null}); }
    c.dl = c.dl || {}; c.hist = c.hist || {}; c.daily = c.daily || {date:"", runs:0};
    return c;
  }
  const deadlineOf = (c, L) => Math.max(dlFloor(L), Math.min(dlCeil(L), Number(c.dl[L]) || dlStart(L)));
  function levelDecision(c, L){
    const h = (c.hist[L] || []).filter(x => !x.review);
    if(!h.length) return {move:0, why:"first sprint at this level"};
    const last = h[h.length - 1], prev = h[h.length - 2];
    // Down: accuracy first.
    if(last.acc < 0.55) return {move:-1, why:"accuracy fell below 55%"};
    if(prev && last.acc < 0.75 && prev.acc < 0.75) return {move:-1, why:"accuracy below 75% twice"};
    const accs = h.map(x => x.acc), rts = h.map(x => x.med).filter(Number.isFinite);
    const accQ20 = quantile(accs.slice(0, -1), 0.2), rtQ50 = quantile(rts.slice(0, -1), 0.5), rtQ85 = quantile(rts.slice(0, -1), 0.85);
    if(h.length >= 4 && accQ20 !== null && last.acc < Math.min(0.85, accQ20) && Number.isFinite(last.med) && rtQ85 !== null && last.med > rtQ85) return {move:-1, why:"accuracy and speed both below your own range"};
    if(L >= MAX_LEVEL) return {move:0, why:"top level"};
    // Up 1: fast-track.
    if(prev && last.acc >= 0.94 && prev.acc >= 0.94 && last.med <= fastRT(L) && prev.med <= fastRT(L)) return {move:1, why:"fast-track: ≥94% and fast twice"};
    // Up 2: fluency plateau after real improvement (overtraining to asymptote).
    if(h.length >= 4 && last.acc >= 0.9 && (accs.length < 3 || last.acc >= quantile(accs, 0.75) - 1e-9)){
      const half = Math.floor(rts.length / 2), early = median(rts.slice(0, half)), late = median(rts.slice(half));
      const improved = early && late && (early - late) / early >= 0.08;
      const plateau = prev && Number.isFinite(prev.med) && Math.abs(last.med - prev.med) / prev.med <= 0.08;
      const fasterThanOwn = rtQ50 !== null && last.med <= rtQ50;
      if(improved && plateau && fasterThanOwn) return {move:1, why:"fluent: faster than your start, now levelled off"};
    }
    // Up 3: accurate but slow still progresses (breadth), after more practice.
    const last3 = h.slice(-3);
    if(h.length >= 6 && last3.length === 3 && last3.every(x => x.acc >= 0.9) && last.med <= goodRT(L) * 1.3) return {move:1, why:"accurate over six sprints"};
    return {move:0, why:last.acc >= 0.9 ? "accurate: keep going until it is fast and stable" : "hold"};
  }

  // ---- the live sprint ---------------------------------------------------------------------------------------
  function fmtKey(q){ return q.fmt === "order" ? "order" : q.fmt === "mirror" ? "mirror" : q.twoWay ? "yn2" : "yn3"; }
  function qFactor(q){ return (1 + 0.12 * Math.max(0, Math.min(5, q.path - 1))) * (q.fmt === "order" || q.fmt === "mirror" ? 1.12 : 1) * (q.fmt === "amt" ? 1.25 : 1); }
  function mountSprint(meta){
    return function mount(api){
      const S = {phase:"ready", k:-1, shownAt:0, dl:meta.deadline, records:[], timer:null, fbUntil:0, pausedAt:0, keyPhase:0, interUntil:0, t0:0};
      api.setSurface(meta.studyHtml);
      if(api.panel){ api.panel.innerHTML = `<div class="v8-live-pad" data-count="1"><button type="button" class="v8-live-btn v8-live-start" data-act="start"><b>START</b><span class="v8-key">SPACE</span></button></div>`; api.panel.addEventListener("pointerdown", onPointer); api.panel.addEventListener("click", onClick); }
      api.prompt("STUDY"); api.answer("—");
      function cuesNow(){ return meta.cues ? (S.keyPhase ? meta.cuesSwitched : meta.cues) : null; }
      function start(){ if(S.phase !== "ready") return; S.phase = "q"; S.t0 = api.clock(); next(); later(); }
      function pad(q){
        const fk = fmtKey(q), opts = FMT_OPTIONS[fk];
        return `<div class="v8-live-pad v8-web-pad" data-count="${opts.length}">${opts.map((o, i) => `<button type="button" class="v8-live-btn" data-opt="${i}"><b>${esc(o)}</b><span class="v8-key">${esc(KEY_HINT[fk][i])}</span></button>`).join("")}</div>`;
      }
      function render(q, extra){
        const legend = meta.cues && (meta.legendDuring || S.keyPhase) ? legendHtml(cuesNow(), S.keyPhase ? "KEY (questions)" : "KEY") : "";
        const web = meta.visible ? `<ol class="v8-premise-list v8-web-list">${meta.web.cons.map(c => premiseLine(meta.web, c, meta.cues, false)).join("")}</ol>` : "";
        const ms = Math.round(S.dl * qFactor(q));
        const timer = extra ? `<div class="v8-web-timer v8-web-timer-done"><i></i></div>` : `<div class="v8-web-timer"><i style="animation-duration:${ms}ms"></i></div>`;
        api.setSurface(`<div class="v8-live v8-web-live"><div class="v8-nb-hud"><span>WEB · L${meta.level}${meta.review ? " · CHECK" : ""}</span><span>${S.k + 1} / ${meta.questions.length}</span></div>
          <div class="v8-web-q">${questionHtml(meta.web, q, cuesNow())}</div>
          ${timer}${extra || ""}${legend}${web}</div>`);
      }
      function next(){
        S.k++;
        if(S.k >= meta.questions.length) return end();
        if(meta.keyChangeAt && S.k === meta.keyChangeAt && !S.keyPhase){
          S.keyPhase = 1; S.phase = "inter"; S.interUntil = api.clock() + 2600;
          api.setSurface(`<div class="v8-live v8-web-live"><div class="v8-web-switch">KEY CHANGE</div><div class="v8-muted">In the questions from now on:</div>${legendHtml(meta.cuesSwitched, "")}<div class="v8-muted">The web itself has not changed.</div></div>`);
          if(api.panel) api.panel.innerHTML = "";
          return;
        }
        const q = currentQ();
        if(api.panel) api.panel.innerHTML = pad(q);
        render(q);
        S.phase = "q"; S.shownAt = api.clock();
        api.prompt(q.fmt === "yn" || q.fmt === "amt" ? "ANSWER FAST" : "CHOOSE FAST"); api.answer(String(S.k + 1));
      }
      function currentQ(){ return meta.questions[S.k]; }
      function respond(i){
        if(S.phase !== "q") return;
        const q = currentQ(), rt = Math.max(1, Math.round(api.clock() - S.shownAt));
        const ok = i === q.answer;
        finishQ(q, i, rt, ok, false);
      }
      function finishQ(q, i, rt, ok, timeout){
        const f = qFactor(q), norm = rt / f;
        // Deadline staircase (ET analog): accuracy first, speed sets the size of the step.
        if(ok){ const gain = norm < fastRT(meta.level) ? 2 : norm < goodRT(meta.level) ? 1.5 : 1; S.dl = Math.max(dlFloor(meta.level), S.dl * (1 - STEP * gain)); }
        else S.dl = Math.min(dlCeil(meta.level), S.dl * (1 + PENALTY));
        S.records.push({id:`q${S.k}`, value:i, correct:ok, rt, expected:q.answer, kind:"web_q", meta:{fmt:q.fmt, label:q.label, status:q.status, path:q.path, sig:q.sig, timeout, keyPhase:S.keyPhase, text:questionText(meta.web, q), kindRel:q.r ? q.r.k : null, deadline:Math.round(S.dl * f)}});
        const opts = FMT_OPTIONS[fmtKey(q)];
        if(api.panel){ const bs = api.panel.querySelectorAll("[data-opt]"); bs.forEach((b, j) => { if(j === q.answer) b.classList.add("v8-fb-hit"); else if(j === i) b.classList.add("v8-fb-fa"); }); }
        const line = ok ? `<div class="v8-web-fb v8-web-ok">✓</div>` : `<div class="v8-web-fb v8-web-bad">${timeout ? "TOO SLOW" : "✗"} · ${esc(opts[q.answer])}</div>`;
        render(q, line);
        S.phase = "fb"; S.fbUntil = api.clock() + (ok ? 260 : 1100);
      }
      function onPointer(e){ const b = e.target && e.target.closest ? e.target.closest("button") : null; if(!b) return; e.preventDefault(); if(b.dataset.act === "start") start(); else if(b.dataset.opt !== undefined) respond(Number(b.dataset.opt)); }
      function onClick(e){ if(e.detail !== 0) return; const b = e.target && e.target.closest ? e.target.closest("button") : null; if(!b) return; if(b.dataset.act === "start") start(); else if(b.dataset.opt !== undefined) respond(Number(b.dataset.opt)); }
      function onKey(e){
        const k = String(e.key || "").toLowerCase();
        if(S.phase === "ready"){ if(k === " " || k === "enter" || e.code === "Space"){ if(!e.repeat) start(); return true; } return false; }
        if(S.phase === "q"){
          const keys = FMT_KEYS[fmtKey(currentQ())];
          const i = keys.findIndex(list => list.includes(k));
          if(i >= 0){ if(!e.repeat) respond(i); return true; }
        }
        return k === " " || k === "enter";
      }
      function end(){
        S.phase = "done"; if(S.timer){ clearTimeout(S.timer); S.timer = null; }
        api.finish(S.records, {activeMs:Math.round(api.clock() - S.t0), deadline:Math.round(S.dl), level:meta.level, review:!!meta.review});
      }
      function later(){ if(S.phase !== "done") S.timer = setTimeout(tick, 25); }
      function tick(){
        S.timer = null;
        if(!api.live()){ S.phase = "done"; return; }
        api.assert();
        const t = api.clock();
        if(api.paused()){ if(!S.pausedAt) S.pausedAt = t; return later(); }
        if(S.pausedAt){
          // Resume: the interrupted question starts again with its full time.
          const gap = t - S.pausedAt; S.pausedAt = 0;
          if(S.phase === "q"){ S.shownAt = t; render(currentQ()); } else { S.fbUntil += gap; S.interUntil += gap; }
          return later();
        }
        if(S.phase === "inter"){ if(t >= S.interUntil){ S.k--; S.phase = "q"; nextAfterInter(); } return later(); }
        if(S.phase === "fb"){ if(t >= S.fbUntil) next(); return later(); }
        if(S.phase === "q"){
          const q = currentQ(), limit = S.dl * qFactor(q);
          if(t - S.shownAt >= limit) finishQ(q, null, Math.round(limit), false, true);
        }
        later();
      }
      function nextAfterInter(){
        S.k++;
        const q = currentQ();
        if(api.panel) api.panel.innerHTML = pad(q);
        render(q); S.phase = "q"; S.shownAt = api.clock();
        api.prompt("ANSWER FAST"); api.answer(String(S.k + 1));
      }
      return {onKey, state:S};
    };
  }
  function legendHtml(cues, title){
    const rows = ["eq","neg","neq","gt","lt"].filter(k => cues[k]).map(k => `<div class="v8-legend-row">${glyph(cues[k])}<span>=</span><span class="v8-rel v8-rel-${RCLS[k]}">${esc(ASKW[k].replace(/ than| as| of| from/g, "").replace(/^the /, ""))}</span></div>`).join("");
    return `<div class="v8-web-legend">${title ? `<div class="v8-counter">${esc(title)}</div>` : ""}${rows}</div>`;
  }

  // ---- build -------------------------------------------------------------------------------------------------
  function build(ctx){
    const axisState = ctx.axisState || {custom:{}};
    const c = stateOf(axisState);
    const rng = ctx.rng;
    let L = Math.max(0, Math.min(MAX_LEVEL, ctx.levelForced ? ctx.level : (axisState.level || 0)));
    // Fluency checks: every sixth sprint revisits an earlier level at its own (fast) deadline, so
    // mastered relations keep being overtrained.
    let review = false;
    if(!ctx.levelForced && L >= 2 && c.sprints > 0 && c.sprints % 6 === 5){ L = Math.max(0, L - 1 - int(rng, Math.min(3, L))); review = true; }
    const spec = LEVELS[L];
    let web = null, fresh = true, generation = 0;
    const today = ctx.today || "";
    if(spec.grow && !review && !ctx.levelForced && c.web && c.web.level === L && c.web.date === today && c.web.terms.length < spec.maxK){
      generation = (c.web.gen || 0) + 1;
      web = growWeb(rng, c.web, spec, generation);
      fresh = !web;
    }
    if(!web){ web = makeWeb(rng, spec); generation = 0; fresh = true; }
    if(!web) return null;
    const ledger = new Set(!fresh && c.web && Array.isArray(c.web.asked) ? c.web.asked : []);
    const isNewTerm = i => !fresh && i >= web.newFrom;
    const questions = chooseQuestions(rng, web, spec, ledger, isNewTerm);
    if(questions.length < Math.min(spec.Q, 8)) return null;
    // Symbols (arbitrary contextual cues) and the mid-sprint key change.
    let cues = null, cuesSwitched = null, keyChangeAt = 0;
    if(spec.cued){
      const shapes = shuffle(rng, Object.keys(O.GLYPHS));
      cues = {eq:shapes[0], neg:shapes[1], neq:shapes[2], gt:shapes[3], lt:shapes[4]};
      if(spec.keyChange){
        // After the switch each question shows the symbol that NOW means the asked relation
        // (SAME↔OPPOSITE and MORE↔LESS trade symbols), so the answer key is unchanged but decoding
        // must follow the new context.
        cuesSwitched = {...cues, eq:cues.neg, neg:cues.eq, gt:cues.lt, lt:cues.gt};
        keyChangeAt = Math.floor(questions.length / 2);
      }
    }
    if(spec.grow && !review && !ctx.levelForced){
      c.web = {level:L, date:today, terms:web.terms, cons:web.cons, born:web.born, H:web.H, gen:generation, asked:[...ledger, ...questions.map(q => q.sig)].slice(-600)};
    }
    const deadline = deadlineOf(c, L);
    const newCons = web.cons.map((cn, i) => ({cn, isNew:!fresh && (web.born[i] || 0) === generation}));
    const shown = spec.grow && !spec.showAll && !fresh ? newCons.filter(x => x.isNew) : newCons;
    const legend = cues ? legendHtml(cues, "KEY") : "";
    const headline = fresh ? (spec.grow ? "NEW WEB" : "THE WEB") : `THE WEB GROWS · ${web.terms.length} TERMS`;
    const hidden = !spec.visible;
    const studyHtml = `<div class="v8-live v8-web-study">
      <div class="v8-counter">RELATIONAL WEB · LEVEL ${L}${review ? " · FLUENCY CHECK" : ""}</div>
      <div class="v8-web-head">${esc(headline)}</div>
      ${legend}
      <ol class="v8-premise-list v8-web-list">${shown.map(x => premiseLine(web, x.cn, cues, x.isNew && !spec.showAll ? false : x.isNew)).join("")}</ol>
      ${spec.grow && !spec.showAll && !fresh ? `<div class="v8-muted">Only the new links are shown. The rest of the web is the one you built in the previous sprints.</div>` : ""}
      <div class="v8-nb-note">${questions.length} questions about any two terms. OPPOSITE is the mirror value around 0 on the same scale as MORE and LESS. ${hidden ? "The web disappears when you start." : "The web stays on screen."} Each question has a time limit (about ${(deadline / 1000).toFixed(1)} s, adapting to you): accuracy first, then speed.${spec.keyChange ? " Halfway through, the symbols in the QUESTIONS switch meaning." : ""}</div>
      <div class="v8-nb-start">Press SPACE or tap START</div></div>`;
    const meta = {level:L, web, questions, deadline, cues, cuesSwitched, keyChangeAt, visible:!!spec.visible, legendDuring:!!cues && L <= 8, review, studyHtml};
    // Correct answers for questions after a key change are unaffected (q.r is the asked relation); the
    // displayed symbol is cuesSwitched[q.r.k], so decoding requires the new key.
    const features = {[`web.level:${L}`]:true, [`web.frame:${spec.kinds.some(k => COORD.has(k)) && spec.kinds.some(k => CMP.has(k)) ? "mixed" : spec.kinds.some(k => COORD.has(k)) ? "coordination" : "comparison"}`]:true};
    for(const q of questions){ features[`web.fmt:${q.fmt}`] = true; if(q.r) features[`web.kind:${q.r.k}`] = true; }
    if(hidden) features["web.hidden"] = true; if(cues) features["web.cued"] = true; if(keyChangeAt) features["web.keychange"] = true; if(spec.grow) features["web.growing"] = true; if(review) features["web.review"] = true;
    const title = `Relational web · level ${L}`;
    return {
      family:FAMILY, catId:`web_L${L}`, contentSpecId:"v8.web.sprint", label:"RELATIONAL WEB",
      title, summaryQuestion:`${title}: ${questions.length} questions`,
      steps:[
        {type:"frame", html:`<div class="v8-frame"><div class="v8-counter">RELATIONAL WEB</div><div class="v8-premise">Level ${L}</div><div class="v8-muted">${esc(spec.note)}</div></div>`, ms:1100, label:"RELATIONAL WEB", prompt:"WEB"},
        {type:"live", html:studyHtml, label:"RELATIONAL WEB", prompt:"STUDY", question:title, mount:mountSprint(meta), aria:`${title}: study the web, then answer quickly`}
      ],
      features,
      frameTags:["relational_frame","relational_network","fluency","derived_relations"].concat(cues ? ["arbitrary_cue"] : [], keyChangeAt ? ["contextual_switch"] : []),
      mechanismTags:["combinatorial_entailment","relational_fluency","timed_derivation"].concat(spec.grow ? ["network_growth"] : []),
      executiveTags:["relational_integration","cognitive_flexibility","processing_speed"].concat(hidden ? ["working_memory_update"] : []),
      demandVector:{relational_integration:Math.min(5, 1 + Math.floor(L / 2)), processing_speed:3, flexibility:2 + (cues ? 1 : 0) + (keyChangeAt ? 1 : 0), working_memory:hidden ? 3 : 1},
      score:answers => { const n = answers.length, ok = answers.filter(a => a.correct).length; return n > 0 && ok / n >= 0.9; },
      web:{level:L, review, terms:web.terms, cons:web.cons, H:web.H, fresh, generation, deadline, questions:questions.map(q => ({x:q.x, y:q.y, fmt:q.fmt, r:q.r || null, answer:q.answer, label:q.label, status:q.status, path:q.path, sig:q.sig, text:questionText(web, q)})), keyChangeAt, cues, cuesSwitched},
      review:(result) => reviewFor(meta, result, c)
    };
  }

  // ---- review -----------------------------------------------------------------------------------------
  function modelSvg(web, vals, hi){
    if(!Array.isArray(vals)) return "";
    const lo = Math.min(0, ...vals), top = Math.max(0, ...vals), span = Math.max(1, top - lo), W = 320, pad = 24, y = 34;
    const byVal = new Map(); web.terms.forEach((t, i) => { const v = vals[i]; if(!byVal.has(v)) byVal.set(v, []); byVal.get(v).push(t); });
    let marks = ""; const X = v => (pad + (v - lo) / span * (W - 2 * pad)).toFixed(1);
    for(const [v, ts] of byVal){ marks += `<circle cx="${X(v)}" cy="${y}" r="5" class="${ts.some(t => hi.includes(t)) ? "v8-dot-hi" : "v8-dot"}"/><text x="${X(v)}" y="${y - 11}" class="v8-dot-label">${esc(ts.join("·"))}</text><text x="${X(v)}" y="${y + 20}" class="v8-dot-val">${v}</text>`; }
    return `<svg class="v8-model" viewBox="0 0 ${W} 62" role="img" aria-label="one arrangement on the scale"><line x1="${pad}" x2="${W - pad}" y1="${y}" y2="${y}" class="v8-axis"/><line x1="${X(0)}" x2="${X(0)}" y1="${y - 7}" y2="${y + 7}" class="v8-zero"/>${marks}</svg>`;
  }
  function reviewFor(meta, result, c){
    const answers = result.answers || [];
    const web = meta.web, qs = meta.questions;
    const n = answers.length, ok = answers.filter(a => a.correct).length, acc = n ? ok / n : 0;
    const rts = answers.filter(a => a.correct).map(a => a.rt), med = median(rts);
    const rows = answers.map((a, k) => {
      const q = qs[k]; if(!q) return "";
      const opts = FMT_OPTIONS[fmtKey(q)];
      const said = a.meta?.timeout ? "too slow" : a.value === null || a.value === undefined ? "—" : opts[a.value];
      return `<tr class="${a.correct ? "" : "v8-nb-bad"}"><td>${k + 1}</td><td>${esc(questionText(web, q))}</td><td>${esc(said)}</td><td>${esc(opts[q.answer])}</td><td>${(a.rt / 1000).toFixed(1)}s</td></tr>`;
    }).join("");
    const wrong = answers.map((a, k) => ({a, q:qs[k]})).filter(x => x.q && !x.a.correct).slice(0, 3);
    const explain = wrong.map(({q}) => {
      const path = pathCons(web, q.x, q.y).map(cn => premiseSentence(web, cn));
      const hi = [web.terms[q.x], web.terms[q.y]];
      const models = q.status === "cant" && q.model && q.counter
        ? `<h5>Fits the whole web</h5>${modelSvg(web, q.model, hi)}<h5>Also fits the whole web, but answers differently</h5>${modelSvg(web, q.counter, hi)}`
        : `<h5>One arrangement of the whole web</h5>${modelSvg(web, q.model || solveWeb(web.terms.length, web.cons, web.H), hi)}`;
      return `<div class="v8-web-why"><b>${esc(questionText(web, q))}</b> → ${esc(FMT_OPTIONS[fmtKey(q)][q.answer])}<div class="v8-muted">Links: ${esc(path.join(" · "))}</div>${models}</div>`;
    }).join("");
    const usesOpp = web.cons.some(cn => cn.k === "neg") && web.cons.some(cn => cn.k === "gt" || cn.k === "lt" || cn.k === "diffd");
    const reasons = [
      `Accuracy ${Math.round(acc * 100)}% · median time on correct answers ${med ? (med / 1000).toFixed(1) + " s" : "—"} (fast = under ${(fastRT(meta.level) / 1000).toFixed(1)} s). Accuracy comes first; speed decides how quickly the level moves.`,
      "CAN'T TELL is right when two arrangements both fit every link but give different answers."
    ];
    if(usesOpp) reasons.push("An OPPOSITE is the mirror around 0, so it flips MORE and LESS: if A is MORE than B, the opposite of A is LESS than the opposite of B.");
    if(web.cons.some(cn => cn.k === "neq")) reasons.push("DIFFERENT only rules out SAME; it says nothing about which is more, or about opposites.");
    if(meta.keyChangeAt) reasons.push("After the KEY CHANGE, the symbols in the questions meant the paired relation (SAME↔OPPOSITE, MORE↔LESS); the web itself did not change.");
    const premList = `<ol class="v8-premise-list">${web.cons.map(cn => `<li>${esc(premiseSentence(web, cn))}</li>`).join("")}</ol>`;
    return {title:"", question:`Relational web · level ${meta.level}: ${n} questions`, userAnswer:`${ok}/${n} correct`, correctAnswer:"At least 90% correct",
      reasons, html:`<div class="v8-review v8-review-web"><section><h4>THE WEB</h4>${premList}${modelSvg(web, solveWeb(web.terms.length, web.cons, web.H), [])}</section><section><h4>ANSWERS</h4><table class="v8-nb-table"><tr><th>#</th><th>question</th><th>you</th><th>answer</th><th>time</th></tr>${rows}</table>${explain}</section></div>`};
  }

  // ---- adaptation and dose --------------------------------------------------------------------------------
  function onResult(result, axisState, info){
    const w = info?.v8Episode?.spec?.web; if(!w) return;
    const c = stateOf(axisState);
    const answers = result.answers || [], n = answers.length;
    const acc = n ? answers.filter(a => a.correct).length / n : 0;
    const med = median(answers.filter(a => a.correct).map(a => a.rt / Math.max(1, (1 + 0.12 * Math.max(0, Math.min(5, (a.meta?.path || 1) - 1))))));
    const L = w.level;
    if(result.extra && Number.isFinite(result.extra.deadline)) c.dl[L] = result.extra.deadline;
    const h = c.hist[L] || (c.hist[L] = []);
    h.push({acc:+acc.toFixed(3), med:med ? Math.round(med) : null, t:Date.now(), review:!!w.review});
    c.hist[L] = h.slice(-24);
    c.sprints++;
    const today = coord.today ? coord.today() : "";
    if(c.daily.date !== today) c.daily = {date:today, runs:0};
    c.daily.runs++;
    axisState.win.push(acc >= 0.9 ? 1 : 0); axisState.win = axisState.win.slice(-8);
    if(w.review) return;                                   // fluency checks never move the level
    const d = levelDecision(c, L);
    c.lastDecision = {level:L, ...d, acc, med};
    if(d.move > 0 && axisState.level < MAX_LEVEL){ axisState.level = L + 1; axisState.promotions++; c.web = null; }
    else if(d.move < 0 && axisState.level > 0){ axisState.level = L - 1; axisState.demotions++; c.web = null; }
  }
  function blockDemand(axisState, ctx){
    const c = stateOf(axisState);
    if(c.sprints < 2) return 0;
    const target = cfg("v8WebDailySprints", 12), per = cfg("v8WebSprintsPerBlock", 6), spacing = Math.max(1, cfg("v8WebBlockSpacing", 2));
    const done = c.daily.date === ctx.today ? c.daily.runs : 0;
    if(done >= target || per <= 0) return 0;
    const lo = c.lastOwned;
    if(lo && lo.session === ctx.session && ctx.blockOrdinal - lo.block < spacing) return 0;
    return Math.min(per, target - done);
  }
  coord.register({axis:AXIS, family:FAMILY, label:"RELATIONAL WEB", maxLevel:MAX_LEVEL, build, onResult, blockDemand,
    // The owner's first criterion: webs of basic relations get the heaviest ordinary-slot weight too.
    weight:() => 2.4, prereq:() => true});

  // ---- audit ---------------------------------------------------------------------------------------------
  function runAudit(options={}){
    const blockers = [], warnings = [], stats = {};
    const per = Math.max(2, Math.min(40, Number(options.per) || 8));
    const H = coord._test.hash32, M = coord._test.mulberry;
    const timing = {oracle:0, bounds:0, levels:0, grow:0};
    // 1. The arc-consistent oracle agrees with the brute-force oracle on small webs.
    let checked = 0, mism = 0;
    const tOracle = performance.now();
    { const rng = M(0xBEEF);
      for(let i = 0; i < (options.oracle || 300); i++){
        const K = 3 + int(rng, 3), spec = {K, kinds:pick(rng, [["eq","neg","neq"],["gt","lt"],["eq","neg","gt","lt"],["eq","neg","neq","gt","lt"]])};
        const web = makeWeb(rng, spec); if(!web) continue;
        const x = int(rng, K); let y = int(rng, K); if(y === x) y = (x + 1) % K;
        const r = {k:pick(rng, ["eq","neg","neq","gt","lt"])};
        const a = modalW(web, x, y, r).status;
        if(a === "unknown"){ warnings.push(`oracle budget exceeded on a ${K}-term web`); continue; }
        // brute force over a symmetric domain of the same half-width
        const dom = []; for(let v = -web.H; v <= web.H; v++) dom.push(v);
        let T = false, F = false; const v = new Array(K).fill(0), tot = Math.pow(dom.length, K);
        if(tot > 4e5) continue;
        for(let code = 0; code < tot && !(T && F); code++){ let cc = code; for(let j = 0; j < K; j++){ v[j] = dom[cc % dom.length]; cc = Math.floor(cc / dom.length); } if(!web.cons.every(k => holds(k, v[k.a], v[k.b]))) continue; if(holds(r, v[x], v[y])) T = true; else F = true; }
        const b = T && F ? "cant" : T ? "yes" : F ? "no" : "inconsistent";
        if(b === "inconsistent") continue;
        checked++; if(a !== b){ mism++; if(blockers.length < 10) blockers.push(`oracle ${JSON.stringify(web.cons)} ${x}-${y} ${r.k}: ${a} vs brute ${b}`); }
      } }
    timing.oracle = performance.now() - tOracle;
    // 2. Bound artifacts: statuses must not change when the value range doubles.
    let boundChecked = 0, boundBad = 0;
    const tLevels = performance.now();
    // 3. Every level: valid spec, balanced keys, no repeats, independent answer re-derivation.
    const allTexts = new Map();
    for(let L = 0; L <= MAX_LEVEL; L++){
      const row = {built:0, q:0, labels:{}, adjacent:0, cant:0, dupWithin:0, ms:0};
      for(let k = 0; k < per; k++){
        const seed = H(`web|${L}|${k}`);
        const t0 = performance.now();
        const spec = build({level:L, levelForced:true, rng:M(seed), seed, axisState:{custom:{}, win:[], level:L}, featureWeight:() => 1, today:"audit"});
        row.ms += performance.now() - t0;
        if(!spec){ blockers.push(`L${L}#${k}: no sprint`); continue; }
        row.built++;
        const errs = runtime.validateSpec(spec); if(errs.length) blockers.push(`L${L}#${k}: ${errs.slice(0, 2).join("; ")}`);
        const w = spec.web, web = {terms:w.terms, cons:w.cons, H:w.H};
        if(!sat(solveWeb(web.terms.length, web.cons, web.H))) blockers.push(`L${L}#${k}: inconsistent or undecided web`);
        const seen = new Set();
        for(const q of w.questions){
          row.q++; const lk = `${q.fmt}|${q.label}`; row.labels[lk] = (row.labels[lk] || 0) + 1; if(q.path === 1) row.adjacent++; if(q.status === "cant") row.cant++;
          if(seen.has(q.sig)) row.dupWithin++; seen.add(q.sig);
          allTexts.set(q.text, (allTexts.get(q.text) || 0) + 1);
          const ev = evaluate(web, {...q, twoWay:LEVELS[L].twoWay});
          if(!ev || ev.answer !== q.answer) blockers.push(`L${L}#${k}: answer re-derivation ${q.text}`);
          if(boundChecked < (options.boundChecks ?? 200) && q.r && web.terms.length <= 8){ const tb = performance.now(); boundChecked++; const wide = {...web, H:web.H * 2}; if(modalW(wide, q.x, q.y, q.r).status !== modalW(web, q.x, q.y, q.r).status){ boundBad++; if(blockers.length < 20) blockers.push(`L${L}: bound artifact ${q.text}`); } timing.bounds += performance.now() - tb; }
        }
        const html = spec.steps.map(s => s.html || "").join("") + JSON.stringify(w.questions);
        if(/\bNaN\b|\bundefined\b/.test(html)) blockers.push(`L${L}#${k}: NaN/undefined`);
      }
      const total = Math.max(1, row.q);
      // Key balance within each format (chance level = 1 / number of options).
      const byFmt = {};
      for(const [lk, v] of Object.entries(row.labels)){ const f = lk.split("|")[0]; (byFmt[f] = byFmt[f] || {n:0, top:0, top_k:""}); byFmt[f].n += v; if(v > byFmt[f].top){ byFmt[f].top = v; byFmt[f].top_k = lk; } }
      for(const [f, x] of Object.entries(byFmt)){
        const k = f === "order" || f === "mirror" ? 4 : LEVELS[L].twoWay ? 2 : 3;
        if(x.n >= 16 && x.top / x.n > 1 / k + 0.22) warnings.push(`L${L}: ${x.top_k} is ${(100 * x.top / x.n).toFixed(0)}% of ${f} questions`);
      }
      if(row.dupWithin) blockers.push(`L${L}: ${row.dupWithin} repeated questions inside sprints`);
      stats[L] = {built:row.built, questionsPerSprint:+(row.q / Math.max(1, row.built)).toFixed(1), labels:row.labels, adjacentShare:+(row.adjacent / total).toFixed(2), cantShare:+(row.cant / total).toFixed(2), msPerBuild:Math.round(row.ms / Math.max(1, row.built))};
      if(row.ms / Math.max(1, row.built) > 400) warnings.push(`L${L}: build takes ${Math.round(row.ms / row.built)} ms`);
    }
    timing.levels = performance.now() - tLevels - timing.bounds;
    const repeats = [...allTexts.values()].filter(v => v > 1).reduce((s, v) => s + v - 1, 0), totalQ = [...allTexts.values()].reduce((s, v) => s + v, 0);
    const tGrow = performance.now();
    // 4. A growing web never repeats a question across sprints.
    let growRepeat = 0, grown = 0;
    { const axisState = {custom:{}, win:[], level:9};
      const asked = new Set();
      for(let s = 0; s < 5; s++){
        const spec = build({level:9, levelForced:false, rng:M(H(`grow|${s}`)), axisState, featureWeight:() => 1, today:"audit"});
        if(!spec) continue; grown = spec.web.terms.length;
        for(const q of spec.web.questions){ if(asked.has(q.sig)) growRepeat++; asked.add(q.sig); }
      } }
    if(growRepeat) blockers.push(`growing web repeated ${growRepeat} questions`);
    timing.grow = performance.now() - tGrow;
    for(const k of Object.keys(timing)) timing[k] = Math.round(timing[k]);
    // 5. Level rules: accuracy first.
    const sim = (hist, L) => levelDecision({hist:{[L]:hist}}, L);
    const rules = {
      fastTrackUp:sim([{acc:0.95, med:fastRT(3) - 100}, {acc:1, med:fastRT(3) - 200}], 3).move === 1,
      slowAccurateEventuallyUp:sim(Array.from({length:6}, () => ({acc:0.94, med:goodRT(3) * 1.2})), 3).move === 1,
      fastButInaccurateHolds:sim([{acc:0.8, med:900}, {acc:0.8, med:900}], 3).move === 0,
      collapseDown:sim([{acc:0.5, med:2000}], 3).move === -1,
      slowAloneNotDown:sim(Array.from({length:6}, (_, i) => ({acc:0.95, med:3000 + i * 400})), 3).move !== -1
    };
    for(const [k, v] of Object.entries(rules)) if(!v) blockers.push(`level rule failed: ${k}`);
    return {patch:PATCH_ID, version:VERSION, status:blockers.length ? "BLOCK" : warnings.length ? "WARN" : "PASS", blockers:blockers.slice(0, 30), warnings:warnings.slice(0, 30),
      oracle:{checked, mismatches:mism}, bounds:{checked:boundChecked, artifacts:boundBad}, repeats:{questions:totalQ, repeatedTexts:repeats}, growingWeb:{terms:grown, repeats:growRepeat}, rules, timing, stats};
  }

  globalThis.EUCALCULIA_V8_WEB = Object.freeze({patch:PATCH_ID, version:VERSION, family:FAMILY, axis:AXIS, maxLevel:MAX_LEVEL, levels:LEVELS.map(l => ({...l})), build, runAudit,
    _test:Object.freeze({solveWeb, modalW, makeWeb, growWeb, chooseQuestions, levelDecision, evaluate, fastRT, goodRT, deadlineOf, slow:() => slowLog, UNKNOWN})});
})();
/* V8.5 RELATIONAL WEB SPRINTS:END */
