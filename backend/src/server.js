import dotenv from 'dotenv';
import app from './app.js';
import { connectDatabase } from './config/database.js';

dotenv.config();

const port = process.env.PORT || 5000;

async function startServer() {
  try {
    await connectDatabase();

    app.listen(port, () => {
      console.log(`Smart Farm IoT API running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
