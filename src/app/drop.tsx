import { StyleSheet, View } from 'react-native';

import { ShopList } from '@/components/shop/ShopList';
import { Sheet, Text } from '@/components/ui';
import { space } from '@/theme';

/** The store for people who are not in yet: the code to get in comes inside each piece. */
export default function DropScreen() {
  return (
    <Sheet title="shop">
      <View style={styles.intro}>
        <Text variant="title">every piece has a code inside.</Text>
        <Text color="textMuted">buy one, type the code, you&apos;re in.</Text>
      </View>
      <ShopList />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  intro: { gap: space.xs },
});
