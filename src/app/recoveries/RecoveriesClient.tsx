"use client";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Patient, Session } from "@/types/database";
import { Clock, UserCheck, CheckCircle2 } from "lucide-react";
import { recoverSessions } from "@/app/actions/sessions";
import { LOCALE } from "@/lib/branding";

export function RecoveriesClient({
  initialPatients,
  initialSessions,
}: {
  initialPatients: Patient[];
  initialSessions: Session[];
}) {
  const [dbSessions, setDbSessions] = useState<Session[]>(initialSessions);
  const dbPatients = initialPatients;

  const handleRecoverSessions = async (sessionsToUpdate: Session[]) => {
    if (!window.confirm("Mark these hours as recovered? They will disappear from this list.")) return;

    const ids = sessionsToUpdate.map(s => s.id);

    const { error } = await recoverSessions(ids);
    if (error) {
      alert("Database error: " + error);
      return;
    }

    setDbSessions(dbSessions.map(s => ids.includes(s.id) ? { ...s, status: 'recovered' } : s));
  };

  // Sessions that still need to be recovered
  const sessionsToRecover = dbSessions.filter(s => s.status === 'absent' || s.status === 'to_recover');

  // Group by patient to get the total outstanding hours
  const recoveriesByPatient = sessionsToRecover.reduce((acc, session) => {
    if (!acc[session.patient_id]) {
      const patient = dbPatients.find(p => p.id === session.patient_id);
      if (!patient) return acc;

      acc[session.patient_id] = {
        patient: patient,
        totalMinutes: 0,
        sessions: []
      };
    }
    acc[session.patient_id].totalMinutes += session.duration_minutes;
    acc[session.patient_id].sessions.push(session);
    return acc;
  }, {} as Record<string, { patient: Patient, totalMinutes: number, sessions: Session[] }>);

  const patientsWithRecoveries = Object.values(recoveriesByPatient);

  return (
    <div className="p-4 space-y-6 pb-8">
      <header className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-2xl font-bold text-bordeaux-gradient">Recoveries</h1>
          <p className="text-muted-foreground text-sm">Hours to reschedule</p>
        </div>
      </header>

      {patientsWithRecoveries.length === 0 ? (
        <Card className="border-dashed border-2 bg-muted/30">
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <UserCheck size={48} className="mb-4 text-green-500/50" />
            <p className="font-medium text-lg">All caught up!</p>
            <p className="text-sm text-center mt-1">No patient has hours to recover.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {patientsWithRecoveries.map((record) => {
            const totalHoursFormatted = (record.totalMinutes / 60).toFixed(1);

            return (
              <Card key={record.patient.id} className="border-border/60">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">{record.patient.name}</CardTitle>
                    <Badge variant="destructive" className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 flex items-center gap-1 text-sm py-1">
                      <Clock size={14} />
                      {totalHoursFormatted} h
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2">
                  <p className="text-sm text-muted-foreground mb-3">
                    Absences:
                  </p>
                  <ul className="space-y-2">
                    {record.sessions.map(s => (
                      <li key={s.id} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md">
                        <span className="font-medium text-foreground/80">{new Date(s.date).toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'short' })}</span>
                        <span className="text-muted-foreground">{s.duration_minutes} min</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <Button
                    onClick={() => handleRecoverSessions(record.sessions)}
                    className="w-full bg-green-600 hover:bg-green-700 border-0 text-white shadow-md"
                  >
                    <CheckCircle2 size={18} className="mr-2" />
                    Mark as recovered
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
