// Las mismas pruebas en WebKit (el motor de Safari en iPhone). En WebKit, Playwright no intercepta lo que
// pide el service worker, así que sólo las pruebas del service worker lo llevan activo.
import {defineConfig, devices} from '@playwright/test';
const conSW = /primera carga no trae|abre sin conexión|abre aunque la red|versión nueva|no está guardada entera|falta un trozo|se abren sin conexión/;
const use = {...devices['iPhone 15'], locale: 'gl-ES'};
export default defineConfig({testDir: '.', fullyParallel: true, timeout: 30000, reporter: 'list', workers: 4,
  projects: [
    {name: 'webkit', use: {...use, serviceWorkers: 'block'}, grepInvert: conSW},
    {name: 'webkit-sw', use, grep: conSW},
  ]});
