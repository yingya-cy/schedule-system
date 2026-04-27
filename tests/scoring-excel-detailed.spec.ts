import { test, expect, chromium, Page } from '@playwright/test';

const TEST_FILE = 'C:\\Users\\MR\\xwechat_files\\wxid_e5qlx658vlm822_ca40\\msg\\file\\2026-04\\"微光润心，健康同行"心理科普短视频大赛复赛评分表（改版）(2).xlsx';
const BASE_URL = 'http://localhost:3001';

test.describe('评分系统 Excel 导入功能详细测试', () => {
  let page: Page;

  test.beforeAll(async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('1. 导航到比赛详情并找到导入Excel按钮', async () => {
    console.log('Step 1: 访问评分系统 -> 比赛管理...');
    await page.goto(`${BASE_URL}/scoring`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 点击比赛管理
    await page.locator('text=比赛管理').first().click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/d1-competition-list.png', fullPage: true });

    // 获取比赛列表中所有可点击的项目
    const competitionItems = page.locator('[class*="card"], [class*="item"], [class*="list"]').all();
    console.log(`Found ${competitionItems.length} list items`);

    // 找到第一个比赛卡片并点击
    const firstCard = page.locator('.bg-surface button, .bg-surface [role="button"]').first();
    const isVisible = await firstCard.isVisible().catch(() => false);

    if (isVisible) {
      console.log('点击第一个比赛卡片...');
      await firstCard.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: 'test-results/d1-competition-detail.png', fullPage: true });
    console.log('比赛详情页面已截图');

    // 查找所有按钮文本
    const buttons = await page.locator('button').allTextContents();
    console.log('页面上的按钮:', buttons);
  });

  test('2. 点击选手标签页', async () => {
    console.log('Step 2: 点击选手标签页...');

    // 查找并点击选手标签
    const tabButton = page.locator('button').filter({ hasText: /^选手/ }).first();
    const hasTab = await tabButton.isVisible().catch(() => false);

    if (hasTab) {
      console.log('点击选手标签...');
      await tabButton.click();
      await page.waitForTimeout(1500);
    }

    await page.screenshot({ path: 'test-results/d2-contestants-tab.png', fullPage: true });

    // 再次获取所有按钮
    const buttons = await page.locator('button').allTextContents();
    console.log('选手标签页按钮:', buttons);

    // 查找导入Excel按钮
    const importBtn = page.locator('button').filter({ hasText: /导入.*Excel|Excel.*导入/ }).first();
    const hasImportBtn = await importBtn.isVisible().catch(() => false);
    console.log(`导入Excel按钮可见: ${hasImportBtn}`);

    if (hasImportBtn) {
      await importBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: 'test-results/d2-import-modal.png', fullPage: true });
    }
  });

  test('3. 在导入模态框中上传文件', async () => {
    console.log('Step 3: 上传Excel文件...');

    // 等待模态框出现
    await page.waitForTimeout(1000);

    // 查找文件输入框
    const fileInputs = await page.locator('input[type="file"]').all();
    console.log(`找到 ${fileInputs.length} 个文件输入框`);

    // 获取页面文本
    const pageText = await page.locator('body').textContent();
    console.log('模态框文本:', pageText?.slice(0, 500));

    if (fileInputs.length > 0) {
      const firstInput = fileInputs[0];
      const isVisible = await firstInput.isVisible().catch(() => false);

      if (isVisible) {
        console.log(`上传文件: ${TEST_FILE}`);
        await firstInput.setInputFiles(TEST_FILE);

        // 等待AI解析
        console.log('等待AI解析（最多30秒）...');
        await page.waitForTimeout(15000);

        await page.screenshot({ path: 'test-results/d3-after-upload.png', fullPage: true });

        // 检查预览内容
        const previewText = await page.locator('body').textContent();
        console.log('解析后文本预览:', previewText?.slice(0, 800));

        // 查找确认按钮
        const confirmBtn = page.locator('button').filter({ hasText: /确认导入/ }).first();
        const hasConfirm = await confirmBtn.isVisible().catch(() => false);
        console.log(`确认导入按钮可见: ${hasConfirm}`);

        if (hasConfirm) {
          await confirmBtn.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: 'test-results/d3-after-confirm.png', fullPage: true });
        }
      }
    } else {
      console.log('未找到文件输入框');
      await page.screenshot({ path: 'test-results/d3-no-input.png', fullPage: true });
    }
  });

  test('4. 检查模板导入后的状态', async () => {
    console.log('Step 4: 检查导入后的状态...');

    await page.waitForTimeout(2000);

    // 获取当前页面文本
    const pageText = await page.locator('body').textContent();
    console.log('当前页面状态:', pageText?.slice(0, 500));

    await page.screenshot({ path: 'test-results/d4-final-state.png', fullPage: true });

    // 检查是否有错误提示
    const errorText = await page.locator('[class*="error"]').allTextContents();
    if (errorText.length > 0) {
      console.log('错误提示:', errorText);
    }
  });
});
