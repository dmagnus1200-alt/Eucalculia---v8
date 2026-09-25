/* V8.3 RELATIONAL FRAMES ENGINE:START
   Basic RFT frames — coordination (SAME), distinction (DIFFERENT), opposition (OPPOSITE),
   comparison (MORE/LESS, BEFORE/AFTER, LEFT/RIGHT, ABOVE/BELOW), hierarchy (kind-of with
   inheritance), conditional (IF … THEN) and deictic (I/YOU, HERE/THERE) — and the SAME frames
   applied one step up, to the relations themselves:
     step 0    mutual entailment               (the converse of one premise)
     step 1    combinatorial entailment        (derive A–C from A–B, B–C …; CAN'T TELL is an answer)
     step 1.5  classify the derived relation   (which relation, not just yes/no)
     step 2    relations between relations     (same / reverse / different relation)
     step 2.5  composition of relations        (with amounts: relations compose like signed numbers)
     step 3    relating relational networks    (role correspondence between two networks)
     step 3.5  networks under transformation   (reversed or re-cued networks; shortcut traps)
   Flexibility overlays: arbitrary glyph cues whose meaning is set per episode, and reversal
   instructions. Every answer comes from an exact satisfiability oracle over value models, never
   from the generator's intention; the review shows a derivation or two counter-models.
*/
(function installV8Relational(){
  "use strict";
  if(globalThis.EUCALCULIA_V8_RELATIONAL) return;
  const coord = globalThis.EUCALCULIA_V8_COORDINATOR, runtime = globalThis.EUCALCULIA_V8_RUNTIME;
  if(!coord || !runtime) return;
  const PATCH_ID = "v8.3-relational-frames", VERSION = "8.3.0", FAMILY = "rft_relational_frames", AXIS = "rft";
  const esc = runtime.esc;
  const int = (rng, n) => Math.floor(rng() * n) % Math.max(1, n);
  const pick = (rng, arr) => arr[int(rng, arr.length)];
  const shuffle = (rng, arr) => { const a = arr.slice(); for(let i=a.length-1;i>0;i--){ const j = int(rng, i+1); [a[i],a[j]] = [a[j],a[i]]; } return a; };

  // ---- terms -------------------------------------------------------------------------------
  const CONS = "BDFGKLMNPRSTVZ", VOW = "AEIOU";
  const BLACK = new Set(("BAD BAG BAN BAT BED BEG BET BID BIG BIN BIT BOG BOP BUD BUG BUM BUN BUS BUT DAD DAM DEN DIG DIM DIN DIP DOG DOT DUB DUG DUN FAD FAN FAT FED FEN FIG FIN FIT FOG FUN FUR GAB GAG GAP GAS GEM GET GOD GOT GUM GUN GUT KEG KID KIN KIT LAB LAD LAG LAP LED LEG LET LID LIP LIT LOG LOT LUG MAD MAN MAP MAT MEN MET MID MOB MOM MOP MUD MUG NAB NAG NAP NET NIB NIP NOD NOT NUN NUT PAD PAL PAN PAT PEG PEN PET PIG PIN PIT POD POP POT PUB PUN PUP PUT RAG RAM RAN RAP RAT RED RIB RID RIG RIM RIP ROB ROD ROT RUB RUG RUM RUN RUT SAD SAG SAP SAT SET SIN SIP SIS SIT SOB SOD SON SOP SUB SUM SUN TAB TAG TAN TAP TEN TIN TIP TON TOP TUB TUG VAN VAT VET ZAP ZEN ZIP FOB NIL NUB PUG SEX TIT BOT DOS FAB GIG GOB KEN LOB MUM NAN NUM PEP PIS SOT TAT TIS TUM VIM BOB DEB DON FED GAL KEP LEV LIB MED MEG NED PAM PAT PEM REB REP REV SAL SAM SEN SIM SOL TED TIM TOM VAL VIV ZED").split(" "));
  function makeTerms(rng, n){
    const out = [], firsts = new Set(), vowels = new Map();
    for(let guard = 0; out.length < n && guard < 800; guard++){
      const w = CONS[int(rng, CONS.length)] + VOW[int(rng, 5)] + CONS[int(rng, CONS.length)];
      if(BLACK.has(w) || firsts.has(w[0]) || w[0] === w[2] || out.includes(w)) continue;
      if((vowels.get(w[1]) || 0) >= Math.ceil(n / 5) + 1) continue;
      out.push(w); firsts.add(w[0]); vowels.set(w[1], (vowels.get(w[1]) || 0) + 1);
    }
    return out.length === n ? out : null;
  }

  // ---- relations ---------------------------------------------------------------------------
  // Constraint kinds over integer values v(term):
  //   eq  a=b        neq a≠b        neg a=−b, a≠0 (opposition: the mirror value on one scale)
  //   gt  a>b (d: a−b=d)            lt  a<b (d: b−a=d)
  // and negations used by the oracle: le, ge, nneg, nd (a−b≠d).
  const DOMAINS = {coord:[-4,-3,-2,-1,1,2,3,4], cmp:[-7,-6,-5,-4,-3,-2,-1,0,1,2,3,4,5,6,7], amt:Array.from({length:61},(_,i)=>i-30)};
  function holds(c, va, vb){
    switch(c.k){
      case "eq": return va === vb;
      case "neq": return va !== vb;
      case "neg": return va === -vb && va !== 0;
      case "nneg": return !(va === -vb && va !== 0);
      case "gt": return c.d ? va - vb === c.d : va > vb;
      case "lt": return c.d ? vb - va === c.d : va < vb;
      case "le": return va <= vb;
      case "ge": return va >= vb;
      case "diffd": return va - vb === c.d;          // exact signed difference (d may be 0 or negative)
      case "ndiffd": return va - vb !== c.d;
      default: return false;
    }
  }
  function forced(c, known, isA){           // value implied for the unknown side, or null
    const x = known;
    if(c.k === "eq") return x;
    if(c.k === "neg") return -x;
    if(c.k === "gt" && c.d) return isA ? x - c.d : x + c.d;      // known is b (isA=false → solve b)… see caller
    if(c.k === "lt" && c.d) return isA ? x + c.d : x - c.d;
    if(c.k === "diffd") return isA ? x - c.d : x + c.d;
    return null;
  }
  // Backtracking model search. Returns an assignment array or null.
  function solve(n, cons, domain){
    const adj = Array.from({length:n}, () => []);
    cons.forEach((c, i) => { adj[c.a].push(i); adj[c.b].push(i); });
    const order = [], seen = new Array(n).fill(false);
    for(let s=0;s<n;s++){ if(seen[s]) continue; const q=[s]; seen[s]=true; while(q.length){ const v=q.shift(); order.push(v); for(const ci of adj[v]){ const c=cons[ci]; const w = c.a===v ? c.b : c.a; if(!seen[w]){ seen[w]=true; q.push(w); } } } }
    const vals = new Array(n).fill(null);
    function ok(v){ for(const ci of adj[v]){ const c = cons[ci]; if(vals[c.a] === null || vals[c.b] === null) continue; if(!holds(c, vals[c.a], vals[c.b])) return false; } return true; }
    function bt(idx){
      if(idx === order.length) return true;
      const v = order[idx];
      let cands = null;
      for(const ci of adj[v]){
        const c = cons[ci], other = c.a === v ? c.b : c.a;
        if(vals[other] === null) continue;
        // solve v from other: if v is a, known is b → a = f(b); if v is b, known is a
        let f = null;
        if(c.k === "eq") f = vals[other];
        else if(c.k === "neg") f = -vals[other];
        else if((c.k === "gt" || c.k === "lt") && c.d){ const diff = c.k === "gt" ? c.d : -c.d; f = c.a === v ? vals[other] + diff : vals[other] - diff; }
        else if(c.k === "diffd"){ f = c.a === v ? vals[other] + c.d : vals[other] - c.d; }
        if(f !== null){ cands = [f]; break; }
      }
      for(const x of (cands || domain)){
        if(!domain.includes(x) && !cands) continue;
        vals[v] = x;
        if(ok(v) && bt(idx + 1)) return true;
      }
      vals[v] = null;
      return false;
    }
    return bt(0) ? vals.slice() : null;
  }
  const NEGATE = {eq:"neq", neq:"eq", neg:"nneg", nneg:"neg", le:"gt", ge:"lt"};
  function negateRel(r){
    if(r.k === "gt") return r.d ? {k:"ndiffd", d:r.d} : {k:"le"};
    if(r.k === "lt") return r.d ? {k:"ndiffd", d:-r.d} : {k:"ge"};
    if(r.k === "diffd") return {k:"ndiffd", d:r.d};
    if(r.k === "ndiffd") return {k:"diffd", d:r.d};
    return {k:NEGATE[r.k]};
  }
  // Modal status of relation r between terms x and y: "yes" (necessary), "no" (impossible), "cant" (open).
  function modal(net, x, y, r){
    const n = net.terms.length, dom = DOMAINS[net.domain];
    const possible = solve(n, net.cons.concat([{...r, a:x, b:y}]), dom);
    if(!possible) return {status:"no", witnessFor:null, witnessAgainst:solve(n, net.cons, dom)};
    const counter = solve(n, net.cons.concat([{...negateRel(r), a:x, b:y}]), dom);
    if(!counter) return {status:"yes", witnessFor:possible, witnessAgainst:null};
    return {status:"cant", witnessFor:possible, witnessAgainst:counter};
  }
  // Most specific determinate relation of x to y.
  function derive(net, x, y){
    const n = net.terms.length, dom = DOMAINS[net.domain];
    if(!solve(n, net.cons, dom)) return {type:"inconsistent"};
    const nec = r => modal(net, x, y, r).status === "yes";
    if(net.frame === "comparison" || net.frame === "amount"){
      // exact difference known?
      const m = solve(n, net.cons, dom); const d0 = m[x] - m[y];
      if(nec({k:"diffd", d:d0})) return d0 === 0 ? {type:"eq"} : {type:d0 > 0 ? "gt" : "lt", d:Math.abs(d0), exact:true};
      if(nec({k:"gt"})) return {type:"gt"};
      if(nec({k:"lt"})) return {type:"lt"};
      if(nec({k:"eq"})) return {type:"eq"};
      return {type:"cant"};
    }
    if(nec({k:"eq"})) return {type:"eq"};
    if(nec({k:"neg"})) return {type:"neg"};
    if(nec({k:"neq"})) return {type:"neq"};
    return {type:"cant"};
  }

  // ---- wording -----------------------------------------------------------------------------
  const DOMAIN_WORDS = {
    quantity:{gt:"is MORE than", lt:"is LESS than", eq:"is the SAME as", gtd:d=>`is ${d} MORE than`, ltd:d=>`is ${d} LESS than`, q:{gt:"MORE than", lt:"LESS than", eq:"the SAME as"}, cls:{gt:"MORE", lt:"LESS", eq:"SAME"}},
    time:{gt:"happened AFTER", lt:"happened BEFORE", eq:"happened at the SAME time as", q:{gt:"happen AFTER", lt:"happen BEFORE", eq:"happen at the SAME time as"}, cls:{gt:"AFTER", lt:"BEFORE", eq:"SAME TIME"}},
    x:{gt:"is to the RIGHT of", lt:"is to the LEFT of", eq:"is in the SAME column as", q:{gt:"to the RIGHT of", lt:"to the LEFT of", eq:"in the SAME column as"}, cls:{gt:"RIGHT", lt:"LEFT", eq:"SAME COLUMN"}},
    y:{gt:"is ABOVE", lt:"is BELOW", eq:"is at the SAME height as", q:{gt:"ABOVE", lt:"BELOW", eq:"at the SAME height as"}, cls:{gt:"ABOVE", lt:"BELOW", eq:"SAME HEIGHT"}}
  };
  const COORD_WORDS = {eq:"is the SAME as", neq:"is DIFFERENT from", neg:"is the OPPOSITE of"};
  const REL_CLASS = {eq:"same", neq:"diff", neg:"opp", gt:"more", lt:"less"};
  function relText(net, c, cue){
    if(cue && net.cues && net.cues[c.k]) return {cue:net.cues[c.k]};
    if(net.frame === "coordination" || c.k === "neq" || c.k === "neg") return {text:COORD_WORDS[c.k]};
    const W = DOMAIN_WORDS[net.dom || "quantity"];
    if(c.d && (c.k === "gt" || c.k === "lt")) return {text:c.k === "gt" ? W.gtd(c.d) : W.ltd(c.d)};
    return {text:W[c.k]};
  }
  const term = t => `<span class="v8-term">${esc(t)}</span>`;
  function premiseHtml(net, c, i, n, opts={}){
    const r = relText(net, c, opts.cued);
    const rel = r.cue ? `<span class="v8-cue" aria-label="relation symbol">${glyphSvg(r.cue)}</span>` : `<span class="v8-rel v8-rel-${REL_CLASS[c.k] || c.k}">${esc(r.text)}</span>`;
    const counter = n > 1 ? `<div class="v8-counter">${i+1} / ${n}</div>` : "";
    return `<div class="v8-frame">${counter}<div class="v8-premise">${term(net.terms[c.a])}${rel}${term(net.terms[c.b])}</div></div>`;
  }
  function premiseSentence(net, c){ const r = relText(net, c, false); return `${net.terms[c.a]} ${r.text} ${net.terms[c.b]}`; }

  // Arbitrary contextual cues (AARR): shapes whose meaning is set for one episode.
  const GLYPHS = {
    diamond:{p:'<polygon points="20,3 37,20 20,37 3,20"/>', c:"#18d7bb", name:"diamond"},
    triangle:{p:'<polygon points="20,4 37,35 3,35"/>', c:"#ffbd5c", name:"triangle"},
    circle:{p:'<circle cx="20" cy="20" r="16"/>', c:"#ff7b9c", name:"circle"},
    square:{p:'<rect x="5" y="5" width="30" height="30" rx="3"/>', c:"#48a8ff", name:"square"},
    cross:{p:'<polygon points="15,3 25,3 25,15 37,15 37,25 25,25 25,37 15,37 15,25 3,25 3,15 15,15"/>', c:"#b59cff", name:"cross"}
  };
  function glyphSvg(id){ const g = GLYPHS[id]; return g ? `<svg class="v8-glyph-cue" viewBox="0 0 40 40" width="44" height="44" aria-label="${g.name}"><g fill="${g.c}">${g.p}</g></svg>` : ""; }

  // ---- balancing (key marginals) -----------------------------------------------------------
  function pickTarget(ctx, kind, options){
    const a = ctx.axisState; const counts = a.custom.keys || (a.custom.keys = {});
    const row = counts[kind] || (counts[kind] = {});
    let best = [], bestN = Infinity;
    for(const o of options){ const n = row[o] || 0; if(n < bestN){ best = [o]; bestN = n; } else if(n === bestN) best.push(o); }
    return pick(ctx.rng, best);
  }
  function noteTarget(ctx, kind, value){ const a = ctx.axisState; const counts = a.custom.keys || (a.custom.keys = {}); const row = counts[kind] || (counts[kind] = {}); row[value] = (row[value] || 0) + 1; }

  // ---- network generators ------------------------------------------------------------------
  // A random connected network over n terms: a spanning tree (optionally + one extra edge),
  // premises oriented and ordered randomly (scrambled order at higher levels).
  function randomTree(rng, n){ const edges = []; for(let i=1;i<n;i++){ edges.push([int(rng, i), i]); } return edges; }
  function chainEdges(n){ return Array.from({length:n-1}, (_,i) => [i, i+1]); }
  function orient(rng, e){ return rng() < 0.5 ? e : [e[1], e[0]]; }
  function coordNet(rng, n, {allowDiff=false, allowOpp=true, chain=false}={}){
    const edges = chain ? chainEdges(n) : randomTree(rng, n);
    const kinds = ["eq"].concat(allowOpp ? ["neg"] : [], allowDiff ? ["neq"] : []);
    const cons = edges.map(e => { const [a,b] = orient(rng, e); return {k:pick(rng, kinds), a, b}; });
    return {frame:"coordination", domain:"coord", cons};
  }
  function cmpNet(rng, n, {dom="quantity", amounts=false, chain=false, extraEdge=false}={}){
    const edges = chain ? chainEdges(n) : randomTree(rng, n);
    if(extraEdge && n >= 4){ for(let g=0; g<20; g++){ const a = int(rng, n), b = int(rng, n); if(a !== b && !edges.some(e => (e[0]===a&&e[1]===b)||(e[0]===b&&e[1]===a))){ edges.push([a,b]); break; } } }
    const cons = edges.map(e => { const [a,b] = orient(rng, e); const k = rng() < 0.5 ? "gt" : "lt"; const c = {k, a, b}; if(amounts) c.d = 1 + int(rng, 4); return c; });
    return {frame:amounts ? "amount" : "comparison", domain:amounts ? "amt" : "cmp", dom, cons};
  }
  function withTerms(net, terms){ net.terms = terms; return net; }

  // ---- ask builders ------------------------------------------------------------------------
  const YNC = ["YES","NO","CAN'T TELL"];
  function questionFor(net, x, y, r){
    const X = net.terms[x], Y = net.terms[y];
    if(net.frame === "coordination") return {eq:`Is ${X} the SAME as ${Y}?`, neg:`Is ${X} the OPPOSITE of ${Y}?`, neq:`Is ${X} DIFFERENT from ${Y}?`}[r.k];
    const W = DOMAIN_WORDS[net.dom || "quantity"];
    if(net.dom === "time") return {gt:`Did ${X} happen AFTER ${Y}?`, lt:`Did ${X} happen BEFORE ${Y}?`, eq:`Did ${X} happen at the SAME time as ${Y}?`}[r.k];
    return `Is ${X} ${W.q[r.k]} ${Y}?`;
  }
  function relSentence(net, x, y, type, d){
    const X = net.terms[x], Y = net.terms[y];
    if(type === "cant") return `${X} and ${Y}: can't tell`;
    if(net.frame === "coordination") return `${X} ${COORD_WORDS[type]} ${Y}`;
    const W = DOMAIN_WORDS[net.dom || "quantity"];
    if(d && (type === "gt" || type === "lt")) return `${X} ${type === "gt" ? W.gtd(d) : W.ltd(d)} ${Y}`;
    return `${X} ${W[type]} ${Y}`;
  }
  // Path explanation along the premise graph (composition, step by step).
  function pathBetween(net, x, y){
    const n = net.terms.length, prev = new Array(n).fill(-1), via = new Array(n).fill(-1), seen = new Array(n).fill(false), q = [x]; seen[x] = true;
    while(q.length){ const v = q.shift(); if(v === y) break; net.cons.forEach((c, i) => { const w = c.a === v ? c.b : (c.b === v ? c.a : -1); if(w >= 0 && !seen[w]){ seen[w] = true; prev[w] = v; via[w] = i; q.push(w); } }); }
    if(!seen[y]) return null;
    const path = []; for(let v = y; v !== x; v = prev[v]) path.unshift(via[v]);
    return path.map(i => net.cons[i]);
  }
  function explainPath(net, x, y){
    const path = pathBetween(net, x, y); if(!path) return [];
    return path.map(c => premiseSentence(net, c));
  }
  function modelLine(net, vals, highlight){
    const lo = Math.min(...vals), hi = Math.max(...vals), span = Math.max(1, hi - lo);
    const W = 300, pad = 22, y = 30;
    const byVal = new Map(); net.terms.forEach((t, i) => { const v = vals[i]; if(!byVal.has(v)) byVal.set(v, []); byVal.get(v).push(t); });
    let marks = "";
    for(const [v, ts] of byVal){ const xpos = pad + (v - lo) / span * (W - 2*pad); marks += `<circle cx="${xpos.toFixed(1)}" cy="${y}" r="5" class="${ts.some(t => highlight.includes(t)) ? "v8-dot-hi" : "v8-dot"}"/><text x="${xpos.toFixed(1)}" y="${y-11}" class="v8-dot-label">${esc(ts.join("·"))}</text><text x="${xpos.toFixed(1)}" y="${y+20}" class="v8-dot-val">${v}</text>`; }
    const zero = net.frame === "coordination" && lo < 0 && hi > 0 ? `<line x1="${(pad + (0 - lo) / span * (W - 2*pad)).toFixed(1)}" x2="${(pad + (0 - lo) / span * (W - 2*pad)).toFixed(1)}" y1="${y-6}" y2="${y+6}" class="v8-zero"/>` : "";
    return `<svg class="v8-model" viewBox="0 0 ${W} 58" role="img" aria-label="one arrangement that fits every premise"><line x1="${pad}" x2="${W-pad}" y1="${y}" y2="${y}" class="v8-axis"/>${zero}${marks}</svg>`;
  }

  // ---- item builders -----------------------------------------------------------------------
  // Each returns {net?, premises:[html], asks:[{question, format, options, answer, explain:[], id}], features, reviewHtml, reasons, summary}
  function ynAsk(ctx, net, x, y, r, {allowCant=true, kind="yn"}={}){
    const st = modal(net, x, y, r);
    const q = questionFor(net, x, y, r);
    if(!allowCant && st.status === "cant") return null;
    const options = allowCant ? YNC : ["YES","NO"];
    const answer = options.indexOf(st.status === "yes" ? "YES" : st.status === "no" ? "NO" : "CAN'T TELL");
    return {question:q, format:allowCant ? "choice" : "bool", options:allowCant ? options : undefined, answer:allowCant ? answer : st.status === "yes", status:st.status, modal:st, x, y, r};
  }
  // Generate a network whose modal answer for (x,y,r) equals the balanced target.
  function targetedYN(ctx, spec){
    const {n, make, rels, allowCant, kindKey} = spec;
    const targets = allowCant ? ["yes","no","cant"] : ["yes","no"];
    const target = pickTarget(ctx, kindKey, targets);
    for(let tries = 0; tries < 220; tries++){
      const terms = makeTerms(ctx.rng, n); if(!terms) continue;
      const net = withTerms(make(ctx.rng), terms);
      const x = int(ctx.rng, n); let y = int(ctx.rng, n); if(y === x) y = (x + 1 + int(ctx.rng, n-1)) % n;
      if(spec.farPair){ const p = pathBetween(net, x, y); if(!p || p.length < Math.min(spec.farPair, n-1)) continue; }
      if(spec.notAdjacent && net.cons.some(c => (c.a===x&&c.b===y)||(c.a===y&&c.b===x))) continue;
      const r = {k:pick(ctx.rng, rels)};
      const ask = ynAsk(ctx, net, x, y, r, {allowCant});
      if(!ask || ask.status !== target) continue;
      noteTarget(ctx, kindKey, target);
      return {net, ask};
    }
    return null;
  }
  function explainYN(net, ask){
    const reasons = [];
    if(ask.status === "cant"){
      reasons.push("CAN'T TELL: the statements allow both answers. The two MODELS each fit every statement, yet they disagree on the question.");
    } else {
      const lines = explainPath(net, ask.x, ask.y);
      if(lines.length) reasons.push(`Chain: ${lines.join(" · ")}.`);
      const d = derive(net, ask.x, ask.y);
      reasons.push(ask.r ? `So ${relSentence(net, ask.x, ask.y, d.type, d.d)}: the answer is ${ask.status === "yes" ? "YES" : "NO"}.` : `So ${relSentence(net, ask.x, ask.y, d.type, d.d)}.`);
    }
    if(net.frame === "coordination") reasons.push("OPPOSITE means the mirror value on one scale, so each thing has exactly one opposite, and the opposite of an opposite is the SAME.");
    return reasons;
  }
  function reviewModels(net, ask){
    const hi = [net.terms[ask.x], net.terms[ask.y]].filter(Boolean);
    if(ask.status === "cant" && ask.modal?.witnessFor && ask.modal?.witnessAgainst) return `<div class="v8-models"><div><h5>Fits every statement, and here the answer is YES</h5>${modelLine(net, ask.modal.witnessFor, hi)}</div><div><h5>Also fits every statement, but here the answer is NO</h5>${modelLine(net, ask.modal.witnessAgainst, hi)}</div></div>`;
    const m = ask.modal?.witnessFor || ask.modal?.witnessAgainst || solve(net.terms.length, net.cons, DOMAINS[net.domain]);
    return m ? `<div class="v8-models"><div><h5>one arrangement that fits every premise</h5>${modelLine(net, m, hi)}</div></div>` : "";
  }
  function netPremises(net, rng, {scramble=false, cued=false}={}){
    const order = scramble ? shuffle(rng, net.cons.map((_, i) => i)) : net.cons.map((_, i) => i);
    return order.map((ci, i) => premiseHtml(net, net.cons[ci], i, order.length, {cued}));
  }
  function premiseListHtml(net, cued){
    return `<ol class="v8-premise-list">${net.cons.map(c => `<li>${cued && net.cues ? `${esc(net.terms[c.a])} ${glyphSvg(net.cues[c.k])} ${esc(net.terms[c.b])} <span class="v8-muted">(${esc(relText({...net, cues:null}, c, false).text)})</span>` : esc(premiseSentence(net, c))}</li>`).join("")}</ol>`;
  }

  // Step 0 — mutual entailment.
  function bME(ctx, {frames}){
    const frame = pick(ctx.rng, frames);
    const kindKey = `me:${frame}`;
    const target = pickTarget(ctx, kindKey, ["yes","no"]);
    for(let t=0; t<60; t++){
      const terms = makeTerms(ctx.rng, 2); if(!terms) continue;
      let net, r;
      if(frame === "coordination"){
        const k = pick(ctx.rng, ctx.level >= 1 ? ["eq","neq","neg"] : ["eq","neq"]);
        net = withTerms({frame:"coordination", domain:"coord", cons:[{k, a:0, b:1}]}, terms);
        r = {k:pick(ctx.rng, ctx.level >= 1 ? ["eq","neq","neg"] : ["eq","neq"])};
      } else {
        const dom = pick(ctx.rng, ["quantity","time"]);
        net = withTerms({frame:"comparison", domain:"cmp", dom, cons:[{k:pick(ctx.rng, ["gt","lt"]), a:0, b:1}]}, terms);
        r = {k:pick(ctx.rng, ["gt","lt","eq"])};
      }
      const ask = ynAsk(ctx, net, 1, 0, r, {allowCant:false});   // ask about the converse direction
      if(!ask || ask.status !== target) continue;
      noteTarget(ctx, kindKey, target);
      return {net, ask, step:"0", frame:frame === "coordination" ? "coordination" : net.dom};
    }
    return null;
  }
  // Step 1 — combinatorial entailment.
  function bCE(ctx, {frame, n, allowCant, allowDiff, scramble, dom, amounts, chain, einstellung}){
    const rels = frame === "coordination" ? (allowDiff ? ["eq","neg","neq"] : ["eq","neg"]) : ["gt","lt","eq"];
    const res = targetedYN(ctx, {n, allowCant, kindKey:`ce:${frame}:${allowCant?3:2}`, farPair:Math.min(n-1, chain ? n-1 : 2), notAdjacent:true, rels,
      make:rng => frame === "coordination" ? coordNet(rng, n, {allowDiff, chain:chain || einstellung}) : cmpNet(rng, n, {dom:dom || pick(rng, ["quantity","time","x","y"]), amounts, chain})});
    if(!res) return null;
    return {...res, step:"1", frame:frame === "coordination" ? "coordination" : res.net.dom, scramble, einstellung};
  }
  // Step 1.5 — classify the derived relation (4 options).
  function bClassify(ctx, {frame, n, scramble}){
    const kindKey = `cls:${frame}`;
    for(let t=0; t<200; t++){
      const terms = makeTerms(ctx.rng, n); if(!terms) continue;
      const net = withTerms(frame === "coordination" ? coordNet(ctx.rng, n, {allowDiff:true}) : cmpNet(ctx.rng, n, {dom:pick(ctx.rng, ["quantity","time","x","y"])}), terms);
      const x = 0, y = n - 1;
      const p = pathBetween(net, x, y); if(!p || p.length < 2) continue;
      const d = derive(net, x, y);
      let options, correct;
      if(frame === "coordination"){
        options = ["SAME","OPPOSITE","Different (not surely opposite)","CAN'T TELL"];
        correct = {eq:0, neg:1, neq:2, cant:3}[d.type];
      } else {
        const C = DOMAIN_WORDS[net.dom].cls; options = [C.gt, C.lt, C.eq, "CAN'T TELL"];
        correct = {gt:0, lt:1, eq:2, cant:3}[d.type];
      }
      if(!Number.isInteger(correct)) continue;
      // Comparison networks here contain only MORE/LESS links, so SAME is a distractor, never the key.
      const target = pickTarget(ctx, kindKey, frame === "coordination" ? ["0","1","2","3"] : ["0","1","3"]);
      if(String(correct) !== target && t < 160) continue;
      noteTarget(ctx, kindKey, String(correct));
      const q = net.frame === "coordination" ? `How is ${terms[x]} related to ${terms[y]}?` : (net.dom === "time" ? `When did ${terms[x]} happen, compared with ${terms[y]}?` : `Where does ${terms[x]} stand compared with ${terms[y]}?`);
      const ask = {question:q, format:"choice", options, answer:correct, status:d.type === "cant" ? "cant" : "det", x, y, modal:d.type === "cant" ? modal(net, x, y, frame === "coordination" ? {k:"eq"} : {k:"gt"}) : {witnessFor:solve(n, net.cons, DOMAINS[net.domain])}};
      return {net, ask, step:"1.5", frame:frame === "coordination" ? "coordination" : net.dom, scramble};
    }
    return null;
  }
  // Step 2 — relations between relations: is x→y the same relation as u→w?
  function bRelOfRel(ctx, {n}){
    const kindKey = "ror";
    const target = pickTarget(ctx, kindKey, ["same","reverse","different","cant"]);
    for(let t=0; t<300; t++){
      const coordFrame = ctx.rng() < 0.45;
      const terms = makeTerms(ctx.rng, n); if(!terms) continue;
      const net = withTerms(coordFrame ? coordNet(ctx.rng, n, {allowDiff:ctx.level >= 9}) : cmpNet(ctx.rng, n, {dom:pick(ctx.rng, ["quantity","time"])}), terms);
      const idx = shuffle(ctx.rng, [...Array(n).keys()]);
      const [x, y, u, w] = idx;
      if([x,y,u,w].some(v => v === undefined)) continue;
      const r1 = derive(net, x, y), r2 = derive(net, u, w);
      let rel;
      if(r1.type === "cant" || r2.type === "cant") rel = "cant";
      else if(r1.type === r2.type) rel = "same";
      else if((r1.type === "gt" && r2.type === "lt") || (r1.type === "lt" && r2.type === "gt")) rel = "reverse";
      else rel = "different";
      if(coordFrame && rel === "reverse") continue;
      if(rel !== target && t < 240) continue;
      noteTarget(ctx, kindKey, rel);
      const options = ["The SAME relation","The REVERSE relation","A DIFFERENT relation","CAN'T TELL"];
      const answer = {same:0, reverse:1, different:2, cant:3}[rel];
      const q = `Compare how ${terms[x]} relates to ${terms[y]} with how ${terms[u]} relates to ${terms[w]}. What is the relation between those two relations?`;
      return {net, step:"2", frame:coordFrame ? "coordination" : net.dom, ask:{question:q, format:"choice", options, answer, status:rel, x, y, u, w, r1, r2, modal:{witnessFor:solve(n, net.cons, DOMAINS[net.domain])}}};
    }
    return null;
  }
  // Step 2.5 — composition with amounts: A→B and B→C (and further) compose like signed numbers.
  function bCompose(ctx, {n}){
    const kindKey = "compose";
    for(let t=0; t<200; t++){
      const terms = makeTerms(ctx.rng, n); if(!terms) continue;
      const exact = ctx.rng() < 0.75;
      const net = withTerms(cmpNet(ctx.rng, n, {dom:"quantity", amounts:true, chain:true}), terms);
      if(!exact){ const i = int(ctx.rng, net.cons.length); delete net.cons[i].d; net.frame = "amount"; }
      const x = 0, y = n - 1;
      const d = derive(net, x, y);
      let correctText;
      if(d.type === "eq") correctText = "the SAME";
      else if(d.type === "gt" || d.type === "lt") correctText = d.exact ? `${d.d} ${d.type === "gt" ? "MORE" : "LESS"}` : `${d.type === "gt" ? "MORE" : "LESS"}, amount unknown`;
      else correctText = "CAN'T TELL";
      const target = pickTarget(ctx, kindKey, ["exact","inexact"]);
      const isExact = !!d.exact || d.type === "eq";
      if((target === "exact") !== isExact && t < 150) continue;
      noteTarget(ctx, kindKey, isExact ? "exact" : "inexact");
      // near-miss distractors: sign flip, amount off by the last step, and the other kind of answer
      const cands = new Set([correctText]);
      if(d.exact){ cands.add(`${d.d} ${d.type === "gt" ? "LESS" : "MORE"}`); cands.add(`${d.d + 1 + int(ctx.rng, 2)} ${d.type === "gt" ? "MORE" : "LESS"}`); cands.add(d.d > 1 ? `${d.d - 1} ${d.type === "gt" ? "MORE" : "LESS"}` : "CAN'T TELL"); }
      else if(d.type === "gt" || d.type === "lt"){ cands.add(`${d.type === "gt" ? "LESS" : "MORE"}, amount unknown`); cands.add("CAN'T TELL"); cands.add(`${1 + int(ctx.rng, 5)} ${d.type === "gt" ? "MORE" : "LESS"}`); }
      else { cands.add("the SAME"); cands.add(`${1 + int(ctx.rng, 4)} MORE`); cands.add(`${1 + int(ctx.rng, 4)} LESS`); }
      if(d.type === "eq"){ cands.add("1 MORE"); cands.add("1 LESS"); cands.add("CAN'T TELL"); }
      const opts = shuffle(ctx.rng, [...cands].slice(0, 4));
      if(opts.length < 4 || new Set(opts).size < 4) continue;
      const answer = opts.indexOf(correctText); if(answer < 0) continue;
      const q = `Put the steps together: how does ${terms[x]} compare with ${terms[y]}?`;
      return {net, step:"2.5", frame:"amount", ask:{question:q, format:"choice", options:opts, answer, status:d.type, x, y, d, modal:{witnessFor:solve(n, net.cons, DOMAINS[net.domain])}}};
    }
    return null;
  }
  // Step 3 — relating two networks: which term in network 2 plays the role BEK plays in network 1?
  function bStructure(ctx, {n}){
    for(let t=0; t<200; t++){
      const terms = makeTerms(ctx.rng, 2*n); if(!terms) continue;
      const dom = pick(ctx.rng, ["quantity","time"]);
      const base = cmpNet(ctx.rng, n, {dom, chain:ctx.rng() < 0.5});
      const net1 = withTerms({...base, cons:base.cons.map(c => ({...c}))}, terms.slice(0, n));
      // network 2: the same shape under a renaming (permutation), premises shuffled
      const perm = shuffle(ctx.rng, [...Array(n).keys()]);
      const net2 = withTerms({...base, cons:base.cons.map(c => ({...c, a:perm[c.a], b:perm[c.b]}))}, terms.slice(n));
      // role must be unique: the derived order of every term must be determinate relative to all others
      const determinate = [...Array(n).keys()].every(i => [...Array(n).keys()].every(j => i === j || derive(net1, i, j).type !== "cant"));
      if(!determinate) continue;
      const src = int(ctx.rng, n), mapped = perm[src];
      const options = shuffle(ctx.rng, [...Array(n).keys()].map(i => net2.terms[i])).slice(0, Math.min(4, n));
      if(!options.includes(net2.terms[mapped])) options[int(ctx.rng, options.length)] = net2.terms[mapped];
      const uniq = [...new Set(options)]; if(uniq.length < 3) continue;
      const answer = uniq.indexOf(net2.terms[mapped]);
      const combined = {frame:base.frame, domain:base.domain, dom, terms:terms.slice(), cons:net1.cons.concat(net2.cons.map(c => ({...c, a:c.a + n, b:c.b + n})))};
      return {net:combined, net1, net2, step:"3", frame:dom, twoNets:true, ask:{question:`The second story has the same shape as the first. Which term plays the role that ${net1.terms[src]} plays in the first story?`, format:"choice", options:uniq, answer, status:"det", x:src, y:n + mapped, modal:{witnessFor:solve(2*n, combined.cons, DOMAINS[combined.domain])}}};
    }
    return null;
  }
  // Step 3.5 — the network under a transformation (flexibility).
  function bTransform(ctx, {n}){
    const kindKey = "xf";
    const target = pickTarget(ctx, kindKey, ["yes","no","cant"]);
    for(let t=0; t<240; t++){
      const terms = makeTerms(ctx.rng, n); if(!terms) continue;
      const coordFrame = ctx.rng() < 0.5;
      const net = withTerms(coordFrame ? coordNet(ctx.rng, n, {allowDiff:true}) : cmpNet(ctx.rng, n, {dom:"quantity"}), terms);
      const swap = coordFrame ? {eq:"neg", neg:"eq", neq:"neq"} : {gt:"lt", lt:"gt"};
      const tnet = {...net, cons:net.cons.map(c => ({...c, k:swap[c.k] || c.k}))};
      const x = 0, y = n - 1; const p = pathBetween(net, x, y); if(!p || p.length < 2) continue;
      const r = {k:coordFrame ? pick(ctx.rng, ["eq","neg"]) : pick(ctx.rng, ["gt","lt"])};
      const ask = ynAsk(ctx, tnet, x, y, r, {allowCant:true});
      if(ask.status !== target && t < 200) continue;
      noteTarget(ctx, kindKey, ask.status);
      const instr = coordFrame ? "Now suppose every SAME in those statements meant OPPOSITE, and every OPPOSITE meant SAME (DIFFERENT stays DIFFERENT)." : "Now suppose every MORE in those statements meant LESS, and every LESS meant MORE.";
      ask.question = `${instr} ${ask.question}`;
      return {net, tnet, ask, step:"3.5", frame:coordFrame ? "coordination" : "quantity", reversal:true};
    }
    return null;
  }
  // Hierarchy with asymmetric inheritance.
  const PROPS = ["glow","hum","float","spin","ring","fold","chirp","shimmer"];
  function bHierarchy(ctx){
    const kindKey = "hier";
    const target = pickTarget(ctx, kindKey, ["yes","no","cant"]);
    for(let t=0; t<200; t++){
      const terms = makeTerms(ctx.rng, 4); if(!terms) continue;
      // tree: 0 ⊂ 1 ⊂ 2, and 3 ⊂ 1 (sibling of 0) — shown in random order
      const [A, B, C, D] = terms;
      const prop = pick(ctx.rng, PROPS);
      const propAt = pick(ctx.rng, [[C, "all"], [B, "all"], [A, "all"], [C, "none"], [D, "all"]]);
      const facts = [{t:"sub", a:A, b:B}, {t:"sub", a:B, b:C}, {t:"sub", a:D, b:B}, {t:"prop", cls:propAt[0], q:propAt[1]}];
      const parent = {[A]:B, [B]:C, [D]:B, [C]:null};
      const ancestors = x => { const out = [x]; while(parent[out.at(-1)]) out.push(parent[out.at(-1)]); return out; };
      const qk = pick(ctx.rng, ["inc","inc","prop","prop","someprop"]);
      let question, status;
      if(qk === "inc"){
        const [x, y] = pick(ctx.rng, [[A, C], [C, A], [A, D], [D, C], [B, A]]);
        question = `Is every ${x} a ${y}?`;
        status = ancestors(x).includes(y) ? "yes" : "cant";   // inclusion never reverses; siblings are undetermined
      } else if(qk === "prop"){
        const x = pick(ctx.rng, [A, B, C, D]);
        question = `Can every ${x} ${prop}?`;
        const up = ancestors(x);
        if(up.includes(propAt[0])) status = propAt[1] === "all" ? "yes" : "no";
        else status = "cant";
      } else {
        const x = pick(ctx.rng, [B, C]);
        question = `Can at least one ${x} ${prop}?`;
        // every member of a subclass is a member of x; a non-empty subclass carrying the property makes it true
        const subs = [A, B, D, C].filter(s => ancestors(s).includes(x));
        if(ancestors(x).includes(propAt[0])) status = propAt[1] === "all" ? "yes" : "no";
        else if(propAt[1] === "all" && subs.includes(propAt[0])) status = "yes";
        else status = "cant";
      }
      if(status !== target && t < 160) continue;
      noteTarget(ctx, kindKey, status);
      const lines = facts.map(f => f.t === "sub" ? `Every ${f.a} is a ${f.b}.` : (f.q === "all" ? `Every ${f.cls} can ${prop}.` : `No ${f.cls} can ${prop}.`));
      const order = shuffle(ctx.rng, lines);
      return {step:"1", frame:"hierarchy", hierarchy:{lines, order, question, status, prop}, ask:{question, format:"choice", options:YNC, answer:{yes:0, no:1, cant:2}[status], status}};
    }
    return null;
  }
  // Conditional (IF … THEN) over propositions, with contrapositive / converse / inverse.
  function bConditional(ctx){
    const kindKey = "cond";
    const target = pickTarget(ctx, kindKey, ["yes","no","cant"]);
    for(let t=0; t<240; t++){
      const terms = makeTerms(ctx.rng, 3); if(!terms) continue;
      const neg2 = ctx.level >= 9 && ctx.rng() < 0.35;
      const prem = [{a:0, b:1, nb:false}, {a:1, b:2, nb:neg2}];     // A→B, B→(¬)C
      const assumeVar = int(ctx.rng, 3), assumeVal = ctx.rng() < 0.5, askVar = (assumeVar + 1 + int(ctx.rng, 2)) % 3;
      const models = [];
      for(let m=0;m<8;m++){ const v = [!!(m&1), !!(m&2), !!(m&4)]; if(prem.every(p => !v[p.a] || (v[p.b] !== p.nb))) if(v[assumeVar] === assumeVal) models.push(v); }
      if(!models.length) continue;
      const all = models.every(v => v[askVar]), none = models.every(v => !v[askVar]);
      const status = all ? "yes" : none ? "no" : "cant";
      if(status !== target && t < 200) continue;
      noteTarget(ctx, kindKey, status);
      const T = terms, happens = (i, pos) => `${T[i]} ${pos ? "happens" : "does NOT happen"}`;
      const lines = prem.map(p => `If ${T[p.a]} happens, then ${T[p.b]} ${p.nb ? "does NOT happen" : "happens"}.`);
      const question = `Suppose ${happens(assumeVar, assumeVal)}. Does ${T[askVar]} happen?`;
      return {step:"1", frame:"conditional", conditional:{lines, question, status}, ask:{question, format:"choice", options:YNC, answer:{yes:0, no:1, cant:2}[status], status}};
    }
    return null;
  }
  // Deictic frames: I/YOU, HERE/THERE; simple, reversed, double-reversed; objects may be numbers.
  function glyphFor(rep, value, seed){ try{ return typeof relRefReferenceGlyphSVG === "function" ? relRefReferenceGlyphSVG({rep, value, seed}) : ""; }catch(_){ return ""; } }
  function repFor(rng, v){ let reps = []; try{ reps = (typeof hardAllowedReps === "function" ? hardAllowedReps(v) : ["dots","ten","dice"]).filter(r => ["dots","ten","dice","tally","finger","domino","cluster","grid","abacus","card","coins","cube"].includes(r)); }catch(_){ reps = ["dots"]; } return reps.length ? pick(rng, reps) : "dots"; }
  function bDeictic(ctx, {level}){
    for(let t=0; t<120; t++){
      const numeric = level >= 8 && ctx.rng() < 0.6;
      const words = makeTerms(ctx.rng, 2); if(!words) continue;
      const me = {loc:pick(ctx.rng, ["HERE","THERE"])}; const you = {loc:me.loc === "HERE" ? "THERE" : "HERE"};
      let meObj, youObj, meHtml, youHtml;
      if(numeric){
        const a = 2 + int(ctx.rng, 8); let b = 2 + int(ctx.rng, 8); if(b === a) b = a + 1;
        meObj = a; youObj = b;
        meHtml = glyphFor(repFor(ctx.rng, a), a, 11 + t); youHtml = glyphFor(repFor(ctx.rng, b), b, 29 + t);
        if(!meHtml || !youHtml) continue;
      } else { meObj = words[0]; youObj = words[1]; meHtml = term(meObj); youHtml = term(youObj); }
      const kinds = level >= 8 ? ["reversed","double","reversed_loc","double"] : ["simple","reversed","reversed","reversed_loc"];
      const kind = pick(ctx.rng, kinds);
      const personSwap = kind === "reversed" || kind === "double", locSwap = kind === "reversed_loc" || kind === "double";
      // "More than I have now?" is only informative after a person swap (otherwise it is always NO).
      const askWhat = numeric && personSwap && ctx.rng() < 0.6 ? "compare" : pick(ctx.rng, locSwap ? ["where","where","what"] : ["where","what"]);
      // I after swaps
      let myLoc = personSwap ? you.loc : me.loc; if(locSwap) myLoc = myLoc === "HERE" ? "THERE" : "HERE";
      const myObj = personSwap ? youObj : meObj;
      const cond = kind === "simple" ? "" : kind === "reversed" ? "If I were you and you were me, " : kind === "reversed_loc" ? "If HERE were THERE and THERE were HERE, " : "If I were you and you were me, and HERE were THERE and THERE were HERE, ";
      let question, options, answer;
      if(askWhat === "where"){ question = `${cond}where would I be?`.replace(/^w/, "W"); options = ["HERE","THERE"]; answer = options.indexOf(myLoc); }
      else if(askWhat === "what"){ question = `${cond}what would I have?`.replace(/^w/, "W"); options = numeric ? [String(meObj), String(youObj)] : [meObj, youObj]; answer = options.indexOf(String(myObj)); }
      else { question = `${cond}would I have MORE than I have now?`; options = ["YES","NO"]; answer = myObj > meObj ? 0 : 1; }
      const kindKey = `deictic:${askWhat}`;
      const tgt = pickTarget(ctx, kindKey, ["0","1"]); if(String(answer) !== tgt && t < 90) continue; noteTarget(ctx, kindKey, String(answer));
      const frames = [
        `<div class="v8-frame v8-deictic"><div class="v8-premise"><span class="v8-deixis">I</span><span class="v8-rel">am</span><span class="v8-deixis">${me.loc}</span><span class="v8-rel">with</span>${meHtml}</div></div>`,
        `<div class="v8-frame v8-deictic"><div class="v8-premise"><span class="v8-deixis">YOU</span><span class="v8-rel">are</span><span class="v8-deixis">${you.loc}</span><span class="v8-rel">with</span>${youHtml}</div></div>`
      ];
      const why = [
        `Start: I am ${me.loc} with ${meObj}; you are ${you.loc} with ${youObj}.`,
        personSwap ? "Swapping I and YOU gives me your place and what you have." : null,
        locSwap ? "Swapping HERE and THERE relabels the places; what we hold stays with us." : null,
        kind === "double" ? "Two swaps of place cancel: I end up in my own place, but with what you have." : null,
        `So I would be ${myLoc}, with ${myObj}.`
      ].filter(Boolean);
      return {step:personSwap && locSwap ? "2" : personSwap || locSwap ? "1" : "0", frame:"deictic", deictic:{frames, why}, numeric, ask:{question, format:options.length === 2 && options[0] === "YES" ? "bool" : "choice", options:options[0] === "YES" ? undefined : options, answer:options[0] === "YES" ? answer === 0 : answer, status:"det"}};
    }
    return null;
  }
  // Transformation of function: a number flows through the network (bridge to the numeric core).
  function bTransferFunction(ctx, {n, withOpposite}){
    for(let t=0; t<220; t++){
      const terms = makeTerms(ctx.rng, n); if(!terms) continue;
      const anchorVal = 2 + int(ctx.rng, 9);
      const cons = [];
      for(let i=1;i<n;i++){
        const a = i, b = int(ctx.rng, i);
        const kind = withOpposite && i === n-1 && ctx.rng() < 0.5 ? "neg" : pick(ctx.rng, ["eq","gt","lt","gt","lt"]);
        const c = {k:kind, a, b}; if(kind === "gt" || kind === "lt") c.d = 1 + int(ctx.rng, 4); cons.push(c);
      }
      const net = withTerms({frame:"amount", domain:"amt", dom:"quantity", cons, anchor:{i:0, v:anchorVal}}, terms);
      const vals = new Array(n).fill(null); vals[0] = anchorVal;
      for(const c of cons){ const base = vals[c.b]; vals[c.a] = c.k === "eq" ? base : c.k === "neg" ? -base : c.k === "gt" ? base + c.d : base - c.d; }
      const target = n - 1, val = vals[target];
      if(!Number.isFinite(val) || Math.abs(val) > 20) continue;
      const cands = new Set([val, val + 2, val - 2, anchorVal, -val, val + 1].filter(v => Number.isFinite(v)));
      const opts = shuffle(ctx.rng, [...cands].filter(v => v !== val).slice(0, 3).concat([val]));
      if(new Set(opts).size < 4) continue;
      const rep = repFor(ctx.rng, anchorVal); const glyph = glyphFor(rep, anchorVal, 97 + t); if(!glyph) continue;
      const anchorFrame = `<div class="v8-frame"><div class="v8-premise">${term(terms[0])}<span class="v8-rel v8-rel-same">is this many:</span><span class="v8-anchor">${glyph}</span></div></div>`;
      const question = `What number is ${terms[target]}?`;
      return {net, step:"1.5", frame:"transformation", numeric:true, anchorFrame, vals, ask:{question, format:"choice", options:opts.map(String), answer:opts.indexOf(val), status:"det", x:target, y:0, modal:{witnessFor:vals}}};
    }
    return null;
  }

  // ---- level plan --------------------------------------------------------------------------
  const MAX_LEVEL = 13;
  const MENU = [
    {id:"me",      min:0, max:3,  build:ctx => bME(ctx, {frames:ctx.level >= 1 ? ["coordination","comparison"] : ["coordination"]})},
    {id:"ce2c",    min:2, max:6,  build:ctx => bCE(ctx, {frame:"coordination", n:3, allowCant:false, allowDiff:false, chain:true})},
    {id:"ce2q",    min:3, max:7,  build:ctx => bCE(ctx, {frame:"comparison", n:3, allowCant:false, chain:true, scramble:ctx.level >= 4})},
    {id:"ce3c",    min:4, max:9,  build:ctx => bCE(ctx, {frame:"coordination", n:4, allowCant:true, allowDiff:true, scramble:true})},
    {id:"ce3q",    min:5, max:9,  build:ctx => bCE(ctx, {frame:"comparison", n:4, allowCant:true, scramble:true})},
    {id:"hier",    min:5, max:MAX_LEVEL, build:ctx => bHierarchy(ctx)},
    {id:"cls",     min:6, max:MAX_LEVEL, build:ctx => bClassify(ctx, {frame:ctx.rng() < 0.5 ? "coordination" : "comparison", n:ctx.level >= 9 ? 5 : 4, scramble:true})},
    {id:"cond",    min:6, max:MAX_LEVEL, build:ctx => bConditional(ctx)},
    {id:"tof",     min:7, max:MAX_LEVEL, build:ctx => bTransferFunction(ctx, {n:ctx.level >= 10 ? 4 : 3, withOpposite:ctx.level >= 9})},
    {id:"deictic", min:7, max:MAX_LEVEL, build:ctx => bDeictic(ctx, {level:ctx.level})},
    {id:"ror",     min:8, max:MAX_LEVEL, build:ctx => bRelOfRel(ctx, {n:ctx.level >= 11 ? 5 : 4})},
    {id:"compose", min:9, max:MAX_LEVEL, build:ctx => bCompose(ctx, {n:ctx.level >= 11 ? 5 : 4})},
    {id:"cued",    min:10, max:MAX_LEVEL, build:ctx => { const r = ctx.rng() < 0.5 ? bCE(ctx, {frame:"coordination", n:4, allowCant:true, allowDiff:true, scramble:true}) : bCE(ctx, {frame:"comparison", n:4, allowCant:true, scramble:true}); if(r) r.cued = true; return r; }},
    {id:"struct",  min:11, max:MAX_LEVEL, build:ctx => bStructure(ctx, {n:ctx.level >= 12 ? 4 : 3})},
    {id:"xform",   min:12, max:MAX_LEVEL, build:ctx => bTransform(ctx, {n:4})},
    {id:"einst",   min:12, max:MAX_LEVEL, build:ctx => { const r = bCE(ctx, {frame:"coordination", n:6, allowCant:true, allowDiff:true, chain:true, einstellung:true}); if(r) r.einstellung = true; return r; }}
  ];
  function frameMs(level, extra=0){ return Math.round(Math.max(1350, 2700 - level * 95) + extra); }

  function assemble(item, ctx){
    const L = ctx.level, steps = [], maskMs = 320;
    const pushFrame = (html, ms, prompt) => { steps.push({type:"frame", html, ms, label:"RELATIONS", prompt}); steps.push({type:"mask", ms:maskMs}); };
    let reviewPremises = "", cued = false;
    if(item.cued && item.net && item.net.frame === "coordination" || item.cued && item.net){
      // Arbitrary cues: shapes stand for relations in this episode only.
      const kinds = [...new Set(item.net.cons.map(c => c.k))];
      const shapes = shuffle(ctx.rng, Object.keys(GLYPHS));
      item.net.cues = Object.fromEntries(kinds.map((k, i) => [k, shapes[i]]));
      cued = true;
      const legend = kinds.map(k => `<div class="v8-legend-row">${glyphSvg(item.net.cues[k])}<span>means</span><span class="v8-rel v8-rel-${REL_CLASS[k]}">${esc(relText({...item.net, cues:null}, {k}, false).text.replace(/^is (the )?|^happened /, "").toUpperCase())}</span></div>`).join("");
      pushFrame(`<div class="v8-frame v8-legend"><div class="v8-counter">KEY</div>${legend}</div>`, frameMs(L, 900), "KEY");
    }
    if(item.hierarchy){ item.hierarchy.order.forEach((line, i) => pushFrame(`<div class="v8-frame"><div class="v8-counter">${i+1} / ${item.hierarchy.order.length}</div><div class="v8-premise v8-sentence">${esc(line)}</div></div>`, frameMs(L, 500), `${i+1} / ${item.hierarchy.order.length}`)); reviewPremises = `<ol class="v8-premise-list">${item.hierarchy.lines.map(l => `<li>${esc(l)}</li>`).join("")}</ol>`; }
    else if(item.conditional){ const order = shuffle(ctx.rng, item.conditional.lines); order.forEach((line, i) => pushFrame(`<div class="v8-frame"><div class="v8-counter">${i+1} / ${order.length}</div><div class="v8-premise v8-sentence">${esc(line)}</div></div>`, frameMs(L, 600), `${i+1} / ${order.length}`)); reviewPremises = `<ol class="v8-premise-list">${item.conditional.lines.map(l => `<li>${esc(l)}</li>`).join("")}</ol>`; }
    else if(item.deictic){ item.deictic.frames.forEach((h, i) => pushFrame(h, frameMs(L, item.numeric ? 700 : 300), `${i+1} / 2`)); reviewPremises = `<ol class="v8-premise-list">${item.deictic.why.slice(0,1).map(l => `<li>${esc(l)}</li>`).join("")}</ol>`; }
    else if(item.net){
      if(item.anchorFrame) pushFrame(item.anchorFrame, frameMs(L, 800), "REMEMBER");
      if(item.twoNets){
        netPremises(item.net1, ctx.rng, {scramble:true}).forEach((h, i, a) => pushFrame(h.replace('class="v8-frame"', 'class="v8-frame v8-story-1"'), frameMs(L), `STORY 1 · ${i+1}/${a.length}`));
        netPremises(item.net2, ctx.rng, {scramble:true}).forEach((h, i, a) => pushFrame(h.replace('class="v8-frame"', 'class="v8-frame v8-story-2"'), frameMs(L), `STORY 2 · ${i+1}/${a.length}`));
        reviewPremises = `<h5>Story 1</h5>${premiseListHtml(item.net1, false)}<h5>Story 2</h5>${premiseListHtml(item.net2, false)}`;
      } else {
        const scramble = !!item.scramble || L >= 4;
        netPremises(item.net, ctx.rng, {scramble, cued}).forEach((h, i, a) => pushFrame(h, frameMs(L, cued ? 250 : 0), `${i+1} / ${a.length}`));
        reviewPremises = premiseListHtml(item.net, cued);
      }
    }
    steps.pop();                        // no mask between the last frame and the question… keep one short mask
    steps.push({type:"mask", ms:maskMs});
    const a = item.ask;
    steps.push({type:"ask", id:"relation", question:a.question, format:a.format, options:a.options, answer:a.answer, label:"RELATIONS", prompt:a.format === "choice" ? "CHOOSE" : "YES OR NO"});
    // Reversibility (Krutetskii): at higher levels, ask the converse right after, for simple relations.
    if(L >= 7 && item.net && !item.twoNets && item.step === "1" && a.r && a.status !== "cant" && ctx.rng() < 0.35 && item.net.frame !== "coordination"){
      const conv = {gt:"lt", lt:"gt", eq:"eq"}[a.r.k];
      if(conv){ const back = ynAsk(ctx, item.net, a.y, a.x, {k:conv}, {allowCant:true}); if(back){ steps.push({type:"ask", id:"converse", question:`And the other way round: ${back.question}`, format:"choice", options:YNC, answer:YNC.indexOf(back.status === "yes" ? "YES" : back.status === "no" ? "NO" : "CAN'T TELL"), label:"RELATIONS", prompt:"CHOOSE"}); item.converse = back; } }
    }
    return {steps, reviewPremises};
  }

  function featuresOf(item, L){
    const f = {};
    f[`rft.step:${item.step}`] = true;
    f[`rft.frame:${item.frame}`] = true;
    const n = item.net ? item.net.cons.length : item.hierarchy ? item.hierarchy.lines.length : item.conditional ? item.conditional.lines.length : 2;
    f[`rft.premises:${Math.min(6, n)}`] = true;
    if(item.ask.status === "cant") f["rft.indeterminate"] = true;
    if(item.cued) f["rft.cue:arbitrary"] = true;
    if(item.reversal) f["rft.reversal"] = true;
    if(item.einstellung) f["rft.einstellung"] = true;
    if(item.numeric) f["rft.numeric"] = true;
    if(item.net && item.net.frame === "coordination"){ const opp = item.net.cons.filter(c => c.k === "neg").length; if(opp) f[`rft.opposition:${Math.min(3, opp)}`] = true; }
    if(L >= 4) f["rft.scrambled"] = true;
    return f;
  }

  function reviewFor(item, assembled){
    return (result) => {
      const answers = (result.answers || []);
      const fmt = (ask, val) => ask.format === "choice" ? String((ask.options || [])[val] ?? "—") : (val === true ? "YES" : val === false ? "NO" : "—");
      const asks = assembled.steps.filter(s => s.type === "ask");
      const user = asks.map((s, i) => fmt(s, answers[i]?.value)).join(" · ");
      const correct = asks.map(s => fmt(s, s.answer)).join(" · ");
      let reasons = [];
      if(item.hierarchy){
        reasons = ["Inclusion flows one way: if every A is a B, not every B need be an A.", "A property of a whole class passes down to every sub-class; a property of a sub-class does not pass up to the whole class (though it shows that SOME members have it)."];
      } else if(item.conditional){
        reasons = ["If P then Q: when P holds, Q holds (forward). When Q fails, P must fail (contrapositive). Q holding, or P failing, settles nothing (converse and inverse)."];
      } else if(item.deictic){
        reasons = item.deictic.why;
      } else if(item.step === "2"){
        const a = item.ask; reasons = [`${relSentence(item.net, a.x, a.y, a.r1.type, a.r1.d)}; ${relSentence(item.net, a.u, a.w, a.r2.type, a.r2.d)}.`, "Relations are compared with the same frames as things: the same relation, its reverse (converse), or a different relation. If either one cannot be derived, the comparison cannot be told."];
      } else if(item.step === "2.5"){
        const lines = explainPath(item.net, item.ask.x, item.ask.y); reasons = [`Steps: ${lines.join(" · ")}.`, "Relations with amounts compose like signed numbers: MORE by a then LESS by b is MORE by a − b. A step without an amount leaves the total open."];
      } else if(item.step === "3"){
        reasons = ["Map the two stories by the position each term holds in its chain, not by its name. The roles line up one to one."];
      } else if(item.step === "3.5"){
        reasons = ["Apply the reversal to every statement first, then derive as usual."].concat(explainYN(item.tnet, item.ask));
      } else if(item.anchorFrame){
        reasons = [`Start from ${item.net.terms[0]} = ${item.vals[0]} and follow each statement: ${item.net.cons.map(c => premiseSentence(item.net, c)).join(" · ")}.`, `So ${item.net.terms[item.ask.x]} = ${item.vals[item.ask.x]}.`].concat(item.net.cons.some(c => c.k === "neg") ? ["The OPPOSITE of a number is its mirror across 0 (its additive inverse)."] : []);
      } else if(item.net){
        reasons = explainYN(item.net, item.ask);
        if(item.cued) reasons.unshift("The shapes meant what the KEY said for this episode only; the relations are derived exactly as with words.");
        if(item.einstellung) reasons.push("Counting OPPOSITEs works only while every link is SAME or OPPOSITE. A single DIFFERENT link breaks the chain.");
      }
      if(item.converse) reasons.push(`Reversing the question reverses the relation: ${item.converse.question.replace(/\?$/,"")} → ${item.converse.status === "yes" ? "YES" : item.converse.status === "no" ? "NO" : "CAN'T TELL"}.`);
      const models = item.net && item.ask.modal && !item.hierarchy && !item.conditional && !item.deictic ? reviewModels(item.step === "3.5" ? item.tnet : item.net, item.ask) : "";
      const html = `<div class="v8-review v8-review-rft"><section><h4>STATEMENTS</h4>${assembled.reviewPremises}</section>${models ? `<section><h4>MODELS</h4>${models}</section>` : ""}</div>`;
      return {title:"", question:asks.map(s => s.question).join("  |  "), userAnswer:user, correctAnswer:correct, reasons, html};
    };
  }

  function build(ctx){
    const L = Math.max(0, Math.min(MAX_LEVEL, ctx.level));
    const menu = MENU.filter(m => m.min <= L && L <= m.max);
    const forced = ctx.variant ? MENU.find(m => m.id === ctx.variant) : null;
    const weighted = menu.map(m => {
      const fresh = m.min === L ? 2.6 : m.min >= L - 2 ? 1.6 : 0.45;
      return {m, w:fresh * (ctx.featureWeight ? ctx.featureWeight(`rft.builder:${m.id}`) : 1)};
    });
    const pickMenu = () => { if(forced) return forced; const tot = weighted.reduce((s,x)=>s+x.w,0); let r = ctx.rng() * tot; for(const x of weighted){ r -= x.w; if(r <= 0) return x.m; } return weighted.at(-1).m; };
    for(let attempt = 0; attempt < 6; attempt++){
      const m = pickMenu(); const item = m.build({...ctx, level:L});
      if(!item) continue;
      item.builder = m.id;
      const assembled = assemble(item, {...ctx, level:L});
      const features = featuresOf(item, L); features[`rft.builder:${m.id}`] = true;
      return {
        family:FAMILY, catId:`rft_${m.id}`, contentSpecId:`v8.rft.${m.id}`, label:"RELATIONS",
        title:"Relational frames", summaryQuestion:assembled.steps.filter(s => s.type === "ask").map(s => s.question).join(" | "),
        steps:assembled.steps, features, review:reviewFor(item, assembled),
        frameTags:["relational_frame", `rft_step_${item.step}`, `rft_${item.frame}`].concat(item.ask.status === "cant" ? ["indeterminacy"] : []),
        mechanismTags:["derived_relational_responding","combinatorial_entailment"].concat(item.cued ? ["contextual_control"] : [], item.reversal ? ["relational_flexibility"] : []),
        executiveTags:["working_memory_update","relational_integration"].concat(item.ask.status === "cant" ? ["response_inhibition"] : []),
        demandVector:{relational_integration:Math.min(4, 1 + Number(String(item.step).replace(".5","")) ), working_memory:Math.min(4, assembled.steps.filter(s=>s.type==="frame").length/2)},
        atomics:[`rft_${m.id}`],
        rftItem:{builder:m.id, step:item.step, frame:item.frame, status:item.ask.status, x:item.ask.x, y:item.ask.y, r:item.ask.r || null,
          net:(item.tnet || item.net) ? {terms:(item.tnet || item.net).terms, cons:(item.tnet || item.net).cons, domain:(item.tnet || item.net).domain, frame:(item.tnet || item.net).frame} : null}
      };
    }
    return null;
  }

  // Level rule in the original's spirit: accuracy decides the direction, speed decides the pace.
  //   down  accuracy ≤ 50 % over the last 8 (or < 50 % over the last 4)
  //   up    fast-track: 5 in a row correct with a median answer time under the fast reference
  //         normal: 7 of the last 8 correct and no slower than the player's own median at this level
  //         breadth: 11 of the last 12 correct (slow but accurate still climbs, more slowly)
  const fastRtFor = L => 2200 + 220 * L;           // per question, on the META L1–L2 scale (rtL1Fast 1.8 s, rtL2Fast 3 s)
  const med = a => { const s = a.filter(Number.isFinite).slice().sort((x, y) => x - y); if(!s.length) return null; const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  function fluencyDecision(h, L){
    const last = n => h.slice(-n), acc = a => a.length ? a.reduce((s, x) => s + x.ok, 0) / a.length : 0;
    const okRts = a => a.filter(x => x.ok && Number.isFinite(x.rt)).map(x => x.rt);
    if((h.length >= 4 && acc(last(4)) < 0.5) || (h.length >= 8 && acc(last(8)) <= 0.5)) return {move:-1, why:"accuracy"};
    if(h.length >= 5 && acc(last(5)) === 1 && med(okRts(last(5))) <= fastRtFor(L)) return {move:1, why:"fast-track"};
    if(h.length >= 8 && acc(last(8)) >= 7 / 8){ const own = med(okRts(h)), recent = med(okRts(last(8))); if(own === null || recent === null || recent <= own) return {move:1, why:"accurate and at or above own speed"}; }
    if(h.length >= 12 && acc(last(12)) >= 11 / 12) return {move:1, why:"accurate over twelve items"};
    return {move:0, why:"hold"};
  }
  function onResult(result, a, info){
    const L = a.level, c = a.custom;
    const answers = result.answers || [];
    const rt = med(answers.map(x => Number(x.rt)));
    const flu = c.flu || (c.flu = {});
    const h = flu[L] || (flu[L] = []);
    h.push({ok:result.compoundCorrect ? 1 : 0, rt});
    flu[L] = h.slice(-30);
    a.win.push(result.compoundCorrect ? 1 : 0); a.win = a.win.slice(-8);
    const d = fluencyDecision(flu[L], L);
    c.lastDecision = {level:L, ...d};
    if(d.move > 0 && a.level < MAX_LEVEL){ a.level++; a.promotions++; a.win = []; }
    else if(d.move < 0 && a.level > 0){ a.level--; a.demotions++; a.win = []; }
  }
  coord.register({axis:AXIS, family:FAMILY, label:"RELATIONS", maxLevel:MAX_LEVEL, build, onResult,
    weight:(axes, a) => 1.6 + (a.level < 4 ? 0.4 : 0)});

  // ---- audit -------------------------------------------------------------------------------
  // Independent oracle: exhaustive enumeration over a small domain (no backtracking, no path logic).
  function bruteModal(net, x, y, r){
    const n = net.terms.length, dom = net.domain === "coord" ? [-3,-2,-1,1,2,3] : net.domain === "cmp" ? [0,1,2,3,4,5,6,7] : null;
    if(!dom || n > 6) return null;
    let anyTrue = false, anyFalse = false; const v = new Array(n).fill(0);
    const total = Math.pow(dom.length, n);
    for(let code = 0; code < total; code++){
      let c = code; for(let i=0;i<n;i++){ v[i] = dom[c % dom.length]; c = Math.floor(c / dom.length); }
      if(!net.cons.every(k => holds(k, v[k.a], v[k.b]))) continue;
      if(holds(r, v[x], v[y])) anyTrue = true; else anyFalse = true;
      if(anyTrue && anyFalse) return "cant";
    }
    if(!anyTrue && !anyFalse) return "inconsistent";
    return anyTrue ? "yes" : "no";
  }
  function runAudit(options={}){
    const blockers = [], warnings = [], per = {}, marg = {};
    const count = Math.max(10, Math.min(200, Number(options.perLevel) || 40));
    const axisState = {custom:{}};
    for(let L = 0; L <= MAX_LEVEL; L++){
      let built = 0, brute = 0;
      for(let i = 0; i < count; i++){
        const seed = coord._test.hash32(`rft-audit|${L}|${i}`);
        const ctx = {level:L, rng:coord._test.mulberry(seed), seed, axisState, featureWeight:() => 1};
        const spec = build(ctx);
        if(!spec){ warnings.push(`L${L}#${i}: no item`); continue; }
        built++;
        const errs = runtime.validateSpec(spec); if(errs.length) blockers.push(`L${L} ${spec.catId}: ${errs.join("; ")}`);
        const asks = spec.steps.filter(s => s.type === "ask");
        for(const s of asks){ const key = `${spec.catId}:${s.format}:${s.format === "choice" ? (s.options||[]).length : 2}`; (marg[key] = marg[key] || {})[String(s.answer)] = ((marg[key] || {})[String(s.answer)] || 0) + 1; }
        spec.steps.filter(s => s.type === "frame").forEach(s => { if(s.ms > 5200) blockers.push(`L${L} frame too long ${s.ms}`); });
        const html = JSON.stringify(spec.steps) + JSON.stringify(spec.review({answers:[]}));
        if(/\bNaN\b|\bundefined\b/.test(html)) blockers.push(`L${L} ${spec.catId}: NaN/undefined token`);
        // Independent re-derivation of every yes/no/can't-tell item on its own network.
        const it = spec.rftItem;
        if(it && it.net && it.r && (it.net.domain === "coord" || it.net.domain === "cmp")){
          const b = bruteModal(it.net, it.x, it.y, it.r);
          if(b !== null){ brute++; if(b !== it.status) blockers.push(`L${L} ${spec.catId}: key ${it.status} vs brute ${b} ${JSON.stringify(it.net.cons)}`); }
        }
      }
      per[L] = {built, bruteChecked:brute};
    }
    // Direct oracle cross-check on random networks: backtracking modal() == brute force.
    let checked = 0, mism = 0;
    const rng = coord._test.mulberry(0xC0FFEE);
    for(let i = 0; i < (options.oracleChecks || 400); i++){
      const n = 3 + int(rng, 3);
      const terms = Array.from({length:n}, (_, k) => "T" + k);
      const net = withTerms(rng() < 0.5 ? coordNet(rng, n, {allowDiff:true}) : cmpNet(rng, n, {dom:"quantity", extraEdge:rng() < 0.3}), terms);
      const x = int(rng, n); let y = int(rng, n); if(y === x) y = (x + 1) % n;
      const rels = net.frame === "coordination" ? ["eq","neg","neq"] : ["gt","lt","eq"];
      const r = {k:pick(rng, rels)};
      const a = modal(net, x, y, r).status, b = bruteModal(net, x, y, r);
      if(b === null || b === "inconsistent") continue;
      checked++;
      if(a !== b){ mism++; if(blockers.length < 20) blockers.push(`oracle mismatch ${net.frame} ${JSON.stringify(net.cons)} ${x}-${y} ${r.k}: ${a} vs brute ${b}`); }
    }
    // key marginals: most frequent correct answer must not dominate
    for(const [key, row] of Object.entries(marg)){
      const vals = Object.values(row), tot = vals.reduce((s,x)=>s+x,0), top = Math.max(...vals), k = key.endsWith(":2") ? 2 : Number(key.split(":").pop());
      if(tot >= 12 && top / tot > 1 / k + 0.25) warnings.push(`key marginal ${key}: ${JSON.stringify(row)}`);
    }
    return {patch:PATCH_ID, version:VERSION, status:blockers.length ? "BLOCK" : warnings.length ? "WARN" : "PASS", blockers, warnings:warnings.slice(0, 30), perLevel:per, oracle:{checked, mismatches:mism}, marginals:marg};
  }

  globalThis.EUCALCULIA_V8_RELATIONAL = Object.freeze({patch:PATCH_ID, version:VERSION, family:FAMILY, axis:AXIS, maxLevel:MAX_LEVEL, build, runAudit,
    _oracle:Object.freeze({solve, modal, derive, holds, bruteModal, makeTerms, negateRel, blacklist:BLACK, glyphSvg, GLYPHS}), _fluency:Object.freeze({fluencyDecision, fastRtFor})});
})();
/* V8.3 RELATIONAL FRAMES ENGINE:END */
