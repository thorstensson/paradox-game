I am building a 2D horizontal space shooter in Phaser 3 using pure JavaScript. We have established a specific architectural blueprint that I need you to stick to for all code generation. Please review the details below before we proceed:

### 📐 Canvas & Scaling Blueprint

- **Canvas:** 1280 x 800 -- 4x the C64 playfield (320 x 200).
- **Window fit:** `Scale.NONE` plus an integer `zoom` (largest whole multiple that fits the window), so the canvas is never stretched by a fractional amount.
- **Clear colour:** `#111111` -- Amiga OCS near-black, one `0x11` step up from black. The page around it stays `#0b090a` (`style.css`), so the playfield edge reads against the border.
- **Sprites (ships, enemies, bullets):** 3x. See **Sprite Scale: 3x** below.
- **Title logo:** 4x.
- **Main font:** Electron Pulse, drawn 1:1 at 32px. See **Fonts** below.
- **Stars:** 1/2/3px screen-pixel dots (`StarField.js`), not on any texel grid.

* **Rendering Rule:** Always apply `pixelArt: true` in the Phaser config. This already forces `NEAREST` filtering globally, so per-object `setFilterMode` calls are not needed.
* **Integer vs non-integer scale:** anything can be drawn at any size. Integer scales keep every pixel the same width; non-integer ones stay hard-edged but make some pixels a screen pixel wider than others, so they read less clean. A choice per asset, not a rule.

### 🌌 Parallax Backgrounds -- parked

`GalaxyBackground.js` (two scrolling TileSprites) was removed 2026-09-24:
Level 1 is stars only, and the intro and Game Over screens are plain
`#111111`. The template backgrounds (`galaxy/`, `purple-nebula/`, `planets/`)
and the generated `oil6/` tile are kept in `src/assets/backgrounds/` in case
one comes back in-game; none are loaded. If one does, the technique was: a
TileSprite per layer, `tilePositionX += speed * delta / 1000`, back layer
slower than front. The old class is in git history.

### 📦 Asset Pipeline (Vite)

Assets live in **`src/assets/`** and are resolved by Vite at build time, not in `public/`.

- Every asset is imported with an explicit **`?url`** suffix. This is required: without it Vite parses `.json` into a JS object, and does not recognise `.xml` as an asset at all.
- Files under **4096 bytes** (`build.assetsInlineLimit`) are inlined into the JS bundle as base64 data URIs. Phaser 3.80+ supports these — `XHRLoader` decodes `;base64,` payloads via `atob`.
- Larger files are emitted as content-hashed files (e.g. `back-EIYR4omt.png`), which gives free cache-busting.
- Sidecar files are safe under hashing: `load.atlas(key, pngUrl, jsonUrl)` and `load.bitmapFont(key, pngUrl, xmlUrl)` take each URL explicitly, and Phaser's parsers ignore the filename recorded inside the JSON/XML. (The exception is `load.multiatlas`, which *does* read image names out of the JSON — avoid it.)
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
│ └── electron-pulse.fnt + electron-pulse_0.png # Main font (BMFont)
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

### ✅ Status

**Done 2026-09-24:**
- Template enemy (`BlueEnemy`), its glow bullets (`Bullet.js`, bloom postFX, `flares` particles) and their assets removed.
- `GalaxyBackground` removed from gameplay, intro and Game Over. Stars only.
- Clear colour `#111111`.
- Game Over: stripes and click-to-restart gone; holds 3s, fades out, back to the intro. Delta style.
- Main font is Electron Pulse everywhere except the logo. `pixelfont` and Knighthawks deleted.
- Ship and bullets at 3x.

**Next up:**
- First enemy, 32x32 canvas at 3x.
- Score font in Delta's layout (score, hi-score table) -- Electron Pulse is the candidate.
- The 20s game-over timer and the POINTS/REMAINING HUD are still template placeholders.

---

## Level Concepts

Three levels sketched. Names to come later.

1. **Pure space** — stars only.
2. **Caves of fire** — walls of flame, top and bottom.
3. Undecided.

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

**Pure space.** Nothing but space, in the spirit of Nemesis on the C64.

**Nothing to draw for this level.** The stars are already there and they are
*code, not art* — `src/gameobjects/StarField.js` is a Phaser **Blitter**
(`scene.add.blitter`, batched Bobs), generating its own texture at runtime:
three 1/2/3px white squares, no loaded image at all.

Depth is carried by size, speed and alpha together across three bands, drawn
at `depth: -5`.

So no background texture is needed here — the clear colour (`#111111`, set in
`main.js`) plus the Blitter is the whole level.

---

## Level 2 Concepts

**Caves of fire.** Idea from a level in Delta. No stars. Walls of flame
running horizontally along the top and bottom of the screen, looping. All
flame — no rock, no cave edge.

### Flame flicker: rotate the colours, not the flames

`TileSprite` has **no Animation component** — `play()` does not exist on it.
It does have `setFrame()`.

So the flicker is drawn as frames in Aseprite, and swapped by hand at
runtime:

1. Draw the flame strip **once**.
2. Duplicate it to 5–6 frames.
3. In each frame rotate the fire colours one step along the ramp
   (dark red → red → orange → yellow → white). The flame shape stays
   pixel-identical; only each pixel's position on the ramp moves. This is
   how C64 fire actually worked — colour cycling, not redrawn flames — and
   it is what reads as heat boiling rather than flames sliding.
4. Export as a **spritesheet** (`load.spritesheet`, fixed frame size). No
   atlas JSON, so the trim question never arises.

At runtime, advance the frame on a timer (~80ms) with `setFrame()`, and
offset the bottom strip by a few frames so the two edges never pulse in
unison. `setFrame()` marks the TileSprite dirty and re-uploads its texture to
the GPU — fine at ~12 swaps a second, wasteful every frame.

Two further motions come free from code, from the same single drawing:
`tilePositionX` for the horizontal rush (match the level's scroll speed), and
a slow negative `tilePositionY` so the flames rise.

**Draw the strip power-of-two in both dimensions** — 64x32 native, or 64x16,
or 128x32. `updateTileTexture()` draws the frame into a power-of-two canvas
with `drawImage(..., 0, 0, potWidth, potHeight)`, which *stretches* a non-POT
texture to the padded size. A 64x24 strip would come out vertically
distorted.

**Needs rebalancing since the ship went to 3x.** This was first worked out
with a 4x ship: 32px of flame top and bottom left 136 of the 200 native rows,
about 4.25 ship-heights -- tight, Delta-ish, playable. With the hull now ~60px
on screen, 32px flames at 4x (128px each) leave 544px, about 9 ship-heights;
at 3x (96px each) about 10. To get back to the tight feel: thicker flames, or
decide the gap in ship-heights first and size the strips from that.

---

## Level 3 Concepts

Theme parked -- Thomas will decide it later.

What is settled: this is the final level, and it **ends with a boss**. Boss
canvas convention is 64x64 or 96x96 (see Canvas convention in the Aseprite
section) -- 192px or 288px on screen at 3x.

---

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

**Main font: Electron Pulse** (Darrell Flood / HAWTPIXEL; free for personal
use, commercial licence $25 indie / $100 unlimited). Used for everything --
HUD, intro text, Game Over -- except the logo, as Delta uses one font
throughout. Its squared, notched letters match the OBSIDION logo.

Made with **AngelCode BMFont** from the installed TTF:

- Font Settings: **size 32**, *Match char height* **off** (on, BMFont writes a
  negative size and Phaser renders the text flipped on both axes), font
  smoothing off.
- Export Options: bit depth 32, preset *White text with alpha*, font
  descriptor **XML**, textures **png**, **512x256** so it fits one page
  (Phaser's loader reads one page only). *Equalize cell heights* and *Force
  offsets to zero* off.
- Saved as `src/assets/fonts/electron-pulse.fnt` + `electron-pulse_0.png`.

Drawn at 32 in game, i.e. 1:1. At 16px the font lost its thin cuts and the
gaps between letters (A and P came out identical), so it needs the room.

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
sprite.play('bank-up', true);   // true = ignoreIfPlaying
sprite.play('level', true);
```

The `ignoreIfPlaying` flag is not optional: without it, calling `play()` every
tick while a key is held restarts the animation continuously.

### The technique that worked: skew the hull, hold the detail layers out

Hand-stepping the bars was tried and rejected — anchoring the spine and moving
only the bar ends tilts the extremities while the body stays put, which reads
as bent wings rather than a banked ship. A tilt has to be **pervasive**.

What worked:

1. **Skew `main hull` only.** The shear carries the whole shape at once —
   top bar shortens, bottom bar lengthens, and the rear curve alters too. That
   rear curve is what sells it: the tilt becomes a property of the whole
   object rather than something happening at the tips.
2. **Keep `hud` and `race stripes` out of the skew.** They stay as fixed
   reference points, so the hull reads as rotating *relative to* something
   stable. It also keeps the dome perfectly circular — a skewed circle reads
   as damage, not tilt.
3. **Pen work after.** Lengthen the light edge along the top of the upper bar,
   shorten it underneath. A lit surface rotating does more for the illusion
   than the silhouette does.
4. **Clean up.** Skew interpolates, and indexed mode snaps the new colours to
   the nearest palette entry, so edges need filling in by hand. Unavoidable
   labour, not a flaw in the method.
5. **bank-down is bank-up flipped vertically.** Alt+N to duplicate the frame
   with all cels, select all four cels in the timeline, `Edit → Flip
   Vertical`. Lossless. Check the race stripes went with it — flip acts on
   selected cels only, and the hull dominates the silhouette enough to hide a
   partial flip.

### Export, when the time comes

`File → Export Sprite Sheet`: JSON Data on, **Array** format, **Tags** ticked,
**trim off**. Phaser indexes Aseprite frames numerically, so Hash format will
not load. Trim off keeps every frame 32x32 sharing one centre — trimmed
asymmetric frames put the origin in a slightly different place per frame and
the ship jitters a pixel between states, which is 3px on screen at 3x.

**Next:** thruster flicker, hit flash, then enemy art.

---

## Enemies & Waves

**No single enemies.** Everything arrives as a formation, Delta style. A lone
drifting enemy is the thing that makes a shooter feel empty; a wave that has
to be read and threaded is the thing that makes it feel alive.

### Wave structure

Ten waves per level, **the same shape on all three levels**. The count, the
length and the 5 / 4 / 1 split below do not change -- what changes is the
enemy types and the patterns they fly.

The shape, taken from Delta:

| Waves | Behaviour |
|---|---|
| 1–5 | Five identical waves of basic craft, looping into the screen diagonally from the top right |
| 6–9 | Four fast straight-line dart formations, crossing the middle and lower screen |
| 10 | Spinning circular drones — the last barrier before the level boundary |

**Level 3 ends with a boss.** Levels 1 and 2 end at wave 10.

### Enemy roster

**Two new enemy types per level.** The wave count does not grow; the
vocabulary does. By level 3 there are six types and the patterns combine
them.

This is the main body of art still to draw. Canvas convention as the player
ship: 32x32, indexed, untrimmed, one folder per entity under
`src/assets/enemies/`, exported as an Aseprite atlas with Array format,
Tags on, trim off, and **Item Filename set to `{frame}`** — Phaser's
`createFromAseprite()` looks the frames up by index, and Aseprite's default
filename template silently breaks it.

## Explosions

No particle emitters, and no additive blending. Additive glow is a modern
effect the C64 could not produce, and beside indexed 4-value sprites it reads
as a different game bleeding through.

**Chunky palette debris instead.** On death an enemy throws 6–10 solid 2x2 or
4x4 squares outward with a short life. The ship does not dissolve, it comes
apart — which is what Delta and Armalyte actually did.

The machinery already exists in `StarField.js`: a Blitter with a
`generateTexture`'d square, batched into one draw call. Same pattern,
different behaviour.

**Chunks die by stepping down a colour ramp, never by alpha.** Alpha fading is
the modern tell. Colour cycling is the authentic one, and it is the same
mechanism as the level 2 flame flicker — so the ramps get reused.

```
fire:   white -> yellow -> orange -> light red -> red -> brown
metal:  white -> light grey -> grey -> dark grey
```

A chunk spawns at the hot end and advances one step every ~60ms until it runs
off the cold end.

Explosions are **pooled**, like the bullets. With ten-ship waves there will
routinely be eight running at once, and creating and destroying sprites
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
the image stores palette *indices*, not that any particular palette is in
use. Aseprite supplied DB32 by default. Aseprite has no built-in Commodore 64
preset -- that was an unverified claim of mine, and it is not there.

## Audio

- **Intro screen only.** A Commodore-inspired track on the title screen.
- **No music in game.** The gameplay runs silent under the effects.
- Buying the track, or commissioning a composer, is the plan — both exist.

Worth noting the consequence: with no in-game music, the **explosions and
impacts carry the entire feel of the game**. That is an argument for spending
real time on the first 100ms of a kill — the hit flash and the debris — over
anything more elaborate.

## Not in this build

**Powerups are v2.** Deliberately out of scope until the three levels, the
enemy roster and the wave patterns are done.

---

## Aseprite

### The timeline model

Three separate things, easy to conflate:

- **Layers** (vertical, left panel) — construction aids. Hull, cockpit,
  shading. On export they are **flattened** into one image. The game never
  sees them.
- **Frames** (horizontal, top of timeline) — animation steps. Each frame is
  all visible layers composited at that point.
- **Cels** — the intersection of a layer and a frame: the pixels belonging to
  *this layer* at *this frame*. You never create cels directly; you create a
  frame and Aseprite gives you a cel on every layer.
- **Tags** — a named range *over frames*. Select frames 5–8, right-click, New
  Tag, call it `bank-up`. That is all a tag is.

`Frame → New Frame` (Alt+N) duplicates the current frame *including all its
cels*. `New Empty Frame` (Alt+Shift+N) gives blank cels instead.

Avoid linked cels for banking — every layer shifts, so linking fights you.

The timeline is **1-based**; the exported JSON and Phaser are **0-based**.
Tags insulate you from this entirely, which is the point of them.

### Held state vs played animation

Same mechanism, different use.

| Thing | Kind | Tag |
|---|---|---|
| Bank up / level / bank down | state, held | 1 frame each |
| Thruster flicker | loops forever | 2–4 frames, ping-pong |
| Hit flash | plays once, returns | 2–3 frames |
| Explosion | plays once, ends | 6–10 frames |

**Why banking is a held state:** if the player is pushing up, the ship should
*stay* banked until they stop. There is no duration to it — it is a
condition, not an event. So it is a one-frame tag you switch to and sit on.

A single ship file therefore mixes tag lengths: some one frame, some eight.

### Address tags, never frame numbers

`play("bank-up")` — if the tag is one frame, playing it simply holds that
frame. Frame *numbers* stay entirely inside Aseprite. Insert three frames in
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

### Banking: skew, do not rotate

The working technique is in the Player Ship section above. The short version:
skew `main hull` only, hold the detail layers out so the eye has fixed
reference points, pen the light edges afterwards, clean up the interpolated
pixels by hand.

Do **not** hand-step the bars while anchoring the spine. It was tried and it
reads as bent wings rather than a banked ship — a tilt has to be pervasive.
