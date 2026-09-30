export const typeStyles = {
  交通: 'travel-type travel-type-transport',
  景点: 'travel-type travel-type-sight',
  citywalk: 'travel-type travel-type-walk',
  美食: 'travel-type travel-type-food',
  酒店: 'travel-type travel-type-hotel',
  娱乐: 'travel-type travel-type-fun',
  工作: 'travel-type travel-type-work',
};

export const typeAccent = {
  交通: 'travel-accent travel-type-transport',
  景点: 'travel-accent travel-type-sight',
  citywalk: 'travel-accent travel-type-walk',
  美食: 'travel-accent travel-type-food',
  酒店: 'travel-accent travel-type-hotel',
  娱乐: 'travel-accent travel-type-fun',
  工作: 'travel-accent travel-type-work',
};

export const typeOptions = ['交通', '景点', 'citywalk', '美食', '酒店', '娱乐', '工作'];

export function getTypeBadgeClass(type) {
  return typeStyles[type] || 'travel-type travel-type-default';
}

export function createEmptyCardForm(day) {
  return {
    day,
    type: '景点',
    title: '',
    cost: '',
    duration: '',
    advice: '',
  };
}

export function getFuzzyMatchScore(text, query) {
  const source = String(text || '').toLowerCase();
  const target = String(query || '').trim().toLowerCase();
  if (!target) return 1;
  if (source.includes(target)) return 1;

  let targetIndex = 0;
  for (const char of source) {
    if (char === target[targetIndex]) targetIndex += 1;
    if (targetIndex === target.length) return 0.6;
  }

  return 0;
}

export function parseCostAmount(value) {
  return parseCostEstimate(value)?.min ?? null;
}

export function parseCostEstimate(value) {
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.includes('免费')) return { min: 0, max: 0, currency: 'CNY', basis: 'total' };

  const normalized = text.replace(/,/g, '').replace(/[×✕]/g, 'x');
  const multiplied = normalized.match(/(\d+(?:\.\d+)?)\s*(?:元|人民币)?\s*\/\s*(?:晚|天|人|间|张|个|次)\s*x\s*(\d+(?:\.\d+)?)/i);
  if (multiplied) {
    const total = Number(multiplied[1]) * Number(multiplied[2]);
    return { min: total, max: total, currency: 'CNY', basis: 'total' };
  }

  const range = normalized.match(/(\d+(?:\.\d+)?)\s*[-~～至到]\s*(\d+(?:\.\d+)?)/);
  const first = normalized.match(/\d+(?:\.\d+)?/);
  if (!first) return null;
  const min = range ? Number(range[1]) : Number(first[0]);
  const max = range ? Number(range[2]) : min;
  return { min: Math.min(min, max), max: Math.max(min, max), currency: 'CNY', basis: 'total' };
}

export function formatCostAmount(value) {
  const text = String(value || '').trim();
  if (!text) return '待估算';
  if (parseCostEstimate(text) === null) return text;
  return /元|免费/.test(text) ? text : `${text}元`;
}

export function getCostInputValue(value) {
  return String(value || '').replace(/待估算/g, '').trim();
}

export function getAllItems(itinerary) {
  return Object.values(itinerary).flat();
}

export function getBudgetRange(itinerary) {
  const items = getAllItems(itinerary);
  const estimates = items.map((item) => parseCostEstimate(item.cost) || item.cost_estimate).filter(Boolean);
  const unknownCount = items.length - estimates.length;
  if (!estimates.length) return unknownCount ? `待估算（${unknownCount}项）` : '0元';
  const lower = Math.round(estimates.reduce((sum, estimate) => sum + estimate.min, 0));
  const upper = Math.round(estimates.reduce((sum, estimate) => sum + estimate.max, 0));
  const range = lower === upper ? `${lower}元` : `${lower}-${upper}元`;
  return unknownCount ? `${range}（另有${unknownCount}项待估）` : range;
}

export function withComputedBudget(plan) {
  return {
    ...plan,
    destination: plan.destination || '',
    start_date: plan.start_date || '',
    total_budget_estimate: getBudgetRange(plan.itinerary),
  };
}

export function createCardEditForm(item) {
  return {
    type: item.type,
    title: item.title,
    cost: getCostInputValue(item.cost),
    duration: item.duration,
    advice: item.advice,
  };
}
