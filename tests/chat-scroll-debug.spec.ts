import { test, chromium } from '@playwright/test';

const BASE = 'http://localhost:3001';

test('诊断聊天滚动条', async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();

  // 1. 登录
  await page.goto(`${BASE}/login`);
  await page.fill('input', 'admin');
  await page.fill('input[type="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // 2. 注入大量消息
  const token = await page.evaluate(() => localStorage.getItem('auth_token'));
  for (let i = 0; i < 30; i++) {
    await fetch(`${BASE}/api/psychology/chat/4/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: `测试消息 ${i + 1}: ${'█'.repeat(20)}` }),
    });
  }

  // 3. 打开聊天
  await page.goto(`${BASE}/psychology`);
  await page.waitForLoadState('networkidle');
  await page.locator('button', { hasText: '我的聊天' }).click();
  await page.waitForTimeout(1500);

  // 4. 点击张老师会话
  const zhangBtn = page.locator('button', { hasText: '张老师' });
  if (await zhangBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await zhangBtn.click();
    await page.waitForTimeout(1000);
  }

  // 5. 诊断 — 从 body 往下逐层检查高度
  const info = await page.evaluate(() => {
    // 找所有 overflow-hidden 和 flex-1 元素
    const elements: Record<string, unknown>[] = [];
    const walk = (el: Element, depth: number) => {
      if (depth > 10) return;
      const style = window.getComputedStyle(el);
      const cls = el.className?.toString?.() || '';
      if (cls.includes('flex-1') || cls.includes('overflow') || cls.includes('h-full') || cls.includes('h-screen') || cls.includes('min-h-screen') || el.tagName === 'BODY' || el.tagName === 'HTML') {
        elements.push({
          tag: el.tagName,
          classes: cls.slice(0, 100),
          height: style.height,
          minHeight: style.minHeight,
          maxHeight: style.maxHeight,
          overflow: style.overflow,
          overflowY: style.overflowY,
          display: style.display,
          flex: style.flex,
          scrollH: (el as HTMLElement).scrollHeight,
          clientH: (el as HTMLElement).clientHeight,
          overflows: (el as HTMLElement).scrollHeight > (el as HTMLElement).clientHeight,
          depth,
        });
      }
      for (const child of el.children) walk(child, depth + 1);
    };
    walk(document.body, 0);

    // 所有内容 > 视口的元素
    const overflowing: string[] = [];
    document.querySelectorAll('*').forEach((el) => {
      if (el.scrollHeight > el.clientHeight && el.clientHeight > 0) {
        overflowing.push(`${el.tagName}.${el.className?.toString?.().split(' ').slice(0, 3).join('.')} H=${el.clientHeight} SH=${el.scrollHeight} diff=${el.scrollHeight - el.clientHeight}`);
      }
    });

    return {
      layoutChain: elements,
      overflowing: overflowing.slice(0, 15),
      viewport: window.innerHeight,
      bodySH: document.body.scrollHeight,
      bodyCH: document.body.clientHeight,
    };
  });

  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: 'test-results/chat-scroll-debug.png', fullPage: true });
  await browser.close();
});
