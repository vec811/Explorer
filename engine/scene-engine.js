// Scene engine: builds a preference screen from window.SCENE_CONFIG.
// Config reference: .claude/skills/scene-builder/reference.md
(() => {
  'use strict';

  const CONFIG = window.SCENE_CONFIG;
  const params = new URLSearchParams(location.search);
  // ?static skips every animation (used for screenshots); ?bare shows only the illustration.
  const STATIC = params.has('static');
  const BARE = params.has('bare');

  const TEXT_DEFAULTS = {
    prompt: 'Let’s work on these considerations:',
    progress: '{done} of {total} preferences chosen',
    allSet: 'All set. You can still change any choice before confirming.',
    confirm: 'Confirm my preferences',
    confirmed: 'Preferences confirmed',
    lockedIn: 'Your preferences are locked in.',
    startOver: 'Start over',
    close: 'Close',
    amountSave: 'Save',
  };

  const CONFETTI = ['#d9232e', '#ab6142', '#7f4228', '#24a04d', '#1f5bff', '#f5b400', '#ececec'];

  const app = document.getElementById('app');
  const AMOUNT = 'amount';

  // ---------- Config ----------

  function fail(problems) {
    const msg = `Scene config has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`;
    console.error(msg);
    app.innerHTML = '';
    const pre = document.createElement('pre');
    pre.className = 'config-error';
    pre.textContent = msg;
    app.append(pre);
    throw new Error('Invalid scene config');
  }

  function validate(c) {
    const problems = [];
    if (!c) fail(['window.SCENE_CONFIG is missing. Is scene.config.js loaded before the engine?']);
    const isRect = (r) => r && ['x', 'y', 'w', 'h'].every((k) => typeof r[k] === 'number');
    if (!c.artboard || !(c.artboard.w > 0) || !(c.artboard.h > 0)) problems.push('artboard needs { w, h } (the background illustration size).');
    if (!Array.isArray(c.layers) || !c.layers.length) problems.push('layers needs at least the background image.');
    if (!Array.isArray(c.categories) || !c.categories.length) problems.push('categories needs at least one category.');
    const ids = new Set();
    (c.categories || []).forEach((cat, i) => {
      const where = `categories[${i}]${cat.id ? ` (${cat.id})` : ''}`;
      if (!cat.id) problems.push(`${where}: missing id.`);
      if (ids.has(cat.id)) problems.push(`${where}: duplicate id.`);
      ids.add(cat.id);
      if (!cat.title) problems.push(`${where}: missing title.`);
      if (!cat.box || !cat.box.image || !isRect(cat.box.rect)) problems.push(`${where}: box needs { image, rect: { x, y, w, h } }.`);
      if (cat.swap && !SWAPS[cat.swap]) problems.push(`${where}: unknown swap "${cat.swap}". Use one of: ${Object.keys(SWAPS).join(', ')}.`);
      if (cat.amount) {
        if (cat.options) problems.push(`${where}: use either amount or options, not both.`);
        if (!cat.amount.image) problems.push(`${where}.amount: missing image.`);
        if (cat.amount.rect && !isRect(cat.amount.rect)) problems.push(`${where}.amount: rect needs { x, y, w, h }.`);
        return;
      }
      if (!Array.isArray(cat.options) || cat.options.length < 2) problems.push(`${where}: needs at least two options, or an amount.`);
      const optIds = new Set();
      (cat.options || []).forEach((o, j) => {
        const ow = `${where}.options[${j}]`;
        if (!o.id || optIds.has(o.id)) problems.push(`${ow}: missing or duplicate id.`);
        optIds.add(o.id);
        if (!o.label) problems.push(`${ow}: missing label.`);
        if (!o.image) problems.push(`${ow}: missing image.`);
        if (o.rect && !isRect(o.rect)) problems.push(`${ow}: rect needs { x, y, w, h }.`);
        if (o.front && (!o.front.image || !isRect(o.front.rect))) problems.push(`${ow}: front needs { image, rect: { x, y, w, h } }.`);
      });
    });
    (c.layers || []).forEach((l, i) => {
      if (l.slot || l.front) {
        const id = l.slot || l.front;
        if (!ids.has(id)) problems.push(`layers[${i}]: "${id}" has no matching category id.`);
      } else if (!l.image || !isRect(l.rect)) {
        problems.push(`layers[${i}]: needs { image, rect: { x, y, w, h } }, { slot: "<category id>" } or { front: "<category id>" }.`);
      }
    });
    if (problems.length) fail(problems);
  }

  // ---------- Helpers ----------

  const pct = (v, total) => `${(v / total) * 100}%`;
  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const fmt = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k]);

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function place(node, r) {
    node.style.left = pct(r.x, SCENE.w);
    node.style.top = pct(r.y, SCENE.h);
    node.style.width = pct(r.w, SCENE.w);
    node.style.height = pct(r.h, SCENE.h);
  }

  function makeImg(src, className) {
    const img = new Image();
    img.src = src;
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    img.className = className;
    img.addEventListener('error', () => console.error(`Scene image failed to load: ${src}`));
    return img;
  }

  function imgReady(img) {
    const decoded = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    return Promise.race([decoded, new Promise((r) => setTimeout(r, 1500))]);
  }

  // ---------- Animations ----------
  // Each swap takes (slot, from, to, opt) and returns a promise for when the
  // incoming art has settled. Register new ones here and document them in
  // reference.md so the skill can offer them.

  const SWAPS = {
    // Generic: the old art shrinks into a puff, the new one pops up.
    pop(slot, from, to) {
      track(slot, from.img.animate([
        { transform: 'none', opacity: 1 },
        { transform: 'scale(1.06, 0.9)', offset: 0.3 },
        { transform: 'scale(0.2) rotate(-12deg)', opacity: 0 },
      ], { duration: 320, easing: 'ease-in', fill: 'forwards' }));
      later(slot, () => { puff(from.rect, 6); sparkles(to.rect, 4); }, 260);
      return track(slot, to.img.animate([
        { transform: 'translateY(10%) scale(0.2)', opacity: 0 },
        { transform: 'translateY(-5%) scale(1.08, 1.1)', opacity: 1, offset: 0.55 },
        { transform: 'scale(1.04, 0.95)', offset: 0.78 },
        { transform: 'none', opacity: 1 },
      ], { duration: 620, delay: 260, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' })).finished;
    },

    // Generic: a quick card flip with a twinkle.
    flip(slot, from, to) {
      const OUT = 230;
      track(slot, from.img.animate([
        { transform: 'perspective(900px) rotateY(0deg)', opacity: 1 },
        { transform: 'perspective(900px) rotateY(90deg) scale(0.92)', opacity: 1 },
      ], { duration: OUT, easing: 'cubic-bezier(.5,0,.9,.5)', fill: 'forwards' }));
      later(slot, () => sparkles(to.rect, 4), OUT);
      return track(slot, to.img.animate([
        { transform: 'perspective(900px) rotateY(-90deg) scale(0.92)', opacity: 1 },
        { transform: 'perspective(900px) rotateY(12deg) scale(1.04)', offset: 0.65 },
        { transform: 'perspective(900px) rotateY(0deg)', opacity: 1 },
      ], { duration: 460, delay: OUT, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' })).finished;
    },

    // People: one strolls off to the right, the other strolls in, skids to a stop and hops.
    walk(slot, from, to) {
      const OUT = 560;
      const at = (x, y, r) => `translate(${x}%, ${y}%) rotate(${r}deg)`;
      track(slot, from.img.animate([
        { transform: at(0, 0, 0) },
        { transform: at(-4, 0, -4), offset: 0.15 },
        { transform: at(18, -3, 6), offset: 0.35 },
        { transform: at(42, 0, 6), offset: 0.55 },
        { transform: at(70, -3, 6), offset: 0.75, opacity: 1 },
        { transform: at(100, 0, 6), opacity: 0 },
      ], { duration: OUT, easing: 'ease-in', fill: 'forwards' }));
      later(slot, () => sparkles(topOf(to.rect), 5), OUT + 700);
      return track(slot, to.img.animate([
        { transform: at(100, 0, -6), opacity: 0 },
        { transform: at(76, -3, -6), opacity: 1, offset: 0.14 },
        { transform: at(52, 0, -6), offset: 0.28 },
        { transform: at(28, -3, -6), offset: 0.42 },
        { transform: at(-6, 0, -9), offset: 0.6, easing: 'ease-out' },
        { transform: at(2, 0, 3), offset: 0.72 },
        { transform: 'translateY(0) scale(1.04, 0.94)', offset: 0.8 },
        { transform: 'translateY(-6%) scale(0.97, 1.04)', offset: 0.9 },
        { transform: 'none', opacity: 1 },
      ], { duration: 1000, delay: OUT - 160, easing: 'linear', fill: 'both' })).finished;
    },

    // Places: a privacy curtain swishes across from the left and pulls back on the new art.
    curtain(slot, from, to) {
      const DUR = 1150;
      const SWAP = 0.47;
      const s = sceneScale();
      const x = Math.min(from.rect.x, to.rect.x) - 30;
      const y = Math.min(from.rect.y, to.rect.y) - 90;
      const right = Math.max(from.rect.x + from.rect.w, to.rect.x + to.rect.w) + 30;

      const curtain = el('div', 'fx-curtain');
      place(curtain, { x, y, w: right - x, h: SCENE.h - y });
      curtain.style.setProperty('--pleat', `${Math.max(8, 70 * s)}px`);
      curtain.style.setProperty('--rail', `${Math.max(2, 14 * s)}px`);
      curtain.style.transformOrigin = '0 0';
      slot.el.insertBefore(curtain, slot.hotspot);
      slot.fx.push(curtain);

      track(slot, curtain.animate([
        { transform: 'scaleX(0.03)', opacity: 0.6, easing: 'cubic-bezier(.2,.8,.3,1)' },
        { transform: 'scaleX(1.03) skewX(-2deg)', opacity: 1, offset: 0.36 },
        { transform: 'scaleX(1) skewX(1deg)', opacity: 1, offset: 0.44 },
        { transform: 'scaleX(1)', opacity: 1, offset: 0.6, easing: 'cubic-bezier(.6,0,.4,1)' },
        { transform: 'scaleX(0.03)', opacity: 0.6 },
      ], { duration: DUR, fill: 'forwards' }));
      track(slot, from.img.animate([
        { opacity: 1 }, { opacity: 1, offset: SWAP }, { opacity: 0, offset: SWAP + 0.01 }, { opacity: 0 },
      ], { duration: DUR, fill: 'forwards' }));
      later(slot, () => sparkles(to.rect, 6), DUR * 0.85);
      return track(slot, to.img.animate([
        { opacity: 0, transform: 'none' },
        { opacity: 0, offset: SWAP },
        { opacity: 1, offset: SWAP + 0.01, transform: 'none' },
        { transform: 'none', offset: 0.7 },
        { transform: 'translateY(-5%) scale(0.97, 1.05)', offset: 0.82 },
        { transform: 'scale(1.03, 0.96)', offset: 0.92 },
        { transform: 'none', opacity: 1 },
      ], { duration: DUR, easing: 'ease-in-out', fill: 'both' })).finished;
    },

    // Objects and money: the old art is flicked away, the new one slams down with a
    // shake, a dust ring and a burst of coins in the option's `accent` colour.
    slam(slot, from, to, opt) {
      const DELAY = 220;
      const DUR = 660;
      const IMPACT = 0.5;
      track(slot, from.img.animate([
        { transform: 'none', opacity: 1 },
        { transform: 'translateY(-10%) rotate(-8deg) scale(1.05)', offset: 0.3 },
        { transform: 'translate(70%, -170%) rotate(170deg) scale(0.5)', opacity: 0 },
      ], { duration: 440, easing: 'ease-in', fill: 'forwards' }));
      later(slot, () => {
        coins(to.rect, opt.accent);
        ring(to.rect);
        shake();
        sparkles(to.rect, 4);
      }, DELAY + DUR * IMPACT);
      return track(slot, to.img.animate([
        { transform: 'translateY(-240%) rotate(-14deg)', opacity: 0, easing: 'ease-in' },
        { transform: 'translateY(-180%) rotate(-10deg)', opacity: 1, offset: 0.12, easing: 'cubic-bezier(.55,0,1,.45)' },
        { transform: 'translateY(0) rotate(0) scale(1.2, 0.76)', offset: IMPACT, easing: 'ease-out' },
        { transform: 'translateY(-12%) scale(0.93, 1.09)', offset: 0.68, easing: 'ease-in' },
        { transform: 'translateY(0) scale(1.05, 0.95)', offset: 0.84 },
        { transform: 'none', opacity: 1 },
      ], { duration: DUR, delay: DELAY, fill: 'both' })).finished;
    },
  };

  validate(CONFIG);

  const SCENE = CONFIG.artboard;
  const TEXT = { ...TEXT_DEFAULTS, ...(CONFIG.text || {}), ...(CONFIG.prompt ? { prompt: CONFIG.prompt } : {}) };
  // An amount category behaves like a category with one option, revealed once
  // a number is entered.
  const CATEGORIES = CONFIG.categories.map((c) => (c.amount
    ? { ...c, options: [{ id: AMOUNT, label: '', image: c.amount.image, rect: c.amount.rect, accent: c.amount.accent }] }
    : c));
  const UNLOCK_IN_ORDER = CONFIG.unlockInOrder !== false;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animated = () => !STATIC && !reduceMotion.matches;

  const state = {
    choice: Object.fromEntries(CATEGORIES.map((c) => [c.id, null])),
    amount: Object.fromEntries(CATEGORIES.map((c) => [c.id, null])),
    open: CATEGORIES[0].id,
    committed: false,
  };

  const slots = {};
  const fronts = {};
  const cards = {};
  let sceneEl, fxEl, stageEl, cardsEl, commitBtn, resetBtn, statusEl, liveEl;

  const catById = (id) => CATEGORIES.find((c) => c.id === id);
  const optById = (cat, id) => cat.options.find((o) => o.id === id);
  const formatAmount = (n) => n.toLocaleString('en', { maximumFractionDigits: 2 });
  const choiceText = (cat) => (cat.amount
    ? [formatAmount(state.amount[cat.id]), cat.amount.unit].filter(Boolean).join(' ')
    : optById(cat, state.choice[cat.id]).label);
  const isUnlocked = (i) => !UNLOCK_IN_ORDER || CATEGORIES.slice(0, i).every((c) => state.choice[c.id]);

  function announce(msg) {
    liveEl.textContent = '';
    requestAnimationFrame(() => { liveEl.textContent = msg; });
  }

  // ---------- Page ----------

  function buildPage() {
    document.title = CONFIG.title || document.title;
    if (BARE) document.body.classList.add('is-bare');

    stageEl = el('div', 'stage');
    const topbar = el('header', 'topbar');
    topbar.append(el('h1', 'topbar__title', CONFIG.title || ''));
    const close = el('button', 'topbar__close');
    close.type = 'button';
    close.setAttribute('aria-label', TEXT.close);
    close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg>';
    topbar.append(close);
    sceneEl = el('div', 'scene');
    sceneEl.setAttribute('role', 'img');
    sceneEl.style.aspectRatio = `${SCENE.w} / ${SCENE.h}`;
    stageEl.append(topbar, sceneEl);

    const intro = el('section', 'intro');
    if (CONFIG.headline) intro.append(el('h2', 'intro__headline', CONFIG.headline));
    if (CONFIG.body) intro.append(el('p', 'intro__body', CONFIG.body));

    const considerations = el('section', 'considerations');
    considerations.append(el('h3', 'considerations__title', TEXT.prompt));
    cardsEl = el('div', 'cards');
    considerations.append(cardsEl);

    const bar = el('div', 'commit-bar');
    statusEl = el('p', 'commit-bar__status');
    commitBtn = el('button', 'commit-bar__btn', TEXT.confirm);
    commitBtn.type = 'button';
    resetBtn = el('button', 'commit-bar__reset', TEXT.startOver);
    resetBtn.type = 'button';
    resetBtn.hidden = true;
    bar.append(statusEl, commitBtn, resetBtn);

    liveEl = el('p', 'sr-only');
    liveEl.setAttribute('aria-live', 'polite');

    app.append(stageEl, intro, considerations, bar, liveEl);
    // The sticky stage's height feeds the cards' scroll margin.
    const syncStage = () => app.style.setProperty('--stage-h', `${stageEl.offsetHeight}px`);
    new ResizeObserver(syncStage).observe(stageEl);
    syncStage();

    commitBtn.addEventListener('click', commit);
    resetBtn.addEventListener('click', reset);
    const onScroll = () => stageEl.classList.toggle('is-stuck', window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------- Scene ----------

  function buildScene() {
    const placed = new Set();
    for (const layer of CONFIG.layers) {
      if (layer.slot) {
        sceneEl.append(buildSlot(catById(layer.slot)));
        placed.add(layer.slot);
      } else if (layer.front) {
        fronts[layer.front] = el('div', 'scene__slot');
        sceneEl.append(fronts[layer.front]);
      } else {
        const img = makeImg(layer.image, 'scene__layer');
        place(img, layer.rect);
        if (layer.clip) img.style.clipPath = layer.clip;
        sceneEl.append(img);
      }
    }
    // A category without a { slot } layer goes on top.
    CATEGORIES.filter((c) => !placed.has(c.id)).forEach((c) => sceneEl.append(buildSlot(c)));
    // Option front pieces without a { front } layer go on top too.
    CATEGORIES.filter((c) => !fronts[c.id] && c.options.some((o) => o.front)).forEach((c) => {
      fronts[c.id] = el('div', 'scene__slot');
      sceneEl.append(fronts[c.id]);
    });

    fxEl = el('div', 'scene__fx');
    sceneEl.append(fxEl);

    // Warm the cache so reveals never flash in half-loaded.
    CATEGORIES.forEach((c) => c.options.forEach((o) => {
      new Image().src = o.image;
      if (o.front) new Image().src = o.front.image;
    }));
  }

  function buildSlot(cat) {
    const slotEl = el('div', 'scene__slot');
    slotEl.dataset.slot = cat.id;

    const boxFrame = makeFrame(cat.box.image, cat.box.rect);
    slotEl.append(boxFrame.el);

    const hotspot = el('button', 'scene__hotspot');
    hotspot.type = 'button';
    hotspot.tabIndex = -1;
    hotspot.setAttribute('aria-hidden', 'true');
    place(hotspot, cat.box.rect);
    hotspot.addEventListener('click', () => onSceneTap(cat));
    slotEl.append(hotspot);

    slots[cat.id] = {
      el: slotEl, cat, hotspot, boxFrame, frames: { box: boxFrame }, visible: boxFrame,
      token: 0, anims: [], ghostAnims: [], timers: [], fx: [], hintTimer: null,
    };
    return slotEl;
  }

  function makeFrame(src, rect) {
    const frameEl = el('div', 'scene__frame');
    place(frameEl, rect);
    const img = makeImg(src, 'scene__art');
    frameEl.append(img);
    return { el: frameEl, img, rect };
  }

  function frameFor(slot, opt) {
    if (!opt) return slot.boxFrame;
    if (!slot.frames[opt.id]) {
      const frame = makeFrame(opt.image, opt.rect || slot.cat.box.rect);
      if (opt.clip) frame.img.style.clipPath = opt.clip;
      slot.el.insertBefore(frame.el, slot.hotspot);
      if (opt.front) addFront(slot, frame, opt.front);
      showFrame(frame, false);
      slot.frames[opt.id] = frame;
    }
    return slot.frames[opt.id];
  }

  // An option's front piece is drawn higher up the layers (where its { front }
  // layer sits) but moves with the option art: it sits in a box the size of the
  // art and replays every animation the art plays.
  function addFront(slot, frame, front) {
    const r = frame.rect;
    const ghostEl = el('div', 'scene__frame');
    place(ghostEl, r);
    const mover = el('div', 'scene__ghost');
    const img = makeImg(front.image, 'scene__layer');
    img.style.left = pct(front.rect.x - r.x, r.w);
    img.style.top = pct(front.rect.y - r.y, r.h);
    img.style.width = pct(front.rect.w, r.w);
    img.style.height = pct(front.rect.h, r.h);
    mover.append(img);
    ghostEl.append(mover);
    fronts[slot.cat.id].append(ghostEl);
    frame.ghost = ghostEl;
    const animateArt = frame.img.animate.bind(frame.img);
    frame.img.animate = (keyframes, options) => {
      slot.ghostAnims.push(mover.animate(keyframes, options));
      return animateArt(keyframes, options);
    };
  }

  function showFrame(frame, on) {
    frame.el.style.visibility = on ? '' : 'hidden';
    if (frame.ghost) frame.ghost.style.visibility = on ? '' : 'hidden';
  }

  function track(slot, anim) {
    slot.anims.push(anim);
    anim.finished.catch(() => {});
    return anim;
  }

  function later(slot, fn, ms) {
    slot.timers.push(setTimeout(fn, ms));
  }

  // Snap a slot to its settled state: only `visible` shown, no transforms.
  function settle(slot) {
    slot.anims.forEach((a) => a.cancel());
    slot.ghostAnims.forEach((a) => a.cancel());
    slot.timers.forEach(clearTimeout);
    slot.fx.forEach((node) => node.remove());
    slot.anims = [];
    slot.ghostAnims = [];
    slot.timers = [];
    slot.fx = [];
    for (const f of Object.values(slot.frames)) {
      showFrame(f, f === slot.visible);
      f.img.style.opacity = '';
    }
  }

  async function showInSlot(cat, opt) {
    const slot = slots[cat.id];
    const token = ++slot.token;
    settle(slot);
    const from = slot.visible;
    const to = frameFor(slot, opt);
    if (from === to) return;

    await imgReady(to.img);
    if (token !== slot.token) return;
    settle(slot);

    slot.visible = to;
    if (STATIC) { settle(slot); return; }
    showFrame(from, true);
    showFrame(to, true);

    let done;
    if (reduceMotion.matches) done = crossfade(slot, from, to);
    else if (from === slot.boxFrame) done = unbox(slot, from, to);
    else if (to === slot.boxFrame) done = rebox(slot, from, to);
    else done = SWAPS[cat.swap || 'pop'](slot, from, to, opt);

    try { await done; } catch { return; }
    if (token === slot.token) settle(slot);
  }

  function crossfade(slot, from, to) {
    track(slot, from.img.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }));
    return track(slot, to.img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'both' })).finished;
  }

  // First reveal: the box hops, wobbles, bursts open in a puff of confetti and the art springs out.
  function unbox(slot, from, to) {
    const BURST_AT = 560;
    track(slot, from.img.animate([
      { transform: 'none' },
      { transform: 'scale(1.08, 0.86)', offset: 0.18 },
      { transform: 'translateY(-7%) scale(0.94, 1.08) rotate(-4deg)', offset: 0.42 },
      { transform: 'translateY(-5%) scale(1, 1) rotate(4deg)', offset: 0.6 },
      { transform: 'translateY(-6%) scale(1.04, 0.98) rotate(-2deg)', offset: 0.74, opacity: 1 },
      { transform: 'translateY(-3%) scale(1.35)', opacity: 0 },
    ], { duration: 760, easing: 'ease-in-out', fill: 'forwards' }));

    later(slot, () => {
      puff(from.rect);
      confetti(from.rect);
    }, BURST_AT);
    later(slot, () => sparkles(to.rect), BURST_AT + 260);

    return track(slot, to.img.animate([
      { transform: 'translateY(14%) scale(0.2)', opacity: 0 },
      { transform: 'translateY(-6%) scale(1.08, 1.1)', opacity: 1, offset: 0.5 },
      { transform: 'translateY(0) scale(1.06, 0.93)', offset: 0.7 },
      { transform: 'translateY(-1.5%) scale(0.98, 1.03)', offset: 0.85 },
      { transform: 'none', opacity: 1 },
    ], { duration: 820, delay: BURST_AT, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' })).finished;
  }

  // Back to the box ("Start over"): the art shrinks away, the box drops in.
  function rebox(slot, from, to) {
    track(slot, from.img.animate([
      { transform: 'none', opacity: 1 },
      { transform: 'scale(0.3)', opacity: 0 },
    ], { duration: 260, easing: 'ease-in', fill: 'forwards' }));

    return track(slot, to.img.animate([
      { transform: 'translateY(-60%)', opacity: 0 },
      { transform: 'translateY(0) scale(1.08, 0.88)', opacity: 1, offset: 0.6 },
      { transform: 'translateY(-4%) scale(0.97, 1.04)', offset: 0.8 },
      { transform: 'none', opacity: 1 },
    ], { duration: 560, delay: 160, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'both' })).finished;
  }

  // Idle "something's inside" rattle on the box whose card is open.
  function updateHints() {
    for (const cat of CATEGORIES) {
      const slot = slots[cat.id];
      const want = animated() && !state.committed && state.open === cat.id && !state.choice[cat.id];
      if (want && !slot.hintTimer) {
        slot.hintTimer = setInterval(() => rattle(slot), 2600);
        setTimeout(() => rattle(slot), 500);
      } else if (!want && slot.hintTimer) {
        clearInterval(slot.hintTimer);
        slot.hintTimer = null;
      }
    }
  }

  function rattle(slot, strong) {
    if (!animated() || slot.visible !== slot.boxFrame || slot.anims.length) return;
    const a = strong ? 5 : 3;
    slot.boxFrame.img.animate([
      { transform: 'none' },
      { transform: `translateY(-3%) rotate(-${a}deg)`, offset: 0.2 },
      { transform: `translateY(-1%) rotate(${a}deg)`, offset: 0.4 },
      { transform: `translateY(-2%) rotate(-${a / 2}deg)`, offset: 0.6 },
      { transform: 'scale(1.03, 0.97)', offset: 0.8 },
      { transform: 'none' },
    ], { duration: 520, easing: 'ease-in-out' });
  }

  // ---------- Effects ----------

  function sceneScale() {
    return sceneEl.clientWidth / SCENE.w;
  }

  const topOf = (r) => ({ x: r.x, y: r.y, w: r.w, h: r.h * 0.3 });

  function spawn(className, r, size) {
    const node = el('div', className);
    node.style.left = pct(r.x, SCENE.w);
    node.style.top = pct(r.y, SCENE.h);
    node.style.width = `${size}px`;
    node.style.height = `${size}px`;
    node.style.marginLeft = `${-size / 2}px`;
    node.style.marginTop = `${-size / 2}px`;
    fxEl.append(node);
    return node;
  }

  function cleanupOnFinish(anim, node) {
    anim.finished.catch(() => {}).finally(() => node.remove());
  }

  function puff(rect, count = 9) {
    const s = sceneScale();
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h * 0.55;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
      const size = Math.max(10, Math.min(rect.w * s * rand(0.28, 0.42), sceneEl.clientWidth * 0.12));
      const node = spawn('fx-puff', { x: cx + Math.cos(angle) * rect.w * 0.12, y: cy + Math.sin(angle) * rect.h * 0.1 }, size);
      const dx = Math.cos(angle) * rect.w * s * rand(0.3, 0.45);
      const dy = Math.sin(angle) * rect.h * s * rand(0.15, 0.3);
      const anim = node.animate([
        { transform: 'translate(0,0) scale(0.2)', opacity: 0.95 },
        { transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) scale(1)`, opacity: 0.9, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy - size * 0.3}px) scale(1.25)`, opacity: 0 },
      ], { duration: rand(600, 800), easing: 'cubic-bezier(.2,.7,.3,1)' });
      cleanupOnFinish(anim, node);
    }
  }

  function confetti(rect, count = 26) {
    const s = sceneScale();
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h * 0.45;
    const reach = Math.max(60, sceneEl.clientWidth * 0.14);
    for (let i = 0; i < count; i++) {
      const tape = i < 2;
      const size = tape ? Math.max(10, Math.min(rect.w * s * 0.18, 40)) : rand(5, 9) * Math.max(0.8, s * 3);
      const node = spawn('fx-particle', { x: cx + rand(-rect.w, rect.w) * 0.2, y: cy }, size);
      node.style.background = tape ? '#ececec' : pick(CONFETTI);
      node.style.height = tape ? `${size * 0.45}px` : `${size * (Math.random() < 0.5 ? 1 : 0.5)}px`;
      node.style.borderRadius = !tape && Math.random() < 0.35 ? '50%' : '1px';
      const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const dist = reach * rand(0.45, 1);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const spin = rand(-540, 540);
      const anim = node.animate([
        { transform: 'translate(0,0) rotate(0deg) scale(0.5)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin * 0.5}deg) scale(1)`, opacity: 1, offset: 0.4, easing: 'ease-in' },
        { transform: `translate(${dx * 1.2}px, ${dy + reach * rand(0.6, 1)}px) rotate(${spin}deg) scale(0.9)`, opacity: 0 },
      ], { duration: rand(900, 1300), easing: 'cubic-bezier(.15,.75,.3,1)' });
      cleanupOnFinish(anim, node);
    }
  }

  function coins(rect, color = '#f5b400', count = 14) {
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h * 0.6;
    const reach = Math.max(50, sceneEl.clientWidth * 0.12);
    const size = Math.max(7, sceneEl.clientWidth * 0.026);
    for (let i = 0; i < count; i++) {
      const node = spawn('fx-coin', { x: cx + rand(-0.3, 0.3) * rect.w, y: cy }, size);
      node.style.background = color;
      const angle = rand(-Math.PI * 0.92, -Math.PI * 0.08);
      const dist = reach * rand(0.4, 1);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const fall = reach * rand(0.5, 0.9);
      const anim = node.animate([
        { transform: 'translate(0,0) scale(0.4, 0.4)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.7}px) scale(0.15, 1)`, offset: 0.2 },
        { transform: `translate(${dx * 0.8}px, ${dy}px) scale(1, 1)`, offset: 0.4, easing: 'ease-in' },
        { transform: `translate(${dx}px, ${dy + fall * 0.5}px) scale(0.15, 1)`, offset: 0.7 },
        { transform: `translate(${dx * 1.1}px, ${dy + fall}px) scale(1, 1)`, opacity: 0 },
      ], { duration: rand(800, 1100), delay: rand(0, 80), easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'backwards' });
      cleanupOnFinish(anim, node);
    }
  }

  // Dust ring where something lands.
  function ring(rect) {
    const w = rect.w * sceneScale() * 1.3;
    const node = spawn('fx-ring', { x: rect.x + rect.w / 2, y: rect.y + rect.h * 0.95 }, w);
    node.style.height = `${w * 0.28}px`;
    node.style.marginTop = `${-w * 0.14}px`;
    cleanupOnFinish(node.animate([
      { transform: 'scale(0.3)', opacity: 0.9 },
      { transform: 'scale(1.3)', opacity: 0 },
    ], { duration: 520, easing: 'ease-out' }), node);
  }

  function shake() {
    sceneEl.animate([
      { transform: 'none' },
      { transform: 'translate(-3px, 2px)' },
      { transform: 'translate(3px, -2px)' },
      { transform: 'translate(-2px, 1px)' },
      { transform: 'translate(1px, 0)' },
      { transform: 'none' },
    ], { duration: 280, easing: 'ease-out' });
  }

  const SPARKLE_SVG = '<svg viewBox="0 0 24 24"><path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z"/></svg>';

  function sparkles(rect, count = 5) {
    const base = Math.max(12, sceneEl.clientWidth * 0.035);
    for (let i = 0; i < count; i++) {
      const p = { x: rect.x + rect.w * rand(0, 1), y: rect.y + rect.h * rand(0, 0.8) };
      const node = spawn('fx-sparkle', p, base * rand(0.6, 1.1));
      node.innerHTML = SPARKLE_SVG;
      node.querySelector('path').setAttribute('fill', pick(['#f5b400', '#ffd54a', '#d9232e', '#ffffff']));
      node.style.filter = 'drop-shadow(0 0 1px rgba(0,0,0,.25))';
      const anim = node.animate([
        { transform: 'scale(0) rotate(0deg)', opacity: 0 },
        { transform: 'scale(1.1) rotate(90deg)', opacity: 1, offset: 0.45 },
        { transform: 'scale(0) rotate(180deg)', opacity: 0 },
      ], { duration: rand(600, 850), delay: i * 90, easing: 'ease-out', fill: 'backwards' });
      cleanupOnFinish(anim, node);
    }
  }

  function celebrate() {
    if (!animated()) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => confetti({ x: rand(0.08, 0.92) * SCENE.w, y: rand(-0.07, 0.14) * SCENE.h, w: SCENE.w * 0.12, h: SCENE.h * 0.14 }, 18), i * 140);
    }
    CATEGORIES.forEach((cat, i) => {
      const slot = slots[cat.id];
      setTimeout(() => {
        slot.visible.img.animate([
          { transform: 'none' },
          { transform: 'translateY(-6%) scale(0.97, 1.05)', offset: 0.35 },
          { transform: 'scale(1.04, 0.95)', offset: 0.7 },
          { transform: 'none' },
        ], { duration: 520, easing: 'ease-in-out' });
        sparkles(slot.visible.rect, 3);
      }, 200 + i * 160);
    });
  }

  // ---------- Cards ----------

  const ICON = `
    <svg class="icon-plus" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="11.5"/><path d="M13 7.5v11M7.5 13h11"/></svg>
    <svg class="icon-check" viewBox="0 0 26 26" aria-hidden="true"><circle cx="13" cy="13" r="11.5"/><path d="M8 13.5l3.4 3.4L18 10"/></svg>`;

  function buildCards() {
    CATEGORIES.forEach((cat, i) => {
      const card = el('div', 'card');
      card.dataset.cat = cat.id;
      const bodyId = `card-body-${i}`;

      const header = el('button', 'card__header');
      header.type = 'button';
      header.setAttribute('aria-expanded', 'false');
      header.setAttribute('aria-controls', bodyId);
      const icon = el('span', 'card__icon');
      icon.innerHTML = ICON;
      const choiceEl = el('span', 'card__choice');
      header.append(el('span', 'card__title', cat.title), icon);
      if (cat.description) header.append(el('span', 'card__desc', cat.description));
      header.append(choiceEl);

      const body = el('div', 'card__body');
      body.id = bodyId;
      const inner = el('div', 'card__body-inner');
      let inputs = [];
      let amountEl = null;
      if (cat.amount) {
        amountEl = buildAmount(cat, i);
        inner.append(amountEl.el);
      } else {
        const fieldset = el('fieldset', 'options');
        const legend = el('legend', 'sr-only', cat.title);
        fieldset.append(legend);
        inputs = cat.options.map((o) => {
          const label = el('label', 'option');
          const input = el('input');
          input.type = 'radio';
          input.name = `cat-${i}`;
          input.value = o.id;
          input.addEventListener('change', () => choose(cat, o.id));
          const box = el('span', 'option__box');
          const text = el('span', 'option__text');
          text.append(el('span', 'option__label', o.label));
          if (o.detail) text.append(el('span', 'option__detail', o.detail));
          if (o.description) text.append(el('span', 'option__desc', o.description));
          box.append(el('span', 'option__radio'), text);
          label.append(input, box);
          fieldset.append(label);
          return input;
        });
        inner.append(fieldset);
      }
      body.append(inner);
      card.append(header, body);

      header.addEventListener('click', () => toggleCard(cat.id));
      cardsEl.append(card);
      cards[cat.id] = { el: card, header, inputs, amount: amountEl, choiceEl, body: inner };
    });
  }

  // A typed amount: the box opens once a number is saved (Enter, leaving the
  // field, or the button), and closes again if the field is cleared.
  function buildAmount(cat, i) {
    const a = cat.amount;
    const wrap = el('div', 'amount');
    const field = el('label', 'amount__field');
    const input = el('input', 'amount__input');
    input.type = 'text';
    input.inputMode = 'decimal';
    input.autocomplete = 'off';
    input.id = `amount-${i}`;
    if (a.placeholder) input.placeholder = a.placeholder;
    const row = el('span', 'amount__row');
    row.append(input);
    if (a.unit) row.append(el('span', 'amount__unit', a.unit));
    field.append(el('span', 'amount__label', a.label || cat.title), row);
    const save = el('button', 'amount__save', TEXT.amountSave);
    save.type = 'button';
    wrap.append(field, save);

    const sync = () => { save.disabled = state.committed || !input.value.trim(); };
    const submit = () => {
      const raw = input.value.replace(/[^\d.]/g, '');
      enter(cat, raw === '' || Number.isNaN(Number(raw)) ? null : Number(raw));
      if (state.amount[cat.id] != null) input.value = formatAmount(state.amount[cat.id]);
      sync();
    };
    input.addEventListener('input', sync);
    input.addEventListener('change', submit);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    save.addEventListener('click', submit);
    sync();
    return { el: wrap, input, save, sync };
  }

  function render() {
    CATEGORIES.forEach((cat, i) => {
      const c = cards[cat.id];
      const unlocked = isUnlocked(i);
      const open = state.open === cat.id && unlocked && !state.committed;
      const chosen = state.choice[cat.id];

      c.el.classList.toggle('is-locked', !unlocked);
      c.el.classList.toggle('is-open', open);
      c.el.classList.toggle('is-chosen', !!chosen);
      c.header.disabled = !unlocked || state.committed;
      c.header.setAttribute('aria-expanded', String(open));
      c.body.inert = !open;
      c.inputs.forEach((input) => {
        input.checked = input.value === chosen;
        input.disabled = state.committed;
      });
      if (c.amount) {
        c.amount.input.disabled = state.committed;
        if (!chosen && document.activeElement !== c.amount.input) c.amount.input.value = '';
        c.amount.sync();
      }
      c.choiceEl.textContent = chosen ? choiceText(cat) : '';
    });

    const done = CATEGORIES.filter((c) => state.choice[c.id]).length;
    const all = done === CATEGORIES.length;
    commitBtn.disabled = !all || state.committed;
    commitBtn.classList.toggle('is-done', state.committed);
    commitBtn.textContent = state.committed ? TEXT.confirmed : TEXT.confirm;
    resetBtn.hidden = !state.committed;
    statusEl.textContent = state.committed ? TEXT.lockedIn
      : all ? TEXT.allSet : fmt(TEXT.progress, { done, total: CATEGORIES.length });

    sceneEl.classList.toggle('is-committed', state.committed);
    sceneEl.setAttribute('aria-label', `${CONFIG.sceneLabel || 'Illustration'}. ` + CATEGORIES.map((cat) => {
      return `${cat.title}: ${state.choice[cat.id] ? choiceText(cat) : 'not chosen yet'}.`;
    }).join(' '));

    updateHints();
  }

  function toggleCard(id) {
    if (state.committed) return;
    state.open = state.open === id ? null : id;
    render();
  }

  function choose(cat, optionId) {
    if (state.committed || state.choice[cat.id] === optionId) return;
    const i = CATEGORIES.indexOf(cat);
    const next = CATEGORIES[i + 1];
    const nextWasLocked = next && !isUnlocked(i + 1);

    state.choice[cat.id] = optionId;
    const opt = optById(cat, optionId);
    showInSlot(cat, opt);
    announce(opt ? `${cat.title}: ${choiceText(cat)} ${cat.amount ? 'saved' : 'selected'}.` : `${cat.title}: cleared.`);
    render();

    if (nextWasLocked && isUnlocked(i + 1)) flash(cards[next.id].el, 'is-unlocking');
  }

  function enter(cat, value) {
    if (state.committed) return;
    const changed = value !== state.amount[cat.id];
    state.amount[cat.id] = value;
    if (value == null) choose(cat, null);
    else if (!state.choice[cat.id]) choose(cat, AMOUNT);
    else if (changed) {
      announce(`${cat.title}: ${choiceText(cat)} saved.`);
      render();
    }
  }

  function flash(node, className) {
    node.classList.remove(className);
    void node.offsetWidth;
    node.classList.add(className);
    node.addEventListener('animationend', () => node.classList.remove(className), { once: true });
  }

  function scrollToCard(id) {
    cards[id].el.scrollIntoView({ behavior: animated() ? 'smooth' : 'auto', block: 'nearest' });
  }

  function onSceneTap(cat) {
    if (state.committed) return;
    const i = CATEGORIES.indexOf(cat);
    const slot = slots[cat.id];
    if (!isUnlocked(i)) {
      rattle(slot, true);
      const pending = CATEGORIES.find((c, j) => isUnlocked(j) && !state.choice[c.id]);
      if (pending) {
        flash(cards[pending.id].el, 'is-nudge');
        if (state.open !== pending.id) { state.open = pending.id; render(); }
        scrollToCard(pending.id);
      }
      return;
    }
    if (!state.choice[cat.id]) rattle(slot, true);
    state.open = cat.id;
    render();
    scrollToCard(cat.id);
  }

  function commit() {
    if (commitBtn.disabled) return;
    state.committed = true;
    state.open = null;
    render();
    celebrate();
    announce(TEXT.confirmed);
  }

  function reset() {
    state.committed = false;
    CATEGORIES.forEach((cat) => {
      state.choice[cat.id] = null;
      state.amount[cat.id] = null;
      showInSlot(cat, null);
    });
    state.open = CATEGORIES[0].id;
    render();
    window.scrollTo({ top: 0, behavior: animated() ? 'smooth' : 'auto' });
  }

  buildPage();
  buildScene();
  buildCards();
  render();

  // Hook for the preview script and for poking at a scene from the console.
  window.SceneEngine = {
    config: CONFIG,
    state,
    // For an amount category, pass the number instead of an option id.
    select(catId, optId) {
      const cat = catById(catId);
      if (cat && cat.amount && typeof optId === 'number') {
        state.open = catId;
        enter(cat, optId);
        return;
      }
      if (!cat || !optById(cat, optId)) throw new Error(`No option ${catId}.${optId}`);
      state.open = catId;
      choose(cat, optId);
    },
    commit,
    reset,
  };
})();
