import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * The two things this app has to know about movement that never stops.
 *
 * Two of its animations run forever — the shapes drifting behind every screen,
 * and a finished board turning. Everything else moves because someone touched
 * it, and then stops. Both of the awkward facts below are about that first kind,
 * and both of them were found the same way: by watching one lap and then the
 * lap that never came.
 */

/**
 * Whether a looping animation can be handed to the native driver.
 *
 * `Animated.loop` does not repeat a native-driven animation itself. It hands the
 * whole loop to the platform to run on the UI thread — and on react-native-web
 * there is nothing on the other end of that, so the animation plays exactly once
 * and then stands still forever. It is a silent failure in the worst place: the
 * first lap is perfect, and it is only a minute later that anyone notices the
 * background stopped drifting.
 *
 * On a phone the native driver is the whole point of a background animation, so
 * it is asked for there and only there. Web falls back to the JS driver, which
 * is what react-native-web animates everything with in any case.
 */
export const LOOPS_NATIVELY = Platform.OS !== 'web';

/**
 * Whether the device has asked for less movement.
 *
 * A background that never settles and a board that turns forever are exactly
 * what that setting is for, so both of them have to be able to hold still.
 *
 * The setting is asked for once and then listened to, because it can be turned
 * on while the app is open; and every call is guarded, because an older platform
 * that has never heard of it should give a still screen rather than a crash.
 */
export const useReduceMotion = (): boolean => {
  const [still, setStill] = useState(false);

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

  return still;
};
