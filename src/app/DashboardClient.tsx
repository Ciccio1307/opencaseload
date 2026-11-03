"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Session, Patient } from "@/types/database";
import Link from "next/link";
import { Plus, Check, X, Clock, Settings, Users, CalendarDays, CalendarSync, Trash2 } from "lucide-react";
import { createTherapySession, updateSessionStatus, deleteTherapySession } from "@/app/actions/sessions";
import { greeting } from "@/lib/branding";

// Helper per inizio/fine settimana
const getStartOfWeek = (date: Date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
};

export function DashboardClient({
  initialPatients,
  initialSessions,
}: {
  initialPatients: Patient[];
  initialSessions: Session[];
}) {
  const [viewMode, setViewMode] = useState<'oggi' | 'settimana'>('oggi');
  const [dbSessions, setDbSessions] = useState<Session[]>(initialSessions);
  const dbPatients = initialPatients;

  // Stato Modale
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [sessionForm, setSessionForm] = useState({
    patient_id: "",
    date: new Date().toISOString().split('T')[0],
    time: "15:00",
    duration: 60,
    notes: ""
  });

  const handleSaveSession = async () => {
    if (!sessionForm.patient_id) return;
    const sessionDateTime = new Date(`${sessionForm.date}T${sessionForm.time}:00`).toISOString();
    const { data, error } = await createTherapySession({
      patient_id: sessionForm.patient_id,
      date: sessionDateTime,
      duration_minutes: sessionForm.duration,
      status: 'da_recuperare',
      notes: sessionForm.notes
    });

    if (error) {
      alert("Errore DB Seduta: " + error);
      return;
    }

    if (data) {
      setDbSessions([...dbSessions, data]);
      setIsSessionModalOpen(false);
      setSessionForm(prev => ({ ...prev, patient_id: "", notes: "" }));
    }
  };

  const handleStatusUpdate = async (sessionId: string, newStatus: 'completata' | 'assente') => {
    const { data } = await updateSessionStatus(sessionId, newStatus);
    if (data) {
      setDbSessions(dbSessions.map(s => s.id === sessionId ? data : s));
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questa seduta?")) {
      await deleteTherapySession(sessionId);
      setDbSessions(dbSessions.filter(s => s.id !== sessionId));
    }
  };

  // DATI OGGI
  const today = new Date();
  const todaySessions = dbSessions.filter(s => {
    const d = new Date(s.date);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

  // DATI SETTIMANA CORRENTE
  const startOfWeek = getStartOfWeek(new Date());
  startOfWeek.setHours(0,0,0,0);
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(endOfWeek.getDate() + 6);
  endOfWeek.setHours(23,59,59,999);

  const weekSessions = dbSessions.filter(s => {
    const d = new Date(s.date);
    return d >= startOfWeek && d <= endOfWeek;
  });

  const groupedToday = todaySessions.reduce((acc, session) => {
    const sessionDate = new Date(session.date);
    const timeKey = sessionDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) + '_' + session.duration_minutes;
    if (!acc[timeKey]) acc[timeKey] = { date: sessionDate, duration: session.duration_minutes, sessions: [] };
    acc[timeKey].sessions.push(session);
    return acc;
  }, {} as Record<string, { date: Date, duration: number, sessions: Session[] }>);

  const timeSlots = Object.values(groupedToday).sort((a, b) => a.date.getTime() - b.date.getTime());
  const todayMinutesWorked = timeSlots.reduce((acc, slot) => acc + slot.duration, 0);
  const todayPatients = todaySessions.length;

  const groupedWeek = weekSessions.reduce((acc, session) => {
    const d = new Date(session.date);
    const dayKey = d.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' });
    if (!acc[dayKey]) acc[dayKey] = { date: d, patients: new Set(), totalMinutes: 0 };
    acc[dayKey].patients.add(session.patient_id);
    acc[dayKey].totalMinutes += session.duration_minutes;
    return acc;
  }, {} as Record<string, { date: Date, patients: Set<string>, totalMinutes: number }>);

  const weekDays = Object.entries(groupedWeek).sort((a, b) => a[1].date.getTime() - b[1].date.getTime());

  return (
    <div className="p-4 space-y-6 pb-8">
      {/* Header */}
      <header className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-2xl font-bold text-bordeaux-gradient">{greeting(today.getHours())}</h1>
          <p className="text-muted-foreground text-sm capitalize">
            {today.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/settings">
            <Button variant="outline" size="icon" className="rounded-full shadow-sm border-border/50 text-muted-foreground hover:text-primary">
              <Settings size={20} />
            </Button>
          </Link>
          <Button
            size="icon"
            className="rounded-full shadow-lg bg-bordeaux-gradient border-0 text-white hover:opacity-90"
            aria-label="Nuova seduta"
            onClick={() => setIsSessionModalOpen(true)}
          >
            <Plus size={24} />
          </Button>
        </div>
      </header>

      {/* Toggle View */}
      <div className="flex p-1 bg-muted/50 rounded-xl">
        <button onClick={() => setViewMode('oggi')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${viewMode === 'oggi' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
          <CalendarSync size={16} /> Oggi
        </button>
        <button onClick={() => setViewMode('settimana')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${viewMode === 'settimana' ? 'bg-background shadow-sm text-primary' : 'text-muted-foreground'}`}>
          <CalendarDays size={16} /> Settimana
        </button>
      </div>

      {viewMode === 'oggi' ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pazienti Oggi</CardTitle>
                <Users size={16} className="text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0"><p className="text-3xl font-bold">{todayPatients}</p></CardContent>
            </Card>
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ore di Lavoro</CardTitle>
                <Clock size={16} className="text-primary" />
              </CardHeader>
              <CardContent className="p-4 pt-0"><p className="text-3xl font-bold">{(todayMinutesWorked / 60).toFixed(1)}h</p></CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-4 text-bordeaux-gradient">Appuntamenti</h2>
            <div className="space-y-6">
              {timeSlots.map((slot, index) => {
                const startTimeStr = slot.date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
                const endDate = new Date(slot.date.getTime() + slot.duration * 60000);
                const endTimeStr = endDate.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={index} className="relative pl-4 border-l-2 border-primary/30 space-y-3">
                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-background border-2 border-primary shadow-sm" />
                    <div className="-mt-1.5 mb-3 flex items-center gap-2">
                      <span className="font-bold text-lg">{startTimeStr} - {endTimeStr}</span>
                      <Badge variant="secondary" className="bg-primary/10 text-primary">{slot.duration} min</Badge>
                      {slot.sessions.length > 1 && <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">Multiplo ({slot.sessions.length})</Badge>}
                    </div>
                    <div className="space-y-3">
                      {slot.sessions.map(session => {
                        const patient = dbPatients.find(p => p.id === session.patient_id);
                        if (!patient) return null;
                        return (
                          <Card key={session.id} className="overflow-hidden border-border/60 ml-2 relative hover:shadow-[0_4px_16px_-4px_rgba(124,16,52,0.18)]">
                            <CardContent className="p-0">
                              <div className="flex items-stretch">
                                <div className={`w-2 shrink-0 ${session.status === 'assente' || session.status === 'da_recuperare' ? 'bg-red-400' : 'bg-primary/40'}`}></div>
                                <div className="p-4 flex-1">
                                  <div className="flex justify-between items-center mb-3 pr-8">
                                    <p className="font-bold text-base leading-none">{patient.name}</p>
                                    <Badge variant={session.status === 'completata' ? 'default' : session.status === 'assente' ? 'destructive' : 'outline'} className={session.status === 'completata' ? 'bg-green-600' : ''}>
                                      {session.status.replace('_', ' ')}
                                    </Badge>
                                  </div>

                                  {/* Bottone Elimina */}
                                  <button onClick={() => handleDeleteSession(session.id)} className="absolute top-3 right-3 text-muted-foreground hover:text-destructive">
                                    <Trash2 size={18} />
                                  </button>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      className="flex-1 h-10 border-green-200 bg-green-50 text-green-700 hover:bg-green-100 hover:text-green-800"
                                      onClick={() => handleStatusUpdate(session.id, 'completata')}
                                    >
                                      <Check size={18} className="mr-1" /> Presente
                                    </Button>
                                    <Button
                                      variant="outline"
                                      className="flex-1 h-10 border-red-200 bg-red-50 text-red-700 hover:bg-red-100 hover:text-red-800"
                                      onClick={() => handleStatusUpdate(session.id, 'assente')}
                                    >
                                      <X size={18} className="mr-1" /> Assente
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
        // VISTA SETTIMANA
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <h2 className="text-lg font-semibold mb-2 text-bordeaux-gradient">Riepilogo Settimanale</h2>
          {weekDays.map(([dayName, data], index) => (
            <Card key={index} className="border-border/60">
              <CardHeader className="p-4 pb-2 border-b border-border/50 bg-muted/20">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-base font-bold capitalize">{dayName}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-background">
                      <Users size={12} className="mr-1" /> {data.patients.size}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground mb-2">Pazienti seguiti:</p>
                <div className="flex flex-wrap gap-2">
                  {Array.from(data.patients).map(patientId => {
                    const patient = dbPatients.find(p => p.id === patientId);
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

      {/* MODALE NUOVA SEDUTA */}
      <Dialog open={isSessionModalOpen} onOpenChange={setIsSessionModalOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>Aggiungi Seduta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Paziente *</Label>
              <select
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={sessionForm.patient_id}
                onChange={e => setSessionForm({...sessionForm, patient_id: e.target.value})}
              >
                <option value="">Seleziona paziente...</option>
                {dbPatients.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data *</Label>
                <Input
                  type="date"
                  value={sessionForm.date}
                  onChange={e => setSessionForm({...sessionForm, date: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Orario Inizio *</Label>
                <Input
                  type="time"
                  value={sessionForm.time}
                  onChange={e => setSessionForm({...sessionForm, time: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Durata (minuti) *</Label>
              <select
                className="w-full px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                value={sessionForm.duration}
                onChange={e => setSessionForm({...sessionForm, duration: parseInt(e.target.value)})}
              >
                <option value={30}>30 minuti</option>
                <option value={45}>45 minuti</option>
                <option value={60}>60 minuti (1 ora)</option>
                <option value={90}>90 minuti (1.5 ore)</option>
                <option value={120}>120 minuti (2 ore)</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label>Note (opzionale)</Label>
              <Input
                value={sessionForm.notes}
                onChange={e => setSessionForm({...sessionForm, notes: e.target.value})}
                placeholder="Es. Terapia di gruppo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSessionModalOpen(false)} className="w-full sm:w-auto">Annulla</Button>
            <Button onClick={handleSaveSession} className="w-full sm:w-auto bg-bordeaux-gradient text-white border-0">
              Salva in Agenda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
