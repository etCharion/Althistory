
import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        await page.goto('http://localhost:5173')

        # Click C in Phase A
        await page.click('button:text("C")')

        # Click Next
        await page.click('button:text("Rozdělit jednotkám")')

        # Wait for modal
        await page.wait_for_selector('.fixed.inset-0')
        print("Modal visible in Phase A")

        screenshot_path = '/home/jules/verification/modal_reasons_A.png'
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        # Continue
        await page.click('button:text("Pokračovat")')

        # Phase B
        # Click Next (Pohyb)
        await page.click('button:text("Pohyb")')
        await page.wait_for_selector('.fixed.inset-0')
        print("Modal visible in Phase B")

        screenshot_path = '/home/jules/verification/modal_reasons_B.png'
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
