'use strict';
// ---------------------------------------------------------------------------
// Character creation screen (HTML overlay with a live pixel-art preview).
// ---------------------------------------------------------------------------

const DEFAULT_HERO = {
  name: 'Aiden', skin: 1, hairStyle: 'spiky', hairColor: 1, eyes: 1, outfit: 0,
  cls: 'warrior', weapon: 'sword', skills: ['whirlwind', 'shieldBash'],
};

const Creator = {
  cfg: null,
  sprite: null,
  previewDir: 0,
  previewT: 0,
  built: false,
};

function loadSavedHero() {
  try {
    const raw = localStorage.getItem('emberfall.hero');
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (!CLASSES[cfg.cls] || !WEAPONS[cfg.weapon]) return null;
    if (!Array.isArray(cfg.skills) || cfg.skills.length !== 2 || !cfg.skills.every((s) => CLASSES[cfg.cls].skills.includes(s))) return null;
    return Object.assign({}, DEFAULT_HERO, cfg);
  } catch (e) {
    return null;
  }
}

function saveHero(cfg) {
  try { localStorage.setItem('emberfall.hero', JSON.stringify(cfg)); } catch (e) { /* storage unavailable */ }
}

const $ = (id) => document.getElementById(id);

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

function swatchRow(container, list, key, colorOf) {
  container.innerHTML = '';
  list.forEach((item, i) => {
    const b = el('button', 'swatch' + (Creator.cfg[key] === i ? ' selected' : ''));
    b.style.background = colorOf(item);
    b.title = item.name;
    b.type = 'button';
    b.onclick = () => { Creator.cfg[key] = i; refreshCreator(); };
    container.appendChild(b);
  });
}

function buildHairStyles() {
  const c = $('cr-hairstyle');
  c.innerHTML = '';
  for (const hs of HERO_HAIR_STYLES) {
    const b = el('button', 'chip' + (Creator.cfg.hairStyle === hs.id ? ' selected' : ''), hs.name);
    b.type = 'button';
    b.onclick = () => { Creator.cfg.hairStyle = hs.id; refreshCreator(); };
    c.appendChild(b);
  }
}

function buildClassCards() {
  const c = $('cr-class');
  c.innerHTML = '';
  for (const id of Object.keys(CLASSES)) {
    const cl = CLASSES[id];
    const card = el('button', 'card' + (Creator.cfg.cls === id ? ' selected' : ''));
    card.type = 'button';
    card.innerHTML = `<b>${cl.name}</b><span>${cl.desc}</span>`;
    card.onclick = () => {
      if (Creator.cfg.cls === id) return;
      Creator.cfg.cls = id;
      Creator.cfg.weapon = cl.weapon;
      Creator.cfg.skills = cl.skills.slice(0, 2);
      Creator.cfg.outfit = cl.outfit;
      refreshCreator();
    };
    c.appendChild(card);
  }
}

function buildWeaponCards() {
  const c = $('cr-weapon');
  c.innerHTML = '';
  const aff = CLASSES[Creator.cfg.cls].affinity;
  for (const id of Object.keys(WEAPONS)) {
    const w = WEAPONS[id];
    const card = el('button', 'card weapon' + (Creator.cfg.weapon === id ? ' selected' : ''));
    card.type = 'button';
    const icon = weaponIcon(id, 3);
    icon.className = 'wicon';
    card.appendChild(icon);
    const txt = el('div', 'wtext');
    txt.innerHTML = `<b>${w.name}${aff.includes(id) ? ' <em title="Class affinity: +20% damage">&#9733;</em>' : ''}</b>` +
      `<span>${w.type === 'melee' ? 'Melee' : 'Ranged'} &middot; DMG ${w.dmg} &middot; ${(1 / w.cd).toFixed(1)}/s</span>` +
      `<span>${w.desc}</span>`;
    card.appendChild(txt);
    card.onclick = () => { Creator.cfg.weapon = id; refreshCreator(); };
    c.appendChild(card);
  }
}

function buildSkillCards() {
  const c = $('cr-skills');
  c.innerHTML = '';
  for (const id of CLASSES[Creator.cfg.cls].skills) {
    const s = SKILLS[id];
    const idx = Creator.cfg.skills.indexOf(id);
    const card = el('button', 'card skill' + (idx >= 0 ? ' selected' : ''));
    card.type = 'button';
    const icon = skillIcon(id, 3);
    icon.className = 'wicon';
    card.appendChild(icon);
    const txt = el('div', 'wtext');
    txt.innerHTML = `<b>${s.name}${idx >= 0 ? ` <em>[${idx === 0 ? 'Q' : 'R'}]</em>` : ''}</b>` +
      `<span>${s.mp} MP &middot; ${s.cd}s cooldown</span><span>${s.desc}</span>`;
    card.appendChild(txt);
    card.onclick = () => {
      const sk = Creator.cfg.skills;
      const i = sk.indexOf(id);
      if (i >= 0) return; // already chosen: pick another to replace
      sk.shift();
      sk.push(id);
      refreshCreator();
    };
    c.appendChild(card);
  }
}

function buildStats() {
  const cfg = Creator.cfg;
  const cl = CLASSES[cfg.cls];
  const w = WEAPONS[cfg.weapon];
  const aff = cl.affinity.includes(cfg.weapon);
  const rows = [
    ['HP', cl.hp, 150, '#e04050'],
    ['MP', cl.mp, 130, '#4080ff'],
    ['ATK', Math.round(cl.atk * (aff ? 1.2 : 1) * 100), 150, '#ff9040'],
    ['DEF', cl.def, 4, '#c0c0d0'],
    ['SPD', cl.speed, 90, '#60e080'],
    ['CRIT', Math.round((cl.crit + (w.crit || 0)) * 100), 35, '#ffe040'],
  ];
  $('cr-stats').innerHTML = rows.map(([k, v, max, col]) =>
    `<div class="stat"><span>${k}</span><div class="sbar"><i style="width:${Math.min(100, (v / max) * 100)}%;background:${col}"></i></div><b>${k === 'CRIT' ? v + '%' : v}</b></div>`
  ).join('');
  $('cr-summary').innerHTML = `<b>${escapeHtml(cfg.name || 'Hero')}</b><br>${cl.name} &middot; ${w.name}` +
    (aff ? '<br><em>&#9733; Class affinity: +20% damage</em>' : '');
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function refreshCreator() {
  const cfg = Creator.cfg;
  swatchRow($('cr-skin'), SKIN_TONES, 'skin', (s) => s.base);
  swatchRow($('cr-haircolor'), HAIR_COLORS, 'hairColor', (s) => s.c);
  swatchRow($('cr-eyes'), EYE_COLORS, 'eyes', (s) => s.c);
  swatchRow($('cr-outfit'), OUTFIT_COLORS, 'outfit', (s) => s.c);
  buildHairStyles();
  buildClassCards();
  buildWeaponCards();
  buildSkillCards();
  buildStats();
  Creator.sprite = buildCharacter(heroLook(cfg));
}

function randomizeHero() {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const names = ['Aiden', 'Kael', 'Rowan', 'Darian', 'Finn', 'Leo', 'Arin', 'Theo', 'Cassian', 'Eamon', 'Jarek', 'Soren', 'Tobias', 'Ilyas', 'Kenji', 'Malik'];
  const cls = pick(Object.keys(CLASSES));
  const pool = CLASSES[cls].skills.slice().sort(() => Math.random() - 0.5);
  Creator.cfg = {
    name: pick(names),
    skin: Math.floor(Math.random() * SKIN_TONES.length),
    hairStyle: pick(HERO_HAIR_STYLES).id,
    hairColor: Math.floor(Math.random() * HAIR_COLORS.length),
    eyes: Math.floor(Math.random() * EYE_COLORS.length),
    outfit: Math.floor(Math.random() * OUTFIT_COLORS.length),
    cls,
    weapon: Math.random() < 0.7 ? pick(CLASSES[cls].affinity) : pick(Object.keys(WEAPONS)),
    skills: pool.slice(0, 2),
  };
  $('cr-name').value = Creator.cfg.name;
  refreshCreator();
}

function drawPreview(dt) {
  if (G.state !== 'create' || !Creator.sprite) return;
  Creator.previewT += dt;
  const c = $('preview');
  const pctx = c.getContext('2d');
  pctx.imageSmoothingEnabled = false;
  pctx.clearRect(0, 0, c.width, c.height);
  // pedestal
  pctx.fillStyle = '#2a1f3a';
  pctx.fillRect(40, 238, 180, 18);
  pctx.fillStyle = '#3a2d50';
  pctx.fillRect(52, 232, 156, 10);
  const dir = [0, 2, 1, 3][Math.floor(Creator.previewT / 1.6) % 4];
  const fi = [1, 0, 2, 0][Math.floor(Creator.previewT * 6) % 4];
  const s = 8;
  pctx.drawImage(Creator.sprite.frames[dir][fi], (c.width - CHAR_W * s) / 2, 244 - 30 * s, CHAR_W * s, CHAR_H * s);
}

function initCreator() {
  if (Creator.built) return;
  Creator.built = true;
  Creator.cfg = loadSavedHero() || JSON.parse(JSON.stringify(DEFAULT_HERO));
  const name = $('cr-name');
  name.value = Creator.cfg.name;
  name.addEventListener('input', () => {
    Creator.cfg.name = name.value.replace(/[^\p{L}\p{N} '\-]/gu, '').slice(0, 12);
    buildStats();
  });
  $('cr-random').onclick = randomizeHero;
  $('cr-start').onclick = () => {
    const cfg = Creator.cfg;
    cfg.name = (cfg.name || '').trim() || 'Aiden';
    saveHero(cfg);
    $('creator').classList.add('hidden');
    startGame(JSON.parse(JSON.stringify(cfg)));
  };
  refreshCreator();
  let last = performance.now();
  const loop = (now) => {
    drawPreview(Math.min(0.05, (now - last) / 1000));
    last = now;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function openCreator() {
  initCreator();
  G.state = 'create';
  $('creator').classList.remove('hidden');
  $('cr-name').focus();
}
