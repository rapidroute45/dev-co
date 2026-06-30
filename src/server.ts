import http from 'http';
import app from './app';
import { ENV } from './config/env';
import { connectDB } from './config/db';
import { logFirebaseStartupStatus } from './shared/firebase/firebaseAdmin';
import { logGoogleMapsStartupStatus } from './shared/google/logGoogleMapsStartupStatus';
import { chatService, initChatSocket } from './modules/chat';
import { startRouteBackgroundJobs } from './modules/schedules';
import {
  validateProductionAppSettings,
  validateProductionEnv,
} from './config/validateProductionEnv';
import { AppSettingsRepository } from './modules/auth/infrastructure/repositories/appSettings.repository';

const startServer = async () => {
  validateProductionEnv();
  await connectDB();
  await validateProductionAppSettings(() => new AppSettingsRepository().findExisting());
  startRouteBackgroundJobs();
  logFirebaseStartupStatus();
  await logGoogleMapsStartupStatus();

  const httpServer = http.createServer(app);
  initChatSocket(httpServer, chatService);

  httpServer.listen(ENV.PORT, () => {
    console.log(
      `🚀 Dispatch System (${ENV.APP_ENV}) running on http://localhost:${ENV.PORT}`
    );
  });
};

startServer();
