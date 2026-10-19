import { validateUsername } from '@/lib/validation';

describe('validateUsername', () => {
  it.each(['raul', 'upzzy_crew', 'a.b9', 'abc', 'x'.repeat(24)])('accepts %s', (name) => {
    expect(validateUsername(name)).toBeNull();
  });

  it('normalises case and whitespace before validating', () => {
    expect(validateUsername('  Raul_03 ')).toBeNull();
  });

  it.each(['ab', 'x'.repeat(25), '_raul', 'raul.', 'ra ul', 'raúl', 'ra__ul', 'ra._ul'])('rejects %s', (name) => {
    expect(validateUsername(name)).not.toBeNull();
  });
});
