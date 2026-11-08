import { Curves, Geom, Math as PhaserMath } from "phaser";
import { paintedBox } from "./FirecometTrack";

// Level 4, Station X (NOTES.md -> Level 4 Concepts): the three maps traced in
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

// The maps in the order they come in, by their keys in preloader.js.
const MAPS = [ "station-x", "station-x-1", "station-x-2" ];

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
// The enforcer (2026-11-07, first pass): one frame (enforcer-level), a chain
// of 4, "spacing" 4 sprite widths apart (384 px), and speed 500, slow next to
// the others.
//
// The moon (2026-11-08, first pass): a slow object, speed 400. A chain of 7,
// spacing 3 sprite widths apart (288 px).
const ALIENS = {
    delta: { anim: "delta-spin", chain: 10, speed: 715.8, points: 100, box: null },
    neutron: { anim: "spin", chain: 7, speed: 715.8, points: 100, box: { x: -13, y: -4, w: 26, h: 9 } },
    raider: { anim: "raider-loop", chain: 7, speed: 715.8, points: 100, box: null },
    xwing: { anim: "xwing-loop", chain: 7, speed: 715.8, points: 100, box: null },
    enforcer: { anim: "enforcer-level", chain: 4, spacing: 4, speed: 500, points: 100, box: null },
    moon: { anim: "moon-loop", chain: 7, spacing: 3, speed: 400, points: 100, box: null }
};

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

    // Alien sprites not in use, hidden, ready for the next chain.
    pool = [];

    // Every zap: its sprite and its top-left in native station px.
    zaps = [];

    // Per zap texture, per frame name: which native pixels are painted.
    zap_masks = {};

    // Hit box per alien, native px from the sprite's centre.
    boxes = {};

    // The painted station, one byte per native pixel, 1 for wall.
    mask = null;
    mask_width = 0;
    mask_height = 0;

    // Screen x of the station's left edge.
    x = 0;

    // ms not yet turned into STEPs.
    clock = 0;
    gone = false;

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
        }

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

            offset += map.widthInPixels;
        }

        this.mask_width = offset;
        this.mask_height = this.maps[0].heightInPixels;
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
    }

    // A ship is lost: the ships on screen vanish, as a called-off wave's do.
    // Routes still to come stay, further along the station.
    callOff() {
        this.ships.forEach((ship) => this.release(ship.sprite));
        this.ships = [];
    }

    destroy() {
        this.callOff();
        this.pool.forEach((sprite) => sprite.destroy());
        this.pool = [];
        this.zaps.forEach(({ sprite }) => sprite.destroy());
        this.zaps = [];
        this.maps.forEach((map) => map.destroy());
        this.maps = [];
        this.layers = [];
        this.routes = [];
        this.gone = true;
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
        this.x -= STEP * ticks;

        const x = Math.round(this.x);

        this.layers.forEach(({ layer, offset }) => {
            layer.x = x + offset * SCALE;
        });

        for (const zap of this.zaps) {
            zap.sprite.setPosition(x + zap.x * SCALE, zap.y * SCALE);
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

        this.ships = this.ships.filter((ship) => {
            const { route, sprite } = ship;

            // Along the line at the alien's own speed, on the line where it
            // was pinned when the chain woke.
            ship.travelled += route.alien.speed * step;

            const point = this.along(route, ship.travelled);
            sprite.setPosition(route.pinned_x + point.x, point.y);

            // Ships still behind the start, off the right edge, are on
            // their way in, wherever the line leads.
            const on_line = ship.travelled >= 0;

            if (on_line && (sprite.x < -MARGIN || sprite.y < -MARGIN || sprite.y > this.view_height + MARGIN)) {
                this.release(sprite);
                return false;
            }

            let hit = false;

            bullets.collide(sprite, () => {
                hit = true;
            });

            if (hit) {
                explosions.spawn(sprite.x, sprite.y);
                this.scene.addPoints(route.alien.points);
                this.release(sprite);
                return false;
            }

            return true;
        });

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

            this.ships.push({ route, sprite, travelled });
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

    // True if the ship touches a wall or one of the station's aliens.
    hits(player) {
        if (this.gone) {
            return false;
        }

        const columns = player.paintedColumns();

        return this.hitsWall(columns) || this.hitsZap(columns) || this.hitsAlien(player);
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

    for (const name of texture.getFrameNames()) {
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
