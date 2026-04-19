import React, { useState } from 'react';
import { TravelSegment } from '../types';
import { travelService } from '../services/travelService';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { format, parseISO, differenceInDays } from 'date-fns';
import { Edit2, Trash2, MapPin, History } from 'lucide-react';

interface TravelHistoryProps {
  segments: TravelSegment[];
}

export function TravelHistory({ segments }: TravelHistoryProps) {
  const [editingSegment, setEditingSegment] = useState<TravelSegment | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const sortedSegments = [...segments].sort((a, b) =>
    new Date(b.departureDate).getTime() - new Date(a.departureDate).getTime()
  );

  const allIds = sortedSegments.map(s => s.id);
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const someSelected = selected.size > 0;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allIds));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selected.size} selected record${selected.size !== 1 ? 's' : ''}?`)) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all([...selected].map(id => travelService.deleteSegment(id)));
      setSelected(new Set());
    } catch (error) {
      console.error('Failed to bulk delete', error);
    } finally {
      setIsBulkDeleting(false);
    }
  };

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
      console.error('Failed to update segment', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;
    setIsDeleting(id);
    try {
      await travelService.deleteSegment(id);
      setSelected(prev => { const next = new Set(prev); next.delete(id); return next; });
    } catch (error) {
      console.error('Failed to delete segment', error);
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Stays History</h2>
          <p className="text-slate-500">View and manage all your recorded stays.</p>
        </div>
        <div className="flex items-center gap-2">
          {someSelected && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {isBulkDeleting ? 'Deleting…' : `Delete ${selected.size}`}
            </Button>
          )}
          <div className="bg-blue-50 p-2 rounded-lg">
            <History className="w-5 h-5 text-blue-600" />
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent bg-slate-50/50">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                  />
                </TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Arrival Date</TableHead>
                <TableHead>Departure Date</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedSegments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-slate-500">
                    No stays records found.
                  </TableCell>
                </TableRow>
              ) : (
                sortedSegments.map((segment, index) => {
                  const isSelected = selected.has(segment.id);
                  const arrivalInCountry     = parseISO(segment.departureDate);
                  const departureFromCountry = parseISO(segment.arrivalDate);
                  const nights = differenceInDays(departureFromCountry, arrivalInCountry);
                  return (
                    <TableRow
                      key={segment.id || index}
                      className={`group ${isSelected ? 'bg-blue-50' : ''}`}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(segment.id)}
                          className="w-4 h-4 rounded border-slate-300 accent-blue-600 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 font-medium">
                          <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          {segment.arrivalCountry}
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-slate-900">
                          {format(arrivalInCountry, 'PP')}
                        </p>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm font-medium text-slate-900">
                          {format(departureFromCountry, 'PP')}
                        </p>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-500">{nights} day{nights !== 1 ? 's' : ''}</span>
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
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Edit Dialog ── */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Edit Stay Record</DialogTitle>
          </DialogHeader>
          {editingSegment && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" /> Country
                </Label>
                <Input
                  value={editingSegment.arrivalCountry}
                  onChange={e => setEditingSegment({
                    ...editingSegment,
                    arrivalCountry: e.target.value,
                    departureCountry: e.target.value,
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Arrival Date</Label>
                <Input
                  type="date"
                  value={format(parseISO(editingSegment.departureDate), 'yyyy-MM-dd')}
                  onChange={e => setEditingSegment({
                    ...editingSegment,
                    departureDate: new Date(e.target.value + 'T00:00:00').toISOString(),
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Departure Date</Label>
                <Input
                  type="date"
                  value={format(parseISO(editingSegment.arrivalDate), 'yyyy-MM-dd')}
                  onChange={e => setEditingSegment({
                    ...editingSegment,
                    arrivalDate: new Date(e.target.value + 'T00:00:00').toISOString(),
                  })}
                />
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
