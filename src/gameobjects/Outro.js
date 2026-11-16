// The outro, once the boss is dead (Thomas, 2026-11-15): the journey home.
//
// 1. The game takes the ship (Player.takeOver): no mouse, no firing, nothing
//    can hit it, and it glides to the middle height.
// 2. The station moves out to the left, slower than in the level
//    (Station.leave), and is gone once its end is off the left edge.
// 3. Stars only, STARS_ONLY_MS: 1.5 screen widths at the level's pace.
// 4. The planet, saturn, slides in slowly from the right and eases to a stop
//    with its middle on the right edge: about half of it on screen, the rest
//    off past the edge. It keeps turning (saturn-loop). The stars slow down
//    with it, to STAR_PACE of their speed by the time it stops.
// 5. Once it has stopped, the ship flies right, across it, and off the right
//    edge.
// 6. The words fade in, left of the planet, and stay. As they start, the
//    credits scroll along the bottom, right to left.
// 7. Once the credits are off the left edge, the game ends
//    (MainScene.endOutro).
//
// Speeds and times are placeholders to tune by playing.

import { entryFor } from "../hiscores";

// The ship's pixel size, as everything in the game.
const SCALE = 3;

// The planet's texture key (preloader.js) and its looping tag.
const PLANET_KEY = "saturn";
const PLANET_ANIM = "saturn-loop";

// Stars only, between the station being gone and the planet coming in, ms:
// 1.5 screen widths (1920 px) at the level's 300 px/s (Station.js SPEED).
const STARS_ONLY_MS = 1920 / 300 * 1000;

// The planet's slide in, ms, easing to a stop as it arrives.
const PLANET_MS = 8000;

// The stars' speed once the planet has stopped, a fraction of their own.
const STAR_PACE = 0.25;

// In front of the stars (StarField, -5), behind the station (-1) and the ship.
const PLANET_DEPTH = -2;

// From the planet stopping to the ship flying off, and the fly-off itself, ms.
const FLY_OFF_DELAY = 500;
const FLY_OFF_MS = 2000;

// The words once the ship is gone (Thomas, 2026-11-15), as the level titles
// are drawn (MainScene.showLevelTitle): main-font at 24, each line centred,
// 9 px between lines, faded in over TEXT_FADE ms. Centred on a third of the
// screen across (his pick B), shifted left for a movie-title feel and clear
// of the planet: the longest line is 384 px, 235-619, and the planet's
// leftmost painted pixel stops at 635. It stays up.
//
// Two parts (Thomas, 2026-11-15): the second fades in TEXT_GAP ms after the
// first has fully appeared, an empty line below it, every line where it
// would be in one block.
const TEXT_FIRST = "PARADOX MISSION\nCOMPLETE!";
const TEXT_SECOND = "THE AURORIANS\nARE IN YOUR DEBT";
const TEXT_CENTRE = 1 / 3;
const TEXT_FADE = 500;
const TEXT_GAP = 1000;
const TEXT_SIZE = 24;
const LINE_SPACING = 9;

// The credits (Thomas, 2026-11-16): one line in the lilac hud-font at 24,
// scrolling right to left along the bottom of the playfield, just above the
// power-up band, fast, retro style. In from past the right edge as the words
// start to fade in; once it is fully off the left edge, the game ends as at
// GAME OVER: the name entry if the score goes on the table, or the intro
// (MainScene.endOutro). Moved in whole px. Speed: a placeholder to tune by
// eye.
const CREDITS = "ALL GRAPHICS AND GAMEPLAY BY THOMAS THORSTENSSON. "
    + "CODE BY THOMAS THORSTENSSON AND CLAUDE OPUS. "
    + "CREDITS: AUDIO FX - MARK SHEEKY. "
    + "SHOUTOUT TO THALAMUS GAMES, HEWSON, RAINBOW ARTS, ELECTRIC DREAMS - C64!";
const CREDITS_SPEED = 480;

// From the bottom of the playfield to the bottom of the credits, px.
const CREDITS_BOTTOM = 12;

export class Outro {

    scene = null;
    station = null;
    player = null;
    planet = null;

    // leaving: the station moves out; stars: stars only; arriving: the planet
    // slides in; stopped: it has stopped, the ship flies off.
    state = "leaving";

    constructor(scene, station, player) {
        this.scene = scene;
        this.station = station;
        this.player = player;

        player.takeOver(scene.cameras.main.height / 2);
        station.leave();
    }

    update() {
        // The station is gone: stars only, then the planet.
        if (this.state === "leaving" && this.station.gone) {
            this.state = "stars";
            this.scene.time.delayedCall(STARS_ONLY_MS, () => this.planetIn());
        }
    }

    // In from fully off the right edge, easing to a stop with its middle on
    // the edge, the stars slowing with it.
    planetIn() {
        const scene = this.scene;
        const width = scene.scale.width;

        this.state = "arriving";

        const planet = scene.add.sprite(0, scene.cameras.main.height / 2, PLANET_KEY)
            .setScale(SCALE)
            .setDepth(PLANET_DEPTH);
        planet.x = width + planet.displayWidth / 2;
        planet.play({ key: PLANET_ANIM, repeat: -1 });
        this.planet = planet;

        // Moved in whole screen px, so its pixels stay on the ship's grid.
        const slide = { x: planet.x };

        scene.tweens.add({
            targets: slide,
            x: width,
            duration: PLANET_MS,
            ease: "Sine.easeOut",
            onUpdate: () => {
                planet.x = Math.round(slide.x);
            },
            onComplete: () => {
                planet.x = width;
                this.state = "stopped";
                scene.time.delayedCall(FLY_OFF_DELAY, () => this.flyOff());
            }
        });

        scene.tweens.add({
            targets: scene.star_field,
            pace: STAR_PACE,
            duration: PLANET_MS,
            ease: "Sine.easeOut"
        });
    }

    // The credits, from fully off the right edge to fully off the left, at
    // CREDITS_SPEED; then the game ends.
    scrollCredits() {
        const scene = this.scene;
        const credits = scene.add.bitmapText(0, 0, "hud-font", CREDITS, TEXT_SIZE).setOrigin(0, 1);
        const from = scene.scale.width;
        const to = -credits.width;

        credits.setPosition(from, scene.cameras.main.height - CREDITS_BOTTOM);

        // Asked now, so the answer is in by the time the credits are gone.
        const entry = entryFor(scene.points);
        const scroll = { x: from };

        scene.tweens.add({
            targets: scroll,
            x: to,
            duration: (from - to) / CREDITS_SPEED * 1000,
            ease: "Linear",
            onUpdate: () => {
                credits.x = Math.round(scroll.x);
            },
            onComplete: () => scene.endOutro(entry)
        });
    }

    // Right, across the planet, and fully off past the right edge.
    flyOff() {
        const player = this.player;

        this.scene.tweens.add({
            targets: player,
            x: this.scene.scale.width + player.displayWidth,
            duration: FLY_OFF_MS,
            ease: "Sine.easeIn",
            onComplete: () => this.showText()
        });
    }

    // The words at the middle height, centred on TEXT_CENTRE of the screen
    // across: the first part fades in, then, TEXT_GAP ms after it is fully
    // up, the second. Placed on whole px so every brick of the font stays
    // even.
    showText() {
        const scene = this.scene;
        const centre_x = scene.scale.width * TEXT_CENTRE;
        const block = (content) => scene.add.bitmapText(0, 0, "main-font", content, TEXT_SIZE)
            .setOrigin(0, 0)
            .setCenterAlign()
            .setLineSpacing(LINE_SPACING);

        // The whole text as one block, only to measure where it sits.
        const whole = block(`${TEXT_FIRST}\n\n${TEXT_SECOND}`);
        const top = Math.round(scene.cameras.main.height / 2 - whole.height / 2);

        whole.destroy();

        const first = block(TEXT_FIRST).setAlpha(0);
        const second = block(TEXT_SECOND).setAlpha(0);

        // The second part three lines down: the first part's two and the
        // empty one.
        const lines_before = TEXT_FIRST.split("\n").length + 1;

        first.setPosition(Math.round(centre_x - first.width / 2), top);
        second.setPosition(
            Math.round(centre_x - second.width / 2),
            top + lines_before * (TEXT_SIZE + LINE_SPACING)
        );

        // PAUSED shows near the same spot: the words step aside while it is
        // up, as the level titles do.
        const hide = () => {
            first.setVisible(false);
            second.setVisible(false);
        };
        const show = () => {
            first.setVisible(true);
            second.setVisible(true);
        };

        scene.events.on("pause", hide);
        scene.events.on("resume", show);
        scene.events.once("shutdown", () => {
            scene.events.off("pause", hide);
            scene.events.off("resume", show);
        });

        this.scrollCredits();

        scene.tweens.add({
            targets: first,
            alpha: 1,
            duration: TEXT_FADE,
            onComplete: () => {
                scene.tweens.add({
                    targets: second,
                    alpha: 1,
                    duration: TEXT_FADE,
                    delay: TEXT_GAP
                });
            }
        });
    }

}
