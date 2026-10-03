import { Scene } from "phaser";

// Delta layout, one line across the HUD band: six-digit score on the left;
// one ship icon per life on the right, as far in from the right edge as the
// score is from the left.
const SCORE_DIGITS = 6;

// From the band edges to the score (left) and the last ship icon (right), px.
const HUD_MARGIN = 10;

// Visible space between one life icon's ship and the next, px -- measured
// between the painted pixels, not the 32x32 frames.
const LIVES_ICON_GAP = 5;

// The icon is the ship's "level" frame at 1.2x: a ~28x20 hull, sized to sit
// beside the Gradius digits (21px capitals at 24).
const LIVES_ICON_SCALE = 1.5;
const LIVES_ICON_FRAME = "0";

// No tint on the score or lives: the font's colour and inner bevel are
// painted into the font image itself, and a tint would multiply over them.

// Techbase at 27 is 1:1 with the size it was exported at.
const HUD_FONT_SIZE = 27;

// The HUD scene is the scene that shows the points and lives.
export class HudScene extends Scene {

    points_text;

    // One per life; the rightmost is lives_icons[0]. Lost lives go from the
    // left end.
    lives_icons = [];

    // Starting lives, passed in by MainScene, which owns the count.
    lives = 0;

    constructor() {
        super("HudScene");
    }

    init(data) {
        this.lives = data.lives;
        this.cameras.main.fadeIn(1000, 0, 0, 0);
    }

    create() {
        this.points_text = this.add.bitmapText(
            HUD_MARGIN, HUD_MARGIN, "main-font", this.format_points(0), HUD_FONT_SIZE
        );

        // The font's measurements are in its own native pixels, so they are
        // scaled up by the same factor the text is drawn at.
        const font = this.cache.bitmapFont.get("main-font").data;
        const font_scale = HUD_FONT_SIZE / font.size;

        const digit = font.chars[48];

        // Centred on the digits' cap height, not on the text box, whose top
        // includes the line's empty space above the capitals.
        const cap_centre = this.points_text.y + (digit.yOffset + digit.height / 2) * font_scale;

        // Right-aligned from the band's right edge, leftwards. Each step is
        // the painted ship's width plus the gap.
        const painted = paintedWidth(this, "ship", LIVES_ICON_FRAME);
        const step = painted * LIVES_ICON_SCALE + LIVES_ICON_GAP;

        this.lives_icons = [];
        let x = this.scale.width - HUD_MARGIN;

        for (let i = 0; i < this.lives; i++) {
            const icon = this.add.image(
                x, Math.round(cap_centre), "ship", LIVES_ICON_FRAME
            ).setOrigin(1, 0.5).setScale(LIVES_ICON_SCALE);

            this.lives_icons.push(icon);
            x -= step;
        }
    }

    update_points(points) {
        this.points_text.setText(this.format_points(points));
    }

    update_lives(lives) {
        this.lives_icons.forEach((icon, i) => icon.setVisible(i < lives));
    }

    format_points(points) {
        return points.toString().padStart(SCORE_DIGITS, "0");
    }
}

// Width of the painted pixels in one frame, leftmost to rightmost, native px.
function paintedWidth(scene, key, frame_name) {
    const texture = scene.textures.get(key);
    const frame = texture.get(frame_name);
    const image = texture.getSourceImage();

    const canvas = document.createElement("canvas");
    canvas.width = frame.cutWidth;
    canvas.height = frame.cutHeight;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(
        image, frame.cutX, frame.cutY, frame.cutWidth, frame.cutHeight,
        0, 0, frame.cutWidth, frame.cutHeight
    );

    const pixels = context.getImageData(0, 0, frame.cutWidth, frame.cutHeight).data;
    let left = frame.cutWidth;
    let right = -1;

    for (let row = 0; row < frame.cutHeight; row++) {
        for (let column = 0; column < frame.cutWidth; column++) {
            if (pixels[(row * frame.cutWidth + column) * 4 + 3] > 0) {
                left = Math.min(left, column);
                right = Math.max(right, column);
            }
        }
    }

    return right < left ? frame.cutWidth : right - left + 1;
}
