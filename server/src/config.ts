import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  jwtSecret: process.env.JWT_SECRET || 'restaurant-jwt-super-secret-key-2026',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h',
  dbPath: process.env.DATABASE_URL || path.resolve(__dirname, '../../restaurant.db'),
  clientDistPath: path.resolve(__dirname, '../../client/dist'),
  isDev: process.env.NODE_ENV !== 'production'
};
