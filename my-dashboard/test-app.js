import puppeteer from 'puppeteer';
import path from 'path';

(async () => {
  console.log('Starting application tests...');
  
  // Launch the browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport size
    await page.setViewport({ width: 1280, height: 800 });
    
    console.log('Navigating to the application...');
    await page.goto('http://localhost:5173/', { waitUntil: 'networkidle0' });
    
    // Test 1: Verify the Hello World page is displaying correctly
    console.log('Test 1: Verifying Hello World page...');
    const title = await page.$eval('h1', el => el.textContent);
    console.log(`Page title: ${title}`);
    
    if (title.includes('Hello World')) {
      console.log('✅ Test 1 Passed: Hello World page is displaying correctly');
    } else {
      console.log('❌ Test 1 Failed: Hello World page is not displaying correctly');
    }
    
    // Take a screenshot in light mode
    console.log('Taking screenshot in light mode...');
    await page.screenshot({ path: 'test-results/light-mode.png', fullPage: true });
    
    // Test 2: Test the button functionality
    console.log('Test 2: Testing button functionality...');
    
    // Setup dialog handler for alert
    let alertShown = false;
    page.on('dialog', async dialog => {
      console.log(`Dialog message: ${dialog.message()}`);
      alertShown = true;
      await dialog.accept();
    });
    
    // Click the welcome button
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const welcomeButton = buttons.find(button => button.textContent.includes('Show Welcome Message'));
      if (welcomeButton) welcomeButton.click();
    });
    
    // Wait for any potential animations
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if the alert was shown
    if (alertShown) {
      console.log('✅ Alert was shown successfully');
    } else {
      console.log('❌ Alert was not shown');
    }
    
    // Check if the green message appears
    const messageVisible = await page.evaluate(() => {
      const message = document.querySelector('.bg-green-100, .dark\\:bg-green-900');
      return message !== null && message.textContent.includes('You clicked the welcome button');
    });
    
    if (messageVisible) {
      console.log('✅ Test 2 Passed: Button functionality works correctly');
    } else {
      console.log('❌ Test 2 Failed: Green message did not appear after clicking the button');
    }
    
    // Take a screenshot after clicking the button
    await page.screenshot({ path: 'test-results/after-button-click.png', fullPage: true });
    
    // Test 3: Test the theme toggle
    console.log('Test 3: Testing theme toggle...');
    
    // Find and click the theme toggle button
    const themeToggleButton = await page.$('button.fixed.bottom-4.right-4');
    if (themeToggleButton) {
      await themeToggleButton.click();
    } else {
      console.log('❌ Theme toggle button not found');
    }
    
    // Wait for theme change to apply
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if dark mode is applied
    const isDarkMode = await page.evaluate(() => {
      return document.querySelector('div.dark') !== null;
    });
    
    if (isDarkMode) {
      console.log('✅ Theme toggle switched to dark mode successfully');
    } else {
      console.log('❌ Theme toggle failed to switch to dark mode');
    }
    
    // Take a screenshot in dark mode
    console.log('Taking screenshot in dark mode...');
    await page.screenshot({ path: 'test-results/dark-mode.png', fullPage: true });
    
    // Navigate to Dashboard page
    console.log('Navigating to Dashboard page...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const dashboardLink = links.find(link => link.textContent.includes('View Dashboard'));
      if (dashboardLink) dashboardLink.click();
    });
    await page.waitForFunction(() => {
      const h1Elements = Array.from(document.querySelectorAll('h1'));
      return h1Elements.some(h1 => h1.textContent.includes('Dashboard'));
    });
    
    // Take a screenshot of the Dashboard page
    console.log('Taking screenshot of Dashboard page...');
    await page.screenshot({ path: 'test-results/dashboard.png', fullPage: true });
    
    // Navigate back to Home page
    console.log('Navigating back to Home page...');
    await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const homeLink = links.find(link => link.textContent.includes('Back to Home'));
      if (homeLink) homeLink.click();
    });
    await page.waitForFunction(() => {
      const h1Elements = Array.from(document.querySelectorAll('h1'));
      return h1Elements.some(h1 => h1.textContent.includes('Hello World'));
    });
    
    console.log('All tests completed!');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
})();