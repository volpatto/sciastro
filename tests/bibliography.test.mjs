import test from 'node:test';
import assert from 'node:assert/strict';
import { Bibliography, referenceId } from '../dist/bibliography.js';
import { markdownContext } from '../dist/markdown.js';

const bib = String.raw`@string{journal = {Example Journal}}
@article{silva2025a, author={Silva, Ana and {Research Consortium}}, title={Alpha {GPU} methods}, journal=journal, year={2025}}
@article{silva2025b, author={Silva, Ana and {Research Consortium}}, title={Beta methods}, journal=journal, year={2025}}
@book{braces:key, author={M{\"u}ller, Jos{\'e}}, title={Nested {Braces} and accents}, year={2024}}`;

test('BibTeX parser preserves keys, nested braces, macros, accents and corporate authors', () => {
  const library = new Bibliography(bib);
  assert.deepEqual(library.keys, ['silva2025a', 'silva2025b', 'braces:key']);
  const rendered = library
    .references(library.keys, 'en')
    .map((entry) => entry.html)
    .join('');
  assert.match(rendered, /Example Journal/);
  assert.match(rendered, /GPU/);
  assert.match(rendered, /Müller/);
  assert.match(rendered, /Research Consortium/);
});

test('APA disambiguation is consistent between citations and bibliography', () => {
  const library = new Bibliography(bib);
  assert.match(library.citation(['silva2025a'], 'pt'), /2025a/);
  assert.match(library.citation(['silva2025b'], 'pt'), /2025b/);
  assert.match(library.references(['silva2025b'], 'pt')[0].html, /2025b/);
});

test('numeric citations use stable library indexes even on different pages', () => {
  const library = new Bibliography(bib, 'vancouver');
  assert.match(
    library.citation(['silva2025b', 'silva2025a'], 'en'),
    />2<\/a>, <a[^>]+>1<\/a>/,
  );
  assert.doesNotMatch(
    library.references(['silva2025b'], 'en')[0].html,
    /csl-left-margin/,
  );
});

test('citations link to deduplicated references and ignore inline/fenced code', () => {
  const context = markdownContext(new Bibliography(bib), 'pt');
  const html = context.render(
    'Discussão [@silva2025a; @silva2025b]. Outra [@silva2025a].\n\n`[@missing]`\n\n```text\n[@missing]\n```',
  );
  assert.match(html, new RegExp(`href="#${referenceId('silva2025a')}"`));
  assert.deepEqual(
    context.references().map((entry) => entry.key),
    ['silva2025a', 'silva2025b'],
  );
  assert.match(html, /<code>\[@missing\]<\/code>/);
});

test('missing, repeated and malformed citation keys fail explicitly', () => {
  assert.throws(
    () => markdownContext(new Bibliography(bib), 'pt').render('[@missing]'),
    /missing.*não encontrada/,
  );
  assert.throws(
    () =>
      markdownContext(new Bibliography(bib), 'pt').render(
        '[@silva2025a, p. 3]',
      ),
    /Citação inválida/,
  );
  assert.throws(
    () => new Bibliography('@book{a,title={One}}\n@book{a,title={Two}}'),
    /repetida/,
  );
  assert.throws(
    () => new Bibliography('@article{a,title={Unclosed'),
    /BibTeX inválido/,
  );
});

test('Markdown does not execute raw HTML or javascript links, and respects a base path', () => {
  const context = markdownContext(new Bibliography(''), 'en', '/lab/');
  const html = context.render(
    '<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n[Research](/research/)',
  );
  assert.doesNotMatch(html, /<script>/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /href="\/lab\/research\/"/);
});
