
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:5173')

        # Phase A
        await page.click('button:has-text("C")')

        # Find the main action button
        btn = page.locator('.mt-auto button').first
        await btn.click()

        # Wait for modal
        await page.wait_for_selector('.fixed.inset-0', timeout=5000)

        screenshot_path = '/home/jules/verification/modal_reasons_A.png'
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
