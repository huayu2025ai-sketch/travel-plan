export const maxRequestBodyBytes = 1024 * 1024;
export const maxIdeaCharacters = 2000;
export const maxHistoryItems = 8;
export const maxHistoryContentCharacters = 800;
export const maxItineraryDays = 16;
export const maxItineraryItems = 200;

const rateLimitWindowMs = 10 * 60 * 1000;
const rateLimitMaxRequests = 5;
const rateLimitBuckets = new Map();
const pendingGenerateRequests = new Map();

export function validateGenerateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createPublicError('请求格式不正确。', 400);
  }

  if (typeof body.idea !== 'string') {
    throw createPublicError('旅行想法格式不正确。', 400);
  }
  const idea = body.idea.trim().slice(0, maxIdeaCharacters);
  if (!idea) {
    throw createPublicError('请输入旅行想法。', 400);
  }

  let currentPlan = body.currentPlan == null ? null : body.currentPlan;
  if (currentPlan !== null) {
    if (typeof currentPlan !== 'object' || Array.isArray(currentPlan)) {
      throw createPublicError('当前行程格式不正确。', 400);
    }
    currentPlan = clampCurrentPlan(currentPlan);
  }

  const rawHistory = body.history == null ? [] : body.history;
  if (!Array.isArray(rawHistory)) {
    throw createPublicError('沟通记录格式不正确。', 400);
  }
  const history = rawHistory.slice(-maxHistoryItems).map((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.content !== 'string') {
      throw createPublicError('沟通记录格式不正确。', 400);
    }
    return {
      role: typeof item.role === 'string' && item.role ? item.role.slice(0, 32) : 'user',
      content: item.content.slice(0, maxHistoryContentCharacters),
    };
  });

  return { idea, currentPlan, history };
}

// 配额先为运行中的生成请求预留，成功后计入窗口，失败时释放预留。
export function checkGenerateRateLimit(request) {
  const now = Date.now();
  const key = getClientKey(request);
  const existing = rateLimitBuckets.get(key) || [];
  const recent = existing.filter((timestamp) => now - timestamp < rateLimitWindowMs);

  const pending = pendingGenerateRequests.get(key) || 0;
  if (recent.length + pending >= rateLimitMaxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: recent.length
        ? Math.max(1, Math.ceil((rateLimitWindowMs - (now - recent[0])) / 1000))
        : 1,
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

// Reserve a slot before awaiting the upstream AI service, so simultaneous requests
// cannot all pass the same check. Failed requests release their reservation.
export function reserveGenerateRequest(request) {
  const key = getClientKey(request);
  const check = checkGenerateRateLimit(request);
  if (!check.allowed) return { ...check, commit() {}, release() {} };

  pendingGenerateRequests.set(key, (pendingGenerateRequests.get(key) || 0) + 1);
  let settled = false;
  const settle = (successful) => {
    if (settled) return;
    settled = true;
    const pending = pendingGenerateRequests.get(key) || 0;
    if (pending <= 1) pendingGenerateRequests.delete(key);
    else pendingGenerateRequests.set(key, pending - 1);
    if (successful) recordGenerateHit(request);
  };

  return { allowed: true, retryAfterSeconds: 0, commit: () => settle(true), release: () => settle(false) };
}

export function recordGenerateHit(request) {
  const now = Date.now();
  const key = getClientKey(request);
  const existing = rateLimitBuckets.get(key) || [];
  const recent = existing.filter((timestamp) => now - timestamp < rateLimitWindowMs);
  recent.push(now);
  rateLimitBuckets.set(key, recent);

  if (rateLimitBuckets.size >= 1024) {
    pruneRateLimitBuckets(now);
  }
}

export function resetGenerateLimitsForTests() {
  rateLimitBuckets.clear();
  pendingGenerateRequests.clear();
}

export function createRateLimitError(retryAfterSeconds) {
  return createPublicError('请求过于频繁，请稍后再试。', 429, { retryAfterSeconds });
}

export function createPublicError(message, status, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  Object.assign(error, extra);
  return error;
}

export function toPublicApiError(error, fallback = '生成行程失败，请稍后重试。') {
  const status = Number(error?.status);
  const hasSafeStatus = Number.isInteger(status) && status >= 400 && status <= 599;
  const message = error?.expose === true && typeof error?.message === 'string' && error.message.length <= 200 ? error.message : fallback;

  return {
    status: hasSafeStatus ? status : 500,
    body: { error: message },
  };
}

export function logApiError(scope, error) {
  const status = Number(error?.status) || 500;
  const detail = typeof error?.detail === 'string' && error.detail ? ` detail=${error.detail.slice(0, 500).replace(/\s+/g, ' ')}` : '';
  console.error(`[${scope}] status=${status} message=${String(error?.message || 'unknown error')}${detail}`);
}

function clampCurrentPlan(currentPlan) {
  const itinerary = currentPlan.itinerary;
  if (itinerary == null) return currentPlan;
  if (typeof itinerary !== 'object' || Array.isArray(itinerary)) {
    throw createPublicError('当前行程格式不正确。', 400);
  }

  const clampedItinerary = {};
  let remainingItems = maxItineraryItems;
  for (const [day, items] of Object.entries(itinerary).slice(0, maxItineraryDays)) {
    if (!Array.isArray(items)) {
      clampedItinerary[day] = items;
      continue;
    }
    const clampedItems = items.slice(0, Math.max(0, remainingItems));
    remainingItems -= clampedItems.length;
    clampedItinerary[day] = clampedItems;
  }

  return { ...currentPlan, itinerary: clampedItinerary };
}

function getClientKey(request) {
  const socketAddress = request?.socket?.remoteAddress || request?.ip || 'unknown';

  if (!isTrustedProxyEnabled()) {
    return String(socketAddress).slice(0, 128);
  }

  const forwardedFor = request?.headers?.['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor || '').split(',')[0].trim();
  const realIp = Array.isArray(request?.headers?.['x-real-ip'])
    ? request.headers['x-real-ip'][0]
    : String(request?.headers?.['x-real-ip'] || '').trim();
  return String(realIp || forwardedIp || socketAddress).slice(0, 128);
}

// 只有在确认前面是不可伪造客户端头的反向代理时才开启（Docker 部署里前端 Nginx
// 会用 $remote_addr 覆写这些头）。直连暴露时保持关闭，否则限流可被伪造头绕过。
function isTrustedProxyEnabled() {
  // Vercel overwrites X-Forwarded-For at its edge, so it is a trusted source
  // even when TRUST_PROXY is unset (or explicitly disabled for custom proxies).
  if (process.env.VERCEL === '1') return true;

  const value = process.env.TRUST_PROXY;
  return value === '1' || value === 'true';
}

function pruneRateLimitBuckets(now) {
  for (const [key, timestamps] of rateLimitBuckets) {
    const recent = timestamps.filter((timestamp) => now - timestamp < rateLimitWindowMs);
    if (recent.length === 0) rateLimitBuckets.delete(key);
    else rateLimitBuckets.set(key, recent);
  }

  const maxBuckets = 10000;
  while (rateLimitBuckets.size > maxBuckets) {
    const oldestKey = rateLimitBuckets.keys().next().value;
    rateLimitBuckets.delete(oldestKey);
  }
}
