import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, Session, STATUS_LABELS } from '@/types/database';
import { APP_NAME, LOCALE } from '@/lib/branding';

export function generatePatientExcel(patient: Patient, sessions: Session[]) {
  // Keep only the sessions that belong to this patient
  const patientSessions = sessions.filter(s => s.patient_id === patient.id);

  const data = patientSessions.map(session => ({
    'Date': new Date(session.date).toLocaleDateString(LOCALE),
    'Time': new Date(session.date).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }),
    'Duration (min)': session.duration_minutes,
    'Status': STATUS_LABELS[session.status],
    'Notes': session.notes || ''
  }));

  const totalMinutes = patientSessions.reduce((acc, curr) => acc + curr.duration_minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  // Summary row at the bottom
  data.push({
    'Date': 'TOTAL',
    'Time': '',
    'Duration (min)': totalMinutes,
    'Status': `${totalHours} hours`,
    'Notes': ''
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hours');

  XLSX.writeFile(workbook, `Report_${patient.name.replace(/\s+/g, '_')}.xlsx`);
}

export function generatePatientPDF(patient: Patient, sessions: Session[]) {
  const patientSessions = sessions.filter(s => s.patient_id === patient.id);

  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(124, 16, 52); // Bordeaux
  doc.text(`${APP_NAME} — Hours report for ${patient.name}`, 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Contact: ${patient.parent_contact}`, 14, 30);
  doc.text(`Generated on: ${new Date().toLocaleDateString(LOCALE)}`, 14, 36);

  const tableData = patientSessions.map(session => [
    new Date(session.date).toLocaleDateString(LOCALE),
    new Date(session.date).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }),
    `${session.duration_minutes} min`,
    STATUS_LABELS[session.status],
    session.notes || '-'
  ]);

  const totalMinutes = patientSessions.reduce((acc, curr) => acc + curr.duration_minutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  tableData.push([
    'TOTAL',
    '',
    `${totalMinutes} min (${totalHours} h)`,
    '',
    ''
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['Date', 'Time', 'Duration', 'Status', 'Notes']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [124, 16, 52] }, // Bordeaux header
    footStyles: { fillColor: [240, 240, 240], textColor: [0,0,0], fontStyle: 'bold' },
  });

  doc.save(`Report_${patient.name.replace(/\s+/g, '_')}.pdf`);
}
