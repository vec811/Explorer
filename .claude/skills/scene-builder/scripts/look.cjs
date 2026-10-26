#!/usr/bin/env node
// Renders images (SVG, PNG, WebP, JPEG) into one labelled contact sheet so you can
// see what each uploaded file shows and how big it is.
//
//   node look.cjs --out sheet.png <file> [<file> ...]

const fs = require('fs');
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const MIME = { '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const out = outIdx >= 0 ? args[outIdx + 1] : null;
const files = args.filter((a, i) => a !== '--out' && i !== outIdx + 1);
if (!out || !files.length) {
  console.error('Usage: node look.cjs --out sheet.png <file> [<file> ...]');
  process.exit(2);
}

(async () => {
  const items = files.map((f) => {
    const mime = MIME[path.extname(f).toLowerCase()];
    if (!mime) throw new Error(`Unsupported file type: ${f}`);
    return { name: path.basename(f), src: `data:${mime};base64,${fs.readFileSync(f).toString('base64')}` };
  });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 200 } });
  await page.setContent(`<!doctype html><html><head><style>
    body { margin: 0; padding: 16px; font: 13px/1.35 system-ui, sans-serif; background: #fff; color: #222; }
    .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
    figure { margin: 0; }
    .img { height: 220px; display: grid; place-items: center; border: 1px solid #ddd;
      background: repeating-conic-gradient(#f1f1f1 0 25%, #fff 0 50%) 0 0 / 16px 16px; }
    .img { overflow: hidden; }
    img { display: block; max-width: 96%; max-height: 210px; width: auto; height: auto; object-fit: contain; }
    figcaption { margin-top: 4px; word-break: break-all; }
    figcaption b { display: block; }
  </style></head><body><div class="grid">${items.map((it, i) => `
    <figure><div class="img"><img id="i${i}" src="${it.src}"></div>
    <figcaption><b>${it.name}</b><span id="s${i}"></span></figcaption></figure>`).join('')}</div></body></html>`);
  const sizes = await page.evaluate(() => Promise.all([...document.images].map((img, i) => (img.decode ? img.decode() : Promise.resolve())
    .catch(() => {})
    .then(() => {
      const s = `${img.naturalWidth} × ${img.naturalHeight}`;
      document.getElementById(`s${i}`).textContent = s;
      return s;
    }))));
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  items.forEach((it, i) => console.log(`${it.name}: ${sizes[i]}`));
  console.log(`Sheet written to ${out}`);
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
