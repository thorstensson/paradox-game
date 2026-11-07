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
const HI_STORAGE_KEY = "paradox-hi";

// No tint on the score or lives: the font's colour and inner bevel are
// painted into the font image itself, and a tint would multiply over them.

// Katakis at 24 is 1:1 with the size it was exported at.
const HUD_FONT_SIZE = 24;

// HI smaller than the score, as on Nemesis, its capitals' tops level with
// the score's digits. Test: the 24 font drawn at 16 (0.667, uneven bricks),
// to see the proportions before a real 16 export.
const HI_FONT_SIZE = 16;

// Thin band along the bottom of the canvas, as on Nemesis: one label per
// power-up, in the HI font size, the row centred across the canvas. A
// label has a grey box behind it, which blinks while its power-up is on. MainScene keeps
// the playfield clear of the band. 40 px, as tall as the top band.
export const BOTTOM_BAND = 40;

// In order, left to right. Each name is the key update_powerups() takes.
// MISSILE has no power-up yet, so it never lights.
const POWERUP_LABELS = [
    { name: "railgun", text: "RAILGUN" },
    { name: "shield", text: "SHIELD" },
    { name: "speed", text: "SPEED" },
    { name: "missile", text: "MISSILE" }
];

// Every box the same width, as on Nemesis: RAILGUN (112 px at 16) plus 8 px
// each side. Each word is centred in its box.
const POWERUP_BOX_WIDTH = 128;
const POWERUP_BOX_GAP = 32;

// 26 px tall in the 40 px band: 7 px clear above and below, 6 px between the
// 14 px capitals and the box's top and bottom -- 3 bricks of the 16 font,
// the same 3 bricks of space the score has in the top band.
const POWERUP_BOX_HEIGHT = 26;

// The box's colour while its power-up is off; always shown.
const POWERUP_BOX_COLOUR = 0x333941;

// While its power-up is on, the box blinks through these, in order, each
// shown for POWERUP_BLINK_MS.
const POWERUP_BLINK_COLOURS = [0xdae0ea, 0xb9bffb, 0x849be4];
const POWERUP_BLINK_MS = 100;

// Dev only: the FPS readout's gap from the canvas's right edge, px, and how
// often it is refreshed, ms.
const FPS_RIGHT = 10;
const FPS_MS = 500;

// The HUD scene is the scene that shows the points, HI and lives.
export class HudScene extends Scene {

    points_text;
    hi_text;

    // The best score, shown as HI; beaten live during a game.
    hi = 0;

    // One per life; the leftmost is lives_icons[0]. Lost lives go from the
    // right end, so the ships left stay at the left.
    lives_icons = [];

    // The box behind each power-up label, by name.
    powerup_boxes = {};

    // Names of the power-ups that are on; their boxes blink.
    powerups_on = new Set();

    // Index into POWERUP_BLINK_COLOURS, shared by every blinking box.
    blink_index = 0;

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
            SCORE_X, HUD_MARGIN, "hud-font", this.format_points(0), HUD_FONT_SIZE
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
            "hud-font", this.format_hi(), HI_FONT_SIZE
        );

        // Centred on the digits' cap height, not on the text box, whose top
        // includes the line's empty space above the capitals.
        const cap_centre = this.points_text.y + (digit.yOffset + digit.height / 2) * font_scale;

        // Rightwards from the band's left edge. Placed by the painted ship,
        // not the 32x32 frame: each step is the painted width plus the gap.
        const painted = paintedSpan(this, LIVES_ICON);

        this.lives_icons = [];
        this.lives_painted = painted;
        this.lives_step = painted.width * LIVES_ICON_SCALE + LIVES_ICON_GAP;
        this.lives_x = LIVES_LEFT_IN_SHIPS * painted.width * LIVES_ICON_SCALE;
        this.lives_y = cap_centre;

        for (let i = 0; i < this.lives; i++) {
            this.add_life_icon();
        }

        // The bottom band's labels, the whole row of boxes centred across
        // the canvas.
        const box_top = this.scale.height - BOTTOM_BAND + (BOTTOM_BAND - POWERUP_BOX_HEIGHT) / 2;
        const caps_height = font.chars[72].height * hi_scale;
        const row_width = POWERUP_LABELS.length * POWERUP_BOX_WIDTH
            + (POWERUP_LABELS.length - 1) * POWERUP_BOX_GAP;
        let box_x = (this.scale.width - row_width) / 2;

        this.powerup_boxes = {};

        for (const { name, text } of POWERUP_LABELS) {
            // Added first, so the word draws over it.
            const box = this.add.rectangle(
                box_x, box_top, POWERUP_BOX_WIDTH, POWERUP_BOX_HEIGHT, POWERUP_BOX_COLOUR
            ).setOrigin(0, 0);

            const label = this.add.bitmapText(0, 0, "main-font", text, HI_FONT_SIZE);
            label.setPosition(
                Math.round(box_x + (POWERUP_BOX_WIDTH - label.width) / 2),
                Math.round(box_top + (POWERUP_BOX_HEIGHT - caps_height) / 2
                    - font.chars[72].yOffset * hi_scale)
            );

            this.powerup_boxes[name] = box;
            box_x += POWERUP_BOX_WIDTH + POWERUP_BOX_GAP;
        }

        this.powerups_on = new Set();
        this.blink_index = 0;

        // Dev server only, never in the released game: frames per second,
        // right end of the top band, level with HI, every FPS_MS.
        if (import.meta.env.DEV) {
            const fps_text = this.add.bitmapText(
                this.scale.width - FPS_RIGHT, this.hi_text.y, "hud-font", "", HI_FONT_SIZE
            ).setOrigin(1, 0);

            this.time.addEvent({
                delay: FPS_MS,
                loop: true,
                callback: () => fps_text.setText(`FPS ${Math.round(this.game.loop.actualFps)}`)
            });
        }

        // Steps every blinking box to the next colour.
        this.time.addEvent({
            delay: POWERUP_BLINK_MS,
            loop: true,
            callback: () => {
                this.blink_index = (this.blink_index + 1) % POWERUP_BLINK_COLOURS.length;

                for (const name of this.powerups_on) {
                    this.powerup_boxes[name].setFillStyle(POWERUP_BLINK_COLOURS[this.blink_index]);
                }
            }
        });
    }

    // Which power-ups are on, by name ({ railgun: true, ... }); a name left
    // out is left as it is. An on box blinks; an off box goes back to grey.
    update_powerups(on) {
        for (const [name, live] of Object.entries(on)) {
            const box = this.powerup_boxes[name];

            if (!box) {
                continue;
            }

            if (live) {
                if (!this.powerups_on.has(name)) {
                    this.powerups_on.add(name);
                    box.setFillStyle(POWERUP_BLINK_COLOURS[this.blink_index]);
                }
            } else {
                this.powerups_on.delete(name);
                box.setFillStyle(POWERUP_BOX_COLOUR);
            }
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

    // One more icon at the right end of the row.
    add_life_icon() {
        const icon = this.add.image(
            Math.round(this.lives_x - this.lives_painted.left * LIVES_ICON_SCALE),
            Math.round(this.lives_y),
            LIVES_ICON
        ).setOrigin(0, 0.5).setScale(LIVES_ICON_SCALE);

        this.lives_icons.push(icon);
        this.lives_x += this.lives_step;
    }

    // A caught life adds an icon if there are more lives than icons.
    update_lives(lives) {
        while (this.lives_icons.length < lives) {
            this.add_life_icon();
        }

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
