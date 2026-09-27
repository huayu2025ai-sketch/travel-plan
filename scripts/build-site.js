import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { publicPaths, renderPage, robots, sitemap } from '../site/render.js';

const appHtml = await readFile('dist/index.html', 'utf8');
await mkdir('dist/app', { recursive: true });
await writeFile('dist/app/index.html', appHtml);
for (const path of publicPaths) {
  const directory = `dist${path}`;
  await mkdir(directory, { recursive: true });
  await writeFile(`${directory}index.html`, renderPage(path));
}
await writeFile('dist/404.html', renderPage('/404.html'));
await writeFile('dist/robots.txt', robots());
await writeFile('dist/sitemap.xml', sitemap());
console.log(`Generated ${publicPaths.length} public HTML pages, /app/, sitemap, robots and 404.`);
