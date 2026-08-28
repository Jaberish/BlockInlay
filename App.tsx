import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import GameScreen from './src/GameScreen';
import MenuScreen from './src/MenuScreen';
import SettingsScreen from './src/SettingsScreen';
import { LEVELS, levelById } from './src/levels';
import { useProgress } from './src/progress';

type Route = { name: 'menu' } | { name: 'settings' } | { name: 'game'; levelId: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'menu' });
  const { solved, markSolved, resetProgress } = useProgress();

  const toMenu = useCallback(() => setRoute({ name: 'menu' }), []);
  const openLevel = useCallback((levelId: string) => setRoute({ name: 'game', levelId }), []);
  const openSettings = useCallback(() => setRoute({ name: 'settings' }), []);

  const level = route.name === 'game' ? levelById(route.levelId) : undefined;
  const next = level ? LEVELS[level.index + 1] : undefined;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {level ? (
        // keyed by level so switching levels starts the new board from scratch
        <GameScreen
          key={level.id}
          level={level}
          onBack={toMenu}
          onSolved={markSolved}
          onNext={next ? () => openLevel(next.id) : undefined}
        />
      ) : route.name === 'settings' ? (
        <SettingsScreen solved={solved} onResetProgress={resetProgress} onBack={toMenu} />
      ) : (
        <MenuScreen solved={solved} onPick={openLevel} onOpenSettings={openSettings} />
      )}
    </SafeAreaProvider>
  );
}
