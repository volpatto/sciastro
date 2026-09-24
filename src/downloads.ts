import { createHash } from 'node:crypto';
import MarkdownIt from 'markdown-it';

export interface DownloadSettings {
  notebook: boolean;
  pdf: boolean;
}

export interface NotebookSource {
  format: 'markdown' | 'notebook';
  content: string;
}

export interface BuiltPageDownloads {
  pdf: boolean;
  notebook?: { path: string; filename: string };
}

/** Kept on the server-side site model, never serialized into an HTML control. */
export interface BuiltNotebookDownload {
  path: string;
  filename: string;
  content: string;
}

interface NotebookCell {
  cell_type: 'markdown' | 'code';
  id: string;
  metadata: Record<string, never>;
  source: string;
  execution_count?: null;
  outputs?: never[];
}

/** Convert source, not rendered HTML, and never execute a code cell. */
export function markdownNotebook(
  source: string,
  sourcePage?: string,
  presentation?: { title?: string; description?: string; locale?: string },
): string {
  // Markdown-it line maps use normalized newlines. Keep prose slices rather
  // than serializing tokens, preserving directives, citations and other fences.
  const normalized = source.replace(/\r\n?/g, '\n');
  const lines = normalized.split(/(?<=\n)/);
  const tokens = new MarkdownIt({ html: false }).parse(normalized, {});
  const cells: NotebookCell[] = [];
  const append = (cell_type: NotebookCell['cell_type'], text: string) => {
    if (cell_type === 'markdown' && !text.trim()) return;
    const id = createHash('sha256')
      .update(`${cells.length}:${cell_type}:${text}`)
      .digest('hex')
      .slice(0, 16);
    cells.push({
      cell_type,
      id,
      metadata: {},
      source: text,
      ...(cell_type === 'code' ? { execution_count: null, outputs: [] } : {}),
    });
  };
  if (presentation?.title) {
    const heading = [`# ${presentation.title.replace(/\s+/g, ' ').trim()}`];
    if (presentation.description?.trim())
      heading.push(presentation.description.trim());
    if (sourcePage)
      heading.push(
        `[${presentation.locale === 'pt' ? 'Página de origem' : 'Source page'}](<${sourcePage}>)`,
      );
    append('markdown', `${heading.join('\n\n')}\n`);
  }
  let cursor = 0;
  for (const token of tokens) {
    if (
      token.type !== 'fence' ||
      token.level !== 0 ||
      !token.map ||
      !['python', 'python3', 'py'].includes(
        token.info.trim().split(/\s+/)[0].toLowerCase(),
      )
    )
      continue;
    append('markdown', lines.slice(cursor, token.map[0]).join(''));
    append('code', token.content);
    cursor = token.map[1];
  }
  append('markdown', lines.slice(cursor).join(''));
  return (
    JSON.stringify(
      {
        cells,
        metadata: {
          kernelspec: {
            display_name: 'Python 3',
            language: 'python',
            name: 'python3',
          },
          language_info: {
            name: 'python',
            file_extension: '.py',
            mimetype: 'text/x-python',
          },
          sciastro: {
            source_format: 'markdown',
            ...(sourcePage ? { source_page: sourcePage } : {}),
            notes: [
              'Exported from the page body without executing code.',
              'SciAstro directives, citations and page: links remain source text; they require adaptation in Jupyter.',
              'Local images, data and relative links are not bundled. Keep the required files alongside the notebook or update their paths.',
              'YAML sections outside the page body are not included.',
            ],
          },
        },
        nbformat: 4,
        nbformat_minor: 5,
      },
      null,
      2,
    ) + '\n'
  );
}

/** The caller has already rendered/validated the source with SciAstro. */
export function sourceHasContent(source: NotebookSource | undefined): boolean {
  if (!source) return false;
  if (source.format === 'markdown') return Boolean(source.content.trim());
  const notebook = JSON.parse(source.content);
  return notebook.cells.some(
    (cell: { source: string | string[]; outputs?: unknown[] }) =>
      (Array.isArray(cell.source)
        ? cell.source.join('')
        : cell.source
      ).trim() || cell.outputs?.length,
  );
}

export function articleDownloads({
  id,
  locale,
  layout,
  base,
  sourcePage,
  title,
  description,
  source,
  hasSections = false,
  defaults,
  overrides,
}: {
  id: string;
  locale: string;
  layout?: string;
  base: string;
  sourcePage: string;
  title?: string;
  description?: string;
  source?: NotebookSource;
  hasSections?: boolean;
  defaults: DownloadSettings;
  overrides?: Partial<DownloadSettings>;
}): { presentation?: BuiltPageDownloads; file?: BuiltNotebookDownload } {
  const settings = { ...defaults, ...overrides };
  if (layout !== 'article' || (!settings.notebook && !settings.pdf)) return {};
  const body = sourceHasContent(source);
  const pdf = settings.pdf && (body || hasSections);
  if (!settings.notebook || !body || !source)
    return pdf ? { presentation: { pdf } } : {};
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) ||
    !/^[a-z]{2}$/.test(locale) ||
    !/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base)
  )
    throw new Error(
      'Invalid notebook download identifier, locale or base path.',
    );
  const filename = `${id}-${locale}.ipynb`;
  const path = `${base}_sciastro/downloads/${locale}/${id}.ipynb`;
  const content =
    source.format === 'notebook'
      ? source.content
      : markdownNotebook(source.content, sourcePage, {
          title,
          description,
          locale,
        });
  return {
    presentation: { pdf, notebook: { path, filename } },
    file: { path, filename, content },
  };
}

export function notebookResponse(file: BuiltNotebookDownload): Response {
  if (!/^[a-z0-9-]+-[a-z]{2}\.ipynb$/.test(file.filename))
    throw new Error('Invalid notebook download filename.');
  return new Response(file.content, {
    headers: {
      'Content-Type': 'application/x-ipynb+json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
