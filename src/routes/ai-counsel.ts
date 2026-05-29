import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader, getErrorMessage } from '../utils/db-types';

const router = Router();
const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5002';
const DIFY_URL = process.env.DIFY_URL || 'http://localhost:5001';
const DIFY_COUNSEL_API_KEY = process.env.DIFY_COUNSEL_API_KEY || '';

// 存储 DB session_id → Dify conversation_id 的映射（用于多轮对话记忆）
const difyConvMap = new Map<string, string>();
const DEFAULT_TITLE = 'New Chat';

// 共享的 DeepSeek API 调用
async function callDeepSeek(
  systemPrompt: string,
  userContent: string,
  options: { temperature?: number; maxTokens?: number; timeout?: number } = {}
): Promise<string> {
  const { temperature = 0.5, maxTokens = 300, timeout = 15000 } = options;
  const apiKey = process.env.AI_API_KEY || '';
  const baseUrl = process.env.AI_BASE_URL || 'https://ark.cn-beijing.volces.com/api/coding/v3';
  const model = process.env.AI_TEXT_MODEL || 'deepseek-v4-pro';

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
    signal: AbortSignal.timeout(timeout),
  });

  if (!response.ok) return '';
  const json: Record<string, unknown> = await response.json();
  return (json.choices as Array<{ message: { content: string } }>)?.[0]?.message?.content || '';
}

// POST /api/ai/counsel/stream — SSE 代理
router.post('/counsel/stream', authenticate, async (req, res) => {
  const { messages, session_id, model } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ success: false, error: '缺少 messages' });
    return;
  }

  // Check message length
  const lastMsg = messages[messages.length - 1];
  if (lastMsg?.content?.length > 2000) {
    res.status(400).json({ success: false, error: '消息过长，最多 2000 字' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  let sessionId = session_id;

  try {
    // Save user message first
    if (sessionId) {
      await pool.query(
        'INSERT INTO ai_counsel_messages (session_id, role, content) VALUES (?, ?, ?)',
        [sessionId, 'user', lastMsg.content]
      );
      // Update session title from first user message
      const [sessions] = await pool.query(
        'SELECT title FROM ai_counsel_sessions WHERE id = ?',
        [sessionId]
      );
      const row = (sessions as RowDataPacket[])[0];
      if (row && (row.title === DEFAULT_TITLE || row.title === '新对话' || row.title.length === 0)) {
        await pool.query(
          'UPDATE ai_counsel_sessions SET title = ? WHERE id = ?',
          [lastMsg.content.slice(0, 30), sessionId]
        );
      }
    }

    const useDify = (process.env.AI_COUNSEL_BACKEND || process.env.AI_BACKEND) === 'dify';

    // 查用户个人信息（Dify 和 Flask 共用）
    let userProfile: Record<string, string> = {};
    try {
      const [userRows] = await pool.query(
        'SELECT username, department FROM users WHERE id = ?', [req.user!.userId]
      );
      const u = (userRows as RowDataPacket[])[0];
      if (u) {
        userProfile = {
          username: String(u.username || ''),
          department: String(u.department || ''),
        };
      }
      const reqProfile = (req.body as Record<string, unknown>).profile;
      if (reqProfile && typeof reqProfile === 'object') {
        Object.assign(userProfile, reqProfile);
      }
    } catch { /* 查不到就不传 */ }

    let userContext = '';
    if (userProfile.grade) userContext += `年级:${userProfile.grade}; `;
    if (userProfile.major) userContext += `专业:${userProfile.major}; `;
    if (userProfile.college) userContext += `学院:${userProfile.college}; `;
    if (userProfile.identity) userContext += `身份:${userProfile.identity}; `;
    if (userProfile.mood) userContext += `近期情绪:${userProfile.mood}; `;
    if (userProfile.topics) userContext += `关注话题:${userProfile.topics}; `;
    if (userProfile.needs) userContext += `可能需要:${userProfile.needs}; `;
    if (userProfile.planNote) userContext += `规划:${userProfile.planNote}; `;

    const teachingWeek = (() => {
      const start = process.env.SEMESTER_START || '2026-03-02';
      const startDate = new Date(start);
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - startDate.getTime()) / 86400000);
      return String(Math.max(1, Math.ceil((diffDays + 1) / 7)));
    })();

    if (useDify) {
      // 调本地 kb-search 获取知识库上下文
      let kbContext = '';
      try {
        const kbRes = await fetch('http://localhost:5099/api/kb/search/retrieval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            knowledge_id: 'gpnu-kb',
            query: lastMsg.content,
            retrieval_setting: { top_k: 3, score_threshold: 0.3 },
          }),
          signal: AbortSignal.timeout(5000),
        });
        if (kbRes.ok) {
          const kbJson = await kbRes.json();
          const records = (kbJson.records || []) as Array<{ content: string; title: string }>;
          kbContext = records.map(r => `【${r.title}】\n${r.content.slice(0, 800)}`).join('\n\n---\n\n');
        }
      } catch { /* KB 不可用就跳过 */ }

      // Call Dify chat streaming
      const difyBody: Record<string, unknown> = {
        inputs: {
          username: userProfile.username || '',
          department: userProfile.department || '',
          grade: userProfile.grade || '',
          major: userProfile.major || '',
          college: userProfile.college || '',
          planNote: userProfile.planNote || '',
          user_context: userContext,
          current_date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
          teaching_week: teachingWeek,
          kb_context: kbContext,
        },
        query: lastMsg.content,
        response_mode: 'streaming',
        user: String(req.user!.userId),
      };
      // 多轮对话记忆：从 session → Dify conversation_id 映射中取
      const difyConvId = sessionId ? difyConvMap.get(String(sessionId)) : '';
      if (difyConvId) difyBody.conversation_id = difyConvId;

      const difyRes = await fetch(`${DIFY_URL}/v1/chat-messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${DIFY_COUNSEL_API_KEY}`,
        },
        body: JSON.stringify(difyBody),
        signal: controller.signal,
      });

      if (!difyRes.ok || !difyRes.body) {
        res.write(`data: ${JSON.stringify({ error: 'AI 服务不可用' })}\n\n`);
        res.end();
        return;
      }

      const reader = difyRes.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });

        for (const line of text.split('\n')) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.event === 'message') {
                fullContent += data.answer || '';
                if (data.conversation_id && sessionId) {
                  difyConvMap.set(String(sessionId), data.conversation_id);
                }
                res.write(`data: ${JSON.stringify({ chunk: data.answer })}\n\n`);
              } else if (data.event === 'message_end') {
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
              } else if (data.event === 'error') {
                res.write(`data: ${JSON.stringify({ error: data.message || '未知错误' })}\n\n`);
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } else {
      // 走 Flask SSE
      const flaskRes = await fetch(`${FLASK_URL}/api/ai/counsel/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          model,
          profile: userProfile,
          user_context: userContext,
          teaching_week: teachingWeek,
          current_date: new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' }),
        }),
        signal: controller.signal,
      });

      if (!flaskRes.ok || !flaskRes.body) {
        res.write(`data: ${JSON.stringify({ error: 'AI 服务不可用' })}\n\n`);
        res.end();
        return;
      }

      const reader = flaskRes.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(decoder.decode(value, { stream: true }));
      }
    }

    // AI response saved by frontend via POST /sessions/:id/messages
  } catch (err: unknown) {
    if (!controller.signal.aborted) {
      const msg = getErrorMessage(err);
      res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
    }
  } finally {
    res.end();
  }
});

// POST /api/ai/counsel/sessions — create new session
router.post('/counsel/sessions', authenticate, async (req, res) => {
  try {
    const [result] = await pool.query(
      'INSERT INTO ai_counsel_sessions (user_id, title) VALUES (?, ?)',
      [req.user!.userId, DEFAULT_TITLE]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// POST /api/ai/counsel/sessions/:id/messages — save message (called by frontend after stream)
router.post('/counsel/sessions/:id/messages', authenticate, async (req, res) => {
  try {
    const { role, content } = req.body;
    const [result] = await pool.query(
      'INSERT INTO ai_counsel_messages (session_id, role, content) VALUES (?, ?, ?)',
      [req.params.id, role, content]
    );
    res.json({ success: true, data: { id: (result as ResultSetHeader).insertId } });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// GET /api/ai/counsel/sessions — list sessions
router.get('/counsel/sessions', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM ai_counsel_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50',
      [req.user!.userId]
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// GET /api/ai/counsel/sessions/:id/messages
router.get('/counsel/sessions/:id/messages', authenticate, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM ai_counsel_messages WHERE session_id = ? ORDER BY created_at ASC',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// DELETE /api/ai/counsel/sessions/:id
router.delete('/counsel/sessions/:id', authenticate, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM ai_counsel_sessions WHERE id = ? AND user_id = ?',
      [req.params.id, req.user!.userId]
    );
    res.json({ success: true });
  } catch (error: unknown) {
    res.status(500).json({ success: false, error: getErrorMessage(error) });
  }
});

// POST /api/ai/counsel/auto-title — AI 生成对话标题
router.post('/counsel/auto-title', authenticate, async (req, res) => {
  try {
    const { messages, sessionId } = req.body;
    if (!messages || !sessionId) {
      res.status(400).json({ success: false, error: '缺少参数' });
      return;
    }
    const convoText = messages.slice(0, 4)
      .map((m: { role: string; content: string }) => m.content.slice(0, 200))
      .join('\n');

    const title = (await callDeepSeek(
      '根据对话内容生成一个简短标题（10字以内，不要引号）。直接输出标题，不要其他文字。',
      convoText,
      { temperature: 0.5, maxTokens: 30, timeout: 10000 }
    )).trim();

    if (title) {
      await pool.query('UPDATE ai_counsel_sessions SET title = ? WHERE id = ? AND user_id = ?', [title.slice(0, 30), sessionId, req.user!.userId]);
      res.json({ success: true, data: { title } });
      return;
    }
    res.json({ success: true, data: {} });
  } catch {
    res.json({ success: true, data: {} });
  }
});

// POST /api/ai/counsel/followups — 生成追问建议
router.post('/counsel/followups', authenticate, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ success: false, error: '缺少 messages' });
      return;
    }
    const recent = messages.slice(-4);
    const convoText = recent
      .map((m: { role: string; content: string }) => `[${m.role === 'user' ? '用户' : '小暖'}]: ${m.content.slice(0, 300)}`)
      .join('\n');

    const content = await callDeepSeek(
      '基于对话，生成3个用户可能接下来想问的问题。简短，每个15字以内。输出格式：每行一个问题，以 - 开头。不要其他文字。',
      convoText,
      { temperature: 0.7, maxTokens: 150, timeout: 15000 }
    );
    const questions = content.split('\n').filter((l: string) => l.trim().startsWith('-')).map((l: string) => l.replace(/^-\s*/, '').trim()).slice(0, 3);
    res.json({ success: true, data: questions });
  } catch {
    res.json({ success: true, data: [] });
  }
});

// POST /api/ai/counsel/profile-summary — 对话后提取用户画像
router.post('/counsel/profile-summary', authenticate, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ success: false, error: '缺少 messages' });
      return;
    }

    // Take last 6 exchanges
    const recent = messages.slice(-12);
    const convoText = recent
      .map((m: { role: string; content: string }) => `[${m.role === 'user' ? '用户' : '小暖'}]: ${m.content.slice(0, 300)}`)
      .join('\n');

    const content = await callDeepSeek(
      `你是一个用户画像提取助手。根据对话内容，提取用户的关注点和特征。
只输出JSON，不要其他文字：
{
  "topics": ["关注的话题1", "话题2"],
  "mood": "积极/焦虑/迷茫/平静/压力/其他",
  "needs": ["可能需要帮助的方面1", "方面2"],
  "identity": "从对话推断的用户身份（如：大二学生/考研党/毕业生等），未知则留空"
}
如果对话太短或信息不足，返回空json：{"topics":[],"mood":"","needs":[],"identity":""}`,
      `根据以下对话提取用户画像：\n\n${convoText}`,
      { temperature: 0.3, maxTokens: 300, timeout: 15000 }
    );
    const clean = content.replace(/<think[\s\S]*?<\/think>/gi, '').trim();
    try {
      const profile = JSON.parse(clean);
      res.json({ success: true, data: profile });
    } catch {
      res.json({ success: true, data: {} });
    }
  } catch {
    res.json({ success: true, data: {} }); // 静默失败，不影响对话
  }
});

export default router;
