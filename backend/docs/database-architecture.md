# Smart Agriculture IoT Database Architecture

This backend uses Node.js, Express, MongoDB, and Mongoose. It intentionally contains no API routes yet; the current scope is database architecture only.

## Folder Structure

```text
backend/
  .env.example
  package.json
  docs/
    database-architecture.md
  src/
    config/
      database.js
    models/
      Farm.js
      MqttLog.js
      PumpLog.js
      Sensor.js
      SensorLog.js
      User.js
      WeatherLog.js
      index.js
    seeders/
      sampleData.js
      seedDatabase.js
    server.js
```

## Collections

### users

Stores dashboard accounts. Users own farms and can later be used for authentication, authorization, and manual pump actions.

Important fields:

- `fullName`
- `email`
- `passwordHash`
- `role`: `admin`, `operator`, or `viewer`
- `isActive`
- `lastLoginAt`

Indexes:

- Unique `email`
- `role + isActive`

### farms

Stores the three farms and their current operational configuration. This collection keeps the current pump state and automation thresholds so the dashboard can read current status without scanning historical logs.

Important fields:

- `name`
- `code`
- `location`
- `cropType`
- `owner -> users`
- `thresholds.humidityMin`, default `50`
- `thresholds.pumpRunMinutes`, default `30`
- `pump.status`
- `pump.mode`
- `pump.startedAt`
- `pump.scheduledStopAt`
- `status`

Indexes:

- Unique `code`
- `owner + status`
- Geospatial `location.geo`

### sensors

Stores physical or simulated sensor devices. Each farm has one temperature sensor, one humidity sensor, and one soil pH sensor.

Important fields:

- `farm -> farms`
- `type`: `temperature`, `humidity`, or `soil_ph`
- `unit`: `celsius`, `percent`, or `ph`
- `deviceId`
- `mqttTopic`
- `status`
- `lastValue`
- `lastReadingAt`

Indexes:

- Unique `deviceId`
- Unique `farm + type`
- `farm + status`
- `lastReadingAt`

### sensor_logs

Append-only time-series style collection for every sensor value. This satisfies the rule that every sensor value must be stored.

Important fields:

- `farm -> farms`
- `sensor -> sensors`
- `sensorType`
- `value`
- `unit`
- `source`: `simulator`, `mqtt`, or `manual`
- `capturedAt`
- `metadata.weatherLog -> weather_logs`
- `metadata.mqttLog -> mqtt_logs`

Indexes:

- `farm + sensorType + capturedAt desc`
- `sensor + capturedAt desc`
- `capturedAt desc`

### pump_logs

Append-only collection for every pump action. This satisfies the rule that every pump action must be stored.

Business rule representation:

- When humidity is below `50`, insert `turned_on` with trigger `auto_humidity_low`.
- After 30 minutes, insert `turned_off` with trigger `auto_duration_complete`.
- The `farms.pump` object stores current state for quick dashboard reads.

Important fields:

- `farm -> farms`
- `action`: `turned_on` or `turned_off`
- `trigger`
- `mode`: `auto` or `manual`
- `humidityValue`
- `threshold`
- `runDurationMinutes`
- `startedAt`
- `stoppedAt`
- `occurredAt`
- `requestedBy -> users`
- `relatedSensorLog -> sensor_logs`

Indexes:

- `farm + occurredAt desc`
- `farm + action + occurredAt desc`
- `trigger + occurredAt desc`

### weather_logs

Stores simulated weather changes that affect temperature and humidity. Keeping this separate makes it possible to explain why sensor readings changed.

Important fields:

- `farm -> farms`
- `condition`
- `temperatureDelta`
- `humidityDelta`
- `temperatureAfter`
- `humidityAfter`
- `simulatedAt`

Indexes:

- `farm + simulatedAt desc`
- `condition + simulatedAt desc`

### mqtt_logs

Stores raw MQTT messages once MQTT integration is added. It can hold incoming sensor readings, outgoing pump commands, and device status messages.

Important fields:

- `farm -> farms`
- `sensor -> sensors`
- `topic`
- `direction`: `incoming` or `outgoing`
- `messageType`
- `payload`
- `qos`
- `retained`
- `receivedAt`
- `processedAt`
- `processingStatus`
- `errorMessage`

Indexes:

- `topic + receivedAt desc`
- `farm + messageType + receivedAt desc`
- `processingStatus + receivedAt`

## Relationships

```text
users 1 -> many farms
farms 1 -> many sensors
farms 1 -> many sensor_logs
sensors 1 -> many sensor_logs
farms 1 -> many pump_logs
sensor_logs 1 -> many pump_logs
farms 1 -> many weather_logs
weather_logs 1 -> many sensor_logs
farms 1 -> many mqtt_logs
sensors 1 -> many mqtt_logs
mqtt_logs 1 -> many sensor_logs
```

## Seed Data

The seeder creates:

- 2 users
- 3 farms
- 9 sensors, 3 per farm
- Initial sensor logs for temperature, humidity, and soil pH
- Weather logs that change temperature and humidity
- Pump logs for the low-humidity farm, including automatic ON and OFF after 30 minutes
- Placeholder MQTT logs for future broker integration

Run:

```bash
cd backend
cp .env.example .env
npm install
npm run seed
```

Clear data:

```bash
npm run seed:clear
```
