// Load environment variables from .env file
// This MUST happen before module.exports so PM2 can read the env vars
const path = require('path');
const fs = require('fs');

// Load dotenv - try multiple locations
let dotenv;
const dotenvPaths = [
  'dotenv',  // Try from node_modules (normal require)
  path.join(__dirname, 'node_modules', 'dotenv'),  // Try relative path
];

for (const dotenvPath of dotenvPaths) {
  try {
    dotenv = require(dotenvPath);
    console.error('✅ dotenv loaded from:', dotenvPath);
    break;
  } catch (e) {
    // Continue to next path
  }
}

if (!dotenv) {
  console.error('❌ ERROR: dotenv package not found!');
  console.error('   Tried paths:', dotenvPaths);
  console.error('   Run: cd /home/dev/projects/evidently/backend && npm install dotenv');
  // Don't exit - let PM2 show the error
}

// Try multiple paths for .env file
const envPaths = [
  path.join(__dirname, '.env'),  // Relative to ecosystem.config.js location
  '/home/dev/projects/evidently/backend/.env',  // Absolute path
];

let envLoaded = false;
let loadedPath = null;

console.error('🔍 Looking for .env file...');
console.error('   __dirname:', __dirname);
console.error('   Checking paths:', envPaths);

if (!dotenv) {
  console.error('❌ Cannot load .env file - dotenv package not available');
} else {
  for (const envPath of envPaths) {
    console.error('   Checking:', envPath, '-', fs.existsSync(envPath) ? 'EXISTS' : 'NOT FOUND');
    if (fs.existsSync(envPath)) {
      const result = dotenv.config({ path: envPath });
      if (result.error) {
        console.error('❌ Error loading .env file from', envPath, ':', result.error.message);
      } else {
        envLoaded = true;
        loadedPath = envPath;
        // Log to stderr so it shows in PM2 output
        console.error('✅ Loaded .env file from:', envPath);
        console.error('   Loaded', Object.keys(result.parsed || {}).length, 'variables');
        break;
      }
    }
  }

  if (!envLoaded) {
    console.error('❌ ERROR: .env file not found!');
    console.error('   Tried paths:', envPaths);
    console.error('   Make sure the .env file exists in the backend directory');
  }
}

// Verify critical env vars are loaded
const requiredVars = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'JWT_SECRET'];
const missingVars = requiredVars.filter(v => !process.env[v]);

console.error('🔍 Checking for required environment variables...');
requiredVars.forEach(v => {
  console.error('   ', v, ':', process.env[v] ? '✅ FOUND' : '❌ MISSING');
});

if (missingVars.length > 0) {
  console.error('❌ ERROR: Missing required environment variables:', missingVars.join(', '));
  if (loadedPath) {
    console.error('   Check your .env file at:', loadedPath);
  }
} else {
  // Log success (to stderr so PM2 shows it)
  console.error('✅ All required environment variables loaded successfully');
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
    {
      name: 'job-scheduler',
      script: 'node_modules/.bin/ts-node',
      args: '--transpile-only src/cron/unified-job-scheduler.ts',
      cwd: '/home/dev/projects/evidently/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // Load all environment variables from .env file
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        JOB_SCHEDULER_POLL_MS: process.env.JOB_SCHEDULER_POLL_MS || '60000', // 60 seconds default
        JOB_SCHEDULER_BATCH: process.env.JOB_SCHEDULER_BATCH || '25', // Max jobs per tick
      },
      // Logging
      error_file: '/home/dev/logs/job-scheduler-error.log',
      out_file: '/home/dev/logs/job-scheduler-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto-restart configuration
      watch: false,
      max_memory_restart: '500M',
      
      // Advanced settings
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
    },
    {
      name: 'job-worker',
      script: 'node_modules/.bin/ts-node',
      args: '--transpile-only src/cron/unified-job-worker.ts',
      cwd: '/home/dev/projects/evidently/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // Load all environment variables from .env file
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        JOB_WORKER_POLL_MS: process.env.JOB_WORKER_POLL_MS || '30000', // 30 seconds default
        JOB_WORKER_BATCH: process.env.JOB_WORKER_BATCH || '5', // Max runs per tick
      },
      // Logging
      error_file: '/home/dev/logs/job-worker-error.log',
      out_file: '/home/dev/logs/job-worker-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto-restart configuration
      watch: false,
      max_memory_restart: '1G',
      
      // Advanced settings
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
    },
    {
      name: 'query-execution-cleanup',
      script: 'node_modules/.bin/ts-node',
      args: '--transpile-only src/cron/queryExecutionCleanup.cron.ts',
      cwd: '/home/dev/projects/evidently/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // Load all environment variables from .env file
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
        QUERY_EXECUTION_CLEANUP_INTERVAL_MS: process.env.QUERY_EXECUTION_CLEANUP_INTERVAL_MS || '300000', // 5 minutes default
      },
      // Logging
      error_file: '/home/dev/logs/query-execution-cleanup-error.log',
      out_file: '/home/dev/logs/query-execution-cleanup-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Auto-restart configuration
      watch: false,
      max_memory_restart: '500M',
      
      // Advanced settings
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
    },
  ],
};

