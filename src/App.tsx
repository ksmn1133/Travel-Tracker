import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { TravelSegment } from './types';
import { travelService } from './services/travelService';
import { CalendarView } from './components/CalendarView';
import { SummaryView } from './components/SummaryView';
import { AddTravelView } from './components/AddTravelView';
import { TravelHistory } from './components/TravelHistory';
import { ImportFlights } from './components/ImportFlights';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Button } from './components/ui/button';
import { Plane, Calendar, BarChart3, Plus, LogOut, Globe, History } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [segments, setSegments] = useState<TravelSegment[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) {
      const unsubscribe = travelService.subscribeToSegments(setSegments);
      return unsubscribe;
    } else {
      setSegments([]);
    }
  }, [user]);

  useEffect(() => {
    if (user && !loading && segments.length === 0) {
      const autoFillLocation = async () => {
        if ("geolocation" in navigator) {
          navigator.geolocation.getCurrentPosition(async (position) => {
            try {
              const { latitude, longitude } = position.coords;
              // Using Nominatim for reverse geocoding (OpenStreetMap)
              const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`, {
                headers: {
                  'Accept-Language': 'en'
                }
              });
              const data = await response.json();
              const country = data.address?.country;
              
              if (country) {
                const now = new Date();
                const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                
                await travelService.addSegment({
                  departureCountry: country,
                  arrivalCountry: country,
                  departureDate: startOfToday.toISOString(),
                  arrivalDate: now.toISOString(),
                });
              }
            } catch (error) {
              console.error("Failed to auto-fill location", error);
            }
          }, (error) => {
            // User might have denied permission or other error
            console.log("Geolocation not available or denied", error);
          });
        }
      };
      autoFillLocation();
    }
  }, [user, loading, segments.length]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const handleLogout = () => auth.signOut();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <Plane className="w-8 h-8 text-blue-600" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-6 max-w-md"
        >
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-blue-200">
            <Globe className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">TravelTrack</h1>
          <p className="text-slate-600">
            Keep track of your global footprint. Record your travels, visualize your journey, and see where you've spent your time.
          </p>
          <Button onClick={handleLogin} size="lg" className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl h-12">
            Sign in with Google
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
              <Globe className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight">TravelTrack</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <p className="text-sm font-medium">{user.displayName}</p>
              <p className="text-xs text-slate-500">{user.email}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleLogout} className="text-slate-500 hover:text-red-600">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <Tabs defaultValue="calendar" className="space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <TabsList className="bg-slate-200/50 p-1 rounded-xl w-fit">
              <TabsTrigger value="calendar" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Calendar className="w-4 h-4 mr-2" />
                Calendar
              </TabsTrigger>
              <TabsTrigger value="summary" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <BarChart3 className="w-4 h-4 mr-2" />
                Summary
              </TabsTrigger>
              <TabsTrigger value="add" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Record
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <History className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
            </TabsList>
            
            <ImportFlights onImported={() => {}} />
          </div>

            <AnimatePresence mode="wait">
              <TabsContent key="calendar" value="calendar">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <CalendarView segments={segments} />
                </motion.div>
              </TabsContent>

              <TabsContent key="summary" value="summary">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <SummaryView segments={segments} />
                </motion.div>
              </TabsContent>

              <TabsContent key="add" value="add">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <AddTravelView />
                </motion.div>
              </TabsContent>

              <TabsContent key="history" value="history">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <TravelHistory segments={segments} />
                </motion.div>
              </TabsContent>
            </AnimatePresence>
        </Tabs>
      </main>
    </div>
  );
}
