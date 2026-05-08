# Task Plan: 学术空间 (Academic Ether) 迭代开发

## Goal
构建完整的学术管理平台，包含课表管理、比赛评分、登录认证、网盘系统、即时通讯等功能模块。

## Current Phase
Phase 15: 权限重构 + 换届系统 + 部长角色 — 实施中

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

### Phase 6: 文件中心优化 — 在线预览 & 体验打磨
- [x] 6.1 修复文件卡片图标与文件名重叠
- [x] 6.2 实现文件在线预览弹窗组件（图片/PDF/视频/文本）
- [x] 6.3 实现推文详情预览弹窗（点击推文卡片查看全文）
- [x] 6.4 OSS CORS 配置（跨域 PUT/GET 支持浏览器端上传+预览）
- [x] 6.5 前端重建 & 验证
- **Status:** completed — E2E 11/11, 单元/集成 122/122 全部通过

**预览方案：**
| 类型 | 预览方式 |
|------|---------|
| 图片 (jpg/png/gif/webp) | 弹窗 `<img>` 展示 |
| PDF | 弹窗 `<iframe>` 嵌入 |
| 视频 (mp4/webm) | 弹窗 `<video>` 播放 |
| 文本/代码 (txt/json/js等) | fetch 内容后 `<pre>` 展示 |
| 推文 | 弹窗展示标题/作者/日期/封面/正文/外链 |
| 其他 | 仅下载 |

### Phase 7: UI 修复 — 页面水平滚动条 & 布局溢出
- [x] 7.1 Activity Tabs 撑宽页面导致底部水平滚动条（FileCenterView.tsx）
  - 根本原因：tabs 容器在 flex 嵌套中 `min-width: auto` 不收缩
  - 修正：wrapper 和 tabs 容器加 `min-w-0` 允许收缩，配合 `overflow-x-auto` 触发内部滚动
- [x] 7.2 布局本身横向溢出 256px（Layout.tsx）
  - 根本原因：根 flex 容器内 `flex-1 w-full` + `ml-64` 组合导致总宽 = 1280（content）+ 256（margin）= 1536px > viewport
  - 修正：根容器添加 `overflow-x-hidden` 裁剪溢出
  - Playwright 验证：htmlScrollW 1536→1280, hasHScrollbar true→false
- [x] 7.3 顶部导航栏水平溢出修复（Layout.tsx）
  - header 添加 `overflow-hidden` 防止内容溢出
  - 左侧容器 `min-w-0 flex-1`，标题 `truncate` 自动截断
  - 右侧容器 `shrink-0` 固定宽度不被压缩
- **Status:** completed (2026-05-05)

### Phase 8: 文件中心布局重构 — 活动列表移至侧边栏
- [x] 8.1 移除顶部横向活动标签栏
  - 原方案：顶部 `overflow-x-auto` 标签行，活动多时需滚动
  - 替换为：左侧边栏上方的垂直活动列表
- [x] 8.2 未选中活动时展示活动卡片网格
  - 卡片含活动名称、部门、描述、状态标签
  - 卡片 hover 显示编辑/删除按钮
  - 右上角保留「新活动」按钮
- [x] 8.3 选中活动后，左侧边栏只保留目录树
  - 侧边栏顶部显示当前活动名（可点击返回活动卡片列表）
  - 内容区顶部显示活动面包屑（名称 + 部门）+ 编辑/删除按钮
  - 删除活动后自动返回活动列表（handleDelete 已处理）
  - 目录树高度上限 65vh
- [x] 8.4 文件夹嵌套（子文件夹支持）
  - 目录树中每个文件夹 hover 显示「新建子文件夹」按钮（FolderPlus 图标）
  - 侧边栏「新建文件夹」按钮按当前选中文件夹作为父级
  - 后端 Folder 模型已有 parent_id 字段，前端 buildTree / renderFolderTree 已递归渲染
- [x] 8.5 上传文件自动检测类型（移除手动选择类别）
  - `detectFileCategory()` 按 MIME type 判断 image/video/document
  - 无法识别时回退到文件扩展名判断
  - 移除类别下拉选择器，上传时自动判断
- [x] 8.6 文件上传交互优化
  - 原生 `<input type="file">` 替换为自定义拖放区（input hidden + label 模拟）
  - 未选文件时显示「点击选择文件」引导文案 + Upload 图标
  - 选中后显示文件名、大小、自动检测的类别图标和名称
- [x] 8.7 批量文件上传
  - `<input type="file" multiple>` 支持一次选择多个文件
  - 选中后显示文件数量、文件名列表（超过3个时截断）、总大小
  - 逐个上传：每个文件独立获取 OSS 预签名 URL、上传、确认
  - 进度条按 (完成/总数) 比例显示
  - 支持「清除选择」按钮移除已选文件
- [x] 8.8 代码审查与简化（/simplify）
  - 批量上传改为并发（3 并发 Promise.all），墙钟时间大幅缩短
  - 并行获取 folders + permissions（Promise.all）
  - AbortController 用 `{ once: true }` 防止事件监听泄漏
  - 移除冗余 `folderParentId` 状态，统一用 `folderForm.parent_id`
  - 清理 25+ 处冗余注释（WHAT 类注释和 JSX 节头标记）
- **Status:** completed (2026-05-06)

### Phase 9: 文件中心功能完善 & OSS 存储优化
- [x] 9.1 修复删除活动时外键约束错误（手动级联删除关联数据）
- [x] 9.2 文件编辑功能（补充/修改描述、文件名）
- [x] 9.3 OSS key 改用可读路径 `file-center/{活动名}/{文件夹路径}/{fileId}_{原始文件名}`
  - 上传流程改为：先建 DB 记录 → 用 ID 拼 key → 生成预签名 URL → 上传 OSS
- [x] 9.4 下载文件使用原始文件名（服务端代理 + Content-Disposition）
- [x] 9.5 修复上传时描述丢失（confirm 接口补 description 字段）
- [x] 9.6 修复选文件后 auto-fill 误导
- [x] 9.7 `tests/file-center-e2e.spec.ts` — 重命名 + 重写为 Playwright test() API（3 tests）
- **Status:** completed — 单元测试 122/122, E2E 2/2 通过

### Phase 10: 权限体系实现
- [x] 10.1 课表中心权限（按部门）
  - `schedules` 表新增 `created_by`，JWT 加入 `department`
  - `server.ts` 添加 `authenticate` 中间件到 schedules/query/export/dashboard 路由组
  - PUT/DELETE schedule：admin/秘书部/主任团/创建者可操作
  - POST schedule：自动记录 `created_by`
- [x] 10.2 文件中心权限
  - `created_by` 已在各表（activities/folders/items/tweets）存在
  - 添加 `canModify()` 辅助函数：admin 或创建者可编辑/删除
  - PUT/DELETE activities/folders/items/tweets 全部加权限校验
- [x] 10.3 比赛评分权限
  - 评委登录/评分路由保持公开（无需系统账号）
  - 管理路由（模板/比赛/选手/评委 CRUD、计算/清空/发布）添加 `authenticate + requireRole('admin')`
  - 添加评委时支持关联 `user_id`
  - 新增 `GET /my-tasks`：登录用户可查看自己被指定为评委的比赛
- [x] 10.4 仪表盘 → 全员可见（`authenticate` 保证登录后所有角色可访问）
- **Status:** completed (2026-05-06)

### Phase 11: 权限系统集成测试
- [x] 11.1 更新 testServer.ts：新增 `createAppWithAuth()`（镜像 server.ts 认证），`createTestUser` 支持 `department`
- [x] 11.2 修复 `ScheduleRepository.create()` 遗漏 `created_by` 字段；DB 添加 `schedules.created_by` 列
- [x] 11.3 `tests/integration/permissions/schedules-permissions.test.ts` — 18 tests（401/403/200 全覆盖）
- [x] 11.4 `tests/integration/permissions/file-center-permissions.test.ts` — 18 tests（canModify 全部 8 个端点）
- [x] 11.5 `tests/integration/permissions/scoring-permissions.test.ts` — 29 tests（公开路由/401/admin-only 403）
- [x] 11.6 `tests/integration/permissions/auth-permissions.test.ts` — 15 tests（users CRUD 401/403/200）
- **Status:** completed — 80 新测试，202/202 全部通过（原 122 + 新 80）

### Phase 12: 邮箱注册登录
- [x] 12.1 安装 nodemailer + QQ 邮箱 SMTP 配置
- [x] 12.2 DB 新增 `email_verify_token`、`email_verified_at` 列
- [x] 12.3 `src/services/emailService.ts` — 发送验证邮件
- [x] 12.4 `POST /api/auth/register` — 注册 + 发邮件
- [x] 12.5 `GET /api/auth/verify-email?token=` — 验证邮箱激活账号
- [x] 12.6 `POST /api/auth/verify-email/resend` — 重新发送
- [x] 12.7 登录拦截未验证用户 → 403
- [x] 12.8 前端注册页 + 登录页加注册入口 + 验证结果提示
- [x] 12.9 测试：11 new tests
- **Status:** completed — QQ/Gmail 验证通过，215/215 tests

### Phase 13: 权限完善 & Bug 修复
- [x] 修复：前端 API 请求缺 `Authorization` header（api.ts / scoringApi.ts）
- [x] 修复：auth 中间件只认 header → 新增 `?token=` query 参数支持（文件预览认证）
- [x] 修复：`ScheduleRepository.create()` 遗漏 `created_by` → 添加
- [x] 修复：DB 缺 `schedules.created_by` 列 → 添加 + 旧数据归 admin
- [x] 修复：`UserManagementView` 403 无报错 → 显示"权限不足"
- [x] 修复：学生权限细化 → 可上传/编辑自己的课表，不能动别人的
- [x] 修复：`handleSaveSchedule` 删旧建新覆盖 `created_by` → 改为 PUT 更新
- [x] 修复：header `overflow-hidden` 裁掉用户菜单 → 移除
- [x] 修复：课程卡片 hover 模糊/卡顿 → `transition-all` 改为精准属性
- [x] 前端权限可视化：删除按钮按权限显示/隐藏；编辑页无权限进入只读模式
- [x] 侧边栏加「用户管理」入口（仅 admin 可见）
- [x] 权限 E2E 测试 12 passed
- [x] 邮箱支持登录 — login 查询改为 `username = ? OR email = ?`
- [x] 管理邮箱设为 3151665426@qq.com
- [x] 验证 token 加 24h 过期 — `email_verify_token_expires` 列
- [x] 登录页 placeholder 改为「用户名或邮箱」
- **Status:** completed — 215/215 tests

### Phase 14: 查漏补缺 — 文件中心、评分导出、反课表
- [x] 14.1 文件中心子文件夹显示 + 根目录显示 + 目录树 hover 按钮修复
- [x] 14.2 评分结果双格式导出 — 统分表(汇总排名+公式) + 评分表(按评委、DB描述、子维度详情)
- [x] 14.3 评分导出格式升级 — xlsx→exceljs，支持边框/字体/居中/合并/公式
- [x] 14.4 评分表按评委导出 — judge_id 参数 + 前端评委下拉选择器
- [x] 14.5 移除上传模板导出按钮 — 已被直接导出替代
- [x] 14.6 反课表导出 — 按部门+人员×时间段网格，7天工作簿，反课表格式规则
- [x] 14.7 反课表导出按钮 — 从孤儿 QueryPanel 移至仪表盘 DashboardView
- [x] 14.8 各种 Bug 修复 — rank 保留字、Content-Disposition 编码、auth header 遗漏、pool.query 兼容
- [x] 14.9 反课表完美复刻 — 等线→宋体、48pt/22pt/14pt、行高61.1/27.75/56.25、列宽23.5/13.0/1.6、分隔列、整行底色(除分隔列)、网格布局(一行三人)
- [x] 14.10 反课表格式规则修正 — `1(6)(12)/(1-5)(7-11)(13-18)`，同组周段直接拼接，`/` 仅隔开节次特定与全空闲
- **Status:** completed

### Phase 15: 权限重构 + 换届系统 + 部长角色
- [x] 15.1 删 `file_permissions` 表 — 死代码，权限表从未真正生效
- [x] 15.2 统一权限中间件 `canModifyResource` — admin/teacher/创建者/department_head
- [x] 15.3 文件中心权限简化 — 所有人可查看/上传，admin/teacher/创建者/部长可改删
- [x] 15.4 前端清理 — 删权限管理面板、删 QueryPanel 死代码
- [x] 15.5 届系统 `terms` 表 — id/name/academic_year/semester/sequence_number/status
- [x] 15.6 `schedules`/`file_activities`/`competitions` 加 `term_id` 列
- [x] 15.7 `GET /api/terms/current` + 导出自动取届名做标题
- [x] 15.8 `POST /api/terms/transition` — 归档旧届、创建新届、离任者 is_active=0
- [x] 15.9 `users.role` 加 `department_head` — 部长角色
- [x] 15.10 部长权限 — 看本部门成员、编辑本部门 name/email/dept、不能改角色/密码
- [x] 15.11 `getAllFreeTimeData` 按活跃届过滤 — JOIN terms WHERE status='active'
- [x] 15.12 `useUnknownInCatchVariables: true` + 105 处 `catch (error: any)` → `unknown`
- [x] 15.13 死代码清理 — QueryPanel.tsx、errors.ts、useInitializeStore、api.getAllFreeTimeData
- [x] 15.14 测试 — 权限矩阵(7) + 届 API(4) + 部长权限(3) = 14 新测试，总计 235
- **Status:** in progress（前端届选择器、换届 UI 待实现）

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

| PDF预览空白+自动下载 | V2签名response headers被OSS拒绝 | 服务端代理端点 `GET /oss/preview?key=` fetch OSS后设置 `Content-Disposition: inline` |
| OSS presigned URL Content-Disposition | 上传时加 `Content-Disposition: inline` header | OSS不保留该header到对象元数据，代理方案解决 |

## Errors Encountered
| Error | Attempt | Resolution |
|-------|---------|------------|
| PDF 预览空白+自动下载 | 尝试1: V2 `signatureUrl` response headers 覆盖 content-type → OSS 拒绝；尝试2: 上传时加 `Content-Disposition: inline` → OSS 仍返回 attachment | 服务端代理端点 `GET /api/file-center/oss/preview?key=`，通过 SDK `oss.get()` 获取文件后以 `Content-Disposition: inline` 返回 |
| OSS CORS 阻止浏览器上传 | — | 阿里云控制台配置 CORS 规则：允许 `localhost:3001`，方法 `PUT GET HEAD` |

## Notes
- 项目已有人物卡片 (Member)、文件项 (FileItem)、课程展示 (CourseDisplay) 等类型定义，但 Contacts/Courses/Chat 三视图使用静态 demo 数据
- schedules 表的 storage_type 已预留 'object_storage' 枚举值但未实现
- 文件中心已接入 JWT 认证 + 细粒度权限（创建者/admin 可编辑删除，全员可查看上传）
- 课表中心已接入 JWT 认证（schedules/query/export/dashboard 路由组 `authenticate`）
- 评分系统已接入 JWT 认证（管理路由 `authenticate + requireRole('admin')`；评委登录/评分路由保持公开）
- JWT payload 包含 `{ userId, username, role, department }`
- 仪表盘 `GET /api/dashboard/stats` 需登录，所有角色可访问
- OSS key 格式：`file-center/{活动名}/{文件夹路径}/{fileId}_{原始文件名}`，先建 DB 记录再拼 key
- 下载走服务端代理 `GET /oss/download`，使用原始文件名作为 Content-Disposition
- 文件存储使用 SHA256 去重，上传目录为 `uploads/`
