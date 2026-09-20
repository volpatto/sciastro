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
