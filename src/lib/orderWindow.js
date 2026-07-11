// src/lib/orderWindow.js — guest ordering window logic (America/New_York).
// Used by the guest page (display) and /api/orders (enforcement).

export const DEFAULT_SCHEDULE = {
  dayOfWeek: 3, // 0=Sun ... 6=Sat, 3 = Wednesday
  startHour: 22, // 10 PM
  endHour: 0, // midnight (crosses midnight)
};

const NY_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
});

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Returns { dayOfWeek, hour } for `date` in New York time without the
// unreliable new Date(date.toLocaleString(...)) round-trip.
export function getNYTimeParts(date = new Date()) {
  const parts = NY_FORMATTER.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value;
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return { dayOfWeek: WEEKDAYS.indexOf(weekday), hour };
}

export function isWithinOrderingWindow(schedule, enabled, date = new Date()) {
  if (!enabled) return false;

  const { dayOfWeek, hour } = getNYTimeParts(date);
  const targetDay = schedule?.dayOfWeek ?? DEFAULT_SCHEDULE.dayOfWeek;
  const startHour = schedule?.startHour ?? DEFAULT_SCHEDULE.startHour;
  const endHour = schedule?.endHour ?? DEFAULT_SCHEDULE.endHour;

  if (dayOfWeek !== targetDay) return false;

  if (endHour > startHour) {
    // Simple same-day window, e.g. 10 -> 18
    return hour >= startHour && hour < endHour;
  }
  if (endHour < startHour) {
    // Crosses midnight, e.g. 22 -> 0 means 10 PM to midnight
    return hour >= startHour || hour < endHour;
  }
  // startHour === endHour -> open all day
  return true;
}

const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

function formatHour(hour) {
  if (hour === 0) return '12:00 AM';
  if (hour === 12) return '12:00 PM';
  return hour < 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`;
}

// Human-readable description of the window, e.g.
// "Wednesday from 10:00 PM to 12:00 AM (Eastern)"
export function describeOrderingWindow(schedule) {
  const day = DAY_NAMES[schedule?.dayOfWeek ?? DEFAULT_SCHEDULE.dayOfWeek];
  const start = formatHour(schedule?.startHour ?? DEFAULT_SCHEDULE.startHour);
  const end = formatHour(schedule?.endHour ?? DEFAULT_SCHEDULE.endHour);
  return `${day} from ${start} to ${end} (Eastern)`;
}
