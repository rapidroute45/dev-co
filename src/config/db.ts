import mongoose from 'mongoose';
import { ENV, mongoDatabaseName, redactMongoUri } from './env';
import { initDbEnvironmentConnections } from './dbContext';

export const connectDB = async (): Promise<void> => {
  try {
    const dbName = mongoDatabaseName(ENV.MONGO_URI);
    console.log(`🔌 Connecting to MongoDB (${ENV.APP_ENV})…`);
    console.log(`   Database: ${dbName}`);
    console.log(`   Host: ${redactMongoUri(ENV.MONGO_URI)}`);

    if (ENV.APP_ENV === 'production' && /test|dev|staging|sandbox/i.test(dbName)) {
      console.warn(
        '⚠️  APP_ENV=production but the database name looks non-production.',
        'Use a dedicated prod database (e.g. dispatch_prod).'
      );
    }

    await mongoose.connect(ENV.MONGO_URI);
    initDbEnvironmentConnections();
    console.log('🛡️ Database connected successfully.');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};
