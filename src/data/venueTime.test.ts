/**
 * THE VENUE'S CLOCK, NOT THE TABLET'S.
 *
 * A booking at 7:30 PM is 7:30 PM where the restaurant is. These pin the
 * conversions both ways, in zones either side of UTC, across a daylight-saving
 * change, and the calendar arithmetic that replaced "now + n × 24 h".
 */
import { afterEach, describe, expect, it } from 'vitest';

import { addDays, instant, setServerZone, slotsOf, venueDay, venueMidnight, venueStamp, venueTime, weekday } from './venueTime';

describe('the venue’s clock', () => {
  it('turns a wall time into the instant, and back, either side of UTC', () => {
    for (const zone of ['America/New_York', 'Europe/Lisbon', 'Asia/Kolkata', 'Pacific/Auckland']) {
      const at = venueStamp('2026-09-23', '19:30', zone);
      expect(venueDay(at, zone), zone).toBe('2026-09-23');
      expect(venueTime(at, zone), zone).toBe('19:30');
    }
    expect(new Date(venueStamp('2026-09-23', '19:30', 'Asia/Kolkata')).toISOString()).toBe('2026-09-23T14:00:00.000Z');
  });

  it('keeps 7:30 PM at 7:30 PM on the day the clocks change', () => {
    // New York falls back on 1 November 2026: that evening is UTC−5, the evening before UTC−4.
    expect(new Date(venueStamp('2026-11-01', '19:30', 'America/New_York')).toISOString()).toBe('2026-11-02T00:30:00.000Z');
    expect(new Date(venueStamp('2026-10-31', '19:30', 'America/New_York')).toISOString()).toBe('2026-10-31T23:30:00.000Z');
    expect(venueMidnight('2026-11-01', 'America/New_York')).toBe('2026-11-01T04:00:00.000Z');
  });

  it('counts days on the calendar, across a month and a year', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(weekday('2026-09-23')).toBe(3);
  });

  it('lists a day’s slots from opening to closing, both ends included', () => {
    expect(slotsOf('17:00', '21:00', 30)).toEqual(['17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00']);
    expect(slotsOf('12:00', '13:00', 45)).toEqual(['12:00', '12:45']);
  });
});

describe('a row’s timestamp', () => {
  afterEach(() => setServerZone(null));

  it('reads a bare wall time on the server’s clock once the till knows it', () => {
    setServerZone('Europe/Berlin');
    // 01:00 in Berlin (CEST) is 23:00 UTC the day before — 7 PM in New York.
    expect(new Date(instant('2026-09-25 01:00:00')).toISOString()).toBe('2026-09-24T23:00:00.000Z');
    expect(new Date(instant('2026-09-25 01:00:00.250')).toISOString()).toBe('2026-09-24T23:00:00.250Z');
    // An instant with its zone is what it says.
    expect(new Date(instant('2026-09-24T23:00:00.000Z')).toISOString()).toBe('2026-09-24T23:00:00.000Z');
  });
});
