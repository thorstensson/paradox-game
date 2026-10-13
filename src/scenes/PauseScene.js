import { Scene } from "phaser";

// Shown over the paused MainScene whenever the mouse is released mid-game --
// Esc, or clicking away to another window. Without the lock the ship cannot
// be steered, so the game waits here until a click locks the mouse again.
export class PauseScene extends Scene {

    constructor() {
        super("PauseScene");
    }

    create() {
        const msg = this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height / 2,
            "halftone-font",
            "PAUSED\nCLICK TO CONTINUE",
            24
        ).setOrigin(0.5, 0.5);

        // setOrigin centres the block; this centres the lines within it.
        msg.setCenterAlign();

        // Same as the intro: 6px on top of the font's one-brick line gap.
        msg.setLineSpacing(9);

        // Chrome refuses a new lock for about a second after Esc. If the
        // click comes too soon nothing happens, and the next click works.
        this.input.on("pointerdown", () => {
            this.input.mouse.requestPointerLock();
        });

        // Resume only once the lock has actually taken, never on the click
        // itself, so the game cannot restart with a mouse it cannot read.
        const onLockChange = (_event, locked) => {
            if (locked) {
                this.scene.resume("MainScene");
                this.scene.stop();
            }
        };

        this.input.manager.events.on("pointerlockchange", onLockChange);

        this.events.once("shutdown", () => {
            this.input.manager.events.off("pointerlockchange", onLockChange);
        });
    }
}
