import React, { useState, useMemo, useRef } from 'react';
import { TravelSegment } from '../types';
import { calculateDailyLocations } from '../lib/travel-utils';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isSameDay, isToday,
  startOfDay, addMinutes,
} from 'date-fns';
import { ChevronLeft, ChevronRight, Download, Edit3 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
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

/* ── Main CalendarView ─────────────────────────────────────────── */
export function CalendarView({ segments }: CalendarViewProps) {
  const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [quickEditDate, setQuickEditDate] = useState<Date | null>(null);
  const [quickEditCountry, setQuickEditCountry] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  const dailyLocations = useMemo(() => calculateDailyLocations(segments), [segments]);

  const locationMap = useMemo(() => {
    const map: Record<string, string> = {};
    dailyLocations.forEach(dl => { map[dl.date] = dl.country; });
    return map;
  }, [dailyLocations]);

  const currentYear = currentMonth.getFullYear();

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
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`travel-calendar-${format(currentMonth, 'yyyy-MM')}.pdf`);
    } catch (err) {
      console.error('PDF export failed', err);
    }
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
    } catch (err) {
      console.error('Quick edit failed', err);
    } finally {
      setIsSaving(false);
    }
  };

  const periodLabel = viewMode === 'month'
    ? `${MONTH_NAMES[currentMonth.getMonth()]} ${currentYear}`
    : String(currentYear);

  return (
    <div className="space-y-4">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Month / Year toggle */}
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          {(['month', 'year'] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                viewMode === v
                  ? 'bg-white shadow-sm text-blue-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={prevPeriod}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-blue-300 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="min-w-[148px] text-center text-sm font-medium text-slate-800">
            {periodLabel}
          </span>
          <button
            onClick={nextPeriod}
            className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-blue-300 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={goToday}
          className="px-3 py-1.5 text-sm font-medium text-slate-500 border border-slate-200 bg-white rounded-lg hover:border-blue-300 transition-colors"
        >
          Today
        </button>

        <div className="flex-1" />

        <button
          onClick={handleExportPDF}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-500 border border-slate-200 bg-white rounded-lg hover:border-blue-300 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export PDF
        </button>
      </div>

      {/* ── Calendar body ── */}
      <div ref={calendarRef}>
        {viewMode === 'month' ? (
          <MonthView
            currentMonth={currentMonth}
            locationMap={locationMap}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            onQuickEdit={handleQuickEdit}
          />
        ) : (
          <YearView
            year={currentYear}
            locationMap={locationMap}
            onDayClick={setSelectedDate}
          />
        )}
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
  const days = useMemo(
    () => eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) }),
    [currentMonth],
  );
  const prefix = getDay(startOfMonth(currentMonth));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Day-of-week header */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAYS_SHORT.map(d => (
          <div key={d} className="py-3 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7">
        {/* Blank prefix cells */}
        {Array.from({ length: prefix }).map((_, i) => (
          <div key={`b-${i}`} className="h-24 border-b border-r border-slate-50" />
        ))}

        {/* Day cells */}
        {days.map((date, idx) => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const country = locationMap[dateStr];
          const isSelected = selectedDate ? isSameDay(date, selectedDate) : false;
          const isTodayDate = isToday(date);

          return (
            <button
              key={dateStr}
              onClick={() => onSelectDate(date)}
              onContextMenu={e => { e.preventDefault(); onQuickEdit(date, country || 'Unknown'); }}
              className={[
                'h-24 flex flex-col items-start p-2 gap-1 text-left transition-colors border-b border-r border-slate-50',
                isSelected
                  ? 'bg-blue-600'
                  : isTodayDate
                    ? 'bg-blue-50 ring-1 ring-inset ring-blue-200'
                    : country
                      ? 'hover:bg-blue-50/40'
                      : 'hover:bg-slate-50',
              ].join(' ')}
            >
              <span className={`text-xs font-semibold ${
                isSelected ? 'text-blue-100' : isTodayDate ? 'text-blue-600' : 'text-slate-500'
              }`}>
                {format(date, 'd')}
              </span>
              {country && (
                <span className={`text-[10px] font-medium truncate w-full rounded px-1 py-0.5 leading-tight ${
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
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: 12 }, (_, i) => (
        <MiniMonth
          key={i}
          year={year}
          month={i}
          locationMap={locationMap}
          onDayClick={onDayClick}
        />
      ))}
    </div>
  );
}

/* ── Mini month (used in year view) ───────────────────────────── */
interface MiniMonthProps {
  year: number;
  month: number;
  locationMap: Record<string, string>;
  onDayClick: (d: Date) => void;
}

const MiniMonth: React.FC<MiniMonthProps> = ({ year, month, locationMap, onDayClick }) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });
  const prefix = getDay(firstDay);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
      <p className="text-xs font-semibold text-slate-700 text-center mb-2">
        {MONTH_NAMES[month]}
      </p>
      <div className="grid grid-cols-7 mb-1">
        {DAYS_TINY.map((d, i) => (
          <div key={i} className="text-[9px] text-slate-400 text-center font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: prefix }).map((_, i) => <div key={`b-${i}`} />)}
        {days.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd');
          const hasTravel = !!locationMap[dateStr];
          const isTodayDate = isToday(date);

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(date)}
              title={locationMap[dateStr]}
              className={[
                'w-full aspect-square rounded-sm text-[9px] font-medium flex items-center justify-center transition-colors',
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
