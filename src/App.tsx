import React, { useState, useEffect } from 'react';
import { auth } from './firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { TravelSegment } from './types';
import { travelService } from './services/travelService';
import { CalendarView } from './components/CalendarView';
import { AddTravelView } from './components/AddTravelView';
import { TravelHistory } from './components/TravelHistory';
import { ImportFlights } from './components/ImportFlights';
import { AdminDashboard } from './components/AdminDashboard';
import { TaxCalculator } from './components/TaxCalculator';
import { UserMenu } from './components/UserMenu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './components/ui/tabs';
import { Button } from './components/ui/button';
import { Plane, Calendar, Plus, Globe, History, ShieldCheck, Home, Hotel, Calculator } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

function LoadingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 100 ? 0 : prev + 0.5));
    }, 20);
    return () => clearInterval(interval);
  }, []);

  const t = progress / 100;
  const p0 = { x: 40, y: 120 };
  const p1 = { x: 160, y: 20 };
  const p2 = { x: 280, y: 120 };

  const x = Math.pow(1 - t, 2) * p0.x + 2 * (1 - t) * t * p1.x + Math.pow(t, 2) * p2.x;
  const y = Math.pow(1 - t, 2) * p0.y + 2 * (1 - t) * t * p1.y + Math.pow(t, 2) * p2.y;

  const dx = 2 * (1 - t) * (p1.x - p0.x) + 2 * t * (p2.x - p1.x);
  const dy = 2 * (1 - t) * (p1.y - p0.y) + 2 * t * (p2.y - p1.y);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <div className="relative z-10 flex flex-col items-center gap-16">
        <div className="relative w-96 h-48">
          <svg className="absolute inset-0 w-full h-full overflow-visible" viewBox="0 0 320 160">
            <path
              d={`M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="2"
              strokeDasharray="4 4"
            />
            
            <motion.path
              d={`M ${p0.x} ${p0.y} Q ${p1.x} ${p1.y} ${p2.x} ${p2.y}`}
              fill="none"
              stroke="url(#gradient)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="400"
              animate={{ strokeDashoffset: 400 - (400 * progress) / 100 }}
              transition={{ ease: "linear", duration: 0.1 }}
            />

            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#2563eb" />
              </linearGradient>
            </defs>

            <motion.g
              animate={{ x, y, rotate: angle + 45 }}
              transition={{ ease: "linear", duration: 0.05 }}
            >
              <Plane 
                className="w-8 h-8 -translate-x-4 -translate-y-4 text-blue-600 drop-shadow-[0_4px_6px_rgba(59,130,246,0.3)]" 
                fill="currentColor" 
              />
            </motion.g>
          </svg>

          <div className="absolute left-0 bottom-0 -translate-x-1/2 translate-y-1/2 flex flex-col items-center gap-2">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 text-blue-600 shadow-sm">
              <Home className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Origin</span>
          </div>

          <div className="absolute right-0 bottom-0 translate-x-1/2 translate-y-1/2 flex flex-col items-center gap-2">
            <div className="bg-white p-3 rounded-2xl border border-slate-200 text-blue-600 shadow-sm">
              <Hotel className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Arrival</span>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-medium tracking-[0.2em] uppercase text-slate-900">Preparing Journey</h3>
            <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Synchronizing travel data...</p>
          </div>
          
          <div className="relative w-64 h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <motion.div 
              className="absolute inset-y-0 left-0 bg-blue-600"
              animate={{ width: `${progress}%` }}
              transition={{ ease: "linear" }}
            />
          </div>
          <span className="text-[10px] font-mono text-blue-600 font-bold">{Math.round(progress)}%</span>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [segments, setSegments] = useState<TravelSegment[]>([]);
  const isAdmin = user?.email === 'xiaoxia3691158@gmail.com';

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        travelService.syncUser(user);
      }
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
    return <LoadingScreen />;
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
          <UserMenu user={user} onLogout={handleLogout} />
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
<TabsTrigger value="add" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Record
              </TabsTrigger>
              <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <History className="w-4 h-4 mr-2" />
                History
              </TabsTrigger>
              <TabsTrigger value="tax" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm">
                <Calculator className="w-4 h-4 mr-2" />
                Tax
              </TabsTrigger>
              {isAdmin && (
                <TabsTrigger value="admin" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm text-blue-600 data-[state=active]:text-blue-700">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Admin
                </TabsTrigger>
              )}
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

              <TabsContent key="tax" value="tax">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                >
                  <TaxCalculator />
                </motion.div>
              </TabsContent>

              {isAdmin && (
                <TabsContent key="admin" value="admin">
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                  >
                    <AdminDashboard />
                  </motion.div>
                </TabsContent>
              )}
            </AnimatePresence>
        </Tabs>
      </main>
    </div>
  );
}

export default function AppWithProviders() {
  return (
    <LanguageProvider>
      <App />
    </LanguageProvider>
  );
}
