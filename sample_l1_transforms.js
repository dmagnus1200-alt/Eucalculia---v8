// Samples naturally-selected L1 trials that carry a representation transform
// ("Mentally change Pair k SIDE using T") and prints raw value, rendered spec,
// transformed value and the transform descriptor, one line per transformed slot.
(opts)=>{
  _massHarnessPrepareState();
  State.levelByMode.D = opts.level||20; State.maxValue = opts.m||12;
  try{ if(!State.meta.diagnostics) State.meta.diagnostics={}; State.meta.diagnostics.booleanNested=ensureNestedBooleanStatsShape(State.meta.diagnostics.booleanNested); State.meta.diagnostics.booleanNested.briefed=true; }catch(_){}
  try{ ensureAutoCurriculumState().l1BridgeBriefed=true; }catch(_){}
  const oldMass=window.__EUCALCULIA_MASS_QA_ACTIVE; window.__EUCALCULIA_MASS_QA_ACTIVE=true;
  const nextPos=()=>{ for(let i=0;i<20;i++){ const p=setupPosner(); if(p&&Number.isFinite(p.a)&&Number.isFinite(p.b)) return p; } throw new Error('no L0'); };
  const byKey={}, lines=[];
  try{
    for(let t=0;t<(opts.n||600);t++){
      State.meta.pairHistory=[]; _massHarnessStoreL0(nextPos(),true); _massHarnessStoreL0(nextPos(),true);
      const [h1,h2]=State.meta.pairHistory.slice(-2);
      try{ _l1SetupDeferredReason=null; }catch(_){}
      State.status="MENU"; State.flowHold=null; State.forceNextL1Family=null;
      let r=null; try{ r=setupL1(); }catch(_){}
      if(!r||!/Mentally change/.test(String(r.question||''))) continue;
      const re=/Mentally change Pair (\d) (LEFT|RIGHT) using ([^.]+)\./g; let m;
      while((m=re.exec(r.question))){
        const pk=+m[1], side=m[2]==='LEFT'?'a':'b', label=m[3];
        const raw=(pk===1?h1:h2), after=(pk===1?r.pair1:r.pair2);
        const rep=side==='a'?raw.repA:raw.repB, spec=side==='a'?raw.stimSpecA:raw.stimSpecB;
        const key=label+'|'+rep; byKey[key]=(byKey[key]||0)+1; if(byKey[key]>(opts.perKey||3)) continue;
        lines.push(`${label} | rep=${rep} | raw=${raw[side]} displayed=${side==='a'?raw.displayA:raw.displayB} | spec=${JSON.stringify(spec)} | after=${after&&after[side]}`);
      }
    }
  } finally { window.__EUCALCULIA_MASS_QA_ACTIVE=oldMass; }
  lines.sort();
  return lines;
}
