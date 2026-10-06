import { Geom, Math as PhaserMath } from "phaser";
import { paintedBox } from "./FirecometTrack";

// Level 2, B1 (notes.md -> Level 2 Concepts -> Wave sequence): the dragon.
//
// A head and a tail of circles, each circle touching the one before, as
// painted in dragon.aseprite. It comes in from the right and swims slowly
// toward the ship on a sine, flame to flame, shutting off the way past.
//
// Like a snake: every circle passes through the very spot the head passed a
// moment before, so a bend in the head rolls down the body one joint after
// another. Every piece tilts to point along the curve.
//
// Only the head can kill it: 10 hits and the whole dragon blows, every piece
// at once. The circles soak up shots and shield the head.
//
// The numbers are a first pass, to be tuned by eye.

// 64x32 frames, drawn at 3x like every alien.
const DRAGON_SCALE = 3;

// Frame names in dragon.json: the head, then one circle, painted in the same
// spot they join in.
const HEAD_FRAME = "0";
const BODY_FRAME = "1";

// Circles behind the head.
const BODY_LENGTH = 9;

// Bullets the head soaks up before the dragon blows.
const HITS = 10;

// Score per piece when the dragon blows: 10 pieces, 2000.
const POINTS = 200;

// Toward the ship, px/s, right to left: half the slowest alien's speed.
const SPEED = 80;

// The steepest the curve gets, degrees: the head tilts no further than this.
// With the full flame-to-flame swing, it sets how long each wave is.
const MAX_TILT = 45;

// The tallest flame, screen px: 15 native rows of firecave.png at 5x.
const FLAME_REACH = 75;

// How close the head comes to the tallest flame at each turn, screen px.
const FLAME_GAP = 10;

// How far ahead and behind along the trail a piece looks to find which way
// it points, screen px.
const TILT_SPAN = 6;

export class DragonWave {

    scene = null;

    // Head first, then the circles, nearest first.
    pieces = [];

    // Where the head has been, newest first, as painted centres. The circles
    // are placed along it.
    trail = [];

    constructor(scene) {
        this.scene = scene;

        const width = scene.scale.width;
        const height = scene.cameras.main.height;

        const head_box = paintedBox(scene, "dragon", HEAD_FRAME);
        const body_box = paintedBox(scene, "dragon", BODY_FRAME);

        // Head's painted centre to the first circle's, and circle to circle,
        // along the trail, screen px: as painted, so they touch.
        this.head_gap = (centreX(body_box) - centreX(head_box)) * DRAGON_SCALE;
        this.body_gap = body_box.w * DRAGON_SCALE;
        this.tail_length = this.head_gap + (BODY_LENGTH - 1) * this.body_gap;

        // The swing: the head turns this far from the screen's top and
        // bottom.
        const top = FLAME_REACH + FLAME_GAP + (head_box.h * DRAGON_SCALE) / 2;
        this.middle = height / 2;
        this.swing = this.middle - top;

        // One full wave, screen px across: long enough that the curve is
        // never steeper than MAX_TILT.
        this.wavelength = (2 * Math.PI * this.swing) / Math.tan(PhaserMath.DegToRad(MAX_TILT));

        // Starts fully off the right edge, at the top of a wave.
        this.start_x = width + (head_box.w * DRAGON_SCALE) / 2;
        this.x = this.start_x;
        this.y = this.curveY(this.x);

        // Dropped once the last circle is fully past the left edge.
        this.end_x = -(body_box.w * DRAGON_SCALE) / 2;

        // Before it moves, the tail lies straight out to the right -- level,
        // like the top of the wave it starts on.
        this.trail = [
            { x: this.x, y: this.y },
            { x: this.x + this.tail_length + TILT_SPAN, y: this.y }
        ];

        this.pieces.push(this.makePiece(HEAD_FRAME, "dragon-head", head_box, 0));

        for (let i = 0; i < BODY_LENGTH; i++) {
            const behind = this.head_gap + i * this.body_gap;
            this.pieces.push(this.makePiece(BODY_FRAME, "dragon-circle", body_box, behind));
        }

        this.head = this.pieces[0];
        this.head.hits = HITS;

        this.place();
    }

    // Each piece turns about its own painted centre, not the frame's.
    makePiece(frame, tag, box, behind) {
        const piece = this.scene.add.sprite(0, 0, "dragon", frame);
        const source = piece.frame;
        piece.setScale(DRAGON_SCALE);
        piece.setOrigin(
            0.5 + centreX(box) / source.width,
            0.5 + centreY(box) / source.height
        );
        piece.play({ key: tag, repeat: -1 });
        piece.box = box;
        piece.behind = behind;

        return piece;
    }

    // Shot down, or flown off.
    get done() {
        return this.pieces.length === 0;
    }

    // The head's height at this x: a sine, top of the swing at the start.
    curveY(x) {
        const phase = ((this.start_x - x) / this.wavelength) * Math.PI * 2;
        return this.middle - this.swing * Math.cos(phase);
    }

    // Puts each piece's painted centre on the trail, its own distance behind
    // the head, pointing the way the trail runs there. The art faces left.
    place() {
        for (const piece of this.pieces) {
            const point = this.pointBehind(piece.behind);
            const ahead = this.pointBehind(Math.max(0, piece.behind - TILT_SPAN));
            const back = this.pointBehind(piece.behind + TILT_SPAN);

            piece.setPosition(point.x, point.y);
            piece.rotation = PhaserMath.Angle.Wrap(
                Math.atan2(ahead.y - back.y, ahead.x - back.x) - Math.PI
            );
        }
    }

    // The point on the trail this far behind the head, screen px.
    pointBehind(distance) {
        let left = distance;

        for (let i = 0; i < this.trail.length - 1; i++) {
            const a = this.trail[i];
            const b = this.trail[i + 1];
            const length = Math.hypot(b.x - a.x, b.y - a.y);

            if (left <= length) {
                const t = length === 0 ? 0 : left / length;
                return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
            }

            left -= length;
        }

        return this.trail[this.trail.length - 1];
    }

    // Forgets the trail beyond what the last circle needs.
    trimTrail() {
        const keep = this.tail_length + TILT_SPAN;
        let total = 0;

        for (let i = 0; i < this.trail.length - 1; i++) {
            const a = this.trail[i];
            const b = this.trail[i + 1];
            total += Math.hypot(b.x - a.x, b.y - a.y);

            if (total >= keep) {
                this.trail.length = i + 2;
                return;
            }
        }
    }

    // A piece's painted pixels on screen, centred on it. Not turned with
    // the piece -- a first pass.
    bounds(piece, rect = new Geom.Rectangle()) {
        const w = piece.box.w * DRAGON_SCALE;
        const h = piece.box.h * DRAGON_SCALE;

        return rect.setTo(piece.x - w / 2, piece.y - h / 2, w, h);
    }

    // True if any piece touches the ship. The dragon flies on.
    hits(player) {
        const rect = new Geom.Rectangle();

        return this.pieces.some((piece) => player.touches(this.bounds(piece, rect)));
    }

    update(_time, delta, bullets, explosions) {
        if (this.done) {
            return;
        }

        this.x -= SPEED * (delta / 1000);
        this.y = this.curveY(this.x);

        this.trail.unshift({ x: this.x, y: this.y });
        this.trimTrail();
        this.place();

        const tail = this.pieces[this.pieces.length - 1];

        if (tail.x < this.end_x) {
            this.pieces.forEach((piece) => piece.destroy());
            this.pieces = [];
            return;
        }

        // Every piece uses up the shots that touch it; only the head's count.
        for (const piece of this.pieces) {
            const rect = this.bounds(piece);
            const target = { active: true, visible: true, getBounds: () => rect };

            bullets.collide(target, () => {
                if (piece === this.head) {
                    this.head.hits--;
                }
            });
        }

        if (this.head.hits <= 0) {
            for (const piece of this.pieces) {
                explosions.spawn(piece.x, piece.y);
                this.scene.addPoints(POINTS);
                piece.destroy();
            }

            this.pieces = [];
        }
    }

}

// A painted box's centre, native px from the frame's centre.
function centreX(box) {
    return box.x + box.w / 2;
}

function centreY(box) {
    return box.y + box.h / 2;
}
