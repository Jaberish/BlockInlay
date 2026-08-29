import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SHAPES, SHELL_ALPHA, shellScales, type Shape } from './backdropShapes';
import type { Theme } from './theme';

/**
 * The shapes drifting behind everything.
 *
 * Soft edges without a blur filter. `filter: blur()` would be one line, but on
 * Android it needs API 31 and silently does nothing below it — which would turn
 * these into hard-edged circles on exactly the phones least able to hide it. So
 * each shape is a stack of copies of itself at growing sizes and low opacity:
 * where many overlap it is dense, and towards the edge fewer and fewer do. That
 * is a soft falloff built out of nothing but background colour, which every
 * version of every platform draws the same way.
 *
 * Everything here is decoration. It never takes a touch, it never re-renders in
 * response to play, and the whole thing sits still if the device asks for less
 * motion.
 */

/** the copies of one shape: the innermost is the core, each one out is bigger and fainter */
const shells = (width: number, height: number, corners: Shape['corners']) =>
  shellScales().map((scale, i) => {
    return {
      key: i,
      scale,
      style: {
        position: 'absolute' as const,
        left: 0,
        top: 0,
        width,
        height,
        borderTopLeftRadius: width * corners[0],
        borderTopRightRadius: width * corners[1],
        borderBottomRightRadius: width * corners[2],
        borderBottomLeftRadius: width * corners[3],
        opacity: SHELL_ALPHA,
      },
    };
  });

function Drift({
  shape,
  color,
  screen,
  still,
}: {
  shape: Shape;
  color: string;
  screen: { width: number; height: number };
  still: boolean;
}) {
  const lap = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (still) {
      lap.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(lap, {
        toValue: 1,
        duration: shape.period * 1000,
        // linear, so the lap has no start or finish to notice
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [lap, shape.period, still]);

  const span = Math.max(screen.width, screen.height) * shape.size;
  const width = span;
  const height = span * shape.aspect;
  const stack = useMemo(() => shells(width, height, shape.corners), [height, shape.corners, width]);
  const stops = shape.path.map((_, i) => i / (shape.path.length - 1));

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: screen.width * shape.x - width / 2,
        top: screen.height * shape.y - height / 2,
        width,
        height,
        transform: [
          {
            translateX: lap.interpolate({
              inputRange: stops,
              outputRange: shape.path.map(([dx]) => dx * span),
            }),
          },
          {
            translateY: lap.interpolate({
              inputRange: stops,
              outputRange: shape.path.map(([, dy]) => dy * span),
            }),
          },
          {
            rotate: lap.interpolate({
              inputRange: [0, 1],
              outputRange: ['0deg', `${shape.spin * 360}deg`],
            }),
          },
          {
            scale: lap.interpolate({
              inputRange: [0, 0.5, 1],
              outputRange: [1, 1 + shape.breathe, 1],
            }),
          },
        ],
      }}
    >
      {stack.map((shell) => (
        <View
          key={shell.key}
          style={[shell.style, { backgroundColor: color, transform: [{ scale: shell.scale }] }]}
        />
      ))}
    </Animated.View>
  );
}

export default function Backdrop({ theme }: { theme: Theme }) {
  const { width, height } = useWindowDimensions();
  const [still, setStill] = useState(false);

  // a background that never stops moving is exactly what "reduce motion" is for;
  // the shapes stay, they just stop wandering
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((on) => {
        if (live) setStill(!!on);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (on) => setStill(!!on));
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);

  const screen = useMemo(() => ({ width, height }), [height, width]);

  return (
    <View style={styles.root} pointerEvents="none">
      {SHAPES.map((shape, i) => (
        <Drift
          key={i}
          shape={shape}
          color={theme.drift[shape.tint % theme.drift.length]}
          screen={screen}
          still={still}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    // the shapes wander past the edges; without this they would paint over them
    overflow: 'hidden',
  },
});
