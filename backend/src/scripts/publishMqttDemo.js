import { randomUUID } from 'node:crypto';
import mqtt from 'mqtt';

const broker = process.env.MQTT_URL || 'mqtt://127.0.0.1:1883';
const farmCode = process.argv[2] || 'FARM-002';
const topic = `farmguard/${farmCode}/telemetry`;
const deviceId = `${farmCode}-LEAFY-DEMO`;
const client = mqtt.connect(broker);

try {
  await new Promise((resolve, reject) => {
    client.once('connect', resolve);
    client.once('error', reject);
  });
  const runId = randomUUID();
  for (let index = 0; index < 13; index += 1) {
    const message = {
      messageId: `${runId}-${index}`,
      deviceId,
      capturedAt: new Date().toISOString(),
      temperature: index === 12 ? 43 : 28 + ((index % 3) - 1) * 0.1
    };
    await new Promise((resolve, reject) => client.publish(topic, JSON.stringify(message), { qos: 1 },
      (error) => error ? reject(error) : resolve()));
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  console.log(`Published 12 baseline readings and one 43°C anomaly to ${topic}`);
} finally {
  await new Promise((resolve) => client.end(false, resolve));
}
