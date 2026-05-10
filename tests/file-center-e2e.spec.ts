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
  await page.fill('input[placeholder="用户名或邮箱"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => !url.pathname.includes('/login'));
  await page.waitForLoadState('networkidle');
}

test.describe('文件中心 E2E', () => {
  const ctx: TestContext = { token: '', activityId: 0, testFolderId: 0 };

  test.beforeAll(async ({ request }) => {
    const loginRes = await request.post(`${BASE_URL}/api/auth/login`, {
      data: { username: 'admin', password: 'admin123' },
    });
    const loginBody = await loginRes.json();
    const token = loginBody.data.token;

    const activitiesRes = await request.get(`${BASE_URL}/api/file-center/activities`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const activitiesBody = await activitiesRes.json();

    if (!activitiesBody.success || !activitiesBody.data?.length) {
      throw new Error('No activities found — seed the database first');
    }

    ctx.token = token;
    ctx.activityId = activitiesBody.data[0].id;

    // Create test folder
    const folderRes = await request.post(`${BASE_URL}/api/file-center/activities/${ctx.activityId}/folders`, {
      data: { name: `e2e_test_${Date.now()}` },
      headers: { Authorization: `Bearer ${token}` },
    });
    const folderBody = await folderRes.json();

    if (!folderBody.success) {
      throw new Error(`Failed to create test folder: ${folderBody.error}`);
    }

    ctx.testFolderId = folderBody.data.id;
  });

  test.afterAll(async ({ request }) => {
    if (!ctx.testFolderId) return;
    // Delete file items in folder
    const itemsRes = await request.get(`${BASE_URL}/api/file-center/folders/${ctx.testFolderId}/items`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    const items = await itemsRes.json();
    if (items.data?.files) {
      for (const f of items.data.files) {
        await request.delete(`${BASE_URL}/api/file-center/items/${f.id}`, {
          headers: { Authorization: `Bearer ${ctx.token}` },
        });
      }
    }
    // Delete folder
    await request.delete(`${BASE_URL}/api/file-center/folders/${ctx.testFolderId}`, {
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
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

  test('创建测试文件项后出现在列表中', async ({ page, request }) => {
    // Create file item via API
    const itemRes = await request.post(`${BASE_URL}/api/file-center/folders/${ctx.testFolderId}/items`, {
      data: { activity_id: ctx.activityId, original_filename: 'e2e_test.txt' },
      headers: { Authorization: `Bearer ${ctx.token}` },
    });
    const itemBody = await itemRes.json();

    expect(itemBody.success).toBeTruthy();

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
