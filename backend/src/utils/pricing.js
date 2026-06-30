import { query } from '../config/db.js';

/**
 * Calculates the total booking cost using dynamic peak/off-peak pricing.
 * Iterates hour-by-hour through the booking duration, calculating the kWh consumed
 * per segment and billing it at peak or off-peak rates.
 * 
 * @param {string|object} chargerOrId - The charger UUID string or the pre-fetched charger object.
 * @param {string|Date} startTime - The start time of the booking.
 * @param {string|Date} endTime - The end time of the booking.
 * @param {number} [totalKwh=1] - The total energy planned to be consumed.
 * @returns {Promise<number>} The calculated total price, rounded to 2 decimal places.
 */
export async function calculateBookingCost(chargerOrId, startTime, endTime, totalKwh = 1) {
  let charger = chargerOrId;
  
  if (typeof chargerOrId === 'string') {
    const res = await query(
      'SELECT peak_price_per_kwh, off_peak_price_per_kwh, peak_hours FROM chargers WHERE id = $1',
      [chargerOrId]
    );
    if (res.rowCount === 0) {
      throw new Error('Charger not found');
    }
    charger = res.rows[0];
  }

  const start = new Date(startTime);
  const end = new Date(endTime);
  const durationMs = end.getTime() - start.getTime();

  if (durationMs <= 0) {
    return 0;
  }

  const durationHours = durationMs / (3600 * 1000);
  const kwhPerHour = totalKwh / durationHours;

  let totalCost = 0;
  let current = new Date(start);

  while (current < end) {
    // Find the boundary of the next UTC hour
    const nextHour = new Date(current);
    nextHour.setUTCHours(current.getUTCHours() + 1, 0, 0, 0);

    const segmentEnd = nextHour < end ? nextHour : end;
    const segmentHours = (segmentEnd.getTime() - current.getTime()) / (3600 * 1000);

    const currentHour = current.getUTCHours();
    const peakHoursArray = Array.isArray(charger.peak_hours) ? charger.peak_hours : [];
    const isPeak = peakHoursArray.includes(currentHour);
    const rate = isPeak ? Number(charger.peak_price_per_kwh) : Number(charger.off_peak_price_per_kwh);

    totalCost += segmentHours * kwhPerHour * rate;
    current = segmentEnd;
  }

  return Number(totalCost.toFixed(2));
}
