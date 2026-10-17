const test = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('entering schedule center refreshes data and ignores an older response', async () => {
  const browser = await chromium.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  let releaseFirst;
  let firstRequestSeen;
  const firstSeen = new Promise(resolve => { firstRequestSeen = resolve; });
  const firstResponse = new Promise(resolve => { releaseFirst = resolve; });
  let scheduleRequests = 0;
  try {
    const page = await browser.newPage();
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      let data = [];
      if (path === '/api/auth/login') {
        data = { token: 'mock', user: { id: 1, username: 'mock', name: 'Test', role: 'admin' } };
      } else if (path === '/api/auth/me') {
        data = { id: 1, username: 'mock', name: 'Test', role: 'admin' };
      } else if (path === '/api/campuses') {
        data = ['河源'];
      } else if (path === '/api/terms') {
        data = [{ id: 1, name: 'Test term', status: 'active' }];
      } else if (path === '/api/departments') {
        data = [{ id: 1, name: '策划部' }];
      } else if (path === '/api/schedules') {
        scheduleRequests += 1;
        if (scheduleRequests === 1) {
          firstRequestSeen();
          await firstResponse;
        } else {
          data = [{ id: 100, name: 'Test member', department: '策划部', courses: [] }];
        }
      }
      await route.fulfill({ json: { success: true, data } });
    });

    await page.goto('http://127.0.0.1:8794/login');
    await page.getByLabel('用户名', { exact: true }).fill('mock');
    await page.getByLabel('密码', { exact: true }).fill('mock');
    await page.getByRole('button', { name: '登录', exact: true }).click();
    await page.waitForURL('**/dashboard');
    await firstSeen;
    await page.getByRole('button', { name: '课表中心' }).click();
    await page.getByRole('heading', { name: 'Test member' }).waitFor({ timeout: 3000 });
    releaseFirst();
    await page.waitForTimeout(150);
    assert.equal(scheduleRequests >= 2, true);
    assert.equal(await page.getByRole('heading', { name: 'Test member' }).isVisible(), true);
  } finally {
    releaseFirst?.();
    await browser.close();
  }
});
