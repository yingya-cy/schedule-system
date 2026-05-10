import { Response } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export function sendError(res: Response, error: unknown, statusCode = 500): void {
  console.error(`[Error] ${(error as Error).message || error}`);
  const message = isProduction ? '服务器内部错误' : (error as Error).message;
  res.status(statusCode).json({ success: false, error: message });
}
