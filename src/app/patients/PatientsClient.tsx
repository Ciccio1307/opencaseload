"use client";

import { useState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Patient, Session } from "@/types/database";
import { FileText, FileSpreadsheet, Search, UserPlus, Pencil, Trash2, Users } from "lucide-react";
import { generatePatientExcel, generatePatientPDF } from "@/lib/exportUtils";
import { createPatient, updatePatient, deletePatient } from "@/app/actions/patients";

export function PatientsClient({
  initialPatients,
  initialSessions,
}: {
  initialPatients: Patient[];
  initialSessions: Session[];
}) {
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const sessions = initialSessions;
  const [searchQuery, setSearchQuery] = useState("");

  // Stato per il mese da esportare (di default il mese corrente YYYY-MM)
  const [exportMonth, setExportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // Gestione Modale (Nuovo / Modifica)
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [formData, setFormData] = useState({ name: "", phone: "", notes: "" });

  const filteredPatients = patients.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const handleOpenAdd = () => {
    setEditingPatient(null);
    setFormData({ name: "", phone: "", notes: "" });
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (p: Patient) => {
    setEditingPatient(p);
    setFormData({ name: p.name, phone: p.parent_contact || "", notes: p.notes || "" });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Sei sicuro di voler eliminare questo paziente? Tutti i suoi dati verranno persi.")) {
      const { error } = await deletePatient(id);
      if (error) {
        alert("Errore DB: " + error);
        return;
      }
      setPatients(patients.filter(p => p.id !== id));
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    const input = {
      name: formData.name,
      parent_contact: formData.phone,
      notes: formData.notes,
    };

    if (editingPatient) {
      const { data, error } = await updatePatient(editingPatient.id, input);

      if (error) {
        alert("Errore DB: " + error);
        return;
      }

      if (data) {
        setPatients(patients.map(p => p.id === editingPatient.id ? data : p));
      }
    } else {
      const { data, error } = await createPatient(input);

      if (error) {
        alert("Errore DB: " + error);
        return;
      }

      if (data) {
        setPatients([data, ...patients]);
      }
    }
    setIsDialogOpen(false);
  };

  return (
    <div className="p-4 space-y-6 pb-8">
      {/* Header */}
      <header className="flex justify-between items-center pt-2">
        <div>
          <h1 className="text-2xl font-bold text-bordeaux-gradient">Pazienti</h1>
          <p className="text-muted-foreground text-sm">Gestione anagrafica ({patients.length})</p>
        </div>
        <Button
          onClick={handleOpenAdd}
          size="icon"
          className="rounded-full shadow-lg bg-bordeaux-gradient border-0 text-white hover:opacity-90"
          aria-label="Nuovo paziente"
        >
          <UserPlus size={24} />
        </Button>
      </header>

      {/* Ricerca e Filtro Mese */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
          <input
            type="text"
            placeholder="Cerca paziente..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="flex items-center gap-2 px-1">
          <Label className="text-sm text-muted-foreground whitespace-nowrap">Resoconti di:</Label>
          <Input
            type="month"
            value={exportMonth}
            onChange={e => setExportMonth(e.target.value)}
            className="h-9 w-auto text-sm bg-muted/30"
          />
        </div>
      </div>

      {/* Lista Pazienti */}
      <div className="space-y-4">
        {filteredPatients.length === 0 && (
          <Card className="border-dashed border-2 bg-muted/30">
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users size={48} className="mb-4 text-primary/40" />
              <p className="font-medium text-lg">
                {searchQuery ? "Nessun paziente trovato." : "Ancora nessun paziente qui."}
              </p>
              <p className="text-sm text-center mt-1">
                {searchQuery ? "Prova con un altro nome." : "Tocca il pulsante in alto a destra per aggiungerne uno."}
              </p>
            </CardContent>
          </Card>
        )}

        {filteredPatients.map((patient) => {
          const patientSessions = sessions.filter(s => s.patient_id === patient.id);

          // Filtra le sessioni per il mese selezionato per l'export
          const exportSessions = patientSessions.filter(s => {
            if (!exportMonth) return true; // se il campo è vuoto esporta tutto
            return s.date.startsWith(exportMonth);
          });

          const totalHoursAllTime = (patientSessions.reduce((acc, s) => acc + s.duration_minutes, 0) / 60).toFixed(1);
          const totalHoursExport = (exportSessions.reduce((acc, s) => acc + s.duration_minutes, 0) / 60).toFixed(1);

          return (
            <Card key={patient.id} className="overflow-hidden border-border/60 relative group hover:shadow-[0_4px_16px_-4px_rgba(124,16,52,0.18)]">
              <CardContent className="p-4">
                <div className="flex justify-between items-start pr-12">
                  <div>
                    <p className="font-bold text-lg">{patient.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {patient.parent_contact || "Nessun recapito"}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-primary/5 border-primary/20 text-primary whitespace-nowrap">
                    {totalHoursAllTime} h tot.
                  </Badge>
                </div>
                {patient.notes && (
                  <p className="text-sm mt-3 p-3 bg-muted/50 rounded-lg italic text-muted-foreground">
                    &quot;{patient.notes}&quot;
                  </p>
                )}

                {/* Azioni Modifica / Elimina in alto a destra */}
                <div className="absolute top-3 right-2 flex flex-col gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary" onClick={() => handleOpenEdit(patient)}>
                    <Pencil size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => handleDelete(patient.id)}>
                    <Trash2 size={16} />
                  </Button>
                </div>

              </CardContent>
              <CardFooter className="p-4 pt-0 flex gap-2 border-t border-border/30 mt-3 pt-3 flex-col">
                <div className="text-xs text-center w-full text-muted-foreground mb-1">
                  Esporta {exportSessions.length} sedute ({totalHoursExport} h) per il mese scelto:
                </div>
                <div className="flex gap-2 w-full">
                  <Button
                    variant="outline"
                    className="flex-1 border-primary/20 text-primary hover:bg-primary/10"
                    onClick={() => generatePatientPDF(patient, exportSessions)}
                  >
                    <FileText size={18} className="mr-2" /> PDF
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-green-200 text-green-700 hover:bg-green-50 dark:border-green-900 dark:text-green-400 dark:hover:bg-green-950/30"
                    onClick={() => generatePatientExcel(patient, exportSessions)}
                  >
                    <FileSpreadsheet size={18} className="mr-2" /> Excel
                  </Button>
                </div>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {/* Modale Aggiungi / Modifica */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[90vw] max-w-[400px] rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingPatient ? 'Modifica Paziente' : 'Nuovo Paziente'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome e Cognome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="Es. Giulia Verdi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Recapito Genitore</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={e => setFormData({...formData, phone: e.target.value})}
                placeholder="Es. +39 333 1234567"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Note (opzionale)</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                placeholder="Informazioni utili..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)} className="w-full sm:w-auto">Annulla</Button>
            <Button onClick={handleSave} className="w-full sm:w-auto bg-bordeaux-gradient text-white border-0">Salva</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
