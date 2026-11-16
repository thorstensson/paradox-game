![Image](https://github.com/user-attachments/assets/2c98d110-1b9a-4ade-ba62-f0cde51e7d56)
![Image](https://github.com/user-attachments/assets/e8bf85c8-1a5a-4fab-ab89-fff3be49be77)

# Paradox, a retro shoot 'em up

This has been a surprising side project that came to me one day and would not let go, a detour from my upcoming Vue library, my creative writing, and my search for a permanent job. With this retro shoot 'em up I try to pay homage to Commodore 64 titles such as Katakis, Delta, and Nemesis. You will find nods to these titles in the game. For example, the diagonal star scroll comes straight from Katakis.

## 🧰 Stack

- Graphics: Crafted by me in Aseprite and Tiled. And yes, this was a learning experience!
- Game engine: Phaser.js
- Code: My brain, and Claude Opus's digital one.

## 🎵 Credits

- Audio: Mark Sheeky (Indiesfx)
- Ship explosion: Sentient Dream Studio

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

## 📝 TODO

- A game audio track, 16-bit, which I am working on in Reaper.
