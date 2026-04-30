import { chromium, Browser, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

async function test() {
  console.log('启动浏览器...');
  const browser: Browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page: Page = await browser.newPage();

  try {
    console.log('访问评分系统...');
    await page.goto(`${BASE_URL}/scoring`);
    await page.waitForLoadState('networkidle');

    const title = await page.title();
    console.log(`页面标题: ${title}`);

    // 截图
    await page.screenshot({ path: 'test-results/scoring-home.png', fullPage: true });
    console.log('截图已保存: test-results/scoring-home.png');

    // 查找比赛链接
    const competitionLinks = page.locator('a[href*="competition"]');
    const count = await competitionLinks.count();
    console.log(`找到 ${count} 个比赛链接`);

    if (count > 0) {
      console.log('点击第一个比赛...');
      await competitionLinks.first().click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: 'test-results/competition-detail.png', fullPage: true });
      console.log('比赛详情截图已保存');
    }

    console.log('测试完成!');
  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await browser.close();
  }
}

test();
