/** Browser origins allowed to call the API (credentials + custom headers). */
const LOCAL_DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:5173'];

/** Production web app deployments — merged with CORS_ORIGINS on every deploy. */
const DEPLOYED_WEB_ORIGINS = ['https://dev-lodgical.vercel.app'];

function parseEnvOrigins(): string[] {
  if (!process.env.CORS_ORIGINS?.trim()) return [];
  return process.env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function resolveCorsOrigins(): string[] {
  return [...new Set([...LOCAL_DEV_ORIGINS, ...DEPLOYED_WEB_ORIGINS, ...parseEnvOrigins()])];
}
