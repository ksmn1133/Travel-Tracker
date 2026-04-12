import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { travelService } from '../services/travelService';
import { PlaneTakeoff, PlaneLanding, Save, Trash2, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

export function AddTravelView() {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    departureCountry: '',
    departureDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    arrivalCountry: '',
    arrivalDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Ensure dates are in ISO format with Z
      const departureDate = new Date(formData.departureDate).toISOString();
      const arrivalDate = new Date(formData.arrivalDate).toISOString();
      
      await travelService.addSegment({
        ...formData,
        departureDate,
        arrivalDate,
      });
      
      setFormData({
        departureCountry: '',
        departureDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        arrivalCountry: '',
        arrivalDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      });
    } catch (error) {
      console.error("Failed to add segment", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader>
          <CardTitle>Add Travel Record</CardTitle>
          <CardDescription>Manually enter your flight or journey details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-blue-600 font-medium">
                  <PlaneTakeoff className="w-4 h-4" />
                  Departure
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departureCountry">Country</Label>
                  <Input 
                    id="departureCountry" 
                    placeholder="e.g. USA" 
                    value={formData.departureCountry}
                    onChange={e => setFormData({...formData, departureCountry: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="departureDate">Date & Time</Label>
                  <Input 
                    id="departureDate" 
                    type="datetime-local" 
                    value={formData.departureDate}
                    onChange={e => setFormData({...formData, departureDate: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2 text-green-600 font-medium">
                  <PlaneLanding className="w-4 h-4" />
                  Arrival
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arrivalCountry">Country</Label>
                  <Input 
                    id="arrivalCountry" 
                    placeholder="e.g. Japan" 
                    value={formData.arrivalCountry}
                    onChange={e => setFormData({...formData, arrivalCountry: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="arrivalDate">Date & Time</Label>
                  <Input 
                    id="arrivalDate" 
                    type="datetime-local" 
                    value={formData.arrivalDate}
                    onChange={e => setFormData({...formData, arrivalDate: e.target.value})}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white px-8">
                {loading ? 'Saving...' : 'Save Record'}
                <Save className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
