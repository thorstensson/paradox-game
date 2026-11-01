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
// that point passes just outside the right edge, then flies the line, curved
// smoothly through its points, riding along with the station.

// The ship's pixel size, as everything in the game.
const SCALE = 3;

// Screen px per second, the fire cave's speed.
const SPEED = 337.6;

// The maps in the order they come in, by their keys in preloader.js.
const MAPS = [ "station-x", "station-x-1", "station-x-2" ];

// The aliens a route's Class can name, by texture key, each with its own
// animation, chain length, speed (screen px/s), points and hit box, as its
// wave has them: DeltaWave.js:18-25 and :110, NeutronWave.js:17-33 and :101.
// Repeated here so those waves stay as they are. A null box is the alien's
// painted extent (paintedBox), as the delta's is.
//
// The station is a fast level: delta and neutron both fly at 715.8, 20% over
// the delta's own 596.5 (the neutron's own wave flies at 477).
const ALIENS = {
    delta: { anim: "delta-spin", chain: 10, speed: 715.8, points: 100, box: null },
    neutron: { anim: "spin", chain: 7, speed: 715.8, points: 100, box: { x: -13, y: -4, w: 26, h: 9 } }
};

// Half a 32x32 alien at 3x: ships wake and leave fully off-screen.
const MARGIN = 16 * SCALE;

// Between two ships of a chain along their line, px: one sprite width, the
// gap between centres the waves keep.
const GAP = 32 * SCALE;

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

    // Hit box per alien, native px from the sprite's centre.
    boxes = {};

    // The painted station, one byte per native pixel, 1 for wall.
    mask = null;
    mask_width = 0;
    mask_height = 0;

    // Screen x of the station's left edge.
    x = 0;
    gone = false;

    constructor(scene) {
        this.scene = scene;
        this.x = scene.scale.width;
        this.view_height = scene.cameras.main.height;

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
                    .setScale(SCALE).setDepth(-1);

                this.layers.push({ layer, offset });
            }

            this.maps.push(map);
            this.offsets.push(offset);

            this.readRoutes(scene.cache.tilemap.get(key).data, offset);

            offset += map.widthInPixels;
        }

        this.mask_width = offset;
        this.mask_height = this.maps[0].heightInPixels;
        this.mask = paintedStation(scene, this);
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

    // A ship is lost: the ships on screen vanish, as a called-off wave's do.
    // Routes still to come stay, further along the station.
    callOff() {
        this.ships.forEach((ship) => ship.sprite.destroy());
        this.ships = [];
    }

    destroy() {
        this.callOff();
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

        this.x -= SPEED * step;

        const x = Math.round(this.x);

        this.layers.forEach(({ layer, offset }) => {
            layer.x = x + offset * SCALE;
        });

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

            // Along the line, relative to the station, at what is left of
            // the alien's speed once the station's is taken off: a line
            // drawn right to left crosses the screen at the alien's own
            // speed, as its wave does.
            ship.travelled += (route.alien.speed - SPEED) * step;

            const point = this.along(route, ship.travelled);
            sprite.setPosition(x + point.x, point.y);

            // Ships still behind the start, off the right edge, are on
            // their way in, wherever the line leads.
            const on_line = ship.travelled >= 0;

            if (on_line && (sprite.x < -MARGIN || sprite.y < -MARGIN || sprite.y > this.view_height + MARGIN)) {
                sprite.destroy();
                return false;
            }

            let hit = false;

            bullets.collide(sprite, () => {
                hit = true;
            });

            if (hit) {
                explosions.spawn(sprite.x, sprite.y);
                this.scene.addPoints(route.alien.points);
                sprite.destroy();
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
    wake(route, x) {
        for (let i = 0; i < route.alien.chain; i++) {
            const travelled = -i * GAP;
            const point = this.along(route, travelled);

            const sprite = this.scene.add.sprite(x + point.x, point.y, route.key);
            sprite.setScale(SCALE);
            sprite.play({ key: route.alien.anim, repeat: -1 });

            this.ships.push({ route, sprite, travelled });
        }
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

        return this.hitsWall(player) || this.hitsAlien(player);
    }

    // Checked one ship column at a time, its painted extent there against
    // the painted station under it, as the fire cave checks its flames.
    hitsWall(player) {
        const columns = player.paintedColumns();

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
