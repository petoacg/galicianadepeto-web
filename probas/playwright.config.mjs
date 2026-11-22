import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir: '.', timeout: 30000, forbidOnly: true, reporter: 'list',
  use: {...devices['Pixel 7'], locale: 'gl-ES', channel: process.env.GDP_CHANNEL || undefined},
});
