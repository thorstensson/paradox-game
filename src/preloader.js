// Assets live in src/assets and are resolved by Vite at build time.
// The `?url` suffix is required: without it Vite parses .json into a JS
// object and does not recognise .xml as an asset at all. Files under
// 4096 bytes are inlined as base64 data URIs, which Phaser 3.80 accepts.

// Title logo: OBSIDION set in Sci Fi Adventure, trimmed to 284x32 and drawn
// at 4x, so its pixels match the background grid.
import titleLogoUrl from "./assets/fonts/scifiadventure.png?url";
import nebulaBackUrl from "./assets/backgrounds/purple-nebula/back.png?url";
import nebulaFrontUrl from "./assets/backgrounds/purple-nebula/planets.png?url";
import galaxyBackUrl from "./assets/backgrounds/galaxy/back.png?url";
import galaxyFrontUrl from "./assets/backgrounds/galaxy/front.png?url";

// Player ship. Hand-painted, 32x32 indexed, three one-frame tags:
// level / bank-up / bank-down. Exported from Aseprite untrimmed in Array
// format with Tags on -- Phaser indexes the frames numerically, so Hash
// format will not load.
import shipUrl from "./assets/player/ship/obsidion-ship.png?url";
import shipJsonUrl from "./assets/player/ship/obsidion-ship.json?url";

// Player bullet. 8x2 native, one frame, no tags -- so a plain image, not an
// atlas. PlayerBullets blows it up 3x into a canvas texture at runtime,
// because a Blitter draws its Bobs at raw texture size.
import shipBulletUrl from "./assets/player/bullet/ship-bullet.png?url";

// Main font: Electron Pulse, exported from BMFont at 16px with smoothing
// off -- white glyphs on transparent, XML descriptor. Native size is 16, so
// bitmapText size 32 is 2x; other sizes scale unevenly.
import mainFontUrl from "./assets/fonts/electron-pulse_0.png?url";
import mainFontXmlUrl from "./assets/fonts/electron-pulse.fnt?url";

// Class to preload all the assets
// Remember you can load this assets in another scene if you need it
export class Preloader extends Phaser.Scene {
    constructor() {
        super({ key: "Preloader" });
    }

    preload() {
        // Load all the assets

        // Background layers
        this.load.image("title-logo", titleLogoUrl);
        this.load.image("nebula-back", nebulaBackUrl);
        this.load.image("nebula-front", nebulaFrontUrl);
        this.load.image("galaxy-back", galaxyBackUrl);
        this.load.image("galaxy-front", galaxyFrontUrl);

        // Phaser reads Aseprite atlases natively; createFromAseprite() in the
        // scene turns each frameTag into an animation of the same name.
        this.load.aseprite("ship", shipUrl, shipJsonUrl);
        this.load.image("ship-bullet", shipBulletUrl);

        // Fonts
        this.load.bitmapFont("main-font", mainFontUrl, mainFontXmlUrl);

        // Event to update the loading bar
        this.load.on("progress", (progress) => {
            console.log("Loading: " + Math.round(progress * 100) + "%");
        });
    }

    create() {
        // When all the assets are loaded go to the next scene
        this.scene.start("MainScene");
    }
}
