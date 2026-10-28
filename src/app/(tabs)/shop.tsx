import { StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { ShopList } from '@/components/shop/ShopList';
import { Screen, Text } from '@/components/ui';
import { space } from '@/theme';

/** The store, inside the app. Checkout is Shopify's, opened over the app. */
export default function ShopScreen() {
  return (
    <Screen
      header={
        <View style={styles.header}>
          <Wordmark />
        </View>
      }>
      <View style={styles.intro}>
        <Text variant="title">shop.</Text>
        <Text color="textMuted">every piece has a code inside. that&apos;s your way in.</Text>
      </View>
      <ShopList />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  intro: { gap: space.xs, paddingTop: space.lg, paddingBottom: space.xl },
});
