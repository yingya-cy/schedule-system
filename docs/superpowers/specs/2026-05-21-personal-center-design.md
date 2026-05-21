# 个人中心页面设计文档

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将现有 AI 排课页面改造为个人中心页面，保留 AI 排课功能为主体，新增个人资料卡片和 AI 计划历史。

**Architecture:** 在现有 AiSchedulePage 上渐进重构。顶部新增可编辑资料卡片（年级/专业/规划从右侧面板提升），下方 Tab 切换 AI 计划（生成+历史）和个人课表（编辑器），右侧面板精简为上传+偏好+模型选择。

**Tech Stack:** React 18, TypeScript, Zustand, motion/react, Tailwind CSS, lucide-react

---

## 页面结构

```
┌──────────────────────────────────────────────────┐
│  TopBar (sticky): "个人中心" 标题 + 操作按钮        │
├──────────────────────────────────────────────────┤
│  ProfileCard (可编辑，可折叠)                      │
│  头像 · 姓名 · 角色 · 部门 · 年级 · 专业 · 学院 · 规划│
├────────────────────────┬─────────────────────────┤
│  Tabs: AI计划 | 个人课表 │  Right Panel             │
│                        │  · 课表上传              │
│  Tab content area      │  · 自定义偏好            │
│                        │  · 模型选择              │
└────────────────────────┴─────────────────────────┘
```

## 组件拆分

### 新建文件

| 文件 | 职责 |
|------|------|
| `src/components/ai-schedule/PersonalCenterPage.tsx` | 主页面，替代 AiSchedulePage |
| `src/components/ai-schedule/ProfileCard.tsx` | 可编辑个人资料卡片 |
| `src/components/ai-schedule/PlanHistoryList.tsx` | AI 计划历史列表 |

### 保留不变

| 文件 | 职责 |
|------|------|
| `src/components/ai-schedule/CommitmentForm.tsx` | 待办事项表单 |
| `src/components/ai-schedule/PlanTimeline.tsx` | 计划时间线展示 |
| `src/components/ScheduleEditor.tsx` | 课表编辑器 |

### 修改文件

| 文件 | 改动 |
|------|------|
| `src/components/Layout.tsx` | 导航 "AI 排课" → "个人中心"，图标 bot → user |
| `src/stores/aiScheduleStore.ts` | 新增 planHistory 状态和 fetchPlanHistory 方法 |
| `src/services/aiScheduleApi.ts` | 新增 getPlanHistory API 调用 |
| `src/types.ts` | 新增 ProfileData、PlanHistoryItem 类型 |
| `src/App.tsx` | 路由 `/ai-schedule` → `/profile`，组件替换 |

## 数据流

### ProfileCard 数据

```
authStore.user (姓名/角色/部门) ──┐
localStorage profile (年级/专业/学院/规划) ──┤──→ ProfileCard 展示
                                   │
后端 GET /api/user/profile ────────┘

ProfileCard 编辑保存 ──→ localStorage + PUT /api/user/profile
                       ──→ 注入 AI 生成请求 prompt 上下文
```

### AI 计划历史

```
PlanHistoryList ──→ GET /api/ai/plan-history?userId=xxx
               ←── [{ id, week, courseCount, created_at, plan }]
               
点击查看 ──→ 展开 PlanTimeline(plan, readonly)
```

### 课表数据（沿用现有）

```
课表上传 OCR ──→ courses state ──→ localStorage + POST /api/ai/save-schedule
生成计划 ──→ current week courses + commitments + profile → POST /api/ai/generate
          ←── plan → PlanTimeline + 加入历史
```

## API 设计

### 新增

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/user/profile` | 获取用户资料（年级/专业/学院/规划） |
| PUT | `/api/user/profile` | 更新用户资料 |
| GET | `/api/ai/plan-history` | 获取当前用户的计划历史列表 |
| GET | `/api/ai/plan/:id` | 获取单个历史计划详情 |

### 复用

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/ai/upload` | OCR 课表上传 |
| POST | `/api/ai/save-schedule` | 保存课表 |
| POST | `/api/ai/generate` | 生成 AI 计划 |
| GET | `/api/ai/latest-schedule` | 加载最近课表 |

## ProfileCard 字段

| 字段 | 来源 | 编辑 |
|------|------|------|
| 头像 | 首字母生成 | 否 |
| 姓名 | `users.name` | 是 |
| 角色 | `users.role` | 否（仅 admin 可改） |
| 部门 | `users.department` | 是 |
| 年级 | `user_profiles.grade` | 是 |
| 专业 | `user_profiles.major` | 是 |
| 学院 | `user_profiles.college` | 是 |
| 当前规划 | `user_profiles.plan_note` | 是 |

数据库：新增 `user_profiles` 表 `(user_id, grade, major, college, plan_note)`。

## PlanHistoryList

- 每项显示：周次、课程数、待办数、生成时间
- 点击展开：复用 PlanTimeline 组件，只读模式
- 数据从 `GET /api/ai/plan-history` 获取
- 数据库新增 `ai_plan_history` 表 `(id, user_id, week, courses JSON, commitments JSON, plan JSON, model, created_at)`
- 每次调用 `POST /api/ai/generate` 成功后写入该表

## 左侧导航调整

```diff
- { id: 'ai-schedule', label: 'AI 排课', icon: 'bot' },
+ { id: 'profile', label: '个人中心', icon: 'user' },
```

图标映射新增 `'user': <User size={20} />`（lucide-react）。

## 测试策略

1. **单元测试：** ProfileCard 编辑/保存逻辑、PlanHistoryList 列表渲染
2. **集成测试：** 资料保存 API → 数据库往返
3. **E2E：** 导航到个人中心 → 编辑资料 → 保存 → 切换 Tab → 生成计划 → 查看历史
4. **布局健康：** 确保新页面不会溢出/遮盖/截断（16 个检测用例，4 分辨率）

## 兼容性

- 现有 localStorage key（`ai_schedule_grade`, `ai_schedule_major`, `ai_schedule_custom_prompt`）平滑迁移到新的 profile 结构
- 旧路由 `/ai-schedule` 重定向到 `/profile`
- AiSchedulePage.tsx 保留但不再使用（后续可删除）
