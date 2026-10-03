import { Geom } from "phaser";

// Level 1, wave kind B (notes.md -> Wave structure).
//
// Two chains of seven clovers, one after the other. The first enters from
// the right a little above the bottom, eases down onto the very bottom of
// the screen and races along it and off. A few seconds after it has gone,
// the second does the same along the very top. Fast, so it is a memory
// test: dive to the bottom and shoot, then up to the top and shoot, as in
// Delta.

// 32x32 native, drawn at 3x like the player ship.
const CLOVER_SCALE = 3;

const CHAIN_LENGTH = 7;

// Score for shooting one down.
const POINTS = 100;

// What kills the ship on contact, in native pixels from the centre: the
// middle of the clover, inside the blobs at every angle of its spin. A
// first pass. Bullets still hit the whole sprite.
const HIT_BOX = { x: -8, y: -8, w: 16, h: 16 };

// Horizontal speed, px/s, right to left: 1.5x the neutron's 346, then 20%
// up (519 -> 623), and 15% again (623 -> 716).
const SPEED = 716;

// Time between clovers in a chain, ms, worked out from SPEED so the gap
// between their centres stays one clover width (96px) at any speed.
const SPACING = (32 * CLOVER_SCALE) / SPEED * 1000;

// Visible pixels above and below the sprite's centre, native. Used to sit
// the clover on the top or bottom edge of the screen.
const ABOVE_CENTRE = 10;
const BELOW_CENTRE = 11;

// Gap left between the clover and the screen edge, screen px.
const EDGE_GAP = 10;

// How far in from its edge a chain enters, px, and the fraction of the
// crossing by which it has eased onto the edge.
const ENTRY_OFFSET = 150;
const EDGE_AT = 0.3;

// Pause between the bottom chain being gone and the top chain arriving, ms,
// so the player has time to get up there.
const TOP_DELAY = 2000;

export class CloverWave {

    scene = null;
    clovers = [];

    // Clovers still to come, both chains together.
    to_spawn = CHAIN_LENGTH * 2;

    top_sent = false;

    constructor(scene) {
        this.scene = scene;

        // Clovers spawn and despawn fully off-screen, half a sprite past
        // each edge.
        const margin = 16 * CLOVER_SCALE;
        this.start_x = scene.scale.width + margin;
        this.end_x = -margin;

        // Centre heights that put the clover EDGE_GAP in from the screen's
        // edge.
        this.top_y = ABOVE_CENTRE * CLOVER_SCALE + EDGE_GAP;
        this.bottom_y = scene.cameras.main.height - BELOW_CENTRE * CLOVER_SCALE
            - EDGE_GAP;

        this.sendChain(1);
    }

    // Every clover has spawned and every one is gone, shot or flown off.
    get done() {
        return this.to_spawn === 0 && this.clovers.length === 0;
    }

    // side: -1 for the top chain, 1 for the bottom.
    sendChain(side) {
        for (let i = 0; i < CHAIN_LENGTH; i++) {
            this.scene.time.delayedCall(i * SPACING, () => {
                this.spawn(side);
                this.to_spawn--;
            });
        }
    }

    spawn(side) {
        const clover = this.scene.add.sprite(this.start_x, 0, "clover");
        clover.setScale(CLOVER_SCALE);
        clover.side = side;
        clover.points = POINTS;
        clover.y = this.pathY(clover.x, side);
        clover.play({ key: "clover-spin", repeat: -1 });

        this.clovers.push(clover);
    }

    // Height is a function of x alone, so the chain traces one curve. The
    // half-cosine is flat at both ends: the chain enters level and settles
    // onto the edge without a kink.
    pathY(x, side) {
        const t = (this.start_x - x) / (this.start_x - this.end_x);
        const u = Math.min(t / EDGE_AT, 1);
        const offset = ENTRY_OFFSET * (1 + Math.cos(Math.PI * u)) / 2;

        return side === 1
            ? this.bottom_y - offset
            : this.top_y + offset;
    }

    // True if any clover touches the ship. The clover flies on.
    hits(player) {
        const box = new Geom.Rectangle();

        return this.clovers.some((clover) => {
            box.setTo(
                clover.x + HIT_BOX.x * CLOVER_SCALE,
                clover.y + HIT_BOX.y * CLOVER_SCALE,
                HIT_BOX.w * CLOVER_SCALE,
                HIT_BOX.h * CLOVER_SCALE
            );

            return player.touches(box);
        });
    }

    update(time, delta, bullets, explosions) {
        const step = delta / 1000;

        this.clovers = this.clovers.filter((clover) => {
            clover.x -= SPEED * step;

            if (clover.x < this.end_x) {
                clover.destroy();
                return false;
            }

            clover.y = this.pathY(clover.x, clover.side);

            let hit = false;

            bullets.collide(clover, () => {
                hit = true;
            });

            if (hit) {
                explosions.spawn(clover.x, clover.y);
                this.scene.addPoints(clover.points);
                clover.destroy();
                return false;
            }

            return true;
        });

        // Bottom chain fully spawned and gone: the top chain follows.
        if (!this.top_sent && this.to_spawn === CHAIN_LENGTH
            && this.clovers.length === 0) {
            this.top_sent = true;
            this.scene.time.delayedCall(TOP_DELAY, () => this.sendChain(-1));
        }
    }

}
