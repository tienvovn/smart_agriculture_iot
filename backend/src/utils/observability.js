import dgram from 'node:dgram';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const service = process.env.DD_SERVICE || 'smart-farm-mvp';
const environment = process.env.DD_ENV || process.env.NODE_ENV || 'development';
const version = process.env.DD_VERSION || '0.1.0';
const agentHost = process.env.DD_AGENT_HOST;
const dogstatsdPort = Number(process.env.DD_DOGSTATSD_PORT || 8125);
const socket = agentHost ? dgram.createSocket('udp4') : null;
const logFile = process.env.DD_LOG_FILE;
const require = createRequire(import.meta.url);
const tracer = process.env.DD_APM_ENABLED === 'true' ? require('dd-trace') : null;
const traceFormats = tracer ? require('dd-trace/ext/formats') : null;

socket?.unref();
// Metrics are best-effort: an unreachable agent (e.g. container not started) must never crash the app.
socket?.on('error', () => {});

function baseContext() {
  return {
    service,
    env: environment,
    version
  };
}

export function logEvent(level, event, context = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...baseContext(),
    ...context
  };
  // Datadog lowercases metric tag values (farm:farm-002); mirror that so alert links can filter logs by @farm.
  if (context.farmCode && !context.farm) payload.farm = String(context.farmCode).toLowerCase();
  const span = tracer?.scope().active();
  if (span) tracer.inject(span.context(), traceFormats.LOG, payload);

  const output = JSON.stringify(payload);
  if (logFile) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.appendFileSync(logFile, output + '\n');
  }
  if (level === 'error') console.error(output);
  else if (level === 'warn') console.warn(output);
  else console.log(output);
}

export function traceOperation(name, tags, operation) {
  if (!tracer) return operation();
  return tracer.trace(name, { resource: name, tags }, operation);
}

export function metric(name, value, type = 'g', tags = {}) {
  if (!socket || !agentHost) return;

  const tagList = Object.entries({ env: environment, service, ...tags })
    .map(([key, tagValue]) => `${key}:${String(tagValue)}`)
    .join(',');
  const message = `${name}:${value}|${type}${tagList ? `|#${tagList}` : ''}`;
  socket.send(Buffer.from(message), dogstatsdPort, agentHost);
}

// Datadog Event over DogStatsD: _e{title.length,text.length}:title|text|t:alert_type|#tags
// Events show up as overlays on dashboards and in the Event Explorer next to monitors.
export function ddEvent(title, text, alertType = 'info', tags = {}) {
  if (!socket || !agentHost) return;
  const escapedText = text.replace(/\n/g, '\\n');
  const tagList = Object.entries({ env: environment, service, source: 'farmguard', ...tags })
    .map(([key, tagValue]) => `${key}:${String(tagValue)}`)
    .join(',');
  const message = `_e{${title.length},${escapedText.length}}:${title}|${escapedText}|t:${alertType}|s:farmguard|#${tagList}`;
  socket.send(Buffer.from(message), dogstatsdPort, agentHost);
}
