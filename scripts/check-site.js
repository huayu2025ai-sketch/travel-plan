import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { publicPaths, siteOrigin } from '../site/render.js';

for (const path of publicPaths) {
  const html = await readFile(`dist${path}index.html`, 'utf8');
  const doc = new JSDOM(html).window.document;
  assert.equal(doc.querySelector('link[rel="canonical"]').href, siteOrigin + path);
  assert.equal(doc.querySelectorAll('h1').length, 1);
  assert(doc.querySelector('main').textContent.length > 200);
  for (const node of doc.querySelectorAll('a[href^="/"], link[href^="/"], script[src^="/"]')) {
    const url = new URL(node.getAttribute('href') || node.getAttribute('src'), siteOrigin);
    await stat(`dist${url.pathname}${url.pathname.endsWith('/') ? 'index.html' : ''}`);
  }
}
const app = new JSDOM(await readFile('dist/app/index.html', 'utf8')).window.document;
assert.equal(app.querySelector('meta[name="robots"]').content, 'noindex,follow');
for (const script of app.querySelectorAll('script[src^="/"]')) await stat(`dist${script.getAttribute('src')}`);
for (const file of ['404.html', 'sitemap.xml', 'robots.txt', 'social-card.png']) await stat(`dist/${file}`);
console.log(`Verified ${publicPaths.length} built public pages, local links, app assets and SEO files.`);
