# 心理咨询预约系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 sc-sys 上新增心理咨询预约模块，替代 QQ 加人方案。

**Architecture:** Express 路由模块 `routes/psychology/`（counselors + chat + appointments），WebSocket 用于实时聊天，数据库 5 张新表，前端暂不做（后续阶段）。

**Tech Stack:** TypeScript, Express, MySQL2, ws (WebSocket), 现有 JWT 认证中间件

---

## 前置检查

- [x] 数据库 schema.sql 已包含 5 张新表
- [x] 服务器启动验证通过（`npm run dev:server`）
- [ ] 确保 `npm install ws` 已安装 WebSocket 库
- [ ] 确保 `.gitignore` 包含 `docs/superpowers/`

---

### Task 1: 安装 WebSocket 依赖

**Files:**
- Modify: `package.json`

- [ ] **Step 1: 安装 ws 和 @types/ws**

```bash
npm install ws && npm install -D @types/ws
```

- [ ] **Step 2: 验证安装**

```bash
node -e "require('ws'); console.log('ws OK')"
```
Expected: `ws OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add ws dependency for psychology chat"
```

---

### Task 2: 创建 psychology 路由入口 + counselors 路由

**Files:**
- Create: `src/routes/psychology/index.ts`
- Create: `src/routes/psychology/counselors.ts`

- [ ] **Step 1: 创建 `src/routes/psychology/counselors.ts`**

```typescript
import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';

const router = Router();

// GET /api/psychology/counselors
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, 
        GROUP_CONCAT(CONCAT(cs.day_of_week, ':', cs.start_time, '-', cs.end_time) SEPARATOR ';') as slots_raw
       FROM counselors c
       LEFT JOIN counselor_slots cs ON cs.counselor_id = c.id
       WHERE c.is_active = 1
       GROUP BY c.id
       ORDER BY c.id`
    );
    const counselors = (rows as any[]).map((r: any) => ({
      ...r,
      slots: r.slots_raw
        ? r.slots_raw.split(';').map((s: string) => {
            const [day, range] = s.split(':');
            const [start, end] = range.split('-');
            return { day_of_week: parseInt(day), start_time: start, end_time: end };
          })
        : [],
    }));
    res.json({ success: true, data: counselors });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/psychology/counselors/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.*, 
        GROUP_CONCAT(CONCAT(cs.day_of_week, ':', cs.start_time, '-', cs.end_time) SEPARATOR ';') as slots_raw
       FROM counselors c
       LEFT JOIN counselor_slots cs ON cs.counselor_id = c.id
       WHERE c.id = ? AND c.is_active = 1
       GROUP BY c.id`,
      [req.params.id]
    );
    const list = rows as any[];
    if (list.length === 0) {
      res.status(404).json({ success: false, error: '咨询师不存在' });
      return;
    }
    const r = list[0];
    res.json({
      success: true,
      data: {
        ...r,
        slots: r.slots_raw
          ? r.slots_raw.split(';').map((s: string) => {
              const [day, range] = s.split(':');
              const [start, end] = range.split('-');
              return { day_of_week: parseInt(day), start_time: start, end_time: end };
            })
          : [],
      },
    });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
```

- [ ] **Step 2: 创建 `src/routes/psychology/index.ts`**

```typescript
import { Router } from 'express';
import counselorsRouter from './counselors.ts';

const router = Router();

router.use('/counselors', counselorsRouter);
// 后续 task 会加: routers for chat + appointments

export default router;
```

- [ ] **Step 3: 在 `server.ts` 挂载路由**

在 server.ts 的第 505 行附近（`app.use('/api/terms', termsRouter)` 之后）添加：

```typescript
import psychologyRouter from './src/routes/psychology/index.ts';
app.use('/api/psychology', psychologyRouter);
```

- [ ] **Step 4: 启动服务器验证路由可访问**

```bash
npm run dev:server
```
然后用 curl 测试：
```bash
curl -H "Authorization: Bearer <valid_token>" http://localhost:3001/api/psychology/counselors
```
Expected: `{"success":true,"data":[...]}`

- [ ] **Step 5: Commit**

```bash
git add src/routes/psychology/ server.ts
git commit -m "feat: add psychology counselors route"
```

---

### Task 3: 聊天 REST 路由（GET 消息 / POST 发送）

**Files:**
- Create: `src/routes/psychology/chat.ts`

- [ ] **Step 1: 创建 `src/routes/psychology/chat.ts`**

```typescript
import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';

const router = Router();

// GET /api/psychology/chat/conversations — 我的会话列表
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT cc.*, 
        c.name as counselor_name, c.avatar_url,
        (SELECT COUNT(*) FROM chat_messages cm WHERE cm.conversation_id = cc.id AND cm.read_at IS NULL AND cm.sender_role != 
          CASE WHEN cc.student_user_id = ? THEN 'student' ELSE 'counselor' END
        ) as unread_count
       FROM chat_conversations cc
       JOIN counselors c ON cc.counselor_id = c.id
       WHERE (cc.student_user_id = ? OR cc.counselor_id IN (SELECT id FROM counselors WHERE user_id = ?))
         AND cc.is_active = 1
       ORDER BY cc.created_at DESC`,
      [req.user!.userId, req.user!.userId, req.user!.userId]
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// POST /api/psychology/chat/conversations — 创建新会话
router.post('/conversations', authenticate, async (req, res) => {
  try {
    const { counselor_id } = req.body;
    // 检查是否已有活跃会话
    const [existing] = await pool.query(
      'SELECT id FROM chat_conversations WHERE student_user_id = ? AND counselor_id = ? AND is_active = 1',
      [req.user!.userId, counselor_id]
    );
    const rows = existing as any[];
    if (rows.length > 0) {
      res.json({ success: true, data: { id: rows[0].id } });
      return;
    }
    const [result] = await pool.query(
      'INSERT INTO chat_conversations (student_user_id, counselor_id) VALUES (?, ?)',
      [req.user!.userId, counselor_id]
    );
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/psychology/chat/:conversationId/messages
router.get('/:conversationId/messages', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { since } = req.query;
    let sql = 'SELECT * FROM chat_messages WHERE conversation_id = ?';
    const params: any[] = [conversationId];
    if (since) {
      sql += ' AND created_at > ?';
      params.push(since);
    }
    sql += ' ORDER BY created_at ASC LIMIT 200';
    const [rows] = await pool.query(sql, params);

    // 标记已读
    await pool.query(
      'UPDATE chat_messages SET read_at = NOW() WHERE conversation_id = ? AND read_at IS NULL AND sender_role != ?',
      [conversationId, req.user!.role === 'admin' ? 'admin' : 'counselor']
    );

    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// POST /api/psychology/chat/:conversationId/messages
router.post('/:conversationId/messages', authenticate, async (req, res) => {
  try {
    const { conversationId } = req.params;
    const { content } = req.body;
    const [conv] = await pool.query(
      'SELECT * FROM chat_conversations WHERE id = ? AND is_active = 1',
      [conversationId]
    );
    if ((conv as any[]).length === 0) {
      res.status(404).json({ success: false, error: '会话不存在' });
      return;
    }
    const isStudent = req.user!.userId === (conv as any[])[0].student_user_id;
    const senderRole = isStudent ? 'student' : 'counselor';
    const [result] = await pool.query(
      'INSERT INTO chat_messages (conversation_id, sender_role, sender_id, content) VALUES (?, ?, ?, ?)',
      [conversationId, senderRole, req.user!.userId, content]
    );
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
```

- [ ] **Step 2: 更新 `src/routes/psychology/index.ts`** 挂载 chat 路由

```typescript
import chatRouter from './chat.ts';
router.use('/chat', chatRouter);
```

- [ ] **Step 3: 启动服务器验证**

```bash
npm run dev:server
curl -X POST -H "Authorization: Bearer <token>" -H "Content-Type: application/json" -d '{"counselor_id":1}' http://localhost:3001/api/psychology/chat/conversations
```
Expected: `{"success":true,"data":{"id":1}}`

- [ ] **Step 4: Commit**

```bash
git add src/routes/psychology/chat.ts src/routes/psychology/index.ts
git commit -m "feat: add psychology chat REST routes"
```

---

### Task 4: WebSocket 聊天端点

**Files:**
- Create: `src/routes/psychology/ws.ts`

- [ ] **Step 1: 创建 `src/routes/psychology/ws.ts`**

```typescript
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../middleware/auth.ts';
import pool from '../../config/database.ts';

const clients = new Map<number, Set<WebSocket>>();

export function setupWebSocket(wss: WebSocketServer) {
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');
    if (!token) {
      ws.close(4001, 'Missing token');
      return;
    }
    let userId: number;
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      userId = decoded.userId;
    } catch {
      ws.close(4001, 'Invalid token');
      return;
    }

    if (!clients.has(userId)) clients.set(userId, new Set());
    clients.get(userId)!.add(ws);

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        const { conversationId, content } = msg;
        const isStudent = await checkIsStudent(conversationId, userId);
        const senderRole = isStudent ? 'student' : 'counselor';
        const [result] = await pool.query(
          'INSERT INTO chat_messages (conversation_id, sender_role, sender_id, content) VALUES (?, ?, ?, ?)',
          [conversationId, senderRole, userId, content]
        );

        const message = {
          id: (result as any).insertId,
          conversation_id: conversationId,
          sender_role: senderRole,
          sender_id: userId,
          content,
          created_at: new Date().toISOString(),
        };

        // 推送给会话双方
        const [conv] = await pool.query(
          'SELECT student_user_id, c.user_id as counselor_user_id FROM chat_conversations cc JOIN counselors c ON cc.counselor_id = c.id WHERE cc.id = ?',
          [conversationId]
        );
        if ((conv as any[]).length > 0) {
          const c = (conv as any[])[0];
          [c.student_user_id, c.counselor_user_id].forEach((uid: number) => {
            if (uid && clients.has(uid)) {
              clients.get(uid)!.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify(message));
                }
              });
            }
          });
        }
      } catch (e) {
        ws.send(JSON.stringify({ error: 'Failed to send message' }));
      }
    });

    ws.on('close', () => {
      clients.get(userId)?.delete(ws);
      if (clients.get(userId)?.size === 0) clients.delete(userId);
    });
  });
}

async function checkIsStudent(conversationId: number, userId: number): Promise<boolean> {
  const [rows] = await pool.query(
    'SELECT student_user_id FROM chat_conversations WHERE id = ?',
    [conversationId]
  );
  return (rows as any[]).length > 0 && (rows as any[])[0].student_user_id === userId;
}
```

- [ ] **Step 2: 在 `server.ts` 挂载 WebSocket 服务器**

在 server.ts 中添加（`startServer` 函数内部，`app.listen` 之后）：

```typescript
import { WebSocketServer } from 'ws';
import { setupWebSocket } from './src/routes/psychology/ws.ts';

const wss = new WebSocketServer({ port: 3002 });
setupWebSocket(wss);
console.log('WebSocket server running on ws://localhost:3002');
```

- [ ] **Step 3: 重新启动服务器验证**

```bash
npm run dev:server
```
Expected: `WebSocket server running on ws://localhost:3002`

- [ ] **Step 4: Commit**

```bash
git add src/routes/psychology/ws.ts server.ts
git commit -m "feat: add psychology WebSocket chat"
```

---

### Task 5: 预约路由（事务 + 行锁 + 状态流转）

**Files:**
- Create: `src/routes/psychology/appointments.ts`

- [ ] **Step 1: 创建 `src/routes/psychology/appointments.ts`**

```typescript
import { Router } from 'express';
import pool from '../../config/database.ts';
import { authenticate } from '../../middleware/auth.ts';

const router = Router();

// GET /api/psychology/appointments — 我的预约
router.get('/', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT a.*, c.name as counselor_name 
       FROM appointments a JOIN counselors c ON a.counselor_id = c.id 
       WHERE a.student_user_id = ? 
       ORDER BY a.slot_date DESC, a.slot_start DESC`,
      [req.user!.userId]
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// GET /api/psychology/appointments/manage — 咨询师：待处理
router.get('/manage', authenticate, async (req, res) => {
  try {
    const [counselors] = await pool.query(
      'SELECT id FROM counselors WHERE user_id = ?', [req.user!.userId]
    );
    if ((counselors as any[]).length === 0) {
      res.status(403).json({ success: false, error: '不是咨询师' });
      return;
    }
    const counselorId = (counselors as any[])[0].id;
    const { status } = req.query;
    let sql = `SELECT a.*, u.username as student_name 
               FROM appointments a JOIN users u ON a.student_user_id = u.id 
               WHERE a.counselor_id = ?`;
    const params: any[] = [counselorId];
    if (status) { sql += ' AND a.status = ?'; params.push(status); }
    sql += ' ORDER BY a.slot_date ASC, a.slot_start ASC LIMIT 200';
    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// POST /api/psychology/appointments — 创建预约（事务+行锁）
router.post('/', authenticate, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { counselor_id, slot_date, slot_start, slot_end, conversation_id } = req.body;
    await conn.beginTransaction();

    const [existing] = await conn.query(
      `SELECT id FROM appointments 
       WHERE counselor_id = ? AND slot_date = ? AND slot_start = ? 
       AND status NOT IN ('cancelled') FOR UPDATE`,
      [counselor_id, slot_date, slot_start]
    );
    if ((existing as any[]).length > 0) {
      await conn.rollback();
      conn.release();
      res.status(409).json({ success: false, error: '该时段已被预约' });
      return;
    }

    const [result] = await conn.query(
      `INSERT INTO appointments (student_user_id, counselor_id, slot_date, slot_start, slot_end, conversation_id) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user!.userId, counselor_id, slot_date, slot_start, slot_end, conversation_id || null]
    );

    await conn.commit();
    conn.release();
    res.json({ success: true, data: { id: (result as any).insertId } });
  } catch (error: unknown) {
    await conn.rollback();
    conn.release();
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// PUT /api/psychology/appointments/:id/confirm — 咨询师确认
router.put('/:id/confirm', authenticate, async (req, res) => {
  try {
    const [counselors] = await pool.query('SELECT id FROM counselors WHERE user_id = ?', [req.user!.userId]);
    if ((counselors as any[]).length === 0) {
      res.status(403).json({ success: false, error: '不是咨询师' });
      return;
    }
    await pool.query(
      "UPDATE appointments SET status = 'confirmed' WHERE id = ? AND counselor_id = ? AND status = 'pending'",
      [req.params.id, (counselors as any[])[0].id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// PUT /api/psychology/appointments/:id/complete — 完成 + 备注
router.put('/:id/complete', authenticate, async (req, res) => {
  try {
    const [counselors] = await pool.query('SELECT id FROM counselors WHERE user_id = ?', [req.user!.userId]);
    if ((counselors as any[]).length === 0) {
      res.status(403).json({ success: false, error: '不是咨询师' });
      return;
    }
    await pool.query(
      "UPDATE appointments SET status = 'completed', notes = ? WHERE id = ? AND counselor_id = ?",
      [req.body.notes || null, req.params.id, (counselors as any[])[0].id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// PUT /api/psychology/appointments/:id/cancel — 取消
router.put('/:id/cancel', authenticate, async (req, res) => {
  try {
    const [appt] = await pool.query('SELECT * FROM appointments WHERE id = ?', [req.params.id]);
    if ((appt as any[]).length === 0) {
      res.status(404).json({ success: false, error: '预约不存在' });
      return;
    }
    await pool.query(
      "UPDATE appointments SET status = 'cancelled' WHERE id = ?",
      [req.params.id]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
```

- [ ] **Step 2: 更新 `src/routes/psychology/index.ts`**

```typescript
import appointmentsRouter from './appointments.ts';
router.use('/appointments', appointmentsRouter);
```

- [ ] **Step 3: 验证预约事务**

```bash
npm run dev:server
# 终端 1: curl -X POST -H "Authorization: Bearer <student-token>" -H "Content-Type: application/json" -d '{"counselor_id":1,"slot_date":"2026-05-20","slot_start":"14:00:00","slot_end":"14:30:00"}' http://localhost:3001/api/psychology/appointments
```
Expected: 第一次 `{"success":true,"data":{"id":1}}`，重复提交 `{"success":false,"error":"该时段已被预约"}`

- [ ] **Step 4: Commit**

```bash
git add src/routes/psychology/appointments.ts src/routes/psychology/index.ts
git commit -m "feat: add psychology appointments with transaction locking"
```

---

## 当前进度

| Task | 状态 |
|------|------|
| Task 1: WebSocket 依赖 | pending |
| Task 2: counselors 路由 | pending |
| Task 3: chat REST 路由 | pending |
| Task 4: WebSocket 端点 | pending |
| Task 5: appointments 路由 | pending |
