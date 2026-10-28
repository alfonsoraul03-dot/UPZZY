import Svg, { Circle, Path } from 'react-native-svg';

const PATHS = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  ranking: 'M5 20V10M12 20V4M19 20v-7',
  bag: 'M5 8h14l-1 12H6zM9 8V6a3 3 0 0 1 6 0v2',
  user: 'M4 21c1-4 4-6 8-6s7 2 8 6',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z',
  share: 'M12 4v11M7 9l5-5 5 5M5 14v6h14v-6',
  send: 'M21 3L10 14M21 3l-7 18-4-7-7-4z',
  back: 'M15 5l-7 7 7 7',
  plus: 'M12 5v14M5 12h14',
  flame: 'M12 3c1 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-4 2-7 2 1 3 2 3 4 1-2 1-5 1-8z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  heart: 'M12 20s-7.5-4.6-9-9.2C1.9 7.4 4 4.5 7.2 4.5c2 0 3.6 1.1 4.8 2.8 1.2-1.7 2.8-2.8 4.8-2.8 3.2 0 5.3 2.9 4.2 6.3C19.5 15.4 12 20 12 20z',
} as const;

export type IconName = keyof typeof PATHS | 'dots';

/** Line icons drawn with the text colour. */
export function Icon({
  name,
  color,
  size = 24,
  weight = 1.9,
  filled,
}: {
  name: IconName;
  color: string;
  size?: number;
  weight?: number;
  /** Fill the shape, for an "on" state such as a liked heart. */
  filled?: boolean;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
      {name === 'dots' ? (
        [5, 12, 19].map((x) => <Circle key={x} cx={x} cy={12} r={1.4} fill={color} />)
      ) : (
        <Path d={PATHS[name]} fill={filled ? color : 'none'} />
      )}
      {name === 'user' ? <Circle cx={12} cy={8} r={4} /> : null}
      {name === 'camera' ? <Circle cx={12} cy={13} r={3.5} /> : null}
    </Svg>
  );
}
