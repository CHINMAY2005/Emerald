import { z } from 'zod';
import { query } from '../config/db.js';

export const hostEarningsSchema = {
  query: z.object({
    host_id: z.string().uuid('Invalid host ID format').optional(),
  }),
};

/**
 * Aggregate total revenue metrics grouped by month for a specific host_id
 */
export const getHostEarnings = async (req, res, next) => {
  const { host_id } = req.query;
  const callerId = req.user.id;
  const callerRole = req.user.role;

  // Determine the target host_id
  const targetHostId = host_id || callerId;

  // Security check: Hosts can only view their own earnings. Admins can view anyone's earnings.
  if (targetHostId !== callerId && callerRole !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'Access denied. You can only view your own earnings details.',
    });
  }

  try {
    // 1. Fetch monthly breakdown
    const monthlyQuery = `
      SELECT 
        TO_CHAR(b.end_time, 'YYYY-MM') AS month,
        ROUND(SUM(b.total_price)::numeric, 2) AS total_revenue,
        COUNT(b.id)::int AS total_bookings,
        ROUND(SUM(b.total_kwh)::numeric, 2) AS total_kwh_delivered
      FROM bookings b
      JOIN chargers c ON b.charger_id = c.id
      WHERE c.host_id = $1 
        AND b.status IN ('confirmed', 'completed')
      GROUP BY TO_CHAR(b.end_time, 'YYYY-MM')
      ORDER BY month DESC;
    `;

    const monthlyResult = await query(monthlyQuery, [targetHostId]);

    // 2. Fetch lifetime aggregates for this host
    const aggregateQuery = `
      SELECT 
        COALESCE(ROUND(SUM(b.total_price)::numeric, 2), 0) AS lifetime_revenue,
        COUNT(b.id)::int AS lifetime_bookings,
        COALESCE(ROUND(SUM(b.total_kwh)::numeric, 2), 0) AS lifetime_kwh_delivered
      FROM bookings b
      JOIN chargers c ON b.charger_id = c.id
      WHERE c.host_id = $1 
        AND b.status IN ('confirmed', 'completed');
    `;

    const aggregateResult = await query(aggregateQuery, [targetHostId]);
    const summary = aggregateResult.rows[0];

    return res.status(200).json({
      success: true,
      host_id: targetHostId,
      summary: {
        lifetime_revenue: Number(summary.lifetime_revenue),
        lifetime_bookings: Number(summary.lifetime_bookings),
        lifetime_kwh_delivered: Number(summary.lifetime_kwh_delivered),
      },
      monthly_breakdown: monthlyResult.rows.map(row => ({
        month: row.month,
        total_revenue: Number(row.total_revenue),
        total_bookings: Number(row.total_bookings),
        total_kwh_delivered: Number(row.total_kwh_delivered),
      })),
    });
  } catch (error) {
    return next(error);
  }
};
