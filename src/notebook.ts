import { stripVTControlCharacters } from 'node:util';
import sanitizeHtml from 'sanitize-html';
import type { DocumentContext, DocumentFigureOptions } from './document.js';

type ObjectValue = Record<string, unknown>;
type FigureOptions = DocumentFigureOptions;

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  );

function object(value: unknown): value is ObjectValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown, location: string): ObjectValue {
  if (!object(value)) throw new Error(`${location}: expected an object.`);
  return value;
}

function multiline(value: unknown, location: string): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && value.every((line) => typeof line === 'string'))
    return value.join('');
  throw new Error(`${location}: expected a string or an array of strings.`);
}

function count(value: unknown, location: string): string {
  if (value === null) return ' ';
  if (Number.isInteger(value) && (value as number) >= 0) return String(value);
  throw new Error(`${location}: execution_count must be an integer or null.`);
}

function raster(
  value: unknown,
  mime: 'image/png' | 'image/jpeg',
  location: string,
) {
  const encoded = multiline(value, location).replace(/\s/g, '');
  if (
    !encoded ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
      encoded,
    )
  )
    throw new Error(`${location}: invalid base64 image.`);
  const bytes = Buffer.from(encoded, 'base64');
  const isImage =
    mime === 'image/png'
      ? bytes
          .subarray(0, 8)
          .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (!isImage)
    throw new Error(`${location}: image bytes do not match ${mime}.`);
  return `data:${mime};base64,${encoded}`;
}

function rasterDataUri(source: string): string | undefined {
  source = source.replace(/[\u0000-\u0020\u007f]/g, '');
  const match = /^data:(image\/(?:png|jpeg));base64,([\s\S]+)$/i.exec(source);
  if (!match) return undefined;
  try {
    return raster(
      match[2],
      match[1].toLowerCase() as 'image/png' | 'image/jpeg',
      'Embedded image',
    );
  } catch {
    return undefined;
  }
}

const svgTags = [
  'svg',
  'g',
  'defs',
  'symbol',
  'use',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'text',
  'tspan',
  'title',
  'desc',
  'clipPath',
  'linearGradient',
  'radialGradient',
  'stop',
  'image',
];
const safePaint =
  /^(?:none|transparent|currentColor|#[a-fA-F0-9]{3,8}|[a-zA-Z]+|rgba?\([\d.,%\s]+\)|url\(#[a-zA-Z_][\w:.-]*\))$/;
const svgStyles = {
  fill: [safePaint],
  stroke: [safePaint],
  color: [safePaint],
  opacity: [/^[01]?(?:\.\d+)?$/],
  'fill-opacity': [/^[01]?(?:\.\d+)?$/],
  'stroke-opacity': [/^[01]?(?:\.\d+)?$/],
  'stroke-width': [/^[\d.]+(?:px|pt)?$/],
  'stroke-linecap': [/^(?:butt|round|square)$/],
  'stroke-linejoin': [/^(?:miter|round|bevel)$/],
  'stroke-dasharray': [/^[\d.,\s]+$/],
  'font-size': [/^[\d.]+(?:px|pt|em)?$/],
  'font-family': [/^[\w\s,'"-]+$/],
  'font-weight': [/^(?:normal|bold|[1-9]00)$/],
  'text-anchor': [/^(?:start|middle|end)$/],
};

/** Allow static plot geometry, never embedded HTML, scripts or external resources. */
function svg(value: unknown, location: string): string {
  let source = multiline(value, location);
  if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(source))
    throw new Error(`${location}: SVG entity declarations are not supported.`);
  // Matplotlib includes an external SVG doctype. Remove it without resolving it.
  source = source.replace(/<!DOCTYPE[^>]*>/gi, '');
  if (!/<svg(?:\s|>)/i.test(source))
    throw new Error(`${location}: invalid SVG image.`);
  const cleaned = sanitizeHtml(source, {
    allowedTags: svgTags,
    allowedAttributes: {
      '*': [
        'id',
        'x',
        'y',
        'x1',
        'y1',
        'x2',
        'y2',
        'cx',
        'cy',
        'r',
        'rx',
        'ry',
        'width',
        'height',
        'viewBox',
        'preserveAspectRatio',
        'd',
        'points',
        'transform',
        'fill',
        'fill-rule',
        'fill-opacity',
        'stroke',
        'stroke-width',
        'stroke-linecap',
        'stroke-linejoin',
        'stroke-dasharray',
        'stroke-dashoffset',
        'stroke-miterlimit',
        'stroke-opacity',
        'opacity',
        'clip-path',
        'clip-rule',
        'clipPathUnits',
        'gradientUnits',
        'gradientTransform',
        'offset',
        'stop-color',
        'stop-opacity',
        'font-family',
        'font-size',
        'font-weight',
        'font-style',
        'text-anchor',
        'dominant-baseline',
        'dx',
        'dy',
        'rotate',
        'style',
        'href',
        'xlink:href',
        'xmlns',
        'xmlns:xlink',
      ],
    },
    allowedStyles: { '*': svgStyles },
    allowedSchemesByTag: { image: ['data'] },
    nonTextTags: [
      'script',
      'style',
      'textarea',
      'option',
      'metadata',
      'foreignObject',
    ],
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    exclusiveFilter: (frame) =>
      frame.tag === 'image' &&
      !frame.attribs.href &&
      !frame.attribs['xlink:href'],
    transformTags: {
      '*': (tagName, attributes) => {
        for (const [name, value] of Object.entries(attributes)) {
          if (name === 'href' || name === 'xlink:href') {
            // Matplotlib embeds heatmaps and rasterized artists inside SVG.
            // Retain only byte-validated PNG/JPEG data, never external content.
            if (tagName === 'image') {
              const source = rasterDataUri(value);
              if (source) attributes[name] = source;
              else delete attributes[name];
            } else if (!/^#[a-zA-Z_][\w:.-]*$/.test(value))
              delete attributes[name];
          }
          if (
            ['fill', 'stroke', 'stop-color'].includes(name) &&
            !safePaint.test(value)
          )
            delete attributes[name];
          if (
            name === 'clip-path' &&
            !/^url\(#[a-zA-Z_][\w:.-]*\)$/.test(value)
          )
            delete attributes[name];
        }
        return { tagName, attribs: attributes };
      },
    },
  });
  return `data:image/svg+xml;base64,${Buffer.from(cleaned).toString('base64')}`;
}

function staticHtml(source: string): string {
  return sanitizeHtml(source, {
    allowedTags: [
      'p',
      'br',
      'hr',
      'div',
      'span',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'sub',
      'sup',
      'code',
      'pre',
      'blockquote',
      'ul',
      'ol',
      'li',
      'dl',
      'dt',
      'dd',
      'table',
      'thead',
      'tbody',
      'tfoot',
      'tr',
      'th',
      'td',
      'caption',
      'a',
      'img',
    ],
    allowedAttributes: {
      '*': ['style'],
      a: ['href', 'title'],
      img: ['src', 'alt', 'width', 'height'],
      table: ['class'],
      th: ['colspan', 'rowspan', 'scope'],
      td: ['colspan', 'rowspan'],
    },
    allowedClasses: { table: ['dataframe'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https', 'http', 'data'] },
    allowProtocolRelative: false,
    allowedStyles: {
      '*': {
        'text-align': [/^(?:left|center|right|justify)$/],
        'font-weight': [/^(?:normal|bold|[1-9]00)$/],
      },
    },
    transformTags: {
      img: (tagName, attributes) => {
        const src = attributes.src ?? '';
        if (/^data:/i.test(src.replace(/[\u0000-\u0020\u007f]/g, ''))) {
          const source = rasterDataUri(src);
          if (source) attributes.src = source;
          else delete attributes.src;
        }
        return { tagName, attribs: attributes };
      },
    },
  });
}

function figureOptions(metadata: ObjectValue, location: string): FigureOptions {
  if (metadata.sciastro === undefined) return {};
  const options = record(metadata.sciastro, `${location}.sciastro`);
  const result: FigureOptions = {};
  for (const name of ['caption', 'label'] as const) {
    if (options[name] === undefined) continue;
    if (typeof options[name] !== 'string')
      throw new Error(`${location}.sciastro.${name}: expected a string.`);
    result[name] = options[name];
  }
  if (options.numbered !== undefined) {
    if (typeof options.numbered !== 'boolean')
      throw new Error(`${location}.sciastro.numbered: expected a boolean.`);
    result.numbered = options.numbered;
  }
  if (options.align !== undefined) {
    if (!['left', 'center', 'right'].includes(String(options.align)))
      throw new Error(`${location}.sciastro.align: use left, center or right.`);
    result.align = options.align as FigureOptions['align'];
  }
  if (options.captionAlign !== undefined) {
    if (
      typeof options.captionAlign !== 'string' ||
      !['left', 'center', 'right', 'justify'].includes(options.captionAlign)
    )
      throw new Error(
        `${location}.sciastro.captionAlign: use left, center, right or justify.`,
      );
    result.captionAlign = options.captionAlign as FigureOptions['captionAlign'];
  }
  if (options.width !== undefined) {
    const width =
      typeof options.width === 'number' ? `${options.width}px` : options.width;
    if (
      typeof width !== 'string' ||
      !/^(?:(?:[1-9]\d?|100)%|(?:[1-9]\d{0,3})(?:px|rem))$/.test(width)
    )
      throw new Error(
        `${location}.sciastro.width: use pixels, rem or a percentage, for example 640 or "80%".`,
      );
    result.width = width;
  }
  return result;
}

function imageBundle(data: ObjectValue, location: string) {
  for (const mime of ['image/svg+xml', 'image/png', 'image/jpeg'] as const) {
    if (data[mime] === undefined) continue;
    return {
      mime,
      src:
        mime === 'image/svg+xml'
          ? svg(data[mime], location)
          : raster(data[mime], mime, location),
    };
  }
  return undefined;
}

/** Read saved outputs only. No kernel, notebook JavaScript or Python is executed. */
export function renderNotebook(
  source: string,
  context: DocumentContext,
  options: { showCode?: boolean; collapseCode?: boolean } = {},
): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error(
      'Notebook: invalid JSON. Save the notebook as an .ipynb file.',
    );
  }
  const notebook = record(parsed, 'Notebook');
  if (notebook.nbformat !== 4)
    throw new Error('Notebook: only Jupyter nbformat 4 is supported.');
  if (
    !Number.isInteger(notebook.nbformat_minor) ||
    (notebook.nbformat_minor as number) < 0
  )
    throw new Error('Notebook: nbformat_minor must be a non-negative integer.');
  const metadata = record(notebook.metadata, 'Notebook metadata');
  if (!Array.isArray(notebook.cells))
    throw new Error('Notebook: cells must be an array.');
  const language =
    object(metadata.language_info) &&
    typeof metadata.language_info.name === 'string'
      ? metadata.language_info.name
      : 'text';
  const pt = context.locale === 'pt';
  const labels = {
    code: pt ? 'Código' : 'Code',
    output: pt ? 'Saída' : 'Output',
    image: pt ? 'Figura do notebook' : 'Notebook figure',
    unsupported: pt
      ? 'Esta saída interativa não está disponível na versão estática. Salve uma figura ou tabela no notebook para publicá-la.'
      : 'This interactive output is not available in the static page. Save a figure or table in the notebook to publish it.',
  };
  const note = () =>
    `<p class="notebook-output-note">${labels.unsupported}</p>`;
  const pre = (value: string) =>
    `<pre><code>${escape(stripVTControlCharacters(value))}</code></pre>`;

  const cells = notebook.cells.map((value, cellIndex) => {
    const location = `Notebook cell ${cellIndex + 1}`;
    const cell = record(value, location);
    const metadata = record(cell.metadata, `${location} metadata`);
    const source = multiline(cell.source, `${location} source`);
    const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
    if (tags.includes('remove-cell')) return '';
    const jupyter = object(metadata.jupyter) ? metadata.jupyter : {};
    const sciastro = object(metadata.sciastro) ? metadata.sciastro : {};
    if (cell.cell_type === 'markdown') {
      const attachments =
        cell.attachments === undefined
          ? {}
          : record(cell.attachments, `${location} attachments`);
      const rewrite = (name: string) => {
        name = name
          .replaceAll('&amp;', '&')
          .replaceAll('&quot;', '"')
          .replaceAll('&#39;', "'");
        try {
          name = decodeURIComponent(name);
        } catch {
          /* Retain literal names. */
        }
        const bundle = record(
          attachments[name],
          `${location} attachment '${name}'`,
        );
        const image = imageBundle(bundle, `${location} attachment '${name}'`);
        if (!image)
          throw new Error(
            `${location} attachment '${name}': expected PNG, JPEG or SVG.`,
          );
        return image.src;
      };
      const html = context
        .render(source)
        .replace(
          /src="attachment:([^"]+)"/g,
          (_, name: string) => `src="${rewrite(name)}"`,
        );
      return `<div class="notebook-cell notebook-cell--markdown">${html}</div>`;
    }
    if (cell.cell_type === 'raw')
      return `<div class="notebook-cell notebook-cell--raw">${pre(source)}</div>`;
    if (cell.cell_type !== 'code')
      throw new Error(
        `${location}: unsupported cell_type '${String(cell.cell_type)}'.`,
      );
    const executionCount = count(cell.execution_count, location);
    if (!Array.isArray(cell.outputs))
      throw new Error(`${location}: outputs must be an array.`);
    let code = '';
    if (
      options.showCode !== false &&
      sciastro.showCode !== false &&
      !tags.includes('remove-input')
    ) {
      code = `<div class="notebook-code"><span class="notebook-prompt">In [${executionCount}]</span>${context.code(source, language, labels.code)}</div>`;
      if (
        sciastro.collapseCode === true ||
        (sciastro.collapseCode !== false && options.collapseCode) ||
        jupyter.source_hidden === true ||
        tags.includes('hide-input')
      )
        code = `<details class="notebook-code-collapse"><summary>${labels.code} · In [${executionCount}]</summary>${code}</details>`;
    }
    let cellCaptionUsed = false;
    const fallbackFigure = figureOptions(metadata, `${location} metadata`);
    const outputs = (tags.includes('remove-output') ? [] : cell.outputs)
      .map((value, outputIndex) => {
        const outputLocation = `${location}, output ${outputIndex + 1}`;
        const output = record(value, outputLocation);
        const wrap = (html: string, kind: string) =>
          `<div class="notebook-output notebook-output--${kind}">${html}</div>`;
        if (output.output_type === 'stream') {
          if (output.name !== 'stdout' && output.name !== 'stderr')
            throw new Error(
              `${outputLocation}: stream name must be stdout or stderr.`,
            );
          return wrap(
            pre(multiline(output.text, `${outputLocation} text`)),
            output.name === 'stderr' ? 'stderr' : 'stream',
          );
        }
        if (output.output_type === 'error') {
          if (
            typeof output.ename !== 'string' ||
            typeof output.evalue !== 'string' ||
            !Array.isArray(output.traceback) ||
            !output.traceback.every((line) => typeof line === 'string')
          )
            throw new Error(
              `${outputLocation}: error outputs require ename, evalue and a traceback array of strings.`,
            );
          const traceback = output.traceback.length
            ? output.traceback.join('\n')
            : `${output.ename}: ${output.evalue}`;
          return wrap(pre(traceback), 'error');
        }
        if (
          output.output_type !== 'display_data' &&
          output.output_type !== 'execute_result'
        )
          throw new Error(
            `${outputLocation}: unsupported output_type '${String(output.output_type)}'.`,
          );
        const data = record(output.data, `${outputLocation} data`);
        const outputMetadata =
          output.metadata === undefined
            ? {}
            : record(output.metadata, `${outputLocation} metadata`);
        const prompt =
          output.output_type === 'execute_result'
            ? `<span class="notebook-prompt">Out [${count(output.execution_count, outputLocation)}]</span>`
            : '';
        const unsupported = Object.keys(data).some((mime) =>
          /javascript|widget|plotly|vega|bokeh/i.test(mime),
        );
        const image = imageBundle(data, outputLocation);
        if (image) {
          const figure = {
            ...(!cellCaptionUsed ? fallbackFigure : {}),
            ...figureOptions(outputMetadata, `${outputLocation} metadata`),
          };
          cellCaptionUsed = true;
          const imageMeta = outputMetadata[image.mime];
          if (
            !figure.width &&
            object(imageMeta) &&
            typeof imageMeta.width === 'number' &&
            Number.isFinite(imageMeta.width) &&
            imageMeta.width > 0
          )
            figure.width = `${Math.min(9999, Math.max(1, Math.round(imageMeta.width)))}px`;
          return wrap(
            prompt +
              context.figure(
                `<img src="${image.src}" alt="${escape(figure.caption ?? labels.image)}" loading="lazy" />`,
                figure,
              ),
            'image',
          );
        }
        if (unsupported)
          return wrap(
            note() +
              (data['text/plain'] !== undefined
                ? pre(multiline(data['text/plain'], outputLocation))
                : ''),
            'text',
          );
        if (data['text/html'] !== undefined) {
          const html = staticHtml(multiline(data['text/html'], outputLocation));
          if (
            html.replace(/<[^>]*>/g, '').trim() ||
            /<img[^>]*\ssrc=/i.test(html)
          )
            return wrap(prompt + html, 'html');
          return wrap(
            note() +
              (data['text/plain'] !== undefined
                ? pre(multiline(data['text/plain'], outputLocation))
                : ''),
            'text',
          );
        }
        if (data['text/latex'] !== undefined) {
          const latex = multiline(data['text/latex'], outputLocation);
          const delimited =
            /^\s*(?:\$|\\\[|\\\(|\\begin\{(?:equation\*?|align\*?|gather\*?|multline\*?|eqnarray\*?)\})/.test(
              latex,
            )
              ? latex
              : `$$\n${latex}\n$$`;
          return wrap(prompt + context.render(delimited), 'latex');
        }
        if (data['application/json'] !== undefined)
          return wrap(
            prompt +
              context.code(
                JSON.stringify(data['application/json'], null, 2),
                'json',
                'JSON',
              ),
            'json',
          );
        if (data['text/plain'] !== undefined)
          return wrap(
            prompt + pre(multiline(data['text/plain'], outputLocation)),
            'text',
          );
        return wrap(note(), 'text');
      })
      .join('');
    let visibleOutputs = tags.includes('remove-output') ? '' : outputs;
    if (
      visibleOutputs &&
      (metadata.collapsed === true ||
        jupyter.outputs_hidden === true ||
        tags.includes('hide-output'))
    )
      visibleOutputs = `<details class="notebook-output-collapse"><summary>${labels.output}</summary>${visibleOutputs}</details>`;
    return code || visibleOutputs
      ? `<div class="notebook-cell notebook-cell--code">${code}${visibleOutputs}</div>`
      : '';
  });
  return `<div class="notebook">${cells.join('\n')}</div>`;
}
