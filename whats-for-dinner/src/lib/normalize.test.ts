import { describe, expect, it } from 'vitest';
import { displayName, nameSimilarity, normalizeName } from './normalize';

describe('normalizeName', () => {
  it('folds case, punctuation and plurals', () => {
    expect(normalizeName('Tomatoes')).toBe('tomato');
    expect(normalizeName('  Chicken, breasts ')).toBe('chicken breast');
    expect(normalizeName('POTATOES')).toBe('potato');
  });

  it('drops recipe filler words', () => {
    expect(normalizeName('2 large ripe tomatoes, finely chopped')).toBe('tomato');
    expect(normalizeName('freshly ground black pepper')).toBe('black pepper');
  });

  it('folds household synonyms onto one shelf', () => {
    expect(normalizeName('Aubergine')).toBe('eggplant');
    expect(normalizeName('courgettes')).toBe('zucchini');
    expect(normalizeName('beef mince')).toBe('ground beef');
  });

  it('never returns empty for a non-empty name', () => {
    expect(normalizeName('salt')).toBe('salt');
    expect(normalizeName('the')).toBe('the');
  });
});

describe('nameSimilarity', () => {
  it('scores an exact canonical match highest', () => {
    expect(nameSimilarity('Tomatoes', 'tomato')).toBe(1);
  });

  it('treats a more specific name as covered by the general one', () => {
    expect(nameSimilarity('rice', 'basmati rice')).toBe(0.8);
    expect(nameSimilarity('Basmati Rice', 'rice')).toBe(0.8);
  });

  it('matches on the head noun', () => {
    expect(nameSimilarity('olive oil', 'sunflower oil')).toBe(0.5);
  });

  it('does not match unrelated items', () => {
    expect(nameSimilarity('milk', 'chicken thighs')).toBe(0);
  });
});

describe('displayName', () => {
  it('tidies whitespace and capitalises', () => {
    expect(displayName('  basmati   rice ')).toBe('Basmati rice');
  });
});
