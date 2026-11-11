// Speaks the exact MQTT contract of the IOT/SmartAgriculture ESP32 firmware, for testing the
// hardware bridge without a board.
//
//   node src/scripts/emulateEsp32.js [--device garden01] [--url mqtt://127.0.0.1:1883] [--no-water] [--start-soil 32]
//
// --no-water   relay clicks ON but no water reaches the soil (pump out of the tank): a silent failure.
//              Type "w" + Enter while running to "put the pump back" and let water flow.
import mqtt from 'mqtt';

const arg = (name, fallback) => {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : fallback;
};
const device = arg('device', 'garden01');
const url = arg('url', process.env.HARDWARE_MQTT_URL || process.env.MQTT_URL || 'mqtt://127.0.0.1:1883');
const prefix = process.env.HARDWARE_TOPIC_PREFIX || 'smartgarden';
let waterFlows = !process.argv.includes('--no-water');
let soil = Number(arg('start-soil', 40));
let relay = false;
let autoMode = true;

const topic = (suffix) => `${prefix}/${device}/${suffix}`;
const client = mqtt.connect(url, { clientId: `ESP32_EMULATOR_${device}` });

client.on('connect', () => {
  console.log(`[emulator] connected to ${url} as ${device} (water ${waterFlows ? 'flows' : 'BLOCKED'})`);
  client.publish(topic('status'), 'online', { retain: true });
  client.subscribe([topic('pump/command'), topic('mode/command')]);
});

client.on('message', (incoming, payload) => {
  const message = payload.toString().trim().toUpperCase();
  if (incoming === topic('pump/command') && (message === 'ON' || message === 'OFF')) relay = message === 'ON';
  if (incoming === topic('mode/command')) {
    autoMode = message === 'AUTO';
    if (!autoMode) relay = false;
  }
  console.log(`[emulator] command ${incoming.split('/').slice(-2).join('/')} = ${message}`);
  publishTelemetry(); // firmware reports the new relay/mode immediately
});

// Firmware: sensors every 2.5 s, local AUTO irrigation (ON < 35 %, OFF >= 75 %).
setInterval(() => {
  soil += relay && waterFlows ? 1.6 : -0.4;
  soil = Math.max(10, Math.min(95, soil + (Math.random() - 0.5) * 0.4));
  const temperature = 28 + (Math.random() - 0.5);
  const humidity = 68 + (Math.random() - 0.5) * 2;
  if (autoMode) {
    if (soil < 35) relay = true;
    else if (soil >= 75) relay = false;
  }
  publishTelemetry(temperature, humidity);
}, 2500);

let lastTemperature = 28;
let lastHumidity = 68;
function publishTelemetry(temperature = lastTemperature, humidity = lastHumidity) {
  lastTemperature = temperature;
  lastHumidity = humidity;
  const payload = `{"temperature":${temperature.toFixed(2)},"humidity":${humidity.toFixed(2)},"soil":${soil.toFixed(2)},"pump":${relay},"mode":"${autoMode ? 'AUTO' : 'MANUAL'}"}`;
  client.publish(topic('telemetry'), payload);
  console.log(`[emulator] ${payload}`);
}

// Firmware: relay state on change, plus a 5 s heartbeat.
let lastRelay = null;
let lastRelayAt = 0;
setInterval(() => {
  if (relay === lastRelay && Date.now() - lastRelayAt < 5000) return;
  lastRelay = relay;
  lastRelayAt = Date.now();
  client.publish(topic('pump/state'), relay ? 'ON' : 'OFF');
}, 10);

process.stdin.on('data', (data) => {
  if (data.toString().trim().toLowerCase() === 'w') {
    waterFlows = !waterFlows;
    console.log(`[emulator] water ${waterFlows ? 'flows again' : 'BLOCKED'}`);
  }
});
