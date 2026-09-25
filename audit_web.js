// node harness/cdp.mjs eval harness/audit_web.js '{"per":6}' out.json Eucalculia_v8.html
(opts) => {
  const t0 = performance.now();
  const r = EUCALCULIA_V8_WEB.runAudit(opts || {});
  return {ms: Math.round(performance.now() - t0), ...r};
}
