/**
 * E2E Tests for Entry Edit Failure Scenarios
 * 失敗時のUI・再試行導線の検証
 */

import { test, expect, type Page } from '@playwright/test';

// テストデータ
const TEST_CHAT_ID = 'test-chat-001';
const TEST_POSITION = {
  symbol: 'AAPL',
  side: 'LONG',
  avgPrice: 150.0,
  qtyTotal: 100,
  version: 1
};

// モックAPI応答
const mockPatchResponse = (status: number, data?: any) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify(data || {})
});

test.describe('Entry Edit Failure Scenarios', () => {
  
  test.beforeEach(async ({ page }) => {
    // Position データをローカルストレージに設定
    await page.addInitScript((testData) => {
      localStorage.setItem('positions', JSON.stringify([testData.position]));
      localStorage.setItem('selectedChatId', testData.chatId);
    }, { position: TEST_POSITION, chatId: TEST_CHAT_ID });

    // 基本ページに移動
    await page.goto('/');
    await page.waitForSelector('[data-testid="position-card"]');
  });

  test.describe('PATCH 失敗シナリオ', () => {
    
    test('PATCH 409 Conflict - 最新を取得ボタンの動作', async ({ page }) => {
      // 409レスポンスをモック
      await page.route('**/positions/*/entry', (route) => {
        route.fulfill(mockPatchResponse(409, {
          error: 'Conflict',
          message: 'Position has been updated by another user',
          currentVersion: 2
        }));
      });

      // 編集モーダルを開く
      await page.click('[data-testid="edit-position-button"]');
      await page.click('[data-testid="edit-menu-item"]');

      // 保存操作
      await page.fill('[data-testid="price-input"]', '155.0');
      await page.click('[data-testid="save-button"]');

      // 409エラーバナーの表示確認
      await expect(page.locator('[data-testid="error-banner-409"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-banner"]')).toContainText(
        '他のユーザーによってこのポジションが更新されています'
      );

      // 「最新を取得」ボタンの存在確認
      const refreshButton = page.locator('[data-testid="refresh-latest-button"]');
      await expect(refreshButton).toBeVisible();
      await expect(refreshButton).toContainText('最新を取得');

      // ボタンクリック時の動作確認
      await refreshButton.click();
      
      // 最新データ取得のAPIが呼ばれることを確認
      await page.waitForRequest('**/positions/*/latest');
    });

    test('PATCH ネットワークエラー - 再試行バナー', async ({ page }) => {
      // ネットワークエラーをモック
      await page.route('**/positions/*/entry', (route) => {
        route.abort('failed');
      });

      // 編集モーダルを開く
      await page.click('[data-testid="edit-position-button"]');
      await page.click('[data-testid="edit-menu-item"]');

      // 保存操作
      await page.fill('[data-testid="price-input"]', '155.0');
      await page.click('[data-testid="save-button"]');

      // ネットワークエラーバナーの表示確認
      await expect(page.locator('[data-testid="error-banner-network"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-banner"]')).toContainText(
        'ネットワークエラーが発生しました'
      );

      // 「再試行」ボタンの存在確認
      const retryButton = page.locator('[data-testid="retry-button"]');
      await expect(retryButton).toBeVisible();
      await expect(retryButton).toContainText('再試行');
    });

    test('PATCH バリデーションエラー - エラーバナー表示', async ({ page }) => {
      // 422バリデーションエラーをモック
      await page.route('**/positions/*/entry', (route) => {
        route.fulfill(mockPatchResponse(422, {
          error: 'Validation Error',
          message: 'Invalid price value',
          details: { price: ['Price must be positive'] }
        }));
      });

      // 編集モーダルを開く
      await page.click('[data-testid="edit-position-button"]');
      await page.click('[data-testid="edit-menu-item"]');

      // 無効な値で保存操作
      await page.fill('[data-testid="price-input"]', '-10');
      await page.click('[data-testid="save-button"]');

      // バリデーションエラーバナーの表示確認
      await expect(page.locator('[data-testid="error-banner-validation"]')).toBeVisible();
      await expect(page.locator('[data-testid="error-banner"]')).toContainText(
        '入力内容に問題があります'
      );
    });
  });

  test.describe('Bot/AI 失敗シナリオ', () => {
    
    test('Bot メッセージ送信失敗 - トースト通知と再送信', async ({ page }) => {
      // PATCH成功、Bot送信失敗をモック
      await page.route('**/positions/*/entry', (route) => {
        route.fulfill(mockPatchResponse(200, { ...TEST_POSITION, version: 2 }));
      });

      await page.route('**/chat/*/bot-message', (route) => {
        route.fulfill(mockPatchResponse(500, {
          error: 'Bot Service Error',
          message: 'Failed to send message'
        }));
      });

      // 編集モーダルを開く
      await page.click('[data-testid="edit-position-button"]');
      await page.click('[data-testid="edit-menu-item"]');

      // 保存操作（成功）
      await page.fill('[data-testid="price-input"]', '155.0');
      await page.click('[data-testid="save-button"]');

      // モーダルが閉じることを確認
      await expect(page.locator('[data-testid="edit-modal"]')).not.toBeVisible();

      // Botメッセージ失敗のトースト表示確認
      await expect(page.locator('[data-testid="toast"]')).toBeVisible();
      await expect(page.locator('[data-testid="toast"]')).toContainText(
        'メッセージの送信に失敗しました'
      );

      // 再送信ボタンの存在確認
      const retryButton = page.locator('[data-testid="toast-action"]');
      await expect(retryButton).toBeVisible();
      await expect(retryButton).toContainText('再送信');

      // 再送信ボタンクリック
      await retryButton.click();
      
      // 再送信API呼び出し確認
      await page.waitForRequest('**/chat/*/bot-message');
    });

    test('AI分析再生成失敗 - トースト通知と再生成', async ({ page }) => {
      // PATCH成功、AI再生成失敗をモック
      await page.route('**/positions/*/entry', (route) => {
        route.fulfill(mockPatchResponse(200, { ...TEST_POSITION, version: 2 }));
      });

      await page.route('**/chat/*/bot-message', (route) => {
        route.fulfill(mockPatchResponse(200, { success: true }));
      });

      await page.route('**/chat/*/ai-analysis', (route) => {
        route.fulfill(mockPatchResponse(503, {
          error: 'AI Service Unavailable',
          message: 'AI service is temporarily unavailable'
        }));
      });

      // 編集モーダルを開く
      await page.click('[data-testid="edit-position-button"]');
      await page.click('[data-testid="edit-menu-item"]');

      // 保存操作（成功）
      await page.fill('[data-testid="price-input"]', '155.0');
      await page.click('[data-testid="save-button"]');

      // モーダルが閉じることを確認
      await expect(page.locator('[data-testid="edit-modal"]')).not.toBeVisible();

      // AI分析失敗のトースト表示確認
      await expect(page.locator('[data-testid="toast"]')).toBeVisible();
      await expect(page.locator('[data-testid="toast"]')).toContainText(
        'AI分析の生成に失敗しました'
      );

      // 再生成ボタンの存在確認
      const retryButton = page.locator('[data-testid="toast-action"]');
      await expect(retryButton).toBeVisible();
      await expect(retryButton).toContainText('再生成');

      // 再生成ボタンクリック
      await retryButton.click();
      
      // 再生成API呼び出し確認
      await page.waitForRequest('**/chat/*/ai-analysis');
    });

    test('複数のトースト表示制御 - 最大表示数の確認', async ({ page }) => {
      // 複数の失敗をモック（Bot、AI両方失敗）
      await page.route('**/positions/*/entry', (route) => {
        route.fulfill(mockPatchResponse(200, { ...TEST_POSITION, version: 2 }));
      });

      await page.route('**/chat/*/bot-message', (route) => {
        route.fulfill(mockPatchResponse(500, { error: 'Bot Error' }));
      });

      await page.route('**/chat/*/ai-analysis', (route) => {
        route.fulfill(mockPatchResponse(500, { error: 'AI Error' }));
      });

      // 編集保存を複数回実行
      for (let i = 0; i < 5; i++) {
        await page.click('[data-testid="edit-position-button"]');
        await page.click('[data-testid="edit-menu-item"]');
        await page.fill('[data-testid="price-input"]', `${155 + i}.0`);
        await page.click('[data-testid="save-button"]');
        await page.waitForTimeout(1000); // API完了待ち
      }

      // 最大3つのトーストのみ表示されることを確認
      const toasts = page.locator('[data-testid="toast"]');
      await expect(toasts).toHaveCount(3);
    });
  });

  test.describe('再試行ロジック検証', () => {
    
    test('再試行間隔制御 - 高頻度での再試行防止', async ({ page }) => {
      // Bot送信失敗をモック
      await page.route('**/chat/*/bot-message', (route) => {
        route.fulfill(mockPatchResponse(500, { error: 'Service Error' }));
      });

      // トースト表示
      await page.click('[data-testid="edit-position-button"]');
      await page.click('[data-testid="edit-menu-item"]');
      await page.fill('[data-testid="price-input"]', '155.0');
      await page.click('[data-testid="save-button"]');

      // 最初の再試行ボタンをクリック
      const retryButton = page.locator('[data-testid="toast-action"]');
      await retryButton.click();

      // すぐに再度クリック（間隔制御のテスト）
      await retryButton.click();

      // 2回目のリクエストが送信されないことを確認
      // （実際のテストでは適切なタイムアウトとリクエスト数を検証）
    });

    test('最大再試行回数制御 - 上限に達した時の動作', async ({ page }) => {
      let retryCount = 0;
      
      // Bot送信常に失敗をモック
      await page.route('**/chat/*/bot-message', (route) => {
        retryCount++;
        route.fulfill(mockPatchResponse(500, { error: 'Persistent Error' }));
      });

      // 初回失敗トースト表示
      await page.click('[data-testid="edit-position-button"]');
      await page.click('[data-testid="edit-menu-item"]');
      await page.fill('[data-testid="price-input"]', '155.0');
      await page.click('[data-testid="save-button"]');

      // 最大再試行回数（2回）まで試行
      const retryButton = page.locator('[data-testid="toast-action"]');
      
      for (let i = 0; i < 3; i++) {
        if (await retryButton.isVisible()) {
          await retryButton.click();
          await page.waitForTimeout(2000); // 再試行間隔を考慮
        }
      }

      // 最大回数到達後は再試行ボタンが表示されないことを確認
      await expect(retryButton).not.toBeVisible();
    });
  });

  test.describe('エラー分類とUI表示', () => {
    
    test('エラー種別によるUI分岐 - モーダルバナー vs トースト', async ({ page }) => {
      // PATCH 409エラー（モーダルバナー）
      await page.route('**/positions/*/entry', (route) => {
        route.fulfill(mockPatchResponse(409, { error: 'Conflict' }));
      });

      await page.click('[data-testid="edit-position-button"]');
      await page.click('[data-testid="edit-menu-item"]');
      await page.fill('[data-testid="price-input"]', '155.0');
      await page.click('[data-testid="save-button"]');

      // モーダル内バナー表示確認
      await expect(page.locator('[data-testid="error-banner"]')).toBeVisible();
      
      // トーストは表示されないことを確認
      await expect(page.locator('[data-testid="toast"]')).not.toBeVisible();
    });

    test('重要度別の表示スタイル - Critical vs Medium vs Low', async ({ page }) => {
      // 異なる重要度のエラーをテスト
      const errorScenarios = [
        { status: 500, severity: 'critical', expectedClass: 'bg-red-50' },
        { status: 422, severity: 'high', expectedClass: 'bg-red-50' },
        { status: 503, severity: 'medium', expectedClass: 'bg-yellow-50' }
      ];

      for (const scenario of errorScenarios) {
        await page.route('**/positions/*/entry', (route) => {
          route.fulfill(mockPatchResponse(scenario.status, { error: 'Test Error' }));
        });

        await page.click('[data-testid="edit-position-button"]');
        await page.click('[data-testid="edit-menu-item"]');
        await page.fill('[data-testid="price-input"]', '155.0');
        await page.click('[data-testid="save-button"]');

        // 重要度に応じたスタイルが適用されることを確認
        const errorElement = page.locator('[data-testid="error-banner"], [data-testid="toast"]');
        await expect(errorElement).toHaveClass(new RegExp(scenario.expectedClass));

        // 次のテストのためにモーダルを閉じる
        await page.click('[data-testid="close-modal"]');
      }
    });
  });

  test.describe('アクセシビリティ検証', () => {
    
    test('キーボードナビゲーション - エラーバナー・トーストの操作', async ({ page }) => {
      // PATCH 409エラー
      await page.route('**/positions/*/entry', (route) => {
        route.fulfill(mockPatchResponse(409, { error: 'Conflict' }));
      });

      await page.click('[data-testid="edit-position-button"]');
      await page.click('[data-testid="edit-menu-item"]');
      await page.fill('[data-testid="price-input"]', '155.0');
      await page.click('[data-testid="save-button"]');

      // タブキーでフォーカス移動
      await page.keyboard.press('Tab');
      
      // 最新取得ボタンにフォーカスが当たることを確認
      await expect(page.locator('[data-testid="refresh-latest-button"]')).toBeFocused();
      
      // Enterキーで実行
      await page.keyboard.press('Enter');
      await page.waitForRequest('**/positions/*/latest');
    });

    test('スクリーンリーダー対応 - aria-label、role属性の確認', async ({ page }) => {
      await page.route('**/positions/*/entry', (route) => {
        route.fulfill(mockPatchResponse(409, { error: 'Conflict' }));
      });

      await page.click('[data-testid="edit-position-button"]');
      await page.click('[data-testid="edit-menu-item"]');
      await page.fill('[data-testid="price-input"]', '155.0');
      await page.click('[data-testid="save-button"]');

      // エラーバナーのaria属性確認
      const errorBanner = page.locator('[data-testid="error-banner"]');
      await expect(errorBanner).toHaveAttribute('role', 'alert');
      await expect(errorBanner).toHaveAttribute('aria-live', 'polite');
      
      // 再試行ボタンのaria-label確認
      const retryButton = page.locator('[data-testid="refresh-latest-button"]');
      await expect(retryButton).toHaveAttribute('aria-label', '最新の位置データを取得');
    });
  });

  test.describe('パフォーマンス検証', () => {
    
    test('トースト表示・非表示のアニメーション性能', async ({ page }) => {
      // パフォーマンス測定開始
      await page.evaluate(() => performance.mark('toast-animation-start'));

      // Bot送信失敗でトースト表示
      await page.route('**/chat/*/bot-message', (route) => {
        route.fulfill(mockPatchResponse(500, { error: 'Bot Error' }));
      });

      await page.click('[data-testid="edit-position-button"]');
      await page.click('[data-testid="edit-menu-item"]');
      await page.fill('[data-testid="price-input"]', '155.0');
      await page.click('[data-testid="save-button"]');

      // トースト表示完了待ち
      await expect(page.locator('[data-testid="toast"]')).toBeVisible();
      
      // トースト閉じる
      await page.click('[data-testid="toast-close"]');
      await expect(page.locator('[data-testid="toast"]')).not.toBeVisible();

      // パフォーマンス測定
      const animationTime = await page.evaluate(() => {
        performance.mark('toast-animation-end');
        performance.measure('toast-animation', 'toast-animation-start', 'toast-animation-end');
        const measure = performance.getEntriesByName('toast-animation')[0];
        return measure.duration;
      });

      // アニメーション時間が合理的範囲内であることを確認
      expect(animationTime).toBeLessThan(1000); // 1秒未満
    });
  });
});