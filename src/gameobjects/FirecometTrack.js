import { Geom } from "phaser";

// Level 2, A1 (notes.md -> Level 2 Concepts -> Wave sequence).
//
// Not a wave: firecomets belong to the fire walls and run alongside the
// level's waves for the whole cave. Each one comes out of the fire at the
// right edge, top or bottom in turn, and flies a straight line to the
// vertical centre of the left edge -- together the paths make a V turned
// on its side:
//
//   \
//     >
//   /
//
// Always the same paths at the same times, so they can be learnt. The comet
// never rotates; it only pulses (firecomet-pulse).

// 32x32 native, drawn at 3x like every alien.
const FIRECOMET_SCALE = 3;

// One entry per comet: how long after the one before it launches, ms (the
// first, after the cave fills the screen). Uneven on purpose, so the rhythm
// is learnt rather than counted, but the same every game.
const LAUNCH_GAPS = [
       0, // comet  1, top    -- at 0s
    4000, // comet  2, bottom -- at 4s
    4000, // comet  3, top    -- at 8s
    2500, // comet  4, bottom -- at 10.5s
    5000, // comet  5, top    -- at 15.5s
    3000, // comet  6, bottom -- at 18.5s
    4000, // comet  7, top    -- at 22.5s
    1500, // comet  8, bottom -- at 24s
    4500, // comet  9, top    -- at 28.5s
    3000, // comet 10, bottom -- at 31.5s
    4000, // comet 11, top    -- at 35.5s
    2000, // comet 12, bottom -- at 37.5s
    5000, // comet 13, top    -- at 42.5s
    3500, // comet 14, bottom -- at 46s
    4000, // comet 15, top    -- at 50s
];

// Where each comet starts: this far into the playfield from its top or
// bottom edge, screen px -- inside the flames.
const FLAME_DEPTH = 60;

// Horizontal speed, px/s, right to left: the fastest in the game.
const SPEED = 716;

// Score for shooting one down.
const POINTS = 100;

// Bullets a firecomet soaks up before it blows. No sign of the hits before
// then, as with the firering. 4 (was 2): the ship enters the fire cave with
// more power.
const HITS = 4;

export class FirecometTrack {

    scene = null;
    comets = [];
    hit_box = null;

    // Every comet is scheduled at once, each at its own time.
    constructor(scene) {
        this.scene = scene;
        this.hit_box = paintedBox(scene, "firecomet");

        const width = scene.scale.width;
        const height = scene.cameras.main.height;

        // Spawned and dropped half a sprite past each edge.
        const margin = 16 * FIRECOMET_SCALE;
        this.start_x = width + margin;
        this.end_x = -margin;

        // Top start, bottom start, and the point both aim at.
        this.starts = [ FLAME_DEPTH, height - FLAME_DEPTH ];
        this.target_x = 0;
        this.target_y = height / 2;

        let at = 0;

        this.timers = LAUNCH_GAPS.map((gap, i) => {
            at += gap;
            return scene.time.delayedCall(at, () => this.launch(i % 2));
        });
    }

    // The cave is leaving: no more comets come out of it. Those in flight
    // fly on and off as usual.
    stopLaunching() {
        this.timers.forEach((timer) => timer.remove());
    }

    // Removes every comet and every launch still to come, at once (dev skip).
    destroy() {
        this.stopLaunching();
        this.comets.forEach((comet) => comet.destroy());
        this.comets = [];
    }

    // side: 0 for the top wall, 1 for the bottom.
    launch(side) {
        const start_y = this.starts[side];

        const comet = this.scene.add.sprite(this.start_x, start_y, "firecomet");
        comet.setScale(FIRECOMET_SCALE);
        comet.points = POINTS;
        comet.hits = HITS;

        // Vertical px per horizontal px, so the line passes through the
        // left edge's centre.
        comet.slope = (this.target_y - start_y) / (this.start_x - this.target_x);
        comet.play({ key: "firecomet-pulse", repeat: -1 });

        this.comets.push(comet);
    }

    // True if any firecomet touches the ship. The comet flies on.
    hits(player) {
        const box = new Geom.Rectangle();

        return this.comets.some((comet) => {
            box.setTo(
                comet.x + this.hit_box.x * FIRECOMET_SCALE,
                comet.y + this.hit_box.y * FIRECOMET_SCALE,
                this.hit_box.w * FIRECOMET_SCALE,
                this.hit_box.h * FIRECOMET_SCALE
            );

            return player.touches(box);
        });
    }

    update(_time, delta, bullets, explosions) {
        const step = delta / 1000;

        this.comets = this.comets.filter((comet) => {
            const dx = SPEED * step;
            comet.x -= dx;
            comet.y += comet.slope * dx;

            if (comet.x < this.end_x) {
                comet.destroy();
                return false;
            }

            // Each bullet that touches is used up, whether the comet
            // survives it or not.
            bullets.collide(comet, () => {
                comet.hits--;
            });

            if (comet.hits <= 0) {
                explosions.spawn(comet.x, comet.y);
                this.scene.addPoints(comet.points);
                comet.destroy();
                return false;
            }

            return true;
        });
    }

}

// The painted pixels over every frame, as a box in native px from the
// sprite's centre: what kills the ship on contact. Read once from the image.
// Given a frame name, only that frame is read.
export function paintedBox(scene, key, only = null) {
    const texture = scene.textures.get(key);
    const image = texture.getSourceImage();

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, image.width, image.height).data;

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    let frame_width = 0;
    let frame_height = 0;

    // A plain image (no atlas) has only its base frame.
    const names = only !== null ? [ only ] : texture.getFrameNames();

    for (const name of names.length ? names : [ "__BASE" ]) {
        const frame = texture.get(name);
        frame_width = frame.cutWidth;
        frame_height = frame.cutHeight;

        for (let row = 0; row < frame.cutHeight; row++) {
            for (let column = 0; column < frame.cutWidth; column++) {
                const i = ((frame.cutY + row) * image.width + frame.cutX + column) * 4;

                if (pixels[i + 3] > 0) {
                    left = Math.min(left, column);
                    right = Math.max(right, column);
                    top = Math.min(top, row);
                    bottom = Math.max(bottom, row);
                }
            }
        }
    }

    return {
        x: left - frame_width / 2,
        y: top - frame_height / 2,
        w: right - left + 1,
        h: bottom - top + 1
    };
}
