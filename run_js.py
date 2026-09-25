"""Run a JS snippet inside a Eucalculia page served from a local loopback server.
Usage: python run_js.py <snippet.js> '<json opts>' <out_file> [page.html] [port]
Start the server first, from the Eucalculia folder:
    python -m http.server 8765 --bind 127.0.0.1
"""
import asyncio, sys, json
from playwright.async_api import async_playwright

async def main():
    js = open(sys.argv[1], encoding="utf-8").read()
    opts = json.loads(sys.argv[2])
    outp = sys.argv[3]
    page_file = sys.argv[4] if len(sys.argv) > 4 else "Eucalculia_experimental.html"
    port = sys.argv[5] if len(sys.argv) > 5 else "8765"
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 520, "height": 900})
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(f"http://127.0.0.1:{port}/{page_file}?eucaQa=1")
        await page.wait_for_timeout(3000)
        res = await page.evaluate(js, opts)
        with open(outp, "w", encoding="utf-8") as f:
            if isinstance(res, list):
                f.write("\n".join(res))
            else:
                json.dump(res, f, indent=1)
        print("done", len(res), "page errors:", errors[:5])
        await browser.close()

asyncio.run(main())
