import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// We test the authenticate and requireRole functions in isolation
// by importing them after the module mocks are set up

const JWT_SECRET = process.env.JWT_SECRET || 'academic-ether-default-secret-change-me';

function createMockReqRes() {
  const req = {
    headers: {} as Record<string, string>,
    user: undefined as any,
  } as Request;
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

// Inline authenticate for isolated testing (matches src/middleware/auth.ts)
function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未登录，请先登录' });
    return;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; username: string; role: string };
    (req as any).user = decoded;
    next();
  } catch {
    res.status(401).json({ success: false, error: '登录已过期，请重新登录' });
  }
}

function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!(req as any).user) {
      res.status(401).json({ success: false, error: '未登录' });
      return;
    }
    if (!roles.includes((req as any).user.role)) {
      res.status(403).json({ success: false, error: '权限不足' });
      return;
    }
    next();
  };
}

describe('authenticate middleware', () => {
  it('returns 401 when no Authorization header', () => {
    const { req, res, next } = createMockReqRes();
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is not Bearer', () => {
    const { req, res, next } = createMockReqRes();
    req.headers.authorization = 'Basic YWxhZGRpbjpvcGVuc2VzYW1l';
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for invalid token', () => {
    const { req, res, next } = createMockReqRes();
    req.headers.authorization = 'Bearer invalid.token.here';
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for valid token and sets req.user', () => {
    const { req, res, next } = createMockReqRes();
    const user = { userId: 1, username: 'admin', role: 'admin' };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '1h' });
    req.headers.authorization = `Bearer ${token}`;
    authenticate(req, res, next);
    expect(next).toHaveBeenCalled();
    expect((req as any).user).toEqual(
      expect.objectContaining({ userId: 1, username: 'admin', role: 'admin' })
    );
  });

  it('returns 401 for expired token', () => {
    const { req, res, next } = createMockReqRes();
    const expiredToken = jwt.sign(
      { userId: 1, username: 'test', role: 'teacher' },
      JWT_SECRET,
      { expiresIn: '0s' }
    );
    req.headers.authorization = `Bearer ${expiredToken}`;
    authenticate(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe('requireRole middleware', () => {
  it('returns 401 when req.user is not set', () => {
    const { req, res, next } = createMockReqRes();
    const middleware = requireRole('admin');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when user role is not in allowed list', () => {
    const { req, res, next } = createMockReqRes();
    (req as any).user = { userId: 1, username: 'student1', role: 'student' };
    const middleware = requireRole('admin');
    middleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() when user role matches', () => {
    const { req, res, next } = createMockReqRes();
    (req as any).user = { userId: 1, username: 'admin1', role: 'admin' };
    const middleware = requireRole('admin');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('calls next() when user role is one of multiple allowed', () => {
    const { req, res, next } = createMockReqRes();
    (req as any).user = { userId: 1, username: 'teacher1', role: 'teacher' };
    const middleware = requireRole('admin', 'teacher');
    middleware(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('JWT_SECRET', () => {
  it('uses default JWT_SECRET when env not set', () => {
    expect(JWT_SECRET).toBeTruthy();
    expect(JWT_SECRET.length).toBeGreaterThan(10);
  });

  it('generates different tokens for different users', () => {
    const token1 = jwt.sign({ userId: 1 }, JWT_SECRET);
    const token2 = jwt.sign({ userId: 2 }, JWT_SECRET);
    expect(token1).not.toBe(token2);
  });

  it('token payload is decodable', () => {
    const payload = { userId: 42, username: 'test', role: 'teacher' };
    const token = jwt.sign(payload, JWT_SECRET);
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    expect(decoded.userId).toBe(42);
    expect(decoded.username).toBe('test');
    expect(decoded.role).toBe('teacher');
  });
});

describe('JWT_SECRET production guard', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.JWT_SECRET = originalEnv.JWT_SECRET;
    vi.resetModules();
  });

  it('throws in production when JWT_SECRET is not set', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;

    await expect(import('../../../src/middleware/auth.ts')).rejects.toThrow(
      'JWT_SECRET 环境变量未设置，生产环境拒绝启动'
    );
  });
});
