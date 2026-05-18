# 运维工程实施清单

## 第一层：自动部署（GitHub Actions → 服务器）

### 1.1 创建 GitHub Actions workflow
文件: `.github/workflows/deploy.yml`

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
      - run: npm ci
      - run: npm run build
      - run: npm test
      - name: Deploy to server
        uses: easingthemes/ssh-deploy@v4
        with:
          SSH_PRIVATE_KEY: ${{ secrets.SERVER_SSH_KEY }}
          REMOTE_HOST: ${{ secrets.SERVER_HOST }}
          REMOTE_USER: root
          SOURCE: "dist/ src/ server.ts package.json"
          TARGET: "/root/workspace/schedule-system"
      - name: Restart backend
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: root
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /root/workspace/schedule-system
            docker compose up -d --build backend
            docker exec schedule-nginx nginx -s reload
```

### 1.2 配置 GitHub Secrets
在 GitHub → Settings → Secrets → Actions 添加：
- `SERVER_HOST`: 47.120.29.188
- `SERVER_SSH_KEY`: 服务器 SSH 私钥内容

---
## 第二层：数据库定时备份

### 2.1 服务器上添加 cron 任务
```bash
# SSH 到服务器
ssh root@47.120.29.188

# 创建备份脚本
cat > /root/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/root/db-backups
mkdir -p $BACKUP_DIR
FILENAME="backup-$(date +%Y%m%d-%H%M).sql.gz"
docker exec schedule-mysql mysqldump -uroot -p753412 --all-databases | gzip > $BACKUP_DIR/$FILENAME
# 保留最近 7 天
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
echo "Backup done: $FILENAME"
EOF

chmod +x /root/backup-db.sh

# 每天凌晨 3 点备份
crontab -e
# 添加: 0 3 * * * /root/backup-db.sh >> /root/backup-db.log 2>&1
```

### 2.2 备份上传到 OSS（可选，更安全）
```bash
# 在上面的脚本末尾加:
ALIYUN_OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
ALIYUN_OSS_BUCKET=academic-ether-files
# 用阿里云 OSS CLI 或 ossutil 上传
ossutil cp $BACKUP_DIR/$FILENAME oss://$ALIYUN_OSS_BUCKET/backups/
```

---
## 第三层：服务监控 & 告警

### 3.1 阿里云自带监控（免费、已有）
- 云监控控制台 → 主机监控 → 查看 CPU/内存/磁盘
- 设置告警规则：CPU > 80%、磁盘 > 85%、内存 > 90%
- 通知方式：短信/邮件（免费额度）

### 3.2 服务存活检测
在服务器上添加：
```bash
# 每 5 分钟检测，挂了就重启
cat > /root/health-check.sh << 'EOF'
#!/bin/bash
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/departments)
if [ "$HTTP_CODE" != "200" ]; then
  echo "$(date): API returned $HTTP_CODE, restarting..."
  cd /root/workspace/schedule-system && docker compose restart backend
fi
EOF

chmod +x /root/health-check.sh
# crontab: */5 * * * * /root/health-check.sh >> /root/health-check.log 2>&1
```

### 3.3 Sentry 错误监控（可选）
```bash
npm install @sentry/node @sentry/react
# 在 server.ts 和 App.tsx 初始化 Sentry
# 免费额度 5000 errors/month，你们最多 100 条
```

---
## 第四层：HTTPS 证书

### 4.1 申请免费 SSL（Let's Encrypt）
```bash
# 有域名后执行
ssh root@47.120.29.188
apt install certbot
certbot certonly --standalone -d your-domain.com
# 证书路径: /etc/letsencrypt/live/your-domain.com/
```

### 4.2 Nginx 配置 HTTPS
```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    # ... 其余配置同 80 端口
}
server {
    listen 80;
    return 301 https://$host$request_uri;  # HTTP 跳转 HTTPS
}
```

### 4.3 证书自动续期
```bash
# certbot 自带定时任务，无需额外配置
certbot renew --dry-run  # 测试续期
```

---
## 第五层：应用日志

### 5.1 统一日志输出
```bash
npm install winston
# 在 server.ts 里替换 console.log → winston logger
# 输出到文件 + 按天轮转
```

### 5.2 Nginx 日志轮转
/etc/logrotate.d/nginx（服务器自带，确认下）

---
## 实施顺序（按优先级）

| 序号 | 任务 | 预计时间 | 重要程度 |
|------|------|----------|----------|
| 1 | 数据库备份脚本 | 30 分钟 | 🔴 必须 |
| 2 | HTTPS + Let's Encrypt | 30 分钟 | 🔴 必须（有域名后） |
| 3 | 健康检测 + 自动重启 | 20 分钟 | 🟡 推荐 |
| 4 | GitHub Actions 自动部署 | 2 小时 | 🟡 推荐 |
| 5 | 阿里云告警规则 | 15 分钟 | 🟢 顺手 |
| 6 | Sentry 错误监控 | 1 小时 | 🟢 可选 |
| 7 | 日志系统 | 2 小时 | 🟢 可选 |

## 做完后的效果

```
代码 push → 自动测试 → 自动部署 → 上线             （不用手动了）
每天凌晨 3 点 → 自动备份数据库                     （数据安全了）
服务器挂了 → 自动重启 → 管理员收到告警             （晚上睡得着）
有域名后 → Let's Encrypt 免费证书 → HTTPS 绿色锁   （安全及格）
```
