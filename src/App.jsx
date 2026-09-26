import React, { useEffect, useRef, useState } from 'react';
import { PackingList } from './components/ItineraryComponents.jsx';
import { PlanSummary } from './components/PlanSummary.jsx';
import { ItineraryBoard } from './components/ItineraryBoard.jsx';
import { normalizeImportedPlan } from './utils/plan-normalize.js';
import { buildPlanImageBlob } from './utils/plan-image.js';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  LoaderCircle,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { LoadingProgress, ThemeToggle } from './components/TravelControls.jsx';
import { useTheme } from './hooks/useTheme.js';
import { loadStoredConversation, loadStoredPlan } from './utils/storage.js';
import { preserveConcurrentPlanEdits } from './utils/plan-merge.js';
import { updatePlanDayDate } from './utils/plan-weather.js';
import { buildMarkdown, saveBlobFile, saveTextFile } from './utils/export.js';
import {
  renumberItineraryDays,
} from './utils/date.js';
import {
  createCardEditForm,
  createEmptyCardForm,
  createEmptyPackingForm,
  formatCostAmount,
  getAllItems,
  getBudgetRange,
  packingCategories,
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

function App() {
  const [plan, setPlan] = useState(() => loadStoredPlan(initialTripPlan, normalizeImportedPlan));
  const planRef = useRef(plan);
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
  const planRevisionRef = useRef(0);
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

  const updatePlan = (updater) => {
    const nextPlan = typeof updater === 'function' ? updater(planRef.current) : updater;
    planRevisionRef.current += 1;
    planRef.current = nextPlan;
    setPlan(nextPlan);
  };

  const setItinerary = (nextItinerary) => {
    updatePlan((currentPlan) => ({ ...currentPlan, itinerary: nextItinerary }));
  };

  const setPackingItems = (nextItems) => {
    updatePlan((currentPlan) => ({ ...currentPlan, packing_items: nextItems }));
  };

  const setDayDate = (day, dayDateValue) => {
    const nextPlan = updatePlanDayDate(plan, day, dayDateValue);
    if (nextPlan !== plan) updatePlan(() => nextPlan);
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

    updatePlan((currentPlan) => ({
      ...currentPlan,
      itinerary: nextItinerary,
      weather: {},
      weather_context: null,
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

      updatePlan((currentPlan) => ({
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
    const revisionAtStart = planRevisionRef.current;
    const planAtStart = plan;

    try {
      const requestHistory = conversationHistory.slice(-6);
      const requestPlan = hasCurrentPlanContext ? compactPlanForAi(planAtStart) : null;
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
        throw new Error('接口返回的不是 JSON，请检查 API 服务或环境变量配置。');
      }

      setLastAiResponse(data);

      if (!response.ok) {
        throw new Error(data.error || '生成失败，请稍后重试。');
      }

      const normalizedGeneratedPlan = normalizeImportedPlan(data);
      const generatedPlan = {
        ...normalizedGeneratedPlan,
        packing_items: Array.isArray(data.packing_items) ? normalizedGeneratedPlan.packing_items : packingItems,
      };
      const hasPlanChanged = planRevisionRef.current !== revisionAtStart;
      const nextPlan = hasPlanChanged
        ? preserveConcurrentPlanEdits(planAtStart, planRef.current, generatedPlan)
        : generatedPlan;
      updatePlan(() => nextPlan);
      if (hasPlanChanged) {
        setError('生成已完成；期间的手动修改已保留。若要把新行程与这些修改合并，请基于当前看板再次优化。');
      }
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
      if (!hasPlanChanged) {
        setCardForm(createEmptyCardForm(Object.keys(nextPlan.itinerary)[0] || 'Day 1'));
        setEditingCardId('');
        setPendingDeleteId('');
      }
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
    updatePlan(() => emptyPlan);
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
      updatePlan(() => importedPlan);
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

        <PlanSummary
          budget={computedBudgetEstimate}
          transport={plan.recommended_transport}
          dayCount={plannedDayCount}
          itemCount={itineraryItemCount}
          packedCount={packedItemCount}
          packingCount={packingItems.length}
          onOpenPacking={scrollToPackingList}
        />

        <ItineraryBoard
          isBoardCollapsed={isBoardCollapsed}
          setIsBoardCollapsed={setIsBoardCollapsed}
          addDay={addDay}
          importInputKey={importInputKey}
          importPlan={importPlan}
          isExportMenuOpen={isExportMenuOpen}
          setIsExportMenuOpen={setIsExportMenuOpen}
          exportPlan={exportPlan}
          exportMarkdown={exportMarkdown}
          exportImage={exportImage}
          runExportAction={runExportAction}
          isFilteredView={isFilteredView}
          showAllTypes={showAllTypes}
          itineraryItemCount={itineraryItemCount}
          activeTypes={activeTypes}
          toggleTypeFilter={toggleTypeFilter}
          typeCounts={typeCounts}
          visibleItemCount={visibleItemCount}
          isAddFormOpen={isAddFormOpen}
          setIsAddFormOpen={setIsAddFormOpen}
          addCustomCard={addCustomCard}
          cardForm={cardForm}
          updateCardForm={updateCardForm}
          dayNames={dayNames}
          onDragEnd={onDragEnd}
          visibleDays={visibleDays}
          plan={plan}
          pendingDeleteId={pendingDeleteId}
          editingCardId={editingCardId}
          editForm={editForm}
          deleteDay={deleteDay}
          startEditCard={startEditCard}
          updateEditForm={updateEditForm}
          saveCardEdit={saveCardEdit}
          duplicateCard={duplicateCard}
          setDayDate={setDayDate}
          setPendingDeleteId={setPendingDeleteId}
          deleteCard={deleteCard}
        />

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
