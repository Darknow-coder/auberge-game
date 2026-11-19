// Génère les icônes PNG à partir de assets/icon.svg (Playwright requis).
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = fs.readFileSync(path.join(root, 'assets/icon.svg'), 'utf8');
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, rounded] of [['icon-512.png', 512, false], ['icon-192.png', 192, false], ['apple-touch-icon.png', 180, false]]) {
  // Fond plein (sans coins arrondis) pour les icônes « maskable » et iOS.
  const body = rounded ? svg : svg.replace('rx="112"', 'rx="0"');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${body.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(root, 'assets', name), omitBackground: true });
  console.log('✔', name);
}
await browser.close();
