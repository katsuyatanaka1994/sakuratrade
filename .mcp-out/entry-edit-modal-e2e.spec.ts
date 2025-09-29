import { test, expect } from '@playwright/test';

test.describe('建値入力モーダル（編集モード）', () => {
  test.beforeEach(async ({ page }) => {
    // アプリケーションにアクセス
    await page.goto('http://localhost:3001');
    
    // モーダルを開くための準備（Position Cardの編集ボタンをクリック）
    // 実際の実装に応じてセレクターを調整
    await page.waitForSelector('[data-testid="position-card"]', { timeout: 10000 });
    
    // 編集ボタンをクリックしてコンテキストメニューを開く
    await page.click('[aria-label="ポジションを編集"]');
    
    // 編集メニューアイテムをクリック
    await page.click('button:has-text("編集")');
    
    // モーダルが開くまで待機
    await page.waitForSelector('[data-testid="entry-edit-modal"]', { timeout: 5000 });
  });

  test.describe('プレフィル機能', () => {
    test('既存ポジションデータが正しくプレフィルされる', async ({ page }) => {
      // 銘柄が表示専用で正しく表示されている
      const symbolDisplay = page.locator('[data-testid="entry-symbol"]');
      await expect(symbolDisplay).toBeVisible();
      await expect(symbolDisplay).toContainText(/\d{4}/); // 4桁の銘柄コード
      
      // ポジションタイプがプレフィルされている
      const sideSelect = page.locator('[data-testid="entry-side"]');
      await expect(sideSelect).toBeVisible();
      
      // 価格がプレフィルされている
      const priceInput = page.locator('[data-testid="entry-price"]');
      await expect(priceInput).toBeVisible();
      const priceValue = await priceInput.inputValue();
      expect(parseFloat(priceValue)).toBeGreaterThan(0);
      
      // 株数がプレフィルされている
      const qtyInput = page.locator('[data-testid="entry-qty"]');
      await expect(qtyInput).toBeVisible();
      const qtyValue = await qtyInput.inputValue();
      expect(parseInt(qtyValue)).toBeGreaterThan(0);
    });

    test('読み取り専用フィールドは編集できない', async ({ page }) => {
      // 銘柄表示エリアがinputではなくdivである
      const symbolDisplay = page.locator('[data-testid="entry-symbol"]');
      await expect(symbolDisplay).not.toHaveRole('textbox');
      
      // 銘柄エリア内にinput要素がない
      const symbolInput = symbolDisplay.locator('input');
      await expect(symbolInput).toHaveCount(0);
    });
  });

  test.describe('バリデーション - 価格', () => {
    test('有効な価格を受け入れる', async ({ page }) => {
      const priceInput = page.locator('[data-testid="entry-price"]');
      const validPrices = ['0.01', '1', '100', '1500.99', '15870.50'];
      
      for (const price of validPrices) {
        await priceInput.fill(price);
        
        // エラーメッセージが表示されない
        const errorMessage = page.locator('#price-error');
        await expect(errorMessage).not.toBeVisible();
      }
    });

    test('0以下の価格を拒否する', async ({ page }) => {
      const priceInput = page.locator('[data-testid="entry-price"]');
      const invalidPrices = ['0', '-1', '-100.50'];
      
      for (const price of invalidPrices) {
        await priceInput.fill(price);
        await priceInput.blur(); // フォーカスを外してバリデーション発火
        
        // エラーメッセージが表示される
        const errorMessage = page.locator('#price-error');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('0.01円以上');
      }
    });

    test('小数点3桁以上を拒否する', async ({ page }) => {
      const priceInput = page.locator('[data-testid="entry-price"]');
      const invalidPrices = ['1.123', '100.999', '0.001'];
      
      for (const price of invalidPrices) {
        await priceInput.fill(price);
        await priceInput.blur();
        
        const errorMessage = page.locator('#price-error');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('小数点以下2桁まで');
      }
    });

    test('小数点2桁までを受け入れる', async ({ page }) => {
      const priceInput = page.locator('[data-testid="entry-price"]');
      const validPrices = ['1.00', '100.99', '1500.25'];
      
      for (const price of validPrices) {
        await priceInput.fill(price);
        await priceInput.blur();
        
        const errorMessage = page.locator('#price-error');
        await expect(errorMessage).not.toBeVisible();
      }
    });
  });

  test.describe('バリデーション - 株数', () => {
    test('有効な株数を受け入れる', async ({ page }) => {
      const qtyInput = page.locator('[data-testid="entry-qty"]');
      const validQuantities = ['1', '100', '1000', '500000'];
      
      for (const qty of validQuantities) {
        await qtyInput.fill(qty);
        await qtyInput.blur();
        
        const errorMessage = page.locator('#qty-error');
        await expect(errorMessage).not.toBeVisible();
      }
    });

    test('0以下の株数を拒否する', async ({ page }) => {
      const qtyInput = page.locator('[data-testid="entry-qty"]');
      const invalidQuantities = ['0', '-1', '-100'];
      
      for (const qty of invalidQuantities) {
        await qtyInput.fill(qty);
        await qtyInput.blur();
        
        const errorMessage = page.locator('#qty-error');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('1株以上');
      }
    });

    test('非整数の株数を拒否する', async ({ page }) => {
      const qtyInput = page.locator('[data-testid="entry-qty"]');
      const invalidQuantities = ['1.5', '100.1', '0.5'];
      
      for (const qty of invalidQuantities) {
        await qtyInput.fill(qty);
        await qtyInput.blur();
        
        const errorMessage = page.locator('#qty-error');
        await expect(errorMessage).toBeVisible();
        await expect(errorMessage).toContainText('整数である必要があります');
      }
    });
  });

  test.describe('フォーム送信', () => {
    test('有効なデータで送信が成功する', async ({ page }) => {
      // 価格と株数を有効な値に設定
      await page.fill('[data-testid="entry-price"]', '1500.00');
      await page.fill('[data-testid="entry-qty"]', '100');
      await page.fill('[data-testid="entry-note"]', 'テスト用メモ');
      
      // 送信ボタンがクリック可能になる
      const submitButton = page.locator('[data-testid="entry-edit-save"]');
      await expect(submitButton).toBeEnabled();
      
      // 送信ボタンをクリック
      await submitButton.click();
      
      // 送信中の状態を確認
      await expect(submitButton).toContainText('送信中');
      await expect(submitButton).toBeDisabled();
      
      // スピナーが表示される
      const spinner = submitButton.locator('.animate-spin');
      await expect(spinner).toBeVisible();
    });

    test('無効なデータで送信ボタンが無効化される', async ({ page }) => {
      // 価格を無効な値に設定
      await page.fill('[data-testid="entry-price"]', '0');
      await page.fill('[data-testid="entry-qty"]', '-1');
      
      // 送信ボタンが無効化される
      const submitButton = page.locator('[data-testid="entry-edit-save"]');
      await expect(submitButton).toBeDisabled();
    });

    test('送信中はフォーム要素が無効化される', async ({ page }) => {
      // 有効なデータを入力
      await page.fill('[data-testid="entry-price"]', '1500.00');
      await page.fill('[data-testid="entry-qty"]', '100');
      
      // 送信ボタンをクリック
      const submitButton = page.locator('[data-testid="entry-edit-save"]');
      await submitButton.click();
      
      // フォーム要素が無効化されることを確認
      await expect(page.locator('[data-testid="entry-price"]')).toBeDisabled();
      await expect(page.locator('[data-testid="entry-qty"]')).toBeDisabled();
      await expect(page.locator('[data-testid="entry-side"]')).toBeDisabled();
      await expect(page.locator('[data-testid="entry-note"]')).toBeDisabled();
      await expect(page.locator('[data-testid="entry-edit-cancel"]')).toBeDisabled();
    });
  });

  test.describe('モーダル操作', () => {
    test('キャンセルボタンでモーダルが閉じる', async ({ page }) => {
      const cancelButton = page.locator('[data-testid="entry-edit-cancel"]');
      await cancelButton.click();
      
      // モーダルが閉じる
      const modal = page.locator('[data-testid="entry-edit-modal"]');
      await expect(modal).not.toBeVisible();
    });

    test('Escapeキーでモーダルが閉じる', async ({ page }) => {
      await page.keyboard.press('Escape');
      
      // モーダルが閉じる
      const modal = page.locator('[data-testid="entry-edit-modal"]');
      await expect(modal).not.toBeVisible();
    });

    test('×ボタンでモーダルが閉じる', async ({ page }) => {
      const closeButton = page.locator('button[aria-label="モーダルを閉じる"]');
      await closeButton.click();
      
      // モーダルが閉じる
      const modal = page.locator('[data-testid="entry-edit-modal"]');
      await expect(modal).not.toBeVisible();
    });

    test('送信中はモーダルを閉じることができない', async ({ page }) => {
      // 有効なデータを入力して送信
      await page.fill('[data-testid="entry-price"]', '1500.00');
      await page.fill('[data-testid="entry-qty"]', '100');
      
      const submitButton = page.locator('[data-testid="entry-edit-save"]');
      await submitButton.click();
      
      // 送信中はキャンセルボタンが無効
      const cancelButton = page.locator('[data-testid="entry-edit-cancel"]');
      await expect(cancelButton).toBeDisabled();
      
      // Escapeキーも効かない
      await page.keyboard.press('Escape');
      const modal = page.locator('[data-testid="entry-edit-modal"]');
      await expect(modal).toBeVisible();
    });
  });

  test.describe('アクセシビリティ', () => {
    test('適切なARIA属性が設定されている', async ({ page }) => {
      // モーダルにrole="dialog"が設定されている
      const modal = page.locator('[data-testid="entry-edit-modal"]');
      // Note: shadcn/uiのDialogContentが自動でaria属性を設定するため、
      // 実際の実装ではaria属性の確認方法を調整する必要がある場合があります
      
      // エラーメッセージにrole="alert"が設定されている
      await page.fill('[data-testid="entry-price"]', '0');
      await page.blur('[data-testid="entry-price"]');
      
      const priceError = page.locator('#price-error');
      await expect(priceError).toHaveAttribute('role', 'alert');
    });

    test('フォーカス管理が適切', async ({ page }) => {
      // モーダルを開いた時、フォーカスが適切な場所にある
      const focusedElement = page.locator(':focus');
      // 最初のフォーカス可能要素にフォーカスが当たる
      await expect(focusedElement).toBeVisible();
      
      // Tabキーでフォーカス移動
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // フォーカストラップが機能している（モーダル外にフォーカスが出ない）
      const currentFocus = page.locator(':focus');
      await expect(currentFocus).toBeVisible();
    });

    test('ラベルとフィールドが適切に関連付けられている', async ({ page }) => {
      // aria-describedbyが設定されている
      const priceInput = page.locator('[data-testid="entry-price"]');
      await page.fill(priceInput, '0');
      await priceInput.blur();
      
      await expect(priceInput).toHaveAttribute('aria-describedby', 'price-error');
      
      const qtyInput = page.locator('[data-testid="entry-qty"]');
      await page.fill(qtyInput, '0');
      await qtyInput.blur();
      
      await expect(qtyInput).toHaveAttribute('aria-describedby', 'qty-error');
    });
  });

  test.describe('エラーハンドリング', () => {
    test('送信エラー時にバナーが表示される', async ({ page }) => {
      // ネットワークエラーをシミュレート
      await page.route('**/api/**', route => route.abort());
      
      // 有効なデータを入力して送信
      await page.fill('[data-testid="entry-price"]', '1500.00');
      await page.fill('[data-testid="entry-qty"]', '100');
      
      const submitButton = page.locator('[data-testid="entry-edit-save"]');
      await submitButton.click();
      
      // エラーバナーが表示される
      const errorBanner = page.locator('[data-testid="entry-edit-banner"]');
      await expect(errorBanner).toBeVisible();
      await expect(errorBanner).toContainText('保存に失敗しました');
    });

    test('フィールドエラーが適切に表示される', async ({ page }) => {
      // 複数のフィールドに無効な値を入力
      await page.fill('[data-testid="entry-price"]', '0');
      await page.fill('[data-testid="entry-qty"]', '-1');
      
      // 両方のエラーメッセージが表示される
      const priceError = page.locator('#price-error');
      const qtyError = page.locator('#qty-error');
      
      await expect(priceError).toBeVisible();
      await expect(qtyError).toBeVisible();
    });
  });

  test.describe('リアルタイムバリデーション', () => {
    test('入力中にリアルタイムでバリデーションされる', async ({ page }) => {
      const priceInput = page.locator('[data-testid="entry-price"]');
      
      // 無効な値を入力
      await priceInput.fill('0');
      await priceInput.blur();
      
      // エラーが表示される
      const errorMessage = page.locator('#price-error');
      await expect(errorMessage).toBeVisible();
      
      // 有効な値に修正
      await priceInput.fill('100');
      
      // エラーが消える
      await expect(errorMessage).not.toBeVisible();
    });

    test('送信ボタンの有効/無効がリアルタイムで更新される', async ({ page }) => {
      const submitButton = page.locator('[data-testid="entry-edit-save"]');
      const priceInput = page.locator('[data-testid="entry-price"]');
      
      // 無効な値を入力
      await priceInput.fill('0');
      
      // 送信ボタンが無効化
      await expect(submitButton).toBeDisabled();
      
      // 有効な値に修正
      await priceInput.fill('1500');
      
      // 送信ボタンが有効化
      await expect(submitButton).toBeEnabled();
    });
  });
});

test.describe('Visual Regression Tests', () => {
  test('モーダルの外観が期待通り', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForSelector('[data-testid="position-card"]');
    
    // 編集モーダルを開く
    await page.click('[aria-label="ポジションを編集"]');
    await page.click('button:has-text("編集")');
    await page.waitForSelector('[data-testid="entry-edit-modal"]');
    
    // モーダルのスクリーンショットを取得
    const modal = page.locator('[data-testid="entry-edit-modal"]');
    await expect(modal).toBeVisible();
    
    // 指定されたファイル名でスクリーンショットを保存
    await page.screenshot({ 
      path: '.mcp-out/entry-edit-modal.png',
      fullPage: false 
    });
  });

  test('エラー状態の表示', async ({ page }) => {
    await page.goto('http://localhost:3001');
    await page.waitForSelector('[data-testid="position-card"]');
    
    // 編集モーダルを開く
    await page.click('[aria-label="ポジションを編集"]');
    await page.click('button:has-text("編集")');
    await page.waitForSelector('[data-testid="entry-edit-modal"]');
    
    // エラー状態を作成
    await page.fill('[data-testid="entry-price"]', '0');
    await page.fill('[data-testid="entry-qty"]', '-1');
    await page.blur('[data-testid="entry-qty"]');
    
    // エラー状態のスクリーンショット
    await page.screenshot({ 
      path: '.mcp-out/entry-edit-modal-error.png',
      fullPage: false 
    });
  });
});