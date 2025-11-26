import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config();

// Also try to load from env.example as fallback for development
if (process.env['NODE_ENV'] === 'development') {
  dotenv.config({ path: path.join(__dirname, '../../env.example') });
}

// Environment validation
const requiredEnvVars = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'JWT_SECRET'
];

// Check for required environment variables
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(`Missing required environment variable: ${envVar}`);
  }
}

// Environment configuration
export const config = {
  // Server
  port: parseInt(process.env['PORT'] || '3000', 10),
  nodeEnv: process.env['NODE_ENV'] || 'development',
  
  // Supabase
  supabase: {
    url: process.env['SUPABASE_URL']!,
    anonKey: process.env['SUPABASE_ANON_KEY']!,
    serviceRoleKey: process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  },
  
  // JWT
  jwt: {
    secret: process.env['JWT_SECRET']!,
    expiresIn: process.env['JWT_EXPIRES_IN'] || '7d',
  },
  
  // CORS
  cors: {
    origin: [
      process.env['FRONTEND_URL'] || 'http://localhost:5173',
      'http://localhost:5176', // Main frontend port
      'http://192.168.1.18:5174', // Admin portal
      'http://localhost:5174', // Admin portal local
      'http://192.168.1.18:5173', // Main portal network
      'http://85.239.244.166', // VPS IP address (HTTP)
      'http://85.239.244.166:80', // VPS IP address with port
      'https://85.239.244.166', // VPS IP address (HTTPS)
    ],
    credentials: true,
  },
  
  // OpenAI
  openai: {
    apiKey: process.env['OPENAI_API_KEY'],
    model: process.env['MODEL'] || 'gpt-4o-mini',
    useWebSearch: process.env['USE_OPENAI_WEBSEARCH'] === 'true',
  },
  
  // Cerebras
  cerebras: {
    apiKey: process.env['CEREBRAS_API_KEY'],
    model: process.env['CEREBRAS_MODEL'] || 'qwen-3-235b-a22b-instruct-2507',
  },
  
  // DataForSEO
  dataforseo: {
    username: process.env['DATAFORSEO_USERNAME'],
    password: process.env['DATAFORSEO_PASSWORD'],
  },
  
  // Oxylabs
  oxylabs: {
    username: process.env['OXYLABS_USERNAME'],
    password: process.env['OXYLABS_PASSWORD'],
  },
  
  // Site
  siteUrl: process.env['SITE_URL'] || 'http://localhost:3000',
  
  // Development
  bypassAuthInDev: process.env['BYPASS_AUTH_IN_DEV'] === 'true' && process.env['NODE_ENV'] === 'development',
};

export default config;
