import { StyleSheet, View } from 'react-native';

import { Wordmark } from '@/components/brand/Wordmark';
import { BagButton } from '@/components/shop/BagButton';
import { ShopList } from '@/components/shop/ShopList';
import { Screen } from '@/components/ui';
import { space } from '@/theme';

/** The shop tab: the drop's pieces in the app. Paying happens on the store's checkout. */
export default function ShopScreen() {
  return (
    <Screen
      header={
        <View style={styles.header}>
          <Wordmark />
          <View style={styles.bag}>
            <BagButton />
          </View>
        </View>
      }>
      <ShopList />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 56, alignItems: 'center', justifyContent: 'center' },
  bag: { position: 'absolute', right: space.xl, top: 16 },
});
