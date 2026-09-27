import React from 'react';
import { Plane } from 'lucide-react';

export function LoadingProgress({ progress, stage, stages }) {
  return (
    <div className="mt-3 overflow-hidden rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-amber-900   ">
      <div className="flex items-center justify-between gap-3 text-xs font-semibold">
        <span className="inline-flex items-center gap-2">
          <span className="travel-loader" aria-hidden="true">
            <Plane className="h-3.5 w-3.5" />
          </span>
          {stage}
        </span>
        <span>{progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/75 ">
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
              index <= stages.indexOf(stage) ? 'bg-amber-500 ' : 'bg-white/80 '
            }`}
          />
        ))}
      </div>
    </div>
  );
}
