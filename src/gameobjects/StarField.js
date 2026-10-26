import { GameObjects } from "phaser";

// A Blitter does NOT apply its own scale to its Bobs. BlitterWebGLRenderer
// places each one at `blitter.x + bob.x` through the *camera* matrix, so
// scaleX/scaleY are ignored entirely (BlitterWebGLRenderer.js:74-88).
// Everything here is therefore in screen pixels.
const STAR_TEXTURE = "star-dot";

// Three dot sizes packed into one texture, so every star is still a single
// batched quad. Sizes are screen pixels -- deliberately finer than the
// background's 4px texel, because a full texel reads as a chunk rather than
// a star.
const STAR_SIZES = [ 1, 2, 3 ];

// Nemesis on the C64: plain square dots, no shapes. Depth is carried by size,
// speed and brightness together -- distant stars small, dim and slow.
//
// The near band is deliberately sparse; a handful of fast bright dots sells
// depth better than a crowd of them.
//
// `clumps` of each band's stars are gathered into coloured clumps; the rest
// stay loose and white. A clump sits inside one band so it drifts as one
// cloud -- mixed speeds would pull it apart.
const BANDS = [
    { count: 53, speed: 56, alpha: 0.4, size: 1, clumps: 4 },
    { count: 29, speed: 110.4, alpha: 0.7, size: 2, clumps: 2 },
    { count: 10, speed: 243.2, alpha: 1, size: 2, clumps: 0 },
];

// First-pass clump look, to be tuned by playing.
const CLUMP_STARS = 10;
const CLUMP_WIDTH = 120;
const CLUMP_HEIGHT = 80;

// AAP-64: the HUD's dark lilac, and an orange-brown. Clumps alternate.
const CLUMP_COLOURS = [ 0x849be4, 0xbb7547 ];

export class StarField {

    blitter = null;
    stars = [];
    clumps = [];
    view_width = 0;
    view_height = 0;

    constructor(scene, { depth = -5 } = {}) {
        this.view_width = scene.scale.width;
        this.view_height = scene.cameras.main.height;

        ensureTexture(scene);

        this.blitter = scene.add.blitter(0, 0, STAR_TEXTURE).setDepth(depth);

        for (const band of BANDS) {
            for (let c = 0; c < band.clumps; c++) {
                this.createClump(band, CLUMP_COLOURS[c % CLUMP_COLOURS.length]);
            }

            const loose = band.count - band.clumps * CLUMP_STARS;

            for (let i = 0; i < loose; i++) {
                const x = Math.random() * this.view_width;

                const bob = this.blitter.create(
                    Math.round(x), this.randomY(), String(band.size)
                );
                bob.alpha = band.alpha;

                // x is kept as a float and only rounded when drawn. Rounding
                // the running total instead would lose the fraction every
                // frame and stall the slowest band completely.
                this.stars.push({ bob, x, speed: band.speed });
            }
        }
    }

    createClump(band, colour) {
        const clump = {
            x: Math.random() * this.view_width,
            y: 0,
            speed: band.speed,
            stars: [],
        };

        for (let i = 0; i < CLUMP_STARS; i++) {
            const bob = this.blitter.create(0, 0, String(band.size));
            bob.alpha = band.alpha;
            bob.tint = colour;

            clump.stars.push({ bob, offset_x: 0 });
        }

        this.scatterClump(clump);
        this.clumps.push(clump);
    }

    // A fresh height and a fresh scatter, so a clump never comes back the
    // same.
    scatterClump(clump) {
        const half_height = CLUMP_HEIGHT / 2;

        clump.y = half_height
            + Math.random() * (this.view_height - CLUMP_HEIGHT);

        for (const star of clump.stars) {
            star.offset_x = Math.round((Math.random() - 0.5) * CLUMP_WIDTH);
            star.bob.y = Math.round(
                clump.y + (Math.random() - 0.5) * CLUMP_HEIGHT
            );
        }
    }

    randomY() {
        return Math.floor(Math.random() * this.view_height);
    }

    update(_time, delta) {
        const step = delta / 1000;

        for (const star of this.stars) {
            star.x -= star.speed * step;

            if (star.x < -4) {
                // Respawn at a fresh height so the field never repeats.
                star.x += this.view_width + 4;
                star.bob.y = this.randomY();
            }

            star.bob.x = Math.round(star.x);
        }

        for (const clump of this.clumps) {
            clump.x -= clump.speed * step;

            // The whole clump wraps once its rightmost star is off the left.
            if (clump.x + CLUMP_WIDTH / 2 < -4) {
                clump.x += this.view_width + CLUMP_WIDTH + 4;
                this.scatterClump(clump);
            }

            for (const star of clump.stars) {
                star.bob.x = Math.round(clump.x + star.offset_x);
            }
        }
    }

    destroy() {
        this.blitter.destroy();
        this.stars.length = 0;
        this.clumps.length = 0;
    }

}

// One texture holding a 1px, 2px and 3px white square, each as its own frame
// so a Bob can pick its size.
function ensureTexture(scene) {
    if (scene.textures.exists(STAR_TEXTURE)) {
        return;
    }

    const gap = 1;
    const width = STAR_SIZES.reduce((total, size) => total + size + gap, 0);
    const height = Math.max(...STAR_SIZES);

    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xffffff, 1);

    let x = 0;

    for (const size of STAR_SIZES) {
        graphics.fillRect(x, 0, size, size);
        x += size + gap;
    }

    graphics.generateTexture(STAR_TEXTURE, width, height);
    graphics.destroy();

    const texture = scene.textures.get(STAR_TEXTURE);

    x = 0;

    for (const size of STAR_SIZES) {
        texture.add(String(size), 0, x, 0, size, size);
        x += size + gap;
    }
}
