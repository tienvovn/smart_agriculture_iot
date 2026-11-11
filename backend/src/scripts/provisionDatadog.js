import dotenv from 'dotenv';

dotenv.config();

// Idempotent provisioning of the FarmGuard Datadog dashboard + monitors.
// Usage (from backend/):
//   npm run datadog:provision -- --dry-run   # print payloads only
//   npm run datadog:provision                # create or update in Datadog

const site = process.env.DD_SITE || 'datadoghq.com';
const environment = process.env.DD_ENV || 'development';
const service = process.env.DD_SERVICE || 'smart-farm-mvp';
const notify = (process.env.DD_ALERT_NOTIFY || '').trim(); // e.g. "@you@example.com @slack-farm-alerts"
const apiBase = 'https://api.' + site;
const appBase = 'https://' + (['datadoghq.com', 'datadoghq.eu'].includes(site) ? 'app.' + site : site);
const projectTag = 'project:farmguard';
const dashboardTitle = 'FarmGuard | Irrigation Outcome Assurance';
const dryRun = process.argv.includes('--dry-run');

const scope = 'env:' + environment;
const scopeWithFarm = scope + ',$farm';
const logBase = 'service:' + service + ' @env:' + environment;

// ---------------------------------------------------------------- dashboard

const incidentEvents = [{ q: 'sources:farmguard tags:env:' + environment }];

function timeseries(title, queries, { displayType = 'line', markers = [], events = [] } = {}) {
  return {
    definition: {
      type: 'timeseries',
      title,
      show_legend: true,
      requests: queries.map((q) => ({ q, display_type: displayType })),
      markers,
      events
    }
  };
}

function queryValue(title, q, { precision = 0, aggregator = 'last', conditional = [] } = {}) {
  return {
    definition: {
      type: 'query_value',
      title,
      precision,
      requests: [{ q, aggregator, conditional_formats: conditional }]
    }
  };
}

const redIfPositive = [
  { comparator: '>', value: 0, palette: 'white_on_red' },
  { comparator: '<=', value: 0, palette: 'white_on_green' }
];

const dashboard = {
  title: dashboardTitle,
  description: 'Detect → investigate → respond: proves that a controller ACK produced a physical irrigation outcome. Metrics, logs and traces share farm + correlationId.',
  layout_type: 'ordered',
  template_variables: [{ name: 'farm', prefix: 'farm', default: '*' }],
  widgets: [
    {
      definition: {
        type: 'note',
        content: '## FarmGuard incident flow\n' +
          '1. **Detect** – monitors below fire on silent irrigation failure, ACK timeout, stalled telemetry, soil-moisture anomaly.\n' +
          '2. **Investigate** – open the log stream, filter by `@correlationId`, pivot to the APM trace `farmguard.simulator.tick`.\n' +
          '3. **Respond** – use FarmGuard Incident Center to retry / repair; `incident.resolved` log and metrics return to 0.',
        background_color: 'blue',
        font_size: '14',
        show_tick: false
      }
    },
    {
      definition: {
        type: 'manage_status',
        title: 'FarmGuard monitors',
        query: 'tag:"' + projectTag + '"',
        summary_type: 'monitors',
        display_format: 'countsAndList',
        color_preference: 'background',
        hide_zero_counts: true,
        sort: 'status,asc'
      }
    },
    queryValue('Farms with silent irrigation failure',
      'sum:smartfarm.irrigation.outcome_missing{' + scopeWithFarm + '}', { conditional: redIfPositive }),
    queryValue('ACK timeouts (last 15m)',
      'sum:smartfarm.command.timeout{' + scopeWithFarm + '}.as_count()', { aggregator: 'sum', conditional: redIfPositive }),
    queryValue('MTTD – fault → detection (s)',
      'avg:smartfarm.incident.time_to_detect_seconds{' + scopeWithFarm + '}', { precision: 1, aggregator: 'avg' }),
    queryValue('MTTR – detection → proven recovery (s)',
      'avg:smartfarm.incident.time_to_resolve_seconds{' + scopeWithFarm + '}', { precision: 1, aggregator: 'avg' }),
    queryValue('Telemetry points / 5m',
      'sum:smartfarm.telemetry.received{' + scopeWithFarm + '}.as_count()', { aggregator: 'sum' }),
    timeseries('Silent irrigation failure (1 = active)',
      ['max:smartfarm.irrigation.outcome_missing{' + scopeWithFarm + '} by {farm}', 'max:smartfarm.incident.open{' + scopeWithFarm + '} by {farm}'],
      { displayType: 'bars', events: incidentEvents }),
    timeseries('Soil moisture (%) + anomaly band',
      ["anomalies(avg:smartfarm.soil_moisture.percent{" + scopeWithFarm + "} by {farm}, 'basic', 2)"],
      { events: incidentEvents }),
    timeseries('Measured pump current (A)',
      ['avg:smartfarm.pump.current_amp{' + scopeWithFarm + '} by {farm}']),
    timeseries('Command ACK latency (ms)',
      ['avg:smartfarm.command.ack_latency_ms{' + scopeWithFarm + '} by {farm}', 'max:smartfarm.command.ack_latency_ms{' + scopeWithFarm + '}']),
    timeseries('Command outcomes',
      [
        'sum:smartfarm.command.effect_confirmed{' + scopeWithFarm + '} by {farm}.as_count()',
        'sum:smartfarm.command.timeout{' + scopeWithFarm + '} by {farm}.as_count()'
      ],
      { displayType: 'bars' }),
    timeseries('Incident lifecycle: time to detect / resolve (s)',
      [
        'avg:smartfarm.incident.time_to_detect_seconds{' + scopeWithFarm + '} by {incident_type}',
        'avg:smartfarm.incident.time_to_resolve_seconds{' + scopeWithFarm + '} by {incident_type}'
      ],
      { displayType: 'bars', events: incidentEvents }),
    {
      definition: {
        type: 'note',
        content: '## Live ESP32 hardware\nReal telemetry from the SmartAgriculture firmware over MQTT (`source:hardware`). The board has no current sensor: outcome = relay ON **and** soil moisture rising.',
        background_color: 'green',
        font_size: '14',
        show_tick: false
      }
    },
    queryValue('ESP32 devices online',
      'min:smartfarm.device.online{' + scope + ',source:hardware}', {
        conditional: [
          { comparator: '<', value: 1, palette: 'white_on_red' },
          { comparator: '>=', value: 1, palette: 'white_on_green' }
        ]
      }),
    queryValue('Seconds since last ESP32 telemetry',
      'max:smartfarm.device.last_seen_seconds{' + scope + ',source:hardware}', { precision: 1 }),
    timeseries('ESP32 soil moisture (%) + relay', [
      'avg:smartfarm.soil_moisture.percent{' + scope + ',source:hardware} by {device}',
      'max:smartfarm.pump.relay_on{' + scope + ',source:hardware} by {device} * 100'
    ], { events: incidentEvents }),
    timeseries('ESP32 temperature (°C) & air humidity (%)', [
      'avg:smartfarm.temperature.celsius{' + scope + ',source:hardware} by {device}',
      'avg:smartfarm.air_humidity.percent{' + scope + ',source:hardware} by {device}'
    ]),
    timeseries('ESP32 sensor read errors (DHT22)',
      ['sum:smartfarm.sensor.read_error{' + scope + ',source:hardware} by {device}.as_count()'], { displayType: 'bars' }),
    timeseries('Telemetry throughput (by source)',
      ['sum:smartfarm.telemetry.received{' + scopeWithFarm + '} by {source}.as_count()'], { displayType: 'bars' }),
    timeseries('Telemetry anomalies (by sensor)',
      ['sum:smartfarm.telemetry.anomaly{' + scopeWithFarm + '} by {sensor}.as_count()'], { displayType: 'bars' }),
    timeseries('APM – simulator tick p95 latency (s)',
      ['p95:trace.farmguard.simulator.tick{' + scope + ',service:' + service + '}']),
    timeseries('APM – API requests & errors',
      [
        'sum:trace.express.request.hits{' + scope + ',service:' + service + '}.as_count()',
        'sum:trace.express.request.errors{' + scope + ',service:' + service + '}.as_count()'
      ],
      { displayType: 'bars' }),
    {
      definition: {
        type: 'log_stream',
        title: 'Incident & pipeline logs (warn/error)',
        query: logBase + ' status:(error OR warn)',
        indexes: [],
        columns: ['@event', '@farm', '@correlationId', '@incidentId'],
        message_display: 'inline',
        show_date_column: true,
        show_message_column: true,
        sort: { column: 'time', order: 'desc' }
      }
    }
  ]
};

// ---------------------------------------------------------------- monitors

function logsLink(extraQuery) {
  return appBase + '/logs?query=' + encodeURIComponent(logBase + ' ' + extraQuery);
}

function message(lines, dashboardUrl) {
  return [
    ...lines,
    '',
    dashboardUrl ? 'Dashboard: ' + appBase + dashboardUrl + '?tpl_var_farm={{farm.name}}' : '',
    notify
  ].filter((line) => line !== '').join('\n');
}

function buildMonitors(dashboardUrl) {
  const tags = [projectTag, 'env:' + environment, 'service:' + service];
  const base = (extra = {}) => ({
    notify_no_data: false,
    require_full_window: false,
    include_tags: true,
    renotify_interval: 0,
    ...extra
  });

  return [
    {
      name: 'FarmGuard | ACK received but irrigation outcome missing',
      type: 'query alert',
      priority: 1,
      query: 'max(last_1m):max:smartfarm.irrigation.outcome_missing{' + scope + '} by {farm} > 0.5',
      message: message([
        '{{#is_alert}}**Silent irrigation failure on farm {{farm.name}}.** The pump controller ACKed the command, but MongoDB telemetry shows no pump current and soil moisture keeps falling.{{/is_alert}}',
        '{{#is_recovery}}Irrigation outcome confirmed again on farm {{farm.name}}.{{/is_recovery}}',
        'Runbook: open FarmGuard Incident Center → issue repair. Investigate logs: ' + logsLink('@event:irrigation.outcome_missing @farm:{{farm.name}}')
      ], dashboardUrl),
      tags: [...tags, 'severity:critical'],
      options: base({ thresholds: { critical: 0.5 } })
    },
    {
      name: 'FarmGuard | Pump command ACK timeout',
      type: 'query alert',
      priority: 2,
      query: 'sum(last_5m):sum:smartfarm.command.timeout{' + scope + '} by {farm}.as_count() > 0',
      message: message([
        '{{#is_alert}}Pump controller on farm {{farm.name}} did not ACK {{value}} irrigation command(s) in the last 5 minutes. Device may be offline.{{/is_alert}}',
        '{{#is_recovery}}No more ACK timeouts on farm {{farm.name}}.{{/is_recovery}}',
        'Logs: ' + logsLink('@event:pump.command.ack_timeout @farm:{{farm.name}}')
      ], dashboardUrl),
      tags: [...tags, 'severity:high'],
      options: base({ thresholds: { critical: 0 } })
    },
    {
      name: 'FarmGuard | Telemetry pipeline stalled',
      type: 'query alert',
      priority: 2,
      query: 'sum(last_5m):sum:smartfarm.telemetry.received{' + scope + '} by {farm}.as_count() < 1',
      message: message([
        '{{#is_alert}}No telemetry ingested for farm {{farm.name}} in 5 minutes. Farm is flying blind.{{/is_alert}}',
        '{{#is_no_data}}No telemetry metric at all – backend, MQTT or Datadog Agent may be down.{{/is_no_data}}',
        '{{#is_recovery}}Telemetry flowing again for farm {{farm.name}}.{{/is_recovery}}',
        'Logs: ' + logsLink('@event:telemetry.*')
      ], dashboardUrl),
      tags: [...tags, 'severity:high'],
      options: base({ thresholds: { critical: 1 }, notify_no_data: true, no_data_timeframe: 10 })
    },
    {
      name: 'FarmGuard | Soil moisture anomaly (Anomaly Detection)',
      type: 'query alert',
      priority: 3,
      query: "avg(last_4h):anomalies(avg:smartfarm.soil_moisture.percent{" + scope + "} by {farm}, 'basic', 2, direction='below', interval=60, alert_window='last_5m', count_default_zero='true') >= 1",
      message: message([
        '{{#is_alert}}Soil moisture on farm {{farm.name}} dropped outside its learned band – irrigation may not be reaching the field.{{/is_alert}}',
        '{{#is_recovery}}Soil moisture back within expected range on farm {{farm.name}}.{{/is_recovery}}'
      ], dashboardUrl),
      tags: [...tags, 'severity:medium', 'capability:anomaly-detection'],
      options: base({
        thresholds: { critical: 1, critical_recovery: 0 },
        threshold_windows: { trigger_window: 'last_5m', recovery_window: 'last_5m' }
      })
    },
    {
      name: 'FarmGuard | Backend pipeline errors (logs)',
      type: 'log alert',
      priority: 2,
      query: 'logs("' + logBase + ' status:error -@event:(irrigation.outcome_missing OR pump.command.ack_timeout OR device.offline)").index("*").rollup("count").by("@event").last("5m") > 0',
      message: message([
        '{{#is_alert}}{{value}} error log(s) of type {{log.attributes.event}} in 5 minutes. Sample: {{log.message}}{{/is_alert}}',
        '{{#is_recovery}}Backend error logs stopped.{{/is_recovery}}',
        'Logs: ' + logsLink('status:error')
      ], dashboardUrl),
      tags: [...tags, 'severity:high', 'capability:log-management'],
      options: base({ thresholds: { critical: 0 }, enable_logs_sample: true })
    },
    {
      name: 'FarmGuard | ESP32 device offline',
      type: 'query alert',
      priority: 1,
      query: 'max(last_2m):max:smartfarm.device.online{' + scope + ',source:hardware} by {device} < 1',
      message: message([
        '{{#is_alert}}ESP32 {{device.name}} stopped sending telemetry: the farm is not observed. Check power, Wi-Fi and the MQTT broker.{{/is_alert}}',
        '{{#is_no_data}}No heartbeat from the hardware bridge at all: backend or Datadog Agent may be down.{{/is_no_data}}',
        '{{#is_recovery}}ESP32 {{device.name}} is streaming again.{{/is_recovery}}',
        'Logs: ' + logsLink('@event:(device.offline OR device.connection_restored)')
      ], dashboardUrl),
      tags: [...tags, 'severity:critical', 'source:hardware'],
      options: base({ thresholds: { critical: 1 }, notify_no_data: true, no_data_timeframe: 5 })
    },
    {
      name: 'FarmGuard | Simulator tick slow (APM)',
      type: 'query alert',
      priority: 3,
      query: 'percentile(last_10m):p95:trace.farmguard.simulator.tick{' + scope + ',service:' + service + '} > 2',
      message: message([
        '{{#is_alert}}p95 of `farmguard.simulator.tick` is {{value}}s – MongoDB writes or detection are slowing telemetry processing.{{/is_alert}}',
        '{{#is_recovery}}Simulator tick latency back to normal.{{/is_recovery}}',
        'Traces: ' + appBase + '/apm/traces?query=' + encodeURIComponent('service:' + service + ' env:' + environment + ' operation_name:farmguard.simulator.tick')
      ], dashboardUrl),
      tags: [...tags, 'severity:medium', 'capability:apm'],
      options: base({ thresholds: { critical: 2, warning: 1 } })
    }
  ];
}

// ---------------------------------------------------------------- SLO

const slo = {
  name: 'FarmGuard | Irrigation commands with proven physical outcome',
  type: 'metric',
  description: 'Good = command whose pump current was measured after ACK. Bad = incident (ACK timeout or silent failure).',
  query: {
    numerator: 'sum:smartfarm.command.effect_confirmed{' + scope + '}.as_count()',
    denominator: 'sum:smartfarm.command.effect_confirmed{' + scope + '}.as_count() + sum:smartfarm.incident.opened{' + scope + '}.as_count()'
  },
  thresholds: [{ timeframe: '7d', target: 95, warning: 98 }],
  tags: [projectTag, 'env:' + environment, 'service:' + service]
};

// ---------------------------------------------------------------- API

async function request(method, path, body) {
  const response = await fetch(apiBase + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'DD-API-KEY': process.env.DD_API_KEY,
      'DD-APPLICATION-KEY': process.env.DD_APP_KEY
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(method + ' ' + path + ' failed (' + response.status + '): ' + JSON.stringify(payload));
  return payload;
}

if (dryRun) {
  console.log(JSON.stringify({ site, environment, dashboard, monitors: buildMonitors('/dashboard/<id>'), slo }, null, 2));
} else {
  if (!process.env.DD_API_KEY || !process.env.DD_APP_KEY) {
    throw new Error('Set DD_API_KEY and DD_APP_KEY in backend/.env or the shell. Use --dry-run to preview.');
  }

  const dashboards = await request('GET', '/api/v1/dashboard');
  const existingDashboard = dashboards.dashboards?.find((item) => item.title === dashboardTitle);
  const savedDashboard = await request(
    existingDashboard ? 'PUT' : 'POST',
    existingDashboard ? '/api/v1/dashboard/' + existingDashboard.id : '/api/v1/dashboard',
    dashboard
  );

  const existingMonitors = await request('GET', '/api/v1/monitor?monitor_tags=' + encodeURIComponent(projectTag));
  const results = [];
  for (const monitor of buildMonitors(savedDashboard.url)) {
    try {
      await request('POST', '/api/v1/monitor/validate', monitor);
      const existing = existingMonitors.find((item) => item.name === monitor.name);
      const saved = await request(
        existing ? 'PUT' : 'POST',
        existing ? '/api/v1/monitor/' + existing.id : '/api/v1/monitor',
        monitor
      );
      results.push({ id: saved.id, name: saved.name, action: existing ? 'updated' : 'created' });
    } catch (error) {
      results.push({ name: monitor.name, action: 'failed', error: error.message });
    }
  }

  let sloResult;
  try {
    const existingSlos = await request('GET', '/api/v1/slo?tags_query=' + encodeURIComponent(projectTag));
    const existingSlo = existingSlos.data?.find((item) => item.name === slo.name);
    const savedSlo = await request(existingSlo ? 'PUT' : 'POST', existingSlo ? '/api/v1/slo/' + existingSlo.id : '/api/v1/slo', slo);
    const sloId = savedSlo.data?.[0]?.id || existingSlo?.id;
    sloResult = { id: sloId, name: slo.name, action: existingSlo ? 'updated' : 'created', url: appBase + '/slo?slo_id=' + sloId };
  } catch (error) {
    sloResult = { name: slo.name, action: 'failed', error: error.message };
  }

  console.log(JSON.stringify({
    dashboardUrl: appBase + savedDashboard.url,
    monitors: results,
    slo: sloResult
  }, null, 2));
  if (results.some((item) => item.action === 'failed') || sloResult.action === 'failed') process.exitCode = 1;
}
