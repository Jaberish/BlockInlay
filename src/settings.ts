import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'block-inlay:settings:v1';

export type Settings = {
  soundOn: boolean;
  musicOn: boolean;
  /** false until the saved settings have been read back */
  loaded: boolean;
  setSoundOn: (on: boolean) => void;
  setMusicOn: (on: boolean) => void;
};

/**
 * Preferences, kept on the device. Same rule as saved progress: nothing is
 * written until the first read has happened, so an early toggle can't overwrite
 * settings that haven't loaded yet.
 */
export function useSettings(): Settings {
  const [soundOn, setSound] = useState(true);
  const [musicOn, setMusic] = useState(true);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        if (!cancelled && parsed) {
          if (typeof parsed.soundOn === 'boolean') setSound(parsed.soundOn);
          if (typeof parsed.musicOn === 'boolean') setMusic(parsed.musicOn);
        }
      } catch {
        // no saved settings, or unreadable — the defaults are fine
      }
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ soundOn, musicOn })).catch(() => {
      // best-effort; the session still works if the device refuses
    });
  }, [loaded, musicOn, soundOn]);

  const setSoundOn = useCallback((on: boolean) => setSound(on), []);
  const setMusicOn = useCallback((on: boolean) => setMusic(on), []);

  return { soundOn, musicOn, loaded, setSoundOn, setMusicOn };
}
