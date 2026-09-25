// Renders every representation for values 1–9 at N-back cell size (80 px) and screenshots the sheet.
//   node harness/cdp.mjs run harness/glyph_sheet.mjs Eucalculia_v8.html 1280x900
import path from 'node:path';
export default async function ({ newPage, pageUrl, sleep }) {
  const page = await newPage();
  await page.goto(pageUrl, 3000);
  const reps = await page.evaluate(`(()=>{
    const reps = ALL_REPS.filter(r => r !== 'digit');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#050508;overflow:auto;padding:6px;font:12px monospace;color:#bbb';
    let html = '<table style="border-collapse:collapse">';
    for (const rep of reps) {
      html += '<tr><td style="width:60px">' + rep + '</td>';
      for (let v = 1; v <= 9; v++) {
        const ok = repPhysicallyAllows(rep, v);
        const g = ok ? relRefReferenceGlyphSVG({rep, value:v, seed:v*31}) : '';
        html += '<td style="width:62px;height:58px;border:1px solid #222;background:#221c47"><div class="gs">' + (g || '—') + '</div></td>';
      }
      html += '</tr>';
    }
    host.innerHTML = '<style>.gs{width:58px;height:58px;overflow:hidden}.gs svg{width:58px!important;height:58px!important;max-width:none!important}</style>' + html + '</table>';
    document.body.appendChild(host);
    return reps;
  })()`);
  await sleep(800);
  await page.screenshot(path.join(process.env.TEMP, 'euca8', 'glyph_sheet.png'));
  return { reps };
}
