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
declare module 'virtual:sciastro' {
  const site: import('./content.js').BuiltSite;
  export default site;
}

declare module 'virtual:sciastro/components' {
  import type { AstroComponentFactory } from 'astro/runtime/server/index.js';
  export const Layout: AstroComponentFactory;
  export const sections: Record<string, AstroComponentFactory>;
}
