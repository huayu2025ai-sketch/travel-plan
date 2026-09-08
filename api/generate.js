import { generateTravelPlan } from '../server/deepseek.js';
import {
  checkGenerateRateLimit,
  createRateLimitError,
  logApiError,
  toPublicApiError,
  validateGenerateRequest,
} from '../server/request-guard.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const rateLimit = checkGenerateRateLimit(req);
    if (!rateLimit.allowed) {
      throw createRateLimitError(rateLimit.retryAfterSeconds);
    }

    let rawBody;
    try {
      rawBody = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    } catch {
      const error = new Error('请求 JSON 格式不正确。');
      error.status = 400;
      throw error;
    }

    const body = validateGenerateRequest(rawBody);
    const plan = await generateTravelPlan(body.idea, {
      currentPlan: body.currentPlan,
      history: body.history,
    });

    res.status(200).json(plan);
  } catch (error) {
    if (error.retryAfterSeconds) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    logApiError('api/generate', error);
    const publicError = toPublicApiError(error);
    res.status(publicError.status).json(publicError.body);
  }
}
