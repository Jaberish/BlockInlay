import React, { useMemo } from 'react';
import { View } from 'react-native';

/**
 * The curved dashed arrow the first board draws on itself.
 *
 * Drawn out of plain views rather than a path, because there is no SVG in this
 * project and one arrow is not a reason to add a renderer. An arc of short bars,
 * each rotated to lie along the curve, plus a triangle at the end — at these
 * sizes it is indistinguishable from a stroked path, and it costs nothing but
 * arithmetic.
 *
 * Dashes rather than a solid line on purpose: a solid curve on top of the board
 * reads as part of the game, and this is the one thing on the screen that is
 * not. A dashed one reads as something drawn over the top, which is what it is.
 *
 * The caller gives an arc — a radius and the two angles to sweep between — and
 * the mark sizes itself to whatever that comes out as, so it can be centred or
 * laid out like any other view without the caller doing the trigonometry.
 */

type Props = {
  /** the arc's radius in px; the mark's own box is derived from it */
  radius: number;
  /**
   * Degrees around the circle, clockwise from east — screen axes, so 90 is the
   * bottom. Travel runs `from` → `to`, and the head lands at `to` pointing the
   * way the curve was going, so swapping them turns the arrow around.
   */
  from: number;
  to: number;
  color: string;
  thickness?: number;
  /** how many bars the curve is chopped into */
  dashes?: number;
};

const RAD = Math.PI / 180;

export default function Arrow({ radius, from, to, color, thickness = 4, dashes = 6 }: Props) {
  const { bars, head, width, height } = useMemo(() => {
    const at = (deg: number) => ({
      x: Math.cos(deg * RAD) * radius,
      y: Math.sin(deg * RAD) * radius,
    });
    const points = Array.from({ length: dashes + 1 }, (_, i) =>
      at(from + ((to - from) * i) / dashes),
    );

    const headWidth = thickness * 2.9;
    const headHeight = thickness * 3.1;
    // the head is drawn as a triangle pointing up, so every rotation here is
    // measured from up: a heading of (0,-1) has to come out as no rotation
    const heading = (ax: { x: number; y: number }, bx: { x: number; y: number }) =>
      (Math.atan2(bx.y - ax.y, bx.x - ax.x) * 180) / Math.PI + 90;

    // one bar per gap between samples, a little short of it so the curve reads
    // as dashes rather than as a chain
    const bars = points.slice(0, -1).map((a, i) => {
      const b = points[i + 1];
      const span = Math.hypot(b.x - a.x, b.y - a.y);
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        length: span * 0.62,
        rotate: heading(a, b),
      };
    });

    const tip = points[points.length - 1];
    const head = { x: tip.x, y: tip.y, rotate: heading(points[points.length - 2], tip) };

    // the box is the sweep's own extent, padded by the widest thing drawn on
    // it — near enough, and it keeps a rotated head from being clipped
    const pad = Math.max(headWidth, headHeight, thickness) * 0.75;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs) - pad;
    const minY = Math.min(...ys) - pad;
    return {
      bars: bars.map((bar) => ({ ...bar, x: bar.x - minX, y: bar.y - minY })),
      head: { ...head, x: head.x - minX, y: head.y - minY, headWidth, headHeight },
      width: Math.max(...xs) + pad - minX,
      height: Math.max(...ys) + pad - minY,
    };
  }, [dashes, from, radius, thickness, to]);

  return (
    <View style={{ width, height }} pointerEvents="none">
      {bars.map((bar, i) => (
        <View
          key={i}
          style={{
            position: 'absolute',
            left: bar.x - thickness / 2,
            top: bar.y - bar.length / 2,
            width: thickness,
            height: bar.length,
            borderRadius: thickness / 2,
            backgroundColor: color,
            transform: [{ rotate: `${bar.rotate}deg` }],
          }}
        />
      ))}
      {/* a triangle, the only way to draw one without a path: a box with no size
          and three of its four borders invisible */}
      <View
        style={{
          position: 'absolute',
          left: head.x - head.headWidth / 2,
          top: head.y - head.headHeight / 2,
          width: 0,
          height: 0,
          backgroundColor: 'transparent',
          borderLeftWidth: head.headWidth / 2,
          borderRightWidth: head.headWidth / 2,
          borderBottomWidth: head.headHeight,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
          transform: [{ rotate: `${head.rotate}deg` }],
        }}
      />
    </View>
  );
}
