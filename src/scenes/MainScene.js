import { GameObjects, Scene } from "phaser";
import { AsteroidBelt, bakeAsteroidTurns } from "../gameobjects/AsteroidBelt";
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
import { Outro } from "../gameobjects/Outro";
import { Player } from "../gameobjects/Player";
import { PowerUps } from "../gameobjects/PowerUps";
import { Missiles, LevelTargets } from "../gameobjects/Missiles";
import { StarField } from "../gameobjects/StarField";
import { Station } from "../gameobjects/Station";
import { playSound } from "../sounds";
import { BOTTOM_BAND } from "./HudScene";

// Black band along the top of the canvas, as in Delta: the HUD sits in it,
// clear of the playfield (and the fire cave's flames). The playfield is the
// rest of the canvas between it and the power-up band along the bottom
// (BOTTOM_BAND, HudScene), 1280x720; everything in the game measures from the
// playfield camera, not the canvas.
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

// Level 3 follows level 2 the same way: once the ember ring is gone, the fire
// cave slides out to the left, the ship flies on into open space, and after
// LEVEL_3_DELAY ms of it the title comes up, then the asteroid belt.
const LEVEL_3_TITLE = "ENTERING\nBELT OF OSIRIS";
const LEVEL_3_DELAY = 1500;

// Pause between the level 3 title fading out and the belt coming in, ms.
const LEVEL_3_BELT_DELAY = 500;

// Level 4 follows level 3 the same way: once the belt's last rock is gone,
// the ship flies on into open space, and after LEVEL_4_DELAY ms of it the
// title comes up, then the station.
const LEVEL_4_TITLE = "ENTERING\nSTATION X";
const LEVEL_4_DELAY = 3000;

// Ships per game. Losing the last one is GAME OVER.
const LIVES = 3;

// One extra ship, once per game, as the score reaches this (Thomas,
// 2026-11-11: mid comet swarm on a good run, a fair place for an average
// player). Score based, not a power-up.
const EXTRA_LIFE_AT = 25000;

// Pause between losing a ship and the next one flying in, ms. The waves
// carry on meanwhile, as in Delta.
const RESPAWN_DELAY = 1500;

// Station X, after a lost ship: the playfield fades to black, the station
// goes back to the last marker passed (Station.restart), and fades in again,
// ms each way. Inside RESPAWN_DELAY, so the next ship flies in after it.
// A placeholder to tune by playing.
const STATION_RESTART_FADE = 500;

// Pause between one wave being gone and the next arriving, ms.
const WAVE_GAP = 1000;

// Gives one wave its own pause before it, ms, in place of WAVE_GAP.
const withGap = (gap, make) => Object.assign(make, { gap });

// Level 1 in order (NOTES.md -> Wave structure): A, then A from the bottom,
// then A from the top, then A again, then B along the bottom and top edges,
// then C as a turning circle, then A from the bottom again with its last
// neutron odd-coloured, and last D, a staggered wall of greywings, twice,
// the second with its stagger flipped and only half a second behind.
const WAVES = [
    (scene) => new NeutronWave(scene),
    (scene) => new NeutronDiveWave(scene, 1),
    // Its 3rd neutron drops the speed power-up (Thomas, 2026-11-15).
    (scene) => new NeutronDiveWave(scene, -1, null, false, "speed", 3),
    (scene) => new NeutronWave(scene),
    (scene) => new CloverWave(scene),
    (scene) => new FireringWave(scene),
    (scene) => new NeutronDiveWave(scene, 1, 7),
    (scene) => new GreywingWave(scene),
    withGap(500, (scene) => new GreywingWave(scene, true))
];

// Level 2 in order (NOTES.md -> Level 2 Concepts -> Wave sequence), after
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
    // Its 6th neutron drops the shield power-up (Thomas, 2026-11-15). Its
    // last neutron is the odd-coloured one, as in level 1's wave 7.
    (scene) => new NeutronDiveWave(scene, -1, 7, true, "shield", 6),
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

    // The ship's seeking missiles in flight, from the missile power-up.
    missiles = null;
    fire_cave = null;

    // Level 2's firecomets: out of the fire walls for the whole cave,
    // alongside its waves.
    firecomets = null;

    // Level 3: the asteroid belt, the whole level.
    asteroid_belt = null;

    // Level 4: Station X, its walls and its waves, the whole level.
    station = null;
    cursors = null;

    // The outro (Outro.js), once the boss is dead; null before.
    outro = null;

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

    // The extra ship at EXTRA_LIFE_AT has been given this game. Kept apart
    // from the score, which can drop (the odd neutron's -100) and pass
    // EXTRA_LIFE_AT again.
    extra_life_given = false;

    // True from the start click to game over. Losing the mouse lock only
    // pauses the game while this is set.
    playing = false;

    constructor() {
        super("MainScene");
    }

    // data.cut is set at the end of a game (GameOverScene, endOutro): coming
    // back is a hard cut, as in Delta. Only the first load fades in.
    //
    // data.entry is set when the score goes on the hiscore table
    // (hiscores.entryFor): the name entry comes up over the stars, and the
    // intro after it. Otherwise straight to the intro.
    init(data) {
        if (!data.cut) {
            this.cameras.main.fadeIn(1000, 0, 0, 0);
        }

        // data.fade is set by the outro only: the name entry fades in.
        if (data.entry) {
            this.scene.launch("NameEntryScene", { ...data.entry, fade: data.fade === true });
        } else {
            this.scene.launch("MenuScene");
        }

        // The scene instance is reused on restart, so the last run's wave has
        // to be dropped by hand.
        this.wave = null;
        this.wave_index = 0;
        this.level = 1;
        this.fire_cave = null;
        this.firecomets = null;
        this.asteroid_belt = null;
        this.station = null;
        this.station_ready = null;
        this.outro = null;
        this.cleared = [];
        this.wave_pending = false;
        this.attempt = 0;
        this.playing = false;

        // Reset points and lives
        this.points = 0;
        this.lives = LIVES;
        this.extra_life_given = false;
    }

    create() {
        // First, so everything below is placed inside the playfield.
        this.cameras.main.setViewport(
            0, HUD_BAND, this.scale.width, this.scale.height - HUD_BAND - BOTTOM_BAND
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
        this.anims.createFromAseprite("raider");
        this.anims.createFromAseprite("xwing");
        this.anims.createFromAseprite("enforcer");
        this.anims.createFromAseprite("moon");
        this.anims.createFromAseprite("electroball");
        this.anims.createFromAseprite("rocket");
        this.anims.createFromAseprite("ember-ring");
        this.anims.createFromAseprite("zap-46px");
        this.anims.createFromAseprite("zap-118px");
        this.anims.createFromAseprite("bullet-enemy");
        this.anims.createFromAseprite("vulcan");
        this.anims.createFromAseprite("bullet-vulcan");
        this.anims.createFromAseprite("powerup-bullets");
        this.anims.createFromAseprite("powerup-shield");
        this.anims.createFromAseprite("powerup-speed");
        this.anims.createFromAseprite("powerup-missile");
        this.anims.createFromAseprite("missile");
        this.anims.createFromAseprite("shield");

        // The boss's tags; the hull loops scarab-tail. Before the Station
        // (and its Boss) below.
        this.anims.createFromAseprite("scarab");

        // The outro's planet: saturn-loop (Outro.js).
        this.anims.createFromAseprite("saturn");

        // The Belt of Osiris's turned rocks, baked now rather than as the
        // belt comes in.
        bakeAsteroidTurns(this);

        // One animation, Animation, played once per explosion.
        this.anims.createFromAseprite("explosion");
        this.explosions = new Explosions(this);

        // One animation, impact-loop, played once where a missile hits and
        // does not kill (Missiles.js).
        this.anims.createFromAseprite("impact");

        // A drop is added after the explosion pool, so it shows over the
        // blast it comes out of.
        this.powerups = new PowerUps(this);
        this.missiles = new Missiles(this);

        // Player
        this.player = new Player({ scene: this });

        // Autofire is polled in update() rather than driven by key events, so
        // holding the button keeps shots coming on the cooldown.
        this.cursors = this.input.keyboard.createCursorKeys();

        // Station X, built now behind the intro and kept hidden until level
        // 4: reading its two maps and its wall in one go would otherwise
        // stall the frame the station comes in on. After the Player, so its
        // aliens draw over the ship, as they did when made on the fly.
        this.station_ready = new Station(this);

        // Dev server only, never in the released game: N skips the rest of
        // the level, so the next one can be tested without playing up to it.
        if (import.meta.env.DEV) {
            this.input.keyboard.on("keydown-N", () => this.skipLevel());
            this.input.keyboard.on("keydown-FOUR", () => this.skipToStation());
            this.input.keyboard.on("keydown-FIVE", () => this.skipToDevStart());
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

            // Its maps are not on the display list, so they go by hand.
            this.station?.destroy();
            this.station_ready?.destroy();
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
            24
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
    // after the last, the next level.
    nextWave() {
        this.wave = null;
        this.wave_index++;

        const next = this.levelWaves()[this.wave_index];

        if (next) {
            this.startWave(next.gap ?? WAVE_GAP);
        } else if (this.level === 1) {
            this.level = 2;
            this.time.delayedCall(LEVEL_2_DELAY, () => this.enterLevel2());
        } else if (this.level === 2) {
            this.level = 3;
            this.leaveLevel2();
        }
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
    // rest of the level and goes straight into the next: level 1 to 2, or
    // level 2 to 3 (the cave and its comets vanish at once), or level 3 to 4
    // (the belt's rocks vanish at once). Not before the ship is in.
    skipLevel() {
        if (!this.playing || this.level > 3 || this.player.state === "waiting") {
            return;
        }

        if (this.level === 3) {
            this.level = 4;
            this.asteroid_belt?.rocks.forEach((rock) => rock.destroy());
            this.asteroid_belt = null;
            this.enterLevel4();
            return;
        }

        this.level++;
        this.wave_pending = false;

        if (this.wave) {
            this.cleared.push(this.wave);
            this.wave = null;
        }

        if (this.level === 2) {
            this.enterLevel2();
            return;
        }

        this.fire_cave?.destroy();
        this.fire_cave = null;
        this.firecomets?.destroy();
        this.firecomets = null;

        this.enterLevel3();
    }

    // Dev only (the 4 key): from level 1, 2 or 3 straight to Station X. The
    // wave on screen, the cave and its comets, or the belt's rocks vanish at
    // once, no points. Not before the ship is in.
    skipToStation() {
        if (!this.playing || this.level > 3 || this.player.state === "waiting") {
            return;
        }

        this.level = 4;
        this.wave_pending = false;

        if (this.wave) {
            this.cleared.push(this.wave);
            this.wave = null;
        }

        this.fire_cave?.destroy();
        this.fire_cave = null;
        this.firecomets?.destroy();
        this.firecomets = null;
        this.asteroid_belt?.rocks.forEach((rock) => rock.destroy());
        this.asteroid_belt = null;

        this.enterLevel4();
    }

    // Dev only (the 5 key): as the 4 key, but the station starts at the
    // dev-start point on a map's markers layer, and a lost ship goes back
    // there (Station.jumpToDevStart). The station is moved while still
    // hidden, before the title.
    skipToDevStart() {
        if (!this.playing || this.level > 3 || this.player.state === "waiting") {
            return;
        }

        if (!this.station_ready?.jumpToDevStart()) {
            console.warn("No dev-start point on any map's markers layer: 5 does nothing");
            return;
        }

        this.skipToStation();
    }

    // Level 1 is cleared; the ship flies straight on into level 2. Skipped if
    // the last ship was lost in the meantime.
    enterLevel2() {
        if (!this.playing || this.level !== 2) {
            return;
        }

        this.showLevelTitle(LEVEL_2_TITLE, () => {
            // Skipped on to level 3 (dev only) while the title was up.
            if (this.level !== 2) {
                return;
            }

            // The comets start once the cave fills the screen, and the
            // level's first wave a WAVE_GAP after them.
            this.fire_cave = new FireCave(this, () => {
                this.firecomets = new FirecometTrack(this);

                this.wave_index = 0;
                this.startWave(WAVE_GAP);
            });
        });
    }

    // Level 2 is cleared: the fire cave slides out, and once it is gone and
    // the ship has flown on through open space, level 3.
    leaveLevel2() {
        this.firecomets.stopLaunching();

        this.fire_cave.leave(() => {
            this.fire_cave = null;
            this.time.delayedCall(LEVEL_3_DELAY, () => this.enterLevel3());
        });
    }

    // The ship flies on into the asteroid belt. Skipped if the last ship was
    // lost in the meantime.
    enterLevel3() {
        if (!this.playing || this.level !== 3) {
            return;
        }

        this.showLevelTitle(LEVEL_3_TITLE, () => {
            this.time.delayedCall(LEVEL_3_BELT_DELAY, () => {
                // Skipped on to level 4 (dev only), or the last ship lost,
                // while the title was up or since.
                if (!this.playing || this.level !== 3) {
                    return;
                }

                this.asteroid_belt = new AsteroidBelt(this);
            });
        });
    }

    // The ship flies on into the station. Skipped if the last ship was lost
    // in the meantime.
    enterLevel4() {
        if (!this.playing || this.level !== 4) {
            return;
        }

        this.showLevelTitle(LEVEL_4_TITLE, () => {
            this.station = this.station_ready;
            this.station_ready = null;
            this.station.start();
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
        // Just respawned: the ship's first SAFE_MS under control (Player.safe).
        if (this.player.safe) {
            return;
        }

        this.explosions.spawn(this.player.x, this.player.y, "player-explosion");
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

            // The station's ships on screen vanish too, and the station goes
            // back to its last marker passed while the screen is black, so
            // its waves can't be skipped by dying.
            if (this.station) {
                this.station.callOff();
                this.restartStation();
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

    // What a missile can go for (Missiles.js): the station in level 4; in
    // levels 2 and 3 (Thomas, 2026-11-15) the wave on screen, the firecomets
    // and the asteroid belt; nothing in level 1.
    missileField() {
        if (this.station) {
            return this.station;
        }

        if (this.level === 2 || this.level === 3) {
            return new LevelTargets(this, [ this.wave, this.firecomets, this.asteroid_belt ]);
        }

        return null;
    }

    // Fade out, Station.restart() while black, fade in. The HUD bands are
    // their own scene, so only the playfield fades.
    restartStation() {
        const camera = this.cameras.main;

        camera.fadeOut(STATION_RESTART_FADE, 0, 0, 0);
        camera.once("camerafadeoutcomplete", () => {
            this.station?.restart();
            camera.fadeIn(STATION_RESTART_FADE, 0, 0, 0);
        });
    }

    // One ship more, and one more icon in the HUD. Called once per game, as
    // the score reaches EXTRA_LIFE_AT (addPoints).
    addLife() {
        if (!this.playing) {
            return;
        }

        this.lives++;
        this.scene.get("HudScene").update_lives(this.lives);
        playSound(this, "extra-life");
    }

    // Bullets still in flight after GAME OVER can still pop an alien; those
    // score nothing, and the HUD is gone by then anyway.
    addPoints(points) {
        if (!this.playing) {
            return;
        }

        this.points += points;
        this.scene.get("HudScene").update_points(this.points);

        // The score has reached EXTRA_LIFE_AT: one extra ship, once per game.
        if (!this.extra_life_given && this.points >= EXTRA_LIFE_AT) {
            this.extra_life_given = true;
            this.addLife();
        }
    }

    gameOver() {
        this.endPlay();

        // Launched over this scene, not started in place of it: as in Delta,
        // the level carries on underneath GAME OVER, minus the ship.
        this.scene.launch("GameOverScene", { points: this.points });
    }

    // The outro is over (Outro.js): the same hand-back as GAME OVER, then the
    // name entry or the intro once entry -- hiscores.entryFor, asked while
    // the words were up -- has its answer.
    endOutro(entry) {
        this.endPlay();
        entry.then((result) => this.scene.restart({ cut: true, entry: result, fade: true }));
    }

    // The end of a game, by GAME OVER or the outro.
    endPlay() {
        // Hand the mouse back. Cleared first, so the unlock this causes does
        // not pause the game on its way out.
        this.playing = false;
        this.input.mouse.releasePointerLock();

        // You need remove the event listener to avoid duplicate events.
        this.game.events.removeListener("start-game");
        // It is necessary to stop the scenes launched in parallel.
        this.scene.stop("HudScene");
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

            // Gone by now, if this update slid it off the screen.
            if (this.fire_cave?.hits(this.player)) {
                this.shipHit();
            }
        }

        if (this.firecomets) {
            this.firecomets.update(time, delta, this.player.bullets, this.explosions);

            if (this.firecomets.hits(this.player)) {
                this.shipHit();
            }
        }

        // Once the belt's last rock is gone: open space, then level 4.
        if (this.asteroid_belt) {
            this.asteroid_belt.update(time, delta, this.player.bullets, this.explosions);

            if (this.asteroid_belt.hits(this.player)) {
                this.shipHit();
            }

            if (this.asteroid_belt?.done) {
                this.asteroid_belt = null;
                this.level = 4;
                this.time.delayedCall(LEVEL_4_DELAY, () => this.enterLevel4());
            }
        }

        if (this.station) {
            this.station.update(time, delta, this.player.bullets, this.explosions);

            if (this.station.hits(this.player)) {
                this.shipHit();
            }

            // The boss is dead: the outro begins, once, as soon as the ship
            // is in play.
            if (!this.outro && this.station.boss.state === "dead" && this.player.state === "can_move") {
                this.outro = new Outro(this, this.station, this.player);
            }

            // Gone once its last map is off the screen and its last ship too.
            if (this.station.gone) {
                this.station = null;
            }
        }

        this.outro?.update(delta);

        // The mouse steers the ship, so a click cannot also aim -- the ship is
        // already at the cursor. Bullets always travel right.
        const firing = this.input.activePointer.isDown || this.cursors.space.isDown;

        // After the station, so a missile goes for where its alien is now.
        // Missiles go with the fire button, as on Nemesis.
        this.missiles.update(time, delta, this.player, this.missileField(), this.explosions, firing);

        if (firing) {
            this.player.fire(time);
        }

        this.player.bullets.update(time, delta);
        this.powerups.update(delta, this.player);
    }
}