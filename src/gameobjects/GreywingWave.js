import { Geom } from "phaser";

// Level 1, wave kind D (notes.md -> Wave structure), the last of the level.
//
// A wall of six greywings stacked top to bottom, flying straight at the
// ship. Every second one trails behind the rest:
//
//   X
//       X
//   X
//       X
//   X
//       X
//
// Pass flipped to swap the stagger: rows 2, 4 and 6 lead instead.

// 32x32 native, drawn at 3x like the player ship.
const GREYWING_SCALE = 3;

const WALL_SIZE = 6;

// Score for shooting one down.
const POINTS = 100;

// Bullets a greywing soaks up before it blows. No sign of the hits before
// then, as with the firering. 5 (was 3) since the double bullets came in,
// to keep the difficulty up.
const HITS = 5;

// What kills the ship on contact, in native pixels from the centre: the
// whole wing, tips included.
const HIT_BOX = { x: -11, y: -14, w: 22, h: 28 };

// The wing's visible size, native: 22 wide, 28 tall.
const WING_WIDTH = 22;
const WING_HEIGHT = 28;

// Gap between one greywing and the next down the wall, screen px: half a
// wing width.
const GAP = (WING_WIDTH * GREYWING_SCALE) / 2;

// How far rows 2, 4 and 6 trail behind, screen px: three wing lengths.
const TRAIL = WING_WIDTH * GREYWING_SCALE * 3;

// Horizontal speed, px/s, right to left: fast, same as the clover.
const SPEED = 716;

export class GreywingWave {

    scene = null;
    wings = [];

    constructor(scene, flipped = false) {
        this.scene = scene;

        // Greywings spawn and despawn fully off-screen, half a sprite past
        // each edge.
        const margin = 16 * GREYWING_SCALE;
        const start_x = scene.scale.width + margin;
        this.end_x = -margin;

        // The wall is centred top to bottom.
        const pitch = WING_HEIGHT * GREYWING_SCALE + GAP;
        const wall_height = WALL_SIZE * pitch - GAP;
        const top_y = (scene.cameras.main.height - wall_height) / 2
            + (WING_HEIGHT * GREYWING_SCALE) / 2;

        for (let i = 0; i < WALL_SIZE; i++) {
            const leads = (i % 2 === 0) !== flipped;
            const x = leads ? start_x : start_x + TRAIL;
            const wing = scene.add.sprite(x, top_y + i * pitch, "greywing");
            wing.setScale(GREYWING_SCALE);
            wing.points = POINTS;
            wing.hits = HITS;
            wing.play("greywing-level");

            this.wings.push(wing);
        }
    }

    // Every greywing is gone, shot or flown off.
    get done() {
        return this.wings.length === 0;
    }

    // True if any greywing touches the ship. The greywing flies on.
    hits(player) {
        const box = new Geom.Rectangle();

        return this.wings.some((wing) => {
            box.setTo(
                wing.x + HIT_BOX.x * GREYWING_SCALE,
                wing.y + HIT_BOX.y * GREYWING_SCALE,
                HIT_BOX.w * GREYWING_SCALE,
                HIT_BOX.h * GREYWING_SCALE
            );

            return player.touches(box);
        });
    }

    update(time, delta, bullets, explosions) {
        const step = delta / 1000;

        this.wings = this.wings.filter((wing) => {
            wing.x -= SPEED * step;

            if (wing.x < this.end_x) {
                wing.destroy();
                return false;
            }

            // Each bullet that touches is used up, whether the greywing
            // survives it or not.
            bullets.collide(wing, () => {
                wing.hits--;
            });

            if (wing.hits <= 0) {
                explosions.spawn(wing.x, wing.y);
                this.scene.addPoints(wing.points);
                wing.destroy();
                return false;
            }

            return true;
        });
    }

}
