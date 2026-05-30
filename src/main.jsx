import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import {
  AlertCircle,
  ArrowRight,
  Check,
  CalendarDays,
  Clock3,
  Coins,
  Download,
  FileUp,
  GripVertical,
  LoaderCircle,
  MapPinned,
  Moon,
  Pencil,
  Plane,
  Plus,
  RotateCcw,
  Route,
  Sparkles,
  Sun,
  TrainFront,
  Trash2,
  X,
} from 'lucide-react';
import './styles.css';

const initialTripPlan = {
  total_budget_estimate: '2500-3000元',
  recommended_transport: '高铁 + 市内网约车',
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

const typeStyles = {
  交通: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-400',
  景点: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400',
  citywalk: 'border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-900 dark:bg-lime-950/40 dark:text-lime-400',
  美食: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400',
  酒店: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-400',
};

const typeAccent = {
  交通: 'bg-sky-500',
  景点: 'bg-emerald-500',
  citywalk: 'bg-lime-500',
  美食: 'bg-amber-500',
  酒店: 'bg-violet-500',
};

const typeOptions = ['交通', '景点', 'citywalk', '美食', '酒店'];
const storageKey = 'travel-plan-board-v1';
const themeKey = 'travel-plan-theme';

function getTypeBadgeClass(type) {
  return typeStyles[type] || 'border-stone-200 bg-stone-50 text-stone-700 dark:border-[#3a3630] dark:bg-[#252320] dark:text-[#b5afa6]';
}

function createEmptyCardForm(day) {
  return {
    day,
    type: '景点',
    title: '',
    cost: '',
    duration: '',
    advice: '',
  };
}

function createCardEditForm(item) {
  return {
    type: item.type,
    title: item.title,
    cost: item.cost,
    duration: item.duration,
    advice: item.advice,
  };
}

function loadStoredPlan() {
  if (typeof window === 'undefined') return initialTripPlan;

  try {
    const storedPlan = window.localStorage.getItem(storageKey);
    return storedPlan ? normalizeImportedPlan(JSON.parse(storedPlan)) : initialTripPlan;
  } catch {
    return initialTripPlan;
  }
}

function renumberItineraryDays(itinerary) {
  return Object.fromEntries(Object.values(itinerary).map((items, index) => [`Day ${index + 1}`, items]));
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
            cost: String(item?.cost || '待估算'),
            duration: String(item?.duration || '待安排'),
            advice: String(item?.advice || '暂无建议。'),
          };
        })
      : [];
  });

  if (Object.keys(normalizedItinerary).length === 0) {
    throw new Error('JSON 中没有可用的 Day 数据。');
  }

  return {
    total_budget_estimate: String(value.total_budget_estimate || '待估算'),
    recommended_transport: String(value.recommended_transport || '待推荐'),
    itinerary: renumberItineraryDays(normalizedItinerary),
  };
}

function useTheme() {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'system';
    return localStorage.getItem(themeKey) || 'system';
  });

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mql.matches);
      document.documentElement.classList.toggle('dark', isDark);
      if (theme !== 'system') {
        localStorage.setItem(themeKey, theme);
      } else {
        localStorage.removeItem(themeKey);
      }
    };
    apply();
    mql.addEventListener('change', apply);
    return () => mql.removeEventListener('change', apply);
  }, [theme]);

  const resolved = theme === 'system'
    ? (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
    : theme;

  return { theme, resolved, setTheme };
}

function ThemeToggle({ theme, setTheme }) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm transition hover:border-stone-300 hover:text-stone-700 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#7a746c] dark:hover:border-[#5a554e] dark:hover:text-[#b5afa6]"
      aria-label="切换主题"
      title="切换主题"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

function TripCard({
  item,
  isDragging,
  pendingDeleteId,
  editingCardId,
  editForm,
  onStartEdit,
  onEditField,
  onSaveEdit,
  onCancelEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) {
  const isConfirmingDelete = pendingDeleteId === item.id;
  const isEditing = editingCardId === item.id;

  return (
    <article
      className={`group relative overflow-hidden rounded-lg border bg-white p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-card dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:shadow-none dark:hover:shadow-card-dark ${
        isDragging ? 'border-stone-400 shadow-card ring-2 ring-stone-300 dark:border-[#5a554e] dark:ring-[#4a453e] dark:shadow-card-dark' : 'border-stone-200'
      }`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 ${typeAccent[item.type] || 'bg-slate-400'}`} />
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${getTypeBadgeClass(item.type)}`}>
          {item.type}
        </span>
        <div className="flex items-center gap-1 text-stone-400 transition group-hover:text-stone-700 dark:text-[#5e584f] dark:group-hover:text-[#b5afa6]">
          <GripVertical className="h-4 w-4 shrink-0" />
          <MapPinned className="h-4 w-4 shrink-0" />
          <button
            type="button"
            onClick={onStartEdit}
            aria-label={`编辑 ${item.title}`}
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:text-[#5e584f] dark:hover:bg-[#2e2b26] dark:hover:text-[#b5afa6]"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`删除 ${item.title}`}
            className="ml-1 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:text-[#5e584f] dark:hover:bg-red-950/30 dark:hover:text-red-400"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      {isEditing ? (
        <div className="mt-3 space-y-2 rounded-md border border-stone-200 bg-stone-50 p-2 dark:border-[#3a3630] dark:bg-[#252320]">
          <select
            value={editForm.type}
            onChange={(event) => onEditField('type', event.target.value)}
            className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:focus:border-[#5a554e]"
            aria-label="编辑类型"
          >
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            value={editForm.title}
            onChange={(event) => onEditField('title', event.target.value)}
            className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
            placeholder="卡片标题"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={editForm.cost}
              onChange={(event) => onEditField('cost', event.target.value)}
              className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="费用"
            />
            <input
              value={editForm.duration}
              onChange={(event) => onEditField('duration', event.target.value)}
              className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="耗时"
            />
          </div>
          <textarea
            value={editForm.advice}
            onChange={(event) => onEditField('advice', event.target.value)}
            className="h-20 w-full resize-none rounded-md border border-stone-200 bg-white px-2 py-2 text-sm leading-5 text-stone-700 outline-none placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
            placeholder="建议"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-stone-950 px-2 text-xs font-semibold text-white transition hover:bg-stone-800 dark:bg-[#e8e4df] dark:text-[#141210] dark:hover:bg-[#d8d4cf]"
            >
              <Check className="h-3.5 w-3.5" />
              保存
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#b5afa6] dark:hover:bg-[#2e2b26]"
            >
              <X className="h-3.5 w-3.5" />
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="mt-3 text-base font-semibold leading-snug text-stone-950 dark:text-[#e8e4df]">{item.title}</h3>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-stone-600 dark:text-[#9a9389]">
            <div className="flex items-center gap-1.5 rounded-md bg-stone-50 px-2 py-2 dark:bg-[#252320]">
              <Coins className="h-3.5 w-3.5 text-stone-500 dark:text-[#7a746c]" />
              <span>{item.cost}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-md bg-stone-50 px-2 py-2 dark:bg-[#252320]">
              <Clock3 className="h-3.5 w-3.5 text-stone-500 dark:text-[#7a746c]" />
              <span>{item.duration}</span>
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-600 dark:text-[#9a9389]">{item.advice}</p>
        </>
      )}
      {isConfirmingDelete ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
          <p className="leading-5">确定删除这张卡片吗？</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onConfirmDelete}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-red-600 px-2 text-xs font-semibold text-white transition hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
            >
              <Check className="h-3.5 w-3.5" />
              删除
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-red-700 transition hover:bg-red-100 dark:border-red-900/50 dark:bg-[#1e1c1a] dark:text-red-400 dark:hover:bg-red-900/30"
            >
              <X className="h-3.5 w-3.5" />
              取消
            </button>
          </div>
        </div>
      ) : null}
    </article>
  );
}


function DayColumn({
  day,
  items,
  canDeleteDay,
  dayDragHandleProps,
  isDraggingDay,
  pendingDeleteId,
  editingCardId,
  editForm,
  onDeleteDay,
  onStartEdit,
  onEditField,
  onSaveEdit,
  onCancelEdit,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) {
  return (
    <section
      className={`flex min-h-[520px] w-[292px] shrink-0 flex-col rounded-lg border bg-stone-50/80 p-3 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/80 dark:shadow-soft-dark ${
        isDraggingDay ? 'border-stone-400 ring-2 ring-stone-300 dark:border-[#5a554e] dark:ring-[#4a453e]' : 'border-stone-200/80'
      }`}
    >
      <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-[#3a3630]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">行程日</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">{day}</h2>
        </div>
        <div className="flex items-center gap-1">
          {canDeleteDay ? (
            <button
              type="button"
              onClick={() => onDeleteDay(day)}
              aria-label={`删除 ${day}`}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-stone-400 shadow-sm transition hover:bg-red-50 hover:text-red-600 dark:bg-[#1e1c1a] dark:text-[#5e584f] dark:hover:bg-red-950/30 dark:hover:text-red-400"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
          <div
            {...dayDragHandleProps}
            role="button"
            aria-label={`拖拽 ${day}`}
            className="flex h-10 w-10 cursor-grab items-center justify-center rounded-full bg-white text-stone-700 shadow-sm transition active:cursor-grabbing dark:bg-[#1e1c1a] dark:text-[#b5afa6]"
            title="拖拽调整天数顺序"
          >
            <CalendarDays className="h-5 w-5" />
          </div>
        </div>
      </div>
      <Droppable droppableId={day} type="CARD">
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={`mt-3 flex flex-1 flex-col gap-3 rounded-lg transition ${
              snapshot.isDraggingOver ? 'bg-white/90 ring-2 ring-stone-300 dark:bg-[#1e1c1a]/90 dark:ring-[#4a453e]' : ''
            }`}
          >
            {items.length > 0 ? (
              items.map((item, index) => (
                <Draggable key={item.id} draggableId={item.id} index={index}>
                  {(dragProvided, dragSnapshot) => (
                    <div
                      ref={dragProvided.innerRef}
                      {...dragProvided.draggableProps}
                      {...dragProvided.dragHandleProps}
                      style={dragProvided.draggableProps.style}
                    >
                      <TripCard
                        item={item}
                        isDragging={dragSnapshot.isDragging}
                        pendingDeleteId={pendingDeleteId}
                        editingCardId={editingCardId}
                        editForm={editForm}
                        onStartEdit={() => onStartEdit(item)}
                        onEditField={onEditField}
                        onSaveEdit={() => onSaveEdit(day, item.id)}
                        onCancelEdit={onCancelEdit}
                        onRequestDelete={() => onRequestDelete(item.id)}
                        onConfirmDelete={() => onConfirmDelete(day, item.id)}
                        onCancelDelete={onCancelDelete}
                      />
                    </div>
                  )}
                </Draggable>
              ))
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-stone-300 bg-white/60 p-6 text-center text-sm text-stone-400 dark:border-[#4a453e] dark:bg-[#1e1c1a]/60 dark:text-[#5e584f]">
                拖入卡片
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </section>
  );
}

function App() {
  const [plan, setPlan] = useState(loadStoredPlan);
  const [idea, setIdea] = useState('我想去洛阳、开封旅游，在10月下旬，5天。预算大概多少，交通工具。');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [cardForm, setCardForm] = useState(createEmptyCardForm('Day 1'));
  const [pendingDeleteId, setPendingDeleteId] = useState('');
  const [editingCardId, setEditingCardId] = useState('');
  const [editForm, setEditForm] = useState(createCardEditForm(initialTripPlan.itinerary['Day 1'][0]));
  const [importInputKey, setImportInputKey] = useState(0);
  const { theme, setTheme } = useTheme();
  const days = Object.entries(plan.itinerary);
  const dayNames = Object.keys(plan.itinerary);
  const plannedDayCount = dayNames.length;
  const itineraryItemCount = days.reduce((total, [, items]) => total + items.length, 0);

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(plan));
    } catch {
      // Local storage can be unavailable in restricted browser modes; the board still works in memory.
    }
  }, [plan]);

  const setItinerary = (nextItinerary) => {
    setPlan((currentPlan) => ({ ...currentPlan, itinerary: nextItinerary }));
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
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea: trimmedIdea }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '生成失败，请稍后重试。');
      }

      const generatedPlan = normalizeImportedPlan(data);
      setPlan(generatedPlan);
      setCardForm(createEmptyCardForm(Object.keys(generatedPlan.itinerary)[0] || 'Day 1'));
      setEditingCardId('');
      setPendingDeleteId('');
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const updateCardForm = (field, value) => {
    setCardForm((currentForm) => ({ ...currentForm, [field]: value }));
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
      cost: cardForm.cost.trim() || '待估算',
      duration: cardForm.duration.trim() || '待安排',
      advice: cardForm.advice.trim() || '暂无建议。',
    };

    setError('');
    setItinerary({
      ...plan.itinerary,
      [targetDay]: [...plan.itinerary[targetDay], newCard],
    });
    setCardForm(createEmptyCardForm(targetDay));
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
              cost: editForm.cost.trim() || '待估算',
              duration: editForm.duration.trim() || '待安排',
              advice: editForm.advice.trim() || '暂无建议。',
            }
          : item,
      ),
    });
    setEditingCardId('');
  };

  const resetBoard = () => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore storage errors and keep the reset behavior in memory.
    }
    setPlan(initialTripPlan);
    setCardForm(createEmptyCardForm('Day 1'));
    setPendingDeleteId('');
    setEditingCardId('');
    setError('');
  };

  const exportPlan = () => {
    const blob = new Blob([JSON.stringify(plan, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `travel-plan-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importPlan = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const importedPlan = normalizeImportedPlan(JSON.parse(content));
      setPlan(importedPlan);
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
    <main className="min-h-screen bg-[#f5f1e8] text-stone-900 transition-colors duration-300 dark:bg-[#141210] dark:text-[#e8e4df]">
      <div className="map-grid fixed inset-0 opacity-55" aria-hidden="true" />
      <div className="relative mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-5 rounded-lg border border-stone-200 bg-white/82 p-4 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/82 dark:shadow-soft-dark md:grid-cols-[1.25fr_0.75fr] md:p-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-semibold text-stone-600 dark:border-[#3a3630] dark:bg-[#252320] dark:text-[#9a9389]">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                AI 旅行草案
              </span>
              <span className="text-xs font-medium text-stone-500 dark:text-[#7a746c]">编辑看板 Step 5 版本</span>
            </div>
            <h1 className="mt-4 font-display text-4xl font-black leading-tight text-stone-950 dark:text-[#e8e4df] md:text-5xl">
              把粗略想法整理成可调整的每日行程
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-600 dark:text-[#9a9389] md:text-base">
              输入旅行想法后生成结构化 JSON，也可以手动添加、删除并拖拽调整卡片。
            </p>
          </div>

          <form onSubmit={generatePlan} className="rounded-lg border border-stone-200 bg-[#fbfaf7] p-3 transition dark:border-[#3a3630] dark:bg-[#252320]">
            <div className="flex items-center justify-between">
              <label htmlFor="trip-idea" className="text-sm font-semibold text-stone-800 dark:text-[#c4bdb4]">
                旅行想法
              </label>
              <ThemeToggle theme={theme} setTheme={setTheme} />
            </div>
            <textarea
              id="trip-idea"
              className="mt-2 h-28 w-full resize-none rounded-md border border-stone-200 bg-white px-3 py-2 text-sm leading-6 text-stone-700 outline-none ring-0 transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              value={idea}
              onChange={(event) => setIdea(event.target.value)}
              disabled={isGenerating}
            />
            {error ? (
              <div className="mt-3 flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : null}
            <button
              type="submit"
              disabled={isGenerating}
              className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:bg-stone-500 dark:bg-[#e8e4df] dark:text-[#141210] dark:hover:bg-[#d8d4cf] dark:disabled:bg-[#3a3630] dark:disabled:text-[#7a746c]"
            >
              {isGenerating ? '正在生成行程' : '生成行程草案'}
              {isGenerating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </button>
          </form>
        </header>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          <div className="rounded-lg border border-stone-200 bg-white/85 p-4 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">预算预估</p>
            <div className="mt-2 flex items-center gap-3">
              <Coins className="h-6 w-6 text-amber-600" />
              <p className="text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">{plan.total_budget_estimate}</p>
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white/85 p-4 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">推荐交通</p>
            <div className="mt-2 flex items-center gap-3">
              <TrainFront className="h-6 w-6 text-sky-600" />
              <p className="text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">{plan.recommended_transport}</p>
            </div>
          </div>
          <div className="rounded-lg border border-stone-200 bg-white/85 p-4 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/85 dark:shadow-soft-dark">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">规划范围</p>
            <div className="mt-2 flex items-center gap-3">
              <Route className="h-6 w-6 text-emerald-600" />
              <p className="text-2xl font-bold text-stone-950 dark:text-[#e8e4df]">
                {plannedDayCount}天 · {itineraryItemCount}项
              </p>
            </div>
          </div>
        </section>

        <section className="mt-5 flex-1 overflow-hidden rounded-lg border border-stone-200 bg-white/70 p-3 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/70 dark:shadow-soft-dark">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">Kanban Board</p>
              <h2 className="mt-1 text-lg font-bold text-stone-950 dark:text-[#e8e4df]">每日行程看板</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={addDay}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]"
              >
                <Plus className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />
                添加天数
              </button>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]">
                <FileUp className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />
                导入JSON
                <input key={importInputKey} type="file" accept="application/json,.json" onChange={importPlan} className="hidden" />
              </label>
              <button
                type="button"
                onClick={exportPlan}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]"
              >
                <Download className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />
                导出JSON
              </button>
              <button
                type="button"
                onClick={resetBoard}
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 transition hover:border-stone-300 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]"
              >
                <RotateCcw className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />
                恢复示例
              </button>
              <div className="flex items-center gap-2 rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-semibold text-stone-600 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389]">
                <Plane className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />
                已本地保存
              </div>
            </div>
          </div>
          <form
            onSubmit={addCustomCard}
            className="mb-4 grid gap-2 rounded-lg border border-stone-200 bg-white/80 p-3 transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/80 md:grid-cols-[120px_120px_minmax(160px,1.1fr)_120px_120px_minmax(180px,1.2fr)_auto]"
          >
            <select
              value={cardForm.day}
              onChange={(event) => updateCardForm('day', event.target.value)}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:focus:border-[#5a554e]"
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
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:focus:border-[#5a554e]"
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
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="卡片标题"
            />
            <input
              value={cardForm.cost}
              onChange={(event) => updateCardForm('cost', event.target.value)}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="费用"
            />
            <input
              value={cardForm.duration}
              onChange={(event) => updateCardForm('duration', event.target.value)}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="耗时"
            />
            <input
              value={cardForm.advice}
              onChange={(event) => updateCardForm('advice', event.target.value)}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="建议"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 dark:bg-[#e8e4df] dark:text-[#141210] dark:hover:bg-[#d8d4cf]"
            >
              <Plus className="h-4 w-4" />
              添加
            </button>
          </form>
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="day-board" direction="horizontal" type="DAY">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="flex gap-4 overflow-x-auto pb-3">
                  {days.map(([day, items], index) => (
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
        </section>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
