import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BagButton } from '@/components/shop/BagButton';
import { Button, Icon, Shade, Text } from '@/components/ui';
import { useBag } from '@/hooks/useBag';
import { haptic } from '@/lib/haptics';
import { getProduct } from '@/lib/shop';
import { canPick, colourPhotos, findVariant, formatPrice, imagesFor, priceLabel, soldOut, type ShopProduct } from '@/social/shop';
import { fonts, layout, radius, space, useTheme } from '@/theme';
import { duration, easeOut } from '@/theme/motion';

// The current-photo dot stretches across smoothly when you swipe.
const DOT_MOVE = LinearTransition.duration(duration.micro).easing(easeOut);

/** One piece: its photos, colour and size, and "add to bag" in a bar at the bottom. */
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
  const [page, setPage] = useState(0);

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
    <View style={[styles.bar, { top: insets.top + space.sm }]} pointerEvents="box-none">
      <Pressable
        onPress={back}
        accessibilityRole="button"
        accessibilityLabel="back"
        hitSlop={12}
        style={[styles.round, { backgroundColor: theme.surface }]}>
        <Icon name="back" color={theme.text} size={22} />
      </Pressable>
      <View style={[styles.round, { backgroundColor: theme.surface }]}>
        <BagButton />
      </View>
    </View>
  );

  if (!product) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.background, paddingTop: insets.top + 72 }]}>
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
  const colours = colourPhotos(product);
  const missing = product.options.find((_, i) => !chosen[i]);
  const gone = soldOut(product);
  const name = product.title.toLowerCase();

  const pick = (index: number, value: string) => {
    haptic('tap');
    setAdded(false);
    if (index === colourIndex) setPage(0);
    setChosen((c) => c.map((v, i) => (i === index ? value : v)));
  };

  const addIt = () => {
    if (!variant?.available) return;
    add({
      variantId: variant.id,
      handle: product.handle,
      title: name,
      options: variant.options.map((o) => o.toLowerCase()),
      price: variant.price,
      image: photos[0] ?? null,
    });
    haptic('found');
    setAdded(true);
  };

  let cta: React.ReactNode;
  if (gone) cta = <Button label="sold out" disabled onPress={() => {}} style={styles.cta} />;
  else if (added) cta = <Button label="in your bag · checkout" onPress={() => router.push('/bag')} style={styles.cta} />;
  else if (!variant) cta = <Button label={`pick a ${missing?.name.toLowerCase() ?? 'size'}`} disabled onPress={() => {}} style={styles.cta} />;
  else if (!variant.available) cta = <Button label="sold out in this one" disabled onPress={() => {}} style={styles.cta} />;
  else cta = <Button label="add to bag" onPress={addIt} style={styles.cta} />;

  return (
    <View style={[styles.fill, { backgroundColor: theme.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <View>
          <FlatList
            key={photos[0]}
            data={photos}
            keyExtractor={(src) => src}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <Image source={{ uri: item }} style={{ width, aspectRatio: 4 / 5, backgroundColor: theme.surface }} contentFit="cover" transition={240} />
            )}
          />
          <Shade from="top" height={120} strength={0.45} />
          {photos.length > 1 ? (
            <View style={styles.dots} pointerEvents="none">
              {photos.map((src, i) => (
                <Animated.View
                  key={src}
                  layout={DOT_MOVE}
                  style={[styles.dot, { backgroundColor: theme.onPhoto, opacity: i === page ? 1 : 0.4, width: i === page ? 18 : 6 }]}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.pad}>
          <View style={styles.head}>
            <Text variant="label" color="textMuted">
              drop 001 · 50 per colour · numbered
            </Text>
            <Text style={styles.name}>{name}</Text>
            <Text variant="title">{variant ? formatPrice(variant.price) : priceLabel(product)}</Text>
          </View>

          {product.options.map((option, index) => {
            const label = option.name.toLowerCase();
            const value = chosen[index];
            return (
              <View key={option.name} style={styles.option}>
                <Text variant="label" color="textMuted">
                  {label}
                  {value ? <Text variant="label">{`  ${value.toLowerCase()}`}</Text> : null}
                </Text>
                {index === colourIndex && colours.every((c) => c.image) ? (
                  <View style={styles.chips}>
                    {colours.map((c) => {
                      const selected = value === c.value;
                      const can = canPick(product, chosen, index, c.value);
                      return (
                        <Pressable
                          key={c.value}
                          onPress={() => pick(index, c.value)}
                          accessibilityRole="button"
                          accessibilityLabel={`${c.value.toLowerCase()}${can ? '' : ', sold out'}`}
                          accessibilityState={{ selected }}
                          style={[styles.colour, { borderColor: selected ? theme.text : theme.border, opacity: can || selected ? 1 : 0.35 }]}>
                          <Image source={{ uri: c.image! }} style={styles.colourPhoto} contentFit="cover" />
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.chips}>
                    {option.values.map((v) => {
                      const selected = value === v;
                      const can = canPick(product, chosen, index, v);
                      return (
                        <Pressable
                          key={v}
                          onPress={() => pick(index, v)}
                          accessibilityRole="button"
                          accessibilityLabel={`${v.toLowerCase()}${can ? '' : ', sold out'}`}
                          accessibilityState={{ selected }}
                          style={[
                            styles.chip,
                            {
                              borderColor: selected ? theme.text : theme.border,
                              backgroundColor: selected ? theme.text : 'transparent',
                              opacity: can || selected ? 1 : 0.35,
                            },
                          ]}>
                          <Text style={[styles.chipText, { color: selected ? theme.onText : theme.text }]}>{v.toLowerCase()}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })}

          {product.description ? (
            <View style={[styles.about, { borderTopColor: theme.border }]}>
              <Text variant="label" color="textMuted">
                the piece
              </Text>
              <Text color="textMuted" style={styles.aboutText}>
                {product.description}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {bar}

      <View style={[styles.buy, { backgroundColor: theme.background, borderTopColor: theme.border, paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.buyPrice}>
          {variant ? (
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {variant.options.map((o) => o.toLowerCase()).join(' · ')}
            </Text>
          ) : null}
          <Text variant="title">{variant ? formatPrice(variant.price) : priceLabel(product)}</Text>
        </View>
        {cta}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  bar: { position: 'absolute', left: layout.gutter, right: layout.gutter, flexDirection: 'row', justifyContent: 'space-between' },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  dots: { position: 'absolute', bottom: space.lg, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
  pad: { paddingHorizontal: layout.gutter, paddingTop: space.xl, gap: space.xl },
  head: { gap: space.xs },
  name: { fontFamily: fonts.bodyBold, fontSize: 32, lineHeight: 37, letterSpacing: -0.9 },
  option: { gap: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.sm, minWidth: 52, alignItems: 'center' },
  chipText: { fontFamily: fonts.bodySemiBold, fontSize: 15 },
  colour: { borderWidth: 2, borderRadius: radius.md + 6, padding: 3 },
  colourPhoto: { width: 64, height: 80, borderRadius: radius.md + 2 },
  about: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.lg, gap: space.sm },
  aboutText: { lineHeight: 23 },
  buy: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: layout.gutter,
    paddingTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
  },
  buyPrice: { flex: 1, gap: 2 },
  cta: { flex: 1.4, paddingHorizontal: space.lg },
});
