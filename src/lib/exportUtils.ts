import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Patient, Session, STATUS_LABELS, isMissedSession } from '@/types/database';
import { formatHours, sumMinutes, workedMinutes } from '@/lib/caseload';
import { APP_NAME } from '@/lib/branding';
import { formatDate, formatTime } from '@/lib/dates';
import { reportFileName } from '@/lib/validation';

/** Hours worked (sessions that took place) and missed sessions, kept apart. */
export function summarise(sessions: Session[]) {
  const worked = workedMinutes(sessions);
  const missed = sessions.filter(isMissedSession);
  return {
    workedMinutes: worked,
    workedHours: formatHours(worked),
    missedCount: missed.length,
    missedMinutes: sumMinutes(missed),
  };
}

export function generatePatientExcel(patient: Patient, sessions: Session[]) {
  // Keep only the sessions that belong to this patient
  const patientSessions = sessions.filter(s => s.patient_id === patient.id);

  const data = patientSessions.map(session => ({
    'Date': formatDate(session.date),
    'Time': formatTime(session.date),
    'Duration (min)': session.duration_minutes,
    'Status': STATUS_LABELS[session.status],
    'Notes': session.notes || ''
  }));

  const summary = summarise(patientSessions);

  // Summary rows at the bottom: hours worked, then missed sessions
  data.push({
    'Date': 'HOURS WORKED',
    'Time': '',
    'Duration (min)': summary.workedMinutes,
    'Status': `${summary.workedHours} hours`,
    'Notes': ''
  });
  data.push({
    'Date': 'MISSED',
    'Time': '',
    'Duration (min)': summary.missedMinutes,
    'Status': `${summary.missedCount} sessions`,
    'Notes': 'Not counted in hours worked'
  });

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Hours');

  XLSX.writeFile(workbook, reportFileName(patient.name, 'xlsx'));
}

export function generatePatientPDF(patient: Patient, sessions: Session[]) {
  const patientSessions = sessions.filter(s => s.patient_id === patient.id);

  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.setTextColor(124, 16, 52); // Bordeaux
  doc.text(`${APP_NAME} — Hours report for ${patient.name}`, 14, 22);

  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  doc.text(`Contact: ${patient.parent_contact || '-'}`, 14, 30);
  doc.text(`Generated on: ${formatDate(new Date())}`, 14, 36);

  const tableData = patientSessions.map(session => [
    formatDate(session.date),
    formatTime(session.date),
    `${session.duration_minutes} min`,
    STATUS_LABELS[session.status],
    session.notes || '-'
  ]);

  const summary = summarise(patientSessions);

  tableData.push([
    'HOURS WORKED',
    '',
    `${summary.workedMinutes} min (${summary.workedHours} h)`,
    '',
    ''
  ]);
  tableData.push([
    'MISSED',
    '',
    `${summary.missedMinutes} min`,
    `${summary.missedCount} sessions`,
    'Not counted in hours worked'
  ]);

  autoTable(doc, {
    startY: 45,
    head: [['Date', 'Time', 'Duration', 'Status', 'Notes']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [124, 16, 52] }, // Bordeaux header
    footStyles: { fillColor: [240, 240, 240], textColor: [0,0,0], fontStyle: 'bold' },
  });

  doc.save(reportFileName(patient.name, 'pdf'));
}
