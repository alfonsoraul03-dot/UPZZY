/**
 * UPZZY icon set. Drawn on a 24px grid with a 1.75 stroke, square caps and
 * mitred joins so they match the angular wordmark. Add new icons here rather
 * than mixing in a third-party icon font.
 */
import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconProps = { size?: number; color: string; strokeWidth?: number };

const base = { fill: 'none', strokeLinecap: 'square', strokeLinejoin: 'miter' } as const;

export function HomeIcon({ size = 24, color, strokeWidth = 1.75 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 10.5 12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}

export function ChallengeIcon({ size = 24, color, strokeWidth = 1.75 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={7} width={16} height={12} stroke={color} strokeWidth={strokeWidth} {...base} />
      <Path d="M9 7l1.5-3h3L15 7" stroke={color} strokeWidth={strokeWidth} {...base} />
      <Circle cx={12} cy={13} r={3.25} stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}

export function PlusIcon({ size = 24, color, strokeWidth = 2 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 5v14M5 12h14" stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}

export function CommunityIcon({ size = 24, color, strokeWidth = 1.75 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={9} cy={8.5} r={3} stroke={color} strokeWidth={strokeWidth} {...base} />
      <Path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" stroke={color} strokeWidth={strokeWidth} {...base} />
      <Path d="M15 5.8a3 3 0 0 1 0 5.4M17 14.3c1.8.6 3 2.2 3.5 4.7" stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}

export function ProfileIcon({ size = 24, color, strokeWidth = 1.75 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8.5} r={3.5} stroke={color} strokeWidth={strokeWidth} {...base} />
      <Path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6" stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}

export function BagIcon({ size = 24, color, strokeWidth = 1.75 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M5 8h14l-1 12H6z" stroke={color} strokeWidth={strokeWidth} {...base} />
      <Path d="M9 8V6.5a3 3 0 0 1 6 0V8" stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}

export function CloseIcon({ size = 24, color, strokeWidth = 1.75 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}

export function ArrowUpRightIcon({ size = 24, color, strokeWidth = 1.75 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M7 17 17 7M9 7h8v8" stroke={color} strokeWidth={strokeWidth} {...base} />
    </Svg>
  );
}
