// Forced-category L0 sampler. For each POSNER category: force it, build n trials
// with setupPosner(), and print "cat | L=a:rep R=b:rep | question | answer".
// Choice answers mark the key with '*'; multi-select keys use the canonical "i,j".
(opts)=>{
  State.levelByMode.D = opts.level||20; State.maxValue = opts.m||12;
  const lines=[]; const cats=POSNER_CATS.filter(c=>!opts.only||opts.only.includes(c.family));
  const skip=new Set(opts.skipFam||[]);
  const keyOf=(pos)=>{ const a=pos.answer; if(typeof a==='string'&&a.includes(',')) return a.split(',').map(Number); if(Array.isArray(a)) return a.map(Number); return [Number(a)]; };
  for(const c of cats){
    if(skip.has(c.family)) continue;
    const seen=new Set();
    for(let i=0;i<(opts.n||6);i++){
      State.forceNextL0RepairFamily=c.id;
      let pos; try{ pos=setupPosner(); }catch(e){ lines.push(`${c.id} | ERR ${String(e).slice(0,120)}`); break; }
      if(!pos) continue;
      if(pos.catId!==c.id){ lines.push(`${c.id} | NOT_SERVED(${pos.fallbackReason||pos.catId})`); break; }
      const q=String(pos.question||pos.delayedPrompt||'').replace(/\s+/g,' ');
      let ans;
      if(Array.isArray(pos.options)){ const k=keyOf(pos); ans='OPTS['+pos.options.map((o,j)=>(k.includes(j)?'*':'')+(typeof o==='string'?o:(o.text||o.label||JSON.stringify(o)))).join(' | ')+']'; }
      else ans=pos.isTrue?'YES':'NO';
      const key=q+ans+pos.a+pos.b; if(seen.has(key)) continue; seen.add(key);
      const dA=typeof l0DisplayValueForSide==='function'?l0DisplayValueForSide(pos,'a'):pos.a, dB=typeof l0DisplayValueForSide==='function'?l0DisplayValueForSide(pos,'b'):pos.b;
      lines.push(`${c.id} | L=${pos.a}${dA!==pos.a?'(shown '+dA+')':''}:${pos.repA} R=${pos.b}${dB!==pos.b?'(shown '+dB+')':''}:${pos.repB} | ${q} | ${ans}`);
    }
  }
  return lines;
}
