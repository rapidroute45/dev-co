import mongoose from 'mongoose';
import { ENV } from './env';

export const connectDB = async (): Promise<void> => {
  try {
    console.log('🔌 Connecting to the database...');
    console.log(`🔗 MongoDB URI: ${ENV.MONGO_URI}`);
    await mongoose.connect(ENV.MONGO_URI);
    console.log('🛡️ Database connected successfully.');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};