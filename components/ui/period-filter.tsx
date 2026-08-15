'use client';

import React from 'react';

export type PeriodType = 'day' | 'week' | 'month' | 'year' | 'all';

export interface PeriodFilterProps {
  value: PeriodType;
  onChange: (value: PeriodType) => void;
  showLabel?: boolean;
  className?: string;
}

export const PERIOD_OPTIONS: { id: PeriodType; label: string }[] = [
  { id: 'day', label: 'Jour' },
  { id: 'week', label: 'Semaine' },
  { id: 'month', label: 'Mois' },
  { id: 'year', label: 'Année' },
  { id: 'all', label: 'Tout' },
];

export function PeriodFilter({
  value,
  onChange,
  showLabel = true,
  className = '',
}: PeriodFilterProps) {
  return (
    <div
      className={`flex items-center space-x-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80 shrink-0 ${className}`}
    >
      {showLabel && (
        <span className="text-[10px] text-slate-400 font-bold px-2 uppercase tracking-wider hidden sm:inline">
          Période:
        </span>
      )}
      {PERIOD_OPTIONS.map((period) => (
        <button
          key={period.id}
          type="button"
          onClick={() => onChange(period.id)}
          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
            value === period.id
              ? 'bg-slate-900 text-white shadow-2xs font-black'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}

export default PeriodFilter;
