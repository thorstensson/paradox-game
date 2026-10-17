## A. Set up (once)

1. File -> New: Color Mode Indexed, width and height both multiples of 8.
2. View -> Grid Settings: width 8, height 8. Then View -> Show Grid.
3. Layer -> New -> New Tilemap Layer (Space+N). Check its grid shows 8 x 8.

## B. Paint the tiles (Draw Pixels mode, sub-mode Auto, Space+2)

4. Repeating pieces (top/bottom rock band, middle of a platform): paint one
   cell, or a short row of cells, so its left edge matches its right edge --
   then it sits side by side with itself without a seam.
5. One-off objects (a skull): paint across as many cells as needed. Each cell
   becomes its own tile; fine, since the skull is always placed as a whole
   block.
6. Watch the tileset panel on the left while painting. Each new tile appears
   there. Tiles you didn't intend = a stroke changed a cell meant to be a copy.

## C. Lay out the level (Draw Tiles mode, Space+Tab)

Note (2026-10-17): Aseprite 1.3.18 exports only the tile images (File ->
Export -> Export Tileset), not where the tiles sit. A layout made here does
not carry over to Tiled by itself. Decided 2026-10-17: the station is rebuilt
in Tiled, traced from the exported PNG.

7. Click a tile in the tileset panel, then click cells on the canvas to stamp
   it. Repeat for the rock band along top and bottom, and platform pieces.
8. Multi-cell object (skull): select it with the Marquee tool, then
   hold Ctrl+Alt and drag: it makes a new copy you can drag into place; the
   slice numbers stay intact (tested by Thomas 2026-10-17). Check the tileset panel did not grow -- if it did,
   the paste made new tiles instead of reusing them.
9. Space+Tab back to Draw Pixels to touch up a tile; every copy of it changes
   with it.

## D. Check as you go

10. The tileset panel is the measure: few tiles = stamping works; a huge
    number = painting has crossed into cells meant to repeat.

## Canvas size (level 4, Station X)

Drawn at 3x in game, the ship's pixel: every object shares the same 3 px
block (updated 2026-10-17; the old 4x numbers are gone).

- The document: `src/assets/enviro/station-x/station-x.aseprite`, 4224 x 240.
- Height: 240 px (30 rows of 8). Playfield 1280 x 720 (800 minus the 40 px
  top band and the 40 px bottom band) / 3 = 240, exact.
- One screen of level: 1280 / 3 = about 427 px wide (53 1/3 tiles).
- Top band: NOT mirrored by the game for Station X -- the light runs bottom
  to top, so the whole height is painted.
- Width: a third of the level (repeated 3 times). At 422 px/s (StationTest)
  = about 140.7 canvas px per second at 3x, rounded to whole 8 px tiles:

| Level length | A third | Canvas (x 240 tall) |
|---|---|---|
| 90 s  | 30 s | 4224 px (528 tiles) -- the current document |
| 120 s | 40 s | 5624 px (703 tiles) |
| 150 s | 50 s | 7032 px (879 tiles) |

To do: time Ember Caves with a stopwatch, pick the closest row.
