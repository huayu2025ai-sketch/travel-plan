import React, { useEffect, useRef, useState } from 'react';
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
import { LoadingProgress } from './components/TravelControls.jsx';
import { loadStoredConversation, loadStoredPlan } from './utils/storage.js';
import { createTemplatePlan } from './content/templates.js';
import { clearTemplateParameter, getTemplateStart } from './utils/template-start.js';
import { trackProductEvent } from './utils/analytics.js';
import { preserveConcurrentPlanEdits } from './utils/plan-merge.js';
import { updatePlanDayDate } from './utils/plan-weather.js';
import { buildMarkdown, saveBlobFile, saveTextFile } from './utils/export.js';
import {
  renumberItineraryDays,
} from './utils/date.js';
import {
  createCardEditForm,
  createEmptyCardForm,
  formatCostAmount,
  getAllItems,
  getBudgetRange,
  typeOptions,
  withComputedBudget,
} from './utils/plan.js';
import './styles.css';
import './app-theme.css';

const initialTripPlan = {
  destination: '',
  start_date: '',
  total_budget_estimate: '2500-3000元',
  recommended_transport: '高铁 + 市内网约车',
  weather: {},
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
    itinerary: plan.itinerary,
  });
}

function App() {
  const [templateStart] = useState(() => {
    const storedPlan = loadStoredPlan(initialTripPlan, normalizeImportedPlan);
    const hasPersonalContext = loadStoredConversation().length > 0;
    let hasStoredPlan = false;
    try { hasStoredPlan = Boolean(window.localStorage.getItem(storageKey)); } catch { /* Storage may be unavailable. */ }
    const canReplace = !hasStoredPlan || (!hasPersonalContext && (!hasPlanContent(storedPlan) || isInitialDemoPlan(storedPlan)));
    return getTemplateStart(window.location.search, storedPlan, canReplace);
  });
  const [plan, setPlan] = useState(templateStart.plan);
  const [pendingTemplate, setPendingTemplate] = useState(templateStart.applied ? null : templateStart.template);
  const [templateNotice, setTemplateNotice] = useState(templateStart.applied ? `已载入「${templateStart.template.title}」，可以直接修改日期、费用和安排。` : '');
  const templateTrackedRef = useRef(false);
  const planRef = useRef(plan);
  const [idea, setIdea] = useState(templateStart.applied ? '' : '我想去洛阳、开封旅游，在10月下旬，5天。预算大概多少，交通工具。');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(templateStart.invalid ? '没有找到这份模板，已保留当前行程。请从模板目录重新选择。' : '');
  const [cardForm, setCardForm] = useState(createEmptyCardForm('Day 1'));
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [editingCardId, setEditingCardId] = useState('');
  const [editForm, setEditForm] = useState(createCardEditForm(initialTripPlan.itinerary['Day 1'][0]));
  const [importInputKey, setImportInputKey] = useState(0);
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [isBoardCollapsed, setIsBoardCollapsed] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [activeTypes, setActiveTypes] = useState(typeOptions);
  const [conversationHistory, setConversationHistory] = useState(() => templateStart.applied ? [] : loadStoredConversation());
  const [generationProgress, setGenerationProgress] = useState(0);
  const [generationStageIndex, setGenerationStageIndex] = useState(0);
  const [lastAiRequest, setLastAiRequest] = useState(null);
  const [lastAiResponse, setLastAiResponse] = useState(null);
  const [isAiDebugOpen, setIsAiDebugOpen] = useState(false);
  const planRevisionRef = useRef(0);
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
  const typeCounts = typeOptions.reduce((counts, type) => {
    counts[type] = getAllItems(plan.itinerary).filter((item) => item.type === type).length;
    return counts;
  }, {});
  const hasCurrentPlanContext = hasPlanContent(plan) && !isInitialDemoPlan(plan);
  const hasAiContext = hasCurrentPlanContext || conversationHistory.length > 0;

  useEffect(() => {
    if (templateStart.applied && !templateTrackedRef.current) {
      templateTrackedRef.current = true;
      trackProductEvent('template_use', { template: templateStart.template.slug });
      clearTemplateParameter();
    } else if (templateStart.invalid) clearTemplateParameter();
  }, [templateStart]);

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

  const updatePlan = (updater, { trackEdit = true } = {}) => {
    const nextPlan = typeof updater === 'function' ? updater(planRef.current) : updater;
    planRevisionRef.current += 1;
    planRef.current = nextPlan;
    setPlan(nextPlan);
    if (trackEdit) trackProductEvent('plan_edit');
  };

  const applyPendingTemplate = () => {
    if (!pendingTemplate || isGenerating) return;
    const nextPlan = normalizeImportedPlan(createTemplatePlan(pendingTemplate));
    updatePlan(() => nextPlan, { trackEdit: false });
    setConversationHistory([]);
    setIdea('');
    setError('');
    setLastAiRequest(null);
    setLastAiResponse(null);
    setIsAiDebugOpen(false);
    setEditingCardId('');
    setPendingDeleteId('');
    setCardForm(createEmptyCardForm('Day 1'));
    setActiveTypes(typeOptions);
    setIsBoardCollapsed(false);
    setTemplateNotice(`已载入「${pendingTemplate.title}」，可以直接修改日期、费用和安排。`);
    trackProductEvent('template_use', { template: pendingTemplate.slug });
    setPendingTemplate(null);
    clearTemplateParameter();
  };

  const setItinerary = (nextItinerary) => {
    updatePlan((currentPlan) => ({ ...currentPlan, itinerary: nextItinerary }));
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
      const generatedPlan = normalizedGeneratedPlan;
      const hasPlanChanged = planRevisionRef.current !== revisionAtStart;
      const nextPlan = hasPlanChanged
        ? preserveConcurrentPlanEdits(planAtStart, planRef.current, generatedPlan)
        : generatedPlan;
      updatePlan(() => nextPlan, { trackEdit: false });
      trackProductEvent('generate_success', { mode: hasCurrentPlanContext ? 'optimize' : 'create' });
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
      itinerary: { 'Day 1': [] },
    };

    try {
      window.localStorage.removeItem(storageKey);
      window.localStorage.removeItem(conversationStorageKey);
    } catch {
      // The in-memory reset below still works if storage is unavailable.
    }

    setIdea('');
    updatePlan(() => emptyPlan, { trackEdit: false });
    setTemplateNotice('');
    setCardForm(createEmptyCardForm('Day 1'));
    setPendingDeleteId('');
    setEditingCardId('');
    setIsAddFormOpen(false);
    setIsBoardCollapsed(false);
    setActiveTypes(typeOptions);
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
    const saved = await saveTextFile(
      JSON.stringify(currentPlanForExport, null, 2),
      `travel-plan-${new Date().toISOString().slice(0, 10)}.json`,
      'application/json;charset=utf-8',
      'JSON 文件',
      { 'application/json': ['.json'] },
    );
    if (saved) trackProductEvent('export_success', { format: 'json' });
  };

  const exportMarkdown = async () => {
    const saved = await saveTextFile(
      buildMarkdown(currentPlanForExport),
      `travel-plan-${new Date().toISOString().slice(0, 10)}.md`,
      'text/markdown;charset=utf-8',
      'Markdown 文件',
      { 'text/markdown': ['.md'], 'text/plain': ['.txt'] },
    );
    if (saved) trackProductEvent('export_success', { format: 'markdown' });
  };

  const exportImage = async () => {
    try {
      const blob = await buildPlanImageBlob(currentPlanForExport);
      const saved = await saveBlobFile(
        blob,
        `travel-plan-${new Date().toISOString().slice(0, 10)}.png`,
        'PNG 图片',
        { 'image/png': ['.png'] },
      );
      if (saved) trackProductEvent('export_success', { format: 'png' });
    } catch (imageError) {
      setError(imageError.message || '图片导出失败，请稍后重试。');
    }
  };

  const runExportAction = async (action) => {
    setIsExportMenuOpen(false);
    try { await action(); }
    catch (exportError) { setError(exportError.message || '导出失败，请稍后重试。'); }
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
      updatePlan(() => importedPlan, { trackEdit: false });
      setCardForm(createEmptyCardForm(Object.keys(importedPlan.itinerary)[0]));
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
    <main className="travel-app min-h-screen">
      <div className="travel-app-frame relative mx-auto flex min-h-screen w-full flex-col px-4 py-5 sm:px-6 lg:px-8">
        <a className="travel-skip-link" href="#travel-board">跳到行程看板</a>
        <nav aria-label="主导航" className="travel-app-nav mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
          <a href="/" className="font-semibold">↗ 旅行规划看板</a>
          <div className="flex gap-5"><a href="/templates/">行程模板</a><a href="/guides/">使用指南</a><span aria-current="page">我的看板</span></div>
        </nav>
        {pendingTemplate && (
          <section aria-label="载入模板" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-5 text-sm text-stone-800  ">
            <h2 className="font-bold">当前浏览器已有行程</h2>
            <p className="my-2">载入「{pendingTemplate.title}」会替换当前看板并清除 AI 沟通记录。请先通过下方导出菜单备份需要保留的行程。</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" disabled={isGenerating} onClick={applyPendingTemplate} className="rounded-md bg-stone-800 px-4 py-2 text-white disabled:opacity-50">替换为这份模板</button>
              <button type="button" onClick={() => { setPendingTemplate(null); clearTemplateParameter(); }} className="rounded-md border border-stone-400 px-4 py-2">保留当前行程</button>
            </div>
          </section>
        )}
        {templateNotice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900  ">{templateNotice}</p>}
        <header className="travel-app-header animate-fade-up grid gap-5 rounded-2xl border border-stone-200/80 bg-white/85 p-5 shadow-soft backdrop-blur-lg transition-all duration-300 md:grid-cols-[1.25fr_0.75fr] md:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="travel-app-badge inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3" />
                AI 旅行草案
              </span>
            </div>
            <h1 className="mt-5 font-display text-4xl font-black leading-[1.15] tracking-tight text-stone-950  md:text-5xl">
              把粗略想法整理成
              <br className="hidden sm:block" />
              可调整的每日行程
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600  md:text-base">
              输入目的地、天数和预算，生成可拖拽修改的每日行程。继续说出你的偏好，AI 会在当前安排上优化；也可以直接编辑并导出图片。
            </p>
          </div>

          <form onSubmit={generatePlan} className="travel-prompt rounded-xl border border-stone-200/80 bg-[#fbfaf7]/90 p-3.5 backdrop-blur transition-all duration-300  ">
            <div className="flex items-center justify-between">
              <label htmlFor="trip-idea" className="text-sm font-semibold text-stone-800 ">
                {hasAiContext ? '继续优化' : '旅行想法'}
              </label>
            </div>
            <textarea
              id="trip-idea"
              className="mt-2 h-28 w-full resize-none rounded-lg border border-stone-200/80 bg-white px-3 py-2.5 text-sm leading-6 text-stone-700 outline-none ring-0 transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400     "
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              maxLength={2000}
              disabled={isGenerating}
            />
            {error ? (
              <div className="mt-3 flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700   ">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
            {isGenerating ? (
              <LoadingProgress progress={generationProgress} stage={generationStages[generationStageIndex]} stages={generationStages} />
            ) : null}
            {hasAiContext ? (
              <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium leading-5 text-emerald-700   ">
                已保留当前行程和最近沟通上下文，本轮输入会作为优化要求处理。点击清空行程后上下文会一并清除。
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <button
                type="submit"
                disabled={isGenerating}
                className="travel-primary-action inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-500     "
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
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-stone-200 bg-white px-3 py-3 text-stone-600 transition hover:border-stone-300 hover:bg-stone-50     "
                >
                  <ChevronDown className={`h-4 w-4 transition ${isAiDebugOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : null}
            </div>
            {isAiDebugOpen && lastAiRequest ? (
              <div className="mt-2 space-y-2 rounded-md border border-stone-200 bg-stone-50 p-3 text-xs  ">
                <div>
                  <p className="mb-1 font-semibold text-stone-600 ">发送给 DeepSeek 的内容</p>
                  <pre className="max-h-40 overflow-auto rounded bg-white p-2 text-stone-700  ">
                    {JSON.stringify(lastAiRequest, null, 2)}
                  </pre>
                </div>
                {lastAiResponse ? (
                  <div>
                    <p className="mb-1 font-semibold text-stone-600 ">DeepSeek 返回的内容</p>
                    <pre className="max-h-40 overflow-auto rounded bg-white p-2 text-stone-700  ">
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
              className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-stone-200/80 bg-white/80 px-3 py-2 text-xs font-semibold text-stone-400 transition-all duration-200 hover:border-red-200 hover:bg-red-50/80 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60      "
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


      </div>
    </main>
  );
}

export default App;
