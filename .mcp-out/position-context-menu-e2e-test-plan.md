# Position Card Context Menu E2E Test Plan

## Test Overview
Comprehensive E2E testing plan for the Position Card context menu functionality implemented in the frontend application.

## Prerequisites
- Frontend running on http://localhost:3001
- Backend running on http://localhost:8000
- Test positions with status='OPEN' and ownerId='current_user' in the system

## Test Scenarios

### 1. Permission-Based Visibility Tests

#### Test 1.1: Edit Icon Visibility (OPEN + Owner)
```javascript
// Setup: Position with status='OPEN' and ownerId='current_user'
await page.goto('http://localhost:3001');
await page.waitForSelector('[data-testid="position-card"]');
const editButton = page.locator('[aria-label="ポジションを編集"]');
await expect(editButton).toBeVisible();
```

#### Test 1.2: Edit Icon Hidden (Non-Owner)
```javascript
// Setup: Position with status='OPEN' and ownerId='other_user'
const editButton = page.locator('[aria-label="ポジションを編集"]');
await expect(editButton).not.toBeVisible();
```

#### Test 1.3: Edit Icon Hidden (CLOSED Position)
```javascript
// Setup: Position with status='CLOSED' and ownerId='current_user'
const editButton = page.locator('[aria-label="ポジションを編集"]');
await expect(editButton).not.toBeVisible();
```

### 2. Multi-Device Interaction Tests

#### Test 2.1: PC Click Interaction
```javascript
const editButton = page.locator('[aria-label="ポジションを編集"]');
await editButton.click();
await expect(page.locator('[role="menu"]')).toBeVisible();
await expect(page.locator('button:has-text("編集")')).toBeVisible();
```

#### Test 2.2: Keyboard Navigation
```javascript
const editButton = page.locator('[aria-label="ポジションを編集"]');
await editButton.focus();
await page.keyboard.press('Enter');
await expect(page.locator('[role="menu"]')).toBeVisible();

// Arrow key navigation within menu
await page.keyboard.press('ArrowDown');
await page.keyboard.press('Enter');
// Should open edit modal
await expect(page.locator('[role="dialog"]')).toBeVisible();
```

#### Test 2.3: Mobile Long Press (Simulated)
```javascript
const editButton = page.locator('[aria-label="ポジションを編集"]');
await editButton.dispatchEvent('touchstart');
await page.waitForTimeout(500); // Long press duration
await editButton.dispatchEvent('touchend');
await expect(page.locator('[role="menu"]')).toBeVisible();
```

### 3. Context Menu Behavior Tests

#### Test 3.1: Menu Positioning
```javascript
const editButton = page.locator('[aria-label="ポジションを編集"]');
await editButton.click();

const menu = page.locator('[role="menu"]');
await expect(menu).toBeVisible();

// Verify menu is positioned near button
const buttonBox = await editButton.boundingBox();
const menuBox = await menu.boundingBox();
expect(Math.abs(menuBox.x - buttonBox.x)).toBeLessThan(100);
expect(menuBox.y).toBeGreaterThan(buttonBox.y);
```

#### Test 3.2: Menu Dismissal - Escape Key
```javascript
const editButton = page.locator('[aria-label="ポジションを編集"]');
await editButton.click();
await expect(page.locator('[role="menu"]')).toBeVisible();

await page.keyboard.press('Escape');
await expect(page.locator('[role="menu"]')).not.toBeVisible();
```

#### Test 3.3: Menu Dismissal - Click Outside
```javascript
const editButton = page.locator('[aria-label="ポジションを編集"]');
await editButton.click();
await expect(page.locator('[role="menu"]')).toBeVisible();

await page.click('body', { position: { x: 10, y: 10 } });
await expect(page.locator('[role="menu"]')).not.toBeVisible();
```

#### Test 3.4: Menu Dismissal - Focus Out
```javascript
const editButton = page.locator('[aria-label="ポジションを編集"]');
await editButton.click();
await expect(page.locator('[role="menu"]')).toBeVisible();

await page.keyboard.press('Tab');
await expect(page.locator('[role="menu"]')).not.toBeVisible();
```

### 4. Edit Modal Integration Tests

#### Test 4.1: Edit Menu Click Opens Modal
```javascript
const editButton = page.locator('[aria-label="ポジションを編集"]');
await editButton.click();

const editMenuItem = page.locator('button:has-text("編集")');
await editMenuItem.click();

// Verify edit modal opens
const modal = page.locator('[role="dialog"]');
await expect(modal).toBeVisible();
await expect(modal.locator('text=建値（ENTRY）を編集')).toBeVisible();
```

#### Test 4.2: Modal Pre-filled with Position Data
```javascript
// Click edit button and menu item
await page.locator('[aria-label="ポジションを編集"]').click();
await page.locator('button:has-text("編集")').click();

// Verify modal has position data pre-filled
const symbolCode = page.locator('#symbolCode');
const symbolName = page.locator('#symbolName');
const price = page.locator('#price');
const qty = page.locator('#qty');

await expect(symbolCode).toHaveValue('6501'); // Example
await expect(symbolName).toHaveValue('日立製作所'); // Example
await expect(price).toHaveValue('1500'); // Example
await expect(qty).toHaveValue('100'); // Example
```

#### Test 4.3: Modal Save Functionality
```javascript
await page.locator('[aria-label="ポジションを編集"]').click();
await page.locator('button:has-text("編集")').click();

// Modify form fields
await page.fill('#price', '1600');
await page.fill('#qty', '200');

// Save changes
await page.click('button:has-text("保存")');

// Verify modal closes
await expect(page.locator('[role="dialog"]')).not.toBeVisible();
```

### 5. Telemetry and Analytics Tests

#### Test 5.1: Telemetry Event Recording
```javascript
// Setup telemetry listener
const telemetryEvents = [];
await page.evaluateOnNewDocument(() => {
  window.originalGtag = window.gtag;
  window.gtag = (...args) => {
    window.telemetryEvents = window.telemetryEvents || [];
    window.telemetryEvents.push(args);
    if (window.originalGtag) window.originalGtag(...args);
  };
});

await page.goto('http://localhost:3001');
await page.locator('[aria-label="ポジションを編集"]').click();
await page.locator('button:has-text("編集")').click();

// Verify telemetry event was fired
const events = await page.evaluate(() => window.telemetryEvents);
const positionMenuEvent = events.find(event => 
  event[0] === 'event' && event[1] === 'position_menu_opened'
);

expect(positionMenuEvent).toBeDefined();
expect(positionMenuEvent[2].action).toBe('edit');
expect(positionMenuEvent[2].source).toBe('position_card');
```

### 6. Accessibility Tests

#### Test 6.1: ARIA Roles and Labels
```javascript
const editButton = page.locator('[aria-label="ポジションを編集"]');
await expect(editButton).toHaveAttribute('aria-label', 'ポジションを編集');

await editButton.click();
const menu = page.locator('[role="menu"]');
await expect(menu).toHaveAttribute('role', 'menu');
await expect(menu).toHaveAttribute('aria-label', 'ポジション操作メニュー');

const menuItem = page.locator('[role="menuitem"]');
await expect(menuItem).toHaveAttribute('role', 'menuitem');
```

#### Test 6.2: Focus Management
```javascript
const editButton = page.locator('[aria-label="ポジションを編集"]');
await editButton.click();

// First menu item should receive focus
const firstMenuItem = page.locator('[role="menuitem"]').first();
await expect(firstMenuItem).toBeFocused();
```

### 7. Visual Regression Tests

#### Test 7.1: Position Card with Edit Icon
```javascript
await page.goto('http://localhost:3001');
await page.waitForSelector('[data-testid="position-card"]');
await page.screenshot({ 
  path: '.mcp-out/position-card-with-edit-icon.png',
  clip: { x: 0, y: 0, width: 400, height: 200 }
});
```

#### Test 7.2: Context Menu Display
```javascript
await page.locator('[aria-label="ポジションを編集"]').click();
await page.screenshot({ 
  path: '.mcp-out/position-context-menu.png',
  clip: { x: 0, y: 0, width: 400, height: 300 }
});
```

## Test Data Requirements
- At least one position with `status: 'OPEN'` and `ownerId: 'current_user'`
- At least one position with `status: 'OPEN'` and `ownerId: 'other_user'`  
- At least one position with `status: 'CLOSED'` and `ownerId: 'current_user'`

## Success Criteria
- All permission-based visibility tests pass
- Multi-device interactions work correctly
- Context menu behaves properly (positioning, dismissal)
- Edit modal integration functions as expected
- Telemetry events are recorded correctly
- Accessibility requirements are met
- Visual regression tests show expected UI
- Console error count = 0 during all tests

## Test Execution Commands
```bash
# Run E2E tests
npm run test:e2e

# Generate screenshots
npx playwright test --headed --project=chromium tests/position-context-menu.spec.ts

# Check console errors
npx playwright test --reporter=dot tests/console-errors.spec.ts
```

## Notes
- Tests should run in both desktop and mobile viewports
- Ensure proper cleanup between test runs
- Mock backend responses for consistent test data
- Tests should be resilient to timing issues with proper wait strategies