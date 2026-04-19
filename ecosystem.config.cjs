// PM2 生态配置文件
// 使用方式：pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'fezer-api',
      script: './dist/index.js',
      instances: 1, // 可以设置为 'max' 使用集群模式
      exec_mode: 'fork', // 集群模式使用 'cluster'
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true,
      // 自动重启配置
      watch: false,
      max_memory_restart: '500M',
      // 环境变量从 .env 文件加载
      env_file: '.env',
    },
  ],
};
