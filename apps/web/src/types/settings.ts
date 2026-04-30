export type DaySchedule = {
  enabled: boolean;
  start: string; // HH:MM
  end: string;   // HH:MM
};

export type WorkingHours = {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
};

export type UserSettings = {
  id: string;
  name: string;
  email: string;
  timezone: string;
  weekStartsOn: 'sunday' | 'monday';
  defaultEventDuration: 30 | 60;
  timeFormat: '12h' | '24h';
  workingHours: WorkingHours;
};

export type CalendarAccount = {
  id: string;
  provider: 'google' | 'microsoft' | 'apple';
  email: string;
  status: 'active' | 'error' | 'disconnected';
};

export const DEFAULT_WORKING_HOURS: WorkingHours = {
  monday:    { enabled: true,  start: '09:00', end: '17:00' },
  tuesday:   { enabled: true,  start: '09:00', end: '17:00' },
  wednesday: { enabled: true,  start: '09:00', end: '17:00' },
  thursday:  { enabled: true,  start: '09:00', end: '17:00' },
  friday:    { enabled: true,  start: '09:00', end: '17:00' },
  saturday:  { enabled: false, start: '09:00', end: '17:00' },
  sunday:    { enabled: false, start: '09:00', end: '17:00' },
};
