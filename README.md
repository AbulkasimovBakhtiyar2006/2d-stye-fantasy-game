# Emberfall: A Pixel Fantasy Tale

A small 2D top-down action RPG in retro pixel-art style. It runs in any modern browser and needs no install or build step.

All the art (characters, monsters, weapons, tiles and icons) is drawn in code, pixel by pixel. The game ships with no image files.

## How to play

Open `index.html` in a browser. You can also serve the folder locally:

```bash
npx http-server .   # or: python3 -m http.server
```

1. Press **Enter** on the title screen.
2. **Create your hero.** He is a young man, and you can customize him:
   - **Name**
   - **Skin tone** (8 options, including fantasy Frost and Verdant tones)
   - **Hair style** (Short, Spiky, Shaggy, Swept) and **hair color**
   - **Eye color** and **outfit color**
   - **Class**: Warrior, Mage, Ranger or Rogue. Each class has its own stats and outfit (armor, robe, cape or scarf).
   - **Weapon**: any of 7 weapons (sword, axe, spear, daggers, bow, staff, wand). A weapon marked ★ matches your class and deals +20% damage.
   - **Skills**: pick 2 of your class's 4 skills.
3. Talk to **Elder Rowan** in the village. Then recruit the four heroines:
   - **Aria**, Elf Archer. She fires arrows and volleys.
   - **Luna**, Moon Priestess. She heals the party and can stun with holy light.
   - **Brynn**, Shieldmaiden. She is a tank: enemies go after her first, and her axe does a Ground Slam.
   - **Selene**, Hedge Witch. She casts fire bolts and Inferno explosions.
4. Cross the bridge east. Fight through the Darkwood and the graveyard, then defeat the **Ogre King** in the north-east ruins.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move |
| Space / J | Attack (hold to keep attacking) |
| Q / K / 1 | Skill 1 |
| R / L / 2 | Skill 2 |
| F / H / 3 | Drink potion |
| E | Talk / recruit |
| Esc / P | Pause (character sheet) |

## Features

- A procedurally decorated world: a village, a river, a lake, a forest, a graveyard and ruins. The minimap shows where you are.
- Party AI: companions follow you, fight, heal, and get back up after being knocked out.
- 16 skills: whirlwind, fireball, chain lightning, blink, multishot, shadow step, smoke bomb and more.
- Enemies: slimes, bats, goblins, skeletons and bone archers. The Ogre King boss telegraphs ground pounds and summons minions.
- Leveling, gold, hearts, mana orbs and potions. You can buy potions from Tobin the Trader.
- The text uses the bundled [Pixelify Sans](https://github.com/eifetx/Pixelify-Sans) pixel font, so it works offline. The font is under the SIL Open Font License; see `fonts/OFL.txt`.

## Project layout

```
index.html      page and character-creator markup
style.css       styling
js/data.js      classes, weapons, skills, companions, enemies
js/sprites.js   procedural pixel-art renderer (characters, monsters, tiles, icons)
js/world.js     map generation and collision
js/game.js      game loop, combat, AI, HUD, dialog
js/creator.js   character creation screen
fonts/          Pixelify Sans font files and license
```
