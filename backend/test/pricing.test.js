import { calculateBookingCost } from '../src/utils/pricing.js';

describe('Dynamic Pricing Calculator Utility', () => {
  const mockCharger = {
    peak_price_per_kwh: '0.60',
    off_peak_price_per_kwh: '0.30',
    peak_hours: [17, 18, 19, 20, 21], // 5 PM to 10 PM UTC
  };

  test('should bill all hours at off-peak rates when outside peak_hours', async () => {
    // 10:00 to 12:00 UTC (2 hours) at off-peak rate of 0.30/kWh. Total kWh = 10.
    // Expected cost = 10 kWh * 0.30 = 3.00
    const cost = await calculateBookingCost(mockCharger, '2026-07-10T10:00:00Z', '2026-07-10T12:00:00Z', 10);
    expect(cost).toBe(3.00);
  });

  test('should bill all hours at peak rates when entirely inside peak_hours', async () => {
    // 18:00 to 20:00 UTC (2 hours) at peak rate of 0.60/kWh. Total kWh = 10.
    // Expected cost = 10 kWh * 0.60 = 6.00
    const cost = await calculateBookingCost(mockCharger, '2026-07-10T18:00:00Z', '2026-07-10T20:00:00Z', 10);
    expect(cost).toBe(6.00);
  });

  test('should bill a blended rate when booking crosses boundaries', async () => {
    // 16:00 to 18:00 UTC (2 hours)
    // Hour 16:00 - 17:00 (1 hour): Off-peak (0.30)
    // Hour 17:00 - 18:00 (1 hour): Peak (0.60)
    // Total kWh = 10. Average kWh per hour = 5.
    // Expected cost = (5 kWh * 0.30) + (5 kWh * 0.60) = 1.50 + 3.00 = 4.50
    const cost = await calculateBookingCost(mockCharger, '2026-07-10T16:00:00Z', '2026-07-10T18:00:00Z', 10);
    expect(cost).toBe(4.50);
  });

  test('should handle fractional hours correctly', async () => {
    // 16:30 to 18:00 UTC (1.5 hours)
    // segment 1: 16:30 - 17:00 (0.5 hours) Off-peak (0.30)
    // segment 2: 17:00 - 18:00 (1.0 hour) Peak (0.60)
    // Total kWh = 15. Average kWh per hour = 15 / 1.5 = 10 kWh/hr.
    // Segment 1 (0.5 hr * 10 = 5 kWh): 5 * 0.30 = 1.50
    // Segment 2 (1.0 hr * 10 = 10 kWh): 10 * 0.60 = 6.00
    // Expected cost = 1.50 + 6.00 = 7.50
    const cost = await calculateBookingCost(mockCharger, '2026-07-10T16:30:00Z', '2026-07-10T18:00:00Z', 15);
    expect(cost).toBe(7.50);
  });

  test('should return 0 when start and end times are identical', async () => {
    const cost = await calculateBookingCost(mockCharger, '2026-07-10T12:00:00Z', '2026-07-10T12:00:00Z', 10);
    expect(cost).toBe(0);
  });
});
