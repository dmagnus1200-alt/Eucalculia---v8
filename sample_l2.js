// L2 (META²) sampler: for every L2 category, build two fresh L1 results, force the category
// (engine QA switch __EUCALCULIA_MASS_QA_FORCE_L2_CAT_ID), run setupL2(), and print
//   catId | A1=<L1#1 answer> (<L1#1 op>: <question>) | A2=... | <L2 question> | OPTS[*correct | ...]
(opts)=>{
  _massHarnessPrepareState();
  State.levelByMode.D = opts.level||20; State.maxValue = opts.m||12;
  try{ if(!State.meta.diagnostics) State.meta.diagnostics={}; State.meta.diagnostics.booleanNested=ensureNestedBooleanStatsShape(State.meta.diagnostics.booleanNested); State.meta.diagnostics.booleanNested.briefed=true; }catch(_){}
  try{ ensureAutoCurriculumState().l1BridgeBriefed=true; }catch(_){}
  const report=_massHarnessMakeAuxReport(), hopts=_massHarnessDefaultOptions({});
  const oldMass=window.__EUCALCULIA_MASS_QA_ACTIVE; window.__EUCALCULIA_MASS_QA_ACTIVE=true;
  const lines=[]; const cats=registryLayerEntries("L2", L2_CATS).filter(c=>!opts.only||opts.only.includes(c.id));
  const short=s=>String(s||'').replace(/\s+/g,' ').slice(0, opts.qlen||140);
  if(opts.natural){
    // Natural selection (no forcing): exactly what setupL2 serves after two real L1 results.
    // opts.l2t seeds L2 history so l2CurriculumPhase() unlocks the advanced catalogue.
    if(opts.l2t){ State.meta.l2Stats={t:opts.l2t, c:Math.round(opts.l2t*0.9), rt:[]}; }
    const per={}, cap=opts.n||3;
    try{
      for(let t=0;t<(opts.episodes||1200);t++){
        State.meta.l1Results=[]; State.meta.l2Results=[];
        try{ _l1SetupDeferredReason=null; }catch(_){}
        State.status="MENU"; State.flowHold=null; State.forceNextL1Family=null;
        const a=_massHarnessGenerateL1(report,hopts,false,true); State.status="MENU";
        const b=_massHarnessGenerateL1(report,hopts,false,true); State.status="MENU";
        if(!a||!b) continue;
        let l2=null; try{ l2=setupL2(); }catch(e){ lines.push('ERR '+String(e).slice(0,120)); continue; }
        if(!l2) continue;
        const id=l2.cat?.id||l2.catId||'?'; per[id]=(per[id]||0)+1; if(per[id]>cap) continue;
        const opts2=(l2.options||[]).map((o,j)=>(j===l2.correctIndex?'*':'')+(typeof o==='string'?o:(o.text||o.label))).join(' | ');
        lines.push(`${id} | A1=${a.answerLabel||a.answer} [${a.op?.id||a.extensionOpType}: ${short(a.question)}] | A2=${b.answerLabel||b.answer} [${b.op?.id||b.extensionOpType}: ${short(b.question)}] | ${short(l2.relationQuestion||l2.question)} | OPTS[${opts2}]`);
      }
    } finally { window.__EUCALCULIA_MASS_QA_ACTIVE=oldMass; }
    lines.sort();
    lines.push('COUNTS '+JSON.stringify(per));
    return lines;
  }
  try{
    for(const cat of cats){
      let got=0; const seen=new Set(); let last='';
      for(let t=0;t<(opts.tries||25)&&got<(opts.n||3);t++){
        State.meta.l1Results=[]; State.meta.l2Results=[];
        try{ _l1SetupDeferredReason=null; }catch(_){}
        State.status="MENU"; State.flowHold=null; State.forceNextL1Family=null;
        const a=_massHarnessGenerateL1(report,hopts,false,true);
        State.status="MENU";
        const b=_massHarnessGenerateL1(report,hopts,false,true);
        if(!a||!b){ last='l1 null'; continue; }
        window.__EUCALCULIA_MASS_QA_FORCE_L2_CAT_ID=cat.id;
        let l2=null; State.status="MENU";
        try{ l2=setupL2(); }catch(e){ last='ERR '+String(e).slice(0,80); }
        window.__EUCALCULIA_MASS_QA_FORCE_L2_CAT_ID=undefined;
        if(!l2){ last=last||'l2 null'; continue; }
        const id=l2.cat?.id||l2.catId;
        if(id!==cat.id){ last='served '+id; continue; }
        const opts2=(l2.options||[]).map((o,j)=>(j===l2.correctIndex?'*':'')+(typeof o==='string'?o:(o.text||o.label))).join(' | ');
        const key=short(l2.relationQuestion)+opts2; if(seen.has(key)) continue; seen.add(key);
        lines.push(`${cat.id} | A1=${a.answerLabel||a.answer} [${a.op?.id||a.extensionOpType}: ${short(a.question)}] | A2=${b.answerLabel||b.answer} [${b.op?.id||b.extensionOpType}: ${short(b.question)}] | ${short(l2.relationQuestion||l2.question)} | OPTS[${opts2}]`);
        got++;
      }
      if(!got) lines.push(`${cat.id} | NOT_SERVED(${last})`);
    }
  } finally { window.__EUCALCULIA_MASS_QA_ACTIVE=oldMass; window.__EUCALCULIA_MASS_QA_FORCE_L2_CAT_ID=undefined; }
  return lines;
}
