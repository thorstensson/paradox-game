// Level 2's walls: the firecave strip along the bottom of the screen, and the
// same strip flipped along the top. Both slide in from the right edge, then
// stand still while their texture scrolls on at the same speed, so the hand
// over never shows.
//
// At the end of the level the same happens backwards: the texture stops and
// both strips slide off to the left, open space behind them.
//
// A TileSprite has no Animation component, so the firecave-loop tag cannot be
// played -- the flicker steps through the frames by hand with setFrame().

// 5x, on trial (3x read too fine, 4x is one C64 pixel).
const SCALE = 5;

// Screen px per second -- fast, a rush through the cave.
const SPEED = 337.6;

// ms per flicker frame -- 70 ms. The game uses this one value for every
// frame; the durations in firecave.json are not read.
const FRAME_TIME = 70;

export class FireCave {
    strips = [];
    frames = [];
    frame_index = 0;

    // Per frame, per column: how far the flame reaches in from the strip's
    // outer edge, native px. Read once from the painted pixels.
    heights = [];
    frame_width = 0;
    view_height = 0;

    // Native columns in the middle of each gap between flames: where the
    // strips' trailing edge is set to end, so no flame is cut off as they
    // slide out.
    gap_middles = [];

    // The strips' width, screen px: the screen's width, lengthened by
    // leave() to end in a gap.
    length = 0;

    // Screen px still to cover while sliding in, then screen px scrolled.
    x = 0;
    scroll = 0;
    sliding = true;

    // Set by leave(): sliding out, then gone. onLeft runs once it has gone.
    leaving = false;
    gone = false;
    onLeft = null;

    // onFormed runs once, when the strips reach the left edge and the cave
    // fills the screen.
    constructor(scene, onFormed) {
        this.onFormed = onFormed;

        const width = scene.scale.width;
        const height = scene.cameras.main.height;

        // The native frame is 128x64, power-of-two both ways -- TileSprite
        // stretches anything else to the next power of two.
        const strip_height = 64 * SCALE;

        this.frames = scene.textures.get("firecave").getFrameNames();
        this.heights = flameHeights(scene, this.frames);
        this.frame_width = this.heights[0].length;
        this.gap_middles = gapMiddles(this.heights);
        this.view_height = height;
        this.width = width;
        this.length = width;
        this.x = width;

        const bottom = scene.add.tileSprite(
            width, height, width, strip_height, "firecave", this.frames[0]
        ).setOrigin(0, 1);

        // flipY flips the strip in place, inside its own box.
        const top = scene.add.tileSprite(
            width, 0, width, strip_height, "firecave", this.frames[0]
        ).setOrigin(0, 0).setFlipY(true);

        for (const strip of [ bottom, top ]) {
            // Behind the ship and the aliens, in front of the stars.
            strip.setTileScale(SCALE, SCALE).setDepth(-1);
            this.strips.push(strip);
        }

        this.timer = scene.time.addEvent({
            delay: FRAME_TIME,
            loop: true,
            callback: () => {
                this.frame_index = (this.frame_index + 1) % this.frames.length;

                for (const strip of this.strips) {
                    strip.setFrame(this.frames[this.frame_index]);
                }
            }
        });
    }

    // The level is over: the cave slides out to the left. onLeft runs once
    // it is off the screen and gone.
    //
    // The strips' right edge sits at the screen's right edge, at whatever
    // column of the frame the scroll has reached, often mid-flame. So both
    // strips are first lengthened, off-screen to the right, to the middle of
    // the next gap between flames.
    leave(onLeft) {
        this.leaving = true;
        this.onLeft = onLeft;

        const period = this.frame_width * SCALE;
        const edge = (this.width + Math.round(this.scroll)) % period;

        let extra = 0;

        if (this.gap_middles.length) {
            extra = Math.min(...this.gap_middles.map(
                (column) => (column * SCALE - edge + period) % period
            ));
        }

        this.length = this.width + extra;

        for (const strip of this.strips) {
            strip.setSize(this.length, strip.height);
        }
    }

    // Removes the cave at once.
    destroy() {
        this.timer.remove();
        this.strips.forEach((strip) => strip.destroy());
        this.strips = [];
        this.gone = true;
    }

    update(_time, delta) {
        if (this.gone) {
            return;
        }

        let step = SPEED * delta / 1000;

        // The texture holds still, so the flames travel with the strips.
        if (this.leaving) {
            this.x -= step;

            for (const strip of this.strips) {
                strip.x = Math.round(this.x);
            }

            if (this.x <= -this.length) {
                this.destroy();
                this.onLeft?.();
            }

            return;
        }

        if (this.sliding) {
            this.x -= step;

            if (this.x > 0) {
                step = 0;
            } else {
                // Whatever overshot the edge goes on as scroll, so the
                // motion carries straight through.
                step = -this.x;
                this.x = 0;
                this.sliding = false;
            }

            for (const strip of this.strips) {
                strip.x = Math.round(this.x);
            }

            if (!this.sliding && this.onFormed) {
                this.onFormed();
            }
        }

        // tilePositionX is in native texture px, so whole screen px are
        // divided back down by the scale.
        this.scroll += step;

        for (const strip of this.strips) {
            strip.tilePositionX = Math.round(this.scroll) / SCALE;
        }
    }

    // True when any painted part of the ship touches fire, top or bottom.
    // Checked one screen column at a time, the ship's painted extent there
    // against the flame the frame on show paints there, so only fire on ship
    // kills -- not the gaps between flames, nor the gaps in the ship.
    hits(player) {
        const columns = player.paintedColumns();

        if (!columns || this.gone) {
            return false;
        }

        const heights = this.heights[this.frame_index];
        const strip_x = this.strips[0].x;
        const offset = this.strips[0].tilePositionX;

        for (const ship of columns) {
            for (let x = Math.floor(ship.left); x < ship.right; x++) {
                // Still sliding in: no fire left of the strips' edge yet.
                // Sliding out: none right of their trailing edge.
                if (x < strip_x || x >= strip_x + this.length) {
                    continue;
                }

                // The texture repeats, so the screen column wraps round to
                // a column of the native frame.
                const column = Math.floor((x - strip_x) / SCALE + offset) % this.frame_width;
                const reach = heights[column] * SCALE;

                if (ship.bottom > this.view_height - reach || ship.top < reach) {
                    return true;
                }
            }
        }

        return false;
    }
}

// The middle column of each gap between flames, native px. A gap is a run
// of columns where the flame, at its tallest over all frames, is lowest --
// empty in every frame, if the painting has such columns, since the flicker
// runs on while the cave slides out. The frame repeats, so a run may wrap
// round from the last column to the first.
function gapMiddles(heights) {
    const width = heights[0].length;
    const tallest = [];

    for (let column = 0; column < width; column++) {
        tallest.push(Math.max(...heights.map((frame) => frame[column])));
    }

    const lowest = Math.min(...tallest);
    const in_gap = tallest.map((reach) => reach === lowest);

    // Every column the same: no gap to aim for.
    if (in_gap.every(Boolean)) {
        return [];
    }

    // Start just after a flame column, so no run is split by the wrap.
    const start = (in_gap.lastIndexOf(false) + 1) % width;
    const middles = [];
    let run = 0;

    for (let i = 0; i < width; i++) {
        const column = (start + i) % width;

        if (in_gap[column]) {
            run++;
        }

        if (run > 0 && (!in_gap[column] || i === width - 1)) {
            const last = in_gap[column] ? i : i - 1;
            middles.push((start + last - Math.floor((run - 1) / 2)) % width);
            run = 0;
        }
    }

    return middles;
}

// Reads the loaded firecave image once and, for each frame, finds the
// topmost painted pixel in every column. The bottom strip is the frame as
// painted; the top strip is the same frame flipped, so the same heights serve
// both.
function flameHeights(scene, frames) {
    const texture = scene.textures.get("firecave");
    const image = texture.getSourceImage();

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, image.width, image.height).data;

    return frames.map((name) => {
        const frame = texture.get(name);
        const heights = [];

        for (let column = 0; column < frame.cutWidth; column++) {
            let reach = 0;

            for (let row = 0; row < frame.cutHeight; row++) {
                const i = ((frame.cutY + row) * image.width + frame.cutX + column) * 4;

                if (pixels[i + 3] > 0) {
                    reach = frame.cutHeight - row;
                    break;
                }
            }

            heights.push(reach);
        }

        return heights;
    });
}
