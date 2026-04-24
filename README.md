# 课表识别与空闲时间统计系统

支持 PDF/图片课表 OCR 识别、空闲时间查询、反课表 Excel 导出的全栈系统。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + TypeScript + Tailwind CSS 4 |
| 后端 | Node.js + Express (PM2 集群部署) |
| AI 服务 | Python Flask + PyMuPDF + Doubao AI |
| 数据库 | MySQL 8.0 |
| 部署 | Docker Compose / PM2 + Gunicorn |

## 功能

- 课表 OCR 识别（PDF/图片 → AI 自动解析）
- 空闲时间查询（按周/天/节次/部门/姓名）
- 课表管理（增删改查）
- 反课表 Excel 导出
- 部门/用户管理

## 快速部署（Ubuntu 22.04 / 2核/4GiB）

### 方式一：Docker 部署（推荐）

```bash
# 克隆项目
git clone <repo-url>
cd <project>

# 启动所有服务
docker-compose up -d --build
```

### 方式二：手动部署

```bash
# 1. 安装依赖
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs python3-pip nginx
sudo npm install -g pm2
pip install gunicorn

# 2. 安装 Node 依赖并构建
npm install && npm run build

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 填入数据库密码等

# 4. 启动服务
pm2 start ecosystem.config.cjs
gunicorn -c gunicorn.conf.py app:app
```

## 配置说明

### 环境变量 (.env)

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=schedule_system
AI_SERVICE_URL=http://localhost:5002
APP_URL=http://localhost:3001
```

### 端口分配

| 服务 | 端口 |
|------|------|
| Web 应用 | 3000 / 3001 |
| AI OCR 服务 | 5002 |
| MySQL | 3306 |

## 并发支持

本系统针对多用户并发使用进行了优化：

- **Express 后端**：PM2 集群模式，2 实例
- **Flask AI 服务**：Gunicorn 多 worker，3 进程
- **数据库连接池**：20 连接，队列限制 50
- **Docker 资源限制**：每个容器最大 1.5G 内存

## 项目结构

```
├── server.ts              # Express 后端入口
├── service.py             # Flask AI OCR 服务
├── ecosystem.config.cjs   # PM2 集群配置
├── gunicorn.conf.py       # Gunicorn 配置
├── docker-compose.yml     # Docker 部署配置
├── src/
│   ├── components/        # React 组件
│   ├── services/          # 业务逻辑服务
│   └── config/           # 数据库配置
├── prompts/               # AI OCR 提示词
└── utils/                # 工具函数
```

## API 接口

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/ocr/image` | 图片 OCR |
| POST | `/api/ocr/pdf` | PDF OCR |
| GET | `/api/departments` | 获取部门列表 |
| GET | `/api/schedules` | 获取课表列表 |
| POST | `/api/schedules` | 创建课表 |
| DELETE | `/api/schedules/:id` | 删除课表 |
| GET | `/api/query/free-time` | 查询空闲时间 |
| POST | `/api/export/reverse-schedule` | 导出反课表 |

## 健康检查

```bash
# 后端
curl http://localhost:3001/api/ocr/health

# AI 服务
curl http://localhost:5002/health
```

## 维护命令

```bash
# PM2 管理
pm2 status              # 查看状态
pm2 logs                # 查看日志
pm2 restart all         # 重启所有服务

# Docker 管理
docker-compose ps       # 查看容器状态
docker-compose logs -f  # 查看日志
docker-compose restart  # 重启服务
```
