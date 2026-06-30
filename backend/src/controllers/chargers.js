import { z } from 'zod';
import { query } from '../config/db.js';

// Zod validation schemas
export const getChargersSchema = {
  query: z.object({
    lat: z.coerce.number({ required_error: 'Latitude is required' }).min(-90).max(90),
    lng: z.coerce.number({ required_error: 'Longitude is required' }).min(-180).max(180),
    radius: z.coerce.number().positive().optional(), // in kilometers
    limit: z.coerce.number().int().positive().default(20),
  }),
};

export const createChargerSchema = {
  body: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    connector_type: z.string().trim().min(1, 'Connector type is required'),
    price_per_kwh: z.number().nonnegative('Price per kWh must be a positive number'),
    peak_price_per_kwh: z.number().nonnegative().optional(),
    off_peak_price_per_kwh: z.number().nonnegative().optional(),
    peak_hours: z.array(z.number().int().min(0).max(23)).optional(),
    is_available: z.boolean().default(true),
  }),
};

export const updateChargerSchema = {
  params: z.object({
    id: z.string().uuid('Invalid charger ID format'),
  }),
  body: z.object({
    connector_type: z.string().trim().min(1).optional(),
    price_per_kwh: z.number().nonnegative().optional(),
    peak_price_per_kwh: z.number().nonnegative().optional(),
    off_peak_price_per_kwh: z.number().nonnegative().optional(),
    peak_hours: z.array(z.number().int().min(0).max(23)).optional(),
    is_available: z.boolean().optional(),
  }),
};

/**
 * Fetch available chargers near coordinates passed via query params
 */
export const getNearbyChargers = async (req, res, next) => {
  const { lat, lng, radius, limit } = req.query;

  try {
    let sql = `
      SELECT 
        id, 
        host_id, 
        location_coords[0] AS lng, 
        location_coords[1] AS lat, 
        connector_type, 
        price_per_kwh, 
        is_available,
        (location_coords <-> point($1, $2)) * 111.32 AS distance_km
      FROM chargers
      WHERE is_available = true
    `;

    const params = [lng, lat];

    // If radius (in km) is provided, filter by it
    if (radius !== undefined) {
      // 1 degree is approx 111.32 km. Calculate distance in degrees for pg comparison
      const radiusInDegrees = radius / 111.32;
      params.push(radiusInDegrees);
      sql += ` AND (location_coords <-> point($1, $2)) <= $3`;
    }

    // Add ordering and limit
    const limitPlaceholder = params.length + 1;
    params.push(limit);
    sql += ` ORDER BY location_coords <-> point($1, $2) LIMIT $${limitPlaceholder}`;

    const result = await query(sql, params);

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      chargers: result.rows,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Create a new charger (Host only)
 */
export const createCharger = async (req, res, next) => {
  const { lat, lng, connector_type, price_per_kwh, peak_price_per_kwh, off_peak_price_per_kwh, peak_hours, is_available } = req.body;
  const hostId = req.user.id; // From auth middleware

  try {
    const peakPrice = peak_price_per_kwh !== undefined ? peak_price_per_kwh : price_per_kwh;
    const offPeakPrice = off_peak_price_per_kwh !== undefined ? off_peak_price_per_kwh : price_per_kwh;
    const peakHoursArr = peak_hours || [];

    // Insert using point syntax: point(longitude, latitude) -> point(lng, lat)
    const result = await query(
      `INSERT INTO chargers (host_id, location_coords, connector_type, price_per_kwh, peak_price_per_kwh, off_peak_price_per_kwh, peak_hours, is_available) 
       VALUES ($1, point($2, $3), $4, $5, $6, $7, $8, $9) 
       RETURNING id, host_id, location_coords[0] AS lng, location_coords[1] AS lat, connector_type, price_per_kwh, peak_price_per_kwh, off_peak_price_per_kwh, peak_hours, is_available`,
      [hostId, lng, lat, connector_type, price_per_kwh, peakPrice, offPeakPrice, peakHoursArr, is_available]
    );

    return res.status(201).json({
      success: true,
      charger: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * Update an existing charger listing (Host/Admin only)
 */
export const updateCharger = async (req, res, next) => {
  const { id } = req.params;
  const hostId = req.user.id;
  const role = req.user.role;
  const { connector_type, price_per_kwh, peak_price_per_kwh, off_peak_price_per_kwh, peak_hours, is_available } = req.body;

  try {
    // 1. Fetch charger to check ownership
    const chargerCheck = await query('SELECT host_id FROM chargers WHERE id = $1', [id]);
    if (chargerCheck.rowCount === 0) {
      return res.status(404).json({
        success: false,
        error: 'Charger not found.',
      });
    }

    const charger = chargerCheck.rows[0];
    if (charger.host_id !== hostId && role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. You do not own this charger listing.',
      });
    }

    // 2. Dynamically build update query
    const updates = [];
    const params = [id];
    let paramIndex = 2;

    if (connector_type !== undefined) {
      updates.push(`connector_type = $${paramIndex++}`);
      params.push(connector_type);
    }
    if (price_per_kwh !== undefined) {
      updates.push(`price_per_kwh = $${paramIndex++}`);
      params.push(price_per_kwh);
    }
    if (peak_price_per_kwh !== undefined) {
      updates.push(`peak_price_per_kwh = $${paramIndex++}`);
      params.push(peak_price_per_kwh);
    }
    if (off_peak_price_per_kwh !== undefined) {
      updates.push(`off_peak_price_per_kwh = $${paramIndex++}`);
      params.push(off_peak_price_per_kwh);
    }
    if (peak_hours !== undefined) {
      updates.push(`peak_hours = $${paramIndex++}`);
      params.push(peak_hours);
    }
    if (is_available !== undefined) {
      updates.push(`is_available = $${paramIndex++}`);
      params.push(is_available);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields provided for update.',
      });
    }

    const sql = `
      UPDATE chargers 
      SET ${updates.join(', ')} 
      WHERE id = $1 
      RETURNING id, host_id, location_coords[0] AS lng, location_coords[1] AS lat, connector_type, price_per_kwh, peak_price_per_kwh, off_peak_price_per_kwh, peak_hours, is_available
    `;

    const result = await query(sql, params);

    return res.status(200).json({
      success: true,
      charger: result.rows[0],
    });
  } catch (error) {
    return next(error);
  }
};
