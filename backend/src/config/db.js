import pg from 'pg';
import dotenv from 'dotenv';

// Ensure env variables are loaded if db.js is imported directly (e.g. in scripts)
dotenv.config();

const { Pool } = pg;

const poolConfig = {
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'voltshare_secure_pass_123',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'emerald_db',
  // Production pool limits & timeouts
  max: 20, // Max clients in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// Disable SSL in local development unless configured otherwise
if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL_SSL === 'true') {
  poolConfig.ssl = {
    rejectUnauthorized: false
  };
}

const pool = new Pool(poolConfig);

let useMemoryDB = false;

// Register pool error listener immediately to prevent uncaught exception crashes
pool.on('error', (err) => {
  if (!useMemoryDB) {
    console.error('⚡ PostgreSQL Pool: Unexpected error on idle client', err);
  }
});

// In-Memory Database State (Pre-populated for instant mapping exploration)
const memoryDB = {
  users: [],
  chargers: [
    {
      id: 'c1111111-1111-1111-1111-111111111111',
      host_id: 'host_dummy_id_1',
      lng: -118.25,
      lat: 34.05,
      connector_type: 'CCS Combo 1 (Level 3 Supercharger)',
      price_per_kwh: 0.45,
      peak_price_per_kwh: 0.60,
      off_peak_price_per_kwh: 0.40,
      peak_hours: [17, 18, 19, 20, 21],
      is_available: true
    },
    {
      id: 'c2222222-2222-2222-2222-222222222222',
      host_id: 'host_dummy_id_1',
      lng: -118.23,
      lat: 34.06,
      connector_type: 'Level 2 Wallbox (J1772)',
      price_per_kwh: 0.30,
      peak_price_per_kwh: 0.40,
      off_peak_price_per_kwh: 0.25,
      peak_hours: [12, 13, 17, 18, 19],
      is_available: true
    },
    {
      id: 'c3333333-3333-3333-3333-333333333333',
      host_id: 'host_dummy_id_2',
      lng: -118.26,
      lat: 34.04,
      connector_type: 'Tesla Supercharger V3 (Type 2)',
      price_per_kwh: 0.50,
      peak_price_per_kwh: 0.70,
      off_peak_price_per_kwh: 0.45,
      peak_hours: [17, 18, 19, 20, 21],
      is_available: true
    }
  ],
  bookings: []
};

// Override pool.query and pool.connect BEFORE connecting to prevent recursion issues and handle fallbacks
const originalQuery = pool.query.bind(pool);
pool.query = async (text, params) => {
  if (useMemoryDB) {
    return handleMockQuery(text, params);
  }
  try {
    return await originalQuery(text, params);
  } catch (err) {
    if (err.message.includes('connect') || err.message.includes('connection') || err.message.includes('ECONNREFUSED')) {
      console.log('⚡ pool.query: Database connection lost. Falling back to in-memory database.');
      useMemoryDB = true;
      return handleMockQuery(text, params);
    }
    throw err;
  }
};

const originalConnect = pool.connect.bind(pool);
const mockConnection = {
  query: async (text, params) => {
    return handleMockQuery(text, params);
  },
  release: () => {}
};

pool.connect = async () => {
  if (useMemoryDB) {
    return mockConnection;
  }
  try {
    return await originalConnect();
  } catch (err) {
    console.log('⚡ pool.connect: Database connection failed. Falling back to in-memory database.');
    useMemoryDB = true;
    return mockConnection;
  }
};

export const query = async (text, params) => {
  return pool.query(text, params);
};

// Attempt database connection check on startup
try {
  const client = await originalConnect();
  client.release();
  console.log('⚡ pool: PostgreSQL connected successfully.');
} catch (e) {
  console.log('⚡ pool: Database connection failed on startup. Using in-memory fallback.');
  useMemoryDB = true;
}

// In-Memory query engine parsing main statements used in routes
function handleMockQuery(text, params) {
  const normalizedText = text.trim().replace(/\s+/g, ' ');

  // 1. Connection Validation Test
  if (normalizedText.includes('SELECT NOW()')) {
    return { rows: [{ now: new Date() }], rowCount: 1 };
  }

  // User checking & retrieval
  if (normalizedText.includes('SELECT 1 FROM users WHERE email = $1')) {
    const email = params[0];
    const exists = memoryDB.users.some(u => u.email === email);
    return { rows: exists ? [{ '1': 1 }] : [], rowCount: exists ? 1 : 0 };
  }

  if (normalizedText.includes('SELECT id, name, email, password_hash, role FROM users WHERE email = $1')) {
    const email = params[0];
    const user = memoryDB.users.find(u => u.email === email);
    return { rows: user ? [user] : [], rowCount: user ? 1 : 0 };
  }

  if (normalizedText.includes('INSERT INTO users')) {
    const [name, email, passwordHash, role] = params;
    const user = {
      id: 'u_' + Math.random().toString(36).substring(2, 11),
      name,
      email,
      password_hash: passwordHash,
      role,
      stripe_connect_id: null,
      stripe_onboarding_complete: false,
      created_at: new Date()
    };
    memoryDB.users.push(user);
    return { rows: [user], rowCount: 1 };
  }

  if (normalizedText.includes('SELECT stripe_connect_id, stripe_onboarding_complete FROM users WHERE id = $1')) {
    const id = params[0];
    const user = memoryDB.users.find(u => u.id === id);
    if (!user) return { rows: [], rowCount: 0 };
    return { 
      rows: [{ 
        stripe_connect_id: user.stripe_connect_id, 
        stripe_onboarding_complete: user.stripe_onboarding_complete 
      }], 
      rowCount: 1 
    };
  }

  if (normalizedText.includes('UPDATE users SET stripe_connect_id = $1, stripe_onboarding_complete = false WHERE id = $2')) {
    const [stripeId, id] = params;
    const user = memoryDB.users.find(u => u.id === id);
    if (user) {
      user.stripe_connect_id = stripeId;
      user.stripe_onboarding_complete = false;
    }
    return { rows: [user], rowCount: user ? 1 : 0 };
  }

  if (normalizedText.includes('UPDATE users SET stripe_onboarding_complete = true WHERE id = $1')) {
    const id = params[0];
    const user = memoryDB.users.find(u => u.id === id);
    if (user) {
      user.stripe_onboarding_complete = true;
    }
    return { rows: [user], rowCount: user ? 1 : 0 };
  }

  if (normalizedText.includes('SELECT stripe_connect_id FROM users WHERE id = $1')) {
    const id = params[0];
    const user = memoryDB.users.find(u => u.id === id);
    if (!user) return { rows: [], rowCount: 0 };
    return { rows: [{ stripe_connect_id: user.stripe_connect_id }], rowCount: 1 };
  }

  // Chargers
  if (normalizedText.includes('SELECT id, host_id, location_coords[0]') && normalizedText.includes('distance_km')) {
    const [lng, lat, radius, limit] = params;
    
    // Proximity logic
    let list = memoryDB.chargers
      .filter(c => c.is_available)
      .map(c => {
        const dx = c.lng - lng;
        const dy = c.lat - lat;
        const dist = Math.sqrt(dx * dx + dy * dy) * 111.32;
        return {
          ...c,
          distance_km: dist
        };
      });

    if (radius !== undefined) {
      list = list.filter(c => c.distance_km <= radius);
    }

    list.sort((a, b) => a.distance_km - b.distance_km);
    
    const countLimit = limit || 20;
    const sliced = list.slice(0, countLimit);

    return { rows: sliced, rowCount: sliced.length };
  }

  if (normalizedText.includes('INSERT INTO chargers')) {
    const [host_id, lng, lat, connector_type, price_per_kwh, peak_price_per_kwh, off_peak_price_per_kwh, peak_hours, is_available] = params;
    const charger = {
      id: 'c_' + Math.random().toString(36).substring(2, 11),
      host_id,
      lng,
      lat,
      connector_type,
      price_per_kwh,
      peak_price_per_kwh: peak_price_per_kwh || price_per_kwh,
      off_peak_price_per_kwh: off_peak_price_per_kwh || price_per_kwh,
      peak_hours: peak_hours || [],
      is_available: is_available !== undefined ? is_available : true,
      created_at: new Date()
    };
    memoryDB.chargers.push(charger);
    return { rows: [charger], rowCount: 1 };
  }

  if (normalizedText.includes('SELECT peak_price_per_kwh, off_peak_price_per_kwh, peak_hours, is_available FROM chargers WHERE id = $1')) {
    const id = params[0];
    const charger = memoryDB.chargers.find(c => c.id === id);
    if (!charger) return { rows: [], rowCount: 0 };
    return { rows: [charger], rowCount: 1 };
  }

  if (normalizedText.includes('SELECT peak_price_per_kwh, off_peak_price_per_kwh, peak_hours FROM chargers WHERE id = $1')) {
    const id = params[0];
    const charger = memoryDB.chargers.find(c => c.id === id);
    if (!charger) return { rows: [], rowCount: 0 };
    return { rows: [charger], rowCount: 1 };
  }

  if (normalizedText.includes('SELECT host_id FROM chargers WHERE id = $1')) {
    const id = params[0];
    const charger = memoryDB.chargers.find(c => c.id === id);
    if (!charger) return { rows: [], rowCount: 0 };
    return { rows: [charger], rowCount: 1 };
  }

  if (normalizedText.includes('UPDATE chargers')) {
    const id = params[0];
    const charger = memoryDB.chargers.find(c => c.id === id);
    if (!charger) return { rows: [], rowCount: 0 };
    
    if (normalizedText.includes('is_available = $2')) {
      charger.is_available = params[1];
    }
    return { rows: [charger], rowCount: 1 };
  }

  // Bookings
  if (normalizedText.includes('SELECT id, start_time, end_time FROM bookings WHERE charger_id = $1 AND status = \'confirmed\'')) {
    const chargerId = params[0];
    const bookings = memoryDB.bookings.filter(b => b.charger_id === chargerId && b.status === 'confirmed');
    return { rows: bookings, rowCount: bookings.length };
  }

  if (normalizedText.includes('INSERT INTO bookings')) {
    const [driver_id, charger_id, start_time, end_time, total_kwh, total_price, status] = params;
    const booking = {
      id: 'b_' + Math.random().toString(36).substring(2, 11),
      driver_id,
      charger_id,
      start_time: new Date(start_time),
      end_time: new Date(end_time),
      total_kwh,
      total_price,
      status: status || 'confirmed',
      stripe_payment_intent_id: null,
      application_fee_amount: null,
      created_at: new Date()
    };
    memoryDB.bookings.push(booking);
    return { rows: [booking], rowCount: 1 };
  }

  if (normalizedText.includes('SELECT id, driver_id, total_kwh, total_price, status, stripe_payment_intent_id FROM bookings WHERE id = $1')) {
    const id = params[0];
    const booking = memoryDB.bookings.find(b => b.id === id);
    if (!booking) return { rows: [], rowCount: 0 };
    return { rows: [booking], rowCount: 1 };
  }

  if (normalizedText.includes('UPDATE bookings SET stripe_payment_intent_id = $1, application_fee_amount = $2 WHERE id = $3')) {
    const [intentId, fee, id] = params;
    const booking = memoryDB.bookings.find(b => b.id === id);
    if (booking) {
      booking.stripe_payment_intent_id = intentId;
      booking.application_fee_amount = fee;
    }
    return { rows: [booking], rowCount: booking ? 1 : 0 };
  }

  if (normalizedText.includes('UPDATE bookings SET status = \'paid\' WHERE id = $1')) {
    const id = params[0];
    const booking = memoryDB.bookings.find(b => b.id === id);
    if (booking) {
      booking.status = 'paid';
    }
    return { rows: [booking], rowCount: booking ? 1 : 0 };
  }

  if (normalizedText.includes('UPDATE bookings SET status = \'paid\' WHERE stripe_payment_intent_id = $1')) {
    const intentId = params[0];
    const booking = memoryDB.bookings.find(b => b.stripe_payment_intent_id === intentId);
    if (booking) {
      booking.status = 'paid';
    }
    return { rows: [booking], rowCount: booking ? 1 : 0 };
  }

  if (normalizedText.includes('UPDATE bookings SET status = \'completed\', total_kwh = $1, total_price = $2 WHERE id = $3')) {
    const [kwh, price, id] = params;
    const booking = memoryDB.bookings.find(b => b.id === id);
    if (booking) {
      booking.status = 'completed';
      booking.total_kwh = kwh;
      booking.total_price = price;
    }
    return { rows: [booking], rowCount: booking ? 1 : 0 };
  }

  if (normalizedText.includes('SELECT * FROM bookings WHERE driver_id = $1 ORDER BY start_time DESC')) {
    const driverId = params[0];
    const bookings = memoryDB.bookings
      .filter(b => b.driver_id === driverId)
      .sort((a, b) => b.start_time - a.start_time);
    return { rows: bookings, rowCount: bookings.length };
  }

  if (normalizedText.includes('SELECT b.* FROM bookings b JOIN chargers c ON b.charger_id = c.id WHERE c.host_id = $1 ORDER BY b.start_time DESC')) {
    const hostId = params[0];
    const hostChargers = memoryDB.chargers.filter(c => c.host_id === hostId).map(c => c.id);
    const bookings = memoryDB.bookings
      .filter(b => hostChargers.includes(b.charger_id))
      .sort((a, b) => b.start_time - a.start_time);
    return { rows: bookings, rowCount: bookings.length };
  }

  // Host Earnings
  if (normalizedText.includes('TO_CHAR(b.end_time, \'YYYY-MM\') AS month') && normalizedText.includes('WHERE c.host_id = $1')) {
    const hostId = params[0];
    const hostChargers = memoryDB.chargers.filter(c => c.host_id === hostId).map(c => c.id);
    const bookings = memoryDB.bookings.filter(b => hostChargers.includes(b.charger_id) && ['confirmed', 'completed', 'paid'].includes(b.status));
    
    const groups = {};
    bookings.forEach(b => {
      const month = new Date(b.end_time).toISOString().slice(0, 7); // YYYY-MM
      if (!groups[month]) {
        groups[month] = { month, total_revenue: 0, total_bookings: 0, total_kwh_delivered: 0 };
      }
      groups[month].total_revenue += Number(b.total_price);
      groups[month].total_bookings += 1;
      groups[month].total_kwh_delivered += Number(b.total_kwh);
    });

    const rows = Object.values(groups).sort((a, b) => b.month.localeCompare(a.month));
    return { rows, rowCount: rows.length };
  }

  if (normalizedText.includes('lifetime_revenue') && normalizedText.includes('WHERE c.host_id = $1')) {
    const hostId = params[0];
    const hostChargers = memoryDB.chargers.filter(c => c.host_id === hostId).map(c => c.id);
    const bookings = memoryDB.bookings.filter(b => hostChargers.includes(b.charger_id) && ['confirmed', 'completed', 'paid'].includes(b.status));
    
    let rev = 0, bookingsCount = 0, kwh = 0;
    bookings.forEach(b => {
      rev += Number(b.total_price);
      bookingsCount += 1;
      kwh += Number(b.total_kwh);
    });

    return { 
      rows: [{
        lifetime_revenue: rev,
        lifetime_bookings: bookingsCount,
        lifetime_kwh_delivered: kwh
      }], 
      rowCount: 1 
    };
  }

  // Transactions BEGIN/COMMIT/ROLLBACK
  if (normalizedText === 'BEGIN' || normalizedText === 'COMMIT' || normalizedText === 'ROLLBACK') {
    return { rows: [], rowCount: 0 };
  }

  console.log('⚠️ pool mock: unhandled query fallback', normalizedText);
  return { rows: [], rowCount: 0 };
}

export default pool;
