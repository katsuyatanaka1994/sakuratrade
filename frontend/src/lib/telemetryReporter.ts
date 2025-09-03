/**
 * テレメトリレポート生成・検証システム
 * AC検証結果とテレメトリ統計の包括レポート
 */

import type { TelemetryEvent } from './telemetry';
import type { ACResult, ACTestContext } from './acceptance-criteria';
import { verifyAllAcceptanceCriteria, generateACReport } from './acceptance-criteria';

// レポート構造の定義
export interface TelemetryReport {
  metadata: {
    generatedAt: string;
    testSuite: string;
    version: string;
    environment: string;
  };
  summary: {
    totalEvents: number;
    uniqueEvents: number;
    successRate: number;
    acPassRate: number;
    criticalIssues: number;
  };
  telemetryAnalysis: {
    eventCounts: Record<TelemetryEvent, number>;
    eventSequence: Array<{
      event: TelemetryEvent;
      timestamp: number;
      payload: any;
    }>;
    duplicateEvents: number;
    missingEvents: TelemetryEvent[];
    payloadValidation: {
      validPayloads: number;
      invalidPayloads: number;
      piiLeaks: string[];
    };
  };
  acceptanceCriteria: {
    results: ACResult[];
    passedCount: number;
    failedCount: number;
    details: Array<{
      id: string;
      status: 'PASS' | 'FAIL';
      description: string;
      evidence: any;
      recommendation?: string;
    }>;
  };
  performance: {
    telemetryDelay: {
      avg: number;
      max: number;
      min: number;
    };
    apiResponseTimes: Array<{
      endpoint: string;
      method: string;
      duration: number;
      status: number;
    }>;
    uiResponsiveness: {
      modalOpenTime: number;
      saveActionTime: number;
      toastDisplayTime: number;
    };
  };
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low';
    category: 'telemetry' | 'ac' | 'performance' | 'ui';
    description: string;
    evidence: any;
    recommendation: string;
  }>;
}

// テレメトリ収集状態
interface TelemetryCollection {
  events: Array<{
    event: TelemetryEvent;
    timestamp: number;
    payload: any;
    sendTime?: number;
  }>;
  apiCalls: Array<{
    endpoint: string;
    method: string;
    status: number;
    timestamp: number;
    duration?: number;
  }>;
  uiActions: Array<{
    action: string;
    timestamp: number;
    duration?: number;
  }>;
}

/**
 * テレメトリ収集の開始
 */
export function startTelemetryCollection(): TelemetryCollection {
  const collection: TelemetryCollection = {
    events: [],
    apiCalls: [],
    uiActions: []
  };
  
  //既存のテレメトリイベントをフック
  if (typeof window !== 'undefined') {
    const originalFetch = window.fetch;
    let fetchStartTime: number;
    
    window.fetch = async function(...args) {
      fetchStartTime = Date.now();
      const response = await originalFetch.apply(this, args);
      const duration = Date.now() - fetchStartTime;
      
      // API呼び出しを記録
      collection.apiCalls.push({
        endpoint: args[0] as string,
        method: (args[1]?.method || 'GET') as string,
        status: response.status,
        timestamp: fetchStartTime,
        duration
      });
      
      return response;
    };
  }
  
  return collection;
}

/**
 * ペイロードのPII検証
 */
export function validatePayloadPII(payload: any): string[] {
  const piiLeaks: string[] = [];
  const piiPatterns = [
    { pattern: /^[a-f0-9-]{36}$/i, field: 'uuid' },
    { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/, field: 'email' },
    { pattern: /\+?[1-9]\d{1,14}$/, field: 'phone' },
    { pattern: /^(user|chat|pos)_[a-zA-Z0-9]+$/, field: 'rawId' }
  ];
  
  function checkObject(obj: any, path: string = '') {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      if (typeof value === 'string') {
        // PII除外対象キーの確認
        if (['userId', 'chatId', 'email', 'phone', 'address'].includes(key)) {
          piiLeaks.push(`${currentPath}: contains PII field`);
        }
        
        // パターンマッチング
        piiPatterns.forEach(({ pattern, field }) => {
          if (pattern.test(value) && !key.includes('hashed')) {
            piiLeaks.push(`${currentPath}: potential ${field} leak`);
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        checkObject(value, currentPath);
      }
    }
  }
  
  if (payload && typeof payload === 'object') {
    checkObject(payload);
  }
  
  return piiLeaks;
}

/**
 * イベント順序の検証
 */
export function validateEventSequence(
  events: Array<{ event: TelemetryEvent; timestamp: number }>
): { valid: boolean; issues: string[] } {
  const expectedSequences = {
    'position_menu_opened': 0,
    'entry_edit_opened': 1,
    'entry_edit_saved': 2,
    'plan_bot_sent': 3,
    'ai_reply_regenerated': 4
  };
  
  const issues: string[] = [];
  let lastIndex = -1;
  
  events.forEach(({ event, timestamp }, i) => {
    const expectedIndex = expectedSequences[event];
    
    if (expectedIndex !== undefined) {
      if (expectedIndex < lastIndex) {
        issues.push(`Event ${event} occurred out of sequence at position ${i}`);
      }
      lastIndex = Math.max(lastIndex, expectedIndex);
    }
  });
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * パフォーマンス分析
 */
export function analyzePerformance(
  collection: TelemetryCollection
): TelemetryReport['performance'] {
  // テレメトリ送信遅延の分析
  const telemetryDelays = collection.events
    .filter(e => e.sendTime)
    .map(e => e.sendTime! - e.timestamp);
    
  const telemetryDelay = {
    avg: telemetryDelays.length > 0 ? 
      telemetryDelays.reduce((a, b) => a + b, 0) / telemetryDelays.length : 0,
    max: telemetryDelays.length > 0 ? Math.max(...telemetryDelays) : 0,
    min: telemetryDelays.length > 0 ? Math.min(...telemetryDelays) : 0
  };
  
  // API応答時間
  const apiResponseTimes = collection.apiCalls
    .filter(call => call.duration !== undefined)
    .map(call => ({
      endpoint: call.endpoint,
      method: call.method,
      duration: call.duration!,
      status: call.status
    }));
  
  // UI応答性分析
  const uiActions = collection.uiActions;
  const modalOpenTime = uiActions.find(a => a.action === 'modal_open')?.duration || 0;
  const saveActionTime = uiActions.find(a => a.action === 'save_action')?.duration || 0;
  const toastDisplayTime = uiActions.find(a => a.action === 'toast_display')?.duration || 0;
  
  return {
    telemetryDelay,
    apiResponseTimes,
    uiResponsiveness: {
      modalOpenTime,
      saveActionTime,
      toastDisplayTime
    }
  };
}

/**
 * 包括的なテレメトリレポート生成
 */
export function generateTelemetryReport(
  collection: TelemetryCollection,
  acContext: ACTestContext,
  testMetadata: {
    testSuite: string;
    version: string;
    environment: string;
  }
): TelemetryReport {
  const generatedAt = new Date().toISOString();
  
  // テレメトリ分析
  const eventCounts = collection.events.reduce((acc, event) => {
    acc[event.event] = (acc[event.event] || 0) + 1;
    return acc;
  }, {} as Record<TelemetryEvent, number>);
  
  const expectedEvents: TelemetryEvent[] = [
    'position_menu_opened',
    'entry_edit_opened',
    'entry_edit_saved',
    'plan_bot_sent',
    'ai_reply_regenerated'
  ];
  
  const missingEvents = expectedEvents.filter(event => !eventCounts[event]);
  const duplicateEvents = Object.values(eventCounts).filter(count => count > 1).length;
  
  // ペイロード検証
  let validPayloads = 0;
  let invalidPayloads = 0;
  const allPiiLeaks: string[] = [];
  
  collection.events.forEach(event => {
    const piiLeaks = validatePayloadPII(event.payload);
    if (piiLeaks.length > 0) {
      invalidPayloads++;
      allPiiLeaks.push(...piiLeaks);
    } else {
      validPayloads++;
    }
  });
  
  // イベント順序検証
  const sequenceValidation = validateEventSequence(collection.events);
  
  // AC検証実行
  const acResults = verifyAllAcceptanceCriteria(acContext);
  const acSummary = generateACReport(acResults);
  
  // パフォーマンス分析
  const performance = analyzePerformance(collection);
  
  // 問題の抽出
  const issues: TelemetryReport['issues'] = [];
  
  // 重大な問題
  if (allPiiLeaks.length > 0) {
    issues.push({
      severity: 'critical',
      category: 'telemetry',
      description: 'PII leakage detected in telemetry payload',
      evidence: allPiiLeaks,
      recommendation: 'Review payload sanitization logic and ensure all PII is properly masked'
    });
  }
  
  if (missingEvents.length > 0) {
    issues.push({
      severity: 'high',
      category: 'telemetry',
      description: 'Missing required telemetry events',
      evidence: missingEvents,
      recommendation: 'Verify event tracking implementation for missing events'
    });
  }
  
  if (!sequenceValidation.valid) {
    issues.push({
      severity: 'medium',
      category: 'telemetry',
      description: 'Telemetry events sent out of sequence',
      evidence: sequenceValidation.issues,
      recommendation: 'Review event timing and ensure proper sequencing'
    });
  }
  
  // AC失敗の問題
  acResults.filter(result => !result.passed).forEach(result => {
    issues.push({
      severity: result.id === 'AC1' ? 'critical' : 'high',
      category: 'ac',
      description: `Acceptance Criteria ${result.id} failed: ${result.description}`,
      evidence: result.evidence,
      recommendation: `Address AC${result.id} requirements: ${result.details}`
    });
  });
  
  // パフォーマンス問題
  if (performance.telemetryDelay.avg > 1000) {
    issues.push({
      severity: 'medium',
      category: 'performance',
      description: 'High telemetry send delay detected',
      evidence: performance.telemetryDelay,
      recommendation: 'Optimize telemetry batching and network efficiency'
    });
  }
  
  // サマリー計算
  const summary = {
    totalEvents: collection.events.length,
    uniqueEvents: Object.keys(eventCounts).length,
    successRate: validPayloads / (validPayloads + invalidPayloads) * 100,
    acPassRate: acSummary.passRate,
    criticalIssues: issues.filter(i => i.severity === 'critical').length
  };
  
  return {
    metadata: {
      generatedAt,
      ...testMetadata
    },
    summary,
    telemetryAnalysis: {
      eventCounts,
      eventSequence: collection.events,
      duplicateEvents,
      missingEvents,
      payloadValidation: {
        validPayloads,
        invalidPayloads,
        piiLeaks: allPiiLeaks
      }
    },
    acceptanceCriteria: {
      results: acResults,
      passedCount: acSummary.passedTests,
      failedCount: acSummary.failedTests,
      details: acResults.map(result => ({
        id: result.id,
        status: result.passed ? 'PASS' : 'FAIL',
        description: result.description,
        evidence: result.evidence,
        recommendation: result.passed ? undefined : 
          `Review and fix ${result.id}: ${result.details}`
      }))
    },
    performance,
    issues
  };
}

/**
 * レポートのJSON保存
 */
export async function saveTelemetryReport(
  report: TelemetryReport,
  filePath: string = './.mcp-out/telemetry-report.json'
): Promise<void> {
  if (typeof window !== 'undefined') {
    // ブラウザ環境では localStorage に保存
    localStorage.setItem('telemetry_report', JSON.stringify(report, null, 2));
    console.log('Telemetry report saved to localStorage');
  } else {
    // Node.js環境ではファイルに保存
    const fs = await import('fs');
    const path = await import('path');
    
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    console.log(`Telemetry report saved to ${filePath}`);
  }
}

/**
 * レポートサマリーのコンソール出力
 */
export function printReportSummary(report: TelemetryReport): void {
  console.log('\n📊 Telemetry & AC Verification Report');
  console.log('=====================================');
  console.log(`Generated: ${report.metadata.generatedAt}`);
  console.log(`Test Suite: ${report.metadata.testSuite}`);
  console.log(`Environment: ${report.metadata.environment}\n`);
  
  console.log('📈 Summary:');
  console.log(`  Total Events: ${report.summary.totalEvents}`);
  console.log(`  Unique Events: ${report.summary.uniqueEvents}`);
  console.log(`  Success Rate: ${report.summary.successRate.toFixed(2)}%`);
  console.log(`  AC Pass Rate: ${report.summary.acPassRate}%`);
  console.log(`  Critical Issues: ${report.summary.criticalIssues}\n`);
  
  console.log('✅ Acceptance Criteria:');
  report.acceptanceCriteria.details.forEach(detail => {
    const status = detail.status === 'PASS' ? '✅' : '❌';
    console.log(`  ${status} ${detail.id}: ${detail.description}`);
  });
  
  if (report.issues.length > 0) {
    console.log('\n⚠️  Issues:');
    report.issues.forEach((issue, i) => {
      const severity = {
        critical: '🔴',
        high: '🟠', 
        medium: '🟡',
        low: '🟢'
      }[issue.severity];
      
      console.log(`  ${severity} [${issue.severity.toUpperCase()}] ${issue.description}`);
      console.log(`     Recommendation: ${issue.recommendation}`);
    });
  }
  
  console.log('\n=====================================\n');
}

/**
 * E2Eテスト用のヘルパー関数
 */
export function createTestTelemetryContext(overrides: Partial<ACTestContext> = {}): ACTestContext {
  return {
    position: {
      id: 'test-position-123',
      symbol: 'AAPL',
      side: 'LONG',
      status: 'OPEN',
      ownerId: 'current_user',
      avgPrice: 150.0,
      qtyTotal: 100,
      version: 1,
      updatedAt: new Date().toISOString(),
      chatId: 'test-chat-001'
    },
    currentUserId: 'current_user',
    telemetryEvents: [],
    uiState: {
      hasEditButton: true,
      modalOpen: false,
      conflictBannerVisible: false,
      toastVisible: false
    },
    apiResponses: [],
    sequenceLog: [],
    ...overrides
  };
}