# CLAUDE.md

## 开发命令

```bash
npm run dev           # Express (3001) + Flask (5002)
npm run dev:server    # 仅 Express
npm run dev:flask     # 仅 Flask
npm run build         # Vite 生产构建 → dist/
npm run lint          # tsc --noEmit
npm test              # vitest 单元+集成
npx playwright test   # E2E (需先启动 dev server)
```

## 服务器

- **IP**: 47.120.29.188
- **登录**: `ssh root@47.120.29.188`（已配置 SSH key）
- **部署**: Docker Compose，容器 `schedule-mysql` / `schedule-backend` / `schedule-nginx` / `schedule-ai-service`
- **数据库**: MySQL 8.0，端口 3307（映射），密码 `753412`

## 架构

```
浏览器 → Express :3001 → Flask AI OCR :5002
                 ↓
              MySQL :3306
```

- **Express** (`server.ts`): REST API，路由模块在 `src/routes/`（auth, scoring, file-center），课表/查询/导出在 server.ts 内联
- **Flask** (`service.py`): PyMuPDF + Doubao AI OCR
- **前端**: React SPA (`src/App.tsx`), Zustand 状态管理, Vite 构建

### 认证

- JWT Bearer token，payload: `{ userId, username, role, department }`
- `authenticate` 中间件校验登录，`requireRole(...roles)` 限制角色（admin/teacher/student）
- 文件中心/课表中心/仪表盘全部需登录；评分系统评委接口公开，管理接口需 admin
- 权限模式：admin 或创建者可编辑删除；课表中心额外允许秘书部/主任团

### API 路由组

| 前缀 | 认证 | 说明 |
|------|------|------|
| `/api/auth` | 部分 | 登录公开，/users 需 admin |
| `/api/schedules` `/api/query` `/api/export` `/api/dashboard` | 全部 | 课表/查询/导出/仪表盘 |
| `/api/scoring` | 部分 | 评委登录/提交公开；管理需 admin |
| `/api/file-center` | 全部 | 文件/活动/文件夹/推文 CRUD + OSS 上传 |
| `/api/departments` | 无 | 部门列表（上传表单需要） |

### 数据库

MySQL 8.0，连接池 20。核心表：
- 课表: `departments`, `schedules`, `courses`（sections/weeks 存 JSON）
- 认证: `users`（bcrypt 密码哈希）
- 评分: `scoring_templates` → `dimensions` → `subdimensions`; `competitions`, `contestants`, `judges`, `scores` + `score_details`, `competition_results`
- 文件中心: `file_activities`, `file_folders`（parent_id 树）, `file_items`, `file_tweets`, `file_permissions`

## 关键细节

### 文件存储

- OSS 模式：阿里云 OSS 预签名 URL 直传（V4 签名）
- OSS key 格式：`file-center/{活动名}/{文件夹路径}/{fileId}_{原始文件名}`
- 上传流程：先建 DB 记录拿 ID → 拼 OSS key → 生成预签名 URL → 前端直传
- 下载/预览走服务端代理 `GET /oss/download|preview?key=`（解决 Content-Disposition 和跨域）
- `schedules.file_data` LONGBLOB 存 **base64 字符串**，读取: `Buffer.from(base64String, 'base64')`

### 权限判定

```typescript
// 文件中心：admin 或创建者
function canModify(user, createdBy) { return user.role === 'admin' || user.username === createdBy; }
// 课表中心额外允许特权部门
const isPrivileged = role === 'admin' || department === '秘书部' || department === '主任团';
```

### 评分计算

去掉一个最高分和一个最低分（≥3 个评分才生效），结果存 `competition_results`（rank, final_score, avg_scores JSON）

### 测试

- Vitest: `tests/unit/` + `tests/integration/`，覆盖率目标 `src/services/` `src/routes/` `src/stores/` `src/middleware/` `src/utils/`
- Playwright: `tests/*.spec.ts`，baseURL `http://localhost:3001`

### 部署

- Express/PM2: 2 实例，1.5GB 限制
- Flask/Gunicorn: 3 sync workers，5 分钟超时
- Docker: 每容器 1.5GB

## 后端修改后必须重启

修改 `server.ts`、`src/services/`、`src/repositories/`、`src/routes/`、`src/middleware/` 下的文件后，**必须主动重启 dev server**（`npm run dev`），不能依赖热重载。

```bash
powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force" 2>/dev/null
npm run dev
```

## 代码质量强制规则

**每次 Write/Edit 之后：**
- Hook 自动 `tsc --noEmit`（已配置），无需手动调用

**写完一个完整功能/模块后：**
1. `code-reviewer` 或 `typescript-reviewer` — TS 代码审查
2. 涉及 auth、用户输入、数据库、文件系统时加 `security-reviewer`

**提交前：**
- `simplify` — 全面审查复用、质量、效率（一次 ~30K token，不要每次编辑都跑）

**Hook 已配置：** 每次 Write/Edit `.ts/.tsx` 后自动 `tsc --noEmit`，失败会在 UI 显示警告。
**布局检查：** `npx playwright test tests/layout-health.spec.ts` — 16 个检测用例（溢出、重叠、遮盖、截断 × 4 分辨率）

**测试要求：**
- **每次代码改动必须同步新增/修改测试** — 新功能加测试、安全修复加权限测试、bug 修复加回归测试
- 功能前先写测试（TDD），验证 80%+ 覆盖率
- 不能只跑老测试通过就完事，老测试覆盖不到新改动
- 前端改动后跑布局健康检查
- E2E: `npx playwright test` (需 dev server 已启动)

**常用 skill（本项目相关）：**
- `tdd-workflow` / `e2e-testing` / `frontend-design` / `frontend-patterns` / `backend-patterns`
- `api-design` / `database-migrations` / `docker-patterns` / `deployment-patterns`
- `security-review` / `search-first` / `coding-standards`

## 组件拆分规则

**阈值：** 单文件超过 500 行必须拆分，超过 300 行需要考虑拆分。

**拆分策略：**

| 提取内容 | 文件命名 | 说明 |
|----------|----------|------|
| 类型/接口 | `XxxTypes.ts` | 类型名前加领域前缀（如 `FileCenterFileItem`），避免与 `src/types.ts` 全局类型冲突 |
| 工具函数/常量 | `XxxUtils.ts` 或 `.tsx` | 含 JSX 时用 `.tsx` 后缀 |
| 子组件 | `XxxSubComponent.tsx` | 相对独立的 UI 块（如 Modal、列表项） |

**命名冲突处理：** 当组件内部类型与 `src/types.ts` 全局类型同名时（如 `FileItem`），在组件目录内的类型文件里加领域前缀（`FileCenterFileItem`），不要直接复用全局类型名。历史教训：直接提取同名类型会导致其他文件 import 歧义，最终不得不还原。

**拆分后必须验证：**
1. `npx tsc --noEmit` — 类型检查
2. 相应 Playwright E2E 测试 — 确保 UI 功能无回归

## `as any` 禁止规则

**原则：** 项目中禁止新增 `as any`。当前存量已清零（0 处），CR 时发现 `as any` 直接打回。

**各类场景的标准替代：**

| 场景 | ❌ 禁止 | ✅ 正确替代 |
|------|---------|-------------|
| DB 查询行 | `(rows as any[])` | `(rows as RowDataPacket[])` — import from `src/utils/db-types` |
| DB INSERT/UPDATE 结果 | `(result as any).insertId` | `(result as ResultSetHeader).insertId` |
| 异常信息 | `(e as any).message` | `e instanceof Error ? e.message : '未知错误'` |
| MySQL 错误码 | `(error as any).code === 'ER_DUP_ENTRY'` | 用 `isDuplicateEntry(error)` — import from `src/utils/db-types` |
| JWT 解码 | `jwt.verify(...) as any` | `typeof decoded !== 'string'` 窄化后用 `as unknown as TargetType` |
| 前端 API body | `(body as any).extraField` | `Record<string, string>` 或定义局部 interface |
| React state 清空 | `setState({ 0: undefined as any })` | `setState(prev => { const n = {...prev}; delete n[0]; return n })` |

**DB 类型工具（`src/utils/db-types.ts`）：**
```typescript
import { RowDataPacket, ResultSetHeader, getErrorMessage, isDuplicateEntry } from '../utils/db-types';
```
- `RowDataPacket[]` — SELECT 查询行数组
- `ResultSetHeader` — INSERT/UPDATE/DELETE 结果（有 `insertId`, `affectedRows`）
- `getErrorMessage(e)` — 安全提取 `unknown` 错误消息
- `isDuplicateEntry(e)` — 判断是否为 MySQL 唯一键冲突

**项目已启用 `strict: true`**，类型检查会捕获大多数隐式 `any`。

## 文件下载/预览规则（防止 401）

**原则：** 需要认证的接口，禁止用 `<a>` 标签或 `window.open()` 直接导航。浏览器导航请求**无法携带 `Authorization` header**。

| ❌ 错误 | ✅ 正确 |
|---------|--------|
| `<a href="/api/...">` 直接跳转 | `fetch(url, { headers })` → blob → `URL.createObjectURL` → `<a>` 下载 |
| `window.open('/api/...')` 新窗口 | 同上，或用 `?token=xxx` query string（仅限已支持该方式的端点） |

**标准下载模式（fetch + blob）：**
```typescript
const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
const blob = await res.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = filename;
document.body.appendChild(a); a.click(); a.remove();
URL.revokeObjectURL(url);
```

**历史教训（3 次重复踩坑）：**
1. 课表"查看源文件" — `window.open(url?token=xxx)` → 中间件不读 query token → 401
2. 课表"下载源文件" — `<a href=...?token=xxx>` → 同上
3. 文件中心"分别下载" — `<a href=...>` 不带 token → 401

**检查清单：** 任何新增的下载/预览功能，确认是否走了 `fetch` + header 认证。
