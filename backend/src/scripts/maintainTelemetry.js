import dotenv from 'dotenv';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { archiveTelemetryDay, rollupTelemetryDay, rollupTelemetryMonth, runTelemetryCycle } from '../services/TelemetryRetentionService.js';

dotenv.config();

function argumentsFor(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const [key, inlineValue] = arg.slice(2).split('=');
    result[key] = inlineValue ?? argv[++index];
    if (!result[key] || result[key].startsWith('--')) throw new Error(`Missing value for --${key}`);
  }
  return result;
}

const args = argumentsFor(process.argv.slice(2));
const mode = args.mode || 'rollup';
if (!['rollup', 'archive', 'monthly', 'cycle'].includes(mode)) throw new Error('mode must be rollup, monthly, archive, or cycle');
if ((mode === 'monthly' && !args.month) || (['rollup', 'archive'].includes(mode) && !args.day)) {
  throw new Error('Usage: --mode cycle, --mode rollup|archive --day YYYY-MM-DD, or --mode monthly --month YYYY-MM');
}

try {
  await connectDatabase();
  const options = { day: args.day, farmCode: args['farm-code'] };
  let result;
  if (mode === 'cycle') result = await runTelemetryCycle();
  else if (mode === 'rollup') result = await rollupTelemetryDay(options);
  else if (mode === 'monthly') result = await rollupTelemetryMonth({ month: args.month, farmCode: args['farm-code'] });
  else result = await archiveTelemetryDay({ ...options, outputDir: args['output-dir'] });
  console.log(JSON.stringify(result, null, 2));
} finally {
  await disconnectDatabase();
}
