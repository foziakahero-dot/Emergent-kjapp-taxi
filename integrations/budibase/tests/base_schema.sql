CREATE TYPE user_role AS ENUM ('PASSENGER', 'DRIVER', 'ADMIN');
CREATE TYPE approval_status AS ENUM ('pending', 'approved', 'rejected', 'suspended');
CREATE TYPE ride_status AS ENUM ('requested', 'accepted', 'arrived', 'in_progress', 'completed', 'cancelled');
CREATE TYPE vehicle_class AS ENUM ('SNAR', 'PREMIUM', 'SUV', 'XL');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE NOT NULL,
  role user_role NOT NULL DEFAULT 'PASSENGER',
  created_at TIMESTAMP DEFAULT NOW(),
  is_blocked BOOLEAN DEFAULT false
);

CREATE TABLE drivers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  license_number VARCHAR(50) NOT NULL,
  license_expiry DATE NOT NULL,
  taxi_license_number VARCHAR(50) NOT NULL,
  taxi_license_expiry DATE NOT NULL,
  profile_image_url TEXT,
  status approval_status NOT NULL DEFAULT 'pending',
  reject_reason TEXT,
  approved_at TIMESTAMP,
  approved_by_admin_id INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE vehicles (
  id SERIAL PRIMARY KEY,
  driver_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  license_plate VARCHAR(10) UNIQUE NOT NULL,
  model VARCHAR(100) NOT NULL,
  year SMALLINT NOT NULL,
  vehicle_class vehicle_class NOT NULL DEFAULT 'SNAR',
  insurance_expiry DATE NOT NULL,
  status approval_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE pricing_zones (
  id SERIAL PRIMARY KEY,
  vehicle_class vehicle_class UNIQUE NOT NULL,
  base_fare INTEGER NOT NULL,
  per_km INTEGER NOT NULL,
  per_minute INTEGER NOT NULL,
  minimum_fare INTEGER NOT NULL,
  night_surcharge INTEGER DEFAULT 0,
  rush_hour_surcharge INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true
);

CREATE TABLE rides (
  id SERIAL PRIMARY KEY,
  passenger_id INTEGER REFERENCES users(id),
  driver_id INTEGER REFERENCES users(id),
  pickup_address TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION,
  pickup_lng DOUBLE PRECISION,
  dropoff_address TEXT NOT NULL,
  dropoff_lat DOUBLE PRECISION,
  dropoff_lng DOUBLE PRECISION,
  estimated_distance_km INTEGER,
  estimated_duration_min INTEGER,
  estimated_price INTEGER,
  final_price INTEGER,
  status ride_status NOT NULL DEFAULT 'requested',
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_vehicles_status ON vehicles(status);
CREATE INDEX idx_rides_status ON rides(status);
