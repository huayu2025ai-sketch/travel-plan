import React from 'react';
import { ChevronDown, Download, FileText, ImageDown } from 'lucide-react';

export function PlanExportMenu({ isOpen, onToggle, onExportJson, onExportMarkdown, onExportImage, onRunAction }) {
  return (
    <div className="relative">
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className="inline-flex items-center gap-2 rounded-full border border-stone-200/80 bg-white/90 px-3 py-2 text-xs font-semibold text-stone-600 shadow-sm backdrop-blur transition-all duration-200 hover:border-stone-300 hover:bg-stone-50 hover:shadow-md dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/90 dark:text-[#9a9389] dark:hover:border-[#5a554e] dark:hover:bg-[#2e2b26]">
        <Download className="h-4 w-4 text-stone-500 dark:text-[#7a746c]" />导出<ChevronDown className="h-3.5 w-3.5 text-stone-400 dark:text-[#7a746c]" />
      </button>
      {isOpen ? (
        <div className="dropdown-enter absolute right-0 z-20 mt-2 w-36 overflow-hidden rounded-xl border border-stone-200/80 bg-white/95 p-1 shadow-lg backdrop-blur-lg dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/95 dark:shadow-card-dark">
          <button type="button" onClick={() => onRunAction(onExportJson)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-stone-600 transition hover:bg-stone-50 dark:text-[#9a9389] dark:hover:bg-[#2e2b26]"><Download className="h-4 w-4" />JSON</button>
          <button type="button" onClick={() => onRunAction(onExportMarkdown)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-stone-600 transition hover:bg-stone-50 dark:text-[#9a9389] dark:hover:bg-[#2e2b26]"><FileText className="h-4 w-4" />Markdown</button>
          <button type="button" onClick={() => onRunAction(onExportImage)} className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-semibold text-stone-600 transition hover:bg-stone-50 dark:text-[#9a9389] dark:hover:bg-[#2e2b26]"><ImageDown className="h-4 w-4" />图片</button>
        </div>
      ) : null}
    </div>
  );
}
