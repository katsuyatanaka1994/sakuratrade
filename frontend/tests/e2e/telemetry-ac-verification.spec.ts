/**
 * E2E Tests for Telemetry & Acceptance Criteria Verification
 * テレメトリ送信とAC1-6の自動検証
 */

import { test, expect, type Page } from '@playwright/test';
import type { TelemetryEvent } from '../../src/lib/telemetry';
import type { ACTestContext, ACResult } from '../../src/lib/acceptance-criteria';

// テストデータ
const TEST_POSITION = {
  id: 'test-position-123',
  symbol: 'AAPL',
  name: 'Apple Inc.',
  side: 'LONG' as const,
  avgPrice: 150.0,
  qtyTotal: 100,
  status: 'OPEN' as const,
  ownerId: 'current_user',
  version: 1,
  updatedAt: new Date().toISOString(),
  chatId: 'test-chat-001'
};

const OTHER_USER_POSITION = {
  ...TEST_POSITION,
  id: 'test-position-456',
  ownerId: 'other_user'
};

// テレメトリイベント記録用
interface TelemetryCapture {
  events: Array<{
    event: TelemetryEvent;
    payload: any;
    timestamp: number;
  }>;
  apiCalls: Array<{
    endpoint: string;
    method: string;
    status: number;
    timestamp: number;
  }>;
}

test.describe('Telemetry & AC Verification', () => {
  let telemetryCapture: TelemetryCapture;
  
  test.beforeEach(async ({ page }) => {
    // テレメトリキャプチャの初期化
    telemetryCapture = {
      events: [],
      apiCalls: []
    };
    
    // テレメトリエンドポイントのモック
    await page.route('/api/telemetry', async (route) => {
      const request = route.request();
      const requestBody = JSON.parse(await request.postData() || '{}');
      
      // テレメトリイベントを記録
      if (requestBody.events) {
        requestBody.events.forEach((event: any) => {
          telemetryCapture.events.push({
            event: event.event,
            payload: event.payload,
            timestamp: event.timestamp || Date.now()
          });
        });
      }
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, eventCount: requestBody.events?.length || 0 })
      });
    });
    
    // Position API のモック
    await page.route('**/positions/*/entry', async (route) => {
      const request = route.request();
      const method = request.method();
      
      // API呼び出しを記録
      telemetryCapture.apiCalls.push({
        endpoint: request.url(),
        method,
        status: 200,
        timestamp: Date.now()
      });
      
      if (method === 'PATCH') {
        const updatedPosition = {
          ...TEST_POSITION,
          version: TEST_POSITION.version + 1,
          updatedAt: new Date().toISOString()
        };
        
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            position: updatedPosition
          })
        });
      }
    });
    
    // Bot API のモック
    await page.route('/api/bot/message', async (route) => {
      telemetryCapture.apiCalls.push({
        endpoint: route.request().url(),
        method: 'POST',
        status: 200,
        timestamp: Date.now()
      });
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          message_id: `msg_${Date.now()}`
        })
      });
    });
    
    // AI API のモック
    await page.route('/api/ai/analyze', async (route) => {
      telemetryCapture.apiCalls.push({
        endpoint: route.request().url(),
        method: 'POST',
        status: 200,
        timestamp: Date.now()
      });
      
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          analysis_id: `analysis_${Date.now()}`,
          content: 'テクニカル分析結果...'
        })
      });
    });
    
    // チャート画像API のモック
    await page.route('**/images/recent', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'chart_123',
            type: 'chart',
            url: '/test-chart.png',
            filename: 'AAPL_chart.png'
          }
        ])
      });
    });
    
    // テストコンテキストをページに注入
    await page.addInitScript(() => {
      (window as any).acTestContext = {
        position: null,
        currentUserId: 'current_user',
        telemetryEvents: [],
        uiState: {
          hasEditButton: false,
          modalOpen: false,
          conflictBannerVisible: false,
          toastVisible: false
        },
        apiResponses: [],
        sequenceLog: []
      };
    });
    
    // Position データを設定
    await page.addInitScript((testPosition) => {
      localStorage.setItem('positions', JSON.stringify([testPosition]));
      localStorage.setItem('selectedChatId', testPosition.chatId);
    }, TEST_POSITION);
    
    // ページに移動
    await page.goto('/');
    await page.waitForSelector('[data-testid="position-card"]');
  });

  test('AC1: 所有者オープンのみ編集可 - 自分のポジション', async ({ page }) => {
    // 自分のポジションで編集ボタンが表示されることを確認
    const editButton = page.locator('[data-testid="edit-position-button"]');
    await expect(editButton).toBeVisible();
    
    // テレメトリ: position_menu_opened
    await editButton.click();
    
    // メニューが開かれることを確認
    await expect(page.locator('[data-testid="position-context-menu"]')).toBeVisible();
    
    // テレメトリ確認
    await page.waitForTimeout(1000); // テレメトリ送信待ち
    
    const menuOpenedEvents = telemetryCapture.events.filter(e => e.event === 'position_menu_opened');
    expect(menuOpenedEvents).toHaveLength(1);
    expect(menuOpenedEvents[0].payload.side).toBe('LONG');
    expect(menuOpenedEvents[0].payload.status).toBe('OPEN');
  });

  test('AC1: 所有者オープンのみ編集可 - 他人のポジション', async ({ page }) => {
    // 他人のポジションデータに変更
    await page.addInitScript((otherPosition) => {
      localStorage.setItem('positions', JSON.stringify([otherPosition]));
    }, OTHER_USER_POSITION);
    
    await page.reload();
    await page.waitForSelector('[data-testid="position-card"]');
    
    // 他人のポジションでは編集ボタンが表示されないことを確認
    const editButton = page.locator('[data-testid="edit-position-button"]');
    await expect(editButton).not.toBeVisible();
  });

  test('AC2-6: 完全なユーザーフロー検証', async ({ page }) => {
    const startTime = Date.now();
    
    // 1. メニューを開く (position_menu_opened)
    await page.click('[data-testid="edit-position-button"]');
    await expect(page.locator('[data-testid="position-context-menu"]')).toBeVisible();
    
    // 2. 編集モーダルを開く (entry_edit_opened)
    await page.click('[data-testid="edit-menu-item"]');
    await expect(page.locator('[data-testid="entry-edit-modal"]')).toBeVisible();
    
    // 3. フォームを入力して保存 (entry_edit_saved)
    await page.fill('[data-testid="price-input"]', '155.5');
    await page.fill('[data-testid="qty-input"]', '120');
    
    // バリデーションエラーをテスト
    await page.fill('[data-testid="price-input"]', '-10'); // 無効な値
    await page.click('[data-testid="save-button"]');
    
    // バリデーションエラーが表示されることを確認
    await expect(page.locator('.error-message')).toBeVisible();
    
    // 正しい値で再入力
    await page.fill('[data-testid="price-input"]', '155.5');
    await page.click('[data-testid="save-button"]');
    
    // 4. 保存成功を待つ
    await expect(page.locator('[data-testid="entry-edit-modal"]')).not.toBeVisible();
    
    // 5. すべての処理が完了するまで待機
    await page.waitForTimeout(3000);
    
    // テレメトリイベントの検証
    const expectedEvents: TelemetryEvent[] = [
      'position_menu_opened',
      'entry_edit_opened',  
      'entry_edit_saved',
      'plan_bot_sent',
      'ai_reply_regenerated'
    ];
    
    for (const expectedEvent of expectedEvents) {
      const events = telemetryCapture.events.filter(e => e.event === expectedEvent);
      expect(events.length).toBeGreaterThanOrEqual(1);
    }
    
    // AC検証用のコンテキスト構築
    const acContext: ACTestContext = {
      position: TEST_POSITION,
      currentUserId: 'current_user',
      telemetryEvents: telemetryCapture.events.map(e => ({
        event: e.event,
        timestamp: e.timestamp,
        payload: e.payload
      })),
      uiState: {
        hasEditButton: true,
        modalOpen: false,
        conflictBannerVisible: false,
        toastVisible: false
      },
      apiResponses: telemetryCapture.apiCalls,
      sequenceLog: [
        { action: 'position_card_update', timestamp: startTime + 1000, success: true },
        { action: 'bot_messages_sent', timestamp: startTime + 2000, success: true },
        { action: 'ai_analysis_regenerated', timestamp: startTime + 3000, success: true }
      ]
    };
    
    // ACチェック結果をページで実行
    const acResults = await page.evaluate((context) => {
      const { verifyAllAcceptanceCriteria } = (window as any).acLib || {};
      if (!verifyAllAcceptanceCriteria) {
        throw new Error('AC verification library not loaded');
      }
      return verifyAllAcceptanceCriteria(context);
    }, acContext);
    
    // 全ACがPASSすることを確認
    expect(acResults).toBeDefined();
    expect(Array.isArray(acResults)).toBe(true);
    
    const failedTests = acResults.filter((result: ACResult) => !result.passed);
    if (failedTests.length > 0) {
      console.log('Failed AC tests:', failedTests);
    }
    
    expect(failedTests.length).toBe(0);
  });

  test('AC3: 409競合エラー処理', async ({ page }) => {
    // 409エラーのモック
    await page.route('**/positions/*/entry', async (route) => {
      if (route.request().method() === 'PATCH') {
        telemetryCapture.apiCalls.push({
          endpoint: route.request().url(),
          method: 'PATCH',
          status: 409,
          timestamp: Date.now()
        });
        
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Conflict',
            message: 'Position has been updated by another user',
            details: {
              currentVersion: 2,
              conflictFields: ['price', 'qty']
            }
          })
        });
      }
    });
    
    // 編集フローを開始
    await page.click('[data-testid="edit-position-button"]');
    await page.click('[data-testid="edit-menu-item"]');
    await expect(page.locator('[data-testid="entry-edit-modal"]')).toBeVisible();
    
    // 保存して409エラーを発生させる
    await page.fill('[data-testid="price-input"]', '160.0');
    await page.click('[data-testid="save-button"]');
    
    // 409エラーバナーが表示されることを確認
    await expect(page.locator('[data-testid="entry-edit-conflict"]')).toBeVisible();
    
    // 「最新を取得」ボタンの存在確認
    const refreshButton = page.locator('[data-testid="refresh-latest-button"]');
    await expect(refreshButton).toBeVisible();
    
    // テレメトリ確認
    await page.waitForTimeout(1000);
    
    const conflictEvents = telemetryCapture.events.filter(e => e.event === 'entry_edit_conflict_409');
    expect(conflictEvents).toHaveLength(1);
    expect(conflictEvents[0].payload.side).toBe('LONG');
  });

  test('AC5: 付随失敗時もカード更新維持', async ({ page }) => {
    // Bot送信失敗のモック
    await page.route('/api/bot/message', async (route) => {
      telemetryCapture.apiCalls.push({
        endpoint: route.request().url(),
        method: 'POST',
        status: 500,
        timestamp: Date.now()
      });
      
      await route.fulfill({
        status: 500,
        contentType: 'application/json',  
        body: JSON.stringify({
          error: 'Internal Server Error',
          message: 'Bot service temporarily unavailable'
        })
      });
    });
    
    // 編集フローを実行
    await page.click('[data-testid="edit-position-button"]');
    await page.click('[data-testid="edit-menu-item"]');
    await page.fill('[data-testid="price-input"]', '165.0');
    await page.click('[data-testid="save-button"]');
    
    // モーダルが閉じる（PATCH成功）
    await expect(page.locator('[data-testid="entry-edit-modal"]')).not.toBeVisible();
    
    // Bot失敗のトーストが表示されることを確認
    await expect(page.locator('[data-testid="toast"]')).toBeVisible();
    
    // Position Cardが更新されていることを確認
    await expect(page.locator('[data-testid="position-price"]')).toContainText('165.0');
    
    // テレメトリで保存成功が記録されていることを確認
    await page.waitForTimeout(1000);
    const savedEvents = telemetryCapture.events.filter(e => e.event === 'entry_edit_saved');
    expect(savedEvents).toHaveLength(1);
  });

  test('テレメトリペイロード検証', async ({ page }) => {
    // 完全なフローを実行
    await page.click('[data-testid="edit-position-button"]');
    await page.click('[data-testid="edit-menu-item"]');
    await page.fill('[data-testid="price-input"]', '170.0');
    await page.click('[data-testid="save-button"]');
    
    await page.waitForTimeout(2000);
    
    // 各イベントのペイロードを検証
    const savedEvent = telemetryCapture.events.find(e => e.event === 'entry_edit_saved');
    expect(savedEvent).toBeDefined();
    expect(savedEvent!.payload).toMatchObject({
      side: 'LONG',
      status: 'OPEN',
      price: expect.any(Number),
      qty: expect.any(Number),
      version: expect.any(Number),
      ts: expect.any(Number)
    });
    
    // PII除外の確認
    expect(savedEvent!.payload.positionId).not.toContain('test-position');
    expect(savedEvent!.payload.ownerId).not.toContain('current_user');
    expect(savedEvent!.payload.positionId).toMatch(/^[a-f0-9]+$/); // ハッシュ化済み
  });
});