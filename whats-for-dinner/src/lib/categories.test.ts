import { describe, expect, it } from 'vitest';
import { guessCategory } from './categories';

describe('guessCategory', () => {
  it('sorts everyday items into the right aisle', () => {
    expect(guessCategory('Tomatoes')).toBe('produce');
    expect(guessCategory('chicken thighs')).toBe('meat');
    expect(guessCategory('Basmati rice')).toBe('grains');
    expect(guessCategory('whole milk')).toBe('dairy');
    expect(guessCategory('olive oil')).toBe('condiments');
    expect(guessCategory('kitchen roll')).toBe('household');
  });

  it('falls back to other rather than guessing wildly', () => {
    expect(guessCategory('birthday candles')).toBe('other');
    expect(guessCategory('')).toBe('other');
  });
});

describe('guessCategory word matching', () => {
  it('does not match a keyword buried inside another word', () => {
    expect(guessCategory('kitchen roll')).not.toBe('bakery');
    expect(guessCategory('birthday candles')).not.toBe('canned');
  });

  it('prefers a specific phrase over a generic word', () => {
    expect(guessCategory('coconut milk')).toBe('canned');
    expect(guessCategory('whole milk')).toBe('dairy');
  });

  it('handles plurals and casing', () => {
    expect(guessCategory('ONIONS')).toBe('produce');
    expect(guessCategory('Chicken Breasts')).toBe('meat');
  });
});
