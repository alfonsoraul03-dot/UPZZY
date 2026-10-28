import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { loadShop, type Shop } from '@/lib/shop';
import { friendlyError } from '@/lib/social';
import { formatPrice, fromPrice, soldOut } from '@/social/shop';
import { radius, space, useTheme } from '@/theme';

/** Everything on upzzyworld.com, two to a row. Tapping one opens it inside the app. */
export function ShopList() {
  const theme = useTheme();
  const [shop, setShop] = useState<Shop | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (fresh: boolean) => {
    try {
      setShop(await loadShop(fresh));
      setError(null);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(false);
    }, [load]),
  );

  if (error && !shop)
    return (
      <View style={styles.gap}>
        <Text variant="title">{error}</Text>
        <Button label="try again" variant="outline" onPress={() => load(true)} />
      </View>
    );
  if (!shop) return <Text color="textMuted">loading…</Text>;
  if (!shop.products.length) return <Text color="textMuted">nothing out right now. next drop soon.</Text>;

  return (
    <View style={styles.grid}>
      {shop.products.map((p) => {
        const gone = soldOut(p);
        return (
          <Pressable
            key={p.id}
            onPress={() => {
              haptic('tap');
              router.push({ pathname: '/product/[handle]', params: { handle: p.handle } });
            }}
            accessibilityRole="link"
            accessibilityLabel={`${p.title}, ${gone ? 'sold out' : formatPrice(fromPrice(p), shop.currency)}`}
            style={({ pressed }) => [styles.cell, { opacity: pressed ? 0.8 : 1 }]}>
            <Image
              source={{ uri: p.images[0] }}
              style={[styles.photo, { backgroundColor: theme.surface, opacity: gone ? 0.5 : 1 }]}
              contentFit="cover"
              transition={150}
            />
            <Text variant="bodyStrong" numberOfLines={1}>
              {p.title}
            </Text>
            <Text variant="caption" color="textMuted">
              {gone ? 'sold out' : formatPrice(fromPrice(p), shop.currency)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.xl },
  cell: { width: '48%', gap: space.xxs },
  photo: { width: '100%', aspectRatio: 4 / 5, borderRadius: radius.md, marginBottom: space.xs },
});
