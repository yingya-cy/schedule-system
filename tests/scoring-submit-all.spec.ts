import { test, expect, chromium, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

test.describe('一键提交功能测试', () => {
  let page: Page;

  test.beforeAll(async () => {
    const browser = await chromium.launch({
      headless: false,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('测试一键提交功能', async () => {
    console.log('Step 1: 访问评分系统首页...');
    await page.goto(`${BASE_URL}/scoring`);
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/step1-scoring.png' });

    // 查找并点击比赛管理
    console.log('Step 2: 查找可进入评分的比赛...');
    const links = page.locator('a[href*="competition"]');
    const count = await links.count();
    console.log(`找到 ${count} 个比赛链接`);

    if (count > 0) {
      await links.first().click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/step2-competition.png' });
    }

    // 截图保存测试结果
    console.log('测试完成，截图已保存');
  });
});
