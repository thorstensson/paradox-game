import { Scene } from "phaser";
import { entryFor } from "../hiscores";

// How long GAME OVER holds before cutting back to the intro.
const HOLD_MS = 3000;

// Drawn over the still-running level (MainScene launches it rather than
// starting it), so there is no black: no fade in, no fade out.
export class GameOverScene extends Scene {
    constructor() {
        super("GameOverScene");
    }

    // data.points: the game's score.
    create(data) {
        // Small font at 16, the same size as the intro's PLAYER ONE /
        // CLICK TO START.
        this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height / 2,
            "main-font",
            "GAME OVER",
            24
        ).setOrigin(0.5, 0.5);

        // Asked now, so the answer is in by the end of the hold.
        const entry = entryFor(data.points);

        // No restart prompt: hold, then cut straight to the name entry if the
        // score goes on the table, or to the intro. start() restarts
        // MainScene -- which launches either from its init() -- and shuts
        // this scene down.
        this.time.delayedCall(HOLD_MS, () => {
            entry.then((result) => this.scene.start("MainScene", { cut: true, entry: result }));
        });
    }
}
