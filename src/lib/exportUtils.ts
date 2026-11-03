import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, Session } from '@/types/database';
import { APP_NAME } from '@/lib/branding';

export function generatePatientExcel(patient: Patient, sessions: Session[]) {
  // Filtra le sedute specifiche per questo paziente
  const patientSessions = sessions.filter(s => s.patient_id === patient.id);
  
  // Prepara i dati strutturati per l'Excel
  const data = patientSessions.map(session => ({
    'Data': new Date(session.date).toLocaleDateString('it-IT'),
    'Ora': new Date(session.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    'Durata (min)': session.duration_minutes,
    'Stato': session.status.replace('_', ' '),
    'Note': session.notes || ''
  }));

  // Calcola il totale delle ore e dei minuti
  const totalMinutes = patientSessions.reduce((acc, curr) => acc + curr.duration_minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  // Aggiunge una riga di riepilogo in fondo
  data.push({
    'Data': 'TOTALE',
    'Ora': '',
    'Durata (min)': totalMinutes,
    'Stato': `${totalHours} ore`,
    'Note': ''
  });

  // Crea il file Excel
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Foglio Ore');

  // Avvia il download
  XLSX.writeFile(workbook, `Resoconto_${patient.name.replace(/\s+/g, '_')}.xlsx`);
}

export function generatePatientPDF(patient: Patient, sessions: Session[]) {
  const patientSessions = sessions.filter(s => s.patient_id === patient.id);
  
  const doc = new jsPDF();
  
  // Intestazione personalizzata
  doc.setFontSize(18);
  doc.setTextColor(124, 16, 52); // Bordeaux
  doc.text(`${APP_NAME} — Foglio ore di ${patient.name}`, 14, 22);
  
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Contatto: ${patient.parent_contact}`, 14, 30);
  doc.text(`Generato il: ${new Date().toLocaleDateString('it-IT')}`, 14, 36);

  // Corpo della tabella
  const tableData = patientSessions.map(session => [
    new Date(session.date).toLocaleDateString('it-IT'),
    new Date(session.date).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    `${session.duration_minutes} min`,
    session.status.replace('_', ' '),
    session.notes || '-'
  ]);

  const totalMinutes = patientSessions.reduce((acc, curr) => acc + curr.duration_minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  // Riga totale per il PDF
  tableData.push([
    'TOTALE',
    '',
    `${totalMinutes} min (${totalHours} h)`,
    '',
    ''
  ]);

  // Disegna la tabella con il plugin autotable
  autoTable(doc, {
    startY: 45,
    head: [['Data', 'Ora', 'Durata', 'Stato', 'Note']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [124, 16, 52] }, // Intestazione colore Bordeaux
    footStyles: { fillColor: [240, 240, 240], textColor: [0,0,0], fontStyle: 'bold' },
  });

  // Avvia il download
  doc.save(`Resoconto_${patient.name.replace(/\s+/g, '_')}.pdf`);
}
