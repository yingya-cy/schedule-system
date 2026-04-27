import { test, expect, chromium, Page } from '@playwright/test';

const TEST_FILE = 'C:\\Users\\MR\\xwechat_files\\wxid_e5qlx658vlm822_ca40\\msg\\file\\2026-04\\"微光润心，健康同行"心理科普短视频大赛复赛评分表（改版）(2).xlsx';
const BASE_URL = 'http://localhost:3001';

test.describe('评分系统 Excel 导入功能测试', () => {
  let page: Page;

  test.beforeAll(async () => {
    // 使用Chrome浏览器
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

  test('1. 访问首页并导航到评分系统', async () => {
    console.log('Step 1: 访问首页...');
    await page.goto(BASE_URL);

    // 等待页面加载
    await page.waitForLoadState('networkidle');

    // 截图保存
    await page.screenshot({ path: 'test-results/step1-homepage.png', fullPage: true });
    console.log('首页截图已保存: test-results/step1-homepage.png');

    // 验证页面标题
    const title = await page.title();
    console.log(`页面标题: ${title}`);
    expect(title).toContain('学术空间');
  });

  test('2. 导航到评分系统主页', async () => {
    console.log('Step 2: 导航到评分系统...');

    // 点击评分系统链接
    const scoringLink = page.locator('text=评分系统').first();
    if (await scoringLink.isVisible()) {
      await scoringLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      // 直接访问评分页面
      await page.goto(`${BASE_URL}/scoring`);
    }

    await page.screenshot({ path: 'test-results/step2-scoring-home.png', fullPage: true });
    console.log('评分系统主页截图已保存: test-results/step2-scoring-home.png');

    // 验证评分系统主页元素
    const heading = page.locator('text=比赛评分系统').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    console.log('评分系统主页加载成功');
  });

  test('3. 进入模板管理页面', async () => {
    console.log('Step 3: 进入模板管理页面...');

    // 点击评分模板卡片
    const templateCard = page.locator('text=评分模板').first();
    await templateCard.click();

    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: 'test-results/step3-template-list.png', fullPage: true });
    console.log('模板列表截图已保存: test-results/step3-template-list.png');

    // 验证模板列表页面加载
    await page.waitForTimeout(1000);
    const addButton = page.locator('text=添加模板').or(page.locator('text=导入模板')).first();
    const isAddVisible = await addButton.isVisible().catch(() => false);
    console.log(`添加/导入按钮可见: ${isAddVisible}`);
  });

  test('4. 测试导入模板Excel功能', async () => {
    console.log('Step 4: 测试导入模板Excel功能...');

    // 检查是否有导入按钮
    const importButton = page.locator('button:has-text("导入")').or(page.locator('text=导入Excel')).first();
    const hasImportButton = await importButton.isVisible().catch(() => false);

    if (hasImportButton) {
      console.log('找到导入按钮，点击...');
      await importButton.click();
      await page.waitForTimeout(1000);

      // 检查文件上传对话框或模态框
      const modal = page.locator('text=AI 智能识别').first();
      const modalVisible = await modal.isVisible().catch(() => false);
      console.log(`导入模态框可见: ${modalVisible}`);

      if (modalVisible) {
        // 查找文件上传输入框
        const fileInput = page.locator('input[type="file"]').first();
        const fileInputVisible = await fileInput.isVisible().catch(() => false);
        console.log(`文件上传输入框可见: ${fileInputVisible}`);

        if (fileInputVisible) {
          // 上传测试文件
          console.log(`上传文件: ${TEST_FILE}`);
          await fileInput.setInputFiles(TEST_FILE);

          // 等待AI解析
          console.log('等待AI解析...');
          await page.waitForTimeout(5000);

          // 截图保存结果
          await page.screenshot({ path: 'test-results/step4-parse-result.png', fullPage: true });
          console.log('解析结果截图已保存: test-results/step4-parse-result.png');

          // 检查是否有错误
          const errorElement = page.locator('.text-error, [class*="error"]').first();
          const hasError = await errorElement.isVisible().catch(() => false);
          if (hasError) {
            const errorText = await errorElement.textContent();
            console.log(`解析错误: ${errorText}`);
          } else {
            console.log('解析未显示错误');
          }

          // 检查是否显示了模板预览
          const preview = page.locator('text=模板名称').or(page.locator('text=总分'));
          const hasPreview = await preview.first().isVisible().catch(() => false);
          console.log(`模板预览可见: ${hasPreview}`);
        }
      }
    } else {
      console.log('未找到导入按钮，尝试其他方式...');
      await page.screenshot({ path: 'test-results/step4-no-import-button.png', fullPage: true });
    }
  });

  test('5. 检查比赛列表', async () => {
    console.log('Step 5: 检查比赛列表...');

    // 返回首页
    await page.goto(`${BASE_URL}/scoring`);
    await page.waitForLoadState('networkidle');

    // 点击比赛管理卡片
    const competitionCard = page.locator('text=比赛管理').first();
    await competitionCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    await page.screenshot({ path: 'test-results/step5-competition-list.png', fullPage: true });
    console.log('比赛列表截图已保存: test-results/step5-competition-list.png');

    // 检查是否有比赛
    const competitionItems = page.locator('[class*="competition"], [class*="card"]').count();
    console.log(`找到 ${competitionItems} 个比赛相关元素`);
  });
});
