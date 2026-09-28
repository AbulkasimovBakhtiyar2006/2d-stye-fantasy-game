'use strict';
// ---------------------------------------------------------------------------
// Static game data: palettes, classes, weapons, skills, characters, enemies.
// ---------------------------------------------------------------------------

const TILE = 16;
const SCALE = 3;
const VIEW_W = 960;
const VIEW_H = 540;

const SKIN_TONES = [
  { name: 'Light',   base: '#ffdcc4', shade: '#e8b89c' },
  { name: 'Fair',    base: '#f1c9a0', shade: '#d6a57a' },
  { name: 'Tan',     base: '#d9a066', shade: '#b87d48' },
  { name: 'Bronze',  base: '#b5774a', shade: '#925a33' },
  { name: 'Brown',   base: '#8d5a36', shade: '#6c4026' },
  { name: 'Deep',    base: '#5c3a24', shade: '#43291a' },
  { name: 'Frost',   base: '#b7c6f0', shade: '#8d9fd6' },
  { name: 'Verdant', base: '#a8d8a0', shade: '#80b578' },
];

const HAIR_COLORS = [
  { name: 'Black',    c: '#2a2230' },
  { name: 'Brown',    c: '#5a3825' },
  { name: 'Chestnut', c: '#8a4b2a' },
  { name: 'Blonde',   c: '#e8c35a' },
  { name: 'Red',      c: '#b8402c' },
  { name: 'Silver',   c: '#d8d8e4' },
  { name: 'Azure',    c: '#3a6fd0' },
  { name: 'Jade',     c: '#3f9b5a' },
];

const EYE_COLORS = [
  { name: 'Brown',  c: '#6a3a1a' },
  { name: 'Blue',   c: '#2f6fd6' },
  { name: 'Green',  c: '#2f9a4a' },
  { name: 'Amber',  c: '#d08a1a' },
  { name: 'Violet', c: '#8a4fd0' },
  { name: 'Grey',   c: '#6a7a8a' },
];

const OUTFIT_COLORS = [
  { name: 'Crimson',  c: '#b8303a' },
  { name: 'Royal',    c: '#3050b0' },
  { name: 'Forest',   c: '#2f7a3f' },
  { name: 'Violet',   c: '#6a3aa0' },
  { name: 'Gold',     c: '#c09030' },
  { name: 'Teal',     c: '#208a8a' },
  { name: 'Charcoal', c: '#404050' },
  { name: 'Ivory',    c: '#d8d4c8' },
];

// Hair styles available to the (male) hero in the creator.
const HERO_HAIR_STYLES = [
  { id: 'short',  name: 'Short' },
  { id: 'spiky',  name: 'Spiky' },
  { id: 'shaggy', name: 'Shaggy' },
  { id: 'swept',  name: 'Swept' },
];

const CLASSES = {
  warrior: {
    name: 'Warrior',
    desc: 'A sturdy frontliner. High health and defense, strong with heavy melee weapons.',
    hp: 140, mp: 40, atk: 1.15, def: 3, speed: 66, crit: 0.05, mpRegen: 2.5,
    hpG: 14, mpG: 3, atkG: 0.08,
    gear: 'armor', affinity: ['sword', 'axe', 'spear'],
    skills: ['whirlwind', 'shieldBash', 'battleCry', 'secondWind'],
    weapon: 'sword', outfit: 0,
  },
  mage: {
    name: 'Mage',
    desc: 'Master of the arcane. Fragile, but huge mana pool and devastating spells.',
    hp: 85, mp: 120, atk: 1.0, def: 1, speed: 68, crit: 0.06, mpRegen: 6,
    hpG: 7, mpG: 10, atkG: 0.09,
    gear: 'robe', affinity: ['staff', 'wand'],
    skills: ['fireball', 'frostNova', 'chainLightning', 'blink'],
    weapon: 'staff', outfit: 3,
  },
  ranger: {
    name: 'Ranger',
    desc: 'A swift hunter of the wilds. Excels at range and keeps the party alive.',
    hp: 105, mp: 60, atk: 1.1, def: 2, speed: 76, crit: 0.12, mpRegen: 3.5,
    hpG: 10, mpG: 5, atkG: 0.08,
    gear: 'cape', affinity: ['bow', 'spear'],
    skills: ['multishot', 'piercingShot', 'healingHerb', 'roll'],
    weapon: 'bow', outfit: 2,
  },
  rogue: {
    name: 'Rogue',
    desc: 'A shadow with a blade. Very fast, deadly critical hits and tricky skills.',
    hp: 95, mp: 60, atk: 1.05, def: 1, speed: 84, crit: 0.22, mpRegen: 3.5,
    hpG: 9, mpG: 5, atkG: 0.085,
    gear: 'scarf', affinity: ['dagger', 'sword'],
    skills: ['fanOfKnives', 'shadowStep', 'smokeBomb', 'poisonBlade'],
    weapon: 'dagger', outfit: 6,
  },
};

const WEAPONS = {
  sword:  { name: 'Iron Sword',   type: 'melee',  dmg: 10, range: 26, arc: 2.0, cd: 0.38, knock: 90,  desc: 'Balanced blade with a wide swing.' },
  axe:    { name: 'Battle Axe',   type: 'melee',  dmg: 17, range: 26, arc: 2.1, cd: 0.64, knock: 150, desc: 'Slow, crushing blows that knock foes back.' },
  spear:  { name: 'Ash Spear',    type: 'melee',  dmg: 11, range: 40, arc: 0.9, cd: 0.46, knock: 80,  desc: 'Long reach, narrow thrust.' },
  dagger: { name: 'Twin Daggers', type: 'melee',  dmg: 7,  range: 20, arc: 1.7, cd: 0.20, knock: 40,  crit: 0.10, desc: 'Lightning-fast stabs, +10% crit.' },
  bow:    { name: 'Longbow',      type: 'ranged', dmg: 9,  range: 220, cd: 0.42, speed: 260, proj: 'arrow', desc: 'Fires arrows from afar.' },
  staff:  { name: 'Oak Staff',    type: 'ranged', dmg: 13, range: 190, cd: 0.60, speed: 190, proj: 'magic', desc: 'Hurls bolts of arcane power.' },
  wand:   { name: 'Crystal Wand', type: 'ranged', dmg: 7,  range: 180, cd: 0.28, speed: 270, proj: 'spark', desc: 'Rapid little sparks of magic.' },
};

const SKILLS = {
  // Warrior
  whirlwind:     { name: 'Whirlwind',      mp: 15, cd: 5,   color: '#e0e0f0', icon: 'W', desc: 'Spin and strike every enemy around you.' },
  shieldBash:    { name: 'Shield Bash',    mp: 10, cd: 4,   color: '#c0a060', icon: 'B', desc: 'Bash enemies in front, stunning them.' },
  battleCry:     { name: 'Battle Cry',     mp: 20, cd: 16,  color: '#ff6040', icon: 'C', desc: 'You and your party deal +50% damage for 8s.' },
  secondWind:    { name: 'Second Wind',    mp: 20, cd: 20,  color: '#60e080', icon: 'H', desc: 'Recover 40% of your health.' },
  // Mage
  fireball:      { name: 'Fireball',       mp: 15, cd: 2.5, color: '#ff8030', icon: 'F', desc: 'Explosive ball of fire.' },
  frostNova:     { name: 'Frost Nova',     mp: 20, cd: 7,   color: '#80d0ff', icon: 'N', desc: 'Freezing blast that slows nearby foes.' },
  chainLightning:{ name: 'Chain Lightning',mp: 18, cd: 4,   color: '#ffff70', icon: 'L', desc: 'Lightning that jumps between enemies.' },
  blink:         { name: 'Blink',          mp: 10, cd: 3,   color: '#c080ff', icon: 'T', desc: 'Teleport a short distance forward.' },
  // Ranger
  multishot:     { name: 'Multishot',      mp: 12, cd: 3,   color: '#d0e080', icon: 'M', desc: 'Loose a fan of five arrows.' },
  piercingShot:  { name: 'Piercing Shot',  mp: 15, cd: 5,   color: '#80ffe0', icon: 'P', desc: 'A heavy arrow that pierces all foes.' },
  healingHerb:   { name: 'Healing Herb',   mp: 20, cd: 15,  color: '#60e080', icon: 'H', desc: 'Heal yourself and your whole party.' },
  roll:          { name: 'Dodge Roll',     mp: 8,  cd: 2.5, color: '#e0c080', icon: 'R', desc: 'Roll forward, briefly invulnerable.' },
  // Rogue
  fanOfKnives:   { name: 'Fan of Knives',  mp: 15, cd: 4,   color: '#c0c8d8', icon: 'K', desc: 'Throw knives in every direction.' },
  shadowStep:    { name: 'Shadow Step',    mp: 12, cd: 4,   color: '#8060c0', icon: 'S', desc: 'Appear behind the nearest foe and strike.' },
  smokeBomb:     { name: 'Smoke Bomb',     mp: 15, cd: 12,  color: '#9090a0', icon: 'O', desc: 'Vanish for 4s. Next hit is a critical.' },
  poisonBlade:   { name: 'Poison Blade',   mp: 15, cd: 14,  color: '#80e040', icon: 'X', desc: 'Your hits poison enemies for 10s.' },
};

// The four heroines who can join your party.
const COMPANIONS = [
  {
    id: 'aria', name: 'Aria', title: 'Elf Archer', role: 'ranged',
    hp: 90, dmg: 8, cd: 0.85, range: 150, proj: 'arrow', speed: 74,
    home: [12, 33],
    look: { skin: '#ffe4d0', skinShade: '#ecc0a4', hair: '#f0d070', hairStyle: 'long', eyes: '#2f9a4a',
            outfit: '#3f8a3a', outfit2: '#6b4a2a', boots: '#4a3020', female: true, ears: 'elf', gear: 'cape', cape: '#2a5a28', weapon: 'bow' },
    intro: [
      'Oh! A traveler. I am Aria of the Silverleaf woods.',
      'The forest east of the river has grown dark. Goblins, bats... and worse.',
      'My arrows are yours. Let us hunt together!',
    ],
  },
  {
    id: 'luna', name: 'Luna', title: 'Moon Priestess', role: 'healer',
    hp: 80, dmg: 6, cd: 1.0, range: 140, proj: 'holy', speed: 72,
    home: [17, 32],
    look: { skin: '#6a4028', skinShade: '#52301c', hair: '#ececf8', hairStyle: 'long', eyes: '#8a4fd0',
            outfit: '#e8e8f0', outfit2: '#5080d0', boots: '#8090b0', female: true, gear: 'robe', weapon: 'staff' },
    intro: [
      'Blessings of the moon upon you.',
      'I am Luna. I tend to the wounded of this village.',
      'Your road looks dangerous. Let me walk it with you and mend your wounds.',
    ],
  },
  {
    id: 'brynn', name: 'Brynn', title: 'Shieldmaiden', role: 'tank',
    hp: 170, dmg: 12, cd: 0.8, range: 18, proj: null, speed: 70,
    home: [28, 33],
    look: { skin: '#f6cfb0', skinShade: '#dcaa88', hair: '#c04a28', hairStyle: 'braid', eyes: '#2f6fd6',
            outfit: '#9aa0b0', outfit2: '#6a3020', boots: '#4a3020', female: true, gear: 'armor', freckles: true, weapon: 'axe' },
    intro: [
      'Ha! You look like you could use a proper shield at your side.',
      'Brynn Stormborn. I have been itching for a real fight for weeks.',
      'Point me at the monsters. I will keep them off your back!',
    ],
  },
  {
    id: 'selene', name: 'Selene', title: 'Hedge Witch', role: 'caster',
    hp: 75, dmg: 11, cd: 1.2, range: 150, proj: 'fire', speed: 72,
    home: [24, 43],
    look: { skin: '#d49a6a', skinShade: '#b27a4c', hair: '#2a1a3a', hairStyle: 'long', eyes: '#d08a1a',
            outfit: '#5a2a8a', outfit2: '#2a1a3a', boots: '#2a1a3a', female: true, gear: 'robe', hat: 'witch', hatColor: '#3a2060', weapon: 'wand' },
    intro: [
      'Mmm? The cards said a stranger would come today.',
      'Selene. Witch, brewer of potions, and setter-of-things-on-fire.',
      'The Ogre King in the old ruins would make a lovely bonfire. Shall we?',
    ],
  },
];

const NPCS = [
  {
    id: 'elder', name: 'Elder Rowan', home: [22, 31],
    look: { skin: '#f1c9a0', skinShade: '#d6a57a', hair: '#e4e4e4', hairStyle: 'short', eyes: '#6a7a8a',
            outfit: '#6a5a8a', outfit2: '#4a3a6a', boots: '#3a2a20', beard: true, gear: 'robe', weapon: 'staff' },
  },
  {
    id: 'merchant', name: 'Tobin the Trader', home: [13, 37],
    look: { skin: '#8d5a36', skinShade: '#6c4026', hair: '#8a8a90', hairStyle: 'short', eyes: '#6a3a1a',
            outfit: '#c08030', outfit2: '#6a4a2a', boots: '#3a2a20', beard: true, weapon: null },
  },
];

const ENEMY_TYPES = {
  slime:      { name: 'Slime',        hp: 22,  dmg: 6,  speed: 30, xp: 6,   gold: [1, 3],   r: 6,  hh: 5,  sight: 90,  atkRange: 8,  atkCd: 1.0, sprite: 'slime', color: 0 },
  blueSlime:  { name: 'Blue Slime',   hp: 45,  dmg: 9,  speed: 36, xp: 12,  gold: [2, 5],   r: 7,  hh: 5,  sight: 100, atkRange: 8,  atkCd: 1.0, sprite: 'slime', color: 1 },
  bat:        { name: 'Cave Bat',     hp: 16,  dmg: 5,  speed: 66, xp: 8,   gold: [1, 3],   r: 6,  hh: 12, sight: 130, atkRange: 8,  atkCd: 0.9, sprite: 'bat', fly: true },
  goblin:     { name: 'Goblin',       hp: 40,  dmg: 9,  speed: 46, xp: 15,  gold: [3, 7],   r: 6,  hh: 12, sight: 120, atkRange: 12, atkCd: 1.1, sprite: 'goblin' },
  skeleton:   { name: 'Skeleton',     hp: 60,  dmg: 12, speed: 40, xp: 22,  gold: [4, 9],   r: 6,  hh: 12, sight: 120, atkRange: 12, atkCd: 1.2, sprite: 'skeleton' },
  skelArcher: { name: 'Bone Archer',  hp: 42,  dmg: 10, speed: 36, xp: 24,  gold: [4, 9],   r: 6,  hh: 12, sight: 150, atkRange: 130, atkCd: 1.8, sprite: 'skelArcher', ranged: true },
  ogreKing:   { name: 'Ogre King',    hp: 900, dmg: 22, speed: 34, xp: 500, gold: [80, 120], r: 13, hh: 26, sight: 170, atkRange: 22, atkCd: 1.4, sprite: 'ogre', boss: true },
};
