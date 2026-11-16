// A Blitter does NOT apply its own scale to its Bobs. BlitterWebGLRenderer
// places each one at `blitter.x + bob.x` through the *camera* matrix, so
// scaleX/scaleY are ignored entirely (BlitterWebGLRenderer.js:74-88).
// Everything here is therefore in screen pixels.
const STAR_TEXTURE = "star-dot";

// C64 style (Thomas, 2026-11-16: "a bit more pixellated"): every star is
// one of the ship's pixels, 3x3 screen px, and sits and steps on that 3 px
// grid, so it jumps a pixel at a time as on the C64 rather than gliding.
const PIXEL = 3;

// After Katakis on the C64 (Thomas, 2026-11-16): an even field of single
// stars lying along diagonals that run from top left to bottom right ("\"),
// mostly dim with a few bright, fading in and out. Solid C64 greys
// (Colodore), no transparency.
const WHITE = 0xffffff;
const LIGHT_GREY = 0xadadad;
const MEDIUM_GREY = 0x7b7b7b;
const DARK_GREY = 0x4a4a4a;

// The far layer, slow: the diagonal field. Along a "\" line each star is
// ALONG px across and ALONG px down from the last (about 37 px apart); the
// lines are LINE_GAP px apart across the screen. Each star sits up to
// SCATTER px off its spot. The field is FIELD_WIDTH wide, a whole number of
// LINE_GAPs past the screen's width, so a star going off the left edge comes
// back in at the right still on its line.
const FAR_SPEED = 56;
const ALONG = 26;
const LINE_GAP = 120;
const SCATTER = 21;

// About this share of the spots on the lines stay empty, picked at random,
// so the lines break up as in Katakis.
const EMPTY = 0.36;

// The far stars' colours, picked at random with these weights: mostly dim,
// a few bright, the Katakis tone (Thomas, 2026-11-16: "like snow now").
const FAR_COLOURS = [
    { colour: WHITE, weight: 3.5 },
    { colour: LIGHT_GREY, weight: 5 },
    { colour: MEDIUM_GREY, weight: 35 },
    { colour: DARK_GREY, weight: 56.5 },
];

// On top, faster and fewer: single stars at random, as before. The near
// layer is deliberately sparse; a handful of fast bright dots sells depth
// better than a crowd of them.
const LAYERS = [
    { count: 23, speed: 110.4, colours: [ MEDIUM_GREY, DARK_GREY ] },
    // Exactly these colours, one per star: 3 white, 5 light grey.
    {
        count: 8, speed: 243.2,
        exact: [ WHITE, WHITE, WHITE, LIGHT_GREY, LIGHT_GREY, LIGHT_GREY, LIGHT_GREY, LIGHT_GREY ]
    },
];

// The fade: every now and then, at its own random moment, a star steps down
// the greys to off and back up to its own, one step every FADE_STEP_MS -- a
// C64 fade, no transparency. FADE_MIN_MS to FADE_MAX_MS between fades.
const GREYS = [ WHITE, LIGHT_GREY, MEDIUM_GREY, DARK_GREY ];
const FADE_STEP_MS = 60;
const FADE_MIN_MS = 1000;
const FADE_MAX_MS = 5000;

// First-pass numbers, all of them, to be tuned by playing.

// On the PIXEL grid.
const snap = (value) => Math.round(value / PIXEL) * PIXEL;

const between = (min, max) => min + Math.random() * (max - min);

const pick = (list) => list[Math.floor(Math.random() * list.length)];

function pickWeighted(list) {
    let roll = Math.random() * list.reduce((total, item) => total + item.weight, 0);

    for (const item of list) {
        roll -= item.weight;

        if (roll < 0) {
            return item.colour;
        }
    }

    return list[list.length - 1].colour;
}

// From the star's grey down to off and back: e.g. light grey runs medium,
// dark, off, dark, medium, light. null is off.
function fadeSteps(colour) {
    const down = GREYS.slice(GREYS.indexOf(colour) + 1);

    return [ ...down, null, ...[ ...down ].reverse(), colour ];
}

export class StarField {

    // Every star's speed is times this: 1, full speed, everywhere but the
    // outro, which slows the stars as the planet comes in (Outro.js).
    pace = 1;

    blitter = null;
    view_width = 0;
    view_height = 0;

    // The far field: each star's spot on its line (x, a float, and y), and
    // its scatter off it.
    far = [];
    field_width = 0;

    // The faster stars on top.
    stars = [];

    // Every star, for the fading.
    faders = [];

    constructor(scene, { depth = -5 } = {}) {
        this.view_width = scene.scale.width;
        this.view_height = scene.cameras.main.height;
        this.field_width = Math.ceil((this.view_width + PIXEL) / LINE_GAP) * LINE_GAP;

        ensureTexture(scene);

        this.blitter = scene.add.blitter(0, 0, STAR_TEXTURE).setDepth(depth);

        // Down the screen, one star per line every ALONG px; across, one
        // line every LINE_GAP px, each row ALONG further right than the one
        // above.
        const rows = Math.ceil(this.view_height / ALONG);
        const lines = this.field_width / LINE_GAP;

        for (let row = 0; row < rows; row++) {
            for (let line = 0; line < lines; line++) {
                if (Math.random() < EMPTY) {
                    continue;
                }

                const colour = pickWeighted(FAR_COLOURS);
                const star = {
                    bob: this.blitter.create(0, 0),
                    x: (line * LINE_GAP + row * ALONG) % this.field_width,
                    y: row * ALONG,
                    dx: 0,
                    dy: 0
                };

                star.bob.tint = colour;
                this.scatter(star);
                this.far.push(star);
                this.fade(star.bob, colour);
            }
        }

        for (const layer of LAYERS) {
            for (let i = 0; i < layer.count; i++) {
                const colour = layer.exact ? layer.exact[i] : pick(layer.colours);
                const bob = this.blitter.create(0, this.randomY());

                bob.tint = colour;

                // x is kept as a float and only snapped when drawn. Rounding
                // the running total instead would lose the fraction every
                // frame and stall the slowest layer completely.
                this.stars.push({ bob, x: Math.random() * this.view_width, speed: layer.speed });
                this.fade(bob, colour);
            }
        }
    }

    // A fresh place off its spot, so the field never comes back the same.
    scatter(star) {
        star.dx = snap(between(-SCATTER, SCATTER));
        star.dy = snap(between(-SCATTER, SCATTER));
        star.bob.y = snap(star.y) + star.dy;
    }

    randomY() {
        return Math.floor(Math.random() * this.view_height / PIXEL) * PIXEL;
    }

    fade(bob, colour) {
        this.faders.push({ bob, steps: fadeSteps(colour), step: -1, wait: between(0, FADE_MAX_MS) });
    }

    update(_time, delta) {
        // Every star's speed times pace.
        const step = (delta / 1000) * this.pace;

        for (const star of this.far) {
            star.x -= FAR_SPEED * step;

            // Off the left edge: back in past the right, a whole field
            // further on, so it is still on its line.
            if (star.x + star.dx < -PIXEL) {
                star.x += this.field_width;
                this.scatter(star);
            }

            star.bob.x = snap(star.x) + star.dx;
        }

        for (const star of this.stars) {
            star.x -= star.speed * step;

            if (star.x < -PIXEL) {
                // Respawn at a fresh height so the field never repeats.
                star.x += this.view_width + PIXEL;
                star.bob.y = this.randomY();
            }

            star.bob.x = snap(star.x);
        }

        // Fading runs on real time, so it keeps going while the outro slows
        // the stars.
        for (const fader of this.faders) {
            fader.wait -= delta;

            if (fader.wait > 0) {
                continue;
            }

            fader.step++;

            if (fader.step < fader.steps.length) {
                const colour = fader.steps[fader.step];

                fader.bob.setVisible(colour !== null);

                if (colour !== null) {
                    fader.bob.tint = colour;
                }

                fader.wait += FADE_STEP_MS;
            } else {
                fader.step = -1;
                fader.wait += between(FADE_MIN_MS, FADE_MAX_MS);
            }
        }
    }

    destroy() {
        this.blitter.destroy();
        this.far.length = 0;
        this.stars.length = 0;
        this.faders.length = 0;
    }

}

// One white PIXEL x PIXEL square; each star tints it to its colour.
function ensureTexture(scene) {
    if (scene.textures.exists(STAR_TEXTURE)) {
        return;
    }

    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);

    graphics.fillStyle(0xffffff, 1);
    graphics.fillRect(0, 0, PIXEL, PIXEL);
    graphics.generateTexture(STAR_TEXTURE, PIXEL, PIXEL);
    graphics.destroy();
}
