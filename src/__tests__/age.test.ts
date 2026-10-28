import { ADULT_AGE, ageOn, birthDate } from '@/social/rules';

const today = new Date('2026-10-28T12:00:00Z');

describe('age', () => {
  it('reads a typed birth date', () => {
    expect(birthDate('7', '3', '2001', today)).toBe('2001-03-07');
    expect(birthDate('31', '2', '2001', today)).toBeNull();
    expect(birthDate('1', '1', '1899', today)).toBeNull();
    expect(birthDate('29', '10', '2026', today)).toBeNull();
    expect(birthDate('', '1', '2000', today)).toBeNull();
  });

  it('counts whole years in Madrid', () => {
    expect(ageOn('2008-10-28', today)).toBe(ADULT_AGE);
    expect(ageOn('2008-10-29', today)).toBe(ADULT_AGE - 1);
    expect(ageOn('1990-01-01', today)).toBe(36);
  });
});
