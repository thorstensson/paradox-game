import { Curves, Geom, Math as PhaserMath } from "phaser";
import { paintedBox } from "./FirecometTrack";
import { EnemyBullets } from "./EnemyBullets";
import { Boss, BOSS_KEY } from "./Boss";
import { playSound } from "../sounds";

// Level 4, Station X (NOTES.md -> Level 4 Concepts): the two maps traced in
// Tiled, side by side, in from the right edge and off to the left.
//
// Each map's station layer is drawn as a tilemap layer at 3x and is the wall:
// a painted pixel of it on a painted pixel of the ship kills, as the flames
// do.
//
// Each polyline on a map's waves layer is one ship's route. Its Class is the
// alien (its folder and texture key), its Name wave-alien-place, as
// w1-delta-top. Its first point is where the ship comes in: the ship wakes as
// that point passes just outside the right edge. At that moment the line is
// pinned to the screen where it is (2026-11-08, Thomas's pick): the walls
// scroll on under it, and every ship of the chain flies the whole line as
// drawn, at 3x, curved smoothly through its points -- as the waves of levels
// 1 and 2 fly their shapes against the screen.

// The ship's pixel size, as everything in the game.
const SCALE = 3;

// The station moves STEP screen px every TICK ms, an even 5 px per frame on a
// 60 Hz screen: 300 px/s (was 337.6, the fire cave's speed, which could only
// step 6, 6, 5... px and jittered; Thomas's pick, 2026-11-07). Timed by the
// clock, not by frames, so a faster screen does not scroll it faster.
const STEP = 5;
const TICK = 1000 / 60;
const SPEED = STEP * 1000 / TICK;

// The outro (leave): the station moves out at LEAVE_STEP px a tick, 180 px/s,
// slower than in the level (Thomas, 2026-11-15: "moving away too fast"). A
// placeholder to tune by playing.
const LEAVE_STEP = 3;

// The station eases to a stop with its last map's right edge on the
// screen's right edge (Thomas, 2026-11-11: the boss comes in there). Over its
// last SLOW_DISTANCE screen px each step shrinks smoothly from STEP to 0, an
// even slowdown: about 2 s from 300 px/s. A placeholder to tune by playing.
const SLOW_DISTANCE = 300;

// The maps in the order they come in, by their keys in preloader.js.
// Two maps, not three (Thomas, 2026-11-10; station-x-2 out 2026-11-11).
const MAPS = [ "station-x", "station-x-1" ];

// The aliens a route's Class can name, by texture key, each with its own
// animation, chain length, speed (screen px/s), points and hit box, as its
// wave has them: DeltaWave.js:18-25 and :110, NeutronWave.js:17-33 and :101.
// Repeated here so those waves stay as they are. A null box is the alien's
// painted extent (paintedBox), as the delta's is.
//
// The station is a fast level: every alien flies at 715.8, 20% over the
// delta's own 596.5 (the neutron's own wave flies at 477).
//
// The station's own aliens (raider, xwing, enforcer, moon) have no wave of
// their own yet: chain 7, one hit, 100 points, painted box -- placeholders
// until they are played. An alien with "then" and "hold" (ms) plays two tags
// in turn (playInTurn); none does now.
//
// The speed is screen px/s along the pinned line.
//
// The enforcer (2026-11-07, first pass; new sleek art 2026-11-09 with its
// engines on one looping tag, enforcer-loop, never rotated): a chain
// of 4, "spacing" 4 sprite widths apart (384 px), and speed 500, slow next to
// the others.
//
// An alien with "fire_at" fires one shot, once it has flown that many screen
// px of its line: the red dash, straight ahead out of its nose (its leftmost
// painted pixel), not aimed -- one more thing to fly round (2026-11-09,
// Thomas). The enforcer fires at 300, a placeholder to tune by playing.
//
// The electroball (2026-11-09, first pass): a chain of 5 at the moon's
// speed, 400 (Thomas, after a first try at chain 7, speed 500).
// One hit: a placeholder.
//
// "hits": bullets it takes to die, 1 if left out. The enforcer and the moon
// take 3 (Thomas, 2026-11-09): a bullet that does not kill is used up and
// the alien flies on, as the firering does. Points and the drop come
// only with the kill. A missile kills any alien outright.
//
// The moon (2026-11-08, first pass): a slow object, speed 400. A chain of 5
// (7 until 2026-11-09),
// spacing 3 sprite widths apart (288 px).
const ALIENS = {
    // Chain 5 since 2026-11-09 (Thomas): the first delta wave, top and bottom.
    delta: { anim: "delta-spin", chain: 5, speed: 715.8, points: 100, box: null },
    neutron: { anim: "spin", chain: 7, speed: 715.8, points: 100, box: { x: -13, y: -4, w: 26, h: 9 } },
    raider: { anim: "raider-loop", chain: 7, speed: 715.8, points: 100, box: null },
    xwing: { anim: "xwing-loop", chain: 7, speed: 715.8, points: 100, box: null },
    enforcer: { anim: "enforcer-loop", chain: 4, spacing: 4, speed: 500, points: 100, box: null, fire_at: 300, hits: 3 },
    moon: { anim: "moon-loop", chain: 5, spacing: 3, speed: 400, points: 100, box: null, hits: 3 },
    electroball: { anim: "electro-loop", chain: 5, speed: 400, points: 100, box: null },
    // The rocket (2026-11-11, first pass, after Zynaps): 16x16, the station
    // delta's speed (Thomas), spacing 2 (192 px between centres, Thomas).
    // Chain 1: one rocket per line, launched one by one from small
    // horizontal lines, as in Katakis (Thomas). Hits and points: placeholders.
    rocket: { anim: "rocket-loop", chain: 1, spacing: 2, speed: 715.8, points: 100, box: null }
};

// The lines that drop a power-up, by their Name in Tiled: the kind they drop
// (PowerUps.js) and "at", the ship of the line that drops it when shot, by
// its position in the chain, from 1, the first to come in (Thomas,
// 2026-11-15). The drop comes out of that ship's explosion.
const DROPS = {
    "w1-delta-top": { kind: "missile", at: 2 },
    // Thomas, 2026-11-11: the shield and the railgun (the bullets drop).
    "w1-enforcer": { kind: "shield", at: 1 },
    "w1-moon": { kind: "bullets", at: 2 },
    // station-x-1 (names end in -x1, Thomas): the same three, mirrored.
    "w1-enforcer-x1": { kind: "shield", at: 1 },
    "w1-moon-x1": { kind: "bullets", at: 2 },
    "w1-delta-top-x1": { kind: "missile", at: 2 },
    // Electroball floaters, by their Name on the gun layer: the drop comes
    // out of its explosion when it is killed (Thomas, 2026-11-15).
    "e1-electroball-x1": { kind: "missile" },
    "e2-electroball-x2": { kind: "bullets" }
};

// The red dash's speed, screen px/s: faster than any alien that fires it, or
// the alien would fly into its own shot. The ship's own bullet speed
// (PlayerBullets.js), a placeholder to tune by playing.
const RED_BULLET_SPEED = 900;

// Half a 32x32 alien at 3x: ships wake and leave fully off-screen.
const MARGIN = 16 * SCALE;

// Between two ships of a chain along their line, px: one sprite width, the
// gap between centres the waves keep.
const GAP = 32 * SCALE;

// The zaps, the electrifier bolts between two fangs, by texture key (the
// .aseprite's name), each with its looping tag. A zap can't be shot; only its
// painted pixels in the frame on show kill, so its empty frame is the gap to
// fly through.
const ZAPS = {
    "zap-46px": { anim: "zap-46-loop" },
    "zap-118px": { anim: "zap-118-loop" }
};

// The pods, by texture key (the .aseprite's name), placed on each map's gun
// layer as image objects (Tiled gives their bottom-left). Only the objects
// whose picture is a pod here, or a gun in GUNS, are read; gun-diagonal is
// not in the game yet.
//
// The vulcan (Thomas, 2026-11-10, after Katakis): sits on a block, opens and
// closes all the time (vulcan-loop). While it is fully on screen it releases
// RELEASE_SHOTS bullets, like pollen from a flower: all from one point in its
// opening (the top of its painted pixels, in the middle), each flying
// straight, never turning, not aimed. The first goes nearly straight up; each
// next one leaves a little more angled, on the other side, so the release
// opens from narrow to a V, FIRST_ANGLE to LAST_ANGLE either side of straight
// up. A random gap between bullets, SHOT_GAP_MIN to SHOT_GAP_MAX; after the
// last, RELEASE_PAUSE_MS, then the next release. Takes 10 hits, every bullet
// that lands one, as on the station's aliens; a missile counts MISSILE_HITS, so two
// missiles kill it. Points: a placeholder. Only upright vulcans for now
// (Thomas tries these before the flipped set).
const PODS = {
    vulcan: {
        anim: "vulcan-loop",
        hits: 10,
        points: 100,
        bullet: "bullet-vulcan",
        bullet_anim: "bullet-vulcan-blink",
        // Slow, a pod not a gun (Thomas): screen px/s along its angle, on
        // top of riding with the station. A placeholder.
        bullet_speed: 120
    },

    // The gun (Thomas, 2026-11-11), drawn from gun-sheet. It turns toward
    // the ship: of its two frames, gun-level (barrel level, left) and
    // gun-track (barrel 45 degrees up-left), it shows the one pointing
    // closer to the ship; with the ship to its right, gun-level. While fully
    // on screen it fires one bullet every GUN_FIRE_MS, from the end of its
    // barrel, the way the barrel points, never aimed. Hits, points and the
    // bullet's speed (the usual enemy bullet's, EnemyBullets.js) are
    // placeholders to tune by playing.
    "gun-sheet": {
        gun: true,
        hits: 10,
        points: 100,
        bullet: "bullet-vulcan",
        bullet_anim: "bullet-vulcan-blink",
        bullet_speed: 240
    },

    // The diamond gun (Thomas, 2026-11-11): one picture, never turns. Its
    // six barrels (diamondBarrels) fire in turn, round the diamond, each
    // once every GUN_FIRE_MS, straight out the way it points: the left ones
    // at bullet_speed, the right ones at bullet_speed_right -- twice the
    // station's speed, so they fly off to the right (Thomas) -- both on top
    // of riding with the station. Hits and points are placeholders.
    "gun-diamond": {
        diamond: true,
        frame: "__BASE",
        // Twice the vulcan's (Thomas): four missiles kill it.
        hits: 20,
        points: 100,
        bullet: "bullet-vulcan",
        bullet_anim: "bullet-vulcan-blink",
        bullet_speed: 240,
        bullet_speed_right: 2 * SPEED
    },

    // The electroball as a floater (Thomas, 2026-11-11): a point on the gun
    // layer with Class electroball is its middle. It rides with the station
    // and floats round that point (FLOAT_*), never fires. Hits and points as
    // the electroball in the waves: placeholders.
    electroball: {
        floater: true,
        anim: "electro-loop",
        hits: 1,
        points: 100
    }
};

// A floater's float round its point: up to FLOAT_RANGE native px each way,
// left-right once every FLOAT_X_MS, up-down once every FLOAT_Y_MS, so it
// wanders in a loop; each floater starts at a different place in it, so
// they are out of step. Placeholders to tune by playing.
const FLOAT_RANGE = 10;
const FLOAT_X_MS = 2000;
const FLOAT_Y_MS = 1500;

// The guns' pictures in Tiled (gun.png, gun-inverted.png on the gun layer),
// each drawn in the game from gun-sheet; the roof one upside down
// (Thomas, 2026-11-10: no inverted art in the game).
const GUNS = {
    gun: { flipped: false },
    "gun-inverted": { flipped: true }
};

// gun-sheet's frames: gun-level and gun-track.
const GUN_LEVEL = "0";
const GUN_TRACK = "1";

// Halfway between the gun's two directions, level and 45 degrees: a ship
// more than this far above level (below, for a roof gun) gets gun-track.
const GUN_TURN = PhaserMath.DegToRad(22.5);

// One bullet a second (Thomas, a placeholder).
const GUN_FIRE_MS = 1000;

// Thomas's release: 10 bullets. The angles (degrees from straight up), the
// random gap (ms) and the pause after a release are placeholders to tune by
// playing.
const RELEASE_SHOTS = 10;
const FIRST_ANGLE = 4;
const LAST_ANGLE = 35;
const SHOT_GAP_MIN = 300;
const SHOT_GAP_MAX = 800;
const RELEASE_PAUSE_MS = 2000;

// Hits a missile counts on a pod: two missiles kill a vulcan (Thomas).
const MISSILE_HITS = 5;

// Alien sprites made up front and reused, as the explosions are: making and
// destroying sprites mid-level can stutter. 40 covers several chains on
// screen at once; more are made only if ever needed.
const POOL_SIZE = 40;

// Tiled's flip bits on a tile number (doc.mapeditor.org, Global Tile IDs).
// The diagonal flip comes first, then the horizontal and vertical ones.
const FLIPPED_H = 0x80000000;
const FLIPPED_V = 0x40000000;
const FLIPPED_D = 0x20000000;
const TILE_NUMBER = 0x1fffffff;

export class Station {
    maps = [];

    // Every map's background and station layers, each with its map's offset.
    layers = [];

    // Native px from the station's left edge to each map's.
    offsets = [];

    // Routes whose ship has not come in yet, and ships flying their route.
    routes = [];
    ships = [];

    // Every route on every map, kept so a restart can put them back.
    all_routes = [];

    // The restart markers: X of every object on each map's markers layer
    // (spawn-1, spawn-2...), native px from the station's left edge, in
    // order. After a lost ship the station goes back so the last one passed
    // sits at the right edge (Thomas's pick B, 2026-11-09).
    markers = [];

    // Dev only: X of the point named dev-start on a map's markers layer,
    // native px from the station's left edge, or null if there is none; not
    // a restart marker. The 5 key starts the station there, and in that run
    // a lost ship always goes back to it (dev_run). Thomas, 2026-11-11; goes
    // with the dev keys before release.
    dev_start = null;
    dev_run = false;

    // Alien sprites not in use, hidden, ready for the next chain.
    pool = [];

    // Every zap: its sprite and its top-left in native station px.
    zaps = [];

    // Per zap texture, per frame name: which native pixels are painted.
    zap_masks = {};

    // Every pod: its sprite, its centre in native station px, the hits it
    // has taken, and where it is in its release.
    pods = [];

    // Per pod texture, per frame name: which native pixels are painted.
    pod_masks = {};

    // Per pod texture: its painted box over all frames, native px from the
    // centre (what the ship's bullets and missiles hit).
    pod_boxes = {};

    // Per pod texture: its bullets in flight.
    pod_bullets = {};

    // Per gun-sheet frame: the end of the barrel, native px from the
    // sprite's centre, upright (gunTips).
    gun_tips = {};

    // The diamond gun's six barrels, in the order they fire
    // (diamondBarrels).
    diamond_barrels = [];

    // Hit box per alien, native px from the sprite's centre.
    boxes = {};

    // Nose per alien that fires: its leftmost painted pixel, native px from
    // the sprite's centre.
    noses = {};

    // The red dashes the station's aliens have fired.
    bullets = null;

    // The painted station, one byte per native pixel, 1 for wall.
    mask = null;
    mask_width = 0;
    mask_height = 0;

    // Screen x of the station's left edge.
    x = 0;

    // ms not yet turned into STEPs.
    clock = 0;
    gone = false;

    // Screen x of the station's left edge where it stops: its last map's
    // right edge on the screen's right edge.
    stop_x = 0;

    // True from the outro on (leave): moving out at LEAVE_STEP.
    leaving = false;

    // The boss (Boss.js), in once the station has stopped.
    boss = null;

    // endboss-alert has sounded for this approach to the stop.
    alerted = false;

    // ms the station has run: the floaters' float.
    float_clock = 0;

    // Built once in MainScene.create(), long before level 4, so the work of
    // reading the maps and the wall happens behind the intro, not as the
    // station comes in. Hidden until start().
    constructor(scene) {
        this.scene = scene;
        this.x = scene.scale.width;
        this.view_height = scene.cameras.main.height;

        for (let i = 0; i < POOL_SIZE; i++) {
            this.pool.push(this.newSprite());
        }

        for (const [ key, alien ] of Object.entries(ALIENS)) {
            this.boxes[key] = alien.box ?? paintedBox(scene, key);

            if (alien.fire_at !== undefined) {
                this.noses[key] = nose(scene, key);
            }
        }

        this.bullets = new EnemyBullets(scene, {
            key: "bullet-red-enemy",
            anim: null,
            speed: RED_BULLET_SPEED
        });

        for (const [ key, pod ] of Object.entries(PODS)) {
            // A bullet pool only for the pods that fire (not the floaters).
            if (pod.bullet) {
                this.pod_bullets[key] = new EnemyBullets(scene, {
                    key: pod.bullet,
                    anim: pod.bullet_anim,
                    speed: pod.bullet_speed
                });
            }

            this.pod_boxes[key] = paintedBox(scene, key);
            this.pod_masks[key] = paintedFrames(scene, key);
        }

        this.gun_tips = gunTips(this.pod_masks["gun-sheet"]);
        this.diamond_barrels = diamondBarrels(scene, "gun-diamond");

        let offset = 0;

        for (const key of MAPS) {
            const map = scene.make.tilemap({ key });
            const tiles = map.addTilesetImage("station-x-tiles", "station-x-tiles");

            // Behind the ship and the aliens, in front of the stars. The
            // background layer (the X) first, so it sits behind the station;
            // it is flown through, never a wall.
            for (const name of [ "background", "station" ]) {
                const layer = map.createLayer(name, tiles, this.x + offset * SCALE, 0)
                    .setScale(SCALE).setDepth(-1).setVisible(false);

                this.layers.push({ layer, offset });
            }

            this.maps.push(map);
            this.offsets.push(offset);

            this.readRoutes(scene.cache.tilemap.get(key).data, offset);
            this.readZaps(scene.cache.tilemap.get(key).data, offset);
            this.readMarkers(scene.cache.tilemap.get(key).data, offset);
            this.readPods(scene.cache.tilemap.get(key).data, offset);

            offset += map.widthInPixels;
        }

        this.all_routes = [ ...this.routes ];
        this.markers.sort((a, b) => a - b);

        this.mask_width = offset;
        this.mask_height = this.maps[0].heightInPixels;
        this.stop_x = scene.scale.width - this.mask_width * SCALE;

        // Made now, hidden, as the station is: it comes in once the station
        // stops.
        this.boss = new Boss(scene, BOSS_KEY, paintedFrames(scene, BOSS_KEY));
        this.mask = paintedStation(scene, this);
    }

    // Every object on the map's zap layer becomes a zap, hidden until
    // start(). Either an image object (the zap's PNG in a Collection of
    // Images tileset, placed like the guns: Tiled gives its bottom-left), or
    // a point whose Class is the zap's name (zap-46px), at its top-left.
    readZaps(data, offset) {
        const layer = data.layers.find((l) => l.name === "zap");

        for (const object of layer?.objects ?? []) {
            let key = object.type;
            let top = object.y;

            if (object.gid) {
                const number = object.gid & TILE_NUMBER;
                const tileset = data.tilesets.find((t) => t.tiles
                    && number >= t.firstgid && number < t.firstgid + t.tilecount);
                const tile = tileset?.tiles.find((t) => t.id === number - tileset.firstgid);

                key = tile?.image.split(/[\\/]/).pop().replace(/\.png$/, "");
                top = object.y - (ZAPS[key] ? this.scene.textures.getFrame(key, "0").height : 0);
            }

            if (!ZAPS[key]) {
                console.warn(`Station: zap object ${object.id} names no known zap: "${key}"`);
                continue;
            }

            if (!this.zap_masks[key]) {
                this.zap_masks[key] = paintedFrames(this.scene, key);
            }

            const sprite = this.scene.add.sprite(0, 0, key)
                .setOrigin(0, 0)
                .setScale(SCALE)
                .setDepth(-1)
                .setVisible(false);

            sprite.play({ key: ZAPS[key].anim, repeat: -1 });

            this.zaps.push({ sprite, key, x: offset + object.x, y: top });
        }
    }

    // Every object on the map's markers layer: only its X is read, so a
    // point is enough. A map without the layer has no markers. The dev-start
    // point is kept apart, never a restart marker.
    readMarkers(data, offset) {
        const layer = data.layers.find((l) => l.name === "markers");

        for (const object of layer?.objects ?? []) {
            if (object.name === "dev-start") {
                this.dev_start = offset + object.x;
                continue;
            }

            this.markers.push(offset + object.x);
        }
    }

    // Every object on the map's gun layer whose picture is a pod (PODS)
    // becomes one, hidden until start(). Tiled gives its bottom-left; the
    // sprite is placed by its centre.
    readPods(data, offset) {
        const layer = data.layers.find((l) => l.name === "gun");

        for (const object of layer?.objects ?? []) {
            // A gun's picture in Tiled (gun, gun-inverted) is drawn from
            // gun-sheet. A point names its pod by its Class, and only a
            // floater is placed by a point.
            const image = object.point ? object.type : tileImage(data, object.gid);
            const gun = GUNS[image];
            const key = gun ? "gun-sheet" : image;

            if (!PODS[key] || (object.point && !PODS[key].floater)) {
                continue;
            }

            // Flipped vertically in Tiled (Y): it hangs under its block and
            // releases downward. Tiled keeps the same box, bottom-left at
            // X/Y, and flips the picture inside it. gun-inverted is a roof
            // gun already, so a Y on it would stand it up again.
            const flipped = ((object.gid & FLIPPED_V) !== 0) !== (gun?.flipped ?? false);

            // A plain picture (the diamond gun) has only its base frame.
            const frame = this.scene.textures.getFrame(key, PODS[key].frame ?? "0");
            const sprite = this.scene.add.sprite(0, 0, key)
                .setScale(SCALE)
                .setFlipY(flipped)
                .setDepth(-1)
                .setVisible(false);

            if (PODS[key].gun) {
                sprite.setFrame(GUN_LEVEL);
            } else if (PODS[key].anim) {
                sprite.play({ key: PODS[key].anim, repeat: -1 });
            }

            // A point is the floater's middle; a picture's X/Y is its
            // bottom-left.
            this.pods.push({
                sprite,
                key,
                // Its Name in Tiled: an electroball's drop (DROPS).
                name: object.name,
                pod: PODS[key],
                flipped,
                x: object.point ? offset + object.x : offset + object.x + frame.width / 2,
                y: object.point ? object.y : object.y - frame.height / 2,
                // Where in its float a floater starts, 0 to 1: each one
                // further on than the last, so they float out of step.
                float_start: (this.pods.length * 0.37) % 1,
                taken: 0,
                dead: false,
                wait: null,
                shots: 0
            });
        }
    }

    // Every polyline on the map's waves layer, offset to where the map sits
    // in the station, in station screen px.
    readRoutes(data, offset) {
        const waves = data.layers.find((layer) => layer.name === "waves");

        for (const object of waves?.objects ?? []) {
            if (!object.polyline) {
                continue;
            }

            const alien = ALIENS[object.type];

            if (!alien) {
                console.warn(`Station: route "${object.name}" names no known alien: "${object.type}"`);
                continue;
            }

            const points = object.polyline.map((point) => new PhaserMath.Vector2(
                (offset + object.x + point.x) * SCALE,
                (object.y + point.y) * SCALE
            ));
            const path = new Curves.Spline(points);

            this.routes.push({
                name: object.name,
                key: object.type,
                alien,
                path,
                length: path.getLength(),
                start: points[0],
                start_direction: path.getTangentAt(0),
                end: points[points.length - 1],
                end_direction: path.getTangentAt(1)
            });
        }
    }

    // Level 4 begins: the station shows, in from the right edge.
    start() {
        this.layers.forEach(({ layer }) => layer.setVisible(true));
        this.zaps.forEach(({ sprite }) => sprite.setVisible(true));
        this.pods.forEach(({ sprite, dead }) => sprite.setVisible(!dead));
    }

    // A ship is lost: the ships on screen vanish, as a called-off wave's do.
    // Routes still to come stay, further along the station. The pods'
    // bullets in flight go too.
    callOff() {
        this.ships.forEach((ship) => this.release(ship.sprite));
        this.ships = [];
        this.bullets.clear();
        Object.values(this.pod_bullets).forEach((pool) => pool.clear());
    }

    // After a lost ship, while the screen is black: the station goes back so
    // the last marker passed (on screen or gone by) sits at the right edge,
    // or to its own start if none was passed. Every wave whose first point
    // lies right of that marker is put back and comes in again as the
    // station scrolls, at its own first point; the walls and zaps follow the
    // station, so they come back with it.
    restart() {
        const width = this.scene.scale.width;
        const passed = this.markers.filter((marker) => this.x + marker * SCALE <= width);

        // Dev only: a run started with the 5 key always goes back to
        // dev-start.
        const marker = this.dev_run
            ? this.dev_start
            : (passed.length ? passed[passed.length - 1] : null);

        // The boss is whole again, and comes in again once the station has
        // stopped again (Thomas); its alert sounds again as the station
        // slows.
        this.boss.reset();
        this.alerted = false;

        this.callOff();
        this.clock = 0;

        if (marker === null) {
            this.x = width;
            this.routes = [ ...this.all_routes ];
        } else {
            this.x = width - marker * SCALE;
            this.routes = this.all_routes.filter((route) => route.start.x > marker * SCALE);
        }

        // Every pod right of that marker is back, whole, and starts its
        // releases afresh as it comes on screen again. The pods left of it
        // stay as they were.
        for (const pod of this.pods) {
            pod.wait = null;
            pod.shots = 0;

            if (marker === null || pod.x > marker) {
                pod.dead = false;
                pod.taken = 0;
                pod.sprite.setVisible(true);
            }
        }
    }

    // Dev only (the 5 key), before the station starts: it is moved on so the
    // dev-start point sits at the right edge, as a restart marker would, and
    // every wave whose first point lies left of it is dropped. From then on
    // a lost ship goes back to dev-start (restart). False if no map has a
    // dev-start point.
    jumpToDevStart() {
        if (this.dev_start === null) {
            return false;
        }

        this.x = this.scene.scale.width - this.dev_start * SCALE;
        this.routes = this.all_routes.filter((route) => route.start.x > this.dev_start * SCALE);
        this.dev_run = true;
        return true;
    }

    destroy() {
        this.callOff();
        this.boss?.destroy();
        this.pool.forEach((sprite) => sprite.destroy());
        this.pool = [];
        this.zaps.forEach(({ sprite }) => sprite.destroy());
        this.zaps = [];
        this.pods.forEach(({ sprite }) => sprite.destroy());
        this.pods = [];
        this.maps.forEach((map) => map.destroy());
        this.maps = [];
        this.layers = [];
        this.routes = [];
        this.all_routes = [];
        this.gone = true;
    }

    // The outro (Outro.js): the stop is lifted and the station moves on to
    // the left at LEAVE_STEP, until its end is off the left edge and it is
    // gone (update).
    leave() {
        this.stop_x = -Infinity;
        this.leaving = true;
    }

    update(_time, delta, bullets, explosions) {
        if (this.gone) {
            return;
        }

        const step = delta / 1000;

        // Whole STEPs only. Rounded, not floored: frame times wobble a little
        // around TICK, and rounding keeps that from dropping or doubling a
        // step; what is left over carries on to the next frame.
        this.clock += delta;

        const ticks = Math.round(this.clock / TICK);

        this.clock -= ticks * TICK;

        const before = Math.round(this.x);

        // An even STEP each tick; within SLOW_DISTANCE of the stop, a step in
        // proportion to the square root of the distance left (an even
        // slowdown), down to the stop and no further.
        for (let i = 0; i < ticks; i++) {
            const left = this.x - this.stop_x;
            const move = this.leaving ? LEAVE_STEP
                : left < SLOW_DISTANCE ? STEP * Math.sqrt(Math.max(left, 0) / SLOW_DISTANCE) : STEP;

            // The slowdown has begun: the boss is about 2 s away (sounds.js).
            if (!this.leaving && !this.alerted && left < SLOW_DISTANCE) {
                this.alerted = true;
                playSound(this.scene, "endboss-alert");
            }

            this.x = Math.max(this.stop_x, this.x - move);
        }

        const x = Math.round(this.x);

        // The whole px the walls moved this frame: the pods' bullets ride by
        // the same.
        const moved = before - x;

        this.layers.forEach(({ layer, offset }) => {
            layer.x = x + offset * SCALE;
        });

        for (const zap of this.zaps) {
            zap.sprite.setPosition(x + zap.x * SCALE, zap.y * SCALE);
        }

        this.float_clock += delta;

        for (const pod of this.pods) {
            let float_x = 0;
            let float_y = 0;

            // A floater floats round its point, in whole screen px.
            if (pod.pod.floater) {
                const turn = 2 * Math.PI;

                float_x = Math.round(FLOAT_RANGE * SCALE
                    * Math.sin(turn * (this.float_clock / FLOAT_X_MS + pod.float_start)));
                float_y = Math.round(FLOAT_RANGE * SCALE
                    * Math.sin(turn * (this.float_clock / FLOAT_Y_MS + pod.float_start)));
            }

            pod.sprite.setPosition(x + pod.x * SCALE + float_x, pod.y * SCALE + float_y);
        }

        // Before the aliens are tested, so no alien is shot through a wall.
        this.stopBullets(bullets, x);

        const edge = this.scene.scale.width + MARGIN;

        this.routes = this.routes.filter((route) => {
            if (x + route.start.x > edge) {
                return true;
            }

            this.wake(route, x);
            return false;
        });

        // The red dashes already in flight fly on, off the screen or into the
        // ship's shield. Before the aliens fire, so a new dash shows touching
        // the nose on the frame it is fired, and flies from the next.
        this.bullets.update(delta);

        this.ships = this.ships.filter((ship) => {
            const { route, sprite } = ship;

            // Along the line at the alien's own speed, on the line where it
            // was pinned when the chain woke.
            ship.travelled += route.alien.speed * step;

            const point = this.along(route, ship.travelled);
            sprite.setPosition(route.pinned_x + point.x, point.y);

            // Its one shot, out of its nose.
            if (!ship.fired && route.alien.fire_at !== undefined && ship.travelled >= route.alien.fire_at) {
                const tip = this.noses[route.key];

                ship.fired = true;
                this.bullets.fireLeft(sprite.x + tip.x * SCALE, sprite.y + tip.y * SCALE);
            }

            // Ships still behind the start, off the right edge, are on
            // their way in, wherever the line leads.
            const on_line = ship.travelled >= 0;

            if (on_line && (sprite.x < -MARGIN || sprite.y < -MARGIN || sprite.y > this.view_height + MARGIN)) {
                this.release(sprite);
                return false;
            }

            // Every bullet that lands is a hit, so the railgun's two or three
            // landing together count two or three (Thomas, 2026-11-16: a
            // power-up has to make the ship stronger; was one a frame).
            let hits = 0;

            bullets.collide(sprite, () => {
                hits++;
            });

            if (hits) {
                ship.taken += hits;
            }

            // Short of its hits, the bullets are used up and the alien flies
            // on; at its hits, it blows up.
            if (ship.taken >= (route.alien.hits ?? 1)) {
                explosions.spawn(sprite.x, sprite.y);
                this.scene.addPoints(route.alien.points);
                this.dropIfNumbered(ship);
                this.release(sprite);
                return false;
            }

            return true;
        });

        // The pods: shot at, and their releases. Their bullets in flight
        // fly on first, as the red dashes do. They ride with the station
        // (Thomas, 2026-11-10): moved left the same whole px the walls moved
        // this frame, so a release keeps its V round the pod as it scrolls.
        Object.values(this.pod_bullets).forEach((pool) => {
            pool.bullets.forEach((bullet) => {
                bullet.x -= moved;
            });
            pool.update(delta);
        });
        this.updatePods(delta, bullets, explosions);

        // The station has stopped: in comes the boss, sweeping in the free
        // space between the hall's walls.
        if (this.x === this.stop_x && this.boss.state === "idle") {
            this.boss.enter(this.bossRoom(this.boss.span()));
        }

        this.boss.update(delta, bullets, explosions);

        // The red dashes stop at the walls as the ship's bullets do, and so
        // do the pods' bullets.
        this.stopEnemyBullets(this.bullets, x);
        Object.values(this.pod_bullets).forEach((pool) => this.stopEnemyBullets(pool, x));
        this.stopEnemyBullets(this.boss.bullets, x);

        // The last map is off the left edge and its last ship gone.
        if (x + this.mask_width * SCALE <= 0 && this.ships.length === 0) {
            this.destroy();
        }
    }

    // The route's whole chain comes in at once: the first ship on the start
    // point, each one after it GAP further back, off the right edge, so they
    // fly in one after the other along the same line.
    //
    // The line is pinned here: where the station is now is where the line
    // stays on screen, while the station scrolls on.
    wake(route, x) {
        route.pinned_x = x;

        for (let i = 0; i < route.alien.chain; i++) {
            const travelled = -i * GAP * (route.alien.spacing ?? 1);
            const point = this.along(route, travelled);

            const sprite = this.pool.pop() ?? this.newSprite();
            sprite.setTexture(route.key)
                .setPosition(x + point.x, point.y)
                .setActive(true)
                .setVisible(true);

            if (route.alien.then) {
                this.playInTurn(sprite, route.alien, route.alien.anim);
            } else {
                sprite.play({ key: route.alien.anim, repeat: -1 });
            }

            // taken: bullets it has taken so far. number: its position in
            // the chain, from 1, the first to come in.
            this.ships.push({ route, sprite, travelled, taken: 0, number: i + 1 });
        }
    }

    // Each pod still standing: the ship's bullets on it, then, while it is
    // fully on screen and the ship is in play, its release.
    updatePods(delta, bullets, explosions) {
        const width = this.scene.scale.width;
        const player = this.scene.player;

        for (const pod of this.pods) {
            if (pod.dead) {
                continue;
            }

            const { sprite } = pod;

            // Every bullet that lands is a hit, as on the station's aliens.
            let hits = 0;

            bullets.collide(this.podTarget(pod), () => {
                hits++;
            });

            if (hits) {
                this.hitPod(pod, hits, explosions);

                if (pod.dead) {
                    continue;
                }
            }

            // A floater never fires.
            if (pod.pod.floater) {
                continue;
            }

            // A gun turns toward the ship.
            if (pod.pod.gun) {
                sprite.setFrame(this.gunFrame(pod, player));
            }

            // Fully on screen; the diamond gun only its middle, so it starts
            // firing sooner (Thomas).
            const half = pod.pod.diamond ? 0 : sprite.displayWidth / 2;
            const on_screen = sprite.x - half >= 0 && sprite.x + half <= width;

            if (!on_screen || player.state !== "can_move") {
                continue;
            }

            // A gun: its first bullet as it is fully on screen, then one
            // every GUN_FIRE_MS.
            if (pod.pod.gun) {
                pod.wait = pod.wait === null ? 0 : pod.wait - delta;

                while (pod.wait <= 0) {
                    this.fireGun(pod);
                    pod.wait += GUN_FIRE_MS;
                }

                continue;
            }

            // The diamond gun: its barrels in turn, the first as its middle
            // comes on screen, so each fires once every GUN_FIRE_MS. shots is the
            // barrel next in turn.
            if (pod.pod.diamond) {
                const barrels = this.diamond_barrels.length;

                if (!barrels) {
                    continue;
                }

                pod.wait = pod.wait === null ? 0 : pod.wait - delta;

                while (pod.wait <= 0) {
                    this.fireDiamond(pod);
                    pod.shots = (pod.shots + 1) % barrels;
                    pod.wait += GUN_FIRE_MS / barrels;
                }

                continue;
            }

            // The first release starts as it is fully on screen.
            pod.wait = pod.wait === null ? 0 : pod.wait - delta;

            while (pod.wait <= 0) {
                this.releaseBullet(pod);
                pod.shots++;

                if (pod.shots === RELEASE_SHOTS) {
                    pod.shots = 0;
                    pod.wait += RELEASE_PAUSE_MS;
                } else {
                    pod.wait += PhaserMath.Between(SHOT_GAP_MIN, SHOT_GAP_MAX);
                }
            }
        }
    }

    // The pod's next bullet of its release, from the middle of its open end
    // (the top of its painted pixels; the bottom on a flipped pod): straight
    // out for the first, each next one more angled, sides taking turns, up
    // to LAST_ANGLE. A flipped pod releases downward.
    releaseBullet(pod) {
        const { sprite } = pod;
        const box = this.pod_boxes[pod.key];
        const out = pod.flipped ? 1 : -1;
        const x = sprite.x;
        // box.y is the top of the painted pixels, above the centre; a
        // flipped pod has it mirrored below.
        const y = sprite.y - out * box.y * SCALE;

        const spread = pod.shots / (RELEASE_SHOTS - 1);
        const side = pod.shots % 2 === 0 ? 1 : -1;
        const angle = PhaserMath.DegToRad(side * (FIRST_ANGLE + (LAST_ANGLE - FIRST_ANGLE) * spread));

        // EnemyBullets fires toward a point: one along that angle.
        this.pod_bullets[pod.key].fire(x, y, x + Math.sin(angle) * 100, y + out * Math.cos(angle) * 100);
        playSound(this.scene, "stationx-guns");
    }

    // The gun's frame, toward the ship: gun-track with the ship ahead (to
    // its left) and more than GUN_TURN above level (below, on the roof);
    // otherwise, and with no ship in play, gun-level.
    gunFrame(pod, player) {
        if (player.state !== "can_move") {
            return GUN_LEVEL;
        }

        const ahead = pod.sprite.x - player.x;
        const above = pod.flipped ? player.y - pod.sprite.y : pod.sprite.y - player.y;

        return ahead > 0 && Math.atan2(above, ahead) > GUN_TURN ? GUN_TRACK : GUN_LEVEL;
    }

    // One bullet from the end of the gun's barrel, the way the frame on show
    // points: level left, or 45 degrees up-left (down-left on the roof).
    fireGun(pod) {
        const { sprite } = pod;
        const name = sprite.frame.name;
        const tip = this.gun_tips[name];
        // A roof gun shows its rows bottom up.
        const out = pod.flipped ? -1 : 1;
        const x = sprite.x + tip.x * SCALE;
        const y = sprite.y + out * tip.y * SCALE;
        const rise = name === GUN_TRACK ? -out : 0;

        // EnemyBullets fires toward a point: one along the barrel.
        this.pod_bullets[pod.key].fire(x, y, x - 100, y + rise * 100);
        playSound(this.scene, "stationx-guns");
    }

    // One bullet from the diamond gun's barrel next in turn, from the end of
    // its yellow tips, straight out level: left at bullet_speed, right at
    // bullet_speed_right (riding with the station comes on top, in update).
    fireDiamond(pod) {
        const { sprite } = pod;
        const barrel = this.diamond_barrels[pod.shots];
        // Flipped in Tiled, its rows show bottom up.
        const out = pod.flipped ? -1 : 1;
        const speed = barrel.out < 0 ? pod.pod.bullet_speed : pod.pod.bullet_speed_right;

        this.pod_bullets[pod.key].add(
            sprite.x + barrel.x * SCALE,
            sprite.y + out * barrel.y * SCALE,
            barrel.out * speed,
            0
        );
        playSound(this.scene, "stationx-guns");
    }

    // The pod's painted box on screen, as something the ship's bullets can
    // test against (PlayerBullets.collide reads its bounds).
    podTarget(pod) {
        const rect = this.podRect(pod);

        return { active: true, visible: true, getBounds: () => rect };
    }

    // The pod's painted box over all its frames, screen px; mirrored top to
    // bottom on a flipped pod.
    podRect(pod) {
        const box = this.pod_boxes[pod.key];
        const top = pod.flipped ? -(box.y + box.h) : box.y;

        return new Geom.Rectangle(
            pod.sprite.x + box.x * SCALE,
            pod.sprite.y + top * SCALE,
            box.w * SCALE,
            box.h * SCALE
        );
    }

    // hits more taken; at its pod's hits it blows up, for its points, and
    // is gone until a restart puts it back.
    hitPod(pod, hits, explosions) {
        pod.taken += hits;

        if (pod.taken < pod.pod.hits) {
            return;
        }

        explosions.spawn(pod.sprite.x, pod.sprite.y);
        this.scene.addPoints(pod.pod.points);

        const drop = DROPS[pod.name];

        if (drop) {
            this.scene.powerups.spawn(pod.sprite.x, pod.sprite.y, drop.kind);
        }

        pod.dead = true;
        pod.sprite.setVisible(false);
    }

    // The first pod still standing whose painted box overlaps the rectangle
    // (screen px), or null.
    podIn(rect) {
        return this.pods.find((pod) => !pod.dead
            && Geom.Intersects.RectangleToRectangle(this.podRect(pod), rect)) ?? null;
    }

    // Hit by a missile: MISSILE_HITS at once.
    missilePod(pod, explosions) {
        this.hitPod(pod, MISSILE_HITS, explosions);
    }

    // A ship shot. If its line drops a power-up (DROPS) and this is the
    // numbered ship, the drop comes out where it blew up.
    dropIfNumbered(ship) {
        const drop = DROPS[ship.route.name];

        if (drop && ship.number === drop.at) {
            this.scene.powerups.spawn(ship.sprite.x, ship.sprite.y, drop.kind);
        }
    }

    // An alien with two tags plays one once, holds its last frame, then
    // plays the other once, holds, and so on while it flies. A pooled sprite
    // may already be flying for another chain when the hold ends, so the
    // cycle goes on only if the sprite has not been released since.
    playInTurn(sprite, alien, key) {
        const flight = sprite.flight;

        sprite.play(key);

        sprite.once("animationcomplete", () => {
            this.scene.time.delayedCall(alien.hold, () => {
                if (sprite.flight === flight) {
                    this.playInTurn(sprite, alien, key === alien.anim ? alien.then : alien.anim);
                }
            });
        });
    }

    // A hidden alien sprite for the pool, at 3x like everything else.
    // Its texture is set when a chain takes it.
    newSprite() {
        const sprite = this.scene.add.sprite(0, 0, "delta")
            .setScale(SCALE)
            .setActive(false)
            .setVisible(false);

        sprite.flight = 0;
        return sprite;
    }

    // Shot or flown off: the sprite stops, hides and goes back to the pool.
    release(sprite) {
        // Already destroyed with the scene (GAME OVER back to the intro).
        if (!sprite.scene) {
            return;
        }

        sprite.flight++;
        sprite.off("animationcomplete");
        sprite.stop();
        sprite.setActive(false).setVisible(false);

        this.pool.push(sprite);
    }

    // The point the given distance along the route, station screen px.
    // Before the start a ship is on its way in, straight on toward the first
    // point; past the last point it carries straight on the way the line ends.
    along(route, distance) {
        if (distance < 0) {
            return route.start_direction.clone().scale(distance).add(route.start);
        }

        if (distance <= route.length) {
            return route.path.getPointAt(distance / route.length);
        }

        return route.end_direction.clone().scale(distance - route.length).add(route.end);
    }

    // The aliens a missile can go for: on their line and inside the screen;
    // the pods still standing whose middle is on screen; and the boss parts
    // that are not soaking (Boss.js targets()).
    targets() {
        if (this.gone) {
            return [];
        }

        const width = this.scene.scale.width;
        const on_screen = ({ sprite }) => sprite.x >= 0 && sprite.x <= width
            && sprite.y >= 0 && sprite.y <= this.view_height;

        return [
            ...this.ships.filter((ship) => ship.travelled >= 0 && on_screen(ship)),
            ...this.pods.filter((pod) => !pod.dead && on_screen(pod)),
            ...this.boss.targets()
        ];
    }

    // True while the ship is still flying (not shot, not flown off), or the
    // pod still standing.
    isFlying(target) {
        return this.ships.includes(target) || (this.pods.includes(target) && !target.dead)
            || this.boss.isFlying(target);
    }

    // The first boss part still there with a painted pixel under the
    // rectangle (screen px), or null.
    bossIn(rect) {
        return this.boss.partIn(rect);
    }

    // Hit by a missile: MISSILE_HITS on that part, unless it soaks them.
    missileBoss(part, explosions) {
        this.boss.missile(part, explosions);
    }

    // The free screen y between the hall's painted walls across a screen x
    // span, with the station where it is now: from the middle row up to the
    // lowest wall pixel above, and down to the highest wall pixel below.
    bossRoom({ left, right }) {
        const x = Math.round(this.x);
        const middle = Math.floor(this.mask_height / 2);
        const first = Math.max(0, Math.floor((left - x) / SCALE));
        const last = Math.min(this.mask_width - 1, Math.ceil((right - x) / SCALE) - 1);
        let top = 0;
        let bottom = this.mask_height;

        for (let column = first; column <= last; column++) {
            for (let row = middle; row >= 0; row--) {
                if (this.mask[row * this.mask_width + column]) {
                    top = Math.max(top, row + 1);
                    break;
                }
            }

            for (let row = middle; row < this.mask_height; row++) {
                if (this.mask[row * this.mask_width + column]) {
                    bottom = Math.min(bottom, row);
                    break;
                }
            }
        }

        return { top: top * SCALE, bottom: bottom * SCALE };
    }

    // The first alien whose hit box overlaps the rectangle (screen px), or
    // null.
    alienIn(rect) {
        const box = new Geom.Rectangle();

        return this.ships.find(({ route, sprite }) => {
            const hit_box = this.boxes[route.key];

            box.setTo(
                sprite.x + hit_box.x * SCALE,
                sprite.y + hit_box.y * SCALE,
                hit_box.w * SCALE,
                hit_box.h * SCALE
            );

            return Geom.Intersects.RectangleToRectangle(box, rect);
        }) ?? null;
    }

    // Shot by a missile: as by a bullet -- explosion, points, the line's
    // drop if it is the numbered ship -- and gone.
    destroyShip(ship, explosions) {
        const { route, sprite } = ship;

        explosions.spawn(sprite.x, sprite.y);
        this.scene.addPoints(route.alien.points);
        this.dropIfNumbered(ship);
        this.release(sprite);

        this.ships = this.ships.filter((other) => other !== ship);
    }

    // True if the rectangle (screen px) touches a painted pixel of the
    // station.
    wallIn(rect) {
        if (this.gone) {
            return false;
        }

        const left = rect.x - Math.round(this.x);

        const first_column = Math.max(0, Math.floor(left / SCALE));
        const last_column = Math.min(this.mask_width - 1, Math.ceil((left + rect.width) / SCALE) - 1);
        const first_row = Math.max(0, Math.floor(rect.y / SCALE));
        const last_row = Math.min(this.mask_height - 1, Math.ceil((rect.y + rect.height) / SCALE) - 1);

        for (let row = first_row; row <= last_row; row++) {
            for (let column = first_column; column <= last_column; column++) {
                if (this.mask[row * this.mask_width + column]) {
                    return true;
                }
            }
        }

        return false;
    }

    // True if the ship touches a wall or one of the station's aliens.
    hits(player) {
        if (this.gone) {
            return false;
        }

        const columns = player.paintedColumns();

        return this.hitsWall(columns) || this.hitsZap(columns) || this.hitsPod(columns)
            || this.boss.touches(columns)
            || this.hitsAlien(player) || this.bullets.hits(player)
            || Object.values(this.pod_bullets).some((pool) => pool.hits(player))
            || this.boss.bullets.hits(player);
    }

    // As the zaps: each painted ship column against the painted pixels of
    // the frame each pod still standing is showing.
    hitsPod(columns) {
        if (!columns) {
            return false;
        }

        for (const { sprite, key, dead, flipped } of this.pods) {
            if (dead) {
                continue;
            }

            const { width, height, painted } = this.pod_masks[key][sprite.frame.name];
            const left = sprite.x - width * SCALE / 2;
            const top = sprite.y - height * SCALE / 2;

            for (const ship of columns) {
                const first_column = Math.max(0, Math.floor((ship.left - left) / SCALE));
                const last_column = Math.min(width - 1, Math.ceil((ship.right - left) / SCALE) - 1);
                const first_row = Math.max(0, Math.floor((ship.top - top) / SCALE));
                const last_row = Math.min(height - 1, Math.ceil((ship.bottom - top) / SCALE) - 1);

                for (let row = first_row; row <= last_row; row++) {
                    // A flipped pod shows its rows bottom up.
                    const source_row = flipped ? height - 1 - row : row;

                    for (let column = first_column; column <= last_column; column++) {
                        if (painted[source_row * width + column]) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    // An enemy bullet of the pool (the red dashes, a pod's bullets) whose
    // painted box touches a painted pixel of the station is gone. x is the
    // station's left edge on screen.
    stopEnemyBullets(pool, x) {
        const box = pool.hit_box;

        pool.removeWhere((bullet) => {
            const left = bullet.x + box.x * SCALE - x;
            const top = bullet.y + box.y * SCALE;

            const first_column = Math.max(0, Math.floor(left / SCALE));
            const last_column = Math.min(this.mask_width - 1, Math.ceil((left + box.w * SCALE) / SCALE) - 1);
            const first_row = Math.max(0, Math.floor(top / SCALE));
            const last_row = Math.min(this.mask_height - 1, Math.ceil((top + box.h * SCALE) / SCALE) - 1);

            for (let row = first_row; row <= last_row; row++) {
                for (let column = first_column; column <= last_column; column++) {
                    if (this.mask[row * this.mask_width + column]) {
                        return true;
                    }
                }
            }

            return false;
        });
    }

    // As the wall: each painted ship column against the painted pixels of
    // the frame each zap is showing. The empty frame never hits.
    hitsZap(columns) {
        if (!columns) {
            return false;
        }

        for (const { sprite, key } of this.zaps) {
            const { width, height, painted } = this.zap_masks[key][sprite.frame.name];

            for (const ship of columns) {
                const first_column = Math.max(0, Math.floor((ship.left - sprite.x) / SCALE));
                const last_column = Math.min(width - 1, Math.ceil((ship.right - sprite.x) / SCALE) - 1);
                const first_row = Math.max(0, Math.floor((ship.top - sprite.y) / SCALE));
                const last_row = Math.min(height - 1, Math.ceil((ship.bottom - sprite.y) / SCALE) - 1);

                for (let row = first_row; row <= last_row; row++) {
                    for (let column = first_column; column <= last_column; column++) {
                        if (painted[row * width + column]) {
                            return true;
                        }
                    }
                }
            }
        }

        return false;
    }

    // Checked one ship column at a time, its painted extent there against
    // the painted station under it, as the fire cave checks its flames.
    hitsWall(columns) {
        if (!columns) {
            return false;
        }

        const x = Math.round(this.x);

        for (const ship of columns) {
            const first_column = Math.max(0, Math.floor((ship.left - x) / SCALE));
            const last_column = Math.min(this.mask_width - 1, Math.ceil((ship.right - x) / SCALE) - 1);
            const first_row = Math.max(0, Math.floor(ship.top / SCALE));
            const last_row = Math.min(this.mask_height - 1, Math.ceil(ship.bottom / SCALE) - 1);

            for (let row = first_row; row <= last_row; row++) {
                for (let column = first_column; column <= last_column; column++) {
                    if (this.mask[row * this.mask_width + column]) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    // The player's bullets stop at the walls: a bullet whose box touches a
    // painted pixel of the station is spent, with no effect. Zaps let them
    // through, as they can't be shot. x is the station's left edge on screen.
    stopBullets(bullets, x) {
        for (const bullet of bullets.bullets) {
            if (!bullet.active) {
                continue;
            }

            const left = bullet.x - bullets.width / 2 - x;
            const top = bullet.y - bullets.height / 2;

            const first_column = Math.max(0, Math.floor(left / SCALE));
            const last_column = Math.min(this.mask_width - 1, Math.ceil((left + bullets.width) / SCALE) - 1);
            const first_row = Math.max(0, Math.floor(top / SCALE));
            const last_row = Math.min(this.mask_height - 1, Math.ceil((top + bullets.height) / SCALE) - 1);

            let wall = false;

            for (let row = first_row; row <= last_row && !wall; row++) {
                for (let column = first_column; column <= last_column; column++) {
                    if (this.mask[row * this.mask_width + column]) {
                        wall = true;
                        break;
                    }
                }
            }

            if (wall) {
                bullets.deactivate(bullet);
            }
        }
    }

    // As the waves do: the alien's hit box against the ship's painted pixels.
    // The alien flies on.
    hitsAlien(player) {
        const box = new Geom.Rectangle();

        return this.ships.some(({ route, sprite }) => {
            const hit_box = this.boxes[route.key];

            box.setTo(
                sprite.x + hit_box.x * SCALE,
                sprite.y + hit_box.y * SCALE,
                hit_box.w * SCALE,
                hit_box.h * SCALE
            );

            return player.touches(box);
        });
    }
}

// The tip of an alien's nose in its first frame: the left edge of the
// leftmost painted column, and the bottom edge of its lowest painted pixel
// there -- the shot's bottom row lines up with that pixel (Thomas's pick B,
// 2026-11-09). Native px from the sprite's centre. Read once from the loaded
// image, so a repainted nose, or another alien's, needs no change here.
function nose(scene, key) {
    const { width, height, painted } = paintedFrames(scene, key)["0"];

    for (let column = 0; column < width; column++) {
        const rows = [];

        for (let row = 0; row < height; row++) {
            if (painted[row * width + column]) {
                rows.push(row);
            }
        }

        if (rows.length) {
            return {
                x: column - width / 2,
                y: rows[rows.length - 1] + 1 - height / 2
            };
        }
    }

    return { x: -width / 2, y: 0 };
}

// The end of the gun's barrel in each gun-sheet frame: the painted pixels
// furthest along the way the barrel points (left for gun-level, up-left for
// gun-track), their middle. Native px from the sprite's centre, upright.
// Read once from the loaded image, so a repainted barrel needs no change
// here.
function gunTips(masks) {
    const tips = {};

    for (const [ name, along ] of [ [ GUN_LEVEL, (column) => -column ], [ GUN_TRACK, (column, row) => -column - row ] ]) {
        const { width, height, painted } = masks[name];
        let best = -Infinity;
        let found = [];

        for (let row = 0; row < height; row++) {
            for (let column = 0; column < width; column++) {
                if (!painted[row * width + column]) {
                    continue;
                }

                const value = along(column, row);

                if (value > best) {
                    best = value;
                    found = [];
                }

                if (value === best) {
                    found.push({ column, row });
                }
            }
        }

        const middle = (pick) => found.reduce((sum, pixel) => sum + pick(pixel), 0) / found.length;

        tips[name] = {
            x: middle((pixel) => pixel.column) + 0.5 - width / 2,
            y: middle((pixel) => pixel.row) + 0.5 - height / 2
        };
    }

    return tips;
}

// The diamond gun's barrels, read once from its picture: each barrel ends in
// yellow pixels (#FFFC40, two lines 3 px apart), one above the other in the
// same column. Each barrel: the outer edge of its yellow end and the middle
// of its rows, native px from the centre, upright; which way it points (-1
// left, 1 right, by which half it is in). In turn round the diamond,
// clockwise from straight up, so the top barrel comes first.
function diamondBarrels(scene, key) {
    const image = scene.textures.get(key).getSourceImage();

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const yellow = [];

    for (let column = 0; column < image.width; column++) {
        for (let row = 0; row < image.height; row++) {
            const i = (row * image.width + column) * 4;

            if (pixels[i + 3] > 0 && pixels[i] > 180 && pixels[i + 1] > 180 && pixels[i + 2] < 120) {
                yellow.push({ column, row });
            }
        }
    }

    // Column by column, top to bottom: a yellow pixel within 4 rows of the
    // last one in the same column belongs to the same barrel.
    const groups = [];

    for (const pixel of yellow) {
        const last = groups[groups.length - 1];
        const end = last?.[last.length - 1];

        if (end && end.column === pixel.column && pixel.row - end.row <= 4) {
            last.push(pixel);
        } else {
            groups.push([ pixel ]);
        }
    }

    const barrels = groups.map((group) => {
        const column = group[0].column;
        const out = column < image.width / 2 ? -1 : 1;
        const middle = group.reduce((sum, pixel) => sum + pixel.row + 0.5, 0) / group.length;

        return {
            x: (out < 0 ? column : column + 1) - image.width / 2,
            y: middle - image.height / 2,
            out
        };
    });

    // Clockwise from straight up.
    const turn = ({ x, y }) => (Math.atan2(x, -y) + 2 * Math.PI) % (2 * Math.PI);

    return barrels.sort((a, b) => turn(a) - turn(b));
}

// The picture of an image object, by its file name without .png (its texture
// key), or null. Tiled numbers a Collection of Images tileset's tiles by
// their id, and ids can have gaps (vulcan is id 8 of 7 tiles), so the
// tileset is the one with the highest firstgid not past the tile number.
function tileImage(data, gid) {
    if (!gid) {
        return null;
    }

    const number = gid & TILE_NUMBER;
    const tileset = data.tilesets
        .filter((t) => t.tiles && t.firstgid <= number)
        .sort((a, b) => b.firstgid - a.firstgid)[0];
    const tile = tileset?.tiles.find((t) => t.id === number - tileset.firstgid);

    return tile?.image.split(/[\\/]/).pop().replace(/\.png$/, "") ?? null;
}

// Per frame of an Aseprite texture, by frame name: its size and which native
// pixels are painted. Read once from the loaded image.
function paintedFrames(scene, key) {
    const texture = scene.textures.get(key);
    const image = texture.getSourceImage();

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const frames = {};

    // A plain image (no atlas, as the diamond gun) has only its base frame.
    const names = texture.getFrameNames();

    for (const name of names.length ? names : [ "__BASE" ]) {
        const frame = texture.get(name);
        const painted = new Uint8Array(frame.cutWidth * frame.cutHeight);

        for (let row = 0; row < frame.cutHeight; row++) {
            for (let column = 0; column < frame.cutWidth; column++) {
                const i = ((frame.cutY + row) * image.width + frame.cutX + column) * 4;
                painted[row * frame.cutWidth + column] = pixels[i + 3] > 0 ? 1 : 0;
            }
        }

        frames[name] = { width: frame.cutWidth, height: frame.cutHeight, painted };
    }

    return frames;
}

// Reads the loaded tiles image once and lays every map's station layer out in
// native px, side by side: 1 where a tile has paint, 0 elsewhere. Read from
// each map's exported tile numbers, so flipped and turned tiles come out as
// Tiled shows them.
function paintedStation(scene, station) {
    const image = scene.textures.get("station-x-tiles").getSourceImage();

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const mask = new Uint8Array(station.mask_width * station.mask_height);

    MAPS.forEach((key, i) => {
        const data = scene.cache.tilemap.get(key).data;
        const layer = data.layers.find((l) => l.name === "station");
        const tileset = data.tilesets.find((t) => t.name === "station-x-tiles");
        const size = data.tilewidth;
        const last = size - 1;

        layer.data.forEach((gid, cell) => {
            const number = gid & TILE_NUMBER;

            if (number < tileset.firstgid || number >= tileset.firstgid + tileset.tilecount) {
                return;
            }

            const local = number - tileset.firstgid;
            const tile_x = (local % tileset.columns) * size;
            const tile_y = Math.floor(local / tileset.columns) * size;
            const left = station.offsets[i] + (cell % layer.width) * size;
            const top = Math.floor(cell / layer.width) * size;

            for (let row = 0; row < size; row++) {
                for (let column = 0; column < size; column++) {
                    if (pixels[((tile_y + row) * image.width + tile_x + column) * 4 + 3] === 0) {
                        continue;
                    }

                    let x = column;
                    let y = row;

                    if (gid & FLIPPED_D) {
                        [ x, y ] = [ y, x ];
                    }
                    if (gid & FLIPPED_H) {
                        x = last - x;
                    }
                    if (gid & FLIPPED_V) {
                        y = last - y;
                    }

                    mask[(top + y) * station.mask_width + left + x] = 1;
                }
            }
        });
    });

    return mask;
}
