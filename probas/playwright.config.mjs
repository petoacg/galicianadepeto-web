import {defineConfig, devices} from '@playwright/test';
export default defineConfig({
  testDir: '.', // En paralelo: el Chrome 157 del Mac se cierra solo a los 30 s de abrirlo Playwright, hasta en blanco.
  fullyParallel: true, timeout: 30000, forbidOnly: true, reporter: 'list',
  use: {...devices['Pixel 7'], locale: 'gl-ES', channel: process.env.GDP_CHANNEL || undefined},
});
