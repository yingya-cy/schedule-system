// PM2 集群配置文件 - 适配 2核/4GiB 服务器
// 使用方式: pm2 start ecosystem.config.cjs

module.exports = {
  apps: [
    {
      name: 'schedule-backend',
      script: 'node_modules/.bin/tsx.cmd',
      args: 'server.ts',
      instances: 2,  // 匹配 CPU 核数
      exec_mode: 'cluster',
      env_production: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      // 开机自启
      autorestart: true,
      // 进程异常退出后等待时间（秒）
      wait_backoff: 30,
      // 超过内存限制后重启（1.5GB）
      max_memory_restart: '1500M',
      // 日志配置
      log_file: 'logs/pm2-backend.log',
      error_file: 'logs/pm2-backend-error.log',
      out_file: 'logs/pm2-backend-out.log',
      // 日志滚动大小（10MB）
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      // 合并日志
      merge_logs: true,
      // 监控
      monitor: true,
      // 杀掉超时（30秒）
      kill_timeout: 30000,
      // 优雅重启
      listen_timeout: 30000,
      // 重启延迟（1秒）
      restart_delay: 1000
    }
  ]
};
