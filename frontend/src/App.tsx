import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Trade from './components/Trade';
import Settings from './components/Settings';
import Support from './components/Support';
import { ToastProvider } from './components/ToastContainer';
import { initializeTelemetry, telemetryHelpers } from './lib/telemetry';

function AppContent() {
  const location = useLocation();
  const [isFileListVisible, setIsFileListVisible] = useState(true);
  const [selectedFile, setSelectedFile] = useState('フジクラ');
  
  // テレメトリシステムの初期化
  useEffect(() => {
    // テレメトリ初期化
    initializeTelemetry({
      enabled: true,
      endpoint: '/api/telemetry',
      batchSize: 10,
      flushInterval: 5000
    });
    
    // グローバルに公開（ブラウザでのテスト用）
    if (typeof window !== 'undefined') {
      (window as any).telemetryHelpers = telemetryHelpers;
      console.log('✅ Telemetry system initialized and exposed globally');
    }
  }, []);
  
  // ヘッダーを表示しないページを定義
  const noHeaderPages = ['/login', '/onboarding'];
  const showHeader = !noHeaderPages.includes(location.pathname);

  const handleToggleFileList = () => {
    setIsFileListVisible(!isFileListVisible);
  };

  const handleNewChat = () => {
    setSelectedFile('');
    console.log('Creating new chat...');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {showHeader && (
        <Header 
          onToggleFileList={handleToggleFileList}
          onNewChat={handleNewChat}
          isFileListVisible={isFileListVisible}
        />
      )}
      <main className={showHeader ? "pt-16" : ""}>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/onboarding" element={<Onboarding />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route 
            path="/trade" 
            element={
              <Trade 
                isFileListVisible={isFileListVisible}
                selectedFile={selectedFile}
                setSelectedFile={setSelectedFile}
              />
            } 
          />
          <Route path="/settings" element={<Settings />} />
          <Route path="/support" element={<Support />} />
          {/* Catch-all route for any unmatched paths */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Router>
        <AppContent />
      </Router>
    </ToastProvider>
  );
}