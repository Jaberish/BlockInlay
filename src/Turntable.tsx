import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import Blocks, { type Shape } from './Blocks';
import { cellKey, type Level } from './levels';
import type { Placements } from './placement';
import { LOOPS_NATIVELY, useReduceMotion } from './motion';
import { tone } from './theme';
import {
  DEPTH,
  edgesOf,
  rimRuns,
  rowRuns,
  spinOverTurn,
  stretches,
  wallColumns,
  wallEdge,
  wallFront,
  type Edges,
  type Rim,
  type Side,
} from './solid';

/**
 * The finished board, turning.
 *
 * A solved board is the only thing in the game with nothing left to do, so it
 * stops being a puzzle and becomes an object: the squares close up the gaps they
 * were laid out with, fuse into one piece of material, and turn on the spot for
 * as long as the player cares to watch. It is the reward for the last piece.
 *
 * It begins as the flat board, square for square, and the fusing is a fade — so
 * there is no moment where the board is swapped for something else, only one
 * where the seams between the squares close and what is left is solid.
 *
 * Nothing that says "one object" is drawn per square. The squares supply the
 * colour and nothing else; every light on the solid belongs to the outline, to
 * a whole face, or to the whole height of it, and is drawn at that size. That is
 * the difference between a slab and a tray of tiles, and it is easy to lose —
 * anything with a soft edge, drawn square by square, leaks a little of itself
 * onto the joins and quietly puts the grid back. The rule that keeps it out is
 * that a wash may be split up only if it is drawn in flat colour behind one
 * opacity, because then two pieces of it may overlap without the overlap showing.
 *
 * Nothing is redrawn frame by frame either. Every face is an upright rectangle
 * at every angle (see solid.ts), so a face is a plain view, turning it is a
 * scale and a slide, and lighting it is the opacity of a wash laid over it. One
 * animated value runs the lot, and the JS thread does nothing at all while it
 * turns.
 */

/** one turn, in ms — slow enough to look at, quick enough to be moving */
const TURN_MS = 9000;
/** the seams closing: the board becoming one thing before it moves as one thing */
const FUSE_MS = 460;
/** and a beat after that to take it in, before it starts to turn */
const SETTLE_MS = 700;
/**
 * The light that comes off the solid the moment it becomes one.
 *
 * It goes off as the seams close rather than after, so what the player sees is
 * the pieces fusing *into* the flash and not a finished object being lit — the
 * light is the last piece going in. It is over well before the turn starts, so
 * the thing that goes on forever afterwards is still the quiet part.
 *
 * The board is already carrying a chime, a banner and a ring by this point, so
 * this is short and it is only light: no movement of the object itself, which
 * would be a fourth thing arriving at once.
 */
const FLARE_MS = 620;
/** how far the light throws past the solid, as a fraction of one square */
const FLARE_REACH = 1.5;
/** and how much of it there is at its brightest */
const FLARE = 0.5;
/**
 * The deepest shade a face is laid under when it has turned out of the light.
 *
 * Well short of black, because a face turned away from a light is not in the
 * dark — it is in whatever the room is throwing back at it. Taken all the way
 * down, a solid two thirds of the way through its turn is a silhouette with a
 * bright rim, and the picture the player spent the level making is gone from
 * the screen for half of every lap.
 */
const SHADE = 0.3;
/** the back is the same material, a touch duller for never having been the front */
const BACK_DULL = -0.14;
/** how dark the solid's own shadow is, once it has something to cast one */
const SHADOW = 0.34;
/**
 * How much of the turn a face gets to swap with the one behind it.
 *
 * Both faces are drawn the whole time and the one facing away is hidden, so the
 * swap has to land while the pair is edge-on and has no width to swap in. Six
 * ten-thousandths of a turn either side of it is a pixel and a half of board.
 */
const SWAP = 0.0006;
/** where the solid is held when the device has asked for less movement */
const STILL_AT = 0.055;

/**
 * The pixel of bare surface every translucent thing keeps clear of the outline.
 *
 * Only one layer may draw the edge of the solid. Where the outline lands between
 * two pixels — which is every angle but square on, because the turn scales the
 * face by a fraction — that pixel is only part covered, and a wash laid over it
 * tints the uncovered part as well as the covered one. So the background showing
 * through the edge gets tinted too. One wash is a shade off; the shade, the
 * shine and three bands of rim stacked up is a black line around every rounded
 * corner, arriving the moment the solid starts to turn and gone again the moment
 * it is square on.
 *
 * So the washes are drawn inside the surface and cut by the same edge it is, and
 * the rims are held this far back from it.
 */
const HAIR = 1;

/**
 * How far in from the outline an edge rolls off, as a fraction of one square —
 * and, because it has to be the same number, how far the corners are rounded.
 *
 * The loose pieces are drawn as rounded squares, so the object they fuse into is
 * rounded off at its corners too, or finishing a level swaps something soft for
 * something with four sharp points. And the roll of the edge has to turn those
 * corners with the surface: an edge lit along a straight band and a corner cut
 * away underneath it leaves the light standing out past the shape it is on. Set
 * to the same reach, the two arcs are the same arc.
 */
const ROLL = 0.2;
/**
 * The roll of an edge, as the bands it is drawn in: how far in each one reaches,
 * and how much of the edge's light it carries.
 *
 * Flat bands rather than one soft one. A blur would be smoother, but every way
 * of blurring a rectangle spreads the colour along the rim as well as across it,
 * and a rim that bleeds past its own ends puts light on joins that are supposed
 * to have fused.
 *
 * The weight sits at the sharp end on purpose. Spread evenly the bands are a
 * ramp, and a ramp with nothing at the top of it is a soft object — a cushion.
 * Loading the last band, which is a pixel or two wide and hard against the
 * outline, puts a lit edge on the front of that ramp, and a lit edge is the
 * whole difference between something moulded and something inflated.
 */
const BANDS = [
  { reach: 1, of: 0.28 },
  { reach: 0.52, of: 0.3 },
  { reach: 0.18, of: 0.42 },
];
/** the light lying along the top of the solid, and the shade under its foot */
const CREST = 0.34;
const FOOT = 0.5;
/** and along a side, which swings between the two as that side turns in the light */
const FLANK = 0.42;
const FLANK_DARK = 0.36;
/**
 * How much brighter the top of the solid is than the bottom.
 *
 * The light is above the player, so it reaches the top of the object across and
 * the foot of it at a glance, and a face with the same colour top to bottom is
 * the one thing here that still reads as a printed picture. It is laid into the
 * colours rather than over them: a wash would have to be drawn square by square
 * and would land on the joins, which is exactly what the rest of this avoids.
 */
const RAMP = 0.13;
/**
 * How spread out the sides have to be for the corners between them to mean
 * anything, as a fraction of the flat board's width.
 *
 * Every column's side lands `cell × squash` from the next, so as the solid comes
 * edge-on they slide in behind one another and every step in the outline closes
 * up. A corner rounded off there is a corner of something that no longer has one
 * — and because only the outline's own sides are ever drawn, what shows through
 * the rounding is not the material behind it but the background.
 *
 * So the roundings are filled back in as the sides converge: gone by the time
 * the columns are further apart than a corner is round, complete by the time
 * they are nearer than that.
 */
const SPREAD = { flat: 0.2, whole: 0.35 };
/**
 * How white a face and a side go at the angle that bounces the light back at
 * the player.
 *
 * Low, because the chapters are not all vivid — several of them are pastel
 * already, and white laid over a pale colour takes the colour away rather than
 * lighting it. A sheen that has to stay a sheen on the palest board in the game
 * is the one that reads as polish on all of them; anything more and the picture
 * the player made goes white once a lap.
 */
const SHINE = 0.14;
const WALL_SHINE = 0.18;
/** how far the far side of a wall falls away from the near side of it */
const WALL_BACK = 0.62;
/**
 * And how dark it has got by the back edge itself, where the corners are.
 *
 * The fall-off is drawn as a shadow thrown across the wall's depth, which a flat
 * patch filling one of its corners knows nothing about — and the corners are at
 * the far edge, which is the darkest part of it. Left at the base colour the
 * patches come out as bright chips at the back of every step.
 */
const BACK_CORNER = -0.55;
/** the light caught on the material's own cut edge, where a side meets a face */
const WALL_LIP = 0.26;
/**
 * How much of the grain is let through.
 *
 * The grain is a tile of pure per-pixel noise (see scripts/make-grain.mjs), laid
 * over every surface of the solid and repeated in the solid's own frame so it
 * runs across the joins rather than restarting at each of them. Half its pixels
 * darken and half lighten, so a patch of it averages back to the colour it was
 * laid on: the object keeps one colour to name it by, and no two pixels of that
 * colour are the same.
 *
 * It is the whole texture. Blotches big enough to see as blotches read as stains
 * on the picture the player made rather than as what the picture is made of, and
 * they cost a view apiece; this costs one view per piece of surface however fine
 * it is, because the fineness is in the tile.
 */
const GRAIN = 0.13;

type Props = {
  level: Level;
  /** where every piece finished; the board is full, so these cover every square */
  placements: Placements;
  /** the pieces in their chapter's colours, exactly as the board drew them */
  shapes: Record<string, Shape>;
  /** the size of one board square, in px */
  cell: number;
};

/** the tile of per-pixel noise every surface of the solid is grained with */
const TILE = require('../assets/grain.png');

/** one square of the solid: its colours, and which of its sides are on the outside */
type Facet = { row: number; col: number; color: string; shade: string; edges: Edges };

/**
 * One piece of the solid's surface: an unbroken run of one colour across one
 * row, grown into whatever it abuts and rounded off wherever it turns a corner
 * of the object.
 */
type Slab = {
  row: number;
  col: number;
  span: number;
  color: string;
  shade: string;
  wider: number;
  taller: number;
  round: {
    borderTopLeftRadius: number;
    borderBottomLeftRadius: number;
    borderTopRightRadius: number;
    borderBottomRightRadius: number;
  };
};

const white = (a: number) => `rgba(255,255,255,${a})`;
const black = (a: number) => `rgba(0,0,0,${a})`;

function Turntable({ level, placements, shapes, cell }: Props) {
  const width = level.board.cols * cell;
  const height = level.board.rows * cell;
  const depth = Math.max(6, Math.round(cell * DEPTH));
  const roll = Math.max(2, Math.round(cell * ROLL));

  /** every square of the board, in the colours of the piece it was cut from */
  const facets = useMemo(() => {
    const filled: Array<{ row: number; col: number; color: string; shade: string }> = [];
    for (const piece of level.pieces) {
      const spot = placements[piece.id];
      if (!spot) continue;
      const { color, shade } = shapes[piece.id];
      for (const c of piece.cells) {
        filled.push({ row: spot.row + c.row, col: spot.col + c.col, color, shade });
      }
    }
    return edgesOf(filled) as Facet[];
  }, [level.pieces, placements, shapes]);

  /** the outline, as the straight lengths the light actually runs along */
  const outline = useMemo(() => rimRuns(facets), [facets]);
  /** which rows the solid is in at all — not which rows a given column is in */
  const rows = useMemo(() => new Set(facets.map((f) => f.row)), [facets]);
  /**
   * And the solid itself in wide pieces, for the washes that are one flat colour.
   *
   * Split by whether there is material underneath, so that every piece can be
   * grown into its neighbour by the same pixel the surface is grown by — and
   * only into a neighbour. A piece that overhung the outline would put a hairline
   * of its own colour just outside the solid, which is nothing at all for the
   * shade and a pale outline round the whole object for the shine.
   */
  const slabs = useMemo(() => {
    const filled = new Set(facets.map((f) => cellKey(f.row, f.col)));
    const at = new Map(facets.map((f) => [cellKey(f.row, f.col), f]));
    // a piece may only run as far as the things that have to hold all along it:
    // one colour, and one answer to whether there is material underneath
    const groups = new Map<string, Facet[]>();
    for (const f of facets) {
      const key = `${f.color}:${f.edges.bottom}`;
      const group = groups.get(key);
      if (group) group.push(f);
      else groups.set(key, [f]);
    }
    const corner = (down: boolean, across: boolean) => (down && across ? roll : 0);
    return [...groups.values()].flatMap((group) =>
      rowRuns(group).map(({ row, col, span }) => {
        // only the ends of a piece can be at a corner of the object: a square in
        // the middle of one has a square either side of it by definition
        const first = at.get(cellKey(row, col))!;
        const last = at.get(cellKey(row, col + span - 1))!;
        return {
          row,
          col,
          span,
          color: first.color,
          shade: first.shade,
          // down into the row below only where there is one, and right into the
          // next piece along only where the two are actually side by side
          wider: filled.has(cellKey(row, col + span)) ? 1 : 0,
          taller: first.edges.bottom ? 0 : 1,
          round: {
            borderTopLeftRadius: corner(first.edges.top, first.edges.left),
            borderBottomLeftRadius: corner(first.edges.bottom, first.edges.left),
            borderTopRightRadius: corner(last.edges.top, last.edges.right),
            borderBottomRightRadius: corner(last.edges.bottom, last.edges.right),
          },
        };
      }),
    );
  }, [facets, roll]);

  const spin = useRef(new Animated.Value(0)).current;
  const fuse = useRef(new Animated.Value(0)).current;
  const flare = useRef(new Animated.Value(0)).current;
  const still = useReduceMotion();
  /** the board as it was laid out is only needed until the seams have closed */
  const [seamed, setSeamed] = useState(true);

  useEffect(() => {
    const closing = Animated.timing(fuse, {
      toValue: 1,
      duration: still ? 0 : FUSE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    closing.start(({ finished }) => {
      if (finished) setSeamed(false);
    });
    return () => closing.stop();
  }, [fuse, still]);

  useEffect(() => {
    // the device has asked for less movement, and a flash is the most movement
    // there is: the solid simply arrives
    if (still) return;
    const light = Animated.timing(flare, {
      toValue: 1,
      duration: FLARE_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    light.start();
    return () => light.stop();
  }, [flare, still]);

  useEffect(() => {
    if (still) {
      // a corner of the turn rather than square on, so it still reads as an
      // object — the point was that the board became one, not that it moves
      spin.setValue(STILL_AT);
      return;
    }
    spin.setValue(0);
    const turning = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: TURN_MS,
        // linear, and a whole turn a lap: a rotation with a start and a finish
        // in it would keep announcing itself instead of just carrying on
        easing: Easing.linear,
        // Animated.loop hands a native-driven animation to the platform to
        // repeat, and on the web there is nothing on the other end of that: the
        // board turns once and then stands still. See motion.ts.
        useNativeDriver: LOOPS_NATIVELY,
      }),
    );
    // The beat before it moves is a plain timer, not an Animated.delay in front
    // of the loop — sequenced that way the loop is handed a start it never
    // comes back from.
    const settle = setTimeout(() => turning.start(), SETTLE_MS);
    return () => {
      clearTimeout(settle);
      turning.stop();
    };
  }, [spin, still]);

  const curve = useMemo(() => spinOverTurn(), []);

  /**
   * The turn, as transforms. One node per way of moving or being lit, shared by
   * everything that moves or is lit the same way — the hundreds of views of a
   * solid come down to a handful of numbers.
   */
  const move = useMemo(() => {
    const stops = curve.stops;
    const over = (values: number[]) => spin.interpolate({ inputRange: stops, outputRange: values });
    const shadeBy = (lit: number[]) => over(lit.map((v) => SHADE * (1 - v)));
    return {
      /** the mosaic's width, and its mirror image once it is past edge-on */
      squash: over(curve.squash),
      front: over(curve.faceSlide.map((v) => v * depth)),
      back: over(curve.faceSlide.map((v) => -v * depth)),
      /** a wall, shut face-on and wide open edge-on */
      open: over(curve.wallOpen),
      /** the shade over each face as it turns out of the light */
      shade: {
        front: shadeBy(curve.frontLit),
        back: shadeBy(curve.backLit),
        left: shadeBy(curve.leftLit),
        right: shadeBy(curve.rightLit),
      },
      /**
       * And the shine, which is the light the surface hands straight back rather
       * than soaks up — so it arrives at one angle and is gone at the next. Both
       * faces of the slab share a reading and both sides share another, because
       * what bounces belongs to the plane and not to a side of it.
       *
       * It lights the whole face at once rather than travelling across it. That
       * is what a flat face under a distant light actually does, and it is also
       * the only version that can be drawn here: a shine that sits somewhere
       * particular has to be cut to the outline to move across it, cutting means
       * a window per piece of the solid, and the joins between those windows are
       * the grid coming back the moment the shine is bright enough to see.
       */
      shine: {
        face: over(curve.faceShine.map((v) => v * SHINE)),
        wall: over(curve.wallShine.map((v) => v * WALL_SHINE)),
      },
      /** what is left of the light on a face, for whatever is not washed by it */
      lit: {
        front: over(curve.frontLit.map((v) => 1 - SHADE * (1 - v))),
        back: over(curve.backLit.map((v) => 1 - SHADE * (1 - v))),
      },
      /**
       * The light along the two upright edges of a face.
       *
       * A face never tilts, so its top edge keeps the same light all the way
       * round — but its sides swap, and this is what makes the turn read as a
       * turn rather than as a picture being squashed. The upright edge of a face
       * points exactly where the wall behind it points, so it catches exactly
       * what that wall catches, and the sums are already done.
       *
       * The dark is the same reading upside down, so a side that has swung out
       * of the light is a shadow rather than merely an absent highlight.
       */
      flank: {
        left: over(curve.leftLit),
        right: over(curve.rightLit),
        leftDark: over(curve.leftLit.map((v) => 1 - v)),
        rightDark: over(curve.rightLit.map((v) => 1 - v)),
      },
      /**
       * How far apart the steps in the outline still stand, 0 to 1 — how much a
       * step is still worth lighting as an edge of its own.
       */
      opening: over(
        curve.squash.map(
          (v) =>
            1 -
            Math.max(0, Math.min(1, (SPREAD.whole - Math.abs(v)) / (SPREAD.whole - SPREAD.flat))),
        ),
      ),
      /**
       * How far the steps in the outline have closed up, 0 to 1 — and so how far
       * the corners at those steps have to be filled back in.
       */
      collapse: over(
        curve.squash.map((v) =>
          Math.max(0, Math.min(1, (SPREAD.whole - Math.abs(v)) / (SPREAD.whole - SPREAD.flat))),
        ),
      ),
      /** how far a wall column slides, per pixel it stands from the axis */
      slide: (edge: number) => over(curve.wallSlide.map((v) => v * edge)),
      /** a face is only drawn while it is the one pointing at the player */
      facing: (front: boolean) =>
        spin.interpolate({
          inputRange: [0, 0.25 - SWAP, 0.25 + SWAP, 0.75 - SWAP, 0.75 + SWAP, 1],
          outputRange: front ? [1, 1, 0, 0, 1, 1] : [0, 0, 1, 1, 0, 0],
        }),
      /** and so is a wall: the left ones for half a turn, the right ones for the other */
      showing: (side: Side) =>
        side === 'left'
          ? spin.interpolate({
              inputRange: [0, SWAP, 0.5 - SWAP, 0.5 + SWAP, 1],
              outputRange: [0, 1, 1, 0, 0],
            })
          : spin.interpolate({
              inputRange: [0, 0.5 - SWAP, 0.5 + SWAP, 1 - SWAP, 1],
              outputRange: [0, 0, 1, 1, 0],
            }),
    };
  }, [curve, depth, spin]);

  const box = { position: 'absolute' as const, left: 0, top: 0, width, height };

  /** how much of the light from above reaches a square, by how far down it is */
  const lift = (row: number) => RAMP * (0.5 - (row + 0.5) / level.board.rows);

  /**
   * Where a piece of the solid sits.
   *
   * No inset between the pieces — that is the fusing. But two views that abut
   * exactly still leave a hairline of background showing between them once the
   * screen scales them, and a grid of hairlines is the tiled board all over
   * again. So a piece with a neighbour is grown a pixel into it, and the seam has
   * nowhere left to appear. Only the outline keeps its exact edge, which is the
   * one that has to line up with the wall behind it.
   */
  const fill = { position: 'absolute' as const, left: 0, right: 0, top: 0, bottom: 0 };

  const bed = (slab: Slab) => ({
    position: 'absolute' as const,
    left: slab.col * cell,
    top: slab.row * cell,
    width: slab.span * cell + slab.wider,
    height: cell + slab.taller,
  });

  /**
   * A patch of the grain, cut to whatever it is laid over.
   *
   * The tile repeats from the top-left of whatever this sits in, so the piece is
   * always laid out at the full size of the surface it belongs to and shifted
   * back by where in that surface it has been cut from. Every piece then starts
   * its tiling at the same corner, and the grain runs on across the joins
   * instead of beginning again at each of them — which would be the tiling of
   * the board, in noise.
   */
  const grain = (left: number, top: number, span: { width: number; height: number }) => (
    <Image
      source={TILE}
      resizeMode="repeat"
      style={{ position: 'absolute', left, top, ...span, opacity: GRAIN }}
    />
  );

  /**
   * The solid's whole surface, in whatever it is made of here — and the grain of
   * that stuff.
   *
   * A colour is one hex code and a material is not, so every piece of surface is
   * its base colour with the grain over it: the piece names the colour and the
   * grain sees to it that no two pixels of the piece are actually that colour.
   */
  const surface = (base: (slab: Slab) => string, dim: Animated.AnimatedInterpolation<number>) =>
    slabs.map((slab) => (
      <View
        key={cellKey(slab.row, slab.col)}
        style={{ ...bed(slab), ...slab.round, overflow: 'hidden', backgroundColor: base(slab) }}
      >
        {grain(-slab.col * cell, -slab.row * cell, { width, height })}
        {/* the light on the face, laid on inside the piece rather than over the
            top of it: over the top it would be cut to its own copy of the
            outline, and two edges in the same place is the black line (see HAIR) */}
        <Animated.View style={[fill, { backgroundColor: '#000000', opacity: dim }]} />
        <Animated.View style={[fill, { backgroundColor: '#FFFFFF', opacity: move.shine.face }]} />
      </View>
    ));

  /**
   * One length of the outline, as the stack of bands its roll is drawn in.
   *
   * The bands are nested rather than laid side by side, and that is the whole
   * trick. The outermost one is exactly as deep as the corners are round, so its
   * rounded corner is the *same* quarter circle as the surface's — and every
   * band inside it, being its child, is cut to that same circle without having
   * to know anything about it.
   *
   * Rounded off one by one instead, each would get the tightest circle that fits
   * its own depth, which is a smaller circle sitting inside a bigger one and
   * poking out of it at the diagonal. On the shaded sides that is a black nub on
   * every corner of the object, at two or three pixels across — small, and the
   * first thing anyone sees.
   */
  const rim = (run: Rim, paint: (a: number) => string, strength: number) => {
    const along = run.span * cell;
    const near = run.capStart ? roll - HAIR : 0;
    const far = run.capEnd ? roll - HAIR : 0;
    // the outermost band, lying along the run at the full reach of the roll
    // held a hair inside the outline on the side it lies along and at whichever
    // of its ends turns a corner, its arc pulled in by the same hair — so it is
    // concentric with the surface's arc and everywhere just inside it
    const deep = roll - HAIR;
    const head = run.capStart ? HAIR : 0;
    const short = along - head - (run.capEnd ? HAIR : 0);
    const outer =
      run.side === 'top'
        ? {
            left: run.col * cell + head,
            top: run.row * cell + HAIR,
            width: short,
            height: deep,
            borderTopLeftRadius: near,
            borderTopRightRadius: far,
          }
        : run.side === 'bottom'
          ? {
              left: run.col * cell + head,
              top: (run.row + 1) * cell - roll,
              width: short,
              height: deep,
              borderBottomLeftRadius: near,
              borderBottomRightRadius: far,
            }
          : run.side === 'left'
            ? {
                left: run.col * cell + HAIR,
                top: run.row * cell + head,
                width: deep,
                height: short,
                borderTopLeftRadius: near,
                borderBottomLeftRadius: far,
              }
            : {
                left: (run.col + 1) * cell - roll,
                top: run.row * cell + head,
                width: deep,
                height: short,
                borderTopRightRadius: near,
                borderBottomRightRadius: far,
              };
    /** an inner band, held against the same edge of the run as the outer one */
    const against = (deep: number) =>
      run.side === 'top'
        ? { left: 0, right: 0, top: 0, height: deep }
        : run.side === 'bottom'
          ? { left: 0, right: 0, bottom: 0, height: deep }
          : run.side === 'left'
            ? { top: 0, bottom: 0, left: 0, width: deep }
            : { top: 0, bottom: 0, right: 0, width: deep };

    const stack = (i: number): React.ReactNode => {
      if (i >= BANDS.length) return null;
      const deep = Math.max(1, Math.round(roll * BANDS[i].reach));
      return (
        <View
          style={{
            position: 'absolute',
            backgroundColor: paint(strength * BANDS[i].of),
            ...(i === 0 ? { ...outer, overflow: 'hidden' as const } : against(deep)),
          }}
        >
          {stack(i + 1)}
        </View>
      );
    };
    return stack(0);
  };

  /** every length of the outline on one side of the solid, lit the same way */
  const rims = (side: Rim['side'], paint: (a: number) => string, strength: number) =>
    outline
      .filter((r) => r.side === side)
      .map((run) => (
        <React.Fragment key={`${run.row}:${run.col}`}>{rim(run, paint, strength)}</React.Fragment>
      ));

  /** one face of the solid: its surface, its edges, and the light on both */
  const face = (front: boolean) => {
    const paint = (s: Slab) =>
      tone(front ? s.color : s.shade, lift(s.row) + (front ? 0 : BACK_DULL));
    return (
    <Animated.View
      style={[
        box,
        {
          opacity: move.facing(front),
          transform: [{ translateX: front ? move.front : move.back }, { scaleX: move.squash }],
        },
      ]}
    >
      {surface(paint, front ? move.shade.front : move.shade.back)}

      {/* The edges dim with the face, which the wash over the top of them used to
          see to. One node for the lot of them rather than one each: they are all
          on the same face and it is the face that has turned away. */}
      <Animated.View style={[box, { opacity: front ? move.lit.front : move.lit.back }]}>
      {/* the shaded edges first, so a corner where the two meet keeps its light */}
      {rims('bottom', black, FOOT)}
      <Animated.View style={[box, { opacity: move.flank.leftDark }]}>
        {rims('left', black, FLANK_DARK)}
      </Animated.View>
      <Animated.View style={[box, { opacity: move.flank.rightDark }]}>
        {rims('right', black, FLANK_DARK)}
      </Animated.View>
      {/* the top of a face keeps its light all the way round; its two sides
          trade theirs for the other's as the solid turns */}
      {rims('top', white, CREST)}
      <Animated.View style={[box, { opacity: move.flank.left }]}>
        {rims('left', white, FLANK)}
      </Animated.View>
      <Animated.View style={[box, { opacity: move.flank.right }]}>
        {rims('right', white, FLANK)}
      </Animated.View>
      </Animated.View>

      {front && seamed ? (
        // the board as it was laid out, fading off the front of the solid: the
        // gaps do not vanish, they close
        <Animated.View
          style={[box, { opacity: fuse.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}
        >
          {level.pieces.map((piece) => {
            const spot = placements[piece.id];
            if (!spot) return null;
            return (
              <View
                key={piece.id}
                style={{
                  position: 'absolute',
                  left: spot.col * cell,
                  top: spot.row * cell,
                  width: piece.cols * cell,
                  height: piece.rows * cell,
                }}
              >
                <Blocks shape={shapes[piece.id]} cell={cell} />
              </View>
            );
          })}
        </Animated.View>
      ) : null}
    </Animated.View>
    );
  };

  /**
   * The roll of light along the top or the foot of a side.
   *
   * The same bands the face's rims are drawn in, laid across the width of the
   * side instead of along a length of outline — and as plain siblings, because
   * the run they sit in is already clipping them to its own shape.
   */
  const ridge = (edge: 'top' | 'bottom') =>
    BANDS.map(({ reach, of }, i) => (
      <View
        key={`${edge}:${i}`}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          ...(edge === 'top' ? { top: 0 } : { bottom: 0 }),
          height: Math.max(1, Math.round(roll * reach)),
          backgroundColor: edge === 'top' ? white(CREST * of) : black(FOOT * of),
        }}
      />
    ));

  /** whatever this is, only while the steps in the outline are still open */
  const stepped = (what: React.ReactNode) => (
    <Animated.View style={[fill, { opacity: move.opening }]}>{what}</Animated.View>
  );

  /**
   * The walls down one side of the outline, in the order they have to be
   * painted — and each of them shaded across its own depth.
   *
   * A side of the slab is drawn as a flat strip that gets squeezed, so without
   * that shading it is a band of flat colour standing beside a face, which reads
   * as a second flat picture rather than as a thickness. One end of the strip is
   * the front of the material and the other is the back; the back falls away,
   * the front keeps a lit edge, and which end is which never changes while the
   * wall is on screen (see wallFront).
   */
  const walls = (side: Side) => {
    const frontEdge = wallFront(side);
    const lip = Math.max(1, Math.round(depth * 0.16));
    // the dark is thrown from the back of the strip towards the front, and dies
    // out halfway; the blur would spread up and down the wall as well, which is
    // what the clipping is for
    const lean = (frontEdge === 'right' ? 1 : -1) * Math.round(depth / 2);
    return (
      <Animated.View style={[box, { opacity: move.showing(side) }]}>
        {wallColumns(
          facets.filter((f) => (side === 'left' ? f.edges.left : f.edges.right)),
          side,
        ).map(({ col, cells }) => {
          const edge = wallEdge(col, side, cell, width);
          const turn = Math.min(roll, Math.round(depth / 2));
          // an unbroken stack of wall is one length of material, so it is drawn
          // as one — its shading runs down the whole of it and stops at its real
          // ends, rather than at every square it happens to pass
          const runs = stretches(cells.map((f) => f.row));
          const paint = new Map(cells.map((f) => [f.row, tone(f.shade, lift(f.row))]));
          const edges = new Map(cells.map((f) => [f.row, f.edges]));
          const band = (start: number, span: number) => ({
            position: 'absolute' as const,
            left: 0,
            right: 0,
            top: start * cell,
            height: span * cell,
          });
          /**
           * A side of the object is rounded off where it runs out at the top or
           * the bottom — but only along its back edge, and only where the *solid*
           * runs out rather than where this column does.
           *
           * The back edge, because the other one is where the side meets the face
           * and the two are one piece of material there: round that end as well
           * and a bite comes out of the join, and every stretch of wall reads as
           * a separate rounded tile with the background showing between it and
           * the face it belongs to.
           *
           * Wherever the column's own material ends, because that is where the
           * side face ends and the solid turns a corner — every one of them, so
           * the outline is round the whole way and not round in some places and
           * flat in others. What was flat about them at the steps is put back by
           * `closing` below, and only for as long as the steps are shut.
           */
          const capped = (start: number, span: number) => {
            const top = edges.get(start)?.top ? turn : 0;
            const foot = edges.get(start + span - 1)?.bottom ? turn : 0;
            const back = frontEdge === 'right' ? 'Left' : 'Right';
            return {
              [`borderTop${back}Radius`]: top,
              [`borderBottom${back}Radius`]: foot,
            } as { borderTopLeftRadius?: number; borderBottomLeftRadius?: number };
          };

          /**
           * The corners of this column's sides, filled square again.
           *
           * Drawn behind the sides, so all that ever shows of one is the corner
           * it is filling, and only while the steps are shut (see SPREAD). Flat
           * colour with no light on it: by the time any of this is showing, the
           * sides are square to the light and there is next to nothing on them to
           * miss — and it is a corner's worth of material, ten pixels on a side.
           */
          const closing = (start: number, span: number) => {
            const at = capped(start, span) as Record<string, number>;
            const back = frontEdge === 'right' ? 'left' : 'right';
            const corners: Array<[number, string]> = [];
            const top = at[`borderTop${frontEdge === 'right' ? 'Left' : 'Right'}Radius`];
            const foot = at[`borderBottom${frontEdge === 'right' ? 'Left' : 'Right'}Radius`];
            const dark = (row: number) => tone(paint.get(row) ?? '#000000', BACK_CORNER);
            if (top) corners.push([start * cell, dark(start)]);
            if (foot) corners.push([(start + span) * cell - turn, dark(start + span - 1)]);
            return corners.map(([top_, colour]) => (
              <View
                key={`${start}:${top_}`}
                style={{
                  position: 'absolute',
                  top: top_,
                  [back]: 0,
                  width: turn,
                  height: turn,
                  backgroundColor: colour,
                }}
              />
            ));
          };
          return (
            <Animated.View
              key={col}
              style={{
                position: 'absolute',
                // laid out along its own wall, then slid and opened by the turn
                left: edge + width / 2 - depth / 2,
                top: 0,
                width: depth,
                height,
                transform: [{ translateX: move.slide(edge) }, { scaleX: move.open }],
              }}
            >
              {/* the corners of the sides, filled square while the steps between
                  them are shut — behind the sides, so only the corners show */}
              <Animated.View style={[fill, { opacity: move.collapse }]}>
                {runs.flatMap(({ start, span }) => closing(start, span))}
              </Animated.View>
              {runs.map(({ start, span }) => (
                <View key={start} style={{ ...band(start, span), ...capped(start, span), overflow: 'hidden' }}>
                  {Array.from({ length: span }, (_, i) => (
                    <View
                      key={i}
                      style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        top: i * cell,
                        // the same hairline cover the surface has, down the join
                        // between two squares of wall stacked one on the other
                        height: cell + (i < span - 1 ? 1 : 0),
                        backgroundColor: paint.get(start + i),
                      }}
                    />
                  ))}
                  {/* the cut edge is the same stuff, so it has the same grain
                      in it — squeezed along with the wall as the solid turns,
                      which is what grain seen at an angle does */}
                  {grain(0, -start * cell, { width: depth, height })}
                  {/* the depth: dark at the back, so the side reads as going away */}
                  <View
                    style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      top: -depth,
                      bottom: -depth,
                      boxShadow: `inset ${lean}px 0px ${depth}px ${black(WALL_BACK)}`,
                    }}
                  />
                  {/* and the material's own edge, where the side meets the face */}
                  <View
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      width: lip,
                      left: frontEdge === 'left' ? 0 : undefined,
                      right: frontEdge === 'right' ? 0 : undefined,
                      backgroundColor: white(WALL_LIP),
                    }}
                  />
                  {/* Where the solid itself starts or stops, the side takes the
                      same roll of light along it as the face in front of it does.
                      Without this, the top edge of the object is lit for the width
                      of the face and plain for the width of the side, and the
                      highlight stops dead at the join — which is the two of them
                      reading as separate pieces however exactly they line up.

                      A step partway down gets the same, because a step is an
                      edge of the object like any other, and lighting the face's
                      half of it and not the side's is what makes the two of them
                      read as separate pieces meeting rather than one shape. But
                      only for as long as the step is open: the sides slide in
                      behind one another as the solid comes edge-on, and lit edges
                      left on all of them would be a ladder of bright rungs across
                      the bar that edge-on ought to be. A step's roll fades out
                      exactly as its corner fills in — the same reckoning, so the
                      two never disagree (see SPREAD).

                      Inside the run, so it is cut by the run's own rounded corner
                      and has no edge of its own to draw (see HAIR). */}
                  {rows.has(start - 1)
                    ? edges.get(start)?.top && stepped(ridge('top'))
                    : ridge('top')}
                  {rows.has(start + span)
                    ? edges.get(start + span - 1)?.bottom && stepped(ridge('bottom'))
                    : ridge('bottom')}
                  {/* the light on the side, inside the run for the same reason
                      the face's is inside its own piece (see HAIR) */}
                  <Animated.View
                    style={[
                      fill,
                      {
                        backgroundColor: '#000000',
                        opacity: side === 'left' ? move.shade.left : move.shade.right,
                      },
                    ]}
                  />
                  <Animated.View
                    style={[fill, { backgroundColor: '#FFFFFF', opacity: move.shine.wall }]}
                  />
                </View>
              ))}
            </Animated.View>
          );
        })}
      </Animated.View>
    );
  };

  return (
    <View style={box} pointerEvents="none">
      {/* The light of the thing becoming one, thrown out from behind it.
          The solid's own shape, cast as a blur and nothing else: filled in, the
          part of it that swells past the edges is a grey copy of the object with
          edges of its own, which reads as a second shape rather than as light. */}
      <Animated.View
        style={[
          box,
          {
            opacity: flare.interpolate({ inputRange: [0, 0.16, 1], outputRange: [0, FLARE, 0] }),
            transform: [
              { scale: flare.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1.18] }) },
            ],
          },
        ]}
      >
        {slabs.map((slab) => (
          <View
            key={cellKey(slab.row, slab.col)}
            style={{
              ...bed(slab),
              ...slab.round,
              boxShadow: `0px 0px ${Math.round(cell * FLARE_REACH)}px #FFFFFF`,
            }}
          />
        ))}
      </Animated.View>

      {/* what the solid throws behind itself, once it is solid enough to throw one */}
      <Animated.View
        style={[
          box,
          {
            opacity: fuse.interpolate({ inputRange: [0, 1], outputRange: [0, SHADOW] }),
            // thrown down and to the right, away from the light, and far
            // enough that the blur reads as a shadow rather than as a halo
            transform: [
              { translateX: move.front },
              { translateX: Math.round(cell * 0.1) },
              { translateY: Math.round(cell * 0.22) },
              { scaleX: move.squash },
            ],
          },
        ]}
      >
        {slabs.map((slab) => (
          <View
            key={cellKey(slab.row, slab.col)}
            style={{
              ...bed(slab),
              ...slab.round,
              backgroundColor: '#000000',
              // the blur bleeds into the neighbouring piece, which is the same
              // black, so only the outline of the whole solid is ever soft
              boxShadow: `0px 0px ${Math.round(cell * 0.34)}px rgba(0,0,0,1)`,
            }}
          />
        ))}
      </Animated.View>

      {/* the far side of the solid next, so the near side paints over it */}
      {walls('left')}
      {walls('right')}

      {face(false)}
      {face(true)}
    </View>
  );
}

// the screen around it re-renders for hint notes and banners it knows nothing
// about; re-attaching two dozen native animations to each of those would be a
// stutter in the one thing here that is meant to be perfectly smooth
export default React.memo(Turntable);
