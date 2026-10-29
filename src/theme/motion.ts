import { Easing, FadeIn, FadeInDown, FadeOut, ReduceMotion, SlideInDown, SlideOutDown, type WithTimingConfig } from 'react-native-reanimated';

/**
 * UPZZY motion: quick, quiet, no bounce. Things ease out like fabric settling,
 * never spring back. Every animation follows the phone's "reduce motion" setting.
 */
export const duration = {
  /** Finger down: buttons, cards. */
  press: 110,
  /** Finger up. */
  release: 170,
  /** Small state changes: a heart, a selected tab. */
  micro: 180,
  /** Content arriving on a screen. */
  enter: 300,
  /** Sheets and overlays. */
  sheet: 300,
  /** A photo-sized moment, like the double-tap heart. */
  image: 360,
} as const;

/** Fast start, soft landing. */
export const easeOut = Easing.bezier(0.2, 0, 0, 1);

export function timing(ms: number): WithTimingConfig {
  return { duration: ms, easing: easeOut, reduceMotion: ReduceMotion.System };
}

/** Ready-made entrances for content, sheets and overlays. */
export const enter = {
  fade: FadeIn.duration(duration.enter).easing(easeOut).reduceMotion(ReduceMotion.System),
  rise: FadeInDown.duration(duration.enter).easing(easeOut).reduceMotion(ReduceMotion.System),
  sheet: SlideInDown.duration(duration.sheet).easing(easeOut).reduceMotion(ReduceMotion.System),
};

export const exit = {
  fade: FadeOut.duration(duration.micro).reduceMotion(ReduceMotion.System),
  sheet: SlideOutDown.duration(duration.micro + 40).reduceMotion(ReduceMotion.System),
};
