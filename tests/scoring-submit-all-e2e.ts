import { chromium, Browser, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

async function testSubmitAll() {
  console.log('启动浏览器...');
  const browser: Browser = await chromium.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page: Page = await browser.newPage();

  try {
    console.log('1. 访问评分系统...');
    await page.goto(`${BASE_URL}/scoring`);
    await page.waitForLoadState('networkidle');

    // 点击"评委入口"
    console.log('2. 点击评委入口...');
    await page.locator('button:has-text("评委入口")').click();
    await page.waitForTimeout(500);

    // 选择比赛（下拉框选择）
    console.log('3. 选择比赛...');
    const selectEl = page.locator('select');
    await selectEl.selectOption({ value: '6' });  // 选择比赛ID=6
    await page.waitForTimeout(500);

    // 填写评委姓名
    console.log('4. 填写姓名...');
    await page.getByRole('textbox', { name: '请输入您的姓名' }).fill('测试评委1');
    await page.waitForTimeout(300);

    // 点击进入按钮
    console.log('5. 点击进入...');
    await page.locator('button:text-matches("^进入$")').click();
    await page.waitForTimeout(3000);

    // 查找数字输入框
    const numInputs = page.locator('input[type="number"]');
    const numCount = await numInputs.count();
    console.log(`找到 ${numCount} 个数字输入框`);

    if (numCount > 0) {
      await numInputs.first().fill('85');
      await page.waitForTimeout(500);

      const submitAllBtn = page.locator('button:has-text("一键提交")');
      if (await submitAllBtn.count() > 0) {
        console.log('6. 点击一键提交...');
        await submitAllBtn.first().click();
        await page.waitForTimeout(1000);

        const confirmBtn = page.locator('button:has-text("确定")');
        if (await confirmBtn.count() > 0) {
          await confirmBtn.first().click();
          await page.waitForTimeout(2000);
          console.log('测试完成!');
        }
      }
    } else {
      console.log('未找到评分输入框');
    }

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await browser.close();
  }
}

testSubmitAll();
