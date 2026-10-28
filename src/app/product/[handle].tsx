import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { haptic } from '@/lib/haptics';
import { buy, loadShop, type Shop } from '@/lib/shop';
import { friendlyError } from '@/lib/social';
import { formatPrice, fromPrice, soldOut } from '@/social/shop';
import { fonts, layout, radius, space, useTheme } from '@/theme';

/** One piece: photos, sizes and "buy", which opens Shopify's checkout over the app. */
export default function ProductScreen() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const [shop, setShop] = useState<Shop | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadShop().then(setShop, (e) => setError(friendlyError(e)));
  }, []);

  const product = shop?.products.find((p) => p.handle === handle);

  if (error) return <Sheet title="shop"><Text variant="title">{error}</Text></Sheet>;
  if (!shop) return <Sheet title="shop"><Text color="textMuted">loading…</Text></Sheet>;
  if (!product) return <Sheet title="shop"><Text variant="title">this one is gone.</Text></Sheet>;

  // A piece with one option (no sizes) needs no picking.
  const only = product.variants.length === 1 && product.variants[0].available ? product.variants[0].id : null;
  const variant = product.variants.find((v) => v.id === (picked ?? only));
  const gone = soldOut(product);
  const photoWidth = Math.min(width, layout.maxContentWidth) - layout.gutter * 2;
  const hasSizes = product.variants.length > 1;

  const checkout = async () => {
    if (!variant) return;
    haptic('tap');
    setBusy(true);
    try {
      await buy(variant.id);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="shop">
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ width: photoWidth }}>
        {product.images.map((src, i) => (
          <Image
            key={src}
            source={{ uri: src }}
            style={[styles.photo, { width: photoWidth, backgroundColor: theme.surface }]}
            contentFit="cover"
            transition={150}
            accessibilityLabel={`${product.title}, photo ${i + 1} of ${product.images.length}`}
          />
        ))}
      </ScrollView>

      <View style={styles.head}>
        <Text variant="title">{product.title}</Text>
        <Text color="textMuted">{gone ? 'sold out' : formatPrice(variant?.price ?? fromPrice(product), shop.currency)}</Text>
      </View>

      {hasSizes ? (
        <View style={styles.sizes} accessibilityRole="radiogroup">
          {product.variants.map((v) => {
            const on = v.id === variant?.id;
            return (
              <Pressable
                key={v.id}
                disabled={!v.available}
                onPress={() => {
                  haptic('tap');
                  setPicked(v.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: on, disabled: !v.available }}
                accessibilityLabel={v.available ? v.title : `${v.title}, sold out`}
                style={[
                  styles.size,
                  { borderColor: on ? theme.text : theme.border, backgroundColor: on ? theme.text : 'transparent', opacity: v.available ? 1 : 0.35 },
                ]}>
                <Text style={[styles.sizeText, { color: on ? theme.onText : theme.text, textDecorationLine: v.available ? 'none' : 'line-through' }]}>
                  {v.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Button
        label={gone ? 'sold out' : variant ? `buy · ${formatPrice(variant.price, shop.currency)}` : 'pick a size'}
        disabled={gone || !variant || busy}
        onPress={checkout}
      />

      {product.description ? <Text color="textMuted">{product.description}</Text> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  photo: { aspectRatio: 4 / 5, borderRadius: radius.md },
  head: { gap: space.xxs },
  sizes: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  size: { minWidth: 52, height: 44, paddingHorizontal: space.md, borderWidth: 1, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  sizeText: { fontFamily: fonts.bodySemiBold },
});
