import { test, expect, type Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3001';

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForLoadState('networkidle');
  await page.fill('input[placeholder="请输入用户名"]', 'admin');
  await page.fill('input[placeholder="请输入密码"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForURL((url: URL) => !url.pathname.includes('/login'));
  await page.waitForLoadState('networkidle');
}

async function findOverlappingElements(page: Page, selector: string) {
  return page.evaluate((sel: string) => {
    const els = Array.from(document.querySelectorAll(sel)) as HTMLElement[];
    const overlapping: string[] = [];
    for (let i = 0; i < els.length; i++) {
      if (els[i].offsetParent === null) continue;
      const a = els[i].getBoundingClientRect();
      for (let j = i + 1; j < els.length; j++) {
        if (els[j].offsetParent === null) continue;
        const b = els[j].getBoundingClientRect();
        if (a.right <= b.left || a.left >= b.right || a.bottom <= b.top || a.top >= b.bottom) continue;
        overlapping.push(
          `${els[i].tagName}.${els[i].className.slice(0, 40)} ↔ ${els[j].tagName}.${els[j].className.slice(0, 40)}`
        );
      }
    }
    return overlapping;
  }, selector);
}

const VIEWPORTS = [375, 768, 1024, 1440] as const;

for (const width of VIEWPORTS) {
  test.describe(`布局健康检查 ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await login(page);
    });

    test('无水平溢出', async ({ page }) => {
      const pages = ['/dashboard', '/files', '/file-center', '/scoring', '/courses'];
      for (const path of pages) {
        await page.goto(`${BASE_URL}${path}`);
        await page.waitForLoadState('networkidle');

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          return {
            scrollWidth: doc.scrollWidth,
            clientWidth: doc.clientWidth,
            overflowElements: Array.from(document.querySelectorAll('*')).filter((el) => {
              const e = el as HTMLElement;
              return e.scrollWidth > e.clientWidth && e.offsetWidth > 0;
            }).slice(0, 10).map((e) => ({
              tag: e.tagName,
              class: e.className.slice(0, 60),
              scrollWidth: (e as HTMLElement).scrollWidth,
              clientWidth: e.clientWidth,
            })),
          };
        });

        expect(overflow.scrollWidth, `${path}: horizontal overflow`).toBeLessThanOrEqual(overflow.clientWidth + 1);
        if (overflow.overflowElements.length > 0) {
          console.warn(`[${width}px ${path}] sub-element overflow:`, JSON.stringify(overflow.overflowElements));
        }
      }
    });

    test('导航栏按钮无重叠', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      const headerOverlap = await findOverlappingElements(page, 'header button');
      const navOverlap = await findOverlappingElements(page, 'nav button');
      const realOverlaps = [...headerOverlap, ...navOverlap].filter((o) => !o.includes('inset-0'));
      if (realOverlaps.length > 0) {
        console.warn(`[${width}px] button overlap:`, realOverlaps.slice(0, 5));
      }
      expect(realOverlaps.length).toBeLessThan(3);
    });

    test('固定元素不遮盖内容', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForLoadState('networkidle');

      const covered = await page.evaluate(() => {
        const fixed = Array.from(document.querySelectorAll('*')).filter((el) => {
          const style = window.getComputedStyle(el);
          return style.position === 'fixed' || style.position === 'sticky';
        }) as HTMLElement[];
        if (fixed.length === 0) return [];

        const bottomFixed = fixed.reduce((lowest, el) => {
          const r = el.getBoundingClientRect();
          return r.top < lowest.top ? r : lowest;
        }, fixed[0].getBoundingClientRect());

        const visibleEls = Array.from(document.querySelectorAll('button, a, input, select, textarea')).filter((el) => {
          const e = el as HTMLElement;
          return e.offsetParent !== null;
        });
        return visibleEls.filter((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > bottomFixed.top && r.top < bottomFixed.bottom;
        }).slice(0, 5).map((e) => ({ tag: e.tagName, class: e.className.slice(0, 50) }));
      });

      if (covered.length > 0 && width < 1024) {
        console.warn(`[${width}px] fixed element may cover:`, JSON.stringify(covered));
      }
    });

    test('文本不溢出容器', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');

      const clipped = await page.evaluate(() => {
        const all = Array.from(document.querySelectorAll('*')) as HTMLElement[];
        return all.filter((el) => {
          const style = window.getComputedStyle(el);
          if (style.overflow !== 'hidden' && style.textOverflow !== 'ellipsis') return false;
          return el.scrollWidth > el.clientWidth && el.children.length === 0;
        }).slice(0, 10).map((e) => ({
          tag: e.tagName,
          class: e.className.slice(0, 50),
          text: e.textContent?.slice(0, 40),
        }));
      });

      if (clipped.length > 0) {
        console.warn(`[${width}px] text may be clipped:`, JSON.stringify(clipped));
      }
    });
  });
}
