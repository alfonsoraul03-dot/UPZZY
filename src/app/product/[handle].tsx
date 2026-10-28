import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BagButton } from '@/components/shop/BagButton';
import { Button, Icon, Text } from '@/components/ui';
import { useBag } from '@/hooks/useBag';
import { haptic } from '@/lib/haptics';
import { getProduct } from '@/lib/shop';
import { canPick, findVariant, formatPrice, imagesFor, priceLabel, soldOut, type ShopProduct } from '@/social/shop';
import { fonts, layout, radius, space, useTheme } from '@/theme';

/** One piece: its photos, colour and size, and "add to bag". */
export default function ProductScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { handle } = useLocalSearchParams<{ handle: string }>();
  const { add } = useBag();
  const [product, setProduct] = useState<ShopProduct | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<(string | null)[]>([]);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    getProduct(handle)
      .then((p) => {
        setProduct(p);
        // A single colour or size needs no choosing.
        if (p) setChosen(p.options.map((o) => (o.values.length === 1 ? o.values[0] : null)));
      })
      .catch((e: Error) => setError(e.message));
  }, [handle]);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/shop'));
  const bar = (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="back" hitSlop={12}>
        <Icon name="back" color={theme.text} />
      </Pressable>
      <BagButton />
    </View>
  );

  if (!product) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background }]}>
        {bar}
        <View style={styles.pad}>
          <Text color="textMuted">{error ?? (product === null ? 'that piece is gone.' : 'loading…')}</Text>
        </View>
      </View>
    );
  }

  const variant = findVariant(product, chosen);
  const colourIndex = product.options.findIndex((o) => /colou?r/i.test(o.name));
  const photos = imagesFor(product, variant, colourIndex >= 0 ? chosen[colourIndex] : null);
  const missing = product.options.find((_, i) => !chosen[i]);
  const gone = soldOut(product);

  const pick = (index: number, value: string) => {
    haptic('tap');
    setAdded(false);
    setChosen((c) => c.map((v, i) => (i === index ? value : v)));
  };

  const addIt = () => {
    if (!variant?.available) return;
    add({
      variantId: variant.id,
      handle: product.handle,
      title: product.title.toLowerCase(),
      options: variant.options.map((o) => o.toLowerCase()),
      price: variant.price,
      image: photos[0] ?? null,
    });
    haptic('found');
    setAdded(true);
  };

  let cta: React.ReactNode;
  if (gone) cta = <Button label="sold out" disabled onPress={() => {}} />;
  else if (added) cta = <Button label="in your bag · checkout" onPress={() => router.push('/bag')} />;
  else if (!variant) cta = <Button label={`pick a ${missing?.name.toLowerCase() ?? 'size'}`} disabled onPress={() => {}} />;
  else if (!variant.available) cta = <Button label="sold out in this one" disabled onPress={() => {}} />;
  else cta = <Button label={`add to bag · ${formatPrice(variant.price)}`} onPress={addIt} />;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      {bar}
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + space.xxl }} showsVerticalScrollIndicator={false}>
        <FlatList
          key={photos[0]}
          data={photos}
          keyExtractor={(src) => src}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <Image source={{ uri: item }} style={{ width, aspectRatio: 4 / 5, backgroundColor: theme.surface }} contentFit="cover" transition={150} />
          )}
        />
        <View style={styles.pad}>
          <View style={styles.titleRow}>
            <Text variant="heading" style={styles.title}>
              {product.title.toLowerCase()}
            </Text>
            <Text variant="title">{variant ? formatPrice(variant.price) : priceLabel(product)}</Text>
          </View>

          {product.options.map((option, index) => (
            <View key={option.name} style={styles.option}>
              <Text variant="label" color="textMuted">
                {option.name.toLowerCase()}
              </Text>
              <View style={styles.chips}>
                {option.values.map((value) => {
                  const selected = chosen[index] === value;
                  const can = canPick(product, chosen, index, value);
                  return (
                    <Pressable
                      key={value}
                      onPress={() => pick(index, value)}
                      accessibilityRole="button"
                      accessibilityLabel={`${value.toLowerCase()}${can ? '' : ', sold out'}`}
                      accessibilityState={{ selected }}
                      style={[
                        styles.chip,
                        {
                          borderColor: selected ? theme.text : theme.border,
                          backgroundColor: selected ? theme.text : 'transparent',
                          opacity: can || selected ? 1 : 0.35,
                        },
                      ]}>
                      <Text style={[styles.chipText, { color: selected ? theme.onText : theme.text }]}>{value.toLowerCase()}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}

          {cta}
          {added ? (
            <Button
              label="keep looking"
              variant="outline"
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/shop'))}
            />
          ) : null}

          {product.description ? <Text color="textMuted">{product.description}</Text> : null}
          <Text variant="caption" color="textMuted">
            you pay on the upzzy store checkout. card and apple pay.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: layout.gutter,
    minHeight: 56,
    paddingBottom: space.sm,
  },
  pad: { paddingHorizontal: layout.gutter, paddingTop: space.lg, gap: space.lg },
  titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.md },
  title: { flex: 1 },
  option: { gap: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, minWidth: 48, alignItems: 'center' },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 15 },
});
