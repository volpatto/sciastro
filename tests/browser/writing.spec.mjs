import { test as base, expect } from '@playwright/test';

const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await use(page);
    expect(errors, 'No unhandled client errors').toEqual([]);
  },
});

const paths = {
  home: '/caderno/',
  news: '/caderno/noticias/',
  article: '/caderno/noticias/escrita-cientifica/',
  tutorials: '/caderno/noticias/tutoriais/',
  notebook: '/caderno/noticias/tutoriais/quadratura/',
};

async function menu(page, testInfo) {
  if (testInfo.project.metadata.mobile)
    await page.locator('.navigation > summary').click();
  return page.getByRole('navigation', { name: 'Navegação principal' });
}

async function noHorizontalOverflow(page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test('headings without dates or authors do not render empty metadata or stray text', async ({
  page,
}) => {
  for (const [path, title, description] of [
    [
      paths.news,
      'Notícias e notas',
      'Registros de pesquisa, tutoriais e resultados computacionais.',
    ],
    [
      paths.tutorials,
      'Tutoriais',
      'Exemplos executáveis e explicações passo a passo.',
    ],
  ]) {
    await page.goto(path);
    const heading = page.locator('.article-heading');
    await expect(heading.locator('.article-metadata')).toHaveCount(0);
    await expect(heading).toHaveText(`${title}${description}`);
  }
});

test('native hierarchical menu separates parent links from keyboard toggles', async ({
  page,
}, testInfo) => {
  await page.goto(paths.home);
  await expect(page.locator('.document-cards > .document-card')).toHaveCount(2);
  const navigation = await menu(page, testInfo);
  const branch = navigation.locator('.navigation-branch');
  const toggle = navigation.getByLabel('Subpáginas de Notícias e notas');
  await expect(branch).not.toHaveAttribute('open', '');
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(branch).toHaveAttribute('open', '');
  await expect(
    navigation.getByRole('link', { name: 'Tutoriais', exact: true }),
  ).toBeVisible();
  // Depth two shows the section, while the nested notebook is reached from its listing.
  await expect(navigation.locator('a[data-page="quadrature"]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(branch).not.toHaveAttribute('open', '');
  await expect(toggle).toBeFocused();
  await navigation
    .getByRole('link', { name: 'Notícias e notas', exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`${paths.news}$`));
  await expect(page.locator('.article-card h2')).toHaveText([
    'Escrita científica em Markdown',
    'Tutoriais',
  ]);
  await noHorizontalOverflow(page);
});

test('deep pages retain ancestor state, breadcrumbs and listing links beyond menu depth', async ({
  page,
}, testInfo) => {
  await page.goto(paths.tutorials);
  await page.locator('.article-card h2 a').click();
  await expect(page).toHaveURL(new RegExp(`${paths.notebook}$`));
  const trail = page.getByRole('navigation', { name: 'Caminho da página' });
  await expect(trail.getByRole('link')).toHaveText([
    'Sobre',
    'Notícias e notas',
    'Tutoriais',
  ]);
  await expect(trail.locator('[aria-current="page"]')).toHaveText(
    'Convergência de uma quadratura',
  );
  const navigation = await menu(page, testInfo);
  await expect(navigation.locator('a[data-page="news"]')).toHaveAttribute(
    'data-active-ancestor',
    'true',
  );
  await expect(navigation.locator('a[data-page="tutorials"]')).toHaveAttribute(
    'data-active-ancestor',
    'true',
  );
  await expect(navigation.locator('a[data-page="quadrature"]')).toHaveCount(0);
  await trail.getByRole('link', { name: 'Tutoriais', exact: true }).click();
  await expect(page.locator('.article-card h2 a')).toHaveAttribute(
    'href',
    paths.notebook,
  );
});

test('article math, citations, figures, captions and heading links are built into the page', async ({
  page,
}) => {
  const failed = [];
  page.on('response', (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto(paths.article);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Escrita científica em Markdown',
  );
  await expect(page.locator('.article-metadata time')).toHaveAttribute(
    'datetime',
    '2026-09-22',
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute(
    'content',
    'article',
  );
  await expect(
    page.locator('meta[property="article:published_time"]'),
  ).toHaveAttribute('content', '2026-09-22T00:00:00Z');
  await expect(page.locator('.article-tags li')).toHaveText([
    'Markdown',
    'Computação científica',
  ]);
  const toc = page.getByRole('navigation', { name: 'Sumário da página' });
  await expect(toc.getByRole('link')).toHaveText([
    'Formulação',
    'Implementação',
    'Resultados',
  ]);
  await toc.getByRole('link', { name: 'Resultados', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /Resultados/, level: 2 }),
  ).toBeInViewport();
  expect(
    await page.locator('mjx-container[jax="SVG"]').count(),
  ).toBeGreaterThan(4);
  await expect(page.locator('mjx-merror')).toHaveCount(0);
  await expect(page.locator('.document-figure figcaption')).toContainText(
    'Figura 1.',
  );
  await expect(page.locator('.document-table figcaption')).toContainText(
    'Tabela 1.',
  );
  const image = page.locator('.document-figure img');
  await expect(image).toHaveAttribute('src', '/caderno/images/convergence.svg');
  await expect(image).toBeVisible();
  expect(
    await image.evaluate(
      (element) => element.complete && element.naturalWidth > 0,
    ),
  ).toBe(true);
  await expect(page.locator('a[role="doc-biblioref"]')).toHaveCount(1);
  await expect(page.locator('.reference-list')).toContainText('Davis');
  await expect(page.locator('.document-callout-warning')).toContainText(
    'Interpretação do erro',
  );
  await expect(page.locator('.document-table-scroll')).toHaveAttribute(
    'tabindex',
    '0',
  );
  await noHorizontalOverflow(page);
  expect(failed).toEqual([]);
});

test('highlighted code copies the original source and follows light and dark appearance', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(paths.article);
  const code = page.locator('.document-code').first();
  await expect(code.locator('.document-code-header > span')).toHaveText(
    'quadratura.py',
  );
  const button = code.locator('[data-copy-code]');
  await expect(button).toHaveAccessibleName('Copiar código');
  await button.click();
  await expect(button).toHaveText('Copiado');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
    await code.locator('pre code').textContent(),
  );
  const light = await code
    .locator('pre')
    .evaluate((pre) => getComputedStyle(pre).backgroundColor);
  await page.locator('.theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  const dark = await code
    .locator('pre')
    .evaluate((pre) => getComputedStyle(pre).backgroundColor);
  expect(dark).not.toBe(light);
  await noHorizontalOverflow(page);
});

test('clipboard denial is announced without interfering with reading', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', {
      value: () =>
        Promise.reject(new DOMException('Denied', 'NotAllowedError')),
    });
  });
  await page.goto(paths.article);
  const button = page.locator('[data-copy-code]').first();
  await button.click();
  await expect(button).toHaveText('Não foi possível copiar');
  await expect(button).toHaveAttribute('aria-live', 'polite');
  await expect(page.locator('.document-code pre')).toContainText(
    'def trapezoid',
  );
});

test('saved notebook cells, tables, figures and LaTeX render with themed output panels', async ({
  page,
}) => {
  await page.goto(paths.notebook);
  await expect(page.locator('.notebook')).toBeVisible();
  expect(await page.locator('.notebook-cell--code').count()).toBeGreaterThan(0);
  expect(await page.locator('.notebook-output').count()).toBeGreaterThan(1);
  await expect(page.locator('.notebook-output--html table')).toBeVisible();
  const intactNumbers = await page
    .locator('.notebook-output--html td')
    .evaluateAll((cells) =>
      cells
        .filter((cell) =>
          /^\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(cell.textContent.trim()),
        )
        .every((cell) => {
          const range = document.createRange();
          range.selectNodeContents(cell);
          return (
            new Set(
              [...range.getClientRects()].map((rect) => Math.round(rect.top)),
            ).size <= 1
          );
        }),
    );
  expect(
    intactNumbers,
    'Numeric results must remain intact instead of splitting digits across lines',
  ).toBe(true);
  await expect(page.locator('.notebook-output--image img')).toBeVisible();
  await expect(
    page.locator('.notebook-output--image figcaption'),
  ).toContainText('Figura 1.');
  expect(
    await page.locator('mjx-container[jax="SVG"]').count(),
  ).toBeGreaterThan(1);
  await expect(page.locator('mjx-merror')).toHaveCount(0);
  const output = page.locator('.notebook-output').first();
  const light = await output.evaluate(
    (element) => getComputedStyle(element).backgroundColor,
  );
  await page.locator('.theme-toggle').click();
  expect(
    await output.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    ),
  ).not.toBe(light);
  await noHorizontalOverflow(page);
});

test('scientific content and native navigation remain usable with JavaScript disabled', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    baseURL: testInfo.project.use.baseURL,
    viewport: testInfo.project.use.viewport,
  });
  try {
    const page = await context.newPage();
    await page.goto(paths.article);
    expect(
      await page.locator('mjx-container[jax="SVG"]').count(),
    ).toBeGreaterThan(4);
    await expect(page.locator('.document-code pre')).toContainText(
      'def trapezoid',
    );
    await expect(page.locator('[data-copy-code]')).toBeHidden();
    await expect(page.locator('.theme-toggle')).toBeHidden();
    const navigation = page.getByRole('navigation', {
      name: 'Navegação principal',
    });
    await navigation
      .getByRole('link', { name: 'Tutoriais', exact: true })
      .click();
    await page.locator('.article-card h2 a').click();
    await expect(page).toHaveURL(new RegExp(`${paths.notebook}$`));
    await expect(page.locator('.notebook-output--image img')).toBeVisible();
    await noHorizontalOverflow(page);
  } finally {
    await context.close();
  }
});
