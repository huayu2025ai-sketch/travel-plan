import 'dotenv/config';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { generateTravelPlan } from './server/deepseek.js';
import {
  checkGenerateRateLimit,
  createRateLimitError,
  logApiError,
  maxRequestBodyBytes,
  toPublicApiError,
  validateGenerateRequest,
} from './server/request-guard.js';

export default defineConfig({
  plugins: [react(), travelApiPlugin()],
  server: {
    port: 3000,
    strictPort: true,
  },
});

function travelApiPlugin() {
  return {
    name: 'travel-api',
    configureServer(server) {
      server.middlewares.use('/api/health', (_req, res) => {
        sendJson(res, 200, { ok: true, hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY) });
      });

      server.middlewares.use('/api/generate', async (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { error: 'Method Not Allowed' });
          return;
        }

        try {
          const rateLimit = checkGenerateRateLimit(req);
          if (!rateLimit.allowed) {
            throw createRateLimitError(rateLimit.retryAfterSeconds);
          }

          const body = validateGenerateRequest(await readJsonBody(req));
          const plan = await generateTravelPlan(body.idea, {
            currentPlan: body.currentPlan,
            history: body.history,
          });
          sendJson(res, 200, plan);
        } catch (error) {
          if (error.retryAfterSeconds) {
            res.setHeader('Retry-After', String(error.retryAfterSeconds));
          }
          logApiError('vite/api/generate', error);
          const publicError = toPublicApiError(error);
          sendJson(res, publicError.status, publicError.body);
        }
      });
    },
  };
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let settled = false;

    req.on('data', (chunk) => {
      if (settled) return;
      raw += chunk;
      if (Buffer.byteLength(raw, 'utf8') > maxRequestBodyBytes) {
        settled = true;
        req.resume();
        const error = new Error('请求内容过大，请精简旅行想法或行程上下文。');
        error.status = 413;
        reject(error);
      }
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        const error = new Error('请求 JSON 格式不正确。');
        error.status = 400;
        reject(error);
      }
    });

    req.on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  });
}
