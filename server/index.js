import 'dotenv/config';
import express from 'express';
import { generateTravelPlan } from './deepseek.js';

const app = express();
const port = Number(process.env.API_PORT || 8787);

app.use(express.json({ limit: '1mb' }));

app.post('/api/generate', async (req, res) => {
  try {
    const plan = await generateTravelPlan(req.body?.idea);
    res.json(plan);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || '生成行程失败，请稍后重试。',
      detail: error.detail,
    });
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasDeepSeekKey: Boolean(process.env.DEEPSEEK_API_KEY) });
});

app.listen(port, () => {
  console.log(`Travel plan API listening on http://localhost:${port}`);
});
