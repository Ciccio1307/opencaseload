import { describe, expect, it } from 'vitest';
import { STATUS_LABELS, isMissedSession, isWorkedSession, type SessionStatus } from '@/types/database';

const ALL = Object.keys(STATUS_LABELS) as SessionStatus[];

describe('session status helpers', () => {
  it('count only completed sessions as worked', () => {
    expect(ALL.filter(status => isWorkedSession({ status }))).toEqual(['completed']);
  });

  it('count absent, to-recover and recovered sessions as missed', () => {
    expect(ALL.filter(status => isMissedSession({ status }))).toEqual(['absent', 'to_recover', 'recovered']);
  });

  it('never count a session as both worked and missed, and leave scheduled ones out', () => {
    for (const status of ALL) {
      expect(isWorkedSession({ status }) && isMissedSession({ status })).toBe(false);
    }
    expect(isWorkedSession({ status: 'scheduled' }) || isMissedSession({ status: 'scheduled' })).toBe(false);
  });
});
