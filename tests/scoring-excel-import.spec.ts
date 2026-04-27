import { test, expect, chromium, Page } from '@playwright/test';

// 测试文件已复制到项目根目录
const TEST_FILE = 'C:/Users/MR/Desktop/sc sys/test-scoring-template.xlsx';
const BASE_URL = 'http://localhost:3001';

test.describe('评分系统 Excel 导入功能完整测试', () => {
  let page: Page;

  test.beforeAll(async () => {
    const browser = await chromium.launch({
      headless: true,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    page = await browser.newPage();
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('1. 导航到评分系统的比赛管理', async () => {
    console.log('Step 1: 访问评分系统...');
    await page.goto(`${BASE_URL}/scoring`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // 验证评分系统主页
    await expect(page.locator('text=比赛评分系统')).toBeVisible({ timeout: 10000 });
    console.log('评分系统主页加载成功');

    // 点击比赛管理卡片（使用更精确的选择器）
    const competitionCard = page.locator('.bg-surface').filter({ hasText: '比赛管理' }).or(
      page.locator('button').filter({ hasText: '比赛管理' })
    );
    await competitionCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    await page.screenshot({ path: 'test-results/e1-competition-list.png', fullPage: true });
    console.log('比赛列表已截图');
  });

  test('2. 进入比赛详情页面', async () => {
    console.log('Step 2: 进入比赛详情...');

    // 查找比赛卡片并点击"进入"按钮
    const firstEntryBtn = page.locator('button').filter({ hasText: /^进入$/ }).first();
    const hasEntryBtn = await firstEntryBtn.isVisible().catch(() => false);

    if (hasEntryBtn) {
      console.log('点击第一个比赛的"进入"按钮...');
      await firstEntryBtn.click();
    } else {
      // 直接点击比赛卡片
      console.log('点击第一个比赛卡片...');
      const firstCard = page.locator('[class*="card"]').filter({ hasText: '比赛' }).first();
      await firstCard.click();
    }

    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({ path: 'test-results/e2-competition-detail.png', fullPage: true });
    console.log('比赛详情已截图');

    // 验证我们在比赛详情页面
    const isOnDetailPage = await page.locator('text=选手').isVisible().catch(() => false);
    console.log(`在比赛详情页面: ${isOnDetailPage}`);
  });

  test('3. 打开导入Excel模态框', async () => {
    console.log('Step 3: 打开导入Excel模态框...');

    // 确保在选手标签页
    const contestantsTab = page.locator('button').filter({ hasText: /^选手/ }).first();
    const hasTab = await contestantsTab.isVisible().catch(() => false);

    if (hasTab) {
      console.log('点击选手标签...');
      await contestantsTab.click();
      await page.waitForTimeout(1000);
    }

    await page.screenshot({ path: 'test-results/e3-before-import.png', fullPage: true });

    // 查找"导入Excel"按钮
    const importExcelBtn = page.locator('button').filter({ hasText: /导入Excel/ }).first();
    const hasImportBtn = await importExcelBtn.isVisible().catch(() => false);
    console.log(`导入Excel按钮可见: ${hasImportBtn}`);

    if (hasImportBtn) {
      console.log('点击导入Excel按钮...');
      await importExcelBtn.click();
      await page.waitForTimeout(1500);

      await page.screenshot({ path: 'test-results/e3-import-modal.png', fullPage: true });
      console.log('导入模态框已截图');
    } else {
      console.log('未找到导入Excel按钮，列出所有按钮:');
      const allButtons = await page.locator('button').allTextContents();
      console.log(allButtons);
    }
  });

  test('4. 上传Excel文件并测试AI解析', async () => {
    console.log('Step 4: 上传Excel文件...');

    // 点击上传区域来触发文件选择
    const uploadArea = page.locator('text=上传评分模板 Excel').first();
    const hasUploadArea = await uploadArea.isVisible().catch(() => false);

    if (hasUploadArea) {
      console.log('找到上传区域，点击它...');

      // 使用 evaluateHandle 来执行原生文件选择
      const fileInput = page.locator('input[type="file"]').first();
      const inputHandle = await fileInput.elementHandle();

      if (inputHandle) {
        // 直接在文件输入框上设置文件
        await inputHandle.setInputFiles(TEST_FILE);
        console.log('文件已设置到输入框');

        // 等待一小段时间让React处理
        await page.waitForTimeout(500);

        // 检查文件输入框的内容
        const fileValue = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input[type="file"]');
          return Array.from(inputs).map(i => ({
            files: i.files ? i.files.length : 0,
            value: i.value
          }));
        });
        console.log('文件输入框状态:', fileValue);

        // 手动触发 change 事件确保 React 能接收到
        await inputHandle.dispatchEvent('change');
        console.log('已手动触发 change 事件');

        // 等待更长时间
        await page.waitForTimeout(2000);

        // 再次检查状态
        const fileValue2 = await page.evaluate(() => {
          const inputs = document.querySelectorAll('input[type="file"]');
          return Array.from(inputs).map(i => ({
            files: i.files ? i.files.length : 0
          }));
        });
        console.log('文件输入框状态(之后):', fileValue2);

        // 检查网络请求
        page.on('response', async res => {
          if (res.url().includes('parse-template')) {
            const text = await res.text().catch(() => '无法读取');
            console.log('收到 parse-template 响应:', res.status(), text.slice(0, 200));
          }
        });

        // 等待AI解析（最多30秒）
        // 同时检查预览是否出现
        for (let i = 0; i < 20; i++) {
          await page.waitForTimeout(1000);

          // 检查是否有错误
          const errorEl = page.locator('[class*="error"]').first();
          const errorText = await errorEl.textContent().catch(() => '');
          if (errorText) {
            console.log(`错误: ${errorText}`);
          }

          const previewName = page.locator('text=模板名称').first();
          const hasPreview = await previewName.isVisible().catch(() => false);
          console.log(`等待解析... (${i+1}/20) 预览可见: ${hasPreview}`);

          if (hasPreview) {
            break;
          }
        }

        await page.screenshot({ path: 'test-results/e4-after-upload.png', fullPage: true });

        // 获取当前页面文本
        const pageText = await page.locator('body').textContent();
        console.log('解析后页面内容:', pageText?.slice(0, 500));

        // 检查预览内容
        const previewName = page.locator('text=模板名称').first();
        const hasPreview = await previewName.isVisible().catch(() => false);
        console.log(`模板预览可见: ${hasPreview}`);

        // 检查是否有确认导入按钮
        const confirmBtn = page.locator('button').filter({ hasText: /确认导入/ }).first();
        const hasConfirm = await confirmBtn.isVisible().catch(() => false);
        console.log(`确认导入按钮可见: ${hasConfirm}`);

        if (hasConfirm) {
          console.log('点击确认导入...');
          await confirmBtn.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: 'test-results/e4-after-confirm.png', fullPage: true });
        }
      }
    } else {
      console.log('未找到上传区域');
      await page.screenshot({ path: 'test-results/e4-no-upload-area.png', fullPage: true });
    }
  });

  test('5. 测试结果汇总', async () => {
    console.log('Step 5: 测试结果汇总...');

    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/e5-final.png', fullPage: true });

    // 获取最终状态
    const finalText = await page.locator('body').textContent();
    console.log('最终页面状态:', finalText?.slice(0, 500));
  });
});
