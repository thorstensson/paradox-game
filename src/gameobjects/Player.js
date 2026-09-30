import { Geom, Math as PhaserMath, Physics } from "phaser";
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
//           0.65 = a touch of trail
//           0.55 = a tad more (current)
//           0.4  = noticeably loose
//
// Math.pow rescales it to the real frame time, so the feel does not change
// with framerate.
const FOLLOW = 0.55;

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

// What an enemy has to touch to kill the ship, in native pixels from its
// centre: the middle band, from the rear up to and including the ringed
// dot (level frame, x 3-19, y 14-17). Far smaller than the sprite, so a wing
// clipping an enemy is a near miss rather than a death. To be tuned.
const HIT_BOX = { x: -13, y: -2, w: 17, h: 4 };

// Where the ship waits off-screen before flying in.
const START_X = -190;

export class Player extends Physics.Arcade.Sprite {

    // Player states: waiting, start, can_move, removed. Only can_move can be
    // hit, so the ship is safe while it flies in.
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

    // Where the ship is steering to. The mouse is pointer-locked -- the real
    // cursor is hidden and a page cannot move it -- so there is no cursor
    // position to follow. Instead the mouse's movement is added up here, and
    // the ship follows this point exactly as it used to follow the cursor.
    // It starts on the ship, which is why the ship no longer snaps to
    // wherever the mouse happened to be when the game began.
    target_x = 0;
    target_y = 0;

    constructor({ scene }) {
        super(scene, START_X, scene.scale.height / 2, "ship");
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
        const half_w = this.displayWidth / 2;
        const half_h = this.displayHeight / 2;

        this.target_x = PhaserMath.Clamp(
            this.target_x + event.movementX / zoom,
            half_w, this.scene.scale.width - half_w
        );
        this.target_y = PhaserMath.Clamp(
            this.target_y + event.movementY / zoom,
            half_h, this.scene.scale.height - half_h
        );
    }

    // delay: ms before the fly-in begins.
    start(delay = 1000) {
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
                this.state = "can_move";
            }
        });
    }

    // Takes the ship out of play: hidden, and no longer steered or firing,
    // since both check for "can_move". Bullets already in flight carry on.
    leavePlay() {
        this.state = "removed";
        this.setVisible(false);
    }

    // Back in after losing a life: level, mid-height, flying in at once.
    respawn() {
        this.setPosition(START_X, this.scene.scale.height / 2);
        this.setVisible(true);
        this.bank_velocity = 0;
        this.bank = null;
        this.setBank("level", 0, true);
        this.start(0);
    }

    // True while the ship can be hit: in play, and the hit box overlaps rect.
    touches(rect) {
        if (this.state !== "can_move") {
            return false;
        }

        const box = new Geom.Rectangle(
            this.x + HIT_BOX.x * SHIP_SCALE,
            this.y + HIT_BOX.y * SHIP_SCALE,
            HIT_BOX.w * SHIP_SCALE,
            HIT_BOX.h * SHIP_SCALE
        );

        return Geom.Intersects.RectangleToRectangle(box, rect);
    }

    // Called every frame the fire input is held; the cooldown does the rest.
    fire(time) {
        if (this.state !== "can_move" || time < this.next_fire) {
            return;
        }

        this.next_fire = time + FIRE_INTERVAL;
        this.bullets.fire(this.x + MUZZLE_X, this.y + MUZZLE_Y);
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
        if (this.state !== "can_move") {
            return;
        }

        const step = delta / 1000;

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
            this.x + (this.target_x - this.x) * follow,
            half_w, this.scene.scale.width - half_w
        );
        this.y = PhaserMath.Clamp(
            this.y + (this.target_y - this.y) * follow,
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

        // The bank has played back to its first frame: show level.
        if (this.bank === "level" && !this.anims.isPlaying
            && this.anims.currentAnim.key !== "level") {
            this.play("level");
        }
    }

}
