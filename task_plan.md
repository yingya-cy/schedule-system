# Task Plan: 学术空间 (Academic Ether) 迭代开发

## Goal
构建完整的学术管理平台，包含课表管理、比赛评分、登录认证、网盘系统、即时通讯等功能模块。

## Current Phase
Phase 1

## Phases

### Phase 1: 现状盘点 & 需求梳理
- [x] 盘点已完成功能模块
- [x] 识别待开发模块（登录系统、网盘系统）
- [x] 梳理技术栈和架构现状
- [ ] 确定各模块优先级和依赖关系
- **Status:** in_progress

### Phase 2: 登录认证系统
- [ ] 设计用户表和管理员表（MySQL schema）
- [ ] 实现 JWT token 认证中间件（Express）
- [ ] 创建登录/注册页面（React 前端）
- [ ] 实现用户角色和权限控制
- [ ] 接入现有前端路由守卫
- [ ] 前后端联调测试
- **Status:** pending

### Phase 3: 网盘系统
- [ ] 设计文件/文件夹数据库模型
- [ ] 实现文件 CRUD API（Express）
- [ ] 完成 object_storage 存储策略（当前仅 database + filesystem）
- [ ] 创建网盘前端页面（目录树、上传、下载、预览）
- [ ] 实现文件分享和权限控制
- [ ] 与课表中心的文件打通（统一文件存储层）
- **Status:** pending

### Phase 4: 现有功能完善
- [ ] CoursesView / ContactsView / ChatView 接入真实数据（当前为静态 demo 数据）
- [ ] 评分系统功能验证
- [ ] 仪表盘数据聚合
- [ ] UI/UX 统一优化
- **Status:** pending

### Phase 5: 测试 & 部署
- [ ] 单元测试覆盖 ≥ 80%
- [ ] E2E 测试（Playwright）
- [ ] Docker 部署验证
- [ ] 性能测试（并发文件上传、大文件处理）
- **Status:** pending

## Key Questions
1. 登录系统是独立用户体系还是对接学校 SSO/LDAP？
2. 网盘系统是否需要版本管理？单个文件大小上限？
3. object_storage 实现选型：MinIO / S3 / 阿里云OSS？
4. Chat 功能是否接入 WebSocket 实现实时通讯？
5. 当前 demo 数据的 Contacts/Courses 是否需要独立 CRUD 后台？

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
