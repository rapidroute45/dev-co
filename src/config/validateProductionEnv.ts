import { ENV } from './env';

const WEAK_JWT_SECRETS = new Set([
  'super-secret-key-change-me',
  'change-me',
  '',
]);

const LOCALHOST_MONGO_FALLBACK = 'mongodb://localhost:27017/dispatch_prod';
const DEFAULT_OPS_PIN = '4545';

function fail(message: string): never {
  console.error(`[production] ${message}`);
  process.exit(1);
}

/** Fail fast when production is misconfigured. No-op in development. */
export function validateProductionEnv(): void {
  if (ENV.APP_ENV !== 'production') return;

  const jwt = process.env.JWT_ACCESS_SECRET?.trim() ?? '';
  if (!jwt || WEAK_JWT_SECRETS.has(jwt)) {
    fail('JWT_ACCESS_SECRET must be set to a strong value in production.');
  }

  const prodUri = process.env.MONGODB_URI_PROD?.trim() ?? '';
  if (!prodUri || prodUri === LOCALHOST_MONGO_FALLBACK) {
    fail('MONGODB_URI_PROD must be set to your production MongoDB URI.');
  }

  const dispatchPin = process.env.OPS_DISPATCH_ELEVATION_PIN?.trim() ?? '';
  const payrollPin = process.env.OPS_PAYROLL_ELEVATION_PIN?.trim() ?? '';
  if (!dispatchPin || dispatchPin === DEFAULT_OPS_PIN) {
    fail('OPS_DISPATCH_ELEVATION_PIN must be set to a non-default value in production.');
  }
  if (!payrollPin || payrollPin === DEFAULT_OPS_PIN) {
    fail('OPS_PAYROLL_ELEVATION_PIN must be set to a non-default value in production.');
  }
}

export { DEFAULT_OPS_PIN };

/** After DB connect — reject production DB still using default ops PINs. */
export async function validateProductionAppSettings(
  findSettings: () => Promise<{ dispatchElevationPin: string; payrollElevationPin: string } | null>
): Promise<void> {
  if (ENV.APP_ENV !== 'production') return;

  const settings = await findSettings();
  if (!settings) return;

  if (
    settings.dispatchElevationPin === DEFAULT_OPS_PIN ||
    settings.payrollElevationPin === DEFAULT_OPS_PIN
  ) {
    fail(
      'AppSettings in the production database still uses default ops PIN 4545. Update pins before starting.'
    );
  }
}
