
import { test, expect } from '@playwright/test';

test('modal show reasons', async ({ page }) => {
  await page.goto('http://localhost:5173');

  // Phase A: Distribution to sections
  // Add 1 to center
  const centerBtn = page.locator('button:has-text("C")').first();
  await centerBtn.click();

  // Should have 5 left in warehouse
  const nextBtn = page.locator('button:has-text("Rozdělit jednotkám")');
  await nextBtn.click();

  // Check modal
  const modal = page.locator('.fixed.inset-0');
  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Sklad: 5');

  // Continue
  await page.locator('button:has-text("Pokračovat")').click();
  await expect(modal).not.toBeVisible();

  // Phase B: Distribution to units
  // Unit in center has 3 resources already in warehouse? No, section has 1.
  // Click next (Pohyb)
  const movementBtn = page.locator('button:has-text("Pohyb")');
  await movementBtn.click();

  await expect(modal).toBeVisible();
  await expect(modal).toContainText('Sekce: C: 1');

  await page.screenshot({ path: '/home/jules/verification/modal_reasons.png' });
});
