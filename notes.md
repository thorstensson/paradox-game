I am building a 2D horizontal space shooter in Phaser 3 using pure JavaScript. We have established a specific architectural blueprint that I need you to stick to for all code generation. Please review the details below before we proceed:

### 📐 Canvas & Scaling Blueprint

- **Canvas:** 1280 x 800 -- 4x the C64 playfield (320 x 200).
- **Window fit:** `Scale.NONE` plus an integer `zoom` (largest whole multiple that fits the window), so the canvas is never stretched by a fractional amount.
- **Clear colour:** `#000000`, framed by the page's `#7488c8` (`style.css`).
- **Sprites (ships, enemies, bullets):** 3x. See **Sprite Scale: 3x** below.
- **Title logo:** 4x.
- **Main font:** Techbase, drawn 1:1 at 27px (all text). See **Fonts** below.
- **Stars:** 1/2/3px screen-pixel dots (`StarField.js`), not on any texel grid.

* **Rendering Rule:** Always apply `pixelArt: true` in the Phaser config. This already forces `NEAREST` filtering globally, so per-object `setFilterMode` calls are not needed.
* **Integer vs non-integer scale:** anything can be drawn at any size. Integer scales keep every pixel the same width; non-integer ones stay hard-edged but make some pixels a screen pixel wider than others, so they read less clean. A choice per asset, not a rule.

### 📦 Asset Pipeline (Vite)

Assets live in **`src/assets/`** and are resolved by Vite at build time, not in `public/`.

- Every asset is imported with an explicit **`?url`** suffix. This is required: without it Vite parses `.json` into a JS object, and does not recognise `.xml` as an asset at all.
- Files under **4096 bytes** (`build.assetsInlineLimit`) are inlined into the JS bundle as base64 data URIs. Phaser 3.80+ supports these — `XHRLoader` decodes `;base64,` payloads via `atob`.
- Larger files are emitted as content-hashed files (e.g. `back-EIYR4omt.png`), which gives free cache-busting.
- Sidecar files are safe under hashing: `load.atlas(key, pngUrl, jsonUrl)` and `load.bitmapFont(key, pngUrl, xmlUrl)` take each URL explicitly, and Phaser's parsers ignore the filename recorded inside the JSON/XML. (The exception is `load.multiatlas`, which _does_ read image names out of the JSON — avoid it.)
- Benefit of this over `public/`: a mistyped path becomes a **build error** instead of a runtime 404, and unreferenced assets are never bundled.

### 📁 Project & Folder Structure

We are using a modular, ES6-module approach splitting files by their functional roles:

obsidion/
├── index.html
├── vite.config.js
├── art/ # Aseprite masters (not loaded by the game)
│ └── player/ # obsidion-ship.aseprite, ship-bullet.aseprite
├── public/
│ └── favicon.png # Only truly static, unprocessed files
│
└── src/
├── main.js # Phaser config, canvas size, clear colour, integer zoom
├── preloader.js # All asset imports + load calls
│
├── assets/ # Structured strictly by runtime function
│ ├── backgrounds/ # Parked: galaxy/, purple-nebula/, planets/, oil6/ -- none loaded
│ ├── player/
│ │ ├── ship/ # obsidion-ship.png + .json (Aseprite atlas)
│ │ └── bullet/ # ship-bullet.png, 8x2
│ └── fonts/
│ ├── scifiadventure.png # Title logo image (OBSIDION only, not a full font)
│ ├── techbase-27.fnt + techbase-27_0.png # main-font, all text (BMFont)
│ └── techbase-18.fnt + techbase-18_0.png # unused
│
├── gameobjects/
│ ├── Player.js # Mouse-steered ship, banking, autofire. SHIP_SCALE = 3
│ ├── PlayerBullets.js # Blitter bullet pool, SCALE = 3
│ └── StarField.js # Procedural Blitter starfield
│
└── scenes/
├── MainScene.js # Game loop; launches MenuScene over itself as the intro
├── MenuScene.js # Intro: logo + PLAYER ONE / CLICK TO START
├── HudScene.js # POINTS + REMAINING
└── GameOverScene.js # GAME OVER + points, holds 3s, fades back to the intro

Enemies get their own folder under `src/assets/enemies/` when the first one is
drawn (see Enemies & Waves).

---

## V1

Everything there is for version 1, in order:

1. **The three levels** -- the bulk of the work, and it will take time.
2. **Audio effects** -- from good sound resources Thomas knows.
3. **Hi-score table on Supabase** -- simple, online only, no local table.

**Domain:** `obsidion-game.io`, registered once all three levels are done.

## Credits

- **Intro screen:** `BY THOMAS THORSTENSSON` along the bottom
  (`MenuScene.js`). The intro is for CV and portfolio, so it carries my name
  only.
- **Ending credits:** after all levels are completed, old-skool, scrolling
  slowly upward. Includes:
    - Graphics by Thomas Thorstensson
    - Code by Thomas Thorstensson & Claude

    Not built yet.

---

## Level Concepts

Four levels sketched.

1. **Deep Space** — stars only.
2. **Ember Caves** — walls of flame, top and bottom.
3. **Osiris Belt** (working title) — an asteroid belt challenge, as in Delta; asteroids drawn in the background, dark lila.
4. **Final level** — the hardest; to be decided.

Backgrounds are to be hand-drawn in Aseprite, indexed, same C64 palette as
the ship.

Draw in Aseprite's **tilemap mode on an 8x8 grid**, even when the output is a
flat image. The 8x8 cell matches the C64's character and bitmap structure,
which is as much of the C64 look as the palette is, and tile-based art is
seamless by construction.

Use a real Phaser tilemap only where geometry is solid and needs collision.
Never for open space — a TileSprite parallax (the approach the removed
`GalaxyBackground` used) is infinite, seamless and one draw call per layer,
which a tilemap cannot beat for a backdrop.

---

## Level 1 Concepts

**Deep Space.** Nothing but space, in the spirit of Nemesis on the C64.

**Nothing to draw for this level.** The stars are already there and they are
_code, not art_ — `src/gameobjects/StarField.js` is a Phaser **Blitter**
(`scene.add.blitter`, batched Bobs), generating its own texture at runtime:
three 1/2/3px white squares, no loaded image at all.

Depth is carried by size, speed and alpha together across three bands, drawn
at `depth: -5`.

So no background texture is needed here — the clear colour (`#000000`, set in
`main.js`) plus the Blitter is the whole level.

---

## Level 2 Concepts

**Ember Caves.** Idea from a level in Delta. The stars stay, as in Delta. Walls of flame
running horizontally along the top and bottom of the screen, looping. All
flame — no rock, no cave edge.

### Wave sequence per level

```
Level 1:  neutron4x - clover - firering - neutron - greywing2x
Level 2:  firecomet (whole level) - emberstar - dragon - delta 2x - neutron4x - New alien2x (b)
```

### Wave Attack Patterns

Named by the motion, not the alien, so any alien can fly any pattern and
patterns come back through the levels, as in Delta. For now each class is
still tied to its alien; they get detached later.

| Pattern          | Motion                                                                                                                                                              | Used in                          | Code              |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ----------------- |
| **sinus-pinch**  | Two mirrored chains, above and below the middle, dip toward each other and pull apart again                                                                         | Level 1 waves 1, 4 (neutron)     | `NeutronWave`     |
| **sinus-center** | One chain enters above or below the middle, swings out, curves onto the centre line and flies straight at the ship                                                  | Level 1 waves 2, 3 (neutron)     | `NeutronDiveWave` |
| **sinus-edges**  | A chain of seven enters just in from the bottom, eases onto the bottom edge and races off; 2s later the same along the top. Fast, a memory test                     | Level 1 wave 5 (clover)          | `CloverWave`      |
| **flame-v**      | Comes out of the flames at the right edge, top and bottom in turn, and flies a straight line to the left edge's centre (a V on its side). 15 at fixed, uneven times | Level 2, whole level (firecomet) | `FirecometTrack`  |
| **block-swing**  | Two mirrored 2x2 blocks, top and bottom, swing between their flames and the centre line while drifting slowly left. Four fire one aimed bullet each                 | Level 2 wave 1 (emberstar)       | `EmberstarWave`   |
| **snake-sine**   | A head and a tail of circles on a slow flame-to-flame sine, each circle following the head's path. Only the head kills it                                           | Level 2 wave 2 (dragon)          | `DragonWave`      |

## Sprite Scale: 3x

**Decided 2026-09-24.** Ships are drawn at **3x**: the player ship, and every
enemy after it. A 32x32 canvas is 96x96 on screen; the ~28x20 hull comes out
around 84x60.

At 4x the ship read a touch too big for the 1280x800 playfield. 3x is still
an integer scale, so every pixel stays the same size and crisp -- the only
trade is that ship pixels are 3px while some other things on screen are not.

In code this is `SHIP_SCALE` in `src/gameobjects/Player.js`. Anything
positioned relative to the ship is written in native ship pixels times the
scale (the muzzle point is `14 * SHIP_SCALE`), so it follows if the scale ever
changes again.

---

## Fonts

**Main font: Techbase** (FontStruct, Omegaville --
https://fontstruct.com/fontstructions/show/2075073/techbase). Used for all
text except the logo. Its grid is 9 bricks, so it is exported at multiples of
9 to keep every brick an even square:

- `techbase-27.fnt` + `techbase-27_0.png` (key `main-font`): 3px per brick,
  all text at 27 -- HUD, intro, pause, level titles and Game Over.

Made with **AngelCode BMFont**: font smoothing off, preset _White text with
alpha_, font descriptor **XML**, textures **png**, **256x256**, one page each
(Phaser's loader reads one page only). The `.fnt` files record a negative
size; `preloader.js` flips it back.

Drawn 1:1 in game. The PNGs are grey-tinted in Photoshop with a Halftone
Pattern (Dot, size 4, contrast ~20); no tint in code, as a tint would
multiply over the painted colour.

**Title logo** is `scifiadventure.png`: the word OBSIDION set in Sci Fi
Adventure, as an image, drawn at 4x with a tint and shine. Not a usable font.

---

## Player Ship

Working master: `art/player/obsidion-ship.aseprite`. 32x32, indexed, four
layers — `race stripes` / `litecyan` / `hud` / `main hull`.

**Done 2026-09-20: banking.** Three frames, three one-frame tags:

```
timeline:   1        2          3
          level    bank-up   bank-down
```

All held states, no transitions — press and hold, the ship sits on the frame.
In-between steps can be inserted later without touching game code, since
everything is addressed by tag name.

```js
sprite.play("bank-up", true); // true = ignoreIfPlaying
sprite.play("level", true);
```

The `ignoreIfPlaying` flag is not optional: without it, calling `play()` every
tick while a key is held restarts the animation continuously.

### Speeds

Settled by playing, fast-paced like Delta:

| Kind    | Speed      | Used by                       |
| ------- | ---------- | ----------------------------- |
| Fast    | 716 px/s   | Clover, greywing, firecomet   |
| Medium  | 596.5 px/s | Delta                         |
| Regular | 477 px/s   | Neutron                       |
| Slow    | 161 px/s   | Firering, emberstar           |
| Dragon  | 80 px/s    | Dragon                        |

New aliens start from one of these. The gap between aliens in a chain is
worked out from the speed, so it stays one sprite width either way.

### Enemy roster

This is the main body of art still to draw. Canvas convention as the player
ship: 32x32, indexed, untrimmed, one folder per entity under
`src/assets/enemies/`, exported as an Aseprite atlas with Array format,
Tags on, trim off, and **Item Filename set to `{frame}`** — Phaser's
`createFromAseprite()` looks the frames up by index, and Aseprite's default
filename template silently breaks it.

### Power drops

Instead of Delta's block pick-ups, a Nemesis-style power drop.

- Look: gleaming silver rings with a letter inside (Thomas designs them).
- Four drops: double fire rate, triple laser, extra life (L), speed.
- Fixed per wave: a given wave always carries the same drop, so players
  can learn it and plan, as in Delta.
- Trigger: shoot down the whole wave. Missing any alien means no drop,
  which keeps the pressure on.
- A missed drop drifts off slowly and steadily.
- Power-ups are temporary (lives are not). Durations to try out later.
- Needs ship collision first.
- **Shield** (built): drops from level 2's last neutron wave, top chain. A
  quarter ring spins round the ship for 60s and stops enemy bullets, not
  aliens.
- **Seeking missile** (to build): fired from the top of the ship every 3s,
  steers to the nearest alien, hits harder than a bullet.

Where each power-up drops:

| Power-up | Level | Drops when                                              | Code                                  |
| -------- | ----- | ------------------------------------------------------- | ------------------------------------- |
| Bullets  | 1     | The clover wave's whole top chain is shot               | `CloverWave.js:164`                   |
| Bullets  | 2     | The delta wave's whole top chain (all 10) is shot       | `DeltaWave.js:170`                    |
| Shield   | 2     | The last neutron dive wave (the top chain) is shot in full | `MainScene.js:90`, `NeutronWave.js:161` |
| Shield   | 3     | Either of two fixed rocks mid-belt, near the centre line, is destroyed (shot or by the shield ring); about 5.6 s apart | `asteroid-belt.js:205, 245`, `AsteroidBelt.js:185` |

### Testing a single wave -- later

Not now: playing the full sequence is part of testing for the moment. But
as the waves and levels grow, reaching the last wave to check one change
means playing everything before it every time. So later, a way to jump
straight to a wave, dev server only (`import.meta.env.DEV`), never in the
released game:

1. **URL parameter** -- `?wave=5` starts at wave B; later
   `?level=2&wave=3`. Nothing in the code changes between tests, and a
   bookmark per wave makes it one click. The preferred route.
2. **A skip key** -- e.g. N ends the current wave and brings on the next.
   Pairs well with 1.
3. **A `START_WAVE` constant** in `MainScene.js` -- simplest, but it has to
   be edited each time and set back.

## Explosions

No particle emitters, no glow, no bloom. The main reason is CPU: the
template's glow bullets (bloom postFX plus `flares` particles) made the game
lag from the outset. It isn't retro either.

**No chunks flying outward.** That is modern arcade and clutters the stage.
Nemesis, Zynaps and Delta all explode in place.

**A hand-painted Aseprite animation, Delta style.** Delta's is 7 frames, greys
and white only: a small clump pops, swells to a dense mass with white hot
spots, cracks open, and dissolves into a few dashes inside the same
footprint. Painted like the neutron, one tag, played once on death.

Explosions are **pooled**, like the bullets: creating and destroying sprites
mid-wave will stutter.

## Palette

The project palette is **DawnBringer's DB32** -- Aseprite's default, and what
the player ship was painted in. It is not the literal Commodore 64 palette,
and that is a deliberate decision: the C64 feel comes from the discipline --
low resolution, a hard colour ceiling, readable silhouettes, 8x8 structure --
far more than from sixteen specific hex values. Thirty-two colours used
sparingly is still real pixel art at C64 level. The ship uses four of them.

Held in code as a single module, so generated textures (debris, bullets,
stars) and hand-drawn art cannot drift apart.

```
#000000  #222034  #45283C  #663931  #8F563B  #DF7126  #D9A066  #EEC39A
#FBF236  #99E550  #6ABE30  #37946E  #4B692F  #524B24  #323C39  #3F3F74
#306082  #5B6EE1  #639BFF  #5FCDE4  #CBDBFC  #FFFFFF  #9BADB7  #847E87
#696A6A  #595652  #76428A  #AC3232  #D95763  #D77BBA  #8F974A  #8A6F30
```

Ramps are defined over these, not ad-hoc colours. Both have six steps:

```
fire:   #FBF236 -> #DF7126 -> #D95763 -> #AC3232 -> #663931 -> #45283C
metal:  #FFFFFF -> #CBDBFC -> #9BADB7 -> #847E87 -> #696A6A -> #323C39
```

A note on how this came about, so it is not relitigated: indexed mode means
the image stores palette _indices_, not that any particular palette is in
use. Aseprite supplied DB32 by default. Aseprite has no built-in Commodore 64
preset -- that was an unverified claim of mine, and it is not there.

## Audio

- **Intro screen only.** A Commodore-inspired track on the title screen.
- **No music in game.** The gameplay runs silent under the effects.
- Buying the track, or commissioning a composer, is the plan — both exist.
  The soundtrack comes **last**, after everything else.

**Effects first, soon:**

- **Laser** — the player's shot.
- **Explosion** — an enemy dying.
- **Falling sound** — a top-down falling tone for the wrong-coloured alien
  that turns up now and then in each wave. Shooting it takes points away
  instead of adding them. An idea from Delta.

Worth noting the consequence: with no in-game music, the **explosions and
impacts carry the entire feel of the game**. That is an argument for spending
real time on the first 100ms of a kill — the hit flash and the debris — over
anything more elaborate.

### Held state vs played animation

Same mechanism, different use.

| Thing                       | Kind                | Tag                   |
| --------------------------- | ------------------- | --------------------- |
| Bank up / level / bank down | state, held         | 1 frame each          |
| Thruster flicker            | loops forever       | 2–4 frames, ping-pong |
| Hit flash                   | plays once, returns | 2–3 frames            |
| Explosion                   | plays once, ends    | 6–10 frames           |

**Why banking is a held state:** if the player is pushing up, the ship should
_stay_ banked until they stop. There is no duration to it — it is a
condition, not an event. So it is a one-frame tag you switch to and sit on.

A single ship file therefore mixes tag lengths: some one frame, some eight.

### Address tags, never frame numbers

`play("bank-up")` — if the tag is one frame, playing it simply holds that
frame. Frame _numbers_ stay entirely inside Aseprite. Insert three frames in
the middle of the file tomorrow and no game code changes. That insulation is
the real payoff of tags over raw frame indices.

Tags also carry a **loop direction** (Forward / Reverse / Ping-pong).
Ping-pong turns 3 drawn frames into a 4-frame cycle for free — useful for an
engine pulse or idle shimmer.

### Canvas convention

32x32, indexed, transparent, square 1:1 pixel aspect. Hull inside roughly
28x20 centred. Bosses at 64x64 or 96x96.

Keep 1:1 despite real C64 multicolour being 2:1, because the game scales
sprites by a square 3x. Get the multicolour feel by drawing in 2px-wide horizontal blocks
instead.

Palette is DB32 — see the Palette section above.
