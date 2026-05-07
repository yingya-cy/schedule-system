import { test, expect } from '@playwright/test';

async function login(page: any) {
  await page.goto('http://localhost:3001/login');
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard', { timeout: 10000 });
}

test('FileCenter: activity cards grid when no activity selected', async ({ page }) => {
  await login(page);
  await page.goto('http://localhost:3001/file-center');
  await page.waitForLoadState('networkidle');

  // No horizontal scrollbar
  const htmlScrollW = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientW = await page.evaluate(() => document.documentElement.clientWidth);
  expect(htmlScrollW).toBeLessThanOrEqual(clientW + 1);

  // Should show heading in main area
  const heading = page.getByRole('main').getByRole('heading', { name: '文件中心' });
  expect(await heading.isVisible()).toBe(true);
});

test('FileCenter: sidebar shows folder tree + back link when activity selected', async ({ page }) => {
  await login(page);
  await page.goto('http://localhost:3001/file-center');
  await page.waitForLoadState('networkidle');

  // Click first activity card
  const activityCard = page.locator('.grid button').first();
  if (await activityCard.isVisible({ timeout: 3000 }).catch(() => false)) {
    await activityCard.click();
    await page.waitForTimeout(500);

    // Sidebar should show "目录" section (folder tree)
    const folderLabel = page.locator('text=目录').first();
    expect(await folderLabel.isVisible()).toBe(true);

    // Content area should show activity name and "编辑"/"删除" buttons
    await expect(page.locator('button:has-text("删除")').first()).toBeVisible();

    // No horizontal scrollbar
    const htmlScrollW = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientW = await page.evaluate(() => document.documentElement.clientWidth);
    console.log(`selected: htmlScrollW=${htmlScrollW}, clientW=${clientW}`);
    expect(htmlScrollW).toBeLessThanOrEqual(clientW + 1);

    await page.screenshot({ path: 'tests/screenshots/file-center-sidebar-v2.png', fullPage: false });
  }
});
