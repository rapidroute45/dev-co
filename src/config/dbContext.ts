import mongoose from 'mongoose';
import { AsyncLocalStorage } from 'async_hooks';
import { ENV, mongoDatabaseName } from './env';

export type DbEnvironment = 'test' | 'prod';

const storage = new AsyncLocalStorage<mongoose.Connection>();

let testConnection: mongoose.Connection | null = null;
let prodConnection: mongoose.Connection | null = null;

export function resolveDbEnvironment(header: string | string[] | undefined): DbEnvironment {
  const value = Array.isArray(header) ? header[0] : header;
  const normalized = value?.trim().toLowerCase();
  if (normalized === 'prod' || normalized === 'production') return 'prod';
  return 'test';
}

export function getConnectionForEnvironment(env: DbEnvironment): mongoose.Connection {
  const conn = env === 'prod' ? prodConnection : testConnection;
  if (!conn) {
    throw new Error('Database connections are not initialized.');
  }
  return conn;
}

export function getActiveConnection(): mongoose.Connection {
  const active = storage.getStore();
  if (active) return active;
  if (testConnection) return testConnection;
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  throw new Error('No active database connection.');
}

export function initDbEnvironmentConnections(): void {
  const testDbName = mongoDatabaseName(ENV.MONGO_URI_TEST);
  const prodDbName = mongoDatabaseName(ENV.MONGO_URI_PROD);

  testConnection = mongoose.connection.useDb(testDbName, { useCache: true });
  prodConnection = mongoose.connection.useDb(prodDbName, { useCache: true });

  console.log(`   Test database: ${testDbName}`);
  console.log(`   Prod database: ${prodDbName}`);
}

export function dbEnvironmentMiddleware(
  req: { headers: Record<string, string | string[] | undefined>; dbEnvironment?: DbEnvironment },
  _res: unknown,
  next: () => void
): void {
  const env = resolveDbEnvironment(req.headers['x-dispatch-environment']);
  req.dbEnvironment = env;
  storage.run(getConnectionForEnvironment(env), next);
}

export function withDbEnvironment<T>(env: DbEnvironment, fn: () => T): T {
  return storage.run(getConnectionForEnvironment(env), fn);
}
