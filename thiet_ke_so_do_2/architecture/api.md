# API Report

Base URL: `/api`; health endpoint: `/health`; interactive documentation: `/api/docs`.

## Implemented resources

Seven resources expose consistent CRUD endpoints: `/farms`, `/sensors`, `/sensor-logs`, `/pump-logs`, `/weather-logs`, `/mqtt-logs`, and `/users`.

| Operation | Endpoints |
|---|---|
| List | `GET /api/{resource}` with page, limit, search, sort and resource-specific filters |
| Create | `POST /api/{resource}` |
| Read | `GET /api/{resource}/:id` |
| Replace / update | `PUT` and `PATCH /api/{resource}/:id` |
| Delete | `DELETE /api/{resource}/:id` |
| Analytics | `GET /api/dashboard`, `GET /api/statistics` |

Responses use `{success, message, data?, meta?}`. List endpoints support pagination with a maximum limit of 200, escaped case-insensitive search, and service-level sort-field allowlists. `express-validator` validates query/body data, and invalid resource IDs are rejected before database access.

## Naming conventions

- Paths use plural kebab-case nouns (`sensor-logs`, `mqtt-logs`).
- MongoDB model fields are camelCase (`capturedAt`, `processingStatus`).
- Query filters mirror field names (`farm`, `sensorType`, `processingStatus`).
- Success messages are human-readable; HTTP status codes follow normal CRUD behavior (200, 201, 400, 404, 409, 500).

## Missing endpoints

The API lacks authentication/session endpoints, password registration/login semantics, authorization middleware, password reset, account self-service, MQTT webhook/subscriber endpoints, device provisioning/credentials, telemetry bulk ingestion, pump command/acknowledgement endpoints, per-farm analytics time ranges, health readiness/liveness separation, rate limiting, and API versioning. The current generic user CRUD must not be exposed publicly without authorization.
