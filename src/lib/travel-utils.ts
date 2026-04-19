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
  const lastArrival = parseISO(sortedSegments[sortedSegments.length - 1].arrivalDate);
  const end = lastArrival > startOfDay(new Date()) ? lastArrival : startOfDay(new Date());
  
  const allDays = eachDayOfInterval({ start, end });

  allDays.forEach(day => {
    const dateStr = format(day, 'yyyy-MM-dd');
    
    // Find if this day falls within any segment
    // A segment is from departure to arrival.
    // If a day is between segments, we assume the user is in the arrival country of the previous segment.
    
    // Find the segment that contains this day
    const activeSegment = sortedSegments.find(s => 
      isWithinInterval(day, { 
        start: parseISO(s.departureDate), 
        end: parseISO(s.arrivalDate) 
      })
    );

    if (activeSegment) {
      // During travel, we'll just say they are in the arrival country for simplicity, 
      // or we could handle "In Transit". Let's stick to arrival country.
      dailyLocations.push({ date: dateStr, country: activeSegment.arrivalCountry });
    } else {
      // Find the last segment that ended before this day
      const lastSegment = [...sortedSegments]
        .reverse()
        .find(s => parseISO(s.arrivalDate) < day);
      
      if (lastSegment) {
        dailyLocations.push({ date: dateStr, country: lastSegment.arrivalCountry });
      } else {
        // Before the first segment, they were in the departure country of the first segment
        dailyLocations.push({ date: dateStr, country: sortedSegments[0].departureCountry });
      }
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
