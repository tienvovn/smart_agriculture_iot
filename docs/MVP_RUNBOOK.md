# Smart Farm incident MVP runbook

## Start locally

Start MongoDB:

```powershell
docker compose up -d mongodb
```

Start the backend. Seed only a fresh demo database: `npm run seed` deletes existing
farm, command, incident, and telemetry data.

```powershell
Set-Location backend
Copy-Item .env.example .env
npm.cmd install
npm.cmd run seed # fresh database only
npm.cmd run dev
```

Start the frontend in another terminal:

```powershell
Copy-Item .env.example .env
npm.cmd install
npm.cmd run dev
```

Open `http://localhost:5173/simulation`.

## Demo flow

1. Select `FARM-002` and inject **silent pump failure**. The controller stays online
   and acknowledges the irrigation command, but the simulated motor has no power.
2. Wait for the MongoDB telemetry check: pump current remains 0 A and soil moisture
   continues to fall. The incident opens despite the green ACK.
3. Open `/incidents`. Show the MongoDB aggregation timeline, command ACK, current,
   moisture trend, and correlation ID.
4. Restore simulated pump power, then issue the repair command. Because the
   original command was already ACKed, the repair uses a new command ID and
   idempotency key under the same correlation ID. The ACK-timeout alternative
   retries the original command and key.
5. Return to `/incidents`. The incident resolves only after MongoDB telemetry shows
   both pump current and rising moisture. The evidence panel re-queries the data.

The original ACK timeout remains available as an alternative scenario.
If an earlier `FARM-002` incident is still open, restore and resolve it first;
the app prevents stacking another scenario on an active incident.

## Leafy-inspired MongoDB telemetry pipeline

The [Leafy Smart Meters demo](https://github.com/mongodb-industry-solutions/leafy-smart-meters)
inspired this farm-specific flow: MQTT readings enter `telemetry_ts` (Hot Time
Series), a small `telemetry_events` document records each accepted batch, and a
detector compares each temperature, moisture, or pH reading with the prior 12
readings from the same device. A reading is an anomaly when its absolute change
exceeds both a physical minimum and three baseline standard deviations. The
result and its mean, standard deviation, sample count, and source are stored in
`telemetry_anomalies` and shown in Simulation Center. The pump incident logic
continues to use ACK, current, and moisture evidence rather than a generic
statistical outlier.
Simulation Center also fetches `GET /api/iot/telemetry/storage` to show
MongoDB `collStats`: measurement count, logical data bytes, allocated storage
bytes, and time-series bucket count. Allocated storage includes free space;
the two byte values are not presented as a compression ratio.

MongoDB [does not support Change Streams on Time Series collections](https://www.mongodb.com/docs/manual/core/timeseries/timeseries-limitations/).
The stream watches the regular `telemetry_events` collection. A replica set or
Atlas cluster activates it; the backend also detects accepted messages directly,
so the default standalone MongoDB setup keeps working. `telemetry_events` has
a 24-hour TTL; the raw readings keep the 30-day Hot retention. MQTT message IDs
are unique per farm in the event collection; repeated MQTT deliveries with the
same ID do not create more readings. A partially failed write is logged and
requires inspection before replay.

For an optional local MQTT demo, start the broker and add `MQTT_URL` to
`backend/.env`, then restart the backend:

```powershell
docker compose --profile mqtt up -d mqtt
# backend/.env: MQTT_URL=mqtt://127.0.0.1:1883
Set-Location backend
npm.cmd run mqtt:publish-demo -- FARM-002
```

The publisher sends 12 near-28°C readings and one 43°C reading on
`farmguard/FARM-002/telemetry`. Open `/simulation` and inspect **Live anomaly
evidence**. The accepted payload format is:

```json
{"messageId":"reading-001","deviceId":"FARM-002-SENSOR-01","capturedAt":"2026-10-17T12:00:00.000Z","temperature":28.1,"humidity":49.5,"soil_ph":6.5}
```

Use one or more numeric readings. The farm code comes from the MQTT topic, and
the payload timestamp must be within five minutes of receipt. The bundled broker
accepts anonymous clients and binds only to local host; use an authenticated
broker for remote devices.

To activate Change Streams locally, run MongoDB as a single-node replica set.
The override keeps the same volume but restarts `mongodb`, so schedule this when
the local demo can tolerate a brief outage. Run `rs.initiate` only once:

```powershell
Set-Location D:\iot\Gia_lap_IOT
docker compose -f compose.yaml -f compose.replica.yaml up -d mongodb
docker exec smart-farm-mongodb mongosh --quiet --eval "rs.initiate({_id:'rs0',members:[{_id:0,host:'localhost:27017'}]})"
# backend/.env: MONGODB_URI=mongodb://127.0.0.1:27017/smart_farm_iot?directConnection=true
```

Restart the backend. The Simulation Center shows `Change Stream` when active;
otherwise it shows `direct detector`. An existing Atlas replica set also works
with its normal connection string. The reference project is MIT licensed;
this implementation uses its architecture as inspiration and does not copy
its source files or sample database.

## Useful endpoints

- Snapshot: `GET http://localhost:5000/api/iot/snapshot`
- SSE stream: `GET http://localhost:5000/api/iot/stream`
- Start scenario: `POST http://localhost:5000/api/iot/simulation/ack-timeout`
- Silent failure: `POST http://localhost:5000/api/iot/simulation/silent-failure`
- Restore controller: `POST http://localhost:5000/api/iot/simulation/restore-controller`
- Retry: `POST http://localhost:5000/api/iot/incidents/{incidentId}/retry`
- Recovery aggregation: `GET http://localhost:5000/api/iot/incidents/{incidentId}/evidence`

## Datadog

The backend writes structured JSON logs to stdout. Set `DD_LOG_FILE` to write the
same events to a file for Datadog Log Management. Set `DD_AGENT_HOST` to send
`smartfarm.*` metrics through DogStatsD. The Datadog Agent configuration and an
idempotent dashboard/monitor provisioning script are included, but a Datadog trial,
API key, and application key are required to activate them.
The backend also supports Datadog APM: each simulator tick is a trace with MongoDB
operations and structured log correlation.

In `backend/.env`, set:

```text
DD_AGENT_HOST=127.0.0.1
DD_DOGSTATSD_PORT=8125
DD_LOG_FILE=./logs/farmguard.jsonl
DD_SITE=datadoghq.com
DD_ENV=development
DD_APM_ENABLED=true
```

Also set (never commit them):

```text
DD_API_KEY=<trial API key>
DD_APP_KEY=<trial application key>
DD_ALERT_NOTIFY=@your-email@example.com
```

`DD_SITE` must match your trial URL (e.g. `us5.datadoghq.com` if the app opens at
`us5.datadoghq.com`). Start Docker Desktop, then from the repository root start the
Agent reading the same file:

```powershell
docker compose --env-file backend/.env --profile observability up -d datadog-agent
docker compose exec datadog-agent agent status   # check: API key valid, Logs + APM running
```

Restart the backend using `npm.cmd run start:apm` from `backend/` to load the
Datadog tracer before Express and MongoDB. Use `npm.cmd run dev` for local work
without APM.

From `backend/`, preview and then create or update the dashboard and monitors
(idempotent, safe to rerun):

```powershell
npm.cmd run datadog:provision -- --dry-run
npm.cmd run datadog:provision
```

Provisioned monitors (all tagged `project:farmguard`):

| Monitor | Signal | Capability |
|---|---|---|
| ACK received but irrigation outcome missing | `smartfarm.irrigation.outcome_missing` > 0.5 by farm | Metrics |
| Pump command ACK timeout | `smartfarm.command.timeout` count > 0 in 5m | Metrics |
| Telemetry pipeline stalled | `smartfarm.telemetry.received` < 1 in 5m, alerts on no data | Metrics |
| Soil moisture anomaly | `anomalies()` on `smartfarm.soil_moisture.percent` | Anomaly Detection |
| Backend pipeline errors | error logs by `@event` (MQTT, change stream, tick) | Log Management |
| Simulator tick slow | p95 `trace.farmguard.simulator.tick` > 2s | APM |

The script also creates the SLO *Irrigation commands with proven physical outcome*
(good = `smartfarm.command.effect_confirmed`, bad = `smartfarm.incident.opened`, 95% / 7d),
and the backend emits a Datadog Event (`source:farmguard`) when an incident opens or
resolves, overlaid on the dashboard charts. MTTD/MTTR are exposed both as Datadog
distributions and by the MongoDB aggregation `GET /api/iot/incidents/kpis?hours=24`.

Each alert message links to the dashboard (pre-filtered by farm) and a Logs Explorer
query; logs carry `correlationId`/`incidentId` and `dd.trace_id`, so you can pivot
metric → log → trace. The anomaly monitor needs some history (run the backend for
~30 minutes before the demo) to learn a band.

Run the silent failure scenario and check that the Datadog dashboard shows
`smartfarm.irrigation.outcome_missing = 1` for the farm, the monitor alerts, and
the `irrigation.outcome_missing` log has the same `correlationId` as the incident.
The APM trace named `farmguard.simulator.tick` should contain the related MongoDB
spans and linked logs.
After repair, the gauge returns to 0. The monitor evaluates a one-minute window,
so its alert state can take longer to clear than the app incident.

## Large deterministic telemetry dataset

Estimate the default 100 GiB logical BSON dataset without writing anything:

```powershell
Set-Location backend
npm.cmd run data:estimate
```

The default plan represents 2,500 farms, four series per farm and one measurement every
10 seconds. It is approximately 409 million documents covering about five simulated days,
so the complete benchmark stays comfortably inside the collection's 30-day retention
window through the hackathon demo period.
The generated physical storage will normally be smaller than 100 GiB because MongoDB
time-series buckets compress repeated metadata and similar measurements.

Generate a safe 100 MiB development dataset directly into MongoDB:

```powershell
npm.cmd run data:generate -- --mode mongo --target-gib 0.1 --farms 30 --seed farmguard-demo-v1
```

Generate the full 100 GiB logical dataset only after checking Atlas/storage capacity:

```powershell
npm.cmd run data:generate -- --mode mongo --target-gib 100 --farms 2500 --seed farmguard-100gb-v1 --start-at 2026-10-10T12:00:00.000Z --confirm-large-write
```

Generate an NDJSON dump instead:

```powershell
npm.cmd run data:generate -- --mode ndjson --target-gib 100 --output D:\farmguard-data\telemetry.ndjson --confirm-large-write
```

Each run uses a seeded deterministic generator and writes a SHA-256 manifest. The same
seed and options produce the same BSON stream, making benchmark and demo results
reproducible.

Validate operational correctness and the canonical bounded query:

```powershell
npm.cmd run data:validate
```

The validator checks the time-series configuration, physical sensor ranges, confirmed
command evidence, resolved incident evidence, duplicate active incidents, and query
execution statistics.

## MongoDB cheat sheet and retention

Open `/statistics` for the Telemetry Explorer. Select a farm and sensor, then slice
by a Vietnam calendar **day**, **month**, or **year**. The trend endpoint is
`GET /api/iot/telemetry/trend?period=month&value=2026-10&farmCode=FARM-002&sensorType=humidity`.
Each point reports its source tier. A selected day shows hourly raw readings when
available; an older day falls back to one daily point. A month shows daily points,
or one monthly point when only cold data remains. A year shows monthly points.
`npm.cmd run data:validate` also reports counts and TTL status for all three tiers.

| Tier | MongoDB collection | Content | Retention |
| --- | --- | --- | --- |
| Hot | `telemetry_ts` | Raw readings, Time Series | TTL 30 days |
| Warm | `telemetry_daily` | Per-device daily count, sum, average, min, max | TTL 400 days on `expiresAt` |
| Cold | `telemetry_monthly` | Per-device monthly weighted summary | No TTL |

These are **logical tiers in the same MongoDB database**. They allow the app to
query progressively smaller summaries; separate low-cost physical storage is not
configured. Mutable commands and incidents stay in normal collections. Simulator
ingestion and the bulk dataset generator use unordered `insertMany` batches.
The incident aggregations start with bounded matches on metadata and time.

For a **completed Vietnam calendar day**, materialize per-device, per-sensor totals
in the normal `telemetry_daily` collection. `$dateTrunc` and `$dateToString` use
`Asia/Ho_Chi_Minh`, so the day starts at 17:00 UTC on the preceding UTC date.
The rollup stores sample count, sum, average, minimum, and maximum. Rerunning a day
replaces the same series documents, which is useful when late readings arrive.
Each successful run writes a record in `telemetry_rollup_runs`, including empty days.

```powershell
Set-Location backend
npm.cmd run data:maintain -- --day 2026-10-16 --mode rollup
# Optional: limit the job to one farm's stable metadata
npm.cmd run data:maintain -- --day 2026-10-16 --mode rollup --farm-code FARM-002
```

After daily rollups, refresh the month's cold summary. The monthly job uses daily
`sum` and `samples` for a weighted average. It marks a month `complete` only after
the month ends **and** the run ledger contains every calendar day. The year slicer
uses complete cold months; an open or incomplete month is composed from warm and
hot points so new readings remain visible.

```powershell
npm.cmd run data:maintain -- --month 2026-10 --mode monthly
```

Schedule `npm.cmd run data:cycle` once each day after 00:00 Vietnam time. It rolls up
yesterday and refreshes that month's cold summary in one idempotent run. If the job
was offline, backfill missed days with `--mode rollup --day ...` before 30-day raw
TTL expiry, then rerun `--mode monthly --month ...`.

Export the same completed day before raw TTL expiry. The archive is streamed as
MongoDB Extended JSON lines; its manifest includes document count, byte count and
SHA-256. The exporter refuses to overwrite an existing archive or export a day that
may already have lost readings to TTL.

```powershell
npm.cmd run data:maintain -- --day 2026-10-16 --mode archive --output-dir ./archives
Get-FileHash ./archives/telemetry-2026-10-16-all.ndjson -Algorithm SHA256
```

Compare the printed hash with `sha256` in the adjacent manifest. Store the archive
and manifest in durable off-host storage. In production, schedule the daily rollup
and archive for yesterday's Vietnam day, then refresh that month's monthly rollup.
Retry failures and alert if a daily run has not succeeded before the raw collection's
30-day TTL. The warm collection has its own 400-day TTL, so monthly summaries must
be complete before their daily sources expire. The file archive is a separate
recovery copy of raw readings; restore it into a separate collection first to avoid
duplicating live data.
