// Assets live in src/assets and are resolved by Vite at build time.
// The `?url` suffix is required: without it Vite parses .json into a JS
// object and does not recognise .xml as an asset at all. Files under
// 4096 bytes are inlined as base64 data URIs, which Phaser 3.80 accepts.

// Title logo: OBSIDION set in Sci Fi Adventure, halved to 142x16 and drawn
// at 7x (MenuScene) -- chunkier pixels, one letter's width from each edge.
import titleLogoUrl from "./assets/fonts/scifiadventure.png?url";
import nebulaBackUrl from "./assets/backgrounds/purple-nebula/back.png?url";
import nebulaFrontUrl from "./assets/backgrounds/purple-nebula/planets.png?url";
import galaxyBackUrl from "./assets/backgrounds/galaxy/back.png?url";
import galaxyFrontUrl from "./assets/backgrounds/galaxy/front.png?url";

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

// Main font: Katakis (C64) (FontStruct), a bitmap font exported from
// BMFont at 24px -- its 8-brick grid at 3px per brick. Drawn at 24 (1:1)
// so every brick stays an even square.
import mainFontUrl from "./assets/fonts/katakis-24_0.png?url";
import mainFontXmlUrl from "./assets/fonts/katakis-24.fnt?url";
// The same font exported at 16px (2px per brick) for the smaller intro text.
import smallFontUrl from "./assets/fonts/katakis-16_0.png?url";
import smallFontXmlUrl from "./assets/fonts/katakis-16.fnt?url";

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
        this.load.aseprite("neutron", neutronUrl, neutronJsonUrl);
        this.load.aseprite("neutron-odd", neutronOddUrl, neutronOddJsonUrl);
        this.load.aseprite("clover", cloverUrl, cloverJsonUrl);
        this.load.aseprite("firering", fireringUrl, fireringJsonUrl);
        this.load.aseprite("greywing", greywingUrl, greywingJsonUrl);
        this.load.aseprite("explosion", explosionUrl, explosionJsonUrl);
        this.load.aseprite("explosion-2", explosion2Url, explosion2JsonUrl);

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
