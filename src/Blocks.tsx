import React from 'react';
import { View, type GestureResponderHandlers } from 'react-native';
import type { Cell } from './levels';
import { theme } from './theme';

/** anything that can be drawn as a group of squares — a piece, or a whole board */
export type Shape = { cells: Cell[]; color: string; shade: string };

type Props = {
  shape: Shape;
  /** size of one square, in px */
  cell: number;
  /** draw as a hollow outline (piece is on the board, this is just its home) */
  faded?: boolean;
  /** drop shadow — used while the piece is in the air */
  lifted?: boolean;
  /** drag gesture, attached to every square so only the shape itself is grabbable */
  handlers?: GestureResponderHandlers;
};

/** The squares of one shape, laid out from the top-left of its bounding box. */
export default function Blocks({ shape, cell, faded = false, lifted = false, handlers }: Props) {
  const gap = Math.max(1, Math.round(cell * 0.05));
  const radius = Math.max(2, Math.round(cell * 0.2));
  const lip = Math.max(1, Math.round(cell * 0.14));

  return (
    <>
      {shape.cells.map((c) => (
        <View
          key={`${c.row}:${c.col}`}
          {...handlers}
          style={{
            position: 'absolute',
            left: c.col * cell + gap,
            top: c.row * cell + gap,
            width: cell - gap * 2,
            height: cell - gap * 2,
          }}
        >
          <View
            style={{
              flex: 1,
              borderRadius: radius,
              backgroundColor: faded ? 'transparent' : shape.shade,
              borderWidth: faded ? 1.5 : 0,
              borderColor: faded ? theme.ghost : 'transparent',
              ...(lifted ? { boxShadow: '0px 6px 12px rgba(0,0,0,0.45)' } : null),
            }}
          >
            {!faded && (
              <>
                {/* the raised top face */}
                <View
                  style={{
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    top: 0,
                    bottom: lip,
                    borderRadius: radius,
                    backgroundColor: shape.color,
                  }}
                />
                {/* a soft highlight so the square reads as plastic, not paper */}
                {cell > 18 && (
                  <View
                    style={{
                      position: 'absolute',
                      left: radius * 0.7,
                      top: radius * 0.6,
                      width: cell * 0.28,
                      height: Math.max(2, cell * 0.07),
                      borderRadius: 99,
                      backgroundColor: 'rgba(255,255,255,0.42)',
                    }}
                  />
                )}
              </>
            )}
          </View>
        </View>
      ))}
    </>
  );
}
