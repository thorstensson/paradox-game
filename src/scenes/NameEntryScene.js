import { Scene } from "phaser";
import { addScore } from "../hiscores";
import { SCORE_DIGITS } from "./HudScene";

// Name entry, after the game ends with a score that goes on the table
// (Thomas, 2026-11-16, after Delta): mouse only. A grid of A-Z, ".", "-",
// RUB and END; the box follows the mouse, a click adds the character, RUB
// takes the last one off, END saves. Names 1 to 8 characters (THALAMUS, in
// homage to Thalamus; Thomas, 2026-11-16). Below the grid:
// RANK, SCORE and NAME, the headings in the lilac hud-font, the player's in
// the white main-font. Then the intro.
//
// Over MainScene restarted without the level (data.entry), so only the stars
// show behind it. The mouse is free by now (MainScene.endPlay).
//
// Sizes and positions are placeholders to tune by eye.

const KEYS = [
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ.-".split(""),
    "RUB",
    "END"
];

const MAX_NAME = 8;

// Above the grid, in the lilac hud-font, each line centred, 9 px between
// lines as the level titles have (Thomas, 2026-11-16).
const MESSAGE = "WELL DONE PLAYER ONE!\nENTER YOUR NAME";
const MESSAGE_TOP = 72;
const LINE_SPACING = 9;

const COLUMNS = 10;
const CELL_WIDTH = 96;
const CELL_HEIGHT = 72;
const GRID_TOP = 180;

const TEXT_SIZE = 24;

// The box round the character under the mouse: 12 px clear of the
// character on every side, 3 px lines (one of the ship's pixels).
const BOX_PADDING = 12;
const BOX_LINE = 3;
const BOX_COLOUR = 0xb9bffb;

// RANK, SCORE and NAME: below the grid, each heading over its value, lined
// up on grid columns 0, 3 and 7.
const TABLE_GAP = 72;
const VALUE_GAP = 48;
const TABLE_COLUMNS = [ 0, 3, 7 ];

function ordinal(rank) {
    if (rank === 1) {
        return "1ST";
    }

    if (rank === 2) {
        return "2ND";
    }

    if (rank === 3) {
        return "3RD";
    }

    return `${rank}TH`;
}

export class NameEntryScene extends Scene {
    constructor() {
        super("NameEntryScene");
    }

    // data: { points, rank } (hiscores.entryFor).
    create(data) {
        this.points = data.points;
        this.name = "";
        this.saving = false;

        const left = Math.round((this.scale.width - COLUMNS * CELL_WIDTH) / 2);
        const rows = Math.ceil(KEYS.length / COLUMNS);

        this.grid = { left, top: GRID_TOP, rows };

        this.add.bitmapText(this.scale.width / 2, MESSAGE_TOP, "hud-font", MESSAGE, TEXT_SIZE)
            .setOrigin(0.5, 0)
            .setCenterAlign()
            .setLineSpacing(LINE_SPACING);

        // Each key centred in its cell.
        this.keys = KEYS.map((label, i) => {
            const x = left + (i % COLUMNS) * CELL_WIDTH + CELL_WIDTH / 2;
            const y = GRID_TOP + Math.floor(i / COLUMNS) * CELL_HEIGHT + CELL_HEIGHT / 2;

            return this.add.bitmapText(x, y, "main-font", label, TEXT_SIZE).setOrigin(0.5, 0.5);
        });

        this.box = this.add.graphics().setVisible(false);

        const table_top = GRID_TOP + rows * CELL_HEIGHT + TABLE_GAP;
        const values = [
            ordinal(data.rank),
            String(data.points).padStart(SCORE_DIGITS, "0"),
            ""
        ];

        [ "RANK", "SCORE", "NAME" ].forEach((heading, i) => {
            const x = left + TABLE_COLUMNS[i] * CELL_WIDTH;

            this.add.bitmapText(x, table_top, "hud-font", heading, TEXT_SIZE);

            const value = this.add.bitmapText(x, table_top + VALUE_GAP, "main-font", values[i], TEXT_SIZE);

            if (i === 2) {
                this.name_text = value;
            }
        });

        this.input.on("pointermove", (pointer) => this.hover(pointer));
        this.input.on("pointerdown", (pointer) => this.press(pointer));

        this.hover(this.input.activePointer);
    }

    // The key under the mouse, by its cell; -1 if none.
    keyAt(pointer) {
        const { left, top, rows } = this.grid;
        const column = Math.floor((pointer.x - left) / CELL_WIDTH);
        const row = Math.floor((pointer.y - top) / CELL_HEIGHT);

        if (column < 0 || column >= COLUMNS || row < 0 || row >= rows) {
            return -1;
        }

        const index = row * COLUMNS + column;

        return index < KEYS.length ? index : -1;
    }

    hover(pointer) {
        const index = this.keyAt(pointer);

        if (index < 0 || this.saving) {
            this.box.setVisible(false);
            return;
        }

        const key = this.keys[index];
        const width = Math.round(key.width + BOX_PADDING * 2);
        const height = Math.round(key.height + BOX_PADDING * 2);

        this.box.clear()
            .lineStyle(BOX_LINE, BOX_COLOUR)
            .strokeRect(
                Math.round(key.x - width / 2),
                Math.round(key.y - height / 2),
                width,
                height
            )
            .setVisible(true);
    }

    press(pointer) {
        const index = this.keyAt(pointer);

        if (index < 0 || this.saving) {
            return;
        }

        const label = KEYS[index];

        if (label === "RUB") {
            this.name = this.name.slice(0, -1);
        } else if (label === "END") {
            if (this.name.length > 0) {
                this.save();
            }
            return;
        } else if (this.name.length < MAX_NAME) {
            this.name += label;
        }

        this.name_text.setText(this.name);
    }

    // Saved, or given up on if Supabase can't be reached; the intro either
    // way.
    save() {
        this.saving = true;
        this.box.setVisible(false);

        addScore(this.name, this.points).then(() => {
            this.scene.launch("MenuScene");
            this.scene.stop();
        });
    }
}
