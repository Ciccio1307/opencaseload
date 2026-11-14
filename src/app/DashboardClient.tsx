"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Session, Patient, STATUS_LABELS, needsRecovery } from "@/types/database";
import Link from "next/link";
import { Plus, Check, X, Clock, Settings, Users, CalendarDays, CalendarSync, Trash2 } from "lucide-react";
import { createTherapySession, updateSessionStatus, deleteTherapySession } from "@/app/actions/sessions";
import { greeting } from "@/lib/branding";
import { dayKey, formatDate, formatTime, weekDayKeys, zonedParts, zonedToUtcISO } from "@/lib/dates";
import { daySchedule, formatHours, indexById, weekSummary } from "@/lib/caseload";

export function DashboardClient({
  initialPatients,
  initialSessions,
}: {
  initialPatients: Patient[];
  initialSessions: Session[];
}) {
  const [viewMode, setViewMode] = useState<'today' | 'week'>('today');
  const [dbSessions, setDbSessions] = useState<Session[]>(initialSessions);
  const dbPatients = initialPatients;
  const patientsById = useMemo(() => indexById(initialPatients), [initialPatients]);

  // Modal state
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    patient_id: "",
    date: dayKey(new Date()),
    time: "15:00",
    duration: 60,
    notes: ""
  });

  const handleSaveSession = async () => {
    if (!sessionForm.patient_id) return;
    const sessionDateTime = zonedToUtcISO(sessionForm.date, sessionForm.time);
    const { data, error } = await createTherapySession({
      patient_id: sessionForm.patient_id,
      date: sessionDateTime,
      duration_minutes: sessionForm.duration,
      status: 'scheduled',
      notes: sessionForm.notes
    });

    if (error) {
      alert("Could not save the session: " + error);
      return;
    }

    if (data) {
      setDbSessions(prev => [...prev, data]);
      setIsSessionModalOpen(false);
      setSessionForm(prev => ({ ...prev, patient_id: "", notes: "" }));
    }
  };

  const handleStatusUpdate = async (sessionId: string, newStatus: 'completed' | 'absent') => {
    const { data, error } = await updateSessionStatus(sessionId, newStatus);
    if (error) {
      alert("Could not update the session: " + error);
      return;
    }
    if (data) {
      setDbSessions(prev => prev.map(s => s.id === sessionId ? data : s));
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm("Delete this session?")) {
      const { error } = await deleteTherapySession(sessionId);
      if (error) {
        alert("Could not delete the session: " + error);
        return;
      }
      setDbSessions(prev => prev.filter(s => s.id !== sessionId));
    }
  };

  // All day/week grouping happens in the instance time zone (see lib/dates.ts)
  const today = new Date();
  const todayKey = dayKey(today);
  // One linear pass each over the sessions (see lib/caseload.ts).
  const { slots: timeSlots, sessionCount: todayPatients, minutesWorked: todayMinutesWorked } =
    daySchedule(dbSessions, todayKey);
  const weekDays = weekSummary(dbSessions, weekDayKeys(todayKey));

  return (
    <div className="p-4 space-y-6 pb-8">
      {/* Header */}
      <header className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-2xl font-bold text-bordeaux-gradient">{greeting(zonedParts(today).hour)}</h1>
          <p className="text-muted-foreground text-sm capitalize">
            {formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/settings" aria-label="Settings">
            <Button variant="outline" size="icon" tabIndex={-1} className="rounded-full shadow-sm border-border/50 text-muted-foreground hover:text-primary">
              <Settings size={20} />
            </Button>
          </Link>
          <Button
            size="icon"
            className="rounded-full shadow-lg bg-bordeaux-gradient border-0 text-white hover:opacity-90"
            aria-label="New session"
            onClick={() => setIsSessionModalOpen(true)}
          >
            <Plus size={24} />
          </Button>
        </div>
      </header>

      {/* Toggle View */}
      <div className="flex p-1 bg-muted/50 rounded-xl">
        <button onClick={() => setViewMode('today')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${viewMode === 'today' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
          <CalendarSync size={16} /> Today
        </button>
        <button onClick={() => setViewMode('week')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${viewMode === 'week' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
          <CalendarDays size={16} /> Week
        </button>
      </div>

      {viewMode === 'today' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-primary/20 bg-primary/5 py-0 gap-0">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Patients today</CardTitle>
                <Users size={16} className="text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0"><p className="text-3xl font-bold">{todayPatients}</p></CardContent>
            </Card>
            <Card className="border-primary/20 bg-primary/5 py-0 gap-0">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Hours worked</CardTitle>
                <Clock size={16} className="text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0"><p className="text-3xl font-bold">{formatHours(todayMinutesWorked)}h</p></CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4 text-bordeaux-gradient">Appointments</h2>
            <div className="space-y-6">
              {timeSlots.map((slot) => {
                const startTimeStr = formatTime(slot.start);
                const endDate = new Date(slot.start.getTime() + slot.duration * 60000);
                const endTimeStr = formatTime(endDate);

                return (
                  <div key={`${slot.start.getTime()}_${slot.duration}`} className="relative pl-4 border-l-2 border-primary/30 space-y-3">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-primary shadow-sm" />
                    <div className="-mt-1.5 mb-3 flex items-center gap-2">
                      <span className="font-bold text-lg">{startTimeStr} - {endTimeStr}</span>
                      <Badge variant="secondary" className="bg-primary/10 text-primary">{slot.duration} min</Badge>
                      {slot.sessions.length > 1 && <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/40 dark:text-orange-300">Multiple ({slot.sessions.length})</Badge>}
                    </div>
                    <div className="space-y-3">
                      {slot.sessions.map(session => {
                        const patient = patientsById.get(session.patient_id);
                        if (!patient) return null;
                        return (
                          <Card key={session.id} className="overflow-hidden border-border/60 ml-2 relative py-0 gap-0 hover:shadow-[0_4px_16px_-4px_rgba(124,16,52,0.18)]">
                            <CardContent className="p-0">
                              <div className="flex items-stretch">
                                <div className={`w-2 shrink-0 ${needsRecovery(session) ? 'bg-red-400' : 'bg-primary/40'}`}></div>
                                <div className="p-4 flex-1">
                                  <div className="flex justify-between items-center mb-3 pr-8">
                                    <p className="font-bold text-base leading-none">{patient.name}</p>
                                    <Badge variant={session.status === 'completed' ? 'default' : session.status === 'absent' ? 'destructive' : 'outline'} className={session.status === 'completed' ? 'bg-green-600' : ''}>
                                      {STATUS_LABELS[session.status]}
                                    </Badge>
                                  </div>

                                  {/* Delete button */}
                                  <button onClick={() => handleDeleteSession(session.id)} aria-label={`Delete session of ${patient.name}`} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive">
                                    <Trash2 size={18} />
                                  </button>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      aria-pressed={session.status === 'completed'}
                                      className={`flex-1 h-10 ${session.status === 'completed'
                                        ? 'border-green-600 bg-green-600 text-white hover:bg-green-700 hover:text-white dark:border-green-600 dark:bg-green-600 dark:text-white dark:hover:bg-green-700'
                                        : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-400 dark:hover:bg-green-950/70 dark:hover:text-green-300'}`}
                                      onClick={() => handleStatusUpdate(session.id, 'completed')}
                                    >
                                      <Check size={18} className="mr-1" /> Present
                                    </Button>
                                    <Button
                                      variant="outline"
                                      aria-pressed={session.status === 'absent'}
                                      className={`flex-1 h-10 ${session.status === 'absent'
                                        ? 'border-red-600 bg-red-600 text-white hover:bg-red-700 hover:text-white dark:border-red-600 dark:bg-red-600 dark:text-white dark:hover:bg-red-700'
                                        : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70 dark:hover:text-red-300'}`}
                                      onClick={() => handleStatusUpdate(session.id, 'absent')}
                                    >
                                      <X size={18} className="mr-1" /> Absent
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        // WEEK VIEW
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2 className="text-lg font-semibold mb-2 text-bordeaux-gradient">Weekly summary</h2>
          {weekDays.map((data) => (
            <Card key={data.day} className="border-border/60 py-0 gap-0">
              <CardHeader className="p-4 pb-2 border-b border-border/50 bg-muted/20">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base font-bold capitalize">
                    {formatDate(data.date, { weekday: 'short', day: 'numeric', month: 'short' })}
                  </CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-background">
                      <Users size={12} className="mr-1" /> {data.patientIds.size}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-2">Patients:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(data.patientIds).map(patientId => {
                    const patient = patientsById.get(patientId);
                    return patient ? (
                      <Badge key={patientId} variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
                        {patient.name}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* NEW SESSION MODAL */}
      <Dialog open={isSessionModalOpen} onOpenChange={setIsSessionModalOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Add session</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Patient *</Label>
              <select
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={sessionForm.patient_id}
                onChange={e => setSessionForm({...sessionForm, patient_id: e.target.value})}
              >
                <option value="">Select a patient...</option>
                {dbPatients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={sessionForm.date}
                  onChange={e => setSessionForm({...sessionForm, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Start time *</Label>
                <Input
                  type="time"
                  value={sessionForm.time}
                  onChange={e => setSessionForm({...sessionForm, time: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Duration (minutes) *</Label>
              <select
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={sessionForm.duration}
                onChange={e => setSessionForm({...sessionForm, duration: parseInt(e.target.value)})}
              >
                <option value={30}>30 minutes</option>
                <option value={45}>45 minutes</option>
                <option value={60}>60 minutes (1 hour)</option>
                <option value={90}>90 minutes (1.5 hours)</option>
                <option value={120}>120 minutes (2 hours)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Input
                value={sessionForm.notes}
                onChange={e => setSessionForm({...sessionForm, notes: e.target.value})}
                placeholder="E.g. Group therapy..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSessionModalOpen(false)} className="w-full sm:w-auto">Cancel</Button>
            <Button onClick={handleSaveSession} className="w-full sm:w-auto bg-bordeaux-gradient text-white border-0">
              Save to agenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
