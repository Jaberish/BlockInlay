# Block Inlay

A React Native (Expo) block puzzle. Twelve boards, each with a set of pieces that
fills it — no piece left over, no square left empty, and exactly one way to do it.

```
 ###      ##...##     ..#..     ###..     ...#...    .##.##.
##..      #######     .###.     ###..     ..###..    #######
##..      ..###..     #####     ###..     #######    .#####.
##..      #######     .###.     #####     .#####.    ..###..
 ###      ##...##     #####     #####     ..###..    ...#...
                      ..#..                .##.##.
Crescent  Butterfly   Pine      Boot       Star       Heart      … and six more
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

Levels are ordered by how much backtracking they demand — measured, not guessed,
by counting the dead ends a systematic solver hits.

| # | board | cells | pieces | # | board | cells | pieces |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Crescent (warm-up) | 12 | 3 | 7 | Ghost (medium) | 21 | 5 |
| 2 | Butterfly (warm-up) | 25 | 5 | 8 | Cat (hard) | 24 | 6 |
| 3 | Pine (easy) | 19 | 4 | 9 | Arrow (hard) | 22 | 5 |
| 4 | Boot (easy) | 19 | 4 | 10 | Diamond (hard) | 24 | 6 |
| 5 | Star (easy) | 23 | 5 | 11 | Crown (hard) | 27 | 6 |
| 6 | Heart (medium) | 20 | 5 | 12 | Tower (expert) | 26 | 6 |

Every one of them satisfies two properties, and neither is taken on trust:

```bash
npm run verify-levels
```

That exhaustively searches every legal placement of every piece on every board,
and fails unless each one is covered exactly — same number of cells as the pieces
supply — by precisely one arrangement. The rules of dropping and snapping have
their own checks across all twelve boards:

```bash
npm test
```

## Layout

Nothing outside `levels.ts` knows about any particular level: the board sizes,
piece counts, tray layout, menu thumbnails and level order are all derived.

| file | what's in it |
| --- | --- |
| [src/levels.ts](src/levels.ts) | every level, drawn as `#` patterns |
| [src/placement.ts](src/placement.ts) | pure rules: what fits where, what a drop snaps to |
| [src/progress.ts](src/progress.ts) | which boards are solved, saved on the device |
| [src/MenuScreen.tsx](src/MenuScreen.tsx) | the level list, with each board drawn as its tile |
| [src/GameScreen.tsx](src/GameScreen.tsx) | board, tray, and the drag gestures |
| [src/SettingsScreen.tsx](src/SettingsScreen.tsx) | progress summary and resetting it |
| [src/Blocks.tsx](src/Blocks.tsx) | how a group of squares is drawn |
| [scripts/verify-levels.mjs](scripts/verify-levels.mjs) | proves every level has one perfect solution |
| [scripts/test-placement.mjs](scripts/test-placement.mjs) | checks the drop/snap rules |

## Adding a level

Add an entry to `DEFS` in [src/levels.ts](src/levels.ts) — a name, a difficulty,
the board drawn with `#`, and the pieces drawn the same way. Then run
`npm run verify-levels` and adjust the pieces until it reports exactly one
solution. Nothing else needs to change: the menu, the board and the tray all size
themselves from the data.

Two things worth knowing when inventing a board. Narrow necks and single-cell tips
make a board *easier*, because they force placements; wide open areas make it
harder, because pieces can slide. And shapes that are one cell wide in a loop or
stem — a key, a letter "A" — cannot be cut into 4- and 5-cell pieces at all.
