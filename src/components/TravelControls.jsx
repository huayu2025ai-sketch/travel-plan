import React from 'react';
import { Moon, Plane, Sun } from 'lucide-react';

export function ThemeToggle({ theme, setTheme }) {
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-stone-200/80 bg-white/90 text-stone-500 shadow-sm backdrop-blur-sm transition-all duration-200 hover:border-stone-300 hover:text-amber-600 hover:shadow-md dark:border-[#3a3630]/80 dark:bg-[#1e1c1a]/90 dark:text-[#7a746c] dark:hover:border-amber-800/40 dark:hover:text-amber-400 dark:hover:shadow-md dark:shadow-none"
      aria-label="切换主题"
      title="切换主题"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

export function LoadingProgress({ progress, stage, stages }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="inline-flex items-center gap-2">
          <span className="travel-loader" aria-hidden="true">
            <Plane className="h-3.5 w-3.5" />
          </span>
          {stage}
        </span>
        <span>{progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/75 dark:bg-[#2a2724]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-sky-500 via-emerald-500 to-amber-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1">
        {stages.map((item, index) => (
          <span
            key={item}
            className={`h-1 rounded-full transition ${
              index <= stages.indexOf(stage) ? 'bg-amber-500 dark:bg-amber-300' : 'bg-white/80 dark:bg-[#3a3630]'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
