import { Platform } from 'react-native';

/**
 * Whether to open the whole level list instead of only what has been earned.
 *
 * A way to look at all five thousand boards without solving four thousand of
 * them first. Web only, and read from the address bar — `?debug` — because that
 * is the one place the switch can be flicked without a build, and the one
 * platform where a player cannot flick it by accident.
 *
 * Read once, at load. It is a development switch, and a value that could change
 * under the app would mean every screen had to cope with the list growing by
 * five thousand while it was on screen.
 */
export const SHOW_EVERY_LEVEL: boolean = (() => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).has('debug');
  } catch {
    // no address bar to read (a static render, say) — behave like a phone
    return false;
  }
})();
