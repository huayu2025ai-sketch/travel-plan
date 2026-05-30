const allowedTypes = new Set(['交通', '景点', 'citywalk', '美食', '酒店']);

const systemPrompt =
  "你是一个专业的旅游规划助手。请根据用户的粗略想法，生成结构化的旅游计划。你必须严格按照 JSON 格式返回数据，不要包含任何 Markdown 语法标记（如 ```json）。确保每个卡片都有唯一的 'id'，类型(type)只能在['交通', '景点', 'citywalk', '美食', '酒店']中选择。";

const schemaPrompt = `请返回如下 JSON 结构：
{
  "total_budget_estimate": "2500-3000元",
  "recommended_transport": "高铁 + 市内网约车",
  "itinerary": {
    "Day 1": [
      {
        "id": "day1-slot1",
        "type": "景点",
        "title": "龙门石窟",
        "cost": "120元",
        "duration": "3小时",
        "advice": "建议选择夜游，灯光亮起时极其震撼，避开白天高温。"
      }
    ]
  }
}
要求：
1. 根据用户输入推断合理天数，默认 5 天。
2. itinerary 的 key 必须使用 "Day 1"、"Day 2" 这种格式。
3. 每个 Day 至少返回数组，可以为空。
4. id 必须唯一，且适合拖拽组件使用。`;

export async function generateTravelPlan(idea) {
  const trimmedIdea = String(idea || '').trim();

  if (!trimmedIdea) {
    const error = new Error('请输入旅行想法。');
    error.status = 400;
    throw error;
  }

  if (!process.env.DEEPSEEK_API_KEY) {
    const error = new Error('缺少 DEEPSEEK_API_KEY，请先在 .env 或终端环境变量中配置。');
    error.status = 500;
    throw error;
  }

  const deepseekBaseUrl = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
  const response = await fetch(`${deepseekBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${schemaPrompt}\n\n用户想法：${trimmedIdea}` },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error('DeepSeek 请求失败。');
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  const parsed = JSON.parse(content);

  return normalizePlan(parsed);
}

export function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('AI 返回内容不是有效对象。');
  }

  const itinerary = plan.itinerary && typeof plan.itinerary === 'object' ? plan.itinerary : {};
  const normalizedItinerary = {};
  const seenIds = new Set();

  for (const [day, items] of Object.entries(itinerary)) {
    normalizedItinerary[day] = Array.isArray(items)
      ? items.map((item, index) => normalizeItem(item, day, index, seenIds))
      : [];
  }

  if (Object.keys(normalizedItinerary).length === 0) {
    throw new Error('AI 返回内容缺少 itinerary。');
  }

  return {
    total_budget_estimate: String(plan.total_budget_estimate || '待估算'),
    recommended_transport: String(plan.recommended_transport || '待推荐'),
    itinerary: normalizedItinerary,
  };
}

function normalizeItem(item, day, index, seenIds) {
  const fallbackId = `${day.toLowerCase().replace(/\s+/g, '-')}-slot-${index + 1}`;
  let id = String(item?.id || fallbackId).replace(/[^a-zA-Z0-9-_]/g, '-');

  while (seenIds.has(id)) {
    id = `${id}-${index + 1}`;
  }

  seenIds.add(id);

  const type = allowedTypes.has(item?.type) ? item.type : '景点';

  return {
    id,
    type,
    title: String(item?.title || '未命名行程'),
    cost: String(item?.cost || '待估算'),
    duration: String(item?.duration || '待安排'),
    advice: String(item?.advice || '暂无建议。'),
  };
}
