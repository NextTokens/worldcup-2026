import { describe, expect, it } from 'vitest';
import { canonicalUnit, coversAmount, formatAmount, toBase, unitFamily } from './units';

describe('canonicalUnit', () => {
  it('folds spellings and plurals', () => {
    expect(canonicalUnit('grams')).toBe('g');
    expect(canonicalUnit('Kilograms')).toBe('kg');
    expect(canonicalUnit('tablespoons')).toBe('tbsp');
    expect(canonicalUnit('')).toBe('unit');
  });
});

describe('toBase', () => {
  it('converts within a family', () => {
    expect(toBase(2, 'kg')).toEqual({ family: 'mass', amount: 2000 });
    expect(toBase(1.5, 'l')).toEqual({ family: 'volume', amount: 1500 });
  });

  it('returns null for units it does not know', () => {
    expect(toBase(1, 'handful')).toBeNull();
    expect(unitFamily('handful')).toBe('unknown');
  });
});

describe('coversAmount', () => {
  it('compares across units in the same family', () => {
    expect(coversAmount({ quantity: 1, unit: 'kg' }, { quantity: 800, unit: 'g' })).toBe(true);
    expect(coversAmount({ quantity: 200, unit: 'g' }, { quantity: 1, unit: 'kg' })).toBe(false);
  });

  it('allows a cook\'s rounding', () => {
    expect(coversAmount({ quantity: 460, unit: 'g' }, { quantity: 500, unit: 'g' })).toBe(true);
    expect(coversAmount({ quantity: 300, unit: 'g' }, { quantity: 500, unit: 'g' })).toBe(false);
  });

  it('reports "not comparable" rather than guessing', () => {
    expect(coversAmount({ quantity: 1, unit: 'pack' }, { quantity: 200, unit: 'g' })).toBeNull();
  });

  it('falls back to presence when no amount is called for', () => {
    expect(coversAmount({ quantity: 1, unit: 'unit' }, { quantity: 0, unit: 'unit' })).toBe(true);
    expect(coversAmount({ quantity: 0, unit: 'unit' }, { quantity: 0, unit: 'unit' })).toBe(false);
  });
});

describe('formatAmount', () => {
  it('writes amounts the way a list would', () => {
    expect(formatAmount(1.5, 'kg')).toBe('1.5 kg');
    expect(formatAmount(2, 'unit')).toBe('2');
    expect(formatAmount(0, 'g')).toBe('g');
  });
});
