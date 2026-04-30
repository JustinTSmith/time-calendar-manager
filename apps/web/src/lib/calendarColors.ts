export const CALENDAR_COLORS = [
  '#4285f4',
  '#0f9d58',
  '#db4437',
  '#f4b400',
  '#673ab7',
  '#3f51b5',
  '#00bcd4',
  '#009688',
  '#ff5722',
  '#795548',
  '#9e9e9e',
  '#607d8b',
] as const;

export type CalendarColor = (typeof CALENDAR_COLORS)[number];
