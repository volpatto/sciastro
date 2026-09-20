declare module '@citation-js/core' {
  export class Cite {
    constructor(data: unknown, options?: unknown);
    data: Array<Record<string, unknown>>;
    format(
      format: 'bibliography',
      options: Record<string, unknown> & { asEntryArray: true },
    ): Array<[string, string]>;
    format(format: string, options?: Record<string, unknown>): string;
  }
}
declare module '@citation-js/plugin-bibtex';
declare module '@citation-js/plugin-csl';
declare module 'virtual:scipages' {
  const site: import('./content.js').BuiltSite;
  export default site;
}
