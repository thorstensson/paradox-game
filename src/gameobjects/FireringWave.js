import { Geom } from "phaser";

// Level 1, wave kind C (NOTES.md -> Wave structure).
//
// Twelve firerings spaced evenly around an invisible circle, like beads on a
// string. The circle arrives already closed, so the ship cannot get inside
// it. It turns clockwise at a steady rate while it drifts left across the
// screen and off.

// 32x32 native, drawn at 3x like the player ship.
const FIRERING_SCALE = 3;

const RING_COUNT = 12;

// Score for shooting one down.
const POINTS = 100;

// Bullets a ring soaks up before it blows. No sign of the hits before then.
const HITS = 3;

// What kills the ship on contact, in native pixels from the centre: the
// ring at its smallest pulse. A first pass. Bullets still hit the whole
// sprite.
const HIT_BOX = { x: -9, y: -9, w: 18, h: 18 };

// The invisible circle: diameter half the screen height.
const RADIUS_OF_SCREEN = 0.25;

// Drift, px/s, right to left: the slowest thing in the game, since the
// circle is big and the ship has to find a way round it.
const SPEED = 161;

// Turn, radians per second, clockwise: one full turn every 4s.
const SPIN = (Math.PI * 2) / 4;

export class FireringWave {

    scene = null;
    rings = [];

    // Angle of ring 0; ring i sits a sixth of a turn further on.
    angle = 0;

    constructor(scene) {
        this.scene = scene;

        this.radius = scene.cameras.main.height * RADIUS_OF_SCREEN;

        // The whole circle spawns and despawns fully off-screen: its radius
        // plus half a sprite past each edge.
        const margin = this.radius + 16 * FIRERING_SCALE;
        this.centre_x = scene.scale.width + margin;
        this.centre_y = scene.cameras.main.height / 2;
        this.end_x = -margin;

        for (let i = 0; i < RING_COUNT; i++) {
            const ring = scene.add.sprite(0, 0, "firering");
            ring.setScale(FIRERING_SCALE);
            ring.slot = i;
            ring.points = POINTS;
            ring.hits = HITS;
            ring.play({ key: "firering-pulse", repeat: -1 });

            this.rings.push(ring);
        }

        this.place();
    }

    // Every ring is gone, shot or flown off.
    get done() {
        return this.rings.length === 0;
    }

    // Screen y points down, so a growing angle turns clockwise.
    place() {
        for (const ring of this.rings) {
            const a = this.angle + ring.slot * (Math.PI * 2) / RING_COUNT;
            ring.x = this.centre_x + this.radius * Math.cos(a);
            ring.y = this.centre_y + this.radius * Math.sin(a);
        }
    }

    // True if any ring touches the ship. The ring flies on.
    hits(player) {
        const box = new Geom.Rectangle();

        return this.rings.some((ring) => {
            box.setTo(
                ring.x + HIT_BOX.x * FIRERING_SCALE,
                ring.y + HIT_BOX.y * FIRERING_SCALE,
                HIT_BOX.w * FIRERING_SCALE,
                HIT_BOX.h * FIRERING_SCALE
            );

            return player.touches(box);
        });
    }

    update(time, delta, bullets, explosions) {
        const step = delta / 1000;

        this.centre_x -= SPEED * step;
        this.angle += SPIN * step;

        // The circle has fully left the screen.
        if (this.centre_x < this.end_x) {
            this.rings.forEach((ring) => ring.destroy());
            this.rings = [];
            return;
        }

        this.place();

        this.rings = this.rings.filter((ring) => {
            // Each bullet that touches is used up, whether the ring survives
            // it or not.
            bullets.collide(ring, () => {
                ring.hits--;
            });

            if (ring.hits <= 0) {
                explosions.spawn(ring.x, ring.y);
                this.scene.addPoints(ring.points);
                ring.destroy();
                return false;
            }

            return true;
        });
    }

}
