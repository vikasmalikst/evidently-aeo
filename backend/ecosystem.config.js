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

