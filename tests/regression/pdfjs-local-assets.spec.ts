import { test, expect } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 回归测试：PDF.js 必须自托管，不得依赖外部 CDN。
 *
 * 背景：cdn.jsdelivr.net 解析到 Cloudflare IP，在国内网络不可达。
 * 一旦 worker 走该 CDN，上传 PDF 会报：
 *   Setting up fake worker failed: "Failed to fetch dynamically imported module: .../pdf.worker.mjs"
 * 因此 worker 与 cmaps 落在 public/pdfjs/，随 dist 一起发布。
 */

const ROOT = process.cwd();
const DIST = path.join(ROOT, 'dist');
const PDFJS_LIB = path.join(ROOT, 'node_modules', 'pdfjs-dist', 'build');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.bcmap': 'application/octet-stream',
};

let server: http.Server;
let origin = '';

function sendFile(res: http.ServerResponse, filePath: string): void {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(filePath)] ?? 'application/octet-stream',
    });
    res.end(data);
  });
}

// 本机只装了完整 chromium，没有 chromium-headless-shell；
// channel: 'chromium' 走完整二进制的新版 headless，page.pdf() 才可用。
test.use({ channel: 'chromium' });

test.beforeAll(async () => {
  server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);

    // 静态测试页，避免加载整个 SPA（本地无后端）
    if (urlPath === '/__pdfjs_test__.html') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!doctype html><meta charset="utf-8"><title>pdfjs harness</title>');
      return;
    }

    // 把 node_modules 里的 pdf.js 主库也喂给浏览器，测试完全自包含
    if (urlPath.startsWith('/pdfjs-lib/')) {
      sendFile(res, path.join(PDFJS_LIB, urlPath.slice('/pdfjs-lib/'.length)));
      return;
    }

    const distPath = path.join(DIST, urlPath);
    if (urlPath !== '/' && distPath.startsWith(DIST) && fs.existsSync(distPath) && fs.statSync(distPath).isFile()) {
      sendFile(res, distPath);
      return;
    }
    // 镜像线上 nginx：/pdfjs/ 下配了 try_files $uri =404，缺文件必须 404，
    // 不能落到 SPA 兜底 —— 否则 worker/cmap 缺失会静默变成一份 HTML（200 + text/html）
    if (urlPath.startsWith('/pdfjs/')) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found');
      return;
    }
    sendFile(res, path.join(DIST, 'index.html'));
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address();
  if (addr === null || typeof addr === 'string') {
    throw new Error('无法获取测试服务器端口');
  }
  origin = 'http://127.0.0.1:' + addr.port;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

test('构建产物自带 pdfjs worker 与 cmaps', async ({ request }) => {
  const worker = await request.get(origin + '/pdfjs/pdf.worker.min.js');
  expect(worker.status()).toBe(200);
  expect(worker.headers()['content-type']).toContain('javascript');
  expect((await worker.body()).length).toBeGreaterThan(100000);

  const cmap = await request.get(origin + '/pdfjs/cmaps/UniGB-UCS2-H.bcmap');
  expect(cmap.status()).toBe(200);
  expect((await cmap.body()).length).toBeGreaterThan(0);
});

test('源码不再引用 cdn.jsdelivr.net', () => {
  const files = ['src/utils/pdfParser.ts', 'src/components/views/FilePreviewModal.tsx'];
  for (const file of files) {
    const code = fs
      .readFileSync(path.join(ROOT, file), 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(code, file + ' 仍在使用不可达的 cdn.jsdelivr.net').not.toContain('cdn.jsdelivr.net');
  }
});

test('nginx 为 /pdfjs/ 配了拒绝 SPA 兜底的 location', () => {
  // 没有这个块时请求会命中 location / 的 try_files $uri $uri/ /index.html，
  // 缺文件返回的是一份 HTML 带 200：worker 被当 HTML 解析、cmap 被当二进制喂给
  // pdf.js，两者都是静默失败，而且丢掉了 404 这个唯一的排查信号。
  const conf = fs.readFileSync(path.join(ROOT, 'nginx', 'nginx.conf'), 'utf8');
  expect(conf).toMatch(/location\s+\/pdfjs\/\s*\{/);
  expect(conf).toMatch(/try_files\s+\$uri\s+=404;/);
});

test('/pdfjs/ 缺失资源返回 404，且不误伤 SPA 兜底', async ({ request }) => {
  expect((await request.get(origin + '/pdfjs/__missing__.js')).status()).toBe(404);
  expect((await request.get(origin + '/pdfjs/cmaps/__missing__.bcmap')).status()).toBe(404);

  // 对照组：应用路由仍要落到 index.html
  const spaRoute = await request.get(origin + '/dashboard');
  expect(spaRoute.status()).toBe(200);
  expect(spaRoute.headers()['content-type']).toContain('text/html');
});

test('浏览器用本地 worker 解析真实 PDF 且不请求外网 CDN', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (req) => {
    if (!req.url().startsWith(origin)) external.push(req.url());
  });

  // 用 Chromium 现场生成一个真实 PDF，避免提交二进制测试样本
  const genPage = await page.context().newPage();
  await genPage.setContent('<h1>Operating System Review</h1><p>Monday Tuesday Wednesday</p>');
  const pdfBuffer = await genPage.pdf();
  await genPage.close();

  await page.goto(origin + '/__pdfjs_test__.html');

  const result = await page.evaluate(async (b64: string) => {
    const libPath: string = '/pdfjs-lib/pdf.min.mjs';
    const pdfjs = await import(libPath);
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.js';

    const raw = atob(b64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);

    const doc = await pdfjs.getDocument({
      data: bytes,
      cMapUrl: '/pdfjs/cmaps/',
      cMapPacked: true,
    }).promise;

    let text = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const content = await (await doc.getPage(p)).getTextContent();
      text += content.items
        .map((item: { str?: string }) => item.str ?? '')
        .join(' ');
    }
    return { numPages: doc.numPages as number, text };
  }, pdfBuffer.toString('base64'));

  expect(result.numPages).toBeGreaterThan(0);
  expect(result.text).toContain('Operating System Review');
  expect(external.filter((u) => u.includes('jsdelivr'))).toEqual([]);
});
