const allowedTypes = new Set(['交通', '景点', 'citywalk', '美食', '酒店', '娱乐', '工作']);

const systemPrompt =
  "你是一个专业的旅游规划助手。请根据用户的粗略想法和真实天气参考，生成结构化的旅游计划。你必须严格按照 JSON 格式返回数据，不要包含任何 Markdown 语法标记（如 ```json）。确保每个卡片都有唯一的 'id'，类型(type)只能在['交通', '景点', 'citywalk', '美食', '酒店', '娱乐', '工作']中选择。";

const extractionSystemPrompt =
  '你是一个旅游信息抽取助手。只返回 JSON，不要输出任何 Markdown 或解释。';

const schemaPrompt = `请返回如下 JSON 结构：
{
  "destination": "洛阳",
  "start_date": "2026-10-21",
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
4. id 必须唯一，且适合拖拽组件使用。
5. 如果上下文中已有当前行程草案，请把用户的新输入理解为对现有草案的优化要求，并返回优化后的完整行程 JSON，不要只返回差异。`;

const extractionSchemaPrompt = `请返回如下 JSON 结构：
{
  "destination": "洛阳",
  "start_date": "2026-10-21",
  "days": 5
}
要求：
1. destination 填写最可能的主要旅行目的地；如果无法判断，返回空字符串。
2. start_date 优先使用上下文中已有的出发日期；如果无法判断，返回空字符串。
3. days 填写预计天数，无法判断时默认 5。
4. 如果上下文中已有当前行程草案，请优先沿用草案中的目的地、日期和天数，除非用户明确修改。`;

const deepseekTimeoutMs = 60000;
const maxDeepseekAttempts = 2;

export async function generateTravelPlan(idea, context = {}) {
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
  const tripContext = await extractTripContext(trimmedIdea, context, deepseekBaseUrl);
  const weatherContext = await buildRealWeatherContext(tripContext);
  const contextPrompt = buildContextPrompt(context, weatherContext, tripContext);
  const requestOptions = {
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
        { role: 'user', content: `${schemaPrompt}${contextPrompt}\n\n用户本轮输入：${trimmedIdea}` },
      ],
    }),
  };
  const response = await requestDeepSeek(`${deepseekBaseUrl}/chat/completions`, requestOptions);

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error('DeepSeek 请求失败。');
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  let parsed;

  try {
    parsed = JSON.parse(content);
  } catch {
    const error = new Error('DeepSeek 返回的内容不是有效 JSON，请稍后重试。');
    error.status = 502;
    throw error;
  }

  return normalizePlan(parsed, weatherContext.weatherByDay, tripContext);
}

async function extractTripContext(idea, context, deepseekBaseUrl) {
  const currentPlan = context?.currentPlan && typeof context.currentPlan === 'object' ? context.currentPlan : null;
  const history = Array.isArray(context?.history) ? context.history.slice(-6) : [];

  const requestOptions = {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      response_format: { type: 'json_object' },
      temperature: 0,
      messages: [
        { role: 'system', content: extractionSystemPrompt },
        {
          role: 'user',
          content: `${extractionSchemaPrompt}${buildContextPrompt(context)}\n\n用户本轮输入：${idea}`,
        },
      ],
    }),
  };

  const response = await requestDeepSeek(`${deepseekBaseUrl}/chat/completions`, requestOptions);

  if (!response.ok) {
    const detail = await response.text();
    const error = new Error('DeepSeek 目的地抽取失败。');
    error.status = response.status;
    error.detail = detail;
    throw error;
  }

  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;

  try {
    return normalizeTripContext(JSON.parse(content), currentPlan, history);
  } catch {
    return normalizeTripContext({}, currentPlan, history);
  }
}

function buildContextPrompt(context, weatherContext = null, tripContext = null) {
  const currentPlan = context?.currentPlan && typeof context.currentPlan === 'object' ? context.currentPlan : null;
  const history = Array.isArray(context?.history) ? context.history.slice(-6) : [];
  const sections = [];

  if (currentPlan) {
    sections.push(`\n\n当前行程草案（请作为本轮优化的基础）：\n${safeJsonStringify(compactPlan(currentPlan))}`);
  }

  if (history.length > 0) {
    sections.push(`\n\n最近沟通记录：\n${safeJsonStringify(history.map(compactHistoryItem))}`);
  }

  if (tripContext?.destination || tripContext?.start_date || tripContext?.days) {
    sections.push(
      `\n\n行程抽取结果（供参考）：\n${safeJsonStringify({
        destination: tripContext.destination || '',
        start_date: tripContext.start_date || '',
        days: tripContext.days || 5,
      })}`,
    );
  }

  if (weatherContext?.summary) {
    sections.push(`\n\n真实天气参考（来自 Open-Meteo，请据此调整活动节奏，不要自己编天气）：\n${weatherContext.summary}`);
  }

  return sections.join('');
}

function normalizeTripContext(value, currentPlan, history) {
  const destination = String(value?.destination || currentPlan?.destination || '').trim();
  const start_date = String(value?.start_date || currentPlan?.start_date || '').trim();
  const days = clampDayCount(value?.days || Object.keys(currentPlan?.itinerary || {}).length || 5);

  return {
    destination,
    start_date,
    days,
    historyCount: Array.isArray(history) ? history.length : 0,
  };
}

function compactPlan(plan) {
  return {
    destination: String(plan.destination || ''),
    start_date: String(plan.start_date || ''),
    total_budget_estimate: String(plan.total_budget_estimate || ''),
    recommended_transport: String(plan.recommended_transport || ''),
    itinerary: plan.itinerary && typeof plan.itinerary === 'object' ? plan.itinerary : {},
  };
}

function compactHistoryItem(item) {
  return {
    role: String(item?.role || 'user'),
    content: String(item?.content || '').slice(0, 800),
  };
}

function safeJsonStringify(value) {
  return JSON.stringify(value, null, 2).slice(0, 16000);
}

function clampDayCount(value) {
  const numericValue = Number.parseInt(value, 10);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 5;
  return Math.min(16, Math.max(1, numericValue));
}

function addDaysToDate(dateString, days) {
  const baseDate = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(baseDate.getTime())) return '';
  baseDate.setDate(baseDate.getDate() + days);
  const year = baseDate.getFullYear();
  const month = String(baseDate.getMonth() + 1).padStart(2, '0');
  const day = String(baseDate.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function buildRealWeatherContext(tripContext) {
  const destination = String(tripContext?.destination || '').trim();
  const startDate = String(tripContext?.start_date || '').trim();
  const dayCount = clampDayCount(tripContext?.days || 5);

  if (!destination || !startDate) {
    return {
      summary: '',
      weatherByDay: {},
    };
  }

  const location = await geocodeDestination(destination);
  if (!location) {
    return {
      summary: '',
      weatherByDay: {},
    };
  }

  const forecast = await fetchDailyForecast(location, startDate, dayCount);
  const weatherByDay = {};
  const summaryLines = [];

  for (let index = 0; index < dayCount; index += 1) {
    const dayLabel = `Day ${index + 1}`;
    const dayWeather = forecast?.[index];
    const summary = dayWeather ? formatWeatherSummary(dayWeather) : '';
    weatherByDay[dayLabel] = summary;
    if (summary) {
      summaryLines.push(`${dayLabel}: ${summary}`);
    }
  }

  const locationLabel = [location.name, location.admin1, location.country].filter(Boolean).join(' · ');
  return {
    summary: [locationLabel ? `目的地：${locationLabel}` : '', `出行日期：${startDate} 起`, ...summaryLines]
      .filter(Boolean)
      .join('\n'),
    weatherByDay,
  };
}

async function geocodeDestination(destination) {
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.searchParams.set('name', destination);
  url.searchParams.set('count', '5');
  url.searchParams.set('language', 'zh');
  url.searchParams.set('format', 'json');

  const response = await fetch(url);
  if (!response.ok) return null;

  const payload = await response.json();
  const results = Array.isArray(payload?.results) ? payload.results : [];
  if (results.length === 0) return null;

  return chooseBestLocation(results, destination);
}

function chooseBestLocation(results, query) {
  const normalizedQuery = normalizeText(query);
  const scoredResults = results.map((result) => {
    const candidates = [result.name, result.admin1, result.admin2, result.country].filter(Boolean).map(normalizeText);
    const exactMatch = candidates.some((candidate) => candidate === normalizedQuery);
    const partialMatch = candidates.some((candidate) => candidate.includes(normalizedQuery) || normalizedQuery.includes(candidate));
    const score = exactMatch ? 3 : partialMatch ? 2 : 1;
    return { result, score };
  });

  scoredResults.sort((left, right) => right.score - left.score);
  return scoredResults[0]?.result || results[0] || null;
}

function normalizeText(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

async function fetchDailyForecast(location, startDate, dayCount) {
  const forecastDays = Math.min(16, Math.max(1, dayCount));
  const endDate = addDaysToDate(startDate, forecastDays - 1);

  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(location.latitude));
  url.searchParams.set('longitude', String(location.longitude));
  url.searchParams.set('daily', [
    'weather_code',
    'temperature_2m_max',
    'temperature_2m_min',
    'precipitation_probability_max',
    'precipitation_sum',
  ].join(','));
  url.searchParams.set('timezone', 'auto');
  url.searchParams.set('models', 'best_match');
  url.searchParams.set('start_date', startDate);
  url.searchParams.set('end_date', endDate);

  const response = await fetch(url);
  if (!response.ok) return [];

  const payload = await response.json();
  const daily = payload?.daily;
  const dates = Array.isArray(daily?.time) ? daily.time : [];
  const codes = Array.isArray(daily?.weather_code) ? daily.weather_code : [];
  const maxTemps = Array.isArray(daily?.temperature_2m_max) ? daily.temperature_2m_max : [];
  const minTemps = Array.isArray(daily?.temperature_2m_min) ? daily.temperature_2m_min : [];
  const precipProbabilities = Array.isArray(daily?.precipitation_probability_max) ? daily.precipitation_probability_max : [];
  const precipTotals = Array.isArray(daily?.precipitation_sum) ? daily.precipitation_sum : [];

  return dates.map((date, index) => ({
    date,
    weather_code: codes[index],
    temperature_2m_max: maxTemps[index],
    temperature_2m_min: minTemps[index],
    precipitation_probability_max: precipProbabilities[index],
    precipitation_sum: precipTotals[index],
  }));
}

function formatWeatherSummary(dayWeather) {
  const label = weatherCodeToLabel(dayWeather.weather_code);
  const minTemp = Number(dayWeather.temperature_2m_min);
  const maxTemp = Number(dayWeather.temperature_2m_max);
  const precipitationProbability = Number(dayWeather.precipitation_probability_max);
  const precipitationSum = Number(dayWeather.precipitation_sum);

  const tempRange = Number.isFinite(minTemp) && Number.isFinite(maxTemp)
    ? `${Math.round(minTemp)}-${Math.round(maxTemp)}°C`
    : '';

  const parts = [label, tempRange].filter(Boolean);
  if (Number.isFinite(precipitationProbability) && precipitationProbability >= 60) {
    parts.push(`降水概率${Math.round(precipitationProbability)}%`);
  } else if (Number.isFinite(precipitationSum) && precipitationSum > 0) {
    parts.push(`降水${precipitationSum.toFixed(1)}mm`);
  }

  return parts.join(' ');
}

function weatherCodeToLabel(code) {
  const numericCode = Number(code);
  if (!Number.isFinite(numericCode)) return '天气多变';

  if (numericCode === 0) return '晴';
  if (numericCode === 1 || numericCode === 2 || numericCode === 3) return '多云';
  if (numericCode === 45 || numericCode === 48) return '雾';
  if (numericCode === 51 || numericCode === 53 || numericCode === 55) return '毛毛雨';
  if (numericCode === 56 || numericCode === 57) return '冻雨';
  if (numericCode === 61 || numericCode === 63 || numericCode === 65) return '雨';
  if (numericCode === 66 || numericCode === 67) return '冻雨';
  if (numericCode === 71 || numericCode === 73 || numericCode === 75) return '降雪';
  if (numericCode === 77) return '雪粒';
  if (numericCode === 80 || numericCode === 81 || numericCode === 82) return '阵雨';
  if (numericCode === 85 || numericCode === 86) return '阵雪';
  if (numericCode === 95) return '雷阵雨';
  if (numericCode === 96 || numericCode === 99) return '雷暴';

  return '天气';
}

async function requestDeepSeek(url, options) {
  let lastError;

  for (let attempt = 1; attempt <= maxDeepseekAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), deepseekTimeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });

      if (response.status >= 500 && attempt < maxDeepseekAttempts) {
        lastError = response;
        await response.text().catch(() => '');
        continue;
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= maxDeepseekAttempts) {
        const friendlyError = new Error(
          error.name === 'AbortError'
            ? 'DeepSeek 响应超时，请稍后重试。'
            : '无法连接 DeepSeek API，请检查网络、代理或 Vercel 环境变量后重试。',
        );
        friendlyError.status = 502;
        friendlyError.detail = error.message;
        throw friendlyError;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof Response) {
    return lastError;
  }

  const error = new Error('DeepSeek 请求失败，请稍后重试。');
  error.status = 502;
  throw error;
}

export function normalizePlan(plan, weatherByDay = null, tripContext = null) {
  if (!plan || typeof plan !== 'object') {
    throw new Error('AI 返回内容不是有效对象。');
  }

  const itinerary = plan.itinerary && typeof plan.itinerary === 'object' ? plan.itinerary : {};
  const normalizedItinerary = {};
  const normalizedWeather = {};
  const seenIds = new Set();

  for (const [day, items] of Object.entries(itinerary)) {
    normalizedItinerary[day] = Array.isArray(items)
      ? items.map((item, index) => normalizeItem(item, day, index, seenIds))
      : [];
  }

  if (Object.keys(normalizedItinerary).length === 0) {
    throw new Error('AI 返回内容缺少 itinerary。');
  }

  const fallbackWeather =
    weatherByDay !== null && weatherByDay !== undefined
      ? weatherByDay && typeof weatherByDay === 'object'
        ? weatherByDay
        : {}
      : plan.weather && typeof plan.weather === 'object'
        ? plan.weather
        : {};
  for (const day of Object.keys(normalizedItinerary)) {
    normalizedWeather[day] = String(fallbackWeather[day] || '').trim();
  }

  return {
    destination: String(plan.destination || tripContext?.destination || ''),
    start_date: String(plan.start_date || tripContext?.start_date || ''),
    total_budget_estimate: String(plan.total_budget_estimate || '待估算'),
    recommended_transport: String(plan.recommended_transport || '待推荐'),
    weather: normalizedWeather,
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
