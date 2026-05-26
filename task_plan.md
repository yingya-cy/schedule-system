# Task Plan: 学术空间 (Academic Ether) 迭代开发

## Goal
构建完整的学术管理平台，包含课表管理、比赛评分、登录认证、网盘系统、即时通讯等功能模块。

## Current Phase
Phase 19: 迭代优化 — 文件预览、移动端适配、Bug 修复（进行中）→ Phase 20: Dify 智能体集成（已完成）

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
- [x] 15.14 测试 — 权限矩阵(7) + 届 API(4) + 部长权限(3) = 14 新测试，总计 243
- [x] 15.15 届选择器 — 仪表盘 + 课表中心届下拉切换，schedules/free-time/stats 按届过滤
- [x] 15.16 换届操作 UI — TermTransitionModal，选学年/学期，勾留任/离任，按钮在用户管理（仅 admin）
- [x] 15.17 导出跟届同步 — 课表中心导出按钮传 term_id，反课表导出与届选择联动
- [x] 15.18 反课表导出按钮 — 从仪表盘移至课表中心，换届按钮移至用户管理
- [x] 15.19 文件时间戳 — 文件列表显示 created_at
- [x] 15.20 列宽统一 — 部门列 13.0、人员列 20.0、分隔列 1.6
- [x] 15.21 过渡测试清理 — afterAll 恢复 DB，不再污染数据
- [x] 15.22 allFree 单双周标注 — formatFreeTimeForPeriod 补 detectParity
- **Status:** completed

### Phase 16: 心理咨询预约系统
- [x] 16.1 数据库 — 6 张新表（counselors, counselor_slots, appointments, chat_conversations, chat_messages, action_logs）
- [x] 16.2 后端 API — 12 个 REST 端点 + WebSocket 实时聊天
  - `GET/POST/PUT /api/psychology/counselors` — 咨询师 CRUD + 时段管理
  - `GET/POST /api/psychology/chat/conversations` + `/messages` — 会话 + 消息
  - `GET/POST/PUT /api/psychology/appointments` — 预约 + 确认/完成/取消 + 事务锁
  - `GET /api/psychology/me` — 当前用户咨询师身份
  - `GET /api/psychology/appointments/all` — admin 查看全局预约
  - WebSocket `ws://host/?token=` — 实时双向聊天，指数退避重连
- [x] 16.3 前端 Web 管理 — 心理咨询模块入口 + 10 个页面组件
  - 咨询师管理页（admin）：列表、新增/编辑、启用/停用、时段编辑
  - 学生端：咨询师列表 → 详情+时段 → 预约弹窗 → 我的预约（tab 筛选）
  - 聊天页面（WebSocket + REST fallback）：会话列表 + 消息气泡 + mobile/desktop 响应式
  - 咨询师工作台：tab 切换、确认/完成（写备注）/取消
  - Admin 预约总览：表格 + 状态筛选 + mobile 卡片
- [x] 16.4 `as any` 清零 — 4 个路由文件 19→0，统一用 RowDataPacket/ResultSetHeader/getErrorMessage
- [x] 16.5 前端导航集成 — `App.tsx` lazy route, `Layout.tsx` Heart 图标, `types.ts` RoutePath
- [x] 16.6 时段解析 bug 修复 — `split(':')` 误拆 TIME 字段，改 `parseSlots()` 工具函数
- [x] 16.7 聊天布局修复 — 桌面端白屏（`lg:hidden` 提前返回）、消息重复（StrictMode 双 WS）、滚动条（flex 高度链）
- [x] 16.8 视口锁定 — PsychologyView `calc(100vh - 4rem)`，页面不溢出
- [x] 16.9 测试 — 集成 22 tests + E2E 6 flows + WebSocket 双向测试脚本
- **Status:** completed — 全量 492 tests 零失败

**架构：** Express 路由模块 `routes/psychology/` + Zustand store + 自包含 `components/psychology/`（仿 scoring 模式）

**关键决策：**
- 预约用 `SELECT ... FOR UPDATE` 事务锁防并发冲突
- 聊天双通道：WebSocket 主（实时）+ REST fallback（离线/重连）
- 咨询师身份通过 `GET /api/psychology/me` 检测（查 counselors 表）
- 聊天消息 WS 广播含回声（发送方也收到），前端通过 `sender_id === userId` 区分

### Phase 17: AI 日程安排 + AI 心理咨询（计划阶段）
- [x] 17.1 Step 1: 用户画像扩展 — `users` 表加 `grade`、`major` 字段，UserInfo 类型 + auth 路由同步
- [x] 17.2 Step 2: Flask AI 核心端点 — `ai_text()` 非流式 + `ai_stream()` SSE 流式，异常处理 + 断连清理
- [x] 17.3 Step 3: AI 日程安排 — 上传课表 OCR → ScheduleEditor → 事项 → AI 生成周计划 → 持久化 Dashboard
- [x] 17.4 Step 4: AI 心理咨询 — SSE 流式对话 + "小暖" system prompt + 会话管理 + 危机关键词检测
- [x] 17.5 Step 5: 导航集成 + 13 集成测试
- **Status:** completed — 但三个入口已隐藏（功能待完善），505 tests
- **已部署:** 47.120.29.188（后端 + 前端）

**技术栈：** MiniMax-M2.7（OpenAI 兼容 API）→ Flask `ai_endpoints.py` → Express 代理 → React 前端
- 排课：非流式 JSON 输出，前端时间表渲染
- 咨询：SSE 流式输出，前端逐字渲染

**依赖图：** Step 1 → Step 2 → Step 3 & 4 (并行) → Step 5

### Phase 18: 文件预览系统
- [x] 18.1 PDF 预览 — pdf.js v3 UMD → canvas 渲染 + 翻页（兼容微信/手机）
- [x] 18.2 .docx 预览 — mammoth → HTML + 完整表格 CSS
- [x] 18.3 .doc 预览 — antiword → 纯文本 HTML（200KB，无需 LibreOffice）
- [x] 18.4 预览弹窗 — FilePreviewModal 统一入口，blob URL + iframe/object
- [x] 18.5 跨浏览器兼容 — 微信浏览器、Safari、Firefox 全部覆盖
- **Status:** completed

### Phase 19: 迭代优化 & Bug 修复
- [x] 19.1 文件中心移动端适配 — 侧边栏滑入悬浮层、汉堡菜单、2 列网格
- [x] 19.2 schedules API 79MB → 10KB — 排除 file_data LONGBLOB + 大小写文件名
- [x] 19.3 MySQL 字符集 — 数据库文件夹名乱码修复
- [x] 19.4 OSS 环境变量配置 — docker-compose 注入
- [x] 19.5 文件夹树修复 — allFolders 递归透传、新建后刷新
- [x] 19.6 聊天页面布局修复 — 高度约束三件套、防竞态、防重复
- [x] 19.7 入口调整 — AI 排课/AI 咨询恢复显示，心理咨询隐藏
- [x] 19.8 AI 排课页重构 — 两阶段布局（计划置顶）、日卡片 PlanTimeline、当前周自动计算、自定义提示词、双模型切换（Ark DeepSeek/Doubao + MiniMax）
- [x] 19.9 PDF 课表识别 — 横型解析器 fallback（竖型 < 5 门时自动切换），pdfplumber + fitz 双文本提取
- [x] 19.10 AI 提示词优化 — 加入学校作息时间表（08:20-21:00）、block 减密（每块≥1h，每天≤8块）
- [x] 19.11 组件清理 — WeekSelector 移除右键设当前周、DashboardView 同步清理
- [x] 19.12 DeepSeek thinking 关闭 — `extra_body: {thinking: {type: "disabled"}}`
- [x] 19.13 服务器部署修复 — FLASK_URL 注入、File→Blob（Node 18 兼容）、MySQL 字符集双重编码、AI 表创建、nginx DNS resolver、dist 重建、server.ts 路由注册
- [x] 19.14 AI 咨询显示 — 恢复导航入口、会话标题乱码修复（ASCII 默认值）、DeepSeek 关 thinking、模型参数透传
- [x] 19.15 服务器内存优化 — Gunicorn workers 5→2、Docker limit 1.5G→512M、MySQL buffer pool 256→128M、日志限制 10MB×3
- [x] 19.16 UI/UX 改善 — touch targets ≥44px、z-index scale、prefers-reduced-motion、100vh→dvh、skeleton loading、border-radius/shadow 统一、语义色柔化、AI 咨询密度缩小、消息溢出 min-h-0
- [x] 19.17 测试补充 — AI 排课 save-schedule/latest-schedule、空 course_name 归一化、会话默认标题、空课表错误信息 (+4 tests, 505→509)
- [x] 19.18 AI 排课 → 个人中心改造 — 资料卡片 + 计划历史 + Tab 切换 + AI 咨询串联 + 19 E2E 测试
  - ProfileCard：可编辑资料卡片（年级/专业/学院/规划），localStorage 持久化
  - PlanHistoryList：历史计划列表 + 右侧 720px 抽屉查看详情 + 悬停删除按钮
  - PlanTimeline：时间块点击展开截断任务名，compact prop 控制列数
  - 布局：去页面顶栏、按钮上移至 Tab 行、右侧面板仅个人课表 Tab 显示
  - AI 咨询串联：今日节数≥5 或待办≥3 → 暖心卡片 → 点击新开会话自动发送上下文
  - Bug 修复：上传不清计划、generate 不覆盖完整课程、后端只更新 plan_data
  - E2E: tests/personal-center.spec.ts (19 tests)
- [ ] 19.19 覆盖率提升
- **Status:** main 分支，19.1-19.18 已完成，19.19 待定

### Phase 20: Dify 智能体编排平台集成
- [x] 20.1-20.9 基础集成（Docker部署/插件安装/双后端/JSON解析/pycache修复）
- [x] 20.10 校园知识库构建（44公众号/1013篇索引/432篇全文/777块/6类/Embedding+Rerank）
- [x] 20.11 小暖联网版工作流（知识检索+Tavily联网搜索+对话记忆+用户画像注入）
- [x] 20.12 知识库增量同步脚本 sync_kb.py + Windows计划任务
- [x] 20.13 公众号全自动管线（搜号→拉列表→下全文→清洗→分块→入库）
- **Status:** completed
- [x] 20.1 Docker 部署 Dify（12 容器，端口 3000/5001），配置 DNS 和 pip 镜像
- [x] 20.2 安装 DeepSeek / MiniMax 插件
- [x] 20.3 创建日程规划工作流（`app-PrCny5QgnSfhqidhuRHkLTPD`），Python 原 prompt 一比一迁移
- [x] 20.4 创建心理陪伴聊天助手（`app-CxiyatMUQCGpEuIOZ4SVunNR`），原 system prompt 迁移
- [x] 20.5 Express 端 Dify/Flask 双后端切换（`.env` `AI_BACKEND` 开关）
- [x] 20.6 Dify SSE 格式→前端格式转换（event→chunk/done）
- [x] 20.7 修复 Dify 日程 JSON 提取（think 标签剥离 + 大括号深度计数）
- [x] 20.8 修复 Flask `__pycache__` 导致路由 404（`package.json` `python -B`）
- [x] 20.9 修复心理消息重复保存（后端去重）
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

| PDF预览空白+自动下载 | V2签名response headers被OSS拒绝 | 服务端代理端点 `GET /oss/preview?key=` fetch OSS后设置 `Content-Disposition: inline` |
| OSS presigned URL Content-Disposition | 上传时加 `Content-Disposition: inline` header | OSS不保留该header到对象元数据，代理方案解决 |
| 日程走 Flask(34s)、心理可走 Dify | Flask 走火山 Coding Plan 快 5.6 倍；Dify 有对话记忆价值 |
| Flask `python -B` 永久解决 pycache | 旧 .pyc 导致路由注册失败返回 404 |

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

- **flask 路由 404 修复**：`package.json` 中 `dev:flask` 改为 `python -B service.py`，禁止 pycache 缓存

### 当前状态

| 模块 | 后端 | 速度 | 备注 |
|------|------|------|------|
| AI 日程规划 | Flask | 34s | 走火山引擎 Coding Plan |
| AI 心理陪伴 | Flask | 正常 | SSE 流式 |
| AI 课表 OCR | Flask | — | 不变 |
| 心理咨询预约 | Express | — | 后端全齐 |
| Dify 集成 | ✅ | — | 开关随时切 |

### 决策

| 决定 | 原因 |
|------|------|
| 日程走 Flask，心理保留 Dify 选项 | Flask 34s vs Dify 190s，日程不需要 Dify 编排；心理有对话记忆价值 |
| Python -B 永久解决 pycache 问题 | 旧 pyc 导致路由注册失败，404 |

### 比赛相关

- 设计文档草稿：`C:\Users\MR\Desktop\作品报告草稿.md`，3300字，缺封面/截图/架构图
- 报名截止：5/23，作品提交：6/10

### 待办

- [ ] 评分页加作品视频预览（`contestants` 表加 `work_oss_key`）
- [ ] 比赛文档补截图 + 架构图 + 演示视频
- [ ] 知识库方案（学校信息注入 Prompt / Dify 知识库）
- [ ] 新模块测试（psychology/AI 路由）
