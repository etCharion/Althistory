/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    // Jen unit testy v src – final_screenshot.spec.ts v kořeni je Playwright.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
