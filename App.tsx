import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GameScreen from './src/GameScreen';
import MenuScreen from './src/MenuScreen';
import SettingsScreen from './src/SettingsScreen';
import { LEVEL_COUNT, getLevel, levelById } from './src/levels';
import { useProgress } from './src/progress';
import { useSettings } from './src/settings';
import { useHints } from './src/hints';
import { useMusic } from './src/music';

type Route = { name: 'menu' } | { name: 'settings' } | { name: 'game'; levelId: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'menu' });
  const { solved, loaded, markSolved, resetProgress } = useProgress();
  const { soundOn, musicOn, setSoundOn, setMusicOn } = useSettings();
  const music = useMusic(musicOn);
  // the bank lives here, not in the level: hints carry across boards
  const { hints, progress: hintProgress, useHint } = useHints();

  const toMenu = useCallback(() => setRoute({ name: 'menu' }), []);
  const openLevel = useCallback((levelId: string) => setRoute({ name: 'game', levelId }), []);
  const openSettings = useCallback(() => setRoute({ name: 'settings' }), []);

  const level = route.name === 'game' ? levelById(route.levelId) : undefined;
  const next = level && level.index + 1 < LEVEL_COUNT ? getLevel(level.index + 1) : undefined;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.app}>
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
            onResetProgress={resetProgress}
            onBack={toMenu}
            soundOn={soundOn}
            onSetSoundOn={setSoundOn}
            musicOn={musicOn}
            onSetMusicOn={setMusicOn}
          />
        ) : (
          <MenuScreen
            solved={solved}
            loaded={loaded}
            onPick={openLevel}
            onOpenSettings={openSettings}
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
