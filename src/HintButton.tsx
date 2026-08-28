import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MAX_HINTS } from './hintBank';
import { theme } from './theme';

const SIZE = 44;
/** twelve ticks round the edge — one per five minutes of the refill hour */
const TICKS = 12;
const TICK_LENGTH = 5;
const TICK_WIDTH = 2.5;

type Props = {
  hints: number;
  /** 0..1 through the current hour; 1 when the bank is full */
  progress: number;
  disabled?: boolean;
  onPress: () => void;
};

/**
 * The hint bank, drawn as a clock.
 *
 * The ring is ticks rather than an arc because an arc needs either SVG or the
 * two-rotated-halves trick, and neither earns its keep for something that moves
 * once every five minutes. Twelve ticks say "an hour" more plainly anyway.
 */
export default function HintButton({ hints, progress, disabled, onPress }: Props) {
  const full = hints >= MAX_HINTS;
  const lit = full ? TICKS : Math.floor(progress * TICKS);
  const empty = hints <= 0;
  const minutesLeft = Math.max(1, Math.ceil((1 - progress) * 60));

  return (
    <Pressable
      onPress={onPress}
      // still pressable when empty: tapping is how you ask when the next one lands
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={
        empty
          ? `No hints left, one more in about ${minutesLeft} minutes`
          : `Use a hint, ${hints} left`
      }
      style={({ pressed }) => [styles.button, pressed && !disabled && styles.pressed]}
    >
      {Array.from({ length: TICKS }, (_, i) => (
        <View
          key={i}
          style={[
            styles.tick,
            {
              backgroundColor: i < lit ? theme.accent : theme.panelEdge,
              transform: [
                { rotate: `${(i * 360) / TICKS}deg` },
                { translateY: -(SIZE / 2 - TICK_LENGTH / 2 - 1) },
              ],
            },
          ]}
        />
      ))}
      <Text style={[styles.count, (empty || disabled) && styles.countSpent]}>{hints}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelEdge,
  },
  pressed: {
    opacity: 0.7,
  },
  tick: {
    position: 'absolute',
    width: TICK_WIDTH,
    height: TICK_LENGTH,
    borderRadius: TICK_WIDTH / 2,
  },
  count: {
    color: theme.accent,
    fontSize: 16,
    fontWeight: '800',
  },
  countSpent: {
    color: theme.textDim,
  },
});
