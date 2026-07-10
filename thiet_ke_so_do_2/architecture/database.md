# Database Report

Database: `smart_farm_iot` (the name appears in environment/seed configuration; schemas are in `backend/src/models`). All collections have Mongoose `createdAt` and `updatedAt` timestamps.

## Collections

| Collection | Purpose and important fields |
|---|---|
| `users` | Operators: `fullName`, `email`, hidden `passwordHash`, `role`, `isActive`, `lastLoginAt`. |
| `farms` | Farm aggregate: `name`, unique `code`, `owner`, location/GeoJSON point, crop type, thresholds, current pump state, status. |
| `sensors` | A physical sensor: `farm`, `name`, type/unit, unique `deviceId`, MQTT topic, status, latest reading. |
| `sensor_logs` | Immutable sensor observations: `farm`, `sensor`, type/value/unit, source, capture time, optional weather/MQTT provenance. |
| `pump_logs` | Pump events: farm, action, trigger, mode, humidity/threshold, duration, event time, optional requester/source log. |
| `weather_logs` | Simulation weather effect applied to a farm: condition, deltas, resulting readings, simulated time. |
| `mqtt_logs` | Broker-message audit: optional farm/sensor, topic, direction, message type, arbitrary payload, QoS, retain flag, processing outcome. |

## Relationships

- `users` 1:N `farms` through `farms.owner`.
- `farms` 1:N `sensors`, `sensor_logs`, `pump_logs`, `weather_logs`, and `mqtt_logs`.
- `sensors` 1:N `sensor_logs` and optionally 1:N `mqtt_logs`.
- `sensor_logs` may reference the originating `weather_logs` and `mqtt_logs`; `pump_logs` may reference `users` and a related sensor log.

MongoDB references are application-level; Mongoose does not enforce referential integrity or cascade deletion. Repository reads populate selected references.

## Indexes

`users`: unique `email`; `{role, isActive}`. `farms`: unique `code`, `{owner,status}`, sparse `2dsphere` location index. `sensors`: unique `deviceId`, unique `{farm,type}`, `{farm,status}`. `sensor_logs`: `{farm,sensorType,capturedAt:-1}`, `{sensor,capturedAt:-1}`, `{capturedAt:-1}`. `pump_logs`: `{farm,occurredAt:-1}`, `{farm,action,occurredAt:-1}`, `{trigger,occurredAt:-1}`. `weather_logs`: `{farm,simulatedAt:-1}`, `{condition,simulatedAt:-1}`. `mqtt_logs`: `{topic,receivedAt:-1}`, `{farm,messageType,receivedAt:-1}`, `{processingStatus,receivedAt:1}`.

## Data flow

An MQTT payload should be recorded in `mqtt_logs`, normalized into `sensor_logs`, and reflected in the sensor’s `lastValue`/`lastReadingAt`. Irrigation decisions should update `farms.pump` and write `pump_logs`. Weather simulation writes `weather_logs` and can be linked from sensor observations. At present these ingestion/update transactions are not implemented; the schemas support the flow.
