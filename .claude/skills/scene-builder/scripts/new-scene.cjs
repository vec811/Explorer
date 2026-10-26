#!/usr/bin/env node
// Creates scenes/<slug>/ from the templates and lists it on the gallery page.
//
//   node new-scene.cjs <slug> "<Title>" ["<one-line description>"]
//
// Run from the repository root. Refuses to overwrite an existing scene.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const [slug, title, description = ''] = process.argv.slice(2);
if (!slug || !title || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
  console.error('Usage: node new-scene.cjs <slug> "<Title>" ["<description>"]   (slug: lowercase words joined by hyphens)');
  process.exit(2);
}

const root = process.cwd();
if (!fs.existsSync(path.join(root, 'engine', 'scene-engine.js'))) {
  console.error('Run this from the repository root (the folder that contains engine/).');
  process.exit(2);
}

const dir = path.join(root, 'scenes', slug);
if (fs.existsSync(dir)) {
  console.error(`scenes/${slug} already exists. Edit it instead of creating it again.`);
  process.exit(1);
}

const templates = path.join(__dirname, '..', 'templates');
const fill = (s) => s.replace(/\{\{TITLE\}\}/g, title.replace(/'/g, '’'));
fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
fs.mkdirSync(path.join(dir, 'reference'), { recursive: true });
for (const f of ['index.html', 'scene.config.js']) {
  fs.writeFileSync(path.join(dir, f), fill(fs.readFileSync(path.join(templates, f), 'utf8')));
}

// Add the scene to scenes/scenes.js, which the gallery page reads.
const registry = path.join(root, 'scenes', 'scenes.js');
const sandbox = { window: {} };
if (fs.existsSync(registry)) vm.runInNewContext(fs.readFileSync(registry, 'utf8'), sandbox);
const scenes = sandbox.window.SCENES || [];
scenes.push({ slug, title, description, thumbnail: '' });
const body = scenes.map((s) => `  ${JSON.stringify(s)},`).join('\n');
fs.writeFileSync(registry, `// Scenes listed on the gallery page (index.html at the site root).
// \`thumbnail\` is a path from the site root, usually the scene's revealed mock-up.
window.SCENES = [
${body}
];
`);

console.log(`Created scenes/${slug}/ (index.html, scene.config.js, assets/, reference/) and added it to scenes/scenes.js.`);
