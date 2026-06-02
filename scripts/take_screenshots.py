"""Playwright 自动截图 — 设计文档用"""
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3001"
OUT = "C:/Users/MR/Desktop/sc sys/docs/screenshots"

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(viewport={"width": 1400, "height": 900})
        page = context.new_page()

        # 1. Login
        page.goto(f"{BASE}/login")
        page.fill('input[placeholder*="用户名"]', "admin")
        page.fill('input[placeholder*="密码"]', "admin123")
        page.click('button[type="submit"]')
        page.wait_for_url("**/dashboard", timeout=10000)
        print("1. Logged in")
        time.sleep(1)

        # 2. 小暖对话
        page.goto(f"{BASE}/ai-counsel")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        # Type a query
        page.fill("textarea", "考研什么时候报名？")
        page.click("button:has-text('发送')")
        # Wait for response
        time.sleep(10)
        page.screenshot(path=f"{OUT}/01_counsel_chat.png", full_page=False)
        print("2. Counsel screenshot taken")

        # 3. 个人中心 - 课表OCR
        page.goto(f"{BASE}/profile")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        # Switch to schedule tab
        tabs = page.locator("button:has-text('课表')")
        if tabs.count() > 0:
            tabs.first.click()
            time.sleep(1)
        page.screenshot(path=f"{OUT}/02_schedule_ocr.png", full_page=False)
        print("3. Schedule OCR screenshot taken")

        # 4. 课表中心 - 反课表
        page.goto(f"{BASE}/files")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path=f"{OUT}/03_free_time.png", full_page=False)
        print("4. Free time screenshot taken")

        # 5. 评分系统
        page.goto(f"{BASE}/scoring")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path=f"{OUT}/04_scoring.png", full_page=False)
        print("5. Scoring screenshot taken")

        # 6. AI 日程规划
        page.goto(f"{BASE}/ai-schedule")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        page.screenshot(path=f"{OUT}/05_schedule_plan.png", full_page=False)
        print("6. Schedule plan screenshot taken")

        browser.close()
        print(f"\nAll screenshots saved to {OUT}/")

if __name__ == "__main__":
    import os
    os.makedirs(OUT, exist_ok=True)
    run()
