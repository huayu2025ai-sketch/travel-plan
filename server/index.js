import 'dotenv/config';
import express from 'express';
import { generateTravelPlan } from './deepseek.js';
import {
  checkGenerateRateLimit,
  createRateLimitError,
  logApiError,
  maxRequestBodyBytes,
  toPublicApiError,
  validateGenerateRequest,
} from './request-guard.js';

const app = express();
const port = Number(process.env.API_PORT || 8787);

app.use(express.json({ limit: maxRequestBodyBytes }));

app.post('/api/generate', async (req, res) => {
  try {
    const rateLimit = checkGenerateRateLimit(req);
    if (!rateLimit.allowed) {
      throw createRateLimitError(rateLimit.retryAfterSeconds);
    }

    const body = validateGenerateRequest(req.body);
    const plan = await generateTravelPlan(body.idea, {
      currentPlan: body.currentPlan,
      history: body.history,
    });
    res.json(plan);
  } catch (error) {
    if (error.retryAfterSeconds) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }
    logApiError('server/api/generate', error);
    const publicError = toPublicApiError(error);
    res.status(publicError.status).json(publicError.body);
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY) });
});

app.use((error, _req, res, _next) => {
  if (error?.type === 'entity.too.large') {
    res.status(413).json({ error: '请求内容过大，请精简旅行想法或行程上下文。' });
    return;
  }

  if (error instanceof SyntaxError && error.status === 400) {
    res.status(400).json({ error: '请求 JSON 格式不正确。' });
    return;
  }

  logApiError('server', error);
  const publicError = toPublicApiError(error);
  res.status(publicError.status).json(publicError.body);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Travel plan API listening on http://localhost:${port}`);
});
