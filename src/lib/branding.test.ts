import { describe, expect, it } from 'vitest';
import { greeting } from '@/lib/branding';

describe('greeting', () => {
  it.each([
    [0, 'Good night'],
    [5, 'Good night'],
    [6, 'Good morning'],
    [12, 'Good morning'],
    [13, 'Good afternoon'],
    [17, 'Good afternoon'],
    [18, 'Good evening'],
    [23, 'Good evening'],
  ])('at %i:00 says "%s"', (hour, expected) => {
    expect(greeting(hour, '')).toBe(expected);
  });

  it('adds the therapist name when given', () => {
    expect(greeting(9, 'Dr Bianchi')).toBe('Good morning, Dr Bianchi');
  });
});
