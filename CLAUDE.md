# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 开发命令

```bash
npm run dev      # 同时启动 Express (3001) 和 Flask (5002)
npm run dev:server  # 只启动 Express 后端 (3001)
npm run dev:flask   # 只启动 Flask AI 服务 (5002)
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
GET  /api/schedules/:id  获取单个课表详情
GET  /api/schedules/:id/file        查看源文件 (inline)
GET  /api/schedules/:id/file?download=true  下载源文件
POST /api/schedules      创建课表
DELETE /api/schedules/:id 删除课表
GET  /api/query/free-time  空闲时间查询
POST /api/export/reverse-schedule 反课表 Excel 导出
```

### 数据库

MySQL 8.0，连接池 20 连接，队列限制 50。核心表：`departments`、`schedules`、`courses`（sections 和 weeks 字段存 JSON）

**注意**：schedules 表的 `file_data` LONGBLOB 字段存储的是 **base64 编码字符串**，读取时需要解码

### 并发配置

- Express/PM2: 2 集群实例，1.5GB 内存限制
- Flask/Gunicorn: 3 sync workers，5 分钟超时
- Docker: 每个容器最大 1.5G 内存

## 目录结构

```
src/
├── App.tsx                    # React 入口，路由配置
├── components/
│   ├── views/                 # 页面视图
│   │   ├── FilesView/         # 课表中心页面
│   │   │   ├── index.tsx     # 主容器，视图切换
│   │   │   ├── ScheduleListView.tsx  # 课表列表（网格卡片布局）
│   │   │   ├── ScheduleItem.tsx       # 课表卡片组件
│   │   │   ├── ScheduleUploadView.tsx # 上传视图
│   │   │   ├── BatchResultView.tsx    # 批量结果视图
│   │   │   ├── constants.ts   # 常量定义
│   │   │   └── utils.ts       # 工具函数
│   │   └── Dashboard/         # 空闲统计页面
│   ├── Layout.tsx             # 应用壳和导航
│   ├── ConfirmDialog.tsx      # 自定义确认弹窗
│   ├── MessageDialog.tsx      # 自定义消息弹窗（success/error/info）
│   ├── ManualScheduleEntry.tsx # 手动录入课表弹窗
│   └── ScheduleEditor.tsx     # 课表编辑组件
├── services/                  # 业务逻辑
│   ├── api.ts                 # 前端 API 调用
│   ├── scheduleService.ts     # 课表服务（Node端）
│   ├── fileStorageService.ts  # 文件存储服务
│   └── fileStorageService.ts  # 文件存储服务
├── repositories/              # 数据访问层
├── stores/appStore.ts         # Zustand 状态管理
├── config/database.ts         # MySQL 连接池配置
├── types.ts                   # TypeScript 接口定义
└── utils/                     # 工具函数

prompts/                       # AI OCR 提示词模板 (Python)
service.py                     # Flask AI OCR 服务
```

## 关键实现细节

### 文件存储

- 文件以 base64 字符串存储在 MySQL LONGBLOB
- 读取流程：`Buffer.toString('utf8')` → `Buffer.from(base64String, 'base64')` → 原始二进制
- 相关代码：`src/services/fileStorageService.ts` 的 `getFile()` 方法

### 状态管理

- 使用 Zustand 管理全局状态
- `appStore.ts` 包含 departments、schedules 状态和 CRUD 操作
- `useInitializeStore()` hook 在应用初始化时自动加载数据

### 组件通信模式

- 子组件通过 props 回调父组件（如 `onSave`, `onError`, `onSuccess`）
- 使用 `MessageDialog` 组件替代浏览器原生 `alert`/`confirm`
