![Image](https://github.com/user-attachments/assets/fdea3e3d-1f84-44c4-b63f-11da9d2fb819)
![Image](https://github.com/user-attachments/assets/c79b3a09-b58e-4d48-8e80-f4e0882ea76e)
![Image](https://github.com/user-attachments/assets/dca4447e-52a7-40d8-b176-4cb66f6820ac)

# Paradox, a retro shoot 'em up

This has been a surprising little side project that came to me one day and would not let go, a detour from my upcoming Vue library, my essay writing (read my essay on Bobby Fischer @ https://www.intricacylitreview.org/thorstensson), my need for a trip to Canary Islands, my dentist, and my search for a permanent job. Inspired by C64 tiles such as Katakis, Delta, Nemesis...

## 🧰 Stack

- Graphics: Crafted by me in Aseprite and Tiled.
- Game engine: Phaser.js
- Code: Me + Claude.
- Concept: Always me, nobody else here.

## 🎵 Credits due

- Audio FX: Mark Sheeky (Indiesfx)
- Ship explosion FX: Sentient Dream Studio

## 📐 Canvas & Scaling Blueprint

- **Resolution:** 1280 x 800
- **Scale:** 3x integer scaling, the ship's pixel, for everything

* **Rendering Rule:** Always apply `pixelArt: true` in the Phaser config. This already forces `NEAREST` filtering globally, so per-object `setFilterMode` calls are not needed.

## 🌌 Background

- The stars are made in code, not art.
- Each level has its own backdrop: fire cave, asteroid belt, Station X (built in Tiled).

## 📦 Asset Pipeline (Vite)

Assets live in **`src/assets/`** and are resolved by Vite at build time, not in `public/`.

- Every asset is imported with an explicit **`?url`** suffix. This is required: without it Vite parses `.json` into a JS object, and does not recognise `.xml` as an asset at all.
- Files under **4096 bytes** (`build.assetsInlineLimit`) are inlined into the JS bundle as base64 data URIs. Phaser 3.80+ supports these — `XHRLoader` decodes `;base64,` payloads via `atob`.
- Larger files are emitted as content-hashed files (e.g. `back-EIYR4omt.png`), which gives free cache-busting.
- Sidecar files are safe under hashing: `load.atlas(key, pngUrl, jsonUrl)` and `load.bitmapFont(key, pngUrl, xmlUrl)` take each URL explicitly, and Phaser's parsers ignore the filename recorded inside the JSON/XML. (The exception is `load.multiatlas`, which _does_ read image names out of the JSON — avoid it.)
- Benefit of this over `public/`: a mistyped path becomes a **build error** instead of a runtime 404, and unreferenced assets are never bundled.

## 📁 Project & Folder Structure

A simple modular, ES6-module approach splitting files by their functional roles:

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
