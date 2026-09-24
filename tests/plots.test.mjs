import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { stringify } from 'yaml';
import { validatePlotSpec, parsePlotSpec, plotMarkup } from '../dist/plots.js';
import { createDocumentContext } from '../dist/document.js';
import { renderNotebook } from '../dist/notebook.js';
import { Bibliography } from '../dist/bibliography.js';
import { loadSite } from '../dist/content.js';

const figure = () => ({
  data: [
    {
      type: 'scatter',
      x: [0, 1, 2],
      y: [0, 1, 4],
      mode: 'lines+markers',
      hovertemplate: 'x=%{x}<br>y=%{y}<extra></extra>',
    },
  ],
  layout: {
    title: { text: 'A quadratic curve' },
    xaxis: { title: { text: 'x' } },
  },
});
const document = (options = {}, locale = 'en') =>
  createDocumentContext(new Bibliography(''), locale, '/course/', options);
const specFrom = (html) =>
  JSON.parse(
    /<script type="application\/json" data-plotly-spec(?:="")?>([^]*?)<\/script>/.exec(
      html,
    )[1],
  );
const notebook = (data, metadata = {}, tags = []) =>
  JSON.stringify({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: { language_info: { name: 'python' } },
    cells: [
      {
        cell_type: 'code',
        source: 'raise RuntimeError("must not execute")',
        execution_count: 3,
        metadata: { tags },
        outputs: [{ output_type: 'display_data', data, metadata }],
      },
    ],
  });

test('self-contained scientific traces, Python typed arrays, ordinary templates and animation frames are preserved', () => {
  const binary = {
    dtype: 'f8',
    bdata: Buffer.from(new Float64Array([1, 2, 3, 4]).buffer).toString(
      'base64',
    ),
    shape: '2, 2',
  };
  const value = {
    data: [
      { type: 'surface', z: binary },
      {
        type: 'heatmap',
        z: [
          [1, 2],
          [3, 4],
        ],
      },
      { type: 'sankey', link: { source: [0], target: [1], value: [2] } },
    ],
    layout: {
      template: {
        data: {
          scattergeo: [{ type: 'scattergeo' }],
          choropleth: [{ type: 'choropleth' }],
        },
        layout: { geo: { showland: true } },
      },
      sliders: [
        {
          steps: [
            { method: 'animate', args: [['next'], { mode: 'immediate' }] },
          ],
        },
      ],
    },
    frames: [{ name: 'next', data: [{ type: 'scatter', y: [4, 5] }] }],
    config: {
      responsive: true,
      displayModeBar: 'hover',
      displaylogo: false,
      toImageButtonOptions: { format: 'svg', filename: 'my-figure', scale: 2 },
    },
  };
  assert.equal(validatePlotSpec(value), value);
  assert.deepEqual(parsePlotSpec(JSON.stringify(value)), value);
  for (const dtype of ['i1', 'u1', 'i2', 'u2', 'i4', 'u4', 'f4', 'f8']) {
    const item = {
      dtype,
      bdata: Buffer.alloc(Number(dtype[1]) * 2).toString('base64'),
    };
    assert.doesNotThrow(() => validatePlotSpec({ data: [{ x: item }] }));
  }
});

test('malformed or active resource payloads fail before rendering, including frames and templates', () => {
  for (const value of [
    {},
    { data: {} },
    { data: [null] },
    { data: [], layout: [] },
    { data: [{ type: 'scattermap' }] },
    { data: [{ type: 'scattergeo' }] },
    { data: [], frames: [{ data: [{ type: 'choropleth' }] }] },
    { data: [], layout: { geo: { showland: true } } },
    {
      data: [],
      frames: [{ layout: { mapbox: { style: 'open-street-map' } } }],
    },
    { data: [], frames: [{ layout: { 'geo2.showland': true } }] },
    { data: [{ type: 'image', source: 'https://example.org/image.png' }] },
    { data: [], layout: { images: [{ source: '//example.org/image.png' }] } },
    {
      data: [],
      layout: {
        template: { layout: { images: [{ source: 'javascript:alert(1)' }] } },
      },
    },
    { data: [{ xsrc: 'remote:1' }] },
    { data: [], config: { showSendToCloud: true } },
    { data: [], config: { modeBarButtonsToAdd: ['sendDataToCloud'] } },
    { data: [], config: { topojsonURL: 'https://example.org/' } },
    { data: [], config: { responsive: 'yes' } },
    {
      data: [],
      layout: { title: { text: '</script><script>alert(1)</script>' } },
    },
    { data: [{ text: ['<a href="javascript:alert(1)">click</a>'] }] },
    {
      data: [
        {
          text: ['<span style="background:url(https://example.org)">x</span>'],
        },
      ],
    },
    {
      data: [],
      layout: {
        updatemenus: [
          { buttons: [{ method: 'relayout', args: ['images', []] }] },
        ],
      },
    },
    { data: [{ transforms: [{ type: 'filter' }] }] },
    { data: [{ x: { dtype: 'i8', bdata: 'AAAA' } }] },
    { data: [{ x: { dtype: 'f8', bdata: 'AQ==' } }] },
    { data: [{ x: { dtype: 'i1', bdata: 'AQ==', shape: '2' } }] },
    { data: [{ x: { dtype: 'i1', bdata: '%not-base64' } }] },
    { data: [{ x: [Infinity] }] },
    JSON.parse('{"data":[],"layout":{"__proto__":{"polluted":true}}}'),
  ])
    assert.throws(
      () => validatePlotSpec(value),
      /Plotly/,
      JSON.stringify(value),
    );
  assert.throws(() => parsePlotSpec('not JSON'), /invalid JSON/);
  assert.equal({}.polluted, undefined);
});

test('embedded PNG data works without accepting SVG or remote images', () => {
  const png =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7mcAAAAASUVORK5CYII=';
  assert.doesNotThrow(() =>
    validatePlotSpec({ data: [{ type: 'image', source: png }] }),
  );
  assert.throws(
    () =>
      validatePlotSpec({
        data: [{ type: 'image', source: 'data:image/png;base64,YmFk' }],
      }),
    /embedded PNG/,
  );
  assert.throws(
    () =>
      validatePlotSpec({
        data: [
          {
            type: 'image',
            source: 'data:image/svg+xml,<svg onload="alert(1)"></svg>',
          },
        ],
      }),
    /embedded PNG/,
  );
});

test('markup embeds escaped JSON data with accessible canvas, print image and localized fallback', () => {
  const value = figure();
  value.layout.title.text = '1 < 2 & 3 > 2\u2028\u2029';
  const html = plotMarkup(value, 'pt', '', 'Curva "A"');
  const json = /data-plotly-spec>([^]*?)<\/script>/.exec(html)[1];
  assert.doesNotMatch(json, /[<>&\u2028\u2029]/);
  assert.deepEqual(specFrom(html), value);
  assert.equal((html.match(/<script/g) ?? []).length, 1);
  assert.match(
    html,
    /class="plotly-canvas" role="region" aria-label="Curva &quot;A&quot;"/,
  );
  assert.match(html, /class="plotly-status" role="status"/);
  assert.match(html, /class="plotly-print"[^>]* hidden/);
  assert.match(html, /<noscript><p>Ative JavaScript/);
});

test('Markdown plotly directives share figure numbering, captions and references', async () => {
  const requested = [];
  const doc = await document({
    resolvePlot: (source) => {
      requested.push(source);
      return figure();
    },
  });
  const result = doc.finish(
    doc.render(
      [
        'See @ref(fig:curve). Math $x^2$.',
        '::: plotly src="plots/quadratic.json" caption="Quadratic **curve**" label="fig:curve" align="right" caption-align="left" width="85%"',
        ':::',
        '::: figure caption="Next figure"',
        '![Example](/example.png)',
        ':::',
      ].join('\n'),
    ),
  ).html;
  assert.deepEqual(requested, ['plots/quadratic.json']);
  assert.deepEqual(specFrom(result), figure());
  assert.match(result, /href="#fig:curve"[^>]*>Figure 1<\/a>/);
  assert.match(result, /document-align-right/);
  assert.match(result, /--document-figure-width:85%/);
  assert.match(result, /figcaption style="text-align:left"/);
  assert.match(result, /Figure 2\./);
  assert.match(result, /<strong>curve<\/strong>/);
});

test('invalid directives fail with actionable errors and never interpret embedded HTML or code', async () => {
  for (const [source, expected] of [
    ['::: plotly\n:::', /requires src/],
    ['::: plotly src="plot.json"\nnot empty\n:::', /body must be empty/],
    [
      '::: plotly src="plot.json" onclick="alert(1)"\n:::',
      /Unsupported document attribute/,
    ],
    [
      '::: plotly src="plot.json" width="100%;color:red"\n:::',
      /Invalid figure width/,
    ],
  ]) {
    const doc = await document({ resolvePlot: () => figure() });
    assert.throws(() => doc.render(source), expected);
  }
  const doc = await document();
  assert.throws(
    () => doc.render('::: plotly src="plot.json"\n:::'),
    /requires a local figure resolver/,
  );
});

test('saved Plotly MIME is preferred; sanitized image stays as fallback; hidden outputs are skipped', async () => {
  const value = figure();
  const doc = await document();
  const html = doc.finish(
    renderNotebook(
      notebook(
        {
          'application/vnd.plotly.v1+json': value,
          'image/svg+xml':
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><circle r="1"/></svg>',
          'text/html': '<script>mustNotRun()</script>',
        },
        { sciastro: { caption: 'Saved curve', label: 'fig:saved' } },
      ),
      doc,
    ),
  ).html;
  assert.deepEqual(specFrom(html), value);
  assert.match(html, /notebook-output--plotly/);
  assert.match(html, /<div class="plotly-fallback"><img/);
  const encoded = /data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/.exec(html)[1];
  assert.doesNotMatch(
    Buffer.from(encoded, 'base64').toString(),
    /script|alert/,
  );
  assert.doesNotMatch(html, /mustNotRun|notebook-output-note/);
  assert.match(html, /Figure 1\./);
  const hidden = await document();
  assert.doesNotThrow(() =>
    renderNotebook(
      notebook({ 'application/vnd.plotly.v1+json': {} }, {}, ['remove-output']),
      hidden,
    ),
  );
  const invalid = await document();
  assert.throws(
    () =>
      renderNotebook(
        notebook({ 'application/vnd.plotly.v1+json': {} }),
        invalid,
      ),
    /Notebook cell 1, output 1: Plotly data/,
  );
});

test('site resolves local JSON for different site kinds and rejects traversal, symlinks, URLs and malformed files', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'sciastro-plots-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const content = join(root, 'content');
  await mkdir(join(content, 'plots'), { recursive: true });
  const config = {
    schemaVersion: 1,
    kind: 'course',
    name: 'Course',
    description: 'Test',
    url: 'https://example.org',
    base: '/course/',
    locales: ['en'],
    defaultLocale: 'en',
    contentDir: 'content',
    pageFiles: ['home.yaml', 'lesson.yaml'],
  };
  const configFile = join(root, 'sciastro.yaml');
  await writeFile(
    join(content, 'home.yaml'),
    stringify({ id: 'home', title: 'Home', paths: { en: '' } }),
  );
  await writeFile(
    join(content, 'lesson.yaml'),
    stringify({
      id: 'lesson',
      title: 'Lesson',
      layout: 'article',
      paths: { en: 'lesson/' },
      body: 'lesson.md',
    }),
  );
  await writeFile(
    join(content, 'plots', 'curve.json'),
    JSON.stringify(figure()),
  );
  const body = (src) =>
    writeFile(
      join(content, 'lesson.md'),
      `::: plotly src="${src}" caption="Result"\n:::\n`,
    );
  await body('plots/curve.json');
  for (const kind of ['course', 'individual', 'group']) {
    config.kind = kind;
    await writeFile(configFile, stringify(config));
    const site = await loadSite(configFile);
    const page = site.pages.find((entry) => entry.id === 'lesson');
    assert.deepEqual(specFrom(page.html), figure());
    assert.equal(page.path, '/course/lesson/');
  }
  const replacement = figure();
  replacement.data[0].y = [1, 2, 3];
  await writeFile(
    join(content, 'plots', 'curve.json'),
    JSON.stringify(replacement),
  );
  assert.deepEqual(
    specFrom(
      (await loadSite(configFile)).pages.find((page) => page.id === 'lesson')
        .html,
    ),
    replacement,
  );
  await writeFile(join(root, 'outside.json'), JSON.stringify(figure()));
  await symlink(
    join(root, 'outside.json'),
    join(content, 'plots', 'escape.json'),
  );
  await writeFile(
    join(content, 'plots', 'bad.json'),
    '<script>not JSON</script>',
  );
  for (const [src, pattern] of [
    ['../outside.json', /fora da pasta/],
    ['plots/escape.json', /escapes contentDir/],
    ['https://example.org/plot.json', /ENOENT|local .json/],
    ['plots/curve.json?x=1', /local .json/],
    ['plots/bad.json', /invalid JSON/],
  ]) {
    await body(src);
    await assert.rejects(loadSite(configFile), pattern);
  }
});
