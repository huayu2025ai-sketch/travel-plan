import { generateTravelPlan } from './deepseek.js';
import {
  createPublicError,
  createRateLimitError,
  logApiError,
  maxRequestBodyBytes,
  reserveGenerateRequest,
  toPublicApiError,
  validateGenerateRequest,
} from './request-guard.js';

// 三个部署面（Express / Vercel / Vite dev）共用的 /api/generate 处理流程：
// 先读并校验 body → 预留限流配额 → 生成 → 成功结算，失败释放。
// 读取 body 放在最前，保证提前拒绝时连接已被正确消费，客户端能拿到 JSON 错误
// 而不是网络层失败。
export async function handleGenerateRequest(req, res, { scope = 'api/generate' } = {}) {
  let reservation;
  try {
    const rawBody = await readJsonBody(req);
    const body = validateGenerateRequest(rawBody);
    reservation = reserveGenerateRequest(req);
    if (!reservation.allowed) throw createRateLimitError(reservation.retryAfterSeconds);

    const plan = await generateTravelPlan(body.idea, {
      currentPlan: body.currentPlan,
      history: body.history,
    });

    reservation.commit();
    sendJson(res, 200, plan);
  } catch (error) {
    reservation?.release();
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
    ensureRequestBodySize(Buffer.byteLength(req.body));
    return parseJsonBody(req.body);
  }
  if (req.body && typeof req.body === 'object') {
    ensureRequestBodySize(Buffer.byteLength(JSON.stringify(req.body)));
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

function ensureRequestBodySize(byteLength) {
  if (byteLength > maxRequestBodyBytes) {
    throw createPublicError('请求内容过大，请精简旅行想法或行程上下文。', 413);
  }
}

function parseJsonBody(raw) {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    throw createPublicError('请求 JSON 格式不正确。', 400);
  }
}
