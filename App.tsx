import { useCallback, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Backdrop from './src/Backdrop';
import GameScreen from './src/GameScreen';
import MenuScreen from './src/MenuScreen';
import SettingsScreen from './src/SettingsScreen';
import { LEVEL_COUNT, getLevel, idAt, indexOfId, levelById } from './src/levels';
import { useProgress } from './src/progress';
import { useSettings } from './src/settings';
import { useHints } from './src/hints';
import { useMusic } from './src/music';
import { themeAt } from './src/theme';

type Route = { name: 'menu' } | { name: 'settings' } | { name: 'game'; levelId: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'menu' });
  const { solved, loaded, markSolved, resetProgress } = useProgress();
  const { soundOn, musicOn, setSoundOn, setMusicOn } = useSettings();
  const music = useMusic(musicOn);
  // the bank lives here, not in the level: hints carry across boards
  const { hints, progress: hintProgress, useHint } = useHints();

  /** the highest level finished, or -1 when none has been */
  const furthestSolved = useMemo(() => {
    for (let i = LEVEL_COUNT - 1; i >= 0; i--) if (solved.has(idAt(i))) return i;
    return -1;
  }, [solved]);

  /**
   * Which level the player is on, for the two things outside a level that follow
   * it: where the list opens, and what colour everything is.
   *
   * The last board they opened, once they have opened one — so leaving a board
   * puts them back beside it rather than at their high-water mark, which is a
   * long way away if they have skipped ahead. Before that it is their progress
   * that says where they are.
   */
  const [lastPlayed, setLastPlayed] = useState(-1);
  const landAt = lastPlayed >= 0 ? lastPlayed : furthestSolved;
  // the *next* board when going by progress: the one they are about to play,
  // rather than the one they have already finished
  const dressAs = lastPlayed >= 0 ? lastPlayed : Math.min(furthestSolved + 1, LEVEL_COUNT - 1);
  const menuTheme = useMemo(() => themeAt(dressAs), [dressAs]);

  const toMenu = useCallback(() => setRoute({ name: 'menu' }), []);
  const openLevel = useCallback((levelId: string) => {
    setRoute({ name: 'game', levelId });
    setLastPlayed(indexOfId(levelId));
  }, []);
  const openSettings = useCallback(() => setRoute({ name: 'settings' }), []);

  // clearing progress puts them back at the start, so it clears where they were too
  const clearProgress = useCallback(() => {
    resetProgress();
    setLastPlayed(-1);
  }, [resetProgress]);

  const level = route.name === 'game' ? levelById(route.levelId) : undefined;
  const next = level && level.index + 1 < LEVEL_COUNT ? getLevel(level.index + 1) : undefined;

  /** whatever is on top paints its own background; this is what shows between screens */
  const backdrop = level ? themeAt(level.index) : menuTheme;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {/* the chapter's colour sits behind everything, so a screen swap never flashes */}
      <View style={[styles.app, { backgroundColor: backdrop.bg }]}>
        <Backdrop theme={backdrop} />
        {level ? (
          // keyed by level so switching levels starts the new board from scratch
          <GameScreen
            key={level.id}
            level={level}
            onBack={toMenu}
            onSolved={markSolved}
            onNext={next ? () => openLevel(next.id) : undefined}
            hints={hints}
            hintProgress={hintProgress}
            onUseHint={useHint}
            soundOn={soundOn}
            onDuckMusic={music.duck}
          />
        ) : route.name === 'settings' ? (
          <SettingsScreen
            solved={solved}
            onResetProgress={clearProgress}
            onBack={toMenu}
            soundOn={soundOn}
            onSetSoundOn={setSoundOn}
            musicOn={musicOn}
            onSetMusicOn={setMusicOn}
            theme={menuTheme}
          />
        ) : (
          <MenuScreen
            solved={solved}
            loaded={loaded}
            landAt={landAt}
            onPick={openLevel}
            onOpenSettings={openSettings}
            theme={menuTheme}
          />
        )}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    // it is a game: dragging across a label should never leave text highlighted
    userSelect: 'none',
  },
});
