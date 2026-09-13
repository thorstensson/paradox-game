I am building a 2D horizontal space shooter in Phaser 3 using pure JavaScript. We have established a specific architectural blueprint that I need you to stick to for all code generation. Please review the details below before we proceed:

### 📐 Canvas & Scaling Blueprint

- **Target Resolution:** 1280 x 640 (Adjusted to match asset height)
- **Native Asset Size:** 272 x 160
- **Scale Multiplier:** 4x integer scaling
- **Background Dimensions Formula:** Screen dimensions are divided by 4:
    - `tileWidth` = 1280 / 4 = 320
    - `tileHeight` = 640 / 4 = 160 (Matches native asset height 1:1)

* **Rendering Rule:** Always apply `pixelArt: true` in the Phaser config. This already forces `NEAREST` filtering globally, so per-object `setFilterMode` calls are not needed.
* **Note:** The native tile width (272) does not divide evenly into the 320 virtual width. This is fine — a `TileSprite` repeats its texture and simply wraps mid-texture, so only seamlessness matters, not the ratio.

### 🌌 Parallax Background Loop Strategy

- `back.png` and `front.png` are static, seamless textures (not spritesheets).
- Depth is created via **code-driven parallax**. In the scene's `update()` loop, we shift the texture position (`tilePositionX`) at varying speeds (e.g., `back` moves slower than `front`).
- Scrolling is **delta-based** (`tilePositionX += speed * delta / 1000`) so the drift rate is framerate independent.
- Speeds are expressed in *texture* pixels per second; multiply by the 4x scale for the on-screen rate.
- The `props/` folder contains individual, standalone planet and asteroid textures. These will be dynamically spawned just off-screen to the right and given a leftward velocity to float across the sky independent of the background tiles.

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
├── public/
│ └── favicon.png # Only truly static, unprocessed files
│
└── src/
├── main.js # Phaser config and main initialization
├── preloader.js # All asset imports + load calls
│
├── assets/ # Structured strictly by runtime function
│ ├── backgrounds/
│ │ └── galaxy/
│ │ ├── back.png # Deep background star tile
│ │ ├── front.png # Mid-ground star tile
│ │ └── props/ # Individual props-1.png to props-5.png (planets/asteroids)
│ ├── enemies/
│ ├── player/
│ └── fonts/
│
├── gameobjects/ # Custom JS classes inheriting from Phaser GameObjects
│ ├── GalaxyBackground.js # Two TileSprites, 320x160 at setScale(4)
│ ├── Player.js
│ ├── BlueEnemy.js
│ └── Bullet.js
│
└── scenes/ # Core Phaser Scene files
├── SplashScene.js
├── MainScene.js # Orchestrates the game loop and collision logic
├── MenuScene.js
├── HudScene.js
└── GameOverScene.js

---

### ✅ Status

**Done (v1):**
- Canvas set to 1280 x 640.
- Galaxy `back.png` / `front.png` loading and scrolling as a two-layer parallax via `GalaxyBackground.js`.
- All assets migrated from `public/` to `src/assets/` with `?url` imports.

**Next up:**
- Props spawning (individual planets/asteroids drifting leftward).
- Remove the leftover `floor.png` strip in `MainScene.js` — a Space Invaders holdover that makes no sense over a starfield.
- Fix the `roundPixel` typo in `main.js` (should be `roundPixels`; currently a silent no-op).
- Replace the placeholder enemy art.
