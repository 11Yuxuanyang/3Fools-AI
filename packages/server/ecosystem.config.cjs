module.exports = {
  apps: [
    {
      name: 'canvasai',
      script: 'npx',
      args: 'tsx src/index.ts',
      cwd: '/www/wwwroot/canvasai/packages/server',
      env: {
        NODE_ENV: 'production',
      },
      // 日志配置
      error_file: '/www/wwwroot/canvasai/logs/error.log',
      out_file: '/www/wwwroot/canvasai/logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // 自动重启配置
      max_restarts: 10,
      restart_delay: 3000,
      // 监控配置
      max_memory_restart: '500M',
    },
  ],
};
