import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Shade, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { getDrop } from '@/lib/shop';
import { colourPhotos, priceLabel, soldOut, type ShopProduct } from '@/social/shop';
import { fonts, radius, space, useTheme } from '@/theme';

const FACTS = ['50 per colour', 'numbered', 'never restocked'];

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
      <View style={styles.hero}>
        <Text variant="label" color="textMuted">
          drop 001 · {products ? `${products.length} pieces` : 'the first one'}
        </Text>
        <Text style={styles.big}>happened by mistake.{'\n'}stayed on purpose.</Text>
        <View style={styles.facts}>
          {FACTS.map((f) => (
            <View key={f} style={[styles.fact, { borderColor: theme.border }]}>
              <Text variant="caption">{f}</Text>
            </View>
          ))}
        </View>
      </View>

      {error ? (
        <View style={styles.hero}>
          <Text variant="title">{error}</Text>
          <Button label="try again" variant="outline" onPress={retry} />
        </View>
      ) : !products ? (
        [0, 1].map((i) => <View key={i} style={[styles.ghost, { backgroundColor: theme.surface }]} />)
      ) : (
        products.map((p) => <ProductCard key={p.handle} product={p} />)
      )}
    </View>
  );
}

function ProductCard({ product }: { product: ShopProduct }) {
  const theme = useTheme();
  const gone = soldOut(product);
  const colours = colourPhotos(product);
  const name = product.title.toLowerCase();
  const onPhoto = { color: theme.onPhoto, textShadowColor: theme.photoShadow };

  return (
    <Pressable
      onPress={() => {
        haptic('tap');
        router.push({ pathname: '/product/[handle]', params: { handle: product.handle } });
      }}
      accessibilityRole="link"
      accessibilityLabel={`${name}, ${gone ? 'sold out' : priceLabel(product)}${colours.length ? `, ${colours.length} colours` : ''}`}
      style={({ pressed }) => [styles.card, { backgroundColor: theme.surface, transform: [{ scale: pressed ? 0.985 : 1 }] }]}>
      <View>
        {product.images[0] ? (
          <Image source={{ uri: product.images[0].src }} style={styles.photo} contentFit="cover" transition={200} />
        ) : (
          <View style={styles.photo} />
        )}
        <Shade from="bottom" height={170} strength={0.75} />
        <View style={[styles.badge, { backgroundColor: theme.photoScrim }]}>
          <Text variant="caption" style={[styles.badgeText, { color: theme.onPhoto }]}>
            {gone ? 'sold out' : 'drop 001'}
          </Text>
        </View>
        <View style={styles.overlay}>
          <Text style={[styles.name, styles.shadow, onPhoto]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.price, styles.shadow, onPhoto]}>{gone ? 'sold out' : priceLabel(product)}</Text>
        </View>
      </View>

      {colours.length > 1 ? (
        <View style={styles.footer}>
          <View style={styles.swatches}>
            {colours.map((c) =>
              c.image ? (
                <Image key={c.value} source={{ uri: c.image }} style={[styles.swatch, { borderColor: theme.border }]} contentFit="cover" />
              ) : null,
            )}
          </View>
          <Text variant="caption" color="textMuted">
            {colours.map((c) => c.value.toLowerCase()).join(' · ')}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { gap: space.xl },
  hero: { gap: space.md },
  big: { fontFamily: fonts.bodyBold, fontSize: 32, lineHeight: 37, letterSpacing: -0.9 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  fact: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  ghost: { borderRadius: radius.lg, aspectRatio: 4 / 5 },
  card: { borderRadius: radius.lg, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 4 / 5 },
  badge: { position: 'absolute', top: space.md, left: space.md, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 5 },
  badgeText: { fontFamily: fonts.bodyBold },
  overlay: { position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg, flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  name: { flex: 1, fontFamily: fonts.bodyBold, fontSize: 24, lineHeight: 29, letterSpacing: -0.5 },
  price: { fontFamily: fonts.bodySemiBold, fontSize: 17, lineHeight: 22 },
  shadow: { textShadowRadius: 8, textShadowOffset: { width: 0, height: 1 } },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  swatches: { flexDirection: 'row', gap: 6 },
  swatch: { width: 30, height: 30, borderRadius: 15, borderWidth: 1 },
});
