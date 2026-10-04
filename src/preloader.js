// Assets live in src/assets and are resolved by Vite at build time.
// The `?url` suffix is required: without it Vite parses .json into a JS
// object and does not recognise .xml as an asset at all. Files under
// 4096 bytes are inlined as base64 data URIs, which Phaser 3.80 accepts.

// Title logo: OBSIDION set in Sci Fi Adventure, halved to 142x16 and drawn
// at 7x (MenuScene) -- chunkier pixels, one letter's width from each edge.
import titleLogoUrl from "./assets/fonts/scifiadventure.png?url";

// Player ship. Hand-painted, 32x32 indexed, three one-frame tags:
// level / bank-up / bank-down. Exported from Aseprite untrimmed in Array
// format with Tags on -- Phaser indexes the frames numerically, so Hash
// format will not load.
import shipUrl from "./assets/player/ship/raven.png?url";
import shipJsonUrl from "./assets/player/ship/raven.json?url";

// Player bullet. 8x2 native, one frame, no tags -- so a plain image, not an
// atlas. PlayerBullets blows it up 3x into a canvas texture at runtime,
// because a Blitter draws its Bobs at raw texture size.
import shipBulletUrl from "./assets/player/bullet/ship-bullet.png?url";

// Neutron, level 1 wave kind A. 32x32 indexed, six frames under one looping
// tag, spin (1 2 3 4 3 2). Same export settings as the ship.
import neutronUrl from "./assets/enemies/neutron/neutron.png?url";
import neutronJsonUrl from "./assets/enemies/neutron/neutron.json?url";

// Clover, level 1 wave kind B. 32x32 indexed, four frames under one looping
// tag, clover-spin. Same export settings as the ship.
import cloverUrl from "./assets/enemies/clover/clover.png?url";
import cloverJsonUrl from "./assets/enemies/clover/clover.json?url";

// Odd-coloured neutron: the neutron recoloured, one looping tag,
// neutron-odd-spin. Shooting it takes points away.
import neutronOddUrl from "./assets/enemies/neutron/neutron-odd.png?url";
import neutronOddJsonUrl from "./assets/enemies/neutron/neutron-odd.json?url";

// Firering, level 1 wave kind C. 32x32 indexed, eight frames under one
// looping tag, firering-pulse. Same export settings as the ship.
import fireringUrl from "./assets/enemies/firering/firering.png?url";
import fireringJsonUrl from "./assets/enemies/firering/firering.json?url";

// Greywing, level 1 wave kind D. 32x32 indexed, one frame under the tag
// greywing-level. Same export settings as the ship.
import greywingUrl from "./assets/enemies/greywing/greywing.png?url";
import greywingJsonUrl from "./assets/enemies/greywing/greywing.json?url";

// Explosion. 32x32, nine frames under one tag, boom, played once.
import explosionUrl from "./assets/fx/explosion/explosion.png?url";
import explosionJsonUrl from "./assets/fx/explosion/explosion.json?url";

// Explosion 2, on trial. From a free Aseprite pack on itch, re-exported with
// our settings. 128x128, one tag, Animation (frames 0-8; frame 9 is empty).
import explosion2Url from "./assets/fx/explosion-2/explosion.png?url";
import explosion2JsonUrl from "./assets/fx/explosion-2/explosion.json?url";

// Firecomet, level 2 A1. 32x32 indexed, six frames under one looping tag,
// firecomet-pulse. Same export settings as the ship.
import firecometUrl from "./assets/enemies/firecomet/firecomet.png?url";
import firecometJsonUrl from "./assets/enemies/firecomet/firecomet.json?url";

// Emberstar, level 2 A2. 32x32 indexed, one frame -- Phaser spins it, so a
// plain image, not an atlas.
import emberstarUrl from "./assets/enemies/emberstar/emberstar.png?url";

// Enemy bullet, fired by aliens from level 2's A2 on. 6x6 indexed, two
// frames under one looping tag, bullet-enemy-blink. Same export settings as
// the ship.
import bulletEnemyUrl from "./assets/enemies/bullet/bullet-enemy.png?url";
import bulletEnemyJsonUrl from "./assets/enemies/bullet/bullet-enemy.json?url";

// Power-up, the bullet power drop. 16x16 indexed, two frames under one
// looping tag, powerup-blink. Same export settings as the ship.
import powerupBulletsUrl from "./assets/powerups/powerup-bullets.png?url";
import powerupBulletsJsonUrl from "./assets/powerups/powerup-bullets.json?url";

// Fire cave, level 2's walls. 128x64 indexed, ten frames under the tag
// firecave-loop. Same export settings as the ship.
import firecaveUrl from "./assets/enviro/firecave/firecave.png?url";
import firecaveJsonUrl from "./assets/enviro/firecave/firecave.json?url";

// Main font: Techbase (FontStruct, Omegaville), a bitmap font exported from
// BMFont at 27px -- its 9-brick grid at 3px per brick. Drawn at 27 (1:1)
// so every brick stays an even square.
import mainFontUrl from "./assets/fonts/techbase-27_0.png?url";
import mainFontXmlUrl from "./assets/fonts/techbase-27.fnt?url";
// The same font exported at 18px (2px per brick) for the smaller intro text.
import smallFontUrl from "./assets/fonts/techbase-18_0.png?url";
import smallFontXmlUrl from "./assets/fonts/techbase-18.fnt?url";

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

        // Phaser reads Aseprite atlases natively; createFromAseprite() in the
        // scene turns each frameTag into an animation of the same name.
        this.load.aseprite("ship", shipUrl, shipJsonUrl);
        this.load.image("ship-bullet", shipBulletUrl);
        this.load.aseprite("neutron", neutronUrl, neutronJsonUrl);
        this.load.aseprite("neutron-odd", neutronOddUrl, neutronOddJsonUrl);
        this.load.aseprite("clover", cloverUrl, cloverJsonUrl);
        this.load.aseprite("firering", fireringUrl, fireringJsonUrl);
        this.load.aseprite("greywing", greywingUrl, greywingJsonUrl);
        this.load.aseprite("explosion", explosionUrl, explosionJsonUrl);
        this.load.aseprite("explosion-2", explosion2Url, explosion2JsonUrl);
        this.load.aseprite("firecave", firecaveUrl, firecaveJsonUrl);
        this.load.aseprite("firecomet", firecometUrl, firecometJsonUrl);
        this.load.image("emberstar", emberstarUrl);
        this.load.aseprite("bullet-enemy", bulletEnemyUrl, bulletEnemyJsonUrl);
        this.load.aseprite("powerup-bullets", powerupBulletsUrl, powerupBulletsJsonUrl);

        // Fonts
        this.load.bitmapFont("main-font", mainFontUrl, mainFontXmlUrl);
        this.load.bitmapFont("small-font", smallFontUrl, smallFontXmlUrl);

        // Event to update the loading bar
        this.load.on("progress", (progress) => {
            console.log("Loading: " + Math.round(progress * 100) + "%");
        });
    }

    create() {
        // BMFont's "Match char height" is what renders the font at its true
        // design size, but it records that size as negative (-24). Phaser
        // scales text by requested size / font size, so a negative font size
        // draws every string upside down. Flipped back once, here.
        const main_font = this.cache.bitmapFont.get("main-font").data;
        main_font.size = Math.abs(main_font.size);
        const small_font = this.cache.bitmapFont.get("small-font").data;
        small_font.size = Math.abs(small_font.size);

        // When all the assets are loaded go to the next scene
        this.scene.start("MainScene");
    }
}
