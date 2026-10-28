// 运行：$env:GRATITUDE_URL="https://yingyacy.top/gratitude/"; npx playwright test tests/gratitude-theme-e2e.spec.ts
// 不设该变量时会打到 baseURL(http://localhost:3001)，本机通常连不上，属预期。
import { test, expect } from '@playwright/test';

const pageUrl = process.env.GRATITUDE_URL || '/gratitude/';

test('gratitude theme works through the mobile login journey', async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 390, height: 844 });

  const days = Array.from({ length: 21 }, (_, index) => ({
    day_no: index + 1,
    label: `11月${index + 6}日`,
    date: `2026-11-${String(index + 6).padStart(2, '0')}`,
    done: index < 6,
    is_today: index === 6,
    is_future: index > 6,
  }));

  await page.route('**/api/gratitude/**', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ success: true }),
  }));
  await page.route('**/api/gratitude/login', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { id: 1, name: '测试同学', student_id: '20260001' } }),
  }));
  await page.route('**/api/gratitude/days/1', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { days, done_count: 6, total: 21, progress: 28.6, today: '2026-11-12' } }),
  }));
  await page.route('**/api/gratitude/day/1/8', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { day_no: 8, label: '11月13日', uploads: [], is_special: false } }),
  }));
  await page.route('**/api/gratitude/day/1/21', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { day_no: 21, label: '11月26日', uploads: [], is_special: true } }),
  }));
  await page.goto(pageUrl, { waitUntil: 'networkidle' });
  await expect(page.locator('.theme-title-art')).toBeVisible();
  await expect(page.locator('.theme-title-art')).toHaveAttribute('alt', '微光拾暖，‘艺’绘感恩');
  expect(await page.locator('.theme-title-art').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator('.gratitude-tree-art')).toBeVisible();
  expect(await page.locator('.gratitude-tree-art').evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.screenshot({ path: testInfo.outputPath('gratitude-login-mobile.png'), fullPage: true });

  await page.locator('#in-sid').fill('20260001');
  await page.locator('#in-name').fill('测试同学');
  await page.locator('#s-login .btn.pri').click();

  await expect(page.locator('#s-days')).toHaveClass(/on/);
  await expect(page.locator('#daygrid .cell')).toHaveCount(21);
  await expect(page.locator('#p-done')).toHaveText('6');
  await expect(page.locator('.journal-canopy-art')).toBeVisible();
  await expect(page.locator('.journal-wash-divider')).toBeVisible();
  expect(await page.locator('.journal-canopy-art,.journal-wash-divider').evaluateAll((images: HTMLImageElement[]) => images.every(img => img.naturalWidth > 0))).toBe(true);
  await expect(page.locator('.gratitude-sapling-art')).toBeVisible();
  await expect(page.locator('.week-brush-label')).toHaveCount(3);
  await expect(page.locator('.day-leaf-art')).toHaveCount(15);
  await expect(page.locator('.cell.done .day-leaf-art')).toHaveCount(0);
  await expect(page.locator('.cell:not(.done) .day-leaf-art')).toHaveCount(15);
  expect(await page.locator('.day-leaf-art').evaluateAll((images: HTMLImageElement[]) => images.every(img => img.naturalWidth > 0))).toBe(true);
  expect(await page.locator('.day-leaf-art').evaluateAll((images: HTMLImageElement[]) => new Set(images.map(img => img.src)).size)).toBe(7);
  const leafLayout = await page.locator('.cell:not(.done)').evaluateAll(cells => cells.map(cell => {
    const leaf = cell.querySelector('.day-leaf-art') as HTMLElement;
    const date = cell.querySelector('.d') as HTMLElement;
    const cellBox = cell.getBoundingClientRect();
    const leafBox = leaf.getBoundingClientRect();
    const dateBox = date.getBoundingClientRect();
    return {
      size: Number.parseFloat(getComputedStyle(leaf).width),
      clearsDate: leafBox.right <= dateBox.left || leafBox.left >= dateBox.right || leafBox.bottom <= dateBox.top || leafBox.top >= dateBox.bottom,
      overhangsRight: leafBox.right > cellBox.right,
    };
  }));
  expect(leafLayout.every(leaf => leaf.size === 35)).toBe(true);
  expect(leafLayout.every(leaf => leaf.clearsDate)).toBe(true);
  expect(leafLayout.some(leaf => leaf.overhangsRight)).toBe(true);
  await page.locator('#preview-completion-motion').click();
  await expect(page.locator('#save-feedback')).toHaveClass(/on/);
  await expect(page.locator('#daygrid .cell.motion-preview')).toHaveCount(1);
  await page.waitForTimeout(500);
  await expect(page.locator('#daygrid .cell.motion-preview .day-leaf-art')).toHaveCSS('opacity', '0');
  await expect(page.locator('.save-feedback-note')).toHaveCSS('opacity', '0');
  await page.waitForTimeout(650);
  await expect(page.locator('.save-feedback-note')).not.toHaveCSS('opacity', '0');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('gratitude-days-mobile.png'), fullPage: true });

  await page.locator('#daygrid .cell').nth(7).click();
  await expect(page.locator('#s-fill')).toHaveClass(/on/);
  await expect(page.locator('#fill-title')).toContainText('第8天');
  await expect(page.locator('#fill-day-number')).toHaveText('08');
  await expect(page.locator('.fill-journal-intro')).toBeVisible();
  await expect(page.locator('.photo-slot')).toHaveCount(3);
  await expect(page.locator('#photo-count')).toHaveText('0 / 3');
  await expect(page.locator('#save-day')).toContainText('本地预览');

  const photoChooser = page.waitForEvent('filechooser');
  await page.locator('.photo-board').click();
  await (await photoChooser).setFiles({
    name: 'gratitude-note.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.locator('#photo-count')).toHaveText('1 / 3');
  await expect(page.locator('#thumbs .thumb')).toHaveCount(1);

  await page.locator('#s-fill .back').click();
  await expect(page.locator('.modal-title')).toHaveText('还有未保存的记录');
  await page.locator('.modal-btn.ok').click();
  await expect(page.locator('#s-days')).toHaveClass(/on/);
  await page.locator('#daygrid .cell').nth(20).click();
  await expect(page.locator('#fill-day-number')).toHaveText('21');
  await expect(page.locator('.fill-media-section')).toBeVisible();
  await expect(page.locator('.fill-media-option')).toHaveCount(2);

  const videoChooser = page.waitForEvent('filechooser');
  await page.locator('.fill-media-option').first().click();
  await (await videoChooser).setFiles({ name: 'thanks.mp4', mimeType: 'video/mp4', buffer: Buffer.from('video') });
  await expect(page.locator('#vidThumbs video')).toHaveCount(1);

  const audioChooser = page.waitForEvent('filechooser');
  await page.locator('.fill-media-option').nth(1).click();
  await (await audioChooser).setFiles({ name: 'thanks.m4a', mimeType: 'audio/mp4', buffer: Buffer.from('audio') });
  await expect(page.locator('#vidThumbs audio')).toHaveCount(1);
  const fillOverflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(fillOverflow).toBeLessThanOrEqual(1);
  await page.screenshot({ path: testInfo.outputPath('gratitude-fill-day21-mobile.png'), fullPage: true });
  await page.locator('#s-fill .back').click();
  await expect(page.locator('.modal-title')).toHaveText('还有未保存的记录');
  await page.locator('.modal-btn.ok').click();
  await expect(page.locator('#s-days')).toHaveClass(/on/);

  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('#preview-completion-motion')).toBeEnabled({ timeout: 3000 });
  await page.locator('#preview-completion-motion').click();
  await expect(page.locator('.leaf-fly')).toHaveCount(1);
  expect(await page.locator('.leaf-fly').evaluate(element => element.getAnimations().length)).toBeGreaterThan(0);
  await expect(page.locator('.leaf-fly')).toHaveCount(0, { timeout: 3000 });
  await page.evaluate(() => (window as Window & { go: (id: string) => void }).go('s-login'));
  await expect(page.locator('.gratitude-tree-art')).toBeVisible();
  await page.locator('#s-login').evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  await expect(page.locator('#toast')).not.toHaveClass(/on/, { timeout: 2500 });
  await page.screenshot({ path: testInfo.outputPath('gratitude-login-desktop.png'), fullPage: true });
});

test('gratitude theme respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(pageUrl, { waitUntil: 'domcontentloaded' });
  const animation = await page.locator('#s-login').evaluate(element => getComputedStyle(element).animationName);
  expect(animation).toBe('none');
});

test('daily check-in uploads selected media and preserves the save contract', async ({ page }) => {
  const submitUrl = pageUrl + (pageUrl.includes('?') ? '&' : '?') + 'e2eSubmit=1';
  const days = Array.from({ length: 21 }, (_, index) => ({
    day_no: index + 1,
    label: `11月${index + 6}日`,
    date: `2026-11-${String(index + 6).padStart(2, '0')}`,
    done: false,
    is_today: index === 0,
    is_future: false,
  }));
  let savedBody: { participant_id: number; day_no: number; action_images: string[] } | null = null;

  await page.route('**/api/gratitude/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true }) }));
  await page.route('**/api/gratitude/login', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { id: 1, name: '测试同学', student_id: '20260001' } }),
  }));
  await page.route('**/api/gratitude/days/1', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { days, done_count: 0, total: 21, progress: 0, today: '2026-11-06' } }),
  }));
  await page.route('**/api/gratitude/day/1/1', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { day_no: 1, label: '11月6日', uploads: [], is_special: false } }),
  }));
  await page.route('**/api/gratitude/upload', route => route.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ success: true, data: { path: 'mock/gratitude-note.jpg' } }),
  }));
  await page.route('**/api/gratitude/day', async route => {
    savedBody = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true }) });
  });

  await page.goto(submitUrl, { waitUntil: 'networkidle' });
  await page.locator('#in-sid').fill('20260001');
  await page.locator('#in-name').fill('测试同学');
  await page.locator('#s-login .btn.pri').click();
  await page.locator('#daygrid .cell').first().click();

  const chooser = page.waitForEvent('filechooser');
  await page.locator('.photo-board').click();
  await (await chooser).setFiles({
    name: 'gratitude-note.png',
    mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
  });
  await expect(page.locator('#save-day')).toBeEnabled();
  await page.locator('#save-day').click();
  await expect.poll(() => savedBody).not.toBeNull();
  expect(savedBody).toEqual({ participant_id: 1, day_no: 1, action_images: ['mock/gratitude-note.jpg'] });
});
