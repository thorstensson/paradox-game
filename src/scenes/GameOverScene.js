import { Scene } from "phaser";

// How long GAME OVER holds before fading back to the intro, and the fade.
const HOLD_MS = 3000;
const FADE_MS = 1000;

export class GameOverScene extends Scene {
    end_points = 0;
    constructor() {
        super("GameOverScene");
    }

    init(data) {
        this.cameras.main.fadeIn(1000, 0, 0, 0);
        this.end_points = data.points || 0;
    }

    create() {
        // Same font and size as the score, as in Delta.
        this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height / 2,
            "main-font",
            "GAME OVER",
            32
        ).setOrigin(0.5, 0.5);

        this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height / 2 + 64,
            "main-font",
            `YOUR POINTS: ${this.end_points}`,
            32
        ).setOrigin(0.5, 0.5);

        // No restart prompt: hold, fade out, and drop back to the intro.
        // MainScene launches MenuScene from its init().
        this.time.delayedCall(HOLD_MS, () => {
            this.cameras.main.fadeOut(FADE_MS, 0, 0, 0);
        });

        this.cameras.main.once("camerafadeoutcomplete", () => {
            this.scene.start("MainScene");
        });
    }
}
