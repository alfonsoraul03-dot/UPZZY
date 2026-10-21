import {
  CAPTION_MAX,
  chatTime,
  MESSAGE_MAX,
  normalizeMessage,
  displayName,
  isDoubleTap,
  isEmail,
  isLoginCode,
  isPlaceholderUsername,
  lateLabel,
  minutesBetween,
  monthName,
  normalizeCaption,
  photoPath,
  pointsFor,
  reactionPath,
  shortDay,
  streakLabel,
} from '@/social/rules';

describe('social rules', () => {
  it('cleans captions and keeps them short', () => {
    expect(normalizeCaption('   ')).toBeNull();
    expect(normalizeCaption('  one   wrong  thing ')).toBe('one wrong thing');
    expect(normalizeCaption('x'.repeat(200))).toHaveLength(CAPTION_MAX);
  });

  it('puts photos in the uploader folder, matching the server rule', () => {
    expect(photoPath('user-1', 'chal-1', 'abc123')).toBe('user-1/chal-1-abc123.jpg');
    expect(photoPath('user-1', 'chal-1', '../../x')).toBe('user-1/chal-1-x.jpg');
    expect(photoPath('user-1', 'chal-1', '')).toBe('user-1/chal-1-photo.jpg');
  });

  it('spots placeholder usernames', () => {
    expect(isPlaceholderUsername('member0123456789ab')).toBe(true);
    expect(isPlaceholderUsername(null)).toBe(true);
    expect(isPlaceholderUsername('raul')).toBe(false);
    expect(displayName('member0123456789ab')).toBe('someone');
    expect(displayName('raul')).toBe('@raul');
  });

  it('checks email and login codes', () => {
    expect(isEmail('raul@upzzy.com')).toBe(true);
    expect(isEmail('raul@upzzy')).toBe(false);
    expect(isLoginCode('123456')).toBe(true);
    expect(isLoginCode('12345')).toBe(false);
    expect(isLoginCode('12a456')).toBe(false);
  });

  it('detects double taps', () => {
    expect(isDoubleTap(1000, 1200)).toBe(true);
    expect(isDoubleTap(1000, 1400)).toBe(false);
    expect(isDoubleTap(0, 0)).toBe(false);
  });

  it('gives points like the server: 100 early, 1 less every 5 minutes, at least 10', () => {
    expect(pointsFor(0)).toBe(100);
    expect(pointsFor(5)).toBe(100);
    expect(pointsFor(10)).toBe(99);
    expect(pointsFor(30)).toBe(95);
    expect(pointsFor(60)).toBe(89);
    expect(pointsFor(180)).toBe(65);
    expect(pointsFor(10000)).toBe(10);
  });

  it('measures and labels lateness', () => {
    expect(minutesBetween('2026-10-19T10:00:00Z', '2026-10-19T10:30:00Z')).toBe(30);
    expect(minutesBetween('2026-10-19T10:30:00Z', '2026-10-19T10:00:00Z')).toBe(0);
    expect(lateLabel(0.5)).toBe('right at the drop');
    expect(lateLabel(12.7)).toBe('12 min after the drop');
    expect(lateLabel(185)).toBe('3 h after the drop');
  });

  it('builds reaction paths matching the server rule', () => {
    expect(reactionPath('u', 'p', 'ab-1')).toBe('u/r-p-ab1.jpg');
  });

  it('names months and days in madrid time', () => {
    expect(monthName(new Date('2026-10-31T23:30:00Z'))).toBe('november');
    expect(shortDay('2026-10-19')).toBe('oct 19');
    expect(streakLabel(1)).toBe('1 day streak');
    expect(streakLabel(12)).toBe('12 day streak');
  });

  it('trims messages and refuses empty ones', () => {
    expect(normalizeMessage('  hola  ')).toBe('hola');
    expect(normalizeMessage('   ')).toBeNull();
    expect(normalizeMessage('a'.repeat(MESSAGE_MAX + 5))).toHaveLength(MESSAGE_MAX);
  });

  it('labels chat times in Madrid', () => {
    const now = new Date('2026-10-21T12:00:00Z');
    expect(chatTime('2026-10-21T11:59:30Z', now)).toBe('now');
    expect(chatTime('2026-10-21T08:05:00Z', now)).toBe('10:05');
    expect(chatTime('2026-10-19T08:05:00Z', now)).toBe('oct 19');
    // 22:30 UTC on the 20th is already the 21st in Madrid.
    expect(chatTime('2026-10-20T22:30:00Z', now)).toBe('00:30');
  });
});
