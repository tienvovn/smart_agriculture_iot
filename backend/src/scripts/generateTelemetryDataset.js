import fs from 'node:fs';
import { once } from 'node:events';
import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { Telemetry } from '../models/index.js';
import { createDatasetDigest, createTelemetryGenerator, estimateDataset, validateTelemetryDocument } from '../data/telemetryDataset.js';

dotenv.config();

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('--')) continue;
    const [rawKey, inlineValue] = argument.slice(2).split('=');
    if (inlineValue !== undefined) result[rawKey] = inlineValue;
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) result[rawKey] = argv[++index];
    else result[rawKey] = true;
  }
  return result;
}

function toOptions(args) {
  return {
    targetGiB: Number(args['target-gib'] || 100),
    farmCount: Number(args.farms || 2500),
    intervalSeconds: Number(args['interval-seconds'] || 10),
    seed: args.seed || 'farmguard-100gb-v1',
    startAt: args['start-at'] || '2026-10-10T12:00:00.000Z'
  };
}

async function writeLine(stream, line) {
  if (!stream.write(line)) await once(stream, 'drain');
}

const args = parseArguments(process.argv.slice(2));
const mode = args.mode || 'estimate';
const options = toOptions(args);
const plan = estimateDataset(options);

if (mode === 'estimate') {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

if (!['mongo', 'ndjson'].includes(mode)) throw new Error('mode must be estimate, mongo, or ndjson');
if (options.targetGiB > 1 && !args['confirm-large-write']) {
  throw new Error('Large writes require --confirm-large-write. Run --mode estimate first and verify available capacity.');
}

const batchSize = Math.max(100, Number(args['batch-size'] || 5000));
const outputPath = args.output || `farmguard-telemetry-${plan.datasetId}.ndjson`;
const generator = createTelemetryGenerator(options);
const digest = createDatasetDigest();
let logicalBytes = 0;
let documents = 0;
let batch = [];
let stream;

try {
  if (mode === 'mongo') {
    await connectDatabase();
    await Telemetry.createCollection().catch((error) => {
      if (error.code !== 48 && error.codeName !== 'NamespaceExists') throw error;
    });
  } else {
    stream = fs.createWriteStream(outputPath, { flags: 'wx', encoding: 'utf8' });
  }

  while (logicalBytes < plan.targetLogicalBsonBytes) {
    const { document, bsonBytes } = generator.next();
    const validationErrors = validateTelemetryDocument(document);
    if (validationErrors.length > 0) throw new Error(`Generated invalid document: ${validationErrors.join(', ')}`);
    digest.update(document);
    logicalBytes += bsonBytes;
    documents += 1;

    if (mode === 'mongo') {
      batch.push(document);
      if (batch.length >= batchSize) {
        await Telemetry.collection.insertMany(batch, { ordered: false });
        batch = [];
      }
    } else {
      await writeLine(stream, `${JSON.stringify(document)}\n`);
    }

    if (documents % (batchSize * 20) === 0) {
      const percent = (logicalBytes / plan.targetLogicalBsonBytes * 100).toFixed(2);
      console.log(`progress=${percent}% documents=${documents} logicalGiB=${(logicalBytes / 1024 ** 3).toFixed(3)}`);
    }
  }

  if (batch.length > 0) await Telemetry.collection.insertMany(batch, { ordered: false });
  if (stream) await new Promise((resolve, reject) => stream.end((error) => error ? reject(error) : resolve()));

  const manifest = {
    ...plan,
    generatedDocuments: documents,
    generatedLogicalBsonBytes: logicalBytes,
    sha256: digest.digest(),
    mode,
    output: mode === 'ndjson' ? outputPath : process.env.MONGODB_URI,
    completedAt: new Date().toISOString()
  };

  if (mode === 'mongo') await Telemetry.db.collection('dataset_manifests').insertOne(manifest);
  else fs.writeFileSync(`${outputPath}.manifest.json`, JSON.stringify(manifest, null, 2), { flag: 'wx' });
  console.log(JSON.stringify(manifest, null, 2));
} finally {
  if (mode === 'mongo') await disconnectDatabase();
}
