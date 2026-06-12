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
        ALLOWED_ORIGINS: 'https://fezeryang.github.io,https://fezeryang.github.io/fezer,http://localhost:5173',
        AI_PRIMARY_PROVIDER: 'deepseek',
        AI_PRIMARY_MODEL: 'deepseek-chat',
        AI_FALLBACK_PROVIDER: 'deepseek',
        AI_FALLBACK_MODEL: 'deepseek-chat',
        DEEPSEEK_BASE_URL: 'https://api.deepseek.com/v1',
        AI_MAX_TOKENS: '2048',
        AI_REQUEST_TIMEOUT_MS: '60000',
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
