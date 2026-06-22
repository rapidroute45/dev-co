import { Schema, Model } from 'mongoose';
import { getActiveConnection } from '../../config/dbContext';

/** Model proxy that reads/writes the DB selected by X-Dispatch-Environment. */
export function createScopedModel<T>(name: string, schema: Schema): Model<T> {
  return new Proxy({} as Model<T>, {
    get(_target, prop) {
      const conn = getActiveConnection();
      const model = (conn.models[name] as Model<T> | undefined) ?? conn.model<T>(name, schema);
      const value = (model as unknown as Record<string | symbol, unknown>)[prop as string];
      if (typeof value === 'function') {
        return (value as (...args: unknown[]) => unknown).bind(model);
      }
      return value;
    },
  });
}
