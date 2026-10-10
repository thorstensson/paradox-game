import { GameObjects, Scene } from "phaser";
import { CloverWave } from "../gameobjects/CloverWave";
import { DeltaWave } from "../gameobjects/DeltaWave";
import { DragonWave } from "../gameobjects/DragonWave";
import { EmberRingWave } from "../gameobjects/EmberRingWave";
import { EnemyBullets } from "../gameobjects/EnemyBullets";
import { EmberstarWave } from "../gameobjects/EmberstarWave";
import { Explosions } from "../gameobjects/Explosions";
import { FireCave } from "../gameobjects/FireCave";
import { FirecometTrack } from "../gameobjects/FirecometTrack";
import { FireringWave } from "../gameobjects/FireringWave";
import { GreywingWave } from "../gameobjects/GreywingWave";
import { NeutronDiveWave, NeutronWave } from "../gameobjects/NeutronWave";
import { Player } from "../gameobjects/Player";
import { PowerUps } from "../gameobjects/PowerUps";
import { StarField } from "../gameobjects/StarField";

// Black band along the top of the canvas, as in Delta: the HUD sits in it,
// clear of the playfield (and the fire cave's flames). The playfield is the
// rest of the canvas below it, 1280x760; everything in the game measures
// from the playfield camera, not the canvas.
const HUD_BAND = 40;

// Time from start-game to the first wave, ms. The player's fly-in takes
// 1800 (1000 delay + 800 tween), so this leaves a beat after it settles.
const FIRST_WAVE_DELAY = 2500;

// Shown mid-screen before the level starts, as Delta does: fades in, holds,
// fades out, and only then does the ship fly in. ms.
const LEVEL_TITLE = "INTO THE BREACH\nPLAYER ONE";
const LEVEL_TITLE_FADE = 500;
const LEVEL_TITLE_HOLD = 2000;

// Level 2 follows level 1 without a break: the ship flies on, the title comes
// up over the stars, then the fire cave slides in over them.
const LEVEL_2_TITLE = "ENTERING\nEMBER CAVES";

// From the last level 1 wave being gone to the level 2 title, ms.
const LEVEL_2_DELAY = 3000;

// Ships per game. Losing the last one is GAME OVER.
const LIVES = 3;

// Pause between losing a ship and the next one flying in, ms. The waves
// carry on meanwhile, as in Delta.
const RESPAWN_DELAY = 1500;

// Pause between one wave being gone and the next arriving, ms.
const WAVE_GAP = 1000;

// Gives one wave its own pause before it, ms, in place of WAVE_GAP.
const withGap = (gap, make) => Object.assign(make, { gap });

// Level 1 in order (notes.md -> Wave structure): A, then A from the bottom,
// then A from the top, then A again, then B along the bottom and top edges,
// then C as a turning circle, then A from the bottom again with its last
// neutron odd-coloured, and last D, a staggered wall of greywings, twice,
// the second with its stagger flipped and only half a second behind.
const WAVES = [
    (scene) => new NeutronWave(scene),
    (scene) => new NeutronDiveWave(scene, 1),
    (scene) => new NeutronDiveWave(scene, -1),
    (scene) => new NeutronWave(scene),
    (scene) => new CloverWave(scene),
    (scene) => new FireringWave(scene),
    (scene) => new NeutronDiveWave(scene, 1, 4),
    (scene) => new GreywingWave(scene),
    withGap(500, (scene) => new GreywingWave(scene, true))
];

// Level 2 in order (notes.md -> Level 2 Concepts -> Wave sequence), after
// the firecomets (A1), which run alongside the whole level: A2, two blocks
// of emberstars swinging between the flames and the centre line, then B1,
// the dragon zigzagging flame to flame.
const LEVEL_2_WAVES = [
    (scene) => new EmberstarWave(scene),
    (scene) => new DragonWave(scene),
    (scene) => new DeltaWave(scene),
    // Level 1's neutrons, mirrored: in from the centre, spreading out.
    (scene) => new NeutronWave(scene, [-1, 1], null, true),
    (scene) => new NeutronDiveWave(scene, 1, null, true),
    // The top chain drops the shield power-up when shot in full.
    (scene) => new NeutronDiveWave(scene, -1, null, true, "shield"),
    (scene) => new EmberRingWave(scene)
];

// Removes everything a called-off wave has on screen, whatever kind of wave
// it is: every sprite it holds, alone or in a list, and its bullets. Plain
// data (a dragon's trail, hit boxes) is left alone.
function clearWave(wave) {
    for (const [ name, value ] of Object.entries(wave)) {
        if (value instanceof GameObjects.GameObject) {
            value.destroy();
            wave[name] = null;
        } else if (Array.isArray(value)) {
            const kept = value.filter((item) => !(item instanceof GameObjects.GameObject));

            if (kept.length !== value.length) {
                value.forEach((item) => item instanceof GameObjects.GameObject && item.destroy());
                value.length = 0;
                value.push(...kept);
            }
        } else if (value instanceof EnemyBullets) {
            clearWave(value);
        }
    }
}

export class MainScene extends Scene {
    star_field = null;
    player = null;
    wave = null;
    wave_index = 0;
    explosions = null;

    // Power drops in flight. They outlive the wave that dropped them.
    powerups = null;
    fire_cave = null;

    // Level 2's firecomets: out of the fire walls for the whole cave,
    // alongside its waves.
    firecomets = null;
    cursors = null;

    // The level being played. Wave timers check it, so a level that is
    // skipped stops sending waves.
    level = 1;

    // Waves called off: by a lost ship (to be replayed) or, dev only, by the
    // skip key. Their aliens and bullets are cleared every frame, since a
    // chain can still have aliens due to spawn.
    cleared = [];

    // A wave is on its way (its gap is running) but not yet on screen.
    wave_pending = false;

    // Goes up with every ship lost. A wave timer set before a loss sees it
    // has changed and sends nothing; the wave is replayed instead.
    attempt = 0;

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
        this.level = 1;
        this.fire_cave = null;
        this.firecomets = null;
        this.cleared = [];
        this.wave_pending = false;
        this.attempt = 0;
        this.playing = false;

        // Reset points and lives
        this.points = 0;
        this.lives = LIVES;
    }

    create() {
        // First, so everything below is placed inside the playfield.
        this.cameras.main.setViewport(
            0, HUD_BAND, this.scale.width, this.scale.height - HUD_BAND
        );

        // Scrolling parallax starfield
        this.star_field = new StarField(this);

        // Builds one animation per Aseprite frameTag: level, bank-up,
        // bank-down. Must run before the Player, which holds "level" from
        // its constructor.
        this.anims.createFromAseprite("ship");

        // One looping animation: spin.
        this.anims.createFromAseprite("neutron");
        this.anims.createFromAseprite("clover");
        this.anims.createFromAseprite("firering");
        this.anims.createFromAseprite("greywing");
        this.anims.createFromAseprite("neutron-odd");
        this.anims.createFromAseprite("firecomet");
        this.anims.createFromAseprite("dragon");
        this.anims.createFromAseprite("delta");
        this.anims.createFromAseprite("bullet-enemy");
        this.anims.createFromAseprite("powerup-bullets");
        this.anims.createFromAseprite("powerup-shield");
        this.anims.createFromAseprite("shield");

        // One animation, Animation, played once per explosion.
        this.anims.createFromAseprite("explosion");
        this.explosions = new Explosions(this);

        // A drop is added after the explosion pool, so it shows over the
        // blast it comes out of.
        this.powerups = new PowerUps(this);

        // Player
        this.player = new Player({ scene: this });

        // Autofire is polled in update() rather than driven by key events, so
        // holding the button keeps shots coming on the cooldown.
        this.cursors = this.input.keyboard.createCursorKeys();

        // Dev server only, never in the released game: N skips the rest of
        // the level, so the next one can be tested without playing up to it.
        if (import.meta.env.DEV) {
            this.input.keyboard.on("keydown-N", () => this.skipLevel());
        }

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

            this.showLevelTitle(LEVEL_TITLE, () => {
                this.player.start();

                this.startWave(FIRST_WAVE_DELAY);
            });
        });
    }

    // The level's name, alone over the stars; onDone runs once it has faded
    // out.
    showLevelTitle(text, onDone) {
        const title = this.add.bitmapText(
            // Mid-canvas, where it was before the band, level with PAUSED
            // and GAME OVER.
            this.scale.width / 2,
            this.scale.height / 2 - HUD_BAND,
            "main-font",
            text,
            27
        ).setOrigin(0.5, 0.5).setAlpha(0);

        title.setCenterAlign();
        title.setLineSpacing(9);

        // PAUSED sits in the same spot, so the title steps aside while it is
        // up and comes back to finish its fade once play resumes.
        const hide = () => title.setVisible(false);
        const show = () => title.setVisible(true);

        this.events.on("pause", hide);
        this.events.on("resume", show);

        this.tweens.add({
            targets: title,
            alpha: 1,
            duration: LEVEL_TITLE_FADE,
            hold: LEVEL_TITLE_HOLD,
            yoyo: true,
            onComplete: () => {
                this.events.off("pause", hide);
                this.events.off("resume", show);
                title.destroy();
                onDone();
            }
        });
    }

    // The wave on screen is over: the next one follows after its gap, or,
    // after the last, level 2.
    nextWave() {
        this.wave = null;
        this.wave_index++;

        const next = this.levelWaves()[this.wave_index];

        if (next) {
            this.startWave(next.gap ?? WAVE_GAP);
        } else if (this.level === 1) {
            this.level = 2;
            this.time.delayedCall(LEVEL_2_DELAY, () => this.enterLevel2());
        }

        // After level 2's last wave nothing follows yet.
    }

    levelWaves() {
        return this.level === 1 ? WAVES : LEVEL_2_WAVES;
    }

    // Sends the level's wave at wave_index after delay, ms -- unless the
    // level has changed or a ship has been lost by then.
    startWave(delay) {
        const level = this.level;
        const attempt = this.attempt;

        this.wave_pending = true;

        this.time.delayedCall(delay, () => {
            if (this.level === level && this.attempt === attempt && this.playing) {
                this.wave_pending = false;
                this.wave = this.levelWaves()[this.wave_index](this);
            }
        });
    }

    // Dev only (the N key): clears the wave on screen, no points, drops the
    // rest of level 1 and goes straight into level 2. Not before the ship is
    // in, and only once.
    skipLevel() {
        if (!this.playing || this.level !== 1 || this.player.state === "waiting") {
            return;
        }

        this.level = 2;
        this.wave_pending = false;

        if (this.wave) {
            this.cleared.push(this.wave);
            this.wave = null;
        }

        this.enterLevel2();
    }

    // Level 1 is cleared; the ship flies straight on into level 2. Skipped if
    // the last ship was lost in the meantime.
    enterLevel2() {
        if (!this.playing) {
            return;
        }

        this.showLevelTitle(LEVEL_2_TITLE, () => {
            // The comets start once the cave fills the screen, and the
            // level's first wave a WAVE_GAP after them.
            this.fire_cave = new FireCave(this, () => {
                this.firecomets = new FirecometTrack(this);

                this.wave_index = 0;
                this.startWave(WAVE_GAP);
            });
        });
    }

    // The ship explodes. One life gone, then either the next ship flies in or
    // it is GAME OVER.
    //
    // As in Delta, a lost ship calls off the wave on screen (or on its way):
    // its aliens and bullets vanish, no points, and once the next ship is in
    // the same wave starts again from the beginning. At GAME OVER the wave
    // flies on under the text.
    shipHit() {
        this.explosions.spawn(this.player.x, this.player.y);
        this.player.leavePlay();

        this.lives--;
        this.scene.get("HudScene").update_lives(this.lives);

        if (this.lives > 0) {
            const replay = this.wave !== null || this.wave_pending;

            this.attempt++;
            this.wave_pending = false;

            if (this.wave) {
                this.cleared.push(this.wave);
                this.wave = null;
            }

            this.time.delayedCall(RESPAWN_DELAY, () => this.player.respawn(() => {
                if (replay) {
                    this.startWave(WAVE_GAP);
                }
            }));
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

            // Dropped at once, so this fires only once per wave. A hit may
            // already have called the wave off.
            if (this.wave && this.wave.done) {
                this.nextWave();
            }
        }

        this.cleared.forEach(clearWave);

        if (this.fire_cave) {
            this.fire_cave.update(time, delta);

            if (this.fire_cave.hits(this.player)) {
                this.shipHit();
            }
        }

        if (this.firecomets) {
            this.firecomets.update(time, delta, this.player.bullets, this.explosions);

            if (this.firecomets.hits(this.player)) {
                this.shipHit();
            }
        }

        // The mouse steers the ship, so a click cannot also aim -- the ship is
        // already at the cursor. Bullets always travel right.
        if (this.input.activePointer.isDown || this.cursors.space.isDown) {
            this.player.fire(time);
        }

        this.player.bullets.update(time, delta);
        this.powerups.update(delta, this.player);
    }
}