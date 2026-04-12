export interface TravelSegment {
  id: string;
  departureCountry: string;
  departureDate: string; // ISO string
  arrivalCountry: string;
  arrivalDate: string; // ISO string
  userId: string;
  createdAt: string;
}

export interface DailyLocation {
  date: string; // YYYY-MM-DD
  country: string;
}
