import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { geminiService } from '../services/geminiService';
import { travelService } from '../services/travelService';
import { Sparkles, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

interface ImportFlightsProps {
  onImported: () => void;
}

export function ImportFlights({ onImported }: ImportFlightsProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleImport = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setStatus('idle');
    try {
      const segments = await geminiService.parseFlightRecords(text);
      
      if (segments.length === 0) {
        setStatus('error');
        return;
      }

      for (const segment of segments) {
        await travelService.addSegment(segment);
      }
      
      setStatus('success');
      setText('');
      setTimeout(() => {
        setOpen(false);
        setStatus('idle');
        onImported();
      }, 2000);
    } catch (error) {
      console.error("Import failed", error);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" className="border-blue-200 text-blue-600 hover:bg-blue-50 hover:text-blue-700">
            <Sparkles className="w-4 h-4 mr-2" />
            AI Import
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Import Flight Records</DialogTitle>
          <DialogDescription>
            Paste your flight confirmation emails or itinerary text. Gemini will automatically extract the travel segments for you.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Textarea 
            placeholder="Paste itinerary here... e.g. 'Flight from New York to London on May 5th, arriving May 6th...'" 
            className="min-h-[200px] resize-none"
            value={text}
            onChange={e => setText(e.target.value)}
            disabled={loading}
          />
        </div>
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="flex items-center gap-2">
            {loading && (
              <div className="flex items-center text-sm text-slate-500">
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gemini is thinking...
              </div>
            )}
            {status === 'success' && (
              <div className="flex items-center text-sm text-green-600">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Imported successfully!
              </div>
            )}
            {status === 'error' && (
              <div className="flex items-center text-sm text-red-600">
                <AlertCircle className="w-4 h-4 mr-2" />
                Failed to parse records.
              </div>
            )}
          </div>
          <Button onClick={handleImport} disabled={loading || !text.trim()} className="bg-blue-600 hover:bg-blue-700">
            {loading ? 'Processing...' : 'Start Import'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
