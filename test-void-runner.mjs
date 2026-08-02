import { chromium } from '@playwright/test';

async function testVoidRunner() {
  console.log('Launching Chromium...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Navigating to http://localhost:3000...');
  const response = await page.goto('http://localhost:3000');
  console.log(`Page status: ${response.status()}`);
  
  const title = await page.title();
  console.log(`Page title: "${title}"`);

  // Check element presence
  const gameCanvas = await page.$('#game-canvas');
  console.log(`Game Canvas Present: ${!!gameCanvas}`);

  const modeIndicator = await page.$eval('#mode-indicator', el => el.textContent.trim()).catch(() => 'N/A');
  console.log(`Mode Indicator Text: "${modeIndicator}"`);

  const startBtnText = await page.$eval('#mobile-start', el => el.textContent.trim()).catch(() => 'N/A');
  console.log(`Start Button Text: "${startBtnText}"`);

  const backBtnText = await page.$eval('#back-btn', el => el.textContent.trim()).catch(() => 'N/A');
  console.log(`Back Button Text: "${backBtnText}"`);

  await browser.close();
  console.log('Test completed successfully!');
}

testVoidRunner().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
