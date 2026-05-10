// @vitest-environment jsdom

import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest';

// Mock pdfParser to avoid its dependency chain
vi.mock('../../../src/utils/pdfParser', () => ({
  extractRawTextForDetection: vi.fn().mockResolvedValue('星期一 星期二 test content'),
}));

// Mock dataMappers
vi.mock('../../../src/utils/dataMappers', () => ({
  mapBackendDataToArray: vi.fn((data: unknown[]) => data),
}));

const { detectScheduleType, processSingleFile, processImageFile } = await import('../../../src/services/fileProcessor.ts');

describe('detectScheduleType', () => {
  it('returns standard for narrow images', async () => {
    // Mock HTMLImageElement
    const origImage = globalThis.Image;
    globalThis.Image = class {
      width = 100;
      height = 100;
      _onload: (() => void) | null = null;
      set src(_: string) { setTimeout(() => this._onload?.(), 1); }
      set onload(fn: () => void) { this._onload = fn; }
      set onerror(_: () => void) {}
    } as unknown as typeof Image;

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const result = await detectScheduleType(file);
    expect(result).toBe('standard');

    globalThis.Image = origImage;
  });

  it('returns dense_wide for wide images', async () => {
    const origImage = globalThis.Image;
    globalThis.Image = class {
      width = 2000;
      height = 100;
      _onload: (() => void) | null = null;
      set src(_: string) { setTimeout(() => this._onload?.(), 1); }
      set onload(fn: () => void) { this._onload = fn; }
      set onerror(_: () => void) {}
    } as unknown as typeof Image;

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    const result = await detectScheduleType(file);
    expect(result).toBe('dense_wide');

    globalThis.Image = origImage;
  });
});

describe('processSingleFile', () => {
  it('routes non-PDF files to image processing', async () => {
    const origImage = globalThis.Image;
    globalThis.Image = class {
      width = 100; height = 100;
      _onload: (() => void) | null = null;
      set src(_: string) { setTimeout(() => this._onload?.(), 1); }
      set onload(fn: () => void) { this._onload = fn; }
      set onerror(_: () => void) {}
    } as unknown as typeof Image;

    const file = new File(['test'], 'test.txt', { type: 'text/plain' });
    const result = await processSingleFile(file);
    // Routes to processImageFile which needs fetch → falls through to error
    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('filename', 'test.txt');

    globalThis.Image = origImage;
  });
});

describe('processImageFile success path', () => {
  it('processes image and returns courses on success', async () => {
    const origImage = globalThis.Image;
    globalThis.Image = class {
      width = 100; height = 100;
      _onload: (() => void) | null = null;
      set src(_: string) { setTimeout(() => this._onload?.(), 1); }
      set onload(fn: () => void) { this._onload = fn; }
      set onerror(_: () => void) {}
    } as unknown as typeof Image;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        schedule_data: [{ course_name: 'Math', weekday: 1, sections: [1, 2], weeks: [1, 2, 3] }],
      }),
    }) as unknown as typeof fetch;

    const file = new File(['test'], 'img.png', { type: 'image/png' });
    const result = await processImageFile(file);

    expect(result.success).toBe(true);
    expect(result.filename).toBe('img.png');

    globalThis.Image = origImage;
  });

  it('returns error when API returns no data', async () => {
    const origImage = globalThis.Image;
    globalThis.Image = class {
      width = 100; height = 100;
      _onload: (() => void) | null = null;
      set src(_: string) { setTimeout(() => this._onload?.(), 1); }
      set onload(fn: () => void) { this._onload = fn; }
      set onerror(_: () => void) {}
    } as unknown as typeof Image;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: false, error: 'No data found' }),
    }) as unknown as typeof fetch;

    const file = new File(['test'], 'img2.png', { type: 'image/png' });
    const result = await processImageFile(file);

    expect(result.success).toBe(false);
    expect(result.error).toContain('No data found');

    globalThis.Image = origImage;
  });
});

describe('processImageFile', () => {
  it('handles AbortError gracefully', async () => {
    const origImage = globalThis.Image;
    globalThis.Image = class {
      width = 100;
      height = 100;
      _onload: (() => void) | null = null;
      set src(_: string) { setTimeout(() => this._onload?.(), 1); }
      set onload(fn: () => void) { this._onload = fn; }
      set onerror(_: () => void) {}
    } as unknown as typeof Image;

    const abortErr = new DOMException('Aborted', 'AbortError');
    globalThis.fetch = vi.fn().mockRejectedValue(abortErr) as unknown as typeof fetch;

    const controller = new AbortController();
    controller.abort();
    const file = new File(['test'], 'img.png', { type: 'image/png' });
    const result = await processImageFile(file, controller.signal);

    expect(result.success).toBe(false);
    expect(result.error).toBe('识别已中断');

    globalThis.Image = origImage;
  });
});

describe('processVerticalPdf', () => {
  let processVerticalPdf: typeof import('../../../src/services/fileProcessor.ts')['processVerticalPdf'];
  beforeAll(async () => {
    processVerticalPdf = (await import('../../../src/services/fileProcessor.ts')).processVerticalPdf;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('handles AbortError gracefully', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    globalThis.fetch = vi.fn().mockRejectedValue(abortErr) as unknown as typeof fetch;

    const file = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
    const controller = new AbortController();
    controller.abort();
    const result = await processVerticalPdf(file, controller.signal);

    expect(result.success).toBe(false);
    expect(result.error).toBe('识别已中断');
  });

  it('processes vertical PDF on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        success: true,
        schedule_data: [{ course_name: 'Physics', weekday: 2, sections: [3, 4], weeks: [1, 2] }],
      }),
    }) as unknown as typeof fetch;

    const file = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
    const result = await processVerticalPdf(file);

    expect(result.success).toBe(true);
    expect(result.filename).toBe('doc.pdf');
  });
});

describe('processHorizontalPdf', () => {
  let processHorizontalPdf: typeof import('../../../src/services/fileProcessor.ts')['processHorizontalPdf'];
  beforeAll(async () => {
    processHorizontalPdf = (await import('../../../src/services/fileProcessor.ts')).processHorizontalPdf;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('handles AbortError gracefully', async () => {
    const abortErr = new DOMException('Aborted', 'AbortError');
    globalThis.fetch = vi.fn().mockRejectedValue(abortErr) as unknown as typeof fetch;

    const file = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
    const controller = new AbortController();
    controller.abort();
    const result = await processHorizontalPdf(file, controller.signal);

    expect(result.success).toBe(false);
    expect(result.error).toBe('识别已中断');
  });

  it('processes horizontal PDF on AI success', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          schedule_data: [{ course_name: 'Chemistry', weekday: 3, sections: [5], weeks: [3, 4] }],
        }),
      }) as unknown as typeof fetch;

    const file = new File(['test'], 'doc.pdf', { type: 'application/pdf' });
    const result = await processHorizontalPdf(file);

    expect(result.success).toBe(true);
    expect(result.filename).toBe('doc.pdf');
  });
});
