export type SessionStatus = 'scheduled' | 'completed' | 'absent' | 'to_recover' | 'recovered';

export const STATUS_LABELS: Record<SessionStatus, string> = {
  scheduled: 'Scheduled',
  completed: 'Completed',
  absent: 'Absent',
  to_recover: 'To recover',
  recovered: 'Recovered',
};

export interface Patient {
  id: string;
  name: string;
  parent_contact: string;
  notes?: string;
  created_at: string;
}

export interface Session {
  id: string;
  patient_id: string;
  date: string; // ISO date string
  duration_minutes: number;
  status: SessionStatus;
  notes?: string;
}

export interface Availability {
  id: string;
  day_of_week: number; // 0 (Sunday) to 6 (Saturday)
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
}
