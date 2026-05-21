import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import pool from '../config/database';
import { RowDataPacket, ResultSetHeader, getErrorMessage } from '../utils/db-types';

const router = Router();
const FLASK_URL = process.env.FLASK_URL || 'http://localhost:5002';
const DEFAULT_TITLE = 'New Chat';

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

    // Proxy to Flask SSE
    const flaskRes = await fetch(`${FLASK_URL}/api/ai/counsel/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model }),
      signal: controller.signal,
    });

    if (!flaskRes.ok || !flaskRes.body) {
      res.write(`data: ${JSON.stringify({ error: 'AI 服务不可用' })}\n\n`);
      res.end();
      return;
    }

    const reader = flaskRes.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });

      // Parse SSE frames and track full response
      for (const line of text.split('\n')) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.done && !data.error) {
              fullContent = data.full_length ? '(streamed)' : data.chunk || '';
            }
          } catch { /* ignore parse errors */ }
        }
      }

      res.write(text);
    }

    // Note: AI response saved by frontend via POST /sessions/:id/messages after stream completes
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

export default router;
