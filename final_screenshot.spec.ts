import { test } from '@playwright/test';

test('screenshot', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.click('button:has-text("HRÁT")');
  await page.waitForSelector('svg', { timeout: 10000 });
  // Wait a bit for animations
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/home/jules/verification/updated_layout.png' });
});
