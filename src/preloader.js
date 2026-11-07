// Assets live in src/assets and are resolved by Vite at build time.
// The `?url` suffix is required: without it Vite parses .json into a JS
// object and does not recognise .xml as an asset at all. Files under
// 4096 bytes are inlined as base64 data URIs, which Phaser 3.80 accepts.

// Title logo: PARADOX set in Sci Fi Adventure, halved to 152x16 and drawn
// at 7x (MenuScene) -- chunkier pixels, one letter's width from each edge.
import titleLogoUrl from "./assets/fonts/scifiadventure.png?url";

// Player ship. Hand-painted, 32x32 indexed, three one-frame tags:
// level / bank-up / bank-down. Exported from Aseprite untrimmed in Array
// format with Tags on -- Phaser indexes the frames numerically, so Hash
// format will not load.
import shipUrl from "./assets/player/ship/raven.png?url";
import shipJsonUrl from "./assets/player/ship/raven.json?url";

// Lives icon (HudScene): the ship repainted at 12x12, one frame -- a plain
// image.
import livesIconUrl from "./assets/player/ship/raven-score-12p.png?url";

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

// Explosion. From a free Aseprite pack on itch, re-exported with our
// settings. 64x64, one tag, Animation (frames 0-8; frame 9 is empty).
import explosionUrl from "./assets/fx/explosion/explosion.png?url";
import explosionJsonUrl from "./assets/fx/explosion/explosion.json?url";

// Firecomet, level 2 A1. 32x32 indexed, six frames under one looping tag,
// firecomet-pulse. Same export settings as the ship.
import firecometUrl from "./assets/enemies/firecomet/firecomet.png?url";
import firecometJsonUrl from "./assets/enemies/firecomet/firecomet.json?url";

// Emberstar, level 2 A2. 32x32 indexed, one frame -- Phaser spins it, so a
// plain image, not an atlas.
import emberstarUrl from "./assets/enemies/emberstar/emberstar.png?url";

// Dragon, level 2 B1. 64x32 indexed, three frames: the head under
// dragon-head, the paler hit head under dragon-head-hit, and one body circle
// under dragon-body, painted where they join. Same export settings as the
// ship.
import dragonUrl from "./assets/enemies/dragon/dragon.png?url";
import dragonJsonUrl from "./assets/enemies/dragon/dragon.json?url";

// Delta, level 2. 32x32 indexed, 13 frames under one looping tag,
// delta-spin. Same export settings as the ship.
import deltaUrl from "./assets/enemies/delta/delta.png?url";
import deltaJsonUrl from "./assets/enemies/delta/delta.json?url";

// Station X's own aliens, each 32x32 indexed, same export settings as the
// ship: raider (raider-loop), xwing (xwing-loop), enforcer (enforcer-roll and
// enforcer-level) and moon (moon-loop).
import raiderUrl from "./assets/enemies/raider/raider.png?url";
import raiderJsonUrl from "./assets/enemies/raider/raider.json?url";
import xwingUrl from "./assets/enemies/xwing/xwing.png?url";
import xwingJsonUrl from "./assets/enemies/xwing/xwing.json?url";
import enforcerUrl from "./assets/enemies/enforcer/enforcer.png?url";
import enforcerJsonUrl from "./assets/enemies/enforcer/enforcer.json?url";
import moonUrl from "./assets/enemies/moon/moon.png?url";
import moonJsonUrl from "./assets/enemies/moon/moon.json?url";

// Ember ring, level 2's last wave. 64x64 indexed, one frame -- Phaser spins
// it, so a plain image, not an atlas.
import emberRingUrl from "./assets/enemies/ember-ring/ember-ring.png?url";

// Enemy bullet, fired by aliens from level 2's A2 on. 6x6 indexed, two
// frames under one looping tag, bullet-enemy-blink. Same export settings as
// the ship.
import bulletEnemyUrl from "./assets/enemies/bullet/bullet-enemy.png?url";
import bulletEnemyJsonUrl from "./assets/enemies/bullet/bullet-enemy.json?url";

// Power-up, the bullet power drop. 24x24 indexed, six frames under one
// looping tag, powerup-bullet-spin (the slanted bar inside turns). Same
// export settings as the ship.
import powerupBulletsUrl from "./assets/powerups/powerup-bullets.png?url";
import powerupBulletsJsonUrl from "./assets/powerups/powerup-bullets.json?url";

// Power-up, the shield drop. Same as the bullet drop, its own colour, tag
// powerup-shield-spin.
import powerupShieldUrl from "./assets/powerups/powerup-shield.png?url";
import powerupShieldJsonUrl from "./assets/powerups/powerup-shield.json?url";

// Power-up, the speed drop. Same as the bullet drop, its own colour, tag
// powerup-speed-spin.
import powerupSpeedUrl from "./assets/powerups/powerup-speed.png?url";
import powerupSpeedJsonUrl from "./assets/powerups/powerup-speed.json?url";

// The shield round the ship. 32x32 indexed, a quarter ring, two frames under
// shield-spin (a dark blue blink); Phaser turns it.
import shieldUrl from "./assets/shield/shield.png?url";
import shieldJsonUrl from "./assets/shield/shield.json?url";

// Fire cave, level 2's walls. 128x64 indexed, ten frames under the tag
// firecave-loop. Same export settings as the ship.
import firecaveUrl from "./assets/enviro/firecave/firecave.png?url";
import firecaveJsonUrl from "./assets/enviro/firecave/firecave.json?url";

// Asteroids, level 3's belt. 32x32 indexed, one frame each, no tags -- plain
// images.
import asteroid1Url from "./assets/enviro/asteroid/asteroid-1.png?url";
import asteroid2Url from "./assets/enviro/asteroid/asteroid-2.png?url";
import asteroid3Url from "./assets/enviro/asteroid/asteroid-3.png?url";

// Station, level 4: Station X traced in Tiled, three maps of the same 8x8
// tiles (station-x-tiles.png, 3088x8), drawn at 3x (Station.js). Each .tmj is
// its .tmx exported as JSON.
import stationXTilesUrl from "./assets/enviro/station-x/station-x-tiles.png?url";
import stationXMapUrl from "./assets/enviro/station-x/station-x.tmj?url";
import stationX1MapUrl from "./assets/enviro/station-x/station-x-1.tmj?url";
import stationX2MapUrl from "./assets/enviro/station-x/station-x-2.tmj?url";

// Zap, Station X's electrifier bolt between two fangs: 24x46 (the short
// fangs' gap), nine frames under zap-46-loop -- eight of crackle, then an
// empty 1000 ms frame, the gap to fly through. Same export settings as the
// ship. Placed by the zap object layer in each map (Station.js).
import zap46Url from "./assets/enviro/zap/zap-46px.png?url";
import zap46JsonUrl from "./assets/enviro/zap/zap-46px.json?url";

// Zap for the tall fangs: a laser, 24x118, three frames under zap-118-loop --
// two of blink, then an empty 1000 ms frame.
import zap118Url from "./assets/enviro/zap/zap-118px.png?url";
import zap118JsonUrl from "./assets/enviro/zap/zap-118px.json?url";

// Main font: Katakis (C64) (FontStruct, Patrick H. Lauke), a bitmap font
// exported from BMFont at 24px -- its 8-brick grid at 3px per brick. Drawn
// at 24 (1:1) so every brick stays an even square.
import mainFontUrl from "./assets/fonts/katakis-24_0.png?url";
import mainFontXmlUrl from "./assets/fonts/katakis-24.fnt?url";

// HUD font: the same Katakis 24 repainted dark lilac, for the top HUD's
// score and HI. Same glyph layout as the main font's PNG, so it shares
// katakis-24.fnt.
import hudFontUrl from "./assets/fonts/katakis-lilac-24_0.png?url";

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
        this.load.image("lives-icon", livesIconUrl);
        this.load.image("ship-bullet", shipBulletUrl);
        this.load.aseprite("neutron", neutronUrl, neutronJsonUrl);
        this.load.aseprite("neutron-odd", neutronOddUrl, neutronOddJsonUrl);
        this.load.aseprite("clover", cloverUrl, cloverJsonUrl);
        this.load.aseprite("firering", fireringUrl, fireringJsonUrl);
        this.load.aseprite("greywing", greywingUrl, greywingJsonUrl);
        this.load.aseprite("explosion", explosionUrl, explosionJsonUrl);
        this.load.aseprite("firecave", firecaveUrl, firecaveJsonUrl);
        this.load.aseprite("firecomet", firecometUrl, firecometJsonUrl);
        this.load.image("emberstar", emberstarUrl);
        this.load.aseprite("dragon", dragonUrl, dragonJsonUrl);
        this.load.aseprite("delta", deltaUrl, deltaJsonUrl);
        this.load.aseprite("raider", raiderUrl, raiderJsonUrl);
        this.load.aseprite("xwing", xwingUrl, xwingJsonUrl);
        this.load.aseprite("enforcer", enforcerUrl, enforcerJsonUrl);
        this.load.aseprite("moon", moonUrl, moonJsonUrl);
        this.load.image("ember-ring", emberRingUrl);
        this.load.aseprite("bullet-enemy", bulletEnemyUrl, bulletEnemyJsonUrl);
        this.load.aseprite("powerup-bullets", powerupBulletsUrl, powerupBulletsJsonUrl);
        this.load.aseprite("powerup-shield", powerupShieldUrl, powerupShieldJsonUrl);
        this.load.aseprite("powerup-speed", powerupSpeedUrl, powerupSpeedJsonUrl);
        this.load.aseprite("shield", shieldUrl, shieldJsonUrl);
        this.load.image("asteroid-1", asteroid1Url);
        this.load.image("asteroid-2", asteroid2Url);
        this.load.image("asteroid-3", asteroid3Url);
        this.load.image("station-x-tiles", stationXTilesUrl);
        this.load.tilemapTiledJSON("station-x", stationXMapUrl);
        this.load.tilemapTiledJSON("station-x-1", stationX1MapUrl);
        this.load.tilemapTiledJSON("station-x-2", stationX2MapUrl);
        this.load.aseprite("zap-46px", zap46Url, zap46JsonUrl);
        this.load.aseprite("zap-118px", zap118Url, zap118JsonUrl);

        // Fonts
        this.load.bitmapFont("main-font", mainFontUrl, mainFontXmlUrl);
        this.load.bitmapFont("hud-font", hudFontUrl, mainFontXmlUrl);

        // Event to update the loading bar
        this.load.on("progress", (progress) => {
            console.log("Loading: " + Math.round(progress * 100) + "%");
        });
    }

    create() {
        // BMFont's "Match char height" is what renders the font at its true
        // design size, but it records that size as negative (-24). Phaser
        // scales text by requested size / font size, so a negative font size
        // draws every string upside down. Flipped back once per font, here.
        for (const key of ["main-font", "hud-font"]) {
            const font = this.cache.bitmapFont.get(key).data;
            font.size = Math.abs(font.size);
        }

        // When all the assets are loaded go to the next scene
        this.scene.start("MainScene");
    }
}
