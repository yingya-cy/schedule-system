import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('test data')),
  },
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  unlink: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('test data')),
}));

// Mock database
vi.mock('../../../src/config/database', () => ({
  default: {
    execute: vi.fn().mockResolvedValue([[]]),
    query: vi.fn().mockResolvedValue([[]]),
    getConnection: vi.fn().mockResolvedValue({
      query: vi.fn().mockResolvedValue([[]]),
      execute: vi.fn().mockResolvedValue([[]]),
      release: vi.fn(),
      beginTransaction: vi.fn(),
      commit: vi.fn(),
      rollback: vi.fn(),
    }),
  },
}));

import { FileStorageService } from '../../../src/services/fileStorageService';

describe('FileStorageService', () => {
  let service: FileStorageService;

  beforeEach(() => {
    service = new FileStorageService();
  });

  describe('storeFile', () => {
    it('stores small file in database', async () => {
      const buf = Buffer.from('hello');
      const meta = await service.storeFile('test.txt', buf, 'text/plain');
      expect(meta.filename).toBe('test.txt');
      expect(meta.fileType).toBe('text/plain');
      expect(meta.fileSize).toBe(5);
      expect(meta.fileHash).toBeDefined();
      expect(meta.storageType).toBe('database');
    });

    it('stores large file in filesystem', async () => {
      const buf = Buffer.alloc(6 * 1024 * 1024); // 6MB, above 5MB limit
      const meta = await service.storeFile('large.bin', buf, 'application/octet-stream');
      expect(meta.storageType).toBe('filesystem');
      expect(meta.filePath).toBeDefined();
      expect(meta.fileData).toBeUndefined();
    });

    it('generates consistent hash for same content', async () => {
      const buf = Buffer.from('same content');
      const meta1 = await service.storeFile('a.txt', buf, 'text/plain');
      const meta2 = await service.storeFile('b.txt', buf, 'text/plain');
      expect(meta1.fileHash).toBe(meta2.fileHash);
    });
  });
});
