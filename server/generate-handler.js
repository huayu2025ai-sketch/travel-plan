import { generateTravelPlan } from './deepseek.js';
import {
  checkGenerateRateLimit,
  createPublicError,
  createRateLimitError,
  logApiError,
  maxRequestBodyBytes,
  recordGenerateHit,
  toPublicApiError,
  validateGenerateRequest,
} from './request-guard.js';

// 三个部署面（Express / Vercel / Vite dev）共用的 /api/generate 处理流程：
// 先读 body → 限流只查询 → 校验（超限内容截断）→ 生成 → 成功才计入配额。
// 读取 body 放在最前，保证提前拒绝时连接已被正确消费，客户端能拿到 JSON 错误
// 而不是网络层失败。
export async function handleGenerateRequest(req, res, { scope = 'api/generate' } = {}) {
  try {
    const rawBody = await readJsonBody(req);

    const rateLimit = checkGenerateRateLimit(req);
    if (!rateLimit.allowed) {
      throw createRateLimitError(rateLimit.retryAfterSeconds);
    }

    const body = validateGenerateRequest(rawBody);
    const plan = await generateTravelPlan(body.idea, {
      currentPlan: body.currentPlan,
      history: body.history,
    });

    recordGenerateHit(req);
    sendJson(res, 200, plan);
  } catch (error) {
    if (error?.retryAfterSeconds) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    logApiError(scope, error);
    const publicError = toPublicApiError(error);
    sendJson(res, publicError.status, publicError.body);
  }
}

export function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  if (typeof req.body === 'string') {
    return parseJsonBody(req.body);
  }
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }
  // body 为空对象但流未结束时（如中间件已消费 body 的场景），直接按空对象处理会
  // 丢失内容，因此这里只在 body 未定义时才从流读取。
  if (req.body !== undefined) {
    return {};
  }

  const chunks = [];
  let totalBytes = 0;
  let oversized = false;

  for await (const chunk of req) {
    totalBytes += chunk.length;
    if (totalBytes > maxRequestBodyBytes) {
      oversized = true;
      continue;
    }
    chunks.push(chunk);
  }

  // 先读完整个请求体再拒绝，避免连接被提前断开导致客户端拿不到 413 响应。
  if (oversized) {
    throw createPublicError('请求内容过大，请精简旅行想法或行程上下文。', 413);
  }

  return parseJsonBody(Buffer.concat(chunks).toString('utf8'));
}

function parseJsonBody(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw createPublicError('请求 JSON 格式不正确。', 400);
  }
}
