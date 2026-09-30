import React from 'react';
import { DragDropContext, Draggable, Droppable } from '@hello-pangea/dnd';
import { Check, ChevronDown, FileUp, Plus, SlidersHorizontal, X } from 'lucide-react';
import { DayColumn } from './ItineraryComponents.jsx';
import { PlanExportMenu } from './PlanExportMenu.jsx';
import { getDayDateInfo } from '../utils/date.js';
import { getPlanWeather } from '../utils/plan-weather.js';
import { getTypeBadgeClass, typeAccent, typeOptions } from '../utils/plan.js';

export function ItineraryBoard({
  isBoardCollapsed,
  setIsBoardCollapsed,
  addDay,
  importInputKey,
  importPlan,
  isExportMenuOpen,
  setIsExportMenuOpen,
  exportPlan,
  exportMarkdown,
  exportImage,
  runExportAction,
  isFilteredView,
  showAllTypes,
  itineraryItemCount,
  activeTypes,
  toggleTypeFilter,
  typeCounts,
  visibleItemCount,
  isAddFormOpen,
  setIsAddFormOpen,
  addCustomCard,
  cardForm,
  updateCardForm,
  dayNames,
  onDragEnd,
  visibleDays,
  plan,
  pendingDeleteId,
  editingCardId,
  editForm,
  deleteDay,
  startEditCard,
  updateEditForm,
  saveCardEdit,
  duplicateCard,
  setDayDate,
  setPendingDeleteId,
  deleteCard,
}) {
  return (
    <section id="travel-board" className="travel-board animate-fade-up animate-fade-up-delay-2 mt-5 flex-1 overflow-hidden rounded-2xl border border-stone-200/80 bg-white/70 p-3 shadow-soft backdrop-blur transition-all duration-300   ">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 ">Kanban Board</p>
          <div className="mt-1 flex items-center gap-2">
            <h2 className="text-lg font-bold text-stone-950 ">每日行程看板</h2>
            <button
              type="button"
              onClick={() => setIsBoardCollapsed((isCollapsed) => !isCollapsed)}
              aria-expanded={!isBoardCollapsed}
              aria-label={isBoardCollapsed ? '展开每日行程看板' : '收起每日行程看板'}
              title={isBoardCollapsed ? '展开每日行程看板' : '收起每日行程看板'}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700      "
            >
              <ChevronDown className={`h-3.5 w-3.5 transition ${isBoardCollapsed ? '-rotate-90' : ''}`} />
            </button>
          </div>
        </div>
        <div className="travel-board-actions flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={addDay}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-stone-600 shadow-sm backdrop-blur transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:shadow-md     "
          >
            <Plus className="h-4 w-4 text-stone-500 " />
            添加天数
          </button>
          <label className="travel-import-control inline-flex cursor-pointer items-center gap-2 rounded-full border border-stone-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-stone-600 shadow-sm backdrop-blur transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:shadow-md     ">
            <FileUp className="h-4 w-4 text-stone-500 " />
            导入JSON
            <input key={importInputKey} type="file" accept="application/json,.json" onChange={importPlan} className="sr-only" />
          </label>
          <PlanExportMenu
            isOpen={isExportMenuOpen}
            onToggle={() => setIsExportMenuOpen((isOpen) => !isOpen)}
            onExportJson={exportPlan}
            onExportMarkdown={exportMarkdown}
            onExportImage={exportImage}
            onRunAction={runExportAction}
          />
        </div>
      </div>
      {isBoardCollapsed ? null : (
        <>
          <div className="travel-filter-bar mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-stone-200 bg-white/80 p-3 transition  ">
            <div className="mr-1 inline-flex items-center gap-2 text-xs font-semibold text-stone-500 ">
              <SlidersHorizontal className="h-4 w-4" />
              类型筛选
            </div>
        <button
          type="button"
          onClick={showAllTypes}
          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-bold transition-all duration-200 ${
            !isFilteredView
              ? 'border-stone-950 bg-stone-950 text-white shadow-sm   '
              : 'border-stone-200/80 bg-white/90 text-stone-600 hover:bg-stone-50    '
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
                  : 'border-stone-200/80 bg-white/90 text-stone-400 hover:bg-stone-50    '
              }`}
              aria-pressed={isActive}
            >
              <span className={`h-2 w-2 rounded-full transition-transform duration-200 ${typeAccent[type]} ${isActive ? 'scale-125' : ''}`} />
              {type} {typeCounts[type] || 0}
            </button>
          );
        })}
        {isFilteredView ? (
          <span className="text-xs font-medium text-stone-500 ">
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
              ? 'border-stone-950 bg-stone-950 text-white   '
              : 'border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50     '
          }`}
        >
          {isAddFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </button>
      </div>
      {isAddFormOpen ? (
        <form
          onSubmit={addCustomCard}
          className="travel-add-form mb-4 grid gap-2 rounded-xl border border-stone-200/80 bg-white/80 p-3 transition-all duration-300   md:grid-cols-[120px_120px_minmax(160px,1.1fr)_120px_120px_minmax(180px,1.2fr)_auto]"
        >
          <select
            value={cardForm.day}
            onChange={(event) => updateCardForm('day', event.target.value)}
            className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 focus:border-stone-400    "
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
            className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 focus:border-stone-400    "
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
            className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400     "
            placeholder="卡片标题"
          />
          <input
          type="text"
            value={cardForm.cost}
            onChange={(event) => updateCardForm('cost', event.target.value)}
            className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400     "
            placeholder="费用：200-300元 / 260元/晚×3晚"
          />
          <input
            value={cardForm.duration}
            onChange={(event) => updateCardForm('duration', event.target.value)}
            className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400     "
            placeholder="耗时"
          />
          <input
            value={cardForm.advice}
            onChange={(event) => updateCardForm('advice', event.target.value)}
            className="h-10 rounded-lg border border-stone-200/80 bg-white px-3 text-sm text-stone-700 outline-none transition-all duration-200 placeholder:text-stone-400 focus:border-stone-400     "
            placeholder="建议"
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-stone-950 px-4 text-sm font-bold text-white shadow-sm transition-all duration-200 hover:bg-stone-800 hover:shadow-md   "
          >
            <Check className="h-4 w-4" />
            保存
          </button>
        </form>
      ) : null}
      <DragDropContext onDragEnd={onDragEnd}>
        <Droppable droppableId="day-board" direction="horizontal" type="DAY">
          {(provided) => (
            <div ref={provided.innerRef} {...provided.droppableProps} className="travel-board-columns flex gap-4 overflow-x-auto pb-3">
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
                        weather={getPlanWeather(plan, day)}
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
  );
}
