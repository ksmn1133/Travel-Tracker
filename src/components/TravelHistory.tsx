import React, { useState } from 'react';
import { TravelSegment } from '../types';
import { travelService } from '../services/travelService';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { format, parseISO } from 'date-fns';
import { Edit2, Trash2, PlaneTakeoff, PlaneLanding, ArrowRight, History } from 'lucide-react';

interface TravelHistoryProps {
  segments: TravelSegment[];
}

export function TravelHistory({ segments }: TravelHistoryProps) {
  const [editingSegment, setEditingSegment] = useState<TravelSegment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const sortedSegments = [...segments].sort((a, b) => 
    new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime()
  );

  const handleEdit = (segment: TravelSegment) => {
    setEditingSegment({ ...segment });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!editingSegment) return;
    try {
      const { id, userId, createdAt, ...data } = editingSegment;
      await travelService.updateSegment(id, data);
      setIsEditDialogOpen(false);
      setEditingSegment(null);
    } catch (error) {
      console.error("Failed to update segment", error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this record?")) return;
    setIsDeleting(id);
    try {
      await travelService.deleteSegment(id);
    } catch (error) {
      console.error("Failed to delete segment", error);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Travel History</h2>
          <p className="text-slate-500">View and manage all your recorded journeys.</p>
        </div>
        <div className="bg-blue-50 p-2 rounded-lg">
          <History className="w-5 h-5 text-blue-600" />
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-slate-50/50">
                <TableHead>Journey</TableHead>
                <TableHead>Departure</TableHead>
                <TableHead>Arrival</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSegments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-slate-500">
                    No travel records found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedSegments.map((segment, index) => (
                  <TableRow key={segment.id || index} className="group">
                    <TableCell>
                      <div className="flex items-center gap-2 font-medium">
                        <span>{segment.departureCountry}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <span>{segment.arrivalCountry}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium text-slate-900">{format(parseISO(segment.departureDate), 'PP')}</p>
                        <p className="text-xs text-slate-500">{format(parseISO(segment.departureDate), 'p')}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium text-slate-900">{format(parseISO(segment.arrivalDate), 'PP')}</p>
                        <p className="text-xs text-slate-500">{format(parseISO(segment.arrivalDate), 'p')}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleEdit(segment)}
                          className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDelete(segment.id)}
                          disabled={isDeleting === segment.id}
                          className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Travel Record</DialogTitle>
            <CardDescription>Update the details of your journey.</CardDescription>
          </DialogHeader>
          {editingSegment && (
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-blue-600">
                    <PlaneTakeoff className="w-3 h-3" /> Departure Country
                  </Label>
                  <Input 
                    value={editingSegment.departureCountry}
                    onChange={e => setEditingSegment({...editingSegment, departureCountry: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-green-600">
                    <PlaneLanding className="w-3 h-3" /> Arrival Country
                  </Label>
                  <Input 
                    value={editingSegment.arrivalCountry}
                    onChange={e => setEditingSegment({...editingSegment, arrivalCountry: e.target.value})}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Departure Date & Time</Label>
                  <Input 
                    type="datetime-local"
                    value={format(parseISO(editingSegment.departureDate), "yyyy-MM-dd'T'HH:mm")}
                    onChange={e => setEditingSegment({...editingSegment, departureDate: new Date(e.target.value).toISOString()})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Arrival Date & Time</Label>
                  <Input 
                    type="datetime-local"
                    value={format(parseISO(editingSegment.arrivalDate), "yyyy-MM-dd'T'HH:mm")}
                    onChange={e => setEditingSegment({...editingSegment, arrivalDate: new Date(e.target.value).toISOString()})}
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdate} className="bg-blue-600 hover:bg-blue-700 text-white">Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
