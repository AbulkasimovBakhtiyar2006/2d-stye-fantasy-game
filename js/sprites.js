'use strict';
// ---------------------------------------------------------------------------
// Procedural pixel art. Every sprite in the game is drawn here, pixel by
// pixel, into small offscreen canvases which are then scaled up with
// nearest-neighbour filtering.
// ---------------------------------------------------------------------------

const OUTLINE = '#1b1426';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16)];
}

function rgbToHex(r, g, b) {
  const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

// amt < 0 darkens, amt > 0 lightens (range -1..1)
function shade(hex, amt) {
  const [r, g, b] = hexToRgb(hex);
  if (amt < 0) return rgbToHex(r * (1 + amt), g * (1 + amt), b * (1 + amt));
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

function mix(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  return rgbToHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

// Adds a 1px dark outline around every opaque pixel of the canvas.
function addOutline(canvas, color = OUTLINE) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const src = ctx.getImageData(0, 0, w, h);
  const d = src.data;
  const out = ctx.createImageData(w, h);
  out.data.set(d);
  const [r, g, b] = hexToRgb(color);
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] > 0) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        out.data[i] = r; out.data[i + 1] = g; out.data[i + 2] = b; out.data[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}

function mirrorCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

// A white silhouette of a sprite, used for the "just got hit" flash.
function whiteVersion(src) {
  const c = makeCanvas(src.width, src.height);
  const ctx = c.getContext('2d');
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, c.width, c.height);
  return c;
}

// Draws a string-based pixel map. '.' is transparent.
function drawPixelMap(ctx, rows, pal, x, y) {
  for (let j = 0; j < rows.length; j++) {
    const row = rows[j];
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '.' || ch === ' ') continue;
      ctx.fillStyle = pal[ch];
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  }
}

// ---------------------------------------------------------------------------
// Weapons
// ---------------------------------------------------------------------------

const WEAPON_PAL = {
  w: '#f4f8ff', s: '#c0c8d8', S: '#7a8298', g: '#e0b030', h: '#7a4a26', G: '#4a2a14',
  r: '#d03030', c: '#60e0ff', C: '#ffffff', y: '#ff80e0', Y: '#fff4ff', t: '#e8e0c8',
};

const WEAPON_ART = {
  sword: ['.w.', '.w.', '.s.', '.s.', '.s.', '.s.', 'gSg', '.h.', '.h.', '.g.'],
  axe: ['wss.', 'sssh', 'Sssh', 'SS.h', '...h', '...h', '...h', '...h', '...h', '...g'],
  spear: ['.w.', 'wsw', '.s.', '.S.', 'rhr', '.h.', '.h.', '.h.', '.h.', '.h.', '.h.', '.h.', '.h.'],
  dagger: ['.w.', '.s.', '.s.', 'gSg', '.h.', '.g.'],
  bow: ['.ht', 'h.t', 'h.t', 'h.t', 'g.t', 'h.t', 'h.t', 'h.t', '.ht'],
  staff: ['.c.', 'cCc', 'hch', '.h.', '.h.', '.h.', '.h.', '.h.', '.h.', '.h.', '.h.', '.h.', '.G.'],
  wand: ['.y.', 'yYy', '.y.', '.g.', '.h.', '.h.', '.h.'],
};

function weaponIcon(id, scale = 4) {
  const art = WEAPON_ART[id];
  const w = art[0].length + 2, h = art.length + 2;
  const small = makeCanvas(w, h);
  drawPixelMap(small.getContext('2d'), art, WEAPON_PAL, 1, 1);
  addOutline(small);
  const c = makeCanvas(w * scale, h * scale);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, w * scale, h * scale);
  return c;
}

// ---------------------------------------------------------------------------
// Humanoid characters
// ---------------------------------------------------------------------------
// Frame layout: 26x28 canvas, figure drawn in a 16x20 box offset by (5, 5).
// Directions: 0 = down, 1 = up, 2 = left, 3 = right. Frames: 0 idle, 1/2 walk.

const CHAR_W = 26, CHAR_H = 28, CHAR_OX = 5, CHAR_OY = 5;

function normalizeLook(look) {
  const L = Object.assign({}, look);
  L.skinShade = L.skinShade || shade(L.skin, -0.16);
  L.hairStyle = L.hairStyle || 'short';
  L.hair = L.hair || '#2a2230';
  L.hairShade = shade(L.hair, -0.28);
  L.hairLight = shade(L.hair, 0.28);
  L.eyes = L.eyes || '#6a3a1a';
  L.outfit = L.outfit || '#3050b0';
  L.outfitShade = shade(L.outfit, -0.25);
  L.outfitLight = shade(L.outfit, 0.22);
  L.outfit2 = L.outfit2 || shade(L.outfit, -0.5);
  L.boots = L.boots || '#3a2a20';
  L.cape = L.cape || shade(L.outfit, -0.35);
  L.scarf = L.scarf || shade(L.outfit, 0.35);
  L.hatColor = L.hatColor || '#3a2060';
  return L;
}

function drawFigure(ctx, L, dir, f) {
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(x + CHAR_OX, y + CHAR_OY, w, h); };
  const p = (x, y, c) => r(x, y, 1, 1, c);
  const S = L.skin, Ss = L.skinShade, H = L.hair, Hs = L.hairShade, Hl = L.hairLight;
  const O = L.outfit, Os = L.outfitShade, Ol = L.outfitLight, P = L.outfit2, B = L.boots;
  const dark = '#1a1424';
  const belt = '#5a3a22', gold = '#e8c040';
  const style = L.hairStyle;

  // ---------------- back layer ----------------
  if (L.gear === 'cape') {
    if (dir === 0) r(4, 10, 8, 7, L.cape);
    if (dir === 2) { r(9, 10, 3, 7, L.cape); p(12, 15, L.cape); p(12, 16, L.cape); }
  }
  if (style === 'long') {
    if (dir === 0) { r(4, 4, 1, 9, H); r(11, 4, 1, 9, H); r(5, 8, 6, 2, Hs); }
    if (dir === 2) { r(9, 4, 3, 9, H); r(11, 6, 1, 6, Hs); }
  }
  if (style === 'braid' && dir === 2) {
    for (let y = 7; y <= 12; y++) r(10, y, 2, 1, y % 2 ? H : Hs);
    p(10, 13, gold);
  }
  if (L.scarf && L.gear === 'scarf' && dir === 2) { r(10, 9, 2, 1, L.scarf); p(12, 10, L.scarf); p(12, 11, shade(L.scarf, -0.2)); }

  // ---------------- legs ----------------
  if (L.gear === 'robe') {
    if (dir === 2) {
      r(5, 14, 6, 4, O); r(5, 17, 6, 1, Os);
      if (f === 1) { r(3, 18, 3, 1, B); } else if (f === 2) { r(8, 18, 3, 1, B); } else { r(5, 18, 3, 1, B); }
    } else {
      r(4, 14, 8, 4, O); r(4, 17, 8, 1, Os);
      if (dir === 0) r(10, 14, 2, 3, Os);
      if (f !== 2) r(5, 18, 2, 1, B);
      if (f !== 1) r(9, 18, 2, 1, B);
    }
  } else if (dir === 2) {
    r(6, 15, 4, 1, P);
    if (f === 0) {
      r(7, 16, 2, 2, P); r(6, 18, 3, 1, B);
    } else {
      const front = f === 1 ? P : shade(P, -0.25), back = f === 1 ? shade(P, -0.25) : P;
      r(9, 16, 2, 2, back); r(9, 18, 2, 1, shade(B, -0.2));
      r(5, 16, 2, 2, front); r(4, 18, 3, 1, B);
    }
  } else {
    r(5, 15, 6, 1, P);
    const ll = f === 1 ? 1 : 0, rl = f === 2 ? 1 : 0;
    r(5, 16, 2, 2 - ll, P); r(5, 18 - ll, 2, 1, B);
    r(9, 16, 2, 2 - rl, P); r(9, 18 - rl, 2, 1, B);
  }

  // ---------------- torso & arms ----------------
  if (dir === 2) {
    r(6, 10, 4, 4, O); r(9, 10, 1, 4, Os);
    if (L.gear !== 'robe') { r(6, 14, 4, 1, belt); }
    else r(6, 13, 4, 1, P);
    if (L.skeleton) { p(7, 11, dark); p(7, 13, dark); }
    // arm swings with the walk cycle
    const hx = f === 1 ? 6 : f === 2 ? 9 : 7;
    r(7, 10, 2, 3, Os);
    if (L.gear === 'armor') r(7, 10, 2, 1, '#c8ccd8');
    r(hx, 13, 2, 1, S);
    if (hx !== 7) { r(hx, 12, 2, 1, Os); }
  } else {
    r(5, 10, 6, 4, O);
    if (dir === 0) { r(10, 10, 1, 4, Os); r(6, 11, 2, 1, Ol); }
    if (L.gear === 'robe') { r(5, 13, 6, 1, P); if (dir === 0) p(7, 13, gold); }
    else { r(5, 14, 6, 1, belt); if (dir === 0) r(7, 14, 2, 1, gold); }
    if (L.skeleton) {
      if (dir === 0) { r(6, 11, 4, 1, dark); r(6, 13, 4, 1, dark); p(7, 12, dark); p(8, 12, dark); }
      else r(7, 10, 2, 4, dark);
    }
    r(4, 10, 1, 3, Os); r(11, 10, 1, 3, Os);
    p(4, 13, S); p(11, 13, S);
    if (L.gear === 'armor') { r(4, 10, 1, 2, '#c8ccd8'); r(11, 10, 1, 2, '#c8ccd8'); p(4, 10, '#eef0f8'); }
    if (L.gear === 'cape' && dir === 1) { r(4, 10, 8, 7, L.cape); r(4, 16, 8, 1, shade(L.cape, -0.25)); }
    if (L.gear === 'cape' && dir === 0) { p(5, 10, L.cape); p(10, 10, L.cape); }
  }

  // ---------------- head ----------------
  r(7, 9, 2, 1, Ss); // neck
  r(5, 3, 6, 5, S);
  r(6, 8, 4, 1, S);
  if (dir === 0) {
    r(10, 4, 1, 3, Ss);
    // eyes
    p(6, 5, dark); p(6, 6, L.eyes);
    p(9, 5, dark); p(9, 6, L.eyes);
    if (L.skeleton) {
      r(6, 7, 4, 1, dark); p(7, 7, '#f0ecdc'); p(9, 7, '#f0ecdc');
    } else {
      r(7, 7, 2, 1, shade(S, -0.2));
      if (L.female) { p(5, 7, mix(S, '#ff6070', 0.35)); p(10, 7, mix(S, '#ff6070', 0.35)); p(7, 7, mix(S, '#c04050', 0.4)); p(8, 7, mix(S, '#c04050', 0.4)); }
      if (L.freckles) { p(6, 7, Ss); p(9, 7, Ss); }
    }
  } else if (dir === 2) {
    p(4, 6, S); // nose
    p(5, 5, dark); p(5, 6, L.eyes);
    p(6, 8, S);
    if (L.female && !L.skeleton) p(6, 7, mix(S, '#ff6070', 0.35));
    if (L.skeleton) { r(5, 7, 2, 1, dark); }
  }

  // ---------------- hair (front layer) ----------------
  if (dir === 0) {
    switch (style) {
      case 'short':
        r(5, 2, 6, 2, H); r(4, 3, 1, 3, H); r(11, 3, 1, 3, H);
        r(5, 4, 2, 1, H); r(8, 4, 3, 1, H); r(6, 2, 2, 1, Hl); break;
      case 'spiky':
        r(4, 2, 8, 2, H); p(4, 1, H); p(6, 0, H); p(6, 1, H); p(8, 1, H); p(9, 0, H); p(11, 1, H);
        p(5, 4, H); p(6, 4, H); p(8, 4, H); p(10, 4, H); p(4, 4, H); p(11, 4, H); r(6, 2, 2, 1, Hl); break;
      case 'shaggy':
        r(4, 2, 8, 3, H); p(4, 5, H); p(5, 5, H); p(10, 5, H); p(11, 5, H); p(7, 5, H);
        r(4, 6, 1, 2, H); r(11, 6, 1, 2, H); r(6, 2, 3, 1, Hl); break;
      case 'swept':
        r(5, 2, 7, 2, H); p(4, 3, H); p(5, 4, H); r(8, 4, 4, 1, H); p(11, 5, H); p(11, 6, H); r(8, 2, 3, 1, Hl); break;
      case 'long':
        r(4, 2, 8, 2, H); r(4, 4, 3, 1, H); r(8, 4, 4, 1, H); r(6, 2, 2, 1, Hl); break;
      case 'braid':
        r(4, 2, 8, 2, H); r(4, 4, 2, 1, H); r(9, 4, 3, 1, H); r(4, 5, 1, 2, H); r(11, 4, 1, 3, H);
        for (let y = 7; y <= 12; y++) p(11, y, y % 2 ? H : Hs);
        p(11, 13, gold); r(6, 2, 2, 1, Hl); break;
      case 'bob':
        r(4, 2, 8, 3, H); r(4, 4, 3, 1, H); r(8, 4, 4, 1, H); r(4, 5, 1, 4, H); r(11, 5, 1, 4, H); r(6, 2, 2, 1, Hl); break;
    }
  } else if (dir === 1) {
    switch (style) {
      case 'short': case 'swept':
        r(5, 2, 6, 6, H); r(4, 3, 1, 4, H); r(11, 3, 1, 4, H); r(6, 2, 3, 1, Hl); r(5, 7, 6, 1, Hs); break;
      case 'spiky':
        r(4, 2, 8, 1, H); r(5, 2, 6, 6, H); r(4, 3, 1, 4, H); r(11, 3, 1, 4, H);
        p(4, 1, H); p(6, 0, H); p(6, 1, H); p(8, 1, H); p(9, 0, H); p(11, 1, H); r(5, 7, 6, 1, Hs); break;
      case 'shaggy':
        r(4, 2, 8, 7, H); r(6, 2, 3, 1, Hl); r(5, 8, 6, 1, Hs); break;
      case 'long':
        r(4, 2, 8, 11, H); r(6, 3, 2, 1, Hl); r(7, 6, 1, 6, Hs); r(4, 12, 8, 1, Hs); break;
      case 'braid':
        r(5, 2, 6, 6, H); r(4, 3, 1, 4, H); r(11, 3, 1, 4, H); r(6, 2, 3, 1, Hl);
        for (let y = 8; y <= 13; y++) r(7, y, 2, 1, y % 2 ? H : Hs);
        r(7, 14, 2, 1, gold); break;
      case 'bob':
        r(4, 2, 8, 7, H); r(6, 2, 3, 1, Hl); r(4, 8, 8, 1, Hs); break;
    }
  } else if (dir === 2) {
    switch (style) {
      case 'short': case 'braid':
        r(5, 2, 6, 2, H); p(5, 4, H); p(8, 4, H); r(9, 4, 2, 3, H); r(7, 2, 2, 1, Hl); break;
      case 'spiky':
        r(5, 2, 6, 2, H); p(5, 1, H); p(7, 0, H); p(7, 1, H); p(9, 1, H); p(10, 0, H); p(11, 2, H); p(11, 3, H);
        p(4, 3, H); p(5, 4, H); p(8, 4, H); r(9, 4, 2, 3, H); r(7, 2, 2, 1, Hl); break;
      case 'shaggy':
        r(4, 2, 7, 3, H); r(9, 5, 2, 3, H); p(11, 4, H); r(6, 2, 3, 1, Hl); break;
      case 'swept':
        r(5, 2, 6, 2, H); p(4, 3, H); p(4, 2, H); p(3, 3, H); p(8, 4, H); r(9, 4, 2, 3, H); r(6, 2, 3, 1, Hl); break;
      case 'long':
        r(5, 2, 6, 2, H); p(5, 4, H); p(8, 4, H); r(9, 4, 2, 3, H); r(7, 2, 2, 1, Hl); break;
      case 'bob':
        r(5, 2, 6, 2, H); p(5, 4, H); p(8, 4, H); r(9, 4, 2, 5, H); r(7, 2, 2, 1, Hl); break;
    }
    if (style !== 'none' && style !== 'bob' && style !== 'long') { p(8, 5, Ss); p(8, 6, Ss); }
  }

  // ---------------- ears, beard, scarf, hats ----------------
  if (L.ears) {
    const big = L.ears === 'goblin';
    if (dir === 0 || dir === 1) {
      p(4, 5, S); p(3, 4, S); p(11, 5, S); p(12, 4, S);
      if (big) { p(2, 3, S); p(13, 3, S); p(3, 5, Ss); p(12, 5, Ss); }
    } else {
      p(8, 5, S); p(9, 4, S); p(10, 3, S);
      if (big) { p(11, 2, S); p(9, 5, Ss); }
    }
  }
  if (L.beard) {
    if (dir === 0) { r(5, 7, 6, 2, H); r(6, 9, 4, 1, H); r(7, 7, 2, 1, Hs); r(6, 8, 1, 1, Hl); }
    if (dir === 2) { r(5, 7, 4, 2, H); r(5, 9, 3, 1, H); p(6, 7, Hs); }
  }
  if (L.gear === 'scarf') {
    const sc = L.scarf, scs = shade(L.scarf, -0.2);
    if (dir === 0) { r(5, 8, 6, 2, sc); r(5, 9, 6, 1, scs); }
    if (dir === 1) { r(5, 8, 6, 2, sc); r(9, 10, 1, 3, scs); }
    if (dir === 2) { r(5, 8, 5, 2, sc); p(5, 9, scs); }
  }
  if (L.hat === 'witch') {
    const hc = L.hatColor, hs = shade(hc, -0.3), band = '#c8a040';
    if (dir === 2) {
      r(2, 3, 11, 1, hs); r(5, 2, 7, 1, band); r(6, 1, 5, 1, hc); r(7, 0, 4, 1, hc);
      r(8, -1, 3, 1, hc); r(9, -2, 3, 1, hc); r(11, -3, 2, 1, hc);
    } else {
      r(2, 3, 12, 1, hs); r(4, 2, 8, 1, band); r(5, 1, 6, 1, hc); r(6, 0, 4, 1, hc);
      r(7, -1, 3, 1, hc); r(8, -2, 2, 1, hc); r(9, -3, 2, 1, hc);
      if (dir === 0) p(8, 2, '#fff0a0');
    }
  }
  if (L.crown) {
    if (dir === 2) { r(5, 1, 6, 2, gold); p(5, 0, gold); p(8, 0, gold); p(10, 0, gold); }
    else { r(5, 1, 6, 2, gold); p(5, 0, gold); p(7, 0, gold); p(8, 0, gold); p(10, 0, gold); if (dir === 0) p(7, 2, '#e03040'); }
  }

  // ---------------- weapon ----------------
  if (L.weapon && WEAPON_ART[L.weapon]) {
    const art = WEAPON_ART[L.weapon];
    const ww = art[0].length, wh = art.length;
    let cx = 12, bottom = 15;
    if (dir === 1) { cx = 3; bottom = 14; }
    if (dir === 2) { cx = 4; bottom = 15; }
    drawPixelMap(ctx, art, WEAPON_PAL, cx - Math.floor(ww / 2) + CHAR_OX, bottom - wh + 1 + CHAR_OY);
  }
}

function buildCharacter(look) {
  const L = normalizeLook(look);
  const frames = [[], [], [], []];
  for (let dir = 0; dir < 3; dir++) {
    for (let f = 0; f < 3; f++) {
      const c = makeCanvas(CHAR_W, CHAR_H);
      drawFigure(c.getContext('2d'), L, dir, f);
      addOutline(c);
      frames[dir][f] = c;
    }
  }
  for (let f = 0; f < 3; f++) frames[3][f] = mirrorCanvas(frames[2][f]);
  return { frames, w: CHAR_W, h: CHAR_H, ox: 13, oy: 24, flash: new Map() };
}

// Head-only portrait (for HUD / dialog)
function buildPortrait(sprite) {
  const c = makeCanvas(16, 14);
  c.getContext('2d').drawImage(sprite.frames[0][0], -5, -3);
  return c;
}

// ---------------------------------------------------------------------------
// Monsters
// ---------------------------------------------------------------------------

const SLIME_COLORS = [
  { base: '#5ac050', dark: '#3a8a38', light: '#a8f090' },
  { base: '#4a8ae0', dark: '#2f5fb0', light: '#a0d0ff' },
  { base: '#e05a50', dark: '#a8383a', light: '#ffa8a0' },
];

function buildSlime(colorIdx) {
  const col = SLIME_COLORS[colorIdx];
  const frames = [];
  for (let f = 0; f < 2; f++) {
    const c = makeCanvas(20, 16);
    const ctx = c.getContext('2d');
    const rx = f === 0 ? 7 : 8, ry = f === 0 ? 5.5 : 4.5;
    const cx = 10, cy = 14.5 - ry;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 20; x++) {
        const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
        if (y + 0.5 > 15) continue;
        if (dx * dx + dy * dy <= 1 || (y + 0.5 > cy && Math.abs(dx) <= 1)) {
          let color = col.base;
          if (y + 0.5 > cy + ry * 0.45) color = col.dark;
          if (dx < -0.2 && dy < -0.3 && dx * dx + dy * dy > 0.35) color = col.light;
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    const ey = Math.round(cy);
    ctx.fillStyle = '#1a1424';
    ctx.fillRect(7, ey - 1, 1, 2);
    ctx.fillRect(12, ey - 1, 1, 2);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(7, ey - 1, 1, 1);
    ctx.fillRect(12, ey - 1, 1, 1);
    addOutline(c);
    frames.push(c);
  }
  return { frames: [frames, frames, frames, frames], w: 20, h: 16, ox: 10, oy: 15, flash: new Map(), anim: 'bounce' };
}

function buildBat() {
  const halves = [
    ['........', 'd.......', 'dd....k.', 'ddd..kkk', 'dddd.kek', '.ddddkkk', '..dd.kkk', '......kk', '........'],
    ['........', '........', '......k.', '.....kkk', '...ddkek', '.dddddkk', 'ddd.ddkk', 'dd....kk', 'd.......'],
  ];
  const pal = { d: '#6a4a8a', k: '#3a2a4a', e: '#ff4040' };
  const frames = halves.map((half) => {
    const rows = half.map((h) => h + h.split('').reverse().join(''));
    const c = makeCanvas(18, 11);
    drawPixelMap(c.getContext('2d'), rows, pal, 1, 1);
    addOutline(c);
    return c;
  });
  return { frames: [frames, frames, frames, frames], w: 18, h: 11, ox: 9, oy: 10, flash: new Map(), anim: 'flap' };
}

const MONSTER_LOOKS = {
  goblin: { skin: '#6aa84f', hair: '#2a2a2a', hairStyle: 'none', ears: 'goblin', outfit: '#7a5a3a', outfit2: '#5a4028', eyes: '#e0e020', weapon: 'dagger' },
  skeleton: { skin: '#e8e4d4', skinShade: '#c4bca8', hairStyle: 'none', outfit: '#e8e4d4', outfit2: '#d8d4c4', boots: '#c4bca8', eyes: '#ff3030', skeleton: true, weapon: 'sword' },
  skelArcher: { skin: '#e8e4d4', skinShade: '#c4bca8', hairStyle: 'none', outfit: '#e8e4d4', outfit2: '#d8d4c4', boots: '#c4bca8', eyes: '#40ff80', skeleton: true, weapon: 'bow' },
  ogre: { skin: '#8aa060', hair: '#5a3020', hairStyle: 'shaggy', beard: true, eyes: '#ff4020', outfit: '#7a3020', outfit2: '#4a2a1a', gear: 'armor', crown: true, weapon: 'axe' },
};

const SPRITE_CACHE = {};
function getMonsterSprite(kind, color) {
  const key = kind + (color || 0);
  if (SPRITE_CACHE[key]) return SPRITE_CACHE[key];
  let s;
  if (kind === 'slime') s = buildSlime(color || 0);
  else if (kind === 'bat') s = buildBat();
  else s = buildCharacter(MONSTER_LOOKS[kind]);
  SPRITE_CACHE[key] = s;
  return s;
}

function getFlashFrame(sprite, frame) {
  let w = sprite.flash.get(frame);
  if (!w) { w = whiteVersion(frame); sprite.flash.set(frame, w); }
  return w;
}

// ---------------------------------------------------------------------------
// Tiles
// ---------------------------------------------------------------------------

const T = {
  GRASS: 0, FLOWERS: 1, TALLGRASS: 2, PATH: 3, WATER: 4, TREE: 5, ROCK: 6, WALL: 7, ROOF: 8,
  DOOR: 9, FENCE: 10, STONE: 11, RUIN: 12, BRIDGE: 13, DARKGRASS: 14, WELL: 15, PINE: 16,
  SAND: 17, WINDOW: 18, TOMB: 19,
};

const SOLID_TILES = new Set([T.WATER, T.TREE, T.ROCK, T.WALL, T.ROOF, T.DOOR, T.FENCE, T.RUIN, T.WELL, T.PINE, T.WINDOW, T.TOMB]);
// Tiles that stop projectiles (water does not).
const BLOCK_SHOTS = new Set([T.TREE, T.ROCK, T.WALL, T.ROOF, T.DOOR, T.RUIN, T.PINE, T.WINDOW]);

const MINIMAP_COLORS = {
  [T.GRASS]: '#5a9a3a', [T.FLOWERS]: '#6aa84a', [T.TALLGRASS]: '#4f8f34', [T.PATH]: '#c8a870',
  [T.WATER]: '#3a78d0', [T.TREE]: '#245f20', [T.ROCK]: '#8a8a92', [T.WALL]: '#b08050', [T.ROOF]: '#b04030',
  [T.DOOR]: '#6a3a1a', [T.FENCE]: '#9a6a3a', [T.STONE]: '#8a8a8a', [T.RUIN]: '#6a6a72', [T.BRIDGE]: '#9a6a3a',
  [T.DARKGRASS]: '#3f7a30', [T.WELL]: '#9a9aa0', [T.PINE]: '#1f4a30', [T.SAND]: '#e0c890', [T.WINDOW]: '#b08050',
  [T.TOMB]: '#9a9aa8',
};

function paintTile(ctx, world, tx, ty, rnd) {
  const t = world.get(tx, ty);
  const X = tx * TILE, Y = ty * TILE;
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(X + x, Y + y, w, h); };
  const p = (x, y, c) => r(x, y, 1, 1, c);
  const speckle = (n, colors) => { for (let i = 0; i < n; i++) p((rnd() * 16) | 0, (rnd() * 16) | 0, colors[(rnd() * colors.length) | 0]); };
  const forest = world.isForest(tx, ty);
  const grassBase = () => {
    if (forest) { r(0, 0, 16, 16, '#3f7a30'); speckle(14, ['#4a8a38', '#336a26', '#46823a']); }
    else { r(0, 0, 16, 16, '#5a9a3a'); speckle(14, ['#6ab04a', '#4a8a30', '#62a642']); }
  };
  const circle = (cx, cy, rad, fn) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d <= rad) fn(x, y, d);
    }
  };

  switch (t) {
    case T.GRASS: case T.DARKGRASS: grassBase(); break;
    case T.FLOWERS: {
      grassBase();
      const cols = ['#f0e060', '#f080a0', '#ffffff', '#a0a0ff', '#ff9050'];
      for (let i = 0; i < 3; i++) {
        const x = 2 + ((rnd() * 12) | 0), y = 2 + ((rnd() * 12) | 0);
        const c = cols[(rnd() * cols.length) | 0];
        p(x - 1, y, c); p(x + 1, y, c); p(x, y - 1, c); p(x, y + 1, c); p(x, y, '#f8d040');
      }
      break;
    }
    case T.TALLGRASS: {
      grassBase();
      for (let i = 0; i < 6; i++) {
        const x = 1 + ((rnd() * 14) | 0), y = 4 + ((rnd() * 10) | 0);
        const c = forest ? '#2a5a20' : '#3f7a28';
        r(x, y, 1, 3, c); p(x - 1, y + 1, c); p(x + 1, y + 1, c); p(x, y - 1, forest ? '#5a9a48' : '#8ac860');
      }
      break;
    }
    case T.PATH: {
      r(0, 0, 16, 16, '#c8a870');
      speckle(10, ['#b09058', '#d8b880', '#a88850']);
      // soften edges against grass
      const edge = (nx, ny, fn) => { const n = world.get(nx, ny); if (n !== T.PATH && n !== T.BRIDGE && n !== T.SAND) fn(); };
      const g = forest ? '#3f7a30' : '#5a9a3a';
      edge(tx, ty - 1, () => { for (let x = 0; x < 16; x++) if (rnd() < 0.5) p(x, 0, g); });
      edge(tx, ty + 1, () => { for (let x = 0; x < 16; x++) if (rnd() < 0.5) p(x, 15, g); });
      edge(tx - 1, ty, () => { for (let y = 0; y < 16; y++) if (rnd() < 0.5) p(0, y, g); });
      edge(tx + 1, ty, () => { for (let y = 0; y < 16; y++) if (rnd() < 0.5) p(15, y, g); });
      break;
    }
    case T.SAND: r(0, 0, 16, 16, '#e0c890'); speckle(10, ['#d0b478', '#f0dca8']); break;
    case T.WATER: {
      r(0, 0, 16, 16, '#3a78d0');
      for (let i = 0; i < 3; i++) { const x = (rnd() * 12) | 0, y = 2 + ((rnd() * 12) | 0); r(x, y, 4, 1, '#5a98e8'); }
      speckle(4, ['#2f64b8']);
      const up = world.get(tx, ty - 1);
      if (up !== T.WATER && up !== T.BRIDGE) { r(0, 0, 16, 2, '#a0c8f0'); r(0, 2, 16, 1, '#6aa0e8'); }
      break;
    }
    case T.BRIDGE: {
      r(0, 0, 16, 16, '#9a6a3a');
      for (let x = 0; x < 16; x += 4) r(x, 2, 1, 12, '#6a4420');
      r(0, 0, 16, 2, '#5a3a1a'); r(0, 14, 16, 2, '#5a3a1a');
      speckle(4, ['#b08050']);
      break;
    }
    case T.TREE: {
      grassBase();
      circle(8, 14.5, 5, (x, y) => { if (y > 12) p(x, y, 'rgba(0,0,0,0.25)'); });
      r(7, 10, 2, 5, '#6a4020'); p(7, 10, '#4a2a14');
      const lc = forest ? ['#2a6a26', '#1f5220', '#3a8a34'] : ['#2f7a2a', '#245f20', '#4a9a3a'];
      circle(8, 6.5, 7.2, (x, y, d) => { if (d > 6.4) p(x, y, '#173a14'); });
      circle(8, 6.5, 6.4, (x, y) => {
        let c = lc[0];
        if (x + y > 15) c = lc[1];
        if (x + y < 8) c = lc[2];
        p(x, y, c);
      });
      for (let i = 0; i < 5; i++) { const x = 3 + ((rnd() * 10) | 0), y = 2 + ((rnd() * 8) | 0); p(x, y, lc[2]); }
      break;
    }
    case T.PINE: {
      grassBase();
      r(7, 13, 2, 3, '#5a3a1a');
      const c0 = '#1f5a3a', cl = '#2f7a4a', cd = '#174a2e';
      for (let y = 0; y < 14; y++) {
        const seg = y % 5;
        const half = Math.min(7, Math.floor(y * 0.45) + seg * 0.6 + 0.5) | 0;
        if (half < 1 && y > 0) continue;
        for (let x = 8 - half - 1; x <= 8 + half; x++) {
          if (x < 0 || x > 15) continue;
          let c = c0;
          if (x < 8 - half + 1) c = cl;
          if (x > 8 + half - 2) c = cd;
          p(x, y, c);
        }
      }
      p(7, 0, cl); p(8, 0, c0);
      break;
    }
    case T.ROCK: {
      grassBase();
      circle(8, 9, 6.5, (x, y, d) => {
        if (y < 3) return;
        let c = '#8a8a92';
        if (d > 5.6) c = '#3a3a44';
        else if (x + y < 13) c = '#b0b0b8';
        else if (x + y > 19) c = '#6a6a72';
        p(x, y, c);
      });
      break;
    }
    case T.WALL: case T.WINDOW: case T.DOOR: {
      r(0, 0, 16, 16, '#b08050');
      for (let y = 3; y < 16; y += 4) r(0, y, 16, 1, '#8a6038');
      r(0, 0, 1, 16, '#6a4020'); r(15, 0, 1, 16, '#6a4020');
      if (t === T.WINDOW) {
        r(4, 4, 8, 7, '#6a4020'); r(5, 5, 6, 5, '#3a5a8a'); r(7, 5, 1, 5, '#6a4020'); r(5, 7, 6, 1, '#6a4020');
        p(5, 5, '#8ab0e0'); p(8, 5, '#8ab0e0');
      }
      if (t === T.DOOR) {
        r(4, 2, 8, 14, '#4a2a14'); r(5, 3, 6, 13, '#6a3a1a');
        r(7, 3, 1, 13, '#4a2a14'); p(10, 9, '#e0c040');
      }
      break;
    }
    case T.ROOF: {
      r(0, 0, 16, 16, '#b04030');
      for (let y = 0; y < 16; y += 4) {
        r(0, y + 3, 16, 1, '#8a3024');
        const off = (y / 4) % 2 ? 0 : 4;
        for (let x = off; x < 16; x += 8) { r(x, y, 1, 3, '#8a3024'); p(x + 1, y, '#c85a40'); }
      }
      if (world.get(tx, ty + 1) !== T.ROOF) { r(0, 13, 16, 3, '#6a2018'); }
      if (world.get(tx, ty - 1) !== T.ROOF) { r(0, 0, 16, 2, '#d06a4a'); }
      break;
    }
    case T.FENCE: {
      grassBase();
      const horiz = [T.FENCE].includes(world.get(tx - 1, ty)) || [T.FENCE].includes(world.get(tx + 1, ty));
      if (horiz) {
        r(0, 6, 16, 2, '#b08050'); r(0, 10, 16, 2, '#b08050');
        r(2, 4, 2, 10, '#9a6a3a'); r(12, 4, 2, 10, '#9a6a3a'); p(2, 4, '#c89a60'); p(12, 4, '#c89a60');
      } else {
        r(7, 0, 2, 16, '#b08050'); r(6, 2, 4, 2, '#9a6a3a'); r(6, 10, 4, 2, '#9a6a3a');
      }
      break;
    }
    case T.STONE: {
      r(0, 0, 16, 16, '#8a8a8a');
      r(0, 0, 16, 1, '#6a6a6a'); r(0, 0, 1, 16, '#6a6a6a'); r(8, 0, 1, 8, '#6a6a6a'); r(0, 8, 16, 1, '#6a6a6a'); r(4, 8, 1, 8, '#6a6a6a'); r(12, 8, 1, 8, '#6a6a6a');
      speckle(6, ['#9a9a9a', '#7a7a7a']);
      if (rnd() < 0.3) { const x = (rnd() * 12) | 0, y = (rnd() * 12) | 0; r(x, y, 3, 2, '#5a7a4a'); p(x + 1, y - 1, '#6a8a5a'); }
      if (rnd() < 0.25) { const x = 2 + ((rnd() * 10) | 0), y = 2 + ((rnd() * 10) | 0); p(x, y, '#4a4a4a'); p(x + 1, y + 1, '#4a4a4a'); p(x + 1, y + 2, '#4a4a4a'); }
      break;
    }
    case T.RUIN: {
      r(0, 0, 16, 16, '#9a9aa0');
      for (let y = 0; y < 16; y += 4) {
        r(0, y + 3, 16, 1, '#5a5a62');
        const off = (y / 4) % 2 ? 2 : 6;
        for (let x = off; x < 16; x += 8) r(x, y, 1, 3, '#5a5a62');
      }
      r(0, 0, 16, 1, '#c0c0c8');
      if (rnd() < 0.4) { const x = (rnd() * 12) | 0; r(x, 0, 4, 2, '#5a8a4a'); p(x + 1, 2, '#5a8a4a'); }
      break;
    }
    case T.WELL: {
      r(0, 0, 16, 16, '#c8a870');
      circle(8, 8.5, 7, (x, y, d) => {
        let c = '#9a9aa0';
        if (d > 6.2) c = '#3a3a44'; else if (d < 4) c = '#1a3a6a'; else if (y < 8) c = '#b8b8c0';
        p(x, y, c);
      });
      p(6, 7, '#5a88d0'); p(7, 7, '#5a88d0');
      break;
    }
    case T.TOMB: {
      grassBase();
      r(4, 5, 8, 10, '#9a9aa8'); r(5, 4, 6, 1, '#9a9aa8'); r(6, 3, 4, 1, '#9a9aa8');
      r(11, 5, 1, 10, '#7a7a88'); r(4, 14, 8, 1, '#7a7a88');
      r(7, 6, 2, 6, '#5a5a68'); r(6, 7, 4, 2, '#5a5a68');
      r(3, 15, 10, 1, '#2a3a20');
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Small UI icons for skills (drawn at 12x12 then scaled)
// ---------------------------------------------------------------------------
const SKILL_ICON_ART = {
  whirlwind: ['....wwww....', '..ww....ww..', '.w..wwww..w.', 'w..w....w..w', 'w.w..ww..w.w', 'w.w.w..w.w.w', 'w.w.w..w.w.w', 'w.w..w...w.w', 'w..w.....w..', '.w..wwww....', '..ww........', '....wwww....'],
  shieldBash: ['............', '..ssssssss..', '.sggggggggs.', '.sgssssssgs.', '.sgsggggsgs.', '.sgsggggsgs.', '.sgsggggsgs.', '..sgssssgs..', '..sggggggs..', '...sggggs...', '....ssss....', '............'],
  battleCry: ['.....rr.....', '....rrrr....', '....rrrr....', '.....rr.....', '..r..rr..r..', '.r...rr...r.', 'r....rr....r', '.r..rrrr..r.', '..r.r..r.r..', '....r..r....', '...rr..rr...', '............'],
  secondWind: ['............', '..gg....gg..', '.gggg..gggg.', 'gggggggggggg', 'ggggggGggggg', 'gggggGGGgggg', '.gggggGggggg', '..gggggggg..', '...gggggg...', '....gggg....', '.....gg.....', '............'],
  fireball: ['......r.....', '.....rr..r..', '...r.ror.r..', '...rroorrr..', '..rrooyoorr.', '..rooyyyor..', '.rrooyyyoor.', '.rrooyyyoor.', '..rrooyoorr.', '...rroooor..', '....rrrrr...', '............'],
  frostNova: ['.....c......', '..c..c..c...', '...c.c.c....', '....ccc.....', 'cccccwccccc.', '....ccc.....', '...c.c.c....', '..c..c..c...', '.....c......', '............', '............', '............'],
  chainLightning: ['.......yy...', '......yy....', '.....yy.....', '....yyyyyy..', '.......yy...', '......yy....', '.....yyyyy..', '........yy..', '.......yy...', '......y.....', '.....y......', '............'],
  blink: ['............', '...pppppp...', '..p......p..', '.p..pppp..p.', '.p.p....p.p.', '.p.p.ww.p.p.', '.p.p.ww.p.p.', '.p.p....p.p.', '.p..pppp..p.', '..p......p..', '...pppppp...', '............'],
  multishot: ['..s.....s...', '...s...s....', '....s.s.....', 's....s....s.', '.ssssssssss.', '....s.s.....', '...h...h....', '..h.....h...', '.h.......h..', '............', '............', '............'],
  piercingShot: ['............', '............', '..........s.', '.........sss', 'hhhhhhhhhsss', '.........sss', '..........s.', '............', 'c...c...c...', '............', '............', '............'],
  healingHerb: ['.....gg.....', '....gGGg....', '...gGggGg...', '..gGg..gGg..', '..gG....Gg..', '...g.hh.g...', '.....hh.....', '.....hh.....', '....hhhh....', '............', '............', '............'],
  roll: ['............', '....oooo....', '...o....o...', '..o......o..', '..o..oo..o..', '..o.o..o.o..', '..o.o.....o.', '..o..o....o.', '...o..ooo.o.', '....o....o..', '.....oooo...', '............'],
  fanOfKnives: ['.....s......', '..s..s..s...', '...s.s.s....', '....sss.....', 'sssss.sssss.', '....sss.....', '...s.s.s....', '..s..s..s...', '.....s......', '............', '............', '............'],
  shadowStep: ['............', '.....pp.....', '....pppp....', '....pppp....', '.....pp.....', '...pppppp...', '..p.pppp.p..', '....pppp....', '....p..p....', '...pp..pp...', '............', '............'],
  smokeBomb: ['........r...', '.......r....', '.....kkk....', '....kkkkk...', '...kkkkkkk..', '...kkkkkkk..', '...kkkkkkk..', '....kkkkk...', '.....kkk....', '..w......w..', '.w..w..w..w.', '............'],
  poisonBlade: ['..........s.', '.........ss.', '........ss..', '.......ss...', '......ss....', '.....ss.....', '..g.ss......', '.gGgs.......', '.gGgh.......', '..gh........', '.hh.........', '............'],
};
const SKILL_ICON_PAL = {
  w: '#e8f0ff', s: '#c0c8d8', g: '#60d070', G: '#2f8a40', r: '#e04030', o: '#ff9030', y: '#ffe060',
  c: '#80d0ff', p: '#b070ff', h: '#8a5a2a', k: '#6a6a78',
};

function skillIcon(id, scale = 3) {
  const small = makeCanvas(14, 14);
  drawPixelMap(small.getContext('2d'), SKILL_ICON_ART[id], SKILL_ICON_PAL, 1, 1);
  addOutline(small);
  const c = makeCanvas(14 * scale, 14 * scale);
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, 14 * scale, 14 * scale);
  return c;
}
