import { createTemplatePlan, getTemplate } from '../content/templates.js';
import { normalizeImportedPlan } from './plan-normalize.js';

export function getTemplateStart(search, storedPlan, canReplace) {
  const slug = new URLSearchParams(search).get('template');
  const template = slug ? getTemplate(slug) : null;
  if (!slug) return { plan: storedPlan, template: null, applied: false, invalid: false };
  if (!template) return { plan: storedPlan, template: null, applied: false, invalid: true };
  return {
    plan: canReplace ? normalizeImportedPlan(createTemplatePlan(template)) : storedPlan,
    template, applied: canReplace, invalid: false,
  };
}

export function clearTemplateParameter() {
  const url = new URL(window.location.href);
  url.searchParams.delete('template');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}
