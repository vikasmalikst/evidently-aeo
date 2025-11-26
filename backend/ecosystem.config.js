// Load environment variables from .env file
require('dotenv').config({ path: '/home/dev/projects/evidently/backend/.env' });

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

