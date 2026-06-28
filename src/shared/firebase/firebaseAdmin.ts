import fs from 'fs';
import { cert, getApps, initializeApp, type ServiceAccount } from 'firebase-admin/app';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';
import { ENV } from '../../config/env';

let initAttempted = false;

export function isFirebaseConfigured(): boolean {
  return Boolean(
    ENV.FIREBASE_PROJECT_ID &&
      (ENV.FIREBASE_SERVICE_ACCOUNT_JSON || ENV.FIREBASE_SERVICE_ACCOUNT_PATH)
  );
}

function loadServiceAccount(): ServiceAccount | null {
  try {
    if (ENV.FIREBASE_SERVICE_ACCOUNT_JSON) {
      return JSON.parse(ENV.FIREBASE_SERVICE_ACCOUNT_JSON) as ServiceAccount;
    }
    if (ENV.FIREBASE_SERVICE_ACCOUNT_PATH) {
      const raw = fs.readFileSync(ENV.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8');
      return JSON.parse(raw) as ServiceAccount;
    }
  } catch (error) {
    console.error('[firebase] Failed to load service account credentials', error);
  }
  return null;
}

export function getFirebaseMessaging(): Messaging | null {
  if (!isFirebaseConfigured()) return null;

  if (!initAttempted) {
    initAttempted = true;
    try {
      if (getApps().length === 0) {
        const serviceAccount = loadServiceAccount();
        if (!serviceAccount) return null;
        initializeApp({
          credential: cert(serviceAccount),
          projectId: ENV.FIREBASE_PROJECT_ID,
        });
        console.log('[firebase] Admin SDK initialized for project', ENV.FIREBASE_PROJECT_ID);
      }
    } catch (error) {
      console.error('[firebase] Admin SDK init failed', error);
      return null;
    }
  }

  if (getApps().length === 0) return null;
  return getMessaging();
}

/** Log Firebase Admin connectivity at server startup (does not send a push). */
export function logFirebaseStartupStatus(): void {
  console.log('[firebase] ─── push provider status ───');

  if (!isFirebaseConfigured()) {
    console.log(
      '[firebase] status: NOT CONFIGURED — set FIREBASE_PROJECT_ID and service account env vars'
    );
    console.log('[firebase] ─────────────────────────────');
    return;
  }

  const messaging = getFirebaseMessaging();
  if (messaging) {
    console.log('[firebase] status: CONNECTED');
    console.log('[firebase] project:', ENV.FIREBASE_PROJECT_ID);
    console.log('[firebase] Admin SDK ready to send FCM (Android)');
  } else {
    console.log('[firebase] status: NOT CONNECTED');
    console.log('[firebase] project:', ENV.FIREBASE_PROJECT_ID || '(missing)');
    console.log('[firebase] Check service account JSON path or FIREBASE_SERVICE_ACCOUNT_JSON');
  }

  console.log('[firebase] ─────────────────────────────');
}