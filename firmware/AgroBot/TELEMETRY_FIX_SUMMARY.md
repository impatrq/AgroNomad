# Telemetry Service Fix Summary

## Problem
The server was throwing the error: `"Could not process telemetry payload: Cannot read properties of undefined (reading 'broadcastAnimals')"` when receiving TCP telemetry data from the Raspberry Pi Zero.

## Root Cause
The `createAnimalsWebSocketServer` function in `animalsWebSocketServer.js` was not returning an object with a `broadcastAnimals` method. In `server.js`, the code was trying to call `animalsWebSocketServer.broadcastAnimals()`, but since the function returned `undefined`, it caused a runtime error.

## Changes Made

### 1. **animalsWebSocketServer.js** - Fixed return value
**Before:** Function didn't return anything (implicitly returned `undefined`)
**After:** Now returns an object with two methods:
- `broadcastAnimals()`: Broadcasts the current animal list to all connected WebSocket clients
- `close(callback)`: Properly closes the WebSocket server and cleans up intervals

**Key improvements:**
- Added proper error handling in the broadcast loop
- Fixed interval cleanup to prevent memory leaks
- Returns the required interface expected by the telemetry server

### 2. **telemetryParser.js** - Minor cleanup
**Before:** Had unnecessary comment at end of function
**After:** Cleaned up code formatting and comments

**How it works:**
- The `extractJsonPayloads()` function properly parses JSON objects from the TCP buffer
- Both Raspberry Pi and LoRa collar payloads are recognized and validated
- Valid payloads are stored in the database via `upsertAnimalSnapshot()`

## Payload Formats Supported

### Raspberry Pi Device
```json
{
  "ID": "RP",
  "FIRMWARE_VERS": "1.0",
  "HARDWARE_VERS": "1.0",
  "LAT": 0.000000,
  "LONG": 0.000000,
  "TEMP": "0.00"
}
```

### LoRa Collar
```json
{
  "ID": "COLLAR-122",
  "FIRMWARE_VERS": "1.0",
  "HARDWARE_VERS": "1.0",
  "LAT": -34.707652,
  "LONG": -58.242300,
  "TEMP": "4.70"
}
```

## Data Flow

1. **Firmware (main.c)** sends JSON payloads to TCP server (port 4001)
2. **Telemetry Server (telemetryServer.js)** receives data and buffers it
3. **Telemetry Parser (telemetryParser.js)** extracts and validates JSON payloads
4. **Database (upsertAnimalSnapshot)** stores the data:
   - Creates animal records if they don't exist
   - Creates device records with firmware/hardware versions
   - Inserts GPS position data with temperature readings
5. **WebSocket Server (animalsWebSocketServer.js)** broadcasts updates to connected clients

## Testing
✓ JavaScript syntax validation passed
✓ Payload normalization works for both RP and COLLAR formats
✓ JSON extraction handles single and multiple payloads
✓ Error handling properly logs issues without crashing

## Notes
- Both payload types have the required fields (ID, LAT, LONG, TEMP)
- The `upsertAnimalSnapshot` function handles field name variations automatically
- Temperature values are converted from strings to numbers for database storage
- Latitude/Longitude coordinates are stored as PostGIS POINT objects
