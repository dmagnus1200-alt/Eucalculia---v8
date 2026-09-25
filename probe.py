"""Boot a page, start a block with Space, print the runtime state every 0.7 s and save screenshots.
Usage: python probe.py [page.html] [port]"""
import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    page_file = sys.argv[1] if len(sys.argv) > 1 else "Eucalculia_experimental.html"
    port = sys.argv[2] if len(sys.argv) > 2 else "8765"
    async with async_playwright() as p:
        b = await p.chromium.launch(); pg = await b.new_page(viewport={"width":520,"height":900})
        errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(f"http://127.0.0.1:{port}/{page_file}?eucaQa=1"); await pg.wait_for_timeout(2500)
        await pg.screenshot(path="menu.png"); await pg.keyboard.press("Space")
        for _ in range(12):
            await pg.wait_for_timeout(700)
            print(await pg.evaluate('()=>({s:State.status,p:State.pendingPanel,k:State.trialInfo&&State.trialInfo.kind,cat:State.trialInfo&&State.trialInfo.catId,t:State.targetValue,bt:State.blockTrials})'))
        await pg.screenshot(path="trial.png"); print("page errors:", errs[:20]); await b.close()
asyncio.run(main())
