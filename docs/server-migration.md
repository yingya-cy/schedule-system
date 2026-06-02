# 服务器迁移指南

## 核心数据

| 数据 | 位置 | 大小 | 迁移方式 |
|------|------|------|----------|
| MySQL 数据库 | Docker volume `schedule-system_mysql_data` | ~几百MB | `mysqldump` + `mysql` |
| 用户上传文件 | 阿里云 OSS `academic-ether-files` | 云端 | 不需要迁移 |
| 前端 dist | 本地 `npm run build` 生成 | ~2MB | 重新构建 |
| .env 配置 | `/root/workspace/schedule-system/.env` | ~1KB | 手动复制 |

## 迁移步骤

### 1. 旧服务器导出数据

```bash
# SSH 到旧服务器
<ssh-login>

# 导出 MySQL 全部数据
cd /root/workspace/schedule-system
docker exec schedule-mysql mysqldump -uroot -p<db-password> --all-databases > /tmp/full-backup.sql

# 同时保存 .env 文件
cat .env
```

### 2. 拷贝到新服务器

```bash
# 从旧服务器下载
scp root@<server-ip>:/tmp/full-backup.sql .
scp root@<server-ip>:/root/workspace/schedule-system/.env .

# 上传到新服务器
scp full-backup.sql root@新服务器IP:/root/workspace/schedule-system/
scp .env root@新服务器IP:/root/workspace/schedule-system/
```

### 3. 新服务器环境准备

```bash
# 安装 Docker + Docker Compose
curl -fsSL https://get.docker.com | sh

# 克隆项目（或从本地 scp）
git clone <repo> /root/workspace/schedule-system
cd /root/workspace/schedule-system
```

### 4. 本地构建 + 部署

```bash
# 本地构建前端
npm install
npm run build

# 上传 dist + src 到服务器
scp -r dist/ src/ docker/ server.ts package.json package-lock.json tsconfig.json \
  root@新服务器IP:/root/workspace/schedule-system/

# 服务器上启动
ssh root@新服务器IP
cd /root/workspace/schedule-system
docker compose up -d
```

### 5. 导入数据库

```bash
# 等 MySQL 启动后
docker exec -i schedule-mysql mysql -uroot -p<db-password> < full-backup.sql
```

### 6. 验证

```bash
# 检查服务
docker ps
curl http://localhost/api/departments

# 登录验证
curl -X POST http://新服务器IP/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### 7. DNS / IP 更新

如果有域名，更新 DNS A 记录指向新 IP。

## 注意事项

- **OSS 文件不受影响**：文件存阿里云 OSS，换服务器不影响文件访问
- **OSS Key/Secret 不变**：`.env` 直接复用
- **JWT_SECRET 可以换**：但已签发的 token 会失效，用户需重新登录
- **SMTP 密码不变**：QQ 邮箱授权码继续用
- **MySQL 容器端口**：建议保持 3307 映射（客户端连接不变）
- **防火墙**：新服务器需开放 80 端口（HTTP）

## 最低配置建议

| 规格 | 推荐 |
|------|------|
| CPU | 2 核+ |
| 内存 | 4GB+（当前 3.4GB 紧张） |
| 磁盘 | 40GB+ |
| 系统 | Ubuntu 20.04/22.04 或 CentOS 7+ |
