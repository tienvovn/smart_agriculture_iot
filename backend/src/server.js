import dotenv from 'dotenv';
import app from './app.js';
import { connectDatabase } from './config/database.js';
import { hardwareBridgeService } from './services/HardwareBridgeService.js';
import { iotMvpService } from './services/IotMvpService.js';
import { telemetryPipelineService } from './services/TelemetryPipelineService.js';

dotenv.config();

const port = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDatabase();
    await telemetryPipelineService.start();

    app.listen(port, async () => {
      console.log(`Smart Farm IoT API running on port ${port}`);
      await iotMvpService.start();
      await hardwareBridgeService.start();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
