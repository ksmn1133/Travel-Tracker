import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';
import type { Topology } from 'topojson-specification';
import { TravelSegment } from '../types';
import { calculateDailyLocations, calculateCountryStats } from '../lib/travel-utils';
import { resolveCountryId } from '../lib/countryCodeMap';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  getDay, addMonths, subMonths, isSameDay, isToday,
  startOfDay, addMinutes, parseISO, getDaysInMonth,
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

const DAYS_SHORT  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_TINY   = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
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
  const [quickEditDate, setQuickEditDate]       = useState<Date | null>(null);
  const [quickEditCountry, setQuickEditCountry] = useState('');
  const [isSaving, setIsSaving]   = useState(false);
  const [sideTab, setSideTab]     = useState<'chart' | 'trips'>('chart');
  const pdfRef = useRef<HTMLDivElement>(null);

  const dailyLocations = useMemo(() => calculateDailyLocations(segments), [segments]);

  const locationMap = useMemo(() => {
    const map: Record<string, string> = {};
    dailyLocations.forEach(dl => { map[dl.date] = dl.country; });
    return map;
  }, [dailyLocations]);

  const currentYear = currentMonth.getFullYear();

  /* ── stats for the current period ── */
  const filteredStats = useMemo(() => {
    if (viewMode === 'month') {
      const prefix = format(currentMonth, 'yyyy-MM');
      const counts: Record<string, number> = {};
      (Object.entries(locationMap) as [string, string][]).forEach(([date, country]) => {
        if (date.startsWith(prefix)) counts[country] = (counts[country] || 0) + 1;
      });
      return Object.entries(counts)
        .map(([country, days]) => ({ country, days }))
        .sort((a, b) => b.days - a.days);
    }
    return calculateCountryStats(segments, currentYear);
  }, [locationMap, viewMode, currentMonth, currentYear, segments]);

  /* denominator for the bar chart labels */
  const denominator = useMemo(() => {
    if (viewMode === 'month') return getDaysInMonth(currentMonth);
    return 183;
  }, [viewMode, currentMonth]);

  const totalDays     = filteredStats.reduce((s, d) => s + d.days, 0);
  const countryCount  = filteredStats.length;

  /* ── visited countries for globe highlight ── */
  const visitedCountries = useMemo(
    () => [...new Set(filteredStats.map(s => s.country))],
    [filteredStats],
  );

  /* ── trip list for sidebar ── */
  const filteredTrips = useMemo(() => {
    return [...segments]
      .filter(s => {
        const d = new Date(s.arrivalDate);
        if (viewMode === 'month')
          return d.getFullYear() === currentYear && d.getMonth() === currentMonth.getMonth();
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
    const el = pdfRef.current;
    if (!el) return;

    // Temporarily expand all scrollable children so html2canvas captures full content
    type SavedStyle = { el: HTMLElement; overflowY: string; height: string; maxHeight: string };
    const saved: SavedStyle[] = [];
    el.querySelectorAll<HTMLElement>('*').forEach(child => {
      const cs = window.getComputedStyle(child);
      if (cs.overflowY === 'auto' || cs.overflowY === 'scroll') {
        saved.push({ el: child, overflowY: child.style.overflowY, height: child.style.height, maxHeight: child.style.maxHeight });
        child.style.overflowY = 'visible';
        child.style.height    = 'auto';
        child.style.maxHeight = 'none';
      }
    });
    const savedMin = el.style.minHeight;
    el.style.minHeight = '0';

    try {
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        width:        el.scrollWidth,
        height:       el.scrollHeight,
        windowWidth:  el.scrollWidth,
        windowHeight: el.scrollHeight,
      });
      const filename = viewMode === 'month'
        ? `travel-${format(currentMonth, 'yyyy-MM')}.pdf`
        : `travel-${currentYear}.pdf`;
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width, canvas.height] });
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(filename);
    } catch (err) {
      console.error('PDF export failed', err);
    } finally {
      saved.forEach(s => {
        s.el.style.overflowY  = s.overflowY;
        s.el.style.height     = s.height;
        s.el.style.maxHeight  = s.maxHeight;
      });
      el.style.minHeight = savedMin;
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
    } catch (err) { console.error('Quick edit failed', err); }
    finally { setIsSaving(false); }
  };

  const periodLabel = viewMode === 'month'
    ? `${MONTH_NAMES[currentMonth.getMonth()]} ${currentYear}`
    : String(currentYear);

  return (
    <div
      ref={pdfRef}
      className="flex bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
      style={{ minHeight: '640px' }}
    >
      {/* ══ LEFT — Calendar ═════════════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 border-r border-slate-100">

        {/* Toolbar */}
        <div className="flex items-center px-5 py-3 border-b border-slate-100 gap-2">
          {/* view toggle */}
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

          {/* centered nav */}
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

          {/* right actions */}
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
        <div className="flex-1 p-4 overflow-auto">
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
        <div className="px-4 pt-4 pb-3 border-b border-slate-100">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">
            {countryCount} {countryCount === 1 ? 'country' : 'countries'} · {totalDays} days
          </p>
          <Globe visitedCountries={visitedCountries} />
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
            <CountryChart
              data={filteredStats}
              denominator={denominator}
              viewMode={viewMode}
            />
          ) : (
            <TripList trips={filteredTrips} />
          )}
        </div>
      </div>

      {/* Quick-edit dialog */}
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

/* ══════════════════════════════════════════════════════════════
   D3 Globe — canvas, drag to rotate, scroll to zoom,
   highlights visited countries
═══════════════════════════════════════════════════════════════ */
interface GlobeProps {
  visitedCountries: string[];
}

function Globe({ visitedCountries }: GlobeProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const topoRef     = useRef<Topology | null>(null);
  const rotateRef   = useRef<[number, number, number]>([0, -20, 0]);
  const scaleRef    = useRef(90);
  const dragging    = useRef(false);
  const dragStart   = useRef<{ x: number; y: number; rot: [number, number, number] }>({ x: 0, y: 0, rot: [0, 0, 0] });
  const rafRef      = useRef<number>(0);
  const SIZE        = 220;

  /* resolve visited country names → ISO numeric IDs */
  const visitedIds = useMemo(() => {
    const ids = new Set<number>();
    visitedCountries.forEach(name => {
      const id = resolveCountryId(name);
      if (id !== null) ids.add(id);
    });
    return ids;
  }, [visitedCountries]);

  /* draw frame */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !topoRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const topo = topoRef.current as any;
    const countries = (topojson.feature(topo, topo.objects.countries) as any).features;

    const proj = d3.geoOrthographic()
      .scale(scaleRef.current)
      .translate([SIZE / 2, SIZE / 2])
      .rotate(rotateRef.current)
      .clipAngle(90);

    const path = d3.geoPath(proj, ctx);
    const sphere: d3.GeoPermissibleObjects = { type: 'Sphere' };

    ctx.clearRect(0, 0, SIZE, SIZE);

    /* sphere background — very light fill so the globe boundary is visible */
    ctx.beginPath();
    path(sphere);
    ctx.fillStyle = 'rgba(241,245,249,0.55)'; // slate-100 at 55%
    ctx.fill();

    /* graticule grid (subtle) */
    const graticule = d3.geoGraticule()();
    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = 'rgba(148,163,184,0.25)'; // slate-400 at 25%
    ctx.lineWidth = 0.5;
    ctx.stroke();

    /* countries */
    countries.forEach((feature: any) => {
      const id      = parseInt(feature.id, 10);
      const visited = visitedIds.has(id);
      ctx.beginPath();
      path(feature);
      ctx.fillStyle   = visited ? '#3b82f6' : '#e2e8f0'; // blue-500 or slate-200
      ctx.fill();
      ctx.strokeStyle = visited ? 'rgba(255,255,255,0.7)' : 'rgba(148,163,184,0.4)';
      ctx.lineWidth   = 0.4;
      ctx.stroke();
    });

    /* outer ring */
    ctx.beginPath();
    path(sphere);
    ctx.strokeStyle = '#cbd5e1'; // slate-300
    ctx.lineWidth   = 1;
    ctx.stroke();
  }, [visitedIds]);

  /* auto-rotate */
  useEffect(() => {
    let last = 0;
    const animate = (now: number) => {
      const dt = last ? now - last : 0;
      last = now;
      if (!dragging.current) {
        rotateRef.current = [
          rotateRef.current[0] + dt * 0.02,
          rotateRef.current[1],
          rotateRef.current[2],
        ];
      }
      draw();
      rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw]);

  /* load world topology once */
  useEffect(() => {
    fetch('/world-110m.json')
      .then(r => r.json())
      .then(data => { topoRef.current = data; });
  }, []);

  /* ── pointer drag ── */
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      rot: [...rotateRef.current] as [number, number, number],
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    const sensitivity = 0.3;
    rotateRef.current = [
      dragStart.current.rot[0] + dx * sensitivity,
      Math.max(-90, Math.min(90, dragStart.current.rot[1] - dy * sensitivity)),
      dragStart.current.rot[2],
    ];
  };

  const onPointerUp = () => { dragging.current = false; };

  /* ── scroll to zoom ── */
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    scaleRef.current = Math.max(60, Math.min(200, scaleRef.current - e.deltaY * 0.2));
  };

  return (
    <div className="flex justify-center">
      <canvas
        ref={canvasRef}
        width={SIZE}
        height={SIZE}
        style={{ width: SIZE / 1.4, height: SIZE / 1.4, cursor: dragging.current ? 'grabbing' : 'grab', touchAction: 'none' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
      />
    </div>
  );
}

/* ══ Country bar chart ══════════════════════════════════════════ */
function CountryChart({
  data,
  denominator,
  viewMode,
}: {
  data: { country: string; days: number }[];
  denominator: number;
  viewMode: 'month' | 'year';
}) {
  if (data.length === 0) {
    return <p className="text-slate-400 text-xs text-center py-8">No travel data for this period.</p>;
  }

  const label = viewMode === 'year' ? '183 days (resident threshold)' : `${denominator} days in month`;

  return (
    <div className="space-y-4">
      <p className="text-[10px] text-slate-400 font-medium">Out of {label}</p>
      {data.map(({ country, days }) => {
        const pct = Math.min((days / denominator) * 100, 100);
        return (
          <div key={country} className="space-y-1">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-medium text-slate-700 truncate max-w-[55%]">{country}</span>
              <span className="text-xs font-semibold text-slate-900 shrink-0 tabular-nums">
                {days} / {denominator} d
              </span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ══ Trip list ═════════════════════════════════════════════════ */
function TripList({ trips }: { trips: TravelSegment[] }) {
  if (trips.length === 0)
    return <p className="text-slate-400 text-xs text-center py-8">No trips in this period.</p>;

  return (
    <div className="space-y-2">
      {trips.map(t => (
        <div
          key={t.id}
          className="flex gap-2.5 p-2.5 rounded-lg border border-slate-100 hover:border-blue-100 hover:bg-blue-50/30 transition-colors"
        >
          <div className="w-1 rounded-full bg-blue-400 shrink-0 self-stretch" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">{t.arrivalCountry}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {format(parseISO(t.arrivalDate), 'MMM d')} ← {t.departureCountry}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ══ Month view ════════════════════════════════════════════════ */
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
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-100">
        {DAYS_SHORT.map(d => (
          <div key={d} className="py-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {Array.from({ length: prefix }).map((_, i) => (
          <div key={`b-${i}`} className="h-20 border-b border-r border-slate-50 bg-slate-50/40" />
        ))}
        {days.map((date) => {
          const dateStr     = format(date, 'yyyy-MM-dd');
          const country     = locationMap[dateStr];
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
              <span className={`text-[11px] font-semibold ${isSelected ? 'text-blue-100' : isTodayDate ? 'text-blue-600' : 'text-slate-500'}`}>
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

/* ══ Year view ═════════════════════════════════════════════════ */
function YearView({
  year, locationMap, onDayClick,
}: { year: number; locationMap: Record<string, string>; onDayClick: (d: Date) => void }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 12 }, (_, i) => (
        <MiniMonth key={i} year={year} month={i} locationMap={locationMap} onDayClick={onDayClick} />
      ))}
    </div>
  );
}

/* ══ Mini month ════════════════════════════════════════════════ */
interface MiniMonthProps {
  year: number; month: number;
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
        {DAYS_TINY.map((d, i) => <div key={i} className="text-[8px] text-slate-400 text-center font-medium">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px">
        {Array.from({ length: prefix }).map((_, i) => <div key={`b-${i}`} />)}
        {days.map(date => {
          const dateStr     = format(date, 'yyyy-MM-dd');
          const hasTravel   = !!locationMap[dateStr];
          const isTodayDate = isToday(date);
          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(date)}
              title={locationMap[dateStr]}
              className={[
                'w-full aspect-square rounded-sm text-[8px] font-medium flex items-center justify-center transition-colors',
                isTodayDate ? 'bg-blue-600 text-white'
                  : hasTravel ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
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
