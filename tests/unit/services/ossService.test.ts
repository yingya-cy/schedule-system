import { describe, it, expect } from 'vitest';

describe('ossService', () => {
  describe('buildObjectKey', () => {
    it('sanitizes slashes in activity name', async () => {
      const { buildObjectKey } = await import('../../../src/services/ossService.ts');
      expect(buildObjectKey('act/name', 'folder', 1, 'f.pdf')).toContain('act_name');
    });

    it('sanitizes .. in folder name', async () => {
      const { buildObjectKey } = await import('../../../src/services/ossService.ts');
      expect(buildObjectKey('act', '..', 1, 'f.pdf')).not.toContain('/../');
    });

    it('produces expected format', async () => {
      const { buildObjectKey } = await import('../../../src/services/ossService.ts');
      expect(buildObjectKey('设计大赛', '初赛', 42, '作品.pdf'))
        .toBe('file-center/设计大赛/初赛/42_作品.pdf');
    });

    it('sanitizes slashes in filename', async () => {
      const { buildObjectKey } = await import('../../../src/services/ossService.ts');
      expect(buildObjectKey('act', 'fld', 1, 'a/b.pdf')).not.toContain('a/b');
    });
  });

  describe('getObjectUrl', () => {
    it('builds public URL', async () => {
      const { getObjectUrl } = await import('../../../src/services/ossService.ts');
      expect(getObjectUrl('path/file.pdf')).toContain('aliyuncs.com');
    });
  });
});
