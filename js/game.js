'use strict';
// ---------------------------------------------------------------------------
// Emberfall - main game: state, input, entities, combat, rendering and HUD.
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const FONT = '"Press Start 2P", monospace';
const VW = VIEW_W / SCALE; // view size in world pixels
const VH = VIEW_H / SCALE;

const G = {
  state: 'title',
  time: 0,
  world: null,
  player: null,
  companions: [],
  npcs: [],
  enemies: [],
  spawns: [],
  projectiles: [],
  effects: [],
  particles: [],
  texts: [],
  pickups: [],
  trail: [],
  cam: { x: 0, y: 0 },
  shake: 0,
  dialog: null,
  questStage: 0,
  bossDefeated: false,
  boss: null,
  partyBuff: 0,
  kills: 0,
  playTime: 0,
  victoryTimer: 0,
};

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------
const keys = {};
const pressed = {};
const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space']);

window.addEventListener('keydown', (e) => {
  if (G.state === 'create') return;
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (GAME_KEYS.has(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
canvas.addEventListener('mousedown', () => { pressed.Click = true; });

const held = (...codes) => codes.some((c) => keys[c]);
const hit = (...codes) => codes.some((c) => pressed[c]);
const CONFIRM = ['KeyE', 'Space', 'Enter', 'NumpadEnter', 'Click'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const cy = (e) => e.y - e.hh;
const centerDist = (a, b) => Math.hypot(a.x - b.x, cy(a) - cy(b));
function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}
function dirFromVec(x, y) {
  if (Math.abs(x) > Math.abs(y)) return x < 0 ? 2 : 3;
  return y < 0 ? 1 : 0;
}

function moveEntity(e, dx, dy) {
  const hw = e.bw || 4;
  let bx = false, by = false;
  if (e.fly) {
    e.x = clamp(e.x + dx, 24, G.world.w * TILE - 24);
    e.y = clamp(e.y + dy, 24, G.world.h * TILE - 24);
    return { bx, by };
  }
  if (dx) {
    const nx = e.x + dx;
    if (!G.world.boxBlocked(nx - hw, e.y - 4, nx + hw, e.y - 1)) e.x = nx; else bx = true;
  }
  if (dy) {
    const ny = e.y + dy;
    if (!G.world.boxBlocked(e.x - hw, ny - 4, e.x + hw, ny - 1)) e.y = ny; else by = true;
  }
  return { bx, by };
}

function addText(x, y, text, color = '#fff', size = 8, life = 0.9) {
  G.texts.push({ x, y, text, color, size, t: 0, life });
}

function burst(x, y, color, n = 8, speed = 60, life = 0.5, size = 1) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * rand(0.3, 1);
    G.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: life * rand(0.6, 1), max: life, color, size, grav: 120 });
  }
}

function sparkle(x, y, color, n = 6) {
  for (let i = 0; i < n; i++) {
    G.particles.push({ x: x + rand(-6, 6), y: y + rand(-4, 4), vx: rand(-8, 8), vy: rand(-40, -15), life: rand(0.5, 0.9), max: 0.9, color, size: 1, grav: 0 });
  }
}

// ---------------------------------------------------------------------------
// Creation of the world and all characters
// ---------------------------------------------------------------------------
const SPAWN_GROUPS = [
  { type: 'slime', x: 18, y: 12, n: 6, rad: 9 },
  { type: 'slime', x: 24, y: 57, n: 3, rad: 5 },
  { type: 'slime', x: 48, y: 29, n: 5, rad: 5 },
  { type: 'blueSlime', x: 48, y: 45, n: 4, rad: 5 },
  { type: 'goblin', x: 54, y: 21, n: 5, rad: 7 },
  { type: 'goblin', x: 71, y: 34, n: 5, rad: 7 },
  { type: 'blueSlime', x: 68, y: 26, n: 3, rad: 4 },
  { type: 'bat', x: 52, y: 54, n: 4, rad: 7 },
  { type: 'bat', x: 82, y: 33, n: 3, rad: 5 },
  { type: 'skeleton', x: 77, y: 54, n: 5, rad: 6 },
  { type: 'skelArcher', x: 79, y: 57, n: 3, rad: 5 },
  { type: 'skeleton', x: 83, y: 16, n: 4, rad: 7 },
  { type: 'skelArcher', x: 88, y: 9, n: 2, rad: 3 },
];

function heroLook(cfg) {
  const skin = SKIN_TONES[cfg.skin];
  const outfit = OUTFIT_COLORS[cfg.outfit].c;
  return {
    skin: skin.base, skinShade: skin.shade,
    hair: HAIR_COLORS[cfg.hairColor].c, hairStyle: cfg.hairStyle,
    eyes: EYE_COLORS[cfg.eyes].c,
    outfit, outfit2: cfg.cls === 'mage' ? shade(outfit, -0.45) : '#4a3a30',
    gear: CLASSES[cfg.cls].gear,
    weapon: cfg.weapon,
  };
}

function makePlayer(cfg, pos) {
  const look = heroLook(cfg);
  const sprite = buildCharacter(look);
  const p = {
    kind: 'player', name: cfg.name, cfg, look, sprite, portrait: buildPortrait(sprite),
    cls: cfg.cls, weapon: cfg.weapon, skills: cfg.skills.slice(),
    x: pos.x, y: pos.y, dir: 0, anim: 0, moving: false, aimX: 0, aimY: 1,
    level: 1, xp: 0, xpNext: 40,
    atkCd: 0, skillCd: [0, 0], invuln: 0, lastHurt: -99, flash: 0, attackT: 0,
    buffs: { dmg: 0, invis: 0, poison: 0, critNext: false },
    gold: 20, potions: 2, r: 5, hh: 10, dash: null,
  };
  recalcPlayer(p);
  p.hp = p.maxHp;
  p.mp = p.maxMp;
  return p;
}

function recalcPlayer(p) {
  const c = CLASSES[p.cls];
  const lvl = p.level - 1;
  p.maxHp = c.hp + c.hpG * lvl;
  p.maxMp = c.mp + c.mpG * lvl;
  p.atk = c.atk + c.atkG * lvl;
  p.def = c.def + Math.floor(lvl / 2);
  p.speed = c.speed;
  p.crit = c.crit + (WEAPONS[p.weapon].crit || 0);
  p.affinity = c.affinity.includes(p.weapon) ? 1.2 : 1.0;
  p.mpRegen = c.mpRegen;
}

function makeCompanion(def) {
  const pos = G.world.findWalkable(def.home[0], def.home[1]);
  const sprite = buildCharacter(def.look);
  return {
    kind: 'companion', def, name: def.name, sprite, portrait: buildPortrait(sprite),
    x: pos.x, y: pos.y, homeX: pos.x, homeY: pos.y, dir: 0, anim: 0, moving: false,
    hp: def.hp, maxHp: def.hp, dmgMult: 1, recruited: false, downed: 0,
    atkCd: 0, healCd: 0, specialCd: 5, stuck: 0, r: 5, hh: 10, flash: 0, slot: -1, attackT: 0,
  };
}

function makeNpc(def) {
  const pos = G.world.findWalkable(def.home[0], def.home[1]);
  const sprite = buildCharacter(def.look);
  return { kind: 'npc', id: def.id, name: def.name, sprite, portrait: buildPortrait(sprite), x: pos.x, y: pos.y, dir: 0, anim: 0, r: 5, hh: 10 };
}

function makeEnemy(type, x, y, spawn = null) {
  const d = ENEMY_TYPES[type];
  const e = {
    kind: 'enemy', type, d, name: d.name, x, y, homeX: x, homeY: y,
    hp: d.hp, maxHp: d.hp, dmg: d.dmg, speed: d.speed, r: d.r, hh: d.hh, fly: !!d.fly,
    sprite: getMonsterSprite(d.sprite, d.color), dir: 0, anim: Math.random() * 4, moving: false,
    atkCd: rand(0, 1), stun: 0, slow: 0, poison: 0, poisonDps: 0, poisonTick: 0,
    kx: 0, ky: 0, flash: 0, aggro: 0, wanderT: rand(0, 2), wx: x, wy: y, spawn, attackT: 0,
    boss: !!d.boss, slamT: 4, summonT: 9, slamming: 0, bw: d.boss ? 7 : 4, scale: d.boss ? 2 : 1,
  };
  return e;
}

function newGame(cfg) {
  G.world = G.world || new World(1337);
  const start = G.world.findWalkable(21, 38);
  G.startPos = start;
  G.player = makePlayer(cfg, start);
  G.companions = COMPANIONS.map(makeCompanion);
  G.npcs = NPCS.map(makeNpc);
  G.enemies = [];
  G.projectiles = [];
  G.effects = [];
  G.particles = [];
  G.texts = [];
  G.pickups = [];
  G.trail = [];
  G.questStage = 0;
  G.bossDefeated = false;
  G.kills = 0;
  G.playTime = 0;
  G.partyBuff = 0;

  // Build spawn points
  G.spawns = [];
  for (const grp of SPAWN_GROUPS) {
    for (let i = 0; i < grp.n; i++) {
      const tx = grp.x + randInt(-grp.rad, grp.rad), ty = grp.y + randInt(-grp.rad, grp.rad);
      const pos = G.world.findWalkable(tx, ty);
      G.spawns.push({ type: grp.type, x: pos.x, y: pos.y, enemy: null, respawnAt: 0 });
    }
  }
  for (const s of G.spawns) { s.enemy = makeEnemy(s.type, s.x, s.y, s); G.enemies.push(s.enemy); }
  const bp = G.world.findWalkable(88, 14);
  G.boss = makeEnemy('ogreKing', bp.x, bp.y);
  G.enemies.push(G.boss);

  G.state = 'play';
  updateCamera(true);
  addText(G.player.x, G.player.y - 30, 'Welcome, ' + G.player.name + '!', '#ffe070', 8, 2.5);
}

function party() {
  return G.companions.filter((c) => c.recruited);
}

// ---------------------------------------------------------------------------
// Damage & combat
// ---------------------------------------------------------------------------
function playerDamage(base, forceCrit = false) {
  const p = G.player;
  let d = base * p.atk * p.affinity * (p.buffs.dmg > 0 ? 1.5 : 1);
  let crit = forceCrit || Math.random() < p.crit;
  if (p.buffs.critNext) { crit = true; p.buffs.critNext = false; }
  if (crit) d *= 2;
  d *= rand(0.9, 1.1);
  return { dmg: Math.max(1, Math.round(d)), crit };
}

function damageEnemy(e, amount, opts = {}) {
  if (e.dead) return;
  e.hp -= amount;
  e.flash = 0.12;
  e.aggro = 6;
  const kb = (opts.knock || 0) * (e.boss ? 0.15 : 1);
  if (kb && opts.ax !== undefined) { e.kx += opts.ax * kb; e.ky += opts.ay * kb; }
  if (opts.stun) e.stun = Math.max(e.stun, e.boss ? opts.stun * 0.3 : opts.stun);
  if (opts.slow) e.slow = Math.max(e.slow, opts.slow);
  if (opts.fromPlayer && G.player.buffs.poison > 0) { e.poison = 4; e.poisonDps = 3 + G.player.level; }
  if (opts.crit) addText(e.x, cy(e) - e.hh - 2, amount + '!', '#ffe040', 16, 0.8);
  else addText(e.x + rand(-3, 3), cy(e) - e.hh, String(amount), opts.color || '#ffffff', 8, 0.7);
  if (e.hp <= 0) killEnemy(e);
}

function killEnemy(e) {
  e.dead = true;
  G.kills++;
  const colors = { slime: SLIME_COLORS[e.d.color || 0].base, bat: '#6a4a8a', goblin: '#6aa84f', skeleton: '#e8e4d4', skelArcher: '#e8e4d4', ogre: '#8aa060' };
  burst(e.x, cy(e), colors[e.d.sprite] || '#fff', e.boss ? 40 : 12, e.boss ? 120 : 70, 0.7, e.boss ? 2 : 1);
  gainXp(e.d.xp);
  // drops
  const gold = randInt(e.d.gold[0], e.d.gold[1]);
  const coins = Math.min(gold, e.boss ? 10 : 3);
  for (let i = 0; i < coins; i++) dropPickup(e.x, e.y, 'gold', Math.ceil(gold / coins));
  if (Math.random() < 0.18) dropPickup(e.x, e.y, 'heart', 25);
  if (Math.random() < 0.12) dropPickup(e.x, e.y, 'mana', 25);
  if (Math.random() < (e.boss ? 1 : 0.04)) dropPickup(e.x, e.y, 'potion', 1);
  if (e.spawn) { e.spawn.enemy = null; e.spawn.respawnAt = G.time + rand(40, 60); }
  if (e.boss) {
    G.bossDefeated = true;
    G.questStage = 2;
    G.shake = 0.8;
    G.victoryTimer = 2.5;
  }
}

function dropPickup(x, y, type, amount) {
  const a = Math.random() * Math.PI * 2, s = rand(20, 60);
  G.pickups.push({ x, y: y - 2, vx: Math.cos(a) * s, vy: Math.sin(a) * s, type, amount, t: 0, z: 0, vz: 60 });
}

function gainXp(n) {
  const p = G.player;
  p.xp += n;
  while (p.xp >= p.xpNext) {
    p.xp -= p.xpNext;
    p.level++;
    p.xpNext = Math.floor(p.xpNext * 1.35 + 15);
    recalcPlayer(p);
    p.hp = p.maxHp;
    p.mp = p.maxMp;
    for (const c of G.companions) {
      const scale = 1 + 0.12 * (p.level - 1);
      c.maxHp = Math.round(c.def.hp * scale);
      c.dmgMult = scale;
      if (!c.downed) c.hp = c.maxHp;
    }
    addText(p.x, p.y - 34, 'LEVEL UP!', '#ffe040', 16, 1.8);
    addText(p.x, p.y - 22, 'Lv.' + p.level, '#ffffff', 8, 1.8);
    G.effects.push({ type: 'ring', x: p.x, y: p.y - 6, r0: 4, r1: 40, color: '#ffe040', t: 0, life: 0.6 });
    sparkle(p.x, p.y - 10, '#ffe040', 20);
  }
}

// Something hurts a member of the party.
function hurtAlly(a, dmg, srcX, srcY) {
  if (a.kind === 'player') {
    const p = a;
    if (p.invuln > 0 || p.hp <= 0) return;
    const final = Math.max(1, Math.round(dmg - p.def));
    p.hp -= final;
    p.flash = 0.15;
    p.invuln = 0.45;
    p.lastHurt = G.time;
    G.shake = Math.max(G.shake, 0.15);
    addText(p.x, p.y - 26, '-' + final, '#ff5050', 8, 0.8);
    if (srcX !== undefined) {
      const d = Math.hypot(p.x - srcX, p.y - srcY) || 1;
      moveEntity(p, (p.x - srcX) / d * 6, (p.y - srcY) / d * 6);
    }
    if (p.hp <= 0) {
      p.hp = 0;
      G.state = 'gameover';
      G.stateT = 0;
      burst(p.x, p.y - 10, '#ff5050', 20, 80, 0.8);
    }
  } else if (a.kind === 'companion') {
    if (a.downed > 0) return;
    const final = Math.max(1, Math.round(dmg * (a.def.role === 'tank' ? 0.65 : 1)));
    a.hp -= final;
    a.flash = 0.15;
    addText(a.x, a.y - 26, '-' + final, '#ff9090', 8, 0.7);
    if (a.hp <= 0) {
      a.hp = 0;
      a.downed = 12;
      addText(a.x, a.y - 34, a.name + ' is down!', '#ff8080', 8, 1.5);
      burst(a.x, a.y - 8, '#ffffff', 10, 50, 0.6);
    }
  }
}

function allyTargets() {
  const list = [];
  const p = G.player;
  if (p.hp > 0 && p.buffs.invis <= 0) list.push(p);
  for (const c of G.companions) if (c.recruited && c.downed <= 0) list.push(c);
  return list;
}

function liveEnemies() { return G.enemies.filter((e) => !e.dead); }

function nearestEnemy(x, y, maxD, filter) {
  let best = null, bd = maxD;
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (filter && !filter(e)) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// Returns an aim vector pointing at a nearby enemy in roughly the facing
// direction, or the plain facing direction.
function autoAim(range) {
  const p = G.player;
  let best = null, bd = range;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = cy(e) - cy(p);
    const d = Math.hypot(dx, dy);
    if (d > range || d < 0.01) continue;
    const dot = (dx * p.aimX + dy * p.aimY) / d;
    if (dot < 0.35 && d > 18) continue;
    const score = d * (1.6 - dot);
    if (score < bd) { bd = score; best = { x: dx / d, y: dy / d }; }
  }
  return best || { x: p.aimX, y: p.aimY };
}

function meleeHit(ox, oy, ang, range, arc, fn) {
  let hits = 0;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = e.x - ox, dy = cy(e) - oy;
    const d = Math.hypot(dx, dy);
    if (d > range + e.r) continue;
    if (d > 8 && angleDiff(Math.atan2(dy, dx), ang) > arc / 2 + 0.25) continue;
    fn(e, dx / (d || 1), dy / (d || 1));
    hits++;
  }
  return hits;
}

function aoe(x, y, radius, fn) {
  let n = 0;
  for (const e of G.enemies) {
    if (e.dead) continue;
    const dx = e.x - x, dy = cy(e) - y;
    const d = Math.hypot(dx, dy);
    if (d <= radius + e.r) { fn(e, dx / (d || 1), dy / (d || 1)); n++; }
  }
  return n;
}

function spawnProjectile(o) {
  G.projectiles.push(Object.assign({ r: 3, pierce: false, hit: new Set(), explode: 0, t: 0 }, o));
}

// ---------------------------------------------------------------------------
// Player actions
// ---------------------------------------------------------------------------
function playerAttack() {
  const p = G.player;
  const w = WEAPONS[p.weapon];
  p.atkCd = w.cd;
  p.attackT = 0.15;
  if (p.buffs.invis > 0) p.buffs.invis = 0.01;
  const ox = p.x, oy = cy(p);
  if (w.type === 'melee') {
    const a = autoAim(w.range + 18);
    p.dir = dirFromVec(a.x, a.y);
    const ang = Math.atan2(a.y, a.x);
    G.effects.push({ type: 'slash', x: ox, y: oy, ang, arc: w.arc, range: w.range, t: 0, life: 0.14, color: '#ffffff' });
    meleeHit(ox, oy, ang, w.range, w.arc, (e, nx, ny) => {
      const { dmg, crit } = playerDamage(w.dmg);
      damageEnemy(e, dmg, { crit, knock: w.knock, ax: nx, ay: ny, fromPlayer: true });
    });
  } else {
    const a = autoAim(w.range);
    p.dir = dirFromVec(a.x, a.y);
    const { dmg, crit } = playerDamage(w.dmg);
    spawnProjectile({ x: ox + a.x * 6, y: oy + a.y * 6, vx: a.x * w.speed, vy: a.y * w.speed, kind: w.proj, dmg, crit, owner: 'ally', life: w.range / w.speed, fromPlayer: true, knock: 40 });
  }
}

function skillBase() { return Math.max(WEAPONS[G.player.weapon].dmg, 9); }

const SKILL_FN = {
  whirlwind(p) {
    const base = skillBase() * 1.8;
    G.effects.push({ type: 'spin', x: p.x, y: cy(p), r: 42, t: 0, life: 0.35 });
    aoe(p.x, cy(p), 42, (e, nx, ny) => { const { dmg, crit } = playerDamage(base); damageEnemy(e, dmg, { crit, knock: 160, ax: nx, ay: ny, fromPlayer: true }); });
    return true;
  },
  shieldBash(p) {
    const a = autoAim(60);
    const ang = Math.atan2(a.y, a.x);
    p.dir = dirFromVec(a.x, a.y);
    moveEntity(p, a.x * 10, a.y * 10);
    G.effects.push({ type: 'slash', x: p.x, y: cy(p), ang, arc: 1.6, range: 40, t: 0, life: 0.2, color: '#ffe0a0' });
    meleeHit(p.x, cy(p), ang, 40, 1.6, (e, nx, ny) => {
      const { dmg, crit } = playerDamage(skillBase() * 1.2);
      damageEnemy(e, dmg, { crit, knock: 220, ax: nx, ay: ny, stun: 1.6, fromPlayer: true });
      addText(e.x, cy(e) - 16, 'STUN', '#ffe0a0', 8, 0.8);
    });
    return true;
  },
  battleCry(p) {
    p.buffs.dmg = 8;
    G.partyBuff = 8;
    G.effects.push({ type: 'ring', x: p.x, y: cy(p), r0: 6, r1: 70, color: '#ff6040', t: 0, life: 0.5 });
    addText(p.x, p.y - 34, 'BATTLE CRY!', '#ff6040', 8, 1.2);
    return true;
  },
  secondWind(p) {
    const amt = Math.round(p.maxHp * 0.4);
    p.hp = Math.min(p.maxHp, p.hp + amt);
    addText(p.x, p.y - 28, '+' + amt, '#60ff80', 8, 1);
    sparkle(p.x, p.y - 8, '#60ff80', 14);
    return true;
  },
  fireball(p) {
    const a = autoAim(200);
    p.dir = dirFromVec(a.x, a.y);
    const { dmg, crit } = playerDamage(22);
    spawnProjectile({ x: p.x + a.x * 6, y: cy(p) + a.y * 6, vx: a.x * 190, vy: a.y * 190, kind: 'fireball', dmg, crit, owner: 'ally', life: 1.2, explode: 36, r: 5, fromPlayer: true, knock: 120 });
    return true;
  },
  frostNova(p) {
    G.effects.push({ type: 'ring', x: p.x, y: cy(p), r0: 6, r1: 62, color: '#a0e0ff', t: 0, life: 0.45, width: 3 });
    burst(p.x, cy(p), '#c0f0ff', 24, 110, 0.6);
    aoe(p.x, cy(p), 62, (e, nx, ny) => { const { dmg, crit } = playerDamage(12); damageEnemy(e, dmg, { crit, slow: 3.5, knock: 60, ax: nx, ay: ny, color: '#a0e0ff', fromPlayer: true }); });
    return true;
  },
  chainLightning(p) {
    const a = autoAim(160);
    let first = null, bd = 160;
    for (const e of G.enemies) {
      if (e.dead) continue;
      const dx = e.x - p.x, dy = cy(e) - cy(p), d = Math.hypot(dx, dy);
      const score = d * (1.5 - (dx * a.x + dy * a.y) / (d || 1));
      if (d < 160 && score < bd) { bd = score; first = e; }
    }
    if (!first) return false;
    const hitSet = new Set();
    let cur = first, from = { x: p.x, y: cy(p) }, mult = 1;
    for (let i = 0; i < 5 && cur; i++) {
      hitSet.add(cur);
      G.effects.push({ type: 'bolt', x1: from.x, y1: from.y, x2: cur.x, y2: cy(cur), t: 0, life: 0.25 });
      const { dmg, crit } = playerDamage(19 * mult);
      from = { x: cur.x, y: cy(cur) };
      const target = cur;
      cur = nearestEnemy(target.x, target.y, 90, (e) => !hitSet.has(e));
      damageEnemy(target, dmg, { crit, stun: 0.3, color: '#ffff70', fromPlayer: true });
      mult *= 0.85;
    }
    return true;
  },
  blink(p) {
    for (let d = 64; d >= 8; d -= 4) {
      const nx = p.x + p.aimX * d, ny = p.y + p.aimY * d;
      if (!G.world.boxBlocked(nx - 4, ny - 4, nx + 4, ny - 1)) {
        burst(p.x, cy(p), '#c080ff', 12, 50, 0.4);
        p.x = nx; p.y = ny; p.invuln = Math.max(p.invuln, 0.25);
        burst(p.x, cy(p), '#c080ff', 12, 50, 0.4);
        return true;
      }
    }
    return false;
  },
  multishot(p) {
    const a = autoAim(220);
    p.dir = dirFromVec(a.x, a.y);
    const base = Math.atan2(a.y, a.x);
    for (let i = -2; i <= 2; i++) {
      const ang = base + i * 0.18;
      const { dmg, crit } = playerDamage(Math.max(WEAPONS[p.weapon].dmg, 8));
      spawnProjectile({ x: p.x, y: cy(p), vx: Math.cos(ang) * 260, vy: Math.sin(ang) * 260, kind: 'arrow', dmg, crit, owner: 'ally', life: 0.8, fromPlayer: true, knock: 40 });
    }
    return true;
  },
  piercingShot(p) {
    const a = autoAim(260);
    p.dir = dirFromVec(a.x, a.y);
    const { dmg, crit } = playerDamage(skillBase() * 3);
    spawnProjectile({ x: p.x, y: cy(p), vx: a.x * 380, vy: a.y * 380, kind: 'bigArrow', dmg, crit, owner: 'ally', life: 0.8, pierce: true, fromPlayer: true, knock: 100, r: 4 });
    return true;
  },
  healingHerb(p) {
    const heal = (a, pct) => {
      const amt = Math.round(a.maxHp * pct);
      a.hp = Math.min(a.maxHp, a.hp + amt);
      addText(a.x, a.y - 28, '+' + amt, '#60ff80', 8, 1);
      sparkle(a.x, a.y - 8, '#60ff80', 10);
    };
    heal(p, 0.3);
    for (const c of party()) if (c.downed <= 0) heal(c, 0.35);
    return true;
  },
  roll(p) {
    p.dash = { vx: p.aimX * 240, vy: p.aimY * 240, t: 0.22 };
    p.invuln = Math.max(p.invuln, 0.3);
    return true;
  },
  fanOfKnives(p) {
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * Math.PI * 2;
      const { dmg, crit } = playerDamage(skillBase() * 1.1);
      spawnProjectile({ x: p.x, y: cy(p), vx: Math.cos(ang) * 220, vy: Math.sin(ang) * 220, kind: 'knife', dmg, crit, owner: 'ally', life: 0.55, fromPlayer: true, knock: 60 });
    }
    return true;
  },
  shadowStep(p) {
    const e = nearestEnemy(p.x, p.y, 150);
    if (!e) return false;
    const dx = e.x - p.x, dy = e.y - p.y, d = Math.hypot(dx, dy) || 1;
    burst(p.x, cy(p), '#6040a0', 12, 50, 0.4);
    let placed = false;
    for (const off of [14, 8, 0, -12]) {
      const nx = e.x + dx / d * off, ny = e.y + dy / d * off;
      if (!G.world.boxBlocked(nx - 4, ny - 4, nx + 4, ny - 1)) { p.x = nx; p.y = ny; placed = true; break; }
    }
    if (!placed) return false;
    p.aimX = -dx / d; p.aimY = -dy / d;
    p.dir = dirFromVec(p.aimX, p.aimY);
    burst(p.x, cy(p), '#6040a0', 12, 50, 0.4);
    const { dmg } = playerDamage(skillBase() * 2.5, true);
    damageEnemy(e, dmg, { crit: true, stun: 0.6, fromPlayer: true });
    G.effects.push({ type: 'slash', x: p.x, y: cy(p), ang: Math.atan2(-dy, -dx), arc: 1.4, range: 22, t: 0, life: 0.15, color: '#c0a0ff' });
    return true;
  },
  smokeBomb(p) {
    p.buffs.invis = 4;
    p.buffs.critNext = true;
    for (let i = 0; i < 24; i++) G.particles.push({ x: p.x + rand(-10, 10), y: p.y - rand(0, 16), vx: rand(-15, 15), vy: rand(-20, 0), life: rand(0.6, 1.2), max: 1.2, color: i % 2 ? '#8a8a9a' : '#b0b0c0', size: 2, grav: 0 });
    for (const e of G.enemies) e.aggro = 0;
    return true;
  },
  poisonBlade(p) {
    p.buffs.poison = 10;
    sparkle(p.x, p.y - 8, '#80e040', 12);
    addText(p.x, p.y - 30, 'POISON BLADE', '#80e040', 8, 1);
    return true;
  },
};

function useSkill(i) {
  const p = G.player;
  const id = p.skills[i];
  if (!id) return;
  const s = SKILLS[id];
  if (p.skillCd[i] > 0) return;
  if (p.mp < s.mp) { addText(p.x, p.y - 30, 'Not enough mana', '#80b0ff', 8, 0.8); p.skillCd[i] = 0.3; return; }
  if (SKILL_FN[id](p)) {
    p.mp -= s.mp;
    p.skillCd[i] = s.cd;
    p.attackT = 0.15;
  } else {
    addText(p.x, p.y - 30, 'No target', '#cccccc', 8, 0.8);
    p.skillCd[i] = 0.3;
  }
}

function drinkPotion() {
  const p = G.player;
  if (p.potions <= 0) { addText(p.x, p.y - 30, 'No potions', '#cccccc', 8, 0.8); return; }
  if (p.hp >= p.maxHp && p.mp >= p.maxMp) return;
  p.potions--;
  const hp = Math.round(p.maxHp * 0.5), mp = Math.round(p.maxMp * 0.5);
  p.hp = Math.min(p.maxHp, p.hp + hp);
  p.mp = Math.min(p.maxMp, p.mp + mp);
  addText(p.x, p.y - 28, '+' + hp, '#60ff80', 8, 1);
  sparkle(p.x, p.y - 8, '#ff70a0', 12);
}

// ---------------------------------------------------------------------------
// Dialogs & talking
// ---------------------------------------------------------------------------
function openDialog(speaker, lines, opts = {}) {
  G.dialog = { speaker, lines, idx: 0, shown: 0, choices: opts.choices || null, sel: 0, onEnd: opts.onEnd || null };
  G.state = 'dialog';
}

function talkTo(t) {
  const p = G.player;
  if (t.kind === 'companion') {
    t.dir = dirFromVec(p.x - t.x, p.y - t.y);
    openDialog(t, t.def.intro, {
      onEnd: () => {
        t.recruited = true;
        t.slot = party().length - 1;
        const scale = 1 + 0.12 * (p.level - 1);
        t.maxHp = Math.round(t.def.hp * scale);
        t.hp = t.maxHp;
        t.dmgMult = scale;
        addText(t.x, t.y - 34, t.name + ' joined!', '#ff90d0', 8, 2);
        sparkle(t.x, t.y - 10, '#ff90d0', 16);
        if (G.questStage === 0) G.questStage = 1;
      },
    });
    return;
  }
  if (t.id === 'elder') {
    if (G.bossDefeated) {
      openDialog(t, [
        `${p.name}! You did it! The Ogre King is no more.`,
        'Emberbrook will sing of you and your companions for generations.',
        'Rest here as long as you like. The road is yours to wander.',
      ]);
    } else if (G.questStage === 0) {
      openDialog(t, [
        `Ah, young ${p.name}. The ${CLASSES[p.cls].name.toLowerCase()} from the south road. Welcome to Emberbrook.`,
        'Dark times, lad. The Ogre King has taken the Old Ruins to the north-east.',
        'His beasts spill out of the Darkwood across the river every night.',
        'Four brave women of our village may fight beside you: Aria, Luna, Brynn and Selene.',
        'Speak with them. Then cross the bridge east, and end the Ogre King\'s reign!',
      ], { onEnd: () => { G.questStage = 1; } });
    } else {
      const n = party().length;
      openDialog(t, [
        n < 4 ? `You have ${n} of 4 companions. The others still wait around the village.` : 'A full party! The four of them will serve you well.',
        'Follow the road east over the bridge, then north. The ruins lie beyond.',
        'Tobin sells potions near the west houses. Press F to drink one in battle.',
      ]);
    }
    return;
  }
  if (t.id === 'merchant') {
    openDialog(t, ['Potions! Fresh potions! Each one restores half your health and mana.'], {
      choices: [
        { label: 'Buy 1 potion (15g)', fn: () => buyPotions(1, 15) },
        { label: 'Buy 3 potions (40g)', fn: () => buyPotions(3, 40) },
        { label: 'Leave', fn: () => {} },
      ],
    });
  }
}

function buyPotions(n, cost) {
  const p = G.player;
  if (p.gold < cost) { addText(p.x, p.y - 30, 'Not enough gold', '#ffb060', 8, 1.2); return; }
  p.gold -= cost;
  p.potions += n;
  addText(p.x, p.y - 30, '+' + n + ' potion' + (n > 1 ? 's' : ''), '#ff70a0', 8, 1.2);
}

function interactTarget() {
  const p = G.player;
  let best = null, bd = 26;
  const list = G.npcs.concat(G.companions.filter((c) => !c.recruited));
  for (const t of list) {
    const d = dist(p, t);
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

function updateDialog(dt) {
  const d = G.dialog;
  const line = d.lines[d.idx];
  d.shown = Math.min(line.length, d.shown + dt * 55);
  const lastLine = d.idx === d.lines.length - 1;
  const typing = d.shown < line.length;
  if (lastLine && d.choices && !typing) {
    if (hit('ArrowUp', 'KeyW')) d.sel = (d.sel + d.choices.length - 1) % d.choices.length;
    if (hit('ArrowDown', 'KeyS')) d.sel = (d.sel + 1) % d.choices.length;
    if (hit(...CONFIRM)) {
      const c = d.choices[d.sel];
      G.dialog = null;
      G.state = 'play';
      c.fn();
    }
    if (hit('Escape')) { G.dialog = null; G.state = 'play'; }
    return;
  }
  if (hit(...CONFIRM)) {
    if (typing) { d.shown = line.length; return; }
    if (!lastLine) { d.idx++; d.shown = 0; return; }
    G.dialog = null;
    G.state = 'play';
    if (d.onEnd) d.onEnd();
  }
}

// ---------------------------------------------------------------------------
// Update: player
// ---------------------------------------------------------------------------
function updatePlayer(dt) {
  const p = G.player;
  let ix = 0, iy = 0;
  if (held('KeyA', 'ArrowLeft')) ix -= 1;
  if (held('KeyD', 'ArrowRight')) ix += 1;
  if (held('KeyW', 'ArrowUp')) iy -= 1;
  if (held('KeyS', 'ArrowDown')) iy += 1;
  const len = Math.hypot(ix, iy);
  p.moving = false;
  if (p.dash) {
    moveEntity(p, p.dash.vx * dt, p.dash.vy * dt);
    p.dash.t -= dt;
    if (Math.random() < 0.6) G.particles.push({ x: p.x + rand(-3, 3), y: p.y - 1, vx: 0, vy: -10, life: 0.3, max: 0.3, color: '#d8c8a0', size: 1, grav: 0 });
    if (p.dash.t <= 0) p.dash = null;
    p.moving = true;
  } else if (len > 0) {
    ix /= len; iy /= len;
    p.aimX = ix; p.aimY = iy;
    p.dir = dirFromVec(ix, iy);
    moveEntity(p, ix * p.speed * dt, iy * p.speed * dt);
    p.moving = true;
  }
  if (p.moving) p.anim += dt * 8;
  else p.anim = 0;

  // timers
  p.atkCd -= dt;
  p.skillCd[0] = Math.max(0, p.skillCd[0] - dt);
  p.skillCd[1] = Math.max(0, p.skillCd[1] - dt);
  p.invuln -= dt;
  p.flash -= dt;
  p.attackT -= dt;
  for (const k of ['dmg', 'invis', 'poison']) p.buffs[k] = Math.max(0, p.buffs[k] - dt);
  p.mp = Math.min(p.maxMp, p.mp + p.mpRegen * dt);
  if (G.time - p.lastHurt > 5) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.015 * dt);

  // trail for companions to follow
  const last = G.trail[0];
  if (!last || Math.hypot(last.x - p.x, last.y - p.y) > 3) {
    G.trail.unshift({ x: p.x, y: p.y });
    if (G.trail.length > 90) G.trail.pop();
  }

  if (held('Space', 'KeyJ') && p.atkCd <= 0) playerAttack();
  if (hit('KeyQ', 'KeyK', 'Digit1')) useSkill(0);
  if (hit('KeyR', 'KeyL', 'Digit2')) useSkill(1);
  if (hit('KeyF', 'KeyH', 'Digit3')) drinkPotion();
}

// ---------------------------------------------------------------------------
// Update: companions
// ---------------------------------------------------------------------------
function updateCompanion(c, dt) {
  const p = G.player;
  c.flash -= dt;
  c.attackT -= dt;
  if (!c.recruited) {
    c.moving = false;
    c.anim = 0;
    c.dir = dist(c, p) < 48 ? dirFromVec(p.x - c.x, p.y - c.y) : 0;
    return;
  }
  if (dist(c, p) > 260) {
    const tp = G.world.findWalkable(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    c.x = tp.x; c.y = tp.y;
  }
  if (c.downed > 0) {
    c.downed -= dt;
    c.moving = false;
    if (c.downed <= 0) {
      c.hp = Math.round(c.maxHp * 0.5);
      addText(c.x, c.y - 30, c.name + ' is back!', '#90ff90', 8, 1.2);
      sparkle(c.x, c.y - 8, '#ffffff', 12);
    }
    return;
  }
  const role = c.def.role;
  const buff = G.partyBuff > 0 ? 1.5 : 1;
  const dmgOf = (m) => Math.round(c.def.dmg * c.dmgMult * buff * m * rand(0.9, 1.1));
  c.atkCd -= dt;
  c.specialCd -= dt;
  c.healCd -= dt;

  // Healer: keep everyone alive first
  if (role === 'healer' && c.healCd <= 0) {
    let worst = null, wr = 0.72;
    for (const a of [p, ...party()]) {
      if (a.kind === 'companion' && a.downed > 0) continue;
      if (a.hp <= 0) continue;
      const r = a.hp / a.maxHp;
      if (r < wr && dist(a, c) < 170) { wr = r; worst = a; }
    }
    if (worst) {
      const amt = Math.round(16 + 4 * p.level);
      worst.hp = Math.min(worst.maxHp, worst.hp + amt);
      addText(worst.x, worst.y - 28, '+' + amt, '#80ffa0', 8, 1);
      sparkle(worst.x, worst.y - 8, '#fff8a0', 10);
      G.effects.push({ type: 'bolt', x1: c.x, y1: cy(c), x2: worst.x, y2: cy(worst), t: 0, life: 0.2, color: '#fff8c0' });
      c.healCd = 3.2;
      c.attackT = 0.2;
    }
  }

  const target = nearestEnemy(c.x, c.y, 140, (e) => dist(e, p) < 210);
  let mx = 0, my = 0, speed = c.def.speed;
  if (target) {
    const dx = target.x - c.x, dy = target.y - c.y, d = Math.hypot(dx, dy) || 1;
    c.dir = dirFromVec(dx, dy);
    if (role === 'tank') {
      if (d > 14) { mx = dx / d; my = dy / d; speed *= 1.1; }
      else if (c.atkCd <= 0) {
        c.atkCd = c.def.cd;
        c.attackT = 0.15;
        const ang = Math.atan2(cy(target) - cy(c), dx);
        G.effects.push({ type: 'slash', x: c.x, y: cy(c), ang, arc: 2, range: 22, t: 0, life: 0.14, color: '#ffd0a0' });
        damageEnemy(target, dmgOf(1), { knock: 100, ax: dx / d, ay: dy / d });
      }
      if (c.specialCd <= 0 && d < 30) {
        c.specialCd = 7;
        G.effects.push({ type: 'ring', x: c.x, y: c.y - 4, r0: 4, r1: 44, color: '#ffc080', t: 0, life: 0.4, width: 3 });
        G.shake = Math.max(G.shake, 0.15);
        aoe(c.x, cy(c), 44, (e, nx, ny) => damageEnemy(e, dmgOf(1.4), { stun: 0.9, knock: 140, ax: nx, ay: ny }));
        addText(c.x, c.y - 32, 'Ground Slam!', '#ffc080', 8, 1);
      }
    } else {
      const want = Math.min(c.def.range * 0.7, 90);
      if (d > want + 10) { mx = dx / d; my = dy / d; }
      else if (d < 40) { mx = -dx / d; my = -dy / d; }
      if (d < c.def.range && c.atkCd <= 0) {
        c.atkCd = c.def.cd;
        c.attackT = 0.15;
        const ox = c.x, oy = cy(c);
        const tx = target.x - ox, ty = cy(target) - oy, td = Math.hypot(tx, ty) || 1;
        const sp = c.def.proj === 'arrow' ? 250 : 190;
        spawnProjectile({ x: ox, y: oy, vx: tx / td * sp, vy: ty / td * sp, kind: c.def.proj, dmg: dmgOf(1), owner: 'ally', life: c.def.range / sp + 0.2, knock: 40 });
      }
      if (c.specialCd <= 0 && d < c.def.range) {
        if (role === 'caster') {
          c.specialCd = 7;
          const tx = target.x, ty = cy(target);
          G.effects.push({ type: 'ring', x: tx, y: ty, r0: 4, r1: 34, color: '#ff7020', t: 0, life: 0.45, width: 3 });
          burst(tx, ty, '#ff9030', 20, 90, 0.6);
          burst(tx, ty, '#ffe060', 10, 60, 0.5);
          aoe(tx, ty, 34, (e, nx, ny) => damageEnemy(e, dmgOf(2.4), { knock: 110, ax: nx, ay: ny, color: '#ffa040' }));
          addText(c.x, c.y - 32, 'Inferno!', '#ff9040', 8, 1);
        } else if (role === 'ranged') {
          c.specialCd = 6;
          const base = Math.atan2(cy(target) - cy(c), target.x - c.x);
          for (let i = -1; i <= 1; i++) {
            const a = base + i * 0.15;
            spawnProjectile({ x: c.x, y: cy(c), vx: Math.cos(a) * 260, vy: Math.sin(a) * 260, kind: 'arrow', dmg: dmgOf(1.2), owner: 'ally', life: 0.8, knock: 50 });
          }
        } else if (role === 'healer') {
          c.specialCd = 9;
          G.effects.push({ type: 'ring', x: c.x, y: cy(c), r0: 4, r1: 50, color: '#fff8a0', t: 0, life: 0.5, width: 2 });
          aoe(c.x, cy(c), 50, (e) => damageEnemy(e, dmgOf(1.5), { stun: 1.2, color: '#fff8a0' }));
        }
      }
    }
  } else {
    // follow the leader along the trail
    const idx = Math.min(G.trail.length - 1, (c.slot + 1) * 8);
    const tp = idx >= 0 ? G.trail[idx] : p;
    const dx = tp.x - c.x, dy = tp.y - c.y, d = Math.hypot(dx, dy);
    if (d > 5) {
      mx = dx / d; my = dy / d;
      speed = Math.max(speed, p.speed) * (d > 30 ? 1.35 : 1.0);
      c.dir = dirFromVec(dx, dy);
    }
  }
  // gentle separation from other party members
  for (const o of [p, ...party()]) {
    if (o === c) continue;
    const dx = c.x - o.x, dy = c.y - o.y, d = Math.hypot(dx, dy);
    if (d < 9 && d > 0.01) { mx += dx / d * 0.6; my += dy / d * 0.6; }
  }
  c.moving = mx !== 0 || my !== 0;
  if (c.moving) {
    const l = Math.hypot(mx, my) || 1;
    const res = moveEntity(c, mx / l * speed * dt, my / l * speed * dt);
    c.anim += dt * 8;
    if (res.bx && res.by) c.stuck += dt; else c.stuck = 0;
    if (c.stuck > 1.2) {
      const tp = G.trail[Math.min(G.trail.length - 1, 4)] || p;
      c.x = tp.x; c.y = tp.y; c.stuck = 0;
    }
  } else c.anim = 0;
}

// ---------------------------------------------------------------------------
// Update: enemies
// ---------------------------------------------------------------------------
function updateEnemy(e, dt) {
  const p = G.player;
  e.flash -= dt;
  e.attackT -= dt;
  e.aggro -= dt;
  if (e.poison > 0) {
    e.poison -= dt;
    e.poisonTick -= dt;
    if (e.poisonTick <= 0) {
      e.poisonTick = 0.5;
      damageEnemy(e, Math.max(1, Math.round(e.poisonDps * 0.5)), { color: '#90ff50' });
      if (e.dead) return;
    }
  }
  // knockback
  if (Math.abs(e.kx) + Math.abs(e.ky) > 1) {
    moveEntity(e, e.kx * dt, e.ky * dt);
    const decay = Math.exp(-12 * dt);
    e.kx *= decay; e.ky *= decay;
  } else { e.kx = 0; e.ky = 0; }
  if (e.stun > 0) { e.stun -= dt; e.moving = false; return; }
  const slowF = e.slow > 0 ? 0.5 : 1;
  e.slow -= dt;

  // choose target
  let target = null, best = Infinity;
  const sight = e.d.sight * (e.aggro > 0 ? 2 : 1);
  for (const a of allyTargets()) {
    let d = dist(e, a);
    if (d > sight) continue;
    if (a.kind === 'companion' && a.def.role === 'tank') d *= 0.6;
    if (d < best) { best = d; target = a; }
  }
  const homeD = Math.hypot(e.x - e.homeX, e.y - e.homeY);
  if (homeD > (e.boss ? 200 : 280)) target = null;
  if (!target && e.aggro <= 0 && homeD > 40 && e.hp < e.maxHp) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.2 * dt);

  let mx = 0, my = 0;
  let speed = e.speed * slowF;
  if (e.boss && e.hp < e.maxHp * 0.5) speed *= 1.3;

  if (target) {
    const dx = target.x - e.x, dy = target.y - e.y, d = Math.hypot(dx, dy) || 1;
    e.dir = dirFromVec(dx, dy);
    if (e.boss && updateBoss(e, target, d, dt)) { e.moving = false; return; }
    if (e.d.ranged) {
      if (d > e.d.atkRange * 0.85) { mx = dx / d; my = dy / d; }
      else if (d < 50) { mx = -dx / d; my = -dy / d; }
      e.atkCd -= dt;
      if (d < e.d.atkRange && e.atkCd <= 0) {
        e.atkCd = e.d.atkCd;
        e.attackT = 0.2;
        const tx = target.x - e.x, ty = cy(target) - cy(e), td = Math.hypot(tx, ty) || 1;
        spawnProjectile({ x: e.x, y: cy(e), vx: tx / td * 150, vy: ty / td * 150, kind: 'bone', dmg: e.dmg, owner: 'enemy', life: 1.3 });
      }
    } else {
      const reach = e.d.atkRange + target.r;
      if (d > reach) { mx = dx / d; my = dy / d; }
      e.atkCd -= dt;
      if (d <= reach + 2 && e.atkCd <= 0) {
        e.atkCd = e.d.atkCd;
        e.attackT = 0.2;
        hurtAlly(target, e.dmg, e.x, e.y);
      }
    }
  } else {
    // wander near home
    e.wanderT -= dt;
    if (e.wanderT <= 0) {
      e.wanderT = rand(1.5, 4);
      if (homeD > 60) { e.wx = e.homeX; e.wy = e.homeY; }
      else { e.wx = e.homeX + rand(-48, 48); e.wy = e.homeY + rand(-48, 48); }
    }
    const dx = e.wx - e.x, dy = e.wy - e.y, d = Math.hypot(dx, dy);
    if (d > 4) { mx = dx / d; my = dy / d; speed *= homeD > 60 ? 1 : 0.4; e.dir = dirFromVec(dx, dy); }
  }
  // separation between enemies
  for (const o of G.enemies) {
    if (o === e || o.dead) continue;
    const dx = e.x - o.x, dy = e.y - o.y;
    if (Math.abs(dx) > 14 || Math.abs(dy) > 14) continue;
    const d = Math.hypot(dx, dy);
    const minD = (e.r + o.r) * 0.8;
    if (d < minD && d > 0.01) { mx += dx / d * 0.5; my += dy / d * 0.5; }
  }
  e.moving = mx !== 0 || my !== 0;
  if (e.moving) {
    const l = Math.hypot(mx, my) || 1;
    const res = moveEntity(e, mx / l * speed * dt, my / l * speed * dt);
    if ((res.bx || res.by) && !target) e.wanderT = 0;
    e.anim += dt * (e.fly ? 10 : 6);
  } else e.anim += dt * (e.fly ? 10 : 1.5);
}

// Boss behaviour. Returns true if the boss is busy (standing still).
function updateBoss(e, target, d, dt) {
  e.slamT -= dt;
  e.summonT -= dt;
  if (e.slamming > 0) {
    e.slamming -= dt;
    if (e.slamming <= 0) {
      G.shake = 0.4;
      G.effects.push({ type: 'ring', x: e.sx, y: e.sy, r0: 6, r1: 50, color: '#ff8040', t: 0, life: 0.4, width: 4 });
      burst(e.sx, e.sy, '#a08060', 24, 110, 0.6, 2);
      for (const a of allyTargets()) {
        if (Math.hypot(a.x - e.sx, a.y - e.sy) < 50) hurtAlly(a, 30, e.sx, e.sy);
      }
      if (G.player.buffs.invis > 0 && Math.hypot(G.player.x - e.sx, G.player.y - e.sy) < 50) hurtAlly(G.player, 30, e.sx, e.sy);
    }
    return true;
  }
  if (e.slamT <= 0 && d < 110) {
    e.slamT = e.hp < e.maxHp * 0.5 ? 3.2 : 5;
    e.slamming = 1.0;
    e.sx = target.x; e.sy = target.y;
    e.attackT = 1.0;
    G.effects.push({ type: 'tele', x: e.sx, y: e.sy, r: 50, t: 0, life: 1.0 });
    addText(e.x, e.y - 50, 'GROUND POUND!', '#ff8040', 8, 1);
    return true;
  }
  if (e.summonT <= 0) {
    e.summonT = 12;
    for (let i = 0; i < 3; i++) {
      const pos = G.world.findWalkable(Math.floor((e.x + rand(-40, 40)) / TILE), Math.floor((e.y + rand(-40, 40)) / TILE));
      const s = makeEnemy(i === 0 ? 'blueSlime' : 'slime', pos.x, pos.y);
      s.aggro = 10;
      G.enemies.push(s);
      burst(pos.x, pos.y - 4, '#80e060', 10, 60, 0.5);
    }
    addText(e.x, e.y - 50, 'Minions, attack!', '#ff8040', 8, 1.2);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Update: projectiles, pickups, effects, particles
// ---------------------------------------------------------------------------
function explodeAt(pr) {
  G.effects.push({ type: 'ring', x: pr.x, y: pr.y, r0: 4, r1: pr.explode, color: '#ff8030', t: 0, life: 0.35, width: 3 });
  burst(pr.x, pr.y, '#ff9030', 22, 100, 0.6);
  burst(pr.x, pr.y, '#ffe060', 10, 60, 0.5);
  G.shake = Math.max(G.shake, 0.15);
  aoe(pr.x, pr.y, pr.explode, (e, nx, ny) => {
    damageEnemy(e, pr.dmg, { crit: pr.crit, knock: pr.knock || 80, ax: nx, ay: ny, color: '#ffa040', fromPlayer: pr.fromPlayer });
  });
}

function updateProjectiles(dt) {
  const keep = [];
  for (const pr of G.projectiles) {
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.t += dt;
    pr.life -= dt;
    let dead = pr.life <= 0;
    if (pr.kind === 'fireball' && Math.random() < 0.8) G.particles.push({ x: pr.x, y: pr.y, vx: rand(-10, 10), vy: rand(-10, 10), life: 0.3, max: 0.3, color: Math.random() < 0.5 ? '#ff9030' : '#ffe060', size: 1, grav: 0 });
    if (!dead && G.world.blocksShot(Math.floor(pr.x / TILE), Math.floor((pr.y + 8) / TILE))) {
      dead = true;
      if (pr.explode) explodeAt(pr); else burst(pr.x, pr.y, '#d8d0c0', 4, 30, 0.3);
    }
    if (!dead && pr.owner === 'ally') {
      for (const e of G.enemies) {
        if (e.dead || pr.hit.has(e)) continue;
        if (Math.hypot(e.x - pr.x, cy(e) - pr.y) < e.r + pr.r) {
          pr.hit.add(e);
          if (pr.explode) { explodeAt(pr); dead = true; break; }
          const sp = Math.hypot(pr.vx, pr.vy) || 1;
          damageEnemy(e, pr.dmg, { crit: pr.crit, knock: pr.knock || 40, ax: pr.vx / sp, ay: pr.vy / sp, fromPlayer: pr.fromPlayer });
          if (!pr.pierce) { dead = true; break; }
        }
      }
    } else if (!dead && pr.owner === 'enemy') {
      const targets = [G.player, ...party()];
      for (const a of targets) {
        if (a.kind === 'companion' && a.downed > 0) continue;
        if (Math.hypot(a.x - pr.x, cy(a) - pr.y) < a.r + pr.r) {
          hurtAlly(a, pr.dmg, pr.x - pr.vx, pr.y - pr.vy);
          dead = true;
          burst(pr.x, pr.y, '#e8e4d4', 5, 40, 0.3);
          break;
        }
      }
    }
    if (!dead) keep.push(pr);
  }
  G.projectiles = keep;
}

function updatePickups(dt) {
  const p = G.player;
  const keep = [];
  for (const k of G.pickups) {
    k.t += dt;
    if (k.vz !== 0 || k.z > 0) {
      k.vz -= 300 * dt;
      k.z += k.vz * dt;
      if (k.z <= 0) { k.z = 0; k.vz = Math.abs(k.vz) > 40 ? -k.vz * 0.4 : 0; }
      k.x += k.vx * dt; k.y += k.vy * dt;
      k.vx *= Math.exp(-4 * dt); k.vy *= Math.exp(-4 * dt);
    }
    const d = dist(k, p);
    if (k.t > 0.4 && d < 40) {
      const s = 160 * dt / (d || 1);
      k.x += (p.x - k.x) * Math.min(1, s * 1.5);
      k.y += (p.y - 4 - k.y) * Math.min(1, s * 1.5);
    }
    if (k.t > 0.4 && d < 8) {
      if (k.type === 'gold') { p.gold += k.amount; addText(p.x, p.y - 26, '+' + k.amount + 'g', '#ffd040', 8, 0.7); }
      if (k.type === 'heart') { p.hp = Math.min(p.maxHp, p.hp + k.amount); addText(p.x, p.y - 26, '+' + k.amount, '#60ff80', 8, 0.7); }
      if (k.type === 'mana') { p.mp = Math.min(p.maxMp, p.mp + k.amount); addText(p.x, p.y - 26, '+' + k.amount + ' MP', '#80b0ff', 8, 0.7); }
      if (k.type === 'potion') { p.potions += k.amount; addText(p.x, p.y - 26, '+1 potion', '#ff70a0', 8, 1); }
      continue;
    }
    if (k.t < 40) keep.push(k);
  }
  G.pickups = keep;
}

function updateFx(dt) {
  G.effects = G.effects.filter((f) => (f.t += dt) < f.life);
  for (const pt of G.particles) {
    pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += pt.grav * dt; pt.life -= dt;
  }
  G.particles = G.particles.filter((pt) => pt.life > 0);
  for (const t of G.texts) t.t += dt;
  G.texts = G.texts.filter((t) => t.t < t.life);
  G.shake = Math.max(0, G.shake - dt);
}

function updateSpawns() {
  const p = G.player;
  for (const s of G.spawns) {
    if (s.enemy || G.time < s.respawnAt) continue;
    if (Math.hypot(s.x - p.x, s.y - p.y) < 240) continue;
    s.enemy = makeEnemy(s.type, s.x, s.y, s);
    G.enemies.push(s.enemy);
  }
  if (G.enemies.some((e) => e.dead)) G.enemies = G.enemies.filter((e) => !e.dead);
}

function updateCamera(snap) {
  const p = G.player;
  const tx = clamp(p.x - VW / 2, 0, G.world.w * TILE - VW);
  const ty = clamp(p.y - 8 - VH / 2, 0, G.world.h * TILE - VH);
  if (snap) { G.cam.x = tx; G.cam.y = ty; return; }
  G.cam.x += (tx - G.cam.x) * 0.15;
  G.cam.y += (ty - G.cam.y) * 0.15;
}

function respawnPlayer() {
  const p = G.player;
  p.x = G.startPos.x; p.y = G.startPos.y;
  p.hp = p.maxHp; p.mp = p.maxMp;
  p.gold = Math.floor(p.gold * 0.75);
  p.invuln = 2;
  p.buffs = { dmg: 0, invis: 0, poison: 0, critNext: false };
  G.trail = [];
  for (const c of party()) { c.x = p.x + rand(-10, 10); c.y = p.y + 8; c.downed = 0; c.hp = c.maxHp; }
  for (const e of G.enemies) { e.aggro = 0; }
  G.projectiles = [];
  G.state = 'play';
  updateCamera(true);
  addText(p.x, p.y - 30, 'You wake in Emberbrook...', '#ffffff', 8, 2);
}

// ---------------------------------------------------------------------------
// Main update
// ---------------------------------------------------------------------------
function update(dt) {
  G.time += dt;
  if (G.state === 'title') {
    if (hit('Enter', 'Space', 'Click', 'NumpadEnter')) openCreator();
    return;
  }
  if (G.state === 'create') return;
  if (G.state === 'dialog') { updateDialog(dt); updateFx(dt); return; }
  if (G.state === 'pause') {
    if (hit('Escape', 'KeyP', 'Enter')) G.state = 'play';
    return;
  }
  if (G.state === 'gameover') {
    G.stateT += dt;
    updateFx(dt);
    if (G.stateT > 1 && hit('Enter', 'Space', 'Click')) respawnPlayer();
    return;
  }
  if (G.state === 'victory') {
    updateFx(dt);
    if (hit('Enter', 'Space', 'Click', 'Escape')) G.state = 'play';
    return;
  }

  // play
  G.playTime += dt;
  if (hit('Escape', 'KeyP')) { G.state = 'pause'; return; }
  if (hit('KeyE')) {
    const t = interactTarget();
    if (t) { talkTo(t); return; }
  }
  G.partyBuff = Math.max(0, G.partyBuff - dt);
  updatePlayer(dt);
  for (const c of G.companions) updateCompanion(c, dt);
  const p = G.player;
  for (const e of G.enemies) {
    if (e.dead) continue;
    if (Math.abs(e.x - p.x) > 420 || Math.abs(e.y - p.y) > 320) continue;
    updateEnemy(e, dt);
  }
  updateProjectiles(dt);
  updatePickups(dt);
  updateFx(dt);
  updateSpawns();
  updateCamera(false);
  if (G.victoryTimer > 0) {
    G.victoryTimer -= dt;
    if (G.victoryTimer <= 0 && G.state === 'play') G.state = 'victory';
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function drawText(str, x, y, size = 8, color = '#fff', align = 'left', shadow = true) {
  ctx.font = `${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  if (shadow) {
    ctx.fillStyle = '#1b1426';
    const o = Math.max(1, Math.round(size / 8));
    ctx.fillText(str, x + o, y + o);
  }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

function wrapText(str, maxW, size) {
  ctx.font = `${size}px ${FONT}`;
  const words = str.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && cur) { lines.push(cur); cur = w; } else cur = test;
  }
  if (cur) lines.push(cur);
  return lines;
}

function panel(x, y, w, h, alpha = 0.85) {
  ctx.fillStyle = `rgba(20, 14, 34, ${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#e8d8b0';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
  ctx.strokeStyle = '#6a5040';
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 4.5, y + 4.5, w - 9, h - 9);
}

function bar(x, y, w, h, ratio, color, back = '#2a1a2a') {
  ctx.fillStyle = '#0e0a16';
  ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, Math.round(w * clamp(ratio, 0, 1)), h);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(x, y, Math.round(w * clamp(ratio, 0, 1)), Math.max(1, Math.floor(h / 3)));
}

function walkFrame(e) {
  if (!e.moving) return 0;
  return [1, 0, 2, 0][Math.floor(e.anim) % 4];
}

function drawSpriteAt(sprite, x, y, dir, fi, opts = {}) {
  const frame = sprite.frames[dir][fi];
  const s = opts.scale || 1;
  const dx = Math.round(x - sprite.ox * s), dy = Math.round(y - sprite.oy * s);
  if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
  ctx.drawImage(frame, dx, dy, sprite.w * s, sprite.h * s);
  if (opts.flash) {
    ctx.globalAlpha = (opts.alpha !== undefined ? opts.alpha : 1) * 0.65;
    ctx.drawImage(getFlashFrame(sprite, frame), dx, dy, sprite.w * s, sprite.h * s);
  }
  ctx.globalAlpha = 1;
}

function shadowAt(x, y, w = 8) {
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  const X = Math.round(x), Y = Math.round(y);
  ctx.fillRect(X - w / 2, Y - 2, w, 2);
  ctx.fillRect(X - w / 2 + 1, Y - 3, w - 2, 1);
  ctx.fillRect(X - w / 2 + 1, Y, w - 2, 1);
}

function drawEntity(e) {
  if (e.kind === 'enemy') {
    const s = e.sprite;
    const sc = e.scale || 1;
    if (e.d.sprite === 'slime') {
      shadowAt(e.x, e.y, 12);
      const fi = Math.floor(e.anim * 1.5) % 2;
      drawSpriteAt(s, e.x, e.y, 0, fi, { flash: e.flash > 0 });
    } else if (e.d.sprite === 'bat') {
      shadowAt(e.x, e.y, 6);
      const bob = Math.sin(e.anim * 0.8) * 2;
      drawSpriteAt(s, e.x, e.y - 8 + bob, 0, Math.floor(e.anim) % 2, { flash: e.flash > 0 });
    } else {
      shadowAt(e.x, e.y, 8 * sc);
      const fi = e.moving ? [1, 0, 2, 0][Math.floor(e.anim) % 4] : 0;
      const lunge = e.attackT > 0 && !e.boss ? 1 : 0;
      drawSpriteAt(s, e.x, e.y - lunge, e.dir, fi, { flash: e.flash > 0, scale: sc });
    }
    if (e.poison > 0 && Math.random() < 0.1) G.particles.push({ x: e.x + rand(-4, 4), y: cy(e), vx: 0, vy: -15, life: 0.5, max: 0.5, color: '#90ff50', size: 1, grav: 0 });
    if (e.slow > 0 && Math.random() < 0.08) G.particles.push({ x: e.x + rand(-4, 4), y: cy(e), vx: 0, vy: -10, life: 0.5, max: 0.5, color: '#c0f0ff', size: 1, grav: 0 });
    if (e.stun > 0) {
      const t = G.time * 6;
      ctx.fillStyle = '#ffe060';
      for (let i = 0; i < 3; i++) {
        const a = t + i * 2.1;
        ctx.fillRect(Math.round(e.x + Math.cos(a) * 6), Math.round(e.y - e.hh * 2 - 4 + Math.sin(a) * 2), 1, 1);
      }
    }
    if (!e.boss && e.hp < e.maxHp) {
      const top = e.d.sprite === 'slime' ? e.y - 16 : e.d.sprite === 'bat' ? e.y - 22 : e.y - 26;
      ctx.fillStyle = '#1b1426';
      ctx.fillRect(Math.round(e.x) - 8, Math.round(top), 16, 3);
      ctx.fillStyle = '#e04040';
      ctx.fillRect(Math.round(e.x) - 7, Math.round(top) + 1, Math.round(14 * e.hp / e.maxHp), 1);
    }
    return;
  }
  // humanoids: player, companions, npcs
  shadowAt(e.x, e.y, 8);
  if (e.kind === 'companion' && e.downed > 0) {
    drawSpriteAt(e.sprite, e.x, e.y, 0, 0, { alpha: 0.4 });
    ctx.fillStyle = '#ffffff';
    const zt = (G.time * 2) % 1;
    ctx.globalAlpha = 1 - zt;
    ctx.fillRect(Math.round(e.x + 4 + zt * 4), Math.round(e.y - 26 - zt * 8), 2, 1);
    ctx.globalAlpha = 1;
    return;
  }
  let alpha;
  if (e.kind === 'player') {
    if (e.buffs.invis > 0) alpha = 0.35;
    else if (e.invuln > 0 && Math.floor(G.time * 20) % 2) alpha = 0.55;
  }
  const lunge = e.attackT > 0 ? 1 : 0;
  const ox = lunge * (e.dir === 2 ? -1 : e.dir === 3 ? 1 : 0), oy = lunge * (e.dir === 1 ? -1 : e.dir === 0 ? 1 : 0);
  drawSpriteAt(e.sprite, e.x + ox, e.y + oy, e.dir, walkFrame(e), { flash: e.flash > 0, alpha });
  if (e.kind === 'player' && e.buffs.dmg > 0 && Math.random() < 0.2) G.particles.push({ x: e.x + rand(-5, 5), y: e.y - rand(0, 18), vx: 0, vy: -20, life: 0.4, max: 0.4, color: '#ff6040', size: 1, grav: 0 });
  if (e.kind === 'player' && e.buffs.poison > 0 && Math.random() < 0.15) G.particles.push({ x: e.x + rand(-6, 6), y: e.y - rand(4, 14), vx: 0, vy: -12, life: 0.4, max: 0.4, color: '#80e040', size: 1, grav: 0 });
}

function drawProjectile(pr) {
  const sp = Math.hypot(pr.vx, pr.vy) || 1;
  const ux = pr.vx / sp, uy = pr.vy / sp;
  const X = pr.x, Y = pr.y;
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  switch (pr.kind) {
    case 'arrow': case 'bigArrow': case 'knife': {
      const len = pr.kind === 'bigArrow' ? 10 : pr.kind === 'knife' ? 4 : 7;
      const shaft = pr.kind === 'knife' ? '#c0c8d8' : pr.kind === 'bigArrow' ? '#80ffe0' : '#8a5a2a';
      for (let i = 0; i < len; i++) px(X - ux * i, Y - uy * i, shaft);
      px(X + ux, Y + uy, '#f0f4ff');
      if (pr.kind !== 'knife') { px(X - ux * (len - 1) - uy, Y - uy * (len - 1) + ux, '#ffffff'); px(X - ux * (len - 1) + uy, Y - uy * (len - 1) - ux, '#ffffff'); }
      break;
    }
    case 'bone':
      for (let i = 0; i < 4; i++) px(X - ux * i, Y - uy * i, '#e8e4d4');
      px(X - uy, Y + ux, '#e8e4d4');
      break;
    case 'fireball': {
      const r = 3 + Math.sin(pr.t * 30) * 0.5;
      ctx.fillStyle = '#ff6020'; ctx.fillRect(Math.round(X - r), Math.round(Y - r), Math.round(r * 2), Math.round(r * 2));
      ctx.fillStyle = '#ffb040'; ctx.fillRect(Math.round(X - 2), Math.round(Y - 2), 4, 4);
      ctx.fillStyle = '#fff0a0'; ctx.fillRect(Math.round(X - 1), Math.round(Y - 1), 2, 2);
      break;
    }
    default: {
      const colors = { magic: ['#6040e0', '#a080ff', '#ffffff'], spark: ['#e040c0', '#ff90e0', '#ffffff'], fire: ['#e04010', '#ff9030', '#fff0a0'], holy: ['#e0c040', '#fff080', '#ffffff'] }[pr.kind] || ['#fff', '#fff', '#fff'];
      const size = pr.kind === 'spark' ? 1 : 2;
      ctx.fillStyle = colors[0]; ctx.fillRect(Math.round(X - size - 1), Math.round(Y - size - 1), size * 2 + 2, size * 2 + 2);
      ctx.fillStyle = colors[1]; ctx.fillRect(Math.round(X - size), Math.round(Y - size), size * 2, size * 2);
      ctx.fillStyle = colors[2]; ctx.fillRect(Math.round(X), Math.round(Y - 1), 1, 1);
      if (Math.random() < 0.5) G.particles.push({ x: X, y: Y, vx: rand(-6, 6), vy: rand(-6, 6), life: 0.25, max: 0.25, color: colors[1], size: 1, grav: 0 });
    }
  }
}

function drawPickup(k) {
  const X = Math.round(k.x), Y = Math.round(k.y - k.z - 3 + Math.sin(k.t * 4) * (k.z > 0 ? 0 : 1));
  if (k.t > 30 && Math.floor(k.t * 8) % 2) return;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(Math.round(k.x) - 2, Math.round(k.y), 5, 1);
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + x, Y + y, w, h); };
  if (k.type === 'gold') {
    r(-2, -2, 4, 4, '#b08010'); r(-1, -3, 2, 6, '#b08010'); r(-3, -1, 6, 2, '#b08010');
    r(-1, -2, 2, 4, '#f0c830'); r(-2, -1, 4, 2, '#f0c830'); r(-1, -2, 1, 1, '#fff0a0');
  } else if (k.type === 'heart') {
    r(-3, -3, 2, 1, '#e02040'); r(1, -3, 2, 1, '#e02040'); r(-4, -2, 8, 2, '#e02040'); r(-3, 0, 6, 1, '#e02040'); r(-2, 1, 4, 1, '#e02040'); r(-1, 2, 2, 1, '#e02040'); r(-3, -2, 1, 1, '#ff90a0');
  } else if (k.type === 'mana') {
    r(-1, -4, 2, 1, '#4080ff'); r(-2, -3, 4, 1, '#4080ff'); r(-3, -2, 6, 3, '#4080ff'); r(-2, 1, 4, 1, '#2050c0'); r(-2, -2, 1, 1, '#c0e0ff');
  } else if (k.type === 'potion') {
    r(-1, -5, 2, 2, '#8a5a2a'); r(-2, -3, 4, 1, '#e0e0f0'); r(-3, -2, 6, 5, '#e0407a'); r(-2, 3, 4, 1, '#a02050'); r(-2, -1, 1, 1, '#ffb0d0');
  }
}

function drawEffect(f) {
  const k = f.t / f.life;
  switch (f.type) {
    case 'slash': {
      ctx.strokeStyle = f.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 2;
      ctx.beginPath();
      const start = f.ang - f.arc / 2, sweep = f.arc * Math.min(1, k * 2.5);
      ctx.arc(f.x, f.y, f.range * 0.8, start, start + sweep);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.range * 0.55, start, start + sweep);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'spin': {
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        const a = k * Math.PI * 4 + i * 2.1;
        ctx.arc(f.x, f.y, f.r * (0.4 + i * 0.25), a, a + 1.5);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    }
    case 'ring': {
      ctx.strokeStyle = f.color;
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = f.width || 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case 'tele': {
      ctx.fillStyle = `rgba(255, 60, 30, ${0.12 + 0.25 * k})`;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, f.r, f.r * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff5030';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(f.x, f.y, f.r * k, f.r * 0.6 * k, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'bolt': {
      ctx.strokeStyle = f.color || '#ffff80';
      ctx.globalAlpha = 1 - k;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(f.x1, f.y1);
      const n = 6;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        ctx.lineTo(f.x1 + (f.x2 - f.x1) * t + rand(-4, 4), f.y1 + (f.y2 - f.y1) * t + rand(-4, 4));
      }
      ctx.lineTo(f.x2, f.y2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
  }
}

function drawWorld() {
  const cam = G.cam;
  const sx = G.shake > 0 ? Math.round(rand(-2, 2)) : 0, sy = G.shake > 0 ? Math.round(rand(-2, 2)) : 0;
  const camX = Math.round(cam.x) + sx, camY = Math.round(cam.y) + sy;
  ctx.setTransform(SCALE, 0, 0, SCALE, -camX * SCALE, -camY * SCALE);
  ctx.imageSmoothingEnabled = false;
  const w = G.world;
  const srcX = clamp(camX, 0, w.canvas.width - VW - 1), srcY = clamp(camY, 0, w.canvas.height - VH - 1);
  ctx.drawImage(w.canvas, srcX, srcY, VW + 1, VH + 1, srcX, srcY, VW + 1, VH + 1);

  // water shimmer
  ctx.fillStyle = '#b8d8ff';
  const tx0 = Math.floor(camX / TILE) - 1, ty0 = Math.floor(camY / TILE) - 1;
  const tx1 = tx0 + VW / TILE + 2, ty1 = ty0 + VH / TILE + 2;
  for (const [x, y, seed] of w.water) {
    if (x < tx0 || x > tx1 || y < ty0 || y > ty1) continue;
    const ph = (G.time * 1.5 + seed * 0.37) % 3;
    if (ph < 1) ctx.fillRect(x * TILE + (seed % 10) + Math.floor(ph * 3), y * TILE + 4 + (seed % 9), 3, 1);
  }

  for (const k of G.pickups) drawPickup(k);

  // depth-sorted entities
  const list = [];
  const inView = (e) => e.x > camX - 40 && e.x < camX + VW + 40 && e.y > camY - 20 && e.y < camY + VH + 60;
  if (G.player) list.push(G.player);
  for (const c of G.companions) if (inView(c)) list.push(c);
  for (const n of G.npcs) if (inView(n)) list.push(n);
  for (const e of G.enemies) if (!e.dead && inView(e)) list.push(e);
  list.sort((a, b) => a.y - b.y);
  for (const e of G.effects) if (e.type === 'tele') drawEffect(e);
  for (const e of list) drawEntity(e);

  for (const pr of G.projectiles) drawProjectile(pr);
  for (const f of G.effects) if (f.type !== 'tele') drawEffect(f);
  for (const pt of G.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.fillRect(Math.round(pt.x), Math.round(pt.y), pt.size, pt.size);
  }
  ctx.globalAlpha = 1;

  // back to screen space
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const toScreen = (x, y) => [(x - camX) * SCALE, (y - camY) * SCALE];

  // markers above talkable characters
  if (G.state === 'play' || G.state === 'dialog') {
    const tgt = G.state === 'play' ? interactTarget() : null;
    for (const t of G.npcs.concat(G.companions.filter((c) => !c.recruited))) {
      if (!inView(t)) continue;
      const [x, y] = toScreen(t.x, t.y - 30);
      const bob = Math.sin(G.time * 4) * 3;
      if (t === tgt) {
        drawText('[E] Talk', x, y - 18, 8, '#ffe070', 'center');
      } else {
        drawText('!', x, y - 10 + bob, 16, t.kind === 'companion' ? '#ff90d0' : '#ffe070', 'center');
      }
      if (t === tgt || t.kind === 'companion') drawText(t.name, x, y + 8 - (t === tgt ? 12 : 0) - 10, 8, '#ffffff', 'center');
    }
  }

  // floating combat text
  for (const t of G.texts) {
    const k = t.t / t.life;
    const [x, y] = toScreen(t.x, t.y - k * 14);
    ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
    drawText(t.text, Math.round(x), Math.round(y), t.size, t.color, 'center');
    ctx.globalAlpha = 1;
  }
}

// ---------------- HUD ----------------
const iconCache = {};
function getSkillIcon(id) { return iconCache['s' + id] || (iconCache['s' + id] = skillIcon(id, 3)); }
function getWeaponIcon(id) { return iconCache['w' + id] || (iconCache['w' + id] = weaponIcon(id, 3)); }

function drawPortrait(img, x, y, scale, frameColor = '#e8d8b0') {
  ctx.fillStyle = '#3a2a4a';
  ctx.fillRect(x, y, 16 * scale, 14 * scale);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, x, y, 16 * scale, 14 * scale);
  ctx.strokeStyle = frameColor;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 1, y - 1, 16 * scale + 2, 14 * scale + 2);
}

function drawHUD() {
  const p = G.player;
  // --- player panel
  panel(10, 10, 330, 104);
  drawPortrait(p.portrait, 22, 22, 4);
  drawText(p.name, 98, 22, 16, '#ffffff');
  drawText(`Lv.${p.level} ${CLASSES[p.cls].name}`, 98, 44, 8, '#e8d8b0');
  bar(98, 60, 226, 12, p.hp / p.maxHp, '#e04050');
  drawText(`${Math.ceil(p.hp)}/${p.maxHp}`, 211, 62, 8, '#ffffff', 'center');
  bar(98, 80, 226, 8, p.mp / p.maxMp, '#4080ff');
  bar(98, 96, 226, 4, p.xp / p.xpNext, '#f0c830');
  // buffs
  let bx = 12;
  const buffs = [];
  if (p.buffs.dmg > 0) buffs.push(['ATK+', '#ff6040', p.buffs.dmg]);
  if (p.buffs.invis > 0) buffs.push(['HIDE', '#b0b0c0', p.buffs.invis]);
  if (p.buffs.poison > 0) buffs.push(['PSN', '#80e040', p.buffs.poison]);
  if (p.buffs.critNext) buffs.push(['CRIT', '#ffe040', 0]);
  for (const [label, col, t] of buffs) {
    drawText(label + (t ? ' ' + Math.ceil(t) : ''), bx, 120, 8, col);
    bx += 90;
  }

  // --- party
  let py = 140;
  for (const c of party()) {
    panel(10, py, 200, 44, 0.75);
    drawPortrait(c.portrait, 18, py + 8, 2, c.downed > 0 ? '#804040' : '#ff90d0');
    drawText(c.name, 58, py + 9, 8, c.downed > 0 ? '#a08080' : '#ffffff');
    drawText(c.def.title, 58 + c.name.length * 8 + 8, py + 9, 8, '#b0a0c0');
    if (c.downed > 0) drawText('DOWN ' + Math.ceil(c.downed), 58, py + 24, 8, '#ff7070');
    else bar(58, py + 24, 136, 7, c.hp / c.maxHp, '#e04050');
    py += 48;
  }

  // --- action bar
  const slots = [
    { key: 'SPC', icon: getWeaponIcon(p.weapon), cd: Math.max(0, p.atkCd), max: WEAPONS[p.weapon].cd, label: WEAPONS[p.weapon].name },
    { key: 'Q', icon: getSkillIcon(p.skills[0]), cd: p.skillCd[0], max: SKILLS[p.skills[0]].cd, mp: SKILLS[p.skills[0]].mp, label: SKILLS[p.skills[0]].name },
    { key: 'R', icon: getSkillIcon(p.skills[1]), cd: p.skillCd[1], max: SKILLS[p.skills[1]].cd, mp: SKILLS[p.skills[1]].mp, label: SKILLS[p.skills[1]].name },
    { key: 'F', potion: true, cd: 0, max: 1, label: 'Potion x' + p.potions },
  ];
  const sw = 60, gap = 12, total = slots.length * sw + (slots.length - 1) * gap;
  let sx = Math.round(VIEW_W / 2 - total / 2);
  const sy = VIEW_H - 76;
  for (const s of slots) {
    ctx.fillStyle = 'rgba(20,14,34,0.85)';
    ctx.fillRect(sx, sy, sw, sw);
    ctx.strokeStyle = '#e8d8b0';
    ctx.lineWidth = 3;
    ctx.strokeRect(sx + 1.5, sy + 1.5, sw - 3, sw - 3);
    if (s.potion) {
      const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(sx + 18 + x * 3, sy + 12 + y * 3, w * 3, h * 3); };
      r(3, 0, 2, 2, '#8a5a2a'); r(2, 2, 4, 1, '#e0e0f0'); r(1, 3, 6, 6, '#e0407a'); r(2, 9, 4, 1, '#a02050'); r(2, 4, 1, 2, '#ffb0d0');
      drawText('x' + p.potions, sx + sw - 6, sy + sw - 16, 8, '#ffffff', 'right');
    } else {
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(s.icon, sx + (sw - s.icon.width) / 2, sy + (sw - s.icon.height) / 2);
    }
    if (s.mp && p.mp < s.mp) { ctx.fillStyle = 'rgba(30,40,120,0.55)'; ctx.fillRect(sx + 3, sy + 3, sw - 6, sw - 6); }
    if (s.cd > 0) {
      const k = clamp(s.cd / s.max, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(sx + 3, sy + 3 + (sw - 6) * (1 - k), sw - 6, (sw - 6) * k);
      if (s.cd > 0.5) drawText(s.cd.toFixed(s.cd < 10 ? 1 : 0), sx + sw / 2, sy + 24, 8, '#ffffff', 'center');
    }
    drawText(s.key, sx + 5, sy + 5, 8, '#ffe070');
    if (s.mp) drawText(String(s.mp), sx + sw - 5, sy + sw - 14, 8, '#80b0ff', 'right');
    sx += sw + gap;
  }

  // --- minimap
  const w = G.world;
  const ms = 2, mw = w.w * ms, mh = w.h * ms;
  const mx = VIEW_W - mw - 14, my = 12;
  ctx.fillStyle = '#1b1426';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.globalAlpha = 0.9;
  ctx.drawImage(w.minimap, mx, my, mw, mh);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#e8d8b0';
  ctx.lineWidth = 2;
  ctx.strokeRect(mx - 3, my - 3, mw + 6, mh + 6);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx + G.cam.x / TILE * ms + 0.5, my + G.cam.y / TILE * ms + 0.5, VW / TILE * ms, VH / TILE * ms);
  const dot = (x, y, c, s = 4) => { ctx.fillStyle = c; ctx.fillRect(Math.round(mx + x / TILE * ms - s / 2), Math.round(my + y / TILE * ms - s / 2), s, s); };
  for (const n of G.npcs) dot(n.x, n.y, '#ffe070', 3);
  for (const c of G.companions) dot(c.x, c.y, '#ff90d0', 3);
  if (G.boss && !G.boss.dead) dot(G.boss.x, G.boss.y, Math.floor(G.time * 3) % 2 ? '#ff3030' : '#ffffff', 6);
  dot(p.x, p.y, '#ffffff', 5);

  // --- gold & quest
  drawText('Gold ' + p.gold, mx, my + mh + 12, 8, '#ffd040');
  drawText('Kills ' + G.kills, mx + mw, my + mh + 12, 8, '#d0c0e0', 'right');
  let quest;
  if (G.questStage === 0) quest = ['Speak with Elder Rowan', 'in the village square.'];
  else if (!G.bossDefeated) quest = [`Allies: ${party().length}/4`, 'Defeat the Ogre King', 'in the north-east ruins.'];
  else quest = ['The Ogre King is slain!', 'Explore freely.'];
  drawText('QUEST', mx, my + mh + 30, 8, '#ffe070');
  quest.forEach((q, i) => drawText(q, mx, my + mh + 46 + i * 14, 8, '#ffffff'));

  // --- boss bar
  const b = G.boss;
  if (b && !b.dead && dist(b, p) < 260) {
    const bw = 420, bxx = VIEW_W / 2 - bw / 2;
    drawText(b.name, VIEW_W / 2, 16, 16, '#ff9070', 'center');
    bar(bxx, 40, bw, 12, b.hp / b.maxHp, '#c02030');
  }
}

function drawDialog() {
  const d = G.dialog;
  if (!d) return;
  const x = 60, h = 150, y = VIEW_H - h - 20, w = VIEW_W - 120;
  panel(x, y, w, h, 0.94);
  drawPortrait(d.speaker.portrait, x + 20, y + 22, 6, d.speaker.kind === 'companion' ? '#ff90d0' : '#ffe070');
  const title = d.speaker.kind === 'companion' ? `${d.speaker.name}, ${d.speaker.def.title}` : d.speaker.name;
  drawText(title, x + 140, y + 20, 16, d.speaker.kind === 'companion' ? '#ff90d0' : '#ffe070');
  const text = d.lines[d.idx].slice(0, Math.floor(d.shown));
  const lines = wrapText(text, w - 170, 8);
  lines.forEach((l, i) => drawText(l, x + 140, y + 50 + i * 16, 8, '#ffffff'));
  const lastLine = d.idx === d.lines.length - 1;
  const done = d.shown >= d.lines[d.idx].length;
  if (lastLine && d.choices && done) {
    d.choices.forEach((c, i) => {
      const sel = i === d.sel;
      drawText((sel ? '> ' : '  ') + c.label, x + 140, y + 80 + i * 16, 8, sel ? '#ffe070' : '#c0b0d0');
    });
  } else if (done && Math.floor(G.time * 3) % 2) {
    drawText('E >', x + w - 24, y + h - 26, 8, '#ffe070', 'right');
  }
}

function drawPause() {
  const p = G.player;
  ctx.fillStyle = 'rgba(10,6,20,0.7)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  panel(80, 40, VIEW_W - 160, VIEW_H - 80, 0.96);
  drawText('PAUSED', VIEW_W / 2, 60, 24, '#ffe070', 'center');
  // character
  ctx.imageSmoothingEnabled = false;
  const f = p.sprite.frames[0][Math.floor(G.time * 4) % 3];
  ctx.drawImage(f, 110, 100, CHAR_W * 5, CHAR_H * 5);
  let y = 110;
  const line = (a, b, c = '#ffffff') => { drawText(a, 260, y, 8, '#b0a0c0'); drawText(b, 380, y, 8, c); y += 18; };
  drawText(p.name, 260, y - 14, 16, '#ffffff'); y += 14;
  line('Class', CLASSES[p.cls].name);
  line('Level', `${p.level}  (${p.xp}/${p.xpNext} XP)`);
  line('Health', `${Math.ceil(p.hp)} / ${p.maxHp}`, '#ff8090');
  line('Mana', `${Math.floor(p.mp)} / ${p.maxMp}`, '#80b0ff');
  line('Attack', `x${(p.atk * p.affinity).toFixed(2)}` + (p.affinity > 1 ? '  (class affinity!)' : ''));
  line('Defense', String(p.def));
  line('Crit', Math.round(p.crit * 100) + '%');
  line('Weapon', WEAPONS[p.weapon].name, '#ffe070');
  y += 6;
  for (const id of p.skills) {
    drawText(SKILLS[id].name, 260, y, 8, SKILLS[id].color);
    drawText(SKILLS[id].desc, 260, y + 14, 8, '#c0b0d0');
    y += 34;
  }
  // party
  let px = 620, pyy = 110;
  drawText('PARTY', px, pyy - 14, 8, '#ff90d0');
  for (const c of G.companions) {
    drawPortrait(c.portrait, px, pyy + 6, 2, c.recruited ? '#ff90d0' : '#555');
    drawText(c.name, px + 42, pyy + 6, 8, c.recruited ? '#ffffff' : '#777');
    drawText(c.recruited ? c.def.title : 'Not recruited', px + 42, pyy + 20, 8, c.recruited ? '#b0a0c0' : '#666');
    pyy += 44;
  }
  // controls
  y = VIEW_H - 176;
  drawText('CONTROLS', 620, y, 8, '#ffe070');
  const ctl = ['WASD / Arrows  Move', 'Space / J      Attack', 'Q / K          Skill 1', 'R / L          Skill 2', 'F              Potion', 'E              Talk', 'Esc / P        Pause'];
  ctl.forEach((c, i) => drawText(c, 620, y + 16 + i * 13, 8, '#ffffff'));
  drawText('Press Esc to resume', VIEW_W / 2, VIEW_H - 64, 8, '#ffe070', 'center');
}

function drawTitle() {
  // slow pan over the world as a backdrop
  if (!G.world) G.world = new World(1337);
  const w = G.world;
  const t = G.time * 12;
  G.cam.x = 60 + (Math.sin(t / 200) * 0.5 + 0.5) * (w.w * TILE - VW - 120);
  G.cam.y = 200 + Math.sin(t / 130) * 120;
  ctx.setTransform(SCALE, 0, 0, SCALE, -Math.round(G.cam.x) * SCALE, -Math.round(G.cam.y) * SCALE);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(w.canvas, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = 'rgba(15,8,30,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  drawText('EMBERFALL', VIEW_W / 2 + 4, 64, 56, '#6a2018', 'center', false);
  drawText('EMBERFALL', VIEW_W / 2, 60, 56, '#ffb040', 'center', false);
  drawText('A Pixel Fantasy Tale', VIEW_W / 2, 136, 16, '#ffe8c0', 'center');

  // line-up: the hero with the four heroines
  if (!G.titleSprites) {
    G.titleSprites = [
      ...COMPANIONS.slice(0, 2).map((c) => buildCharacter(c.look)),
      buildCharacter({ skin: '#f1c9a0', hair: '#5a3825', hairStyle: 'spiky', eyes: '#2f6fd6', outfit: '#b8303a', outfit2: '#4a3a30', gear: 'armor', weapon: 'sword' }),
      ...COMPANIONS.slice(2).map((c) => buildCharacter(c.look)),
    ];
  }
  const s = 5;
  const n = G.titleSprites.length;
  const spacing = 150;
  const startX = VIEW_W / 2 - ((n - 1) * spacing) / 2;
  G.titleSprites.forEach((sp, i) => {
    const bob = Math.floor(G.time * 4 + i) % 2;
    const x = startX + i * spacing - (CHAR_W * s) / 2;
    const y = 190 + (i === 2 ? -10 : 0) + bob * s;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(x + 8 * s, 190 + 23 * s + (i === 2 ? -10 : 0), 10 * s, 2 * s);
    ctx.drawImage(sp.frames[0][0], x, y, CHAR_W * s, CHAR_H * s);
  });
  const names = ['Aria', 'Luna', 'You', 'Brynn', 'Selene'];
  names.forEach((nm, i) => drawText(nm, startX + i * spacing, 350 + (i === 2 ? -10 : 0), 8, i === 2 ? '#ffe070' : '#ff90d0', 'center'));

  if (Math.floor(G.time * 2) % 2) drawText('Press ENTER to begin', VIEW_W / 2, 420, 16, '#ffffff', 'center');
  drawText('WASD move · Space attack · Q/R skills · E talk', VIEW_W / 2, 480, 8, '#c0b0d0', 'center');
}

function drawOverlayMessage(title, sub, color) {
  ctx.fillStyle = 'rgba(10,6,20,0.65)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawText(title, VIEW_W / 2, VIEW_H / 2 - 50, 32, color, 'center');
  sub.forEach((s, i) => drawText(s, VIEW_W / 2, VIEW_H / 2 + 10 + i * 22, 8, '#ffffff', 'center'));
}

function render() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#10081c';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  if (G.state === 'title' || G.state === 'create') {
    drawTitle();
    return;
  }
  drawWorld();
  drawHUD();
  if (G.state === 'dialog') drawDialog();
  if (G.state === 'pause') drawPause();
  if (G.state === 'gameover') drawOverlayMessage('YOU HAVE FALLEN', ['Your companions carry you back to the village.', '', 'Press ENTER to rise again'], '#ff5050');
  if (G.state === 'victory') {
    const mins = Math.floor(G.playTime / 60), secs = Math.floor(G.playTime % 60);
    drawOverlayMessage('VICTORY!', [
      `The Ogre King has fallen to ${G.player.name} and friends.`,
      `Level ${G.player.level}  -  ${G.kills} monsters defeated  -  ${mins}m ${secs}s`,
      '', 'Press ENTER to keep exploring',
    ], '#ffe070');
  }
}

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  update(dt);
  render();
  for (const k in pressed) delete pressed[k];
  requestAnimationFrame(frame);
}

function startGame(cfg) {
  newGame(cfg);
  canvas.focus();
}

// Expose for the creator & debugging
window.EMBERFALL = { G, startGame };

document.fonts && document.fonts.load(`16px ${FONT}`).catch(() => {});
requestAnimationFrame(frame);
