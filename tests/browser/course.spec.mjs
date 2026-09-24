import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test('course navigation, Markdown, equations and export actions work at each width', async ({
  page,
}, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/aulas/integracao/');
  await expect(page.locator('h1')).toContainText('Integração');
  await expect(page.locator('mjx-container').first()).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Baixar notebook Jupyter (.ipynb)' }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Salvar PDF', exact: false }),
  ).toBeVisible();
  const actions = page.locator('.article-actions');
  expect((await actions.boundingBox()).height).toBeLessThan(110);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  const sidebar = page.locator('.page-context');
  await expect(sidebar).toBeVisible();
  if (testInfo.project.metadata.mobile) {
    await expect(sidebar.locator('details')).not.toHaveAttribute('open');
    await sidebar.locator('summary').click();
  }
  await expect(
    sidebar.getByRole('link', { name: /Laboratório/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test('article section numbers are real text shared by headings, contents and print', async ({
  page,
}) => {
  await page.goto('/aulas/integracao/');
  const sections = [
    { id: 'metodo', text: 'Aproximando uma integral' },
    { id: 'implementacao', text: 'Implementação' },
    { id: 'verificacao', text: 'Um caso verificável' },
    { id: 'exercicios', text: 'Exercícios' },
  ];
  const numbers = page.locator('.article-body h2 > .document-heading-number');
  await expect(numbers).toHaveText(['1', '2', '3', '4']);
  await expect(page.locator('h1 .document-heading-number')).toHaveCount(0);
  const context = page.locator('.context-navigation');
  if ((await context.getAttribute('open')) === null)
    await context.locator(':scope > summary').click();
  const contents = context.getByRole('navigation', {
    name: 'Sumário da página',
    exact: true,
  });
  for (const [index, section] of sections.entries()) {
    const label = `${index + 1} ${section.text}`;
    await expect(page.locator(`.article-body h2#${section.id}`)).toContainText(
      label,
    );
    await expect(
      contents.getByRole('link', { name: label, exact: true }),
    ).toHaveAttribute('href', `#${section.id}`);
  }
  await contents
    .getByRole('link', { name: '4 Exercícios', exact: true })
    .click();
  await expect(page).toHaveURL(/#exercicios$/);
  await expect(page.locator('.article-body h2#exercicios')).toBeInViewport();
  await page.emulateMedia({ media: 'print' });
  await expect(numbers).toHaveText(['1', '2', '3', '4']);
  for (const number of await numbers.all()) await expect(number).toBeVisible();
  // The exported text contains the numbers; CSS-generated content cannot be
  // the sole source, or add a second numbering layer during printing.
  const generated = await page
    .locator('.article-body h2, .document-heading-number')
    .evaluateAll((elements) =>
      elements.flatMap((element) =>
        ['::before', '::after'].map(
          (pseudo) => getComputedStyle(element, pseudo).content,
        ),
      ),
    );
  expect(
    generated.every((content) => ['none', 'normal', '""'].includes(content)),
  ).toBe(true);
});

test('both article sources download as valid notebooks and saved notebooks remain unchanged', async ({
  page,
  request,
}) => {
  for (const route of ['integracao', 'laboratorio']) {
    await page.goto(`/aulas/${route}/`);
    const link = page.getByRole('link', {
      name: 'Baixar notebook Jupyter (.ipynb)',
    });
    const path = await link.getAttribute('href');
    const response = await request.get(path);
    expect(response.ok()).toBe(true);
    const text = await response.text();
    const notebook = JSON.parse(text);
    expect(notebook.nbformat).toBe(4);
    expect(notebook.cells.some((cell) => cell.cell_type === 'code')).toBe(true);
    if (route === 'laboratorio')
      expect(text).toBe(
        await readFile(
          'examples/course/content/notebooks/trapezoid.ipynb',
          'utf8',
        ),
      );
    const downloaded = page.waitForEvent('download');
    await link.click();
    expect((await downloaded).suggestedFilename()).toMatch(/\.ipynb$/);
  }
});

test('PDF action prepares charts, hides navigation and uses a legible light print layout', async ({
  page,
}, testInfo) => {
  await page.goto('/aulas/integracao/');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
    window.__printed = false;
    window.print = () => {
      window.dispatchEvent(new Event('beforeprint'));
      window.__printed = true;
    };
  });
  await page.getByRole('button', { name: 'Salvar PDF', exact: false }).click();
  await expect
    .poll(() => page.evaluate(() => window.__printed), { timeout: 20000 })
    .toBe(true);
  await expect(page.locator('.sciastro-plot')).toHaveAttribute(
    'data-print-ready',
    'true',
  );
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.article-actions')).not.toBeVisible();
  await expect(page.locator('.page-context')).not.toBeVisible();
  await expect(page.locator('.plotly-print')).toBeVisible();
  await expect(page.locator('.plotly-canvas')).not.toBeVisible();
  expect(
    await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
  ).toBe('rgb(255, 255, 255)');
  if (!testInfo.project.metadata.mobile) {
    const pdf = await page.pdf({
      path: testInfo.outputPath('course-lesson.pdf'),
      format: 'A4',
      printBackground: true,
    });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(10000);
  }
});

test('Plotly is local, responsive, interactive and supports theme changes', async ({
  page,
}) => {
  const external = [];
  page.on('request', (request) => {
    if (
      !request.url().startsWith(test.info().project.use.baseURL) &&
      /^https?:/.test(request.url())
    )
      external.push(request.url());
  });
  await page.goto('/aulas/integracao/');
  const figure = page.locator('.sciastro-plot');
  await expect(figure).toHaveAttribute('data-plot-ready', 'true', {
    timeout: 20000,
  });
  await expect(figure.locator('.scatterlayer .trace')).toHaveCount(2);
  const canvas = figure.locator('.plotly-canvas');
  await expect(canvas).toBeVisible();
  await figure.locator('.legendtoggle').first().click();
  await expect
    .poll(() => canvas.evaluate((element) => element.data[0].visible))
    .toBe('legendonly');
  await page.evaluate(() => {
    document.documentElement.dataset.theme = 'dark';
  });
  await expect
    .poll(() => canvas.evaluate((element) => element.layout.paper_bgcolor))
    .not.toBe('#ffffff');
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  expect(external).toEqual([]);
});

test('plain pages do not load the Plotly runtime and exports have a no-JavaScript fallback', async ({
  browser,
  page,
}, testInfo) => {
  const scripts = [];
  page.on('request', (request) => {
    if (request.resourceType() === 'script') scripts.push(request.url());
  });
  await page.goto('/');
  expect(scripts.some((url) => /plotly\.min/.test(url))).toBe(false);
  await expect(page.locator('.article-actions')).toHaveCount(0);
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
  });
  try {
    const plain = await context.newPage();
    await plain.goto(`${testInfo.project.use.baseURL}/aulas/integracao/`);
    await expect(
      plain.getByRole('link', { name: 'Baixar notebook Jupyter (.ipynb)' }),
    ).toBeVisible();
    await expect(plain.locator('[data-sciastro-print]')).not.toBeVisible();
    await expect(plain.locator('.article-print-help')).toBeVisible();
    await expect(plain.locator('mjx-container').first()).toBeVisible();
  } finally {
    await context.close();
  }
});

test('Plotly follows the system theme without losing trace visibility', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/aulas/integracao/');
  const chart = page.locator('.sciastro-plot');
  await expect(chart).toHaveAttribute('data-plot-ready', 'true', {
    timeout: 20000,
  });
  const canvas = chart.locator('.plotly-canvas');
  await chart.locator('.legendtoggle').first().click();
  await expect
    .poll(() => canvas.evaluate((element) => element.data[0].visible))
    .toBe('legendonly');
  const light = await canvas.evaluate(
    (element) => element.layout.paper_bgcolor,
  );
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect
    .poll(() => canvas.evaluate((element) => element.layout.paper_bgcolor))
    .not.toBe(light);
  await expect
    .poll(() => canvas.evaluate((element) => element.data[0].visible))
    .toBe('legendonly');
});
