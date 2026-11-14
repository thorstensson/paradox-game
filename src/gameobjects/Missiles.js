import { Geom, Math as PhaserMath } from "phaser";
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
// The station's pods (the vulcan) are picked as the aliens are (2026-11-10).
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

    constructor(scene) {
        this.scene = scene;
        this.hit_box = paintedBox(scene, "missile");
    }

    // firing: the fire button is held this frame.
    update(time, delta, player, station, explosions, firing) {
        const levels = player.missile_powerups.length;

        if (firing && this.missiles.length < levels && player.state === "can_move" && station) {
            const targets = station.targets();

            if (targets.length) {
                this.launch(player.x + MUZZLE_X, player.y + MUZZLE_Y, pick(targets));
            }
        }

        // Dev only: finding why the missile does not fire. While MISSILE is
        // on, once a second, why it holds fire, if it does.
        if (import.meta.env.DEV && levels > 0 && time >= (this.debug_next ?? 0)) {
            this.debug_next = time + 1000;

            const why = player.state !== "can_move" ? `ship not in play (state ${player.state})`
                : !station ? "no station"
                : station.targets().length === 0 ? `no alien on screen (station ships: ${station.ships.length})`
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
            if (missile.target && !station?.isFlying(missile.target)) {
                const targets = station ? station.targets() : [];

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

            if (!station) {
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

            if (station.wallIn(box)) {
                debug("ended: wall", sprite);
                sprite.destroy();
                return false;
            }

            const ship = station.alienIn(box);

            if (ship) {
                debug(`ended: hit ${ship.route.key}`, sprite);
                station.destroyShip(ship, explosions);
                sprite.destroy();
                return false;
            }

            // A pod (the vulcan) takes it as several hits (Station.js,
            // MISSILE_HITS): two missiles kill a vulcan.
            const pod = station.podIn(box);

            if (pod) {
                debug(`ended: hit ${pod.key}`, sprite);
                station.missilePod(pod, explosions);
                sprite.destroy();
                return false;
            }

            // A boss part takes it as several hits too (Boss.js); the centre
            // soaks it while top or bottom is still there.
            const part = station.bossIn(box);

            if (part) {
                debug(`ended: hit ${part.key}`, sprite);
                station.missileBoss(part, explosions);
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

// Dev only: finding why the missile does not fire.
function debug(text, sprite) {
    if (import.meta.env.DEV) {
        console.log(`[missile] ${text} at x ${Math.round(sprite.x)}, y ${Math.round(sprite.y)}`);
    }
}

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}
