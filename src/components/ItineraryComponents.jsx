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
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { getDateBadgeClass } from '../utils/date.js';
import {
  getCardGlowClass,
  getFuzzyMatchScore,
  getTypeBadgeClass,
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
      className={`group relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-lg   ${
        isDragging
          ? 'border-stone-400 shadow-xl ring-2 ring-stone-300/60   '
          : `border-stone-200/80 hover:border-stone-300/80  `
      } ${getCardGlowClass(item.type)}`}
    >
      <span className={`absolute left-0 top-0 h-full w-1 rounded-full transition-all duration-300 ${typeAccent[item.type] || 'bg-slate-400'}`} />
      <div className="flex items-start justify-between gap-3">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${getTypeBadgeClass(item.type)}`}>
          {item.type}
        </span>
        <div className="flex items-center gap-0.5 text-stone-400 opacity-0 transition-all duration-200 group-hover:opacity-100 ">
          <GripVertical className="h-4 w-4 shrink-0" />
          <button
            type="button"
            onClick={onStartEdit}
            aria-label={`编辑 ${item.title}`}
            className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition-all duration-150 hover:bg-stone-100 hover:text-stone-700   "
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            aria-label={`复制 ${item.title}`}
            className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition-all duration-150 hover:bg-stone-100 hover:text-stone-700   "
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRequestDelete}
            aria-label={`删除 ${item.title}`}
            className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition-all duration-150 hover:bg-red-50 hover:text-red-600   "
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {isEditing ? (
        <div className="mt-3 space-y-2 rounded-xl border border-stone-200/80 bg-stone-50/80 p-2.5  ">
          <select
            value={editForm.type}
            onChange={(event) => onEditField('type', event.target.value)}
            className="h-9 w-full rounded-lg border border-stone-200/80 bg-white px-2 text-sm text-stone-700 outline-none transition-all duration-200 focus:border-stone-400    "
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
            className="h-9 w-full rounded-lg border border-stone-200/80 bg-white px-2 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400     "
            placeholder="卡片标题"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={editForm.cost}
              onChange={(event) => onEditField('cost', event.target.value)}
              className="h-9 rounded-lg border border-stone-200/80 bg-white px-2 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400     "
              placeholder="费用：200-300元 / 260元/晚×3晚"
            />
            <input
              value={editForm.duration}
              onChange={(event) => onEditField('duration', event.target.value)}
              className="h-9 rounded-lg border border-stone-200/80 bg-white px-2 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400     "
              placeholder="耗时"
            />
          </div>
          <textarea
            value={editForm.advice}
            onChange={(event) => onEditField('advice', event.target.value)}
            className="h-20 w-full resize-none rounded-lg border border-stone-200/80 bg-white px-2 py-2 text-sm leading-5 text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400     "
            placeholder="建议"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-stone-950 px-2 text-xs font-semibold text-white transition hover:bg-stone-800   "
            >
              <Check className="h-3.5 w-3.5" />
              保存
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-stone-200 bg-white px-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100    "
            >
              <X className="h-3.5 w-3.5" />
              取消
            </button>
          </div>
        </div>
      ) : (
        <>
          <h3 className="mt-3 text-[15px] font-bold leading-snug text-stone-950 ">{item.title}</h3>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-stone-600 ">
            <div className="flex items-center gap-1.5 rounded-lg bg-stone-50/80 px-2.5 py-2 ">
              <Coins className="h-3.5 w-3.5 text-amber-500 " />
              <span className="font-medium">{item.cost}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-stone-50/80 px-2.5 py-2 ">
              <Clock3 className="h-3.5 w-3.5 text-sky-500 " />
              <span className="font-medium">{item.duration}</span>
            </div>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-stone-500 ">{item.advice}</p>
        </>
      )}
      {isConfirmingDelete ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-700   ">
          <p className="leading-5">确定删除这张卡片吗？</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onConfirmDelete}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md bg-red-600 px-2 text-xs font-semibold text-white transition hover:bg-red-700  "
            >
              <Check className="h-3.5 w-3.5" />
              删除
            </button>
            <button
              type="button"
              onClick={onCancelDelete}
              className="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-red-200 bg-white px-2 text-xs font-semibold text-red-700 transition hover:bg-red-100    "
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
      className={`travel-day flex min-h-[520px] w-[292px] shrink-0 flex-col rounded-xl border bg-stone-50/80 p-3 shadow-soft backdrop-blur transition-all duration-300    ${
        isDraggingDay ? 'border-stone-400 ring-2 ring-stone-300/60 shadow-lg  ' : 'border-stone-200/80'
      }`}
    >
      <div className="border-b border-stone-200/80 pb-3 ">
        <div className="flex min-w-0 items-center gap-2">
          <p className="shrink-0 text-[11px] font-bold uppercase tracking-[0.2em] text-stone-400 ">行程日</p>
          {dateInfo.displayText ? (
            <span className={`min-w-0 truncate rounded-full px-2 py-0.5 text-[11px] font-bold ${getDateBadgeClass(dateInfo)}`}>
              {dateInfo.displayText}
            </span>
          ) : null}
        </div>
        {weather ? (
          <p className="mt-1 truncate text-xs text-stone-500 ">{weather}</p>
        ) : null}
        <div className="mt-1 flex items-center justify-between gap-2">
          <h2 className="min-w-0 truncate font-display text-2xl font-black tracking-tight text-stone-950 ">{day}</h2>
          <div className="flex shrink-0 items-center gap-1">
          {canDeleteDay ? (
            <button
              type="button"
              onClick={() => onDeleteDay(day)}
              aria-label={`删除 ${day}`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-400 shadow-sm transition-all duration-200 hover:bg-red-50 hover:text-red-600 hover:shadow-md    "
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={openDatePicker}
            aria-label={`选择 ${day} 日期`}
            title="选择日期"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-stone-500 shadow-sm transition-all duration-200 hover:bg-emerald-50 hover:text-emerald-600 hover:shadow-md    "
          >
            <CalendarDays className="h-3.5 w-3.5" />
          </button>
          <div
            {...dayDragHandleProps}
            role="button"
            aria-label={`拖拽 ${day}`}
            className="flex h-9 w-9 cursor-grab items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-sm transition-all duration-200 active:cursor-grabbing hover:shadow-md  "
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
          <p className="mt-1 text-xs text-stone-500 ">
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
              snapshot.isDraggingOver ? 'bg-white/90 ring-2 ring-stone-300  ' : ''
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
              <div className="empty-droppable flex flex-1 items-center justify-center rounded-xl border border-dashed border-stone-300/60 bg-white/40 p-6 text-center  ">
                <div>
                  <GripVertical className="mx-auto h-6 w-6 text-stone-300 " />
                  <p className="mt-2 text-sm text-stone-400 ">
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
