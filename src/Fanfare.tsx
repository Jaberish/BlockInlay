import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ORIGIN, THROW_MS, fadeOf, flightOf, thrown } from './confetti';
import type { Theme } from './theme';

type Props = {
  theme: Theme;
  /** the device has asked for less movement, so throw nothing */
  still: boolean;
};

/**
 * The confetti over the last board.
 *
 * Squares in the piece colours rather than paper streamers: the player has spent
 * five thousand boards putting these down one at a time, and the last board
 * finishing with them thrown into the air is worth more than generic celebration.
 *
 * One clock drives all forty-six of them. Each fleck reads its own arc off that
 * clock (see `fanfare.ts`) instead of running an animation of its own, so the
 * whole burst is one value being interpolated forty-six ways rather than
 * forty-six animations that have to be kept in step.
 */
export default function Fanfare({ theme, still }: Props) {
  const { width, height } = useWindowDimensions();
  const flecks = useMemo(() => thrown(), []);
  const clock = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) return;
    // linear, because the shape of the flight is in the arc rather than in the
    // easing: the clock is only how far through the throw we are
    const run = Animated.timing(clock, {
      toValue: 1,
      duration: THROW_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    run.start();
    return () => run.stop();
  }, [clock, still]);

  if (still) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {flecks.map((fleck, i) => {
        const flight = flightOf(fleck);
        const fade = fadeOf(fleck);
        const swatch = theme.palette[fleck.tint % theme.palette.length];
        const lip = Math.max(1, Math.round(fleck.size * 0.16));
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: (ORIGIN.x + fleck.from) * width - fleck.size / 2,
              top: ORIGIN.y * height,
              width: fleck.size,
              height: fleck.size,
              borderRadius: Math.max(2, fleck.size * 0.24),
              backgroundColor: swatch.shade,
              opacity: clock.interpolate({
                inputRange: fade.at,
                outputRange: fade.opacity,
                extrapolate: 'clamp',
              }),
              transform: [
                {
                  translateX: clock.interpolate({
                    inputRange: flight.at,
                    outputRange: flight.across.map((a) => a * width),
                    extrapolate: 'clamp',
                  }),
                },
                {
                  translateY: clock.interpolate({
                    inputRange: flight.at,
                    outputRange: flight.up.map((u) => u * height),
                    extrapolate: 'clamp',
                  }),
                },
                {
                  rotate: clock.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', `${Math.round(fleck.spin)}deg`],
                  }),
                },
              ],
            }}
          >
            {/* the same raised top face the pieces are drawn with, so a fleck
                reads as one of them rather than as a coloured dot */}
            <View
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: 0,
                bottom: lip,
                borderRadius: Math.max(2, fleck.size * 0.24),
                backgroundColor: swatch.color,
              }}
            />
          </Animated.View>
        );
      })}
    </View>
  );
}
