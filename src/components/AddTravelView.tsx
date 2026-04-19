import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { travelService } from '../services/travelService';
import { MapPin, Save, Check } from 'lucide-react';
import { format } from 'date-fns';

export function AddTravelView() {
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formData, setFormData] = useState({
    country: '',
    arrivalDate: format(new Date(), 'yyyy-MM-dd'),
    departureDate: format(new Date(), 'yyyy-MM-dd'),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // arrivalDate (user's arrival in country) = start of stay = segment departureDate
      // departureDate (user's departure from country) = end of stay = segment arrivalDate
      // arrivalDate (user's arrival) → segment.departureDate (start of stay interval)
      // departureDate (user's departure) → segment.arrivalDate (end of stay interval)
      // Use T00:00:00 to parse as local midnight and avoid UTC offset shifts
      await travelService.addSegment({
        departureCountry: formData.country,
        arrivalCountry: formData.country,
        departureDate: new Date(formData.arrivalDate + 'T00:00:00').toISOString(),
        arrivalDate: new Date(formData.departureDate + 'T00:00:00').toISOString(),
      });

      setFormData({
        country: '',
        arrivalDate: format(new Date(), 'yyyy-MM-dd'),
        departureDate: format(new Date(), 'yyyy-MM-dd'),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch (error) {
      console.error('Failed to add stay', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-blue-600" />
            Add Stays Record
          </CardTitle>
          <CardDescription>Enter the country and dates of your stay.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Input
                id="country"
                placeholder="e.g. China"
                value={formData.country}
                onChange={e => setFormData({ ...formData, country: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="arrivalDate">Arrival Date</Label>
              <Input
                id="arrivalDate"
                type="date"
                value={formData.arrivalDate}
                onChange={e => setFormData({ ...formData, arrivalDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="departureDate">Departure Date</Label>
              <Input
                id="departureDate"
                type="date"
                value={formData.departureDate}
                onChange={e => setFormData({ ...formData, departureDate: e.target.value })}
                required
              />
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                type="submit"
                disabled={loading || saved}
                className={`px-8 text-white transition-colors ${saved ? 'bg-green-500 hover:bg-green-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
              >
                {loading ? (
                  <>Saving... <Save className="w-4 h-4 ml-2" /></>
                ) : saved ? (
                  <>Completed <Check className="w-4 h-4 ml-2" /></>
                ) : (
                  <>Save Record <Save className="w-4 h-4 ml-2" /></>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
