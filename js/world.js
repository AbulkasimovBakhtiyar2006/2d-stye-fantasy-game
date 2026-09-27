'use strict';
// ---------------------------------------------------------------------------
// World generation: a hand-shaped but procedurally decorated map.
//   West:  the village of Emberbrook (start), meadows and a lake
//   Middle: the Silverrun river with a bridge
//   East:  Darkwood forest, the old graveyard (south-east),
//          and the Ogre King's ruins (north-east)
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORLD_W = 100;
const WORLD_H = 70;
const RIVER_X = 40;

class World {
  constructor(seed = 1337) {
    this.w = WORLD_W;
    this.h = WORLD_H;
    this.tiles = new Uint8Array(this.w * this.h);
    this.rnd = mulberry32(seed);
    this.generate();
    this.render();
  }

  get(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return T.TREE;
    return this.tiles[y * this.w + x];
  }

  set(x, y, t) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.tiles[y * this.w + x] = t;
  }

  // The forest edge wobbles a little so it doesn't form a straight line.
  isForest(x, y = 0) { return x > RIVER_X + 3 + Math.round(Math.sin(y * 0.45) * 1.5 + Math.sin(y * 1.7)); }

  riverX(y) { return RIVER_X + Math.round(Math.sin(y * 0.15) * 2); }

  generate() {
    const rnd = this.rnd;
    const W = this.w, H = this.h;

    // Base ground
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = rnd();
        let t = this.isForest(x, y) ? T.DARKGRASS : T.GRASS;
        if (v < 0.07) t = T.FLOWERS;
        else if (v < 0.15) t = T.TALLGRASS;
        this.set(x, y, t);
      }
    }

    // Scattered trees & rocks
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = rnd();
        if (this.isForest(x, y)) {
          if (v < 0.13) this.set(x, y, rnd() < 0.55 ? T.PINE : T.TREE);
          else if (v < 0.145) this.set(x, y, T.ROCK);
        } else {
          if (v < 0.035) this.set(x, y, T.TREE);
          else if (v < 0.042) this.set(x, y, T.ROCK);
        }
      }
    }

    // Village clearing
    this.fill(5, 21, 35, 49, () => (rnd() < 0.08 ? T.FLOWERS : T.GRASS));

    // Lake (south-west)
    this.ellipse(14, 59, 8, 4.5, T.SAND);
    this.ellipse(14, 59, 6.5, 3.2, T.WATER);

    // River with sandy banks
    for (let y = 0; y < H; y++) {
      const cx = this.riverX(y);
      this.set(cx - 2, y, T.SAND);
      this.set(cx + 2, y, T.SAND);
      for (let x = cx - 1; x <= cx + 1; x++) this.set(x, y, T.WATER);
    }

    // Main east-west road with a bridge
    for (let x = 4; x <= 62; x++) {
      for (let y = 35; y <= 36; y++) {
        const cur = this.get(x, y);
        this.set(x, y, cur === T.WATER ? T.BRIDGE : cur === T.SAND ? T.BRIDGE : T.PATH);
      }
    }
    this.clearAround(4, 34, 62, 37);
    // Re-lay bridge after clearing (clearAround may touch water tiles)
    for (let x = RIVER_X - 4; x <= RIVER_X + 4; x++) {
      for (let y = 35; y <= 36; y++) if (Math.abs(x - this.riverX(y)) <= 2) this.set(x, y, T.BRIDGE);
    }

    // Village north-south street
    for (let y = 22; y <= 48; y++) { this.set(20, y, T.PATH); this.set(21, y, T.PATH); }

    // Houses
    this.house(8, 26);
    this.house(26, 26);
    this.house(8, 40);
    this.house(27, 40);
    // little paths from doors
    for (let y = 31; y <= 34; y++) { this.set(10, y, T.PATH); this.set(28, y, T.PATH); }
    this.set(10, 45, T.PATH); this.set(29, 45, T.PATH);

    // Well
    this.set(17, 31, T.WELL);

    // Village fences (north and south) with gates
    for (let x = 5; x <= 35; x++) {
      if (x === 20 || x === 21) continue;
      this.set(x, 21, T.FENCE);
      this.set(x, 49, T.FENCE);
    }

    // Road to the ruins: north from the forest crossroads, then east
    for (let y = 13; y <= 36; y++) { this.set(61, y, T.PATH); this.set(62, y, T.PATH); }
    for (let x = 61; x <= 74; x++) { this.set(x, 13, T.PATH); this.set(x, 14, T.PATH); }
    this.clearAround(60, 12, 75, 15);
    this.clearAround(60, 12, 63, 36);
    // Road south to the graveyard
    for (let y = 37; y <= 50; y++) { this.set(61, y, T.PATH); this.set(62, y, T.PATH); }
    for (let x = 62; x <= 68; x++) { this.set(x, 50, T.PATH); this.set(x, 51, T.PATH); }
    this.clearAround(60, 37, 63, 51);
    this.clearAround(60, 49, 69, 52);

    // Graveyard
    this.fill(68, 46, 86, 62, () => (rnd() < 0.15 ? T.TALLGRASS : T.DARKGRASS));
    for (let y = 48; y <= 60; y += 3) {
      for (let x = 71; x <= 84; x += 3) if (rnd() < 0.75) this.set(x, y, T.TOMB);
    }

    // Ruins
    this.fill(73, 4, 95, 24, () => T.STONE);
    for (let x = 73; x <= 95; x++) {
      if (rnd() < 0.8) this.set(x, 4, T.RUIN);
      if (rnd() < 0.8) this.set(x, 24, T.RUIN);
    }
    for (let y = 4; y <= 24; y++) {
      if ((y < 12 || y > 15) && rnd() < 0.85) this.set(73, y, T.RUIN);
      if (rnd() < 0.8) this.set(95, y, T.RUIN);
    }
    // pillars
    for (const [px, py] of [[78, 8], [78, 19], [90, 8], [90, 19], [84, 7], [84, 21]]) this.set(px, py, T.RUIN);
    this.set(74, 13, T.PATH); this.set(74, 14, T.PATH);
    this.set(73, 13, T.PATH); this.set(73, 14, T.PATH);

    // Dense border of trees
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) {
          if (this.get(x, y) !== T.WATER) this.set(x, y, this.isForest(x, y) ? T.PINE : T.TREE);
        }
      }
    }
  }

  fill(x0, y0, x1, y1, fn) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, fn(x, y));
  }

  // Remove obstacles (trees/rocks) in a rectangle, leaving roads/water alone.
  clearAround(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const t = this.get(x, y);
        if (t === T.TREE || t === T.PINE || t === T.ROCK) this.set(x, y, this.isForest(x, y) ? T.DARKGRASS : T.GRASS);
      }
    }
  }

  ellipse(cx, cy, rx, ry, t) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) this.set(x, y, t);
      }
    }
  }

  house(x, y) {
    // 6 wide x 5 tall: 3 rows roof, 2 rows wall with a door and windows.
    for (let j = 0; j < 3; j++) for (let i = 0; i < 6; i++) this.set(x + i, y + j, T.ROOF);
    for (let j = 3; j < 5; j++) for (let i = 0; i < 6; i++) this.set(x + i, y + j, T.WALL);
    this.set(x + 1, y + 3, T.WINDOW);
    this.set(x + 4, y + 3, T.WINDOW);
    this.set(x + 2, y + 4, T.DOOR);
  }

  isSolid(tx, ty) { return SOLID_TILES.has(this.get(tx, ty)); }
  blocksShot(tx, ty) { return BLOCK_SHOTS.has(this.get(tx, ty)); }

  // Solid check for an axis-aligned box in world pixels.
  boxBlocked(x0, y0, x1, y1) {
    const tx0 = Math.floor(x0 / TILE), ty0 = Math.floor(y0 / TILE);
    const tx1 = Math.floor(x1 / TILE), ty1 = Math.floor(y1 / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) if (this.isSolid(tx, ty)) return true;
    return false;
  }

  // Nearest walkable tile center to a tile coordinate.
  findWalkable(tx, ty) {
    for (let rad = 0; rad < 12; rad++) {
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== rad) continue;
          const x = tx + dx, y = ty + dy;
          if (!this.isSolid(x, y) && !this.isSolid(x, y - 1) && !this.isSolid(x - 1, y) && !this.isSolid(x + 1, y)) {
            return { x: x * TILE + 8, y: y * TILE + 12 };
          }
        }
      }
    }
    return { x: tx * TILE + 8, y: ty * TILE + 12 };
  }

  render() {
    this.canvas = makeCanvas(this.w * TILE, this.h * TILE);
    const ctx = this.canvas.getContext('2d');
    const rnd = mulberry32(99);
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) paintTile(ctx, this, x, y, rnd);

    this.minimap = makeCanvas(this.w, this.h);
    const m = this.minimap.getContext('2d');
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        m.fillStyle = MINIMAP_COLORS[this.get(x, y)] || '#000';
        m.fillRect(x, y, 1, 1);
      }
    }
    // cache water tile list for shimmer animation
    this.water = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (this.get(x, y) === T.WATER) this.water.push([x, y, (x * 7 + y * 13) % 17]);
  }
}
