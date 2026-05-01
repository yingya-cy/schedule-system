# Findings & Decisions

## Requirements
<!-- 已从代码分析中识别的需求和规划 -->

### 已完成功能
- 课表 OCR 识别（PDF/图片 → AI 自动解析，Doubao AI + PyMuPDF）
- 空闲时间查询（按周/天/节次/部门/姓名）
- 课表管理（增删改查，编辑课表单项）
- 反课表 Excel 导出
- 批量 OCR 处理（最多 10 文件并发）
- 部门管理（主任团、网编部、秘书部、策划部、咨询部、外联部、宣传部）
- 比赛评分系统（含 Excel 导出）
- 仪表盘总览

### 待开发功能
- 登录认证系统（无用户表、无 JWT、无路由守卫）
- 网盘系统（object_storage 预留但未实现）
- 联系人/课程/聊天视图接入真实数据

### 技术债务
- CoursesView、ContactsView、ChatView 使用硬编码 demo 数据
- 所有 API 端点无认证保护
- fileStorageService 已实现 dedup 和双模式存储，但 object_storage 为空壳

## Research Findings

### 技术栈
- 前端: React 19 + TypeScript + Tailwind CSS 4 + Vite + Zustand + motion (framer-motion 继任者)
- 后端: Node.js + Express (PM2 集群, 2 实例, 端口 3001)
- AI 服务: Python Flask + PyMuPDF + Doubao AI API (Gunicorn 3 workers, 端口 5002)
- 数据库: MySQL 8.0 (连接池 20, 队列限制 50)
- 部署: Docker Compose / PM2 + Gunicorn + Nginx
- E2E 测试: Playwright

### 数据库现状
- `departments`: id, name, sort_order, timestamps — 7 个预设部门
- `schedules`: id, name, department, filename, file_data(LONGBLOB/base64), file_type, storage_type(ENUM: database/filesystem/object_storage), file_path, file_size, file_hash — 课表主表
- `courses`: id, schedule_id(FK), course_name, weekday(1-7), sections(JSON), weeks(JSON), teacher, location, remark — 课表明细

### 前端路由结构
- `/` → redirect `/dashboard`
- `/dashboard` → DashboardView
- `/files` → FilesView (课表中心，含上传/列表/编辑)
- `/courses` → CoursesView (课程目录，当前静态数据)
- `/contacts` → ContactsView (联系人，当前静态数据)
- `/schedule` → ScheduleView (排班管理)
- `/chat` → ChatView (群聊，当前静态数据)
- `/scoring` → ScoringDashboard (比赛评分，含子路由)

### API 端点清单
```
POST /api/ocr/image|pdf|batch     OCR 识别（代理到 Flask）
POST /api/ocr/horizontal_rules    横向规则 OCR
GET  /api/departments             部门列表
GET  /api/schedules               课表列表 (支持筛选)
GET  /api/schedules/:id           课表详情
GET  /api/schedules/:id/file      查看/下载源文件
POST /api/schedules               创建课表
PUT  /api/schedules/:id           更新课表
DELETE /api/schedules/:id         删除课表
GET  /api/query/free-time         空闲时间查询
POST /api/export/reverse-schedule 反课表导出
POST /api/scoring/*               评分系统 API
```

## Technical Decisions
| Decision | Rationale |
|----------|-----------|
| 文件以 base64 字符串存 MySQL LONGBLOB | 简化部署，不需额外文件服务；读取需 Buffer→utf8→base64 decode |
| 前端懒加载 (React.lazy) | 减少初始 bundle 体积，6 个视图按需加载 |
| PM2 集群 + Gunicorn 多 worker | 利用 2 核 CPU，支持并发处理 |
| 文件去重用 SHA256 | filesStorageService 在存储前检查 hash，避免重复存储 |
| 小文件(≤5MB)存 DB，大文件存文件系统 | 平衡查询效率和存储成本 |

## Issues Encountered
| Issue | Resolution |
|-------|------------|
| 项目无 task_plan.md / findings.md / progress.md | 本次初始化创建，覆盖现状和规划 |
| 未发现登录/网盘相关代码实现 | 确认处于规划阶段，已纳入 Phase 2/3 |
| 服务器查看源文件为空（本地正常） | 根因: 4月27日提交 3636c61 改了 getFile() 假定 DB 存 base64，但旧记录是原始二进制。修复 5 处: ①全局 JSON Content-Type 中间件改为 API 专用 ②Repository 硬编码 storage_type 改为接受元数据 ③移除 base64→binary→base64 多余编解码 ④getFile() 添加格式自动检测（base64/原始二进制兼容） ⑤CreateScheduleDto 新增文件元数据字段 |

## Resources
- 项目根目录: `C:\Users\MR\Desktop\sc sys`
- 数据库 schema: `database/schema.sql`
- Express 入口: `server.ts`
- Flask AI 入口: `service.py`
- 前端入口: `src/App.tsx`
- 类型定义: `src/types.ts`
- 状态管理: `src/stores/appStore.ts`
- 文件存储服务: `src/services/fileStorageService.ts`

## Visual/Browser Findings
<!-- CRITICAL: Update after every 2 view/browser operations -->
-

---
*Update this file after every 2 view/browser/search operations*
*This prevents visual information from being lost*
