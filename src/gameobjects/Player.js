import { Math as PhaserMath, Physics } from "phaser";
import { playSound } from "../sounds";
import { PlayerBullets } from "./PlayerBullets";

// The ship is 32x32 native. Drawn at 3x rather than the 4x grid everything
// else uses: at 4x it read a touch too big for the playfield.
const SHIP_SCALE = 3;

// Mouse steering with inertia, as in Zynaps: the ship has momentum of its
// own. It is pulled toward the steering point like a spring and slowed by
// drag, so it trails the mouse slightly and, when the mouse stops, glides on
// a touch past it before settling. Hard to halt on purpose.
//
//   PULL  acceleration per px of gap, 1/s^2.
//         lower = more lag on the follow
//   DRAG  speed lost per second, as a fraction of speed.
//         lower = longer glide when the mouse stops
//
// At 130 / 20 the ship reaches the point in about a quarter of a second and
// overshoots by well under 1% of the move: a touch slower and heavier, as
// in Zynaps (it was 180 / 20: a fifth of a second, ~3%). DRAG at or above
// 2 * sqrt(PULL) (~23 here) would stop it with no overshoot at all.
const PULL = 130;
const DRAG = 20;

// The spring is stepped in slices no longer than this, s, so a slow frame
// cannot make it blow up.
const MAX_SLICE = 1 / 120;

// Banking runs on hysteresis: two thresholds, not one, both in px/s.
//
// A single threshold always chatters at its edge -- move at roughly that
// speed and the smoothed velocity wobbles across the line every few frames,
// flipping the frame back and forth. It is worst exactly where it is most
// visible: slow, deliberate movement.
//
// So the ship banks when speed rises above ENTER, and returns to level only
// when it drops below the lower EXIT. The gap between them is the
// anti-chatter margin -- the same idea as a thermostat.
//
// ENTER is high, as in IO: banking is throwing the ship over, so it takes a
// fast, forceful move -- faster than the neutrons fly (415). A slow drift,
// diagonal or not, stays level. EXIT lets it level out once the throw is
// over rather than holding the bank through the glide after it.
const BANK_ENTER = 400;
const BANK_EXIT = 150;

// Once a bank starts it holds at least this long, in ms. Mouse events arrive
// in bursts rather than once per frame, so even a steady hand produces a
// spiky velocity signal; this guarantees a flick stays on screen long enough
// to read.
const BANK_MIN_HOLD = 90;

// From level, the ship has to travel this far up or down in one go before it
// may bank, screen px: 15 C64 pixels at our 4x. Small corrections stay level,
// as in IO.
const BANK_DEAD_ZONE = 60;

// Near-locked tracking means the ship arrives in a frame or two, so raw
// frame-to-frame velocity spikes for ~16ms and is gone -- the banked frame
// would flash past unseen. The bank therefore runs off a smoothed velocity
// that decays over roughly a quarter second, which is long enough to read
// without making the ship feel like it is lagging.
//
//   lower  = bank snaps back to level sooner
//   higher = bank lingers
const BANK_DECAY = 0.0001;

// Autofire. Holding the button sends a shot every FIRE_INTERVAL ms rather
// than one per click -- clicking repeatedly through a wave is a wrist injury,
// not a mechanic.
const FIRE_INTERVAL = 180;

// Where a shot is born, in native ship pixels from its centre (scaled with
// the ship, so it stays on the prongs at any SHIP_SCALE). The point the
// two prongs converge on, so it reads as coming from the weapon rather than
// from the middle of the hull. Deliberately the same for all three bank
// states: a muzzle that moves with the bank looks better but makes aiming
// less predictable, and precision is the whole game.
// The missile leaves from here too (Missiles.js).
export const MUZZLE_X = 14 * SHIP_SCALE;
export const MUZZLE_Y = 0 * SHIP_SCALE;

// Bullet power-ups, two levels, as the shield. One on: no centre shot, one
// from each arm instead, both together. Two on: both arms and the centre.
// The arm tips sit 5 native px above and below the centre on the level
// frame; fixed for every bank state, like the centre muzzle.
const ARM_Y = 5 * SHIP_SCALE;

// Bullet power-ups on at once, at most.
const BULLET_LEVELS = 2;

// How long each bullet power-up lasts once caught, ms, each on its own
// timer: when the first runs out, the second carries on alone. Losing the
// ship ends them all at once.
const DOUBLE_TIME = 60000;

// Mouse speed: how far the ship's steering point moves for each pixel the
// mouse moves, by the number of speed power-ups on. None: 0.9, a touch
// under the mouse, so dodging takes a sure hand, as in Delta. One: 1.25.
// Two: 1.5. The inertia (PULL, DRAG) stays the same at every level.
const MOUSE_SPEEDS = [ 0.9, 1.25, 1.5 ];

// How long each speed power-up lasts once caught, ms, each on its own timer,
// as the bullet power-up. Losing the ship ends them all at once.
const SPEED_TIME = 60000;

// The shield, from the shield power-up: a quarter ring (shield.png, painted
// 12 to 3 o'clock round the canvas centre) spinning round the ship. Enemy
// bullets and asteroids that reach it on the quarter it covers are
// destroyed; aliens are not stopped. Lasts SHIELD_TIME; losing the ship ends it at once.
//
// Two levels: a second shield caught before the first runs out adds a second
// quarter ring opposite the first, spinning with it. Each has its own
// SHIELD_TIME; when the first runs out, the second carries on alone.
const SHIELD_TIME = 60000;

// Missile power-ups on at once, at most: one keeps one missile in the air,
// two keep two (Missiles.js; Thomas, 2026-11-09).
export const MISSILE_LEVELS = 2;

// How long each missile power-up lasts once caught, ms, each on its own
// timer, as the bullet power-up: when the first runs out, the second carries
// on alone. Losing the ship ends them all at once. A placeholder to tune by
// playing.
const MISSILE_TIME = 60000;

// Spin, degrees per second, clockwise.
const SHIELD_SPIN = 720;

// The outro (takeOver): how long the ship takes to glide to the middle
// height once the game has it, ms. A placeholder to tune by playing.
const TAKE_OVER_MS = 1000;

// The ring's outer edge, native px from its centre.
const SHIELD_OUTER = 15;

// How far out a bullet is stopped, screen px from the ship's centre: the
// ring's outer edge plus a bullet's half-width (3 native).
const SHIELD_REACH = (SHIELD_OUTER + 3) * SHIP_SCALE;

// The ring's centre sits this far left of the ship's, screen px: 2 native
// px, since the Raven is painted a little toward the back of its canvas.
const SHIELD_NUDGE = 2 * SHIP_SCALE;

// The painted quarter, degrees, at an angle of 0: 12 o'clock to 3 o'clock.
const SHIELD_FROM = -90;
const SHIELD_TO = 0;

// Where each shield sits, degrees on from the shared spin: the second
// opposite the first.
const SHIELD_SLOTS = [ 0, 180 ];

// Where the ship waits off-screen before flying in.
const START_X = -190;

// Black kept between the top of the hull and the top of the playfield (the
// HUD band), px.
const TOP_GAP = 5;

export class Player extends Physics.Arcade.Sprite {

    // Player states: waiting, start, can_move, removed, outro. Only can_move
    // can be hit, so the ship is safe while it flies in and in the outro.
    state = "waiting";
    scene = null;
    bullets = null;

    // Tag currently held. A one-frame tag finishes immediately, so isPlaying
    // goes false and play(key, true) would restart it every tick -- tracking
    // it here means play() is called only when the state actually changes.
    bank = null;

    // Vertical speed, smoothed. Drives which bank frame is held.
    bank_velocity = 0;

    // Vertical distance travelled in one direction while level, px. Up is
    // negative. Checked against BANK_DEAD_ZONE.
    bank_travel = 0;

    // Timestamp the next shot is allowed at.
    next_fire = 0;

    // The bullet power-ups that are on, at most BULLET_LEVELS, oldest first:
    // each the timer that turns it off. Scene timers, so the minute stops
    // while the game is paused.
    bullet_powerups = [];

    // The speed power-ups that are on, at most two, oldest first: each the
    // timer that turns it off. Its length picks the MOUSE_SPEEDS entry.
    speed_powerups = [];

    // The missile power-ups that are on, at most MISSILE_LEVELS, oldest
    // first: each the timer that turns it off.
    missile_powerups = [];

    // The shields that are on, at most two, oldest first: each its sprite,
    // its slot (SHIELD_SLOTS) and the timer that turns it off. They turn
    // together, shield_angle on.
    shields = [];
    shield_angle = 0;

    // Earliest time the current bank may be given up.
    bank_until = 0;

    // Where the ship is steering to. The mouse is pointer-locked -- the real
    // cursor is hidden and a page cannot move it -- so there is no cursor
    // position to follow. Instead the mouse's movement is added up here, and
    // the ship follows this point exactly as it used to follow the cursor.
    // It starts on the ship, which is why the ship no longer snaps to
    // wherever the mouse happened to be when the game began.
    target_x = 0;
    target_y = 0;

    // The ship's own speed, px/s: the inertia.
    speed_x = 0;
    speed_y = 0;

    // Highest the ship centre may go: the hull, not the 32x32 frame, stops
    // TOP_GAP below the top. Worked out from the painted pixels.
    min_y = 0;

    // Per frame, which native pixels are painted. The whole painted ship is
    // what can be hit -- wings and prongs included, never the empty notch.
    masks = null;

    constructor({ scene }) {
        super(scene, START_X, scene.cameras.main.height / 2, "ship");
        this.scene = scene;

        // Scale before the body is created. An Arcade body takes its size
        // from displayWidth/Height at creation and does not follow a later
        // setScale, so doing this the other way round leaves a 32x32 body
        // under the scaled-up ship.
        this.setScale(SHIP_SCALE);
        this.setOrigin(0.5, 0.5);

        this.masks = shipMasks(scene);
        this.min_y = TOP_GAP + (this.displayHeight / 2 - topmostRow(this.masks) * SHIP_SCALE);

        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);

        // Position is driven directly, so the body carries no velocity of its
        // own -- it exists only to give collision something to test against.
        this.body.setAllowGravity(false);
        this.body.setVelocity(0, 0);

        this.setBank("level");

        // A Blitter pool -- one draw call for every bullet on screen, no
        // physics bodies, no postFX, nothing created or destroyed at runtime.
        this.bullets = new PlayerBullets(scene);

        // Read from the browser directly rather than from Phaser's pointer:
        // Phaser keeps only the last movement it saw each frame, and a fast
        // flick arrives as several events, so most of it would be lost.
        this.onMouseMove = (event) => this.steer(event);
        document.addEventListener("mousemove", this.onMouseMove);

        scene.events.once("shutdown", () => {
            document.removeEventListener("mousemove", this.onMouseMove);
        });
    }

    // Movement is in screen pixels; the canvas is shown at an integer zoom,
    // so dividing by it gives the same feel as following the cursor did.
    // The target is held inside the same edges as the ship, so it can never
    // wander off and leave the ship pinned against a wall.
    steer(event) {
        if (this.state !== "can_move" || !this.scene.input.mouse.locked) {
            return;
        }

        const zoom = this.scene.scale.zoom;
        const speed = MOUSE_SPEEDS[this.speed_powerups.length];
        const half_w = this.displayWidth / 2;
        const half_h = this.displayHeight / 2;

        this.target_x = PhaserMath.Clamp(
            this.target_x + (event.movementX / zoom) * speed,
            half_w, this.scene.scale.width - half_w
        );
        this.target_y = PhaserMath.Clamp(
            this.target_y + (event.movementY / zoom) * speed,
            this.min_y, this.scene.cameras.main.height - half_h
        );
    }

    // delay: ms before the fly-in begins.
    // onReady: called once the ship is in and under control.
    start(delay = 1000, onReady = null) {
        this.state = "start";

        // Fly in from off-screen left, then hand control to the mouse.
        this.scene.tweens.add({
            targets: this,
            x: 200,
            duration: 800,
            delay,
            ease: "Power2",
            onComplete: () => {
                this.target_x = this.x;
                this.target_y = this.y;
                this.speed_x = 0;
                this.speed_y = 0;
                this.state = "can_move";
                onReady?.();
            }
        });
    }

    // Takes the ship out of play: hidden, and no longer steered or firing,
    // since both check for "can_move". Bullets already in flight carry on.
    leavePlay() {
        this.state = "removed";
        this.setVisible(false);
        this.endDouble();
        this.endSpeed();
        this.endShield();
        this.endMissile();
    }

    // The outro (MainScene, after the boss): the game takes the ship. Out of
    // can_move, the mouse no longer steers it, it no longer fires or sends
    // missiles, and nothing can hit it. It shows its level frame and glides
    // from where it is to height y, staying where it is across.
    takeOver(y) {
        this.state = "outro";
        this.setBank("level", 0, true);

        this.scene.tweens.add({
            targets: this,
            y,
            duration: TAKE_OVER_MS,
            ease: "Sine.easeInOut"
        });
    }

    // The missile power-up is caught: one more level for MISSILE_TIME, on its
    // own timer. With two on, a catch restarts the time of the one that
    // would run out first, as the bullet power-up does.
    startMissile() {
        if (this.missile_powerups.length === MISSILE_LEVELS) {
            this.missile_powerups.shift().remove();
        }

        const timer = this.scene.time.delayedCall(MISSILE_TIME, () => {
            this.missile_powerups = this.missile_powerups.filter((t) => t !== timer);
            this.showPowerups();
        });

        this.missile_powerups.push(timer);
        this.showPowerups();

        // Dev only: finding why the missile does not fire.
        if (import.meta.env.DEV) {
            console.log(`[missile] power-up caught, levels on: ${this.missile_powerups.length}`);
        }
    }

    // Every missile power-up off at once.
    endMissile() {
        for (const timer of this.missile_powerups) {
            timer.remove();
        }

        this.missile_powerups = [];
        this.showPowerups();
    }

    // The speed power-up is caught: one more level for SPEED_TIME, on its
    // own timer. With two on, a catch restarts the time of the one that
    // would run out first, as the bullet power-up does.
    startSpeed() {
        if (this.speed_powerups.length === MOUSE_SPEEDS.length - 1) {
            this.speed_powerups.shift().remove();
        }

        const timer = this.scene.time.delayedCall(SPEED_TIME, () => {
            this.speed_powerups = this.speed_powerups.filter((t) => t !== timer);
            this.showPowerups();
        });

        this.speed_powerups.push(timer);
        this.showPowerups();
    }

    // Every speed power-up off at once: back to the default mouse speed.
    endSpeed() {
        for (const timer of this.speed_powerups) {
            timer.remove();
        }

        this.speed_powerups = [];
        this.showPowerups();
    }

    // The bullet power-up is caught: one more level for DOUBLE_TIME, on its
    // own timer. With two on, a catch restarts the time of the one that
    // would run out first, as the shield does.
    startDouble() {
        if (this.bullet_powerups.length === BULLET_LEVELS) {
            this.bullet_powerups.shift().remove();
        }

        const timer = this.scene.time.delayedCall(DOUBLE_TIME, () => {
            this.bullet_powerups = this.bullet_powerups.filter((t) => t !== timer);
            this.showPowerups();
        });

        this.bullet_powerups.push(timer);
        this.showPowerups();
    }

    // Every bullet power-up off at once: back to the single centre bullet.
    endDouble() {
        for (const timer of this.bullet_powerups) {
            timer.remove();
        }

        this.bullet_powerups = [];
        this.showPowerups();
    }

    // Tells the HUD's bottom band which power-ups are on: RAILGUN is the
    // bullet power-up, at either level.
    showPowerups() {
        if (!this.scene.scene.isActive("HudScene")) {
            return;
        }

        this.scene.scene.get("HudScene").update_powerups({
            railgun: this.bullet_powerups.length > 0,
            shield: this.shields.length > 0,
            speed: this.speed_powerups.length > 0,
            missile: this.missile_powerups.length > 0
        });
    }

    // The shield power-up is caught: a ring spins round the ship for
    // SHIELD_TIME -- the second ring, opposite the first, if one is on
    // already. With two on, a catch restarts the time of the one that would
    // run out first.
    startShield() {
        if (this.shields.length === SHIELD_SLOTS.length) {
            const oldest = this.shields.shift();
            oldest.timer.remove();
            oldest.timer = this.shieldTimer(oldest);
            this.shields.push(oldest);
            return;
        }

        const taken = this.shields.map((shield) => shield.slot);
        const slot = SHIELD_SLOTS.find((s) => !taken.includes(s));

        const sprite = this.scene.add.sprite(this.x - SHIELD_NUDGE, this.y, "shield");
        sprite.setScale(SHIP_SCALE);
        sprite.angle = this.shield_angle + slot;
        sprite.play({ key: "shield-spin", repeat: -1 });

        const shield = { sprite, slot, timer: null };
        shield.timer = this.shieldTimer(shield);
        this.shields.push(shield);
        this.showPowerups();
    }

    // Turns one shield off after SHIELD_TIME.
    shieldTimer(shield) {
        return this.scene.time.delayedCall(SHIELD_TIME, () => {
            shield.sprite.destroy();
            this.shields = this.shields.filter((s) => s !== shield);
            this.showPowerups();
        });
    }

    // Every shield off at once.
    endShield() {
        for (const shield of this.shields) {
            shield.sprite.destroy();
            shield.timer.remove();
        }

        this.shields = [];
        this.showPowerups();
    }

    // True if a shield stops an enemy bullet at (x, y): within reach of the
    // ship's centre, on a quarter a ring covers right now.
    shieldBlocks(x, y) {
        return this.shields.some(({ sprite }) => {
            const dx = x - sprite.x;
            const dy = y - sprite.y;

            if (dx * dx + dy * dy > SHIELD_REACH * SHIELD_REACH) {
                return false;
            }

            const at = PhaserMath.Angle.WrapDegrees(
                PhaserMath.RadToDeg(Math.atan2(dy, dx)) - sprite.angle
            );

            return at >= SHIELD_FROM && at <= SHIELD_TO;
        });
    }

    // As shieldBlocks(), for something round and bigger than a bullet -- an
    // asteroid -- with its centre at (x, y), radius screen px: true if it
    // reaches a ring's outer edge on a quarter the ring covers right now.
    shieldBlocksCircle(x, y, radius) {
        const reach = SHIELD_OUTER * SHIP_SCALE + radius;

        return this.shields.some(({ sprite }) => {
            const dx = x - sprite.x;
            const dy = y - sprite.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > reach) {
                return false;
            }

            // How far round the circle the body spreads either side of its
            // centre, seen from the ship, degrees.
            const spread = distance > radius
                ? PhaserMath.RadToDeg(Math.asin(radius / distance))
                : 180;

            const at = PhaserMath.Angle.WrapDegrees(
                PhaserMath.RadToDeg(Math.atan2(dy, dx)) - sprite.angle
            );

            return at >= SHIELD_FROM - spread && at <= SHIELD_TO + spread;
        });
    }

    // Back in after losing a life: level, mid-height, flying in at once.
    respawn(onReady = null) {
        this.setPosition(START_X, this.scene.cameras.main.height / 2);
        this.setVisible(true);
        this.bank_velocity = 0;
        this.bank_travel = 0;
        this.speed_x = 0;
        this.speed_y = 0;
        this.bank = null;
        this.setBank("level", 0, true);
        this.start(0, onReady);
    }

    // True while the ship can be hit (only in play) and a painted pixel of
    // the frame on show lies inside rect.
    touches(rect) {
        if (this.state !== "can_move") {
            return false;
        }

        const { width, height, painted } = this.masks[this.frame.name];
        const left = this.x - this.displayWidth / 2;
        const top = this.y - this.displayHeight / 2;

        // The native pixels whose screen squares overlap rect.
        const first_column = Math.max(0, Math.floor((rect.left - left) / SHIP_SCALE));
        const last_column = Math.min(width - 1, Math.ceil((rect.right - left) / SHIP_SCALE) - 1);
        const first_row = Math.max(0, Math.floor((rect.top - top) / SHIP_SCALE));
        const last_row = Math.min(height - 1, Math.ceil((rect.bottom - top) / SHIP_SCALE) - 1);

        for (let row = first_row; row <= last_row; row++) {
            for (let column = first_column; column <= last_column; column++) {
                if (painted[row * width + column]) {
                    return true;
                }
            }
        }

        return false;
    }

    // The painted ship as screen columns, one per native column that has
    // paint: its left and right edge and its highest and lowest painted
    // pixel. Null while the ship cannot be hit. Used against the flames.
    paintedColumns() {
        if (this.state !== "can_move") {
            return null;
        }

        const { width, height, painted } = this.masks[this.frame.name];
        const left = this.x - this.displayWidth / 2;
        const top = this.y - this.displayHeight / 2;
        const columns = [];

        for (let column = 0; column < width; column++) {
            let first = -1;
            let last = -1;

            for (let row = 0; row < height; row++) {
                if (painted[row * width + column]) {
                    if (first < 0) {
                        first = row;
                    }
                    last = row;
                }
            }

            if (first >= 0) {
                columns.push({
                    left: left + column * SHIP_SCALE,
                    right: left + (column + 1) * SHIP_SCALE,
                    top: top + first * SHIP_SCALE,
                    bottom: top + (last + 1) * SHIP_SCALE
                });
            }
        }

        return columns;
    }

    // Called every frame the fire input is held; the cooldown does the rest.
    fire(time) {
        if (this.state !== "can_move" || time < this.next_fire) {
            return;
        }

        this.next_fire = time + FIRE_INTERVAL;

        playSound(this.scene, "player-railgun");

        // None on: centre. One: both arms. Two: both arms and the centre.
        const level = this.bullet_powerups.length;

        if (level > 0) {
            this.bullets.fire(this.x + MUZZLE_X, this.y - ARM_Y);
            this.bullets.fire(this.x + MUZZLE_X, this.y + ARM_Y);
        }

        if (level !== 1) {
            this.bullets.fire(this.x + MUZZLE_X, this.y + MUZZLE_Y);
        }
    }

    // Tags: level (one frame), bank-up and bank-down (three frames each,
    // played once and held on the last). Going back to level plays the bank
    // backwards from whatever frame is showing, and update() puts up level
    // when it runs out. Banking again the same way on the way back carries
    // on forwards from that frame too, so neither direction snaps.
    // instant: straight to the tag, for a respawn.
    setBank(tag, time = 0, instant = false) {
        if (this.bank === tag) {
            return;
        }

        this.bank = tag;

        const current = this.anims.currentAnim;

        // Position of the showing frame within its tag. Phaser's frame index
        // counts from 1.
        const position = this.anims.currentFrame
            ? this.anims.currentFrame.index - 1
            : 0;

        const in_bank = !instant && current && current.key !== "level";

        if (tag === "level") {
            // Phaser plays a reverse from startFrame 0 from the LAST frame,
            // so on the first bank frame go straight to level instead.
            if (in_bank && position > 0) {
                this.playReverse({ key: current.key, startFrame: position });
            } else {
                this.play("level");
            }
            return;
        }

        if (in_bank && current.key === tag) {
            this.play({ key: tag, startFrame: position });
        } else {
            this.play(tag);
        }

        this.bank_until = time + BANK_MIN_HOLD;
    }

    update(time, delta) {
        const step = delta / 1000;

        // In the outro the game moves the ship; its shields still ride on it.
        if (this.state === "outro") {
            this.rideShields(step);
            return;
        }

        if (this.state !== "can_move") {
            return;
        }

        const previous_y = this.y;

        // Half the ship stays on screen at every edge. Clamped by hand rather
        // than with collideWorldBounds, which fights a directly driven
        // position instead of cooperating with it.
        const half_w = this.displayWidth / 2;
        const half_h = this.displayHeight / 2;
        const max_x = this.scene.scale.width - half_w;
        const max_y = this.scene.cameras.main.height - half_h;

        // Pull toward the steering point, brake by drag, then move. Sliced
        // so the feel holds at any framerate.
        const slices = Math.ceil(step / MAX_SLICE);
        const slice = step / slices;

        for (let i = 0; i < slices; i++) {
            this.speed_x += (PULL * (this.target_x - this.x)
                - DRAG * this.speed_x) * slice;
            this.speed_y += (PULL * (this.target_y - this.y)
                - DRAG * this.speed_y) * slice;

            this.x += this.speed_x * slice;
            this.y += this.speed_y * slice;

            // At an edge the speed into it is dropped, so the ship stops
            // there instead of sticking or bouncing.
            if (this.x < half_w || this.x > max_x) {
                this.x = PhaserMath.Clamp(this.x, half_w, max_x);
                this.speed_x = 0;
            }
            if (this.y < this.min_y || this.y > max_y) {
                this.y = PhaserMath.Clamp(this.y, this.min_y, max_y);
                this.speed_y = 0;
            }
        }

        // Bank on what the ship actually did, not on input, so it levels out
        // by itself when the cursor stops. Fed through a decaying average so
        // a fast flick stays readable rather than lasting a single frame.
        const velocity_y = (this.y - previous_y) / step;
        const decay = Math.pow(BANK_DECAY, step);

        this.bank_velocity = this.bank_velocity * decay + velocity_y * (1 - decay);

        const banked = this.bank !== "level";

        // Dead zone: while level, add up the travel in one direction. It
        // starts over when the ship turns the other way or as good as stops.
        if (banked) {
            this.bank_travel = 0;
        } else {
            const dy = this.y - previous_y;

            if (dy * this.bank_travel < 0
                || Math.abs(this.bank_velocity) < BANK_EXIT) {
                this.bank_travel = dy;
            } else {
                this.bank_travel += dy;
            }
        }

        const may_bank = banked
            || Math.abs(this.bank_travel) >= BANK_DEAD_ZONE;

        // While banked, hold on until the speed falls below the lower exit
        // threshold -- and never give it up before the minimum hold expires.
        const threshold = banked ? BANK_EXIT : BANK_ENTER;

        if (may_bank && this.bank_velocity < -threshold) {
            this.setBank("bank-up", time);
        } else if (may_bank && this.bank_velocity > threshold) {
            this.setBank("bank-down", time);
        } else if (time >= this.bank_until) {
            this.setBank("level", time);
        }

        // The bank has played back to its first frame: show level.
        if (this.bank === "level" && !this.anims.isPlaying
            && this.anims.currentAnim.key !== "level") {
            this.play("level");
        }

        this.rideShields(step);
    }

    // The shields ride on the ship's centre, turning together.
    rideShields(step) {
        this.shield_angle += SHIELD_SPIN * step;

        for (const { sprite, slot } of this.shields) {
            sprite.setPosition(this.x - SHIELD_NUDGE, this.y);
            sprite.angle = this.shield_angle + slot;
        }
    }

}

// One mask per frame of the ship (banking included): which native pixels
// are painted. Read once from the loaded image.
function shipMasks(scene) {
    const texture = scene.textures.get("ship");
    const image = texture.getSourceImage();

    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;

    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);

    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    const masks = {};

    for (const name of texture.getFrameNames()) {
        const frame = texture.get(name);
        const width = frame.cutWidth;
        const height = frame.cutHeight;
        const painted = new Uint8Array(width * height);

        for (let row = 0; row < height; row++) {
            for (let column = 0; column < width; column++) {
                const i = ((frame.cutY + row) * image.width + frame.cutX + column) * 4;
                painted[row * width + column] = pixels[i + 3] > 0 ? 1 : 0;
            }
        }

        masks[name] = { width, height, painted };
    }

    return masks;
}

// The highest painted row over every mask, native px from the top.
function topmostRow(masks) {
    let top = Infinity;

    for (const { width, height, painted } of Object.values(masks)) {
        for (let row = 0; row < height && row < top; row++) {
            if (painted.subarray(row * width, (row + 1) * width).includes(1)) {
                top = row;
            }
        }
    }

    return top === Infinity ? 0 : top;
}
