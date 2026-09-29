import { Scene } from "phaser";
import { CloverWave } from "../gameobjects/CloverWave";
import { Explosions } from "../gameobjects/Explosions";
import { NeutronDiveWave, NeutronWave } from "../gameobjects/NeutronWave";
import { Player } from "../gameobjects/Player";
import { StarField } from "../gameobjects/StarField";

// Time from start-game to the first wave, ms. The player's fly-in takes
// 1800 (1000 delay + 800 tween), so this leaves a beat after it settles.
const FIRST_WAVE_DELAY = 2500;

// Shown mid-screen before the level starts, as Delta does: fades in, holds,
// fades out, and only then does the ship fly in. ms.
const LEVEL_TITLE = "ENTERING SPACE";
const LEVEL_TITLE_FADE = 500;
const LEVEL_TITLE_HOLD = 1000;

// Ships per game. Losing the last one is GAME OVER.
const LIVES = 3;

// Pause between losing a ship and the next one flying in, ms. The waves
// carry on meanwhile, as in Delta.
const RESPAWN_DELAY = 1500;

// Pause between one wave being gone and the next arriving, ms.
const WAVE_GAP = 1000;

// Level 1 in order (notes.md -> Wave structure): A, then A from the bottom,
// then A from the top, then A again, then B along the bottom and top edges.
const WAVES = [
    (scene) => new NeutronWave(scene),
    (scene) => new NeutronDiveWave(scene, 1),
    (scene) => new NeutronDiveWave(scene, -1),
    (scene) => new NeutronWave(scene),
    (scene) => new CloverWave(scene)
];

export class MainScene extends Scene {
    star_field = null;
    player = null;
    wave = null;
    wave_index = 0;
    explosions = null;
    cursors = null;

    points = 0;
    lives = LIVES;

    // True from the start click to game over. Losing the mouse lock only
    // pauses the game while this is set.
    playing = false;

    constructor() {
        super("MainScene");
    }

    // data.cut is set by GameOverScene: coming back from GAME OVER is a hard
    // cut to the intro, as in Delta. Only the first load fades in.
    init(data) {
        if (!data.cut) {
            this.cameras.main.fadeIn(1000, 0, 0, 0);
        }
        this.scene.launch("MenuScene");

        // The scene instance is reused on restart, so the last run's wave has
        // to be dropped by hand.
        this.wave = null;
        this.wave_index = 0;
        this.playing = false;

        // Reset points and lives
        this.points = 0;
        this.lives = LIVES;
    }

    create() {
        // Scrolling parallax starfield
        this.star_field = new StarField(this);

        // Builds one animation per Aseprite frameTag: level, bank-up,
        // bank-down. Must run before the Player, which holds "level" from
        // its constructor.
        this.anims.createFromAseprite("ship");

        // One looping animation: spin.
        this.anims.createFromAseprite("neutron");
        this.anims.createFromAseprite("clover");

        // One animation each, played once per explosion: boom (ours) and
        // Animation (explosion-2, on trial). Explosions picks which one.
        this.anims.createFromAseprite("explosion");
        this.anims.createFromAseprite("explosion-2");
        this.explosions = new Explosions(this);

        // Player
        this.player = new Player({ scene: this });

        // Autofire is polled in update() rather than driven by key events, so
        // holding the button keeps shots coming on the cooldown.
        this.cursors = this.input.keyboard.createCursorKeys();

        // The ship is steered by a locked mouse, so losing the lock mid-game
        // -- Esc, or clicking away to another window -- pauses everything
        // until PauseScene gets it back. A lock the browser refused (the
        // first one at start, say) pauses the same way.
        const onLockChange = (_event, locked) => {
            if (!locked) {
                this.pauseGame();
            }
        };
        const onLockError = () => this.pauseGame();

        this.input.manager.events.on("pointerlockchange", onLockChange);
        document.addEventListener("pointerlockerror", onLockError);

        this.events.once("shutdown", () => {
            this.input.manager.events.off("pointerlockchange", onLockChange);
            document.removeEventListener("pointerlockerror", onLockError);
        });

        // This event comes from MenuScene
        this.game.events.on("start-game", () => {
            this.playing = true;
            this.scene.stop("MenuScene");
            this.scene.launch("HudScene", { lives: this.lives });

            this.showLevelTitle(() => {
                this.player.start();

                this.time.delayedCall(FIRST_WAVE_DELAY, () => {
                    this.wave = WAVES[0](this);
                });
            });
        });
    }

    // The level's name, alone over the stars; onDone runs once it has faded
    // out.
    showLevelTitle(onDone) {
        const title = this.add.bitmapText(
            this.scale.width / 2,
            this.scale.height / 2,
            "small-font",
            LEVEL_TITLE,
            16
        ).setOrigin(0.5, 0.5).setAlpha(0);

        this.tweens.add({
            targets: title,
            alpha: 1,
            duration: LEVEL_TITLE_FADE,
            hold: LEVEL_TITLE_HOLD,
            yoyo: true,
            onComplete: () => {
                title.destroy();
                onDone();
            }
        });
    }

    // The ship explodes; the neutron that hit it flies on. One life gone,
    // then either the next ship flies in or it is GAME OVER.
    shipHit() {
        this.explosions.spawn(this.player.x, this.player.y);
        this.player.leavePlay();

        this.lives--;
        this.scene.get("HudScene").update_lives(this.lives);

        if (this.lives > 0) {
            this.time.delayedCall(RESPAWN_DELAY, () => this.player.respawn());
        } else {
            this.gameOver();
        }
    }

    // Bullets still in flight after GAME OVER can still pop an alien; those
    // score nothing, and the HUD is gone by then anyway.
    addPoints(points) {
        if (!this.playing) {
            return;
        }

        this.points += points;
        this.scene.get("HudScene").update_points(this.points);
    }

    gameOver() {
        // Hand the mouse back. Cleared first, so the unlock this causes does
        // not pause the game on its way out.
        this.playing = false;
        this.input.mouse.releasePointerLock();

        // You need remove the event listener to avoid duplicate events.
        this.game.events.removeListener("start-game");
        // It is necessary to stop the scenes launched in parallel.
        this.scene.stop("HudScene");

        // Launched over this scene, not started in place of it: as in Delta,
        // the level carries on underneath GAME OVER, minus the ship.
        this.scene.launch("GameOverScene");
    }

    pauseGame() {
        if (!this.playing || this.scene.isPaused()) {
            return;
        }

        this.scene.pause();
        this.scene.launch("PauseScene");
    }

    update(time, delta) {
        this.star_field.update(time, delta);
        this.player.update(time, delta);

        if (this.wave) {
            this.wave.update(time, delta, this.player.bullets, this.explosions);

            if (this.wave.hits(this.player)) {
                this.shipHit();
            }

            // Dropped at once, so this fires only once per wave.
            if (this.wave.done) {
                this.wave = null;
                this.wave_index++;

                const next = WAVES[this.wave_index];

                if (next) {
                    this.time.delayedCall(WAVE_GAP, () => {
                        this.wave = next(this);
                    });
                }
            }
        }

        // The mouse steers the ship, so a click cannot also aim -- the ship is
        // already at the cursor. Bullets always travel right.
        if (this.input.activePointer.isDown || this.cursors.space.isDown) {
            this.player.fire(time);
        }

        this.player.bullets.update(time, delta);
    }
}