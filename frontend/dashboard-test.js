const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function runDashboardTest() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  
  // Enable console and network monitoring
  const page = await context.newPage();
  const consoleErrors = [];
  const networkFailures = [];
  
  // Monitor console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        timestamp: Date.now(),
        text: msg.text(),
        location: msg.location()
      });
    }
  });
  
  // Monitor network failures
  page.on('response', response => {
    if (!response.ok()) {
      networkFailures.push({
        timestamp: Date.now(),
        url: response.url(),
        status: response.status(),
        statusText: response.statusText()
      });
    }
  });
  
  const startTime = Date.now();
  
  try {
    console.log('1. Navigating to dashboard...');
    await page.goto('http://localhost:3001/dashboard');
    await page.waitForLoadState('networkidle');
    console.log('✓ Dashboard loaded successfully');
    
    console.log('2. Collecting console errors and network failures...');
    const recentErrors = consoleErrors.filter(err => err.timestamp > startTime - 60000);
    const recentNetworkFailures = networkFailures.filter(fail => fail.timestamp > startTime - 60000);
    
    console.log(`Found ${recentErrors.length} console errors and ${recentNetworkFailures.length} network failures in last 60s`);
    
    console.log('3. Taking dashboard screenshot...');
    const outputDir = path.resolve(__dirname, '..', '.mcp-out');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const dashboardPath = path.join(outputDir, 'dashboard.png');
    await page.screenshot({ path: dashboardPath, fullPage: true });
    console.log(`✓ Screenshot saved to ${dashboardPath}`);
    
    console.log('4. Looking for open position rows...');
    const openPositionRows = await page.locator('[data-testid="position-row-open"]').count();
    console.log(`Found ${openPositionRows} open position rows`);
    
    if (openPositionRows > 0) {
      console.log('5. Clicking ENTRY edit button on first open position...');
      const entryEditButton = page.locator('[data-testid="entry-edit-button"]').first();
      const buttonExists = await entryEditButton.count() > 0;
      
      if (buttonExists) {
        await entryEditButton.click();
        console.log('✓ Entry edit button clicked');
        
        console.log('6. Verifying modal visibility...');
        const modal = page.locator('[role="dialog"], [data-testid="entry-edit-modal"]');
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        console.log('✓ Modal is visible');
        
        const modalPath = path.join(outputDir, 'entry-modal.png');
        await page.screenshot({ path: modalPath, fullPage: true });
        console.log(`✓ Modal screenshot saved to ${modalPath}`);
      } else {
        console.log('⚠ Entry edit button not found on open position');
        await printA11yTree(page);
      }
    } else {
      console.log('⚠ No open position rows found');
      await printA11yTree(page);
    }
    
    console.log('7. Checking closed position rows...');
    const closedPositionRows = await page.locator('[data-testid="position-row-closed"]').count();
    console.log(`Found ${closedPositionRows} closed position rows`);
    
    if (closedPositionRows > 0) {
      const closedRowEntryButtons = await page.locator('[data-testid="position-row-closed"] [data-testid="entry-edit-button"]').count();
      const closedRowDisabledButtons = await page.locator('[data-testid="position-row-closed"] [data-testid="entry-edit-button"][disabled]').count();
      
      console.log(`Entry edit buttons on closed rows: ${closedRowEntryButtons} total, ${closedRowDisabledButtons} disabled`);
      
      if (closedRowEntryButtons === 0 || closedRowDisabledButtons === closedRowEntryButtons) {
        console.log('✓ ENTRY edit buttons properly restricted on closed positions');
      } else {
        console.log('⚠ ENTRY edit buttons may not be properly restricted on closed positions');
      }
    }
    
    // Generate summary
    console.log('\n=== TEST SUMMARY ===');
    console.log(`Console Errors (last 60s): ${recentErrors.length}`);
    recentErrors.forEach(err => console.log(`  - ${err.text} (${err.location?.url || 'unknown'}:${err.location?.lineNumber || '?'})`));
    
    console.log(`Network Failures (last 60s): ${recentNetworkFailures.length}`);
    recentNetworkFailures.forEach(fail => console.log(`  - ${fail.status} ${fail.url}`));
    
    console.log(`Open Positions: ${openPositionRows}`);
    console.log(`Closed Positions: ${closedPositionRows}`);
    
  } catch (error) {
    console.error('Test failed:', error.message);
    await printA11yTree(page);
  } finally {
    await browser.close();
  }
}

async function printA11yTree(page) {
  console.log('\n=== ACCESSIBILITY TREE ===');
  try {
    const snapshot = await page.accessibility.snapshot();
    printA11yNode(snapshot, 0);
  } catch (error) {
    console.log('Could not get accessibility tree:', error.message);
  }
}

function printA11yNode(node, depth) {
  if (!node) return;
  
  const indent = '  '.repeat(depth);
  const role = node.role || '';
  const name = node.name || '';
  const testId = node.testId || '';
  
  if (role || name || testId) {
    console.log(`${indent}${role}${name ? ` "${name}"` : ''}${testId ? ` [data-testid="${testId}"]` : ''}`);
  }
  
  if (node.children && depth < 3) { // Limit depth to avoid too much output
    node.children.forEach(child => printA11yNode(child, depth + 1));
  }
}

runDashboardTest().catch(console.error);