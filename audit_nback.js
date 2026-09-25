// node harness/cdp.mjs eval harness/audit_nback.js '{"per":4}' out.json Eucalculia_v8.html
(opts) => {
  const t0 = performance.now();
  const r = EUCALCULIA_V8_NBACK.runAudit(opts || {});
  const rt = EUCALCULIA_V8_RUNTIME.installed();
  return {ms: Math.round(performance.now() - t0), status: r.status, blockers: r.blockers, warnings: r.warnings, stats: r.stats, runtimeHooks: rt,
    rft: EUCALCULIA_V8_RELATIONAL.runAudit ? EUCALCULIA_V8_RELATIONAL.runAudit({perLevel: 20}).status : null,
    correctness: EUCALCULIA_V8_CORRECTNESS.audit ? EUCALCULIA_V8_CORRECTNESS.audit().status : null};
}
