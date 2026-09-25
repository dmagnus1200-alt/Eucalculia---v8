// Profiles solver cost on growing webs.
(opts) => {
  const W = EUCALCULIA_V8_WEB, T = W._test, C = EUCALCULIA_V8_COORDINATOR._test;
  const out = [];
  const axisState = {custom:{}, win:[], level:opts.level || 9};
  for (let s = 0; s < (opts.sprints || 4); s++) {
    const t0 = performance.now();
    const spec = W.build({level:axisState.level, levelForced:false, rng:C.mulberry(C.hash32((opts.prefix || 'prof|') + s)), axisState, featureWeight:() => 1, today:'audit'});
    const ms = performance.now() - t0;
    if (!spec) { out.push({s, ms:Math.round(ms), spec:null}); continue; }
    const web = {terms:spec.web.terms, cons:spec.web.cons, H:spec.web.H};
    // time individual modal calls
    let worst = 0, worstQ = null, total = 0, n = 0;
    for (const q of spec.web.questions) {
      if (!q.r) continue;
      const t1 = performance.now(); T.modalW(web, q.x, q.y, q.r); const d = performance.now() - t1;
      total += d; n++; if (d > worst) { worst = d; worstQ = q.text; }
    }
    out.push({s, ms:Math.round(ms), K:web.terms.length, H:web.H, cons:web.cons.map(c => c.k + (c.d ?? '')).join(','), avgModal:+(total / Math.max(1, n)).toFixed(1), worst:Math.round(worst), worstQ});
  }
  return {out, slow:T.slow()};
}
