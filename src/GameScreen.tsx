import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  AppState,
  BackHandler,
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
import Blocks from './Blocks';
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
import { theme } from './theme';

type Point = { x: number; y: number };
type Source = 'tray' | 'board';

/** carry the piece above the finger so a thumb doesn't hide it */
const LIFT_CELLS = Platform.OS === 'web' ? 0 : 0.9;
/** a press that never really moves counts as a tap, which sends a piece home */
const TAP_SLOP = 6;
const TAP_MS = 350;


type Props = {
  level: Level;
  onBack: () => void;
  onSolved?: (levelId: string) => void;
  onNext?: () => void;
};

export default function GameScreen({ level, onBack, onSolved, onNext }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [placements, setPlacements] = useState<Placements>(() => emptyBoard(level));
  const [dragId, setDragId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Cell | null>(null);

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

  const celebrate = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(celebrate, {
      toValue: solved ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [celebrate, solved]);

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
            {level.index + 1}. {level.name}
          </Text>
          <Text style={styles.subtitle}>{solved ? 'Solved — a perfect fit.' : level.difficulty}</Text>
        </View>
        <Pressable
          onPress={reset}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Reset the level"
          style={({ pressed }) => [styles.reset, pressed && styles.pressed]}
        >
          <Text style={styles.resetText}>Reset</Text>
        </Pressable>
      </View>

      <View style={styles.boardArea}>
        <View
          ref={boardRef}
          onLayout={measure}
          collapsable={false}
          style={{ width: level.board.cols * cell, height: level.board.rows * cell }}
        >
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
                <Blocks shape={piece} cell={cell} handlers={responderFor(piece, 'board').panHandlers} />
              </View>
            );
          })}
        </View>
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
            <Text style={styles.bannerTitle}>Perfect fit</Text>
            <Text style={styles.bannerText}>
              {level.pieces.length} pieces in, not a square left over.
            </Text>
            <View style={styles.bannerButtons}>
              <Pressable onPress={reset} style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}>
                <Text style={styles.ghostButtonText}>Play again</Text>
              </Pressable>
              {onNext ? (
                <Pressable onPress={onNext} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <Text style={styles.primaryButtonText}>Next level</Text>
                </Pressable>
              ) : (
                <Pressable onPress={onBack} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                  <Text style={styles.primaryButtonText}>All levels</Text>
                </Pressable>
              )}
            </View>
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
                    shape={piece}
                    cell={tray.cell}
                    faded={placements[piece.id] != null || piece.id === dragId}
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
          <Blocks shape={dragPiece} cell={cell} lifted />
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
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
    paddingHorizontal: 15,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelEdge,
  },
  resetText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: '600',
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
  banner: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  bannerTitle: {
    color: theme.accent,
    fontSize: 22,
    fontWeight: '800',
  },
  bannerText: {
    color: theme.textDim,
    fontSize: 14,
    marginTop: 4,
  },
  bannerButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  ghostButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelEdge,
  },
  ghostButtonText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
  },
  primaryButton: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: theme.accent,
  },
  primaryButtonText: {
    color: '#2A0A14',
    fontSize: 15,
    fontWeight: '800',
  },
});
