/**
 * The venue's clock: days and times in the venue's own time zone.
 *
 * A booking is made for "Friday at 7:30 PM where the restaurant is", whatever
 * zone the tablet or the guest happens to be in. So every day list, slot and
 * "today" the till draws is worked out here, in the venue's zone (the tenant
 * zone Adminium hands over; the device's own when there is none, as in the
 * demo).
 *
 * Days are calendar arithmetic on `YYYY-MM-DD`, never "now + n × 24 h", which
 * drifts by an hour across a daylight-saving change.
 */

/** `YYYY-MM-DD` of an instant, on the venue's calendar. */
export function venueDay(ms: number, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** `HH:MM` (24-hour) of an instant, on the venue's clock. */
export function venueTime(ms: number, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(ms);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return `${get('hour')}:${get('minute')}`;
}

/** The calendar day `n` days after `day`. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const next = new Date(Date.UTC(y, m - 1, d + n));
  return next.toISOString().slice(0, 10);
}

/** Minutes the zone is ahead of UTC at an instant. */
function offsetAt(ms: number, timeZone?: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(ms);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

/** The instant a venue-local wall time happens: `day` at `time` (`HH:MM`). */
export function venueStamp(day: string, time: string, timeZone?: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const [hh, mm] = time.split(':').map(Number) as [number, number];
  const wall = Date.UTC(y, m - 1, d, hh, mm);
  // Guess with the offset at the wall time read as UTC, then correct once with the offset there.
  const first = wall - offsetAt(wall, timeZone) * 60_000;
  return wall - offsetAt(first, timeZone) * 60_000;
}

/** The instant a venue-local day starts, as an ISO string. */
export function venueMidnight(day: string, timeZone?: string): string {
  return new Date(venueStamp(day, '00:00', timeZone)).toISOString();
}

/** Day of the week (0 = Sunday) of a calendar day. */
export function weekday(day: string): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/**
 * The booking slots of a day: every `slotMinutes` from `opens` to `closes`,
 * both ends included when they fall on a slot (the comp's 5:00 … 9:00 PM).
 */
export function slotsOf(opens: string, closes: string, slotMinutes: number): string[] {
  const minutes = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number) as [number, number];
    return h * 60 + m;
  };
  const out: string[] = [];
  const step = Math.max(5, slotMinutes || 30);
  for (let at = minutes(opens); at <= minutes(closes); at += step) {
    out.push(`${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`);
  }
  return out;
}

/**
 * The zone Adminium's server keeps its clock in. A SQLite source has no zone:
 * a timestamp comes back as the server's wall time (`2026-09-25 01:00:00`),
 * and a till in another zone that read it as its own was hours out. Set at
 * boot from the staff config's `serverTimezone`; unset, a wall time is read
 * on this device's clock, as before.
 */
let serverZone: string | null = null;
export function setServerZone(zone: string | null): void {
  serverZone = zone;
}

/**
 * The calendar day a DATE column's value names. A driver that reads a date
 * as the server's midnight sends that instant (`2026-07-27T22:00:00.000Z` for
 * the 28th in Berlin), so it is read back on the server's calendar.
 */
export function dateOf(value: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? venueDay(ms, serverZone ?? "UTC") : null;
}

const WALL = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,3})\d*)?)?$/;

/** The instant a row's timestamp denotes: an ISO instant as it is, a bare wall time on the server's clock. */
export function instant(value: string): number {
  const m = WALL.exec(value);
  if (m === null || serverZone === null) return Date.parse(value);
  return venueStamp(m[1]!, m[2]!, serverZone) + Number(m[3] ?? 0) * 1000 + Number((m[4] ?? '0').padEnd(3, '0'));
}
