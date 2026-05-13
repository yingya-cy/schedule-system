# 心理咨询预约系统实施计划

## 背景
- 现状：心理中心每学期打电话让学生加 QQ，在 QQ 上聊天预约
- 痛点：QQ 加人过多、被举报封号风险、部分学生无 QQ 号
- 目标：用 sc-sys 现有系统扩展，替代 QQ

## 整体流程

```
学生收到短信链接 → 小程序 → 浏览咨询师列表
→ 先聊天协调时间 → 双方确认 → 创建预约 → 咨询师确认
→ 微信模板消息通知学生 → 线下咨询 → 咨询师写备注
```

## 与现有系统的关系

| 层级 | 现有位置 | 心理咨询新增 | 复用/新增 |
|------|---------|-------------|----------|
| 路由 | `routes/` | `routes/psychology/` | 新增，`server.ts` 加一行 `app.use` |
| 认证 | `middleware/auth.ts` | 无 | **全复用** |
| DB 连接 | `config/database.ts` | 无 | **全复用** |
| 响应格式 | `{ success, data/error }` | 保持一致 | **全复用** |
| 前端路由 | React Router | 加 `/psychology/*` | 新增 |

## 阶段 1：数据库 + 后端

### 新增表

```sql
-- 咨询师
CREATE TABLE counselors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT COMMENT '关联 users 表的账号',
  name VARCHAR(50) NOT NULL,
  title VARCHAR(100),
  bio TEXT,
  avatar_url VARCHAR(500),
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 咨询师可用时段
CREATE TABLE counselor_slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  counselor_id INT NOT NULL,
  day_of_week TINYINT NOT NULL COMMENT '1=周一 7=周日',
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (counselor_id) REFERENCES counselors(id) ON DELETE CASCADE
);

-- 预约
CREATE TABLE appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_user_id INT NOT NULL,
  counselor_id INT NOT NULL,
  conversation_id INT COMMENT '关联的聊天会话',
  slot_date DATE NOT NULL,
  slot_start TIME NOT NULL,
  slot_end TIME NOT NULL,
  status ENUM('pending','confirmed','completed','cancelled','no_show') DEFAULT 'pending',
  notes TEXT COMMENT '咨询师备注',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (counselor_id) REFERENCES counselors(id)
);

-- 聊天会话
CREATE TABLE chat_conversations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_user_id INT NOT NULL,
  counselor_id INT NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 聊天消息
CREATE TABLE chat_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conversation_id INT NOT NULL,
  sender_role ENUM('student','counselor') NOT NULL,
  sender_id INT NOT NULL,
  content TEXT NOT NULL,
  read_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  INDEX idx_conv_time (conversation_id, created_at)
);

-- 操作日志
CREATE TABLE action_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50),
  target_id INT,
  details JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 新增路由

| 路由 | 方法 | 用途 | 认证 |
|------|------|------|------|
| `/api/psychology/counselors` | GET | 获取咨询师列表 + 可用时段 | 是 |
| `/api/psychology/counselors/:id` | GET | 咨询师详情 | 是 |
| `/api/psychology/chat/conversations` | GET | 我的会话列表 | 是 |
| `/api/psychology/chat/conversations` | POST | 创建新会话 | 是 |
| `/api/psychology/chat/:id/messages` | GET | 历史消息 | 是 |
| `/api/psychology/appointments` | POST | 创建预约（事务+行锁） | 是 |
| `/api/psychology/appointments` | GET | 我的预约列表 | 是 |
| `/api/psychology/appointments/manage` | GET | 咨询师：待处理列表 | 咨询师 |
| `/api/psychology/appointments/:id/confirm` | PUT | 确认预约 | 咨询师 |
| `/api/psychology/appointments/:id/complete` | PUT | 完成咨询 + 备注 | 咨询师 |
| `/api/psychology/appointments/:id/cancel` | PUT | 取消预约 | 是 |

### WebSocket 端点

| 端点 | 用途 |
|------|------|
| `/ws/psychology/chat/:conversationId` | 实时聊天，带 JWT token 认证 |

- 发送消息 → 服务端存入 DB + 推给对端
- 对端不在线 → 存 DB，下次 GET `/messages` 拉取
- 断线自动重连（指数退避 1s → 2s → 4s → 30s）

### 预约事务（场景：两人同时抢同一时段）

```sql
START TRANSACTION;
SELECT * FROM appointments 
  WHERE counselor_id = ? AND slot_date = ? AND slot_start = ? 
  AND status NOT IN ('cancelled') 
  FOR UPDATE;
-- 无结果 → INSERT
-- 有结果 → 返回 409 "该时段已被预约"
COMMIT;
```

## 阶段 2：前端（Web + 小程序）

### Web 端（管理后台，现有 sc-sys）
- 咨询师管理页（admin 添加/编辑咨询师）
- 预约查看页（admin 看全部）

### 小程序端（学生 + 咨询师）

**学生侧：**
- 咨询师列表 → 点进去看简介 + 可约时段
- 发起聊天 → 协调时间
- 聊天内"一键预约" → 选时段 → 确认
- 我的预约列表

**咨询师侧：**
- 待处理预约列表
- 聊天列表（按学生分）
- 确认/拒绝/完成预约
- 写备注

## 阶段 3：手机端方案

### Web 管理端：PWA
现有前端加 `manifest.json` + Service Worker，浏览器可"添加到桌面"

### 学生/咨询师端：微信小程序
Taro 4.x，React 语法，复用 API 调用和 Zustand store

## 构建顺序

1. 建 5 张新表 → `npm run dev` 验证
2. `routes/psychology/counselors.ts`（CRUD）
3. `routes/psychology/chat.ts`（REST 消息 + WebSocket）
4. `routes/psychology/appointments.ts`（事务+行锁+状态流转）
5. 微信模板消息集成
6. Web 端管理页面（咨询师管理）
7. 小程序端（学生+咨询师页面）
8. PWA 配置

## 当前进度
- [x] 设计（本次 brainstorming 完成）
- [ ] 阶段 1：数据库 + 后端
- [ ] 阶段 2：Web 管理页面
- [ ] 阶段 3：小程序
