import test from 'node:test';
import assert from 'node:assert/strict';
import {
  navigationTree,
  pageAncestors,
  childPages,
  displayDate,
} from '../dist/navigation.js';

const pages = [
  { id: 'home' },
  { id: 'news' },
  { id: 'latest', parent: 'news', date: '2026-09-22' },
  { id: 'series', parent: 'news' },
  { id: 'chapter', parent: 'series', date: '2026-08-10' },
  { id: 'appendix', parent: 'chapter' },
  { id: 'older', parent: 'news', date: '2025-03-12' },
  { id: 'hidden', parent: 'news', navigation: false },
  { id: 'hidden-child', parent: 'hidden' },
  { id: 'about' },
];

test('menu limits visible depth while retaining active ancestry below that depth', () => {
  const tree = navigationTree(pages, 'appendix', 2);
  assert.deepEqual(
    tree.map((node) => node.page.id),
    ['home', 'news', 'about'],
  );
  const news = tree[1];
  assert.equal(news.activeAncestor, true);
  assert.deepEqual(
    news.children.map((node) => node.page.id),
    ['latest', 'series', 'older'],
  );
  assert.equal(news.children[1].activeAncestor, true);
  assert.deepEqual(news.children[1].children, []);
  const flat = navigationTree(pages, 'appendix', 1);
  assert.equal(flat[1].activeAncestor, true);
  assert.deepEqual(flat[1].children, []);
});

test('full navigation marks only the exact page current and keeps hidden branches hidden', () => {
  const tree = navigationTree(pages, 'chapter', 8);
  const chapter = tree[1].children[1].children[0];
  assert.equal(chapter.current, true);
  assert.equal(chapter.activeAncestor, false);
  assert.equal(chapter.children[0].page.id, 'appendix');
  assert(!JSON.stringify(tree).includes('hidden-child'));
});

test('breadcrumbs retain hidden ancestors and safely stop at missing parents or cycles', () => {
  assert.deepEqual(
    pageAncestors(pages, 'appendix').map((page) => page.id),
    ['news', 'series', 'chapter'],
  );
  assert.deepEqual(
    pageAncestors(pages, 'hidden-child').map((page) => page.id),
    ['news', 'hidden'],
  );
  assert.deepEqual(
    pageAncestors([{ id: 'child', parent: 'absent' }], 'child'),
    [],
  );
  assert.deepEqual(
    pageAncestors(
      [
        { id: 'a', parent: 'b' },
        { id: 'b', parent: 'a' },
      ],
      'a',
    ),
    [{ id: 'b', parent: 'a' }],
  );
});

test('listing includes direct children independently of menu visibility and sorts stably by date', () => {
  const values = [
    ...pages,
    { id: 'same-date', parent: 'news', date: '2026-09-22' },
  ];
  assert.deepEqual(
    childPages(values, 'news').map((page) => page.id),
    ['latest', 'same-date', 'older', 'series', 'hidden'],
  );
  assert.equal(
    values.at(-1).id,
    'same-date',
    'listing must not mutate source order',
  );
});

test('publication dates are localized without local timezone day shifts', () => {
  assert.equal(displayDate('2026-09-22', 'pt'), '22 de setembro de 2026');
  assert.equal(displayDate('2026-09-22', 'en'), '22 September 2026');
});
