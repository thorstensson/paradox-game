import { Scene } from "phaser";

// Nemesis layout, one line across the HUD band: one ship icon per life on
// the left, then the six-digit score, then HI on the right. Positions are
// the C64 Nemesis HUD's, measured and scaled to our 4x canvas; the score sits
// far enough right for five ships before it.
const SCORE_DIGITS = 6;

// From the band's top to the text, px.
const HUD_MARGIN = 10;

// From the band's left edge to the first ship's painted pixels, in painted
// ship widths (as on Nemesis, well in from the edge).
const LIVES_LEFT_IN_SHIPS = 2;

// Left edges of the score and of HI, px.
const SCORE_X = 344;
const HI_X = 896;

// Visible space between one life icon's ship and the next, px -- measured
// between the painted pixels, not the 32x32 frames.
const LIVES_ICON_GAP = 5;

// The icon is raven-score-12p.png, the ship repainted at 12x12, drawn at 2x:
// 24 px on screen, even 2x2 pixels.
const LIVES_ICON_SCALE = 2;
const LIVES_ICON = "lives-icon";

// The best score so far, kept in this browser (as the C64 kept it until
// switched off). Later the top of the Supabase table may take its place.
const HI_STORAGE_KEY = "obsidion-hi";

// No tint on the score or lives: the font's colour and inner bevel are
// painted into the font image itself, and a tint would multiply over them.

// Katakis at 24 is 1:1 with the size it was exported at.
const HUD_FONT_SIZE = 24;

// HI smaller than the score, as on Nemesis, its capitals' tops level with
// the score's digits. Test: the 24 font drawn at 16 (0.667, uneven bricks),
// to see the proportions before a real 16 export.
const HI_FONT_SIZE = 16;

// The HUD scene is the scene that shows the points, HI and lives.
export class HudScene extends Scene {

    points_text;
    hi_text;

    // The best score, shown as HI; beaten live during a game.
    hi = 0;

    // One per life; the leftmost is lives_icons[0]. Lost lives go from the
    // right end, so the ships left stay at the left.
    lives_icons = [];

    // Starting lives, passed in by MainScene, which owns the count.
    lives = 0;

    constructor() {
        super("HudScene");
    }

    init(data) {
        this.lives = data.lives;
        this.hi = loadHi();
        this.cameras.main.fadeIn(1000, 0, 0, 0);
    }

    create() {
        this.points_text = this.add.bitmapText(
            SCORE_X, HUD_MARGIN, "main-font", this.format_points(0), HUD_FONT_SIZE
        );

        // The font's measurements are in its own native pixels, so they are
        // scaled up by the same factor the text is drawn at.
        const font = this.cache.bitmapFont.get("main-font").data;
        const font_scale = HUD_FONT_SIZE / font.size;

        const digit = font.chars[48];

        // HI's capitals start where the score's digits start.
        const hi_scale = HI_FONT_SIZE / font.size;
        const digits_top = this.points_text.y + digit.yOffset * font_scale;

        this.hi_text = this.add.bitmapText(
            HI_X, Math.round(digits_top - font.chars[72].yOffset * hi_scale),
            "main-font", this.format_hi(), HI_FONT_SIZE
        );

        // Centred on the digits' cap height, not on the text box, whose top
        // includes the line's empty space above the capitals.
        const cap_centre = this.points_text.y + (digit.yOffset + digit.height / 2) * font_scale;

        // Rightwards from the band's left edge. Placed by the painted ship,
        // not the 32x32 frame: each step is the painted width plus the gap.
        const painted = paintedSpan(this, LIVES_ICON);
        const step = painted.width * LIVES_ICON_SCALE + LIVES_ICON_GAP;

        this.lives_icons = [];
        let x = LIVES_LEFT_IN_SHIPS * painted.width * LIVES_ICON_SCALE;

        for (let i = 0; i < this.lives; i++) {
            const icon = this.add.image(
                Math.round(x - painted.left * LIVES_ICON_SCALE), Math.round(cap_centre), LIVES_ICON
            ).setOrigin(0, 0.5).setScale(LIVES_ICON_SCALE);

            this.lives_icons.push(icon);
            x += step;
        }
    }

    update_points(points) {
        this.points_text.setText(this.format_points(points));

        if (points > this.hi) {
            this.hi = points;
            this.hi_text.setText(this.format_hi());
            saveHi(points);
        }
    }

    update_lives(lives) {
        this.lives_icons.forEach((icon, i) => icon.setVisible(i < lives));
    }

    format_points(points) {
        return points.toString().padStart(SCORE_DIGITS, "0");
    }

    format_hi() {
        return `HI ${this.format_points(this.hi)}`;
    }
}

// Browser storage can be missing or blocked (private windows); the HI then
// starts at 0 and is not kept.
function loadHi() {
    try {
        return Number(localStorage.getItem(HI_STORAGE_KEY)) || 0;
    } catch {
        return 0;
    }
}

function saveHi(points) {
    try {
        localStorage.setItem(HI_STORAGE_KEY, String(points));
    } catch {
        // Not kept; the game plays on.
    }
}

// The painted pixels' span in one frame, native px: the leftmost painted
// column and the width to the rightmost. No frame name = the texture's first
// frame.
function paintedSpan(scene, key, frame_name) {
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

    return right < left
        ? { left: 0, width: frame.cutWidth }
        : { left, width: right - left + 1 };
}
