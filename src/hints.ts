import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { FULL_BANK, MAX_HINTS, refillProgress, settle, spend, type Bank } from './hintBank';

const STORAGE_KEY = 'block-inlay:hints:v1';

export type Hints = {
  hints: number;
  /** 0..1 toward the next hint */
  progress: number;
  loaded: boolean;
  /** spends one and reports whether there was one to spend */
  useHint: () => boolean;
};

/** the hint bank, kept on the device and settled against the clock */
export function useHints(): Hints {
  const [bank, setBank] = useState<Bank>(FULL_BANK);
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState(1);
  const bankRef = useRef(bank);
  bankRef.current = bank;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stored: Bank | null = null;
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed.count === 'number' && typeof parsed.since === 'number') {
          stored = {
            count: Math.min(MAX_HINTS, Math.max(0, Math.floor(parsed.count))),
            since: parsed.since,
          };
        }
      } catch {
        // no saved bank, or unreadable — start full rather than punish the player
      }
      if (cancelled) return;
      setBank(settle(stored ?? FULL_BANK, Date.now()));
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(bank)).catch(() => {
      // best-effort; the session still works if the device refuses
    });
  }, [bank, loaded]);

  // keep the ring moving, and hand over a hint the moment its hour is up
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      const settled = settle(bankRef.current, now);
      if (settled !== bankRef.current) setBank(settled);
      setProgress(refillProgress(settled, now));
    };
    tick();
    const timer = setInterval(tick, 10000);
    // timers do not run while the app is in the background, so catch up on return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [loaded]);

  const useHint = useCallback(() => {
    if (bankRef.current.count <= 0) return false;
    setBank(spend(bankRef.current, Date.now()));
    return true;
  }, []);

  return { hints: bank.count, progress, loaded, useHint };
}
