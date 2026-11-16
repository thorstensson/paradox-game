// The game's sound effects (Thomas's retro 16-bit library, src/assets/audio):
// 16-bit mono 44.1 kHz WAV, which every browser plays. Loaded with the art
// (preloader.js); each plays from where its event happens.
//
// Browsers keep a page silent until its first click. CLICK TO START is that
// click, and Phaser unmutes itself on it.
//
// First pass, 2026-11-16: everything is trial and error, to tune by playing.

import playerRailgunUrl from "./assets/audio/player-railgun.wav?url";
import playerMissileUrl from "./assets/audio/player-missile.wav?url";
import stationxGunsUrl from "./assets/audio/stationx-guns.wav?url";
import enemyExplosionUrl from "./assets/audio/enemy-explosion.wav?url";
import playerExplosionUrl from "./assets/audio/player-explosion.wav?url";
import playerPowerupUrl from "./assets/audio/player-powerup.wav?url";
import extraLifeUrl from "./assets/audio/extra-life.wav?url";
import endbossAlertUrl from "./assets/audio/endboss-alert.wav?url";
import yellowEnemyUrl from "./assets/audio/yellow-enemy.wav?url";

// Each sound by its key (the file's name), with its volume, 0 to 1.
//
// player-railgun: every time the ship fires its bullets (Player.fire), once
//   for the two or three that leave together.
// player-missile: every missile the ship fires (Missiles.launch).
// stationx-guns: every bullet from Station X's guns, the diamond gun, the
//   vulcan pods (Station.js) and the boss's guns (Boss.fire), once for the
//   guns that fire together.
// enemy-explosion: every kill (Explosions.spawn).
// yellow-enemy: the odd neutron shot, the one that takes points away, in
//   place of enemy-explosion (NeutronWave.spawn).
// player-explosion: the ship blowing up, in its place (MainScene.shipHit).
// player-powerup: a power-up caught (PowerUps.update).
// extra-life: the extra ship at 25000 (MainScene.addLife).
// endboss-alert: as the station starts slowing to its stop, about 2 s before
//   the boss slides in (Station.update).
const SOUNDS = {
    "player-railgun": { url: playerRailgunUrl, volume: 1 },
    "player-missile": { url: playerMissileUrl, volume: 1 },
    "stationx-guns": { url: stationxGunsUrl, volume: 1 },
    "enemy-explosion": { url: enemyExplosionUrl, volume: 1 },
    "player-explosion": { url: playerExplosionUrl, volume: 1 },
    "player-powerup": { url: playerPowerupUrl, volume: 1 },
    "extra-life": { url: extraLifeUrl, volume: 1 },
    "endboss-alert": { url: endbossAlertUrl, volume: 1 },
    "yellow-enemy": { url: yellowEnemyUrl, volume: 1 }
};

export function loadSounds(scene) {
    for (const [ key, { url } ] of Object.entries(SOUNDS)) {
        scene.load.audio(key, url);
    }
}

// One play of the sound; several can overlap.
export function playSound(scene, key) {
    scene.sound.play(key, { volume: SOUNDS[key].volume });
}
