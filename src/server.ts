import app from './app';
import { ENV } from './config/env';
import { connectDB } from './config/db';

const startServer = async () => {
  await connectDB();
  
  app.listen(ENV.PORT, () => {
    console.log(`🚀 Dispatch System running on http://localhost:${ENV.PORT}`);
  });
};

startServer();