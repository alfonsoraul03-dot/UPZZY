import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { Board } from '@/components/game/Board';
import { Marks } from '@/components/game/Marks';
import { Button, Screen, Text } from '@/components/ui';
import {
  DAILY_ROUNDS,
  dailyLevels,
  dailyNumber,
  dateKey,
  nextStreak,
  shareText,
  visibleStreak,
  type DailyResult,
} from '@/game/daily';
import { MISTAKE_LINES } from '@/game/level';
import { useStats } from '@/hooks/useStats';
import { haptic } from '@/lib/haptics';
import { space } from '@/theme';

const REVEAL_MS = 700;

type Phase = 'idle' | 'playing' | 'reveal' | 'done';

export default function TodayScreen() {
  const { stats, loaded, update, reload } = useStats();
  const [today, setToday] = useState(() => dateKey(new Date()));
  const levels = useMemo(() => dailyLevels(today), [today]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [round, setRound] = useState(0);
  const [rounds, setRounds] = useState<boolean[]>([]);
  const [missedThisRound, setMissedThisRound] = useState(false);
  const [wrongTick, setWrongTick] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);

  useFocusEffect(
    useCallback(() => {
      setToday(dateKey(new Date()));
      reload();
    }, [reload]),
  );

  const result: DailyResult | null = stats.daily?.date === today ? stats.daily : null;
  const streak = result ? stats.streak : visibleStreak(stats.lastDaily, stats.streak, today);

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'reveal') return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(id);
  }, [phase]);

  const start = () => {
    haptic('tap');
    startedAt.current = Date.now();
    setElapsed(0);
    setRound(0);
    setRounds([]);
    setMissedThisRound(false);
    setPhase('playing');
  };

  const finish = async (all: boolean[]) => {
    const seconds = Math.round((Date.now() - startedAt.current) / 1000);
    const daily: DailyResult = { date: today, rounds: all, seconds };
    await update((s) => ({
      ...s,
      daily,
      streak: nextStreak(s.lastDaily, s.streak, today),
      lastDaily: today,
    }));
    setPhase('done');
  };

  const level = levels[round];

  const onTap = (index: number) => {
    if (phase !== 'playing') return;
    if (index !== level.oopsIndex) {
      haptic('oops');
      setMissedThisRound(true);
      setWrongTick((t) => t + 1);
      return;
    }
    haptic('found');
    const all = [...rounds, !missedThisRound];
    setRounds(all);
    setPhase('reveal');
    setTimeout(() => {
      if (all.length === DAILY_ROUNDS) {
        finish(all);
      } else {
        setRound(all.length);
        setMissedThisRound(false);
        setPhase('playing');
      }
    }, REVEAL_MS);
  };

  const header = (
    <View style={styles.header}>
      <Wordmark />
      <Text variant="label" color="textMuted">
        {streak > 0 ? `${streak} day streak` : `daily #${dailyNumber(today)}`}
      </Text>
    </View>
  );

  if (!loaded) return <Screen scroll={false} header={header}>{null}</Screen>;

  if (phase === 'playing' || phase === 'reveal') {
    const marks: ('clean' | 'oops')[] = rounds.map((clean) => (clean ? 'clean' : 'oops'));
    if (missedThisRound && phase === 'playing') marks.push('oops');
    return (
      <Screen scroll={false} header={header}>
        <View style={styles.game}>
          <View style={styles.statusRow}>
            <Marks total={DAILY_ROUNDS} states={marks} />
            <Text variant="label" color="textMuted">
              {elapsed}s
            </Text>
          </View>
          <Board level={level} revealed={phase === 'reveal'} wrongTick={wrongTick} onTap={onTap} disabled={phase !== 'playing'} />
          <Text color={phase === 'reveal' ? 'text' : missedThisRound ? 'oops' : 'textMuted'}>
            {phase === 'reveal' ? MISTAKE_LINES[level.mistake] : missedThisRound ? 'nope. keep looking.' : `${round + 1} of ${DAILY_ROUNDS}`}
          </Text>
        </View>
      </Screen>
    );
  }

  if (result) {
    const clean = result.rounds.filter(Boolean).length;
    return (
      <Screen scroll={false} header={header}>
        <View style={styles.center}>
          <Text variant="label" color="textMuted">
            daily oops #{dailyNumber(result.date)}
          </Text>
          <Text variant="number">
            {clean}/{result.rounds.length}
          </Text>
          <Text variant="title">{clean === result.rounds.length ? 'not a single oops.' : 'happened by mistake.'}</Text>
          <Text color="textMuted">
            {result.seconds}s · {stats.streak} day streak
          </Text>
          <View style={styles.marks}>
            <Marks total={result.rounds.length} states={result.rounds.map((c) => (c ? 'clean' : 'oops'))} />
          </View>
          <Button label="share" onPress={() => Share.share({ message: shareText(result) })} style={styles.cta} />
          <Text variant="caption" color="textMuted">
            new one tomorrow. no undo.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll={false} header={header}>
      <View style={styles.center}>
        <Text variant="label" color="textMuted">
          daily oops #{dailyNumber(today)}
        </Text>
        <Text variant="title" style={styles.centerText}>
          ten grids. ten mistakes.{'\n'}same for everyone today.
        </Text>
        <Text color="textMuted" style={styles.centerText}>
          find each one fast. wrong taps leave a mark.
        </Text>
        <Button label="start" onPress={start} style={styles.cta} />
        <Text variant="caption" color="textMuted">
          one try a day.
        </Text>
      </View>
    </Screen>
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
  marks: { marginTop: space.sm },
  game: { gap: space.lg, paddingTop: space.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
});
