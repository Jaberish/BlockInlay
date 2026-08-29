import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Blocks from './Blocks';
import { getLevel, type Level } from './levels';
import {
  buildMenu,
  heightOf,
  itemAtOffset,
  scrubOffset,
  worthScrubbing,
  GRID_GAP,
  ROW_HEIGHT,
  SECTION_HEIGHT,
  TILE_HEIGHT,
  type Item,
} from './menuLayout';
import { themeAt, type Theme } from './theme';

const PADDING = 18;
/** the fixed box each board silhouette is scaled to fit */
const THUMB_HEIGHT = 84;
/** the grab strip down the right edge, and the bar drawn inside it */
const SCRUBBER_WIDTH = 30;
const BAR_WIDTH = 6;
const MIN_THUMB = 48;

type Props = {
  solved: ReadonlySet<string>;
  /** false until saved progress has been read, so the list opens in the right place */
  loaded: boolean;
  /** the level the list should open on, or -1 to open at the very top */
  landAt: number;
  /** how many boards from the start can be opened; the rest are shown face down */
  open: number;
  /** how many boards the list holds at all */
  shown: number;
  onPick: (levelId: string) => void;
  onOpenSettings: () => void;
  /** the chapter the player is up to — the menu wears its colours */
  theme: Theme;
};

/**
 * The board shape, scaled to fit the tile's thumbnail box.
 *
 * Drawn in its *own* chapter's colours rather than the list's, so scrolling
 * shows the colour changing every ten levels and a tile is a fair preview of
 * what opening it looks like.
 */
function BoardThumb({
  level,
  width,
  solved,
}: {
  level: Level;
  width: number;
  solved: boolean;
}) {
  const theme = themeAt(level.index);
  const cell = Math.max(
    3,
    Math.floor(Math.min(width / level.board.cols, THUMB_HEIGHT / level.board.rows)),
  );
  return (
    <View style={[thumbBox, { height: THUMB_HEIGHT }]}>
      <View style={{ width: level.board.cols * cell, height: level.board.rows * cell }}>
        <Blocks
          shape={{
            cells: level.board.cells,
            color: solved ? theme.thumbSolved : theme.thumb,
            shade: solved ? theme.thumbSolvedShade : theme.thumbShade,
          }}
          cell={cell}
        />
      </View>
    </View>
  );
}

export default function MenuScreen({
  solved,
  loaded,
  landAt,
  open,
  shown,
  onPick,
  onOpenSettings,
  theme,
}: Props) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Item>>(null);

  const columns = width >= 700 ? 3 : 2;
  const tileWidth = Math.floor(
    (width - PADDING * 2 - SCRUBBER_WIDTH - GRID_GAP * (columns - 1)) / columns,
  );
  const { items, itemOfLevel, offsets, height } = useMemo(
    () => buildMenu(columns, shown),
    [columns, shown],
  );

  const [listHeight, setListHeight] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubLabel, setScrubLabel] = useState('');
  const scrollY = useRef(new Animated.Value(0)).current;
  const grabbedAt = useRef(0);

  const maxScroll = Math.max(1, height - listHeight);
  const thumbHeight = Math.max(
    MIN_THUMB,
    listHeight > 0 ? (listHeight * listHeight) / height : MIN_THUMB,
  );
  const travel = Math.max(1, listHeight - thumbHeight);
  /** a list that fits on the screen has nowhere to be flown to */
  const scrubbable = worthScrubbing(height, listHeight);

  const thumbY = scrollY.interpolate({
    inputRange: [0, maxScroll],
    outputRange: [0, travel],
    extrapolate: 'clamp',
  });

  /** drag anywhere on the strip to fly through the list */
  const scrubTo = useCallback(
    (y: number) => {
      const offset = scrubOffset(y, thumbHeight, travel, maxScroll);
      list.current?.scrollToOffset({ offset, animated: false });
      const item = items[itemAtOffset(offsets, offset)];
      setScrubLabel(item?.kind === 'row' ? `${item.levels[0] + 1}` : (item?.label ?? ''));
    },
    [items, maxScroll, offsets, thumbHeight, travel],
  );

  const scrubber = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          setScrubbing(true);
          grabbedAt.current = event.nativeEvent.locationY;
          scrubTo(grabbedAt.current);
        },
        // dy rather than absolute coordinates: it needs no page-vs-view bookkeeping
        onPanResponderMove: (_event, gesture) => scrubTo(grabbedAt.current + gesture.dy),
        onPanResponderRelease: () => setScrubbing(false),
        onPanResponderTerminate: () => setScrubbing(false),
      }),
    [scrubTo],
  );

  /**
   * Land on the level the player is on.
   *
   * Deliberately *not* `initialScrollIndex`. That prop only chooses which cells
   * get built first — it never moves the scroll position — and worse, while it
   * is set `VirtualizedList` refuses to recompute its window whenever the offset
   * is exactly zero, on the grounds that it must be the initial render. So the
   * one place the list would not re-render was the very top: scrubbing there
   * left the first levels unbuilt and the screen blank, while every other
   * position worked. Scrolling by hand costs eight tiles built at the top before
   * the jump, and nothing else.
   *
   * Latched against `columns` rather than a bare flag because a width change
   * remounts the list, and a remounted list starts back at the top.
   */
  const landedFor = useRef<number | null>(null);
  const land = useCallback(() => {
    if (landedFor.current === columns || landAt < 0) return;
    const item = itemOfLevel[landAt];
    if (item === undefined || item < 0) return;
    landedFor.current = columns;
    list.current?.scrollToOffset({ offset: offsets[item], animated: false });
  }, [columns, itemOfLevel, landAt, offsets]);

  // `getItemLayout` means the list knows its full height before it has measured
  // anything, so this commit is late enough to scroll; the content-size callback
  // below is the backstop for a platform that only settles after layout
  useLayoutEffect(land, [land]);

  const layout = useCallback(
    (_data: ArrayLike<Item> | null | undefined, index: number) => ({
      length: heightOf(items[index]),
      offset: offsets[index] ?? 0,
      index,
    }),
    [items, offsets],
  );

  const renderItem = useCallback(
    ({ item }: { item: Item }) => {
      if (item.kind === 'section') {
        return (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{item.label}</Text>
            <Text style={styles.sectionCount}>{item.count}</Text>
          </View>
        );
      }
      return (
        <View style={[styles.row, { gap: GRID_GAP, height: ROW_HEIGHT }]}>
          {item.levels.map((index) => {
            // a locked tile never builds its level: the board it holds is the
            // one thing it is not saying
            if (index >= open) {
              return (
                <View
                  key={`locked:${index}`}
                  accessible
                  accessibilityLabel={`Level ${index + 1}, locked`}
                  style={[styles.tile, styles.tileLocked, { width: tileWidth, height: TILE_HEIGHT }]}
                >
                  <View style={styles.tileTop}>
                    <Text style={styles.number}>{index + 1}</Text>
                  </View>
                  <View style={[thumbBox, { height: THUMB_HEIGHT }]}>
                    <Text style={styles.lockedMark}>?</Text>
                  </View>
                  <Text style={styles.name}>Locked</Text>
                  <Text style={styles.meta} numberOfLines={1}>
                    Unlocks as you solve
                  </Text>
                </View>
              );
            }
            const level = getLevel(index);
            const isSolved = solved.has(level.id);
            return (
              <Pressable
                key={level.id}
                onPress={() => onPick(level.id)}
                accessibilityRole="button"
                accessibilityLabel={`Level ${index + 1}${level.name ? `, ${level.name}` : ''}, ${
                  level.difficulty
                }${isSolved ? ', solved' : ''}`}
                style={({ pressed }) => [
                  styles.tile,
                  { width: tileWidth, height: TILE_HEIGHT },
                  isSolved && styles.tileSolved,
                  pressed && styles.tilePressed,
                ]}
              >
                <View style={styles.tileTop}>
                  <Text style={styles.number}>{index + 1}</Text>
                  {isSolved ? <Text style={styles.tick}>✓</Text> : null}
                </View>
                <BoardThumb level={level} width={tileWidth - 24} solved={isSolved} />
                <Text style={styles.name} numberOfLines={1}>
                  {level.name ?? level.difficulty}
                </Text>
                <Text style={styles.meta}>
                  {level.name ? `${level.difficulty} · ` : ''}
                  {level.pieces.length} pieces
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    },
    [onPick, open, solved, styles, tileWidth],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Block Inlay</Text>
          <Text style={styles.subtitle}>
            {solved.size > 0 ? `${solved.size.toLocaleString()} solved · ` : ''}
            every board has exactly one perfect fit
          </Text>
        </View>
        <Pressable
          onPress={onOpenSettings}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Settings"
          style={({ pressed }) => [styles.settingsButton, pressed && styles.tilePressed]}
        >
          <Text style={styles.settingsIcon}>⚙</Text>
        </Pressable>
      </View>

      <View style={styles.body} onLayout={(e) => setListHeight(e.nativeEvent.layout.height)}>
        {loaded ? (
          <FlatList
            ref={list}
            // numColumns is baked into the rows, so a width change has to rebuild them
            key={columns}
            data={items}
            renderItem={renderItem}
            keyExtractor={(item) => item.key}
            getItemLayout={layout}
            // `land` above is what opens the list where the player left off
            onContentSizeChange={land}
            initialNumToRender={8}
            windowSize={7}
            scrollEventThrottle={16}
            onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: false,
            })}
            contentContainerStyle={{
              paddingLeft: PADDING,
              paddingRight: PADDING + SCRUBBER_WIDTH - GRID_GAP,
              paddingBottom: insets.bottom + 24,
            }}
            showsVerticalScrollIndicator={false}
          />
        ) : null}

        {scrubbable ? (
          <View style={styles.scrubber} {...scrubber.panHandlers}>
            <View style={styles.scrubberTrack} />
            <Animated.View
              style={[
                styles.scrubberThumb,
                scrubbing && styles.scrubberThumbHeld,
                { height: thumbHeight, transform: [{ translateY: thumbY }] },
              ]}
            />
          </View>
        ) : null}

        {scrubbing && scrubbable ? (
          <Animated.View style={[styles.scrubBubble, { transform: [{ translateY: thumbY }] }]}>
            <Text style={styles.scrubBubbleText}>{scrubLabel}</Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

/** no colour in it, so it is the same in every theme */
const thumbBox = {
  alignItems: 'center',
  justifyContent: 'center',
  marginVertical: 8,
} as const;

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    root: {
      flex: 1,
      // transparent: the drifting shapes behind the app show through
      backgroundColor: 'transparent',
    },
    body: {
      flex: 1,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingHorizontal: PADDING,
      paddingBottom: 14,
    },
    headerText: {
      flex: 1,
    },
    settingsButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.panel,
      borderWidth: 1,
      borderColor: theme.panelEdge,
    },
    settingsIcon: {
      color: theme.text,
      fontSize: 19,
      lineHeight: 23,
    },
    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: '800',
      letterSpacing: 0.2,
    },
    subtitle: {
      color: theme.textDim,
      fontSize: 13,
      marginTop: 4,
    },
    scrubber: {
      position: 'absolute',
      right: 0,
      top: 0,
      bottom: 0,
      width: SCRUBBER_WIDTH,
      alignItems: 'center',
    },
    scrubberTrack: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      borderRadius: 1,
      backgroundColor: theme.panelEdge,
    },
    scrubberThumb: {
      width: BAR_WIDTH,
      borderRadius: BAR_WIDTH / 2,
      backgroundColor: theme.panelEdgeHot,
    },
    scrubberThumbHeld: {
      width: BAR_WIDTH + 4,
      borderRadius: (BAR_WIDTH + 4) / 2,
      backgroundColor: theme.accent,
    },
    scrubBubble: {
      position: 'absolute',
      right: SCRUBBER_WIDTH + 2,
      top: 0,
      minWidth: 62,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 999,
      backgroundColor: theme.panel,
      borderWidth: 1.5,
      borderColor: theme.panelEdgeHot,
      alignItems: 'center',
    },
    scrubBubbleText: {
      color: theme.accent,
      fontSize: 15,
      fontWeight: '800',
    },
    section: {
      height: SECTION_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingBottom: 8,
    },
    sectionLabel: {
      color: theme.text,
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
    },
    sectionCount: {
      color: theme.textDim,
      fontSize: 13,
      fontWeight: '700',
    },
    row: {
      flexDirection: 'row',
    },
    tile: {
      backgroundColor: theme.panel,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: theme.panelEdge,
      paddingHorizontal: 12,
      paddingTop: 10,
      paddingBottom: 12,
    },
    tileSolved: {
      borderColor: theme.panelEdgeHot,
    },
    tileLocked: {
      // no panel fill: a board that is not there yet should not sit as solidly
      // on the page as the ones that are
      backgroundColor: 'transparent',
    },
    lockedMark: {
      color: theme.textDim,
      fontSize: 40,
      fontWeight: '800',
      opacity: 0.45,
    },
    tilePressed: {
      opacity: 0.7,
    },
    tileTop: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: 18,
    },
    number: {
      color: theme.textDim,
      fontSize: 13,
      fontWeight: '800',
    },
    tick: {
      color: theme.accent,
      fontSize: 14,
      fontWeight: '800',
    },
    name: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    meta: {
      color: theme.textDim,
      fontSize: 12,
      marginTop: 2,
    },
  });
