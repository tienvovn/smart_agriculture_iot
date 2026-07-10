# Backend Review

## Findings

### High priority

1. **No authentication or authorization.** All CRUD routes, including `/api/users`, are public. Roles are stored but never enforced. Add authentication plus resource-level RBAC before deployment.
2. **Password handling is unsafe by contract.** `userRoutes` accepts `passwordHash` directly and `UserService` delegates creation/update to the repository; this permits a caller to choose arbitrary stored hashes and exposes a password-hash-oriented API. Accept a password only in an authenticated registration flow, hash it server-side with bcrypt, and ensure list/get responses never reveal it.
3. **CORS is over-permissive.** `cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true })` combines wildcard origin with credentials. Configure explicit production origins and use credentials only when required.
4. **MQTT is modeled, not implemented.** No `mqtt` dependency, broker integration, subscription validation, TLS/device identity, retry/DLQ, or command acknowledgement exists.

### Medium priority

1. **No operational Docker assets.** No Dockerfile, Compose file, healthcheck, Mongo volume, or environment example for deployment is present.
2. **Unbounded analytics scans.** Dashboard/statistics aggregation groups all `sensor_logs` and can become costly. Add time filters, pre-aggregates, cache, and telemetry retention/TTL.
3. **Missing transaction/consistency flow.** Creating logs, updating sensor state, changing pump state, and recording MQTT processing are not coordinated. Use transactions where supported or idempotent worker processing.
4. **Deletion has no referential policy.** Removing farms/sensors leaves logs and references. Choose restrict, soft delete, or a documented cascade/background cleanup policy.
5. **Error stack disclosure outside production.** This is helpful locally but should be tightly controlled by an explicit development setting.

### Maintainability

- CRUD route validation arrays are substantially duplicated across seven route modules. Extract field-schema factories or a declarative resource definition.
- Repository subclasses only instantiate `BaseRepository`; a registry can remove the tiny wrapper files if the extra names do not improve navigation.
- `MQTTLogController.js` versus `MqttLogService.js` has inconsistent acronym casing. Use `Mqtt` consistently in filenames/classes.
- Frontend simulation is separate from API code and its API helper files are empty; introduce a client module and feature flag for simulator versus live data.
- No test scripts or tests are configured for backend behavior, auth, validation, or API contracts.

## Recommended order

1. Implement authentication/RBAC and server-side password hashing.
2. Add MQTT broker integration with TLS, device identities, idempotent ingestion, and tests.
3. Connect frontend API clients and replace/scope simulation.
4. Add Docker/Compose, environment validation, rate limiting, and structured logs.
5. Add retention, aggregation, monitoring, and load tests.
