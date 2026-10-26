(() => {
  'use strict';

  const ART = 'assets/illustrations/';

  // Every position below is in the 2500 × 1412 artboard of hospitalisation-empty.svg.
  const SCENE = { w: 2500, h: 1412 };

  const BACKGROUND = { src: 'hospitalisation-empty.svg', x: 0, y: 0, w: 2500, h: 1412 };
  const PATIENT = { src: 'patient.svg', x: 501, y: 324, w: 1257, h: 1126 };

  // The IV pole has to sit behind the specialist slot while the bed foot sits in
  // front of it, so the patient is drawn twice: a full copy behind the slot and a
  // copy in front with the pole area (x > 800, y < 585 in patient.svg) clipped out.
  const PATIENT_FRONT_CLIP = 'polygon(0 0, 63.64% 0, 63.64% 51.95%, 100% 51.95%, 100% 100%, 0 100%)';

  // `box` is the default (unrevealed) art. Each option shows `src` in the box's
  // rectangle, bottom-centred and scaled to fit. If a final illustration needs a
  // different footprint, give the option its own `rect: { x, y, w, h }`.
  const CATEGORIES = [
    {
      id: 'specialist',
      title: 'Specialist',
      desc: 'Consider whether you’d like to have a preferred medical specialist or one who’s assigned by the hospital.',
      box: { src: 'Doctor_box.svg', x: 1318, y: 321, w: 527, h: 943 },
      options: [
        { id: 'assigned', label: 'Accept any specialist', src: 'Doctor_assigned.svg' },
        { id: 'choice', label: 'Choose my preferred specialist', src: 'Doctor_choice.svg' },
      ],
    },
    {
      id: 'ward',
      title: 'Hospital and ward',
      desc: 'Get treated in a hospital ward of your choice, with options ranging from single-bedder to shared room.',
      box: { src: 'Ward_box.svg', x: 34, y: 799, w: 564, h: 543 },
      options: [
        { id: 'shared', label: 'Shared room', src: 'Shared_room.svg' },
        { id: 'private', label: 'Private room', src: 'armchair.svg' },
      ],
    },
    {
      id: 'coverage',
      title: 'Bill coverage',
      desc: 'Obtain additional support to keep your out-of-pocket expenses in check.',
      box: { src: 'Coverage_box.svg', x: 2085, y: 605, w: 235, h: 177 },
      options: [
        { id: 'shield', label: 'Use Integrated Shield Plan only', src: 'pay_silver.svg' },
        { id: 'supplementary', label: 'Through adding supplementary coverage', src: 'pay_gold.svg' },
      ],
    },
  ];

  // Back-to-front stacking order of the scene.
  const STACK = ['background', 'patient-back', 'specialist', 'patient-front', 'ward', 'coverage'];

  const CONFETTI = ['#d9232e', '#ab6142', '#7f4228', '#24a04d', '#1f5bff', '#f5b400', '#ececec'];

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const state = {
    choice: Object.fromEntries(CATEGORIES.map((c) => [c.id, null])),
    open: CATEGORIES[0].id,
    committed: false,
  };

  const sceneEl = document.getElementById('scene');
  const cardsEl = document.getElementById('cards');
  const commitBtn = document.getElementById('commit-btn');
  const resetBtn = document.getElementById('reset-btn');
  const statusEl = document.getElementById('commit-status');
  const liveEl = document.getElementById('live');

  const slots = {};
  const cards = {};
  let fxEl;

  // ---------- Helpers ----------

  const pct = (v, total) => `${(v / total) * 100}%`;

  function place(el, r) {
    el.style.left = pct(r.x, SCENE.w);
    el.style.top = pct(r.y, SCENE.h);
    el.style.width = pct(r.w, SCENE.w);
    el.style.height = pct(r.h, SCENE.h);
  }

  function makeImg(src, className) {
    const img = new Image();
    img.src = ART + src;
    img.alt = '';
    img.draggable = false;
    img.decoding = 'async';
    img.className = className;
    return img;
  }

  function imgReady(img) {
    const decoded = img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    return Promise.race([decoded, new Promise((r) => setTimeout(r, 1500))]);
  }

  const rand = (min, max) => min + Math.random() * (max - min);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const catById = (id) => CATEGORIES.find((c) => c.id === id);
  const optById = (cat, id) => cat.options.find((o) => o.id === id);
  const isUnlocked = (i) => CATEGORIES.slice(0, i).every((c) => state.choice[c.id]);

  function announce(msg) {
    liveEl.textContent = '';
    requestAnimationFrame(() => { liveEl.textContent = msg; });
  }

  // ---------- Scene ----------

  function buildScene() {
    for (const layer of STACK) {
      if (layer === 'background') {
        const img = makeImg(BACKGROUND.src, 'scene__layer');
        place(img, BACKGROUND);
        sceneEl.append(img);
      } else if (layer.startsWith('patient')) {
        const img = makeImg(PATIENT.src, 'scene__layer');
        place(img, PATIENT);
        if (layer === 'patient-front') img.style.clipPath = PATIENT_FRONT_CLIP;
        sceneEl.append(img);
      } else {
        sceneEl.append(buildSlot(catById(layer)));
      }
    }
    fxEl = document.createElement('div');
    fxEl.className = 'scene__fx';
    sceneEl.append(fxEl);

    // Warm the cache so reveals never flash in half-loaded.
    CATEGORIES.forEach((c) => c.options.forEach((o) => { new Image().src = ART + o.src; }));
  }

  function buildSlot(cat) {
    const el = document.createElement('div');
    el.className = 'scene__slot';
    el.dataset.slot = cat.id;

    const boxFrame = makeFrame(cat.box.src, cat.box);
    el.append(boxFrame.el);

    const hotspot = document.createElement('button');
    hotspot.type = 'button';
    hotspot.className = 'scene__hotspot';
    hotspot.tabIndex = -1;
    hotspot.setAttribute('aria-hidden', 'true');
    place(hotspot, cat.box);
    hotspot.addEventListener('click', () => onSceneTap(cat));
    el.append(hotspot);

    slots[cat.id] = {
      el, cat, boxFrame, frames: { box: boxFrame }, visible: boxFrame,
      token: 0, anims: [], timers: [], hintTimer: null,
    };
    return el;
  }

  function makeFrame(src, rect) {
    const el = document.createElement('div');
    el.className = 'scene__frame';
    place(el, rect);
    const img = makeImg(src, 'scene__art');
    el.append(img);
    return { el, img, rect };
  }

  function frameFor(slot, opt) {
    if (!opt) return slot.boxFrame;
    if (!slot.frames[opt.id]) {
      const frame = makeFrame(opt.src, opt.rect || slot.cat.box);
      frame.el.style.visibility = 'hidden';
      slot.el.insertBefore(frame.el, slot.el.querySelector('.scene__hotspot'));
      slot.frames[opt.id] = frame;
    }
    return slot.frames[opt.id];
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
    slot.timers.forEach(clearTimeout);
    slot.anims = [];
    slot.timers = [];
    for (const f of Object.values(slot.frames)) {
      f.el.style.visibility = f === slot.visible ? '' : 'hidden';
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
    from.el.style.visibility = '';
    to.el.style.visibility = '';

    let done;
    if (reduceMotion.matches) done = crossfade(slot, from, to);
    else if (from === slot.boxFrame) done = unbox(slot, from, to);
    else if (to === slot.boxFrame) done = rebox(slot, from, to);
    else done = flipSwap(slot, from, to);

    try { await done; } catch { return; }
    if (token === slot.token) settle(slot);
  }

  function crossfade(slot, from, to) {
    track(slot, from.img.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, fill: 'forwards' }));
    return track(slot, to.img.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 220, fill: 'both' })).finished;
  }

  // Box hops, wobbles, bursts open in a puff of confetti; the illustration springs out.
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

  // Switching between two revealed options: a quick card-flip with a twinkle.
  function flipSwap(slot, from, to) {
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
  }

  // Back to the box (used by "Start over"): the art shrinks away, the box drops in.
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
      const want = !state.committed && state.open === cat.id && !state.choice[cat.id] && !reduceMotion.matches;
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
    if (slot.visible !== slot.boxFrame || slot.anims.length) return;
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

  function spawn(className, r, size) {
    const el = document.createElement('div');
    el.className = className;
    el.style.left = pct(r.x, SCENE.w);
    el.style.top = pct(r.y, SCENE.h);
    el.style.width = `${size}px`;
    el.style.height = `${size}px`;
    el.style.marginLeft = `${-size / 2}px`;
    el.style.marginTop = `${-size / 2}px`;
    fxEl.append(el);
    return el;
  }

  function cleanupOnFinish(anim, el) {
    anim.finished.catch(() => {}).finally(() => el.remove());
  }

  function puff(rect) {
    const s = sceneScale();
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h * 0.55;
    const count = 9;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + rand(-0.3, 0.3);
      const size = Math.max(10, rect.w * s * rand(0.28, 0.42));
      const el = spawn('fx-puff', { x: cx + Math.cos(angle) * rect.w * 0.12, y: cy + Math.sin(angle) * rect.h * 0.1 }, size);
      const dx = Math.cos(angle) * rect.w * s * rand(0.3, 0.45);
      const dy = Math.sin(angle) * rect.h * s * rand(0.15, 0.3);
      const anim = el.animate([
        { transform: 'translate(0,0) scale(0.2)', opacity: 0.95 },
        { transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) scale(1)`, opacity: 0.9, offset: 0.4 },
        { transform: `translate(${dx}px, ${dy - size * 0.3}px) scale(1.25)`, opacity: 0 },
      ], { duration: rand(600, 800), easing: 'cubic-bezier(.2,.7,.3,1)' });
      cleanupOnFinish(anim, el);
    }
  }

  function confetti(rect, count = 26) {
    const s = sceneScale();
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h * 0.45;
    const reach = Math.max(60, sceneEl.clientWidth * 0.14);
    for (let i = 0; i < count; i++) {
      const tape = i < 2;
      const size = tape ? Math.max(10, rect.w * s * 0.18) : rand(5, 9) * Math.max(0.8, s * 3);
      const el = spawn('fx-particle', { x: cx + rand(-rect.w, rect.w) * 0.2, y: cy }, size);
      el.style.background = tape ? '#ececec' : pick(CONFETTI);
      el.style.height = tape ? `${size * 0.45}px` : `${size * (Math.random() < 0.5 ? 1 : 0.5)}px`;
      el.style.borderRadius = !tape && Math.random() < 0.35 ? '50%' : '1px';
      const angle = rand(-Math.PI * 0.95, -Math.PI * 0.05);
      const dist = reach * rand(0.45, 1);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const spin = rand(-540, 540);
      const anim = el.animate([
        { transform: 'translate(0,0) rotate(0deg) scale(0.5)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(${spin * 0.5}deg) scale(1)`, opacity: 1, offset: 0.4, easing: 'ease-in' },
        { transform: `translate(${dx * 1.2}px, ${dy + reach * rand(0.6, 1)}px) rotate(${spin}deg) scale(0.9)`, opacity: 0 },
      ], { duration: rand(900, 1300), easing: 'cubic-bezier(.15,.75,.3,1)' });
      cleanupOnFinish(anim, el);
    }
  }

  const SPARKLE_SVG = '<svg viewBox="0 0 24 24"><path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z"/></svg>';

  function sparkles(rect, count = 5) {
    const base = Math.max(12, sceneEl.clientWidth * 0.035);
    for (let i = 0; i < count; i++) {
      const p = {
        x: rect.x + rect.w * rand(0, 1),
        y: rect.y + rect.h * rand(0, 0.8),
      };
      const el = spawn('fx-sparkle', p, base * rand(0.6, 1.1));
      el.innerHTML = SPARKLE_SVG;
      el.querySelector('path').setAttribute('fill', pick(['#f5b400', '#ffd54a', '#d9232e', '#ffffff']));
      el.style.filter = 'drop-shadow(0 0 1px rgba(0,0,0,.25))';
      const anim = el.animate([
        { transform: 'scale(0) rotate(0deg)', opacity: 0 },
        { transform: 'scale(1.1) rotate(90deg)', opacity: 1, offset: 0.45 },
        { transform: 'scale(0) rotate(180deg)', opacity: 0 },
      ], { duration: rand(600, 850), delay: i * 90, easing: 'ease-out', fill: 'backwards' });
      cleanupOnFinish(anim, el);
    }
  }

  function celebrate() {
    if (reduceMotion.matches) return;
    for (let i = 0; i < 5; i++) {
      setTimeout(() => confetti({ x: rand(200, 2300), y: rand(-100, 200), w: 300, h: 200 }, 18), i * 140);
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
    CATEGORIES.forEach((cat) => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.cat = cat.id;

      const bodyId = `card-body-${cat.id}`;
      const titleId = `card-title-${cat.id}`;
      card.innerHTML = `
        <button class="card__header" type="button" aria-expanded="false" aria-controls="${bodyId}">
          <span class="card__title" id="${titleId}">${cat.title}</span>
          <span class="card__icon">${ICON}</span>
          <span class="card__desc">${cat.desc}</span>
          <span class="card__choice"></span>
        </button>
        <div class="card__body" id="${bodyId}">
          <div class="card__body-inner">
            <fieldset class="options">
              <legend class="sr-only">${cat.title}</legend>
              ${cat.options.map((o) => `
                <label class="option">
                  <input type="radio" name="${cat.id}" value="${o.id}">
                  <span class="option__box"><span class="option__radio"></span>${o.label}</span>
                </label>`).join('')}
            </fieldset>
          </div>
        </div>`;

      const header = card.querySelector('.card__header');
      header.addEventListener('click', () => toggleCard(cat.id));
      card.querySelectorAll('input').forEach((input) => {
        input.addEventListener('change', () => choose(cat, input.value));
      });

      cardsEl.append(card);
      cards[cat.id] = {
        el: card, header, inputs: [...card.querySelectorAll('input')],
        choiceEl: card.querySelector('.card__choice'),
        body: card.querySelector('.card__body-inner'),
      };
    });
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
      c.choiceEl.textContent = chosen ? optById(cat, chosen).label : '';
    });

    const count = CATEGORIES.filter((c) => state.choice[c.id]).length;
    const all = count === CATEGORIES.length;
    commitBtn.disabled = !all || state.committed;
    commitBtn.classList.toggle('is-done', state.committed);
    commitBtn.textContent = state.committed ? 'Preferences confirmed' : 'Confirm my preferences';
    resetBtn.hidden = !state.committed;
    statusEl.textContent = state.committed
      ? 'Your care preferences are locked in.'
      : all ? 'All set. You can still change any choice before confirming.' : `${count} of ${CATEGORIES.length} preferences chosen`;

    sceneEl.classList.toggle('is-committed', state.committed);
    sceneEl.setAttribute('aria-label', 'Hospital room illustration. ' + CATEGORIES.map((cat) => {
      const opt = state.choice[cat.id] && optById(cat, state.choice[cat.id]);
      return `${cat.title}: ${opt ? opt.label : 'not chosen yet'}.`;
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
    announce(`${cat.title}: ${opt.label} selected.`);
    render();

    if (nextWasLocked && isUnlocked(i + 1)) {
      const el = cards[next.id].el;
      el.classList.remove('is-unlocking');
      void el.offsetWidth;
      el.classList.add('is-unlocking');
      el.addEventListener('animationend', () => el.classList.remove('is-unlocking'), { once: true });
    }
  }

  function onSceneTap(cat) {
    if (state.committed) return;
    const i = CATEGORIES.indexOf(cat);
    const slot = slots[cat.id];
    if (!isUnlocked(i)) {
      if (!reduceMotion.matches) rattle(slot, true);
      const pending = CATEGORIES.find((c, j) => isUnlocked(j) && !state.choice[c.id]);
      if (pending) nudge(pending.id);
      return;
    }
    if (!state.choice[cat.id] && !reduceMotion.matches) rattle(slot, true);
    state.open = cat.id;
    render();
    cards[cat.id].el.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  function nudge(id) {
    const el = cards[id].el;
    el.classList.remove('is-nudge');
    void el.offsetWidth;
    el.classList.add('is-nudge');
    el.addEventListener('animationend', () => el.classList.remove('is-nudge'), { once: true });
    if (state.open !== id) { state.open = id; render(); }
    el.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'nearest' });
  }

  commitBtn.addEventListener('click', () => {
    if (commitBtn.disabled) return;
    state.committed = true;
    state.open = null;
    render();
    celebrate();
    announce('Preferences confirmed.');
  });

  resetBtn.addEventListener('click', () => {
    state.committed = false;
    CATEGORIES.forEach((cat) => {
      state.choice[cat.id] = null;
      showInSlot(cat, null);
    });
    state.open = CATEGORIES[0].id;
    render();
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    announce('Preferences cleared.');
  });

  buildScene();
  buildCards();
  render();
})();
