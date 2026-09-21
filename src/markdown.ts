import MarkdownIt from 'markdown-it';
import { Bibliography } from './bibliography.js';
import type { Locale } from './schema.js';

/** One context per page keeps repeated citations and the bibliography in sync. */
export function markdownContext(
  bibliography: Bibliography,
  locale: Locale,
  base = '/',
) {
  const cited = new Set<string>();
  const md = new MarkdownIt({ html: false, linkify: true });
  md.inline.ruler.before('link', 'sciastro-citation', (state, silent) => {
    if (state.src.slice(state.pos, state.pos + 2) !== '[@') return false;
    const end = state.src.indexOf(']', state.pos);
    if (end === -1) return false;
    const raw = state.src.slice(state.pos + 1, end);
    const keys = raw.split(';').map((part) => part.trim());
    if (!keys.every((key) => /^@[^\s;\[\]]+$/.test(key)))
      throw new Error(
        `Citação inválida: [${raw}]. Use [@chave] ou [@chave1; @chave2].`,
      );
    if (!silent) {
      const ids = keys.map((key) => key.slice(1));
      ids.forEach((key) => {
        if (!bibliography.has(key))
          throw new Error(
            `Referência '${key}' não encontrada no arquivo BibTeX.`,
          );
        cited.add(key);
      });
      const token = state.push('sciastro-citation', '', 0);
      token.meta = { keys: ids };
    }
    state.pos = end + 1;
    return true;
  });
  md.renderer.rules['sciastro-citation'] = (tokens, index) =>
    bibliography.citation(tokens[index].meta!.keys as string[], locale);
  const linkRule =
    md.renderer.rules.link_open ??
    ((tokens, index, options, _env, self) =>
      self.renderToken(tokens, index, options));
  md.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const href = tokens[index].attrGet('href');
    if (
      typeof href === 'string' &&
      href.startsWith('/') &&
      !href.startsWith('//')
    )
      tokens[index].attrSet('href', `${base}${href.slice(1)}`);
    return linkRule(tokens, index, options, env, self);
  };
  const imageRule = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, index, options, env, self) => {
    const src = tokens[index].attrGet('src');
    if (typeof src === 'string' && src.startsWith('/') && !src.startsWith('//'))
      tokens[index].attrSet('src', `${base}${src.slice(1)}`);
    return imageRule(tokens, index, options, env, self);
  };
  return {
    render: (source: string) => md.render(source),
    references: () => bibliography.references([...cited], locale),
  };
}
