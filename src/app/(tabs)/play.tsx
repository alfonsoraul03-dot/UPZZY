import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { Board } from '@/components/game/Board';
import { TimerBar } from '@/components/game/TimerBar';
import { Button, Screen, Text } from '@/components/ui';
import { generateLevel, MISTAKE_LINES, type Level } from '@/game/level';
import { mulberry32, type Rng } from '@/game/rng';
import { useStats } from '@/hooks/useStats';
import { haptic } from '@/lib/haptics';
import { space, useTheme } from '@/theme';

const LIVES = 3;
const REVEAL_MS = 650;

type Phase = 'idle' | 'playing' | 'reveal' | 'over';

export default function PlayScreen() {
  const theme = useTheme();
  const { stats, update, reload } = useStats();
  const rng = useRef<Rng>(mulberry32(Date.now()));
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(0);
  const [level, setLevel] = useState<Level>(() => generateLevel(rng.current, 0));
  const [lives, setLives] = useState(LIVES);
  const [wrongTick, setWrongTick] = useState(0);
  const [line, setLine] = useState('');
  const [newBest, setNewBest] = useState(false);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  const clearTimer = () => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
  };

  const nextLevel = useCallback((nextRound: number) => {
    setRound(nextRound);
    setLevel(generateLevel(rng.current, nextRound));
    setLine('');
    setPhase('playing');
  }, []);

  const start = () => {
    haptic('tap');
    clearTimer();
    rng.current = mulberry32(Date.now());
    setLivesBoth(LIVES);
    setNewBest(false);
    nextLevel(0);
  };

  const finish = useCallback(
    async (score: number) => {
      setPhase('over');
      const next = await update((s) => ({ ...s, gamesPlayed: s.gamesPlayed + 1, best: Math.max(s.best, score) }));
      setNewBest(score > 0 && next.best === score && score > stats.best);
    },
    [update, stats.best],
  );

  // Lives live in a ref so timers and taps always see the current count.
  const livesRef = useRef(LIVES);
  const setLivesBoth = (value: number) => {
    livesRef.current = value;
    setLives(value);
  };

  /** Costs a life; returns true when that was the last one. */
  const loseLife = useCallback((reason: string) => {
    haptic('oops');
    setWrongTick((t) => t + 1);
    setLine(reason);
    const left = livesRef.current - 1;
    livesRef.current = left;
    setLives(left);
    return left <= 0;
  }, []);

  // Round timer: running out costs a life and moves on.
  useEffect(() => {
    if (phase !== 'playing') return;
    const timer = setTimeout(() => {
      const dead = loseLife('too slow. ' + MISTAKE_LINES[level.mistake]);
      setPhase('reveal');
      timeout.current = setTimeout(() => (dead ? finish(round) : nextLevel(round + 1)), REVEAL_MS * 2);
    }, level.timeLimit * 1000);
    return () => clearTimeout(timer);
  }, [phase, level, round, finish, nextLevel, loseLife]);

  useEffect(() => clearTimer, []);

  const onTap = (index: number) => {
    if (phase !== 'playing') return;
    if (index === level.oopsIndex) {
      haptic('found');
      setLine(MISTAKE_LINES[level.mistake]);
      setPhase('reveal');
      timeout.current = setTimeout(() => nextLevel(round + 1), REVEAL_MS);
    } else if (loseLife('nope.')) {
      setPhase('reveal');
      timeout.current = setTimeout(() => finish(round), REVEAL_MS * 2);
    }
  };

  const score = round;

  return (
    <Screen
      scroll={false}
      header={
        <View style={styles.header}>
          <Wordmark />
          {phase === 'playing' || phase === 'reveal' ? <Lives left={lives} /> : null}
        </View>
      }>
      {phase === 'idle' ? (
        <View style={styles.center}>
          <Text variant="label" color="textMuted">
            spot the oops
          </Text>
          <Text variant="title" style={styles.centerText}>
            every grid is perfect.{'\n'}except one thing.
          </Text>
          <Text color="textMuted" style={styles.centerText}>
            tap the mistake before time runs out. three oopses and you&apos;re done.
          </Text>
          <Button label="start" onPress={start} style={styles.cta} />
          {stats.best > 0 ? (
            <Text variant="caption" color="textMuted">
              best {stats.best}
            </Text>
          ) : null}
        </View>
      ) : phase === 'over' ? (
        <View style={styles.center}>
          <Text variant="label" color="textMuted">
            game over
          </Text>
          <Text variant="number">{score}</Text>
          <Text variant="title">{newBest ? 'new best. on purpose.' : 'oops.'}</Text>
          <Text color="textMuted">best {Math.max(stats.best, score)}</Text>
          <Button label="again" onPress={start} style={styles.cta} />
        </View>
      ) : (
        <View style={styles.game}>
          <View style={styles.scoreRow}>
            <Text variant="number" style={styles.score}>
              {score}
            </Text>
            <Text color={line === 'nope.' || line.startsWith('too slow') ? 'oops' : 'textMuted'}>{line}</Text>
          </View>
          <TimerBar seconds={level.timeLimit} runKey={round} running={phase === 'playing'} />
          <Board level={level} revealed={phase === 'reveal'} wrongTick={wrongTick} onTap={onTap} disabled={phase !== 'playing'} />
          <Text variant="caption" color="textMuted" style={{ color: theme.textMuted }}>
            round {round + 1}
          </Text>
        </View>
      )}
    </Screen>
  );
}

function Lives({ left }: { left: number }) {
  const theme = useTheme();
  return (
    <View style={styles.lives} accessibilityLabel={`${left} lives left`}>
      {Array.from({ length: LIVES }, (_, i) => {
        const lost = i >= left;
        return (
          <View
            key={i}
            style={[
              styles.life,
              { backgroundColor: lost ? theme.oops : theme.text },
              lost ? { transform: [{ rotate: '8deg' }, { translateY: 3 }] } : null,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 64,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  centerText: { textAlign: 'center' },
  cta: { marginTop: space.lg, minWidth: 180 },
  game: { gap: space.lg, paddingTop: space.sm },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md },
  score: { fontSize: 48, lineHeight: 48 },
  lives: { flexDirection: 'row', gap: 6 },
  life: { width: 12, height: 12, borderRadius: 6 },
});
