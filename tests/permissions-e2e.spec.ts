import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

async function login(page: any, username: string, password: string) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="用户名或邮箱"]', username);
  await page.fill('input[placeholder="请输入密码"]', password);
  await page.click('button[type="submit"]');
  try {
    await page.waitForURL((url: URL) => !url.pathname.includes('/login'), { timeout: 25000 });
    await page.waitForLoadState('networkidle');
  } catch {
    const errorText = await page.textContent('.text-error, .text-red-500, [role="alert"]').catch(() => '');
    throw new Error(`Login failed for ${username}: ${errorText || 'timeout'}`);
  }
}

// Create test users via the admin page (browser-based, not Node.js fetch)
async function ensureTestUsers(page: any) {
  await login(page, 'admin', 'admin123');
  await page.goto(`${BASE_URL}/users`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);

  for (const { username, name, role, department } of [
    { username: 'e2e_teacher', name: 'E2E教师', role: 'teacher', department: '网编部' },
    { username: 'e2e_student', name: 'E2E学生', role: 'student', department: '网编部' },
  ]) {
    // Check if already exists
    const existing = page.getByText(username);
    if (await existing.isVisible().catch(() => false)) continue;

    // Click create user button
    const createBtn = page.getByRole('button', { name: /创建用户/ });
    if (await createBtn.isVisible()) {
      await createBtn.click();
      await page.waitForTimeout(300);
      // Fill form fields
      const usernameInput = page.locator('input[placeholder*="用户名"], input[name="username"]').last();
      const nameInput = page.locator('input[placeholder*="姓名"], input[name="name"]').last();
      const passwordInput = page.locator('input[placeholder*="密码"], input[name="password"]').last();
      await usernameInput.fill(username);
      await nameInput.fill(name);
      await passwordInput.fill('test123');

      // Select role
      const roleSelect = page.locator('select').last();
      if (await roleSelect.isVisible()) {
        await roleSelect.selectOption(role);
      }

      // Click confirm/save
      const saveBtn = page.getByRole('button', { name: /创建|保存|确认/ }).last();
      await saveBtn.click();
      await page.waitForTimeout(800);
    }
  }
}

test.describe('权限 E2E 测试', () => {
  // Admin full access —— users already created via API in previous runs

  // ---- Admin full access ----
  test.describe('Admin 角色', () => {
    test('可以访问仪表盘', async ({ page }) => {
      await login(page, 'admin', 'admin123');
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).not.toContainText('未登录');
    });

    test('可以访问课表中心', async ({ page }) => {
      await login(page, 'admin', 'admin123');
      await page.goto(`${BASE_URL}/files`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).not.toContainText('未登录');
    });

    test('可以访问文件中心', async ({ page }) => {
      await login(page, 'admin', 'admin123');
      await page.goto(`${BASE_URL}/file-center`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).not.toContainText('未登录');
    });

    test('可以访问评分系统', async ({ page }) => {
      await login(page, 'admin', 'admin123');
      await page.goto(`${BASE_URL}/scoring`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).not.toContainText('未登录');
    });

    test('可以访问用户管理', async ({ page }) => {
      await login(page, 'admin', 'admin123');
      await page.goto(`${BASE_URL}/users`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).not.toContainText('未登录');
    });
  });

  // ---- Teacher access ----
  test.describe('Teacher 角色', () => {
    test('可以访问仪表盘', async ({ page }) => {
      await login(page, 'e2e_teacher', 'test123');
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).not.toContainText('未登录');
    });

    test('可以访问课表中心', async ({ page }) => {
      await login(page, 'e2e_teacher', 'test123');
      await page.goto(`${BASE_URL}/files`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).not.toContainText('未登录');
    });

    test('不可以访问用户管理（显示权限不足）', async ({ page }) => {
      await login(page, 'e2e_teacher', 'test123');
      await page.goto(`${BASE_URL}/users`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('权限不足').first()).toBeVisible({ timeout: 5000 });
    });
  });

  // ---- Student access ----
  test.describe('Student 角色', () => {
    test('可以访问仪表盘', async ({ page }) => {
      await login(page, 'e2e_student', 'test123');
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('main')).not.toContainText('未登录');
    });

    test('不可以访问用户管理（显示权限不足）', async ({ page }) => {
      await login(page, 'e2e_student', 'test123');
      await page.goto(`${BASE_URL}/users`);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('权限不足').first()).toBeVisible({ timeout: 5000 });
    });
  });

  // ---- Session expiry ----
  test.describe('会话控制', () => {
    test('未登录访问仪表盘应跳转到登录页', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/login/);
    });

    test('未登录访问用户管理应跳转到登录页', async ({ page }) => {
      await page.goto(`${BASE_URL}/users`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
