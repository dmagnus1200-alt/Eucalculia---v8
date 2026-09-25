// One-off helper: diff Eucalculia_experimental.html against the hand-edited Eucalculia_v8.html
// and emit the changed hunks as exact {find, replace} patches (with 2 context lines) so the
// build can re-apply them to the read-only source.  Usage: node build/extract_patches.mjs
import fs from 'node:fs';
const root = new URL('../../', import.meta.url);
const A = fs.readFileSync(new URL('Eucalculia_experimental.html', root), 'utf8').split('\r\n');
const B = fs.readFileSync(new URL('Eucalculia_v8.html', root), 'utf8').split('\r\n');
const hunks = [];
let i = 0, j = 0;
while (i < A.length && j < B.length) {
  if (A[i] === B[j]) { i++; j++; continue; }
  // find resync: smallest (di, dj) with A[i+di] === B[j+dj] and next 3 lines equal
  let found = null;
  for (let s = 1; s < 40 && !found; s++) {
    for (let di = 0; di <= s && !found; di++) {
      const dj = s - di;
      if (i + di < A.length && j + dj < B.length && A[i + di] === B[j + dj]
        && A[i + di + 1] === B[j + dj + 1] && A[i + di + 2] === B[j + dj + 2]) found = [di, dj];
    }
  }
  if (!found) throw new Error('no resync near line ' + (i + 1));
  const [di, dj] = found;
  const ctxBefore = A.slice(Math.max(0, i - 1), i);
  hunks.push({ line: i + 1, find: [...ctxBefore, ...A.slice(i, i + di)].join('\r\n'), replace: [...ctxBefore, ...B.slice(j, j + dj)].join('\r\n') });
  i += di; j += dj;
}
if (A.length - i !== B.length - j) throw new Error('tail mismatch');
// verify uniqueness of each find string in A
const whole = A.join('\r\n');
for (const h of hunks) {
  let c = 0, p = -1; while ((p = whole.indexOf(h.find, p + 1)) !== -1) c++;
  h.count = c;
}
fs.writeFileSync(new URL('build/source_patches.json', new URL('../', import.meta.url)), JSON.stringify(hunks, null, 1));
console.log(hunks.length, 'hunks; non-unique:', hunks.filter(h => h.count !== 1).map(h => h.line));
