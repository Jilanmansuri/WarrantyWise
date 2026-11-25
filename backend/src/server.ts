import { createApp } from './app';
import { connectDatabase } from './config/db';
import { env } from './config/env';

async function bootstrap() {
  try {
    await connectDatabase(env.mongoUri);
    console.log('Connected to MongoDB');

    const app = createApp();
    app.listen(env.port, () => {
      console.log(`WarrantyWise API server running on port ${env.port} (${env.nodeEnv})`);
      console.log(`Document storage provider: ${env.storageProvider}`);
    });
  } catch (error) {
    console.error('Failed to start WarrantyWise server:', error);
    process.exit(1);
  }
}

bootstrap();
