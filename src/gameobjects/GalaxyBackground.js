import { GameObjects } from "phaser";

// The canvas is 1280x800 -- 4x the C64 playfield (320x200), which is the
// scale sprites use.
//
// The background runs on the same 4x grid, so one texture pixel is always
// 4 screen pixels and nothing in the frame is on a different grid.
//
// This requires art 200 rows tall (200 x 4 = 800). The old 160-row tiles
// needed 5x to fill the height, which made their texels coarser than the
// sprites in front of them; they now leave a band of canvas colour along the
// bottom instead, which is the honest trade.
const BACKGROUND_SCALE = 4;

// Scroll speeds in *texture* pixels per second. Multiply by BACKGROUND_SCALE
// for the on-screen rate: 8 drifts at 40px/s, 24 at 120px/s.
const DEFAULT_BACK_SPEED = 8;
const DEFAULT_FRONT_SPEED = 24;

// Mood defaults: the art as authored, knocked back 10%.
//
//   saturation   0 = untouched, negative drains colour, -1 is near greyscale
//   brightness   1 = untouched, below 1 darkens
//   tint         0xffffff = untouched, multiplies the layer's colour
//
// Brightness is folded into the tint rather than applied as a colour matrix.
// Both are a per-channel multiply, so they look identical -- but tint happens
// inside the existing shader, while a colour matrix routes the layer through
// a post-FX render target that Phaser creates with LINEAR filtering
// (WebGLPipeline.js:505, minFilter 0). On pixel art that rounds off exactly
// the hard edges the whole 4x/5x integer pipeline exists to preserve.
//
// So the matrix is only created when saturation is actually non-zero, and is
// torn down again when it returns to 0.
const DEFAULT_SATURATION = 0;
const DEFAULT_BRIGHTNESS = 0.9;
const DEFAULT_BACK_TINT = 0xffffff;
const DEFAULT_FRONT_TINT = 0xffffff;

// Multiply each channel of an 0xRRGGBB tint, clamped to a byte.
function dim(tint, brightness) {
    const channel = (shift) => Math.min(255, Math.max(0,
        Math.round(((tint >> shift) & 0xff) * brightness)
    ));

    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

export class GalaxyBackground extends GameObjects.Container {

    back = null;
    front = null;
    back_speed = DEFAULT_BACK_SPEED;
    front_speed = DEFAULT_FRONT_SPEED;

    back_matrix = null;
    front_matrix = null;

    saturation = DEFAULT_SATURATION;
    brightness = DEFAULT_BRIGHTNESS;
    back_tint = DEFAULT_BACK_TINT;
    front_tint = DEFAULT_FRONT_TINT;

    constructor(scene, {
        back_texture = "oil6-back",
        front_texture = null,
        back_speed = DEFAULT_BACK_SPEED,
        front_speed = DEFAULT_FRONT_SPEED,
        saturation = DEFAULT_SATURATION,
        brightness = DEFAULT_BRIGHTNESS,
        back_tint = DEFAULT_BACK_TINT,
        front_tint = DEFAULT_FRONT_TINT,
    } = {}) {
        super(scene, 0, 0);

        this.back_speed = back_speed;
        this.front_speed = front_speed;

        const width = scene.scale.width / BACKGROUND_SCALE;
        const height = scene.scale.height / BACKGROUND_SCALE;

        // These tiles are seamless left-to-right only, so each sprite is clamped
        // to its texture own height. Without that, any scale leaving the view
        // taller than the art wraps it vertically and puts a seam across the
        // middle of the screen. Short beats seamed: the shortfall just shows
        // canvas colour along the bottom.
        const layerHeight = (key) => Math.min(
            height, scene.textures.get(key).getSourceImage().height
        );

        // TileSprites repeat their texture, so the 272px-wide tile just wraps
        // mid-texture across the virtual width.
        this.back = scene.add.tileSprite(0, 0, width, layerHeight(back_texture), back_texture)
            .setOrigin(0, 0);
        // A single opaque layer is a valid setup -- pass front_texture: null.
        this.front = front_texture
            ? scene.add.tileSprite(0, 0, width, layerHeight(front_texture), front_texture)
                .setOrigin(0, 0)
            : null;

        this.setMood({ saturation, brightness, back_tint, front_tint });

        // Scale the whole group once so both layers stay pixel-aligned.
        this.add([ this.back, this.front ].filter(Boolean));
        this.setScale(BACKGROUND_SCALE);
        this.setDepth(-10);

        scene.add.existing(this);
    }

    // Safe to call at any time -- pass only the keys you want to change.
    setMood({ saturation, brightness, back_tint, front_tint } = {}) {
        if (saturation !== undefined) { this.saturation = saturation; }
        if (brightness !== undefined) { this.brightness = brightness; }
        if (back_tint !== undefined) { this.back_tint = back_tint; }
        if (front_tint !== undefined) { this.front_tint = front_tint; }

        this.back.setTint(dim(this.back_tint, this.brightness));
        if (this.front) {
            this.front.setTint(dim(this.front_tint, this.brightness));
            this.front_matrix = this.syncMatrix(this.front, this.front_matrix);
        }

        this.back_matrix = this.syncMatrix(this.back, this.back_matrix);

        return this;
    }

    // Adds, updates or removes a layer's colour matrix to match saturation.
    syncMatrix(layer, matrix) {
        if (this.saturation === 0) {
            if (matrix) {
                layer.postFX.remove(matrix);
            }

            return null;
        }

        const next = matrix || layer.postFX.addColorMatrix();
        next.saturate(this.saturation, false);

        return next;
    }

    update(_time, delta) {
        // Delta based, so the drift rate is framerate independent.
        this.back.tilePositionX += this.back_speed * (delta / 1000);
        if (this.front) {
            this.front.tilePositionX += this.front_speed * (delta / 1000);
        }
    }

}
