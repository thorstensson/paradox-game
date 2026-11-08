import { Geom } from "phaser";
import { EnemyBullets } from "./EnemyBullets";
import { paintedBox } from "./FirecometTrack";

// Level 2, the last wave: the ember ring.
//
// One big ring of fire comes in from the right and moves slowly across the
// screen on a sine between the flames, spinning. As it spins it sprays a
// ring of bullets from its rim, the ring turning with it like a sprinkler.
// The painted frames play the ember-ring-loop tag while Phaser turns the
// sprite.
//
// It soaks up 50 hits, silently, then blows.
//
// The numbers are a first pass, to be tuned by eye.

// 64x64 native, drawn at 3x like every alien.
const RING_SCALE = 3;

// Bullets it soaks up before it blows.
const HITS = 50;

// Score for the kill.
const POINTS = 2000;

// Horizontal drift, px/s, right to left: the dragon's speed, so it stays on
// screen long enough to be shot down.
const SPEED = 80;

// One full sine, up and down, screen px across.
const WAVELENGTH = 640;

// Spin, degrees per second: half the emberstar's, for a heavier feel.
const SPIN = 180;

// Bullets in each spray, spread evenly round the rim, and the time between
// sprays, ms.
const SPRAY_COUNT = 6;
const SPRAY_EVERY = 600;

// The tallest flame, screen px: 15 native rows of firecave.png at 5x.
const FLAME_REACH = 75;

// How close the ring comes to the tallest flame at each turn, screen px.
const FLAME_GAP = 10;

export class EmberRingWave {

    scene = null;
    ring = null;
    hit_box = null;

    // The ring's shots. They fly on after the ring is shot.
    bullets = null;

    // ms until the next spray.
    spray_in = 0;

    constructor(scene) {
        this.scene = scene;
        this.hit_box = paintedBox(scene, "ember-ring");
        this.bullets = new EnemyBullets(scene);

        const width = scene.scale.width;
        const height = scene.cameras.main.height;

        // What the player's shots hit, and where the bullets leave from:
        // a circle through the furthest painted pixel, the shape the ring
        // sweeps as it spins.
        this.radius = (Math.max(this.hit_box.w, this.hit_box.h) / 2) * RING_SCALE;

        this.middle = height / 2;
        this.swing = this.middle - FLAME_REACH - FLAME_GAP - this.radius;

        // Starts fully off the right edge; dropped once fully past the left.
        this.start_x = width + this.radius;
        this.end_x = -this.radius;
        this.width = width;

        this.ring = scene.add.sprite(this.start_x, this.middle, "ember-ring");
        this.ring.setScale(RING_SCALE);
        this.ring.play({ key: "ember-ring-loop", repeat: -1 });
        this.ring.hits = HITS;
    }

    // The ring is gone, shot or flown off, and so is every bullet.
    get done() {
        return this.ring === null && this.bullets.empty;
    }

    // Height at this x: a sine about the centre line.
    curveY(x) {
        const phase = ((this.start_x - x) / WAVELENGTH) * Math.PI * 2;
        return this.middle - this.swing * Math.sin(phase);
    }

    // SPRAY_COUNT bullets, evenly round the rim, turned with the ring.
    spray() {
        const { x, y, angle } = this.ring;

        for (let i = 0; i < SPRAY_COUNT; i++) {
            const a = ((angle + (i * 360) / SPRAY_COUNT) * Math.PI) / 180;
            const from_x = x + Math.cos(a) * this.radius;
            const from_y = y + Math.sin(a) * this.radius;

            this.bullets.fire(from_x, from_y, from_x + Math.cos(a), from_y + Math.sin(a));
        }
    }

    // True if the ring or any bullet touches the ship. Either flies on.
    hits(player) {
        if (this.bullets.hits(player)) {
            return true;
        }

        if (this.ring === null) {
            return false;
        }

        const box = new Geom.Rectangle(
            this.ring.x + this.hit_box.x * RING_SCALE,
            this.ring.y + this.hit_box.y * RING_SCALE,
            this.hit_box.w * RING_SCALE,
            this.hit_box.h * RING_SCALE
        );

        return player.touches(box);
    }

    update(_time, delta, bullets, explosions) {
        const step = delta / 1000;

        this.bullets.update(delta);

        if (this.ring === null) {
            return;
        }

        const ring = this.ring;
        ring.x -= SPEED * step;
        ring.y = this.curveY(ring.x);
        ring.angle += SPIN * step;

        if (ring.x < this.end_x) {
            ring.destroy();
            this.ring = null;
            return;
        }

        // Sprays only once it is on screen.
        if (ring.x < this.width) {
            this.spray_in -= delta;

            if (this.spray_in <= 0) {
                this.spray_in += SPRAY_EVERY;
                this.spray();
            }
        }

        // Each bullet that touches is used up.
        bullets.collideCircle(ring.x, ring.y, this.radius, () => {
            ring.hits--;
        });

        if (ring.hits <= 0) {
            explosions.spawn(ring.x, ring.y);
            this.scene.addPoints(POINTS);
            ring.destroy();
            this.ring = null;
        }
    }

}
