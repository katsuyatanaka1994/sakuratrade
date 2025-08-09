import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Login from './components/Login';
import Onboarding from './components/Onboarding';
import Dashboard from './components/Dashboard';
import Trade from './components/Trade';
import Settings from './components/Settings';
import Support from './components/Support';

function AppContent() {
  const location = useLocation();
  const [isFileListVisible, setIsFileListVisible] = useState(true);
  const [selectedFile, setSelectedFile] = useState('フジクラ');
  
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
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}