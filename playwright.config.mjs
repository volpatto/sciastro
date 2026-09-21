import { defineConfig } from '@playwright/test';

// Test the generated static sites, on ports separate from the user's previews.
const sites = [
  { kind: 'group', port: 4360 },
  { kind: 'individual', port: 4361 },
  { kind: 'lncc', port: 4362 },
];

export default defineConfig({
  testDir: './tests/browser',
  testMatch: '**/*.spec.mjs',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 2,
  timeout: 30_000,
  expect: { timeout: 5_000 },
  outputDir: '.test-output/browser',
  reporter: [
    ['list'],
    ['html', { outputFolder: '.test-output/playwright-report', open: 'never' }],
    ['junit', { outputFile: '.test-output/junit.xml' }],
  ],
  use: {
    browserName: 'chromium',
    colorScheme: 'light',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: sites.flatMap(({ kind, port }) =>
    [
      { label: 'desktop', width: 1280, height: 800 },
      { label: 'mobile', width: 390, height: 844 },
    ].map(({ label, width, height }) => ({
      name: `${kind}-${label}`,
      testMatch: kind === 'lncc' ? '**/lncc.spec.mjs' : '**/site.spec.mjs',
      metadata: { kind, mobile: label === 'mobile' },
      use: { baseURL: `http://127.0.0.1:${port}`, viewport: { width, height } },
    })),
  ),
  webServer: sites.map(({ kind, port }) => ({
    command: `node tests/browser/server.mjs ${kind} ${port}`,
    url: `http://127.0.0.1:${port}/`,
    timeout: 20_000,
    reuseExistingServer: false,
  })),
});
