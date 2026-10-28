import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { getDrop } from '@/lib/shop';
import { priceLabel, soldOut, type ShopProduct } from '@/social/shop';
import { radius, space, useTheme } from '@/theme';

/** The drop's pieces, read live from the store. Tap one to pick colour and size. */
export function ShopList() {
  const theme = useTheme();
  const [products, setProducts] = useState<ShopProduct[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDrop = useCallback(
    () =>
      getDrop()
        .then(setProducts)
        .catch((e: Error) => setError(e.message || "the shop didn't answer. try again.")),
    [],
  );

  useEffect(() => {
    fetchDrop();
  }, [fetchDrop]);

  const retry = () => {
    setError(null);
    fetchDrop();
  };

  return (
    <View style={styles.root}>
      <View style={styles.intro}>
        <Text variant="label" color="textMuted">
          drop 001
        </Text>
        <Text variant="title">three things. that&apos;s it.</Text>
        <Text color="textMuted">50 of each colour. numbered. never restocked.</Text>
      </View>

      {error ? (
        <View style={styles.intro}>
          <Text variant="title">{error}</Text>
          <Button label="try again" variant="outline" onPress={retry} />
        </View>
      ) : !products ? (
        <Text color="textMuted">loading…</Text>
      ) : (
        products.map((p) => {
          const gone = soldOut(p);
          const image = p.images[0]?.src;
          return (
            <Pressable
              key={p.handle}
              onPress={() => router.push({ pathname: '/product/[handle]', params: { handle: p.handle } })}
              accessibilityRole="link"
              accessibilityLabel={`${p.title.toLowerCase()}, ${gone ? 'sold out' : priceLabel(p)}`}
              style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, opacity: pressed ? 0.85 : 1 }]}>
              {image ? <Image source={{ uri: image }} style={styles.image} contentFit="cover" transition={150} /> : null}
              <View style={styles.row}>
                <Text variant="bodyStrong">{p.title.toLowerCase()}</Text>
                <Text color={gone ? 'textMuted' : 'text'}>{gone ? 'sold out' : priceLabel(p)}</Text>
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.lg },
  intro: { gap: space.xs },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  image: { width: '100%', aspectRatio: 4 / 5 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.lg },
});
