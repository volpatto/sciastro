import test from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentContext } from '../dist/document.js';
import { Bibliography } from '../dist/bibliography.js';

const context = (locale = 'en', bib = '') =>
  createDocumentContext(new Bibliography(bib), locale, '/lab/');
const finish = async (source, locale = 'en') => {
  const document = await context(locale);
  return document.finish(document.render(source));
};

test('rich Markdown preserves nested formatting, citations and base-aware links', async () => {
  const doc = await context(
    'en',
    '@book{sample, title={An example}, author={Doe, Jane}, year={2026}}',
  );
  const html = doc.finish(
    doc.render(
      '::: note title="Reading"\nSee **this** [resource](/research/) [@sample].\n\n- A list\n- Another item\n:::',
    ),
  ).html;
  assert.match(html, /document-callout-note/);
  assert.match(html, /<strong>this<\/strong>/);
  assert.match(html, /href="\/lab\/research\/"/);
  assert.match(html, /role="doc-biblioref"/);
  assert.match(html, /<li>A list<\/li>/);
  assert.deepEqual(
    doc.references().map((ref) => ref.key),
    ['sample'],
  );
});

test('directives nest without consuming code fences or each other', async () => {
  const source = [
    '::: cards',
    '::: card title="Model"',
    'A **model**.',
    '::: tip "Convergence"',
    'Measure the residual.',
    ':::',
    ':::',
    '::: card title="Code"',
    '```text',
    '::: warning',
    'not a directive',
    ':::',
    '```',
    ':::',
    ':::',
    '',
    '::: details title="Derivation"',
    'One step.',
    ':::',
  ].join('\n');
  const { html } = await finish(source);
  assert.equal((html.match(/class="document-card"/g) ?? []).length, 2);
  assert.equal((html.match(/document-callout-tip/g) ?? []).length, 1);
  assert.doesNotMatch(html, /document-callout-warning/);
  assert.match(html, /<summary>Derivation<\/summary>/);
  assert.match(html, /<strong>model<\/strong>/);
});

test('highlighted code is dual-theme, escaped and supplies progressive copy controls', async () => {
  const doc = await context('pt');
  const html = doc.code('print("<script> & $x$ ")\n', 'python', 'research.py');
  assert.match(html, /research.py/);
  assert.match(html, /github-light/);
  assert.match(html, /github-dark/);
  assert.match(html, /--shiki-dark/);
  assert.match(html, /hidden data-copy-code/);
  assert.match(html, /aria-label="Copiar código"/);
  assert.match(html, /data-copy-error-label="Não foi possível copiar"/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /(?:&lt;|&#x3C;)script(?:&gt;|>)/);
  assert.doesNotMatch(doc.finish(html).html, /mjx-container/);
});

test('code blocks preserve LaTeX and citation syntax instead of rendering it', async () => {
  const { html } = await finish(
    [
      '`$x$` and `\\eqref{missing}`',
      '',
      '```python filename="demo.py"',
      'x = "$x$ [@missing]"',
      '\\begin{equation} x=1 \\end{equation}',
      '```',
    ].join('\n'),
  );
  assert.doesNotMatch(html, /mjx-container/);
  assert.match(html, /demo.py/);
  assert.match(html, /<code>\$x\$<\/code>/);
  const doc = await context();
  assert.match(
    doc.code('unchanged <example>', 'not-a-real-language'),
    /(?:&lt;|&#x3C;)example(?:&gt;|>)/,
  );
});

test('headings have stable Unicode-aware ids, explicit ids and page-wide deduplication', async () => {
  const doc = await context();
  const first = doc.render('## Résultats\n\n### **Model** {#method}\n');
  const second = doc.render('## Résultats\n\n::: note\n### Inner title\n:::');
  const result = doc.finish(first + second);
  assert.deepEqual(result.headings, [
    { id: 'resultats', text: 'Résultats', depth: 2 },
    { id: 'method', text: 'Model', depth: 3 },
    { id: 'resultats-2', text: 'Résultats', depth: 2 },
    { id: 'inner-title', text: 'Inner title', depth: 3 },
  ]);
  assert.doesNotMatch(result.html, /\{#method\}/);
  assert.match(result.html, /href="#resultats-2"/);
  assert.throws(() => doc.render('## Another'), /already finished/);
});

test('figure/table numbering, captions and forward references span multiple renders', async () => {
  const doc = await context('pt');
  const intro = doc.render('Consulte @ref(fig:curve) e @ref(tab:data).');
  const first = doc.render(
    '::: figure caption="Erro **relativo**." label="fig:curve" align="right" width="75%"\n![Curve](/curve.svg)\n:::',
  );
  const second = doc.figure(
    '<img src="data:image/png;base64,YQ==" alt="Notebook result">',
    { caption: 'Notebook output' },
  );
  const table = doc.render(
    '::: table caption="Resultados." label="tab:data"\n| x | y |\n| -: | -: |\n| 1 | 2 |\n:::',
  );
  const html = doc.finish(intro + first + second + table).html;
  assert.match(html, /href="#fig:curve">Figura 1<\/a>/);
  assert.match(html, /href="#tab:data">Tabela 1<\/a>/);
  assert.match(html, /Figura 2\./);
  assert.match(html, /--document-figure-width:75%/);
  assert.match(html, /document-align-right/);
  assert.match(html, /src="\/lab\/curve.svg"/);
  assert.match(html, /Erro <strong>relativo<\/strong>/);
  assert.match(
    html,
    /class="document-table-scroll" tabindex="0" role="region"/,
  );
  assert.match(html, /<table>/);
});

test('unnumbered captions do not consume the figure counter', async () => {
  const doc = await context();
  const a = doc.figure('<img alt="A">', {
    caption: 'An overview',
    label: 'fig:overview',
    numbered: false,
  });
  const b = doc.figure('<img alt="B">', { caption: 'First numbered figure' });
  const html = doc.finish(doc.render('@ref(fig:overview)') + a + b).html;
  assert.match(html, />An overview<\/a>/);
  assert.match(html, /Figure 1\./);
  assert.doesNotMatch(html, /Figure 2\./);
});

test('LaTeX renders to local SVG with AMS numbering and forward references', async () => {
  const doc = await context();
  const intro = doc.render(
    String.raw`See \eqref{eq:energy}; inline $E = mc^2$ and \(\alpha+\beta\).`,
  );
  const eq = doc.render(String.raw`\begin{equation}
E = mc^2 \label{eq:energy}
\end{equation}

\begin{align}
a &= b \label{eq:first}\\
c &= d \label{eq:second}
\end{align}

$$ x^2 + y^2 = 1 $$

\begin{equation*}
z = 0
\end{equation*}`);
  const html = doc.finish(intro + eq).html;
  assert.match(html, /jax="SVG"/);
  assert.match(html, /<mjx-assistive-mml/);
  assert.match(html, /<math xmlns="http:\/\/www.w3.org\/1998\/Math\/MathML"/);
  assert.match(html, /href="#mjx-eqn%3Aeq%3Aenergy"/);
  assert.match(html, /id="mjx-eqn:eq:energy"/);
  assert.match(html, /id="mjx-eqn:eq:first"/);
  assert.match(html, /id="mjx-eqn:eq:second"/);
  assert.equal((html.match(/id="mjx-eqn:/g) ?? []).length, 3);
  assert.doesNotMatch(html, /<script|src="https?:|url\(https?:/);
  assert.doesNotMatch(html, /data-mjx-error=|<g data-mml-node="merror"/);
});

test('equation numbering and label scope reset in every document', async () => {
  const source = String.raw`\begin{equation} x=1 \label{eq:same} \end{equation}`;
  const first = (await finish(source)).html;
  const second = (await finish(source)).html;
  assert.equal(first, second);
});

test('invalid math labels, missing references and duplicate labels fail clearly', async () => {
  for (const [source, error] of [
    [String.raw`See \eqref{eq:missing}.`, /Unknown equation reference/],
    [
      String.raw`\begin{equation}x=1\label{same}\end{equation}
\begin{equation}y=2\label{same}\end{equation}`,
      /Repeated equation label/,
    ],
    [String.raw`$$ \notARealCommand{x} $$`, /Invalid LaTeX/],
    ['See @ref(fig:missing).', /Unknown figure\/table reference/],
  ]) {
    const doc = await context();
    assert.throws(() => doc.finish(doc.render(source)), error);
  }
});

test('raw HTML and unsafe attributes cannot become executable output', async () => {
  const { html } = await finish(
    '<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n::: note title="<img onerror=alert(1)>"\nSafe\n:::',
  );
  assert.doesNotMatch(html, /<script|<img|href="javascript:/);
  assert.match(html, /&lt;img onerror=alert\(1\)&gt;/);
  for (const source of [
    '::: figure width="100%;position:fixed"\n![](/x.png)\n:::',
    '::: figure align="center onclick=alert(1)"\n![](/x.png)\n:::',
    '::: figure onclick="alert(1)"\n![](/x.png)\n:::',
    '::: figure label="x\" onclick=alert(1)"\n![](/x.png)\n:::',
    '::: figure numbered="sometimes"\n![](/x.png)\n:::',
    '::: note\nMissing closing fence.',
  ]) {
    const doc = await context();
    assert.throws(
      () => doc.render(source),
      /Invalid|Unsupported|Unclosed|numbered must/,
    );
  }
  const doc = await context();
  assert.throws(
    () =>
      doc.finish(doc.render(String.raw`$\href{javascript:alert(1)}{click}$`)),
    /Invalid LaTeX/,
  );
});

test('attachments remain identifiable only in image attributes for the notebook adapter', async () => {
  const { html } = await finish(
    '![A](attachment:plot.png)\n\n`attachment:plot.png`',
  );
  assert.match(html, /src="attachment:plot.png"/);
  assert.match(html, /<code>attachment:plot.png<\/code>/);
});

test('page links use the site resolver exactly once and preserve normal anchors', async () => {
  const seen = [];
  const doc = await createDocumentContext(new Bibliography(''), 'en', '/lab/', {
    resolveLink(target) {
      seen.push(target);
      return '/lab/en/research/#methods';
    },
  });
  const { html } = doc.finish(
    doc.render(
      '[Research](page:research#methods) and [Local](#local) and [Asset](/file.pdf).',
    ),
  );
  assert.deepEqual(seen, ['page:research#methods']);
  assert.match(html, /href="\/lab\/en\/research\/#methods"/);
  assert.doesNotMatch(html, /\/lab\/lab\//);
  assert.match(html, /href="#local"/);
  assert.match(html, /href="\/lab\/file.pdf"/);
  const unresolved = await context();
  assert.throws(
    () => unresolved.render('[Missing](page:research)'),
    /needs a site link resolver/,
  );
  const unsafe = await createDocumentContext(new Bibliography(''), 'en', '/', {
    resolveLink: () => 'javascript:alert(1)',
  });
  assert.throws(
    () => unsafe.render('[Unsafe](page:research)'),
    /not a safe URL/,
  );
});

test('reserved layout, section and reference ids are not reused by headings or figures', async () => {
  const doc = await createDocumentContext(new Bibliography(''), 'en', '/', {
    reservedIds: ['methods', 'ref-61'],
  });
  const { html, headings } = doc.finish(
    doc.render('## Main\n\n## References\n\n## Methods'),
  );
  assert.deepEqual(
    headings.map((heading) => heading.id),
    ['main-2', 'references-2', 'methods-2'],
  );
  assert.match(html, /id="methods-2"/);
  for (const source of [
    '## Heading {#main}',
    '## Heading {#ref-61}',
    '::: figure label="methods"\n![A](/a.png)\n:::',
  ]) {
    const isolated = await createDocumentContext(
      new Bibliography(''),
      'en',
      '/',
      { reservedIds: ['methods', 'ref-61'] },
    );
    assert.throws(
      () => isolated.render(source),
      /Repeated document label or heading id/,
    );
  }
});

test('figure and table caption alignment is independent of block placement and numbering', async () => {
  const doc = await context();
  const html = doc.finish(
    doc.render(
      [
        '::: figure caption="Left caption" caption-align="left" align="right" label="fig:aligned"',
        '![Plot](/plot.png)',
        ':::',
        '',
        '::: table caption="Justified caption" caption-align="justify" align="left" label="tab:aligned"',
        '| x | y |',
        '| - | - |',
        '| 1 | 2 |',
        ':::',
        '',
        '::: figure caption="Inherited caption"',
        '![Plot](/plot.png)',
        ':::',
        '',
        '::: table caption="Next table" caption-align="right"',
        '| x | y |',
        '| - | - |',
        '| 3 | 4 |',
        ':::',
        '',
        '::: figure caption="Centered explicitly" caption-align="center" numbered=false',
        '![Plot](/plot.png)',
        ':::',
        '',
        'See @ref(fig:aligned) and @ref(tab:aligned).',
      ].join('\n'),
    ),
  ).html;
  assert.match(
    html,
    /class="document-figure document-align-right"[^]*?<figcaption style="text-align:left">/,
  );
  assert.match(
    html,
    /class="document-table document-align-left"[^]*?<figcaption style="text-align:justify">/,
  );
  assert.match(
    html,
    /<figcaption><span class="document-caption-number">Figure 2\.<\/span> Inherited caption/,
  );
  assert.match(
    html,
    /<figcaption style="text-align:right"><span class="document-caption-number">Table 2\./,
  );
  assert.match(
    html,
    /<figcaption style="text-align:center">Centered explicitly<\/figcaption>/,
  );
  assert.match(html, /href="#fig:aligned">Figure 1<\/a>/);
  assert.match(html, /href="#tab:aligned">Table 1<\/a>/);
  assert.doesNotMatch(html, /Figure 3\./);
});

test('caption alignment rejects invalid and injected values before generating HTML', async () => {
  const doc = await context();
  for (const captionAlign of [
    '',
    'inherit',
    'RIGHT',
    'left;position:fixed',
    'center" onclick="alert(1)',
    null,
    true,
    ['left'],
  ]) {
    assert.throws(
      () => doc.figure('<img alt="Plot">', { caption: 'Result', captionAlign }),
      /Invalid caption alignment/,
    );
  }
  for (const kind of ['figure', 'table']) {
    assert.throws(
      () =>
        doc.render(
          `::: ${kind} caption="Result" caption-align="left;position:fixed"\nText\n:::`,
        ),
      /Invalid caption alignment/,
    );
    assert.throws(
      () =>
        doc.render(`::: ${kind} caption="Result" caption-align=""\nText\n:::`),
      /Invalid caption alignment/,
    );
  }
});
