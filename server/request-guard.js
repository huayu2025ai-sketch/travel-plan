export const maxRequestBodyBytes = 256 * 1024;
export const maxIdeaCharacters = 2000;
export const maxHistoryItems = 8;
export const maxHistoryContentCharacters = 800;
export const maxCurrentPlanBytes = 128 * 1024;
export const maxItineraryDays = 16;
export const maxItineraryItems = 200;

const rateLimitWindowMs = 10 * 60 * 1000;
const rateLimitMaxRequests = 5;
const rateLimitBuckets = new Map();

export function validateGenerateRequest(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw createRequestError('请求格式不正确。', 400);
  }

  const serializedBody = JSON.stringify(body);
  if (getUtf8ByteLength(serializedBody) > maxRequestBodyBytes) {
    throw createRequestError('请求内容过大，请精简旅行想法或行程上下文。', 413);
  }

  if (typeof body.idea !== 'string') {
    throw createRequestError('旅行想法格式不正确。', 400);
  }

  const idea = body.idea.trim();
  if (!idea) {
    throw createRequestError('请输入旅行想法。', 400);
  }
  if (idea.length > maxIdeaCharacters) {
    throw createRequestError(`旅行想法不能超过 ${maxIdeaCharacters} 个字符。`, 413);
  }

  const currentPlan = body.currentPlan == null ? null : body.currentPlan;
  if (currentPlan !== null) {
    if (typeof currentPlan !== 'object' || Array.isArray(currentPlan)) {
      throw createRequestError('当前行程格式不正确。', 400);
    }
    if (getUtf8ByteLength(JSON.stringify(currentPlan)) > maxCurrentPlanBytes) {
      throw createRequestError('当前行程内容过大，请先精简行程后再优化。', 413);
    }
    validateCurrentPlanSize(currentPlan);
  }

  const history = body.history == null ? [] : body.history;
  if (!Array.isArray(history)) {
    throw createRequestError('沟通记录格式不正确。', 400);
  }
  if (history.length > maxHistoryItems) {
    throw createRequestError(`沟通记录不能超过 ${maxHistoryItems} 条。`, 413);
  }
  history.forEach((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item) || typeof item.content !== 'string') {
      throw createRequestError('沟通记录格式不正确。', 400);
    }
    if (item.content.length > maxHistoryContentCharacters) {
      throw createRequestError(`每条沟通记录不能超过 ${maxHistoryContentCharacters} 个字符。`, 413);
    }
  });

  return { idea, currentPlan, history };
}

export function checkGenerateRateLimit(request) {
  const now = Date.now();
  const key = getClientKey(request);
  const existing = rateLimitBuckets.get(key) || [];
  const recent = existing.filter((timestamp) => now - timestamp < rateLimitWindowMs);

  if (recent.length >= rateLimitMaxRequests) {
    rateLimitBuckets.set(key, recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((rateLimitWindowMs - (now - recent[0])) / 1000)),
    };
  }

  recent.push(now);
  rateLimitBuckets.set(key, recent);
  pruneRateLimitBuckets(now);
  return { allowed: true, retryAfterSeconds: 0 };
}

export function createRateLimitError(retryAfterSeconds) {
  return createRequestError('请求过于频繁，请稍后再试。', 429, { retryAfterSeconds });
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
  console.error(`[${scope}] status=${status} message=${String(error?.message || 'unknown error')}`);
}

function validateCurrentPlanSize(currentPlan) {
  const itinerary = currentPlan.itinerary;
  if (itinerary == null) return;
  if (typeof itinerary !== 'object' || Array.isArray(itinerary)) {
    throw createRequestError('当前行程格式不正确。', 400);
  }

  const days = Object.entries(itinerary);
  if (days.length > maxItineraryDays) {
    throw createRequestError(`行程天数不能超过 ${maxItineraryDays} 天。`, 413);
  }

  const itemCount = days.reduce((count, [, items]) => count + (Array.isArray(items) ? items.length : 0), 0);
  if (itemCount > maxItineraryItems) {
    throw createRequestError(`行程卡片不能超过 ${maxItineraryItems} 项。`, 413);
  }
}

function getClientKey(request) {
  const forwardedFor = request?.headers?.['x-forwarded-for'];
  const forwardedIp = Array.isArray(forwardedFor) ? forwardedFor[0] : String(forwardedFor || '').split(',')[0].trim();
  const realIp = Array.isArray(request?.headers?.['x-real-ip'])
    ? request.headers['x-real-ip'][0]
    : String(request?.headers?.['x-real-ip'] || '').trim();
  const ip = realIp || forwardedIp || request?.ip || request?.socket?.remoteAddress || 'unknown';
  return String(ip).slice(0, 128);
}

function pruneRateLimitBuckets(now) {
  if (rateLimitBuckets.size < 10000) return;

  for (const [key, timestamps] of rateLimitBuckets) {
    const recent = timestamps.filter((timestamp) => now - timestamp < rateLimitWindowMs);
    if (recent.length === 0) rateLimitBuckets.delete(key);
    else rateLimitBuckets.set(key, recent);
  }
}

function getUtf8ByteLength(value) {
  return new TextEncoder().encode(value).length;
}

function createRequestError(message, status, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.expose = true;
  Object.assign(error, extra);
  return error;
}
