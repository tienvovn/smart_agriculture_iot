# Smart Agriculture IoT Architecture

## Overall architecture

The repository is a layered web application with a React/Vite single-page dashboard and a Node.js/Express REST backend. The backend applies route → controller → service → repository → Mongoose model layering and stores operational records in MongoDB. Swagger UI is exposed at `/api/docs`.

The intended field topology is ESP32 devices at three farms publishing telemetry through WiFi, the Internet, and an MQTT broker. The repository currently models and documents MQTT messages (`mqtt_logs`) but does not contain an MQTT client, broker configuration, or ESP32 firmware. The React dashboard is also currently driven by its in-memory `FarmContext` simulator rather than the REST API.

## Technology stack

| Layer | Implemented technology |
|---|---|
| Frontend | React 19, Vite, React Router, Tailwind CSS, Recharts, Framer Motion, React Icons |
| Backend | Node.js, Express 4, Mongoose 8, express-validator, Helmet, CORS, Morgan |
| API documentation | swagger-jsdoc, swagger-ui-express |
| Persistence | MongoDB (Mongoose schemas and seed scripts) |
| IoT domain | ESP32/WiFi/MQTT represented by models, simulator UI, and documentation |

No Dockerfile, Compose file, MQTT broker runtime, or deployment manifest is present in the repository root.

## Communication flow

1. Sensors measure temperature, humidity, and soil pH at a farm.
2. An ESP32 would send telemetry through WiFi and the Internet to an MQTT broker.
3. A production backend subscriber would validate the topic/payload, create `mqtt_logs`, update sensor state, and create `sensor_logs`.
4. Express exposes the stored data through `/api/*`; the dashboard would consume those endpoints over HTTPS.
5. The implemented frontend currently generates readings, weather effects, and pump state locally once per second; it does not call the backend API.

## Advantages

- Clear backend layering and reusable CRUD abstractions.
- Schema validation, query validation, pagination, filtering, safe sort allowlists, and centralized errors.
- MongoDB fits time-series-like telemetry and flexible MQTT payload logging.
- Swagger offers an interactive API contract.
- The dashboard simulation enables UI development without devices.

## Disadvantages and gaps

- No live MQTT ingestion/outbound command path, broker configuration, or firmware integration.
- No authentication or role-based authorization although users and roles are modeled.
- Frontend/backend integration is incomplete: `farmApi.js`, `historyApi.js`, and `mqtt.js` are empty.
- No container configuration despite Docker being an intended technology.
- Analytics aggregate the entire log collections and will become expensive at scale.

## Scalability

For initial farms, the current monolithic API and MongoDB indexes are sufficient. For growth, deploy stateless API replicas behind a load balancer, use a managed MQTT broker with TLS and per-device credentials, consume messages through a worker/queue, retain raw telemetry with TTL/time-series collections, pre-aggregate dashboard windows, and add Redis for frequently requested dashboard data. Partition by farm or time where retention volume requires it. Use object-level authorization and audit events before exposing multi-tenant access.
