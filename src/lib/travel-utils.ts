import { format, eachDayOfInterval, parseISO, isWithinInterval, startOfDay } from 'date-fns';
import { TravelSegment, DailyLocation } from '../types';

export function calculateDailyLocations(segments: TravelSegment[]): DailyLocation[] {
  if (segments.length === 0) return [];

  // Sort segments by departure date
  const sortedSegments = [...segments].sort((a, b) => 
    new Date(a.departureDate).getTime() - new Date(b.departureDate).getTime()
  );

  const dailyLocations: DailyLocation[] = [];
  
  // We need a start and end range. Let's use the first departure and last arrival.
  const start = parseISO(sortedSegments[0].departureDate);
  // Use the latest arrivalDate across ALL segments, not just the last by departureDate
  const maxArrival = new Date(Math.max(...sortedSegments.map(s => new Date(s.arrivalDate).getTime())));
  const end = maxArrival > startOfDay(new Date()) ? maxArrival : startOfDay(new Date());
  
  const allDays = eachDayOfInterval({ start, end });

  allDays.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    
    // Find if this day falls within any segment
    // A segment is from departure to arrival.
    // If a day is between segments, we assume the user is in the arrival country of the previous segment.
    
    // Find ALL segments that cover this day (multiple countries possible in one day)
    const activeSegments = sortedSegments.filter(s =>
      isWithinInterval(day, {
        start: parseISO(s.departureDate),
        end: parseISO(s.arrivalDate),
      })
    );

    if (activeSegments.length > 0) {
      // Deduplicate and push one entry per unique country
      const seen = new Set<string>();
      activeSegments.forEach(s => {
        if (!seen.has(s.arrivalCountry)) {
          seen.add(s.arrivalCountry);
          dailyLocations.push({ date: dateStr, country: s.arrivalCountry });
        }
      });
    } else {
      // Find the last MULTI-day stay that ended before this day.
      // Single-day entries (departureDate === arrivalDate) are point-in-time visits —
      // they should NOT cascade their country into subsequent days.
      const lastSegment = [...sortedSegments]
        .reverse()
        .find(s => {
          const dep = parseISO(s.departureDate).getTime();
          const arr = parseISO(s.arrivalDate).getTime();
          return arr > dep && arr <= day.getTime();
        });

      // Only cascade into a gap if there is a FUTURE stay — i.e. this day sits
      // between two recorded stays. After the last stay ends, show nothing.
      const hasNextStay = sortedSegments.some(
        s => parseISO(s.departureDate).getTime() > day.getTime()
      );

      if (lastSegment && hasNextStay) {
        dailyLocations.push({ date: dateStr, country: lastSegment.arrivalCountry });
      }
      // If no multi-day stay covers or precedes this day (or there is no future stay),
      // leave it blank (no entry).
    }
  });

  return dailyLocations;
}

export function calculateCountryStats(segments: TravelSegment[], year: number) {
  const dailyLocations = calculateDailyLocations(segments);
  const yearStr = year.toString();
  
  const yearLocations = dailyLocations.filter(dl => dl.date.startsWith(yearStr));
  
  const stats: Record<string, number> = {};
  yearLocations.forEach(dl => {
    stats[dl.country] = (stats[dl.country] || 0) + 1;
  });
  
  return Object.entries(stats)
    .map(([country, days]) => ({ country, days }))
    .sort((a, b) => b.days - a.days);
}

export function calculateMonthlyStats(segments: TravelSegment[], year: number) {
  const dailyLocations = calculateDailyLocations(segments);
  const yearStr = year.toString();
  
  const yearLocations = dailyLocations.filter(dl => dl.date.startsWith(yearStr));
  
  // month -> country -> days
  const monthlyData: Record<number, Record<string, number>> = {};
  
  // Initialize months 0-11
  for (let i = 0; i < 12; i++) {
    monthlyData[i] = {};
  }
  
  yearLocations.forEach(dl => {
    const date = parseISO(dl.date);
    const month = date.getMonth();
    monthlyData[month][dl.country] = (monthlyData[month][dl.country] || 0) + 1;
  });
  
  return monthlyData;
}
