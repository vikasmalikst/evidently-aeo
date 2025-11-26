// Load environment variables from .env file
const path = require('path');
const fs = require('fs');

// Try to load dotenv if available
let dotenv;
try {
  dotenv = require('dotenv');
} catch (e) {
  console.warn('dotenv not found, trying to load from node_modules');
  try {
    dotenv = require(path.join(__dirname, 'node_modules', 'dotenv'));
  } catch (e2) {
    console.error('Could not load dotenv. Make sure it is installed: npm install dotenv');
  }
}

// Try multiple paths for .env file
const envPaths = [
  path.join(__dirname, '.env'),  // Relative path
  '/home/dev/projects/evidently/backend/.env',  // Absolute path
];

let envLoaded = false;
for (const envPath of envPaths) {
  if (dotenv && fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (result.error) {
      console.error('Error loading .env file:', result.error);
    } else {
      console.log('✅ Loaded .env file from:', envPath);
      envLoaded = true;
      break;
    }
  }
}

if (!envLoaded) {
  console.warn('⚠️  .env file not found. Tried paths:', envPaths);
  console.warn('   Make sure the .env file exists in the backend directory');
}

// Debug: Log if Supabase vars are loaded (this will show when PM2 reads the config)
if (process.env.SUPABASE_URL) {
  console.log('✅ SUPABASE_URL is loaded in ecosystem config');
} else {
  console.warn('⚠️  SUPABASE_URL is NOT loaded in ecosystem config');
}

module.exports = {
  apps: [
    {
      name: 'evidently-backend',
      script: './dist/app.js',
      cwd: '/home/dev/projects/evidently/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        // Load all environment variables from .env file
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        JWT_SECRET: process.env.JWT_SECRET,
        JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
        FRONTEND_URL: process.env.FRONTEND_URL,
        SITE_URL: process.env.SITE_URL,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        MODEL: process.env.MODEL,
        USE_OPENAI_WEBSEARCH: process.env.USE_OPENAI_WEBSEARCH,
        CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY,
        CEREBRAS_MODEL: process.env.CEREBRAS_MODEL,
        DATAFORSEO_USERNAME: process.env.DATAFORSEO_USERNAME,
        DATAFORSEO_PASSWORD: process.env.DATAFORSEO_PASSWORD,
        OXYLABS_USERNAME: process.env.OXYLABS_USERNAME,
        OXYLABS_PASSWORD: process.env.OXYLABS_PASSWORD,
        // Add any other environment variables your app needs
      },
      // Logging
      error_file: '/home/dev/logs/evidently-backend-error.log',
      out_file: '/home/dev/logs/evidently-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto-restart configuration
      watch: false,
      max_memory_restart: '1G',
      
      // Graceful shutdown
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,
      
      // Advanced settings
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
    },
  ],
};

