import test from 'node:test';
import assert from 'node:assert';
import app from '../src/app.js';
import pool from '../src/config/db.js';

const PORT = 3099;
let server;

// Mock database state
const dbState = {
  users: [],
  chargers: [
    {
      id: 'c1111111-1111-1111-1111-111111111111',
      host_id: 'f1111111-1111-1111-1111-111111111111',
      location_coords: { x: -122.4194, y: 37.7749 }, // San Francisco (longitude, latitude)
      connector_type: 'CCS2',
      price_per_kwh: '0.45',
      peak_price_per_kwh: '0.60',
      off_peak_price_per_kwh: '0.45',
      peak_hours: [17, 18, 19, 20, 21],
      is_available: true,
    },
    {
      id: 'c2222222-2222-2222-2222-222222222222',
      host_id: 'f1111111-1111-1111-1111-111111111111',
      location_coords: { x: -122.4089, y: 37.7882 }, // Closer SF location
      connector_type: 'CHAdeMO',
      price_per_kwh: '0.40',
      peak_price_per_kwh: '0.50',
      off_peak_price_per_kwh: '0.40',
      peak_hours: [17, 18, 19, 20, 21],
      is_available: true,
    },
    {
      id: 'c3333333-3333-3333-3333-333333333333',
      host_id: 'h2222222-2222-2222-2222-222222222222',
      location_coords: { x: -74.0060, y: 40.7128 }, // New York
      connector_type: 'Type 2',
      price_per_kwh: '0.50',
      peak_price_per_kwh: '0.60',
      off_peak_price_per_kwh: '0.50',
      peak_hours: [17, 18, 19, 20, 21],
      is_available: false, // Not available
    }
  ],
  bookings: [
    {
      id: 'b1111111-1111-1111-1111-111111111111',
      driver_id: 'd1111111-1111-1111-1111-111111111111',
      charger_id: 'c1111111-1111-1111-1111-111111111111',
      start_time: new Date('2026-06-15T10:00:00Z'),
      end_time: new Date('2026-06-15T12:00:00Z'),
      total_kwh: '30.00',
      total_price: '13.50', // 30 * 0.45
      status: 'completed',
    },
    {
      id: 'b2222222-2222-2222-2222-222222222222',
      driver_id: 'd1111111-1111-1111-1111-111111111111',
      charger_id: 'c1111111-1111-1111-1111-111111111111',
      start_time: new Date('2026-06-20T14:00:00Z'),
      end_time: new Date('2026-06-20T16:00:00Z'),
      total_kwh: '40.00',
      total_price: '18.00', // 40 * 0.45
      status: 'confirmed',
    }
  ]
};

// Intercept DB connection checks and query routing
pool.query = async (text, params) => {
  const normalizedText = text.trim().replace(/\s+/g, ' ');

  // 1. Connection Validation Test
  if (normalizedText.includes('SELECT NOW()')) {
    return { rows: [{ now: new Date() }], rowCount: 1 };
  }

  // 2. Auth: Check existing user email
  if (normalizedText.includes('SELECT 1 FROM users WHERE email = $1')) {
    const exists = dbState.users.some(u => u.email === params[0]);
    return { rows: exists ? [{ '1': 1 }] : [], rowCount: exists ? 1 : 0 };
  }

  // 3. Auth: Find user by email
  if (normalizedText.includes('SELECT id, name, email, password_hash, role FROM users WHERE email = $1')) {
    const user = dbState.users.find(u => u.email === params[0]);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }

  // 4. Auth: Register user
  if (normalizedText.includes('INSERT INTO users')) {
    const isHost = params[1] === 'host@emerald.network';
    const newUser = {
      id: isHost ? 'f1111111-1111-1111-1111-111111111111' : `u${Math.random().toString(36).substr(2, 9)}`,
      name: params[0],
      email: params[1],
      password_hash: params[2],
      role: params[3],
    };
    dbState.users.push(newUser);
    return { rows: [newUser], rowCount: 1 };
  }

  // 5. Chargers: Proximity search
  if (normalizedText.includes('SELECT id, host_id, location_coords[0]') && normalizedText.includes('location_coords <-> point')) {
    const [targetLng, targetLat] = params;
    const limit = params[params.length - 1];
    
    // Sort mock chargers by distance (simple euclidean distance)
    const sorted = dbState.chargers
      .filter(c => c.is_available)
      .map(c => {
        const dx = c.location_coords.x - targetLng;
        const dy = c.location_coords.y - targetLat;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return {
          id: c.id,
          host_id: c.host_id,
          lng: c.location_coords.x,
          lat: c.location_coords.y,
          connector_type: c.connector_type,
          price_per_kwh: c.price_per_kwh,
          is_available: c.is_available,
          distance_km: dist * 111.32,
        };
      })
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, limit);

    return { rows: sorted, rowCount: sorted.length };
  }

  // 6. Host Earnings Aggregate query
  if (normalizedText.includes('lifetime_revenue') && normalizedText.includes('WHERE c.host_id = $1')) {
    const hostId = params[0];
    const hostBookings = dbState.bookings.filter(b => {
      const charger = dbState.chargers.find(c => c.id === b.charger_id);
      return charger && charger.host_id === hostId && ['confirmed', 'completed'].includes(b.status);
    });

    const lifetime_revenue = hostBookings.reduce((sum, b) => sum + parseFloat(b.total_price), 0);
    const lifetime_kwh_delivered = hostBookings.reduce((sum, b) => sum + parseFloat(b.total_kwh), 0);

    return {
      rows: [{
        lifetime_revenue: lifetime_revenue.toString(),
        lifetime_bookings: hostBookings.length,
        lifetime_kwh_delivered: lifetime_kwh_delivered.toString()
      }],
      rowCount: 1
    };
  }

  // 7. Host Earnings Monthly Breakdown
  if (normalizedText.includes('TO_CHAR(b.end_time, \'YYYY-MM\') AS month') && normalizedText.includes('WHERE c.host_id = $1')) {
    const hostId = params[0];
    const hostBookings = dbState.bookings.filter(b => {
      const charger = dbState.chargers.find(c => c.id === b.charger_id);
      return charger && charger.host_id === hostId && ['confirmed', 'completed'].includes(b.status);
    });

    const monthlyMap = {};
    for (const b of hostBookings) {
      const date = new Date(b.end_time);
      const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[month]) {
        monthlyMap[month] = { month, total_revenue: 0, total_bookings: 0, total_kwh_delivered: 0 };
      }
      monthlyMap[month].total_revenue += parseFloat(b.total_price);
      monthlyMap[month].total_bookings += 1;
      monthlyMap[month].total_kwh_delivered += parseFloat(b.total_kwh);
    }

    const monthlyBreakdown = Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month));
    return { rows: monthlyBreakdown, rowCount: monthlyBreakdown.length };
  }

  throw new Error(`Unhandled mock query: ${normalizedText}`);
};

// Mock Connection Client for Transactions (Booking endpoint)
const mockClient = {
  query: async (text, params) => {
    const normalizedText = text.trim().replace(/\s+/g, ' ');

    if (normalizedText === 'BEGIN' || normalizedText === 'COMMIT' || normalizedText === 'ROLLBACK') {
      return { rowCount: 0, rows: [] };
    }

    // Lock and retrieve charger
    if (normalizedText.includes('SELECT peak_price_per_kwh, off_peak_price_per_kwh, peak_hours, is_available FROM chargers WHERE id = $1 FOR UPDATE')) {
      const charger = dbState.chargers.find(c => c.id === params[0]);
      return { rows: charger ? [charger] : [], rowCount: charger ? 1 : 0 };
    }

    // Get confirmed bookings for charger
    if (normalizedText.includes('SELECT id, start_time, end_time FROM bookings') && normalizedText.includes("status = 'confirmed'")) {
      const chargerId = params[0];
      const matches = dbState.bookings.filter(b => b.charger_id === chargerId && b.status === 'confirmed');
      return { rows: matches, rowCount: matches.length };
    }

    // Insert booking
    if (normalizedText.includes('INSERT INTO bookings')) {
      const [driver_id, charger_id, start_time, end_time, total_kwh, total_price] = params;
      const newBooking = {
        id: `b${Math.random().toString(36).substr(2, 9)}`,
        driver_id,
        charger_id,
        start_time: new Date(start_time),
        end_time: new Date(end_time),
        total_kwh: total_kwh.toString(),
        total_price: total_price.toString(),
        status: 'confirmed',
      };
      dbState.bookings.push(newBooking);
      return { rows: [newBooking], rowCount: 1 };
    }

    throw new Error(`Unhandled mock client query: ${normalizedText}`);
  },
  release: () => {}
};

pool.connect = async () => mockClient;

// Start Server and setup Hooks
test.before(() => {
  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`🧪 Test Server running on port ${PORT}`);
      resolve();
    });
  });
});

test.after(() => {
  return new Promise((resolve) => {
    server.close(() => {
      console.log('🧪 Test Server closed');
      resolve();
    });
  });
});

// Helper for making requests
const request = async (path, options = {}) => {
  const adjustedPath = path.startsWith('/api/') ? path.replace('/api/', '/api/v1/emerald/') : path;
  const url = `http://localhost:${PORT}${adjustedPath}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await response.json();
  return { status: response.status, body: data };
};

// TEST SUITE
test('Emerald Backend Verification', async (t) => {

  let driverToken = '';
  let hostToken = '';
  const testHostId = 'f1111111-1111-1111-1111-111111111111';

  await t.test('1. Auth Routes - Register & Login Validations', async () => {
    // A. Register Validation (Fail - Invalid email)
    const badReg = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'John Doe',
        email: 'invalid-email',
        password: 'password123',
        role: 'driver'
      })
    });
    assert.strictEqual(badReg.status, 400);
    assert.strictEqual(badReg.body.success, false);
    assert.strictEqual(badReg.body.error, 'Validation failed');
    assert.strictEqual(badReg.body.details[0].field, 'email');

    // B. Register Validation (Fail - Invalid role)
    const badRoleReg = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'password123',
        role: 'admin' // role must be driver or host
      })
    });
    assert.strictEqual(badRoleReg.status, 400);
    assert.strictEqual(badRoleReg.body.details[0].field, 'role');

    // C. Register Success (Driver)
    const regDriver = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Driver Joe',
        email: 'driver@emerald.network',
        password: 'secure_password_123',
        role: 'driver'
      })
    });
    assert.strictEqual(regDriver.status, 201);
    assert.strictEqual(regDriver.body.success, true);
    assert.ok(regDriver.body.token);
    driverToken = regDriver.body.token;

    // D. Register Success (Host)
    const regHost = await request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Host Harry',
        email: 'host@emerald.network',
        password: 'secure_password_123',
        role: 'host'
      })
    });
    assert.strictEqual(regHost.status, 201);
    assert.ok(regHost.body.token);
    hostToken = regHost.body.token;

    // E. Login Success
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: 'driver@emerald.network',
        password: 'secure_password_123'
      })
    });
    assert.strictEqual(loginRes.status, 200);
    assert.strictEqual(loginRes.body.success, true);
    assert.strictEqual(loginRes.body.user.email, 'driver@emerald.network');
  });

  await t.test('2. Chargers Routes - Proximity Query', async () => {
    // A. Missing Coordinates validation
    const missingCoords = await request('/api/chargers');
    assert.strictEqual(missingCoords.status, 400);

    // B. Search Chargers near SF (should return SF chargers sorted by proximity, excluding NY because it is unavailable)
    const searchRes = await request('/api/chargers?lat=37.7749&lng=-122.4194&limit=5');
    assert.strictEqual(searchRes.status, 200);
    assert.strictEqual(searchRes.body.success, true);
    assert.strictEqual(searchRes.body.count, 2);
    // c1111111 should be closer (0km distance) than c2222222
    assert.strictEqual(searchRes.body.chargers[0].id, 'c1111111-1111-1111-1111-111111111111');
    assert.strictEqual(searchRes.body.chargers[1].id, 'c2222222-2222-2222-2222-222222222222');
  });

  await t.test('3. Bookings Routes - Overlap Validations & Transactions', async () => {
    const chargerId = 'c1111111-1111-1111-1111-111111111111';

    // A. Unauthenticated booking attempt (Fail)
    const unauthBooking = await request('/api/bookings', {
      method: 'POST',
      body: JSON.stringify({
        charger_id: chargerId,
        start_time: '2026-07-10T12:00:00Z',
        end_time: '2026-07-10T14:00:00Z',
        total_kwh: 25.5
      })
    });
    assert.strictEqual(unauthBooking.status, 401);

    // B. Successful booking
    const bookingRes = await request('/api/bookings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${driverToken}` },
      body: JSON.stringify({
        charger_id: chargerId,
        start_time: '2026-07-10T12:00:00Z',
        end_time: '2026-07-10T14:00:00Z',
        total_kwh: 20
      })
    });
    assert.strictEqual(bookingRes.status, 201);
    assert.strictEqual(bookingRes.body.success, true);
    // price calculation validation: 20 kwh * 0.45 = 9.00
    assert.strictEqual(Number(bookingRes.body.booking.total_price), 9);

    // C. Overlapping booking attempt (Fail with 409 Conflict)
    const overlapRes = await request('/api/bookings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${driverToken}` },
      body: JSON.stringify({
        charger_id: chargerId,
        start_time: '2026-07-10T13:00:00Z', // overlaps original 12:00-14:00
        end_time: '2026-07-10T15:00:00Z',
        total_kwh: 30
      })
    });
    assert.strictEqual(overlapRes.status, 409);
    assert.strictEqual(overlapRes.body.error, 'Time slot conflict: The charger is already booked during this period.');
  });

  await t.test('4. Host Earnings Metrics aggregation', async () => {
    // A. Host role restriction (Fail as Driver)
    const errDriver = await request(`/api/hosts/earnings?host_id=${testHostId}`, {
      headers: { 'Authorization': `Bearer ${driverToken}` }
    });
    assert.strictEqual(errDriver.status, 403);
    assert.strictEqual(errDriver.body.error, 'Forbidden. You do not have permission to access this resource.');

    // B. Correct Host Request (Success)
    const earningsRes = await request(`/api/hosts/earnings?host_id=${testHostId}`, {
      headers: { 'Authorization': `Bearer ${hostToken}` }
    });
    assert.strictEqual(earningsRes.status, 200);
    assert.strictEqual(earningsRes.body.success, true);
    
    // Validate values:
    // Completed Booking (June): 13.50 revenue, 30 kwh
    // Confirmed Booking (June): 18.00 revenue, 40 kwh
    // New Confirmed Booking (July): 9.00 revenue, 20 kwh
    // Total revenue = 40.50, bookings = 3, kwh = 90.00
    assert.strictEqual(earningsRes.body.summary.lifetime_revenue, 40.50);
    assert.strictEqual(earningsRes.body.summary.lifetime_bookings, 3);
    assert.strictEqual(earningsRes.body.summary.lifetime_kwh_delivered, 90.00);

    // Validate monthly grouping format (ordered descending: July, then June)
    assert.strictEqual(earningsRes.body.monthly_breakdown.length, 2);
    assert.strictEqual(earningsRes.body.monthly_breakdown[0].month, '2026-07');
    assert.strictEqual(earningsRes.body.monthly_breakdown[0].total_revenue, 9.00);
    assert.strictEqual(earningsRes.body.monthly_breakdown[1].month, '2026-06');
    assert.strictEqual(earningsRes.body.monthly_breakdown[1].total_revenue, 31.50);
  });

  await t.test('5. Static Assets & SPA Fallback routing', async () => {
    // A. Request root index.html (SPA Entrypoint)
    const rootRes = await fetch(`http://localhost:${PORT}/`);
    assert.strictEqual(rootRes.status, 200);
    const htmlText = await rootRes.text();
    assert.ok(htmlText.includes('Welcome to Emerald Network'));

    // B. Request a nested client route (SPA Fallback)
    const spaRes = await fetch(`http://localhost:${PORT}/dashboard/settings`);
    assert.strictEqual(spaRes.status, 200);
    const spaHtmlText = await spaRes.text();
    assert.ok(spaHtmlText.includes('Welcome to Emerald Network'));

    // C. Request a non-existent API route (JSON 404 response instead of fallback index.html)
    const nonExistentApi = await request('/api/nonexistent-endpoint-xyz');
    assert.strictEqual(nonExistentApi.status, 404);
    assert.strictEqual(nonExistentApi.body.success, false);
    assert.strictEqual(nonExistentApi.body.error, 'API Route not found: GET /api/v1/emerald/nonexistent-endpoint-xyz');
  });
});
