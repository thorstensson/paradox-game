# Paradox, a retro shoot 'em up - Philosophy

### 📐 Canvas & Scaling Blueprint

- **Resolution:** 1280 x 800
- **Scale:** 3x integer scaling, the ship's pixel, for everything

* **Rendering Rule:** Always apply `pixelArt: true` in the Phaser config. This already forces `NEAREST` filtering globally, so per-object `setFilterMode` calls are not needed.

### 🌌 Background

- The stars are made in code, not art.
- Each level has its own backdrop: fire cave, asteroid belt, Station X (built in Tiled).

### 📦 Asset Pipeline (Vite)

Assets live in **`src/assets/`** and are resolved by Vite at build time, not in `public/`.

- Every asset is imported with an explicit **`?url`** suffix. This is required: without it Vite parses `.json` into a JS object, and does not recognise `.xml` as an asset at all.
- Files under **4096 bytes** (`build.assetsInlineLimit`) are inlined into the JS bundle as base64 data URIs. Phaser 3.80+ supports these — `XHRLoader` decodes `;base64,` payloads via `atob`.
- Larger files are emitted as content-hashed files (e.g. `back-EIYR4omt.png`), which gives free cache-busting.
- Sidecar files are safe under hashing: `load.atlas(key, pngUrl, jsonUrl)` and `load.bitmapFont(key, pngUrl, xmlUrl)` take each URL explicitly, and Phaser's parsers ignore the filename recorded inside the JSON/XML. (The exception is `load.multiatlas`, which _does_ read image names out of the JSON — avoid it.)
- Benefit of this over `public/`: a mistyped path becomes a **build error** instead of a runtime 404, and unreferenced assets are never bundled.

### 📁 Project & Folder Structure

We are using a modular, ES6-module approach splitting files by their functional roles:

```
paradox/
├── index.html
├── vite.config.js
├── public/
│ └── favicon.png # Only truly static, unprocessed files
│
└── src/
├── main.js # Phaser config and main initialization
├── preloader.js # All asset imports + load calls
│
├── assets/ # Structured strictly by runtime function
│ ├── enemies/
│ ├── enviro/
│ ├── fx/
│ ├── player/
│ ├── powerups/
│ └── fonts/
│
├── gameobjects/ # Custom JS classes inheriting from Phaser GameObjects
│ ├── Player.js
│ ├── PlayerBullets.js
│ ├── StarField.js
│ ├── one file per alien wave
│ ├── Station.js
│ └── Boss.js
│
└── scenes/ # Core Phaser Scene files
├── MainScene.js # Orchestrates the game loop and collision logic
├── MenuScene.js
├── HudScene.js
├── PauseScene.js
└── GameOverScene.js
```

---

### 🎮 Levels

**1. Into the Breach (Deep Space).** Open space and stars. Four neutron waves, each with its own movement; clover chains racing along the top and bottom edges; a ring of firerings; neutrons again with one odd-coloured ship; two staggered greywing walls to finish. The third neutron wave drops the speed power-up, the clover top chain the bullets.

**2. Ember Caves.** Walls of flame along the top and bottom; touching them kills. Firecomets shoot out of the flames all through the cave, always on the same paths. Waves: emberstar blocks swinging and firing, the dragon (only its head can be killed), deltas, neutrons and the ember ring. Drops: bullets from the deltas and the ember ring, the shield from the last neutron chain.

**3. Belt of Osiris.** One long asteroid belt, the same every game so it can be learnt. Each rock takes three hits. The third rock drops the bullets; two rocks mid-belt drop the shield.

**4. Station X.** A fast flight through a space station; touching the walls kills. Waves of the new station aliens with some earlier ones, guns that turn toward the ship and fire, vulcan pods, floating electroballs, the diamond gun, rockets in the narrow passages, and zaps that can't be shot, only timed. A lost ship restarts at the last marker passed. Drops: the missile, the shield and the bullets.

**The boss, scarab.** At the end the station slows to a stop and the scarab slides in. It sweeps up and down, lunges forward every few seconds, and fires from its wings and hull in turn. The wings must be shot first; only then does the hull take hits.
