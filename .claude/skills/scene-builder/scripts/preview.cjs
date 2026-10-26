#!/usr/bin/env node
// Renders a scene and writes screenshots for review.
//
//   node preview.cjs scenes/<slug> [--out <dir>] [--frames]
//
// Writes to <repo>/.preview/<slug>/ by default:
//   phone-default.png       the screen as it first loads, at iPhone size
//   phone-option-<n>.png    every category set to its n-th option
//   compare-<n>.png         each `references` entry: mock-up, this build, and their difference
//   anim-<category>.png     with --frames: the unboxing and swap animations, frame by frame
// Exits with code 1 if the page logs errors or any file fails to load.

const fs = require('fs');
const path = require('path');
const http = require('http');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.cjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
};

const args = process.argv.slice(2);
const sceneArg = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out');
if (!sceneArg) {
  console.error('Usage: node preview.cjs scenes/<slug> [--out <dir>] [--frames]');
  process.exit(2);
}
const sceneDir = path.resolve(sceneArg);
let root = sceneDir;
while (!fs.existsSync(path.join(root, 'engine', 'scene-engine.js'))) {
  const up = path.dirname(root);
  if (up === root) { console.error('Could not find engine/scene-engine.js above the scene folder.'); process.exit(2); }
  root = up;
}
const slug = path.basename(sceneDir);
const outDir = args.includes('--out') ? path.resolve(args[args.indexOf('--out') + 1]) : path.join(root, '.preview', slug);
fs.mkdirSync(outDir, { recursive: true });
const sceneUrlPath = `/${path.relative(root, sceneDir).split(path.sep).join('/')}/`;

function serve() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(root, p);
    if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404);
      return res.end('not found');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

const dataUrl = (buf, mime = 'image/png') => `data:${mime};base64,${buf.toString('base64')}`;
const problems = [];

function watch(page) {
  page.on('pageerror', (e) => problems.push(`Page error: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`Console: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`${r.status()} ${r.url()}`); });
}

// Lays out labelled images on a white page and screenshots it.
async function sheet(browser, file, title, items, columns = 1) {
  const page = await browser.newPage({ viewport: { width: 1400, height: 200 } });
  const cells = items.map((it) => `
    <figure><figcaption>${it.label}</figcaption>
      <div class="frame">${it.html || `<img src="${it.src}">`}</div>
    </figure>`).join('');
  await page.setContent(`<!doctype html><html><head><style>
    body { margin: 0; padding: 20px; font: 15px/1.4 system-ui, sans-serif; background: #fff; color: #222; }
    h1 { font-size: 18px; margin: 0 0 14px; }
    .grid { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 16px; }
    figure { margin: 0; } figcaption { font-weight: 600; margin-bottom: 6px; }
    .frame { position: relative; border: 1px solid #ddd; line-height: 0; }
    .frame img { width: 100%; display: block; }
    .diff img + img { position: absolute; inset: 0; mix-blend-mode: difference; }
  </style></head><body><h1>${title}</h1><div class="grid">${cells}</div></body></html>`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: file, fullPage: true });
  await page.close();
}

(async () => {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}${sceneUrlPath}`;
  const browser = await chromium.launch();
  const written = [];

  // Phone screens, no animation.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  watch(phone);
  await phone.goto(`${base}?static`);
  await phone.waitForTimeout(800);
  const config = await phone.evaluate(() => window.SCENE_CONFIG);
  if (!config || !(await phone.evaluate(() => !!window.SceneEngine))) {
    problems.push('The engine did not start; see the errors above or open the page to read the config error.');
  } else {
    const missing = await phone.evaluate(() => [...document.images].filter((i) => i.complete && !i.naturalWidth).map((i) => i.getAttribute('src')));
    missing.forEach((m) => problems.push(`Image did not load: ${m}`));

    let f = path.join(outDir, 'phone-default.png');
    await phone.screenshot({ path: f });
    written.push(f);

    const maxOptions = Math.max(...config.categories.map((c) => c.options.length));
    for (let n = 0; n < maxOptions; n++) {
      const picks = config.categories.map((c) => [c.id, c.options[Math.min(n, c.options.length - 1)].id]);
      await phone.evaluate((p) => p.forEach(([c, o]) => window.SceneEngine.select(c, o)), picks);
      await phone.waitForTimeout(500);
      const shot = await phone.locator('.scene').screenshot();
      const labels = config.categories.map((c) => c.options[Math.min(n, c.options.length - 1)].label).join(' · ');
      f = path.join(outDir, `phone-option-${n + 1}.png`);
      await sheet(browser, f, `Option ${n + 1} in every category`, [{ label: labels, src: dataUrl(shot) }]);
      written.push(f);
    }

    // Each mock-up next to the build in the same state.
    for (const [i, ref] of (config.references || []).entries()) {
      const refFile = path.join(sceneDir, ref.image);
      if (!fs.existsSync(refFile)) { problems.push(`Reference image not found: ${ref.image}`); continue; }
      const refUrl = dataUrl(fs.readFileSync(refFile), MIME[path.extname(refFile).toLowerCase()]);
      const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
      watch(page);
      await page.goto(`${base}?static&bare`);
      await page.waitForTimeout(600);
      await page.evaluate((st) => Object.entries(st || {}).forEach(([c, o]) => window.SceneEngine.select(c, o)), ref.state);
      await page.waitForTimeout(600);
      const shot = dataUrl(await page.locator('.scene').screenshot());
      await page.close();
      const stateText = Object.entries(ref.state || {}).map(([c, o]) => `${c}: ${o}`).join(', ') || 'default state';
      f = path.join(outDir, `compare-${i + 1}.png`);
      await sheet(browser, f, `${ref.image} (${stateText})`, [
        { label: 'Mock-up', src: refUrl },
        { label: 'This build', src: shot },
        { label: 'Difference (black = identical)', html: `<div class="diff"><img src="${refUrl}"><img src="${shot}"></div>` },
      ], 3);
      written.push(f);
    }

    // Animation frames: first reveal, then switching to the second option.
    if (args.includes('--frames')) {
      for (const cat of config.categories) {
        const page = await browser.newPage({ viewport: { width: 700, height: 500 } });
        watch(page);
        await page.goto(`${base}?bare`);
        await page.waitForTimeout(800);
        const frames = [];
        const run = async (opt, times, name) => {
          await page.evaluate(([c, o]) => window.SceneEngine.select(c, o), [cat.id, opt.id]);
          let t = 0;
          for (const at of times) {
            await page.waitForTimeout(at - t);
            t = at;
            frames.push({ label: `${name} ${at} ms`, src: dataUrl(await page.locator('.scene').screenshot()) });
          }
          await page.waitForTimeout(1600 - t);
        };
        await run(cat.options[0], [150, 450, 750, 1100], 'Unbox');
        await run(cat.options[1], [200, 450, 700, 1000], `Swap (${cat.swap || 'pop'})`);
        await page.close();
        f = path.join(outDir, `anim-${cat.id}.png`);
        await sheet(browser, f, `${cat.title}: animation frames`, frames, 4);
        written.push(f);
      }
    }
  }

  await browser.close();
  server.close();

  console.log(`Wrote ${written.length} file(s) to ${outDir}`);
  written.forEach((w) => console.log(`  ${path.relative(process.cwd(), w)}`));
  if (problems.length) {
    console.log(`\n${problems.length} problem(s):`);
    [...new Set(problems)].forEach((p) => console.log(`  ✗ ${p}`));
    process.exit(1);
  }
  console.log('\nNo errors and no missing files.');
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
