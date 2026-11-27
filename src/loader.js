// The HTML loader in index.html (Thomas, 2026-11-27): the splash shows,
// centred, from the start while the game loads. When all is loaded the
// splash holds 3 s, then the loader fades away and the game fades in.

// The loader's fade, ms: the same as its transition in style.css.
const FADE_MS = 500;

// The splash's hold, ms (Thomas).
const SPLASH_MS = 3000;

// The dashed line below the splash, filled from left to right by the load's
// progress (0 to 1).
export function setLoaderLine(progress) {
    const line = document.getElementById("loader-line");

    if (line) {
        line.style.width = progress * 100 + "%";
    }
}

// Holds the splash, then calls done.
export function holdSplash(done) {
    const splash = document.getElementById("loader-splash");

    if (!splash) {
        done();
        return;
    }

    const hold = () => setTimeout(done, SPLASH_MS);

    // Waits for the splash picture, so the hold is never on an empty screen.
    // A picture that fails to load still moves on.
    if (splash.complete) {
        hold();
    } else {
        splash.addEventListener("load", hold, { once: true });
        splash.addEventListener("error", hold, { once: true });
    }
}

// Fades the loader away and removes it, then calls done.
export function fadeOutLoader(done) {
    const loader = document.getElementById("loader");

    if (!loader) {
        done();
        return;
    }

    loader.classList.add("gone");

    setTimeout(() => {
        loader.remove();
        done();
    }, FADE_MS);
}
