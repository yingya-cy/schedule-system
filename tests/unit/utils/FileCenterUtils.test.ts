import { describe, it, expect } from 'vitest';
import { detectFileCategory } from '../../../src/components/views/FileCenter/FileCenterUtils';

describe('detectFileCategory', () => {
  // 图片
  it('detects common image formats', () => {
    expect(detectFileCategory('image/png', 'photo.png')).toBe('image');
    expect(detectFileCategory('image/jpeg', 'photo.jpg')).toBe('image');
    expect(detectFileCategory('image/webp', 'photo.webp')).toBe('image');
  });
  it('detects image by extension when mime is generic', () => {
    expect(detectFileCategory('', 'photo.jpeg')).toBe('image');
    expect(detectFileCategory('', 'scan.tiff')).toBe('image');
    expect(detectFileCategory('', 'design.psd')).toBe('image');
    expect(detectFileCategory('', 'logo.ai')).toBe('image');
  });

  // 视频
  it('detects common video formats', () => {
    expect(detectFileCategory('video/mp4', 'clip.mp4')).toBe('video');
    expect(detectFileCategory('video/webm', 'clip.webm')).toBe('video');
  });
  it('detects video by extension', () => {
    expect(detectFileCategory('', 'movie.mov')).toBe('video');
    expect(detectFileCategory('', 'movie.mkv')).toBe('video');
    expect(detectFileCategory('', 'movie.avi')).toBe('video');
  });

  // 音频
  it('detects audio by mime', () => {
    expect(detectFileCategory('audio/mpeg', 'song.mp3')).toBe('audio');
    expect(detectFileCategory('audio/wav', 'song.wav')).toBe('audio');
  });
  it('detects audio by extension', () => {
    expect(detectFileCategory('', 'song.flac')).toBe('audio');
    expect(detectFileCategory('', 'song.aac')).toBe('audio');
    expect(detectFileCategory('', 'song.ogg')).toBe('audio');
  });

  // 压缩包
  it('detects archive by mime', () => {
    expect(detectFileCategory('application/zip', 'archive.zip')).toBe('archive');
    expect(detectFileCategory('application/x-rar-compressed', 'archive.rar')).toBe('archive');
  });
  it('detects archive by extension', () => {
    expect(detectFileCategory('', 'backup.7z')).toBe('archive');
    expect(detectFileCategory('', 'backup.tar')).toBe('archive');
    expect(detectFileCategory('', 'backup.gz')).toBe('archive');
    expect(detectFileCategory('', 'backup.bz2')).toBe('archive');
    expect(detectFileCategory('', 'backup.xz')).toBe('archive');
    expect(detectFileCategory('', 'disk.iso')).toBe('archive');
  });

  // 文档
  it('detects document formats', () => {
    expect(detectFileCategory('application/pdf', 'doc.pdf')).toBe('document');
    expect(detectFileCategory('text/plain', 'readme.txt')).toBe('document');
    expect(detectFileCategory('application/json', 'data.json')).toBe('document');
  });
  it('detects office documents by extension', () => {
    expect(detectFileCategory('', 'report.docx')).toBe('document');
    expect(detectFileCategory('', 'data.xlsx')).toBe('document');
    expect(detectFileCategory('', 'slides.pptx')).toBe('document');
    expect(detectFileCategory('', 'data.csv')).toBe('document');
    expect(detectFileCategory('', 'notes.md')).toBe('document');
  });

  // 兜底
  it('falls back to other for unknown formats', () => {
    expect(detectFileCategory('', 'data.bin')).toBe('other');
    expect(detectFileCategory('application/octet-stream', 'unknown.xyz')).toBe('other');
  });
});
