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

// Player
import playerUrl from "./assets/player/player.png?url";
import propulsionFireUrl from "./assets/player/propulsion/propulsion-fire.png?url";
import propulsionFireAtlasUrl from "./assets/player/propulsion/propulsion-fire_atlas.json?url";
import propulsionFireAnimUrl from "./assets/player/propulsion/propulsion-fire_anim.json?url";
import bulletUrl from "./assets/player/bullet.png?url";

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

        this.load.image("player", playerUrl);
        this.load.atlas("propulsion-fire", propulsionFireUrl, propulsionFireAtlasUrl);
        this.load.animation("propulsion-fire-anim", propulsionFireAnimUrl);

        // Bullets
        this.load.image("bullet", bulletUrl);
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
