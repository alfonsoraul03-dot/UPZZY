import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button, Sheet, Text } from '@/components/ui';
import { useBag } from '@/hooks/useBag';
import { haptic } from '@/lib/haptics';
import { openCheckout } from '@/lib/shop';
import { bagTotal, formatPrice, MAX_PER_ITEM } from '@/social/shop';
import { fonts, radius, space, useTheme } from '@/theme';

/** What you picked. Checkout opens the store's own payment page over the app. */
export default function BagScreen() {
  const theme = useTheme();
  const { bag, setQuantity, clear } = useBag();
  const [busy, setBusy] = useState(false);

  if (!bag.length) {
    return (
      <Sheet title="bag">
        <Text variant="title">your bag is empty.</Text>
        <Button label="see the drop" onPress={() => router.replace('/shop')} />
      </Sheet>
    );
  }

  const checkout = async () => {
    haptic('tap');
    setBusy(true);
    try {
      await openCheckout(bag);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="bag">
      <View style={styles.list}>
        {bag.map((item) => (
          <View key={item.variantId} style={[styles.item, { backgroundColor: theme.surface }]}>
            {item.image ? <Image source={{ uri: item.image }} style={styles.thumb} contentFit="cover" /> : null}
            <View style={styles.middle}>
              <Text variant="bodyStrong">{item.title}</Text>
              <Text variant="caption" color="textMuted">
                {item.options.join(' · ')}
              </Text>
              <Text>{formatPrice(Number(item.price) * item.quantity)}</Text>
            </View>
            <View style={styles.stepper}>
              <Step label="−" name={`one less ${item.title}`} onPress={() => setQuantity(item.variantId, item.quantity - 1)} />
              <Text style={styles.qty} accessibilityLabel={`${item.quantity}`}>
                {item.quantity}
              </Text>
              <Step
                label="+"
                name={`one more ${item.title}`}
                disabled={item.quantity >= MAX_PER_ITEM}
                onPress={() => setQuantity(item.variantId, item.quantity + 1)}
              />
            </View>
          </View>
        ))}
      </View>

      <View style={styles.total}>
        <Text variant="title">total</Text>
        <Text variant="title">{formatPrice(bagTotal(bag))}</Text>
      </View>
      <Text variant="caption" color="textMuted">
        shipping and taxes on the next step. you pay on the upzzy store checkout: card and apple pay.
      </Text>
      <Button label={busy ? 'opening…' : `checkout · ${formatPrice(bagTotal(bag))}`} onPress={checkout} disabled={busy} />
      <Button label="empty the bag" variant="outline" onPress={clear} disabled={busy} />
    </Sheet>
  );
}

function Step({ label, name, onPress, disabled }: { label: string; name: string; onPress: () => void; disabled?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic('tap');
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={name}
      hitSlop={8}
      style={[styles.step, { borderColor: theme.border, opacity: disabled ? 0.35 : 1 }]}>
      <Text style={styles.stepText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { gap: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: radius.lg },
  thumb: { width: 64, height: 80, borderRadius: radius.md },
  middle: { flex: 1, gap: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  step: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: fonts.bodyBold, fontSize: 18, lineHeight: 22 },
  qty: { fontFamily: fonts.bodyBold, minWidth: 16, textAlign: 'center' },
  total: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.md },
});
