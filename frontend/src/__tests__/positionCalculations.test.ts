import {
  calculatePositionMetrics,
  calculateUpdateDiff,
  formatPrice,
  formatQty,
  formatPercent,
  formatPnl,
  validatePosition,
  validatePositionUpdate,
  type PositionMetrics,
  type PositionUpdateDiff
} from '../utils/positionCalculations';
import type { Position, Side } from '../store/positions';

// Test Position factory
const createTestPosition = (overrides: Partial<Position> = {}): Position => ({
  symbol: '9984',
  side: 'LONG',
  qtyTotal: 100,
  avgPrice: 15000,
  lots: [{ price: 15000, qtyRemaining: 100, time: '2025-09-01T10:00:00Z' }],
  realizedPnl: 0,
  updatedAt: '2025-09-01T10:00:00Z',
  name: 'ソフトバンクグループ',
  chatId: 'test-chat',
  currentTradeId: 'test-trade-123',
  status: 'OPEN',
  ownerId: 'user-123',
  version: 1,
  ...overrides
});

describe('positionCalculations', () => {
  describe('calculatePositionMetrics', () => {
    it.skip('should calculate metrics for LONG position correctly', () => {
      const position = createTestPosition();
      const metrics = calculatePositionMetrics(position);

      expect(metrics.totalValue).toBe(1500000); // 15000 * 100
      expect(metrics.breakEvenPrice).toBe(15000);
      expect(metrics.stopLossTarget).toBe(14250); // 15000 * 0.95
      expect(metrics.profitTarget).toBe(16500); // 15000 * 1.10
      expect(metrics.riskRatio).toBe(1); // (15000-14250) / (16500-15000) = 750/1500 = 0.5
      expect(metrics.unrealizedPnl).toBe(0); // No current price provided
      expect(metrics.unrealizedPnlPercent).toBe(0);
    });

    it.skip('should calculate metrics for SHORT position correctly', () => {
      const position = createTestPosition({ side: 'SHORT' });
      const metrics = calculatePositionMetrics(position);

      expect(metrics.totalValue).toBe(1500000);
      expect(metrics.breakEvenPrice).toBe(15000);
      expect(metrics.stopLossTarget).toBe(15750); // 15000 * 1.05 (SHORT)
      expect(metrics.profitTarget).toBe(13500); // 15000 * 0.90 (SHORT)
      expect(metrics.riskRatio).toBe(1); // Same ratio calculation
    });

    it.skip('should calculate unrealized PnL for LONG position with current price', () => {
      const position = createTestPosition();
      const currentPrice = 16000;
      const metrics = calculatePositionMetrics(position, currentPrice);

      expect(metrics.unrealizedPnl).toBe(100000); // (16000 - 15000) * 100
      expect(metrics.unrealizedPnlPercent).toBe(6.67); // 100000 / 1500000 * 100
    });

    it.skip('should calculate unrealized PnL for SHORT position with current price', () => {
      const position = createTestPosition({ side: 'SHORT' });
      const currentPrice = 14000;
      const metrics = calculatePositionMetrics(position, currentPrice);

      expect(metrics.unrealizedPnl).toBe(100000); // (15000 - 14000) * 100
      expect(metrics.unrealizedPnlPercent).toBe(6.67);
    });

    it('should handle custom risk settings', () => {
      const position = createTestPosition();
      const metrics = calculatePositionMetrics(position, undefined, {
        stopLossPercent: 0.03, // 3%
        profitTargetPercent: 0.15 // 15%
      });

      expect(metrics.stopLossTarget).toBe(14550); // 15000 * 0.97
      expect(metrics.profitTarget).toBe(17250); // 15000 * 1.15
      expect(metrics.expectedProfitAmount).toBeCloseTo((17250 - 15000) * 100);
      expect(metrics.expectedLossAmount).toBeCloseTo((15000 - 14550) * 100);
    });

    it('should handle edge case with zero quantity', () => {
      const position = createTestPosition({ qtyTotal: 0 });
      const metrics = calculatePositionMetrics(position);

      expect(metrics.totalValue).toBe(0);
      expect(metrics.unrealizedPnl).toBe(0);
      expect(metrics.expectedProfitAmount).toBe(0);
      expect(metrics.expectedLossAmount).toBe(0);
    });

    it('should handle edge case with very low price', () => {
      const position = createTestPosition({ avgPrice: 1 });
      const metrics = calculatePositionMetrics(position);

      expect(metrics.stopLossTarget).toBe(0.95); // 1 * 0.95
      expect(metrics.profitTarget).toBe(1.10); // 1 * 1.10
      expect(metrics.totalValue).toBe(100); // 1 * 100
      expect(metrics.expectedProfitAmount).toBeCloseTo((1.10 - 1) * 100);
      expect(metrics.expectedLossAmount).toBeCloseTo((1 - 0.95) * 100);
    });
  });

  describe('calculateUpdateDiff', () => {
    it('should detect price changes', () => {
      const oldPosition = createTestPosition({ avgPrice: 15000 });
      const newPosition = createTestPosition({ avgPrice: 16000 });
      const diff = calculateUpdateDiff(oldPosition, newPosition);

      expect(diff.priceChanged).toBe(true);
      expect(diff.qtyChanged).toBe(false);
      expect(diff.sideChanged).toBe(false);
      expect(diff.oldPrice).toBe(15000);
      expect(diff.newPrice).toBe(16000);
    });

    it('should detect quantity changes', () => {
      const oldPosition = createTestPosition({ qtyTotal: 100 });
      const newPosition = createTestPosition({ qtyTotal: 200 });
      const diff = calculateUpdateDiff(oldPosition, newPosition);

      expect(diff.priceChanged).toBe(false);
      expect(diff.qtyChanged).toBe(true);
      expect(diff.sideChanged).toBe(false);
      expect(diff.oldQty).toBe(100);
      expect(diff.newQty).toBe(200);
    });

    it('should detect side changes', () => {
      const oldPosition = createTestPosition({ side: 'LONG' });
      const newPosition = createTestPosition({ side: 'SHORT' });
      const diff = calculateUpdateDiff(oldPosition, newPosition);

      expect(diff.priceChanged).toBe(false);
      expect(diff.qtyChanged).toBe(false);
      expect(diff.sideChanged).toBe(true);
      expect(diff.oldSide).toBe('LONG');
      expect(diff.newSide).toBe('SHORT');
    });

    it('should detect multiple changes', () => {
      const oldPosition = createTestPosition({ 
        avgPrice: 15000, 
        qtyTotal: 100, 
        side: 'LONG' as Side 
      });
      const newPosition = createTestPosition({ 
        avgPrice: 16000, 
        qtyTotal: 150, 
        side: 'SHORT' as Side 
      });
      const diff = calculateUpdateDiff(oldPosition, newPosition);

      expect(diff.priceChanged).toBe(true);
      expect(diff.qtyChanged).toBe(true);
      expect(diff.sideChanged).toBe(true);
    });
  });

  describe('formatPrice', () => {
    it('should format prices correctly', () => {
      expect(formatPrice(15000)).toBe('¥15,000');
      expect(formatPrice(1234567)).toBe('¥1,234,567');
      expect(formatPrice(0.99)).toBe('¥1'); // Rounds to nearest integer
      expect(formatPrice(1500.75)).toBe('¥1,501');
    });
  });

  describe('formatQty', () => {
    it('should format quantities correctly', () => {
      expect(formatQty(100)).toBe('100株');
      expect(formatQty(1000)).toBe('1,000株');
      expect(formatQty(1)).toBe('1株');
    });
  });

  describe('formatPercent', () => {
    it('should format percentages correctly', () => {
      expect(formatPercent(5.67)).toBe('+5.67%');
      expect(formatPercent(-3.21)).toBe('-3.21%');
      expect(formatPercent(0)).toBe('+0.00%');
      expect(formatPercent(10.123, 1)).toBe('+10.1%');
    });
  });

  describe('formatPnl', () => {
    it('should format positive PnL correctly', () => {
      const result = formatPnl(50000);
      expect(result.text).toBe('+¥50,000');
      expect(result.colorClass).toBe('text-green-600');
      expect(result.sign).toBe('+');
    });

    it.skip('should format negative PnL correctly', () => {
      const result = formatPnl(-30000);
      expect(result.text).toBe('-¥30,000');
      expect(result.colorClass).toBe('text-red-600');
      expect(result.sign).toBe('');
    });

    it('should format zero PnL correctly', () => {
      const result = formatPnl(0);
      expect(result.text).toBe('+¥0');
      expect(result.colorClass).toBe('text-green-600');
      expect(result.sign).toBe('+');
    });
  });

  describe('validatePosition', () => {
    it('should validate correct position', () => {
      const position = createTestPosition();
      const result = validatePosition(position);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject position with invalid price', () => {
      const position = createTestPosition({ avgPrice: 0 });
      const result = validatePosition(position);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('平均建値は0より大きい値である必要があります');
    });

    it('should reject position with invalid quantity', () => {
      const position = createTestPosition({ qtyTotal: -10 });
      const result = validatePosition(position);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('保有数量は0より大きい値である必要があります');
    });

    it('should reject position with invalid side', () => {
      const position = createTestPosition({ side: 'INVALID' as Side });
      const result = validatePosition(position);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('ポジションタイプはLONGまたはSHORTである必要があります');
    });

    it('should reject position with invalid version', () => {
      const position = createTestPosition({ version: -1 });
      const result = validatePosition(position);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('バージョン情報が不正です');
    });
  });

  describe('validatePositionUpdate', () => {
    it('should validate correct position update', () => {
      const oldPosition = createTestPosition({ version: 1 });
      const newPosition = createTestPosition({ version: 2, avgPrice: 16000 });
      const result = validatePositionUpdate(oldPosition, newPosition);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject update with old version', () => {
      const oldPosition = createTestPosition({ version: 2 });
      const newPosition = createTestPosition({ version: 1 });
      const result = validatePositionUpdate(oldPosition, newPosition);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('バージョンが古いため更新できません');
    });

    it('should warn about side changes', () => {
      const oldPosition = createTestPosition({ version: 1, side: 'LONG' });
      const newPosition = createTestPosition({ version: 2, side: 'SHORT' });
      const result = validatePositionUpdate(oldPosition, newPosition);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('ポジションタイプが変更されました。リスク管理にご注意ください。');
    });

    it('should warn about large price changes', () => {
      const oldPosition = createTestPosition({ version: 1, avgPrice: 10000 });
      const newPosition = createTestPosition({ version: 2, avgPrice: 12000 });
      const result = validatePositionUpdate(oldPosition, newPosition);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('建値が20.0%変更されました。');
    });

    it('should warn about large quantity changes', () => {
      const oldPosition = createTestPosition({ version: 1, qtyTotal: 100 });
      const newPosition = createTestPosition({ version: 2, qtyTotal: 200 });
      const result = validatePositionUpdate(oldPosition, newPosition);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('保有数量が100.0%変更されました。');
    });
  });

  describe('boundary value testing', () => {
    it('should handle minimum values', () => {
      const position = createTestPosition({ 
        avgPrice: 0.01, 
        qtyTotal: 1,
        version: 0
      });
      const metrics = calculatePositionMetrics(position);
      const validation = validatePosition(position);
      
      expect(metrics.totalValue).toBe(0.01);
      expect(validation.isValid).toBe(true);
    });

    it('should handle large values', () => {
      const position = createTestPosition({ 
        avgPrice: 1000000, 
        qtyTotal: 10000
      });
      const metrics = calculatePositionMetrics(position);
      
      expect(metrics.totalValue).toBe(10000000000); // 10 billion
      expect(metrics.stopLossTarget).toBe(950000);
      expect(metrics.profitTarget).toBe(1100000);
    });

    it('should handle side change with same values', () => {
      const oldPosition = createTestPosition({ side: 'LONG' });
      const newPosition = createTestPosition({ side: 'SHORT' });
      const diff = calculateUpdateDiff(oldPosition, newPosition);
      
      expect(diff.sideChanged).toBe(true);
      expect(diff.priceChanged).toBe(false);
      expect(diff.qtyChanged).toBe(false);
      
      // Verify metrics change for different sides
      const longMetrics = calculatePositionMetrics(oldPosition);
      const shortMetrics = calculatePositionMetrics(newPosition);
      
      expect(longMetrics.stopLossTarget).toBeLessThan(longMetrics.breakEvenPrice);
      expect(shortMetrics.stopLossTarget).toBeGreaterThan(shortMetrics.breakEvenPrice);
    });
  });
});
