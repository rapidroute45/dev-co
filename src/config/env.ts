import dotenv from 'dotenv';
dotenv.config();

export type AppEnv = 'development' | 'production';

function normalizeAppEnv(value: string | undefined): AppEnv {
  if (value === 'production' || value === 'prod') return 'production';
  return 'development';
}

const APP_ENV = normalizeAppEnv(process.env.APP_ENV || process.env.NODE_ENV);

/**
 * Two databases configured side by side:
 *   MONGODB_URI_TEST → used in development
 *   MONGODB_URI_PROD → used in production
 * Falls back to the legacy single MONGODB_URI if a specific one is missing.
 */
const TEST_URI =
  process.env.MONGODB_URI_TEST ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/dispatch_test';

const PROD_URI =
  process.env.MONGODB_URI_PROD ||
  process.env.MONGODB_URI ||
  'mongodb://localhost:27017/dispatch_prod';

export const ENV = {
  APP_ENV,
  PORT: Number(process.env.PORT) || 4000,
  MONGO_URI: APP_ENV === 'production' ? PROD_URI : TEST_URI,
  MONGO_URI_TEST: TEST_URI,
  MONGO_URI_PROD: PROD_URI,
  JWT_SECRET: process.env.JWT_ACCESS_SECRET || 'super-secret-key-change-me',
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || '7d',
  /** Login cookie lifetime — keep in sync with JWT access token */
  SESSION_MAX_AGE_MS: 7 * 24 * 60 * 60 * 1000,
  /** Firebase Cloud Messaging (optional — push skipped when unset) */
  FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID?.trim() || '',
  FIREBASE_SERVICE_ACCOUNT_JSON: process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() || '',
  FIREBASE_SERVICE_ACCOUNT_PATH: process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim() || '',
  /** Origin for web push click URLs, e.g. https://app.example.com */
  WEB_APP_ORIGIN: process.env.WEB_APP_ORIGIN?.trim().replace(/\/$/, '') || '',
};

/** Extract database name from a MongoDB URI for logging (never log credentials). */
export function mongoDatabaseName(uri: string): string {
  const withoutQuery = uri.split('?')[0] ?? uri;
  const segments = withoutQuery.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  if (!last || last.includes('@') || last.includes(':')) {
    return '(default — no database in URI)';
  }
  return last;
}

export function redactMongoUri(uri: string): string {
  return uri.replace(/\/\/([^:/@]+):([^@]+)@/, '//$1:****@');
}
