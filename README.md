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

Pick a board from the level list. The first one explains the game by writing on
itself: a dashed arrow curving up out of the tray under *Drag a piece onto the
board*, then, once one is down, the same arrow turned back towards the tray under
*Tap a piece to send it back*, and finally the rule of the game with an arrow up
at the hint clock. Each mark is answered by doing the thing, and doing it is what
moves the lesson on, so nobody is told something they have already worked out.
Nothing is dismissed and nothing blocks the board — the marks take no touches, so
the board is playable straight through them. Then:

- **Drag** a piece from the tray onto the board. While you drag, a pale outline
  shows exactly where it will land; the piece rides above your finger so you can
  see it. Let go anywhere else and it goes back to the tray.
- **Move a placed piece** by dragging it again — to another spot, or back to the tray.
- **Tap** a placed piece to send it straight home.
- **Hint** (the clock button) drops one piece into its true home, moving anything
  in the way back to the tray. You hold three; one comes back every hour, and the
  ring around the button shows how far along that hour is. On a board you have
  already finished the hints are free and unlimited — it says so beside the
  clock, which reads ∞ — because the bank is there to make hints cost something
  on a board that still counts.
- **Reset** (the ↻ button) starts the board over; the back arrow returns to the
  level list. **Continue** appears when the board is finished.

Pieces cannot be rotated, and there is only one way to fill a board — so the
finished picture is settled before you start. Where a board uses two pieces of
the same shape either one can take either home, but it is the same picture
whichever way round they go.

The tray, though, is dealt in a shuffled order. Pieces are stored in the order
they were cut off the board, and both packs cut by repeatedly taking the first
empty square in reading order — so dealt as written, the tray was the answer
spelled out left to right, and the game was "take the next one". The shuffle is
drawn from the level's id, so a board deals the same tray every time you open it,
and no board is ever dealt in an order you could not tell from the written one.

Every other order is equally likely, so on roughly one board in *n* the leading
piece really is the one that fills the top-left square. That is the deal being
random rather than a pattern to spot: forbidding it would tell you the top-left
piece is one of the other eight, which is worth more to you than the coincidence
it removes.

Music loops while you play, and a chime marks a finished board — the music ducks
under it for a moment so it can actually be heard. Both can be switched off in
Settings. Solved boards are ticked in the level list and kept on the device, so
they survive closing the app. The list opens beside the board you are on — the
last one you opened, or, before you have opened any, wherever your progress left
you — rather than back at level one, and once it is longer than the screen the
bar down the right edge can be dragged to fly through it.

The list holds what you have played, the board you are on, and two more with
their faces down. Five thousand boards is not an invitation but a wall, and a
list that opened on every one of them would say "here is everything you have not
done" rather than "here is the next one". The two locked tiles are what say the
list keeps going. On the web build, `?debug` in the address bar opens all five
thousand — it is how the far end of the list gets looked at without playing
there, and the one platform where a switch can be flicked without a build.

**Settings** (the gear in the level list) switches the music and the sound effects
off, and can clear your progress — behind a confirmation, since it can't be undone.

Every ten levels the whole app changes colour, and the level list wears the
colours of the board you are on. Soft shapes drift behind everything in a
second colour of that chapter's own; they hold still if the device asks for
reduced motion.

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

The opening handful are ordered by hand. They all score the same, so the score has
nothing to say about which of them comes first, and the first board is the one
that has to teach the game: it wants a silhouette that reads at a glance and
pieces whose homes are obvious. That is the boat.

The two packs are labelled with different words — Warm-up · Easy · Medium · Hard ·
Expert for the drawn boards, Steady · Tricky · Thorny · Punishing · Relentless for
the generated ones — because each ramps from easy to hard *separately*. Sharing
one vocabulary meant finishing two hundred boards to reach "Hard" and then being
shown "Warm-up" at level 201, which reads as being sent back to the beginning
rather than as starting a much longer climb. None of the generated words
describes a beginner; the bands underneath them are the same five score
thresholds either way.

| | drawn | generated | all |
| --- | --- | --- | --- |
| boards | 200 | 4,800 | 5,000 |
| score | 3 – 420 | 18 – 4,215 | 3 – 4,215 |
| cells | 12 – 35 | 18 – 49 | 12 – 49 |
| rows | 3 – 7 | 3 – 10 | 3 – 10 |
| columns | 4 – 9 | 3 – 10 | 3 – 10 |
| pieces | 3 – 9 | 4 – 9 | 3 – 9 |

No board is more than ten squares in either direction: the generator draws into a
10×10 grid, and the drawn ones stay well inside it at 7 by 9. That ceiling is
what lets one sizing rule fit every board on every screen — `npm test` checks all
5,000 against five device sizes down to a 320×568 phone.

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
list's arithmetic, how much of that list is unlocked, whether every board still
fits on a small phone, the hint refill, and the id round-trip that saved progress
depends on.

```bash
npm test
```

## Layout

Nothing outside the level data knows about any particular level: the board sizes,
piece counts, tray layout, menu thumbnails and level order are all derived.

| file | what's in it |
| --- | --- |
| [src/levels.ts](src/levels.ts) | types, difficulty bands, and assembling both packs |
| [src/theme.ts](src/theme.ts) | the twenty palettes, and which levels wear which |
| [src/backdropShapes.ts](src/backdropShapes.ts) | the drifting shapes, their laps, and the soft-edge maths |
| [src/Backdrop.tsx](src/Backdrop.tsx) | drawing and moving them |
| [src/handmade.ts](src/handmade.ts) | the 200 drawn boards, as `#` patterns |
| [src/generated.ts](src/generated.ts) | the 4,800 generated boards, one per line |
| [src/solve.ts](src/solve.ts) | the one arrangement that fills a board — what a hint points at |
| [src/hintBank.ts](src/hintBank.ts) | hints held and the hourly refill, as plain arithmetic |
| [src/hints.ts](src/hints.ts) | that bank, kept on the device |
| [src/settings.ts](src/settings.ts) | preferences, kept on the device |
| [src/music.ts](src/music.ts) | the looping background track, and ducking it for the chime |
| [src/menuLayout.ts](src/menuLayout.ts) | where every tile, heading and scrollbar drag lands |
| [src/unlock.ts](src/unlock.ts) | how much of the list a player has earned |
| [src/debug.ts](src/debug.ts) | the `?debug` switch that opens all of it on the web |
| [src/gameLayout.ts](src/gameLayout.ts) | sizing a board and its tray to the screen |
| [src/HintButton.tsx](src/HintButton.tsx) | the hint count and its refill clock |
| [src/placement.ts](src/placement.ts) | pure rules: what fits where, what a drop snaps to |
| [src/progress.ts](src/progress.ts) | which boards are solved, saved on the device |
| [src/MenuScreen.tsx](src/MenuScreen.tsx) | the level list, with each board drawn as its tile |
| [src/GameScreen.tsx](src/GameScreen.tsx) | board, tray, and the drag gestures |
| [src/SettingsScreen.tsx](src/SettingsScreen.tsx) | progress summary and resetting it |
| [src/Blocks.tsx](src/Blocks.tsx) | how a group of squares is drawn |
| [src/Arrow.tsx](src/Arrow.tsx) | the curved dashed arrow the first board draws on itself |
| [scripts/generate-levels.mjs](scripts/generate-levels.mjs) | writes the generated pack |
| [scripts/make-sound.mjs](scripts/make-sound.mjs) | synthesises the finish chime |
| [scripts/make-icon.mjs](scripts/make-icon.mjs) | draws the app icons out of the game's own blocks |
| [scripts/png.mjs](scripts/png.mjs) | writes a PNG, for the two assets that are drawn by code |
| [scripts/verify-levels.mjs](scripts/verify-levels.mjs) | proves every level has one perfect solution |
| [scripts/test-placement.mjs](scripts/test-placement.mjs) | checks the drop/snap rules |

## Chapters

Levels are grouped into chapters that share a palette — background, panels,
accent and the nine piece colours all move together, so crossing into a new one
looks like arriving somewhere rather than like the same board recoloured. A chapter is
ten levels, the whole way through. The level list is painted in the
colours of the board you are on — the last one you opened, or before that the one
after the furthest you have finished — so the chapter is visible before you open
it, and leaving a board puts you back beside it rather than at your high-water
mark. There are twenty
palettes and the set recycles, which it first does at level 201.

Each tile in the list draws its board in its *own* chapter's colours rather than
the list's, so scrolling shows the colour change every ten levels and a tile is a
fair preview of what opening it looks like. A row therefore never spans two
chapters: ten levels do not divide by the three columns a wide screen uses, so
the tenth board would otherwise sit beside the eleventh and twelfth wearing the
next chapter's colour, which reads as the theme being broken rather than as a
boundary. The price is a short last row per chapter on wide screens.

A palette is written as a seed of six numbers rather than thirty hex codes:

```ts
{ name: 'Lagoon', hue: 186, chroma: 28, depth: 7.5,
  accent: [168, 80, 58], palette: { hue: 150, spread: 300, sat: 66, light: 65 } }
```

`hue`, `chroma` and `depth` fix the neutrals — background, panel, body text, dim
text, menu thumbnails are all that one hue at different lightnesses — and the
`palette` recipe walks the colour wheel for the nine piece colours. Adding a
theme is appending one of those to `SEEDS`; it cannot come out internally
inconsistent the way a hand-picked set of thirty codes can, and `npm test` holds
every one of them to the same bar: nine distinct piece colours, a filled block at
least 3:1 against the background, readable text and accent, no two pieces closer
than the eye can split, and the three colours an early three-piece board uses at
least as far apart as the original purple's.

Two details that are less obvious than they look. The colours are handed out four
ninths of the way round the wheel each time rather than in order — a three-piece
board would otherwise get three neighbouring hues. And a piece stores *which*
colour it wears, not the colour itself: levels are built once and kept for the
session, so a piece carrying a hex code would still be wearing whichever
chapter's palette happened to be current the first time it was opened.

Each chapter also carries three **drift** colours, a third of the wheel apart and
anchored just off the accent, for the shapes moving behind the app. They are the
one place a theme can show a second colour without competing with the pieces.

Those shapes have soft edges without a blur filter. `filter: blur()` would be one
line, but on Android it needs API 31 and silently does nothing below it, which
would leave hard-edged circles on exactly the phones least able to carry them. So
each shape is nine copies of itself at growing sizes and about 1% opacity each:
where many overlap it is dense, and towards the edge fewer and fewer do. That is
a soft falloff built out of nothing but background colour, drawn the same way by
every version of every platform. The whole stack composes to roughly a tenth of
the colour at a shape's core — `npm test` pins that, because the first attempt
was five times stronger and the result was a lava lamp. The six laps are all
prime numbers of seconds, so no two shapes ever fall into step.

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

So are the icons. The app icon is the game — three squares inlaid into a four
square board, the fourth left as an empty socket — drawn with the same arithmetic
the pieces are drawn with on screen and coloured out of `theme.ts`, so the thing
on the home screen is made of the same blocks as the thing behind it. One run
writes all five: the square icon, the three layers of the Android adaptive icon
(foreground, background, and the white stencil a themed launcher tints), and the
favicon. The adaptive layers keep their art inside the 66% of the canvas Android
promises not to crop, which is checked rather than eyeballed:

```bash
npm run make-icon
```
