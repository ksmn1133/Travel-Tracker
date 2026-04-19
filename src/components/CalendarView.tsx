import React, { useState, useMemo, useRef, useEffect } from 'react';
import { TravelSegment } from '../types';
import { calculateDailyLocations, calculateCountryStats } from '../lib/travel-utils';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isSameDay, isToday,
  startOfDay, addMinutes, parseISO,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Download, Edit3 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { travelService } from '../services/travelService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_TINY  = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface CalendarViewProps {
  segments: TravelSegment[];
}

/* ─────────────────────────────────────────────────────────────── */
export function CalendarView({ segments }: CalendarViewProps) {
  const [viewMode, setViewMode]         = useState<'month' | 'year'>('month');
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [quickEditDate, setQuickEditDate]     = useState<Date | null>(null);
  const [quickEditCountry, setQuickEditCountry] = useState('');
  const [isSaving, setIsSaving]         = useState(false);
  const [sideTab, setSideTab]           = useState<'chart' | 'trips'>('chart');
  const calendarRef = useRef<HTMLDivElement>(null);

  const dailyLocations = useMemo(() => calculateDailyLocations(segments), [segments]);

  const locationMap = useMemo(() => {
    const map: Record<string, string> = {};
    dailyLocations.forEach(dl => { map[dl.date] = dl.country; });
    return map;
  }, [dailyLocations]);

  const currentYear = currentMonth.getFullYear();

  /* ── filtered stats for the current period ── */
  const filteredStats = useMemo(() => {
    if (viewMode === 'month') {
      const prefix = format(currentMonth, 'yyyy-MM');
      const counts: Record<string, number> = {};
      (Object.entries(locationMap) as [string, string][]).forEach(([date, country]) => {
        if (date.startsWith(prefix)) counts[country] = (counts[country] || 0) + 1;
      });
      return Object.entries(counts).map(([country, days]) => ({ country, days })).sort((a, b) => b.days - a.days);
    } else {
      return calculateCountryStats(segments, currentYear);
    }
  }, [locationMap, viewMode, currentMonth, currentYear, segments]);

  const totalDays   = filteredStats.reduce((s, d) => s + d.days, 0);
  const maxDays     = filteredStats[0]?.days || 1;
  const countryCount = filteredStats.length;

  /* ── filtered trips for trip list ── */
  const filteredTrips = useMemo(() => {
    return [...segments]
      .filter(s => {
        const d = new Date(s.arrivalDate);
        if (viewMode === 'month') {
          return d.getFullYear() === currentYear && d.getMonth() === currentMonth.getMonth();
        }
        return d.getFullYear() === currentYear;
      })
      .sort((a, b) => new Date(b.arrivalDate).getTime() - new Date(a.arrivalDate).getTime());
  }, [segments, viewMode, currentYear, currentMonth]);

  /* ── navigation ── */
  const prevPeriod = () => {
    if (viewMode === 'month') setCurrentMonth(m => subMonths(m, 1));
    else setCurrentMonth(m => new Date(m.getFullYear() - 1, m.getMonth(), 1));
  };
  const nextPeriod = () => {
    if (viewMode === 'month') setCurrentMonth(m => addMonths(m, 1));
    else setCurrentMonth(m => new Date(m.getFullYear() + 1, m.getMonth(), 1));
  };
  const goToday = () => setCurrentMonth(startOfMonth(new Date()));

  const handleExportPDF = async () => {
    if (!calendarRef.current) return;
    try {
      const canvas = await html2canvas(calendarRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`travel-calendar-${format(currentMonth, 'yyyy-MM')}.pdf`);
    } catch (err) { console.error('PDF export failed', err); }
  };

  const handleQuickEdit = (date: Date, country: string) => {
    setQuickEditDate(date);
    setQuickEditCountry(country === 'Unknown' ? '' : country);
  };

  const saveQuickEdit = async () => {
    if (!quickEditDate || !quickEditCountry.trim()) return;
    setIsSaving(true);
    try {
      const dateStr = format(quickEditDate, 'yyyy-MM-dd');
      const prevCountry = locationMap[dateStr] || 'Unknown';
      await travelService.addSegment({
        departureCountry: prevCountry,
        arrivalCountry: quickEditCountry.trim(),
        departureDate: startOfDay(quickEditDate).toISOString(),
        arrivalDate: addMinutes(startOfDay(quickEditDate), 1).toISOString(),
      });
      setQuickEditDate(null);
    } catch (err) { console.error('Quick edit failed', err); }
    finally { setIsSaving(false); }
  };

  const periodLabel = viewMode === 'month'
    ? `${MONTH_NAMES[currentMonth.getMonth()]} ${currentYear}`
    : String(currentYear);

  return (
    <div className="flex gap-0 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden" style={{ minHeight: '640px' }}>

      {/* ══ LEFT — Calendar ══════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-100">

        {/* Toolbar — centered nav, sides for toggle + actions */}
        <div className="flex items-center px-5 py-3 border-b border-slate-100 gap-2">

          {/* Left: Month / Year toggle */}
          <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
            {(['month', 'year'] as const).map(v => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  viewMode === v ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </button>
            ))}
          </div>

          {/* Center: navigation — absolutely centered within the toolbar */}
          <div className="flex-1 flex items-center justify-center gap-1.5">
            <button
              onClick={prevPeriod}
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-blue-300 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="min-w-[148px] text-center text-sm font-semibold text-slate-800">
              {periodLabel}
            </span>
            <button
              onClick={nextPeriod}
              className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-blue-300 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Right: Today + Export */}
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-xs font-medium text-slate-500 border border-slate-200 bg-white rounded-lg hover:border-blue-300 transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-400 border border-slate-200 bg-white rounded-lg hover:border-blue-300 transition-colors"
              title="Export PDF"
            >
              <Download className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
        </div>

        {/* Calendar body */}
        <div className="flex-1 p-4 overflow-auto" ref={calendarRef}>
          {viewMode === 'month' ? (
            <MonthView
              currentMonth={currentMonth}
              locationMap={locationMap}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              onQuickEdit={handleQuickEdit}
            />
          ) : (
            <YearView year={currentYear} locationMap={locationMap} onDayClick={setSelectedDate} />
          )}
        </div>
      </div>

      {/* ══ RIGHT — Summary sidebar ══════════════════════════════════ */}
      <div className="w-72 xl:w-80 flex flex-col shrink-0 overflow-hidden">

        {/* Globe */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            {countryCount} {countryCount === 1 ? 'country' : 'countries'} visited
          </p>
          <Globe />
        </div>

        {/* Stat cards */}
        <div className="flex gap-2 px-4 py-3 border-b border-slate-100">
          {([
            { label: 'Countries', value: countryCount },
            { label: 'Days',      value: totalDays },
            { label: 'Trips',     value: filteredTrips.length },
          ] as const).map(({ label, value }) => (
            <div key={label} className="flex-1 bg-slate-50 rounded-xl p-2.5 text-center">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
              <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
            </div>
          ))}
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-slate-100 shrink-0">
          {([['chart', 'By Country'], ['trips', 'Trip List']] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setSideTab(tab)}
              className={`flex-1 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                sideTab === tab
                  ? 'text-blue-600 border-blue-600'
                  : 'text-slate-500 border-transparent hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">
          {sideTab === 'chart' ? (
            <CountryChart data={filteredStats} maxDays={maxDays} />
          ) : (
            <TripList trips={filteredTrips} />
          )}
        </div>
      </div>

      {/* ── Quick-edit dialog ── */}
      <Dialog open={!!quickEditDate} onOpenChange={open => !open && setQuickEditDate(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-blue-600" />
              Set Location
            </DialogTitle>
            <DialogDescription>
              Override location for {quickEditDate ? format(quickEditDate, 'PPP') : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Country</Label>
            <Input
              className="mt-1.5"
              value={quickEditCountry}
              onChange={e => setQuickEditCountry(e.target.value)}
              placeholder="Enter country name"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') saveQuickEdit(); }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickEditDate(null)}>Cancel</Button>
            <Button
              onClick={saveQuickEdit}
              disabled={isSaving || !quickEditCountry.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ── Rotating Globe ────────────────────────────────────────────── */
function Globe() {
  const [angle, setAngle] = useState(0);
  const rafRef = useRef<number>(0);
  const lastRef = useRef<number>(0);

  useEffect(() => {
    const tick = (now: number) => {
      const dt = lastRef.current ? now - lastRef.current : 0;
      lastRef.current = now;
      setAngle(a => (a + dt * 0.025) % 360);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const R = 72;
  const cx = 80;
  const cy = 80;

  // Latitude parallels
  const latitudes = [-60, -30, 0, 30, 60];
  // Meridian offsets (4 great circles, 45° apart)
  const meridianOffsets = [0, 45, 90, 135];

  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 160 160" width="140" height="140">
        <defs>
          <radialGradient id="globeGrad" cx="35%" cy="32%" r="60%">
            <stop offset="0%" stopColor="#bfdbfe" />
            <stop offset="55%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1e3a8a" />
          </radialGradient>
          <radialGradient id="globeShine" cx="32%" cy="28%" r="45%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <clipPath id="globeClip">
            <circle cx={cx} cy={cy} r={R} />
          </clipPath>
        </defs>

        {/* Ocean fill */}
        <circle cx={cx} cy={cy} r={R} fill="url(#globeGrad)" />

        <g clipPath="url(#globeClip)">
          {/* Latitude lines */}
          {latitudes.map(lat => {
            const rad = (lat * Math.PI) / 180;
            const y   = cy - Math.sin(rad) * R;
            const rx  = Math.cos(rad) * R;
            const ry  = rx * 0.18;
            return (
              <ellipse
                key={lat}
                cx={cx} cy={y}
                rx={rx} ry={ry}
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="0.7"
              />
            );
          })}

          {/* Meridian great circles — simulated Y-rotation */}
          {meridianOffsets.map(offset => {
            const theta = ((angle + offset) * Math.PI) / 180;
            const rxMer = Math.abs(Math.cos(theta)) * R;
            // Only draw if facing front (cos > -0.08) to avoid overdraw
            if (Math.cos(theta) < -0.08) return null;
            return (
              <ellipse
                key={offset}
                cx={cx} cy={cy}
                rx={rxMer} ry={R}
                fill="none"
                stroke="rgba(255,255,255,0.22)"
                strokeWidth="0.7"
              />
            );
          })}

          {/* Equator accent */}
          <ellipse
            cx={cx} cy={cy}
            rx={R} ry={R * 0.18}
            fill="none"
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1"
          />
        </g>

        {/* Shine overlay */}
        <circle cx={cx} cy={cy} r={R} fill="url(#globeShine)" />

        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={R} fill="none" stroke="#93c5fd" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

/* ── Country bar chart ─────────────────────────────────────────── */
function CountryChart({ data, maxDays }: { data: { country: string; days: number }[]; maxDays: number }) {
  if (data.length === 0) {
    return <p className="text-slate-400 text-xs text-center py-8">No travel data for this period.</p>;
  }
  return (
    <div className="space-y-3.5">
      {data.map(({ country, days }) => (
        <div key={country} className="space-y-1">
          <div className="flex justify-between items-baseline">
            <span className="text-xs font-medium text-slate-700 truncate max-w-[65%]">{country}</span>
            <span className="text-xs font-semibold text-slate-900 shrink-0">{days} d</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
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

/* ── Trip list ─────────────────────────────────────────────────── */
function TripList({ trips }: { trips: TravelSegment[] }) {
  if (trips.length === 0) {
    return <p className="text-slate-400 text-xs text-center py-8">No trips in this period.</p>;
  }
  return (
    <div className="space-y-2">
      {trips.map(t => (
        <div key={t.id} className="flex gap-2.5 p-2.5 rounded-lg border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-colors">
          <div className="w-1 rounded-full bg-blue-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">
              {t.arrivalCountry}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {format(parseISO(t.arrivalDate), 'MMM d')} ← {t.departureCountry}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Month view ────────────────────────────────────────────────── */
function MonthView({
  currentMonth,
  locationMap,
  selectedDate,
  onSelectDate,
  onQuickEdit,
}: {
  currentMonth: Date;
  locationMap: Record<string, string>;
  selectedDate: Date | null;
  onSelectDate: (d: Date) => void;
  onQuickEdit: (d: Date, country: string) => void;
}) {
  const days   = useMemo(() => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }), [currentMonth]);
  const prefix = getDay(startOfMonth(currentMonth));

  return (
    <div className="rounded-xl overflow-hidden border border-slate-100">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {DAYS_SHORT.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {Array.from({ length: prefix }).map((_, i) => (
          <div key={`b-${i}`} className="h-20 border-b border-r border-slate-50 bg-slate-50/40" />
        ))}

        {days.map((date, idx) => {
          const dateStr   = format(date, 'yyyy-MM-dd');
          const country   = locationMap[dateStr];
          const isSelected  = selectedDate ? isSameDay(date, selectedDate) : false;
          const isTodayDate = isToday(date);

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(date)}
              onContextMenu={e => { e.preventDefault(); onQuickEdit(date, country || 'Unknown'); }}
              className={[
                'h-20 flex flex-col items-start p-1.5 gap-1 text-left transition-colors border-b border-r border-slate-50',
                isSelected
                  ? 'bg-blue-600'
                  : isTodayDate
                    ? 'bg-blue-50 ring-1 ring-inset ring-blue-200'
                    : 'hover:bg-slate-50',
              ].join(' ')}
            >
              <span className={`text-[11px] font-semibold ${
                isSelected ? 'text-blue-100' : isTodayDate ? 'text-blue-600' : 'text-slate-500'
              }`}>
                {format(date, 'd')}
              </span>
              {country && (
                <span className={`text-[9px] font-medium truncate w-full rounded px-1 py-0.5 leading-tight ${
                  isSelected ? 'bg-blue-500 text-blue-100' : 'bg-blue-100 text-blue-700'
                }`}>
                  {country}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Year view ─────────────────────────────────────────────────── */
function YearView({
  year,
  locationMap,
  onDayClick,
}: {
  year: number;
  locationMap: Record<string, string>;
  onDayClick: (d: Date) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 12 }, (_, i) => (
        <MiniMonth key={i} year={year} month={i} locationMap={locationMap} onDayClick={onDayClick} />
      ))}
    </div>
  );
}

/* ── Mini month ────────────────────────────────────────────────── */
interface MiniMonthProps {
  year: number;
  month: number;
  locationMap: Record<string, string>;
  onDayClick: (d: Date) => void;
}

const MiniMonth: React.FC<MiniMonthProps> = ({ year, month, locationMap, onDayClick }) => {
  const firstDay = new Date(year, month, 1);
  const days     = eachDayOfInterval({ start: firstDay, end: new Date(year, month + 1, 0) });
  const prefix   = getDay(firstDay);

  return (
    <div className="bg-white rounded-xl border border-slate-100 p-2.5 shadow-sm">
      <p className="text-[10px] font-bold text-slate-600 text-center mb-1.5 uppercase tracking-wide">
        {MONTH_NAMES[month]}
      </p>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_TINY.map((d, i) => (
          <div key={i} className="text-[8px] text-slate-400 text-center font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: prefix }).map((_, i) => <div key={`b-${i}`} />)}
        {days.map(date => {
          const dateStr    = format(date, 'yyyy-MM-dd');
          const hasTravel  = !!locationMap[dateStr];
          const isTodayDate = isToday(date);
          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(date)}
              title={locationMap[dateStr]}
              className={[
                'w-full aspect-square rounded-sm text-[8px] font-medium flex items-center justify-center transition-colors',
                isTodayDate
                  ? 'bg-blue-600 text-white'
                  : hasTravel
                    ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    : 'text-slate-400 hover:bg-slate-50',
              ].join(' ')}
            >
              {format(date, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
};
