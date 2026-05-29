"""
自动上传 dify-kb 文件到 Dify 知识库（通过浏览器自动化）
需要先手动登录 Dify，然后运行此脚本
"""
import os, sys, time
from playwright.sync_api import sync_playwright

KB_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "dify-kb")
DIFY_URL = "http://localhost:3000"


def upload():
    kb_files = sorted(
        f for f in os.listdir(KB_DIR) if f.endswith(".txt")
    )
    if not kb_files:
        print("No KB files found!")
        return

    print(f"Files to upload: {len(kb_files)}")
    print("Make sure you're logged into Dify (http://localhost:3000)")
    print("Press Enter to continue...")
    input()

    with sync_playwright() as p:
        # Connect to existing browser or launch new
        browser = p.chromium.connect_over_cdp("http://localhost:9222")
        pages = browser.contexts[0].pages
        page = pages[0] if pages else browser.contexts[0].new_page()

        # Navigate to knowledge base
        page.goto(f"{DIFY_URL}/datasets")
        page.wait_for_load_state("networkidle")
        print("Opened Dify Knowledge page")

        # Find the knowledge base (click first one, or select by name)
        page.wait_for_selector("[class*='dataset']", timeout=5000)
        kb_cards = page.locator("[class*='dataset']")
        if kb_cards.count() == 0:
            print("No knowledge bases found. Create one first.")
            return

        # Click the first KB
        kb_cards.first.click()
        page.wait_for_load_state("networkidle")

        # Go to documents tab
        page.locator("text=文档").click()
        time.sleep(1)

        for fname in kb_files:
            fpath = os.path.join(KB_DIR, fname)
            print(f"Uploading: {fname}...")

            # Click upload button
            page.locator("button:has-text('上传')").first.click()
            time.sleep(0.5)

            # Select file input and upload
            file_input = page.locator('input[type="file"]')
            file_input.set_input_files(fpath)
            time.sleep(1)

            # Click confirm/upload button
            confirm_btn = page.locator("button:has-text('确认')").first
            if confirm_btn.is_visible():
                confirm_btn.click()
                time.sleep(2)

            print(f"  Done: {fname}")

        print(f"\nAll {len(kb_files)} files uploaded!")
        print("Dify will auto-index them. Check the knowledge base page.")


if __name__ == "__main__":
    upload()
