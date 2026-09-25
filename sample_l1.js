// L1 (META) sampler: for every L1 op, build retained L0 pairs with setupPosner(), pin the op
// selector to that op, run setupL1(), and print
//   opId | family | P1=(a,b) P2=(a,b) | question | key
// Choice keys mark the correct option with '*'. Pairs are the memory values the op sees.
(opts)=>{
  _massHarnessPrepareState();
  State.levelByMode.D = opts.level||20; State.maxValue = opts.m||12;
  // One-time onboarding screens would put the flow into a blocking status: mark them as seen.
  try{ if(!State.meta.diagnostics) State.meta.diagnostics={}; State.meta.diagnostics.booleanNested=ensureNestedBooleanStatsShape(State.meta.diagnostics.booleanNested); State.meta.diagnostics.booleanNested.briefed=true; }catch(_){}
  try{ ensureAutoCurriculumState().l1BridgeBriefed=true; }catch(_){}
  const nextPos=()=>{ for(let i=0;i<20;i++){ const p=setupPosner(); if(p&&Number.isFinite(p.a)&&Number.isFinite(p.b)) return p; } throw new Error('no L0'); };
  const lines=[], perOp=opts.n||2, tries=opts.tries||40;
  const ops=registryLayerEntries("L1", L1_OPS).filter(o=>!opts.only||opts.only.some(p=>o.id.startsWith(p)||o.family===p));
  const origPick=dAdaptiveWeightedPick;
  const oldMass=window.__EUCALCULIA_MASS_QA_ACTIVE; window.__EUCALCULIA_MASS_QA_ACTIVE=true;
  const fmtPair=p=>{ const v=(x,d)=>Number.isFinite(d)&&d!==x?`${x}(shown ${d})`:`${x}`; return `(${v(p.a,p.displayA)},${v(p.b,p.displayB)})`; };
  try{
    for(const op of ops){
      let got=0, seen=new Set(), lastReason='';
      for(let t=0;t<tries&&got<perOp;t++){
        State.meta.pairHistory=[];
        try{ _massHarnessStoreL0(nextPos(),true); _massHarnessStoreL0(nextPos(),true); }catch(e){ lastReason='l0 '+e; continue; }
        const [p1,p2]=State.meta.pairHistory.slice(-2);
        let canUse=false; try{ canUse=l1OpCanUse(op,p1,p2,currentLevel(),currentMax()); }catch(e){ lastReason='canUse '+e; }
        if(!canUse){ lastReason='canUse=false'; continue; }
        dAdaptiveWeightedPick=(items)=>items.find(o=>o.id===op.id)||null;
        try{ _l1SetupDeferredReason=null; }catch(_){}
        State.status="MENU"; State.flowHold=null; State.forceNextL1Family=null;
        let r=null; try{ r=setupL1(); }catch(e){ lastReason='setup '+String(e).slice(0,80); }
        dAdaptiveWeightedPick=origPick;
        if(!r){ lastReason=lastReason||'setup null'; continue; }
        if(!r.op||r.op.id!==op.id){ lastReason='served '+(r.op&&r.op.id); continue; }
        const q=String(r.question||'').replace(/\s+/g,' ');
        let key;
        if(Array.isArray(r.options)&&r.options.length){
          const ci=Array.isArray(r.correctIndices)?r.correctIndices:[r.correctIndex];
          key='OPTS['+r.options.map((o,j)=>(ci.includes(j)?'*':'')+(typeof o==='string'?o:(o.text||o.label||JSON.stringify(o)))).join(' | ')+']';
        } else key=String(r.answerLabel||r.answer);
        const P1=r.pair1||p1, P2=r.pair2||p2;
        const sig=q+key; if(seen.has(sig)) continue; seen.add(sig);
        lines.push(`${op.id} | ${op.family||'-'} | P1=${fmtPair(P1)} P2=${fmtPair(P2)}${r.directionSwapped?' [swapped]':''} | ${q} | ${key}`);
        got++;
      }
      if(!got) lines.push(`${op.id} | ${op.family||'-'} | NOT_SERVED(${lastReason})`);
    }
  } finally { dAdaptiveWeightedPick=origPick; window.__EUCALCULIA_MASS_QA_ACTIVE=oldMass; }
  return lines;
}
