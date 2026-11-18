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
// 6. The words fade in, left of the planet.
// 7. They hold END_HOLD and fade out. The credits follow at the same spot,
//    one section at a time: each fades in, holds SECTION_HOLD and fades out.
// 8. The last section holds LAST_HOLD, then it and the planet fade out and
//    the game ends (MainScene.endOutro).
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

// The words hold this long once fully up, then fade out and the credits come
// in. The credits scroll that ended it for a while is gone (Thomas:
// distracting).
const END_HOLD = 8000;

// The words fade out over this, ms, and at the end the credits and the
// planet: the intro's FADE_MS (MenuScene.js).
const END_FADE = 500;

// The credits (Thomas, 2026-11-18): four sections, one at a time, each at the
// words' spot (centred on TEXT_CENTRE across and on the middle height).
// Each fades in over TEXT_FADE, holds SECTION_HOLD and fades out over
// END_FADE, then the next comes in.
const CREDITS = [
    "Graphics:\nThomas Thorstensson",
    "Programming:\nThomas Thorstensson\nOpus",
    "Credits\nAudio FX:\nMark Sheeky",
    "Explosion FX:\nSentient Dream Studio"
];
const SECTION_HOLD = 2000;

// The last section holds this long, then it and the planet fade out and the
// game ends as at GAME OVER: the name entry if the score goes on the table,
// or the intro (MainScene.endOutro; Thomas, 2026-11-16).
const LAST_HOLD = 2000;

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

    // The words, centred on TEXT_CENTRE of the screen across. Once they have
    // held END_HOLD, they fade out and the credits come in.
    showText() {
        const scene = this.scene;

        this.showParts(TEXT_FIRST, TEXT_SECOND, scene.scale.width * TEXT_CENTRE, (parts, remove) => {
            // Asked now, so the answer is in by the end of the credits.
            const entry = entryFor(scene.points);

            scene.time.delayedCall(END_HOLD, () => {
                scene.tweens.add({
                    targets: parts,
                    alpha: 0,
                    duration: END_FADE,
                    onComplete: () => {
                        remove();
                        this.showCredits(entry);
                    }
                });
            });
        });
    }

    // One credits section at the words' spot, each line centred: it fades in,
    // holds SECTION_HOLD and fades out, then the next comes in. The last
    // holds LAST_HOLD and fades out together with the planet before the
    // hand-back, as the intro's screens do (Thomas, 2026-11-17). Placed on
    // whole px so every brick of the font stays even.
    showCredits(entry, index = 0) {
        const scene = this.scene;
        const last = index === CREDITS.length - 1;

        const section = scene.add.bitmapText(0, 0, "main-font", CREDITS[index], TEXT_SIZE)
            .setOrigin(0, 0)
            .setCenterAlign()
            .setLineSpacing(LINE_SPACING)
            .setAlpha(0);

        section.setPosition(
            Math.round(scene.scale.width * TEXT_CENTRE - section.width / 2),
            Math.round(scene.cameras.main.height / 2 - section.height / 2)
        );

        // PAUSED shows near the same spot: the section steps aside while it
        // is up, as the words do.
        const hide = () => section.setVisible(false);
        const show = () => section.setVisible(true);
        const unhook = () => {
            scene.events.off("pause", hide);
            scene.events.off("resume", show);
        };

        scene.events.on("pause", hide);
        scene.events.on("resume", show);
        scene.events.once("shutdown", unhook);

        scene.tweens.add({
            targets: section,
            alpha: 1,
            duration: TEXT_FADE,
            onComplete: () => {
                scene.time.delayedCall(last ? LAST_HOLD : SECTION_HOLD, () => {
                    scene.tweens.add({
                        targets: last ? [ section, this.planet ] : section,
                        alpha: 0,
                        duration: END_FADE,
                        onComplete: () => {
                            if (last) {
                                scene.endOutro(entry);
                                return;
                            }

                            unhook();
                            scene.events.off("shutdown", unhook);
                            section.destroy();
                            this.showCredits(entry, index + 1);
                        }
                    });
                });
            }
        });
    }

    // Two parts of text at the middle height, each line centred on centre_x:
    // the first fades in, then, TEXT_GAP ms after it is fully up, the second,
    // an empty line below it, every line where it would be in one block.
    // Placed on whole px so every brick of the font stays even. Once the
    // second is fully up, onUp gets both parts and a function that takes
    // them away.
    showParts(text_first, text_second, centre_x, onUp) {
        const scene = this.scene;
        const block = (content) => scene.add.bitmapText(0, 0, "main-font", content, TEXT_SIZE)
            .setOrigin(0, 0)
            .setCenterAlign()
            .setLineSpacing(LINE_SPACING);

        // The whole text as one block, only to measure where it sits.
        const whole = block(`${text_first}\n\n${text_second}`);
        const top = Math.round(scene.cameras.main.height / 2 - whole.height / 2);

        whole.destroy();

        const first = block(text_first).setAlpha(0);
        const second = block(text_second).setAlpha(0);

        // The second part below the first part's lines and the empty one.
        const lines_before = text_first.split("\n").length + 1;

        first.setPosition(Math.round(centre_x - first.width / 2), top);
        second.setPosition(
            Math.round(centre_x - second.width / 2),
            top + lines_before * (TEXT_SIZE + LINE_SPACING)
        );

        // PAUSED shows near the same spot: the text steps aside while it is
        // up, as the level titles do.
        const hide = () => {
            first.setVisible(false);
            second.setVisible(false);
        };
        const show = () => {
            first.setVisible(true);
            second.setVisible(true);
        };
        const unhook = () => {
            scene.events.off("pause", hide);
            scene.events.off("resume", show);
        };

        scene.events.on("pause", hide);
        scene.events.on("resume", show);
        scene.events.once("shutdown", unhook);

        const remove = () => {
            unhook();
            scene.events.off("shutdown", unhook);
            first.destroy();
            second.destroy();
        };

        scene.tweens.add({
            targets: first,
            alpha: 1,
            duration: TEXT_FADE,
            onComplete: () => {
                scene.tweens.add({
                    targets: second,
                    alpha: 1,
                    duration: TEXT_FADE,
                    delay: TEXT_GAP,
                    onComplete: () => onUp([ first, second ], remove)
                });
            }
        });
    }

}
