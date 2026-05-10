import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const DEFAULT_SECRET = 'academic-ether-default-secret-change-me';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

if (JWT_SECRET === DEFAULT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET 环境变量未设置，生产环境拒绝启动');
  }
  console.warn('⚠ JWT_SECRET 使用默认值，请在生产环境设置环境变量');
}

export interface AuthUser {
  userId: number;
  username: string;
  role: 'admin' | 'teacher' | 'student' | 'department_head';
  department?: string;
}

export interface JudgeUser {
  judgeId: number;
  competitionId: number;
  type: 'judge';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      judge?: JudgeUser;
    }
  }
}

function getToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return null;
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: '未登录，请先登录' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
  }
}

export function judgeAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ success: false, error: '评委未登录' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'judge') {
      res.status(401).json({ success: false, error: '无效的评委令牌' });
      return;
    }
    req.judge = decoded as JudgeUser;
    next();
  } catch {
    res.status(401).json({ success: false, error: '评委登录已过期，请重新登录' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
    next();
  };
}

export { JWT_SECRET };
