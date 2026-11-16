// The HTML loader in index.html (Thomas, 2026-11-16): the C64-style text
// top left and the splash centred, shown from the moment the page opens.
// The preloader counts the percentage up as the game loads; at 100% the text
// and splash fade away together, then the game fades in.

// The loader's fade, ms: the same as its transition in style.css.
const FADE_MS = 500;

// progress: 0 to 1.
export function setLoaderProgress(progress) {
    const percent = document.getElementById("loader-percent");

    if (percent) {
        percent.textContent = String(Math.round(progress * 100));
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
