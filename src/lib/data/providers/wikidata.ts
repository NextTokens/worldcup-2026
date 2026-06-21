/**
 * Wikidata multilingual labels (ARCHITECTURE.md §5). Football APIs return
 * English-only names; Wikidata supplies localized team/city/player names under
 * CC0. Batch-query once and cache into i18n_labels (see seed script) — do NOT
 * call this on the render path. Polite descriptive User-Agent is required.
 */

const SPARQL = 'https://query.wikidata.org/sparql';
const UA = 'WorldCup2026App/0.1 (non-commercial; +https://example.org)';

export interface WikidataLabel {
  qid: string;
  locale: string;
  label: string;
}

/**
 * Fetch labels for a set of QIDs in the given locales via the wikibase label
 * service. Returns [] on any failure (callers degrade to English names).
 */
export async function fetchLabels(
  qids: string[],
  locales: string[],
): Promise<WikidataLabel[]> {
  if (qids.length === 0) return [];
  const values = qids.map((q) => `wd:${q}`).join(' ');
  const langs = locales.join(',');
  const query = `
    SELECT ?item ?itemLabel WHERE {
      VALUES ?item { ${values} }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "${langs}". }
    }`;

  try {
    const res = await fetch(`${SPARQL}?format=json&query=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/sparql-results+json', 'User-Agent': UA },
      next: { revalidate: 86400, tags: ['wikidata'] },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      results?: { bindings?: { item?: { value: string }; itemLabel?: { value: string; 'xml:lang'?: string } }[] };
    };
    const out: WikidataLabel[] = [];
    for (const b of data.results?.bindings ?? []) {
      const uri = b.item?.value;
      const label = b.itemLabel?.value;
      const lang = b.itemLabel?.['xml:lang'];
      if (!uri || !label || !lang) continue;
      out.push({ qid: uri.split('/').pop()!, locale: lang, label });
    }
    return out;
  } catch {
    return [];
  }
}
