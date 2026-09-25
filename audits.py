"""Run every EUCALCULIA_*.audit / runAudit / selfAudit in a page and print the status.
Usage: python audits.py [page.html] [port]   (local server must be running)"""
import asyncio, sys, json
from playwright.async_api import async_playwright
JS = '''async()=>{
  const out={};
  for(const k of Object.keys(globalThis).filter(k=>k.startsWith('EUCALCULIA'))){
    const api=globalThis[k]; if(!api||typeof api!=='object') continue;
    for(const fn of ['runAudit','audit','selfAudit']){
      if(typeof api[fn]!=='function') continue;
      try{ let r=api[fn](); if(r&&typeof r.then==='function') r=await Promise.race([r,new Promise(res=>setTimeout(()=>res({status:'TIMEOUT'}),8000))]);
        out[k+'.'+fn]={status:r&&(r.status||r.verdict||r.result), blockers:(r&&(r.blockers||r.failures||r.errors||[]))?.slice?.(0,6), warnings:(r&&r.warnings||[]).slice?.(0,4), fail:r&&r.summary&&r.summary.fail};
      }catch(e){ out[k+'.'+fn]={error:String(e).slice(0,200)} }
    }
  }
  return out;}'''
async def main():
    page_file = sys.argv[1] if len(sys.argv) > 1 else "Eucalculia_experimental.html"
    port = sys.argv[2] if len(sys.argv) > 2 else "8765"
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width":520,"height":900})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{port}/{page_file}?eucaQa=1"); await pg.wait_for_timeout(3000)
        res = await pg.evaluate(JS)
        for k, v in res.items(): print(k, json.dumps(v)[:400])
        print("page errors:", errs[:10]); await b.close()
asyncio.run(main())
