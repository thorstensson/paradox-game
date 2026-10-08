import { Geom } from "phaser";
import { paintedBox } from "./FirecometTrack";

// Level 2, the delta (notes.md -> Wave sequence per level).
//
// Two chains of ten deltas, one after the other. The first enters from
// the right just clear of the bottom flames, dips up to touch the centre
// line at mid-screen and heads back out to the bottom, then races off. The
// second comes almost on its tail and does the same from the top: -_-.
// Between the neutron's pace and the clover's.
//
// The numbers are a first pass, to be tuned by eye.

// 32x32 native, drawn at 3x like every alien.
const DELTA_SCALE = 3;

const CHAIN_LENGTH = 10;

// Score for shooting one down.
const POINTS = 100;

// Horizontal speed, px/s, right to left: exactly between the neutron's 477
// and the clover's 716.
const SPEED = 596.5;

// Time between deltas in a chain, ms, worked out from SPEED so the gap
// between their centres stays one sprite width (96px) at any speed.
const SPACING = (32 * DELTA_SCALE) / SPEED * 1000;

// The tallest flame, screen px: 15 native rows of firecave.png at 5x.
const FLAME_REACH = 75;

// Gap left between the delta and the tallest flame where it enters, px.
const FLAME_GAP = 10;

// The part of the crossing where a chain dips in to touch the centre line
// and back out to its edge, as fractions from the right edge to the left:
// -_- (top chain), mirrored for the bottom one. It touches at mid-screen.
const DIP_START = 0.25;
const DIP_END = 0.75;

// From the bottom chain's last delta appearing to the top chain's first, ms:
// the top chain comes in almost on the bottom chain's tail, 358px behind.
// Worked out from SPEED so the distance holds at any speed.
const TOP_DELAY = 358 / SPEED * 1000;

export class DeltaWave {

    scene = null;
    deltas = [];
    hit_box = null;

    // Deltas still to come, both chains together.
    to_spawn = CHAIN_LENGTH * 2;

    constructor(scene) {
        this.scene = scene;
        this.hit_box = paintedBox(scene, "delta");

        const height = scene.cameras.main.height;

        // Deltas spawn and despawn fully off-screen, half a sprite past
        // each edge.
        const margin = 16 * DELTA_SCALE;
        this.start_x = scene.scale.width + margin;
        this.end_x = -margin;

        // Centre heights that put the delta FLAME_GAP clear of the tallest
        // flame, top and bottom, using its painted pixels over every frame.
        const above = -this.hit_box.y * DELTA_SCALE;
        const below = (this.hit_box.y + this.hit_box.h) * DELTA_SCALE;
        this.top_y = FLAME_REACH + FLAME_GAP + above;
        this.bottom_y = height - FLAME_REACH - FLAME_GAP - below;
        this.middle = height / 2;

        this.sendChain(1);
    }

    // Every delta has spawned and every one is gone, shot or flown off.
    get done() {
        return this.to_spawn === 0 && this.deltas.length === 0;
    }

    // side: -1 for the top chain, 1 for the bottom.
    sendChain(side) {
        for (let i = 0; i < CHAIN_LENGTH; i++) {
            this.scene.time.delayedCall(i * SPACING, () => {
                this.spawn(side);
                this.to_spawn--;

                // The bottom chain's last delta is in: the top chain follows.
                if (side === 1 && i === CHAIN_LENGTH - 1) {
                    this.scene.time.delayedCall(TOP_DELAY, () => this.sendChain(-1));
                }
            });
        }
    }

    spawn(side) {
        const delta = this.scene.add.sprite(this.start_x, 0, "delta");
        delta.setScale(DELTA_SCALE);
        delta.side = side;
        delta.points = POINTS;
        delta.y = this.pathY(delta.x, side);
        delta.play({ key: "delta-spin", repeat: -1 });

        this.deltas.push(delta);
    }

    // Height is a function of x alone, so the chain traces one curve. The
    // full cosine is flat where it leaves and rejoins the edge, so the dip
    // has no kinks; it only touches the centre line, never stays on it.
    pathY(x, side) {
        const t = (this.start_x - x) / (this.start_x - this.end_x);
        const u = Math.min(Math.max((t - DIP_START) / (DIP_END - DIP_START), 0), 1);
        const pull = (1 - Math.cos(Math.PI * 2 * u)) / 2;
        const edge = side === 1 ? this.bottom_y : this.top_y;

        return edge + (this.middle - edge) * pull;
    }

    // True if any delta touches the ship. The delta flies on.
    hits(player) {
        const box = new Geom.Rectangle();

        return this.deltas.some((delta) => {
            box.setTo(
                delta.x + this.hit_box.x * DELTA_SCALE,
                delta.y + this.hit_box.y * DELTA_SCALE,
                this.hit_box.w * DELTA_SCALE,
                this.hit_box.h * DELTA_SCALE
            );

            return player.touches(box);
        });
    }

    update(time, delta, bullets, explosions) {
        const step = delta / 1000;

        this.deltas = this.deltas.filter((ship) => {
            ship.x -= SPEED * step;

            if (ship.x < this.end_x) {
                ship.destroy();
                return false;
            }

            ship.y = this.pathY(ship.x, ship.side);

            let hit = false;

            bullets.collide(ship, () => {
                hit = true;
            });

            if (hit) {
                explosions.spawn(ship.x, ship.y);
                this.scene.addPoints(ship.points);
                ship.destroy();
                return false;
            }

            return true;
        });
    }

}
