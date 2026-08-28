# Block Inlay

A React Native (Expo) block puzzle. Five thousand boards, each with a set of
pieces that fills it — no piece left over, no square left empty, and exactly one
way to do it.

```
 ###      ##...##     .##.##.    .###.     ##...##    .####.
##..      #######     #######    ##.##     #######    ######
##..      ..###..     .#####.    ##.##     ##.#.##    ##..##
##..      #######     ..###..    #####     #######    ##..##
 ###      ##...##     ...#...    #####     .#####.    ######
                                 #####     .##.##.    .####.
Crescent  Butterfly   Heart      Padlock   Owl        Donut     … and 4,994 more
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
- **Hint** (the clock button) drops one piece into its true home, moving anything
  in the way back to the tray. You hold three; one comes back every hour, and the
  ring around the button shows how far along that hour is.
- **Reset** (the ↻ button) starts the board over; the back arrow returns to the
  level list. **Continue** appears when the board is finished.

Pieces cannot be rotated, so every piece has exactly one home.

Music loops while you play, and a chime marks a finished board — the music ducks
under it for a moment so it can actually be heard. Both can be switched off in
Settings. Solved boards are ticked in the level
list and kept on the device, so they survive closing the app; the list reopens at
the furthest board you have finished rather than back at level one, and the bar
down the right edge can be dragged to fly through five thousand of them.

**Settings** (the gear in the level list) switches the music and the sound effects
off, shows how many boards are solved, and can clear that progress — behind a
confirmation, since it can't be undone.

## The levels

The first 200 boards are drawn by hand and meant to look like something — a heart,
a cat, a key, an anchor, a windmill. They carry names. The other 4,800 are
generated and go by their number: their silhouettes are deliberate abstract
shapes rather than pictures of things, so an invented name would claim more than
they deliver. They are held to filters calibrated so that all 200 drawn boards
clear them, which is what keeps them looking drawn rather than spilled.

200 is close to the ceiling for the drawn ones. In a 10x10 grid at 18-46 cells
there are only so many shapes that genuinely read as an object; past that, drawing
produces "blob that was meant to be a lamp", which is worse than a clean abstract
shape because it visibly fails at something the abstract one never promised.

Levels are ordered by a difficulty score: how many piece placements a solver has
to try before it has proved the board has exactly one solution. It is measured,
not guessed, and the labels are cut from it — so a level's difficulty follows from
the puzzle rather than from where it sits in the list.

| | drawn | generated | all |
| --- | --- | --- | --- |
| boards | 200 | 4,800 | 5,000 |
| score | 3 – 420 | 18 – 4,215 | 3 – 4,215 |
| cells | 12 – 35 | 18 – 49 | 12 – 49 |
| pieces | 3 – 9 | 4 – 9 | 3 – 9 |

Five thousand costs about 600 KB of level data and, because only the scores are
read at launch, none of it is parsed until a board is actually opened — building
all 5,000 up front would cost around 45 ms on a laptop and several times that on
a phone, for work almost all of which nobody ever looks at.

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
The rules of dropping and snapping have their own checks, run against all 5,000
boards, alongside the parts that can be wrong without ever throwing: the level
list's arithmetic, whether every board still fits on a small phone, the hint
refill, and the id round-trip that saved progress depends on.

```bash
npm test
```

## Layout

Nothing outside the level data knows about any particular level: the board sizes,
piece counts, tray layout, menu thumbnails and level order are all derived.

| file | what's in it |
| --- | --- |
| [src/levels.ts](src/levels.ts) | types, difficulty bands, and assembling both packs |
| [src/handmade.ts](src/handmade.ts) | the 200 drawn boards, as `#` patterns |
| [src/generated.ts](src/generated.ts) | the 4,800 generated boards, one per line |
| [src/solve.ts](src/solve.ts) | the one arrangement that fills a board — what a hint points at |
| [src/hintBank.ts](src/hintBank.ts) | hints held and the hourly refill, as plain arithmetic |
| [src/hints.ts](src/hints.ts) | that bank, kept on the device |
| [src/settings.ts](src/settings.ts) | preferences, kept on the device |
| [src/music.ts](src/music.ts) | the looping background track, and ducking it for the chime |
| [src/menuLayout.ts](src/menuLayout.ts) | where every tile, heading and scrollbar drag lands |
| [src/gameLayout.ts](src/gameLayout.ts) | sizing a board and its tray to the screen |
| [src/HintButton.tsx](src/HintButton.tsx) | the hint count and its refill clock |
| [src/placement.ts](src/placement.ts) | pure rules: what fits where, what a drop snaps to |
| [src/progress.ts](src/progress.ts) | which boards are solved, saved on the device |
| [src/MenuScreen.tsx](src/MenuScreen.tsx) | the level list, with each board drawn as its tile |
| [src/GameScreen.tsx](src/GameScreen.tsx) | board, tray, and the drag gestures |
| [src/SettingsScreen.tsx](src/SettingsScreen.tsx) | progress summary and resetting it |
| [src/Blocks.tsx](src/Blocks.tsx) | how a group of squares is drawn |
| [scripts/generate-levels.mjs](scripts/generate-levels.mjs) | writes the generated pack |
| [scripts/make-sound.mjs](scripts/make-sound.mjs) | synthesises the finish chime |
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

That rewrites [src/generated.ts](src/generated.ts) from scratch, in about seven
minutes. It is deterministic — the same seed gives the same 4,800 levels — but
changing the seed or the parameters reshuffles which puzzle sits at which number,
and saved progress is keyed by number, so it stops meaning anything.

It works by growing a large pool of candidates and then choosing the pack from it.
Boards come from a dozen silhouette families rather than pure noise; pieces are
cut by randomised partitioning and kept only when the cut happens to be uniquely
solvable *and* demands real search, since a level whose every step is forced is a
fitting exercise rather than a puzzle. Left alone, random cuts pile up at the easy
end — two thirds of everything the generator finds needs under 40 placements — so
the pack is chosen against a geometric ramp of target difficulties rather than
skimmed off the pool, with no silhouette used twice and no family allowed to run
away with the list.

Scale is the thing that bites here, and not for the reason you would expect. The
bytes are cheap; what runs out is *shapes*. The narrow families — kites, spires,
vaults — have only a few dozen parameter combinations between them, so a pack of
a few hundred can be drawn from the best of what they make, while a pack of
thousands scrapes them empty and leans on whatever the abundant families produce.
An earlier build of the generator could only find 4,374 boards for a 4,800-board
pack, and the ones it did find were *easier* on average, because filling the list
meant taking more from the abundant shallow end. The fix was to give every family
a way to vary: shapes now get shaved symmetrically before they are filtered, which
multiplies each family's supply without turning it into noise, since the filters
still get the last word. That is what makes 4,800 distinct silhouettes reachable
with the difficulty ramp intact rather than flattened.

The finish chime is generated too, for the same reason the levels are — so it is
reviewable as code rather than an opaque binary:

```bash
npm run make-sound
```
