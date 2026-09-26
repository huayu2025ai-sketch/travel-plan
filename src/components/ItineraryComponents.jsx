import React, { useRef } from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Coins,
  Copy,
  GripVertical,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { getDateBadgeClass } from '../utils/date.js';
import {
  getCardGlowClass,
  getFuzzyMatchScore,
  getTypeBadgeClass,
  packingCategories,
  typeAccent,
  typeOptions,
} from '../utils/plan.js';

export function TripCard({
  item,
  isDragging,
  pendingDeleteId,
  editingCardId,
  editForm,
  onStartEdit,
  onEditField,
  onSaveEdit,
  onCancelEdit,
  onDuplicate,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) {
  const isConfirmingDelete = pendingDeleteId === item.id;
  const isEditing = editingCardId === item.id;

  return (
    <article
      className={`group relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg dark:bg-[#1e1c1a] dark:shadow-none ${
        isDragging
          ? 'border-stone-400 shadow-xl ring-2 ring-stone-300/60 dark:border-[#5a554e] dark:ring-[#4a453e] dark:shadow-card-dark'
          : `border-stone-200/80 hover:border-stone-300/80 dark:border-[#3a3630]/80 dark:hover:border-[#4a453e]`
      } ${getCardGlowClass(item.type)}`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 rounded-full transition-all duration-300 ${typeAccent[item.type] || 'bg-slate-400'}`} />
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${getTypeBadgeClass(item.type)}`}>
          {item.type}
        </span>
        <div className="flex items-center gap-0.5 text-stone-400 opacity-0 transition-all duration-200 group-hover:opacity-100 dark:text-[#5e584f]">
          <GripVertical className="h-4 w-4 shrink-0" />
          <button
            type="button"
            onClick={onStartEdit}
            aria-label={`编辑 ${item.title}`}
            className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition-all duration-150 hover:bg-stone-100 hover:text-stone-700 dark:text-[#5e584f] dark:hover:bg-[#2e2b26] dark:hover:text-[#b5afa6]"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            aria-label={`复制 ${item.title}`}
            className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition-all duration-150 hover:bg-stone-100 hover:text-stone-700 dark:text-[#5e584f] dark:hover:bg-[#2e2b26] dark:hover:text-[#b5afa6]"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`删除 ${item.title}`}
            className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600 dark:text-[#5e584f] dark:hover:bg-red-950/30 dark:hover:text-red-400"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {isEditing ? (
        <div className="mt-3 space-y-2 rounded-xl border border-stone-200/80 bg-stone-50/80 p-2.5 dark:border-[#3a3630]/80 dark:bg-[#252320]/80">
          <select
            value={editForm.type}
            onChange={(event) => onEditField('type', event.target.value)}
            className="h-9 w-full rounded-lg border border-stone-200/80 bg-white px-2 text-sm text-stone-700 outline-none transition-all duration-200 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:focus:border-[#5a554e]"
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
            className="h-9 w-full rounded-lg border border-stone-200/80 bg-white px-2 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
            placeholder="卡片标题"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={editForm.cost}
              onChange={(event) => onEditField('cost', event.target.value)}
              className="h-9 rounded-lg border border-stone-200/80 bg-white px-2 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="费用：200-300元 / 260元/晚×3晚"
            />
            <input
              value={editForm.duration}
              onChange={(event) => onEditField('duration', event.target.value)}
              className="h-9 rounded-lg border border-stone-200/80 bg-white px-2 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="耗时"
            />
          </div>
          <textarea
            value={editForm.advice}
            onChange={(event) => onEditField('advice', event.target.value)}
            className="h-20 w-full resize-none rounded-lg border border-stone-200/80 bg-white px-2 py-2 text-sm leading-5 text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630]/80 dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
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
          <h3 className="mt-3 text-[15px] font-bold leading-snug text-stone-950 dark:text-[#e8e4df]">{item.title}</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-600 dark:text-[#9a9389]">
            <div className="flex items-center gap-1.5 rounded-lg bg-stone-50/80 px-2.5 py-2 dark:bg-[#252320]/80">
              <Coins className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400" />
              <span className="font-medium">{item.cost}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-stone-50/80 px-2.5 py-2 dark:bg-[#252320]/80">
              <Clock3 className="h-3.5 w-3.5 text-sky-500 dark:text-sky-400" />
              <span className="font-medium">{item.duration}</span>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-stone-500 dark:text-[#8a847b]">{item.advice}</p>
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


export function DayColumn({
  day,
  items,
  dateInfo,
  weather,
  totalItems,
  isFilteredView,
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
  onDuplicate,
  onSetDayDate,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
}) {
  const dateInputRef = useRef(null);
  const openDatePicker = () => {
    const input = dateInputRef.current;
    if (!input) return;

    if (typeof input.showPicker === 'function') {
      input.showPicker();
      return;
    }

    input.focus();
    input.click();
  };

  return (
    <section
      className={`flex min-h-[520px] w-[292px] shrink-0 flex-col rounded-xl border bg-stone-50/80 p-3 shadow-soft backdrop-blur transition-all duration-300 dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/80 dark:shadow-soft-dark ${
        isDraggingDay ? 'border-stone-400 ring-2 ring-stone-300/60 shadow-lg dark:border-[#5a554e] dark:ring-[#4a453e]' : 'border-stone-200/80'
      }`}
    >
      <div className="border-b border-stone-200/80 pb-3 dark:border-[#3a3630]/80">
        <div className="flex min-w-0 items-center gap-2">
          <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400 dark:text-[#5e584f]">行程日</p>
          {dateInfo.displayText ? (
            <span className={`min-w-0 truncate rounded-full px-2 py-0.5 text-[11px] font-bold ${getDateBadgeClass(dateInfo)}`}>
              {dateInfo.displayText}
            </span>
          ) : null}
        </div>
        {weather ? (
          <p className="mt-1 truncate text-xs text-stone-500 dark:text-[#7a746c]">{weather}</p>
        ) : null}
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate font-display text-2xl font-black tracking-tight text-stone-950 dark:text-[#e8e4df]">{day}</h2>
          <div className="flex shrink-0 items-center gap-1">
          {canDeleteDay ? (
            <button
              type="button"
              onClick={() => onDeleteDay(day)}
              aria-label={`删除 ${day}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-400 shadow-sm transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:shadow-md dark:bg-[#1e1c1a]/90 dark:text-[#5e584f] dark:hover:bg-red-950/30 dark:hover:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={openDatePicker}
            aria-label={`选择 ${day} 日期`}
            title="选择日期"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-500 shadow-sm transition-all duration-200 hover:bg-emerald-50 hover:text-emerald-600 hover:shadow-md dark:bg-[#1e1c1a]/90 dark:text-[#7a746c] dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400"
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </button>
          <div
            {...dayDragHandleProps}
            role="button"
            aria-label={`拖拽 ${day}`}
            className="flex h-9 w-9 cursor-grab items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-sm transition-all duration-200 active:cursor-grabbing hover:shadow-md dark:bg-[#1e1c1a]/90 dark:text-[#b5afa6]"
            title="拖拽调整天数顺序"
          >
            <GripVertical className="h-5 w-5" />
          </div>
          </div>
        </div>
        <input
          ref={dateInputRef}
          type="date"
          value={dateInfo.inputValue}
          onChange={(event) => onSetDayDate(day, event.target.value)}
          onInput={(event) => onSetDayDate(day, event.currentTarget.value)}
          aria-label={`设置 ${day} 日期`}
          className="absolute h-px w-px opacity-0"
          tabIndex={-1}
        />
        {isFilteredView ? (
          <p className="mt-1 text-xs text-stone-500 dark:text-[#7a746c]">
            显示 {items.length}/{totalItems} 项
          </p>
        ) : null}
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
              items.map((item, index) => {
                const cardProps = {
                  item,
                  pendingDeleteId,
                  editingCardId,
                  editForm,
                  onStartEdit: () => onStartEdit(item),
                  onEditField,
                  onSaveEdit: () => onSaveEdit(day, item.id),
                  onCancelEdit,
                  onDuplicate: () => onDuplicate(day, item.id),
                  onRequestDelete: () => onRequestDelete(item.id),
                  onConfirmDelete: () => onConfirmDelete(day, item.id),
                  onCancelDelete,
                };

                if (isFilteredView) {
                  return <TripCard key={item.id} {...cardProps} isDragging={false} />;
                }

                return (
                  <Draggable key={item.id} draggableId={item.id} index={index}>
                    {(dragProvided, dragSnapshot) => (
                      <div
                        ref={dragProvided.innerRef}
                        {...dragProvided.draggableProps}
                        {...dragProvided.dragHandleProps}
                        style={dragProvided.draggableProps.style}
                      >
                        <TripCard {...cardProps} isDragging={dragSnapshot.isDragging} />
                      </div>
                    )}
                  </Draggable>
                );
              })
            ) : (
              <div className="empty-droppable flex flex-1 items-center justify-center rounded-xl border border-dashed border-stone-300/60 bg-white/40 p-6 text-center dark:border-[#4a453e]/60 dark:bg-[#1e1c1a]/40">
                <div>
                  <GripVertical className="mx-auto h-6 w-6 text-stone-300 dark:text-[#4a453e]" />
                  <p className="mt-2 text-sm text-stone-400 dark:text-[#5e584f]">
                    {isFilteredView ? '没有匹配类型的卡片' : '拖入卡片'}
                  </p>
                </div>
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </section>
  );
}

export function PackingList({
  items,
  form,
  isCollapsed,
  activeCategory,
  searchQuery,
  editingPackingId,
  editingPackingForm,
  onFormField,
  onAddItem,
  onToggleCollapsed,
  onCategoryFilter,
  onSearchQuery,
  onClearFilters,
  onToggleItem,
  onDeleteItem,
  onReorderItems,
  onStartEditPackingItem,
  onEditPackingField,
  onSavePackingItemEdit,
  onCancelPackingItemEdit,
}) {
  const packedCount = items.filter((item) => item.packed).length;
  const progress = items.length ? Math.round((packedCount / items.length) * 100) : 0;
  const filteredItems = items.filter((item) => {
    const categoryMatches = activeCategory === '全部' || item.category === activeCategory;
    const nameMatches = getFuzzyMatchScore(item.name, searchQuery) > 0;
    return categoryMatches && nameMatches;
  });
  const isFiltered = activeCategory !== '全部' || Boolean(searchQuery.trim());

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onReorderItems(result.source.index, result.destination.index, filteredItems);
  };

  return (
    <section className="mt-5 rounded-lg border border-stone-200 bg-white/82 p-4 shadow-soft backdrop-blur transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/82 dark:shadow-soft-dark">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-[#5e584f]">Packing List</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-950 dark:text-[#e8e4df]">携带物品记录</h2>
            <button
              type="button"
              onClick={onToggleCollapsed}
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? '展开携带物品记录' : '收起携带物品记录'}
              title={isCollapsed ? '展开携带物品记录' : '收起携带物品记录'}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#7a746c] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26] dark:hover:text-[#b5afa6]"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition ${isCollapsed ? '-rotate-90' : ''}`} />
            </button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-[180px] rounded-lg border border-stone-200 bg-stone-50 p-3 dark:border-[#3a3630] dark:bg-[#252320]">
            <div className="flex items-center justify-between gap-3 text-xs font-semibold text-stone-600 dark:text-[#9a9389]">
              <span>{packedCount}/{items.length} 已携带</span>
              <span>{progress}%</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white dark:bg-[#1e1c1a]">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {isCollapsed ? null : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white/75 p-3 transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/75">
            <div className="mr-1 inline-flex items-center gap-2 text-xs font-semibold text-stone-500 dark:text-[#7a746c]">
              <SlidersHorizontal className="h-4 w-4" />
              物品筛选
            </div>
            <button
              type="button"
              onClick={() => onCategoryFilter('全部')}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                activeCategory === '全部'
                  ? 'border-stone-950 bg-stone-950 text-white dark:border-[#e8e4df] dark:bg-[#e8e4df] dark:text-[#141210]'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:bg-[#2e2b26]'
              }`}
            >
              全部 {items.length}
            </button>
            {packingCategories.map((category) => {
              const categoryCount = items.filter((item) => item.category === category).length;
              return (
                <button
                  key={category}
                  type="button"
                  onClick={() => onCategoryFilter(category)}
                  className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    activeCategory === category
                      ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300'
                      : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#7a746c] dark:hover:bg-[#2e2b26]'
                  }`}
                  aria-pressed={activeCategory === category}
                >
                  {category} {categoryCount}
                </button>
              );
            })}
            <label className="relative ml-auto min-w-[200px] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 dark:text-[#7a746c]" />
              <input
                value={searchQuery}
                onChange={(event) => onSearchQuery(event.target.value)}
                className="h-9 w-full rounded-full border border-stone-200 bg-white pl-9 pr-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                placeholder="按名称模糊搜索"
              />
            </label>
            {isFiltered ? (
              <button
                type="button"
                onClick={onClearFilters}
                className="inline-flex h-9 items-center justify-center rounded-full border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-500 transition hover:bg-stone-50 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389] dark:hover:bg-[#2e2b26]"
              >
                清除
              </button>
            ) : null}
          </div>

          {isFiltered ? (
            <p className="mt-2 text-xs font-medium text-stone-500 dark:text-[#7a746c]">
              当前显示 {filteredItems.length}/{items.length} 件，拖动会调整可见物品在完整清单中的顺序。
            </p>
          ) : null}

          <form
            onSubmit={onAddItem}
            className="mt-4 grid gap-2 rounded-lg border border-stone-200 bg-white/70 p-3 transition dark:border-[#3a3630] dark:bg-[#1e1c1a]/70 md:grid-cols-[130px_minmax(150px,1fr)_120px_minmax(180px,1.2fr)_auto]"
          >
            <select
              value={form.category}
              onChange={(event) => onFormField('category', event.target.value)}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:focus:border-[#5a554e]"
              aria-label="物品分类"
            >
              {packingCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              value={form.name}
              onChange={(event) => onFormField('name', event.target.value)}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="物品名称"
            />
            <input
              value={form.quantity}
              onChange={(event) => onFormField('quantity', event.target.value)}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="数量"
            />
            <input
              value={form.note}
              onChange={(event) => onFormField('note', event.target.value)}
              className="h-10 rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
              placeholder="备注"
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 dark:bg-[#e8e4df] dark:text-[#141210] dark:hover:bg-[#d8d4cf]"
            >
              <Plus className="h-4 w-4" />
              添加
            </button>
          </form>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="packing-list" type="PACKING">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`mt-4 grid gap-2 rounded-lg transition sm:grid-cols-2 lg:grid-cols-4 ${
                    snapshot.isDraggingOver ? 'bg-white/70 ring-2 ring-stone-300 dark:bg-[#1e1c1a]/70 dark:ring-[#4a453e]' : ''
                  }`}
                >
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item, index) => {
                      const isEditing = editingPackingId === item.id;
                      return (
                        <Draggable
                          key={item.id}
                          draggableId={`packing-${item.id}`}
                          index={index}
                          isDragDisabled={isEditing}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <article
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              style={dragProvided.draggableProps.style}
                              className={`rounded-lg border p-3 transition ${
                                dragSnapshot.isDragging
                                  ? 'border-stone-400 shadow-card ring-2 ring-stone-300 dark:border-[#5a554e] dark:ring-[#4a453e] dark:shadow-card-dark'
                                  : item.packed
                                    ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/20'
                                    : 'border-stone-200 bg-white/80 dark:border-[#3a3630] dark:bg-[#252320]'
                              }`}
                            >
                              {isEditing ? (
                                <div className="space-y-2">
                                  <div className="grid gap-2 sm:grid-cols-[130px_1fr_100px]">
                                    <select
                                      value={editingPackingForm.category}
                                      onChange={(event) => onEditPackingField('category', event.target.value)}
                                      className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none transition focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:focus:border-[#5a554e]"
                                      aria-label="编辑分类"
                                    >
                                      {packingCategories.map((category) => (
                                        <option key={category} value={category}>
                                          {category}
                                        </option>
                                      ))}
                                    </select>
                                    <input
                                      value={editingPackingForm.name}
                                      onChange={(event) => onEditPackingField('name', event.target.value)}
                                      className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                                      placeholder="物品名称"
                                    />
                                    <input
                                      value={editingPackingForm.quantity}
                                      onChange={(event) => onEditPackingField('quantity', event.target.value)}
                                      className="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                                      placeholder="数量"
                                    />
                                  </div>
                                  <input
                                    value={editingPackingForm.note}
                                    onChange={(event) => onEditPackingField('note', event.target.value)}
                                    className="h-9 w-full rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-700 outline-none transition placeholder:text-stone-400 focus:border-stone-400 dark:border-[#3a3630] dark:bg-[#2a2724] dark:text-[#b5afa6] dark:placeholder:text-[#5e584f] dark:focus:border-[#5a554e]"
                                    placeholder="备注"
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      onClick={onSavePackingItemEdit}
                                      className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-stone-950 px-2 text-xs font-semibold text-white transition hover:bg-stone-800 dark:bg-[#e8e4df] dark:text-[#141210] dark:hover:bg-[#d8d4cf]"
                                    >
                                      <Check className="h-3.5 w-3.5" />
                                      保存
                                    </button>
                                    <button
                                      type="button"
                                      onClick={onCancelPackingItemEdit}
                                      className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#b5afa6] dark:hover:bg-[#2e2b26]"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                      取消
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start gap-3">
                                  <button
                                    type="button"
                                    onClick={() => onToggleItem(item.id)}
                                    aria-label={item.packed ? `取消携带 ${item.name}` : `标记已携带 ${item.name}`}
                                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition ${
                                      item.packed
                                        ? 'border-emerald-600 bg-emerald-600 text-white'
                                        : 'border-stone-300 bg-white text-transparent hover:border-emerald-500 dark:border-[#5a554e] dark:bg-[#1e1c1a]'
                                    }`}
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                  </button>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-center gap-2">
                                      <h3 className={`truncate text-sm font-semibold ${item.packed ? 'text-emerald-900 line-through decoration-emerald-500/60 dark:text-emerald-200' : 'text-stone-950 dark:text-[#e8e4df]'}`}>
                                        {item.name}
                                      </h3>
                                      <span className="shrink-0 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-stone-500 dark:border-[#3a3630] dark:bg-[#1e1c1a] dark:text-[#9a9389]">
                                        {item.category}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs font-medium text-stone-500 dark:text-[#7a746c]">
                                      数量：{item.quantity || '1'}
                                    </p>
                                    {item.note ? (
                                      <p className="mt-2 text-sm leading-5 text-stone-600 dark:text-[#9a9389]">{item.note}</p>
                                    ) : null}
                                  </div>
                                  <div className="flex shrink-0 items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => onStartEditPackingItem(item.id)}
                                      aria-label={`编辑 ${item.name}`}
                                      className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:text-[#5e584f] dark:hover:bg-[#2e2b26] dark:hover:text-[#b5afa6]"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onDeleteItem(item.id)}
                                      aria-label={`删除 ${item.name}`}
                                      className="flex h-8 w-8 items-center justify-center rounded-full text-stone-400 transition hover:bg-red-50 hover:text-red-600 dark:text-[#5e584f] dark:hover:bg-red-950/30 dark:hover:text-red-400"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                    <div
                                      {...dragProvided.dragHandleProps}
                                      role="button"
                                      aria-label={`拖拽 ${item.name}`}
                                      title="拖拽调整顺序"
                                      className="flex h-8 w-8 cursor-grab items-center justify-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 active:cursor-grabbing dark:text-[#5e584f] dark:hover:bg-[#2e2b26] dark:hover:text-[#b5afa6]"
                                    >
                                      <GripVertical className="h-4 w-4" />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </article>
                          )}
                        </Draggable>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-stone-300 bg-white/60 p-6 text-center text-sm text-stone-400 dark:border-[#4a453e] dark:bg-[#1e1c1a]/60 dark:text-[#5e584f] sm:col-span-2 lg:col-span-4">
                      {items.length > 0 ? '没有匹配的物品' : '暂无携带物品'}
                    </div>
                  )}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </>
      )}
    </section>
  );
}
