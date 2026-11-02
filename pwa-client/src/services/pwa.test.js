import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manifestUrl = new URL('../../public/manifest.webmanifest', import.meta.url);

test('declares Smart Museum as a standalone installable app', async () => {
  const manifestText = await readFile(manifestUrl, 'utf8');
  const manifest = JSON.parse(manifestText);

  assert.equal((manifestText.match(/"id"\s*:/g) ?? []).length, 1);
  assert.equal(manifest.id, './');
  assert.equal(manifest.name, 'Smart Museum');
  assert.equal(manifest.short_name, 'Smart Museum');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.theme_color, '#183c34');
  assert.equal(manifest.background_color, '#f4f3ee');

  const pngIcons = manifest.icons.filter((icon) => icon.type === 'image/png');
  assert.deepEqual(
    [...new Set(pngIcons.map((icon) => icon.sizes))].sort(),
    ['192x192', '512x512'],
  );
  assert.ok(pngIcons.some((icon) => icon.purpose === 'maskable'));

  for (const icon of pngIcons) {
    const iconUrl = new URL(`../../public/${icon.src.replace('./', '')}`, import.meta.url);
    const png = await readFile(iconUrl);
    const [width, height] = [png.readUInt32BE(16), png.readUInt32BE(20)];
    assert.equal(`${width}x${height}`, icon.sizes);
  }
});

test('includes a standalone offline fallback page', async () => {
  const offlinePage = await readFile(
    new URL('../../public/offline.html', import.meta.url),
    'utf8',
  );
  assert.match(offlinePage, /You are offline/);
  assert.match(offlinePage, /not stored for offline use/);
});
