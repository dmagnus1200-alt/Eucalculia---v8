// Node port of the Playwright harness (no Python needed): drives the installed
// Microsoft Edge in headless mode over the Chrome DevTools Protocol.
//
//   node harness/cdp.mjs eval   <snippet.js> '<json opts>' <out_file> [page.html] [WxH]
//   node harness/cdp.mjs audits [page.html]
//   node harness/cdp.mjs probe  [page.html] [WxH]
//   node harness/cdp.mjs run    <driver.mjs> [page.html] [WxH]   (driver exports default async (page, ctx) => result)
//
// Run from the "Eucalculia 6.0" folder. A static server on 127.0.0.1:8765 is started in-process
// (loopback + ?eucaQa=1 keeps the QA URL parameters alive).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const EDGE_PATHS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
];
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function serve(root, port = 8765) {
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const f = path.join(root, decodeURIComponent(u.pathname));
    if (!f.startsWith(path.resolve(root))) { res.writeHead(403); return res.end(); }
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, { 'content-type': MIME[path.extname(f).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      res.end(buf);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

class CDP {
  constructor(ws) { this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = [];
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(typeof ev.data === 'string' ? ev.data : Buffer.from(ev.data).toString());
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id); this.pending.delete(msg.id);
        msg.error ? reject(new Error(msg.error.message + ' ' + (msg.error.data || ''))) : resolve(msg.result);
      } else if (msg.method) { for (const h of this.handlers) h(msg); }
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  on(fn) { this.handlers.push(fn); }
}

export async function launch({ width = 520, height = 900 } = {}) {
  const exe = EDGE_PATHS.find((p) => fs.existsSync(p));
  if (!exe) throw new Error('No Edge/Chrome found');
  const udd = fs.mkdtempSync(path.join(os.tmpdir(), 'euca-edge-'));
  const proc = spawn(exe, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${udd}`, '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', `--window-size=${width},${height}`, 'about:blank'],
    { stdio: 'ignore' });
  let port;
  for (let i = 0; i < 100 && !port; i++) {
    await sleep(100);
    try { port = fs.readFileSync(path.join(udd, 'DevToolsActivePort'), 'utf8').split('\n')[0].trim(); } catch {}
  }
  if (!port) throw new Error('Edge did not expose DevTools');
  const ver = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.addEventListener('open', r); ws.addEventListener('error', j); });
  const cdp = new CDP(ws);
  const close = async () => { try { await cdp.send('Browser.close'); } catch {} try { proc.kill(); } catch {} await sleep(300); try { fs.rmSync(udd, { recursive: true, force: true }); } catch {} };
  return { cdp, close, width, height };
}

export async function newPage(browser, { width, height } = {}) {
  const { cdp } = browser; width = width || browser.width; height = height || browser.height;
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => cdp.send(m, p, sessionId);
  const errors = []; const consoleErrors = []; const logs = [];
  cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails; errors.push(((d.exception && d.exception.description) || d.text || '').split('\n').slice(0, 3).join(' | '));
    } else if (msg.method === 'Runtime.consoleAPICalled') {
      const txt = msg.params.args.map((a) => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ');
      if (msg.params.type === 'error') consoleErrors.push(txt);
      logs.push(msg.params.type + ': ' + txt.slice(0, 300));
    }
  });
  await s('Runtime.enable'); await s('Page.enable');
  // Record load-time script errors in the page itself (window.__eucaErrs), independent of CDP events.
  await s('Page.addScriptToEvaluateOnNewDocument', { source: 'window.__eucaErrs=[];window.addEventListener("error",function(e){try{window.__eucaErrs.push(String(e.message)+" @"+e.lineno+":"+e.colno)}catch(_){}},true);window.addEventListener("unhandledrejection",function(e){try{window.__eucaErrs.push("unhandled: "+String(e.reason&&e.reason.message||e.reason))}catch(_){}});' });
  await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 700 });
  const page = {
    sessionId, errors, consoleErrors, logs,
    async goto(url, waitMs = 3000) {
      await s('Page.navigate', { url });
      // The 11 MB page can take longer than a fixed delay to parse: wait for readyState, then settle.
      const t0 = Date.now();
      await sleep(300);
      while (Date.now() - t0 < 60000) {
        try { const r = await s('Runtime.evaluate', { expression: 'document.readyState', returnByValue: true }); if (r.result.value === 'complete') break; } catch {}
        await sleep(150);
      }
      await sleep(Math.min(waitMs, 1500));
    },
    async evaluate(expr, arg) {
      // A function (or function text) is called only when an argument is supplied; otherwise the
      // string is evaluated as a plain expression (so "(()=>{…})()" works as written).
      const expression = typeof expr === 'function' || arg !== undefined
        ? `(${expr})(${JSON.stringify(arg === undefined ? null : arg)})` : expr;
      const r = await s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, timeout: 600000 });
      if (r.exceptionDetails) throw new Error('evaluate: ' + ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text));
      return r.result.value;
    },
    async key(key, code, keyCode) {
      const base = { key, code: code || key, windowsVirtualKeyCode: keyCode || 0, nativeVirtualKeyCode: keyCode || 0 };
      await s('Input.dispatchKeyEvent', { type: 'keyDown', ...base, text: key === ' ' ? ' ' : undefined });
      await s('Input.dispatchKeyEvent', { type: 'keyUp', ...base });
    },
    async click(x, y) {
      for (const type of ['mousePressed', 'mouseReleased']) await s('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
    },
    async screenshot(file) { const r = await s('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); },
    async resize(w, h) { await s('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 700 }); },
    wait: sleep,
  };
  return page;
}

function parseWH(s, dflt) { if (!s) return dflt; const m = /^(\d+)x(\d+)$/.exec(s); return m ? { width: +m[1], height: +m[2] } : dflt; }

const AUDITS_JS = `async()=>{
  const out={};
  for(const k of Object.keys(globalThis).filter(k=>k.startsWith('EUCALCULIA'))){
    const api=globalThis[k]; if(!api||typeof api!=='object') continue;
    for(const fn of ['runAudit','audit','selfAudit']){
      if(typeof api[fn]!=='function') continue;
      try{ let r=api[fn](); if(r&&typeof r.then==='function') r=await Promise.race([r,new Promise(res=>setTimeout(()=>res({status:'TIMEOUT'}),8000))]);
        out[k+'.'+fn]={status:r&&(r.status||r.verdict||r.result||(r.ok===true?'PASS':r.ok===false?'FAIL':undefined)), blockers:(r&&(r.blockers||r.failures||r.errors||[]))?.slice?.(0,6), warnings:(r&&r.warnings||[]).slice?.(0,4), fail:r&&r.summary&&r.summary.fail};
      }catch(e){ out[k+'.'+fn]={error:String(e).slice(0,200)} }
    }
  }
  return out;}`;

async function main() {
  const [mode, ...args] = process.argv.slice(2);
  const root = process.cwd();
  const server = await serve(root, 8765);
  let browser;
  try {
    if (mode === 'eval') {
      const [snip, optsJson, outFile, pageFile = 'Eucalculia_experimental.html', wh] = args;
      browser = await launch(parseWH(wh, {}));
      const page = await newPage(browser);
      await page.goto(`http://127.0.0.1:8765/${pageFile}?eucaQa=1`);
      // Drop leading comment lines so the function-expression detection in evaluate() sees "(opts)=>".
      const js = fs.readFileSync(snip, 'utf8').replace(/^(\s*(\/\/[^\n]*\n|\/\*[\s\S]*?\*\/))+/, '').trim().replace(/;\s*$/, '');
      // '@file.json' reads the options from a file (PowerShell 5.1 strips quotes from inline JSON).
      const optsText = optsJson && optsJson.startsWith('@') ? fs.readFileSync(optsJson.slice(1), 'utf8') : (optsJson || '{}');
      const res = await page.evaluate(js, JSON.parse(optsText));
      fs.writeFileSync(outFile, Array.isArray(res) && res.every((x) => typeof x === 'string') ? res.join('\n') : JSON.stringify(res, null, 1));
      console.log('done', Array.isArray(res) ? res.length : typeof res, 'page errors:', page.errors.slice(0, 5));
    } else if (mode === 'audits') {
      const [pageFile = 'Eucalculia_experimental.html'] = args;
      browser = await launch(); const page = await newPage(browser);
      await page.goto(`http://127.0.0.1:8765/${pageFile}?eucaQa=1`);
      const res = await page.evaluate(AUDITS_JS, null);
      for (const [k, v] of Object.entries(res)) console.log(k, JSON.stringify(v).slice(0, 400));
      console.log('page errors:', page.errors.slice(0, 10));
    } else if (mode === 'probe') {
      const [pageFile = 'Eucalculia_experimental.html', wh] = args;
      browser = await launch(parseWH(wh, {})); const page = await newPage(browser);
      await page.goto(`http://127.0.0.1:8765/${pageFile}?eucaQa=1`, 2500);
      await page.screenshot('menu.png'); await page.key(' ', 'Space', 32);
      for (let i = 0; i < 12; i++) {
        await sleep(700);
        console.log(JSON.stringify(await page.evaluate('({s:State.status,p:State.pendingPanel,k:State.trialInfo&&State.trialInfo.kind,cat:State.trialInfo&&State.trialInfo.catId,t:State.targetValue,bt:State.blockTrials})')));
      }
      await page.screenshot('trial.png'); console.log('page errors:', page.errors.slice(0, 20));
    } else if (mode === 'run') {
      const [driver, pageFile = 'Eucalculia_v8.html', wh] = args;
      const mod = await import(pathToFileURL(path.resolve(driver)).href);
      browser = await launch(parseWH(wh, {}));
      const res = await mod.default({ browser, newPage: (o) => newPage(browser, o), pageUrl: `http://127.0.0.1:8765/${pageFile}?eucaQa=1`, pageFile, sleep });
      if (res !== undefined) console.log(typeof res === 'string' ? res : JSON.stringify(res, null, 1));
    } else {
      console.log('modes: eval | audits | probe | run');
    }
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e); process.exit(1); });
