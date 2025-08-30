import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';

// Import routes
import authRoutes from './routes/auth';
import analysisRoutes from './routes/analysis';
import billingRoutes from './routes/billing';
import practiceManagementRoutes from './routes/practiceManagement';
import syncRoutes from './routes/sync';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());

// CORS configuration for production
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? [
        process.env.CORS_ORIGIN || '*',
        'chrome-extension://*',
        /^https:\/\/.*\.onrender\.com$/,
        'https://mail.google.com',
        'https://outlook.live.com',
        'https://outlook.office.com'
      ]
    : [
        'chrome-extension://*',
        'https://mail.google.com',
        'https://outlook.live.com',
        'https://outlook.office.com',
        'http://localhost:3000',
        'http://localhost:3001'
      ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Rate limiting
app.use(rateLimiter);

// Logging
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'involex-api',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Involex API',
    version: '1.0.0',
    description: 'AI-powered legal billing backend',
    status: 'running',
    documentation: '/health',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      analysis: '/api/analysis',
      billing: '/api/billing',
      practiceManagement: '/api/practice-management',
      sync: '/api/sync'
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/practice-management', practiceManagementRoutes);
app.use('/api/sync', syncRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  logger.info(`🚀 Involex API server running on port ${PORT}`);
  logger.info(`📧 Email analysis and billing API ready`);
  logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
});

export default app;
