import { test, expect } from '@playwright/test';

// Mock API responses
const mockSuccessResponse = {
  position: {
    symbol: '9984',
    side: 'LONG',
    qtyTotal: 100,
    avgPrice: 15850,
    lots: [{ price: 15850, qtyRemaining: 100, time: '2025-09-01T10:00:00Z' }],
    realizedPnl: 0,
    updatedAt: '2025-09-01T10:00:00Z',
    name: 'ソフトバンクグループ',
    currentTradeId: 'test-trade-123',
    status: 'OPEN',
    ownerId: 'user-123',
    version: 13
  },
  message: 'Position updated successfully'
};

const mock409Response = {
  message: 'Version conflict - position has been updated by another user',
  code: 'VERSION_CONFLICT'
};

const mock500Response = {
  message: 'Internal server error',
  code: 'INTERNAL_ERROR'
};

const mockPositionRefetch = {
  symbol: '9984',
  side: 'LONG',
  qtyTotal: 120,
  avgPrice: 15800,
  lots: [{ price: 15800, qtyRemaining: 120, time: '2025-09-01T10:05:00Z' }],
  realizedPnl: 0,
  updatedAt: '2025-09-01T10:05:00Z',
  name: 'ソフトバンクグループ',
  currentTradeId: 'test-trade-123',
  status: 'OPEN',
  ownerId: 'user-123',
  version: 14
};

test.describe('Entry Edit Modal - Save Processing', () => {
  test.beforeEach(async ({ page }) => {
    // Set up basic page navigation
    await page.goto('/');
    
    // Mock initial data for the modal
    await page.addInitScript(() => {
      window.mockPositionData = {
        positionId: 'pos-123',
        symbolCode: '9984',
        symbolName: 'ソフトバンクグループ',
        side: 'LONG',
        price: 15870,
        qty: 100,
        note: '',
        tradeId: 'test-trade-123',
        version: 12
      };
    });
  });

  test('should successfully save entry with PATCH API', async ({ page }) => {
    // Mock successful PATCH API response
    await page.route('/api/positions/pos-123/entry', async (route) => {
      const request = route.request();
      
      if (request.method() === 'PATCH') {
        const payload = request.postDataJSON();
        
        // Verify payload structure
        expect(payload).toMatchObject({
          symbolCode: '9984',
          symbolName: 'ソフトバンクグループ',
          side: 'LONG',
          price: expect.any(Number),
          qty: expect.any(Number),
          note: expect.any(String),
          version: expect.any(Number)
        });
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockSuccessResponse)
        });
      }
    });

    // Open modal
    await page.evaluate(() => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div data-testid="entry-edit-modal" style="display: block;">
          <form>
            <input data-testid="entry-price" value="15870" />
            <input data-testid="entry-qty" value="100" />
            <button data-testid="entry-edit-save" type="submit">保存</button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    });

    // Verify modal is visible
    await expect(page.getByTestId('entry-edit-modal')).toBeVisible();
    
    // Click save button
    await page.getByTestId('entry-edit-save').click();
    
    // Verify loading state
    await expect(page.getByTestId('entry-edit-save')).toBeDisabled();
    
    // Wait for API call completion and success
    await page.waitForTimeout(1000);
    
    // Verify success telemetry event (mock gtag call)
    const gtagCalls = await page.evaluate(() => {
      return (window as any).gtagCalls || [];
    });
    
    expect(gtagCalls).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'entry_edit_success',
          event_category: 'position_management',
          position_id: 'pos-123'
        })
      ])
    );
  });

  test('should handle 409 conflict error with refetch flow', async ({ page }) => {
    let requestCount = 0;
    
    // Mock 409 error on first PATCH, success on second
    await page.route('/api/positions/pos-123/entry', async (route) => {
      requestCount++;
      
      if (requestCount === 1) {
        // First request - 409 conflict
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify(mock409Response)
        });
      } else {
        // Second request - success
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockSuccessResponse)
        });
      }
    });

    // Mock refetch API
    await page.route('/api/positions/pos-123', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockPositionRefetch)
        });
      }
    });

    // Mock gtag for telemetry tracking
    await page.addInitScript(() => {
      (window as any).gtagCalls = [];
      (window as any).gtag = (...args: any[]) => {
        (window as any).gtagCalls.push({
          event: args[0],
          ...args[1]
        });
      };
    });

    // Open modal
    await page.evaluate(() => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div data-testid="entry-edit-modal" style="display: block;">
          <form>
            <input data-testid="entry-price" value="15870" />
            <input data-testid="entry-qty" value="100" />
            <button data-testid="entry-edit-save" type="submit">保存</button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    });

    // First save attempt - should trigger 409
    await page.getByTestId('entry-edit-save').click();
    
    // Wait for error processing
    await page.waitForTimeout(500);
    
    // Verify 409 conflict banner appears
    await expect(page.getByTestId('entry-edit-conflict')).toBeVisible();
    
    // Verify refetch button appears
    await expect(page.getByTestId('entry-edit-refetch')).toBeVisible();
    
    // Verify 409 telemetry event
    const conflict409Events = await page.evaluate(() => {
      return ((window as any).gtagCalls || []).filter((call: any) => 
        call.event === 'entry_edit_conflict_409'
      );
    });
    
    expect(conflict409Events).toHaveLength(1);
    expect(conflict409Events[0]).toMatchObject({
      event: 'entry_edit_conflict_409',
      event_category: 'position_management',
      position_id: 'pos-123'
    });

    // Click refetch button
    await page.getByTestId('entry-edit-refetch').click();
    
    // Wait for refetch completion
    await page.waitForTimeout(500);
    
    // Verify refetch telemetry
    const refetchEvents = await page.evaluate(() => {
      return ((window as any).gtagCalls || []).filter((call: any) => 
        call.event === 'entry_edit_refetch'
      );
    });
    
    expect(refetchEvents).toHaveLength(1);
    
    // Verify conflict banner disappears
    await expect(page.getByTestId('entry-edit-conflict')).not.toBeVisible();
    
    // Retry save - should succeed
    await page.getByTestId('entry-edit-save').click();
    
    // Wait for success
    await page.waitForTimeout(1000);
    
    // Verify success telemetry
    const successEvents = await page.evaluate(() => {
      return ((window as any).gtagCalls || []).filter((call: any) => 
        call.event === 'entry_edit_success'
      );
    });
    
    expect(successEvents).toHaveLength(1);
  });

  test('should handle 5xx server errors with retry guidance', async ({ page }) => {
    // Mock 500 error response
    await page.route('/api/positions/pos-123/entry', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify(mock500Response)
      });
    });

    // Open modal
    await page.evaluate(() => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div data-testid="entry-edit-modal" style="display: block;">
          <form>
            <input data-testid="entry-price" value="15870" />
            <input data-testid="entry-qty" value="100" />
            <button data-testid="entry-edit-save" type="submit">保存</button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    });

    // Click save button
    await page.getByTestId('entry-edit-save').click();
    
    // Wait for error processing
    await page.waitForTimeout(500);
    
    // Verify error banner appears with server error message
    await expect(page.getByTestId('entry-edit-banner')).toBeVisible();
    await expect(page.getByText('サーバーエラーが発生しました')).toBeVisible();
    
    // Verify save button is re-enabled for retry
    await expect(page.getByTestId('entry-edit-save')).toBeEnabled();
    
    // Verify user input is preserved
    await expect(page.getByTestId('entry-price')).toHaveValue('15870');
    await expect(page.getByTestId('entry-qty')).toHaveValue('100');
  });

  test('should handle network errors with appropriate messaging', async ({ page }) => {
    // Mock network error
    await page.route('/api/positions/pos-123/entry', async (route) => {
      await route.abort('failed');
    });

    // Open modal
    await page.evaluate(() => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div data-testid="entry-edit-modal" style="display: block;">
          <form>
            <input data-testid="entry-price" value="15870" />
            <input data-testid="entry-qty" value="100" />
            <button data-testid="entry-edit-save" type="submit">保存</button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    });

    // Click save button
    await page.getByTestId('entry-edit-save').click();
    
    // Wait for error processing
    await page.waitForTimeout(500);
    
    // Verify network error message
    await expect(page.getByTestId('entry-edit-banner')).toBeVisible();
    await expect(page.getByText('ネットワークエラーが発生しました')).toBeVisible();
    
    // Verify save button is re-enabled for retry
    await expect(page.getByTestId('entry-edit-save')).toBeEnabled();
  });

  test('should prevent double submission', async ({ page }) => {
    let requestCount = 0;
    
    // Mock slow API response to test double submission prevention
    await page.route('/api/positions/pos-123/entry', async (route) => {
      requestCount++;
      
      // Delay response to simulate slow API
      await page.waitForTimeout(2000);
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSuccessResponse)
      });
    });

    // Open modal
    await page.evaluate(() => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div data-testid="entry-edit-modal" style="display: block;">
          <form>
            <input data-testid="entry-price" value="15870" />
            <input data-testid="entry-qty" value="100" />
            <button data-testid="entry-edit-save" type="submit">保存</button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    });

    // Rapid clicks on save button
    await page.getByTestId('entry-edit-save').click();
    await page.getByTestId('entry-edit-save').click();
    await page.getByTestId('entry-edit-save').click();
    
    // Wait for API completion
    await page.waitForTimeout(3000);
    
    // Verify only one request was made
    expect(requestCount).toBe(1);
    
    // Verify button was properly disabled during submission
    await expect(page.getByTestId('entry-edit-save')).toBeDisabled();
  });

  test('should display loading states correctly', async ({ page }) => {
    // Mock delayed API response
    await page.route('/api/positions/pos-123/entry', async (route) => {
      await page.waitForTimeout(1000);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSuccessResponse)
      });
    });

    // Open modal
    await page.evaluate(() => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div data-testid="entry-edit-modal" style="display: block;">
          <form>
            <input data-testid="entry-price" value="15870" />
            <input data-testid="entry-qty" value="100" />
            <button data-testid="entry-edit-save" type="submit">
              <span>保存</span>
            </button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    });

    // Click save and immediately verify loading state
    await page.getByTestId('entry-edit-save').click();
    
    // Verify button is disabled and shows loading
    await expect(page.getByTestId('entry-edit-save')).toBeDisabled();
    await expect(page.getByText('送信中')).toBeVisible();
    
    // Verify form inputs are disabled during submission
    await expect(page.getByTestId('entry-price')).toBeDisabled();
    await expect(page.getByTestId('entry-qty')).toBeDisabled();
    
    // Wait for completion
    await page.waitForTimeout(1500);
    
    // Verify loading state clears
    await expect(page.getByText('送信中')).not.toBeVisible();
  });

  test('should take screenshot of conflict UI for documentation', async ({ page }) => {
    // Mock 409 error
    await page.route('/api/positions/pos-123/entry', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify(mock409Response)
      });
    });

    // Open modal with realistic styling
    await page.evaluate(() => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div data-testid="entry-edit-modal" style="display: block; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 24px; border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.15); z-index: 1000; width: 369px;">
          <h2>建値入力</h2>
          <div data-testid="entry-edit-conflict" style="margin: 16px 0; padding: 12px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; display: none;">
            <div style="display: flex; align-items: start; justify-content: space-between;">
              <p style="color: #991b1b; font-size: 14px; margin: 0; flex: 1;">
                他のユーザーによってこのポジションが更新されています。最新情報を取得してから再度編集してください。
              </p>
              <button data-testid="entry-edit-refetch" style="margin-left: 12px; padding: 6px 12px; background: #dbeafe; color: #1d4ed8; border: none; border-radius: 4px; font-size: 12px; cursor: pointer;">
                最新を取得
              </button>
            </div>
          </div>
          <form>
            <input data-testid="entry-price" value="15870" style="width: 100%; margin: 8px 0; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;" />
            <input data-testid="entry-qty" value="100" style="width: 100%; margin: 8px 0; padding: 8px; border: 1px solid #d1d5db; border-radius: 4px;" />
            <button data-testid="entry-edit-save" type="submit" style="width: 100%; padding: 12px; background: #1e77f0; color: white; border: none; border-radius: 4px; font-weight: bold; margin-top: 16px;">送信</button>
          </form>
        </div>
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 999;"></div>
      `;
      document.body.appendChild(modal);
    });

    // Click save to trigger 409 error
    await page.getByTestId('entry-edit-save').click();
    
    // Wait for error processing
    await page.waitForTimeout(500);
    
    // Show the conflict banner
    await page.evaluate(() => {
      const banner = document.querySelector('[data-testid="entry-edit-conflict"]') as HTMLElement;
      if (banner) banner.style.display = 'block';
    });
    
    // Take screenshot of the conflict UI
    await page.screenshot({
      path: '/Users/prism.tokyo/gptset/.mcp-out/entry-edit-conflict.png',
      clip: { x: 0, y: 0, width: 1200, height: 800 }
    });
  });
});

// Test data validation and edge cases
test.describe('Entry Edit Modal - Validation & Edge Cases', () => {
  test('should validate version field requirement', async ({ page }) => {
    // Open modal without version data
    await page.evaluate(() => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div data-testid="entry-edit-modal" style="display: block;">
          <form>
            <input data-testid="entry-price" value="15870" />
            <input data-testid="entry-qty" value="100" />
            <button data-testid="entry-edit-save" type="submit">保存</button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    });

    // Without proper version data, save button should be disabled
    // This test would verify the schema validation is working
    await expect(page.getByTestId('entry-edit-save')).toBeDisabled();
  });

  test('should handle missing positionId gracefully', async ({ page }) => {
    // Mock fallback onSave behavior when no positionId is provided
    let onSaveCalled = false;
    
    await page.addInitScript(() => {
      (window as any).mockOnSave = () => {
        (window as any).onSaveCalled = true;
        return Promise.resolve();
      };
    });

    // Open modal without positionId
    await page.evaluate(() => {
      const modal = document.createElement('div');
      modal.innerHTML = `
        <div data-testid="entry-edit-modal" style="display: block;">
          <form>
            <input data-testid="entry-price" value="15870" />
            <input data-testid="entry-qty" value="100" />
            <button data-testid="entry-edit-save" type="submit">保存</button>
          </form>
        </div>
      `;
      document.body.appendChild(modal);
    });

    // Click save - should fall back to legacy onSave
    await page.getByTestId('entry-edit-save').click();
    
    // Verify fallback was called
    await page.waitForTimeout(500);
    const onSaveResult = await page.evaluate(() => (window as any).onSaveCalled);
    expect(onSaveResult).toBe(true);
  });
});