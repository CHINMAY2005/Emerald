import { z } from 'zod';
import pool, { query } from '../config/db.js';
import { calculateBookingCost } from '../utils/pricing.js';
import { findOverlappingBooking } from '../utils/overlap.js';

// Zod schema for creating a booking
export const createBookingSchema = {
  body: z
    .object({
      charger_id: z.string().uuid('Invalid charger ID format'),
      start_time: z
        .string()
        .datetime({ message: 'Start time must be a valid ISO datetime' })
        .refine((val) => new Date(val) > new Date(), {
          message: 'Start time must be in the future',
        }),
      end_time: z.string().datetime({ message: 'End time must be a valid ISO datetime' }),
      total_kwh: z.number().positive('Total kWh must be a positive number'),
    })
    .refine((data) => new Date(data.start_time) < new Date(data.end_time), {
      message: 'End time must be after start time',
      path: ['end_time'],
    }),
};

/**
 * Create a new booking slot (checking for overlaps in a transaction)
 */
export const createBooking = async (req, res, next) => {
  const { charger_id, start_time, end_time, total_kwh } = req.body;
  const driverId = req.user.id; // From auth middleware

  const client = await pool.connect();

  try {
    // Start Transaction
    await client.query('BEGIN');

    // 1. Fetch and Lock charger using SELECT FOR UPDATE to prevent concurrency issues
    const chargerResult = await client.query(
      `SELECT peak_price_per_kwh, off_peak_price_per_kwh, peak_hours, is_available 
       FROM chargers WHERE id = $1 FOR UPDATE`,
      [charger_id]
    );

    if (chargerResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        error: 'Charger not found.',
      });
    }

    const charger = chargerResult.rows[0];

    if (!charger.is_available) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        error: 'This charger is currently not available for bookings.',
      });
    }

    // 2. Fetch existing confirmed bookings to validate overlaps
    const bookingsResult = await client.query(
      `SELECT id, start_time, end_time FROM bookings 
       WHERE charger_id = $1 AND status = 'confirmed'`,
      [charger_id]
    );

    // Check for overlapping bookings
    const conflict = findOverlappingBooking(bookingsResult.rows, start_time, end_time);
    if (conflict) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: 'Time slot conflict: The charger is already booked during this period.',
        conflict: {
          booking_id: conflict.id,
          start_time: conflict.start_time,
          end_time: conflict.end_time,
        },
      });
    }

    // 3. Calculate total price using dynamic hourly pricing calculator
    const totalPrice = await calculateBookingCost(charger, start_time, end_time, total_kwh);

    // 4. Insert booking
    const insertResult = await client.query(
      `INSERT INTO bookings (driver_id, charger_id, start_time, end_time, total_kwh, total_price, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
       RETURNING id, driver_id, charger_id, start_time, end_time, total_kwh, total_price, status`,
      [driverId, charger_id, start_time, end_time, total_kwh, totalPrice]
    );

    // Commit Transaction
    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      booking: insertResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
};

/**
 * Fetch bookings for the logged-in user
 */
export const getMyBookings = async (req, res, next) => {
  const userId = req.user.id;
  const role = req.user.role;

  try {
    let result;
    if (role === 'driver') {
      result = await query(
        'SELECT * FROM bookings WHERE driver_id = $1 ORDER BY start_time DESC',
        [userId]
      );
    } else {
      // For hosts, fetch bookings related to their chargers
      result = await query(
        `SELECT b.* FROM bookings b
         JOIN chargers c ON b.charger_id = c.id
         WHERE c.host_id = $1
         ORDER BY b.start_time DESC`,
        [userId]
      );
    }

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      bookings: result.rows,
    });
  } catch (error) {
    return next(error);
  }
};
