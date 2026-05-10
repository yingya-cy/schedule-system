import { describe, it, expect } from 'vitest';
import { getErrorMessage, isDuplicateEntry } from '../../../src/utils/db-types';

describe('getErrorMessage', () => {
  it('returns message from Error', () => {
    expect(getErrorMessage(new Error('test error'))).toBe('test error');
  });

  it('returns fallback for non-Error', () => {
    expect(getErrorMessage('string error')).toBe('未知错误');
    expect(getErrorMessage(null)).toBe('未知错误');
    expect(getErrorMessage(undefined)).toBe('未知错误');
  });
});

describe('isDuplicateEntry', () => {
  it('returns true for ER_DUP_ENTRY error', () => {
    const err = new Error('Duplicate entry') as Error & { code: string };
    (err as { code: string }).code = 'ER_DUP_ENTRY';
    expect(isDuplicateEntry(err)).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isDuplicateEntry(new Error('other'))).toBe(false);
    expect(isDuplicateEntry('not an error')).toBe(false);
  });
});
