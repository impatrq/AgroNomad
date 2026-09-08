CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS yards (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  boundary GEOMETRY(POLYGON, 4326),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS animals (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  yard_id INTEGER REFERENCES yards(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  animal_type TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  active BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS devices (
  id SERIAL PRIMARY KEY,
  device_uid TEXT NOT NULL UNIQUE,
  hardware_version TEXT,
  firmware_version TEXT,
  last_battery_level INTEGER,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS animal_devices (
  animal_id INTEGER NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  device_id INTEGER NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  unassigned_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (animal_id, device_id)
);

CREATE TABLE IF NOT EXISTS gps_positions (
  id SERIAL PRIMARY KEY,
  animal_id INTEGER NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  device_id INTEGER REFERENCES devices(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  location GEOGRAPHY(POINT, 4326),
  temperature DOUBLE PRECISION,
  heartbeat INTEGER,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION
);

CREATE TABLE IF NOT EXISTS animal_daily_statistics (
  id SERIAL PRIMARY KEY,
  animal_id INTEGER NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  distance_travelled DOUBLE PRECISION DEFAULT 0,
  movement_time DOUBLE PRECISION DEFAULT 0,
  sleep_time DOUBLE PRECISION DEFAULT 0
);




-- =====================================================
-- GPS POSITION INDEXES
-- =====================================================

-- Find all positions of an animal quickly
CREATE INDEX IF NOT EXISTS idx_gps_animal
ON gps_positions(animal_id);

-- Find positions by date/time quickly
CREATE INDEX IF NOT EXISTS idx_gps_timestamp
ON gps_positions(timestamp);

-- Most common query:
-- animal history ordered by time
CREATE INDEX IF NOT EXISTS idx_gps_animal_timestamp
ON gps_positions(animal_id, timestamp DESC);

-- PostGIS spatial index
CREATE INDEX IF NOT EXISTS idx_gps_location
ON gps_positions
USING GIST(location);





-- =====================================================
-- YARD INDEXES
-- =====================================================

-- Accelerates geofence checks
CREATE INDEX IF NOT EXISTS idx_yards_boundary
ON yards
USING GIST(boundary);

-- Acelerate the search of yards per user_id(NOT ADDED YET TO DB).
CREATE INDEX IF NOT EXISTS idx_yards_user_id
ON yards(user_id);




-- =====================================================
-- ANIMAL INDEXES
-- =====================================================

-- Quickly find all animals in a yard
CREATE INDEX IF NOT EXISTS idx_animals_yard
ON animals(yard_id);

-- Quickly find all animals belonging to a user
CREATE INDEX IF NOT EXISTS idx_animals_user
ON animals(user_id);







-- =====================================================
-- DAILY STATISTICS INDEXES
-- =====================================================

-- Fast lookup of daily stats
CREATE INDEX IF NOT EXISTS idx_daily_stats_animal_date
ON animal_daily_statistics(animal_id, date DESC);






-- =====================================================
-- DEVICE INDEXES
-- =====================================================

-- Find all assignments of a device
CREATE INDEX IF NOT EXISTS idx_animal_devices_device
ON animal_devices(device_id);