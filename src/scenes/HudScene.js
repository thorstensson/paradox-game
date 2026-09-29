import { Scene } from "phaser";

// Delta layout, all on one line: six-digit score, lives count, ship icon.
const SCORE_DIGITS = 6;

// The icon is the ship's "level" frame at 1.2x: a ~28x20 hull, sized to sit
// beside the Gradius digits (21px capitals at 24).
const LIVES_ICON_SCALE = 1.2;
const LIVES_ICON_FRAME = "0";

// No tint on the score or lives: the font's colour and inner bevel are
// painted into the font image itself, and a tint would multiply over them.

// Gradius at 24 is 1:1 with the size it was exported at.
const HUD_FONT_SIZE = 24;

// The HUD scene is the scene that shows the points and lives.
export class HudScene extends Scene {

    points_text;
    lives_text;
    lives_icon;

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
        this.points_text = this.add.bitmapText(10, 10, "main-font", this.format_points(0), HUD_FONT_SIZE);

        // The font's measurements are in its own native pixels, so they are
        // scaled up by the same factor the text is drawn at.
        const font = this.cache.bitmapFont.get("main-font").data;
        const font_scale = HUD_FONT_SIZE / font.size;

        // One character's width between items: the advance of a digit.
        const digit = font.chars[48];
        const gap = digit.xAdvance * font_scale;

        // Measured once at "000000" so the lives never shift as the score
        // changes, even if some digits are narrower than others.
        this.lives_text = this.add.bitmapText(
            this.points_text.x + this.points_text.width + gap, 10,
            "main-font", String(this.lives), HUD_FONT_SIZE
        );

        // Centred on the digits' cap height, not on the text box, whose top
        // includes the line's empty space above the capitals.
        const cap_centre = this.points_text.y + (digit.yOffset + digit.height / 2) * font_scale;

        this.lives_icon = this.add.image(
            this.lives_text.x + this.lives_text.width + gap,
            Math.round(cap_centre),
            "ship", LIVES_ICON_FRAME
        ).setOrigin(0, 0.5).setScale(LIVES_ICON_SCALE);
    }

    update_points(points) {
        this.points_text.setText(this.format_points(points));
    }

    update_lives(lives) {
        this.lives_text.setText(String(lives));
    }

    format_points(points) {
        return points.toString().padStart(SCORE_DIGITS, "0");
    }
}