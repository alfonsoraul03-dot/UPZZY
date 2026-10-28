import { StyleSheet, View } from 'react-native';

import { BagButton } from '@/components/shop/BagButton';
import { ShopList } from '@/components/shop/ShopList';
import { Sheet, Text } from '@/components/ui';
import { space } from '@/theme';

/** The shop for people without a code yet (from the door). Members have it as a tab. */
export default function DropScreen() {
  return (
    <Sheet title="shop">
      <View style={styles.bag}>
        <BagButton />
      </View>
      <ShopList />
      <View style={styles.footer}>
        <Text variant="caption" color="textMuted">
          made by mistake. worn on purpose.
        </Text>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  bag: { alignItems: 'flex-end' },
  footer: { alignItems: 'center', paddingTop: space.md },
});
