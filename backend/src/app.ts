import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/environment';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

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
// TEMPORARY: Admin routes commented out
// import adminRoutes from './routes/admin.routes';
// import userManagementRoutes from './routes/user-management.routes';

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting - More lenient for development
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs (increased for development)
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: config.cors.origin,
  credentials: config.cors.credentials,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

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
app.use('/api/auth', authRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/query-generation', queryGenerationRoutes);
app.use('/api/trending-keywords', trendingKeywordsRoutes);
app.use('/api/data-collection', dataCollectionRoutes);
app.use('/api/keywords', keywordGenerationRoutes);
app.use('/api/citations', citationCategorizationRoutes);
app.use('/api', promptManagementRoutes);
// TEMPORARY: Admin routes commented out
// app.use('/api/admin', adminRoutes);
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
        // TEMPORARY: Admin routes commented out
        // admin: '/api/admin',
        // users: '/api/users'
      }
  });
});

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`🚀 AnswerIntel Backend running on port ${PORT}`);
  console.log(`📊 Environment: ${config.nodeEnv}`);
  console.log(`🔗 CORS enabled for: ${config.cors.origin}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/api`);
});

export default app;
