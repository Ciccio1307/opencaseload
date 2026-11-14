import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Patient, Session } from '@/types/database';

const m = vi.hoisted(() => ({ writeFile: vi.fn(), autoTable: vi.fn(), save: vi.fn(), text: vi.fn() }));

vi.mock('xlsx', async importOriginal => ({ ...(await importOriginal<object>()), writeFile: m.writeFile }));
vi.mock('jspdf-autotable', () => ({ default: m.autoTable }));
vi.mock('jspdf', () => ({
  default: class {
    setFontSize() {}
    setTextColor() {}
    text = m.text;
    save = m.save;
  },
}));

const XLSX = await import('xlsx');
const { generatePatientExcel, generatePatientPDF, summarise } = await import('@/lib/exportUtils');

const patient: Patient = { id: 'p1', name: 'Ada Rossi', parent_contact: '', created_at: '' };
const session = (id: string, status: Session['status'], minutes: number, patient_id = 'p1'): Session => ({
  id,
  patient_id,
  date: '2026-11-07T23:30:00Z', // 8 Nov, 00:30 in Rome
  duration_minutes: minutes,
  status,
});

const sessions = [
  session('a', 'completed', 60),
  session('b', 'completed', 45),
  session('c', 'absent', 60),
  session('d', 'recovered', 30),
  session('e', 'scheduled', 60),
  session('f', 'completed', 120, 'someone-else'),
];

beforeEach(() => vi.clearAllMocks());

describe('summarise', () => {
  it('keeps worked and missed time apart and ignores scheduled sessions', () => {
    expect(summarise(sessions.slice(0, 5))).toEqual({
      workedMinutes: 105,
      workedHours: '1.8',
      missedCount: 2,
      missedMinutes: 90,
    });
  });

  it('handles no sessions', () => {
    expect(summarise([])).toEqual({ workedMinutes: 0, workedHours: '0.0', missedCount: 0, missedMinutes: 0 });
  });
});

describe('generatePatientExcel', () => {
  it("writes only this patient's sessions plus the two summary rows", () => {
    generatePatientExcel(patient, sessions);
    const [workbook, fileName] = m.writeFile.mock.calls[0];
    expect(fileName).toBe('Report_Ada_Rossi.xlsx');
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets.Hours);
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ Date: '08/11/2026', Time: '00:30', Status: 'Completed' });
    expect(rows[5]).toMatchObject({ Date: 'HOURS WORKED', 'Duration (min)': 105, Status: '1.8 hours' });
    expect(rows[6]).toMatchObject({ Date: 'MISSED', 'Duration (min)': 90, Status: '2 sessions' });
  });
});

describe('spreadsheet formula injection', () => {
  it('writes notes such as "=HYPERLINK(...)" as plain text, never as formulas', () => {
    const evil = { ...session('z', 'completed', 60), notes: '=HYPERLINK("http://evil.invalid","x")' };
    generatePatientExcel(patient, [evil, { ...evil, id: 'y', notes: '@SUM(1+1)' }, { ...evil, id: 'w', notes: '+1-1' }]);
    const sheet = m.writeFile.mock.calls[0][0].Sheets.Hours;
    const noteCells = ['E2', 'E3', 'E4'].map(ref => sheet[ref]);
    for (const cell of noteCells) {
      expect(cell.t).toBe('s');
      expect(cell.f).toBeUndefined();
    }
  });
});

describe('generatePatientPDF', () => {
  it('builds the table and saves under a safe file name', () => {
    generatePatientPDF({ ...patient, name: 'Niccolò / Test' }, sessions);
    const body: string[][] = m.autoTable.mock.calls[0][1].body;
    expect(body).toHaveLength(7);
    expect(body[0]).toEqual(['08/11/2026', '00:30', '60 min', 'Completed', '-']);
    expect(body[5]).toEqual(['HOURS WORKED', '', '105 min (1.8 h)', '', '']);
    expect(body[6]).toEqual(['MISSED', '', '90 min', '2 sessions', 'Not counted in hours worked']);
    expect(m.save).toHaveBeenCalledWith('Report_Niccolo_Test.pdf');
  });

  it('prints a dash when the contact is missing', () => {
    generatePatientPDF(patient, []);
    expect(m.text).toHaveBeenCalledWith('Contact: -', 14, 30);
  });
});
