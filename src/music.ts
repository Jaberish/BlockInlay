import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

/** how far the music drops out of the way, and for how long */
const DUCK_VOLUME = 0.18;
const DUCK_MS = 1400;
const FADE_STEPS = 12;

export type Music = {
  /** pull the music down briefly so a sound effect can be heard over it */
  duck: () => void;
};

/**
 * The background track, looping for as long as it is switched on.
 *
 * It lives at the root rather than inside a screen so it carries across the menu,
 * a level and settings without restarting every time you move between them.
 */
export function useMusic(enabled: boolean): Music {
  const player = useAudioPlayer(require('../assets/poorartistt-music.mp3'));
  const fade = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Play whether or not the phone's ringer switch is on. A game muting itself
    // on silent is defensible, but "I turned sound on and heard nothing" is a
    // worse surprise than sound arriving when the ringer is off.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {
      // if the device won't take the mode, playback still works
    });
  }, []);

  useEffect(() => {
    try {
      player.loop = true;
      if (!enabled) {
        player.pause();
        return;
      }
      player.play();
    } catch {
      // music is a garnish; never let it break the app
    }
    if (!enabled || Platform.OS !== 'web') return;

    // Browsers refuse to start audio before the page has been interacted with,
    // and there is no way to ask whether this is such a browser — so try again
    // on each touch until it takes. On a phone the first call already worked and
    // this never runs.
    const retry = () => {
      try {
        if (!player.playing) player.play();
      } catch {
        // still too early; the next touch will try again
      }
    };
    window.addEventListener('pointerdown', retry);
    return () => window.removeEventListener('pointerdown', retry);
  }, [enabled, player]);

  useEffect(
    () => () => {
      if (fade.current) clearInterval(fade.current);
    },
    [],
  );

  /**
   * Drop the volume, hold, then walk it back up. Without this the finish chime
   * lands underneath a full-volume track and is easy to miss entirely — which
   * reads as "the sound is broken" rather than "the sound is quiet".
   */
  const duck = useCallback(() => {
    try {
      if (fade.current) clearInterval(fade.current);
      player.volume = DUCK_VOLUME;
      let step = 0;
      fade.current = setInterval(() => {
        step++;
        const eased = step / FADE_STEPS;
        player.volume = Math.min(1, DUCK_VOLUME + (1 - DUCK_VOLUME) * eased * eased);
        if (step >= FADE_STEPS) {
          if (fade.current) clearInterval(fade.current);
          fade.current = null;
          player.volume = 1;
        }
      }, DUCK_MS / FADE_STEPS);
    } catch {
      // if the volume can't be set, the chime still plays — just less clearly
    }
  }, [player]);

  return { duck };
}
