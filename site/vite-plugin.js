import { readFile } from 'node:fs/promises';
import { publicPaths, renderPage, robots, sitemap } from './render.js';

const routes = new Set([...publicPaths, '/app/']);
export function publicSitePlugin() {
  function middleware(server, preview = false) {
    return async (req, res, next) => {
      const url = new URL(req.url, 'http://localhost');
      const path = url.pathname;
      // Leave API requests, Vite modules and static assets to their own handlers.
      if (path.startsWith('/api/') || path.startsWith('/@') || path.startsWith('/src/') || path.startsWith('/node_modules/') || path.startsWith('/assets/')) return next();
      if (path === '/index.html' || path === '/app/index.html' || (!path.endsWith('/') && routes.has(path + '/'))) {
        const target = path === '/index.html' ? '/' : path === '/app/index.html' ? '/app/' : path + '/';
        res.writeHead(308, { Location: target + url.search });
        return res.end();
      }
      let body;
      let status = 200;
      let type = 'text/html; charset=utf-8';
      if (path === '/robots.txt') { body = robots(); type = 'text/plain; charset=utf-8'; }
      else if (path === '/sitemap.xml') { body = sitemap(); type = 'application/xml; charset=utf-8'; }
      else if (publicPaths.includes(path)) body = renderPage(path);
      else if (path === '/app/') {
        if (preview) return next();
        try { body = await server.transformIndexHtml('/app/', await readFile(new URL('../index.html', import.meta.url), 'utf8')); }
        catch (error) { return next(error); }
      } else if (path === '/404.html' || req.headers.accept?.includes('text/html') || !path.split('/').pop().includes('.')) {
        status = 404; body = renderPage('/404.html');
      } else return next();
      res.writeHead(status, { 'Content-Type': type });
      res.end(body);
    };
  }
  return {
    name: 'public-travel-site',
    configureServer(server) { server.middlewares.use(middleware(server)); },
    configurePreviewServer(server) { server.middlewares.use(middleware(server, true)); },
  };
}
