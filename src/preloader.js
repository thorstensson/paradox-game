// Assets live in src/assets and are resolved by Vite at build time.
// The `?url` suffix is required: without it Vite parses .json into a JS
// object and does not recognise .xml as an asset at all. Files under
// 4096 bytes are inlined as base64 data URIs, which Phaser 3.80 accepts.
import flaresUrl from "./assets/flares.png?url";

// Background layers.
// Level 1: oil6 -- 200x200, generated, seamless, 6-colour palette. 200 rows
// fill the 800px canvas exactly at 4x, and 960 wide means the tile repeats
// only every three screens.
import oil6BackUrl from "./assets/backgrounds/oil6/oil6-space-background.png?url";

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
// atlas. PlayerBullets blows it up 4x into a canvas texture at runtime,
// because a Blitter draws its Bobs at raw texture size.
import shipBulletUrl from "./assets/player/bullet/ship-bullet.png?url";

// Enemies
import enemyBlueUrl from "./assets/enemies/enemy-blue/enemy-blue.png?url";
import enemyBlueAtlasUrl from "./assets/enemies/enemy-blue/enemy-blue_atlas.json?url";
import enemyBlueAnimUrl from "./assets/enemies/enemy-blue/enemy-blue_anim.json?url";
import enemyBulletUrl from "./assets/enemies/enemy-bullet.png?url";

// Fonts
import pixelfontUrl from "./assets/fonts/pixelfont.png?url";
import pixelfontXmlUrl from "./assets/fonts/pixelfont.xml?url";
import knighthawksUrl from "./assets/fonts/knight3.png?url";

// Class to preload all the assets
// Remember you can load this assets in another scene if you need it
export class Preloader extends Phaser.Scene {
    constructor() {
        super({ key: "Preloader" });
    }

    preload() {
        // Load all the assets

        // Background layers
        this.load.image("oil6-back", oil6BackUrl);
        this.load.image("title-logo", titleLogoUrl);
        this.load.image("nebula-back", nebulaBackUrl);
        this.load.image("nebula-front", nebulaFrontUrl);
        this.load.image("galaxy-back", galaxyBackUrl);
        this.load.image("galaxy-front", galaxyFrontUrl);

        // Phaser reads Aseprite atlases natively; createFromAseprite() in the
        // scene turns each frameTag into an animation of the same name.
        this.load.aseprite("ship", shipUrl, shipJsonUrl);
        this.load.image("ship-bullet", shipBulletUrl);

        // Bullets
        this.load.image("flares", flaresUrl);

        // Enemies
        this.load.atlas("enemy-blue", enemyBlueUrl, enemyBlueAtlasUrl);
        this.load.animation("enemy-blue-anim", enemyBlueAnimUrl);
        this.load.image("enemy-bullet", enemyBulletUrl);

        // Fonts
        this.load.bitmapFont("pixelfont", pixelfontUrl, pixelfontXmlUrl);
        this.load.image("knighthawks", knighthawksUrl);

        // Event to update the loading bar
        this.load.on("progress", (progress) => {
            console.log("Loading: " + Math.round(progress * 100) + "%");
        });
    }

    create() {
        // Stopgap bullet. The template's bullet.png went with the rest of the
        // Phaser default art; this is a plain 4x1 native dot drawn at 4x, so
        // it sits on the same grid as everything else until real art exists.
        const bullet = this.make.graphics({ x: 0, y: 0 }, false);
        bullet.fillStyle(0xffffff, 1);
        bullet.fillRect(0, 0, 16, 4);
        bullet.generateTexture("bullet", 16, 4);
        bullet.destroy();

        // Create bitmap font and load it in cache
        const config = {
            image: 'knighthawks',
            width: 31,
            height: 25,
            chars: Phaser.GameObjects.RetroFont.TEXT_SET6,
            charsPerRow: 10,
            spacing: { x: 1, y: 1 }
        };
        this.cache.bitmapFont.add('knighthawks', Phaser.GameObjects.RetroFont.Parse(this, config));

        // When all the assets are loaded go to the next scene
        this.scene.start("MainScene");
    }
}
