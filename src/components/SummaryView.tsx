import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { TravelSegment } from '../types';
import { calculateCountryStats, calculateMonthlyStats } from '../lib/travel-utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Flag, Clock, Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';

interface SummaryViewProps {
  segments: TravelSegment[];
}

export function SummaryView({ segments }: SummaryViewProps) {
  const [year, setYear] = useState<string>(new Date().getFullYear().toString());
  const [viewMode, setViewMode] = useState<'annual' | 'monthly'>('annual');
  
  const stats = useMemo(() => calculateCountryStats(segments, parseInt(year)), [segments, year]);
  const monthlyStats = useMemo(() => calculateMonthlyStats(segments, parseInt(year)), [segments, year]);
  
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

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{viewMode === 'annual' ? 'Annual Summary' : 'Monthly Summary'}</h2>
          <p className="text-slate-500">Breakdown of days spent in each country for {year}.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-100 p-1 rounded-lg flex">
            <button 
              onClick={() => setViewMode('annual')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'annual' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Annual
            </button>
            <button 
              onClick={() => setViewMode('monthly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'monthly' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Monthly
            </button>
          </div>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[100px] bg-white">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y, index) => (
                <SelectItem key={`${y}-${index}`} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {viewMode === 'annual' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="md:col-span-3 border-slate-200 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[300px]">Country</TableHead>
                    <TableHead className="text-right">Days Spent</TableHead>
                    <TableHead className="text-right">Percentage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stats.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="h-32 text-center text-slate-500">
                        No travel records found for {year}.
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats.map((stat, index) => {
                      const totalDays = stats.reduce((acc, s) => acc + s.days, 0);
                      const percentage = ((stat.days / totalDays) * 100).toFixed(1);
                      return (
                        <TableRow key={`${stat.country}-${index}`}>
                          <TableCell className="font-medium flex items-center gap-2">
                            <Flag className="w-4 h-4 text-slate-400" />
                            {stat.country}
                          </TableCell>
                          <TableCell className="text-right">{stat.days}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-slate-500 text-xs">{percentage}%</span>
                              <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-blue-500 rounded-full" 
                                  style={{ width: `${percentage}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Countries</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{stats.length}</p>
              </CardContent>
            </Card>
            
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Most Visited</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold truncate">{stats[0]?.country || 'N/A'}</p>
                {stats[0] && <p className="text-sm text-slate-500">{stats[0].days} days</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {monthNames.map((monthName, monthIdx) => {
            const monthData = monthlyStats[monthIdx] || {};
            const countries = Object.entries(monthData).sort((a, b) => (b[1] as number) - (a[1] as number));
            const totalDaysInMonth = countries.reduce((acc, [_, days]) => acc + (days as number), 0);

            return (
              <Card key={monthName} className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2 border-b border-slate-50">
                  <CardTitle className="text-base flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CalendarIcon className="w-4 h-4 text-blue-600" />
                      {monthName}
                    </span>
                    <span className="text-xs font-normal text-slate-400">{totalDaysInMonth} days recorded</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {countries.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-4">No data for this month</p>
                  ) : (
                    <div className="space-y-3">
                      {countries.map(([country, days]) => (
                        <div key={country} className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Flag className="w-3 h-3 text-slate-300 shrink-0" />
                            <span className="text-sm truncate">{country}</span>
                          </div>
                          <span className="text-sm font-medium text-slate-700 shrink-0">{days}d</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
