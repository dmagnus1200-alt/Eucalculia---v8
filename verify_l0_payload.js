// Independent oracle for the L0 families whose key depends on hidden payload data
// (number-line mark, Venn geometry, reference value, generative candidates, multi-select
// relation statements, transitive clue). For each category matching opts.prefixes it builds
// opts.n trials with setupPosner(), recomputes the key WITHOUT calling the engine's predicates,
// and reports mismatches plus perceptual-margin warnings.
(opts)=>{
  State.levelByMode.D = opts.level||20; State.maxValue = opts.m||12;
  const N = opts.n||30, prefixes = opts.prefixes||[];
  const isPrime = n => Number.isInteger(n) && n>1 && [...Array(Math.max(0,Math.floor(Math.sqrt(n))-1))].every((_,i)=>n%(i+2)!==0);
  const report = {checked:0, mismatches:[], warnings:[], notServed:[], unverified:{}, perCat:{}};
  const note = (bucket, id, msg) => { report[bucket].push(id+': '+msg); };

  // ---- relation statements (rel_contrast_*, rel_eq_*) ----
  function evalStatement(t, a, b){
    t = String(t).trim();
    const side = s => s==='LEFT'?a:b, other = s => s==='LEFT'?b:a;
    let m;
    if((m=/^(LEFT|RIGHT) is (\d+) (greater|less) than (LEFT|RIGHT)$/.exec(t))) return m[3]==='greater' ? side(m[1])-side(m[4])===+m[2] : side(m[4])-side(m[1])===+m[2];
    if((m=/^(LEFT|RIGHT) is (greater|less) than (LEFT|RIGHT)$/.exec(t))) return m[2]==='greater' ? side(m[1])>side(m[3]) : side(m[1])<side(m[3]);
    if((m=/^(LEFT|RIGHT) is (farther from|closer to) 5 than (LEFT|RIGHT)$/.exec(t))) { const d1=Math.abs(side(m[1])-5), d2=Math.abs(side(m[3])-5); return m[2]==='closer to'? d1<d2 : d1>d2; }
    if(t==='exactly one value is even') return (a%2===0)!==(b%2===0);
    if(t==='the absolute difference is odd') return Math.abs(a-b)%2===1;
    if(t==='the absolute difference is even') return Math.abs(a-b)%2===0;
    if(t==='LEFT and RIGHT have the same parity') return a%2===b%2;
    if(t==='LEFT and RIGHT have the same primality status') return isPrime(a)===isPrime(b);
    if(t==='LEFT and RIGHT differ in primality') return isPrime(a)!==isPrime(b);
    if(t==='exactly one value is prime') return isPrime(a)!==isPrime(b);
    if(t==='exactly zero or two values are prime') return isPrime(a)===isPrime(b);
    if(t==='one value divides the other exactly') return a%b===0||b%a===0;
    if(t==='neither value divides the other exactly') return !(a%b===0||b%a===0);
    if(t==='the larger value is a multiple of the smaller value') return Math.max(a,b)%Math.min(a,b)===0;
    if(t==='the larger value is not a multiple of the smaller value') return Math.max(a,b)%Math.min(a,b)!==0;
    if(t==='the total is greater than 10'||t==='LEFT plus RIGHT exceeds 10') return a+b>10;
    if(t==='the total is 10 or less'||t==='LEFT plus RIGHT does not exceed 10') return a+b<=10;
    if(t==='both values are strictly below 5 or strictly above 5'||t==='both values are not split across 5') return (a<5&&b<5)||(a>5&&b>5);
    if(t==='the values are split across 5'||t==='one value is below 5 and the other is above 5') return (a<5&&b>5)||(a>5&&b<5);
    const tt=t.replace(/−/g,'-');
    if((m=/^(\d+) - (LEFT|RIGHT) is (less|greater) than (\d+) - (LEFT|RIGHT)$/.exec(tt))) { const x=+m[1]-side(m[2]), y=+m[4]-side(m[5]); return m[3]==='less'?x<y:x>y; }
    if((m=/^-(LEFT|RIGHT) is (less|greater) than -(LEFT|RIGHT)$/.exec(tt))) { const x=-side(m[1]), y=-side(m[3]); return m[2]==='less'?x<y:x>y; }
    if((m=/^1\/(LEFT|RIGHT) is (less|greater) than 1\/(LEFT|RIGHT)$/.exec(tt))) { const x=1/side(m[1]), y=1/side(m[3]); return m[2]==='less'?x<y:x>y; }
    if((m=/^(LEFT|RIGHT) is (smaller|larger) than (LEFT|RIGHT)$/.exec(t))) return m[2]==='smaller' ? side(m[1])<side(m[3]) : side(m[1])>side(m[3]);
    if((m=/^(LEFT|RIGHT) is the (smaller|larger) value$/.exec(t))) return m[2]==='smaller' ? side(m[1])<other(m[1]) : side(m[1])>other(m[1]);
    if((m=/^(LEFT|RIGHT) is (farther from|closer to) 5$/.exec(t))) { const d1=Math.abs(side(m[1])-5), d2=Math.abs(other(m[1])-5); return m[2]==='closer to'? d1<d2 : d1>d2; }
    if(t==='both values are odd') return a%2===1&&b%2===1;
    if(t==='both values are even') return a%2===0&&b%2===0;
    if(t==='neither value is even') return a%2===1&&b%2===1;
    if(t==='neither value is odd') return a%2===0&&b%2===0;
    if(t==='exactly one value is odd') return (a%2===1)!==(b%2===1);
    if(t==='the gap is even') return Math.abs(a-b)%2===0;
    if(t==='the gap is odd') return Math.abs(a-b)%2===1;
    if(t==='the two values have the same parity') return a%2===b%2;
    if((m=/^both leave the same remainder after division by (\d+)$/.exec(t))) return a%+m[1]===b%+m[1];
    if((m=/^their difference is a multiple of (\d+)$/.exec(t))) return Math.abs(a-b)%+m[1]===0;
    if((m=/^their sum is a multiple of (\d+)$/.exec(t))) return (a+b)%+m[1]===0;
    if((m=/^exactly one leaves a remainder of 1 after dividing by (\d+)$/.exec(t))) return (a%+m[1]===1)!==(b%+m[1]===1);
    if((m=/^(LEFT|RIGHT) is (\d+) (more|less) than (LEFT|RIGHT)$/.exec(t))) return m[3]==='more' ? side(m[1])-side(m[4])===+m[2] : side(m[4])-side(m[1])===+m[2];
    if((m=/^(LEFT|RIGHT) is (below|above) 5 and (LEFT|RIGHT) is (below|above) 5$/.exec(t))) { const f=(s,d)=>d==='below'?side(s)<5:side(s)>5; return f(m[1],m[2])&&f(m[3],m[4]); }
    return undefined;
  }
  function verifyRelationChoice(pos, id){
    const a=pos.a, b=pos.b, target=(pos.relationContrast||pos.relationEquivalence||{}).target;
    const opts=(pos.options||[]).map(o=>typeof o==='string'?o:o.text);
    const vals=opts.map(t=>evalStatement(t,a,b));
    if(vals.some(v=>v===undefined)) return {unverified:'unparsed: '+opts.filter((t,i)=>vals[i]===undefined).join(' / ')};
    // Same-side-of-5 statements are undefined when a value equals 5: flag instead of judging.
    if(/split across 5|strictly below 5/.test(opts.join('|')) && (a===5||b===5)) return {warn:`value 5 makes 'split across 5' statements both false (a=${a}, b=${b})`};
    let want;
    // rel_eq_* items have no target: their correct options are the statements that are TRUE.
    if(target==='same'||!target) want=vals.map((v,i)=>v?i:-1).filter(i=>i>=0);
    else if(target==='opposite') want=vals.map((v,i)=>!v?i:-1).filter(i=>i>=0);
    else return {unverified:'target '+target};
    const key=Array.isArray(pos.correctIndices)?pos.correctIndices.slice().sort():String(pos.answer).split(',').map(Number).sort();
    const answerStr=String(pos.answer);
    const ok=want.length===key.length&&want.every((x,i)=>x===key[i]);
    const displayOk=answerStr===key.join(',');
    return {ok:ok&&displayOk, detail:`a=${a} b=${b} target=${target} opts=[${opts.join(' | ')}] engine=${key.join(',')} (answer '${answerStr}') oracle=${want.join(',')}`};
  }

  // ---- relational reference ----
  function verifyRelRef(pos){
    const r=pos.payload&&pos.payload.relationalReference; if(!r) return {unverified:'no payload'};
    const rel=r.relation, ref=r.reference;
    const test=v=> rel==='<'?v<ref: rel==='>'?v>ref: rel==='<='?v<=ref: rel==='>='?v>=ref: undefined;
    const aRel=test(r.left), bRel=test(r.right);
    if(aRel===undefined) return {unverified:'relation '+rel};
    const L=r.leftName, R=r.rightName;
    const want = aRel&&bRel ? 'both' : aRel ? 'L' : bRel ? 'R' : 'none';
    const texts=(pos.options||[]).map(o=>o.text);
    const cls=t=> /^Neither$/.test(t)?'none': /^Only /.test(t)? (t.slice(5)===L?'L':t.slice(5)===R?'R':'?') : (t.includes(L)&&t.includes(R)?'both':'?');
    const keyCls=cls(texts[pos.correctIndex]);
    const warn = (r.left===ref||r.right===ref) ? `a value equals the reference (${ref})` : null;
    return {ok:keyCls===want, warn, detail:`left ${L}=${r.left} right ${R}=${r.right} ref=${ref} rel=${rel} key='${texts[pos.correctIndex]}' oracle=${want}`};
  }

  // ---- number-line gate ----
  const NL = {nl_more_than_half:t=>t>0.5, nl_less_than_half:t=>t<0.5, nl_exactly_half:t=>Math.abs(t-0.5)<1e-9, nl_more_than_quarter:t=>t>0.25, nl_less_than_quarter:t=>t<0.25, nl_more_than_3quarters:t=>t>0.75, nl_less_than_3quarters:t=>t<0.75};
  const NL_BOUND = {nl_more_than_half:.5, nl_less_than_half:.5, nl_exactly_half:.5, nl_more_than_quarter:.25, nl_less_than_quarter:.25, nl_more_than_3quarters:.75, nl_less_than_3quarters:.75};
  const COND = {
    graph_cond_left_greater:(a,b)=>a>b, graph_cond_both_even:(a,b)=>a%2===0&&b%2===0, graph_cond_sum_even:(a,b)=>(a+b)%2===0,
    graph_cond_product_lt_20:(a,b)=>a*b<20, graph_cond_gap_eq_1:(a,b)=>Math.abs(a-b)===1, graph_cond_both_gt_5:(a,b)=>a>5&&b>5,
    graph_cond_sum_gt_10:(a,b)=>a+b>10, graph_cond_parity_match:(a,b)=>a%2===b%2, graph_cond_diff_gt_3:(a,b)=>Math.abs(a-b)>3,
    graph_cond_sum_eq_10:(a,b)=>a+b===10, graph_cond_one_prime:(a,b)=>isPrime(a)||isPrime(b), graph_cond_left_div_right:(a,b)=>a%b===0,
    graph_cond_match:(a,b)=>a===b
  };
  function verifyNlGate(pos){
    const g=pos.numberLineGate; if(!g) return {unverified:'no gate'};
    const hf=NL[g.conditionId], cf=COND[g.predicateId];
    if(!hf||!cf) return {unverified:'unknown '+g.conditionId+'/'+g.predicateId};
    const holds=hf(g.t), cond=cf(pos.a,pos.b), want= holds?cond:!cond;
    const margin=Math.abs(g.t-NL_BOUND[g.conditionId]);
    const warn = (g.conditionId!=='nl_exactly_half' && margin<0.06) ? `mark only ${(margin*100).toFixed(1)}% of the line from the boundary (t=${g.t})` : null;
    return {ok: want===!!pos.isTrue && holds===!!g.holds, warn, detail:`t=${g.t} holds=${holds} (payload ${g.holds}) cond=${cond} engine=${pos.isTrue}`};
  }

  // ---- Venn gate ----
  function inside(c,p){ return (p.x-c.cx)**2+(p.y-c.cy)**2 < c.r*c.r; }
  function verifyVenn(pos){
    const v=pos.vennGate; if(!v||!v.geom) return {unverified:'no geom'};
    const cf=COND[v.predicateId]; if(!cf) return {unverified:'pred '+v.predicateId};
    const circ=Object.fromEntries(v.geom.circles.map(c=>[c.id,c])), mk=v.geom.mark;
    const inA=mk&&circ.A?inside(circ.A,mk):null, inB=mk&&circ.B?inside(circ.B,mk):null, inC=mk&&circ.C?inside(circ.C,mk):null;
    const d=(p,q)=>Math.hypot(p.cx-q.cx,p.cy-q.cy);
    const rel=(p,q)=>{ const dist=d(p,q); if(dist<1e-9&&Math.abs(p.r-q.r)<1e-9) return 'same'; if(dist+p.r<=q.r) return 'p_in_q'; if(dist+q.r<=p.r) return 'q_in_p'; if(dist>=p.r+q.r) return 'disjoint'; return 'overlap'; };
    const AB=circ.A&&circ.B?rel(circ.A,circ.B):null;
    const cnt=[inA,inB,inC].filter(Boolean).length;
    const H={
      ab_disjoint:()=>AB==='disjoint', ab_partial_overlap:()=>AB==='overlap', a_subset_b:()=>AB==='p_in_q'||AB==='same', b_subset_a:()=>AB==='q_in_p'||AB==='same',
      ab_same_set:()=>AB==='same', ab_intersect:()=>AB!=='disjoint', a_has_part_outside_b:()=>!(AB==='p_in_q'||AB==='same'), b_has_part_outside_a:()=>!(AB==='q_in_p'||AB==='same'),
      x_in_a:()=>inA, x_in_b:()=>inB, x_in_both:()=>inA&&inB, x_in_exactly_one:()=>inA!==inB, x_in_neither:()=>!inA&&!inB, x_in_a_not_b:()=>inA&&!inB, x_in_b_not_a:()=>inB&&!inA, x_in_a_or_b:()=>inA||inB,
      x3_in_a:()=>inA, x3_in_b:()=>inB, x3_in_c:()=>inC, x3_in_all_three:()=>cnt===3, x3_in_exactly_two:()=>cnt===2, x3_in_exactly_one:()=>cnt===1, x3_in_none:()=>cnt===0,
      x3_in_a_not_b:()=>inA&&!inB, x3_in_a_or_b:()=>inA||inB, x3_in_ab_not_c:()=>inA&&inB&&!inC
    };
    const hf=H[v.conditionId]; if(!hf) return {unverified:'cond '+v.conditionId};
    const holds=!!hf(), cond=cf(pos.a,pos.b), want=holds?cond:!cond;
    // perceptual margin: mark distance to nearest circle edge
    let edge=Infinity; if(mk) for(const c of v.geom.circles) if(c.active!==false) edge=Math.min(edge, Math.abs(Math.hypot(mk.x-c.cx,mk.y-c.cy)-c.r));
    const warn = mk && edge<6 ? `mark ${edge.toFixed(1)}px from a circle edge` : null;
    return {ok: want===!!pos.isTrue && holds===!!v.holds, warn, detail:`cond=${v.conditionId} geomHolds=${holds} payloadHolds=${v.holds} region=${v.markRegion} AB=${AB} pred=${cond} engine=${pos.isTrue}`};
  }

  // ---- generative relational choice ----
  function verifyRelChoice(pos){
    const rc=pos.payload&&pos.payload.relChoice; if(!rc) return {unverified:'no relChoice'};
    const q=String(pos.question), L=rc.left, R=rc.right, C=rc.candidates;
    let pred=null;
    const val=o=>o.value;
    if(/smaller than both|earlier than both|lower than both/.test(q)) pred=c=>val(c)<val(L)&&val(c)<val(R);
    else if(/greater than both|later than both|higher than both|beats both/.test(q)) pred=c=>val(c)>val(L)&&val(c)>val(R);
    else if(/between the two/.test(q)) pred=c=>val(c)>Math.min(val(L),val(R))&&val(c)<Math.max(val(L),val(R));
    else if(/beats? exactly one/.test(q)) pred=c=>(val(c)>val(L))!==(val(c)>val(R));
    else if(/beats? neither/.test(q)) pred=c=>!(val(c)>val(L))&&!(val(c)>val(R));
    else if(/different suit from both/.test(q)) pred=c=>c.suit!==L.suit&&c.suit!==R.suit;
    else if(/same suit as exactly one|suit of exactly one/.test(q)) pred=c=>(c.suit===L.suit)!==(c.suit===R.suit);
    else if(/same suit as both|suit of both/.test(q)) pred=c=>c.suit===L.suit&&c.suit===R.suit;
    else if(/matches the value shown on the LEFT/.test(q)) pred=c=>val(c)===val(L);
    else if(/matches the value shown on the RIGHT/.test(q)) pred=c=>val(c)===val(R);
    else if(/domino/i.test(q)){
      const hs=o=>Array.isArray(o.halves)?o.halves:[];
      const conn=(x,y)=>hs(x).some(h=>hs(y).includes(h));
      if(/exactly one of the two/.test(q)) pred=c=>conn(c,L)!==conn(c,R);
      else if(/neither of them/.test(q)) pred=c=>!conn(c,L)&&!conn(c,R);
      else if(/join the two into one chain/.test(q)) pred=c=>{ const h=hs(c); if(h.length!==2) return false; return (hs(L).includes(h[0])&&hs(R).includes(h[1]))||(hs(L).includes(h[1])&&hs(R).includes(h[0])); };
      else if(/connect to both, but cannot join/.test(q)) pred=c=>{ const h=hs(c); const chain=h.length===2&&((hs(L).includes(h[0])&&hs(R).includes(h[1]))||(hs(L).includes(h[1])&&hs(R).includes(h[0]))); return conn(c,L)&&conn(c,R)&&!chain; };
      else if(/connects? to both/.test(q)) pred=c=>conn(c,L)&&conn(c,R);
    }
    if(!pred) return {unverified:'question: '+q};
    const want=C.map((c,i)=>pred(c)?i:-1).filter(i=>i>=0);
    const key=Array.isArray(pos.correctIndices)?pos.correctIndices.slice().sort():(pos.requiredSelections>1?String(pos.answer).split(',').map(Number).sort():[pos.correctIndex]);
    const need=pos.requiredSelections||1;
    const ok=want.length===need&&want.length===key.length&&want.every((x,i)=>x===key[i]);
    return {ok, detail:`q='${q}' L=${JSON.stringify(L)} R=${JSON.stringify(R)} C=${JSON.stringify(C)} engine=${key} oracle=${want}`};
  }

  // ---- transitive inference ----
  function verifyTransitive(pos){
    const t=pos.payload&&pos.payload.transitiveInference; if(!t) return {unverified:'no payload'};
    const A=t.anchorVal, O=t.otherVal;
    // Z (clue) A; compare Z with O.
    let want;
    if(t.clue==='eq') want = A>O?'greater':A<O?'less':'equal';
    else if(t.clue==='lt') want = A<=O ? 'less' : 'cannot';   // Z<A<=O -> Z<O
    else if(t.clue==='gt') want = A>=O ? 'greater' : 'cannot'; // Z>A>=O -> Z>O
    else return {unverified:'clue '+t.clue};
    const txt=pos.options[pos.correctIndex].text;
    const keyCls=/Cannot/.test(txt)?'cannot':/greater/.test(txt)?'greater':/less/.test(txt)?'less':/equal/.test(txt)?'equal':'?';
    let warn=null;
    // Natural-number reading: if clue is 'lt', Z in {1..A-1}; if that set is {O} only, Z=O is forced.
    if(t.clue==='lt' && keyCls==='cannot' && A-1===1 && O===1) warn=`integer reading forces Z=1=LEFT/RIGHT (anchor ${A}, other ${O})`;
    return {ok:keyCls===want, warn, detail:`anchor=${t.anchorSide}:${A} other=${O} clue=${t.clue} key='${txt}' oracle=${want}`};
  }

  const routes=[
    [/^rel_contrast_|^rel_eq_/, verifyRelationChoice],
    [/^rel_ref_/, verifyRelRef],
    [/^nl_gate_/, verifyNlGate],
    [/^venn_gate_/, verifyVenn],
    [/^rel_choice_/, verifyRelChoice],
    [/^decl_transitive_inference/, verifyTransitive],
  ];
  const cats=POSNER_CATS.filter(c=>prefixes.some(p=>c.id.startsWith(p)));
  for(const c of cats){
    const route=routes.find(([re])=>re.test(c.id)); if(!route) continue;
    const stat={n:0,bad:0,warn:0,unv:0};
    for(let i=0;i<N;i++){
      State.forceNextL0RepairFamily=c.id;
      let pos; try{ pos=setupPosner(); }catch(e){ note('mismatches',c.id,'ERR '+e); break; }
      if(!pos||pos.catId!==c.id){ report.notServed.push(c.id+' -> '+(pos&&pos.catId)); break; }
      const r=route[1](pos,c.id); stat.n++; report.checked++;
      if(r.unverified){ stat.unv++; report.unverified[c.id]=r.unverified; continue; }
      if(!r.ok){ stat.bad++; if(report.mismatches.length<200) note('mismatches',c.id,r.detail); }
      if(r.warn){ stat.warn++; if(report.warnings.length<200) note('warnings',c.id,r.warn+' :: '+(r.detail||'')); }
    }
    report.perCat[c.id]=stat;
  }
  return report;
}
