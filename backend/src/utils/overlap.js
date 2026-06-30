/**
 * Checks if a requested booking slot overlaps with any active/confirmed bookings.
 * Two intervals [s1, e1] and [s2, e2] overlap if:
 * s1 < e2 AND e1 > s2
 * 
 * @param {Array} existingBookings - Array of existing bookings.
 * @param {string|Date} startTime - The requested start time.
 * @param {string|Date} endTime - The requested end time.
 * @returns {object|null} The first overlapping booking object if a conflict exists, or null.
 */
export function findOverlappingBooking(existingBookings, startTime, endTime) {
  const newStart = new Date(startTime).getTime();
  const newEnd = new Date(endTime).getTime();

  for (const booking of existingBookings) {
    const existStart = new Date(booking.start_time).getTime();
    const existEnd = new Date(booking.end_time).getTime();

    if (newStart < existEnd && newEnd > existStart) {
      return booking;
    }
  }

  return null;
}
