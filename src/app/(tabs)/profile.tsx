import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/brand/AppHeader';
import { LogoMark } from '@/components/brand/Logo';
import { Button, EmptyState, Screen, Section, Text } from '@/components/ui';
import { checkBackend, type BackendStatus } from '@/lib/supabase';
import { radius, space, useTheme } from '@/theme';

export default function ProfileScreen() {
  const theme = useTheme();
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const runCheck = useCallback(async () => {
    setChecking(true);
    setStatus(await checkBackend());
    setChecking(false);
  }, []);

  useEffect(() => {
    runCheck();
  }, [runCheck]);

  return (
    <Screen header={<AppHeader title="Profile" />}>
      <View style={styles.identity}>
        <View style={[styles.avatar, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <LogoMark size={36} color={theme.textMuted} cutout={theme.surface} />
        </View>
        <Text variant="h2">Guest</Text>
        <Text color="textSecondary">Sign in, profiles and Founder status arrive in Phase 2.</Text>
      </View>

      <Section index="01" title="Achievements">
        <EmptyState tag="Phase 3" title="Nothing yet" message="Completed challenges and badges will be collected here." />
      </Section>

      <Section index="02" title="Backend">
        <View style={[styles.status, { borderColor: theme.border, backgroundColor: theme.surface }]}>
          {status === null || checking ? (
            <View style={styles.statusRow}>
              <ActivityIndicator color={theme.textMuted} />
              <Text variant="caption" color="textSecondary">
                Checking connection…
              </Text>
            </View>
          ) : (
            <StatusDetails status={status} />
          )}
          {status?.state !== 'not-configured' ? (
            <Button label="Check again" variant="outline" onPress={runCheck} disabled={checking} />
          ) : null}
        </View>
      </Section>
    </Screen>
  );
}

function StatusDetails({ status }: { status: BackendStatus }) {
  const theme = useTheme();
  const tone = status.state === 'reachable' ? theme.success : status.state === 'unreachable' ? theme.danger : theme.textMuted;
  const title =
    status.state === 'reachable' ? 'Connected to Supabase' : status.state === 'unreachable' ? 'Cannot reach Supabase' : 'Supabase not configured';
  const details =
    status.state === 'not-configured'
      ? status.problems.join('\n') + '\nCopy .env.example to .env and restart Expo.'
      : status.state === 'unreachable'
        ? status.message
        : 'Auth service is healthy.';

  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.statusRow}>
        <View style={[styles.dot, { backgroundColor: tone }]} />
        <Text variant="title">{title}</Text>
      </View>
      <Text variant="caption" color="textSecondary">
        {details}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  identity: { marginTop: space.xl, alignItems: 'flex-start', gap: space.sm },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  status: { borderWidth: 1, borderRadius: radius.md, padding: space.lg, gap: space.lg },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
