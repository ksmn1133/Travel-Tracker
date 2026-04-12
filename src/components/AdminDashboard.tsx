import React, { useState, useEffect, useMemo } from 'react';
import { travelService } from '../services/travelService';
import { TravelSegment } from '../types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { calculateMonthlyStats } from '../lib/travel-utils';
import { format, parseISO } from 'date-fns';
import { Users, Globe, Calendar as CalendarIcon, Search } from 'lucide-react';
import { Input } from './ui/input';
import { cn } from '../lib/utils';

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  role: string;
  lastLogin: string;
}

export function AdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [allSegments, setAllSegments] = useState<TravelSegment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    const unsubUsers = travelService.subscribeToUsers(setUsers);
    const unsubSegments = travelService.subscribeToAllSegments(setAllSegments);
    return () => {
      unsubUsers();
      unsubSegments();
    };
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) || 
      u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [users, searchQuery]);

  const userStats = useMemo(() => {
    const stats: Record<string, any> = {};
    
    filteredUsers.forEach(user => {
      const userSegments = allSegments.filter(s => s.userId === user.uid);
      const monthlyData = calculateMonthlyStats(userSegments, selectedYear);
      
      // Calculate total countries visited this year
      const countries = new Set<string>();
      userSegments.forEach(s => {
        if (new Date(s.departureDate).getFullYear() === selectedYear) {
          countries.add(s.arrivalCountry);
        }
      });

      stats[user.uid] = {
        monthlyData,
        totalCountries: countries.size,
        totalSegments: userSegments.length
      };
    });
    
    return stats;
  }, [filteredUsers, allSegments, selectedYear]);

  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight">Admin Management</h2>
          <p className="text-slate-500 text-sm">Monitor all users and their travel activity across the platform.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-[200px] sm:w-[300px] bg-white"
            />
          </div>
          <select 
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{users.length}</span>
              <div className="bg-blue-50 p-2 rounded-lg">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">{allSegments.length}</span>
              <div className="bg-green-50 p-2 rounded-lg">
                <Globe className="w-5 h-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">Active This Year</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold">
                {users.filter(u => new Date(u.lastLogin).getFullYear() === selectedYear).length}
              </span>
              <div className="bg-purple-50 p-2 rounded-lg">
                <CalendarIcon className="w-5 h-5 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-white border-b border-slate-100">
          <CardTitle>User Monthly Travel Matrix ({selectedYear})</CardTitle>
          <CardDescription>A breakdown of countries visited by each user per month.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="w-[250px]">User</TableHead>
                  {months.map(m => (
                    <TableHead key={m} className="text-center min-w-[80px]">{m}</TableHead>
                  ))}
                  <TableHead className="text-right font-bold">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map(user => {
                  const stats = userStats[user.uid];
                  return (
                    <TableRow key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">
                              {user.displayName?.charAt(0) || user.email.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 truncate max-w-[150px]">{user.displayName || 'Anonymous'}</span>
                            <span className="text-xs text-slate-500 truncate max-w-[150px]">{user.email}</span>
                          </div>
                          {user.role === 'admin' && (
                            <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 text-[10px] font-bold uppercase">Admin</span>
                          )}
                        </div>
                      </TableCell>
                      {months.map((_, i) => {
                        const monthCountries = Object.keys(stats?.monthlyData[i] || {});
                        const count = monthCountries.length;
                        return (
                          <TableCell key={i} className="text-center">
                            {count > 0 ? (
                              <div className="group relative inline-block">
                                <span className={cn(
                                  "inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold",
                                  count > 2 ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"
                                )}>
                                  {count}
                                </span>
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
                                  <div className="bg-slate-900 text-white text-[10px] rounded px-2 py-1 whitespace-nowrap shadow-xl">
                                    {monthCountries.join(', ')}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
                          </TableCell>
                        );
                      })}
                      <TableCell className="text-right font-bold text-slate-900">
                        {stats?.totalCountries || 0}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
