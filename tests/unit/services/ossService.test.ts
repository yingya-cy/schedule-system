import { describe, it, expect, vi } from 'vitest';

const mockSignatureUrlV4 = vi.fn();
const mockGet = vi.fn();

vi.mock('ali-oss', () => ({
  default: function MockOSS() { return { signatureUrlV4: mockSignatureUrlV4, get: mockGet }; },
}));

// Use a single dynamic import — mock is applied before module loads
const ossService = () => import('../../../src/services/ossService.ts');

describe('ossService', () => {
  describe('buildObjectKey', () => {
    it('sanitizes slashes in activity name', async () => {
      const { buildObjectKey } = await ossService();
      expect(buildObjectKey('act/name', 'folder', 1, 'f.pdf')).toContain('act_name');
    });

    it('sanitizes .. in folder name', async () => {
      const { buildObjectKey } = await ossService();
      expect(buildObjectKey('act', '..', 1, 'f.pdf')).not.toContain('/../');
    });

    it('produces expected format', async () => {
      const { buildObjectKey } = await ossService();
      expect(buildObjectKey('设计大赛', '初赛', 42, '作品.pdf'))
        .toBe('file-center/设计大赛/初赛/42_作品.pdf');
    });

    it('sanitizes slashes in filename', async () => {
      const { buildObjectKey } = await ossService();
      expect(buildObjectKey('act', 'fld', 1, 'a/b.pdf')).not.toContain('a/b');
    });
  });

  describe('getObjectUrl', () => {
    it('builds public URL', async () => {
      const { getObjectUrl } = await ossService();
      expect(getObjectUrl('path/file.pdf')).toContain('aliyuncs.com');
    });

    it('uses custom endpoint when configured', async () => {
      process.env.OSS_ENDPOINT = 'https://custom.cdn.com';
      const { getObjectUrl } = await ossService();
      expect(getObjectUrl('path/file.pdf')).toContain('custom.cdn.com');
      delete process.env.OSS_ENDPOINT;
    });
  });

  describe('generatePresignedUploadUrl', () => {
    it('generates presigned URL when OSS is configured', async () => {
      process.env.OSS_ACCESS_KEY_ID = 'test-key';
      process.env.OSS_ACCESS_KEY_SECRET = 'test-secret';
      mockSignatureUrlV4.mockResolvedValue('https://oss.example.com/upload-url');

      const { generatePresignedUploadUrl } = await ossService();
      const result = await generatePresignedUploadUrl('test/file.pdf', 'application/pdf');

      expect(result.uploadUrl).toBe('https://oss.example.com/upload-url');
      expect(result.objectKey).toBe('test/file.pdf');
      expect(result.expiresIn).toBe(3600);

      delete process.env.OSS_ACCESS_KEY_ID;
      delete process.env.OSS_ACCESS_KEY_SECRET;
    });

    it('throws when OSS is not configured', async () => {
      delete process.env.OSS_ACCESS_KEY_ID;
      delete process.env.OSS_ACCESS_KEY_SECRET;
      const { generatePresignedUploadUrl } = await ossService();
      await expect(generatePresignedUploadUrl('test/file.pdf')).rejects.toThrow('OSS 未配置');
    });
  });

  describe('generatePresignedDownloadUrl', () => {
    it('generates download URL when OSS is configured', async () => {
      process.env.OSS_ACCESS_KEY_ID = 'test-key';
      process.env.OSS_ACCESS_KEY_SECRET = 'test-secret';
      mockSignatureUrlV4.mockResolvedValue('https://oss.example.com/dl-url');

      const { generatePresignedDownloadUrl } = await ossService();
      const url = await generatePresignedDownloadUrl('test/file.pdf');

      expect(url).toBe('https://oss.example.com/dl-url');

      delete process.env.OSS_ACCESS_KEY_ID;
      delete process.env.OSS_ACCESS_KEY_SECRET;
    });

    it('throws when OSS is not configured', async () => {
      delete process.env.OSS_ACCESS_KEY_ID;
      delete process.env.OSS_ACCESS_KEY_SECRET;
      const { generatePresignedDownloadUrl } = await ossService();
      await expect(generatePresignedDownloadUrl('test/file.pdf')).rejects.toThrow('OSS 未配置');
    });
  });

  describe('getObjectContent', () => {
    it('fetches object content and content-type', async () => {
      process.env.OSS_ACCESS_KEY_ID = 'test-key';
      process.env.OSS_ACCESS_KEY_SECRET = 'test-secret';
      mockGet.mockResolvedValue({
        content: Buffer.from('hello'),
        res: { headers: { 'content-type': 'text/plain' } },
      });

      const { getObjectContent } = await ossService();
      const result = await getObjectContent('test/file.txt');

      expect(result.body.toString()).toBe('hello');
      expect(result.contentType).toBe('text/plain');

      delete process.env.OSS_ACCESS_KEY_ID;
      delete process.env.OSS_ACCESS_KEY_SECRET;
    });

    it('defaults content-type when header missing', async () => {
      process.env.OSS_ACCESS_KEY_ID = 'test-key';
      process.env.OSS_ACCESS_KEY_SECRET = 'test-secret';
      mockGet.mockResolvedValue({
        content: Buffer.from('data'),
        res: { headers: {} },
      });

      const { getObjectContent } = await ossService();
      const result = await getObjectContent('test/file.bin');

      expect(result.contentType).toBe('application/octet-stream');

      delete process.env.OSS_ACCESS_KEY_ID;
      delete process.env.OSS_ACCESS_KEY_SECRET;
    });

    it('throws when OSS is not configured', async () => {
      delete process.env.OSS_ACCESS_KEY_ID;
      delete process.env.OSS_ACCESS_KEY_SECRET;
      const { getObjectContent } = await ossService();
      await expect(getObjectContent('test/file.pdf')).rejects.toThrow('OSS 未配置');
    });
  });
});
