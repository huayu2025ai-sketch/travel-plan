import { generateTravelPlan } from '../server/deepseek.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
    const plan = await generateTravelPlan(body.idea);

    res.status(200).json(plan);
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || '生成行程失败，请稍后重试。',
      detail: error.detail,
    });
  }
}
