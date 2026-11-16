import { Animations, Geom, Math as PhaserMath } from "phaser";
import { playSound } from "../sounds";
import { paintedBox } from "./FirecometTrack";
import { MUZZLE_X, MUZZLE_Y } from "./Player";

// The seeking missile, from the missile power-up (NOTES.md -> Power drops).
// While the power-up is on, a missile goes with the fire button, as on
// Nemesis, whenever fewer are in the air than the levels on: one with one
// missile power-up, two with two (Thomas's pick A, 2026-11-09; was a 3 s, then
// 2 s timer). From the ship's nose, where the centre bullet leaves, at a random alien of the station's on screen; with none on screen it
// holds fire (Thomas, 2026-11-09). It turns toward its alien a little each
// frame. If that alien is shot first, it picks another; with none left on
// screen it flies straight on. It kills what it hits, as a bullet does, and
// stops at the station's walls, as bullets do.
//
// The station's pods (the vulcan) are picked as the aliens are (2026-11-10),
// and so are the boss's parts, unless they are soaking (Boss.js targets()).
//
// Levels 2 and 3 too (Thomas, 2026-11-15), not level 1: there the missile
// goes for what LevelTargets below gives it.
//
// Later: a gun near the ship is picked before any alien.

// The ship's pixel size, as everything in the game.
const SCALE = 3;

// Screen px/s, and how fast it turns toward its alien, degrees/s.
// Placeholders to tune by playing.
const SPEED = 800;
const TURN = 270;

// Its heading as it leaves the ship, degrees: 0 is straight ahead (right),
// -90 straight up. A placeholder to tune by playing.
const LAUNCH_HEADING = 0;

// Levels 2 and 3: a missile counts as this many bullet hits, as on the
// station's vulcans and the scarab's parts (Thomas, 2026-11-15). A
// placeholder to tune by playing.
const MISSILE_HITS = 5;

// The impact (fx/impact, impact-simple, Thomas): plays once where a missile
// hits and does not kill -- the target takes the hits, or soaks them, and
// stays. Never with an explosion, never on a wall (Thomas, 2026-11-15).
// A small pool, as the explosions: at most two missiles fly at once.
const IMPACT_TEXTURE = "impact";
const IMPACT_ANIMATION = "impact-loop";
const IMPACT_POOL = 4;

// Over the aliens, the boss and the vulcans it lands on, which are all
// added to the scene after this pool.
const IMPACT_DEPTH = 1;

// Gone once fully off the playfield: half the 13 px canvas at 3x.
const MARGIN = 7 * SCALE;

// The tag shown for each heading, in 45-degree steps, and whether it is
// mirrored: the art faces right, so the left-facing headings are mirrored.
// Up is negative, as on the screen.
const HEADINGS = {
    "0": { tag: "fwd", flip: false },
    "-45": { tag: "fwd-up-45", flip: false },
    "-90": { tag: "fwd-up-90", flip: false },
    "45": { tag: "fwd-down-45", flip: false },
    "90": { tag: "fwd-down-90", flip: false },
    "-135": { tag: "fwd-up-45", flip: true },
    "135": { tag: "fwd-down-45", flip: true },
    "180": { tag: "fwd", flip: true },
    "-180": { tag: "fwd", flip: true }
};

export class Missiles {

    scene = null;
    missiles = [];

    // The painted pixels over all five frames, native px from the centre.
    hit_box = null;

    // The impact pool.
    impacts = [];

    constructor(scene) {
        this.scene = scene;
        this.hit_box = paintedBox(scene, "missile");

        for (let i = 0; i < IMPACT_POOL; i++) {
            const impact = scene.add.sprite(0, 0, IMPACT_TEXTURE)
                .setScale(SCALE)
                .setDepth(IMPACT_DEPTH)
                .setActive(false)
                .setVisible(false);

            // The tag carries no repeat, so it plays once and goes back
            // to the pool.
            impact.on(Animations.Events.ANIMATION_COMPLETE, () => {
                impact.setActive(false).setVisible(false);
            });

            this.impacts.push(impact);
        }
    }

    // Silently does nothing if the pool is dry.
    impact(x, y) {
        const impact = this.impacts.find((sprite) => !sprite.active);

        if (!impact) {
            return;
        }

        impact.setPosition(x, y).setActive(true).setVisible(true);
        impact.play(IMPACT_ANIMATION);
    }

    // firing: the fire button is held this frame.
    // field: what a missile can go for -- the station in level 4, a
    // LevelTargets in levels 2 and 3, null in level 1 (MainScene
    // missileField()).
    update(time, delta, player, field, explosions, firing) {
        const levels = player.missile_powerups.length;

        if (firing && this.missiles.length < levels && player.state === "can_move" && field) {
            const targets = field.targets();

            if (targets.length) {
                this.launch(player.x + MUZZLE_X, player.y + MUZZLE_Y, pick(targets));
            }
        }

        // Dev only: finding why the missile does not fire. While MISSILE is
        // on, once a second, why it holds fire, if it does.
        if (import.meta.env.DEV && levels > 0 && time >= (this.debug_next ?? 0)) {
            this.debug_next = time + 1000;

            const why = player.state !== "can_move" ? `ship not in play (state ${player.state})`
                : !field ? "no missile targets in this level"
                : field.targets().length === 0 ? `no alien on screen${field.ships ? ` (station ships: ${field.ships.length})` : ""}`
                : null;

            if (why) {
                console.log(`[missile] holding fire: ${why}`);
            }
        }

        const step = delta / 1000;
        const width = this.scene.scale.width;
        const height = this.scene.cameras.main.height;
        const box = new Geom.Rectangle();

        this.missiles = this.missiles.filter((missile) => {
            const { sprite } = missile;

            // Its alien was shot first, or flew off: another, if any.
            if (missile.target && !field?.isFlying(missile.target)) {
                const targets = field ? field.targets() : [];

                missile.target = targets.length ? pick(targets) : null;
            }

            if (missile.target) {
                const { sprite: alien } = missile.target;
                const wanted = PhaserMath.RadToDeg(Math.atan2(alien.y - sprite.y, alien.x - sprite.x));
                const turn = PhaserMath.Angle.ShortestBetween(missile.heading, wanted);
                const most = TURN * step;

                missile.heading = PhaserMath.Angle.WrapDegrees(
                    missile.heading + PhaserMath.Clamp(turn, -most, most)
                );
            }

            const radians = PhaserMath.DegToRad(missile.heading);

            sprite.x += Math.cos(radians) * SPEED * step;
            sprite.y += Math.sin(radians) * SPEED * step;

            this.show(missile);

            if (sprite.x < -MARGIN || sprite.x > width + MARGIN
                || sprite.y < -MARGIN || sprite.y > height + MARGIN) {
                debug("ended: off-screen", sprite);
                sprite.destroy();
                return false;
            }

            if (!field) {
                return true;
            }

            // The hit box, mirrored with the art when it flies left.
            const left = sprite.flipX
                ? -(this.hit_box.x + this.hit_box.w)
                : this.hit_box.x;

            box.setTo(
                sprite.x + left * SCALE,
                sprite.y + this.hit_box.y * SCALE,
                this.hit_box.w * SCALE,
                this.hit_box.h * SCALE
            );

            // Levels 2 and 3: no walls; what it hits takes MISSILE_HITS.
            if (field instanceof LevelTargets) {
                const target = field.hitIn(box);

                if (target) {
                    debug(`ended: hit ${target.key}`, sprite);
                    target.hit(MISSILE_HITS);

                    if (target.alive()) {
                        this.impact(sprite.x, sprite.y);
                    }

                    sprite.destroy();
                    return false;
                }

                return true;
            }

            if (field.wallIn(box)) {
                debug("ended: wall", sprite);
                sprite.destroy();
                return false;
            }

            const ship = field.alienIn(box);

            if (ship) {
                debug(`ended: hit ${ship.route.key}`, sprite);
                field.destroyShip(ship, explosions);
                sprite.destroy();
                return false;
            }

            // A pod (the vulcan) takes it as several hits (Station.js,
            // MISSILE_HITS): two missiles kill a vulcan.
            const pod = field.podIn(box);

            if (pod) {
                debug(`ended: hit ${pod.key}`, sprite);
                field.missilePod(pod, explosions);

                if (!pod.dead) {
                    this.impact(sprite.x, sprite.y);
                }

                sprite.destroy();
                return false;
            }

            // A boss part takes it as several hits too (Boss.js); the centre
            // soaks it while top or bottom is still there.
            const part = field.bossIn(box);

            if (part) {
                debug(`ended: hit ${part.key}`, sprite);
                field.missileBoss(part, explosions);

                if (!part.dead) {
                    this.impact(sprite.x, sprite.y);
                }

                sprite.destroy();
                return false;
            }

            return true;
        });
    }

    launch(x, y, target) {
        const sprite = this.scene.add.sprite(x, y, "missile").setScale(SCALE);
        const missile = { sprite, target, heading: LAUNCH_HEADING, tag: null };

        this.show(missile);
        this.missiles.push(missile);
        playSound(this.scene, "player-missile");
        debug(`launched at ${target.route?.key ?? target.key}`, sprite);
    }

    // The frame nearest its heading.
    show(missile) {
        const step = Math.round(missile.heading / 45) * 45;
        const { tag, flip } = HEADINGS[String(step)];

        if (missile.tag !== tag) {
            missile.tag = tag;
            missile.sprite.play(tag);
        }

        missile.sprite.setFlipX(flip);
    }
}

// Levels 2 and 3 (Thomas, 2026-11-15): what a missile can go for outside
// Station X -- the wave on screen, the firecomets and the asteroid belt,
// each giving its own list (missileTargets()). Each target is { key,
// sprite, alive(), touches(box), hit(count) }. A missile counts as
// MISSILE_HITS bullet hits; the kill is the wave's own, with the same
// explosion, points and drop as a bullet kill. Nothing stops it on the way:
// the ship's bullets fly through the cave's flames too.
export class LevelTargets {

    constructor(scene, sources) {
        this.scene = scene;
        this.sources = sources.filter((source) => source?.missileTargets);
    }

    // Still there, and on the playfield.
    targets() {
        const width = this.scene.scale.width;
        const height = this.scene.cameras.main.height;

        return this.sources
            .flatMap((source) => source.missileTargets())
            .filter(({ sprite, alive }) => alive()
                && sprite.x >= 0 && sprite.x <= width
                && sprite.y >= 0 && sprite.y <= height);
    }

    isFlying(target) {
        return target.alive();
    }

    // The first target under the rectangle (screen px), or null.
    hitIn(box) {
        return this.targets().find((target) => target.touches(box)) ?? null;
    }
}

// Dev only: finding why the missile does not fire.
function debug(text, sprite) {
    if (import.meta.env.DEV) {
        console.log(`[missile] ${text} at x ${Math.round(sprite.x)}, y ${Math.round(sprite.y)}`);
    }
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}
