import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

interface TestContext {
  token: string;
  activityId: number;
  testFolderId: number;
}

async function login(page: any) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => !url.pathname.includes('/login'));
  await page.waitForLoadState('networkidle');
}

async function getAuthToken(page: any): Promise<string> {
  const result = await page.evaluate(async () => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' }),
    });
    return res.json();
  });
  return result.data.token;
}

test.describe('文件中心 E2E', () => {
  const ctx: TestContext = { token: '', activityId: 0, testFolderId: 0 };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    const token = await getAuthToken(page);

    const activitiesRes = await page.evaluate(async (t) => {
      const res = await fetch(`${BASE_URL}/api/file-center/activities`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      return res.json();
    }, token);

    if (!activitiesRes.success || !activitiesRes.data?.length) {
      throw new Error('No activities found — seed the database first');
    }

    ctx.token = token;
    ctx.activityId = activitiesRes.data[0].id;

    // Create test folder
    const folderRes = await page.evaluate(async ({ token, activityId }) => {
      const res = await fetch(`${BASE_URL}/api/file-center/activities/${activityId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: `e2e_test_${Date.now()}` }),
      });
      return res.json();
    }, { token, activityId: ctx.activityId });

    if (!folderRes.success) {
      throw new Error(`Failed to create test folder: ${folderRes.error}`);
    }

    ctx.testFolderId = folderRes.data.id;
    await page.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!ctx.testFolderId) return;
    const page = await browser.newPage();
    await page.evaluate(async ({ token, folderId }) => {
      // Delete file items in folder
      const itemsRes = await fetch(`${BASE_URL}/api/file-center/folders/${folderId}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const items = await itemsRes.json();
      if (items.data?.files) {
        for (const f of items.data.files) {
          await fetch(`${BASE_URL}/api/file-center/items/${f.id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }
      // Delete folder
      await fetch(`${BASE_URL}/api/file-center/folders/${folderId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    }, { token: ctx.token, folderId: ctx.testFolderId });
    await page.close();
  });

  test('登录并导航到文件中心', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/file-center`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    const hasNewActivityBtn = await page.locator('button:has-text("新活动")').count();
    const hasEmptyState = await page.locator('h2:has-text("文件中心")').count();
    expect(hasNewActivityBtn > 0 || hasEmptyState > 0).toBeTruthy();
  });

  test('选择活动后加载目录树', async ({ page }) => {
    await login(page);
    await page.goto(`${BASE_URL}/file-center`);
    await page.waitForLoadState('networkidle');

    // Click first activity card
    const activityCard = page.locator('.grid button').first();
    await activityCard.click();
    await page.waitForTimeout(800);

    // Should see folder tree or "全部文件"
    await expect(page.locator('text=全部文件').first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'tests/screenshots/file-center-e2e-activity.png', fullPage: false });
  });

  test('创建测试文件项后出现在列表中', async ({ page }) => {
    // Create file item via API
    const itemRes = await page.evaluate(async ({ token, activityId, folderId }) => {
      const res = await fetch(`${BASE_URL}/api/file-center/folders/${folderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ activity_id: activityId, original_filename: 'e2e_test.txt' }),
      });
      return res.json();
    }, { token: ctx.token, activityId: ctx.activityId, folderId: ctx.testFolderId });

    expect(itemRes.success).toBeTruthy();

    // Navigate to file-center and select the activity
    await login(page);
    await page.goto(`${BASE_URL}/file-center`);
    await page.waitForLoadState('networkidle');

    const activityCard = page.locator('.grid button').first();
    await activityCard.click();
    await page.waitForTimeout(500);

    // Click the test folder in sidebar
    const folderBtn = page.locator(`text=e2e_test`).first();
    if (await folderBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await folderBtn.click();
      await page.waitForTimeout(500);
    }

    // File should appear
    await expect(page.locator('text=e2e_test.txt').first()).toBeVisible({ timeout: 5000 });

    await page.screenshot({ path: 'tests/screenshots/file-center-e2e-item.png', fullPage: false });
  });
});
