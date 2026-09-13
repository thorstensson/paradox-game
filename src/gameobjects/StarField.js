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
const BANDS = [
    { count: 60, speed: 48, alpha: 0.4, size: 1 },
    { count: 34, speed: 96, alpha: 0.7, size: 2 },
    { count: 16, speed: 176, alpha: 1, size: 3 },
];

export class StarField {

    blitter = null;
    stars = [];
    view_width = 0;
    view_height = 0;

    constructor(scene, { depth = -5 } = {}) {
        this.view_width = scene.scale.width;
        this.view_height = scene.scale.height;

        ensureTexture(scene);

        this.blitter = scene.add.blitter(0, 0, STAR_TEXTURE).setDepth(depth);

        for (const band of BANDS) {
            for (let i = 0; i < band.count; i++) {
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
    }

    destroy() {
        this.blitter.destroy();
        this.stars.length = 0;
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
