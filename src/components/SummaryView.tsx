import React, { useState, useMemo } from 'react';
import { TravelSegment } from '../types';
import { calculateCountryStats, calculateMonthlyStats } from '../lib/travel-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface SummaryViewProps {
  segments: TravelSegment[];
}

export function SummaryView({ segments }: SummaryViewProps) {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [activeTab, setActiveTab] = useState<'chart' | 'monthly'>('chart');

  const stats = useMemo(
    () => calculateCountryStats(segments, parseInt(year)),
    [segments, year],
  );
  const monthlyStats = useMemo(
    () => calculateMonthlyStats(segments, parseInt(year)),
    [segments, year],
  );

  const years = useMemo(() => {
    const set = new Set<number>([new Date().getFullYear()]);
    segments.forEach(s => {
      const d = new Date(s.departureDate).getFullYear();
      const a = new Date(s.arrivalDate).getFullYear();
      if (!isNaN(d)) set.add(d);
      if (!isNaN(a)) set.add(a);
    });
    return Array.from(set).sort((a, b) => b - a);
  }, [segments]);

  const totalDays = stats.reduce((acc, s) => acc + s.days, 0);
  const maxDays = stats[0]?.days || 1;

  return (
    <div className="space-y-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Travel Summary</h2>
          <p className="text-sm text-slate-500">Overview of your travels in {year}</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-[100px] bg-white">
            <SelectValue placeholder="Year" />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-3 gap-4">
        {([
          { label: 'Countries', value: stats.length },
          { label: 'Days Tracked', value: totalDays },
          { label: 'Trips', value: segments.length },
        ] as const).map(({ label, value }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-slate-200 shadow-sm p-4"
          >
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              {label}
            </p>
            <p className="text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {/* ── Main panel ── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Tab switcher */}
        <div className="flex border-b border-slate-100">
          {([['chart', 'By Country'], ['monthly', 'Monthly Breakdown']] as const).map(
            ([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={[
                  'flex-1 py-3 text-sm font-medium transition-colors border-b-2',
                  activeTab === tab
                    ? 'text-blue-600 border-blue-600'
                    : 'text-slate-500 border-transparent hover:text-slate-700',
                ].join(' ')}
              >
                {label}
              </button>
            ),
          )}
        </div>

        {/* Content */}
        <div className="p-5">
          {activeTab === 'chart' ? (
            <CountryChart data={stats} maxDays={maxDays} />
          ) : (
            <MonthlyBreakdown monthlyStats={monthlyStats} />
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Country bar chart ─────────────────────────────────────────── */
function CountryChart({
  data,
  maxDays,
}: {
  data: { country: string; days: number }[];
  maxDays: number;
}) {
  if (data.length === 0) {
    return (
      <p className="text-slate-400 text-sm text-center py-10">
        No travel data for this year.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {data.map(({ country, days }) => (
        <div key={country} className="space-y-1.5">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-slate-700">{country}</span>
            <span className="text-sm font-semibold text-slate-900">{days} d</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-500"
              style={{ width: `${(days / maxDays) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Monthly breakdown ─────────────────────────────────────────── */
function MonthlyBreakdown({
  monthlyStats,
}: {
  monthlyStats: Record<number, Record<string, number>>;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {MONTH_NAMES.map((name, idx) => {
        const entries = Object.entries(monthlyStats[idx] || {}).sort(
          (a, b) => (b[1] as number) - (a[1] as number),
        );
        const total = entries.reduce((acc, [, d]) => acc + (d as number), 0);

        return (
          <div
            key={name}
            className="rounded-xl border border-slate-100 p-3 bg-slate-50/40"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-700">{name}</span>
              {total > 0 && (
                <span className="text-xs text-slate-400">{total} d</span>
              )}
            </div>
            {entries.length === 0 ? (
              <p className="text-xs text-slate-300 italic">No data</p>
            ) : (
              <div className="space-y-1">
                {entries.map(([country, days]) => (
                  <div key={country} className="flex justify-between items-center gap-2">
                    <span className="text-xs text-slate-600 truncate">{country}</span>
                    <span className="text-xs font-medium text-slate-700 shrink-0">
                      {days} d
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
