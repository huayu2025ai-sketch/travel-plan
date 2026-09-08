export const typeStyles = {
  交通: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-400',
  景点: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400',
  citywalk: 'border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-900 dark:bg-lime-950/40 dark:text-lime-400',
  美食: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400',
  酒店: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-400',
  娱乐: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-400',
  工作: 'border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-400',
};

export const typeAccent = {
  交通: 'bg-sky-500',
  景点: 'bg-emerald-500',
  citywalk: 'bg-lime-500',
  美食: 'bg-amber-500',
  酒店: 'bg-violet-500',
  娱乐: 'bg-rose-500',
  工作: 'bg-cyan-500',
};

export const typeOptions = ['交通', '景点', 'citywalk', '美食', '酒店', '娱乐', '工作'];
export const packingCategories = ['证件', '衣物', '洗护', '电子', '药品', '其他'];

export function getTypeBadgeClass(type) {
  return typeStyles[type] || 'border-stone-200 bg-stone-50 text-stone-700 dark:border-[#3a3630] dark:bg-[#252320] dark:text-[#b5afa6]';
}

export function getCardGlowClass(type) {
  const glowMap = {
    交通: 'card-glow card-glow-accent-sky',
    景点: 'card-glow card-glow-accent-emerald',
    citywalk: 'card-glow card-glow-accent-lime',
    美食: 'card-glow card-glow-accent-amber',
    酒店: 'card-glow card-glow-accent-violet',
    娱乐: 'card-glow card-glow-accent-rose',
  };
  return glowMap[type] || 'card-glow';
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

export function createEmptyPackingForm() {
  return {
    name: '',
    category: '其他',
    quantity: '1',
    note: '',
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
  const text = String(value || '').trim();
  if (!text) return null;
  if (text.includes('免费')) return 0;

  const match = text.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

export function formatCostAmount(value) {
  const amount = parseCostAmount(value);
  if (amount === null) return '待估算';
  return `${Math.max(0, Math.round(amount))}元`;
}

export function getCostInputValue(value) {
  const amount = parseCostAmount(value);
  return amount === null ? '' : String(Math.max(0, Math.round(amount)));
}

export function getAllItems(itinerary) {
  return Object.values(itinerary).flat();
}

export function getBudgetRange(itinerary) {
  const total = getAllItems(itinerary).reduce((sum, item) => {
    const amount = parseCostAmount(item.cost);
    return sum + (amount || 0);
  }, 0);
  const lower = Math.floor(total / 1000) * 1000;
  const upper = lower + 1000;

  return `${lower}-${upper}元`;
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
