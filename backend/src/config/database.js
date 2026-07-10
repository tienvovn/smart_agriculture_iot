import mongoose from 'mongoose';

const defaultMongoUri = 'mongodb://127.0.0.1:27017/smart_farm_iot';

export async function connectDatabase(uri = process.env.MONGODB_URI || defaultMongoUri) {
  if (!uri) {
    throw new Error('MONGODB_URI is required');
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    autoIndex: process.env.NODE_ENV !== 'production'
  });

  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
