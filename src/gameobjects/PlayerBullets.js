import { Geom } from "phaser";

// The bullet art is authored at native size, 8x2, like every other sprite.
// Drawn at 3x, the same scale as the ship that fires it.
const SCALE = 3;

const SOURCE_TEXTURE = "ship-bullet";
const DRAW_TEXTURE = "ship-bullet-drawn";

// Screen pixels per second. Delta's player shot crosses the screen fast --
// it keeps the field clear and makes aiming feel decisive.
const SPEED = 900;

// Fixed size. Bullets are never created or destroyed at runtime; a spent one
// goes invisible and waits to be reused. 48 at a 120ms cadence is about four
// seconds of continuous fire in flight at once, which is far more than the
// screen will ever hold.
const POOL_SIZE = 48;

export class PlayerBullets {

    blitter = null;
    bullets = [];
    width = 0;
    height = 0;

    constructor(scene, { depth = 1 } = {}) {
        this.scene = scene;

        ensureTexture(scene);

        const frame = scene.textures.getFrame(DRAW_TEXTURE);
        this.width = frame.width;
        this.height = frame.height;

        this.blitter = scene.add.blitter(0, 0, DRAW_TEXTURE).setDepth(depth);

        for (let i = 0; i < POOL_SIZE; i++) {
            const bob = this.blitter.create(0, 0);
            bob.visible = false;

            this.bullets.push({ bob, active: false, x: 0, y: 0 });
        }
    }

    // Spawns centred on (x, y). Silently does nothing if the pool is dry,
    // which at 48 bullets means the player is already saturating the screen.
    fire(x, y) {
        const bullet = this.bullets.find((b) => !b.active);

        if (!bullet) {
            return;
        }

        bullet.active = true;
        bullet.x = x;
        bullet.y = y;
        bullet.bob.visible = true;

        this.place(bullet);
    }

    // A Blitter draws each Bob at blitter.x + bob.x with no origin applied,
    // so the top-left has to be worked out by hand. x is kept as a float and
    // only rounded when drawn -- rounding the running total would lose the
    // fraction every frame.
    place(bullet) {
        bullet.bob.x = Math.round(bullet.x - this.width / 2);
        bullet.bob.y = Math.round(bullet.y - this.height / 2);
    }

    update(_time, delta) {
        const step = delta / 1000;
        const limit = this.scene.scale.width + this.width;

        for (const bullet of this.bullets) {
            if (!bullet.active) {
                continue;
            }

            bullet.x += SPEED * step;

            if (bullet.x > limit) {
                this.deactivate(bullet);
                continue;
            }

            this.place(bullet);
        }
    }

    // Bobs carry no physics body, so hits are tested by hand. Bullets only
    // ever travel right and there are a few dozen of them, so this is a
    // handful of comparisons -- cheaper than Arcade's broadphase at this
    // count, and it costs nothing when the target is not on screen.
    collide(target, onHit) {
        if (!target || !target.active || !target.visible) {
            return;
        }

        const bounds = target.getBounds();
        const box = new Geom.Rectangle(0, 0, this.width, this.height);

        for (const bullet of this.bullets) {
            if (!bullet.active) {
                continue;
            }

            box.setTo(
                bullet.x - this.width / 2,
                bullet.y - this.height / 2,
                this.width,
                this.height
            );

            if (Geom.Intersects.RectangleToRectangle(box, bounds)) {
                this.deactivate(bullet);
                onHit(bullet.x, bullet.y);
            }
        }
    }

    deactivate(bullet) {
        bullet.active = false;
        bullet.bob.visible = false;
    }

    destroy() {
        this.blitter.destroy();
        this.bullets.length = 0;
    }

}

// The loaded PNG is 8x2. A Blitter does not apply scale to its Bobs -- they
// draw at raw texture size -- so the art is blown up SCALE times once, here, into a
// canvas texture. Nearest-neighbour, so the pixels stay hard.
function ensureTexture(scene) {
    if (scene.textures.exists(DRAW_TEXTURE)) {
        return;
    }

    const source = scene.textures.get(SOURCE_TEXTURE).getSourceImage();
    const width = source.width * SCALE;
    const height = source.height * SCALE;

    const canvas = scene.textures.createCanvas(DRAW_TEXTURE, width, height);
    const ctx = canvas.getContext();

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, width, height);

    canvas.refresh();
}
