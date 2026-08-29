import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
  Easing,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type PanResponderInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Blocks, { type Shape } from './Blocks';
import { cellKey, type Cell, type Level, type Piece } from './levels';
import {
  boardCell,
  trayLayout,
  ROOT_PADDING,
  SLOT_MARGIN_X,
  SLOT_MARGIN_Y,
  TRAY_PADDING,
} from './gameLayout';
import { emptyBoard, isSolved, snapToBoard, type Placements } from './placement';
import { nextHint } from './solve';
import HintButton from './HintButton';
import Turntable from './Turntable';
import { themeAt, type Theme } from './theme';
import { useAudioPlayer } from 'expo-audio';

type Point = { x: number; y: number };
type Source = 'tray' | 'board';

/** carry the piece above the finger so a thumb doesn't hide it */
const LIFT_CELLS = Platform.OS === 'web' ? 0 : 0.9;
/** a press that never really moves counts as a tap, which sends a piece home */
const TAP_SLOP = 6;
const TAP_MS = 350;

/** the flash over a piece a hint just placed: two pulses, then out */
const FLASH_STEPS = [0.55, 0.12, 0.5, 0];
const FLASH_MS = 210;

/**
 * What the first board says before anyone has touched it.
 *
 * Nothing else in the app explains the game, and it does not need to: the second
 * board onwards is the same three moves. So the lesson lives on level one, in
 * the order a player meets it — how a piece gets on the board, how it comes off,
 * and what finishing means — and leaves the moment they pick a piece up.
 */
const LESSON = [
  'Drag a piece from the tray onto the board. A pale outline shows where it will land.',
  'Tap a piece you have placed to send it back to the tray.',
  'Fill every square. Pieces never rotate, and there is exactly one way they all fit.',
];

type Props = {
  level: Level;
  onBack: () => void;
  onSolved?: (levelId: string) => void;
  onNext?: () => void;
  /** the hint bank, owned by the app so it survives leaving the level */
  hints: number;
  hintProgress: number;
  onUseHint: () => boolean;
  /** whether this board had already been finished before this visit */
  alreadySolved: boolean;
  soundOn: boolean;
  /** pull the music down so the finish chime can be heard over it */
  onDuckMusic: () => void;
};

export default function GameScreen({
  level,
  onBack,
  onSolved,
  onNext,
  hints,
  hintProgress,
  onUseHint,
  alreadySolved,
  soundOn,
  onDuckMusic,
}: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  /** the chapter this level belongs to decides what the whole screen looks like */
  const theme = useMemo(() => themeAt(level.index), [level.index]);
  const styles = useMemo(() => makeStyles(theme), [theme]);

  /**
   * Pieces are dressed here rather than in the level. A level is built once and
   * kept for the rest of the session, so a colour stored on the piece would be
   * whichever chapter's colour happened to be current the first time the level
   * was opened — wrong for every chapter after that.
   */
  const shapes = useMemo(() => {
    const dressed: Record<string, Shape> = {};
    for (const piece of level.pieces) {
      dressed[piece.id] = {
        cells: piece.cells,
        ...theme.palette[piece.slot % theme.palette.length],
      };
    }
    return dressed;
  }, [level.pieces, theme]);

  /**
   * Whether they had already finished this board when they opened it.
   *
   * Latched at mount rather than read from the prop each render: solving the
   * board now would otherwise flip it mid-visit, and it decides what hints cost.
   * The screen is keyed by level, so every board gets a fresh answer.
   */
  const [replaying] = useState(() => alreadySolved);

  const [placements, setPlacements] = useState<Placements>(() => emptyBoard(level));
  const [dragId, setDragId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Cell | null>(null);
  /** the piece a hint just revealed, flashed briefly so it is obvious what changed */
  const [flash, setFlash] = useState<{ pieceId: string; step: number } | null>(null);
  /** shown when the hint button is tapped with an empty bank */
  const [hintNote, setHintNote] = useState<string | null>(null);
  /** the how-to-play card: the first board only, and only until it is understood */
  const [lesson, setLesson] = useState(() => level.index === 0 && !alreadySolved);

  const tray = useMemo(() => trayLayout(level, width, height), [height, level, width]);

  const cell = useMemo(
    () => boardCell(level, width, height, insets, tray),
    // insets is a fresh object on some renders, so depend on the numbers
    [height, insets.bottom, insets.top, level, tray, width],
  );

  // gesture callbacks run outside the render cycle, so they read through refs
  const levelRef = useRef(level);
  levelRef.current = level;
  const placementsRef = useRef(placements);
  placementsRef.current = placements;
  const cellRef = useRef(cell);
  cellRef.current = cell;
  const trayCellRef = useRef(tray.cell);
  trayCellRef.current = tray.cell;
  const previewRef = useRef<Cell | null>(preview);

  // ---- where things are on screen (window coordinates) ----
  const rootRef = useRef<View | null>(null);
  const boardRef = useRef<View | null>(null);
  const slotRefs = useRef<Record<string, View | null>>({});
  const layoutRef = useRef<{ root: Point | null; board: Point | null; slots: Record<string, Point> }>({
    root: null,
    board: null,
    slots: {},
  });

  const measure = useCallback(() => {
    rootRef.current?.measureInWindow((x, y) => {
      layoutRef.current.root = { x, y };
    });
    boardRef.current?.measureInWindow((x, y) => {
      layoutRef.current.board = { x, y };
    });
    for (const piece of levelRef.current.pieces) {
      slotRefs.current[piece.id]?.measureInWindow((x, y) => {
        layoutRef.current.slots[piece.id] = { x, y };
      });
    }
  }, []);

  // onLayout is the usual trigger, but measure on mount too: a drag that starts
  // before anything has been measured would otherwise quietly do nothing
  useEffect(() => {
    measure();
  }, [measure]);

  /**
   * Everything is measured against the window, but touches arrive relative to the
   * app's root view (which sits below the status bar on Android). This puts a
   * measured point into the same frame as pageX/pageY — and into the frame the
   * drag layer is positioned in.
   */
  const toRoot = useCallback((point: Point | undefined): Point | null => {
    const root = layoutRef.current.root;
    if (!point || !root) return null;
    return { x: point.x - root.x, y: point.y - root.y };
  }, []);

  // ---- dragging ----
  const pan = useRef(new Animated.ValueXY()).current;
  const dragRef = useRef<{ piece: Piece; originX: number; originY: number; at: number } | null>(null);

  /** nearest legal home for a piece whose top-left corner is at the given point */
  const snapTarget = useCallback(
    (piece: Piece, x: number, y: number): Cell | null => {
      const board = toRoot(layoutRef.current.board ?? undefined);
      if (!board) return null;
      const size = cellRef.current;
      return snapToBoard(
        levelRef.current,
        piece,
        (y - board.y) / size,
        (x - board.x) / size,
        placementsRef.current,
      );
    },
    [toRoot],
  );

  const showPreview = useCallback((target: Cell | null) => {
    const current = previewRef.current;
    if (target?.row === current?.row && target?.col === current?.col) return;
    previewRef.current = target;
    setPreview(target);
  }, []);

  const beginDrag = useCallback(
    (piece: Piece, pageX: number, pageY: number) => {
      const layout = layoutRef.current;
      const size = cellRef.current;
      const from = placementsRef.current[piece.id];
      const board = toRoot(layout.board ?? undefined);
      const origin =
        from && board
          ? { x: board.x + from.col * size, y: board.y + from.row * size }
          : toRoot(layout.slots[piece.id]);
      if (!origin) {
        // nothing measured yet — measure now so the next touch works
        measure();
        return;
      }

      // the piece grows from tray size to board size — keep the finger on the same square
      const sourceCell = from ? size : trayCellRef.current;
      const grabCol = (pageX - origin.x) / sourceCell;
      const grabRow = (pageY - origin.y) / sourceCell;
      const originX = pageX - grabCol * size;
      const originY = pageY - grabRow * size - LIFT_CELLS * size;

      dragRef.current = { piece, originX, originY, at: Date.now() };
      pan.setValue({ x: originX, y: originY });
      showPreview(snapTarget(piece, originX, originY));
      setDragId(piece.id);
    },
    [measure, pan, showPreview, snapTarget, toRoot],
  );

  const moveDrag = useCallback(
    (dx: number, dy: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      const x = drag.originX + dx;
      const y = drag.originY + dy;
      pan.setValue({ x, y });
      showPreview(snapTarget(drag.piece, x, y));
    },
    [pan, showPreview, snapTarget],
  );

  const clearDrag = useCallback(() => {
    dragRef.current = null;
    previewRef.current = null;
    setPreview(null);
    setDragId(null);
  }, []);

  const endDrag = useCallback(
    (dx: number, dy: number) => {
      const drag = dragRef.current;
      if (!drag) return;
      // a tap (rather than a drag) always sends the piece back to the tray
      const tapped =
        Math.abs(dx) < TAP_SLOP && Math.abs(dy) < TAP_SLOP && Date.now() - drag.at < TAP_MS;
      const target = tapped ? null : snapTarget(drag.piece, drag.originX + dx, drag.originY + dy);
      setPlacements((prev) => ({ ...prev, [drag.piece.id]: target }));
      clearDrag();
    },
    [clearDrag, snapTarget],
  );

  // one responder per piece per home, so a view is never swapped or unmounted mid-gesture
  const responders = useRef<Record<string, PanResponderInstance>>({});
  const responderFor = useCallback(
    (piece: Piece, source: Source) => {
      const key = `${piece.id}:${source}`;
      const existing = responders.current[key];
      if (existing) return existing;
      const canGrab = () =>
        source === 'board'
          ? placementsRef.current[piece.id] != null
          : placementsRef.current[piece.id] == null;
      const created = PanResponder.create({
        onStartShouldSetPanResponder: canGrab,
        onMoveShouldSetPanResponder: canGrab,
        onPanResponderGrant: (e) => beginDrag(piece, e.nativeEvent.pageX, e.nativeEvent.pageY),
        onPanResponderMove: (_e, g) => moveDrag(g.dx, g.dy),
        onPanResponderRelease: (_e, g) => endDrag(g.dx, g.dy),
        onPanResponderTerminate: clearDrag,
        onPanResponderTerminationRequest: () => false,
      });
      responders.current[key] = created;
      return created;
    },
    [beginDrag, clearDrag, endDrag, moveDrag],
  );

  const reset = useCallback(() => {
    clearDrag();
    setPlacements(emptyBoard(levelRef.current));
  }, [clearDrag]);

  // if the app is sent to the background mid-drag, don't leave a piece in mid-air
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') clearDrag();
    });
    return () => sub.remove();
  }, [clearDrag]);

  // Android's back gesture returns to the level list
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const solved = isSolved(level, placements);
  const dragPiece = dragId ? level.pieces.find((p) => p.id === dragId) ?? null : null;
  const goingHome = dragPiece != null && preview == null;

  useEffect(() => {
    if (solved) onSolved?.(level.id);
  }, [level.id, onSolved, solved]);

  const chime = useAudioPlayer(require('../assets/complete.wav'));
  const chimed = useRef(false);
  useEffect(() => {
    if (!solved) {
      chimed.current = false;
      return;
    }
    // the effect re-runs on unrelated renders while the board stays solved, so
    // latch it: the chime belongs to finishing, not to being finished
    if (chimed.current || !soundOn) return;
    chimed.current = true;
    onDuckMusic();
    try {
      chime.seekTo(0);
      chime.play();
    } catch {
      // audio is a garnish; never let it break finishing a level
    }
  }, [chime, onDuckMusic, solved, soundOn]);

  /**
   * Reveal one piece in its true home. Anything sitting on those squares goes
   * back to the tray — a hint has to be able to correct a wrong guess, or it
   * would be useless exactly when it is most needed.
   */
  const takeHint = useCallback(() => {
    const current = levelRef.current;
    const hint = nextHint(current, placementsRef.current);
    if (!hint) return;
    // a board they have already finished costs nothing to look at again: the
    // bank is there to make hints count, and this one no longer does
    if (!replaying && !onUseHint()) {
      // the bank is empty, so say when it refills rather than doing nothing
      const minutes = Math.max(1, Math.ceil((1 - hintProgress) * 60));
      setHintNote(minutes === 1 ? 'Next hint in a minute' : `Next hint in ${minutes} minutes`);
      return;
    }
    const piece = current.pieces.find((p) => p.id === hint.pieceId);
    if (!piece) return;
    setFlash({ pieceId: piece.id, step: 0 });
    const claimed = new Set(
      piece.cells.map((c) => cellKey(hint.at.row + c.row, hint.at.col + c.col)),
    );
    setPlacements((placed) => {
      const next = { ...placed };
      for (const other of current.pieces) {
        if (other.id === piece.id) continue;
        const spot = next[other.id];
        if (!spot) continue;
        if (other.cells.some((c) => claimed.has(cellKey(spot.row + c.row, spot.col + c.col)))) {
          next[other.id] = null;
        }
      }
      next[piece.id] = hint.at;
      return next;
    });
  }, [hintProgress, onUseHint, replaying]);

  const celebrate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(celebrate, {
      toValue: solved ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [celebrate, solved]);

  /**
   * "Perfect fit" lands a beat after the tray has swapped out, then springs past
   * its size and settles — so finishing reads as an arrival rather than a label
   * that was already there.
   */
  const titlePop = useRef(new Animated.Value(0)).current;
  const burst = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!solved) {
      titlePop.setValue(0);
      burst.setValue(0);
      return;
    }
    // a loose spring, so it flies well past its size and rocks back rather than
    // easing in — the overshoot is the point, and the ring going out behind it
    // is what makes the whole thing land as an event
    const show = Animated.parallel([
      Animated.sequence([
        Animated.delay(90),
        Animated.spring(titlePop, {
          toValue: 1,
          friction: 3.4,
          tension: 150,
          useNativeDriver: true,
        }),
      ]),
      Animated.sequence([
        Animated.delay(90),
        Animated.timing(burst, {
          toValue: 1,
          duration: 620,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);
    show.start();
    return () => show.stop();
  }, [burst, solved, titlePop]);

  /**
   * Two quick pulses of white over the piece a hint just placed.
   *
   * Stepped through state rather than animated: there are four values and they
   * are meant to be abrupt, so a fade would only soften the one thing the flash
   * exists to do — say "this square is the new one".
   */
  useEffect(() => {
    if (!flash) return;
    const last = flash.step >= FLASH_STEPS.length - 1;
    const timer = setTimeout(
      () => (last ? setFlash(null) : setFlash({ pieceId: flash.pieceId, step: flash.step + 1 })),
      FLASH_MS,
    );
    return () => clearTimeout(timer);
  }, [flash]);

  const lessonFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!lesson) return;
    Animated.timing(lessonFade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [lesson, lessonFade]);

  // The card goes whatever the animation reports back. One left mounted at zero
  // opacity is an invisible sheet over the board, and a board that cannot be
  // touched is worse than a lesson that overstays.
  const dismissLesson = useCallback(() => {
    Animated.timing(lessonFade, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      setLesson(false),
    );
  }, [lessonFade]);

  // Picking a piece up is the lesson being acted on, so it gets out of the way
  // without being dismissed — the card sits over the board, and the first thing
  // it asks for is a piece dropped on the board.
  useEffect(() => {
    if (lesson && dragId) dismissLesson();
  }, [dismissLesson, dragId, lesson]);

  const noteFade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!hintNote) return;
    const show = Animated.sequence([
      Animated.timing(noteFade, { toValue: 1, duration: 160, useNativeDriver: true }),
      Animated.delay(2600),
      Animated.timing(noteFade, { toValue: 0, duration: 260, useNativeDriver: true }),
    ]);
    show.start(({ finished }) => {
      if (finished) setHintNote(null);
    });
    return () => show.stop();
  }, [hintNote, noteFade]);

  const gap = Math.max(1, Math.round(cell * 0.05));
  const radius = Math.max(2, Math.round(cell * 0.2));

  return (
    <View
      ref={rootRef}
      onLayout={measure}
      collapsable={false}
      style={[styles.root, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 10 }]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back to the level list"
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
        >
          <Text style={styles.iconText}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.title} numberOfLines={1}>
            {level.name ? `${level.index + 1}. ${level.name}` : `Level ${level.index + 1}`}
          </Text>
          <Text style={styles.subtitle}>{solved ? 'Solved — a perfect fit.' : level.difficulty}</Text>
        </View>
        {replaying ? (
          <View style={styles.solvedTag}>
            <Text style={styles.solvedTagText}>✓ Solved</Text>
          </View>
        ) : null}
        <HintButton
          hints={hints}
          progress={hintProgress}
          free={replaying}
          disabled={solved}
          onPress={takeHint}
          theme={theme}
        />
        <Pressable
          onPress={reset}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Reset the level"
          style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
        >
          <Text style={styles.resetIcon}>↻</Text>
        </Pressable>
      </View>

      {hintNote ? (
        <Animated.View style={[styles.hintNote, { opacity: noteFade }]} pointerEvents="none">
          <Text style={styles.hintNoteText}>{hintNote}</Text>
        </Animated.View>
      ) : null}

      <View style={styles.boardArea}>
        <View
          ref={boardRef}
          onLayout={measure}
          collapsable={false}
          style={{ width: level.board.cols * cell, height: level.board.rows * cell }}
        >
          {solved ? (
            // nothing is left to place, so the board stops being a board: the
            // picture they made lifts off the screen and turns, and goes on turning
            <Turntable level={level} placements={placements} shapes={shapes} cell={cell} />
          ) : (
            <>
              {level.board.cells.map((c) => (
                <View
                  key={cellKey(c.row, c.col)}
                  style={[
                    styles.socket,
                    {
                      left: c.col * cell + gap,
                      top: c.row * cell + gap,
                      width: cell - gap * 2,
                      height: cell - gap * 2,
                      borderRadius: radius,
                    },
                  ]}
                />
              ))}

              {preview && dragPiece
                ? dragPiece.cells.map((c) => (
                    <View
                      key={`preview:${c.row}:${c.col}`}
                      style={[
                        styles.preview,
                        {
                          left: (preview.col + c.col) * cell + gap,
                          top: (preview.row + c.row) * cell + gap,
                          width: cell - gap * 2,
                          height: cell - gap * 2,
                          borderRadius: radius,
                        },
                      ]}
                    />
                  ))
                : null}

              {level.pieces.map((piece) => {
                const at = placements[piece.id];
                if (!at) return null;
                return (
                  <View
                    key={piece.id}
                    style={{
                      pointerEvents: 'box-none',
                      position: 'absolute',
                      left: at.col * cell,
                      top: at.row * cell,
                      width: piece.cols * cell,
                      height: piece.rows * cell,
                      // hidden, not unmounted: unmounting would kill the gesture mid-drag
                      opacity: piece.id === dragId ? 0 : 1,
                    }}
                  >
                    <Blocks
                      shape={shapes[piece.id]}
                      cell={cell}
                      handlers={responderFor(piece, 'board').panHandlers}
                    />
                    {flash?.pieceId === piece.id ? (
                      <View style={[styles.hintFlash, { opacity: FLASH_STEPS[flash.step] }]}>
                        <Blocks
                          shape={{ cells: piece.cells, color: '#FFFFFF', shade: '#FFFFFF' }}
                          cell={cell}
                        />
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </>
          )}
        </View>

        {lesson ? (
          <Animated.View style={[styles.lessonWrap, { opacity: lessonFade }]} pointerEvents="box-none">
            <View style={styles.lessonCard}>
              <Text style={styles.lessonTitle}>How to play</Text>
              {LESSON.map((line, i) => (
                <View key={line} style={styles.lessonStep}>
                  <View style={styles.lessonNumber}>
                    <Text style={styles.lessonNumberText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.lessonText}>{line}</Text>
                </View>
              ))}
              <Text style={styles.lessonFoot}>
                Stuck? The clock at the top drops one piece into its true home.
              </Text>
              <Pressable
                onPress={dismissLesson}
                accessibilityRole="button"
                accessibilityLabel="Got it — start playing"
                style={({ pressed }) => [styles.lessonButton, pressed && styles.pressed]}
              >
                <Text style={styles.lessonButtonText}>Got it</Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}
      </View>

      <View style={[styles.tray, goingHome && styles.trayHot]}>
        {solved ? (
          <Animated.View
            style={[
              styles.banner,
              {
                opacity: celebrate,
                transform: [
                  { translateY: celebrate.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
                ],
              },
            ]}
          >
            <View style={styles.titleWrap}>
              <Animated.View
                style={[
                  styles.burst,
                  {
                    opacity: burst.interpolate({
                      inputRange: [0, 0.15, 1],
                      outputRange: [0, 0.55, 0],
                    }),
                    transform: [
                      { scale: burst.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1.9] }) },
                    ],
                  },
                ]}
                pointerEvents="none"
              />
              <Animated.Text
                style={[
                  styles.bannerTitle,
                  {
                    // up to full brightness in the first third of the swing, so
                    // the overshoot happens in view rather than behind a fade
                    opacity: titlePop.interpolate({
                      inputRange: [0, 0.35, 1],
                      outputRange: [0, 1, 1],
                      extrapolate: 'clamp',
                    }),
                    transform: [
                      { scale: titlePop.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
                      {
                        rotate: titlePop.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['-16deg', '0deg'],
                        }),
                      },
                      {
                        translateY: titlePop.interpolate({
                          inputRange: [0, 1],
                          outputRange: [30, 0],
                          extrapolate: 'clamp',
                        }),
                      },
                    ],
                  },
                ]}
              >
                Perfect fit
              </Animated.Text>
            </View>
            <Pressable
              onPress={onNext ?? onBack}
              accessibilityRole="button"
              accessibilityLabel={onNext ? 'Continue to the next level' : 'Back to the level list'}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            >
              <Text style={styles.primaryButtonText}>{onNext ? 'Continue' : 'All levels'}</Text>
            </Pressable>
          </Animated.View>
        ) : (
          <View style={styles.trayRow}>
            {level.pieces.map((piece) => (
              <View key={piece.id} style={styles.slot}>
                <View
                  ref={(node) => {
                    slotRefs.current[piece.id] = node;
                  }}
                  onLayout={measure}
                  collapsable={false}
                  style={{ width: piece.cols * tray.cell, height: piece.rows * tray.cell }}
                  {...responderFor(piece, 'tray').panHandlers}
                >
                  <Blocks
                    shape={shapes[piece.id]}
                    cell={tray.cell}
                    faded={placements[piece.id] != null || piece.id === dragId}
                    ghost={theme.ghost}
                  />
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {dragPiece ? (
        <Animated.View
          style={{
            pointerEvents: 'none',
            position: 'absolute',
            left: 0,
            top: 0,
            width: dragPiece.cols * cell,
            height: dragPiece.rows * cell,
            transform: pan.getTranslateTransform(),
          }}
        >
          <Blocks shape={shapes[dragPiece.id]} cell={cell} lifted />
        </Animated.View>
      ) : null}
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      // transparent: the drifting shapes behind the app show through
      backgroundColor: 'transparent',
      paddingHorizontal: ROOT_PADDING,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingBottom: 4,
    },
    headerText: {
      flex: 1,
    },
    title: {
      color: theme.text,
      fontSize: 21,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    subtitle: {
      color: theme.textDim,
      fontSize: 13,
      marginTop: 2,
    },
    iconButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.panel,
      borderWidth: 1,
      borderColor: theme.panelEdge,
    },
    iconText: {
      color: theme.text,
      fontSize: 26,
      lineHeight: 30,
      fontWeight: '600',
    },
    pressed: {
      opacity: 0.65,
    },
    reset: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      // set apart from the hint clock, so neither gets pressed by mistake
      marginLeft: 8,
      backgroundColor: theme.panel,
      borderWidth: 1,
      borderColor: theme.panelEdge,
    },
    resetIcon: {
      color: theme.text,
      fontSize: 20,
      lineHeight: 24,
      fontWeight: '700',
    },
    boardArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    socket: {
      position: 'absolute',
      backgroundColor: theme.socket,
      borderWidth: 1,
      borderColor: theme.socketEdge,
    },
    preview: {
      position: 'absolute',
      backgroundColor: theme.preview,
      borderWidth: 1.5,
      borderColor: theme.previewEdge,
    },
    tray: {
      borderRadius: 22,
      backgroundColor: theme.panel,
      borderWidth: 1.5,
      borderColor: theme.panelEdge,
      paddingVertical: 12,
      paddingHorizontal: TRAY_PADDING,
      justifyContent: 'center',
    },
    trayHot: {
      borderColor: theme.panelEdgeHot,
    },
    trayRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'center',
    },
    slot: {
      marginHorizontal: SLOT_MARGIN_X,
      marginVertical: SLOT_MARGIN_Y,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hintFlash: {
      position: 'absolute',
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      pointerEvents: 'none',
    },
    solvedTag: {
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 999,
      backgroundColor: theme.panel,
      borderWidth: 1.5,
      borderColor: theme.panelEdgeHot,
    },
    solvedTagText: {
      color: theme.accent,
      fontSize: 11.5,
      fontWeight: '800',
    },
    // the lesson covers the board rather than sitting above it: there is no
    // spare height on a small phone, and a card that took some would shrink
    // every board on every screen for the sake of one card on level one
    lessonWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
      // enough to hold the card off the board without hiding it: the tray below
      // is uncovered, so the first step has something to point at
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderRadius: 22,
    },
    lessonCard: {
      maxWidth: 340,
      borderRadius: 20,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 14,
      backgroundColor: theme.panel,
      borderWidth: 1.5,
      borderColor: theme.panelEdgeHot,
      boxShadow: '0px 10px 24px rgba(0,0,0,0.45)',
    },
    lessonTitle: {
      color: theme.text,
      fontSize: 19,
      fontWeight: '800',
      marginBottom: 12,
    },
    lessonStep: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      marginBottom: 10,
    },
    lessonNumber: {
      width: 21,
      height: 21,
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent,
    },
    lessonNumberText: {
      color: theme.accentInk,
      fontSize: 12,
      fontWeight: '800',
    },
    lessonText: {
      flex: 1,
      color: theme.text,
      fontSize: 14,
      lineHeight: 20,
    },
    lessonFoot: {
      color: theme.textDim,
      fontSize: 12.5,
      lineHeight: 18,
      marginTop: 2,
    },
    lessonButton: {
      alignSelf: 'stretch',
      marginTop: 14,
      paddingVertical: 13,
      borderRadius: 14,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    lessonButtonText: {
      color: theme.accentInk,
      fontSize: 16,
      fontWeight: '800',
    },
    hintNote: {
      position: 'absolute',
      top: 54,
      right: ROOT_PADDING,
      zIndex: 10,
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: theme.panel,
      borderWidth: 1.5,
      borderColor: theme.panelEdgeHot,
    },
    hintNoteText: {
      color: theme.accent,
      fontSize: 13,
      fontWeight: '700',
    },
    banner: {
      alignSelf: 'stretch',
      alignItems: 'center',
      paddingVertical: 4,
    },
    titleWrap: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    burst: {
      position: 'absolute',
      left: -34,
      right: -34,
      top: -16,
      bottom: -16,
      borderRadius: 999,
      borderWidth: 2,
      borderColor: theme.accent,
      backgroundColor: theme.accentSoft,
    },
    bannerTitle: {
      color: theme.accent,
      fontSize: 26,
      fontWeight: '800',
      letterSpacing: 0.3,
    },
    primaryButton: {
      alignSelf: 'stretch',
      marginTop: 16,
      paddingVertical: 20,
      borderRadius: 18,
      backgroundColor: theme.accent,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: theme.accentInk,
      fontSize: 19,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
  });
