/**
 * PM2 Ecosystem Configuration for kinetic-portfolio backend
 * 
 * Usage:
 *   pm2 start ops/ecosystem.config.cjs
 *   pm2 reload ops/ecosystem.config.cjs --env production
 *   pm2 delete kinetic-portfolio
 * 
 * Startup persistence (run ONCE after first deploy):
 *   pm2 save
 *   pm2 startup  # Follow output instructions for systemd integration
 */
module.exports = {
  apps: [
    {
      name: "kinetic-portfolio",
      script: "./dist/index.js",
      cwd: "/var/www/kinetic-portfolio",
      
      // Production environment
      node_args: "--experimental-specifier-resolution=node",
      env_production: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      
      // Cluster mode for multi-core utilization
      instances: "max",
      exec_mode: "cluster",
      
      // Auto-restart settings
      watch: false,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 4000,
      
      // Memory management
      max_memory_restart: "512M",
      
      // Logging
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "/var/log/kinetic-portfolio/error.log",
      out_file: "/var/log/kinetic-portfolio/out.log",
      merge_logs: true,
      
      // Graceful shutdown
      kill_timeout: 5000,
      listen_timeout: 10000,
      
      // Health check (used by PM2 monitoring)
      exp_backoff_restart_delay: 100,
    },
  ],
};
