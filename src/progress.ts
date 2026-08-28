import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { indexOfId } from './levels';

// Named before the app was: renaming this key would look tidier but would throw
// away the saved progress of anyone who already has the app installed.
const STORAGE_KEY = 'heart-puzzle:solved:v1';

export type Progress = {
  /** ids of levels that have been solved */
  solved: ReadonlySet<string>;
  /** false until the saved progress has been read back */
  loaded: boolean;
  markSolved: (levelId: string) => void;
  resetProgress: () => void;
};

/**
 * Which levels have been solved, kept on the device.
 *
 * Two things this has to get right: a level solved before the saved progress has
 * finished loading must not be lost, and an early save must not overwrite
 * progress that hasn't been read yet. So loading merges rather than replaces,
 * and nothing is written until the first read has happened.
 */
export function useProgress(): Progress {
  const [solved, setSolved] = useState<ReadonlySet<string>>(() => new Set<string>());
  const [loaded, setLoaded] = useState(false);
  const solvedRef = useRef(solved);
  solvedRef.current = solved;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored: string[] = [];
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (Array.isArray(parsed)) {
          // ignore anything that isn't a level we still ship. `indexOfId` rather
          // than looking the level up: this runs over every saved id at launch,
          // and building thousands of levels to check they exist would undo the
          // whole point of loading them lazily.
          stored = parsed.filter((id): id is string => typeof id === 'string' && indexOfId(id) >= 0);
        }
      } catch {
        // no saved progress, or it can't be read — start empty rather than fail
      }
      if (cancelled) return;
      setSolved((current) => new Set([...stored, ...current]));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // save on every change, but only once the initial read is done
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...solved])).catch(() => {
      // saving is best-effort; the session still works if the device refuses
    });
  }, [loaded, solved]);

  const markSolved = useCallback((levelId: string) => {
    setSolved((current) => (current.has(levelId) ? current : new Set(current).add(levelId)));
  }, []);

  const resetProgress = useCallback(() => {
    setSolved(new Set<string>());
  }, []);

  return { solved, loaded, markSolved, resetProgress };
}
