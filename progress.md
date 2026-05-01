# Progress Log

## Session: 2026-05-01 (continued)

### Bug 根因完整追溯
- **Status:** complete
- **Git bisect 结果:**
  - `309ebcc` (4/9): 初始代码 — 二进制存，二进制读 → **正常**
  - `92e3db6` (4/9): 添加全局 `Content-Type: application/json` 中间件 → **文件响应头被污染**
  - `04f87ea` (4/24): 重构，写入路径改为双编码（存 base64 文本），读取路径未同步
  - `3636c61` (4/27): `getFile()` 加了 base64 decode，但旧记录存的是原始二进制 → **旧文件全挂**
- **修复文件 (5处):**
  - `server.ts` — 全局 JSON Content-Type → `/api` 专用中间件
  - `src/services/scheduleService.ts` — 移除双重编码，保留原始 base64
  - `src/repositories/ScheduleRepository.ts` — 接受 DTO 元数据，不再硬编码
  - `src/types/database.ts` — CreateScheduleDto 新增 storage_type/file_path/file_size/file_hash
  - `src/services/fileStorageService.ts` — `decodeDatabaseFile()` 自动检测 base64/原始二进制，兼容新旧数据
- **待部署:** git push 到服务器，docker-compose build + up 后端容器
- **部署完成:** 2026-05-01，git push → server pull → docker-compose build backend → docker-compose up -d backend → API 200 OK ✓

## Session: 2026-05-01


### Bug Fix: 服务器查看源文件为空
- **Status:** complete
- **Started:** 2026-05-01
- Actions taken:
  - 安装 planning-with-files 技能到 ~/.claude/skills/planning-with-files/
  - 清理克隆的 planning-with-files 仓库
  - 读取项目 CLAUDE.md、README.md、数据库 schema
  - 分析完整前端路由和组件结构
  - 识别已完成功能：课表 OCR、空闲查询、反课表导出、比赛评分
  - 识别待开发模块：登录认证系统、网盘系统
  - 识别技术债务：ContactsView/CoursesView/ChatView 使用静态 demo 数据
  - **排查源文件为空 bug**：追踪完整上传→存储→读取→响应链路
  - **修复 3 处代码问题**（详见下方）
- Files created/modified:
  - task_plan.md (创建) — 5 阶段迭代计划
  - findings.md (创建) — 技术栈知识库
  - progress.md (创建) — 本日志
  - server.ts (修改) — 移除全局 JSON Content-Type 中间件，替换为 API 专用中间件
  - src/services/scheduleService.ts (修改) — 保留原始 base64，传递 fileStorageService 元数据
  - src/repositories/ScheduleRepository.ts (修改) — 使用传入的 storage_type/file_path/file_size/file_hash
  - src/types/database.ts (修改) — CreateScheduleDto 新增文件元数据字段

### Bug 根因分析

**链路**: 上传(base64) → storeFile(二进制) → 二次base64编码 → MySQL LONGBLOB → 读取→utf8解码→base64解码→返回

数据编解码链本身正确，但存在 3 个问题：

1. **全局 `Content-Type: application/json; charset=utf-8` 中间件污染所有响应** (server.ts:25-28)
   - 文件下载端点也继承了 JSON Content-Type
   - 生产环境下 nginx 代理层可能进一步干扰二进制响应头
   - **修复**: 替换为 `/api` 路由专用中间件，仅对非 Buffer 响应设置 JSON Content-Type

2. **Repository.create() 硬编码 storage_type='database'** (ScheduleRepository.ts:69)
   - `fileStorageService.storeFile()` 对大文件(>5MB)写入磁盘并返回 storage_type='filesystem'
   - 但 repository 丢弃了这些元数据，导致文件路径、hash、大小等信息全部丢失
   - **修复**: CreateScheduleDto 新增 storage_type/file_path/file_size/file_hash 字段，repository 尊重传入值

3. **createSchedule 中多余的双重编码** (scheduleService.ts:53)
   - `base64 → Buffer.from → 二进制 → .toString('base64') → 又回到 base64`
   - 每次编解码都是潜在的损坏点
   - **修复**: 保留原始 base64 数据直存 DB，仅传递元数据

## Test Results
| Test | Status |
|------|--------|
| tsc --noEmit | ✓ 通过 |

## Error Log
| Timestamp | Error | Attempt | Resolution |
|-----------|-------|---------|------------|
|           |       |         |            |

## 5-Question Reboot Check
| Question | Answer |
|----------|--------|
| Where am I? | Bug fix 完成，准备进入 Phase 2 (登录认证系统) |
| Where am I going? | Phase 2 登录认证系统 → Phase 3 网盘系统 → Phase 4 现有功能完善 → Phase 5 测试部署 |
| What's the goal? | 构建完整的学术管理平台（课表+评分+登录+网盘+通讯） |
| What have I learned? | 详见 findings.md |
| What have I done? | 初始化规划文件 + 修复服务器查看源文件为空的 bug |

---
*Update after completing each phase or encountering errors*
