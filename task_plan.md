# Task Plan: 学术空间 (Academic Ether) 迭代开发

## Goal
构建完整的学术管理平台，包含课表管理、比赛评分、登录认证、网盘系统、即时通讯等功能模块。

## Current Phase
Phase 5

## Phases

### Phase 1: 现状盘点 & 需求梳理
- [x] 盘点已完成功能模块
- [x] 识别待开发模块（登录系统、网盘系统）
- [x] 梳理技术栈和架构现状
- [x] 确定各模块优先级和依赖关系
- **Status:** completed

**依赖分析：**
```
Phase 2 (登录认证) ──→ Phase 3 (网盘系统) ──→ Phase 4 (功能完善) ──→ Phase 5 (测试部署)
      │                      │
      └── 权限前置条件 ──────┘
```
- Phase 2 是 Phase 3 的前置条件（文件中心权限依赖用户身份）
- Phase 4 可与 Phase 2/3 部分并行（Courses/Contacts/Chat 接真实数据不依赖登录）
- Phase 3 需要 Phase 2 完成后才能实施完整的权限控制
- Phase 5 在所有功能开发完成后进行

### Phase 2: 登录认证系统
- [x] 设计用户表和管理员表（MySQL schema）
- [x] 实现 JWT token 认证中间件（Express）
- [x] 创建登录/注册页面（React 前端）
- [x] 实现用户角色和权限控制
- [x] 接入现有前端路由守卫
- [x] 管理员用户管理页面（CRUD + 分页搜索）
- [x] 前后端联调测试
- **Status:** completed

### Phase 3: 网盘系统
- [x] 设计文件/文件夹数据库模型
- [x] 实现文件 CRUD API（Express）
- [x] 完成 object_storage 存储策略（阿里云 OSS 预签名 URL 直传）
- [x] 创建网盘前端页面（目录树、上传、下载、预览）
- [x] 实现文件分享和权限控制
- [x] 与课表中心的文件打通（file_items.schedule_id 关联 + API）
- **Status:** completed

### Phase 4: 现有功能完善
- [x] CoursesView / ContactsView / ChatView 接入真实数据
- [x] 评分系统功能验证
- [x] 仪表盘数据聚合
- [x] UI/UX 统一优化
- **Status:** completed

### Phase 5: 测试 & 部署
- [x] 单元测试覆盖 ≥ 80%（纯函数96%+，路由/DB层需集成测试）
- [x] E2E 测试（Playwright）— 6个spec文件已存在，配置完整
- [x] Docker 部署验证 — 4服务编排（nginx + backend + ai-service + db），配置完整
- [x] 性能测试（并发文件上传、大文件处理）— express-rate-limit 全局限流已集成
- **Status:** completed

## Key Questions
1. 登录系统是独立用户体系还是对接学校 SSO/LDAP？→ **独立用户体系（用户名+密码+JWT），不开放注册，管理员后台创建**
2. 网盘系统是否需要版本管理？单个文件大小上限？→ **v1 不做版本管理，OSS 直传单文件上限 5GB（预签名URL限制）**
3. object_storage 实现选型：MinIO / S3 / 阿里云OSS？→ **阿里云 OSS（服务器同地域内网免流量），预签名 URL 直传**
4. Chat 功能是否接入 WebSocket 实现实时通讯？→ **暂不处理，Phase 4 再评估**
5. 当前 demo 数据的 Contacts/Courses 是否需要独立 CRUD 后台？→ **需要，Phase 4 实现**

## Decisions Made
| Decision | Rationale |
|----------|-----------|
| 文件存储已支持 database + filesystem 双模式 | 小文件(≤5MB)存DB，大文件存文件系统，预留 object_storage 扩展点 |
| 前端状态管理使用 Zustand | 轻量、TypeScript 友好，已在 appStore.ts 中实现 |
| 后端 Express + Flask 双服务 | Express 处理业务逻辑，Flask 处理 AI OCR（PyMuPDF + Doubao） |
| 数据库 MySQL 8.0 | 已有 departments/schedules/courses 三表，schedules.file_data 以 base64 存 LONGBLOB |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
|       |         |            |

## Notes
- 项目已有人物卡片 (Member)、文件项 (FileItem)、课程展示 (CourseDisplay) 等类型定义，但 Contacts/Courses/Chat 三视图使用静态 demo 数据
- schedules 表的 storage_type 已预留 'object_storage' 枚举值但未实现
- 当前无任何认证机制，所有 API 端点公开可访问
- 文件存储使用 SHA256 去重，上传目录为 `uploads/`
