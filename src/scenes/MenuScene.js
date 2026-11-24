import { Scene } from "phaser";
import { COLOUR_SHINE } from "../fx/ColourShine";
import { fetchTopScores, TOP } from "../hiscores";
import { SCORE_DIGITS } from "./HudScene";
import { playMusic } from "../sounds";

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

// The play helper (src/assets/ui/playhelper): 146x52 at the ship's 3x, one
// loop tag, ui-loop. The drawing doesn't fill its canvas: across all 26
// frames it covers x 15-75 and y 11-36. So the drawing, not the canvas, is
// centred: across the screen, and down the middle of the gap between CLICK
// TO START and the byline.
const HELPER_SCALE = 3;
const HELPER_DRAWN = { x: 15, y: 11, w: 61, h: 26 };

// main-font's lines are 24px tall but its letters 21 (katakis-24.fnt): the
// 3px under the last line is empty.
const LETTER_DROP = 3;

// The PARADOX logo sits 5% of the screen's 800px above the middle (Thomas,
// 2026-11-24); MMXXVI moves up with it.
const LOGO_RAISE = 40;

export class MenuScene extends Scene {
    constructor() {
        super("MenuScene");
    }

    init() {
        this.cameras.main.fadeIn(1000, 0, 0, 0);
    }

    create() {
        // Logo. Images are centre-origin already, so no setOrigin needed.
        // 123x13 at 8x is 984px wide: 148px either side. Raised LOGO_RAISE
        // above the middle of the screen.
        const logo_game = this.add.image(
            this.scale.width / 2,
            this.scale.height / 2 - LOGO_RAISE,
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
        // drawn text rather than set by hand. The gap is taken as it was
        // before the raise, so the year moves up with the logo by LOGO_RAISE.
        const logo_bounds = logo_game.getBounds();
        const gap = start_msg.getBounds().top - logo_bounds.bottom - LOGO_RAISE;

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

        // Play helper, placed by its top-left corner on whole pixels.
        const text_bottom = start_msg.getBounds().bottom - LETTER_DROP;
        const byline_top = byline.getBounds().top;

        const helper_x = Math.round(
            this.scale.width / 2 - (HELPER_DRAWN.x + HELPER_DRAWN.w / 2) * HELPER_SCALE
        );
        const helper_y = Math.round(
            (text_bottom + byline_top) / 2 - (HELPER_DRAWN.y + HELPER_DRAWN.h / 2) * HELPER_SCALE
        );

        this.anims.createFromAseprite("playhelper");

        const helper = this.add.sprite(helper_x, helper_y, "playhelper", "0")
            .setOrigin(0, 0)
            .setScale(HELPER_SCALE)
            .play({ key: "ui-loop", repeat: -1 });

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

        this.intro_parts = [ logo_game, start_msg, year, byline, helper ];
        this.table_parts = this.makeTable();

        // Send start-game event when user clicks. The same click locks the
        // mouse to the game -- browsers only allow that in answer to a click.
        this.input.on("pointerdown", () => {
            this.input.mouse.requestPointerLock();
            this.game.events.emit("start-game");
        });

        // The intro's music, on loop until the intro closes (sounds.js).
        // Off until Thomas replaces the track (2026-11-23).
        // const music = playMusic(this);

        // A fetch can come back after the scene has stopped; it is dropped.
        this.running = true;
        this.events.once("shutdown", () => {
            this.running = false;
            // music.destroy(); // intro music off (see above)
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
