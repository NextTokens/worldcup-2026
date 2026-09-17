/**
 * jsonb columns come back parsed, but a value written as a JSON *string* by an
 * older build (or by hand) reads back as a string. Readers go through this so
 * one bad row cannot blank out a dish's ingredients.
 */
export function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function asObject<T>(value: unknown): T | null {
  if (value && typeof value === 'object') return value as T;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === 'object' ? (parsed as T) : null;
    } catch {
      return null;
    }
  }
  return null;
}
