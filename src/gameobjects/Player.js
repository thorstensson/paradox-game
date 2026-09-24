import { Math as PhaserMath, Physics } from "phaser";
import { PlayerBullets } from "./PlayerBullets";

// The ship is 32x32 native. Drawn at 3x rather than the 4x grid everything
// else uses: at 4x it read a touch too big for the playfield.
const SHIP_SCALE = 3;

// Mouse steering, near-locked to the cursor.
//
// This is a bullet-hell dodging game: it is all about player precision, so
// the ship has to be exactly where the player put it. A spring model --
// accelerate toward the cursor, damp the velocity -- was tried and rejected.
// Any spring has lag by definition, and lag is what kills you when threading
// a wave.
//
// So the ship tracks the cursor directly, and only the last sliver of the gap
// is smoothed. That takes the digital edge off a raw teleport without costing
// any precision.
//
//   FOLLOW  fraction of the remaining gap closed per frame at 60fps.
//           1.0 = rigidly locked to the cursor, no smoothing at all
//           0.65 = a touch of trail (current)
//           0.4  = noticeably loose
//
// Math.pow rescales it to the real frame time, so the feel does not change
// with framerate.
const FOLLOW = 0.65;

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
// ENTER is low enough that slow deliberate movement banks, which is only
// safe because EXIT stops the chatter that would otherwise cause.
const BANK_ENTER = 60;
const BANK_EXIT = 25;

// Once a bank starts it holds at least this long, in ms. Mouse events arrive
// in bursts rather than once per frame, so even a steady hand produces a
// spiky velocity signal; this guarantees a flick stays on screen long enough
// to read.
const BANK_MIN_HOLD = 90;

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
const FIRE_INTERVAL = 120;

// Where a shot is born, in native ship pixels from its centre (scaled with
// the ship, so it stays on the prongs at any SHIP_SCALE). The point the
// two prongs converge on, so it reads as coming from the weapon rather than
// from the middle of the hull. Deliberately the same for all three bank
// states: a muzzle that moves with the bank looks better but makes aiming
// less predictable, and precision is the whole game.
const MUZZLE_X = 14 * SHIP_SCALE;
const MUZZLE_Y = 0 * SHIP_SCALE;

export class Player extends Physics.Arcade.Sprite {

    // Player states: waiting, start, can_move
    state = "waiting";
    scene = null;
    bullets = null;

    // Tag currently held. A one-frame tag finishes immediately, so isPlaying
    // goes false and play(key, true) would restart it every tick -- tracking
    // it here means play() is called only when the state actually changes.
    bank = null;

    // Vertical speed, smoothed. Drives which bank frame is held.
    bank_velocity = 0;

    // Timestamp the next shot is allowed at.
    next_fire = 0;

    // Earliest time the current bank may be given up.
    bank_until = 0;

    constructor({ scene }) {
        super(scene, -190, scene.scale.height / 2, "ship");
        this.scene = scene;

        // Scale before the body is created. An Arcade body takes its size
        // from displayWidth/Height at creation and does not follow a later
        // setScale, so doing this the other way round leaves a 32x32 body
        // under the scaled-up ship.
        this.setScale(SHIP_SCALE);
        this.setOrigin(0.5, 0.5);

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
    }

    start() {
        this.state = "start";

        // Fly in from off-screen left, then hand control to the mouse.
        this.scene.tweens.add({
            targets: this,
            x: 200,
            duration: 800,
            delay: 1000,
            ease: "Power2",
            onComplete: () => {
                this.state = "can_move";
            }
        });
    }

    // Called every frame the fire input is held; the cooldown does the rest.
    fire(time) {
        if (this.state !== "can_move" || time < this.next_fire) {
            return;
        }

        this.next_fire = time + FIRE_INTERVAL;
        this.bullets.fire(this.x + MUZZLE_X, this.y + MUZZLE_Y);
    }

    // One-frame held tags: level, bank-up, bank-down.
    setBank(tag, time = 0) {
        if (this.bank === tag) {
            return;
        }

        this.bank = tag;
        this.play(tag);

        if (tag !== "level") {
            this.bank_until = time + BANK_MIN_HOLD;
        }
    }

    update(time, delta) {
        if (this.state !== "can_move") {
            return;
        }

        const step = delta / 1000;
        const pointer = this.scene.input.activePointer;

        // Close FOLLOW of the remaining gap each frame, rescaled to the real
        // frame time so the feel holds at any framerate.
        const follow = 1 - Math.pow(1 - FOLLOW, step * 60);

        const previous_y = this.y;

        // Half the ship stays on screen at every edge. Clamped by hand rather
        // than with collideWorldBounds, which fights a directly driven
        // position instead of cooperating with it.
        const half_w = this.displayWidth / 2;
        const half_h = this.displayHeight / 2;

        this.x = PhaserMath.Clamp(
            this.x + (pointer.x - this.x) * follow,
            half_w, this.scene.scale.width - half_w
        );
        this.y = PhaserMath.Clamp(
            this.y + (pointer.y - this.y) * follow,
            half_h, this.scene.scale.height - half_h
        );

        // Bank on what the ship actually did, not on input, so it levels out
        // by itself when the cursor stops. Fed through a decaying average so
        // a fast flick stays readable rather than lasting a single frame.
        const velocity_y = (this.y - previous_y) / step;
        const decay = Math.pow(BANK_DECAY, step);

        this.bank_velocity = this.bank_velocity * decay + velocity_y * (1 - decay);

        const banked = this.bank !== "level";

        // While banked, hold on until the speed falls below the lower exit
        // threshold -- and never give it up before the minimum hold expires.
        const threshold = banked ? BANK_EXIT : BANK_ENTER;

        if (this.bank_velocity < -threshold) {
            this.setBank("bank-up", time);
        } else if (this.bank_velocity > threshold) {
            this.setBank("bank-down", time);
        } else if (time >= this.bank_until) {
            this.setBank("level", time);
        }
    }

}
