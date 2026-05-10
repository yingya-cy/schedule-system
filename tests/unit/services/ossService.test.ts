import { describe, it, expect } from 'vitest';

// ossService functions are tested via import (may fail without OSS config, so test pure helpers only)
// The safePathSegment and buildObjectKey logic can be tested by importing buildObjectKey

describe('ossService key building', () => {
  // buildObjectKey is a pure function — test path traversal protection
  it('buildObjectKey sanitizes slashes in activity name', async () => {
    const { buildObjectKey } = await import('../../../src/services/ossService.ts');
    const key = buildObjectKey('act/name', 'folder', 1, 'file.pdf');
    expect(key).not.toContain('act/name');
    expect(key).toContain('act_name');
  });

  it('buildObjectKey sanitizes backslashes', async () => {
    const { buildObjectKey } = await import('../../../src/services/ossService.ts');
    const key = buildObjectKey('act\\name', 'folder', 1, 'file.pdf');
    expect(key).not.toContain('act\\name');
  });

  it('buildObjectKey sanitizes .. in folder name', async () => {
    const { buildObjectKey } = await import('../../../src/services/ossService.ts');
    const key = buildObjectKey('activity', '..', 1, 'file.pdf');
    expect(key).not.toContain('/../');
  });

  it('buildObjectKey produces expected format', async () => {
    const { buildObjectKey } = await import('../../../src/services/ossService.ts');
    const key = buildObjectKey('设计大赛', '初赛', 42, '作品.pdf');
    expect(key).toBe('file-center/设计大赛/初赛/42_作品.pdf');
  });

  it('buildObjectKey sanitizes slashes in filename', async () => {
    const { buildObjectKey } = await import('../../../src/services/ossService.ts');
    const key = buildObjectKey('activity', 'folder', 1, 'a/b.pdf');
    expect(key).not.toContain('a/b');
    expect(key).toContain('a_b');
  });
});
