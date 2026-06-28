import http from 'http';
import app from './app';
import { ENV } from './config/env';
import { connectDB } from './config/db';
import { logFirebaseStartupStatus } from './shared/firebase/firebaseAdmin';
import { chatService, initChatSocket } from './modules/chat';

const startServer = async () => {
  await connectDB();
  logFirebaseStartupStatus();

  const httpServer = http.createServer(app);
  initChatSocket(httpServer, chatService);

  httpServer.listen(ENV.PORT, () => {
    console.log(
      `🚀 Dispatch System (${ENV.APP_ENV}) running on http://localhost:${ENV.PORT}`
    );
  });
};

startServer();
