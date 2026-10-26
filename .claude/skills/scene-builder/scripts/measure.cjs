#!/usr/bin/env node
// Finds where each illustration sits in the reference mock-ups, in artboard units.
//
//   node measure.cjs --artboard <background.svg> --ref <mock-up> [--ref <mock-up>] [--json out.json] <layer> [<layer> ...]
//
// The mock-ups must be full-frame exports of the whole scene (any size). Each
// layer is searched for in every mock-up at two likely scales (drawn at artboard
// scale, or drawn at the mock-up's scale) and, if neither fits, across a sweep
// of scales. The score is the share of the layer's pixels that match the
// mock-up, so it tolerates partial occlusion and small differences.
// Each result is marked found / check / not found; only "found" is safe to use
// without looking at a preview.

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

function dataUrl(file) {
  const mime = MIME[path.extname(file).toLowerCase()];
  if (!mime) throw new Error(`Unsupported file type: ${file}`);
  return `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
}

// Intrinsic size of an SVG from its width/height attributes, else its viewBox.
function svgSize(file) {
  const tag = (fs.readFileSync(file, 'utf8').match(/<svg\b[^>]*>/i) || [''])[0];
  const attr = (name) => {
    const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*["']\\s*([\\d.]+)(px)?\\s*["']`, 'i'));
    return m ? parseFloat(m[1]) : null;
  };
  const vb = tag.match(/viewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i);
  const w = attr('width') || (vb && parseFloat(vb[1]));
  const h = attr('height') || (vb && parseFloat(vb[2]));
  if (!w || !h) throw new Error(`Could not read the size of ${file}`);
  return { w, h };
}

function parseArgs(argv) {
  const out = { refs: [], layers: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--artboard') out.artboard = argv[++i];
    else if (a === '--ref') out.refs.push(argv[++i]);
    else if (a === '--json') out.json = argv[++i];
    else out.layers.push(a);
  }
  if (!out.artboard || !out.refs.length || !out.layers.length) {
    console.error('Usage: node measure.cjs --artboard <background.svg> --ref <mock-up> [--ref ...] [--json out.json] <layer> [<layer> ...]');
    process.exit(2);
  }
  return out;
}

// Runs inside the browser so SVGs render exactly as they will on the page.
async function measureInPage({ artboard, refs, layers }) {
  const load = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });

  function raster(img, w, h, white) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    const g = c.getContext('2d', { willReadFrequently: true });
    if (white) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(img, 0, 0, c.width, c.height);
    return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
  }

  // Opaque pixels of the layer, thinned to at most `max` samples.
  function samples(t, max) {
    const idx = [];
    for (let i = 0; i < t.w * t.h; i++) if (t.d[i * 4 + 3] > 200) idx.push(i);
    const stride = Math.max(1, Math.ceil(idx.length / max));
    const out = [];
    for (let j = 0; j < idx.length; j += stride) {
      const i = idx[j];
      out.push([i % t.w, Math.floor(i / t.w), t.d[i * 4], t.d[i * 4 + 1], t.d[i * 4 + 2]]);
    }
    return out;
  }

  function score(r, s, ox, oy, thr) {
    let hit = 0;
    for (let k = 0; k < s.length; k++) {
      const p = s[k];
      const x = p[0] + ox;
      const y = p[1] + oy;
      if (x < 0 || y < 0 || x >= r.w || y >= r.h) continue;
      const i = (y * r.w + x) * 4;
      if (Math.abs(r.d[i] - p[2]) + Math.abs(r.d[i + 1] - p[3]) + Math.abs(r.d[i + 2] - p[4]) < thr) hit++;
    }
    return hit / s.length;
  }

  // `exact` keeps the scale as given; otherwise it is fine-tuned within ±10%.
  function search(ref, coarse, d, img, nat, k, exact) {
    // Coarse pass over every position (the layer may hang half off the edges).
    const ct = raster(img, (nat.w * k) / d, (nat.h * k) / d);
    const cs = samples(ct, 700);
    if (cs.length < 20) return null;
    const top = [];
    for (let oy = -Math.floor(ct.h / 2); oy < coarse.h - ct.h / 2; oy++) {
      for (let ox = -Math.floor(ct.w / 2); ox < coarse.w - ct.w / 2; ox++) {
        const sc = score(coarse, cs, ox, oy, 90);
        if (top.length < 5 || sc > top[top.length - 1].sc) {
          const near = top.findIndex((t) => Math.abs(t.ox - ox) <= 3 && Math.abs(t.oy - oy) <= 3);
          if (near >= 0) { if (sc > top[near].sc) top[near] = { ox, oy, sc }; }
          else top.push({ ox, oy, sc });
          top.sort((a, b) => b.sc - a.sc);
          if (top.length > 5) top.pop();
        }
      }
    }
    // Fine pass at full resolution around the best coarse hits, nudging the scale too.
    let best = null;
    const ks = exact ? [k] : [0.9, 0.925, 0.95, 0.975, 1, 1.025, 1.05, 1.075, 1.1].map((f) => k * f);
    for (const kk of ks) {
      const ft = raster(img, nat.w * kk, nat.h * kk);
      const fs = samples(ft, 5000);
      const r = d + 2;
      for (const t of top) {
        for (let oy = t.oy * d - r; oy <= t.oy * d + r; oy++) {
          for (let ox = t.ox * d - r; ox <= t.ox * d + r; ox++) {
            const sc = score(ref, fs, ox, oy, 60);
            if (!best || sc > best.sc) best = { x: ox, y: oy, k: kk, sc, exact };
          }
        }
      }
    }
    return best;
  }

  const refData = [];
  for (const r of refs) {
    const img = await load(r.src);
    const scale = img.naturalWidth / artboard.w;
    const full = raster(img, img.naturalWidth, img.naturalHeight, true);
    const d = Math.max(1, Math.round(img.naturalWidth / 480));
    const coarse = raster(img, img.naturalWidth / d, img.naturalHeight / d, true);
    const aspectOff = Math.abs(img.naturalHeight - artboard.h * scale) / img.naturalHeight;
    refData.push({ name: r.name, scale, full, coarse, d, aspectOff, size: [img.naturalWidth, img.naturalHeight] });
  }

  const results = [];
  for (const layer of layers) {
    const img = await load(layer.src);
    let best = null;
    for (const r of refData) {
      const tried = new Set();
      const tryScales = (ks, exact) => {
        for (const k of ks) {
          const key = k.toFixed(3);
          if (tried.has(key)) continue;
          tried.add(key);
          const m = search(r.full, r.coarse, r.d, img, layer.size, k, exact);
          if (m && (!best || m.sc > best.sc)) best = { ...m, ref: r };
        }
      };
      // Likely scales first: drawn at artboard scale, or at this mock-up's scale.
      tryScales([r.scale, 1], true);
      if (!best || best.sc < 0.6) {
        const sweep = [];
        for (let f = 0.25; f <= 3.01; f *= 1.22) sweep.push(r.scale * f);
        tryScales(sweep);
      }
    }
    if (!best) { results.push({ layer: layer.name, error: 'layer has almost no opaque pixels' }); continue; }
    const s = best.ref.scale;
    // Matches at an expected scale are trustworthy from 0.6 (art often differs a
    // little from the mock-up, or is partly covered). A match that only turned up
    // in the scale sweep needs 0.75, otherwise it is usually a coincidence.
    const found = best.sc >= 0.75 ? 'found' : best.exact && best.sc >= 0.6 ? 'check' : 'not found';
    results.push({
      layer: layer.name,
      ref: best.ref.name,
      found,
      score: +best.sc.toFixed(2),
      rect: {
        x: Math.round(best.x / s),
        y: Math.round(best.y / s),
        w: Math.round((layer.size.w * best.k) / s),
        h: Math.round((layer.size.h * best.k) / s),
      },
      // Multiply the file's own pixel size by this to get its size in the artboard.
      artScale: +(best.k / s).toFixed(3),
    });
  }
  return {
    refs: refData.map((r) => ({ name: r.name, size: r.size, scale: +r.scale.toFixed(4), aspectOff: +r.aspectOff.toFixed(3) })),
    results,
  };
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const artboard = svgSize(args.artboard);
  const layers = args.layers
    .filter((f) => path.resolve(f) !== path.resolve(args.artboard))
    .map((f) => ({ name: f, src: dataUrl(f), size: path.extname(f).toLowerCase() === '.svg' ? svgSize(f) : null }));
  const refs = args.refs.map((f) => ({ name: f, src: dataUrl(f) }));

  const browser = await chromium.launch();
  const page = await browser.newPage();
  // Raster layers (PNG/WebP) need their size read in the page.
  for (const l of layers.filter((x) => !x.size)) {
    l.size = await page.evaluate((src) => new Promise((res) => {
      const i = new Image();
      i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight });
      i.src = src;
    }), l.src);
  }
  const out = await page.evaluate(measureInPage, { artboard, refs, layers });
  await browser.close();

  console.log(`Artboard ${artboard.w} × ${artboard.h} (${args.artboard})`);
  for (const r of out.refs) {
    const warn = r.aspectOff > 0.02 ? '  ⚠ aspect ratio differs from the artboard: is this a crop? Results will be off.' : '';
    console.log(`Mock-up ${r.name}: ${r.size[0]} × ${r.size[1]}, ${r.scale} of the artboard${warn}`);
  }
  console.log('');
  for (const r of out.results) {
    if (r.error) { console.log(`✗ ${r.layer}: ${r.error}`); continue; }
    if (r.found === 'not found') {
      console.log(`✗ ${r.layer}  not found in the mock-ups (best guess scored ${r.score}): place it by hand`);
      continue;
    }
    const flag = r.found === 'found' ? '✓' : '~ check in a preview:';
    console.log(`${flag} ${r.layer}  score ${r.score}  rect { x: ${r.rect.x}, y: ${r.rect.y}, w: ${r.rect.w}, h: ${r.rect.h} }  art scale ×${r.artScale}  (in ${r.ref})`);
  }
  if (args.json) fs.writeFileSync(args.json, JSON.stringify(out, null, 2));
})().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
