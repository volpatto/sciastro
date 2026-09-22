import test from 'node:test';
import assert from 'node:assert/strict';
import MarkdownIt from 'markdown-it';
import { renderNotebook } from '../dist/notebook.js';
import { createDocumentContext } from '../dist/document.js';
import { Bibliography } from '../dist/bibliography.js';

const png =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7mcAAAAASUVORK5CYII=';
const svgSource =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#3859C8" /></svg>';
const markdown = (source, metadata = {}, extra = {}) => ({
  cell_type: 'markdown',
  metadata,
  source,
  ...extra,
});
const code = (outputs = [], metadata = {}, source = 'print("research")') => ({
  cell_type: 'code',
  metadata,
  source,
  execution_count: 2,
  outputs,
});
const display = (data, metadata = {}) => ({
  output_type: 'display_data',
  metadata,
  data,
});
const notebook = (cells, extra = {}) =>
  JSON.stringify({
    nbformat: 4,
    nbformat_minor: 5,
    metadata: { language_info: { name: 'python' } },
    cells,
    ...extra,
  });
const escape = (text) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
function context(locale = 'en') {
  const md = new MarkdownIt();
  const rendered = [];
  const figures = [];
  return {
    locale,
    rendered,
    figures,
    render(source) {
      rendered.push(source);
      return md.render(source);
    },
    code(source, language, title) {
      return `<div class="code-block" data-language="${language}"><b>${title}</b><pre><code>${escape(source)}</code></pre></div>`;
    },
    figure(html, options) {
      figures.push(options);
      return `<figure>${html}${options.caption ? `<figcaption>${escape(options.caption)}</figcaption>` : ''}</figure>`;
    },
    finish() {
      throw new Error(
        'The notebook must not finalize the shared page context.',
      );
    },
    references() {
      return [];
    },
  };
}

test('notebooks preserve multiline Markdown, code, execution counts and ordered outputs', () => {
  const ctx = context();
  const html = renderNotebook(
    notebook([
      markdown(['# Scientific notebook\n', '\nA **reproducible** study.']),
      code(
        [
          {
            output_type: 'stream',
            name: 'stdout',
            text: ['first\n', 'second\n'],
          },
          {
            output_type: 'execute_result',
            execution_count: 2,
            data: { 'text/plain': ['42\n', 'μ = 0.2'] },
            metadata: {},
          },
        ],
        {},
        ['x = 21\n', '2 * x'],
      ),
    ]),
    ctx,
  );
  assert.match(html, /<h1>Scientific notebook<\/h1>/);
  assert.match(html, /<strong>reproducible<\/strong>/);
  assert.match(html, /In \[2\]/);
  assert.match(html, /Out \[2\]/);
  assert.match(html, /data-language="python"/);
  assert.match(html, /x = 21\n2 \* x/);
  assert(html.indexOf('first\nsecond') < html.indexOf('42\nμ'));
});

test('one richest representation is selected and plot metadata becomes a shared figure', () => {
  const ctx = context();
  const html = renderNotebook(
    notebook([
      code([
        display(
          {
            'image/svg+xml': svgSource,
            'image/png': png,
            'text/plain': 'DUPLICATE FALLBACK',
          },
          {
            sciastro: {
              caption: 'Pressure **curve**',
              numbered: true,
              label: 'fig:pressure',
              align: 'right',
              width: '70%',
            },
          },
        ),
      ]),
    ]),
    ctx,
  );
  assert.match(html, /data:image\/svg\+xml;base64,/);
  assert.doesNotMatch(html, /DUPLICATE FALLBACK|data:image\/png/);
  assert.equal(ctx.figures.length, 1);
  assert.deepEqual(ctx.figures[0], {
    caption: 'Pressure **curve**',
    numbered: true,
    label: 'fig:pressure',
    align: 'right',
    width: '70%',
  });
});

test('cell captions apply once, output captions override them, and raster dimensions are retained', () => {
  const ctx = context();
  renderNotebook(
    notebook([
      code(
        [
          { output_type: 'stream', name: 'stdout', text: 'Plotting...' },
          display(
            { 'image/png': [png.slice(0, 30), '\n', png.slice(30)] },
            { 'image/png': { width: 640, height: 480 } },
          ),
          display({ 'image/png': png }),
          display(
            { 'image/png': png },
            {
              sciastro: {
                caption: 'Specific caption',
                numbered: false,
                width: 320,
              },
            },
          ),
        ],
        { sciastro: { caption: 'Shared caption', align: 'center' } },
      ),
    ]),
    ctx,
  );
  assert.deepEqual(ctx.figures, [
    { caption: 'Shared caption', align: 'center', width: '640px' },
    {},
    { caption: 'Specific caption', numbered: false, width: '320px' },
  ]);
});

test('saved pandas tables retain structure while scripts, event handlers, unsafe links and styles are removed', () => {
  const html = renderNotebook(
    notebook([
      code([
        display({
          'text/html':
            '<script>alert(1)</script><table class="dataframe evil" onclick="alert(1)"><thead><tr><th scope="col">Pressure</th></tr></thead><tbody><tr><td style="text-align: right; position:fixed; background:url(https://attacker.example/x)">12.3</td></tr></tbody></table><a href="javascript:alert(1)">bad</a><iframe src="https://attacker.example"></iframe>',
          'text/plain': 'DUPLICATE',
        }),
      ]),
    ]),
    context(),
  );
  assert.match(html, /<table class="dataframe">/);
  assert.match(html, /<th scope="col">Pressure<\/th>/);
  assert.match(html, /text-align:right/);
  assert.doesNotMatch(
    html,
    /<script|onclick|javascript:|position:fixed|attacker.example|<iframe|DUPLICATE|evil/,
  );
});

test('SVG plots keep viewBox, reusable glyphs and safe styles without active or external content', () => {
  const hostile =
    '<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10" onload="alert(1)"><defs><path id="glyph" d="M0 0L1 1"/></defs><use href="#glyph"/><use href="https://attacker.example/s.svg#g"/><script>alert(2)</script><foreignObject><div>hidden</div></foreignObject><image href="https://attacker.example/pixel"/><path d="M0 0L3 4" style="fill:#3859C8;stroke-width:1.5;stroke-linejoin:round;position:fixed"/><circle r="2" fill="url(https://attacker.example)"/><style>@import url(https://attacker.example)</style></svg>';
  const html = renderNotebook(
    notebook([code([display({ 'image/svg+xml': hostile })])]),
    context(),
  );
  const result = Buffer.from(
    /data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/.exec(html)[1],
    'base64',
  ).toString();
  assert.match(result, /viewBox="0 0 20 10"/);
  assert.match(result, /href="#glyph"/);
  assert.match(result, /stroke-linejoin:round/);
  assert.doesNotMatch(
    result,
    /onload|script|foreignObject|hidden|attacker|position|DOCTYPE|<image/,
  );
});

test('unsafe SVG entities fail with a cell/output location', () => {
  assert.throws(
    () =>
      renderNotebook(
        notebook([
          code([
            display({
              'image/svg+xml':
                '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///secret">]><svg>&x;</svg>',
            }),
          ]),
        ]),
        context(),
      ),
    /cell 1, output 1.*entity/,
  );
});

test('SVG heatmaps retain validated embedded raster images without external or nested active images', () => {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10"><image xlink:href="data:image/png;base64,${png}" x="0" y="0" width="10" height="10"/><image href="https://attacker.example/pixel"/><image href="data:image/svg+xml;base64,${Buffer.from('<svg onload="alert(1)"></svg>').toString('base64')}"/><image href="data:image/png;base64,${Buffer.from('<script>bad</script>').toString('base64')}"/></svg>`;
  const html = renderNotebook(
    notebook([code([display({ 'image/svg+xml': source })])]),
    context(),
  );
  const svg = Buffer.from(
    /data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/.exec(html)[1],
    'base64',
  ).toString();
  assert.equal((svg.match(/<image/g) ?? []).length, 1);
  assert.match(svg, /xlink:href="data:image\/png;base64,/);
  assert.match(svg, /width="10"/);
  assert.doesNotMatch(svg, /attacker|svg\+xml|onload|script/);
});

test('embedded HTML images accept static raster data, not SVG/HTML data URLs or scripts', () => {
  const html = renderNotebook(
    notebook([
      code([
        display({
          'text/html': `<p>Outputs</p><img src="data:image/png;base64,${png}"><img src="data:image/svg+xml;base64,AAAA" onerror="alert(1)"><img src="data:text/html;base64,PHNjcmlwdD4="><img src="javascript:alert(1)"><img src="  DATA:image/svg+xml;base64,AAAA"><img src="da&#9;ta:image/svg+xml;base64,AAAA">`,
        }),
      ]),
    ]),
    context(),
  );
  assert.match(html, /src="data:image\/png;base64,/);
  assert.doesNotMatch(html, /svg\+xml|text\/html|onerror|javascript:/);
});

test('LaTeX outputs use the same Markdown context across cells without finalizing it', () => {
  const ctx = context();
  renderNotebook(
    notebook([
      markdown('Equation in Markdown: $a=b$.'),
      code([
        display({
          'text/latex': ['\\frac{1}{', '2}'],
          'text/plain': 'one half',
        }),
      ]),
      code([display({ 'text/latex': '$$x=1$$' })]),
      markdown('Later citation [@study].'),
    ]),
    ctx,
  );
  assert.deepEqual(ctx.rendered, [
    'Equation in Markdown: $a=b$.',
    '$$\n\\frac{1}{2}\n$$',
    '$$x=1$$',
    'Later citation [@study].',
  ]);
});

test('Markdown attachments support raster and sanitized SVG, encoded filenames, and literal code safely', () => {
  const ctx = context();
  const html = renderNotebook(
    notebook([
      markdown(
        [
          '![Experiment](attachment:experiment.png)\n',
          '![Curve](<attachment:pressure curve.svg>)\n\n',
          '`attachment:not-an-image.png`',
        ],
        {},
        {
          attachments: {
            'experiment.png': { 'image/png': png },
            'pressure curve.svg': {
              'image/svg+xml': svgSource.replace(
                '<circle',
                '<script>alert(1)</script><circle',
              ),
            },
          },
        },
      ),
    ]),
    ctx,
  );
  assert.match(html, /alt="Experiment"/);
  assert.match(html, /src="data:image\/png/);
  assert.match(html, /src="data:image\/svg\+xml/);
  assert.match(html, /<code>attachment:not-an-image.png<\/code>/);
  assert.doesNotMatch(html, /src="attachment:/);
  const image = /data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)/.exec(html)[1];
  assert.doesNotMatch(Buffer.from(image, 'base64').toString(), /script|alert/);
});

test('unsupported widgets show a localized explanation and plain-text fallback; executable HTML is never run', () => {
  for (const locale of ['en', 'pt']) {
    const html = renderNotebook(
      notebook([
        code([
          display({
            'application/vnd.jupyter.widget-view+json': { model_id: 'id' },
            'text/html':
              '<b>INTERACTIVE ONLY</b><script>window.evil=true</script>',
            'text/plain': 'Widget representation',
          }),
        ]),
      ]),
      context(locale),
    );
    assert.match(html, /notebook-output-note/);
    assert.match(html, locale === 'en' ? /static page/ : /versão estática/);
    assert.match(html, /Widget representation/);
    assert.doesNotMatch(html, /<script|window.evil|INTERACTIVE ONLY/);
  }
});

test('widgets with a saved static image render the image instead of a duplicate interactive warning', () => {
  const html = renderNotebook(
    notebook([
      code([
        display({
          'application/vnd.plotly.v1+json': {},
          'image/png': png,
          'text/plain': 'Plot',
        }),
      ]),
    ]),
    context(),
  );
  assert.match(html, /data:image\/png/);
  assert.doesNotMatch(html, /notebook-output-note/);
});

test('streams, traceback and JSON outputs are escaped and ANSI terminal sequences are removed', () => {
  const html = renderNotebook(
    notebook([
      code([
        {
          output_type: 'stream',
          name: 'stderr',
          text: '\u001b[31mWarning μ <script>bad</script>\u001b[0m',
        },
        {
          output_type: 'error',
          ename: 'ValueError',
          evalue: 'é',
          traceback: [
            '\u001b[31mTraceback\u001b[0m',
            'ValueError: é <img onerror=x>',
          ],
        },
        display({
          'application/json': {
            result: '<script>alert(1)</script>',
            mean: 0.5,
          },
        }),
      ]),
    ]),
    context(),
  );
  assert.match(html, /notebook-output--stderr/);
  assert.match(html, /notebook-output--error/);
  assert.match(html, /Warning μ &lt;script&gt;/);
  assert.match(html, /ValueError: é &lt;img/);
  assert.match(html, /notebook-output--json/);
  assert.doesNotMatch(html, /\u001b|<script|<img/);
});

test('global code options and standard notebook tags control source and output visibility', () => {
  const cells = [
    code([{ output_type: 'stream', name: 'stdout', text: 'result' }]),
  ];
  const hidden = renderNotebook(notebook(cells), context(), {
    showCode: false,
  });
  assert.doesNotMatch(hidden, /notebook-code|print/);
  assert.match(hidden, /result/);
  assert.match(
    renderNotebook(notebook(cells), context(), { collapseCode: true }),
    /<details class="notebook-code-collapse">/,
  );
  const tagged = renderNotebook(
    notebook([
      code([], { tags: ['remove-cell'] }, 'EXCLUDE ENTIRELY'),
      code(
        [{ output_type: 'stream', name: 'stdout', text: 'visible output' }],
        { tags: ['remove-input'] },
        'HIDDEN SOURCE',
      ),
      code([{ output_type: 'stream', name: 'stdout', text: 'HIDDEN OUTPUT' }], {
        tags: ['remove-output'],
      }),
      code(
        [{ output_type: 'stream', name: 'stdout', text: 'collapsed output' }],
        { tags: ['hide-input', 'hide-output'] },
      ),
    ]),
    context(),
  );
  assert.doesNotMatch(tagged, /EXCLUDE ENTIRELY|HIDDEN SOURCE|HIDDEN OUTPUT/);
  assert.match(tagged, /visible output/);
  assert.match(tagged, /<details class="notebook-code-collapse">/);
  assert.match(tagged, /<details class="notebook-output-collapse">/);
});

test('Jupyter source_hidden/outputs_hidden and custom per-cell options are respected', () => {
  const html = renderNotebook(
    notebook([
      code([{ output_type: 'stream', name: 'stdout', text: 'result' }], {
        jupyter: { source_hidden: true, outputs_hidden: true },
      }),
      code([], { sciastro: { showCode: false } }, 'HIDDEN'),
      code([], { sciastro: { collapseCode: false } }, 'EXPANDED'),
    ]),
    context('pt'),
    { collapseCode: true },
  );
  assert.equal(
    (html.match(/<details class="notebook-code-collapse">/g) ?? []).length,
    1,
  );
  assert.match(html, /<summary>Saída<\/summary>/);
  assert.doesNotMatch(html, /HIDDEN/);
  assert.match(html, /EXPANDED/);
});

test('removed output cells do not consume shared equation/figure counters or citations', () => {
  const ctx = context();
  renderNotebook(
    notebook([
      code([display({ 'text/latex': '$$x=2$$' })], { tags: ['remove-output'] }),
    ]),
    ctx,
  );
  assert.deepEqual(ctx.rendered, []);
  assert.deepEqual(ctx.figures, []);
});

test('raw cells are displayed as inert preformatted source, never executed as HTML', () => {
  const html = renderNotebook(
    notebook([
      {
        cell_type: 'raw',
        metadata: { format: 'text/html' },
        source: '<script>alert(1)</script>',
      },
    ]),
    context(),
  );
  assert.match(html, /notebook-cell--raw/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<script>/);
});

test('malformed notebooks and outputs provide useful cell locations', () => {
  const cases = [
    ['bad json', /invalid JSON/],
    [notebook([], { nbformat: 3 }), /nbformat 4/],
    [notebook([], { cells: {} }), /cells must be an array/],
    [notebook([markdown(['valid', 42])]), /cell 1 source.*string/],
    [
      notebook([{ ...code(), execution_count: '2' }]),
      /cell 1.*execution_count/,
    ],
    [
      notebook([code([{ output_type: 'stream', name: 'stdout', text: 2 }])]),
      /cell 1, output 1 text/,
    ],
    [
      notebook([code([display({ 'image/png': 'not base64' })])]),
      /cell 1, output 1.*base64/,
    ],
    [
      notebook([
        code([
          display({
            'image/png': Buffer.from('<script>x</script>').toString('base64'),
          }),
        ]),
      ]),
      /bytes do not match/,
    ],
    [
      notebook([
        code([
          display(
            { 'image/png': png },
            { sciastro: { width: '1px;position:fixed' } },
          ),
        ]),
      ]),
      /sciastro.width/,
    ],
    [
      notebook([markdown('![missing](attachment:missing.png)')]),
      /cell 1 attachment 'missing.png'/,
    ],
  ];
  for (const [source, message] of cases)
    assert.throws(() => renderNotebook(source, context()), message);
});

test('real document rendering shares headings, citations and numbered LaTeX across notebook cells', async () => {
  const ctx = await createDocumentContext(
    new Bibliography(
      '@article{study,title={Numerical study},author={Silva, Ana},year={2026}}',
    ),
    'en',
    '/lab/',
  );
  const html = renderNotebook(
    notebook([
      markdown(String.raw`## Numerical study
See [@study] and Equation \eqref{eq:second}.`),
      code(
        [
          display({
            'text/latex': String.raw`\begin{equation} a=1 \label{eq:first}\end{equation}`,
          }),
        ],
        {},
        'a = 1',
      ),
      markdown(
        String.raw`\begin{equation}b=2\label{eq:second}\end{equation}

![Plot](attachment:plot.svg)`,
        {},
        { attachments: { 'plot.svg': { 'image/svg+xml': svgSource } } },
      ),
    ]),
    ctx,
  );
  const result = ctx.finish(html);
  assert.deepEqual(result.headings, [
    { id: 'numerical-study', text: 'Numerical study', depth: 2 },
  ]);
  assert.match(result.html, /mjx-container/);
  assert.match(result.html, /shiki/);
  assert.match(result.html, /data:image\/svg\+xml;base64,/);
  assert.deepEqual(
    ctx.references().map((entry) => entry.key),
    ['study'],
  );
  assert.doesNotMatch(
    result.html.replace(/<[^>]+>/g, ''),
    /\\eqref|\\begin\{equation\}/,
  );
});

test('real document rendering numbers saved notebook figures and Markdown figures in one sequence', async () => {
  const ctx = await createDocumentContext(new Bibliography(''), 'en');
  const html = renderNotebook(
    notebook([
      markdown(
        '::: figure caption="First plot" label="fig:first"\n![First](/first.png)\n:::',
      ),
      code([
        display(
          { 'image/png': png },
          {
            sciastro: {
              caption: 'Second plot',
              label: 'fig:second',
              width: '50%',
            },
          },
        ),
      ]),
      markdown('See @ref(fig:first) and @ref(fig:second).'),
    ]),
    ctx,
  );
  const result = ctx.finish(html).html;
  assert.match(result, /Figure 1/);
  assert.match(result, /Figure 2/);
  assert.match(result, /Second plot/);
  assert.match(result, /50%/);
});

test('bare matrix and aligned LaTeX output environments render as mathematical display blocks', async () => {
  const ctx = await createDocumentContext(new Bibliography(''), 'en');
  const html = renderNotebook(
    notebook([
      code([
        display({
          'text/latex': String.raw`\begin{pmatrix}1&2\\3&4\end{pmatrix}`,
        }),
        display({
          'text/latex': String.raw`\begin{aligned}a&=1\\b&=2\end{aligned}`,
        }),
      ]),
    ]),
    ctx,
  );
  const result = ctx.finish(html).html;
  assert.equal(
    (result.match(/class="document-math document-math-block"/g) ?? []).length,
    2,
  );
  assert.equal((result.match(/<mjx-container[^>]*jax="SVG"/g) ?? []).length, 2);
  assert.doesNotMatch(result.replace(/<[^>]+>/g, ''), /\\begin|\\end/);
});
