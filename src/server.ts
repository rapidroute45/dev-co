import http from 'http';
import app from './app';
import { ENV } from './config/env';
import { connectDB } from './config/db';
import { chatService, initChatSocket } from './modules/chat';

const startServer = async () => {
  await connectDB();

  const httpServer = http.createServer(app);
  initChatSocket(httpServer, chatService);

  httpServer.listen(ENV.PORT, () => {
    console.log(`🚀 Dispatch System running on http://localhost:${ENV.PORT}`);
  });
};

startServer();