import { Response } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export function sendError(res: Response, error: unknown, statusCode = 500): void {
  const errMsg = error instanceof Error ? error.message : String(error);
  console.error(`[Error] ${errMsg}`);
  const message = isProduction ? '服务器内部错误' : errMsg;
  res.status(statusCode).json({ success: false, error: message });
}
