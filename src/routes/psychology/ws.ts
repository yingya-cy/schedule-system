import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../../middleware/auth.ts';
import pool from '../../config/database.ts';
import { RowDataPacket, ResultSetHeader } from '../../utils/db-types';

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
      const decoded = jwt.verify(token, JWT_SECRET);
      if (typeof decoded === 'string') {
        ws.close(4001, 'Invalid token');
        return;
      }
      userId = (decoded as unknown as { userId: number }).userId;
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

        const [conv] = await pool.query(
          'SELECT student_user_id, c.user_id as counselor_user_id FROM chat_conversations cc JOIN counselors c ON cc.counselor_id = c.id WHERE cc.id = ?',
          [conversationId]
        );
        const convRows = conv as RowDataPacket[];
        if (convRows.length === 0) return;

        const c = convRows[0];
        const isStudent = userId === c.student_user_id;
        const senderRole = isStudent ? 'student' : 'counselor';

        const [result] = await pool.query(
          'INSERT INTO chat_messages (conversation_id, sender_role, sender_id, content) VALUES (?, ?, ?, ?)',
          [conversationId, senderRole, userId, content]
        );

        const message = {
          id: (result as ResultSetHeader).insertId,
          conversation_id: parseInt(conversationId),
          sender_role: senderRole,
          sender_id: userId,
          content,
          created_at: new Date().toISOString(),
        };

        [c.student_user_id, c.counselor_user_id].forEach((uid: number) => {
          if (uid && clients.has(uid)) {
            clients.get(uid)!.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(message));
              }
            });
          }
        });
      } catch {
        ws.send(JSON.stringify({ error: 'Failed to send message' }));
      }
    });

    ws.on('close', () => {
      clients.get(userId)?.delete(ws);
      if (clients.get(userId)?.size === 0) clients.delete(userId);
    });
  });
}
