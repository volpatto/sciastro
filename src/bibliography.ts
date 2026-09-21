import { Cite } from '@citation-js/core';
import '@citation-js/plugin-bibtex';
import '@citation-js/plugin-csl';
import sanitizeHtml from 'sanitize-html';
import type { Locale } from './schema.js';

export interface Reference {
  key: string;
  id: string;
  html: string;
  doi?: string;
  url?: string;
}
/** Plain-text metadata for a publication card; absent source fields stay absent. */
export interface PublicationMetadata {
  title?: string;
  authors?: string;
  year?: string;
  journal?: string;
  citation?: string;
  doi?: string;
  url?: string;
}
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const field = (value: unknown): string | undefined =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value).trim() || undefined
    : undefined;
const authorName = (value: unknown): string => {
  const author = record(value);
  if (field(author.literal)) return field(author.literal)!;
  const name = [
    author.given,
    author['dropping-particle'],
    author['non-dropping-particle'],
    author.family,
  ]
    .map(field)
    .filter(Boolean)
    .join(' ');
  return [name, field(author.suffix)].filter(Boolean).join(', ');
};
export const referenceId = (key: string) =>
  `ref-${Buffer.from(key).toString('hex')}`;
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );

/** BibTeX is parsed locally. No DOI lookup or network request is performed. */
export class Bibliography {
  readonly keys: string[];
  private entries: Map<string, Record<string, unknown>>;
  private cite: Cite;
  private formatted = new Map<Locale, Map<string, string>>();
  constructor(
    bibtex: string,
    readonly style: 'apa' | 'vancouver' = 'apa',
  ) {
    let data: Array<Record<string, unknown>>;
    try {
      data = new Cite(bibtex, { forceType: '@bibtex/text' }).data;
    } catch (error) {
      throw new Error(
        `BibTeX inválido: ${error instanceof Error ? error.message : error}`,
      );
    }
    this.entries = new Map();
    for (const entry of data) {
      const key = String(entry.id ?? '');
      if (!key || this.entries.has(key))
        throw new Error(`Chave BibTeX ausente ou repetida: '${key}'.`);
      this.entries.set(key, entry);
    }
    this.keys = [...this.entries.keys()];
    this.cite = new Cite(data);
  }
  has(key: string): boolean {
    return this.entries.has(key);
  }
  publication(key: string): PublicationMetadata {
    const entry = this.entries.get(key);
    if (!entry)
      throw new Error(
        `Referência '${key}' não encontrada no arquivo BibTeX. Confira bibliography.file e a chave da publicação.`,
      );
    const dates = record(entry.issued)['date-parts'];
    const year =
      Array.isArray(dates) && Array.isArray(dates[0])
        ? field(dates[0][0])
        : undefined;
    const volume = field(entry.volume);
    const issue = field(entry.issue);
    const pages = field(entry.page)?.replace(/--?/g, '–');
    const doi = field(entry.DOI)?.replace(
      /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i,
      '',
    );
    const url = field(entry.URL);
    return {
      title: field(entry.title),
      authors: Array.isArray(entry.author)
        ? entry.author.map(authorName).filter(Boolean).join('; ') || undefined
        : undefined,
      year,
      journal: field(entry['container-title']) ?? field(entry.publisher),
      citation:
        [
          (volume ?? '') + (issue ? `(${issue})` : ''),
          pages ?? field(entry.number),
        ]
          .filter(Boolean)
          .join(', ') || undefined,
      doi,
      // Unsafe or non-web URL schemes never become publication links.
      url: url && /^https?:\/\//i.test(url) ? url : undefined,
    };
  }
  citation(keys: string[], locale: Locale): string {
    const parts = keys.map((key) => {
      const entry = this.entries.get(key);
      if (!entry)
        throw new Error(
          `Referência '${key}' não encontrada no arquivo BibTeX.`,
        );
      const label =
        this.style === 'vancouver'
          ? String(this.keys.indexOf(key) + 1)
          : this.cite
              .format('citation', {
                format: 'text',
                template: 'apa',
                entry: [key],
                citationsPre: [this.keys],
                lang: locale === 'pt' ? 'pt-BR' : 'en-US',
              })
              .replace(/^\(|\)$/g, '');
      return `<a href="#${referenceId(key)}" role="doc-biblioref">${escape(label)}</a>`;
    });
    return `<span class="citation">${this.style === 'vancouver' ? '[' : '('}${parts.join(this.style === 'vancouver' ? ', ' : '; ')}${this.style === 'vancouver' ? ']' : ')'}</span>`;
  }
  references(keys: string[], locale: Locale): Reference[] {
    if (!this.formatted.has(locale) && this.keys.length) {
      // Formatting the complete library preserves author/year disambiguation
      // (2025a/2025b) consistently across citations and all site pages.
      this.formatted.set(
        locale,
        new Map(
          this.cite.format('bibliography', {
            format: 'html',
            template: this.style,
            lang: locale === 'pt' ? 'pt-BR' : 'en-US',
            asEntryArray: true,
          }),
        ),
      );
    }
    return [...new Set(keys)].map((key) => {
      const entry = this.entries.get(key);
      if (!entry)
        throw new Error(
          `Referência '${key}' não encontrada no arquivo BibTeX.`,
        );
      // Visible numeric labels use the stable index in the complete .bib file.
      const formatted = this.formatted
        .get(locale)!
        .get(key)!
        .replace(/<div class="csl-left-margin">[\s\S]*?<\/div>/g, '');
      return {
        key,
        id: referenceId(key),
        html: sanitizeHtml(formatted, {
          allowedTags: [
            'div',
            'span',
            'i',
            'b',
            'em',
            'strong',
            'a',
            'sup',
            'sub',
          ],
          allowedAttributes: { a: ['href'], div: ['class'], span: ['class'] },
          allowedSchemes: ['http', 'https'],
        }),
        doi: typeof entry.DOI === 'string' ? entry.DOI : undefined,
        url:
          typeof entry.URL === 'string' && /^https?:\/\//.test(entry.URL)
            ? entry.URL
            : undefined,
      };
    });
  }
}
