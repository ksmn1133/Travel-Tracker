import React, { useState, useMemo, useRef } from 'react';
import { Calendar } from './ui/calendar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { TravelSegment } from '../types';
import { calculateDailyLocations } from '../lib/travel-utils';
import { format, parseISO, setMonth, setYear, startOfMonth, startOfDay, addMinutes } from 'date-fns';
import { MapPin, Info, Download, Calendar as CalendarIcon, Edit3 } from 'lucide-react';
import { cn } from '../lib/utils';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { travelService } from '../services/travelService';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface CalendarViewProps {
  segments: TravelSegment[];
}

export function CalendarView({ segments }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [quickEditDate, setQuickEditDate] = useState<Date | null>(null);
  const [quickEditCountry, setQuickEditCountry] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  
  const dailyLocations = useMemo(() => calculateDailyLocations(segments), [segments]);
  
  const locationMap = useMemo(() => {
    const map: Record<string, string> = {};
    dailyLocations.forEach(dl => {
      map[dl.date] = dl.country;
    });
    return map;
  }, [dailyLocations]);

  const years = useMemo(() => {
    const yearsSet = new Set<number>();
    yearsSet.add(new Date().getFullYear());
    segments.forEach(s => {
      const depYear = new Date(s.departureDate).getFullYear();
      const arrYear = new Date(s.arrivalDate).getFullYear();
      if (!isNaN(depYear)) yearsSet.add(depYear);
      if (!isNaN(arrYear)) yearsSet.add(arrYear);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [segments]);

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const handleExportPDF = async () => {
    if (!calendarRef.current) return;
    
    try {
      const canvas = await html2canvas(calendarRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`travel-calendar-${format(currentMonth, 'yyyy-MM')}.pdf`);
    } catch (error) {
      console.error("Failed to export PDF", error);
    }
  };

  const handleQuickEdit = (date: Date, currentCountry: string) => {
    setQuickEditDate(date);
    setQuickEditCountry(currentCountry === 'Unknown' ? '' : currentCountry);
  };

  const saveQuickEdit = async () => {
    if (!quickEditDate || !quickEditCountry.trim()) return;
    
    setIsSaving(true);
    try {
      const dateStr = format(quickEditDate, 'yyyy-MM-dd');
      const prevCountry = locationMap[dateStr] || 'Unknown';
      
      // Create a segment that starts at the beginning of the day
      // This effectively "sets" the location for this day and onwards
      await travelService.addSegment({
        departureCountry: prevCountry,
        arrivalCountry: quickEditCountry.trim(),
        departureDate: startOfDay(quickEditDate).toISOString(),
        arrivalDate: addMinutes(startOfDay(quickEditDate), 1).toISOString(),
      });
      
      setQuickEditDate(null);
    } catch (error) {
      console.error("Failed to save quick edit", error);
    } finally {
      setIsSaving(false);
    }
  };

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';
  const currentCountry = locationMap[selectedDateStr] || 'Unknown';

  return (
    <div className="space-y-6">
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Travel Calendar</CardTitle>
            <CardDescription>View your daily locations. We assume you stay in the arrival country of your last trip until your next departure.</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select 
              value={currentMonth.getMonth().toString()} 
              onValueChange={(val) => setCurrentMonth(setMonth(currentMonth, parseInt(val)))}
            >
              <SelectTrigger className="w-[130px] bg-white">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {months.map((m, i) => (
                  <SelectItem key={m} value={i.toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select 
              value={currentMonth.getFullYear().toString()} 
              onValueChange={(val) => setCurrentMonth(setYear(currentMonth, parseInt(val)))}
            >
              <SelectTrigger className="w-[100px] bg-white">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((y) => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button 
              variant="outline" 
              size="icon" 
              onClick={handleExportPDF}
              className="text-slate-500 hover:text-blue-600 hover:border-blue-200"
              title="Export as PDF"
            >
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 flex justify-center" ref={calendarRef}>
          <div className="w-full max-w-4xl">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="w-full"
            classNames={{
              months: "w-full",
              month: "w-full space-y-4",
              table: "w-full border-collapse",
              head_row: "flex w-full",
              head_cell: "text-slate-500 rounded-md flex-1 font-normal text-[0.8rem]",
              row: "flex w-full mt-2",
              cell: cn(
                "relative h-24 sm:h-32 flex-1 text-center text-sm p-0 focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-blue-50/50",
                "first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
              ),
              day: cn(
                "h-full w-full p-2 font-normal aria-selected:opacity-100 hover:bg-slate-100 transition-colors"
              ),
              day_selected: "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",
              day_today: "bg-slate-100 text-slate-900",
              day_outside: "text-slate-400 opacity-50",
              day_disabled: "text-slate-400 opacity-50",
              day_range_middle: "aria-selected:bg-slate-100 aria-selected:text-slate-900",
              day_hidden: "invisible",
            }}
            components={{
              DayButton: (props) => {
                const { day, modifiers, className, ...buttonProps } = props;
                const date = day.date;
                if (!date || isNaN(date.getTime())) return null;
                
                const dateStr = format(date, 'yyyy-MM-dd');
                const country = locationMap[dateStr];
                const isOutside = !!modifiers.outside;
                const isSelected = !!modifiers.selected;
                const isToday = !!modifiers.today;

                return (
                  <button
                    {...buttonProps}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleQuickEdit(date, country || 'Unknown');
                    }}
                    className={cn(
                      "h-full w-full p-2 flex flex-col items-start gap-1 transition-colors border border-slate-50",
                      isOutside && "text-slate-400 opacity-50",
                      isSelected ? "bg-blue-600 text-white" : isToday ? "bg-blue-50" : "hover:bg-slate-50",
                      country && !isSelected && "bg-blue-50/30",
                      className
                    )}
                  >
                    <span className={cn(
                      "text-xs font-medium",
                      isSelected ? "text-blue-100" : "text-slate-500"
                    )}>
                      {format(date, 'd')}
                    </span>
                    {country && (
                      <span className={cn(
                        "text-[10px] sm:text-xs font-bold truncate w-full text-left",
                        isSelected ? "text-white" : "text-blue-700"
                      )}>
                        {country}
                      </span>
                    )}
                  </button>
                );
              }
            }}
          />
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!quickEditDate} onOpenChange={(open) => !open && setQuickEditDate(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-blue-600" />
              Quick Edit Location
            </DialogTitle>
            <DialogDescription>
              Set your location for {quickEditDate ? format(quickEditDate, 'PPP') : ''}. This will create a new travel record.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                value={quickEditCountry}
                onChange={(e) => setQuickEditCountry(e.target.value)}
                placeholder="Enter country name"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveQuickEdit();
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickEditDate(null)}>Cancel</Button>
            <Button onClick={saveQuickEdit} disabled={isSaving || !quickEditCountry.trim()} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isSaving ? 'Saving...' : 'Save Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-600" />
            Selected Date Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-slate-500">{selectedDate ? format(selectedDate, 'PPP') : 'No date selected'}</p>
              <p className="text-2xl font-bold text-slate-900">{currentCountry}</p>
            </div>
            <div className="bg-blue-50 p-3 rounded-xl">
              <Info className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
