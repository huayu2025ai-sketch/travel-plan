import 'dotenv/config';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { generateTravelPlan } from './server/deepseek.js';

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
          const body = await readJsonBody(req);
          const plan = await generateTravelPlan(body.idea, {
            currentPlan: body.currentPlan,
            history: body.history,
          });
          sendJson(res, 200, plan);
        } catch (error) {
          sendJson(res, error.status || 500, {
            error: error.message || '生成行程失败，请稍后重试。',
            detail: error.detail,
          });
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

    req.on('data', (chunk) => {
      raw += chunk;
    });

    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        const error = new Error('请求 JSON 格式不正确。');
        error.status = 400;
        reject(error);
      }
    });

    req.on('error', reject);
  });
}
