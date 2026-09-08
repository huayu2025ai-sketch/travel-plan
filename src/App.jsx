import React, { useEffect, useRef, useState } from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { DayColumn, PackingList } from './components/ItineraryComponents.jsx';
import {
  AlertCircle,
  ArrowRight,
  Backpack,
  Check,
  ChevronDown,
  Coins,
  Download,
  FileText,
  FileUp,
  ImageDown,
  LoaderCircle,
  Plus,
  Route,
  SlidersHorizontal,
  Sparkles,
  TrainFront,
  X,
} from 'lucide-react';
import { LoadingProgress, ThemeToggle } from './components/TravelControls.jsx';
import { useTheme } from './hooks/useTheme.js';
import { loadStoredConversation, loadStoredPlan } from './utils/storage.js';
import { buildMarkdown, saveBlobFile, saveTextFile } from './utils/export.js';
import {
  getDateBadgeClass,
  getDayDateInfo,
  getStartDateFromDayDate,
  parseDayNumber,
  renumberItineraryDays,
} from './utils/date.js';
import {
  createCardEditForm,
  createEmptyCardForm,
  createEmptyPackingForm,
  formatCostAmount,
  getAllItems,
  getBudgetRange,
  getTypeBadgeClass,
  packingCategories,
  typeAccent,
  typeOptions,
  withComputedBudget,
} from './utils/plan.js';
import './styles.css';

const initialTripPlan = {
  destination: '',
  start_date: '',
  total_budget_estimate: '2500-3000元',
  recommended_transport: '高铁 + 市内网约车',
  weather: {},
  packing_items: [
    {
      id: 'packing-id-card',
      name: '身份证',
      category: '证件',
      quantity: '1',
      packed: false,
      note: '进站、入住都要用。',
    },
    {
      id: 'packing-power-bank',
      name: '充电宝',
      category: '电子',
      quantity: '1',
      packed: false,
      note: '注意容量符合乘车携带要求。',
    },
    {
      id: 'packing-comfort-shoes',
      name: '舒适步行鞋',
      category: '衣物',
      quantity: '1双',
      packed: false,
      note: '适合石窟和老城步行。',
    },
  ],
  itinerary: {
    'Day 1': [
      {
        id: 'day1-transport-1',
        type: '交通',
        title: '抵达洛阳龙门站',
        cost: '高铁约360元',
        duration: '2.5小时',
        advice: '建议选择上午抵达，留出下午游览龙门石窟的完整时间。',
      },
      {
        id: 'day1-sight-1',
        type: '景点',
        title: '龙门石窟',
        cost: '120元',
        duration: '3小时',
        advice: '傍晚入园更舒适，夜游灯光亮起后观感更震撼。',
      },
    ],
    'Day 2': [
      {
        id: 'day2-citywalk-1',
        type: 'citywalk',
        title: '老城十字街漫步',
        cost: '免费',
        duration: '2小时',
        advice: '从丽景门慢慢走到十字街，适合边逛边吃小吃。',
      },
      {
        id: 'day2-food-1',
        type: '美食',
        title: '洛阳水席',
        cost: '人均100元',
        duration: '1.5小时',
        advice: '牡丹燕菜是特色，套餐容易过量，建议按人数单点。',
      },
    ],
    'Day 3': [
      {
        id: 'day3-hotel-1',
        type: '酒店',
        title: '开封鼓楼附近入住',
        cost: '约260元/晚',
        duration: '1晚',
        advice: '住在鼓楼或书店街附近，晚上步行看夜市更方便。',
      },
      {
        id: 'day3-transport-1',
        type: '交通',
        title: '洛阳到开封',
        cost: '高铁约90元',
        duration: '1小时',
        advice: '中午出发最稳妥，避免压缩上午在洛阳的收尾时间。',
      },
    ],
    'Day 4': [
      {
        id: 'day4-sight-1',
        type: '景点',
        title: '清明上河园',
        cost: '120元',
        duration: '4小时',
        advice: '优先看演出时间表，再反向安排园区游线。',
      },
      {
        id: 'day4-food-1',
        type: '美食',
        title: '鼓楼夜市',
        cost: '人均80元',
        duration: '2小时',
        advice: '小吃分量不小，适合多人分食，避开最拥挤的19:00。',
      },
    ],
    'Day 5': [
      {
        id: 'day5-citywalk-1',
        type: 'citywalk',
        title: '书店街与山陕甘会馆',
        cost: '约30元',
        duration: '2.5小时',
        advice: '适合作为返程前的轻量行程，节奏不要排太满。',
      },
    ],
  },
};

const storageKey = 'travel-plan-board-v1';
const conversationStorageKey = 'travel-plan-conversation-v1';
const generationStages = [
  '解析目的地与出行天数',
  '匹配交通、酒店和每日节奏',
  '整理景点、美食与 citywalk',
  '校验 JSON 并生成看板',
];

function getPrintTypeMeta(type) {
  const meta = {
    交通: { icon: 'T', color: '#0284c7', bg: '#e0f2fe', label: '交通', imageTitle: '出发路上' },
    景点: { icon: 'S', color: '#059669', bg: '#d1fae5', label: '景点', imageTitle: '目的地风景' },
    citywalk: { icon: 'W', color: '#65a30d', bg: '#ecfccb', label: 'Citywalk', imageTitle: '街巷漫步' },
    美食: { icon: 'F', color: '#d97706', bg: '#fef3c7', label: '美食', imageTitle: '地方风味' },
    酒店: { icon: 'H', color: '#7c3aed', bg: '#ede9fe', label: '酒店', imageTitle: '舒适落脚' },
    娱乐: { icon: 'E', color: '#e11d48', bg: '#ffe4e6', label: '娱乐', imageTitle: '轻松玩乐' },
    工作: { icon: 'O', color: '#0891b2', bg: '#cffafe', label: '工作', imageTitle: '行程工作' },
  };

  return meta[type] || { icon: 'P', color: '#57534e', bg: '#f5f5f4', label: type || '行程', imageTitle: '旅途片刻' };
}

function roundRect(ctx, x, y, width, height, radius) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    return;
  }

  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
  const words = String(text || '').split('');
  const lines = [];
  let line = '';

  words.forEach((word) => {
    const nextLine = `${line}${word}`;
    if (ctx.measureText(nextLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
      return;
    }
    line = nextLine;
  });

  if (line) lines.push(line);

  lines.slice(0, maxLines).forEach((currentLine, index) => {
    const suffix = index === maxLines - 1 && lines.length > maxLines ? '...' : '';
    ctx.fillText(`${currentLine}${suffix}`, x, y + index * lineHeight);
  });

  return Math.min(lines.length, maxLines) * lineHeight;
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      reject(new Error('图片生成失败，请稍后重试。'));
    }, 'image/png');
  });
}

async function buildPlanImageBlob(plan) {
  const entries = Object.entries(plan.itinerary);
  const width = 1440;
  const itemCount = getAllItems(plan.itinerary).length;
  const height = Math.max(900, 340 + entries.length * 88 + itemCount * 178);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#f7f3ea';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(14, 116, 144, 0.08)';
  ctx.beginPath();
  ctx.arc(1220, 110, 190, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(217, 119, 6, 0.10)';
  ctx.beginPath();
  ctx.arc(160, 760, 230, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1c1917';
  ctx.font = '900 58px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillText('AI 旅行规划', 80, 105);
  ctx.font = '600 24px "PingFang SC", "Microsoft YaHei", sans-serif';
  ctx.fillStyle = '#78716c';
  ctx.fillText('每日行程看板导出图', 82, 148);

  const summary = [
    ['预算预估', plan.total_budget_estimate],
    ['推荐交通', plan.recommended_transport],
    ['规划范围', `${entries.length}天 · ${itemCount}项`],
  ];

  summary.forEach(([label, value], index) => {
    const x = 80 + index * 420;
    roundRect(ctx, x, 190, 360, 112, 18);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.fill();
    ctx.strokeStyle = '#e7e5e4';
    ctx.stroke();
    ctx.fillStyle = '#78716c';
    ctx.font = '700 18px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(label, x + 24, 230);
    ctx.fillStyle = '#1c1917';
    ctx.font = '900 30px "PingFang SC", "Microsoft YaHei", sans-serif';
    wrapCanvasText(ctx, value, x + 24, 270, 305, 34, 1);
  });

  let y = 360;
  entries.forEach(([day, items]) => {
    const dateInfo = getDayDateInfo(plan.start_date, day);
    ctx.fillStyle = '#1c1917';
    ctx.font = '900 34px "PingFang SC", "Microsoft YaHei", sans-serif';
    ctx.fillText(day, 80, y);

    if (dateInfo.displayText) {
      const isWeekend = dateInfo.dayType === 'weekend';
      ctx.fillStyle = isWeekend ? '#fef3c7' : '#d1fae5';
      roundRect(ctx, 190, y - 32, 250, 42, 21);
      ctx.fill();
      ctx.fillStyle = isWeekend ? '#b45309' : '#0f766e';
      ctx.font = '800 18px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(dateInfo.displayText, 210, y - 5);
    }

    y += 38;

    if (items.length === 0) {
      ctx.fillStyle = '#a8a29e';
      ctx.font = '600 22px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText('暂无行程', 82, y + 42);
      y += 100;
      return;
    }

    items.forEach((item) => {
      const meta = getPrintTypeMeta(item.type);
      roundRect(ctx, 80, y, 1280, 142, 20);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
      ctx.fill();
      ctx.strokeStyle = '#e7e5e4';
      ctx.stroke();

      ctx.fillStyle = meta.color;
      roundRect(ctx, 80, y, 10, 142, 5);
      ctx.fill();

      ctx.fillStyle = meta.bg;
      roundRect(ctx, 112, y + 22, 104, 34, 17);
      ctx.fill();
      ctx.fillStyle = meta.color;
      ctx.font = '800 18px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(meta.label, 138, y + 46);

      ctx.fillStyle = '#1c1917';
      ctx.font = '900 30px "PingFang SC", "Microsoft YaHei", sans-serif';
      wrapCanvasText(ctx, item.title, 242, y + 42, 430, 34, 1);

      ctx.fillStyle = '#57534e';
      ctx.font = '700 20px "PingFang SC", "Microsoft YaHei", sans-serif';
      ctx.fillText(`耗时 ${item.duration}`, 242, y + 84);

      ctx.fillStyle = '#78716c';
      ctx.font = '500 20px "PingFang SC", "Microsoft YaHei", sans-serif';
      wrapCanvasText(ctx, item.advice, 720, y + 44, 580, 29, 3);

      y += 166;
    });

    y += 20;
  });

  return canvasToBlob(canvas);
}

function hasPlanContent(plan) {
  return getAllItems(plan.itinerary).length > 0 || Boolean(plan.start_date) || plan.recommended_transport !== '待推荐';
}

function isInitialDemoPlan(plan) {
  return JSON.stringify(normalizeImportedPlan(plan)) === JSON.stringify(normalizeImportedPlan(initialTripPlan));
}

function compactPlanForAi(plan) {
  return withComputedBudget({
    destination: plan.destination || '',
    start_date: plan.start_date || '',
    total_budget_estimate: plan.total_budget_estimate || '',
    recommended_transport: plan.recommended_transport || '待推荐',
    packing_items: plan.packing_items || [],
    itinerary: plan.itinerary,
  });
}

function normalizeImportedPlan(value) {
  if (!value || typeof value !== 'object' || !value.itinerary || typeof value.itinerary !== 'object') {
    throw new Error('JSON 缺少 itinerary，无法导入。');
  }

  const normalizedItinerary = {};
  const seenIds = new Set();

  Object.entries(value.itinerary).forEach(([day, items], dayIndex) => {
    const normalizedDay = day || `Day ${dayIndex + 1}`;
    normalizedItinerary[normalizedDay] = Array.isArray(items)
      ? items.map((item, itemIndex) => {
          let id = String(item?.id || `${normalizedDay.toLowerCase().replace(/\s+/g, '-')}-slot-${itemIndex + 1}`).replace(
            /[^a-zA-Z0-9-_]/g,
            '-',
          );

          while (seenIds.has(id)) {
            id = `${id}-${itemIndex + 1}`;
          }

          seenIds.add(id);

          return {
            id,
            type: typeOptions.includes(item?.type) ? item.type : '景点',
            title: String(item?.title || '未命名行程'),
            cost: formatCostAmount(item?.cost),
            duration: String(item?.duration || '待安排'),
            advice: String(item?.advice || '暂无建议。'),
          };
        })
      : [];
  });

  if (Object.keys(normalizedItinerary).length === 0) {
    throw new Error('JSON 中没有可用的 Day 数据。');
  }

  const renumberedItinerary = renumberItineraryDays(normalizedItinerary);

  const normalizedPackingItems = Array.isArray(value.packing_items)
    ? value.packing_items.map((item, index) => ({
        id: String(item?.id || `packing-${Date.now()}-${index}`).replace(/[^a-zA-Z0-9-_]/g, '-'),
        name: String(item?.name || '未命名物品'),
        category: packingCategories.includes(item?.category) ? item.category : '其他',
        quantity: String(item?.quantity || '1'),
        packed: Boolean(item?.packed),
        note: String(item?.note || ''),
      }))
    : [];

  const normalizedWeather = {};
  const rawWeather = value.weather && typeof value.weather === 'object' ? value.weather : {};
  for (const day of Object.keys(renumberedItinerary)) {
    normalizedWeather[day] = String(rawWeather[day] || '').trim();
  }

  return {
    destination: String(value.destination || ''),
    start_date: String(value.start_date || ''),
    total_budget_estimate: getBudgetRange(normalizedItinerary),
    recommended_transport: String(value.recommended_transport || '待推荐'),
    weather: normalizedWeather,
    packing_items: normalizedPackingItems,
    itinerary: renumberedItinerary,
  };
}

function App() {
  const [plan, setPlan] = useState(() => loadStoredPlan(initialTripPlan, normalizeImportedPlan));
  const [idea, setIdea] = useState('我想去洛阳、开封旅游，在10月下旬，5天。预算大概多少，交通工具。');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [cardForm, setCardForm] = useState(createEmptyCardForm('Day 1'));
  const [packingForm, setPackingForm] = useState(createEmptyPackingForm);
  const [editingPackingId, setEditingPackingId] = useState('');
  const [editingPackingForm, setEditingPackingForm] = useState(createEmptyPackingForm);
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [editingCardId, setEditingCardId] = useState('');
  const [editForm, setEditForm] = useState(createCardEditForm(initialTripPlan.itinerary['Day 1'][0]));
  const [importInputKey, setImportInputKey] = useState(0);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isPackingCollapsed, setIsPackingCollapsed] = useState(false);
  const [isBoardCollapsed, setIsBoardCollapsed] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [activeTypes, setActiveTypes] = useState(typeOptions);
  const [activePackingCategory, setActivePackingCategory] = useState('全部');
  const [packingSearchQuery, setPackingSearchQuery] = useState('');
  const [conversationHistory, setConversationHistory] = useState(loadStoredConversation);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStageIndex, setGenerationStageIndex] = useState(0);
  const [lastAiRequest, setLastAiRequest] = useState(null);
  const [lastAiResponse, setLastAiResponse] = useState(null);
  const [isAiDebugOpen, setIsAiDebugOpen] = useState(false);
  const packingSectionRef = useRef(null);
  const { theme, setTheme } = useTheme();
  const days = Object.entries(plan.itinerary);
  const dayNames = Object.keys(plan.itinerary);
  const plannedDayCount = dayNames.length;
  const itineraryItemCount = days.reduce((total, [, items]) => total + items.length, 0);
  const computedBudgetEstimate = getBudgetRange(plan.itinerary);
  const currentPlanForExport = withComputedBudget(plan);
  const isFilteredView = activeTypes.length !== typeOptions.length;
  const visibleTypeSet = new Set(activeTypes);
  const visibleDays = days.map(([day, items]) => [day, isFilteredView ? items.filter((item) => visibleTypeSet.has(item.type)) : items]);
  const visibleItemCount = visibleDays.reduce((total, [, items]) => total + items.length, 0);
  const packingItems = plan.packing_items || [];
  const packedItemCount = packingItems.filter((item) => item.packed).length;
  const typeCounts = typeOptions.reduce((counts, type) => {
    counts[type] = getAllItems(plan.itinerary).filter((item) => item.type === type).length;
    return counts;
  }, {});
  const hasCurrentPlanContext = hasPlanContent(plan) && !isInitialDemoPlan(plan);
  const hasAiContext = hasCurrentPlanContext || conversationHistory.length > 0;

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(plan));
    } catch {
      // Local storage can be unavailable in restricted browser modes; the board still works in memory.
    }
  }, [plan]);

  useEffect(() => {
    try {
      window.localStorage.setItem(conversationStorageKey, JSON.stringify(conversationHistory.slice(-8)));
    } catch {
      // Context history is a convenience feature; generation still works without local storage.
    }
  }, [conversationHistory]);

  useEffect(() => {
    if (!isGenerating) {
      setGenerationProgress(0);
      setGenerationStageIndex(0);
      return undefined;
    }

    setGenerationProgress(8);
    setGenerationStageIndex(0);
    const interval = window.setInterval(() => {
      setGenerationProgress((currentProgress) => {
        const nextProgress = Math.min(94, currentProgress + Math.ceil((95 - currentProgress) * 0.16));
        const nextStageIndex = Math.min(
          generationStages.length - 1,
          Math.floor((nextProgress / 100) * generationStages.length),
        );
        setGenerationStageIndex(nextStageIndex);
        return nextProgress;
      });
    }, 520);

    return () => window.clearInterval(interval);
  }, [isGenerating]);

  const setItinerary = (nextItinerary) => {
    setPlan((currentPlan) => ({ ...currentPlan, itinerary: nextItinerary }));
  };

  const setPackingItems = (nextItems) => {
    setPlan((currentPlan) => ({ ...currentPlan, packing_items: nextItems }));
  };

  const setDayDate = (day, dayDateValue) => {
    setPlan((currentPlan) => ({
      ...currentPlan,
      start_date: getStartDateFromDayDate(day, dayDateValue),
    }));
  };

  const addDay = () => {
    const currentItinerary = renumberItineraryDays(plan.itinerary);
    const nextDay = `Day ${Object.keys(currentItinerary).length + 1}`;
    setError('');
    setItinerary({
      ...currentItinerary,
      [nextDay]: [],
    });
    setCardForm(createEmptyCardForm(nextDay));
  };

  const deleteDay = (day) => {
    if (dayNames.length <= 1) {
      setError('至少需要保留一天行程。');
      return;
    }

    const itemCount = plan.itinerary[day]?.length || 0;
    if (itemCount > 0 && !window.confirm(`删除 ${day} 会同时删除 ${itemCount} 项行程，确定继续吗？`)) {
      return;
    }

    const nextItinerary = renumberItineraryDays(Object.fromEntries(days.filter(([currentDay]) => currentDay !== day)));
    const nextFirstDay = Object.keys(nextItinerary)[0];

    setPlan((currentPlan) => ({
      ...currentPlan,
      itinerary: nextItinerary,
    }));
    setCardForm(createEmptyCardForm(nextFirstDay));
    setPendingDeleteId('');
    setEditingCardId('');
    setError('');
  };

  const onDragEnd = (result) => {
    const { source, destination, type } = result;
    if (!destination) return;

    if (type === 'DAY') {
      const orderedDays = Array.from(days);
      const [removedDay] = orderedDays.splice(source.index, 1);
      orderedDays.splice(destination.index, 0, removedDay);
      const nextItinerary = renumberItineraryDays(Object.fromEntries(orderedDays));

      setPlan((currentPlan) => ({
        ...currentPlan,
        itinerary: nextItinerary,
      }));
      setCardForm(createEmptyCardForm(Object.keys(nextItinerary)[0]));
      setPendingDeleteId('');
      setEditingCardId('');
      return;
    }

    if (isFilteredView) {
      setError('筛选视图仅用于查看，请先切回全部类型再拖拽卡片。');
      return;
    }

    const sourceColumn = source.droppableId;
    const destinationColumn = destination.droppableId;
    const sourceItems = Array.from(plan.itinerary[sourceColumn]);
    const destinationItems = Array.from(plan.itinerary[destinationColumn]);
    const [removed] = sourceItems.splice(source.index, 1);

    if (sourceColumn === destinationColumn) {
      sourceItems.splice(destination.index, 0, removed);
      setItinerary({ ...plan.itinerary, [sourceColumn]: sourceItems });
      return;
    }

    destinationItems.splice(destination.index, 0, removed);
    setItinerary({
      ...plan.itinerary,
      [sourceColumn]: sourceItems,
      [destinationColumn]: destinationItems,
    });
  };

  const generatePlan = async (event) => {
    event.preventDefault();
    const trimmedIdea = idea.trim();

    if (!trimmedIdea) {
      setError('请输入旅行想法后再生成。');
      return;
    }

    setIsGenerating(true);
    setError('');

    try {
      const requestHistory = conversationHistory.slice(-6);
      const requestPlan = hasCurrentPlanContext ? compactPlanForAi(plan) : null;
      const requestBody = {
        idea: trimmedIdea,
        currentPlan: requestPlan,
        history: requestHistory,
      };
      setLastAiRequest(requestBody);
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const responseText = await response.text();
      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error('接口返回的不是 JSON，请检查 Vercel API 路由或环境变量配置。');
      }

      setLastAiResponse(data);

      if (!response.ok) {
        throw new Error(data.error || '生成失败，请稍后重试。');
      }

      const generatedPlan = normalizeImportedPlan(data);
      const nextPlan = {
        ...generatedPlan,
        packing_items: Array.isArray(data.packing_items) ? generatedPlan.packing_items : packingItems,
      };
      setPlan(nextPlan);
      setConversationHistory((currentHistory) =>
        [
          ...currentHistory,
          // 与服务端 request-guard 的 maxHistoryContentCharacters 对齐：
          // 超长内容截断入历史，避免之后每次优化请求都被 413 拒绝。
          { role: 'user', content: trimmedIdea.slice(0, 800) },
          {
            role: 'assistant',
            content: `已生成/优化 ${Object.keys(nextPlan.itinerary).length} 天、${getAllItems(nextPlan.itinerary).length} 项行程。`,
          },
        ].slice(-8),
      );
      setCardForm(createEmptyCardForm(Object.keys(nextPlan.itinerary)[0] || 'Day 1'));
      setEditingCardId('');
      setPendingDeleteId('');
      setGenerationProgress(100);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      window.setTimeout(() => setIsGenerating(false), 250);
    }
  };

  const updateCardForm = (field, value) => {
    setCardForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const clearPlan = () => {
    const emptyPlan = {
      destination: '',
      start_date: '',
      total_budget_estimate: '0-1000元',
      recommended_transport: '待推荐',
      packing_items: [],
      itinerary: { 'Day 1': [] },
    };

    try {
      window.localStorage.removeItem(storageKey);
      window.localStorage.removeItem(conversationStorageKey);
    } catch {
      // The in-memory reset below still works if storage is unavailable.
    }

    setIdea('');
    setPlan(emptyPlan);
    setCardForm(createEmptyCardForm('Day 1'));
    setPackingForm(createEmptyPackingForm());
    setEditingPackingId('');
    setEditingPackingForm(createEmptyPackingForm());
    setPendingDeleteId('');
    setEditingCardId('');
    setIsAddFormOpen(false);
    setIsPackingCollapsed(false);
    setIsBoardCollapsed(false);
    setActiveTypes(typeOptions);
    setActivePackingCategory('全部');
    setPackingSearchQuery('');
    setConversationHistory([]);
    setLastAiRequest(null);
    setLastAiResponse(null);
    setIsAiDebugOpen(false);
    setError('');
  };

  const addCustomCard = (event) => {
    event.preventDefault();
    const title = cardForm.title.trim();

    if (!title) {
      setError('自定义卡片需要填写标题。');
      return;
    }

    const targetDay = plan.itinerary[cardForm.day] ? cardForm.day : dayNames[0];
    const newCard = {
      id: `custom-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: cardForm.type,
      title,
      cost: formatCostAmount(cardForm.cost),
      duration: cardForm.duration.trim() || '待安排',
      advice: cardForm.advice.trim() || '暂无建议。',
    };

    setError('');
    setItinerary({
      ...plan.itinerary,
      [targetDay]: [...plan.itinerary[targetDay], newCard],
    });
    setCardForm(createEmptyCardForm(targetDay));
    setIsAddFormOpen(false);
  };

  const updatePackingForm = (field, value) => {
    setPackingForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const addPackingItem = (event) => {
    event.preventDefault();
    const name = packingForm.name.trim();

    if (!name) {
      setError('携带物品需要填写名称。');
      return;
    }

    const newItem = {
      id: `packing-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      category: packingCategories.includes(packingForm.category) ? packingForm.category : '其他',
      quantity: packingForm.quantity.trim() || '1',
      packed: false,
      note: packingForm.note.trim(),
    };

    setError('');
    setPackingItems([...packingItems, newItem]);
    setPackingForm(createEmptyPackingForm());
  };

  const togglePackingItem = (itemId) => {
    setPackingItems(packingItems.map((item) => (item.id === itemId ? { ...item, packed: !item.packed } : item)));
  };

  const deletePackingItem = (itemId) => {
    setPackingItems(packingItems.filter((item) => item.id !== itemId));
  };

  const reorderPackingItems = (sourceIndex, destinationIndex, visibleItems) => {
    const movingItem = visibleItems[sourceIndex];
    if (!movingItem || sourceIndex === destinationIndex) return;

    const visibleItemsWithoutMoving = visibleItems.filter((item) => item.id !== movingItem.id);
    const nextItems = packingItems.filter((item) => item.id !== movingItem.id);
    const anchorItem = visibleItemsWithoutMoving[destinationIndex];
    const lastVisibleItem = visibleItemsWithoutMoving[visibleItemsWithoutMoving.length - 1];
    const insertIndex = anchorItem
      ? nextItems.findIndex((item) => item.id === anchorItem.id)
      : lastVisibleItem
        ? nextItems.findIndex((item) => item.id === lastVisibleItem.id) + 1
        : nextItems.length;

    nextItems.splice(Math.max(0, insertIndex), 0, movingItem);
    setPackingItems(nextItems);
  };

  const startEditPackingItem = (itemId) => {
    const item = packingItems.find((i) => i.id === itemId);
    if (!item) return;
    setEditingPackingId(itemId);
    setEditingPackingForm({
      name: item.name,
      category: packingCategories.includes(item.category) ? item.category : '其他',
      quantity: item.quantity || '1',
      note: item.note || '',
    });
  };

  const updateEditingPackingForm = (field, value) => {
    setEditingPackingForm((prev) => ({ ...prev, [field]: value }));
  };

  const savePackingItemEdit = () => {
    const name = editingPackingForm.name.trim();
    if (!name) {
      setError('携带物品需要填写名称。');
      return;
    }

    setPackingItems(
      packingItems.map((item) =>
        item.id === editingPackingId
          ? {
              ...item,
              name,
              category: packingCategories.includes(editingPackingForm.category) ? editingPackingForm.category : '其他',
              quantity: editingPackingForm.quantity.trim() || '1',
              note: editingPackingForm.note.trim(),
            }
          : item,
      ),
    );
    setError('');
    setEditingPackingId('');
    setEditingPackingForm(createEmptyPackingForm());
  };

  const cancelPackingItemEdit = () => {
    setEditingPackingId('');
    setEditingPackingForm(createEmptyPackingForm());
  };

  const clearPackingFilters = () => {
    setActivePackingCategory('全部');
    setPackingSearchQuery('');
  };

  const scrollToPackingList = () => {
    setIsPackingCollapsed(false);
    window.requestAnimationFrame(() => {
      packingSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const deleteCard = (day, cardId) => {
    setItinerary({
      ...plan.itinerary,
      [day]: plan.itinerary[day].filter((item) => item.id !== cardId),
    });
    setPendingDeleteId('');
    if (editingCardId === cardId) {
      setEditingCardId('');
    }
  };

  const duplicateCard = (day, cardId) => {
    const dayItems = plan.itinerary[day] || [];
    const sourceIndex = dayItems.findIndex((item) => item.id === cardId);

    if (sourceIndex === -1) {
      setError('未找到要复制的卡片。');
      return;
    }

    const sourceCard = dayItems[sourceIndex];
    const copiedCard = {
      ...sourceCard,
      id: `copy-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title: `${sourceCard.title}（副本）`,
    };
    const nextItems = Array.from(dayItems);
    nextItems.splice(sourceIndex + 1, 0, copiedCard);

    setError('');
    setPendingDeleteId('');
    setEditingCardId('');
    setItinerary({
      ...plan.itinerary,
      [day]: nextItems,
    });
  };

  const startEditCard = (item) => {
    setPendingDeleteId('');
    setEditingCardId(item.id);
    setEditForm(createCardEditForm(item));
  };

  const updateEditForm = (field, value) => {
    setEditForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const saveCardEdit = (day, cardId) => {
    const title = editForm.title.trim();

    if (!title) {
      setError('编辑卡片需要填写标题。');
      return;
    }

    setError('');
    setItinerary({
      ...plan.itinerary,
      [day]: plan.itinerary[day].map((item) =>
        item.id === cardId
          ? {
              ...item,
              type: editForm.type,
              title,
              cost: formatCostAmount(editForm.cost),
              duration: editForm.duration.trim() || '待安排',
              advice: editForm.advice.trim() || '暂无建议。',
            }
          : item,
      ),
    });
    setEditingCardId('');
  };

  const exportPlan = async () => {
    await saveTextFile(
      JSON.stringify(currentPlanForExport, null, 2),
      `travel-plan-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json;charset=utf-8',
      'JSON 文件',
      { 'application/json': ['.json'] },
    );
  };

  const exportMarkdown = async () => {
    await saveTextFile(
      buildMarkdown(currentPlanForExport),
      `travel-plan-${new Date().toISOString().slice(0, 10)}.md`,
      'text/markdown;charset=utf-8',
      'Markdown 文件',
      { 'text/markdown': ['.md'], 'text/plain': ['.txt'] },
    );
  };

  const exportImage = async () => {
    try {
      const blob = await buildPlanImageBlob(currentPlanForExport);
      await saveBlobFile(
        blob,
        `travel-plan-${new Date().toISOString().slice(0, 10)}.png`,
        'PNG 图片',
        { 'image/png': ['.png'] },
      );
    } catch (imageError) {
      setError(imageError.message || '图片导出失败，请稍后重试。');
    }
  };

  const runExportAction = async (action) => {
    setIsExportMenuOpen(false);
    await action();
  };

  const toggleTypeFilter = (type) => {
    setPendingDeleteId('');
    setEditingCardId('');
    setActiveTypes((currentTypes) =>
      currentTypes.includes(type) ? currentTypes.filter((currentType) => currentType !== type) : [...currentTypes, type],
    );
  };

  const showAllTypes = () => {
    setActiveTypes(typeOptions);
  };

  const importPlan = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const importedPlan = normalizeImportedPlan(JSON.parse(content));
      setPlan(importedPlan);
      setCardForm(createEmptyCardForm(Object.keys(importedPlan.itinerary)[0]));
      setPackingForm(createEmptyPackingForm());
      setEditingPackingId('');
      setEditingPackingForm(createEmptyPackingForm());
      setActivePackingCategory('全部');
      setPackingSearchQuery('');
      setPendingDeleteId('');
      setEditingCardId('');
      setError('');
    } catch (importError) {
      setError(importError.message || '导入失败，请检查 JSON 文件。');
    } finally {
      setImportInputKey((currentKey) => currentKey + 1);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f1e8] text-stone-900 transition-colors duration-400 dark:bg-[#141210] dark:text-[#e8e4df]">
      <div className="map-grid fixed inset-0 opacity-50" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="animate-fade-up grid gap-5 rounded-2xl border border-stone-200/80 bg-white/85 p-5 shadow-soft backdrop-blur-lg transition-all duration-300 dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark md:grid-cols-[1.25fr_0.75fr] md:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="ai-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-sm">
                <Sparkles className="h-3 w-3" />
                AI 旅行草案
              </span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.15] tracking-tight text-stone-950 dark:text-[#e8e4df] md:text-5xl">
              把粗略想法整理成
              <br className="hidden sm:block" />
              可调整的每日行程
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 dark:text-[#9a9389] md:text-base">
              输入旅行想法后生成结构化 JSON，也可以继续输入优化要求，AI 会带入当前草案上下文。
            </p>
          </div>

          <form onSubmit={generatePlan} className="rounded-xl border border-stone-200/80 bg-[#fbfaf7]/90 p-3.5 backdrop-blur transition-all duration-300 dark:border-[#3a3630]/80 dark:bg-[#252320]/90">
            <div className="flex items-center justify-between">
              <label htmlFor="trip-idea" className="text-sm font-semibold text-stone-800 dark:text-[#c4bdb4]">
                {hasAiContext ? '继续优化' : '旅行想法'}
              </label>
              <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
            <textarea
              id="trip-idea"
              className="mt-2 h-28 w-full resize-none rounded-lg border border-stone-200/80 bg-white px-3 py-2.5 text-sm leading-6 text-stone-700 outline-none ring-0 transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              maxLength={2000}
              disabled={isGenerating}
            />
            {error ? (
              <div className="mt-3 flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
            {isGenerating ? (
              <LoadingProgress progress={generationProgress} stage={generationStages[generationStageIndex]} stages={generationStages} />
            ) : null}
            {hasAiContext ? (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium leading-5 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                已保留当前行程和最近沟通上下文，本轮输入会作为优化要求处理。点击清空行程后上下文会一并清除。
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={isGenerating}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-500 dark:bg-[#e8e4df] dark:text-[#141210] dark:hover:bg-[#d8d4cf] dark:disabled:bg-[#3a3630] dark:disabled:text-[#7a746c]"
              >
                {isGenerating ? '正在生成行程' : hasAiContext ? '优化当前行程' : '生成行程草案'}
                {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              </button>
              {lastAiRequest ? (
                <button
                  type="button"
                  onClick={() => setIsAiDebugOpen((isOpen) => !isOpen)}
                  aria-expanded={isAiDebugOpen}
                  aria-label={isAiDebugOpen ? '隐藏请求/响应详情' : '显示请求/响应详情'}
                  title={isAiDebugOpen ? '隐藏请求/响应详情' : '显示请求/响应详情'}
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-stone-200 bg-white px-3 py-3 text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]"
                >
                  <ChevronDown className={`h-4 w-4 transition ${isAiDebugOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : null}
            </div>
            {isAiDebugOpen && lastAiRequest ? (
              <div className="mt-2 space-y-2 rounded-md border border-stone-200 bg-stone-50 p-3 text-xs dark:border-[#3a3630] dark:bg-[#1e1c1a]">
                <div>
                  <p className="mb-1 font-semibold text-stone-600 dark:text-[#9a9389]">发送给 DeepSeek 的内容</p>
                  <pre className="max-h-40 overflow-auto rounded bg-white p-2 text-stone-700 dark:bg-[#252320] dark:text-[#b5afa6]">
                    {JSON.stringify(lastAiRequest, null, 2)}
                  </pre>
                </div>
                {lastAiResponse ? (
                  <div>
                    <p className="mb-1 font-semibold text-stone-600 dark:text-[#9a9389]">DeepSeek 返回的内容</p>
                    <pre className="max-h-40 overflow-auto rounded bg-white p-2 text-stone-700 dark:bg-[#252320] dark:text-[#b5afa6]">
                      {JSON.stringify(lastAiResponse, null, 2)}
                    </pre>
                  </div>
                ) : null}
              </div>
            ) : null}
            <button
              type="button"
              onClick={clearPlan}
              disabled={isGenerating}
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-stone-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-stone-400 transition-all duration-200 hover:border-red-200 hover:bg-red-50/80 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60 dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/80 dark:text-[#7a746c] dark:hover:border-red-900/50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
            >
              清空行程
            </button>
          </form>
        </header>

        <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-lg border border-stone-200 bg-white/85 p-4 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">预算预估</p>
            <div className="mt-2 flex items-center gap-3">
              <Coins className="h-6 w-6 text-amber-600" />
              <p className="text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">{computedBudgetEstimate}</p>
            </div>
            <p className="mt-2 text-[11px] font-medium text-stone-400 dark:text-[#6a645c]">按卡片金额自动汇总</p>
          </div>
          <div className="group rounded-xl border border-stone-200/80 bg-white/85 p-4 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400 dark:text-[#5e584f]">推荐交通</p>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="stat-icon-ring bg-sky-50 text-sky-600 dark:bg-sky-950/30 dark:text-sky-400">
                <TrainFront className="h-5 w-5" />
              </div>
              <p className="text-xl font-black tracking-tight text-stone-950 dark:text-[#e8e4df]">{plan.recommended_transport}</p>
            </div>
          </div>
          <div className="group rounded-xl border border-stone-200/80 bg-white/85 p-4 shadow-soft backdrop-blur transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400 dark:text-[#5e584f]">规划范围</p>
            <div className="mt-2.5 flex items-center gap-3">
              <div className="stat-icon-ring bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400">
                <Route className="h-5 w-5" />
              </div>
              <p className="text-xl font-black tracking-tight text-stone-950 dark:text-[#e8e4df]">
                {plannedDayCount}天 · {itineraryItemCount}项
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={scrollToPackingList}
            className="group rounded-lg border border-stone-200 bg-white/85 p-4 text-left shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:border-rose-200 hover:bg-rose-50/60 hover:shadow-card focus:outline-none focus:ring-2 focus:ring-rose-200 dark:border-[#3a3630] dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark dark:hover:border-rose-900/60 dark:hover:bg-rose-950/20 dark:focus:ring-rose-900/60"
            aria-label="查看携带物品清单"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">携带物品</p>
            <div className="mt-2 flex items-center gap-3">
              <Backpack className="h-6 w-6 text-rose-600 transition group-hover:scale-105" />
              <p className="text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">
                {packedItemCount}/{packingItems.length}件
              </p>
            </div>
            <p className="mt-2 text-xs font-semibold text-rose-700 opacity-85 dark:text-rose-300">查看清单</p>
          </button>
        </section>

        <section className="animate-fade-up animate-fade-up-delay-2 mt-5 flex-1 overflow-hidden rounded-2xl border border-stone-200/80 bg-white/70 p-3 shadow-soft backdrop-blur transition-all duration-300 dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/70 dark:shadow-soft-dark">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">Kanban Board</p>
              <div className="mt-1 flex items-center gap-2">
                <h2 className="text-lg font-bold text-stone-950 dark:text-[#e8e4df]">每日行程看板</h2>
                <button
                  type="button"
                  onClick={() => setIsBoardCollapsed((isCollapsed) => !isCollapsed)}
                  aria-expanded={!isBoardCollapsed}
                  aria-label={isBoardCollapsed ? '展开每日行程看板' : '收起每日行程看板'}
                  title={isBoardCollapsed ? '展开每日行程看板' : '收起每日行程看板'}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#7a746c] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26] dark:hover:text-[#b5afa6]"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition ${isBoardCollapsed ? '-rotate-90' : ''}`} />
                </button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addDay}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-stone-600 shadow-sm backdrop-blur transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:shadow-md dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/90 dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]"
              >
                <Plus className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />
                添加天数
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-stone-600 shadow-sm backdrop-blur transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:shadow-md dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/90 dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]">
                <FileUp className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />
                导入JSON
                <input key={importInputKey} type="file" accept="application/json,.json" onChange={importPlan} className="hidden" />
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsExportMenuOpen((isOpen) => !isOpen)}
                  aria-expanded={isExportMenuOpen}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-stone-600 shadow-sm backdrop-blur transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:shadow-md dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/90 dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]"
                >
                  <Download className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />
                  导出
                  <ChevronDown className="h-3.5 w-3.5 text-stone-400 dark:text-[#7a746c]" />
                </button>
                {isExportMenuOpen ? (
                  <div className="dropdown-enter absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-xl border border-stone-200/80 bg-white/95 p-1 shadow-lg backdrop-blur-lg dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/95 dark:shadow-card-dark">
                    <button
                      type="button"
                      onClick={() => runExportAction(exportPlan)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-stone-600 transition hover:bg-stone-50 dark:text-[#9a9389] dark:hover:bg-[#2e2b26]"
                    >
                      <Download className="h-4 w-4" />
                      JSON
                    </button>
                    <button
                      type="button"
                      onClick={() => runExportAction(exportMarkdown)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-stone-600 transition hover:bg-stone-50 dark:text-[#9a9389] dark:hover:bg-[#2e2b26]"
                    >
                      <FileText className="h-4 w-4" />
                      Markdown
                    </button>
                    <button
                      type="button"
                      onClick={() => runExportAction(exportImage)}
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-stone-600 transition hover:bg-stone-50 dark:text-[#9a9389] dark:hover:bg-[#2e2b26]"
                    >
                      <ImageDown className="h-4 w-4" />
                      图片
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          {isBoardCollapsed ? null : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white/80 p-3 transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/80">
                <div className="mr-1 inline-flex items-center gap-2 text-xs font-semibold text-stone-500 dark:text-[#7a746c]">
                  <SlidersHorizontal className="h-4 w-4" />
                  类型筛选
                </div>
            <button
              type="button"
              onClick={showAllTypes}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                !isFilteredView
                  ? 'border-stone-950 bg-stone-950 text-white shadow-sm dark:border-[#e8e4df] dark:bg-[#e8e4df] dark:text-[#141210]'
                  : 'border-stone-200/80 bg-white/90 text-stone-600 hover:bg-stone-50 dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/90 dark:text-[#9a9389] dark:hover:bg-[#2e2b26]'
              }`}
            >
              全部 {itineraryItemCount}
            </button>
            {typeOptions.map((type) => {
              const isActive = activeTypes.includes(type);
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleTypeFilter(type)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
                    isActive
                      ? getTypeBadgeClass(type)
                      : 'border-stone-200/80 bg-white/90 text-stone-400 hover:bg-stone-50 dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/90 dark:text-[#5e584f] dark:hover:bg-[#2e2b26]'
                  }`}
                  aria-pressed={isActive}
                >
                  <span className={`h-2 w-2 rounded-full transition-transform duration-200 ${typeAccent[type]} ${isActive ? 'scale-125' : ''}`} />
                  {type} {typeCounts[type] || 0}
                </button>
              );
            })}
            {isFilteredView ? (
              <span className="text-xs font-medium text-stone-500 dark:text-[#7a746c]">
                当前显示 {visibleItemCount}/{itineraryItemCount} 项，筛选视图下卡片排序已暂停。
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setIsAddFormOpen((isOpen) => !isOpen)}
              aria-expanded={isAddFormOpen}
              aria-label={isAddFormOpen ? '收起添加行程' : '添加行程'}
              title={isAddFormOpen ? '收起添加行程' : '添加行程'}
              className={`ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-semibold transition ${
                isAddFormOpen
                  ? 'border-stone-950 bg-stone-950 text-white dark:border-[#e8e4df] dark:bg-[#e8e4df] dark:text-[#141210]'
                  : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]'
              }`}
            >
              {isAddFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            </button>
          </div>
          {isAddFormOpen ? (
            <form
              onSubmit={addCustomCard}
              className="mb-4 grid gap-2 rounded-xl border border-stone-200/80 bg-white/80 p-3 transition-all duration-300 dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/80 md:grid-cols-[120px_120px_minmax(160px,1.1fr)_120px_120px_minmax(180px,1.2fr)_auto]"
            >
              <select
                value={cardForm.day}
                onChange={(event) => updateCardForm('day', event.target.value)}
                className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:focus:border-[#5a554e]"
                aria-label="选择日期"
              >
                {dayNames.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
              <select
                value={cardForm.type}
                onChange={(event) => updateCardForm('type', event.target.value)}
                className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:focus:border-[#5a554e]"
                aria-label="选择类型"
              >
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <input
                value={cardForm.title}
                onChange={(event) => updateCardForm('title', event.target.value)}
                className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                placeholder="卡片标题"
              />
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={cardForm.cost}
                onChange={(event) => updateCardForm('cost', event.target.value)}
                className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                placeholder="金额（元）"
              />
              <input
                value={cardForm.duration}
                onChange={(event) => updateCardForm('duration', event.target.value)}
                className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                placeholder="耗时"
              />
              <input
                value={cardForm.advice}
                onChange={(event) => updateCardForm('advice', event.target.value)}
                className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                placeholder="建议"
              />
              <button
                type="submit"
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-stone-800 hover:shadow-md dark:bg-[#e8e4df] dark:text-[#141210] dark:hover:bg-[#d8d4cf]"
              >
                <Check className="h-4 w-4" />
                保存
              </button>
            </form>
          ) : null}
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="day-board" direction="horizontal" type="DAY">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-4 overflow-x-auto pb-3">
                  {visibleDays.map(([day, items], index) => (
                    <Draggable key={day} draggableId={`column-${day}`} index={index}>
                      {(dayProvided, daySnapshot) => (
                        <div
                          ref={dayProvided.innerRef}
                          {...dayProvided.draggableProps}
                          style={dayProvided.draggableProps.style}
                        >
                          <DayColumn
                            day={day}
                            items={items}
                            dateInfo={getDayDateInfo(plan.start_date, day)}
                            weather={plan.weather?.[day] || ''}
                            totalItems={plan.itinerary[day]?.length || 0}
                            isFilteredView={isFilteredView}
                            canDeleteDay={dayNames.length > 1}
                            dayDragHandleProps={dayProvided.dragHandleProps}
                            isDraggingDay={daySnapshot.isDragging}
                            pendingDeleteId={pendingDeleteId}
                            editingCardId={editingCardId}
                            editForm={editForm}
                            onDeleteDay={deleteDay}
                            onStartEdit={startEditCard}
                            onEditField={updateEditForm}
                            onSaveEdit={saveCardEdit}
                            onCancelEdit={() => setEditingCardId('')}
                            onDuplicate={duplicateCard}
                            onSetDayDate={setDayDate}
                            onRequestDelete={setPendingDeleteId}
                            onConfirmDelete={deleteCard}
                            onCancelDelete={() => setPendingDeleteId('')}
                          />
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
              </DragDropContext>
            </>
          )}
        </section>

        <div id="packing-list" ref={packingSectionRef} className="scroll-mt-5">
          <PackingList
            items={packingItems}
            form={packingForm}
            isCollapsed={isPackingCollapsed}
            activeCategory={activePackingCategory}
            searchQuery={packingSearchQuery}
            onFormField={updatePackingForm}
            onAddItem={addPackingItem}
            onToggleCollapsed={() => setIsPackingCollapsed((isCollapsed) => !isCollapsed)}
            onCategoryFilter={setActivePackingCategory}
            onSearchQuery={setPackingSearchQuery}
            onClearFilters={clearPackingFilters}
            onToggleItem={togglePackingItem}
            onDeleteItem={deletePackingItem}
            onReorderItems={reorderPackingItems}
            editingPackingId={editingPackingId}
            editingPackingForm={editingPackingForm}
            onStartEditPackingItem={startEditPackingItem}
            onEditPackingField={updateEditingPackingForm}
            onSavePackingItemEdit={savePackingItemEdit}
            onCancelPackingItemEdit={cancelPackingItemEdit}
          />
        </div>
      </div>
    </main>
  );
}

export default App;
