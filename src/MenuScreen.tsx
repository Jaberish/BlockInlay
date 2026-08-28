import React, { useCallback, useMemo, useRef } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Blocks from './Blocks';
import { LEVELS, type Level } from './levels';
import {
  buildMenu,
  heightOf,
  GRID_GAP,
  ROW_HEIGHT,
  SECTION_HEIGHT,
  TILE_HEIGHT,
  type Item,
} from './menuLayout';
import { theme } from './theme';

const PADDING = 18;
/** the fixed box each board silhouette is scaled to fit */
const THUMB_HEIGHT = 84;

type Props = {
  solved: ReadonlySet<string>;
  onPick: (levelId: string) => void;
  onOpenSettings: () => void;
};

/** the board shape, scaled to fit the tile's thumbnail box */
function BoardThumb({ level, width, solved }: { level: Level; width: number; solved: boolean }) {
  const cell = Math.max(
    3,
    Math.floor(Math.min(width / level.board.cols, THUMB_HEIGHT / level.board.rows)),
  );
  return (
    <View style={[styles.thumbBox, { height: THUMB_HEIGHT }]}>
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

export default function MenuScreen({ solved, onPick, onOpenSettings }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<Item>>(null);

  const columns = width >= 700 ? 3 : 2;
  const tileWidth = Math.floor((width - PADDING * 2 - GRID_GAP * (columns - 1)) / columns);
  const { items, itemOfLevel, offsets } = useMemo(() => buildMenu(columns), [columns]);

  const next = useMemo(() => LEVELS.find((level) => !solved.has(level.id)), [solved]);

  const jumpToNext = useCallback(() => {
    if (!next) return;
    list.current?.scrollToIndex({ index: itemOfLevel[next.index], viewPosition: 0.35, animated: true });
  }, [itemOfLevel, next]);

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
          {item.levels.map((level) => {
            const isSolved = solved.has(level.id);
            return (
              <Pressable
                key={level.id}
                onPress={() => onPick(level.id)}
                accessibilityRole="button"
                accessibilityLabel={`Level ${level.index + 1}, ${level.name}, ${level.difficulty}${
                  isSolved ? ', solved' : ''
                }`}
                style={({ pressed }) => [
                  styles.tile,
                  { width: tileWidth, height: TILE_HEIGHT },
                  isSolved && styles.tileSolved,
                  pressed && styles.tilePressed,
                ]}
              >
                <View style={styles.tileTop}>
                  <Text style={styles.number}>{level.index + 1}</Text>
                  {isSolved ? <Text style={styles.tick}>✓</Text> : null}
                </View>
                <BoardThumb level={level} width={tileWidth - 24} solved={isSolved} />
                <Text style={styles.name} numberOfLines={1}>
                  {level.name}
                </Text>
                <Text style={styles.meta}>
                  {level.difficulty} · {level.pieces.length} pieces
                </Text>
              </Pressable>
            );
          })}
        </View>
      );
    },
    [onPick, solved, tileWidth],
  );

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Block Inlay</Text>
          <Text style={styles.subtitle}>
            {LEVELS.length} boards · every one has exactly one perfect fit
            {solved.size > 0 ? ` · ${solved.size} solved` : ''}
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

      {next && next.index > 0 ? (
        <Pressable
          onPress={jumpToNext}
          accessibilityRole="button"
          style={({ pressed }) => [styles.continueButton, pressed && styles.tilePressed]}
        >
          <Text style={styles.continueText}>Jump to level {next.index + 1}</Text>
        </Pressable>
      ) : null}

      <FlatList
        ref={list}
        // numColumns is baked into the rows, so a width change has to rebuild them
        key={columns}
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        getItemLayout={layout}
        initialNumToRender={8}
        windowSize={7}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: PADDING, paddingBottom: insets.bottom + 24 }}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
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
  continueButton: {
    alignSelf: 'flex-start',
    marginHorizontal: PADDING,
    marginBottom: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelEdgeHot,
  },
  continueText: {
    color: theme.accent,
    fontSize: 13,
    fontWeight: '700',
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
  thumbBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
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
