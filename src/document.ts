import { createHighlighter, bundledLanguages } from 'shiki';
import { mathjax } from '@mathjax/src/js/mathjax.js';
import { TeX } from '@mathjax/src/js/input/tex.js';
import { SVG } from '@mathjax/src/js/output/svg.js';
import { liteAdaptor } from '@mathjax/src/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from '@mathjax/src/js/handlers/html.js';
import { AssistiveMmlHandler } from '@mathjax/src/js/a11y/assistive-mml.js';
import type { LiteElement } from '@mathjax/src/js/adaptors/lite/Element.js';
import type { LiteText } from '@mathjax/src/js/adaptors/lite/Text.js';
import type { LiteDocument } from '@mathjax/src/js/adaptors/lite/Document.js';
import '@mathjax/src/js/util/asyncLoad/esm.js';
import '@mathjax/src/js/input/tex/base/BaseConfiguration.js';
import '@mathjax/src/js/input/tex/ams/AmsConfiguration.js';
import '@mathjax/src/js/input/tex/newcommand/NewcommandConfiguration.js';
import '@mathjax/src/js/input/tex/boldsymbol/BoldsymbolConfiguration.js';
import type { Bibliography, Reference } from './bibliography.js';
import type { CaptionAlignment, Locale } from './schema.js';
import { markdownContext } from './markdown.js';

export interface DocumentHeading {
  id: string;
  text: string;
  depth: number;
}
export interface DocumentFigureOptions {
  caption?: string;
  label?: string;
  numbered?: boolean;
  align?: 'left' | 'center' | 'right';
  /** Text alignment of the caption; independent of the figure's placement. */
  captionAlign?: CaptionAlignment;
  width?: string;
}
export interface DocumentOptions {
  /** IDs already used by the page layout, composed sections or bibliography. */
  reservedIds?: string[];
  /** Resolve page:id#anchor links using the site's locale and base path. */
  resolveLink?: (target: string) => string;
}
export interface DocumentContext {
  readonly locale: Locale;
  render(source: string): string;
  code(source: string, language?: string, title?: string): string;
  /** bodyHtml is trusted renderer output, never raw author HTML. */
  figure(bodyHtml: string, options: DocumentFigureOptions): string;
  finish(html: string): { html: string; headings: DocumentHeading[] };
  references(): Reference[];
}

const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const slug = (text: string) =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_-]+/gu, '-')
    .replace(/^-+|-+$/g, '') || 'section';
const labelPattern = /^[A-Za-z][A-Za-z0-9:._-]*$/;
const adaptor = liteAdaptor();
AssistiveMmlHandler(RegisterHTMLHandler(adaptor));

// Fonts and grammars are loaded only on the build machine, once per process.
let resources:
  Promise<Awaited<ReturnType<typeof createHighlighter>>> | undefined;
function loadResources() {
  return (resources ??= (async () => {
    const highlighter = await createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: Object.keys(bundledLanguages),
    });
    return highlighter;
  })());
}

/** Parse a deliberately small attribute language, never arbitrary HTML or CSS. */
function attributes(
  source: string,
  allowed: string[],
  bareTitle = false,
): Record<string, string> {
  const value = source.trim();
  if (!value) return {};
  if (bareTitle && !/^[a-z][a-z-]*\s*=/.test(value))
    return { title: value.replace(/^(["'])(.*)\1$/, '$2') };
  const result: Record<string, string> = {};
  let rest = value;
  while (rest) {
    const match =
      /^([a-z][a-z-]*)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\s]+))(?:\s+|$)/.exec(
        rest,
      );
    if (!match)
      throw new Error(
        `Invalid document attributes: ${rest}. Use name="value".`,
      );
    const key = match[1];
    if (!allowed.includes(key))
      throw new Error(
        `Unsupported document attribute '${key}'. Allowed: ${allowed.join(', ')}.`,
      );
    if (key in result) throw new Error(`Repeated document attribute '${key}'.`);
    result[key] = (match[2] ?? match[3] ?? match[4]).replace(
      /\\(["'\\])/g,
      '$1',
    );
    rest = rest.slice(match[0].length).trimStart();
  }
  return result;
}
function figureOptions(values: Record<string, string>): DocumentFigureOptions {
  if (
    values.numbered !== undefined &&
    !['true', 'false'].includes(values.numbered)
  )
    throw new Error('Figure/table numbered must be true or false.');
  const { 'caption-align': captionAlign, ...rest } = values;
  return {
    ...rest,
    captionAlign,
    numbered:
      values.numbered === undefined ? undefined : values.numbered === 'true',
  } as DocumentFigureOptions;
}
function validateFigure(options: DocumentFigureOptions) {
  if (options.label && !labelPattern.test(options.label))
    throw new Error(
      `Invalid figure/table label '${options.label}'. Use letters, numbers, colon, dot, hyphen or underscore.`,
    );
  if (options.align && !['left', 'center', 'right'].includes(options.align))
    throw new Error(`Invalid figure alignment '${options.align}'.`);
  if (
    options.captionAlign !== undefined &&
    !['left', 'center', 'right', 'justify'].includes(options.captionAlign)
  )
    throw new Error(
      `Invalid caption alignment '${options.captionAlign}'. Use left, center, right or justify.`,
    );
  if (
    options.width &&
    !/^(?:(?:[1-9]\d?|100)%|(?:[1-9]\d{0,3})(?:px|rem))$/.test(options.width)
  )
    throw new Error(
      `Invalid figure width '${options.width}'. Use 1–100% or a positive px/rem value.`,
    );
}

/** One isolated context owns all numbering, citations and headings of a page. */
export async function createDocumentContext(
  bibliography: Bibliography,
  locale: Locale,
  base = '/',
  options: DocumentOptions = {},
): Promise<DocumentContext> {
  const highlighter = await loadResources();
  // Each output jax owns its styles; sharing it would accumulate styles across pages.
  const svg = new SVG<LiteElement, LiteText, LiteDocument>({
    fontCache: 'none',
  });
  await svg.font.loadDynamicFiles();
  const shared = markdownContext(
    bibliography,
    locale,
    base,
    options.resolveLink,
  );
  const md = shared.markdown;
  const headings: DocumentHeading[] = [];
  const identifiers = new Set<string>([
    'main',
    'references',
    ...(options.reservedIds ?? []),
  ]);
  const refs = new Map<string, { id: string; text: string }>();
  const pendingRefs = new Map<string, string>();
  const mathSources: string[] = [];
  const counters = { figure: 0, table: 0 };
  let finished = false;
  const translated =
    locale === 'pt'
      ? {
          figure: 'Figura',
          table: 'Tabela',
          copy: 'Copiar',
          copied: 'Copiado',
          copyLabel: 'Copiar código',
          copyError: 'Não foi possível copiar',
          anchor: 'Link para esta seção',
          note: 'Nota',
          tip: 'Dica',
          warning: 'Atenção',
          danger: 'Alerta',
          details: 'Detalhes',
        }
      : {
          figure: 'Figure',
          table: 'Table',
          copy: 'Copy',
          copied: 'Copied',
          copyLabel: 'Copy code',
          copyError: 'Unable to copy',
          anchor: 'Link to this section',
          note: 'Note',
          tip: 'Tip',
          warning: 'Warning',
          danger: 'Alert',
          details: 'Details',
        };
  const ensureOpen = () => {
    if (finished)
      throw new Error(
        'This document context is already finished. Create one context per page.',
      );
  };
  const identifier = (desired: string, exact = false) => {
    let value = desired;
    if (exact && identifiers.has(value))
      throw new Error(`Repeated document label or heading id '${value}'.`);
    for (let i = 2; identifiers.has(value); i++) value = `${desired}-${i}`;
    identifiers.add(value);
    return value;
  };
  const media = (
    kind: 'figure' | 'table',
    body: string,
    options: DocumentFigureOptions,
  ) => {
    ensureOpen();
    validateFigure(options);
    const numbered = Boolean(options.caption) && options.numbered !== false;
    const number = numbered ? ++counters[kind] : undefined;
    const id = identifier(
      options.label ?? `${kind}-${number ?? counters[kind] + 1}`,
      Boolean(options.label),
    );
    const referenceText = number
      ? `${translated[kind]} ${number}`
      : (options.caption ?? translated[kind]);
    if (options.label) {
      if (refs.has(options.label))
        throw new Error(`Repeated document label '${options.label}'.`);
      refs.set(options.label, { id, text: referenceText });
    }
    const captionStyle = options.captionAlign
      ? ` style="text-align:${options.captionAlign}"`
      : '';
    const caption = options.caption
      ? `<figcaption${captionStyle}>${number ? `<span class="document-caption-number">${translated[kind]} ${number}.</span> ` : ''}${md.renderInline(options.caption)}</figcaption>`
      : '';
    const width = options.width
      ? ` style="--document-figure-width:${escape(options.width)}"`
      : '';
    return `<figure id="${escape(id)}" class="document-${kind} document-align-${options.align ?? 'center'}"${width}>${body}${caption}</figure>\n`;
  };
  const code = (source: string, language = 'text', title?: string) => {
    ensureOpen();
    const requested = language.toLowerCase();
    const lang = highlighter.getLoadedLanguages().includes(requested)
      ? requested
      : 'text';
    const highlighted = highlighter.codeToHtml(source, {
      lang,
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: 'light',
    });
    return `<div class="document-code"><div class="document-code-header"><span>${escape(title || language || 'text')}</span><button type="button" class="document-code-copy" hidden data-copy-code data-copy-label="${translated.copy}" data-copied-label="${translated.copied}" data-copy-error-label="${translated.copyError}" aria-label="${translated.copyLabel}" aria-live="polite">${translated.copy}</button></div>${highlighted}</div>\n`;
  };
  md.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index];
    const info = token.info.trim();
    const match = /^(\S+)?(?:\s+([\s\S]*))?$/.exec(info);
    const language = match?.[1] ?? 'text';
    const values = attributes(match?.[2] ?? '', ['filename', 'title']);
    return code(token.content, language, values.filename ?? values.title);
  };
  md.renderer.rules.code_block = (tokens, index) => code(tokens[index].content);
  md.renderer.rules.table_open = () =>
    '<div class="document-table-scroll" tabindex="0" role="region" aria-label="' +
    translated.table +
    '"><table>\n';
  md.renderer.rules.table_close = () => '</table></div>\n';
  md.renderer.rules.heading_open = (tokens, index) => {
    const inline = tokens[index + 1];
    let text = (inline.children ?? [])
      .map((child) =>
        child.type === 'image'
          ? child.content
          : child.type === 'softbreak'
            ? ' '
            : child.content,
      )
      .join('');
    const explicit = /\s*\{#([A-Za-z][A-Za-z0-9:._-]*)\}\s*$/.exec(text);
    if (explicit) {
      text = text.slice(0, explicit.index);
      const last = inline.children?.at(-1);
      if (last?.type === 'text')
        last.content = last.content.replace(/\s*\{#[^}]+\}\s*$/, '');
    }
    const id = identifier(explicit?.[1] ?? slug(text), Boolean(explicit));
    headings.push({ id, text, depth: Number(tokens[index].tag.slice(1)) });
    return `<${tokens[index].tag} id="${escape(id)}" class="document-heading"><a class="document-heading-anchor" href="#${escape(id)}" aria-label="${translated.anchor}: ${escape(text)}">#</a>`;
  };

  // Parse math before Markdown escapes/emphasis can alter the original TeX.
  md.inline.ruler.before('escape', 'document-math', (state, silent) => {
    const source = state.src.slice(state.pos);
    const reference = /^\\(?:eqref|ref)\{[A-Za-z][A-Za-z0-9:._-]*\}/.exec(
      source,
    );
    let content: string | undefined;
    let consumed = 0;
    if (reference) {
      content = reference[0];
      consumed = content.length;
    } else {
      const opener = source.startsWith('\\(')
        ? '\\('
        : source.startsWith('$') && !source.startsWith('$$')
          ? '$'
          : undefined;
      if (!opener) return false;
      if (opener === '$' && /\s/.test(source[1] ?? ' ')) return false;
      const closer = opener === '$' ? '$' : '\\)';
      let end = opener.length;
      while ((end = source.indexOf(closer, end)) !== -1) {
        let backslashes = 0;
        for (let i = end - 1; i >= 0 && source[i] === '\\'; i--) backslashes++;
        if (backslashes % 2 === 0) break;
        end += closer.length;
      }
      if (end === -1 || (opener === '$' && /\s/.test(source[end - 1] ?? ' ')))
        return false;
      content = source.slice(opener.length, end);
      consumed = end + closer.length;
    }
    if (!silent) {
      const token = state.push('document-math', '', 0);
      token.content = content;
      mathSources.push(content);
    }
    state.pos += consumed;
    return true;
  });
  md.renderer.rules['document-math'] = (tokens, index) =>
    `<span class="document-math">\\(${escape(tokens[index].content)}\\)</span>`;
  md.block.ruler.before(
    'fence',
    'document-math-block',
    (state, startLine, endLine, silent) => {
      const start = state.bMarks[startLine] + state.tShift[startLine];
      const first = state.src.slice(start, state.eMarks[startLine]);
      const environment =
        /^\\begin\{(equation\*?|align\*?|gather\*?|multline\*?|eqnarray\*?)\}/.exec(
          first,
        );
      const opener = first.startsWith('$$')
        ? '$$'
        : first.startsWith('\\[')
          ? '\\['
          : undefined;
      if (!opener && !environment) return false;
      if (silent) return true;
      const closer = environment
        ? `\\end{${environment[1]}}`
        : opener === '$$'
          ? '$$'
          : '\\]';
      const searchStart = start + (opener?.length ?? environment![0].length);
      const close = state.src.indexOf(closer, searchStart);
      if (close === -1)
        throw new Error(
          `Unclosed LaTeX block beginning on line ${startLine + 1}. Expected ${closer}.`,
        );
      const end = close + closer.length;
      let nextLine = startLine;
      while (nextLine < endLine && state.eMarks[nextLine] < end) nextLine++;
      if (
        nextLine >= endLine ||
        state.src.slice(end, state.eMarks[nextLine]).trim()
      )
        return false;
      const token = state.push('document-math-block', '', 0);
      token.block = true;
      token.content = environment
        ? state.src.slice(start, end)
        : state.src.slice(start + opener!.length, close);
      mathSources.push(token.content);
      state.line = nextLine + 1;
      return true;
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
  );
  md.renderer.rules['document-math-block'] = (tokens, index) =>
    `<div class="document-math document-math-block" tabindex="0" role="region" aria-label="${locale === 'pt' ? 'Equação' : 'Equation'}">\\[${escape(tokens[index].content)}\\]</div>\n`;

  md.inline.ruler.before('text', 'document-reference', (state, silent) => {
    const match = /^@ref\(([A-Za-z][A-Za-z0-9:._-]*)\)/.exec(
      state.src.slice(state.pos),
    );
    if (!match) return false;
    if (!silent) {
      const token = state.push('document-reference', '', 0);
      token.content = match[1];
    }
    state.pos += match[0].length;
    return true;
  });
  md.renderer.rules['document-reference'] = (tokens, index) => {
    const marker = `<!--sciastro-document-reference-${pendingRefs.size}-->`;
    pendingRefs.set(marker, tokens[index].content);
    return marker;
  };

  const kinds = 'note|tip|warning|danger|details|card|cards|figure|table';
  const opening = new RegExp(`^(:{3,})\\s*(${kinds})(?:\\s+(.*))?$`);
  md.block.ruler.before(
    'fence',
    'document-container',
    (state, startLine, endLine, silent) => {
      const lineAt = (i: number) =>
        state.src.slice(state.bMarks[i] + state.tShift[i], state.eMarks[i]);
      const match = opening.exec(lineAt(startLine));
      if (!match) return false;
      if (silent) return true;
      let depth = 1,
        close = startLine + 1;
      let codeFence: { char: string; length: number } | undefined;
      for (; close < endLine; close++) {
        const line = lineAt(close);
        const fence = /^(`{3,}|~{3,})/.exec(line);
        if (fence) {
          if (!codeFence)
            codeFence = { char: fence[1][0], length: fence[1].length };
          else if (
            fence[1][0] === codeFence.char &&
            fence[1].length >= codeFence.length &&
            /^(`+|~+)\s*$/.test(line)
          )
            codeFence = undefined;
          continue;
        }
        if (codeFence) continue;
        if (opening.test(line)) depth++;
        else if (/^:{3,}\s*$/.test(line) && --depth === 0) break;
      }
      if (close >= endLine)
        throw new Error(
          `Unclosed '${match[2]}' directive on line ${startLine + 1}. Add a closing ::: line.`,
        );
      const token = state.push('document-container', '', 0);
      token.block = true;
      token.meta = {
        kind: match[2],
        attributes: attributes(
          match[3] ?? '',
          match[2] === 'figure' || match[2] === 'table'
            ? [
                'caption',
                'label',
                'width',
                'align',
                'caption-align',
                'numbered',
              ]
            : ['title'],
          !['figure', 'table', 'cards'].includes(match[2]),
        ),
      };
      token.content = state.getLines(
        startLine + 1,
        close,
        state.blkIndent,
        false,
      );
      token.children = [];
      md.block.parse(token.content, md, state.env, token.children);
      // Inline tokens from the nested parse are processed by markdown-it's core inline rule.
      state.line = close + 1;
      return true;
    },
    { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
  );
  md.core.ruler.before('inline', 'document-container-inline', (state) => {
    const parseChildren = (tokens: typeof state.tokens) => {
      for (const token of tokens)
        if (token.type === 'document-container' && token.children) {
          for (const child of token.children)
            if (child.type === 'inline') {
              child.children = [];
              md.inline.parse(child.content, md, state.env, child.children);
            }
          parseChildren(token.children);
        }
    };
    parseChildren(state.tokens);
  });
  md.renderer.rules['document-container'] = (tokens, index, options, env) => {
    const token = tokens[index];
    const { kind, attributes: values } = token.meta as {
      kind: string;
      attributes: Record<string, string>;
    };
    const body = md.renderer.render(token.children ?? [], options, env);
    if (kind === 'figure' || kind === 'table')
      return media(kind, body, figureOptions(values));
    const title = values.title ?? translated[kind as keyof typeof translated];
    if (kind === 'cards') return `<div class="document-cards">${body}</div>\n`;
    if (kind === 'details')
      return `<details class="document-details"><summary>${md.renderInline(title)}</summary><div>${body}</div></details>\n`;
    if (kind === 'card')
      return `<section class="document-card">${title ? `<h3>${md.renderInline(title)}</h3>` : ''}${body}</section>\n`;
    return `<aside class="document-callout document-callout-${kind}"><p class="document-callout-title">${md.renderInline(title)}</p>${body}</aside>\n`;
  };

  return {
    locale,
    render(source) {
      ensureOpen();
      return md.render(source);
    },
    code,
    figure: (body, options) => media('figure', body, options),
    references: shared.references,
    finish(html) {
      ensureOpen();
      finished = true;
      for (const [marker, key] of pendingRefs) {
        const target = refs.get(key);
        if (!target)
          throw new Error(
            `Unknown figure/table reference '${key}'. Add a matching label="${key}".`,
          );
        html = html.replaceAll(
          marker,
          `<a class="document-reference" href="#${escape(target.id)}">${escape(target.text)}</a>`,
        );
      }
      if (mathSources.length) {
        const labels = new Set<string>();
        for (const source of mathSources)
          for (const match of source.matchAll(/\\label\{([^}]+)\}/g)) {
            if (!labelPattern.test(match[1]))
              throw new Error(`Invalid equation label '${match[1]}'.`);
            if (labels.has(match[1]))
              throw new Error(`Repeated equation label '${match[1]}'.`);
            labels.add(match[1]);
          }
        for (const source of mathSources)
          for (const match of source.matchAll(/\\(?:eqref|ref)\{([^}]+)\}/g)) {
            if (!labels.has(match[1]))
              throw new Error(`Unknown equation reference '${match[1]}'.`);
          }
        const tex = new TeX({
          packages: ['base', 'ams', 'newcommand', 'boldsymbol'],
          tags: 'ams',
          inlineMath: [['\\(', '\\)']],
          displayMath: [['\\[', '\\]']],
          processEnvironments: false,
          formatError(_jax: unknown, error: { message: string }) {
            throw new Error(`Invalid LaTeX: ${error.message}`);
          },
        });
        const document = mathjax.document(html, {
          InputJax: tex,
          OutputJax: svg,
          compileError(_document: unknown, _math: unknown, error: Error) {
            throw error;
          },
          typesetError(_document: unknown, _math: unknown, error: Error) {
            throw error;
          },
        });
        document.render();
        html = adaptor.innerHTML(adaptor.body(document.document));
        // Inline SVG embeds every glyph; there are no external fonts or browser math scripts.
        const style = adaptor.cssText(svg.styleSheet(document));
        html = `<style>${style}</style>${html}`;
      }
      return { html, headings: [...headings] };
    },
  };
}
