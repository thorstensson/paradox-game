import { Scene } from "phaser";

// Delta layout, all on one line: six-digit score, lives count, ship icon.
const SCORE_DIGITS = 6;

// Lives are display-only until Level 1 is built; 3 is the default then too.
const DEFAULT_LIVES = 3;

// The icon is the ship's "level" frame at 2x: a ~56x40 hull. 1x matched the
// digits' height on paper but read too small beside them.
const LIVES_ICON_SCALE = 2;
const LIVES_ICON_FRAME = "0";

// Score and lives count share the logo's off-white (MenuScene's tint), so the
// player info reads as one group with the title. The icon keeps its colours.
const SCORE_TINT = 0xc8d0e0;

// The HUD scene is the scene that shows the points and the remaining time.
export class HudScene extends Scene {

    remaining_time = 0;

    remaining_time_text;
    points_text;
    lives_text;
    lives_icon;

    constructor() {
        super("HudScene");
    }

    init(data) {
        this.cameras.main.fadeIn(1000, 0, 0, 0);
        this.remaining_time = data.remaining_time;
    }

    create() {
        this.points_text = this.add.bitmapText(10, 10, "main-font", this.format_points(0), 32)
            .setTint(SCORE_TINT);

        // One character's width between items: the advance of a digit.
        const digit = this.cache.bitmapFont.get("main-font").data.chars[48];
        const gap = digit.xAdvance;

        // Measured once at "000000" so the lives never shift as the score
        // changes, even if some digits are narrower than others.
        this.lives_text = this.add.bitmapText(
            this.points_text.x + this.points_text.width + gap, 10,
            "main-font", String(DEFAULT_LIVES), 32
        ).setTint(SCORE_TINT);

        // Centred on the digits' cap height, not on the text box, whose top
        // includes the line's empty space above the capitals.
        const cap_centre = this.points_text.y + digit.yOffset + digit.height / 2;

        this.lives_icon = this.add.image(
            this.lives_text.x + this.lives_text.width + gap,
            Math.round(cap_centre),
            "ship", LIVES_ICON_FRAME
        ).setOrigin(0, 0.5).setScale(LIVES_ICON_SCALE);

        // The main font is uppercase only, so the seconds suffix is "S".
        this.remaining_time_text = this.add.bitmapText(this.scale.width - 10, 10, "main-font", `REMAINING:${this.remaining_time}S`, 32)
            .setOrigin(1, 0);
    }

    update_points(points) {
        this.points_text.setText(this.format_points(points));
    }

    format_points(points) {
        return points.toString().padStart(SCORE_DIGITS, "0");
    }

    update_timeout(timeout) {
        this.remaining_time_text.setText(`REMAINING:${timeout.toString().padStart(2, "0")}S`);
    }
}