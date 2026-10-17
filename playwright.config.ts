import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: false, workers: 1,
  reporter: 'list', outputDir: 'test-results/browser',
  use: { browserName: 'chromium', viewport: { width: 360, height: 800 }, trace: 'retain-on-failure' },
  // Browser tests mount the actual compiled island with mocked HTTP responses.
  // No persistent dev server, Neon account or paid hosting is required.
});
