import type { Locale } from './schema.js';

type ObjectValue = Record<string, unknown>;
export interface PlotSpec {
  data: ObjectValue[];
  layout?: ObjectValue;
  frames?: ObjectValue[];
  config?: ObjectValue;
}

const object = (value: unknown): value is ObjectValue =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const traceTypes = new Set([
  'scatter',
  'scattergl',
  'scatter3d',
  'bar',
  'box',
  'violin',
  'histogram',
  'histogram2d',
  'histogram2dcontour',
  'heatmap',
  'contour',
  'surface',
  'mesh3d',
  'cone',
  'streamtube',
  'volume',
  'isosurface',
  'pie',
  'sunburst',
  'treemap',
  'icicle',
  'sankey',
  'funnel',
  'funnelarea',
  'waterfall',
  'indicator',
  'table',
  'scatterpolar',
  'scatterpolargl',
  'barpolar',
  'scatterternary',
  'carpet',
  'scattercarpet',
  'contourcarpet',
  'parcoords',
  'parcats',
  'splom',
  'ohlc',
  'candlestick',
  'image',
]);
const mapTypes = new Set([
  'scattergeo',
  'choropleth',
  'scattermap',
  'scattermapbox',
  'choroplethmap',
  'choroplethmapbox',
  'densitymap',
  'densitymapbox',
]);
const base64 =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
const binaryWidths: Record<string, number> = {
  i1: 1,
  u1: 1,
  i2: 2,
  u2: 2,
  i4: 4,
  u4: 4,
  f4: 4,
  f8: 8,
};
function fail(location: string, message: string): never {
  throw new Error(`Plotly ${location}: ${message}`);
}

function rasterSource(value: string): boolean {
  const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(value);
  if (!match || !base64.test(match[2])) return false;
  const bytes = Buffer.from(match[2], 'base64');
  return match[1] === 'png'
    ? bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
}

/** Validate declarative, self-contained figure JSON; never accept executable HTML. */
export function validatePlotSpec(input: unknown): PlotSpec {
  if (!object(input)) fail('figure', 'expected an object.');
  let value = input;
  if (object(input.config) && Object.hasOwn(input.config, 'plotlyServerURL')) {
    // Plotly.py 5/6 adds this legacy Chart Studio URL to saved MIME output even
    // when no remote service is used. Discard it, never forward it to the browser,
    // and leave the original notebook/spec intact for faithful downloads.
    const { plotlyServerURL: _legacyServer, ...config } = input.config;
    value = { ...input, config };
  }
  for (const key of Object.keys(value))
    if (!['data', 'layout', 'frames', 'config'].includes(key))
      fail('figure', `unsupported field '${key}'.`);
  if (!Array.isArray(value.data)) fail('data', 'expected an array of traces.');
  if (value.layout !== undefined && !object(value.layout))
    fail('layout', 'expected an object.');
  if (value.config !== undefined && !object(value.config))
    fail('config', 'expected an object.');
  if (value.frames !== undefined && !Array.isArray(value.frames))
    fail('frames', 'expected an array.');
  const traces = (data: unknown, location: string) => {
    if (!Array.isArray(data)) fail(location, 'expected an array of traces.');
    for (const [i, trace] of data.entries()) {
      if (!object(trace)) fail(`${location}[${i}]`, 'expected a trace object.');
      if (trace.type !== undefined && !traceTypes.has(String(trace.type)))
        fail(
          `${location}[${i}]`,
          `unsupported trace type '${String(trace.type)}'; use a self-contained non-map figure.`,
        );
    }
  };
  traces(value.data, 'data');
  for (const [i, frame] of ((value.frames ?? []) as unknown[]).entries()) {
    if (!object(frame)) fail(`frames[${i}]`, 'expected a frame object.');
    if (frame.data !== undefined) traces(frame.data, `frames[${i}].data`);
  }
  const config = value.config as ObjectValue | undefined;
  if (config) {
    const booleans = [
      'responsive',
      'displaylogo',
      'scrollZoom',
      'staticPlot',
      'editable',
      'showTips',
      'showAxisDragHandles',
      'showAxisRangeEntry',
      'autosizable',
      'fillFrame',
    ];
    for (const [key, entry] of Object.entries(config)) {
      if (booleans.includes(key)) {
        if (typeof entry !== 'boolean')
          fail(`config.${key}`, 'expected a boolean.');
      } else if (key === 'displayModeBar') {
        if (![true, false, 'hover'].includes(entry as boolean | string))
          fail(`config.${key}`, 'use true, false or hover.');
      } else if (key === 'toImageButtonOptions') {
        if (!object(entry)) fail(`config.${key}`, 'expected an object.');
        for (const [option, setting] of Object.entries(entry)) {
          if (
            option === 'format' &&
            ['png', 'jpeg', 'webp', 'svg'].includes(String(setting))
          )
            continue;
          if (
            option === 'filename' &&
            typeof setting === 'string' &&
            /^[\w -]{1,100}$/.test(setting)
          )
            continue;
          if (
            ['width', 'height', 'scale'].includes(option) &&
            typeof setting === 'number' &&
            Number.isFinite(setting) &&
            setting > 0 &&
            setting <= 10000
          )
            continue;
          fail(`config.${key}.${option}`, 'unsupported image export option.');
        }
      } else
        fail(
          `config.${key}`,
          'unsupported configuration; external services and custom modebar actions are not allowed.',
        );
    }
  }
  const visit = (
    entry: unknown,
    location: string,
    depth: number,
    inTemplate = false,
  ): void => {
    if (depth > 64) fail(location, 'JSON nesting is too deep.');
    if (entry === null || typeof entry === 'boolean') return;
    if (typeof entry === 'number') {
      if (!Number.isFinite(entry))
        fail(location, 'numbers must be finite or null.');
      return;
    }
    if (typeof entry === 'string') {
      if (
        /javascript\s*:|vbscript\s*:|<\s*(?:script|iframe|object|embed|style)\b/i.test(
          entry,
        )
      )
        fail(location, 'executable HTML and script URLs are not supported.');
      // Plotly supports a small set of text formatting tags. Attributes (including
      // links and inline CSS) are deliberately excluded from saved chart text.
      for (const tag of entry.matchAll(/<\/?[A-Za-z][^>]*>/g))
        if (
          !/^<\/?(?:b|i|em|strong|s|sub|sup|br|extra)\s*\/?\s*>$/i.test(tag[0])
        )
          fail(
            location,
            'only simple text formatting tags without attributes are supported.',
          );
      return;
    }
    if (Array.isArray(entry)) {
      for (const [i, child] of entry.entries())
        visit(child, `${location}[${i}]`, depth + 1, inTemplate);
      return;
    }
    if (!object(entry)) fail(location, 'expected JSON values only.');
    if ('bdata' in entry || 'dtype' in entry) {
      const width =
        typeof entry.dtype === 'string' ? binaryWidths[entry.dtype] : undefined;
      if (
        !width ||
        typeof entry.bdata !== 'string' ||
        !base64.test(entry.bdata)
      )
        fail(location, 'invalid Python typed array dtype or base64 data.');
      const length = Buffer.from(entry.bdata, 'base64').length;
      if (length % width)
        fail(location, 'typed array byte length does not match dtype.');
      if (entry.shape !== undefined) {
        if (
          typeof entry.shape !== 'string' ||
          !/^\d+(?:\s*,\s*\d+)*$/.test(entry.shape)
        )
          fail(
            location,
            'typed array shape must be comma-separated dimensions.',
          );
        const count = entry.shape
          .split(',')
          .reduce((total, n) => total * Number(n), 1);
        if (!Number.isSafeInteger(count) || count !== length / width)
          fail(location, 'typed array shape does not match its data.');
      }
      for (const key of Object.keys(entry))
        if (!['bdata', 'dtype', 'shape'].includes(key))
          fail(location, 'unexpected typed array property.');
      return;
    }
    for (const [key, child] of Object.entries(entry)) {
      const path = `${location}.${key}`;
      if (
        !inTemplate &&
        /(?:^|[.\[])(?:geo|map|mapbox)\d*(?:$|[.\[])/i.test(key)
      )
        fail(
          path,
          'active geographic layouts require external resources and are not supported.',
        );
      if (['__proto__', 'constructor', 'prototype'].includes(key))
        fail(path, 'unsafe object key.');
      if (/src$|url$|href$|accesstoken|^stream$|^transforms$/i.test(key))
        fail(path, 'external resources and transforms are not supported.');
      if (key === 'source' && typeof child === 'string' && !rasterSource(child))
        fail(path, 'images must contain embedded PNG/JPEG data, not URLs.');
      if (key === 'method' && !['animate', 'skip'].includes(String(child)))
        fail(path, 'only animation controls using saved frames are supported.');
      if (
        !inTemplate &&
        key === 'type' &&
        typeof child === 'string' &&
        mapTypes.has(child.toLowerCase())
      )
        fail(
          path,
          'map traces require external resources and are not supported.',
        );
      visit(child, path, depth + 1, inTemplate || key === 'template');
    }
  };
  visit(value, 'figure', 0);
  return value as unknown as PlotSpec;
}

export function parsePlotSpec(source: string): PlotSpec {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    fail('figure', 'invalid JSON. Export the figure with fig.write_json().');
  }
  return validatePlotSpec(parsed);
}

const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        character
      ]!,
  );

/** The optional fallback is already sanitized renderer HTML (never notebook HTML). */
export function plotMarkup(
  value: unknown,
  locale: Locale,
  fallback = '',
  caption?: string,
): string {
  const spec = validatePlotSpec(value);
  const json = JSON.stringify(spec).replace(
    /[<>&\u2028\u2029]/g,
    (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
  );
  const label =
    caption ?? (locale === 'pt' ? 'Gráfico interativo' : 'Interactive plot');
  const waiting =
    locale === 'pt'
      ? 'Carregando gráfico interativo…'
      : 'Loading interactive plot…';
  const noScript =
    locale === 'pt'
      ? 'Ative JavaScript para explorar este gráfico interativo.'
      : 'Enable JavaScript to explore this interactive plot.';
  return `<div class="sciastro-plot"><script type="application/json" data-plotly-spec>${json}</script><div class="plotly-canvas" role="region" aria-label="${escape(label)}"></div><p class="plotly-status" role="status">${waiting}</p><img class="plotly-print" alt="${escape(label)}" hidden /><div class="plotly-fallback">${fallback}<noscript><p>${noScript}</p></noscript></div></div>`;
}
