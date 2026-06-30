-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('driver', 'host', 'admin')),
    stripe_connect_id VARCHAR(255) UNIQUE,
    stripe_onboarding_complete BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Chargers Table
CREATE TABLE IF NOT EXISTS chargers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    location_coords POINT NOT NULL,
    connector_type VARCHAR(100) NOT NULL,
    price_per_kwh NUMERIC(10, 2) NOT NULL CHECK (price_per_kwh >= 0),
    peak_price_per_kwh NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (peak_price_per_kwh >= 0),
    off_peak_price_per_kwh NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (off_peak_price_per_kwh >= 0),
    peak_hours INTEGER[] NOT NULL DEFAULT '{}',
    is_available BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bookings Table
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    charger_id UUID REFERENCES chargers(id) ON DELETE CASCADE NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    total_kwh NUMERIC(10, 2) NOT NULL CHECK (total_kwh > 0),
    total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'paid')),
    stripe_payment_intent_id VARCHAR(255) UNIQUE,
    application_fee_amount INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_booking_times CHECK (start_time < end_time)
);

-- Create Indexes for performance and constraints
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_chargers_host ON chargers(host_id);
CREATE INDEX IF NOT EXISTS idx_bookings_charger_time ON bookings(charger_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_bookings_driver ON bookings(driver_id);

-- Optional GiST spatial index for proximity sorting on point location_coords
-- GiST support on point is built-in to PostgreSQL.
CREATE INDEX IF NOT EXISTS idx_chargers_location ON chargers USING GIST (location_coords);
