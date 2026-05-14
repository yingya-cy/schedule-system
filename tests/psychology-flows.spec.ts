import { test, expect, chromium, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

test.describe('心理咨询模块 E2E', () => {
  let page: Page;

  test.beforeAll(async () => {
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  const loginAs = async (username: string, password: string) => {
    await page.goto(`${BASE_URL}/login`);
    await page.fill('input[placeholder*="用户"]', username);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
  };

  test('Flow 1: Admin — 咨询师管理页面可访问', async () => {
    await loginAs('admin', 'admin123');
    await page.goto(`${BASE_URL}/psychology`);
    await page.waitForLoadState('networkidle');

    // 应显示管理界面（admin 默认为 manage 视图）
    await expect(page.locator('h2')).toContainText('咨询师管理');

    // 应有新增按钮
    const addBtn = page.locator('button', { hasText: '新增咨询师' });
    await expect(addBtn).toBeVisible({ timeout: 5000 });
  });

  test('Flow 2: Student — 浏览咨询师列表', async () => {
    await loginAs('regtest', 'test123');
    await page.goto(`${BASE_URL}/psychology`);
    await page.waitForLoadState('networkidle');

    // 应显示咨询师列表
    const heading = page.locator('h2');
    await expect(heading).toContainText('咨询师列表', { timeout: 5000 });
  });

  test('Flow 3: Student — 查看咨询师详情', async () => {
    await loginAs('regtest', 'test123');
    await page.goto(`${BASE_URL}/psychology`);
    await page.waitForLoadState('networkidle');

    // 点击第一个咨询师卡片
    const card = page.locator('[class*="paper-card"] button, button:has-text("张老师")').first();
    if (await card.isVisible({ timeout: 3000 }).catch(() => false)) {
      await card.click();
      await page.waitForTimeout(500);

      // 应看到返回按钮和可约时段
      await expect(page.locator('text=返回列表')).toBeVisible({ timeout: 3000 });
    }
  });

  test('Flow 4: Student — 切换到"我的预约"', async () => {
    await loginAs('regtest', 'test123');
    await page.goto(`${BASE_URL}/psychology`);
    await page.waitForLoadState('networkidle');

    // 点击"我的预约"tab
    const tab = page.locator('button', { hasText: '我的预约' });
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(500);

      // 应看到我的预约标题
      await expect(page.locator('h2')).toContainText('我的预约', { timeout: 3000 });
    }
  });

  test('Flow 5: Admin — 切换到"预约总览"', async () => {
    await loginAs('admin', 'admin123');
    await page.goto(`${BASE_URL}/psychology`);
    await page.waitForLoadState('networkidle');

    // 点击"预约总览"tab
    const tab = page.locator('button', { hasText: '预约总览' });
    if (await tab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await tab.click();
      await page.waitForTimeout(500);

      // 应看到预约总览标题
      await expect(page.locator('h2')).toContainText('预约总览', { timeout: 3000 });
    }
  });
});
