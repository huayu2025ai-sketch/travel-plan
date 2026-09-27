import { describe, expect, it } from 'vitest';
import { JSDOM } from 'jsdom';
import { publicPaths, renderPage, robots, sitemap, siteOrigin } from '../../site/render.js';
import { templates, createTemplatePlan } from '../../src/content/templates.js';
import { normalizeImportedPlan } from '../../src/utils/plan-normalize.js';
import { getTemplateStart } from '../../src/utils/template-start.js';

describe('public SEO pages', () => {
  it('serves complete unique content and canonical URLs without executing JavaScript', () => {
    const titles = new Set();
    for (const path of publicPaths) {
      const { document } = new JSDOM(renderPage(path)).window;
      expect(document.querySelectorAll('h1')).toHaveLength(1);
      expect(document.querySelector('main').textContent.length).toBeGreaterThan(200);
      expect(document.querySelector('link[rel="canonical"]').href).toBe(siteOrigin + path);
      expect(document.querySelector('meta[name="description"]').content.length).toBeGreaterThan(20);
      expect(document.querySelector('meta[name="robots"]')).toBeNull();
      expect(JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)[0].url).toBe(siteOrigin + path);
      titles.add(document.title);
      for (const anchor of document.querySelectorAll('a[href^="/"]')) {
        const target = new URL(anchor.getAttribute('href'), siteOrigin);
        expect([...publicPaths, '/app/']).toContain(target.pathname);
        if (target.searchParams.has('template')) expect(templates.some((t) => t.slug === target.searchParams.get('template'))).toBe(true);
      }
    }
    expect(titles.size).toBe(publicPaths.length);
  });

  it('lists only public canonical pages in the sitemap and keeps 404 out of search', () => {
    const xml = new JSDOM(sitemap(), { contentType: 'text/xml' }).window.document;
    expect([...xml.querySelectorAll('loc')].map((node) => node.textContent)).toEqual(publicPaths.map((path) => siteOrigin + path));
    expect(sitemap()).not.toContain('/app/');
    expect(robots()).toContain(`${siteOrigin}/sitemap.xml`);
    // The noindex on /app/ must remain crawlable to be seen by crawlers.
    expect(robots()).not.toContain('Disallow: /app');
    const missing = new JSDOM(renderPage('/does-not-exist')).window.document;
    expect(missing.querySelector('meta[name="robots"]').content).toContain('noindex');
    expect(missing.querySelector('link[rel="canonical"]')).toBeNull();
  });
});

describe('template data and entry safety', () => {
  it('creates editable independent plans with unknown costs and no stale dates or weather', () => {
    for (const template of templates) {
      const plan = normalizeImportedPlan(createTemplatePlan(template));
      expect(Object.keys(plan.itinerary)).toHaveLength(template.days.length);
      expect(plan.total_budget_estimate).toContain('待估算');
      expect(plan.start_date).toBe('');
      expect(plan.weather_context).toBeNull();
      plan.itinerary['Day 1'][0].title = '个人修改';
      expect(createTemplatePlan(template).itinerary['Day 1'][0].title).not.toBe('个人修改');
    }
  });

  it('does not replace saved work for a pending or invalid template', () => {
    const stored = createTemplatePlan(templates[0]);
    const pending = getTemplateStart('?template=hangzhou-2-days', stored, false);
    expect(pending.plan).toBe(stored);
    expect(pending.applied).toBe(false);
    expect(pending.template.slug).toBe('hangzhou-2-days');
    const invalid = getTemplateStart('?template=nonexistent', stored, true);
    expect(invalid.plan).toBe(stored);
    expect(invalid.invalid).toBe(true);
  });
});
