/**
 * 统一错误处理工具
 */

/**
 * 应用级错误类，包含错误码和 HTTP 状态码
 */
export class AppError extends Error {
  constructor(
    message: string,
    public code: string = 'INTERNAL_ERROR',
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      success: false as const,
      error: {
        code: this.code,
        message: this.message
      }
    };
  }
}

/**
 * 常见错误工厂
 */
export const Errors = {
  notFound: (resource: string) =>
    new AppError(`${resource} not found`, 'NOT_FOUND', 404),

  invalidInput: (message: string) =>
    new AppError(message, 'INVALID_INPUT', 400),

  databaseError: (message: string) =>
    new AppError(message, 'DATABASE_ERROR', 500),

  notImplemented: () =>
    new AppError('Not implemented', 'NOT_IMPLEMENTED', 501),
};

/**
 * 统一响应结果类型
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

/**
 * 将可能失败的操作包装为 Result 类型
 */
export async function toResult<T>(
  fn: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const code = error instanceof AppError ? error.code : 'INTERNAL_ERROR';
    return { success: false, error: { code, message } };
  }
}
