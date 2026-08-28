import React, { useEffect, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LEVELS } from './levels';
import { theme } from './theme';

type Props = {
  solved: ReadonlySet<string>;
  onResetProgress: () => void;
  onBack: () => void;
};

export default function SettingsScreen({ solved, onResetProgress, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [confirming, setConfirming] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => sub.remove();
  }, [onBack]);

  const count = solved.size;
  const total = LEVELS.length;
  const share = total === 0 ? 0 : count / total;

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 14,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 18,
        }}
      >
        <View style={styles.header}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Back to the level list"
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text style={styles.iconText}>‹</Text>
          </Pressable>
          <Text style={styles.title}>Settings</Text>
        </View>

        <Text style={styles.section}>PROGRESS</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {count} of {total} boards solved
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { width: `${Math.round(share * 100)}%` }]} />
          </View>
          <Text style={styles.cardText}>
            Solved boards are kept on this device, so they survive closing the app.
          </Text>

          {confirming ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>
                {count === 0
                  ? 'There is no progress to clear.'
                  : `Clear all ${count} solved ${count === 1 ? 'board' : 'boards'}? This cannot be undone.`}
              </Text>
              <View style={styles.confirmButtons}>
                <Pressable
                  onPress={() => setConfirming(false)}
                  style={({ pressed }) => [styles.ghostButton, pressed && styles.pressed]}
                >
                  <Text style={styles.ghostButtonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={() => {
                    onResetProgress();
                    setConfirming(false);
                    setCleared(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Confirm resetting all progress"
                  style={({ pressed }) => [styles.dangerButton, pressed && styles.pressed]}
                >
                  <Text style={styles.dangerButtonText}>Reset progress</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={() => {
                setCleared(false);
                setConfirming(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Reset all progress"
              style={({ pressed }) => [styles.dangerOutline, pressed && styles.pressed]}
            >
              <Text style={styles.dangerOutlineText}>Reset progress</Text>
            </Pressable>
          )}

          {cleared ? <Text style={styles.cleared}>Progress cleared — every board is unsolved again.</Text> : null}
        </View>

        <Text style={styles.section}>ABOUT</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Every board holds exactly as many squares as its pieces cover, and there is only one
            arrangement that fills it. Pieces never rotate, so each one has a single home.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 22,
  },
  title: {
    color: theme.text,
    fontSize: 26,
    fontWeight: '800',
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.panel,
    borderWidth: 1,
    borderColor: theme.panelEdge,
  },
  iconText: {
    color: theme.text,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.65,
  },
  section: {
    color: theme.textDim,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginBottom: 8,
    marginTop: 6,
  },
  card: {
    backgroundColor: theme.panel,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: theme.panelEdge,
    padding: 16,
    marginBottom: 22,
  },
  cardTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700',
  },
  cardText: {
    color: theme.textDim,
    fontSize: 13,
    lineHeight: 19,
  },
  barTrack: {
    height: 8,
    borderRadius: 99,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginTop: 12,
    marginBottom: 12,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 99,
    backgroundColor: theme.accent,
  },
  dangerOutline: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,110,138,0.45)',
  },
  dangerOutlineText: {
    color: theme.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  confirm: {
    marginTop: 16,
  },
  confirmText: {
    color: theme.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  ghostButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: theme.bg,
    borderWidth: 1,
    borderColor: theme.panelEdge,
  },
  ghostButtonText: {
    color: theme.text,
    fontSize: 15,
    fontWeight: '700',
  },
  dangerButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    backgroundColor: theme.accent,
  },
  dangerButtonText: {
    color: '#2A0A14',
    fontSize: 15,
    fontWeight: '800',
  },
  cleared: {
    color: theme.accent,
    fontSize: 13,
    marginTop: 14,
  },
});
