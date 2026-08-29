import React, { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Theme } from './theme';

type Props = {
  solved: ReadonlySet<string>;
  onResetProgress: () => void;
  onBack: () => void;
  soundOn: boolean;
  onSetSoundOn: (on: boolean) => void;
  musicOn: boolean;
  onSetMusicOn: (on: boolean) => void;
  theme: Theme;
};

export default function SettingsScreen({
  solved,
  onResetProgress,
  onBack,
  soundOn,
  onSetSoundOn,
  musicOn,
  onSetMusicOn,
  theme,
}: Props) {
  const styles = useMemo(() => makeStyles(theme), [theme]);
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

        <Text style={styles.section}>ABOUT</Text>
        <View style={styles.card}>
          <Text style={styles.cardText}>
            Every board holds exactly as many squares as its pieces cover, and there is only one
            arrangement that fills it. Pieces never rotate, so each one has a single home.
          </Text>
          <Text style={[styles.cardText, styles.aboutSpacer]}>
            Hints reveal one piece in its true home. You hold up to three, and one comes back every
            hour.
          </Text>
        </View>
        <Text style={styles.section}>SOUND</Text>
        <View style={styles.card}>
          <Pressable
            onPress={() => onSetMusicOn(!musicOn)}
            accessibilityRole="switch"
            accessibilityState={{ checked: musicOn }}
            accessibilityLabel="Music"
            style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
          >
            <View style={styles.toggleText}>
              <Text style={styles.cardTitle}>Music</Text>
              <Text style={styles.cardText}>The background track, looping while you play.</Text>
            </View>
            <View style={[styles.switchTrack, musicOn && styles.switchTrackOn]}>
              <View style={[styles.switchKnob, musicOn && styles.switchKnobOn]} />
            </View>
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            onPress={() => onSetSoundOn(!soundOn)}
            accessibilityRole="switch"
            accessibilityState={{ checked: soundOn }}
            accessibilityLabel="Sound effects"
            style={({ pressed }) => [styles.toggleRow, pressed && styles.pressed]}
          >
            <View style={styles.toggleText}>
              <Text style={styles.cardTitle}>Sound effects</Text>
              <Text style={styles.cardText}>A chime when a board is finished.</Text>
            </View>
            <View style={[styles.switchTrack, soundOn && styles.switchTrackOn]}>
              <View style={[styles.switchKnob, soundOn && styles.switchKnobOn]} />
            </View>
          </Pressable>
        </View>

        <Text style={styles.section}>PROGRESS</Text>
        <View style={styles.card}>
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

      </ScrollView>
    </View>
  );
}

const makeStyles = (theme: Theme) =>
  StyleSheet.create({
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    divider: {
      height: 1,
      marginVertical: 14,
      backgroundColor: theme.panelEdge,
    },
    toggleText: {
      flex: 1,
    },
    switchTrack: {
      width: 52,
      height: 31,
      borderRadius: 999,
      padding: 3,
      justifyContent: 'center',
      backgroundColor: theme.panelEdge,
    },
    switchTrackOn: {
      backgroundColor: theme.accent,
    },
    switchKnob: {
      width: 25,
      height: 25,
      borderRadius: 999,
      backgroundColor: theme.text,
    },
    switchKnobOn: {
      alignSelf: 'flex-end',
    },
    aboutSpacer: {
      marginTop: 10,
    },
    root: {
      flex: 1,
      // transparent: the drifting shapes behind the app show through
      backgroundColor: 'transparent',
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
    dangerOutline: {
      marginTop: 16,
      paddingVertical: 12,
      borderRadius: 999,
      alignItems: 'center',
      borderWidth: 1.5,
      borderColor: theme.accentSoft,
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
      color: theme.accentInk,
      fontSize: 15,
      fontWeight: '800',
    },
    cleared: {
      color: theme.accent,
      fontSize: 13,
      marginTop: 14,
    },
  });
