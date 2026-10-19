import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Rect } from 'react-native-svg';

import { Text } from '@/components/ui';
import type { Item, Level } from '@/game/level';
import { fonts, radius, useTheme } from '@/theme';

type BoardProps = {
  level: Level;
  /** Show the mistake in Oops Orange. */
  revealed: boolean;
  /** Bumped by the parent after a wrong tap to shake the board. */
  wrongTick: number;
  onTap: (index: number) => void;
  disabled?: boolean;
};

export function Board({ level, revealed, wrongTick, onTap, disabled }: BoardProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const shake = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!wrongTick) return;
    shake.setValue(0);
    Animated.sequence(
      [8, -8, 5, -5, 0].map((toValue) => Animated.timing(shake, { toValue, duration: 45, useNativeDriver: true })),
    ).start();
  }, [wrongTick, shake]);

  useEffect(() => {
    if (!revealed) return;
    pop.setValue(1);
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.35, duration: 140, useNativeDriver: true }),
      Animated.spring(pop, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start();
  }, [revealed, pop]);

  const cell = width / level.cols;
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[
        styles.board,
        { backgroundColor: theme.surface, height: cell * level.rows || undefined, transform: [{ translateX: shake }] },
      ]}>
      {width > 0
        ? level.items.map((item, index) => {
            const isOops = index === level.oopsIndex;
            return (
              <Pressable
                key={index}
                disabled={disabled}
                onPress={() => onTap(index)}
                accessibilityRole="button"
                accessibilityLabel={`shape ${index + 1}`}
                style={{ width: cell, height: cell, alignItems: 'center', justifyContent: 'center' }}>
                <Animated.View style={isOops && revealed ? { transform: [{ scale: pop }] } : undefined}>
                  <Mark level={level} item={item} cell={cell} oops={isOops && revealed} />
                </Animated.View>
              </Pressable>
            );
          })
        : null}
    </Animated.View>
  );
}

function Mark({ level, item, cell, oops }: { level: Level; item: Item; cell: number; oops: boolean }) {
  const theme = useTheme();
  // The orange always marks the mistake: the outline for a misprint, the whole mark otherwise.
  const fill = oops && level.mistake !== 'misregister' ? theme.oops : theme.text;
  const outline = oops ? theme.oops : theme.text;
  const size = cell * (level.shape === 'dot' ? 0.24 : 0.46);
  const stroke = Math.max(2, cell * 0.035);

  const transform = [
    { translateX: item.dx * cell },
    { translateY: item.dy * cell },
    { rotate: `${item.rotate + (item.flipped ? 180 : 0)}deg` },
  ];

  if (level.shape === 'letter') {
    return (
      <View style={{ transform }}>
        <Text style={{ fontFamily: fonts.display, fontSize: cell * 0.5, lineHeight: cell * 0.6, color: fill }}>{level.glyph}</Text>
      </View>
    );
  }

  const box = size + stroke * 2;
  const solid =
    level.shape === 'square' ? (
      <Rect x={stroke} y={stroke} width={size} height={size} fill={fill} />
    ) : level.shape === 'bar' ? (
      <Rect x={stroke} y={stroke + size * 0.38} width={size} height={size * 0.24} fill={fill} />
    ) : (
      <Circle cx={box / 2} cy={box / 2} r={size / 2} fill={fill} />
    );
  const ring =
    level.shape === 'square' ? (
      <Rect x={stroke / 2} y={stroke / 2} width={size + stroke} height={size + stroke} fill="none" stroke={outline} strokeWidth={stroke} />
    ) : (
      <Circle cx={box / 2} cy={box / 2} r={size / 2 + stroke / 2} fill="none" stroke={outline} strokeWidth={stroke} />
    );

  return (
    <View style={{ width: box, height: box, transform }}>
      <Svg width={box} height={box} style={StyleSheet.absoluteFill}>
        {solid}
      </Svg>
      {level.outlined ? (
        <Svg
          width={box}
          height={box}
          style={[StyleSheet.absoluteFill, { transform: [{ translateX: item.outlineDx * cell }, { translateY: item.outlineDy * cell }] }]}>
          {ring}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderRadius: radius.md,
    overflow: 'hidden',
  },
});
