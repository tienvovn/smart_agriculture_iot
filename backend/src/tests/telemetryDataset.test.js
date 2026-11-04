import assert from 'node:assert/strict';
import { createDatasetDigest, createTelemetryGenerator, estimateDataset, validateTelemetryDocument } from '../data/telemetryDataset.js';

function generateDigest(seed, documents = 10000) {
  const generator = createTelemetryGenerator({ seed, farmCount: 3, intervalSeconds: 2 });
  const digest = createDatasetDigest();
  let previousTimestamp = 0;
  for (let index = 0; index < documents; index += 1) {
    const { document } = generator.next();
    assert.deepEqual(validateTelemetryDocument(document), []);
    assert.ok(document.capturedAt.getTime() >= previousTimestamp);
    previousTimestamp = document.capturedAt.getTime();
    digest.update(document);
  }
  return digest.digest();
}

const first = generateDigest('repeatable-seed');
const second = generateDigest('repeatable-seed');
const different = generateDigest('different-seed');
assert.equal(first, second, 'The same seed must produce exactly the same BSON stream');
assert.notEqual(first, different, 'Different seeds should produce different data');

const plan = estimateDataset({ targetGiB: 100, farmCount: 2500, intervalSeconds: 10, seed: 'farmguard-100gb-v1' });
assert.equal(plan.targetLogicalBsonBytes, 100 * 1024 ** 3);
assert.ok(plan.estimatedDocuments > 100_000_000);
assert.ok(plan.simulatedDurationDays > 4 && plan.simulatedDurationDays <= 6);
console.log(JSON.stringify({ message: 'Telemetry dataset test passed', plan }, null, 2));
