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

7. Click a tile in the tileset panel, then click cells on the canvas to stamp
   it. Repeat for the rock band along top and bottom, and platform pieces.
8. Multi-cell object (skull): select it with the Rectangular Marquee, copy and
   paste it where wanted. Check the tileset panel did not grow -- if it did,
   the paste made new tiles instead of reusing them.
9. Space+Tab back to Draw Pixels to touch up a tile; every copy of it changes
   with it.

## D. Check as you go

10. The tileset panel is the measure: few tiles = stamping works; a huge
    number = painting has crossed into cells meant to repeat.

## Canvas size (level 4)

Drawn at 4x in game: our 1280 x 800 canvas is exactly 4x the C64's 320 x 200,
so the tiles get Nemesis's C64 proportions.

- Height: 192 px (24 rows of 8). Playfield 760 / 4 = 190; the last 2 px fall
  just below the screen edge.
- One screen of level: 1280 / 4 = 320 px wide (40 tiles).
- Top band: leave its rows empty -- the game fills them with the bottom band
  flipped upside down (as the fire cave does). Paint the bottom band and the
  middle pieces.
- Width: a third of the level (stamped, then repeated 3 times). At the fire
  cave's speed, 422 px/s = about 105.5 canvas px per second at 4x, rounded
  to whole 8 px tiles:

| Level length | A third | Canvas (x 192 tall) |
|---|---|---|
| 90 s  | 30 s | 3168 px (396 tiles) |
| 120 s | 40 s | 4224 px (528 tiles) |
| 150 s | 50 s | 5280 px (660 tiles) |

To do: time Ember Caves with a stopwatch, pick the closest row.
