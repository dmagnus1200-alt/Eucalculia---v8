// Independent paper-folding oracle for l0_paper_folding_analogy categories.
// Re-simulates the fold/punch ops (absolute fold lines on the unit square), unfolds, counts
// distinct holes, and checks the engine's hole count X and the YES/NO key for rule ids.
(opts)=>{
  State.levelByMode.D = opts.level||20; State.maxValue = opts.m||12;
  const EPS=1e-7, N=opts.n||6;
  const dot=(a,b)=>a.x*b.x+a.y*b.y;
  function mk(line){ const n=line.normal, L=Math.hypot(n.x,n.y); return {p0:line.p0, n:{x:n.x/L,y:n.y/L}}; }
  function refl(q,l){ const d=(q.x-l.p0.x)*l.n.x+(q.y-l.p0.y)*l.n.y; return {x:q.x-2*d*l.n.x, y:q.y-2*d*l.n.y}; }
  function simulate(ops, sign){
    const folds=ops.filter(o=>o.type==='fold').map(o=>mk(o.line)), punches=ops.filter(o=>o.type==='punch').map(o=>o.position);
    const side=(q,k)=>sign*((q.x-folds[k].p0.x)*folds[k].n.x+(q.y-folds[k].p0.y)*folds[k].n.y);
    const memo=new Map();
    function inR(q,k){
      const key=k+':'+q.x.toFixed(6)+','+q.y.toFixed(6); if(memo.has(key)) return memo.get(key);
      let r;
      if(k===0) r = q.x>-EPS&&q.x<1+EPS&&q.y>-EPS&&q.y<1+EPS;
      else r = side(q,k-1)<=EPS && (inR(q,k-1) || inR(refl(q,folds[k-1]),k-1));
      memo.set(key,r); return r;
    }
    let S=punches.filter(p=>inR(p,folds.length));
    if(S.length!==punches.length) return {bad:'punch outside folded paper'};
    for(let k=folds.length;k>=1;k--){
      const next=[];
      for(const q of S){
        if(inR(q,k-1)) next.push(q);
        const r=refl(q,folds[k-1]);
        if(side(q,k-1)<-EPS && inR(r,k-1)) next.push(r);
      }
      const seen=new Set(); S=[];
      for(const q of next){ const key=q.x.toFixed(5)+','+q.y.toFixed(5); if(!seen.has(key)){ seen.add(key); S.push(q); } }
    }
    return {count:S.length};
  }
  function ruleAnswer(id, a, b, x){
    let m;
    if((m=/^paper_x_(left|right)_(add|subtract)_(\d+)$/.exec(id))){ const v=m[1]==='left'?a:b; return x===(m[2]==='add'?v+ +m[3]:v- +m[3]); }
    if((m=/^paper_x_(left|right)_(double|half)$/.exec(id))){ const v=m[1]==='left'?a:b; return m[2]==='double'?x===2*v:2*x===v; }
    if(id==='paper_x_sum') return x===a+b;
    if(id==='paper_x_gap'||id==='paper_x_diff') return x===Math.abs(a-b);
    if(id==='paper_x_eq_left') return x===a;
    if(id==='paper_x_eq_right') return x===b;
    const isP=n=>n>1&&[...Array(Math.max(0,Math.floor(Math.sqrt(n))-1))].every((_,i)=>n%(i+2)!==0);
    const isSq=n=>n>=0&&Number.isInteger(Math.sqrt(n));
    const nextW=(v,f)=>{for(let k=v+1;k<v+200;k++) if(f(k)) return k; return NaN;};
    const prevW=(v,f)=>{for(let k=v-1;k>-200;k--) if(f(k)) return k; return NaN;};
    if((m=/^paper_x_(left|right)_(.+)$/.exec(id))){
      const v=m[1]==='left'?a:b, r=m[2]; let t;
      if(r==='triple') return x===3*v; if(r==='third') return 3*x===v;
      if((t=/^(double|triple)_(plus|minus)_(\d+)$/.exec(r))) return x===(t[1]==='double'?2:3)*v+(t[2]==='plus'?1:-1)*+t[3];
      if(r==='square') return x===v*v; if(r==='square_root') return x*x===v;
      if((t=/^fill_to_(\d+)$/.exec(r))) return x===+t[1]-v;
      if((t=/^same_distance_from_(\d+)_other_side$/.exec(r))) return x===2*+t[1]-v;
      if((t=/^clock_forward_(\d+)$/.exec(r))) return x===((v-1+ +t[1])%12+12)%12+1;
      if((t=/^clock_back_(\d+)$/.exec(r))) return x===((v-1- +t[1])%12+12)%12+1;
      if(r==='clock_opposite') return x===((v-1+6)%12)+1;
      if((t=/^distance_from_(\d+)$/.exec(r))) return x===Math.abs(v- +t[1]);
      if((t=/^5_plus_distance_from_(\d+)$/.exec(r))) return x===5+Math.abs(v- +t[1]);
      if((t=/^10_minus_distance_from_(\d+)$/.exec(r))) return x===10-Math.abs(v- +t[1]);
      if(r==='next_even') return x===nextW(v,k=>k%2===0); if(r==='previous_even') return x===prevW(v,k=>k%2===0);
      if(r==='next_odd') return x===nextW(v,k=>Math.abs(k%2)===1); if(r==='previous_odd') return x===prevW(v,k=>Math.abs(k%2)===1);
      if((t=/^next_multiple_(\d+)$/.exec(r))) return x===nextW(v,k=>k%+t[1]===0);
      if((t=/^previous_multiple_(\d+)$/.exec(r))) return x===prevW(v,k=>k%+t[1]===0);
      if(r==='next_prime') return x===nextW(v,isP); if(r==='previous_prime') return x===prevW(v,isP);
      if(r==='next_square') return x===nextW(v,isSq); if(r==='previous_square') return x===prevW(v,isSq);
    }
    if(id==='paper_x_eq_diff') return x===Math.abs(a-b);
    if(id==='paper_x_eq_sum') return x===a+b;
    if(id==='paper_x_eq_avg') return 2*x===a+b;
    if(id==='paper_x_eq_max') return x===Math.max(a,b);
    if(id==='paper_x_eq_min') return x===Math.min(a,b);
    if(id==='paper_x_eq_product') return x===a*b;
    if(id==='paper_x_eq_double_gap') return x===2*Math.abs(a-b);
    if(id==='paper_x_eq_half_gap') return 2*x===Math.abs(a-b);
    if((m=/^paper_x_eq_(max|min|sum|gap)_(plus|minus)_(\d+)$/.exec(id))){ const base=m[1]==='max'?Math.max(a,b):m[1]==='min'?Math.min(a,b):m[1]==='sum'?a+b:Math.abs(a-b); return x===base+(m[2]==='plus'?1:-1)*+m[3]; }
    if((m=/^paper_x_eq_larger_minus_smaller_plus_(\d+)$/.exec(id))) return x===Math.abs(a-b)+ +m[1];
    if(id==='paper_x_continues_progression') return x-b===b-a;
    if(id==='paper_x_precedes_progression') return a-x===b-a;
    if(id==='paper_x_same_parity_left') return x%2===a%2;
    if(id==='paper_x_same_parity_right') return x%2===b%2;
    return undefined;
  }
  const out={checked:0, conv:{plus:0,minus:0}, countMismatch:[], answerMismatch:[], negChecked:0, unknownRule:new Set(), notServed:[]};
  const cats=POSNER_CATS.filter(c=>c.family==='l0_paper_folding_analogy');
  for(const c of cats){
    for(let i=0;i<N;i++){
      State.forceNextL0RepairFamily=c.id;
      let pos; try{ pos=setupPosner(); }catch(e){ out.countMismatch.push(c.id+' ERR '+e); break; }
      if(!pos||pos.catId!==c.id){ out.notServed.push(c.id); break; }
      const pf=pos.paperFolding; if(!pf||!Array.isArray(pf.ops)) continue;
      out.checked++;
      const p=simulate(pf.ops,+1), mn=simulate(pf.ops,-1);
      if(p.count===pf.x) out.conv.plus++; if(mn.count===pf.x) out.conv.minus++;
      // Engine convention (verified): the fold normal points to the side that STAYS (sign -1).
      if(mn.count!==pf.x && out.countMismatch.length<60) out.countMismatch.push(`${c.id} engineX=${pf.x} sim+=${p.count??p.bad} sim-=${mn.count??mn.bad} variant=${pf.variant} ops=${JSON.stringify(pf.ops)}`);
      // YES/NO key vs rule (the question may be a negated wording).
      const q=String(pos.question||''); const neg=/\bnot\b/.test(q.replace(/\bnot greater than\b/,''));
      const base=ruleAnswer(c.id,pos.a,pos.b,pf.x);
      if(base===undefined){ out.unknownRule.add(c.id.replace(/_\d+$/,'_N')); continue; }
      const want=neg?!base:base; if(neg) out.negChecked++;
      if(want!==!!pos.isTrue && out.answerMismatch.length<60) out.answerMismatch.push(`${c.id} a=${pos.a} b=${pos.b} x=${pf.x} q='${q}' engine=${pos.isTrue} oracle=${want}`);
    }
  }
  out.unknownRule=[...out.unknownRule];
  return out;
}
