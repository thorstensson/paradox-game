import { Scene } from "phaser";
import { COLOUR_SHINE } from "../fx/ColourShine";
import { fetchTopScores, TOP } from "../hiscores";
import { SCORE_DIGITS } from "./HudScene";

// The intro and TOP SCORES take turns, as in Delta (Thomas, 2026-11-16): each
// holds HOLD_MS, then fades out over FADE_MS and the other fades in over
// FADE_MS. A click starts the game from either. Without the table (no
// scores yet, or Supabase can't be reached) the intro stays up.
const HOLD_MS = 8000;

// A placeholder to tune by eye.
const FADE_MS = 500;

// TOP SCORES: the title in the lilac hud-font, the rows below it in the white
// main-font, all 10 on one screen, written as Delta has them: rank, a dot,
// the score, the name ("1.000000 STAVROS"). The ranks are right-aligned, so
// 10 lines up with the rest. Every row is left-aligned on the widest a row
// can be (10.000000 and an 8-letter name, 18 characters), centred across.
// The block is centred down the screen: title, ROWS_BELOW_TITLE px, the rows
// ROW_STEP px apart.
const TABLE_SIZE = 24;
const CHAR_WIDTH = 24;
const ROW_CHARS = 2 + 1 + SCORE_DIGITS + 1 + 8;
const ROWS_BELOW_TITLE = 96;
const ROW_STEP = 48;

export class MenuScene extends Scene {
    constructor() {
        super("MenuScene");
    }

    init() {
        this.cameras.main.fadeIn(1000, 0, 0, 0);
    }

    create() {
        // Logo. Images are centre-origin already, so no setOrigin needed.
        // 123x13 at 8x is 984px wide: 148px either side.
        const logo_game = this.add.image(
            this.scale.width / 2,
            this.scale.height / 2,
            "title-logo"
        ).setScale(8);

        // Knocked slightly off pure white so the shine has headroom to
        // brighten into -- a white highlight over white is invisible.
        logo_game.setTint(0xe4e8f0);
        // Phaser's shine, but sweeping in #b9bffb (see ColourShine.js).
        logo_game.setPostPipeline(COLOUR_SHINE);

        const start_msg = this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height / 2 + 120,
            "main-font",
            "PLAYER ONE\nCLICK TO START",
            24
        ).setOrigin(0.5, 0.5);

        // setOrigin centres the block; this centres the lines within it.
        start_msg.setCenterAlign();

        // The font's own line gap is one brick (2px); 6px more makes it
        // four bricks, so the two lines don't touch.
        start_msg.setLineSpacing(9);

        // The year in Roman numerals above the logo, as Delta has it. Same
        // gap above the logo as PLAYER ONE sits below it, measured from the
        // drawn text rather than set by hand.
        const logo_bounds = logo_game.getBounds();
        const gap = start_msg.getBounds().top - logo_bounds.bottom;

        const year = this.add.bitmapText(
            this.scale.width / 2,
            logo_bounds.top - gap,
            "main-font",
            "MMXXVI",
            24
        ).setOrigin(0.5, 1);

        // Byline, centred along the bottom of the screen, in the HI score's
        // lilac (hud-font; Thomas, 2026-11-09).
        const byline = this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height - 40,
            "hud-font",
            "BY THOMAS THORSTENSSON",
            24
        ).setOrigin(0.5, 1);

        // Blinks the text by showing and hiding it, so its alpha is free for
        // the intro's fade.
        const blink = { on: 1 };

        this.tweens.add({
            targets: blink,
            on: 0,
            duration: 800,
            ease: (value) => Math.abs(Math.round(value)),
            yoyo: true,
            repeat: -1,
            onUpdate: () => start_msg.setVisible(blink.on > 0.5)
        });

        this.intro_parts = [ logo_game, start_msg, year, byline ];
        this.table_parts = this.makeTable();

        // Send start-game event when user clicks. The same click locks the
        // mouse to the game -- browsers only allow that in answer to a click.
        this.input.on("pointerdown", () => {
            this.input.mouse.requestPointerLock();
            this.game.events.emit("start-game");
        });

        // A fetch can come back after the scene has stopped; it is dropped.
        this.running = true;
        this.events.once("shutdown", () => {
            this.running = false;
        });

        this.scores = null;
        this.holdIntro();
    }

    // TOP SCORES and 10 empty rows, hidden until the table's turn.
    makeTable() {
        const width = this.scale.width;
        const height = TABLE_SIZE + ROWS_BELOW_TITLE + (TOP - 1) * ROW_STEP + TABLE_SIZE;
        const top = Math.round((this.scale.height - height) / 2);
        const left = Math.round((width - ROW_CHARS * CHAR_WIDTH) / 2);

        const title = this.add.bitmapText(width / 2, top, "hud-font", "TOP SCORES", TABLE_SIZE)
            .setOrigin(0.5, 0)
            .setAlpha(0);

        this.rows = [];

        for (let i = 0; i < TOP; i++) {
            const row = this.add.bitmapText(
                left, top + TABLE_SIZE + ROWS_BELOW_TITLE + i * ROW_STEP, "main-font", "", TABLE_SIZE
            ).setAlpha(0);

            this.rows.push(row);
        }

        return [ title, ...this.rows ];
    }

    // The intro's turn: fetch the table meanwhile, then hand over to it.
    holdIntro() {
        fetchTopScores().then((scores) => {
            if (this.running) {
                this.scores = scores;
            }
        });

        this.time.delayedCall(HOLD_MS, () => {
            if (!this.scores?.length) {
                this.holdIntro();
                return;
            }

            this.fillTable(this.scores);
            this.swap(this.intro_parts, this.table_parts, () => {
                this.time.delayedCall(HOLD_MS, () => {
                    this.swap(this.table_parts, this.intro_parts, () => this.holdIntro());
                });
            });
        });
    }

    fillTable(scores) {
        this.rows.forEach((row, i) => {
            const entry = scores[i];

            row.setText(entry
                ? `${String(i + 1).padStart(2, " ")}.${String(entry.score).padStart(SCORE_DIGITS, "0")} ${entry.name}`
                : "");
        });
    }

    // Fades one screen out, then the other in.
    swap(out, into, onDone) {
        this.tweens.add({
            targets: out,
            alpha: 0,
            duration: FADE_MS,
            onComplete: () => {
                this.tweens.add({
                    targets: into,
                    alpha: 1,
                    duration: FADE_MS,
                    onComplete: onDone
                });
            }
        });
    }
}
