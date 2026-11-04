import dotenv from 'dotenv';

dotenv.config();

const site = process.env.DD_SITE || 'datadoghq.com';
const environment = process.env.DD_ENV || 'development';
const apiBase = 'https://api.' + site;
const projectTag = 'project:farmguard';
const monitorName = 'FarmGuard | ACK received but irrigation outcome missing';
const dashboardTitle = 'FarmGuard | Irrigation Outcome Assurance';
const dryRun = process.argv.includes('--dry-run');

function timeseries(title, metric, displayType = 'line') {
  return {
    definition: {
      type: 'timeseries',
      title,
      requests: [{
        q: 'avg:' + metric + '{env:' + environment + '} by {farm}',
        display_type: displayType
      }]
    }
  };
}

const dashboard = {
  title: dashboardTitle,
  description: 'Live evidence that a controller ACK produced a physical irrigation outcome. Filter by farm.',
  layout_type: 'ordered',
  widgets: [
    timeseries('Silent irrigation failure (1 = active)', 'smartfarm.irrigation.outcome_missing'),
    timeseries('Soil moisture (%)', 'smartfarm.soil_moisture.percent'),
    timeseries('Measured pump current (A)', 'smartfarm.pump.current_amp'),
    timeseries('Command ACK latency (ms)', 'smartfarm.command.ack_latency_ms')
  ]
};

const monitor = {
  name: monitorName,
  type: 'query alert',
  query: 'max(last_1m):max:smartfarm.irrigation.outcome_missing{env:' + environment + '} by {farm} > 0.5',
  message: 'Controller ACK was received, but MongoDB telemetry shows no pump current and falling soil moisture. Open FarmGuard Incident Center and search structured logs for the incident correlationId.',
  tags: [projectTag, 'env:' + environment],
  options: {
    thresholds: { critical: 0.5 },
    notify_no_data: false,
    require_full_window: false
  }
};

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
  console.log(JSON.stringify({ site, environment, dashboard, monitor }, null, 2));
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

  await request('POST', '/api/v1/monitor/validate', monitor);
  const monitors = await request('GET', '/api/v1/monitor?tags=' + encodeURIComponent(projectTag));
  const existingMonitor = monitors.find((item) => item.name === monitorName);
  const savedMonitor = await request(
    existingMonitor ? 'PUT' : 'POST',
    existingMonitor ? '/api/v1/monitor/' + existingMonitor.id : '/api/v1/monitor',
    monitor
  );

  console.log(JSON.stringify({
    dashboardId: savedDashboard.id,
    dashboardUrl: savedDashboard.url,
    monitorId: savedMonitor.id,
    monitorName: savedMonitor.name
  }, null, 2));
}
