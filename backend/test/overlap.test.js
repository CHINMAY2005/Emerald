import { findOverlappingBooking } from '../src/utils/overlap.js';

describe('Booking Overlap Checker Utility', () => {
  const existingBookings = [
    {
      id: 'b1',
      start_time: '2026-07-10T12:00:00Z',
      end_time: '2026-07-10T14:00:00Z',
    },
    {
      id: 'b2',
      start_time: '2026-07-10T16:00:00Z',
      end_time: '2026-07-10T18:00:00Z',
    }
  ];

  test('should return null when there are no bookings', () => {
    const conflict = findOverlappingBooking([], '2026-07-10T12:00:00Z', '2026-07-10T14:00:00Z');
    expect(conflict).toBeNull();
  });

  test('should return null when booking is completely before existing bookings', () => {
    const conflict = findOverlappingBooking(existingBookings, '2026-07-10T10:00:00Z', '2026-07-10T11:59:59Z');
    expect(conflict).toBeNull();
  });

  test('should return null when booking is completely after existing bookings', () => {
    const conflict = findOverlappingBooking(existingBookings, '2026-07-10T18:00:01Z', '2026-07-10T20:00:00Z');
    expect(conflict).toBeNull();
  });

  test('should return null when booking ends exactly when another starts', () => {
    const conflict = findOverlappingBooking(existingBookings, '2026-07-10T14:00:00Z', '2026-07-10T16:00:00Z');
    expect(conflict).toBeNull();
  });

  test('should detect overlap when start time falls inside an existing booking', () => {
    const conflict = findOverlappingBooking(existingBookings, '2026-07-10T13:30:00Z', '2026-07-10T15:00:00Z');
    expect(conflict).not.toBeNull();
    expect(conflict.id).toBe('b1');
  });

  test('should detect overlap when end time falls inside an existing booking', () => {
    const conflict = findOverlappingBooking(existingBookings, '2026-07-10T11:00:00Z', '2026-07-10T12:30:00Z');
    expect(conflict).not.toBeNull();
    expect(conflict.id).toBe('b1');
  });

  test('should detect overlap when new booking is completely within an existing booking', () => {
    const conflict = findOverlappingBooking(existingBookings, '2026-07-10T12:15:00Z', '2026-07-10T13:45:00Z');
    expect(conflict).not.toBeNull();
    expect(conflict.id).toBe('b1');
  });

  test('should detect overlap when new booking completely encloses an existing booking', () => {
    const conflict = findOverlappingBooking(existingBookings, '2026-07-10T11:00:00Z', '2026-07-10T15:00:00Z');
    expect(conflict).not.toBeNull();
    expect(conflict.id).toBe('b1');
  });
});
