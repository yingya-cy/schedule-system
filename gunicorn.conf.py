# Gunicorn 配置文件 - 适配 2核/4GiB 服务器
# 使用方式: gunicorn -c gunicorn.conf.py app:app

import multiprocessing
import os

# 监听地址和端口
bind = "0.0.0.0:5002"

# Worker 进程数 = CPU核心数 + 1 (2核 CPU = 3 workers)
workers = multiprocessing.cpu_count() * 2 + 1  # 最佳实践公式

# Worker 类型：sync 用于 CPU 密集型 OCR 任务
worker_class = "sync"

# 每个 worker 的线程数（sync 模式下建议 1）
threads = 1

# 超时设置（5分钟，支持 OCR 大文件处理）
timeout = 300

# Keep-Alive 超时
keepalive = 5

# 日志配置
accesslog = "-"  # 输出到 stdout
errorlog = "-"    # 输出到 stderr
loglevel = "info"

# 日志格式
access_log_format = '%(h)s %(l)s %(u)s %(t)s "%(r)s" %(s)s %(b)s "%(f)s" "%(a)s" %(D)s'

# 进程名称前缀
proc_name = "schedule-ai-service"

# 预加载应用（共享内存，减少内存占用）
preload_app = True

# 优雅重启超时
graceful_timeout = 30

# 最大请求数后重启 worker（防止内存泄漏）
max_requests = 100
max_requests_jitter = 10
