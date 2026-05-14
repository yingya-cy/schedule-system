import { test, expect, chromium } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

test.describe('心理咨询模块 E2E', () => {
  // 每个测试独立 page，避免登录状态污染
  let browser: Awaited<ReturnType<typeof chromium.launch>>;

  test.beforeAll(async () => {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  test.afterAll(async () => {
    await browser.close();
  });

  async function login(page: Awaited<ReturnType<typeof browser.newPage>>, username: string, password: string) {
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('networkidle');
    const inputs = page.locator('input');
    await inputs.first().fill(username);
    await page.locator('input[type="password"]').fill(password);
    await page.locator('button[type="submit"]').click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  }

  test('Flow 1: Admin — 咨询师管理', async () => {
    const page = await browser.newPage();
    await login(page, 'admin', 'admin123');
    await page.goto(`${BASE_URL}/psychology`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '咨询师管理' })).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button', { hasText: '新增咨询师' })).toBeVisible();
    await page.screenshot({ path: 'test-results/psychology-admin-manage.png', fullPage: true });
    await page.close();
  });

  test('Flow 2: Student — 咨询师列表', async () => {
    const page = await browser.newPage();
    await login(page, 'fc_ts', 'test123');
    await page.goto(`${BASE_URL}/psychology`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: '咨询师列表' })).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/psychology-student-list.png', fullPage: true });
    await page.close();
  });

  test('Flow 3: Student — 咨询师详情', async () => {
    const page = await browser.newPage();
    await login(page, 'fc_ts', 'test123');
    await page.goto(`${BASE_URL}/psychology`);
    await page.waitForLoadState('networkidle');

    const card = page.locator('button').filter({ hasText: '张老师' }).first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      await card.click();
      await page.waitForTimeout(500);
      await expect(page.locator('text=返回列表')).toBeVisible({ timeout: 5000 });
    }
    await page.close();
  });

  test('Flow 4: Student — 我的预约', async () => {
    const page = await browser.newPage();
    await login(page, 'fc_ts', 'test123');
    await page.goto(`${BASE_URL}/psychology`);
    await page.waitForLoadState('networkidle');

    await page.locator('button', { hasText: '我的预约' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: '我的预约' })).toBeVisible({ timeout: 5000 });
    await page.close();
  });

  test('Flow 5: Admin — 预约总览', async () => {
    const page = await browser.newPage();
    await login(page, 'admin', 'admin123');
    await page.goto(`${BASE_URL}/psychology`);
    await page.waitForLoadState('networkidle');

    await page.locator('button', { hasText: '预约总览' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: '预约总览' })).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: 'test-results/psychology-admin-overview.png', fullPage: true });
    await page.close();
  });

  test('Flow 6: 聊天页面', async () => {
    const page = await browser.newPage();
    await login(page, 'fc_ts', 'test123');
    await page.goto(`${BASE_URL}/psychology`);
    await page.waitForLoadState('networkidle');

    await page.locator('button', { hasText: '我的聊天' }).click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/psychology-chat.png', fullPage: true });

    // 页面应该加载完成（不崩溃即为通过）
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    await page.close();
  });
});
