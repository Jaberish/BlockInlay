# Block Inlay

A React Native (Expo) block puzzle. A thousand boards, each with a set of pieces
that fills it — no piece left over, no square left empty, and exactly one way to
do it.

```
 ###      ##...##     .##.##.    .###.     ##...##    .####.
##..      #######     #######    ##.##     #######    ######
##..      ..###..     .#####.    ##.##     ##.#.##    ##..##
##..      #######     ..###..    #####     #######    ##..##
 ###      ##...##     ...#...    #####     .#####.    ######
                                 #####     .##.##.    .####.
Crescent  Butterfly   Heart      Padlock   Owl        Donut     … and 994 more
```

## Running it

```bash
npm install
```

```bash
npm start
```

Then press `i` for the iOS simulator, `a` for Android, or `w` for the browser —
or scan the QR code with Expo Go on a phone. `npm run ios` / `npm run android` /
`npm run web` skip straight to one platform.

## Playing

Pick a board from the level list. Then:

- **Drag** a piece from the tray onto the board. While you drag, a pale outline
  shows exactly where it will land; the piece rides above your finger so you can
  see it. Let go anywhere else and it goes back to the tray.
- **Move a placed piece** by dragging it again — to another spot, or back to the tray.
- **Tap** a placed piece to send it straight home.
- **Reset** starts the board over; the back arrow returns to the level list.

Pieces cannot be rotated, so every piece has exactly one home.

Solved boards are ticked in the level list and kept on the device, so they survive
closing the app. **Settings** (the gear in the level list) shows how many boards
are solved and can clear that progress — behind a confirmation, since it can't be
undone.

## The levels

The first 50 boards are drawn by hand and meant to look like something — a heart,
a cat, a key, an anchor. The other 950 are generated. Their silhouettes are
abstract, but they are held to filters calibrated so that all 50 drawn boards
clear them, so they read as deliberate shapes rather than blobs.

Levels are ordered by a difficulty score: how many piece placements a solver has
to try before it has proved the board has exactly one solution. It is measured,
not guessed, and the labels are cut from it — so a level's difficulty follows from
the puzzle rather than from where it sits in the list.

| | drawn | generated | all |
| --- | --- | --- | --- |
| boards | 50 | 950 | 1000 |
| score | 3 – 240 | 18 – 690 | 3 – 690 |
| cells | 12 – 35 | 18 – 46 | 12 – 46 |
| pieces | 3 – 9 | 4 – 9 | 3 – 9 |

Every one of them satisfies three properties, and none is taken on trust:

```bash
npm run verify-levels
```

That exhaustively searches every legal placement of every piece on every board,
and fails unless each one is covered exactly — same number of cells as the pieces
supply — by precisely one arrangement, with the difficulty score the data records
matching the one the search actually produces. It is deliberately written as a
plain, slow, `Set`-of-strings solver rather than sharing the generator's bitmask
one: it is the independent check on the generator, so it does not share its code.
The rules of dropping and snapping have their own checks, run against all 1000
boards:

```bash
npm test
```

## Layout

Nothing outside the level data knows about any particular level: the board sizes,
piece counts, tray layout, menu thumbnails and level order are all derived.

| file | what's in it |
| --- | --- |
| [src/levels.ts](src/levels.ts) | types, difficulty bands, and assembling both packs |
| [src/handmade.ts](src/handmade.ts) | the 50 drawn boards, as `#` patterns |
| [src/generated.ts](src/generated.ts) | the 950 generated boards, one per line |
| [src/placement.ts](src/placement.ts) | pure rules: what fits where, what a drop snaps to |
| [src/progress.ts](src/progress.ts) | which boards are solved, saved on the device |
| [src/MenuScreen.tsx](src/MenuScreen.tsx) | the level list, with each board drawn as its tile |
| [src/GameScreen.tsx](src/GameScreen.tsx) | board, tray, and the drag gestures |
| [src/SettingsScreen.tsx](src/SettingsScreen.tsx) | progress summary and resetting it |
| [src/Blocks.tsx](src/Blocks.tsx) | how a group of squares is drawn |
| [scripts/generate-levels.mjs](scripts/generate-levels.mjs) | writes the generated pack |
| [scripts/verify-levels.mjs](scripts/verify-levels.mjs) | proves every level has one perfect solution |
| [scripts/test-placement.mjs](scripts/test-placement.mjs) | checks the drop/snap rules |

## Adding a drawn board

Add an entry to `HANDMADE` in [src/handmade.ts](src/handmade.ts) — a name, the
board drawn with `#`, the pieces drawn the same way, and the difficulty score.
Then run `npm run verify-levels`, which will tell you the real score if the one
you guessed is wrong, and adjust the pieces until it reports one solution.
Nothing else needs to change: the menu, the board and the tray all size
themselves from the data.

Two things worth knowing when inventing a board. Narrow necks and single-cell tips
make a board *easier*, because they force placements; wide open areas make it
harder, because pieces can slide. And shapes that are one cell wide in a loop or
stem — a key, a letter "A" — cannot be cut into 4- and 5-cell pieces at all.

Finding a cut by hand is tedious, so the generator's solver will do it: it can
search thousands of ways to carve a board and keep the ones with a single
solution. That is how the drawn boards got their pieces — the silhouettes are
hand-drawn, the cuts are not.

## Regenerating the pack

```bash
npm run generate-levels
```

That rewrites [src/generated.ts](src/generated.ts) from scratch. It is
deterministic — the same seed gives the same 1000 levels — but changing the seed
or the parameters renames every generated level, which throws away saved progress
on boards that no longer exist under the same name.

It works by growing a large pool of candidates and then choosing the pack from it.
Boards come from a dozen silhouette families rather than pure noise; pieces are
cut by randomised partitioning and kept only when the cut happens to be uniquely
solvable *and* demands real search, since a level whose every step is forced is a
fitting exercise rather than a puzzle. Left alone, random cuts pile up at the easy
end — two thirds of everything the generator finds needs under 40 placements — so
the pack is chosen against a geometric ramp of target difficulties rather than
skimmed off the pool, with no silhouette used twice and no family allowed to run
away with the list.
