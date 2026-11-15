import { Geom, Math as PhaserMath } from "phaser";
import { EnemyBullets } from "./EnemyBullets";
import { paintedBox } from "./FirecometTrack";

// The Station X boss, scarab (enemies/scarab, Thomas, 2026-11-14). His
// 120x180 canvas, drawn at 3x like the ship: 360x540 on screen. It comes
// in, moves, fires and can be shot.
//
// Four guns, firing bullet-blue-enemy straight left, taking turns (Thomas:
// all at once would be a wall): both wings together, FIRE_GAP_MS later both
// hull guns, FIRE_GAP_MS later the wings again, and so on from the moment it
// is in place. A blown-up part's guns stay silent.
//
// Once the station has stopped it slides in from off the right edge to its
// spot, its picture RIGHT_GAP px short of the right edge. There it sweeps up
// and down between the hall's walls, keeping WALL_MARGIN clear of them, and
// every LUNGE_EVERY_MS it lunges a third of the screen to the left and back.
//
// Three parts, each its own sprite on the same spot, each its own frame of
// the sheet, so together they are scarab-full. Every hit on the hull counts
// on the hull and on each wing still there, so shooting the middle alone
// breaks the wings off first, then the hull goes (Thomas, 2026-11-15, B, "as
// in R-Type, IO ... a dumb player still can make progress. And wings still
// go first"). A hit on a wing counts on that wing only. Every hit shows
// scarab-hit on the hull. Each part blows up on its own; the boss is gone
// when the hull does. Hits, points and timings are placeholders to tune by
// playing.

// The ship's pixel size, as everything in the game: the boss canvas is
// 120x180, drawn at 3x = 360x540 on screen.
const SCALE = 3;

// The boss's sheet (preloader.js), and its frames by their tags: Aseprite
// exports them named 0-7 (Item Filename {frame}).
export const BOSS_KEY = "scarab";

// scarab-full: the whole boss, for its size and painted box.
const FULL_FRAME = "0";

// The parts, by their frame: scarab-hull (with scarab-hit as its hit frame),
// scarab-top-wing, scarab-bottom-wing. The hull is "centre" in the code.
// loop: the tag a part plays at rest (scarab-tail, frames 5-7: the hull with
// its tail blinking; MainScene builds it).
// guns: each gun's light blue square, its top-left canvas pixel (scarab-full,
// measured 2026-11-14); every square is 2 px tall. The bullet leaves from
// the square's left side, level with its middle.
// mount: the hull guns' weapon mount, its front edge (the outline left of
// the square), canvas x, measured 2026-11-15. The bullet starts right in
// front of it, its back end against it (Thomas: "-=", bullet then mount).
const PARTS = [
    {
        name: "centre", frame: "1", hit_frame: "2", loop: "scarab-tail", hits: 80, points: 5000,
        guns: [ { x: 5, y: 56, mount: 4 }, { x: 5, y: 122, mount: 4 } ]
    },
    { name: "top", frame: "3", hits: 50, points: 1000, guns: [ { x: 1, y: 20 } ] },
    { name: "bottom", frame: "4", hits: 50, points: 1000, guns: [ { x: 1, y: 158 } ] }
];

// Height of every gun's light blue square, native px.
const GUN_SQUARE_H = 2;

// Between the wings' shots and the hull's, and back, ms (placeholder).
const FIRE_GAP_MS = 1000;

// The blue bullets' speed, px/s: the usual enemy bullet's (placeholder).
const BULLET_SPEED = 240;

// Between its picture's right side and the screen's right edge, screen px
// (Thomas).
const RIGHT_GAP = 100;

// Sliding in, ms.
const ENTER_MS = 2000;

// One full sweep up and down, ms.
const SWEEP_MS = 4000;

// Kept clear of the walls, native px (24 on screen).
const WALL_MARGIN = 8;

// A lunge every LUNGE_EVERY_MS (Thomas: 10 s), out over LUNGE_MS and back
// over LUNGE_MS, a third of the screen.
const LUNGE_EVERY_MS = 10000;
const LUNGE_MS = 1000;

// The centre's hit frame shows this long on each counted hit.
const FLASH_MS = 100;

// Hits a missile counts on a part, as on the pods.
const MISSILE_HITS = 5;

export class Boss {

    scene = null;

    // idle (not in yet), entering, fighting, dead.
    state = "idle";

    parts = [];

    // ms since it began sliding in.
    clock = 0;

    // The fire cycle: ms toward the next turn, and whose turn it is.
    fire_clock = 0;
    turn = "wings";

    // Its centre's screen x at its spot, and where its sweep runs (screen y
    // of its centre, top and bottom).
    home_x = 0;
    top_y = 0;
    bottom_y = 0;

    // key: its sheet (BOSS_KEY). masks: per frame name, which native pixels
    // are painted (Station.js, paintedFrames).
    constructor(scene, key, masks) {
        this.scene = scene;
        this.masks = masks;
        this.whole = paintedBox(scene, key, FULL_FRAME);

        // Half its picture's width, on screen: taken from scarab-full.
        this.half = scene.textures.getFrame(key, FULL_FRAME).width * SCALE / 2;

        for (const part of PARTS) {
            const sprite = scene.add.sprite(0, 0, key, part.frame)
                .setScale(SCALE)
                .setVisible(false);

            if (part.loop) {
                sprite.play({ key: part.loop, repeat: -1 });
            }

            this.parts.push({
                ...part,
                sprite,
                key: `${key}-${part.name}`,
                box: paintedBox(scene, key, part.frame),
                taken: 0,
                dead: false,
                flash: 0
            });
        }

        this.home_x = scene.scale.width - RIGHT_GAP - this.half;

        // Its bullets: the station checks them against the ship and its
        // walls, as the other enemy bullets.
        this.bullets = new EnemyBullets(scene, {
            key: "bullet-blue-enemy",
            anim: null,
            speed: BULLET_SPEED
        });
    }

    // The screen x span the boss can take up, its lunge included: what the
    // station reads its walls across.
    span() {
        const lunge = this.scene.scale.width / 3;

        return { left: this.home_x - lunge - this.half, right: this.home_x + this.half };
    }

    // The station has stopped: in it comes. room: the free screen y between
    // the hall's walls across span() (Station.bossRoom).
    enter(room) {
        const top = room.top + WALL_MARGIN * SCALE - this.whole.y * SCALE;
        const bottom = room.bottom - WALL_MARGIN * SCALE - (this.whole.y + this.whole.h) * SCALE;

        // No room to sweep: it holds the middle.
        if (top > bottom) {
            this.top_y = this.bottom_y = (room.top + room.bottom) / 2;
        } else {
            this.top_y = top;
            this.bottom_y = bottom;
        }

        this.state = "entering";
        this.clock = 0;

        for (const part of this.parts) {
            part.sprite.setVisible(true);
        }

        this.place(this.scene.scale.width + this.half, this.sweepY());
    }

    get busy() {
        return this.state === "entering" || this.state === "fighting";
    }

    // Its centre's y in the sweep: starting in the middle.
    sweepY() {
        const middle = (this.top_y + this.bottom_y) / 2;
        const reach = (this.bottom_y - this.top_y) / 2;

        return middle + reach * Math.sin(2 * Math.PI * this.clock / SWEEP_MS);
    }

    place(x, y) {
        for (const part of this.parts) {
            part.sprite.setPosition(Math.round(x), Math.round(y));
        }
    }

    update(delta, bullets, explosions) {
        // Its bullets fly on, even once it is gone.
        this.bullets.update(delta);

        if (!this.busy) {
            return;
        }

        this.clock += delta;

        let x = this.home_x;

        if (this.state === "entering") {
            const t = Math.min(this.clock / ENTER_MS, 1);
            const start = this.scene.scale.width + this.half;

            x = start + (this.home_x - start) * PhaserMath.Easing.Cubic.Out(t);

            if (t === 1) {
                this.state = "fighting";
            }
        } else {
            // A lunge every LUNGE_EVERY_MS after it is in: out and back.
            const since = (this.clock - ENTER_MS) % LUNGE_EVERY_MS;
            const lunge = this.scene.scale.width / 3;
            const into = since - (LUNGE_EVERY_MS - 2 * LUNGE_MS);

            if (into > 0) {
                const t = into < LUNGE_MS ? into / LUNGE_MS : 2 - into / LUNGE_MS;

                x = this.home_x - lunge * PhaserMath.Easing.Sine.InOut(t);
            }
        }

        this.place(x, this.sweepY());

        // The fire cycle, once it is in place: wings, then hull, in turn.
        if (this.state === "fighting") {
            this.fire_clock += delta;

            if (this.fire_clock >= FIRE_GAP_MS) {
                this.fire_clock -= FIRE_GAP_MS;
                this.fire(this.turn === "wings" ? [ "top", "bottom" ] : [ "centre" ]);
                this.turn = this.turn === "wings" ? "hull" : "wings";
            }
        }

        // The ship's bullets, one hit a frame at most per part, as the
        // station's aliens. A bullet hits a part only on its painted pixels
        // (Thomas, 2026-11-14: "the wing is the wing"); the wings first, as
        // they are drawn over the hull.
        for (const part of this.onTop()) {
            if (part.dead) {
                continue;
            }

            let hit = false;

            bullets.collideTest((box) => this.paintedIn(part, box), () => {
                hit = true;
            });

            if (hit) {
                this.hit(part, 1, explosions);
            }
        }

        // The centre's hit frame, back to its loop once FLASH_MS is up.
        const centre = this.centre;

        if (!centre.dead && centre.flash > 0) {
            centre.flash -= delta;

            if (centre.flash <= 0) {
                this.rest(centre);
            }
        }
    }

    // A part's look at rest: its loop, or its own frame.
    rest(part) {
        if (part.loop) {
            part.sprite.play({ key: part.loop, repeat: -1 });
        } else {
            part.sprite.setFrame(part.frame);
        }
    }

    // Every gun of the named parts still there fires one bullet straight
    // left, level with the gun square's middle: a gun with a mount puts the
    // bullet's back end against the mount's front edge, the others its front
    // at the square's left side.
    fire(names) {
        const box = this.bullets.hit_box;

        for (const part of this.parts) {
            if (part.dead || !names.includes(part.name)) {
                continue;
            }

            const { sprite } = part;
            const left = sprite.x - sprite.frame.width * SCALE / 2;
            const top = sprite.y - sprite.frame.height * SCALE / 2;

            for (const gun of part.guns) {
                const front = gun.mount !== undefined
                    ? left + (gun.mount - box.w) * SCALE
                    : left + gun.x * SCALE;
                const middle = top + (gun.y + GUN_SQUARE_H / 2) * SCALE;

                this.bullets.add(
                    front - box.x * SCALE,
                    middle - (box.y + box.h / 2) * SCALE,
                    -BULLET_SPEED,
                    0
                );
            }
        }
    }

    get centre() {
        return this.parts.find((part) => part.name === "centre");
    }

    // hits more on a part; on the centre, the same hits on each wing still
    // there too, the wings counted first. The hit frame shows on every hit
    // (Thomas, 2026-11-14).
    hit(part, hits, explosions) {
        if (part.dead) {
            return;
        }

        // A hit anywhere on the scarab shows scarab-hit on the hull (Thomas,
        // 2026-11-14), the wings included.
        const shows = part.hit_frame ? part : this.centre;

        if (!shows.dead) {
            shows.flash = FLASH_MS;
            shows.sprite.anims.stop();
            shows.sprite.setFrame(shows.hit_frame);
        }

        if (part.name === "centre") {
            for (const wing of this.parts) {
                if (wing !== part && !wing.dead) {
                    this.count(wing, hits, explosions);
                }
            }
        }

        this.count(part, hits, explosions);
    }

    // hits more on one part; at its last, it blows up.
    count(part, hits, explosions) {
        part.taken += hits;

        if (part.taken < part.hits) {
            return;
        }

        const rect = this.rect(part);

        explosions.spawn(rect.centerX, rect.centerY);
        this.scene.addPoints(part.points);
        part.dead = true;
        part.sprite.setVisible(false);

        if (part.name === "centre") {
            this.state = "dead";
            this.parts.forEach((other) => other.sprite.setVisible(false));
        }
    }

    missile(part, explosions) {
        this.hit(part, MISSILE_HITS, explosions);
    }

    // A part's painted box on screen.
    rect(part) {
        const { sprite, box } = part;

        return new Geom.Rectangle(
            sprite.x + box.x * SCALE,
            sprite.y + box.y * SCALE,
            box.w * SCALE,
            box.h * SCALE
        );
    }

    // As something the ship's bullets can test (PlayerBullets.collide).
    target(part) {
        const rect = this.rect(part);

        return { active: true, visible: true, getBounds: () => rect };
    }

    // The parts a missile can go for: every part still there.
    targets() {
        if (!this.busy) {
            return [];
        }

        return this.parts.filter((part) => !part.dead);
    }

    // The first part still there with a painted pixel under the rectangle
    // (screen px), wings first, or null.
    partIn(rect) {
        if (!this.busy) {
            return null;
        }

        return this.onTop().find((part) => !part.dead && this.paintedIn(part, rect)) ?? null;
    }

    // The parts, the one drawn on top first: the wings, then the hull.
    onTop() {
        return [ ...this.parts ].reverse();
    }

    // True if the rectangle (screen px: left, right, top, bottom) covers a
    // painted pixel of the part, in the frame it shows.
    paintedIn(part, rect) {
        const { sprite } = part;
        const { width, height, painted } = this.masks[sprite.frame.name];
        const left = sprite.x - width * SCALE / 2;
        const top = sprite.y - height * SCALE / 2;

        const first_column = Math.max(0, Math.floor((rect.left - left) / SCALE));
        const last_column = Math.min(width - 1, Math.ceil((rect.right - left) / SCALE) - 1);
        const first_row = Math.max(0, Math.floor((rect.top - top) / SCALE));
        const last_row = Math.min(height - 1, Math.ceil((rect.bottom - top) / SCALE) - 1);

        for (let row = first_row; row <= last_row; row++) {
            for (let column = first_column; column <= last_column; column++) {
                if (painted[row * width + column]) {
                    return true;
                }
            }
        }

        return false;
    }

    isFlying(part) {
        return this.busy && this.parts.includes(part) && !part.dead;
    }

    // True if any painted ship column touches a painted pixel of a part, in
    // the frame it shows.
    touches(columns) {
        if (!columns || !this.busy) {
            return false;
        }

        for (const part of this.parts) {
            if (part.dead) {
                continue;
            }

            const { sprite } = part;
            const { width, height, painted } = this.masks[sprite.frame.name];
            const left = sprite.x - width * SCALE / 2;
            const top = sprite.y - height * SCALE / 2;

            for (const ship of columns) {
                const first_column = Math.max(0, Math.floor((ship.left - left) / SCALE));
                const last_column = Math.min(width - 1, Math.ceil((ship.right - left) / SCALE) - 1);
                const first_row = Math.max(0, Math.floor((ship.top - top) / SCALE));
                const last_row = Math.min(height - 1, Math.ceil((ship.bottom - top) / SCALE) - 1);

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

    // After a lost ship: whole again, out of sight, until the station stops
    // again.
    reset() {
        this.state = "idle";
        this.clock = 0;
        this.fire_clock = 0;
        this.turn = "wings";
        this.bullets.clear();

        for (const part of this.parts) {
            part.taken = 0;
            part.dead = false;
            part.flash = 0;
            part.sprite.setVisible(false);
            this.rest(part);
        }
    }

    destroy() {
        this.bullets.clear();
        this.parts.forEach((part) => part.sprite.destroy());
        this.parts = [];
        this.state = "dead";
    }
}
