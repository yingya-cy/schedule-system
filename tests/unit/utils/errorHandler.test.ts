import { describe, it, expect, vi } from 'vitest';
import { sendError } from '../../../src/utils/errorHandler.ts';

describe('sendError', () => {
  it('returns 500 status with error message', () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    sendError(res, new Error('test error'));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('handles non-Error objects', () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    sendError(res, 'string error');
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('accepts custom status code', () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;
    sendError(res, new Error('not found'), 404);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
