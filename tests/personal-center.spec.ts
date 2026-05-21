import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';
let authToken = '';

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="用户名或邮箱"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => !url.pathname.includes('/login'));
  authToken = await page.evaluate(() => localStorage.getItem('auth_token') || '');
  await ctx.close();
});

async function goToProfile(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.evaluate((token) => localStorage.setItem('auth_token', token), authToken);
  await page.goto(`${BASE_URL}/profile`);
  await page.waitForLoadState('networkidle');
}

test.describe('个人中心', () => {
  test.beforeEach(async ({ page }) => {
    await goToProfile(page);
  });

  // ── Navigation ──

  test('侧边栏显示个人中心导航项', async ({ page }) => {
    await expect(page.locator('aside').getByText('个人中心')).toBeVisible();
  });

  test('Layout 顶栏标题显示个人中心', async ({ page }) => {
    await expect(page.locator('header h2').filter({ hasText: '个人中心' })).toBeVisible();
  });

  test('/ai-schedule 重定向到 /profile', async ({ page }) => {
    await page.goto(`${BASE_URL}/ai-schedule`);
    await page.waitForURL('**/profile');
    expect(page.url()).toContain('/profile');
  });

  // ── ProfileCard ──

  test('展示态：显示角色徽章', async ({ page }) => {
    await expect(page.getByText('管理员', { exact: true })).toBeVisible();
  });

  test('未编辑时显示引导文案', async ({ page }) => {
    await expect(page.getByText('点击编辑补充个人信息')).toBeVisible();
  });

  test('点击编辑进入编辑模式', async ({ page }) => {
    await page.getByRole('button', { name: '编辑' }).click();
    await expect(page.getByPlaceholder('年级 (如 2024级)')).toBeVisible();
    await expect(page.getByPlaceholder('专业 (如 计算机科学)')).toBeVisible();
    await expect(page.getByPlaceholder('学院 (如 信息学院)')).toBeVisible();
  });

  test('填写并保存资料', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('user_profile'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '编辑' }).click();
    await page.getByPlaceholder('年级 (如 2024级)').fill('2024级');
    await page.getByPlaceholder('专业 (如 计算机科学)').fill('计算机科学');
    await page.getByPlaceholder('学院 (如 信息学院)').fill('信息学院');
    await page.getByPlaceholder(/当前规划/).fill('准备考研');
    await page.getByRole('button', { name: '保存' }).first().click();

    await expect(page.getByText('2024级')).toBeVisible();
    await expect(page.getByText('计算机科学')).toBeVisible();
    await expect(page.getByText('信息学院')).toBeVisible();
    await expect(page.getByText('准备考研')).toBeVisible();
  });

  test('取消编辑不保存修改', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('user_profile'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '编辑' }).click();
    await page.getByPlaceholder('年级 (如 2024级)').fill('临时年级');
    await page.getByRole('button', { name: '取消' }).click();
    await expect(page.getByText('临时年级')).not.toBeVisible();
  });

  test('保存后刷新数据持久化', async ({ page }) => {
    await page.evaluate(() => localStorage.removeItem('user_profile'));
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: '编辑' }).click();
    await page.getByPlaceholder('年级 (如 2024级)').fill('持久化测试');
    await page.getByRole('button', { name: '保存' }).first().click();
    await page.waitForTimeout(300);

    await page.reload();
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('持久化测试')).toBeVisible();
  });

  // ── Tabs ──

  test('默认 AI 计划 Tab 激活', async ({ page }) => {
    await expect(page.locator('button', { hasText: 'AI 计划' })).toHaveClass(/bg-surface/);
  });

  test('切换到个人课表 Tab', async ({ page }) => {
    await page.locator('button', { hasText: '个人课表' }).click();
    await expect(page.getByText('第1-2节').first()).toBeVisible();
  });

  test('两 Tab 自由切换', async ({ page }) => {
    await page.locator('button', { hasText: '个人课表' }).click();
    await expect(page.getByText('第1-2节').first()).toBeVisible();
    await page.locator('button', { hasText: 'AI 计划' }).click();
    await expect(page.locator('button', { hasText: 'AI 计划' })).toHaveClass(/bg-surface/);
  });

  // ── Schedule tab: right panel + save button ──

  test('个人课表 Tab 显示保存按钮', async ({ page }) => {
    await page.locator('button', { hasText: '个人课表' }).click();
    await expect(page.getByText('保存课表')).toBeVisible();
  });

  test('个人课表 Tab 右侧面板显示上传和待办', async ({ page }) => {
    await page.locator('button', { hasText: '个人课表' }).click();
    await expect(page.getByText('重新上传课表')).toBeVisible();
    await expect(page.getByText('待办事项').first()).toBeVisible();
  });

  test('年级/专业输入框已移除', async ({ page }) => {
    await expect(page.getByPlaceholder('如：2024级')).not.toBeVisible();
  });

  // ── AI Plan: main view ──

  test('有本周计划时显示 PlanTimeline', async ({ page }) => {
    await expect(page.getByText('周一').first()).toBeVisible();
  });

  test('工具栏显示生成/保存/模型/历史按钮', async ({ page }) => {
    // Toolbar has all actions in one row
    await expect(page.getByText('重新生成')).toBeVisible();
    await expect(page.getByText('保存')).toBeVisible();
    await expect(page.locator('select').first()).toHaveValue('deepseek-v4-pro');
    await expect(page.getByText(/历史/)).toBeVisible();
  });

  // ── History drawer ──

  test('点击历史按钮打开抽屉', async ({ page }) => {
    await page.getByText(/^历史/).first().click();
    await page.waitForTimeout(500);
    await expect(page.locator('.lucide-x').first()).toBeVisible();
  });

  test('抽屉内点击计划卡片查看详情', async ({ page }) => {
    await page.getByText(/^历史/).first().click();
    await page.waitForTimeout(800);
    const planCard = page.locator('button', { hasText: '起 ·' }).first();
    const count = await planCard.count();
    if (count > 0) {
      await planCard.click();
      await page.waitForTimeout(800);
      await expect(page.locator('.lucide-chevron-left').first()).toBeVisible();
    }
  });
});
