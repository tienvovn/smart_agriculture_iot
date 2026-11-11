// Real ESP32 devices (firmware: IOT/SmartAgriculture) and the farms they feed.
//
// HARDWARE_DEVICES=garden01=FARM-001,garden02=FARM-003
//   deviceId is the MQTT topic segment: <prefix>/<deviceId>/telemetry
//
// A farm listed here is driven by real telemetry: the simulator skips it.

export function hardwareDevices() {
  const raw = process.env.HARDWARE_DEVICES || '';
  const devices = new Map();
  for (const entry of raw.split(',').map((item) => item.trim()).filter(Boolean)) {
    const [deviceId, farmCode] = entry.split('=').map((item) => item?.trim());
    if (!/^[A-Za-z0-9_-]{1,40}$/.test(deviceId || '') || !/^[A-Za-z0-9-]{1,40}$/.test(farmCode || '')) {
      throw new Error(`Invalid HARDWARE_DEVICES entry "${entry}" (expected deviceId=FARM-CODE)`);
    }
    devices.set(deviceId, farmCode);
  }
  return devices;
}

export function hardwareFarmCodes() {
  return new Set(hardwareDevices().values());
}

export const hardwareConfig = {
  mqttUrl: () => process.env.HARDWARE_MQTT_URL || process.env.MQTT_URL || '',
  topicPrefix: () => process.env.HARDWARE_TOPIC_PREFIX || 'smartgarden',
  // Device is considered offline when no telemetry arrives for this long (firmware sends every 2.5 s).
  staleMs: () => Number(process.env.HARDWARE_STALE_MS || 15000),
  // How long the relay may be ON before soil moisture must have risen.
  effectWindowMs: () => Number(process.env.HARDWARE_EFFECT_WINDOW_MS || 60000),
  // Minimum soil-moisture rise (percentage points) that proves water reached the soil.
  minMoistureRise: () => Number(process.env.HARDWARE_MIN_MOISTURE_RISE || 3),
  // Firmware publishes pump/state continuously, so an ACK should arrive almost immediately.
  ackTimeoutMs: () => Number(process.env.HARDWARE_ACK_TIMEOUT_MS || 8000),
  // Firmware AUTO threshold (SOIL_DRY_THRESHOLD in AppConfig.h), recorded as rule evidence.
  dryThreshold: () => Number(process.env.HARDWARE_DRY_THRESHOLD || 35)
};
