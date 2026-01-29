import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

// Import database module early to ensure Supabase configuration is logged at startup
import './config/database';

// Import routes
import authRoutes from './routes/auth.routes';
import brandRoutes from './routes/brand.routes';
import queryGenerationRoutes from './routes/query-generation.routes';
import trendingKeywordsRoutes from './routes/trending-keywords.routes';
import dataCollectionRoutes from './routes/data-collection.routes';
import keywordGenerationRoutes from './routes/keyword-generation.routes';
import citationCategorizationRoutes from './routes/citation-categorization.routes';
import onboardingRoutes from './routes/onboarding.routes';
import promptManagementRoutes from './routes/prompt-management.routes';
import adminRoutes from './routes/admin.routes';
import aeoScoringRoutes from './routes/aeo-scoring.routes';

import recommendationsV3Routes from './routes/recommendations-v3.routes';
import moversShakersRoutes from './routes/movers-shakers.routes';
import domainReadinessRoutes from './services/domain-readiness/routes';
import executiveReportingRoutes from './routes/executive-reporting.routes';
import { contactRouter } from './routes/contact.routes';
import reportSettingsRoutes from './routes/report-settings.routes';
import { opportunityIdentifierRouter as opportunityIdentifierRoutes } from './modules/opportunity-identifier';
import toolsRoutes from './routes/tools.routes';
// TEMPORARY: User management routes commented out
// import userManagementRoutes from './routes/user-management.routes';

const app = express();

// CORS configuration - MUST be before other middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins = Array.isArray(config.cors.origin)
      ? config.cors.origin
      : [config.cors.origin];

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // In development, log the origin for debugging
      if (config.nodeEnv === 'development') {
        console.warn(`⚠️  CORS: Blocked origin: ${origin}`);
        console.log(`   Allowed origins:`, allowedOrigins);
      }
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'x-timezone-offset', 'X-Impersonate-Customer', 'x-impersonate-customer'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
  preflightContinue: false,
}));

// Security middleware - Configure Helmet to work with CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
}));

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // limit each IP to 5000 requests per windowMs (very lenient for development)
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (config.nodeEnv === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    success: true,
    message: 'AnswerIntel Backend is healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// Disable caching for all API responses
app.use('/api', (_req, res, next) => {
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  next();
});

// API routes
app.use('/api', executiveReportingRoutes); // Register specific routes first to avoid conflicts
app.use('/api/auth', authRoutes);
app.use('/api/contact', contactRouter);
app.use('/api/brands', brandRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/query-generation', queryGenerationRoutes);
app.use('/api/trending-keywords', trendingKeywordsRoutes);
app.use('/api/data-collection', dataCollectionRoutes);
app.use('/api/keywords', keywordGenerationRoutes);
app.use('/api/citations', citationCategorizationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', promptManagementRoutes);

app.use('/api/recommendations-v3', recommendationsV3Routes);
app.use('/api/movers-shakers', moversShakersRoutes);
app.use('/api', domainReadinessRoutes);
app.use('/api/report-settings', reportSettingsRoutes);
app.use('/api', opportunityIdentifierRoutes);
app.use('/api/tools', toolsRoutes);
app.use('/api/aeo', aeoScoringRoutes);


// TEMPORARY: User management routes commented out
// app.use('/api/users', userManagementRoutes);

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'AnswerIntel Backend API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      brands: '/api/brands',
      queryGeneration: '/api/query-generation',
      trendingKeywords: '/api/trending-keywords',
      dataCollection: '/api/data-collection',
      keywords: '/api/keywords',
      citations: '/api/citations',
      admin: '/api/admin',

      // TEMPORARY: User management routes commented out
      // users: '/api/users'
    }
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server with error handling
const PORT = config.port;

try {
  const server = app.listen(PORT, () => {
    console.log(`🚀 AnswerIntel Backend running on port ${PORT}`);
    console.log(`📊 Environment: ${config.nodeEnv}`);
    console.log(`🔗 CORS enabled for: ${config.cors.origin}`);
    console.log(`📝 API Documentation: http://localhost:${PORT}/api`);
  });

  // Handle server errors
  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} is already in use`);
      console.error('   Please stop the process using this port or change the PORT environment variable');
    } else {
      console.error('❌ Server error:', error);
    }
    process.exit(1);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('❌ Uncaught Exception:', error);
    console.error(error.stack);
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown, promise: Promise<unknown>) => {
    console.error('❌ Unhandled Rejection at:', promise);
    console.error('❌ Reason:', reason);
    process.exit(1);
  });

} catch (error) {
  console.error('❌ Failed to start server:', error);
  if (error instanceof Error) {
    console.error('❌ Error message:', error.message);
    console.error('❌ Stack trace:', error.stack);
  }
  process.exit(1);
}

export default app;
