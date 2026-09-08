import 'dotenv/config';
import express from 'express';
import { handleGenerateRequest } from './generate-handler.js';
import { logApiError, toPublicApiError } from './request-guard.js';

const app = express();
const port = Number(process.env.API_PORT || 8787);

app.post('/api/generate', (req, res) => {
  handleGenerateRequest(req, res, { scope: 'server/api/generate' });
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY) });
});

app.use((error, _req, res, _next) => {
  logApiError('server', error);
  const publicError = toPublicApiError(error);
  res.status(publicError.status).json(publicError.body);
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Travel plan API listening on http://localhost:${port}`);
});
