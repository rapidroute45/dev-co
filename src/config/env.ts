import dotenv from 'dotenv';
dotenv.config();

export const ENV = {
  PORT: process.env.PORT || 5000,
  MONGO_URI: process.env.MONGODB_URI || 'mongodb://localhost:2017/dispatch_db',
  JWT_SECRET: process.env.JWT_ACCESS_SECRET || 'super-secret-key-change-me',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '7d',
  /** Login cookie lifetime — keep in sync with JWT access token */
  SESSION_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
};