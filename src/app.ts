import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import mongoose from 'mongoose';
import multer from 'multer';
import { authRoutes } from './modules/auth';
import { teamRoutes } from './modules/teams';
import { userRoutes } from './modules/users';
import { storeRoutes } from './modules/stores';
import { scheduleRoutes, routeRoutes, availabilityRoutes } from './modules/schedules';
import { dashboardRoutes } from './modules/dashboard';
import { notificationRoutes } from './modules/notifications';
import { driverDocumentRoutes } from './modules/driver-documents';
import { chatRoutes } from './modules/chat';
import { payrollRoutes } from './modules/payroll';
import { cityRoutes } from './modules/cities';
import { AppError } from './shared/errors/app-error';
import { UPLOADS_DIR } from './shared/upload/upload.config';
import { dbEnvironmentMiddleware } from './config/dbContext';

const app = express();

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
  origin: corsOrigins,
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Dispatch-Environment'],
}));

app.use(express.json());
app.use(cookieParser());
app.use(dbEnvironmentMiddleware);
app.use('/uploads', express.static(UPLOADS_DIR));

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/schedules', scheduleRoutes);
app.use('/api/v1/routes', routeRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/driver-documents', driverDocumentRoutes);
app.use('/api/v1/chat', chatRoutes);
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/cities', cityRoutes);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large (max 10MB).'
        : err.message || 'Upload failed.';
    res.status(400).json({ success: false, error: message });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    const message = Object.values(err.errors)
      .map((e) => e.message)
      .join(', ');
    res.status(400).json({ success: false, error: message || 'Validation failed' });
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: `Invalid ${err.path ?? 'value'}: ${String(err.value)}`,
    });
    return;
  }

  if ((err as { code?: number }).code === 11000) {
    const key = (err as { keyPattern?: Record<string, unknown> }).keyPattern;
    const message = key?.storeId
      ? 'Store ID already exists. Please try again.'
      : key?.code
        ? 'Team code already exists. Please try again.'
        : 'Email already in use';
    res.status(400).json({ success: false, error: message });
    return;
  }

  console.error(err);
  res.status(500).json({ success: false, error: 'Internal Server Error' });
});

export default app;