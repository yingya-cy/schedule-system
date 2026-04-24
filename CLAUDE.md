# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发命令

```bash
npm run dev      # 启动开发服务器 (tsx server.ts)
npm run build    # Vite 生产构建 (输出到 dist/)
npm run preview  # 预览生产构建
npm run lint     # TypeScript 类型检查 (tsc --noEmit)
npm run clean    # 删除 dist/
npm run cleanup-files  # 运行文件清理脚本
```

## 架构概览

### 服务架构

```
浏览器 → Express (port 3001) → Flask AI OCR (port 5002)
                 ↓
              MySQL (port 3306)
```

- **Express 后端** (`server.ts`): REST API 入口，端口 3001。代理 OCR 请求到 AI 服务，提供课表 CRUD、空闲时间查询、反课表导出 API
- **Flask AI 服务** (`service.py`): OCR 解析服务，端口 5002。使用 PyMuPDF + Doubao AI API 识别课表
- **React 前端** (`src/App.tsx`): Vite 开发服务器，懒加载各页面视图

### 前端状态管理

使用 Zustand (`src/stores/appStore.ts`)，通过 `useInitializeStore()` 在应用初始化时自动加载部门和课表数据

### API 路由

```
POST /api/ocr/image      图片 OCR (代理到 AI 服务)
POST /api/ocr/pdf        PDF OCR (代理到 AI 服务)
POST /api/ocr/batch      批量 OCR
GET  /api/departments    部门列表
GET  /api/schedules      课表列表 (支持 department/name 过滤)
POST /api/schedules      创建课表
DELETE /api/schedules/:id 删除课表
GET  /api/query/free-time  空闲时间查询
POST /api/export/reverse-schedule 反课表 Excel 导出
```

### 数据库

MySQL 8.0，连接池 20 连接，队列限制 50。核心表：`departments`、`schedules`、`courses`（sections 和 weeks 字段存 JSON）

### 并发配置

- Express/PM2: 2 集群实例，1.5GB 内存限制
- Flask/Gunicorn: 3 sync workers，5 分钟超时
- Docker: 每个容器最大 1.5G 内存

## 目录结构

```
src/
├── App.tsx                    # React 入口，路由配置
├── components/
│   ├── views/                 # 页面视图 (Dashboard, Files, Schedule 等)
│   ├── Layout.tsx             # 应用壳和导航
│   └── *.tsx                  # 可复用组件
├── services/                  # 业务逻辑 (api, scheduleService, queryService, excelExportService)
├── repositories/              # 数据访问层
├── stores/appStore.ts          # Zustand 状态管理
├── config/database.ts         # MySQL 连接池配置
├── types.ts                   # TypeScript 接口定义
└── utils/                     # 工具函数 (dataMappers, formatters, pdfParser, scheduleParser, sqlBuilder)

prompts/                       # AI OCR 提示词模板 (Python)
utils/                         # AI 服务工具函数 (ai_client, cleaner, pdf_plumber_parser, rule_parser, image_utils)
```
