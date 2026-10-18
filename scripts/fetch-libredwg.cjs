// Puts GNU LibreDWG's dwg2dxf.exe (and the two DLLs it needs) into resources/libredwg/ for the Windows
// installer, which ships it as a separate program next to COPYING and SOURCE.txt (GPL v3: run, never
// linked). Downloads the official win64 build and checks its pinned SHA-256; nothing is committed but the
// hash. Skips the download when the files are already there.   node scripts/fetch-libredwg.cjs
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const JSZip = require('jszip');

const URL = 'https://github.com/LibreDWG/libredwg/releases/download/0.14/libredwg-0.14-win64.zip';
const SHA256 = '1ad7e15344d20b3426c3435b078d82fb84b35062815946b2cca9c5fc9810fea8';
const FILES = ['dwg2dxf.exe', 'libredwg-0.dll', 'libiconv-2.dll'];
const OUT = path.join(__dirname, '..', 'resources', 'libredwg');

(async () => {
  if (FILES.every((f) => fs.existsSync(path.join(OUT, f)))) { console.log('LibreDWG already in', path.relative(process.cwd(), OUT)); return; }
  const res = await fetch(URL, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} ${URL}`);
  const zipBytes = Buffer.from(await res.arrayBuffer());
  const hash = crypto.createHash('sha256').update(zipBytes).digest('hex');
  if (hash !== SHA256) throw new Error(`LibreDWG zip SHA-256 mismatch: got ${hash}, expected ${SHA256}`);
  const zip = await JSZip.loadAsync(zipBytes);
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of FILES) {
    const entry = zip.file(new RegExp(`(^|/)${f.replace('.', '\\.')}$`))[0];
    if (!entry) throw new Error(`${f} is not in the LibreDWG zip`);
    fs.writeFileSync(path.join(OUT, f), await entry.async('nodebuffer'));
  }
  console.log('LibreDWG 0.14 (dwg2dxf) put in', path.relative(process.cwd(), OUT));
})().catch((err) => { console.error(err.message); process.exit(1); });
