import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import amcRoutes from './routes/amcRoutes';
import authRoutes from './routes/authRoutes';
import calendarRoutes from './routes/calendarRoutes';
import claimRoutes from './routes/claimRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import documentRoutes from './routes/documentRoutes';
import familyRoutes from './routes/familyRoutes';
import maintenanceRoutes from './routes/maintenanceRoutes';
import ocrRoutes from './routes/ocrRoutes';
import productRoutes from './routes/productRoutes';
import repairRoutes from './routes/repairRoutes';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  if (env.nodeEnv !== 'test') {
    app.use(morgan('dev'));
  }

  app.get('/health', (_req, res) => {
    res.json({
      success: true,
      service: 'warrantywise-api',
      storageProvider: env.storageProvider,
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/products', productRoutes);
  app.use('/api/repairs', repairRoutes);
  app.use('/api/documents', documentRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/ocr', ocrRoutes);
  app.use('/api/amc', amcRoutes);
  app.use('/api/maintenance', maintenanceRoutes);
  app.use('/api/claims', claimRoutes);
  app.use('/api/family', familyRoutes);
  app.use('/api/calendar', calendarRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
