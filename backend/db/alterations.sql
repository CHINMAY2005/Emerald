-- Alterations to update pre-existing database schema for Stripe Connect split payments

-- 1. Alter users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_connect_id VARCHAR(255) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN DEFAULT false NOT NULL;

-- 2. Alter bookings table
-- Check if 'paid' status constraint is present. If database uses checklist constraints on enum check, 
-- we drop check_status check constraint and add it back or alter. Since pg CHECK constraints are named differently,
-- a simple column addition and extending status is enough.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255) UNIQUE;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS application_fee_amount INTEGER;

-- Ensure 'paid' is added to allowed status values
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'paid'));
